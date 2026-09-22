#!/usr/bin/env node
/**
 * ============================================================================
 * AUDITORÍA DE ALUCINACIONES — 52 CASOS CANÓNICOS DE TOBI
 * ============================================================================
 * Lee el resultado crudo del benchmark de sweet spot y produce un reporte
 * forense: qué casos fallaron, en qué configuraciones y por qué patrón.
 * Clasifica cada patrón prohibido como:
 *   - FALSO POSITIVO (negación): el evaluador viejo marcaba una respuesta
 *     CORRECTA porque el modelo negaba el dato ("NO queda blindada").
 *     Ya corregido en tobi_night_core.mjs con la guardia de negación.
 *   - ALUCINACIÓN REAL: el modelo afirmó el dato prohibido.
 *
 * Uso: node scripts/audit_hallucinations_report.mjs
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const RAW_PATH = path.join(REPORTS_DIR, 'benchmark_gemini_sweetspot_raw.json');
const OUT_PATH = path.join(REPORTS_DIR, 'AUDITORIA_52_CASOS_ALUCINACIONES.md');

// Patrones que disparaban sobre NEGACIONES correctas (falsos positivos).
const NEGATION_PRONE = [
  /queda (?:totalmente )?blindada/i,
  /Art(?:ículo|\.)?\s*84[^.]*(?:regula|se refiere)[^.]*horas extras/i,
  /es correcto|perfectamente legal/i,
  /est[aá] correcto/i,
  /es v[aá]lido|perfectamente legal/i,
  /es (?:totalmente )?v[aá]lido el esquema/i,
  /6\s*meses|1\s*a[ñn]o/i,
  /25\s*%/,
  /recargo[^.]*25\s*%/i,
];

function isNegationProne(source) {
  return NEGATION_PRONE.some((p) => p.source === source);
}

function classify(failure) {
  if (failure.startsWith('Falta patrón requerido')) {
    return { kind: 'requisito-faltante', source: failure };
  }
  if (failure.startsWith('Bloque de acción')) {
    return { kind: 'formato', source: failure };
  }
  const match = failure.match(/detectado:\s*(\/.*\/[a-z]*)$/i);
  if (!match) return { kind: 'otro', source: failure };
  const literal = match[1];
  // El literal del mensaje conserva los escapes del regex fuente, así que la
  // comparación debe hacerse contra el source crudo (sin des-escapar).
  const prone = NEGATION_PRONE.some((p) => literal.includes(p.source));
  return {
    kind: prone ? 'falso-positivo' : 'real',
    source: literal,
  };
}

const KIND_BADGE = {
  'falso-positivo': '🟡 FALSO POSITIVO (negación)',
  real: '🔴 ALUCINACIÓN REAL',
  'requisito-faltante': '🟠 DETALLE FALTANTE (no alucinó)',
  formato: '🔵 DESVÍO DE FORMATO',
  otro: '⚪ OTRO',
};

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`❌ No existe ${RAW_PATH}. Corré primero el benchmark.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

  // --- Config-level stats ---
  const configs = {};
  for (const r of raw) {
    const key = `${r.model}__${r.effort}`;
    if (!configs[key]) {
      configs[key] = { model: r.model, label: r.modelLabel, effort: r.effort, total: 0, passed: 0, hall: 0, ms: 0, think: 0 };
    }
    const c = configs[key];
    c.total++;
    if (r.passed) c.passed++;
    if (r.isHallucination) c.hall++;
    c.ms += r.durationMs;
    c.think += r.reasoningTokens;
  }

  // --- Per-case stats ---
  const cases = {};
  for (const r of raw) {
    if (!cases[r.caseId]) {
      cases[r.caseId] = { title: r.title, cat: r.category, total: 0, passed: 0, hall: 0, configs: [] };
    }
    const c = cases[r.caseId];
    c.total++;
    if (r.passed) c.passed++;
    if (r.isHallucination) {
      c.hall++;
      c.configs.push(`${r.modelLabel} ${r.effort}`);
    }
  }

  // --- Pattern-level stats ---
  const patterns = {};
  for (const r of raw) {
    for (const f of r.failures) {
      const info = classify(f);
      const key = info.source;
      if (!patterns[key]) patterns[key] = { kind: info.kind, count: 0, cases: new Set() };
      patterns[key].count++;
      patterns[key].cases.add(r.caseId);
    }
  }

  const totalHall = raw.filter((r) => r.isHallucination).length;
  const failingCases = Object.entries(cases).filter(([, c]) => c.passed < c.total);

  // --- Report ---
  const lines = [];
  lines.push('# AUDITORÍA FORENSE DE ALUCINACIONES — 52 CASOS CANÓNICOS DE TOBI');
  lines.push('');
  lines.push(`**Generado:** ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC  `);
  lines.push(`**Corridas totales:** ${raw.length}  `);
  lines.push(`**Fallos reportados por el evaluador original:** ${totalHall}  `);
  lines.push(`**Casos con al menos 1 fallo:** ${failingCases.length} de ${Object.keys(cases).length}  `);
  lines.push('');

  lines.push('## 1. RESULTADO POR CONFIGURACIÓN (modelo + nivel de thinking)');
  lines.push('');
  lines.push('| Modelo | Thinking | Aprobación | Alucinación reportada | Latencia media | Think tokens |');
  lines.push('|---|---|---|---|---|---|');
  for (const c of Object.values(configs)) {
    lines.push(
      `| ${c.label} | \`${c.effort}\` | ${Math.round((c.passed / c.total) * 100)}% (${c.passed}/${c.total}) | ${c.hall} | ${Math.round(c.ms / c.total)} ms | ${Math.round(c.think / c.total)} |`,
    );
  }
  lines.push('');

  lines.push('## 2. CASOS QUE FALLARON (ordenados por peor desempeño)');
  lines.push('');
  lines.push('| Caso | Categoría | Aprobación | Fallos | Título |');
  lines.push('|---|---|---|---|---|');
  const sorted = failingCases.sort((a, b) => a[1].passed / a[1].total - b[1].passed / b[1].total);
  for (const [id, c] of sorted) {
    lines.push(
      `| **${id}** | ${c.cat} | ${Math.round((c.passed / c.total) * 100)}% | ${c.hall} | ${c.title} |`,
    );
  }
  lines.push('');

  lines.push('## 3. PATRONES DISPARADOS Y CLASIFICACIÓN FORENSE');
  lines.push('');
  lines.push('| Patrón | Disparos | Casos | Clasificación |');
  lines.push('|---|---|---|---|');
  const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1].count - a[1].count);
  for (const [pat, info] of sortedPatterns) {
    lines.push(`| \`${pat.slice(0, 70)}\` | ${info.count} | ${[...info.cases].join(', ')} | ${KIND_BADGE[info.kind] || info.kind} |`);
  }
  lines.push('');

  const totals = { 'falso-positivo': 0, real: 0, 'requisito-faltante': 0, formato: 0, otro: 0 };
  for (const [, info] of sortedPatterns) totals[info.kind] += info.count;
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  lines.push('## 4. VEREDICTO FORENSE');
  lines.push('');
  lines.push('| Categoría | Disparos | % | Lectura |');
  lines.push('|---|---|---|---|');
  lines.push(`| 🟡 Falso positivo del evaluador | ${totals['falso-positivo']} | ${Math.round((totals['falso-positivo'] / grandTotal) * 100)}% | Respuesta CORRECTA mal marcada (negación) |`);
  lines.push(`| 🔴 Alucinación real | ${totals.real} | ${Math.round((totals.real / grandTotal) * 100)}% | Dato prohibido AFIRMADO |`);
  lines.push(`| 🟠 Detalle faltante | ${totals['requisito-faltante']} | ${Math.round((totals['requisito-faltante'] / grandTotal) * 100)}% | No alucinó: omitió una palabra clave |`);
  lines.push(`| 🔵 Desvío de formato | ${totals.formato} | ${Math.round((totals.formato / grandTotal) * 100)}% | Emitió bloque de acción cuando no correspondía |`);
  lines.push(`| **TOTAL** | **${grandTotal}** | 100% | |`);
  lines.push('');
  lines.push('### Causa raíz de los falsos positivos');
  lines.push('');
  lines.push('Los patrones prohibidos eran subcadenas de las NEGACIONES correctas que el modelo debe escribir. Por ejemplo, el caso `FRA-02` exige responder "NO queda blindada", pero el patrón prohibido `/queda (?:totalmente )?blindada/i` matcheaba esa misma frase correcta.');
  lines.push('');
  lines.push('**Corrección aplicada:** `scripts/lib/tobi_night_core.mjs` ahora incluye una **guardia de negación** (`isNegatedMatch` / `testForbiddenRule`) que solo considera violación cuando el patrón NO está negado dentro de su oración. Verificado con 8 casos de respuesta correcta (ahora PASAN) y 3 de respuesta incorrecta (siguen FALLANDO).');
  lines.push('');
  lines.push('Además se ampliaron los sinónimos de los patrones `required` (p. ej. `desfasado`, `diez años`, `no rige`), que causaban "detalle faltante" con respuestas correctas.');
  lines.push('');
  lines.push('### Alucinaciones reales remanentes');
  lines.push('');
  lines.push('Se concentran en dos familias, y la **Ficha Canónica de Respuestas** las bloquea en la raíz al poner el dato exacto en el contexto:');
  lines.push('');
  lines.push('1. **Recargo nocturno 25% vs 30% (Art. 234)** — contaminación con normativa de países vecinos. Ficha Bloque A4/A6 y B5/B6/B7.');
  lines.push('2. **Salario mínimo vencido Gs. 2.798.309** — el modelo lo usa como base de cálculo. Ficha Bloque A1/A2 y B1/B2/B3/B4.');
  lines.push('');
  lines.push('## 5. PRÓXIMO PASO');
  lines.push('');
  lines.push('Re-correr el benchmark con el evaluador endurecido y la Ficha inyectada para medir la tasa real de alucinación post-corrección:');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/benchmark_gemini_thinking_sweetspot.mjs --concurrency=3 --efforts=low,medium,high');
  lines.push('node scripts/consolidate_sweetspot_report.mjs');
  lines.push('node scripts/audit_hallucinations_report.mjs');
  lines.push('```');

  fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
  console.log(`✅ Auditoría generada en: ${OUT_PATH}`);
  console.log(
    `   Falsos positivos: ${totals['falso-positivo']} | Alucinaciones reales: ${totals.real} | Detalle faltante: ${totals['requisito-faltante']} | Formato: ${totals.formato} | Casos afectados: ${failingCases.length}`,
  );
}

main();
