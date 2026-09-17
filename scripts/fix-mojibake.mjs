import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/modules/clientPortal/components/ClientDashboardTab.tsx');
let code = fs.readFileSync(file, 'utf-8');

// Replacement table for common mojibake sequences
const mojibakeFixes = [
  ['ðŸ‡µðŸ‡¾', '🇵🇾'],
  ['Â·', '·'],
  ['â³', '⏳'],
  ['Â¡', '¡'],
  ['ðŸ’°', '💰'],
  ['ðŸ’µ', '💵'],
  ['ðŸ’¥', '📄'],
  ['ðŸ’¼', '🏢'],
  ['ðŸ’¡', '💡'],
  ['ðŸ‘¥', '👥'],
  ['ðŸ—‚ï¸', '🗂️'],
  ['ðŸ¥', '🏥'],
  ['ðŸ’¬', '💬'],
  ['ðŸ“Š', '📊'],
  ['ðŸ”§', '🔧'],
  ['ðŸ“‹', '📋'],
  ['ðŸ‘¨â€ðŸ’¼', '👨‍💼'],
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

for (const [bad, good] of mojibakeFixes) {
  code = code.replaceAll(bad, good);
}

fs.writeFileSync(file, code, 'utf-8');
console.log('ClientDashboardTab.tsx sanitized for UTF-8.');
