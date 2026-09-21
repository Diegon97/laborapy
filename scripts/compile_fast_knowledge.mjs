import fs from 'fs';
import path from 'path';

const oikoPath = path.resolve('datasets/oiko_465_rag_ready.json');
const csjPath = path.resolve('datasets/tobi_golden_csj.json');
const outPath = path.resolve('src/modules/assistant/tobiKnowledgeCatalog.ts');

const oikoRaw = JSON.parse(fs.readFileSync(oikoPath, 'utf8'));
const csjRaw = JSON.parse(fs.readFileSync(csjPath, 'utf8'));

console.log(`Leídos: ${oikoRaw.length} Oiko, ${csjRaw.length} CSJ`);

// Seleccionamos los casos más representativos de Oiko (agrupados por artículos clave para máxima cobertura)
const keyArticles = ['Art. 19', 'Art. 81', 'Art. 84', 'Art. 87', 'Art. 91', 'Art. 94', 'Art. 218', 'Art. 240', 'Art. 243', 'Art. 352', 'Art. 382', 'Art. 399'];
const selectedOiko = [];
const seenThemes = new Set();

const TERMINOS_PROHIBIDOS = [
  'zavidoro', 'cantero', 'busto', 'azco', '5162734', '5173620', '1343704', 'merco sur', 'mercosur', 'meta lab', 'metalab'
];

function sanitizeSensitive(text) {
  if (typeof text !== 'string') return text;
  let clean = text;
  for (const term of TERMINOS_PROHIBIDOS) {
    const re = new RegExp(term, 'gi');
    clean = clean.replace(re, '[Parte Anonimizada]');
  }
  return clean;
}

// 1. Primero los que tienen corrección de Diego Núñez (máxima autoridad)
for (const item of oikoRaw) {
  if (item.correccion_diego && item.correccion_diego.length > 20) {
    if (!seenThemes.has(item.tema)) {
      seenThemes.add(item.tema);
      selectedOiko.push({
        id: item.id,
        tema: sanitizeSensitive(item.tema),
        consulta: sanitizeSensitive(item.consulta),
        articulos: item.articulos || [],
        dictamen: sanitizeSensitive(item.deepseek_eval || ''),
        criterioDiego: sanitizeSensitive(item.correccion_diego),
        abogado: item.abogado || '@laboralistas.py'
      });
    }
  }
}

// 2. Aseguramos cobertura de todos los artículos clave
for (const art of keyArticles) {
  let countForArt = 0;
  for (const item of oikoRaw) {
    if ((item.articulos || []).includes(art) && !seenThemes.has(item.tema)) {
      seenThemes.add(item.tema);
      selectedOiko.push({
        id: item.id,
        tema: sanitizeSensitive(item.tema),
        consulta: sanitizeSensitive(item.consulta),
        articulos: item.articulos || [],
        dictamen: sanitizeSensitive(item.deepseek_eval || ''),
        criterioDiego: sanitizeSensitive(item.correccion_diego || ''),
        abogado: item.abogado || '@laboralistas.py'
      });
      countForArt++;
      if (countForArt >= 6) break; // 6 casos representativos por cada artículo clave
    }
  }
}

// 3. Seleccionamos los fallos de CSJ de mayor impacto práctico
const selectedCsj = [];
const seenCsj = new Set();
const csjKeywords = ['inconstitucionalidad', 'despido', 'prescripcion', 'prueba', 'caligrafica', 'arbitrariedad', 'salario', 'indemnizacion', 'documento', 'firma'];

for (const item of csjRaw) {
  const inst = item.instruction || '';
  const out = item.output || '';
  const combined = (inst + ' ' + out).toLowerCase();
  
  for (const kw of csjKeywords) {
    if (combined.includes(kw) && !seenCsj.has(inst) && selectedCsj.length < 50) {
      seenCsj.add(inst);
      selectedCsj.push({
        materia: kw,
        pregunta: sanitizeSensitive(inst),
        doctrina: sanitizeSensitive(out)
      });
      break;
    }
  }
}

console.log(`Seleccionados: ${selectedOiko.length} casos Oiko/TikTok, ${selectedCsj.length} fallos CSJ`);

const tsContent = `/**
 * CATÁLOGO INTEGRADO DE CONOCIMIENTO LABORAL Y PERITAJES — LABORAPY
 * Compilado automáticamente desde fuentes canónicas:
 *  - 465 Consultas reales de TikTok / Redes Sociales peritadas con criterio de Diego Núñez
 *  - Fallos y doctrina constitucional de la Corte Suprema de Justicia (CSJ)
 *  - Código del Trabajo (Ley 213/93, 496/95, 5508/15, Dec-Ley 1860/50)
 *
 * Motor in-memory sin red ni latencia (<0.5ms por búsqueda).
 */

export interface FastLegalCase {
  readonly id: string;
  readonly tema: string;
  readonly consulta: string;
  readonly articulos: readonly string[];
  readonly dictamen: string;
  readonly criterioDiego: string;
  readonly abogado?: string;
}

export interface FastCsjRuling {
  readonly materia: string;
  readonly pregunta: string;
  readonly doctrina: string;
}

export const CURATED_PERITAJES_TIKTOK: readonly FastLegalCase[] = ${JSON.stringify(selectedOiko, null, 2)} as const;

export const CURATED_CSJ_RULINGS: readonly FastCsjRuling[] = ${JSON.stringify(selectedCsj, null, 2)} as const;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'para', 'por', 'con',
  'que', 'es', 'son', 'se', 'su', 'sus', 'lo', 'le', 'como', 'pero', 'este', 'esta',
  'hola', 'buenos', 'dias', 'tardes', 'favor', 'ayuda', 'mi', 'me', 'tengo', 'puedo'
]);

/**
 * Busca casos y precedentes pertinentes en memoria (<0.5ms).
 */
export function queryFastKnowledge(query: string, maxCases = 3, maxCsj = 2): {
  cases: FastLegalCase[];
  csj: FastCsjRuling[];
  formattedContext: string;
} {
  const normQuery = normalize(query);
  const tokens = normQuery.split(' ').filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  if (tokens.length === 0) {
    return { cases: [], csj: [], formattedContext: '' };
  }

  // Scoring de casos TikTok/Oiko
  const scoredCases: Array<{ item: FastLegalCase; score: number }> = [];
  for (const c of CURATED_PERITAJES_TIKTOK) {
    let score = 0;
    const target = normalize(\`\${c.tema} \${c.consulta} \${c.articulos.join(' ')} \${c.criterioDiego}\`);
    for (const t of tokens) {
      if (target.includes(t)) score += 3;
    }
    for (const art of c.articulos) {
      if (normQuery.includes(normalize(art))) score += 8;
    }
    if (score > 0) scoredCases.push({ item: c, score });
  }

  scoredCases.sort((a, b) => b.score - a.score);
  const topCases = scoredCases.slice(0, maxCases).map((s) => s.item);

  // Scoring de CSJ
  const scoredCsj: Array<{ item: FastCsjRuling; score: number }> = [];
  for (const r of CURATED_CSJ_RULINGS) {
    let score = 0;
    const target = normalize(\`\${r.materia} \${r.pregunta} \${r.doctrina}\`);
    for (const t of tokens) {
      if (target.includes(t)) score += 2;
    }
    if (score > 0) scoredCsj.push({ item: r, score });
  }

  scoredCsj.sort((a, b) => b.score - a.score);
  const topCsj = scoredCsj.slice(0, maxCsj).map((s) => s.item);

  // Formato para inyección en el prompt de Tobi
  const blocks: string[] = [];

  if (topCases.length > 0) {
    const casesText = topCases
      .map(
        (c) =>
          \`• CASO DE LA PRÁCTICA LABORAL PARAGUAYA (\${c.articulos.join(', ')}): "\${c.tema}"\\n\` +
          \`  Consulta real: "\${c.consulta}"\\n\` +
          \`  Dictamen pericial: \${c.dictamen.slice(0, 300)}...\\n\` +
          (c.criterioDiego ? \`  Criterio de Diego Núñez (LaboraPy): \${c.criterioDiego}\\n\` : '')
      )
      .join('\\n');
    blocks.push(\`[PRECEDENTES PRÁCTICOS LABORALES PARAGUAYOS (CASOS REALES AUDITADOS)]\\n\${casesText}\`);
  }

  if (topCsj.length > 0) {
    const csjText = topCsj
      .map(
        (r) =>
          \`• DOCTRINA CORTE SUPREMA DE JUSTICIA (PARAGUAY - Materia: \${r.materia.toUpperCase()}):\\n\` +
          \`  Problema: \${r.pregunta}\\n\` +
          \`  Criterio CSJ: \${r.doctrina}\`
      )
      .join('\\n\\n');
    blocks.push(\`[JURISPRUDENCIA OFICIAL CSJ PARAGUAY]\\n\${csjText}\`);
  }

  return {
    cases: topCases,
    csj: topCsj,
    formattedContext: blocks.join('\\n\\n'),
  };
}
`;

fs.writeFileSync(outPath, tsContent, 'utf8');
console.log(`Archivo generado con éxito en ${outPath}`);
