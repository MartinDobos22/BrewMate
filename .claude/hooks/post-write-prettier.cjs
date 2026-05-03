// Auto-formats saved files with Prettier if available
const { execSync } = require('child_process');
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = (input.tool_input?.file_path || '').replace(/\\/g, '/');

const FORMATTABLE = /\.(ts|tsx|js|jsx|json|css|md)$/;
const SKIP = ['node_modules', '.claude', 'Pods', 'android/'];

if (!FORMATTABLE.test(filePath) || SKIP.some(s => filePath.includes(s))) {
  process.exit(0);
}

try {
  execSync(`npx prettier --write "${filePath}"`, {
    cwd: require('path').resolve(__dirname, '../..'),
    stdio: 'pipe',
  });
  console.log('Prettier: formatted ' + filePath.split('/').pop());
} catch {
  // prettier not installed or config error — silent skip
}
