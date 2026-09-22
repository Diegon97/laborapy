/**
 * MOTOR DE LIQUIDACIÓN FINAL DE HABERES — PARAGUAY
 * Versión de reglas: PY-LIQ-2026.09.01
 * Fuente primaria: Ley N.º 213/93, Código del Trabajo (BACN)
 * Fuente IPS: Decreto-Ley N.º 1860/50
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export type MotivoEgreso =
  | 'renuncia'               // Art. 87-90 C.T. — preaviso del trabajador
  | 'despido_sin_causa'      // Art. 87, 91-92 C.T. — indemnización + preaviso
  | 'despido_con_causa'      // Art. 81 C.T. — sin indemnización ni preaviso sust.
  | 'abandono'               // Art. 81 inc. j C.T. — abandono de trabajo (con telegrama)
  | 'retiro_justificado'     // Art. 84 C.T. — verificar causa; resultado provisional
  | 'mutuo_acuerdo'          // Sin indemnización automática; depende de acuerdo
  | 'contrato_plazo_fijo'    // Flujo separado; activar alerta
  | 'periodo_prueba'         // Art. 58-60 C.T. — sin preaviso ni indemnización
  | 'jubilacion';            // Sin responsabilidad para las partes

export type RegimenIPS = 'general' | 'especial' | 'factura';
export type RegimenLaboral = 'general' | 'domestico';

export type TipoAlerta = 'roja' | 'amarilla' | 'info';
export type AccionAlerta =
  | 'derivar_profesional'
  | 'revisar'
  | 'informar';

// ─────────────────────────────────────────────────────────────────────────────
// Input del Motor
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidacionTelegramasAbandono {
  /** Número de telegrama colacionado de intimación remitido al trabajador */
  nroTelegramaIntimacion: string;
  /** Fecha de imposición/envío del telegrama en ventanilla (ISO 8601 YYYY-MM-DD) */
  fechaEnvioTelegrama: string;
  /** Plazo otorgado en horas (habitualmente 48 o 72 horas) */
  plazoHorasOtorgado: number;
  /** Fecha estimada o de acuse de vencimiento del plazo */
  fechaVencimientoPlazo?: string;
  /** Constancia fehaciente de notificación al domicilio del trabajador */
  notificadoEfectivo: boolean;
  /** Si el trabajador se reintegró a sus labores (si es true, NO se perfecciona el abandono) */
  reintegroCumplido: boolean;
}

export interface PreavisoInput {
  /** Quién tenía la obligación de preavisar */
  obligado: 'empleador' | 'trabajador';
  /** ¿Se otorgó el preaviso? */
  otorgado: boolean;
  /** Días efectivamente otorgados o cumplidos (si fue parcial) */
  diasOtorgados?: number;
  /** ¿La empresa exoneró formalmente al trabajador de cumplir el preaviso de renuncia? */
  exonerado?: boolean;
}

export interface LiquidacionInput {
  // ── Datos básicos ──────────────────────────────────────────────────────
  /** ISO 8601 (YYYY-MM-DD). Obligatorio. No puede ser posterior al egreso. */
  fechaIngreso: string;
  /** ISO 8601 (YYYY-MM-DD). Obligatorio. Opción "hoy" en UI. */
  fechaEgreso: string;
  /** Causa de la terminación del contrato */
  motivo: MotivoEgreso;
  /** Régimen legal laboral aplicable (General o Trabajo Doméstico Ley 5407/15) */
  regimenLaboral?: RegimenLaboral;

  // ── Empresa (para documentos) ─────────────────────────────────────────
  empresa?: string;
  codigoEmpleado?: string;
  nombreEmpleado?: string;
  ciEmpleado?: string;
  cargoEmpleado?: string;

  // ── Remuneración ───────────────────────────────────────────────────────
  /** Salario mensual bruto en Guaraníes. Mayor que 0. */
  salarioMensual: number;
  /** ¿El trabajador recibía comisiones, horas extras u otras variables? */
  tieneVariables: boolean;
  /**
   * Remuneraciones devengadas en el año calendario (enero → mes de egreso).
   * Necesario para calcular aguinaldo proporcional con variables.
   * Cada elemento representa un mes: index 0 = enero, etc.
   */
  remuneracionesAnio?: number[];
  /**
   * Remuneraciones de los últimos 6 meses previos al egreso.
   * Necesario para base de indemnización (Art. 92 inc. B).
   * Ordenadas del mes más antiguo al más reciente.
   */
  remuneracionesUltimos6Meses?: number[];

  // ── Vacaciones ─────────────────────────────────────────────────────────
  /** Días ya gozados en el período corriente (vacaciones causadas en el período actual) */
  vacacionesPeriodoActual?: number;
  /** Días pendientes de cobro del período actual (si se especifica directamente, sobreescribe el cálculo de días gozados) */
  vacacionesPeriodoActualPendientes?: number;
  /** Días pendientes de períodos anteriores (años anteriores no gozados) */
  vacacionesPeriodosAnteriores?: number;
  /**
   * Indica si las vacaciones de períodos anteriores están vencidas (> 6 meses del plazo de goce Art. 222 C.T.).
   * Si es true (por defecto en períodos cerrados), se abonan al doble (x2) conforme a los Arts. 221 y 223 C.T.
   */
  vacacionesAnterioresVencidas?: boolean;

  // ── Otros conceptos ────────────────────────────────────────────────────
  /** Monto de salarios pendientes (días del mes en curso), en Gs. */
  salariosPendientes?: number;

  // ── Preaviso ───────────────────────────────────────────────────────────
  preaviso?: PreavisoInput;

  // ── Descuentos comerciales adicionales ────────────────────────────────
  /** Deuda de compra de mercaderías u otros descuentos pactados */
  descuentosAdicionales?: { concepto: string; monto: number }[];

  // ── Aguinaldo de períodos anteriores impago ────────────────────────────
  /** Monto de aguinaldo adeudado del año anterior o períodos anteriores (Art. 243 C.T.) */
  aguinaldoAnteriorPendiente?: number;

  // ── Protección especial de maternidad y lactancia ──────────────────────
  /** Estado de gestación (embarazo) o lactancia materna (Ley N.º 5508/15) */
  estadoMaternidadLactancia?: 'ninguno' | 'embarazo' | 'lactancia';

  // ── Bonificación Familiar (Arts. 261 al 271, Ley 213/93) ───────────────
  /** Cantidad de hijos menores de 18 años (hasta 17 años cumplidos) */
  hijosMenoresACargo?: number;
  /** Cantidad de hijos con discapacidad acreditada (cobro vitalicio de por vida) */
  hijosDiscapacidad?: number;
  /** Si ambos progenitores trabajan en la misma empresa cliente (Art. 265 C.T.) */
  parejaTrabajaEnMismaEmpresa?: boolean;
  /** Si el colaborador liquidado es la madre (cobro exclusivo Art. 265) */
  esMadreTitular?: boolean;
  /** Salario de la madre en la misma empresa (si supera 2 SML, no cobra y no traslada al padre) */
  salarioMadreMismaEmpresa?: number;
  /** Asignaciones familiares adeudadas de meses anteriores pendientes de cobro */
  bonificacionFamiliarPendiente?: number;

  // ── Validación de Abandono de Trabajo (Art. 81 inc. j C.T.) ─────────────
  /** Constancia y validación de intimación por telegrama colacionado */
  validacionAbandono?: ValidacionTelegramasAbandono;

  // ── Comisiones y Horas Extras (Haber Imponible) ──────────────────────
  /** Monto de comisiones devengadas en el período corriente, en Gs. */
  comisiones?: number;
  /** Monto de horas extraordinarias devengadas en el período corriente, en Gs. */
  horasExtras?: number;

  // ── Configuración ──────────────────────────────────────────────────────
  /** Régimen IPS del trabajador */
  regimen?: RegimenIPS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes del Resultado
// ─────────────────────────────────────────────────────────────────────────────

export interface Concepto {
  /** Identificador único del concepto (ej: "indemnizacion", "preaviso") */
  id: string;
  /** Nombre legible para mostrar en UI y PDF */
  nombre: string;
  /** Monto en Guaraníes */
  monto: number;
  /** Días utilizados en el cálculo (si aplica) */
  dias?: number;
  /** Base salarial utilizada (salario diario, mensual, promedio, etc.) */
  base?: number;
  /** Fórmula simplificada para mostrar en "¿Cómo se calculó?" */
  formula?: string;
  /** Artículo y norma legal de la que surge el concepto */
  fuenteLegal: string;
  /**
   * Mensaje de incertidumbre si el dato es estimado o requiere validación
   * profesional. Si está presente, mostrar advertencia en la UI.
   */
  incertidumbre?: string;
  /** true = descuento (se resta del total bruto) */
  esDescuento: boolean;
  /** Si es exento de IPS */
  exentoIPS?: boolean;
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  mensaje: string;
  accion: AccionAlerta;
}

export interface FuenteLegal {
  norma: string;
  articulo: string;
  concepto: string;
}

export interface Antiguedad {
  years: number;
  months: number;
  days: number;
  /** Total de días para cálculos internos */
  totalDias: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado del Motor
// ─────────────────────────────────────────────────────────────────────────────

export interface LiquidacionResult {
  /** Suma de todos los conceptos que NO son descuento */
  totalBruto: number;
  /**
   * Aguinaldo proporcional (separado porque es EXENTO de IPS).
   * Art. 76 Decreto-Ley IPS: "exceptuando los aguinaldos"
   */
  aguinaldoProporcional: number;
  /** Suma de todos los conceptos marcados como descuento */
  totalDescuentos: number;
  /**
   * Neto estimado = Total Bruto - Total Descuentos + Aguinaldo Proporcional
   * ESTIMACIÓN REFERENCIAL — sujeta a revisión profesional
   */
  totalNetoEstimado: number;
  /**
   * Base imponible total para aportes jubilatorios IPS (Haber Imponible).
   * Suma de salarios, comisiones, horas extras, vacaciones, indemnización y preaviso.
   */
  baseImponibleIPS?: number;
  /** Lista detallada de conceptos (ingresos y descuentos) */
  conceptos: Concepto[];
  /** Alertas generadas por el motor */
  alertas: Alerta[];
  /** Antigüedad calculada cronológicamente */
  antiguedad: Antiguedad;
  /** Fuentes legales utilizadas */
  fuentes: FuenteLegal[];
  /** Versión del conjunto de reglas utilizado */
  versionReglas: string;
  /** Monto neto en letras en Guaraníes */
  montoEnLetras: string;
  /**
   * Indica si el resultado es definitivo o provisional.
   * Es provisional cuando faltan datos de variables o hay alertas rojas.
   */
  esProvisional: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errores de validación
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  mensaje: string;
}

export interface ValidationResult {
  valido: boolean;
  errores: ValidationError[];
}
