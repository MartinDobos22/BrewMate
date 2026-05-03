// Runs tests if JS/TS files were changed. Exits with code 1 to block Claude if tests fail.
const { execSync } = require('child_process');
const CWD = 'C:/Users/dobos/WebstormProjects/BrewMate';

let changedFiles;
try {
  const tracked = execSync('git diff --name-only HEAD', { cwd: CWD, encoding: 'utf8' });
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: CWD, encoding: 'utf8' });
  changedFiles = [...tracked.trim().split('\n'), ...untracked.trim().split('\n')].filter(Boolean);
} catch {
  process.exit(0); // not a git repo or no commits yet
}

const CODE_FILES = /\.(ts|tsx|js|jsx)$/;
const hasClientChanges = changedFiles.some(f => f.startsWith('src/') && CODE_FILES.test(f));
const hasServerChanges = changedFiles.some(f => f.startsWith('server/') && CODE_FILES.test(f));

if (!hasClientChanges && !hasServerChanges) {
  console.log('TEST GATE: Žiadne JS/TS zmeny — testy preskočené.');
  process.exit(0);
}

const cmd = hasClientChanges && hasServerChanges
  ? 'npm test -- --passWithNoTests'
  : hasClientChanges
    ? 'npm run test:client -- --passWithNoTests'
    : 'npm run test:server -- --passWithNoTests';

console.log('TEST GATE: Spúšťam ' + cmd);
try {
  execSync(cmd, { cwd: CWD, stdio: 'inherit' });
} catch {
  console.error('TEST GATE: Testy zlyhali — oprav ich pred dokončením.');
  process.exit(1);
}
