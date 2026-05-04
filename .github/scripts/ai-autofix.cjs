'use strict';

/**
 * AI Auto-fix script for CI failures on pull requests.
 *
 * Flow:
 *   1. Find the PR associated with the failing workflow run.
 *   2. Check loop-protection labels — skip if already attempted twice.
 *   3. Collect logs from fixable failing jobs.
 *   4. Collect the PR diff.
 *   5. Ask Claude to produce structured edits via tool_use.
 *   6. Apply edits, commit, push.
 *   7. Add label + comment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const RUN_ID = process.env.RUN_ID;
const HEAD_SHA = process.env.HEAD_SHA;
const HEAD_BRANCH = process.env.HEAD_BRANCH;
const REPO = process.env.REPO; // "owner/repo"

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_LOG_CHARS = 8_000;
const MAX_DIFF_CHARS = 40_000;
const MAX_EDITS = 8;

// Jobs Claude can attempt to fix (exact names from ci.yml)
const FIXABLE_JOBS = new Set(['Lint', 'Tests (client)', 'Tests (server)', 'Type check (strict)']);

// Labels used for loop protection
const LABEL_ATTEMPTED = 'ai-fix-attempted';
const LABEL_MAX = 'ai-fix-max-attempts';
const LABEL_NEEDS_HUMAN = 'needs-human-fix';

// Paths Claude must never edit
const FORBIDDEN_PATH_PREFIXES = ['.github/', 'package.json', 'package-lock.json'];

// ── GitHub API helpers ───────────────────────────────────────────────────────

async function ghFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} at ${url}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function findPR() {
  const prs = await ghFetch(
    `/repos/${REPO}/pulls?state=open&head=${HEAD_BRANCH}&per_page=10`,
  );
  // Match by HEAD sha
  const match = prs.find(pr => pr.head.sha === HEAD_SHA);
  if (match) return match;
  // Fallback: match by branch name
  return prs[0] ?? null;
}

async function getLabels(prNumber) {
  const data = await ghFetch(`/repos/${REPO}/issues/${prNumber}/labels`);
  return data.map(l => l.name);
}

async function addLabel(prNumber, label) {
  await ghFetch(`/repos/${REPO}/issues/${prNumber}/labels`, {
    method: 'POST',
    body: { labels: [label] },
  });
}

async function addComment(prNumber, body) {
  await ghFetch(`/repos/${REPO}/issues/${prNumber}/comments`, {
    method: 'POST',
    body: { body },
  });
}

async function getFailingJobs() {
  const data = await ghFetch(`/repos/${REPO}/actions/runs/${RUN_ID}/jobs`);
  return data.jobs.filter(
    j => j.conclusion === 'failure' && FIXABLE_JOBS.has(j.name),
  );
}

async function getJobLog(jobId) {
  // Redirect returns the actual log URL
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      redirect: 'follow',
    },
  );
  if (!res.ok) return '(log unavailable)';
  const text = await res.text();
  // Trim to last MAX_LOG_CHARS characters — errors are usually at the end
  return text.length > MAX_LOG_CHARS ? '…' + text.slice(-MAX_LOG_CHARS) : text;
}

async function getPRDiff(prNumber) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.diff',
    },
  });
  if (!res.ok) return '(diff unavailable)';
  const text = await res.text();
  return text.length > MAX_DIFF_CHARS ? text.slice(0, MAX_DIFF_CHARS) + '\n…(truncated)' : text;
}

// ── Anthropic API call ───────────────────────────────────────────────────────

const APPLY_FIXES_TOOL = {
  name: 'apply_fixes',
  description:
    'Return whether you can fix the CI failures and, if so, the exact file edits needed.',
  input_schema: {
    type: 'object',
    required: ['canFix', 'confidence', 'explanation', 'edits'],
    properties: {
      canFix: {
        type: 'boolean',
        description: 'true if you found concrete, safe edits to fix the failures',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How confident you are that the edits will fix CI',
      },
      explanation: {
        type: 'string',
        description: 'Brief plain-text explanation of what was wrong and what you changed',
      },
      edits: {
        type: 'array',
        maxItems: 8,
        description: 'List of file edits to apply (empty if canFix is false)',
        items: {
          type: 'object',
          required: ['path', 'oldString', 'newString'],
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to repo root',
            },
            oldString: {
              type: 'string',
              description:
                'Exact string to find in the file (must be unique in the file)',
            },
            newString: {
              type: 'string',
              description: 'Replacement string',
            },
          },
        },
      },
    },
  },
};

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [APPLY_FIXES_TOOL],
      tool_choice: { type: 'tool', name: 'apply_fixes' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const toolUse = data.content.find(b => b.type === 'tool_use' && b.name === 'apply_fixes');
  if (!toolUse) throw new Error('Claude did not call apply_fixes tool');
  return toolUse.input;
}

// ── File edit helpers ────────────────────────────────────────────────────────

function isForbiddenPath(filePath) {
  return FORBIDDEN_PATH_PREFIXES.some(prefix => filePath.startsWith(prefix));
}

function applyEdit(edit) {
  const { path: filePath, oldString, newString } = edit;

  if (isForbiddenPath(filePath)) {
    console.warn(`[autofix] Skipping forbidden path: ${filePath}`);
    return false;
  }

  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.warn(`[autofix] File not found, skipping: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(absPath, 'utf8');
  const occurrences = content.split(oldString).length - 1;

  if (occurrences === 0) {
    console.warn(`[autofix] oldString not found in ${filePath}, skipping`);
    return false;
  }
  if (occurrences > 1) {
    console.warn(`[autofix] oldString is ambiguous (${occurrences} matches) in ${filePath}, skipping`);
    return false;
  }

  fs.writeFileSync(absPath, content.replace(oldString, newString), 'utf8');
  console.log(`[autofix] Edited: ${filePath}`);
  return true;
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function gitConfig() {
  execSync('git config user.name "BrewMate AI"');
  execSync('git config user.email "ai-autofix@brewmate.app"');
}

function gitCommitAndPush(editedFiles) {
  const fileList = editedFiles.join(' ');
  execSync(`git add ${fileList}`);
  execSync(`git commit -m "fix: auto-fix CI failures [skip autofix]"`);
  execSync(`git push origin HEAD:${HEAD_BRANCH}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[autofix] Starting AI auto-fix run');
  console.log(`[autofix] Run ID: ${RUN_ID}, SHA: ${HEAD_SHA}, Branch: ${HEAD_BRANCH}`);

  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');

  // 1. Find PR
  const pr = await findPR();
  if (!pr) {
    console.log('[autofix] No open PR found for this run, skipping');
    return;
  }
  const prNumber = pr.number;
  console.log(`[autofix] Found PR #${prNumber}: ${pr.title}`);

  // Skip commits made by this bot (prevent infinite loops via commit message guard)
  const commitMsg = execSync('git log -1 --format=%s').toString().trim();
  if (commitMsg.includes('[skip autofix]')) {
    console.log('[autofix] Last commit was from autofix — skipping to avoid loop');
    return;
  }

  // 2. Loop-protection labels
  const labels = await getLabels(prNumber);
  if (labels.includes(LABEL_MAX)) {
    console.log('[autofix] PR already has ai-fix-max-attempts label, skipping');
    return;
  }
  const previousAttempt = labels.includes(LABEL_ATTEMPTED);
  if (previousAttempt) {
    console.log('[autofix] This is attempt #2 — will add max-attempts label after this run');
  }

  // 3. Get failing jobs
  const failingJobs = await getFailingJobs();
  if (failingJobs.length === 0) {
    console.log('[autofix] No fixable failing jobs found');
    return;
  }
  console.log(`[autofix] Failing fixable jobs: ${failingJobs.map(j => j.name).join(', ')}`);

  // 4. Collect logs
  const logSections = await Promise.all(
    failingJobs.map(async job => {
      const log = await getJobLog(job.id);
      return `### Job: ${job.name}\n\`\`\`\n${log}\n\`\`\``;
    }),
  );

  // 5. Get PR diff
  const diff = await getPRDiff(prNumber);

  // 6. Build prompt
  const prompt = `You are an expert TypeScript / JavaScript / React Native developer helping fix CI failures on a pull request in the BrewMate mobile app.

## Repository conventions (brief)
- React Native 0.83 + TypeScript, Node.js/Express backend
- ESLint: @react-native config (no unused vars, no unused imports)
- Jest for tests (client uses RN preset, server uses babel-jest for ESM)
- TypeScript strict mode for client code

## Failing CI jobs and their logs

${logSections.join('\n\n')}

## PR diff (what changed in this PR)

\`\`\`diff
${diff}
\`\`\`

## Instructions

Analyse the CI failures carefully. Produce up to ${MAX_EDITS} targeted file edits that will fix the failures.

Rules:
1. Only edit existing files — never create or delete files.
2. Each edit's \`oldString\` must appear **exactly once** in the file.
3. Make minimal changes — fix only what CI is complaining about.
4. Never edit: .github/ files, package.json, package-lock.json.
5. If the failure is a genuine logic bug introduced by the PR author that requires deeper understanding, set canFix=false.
6. If you are not at least medium-confidence, set canFix=false.

Call the apply_fixes tool with your result now.`;

  // 7. Call Claude
  console.log('[autofix] Calling Claude API…');
  let result;
  try {
    result = await callClaude(prompt);
  } catch (err) {
    console.error('[autofix] Claude API error:', err.message);
    await addLabel(prNumber, LABEL_NEEDS_HUMAN);
    await addComment(
      prNumber,
      `### AI Auto-fix\n\n❌ Claude API call failed: \`${err.message}\`\n\nManual fix required.`,
    );
    return;
  }

  console.log(`[autofix] Claude response — canFix: ${result.canFix}, confidence: ${result.confidence}`);
  console.log(`[autofix] Explanation: ${result.explanation}`);

  if (!result.canFix || result.confidence === 'low') {
    await addLabel(prNumber, LABEL_NEEDS_HUMAN);
    if (previousAttempt) await addLabel(prNumber, LABEL_MAX);
    await addComment(
      prNumber,
      `### AI Auto-fix\n\n🤷 Claude could not automatically fix these CI failures.\n\n**Reason:** ${result.explanation}\n\nManual fix required.`,
    );
    return;
  }

  // 8. Apply edits
  const editedFiles = [];
  for (const edit of result.edits.slice(0, MAX_EDITS)) {
    if (applyEdit(edit)) {
      editedFiles.push(edit.path);
    }
  }

  if (editedFiles.length === 0) {
    console.log('[autofix] No edits were successfully applied');
    await addLabel(prNumber, LABEL_NEEDS_HUMAN);
    await addComment(
      prNumber,
      `### AI Auto-fix\n\n⚠️ Claude suggested edits but none could be applied (files not found or oldString mismatch).\n\n**Explanation:** ${result.explanation}\n\nManual fix required.`,
    );
    return;
  }

  // 9. Commit and push
  gitConfig();
  try {
    gitCommitAndPush(editedFiles);
    console.log('[autofix] Committed and pushed fixes');
  } catch (err) {
    console.error('[autofix] Git push failed:', err.message);
    await addComment(
      prNumber,
      `### AI Auto-fix\n\n❌ Applied edits locally but push failed: \`${err.message}\`\n\nManual fix required.`,
    );
    return;
  }

  // 10. Labels and comment
  await addLabel(prNumber, LABEL_ATTEMPTED);
  if (previousAttempt) await addLabel(prNumber, LABEL_MAX);

  const editList = editedFiles.map(f => `- \`${f}\``).join('\n');
  await addComment(
    prNumber,
    `### AI Auto-fix ✅

Claude automatically fixed the CI failures (confidence: **${result.confidence}**).

**What was fixed:** ${result.explanation}

**Files edited:**
${editList}

CI will re-run on the new commit. If it still fails, further auto-fix attempts ${previousAttempt ? 'will not be made (max attempts reached)' : 'may be made (1 attempt remaining)'}.`,
  );

  console.log('[autofix] Done');
}

main().catch(err => {
  console.error('[autofix] Fatal error:', err);
  process.exit(1);
});
