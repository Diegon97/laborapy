import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/modules/clientPortal/components/AttendanceAndPayrollTab.tsx');
let code = fs.readFileSync(file, 'utf-8');

// Color mapping table for Linear Design System
const replacements = [
  // Backgrounds & Containers
  [/#0f172a/g, '#0f1011'],
  [/#1e293b/g, '#141516'],
  [/#090d16/g, '#010102'],
  // Borders
  [/#334155/g, '#23252a'],
  [/#475569/g, '#2e3038'],
  // Text
  [/#f8fafc/g, '#f7f8f8'],
  [/#e2e8f0/g, '#f7f8f8'],
  [/#cbd5e1/g, '#d0d6e0'],
  [/#94a3b8/g, '#8a8f98'],
  [/#64748b/g, '#62666d'],
  // Primary accent (replacing sky-blue with Linear indigo/lavender #5e6ad2)
  [/#0284c7/g, '#5e6ad2'],
  [/#38bdf8/g, '#707ee6'],
  [/#0284C7/g, '#5e6ad2'],
  // Status banner backgrounds to subtle dark translucent Linear style
  [/'#064e3b'/g, "'rgba(16, 185, 129, 0.12)'"],
  [/'#1e3a8a'/g, "'rgba(94, 106, 210, 0.12)'"],
  [/'#7f1d1d'/g, "'rgba(239, 68, 68, 0.12)'"],
  [/'#059669'/g, "'rgba(16, 185, 129, 0.3)'"],
  [/'#3b82f6'/g, "'rgba(94, 106, 210, 0.3)'"],
  [/'#dc2626'/g, "'rgba(239, 68, 68, 0.3)'"],
  // Purple gradient
  [/linear-gradient\(135deg, #4c1d95 0%, #1e1b4b 100%\)/g, '#141516'],
  [/#7c3aed/g, '#5e6ad2'],
  [/#f5d0fe/g, '#f7f8f8'],
  [/#e9d5ff/g, '#d0d6e0'],
];

for (const [pattern, replacement] of replacements) {
  code = code.replace(pattern, replacement);
}

fs.writeFileSync(file, code, 'utf-8');
console.log('AttendanceAndPayrollTab.tsx refactored to Linear Dark tokens successfully.');
