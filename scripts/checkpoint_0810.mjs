#!/usr/bin/env node
/**
 * ============================================================================
 * CHECKPOINT 08:10 — RESUMEN AUTOMÁTICO DEL ENTRENAMIENTO NOCTURNO DE TOBI
 * ============================================================================
 * Consolida las dos fases nocturnas (calibración Qwen 2.5 + mejora profunda)
 * en `reports/CHECKPOINT_0810.md` + `reports/CHECKPOINT_0810.json`, y copia el
 * Markdown al cerebro de opencode para arrancar la próxima sesión.
 *
 * Uso:
 *   node scripts/checkpoint_0810.mjs          # espera hasta hoy 08:10 local
 *   node scripts/checkpoint_0810.mjs --now    # genera ya (rutas reales)
 *   node scripts/checkpoint_0810.mjs --dry    # genera ya en rutas *_TEST.*
 *
 * Sin dependencias npm: sólo node:fs, node:path, node:url.
 * Ninguna recolección puede tumbar el script: ausente/JSON inválido -> N/D o 0.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Rutas y constantes
// ---------------------------------------------------------------------------
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const BRAIN_PATH = path.join(process.env.USERPROFILE || '', '.local', 'share', 'opencode', 'brain', 'session_checkpoint.md');

const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const DATASETS_DIR = path.join(PROJECT_ROOT, 'datasets');

const PHASE1_PROGRESS = path.join(SCRIPT_DIR, 'night_calibration_progress.json');
const PHASE2_PROGRESS = path.join(SCRIPT_DIR, 'deep_improvement_progress.json');
const STRESS_REPORT = path.join(REPORTS_DIR, 'tobi_stress_test_report.json');
const RESEARCH_NOTES = path.join(REPORTS_DIR, 'TOBI_DEEP_RESEARCH_NOTES.json');
const SMOKE_RETEST = path.join(REPORTS_DIR, 'smoke_retest.json');
const GOLD_JSONL = path.join(DATASETS_DIR, 'tobi_gold_dataset_50.jsonl');
const ENHANCED_JSONL = path.join(DATASETS_DIR, 'tobi_deep_improved.jsonl');
const FINAL_JSONL = path.join(DATASETS_DIR, 'tobi_gold_dataset_final.jsonl');
const NIGHT_REPORT_MD = path.join(REPORTS_DIR, 'TOBI_QWEN_NIGHT_TRAINING_REPORT.md');
const RESEARCH_REPORT_MD = path.join(REPORTS_DIR, 'TOBI_DEEP_RESEARCH_REPORT.md');

const WAIT_POLL_MS = 60 * 1000;
const WAIT_LOG_MS = 10 * 60 * 1000;
const TARGET_HOUR = 8;
const TARGET_MINUTE = 10;
const MAX_UNVERIFIED_IDS = 20;

// ---------------------------------------------------------------------------
// Utilidades defensivas (nunca lanzan)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const rel = (abs) => path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');
const safeStr = (value, fallback = 'N/D') => (typeof value === 'string' && value.trim().length > 0 ? value : fallback);
const safeNum = (value, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const safeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    if (raw.trim().length === 0) return null;
    return JSON.parse(raw);
  } catch (err) {
    log(`[WARN] JSON inválido en ${rel(file)}: ${err.message}`);
    return null;
  }
}

function countNonEmptyLines(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  } catch (err) {
    log(`[WARN] No se pudo leer ${rel(file)}: ${err.message}`);
    return null;
  }
}

function parseArgs(argv) {
  const opts = { dry: false, now: false };
  for (const arg of Array.isArray(argv) ? argv : []) {
    if (arg === '--dry') opts.dry = true;
    else if (arg === '--now') opts.now = true;
    else if (arg.startsWith('--')) log(`[WARN] Flag desconocido ignorado: ${arg}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Recolección defensiva
// ---------------------------------------------------------------------------
function collectPhase1() {
  const doc = safeObject(readJson(PHASE1_PROGRESS));
  return {
    status: safeStr(doc.status),
    completed: safeNum(doc.completed),
    totalCases: safeNum(doc.totalCases),
    passed: safeNum(doc.passed),
    failed: safeNum(doc.failed),
    passRate: safeNum(doc.passRate),
    averageScore: safeNum(doc.averageScore),
  };
}

function collectCategoryStats() {
  const doc = readJson(STRESS_REPORT);
  const stats = doc ? doc.categoryStats : null;
  return stats && typeof stats === 'object' && !Array.isArray(stats) ? stats : null;
}

function collectPhase2() {
  const doc = safeObject(readJson(PHASE2_PROGRESS));
  const audits = safeObject(doc.audits);
  const cases = Array.isArray(doc.cases) ? doc.cases : [];
  return {
    status: safeStr(doc.status),
    processed: safeNum(doc.processed),
    verifiedImproved: safeNum(doc.verifiedImproved),
    unverified: safeNum(doc.unverified),
    requeued: safeNum(doc.requeued),
    audits: { count: safeNum(audits.count), passed: safeNum(audits.passed), failed: safeNum(audits.failed) },
    cases,
  };
}

function collectTopRules() {
  const doc = safeObject(readJson(RESEARCH_NOTES));
  const rules = Array.isArray(doc.candidateRules) ? doc.candidateRules : [];
  return rules
    .filter((rule) => rule && typeof rule === 'object')
    .map((rule) => ({ rule: safeStr(rule.rule), count: safeNum(rule.count), cases: Array.isArray(rule.cases) ? rule.cases : [] }))
    .sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule, 'es'))
    .slice(0, 5);
}

function collectSmoke() {
  const doc = safeObject(readJson(SMOKE_RETEST));
  const evaluation = safeObject(doc.evaluation);
  const rawPassed = evaluation.passed;
  const passed = typeof rawPassed === 'boolean' || (typeof rawPassed === 'number' && Number.isFinite(rawPassed)) ? rawPassed : 'N/D';
  return { total: safeNum(evaluation.total), passed };
}

function collectDatasetCounts() {
  return {
    final: countNonEmptyLines(FINAL_JSONL) ?? 0,
    enhanced: countNonEmptyLines(ENHANCED_JSONL) ?? 0,
    gold: countNonEmptyLines(GOLD_JSONL) ?? 0,
  };
}

function collectUnverifiedIds(phase2) {
  return phase2.cases
    .filter((entry) => entry && entry.status === 'unverified' && entry.id !== undefined && entry.id !== null)
    .map((entry) => String(entry.id))
    .slice(0, MAX_UNVERIFIED_IDS);
}

function collectArtifactLines() {
  const entries = [
    { file: PHASE1_PROGRESS, kind: 'exists' },
    { file: STRESS_REPORT, kind: 'exists' },
    { file: PHASE2_PROGRESS, kind: 'exists' },
    { file: RESEARCH_NOTES, kind: 'exists' },
    { file: SMOKE_RETEST, kind: 'exists' },
    { file: GOLD_JSONL, kind: 'lines' },
    { file: ENHANCED_JSONL, kind: 'lines' },
    { file: FINAL_JSONL, kind: 'lines' },
    { file: NIGHT_REPORT_MD, kind: 'exists' },
    { file: RESEARCH_REPORT_MD, kind: 'exists' },
  ];
  return entries.map(({ file, kind }) => {
    const route = rel(file);
    if (kind === 'lines') {
      const count = countNonEmptyLines(file);
      return count === null ? `- \`${route}\` — [FALTA]` : `- \`${route}\` — [OK] ${count} líneas`;
    }
    return fs.existsSync(file) ? `- \`${route}\` — [OK]` : `- \`${route}\` — [FALTA]`;
  });
}

// ---------------------------------------------------------------------------
// Construcción del Markdown (estructura exacta, sin emojis)
// ---------------------------------------------------------------------------
function buildMarkdown(ctx) {
  const { localStamp, phase1, phase2, categoryStats, topRules, datasetCounts, smoke, unverifiedIds, artifactLines } = ctx;
  const lines = [];
  lines.push(`# SESSION CHECKPOINT — Tobi RRHH (entrenamiento nocturno Qwen) — ${localStamp}`);
  lines.push('<!-- generado automáticamente por scripts/checkpoint_0810.mjs -->');
  lines.push('');
  lines.push('## 0. TL;DR de la noche');
  lines.push(`- Fase 1 (batería 52 casos): ${phase1.status} — ${phase1.passed}/${phase1.totalCases} aprobados (${phase1.passRate}%) — promedio ${phase1.averageScore}/100`);
  lines.push(`- Fase 2 (mejora profunda): ${phase2.status} — ${phase2.verifiedImproved} verificados · ${phase2.unverified} sin verificar · ${phase2.audits.count} auditorías`);
  lines.push(`- Datasets: final ${datasetCounts.final} | mejorados Fase 2 ${datasetCounts.enhanced} | batería Fase 1 ${datasetCounts.gold}`);
  lines.push(`- Smoke Fase 2 (SMV-02): ${smoke.total}/100 aprobado=${smoke.passed}`);
  lines.push('');
  lines.push('## 1. Stack y versiones');
  lines.push('- Node.js v24 (ESM) · Ollama 0.34 local · qwen2.5:7b (CPU, ~7 tok/s)');
  lines.push('- App: React 19 · Vite 8 · TypeScript 6 · Vitest 4 · Supabase');
  lines.push('- Scripts nuevos de la sesión: scripts/night_calibration_qwen.mjs, scripts/deep_improvement_qwen.mjs, scripts/lib/tobi_night_core.mjs, scripts/lib/deep_improvement_engine.mjs, scripts/lib/deep_research_reports.mjs, scripts/checkpoint_0810.mjs');
  lines.push('');
  lines.push('## 2. Artefactos');
  if (artifactLines.length > 0) lines.push(...artifactLines);
  else lines.push('N/D');
  lines.push('');
  lines.push('## 3. Resultados Fase 1 por categoría');
  lines.push('');
  if (categoryStats && Object.keys(categoryStats).length > 0) {
    lines.push('| Categoría | Casos | Aprobados | Tasa | Promedio |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const category of Object.keys(categoryStats)) {
      const bucket = safeObject(categoryStats[category]);
      lines.push(`| ${category} | ${safeNum(bucket.total)} | ${safeNum(bucket.passed)} | ${safeNum(bucket.passRate)}% | ${safeNum(bucket.averageScore)}/100 |`);
    }
  } else {
    lines.push('N/D');
  }
  lines.push('');
  lines.push('## 4. Resultados Fase 2 (mejora profunda)');
  lines.push(`- Procesados: ${phase2.processed} · Re-encolados: ${phase2.requeued} · Auditorías: ${phase2.audits.count} ([OK] ${phase2.audits.passed} / [NO] ${phase2.audits.failed})`);
  lines.push('### Reglas candidatas para el prompt canónico (top 5)');
  if (topRules.length > 0) {
    for (const candidate of topRules) lines.push(`- ${candidate.rule} (${candidate.count} casos)`);
  } else {
    lines.push('N/D');
  }
  lines.push('');
  lines.push('## 5. Decisiones tomadas (no re-litigar)');
  lines.push('- Qwen 2.5 7B local (Ollama) como motor de entrenamiento nocturno; cero dependencia de cuota cloud (todo local).');
  lines.push('- Fase 1: batería determinística de 52 casos en 8 categorías; evaluador de 3 dimensiones (fidelidad legal / cálculo-JSON / tono).');
  lines.push('- Fase 2: re-investigación con corpus local (master legal, materiales, resúmenes de audios, resoluciones MTESS, knowledge base) + re-test con few-shot; máximo 2 ciclos por caso.');
  lines.push('- El Golden Set final vive en datasets/tobi_gold_dataset_final.jsonl (Fase 1 + Fase 2 verificada).');
  lines.push('- NO se tocó el producto (tobiSystemPrompt.ts / api/assistant.ts): solo datasets, reportes y scripts de entrenamiento.');
  lines.push('');
  lines.push('## 6. Pendiente próxima sesión');
  lines.push('1. Revisar `reports/TOBI_DEEP_RESEARCH_REPORT.md` — evaluar inyección de las reglas candidatas en `src/modules/assistant/tobiSystemPrompt.ts`.');
  lines.push(`2. Analizar los ${phase2.unverified} casos no verificados y decidir refuerzos.`);
  lines.push('3. (Opcional) Integrar Qwen local como proveedor de desarrollo en `api/assistant.ts`.');
  lines.push('4. (Opcional) Agregar tests Vitest con casos del golden set.');
  lines.push('5. Validar con `npm test` + `npm run build` si se toca código de producto.');
  lines.push('');
  lines.push('## 7. Bloqueadores / pendientes abiertos');
  lines.push(unverifiedIds.length > 0 ? `- Casos sin verificar: ${unverifiedIds.join(', ')}` : 'Ninguno.');
  lines.push('');
  lines.push('## 8. Cómo continuar');
  lines.push('- Abrí una NUEVA sesión y pegá este archivo como primer mensaje (bootstrap).');
  lines.push('- Prompt sugerido: "Revisá los resultados del entrenamiento nocturno de Tobi: leé reports/TOBI_DEEP_RESEARCH_REPORT.md, reports/TOBI_QWEN_NIGHT_TRAINING_REPORT.md y las reglas candidatas; propongamos qué reglas inyectar en tobiSystemPrompt.ts y qué hacer con los casos no verificados."');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Construcción del JSON resumen
// ---------------------------------------------------------------------------
function buildSummary(ctx) {
  const { isoStamp, phase1, phase2, datasetCounts, smoke, unverifiedIds, mdPath, dry } = ctx;
  return {
    generatedAt: isoStamp,
    phase1,
    phase2: {
      status: phase2.status,
      processed: phase2.processed,
      verifiedImproved: phase2.verifiedImproved,
      unverified: phase2.unverified,
      requeued: phase2.requeued,
      audits: phase2.audits,
      cases: phase2.cases.map((entry) => ({ id: safeStr(entry?.id, null), status: safeStr(entry?.status, null) })),
    },
    datasets: { final: datasetCounts.final, enhanced: datasetCounts.enhanced, gold: datasetCounts.gold },
    smoke,
    unverifiedIds,
    artifacts: { report: rel(mdPath), brain: dry ? null : BRAIN_PATH },
  };
}

// ---------------------------------------------------------------------------
// Programación temporal (target = hoy 08:10 local)
// ---------------------------------------------------------------------------
function computeTarget(reference) {
  const target = new Date(reference.getTime());
  target.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
  return target;
}

async function waitUntilTarget(target) {
  let lastLogAt = 0;
  for (;;) {
    const nowMs = Date.now();
    const diff = target.getTime() - nowMs;
    if (diff <= 0) return;
    if (nowMs - lastLogAt >= WAIT_LOG_MS) {
      lastLogAt = nowMs;
      log(`Faltan ${Math.ceil(diff / 60000)} min para el target ${target.toISOString()} (esperando...).`);
    }
    await sleep(Math.min(WAIT_POLL_MS, diff));
  }
}

// ---------------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    log('=== Checkpoint 08:10 — entrenamiento nocturno de Tobi ===');
    log(`Modo: ${opts.dry ? 'DRY-RUN (rutas *_TEST)' : opts.now ? 'NOW (rutas reales)' : 'PROGRAMADO 08:10'}`);

    if (!opts.dry && !opts.now) {
      const target = computeTarget(new Date());
      if (target.getTime() > Date.now()) {
        log(`Target local de hoy: ${target.toLocaleString('es-PY')} (${target.toISOString()}).`);
        await waitUntilTarget(target);
      } else {
        log('El target de hoy 08:10 ya pasó: generando de inmediato.');
      }
    } else {
      log('Sin espera: flag CLI presente.');
    }

    log('Recolectando artefactos (defensivo)...');
    const phase1 = collectPhase1();
    const phase2 = collectPhase2();
    const categoryStats = collectCategoryStats();
    const topRules = collectTopRules();
    const smoke = collectSmoke();
    const datasetCounts = collectDatasetCounts();
    const unverifiedIds = collectUnverifiedIds(phase2);
    const artifactLines = collectArtifactLines();
    log(`Fase 1: ${phase1.status} · Fase 2: ${phase2.status} · sin verificar: ${unverifiedIds.length} · reglas candidatas: ${topRules.length}`);

    const now = new Date();
    const mdPath = path.join(REPORTS_DIR, opts.dry ? 'CHECKPOINT_0810_TEST.md' : 'CHECKPOINT_0810.md');
    const jsonPath = path.join(REPORTS_DIR, opts.dry ? 'CHECKPOINT_0810_TEST.json' : 'CHECKPOINT_0810.json');

    const ctx = {
      localStamp: now.toLocaleString('es-PY'),
      isoStamp: now.toISOString(),
      phase1,
      phase2,
      categoryStats,
      topRules,
      datasetCounts,
      smoke,
      unverifiedIds,
      artifactLines,
      mdPath,
      dry: opts.dry,
    };

    log('Construyendo Markdown y JSON de resumen...');
    const markdown = buildMarkdown(ctx);
    const summary = buildSummary(ctx);

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(mdPath, markdown, 'utf-8');
    log(`Markdown escrito: ${rel(mdPath)}`);
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
    log(`JSON escrito: ${rel(jsonPath)}`);

    if (opts.dry) {
      log('DRY-RUN: no se copia el Markdown al cerebro de opencode.');
    } else {
      fs.mkdirSync(path.dirname(BRAIN_PATH), { recursive: true });
      fs.copyFileSync(mdPath, BRAIN_PATH);
      log(`Markdown copiado al brain: ${BRAIN_PATH}`);
    }

    log('Checkpoint generado correctamente. Exit 0.');
    process.exit(0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR FATAL generando checkpoint: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  }
}

main();