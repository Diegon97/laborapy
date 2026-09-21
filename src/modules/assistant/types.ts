/**
 * TIPOS DEL MÓDULO HR ASSISTANT — LABORAPY
 * Versión de reglas: PY-ASSIST-2026.09.10
 *
 * Centraliza los contratos de:
 *  - Auditoría de liquidaciones ("Segundo Ojo") y estado de salud laboral.
 *  - Vencimientos patronales (IPS REI, MTESS REOP, Certificado Art. 93).
 *  - Base de conocimiento paraguayo (Código del Trabajo Ley 213/93 y complementarias).
 *  - Asistente de consultas (Offline / DeepSeek V4.1 Flash).
 *  - Persistencia y sincronización en tiempo real en Supabase por cliente/empresa.
 */

import type {
  LiquidacionInput,
  LiquidacionResult,
  MotivoEgreso,
  RegimenIPS,
} from '../payroll/types';

export type {
  LiquidacionInput,
  LiquidacionResult,
  MotivoEgreso,
  RegimenIPS,
};

/* -------------------------------------------------------------------------- */
/*                                 Primitivos                                 */
/* -------------------------------------------------------------------------- */

export type UUID = string;
export type ISODateString = string;
export type ISODate = string;
export type PayrollPeriod = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

/* -------------------------------------------------------------------------- */
/*                        Segundo Ojo: Auditoría de Liquidaciones             */
/* -------------------------------------------------------------------------- */

export type Severity = 'error' | 'warning' | 'info';
export type HealthStatus = 'optimo' | 'observaciones' | 'critico';

export type AuditCategory =
  | 'remuneraciones'
  | 'cargas-sociales'
  | 'jornada'
  | 'vacaciones'
  | 'aguinaldo'
  | 'preaviso'
  | 'indemnizacion'
  | 'desvinculacion'
  | 'documentacion'
  | 'registracion'
  | 'fiscal'
  | 'otro';

export interface AuditFinding {
  readonly id: string;
  readonly code: string;
  readonly severity: Severity;
  readonly category: AuditCategory;
  readonly title: string;
  readonly detail: string;
  readonly legalReference: string | null;
  readonly recommendation: string | null;
  readonly field?: string;
  readonly expected?: number | string | null;
  readonly actual?: number | string | null;
}

export interface AuditSummary {
  readonly totalFindings: number;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
}

export interface AuditOptions {
  readonly year?: number;
  readonly salarioMinimoOverride?: number;
  readonly strict?: boolean;
}

export interface AuditReport {
  readonly id: UUID;
  readonly clientId?: string | null;
  readonly companyId?: string | null;
  readonly healthStatus: HealthStatus;
  readonly score: number; // 0 a 100
  readonly summary: AuditSummary;
  readonly findings: readonly AuditFinding[];
  readonly options: AuditOptions;
  readonly generatedAt: ISODateString;
}

/* -------------------------------------------------------------------------- */
/*                         Vencimientos y Trámites Operativos                 */
/* -------------------------------------------------------------------------- */

export type DeadlineKind =
  | 'ips_rei'
  | 'mtess_reop'
  | 'certificado_trabajo'
  | 'pago_salarios'
  | 'pago_aguinaldo'
  | 'otro';

export type DeadlineStatus = 'pendiente' | 'proximo' | 'cumplido' | 'vencido';

export interface DeadlineItem {
  readonly id: string;
  readonly kind: DeadlineKind;
  readonly concepto: string;
  readonly descripcion: string;
  readonly dueDate: ISODate;
  readonly daysRemaining: number;
  readonly status: DeadlineStatus;
  readonly diasHabiles?: number;
  readonly diasCorridos?: number;
  readonly obligatorio: boolean;
  readonly organismo: 'IPS' | 'MTESS' | 'EMPRESA' | 'OTRO';
  readonly legalReference: string;
  readonly advertenciaLegal?: string;
}

export interface SettlementDeadlines {
  readonly fechaEgreso: ISODate;
  readonly ipsRei: DeadlineItem;
  readonly mtessReop: DeadlineItem;
  readonly certificadoTrabajo: DeadlineItem;
  readonly advertencias: readonly string[];
}

export interface PayrollCalendarEvent {
  readonly id: string;
  readonly dayRange: string;
  readonly title: string;
  readonly description: string;
  readonly legalReference: string;
  readonly category: 'pago' | 'aporte' | 'planilla' | 'beneficio';
}

export interface RetentionLimits {
  readonly salarioBruto: number;
  readonly maxDeduccionesOrdinarias: number; // 30% (Art. 242 C.T.)
  readonly maxPensionAlimenticia: number; // 50% (Art. 245 C.T.)
  readonly maxAnticipoAguinaldo: number; // Aguinaldo devengado
  readonly detalle: string;
}

/* -------------------------------------------------------------------------- */
/*                            Base de Conocimiento                            */
/* -------------------------------------------------------------------------- */

export type KnowledgeTopic =
  | 'vacaciones'
  | 'periodo-prueba'
  | 'aguinaldo'
  | 'licencias'
  | 'horas-extra'
  | 'descuentos'
  | 'preaviso'
  | 'indemnizacion'
  | 'certificado-trabajo'
  | 'seguridad-social'
  | 'jornada'
  | 'general';

export interface KnowledgeReference {
  readonly label: string;
  readonly legalReference: string;
}

export interface KnowledgeEntry {
  readonly id: string;
  readonly topic: KnowledgeTopic;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly keywords: readonly string[];
  readonly legalBasis: readonly string[];
}

export interface KnowledgeSearchResult {
  readonly entry: KnowledgeEntry;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

/* -------------------------------------------------------------------------- */
/*                               Chat / Asistente                             */
/* -------------------------------------------------------------------------- */

export type AssistantRole = 'user' | 'assistant' | 'system';

/**
 * Motor de inferencia de Tobi:
 *  - `flash`: respuesta veloz (Gemini Cache → DeepSeek V3 → GPT-4o-mini).
 *  - `deepthink`: razonamiento profundo (DeepSeek Reasoner → Gemini Thinking → DeepSeek V3).
 */
export type TobiEngineMode = 'flash' | 'deepthink';

export type TobiFeedbackRating = 'positive' | 'negative';

export interface AssistantCitation {
  readonly entryId: string;
  readonly title: string;
  readonly legalReference: string;
}

export interface AssistantAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly data: string; // Base64 data string o Data URL
  readonly previewUrl?: string;
  readonly sizeBytes?: number;
}

export interface AssistantMessage {
  readonly id: UUID;
  readonly sessionId?: UUID | null;
  readonly role: AssistantRole;
  readonly content: string;
  readonly createdAt: ISODateString;
  readonly citations?: readonly AssistantCitation[];
  readonly auditReportId?: UUID | null;
  readonly attachment?: AssistantAttachment | null;
  readonly feedback?: TobiFeedbackRating | null;
  readonly settlementData?: {
    readonly input: LiquidacionInput;
    readonly result: LiquidacionResult;
  } | null;
  readonly documentData?: TobiDocumentActionPayload | null;
  /** Opciones interactivas de continuación sugeridas por Tobi (bloque :::opciones_continuar del frontend). */
  readonly continuationOptions?: readonly string[] | null;
  /** Veredicto pericial determinístico de System One asociado al turno, si existió evaluación. */
  readonly systemOneJudgment?: import('./systemOne/types').TobiPeritajeJudgment | null;
  /** Motor de inferencia utilizado para producir la respuesta. */
  readonly engineMode?: TobiEngineMode | null;
}

export interface TobiSettlementActionPayload {
  readonly salarioMensual: number;
  readonly fechaIngreso: string;
  readonly fechaEgreso: string;
  readonly motivo: MotivoEgreso;
  readonly tieneVariables?: boolean;
  readonly preavisoOtorgado?: boolean;
  readonly preavisoObligado?: 'empleador' | 'trabajador';
  readonly diasPreavisoOtorgados?: number;
  readonly vacacionesPeriodoActual?: number;
  readonly vacacionesPeriodosAnteriores?: number;
  readonly salariosPendientes?: number;
  readonly comisiones?: number;
  readonly horasExtras?: number;
  readonly aguinaldoAnteriorPendiente?: number;
  readonly embargoJudicial?: number;
  readonly nombreEmpleado?: string;
  readonly ciEmpleado?: string;
  readonly cargoEmpleado?: string;
  readonly empresa?: string;
  readonly regimenLaboral?: 'general' | 'domestico';
  readonly regimen?: 'general' | 'especial' | 'factura';
}

export type TobiDocumentType =
  | 'amonestacion'
  | 'suspension_disciplinaria'
  | 'traslado'
  | 'despido_justificado'
  | 'despido_injustificado'
  | 'renuncia'
  | 'certificado_trabajo';

export interface TobiDocumentActionPayload {
  readonly tipo: TobiDocumentType;
  readonly empresa?: string;
  readonly nombreEmpleado: string;
  readonly ciEmpleado: string;
  readonly cargoEmpleado?: string;
  readonly lugarFecha?: string;
  readonly hechosOcurridos?: string;
  readonly fundamentoLegal?: string;
  readonly causaJustificada?: string;
  readonly diasSuspension?: number;
  readonly fechaInicioSuspension?: string;
  readonly fechaFinSuspension?: string;
  readonly sucursalOrigen?: string;
  readonly sucursalDestino?: string;
  readonly fechaEfectivaTraslado?: string;
  readonly compensacionTraslado?: string;
  readonly diasPreaviso?: number;
  readonly salarioMensual?: number;
  readonly fechaIngreso?: string;
  readonly fechaEgreso?: string;
}

export interface AssistantQueryContext {
  readonly clientId?: string | null;
  readonly companyId?: string | null;
  readonly companyName?: string | null;
  readonly liquidacionInput?: Partial<LiquidacionInput> | null;
  readonly liquidacionResult?: Partial<LiquidacionResult> | null;
  readonly auditReport?: AuditReport | null;
  readonly deadlines?: SettlementDeadlines | null;
  readonly attachment?: AssistantAttachment | null;
}

/** Turno de conversación liviano para memoria del asistente (sin adjuntos ni metadatos). */
export interface TobiChatTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/* -------------------------------------------------------------------------- */
/*                   Persistencia y Sincronización Supabase                   */
/* -------------------------------------------------------------------------- */

export interface HRAuditRecord {
  readonly id: UUID;
  readonly client_id: string;
  readonly company_id: string;
  readonly health_status: HealthStatus;
  readonly score: number;
  readonly summary: AuditSummary;
  readonly findings: readonly AuditFinding[];
  readonly options: AuditOptions;
  readonly created_at: ISODateString;
}

export type HRChatSessionStatus = 'active' | 'archived' | 'closed';

export interface HRChatSession {
  readonly id: UUID;
  readonly client_id: string;
  readonly company_id: string;
  readonly title: string;
  readonly status: HRChatSessionStatus;
  readonly last_message_at: ISODateString;
  readonly created_at: ISODateString;
}

export interface HRChatMessage {
  readonly id: UUID;
  readonly session_id: UUID;
  readonly client_id: string;
  readonly company_id: string;
  readonly role: AssistantRole;
  readonly content: string;
  readonly citations?: readonly AssistantCitation[];
  readonly audit_report_id?: UUID | null;
  readonly created_at: ISODateString;
}
