import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src/modules/clientPortal/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const mojibakeFixes = [
  ['ðŸ‡µðŸ‡¾', '🇵🇾'],
  ['Â·', '·'],
  ['â ³', '⏳'],
  ['Â¡', '¡'],
  ['ðŸ’°', '💰'],
  ['ðŸ’µ', '💵'],
  ['ðŸ’¥', '📄'],
  ['ðŸ’¼', '🏢'],
  ['ðŸ’¡', '💡'],
  ['ðŸ‘¥', '👥'],
  ['ðŸ—‚ï¸ ', '🗂️'],
  ['ðŸ ¥', '🏥'],
  ['ðŸ’¬', '💬'],
  ['ðŸ“Š', '📊'],
  ['ðŸ”§', '🔧'],
  ['ðŸ“‹', '📋'],
  ['ðŸ‘¨â€ ðŸ’¼', '👨‍💼'],
  ['AntigÃ¼edad', 'Antigüedad'],
  ['antigÃ¼edad', 'antigüedad'],
  ['â˜ž', '☞'],
  ['âš™', '⚙️'],
  ['Â¿', '¿'],
  ['Ã³', 'ó'],
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ãº', 'ú'],
  ['Ã±', 'ñ'],
  ['Ã‘', 'Ñ'],
  ['Â', '']
];

for (const file of files) {
  const filePath = path.join(dir, file);
  let code = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  for (const [bad, good] of mojibakeFixes) {
    if (code.includes(bad)) {
      code = code.replaceAll(bad, good);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log(`Sanitized mojibake in ${file}`);
  }
}
console.log('Sanitization pass completed.');
