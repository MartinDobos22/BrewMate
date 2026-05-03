// After tests pass, lists changed TS/TSX files and prompts to run code-reviewer.
// Does NOT auto-invoke Claude (avoids infinite loops); just surfaces the info.
const { execSync } = require('child_process');
const path = require('path');
const CWD = path.resolve(__dirname, '../..');

let changedFiles;
try {
  changedFiles = execSync('git diff --name-only HEAD', { cwd: CWD, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(f => f.match(/\.(ts|tsx)$/) && !f.includes('node_modules'));
} catch {
  process.exit(0);
}

if (changedFiles.length === 0) process.exit(0);

console.log('REVIEW GATE: Zmenené TS súbory (' + changedFiles.length + '):');
changedFiles.forEach(f => console.log('  ' + f));
console.log('\nPre review spusti: Use code-reviewer subagent alebo /implement dokončí review automaticky.');
