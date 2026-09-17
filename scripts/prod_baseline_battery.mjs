#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — BASELINE DE CALIDAD Y SUITE DE REGRESIÓN CONTRA PRODUCCIÓN
 * ============================================================================
 * FORMATO SSE REAL DEL ENDPOINT (api/assistant.ts → writeSseEvent):
 *   `data: <JSON>\n\n` con eventos:
 *     { "type": "delta",    "text": "..." }                     (acumular en orden)
 *     { "type": "done",     "provider": "...", "model": "..." }
 *     { "type": "fallback", "reason": "..." }
 *   El stream arranca con una línea de relleno `: <espacios>` (comentario SSE)
 *   que el parser ignora por no empezar con `data:`.
 *
 * Uso:
 *   node scripts/prod_baseline_battery.mjs [opciones]
 * Opciones:
 *   --limit=N        Procesa solo los primeros N casos.
 *   --only=ID1,ID2   Filtra por IDs exactos (separados por coma).
 *   --pause-ms=N     Pausa en ms entre casos (default: 4000).
 *   --help, -h       Muestra esta ayuda y termina.
 * Exit codes:
 *   0  La corrida completó y TODOS los casos evaluados aprobaron.
 *   1  La corrida completó con reprobaciones o errores controlados.
 *   2  Fallo sistémico: más de la mitad sin evaluar o sin casos.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CASES, evaluateCase } from './lib/tobi_night_core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const API_ENDPOINT = 'https://calculadora-rrhh-py.vercel.app/api/assistant';
const CASE_TIMEOUT_MS = 90_000;
const DEFAULT_PAUSE_MS = 4000;
const MAX_ERROR_CHARS = 120;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function printHelp() { console.log(`\nUso: node scripts/prod_baseline_battery.mjs [opciones]\n\nOpciones:\n  --limit=N       Procesa solo los primeros N casos.\n  --only=ID1,ID2  Filtra por IDs exactos.\n  --pause-ms=N    Pausa entre casos (default: 4000ms).\n  --help, -h      Muestra esta ayuda.\n\nExit codes: 0 = todo aprobado · 1 = reprobaciones/errores controlados · 2 = fallo sistémico.\n`); }

function parseCliArgs() {
  const rawArgs = process.argv.slice(2);
  let limit = null, only = null, pauseMs = DEFAULT_PAUSE_MS, casesPath = null;
  for (const arg of rawArgs) {
    if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    const casesMatch = arg.match(/^--cases=(.+)$/);
    if (casesMatch) { casesPath = casesMatch[1].trim(); continue; }
    const limitMatch = arg.match(/^--limit=(\d+)$/);
    if (limitMatch) { limit = parseInt(limitMatch[1], 10); continue; }
    const onlyMatch = arg.match(/^--only=(.+)$/);
    if (onlyMatch) { only = onlyMatch[1].split(',').map((id) => id.trim()).filter(Boolean); continue; }
    const pauseMatch = arg.match(/^--pause-ms=(\d+)$/);
    if (pauseMatch) { pauseMs = parseInt(pauseMatch[1], 10); continue; }
    if (arg.startsWith('--')) console.warn(`⚠️ Flag desconocido ignorado: ${arg}`);
  }
  return { limit, only, pauseMs, casesPath };
}

function parseRegexRules(rawRules, caseId, fieldName) {
  if (!rawRules) return [];
  const list = Array.isArray(rawRules) ? rawRules : [rawRules];
  const result = [];
  for (const item of list) {
    let source = null;
    if (typeof item === 'string') {
      source = item;
    } else if (item && typeof item === 'object' && typeof item.source === 'string') {
      source = item.source;
    }
    if (!source) {
      console.warn(`⚠️ [${caseId}] Patrón inválido o vacío en '${fieldName}', se omite.`);
      continue;
    }
    try {
      result.push(new RegExp(source, 'i'));
    } catch (err) {
      console.warn(`⚠️ [${caseId}] RegExp inválida en '${fieldName}' (${source}): ${err && err.message ? err.message : String(err)}`);
    }
  }
  return result;
}

function prepareTestCases(only, limit, casesPath) {
  let cases = [];
  if (casesPath) {
    const resolvedPath = path.isAbsolute(casesPath) ? casesPath : path.resolve(casesPath);
    let rawContent;
    try {
      rawContent = fs.readFileSync(resolvedPath, 'utf8');
    } catch (err) {
      console.error(`❌ No se pudo leer --cases=${casesPath}: ${err && err.message ? err.message : String(err)}`);
      process.exit(2);
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      console.error(`❌ No se pudo leer --cases=${casesPath}: ${err && err.message ? err.message : String(err)}`);
      process.exit(2);
    }
    const rawList = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.cases) ? parsed.cases : null);
    if (!rawList) {
      console.error(`❌ No se pudo leer --cases=${casesPath}: el contenido no es un array ni contiene 'cases'.`);
      process.exit(2);
    }

    const mapped = [];
    for (const c of rawList) {
      if (!c || typeof c !== 'object') {
        console.warn('⚠️ Caso externo inválido (no es objeto), omitido.');
        continue;
      }
      if (!c.id || !c.prompt) {
        console.warn(`⚠️ Caso descartado por faltar 'id' o 'prompt': ${JSON.stringify(c).slice(0, 80)}`);
        continue;
      }
      const required = parseRegexRules(c.required ?? c.requiredRegex, c.id, 'required');
      if (required.length === 0) {
        console.warn(`⚠️ Caso '${c.id}' descartado: no tiene patrones 'required' válidos.`);
        continue;
      }
      const forbidden = parseRegexRules(c.forbidden ?? c.forbiddenRegex, c.id, 'forbidden');
      mapped.push({
        ...c,
        id: String(c.id).trim(),
        prompt: String(c.prompt),
        category: c.category ? String(c.category).trim() : '',
        title: c.title ? String(c.title).trim() : '',
        required,
        forbidden,
      });
    }
    console.log(`📂 Casos externos cargados: ${mapped.length} desde ${casesPath}`);
    cases = mapped;
  } else {
    cases = [...TEST_CASES];
  }

  if (Array.isArray(only) && only.length > 0) {
    const availableMap = new Map(cases.map((c) => [c.id, c]));
    const selected = [];
    for (const id of only) {
      if (availableMap.has(id)) selected.push(availableMap.get(id));
      else console.warn(`⚠️ Caso '${id}' no existe en la batería de pruebas.`);
    }
    cases = selected;
  }
  if (typeof limit === 'number' && limit > 0) cases = cases.slice(0, limit);
  return cases;
}

async function queryProdEndpoint(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASE_TIMEOUT_MS);
  try {
    const res = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: controller.signal });

    if (!res.ok) {
      try { await res.body?.cancel(); } catch {}
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText || 'Error'}`.slice(0, MAX_ERROR_CHARS), answer: '', provider: 'unknown' };
    }
    if (!res.body) {
      return { ok: false, error: 'stream sin body', answer: '', provider: 'unknown' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let provider = 'unknown';

    const consumeLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      let evt = null;
      try { evt = JSON.parse(payload); } catch { return; }
      if (evt && evt.type === 'delta' && typeof evt.text === 'string') {
        answer += evt.text;
      } else if (evt && evt.type === 'done') {
        provider = `${evt.provider || 'unknown'}/${evt.model || 'unknown'}`;
      } else if (evt && evt.type === 'fallback') {
        provider = `fallback (${evt.reason || 'sin detalle'})`;
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) consumeLine(rawLine);
    }

    buffer += decoder.decode();
    for (const rawLine of buffer.split('\n')) consumeLine(rawLine);

    if (!answer.trim()) {
      return { ok: false, error: 'stream sin deltas (respuesta vacía)', answer: '', provider };
    }
    return { ok: true, error: null, answer: answer.trim(), provider };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: `TIMEOUT (${Math.round(CASE_TIMEOUT_MS / 1000)}s excedido)`, answer: '', provider: 'timeout' };
    }
    return { ok: false, error: (err && err.message ? err.message : 'error de red').slice(0, MAX_ERROR_CHARS), answer: '', provider: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

async function runBaseline(cases, pauseMs) {
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    console.log(`[${i + 1}/${cases.length}] ${testCase.id} — ${testCase.title}`);
    const attempt = await queryProdEndpoint(testCase.prompt);
    const entry = {
      id: testCase.id,
      category: testCase.category,
      title: testCase.title,
      called: true,
      requestOk: attempt.ok,
      provider: attempt.provider,
      score: null,
      passed: false,
      error: null,
      responseChars: attempt.answer ? attempt.answer.length : 0,
      evaluation: null,
    };

    if (!attempt.ok) {
      entry.error = attempt.error;
      console.log(`    ❌ Llamada fallida: ${attempt.error}`);
    } else {
      let evaluation = null;
      let evaluatorError = null;
      try {
        evaluation = evaluateCase(testCase, attempt.answer);
      } catch (err) {
        evaluatorError = `Evaluador: ${(err && err.message ? err.message : String(err)).slice(0, MAX_ERROR_CHARS)}`;
      }
      if (evaluatorError) {
        entry.error = evaluatorError;
        console.log(`    ⚠️ ${evaluatorError}`);
      } else {
        entry.score = evaluation.total;
        entry.passed = evaluation.passed === true;
        entry.evaluation = evaluation;
        console.log(`    ${entry.passed ? '✅' : '⚠️'} ${entry.score}/100 [${attempt.provider}]`);
        if (!entry.passed && Array.isArray(evaluation.failures) && evaluation.failures.length > 0) {
          console.log(`       Fallas: ${evaluation.failures.join('; ')}`);
        }
      }
    }

    results.push(entry);
    if (pauseMs > 0 && i < cases.length - 1) await sleep(pauseMs);
  }
  return results;
}

function buildSummary(results) {
  const total = results.length;
  const evaluated = results.filter((r) => typeof r.score === 'number');
  const passed = evaluated.filter((r) => r.passed === true).length;
  const failedCalls = results.filter((r) => r.requestOk === false).length;
  const evaluatorErrors = results.filter((r) => r.requestOk === true && r.score === null).length;
  const avgScore = evaluated.length > 0
    ? Math.round((evaluated.reduce((acc, r) => acc + r.score, 0) / evaluated.length) * 10) / 10
    : null;
  const passRate = evaluated.length > 0 ? Math.round((passed / evaluated.length) * 1000) / 10 : null;
  return { total, evaluated: evaluated.length, passed, failed: evaluated.length - passed, failedCalls, evaluatorErrors, avgScore, passRate };
}

function printSummary(summary, results) {
  console.log('\n================================================================');
  console.log('📊 RESUMEN DEL BASELINE DE PRODUCCIÓN — TOBI RRHH');
  console.log(`Casos ejecutados: ${summary.total}`);
  console.log(`Casos evaluados: ${summary.evaluated}`);
  console.log(`Aprobados: ${summary.passed} · Reprobados: ${summary.failed}`);
  console.log(`Fallos de llamada: ${summary.failedCalls} · Errores del evaluador: ${summary.evaluatorErrors}`);
  console.log(`Puntaje promedio: ${summary.avgScore === null ? 'N/A' : `${summary.avgScore}/100`}`);
  console.log(`Tasa de aprobación: ${summary.passRate === null ? 'N/A' : `${summary.passRate}%`}`);
  console.log('================================================================');
  const worst = results.filter((r) => r.score !== null).sort((a, b) => a.score - b.score).slice(0, 5);
  if (worst.length > 0) {
    console.log('🔻 Peores casos:');
    for (const c of worst) console.log(`   ${c.id} — ${c.score}/100 — ${c.title}`);
  }
}

function computeExitCode(summary, total) {
  const notEvaluated = summary.failedCalls + summary.evaluatorErrors;
  if (total === 0 || notEvaluated > total / 2) return 2;
  if (summary.evaluated === summary.total && summary.passed === summary.total) return 0;
  return 1;
}

function buildReportMarkdown(report) {
  const { summary, cases } = report;
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
  const lines = [];
  lines.push(`# BASELINE DE PRODUCCIÓN — TOBI RRHH — ${report.generatedAt}`);
  lines.push('');
  lines.push('## 1. Resumen');
  lines.push(`- **Endpoint**: ${report.endpoint}`);
  lines.push(`- **Duración**: ${Math.round(report.durationMs / 1000)}s`);
  lines.push(`- **Casos totales**: ${summary.total}`);
  lines.push(`- **Casos evaluados**: ${summary.evaluated}`);
  lines.push(`- **Aprobados**: ${summary.passed}`);
  lines.push(`- **Reprobados**: ${summary.failed}`);
  lines.push(`- **Fallos de llamada**: ${summary.failedCalls}`);
  lines.push(`- **Errores del evaluador**: ${summary.evaluatorErrors}`);
  lines.push(`- **Puntaje promedio**: ${summary.avgScore === null ? 'N/A' : `${summary.avgScore}/100`}`);
  lines.push(`- **Tasa de aprobación**: ${summary.passRate === null ? 'N/A' : `${summary.passRate}%`}`);
  lines.push('');
  lines.push('## 2. Detalle por caso');
  lines.push('| ID | Categoría | Estado | Score | Provider | Error |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const c of cases) {
    const estado = c.passed ? '✅ APROBADO' : (c.score === null ? '⛔ SIN EVALUAR' : '⚠️ REPROBADO');
    const score = c.score === null ? 'N/A' : `${c.score}/100`;
    lines.push(`| ${c.id} | ${esc(c.category)} | ${estado} | ${score} | ${esc(c.provider || 'N/A')} | ${esc(c.error)} |`);
  }
  lines.push('');
  lines.push('## 3. Fallas detectadas por caso');
  const withFailures = cases.filter((c) => c.evaluation && Array.isArray(c.evaluation.failures) && c.evaluation.failures.length > 0);
  if (withFailures.length === 0) {
    lines.push('- (Ninguna)');
  } else {
    for (const c of withFailures) {
      lines.push(`- **${c.id}** (${c.title}): ${c.evaluation.failures.join('; ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const { limit, only, pauseMs, casesPath } = parseCliArgs();
  const cases = prepareTestCases(only, limit, casesPath);

  if (cases.length === 0) {
    console.error('⛔ No hay casos para ejecutar (revisá --only / --limit).');
    process.exit(2);
  }

  console.log('================================================================');
  console.log('🧪 TOBI RRHH — BASELINE DE CALIDAD CONTRA PRODUCCIÓN');
  console.log(`🌐 Endpoint: ${API_ENDPOINT}`);
  if (casesPath) {
    console.log(`🎯 Casos seleccionados: ${cases.length} / ${cases.length} (externos)`);
  } else {
    console.log(`🎯 Casos seleccionados: ${cases.length} / ${TEST_CASES.length}`);
  }
  console.log(`⏱️  Timeout por caso: ${Math.round(CASE_TIMEOUT_MS / 1000)}s · Pausa: ${pauseMs}ms`);
  console.log('================================================================\n');

  const startedAt = Date.now();
  const results = await runBaseline(cases, pauseMs);
  const summary = buildSummary(results);
  const report = { generatedAt: new Date().toISOString(), endpoint: API_ENDPOINT, durationMs: Date.now() - startedAt, options: { limit, only, pauseMs, casesPath }, summary, cases: results };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(REPORTS_DIR, `prod_baseline_${stamp}.json`);
  const mdPath = path.join(REPORTS_DIR, `prod_baseline_${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildReportMarkdown(report), 'utf8');

  printSummary(summary, results);
  console.log(`📄 Reporte JSON: ${jsonPath}`);
  console.log(`📝 Reporte MD:   ${mdPath}`);
  console.log(`🚦 Exit code: ${computeExitCode(summary, results.length)}`);

  process.exitCode = computeExitCode(summary, results.length);
}

await main();
