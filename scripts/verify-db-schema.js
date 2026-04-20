#!/usr/bin/env node
/**
 * Verify that every schema object declared in supabase/*.sql exists in the
 * live Postgres instance (tables, columns, indexes, RLS policies, functions,
 * triggers, extensions).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/verify-db-schema.js
 *   node scripts/verify-db-schema.js                 # reads .env like the server
 *   node scripts/verify-db-schema.js --json          # machine-readable report
 *
 * Exit codes: 0 = everything present, 1 = missing objects found, 2 = bad config.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SUPABASE_DIR = path.join(REPO_ROOT, 'supabase');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const args = new Set(process.argv.slice(2));
const OUTPUT_JSON = args.has('--json');

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error(
    'ERROR: set DATABASE_URL (or SUPABASE_DB_URL) before running the verifier.',
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// SQL parsing — extract declared objects from every .sql file.
// ---------------------------------------------------------------------------

const stripSqlComments = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');

const unquote = (ident) => ident.replace(/^"(.*)"$/, '$1');
const stripSchema = (qualified) => qualified.replace(/^public\./i, '');
const normalize = (ident) => unquote(stripSchema(ident.trim())).toLowerCase();

const IDENT = '(?:"[^"]+"|[a-zA-Z_][\\w]*)';
const QUALIFIED_IDENT = `(?:${IDENT}\\.)?${IDENT}`;

const RE_TABLE = new RegExp(
  `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${QUALIFIED_IDENT})\\s*\\(`,
  'gi',
);
const RE_INDEX = new RegExp(
  `create\\s+(?:unique\\s+)?index\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENT})\\s+on\\s+(${QUALIFIED_IDENT})`,
  'gi',
);
const RE_POLICY = new RegExp(
  `create\\s+policy\\s+("[^"]+"|'[^']+'|${IDENT})\\s+on\\s+(${QUALIFIED_IDENT})`,
  'gi',
);
const RE_FUNCTION = new RegExp(
  `create\\s+(?:or\\s+replace\\s+)?function\\s+(${QUALIFIED_IDENT})\\s*\\(`,
  'gi',
);
const RE_TRIGGER = new RegExp(
  `create\\s+(?:or\\s+replace\\s+)?trigger\\s+(${IDENT})\\b[\\s\\S]*?\\bon\\s+(${QUALIFIED_IDENT})`,
  'gi',
);
const RE_EXTENSION = new RegExp(
  `create\\s+extension\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENT}|"[^"]+")`,
  'gi',
);
// Captures the whole body of an ALTER TABLE statement up to the semicolon so
// we can inspect all ADD COLUMN clauses inside (they may be comma-separated).
const RE_ALTER_TABLE = new RegExp(
  `alter\\s+table\\s+(?:if\\s+exists\\s+)?(${QUALIFIED_IDENT})([\\s\\S]*?);`,
  'gi',
);
const RE_ADD_COLUMN = new RegExp(
  `add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENT})`,
  'gi',
);
// Columns declared inside CREATE TABLE (...) — we only need names to compare.
const RE_CREATE_TABLE_BODY = new RegExp(
  `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${QUALIFIED_IDENT})\\s*\\(([\\s\\S]*?)\\)\\s*;`,
  'gi',
);

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  'primary',
  'unique',
  'foreign',
  'check',
  'constraint',
  'like',
  'exclude',
]);

function parseTableColumns(body) {
  // Split on top-level commas (ignoring commas within parens).
  const cols = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) cols.push(current.trim());

  const names = [];
  for (const raw of cols) {
    const firstToken = raw.split(/\s+/)[0];
    if (!firstToken) continue;
    const unquoted = unquote(firstToken);
    if (COLUMN_CONSTRAINT_KEYWORDS.has(unquoted.toLowerCase())) continue;
    names.push(unquoted.toLowerCase());
  }
  return names;
}

function parseSqlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const sql = stripSqlComments(raw);

  const tables = new Map(); // tableName -> Set(columnName)
  const indexes = []; // {name, table}
  const policies = []; // {name, table}
  const functions = new Set(); // name only (schema-qualified without schema)
  const triggers = []; // {name, table}
  const extensions = new Set();
  const addedColumns = []; // {table, column}

  let m;
  while ((m = RE_CREATE_TABLE_BODY.exec(sql))) {
    const table = normalize(m[1]);
    const cols = parseTableColumns(m[2]);
    if (!tables.has(table)) tables.set(table, new Set());
    const set = tables.get(table);
    cols.forEach((c) => set.add(c));
  }
  // Reset lastIndex so we can reuse the single-table regex separately if needed.
  RE_CREATE_TABLE_BODY.lastIndex = 0;

  while ((m = RE_TABLE.exec(sql))) {
    const table = normalize(m[1]);
    if (!tables.has(table)) tables.set(table, new Set());
  }
  RE_TABLE.lastIndex = 0;

  while ((m = RE_INDEX.exec(sql))) {
    indexes.push({ name: normalize(m[1]), table: normalize(m[2]) });
  }
  RE_INDEX.lastIndex = 0;

  while ((m = RE_POLICY.exec(sql))) {
    const rawName = m[1].trim();
    const name = rawName
      .replace(/^"(.*)"$/, '$1')
      .replace(/^'(.*)'$/, '$1');
    policies.push({ name, table: normalize(m[2]) });
  }
  RE_POLICY.lastIndex = 0;

  while ((m = RE_FUNCTION.exec(sql))) {
    functions.add(normalize(m[1]));
  }
  RE_FUNCTION.lastIndex = 0;

  while ((m = RE_TRIGGER.exec(sql))) {
    triggers.push({ name: normalize(m[1]), table: normalize(m[2]) });
  }
  RE_TRIGGER.lastIndex = 0;

  while ((m = RE_EXTENSION.exec(sql))) {
    extensions.add(normalize(m[1]));
  }
  RE_EXTENSION.lastIndex = 0;

  while ((m = RE_ALTER_TABLE.exec(sql))) {
    const table = normalize(m[1]);
    const body = m[2];
    let c;
    while ((c = RE_ADD_COLUMN.exec(body))) {
      addedColumns.push({ table, column: normalize(c[1]) });
    }
    RE_ADD_COLUMN.lastIndex = 0;
  }
  RE_ALTER_TABLE.lastIndex = 0;

  return {
    file: path.basename(filePath),
    tables,
    indexes,
    policies,
    functions,
    triggers,
    extensions,
    addedColumns,
  };
}

function collectExpected() {
  const files = fs
    .readdirSync(SUPABASE_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return files.map((name) => parseSqlFile(path.join(SUPABASE_DIR, name)));
}

// ---------------------------------------------------------------------------
// DB introspection
// ---------------------------------------------------------------------------

async function loadActualSchema(pool) {
  const [tables, columns, indexes, policies, functions, triggers, extensions] =
    await Promise.all([
      pool.query(
        `select tablename from pg_tables where schemaname = 'public'`,
      ),
      pool.query(
        `select table_name, column_name
           from information_schema.columns
          where table_schema = 'public'`,
      ),
      pool.query(
        `select indexname, tablename
           from pg_indexes where schemaname = 'public'`,
      ),
      pool.query(
        `select policyname, tablename
           from pg_policies where schemaname = 'public'`,
      ),
      pool.query(
        `select p.proname
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'`,
      ),
      pool.query(
        `select t.tgname, c.relname
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and not t.tgisinternal`,
      ),
      pool.query(`select extname from pg_extension`),
    ]);

  const columnsByTable = new Map();
  for (const row of columns.rows) {
    const key = row.table_name.toLowerCase();
    if (!columnsByTable.has(key)) columnsByTable.set(key, new Set());
    columnsByTable.get(key).add(row.column_name.toLowerCase());
  }

  return {
    tables: new Set(tables.rows.map((r) => r.tablename.toLowerCase())),
    columnsByTable,
    indexes: new Set(indexes.rows.map((r) => r.indexname.toLowerCase())),
    policies: new Set(
      policies.rows.map(
        (r) => `${r.tablename.toLowerCase()}::${r.policyname}`,
      ),
    ),
    functions: new Set(functions.rows.map((r) => r.proname.toLowerCase())),
    triggers: new Set(
      triggers.rows.map((r) => `${r.relname.toLowerCase()}::${r.tgname.toLowerCase()}`),
    ),
    extensions: new Set(extensions.rows.map((r) => r.extname.toLowerCase())),
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compareFile(expected, actual) {
  const missing = {
    tables: [],
    columns: [],
    addedColumns: [],
    indexes: [],
    policies: [],
    functions: [],
    triggers: [],
    extensions: [],
  };

  for (const [table, cols] of expected.tables) {
    if (!actual.tables.has(table)) {
      missing.tables.push(table);
      continue;
    }
    const actualCols = actual.columnsByTable.get(table) || new Set();
    for (const col of cols) {
      if (!actualCols.has(col)) {
        missing.columns.push(`${table}.${col}`);
      }
    }
  }

  for (const { table, column } of expected.addedColumns) {
    const actualCols = actual.columnsByTable.get(table) || new Set();
    if (!actualCols.has(column)) {
      missing.addedColumns.push(`${table}.${column}`);
    }
  }

  for (const { name } of expected.indexes) {
    if (!actual.indexes.has(name)) missing.indexes.push(name);
  }

  for (const { name, table } of expected.policies) {
    if (!actual.policies.has(`${table}::${name}`)) {
      missing.policies.push(`${table}::${name}`);
    }
  }

  for (const fn of expected.functions) {
    if (!actual.functions.has(fn)) missing.functions.push(fn);
  }

  for (const { name, table } of expected.triggers) {
    if (!actual.triggers.has(`${table}::${name}`)) {
      missing.triggers.push(`${table}::${name}`);
    }
  }

  for (const ext of expected.extensions) {
    if (!actual.extensions.has(ext)) missing.extensions.push(ext);
  }

  const totalMissing =
    missing.tables.length +
    missing.columns.length +
    missing.addedColumns.length +
    missing.indexes.length +
    missing.policies.length +
    missing.functions.length +
    missing.triggers.length +
    missing.extensions.length;

  return { missing, totalMissing };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function formatTextReport(perFile, connectionInfo) {
  const lines = [];
  lines.push('===========================================================');
  lines.push(' BrewMate — DB schema verification report');
  lines.push(`  host: ${connectionInfo.host}  db: ${connectionInfo.database}`);
  lines.push(`  timestamp: ${new Date().toISOString()}`);
  lines.push('===========================================================');
  lines.push('');

  let grandTotal = 0;
  for (const entry of perFile) {
    const { file, comparison } = entry;
    const { missing, totalMissing } = comparison;
    grandTotal += totalMissing;

    const header = totalMissing === 0 ? '[OK]   ' : `[FAIL] `;
    lines.push(`${header}${file}  (missing: ${totalMissing})`);

    const sections = [
      ['tables', missing.tables],
      ['columns (create table)', missing.columns],
      ['columns (alter table add)', missing.addedColumns],
      ['indexes', missing.indexes],
      ['policies (table::name)', missing.policies],
      ['functions', missing.functions],
      ['triggers (table::name)', missing.triggers],
      ['extensions', missing.extensions],
    ];
    for (const [label, items] of sections) {
      if (items.length === 0) continue;
      lines.push(`        - missing ${label}:`);
      for (const it of items) {
        lines.push(`            * ${it}`);
      }
    }
  }

  lines.push('');
  lines.push('-----------------------------------------------------------');
  lines.push(
    grandTotal === 0
      ? 'SUMMARY: every declared object is present ✅'
      : `SUMMARY: ${grandTotal} object(s) missing across ${perFile.filter((e) => e.comparison.totalMissing > 0).length} file(s) ❌`,
  );
  lines.push('-----------------------------------------------------------');
  return lines.join('\n');
}

function formatJsonReport(perFile, connectionInfo) {
  return JSON.stringify(
    {
      host: connectionInfo.host,
      database: connectionInfo.database,
      timestamp: new Date().toISOString(),
      files: perFile.map((e) => ({
        file: e.file,
        totalMissing: e.comparison.totalMissing,
        missing: e.comparison.missing,
      })),
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const expectedPerFile = collectExpected();

  const needsSsl =
    connectionString.includes('supabase.co') ||
    connectionString.includes('sslmode=require');
  const pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  let actual;
  let connectionInfo = { host: 'unknown', database: 'unknown' };
  try {
    const client = await pool.connect();
    try {
      const info = await client.query(
        `select current_database() as database,
                inet_server_addr()::text as host`,
      );
      connectionInfo = {
        host: info.rows[0]?.host || 'localhost',
        database: info.rows[0]?.database || 'unknown',
      };
      actual = await loadActualSchema(client);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ERROR: could not connect or introspect the database.');
    console.error(err.message);
    await pool.end().catch(() => {});
    process.exit(2);
  }

  const perFile = expectedPerFile.map((expected) => ({
    file: expected.file,
    comparison: compareFile(expected, actual),
  }));

  const totalMissing = perFile.reduce(
    (acc, e) => acc + e.comparison.totalMissing,
    0,
  );

  const output = OUTPUT_JSON
    ? formatJsonReport(perFile, connectionInfo)
    : formatTextReport(perFile, connectionInfo);

  console.log(output);

  await pool.end().catch(() => {});
  process.exit(totalMissing === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
