#!/usr/bin/env node
/**
 * MINERO DE REGLAS CANÓNICAS CANDIDATAS (TOBI RRHH)
 *
 * Espera activa hasta la consolidación de Fase 2 y extracción de reglas
 * canónicas, anti-patrones, normativa y datos vigentes por categoría
 * utilizando el pool de inferencia Groq.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGroqPool } from './lib/cloud_llm_client.mjs';
import { resolveFleet, callFleetChat } from './lib/llm_fleet.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DATASET_FINAL_PATH = path.join(ROOT, 'datasets', 'tobi_gold_dataset_final.json');
const DATASET_DEEP_PATH = path.join(ROOT, 'datasets', 'tobi_deep_improved.json');
const REPORT_STRESS_PATH = path.join(ROOT, 'reports', 'tobi_stress_test_report.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

const SYSTEM_PROMPT = 'Sos experto en derecho laboral paraguayo. A partir de casos verificados del asistente Tobi, extraés REGLAS CANÓNICAS accionables para su prompt de sistema. Devolvés EXCLUSIVAMENTE un JSON array válido (sin fences) con un objeto por categoría: { "categoria": string, "reglas": string[], "antiPatrones": string[], "normativa": string[], "datosVigentes": string[] }. Reglas: 2-6 por categoría, accionables y verificables; antiPatrones: errores típicos a evitar (1-4); normativa: artículos/leyes/decretos mencionados con seguridad (0-5); datosVigentes: montos/plazos sensibles con su valor (0-4). Español paraguayo. Nada de generalidades vacías.';

function sleep(ms) {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultWaitUntil() {
  const d = new Date();
  d.setHours(12, 31, 0, 0);
  return d;
}

function getDefaultMaxWait() {
  const d = new Date();
  d.setHours(13, 5, 0, 0);
  return d;
}

function parseDateFlag(val, defaultFn) {
  if (!val) return defaultFn();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
    const parts = val.split(':').map(Number);
    const d = new Date();
    d.setHours(parts[0], parts[1], parts[2] || 0, 0);
    return d;
  }
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`⚠️ Fecha/hora inválida: "${val}". Se usará el valor por defecto.`);
    return defaultFn();
  }
  return parsed;
}

function printHelp() {
  console.log(`
Uso: node scripts/mine_canonical_rules.mjs [opciones]

Opciones:
  --wait-until=ISO       Hora o timestamp ISO para inicio (default: HOY 12:31 local)
  --max-wait=ISO         Tope de espera del archivo de dataset (default: HOY 13:05 local)
  --pause-ms=N           Pausa en ms entre llamadas al pool Groq (default: 1500)
  --out-name=NOMBRE      Nombre base para los reportes JSON y MD (default: TOBI_CANONICAL_RULES_V1)
  --help                 Muestra esta ayuda y sale con código 0
`);
}

function parseCliArgs(args) {
  const opts = {
    waitUntilRaw: null,
    maxWaitRaw: null,
    pauseMs: 1500,
    outName: 'TOBI_CANONICAL_RULES_V1',
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg.startsWith('--wait-until=')) {
      opts.waitUntilRaw = arg.slice('--wait-until='.length);
      continue;
    }
    if (arg.startsWith('--max-wait=')) {
      opts.maxWaitRaw = arg.slice('--max-wait='.length);
      continue;
    }
    if (arg.startsWith('--pause-ms=')) {
      const n = Number(arg.slice('--pause-ms='.length));
      if (!Number.isNaN(n) && n >= 0) opts.pauseMs = n;
      continue;
    }
    if (arg.startsWith('--out-name=')) {
      const s = arg.slice('--out-name='.length).trim();
      if (s) opts.outName = s;
      continue;
    }
    console.warn(`⚠️ Flag desconocido: ${arg}`);
  }

  return opts;
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`⚠️ Advertencia al leer ${filePath}: ${err.message}`);
    return null;
  }
}

function getFileMtimeMs(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function cleanAndExtractResponse(entry, deepItem, stressItem) {
  const rawAnswer = (
    deepItem?.improved_response ||
    entry?.response ||
    entry?.improved_response ||
    entry?.study?.improved_response ||
    entry?.retest?.response ||
    deepItem?.retest?.response ||
    entry?.finalAnswer ||
    entry?.improvedAnswer ||
    entry?.answer ||
    stressItem?.response ||
    entry?.title ||
    deepItem?.title ||
    ''
  );

  let text = typeof rawAnswer === 'string' ? rawAnswer.trim() : String(rawAnswer || '').trim();
  if (!text) {
    text = String(entry?.title || deepItem?.title || 'Caso sin respuesta textual disponible');
  }

  if (text.length > 700) {
    return text.slice(0, 697) + '...';
  }
  return text;
}

function parseModelResponse(rawContent) {
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('Respuesta del modelo vacía o no textual');
  }

  let clean = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.slice(start, end + 1);
  }

  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed)) {
    throw new Error('El payload devuelto por el modelo no es un array JSON');
  }

  return parsed.map((item) => ({
    categoria: typeof item.categoria === 'string' ? item.categoria.trim() : (item.category || 'General'),
    reglas: Array.isArray(item.reglas) ? item.reglas.map(String).map((s) => s.trim()).filter(Boolean) : [],
    antiPatrones: Array.isArray(item.antiPatrones)
      ? item.antiPatrones.map(String).map((s) => s.trim()).filter(Boolean)
      : (Array.isArray(item.antipatrones) ? item.antipatrones.map(String).map((s) => s.trim()).filter(Boolean) : []),
    normativa: Array.isArray(item.normativa) ? item.normativa.map(String).map((s) => s.trim()).filter(Boolean) : [],
    datosVigentes: Array.isArray(item.datosVigentes)
      ? item.datosVigentes.map(String).map((s) => s.trim()).filter(Boolean)
      : (Array.isArray(item.datos_vigentes) ? item.datos_vigentes.map(String).map((s) => s.trim()).filter(Boolean) : []),
  }));
}

function buildUserPromptForGroup(groupCategories, categoriesMap) {
  let buffer = 'A continuación se detallan los casos de referencia verificados del asistente Tobi para las siguientes categorías:\n\n';

  for (const cat of groupCategories) {
    buffer += `## CATEGORÍA: ${cat}\n`;
    const cases = categoriesMap.get(cat) || [];
    for (const c of cases) {
      buffer += `- Caso [${c.id}] ${c.title ? `(${c.title})` : ''}\n`;
      buffer += `  Pregunta de usuario: ${c.prompt}\n`;
      buffer += `  Respuesta de referencia (extracto verificado): ${c.extract}\n\n`;
    }
  }

  buffer += 'Extraé las reglas canónicas, anti-patrones típicos a evitar, normativa paraguaya citada y datos vigentes para cada una de las categorías indicadas, respetando rigurosamente el esquema JSON array solicitado.';
  return buffer;
}

function generateMarkdownReport({ outName, generatedAt, datasetPath, datasetMtimeMs, staleDataset, entriesCount, groupsOk, groupsTotal, rules }) {
  const mtimeIso = datasetMtimeMs > 0 ? new Date(datasetMtimeMs).toISOString() : 'Desconocido';
  const datasetStatus = staleDataset ? '⚠️ Posiblemente desactualizado (stale)' : '✅ Actualizado en Fase 2';

  let md = `# TOBI — Reglas canónicas candidatas v1 (borrador automático)\n\n`;
  md += `- **Fecha de generación:** ${generatedAt}\n`;
  md += `- **Dataset fuente:** \`${datasetPath}\`\n`;
  md += `- **Fecha modificación dataset:** ${mtimeIso}\n`;
  md += `- **Estado del dataset:** ${datasetStatus}\n`;
  md += `- **Casos fuente analizados:** ${entriesCount}\n`;
  md += `- **Grupos procesados con éxito:** ${groupsOk} de ${groupsTotal}\n\n`;
  md += `---\n\n`;

  for (const item of rules) {
    md += `## ${item.categoria}\n\n`;

    md += `### Reglas canónicas\n`;
    if (item.reglas.length > 0) {
      for (const r of item.reglas) md += `- ${r}\n`;
    } else {
      md += `- *(Sin reglas específicas detectadas)*\n`;
    }
    md += `\n`;

    md += `### Anti-patrones a evitar\n`;
    if (item.antiPatrones.length > 0) {
      for (const a of item.antiPatrones) md += `- ${a}\n`;
    } else {
      md += `- *(Sin anti-patrones específicos detectados)*\n`;
    }
    md += `\n`;

    md += `### Normativa paraguaya de respaldo\n`;
    if (item.normativa.length > 0) {
      for (const n of item.normativa) md += `- ${n}\n`;
    } else {
      md += `- *(Sin normativa explícitamente citada)*\n`;
    }
    md += `\n`;

    md += `### Datos y montos vigentes\n`;
    if (item.datosVigentes.length > 0) {
      for (const d of item.datosVigentes) md += `- ${d}\n`;
    } else {
      md += `- *(Sin datos específicos reportados)*\n`;
    }
    md += `\n---\n\n`;
  }

  md += `> Borrador generado por scripts/mine_canonical_rules.mjs — REQUIERE revisión (Tríada/humana) antes de tocar tobiSystemPrompt.ts.\n`;
  return md;
}

async function main() {
  const cliOpts = parseCliArgs(process.argv.slice(2));

  if (cliOpts.help) {
    printHelp();
    process.exit(0);
  }

  const waitUntil = parseDateFlag(cliOpts.waitUntilRaw, getDefaultWaitUntil);
  let maxWait = parseDateFlag(cliOpts.maxWaitRaw, getDefaultMaxWait);
  if (maxWait.getTime() < waitUntil.getTime()) {
    maxWait = new Date(waitUntil.getTime() + 34 * 60 * 1000);
  }

  const pool = resolveGroqPool();
  if (pool.length === 0) {
    console.error('❌ Error: No se encontraron claves válidas en el pool Groq (GROQ_API_KEY[_1..4]).');
    process.exit(1);
  }
  console.log(`🔑 Pool: ${pool.length} claves`);

  // 1. Espera de hora
  if (Date.now() < waitUntil.getTime()) {
    console.log(`⏳ Esperando consolidación de Fase 2 (${waitUntil.toLocaleTimeString('es-PY')})...`);
    let lastTimeLog = Date.now();
    while (Date.now() < waitUntil.getTime()) {
      const rem = waitUntil.getTime() - Date.now();
      await sleep(Math.min(30000, rem));
      if (Date.now() - lastTimeLog >= 5 * 60 * 1000 && Date.now() < waitUntil.getTime()) {
        console.log(`⏳ Esperando consolidación de Fase 2 (${waitUntil.toLocaleTimeString('es-PY')})...`);
        lastTimeLog = Date.now();
      }
    }
  }

  // 2. Espera del dataset
  const thresholdMtime = waitUntil.getTime() - 5 * 60 * 1000;
  let mtime = getFileMtimeMs(DATASET_FINAL_PATH);
  let staleDataset = false;

  if (mtime < thresholdMtime) {
    console.log(`⏳ Esperando actualización del dataset final (umbral: ${new Date(thresholdMtime).toLocaleTimeString('es-PY')}) hasta ${maxWait.toLocaleTimeString('es-PY')}...`);
    let lastDatasetLog = Date.now();
    while (mtime < thresholdMtime && Date.now() < maxWait.getTime()) {
      const rem = maxWait.getTime() - Date.now();
      await sleep(Math.min(30000, rem));
      mtime = getFileMtimeMs(DATASET_FINAL_PATH);
      if (Date.now() - lastDatasetLog >= 5 * 60 * 1000 && mtime < thresholdMtime) {
        console.log(`⏳ Esperando actualización del dataset final (tope: ${maxWait.toLocaleTimeString('es-PY')})...`);
        lastDatasetLog = Date.now();
      }
    }

    if (mtime < thresholdMtime) {
      console.warn('⚠️ Dataset posiblemente desactualizado');
      staleDataset = true;
    } else {
      console.log(`✅ Dataset actualizado detectado: ${new Date(mtime).toLocaleTimeString('es-PY')}`);
    }
  }

  // 3. Carga y consolidación de entradas
  const finalData = readJsonSafe(DATASET_FINAL_PATH) || [];
  const deepData = readJsonSafe(DATASET_DEEP_PATH) || [];
  const stressData = readJsonSafe(REPORT_STRESS_PATH) || {};

  const stressMap = new Map();
  if (Array.isArray(stressData?.results)) {
    for (const item of stressData.results) {
      if (item?.id) stressMap.set(item.id, item);
    }
  }

  const deepMap = new Map();
  if (Array.isArray(deepData)) {
    for (const item of deepData) {
      if (item?.id) deepMap.set(item.id, item);
    }
  }

  const allCasesMap = new Map();
  if (Array.isArray(finalData)) {
    for (const item of finalData) {
      if (item?.id) allCasesMap.set(item.id, item);
    }
  }
  for (const item of deepData) {
    if (item?.id && !allCasesMap.has(item.id)) {
      allCasesMap.set(item.id, item);
    }
  }

  if (allCasesMap.size === 0) {
    console.error('❌ Error: No se encontraron casos válidos en los datasets cargados.');
    process.exit(1);
  }

  const categorizedCases = new Map();
  for (const [id, raw] of allCasesMap.entries()) {
    const deepItem = deepMap.get(id);
    const stressItem = stressMap.get(id);

    const category = (raw.category || deepItem?.category || stressItem?.category || 'General').trim();
    const title = raw.title || deepItem?.title || stressItem?.title || '';
    const prompt = raw.prompt || deepItem?.prompt || stressItem?.prompt || title;
    const extract = cleanAndExtractResponse(raw, deepItem, stressItem);

    const verified = Boolean(raw.verified ?? deepItem?.verified ?? false);
    const rawScore = Number(
      raw.scores?.total ??
      deepItem?.retest?.scores?.total ??
      stressItem?.total ??
      (raw.passed ? 90 : 0) ??
      0
    );
    const priorityScore = (verified ? 10000 : 0) + rawScore;

    const caseObj = {
      id,
      category,
      title,
      prompt,
      extract,
      verified,
      score: rawScore,
      priorityScore,
    };

    if (!categorizedCases.has(category)) {
      categorizedCases.set(category, []);
    }
    categorizedCases.get(category).push(caseObj);
  }

  // Selección de hasta 4 casos "oro" por categoría
  const selectedByCategory = new Map();
  for (const [cat, list] of categorizedCases.entries()) {
    list.sort((a, b) => b.priorityScore - a.priorityScore);
    selectedByCategory.set(cat, list.slice(0, 4));
  }

  // 4. Minado por grupos de hasta 4 categorías
  const categoryNames = Array.from(selectedByCategory.keys()).sort((a, b) => a.localeCompare(b, 'es'));
  const GROUP_SIZE = 4;
  const groups = [];
  for (let i = 0; i < categoryNames.length; i += GROUP_SIZE) {
    groups.push(categoryNames.slice(i, i + GROUP_SIZE));
  }

  const groupsTotal = groups.length;
  let groupsOk = 0;
  const failedGroups = [];
  const allRules = [];

  console.log(`🚀 Iniciando minado de ${categoryNames.length} categorías divididas en ${groupsTotal} grupos...`);

  for (let idx = 0; idx < groupsTotal; idx++) {
    const groupCats = groups[idx];
    const userPrompt = buildUserPromptForGroup(groupCats, selectedByCategory);

    try {
      const outcome = await callFleetChat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 4096,
        timeoutMs: 180000,
        maxAttempts: 12,
        pacingMs: cliOpts.pauseMs,
      });

      if (!outcome.ok) {
        throw new Error(outcome.error || 'Fallo desconocido en llamada Groq');
      }

      const parsedCategories = parseModelResponse(outcome.content);
      allRules.push(...parsedCategories);
      groupsOk++;

      let rulesCount = 0;
      let antiPatronesCount = 0;
      for (const item of parsedCategories) {
        rulesCount += item.reglas.length;
        antiPatronesCount += item.antiPatrones.length;
      }

      console.log(`🧩 Grupo ${idx + 1}/${groupsTotal} (${groupCats.join(', ')}) — reglas: ${rulesCount} · anti-patrones: ${antiPatronesCount}`);
    } catch (err) {
      console.warn(`⚠️ Error al procesar grupo ${idx + 1}/${groupsTotal} (${groupCats.join(', ')}): ${err.message}`);
      failedGroups.push({
        groupIndex: idx + 1,
        categories: groupCats,
        error: err.message,
      });
    }

    if (idx + 1 < groupsTotal && cliOpts.pauseMs > 0) {
      await sleep(cliOpts.pauseMs);
    }
  }

  // 5. Salida de reportes JSON y Markdown
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const generatedAt = new Date().toISOString();
  const jsonOutPath = path.join(REPORTS_DIR, `${cliOpts.outName}.json`);
  const mdOutPath = path.join(REPORTS_DIR, `${cliOpts.outName}.md`);

  const jsonDoc = {
    generatedAt,
    waitUntil: waitUntil.toISOString(),
    staleDataset,
    source: {
      datasetPath: path.relative(ROOT, DATASET_FINAL_PATH).replace(/\\/g, '/'),
      datasetMtime: mtime > 0 ? new Date(mtime).toISOString() : null,
      entriesCount: allCasesMap.size,
    },
    groupsTotal,
    groupsOk,
    failedGroups,
    rules: allRules,
  };

  const mdDoc = generateMarkdownReport({
    outName: cliOpts.outName,
    generatedAt,
    datasetPath: path.relative(ROOT, DATASET_FINAL_PATH).replace(/\\/g, '/'),
    datasetMtimeMs: mtime,
    staleDataset,
    entriesCount: allCasesMap.size,
    groupsOk,
    groupsTotal,
    rules: allRules,
  });

  fs.writeFileSync(jsonOutPath, JSON.stringify(jsonDoc, null, 2), 'utf-8');
  fs.writeFileSync(mdOutPath, mdDoc, 'utf-8');

  console.log(`💾 Reporte JSON generado: ${path.relative(ROOT, jsonOutPath)}`);
  console.log(`📄 Reporte Markdown generado: ${path.relative(ROOT, mdOutPath)}`);

  // 6. Resumen y código de salida
  const minOkRequired = Math.ceil(groupsTotal / 2);
  console.log(`\n🏁 Minado finalizado: ${groupsOk}/${groupsTotal} grupos exitosos (${minOkRequired} requeridos para aprobación).`);

  if (groupsOk >= minOkRequired) {
    process.exit(0);
  } else {
    console.error(`❌ Minado incompleto: no se alcanzó el umbral mínimo de grupos exitosos (${groupsOk} < ${minOkRequired}).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`❌ Error fatal en ejecución: ${err.message}`);
  process.exit(1);
});
