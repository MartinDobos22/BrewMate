// Automatically creates a new branch when Claude is about to write/edit files on main/master.
// Runs as PreToolUse on Write|Edit. Always exits 0 so the tool use is never blocked.
const { execSync } = require('child_process');
const path = require('path');
const CWD = path.resolve(__dirname, '../..');

let currentBranch;
try {
  currentBranch = execSync('git branch --show-current', { cwd: CWD, encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

if (!['main', 'master'].includes(currentBranch)) process.exit(0);

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const branchName = `claude/${stamp}`;

try {
  execSync(`git checkout -b "${branchName}"`, { cwd: CWD, stdio: 'pipe' });
  console.log(`BRANCH GUARD: Automaticky vytvorená branch '${branchName}' (bol si na main).`);
  console.log('             Ak chceš zmysluplnejší názov, použi /implement — ten branch pomenuje podľa úlohy.');
} catch (err) {
  console.error(`BRANCH GUARD: Branch '${branchName}' sa nepodarilo vytvoriť: ${err.message}`);
}
