/**
 * TIPOS DEL SUBSISTEMA SYSTEM ONE — LABORAPY / TOBI
 * Versión: PY-SYSTEMONE-2026.09.17
 *
 * Contratos de la capa de evaluación determinística/probabilística (patrón
 * TypeSafe AI System One) y del veredicto pericial de dominio laboral paraguayo
 * (Código del Trabajo Ley 213/93: Arts. 19, 81, 84, 94 y 399).
 */

/* -------------------------------------------------------------------------- */
/*                       Primitivas System One (TypeSafe AI)                  */
/* -------------------------------------------------------------------------- */

/** Pregunta de elección múltiple: devuelve una opción entre candidatos. */
export interface ChoiceQuestion {
  readonly type: 'choice';
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
}

/** Pregunta de scoring: devuelve una posición numérica entre niveles. */
export interface ScoreQuestion {
  readonly type: 'score';
  readonly instructions: string;
  readonly criteria: readonly string[];
}

/** Pregunta binaria: devuelve la probabilidad de que la respuesta sea "sí". */
export interface NoulQuestion {
  readonly type: 'noul';
  readonly instructions: string;
  readonly criteria: null;
}

export type SystemOneQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;

/** Respuesta de elección con distribución de probabilidad normalizada. */
export interface ChoiceAnswer {
  readonly type: 'choice';
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

/** Respuesta de scoring con distribución de probabilidad normalizada. */
export interface ScoreAnswer {
  readonly type: 'score';
  readonly score: number;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

/** Respuesta binaria: `noul` en [0, 1] representa la probabilidad de "sí". */
export interface NoulAnswer {
  readonly type: 'noul';
  readonly noul: number;
}

export type SystemOneAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

/** Respuesta completa del motor System One (nativo o adaptador). */
export interface SystemOneResponse {
  readonly model: string;
  readonly adapter?: boolean;
  readonly answers: Readonly<Record<string, SystemOneAnswer>>;
}

/* -------------------------------------------------------------------------- */
/*                          Dominio LaboraPy / Tobi                           */
/* -------------------------------------------------------------------------- */

export type TobiIntencion =
  | 'calcular_liquidacion'
  | 'auditoria_documento'
  | 'consulta_derechos'
  | 'fraude_facturacion'
  | 'fuera_de_dominio';

export type TobiMotivoEgreso =
  | 'despido_injustificado'
  | 'despido_justificado'
  | 'renuncia_voluntaria'
  | 'retiro_justificado'
  | 'estabilidad_10_anos'
  | 'no_aplica';

export type TobiNivelFraude = 1 | 2 | 3 | 4 | 5;

/** Contingencia de fraude laboral por facturación (Art. 19 C.T.). */
export interface TobiRiesgoFraudeArt19 {
  readonly score: number;
  readonly nivel: TobiNivelFraude;
  readonly flagrante: boolean;
}

/** Veredicto pericial determinístico entregado por Tobi. */
export interface TobiPeritajeJudgment {
  readonly intencion: TobiIntencion;
  readonly motivoEgreso: TobiMotivoEgreso;
  readonly riesgoFraudeArt19: TobiRiesgoFraudeArt19;
  readonly esUrgentePrescripcion: boolean;
  readonly leadB2B: boolean;
  readonly confianza: number;
}

/** Opciones de evaluación de `evaluateTobiPeritaje`. */
export interface TobiPeritajeOptions {
  /**
   * Endpoint del backend System One. Por defecto `/api/systemone`.
   * Un string vacío fuerza el modo offline determinístico (sin red).
   */
  readonly endpoint?: string;
}
