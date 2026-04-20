#!/usr/bin/env node
/**
 * Reads every supabase/*.sql file, extracts the declared schema objects
 * (extensions, tables, columns, indexes, RLS policies, functions, triggers),
 * and writes a single standalone SQL script to supabase/verify_schema.sql.
 *
 * The generated SQL is safe to paste into the Supabase SQL editor. It lists
 * every expected object and reports only the ones that are missing from the
 * live database.
 *
 * Regenerate after adding new migrations:
 *   node scripts/build-verify-sql.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SUPABASE_DIR = path.join(REPO_ROOT, 'supabase');
const OUTPUT_FILE = path.join(SUPABASE_DIR, 'verify_schema.sql');

// ---------------------------------------------------------------------------
// SQL parsing
// ---------------------------------------------------------------------------

const stripSqlComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

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
const RE_ALTER_TABLE = new RegExp(
  `alter\\s+table\\s+(?:if\\s+exists\\s+)?(${QUALIFIED_IDENT})([\\s\\S]*?);`,
  'gi',
);
const RE_ADD_COLUMN = new RegExp(
  `add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENT})`,
  'gi',
);
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

  const tables = new Map(); // table -> Set(column)
  const indexes = [];
  const policies = [];
  const functions = new Set();
  const triggers = [];
  const extensions = new Set();
  const addedColumns = [];

  let m;
  while ((m = RE_CREATE_TABLE_BODY.exec(sql))) {
    const table = normalize(m[1]);
    const cols = parseTableColumns(m[2]);
    if (!tables.has(table)) tables.set(table, new Set());
    const set = tables.get(table);
    cols.forEach((c) => set.add(c));
  }
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
      .replace(/^'(.*)'$/, '$1')
      .toLowerCase();
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
  return fs
    .readdirSync(SUPABASE_DIR)
    .filter(
      (name) => name.endsWith('.sql') && name !== 'verify_schema.sql',
    )
    .sort()
    .map((name) => parseSqlFile(path.join(SUPABASE_DIR, name)));
}

// ---------------------------------------------------------------------------
// Aggregate expected objects across all files (deduped).
// Each entry: { kind, qualifiedName, source: [files...] }
// Key format:
//   extension: <name>
//   table:     <name>
//   column:    <table>.<column>
//   index:     <name>
//   policy:    <table>::<name>
//   function:  <name>
//   trigger:   <table>::<name>
// ---------------------------------------------------------------------------

function aggregate(perFile) {
  const map = new Map(); // kind|qname -> { kind, qname, sources:Set }
  const add = (kind, qname, source) => {
    const key = `${kind}|${qname}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { kind, qname, sources: new Set() };
      map.set(key, entry);
    }
    entry.sources.add(source);
  };

  for (const p of perFile) {
    for (const ext of p.extensions) add('extension', ext, p.file);
    for (const [table, cols] of p.tables) {
      add('table', table, p.file);
      for (const col of cols) add('column', `${table}.${col}`, p.file);
    }
    for (const { table, column } of p.addedColumns) {
      add('column', `${table}.${column}`, p.file);
    }
    for (const idx of p.indexes) add('index', idx.name, p.file);
    for (const pol of p.policies) add('policy', `${pol.table}::${pol.name}`, p.file);
    for (const fn of p.functions) add('function', fn, p.file);
    for (const tr of p.triggers) add('trigger', `${tr.table}::${tr.name}`, p.file);
  }
  return [...map.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.qname.localeCompare(b.qname);
  });
}

// ---------------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------------

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

function emitSql(entries) {
  const lines = [];
  lines.push('-- =========================================================');
  lines.push('-- BrewMate — DB schema verification');
  lines.push(`-- Generated from supabase/*.sql at ${new Date().toISOString()}`);
  lines.push('-- Paste this whole file into the Supabase SQL editor and run.');
  lines.push('-- Output rows list every object that is missing from the DB.');
  lines.push('-- An empty result set means the schema is in sync.');
  lines.push('-- =========================================================');
  lines.push('');
  lines.push('with expected(kind, qualified_name, sources) as (values');
  entries.forEach((e, i) => {
    const sources = [...e.sources].sort().join(', ');
    const suffix = i === entries.length - 1 ? '' : ',';
    lines.push(
      `  (${sqlString(e.kind)}, ${sqlString(e.qname)}, ${sqlString(sources)})${suffix}`,
    );
  });
  lines.push('),');
  lines.push('actual(kind, qualified_name) as (');
  lines.push("  select 'extension', lower(extname) from pg_extension");
  lines.push('  union all');
  lines.push(
    "  select 'table', lower(tablename) from pg_tables where schemaname = 'public'",
  );
  lines.push('  union all');
  lines.push(
    "  select 'column', lower(table_name) || '.' || lower(column_name)",
  );
  lines.push(
    "    from information_schema.columns where table_schema = 'public'",
  );
  lines.push('  union all');
  lines.push(
    "  select 'index', lower(indexname) from pg_indexes where schemaname = 'public'",
  );
  lines.push('  union all');
  lines.push(
    "  select 'policy', lower(tablename) || '::' || lower(policyname)",
  );
  lines.push("    from pg_policies where schemaname = 'public'");
  lines.push('  union all');
  lines.push("  select 'function', lower(p.proname)");
  lines.push(
    '    from pg_proc p join pg_namespace n on n.oid = p.pronamespace',
  );
  lines.push("   where n.nspname = 'public'");
  lines.push('  union all');
  lines.push(
    "  select 'trigger', lower(c.relname) || '::' || lower(t.tgname)",
  );
  lines.push('    from pg_trigger t');
  lines.push('    join pg_class c on c.oid = t.tgrelid');
  lines.push('    join pg_namespace n on n.oid = c.relnamespace');
  lines.push(
    "   where n.nspname = 'public' and not t.tgisinternal",
  );
  lines.push(')');
  lines.push('select e.kind,');
  lines.push('       e.qualified_name as missing_object,');
  lines.push('       e.sources as declared_in');
  lines.push('  from expected e');
  lines.push('  left join actual a');
  lines.push('    on a.kind = e.kind');
  lines.push('   and a.qualified_name = lower(e.qualified_name)');
  lines.push(' where a.qualified_name is null');
  lines.push(' order by e.kind, e.qualified_name;');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const perFile = collectExpected();
  const entries = aggregate(perFile);
  const sql = emitSql(entries);
  fs.writeFileSync(OUTPUT_FILE, sql);
  console.log(
    `Wrote ${OUTPUT_FILE} — ${entries.length} expected objects across ${perFile.length} migration files.`,
  );
}

main();
