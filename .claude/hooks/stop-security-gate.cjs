// Detects server/ file changes and reminds to run security-reviewer.
// Exits with code 1 to block Claude if server/ changes exist without acknowledgement.
const { execSync } = require('child_process');
const path = require('path');
const CWD = path.resolve(__dirname, '../..');

let changedFiles;
try {
  const tracked = execSync('git diff --name-only HEAD', { cwd: CWD, encoding: 'utf8' });
  const staged = execSync('git diff --name-only --cached HEAD', { cwd: CWD, encoding: 'utf8' });
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: CWD, encoding: 'utf8' });
  changedFiles = [...tracked.trim().split('\n'), ...staged.trim().split('\n'), ...untracked.trim().split('\n')].filter(Boolean);
} catch {
  process.exit(0);
}

const serverFiles = changedFiles.filter(f => f.startsWith('server/') && /\.(js|ts)$/.test(f));

if (serverFiles.length === 0) process.exit(0);

console.log('\n⚠️  SECURITY GATE: Zmenené server/ súbory (' + serverFiles.length + '):');
serverFiles.forEach(f => console.log('  ' + f));
console.log('\n🔐 Spusti security-reviewer subagent pred commitom.');
console.log('   V /implement pipeline sa to deje automaticky v Fáze 5b.');
console.log('   Ak si security review už dokončil, môžeš pokračovať.\n');
