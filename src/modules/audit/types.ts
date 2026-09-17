/**
 * AUDITORÍA PATRONAL PRE-MTESS — TIPOS, CONSTANTES Y CONTRATOS
 * LaboraPy — Soluciones Laborales y Contables de Paraguay
 * Versión: PY-AUD-2026.09.16
 *
 * Marco normativo:
 * - Ley N.º 213/93 (Código del Trabajo): Arts. 18, 19, 38, 55, 58, 200, 202, 261, 263 y concordantes.
 * - Decreto-Ley N.º 1860/50: obligatoriedad del seguro social (IPS) — Art. 76.
 * - Ley N.º 5508/15 (mod. Ley N.º 7140/23): fuero maternal e inamovilidad (Art. 136 C.T.).
 *
 * IMPORTANTE: Auditoría preventiva orientada a la preparación de inspecciones del MTESS.
 * Los montos de multa son ESTIMATIVOS y se expresan en jornales mínimos oficiales vigentes.
 */

import type {
  EmpresaCliente,
  Empleado,
  ContratoTrabajo,
  RegistroMaternidad,
} from '../clientPortal/types/clientPortal';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes legales vigentes (2026)
// Fuente: Decreto N.º 6225/2026 y Res. MTESS N.º 670/2026
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION_AUDITORIA = 'PY-AUD-2026.09.16' as const;

/** Salario Mínimo Legal Vigente mensual (Gs.) */
export const SMLV_MENSUAL_2026 = 2_798_309 as const;

/** Jornal mínimo legal diario (Gs.) */
export const JORNAL_MINIMO_2026 = 107_627 as const;

/** Divisor del jornal mensual (Art. 230 C.T.) */
export const DIAS_JORNAL_MENSUAL = 26 as const;

/** Jornada ordinaria máxima semanal (Art. 200 C.T.) */
export const HORAS_SEMANA_LEGAL = 48 as const;

/** Máximo de horas extraordinarias por día (Art. 202 C.T.) */
export const HORAS_EXTRA_DIARIAS_MAX = 3 as const;

/** Máximo de horas extraordinarias por semana (Art. 202 C.T.) */
export const HORAS_EXTRA_SEMANALES_MAX = 57 as const;

/** Porcentaje de bonificación familiar por hijo (Art. 261 C.T.) */
export const BONIFICACION_FAMILIAR_PORCENTAJE = 0.05 as const;

/** Tope salarial de 2 SMLV para percibir bonificación familiar (Art. 263 C.T.) */
export const LIMITE_SALARIO_BONIFICACION_FAMILIAR = SMLV_MENSUAL_2026 * 2;

// ─────────────────────────────────────────────────────────────────────────────
// Severidad, niveles de riesgo y score de cumplimiento
// ─────────────────────────────────────────────────────────────────────────────

export type SeveridadRiesgo = 'critico' | 'alto' | 'medio' | 'bajo';

export type NivelRiesgoGlobal = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export interface SeveridadInfo {
  etiqueta: string;
  colorHex: string;
  rgb: [number, number, number];
  pesoScore: number;
  jornalesMulta: number;
}

export const SEVERIDAD_INFO: Record<SeveridadRiesgo, SeveridadInfo> = {
  critico: {
    etiqueta: 'CRÍTICO',
    colorHex: '#B91C1C',
    rgb: [185, 28, 28],
    pesoScore: 25,
    jornalesMulta: 30,
  },
  alto: {
    etiqueta: 'ALTO',
    colorHex: '#D97706',
    rgb: [217, 119, 6],
    pesoScore: 15,
    jornalesMulta: 20,
  },
  medio: {
    etiqueta: 'MEDIO',
    colorHex: '#CA8A04',
    rgb: [202, 138, 4],
    pesoScore: 8,
    jornalesMulta: 15,
  },
  bajo: {
    etiqueta: 'BAJO',
    colorHex: '#15803D',
    rgb: [21, 128, 61],
    pesoScore: 3,
    jornalesMulta: 10,
  },
};

export const ETIQUETA_NIVEL: Record<SeveridadRiesgo, NivelRiesgoGlobal> = {
  critico: 'CRITICO',
  alto: 'ALTO',
  medio: 'MEDIO',
  bajo: 'BAJO',
};

export const DESCRIPCION_NIVEL: Record<SeveridadRiesgo, string> = {
  critico:
    'Riesgo inminente de sanción y contingencia laboral agravada. Requiere intervención inmediata.',
  alto:
    'Contingencias de alto impacto con alta probabilidad de multa MTESS. Regularizar en el corto plazo.',
  medio:
    'Inconsistencias documentales o salariales parciales. Regularizar en el mediano plazo.',
  bajo:
    'Cumplimiento laboral adecuado conforme al Código del Trabajo y resoluciones del MTESS.',
};

export type TipoHallazgoAuditoria =
  | 'simulacion_factura'
  | 'omision_ips'
  | 'salario_bajo_minimo'
  | 'exceso_horas_extras'
  | 'omision_bonificacion_familiar'
  | 'contrato_no_registrado'
  | 'periodo_prueba_vencido'
  | 'fuero_maternal_riesgo';

// ─────────────────────────────────────────────────────────────────────────────
// Entrada y Salida de Auditoría
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosComplementariosEmpleado {
  horasExtrasDiarias?: number;
  horasExtrasSemanales?: number;
  horasSemanales?: number;
  tieneContratoEscrito?: boolean;
  bonificacionFamiliarPagada?: number;
  fueroMaternalActivo?: boolean;
  enProcesoDesvinculacion?: boolean;
}

export interface AuditoriaPatronalInput {
  empresa: EmpresaCliente;
  empleados: Empleado[];
  contratos?: ContratoTrabajo[];
  registrosMaternidad?: RegistroMaternidad[];
  datosComplementarios?: Record<string, DatosComplementariosEmpleado>;
  fechaCorte?: string;
}

export interface HallazgoAuditoria {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  ci: string;
  cargo: string;
  tipo: TipoHallazgoAuditoria;
  severidad: SeveridadRiesgo;
  titulo: string;
  descripcion: string;
  baseLegal: string;
  evidencia: string;
  recomendacion: string;
  jornalesMulta: number;
  cantidadAfectada: number;
  multaEstimadaPYG: number;
}

export interface RecomendacionTecnica {
  id: string;
  tipo: TipoHallazgoAuditoria;
  titulo: string;
  prioridad: SeveridadRiesgo;
  detalle: string;
  baseLegal: string;
}

export interface FaseMitigacion {
  fase: 1 | 2 | 3;
  titulo: string;
  plazoDias: number;
  acciones: string[];
}

export interface SemaforoRiesgo {
  nivel: SeveridadRiesgo;
  etiqueta: NivelRiesgoGlobal;
  colorHex: string;
  rgb: [number, number, number];
  descripcion: string;
}

export interface ResumenAuditoria {
  totalEmpleados: number;
  empleadosConHallazgos: number;
  totalHallazgos: number;
  criticos: number;
  altos: number;
  medios: number;
  bajos: number;
  multaTotalEstimadaPYG: number;
  scoreCumplimiento: number;
  semaforo: SemaforoRiesgo;
}

export interface AuditoriaPatronalResult {
  empresaId: string;
  razonSocial: string;
  ruc: string;
  nroPatronalMtess: string;
  nroPatronalIps: string;
  representanteLegal: string;
  fechaAuditoria: string;
  versionReglas: string;
  smlvAplicado: number;
  jornalMinimoAplicado: number;
  resumen: ResumenAuditoria;
  hallazgos: HallazgoAuditoria[];
  recomendaciones: RecomendacionTecnica[];
  planMitigacion: FaseMitigacion[];
}
