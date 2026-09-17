import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'src/modules/clientPortal/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== 'AttendanceAndPayrollTab.tsx' && f !== 'ClientDashboardTab.tsx' && f !== 'ClientERPModal.tsx');

console.log(`Refactoring ${files.length} clientPortal components to Linear Dark...`);

for (const file of files) {
  const filePath = path.join(dir, file);
  let code = fs.readFileSync(filePath, 'utf-8');

  // Backgrounds: convert white/light cards to Linear surfaces
  code = code.replace(/background:\s*['"]#(?:fff|ffffff)['"]/gi, "background: '#0f1011'");
  code = code.replace(/background:\s*['"]#(?:f8fafc|f1f5f9)['"]/gi, "background: '#141516'");
  code = code.replace(/background:\s*['"]#(?:0f172a)['"]/gi, "background: '#0f1011'");
  code = code.replace(/background:\s*['"]#(?:1e293b)['"]/gi, "background: '#141516'");
  code = code.replace(/background:\s*['"]#(?:090d16)['"]/gi, "background: '#010102'");
  code = code.replace(/backgroundColor:\s*['"]#(?:fff|ffffff)['"]/gi, "backgroundColor: '#0f1011'");
  code = code.replace(/backgroundColor:\s*['"]#(?:f8fafc|f1f5f9)['"]/gi, "backgroundColor: '#141516'");

  // Borders: convert light/slate borders to hairline #23252a
  code = code.replace(/border(?:Bottom|Top|Left|Right)?:\s*['"]1px solid #(?:e2e8f0|cbd5e1|e5e7eb|d1d5db|334155|475569)['"]/gi, (match) => {
    return match.replace(/#(?:e2e8f0|cbd5e1|e5e7eb|d1d5db|334155|475569)/gi, '#23252a');
  });
  code = code.replace(/border:\s*['"]1px solid #(?:e2e8f0|cbd5e1|e5e7eb|d1d5db|334155|475569)['"]/gi, "border: '1px solid #23252a'");

  // Text colors: dark text on white becomes light text on dark
  code = code.replace(/color:\s*['"]#(?:0f172a|1e293b|111827|1f2937|000000|000)['"]/gi, "color: '#f7f8f8'");
  code = code.replace(/color:\s*['"]#(?:334155|475569|4b5563|64748b|6b7280)['"]/gi, "color: '#8a8f98'");
  code = code.replace(/color:\s*['"]#(?:f8fafc|e2e8f0|f1f5f9)['"]/gi, "color: '#f7f8f8'");
  code = code.replace(/color:\s*['"]#(?:94a3b8|9ca3af)['"]/gi, "color: '#8a8f98'");
  code = code.replace(/color:\s*['"]#(?:cbd5e1|d1d5db)['"]/gi, "color: '#d0d6e0'");

  // Accents: replace legacy sky-blue and primary blues with #5e6ad2
  code = code.replace(/background:\s*['"]#(?:0284c7|2563eb|3b82f6|1d4ed8)['"]/gi, "background: '#5e6ad2'");
  code = code.replace(/color:\s*['"]#(?:0284c7|38bdf8|2563eb|3b82f6|1d4ed8)['"]/gi, "color: '#5e6ad2'");
  code = code.replace(/border:\s*['"]1px solid #(?:0284c7|2563eb|3b82f6)['"]/gi, "border: '1px solid #5e6ad2'");

  // Subtle badges/pills
  code = code.replace(/background:\s*['"]#(?:e0f2fe|dbeafe)['"]/gi, "background: 'rgba(94, 106, 210, 0.12)'");
  code = code.replace(/background:\s*['"]#(?:dcfce7|ecfdf5)['"]/gi, "background: 'rgba(16, 185, 129, 0.12)'");
  code = code.replace(/background:\s*['"]#(?:fee2e2|fef2f2)['"]/gi, "background: 'rgba(239, 68, 68, 0.12)'");
  code = code.replace(/background:\s*['"]#(?:fef3c7|fffbeb)['"]/gi, "background: 'rgba(245, 158, 11, 0.12)'");

  fs.writeFileSync(filePath, code, 'utf-8');
  console.log(`  ✓ ${file}`);
}

console.log('All clientPortal tabs refactored successfully.');
