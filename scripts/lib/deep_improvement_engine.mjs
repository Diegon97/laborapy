/**
 * ============================================================================
 * TOBI — FASE 2: MOTOR DE MEJORA PROFUNDA (RE-INVESTIGACIÓN + RE-TEST)
 * ============================================================================
 * Orquesta la segunda pasada nocturna sobre la calibración Qwen 2.5:
 *   1. Espera/lee los resultados de la Fase 1 (night_calibration_progress.json
 *      y reports/tobi_stress_test_report.json).
 *   2. Re-investiga los casos débiles (no aprobados o total < 90) con el modelo
 *      local en modo estudio (corpus normativo + errores detectados).
 *   3. Re-testea cada respuesta mejorada con few-shot de casos ya aprobados.
 *   4. Consolida el Golden Set final (Fase 1 + Fase 2) y ejecuta auditorías de
 *      estabilidad round-robin hasta el deadline.
 *
 * Sin dependencias npm: sólo node:fs, node:path, node:url y los módulos locales
 * tobi_night_core.mjs y deep_research_reports.mjs.
 * Ningún error individual puede tumbar el motor: todos los casos se capturan.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TEST_CASES,
  assertBattery,
  buildCorpus,
  retrievePassages,
  buildCaseQuery,
  buildStudyPrompt,
  parseStudyResponse,
  buildRetestSystem,
  evaluateCase,
} from './tobi_night_core.mjs';
import { buildNotesDoc, buildMarkdownReport } from './deep_research_reports.mjs';
import { callGroqChat, resolveGroqPool, GROQ_TEXT_MODELS } from './cloud_llm_client.mjs';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_CHAT_URL = `${OLLAMA_URL}/api/chat`;
const OLLAMA_MODEL = 'qwen2.5:7b';
const PROVIDER_DEFAULT = String(process.env.TOBI_STUDY_PROVIDER || 'ollama').toLowerCase();
const GROQ_TIMEOUT_MS = 120000;
let activeProvider = PROVIDER_DEFAULT;
let activeModel = process.env.TOBI_STUDY_MODEL
  || (activeProvider === 'groq' ? GROQ_TEXT_MODELS[0] : OLLAMA_MODEL);
let groqKeys = null;
const NUM_CTX = 8192;
const NUM_THREAD = 8;
const TEMP_STUDY = 0.2;
const TEMP_RETEST = 0.1;
const NUM_PREDICT_STUDY = 1800;
const NUM_PREDICT_RETEST = 900;
const TIMEOUT_MS = 480000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const MAX_STUDY_CYCLES = 2;
const PHASE1_POLL_MS = 30000;
const PHASE1_MAX_WAIT_MS = 20 * 60 * 1000;
const PHASE1_STALE_MS = 15 * 60 * 1000;
const PHASE1_MIN_RESULTS = 5;
const DEADLINE_MARGIN_MS = 7 * 60 * 1000;
const AUDIT_START_MARGIN_MS = 20 * 60 * 1000;

// ---------------------------------------------------------------------------
// Rutas absolutas (este archivo vive en scripts/lib/)
// ---------------------------------------------------------------------------
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

export const PATHS = {
  progress: path.join(PROJECT_ROOT, 'scripts', 'deep_improvement_progress.json'),
  enhancedJsonl: path.join(PROJECT_ROOT, 'datasets', 'tobi_deep_improved.jsonl'),
  enhancedJson: path.join(PROJECT_ROOT, 'datasets', 'tobi_deep_improved.json'),
  finalJsonl: path.join(PROJECT_ROOT, 'datasets', 'tobi_gold_dataset_final.jsonl'),
  finalJson: path.join(PROJECT_ROOT, 'datasets', 'tobi_gold_dataset_final.json'),
  notes: path.join(PROJECT_ROOT, 'reports', 'TOBI_DEEP_RESEARCH_NOTES.json'),
  report: path.join(PROJECT_ROOT, 'reports', 'TOBI_DEEP_RESEARCH_REPORT.md'),
  smokeStudy: path.join(PROJECT_ROOT, 'reports', 'smoke_study.json'),
  smokeRetest: path.join(PROJECT_ROOT, 'reports', 'smoke_retest.json'),
};
const PHASE1_PROGRESS_FILE = path.join(PROJECT_ROOT, 'scripts', 'night_calibration_progress.json');
const STRESS_REPORT_FILE = path.join(PROJECT_ROOT, 'reports', 'tobi_stress_test_report.json');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeAtomic(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function writeJsonAtomic(filePath, data) {
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function appendStudyFailure(id, error, rawPreview) {
  try {
    const failuresFile = path.join(PROJECT_ROOT, 'reports', 'tobi_study_failures.jsonl');
    ensureDir(path.dirname(failuresFile));
    const record = {
      at: nowIso(),
      id,
      error: String(error || '').slice(0, 200),
      rawPreview: typeof rawPreview === 'string' ? rawPreview.slice(0, 3000) : '',
    };
    fs.appendFileSync(failuresFile, `${JSON.stringify(record)}\n`, 'utf-8');
  } catch {}
}

/**
 * Calcula el deadline: hoy 08:00 local, o mañana si ya pasó.
 * Un deadlineIso válido lo overridea.
 */
function computeDeadline(deadlineIso) {
  if (deadlineIso) {
    const parsed = new Date(deadlineIso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

let deadlineAt = computeDeadline(null);
function deadlineReached(marginMs = 0) {
  return Date.now() + marginMs >= deadlineAt.getTime();
}
function msLeft() {
  return deadlineAt.getTime() - Date.now();
}

// ---------------------------------------------------------------------------
// Estado interno del módulo
// ---------------------------------------------------------------------------
const batteryById = new Map(TEST_CASES.map((testCase) => [testCase.id, testCase]));
const enhancedById = new Map();
const queueA = [];
const queueB = [];
const runtime = {
  systemPrompt: '',
  corpus: [],
  phase1ById: new Map(),
  phase1Source: null,
};
const state = {
  status: 'idle',
  startedAt: null,
  phase1Status: 'unknown',
  weakTotal: 0,
  nearTotal: 0,
  processed: 0,
  requeued: 0,
  currentId: null,
  cases: [],
  audits: { count: 0, passed: 0, failed: 0, entries: [] },
};
let interrupted = false;
let activeController = null;
let auditIndex = 0;

// ---------------------------------------------------------------------------
// System prompt canónico (mismo patrón que night_calibration_qwen.mjs)
// ---------------------------------------------------------------------------
async function loadSystemPrompt() {
  const tsUrl = new URL('../../src/modules/assistant/tobiSystemPrompt.ts', import.meta.url).href;
  try {
    const mod = await import(tsUrl);
    if (typeof mod.TOBI_SYSTEM_PROMPT === 'string' && mod.TOBI_SYSTEM_PROMPT.length > 0) {
      console.log('✅ System prompt cargado por import directo del módulo .ts');
      return mod.TOBI_SYSTEM_PROMPT;
    }
  } catch (err) {
    console.warn(`⚠️ Import directo del .ts no disponible (${err.message}). Usando fallback de lectura.`);
  }

  const tsPath = path.join(PROJECT_ROOT, 'src', 'modules', 'assistant', 'tobiSystemPrompt.ts');
  const raw = fs.readFileSync(tsPath, 'utf-8');
  const start = raw.indexOf('export const TOBI_SYSTEM_PROMPT');
  const end = raw.indexOf('.join(', start);
  const body = start >= 0 && end > start ? raw.slice(start, end) : raw;
  const parts = [];
  const literalPattern = /'((?:[^'\\]|\\.)*)'/g;
  let match;
  while ((match = literalPattern.exec(body)) !== null) {
    parts.push(match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  }
  if (parts.length === 0) {
    throw new Error('No se pudo extraer TOBI_SYSTEM_PROMPT desde el archivo fuente.');
  }
  console.log('✅ System prompt cargado por fallback de lectura del archivo');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Cliente Ollama (/api/chat) con reintentos y deadline
// ---------------------------------------------------------------------------
async function callModelOllama({
  system,
  user,
  temperature = TEMP_STUDY,
  numPredict = NUM_PREDICT_STUDY,
  enforceDeadline = true,
}) {
  if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
  if (enforceDeadline && deadlineReached(DEADLINE_MARGIN_MS)) return { ok: false, content: '', error: 'deadline' };

  let lastError = 'error desconocido';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
    if (enforceDeadline && deadlineReached(DEADLINE_MARGIN_MS)) return { ok: false, content: '', error: 'deadline' };

    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(OLLAMA_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          stream: false,
          options: {
            temperature,
            num_ctx: NUM_CTX,
            num_thread: NUM_THREAD,
            num_predict: numPredict,
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const content = data && data.message && typeof data.message.content === 'string'
        ? data.message.content
        : (data && typeof data.response === 'string' ? data.response : '');
      if (!content) throw new Error('Respuesta vacía de Ollama');
      return { ok: true, content: content.trim(), error: null };
    } catch (err) {
      lastError = err.name === 'AbortError'
        ? `TIMEOUT (${Math.round(TIMEOUT_MS / 1000)}s)`
        : (err.message || String(err));
      if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }

    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
  }
  return { ok: false, content: '', error: lastError };
}

// ---------------------------------------------------------------------------
// Cliente Groq cloud (OpenAI-compatible) con pool de claves y failover
// ---------------------------------------------------------------------------
async function callModelCloud({
  system,
  user,
  temperature = TEMP_STUDY,
  numPredict = NUM_PREDICT_STUDY,
  enforceDeadline = true,
}) {
  if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
  if (enforceDeadline && deadlineReached(DEADLINE_MARGIN_MS)) return { ok: false, content: '', error: 'deadline' };

  // El pool puede no haberse resuelto aún (p. ej. runSmoke): se resuelve aquí.
  if (!groqKeys) groqKeys = resolveGroqPool();
  if (groqKeys.length === 0) {
    return { ok: false, content: '', error: 'sin claves Groq (GROQ_POOL_VACIO)' };
  }

  let lastError = 'error desconocido';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
    if (enforceDeadline && deadlineReached(DEADLINE_MARGIN_MS)) return { ok: false, content: '', error: 'deadline' };

    const controller = new AbortController();
    activeController = controller;
    try {
      const result = await callGroqChat({
        keys: groqKeys,
        models: GROQ_TEXT_MODELS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        maxTokens: numPredict,
        timeoutMs: GROQ_TIMEOUT_MS,
        signal: controller.signal,
      });
      if (result.ok) return { ok: true, content: result.content, error: null };
      if (result.aborted || interrupted) return { ok: false, content: '', error: 'interrumpido' };
      lastError = result.error || 'error desconocido';
      // 400/413/422 son fatales: no reintentar con el bucle externo.
      if (/^HTTP (400|413|422)(:|$)/.test(lastError)) {
        return { ok: false, content: '', error: lastError };
      }
    } catch (err) {
      lastError = err?.message || String(err);
      if (interrupted) return { ok: false, content: '', error: 'interrumpido' };
    } finally {
      if (activeController === controller) activeController = null;
    }

    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
  }
  return { ok: false, content: '', error: lastError };
}

// ---------------------------------------------------------------------------
// Dispatcher: deriva al proveedor activo (ollama local o groq cloud)
// ---------------------------------------------------------------------------
async function callModel(opts) {
  if (activeProvider === 'groq') return callModelCloud(opts);
  return callModelOllama(opts);
}

// ---------------------------------------------------------------------------
// Fase 1: espera y carga de resultados
// ---------------------------------------------------------------------------
function classifyPhase1(snapshot, elapsedMs) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ready: false, status: elapsedMs > PHASE1_MAX_WAIT_MS ? 'absent-timeout' : 'absent' };
  }
  const status = snapshot.status || 'unknown';
  const results = Array.isArray(snapshot.results) ? snapshot.results : [];
  const updatedAtMs = snapshot.updatedAt ? new Date(snapshot.updatedAt).getTime() : 0;
  const stale = Number.isFinite(updatedAtMs) && updatedAtMs > 0 && (Date.now() - updatedAtMs > PHASE1_STALE_MS);

  if (status === 'completed') return { ready: true, status };
  if (status === 'interrupted' || status === 'aborted') {
    return { ready: results.length >= PHASE1_MIN_RESULTS, status };
  }
  if (status === 'running' || status === 'starting' || status === 'interrupting') {
    if (stale) return { ready: results.length >= PHASE1_MIN_RESULTS, status: 'stale-crashed' };
    return { ready: false, status };
  }
  if (elapsedMs > PHASE1_MAX_WAIT_MS) return { ready: false, status: 'absent-timeout' };
  return { ready: false, status };
}

async function waitForPhase1(noWait) {
  console.log('⏳ Fase 2: esperando resultados de la Fase 1 (calibración nocturna Qwen)...');
  const waitStart = Date.now();
  for (;;) {
    const snapshot = readJson(PHASE1_PROGRESS_FILE);
    const elapsed = Date.now() - waitStart;
    const verdict = classifyPhase1(snapshot, elapsed);

    if (verdict.ready) {
      console.log(`✅ Fase 1 lista (estado: ${verdict.status}).`);
      return { ready: true, status: verdict.status, snapshot };
    }
    if (noWait) {
      console.warn(`⚠️ --no-wait: continuando con el estado actual de Fase 1 (${verdict.status}).`);
      return { ready: true, status: verdict.status, snapshot };
    }
    if (verdict.status === 'absent-timeout') {
      console.error('❌ Fase 1 no generó progreso dentro del tiempo máximo de espera.');
      return { ready: false, status: verdict.status, snapshot };
    }
    if (verdict.status === 'stale-crashed'
      || (snapshot && (snapshot.status === 'interrupted' || snapshot.status === 'aborted'))) {
      console.error(`❌ Fase 1 (${verdict.status}) con resultados insuficientes (mínimo ${PHASE1_MIN_RESULTS}).`);
      return { ready: false, status: verdict.status, snapshot };
    }
    if (interrupted) {
      console.warn('⏹️ Interrupción durante la espera de Fase 1.');
      return { ready: false, status: 'interrupted', snapshot };
    }
    if (deadlineReached(DEADLINE_MARGIN_MS)) {
      console.error('❌ Deadline alcanzado esperando a la Fase 1.');
      return { ready: false, status: 'deadline', snapshot };
    }
    await sleep(PHASE1_POLL_MS);
  }
}

function loadPhase1Results(snapshot) {
  const byId = new Map();
  const progressResults = snapshot && Array.isArray(snapshot.results) ? snapshot.results : [];
  const stress = readJson(STRESS_REPORT_FILE);
  const stressResults = stress && Array.isArray(stress.results) ? stress.results : [];

  // Solo se fusiona el reporte de estrés si pertenece a ESTA corrida de Fase 1.
  // Si es de una noche anterior, se ignora para no mezclar resultados entre corridas.
  const snapshotStartMs = snapshot && snapshot.startedAt ? Date.parse(snapshot.startedAt) : NaN;
  const stressGeneratedMs = stress && typeof stress.generatedAt === 'string' ? Date.parse(stress.generatedAt) : NaN;
  const stressIsFresh = stressResults.length > 0
    && Number.isFinite(stressGeneratedMs)
    && (!Number.isFinite(snapshotStartMs) || stressGeneratedMs >= snapshotStartMs);

  for (const result of progressResults) {
    if (!result || !result.id) continue;
    byId.set(result.id, {
      ...result,
      response: typeof result.response === 'string' ? result.response : '',
    });
  }
  if (stressIsFresh) {
    for (const result of stressResults) {
      if (!result || !result.id) continue;
      const base = byId.get(result.id) || {};
      byId.set(result.id, {
        ...base,
        ...result,
        response: typeof result.response === 'string' ? result.response : (base.response || ''),
      });
    }
  } else if (stressResults.length > 0) {
    console.warn('⚠️ loadPhase1Results: el reporte de estrés es anterior a esta corrida de Fase 1; se ignora (se usa solo el progreso actual).');
  }

  runtime.phase1ById = byId;
  runtime.phase1Source = stressIsFresh
    ? 'tobi_stress_test_report.json'
    : 'night_calibration_progress.json';
  console.log(`📥 Fase 1: ${byId.size} casos cargados desde ${runtime.phase1Source}.`);
  return byId;
}

// ---------------------------------------------------------------------------
// Colas de trabajo
// ---------------------------------------------------------------------------
function buildWorkQueues() {
  queueA.length = 0;
  queueB.length = 0;

  for (const testCase of TEST_CASES) {
    const existing = enhancedById.get(testCase.id);
    if (existing) {
      if (existing.verified) continue;
      if ((existing.studyCycle || 0) >= MAX_STUDY_CYCLES) continue;
      const existingFailures = Array.isArray(existing.retest && existing.retest.failures) && existing.retest.failures.length > 0
        ? existing.retest.failures
        : (Array.isArray(existing.before && existing.before.failures) ? existing.before.failures : []);
      queueA.push({
        id: testCase.id,
        cycles: existing.studyCycle || 0,
        total: (existing.retest && existing.retest.scores && typeof existing.retest.scores.total === 'number')
          ? existing.retest.scores.total
          : ((existing.before && existing.before.scores && typeof existing.before.scores.total === 'number') ? existing.before.scores.total : 0),
        lastFailures: existingFailures,
      });
      continue;
    }

    const phase1 = runtime.phase1ById.get(testCase.id);
    const passed = !!(phase1 && phase1.passed);
    const total = phase1 && typeof phase1.total === 'number' ? phase1.total : 0;
    const failures = phase1 && Array.isArray(phase1.failures) ? phase1.failures : [];

    if (!passed || total < 90) {
      queueA.push({ id: testCase.id, cycles: 0, total, lastFailures: failures });
    } else if (total < 100) {
      queueB.push({ id: testCase.id, cycles: 0, total, lastFailures: [] });
    }
  }

  queueA.sort((a, b) => a.total - b.total);
  queueB.sort((a, b) => a.total - b.total);
}

function orderedEnhanced() {
  const list = [];
  for (const testCase of TEST_CASES) {
    const entry = enhancedById.get(testCase.id);
    if (entry) list.push(entry);
  }
  return list;
}

function pickFewShots(category, excludeId) {
  const picks = [];
  const seen = new Set([excludeId]);

  // 1. Enhanced verificados de la misma categoría, mejor score primero.
  const verifiedSame = orderedEnhanced()
    .filter((entry) => entry.verified && entry.category === category && !seen.has(entry.id))
    .map((entry) => ({ entry, score: (entry.retest && entry.retest.scores && entry.retest.scores.total) || 0 }))
    .sort((a, b) => b.score - a.score);
  for (const { entry } of verifiedSame) {
    if (picks.length >= 2) break;
    picks.push({
      title: entry.title,
      prompt: entry.prompt,
      response: (entry.retest && entry.retest.response) || entry.improved_response || '',
    });
    seen.add(entry.id);
  }

  const phase1Passing = [...runtime.phase1ById.values()]
    .filter((result) => result && result.passed && typeof result.response === 'string' && result.response.trim() && !seen.has(result.id))
    .sort((a, b) => (b.total || 0) - (a.total || 0));

  // 2. Fase 1 aprobados de la misma categoría.
  for (const result of phase1Passing) {
    if (picks.length >= 2) break;
    if (result.category !== category) continue;
    picks.push({ title: result.title, prompt: result.prompt, response: result.response });
    seen.add(result.id);
  }

  // 3. Último recurso: cualquier aprobado global.
  for (const result of phase1Passing) {
    if (picks.length >= 2) break;
    if (seen.has(result.id)) continue;
    picks.push({ title: result.title, prompt: result.prompt, response: result.response });
    seen.add(result.id);
  }

  return picks;
}

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------
function upsertCaseRow(id) {
  let row = state.cases.find((entry) => entry.id === id);
  if (!row) {
    const batteryCase = batteryById.get(id);
    row = {
      id,
      category: batteryCase ? batteryCase.category : null,
      title: batteryCase ? batteryCase.title : null,
      status: 'pending',
      cycles: 0,
    };
    state.cases.push(row);
  }
  return row;
}

function buildProgressDoc() {
  return {
    status: state.status,
    startedAt: state.startedAt,
    updatedAt: nowIso(),
    deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
    provider: activeProvider,
    model: activeModel,
    phase1Status: state.phase1Status,
    weakTotal: state.weakTotal,
    nearTotal: state.nearTotal,
    processed: state.processed,
    verifiedImproved: state.cases.filter((entry) => entry.status === 'verified').length,
    unverified: state.cases.filter((entry) => entry.status === 'unverified').length,
    requeued: state.requeued,
    currentId: state.currentId,
    cases: state.cases,
    audits: state.audits,
  };
}

function persistProgress() {
  writeJsonAtomic(PATHS.progress, buildProgressDoc());
}

function persistEnhanced() {
  const entries = orderedEnhanced();
  const jsonl = entries.map((entry) => JSON.stringify(entry)).join('\n');
  writeAtomic(PATHS.enhancedJsonl, jsonl.length > 0 ? `${jsonl}\n` : '');
  writeJsonAtomic(PATHS.enhancedJson, entries);
}

function buildTotals() {
  const entries = orderedEnhanced();
  return {
    weakTotal: state.weakTotal,
    nearTotal: state.nearTotal,
    processed: state.processed,
    verified: entries.filter((entry) => entry.verified).length,
    unverified: entries.filter((entry) => !entry.verified).length,
    requeued: state.requeued,
    auditRounds: state.audits.count,
  };
}

function persistNotes() {
  writeJsonAtomic(PATHS.notes, buildNotesDoc({
    startedAt: state.startedAt,
    model: activeModel,
    phase1Source: runtime.phase1Source,
    totals: buildTotals(),
    enhancedEntries: orderedEnhanced(),
    audits: state.audits,
    artifacts: PATHS,
  }));
}

// ---------------------------------------------------------------------------
// Reencolado
// ---------------------------------------------------------------------------
function tryRequeue(item, failures) {
  const nextCycles = (item.cycles || 0) + 1;
  if (nextCycles >= MAX_STUDY_CYCLES) return false;
  queueA.push({
    id: item.id,
    cycles: nextCycles,
    total: item.total || 0,
    lastFailures: Array.isArray(failures) ? failures : [],
  });
  state.requeued += 1;
  persistProgress();
  return true;
}

// ---------------------------------------------------------------------------
// Procesamiento de un caso: estudio → re-test → verificación
// ---------------------------------------------------------------------------
async function processCase(item) {
  const batteryCase = batteryById.get(item.id);
  if (!batteryCase) return { status: 'failed' };
  if (deadlineReached(DEADLINE_MARGIN_MS)) return { status: 'deadline' };

  const existing = enhancedById.get(item.id);
  const fallbackFailures = (existing && existing.before && Array.isArray(existing.before.failures))
    ? existing.before.failures
    : [];
  const failures = Array.isArray(item.lastFailures) && item.lastFailures.length > 0
    ? item.lastFailures
    : fallbackFailures;

  const query = buildCaseQuery(batteryCase, failures);
  const { passagesText } = retrievePassages(runtime.corpus, query, {});

  const phase1 = runtime.phase1ById.get(item.id);
  const previousAttempt = phase1 && phase1.response
    ? { response: phase1.response }
    : ((existing && existing.retest && existing.retest.response)
      ? { response: existing.retest.response }
      : null);

  const studyPrompt = buildStudyPrompt({
    testCase: batteryCase,
    failures,
    previousAttempt,
    passagesText,
    canonicalPrompt: runtime.systemPrompt,
  });

  console.log(`   🔎 [${item.id}] estudio (ciclo ${item.cycles + 1}/${MAX_STUDY_CYCLES})...`);
  const studyRes = await callModel({
    system: studyPrompt.system,
    user: studyPrompt.user,
    temperature: TEMP_STUDY,
    numPredict: NUM_PREDICT_STUDY,
  });
  if (!studyRes.ok) {
    if (studyRes.error === 'interrumpido') return { status: 'interrupted' };
    if (studyRes.error === 'deadline') return { status: 'deadline' };
    appendStudyFailure(item.id, `call: ${studyRes.error}`, '');
    const requeued = tryRequeue(item, [`Error de estudio: ${studyRes.error}`]);
    return { status: requeued ? 'requeued' : 'unverified' };
  }

  const parsed = parseStudyResponse(studyRes.content);
  if (!parsed) {
    appendStudyFailure(item.id, 'parse: respuesta de estudio no parseable', studyRes.content);
    const requeued = tryRequeue(item, ['Respuesta de estudio no parseable (JSON inválido)']);
    return { status: requeued ? 'requeued' : 'unverified' };
  }

  const priorBefore = (existing && existing.before) || {
    scores: phase1
      ? { legal: phase1.legal, calc: phase1.calc, tone: phase1.tone, total: phase1.total }
      : null,
    passed: phase1 ? !!phase1.passed : false,
    failures: phase1 && Array.isArray(phase1.failures) ? phase1.failures : [],
    response: phase1 && typeof phase1.response === 'string' ? phase1.response : '',
  };

  const record = {
    id: batteryCase.id,
    category: batteryCase.category,
    title: batteryCase.title,
    prompt: batteryCase.prompt,
    improved_response: parsed.improved_response,
    key_rules: parsed.key_rules,
    citations: parsed.citations,
    sources: parsed.sources,
    studyCycle: item.cycles + 1,
    before: priorBefore,
    retest: null,
    verified: false,
    generatedAt: nowIso(),
  };
  enhancedById.set(record.id, record);
  persistEnhanced();
  persistProgress();

  if (deadlineReached(DEADLINE_MARGIN_MS)) return { status: 'deadline' };

  const fewShots = pickFewShots(batteryCase.category, batteryCase.id);
  const retestSystem = buildRetestSystem(runtime.systemPrompt, fewShots);
  console.log(`   🧪 [${item.id}] re-test con ${fewShots.length} few-shot...`);
  const retestRes = await callModel({
    system: retestSystem,
    user: batteryCase.prompt,
    temperature: TEMP_RETEST,
    numPredict: NUM_PREDICT_RETEST,
  });

  if (!retestRes.ok) {
    record.retest = {
      scores: { legal: 0, calc: 0, tone: 0, total: 0 },
      passed: false,
      failures: [retestRes.error === 'deadline' ? 'no ejecutado por deadline' : `Error de re-test: ${retestRes.error}`],
      response: '',
    };
    enhancedById.set(record.id, record);
    persistEnhanced();
    persistProgress();
    if (retestRes.error === 'interrumpido') return { status: 'interrupted' };
    if (retestRes.error === 'deadline') return { status: 'deadline' };
    const requeued = tryRequeue(item, record.retest.failures);
    return { status: requeued ? 'requeued' : 'unverified' };
  }

  const evaluation = evaluateCase(batteryCase, retestRes.content);
  record.retest = {
    scores: {
      legal: evaluation.legal,
      calc: evaluation.calc,
      tone: evaluation.tone,
      total: evaluation.total,
    },
    passed: evaluation.passed,
    failures: evaluation.failures,
    response: retestRes.content,
  };
  enhancedById.set(record.id, record);

  if (evaluation.passed) {
    record.verified = true;
    enhancedById.set(record.id, record);
    persistEnhanced();
    persistProgress();
    console.log(`   ✅ VERIFICADO [${item.id}] — ${evaluation.total}/100`);
    return { status: 'verified' };
  }

  persistEnhanced();
  persistProgress();
  const requeued = tryRequeue(item, evaluation.failures);
  return { status: requeued ? 'requeued' : 'unverified' };
}

// ---------------------------------------------------------------------------
// Consolidación del Golden Set
// ---------------------------------------------------------------------------
function consolidate() {
  const phase1Entries = [...runtime.phase1ById.values()]
    .filter((result) => result && result.passed && typeof result.response === 'string' && result.response.trim())
    .map((result) => ({
      id: result.id,
      category: result.category,
      title: result.title,
      prompt: result.prompt,
      response: result.response,
      origin: 'phase1',
    }));

  const enhancedEntries = orderedEnhanced().map((entry) => ({
    id: entry.id,
    category: entry.category,
    title: entry.title,
    prompt: entry.prompt,
    response: entry.improved_response,
    origin: 'phase2',
    verified: !!entry.verified,
    scores: (entry.retest && entry.retest.scores) ? entry.retest.scores : null,
    key_rules: entry.key_rules || [],
    citations: entry.citations || [],
  }));

  // Prioridad: enhanced.verified > phase1 > enhanced unverified.
  const byId = new Map();
  for (const entry of enhancedEntries) {
    if (entry.verified) byId.set(entry.id, entry);
  }
  for (const phase1Entry of phase1Entries) {
    if (!byId.has(phase1Entry.id)) byId.set(phase1Entry.id, phase1Entry);
  }
  let omittedUnverified = 0;
  for (const entry of enhancedEntries) {
    if (entry.verified) continue;
    if (byId.has(entry.id)) {
      omittedUnverified += 1;
      continue;
    }
    byId.set(entry.id, entry);
  }

  const finalEntries = TEST_CASES.map((testCase) => byId.get(testCase.id)).filter(Boolean);

  const jsonl = finalEntries.map((entry) => JSON.stringify(entry)).join('\n');
  writeAtomic(PATHS.finalJsonl, jsonl.length > 0 ? `${jsonl}\n` : '');
  writeJsonAtomic(PATHS.finalJson, finalEntries);

  persistNotes();
  writeAtomic(PATHS.report, buildMarkdownReport({
    startedAt: state.startedAt,
    deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
    model: activeModel,
    phase1Source: runtime.phase1Source,
    totals: buildTotals(),
    enhancedEntries: orderedEnhanced(),
    phase1Entries,
    audits: state.audits,
  }));

  console.log(`📚 Consolidación: ${finalEntries.length} casos finales `
    + `(${phase1Entries.length} Fase 1, ${enhancedEntries.length} Fase 2, ${omittedUnverified} unverified omitidos).`);
  return finalEntries;
}

// ---------------------------------------------------------------------------
// Auditorías de estabilidad (round-robin hasta el deadline)
// ---------------------------------------------------------------------------
function buildAuditPool() {
  const ids = new Set();
  for (const entry of orderedEnhanced()) {
    if (entry.verified && batteryById.has(entry.id)) ids.add(entry.id);
  }
  for (const result of runtime.phase1ById.values()) {
    if (result && result.id && batteryById.has(result.id)) ids.add(result.id);
  }
  return [...ids];
}

async function runStabilityAudits(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return;
  console.log(`🔬 Auditorías de estabilidad: pool de ${pool.length} casos (round-robin)...`);
  while (!interrupted && msLeft() > AUDIT_START_MARGIN_MS && !deadlineReached(DEADLINE_MARGIN_MS)) {
    const id = pool[auditIndex % pool.length];
    auditIndex += 1;
    const batteryCase = batteryById.get(id);
    if (!batteryCase) continue;

    state.currentId = id;
    const res = await callModel({
      system: runtime.systemPrompt,
      user: batteryCase.prompt,
      temperature: TEMP_RETEST,
      numPredict: NUM_PREDICT_RETEST,
    });
    if (!res.ok) {
      if (res.error === 'deadline' || res.error === 'interrumpido') break;
      console.warn(`   ⚠️ Auditoría [${id}] fallida: ${res.error}`);
      continue;
    }

    const evaluation = evaluateCase(batteryCase, res.content);
    state.audits.entries.push({
      id,
      scores: {
        legal: evaluation.legal,
        calc: evaluation.calc,
        tone: evaluation.tone,
        total: evaluation.total,
      },
      passed: evaluation.passed,
      at: nowIso(),
    });
    state.audits.count = state.audits.entries.length;
    if (evaluation.passed) state.audits.passed += 1;
    else state.audits.failed += 1;
    persistProgress();
    console.log(`   ${evaluation.passed ? '✅' : '❌'} Auditoría [${id}] — ${evaluation.total}/100`);
  }
}

// ---------------------------------------------------------------------------
// Interrupción cooperativa
// ---------------------------------------------------------------------------
export function requestInterrupt() {
  interrupted = true;
  if (activeController) {
    try {
      activeController.abort();
    } catch {}
  }
  console.warn('⏹️ Interrupción solicitada: el motor cerrará ordenadamente entre pasos.');
}

// ---------------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------------
export async function run({ noWait = false, deadlineIso = null, provider = null, model = null } = {}) {
  interrupted = false;
  deadlineAt = computeDeadline(deadlineIso);
  if (provider) activeProvider = String(provider).toLowerCase();
  if (model) {
    activeModel = model;
  } else {
    activeModel = process.env.TOBI_STUDY_MODEL
      || (activeProvider === 'groq' ? GROQ_TEXT_MODELS[0] : OLLAMA_MODEL);
  }
  if (activeProvider === 'groq') {
    groqKeys = resolveGroqPool();
    if (groqKeys.length === 0) {
      throw new Error('Provider groq sin claves: faltan GROQ_API_KEY* en el entorno. Lanzar con --env-file=.env --env-file=.env.local');
    }
    console.log(`🔑 Pool Groq: ${groqKeys.length} clave(s) cargadas.`);
  } else {
    groqKeys = null;
  }
  auditIndex = 0;
  queueA.length = 0;
  queueB.length = 0;
  enhancedById.clear();
  const resumedEntries = readJson(PATHS.enhancedJson);
  if (Array.isArray(resumedEntries)) {
    for (const entry of resumedEntries) {
      if (entry && entry.id) enhancedById.set(entry.id, entry);
    }
    if (enhancedById.size > 0) {
      console.log(`♻️ Resume: ${enhancedById.size} entradas mejoradas cargadas desde disco (${[...enhancedById.values()].filter((e) => e.verified).length} verificadas).`);
    }
  }
  runtime.systemPrompt = '';
  runtime.corpus = [];
  runtime.phase1ById = new Map();
  runtime.phase1Source = null;
  state.status = 'waiting';
  state.startedAt = nowIso();
  state.phase1Status = 'unknown';
  state.weakTotal = 0;
  state.nearTotal = 0;
  state.processed = 0;
  state.requeued = 0;
  state.currentId = null;
  state.cases = [];
  state.audits = { count: 0, passed: 0, failed: 0, entries: [] };

  console.log('================================================================');
  console.log('🌙 TOBI — FASE 2: MOTOR DE MEJORA PROFUNDA (QWEN 2.5)');
  console.log(`🧠 Motor: ${activeProvider} · Modelo: ${activeModel} · Deadline: ${deadlineAt.toISOString()}`);
  console.log('================================================================\n');

  try {
    assertBattery(TEST_CASES);
    runtime.systemPrompt = await loadSystemPrompt();
    const { chunks } = buildCorpus({ projectRoot: PROJECT_ROOT, logger: console });
    runtime.corpus = chunks;
  } catch (err) {
    state.status = 'aborted';
    persistProgress();
    console.error(`❌ Fase 2 abortada en la preparación: ${err.message}`);
    return { status: 'aborted', processed: 0, verified: 0, unverified: 0, audits: 0, artifacts: PATHS };
  }

  const phase1 = await waitForPhase1(noWait);
  if (!phase1.ready) {
    state.status = interrupted ? 'interrupted' : 'aborted';
    state.phase1Status = phase1.status || 'unknown';
    persistProgress();
    if (interrupted) {
      console.warn('⏹️ Fase 2 interrumpida durante la espera de la Fase 1.');
    } else {
      console.error('❌ Fase 2 abortada: la Fase 1 no está disponible.');
    }
    return { status: state.status, processed: 0, verified: 0, unverified: 0, audits: 0, artifacts: PATHS };
  }

  state.phase1Status = phase1.status;
  loadPhase1Results(phase1.snapshot);
  buildWorkQueues();
  state.weakTotal = queueA.length;
  state.nearTotal = queueB.length;
  state.status = 'running';
  persistProgress();
  console.log(`🧩 Cola débil: ${state.weakTotal} · Cola cercana (near): ${state.nearTotal}`);

  while (!interrupted && (queueA.length > 0 || queueB.length > 0) && !deadlineReached(DEADLINE_MARGIN_MS)) {
    const item = queueA.shift() || queueB.shift();
    if (!item) break;

    state.status = 'running';
    state.currentId = item.id;
    const row = upsertCaseRow(item.id);
    row.status = 'running';
    state.processed += 1;

    let outcome;
    try {
      outcome = await processCase(item);
    } catch (err) {
      console.error(`   ❌ Error inesperado en [${item.id}]: ${err.message}`);
      outcome = { status: 'failed' };
    }

    row.status = outcome.status;
    row.cycles = Math.max(row.cycles || 0, item.cycles || 0);
    row.updatedAt = nowIso();
    persistProgress();

    if (outcome.status === 'deadline') {
      console.warn('⏰ Deadline alcanzado durante el procesamiento: cerrando la cola.');
      break;
    }
    if (outcome.status === 'interrupted') {
      console.warn('⏹️ Interrupción detectada durante el procesamiento: cerrando la cola.');
      break;
    }
  }

  state.status = 'consolidating';
  state.currentId = null;
  persistProgress();
  consolidate();

  const auditPool = buildAuditPool();
  if (!interrupted && msLeft() > AUDIT_START_MARGIN_MS && auditPool.length > 0 && !deadlineReached(DEADLINE_MARGIN_MS)) {
    state.status = 'auditing';
    persistProgress();
    await runStabilityAudits(auditPool);
    consolidate();
  }

  state.status = interrupted ? 'interrupted' : 'completed';
  state.currentId = null;
  persistProgress();
  persistNotes();

  const finalEnhanced = orderedEnhanced();
  const verified = finalEnhanced.filter((entry) => entry.verified).length;
  const unverified = finalEnhanced.filter((entry) => !entry.verified).length;

  console.log('\n================================================================');
  console.log('📊 RESUMEN FASE 2 — MEJORA PROFUNDA');
  console.log(`Estado: ${state.status}`);
  console.log(`Procesados: ${state.processed} · Verificados: ${verified} · No verificados: ${unverified}`);
  console.log(`Auditorías: ${state.audits.count} (✅ ${state.audits.passed} / ❌ ${state.audits.failed})`);
  console.log('================================================================\n');

  return {
    status: state.status,
    processed: state.processed,
    verified,
    unverified,
    audits: state.audits.count,
    artifacts: PATHS,
  };
}

// ---------------------------------------------------------------------------
// Smoke test (estudio + re-test de un único caso)
// ---------------------------------------------------------------------------
function loadSmokeFewShots(batteryCase) {
  const byId = new Map();
  const progress = readJson(PHASE1_PROGRESS_FILE);
  if (progress && Array.isArray(progress.results)) {
    for (const result of progress.results) {
      if (result && result.id) byId.set(result.id, result);
    }
  }
  const stress = readJson(STRESS_REPORT_FILE);
  if (stress && Array.isArray(stress.results)) {
    for (const result of stress.results) {
      if (result && result.id) byId.set(result.id, { ...(byId.get(result.id) || {}), ...result });
    }
  }
  return [...byId.values()]
    .filter((result) => result
      && result.passed
      && result.category === batteryCase.category
      && result.id !== batteryCase.id
      && typeof result.response === 'string'
      && result.response.trim())
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 2)
    .map((result) => ({ title: result.title, prompt: result.prompt, response: result.response }));
}

export async function runSmoke() {
  console.log('🧪 SMOKE FASE 2 — validación de estudio + re-test...');
  assertBattery(TEST_CASES);
  runtime.systemPrompt = await loadSystemPrompt();
  const { chunks } = buildCorpus({ projectRoot: PROJECT_ROOT, logger: console });
  runtime.corpus = chunks;

  const batteryCase = batteryById.get('SMV-02');
  if (!batteryCase) throw new Error('runSmoke: caso SMV-02 no encontrado en la batería.');

  let failures = null;
  const progress = readJson(PHASE1_PROGRESS_FILE);
  if (progress && Array.isArray(progress.results)) {
    const found = progress.results.find((result) => result && result.id === 'SMV-02');
    if (found && Array.isArray(found.failures) && found.failures.length > 0) failures = found.failures;
  }
  if (!failures) {
    failures = ['Falta patrón requerido: /(?:vencido|viejo|desactualizado|2024|no vigente)/i'];
  }

  const query = buildCaseQuery(batteryCase, failures);
  const { passagesText } = retrievePassages(runtime.corpus, query, {});
  const studyPrompt = buildStudyPrompt({
    testCase: batteryCase,
    failures,
    previousAttempt: null,
    passagesText,
    canonicalPrompt: runtime.systemPrompt,
  });

  const studyRes = await callModel({
    system: studyPrompt.system,
    user: studyPrompt.user,
    temperature: TEMP_STUDY,
    numPredict: NUM_PREDICT_STUDY,
    enforceDeadline: false,
  });
  const parsed = studyRes.ok ? parseStudyResponse(studyRes.content) : null;
  writeJsonAtomic(PATHS.smokeStudy, {
    generatedAt: nowIso(),
    id: batteryCase.id,
    ok: studyRes.ok,
    error: studyRes.error,
    systemPreview: studyPrompt.system.slice(0, 800),
    userPreview: studyPrompt.user.slice(0, 800),
    raw: studyRes.content,
    parsed,
  });
  const studyOk = studyRes.ok && !!parsed;
  console.log(`   ${studyOk ? '✅' : '❌'} Estudio: ${studyOk ? 'JSON parseable' : (studyRes.error || 'no parseable')}`);

  let retestOk = false;
  let evaluation = null;
  if (studyOk) {
    const fewShots = loadSmokeFewShots(batteryCase);
    const retestSystem = buildRetestSystem(runtime.systemPrompt, fewShots);
    const retestRes = await callModel({
      system: retestSystem,
      user: batteryCase.prompt,
      temperature: TEMP_RETEST,
      numPredict: NUM_PREDICT_RETEST,
      enforceDeadline: false,
    });
    if (retestRes.ok) evaluation = evaluateCase(batteryCase, retestRes.content);
    retestOk = retestRes.ok;
    writeJsonAtomic(PATHS.smokeRetest, {
      generatedAt: nowIso(),
      id: batteryCase.id,
      ok: retestRes.ok,
      error: retestRes.error,
      systemPreview: retestSystem.slice(0, 800),
      user: batteryCase.prompt,
      raw: retestRes.content,
      evaluation,
    });
    console.log(`   ${retestOk ? '✅' : '❌'} Re-test${evaluation ? ` — ${evaluation.total}/100` : ''}`);
  }

  const ok = studyOk && retestOk;
  console.log(`🧪 Smoke Fase 2: ${ok ? 'OK' : 'FALLIDO'}.`);
  return { ok, studyOk, retestOk, evaluation };
}