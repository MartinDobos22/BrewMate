// Reminds to update supabase/setup.sql when a new migration file is written
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = (input.tool_input?.file_path || '').replace(/\\/g, '/');
if (
  filePath.match(/supabase\/.+\.sql$/) &&
  !filePath.includes('setup.sql') &&
  !filePath.includes('.down.sql')
) {
  console.log('HOOK: Nezabudni aktualizovať supabase/setup.sql v tom istom PR!');
}
