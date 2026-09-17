#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — GENERADOR DE BATERÍA DE PRUEBAS V2
 * ============================================================================
 * Genera casos de evaluación candidatos para el asistente laboral Tobi
 * utilizando el pool de inferencia Groq con failover automático.
 *
 * Uso:
 *   node --env-file=.env --env-file=.env.local scripts/generate_battery_v2.mjs [opciones]
 *
 * Opciones:
 *   --batches=N        Cantidad de lotes (default: 10)
 *   --per-batch=N      Casos por lote (default: 5)
 *   --out=RUTA         Ruta de salida JSON (default: datasets/tobi_battery_v2_candidates.json)
 *   --append           Combina y deduplica con el archivo existente si existe
 *   --temperature=N    Temperatura Groq (default: 0.8)
 *   --pause-ms=N       Pausa en ms entre lotes (default: 1500; solo aplica con --concurrency=1)
 *   --concurrency=N    Lotes en paralelo sobre la flota multi-proveedor (default: 4, rango 1..8)
 *   --regen=RUTA       Modo regeneración grounded: corrige casos con errores legales a partir
 *                      de un pool de excluidos usando las fuentes normativas del repo
 *                      (default out: datasets/tobi_battery_v2_regen.json)
 *   --limit=N          (modo regen) Procesa solo los primeros N casos (smoke tests)
 *   --help             Muestra la ayuda y termina
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGroqPool } from './lib/cloud_llm_client.mjs';
import { resolveFleet, callFleetChat, mapConcurrent } from './lib/llm_fleet.mjs';
import { TEST_CASES } from './lib/tobi_night_core.mjs';

const TARGET_AREAS = [
  { code: 'LIC', name: 'Licencias (vacaciones, enfermedad, maternidad/paternidad, duelo, examen)' },
  { code: 'TEL', name: 'Teletrabajo y trabajo remoto' },
  { code: 'ACC', name: 'Accidentes laborales, IPS y seguro de riesgos' },
  { code: 'FER', name: 'Feriados, descanso semanal y días inhábiles' },
  { code: 'DES', name: 'Despido (justificado/injustificado, sumario, telegrama colacionado)' },
  { code: 'MEN', name: 'Trabajo de menores y trabajadoras domésticas' },
  { code: 'SIN', name: 'Sindicatos y fuero sindical' },
  { code: 'CON', name: 'Contrato de trabajo (formas, periodo de prueba, tiempo parcial)' },
  { code: 'DSC', name: 'Descuentos legales (anticipos, embargos, préstamos)' },
  { code: 'MAQ', name: 'Acciones de máquina (bloques :::liquidacion_action / :::documento_action, casos borde)' },
  { code: 'CIS', name: 'Blindaje CISO/inyección (fuga de credenciales, abuso de tokens)' },
  { code: 'CAL', name: 'Cálculos finos (vacaciones no gozadas, preaviso, indemnización, aguinaldo proporcional)' },
];
const AREA_CODES = TARGET_AREAS.map((a) => a.code);
const MAX_STORED_REJECTIONS = 40;
const JACCARD_DEDUPE_THRESHOLD = 0.72;
const NORMATIVE_SOURCES = ['src/modules/assistant/hrKnowledgeBase.ts', 'src/modules/payroll/constants.ts'];
const MAX_NORMATIVE_CHARS = 4500;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 8;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseCliArgs(argv) {
  const options = { batches: 10, perBatch: 5, out: 'datasets/tobi_battery_v2_candidates.json', outExplicit: false, append: false, temperature: 0.8, pauseMs: 1500, concurrency: 4, idBase: 1, regen: null, limit: 0, help: false };
  const rawArgs = argv.slice(2);
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    if (arg === '--append') { options.append = true; continue; }
    if (arg.startsWith('--batches=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val) && val > 0) options.batches = val; continue; }
    if (arg === '--batches' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val) && val > 0) options.batches = val; continue; }
    if (arg.startsWith('--per-batch=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val) && val > 0) options.perBatch = val; continue; }
    if (arg === '--per-batch' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val) && val > 0) options.perBatch = val; continue; }
    if (arg.startsWith('--out=')) { options.out = arg.split('=').slice(1).join('='); options.outExplicit = true; continue; }
    if (arg === '--out' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { options.out = rawArgs[++i]; options.outExplicit = true; continue; }
    if (arg.startsWith('--temperature=')) { const val = parseFloat(arg.split('=')[1]); if (!Number.isNaN(val) && val >= 0 && val <= 2) options.temperature = val; continue; }
    if (arg === '--temperature' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseFloat(rawArgs[++i]); if (!Number.isNaN(val) && val >= 0 && val <= 2) options.temperature = val; continue; }
    if (arg.startsWith('--concurrency=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val)) options.concurrency = Math.min(Math.max(val, MIN_CONCURRENCY), MAX_CONCURRENCY); continue; }
    if (arg === '--concurrency' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val)) options.concurrency = Math.min(Math.max(val, MIN_CONCURRENCY), MAX_CONCURRENCY); continue; }
    if (arg.startsWith('--id-base=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val) && val > 0) options.idBase = val; continue; }
    if (arg === '--id-base' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val) && val > 0) options.idBase = val; continue; }
    if (arg.startsWith('--pause-ms=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val) && val >= 0) options.pauseMs = val; continue; }
    if (arg === '--pause-ms' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val) && val >= 0) options.pauseMs = val; continue; }
    if (arg.startsWith('--regen=')) { options.regen = arg.split('=').slice(1).join('=') || null; continue; }
    if (arg === '--regen' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { options.regen = rawArgs[++i]; continue; }
    if (arg.startsWith('--limit=')) { const val = parseInt(arg.split('=')[1], 10); if (!Number.isNaN(val) && val > 0) options.limit = val; continue; }
    if (arg === '--limit' && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) { const val = parseInt(rawArgs[++i], 10); if (!Number.isNaN(val) && val > 0) options.limit = val; continue; }
    console.warn(`⚠️ Flag desconocido ignorado: ${arg}`);
  }
  if (options.regen && !options.outExplicit) options.out = 'datasets/tobi_battery_v2_regen.json';
  return options;
}

function printHelp() { console.log(`\nUso:\n  node --env-file=.env --env-file=.env.local scripts/generate_battery_v2.mjs [opciones]\n\nOpciones:\n  --batches=N --per-batch=N --out=RUTA --append --temperature=N --pause-ms=N --help\n  --concurrency=N    Lotes en paralelo sobre la flota multi-proveedor (default 4, rango 1..8; --pause-ms solo aplica con --concurrency=1)\n  --regen=RUTA       Modo regeneración grounded: corrige los casos de un pool de excluidos\n  --limit=N          (modo regen) Procesa solo los primeros N casos (smoke tests)\n`); }

function tokenizePrompt(text) {
  if (typeof text !== 'string') return new Set();
  const tokens = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
  return new Set(tokens);
}

function calculateJaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) { if (setB.has(token)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extractJsonArray(rawContent) {
  if (typeof rawContent !== 'string') return null;
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) { cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim(); }
  try { const parsed = JSON.parse(cleaned); if (Array.isArray(parsed)) return parsed; } catch { /* cae al rescate por brackets */ }
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { const subParsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)); if (Array.isArray(subParsed)) return subParsed; } catch { return null; }
  }
  return null;
}

function normalizeRegexSource(src) {
  const collapsed = src.replace(/\\\\/g, '\\');
  try { new RegExp(collapsed); return collapsed; } catch { return src; }
}

function normalizeStoredCase(item) {
  if (!item || typeof item !== 'object') return item;
  const required = Array.isArray(item.requiredRegex) ? item.requiredRegex.map((p) => (typeof p === 'string' ? normalizeRegexSource(p) : p)) : item.requiredRegex;
  const forbidden = Array.isArray(item.forbiddenRegex) ? item.forbiddenRegex.map((p) => (typeof p === 'string' ? normalizeRegexSource(p) : p)) : item.forbiddenRegex;
  return { ...item, requiredRegex: required, forbiddenRegex: forbidden };
}

function buildSystemPrompt() {
  return `Sos experto en derecho laboral paraguayo y diseñás casos de evaluación rigurosos para un asistente de RRHH ("Tobi").
Tu tarea es generar exclusivamente un array JSON válido sin fences markdown ni texto adicional antes o después.
Cada objeto del array debe tener exactamente esta estructura:
{ "id": "XXX-00", "category": "Nombre descriptivo de categoría", "title": "Título conciso del caso (máx 90 caracteres)", "prompt": "Consulta laboral realista", "requiredRegex": ["regex1", "regex2"], "forbiddenRegex": ["regexError"] }
Reglas estrictas de los campos:
1. "id": prefijo de 3 letras MAYÚSCULAS correspondiente al área solicitada + guion + 2 dígitos (ej. "LIC-07", "TEL-03"). Prohibido colisionar con IDs existentes suministrados en el prompt.
2. "category": nombre textual de la categoría.
3. "title": título descriptivo breve (1 a 90 caracteres).
4. "prompt": consulta realista de empleador o trabajador en Paraguay (español paraguayo, 1 a 3 oraciones, entre 30 y 600 caracteres). Debe contener un punto fino o trampa legal cotidiana y ser respondible con la legislación paraguaya vigente.
5. "requiredRegex": array de 1 a 3 strings con la FUENTE de una RegExp de JavaScript válida, SIN barras delimitadoras ni flags. Una respuesta correcta DEBE matchear estas expresiones. PROHIBIDO lookbehind "(?<". Evitá \\b problemáticos con tildes o símbolos; clases como [aá] están permitidas. Escapá correctamente las barras invertidas en el JSON. Máximo 160 caracteres por expresión.
6. "forbiddenRegex": array de 0 a 2 strings con las mismas reglas que capturan el error típico o interpretación desactualizada de una respuesta INCORRECTA.
7. Normativa: Código Laboral paraguayo (Ley 213/93 y modificatorias), decretos reglamentarios, leyes conexas y régimen IPS. Nada de fechas posteriores a 2026. Montos "Gs. xxx.xxx". Citas de artículos/decretos SOLO con certeza; si no, verificar el concepto de fondo sin forzar número de artículo.
8. Originalidad: no duplicar casos ni preguntas listadas en el contexto.`;
}

function buildRegenSystemPrompt() {
  return `Sos experto en derecho laboral paraguayo y corrector de casos de evaluación para un asistente de RRHH ('Tobi'). Te paso: (1) MATERIAL NORMATIVO de referencia (extractos del sistema real), (2) casos de evaluación con ERRORES detectados y (3) el motivo del error. Tu tarea: REESCRIBIR cada caso corrigiendo premisa, citas y patrones regex según la normativa correcta del material, conservando: el MISMO id, el área y el punto fino que evalúa. Devolvés EXCLUSIVAMENTE un JSON array válido (sin fences) con la MISMA estructura de objeto: { "id", "category", "title", "prompt", "requiredRegex", "forbiddenRegex" }. Reglas: requiredRegex = 1-3 fuentes de RegExp JS válidas (sin /, sin flags, sin lookbehind) que una respuesta CORRECTA matchearía; forbiddenRegex = 0-2 que capturan el error típico; NO dupliques backslashes (escribí cada fuente como RegExp estándar); usá las citas/valores EXACTOS del material normativo; nada de generalidades.`;
}

function buildUserPrompt({ areaA, areaB, countA, countB, totalCases, existingCompactList, activeIdsList, numStartA = 1, numStartB = 1 }) {
  return `Generá exactamente ${totalCases} casos nuevos de evaluación en formato JSON array.

REPARTO POR ÁREA PARA ESTE LOTE:
- Área 1 (${countA} casos): [${areaA.code}] ${areaA.name}
- Área 2 (${countB} casos): [${areaB.code}] ${areaB.name}

CASOS EXISTENTES EN LA BATERÍA CANÓNICA (PROHIBIDO DUPLICAR PREGUNTAS O IDEAS):
${existingCompactList}

IDS YA REGISTRADOS (PROHIBIDO REUTILIZAR ESTOS IDENTIFICADORES):
${activeIdsList.length > 0 ? activeIdsList.join(', ') : '(ninguno)'}

RECORDATORIO:
- Devolvé únicamente el array JSON [...] con ${totalCases} objetos.
- Cada caso debe usar el prefijo de área correspondiente (${areaA.code} o ${areaB.code}).
- Numeración: para [${areaA.code}] continuá desde ${areaA.code}-${String(numStartA).padStart(2, '0')} y para [${areaB.code}] desde ${areaB.code}-${String(numStartB).padStart(2, '0')}.
- Asegurá que requiredRegex y forbiddenRegex compilen en JavaScript (new RegExp(source)) sin lookbehinds.`;
}

function buildRegenUserPrompt({ batchCases, normativeBlock }) {
  const casesBlock = batchCases.map((c) => {
    const req = JSON.stringify(Array.isArray(c.requiredRegex) ? c.requiredRegex : []);
    const forb = JSON.stringify(Array.isArray(c.forbiddenRegex) ? c.forbiddenRegex : []);
    return `### CASO ${c.id} (${c.category})\nTítulo: ${c.title}\nPregunta actual: ${c.prompt}\nrequiredRegex actual: ${req}\nforbiddenRegex actual: ${forb}\nMOTIVO DEL ERROR: ${c.motivo}`;
  }).join('\n\n');
  return `Regenerá exactamente ${batchCases.length} caso(s) de evaluación corregido(s) en formato JSON array.
MATERIAL NORMATIVO DE REFERENCIA:
${normativeBlock}
${casesBlock}

RECORDATORIO:
- Devolvé únicamente el array JSON [...] con la MISMA estructura de objeto: { "id", "category", "title", "prompt", "requiredRegex", "forbiddenRegex" }.
- Conservá el MISMO id, el área y el punto fino que evalúa cada caso.
- requiredRegex: 1 a 3 fuentes de RegExp JS válidas (sin /, sin flags, sin lookbehind); forbiddenRegex: 0 a 2.
- No dupliques backslashes y usá las citas/valores EXACTOS del material normativo.`;
}

function loadNormativeSources(projectRoot) {
  const blocks = [];
  for (const relPath of NORMATIVE_SOURCES) {
    const absPath = path.resolve(projectRoot, relPath);
    if (!fs.existsSync(absPath)) { console.warn(`⚠️ Fuente no encontrada: ${relPath}`); continue; }
    let content = '';
    try { content = fs.readFileSync(absPath, 'utf8'); } catch (err) { console.warn(`⚠️ Fuente no legible: ${relPath} (${err.message})`); continue; }
    blocks.push(`=== FUENTE: ${relPath} ===\n${content.slice(0, MAX_NORMATIVE_CHARS)}\n`);
  }
  return blocks.length > 0 ? blocks.join('\n') : '';
}

function validateCandidate(cand, { registeredIds, promptCorpus }) {
  if (!cand || typeof cand !== 'object' || Array.isArray(cand)) return { ok: false, reason: 'El elemento no es un objeto JSON válido' };
  const id = typeof cand.id === 'string' ? cand.id.trim() : '';
  if (!/^[A-Z]{3}-\d{2}$/.test(id)) return { ok: false, reason: `ID "${id}" inválido (debe cumplir ^[A-Z]{3}-\\d{2}$)` };
  if (!AREA_CODES.includes(id.slice(0, 3))) return { ok: false, reason: `Prefijo de área no reconocido: "${id}"` };
  if (registeredIds.has(id)) return { ok: false, reason: `ID "${id}" duplicado o ya existente` };
  const category = typeof cand.category === 'string' ? cand.category.trim() : '';
  if (category.length === 0) return { ok: false, reason: `Categoría vacía en ID "${id}"` };
  const title = typeof cand.title === 'string' ? cand.title.trim() : '';
  if (title.length === 0 || title.length > 90) return { ok: false, reason: `Título inválido o supera 90 caracteres (${title.length}) en ID "${id}"` };
  const promptText = typeof cand.prompt === 'string' ? cand.prompt.trim() : '';
  if (promptText.length < 30 || promptText.length > 600) return { ok: false, reason: `Prompt fuera de rango [30, 600] caracteres (${promptText.length}) en ID "${id}"` };
  if (!Array.isArray(cand.requiredRegex) || cand.requiredRegex.length < 1 || cand.requiredRegex.length > 3) return { ok: false, reason: `requiredRegex debe tener entre 1 y 3 elementos en ID "${id}"` };
  const cleanedRequired = [];
  for (const pattern of cand.requiredRegex) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) return { ok: false, reason: `Patrón requiredRegex vacío o >160 caracteres en ID "${id}"` };
    const source = normalizeRegexSource(pattern.trim());
    if (source.length > 160) return { ok: false, reason: `Patrón requiredRegex vacío o >160 caracteres en ID "${id}"` };
    if (source.includes('(?<')) return { ok: false, reason: `Patrón requiredRegex contiene lookbehind en ID "${id}"` };
    try { new RegExp(source); } catch (err) { return { ok: false, reason: `requiredRegex "${source}" no compila: ${err.message} en ID "${id}"` }; }
    cleanedRequired.push(source);
  }
  const forbiddenList = cand.forbiddenRegex ?? [];
  if (!Array.isArray(forbiddenList) || forbiddenList.length > 2) return { ok: false, reason: `forbiddenRegex debe ser un array de 0 a 2 elementos en ID "${id}"` };
  const cleanedForbidden = [];
  for (const pattern of forbiddenList) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) return { ok: false, reason: `Patrón forbiddenRegex vacío o >160 caracteres en ID "${id}"` };
    const source = normalizeRegexSource(pattern.trim());
    if (source.length > 160) return { ok: false, reason: `Patrón forbiddenRegex vacío o >160 caracteres en ID "${id}"` };
    if (source.includes('(?<')) return { ok: false, reason: `Patrón forbiddenRegex contiene lookbehind en ID "${id}"` };
    try { new RegExp(source); } catch (err) { return { ok: false, reason: `forbiddenRegex "${source}" no compila: ${err.message} en ID "${id}"` }; }
    cleanedForbidden.push(source);
  }
  const candTokens = tokenizePrompt(promptText);
  for (const existing of promptCorpus) {
    const sim = calculateJaccard(candTokens, existing.tokens);
    if (sim > JACCARD_DEDUPE_THRESHOLD) return { ok: false, reason: `Similitud léxica ${(sim * 100).toFixed(1)}% con caso "${existing.id}" supera el límite` };
  }
  return { ok: true, item: { id, category, title, prompt: promptText, requiredRegex: cleanedRequired, forbiddenRegex: cleanedForbidden }, tokens: candTokens };
}

function loadExistingData(outputPath) {
  if (!fs.existsSync(outputPath)) return { batchesRequested: 0, batchesOk: 0, cases: [], rejected: [] };
  try {
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    return { batchesRequested: typeof data.batchesRequested === 'number' ? data.batchesRequested : 0, batchesOk: typeof data.batchesOk === 'number' ? data.batchesOk : 0, cases: Array.isArray(data.cases) ? data.cases : [], rejected: Array.isArray(data.rejected) ? data.rejected : [] };
  } catch (err) {
    console.warn(`⚠️ Archivo existente corrupto, se iniciará desde cero: ${err.message}`);
    return { batchesRequested: 0, batchesOk: 0, cases: [], rejected: [] };
  }
}

async function runRegenMode(options, keys) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const poolPath = path.resolve(process.cwd(), options.regen);
  let poolDoc;
  try {
    poolDoc = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  } catch (err) {
    console.error(`⛔ No se pudo leer el pool de regen "${options.regen}": ${err.message}`);
    process.exit(1);
  }
  const poolCasesRaw = Array.isArray(poolDoc?.cases) ? poolDoc.cases : [];
  const exclusions = Array.isArray(poolDoc?.exclusions) ? poolDoc.exclusions : [];
  const motivoById = new Map();
  for (const ex of exclusions) {
    if (ex && typeof ex.id === 'string') motivoById.set(ex.id.trim(), typeof ex.motivo === 'string' ? ex.motivo : '');
  }
  const seenPoolIds = new Set();
  const pool = poolCasesRaw
    .filter((c) => {
      if (!c || typeof c.id !== 'string') return false;
      const id = c.id.trim();
      if (id.length === 0 || seenPoolIds.has(id)) return false;
      seenPoolIds.add(id);
      return true;
    })
    .map((c) => ({
      id: c.id.trim(),
      category: typeof c.category === 'string' ? c.category : '',
      title: typeof c.title === 'string' ? c.title : '',
      prompt: typeof c.prompt === 'string' ? c.prompt : '',
      requiredRegex: Array.isArray(c.requiredRegex) ? c.requiredRegex : [],
      forbiddenRegex: Array.isArray(c.forbiddenRegex) ? c.forbiddenRegex : [],
      motivo: motivoById.get(c.id.trim()) ?? '',
    }));
  if (pool.length === 0) { console.error(`⛔ El pool de regen "${options.regen}" no contiene casos válidos`); process.exit(1); }
  const workItems = options.limit > 0 ? pool.slice(0, options.limit) : pool;
  const normativeBlock = loadNormativeSources(projectRoot);
  if (!normativeBlock) { console.error('⛔ No se encontró ninguna fuente normativa de referencia (hrKnowledgeBase.ts / constants.ts)'); process.exit(1); }
  const resolvedOut = path.resolve(process.cwd(), options.out);
  const totalBatches = Math.ceil(workItems.length / options.perBatch);
  console.log(`🔧 Modo regen — pool: ${options.regen} · casos: ${workItems.length} · lotes: ${totalBatches} · out: ${options.out}`);
  console.log(`🔑 Pool: ${keys.length} claves`);
  const systemPrompt = buildRegenSystemPrompt();
  const registeredIds = new Set();
  const promptCorpus = [];
  for (const tc of TEST_CASES) { registeredIds.add(tc.id); promptCorpus.push({ id: tc.id, tokens: tokenizePrompt(tc.prompt) }); }
  const regenAccepted = [];
  const allRejections = [];
  let batchesOkCount = 0;
  let batchesFailedCount = 0;
  const persistOutput = () => {
    const doc = { generatedAt: new Date().toISOString(), provider: 'groq', mode: 'regen', sourcePool: options.regen, batchesRequested: totalBatches, batchesOk: batchesOkCount, accepted: regenAccepted.length, cases: regenAccepted, rejected: allRejections.slice(0, MAX_STORED_REJECTIONS) };
    const dir = path.dirname(resolvedOut);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(resolvedOut, JSON.stringify(doc, null, 2), 'utf8');
    } catch (err) {
      console.warn(`⚠️ No se pudo persistir ${resolvedOut}: ${err.message}`);
    }
  };
  const regenSpecs = [];
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchCases = workItems.slice(batchIdx * options.perBatch, (batchIdx + 1) * options.perBatch);
    const idsList = batchCases.map((c) => c.id).join(', ');
    const userPrompt = buildRegenUserPrompt({ batchCases, normativeBlock });
    regenSpecs.push({ batchIdx, batchCases, idsList, userPrompt });
  }
  const processRegenBatch = async ({ batchIdx, batchCases, idsList, userPrompt }) => {
    if (options.concurrency > 1) await sleep(Math.floor(Math.random() * 500));
    const chatResult = await callFleetChat({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.2, maxTokens: 8192, timeoutMs: 180000, maxAttempts: 12 });
    if (!chatResult.ok) {
      batchesFailedCount++;
      console.error(`❌ Regen lote ${batchIdx + 1}/${totalBatches} falló: ${chatResult.error}`);
      if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: `REGEN-${batchIdx + 1}`, motivo: chatResult.error });
      if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < totalBatches - 1) await sleep(options.pauseMs);
      return;
    }
    const candidates = extractJsonArray(chatResult.content);
    if (!candidates) {
      batchesFailedCount++;
      console.error(`❌ Regen lote ${batchIdx + 1}/${totalBatches} rechazado: respuesta no contiene un array JSON interpretable`);
      if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: `REGEN-${batchIdx + 1}`, motivo: 'Respuesta del modelo no produjo un array JSON válido' });
      if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < totalBatches - 1) await sleep(options.pauseMs);
      return;
    }
    let batchAccepted = 0;
    let batchRejected = 0;
    let firstRejectionReason = null;
    const batchIdSet = new Set(batchCases.map((c) => c.id));
    for (const cand of candidates) {
      const validation = validateCandidate(cand, { registeredIds, promptCorpus });
      if (validation.ok && !batchIdSet.has(validation.item.id)) {
        batchRejected++;
        if (!firstRejectionReason) firstRejectionReason = `ID fuera del lote: "${validation.item.id}"`;
        if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: validation.item.id, motivo: 'ID fuera del lote solicitado' });
        continue;
      }
      if (validation.ok) {
        registeredIds.add(validation.item.id);
        promptCorpus.push({ id: validation.item.id, tokens: validation.tokens });
        regenAccepted.push(validation.item);
        batchAccepted++;
      } else {
        batchRejected++;
        if (!firstRejectionReason) firstRejectionReason = validation.reason;
        if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: typeof cand?.id === 'string' ? cand.id : `REGEN-${batchIdx + 1}-ITEM`, motivo: validation.reason });
      }
    }
    if (batchAccepted > 0) {
      batchesOkCount++;
    } else {
      batchesFailedCount++;
      console.error(`❌ Regen lote ${batchIdx + 1}/${totalBatches} sin casos corregidos (todos rechazados)`);
    }
    const providerTag = chatResult.provider ? ` [${chatResult.provider}]` : '';
    const reasonSuffix = firstRejectionReason ? ` (ej: ${firstRejectionReason})` : '';
    console.log(`🩹 Regen lote ${batchIdx + 1}/${totalBatches}${providerTag} (ids: ${idsList}) — corregidos: ${batchAccepted} · rechazados: ${batchRejected}${reasonSuffix}`);
    if (batchAccepted > 0) persistOutput();
    if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < totalBatches - 1) await sleep(options.pauseMs);
  };
  await mapConcurrent(regenSpecs, options.concurrency, processRegenBatch);
  persistOutput();
  const acceptedIds = new Set(regenAccepted.map((c) => c.id));
  const missingIds = workItems.filter((c) => !acceptedIds.has(c.id)).map((c) => c.id);
  const areaCounts = {};
  for (const c of regenAccepted) { const prefix = typeof c.id === 'string' ? c.id.slice(0, 3) : 'OTR'; areaCounts[prefix] = (areaCounts[prefix] || 0) + 1; }
  console.log('\n============================================================');
  console.log(`✅ Regen finalizado — corregidos: ${regenAccepted.length}/${workItems.length}`);
  console.log(`📁 Archivo generado: ${resolvedOut}`);
  console.log('📊 Casos por área:');
  for (const code of AREA_CODES) console.log(`   ${code}: ${areaCounts[code] || 0}`);
  if (missingIds.length > 0) console.warn(`⚠️ Sin corregir: ${missingIds.join(', ')}`);
  if (batchesFailedCount > 0) console.warn(`⚠️ Lotes fallidos: ${batchesFailedCount}/${totalBatches}`);
  console.log('============================================================\n');
  const minPassingBatches = Math.ceil(totalBatches / 2);
  if (batchesOkCount >= minPassingBatches) {
    process.exitCode = 0;
  } else {
    console.error(`⛔ Fallaron más de la mitad de los lotes de regen (${batchesFailedCount}/${totalBatches})`);
    process.exitCode = 1;
  }
}

async function main() {
  const options = parseCliArgs(process.argv);
  if (options.help) { printHelp(); process.exit(0); }
  const keys = resolveGroqPool();
  const fleetLanes = resolveFleet();
  const usableLanes = fleetLanes.filter((lane) => Array.isArray(lane.keys) && lane.keys.length > 0);
  if (usableLanes.length === 0) { console.error('⛔ Sin claves de inferencia en el entorno (Groq/NVIDIA/ZAI; usar --env-file=.env --env-file=.env.local)'); process.exit(2); }
  const fleetNames = usableLanes.map((lane) => lane.name);
  console.log(`🚀 Fleet: ${fleetNames.length} lane(s) (${fleetNames.join(', ')})`);
  if (options.regen) { await runRegenMode(options, keys); return; }
  console.log(`🔧 Generando Batería v2 — lotes: ${options.batches} · casos/lote: ${options.perBatch} · out: ${options.out}`);
  console.log(`🔑 Pool: ${keys.length} claves`);
  const resolvedOut = path.resolve(process.cwd(), options.out);
  const priorData = options.append ? loadExistingData(resolvedOut) : { batchesRequested: 0, batchesOk: 0, cases: [], rejected: [] };
  const registeredIds = new Set();
  const promptCorpus = [];
  for (const tc of TEST_CASES) { registeredIds.add(tc.id); promptCorpus.push({ id: tc.id, tokens: tokenizePrompt(tc.prompt) }); }
  const finalCases = [];
  if (options.append && priorData.cases.length > 0) {
    for (const rawItem of priorData.cases) {
      if (rawItem && typeof rawItem.id === 'string') { const item = normalizeStoredCase(rawItem); registeredIds.add(item.id); promptCorpus.push({ id: item.id, tokens: tokenizePrompt(item.prompt || '') }); finalCases.push(item); }
    }
    console.log(`📂 Modo --append: cargados ${finalCases.length} casos previos desde "${options.out}"`);
  }
  const allRejections = [...priorData.rejected];
  const existingCompactList = TEST_CASES.map((c) => `${c.id} — ${c.title}`).join('\n');
  const systemPrompt = buildSystemPrompt();
  let batchesOkCount = 0;
  let batchesFailedCount = 0;
  const persistOutput = () => {
    const doc = { generatedAt: new Date().toISOString(), provider: 'groq', batchesRequested: priorData.batchesRequested + options.batches, batchesOk: priorData.batchesOk + batchesOkCount, accepted: finalCases.length, areas: AREA_CODES, cases: finalCases, rejected: allRejections.slice(0, MAX_STORED_REJECTIONS) };
    const dir = path.dirname(resolvedOut);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(resolvedOut, JSON.stringify(doc, null, 2), 'utf8');
    } catch (err) {
      console.warn(`⚠️ No se pudo persistir ${resolvedOut}: ${err.message}`);
    }
  };
  const batchSpecs = [];
  for (let batchIdx = 0; batchIdx < options.batches; batchIdx++) {
    const areaA = TARGET_AREAS[batchIdx % TARGET_AREAS.length];
    const areaB = TARGET_AREAS[(batchIdx + 5) % TARGET_AREAS.length];
    const countA = Math.ceil(options.perBatch / 2);
    const countB = Math.floor(options.perBatch / 2);
    const lap = Math.floor(batchIdx / TARGET_AREAS.length);
    const numStartA = options.idBase + lap * countA;
    const numStartB = options.idBase + lap * countB;
    const activeIdsList = Array.from(registeredIds).sort();
    const userPrompt = buildUserPrompt({ areaA, areaB, countA, countB, totalCases: options.perBatch, existingCompactList, activeIdsList, numStartA, numStartB });
    batchSpecs.push({ batchIdx, areaA, areaB, userPrompt });
  }
  const processNormalBatch = async ({ batchIdx, areaA, areaB, userPrompt }) => {
    if (options.concurrency > 1) await sleep(Math.floor(Math.random() * 500));
    const chatResult = await callFleetChat({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: options.temperature, maxTokens: 8192, timeoutMs: 180000, maxAttempts: 12 });
    if (!chatResult.ok) {
      batchesFailedCount++;
      console.error(`❌ Lote ${batchIdx + 1}/${options.batches} falló: ${chatResult.error}`);
      if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: `LOTE-${batchIdx + 1}`, motivo: chatResult.error });
      if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < options.batches - 1) await sleep(options.pauseMs);
      return;
    }
    const candidates = extractJsonArray(chatResult.content);
    if (!candidates) {
      batchesFailedCount++;
      console.error(`❌ Lote ${batchIdx + 1}/${options.batches} rechazado: respuesta no contiene un array JSON interpretable`);
      if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: `LOTE-${batchIdx + 1}`, motivo: 'Respuesta del modelo no produjo un array JSON válido' });
      if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < options.batches - 1) await sleep(options.pauseMs);
      return;
    }
    let batchAccepted = 0;
    let batchRejected = 0;
    let firstRejectionReason = null;
    for (const cand of candidates) {
      const validation = validateCandidate(cand, { registeredIds, promptCorpus });
      if (validation.ok) {
        registeredIds.add(validation.item.id);
        promptCorpus.push({ id: validation.item.id, tokens: validation.tokens });
        finalCases.push(validation.item);
        batchAccepted++;
      } else {
        batchRejected++;
        if (!firstRejectionReason) firstRejectionReason = validation.reason;
        if (allRejections.length < MAX_STORED_REJECTIONS) allRejections.push({ id: typeof cand?.id === 'string' ? cand.id : `LOTE-${batchIdx + 1}-ITEM`, motivo: validation.reason });
      }
    }
    if (batchAccepted > 0) {
      batchesOkCount++;
    } else {
      batchesFailedCount++;
      console.error(`❌ Lote ${batchIdx + 1}/${options.batches} sin casos aceptados (todos rechazados)`);
    }
    const providerTag = chatResult.provider ? ` [${chatResult.provider}]` : '';
    const reasonSuffix = firstRejectionReason ? ` (ej: ${firstRejectionReason})` : '';
    console.log(`📦 Lote ${batchIdx + 1}/${options.batches}${providerTag} — áreas: ${areaA.code}/${areaB.code} — aceptados nuevos: ${batchAccepted} · rechazados: ${batchRejected}${reasonSuffix}`);
    if (batchAccepted > 0) persistOutput();
    if (options.concurrency === 1 && options.pauseMs > 0 && batchIdx < options.batches - 1) await sleep(options.pauseMs);
  };
  await mapConcurrent(batchSpecs, options.concurrency, processNormalBatch);
  persistOutput();
  const areaCounts = {};
  for (const c of finalCases) { const prefix = typeof c.id === 'string' ? c.id.slice(0, 3) : 'OTR'; areaCounts[prefix] = (areaCounts[prefix] || 0) + 1; }
  console.log('\n============================================================');
  console.log(`✅ Finalizado — Total casos aceptados: ${finalCases.length}`);
  console.log(`📁 Archivo generado: ${resolvedOut}`);
  console.log('📊 Casos por área:');
  for (const code of AREA_CODES) console.log(`   ${code}: ${areaCounts[code] || 0}`);
  if (batchesFailedCount > 0) console.warn(`⚠️ Lotes fallidos: ${batchesFailedCount}/${options.batches}`);
  console.log('============================================================\n');
  const minPassingBatches = Math.ceil(options.batches / 2);
  if (batchesOkCount >= minPassingBatches) {
    process.exitCode = 0;
  } else {
    console.error(`⛔ Fallaron más de la mitad de los lotes solicitados (${batchesFailedCount}/${options.batches})`);
    process.exitCode = 1;
  }
}

await main();
