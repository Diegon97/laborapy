/**
 * MOTOR SYSTEM ONE — LABORAPY / TOBI
 * Versión: PY-SYSTEMONE-2026.09.17
 *
 * Porta a TypeScript el subsistema System One de Tobi:
 *  - Primitivas tipadas de preguntas: `choice`, `score`, `noul`.
 *  - Normalización de probabilidades y cálculo de confianza por concentración.
 *  - `evaluateTobiPeritaje`: consulta el endpoint `/api/systemone` y, si la red
 *    falla o el modo es offline, resuelve con un fallback pericial determinístico
 *    basado en el Código del Trabajo paraguayo (Ley 213/93).
 *
 * Principio Ponytail: cero dependencias npm; `fetch` nativo, TypeScript estricto.
 */

import type {
  ChoiceAnswer,
  ChoiceQuestion,
  NoulAnswer,
  NoulQuestion,
  ScoreAnswer,
  ScoreQuestion,
  SystemOneAnswer,
  SystemOneQuestion,
  TobiIntencion,
  TobiMotivoEgreso,
  TobiNivelFraude,
  TobiPeritajeJudgment,
  TobiPeritajeOptions,
  TobiRiesgoFraudeArt19,
} from './types.js';

/* -------------------------------------------------------------------------- */
/*                          Constructores de preguntas                        */
/* -------------------------------------------------------------------------- */

/** Pregunta de elección múltiple (choice). */
export function choice(instructions: string, criteria: Record<string, string>): ChoiceQuestion {
  return { type: 'choice', instructions, criteria };
}

/** Pregunta de scoring (score). */
export function score(instructions: string, criteria: readonly string[]): ScoreQuestion {
  return { type: 'score', instructions, criteria };
}

/** Pregunta binaria (noul = probabilidad de "sí" en [0, 1]). */
export function noul(instructions: string, criteria: null = null): NoulQuestion {
  return { type: 'noul', instructions, criteria };
}

/* -------------------------------------------------------------------------- */
/*                     Normalización y confianza (System One)                 */
/* -------------------------------------------------------------------------- */

/** Normaliza probabilidades para que sumen exactamente 1.0 (redondeo a 4 decimales). */
export function normalizeProbabilities(rawProbs: Readonly<Record<string, number>>): Record<string, number> {
  const keys = Object.keys(rawProbs);
  if (keys.length === 0) return {};

  const sum = keys.reduce((acc, k) => acc + (Number(rawProbs[k]) || 0), 0);
  const result: Record<string, number> = {};

  if (sum <= 0) {
    const uniform = Number((1 / keys.length).toFixed(4));
    for (const k of keys) result[k] = uniform;
    return result;
  }

  for (const k of keys) {
    result[k] = Number(((Number(rawProbs[k]) || 0) / sum).toFixed(4));
  }
  return result;
}

/**
 * Calcula el nivel de confianza a partir de la concentración de probabilidad.
 * Alta separación entre la opción líder y la segunda → confianza alta.
 */
export function calculateConfidence(probabilities: Readonly<Record<string, number>>): number {
  const vals = Object.values(probabilities)
    .map(Number)
    .filter((v) => Number.isFinite(v));
  if (vals.length === 0) return 0;
  if (vals.length === 1) return 1;

  const sorted = [...vals].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  return Math.min(1, Math.max(0, Number((top - second * 0.5).toFixed(2))));
}

/* -------------------------------------------------------------------------- */
/*                       Utilidades numéricas y de formato                    */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    const n = toFiniteNumber(v);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function makeChoiceAnswer(selected: string, confidence: number, probabilities: Record<string, number>): ChoiceAnswer {
  return { type: 'choice', choice: selected, confidence, probabilities };
}

function makeScoreAnswer(scoreValue: number, confidence: number, probabilities: Record<string, number>): ScoreAnswer {
  return { type: 'score', score: scoreValue, confidence, probabilities };
}

function makeNoulAnswer(value: number): NoulAnswer {
  return { type: 'noul', noul: value };
}

/* -------------------------------------------------------------------------- */
/*                       Preguntas canónicas del peritaje Tobi                */
/* -------------------------------------------------------------------------- */

export const TOBI_PERITAJE_QUESTIONS: Readonly<Record<string, SystemOneQuestion>> = {
  intencion: choice('¿Cuál es la intención primaria del usuario?', {
    calcular_liquidacion: 'Calcular indemnización o liquidación por despido/renuncia',
    auditoria_documento: 'Revisar nota de despido, finiquito, suspensión o contrato',
    consulta_derechos: 'Consultar sobre vacaciones, permisos, IPS o feriados',
    fraude_facturacion: 'Evaluar relación de dependencia encubierta por factura',
    fuera_de_dominio: 'Petición ajena a temas laborales o de RRHH',
  }),
  motivo_desvinculacion: choice('¿Qué motivo legal de desvinculación se configura según el Código del Trabajo?', {
    despido_injustificado: 'Despido sin causa o por reestructuración (Art. 84 C.T.)',
    despido_justificado: 'Despido por falta grave comprobada (Art. 81 C.T.)',
    renuncia_voluntaria: 'Renuncia decidida libremente por el empleado',
    retiro_justificado: 'Retiro por falta de pago o injurias del empleador (Art. 85 C.T.)',
    estabilidad_10_anos: 'Despido ilegal de empleado con más de 10 años (Art. 94 C.T.)',
    no_aplica: 'No hay desvinculación o es consulta general',
  }),
  riesgo_fraude_art19: score('Nivel de contingencia por facturación con relación de dependencia encubierta:', [
    'Nivel 1: Autónomo legítimo',
    'Nivel 2: Coordinación técnica sin subordinación',
    'Nivel 3: Indicios moderados de laboralidad',
    'Nivel 4: Fuerte subordinación y exclusividad',
    'Nivel 5: Dependencia laboral flagrante',
  ]),
  es_urgente_prescripcion: noul('¿El caso está cerca de prescribir (plazo fatal de 60 días corridos del Art. 399 C.T.)?'),
  calificacion_lead_b2b: noul('¿La consulta proviene de una empresa o empleador con potencial de contratar servicios de nóminas/RRHH?'),
};

const ADAPTER_JSON_INSTRUCTIONS =
  'Devolvé un JSON con esta estructura exacta para "answers":\n' +
  '{ "answers": { "<question_id>": { "type": "choice | noul | score", ... campos correspondientes } } }\n' +
  'Para "score" el valor debe ser el índice 0-based del nivel (0 = primer nivel, niveles-1 = último nivel).\n';

export function buildSystemOnePrompt(state: string | object, questions: Readonly<Record<string, SystemOneQuestion>>): string {
  const formatted: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      formatted[id] = { type: 'noul', instructions: q.instructions, output_required: { noul: 'float entre 0.0 y 1.0 representando la probabilidad de SI' } };
    } else if (q.type === 'choice') {
      formatted[id] = { type: 'choice', instructions: q.instructions, candidates: q.criteria, output_required: { choice: 'clave candidata seleccionada', probabilities: 'objeto clave -> probabilidad float (sumando 1.0)' } };
    } else {
      formatted[id] = { type: 'score', instructions: q.instructions, levels: q.criteria, output_required: { score: 'float 0-based entre los niveles (0 = primer nivel, N-1 = último nivel)', probabilities: 'objeto índice 0-based -> probabilidad' } };
    }
  }
  const renderedState = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
  return `EVALUÁ ESTE ESTADO:\n"""\n${renderedState}\n"""\n\nPREGUNTAS TIPADAS A RESOLVER:\n${JSON.stringify(formatted, null, 2)}\n\n` + ADAPTER_JSON_INSTRUCTIONS;
}

export function parseSystemOneJson(text: string): unknown {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

export function formatSystemOneAnswers(rawJson: unknown, questions: Readonly<Record<string, SystemOneQuestion>>): Record<string, SystemOneAnswer> {
  const answers: Record<string, SystemOneAnswer> = {};
  const root = isRecord(rawJson) ? rawJson : {};
  const rawAnswers: Record<string, unknown> = isRecord(root.answers) ? root.answers : root;
  for (const [id, q] of Object.entries(questions)) {
    const raw = rawAnswers[id];
    if (!isRecord(raw)) continue;
    if (q.type === 'noul') {
      const candidate = toFiniteNumber(raw.noul) ?? toFiniteNumber(raw.value) ?? toFiniteNumber(raw.probability);
      if (candidate === null) continue;
      answers[id] = makeNoulAnswer(Number(clamp01(candidate).toFixed(2)));
    } else if (q.type === 'choice') {
      const criteriaKeys = Object.keys(q.criteria);
      const rawChoice = typeof raw.choice === 'string' ? raw.choice : '';
      if (!criteriaKeys.includes(rawChoice)) continue;
      const probs = normalizeProbabilities(asNumberRecord(raw.probabilities) ?? { [rawChoice]: 1 });
      answers[id] = makeChoiceAnswer(rawChoice, calculateConfidence(probs), probs);
    } else {
      const rawScore = toFiniteNumber(raw.score);
      if (rawScore === null) continue;
      const levels = Math.max(1, q.criteria.length);
      // TypeSafe Score entrega el índice 0-based del nivel; el dominio de Tobi es 1..N.
      const scoreValue = clamp(rawScore + 1, 1, levels);
      const probs = normalizeProbabilities(asNumberRecord(raw.probabilities) ?? {});
      answers[id] = makeScoreAnswer(scoreValue, calculateConfidence(probs), probs);
    }
  }
  return answers;
}

const INTENCIONES: readonly TobiIntencion[] = ['calcular_liquidacion', 'auditoria_documento', 'consulta_derechos', 'fraude_facturacion', 'fuera_de_dominio'];
const MOTIVOS: readonly TobiMotivoEgreso[] = ['despido_injustificado', 'despido_justificado', 'renuncia_voluntaria', 'retiro_justificado', 'estabilidad_10_anos', 'no_aplica'];

function isIntencion(value: unknown): value is TobiIntencion { return typeof value === 'string' && (INTENCIONES as readonly string[]).includes(value); }
function isMotivoEgreso(value: unknown): value is TobiMotivoEgreso { return typeof value === 'string' && (MOTIVOS as readonly string[]).includes(value); }

function stripAccents(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20,
};

const RE_DESPIDO = /despid|desped|desvincul|puesto a la orden|ya no vengas|no vaya(s)? a trabajar|reestructur|rescind|me sacaron|me echaron/;
const RE_INJUSTIFICADO = /injustificad/;
const RE_JUSTIFICADO = /justificad|falta grave|art\.? ?81|con causa|abandono|robo|hurto|injuria|violencia|embriaguez|estupefaciente|danos? material(es)?/;
const RE_RENUNCIA = /renunci/;
const RE_RETIRO_JUSTIFICADO = /retiro justificado|art\.? ?85|me retiro por|renuncia indirecta|falta de pago.*(retir|renunc)/;
const RE_ESTABILIDAD = /estabilidad|art\.? ?94|diez anos|10 anos|mas de 10 anos/;
const RE_FACTURACION = /factur|monotribut|honorario|contrato de servicio|prestacion de servicio|boleta/;
const RE_AUDITORIA = /nota de despido|auditor|finiquito|revisar.*(contrato|recibo|nota|carta|telegrama)|recibi.*(nota|carta|telegrama|despido)|me notificaron|analizar.*(contrato|recibo)/;
const RE_SUSPENSION = /suspen|sancion disciplinaria|amonesta/;
const RE_CONSULTA_DERECHOS = /vacacion|aguinaldo|permiso|licencia|ips|feriado|derecho|jornada|horas extra|salario minimo|maternidad|preaviso|indemnizacion|liquidacion|desahucio/;
const RE_SUBORDINACION = /orden|supervis|sancion|subordin|disciplina|jefe/;
const RE_HORARIO = /horario|tarjeta|asistencia|marcar|entrada y salida|8 a 17|jornada fija/;
const RE_EXCLUSIVIDAD = /exclusiv|unico cliente|solo para (esta|este|una|un|ellos|el|la|esa|ese)|dedicacion/;
const RE_HERRAMIENTAS = /\bpc\b|computador|equipo|herramienta|vehiculo|oficina|software|plataforma|suministr|celular de la empresa/;
const RE_PRESCRIPCION = /prescri|prescrib|plazo fatal|60 dias|sesenta dias/;
const RE_B2B = /somos (una|un)|tenemos \d+ empleados|\d+ empleados|nuestros (empleados|colaboradores)|nomina|reop|planilla|terceriz|outsourcing|consultoria|asesoria (contable|laboral|empresarial)|recursos humanos|rrhh|corporativ/;

function detectAntiguedadAnios(lower: string): number | null {
  const numeric = /(\d{1,2})\s*anos/.exec(lower);
  if (numeric) {
    const value = Number(numeric[1]);
    if (Number.isFinite(value)) return value;
  }
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\s*anos`).test(lower)) return value;
  }
  return null;
}

export function heuristicTobiPeritaje(texto: string): TobiPeritajeJudgment {
  const raw = typeof texto === 'string' ? texto : '';
  const lower = stripAccents(raw).trim();
  if (!lower) {
    return { intencion: 'fuera_de_dominio', motivoEgreso: 'no_aplica', riesgoFraudeArt19: { score: 1, nivel: 1, flagrante: false }, esUrgentePrescripcion: false, leadB2B: false, confianza: 0 };
  }
  const esInjustificadoExplicito = RE_INJUSTIFICADO.test(lower);
  const esDespido = RE_DESPIDO.test(lower);
  const esRenuncia = RE_RENUNCIA.test(lower);
  const esRetiroJustificado = RE_RETIRO_JUSTIFICADO.test(lower);
  const antiguedad = detectAntiguedadAnios(lower);
  const esEstabilidadExplicita = RE_ESTABILIDAD.test(lower);
  const esEstabilidadPorAntiguedad = esDespido && (antiguedad ?? 0) >= 10;
  const esJustificado = !esInjustificadoExplicito && RE_JUSTIFICADO.test(lower);
  const esFacturacion = RE_FACTURACION.test(lower);
  const esAuditoria = RE_AUDITORIA.test(lower);
  const esSuspension = RE_SUSPENSION.test(lower);
  const esConsultaDerechos = RE_CONSULTA_DERECHOS.test(lower);
  const indicadoresArt19 = [RE_SUBORDINACION, RE_HORARIO, RE_EXCLUSIVIDAD, RE_HERRAMIENTAS].filter((re) => re.test(lower)).length;
  const esUrgentePrescripcion = RE_PRESCRIPCION.test(lower);
  const leadB2B = RE_B2B.test(lower);
  const esLaboral = esDespido || esRenuncia || esRetiroJustificado || esFacturacion || esAuditoria || esSuspension || esConsultaDerechos || leadB2B;

  let intencion: TobiIntencion;
  if (!esLaboral) intencion = 'fuera_de_dominio';
  else if (esFacturacion) intencion = 'fraude_facturacion';
  else if (esDespido || esRenuncia || esRetiroJustificado) intencion = 'calcular_liquidacion';
  else if (esAuditoria || esSuspension) intencion = 'auditoria_documento';
  else intencion = 'consulta_derechos';

  let motivoEgreso: TobiMotivoEgreso;
  if (esSuspension && !esDespido && !esRenuncia && !esRetiroJustificado) motivoEgreso = 'no_aplica';
  else if (esEstabilidadExplicita || (esEstabilidadPorAntiguedad && !esJustificado)) motivoEgreso = 'estabilidad_10_anos';
  else if (esDespido && esJustificado) motivoEgreso = 'despido_justificado';
  else if (esDespido) motivoEgreso = 'despido_injustificado';
  else if (esRetiroJustificado) motivoEgreso = 'retiro_justificado';
  else if (esRenuncia) motivoEgreso = 'renuncia_voluntaria';
  else motivoEgreso = 'no_aplica';

  let riesgoFraudeArt19: TobiRiesgoFraudeArt19;
  if (esFacturacion) {
    const scoreValue = clamp(2 + indicadoresArt19, 1, 5);
    const nivel = clamp(Math.round(scoreValue), 1, 5) as TobiNivelFraude;
    riesgoFraudeArt19 = { score: scoreValue, nivel, flagrante: nivel >= 4 };
  } else {
    riesgoFraudeArt19 = { score: 1, nivel: 1, flagrante: false };
  }

  let confianza: number;
  if (intencion === 'fuera_de_dominio') {
    confianza = 0.2;
  } else {
    const senales = [esDespido, esRenuncia, esFacturacion, esEstabilidadExplicita, esEstabilidadPorAntiguedad, esAuditoria, esSuspension, esConsultaDerechos, esUrgentePrescripcion, leadB2B].filter(Boolean).length;
    confianza = Number(Math.min(0.95, 0.6 + 0.1 * Math.min(3, senales)).toFixed(2));
  }

  return { intencion, motivoEgreso, riesgoFraudeArt19, esUrgentePrescripcion, leadB2B, confianza };
}

function heuristicAnswers(texto: string): Record<string, SystemOneAnswer> {
  const j = heuristicTobiPeritaje(texto);
  return {
    intencion: makeChoiceAnswer(j.intencion, j.confianza, { [j.intencion]: 1 }),
    motivo_desvinculacion: makeChoiceAnswer(j.motivoEgreso, j.confianza, { [j.motivoEgreso]: 1 }),
    riesgo_fraude_art19: makeScoreAnswer(j.riesgoFraudeArt19.score, j.confianza, { [`nivel_${j.riesgoFraudeArt19.nivel}`]: 1 }),
    es_urgente_prescripcion: makeNoulAnswer(j.esUrgentePrescripcion ? 1 : 0),
    calificacion_lead_b2b: makeNoulAnswer(j.leadB2B ? 1 : 0),
  };
}

export function deterministicAnswers(texto: string, questions: Readonly<Record<string, SystemOneQuestion>>): Record<string, SystemOneAnswer> {
  const j = heuristicTobiPeritaje(texto);
  const known = heuristicAnswers(texto);
  const out: Record<string, SystemOneAnswer> = {};
  for (const [id, q] of Object.entries(questions)) {
    const existing = known[id];
    if (existing) { out[id] = existing; continue; }
    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria);
      const selected = keys[0] ?? 'desconocido';
      out[id] = makeChoiceAnswer(selected, j.confianza, { [selected]: 1 });
    } else if (q.type === 'score') {
      const maxLevel = Math.max(1, q.criteria.length);
      const scoreValue = clamp(Math.round(j.riesgoFraudeArt19.score), 1, maxLevel);
      out[id] = makeScoreAnswer(scoreValue, j.confianza, { [`nivel_${scoreValue}`]: 1 });
    } else {
      out[id] = makeNoulAnswer(0);
    }
  }
  return out;
}

function answersConfidence(answers: Readonly<Record<string, SystemOneAnswer>>, fallback: number): number {
  const values: number[] = [];
  for (const a of Object.values(answers)) {
    if (a.type === 'choice' || a.type === 'score') {
      values.push(Number.isFinite(a.confidence) ? a.confidence : 0);
    } else {
      values.push(Number.isFinite(a.noul) ? Math.abs(a.noul - 0.5) * 2 : 0);
    }
  }
  if (values.length === 0) return fallback;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

export function judgmentFromAnswers(answers: Readonly<Record<string, SystemOneAnswer>>, base: TobiPeritajeJudgment): TobiPeritajeJudgment {
  let intencion = base.intencion;
  let motivoEgreso = base.motivoEgreso;
  let riesgo = base.riesgoFraudeArt19;
  let esUrgentePrescripcion = base.esUrgentePrescripcion;
  let leadB2B = base.leadB2B;

  const aIntencion = answers['intencion'];
  if (aIntencion && aIntencion.type === 'choice' && isIntencion(aIntencion.choice)) {
    intencion = aIntencion.choice;
  }
  const aMotivo = answers['motivo_desvinculacion'];
  if (aMotivo && aMotivo.type === 'choice' && isMotivoEgreso(aMotivo.choice)) {
    motivoEgreso = aMotivo.choice;
  }
  const aRiesgo = answers['riesgo_fraude_art19'];
  if (aRiesgo && aRiesgo.type === 'score' && Number.isFinite(aRiesgo.score)) {
    const scoreValue = clamp(aRiesgo.score, 1, 5);
    const nivel = clamp(Math.round(scoreValue), 1, 5) as TobiNivelFraude;
    riesgo = { score: scoreValue, nivel, flagrante: nivel >= 4 };
  }
  const aPrescripcion = answers['es_urgente_prescripcion'];
  if (aPrescripcion && aPrescripcion.type === 'noul' && Number.isFinite(aPrescripcion.noul)) {
    esUrgentePrescripcion = aPrescripcion.noul >= 0.5;
  }
  const aLead = answers['calificacion_lead_b2b'];
  if (aLead && aLead.type === 'noul' && Number.isFinite(aLead.noul)) {
    leadB2B = aLead.noul >= 0.5;
  }
  return {
    intencion,
    motivoEgreso,
    riesgoFraudeArt19: riesgo,
    esUrgentePrescripcion,
    leadB2B,
    confianza: answersConfidence(answers, base.confianza),
  };
}

const DEFAULT_ENDPOINT = '/api/systemone';
const NETWORK_TIMEOUT_MS = 4000;

async function fetchRemoteAnswers(endpoint: string, texto: string): Promise<Record<string, SystemOneAnswer> | null> {
  if (typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: texto, questions: TOBI_PERITAJE_QUESTIONS }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!isRecord(data) || data.ok === false) return null;
    if (!isRecord(data.answers)) return null;
    return data.answers as Record<string, SystemOneAnswer>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function evaluateTobiPeritaje(texto: string, options?: TobiPeritajeOptions): Promise<TobiPeritajeJudgment> {
  const state = typeof texto === 'string' ? texto : '';
  const base = heuristicTobiPeritaje(state);
  const endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
  if (!endpoint) return base;
  const remoteAnswers = await fetchRemoteAnswers(endpoint, state);
  if (!remoteAnswers) return base;
  try {
    return judgmentFromAnswers(remoteAnswers, base);
  } catch {
    return base;
  }
}
