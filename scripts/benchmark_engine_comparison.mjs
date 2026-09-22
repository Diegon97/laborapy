#!/usr/bin/env node
/**
 * ============================================================================
 * BENCHMARK MULTI-ENGINE: GEMINI vs CLOUDFLARE 70B vs DEEPSEEK R1 vs GROQ
 * ============================================================================
 * Evalúa los casos canónicos de LaboraPy en los 4 motores para medir:
 *   1. Latencia real (ms)
 *   2. Tasa de aprobación (% de cumplimiento legal)
 *   3. Detección de alucinaciones (salario mínimo vencido, leyes inexistentes)
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { TEST_CASES } from './lib/tobi_night_core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const CF_ACCOUNT_ID = (process.env.CF_ACCOUNT_ID || '').trim();
const CF_API_TOKEN = (process.env.CF_API_TOKEN || '').trim();
const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const CAPATAZ_KEY = 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8';

// System prompt simplificado y concentrado para no saturar tokens por minuto
const TOBI_MINI_PROMPT = `Sos Tobi, el Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy en Paraguay, creado por Diego Núñez.
REGLAS TAXATIVAS:
1. El salario mínimo legal vigente es Gs. 3.044.000 (Decreto 6225/2026, Res. MTESS 670/2026). NUNCA cites Gs. 2.798.309 (está vencido).
2. Jornada diurna: máx 8h/48h (Art. 194). Jornada nocturna: máx 7h/42h + 30% recargo (Art. 195 y 234, NUNCA 25%). Jornada mixta: máx 7.5h/45h semanales (Art. 196).
3. Horas extras: 50% diurna, 100% nocturna y feriados.
4. Vacaciones (Art. 218): 12 días (<5 años), 18 días (5-10 años), 30 días (>10 años). Días hábiles.
5. Aguinaldo (Art. 243 C.T., Art. 76 Dec-Ley 1860/50): 100% EXENTO de aportes al IPS (0% descuento).
6. Estabilidad de 10 años (Art. 94 C.T.): despido directo nulo; exige juicio previo de justificación de causales.
7. Primacía de la Realidad (Art. 19 C.T.): si hay subordinación y horario, la factura es fraude laboral y corresponden todos los beneficios.
8. Prescripción para accionar por despido: 60 días corridos (Art. 399 C.T.).`;

// Seleccionamos 10 casos nucleares de alta exigencia legal
const BENCHMARK_CASES = TEST_CASES.filter((tc) =>
  ['SMV-01', 'SMV-02', 'JOR-01', 'JOR-02', 'JOR-03',
   'FRA-01', 'FRA-02', 'EST-01', 'HEX-01', 'SEC-03'].includes(tc.id)
);

async function callEngine(engine, prompt) {
  const start = Date.now();
  let text = '';
  let error = null;

  try {
    if (engine === 'gemini') {
      const res = await fetch('http://127.0.0.1:8317/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CAPATAZ_KEY}` },
        body: JSON.stringify({
          model: 'gemini-3.8-flash-high',
          messages: [
            { role: 'system', content: TOBI_MINI_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
          temperature: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || '';
    } else if (engine === 'cloudflare-70b') {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-70b-instruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CF_API_TOKEN}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: TOBI_MINI_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      text = data.result?.response || '';
    } else if (engine === 'deepseek-r1') {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CF_API_TOKEN}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: TOBI_MINI_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      text = data.result?.response || '';
    } else if (engine === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: TOBI_MINI_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
          temperature: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || '';
    }
  } catch (err) {
    error = err.message;
  }

  const duration = Date.now() - start;
  return { text, duration, error };
}

function evaluate(testCase, responseText) {
  if (!responseText) return { passed: false, score: 0, reason: 'Sin respuesta' };

  for (const f of testCase.forbidden || []) {
    if (f.test(responseText)) {
      return { passed: false, score: 0, reason: `Contiene patrón prohibido: ${f}` };
    }
  }

  let matches = 0;
  const required = testCase.required || [];
  for (const r of required) {
    if (r.test(responseText)) matches++;
  }

  const score = required.length > 0 ? Math.round((matches / required.length) * 100) : 100;
  const passed = score >= 70;
  return { passed, score, reason: passed ? 'Aprobado' : `Faltan requisitos (${matches}/${required.length})` };
}

async function main() {
  console.log('========================================================================');
  console.log('🏁 INICIANDO BENCHMARK MULTI-ENGINE LABORAPY');
  console.log(`🎯 Casos a evaluar: ${BENCHMARK_CASES.length} casos canónicos`);
  console.log('Engines: 1) Gemini 3.8 Flash, 2) Cloudflare 70B, 3) DeepSeek R1, 4) Groq');
  console.log('========================================================================\n');

  const stats = {
    gemini: { passed: 0, total: 0, totalMs: 0, scores: [] },
    'cloudflare-70b': { passed: 0, total: 0, totalMs: 0, scores: [] },
    'deepseek-r1': { passed: 0, total: 0, totalMs: 0, scores: [] },
    groq: { passed: 0, total: 0, totalMs: 0, scores: [] },
  };

  const resultsTable = [];

  for (let i = 0; i < BENCHMARK_CASES.length; i++) {
    const tc = BENCHMARK_CASES[i];
    console.log(`[${i + 1}/${BENCHMARK_CASES.length}] Evaluando ${tc.id}: "${tc.title}" en paralelo...`);

    const row = { id: tc.id, title: tc.title };

    const engines = ['gemini', 'groq', 'cloudflare-70b', 'deepseek-r1'];
    const responses = await Promise.all(
      engines.map(async (engine) => {
        const res = await callEngine(engine, tc.prompt);
        const ev = evaluate(tc, res.text);
        return { engine, res, ev };
      })
    );

    for (const { engine, res, ev } of responses) {
      stats[engine].total++;
      stats[engine].totalMs += res.duration;
      stats[engine].scores.push(ev.score);
      if (ev.passed) stats[engine].passed++;

      row[`${engine}_ms`] = res.duration;
      row[`${engine}_score`] = ev.score;
      row[`${engine}_status`] = ev.passed ? '✓' : '✗';
    }

    resultsTable.push(row);
  }

  console.log('\n========================================================================');
  console.log('📊 RESULTADOS CONSOLIDADOS DEL BENCHMARK');
  console.log('========================================================================\n');

  console.table(
    Object.entries(stats).map(([engine, s]) => ({
      Motor: engine.toUpperCase(),
      'Tasa Aprobación': `${Math.round((s.passed / s.total) * 100)}% (${s.passed}/${s.total})`,
      'Score Promedio': `${Math.round(s.scores.reduce((a, b) => a + b, 0) / s.total)}/100`,
      'Latencia Promedio': `${Math.round(s.totalMs / s.total)} ms`,
      'Veredicto':
        s.passed / s.total >= 0.85
          ? '🥇 Grado Pericial de Élite'
          : s.passed / s.total >= 0.7
          ? '🥈 Aceptable'
          : '🥉 Riesgo de Alucinación',
    }))
  );

  console.log('\nDetalle por caso (resumen):');
  console.table(
    resultsTable.map((r) => ({
      ID: r.id,
      Título: r.title.slice(0, 26),
      Gemini: `${r.gemini_status} (${r.gemini_ms}ms)`,
      Groq: `${r.groq_status} (${r.groq_ms}ms)`,
      'CF-70B': `${r['cloudflare-70b_status']} (${r['cloudflare-70b_ms']}ms)`,
      'DeepSeek-R1': `${r['deepseek-r1_status']} (${r['deepseek-r1_ms']}ms)`,
    }))
  );
}

main().catch(console.error);
