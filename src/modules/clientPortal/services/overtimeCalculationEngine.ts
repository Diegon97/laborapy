/**
 * Motor de cálculo de Horas Extras y Recargos - LaboraPy
 * Basado estrictamente en las reglas y prototipo provistos para Paraguay (Ley N.º 213/93 Código del Trabajo):
 *  - Jornal = Salario mensual / 30
 *  - Hora   = Jornal / 8
 *  - HE 50% diurna (Lunes a Sábado)  -> hora * 1.5
 *  - HE 100% diurna (Domingos o Feriados) -> hora * 2.0
 *  - HE 130% nocturna (Horas extras después de las 20:00) -> hora * 2.6
 *  - Recargo Nocturno 30% (Horas normales después de las 20:00) -> hora * 0.3
 *  - Feriado trabajado = +1 jornal adicional
 *  - Día libre trabajado = +1 jornal adicional
 */

export type DiaSemana =
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado'
  | 'Domingo';

export interface DiaMarcacionInput {
  dia: DiaSemana | string;
  turnoId?: string;
  /** Formato 'H:mm' o 'HH:mm' (ej. '5:50', '8:00', '7:30', '6:00', '0:00') */
  jornadaPactada: string;
  /** Formato 'HH:mm' o '' si no se trabajó */
  horaEntrada: string;
  /** Formato 'HH:mm' o '' si no se trabajó */
  horaSalida: string;
  /** Minutos de descanso intermedio a descontar (por defecto 40, o 0) */
  descansoMinutos: number;
  esFeriado: boolean;
  esDiaLibreTrabajado: boolean;
}

export interface DiaMarcacionResult {
  dia: string;
  esDomingo: boolean;
  esFeriado: boolean;
  esDiaLibreTrabajado: boolean;
  minutosTrabajadosNetos: number;
  jornadaPactadaMinutos: number;
  he50Minutos: number;
  he100Minutos: number;
  he130Minutos: number;
  recargoNocturnoMinutos: number;
  jornalesExtra: number;
  montoGs: number;
  montoHe50Gs: number;
  montoHe100Gs: number;
  montoHe130Gs: number;
  montoRecargoNocturnoGs: number;
  montoJornalesExtraGs: number;
  estado: 'normal' | 'no_trabajo' | 'incompleto' | 'error_horas';
  nota: string;
}

export interface SemanaOvertimeTotales {
  totalMinutosNetos: number;
  totalHe50Minutos: number;
  totalHe100Minutos: number;
  totalHe130Minutos: number;
  totalRecargoNocturnoMinutos: number;
  totalJornalesExtra: number;
  totalMontoGs: number;
}

export interface SemanaOvertimeResult {
  salarioMensual: number;
  valorJornal: number;
  valorHora: number;
  tarifa50: number;
  tarifa100: number;
  tarifa130: number;
  tarifaRecargoNocturno: number;
  dias: DiaMarcacionResult[];
  totales: SemanaOvertimeTotales;
}

/* ============================================================
 *  CONSTANTES
 * ============================================================ */

/** Hora tope a partir de la cual rige el cómputo nocturno (20:00 = 1200 minutos desde 00:00) */
export const NOCHE_MINUTOS = 20 * 60; // 1200 minutos

/** Orden canónico de los días de la semana */
export const ORDEN_DIAS_SEMANA: DiaSemana[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export const TURNOS_PREDEFINIDOS = [
  { id: 'manana', label: 'Mañana (08:30–15:00)', j: '5:50' },
  { id: 'mixto',  label: 'Mixto (14:30–21:00)',  j: '6:00' },
  { id: 't8',     label: '8 horas (08:30–17:00)', j: '7:30' },
  { id: 'full',   label: 'Full fin de semana',    j: '8:00' },
  { id: 'libre',  label: 'Día libre / no trabaja', j: '0:00' },
];

/* ============================================================
 *  HELPERS DE PARSEO / FORMATEO
 * ============================================================ */

/**
 * Convierte una cadena 'HH:mm' o 'H:mm' a minutos desde las 00:00.
 * Devuelve null si la cadena está vacía o es inválida.
 */
export function parseHoraMinutos(s: string): number | null {
  if (!s || typeof s !== 'string') return null;
  const limpio = s.trim();
  if (limpio === '') return null;
  const partes = limpio.split(':');
  if (partes.length < 2) return null;
  const h = parseInt(partes[0], 10);
  const m = parseInt(partes[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  if (h === 24 && m !== 0) return null;
  return h * 60 + m;
}

/**
 * Convierte 'H:mm' o 'HH:mm' o formatos como '5.50' a minutos de jornada pactada.
 * Devuelve 0 si la cadena está vacía o es inválida.
 */
export function parseJornada(s: string): number {
  if (!s || typeof s !== 'string') return 0;
  const normalizada = s.trim().replace(',', ':').replace('.', ':');
  if (normalizada === '') return 0;
  if (!normalizada.includes(':')) {
    const f = parseFloat(normalizada);
    return Number.isNaN(f) ? 0 : Math.round(f * 60);
  }
  const minutos = parseHoraMinutos(normalizada);
  return minutos === null ? 0 : minutos;
}

/**
 * Formatea minutos a formato legible 'H:mm' (ej. 350 -> '5:50', 90 -> '1:30').
 */
export function formatearMinutosAHora(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0:00';
  let h = Math.floor(minutos / 60);
  let m = Math.round(minutos % 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

export function formatGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString('es-PY')}`;
}

/* ============================================================
 *  CÁLCULO DÍA POR DÍA
 * ============================================================ */

/**
 * Calcula horas extras y recargos para un día específico según las fórmulas exactas.
 */
export function calcularDiaOvertime(
  diaInput: DiaMarcacionInput,
  diaIndex: number,
  salarioMensual: number
): DiaMarcacionResult {
  const dia = diaInput.dia || ORDEN_DIAS_SEMANA[diaIndex] || 'Lunes';
  const esDomingo =
    diaIndex === 6 ||
    dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'domingo';
  const fer = !!diaInput.esFeriado;
  const dlt = !!diaInput.esDiaLibreTrabajado;

  // Tarifas legales
  const sal = Number.isFinite(salarioMensual) && salarioMensual > 0 ? salarioMensual : 0;
  const jornal = sal / 30;
  const hora = jornal / 8;
  const r50 = hora * 1.5;
  const r100 = hora * 2.0;
  const r130 = hora * 2.6;
  const rRec = hora * 0.3;

  const jor = parseJornada(diaInput.jornadaPactada);
  const entrada = parseHoraMinutos(diaInput.horaEntrada);
  const salida = parseHoraMinutos(diaInput.horaSalida);

  const baseResult: DiaMarcacionResult = {
    dia,
    esDomingo,
    esFeriado: fer,
    esDiaLibreTrabajado: dlt,
    minutosTrabajadosNetos: 0,
    jornadaPactadaMinutos: jor,
    he50Minutos: 0,
    he100Minutos: 0,
    he130Minutos: 0,
    recargoNocturnoMinutos: 0,
    jornalesExtra: 0,
    montoGs: 0,
    montoHe50Gs: 0,
    montoHe100Gs: 0,
    montoHe130Gs: 0,
    montoRecargoNocturnoGs: 0,
    montoJornalesExtraGs: 0,
    estado: 'no_trabajo',
    nota: 'No trabajó',
  };

  // Si no hay entrada ni salida
  if (entrada === null && salida === null) {
    if (dlt || fer) {
      return {
        ...baseResult,
        estado: 'incompleto',
        nota: 'Marcación incompleta: no entra al cálculo',
      };
    }
    return baseResult;
  }

  // Si solo uno está vacío
  if (entrada === null || salida === null) {
    return {
      ...baseResult,
      estado: 'incompleto',
      nota: 'Marcación incompleta: el día no entra al cálculo de HE',
    };
  }

  // Si salida <= entrada
  if (salida <= entrada) {
    return {
      ...baseResult,
      estado: 'error_horas',
      nota: 'Salida anterior o igual a la entrada',
    };
  }

  const descanso = Math.max(0, diaInput.descansoMinutos || 0);
  let net = (salida - entrada) - descanso;
  if (net < 0) net = 0;

  // Minutos trabajados después de las 20:00
  const after20 = Math.max(0, salida - Math.max(entrada, NOCHE_MINUTOS));

  // Horas extras totales del día
  const he = Math.max(0, net - jor);

  // Las HE nocturnas son las últimas horas del día que caen después de las 20:00
  const heN = Math.min(he, after20);
  const heD = he - heN;

  // Horas normales que caen después de las 20:00 reciben recargo nocturno del 30%
  const rec = Math.max(0, after20 - heN);

  const h130 = heN;
  let h50 = 0;
  let h100 = 0;

  if (esDomingo || fer) {
    h100 = heD;
  } else {
    h50 = heD;
  }

  let jx = 0;
  if (fer) jx++;
  if (dlt) jx++;

  const montoHe50 = (h50 / 60) * r50;
  const montoHe100 = (h100 / 60) * r100;
  const montoHe130 = (h130 / 60) * r130;
  const montoRec = (rec / 60) * rRec;
  const montoJx = jx * jornal;
  const totalGs = montoHe50 + montoHe100 + montoHe130 + montoRec + montoJx;

  const notas: string[] = [];
  if (fer) notas.push('Feriado trabajado: +1 jornal');
  if (dlt) notas.push('Día libre trabajado: +1 jornal');
  if (he === 0 && rec > 0) notas.push('Sin HE, con recargo nocturno');
  if (he === 0 && rec === 0 && jx === 0) notas.push('Dentro de su jornada');
  if (he > 0 && rec === 0 && jx === 0) notas.push('Con horas extras');

  return {
    dia,
    esDomingo,
    esFeriado: fer,
    esDiaLibreTrabajado: dlt,
    minutosTrabajadosNetos: net,
    jornadaPactadaMinutos: jor,
    he50Minutos: h50,
    he100Minutos: h100,
    he130Minutos: h130,
    recargoNocturnoMinutos: rec,
    jornalesExtra: jx,
    montoGs: Math.round(totalGs),
    montoHe50Gs: Math.round(montoHe50),
    montoHe100Gs: Math.round(montoHe100),
    montoHe130Gs: Math.round(montoHe130),
    montoRecargoNocturnoGs: Math.round(montoRec),
    montoJornalesExtraGs: Math.round(montoJx),
    estado: 'normal',
    nota: notas.join(' · '),
  };
}

/* ============================================================
 *  CÁLCULO SEMANAL CONSOLIDADO
 * ============================================================ */

/**
 * Calcula la liquidación semanal completa de horas extras y recargos.
 */
export function calcularSemanaOvertime(
  salarioMensual: number,
  dias: DiaMarcacionInput[]
): SemanaOvertimeResult {
  const sal = Number.isFinite(salarioMensual) && salarioMensual > 0 ? salarioMensual : 0;
  const valorJornal = sal / 30;
  const valorHora = valorJornal / 8;
  const tarifa50 = valorHora * 1.5;
  const tarifa100 = valorHora * 2.0;
  const tarifa130 = valorHora * 2.6;
  const tarifaRecargoNocturno = valorHora * 0.3;

  // Normalizar los 7 días de la semana con búsqueda insensible a mayúsculas/acentos
  const diasNormalizados: DiaMarcacionInput[] = ORDEN_DIAS_SEMANA.map((diaCanonico) => {
    const canonicoNorm = diaCanonico.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const encontrado = dias.find((d) => {
      const dNorm = (d.dia || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return dNorm === canonicoNorm;
    });

    if (encontrado) return encontrado;

    return {
      dia: diaCanonico,
      jornadaPactada: diaCanonico === 'Sábado' || diaCanonico === 'Domingo' ? '8:00' : '5:50',
      horaEntrada: '',
      horaSalida: '',
      descansoMinutos: 40,
      esFeriado: false,
      esDiaLibreTrabajado: false,
    };
  });

  const diasResult: DiaMarcacionResult[] = diasNormalizados.map((d, i) =>
    calcularDiaOvertime(d, i, sal)
  );

  const totales: SemanaOvertimeTotales = {
    totalMinutosNetos: 0,
    totalHe50Minutos: 0,
    totalHe100Minutos: 0,
    totalHe130Minutos: 0,
    totalRecargoNocturnoMinutos: 0,
    totalJornalesExtra: 0,
    totalMontoGs: 0,
  };

  for (const d of diasResult) {
    totales.totalMinutosNetos += d.minutosTrabajadosNetos;
    totales.totalHe50Minutos += d.he50Minutos;
    totales.totalHe100Minutos += d.he100Minutos;
    totales.totalHe130Minutos += d.he130Minutos;
    totales.totalRecargoNocturnoMinutos += d.recargoNocturnoMinutos;
    totales.totalJornalesExtra += d.jornalesExtra;
    totales.totalMontoGs += d.montoGs;
  }

  return {
    salarioMensual: sal,
    valorJornal,
    valorHora,
    tarifa50,
    tarifa100,
    tarifa130,
    tarifaRecargoNocturno,
    dias: diasResult,
    totales,
  };
}

/* ============================================================
 *  CÁLCULO MANUAL DIRECTO POR TIPO DE HORA (Ley N.º 213/93)
 * ============================================================ */

export interface OvertimeManualInput {
  salarioMensual: number;
  /** Horas extras diurnas al 50% (lunes a sábado) */
  horas50: number;
  /** Horas extras al 100% (domingos, feriados o días de descanso) */
  horas100: number;
  /** Horas extras nocturnas al 130% (después de las 20:00) */
  horas130: number;
  /** Horas ordinarias en horario nocturno (20:00 a 06:00) con recargo del 30% */
  horasRecargoNocturno?: number;
  /** Días feriados o libres trabajados (+1 jornal por día) */
  feriadosTrabajados?: number;
}

export interface OvertimeManualResult {
  salarioMensual: number;
  jornalDiario: number;
  valorHora: number;
  tarifa50: number;
  tarifa100: number;
  tarifa130: number;
  tarifaRecargoNocturno: number;
  horas50: number;
  horas100: number;
  horas130: number;
  horasRecargoNocturno: number;
  feriadosTrabajados: number;
  montoHoras50: number;
  montoHoras100: number;
  montoHoras130: number;
  montoRecargoNocturno: number;
  montoFeriados: number;
  totalHorasExtras: number;
  totalMontoGs: number;
}

/**
 * Calcula en tiempo real los montos de horas extras y recargos con carga manual directa.
 * Permite cargar libremente decimales (ej. 50%: 3.7h, 100%: 5h, 130%: 3h).
 */
export function calcularOvertimeManual(input: OvertimeManualInput): OvertimeManualResult {
  const salario = Math.max(0, Number(input?.salarioMensual) || 0);
  const jornalDiario = salario / 30;
  const valorHora = jornalDiario / 8;
  const tarifa50 = valorHora * 1.5;
  const tarifa100 = valorHora * 2.0;
  const tarifa130 = valorHora * 2.6;
  const tarifaRecargoNocturno = valorHora * 0.3;

  const horas50 = Math.max(0, Number(input?.horas50) || 0);
  const horas100 = Math.max(0, Number(input?.horas100) || 0);
  const horas130 = Math.max(0, Number(input?.horas130) || 0);
  const horasRecargoNocturno = Math.max(0, Number(input?.horasRecargoNocturno) || 0);
  const feriadosTrabajados = Math.max(0, Number(input?.feriadosTrabajados) || 0);

  const montoHoras50 = Math.round(horas50 * tarifa50);
  const montoHoras100 = Math.round(horas100 * tarifa100);
  const montoHoras130 = Math.round(horas130 * tarifa130);
  const montoRecargoNocturno = Math.round(horasRecargoNocturno * tarifaRecargoNocturno);
  const montoFeriados = Math.round(feriadosTrabajados * jornalDiario);

  const totalHorasExtras = Math.round((horas50 + horas100 + horas130) * 100) / 100;
  const totalMontoGs =
    montoHoras50 + montoHoras100 + montoHoras130 + montoRecargoNocturno + montoFeriados;

  return {
    salarioMensual: salario,
    jornalDiario: Math.round(jornalDiario),
    valorHora: Math.round(valorHora),
    tarifa50: Math.round(tarifa50),
    tarifa100: Math.round(tarifa100),
    tarifa130: Math.round(tarifa130),
    tarifaRecargoNocturno: Math.round(tarifaRecargoNocturno),
    horas50,
    horas100,
    horas130,
    horasRecargoNocturno,
    feriadosTrabajados,
    montoHoras50,
    montoHoras100,
    montoHoras130,
    montoRecargoNocturno,
    montoFeriados,
    totalHorasExtras,
    totalMontoGs,
  };
}
