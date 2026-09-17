/**
 * MTESS Export Service — Paraguay
 * Genera planillas oficiales del Ministerio de Trabajo, Empleo y Seguridad Social (MTESS):
 *   1. Planilla Mensual de Salarios (32 columnas exactas)
 *   2. Planilla de Liquidaciones (27 columnas exactas)
 *
 * Cumple estrictamente con:
 *   - Decreto N° 1989/2024 y Resoluciones MTESS 991/2024 y 462/2026.
 *   - Aporte Seg. Social = 9% exacto sobre haberes imponibles (coincidencia con REI-IPS).
 *   - Regla de Cero Obligatorio: ningún concepto numérico se deja vacío o en blanco (se usa 0).
 *   - Máximo 3 descuentos adicionales para mensual y liquidaciones (excedentes a "Descuentos varios").
 *   - Máximo 2 asignaciones adicionales en liquidaciones.
 *   - Agrupación Multi-Patronal MTESS: Permite que empleados con la misma patronal IPS
 *     se dividan automáticamente en archivos Excel separados según su patronal MTESS (ej. ASU vs CDE).
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* -------------------------------------------------------------------------- */
/*                                  TIPOS                                     */
/* -------------------------------------------------------------------------- */

export type FormaPago = 1 | 2 | 3; // 1=Efectivo, 2=Cheque, 3=Banco/Transferencia

export interface DescuentoRecord {
  concepto: string | number;
  monto: number;
}

export interface AsignacionRecord {
  concepto: string | number;
  monto: number;
}

export interface MtessMonthlyEmployeeRecord {
  numeroPatronalMtess: number | string;
  sucursalLabel?: string; // Ej: 'ASU', 'CDE'
  patronalIps?: string;   // Patronal común en IPS

  ci: number | string;

  periodoDesde: Date | string; // YYYY-MM-DD o Date
  periodoHasta: Date | string; // YYYY-MM-DD o Date

  formaPago: FormaPago;

  diasTrabajados: number;
  piezasTareas?: number;
  horasOrdinarias: number;
  horasExtraordinarias?: number;

  salarioBasico: number;

  comisiones?: number;
  horasExtras50?: number;
  recargoNocturno?: number;
  horasExtras100?: number;
  premios?: number;
  salarioEspecie?: number;
  regalias?: number;
  gratificaciones?: number;
  gradoAcademico?: number;
  feriados?: number;
  dietas?: number;
  complementoSalarial?: number;
  bonificacionFamiliar?: number;
  antiguedad?: number;

  anticipos?: number;

  /** Si no se provee, se calcula como el 9% redondeado de los conceptos imponibles */
  aporteSegSocial?: number;

  /** Máximo 3; si vienen más se consolidan en 'Descuentos varios' */
  descuentosAdicionales?: DescuentoRecord[];
}

export interface MtessSettlementEmployeeRecord {
  numeroPatronalMtess: number | string;
  sucursalLabel?: string;
  ci: number | string;

  fechaPago: Date | string;
  formaPago: FormaPago;

  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtraordinarias?: number;

  salarioBasico: number;
  horasExtras50?: number;
  horasExtras100?: number;

  preaviso?: number;
  indemnizacion?: number;
  vacacionesProporcionales?: number;
  vacacionesCausadas?: number;
  aguinaldoProporcional?: number;
  bonificacionFamiliar?: number;

  /** Máximo 2 asignaciones adicionales */
  otrasAsignaciones?: AsignacionRecord[];

  /** 9% IPS sobre haberes imponibles */
  aporteSegSocial: number;

  /** Máximo 3 descuentos */
  descuentos?: DescuentoRecord[];
}

export interface MtessWorkbookResult {
  patronal: string | number;
  sucursal: string;
  workbook: XLSX.WorkBook;
  fileName: string;
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTES                                  */
/* -------------------------------------------------------------------------- */

/**
 * Encabezados EXACTOS requeridos por el validador del MTESS.
 * Nota: ' horas_ordinarias ' contiene intencionalmente los espacios laterales oficiales.
 */
export const MTESS_MONTHLY_COLUMNS = [
  'numero_patronal',
  'nro_ci',
  'periodo_pago_desde',
  'periodo_pago_hasta',
  'forma_de_pago',
  'canti_dias_trabajados',
  'canti_piezas_tareas',
  ' horas_ordinarias ',
  'horas_extraordinarias',
  'Salario Básico',
  'Comisiones',
  'Horas extras diurnas(50%)',
  'Recargo horario Nocturno',
  'Horas extras nocturnas(100%)',
  'Premios',
  'Salario en especie (Max 30%)',
  'Regalias',
  'Gratificaciones',
  'Grado Académico',
  'Feriados',
  'Dietas',
  'Complemento Salarial',
  'Bonificacion Familiar',
  'Antigüedad',
  'Anticipos de salario',
  'Aporte Seg. Social',
  'Descuentos 1',
  'Concepto descuentos 1',
  'Descuentos 2',
  'Concepto descuentos 2',
  'Descuentos 3',
  'Concepto descuentos 3',
] as const;

export const MTESS_SETTLEMENT_COLUMNS = [
  'numero_patronal',
  'nro_ci',
  'fecha_de_pago',
  'forma_de_pago',
  'canti_dias_trabajados',
  'horas_ordinarias',
  'horas_extraordinarias',
  'salario_basico',
  'horas_extras_diurnas_50',
  'horas_extras_nocturnas_100',
  'preaviso',
  'indemnizacion',
  'vacaciones_proporcionales',
  'vacaciones_causadas',
  'aguinaldo_proporcional',
  'bonificacion_familiar',
  'otras_asignaciones_1',
  'concepto_otras_asignaciones_1',
  'otras_asignaciones_2',
  'concepto_otras_asignaciones_2',
  'aporte_seg_social',
  'descuentos_1',
  'concepto_descuentos_1',
  'descuentos_2',
  'concepto_descuentos_2',
  'descuentos_3',
  'concepto_descuentos_3',
] as const;

const MAX_MONTHLY_DESCUENTOS = 3;
const MAX_SETTLEMENT_ASIGNACIONES = 2;
const MAX_SETTLEMENT_DESCUENTOS = 3;
const IPS_APORTE_RATE = 0.09;

const MESES_ES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

/* -------------------------------------------------------------------------- */
/*                                UTILIDADES                                  */
/* -------------------------------------------------------------------------- */

/** Convierte cualquier valor a número seguro (0 si es null/undefined/vacío/NaN). */
function n(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Redondeo seguro a 2 decimales para importes */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Redondeo entero para el aporte IPS según la práctica contable y el MTESS */
function round0(value: number): number {
  return Math.round(value);
}

/**
 * Formatea una fecha como string YYYY-MM-DD sin riesgo de desplazamiento por zona horaria UTC.
 */
export function formatDateYMD(date: Date | string): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const dmyMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * Extrae mes y año de forma segura sin sesgo de UTC/Timezone.
 */
function extractPeriod(date: Date | string): { mes: number; anio: number } {
  if (typeof date === 'string') {
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const anio = Number(isoMatch[1]);
      const mes = Number(isoMatch[2]);
      if (mes >= 1 && mes <= 12) return { mes, anio };
    }
    const dmyMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmyMatch) {
      const anio = Number(dmyMatch[3]);
      const mes = Number(dmyMatch[2]);
      if (mes >= 1 && mes <= 12) return { mes, anio };
    }
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return { mes: parsed.getMonth() + 1, anio: parsed.getFullYear() };
    }
  } else if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return { mes: date.getMonth() + 1, anio: date.getFullYear() };
  }
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

/** Sanitiza identificadores para nombres de archivo */
function sanitizeId(value: number | string): string {
  return String(value ?? '').replace(/[^0-9A-Za-z_-]/g, '');
}

/** Sanitiza nombres de hoja en Excel (máx 31 caracteres, caracteres válidos) */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*\[\]]/g, ' ').trim();
  return cleaned.length > 31 ? cleaned.substring(0, 31) : cleaned;
}

/** Determina si estamos en un entorno con DOM/Navegador disponible */
function isBrowserEnv(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/* -------------------------------------------------------------------------- */
/*                       CÁLCULO DE HABERES IMPONIBLES                        */
/* -------------------------------------------------------------------------- */

/**
 * Conceptos imponibles para el aporte de IPS (9%):
 * Incluye: Salario básico, comisiones, horas extras, recargo nocturno, premios,
 * gratificaciones, feriados, dietas, complementos salariales, antigüedad, regalías y grado académico.
 * Excluye: Bonificación familiar (no imponible) y asignaciones no remunerativas.
 */
function calcularBaseImponibleMensual(r: MtessMonthlyEmployeeRecord): number {
  const base =
    n(r.salarioBasico) +
    n(r.comisiones) +
    n(r.horasExtras50) +
    n(r.horasExtras100) +
    n(r.recargoNocturno) +
    n(r.premios) +
    n(r.gratificaciones) +
    n(r.feriados) +
    n(r.dietas) +
    n(r.complementoSalarial) +
    n(r.antiguedad) +
    n(r.regalias) +
    n(r.gradoAcademico);
  return round2(base);
}

/** Calcula el 9% IPS redondeado a enteros */
function calcularAporteSegSocial(baseImponible: number): number {
  return round0(baseImponible * IPS_APORTE_RATE);
}

/**
 * Conceptos imponibles para el aporte de IPS (9%) en liquidaciones finales:
 * Conforme a la legislación laboral paraguaya (Art. 76 D.Ley 1860/50) y a las planillas oficiales del MTESS:
 * Gravados con IPS (aportan 9% obrero):
 *   - Salario básico devengado (días trabajados en el mes de salida)
 *   - Horas extraordinarias (50% y 100%)
 *   - Preaviso (indemnización sustitutiva de preaviso)
 *   - Indemnización legal por despido injustificado
 *   - Vacaciones proporcionales
 *   - Vacaciones causadas / vencidas de períodos anteriores
 *   - Otras asignaciones adicionales (1 y 2)
 * Excluidos de IPS (exentos del 9%):
 *   - Aguinaldo proporcional (Art. 245 Código del Trabajo)
 *   - Bonificación familiar (Art. 270 Código del Trabajo)
 */
export function calcularBaseImponibleLiquidacion(r: MtessSettlementEmployeeRecord): number {
  const asign1 = r.otrasAsignaciones?.[0]?.monto || 0;
  const asign2 = r.otrasAsignaciones?.[1]?.monto || 0;
  const base =
    n(r.salarioBasico) +
    n(r.horasExtras50) +
    n(r.horasExtras100) +
    n(r.preaviso) +
    n(r.indemnizacion) +
    n(r.vacacionesProporcionales) +
    n(r.vacacionesCausadas) +
    n(asign1) +
    n(asign2);
  return round2(base);
}

/* -------------------------------------------------------------------------- */
/*                   NORMALIZACIÓN DE DESCUENTOS / ASIGNACIONES               */
/* -------------------------------------------------------------------------- */

interface FilledDescuentos {
  descuentos: Array<{ monto: number; concepto: string | number }>;
}

/**
 * Normaliza y consolida descuentos adicionales respetando el límite de 3 conceptos del MTESS.
 * Si existen más de 3 descuentos, los excedentes se consolidan automáticamente bajo "Descuentos varios".
 * En cumplimiento estricto con el validador del MTESS, si no hay concepto o monto se asigna 0 (nunca vacío).
 */
function normalizeDescuentosAdicionales(
  list: DescuentoRecord[] | undefined,
  max: number = MAX_MONTHLY_DESCUENTOS,
): FilledDescuentos {
  const input = Array.isArray(list) ? list.filter((d) => d && n(d.monto) > 0) : [];

  const extractConcepto = (raw: unknown): string | number => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return raw;
    const str = String(raw).trim();
    return str === '' ? 0 : str;
  };

  if (input.length <= max) {
    const padded = [...input];
    while (padded.length < max) padded.push({ monto: 0, concepto: 0 });
    return {
      descuentos: padded.map((d) => ({
        monto: round2(n(d.monto)),
        concepto: extractConcepto(d.concepto),
      })),
    };
  }

  // Si supera el límite permitido por el MTESS:
  const principales = input.slice(0, max - 1);
  const extras = input.slice(max - 1);
  const totalExtra = extras.reduce((acc, d) => acc + n(d.monto), 0);

  const result: Array<{ monto: number; concepto: string | number }> = principales.map((d) => ({
    monto: round2(n(d.monto)),
    concepto: extractConcepto(d.concepto),
  }));
  result.push({
    monto: round2(totalExtra),
    concepto: 'Descuentos varios',
  });
  return { descuentos: result };
}

/** Normaliza asignaciones adicionales (Liquidación, máx 2 asignaciones). Vacíos a 0. */
function normalizeAsignaciones(
  list: AsignacionRecord[] | undefined,
  max: number = MAX_SETTLEMENT_ASIGNACIONES,
): Array<{ monto: number; concepto: string | number }> {
  const input = Array.isArray(list) ? list.filter((a) => a && n(a.monto) > 0) : [];
  const extractConcepto = (raw: unknown): string | number => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return raw;
    const str = String(raw).trim();
    return str === '' ? 0 : str;
  };

  const result: Array<{ monto: number; concepto: string | number }> = input.slice(0, max).map((a) => ({
    monto: round2(n(a.monto)),
    concepto: extractConcepto(a.concepto),
  }));
  while (result.length < max) result.push({ monto: 0, concepto: 0 });
  return result;
}

/* -------------------------------------------------------------------------- */
/*                        CONSTRUCCIÓN DE FILAS (AOA)                         */
/* -------------------------------------------------------------------------- */

type CellValue = string | number;

/** Construye la fila de la Planilla Mensual como array de 32 valores exactos. */
function buildMonthlyRow(r: MtessMonthlyEmployeeRecord): CellValue[] {
  const descuentos = normalizeDescuentosAdicionales(
    r.descuentosAdicionales,
    MAX_MONTHLY_DESCUENTOS,
  );
  const baseImponible = calcularBaseImponibleMensual(r);
  const aporteSegSocial =
    r.aporteSegSocial !== undefined && r.aporteSegSocial !== null
      ? round0(n(r.aporteSegSocial))
      : calcularAporteSegSocial(baseImponible);

  const d1 = descuentos.descuentos[0] ?? { monto: 0, concepto: 0 };
  const d2 = descuentos.descuentos[1] ?? { monto: 0, concepto: 0 };
  const d3 = descuentos.descuentos[2] ?? { monto: 0, concepto: 0 };

  // Manejo de documento y patronal preservando texto o valor numérico
  const nroPatronal = typeof r.numeroPatronalMtess === 'number' ? r.numeroPatronalMtess : String(r.numeroPatronalMtess ?? '').trim();
  const nroCi = typeof r.ci === 'number' ? r.ci : String(r.ci ?? '').trim();

  return [
    nroPatronal,
    nroCi,
    formatDateYMD(r.periodoDesde),
    formatDateYMD(r.periodoHasta),
    n(r.formaPago) || 3, // Default 3 (Banco) si no se especifica
    n(r.diasTrabajados) || 30, // Default 30 días
    n(r.piezasTareas), // 0 obligatorio
    n(r.horasOrdinarias) || 192, // ' horas_ordinarias '
    n(r.horasExtraordinarias), // 0 obligatorio si no hubo
    round2(n(r.salarioBasico)),
    round2(n(r.comisiones)), // 0 obligatorio
    round2(n(r.horasExtras50)),
    round2(n(r.recargoNocturno)),
    round2(n(r.horasExtras100)),
    round2(n(r.premios)),
    round2(n(r.salarioEspecie)),
    round2(n(r.regalias)),
    round2(n(r.gratificaciones)),
    round2(n(r.gradoAcademico)),
    round2(n(r.feriados)),
    round2(n(r.dietas)),
    round2(n(r.complementoSalarial)),
    round2(n(r.bonificacionFamiliar)),
    round2(n(r.antiguedad)),
    round2(n(r.anticipos)),
    aporteSegSocial, // 9% IPS
    d1.monto,
    d1.concepto !== undefined && d1.concepto !== null && d1.concepto !== '' ? d1.concepto : 0,
    d2.monto,
    d2.concepto !== undefined && d2.concepto !== null && d2.concepto !== '' ? d2.concepto : 0,
    d3.monto,
    d3.concepto !== undefined && d3.concepto !== null && d3.concepto !== '' ? d3.concepto : 0,
  ];
}

/** Construye la fila de la Planilla de Liquidación como array de 27 valores exactos. */
function buildSettlementRow(r: MtessSettlementEmployeeRecord): CellValue[] {
  const asignaciones = normalizeAsignaciones(
    r.otrasAsignaciones,
    MAX_SETTLEMENT_ASIGNACIONES,
  );
  const descuentos = normalizeDescuentosAdicionales(
    r.descuentos,
    MAX_SETTLEMENT_DESCUENTOS,
  );

  const a1 = asignaciones[0] ?? { monto: 0, concepto: 0 };
  const a2 = asignaciones[1] ?? { monto: 0, concepto: 0 };
  const d1 = descuentos.descuentos[0] ?? { monto: 0, concepto: 0 };
  const d2 = descuentos.descuentos[1] ?? { monto: 0, concepto: 0 };
  const d3 = descuentos.descuentos[2] ?? { monto: 0, concepto: 0 };

  const nroPatronal = typeof r.numeroPatronalMtess === 'number' ? r.numeroPatronalMtess : String(r.numeroPatronalMtess ?? '').trim();
  const nroCi = typeof r.ci === 'number' ? r.ci : String(r.ci ?? '').trim();

  const baseImponibleLiq = calcularBaseImponibleLiquidacion(r);
  const aporteSegSocial =
    r.aporteSegSocial !== undefined && r.aporteSegSocial !== null && r.aporteSegSocial > 0
      ? round0(n(r.aporteSegSocial))
      : round0(baseImponibleLiq * IPS_APORTE_RATE);

  return [
    nroPatronal,
    nroCi,
    formatDateYMD(r.fechaPago),
    n(r.formaPago) || 2, // 2=Cheque / 3=Banco
    n(r.diasTrabajados),
    n(r.horasOrdinarias),
    n(r.horasExtraordinarias),
    round2(n(r.salarioBasico)),
    round2(n(r.horasExtras50)),
    round2(n(r.horasExtras100)),
    round2(n(r.preaviso)),
    round2(n(r.indemnizacion)),
    round2(n(r.vacacionesProporcionales)),
    round2(n(r.vacacionesCausadas)),
    round2(n(r.aguinaldoProporcional)),
    round2(n(r.bonificacionFamiliar)),
    a1.monto,
    a1.concepto !== undefined && a1.concepto !== null && a1.concepto !== '' ? a1.concepto : 0,
    a2.monto,
    a2.concepto !== undefined && a2.concepto !== null && a2.concepto !== '' ? a2.concepto : 0,
    aporteSegSocial,
    d1.monto,
    d1.concepto !== undefined && d1.concepto !== null && d1.concepto !== '' ? d1.concepto : 0,
    d2.monto,
    d2.concepto !== undefined && d2.concepto !== null && d2.concepto !== '' ? d2.concepto : 0,
    d3.monto,
    d3.concepto !== undefined && d3.concepto !== null && d3.concepto !== '' ? d3.concepto : 0,
  ];
}

/* -------------------------------------------------------------------------- */
/*                           CONSTRUCCIÓN DE WORKBOOKS                        */
/* -------------------------------------------------------------------------- */

function createWorksheet(
  headers: readonly string[],
  rows: CellValue[][],
): XLSX.WorkSheet {
  // Sanitización profunda: ninguna celda de datos puede quedar vacía, null, undefined, string en blanco o NaN.
  // Regla de Cero Obligatorio del MTESS: Todo concepto o importe vacío se convierte a 0.
  const sanitizedRows: CellValue[][] = rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return 0;
      if (typeof cell === 'string' && cell.trim() === '') return 0;
      if (typeof cell === 'number' && Number.isNaN(cell)) return 0;
      return cell;
    }),
  );

  const aoa: CellValue[][] = [headers.slice() as CellValue[], ...sanitizedRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = headers.map((h) => {
    const len = Math.max(String(h).length + 2, 12);
    return { wch: Math.min(len, 32) };
  });

  return ws;
}

function buildSheetName(
  prefix: 'MENSUAL' | 'LIQUIDACION',
  sucursal: string | undefined,
  mes: number,
): string {
  const mesNombre = MESES_ES[Math.max(0, Math.min(11, mes - 1))] ?? '';
  const parts: string[] = [prefix];
  if (sucursal) parts.push(sucursal.toUpperCase());
  if (mesNombre) parts.push(mesNombre);
  return sanitizeSheetName(parts.join(' '));
}

/* -------------------------------------------------------------------------- */
/*              GENERACIÓN DE WORKBOOKS POR PATRONAL (MENSUAL)                */
/* -------------------------------------------------------------------------- */

/**
 * Agrupa empleados por `numeroPatronalMtess` y genera un Workbook por grupo.
 * Soporta empresas con 1 patronal en IPS pero múltiples patronales en MTESS (ej. ASU y CDE).
 */
export function generateMtessMonthlyWorkbooks(
  records: MtessMonthlyEmployeeRecord[],
): Map<string, MtessWorkbookResult> {
  const result = new Map<string, MtessWorkbookResult>();
  if (!Array.isArray(records) || records.length === 0) return result;

  const groups = new Map<string, MtessMonthlyEmployeeRecord[]>();
  for (const rec of records) {
    if (!rec) continue;
    const key = String(rec.numeroPatronalMtess ?? '').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rec);
  }

  for (const [key, groupRecords] of groups.entries()) {
    const first = groupRecords[0];
    const sucursal =
      (first.sucursalLabel || groupRecords.find((r) => r.sucursalLabel)?.sucursalLabel || '')
        .toString()
        .toUpperCase();

    const { mes, anio } = extractPeriod(first.periodoHasta ?? first.periodoDesde);

    const rows: CellValue[][] = groupRecords.map(buildMonthlyRow);
    const sheetName = buildSheetName('MENSUAL', sucursal || undefined, mes);
    const ws = createWorksheet(MTESS_MONTHLY_COLUMNS, rows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const sucursalSuffix = sucursal ? `_${sucursal}` : '';
    const mesNombre = MESES_ES[mes - 1] ?? mes;
    const fileName = `MENSUAL_MTESS_${sanitizeId(key)}${sucursalSuffix}_${mesNombre}_${anio}.xlsx`;

    result.set(key, {
      patronal: first.numeroPatronalMtess ?? key,
      sucursal: sucursal || 'CASA_MATRIZ',
      workbook: wb,
      fileName,
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*            GENERACIÓN DE WORKBOOKS POR PATRONAL (LIQUIDACIONES)            */
/* -------------------------------------------------------------------------- */

/**
 * Agrupa liquidaciones por `numeroPatronalMtess` y genera un Workbook separado por patronal MTESS.
 */
export function generateMtessSettlementWorkbooks(
  records: MtessSettlementEmployeeRecord[],
): Map<string, MtessWorkbookResult> {
  const result = new Map<string, MtessWorkbookResult>();
  if (!Array.isArray(records) || records.length === 0) return result;

  const groups = new Map<string, MtessSettlementEmployeeRecord[]>();
  for (const rec of records) {
    if (!rec) continue;
    const key = String(rec.numeroPatronalMtess ?? '').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rec);
  }

  for (const [key, groupRecords] of groups.entries()) {
    const first = groupRecords[0];
    const sucursal =
      (first.sucursalLabel || groupRecords.find((r) => r.sucursalLabel)?.sucursalLabel || '')
        .toString()
        .toUpperCase();

    const { mes, anio } = extractPeriod(first.fechaPago);

    const rows: CellValue[][] = groupRecords.map(buildSettlementRow);
    const sheetName = buildSheetName('LIQUIDACION', sucursal || undefined, mes);
    const ws = createWorksheet(MTESS_SETTLEMENT_COLUMNS, rows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const sucursalSuffix = sucursal ? `_${sucursal}` : '';
    const mesNombre = MESES_ES[mes - 1] ?? mes;
    const fileName = `LIQUIDACIONES_MTESS_${sanitizeId(key)}${sucursalSuffix}_${mesNombre}_${anio}.xlsx`;

    result.set(key, {
      patronal: first.numeroPatronalMtess ?? key,
      sucursal: sucursal || 'CASA_MATRIZ',
      workbook: wb,
      fileName,
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                          EXPORTACIÓN / DESCARGA                            */
/* -------------------------------------------------------------------------- */

/**
 * Descarga un único workbook como archivo .xlsx.
 * Seguro en entornos Node / Vitest (no lanza excepción si no hay DOM).
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): boolean {
  if (!isBrowserEnv()) {
    return false;
  }
  try {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, fileName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga TODOS los workbooks de un Map (uno por patronal MTESS).
 * Retorna la lista de archivos generados para trazabilidad.
 */
export function downloadMtessWorkbooks(
  workbooks: Map<string, MtessWorkbookResult>,
): Array<{ patronal: string | number; sucursal: string; fileName: string }> {
  const generated: Array<{ patronal: string | number; sucursal: string; fileName: string }> = [];
  for (const [, value] of workbooks.entries()) {
    downloadWorkbook(value.workbook, value.fileName);
    generated.push({
      patronal: value.patronal,
      sucursal: value.sucursal,
      fileName: value.fileName,
    });
  }
  return generated;
}

/* -------------------------------------------------------------------------- */
/*                          API DE ALTO NIVEL                                 */
/* -------------------------------------------------------------------------- */

export function exportMtessMonthly(
  records: MtessMonthlyEmployeeRecord[],
): Array<{ patronal: string | number; sucursal: string; fileName: string }> {
  const workbooks = generateMtessMonthlyWorkbooks(records);
  return downloadMtessWorkbooks(workbooks);
}

export function exportMtessSettlements(
  records: MtessSettlementEmployeeRecord[],
): Array<{ patronal: string | number; sucursal: string; fileName: string }> {
  const workbooks = generateMtessSettlementWorkbooks(records);
  return downloadMtessWorkbooks(workbooks);
}

/* -------------------------------------------------------------------------- */
/*                    HELPERS PÚBLICOS ÚTILES PARA TESTING                    */
/* -------------------------------------------------------------------------- */

export const __test__ = {
  n,
  round0,
  round2,
  formatDateYMD,
  extractPeriod,
  calcularBaseImponibleMensual,
  calcularBaseImponibleLiquidacion,
  calcularAporteSegSocial,
  normalizeDescuentosAdicionales,
  normalizeAsignaciones,
  buildMonthlyRow,
  buildSettlementRow,
  buildSheetName,
};
