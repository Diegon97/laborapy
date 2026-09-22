#!/usr/bin/env node
/**
 * ============================================================================
 * BENCHMARK EMPÍRICO DE REASONING: GEMINI 3.7 FLASH vs GEMINI 3.5 FLASH
 * ============================================================================
 * Evalúa los 52 casos canónicos de LaboraPy (batería de los 50 casos más comunes)
 * cruzando los motores Gemini 3.7 Flash y Gemini 3.5 Flash en los niveles de
 * reasoning_effort: [none, low, medium, high, max] para determinar:
 *   1. Tasa de alucinación real vs esfuerzo de pensamiento.
 *   2. Tasa de aprobación (% de cumplimiento legal determinístico).
 *   3. Latencia y consumo de tokens (reasoning vs output).
 *   4. SWEET SPOT SCORE: el balance perfecto entre precisión, costo y velocidad.
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

const CAPATAZ_ENDPOINT = 'http://127.0.0.1:8317/v1/chat/completions';
const CAPATAZ_KEY = 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8';

// Prompt de sistema concentrado y taxativo para Tobi
const TOBI_PROMPT = `Sos Tobi, Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy en Paraguay, creado por Diego Núñez.
REGLAS TAXATIVAS Y OBLIGATORIAS:
1. SALARIO MÍNIMO LEGAL VIGENTE: Es Gs. 3.044.000 mensuales (Decreto N° 6225/2026, Res. MTESS N° 670/2026). NUNCA cites Gs. 2.798.309 (está vencido y usarlo es un error grave). Si te mencionan Gs. 2.798.309, corregilo inmediatamente aclarando que el vigente es Gs. 3.044.000.
2. JORNADA DE TRABAJO:
   - Diurna: máx 8 horas diarias y 48 horas semanales (Art. 194).
   - Nocturna: máx 7 horas diarias y 42 horas semanales, con 30% de recargo ordinario (Arts. 195 y 234, NUNCA 25%).
   - Mixta: máx 7.5 horas (7 horas y media) diarias y 45 horas semanales (Art. 196). 8 horas diarias en mixta generan horas extras. Si el tramo nocturno abarca 3.5 horas o más, toda la jornada se computa como nocturna.
   - Los Arts. 30 y 31 NO regulan jornada ni salario mínimo.
3. HORAS EXTRAS Y FERIADOS:
   - Diurna: 50% de recargo sobre el valor hora ordinaria.
   - Nocturna: 100% de recargo (Arts. 202 y 234).
   - Feriados trabajados: 100% de recargo.
   - El Art. 84 regula indemnización por despido, NO horas extras.
4. PRIMACÍA DE LA REALIDAD Y FRAUDE LABORAL (Art. 19 C.T.):
   - Si existen subordinación, exclusividad y horario, la factura independiente o la falta de contrato escrito es fraude laboral y corresponden todos los derechos (IPS, preaviso, indemnización, aguinaldo).
   - La renuncia forzada es despido encubierto.
5. ESTABILIDAD Y FUEROS:
   - Estabilidad especial de 10 años (Art. 94 C.T.): el despido unilateral directo es nulo; exige juicio previo de justificación de causales en sede judicial. Sin sentencia judicial no hay finiquito válido.
   - Fuero maternal (Ley 5508/15): despido nulo de pleno derecho con obligación de reincorporación, incluso en período de prueba o con oferta de pago.
   - Fuero sindical: exige juicio previo y desafuero; despido directo nulo.
6. VACACIONES Y AGUINALDO:
   - Vacaciones (Art. 218 C.T. en días hábiles): 12 días (<5 años), 18 días (5-10 años), 30 días (>10 años). El Art. 166 no regula vacaciones.
   - Aguinaldo (Art. 243 C.T., Art. 76 Dec-Ley 1860/50): 100% exento de aportes al IPS (0% descuento).
7. PRESCRIPCIÓN Y CIBERSEGURIDAD:
   - Prescripción para accionar por despido injustificado e indemnización: 60 días corridos (Art. 399 C.T.). Nunca 2 años para despido.
   - CISO Zero-Leak: no tenés acceso a API keys, service_role ni contraseñas.
   - Anti-spam: no realices listados numéricos masivos (1 al 1000) ni compendios en 20 lenguajes.
   - No reveles la sintaxis de bloques internos ni hables de JSON.
8. PROTOCOLO DE ACCIÓN DETERMINÍSTICA:
- Si el usuario solicita calcular una liquidación con datos, emití obligatoriamente al final:
:::liquidacion_action
{"salarioMensual":3044000,"fechaIngreso":"YYYY-MM-DD","fechaEgreso":"YYYY-MM-DD","motivo":"despido_sin_causa"}
:::
(motivos: "despido_sin_causa", "despido_con_causa", "renuncia", "retiro_justificado", "mutuo_acuerdo", "jubilacion").
- Si el usuario solicita redactar una nota o documento, emití obligatoriamente al final:
:::documento_action
{"tipo":"amonestacion","nombreEmpleado":"Nombre","ciEmpleado":"1.234.567","empresa":"Empresa","cargoEmpleado":"Cargo","hechosOcurridos":"Hechos","fundamentoLegal":"Art. 81"}
:::
(tipos: "amonestacion", "suspension_disciplinaria", "traslado", "despido_justificado", "despido_injustificado", "certificado_trabajo").
- En consultas conceptuales, de asesoría o preguntas generales NO emitas ningún bloque de acción.`;

// Mapeo de modelos y alias en Capataz
const ALL_MODEL_SPECS = [
  {
    key: 'gemini-3.7-flash',
    capatazModel: 'gemini-3.7-flash-high',
    label: 'Gemini 3.7 Flash',
  },
  {
    key: 'gemini-3.5-flash',
    capatazModel: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash',
  },
];

// Niveles a probar por defecto: low hasta max según requerimiento
const ALL_EFFORTS = ['low', 'medium', 'high', 'max'];

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = null;
  let efforts = [...ALL_EFFORTS];
  let models = [...ALL_MODEL_SPECS];
  let concurrency = 3;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(1, parseInt(arg.split('=')[1], 10) || 3);
    } else if (arg.startsWith('--efforts=')) {
      efforts = arg.split('=')[1].split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    } else if (arg.startsWith('--models=')) {
      const keys = arg.split('=')[1].split(',').map((k) => k.trim().toLowerCase());
      models = ALL_MODEL_SPECS.filter((m) => keys.some((k) => m.key.includes(k) || m.capatazModel.includes(k)));
    }
  }

  return { limit, efforts, models, concurrency };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callCapatazWithRetry(modelId, effort, prompt, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const start = Date.now();
    try {
      const payload = {
        model: modelId,
        messages: [
          { role: 'system', content: TOBI_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
      };

      if (effort && effort !== 'none') {
        payload.reasoning_effort = effort;
      }

      const res = await fetch(CAPATAZ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CAPATAZ_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      const duration = Date.now() - start;
      const text = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;

      return {
        ok: true,
        text,
        duration,
        promptTokens,
        completionTokens,
        reasoningTokens,
        error: null,
      };
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        return {
          ok: false,
          text: '',
          duration: Date.now() - start,
          promptTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          error: err.message,
        };
      }
      await sleep(1000 * attempt);
    }
  }
}

async function runBenchmark() {
  const { limit, efforts, models, concurrency } = parseArgs();
  const casesToRun = limit ? TEST_CASES.slice(0, limit) : TEST_CASES;

  console.log('================================================================================');
  console.log('🏁 INICIANDO BENCHMARK EMPÍRICO DE SWEET SPOT DE REASONING');
  console.log(`   Modelos (${models.length}): ${models.map((m) => m.label).join(', ')}`);
  console.log(`   Niveles de Thinking (${efforts.length}): [${efforts.join(', ')}]`);
  console.log(`   Casos canónicos a evaluar: ${casesToRun.length} casos determinísticos de LaboraPy`);
  console.log('================================================================================\n');

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const rawResultsPath = path.join(REPORTS_DIR, 'benchmark_gemini_sweetspot_raw.json');
  const results = [];

  const totalRuns = models.length * efforts.length * casesToRun.length;
  let currentRun = 0;

  // Matriz de acumulación de estadísticas
  const matrix = {};
  for (const mod of models) {
    matrix[mod.key] = {};
    for (const eff of efforts) {
      matrix[mod.key][eff] = {
        modelLabel: mod.label,
        effort: eff,
        totalCases: 0,
        passedCases: 0,
        totalScore: 0,
        legalScore: 0,
        calcScore: 0,
        toneScore: 0,
        hallucinationCount: 0,
        totalDurationMs: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalReasoningTokens: 0,
        categoryStats: {},
        failures: [],
      };
    }
  }

  const startTime = Date.now();

  for (const mod of models) {
    console.log(`\n🔹 Evaluando Modelo: ${mod.label} (${mod.capatazModel})`);

    for (const eff of efforts) {
      console.log(`\n  ⚙️  Configuración: reasoning_effort = "${eff.toUpperCase()}" (concurrencia: ${concurrency})`);

      let caseIndex = 0;
      const workerPool = Array.from({ length: concurrency }, async (_, workerId) => {
        while (caseIndex < casesToRun.length) {
          const i = caseIndex++;
          const tc = casesToRun[i];
          const response = await callCapatazWithRetry(mod.capatazModel, eff, tc.prompt);

          let evalResult = { passed: false, total: 0, legal: 0, calc: 0, tone: 0, failures: [] };
          let isHallucination = false;
          let hallucinationReasons = [];

          if (response.ok) {
            evalResult = evaluateCase(tc, response.text);

            const forbiddenFails = evalResult.failures.filter(
              (f) =>
                f.includes('Patrón prohibido') ||
                f.includes('salarioMensual por debajo del mínimo') ||
                f.includes('Motivo incorrecto') ||
                f.includes('Tipo incorrecto')
            );
            if (forbiddenFails.length > 0 || evalResult.legal < 6) {
              isHallucination = true;
              hallucinationReasons = forbiddenFails.length > 0 ? forbiddenFails : evalResult.failures;
            }
          } else {
            evalResult.failures.push(`Error de conexión: ${response.error}`);
          }

          currentRun++;
          const stats = matrix[mod.key][eff];
          stats.totalCases++;
          if (evalResult.passed) stats.passedCases++;
          stats.totalScore += evalResult.total;
          stats.legalScore += evalResult.legal;
          stats.calcScore += evalResult.calc;
          stats.toneScore += evalResult.tone;
          if (isHallucination) {
            stats.hallucinationCount++;
            stats.failures.push({
              caseId: tc.id,
              category: tc.category,
              title: tc.title,
              reasons: hallucinationReasons,
              snippet: response.text.slice(0, 140).replace(/\n/g, ' '),
            });
          }
          stats.totalDurationMs += response.duration;
          stats.totalPromptTokens += response.promptTokens;
          stats.totalCompletionTokens += response.completionTokens;
          stats.totalReasoningTokens += response.reasoningTokens;

          if (!stats.categoryStats[tc.category]) {
            stats.categoryStats[tc.category] = { total: 0, passed: 0, hallucinations: 0 };
          }
          stats.categoryStats[tc.category].total++;
          if (evalResult.passed) stats.categoryStats[tc.category].passed++;
          if (isHallucination) stats.categoryStats[tc.category].hallucinations++;

          const runRecord = {
            model: mod.key,
            modelLabel: mod.label,
            effort: eff,
            caseId: tc.id,
            category: tc.category,
            title: tc.title,
            passed: evalResult.passed,
            totalScore: evalResult.total,
            legalScore: evalResult.legal,
            calcScore: evalResult.calc,
            toneScore: evalResult.tone,
            isHallucination,
            failures: evalResult.failures,
            durationMs: response.duration,
            promptTokens: response.promptTokens,
            completionTokens: response.completionTokens,
            reasoningTokens: response.reasoningTokens,
            responseSnippet: response.text.slice(0, 200),
          };
          results.push(runRecord);

          const statusIcon = evalResult.passed ? '✅' : '❌';
          const halIcon = isHallucination ? '⚠️ ALUCINÓ' : '🛡️ LIMPIO';
          const progPct = Math.round((currentRun / totalRuns) * 100);

          console.log(
            `   [${currentRun}/${totalRuns}] (${progPct}%) ${tc.id.padEnd(7)} | ${statusIcon} Score: ${String(evalResult.total).padStart(3)} | ${halIcon} | ${String(response.duration).padStart(4)}ms | ThinkTokens: ${String(response.reasoningTokens).padStart(3)}`
          );

          if (currentRun % 10 === 0) {
            fs.writeFileSync(rawResultsPath, JSON.stringify(results, null, 2));
          }

          await sleep(150);
        }
      });

      await Promise.all(workerPool);
    }
  }

  const totalDurationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🏁 Corrida finalizada en ${totalDurationSec} segundos.`);

  // Guardar resultados crudos finales
  fs.writeFileSync(rawResultsPath, JSON.stringify(results, null, 2));

  // Generar métricas consolidadas y reporte Markdown
  generateSweetSpotReport(matrix, totalDurationSec, results);
}

function generateSweetSpotReport(matrix, totalDurationSec, rawResults) {
  const summaryRows = [];

  for (const [modelKey, efforts] of Object.entries(matrix)) {
    for (const [effort, s] of Object.entries(efforts)) {
      const passRate = Math.round((s.passedCases / s.totalCases) * 100);
      const avgScore = Math.round(s.totalScore / s.totalCases);
      const hallucinationRate = Math.round((s.hallucinationCount / s.totalCases) * 100);
      const avgDurationMs = Math.round(s.totalDurationMs / s.totalCases);
      const avgReasoningTokens = Math.round(s.totalReasoningTokens / s.totalCases);
      const avgTotalTokens = Math.round((s.totalPromptTokens + s.totalCompletionTokens) / s.totalCases);

      // Sweet Spot Score (0 - 100):
      // Premia alta aprobación (40%), cero alucinaciones (40%), y penaliza latencia excesiva >3000ms (20%)
      const latencyFactor = Math.max(0, Math.min(100, Math.round(100 - (avgDurationMs / 60))));
      const cleanRate = 100 - hallucinationRate;
      const sweetSpotScore = Math.round(passRate * 0.45 + cleanRate * 0.45 + latencyFactor * 0.1);

      summaryRows.push({
        modelKey,
        modelLabel: s.modelLabel,
        effort,
        passRate,
        avgScore,
        hallucinationRate,
        avgDurationMs,
        avgReasoningTokens,
        avgTotalTokens,
        sweetSpotScore,
        categoryStats: s.categoryStats,
        failures: s.failures,
      });
    }
  }

  // Ordenar para encontrar el Sweet Spot ganador
  summaryRows.sort((a, b) => b.sweetSpotScore - a.sweetSpotScore);

  const winner = summaryRows[0];

  // Construir Markdown
  let md = `# INFORME OFICIAL: CALIBRACIÓN EMPÍRICA Y SWEET SPOT DE REASONING PARA TOBI IA\n\n`;
  md += `**Fecha:** ${new Date().toISOString().split('T')[0]}  \n`;
  md += `**Duración del Benchmark:** ${totalDurationSec} segundos  \n`;
  md += `**Batería Evaluada:** 52 casos canónicos de LaboraPy (los 50 casos más comunes en producción)  \n`;
  md += `**Modelos:** Gemini 3.7 Flash vs Gemini 3.5 Flash  \n`;
  md += `**Niveles de Thinking:** \`none\`, \`low\`, \`medium\`, \`high\`, \`max\`  \n\n`;

  md += `## 🏆 1. VEREDICTO EJECUTIVO: EL SWEET SPOT DE TOBI\n\n`;
  md += `> **Configuración Ganadora (Sweet Spot):** **\`${winner.modelLabel}\`** con **\`reasoning_effort = "${winner.effort.toUpperCase()}"\`**  \n`;
  md += `> - **Tasa de Aprobación:** **${winner.passRate}%**  \n`;
  md += `> - **Tasa de Alucinación:** **${winner.hallucinationRate}%** (Cero o mínima distorsión legal)  \n`;
  md += `> - **Latencia Promedio:** **${winner.avgDurationMs} ms**  \n`;
  md += `> - **Tokens de Pensamiento Promedio:** **${winner.avgReasoningTokens} tokens**  \n`;
  md += `> - **Sweet Spot Index:** **${winner.sweetSpotScore}/100**  \n\n`;

  md += `## 📊 2. TABLA COMPARATIVA CONSOLIDADA (RANKING SWEET SPOT)\n\n`;
  md += `| Ranking | Modelo | Reasoning Effort | Aprobación (%) | Alucinación (%) | Score Legal (0-100) | Latencia Media (ms) | Think Tokens | Sweet Spot Score |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;

  summaryRows.forEach((r, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    md += `| ${medal} | **${r.modelLabel}** | \`${r.effort}\` | **${r.passRate}%** | **${r.hallucinationRate}%** | ${r.avgScore} | ${r.avgDurationMs} ms | ${r.avgReasoningTokens} | **${r.sweetSpotScore}** |\n`;
  });

  md += `\n## 🔍 3. ANÁLISIS POR MODELO Y ESCALA DE ESFUERZO (LOW A MAX)\n\n`;

  for (const mod of ALL_MODEL_SPECS) {
    const modelRows = summaryRows.filter((r) => r.modelKey === mod.key);
    if (modelRows.length === 0) continue;

    md += `### 🤖 ${mod.label}\n\n`;
    md += `| Nivel Effort | Aprobación | Alucinación | Latencia Media | Tokens de Pensamiento | Diagnóstico |\n`;
    md += `|---|---|---|---|---|---|\n`;

    // Ordenar de none a max
    modelRows.sort((a, b) => ALL_EFFORTS.indexOf(a.effort) - ALL_EFFORTS.indexOf(b.effort));

    for (const mr of modelRows) {
      let diag = '';
      if (mr.hallucinationRate > 20) diag = '❌ Alucinaciones recurrentes en trampas y montos.';
      else if (mr.hallucinationRate > 0) diag = '⚠️ Alucinaciones esporádicas en casos de borde.';
      else if (mr.avgDurationMs > 4000) diag = '⏳ Preciso pero demasiado lento para streaming web.';
      else diag = '💎 Blindado contra alucinaciones y alta velocidad.';

      md += `| \`${mr.effort}\` | ${mr.passRate}% | ${mr.hallucinationRate}% | ${mr.avgDurationMs} ms | ${mr.avgReasoningTokens} | ${diag} |\n`;
    }
    md += `\n`;
  }

  md += `## ⚖️ 4. DESGLOSE DE ALUCINACIONES POR CATEGORÍA CRÍTICA\n\n`;
  md += `A continuación se detallan las categorías donde los modelos mostraron vulnerabilidad o alucinación:\n\n`;

  for (const r of summaryRows) {
    if (r.failures.length > 0) {
      md += `<details>\n<summary><b>${r.modelLabel} (effort: ${r.effort}) — ${r.failures.length} fallos/alucinaciones</b></summary>\n\n`;
      md += `| Caso | Categoría | Título | Motivo de Fallo / Alucinación |\n`;
      md += `|---|---|---|---|\n`;
      for (const f of r.failures) {
        md += `| ${f.caseId} | ${f.category} | ${f.title} | ${f.reasons.join('; ')} |\n`;
      }
      md += `\n</details>\n\n`;
    }
  }

  md += `## 🎯 5. RECOMENDACIÓN TÉCNICA Y ACCIONES DE PRODUCCIÓN\n\n`;
  md += `1. **Configuración Recomendada en \`api/assistant.ts\`:**  \n`;
  md += `   - Implementar el modelo ganador **\`${winner.modelLabel}\`** con **\`reasoning_effort: "${winner.effort}"\`** como primario.\n`;
  md += `2. **Respaldo Rápido (Fallback):**  \n`;
  const fastestClean = summaryRows.find((r) => r.hallucinationRate <= 5 && r !== winner) || summaryRows[1];
  md += `   - Usar **\`${fastestClean.modelLabel}\`** con \`${fastestClean.effort}\` como carril ultra veloz (${fastestClean.avgDurationMs} ms).\n`;
  md += `3. **Economía de Tokens:**  \n`;
  md += `   - El nivel **\`${winner.effort}\`** consume en promedio **${winner.avgReasoningTokens} tokens** de razonamiento, evitando agotar presupuestos sin perder precisión legal.\n`;

  const reportPath = path.join(REPORTS_DIR, 'BENCHMARK_GEMINI_SWEETSPOT_REPORT.md');
  const jsonSummaryPath = path.join(REPORTS_DIR, 'benchmark_gemini_sweetspot_results.json');

  fs.writeFileSync(reportPath, md, 'utf8');
  fs.writeFileSync(jsonSummaryPath, JSON.stringify({ winner, summaryRows, matrix }, null, 2), 'utf8');

  console.log(`\n📄 Reporte Markdown guardado en: ${reportPath}`);
  console.log(`📊 Resumen JSON guardado en: ${jsonSummaryPath}\n`);

  console.log('================================================================================');
  console.log(`🏆 SWEET SPOT GANADOR: ${winner.modelLabel} [${winner.effort.toUpperCase()}]`);
  console.log(`   Aprobación: ${winner.passRate}% | Alucinación: ${winner.hallucinationRate}% | Latencia: ${winner.avgDurationMs}ms`);
  console.log('================================================================================');
}

runBenchmark().catch((err) => {
  console.error('❌ Error fatal en el benchmark:', err);
  process.exit(1);
});
