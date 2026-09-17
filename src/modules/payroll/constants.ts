/**
 * CONSTANTES LEGALES VERSIONADAS — PARAGUAY
 * Versión: PY-LIQ-2026.09.01
 *
 * IMPORTANTE: Nunca modificar silenciosamente estas constantes.
 * Cada cambio debe incrementar la versión y documentar la fuente.
 *
 * Fuentes:
 * - Ley N.º 213/93, Código del Trabajo (BACN)
 * - Decreto N.º 6225/2026 (Salario Mínimo 2026)
 * - IPS: Decreto-Ley N.º 1860/50, Art. 76
 */

// ─────────────────────────────────────────────────────────────────────────────
// Versión del Motor
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION_REGLAS = 'PY-LIQ-2026.09.01' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Salario Mínimo Vigente 2026
// Fuentes:
// - Decreto N.º 6225/2026
// - Resolución MTESS N.º 670/2026 (Reglamentación y Escala por Actividades)
// ─────────────────────────────────────────────────────────────────────────────

/** Salario mínimo mensual vigente en Guaraníes (Actividades diversas no especificadas) */
export const SALARIO_MINIMO_MENSUAL_2026 = 3_044_000; // Gs.

/** Salario mínimo diario legal (Jornal diurno general) */
export const SALARIO_MINIMO_DIARIO_2026 = 117_077; // Gs. (Res. MTESS 670/2026)

/** Salario mínimo nocturno con 30% recargo (Art. 231 Código Laboral) */
export const SALARIO_MINIMO_NOCTURNO_2026 = 3_957_200; // Gs.

export interface CategoriaSalarialMTESS {
  id: string;
  nombre: string;
  rubro: string;
  descripcion: string;
  salarioMensual: number;
  jornalDiario?: number;
  normativa: string;
}

/**
 * Escalas y Salarios Mínimos Diferenciados por Rubro / Actividad
 * Reglamentados por la Resolución MTESS N.º 670/2026 y leyes especiales
 */
export const CATEGORIAS_SALARIALES_MTESS: CategoriaSalarialMTESS[] = [
  {
    id: 'general_diurno',
    nombre: 'General / Comercio / Oficinas (Diurno)',
    rubro: 'General',
    descripcion: 'Comercio, industrias, servicios, oficinas',
    salarioMensual: 3_044_000,
    jornalDiario: 117_077,
    normativa: 'Decreto N.º 6225/2026 · Res. MTESS N.º 670/2026',
  },
  {
    id: 'trabajo_domestico',
    nombre: 'Trabajo Doméstico (Ley N.º 5407/15)',
    rubro: 'Doméstico',
    descripcion: 'Empleadas domésticas, niñeras, cocineras, cuidadores en el hogar',
    salarioMensual: 3_044_000,
    jornalDiario: 117_077,
    normativa: 'Ley N.º 5407/15 modificada por Ley N.º 6338/19',
  },
  {
    id: 'general_nocturno',
    nombre: 'Jornada Nocturna (Recargo 30%)',
    rubro: 'Jornada Especial',
    descripcion: 'Labores desempeñadas entre las 20:00 y las 06:00 hs',
    salarioMensual: 3_957_200,
    jornalDiario: 152_200,
    normativa: 'Art. 231 Código del Trabajo · Res. MTESS N.º 670/2026',
  },
  {
    id: 'guardia_seguridad_12h',
    nombre: 'Guardias de Seguridad (Jornada 12 hs)',
    rubro: 'Seguridad Privada',
    descripcion: 'Vigilancia y seguridad privada con régimen extendido reglamentario',
    salarioMensual: 4_566_001,
    normativa: 'Escala Especial Seguridad Privada · Res. MTESS N.º 670/2026',
  },
  {
    id: 'guardia_seguridad_8h',
    nombre: 'Guardias de Seguridad (Jornada 8 hs)',
    rubro: 'Seguridad Privada',
    descripcion: 'Vigilancia y custodia diurna en jornada estándar de 8 horas',
    salarioMensual: 3_044_000,
    jornalDiario: 117_077,
    normativa: 'Escala Básica Seguridad · Res. MTESS N.º 670/2026',
  },
  {
    id: 'enfermeria_profesional',
    nombre: 'Lic. en Enfermería / Salud (Privado)',
    rubro: 'Salud',
    descripcion: 'Profesionales de enfermería escalafonados (Ley N.º 3206/07)',
    salarioMensual: 3_957_200,
    normativa: 'Ley N.º 3206/07 del Ejercicio de la Enfermería · MTESS',
  },
  {
    id: 'enfermeria_tecnico',
    nombre: 'Técnicos / Auxiliares de Enfermería',
    rubro: 'Salud',
    descripcion: 'Personal técnico de asistencia sanitaria en sanatorios privados',
    salarioMensual: 3_348_400,
    normativa: 'Escala Sanatorios Privados · Res. MTESS N.º 670/2026',
  },
  {
    id: 'chofer_transporte',
    nombre: 'Choferes de Transporte / Carga',
    rubro: 'Transporte',
    descripcion: 'Conductores de transporte terrestre de cargas y pasajeros',
    salarioMensual: 3_500_600,
    normativa: 'Escala Transporte Terrestre · Res. MTESS N.º 670/2026',
  },
  {
    id: 'establecimiento_ganadero',
    nombre: 'Sector Ganadero / Agrícola (Peón)',
    rubro: 'Agropecuario',
    descripcion: 'Trabajadores de establecimientos ganaderos y agrícolas',
    salarioMensual: 3_044_000,
    normativa: 'Sección Agrícola-Ganadera · Res. MTESS N.º 670/2026',
  },
  {
    id: 'factura_honorarios',
    nombre: 'Facturo mi Salario Mensual (Honorarios / Sin IPS)',
    rubro: 'Facturación / Prestación de Servicios',
    descripcion: 'Emite factura mensual a la misma empresa (con presunción legal de relación de dependencia)',
    salarioMensual: 3_044_000,
    normativa: 'Arts. 18 y 19 Código del Trabajo (Ley N.º 213/93) · Principio de Primacía de la Realidad',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Divisor para Salario Diario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Divisor para calcular jornal diario desde salario mensual.
 * Uso operativo Paraguay: 30.
 * NOTA: El Art. 232 C.T. menciona "26 días" para el mínimo diario en ciertos casos,
 * pero el criterio operativo habitual para liquidaciones es ÷ 30.
 * VALIDAR con laboralista antes de producción.
 */
export const DIVISOR_JORNAL_DIARIO = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Escala de Vacaciones — Art. 218, Ley 213/93
// ─────────────────────────────────────────────────────────────────────────────

export const ESCALA_VACACIONES = [
  {
    hasta_anios: 5,           // hasta 5 años inclusive
    dias: 12,
    descripcion: 'Hasta 5 años de antigüedad',
    fuenteLegal: 'Art. 218 inc. a), Ley N.º 213/93',
  },
  {
    desde_anios: 5,           // más de 5 años
    hasta_anios: 10,          // hasta 10 años inclusive
    dias: 18,
    descripcion: 'Más de 5 y hasta 10 años de antigüedad',
    fuenteLegal: 'Art. 218 inc. b), Ley N.º 213/93',
  },
  {
    desde_anios: 10,          // más de 10 años
    dias: 30,
    descripcion: 'Más de 10 años de antigüedad',
    fuenteLegal: 'Art. 218 inc. c), Ley N.º 213/93',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Escala de Preaviso — Art. 87, Ley 213/93
// ─────────────────────────────────────────────────────────────────────────────

export const ESCALA_PREAVISO = [
  {
    hasta_anios: 1,           // cumplido periodo de prueba hasta 1 año
    dias: 30,
    descripcion: 'Cumplido el período de prueba hasta 1 año',
    fuenteLegal: 'Art. 87 inc. a), Ley N.º 213/93',
  },
  {
    desde_anios: 1,           // más de 1 año
    hasta_anios: 5,           // hasta 5 años
    dias: 45,
    descripcion: 'Más de 1 año y hasta 5 años de antigüedad',
    fuenteLegal: 'Art. 87 inc. b), Ley N.º 213/93',
  },
  {
    desde_anios: 5,           // más de 5 años
    hasta_anios: 10,          // hasta 10 años
    dias: 60,
    descripcion: 'Más de 5 y hasta 10 años de antigüedad',
    fuenteLegal: 'Art. 87 inc. c), Ley N.º 213/93',
  },
  {
    desde_anios: 10,          // más de 10 años
    dias: 90,
    descripcion: 'Más de 10 años de antigüedad',
    fuenteLegal: 'Art. 87 inc. d), Ley N.º 213/93',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Escala de Preaviso Trabajo Doméstico — Ley N.º 5407/15
// ─────────────────────────────────────────────────────────────────────────────

export const ESCALA_PREAVISO_DOMESTICO = [
  {
    hasta_anios: 1,           // Menor a 1 año (superado periodo prueba)
    dias: 7,
    descripcion: 'Antigüedad menor a 1 año',
    fuenteLegal: 'Ley N.º 5407/15 (Trabajo Doméstico)',
  },
  {
    desde_anios: 1,           // Mayor a 1 año
    dias: 15,
    descripcion: 'Antigüedad mayor a 1 año',
    fuenteLegal: 'Ley N.º 5407/15 (Trabajo Doméstico)',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Indemnización — Art. 91, Ley 213/93
// ─────────────────────────────────────────────────────────────────────────────

/** Salarios diarios por cada año de servicio o fracción > 6 meses (Art. 91 C.T.) */
export const DIAS_INDEMNIZACION_POR_ANIO = 15;

/**
 * Meses mínimos para que una fracción cuente como año completo en indemnización.
 * Art. 91: "fracción superior a seis (6) meses"
 * Interpretación: fracción > 6 meses = cuenta como 1 año.
 * Exactamente 6 meses: NO cuenta (debe ser "superior").
 * NOTA: Caso borde — exactamente 6 meses 0 días puede ser controversial. Validar.
 */
export const MESES_FRACCION_INDEMNIZACION = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Tasas IPS — Decreto-Ley N.º 1860/50, Art. 76
// ─────────────────────────────────────────────────────────────────────────────

export const IPS_TASAS = {
  /** Aporte del trabajador: 9% sobre base imponible */
  TRABAJADOR: 0.09,
  /** Aporte del empleador: 16.5% sobre base imponible */
  EMPLEADOR: 0.165,
} as const;

/**
 * Tabla de imponibilidad IPS.
 * NO aplicar 9% ciegamente. Cada concepto tiene tratamiento específico.
 * Fuente: Art. 76, Decreto-Ley N.º 1860/50.
 *
 * imponible: true = aporta al IPS
 * imponible: false = no aporta
 * imponible: 'validar' = requiere confirmación profesional
 */
export const IMPONIBILIDAD_IPS: Record<
  string,
  { imponible: boolean | 'validar'; nota: string; fuenteLegal: string }
> = {
  salario_base: {
    imponible: true,
    nota: 'Salario y jornales devengados integran el haber imponible para IPS',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  salario_pendiente: {
    imponible: true,
    nota: 'Salarios adeudados o proporcionales del período integran el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  horas_extras: {
    imponible: true,
    nota: 'Las horas extraordinarias integran el haber imponible para IPS',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  comisiones: {
    imponible: true,
    nota: 'Las comisiones y remuneraciones variables integran el haber imponible para IPS',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  vacaciones: {
    imponible: true,
    nota: 'Las vacaciones liquidadas integran el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  vacaciones_causadas: {
    imponible: true,
    nota: 'Vacaciones causadas no gozadas integran el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  vacaciones_proporcionales: {
    imponible: true,
    nota: 'Vacaciones proporcionales integran el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  vacaciones_periodos_anteriores: {
    imponible: true,
    nota: 'Vacaciones de períodos anteriores acumuladas integran el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  preaviso: {
    imponible: true,
    nota: 'El preaviso sustitutivo en dinero integra el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  preaviso_sustitutivo: {
    imponible: true,
    nota: 'El preaviso sustitutivo en dinero integra el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  preaviso_sustitutivo_parcial: {
    imponible: true,
    nota: 'El preaviso sustitutivo parcial en dinero integra el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  preaviso_retiro_justificado: {
    imponible: true,
    nota: 'El preaviso por retiro justificado integra el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  indemnizacion: {
    imponible: true,
    nota: 'La indemnización legal por despido injustificado integra el haber imponible',
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
  },
  aguinaldo: {
    imponible: false,
    nota: 'El aguinaldo está legalmente EXCLUIDO del salario imponible IPS',
    fuenteLegal: 'Art. 76 Decreto-Ley N.º 1860/50: "exceptuando los aguinaldos"',
  },
  aguinaldo_anterior_pendiente: {
    imponible: false,
    nota: 'El aguinaldo está legalmente EXCLUIDO del salario imponible IPS',
    fuenteLegal: 'Art. 76 Decreto-Ley N.º 1860/50: "exceptuando los aguinaldos"',
  },
  asignacion_familiar: {
    imponible: false,
    nota: 'La asignación familiar no es base para imposiciones IPS',
    fuenteLegal: 'Art. 268, Ley N.º 213/93',
  },
  bonificacion_familiar: {
    imponible: false,
    nota: 'La bonificación familiar no es base para imposiciones IPS ni cálculo de aguinaldo',
    fuenteLegal: 'Art. 268, Ley N.º 213/93',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Asignación Familiar — Art. 261, Ley 213/93
// ─────────────────────────────────────────────────────────────────────────────

/** Porcentaje de asignación familiar por hijo (5% del salario mínimo) — Art. 261 C.T. */
export const ASIGNACION_FAMILIAR_PORCENTAJE = 0.05;

/**
 * Límite de salario para percibir asignación familiar.
 * Si el trabajador gana más del 200% del salario mínimo, pierde el derecho — Art. 263 C.T.
 */
export const ASIGNACION_FAMILIAR_LIMITE_SALARIO = SALARIO_MINIMO_MENSUAL_2026 * 2;

/** Edad máxima de los hijos para cobrar asignación familiar — Art. 262 inc. a) C.T. */
export const ASIGNACION_FAMILIAR_EDAD_MAXIMA_HIJO = 17;

// ─────────────────────────────────────────────────────────────────────────────
// Período de Prueba — Art. 58, Ley 213/93
// ─────────────────────────────────────────────────────────────────────────────

export const PERIODO_PRUEBA_DIAS = {
  /** Personas domésticas y trabajadores no calificados: 30 días */
  NO_CALIFICADO: 30,
  /** Trabajadores calificados o aprendices: 60 días */
  CALIFICADO: 60,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes de Referencia del Motor
// ─────────────────────────────────────────────────────────────────────────────

export const FUENTES_LEGALES = {
  CODIGO_TRABAJO: {
    norma: 'Ley N.º 213/93',
    descripcion: 'Código del Trabajo de Paraguay',
    fuente: 'BACN (Biblioteca y Archivo Central del Congreso Nacional)',
  },
  IPS: {
    norma: 'Decreto-Ley N.º 1860/50',
    descripcion: 'Ley Orgánica del IPS',
    fuente: 'Instituto de Previsión Social — fuente oficial',
  },
  SALARIO_MINIMO_2026: {
    norma: 'Decreto N.º 6225/2026',
    descripcion: 'Fijación del Salario Mínimo 2026',
    fuente: 'Ministerio de Trabajo, Empleo y Seguridad Social (MTESS)',
  },
} as const;
