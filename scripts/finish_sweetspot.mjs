import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CASES, evaluateCase } from './lib/tobi_night_core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const rawPath = path.join(REPORTS_DIR, 'benchmark_gemini_sweetspot_raw.json');

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

const CAPATAZ_ENDPOINT = 'http://127.0.0.1:8317/v1/chat/completions';
const CAPATAZ_KEY = 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8';

// Identificar casos faltantes
const ranIds = new Set(raw.filter(r => r.model === 'gemini-3.5-flash' && r.effort === 'max').map(r => r.caseId));
const missing = TEST_CASES.filter(c => !ranIds.has(c.id));
console.log('Casos faltantes para gemini-3.5-flash max:', missing.map(m => m.id));

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
- Si el usuario solicita redactar una nota o documento, emití obligatoriamente al final:
:::documento_action
{"tipo":"amonestacion","nombreEmpleado":"Nombre","ciEmpleado":"1.234.567","empresa":"Empresa","cargoEmpleado":"Cargo","hechosOcurridos":"Hechos","fundamentoLegal":"Art. 81"}
:::
- En consultas conceptuales, de asesoría o preguntas generales NO emitas ningún bloque de acción.`;

async function finishMissing() {
  for (const tc of missing) {
    const start = Date.now();
    const res = await fetch(CAPATAZ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CAPATAZ_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-3.5-flash-lite',
        messages: [
          { role: 'system', content: TOBI_PROMPT },
          { role: 'user', content: tc.prompt },
        ],
        reasoning_effort: 'max',
        max_tokens: 500,
        temperature: 0.1,
      }),
    });
    const d = await res.json();
    const duration = Date.now() - start;
    const text = d.choices?.[0]?.message?.content || '';
    const usage = d.usage || {};
    const evalResult = evaluateCase(tc, text);

    const forbiddenFails = evalResult.failures.filter(
      (f) =>
        f.includes('Patrón prohibido') ||
        f.includes('salarioMensual por debajo del mínimo') ||
        f.includes('Motivo incorrecto') ||
        f.includes('Tipo incorrecto')
    );
    const isHallucination = forbiddenFails.length > 0 || evalResult.legal < 6;

    raw.push({
      model: 'gemini-3.5-flash',
      modelLabel: 'Gemini 3.5 Flash',
      effort: 'max',
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
      durationMs: duration,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0,
      responseSnippet: text.slice(0, 200),
    });
    console.log('Completado:', tc.id, 'Passed:', evalResult.passed, 'Alucina:', isHallucination, 'Duration:', duration);
  }

  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));
  console.log('Total de casos guardados en raw:', raw.length);
}

finishMissing();
