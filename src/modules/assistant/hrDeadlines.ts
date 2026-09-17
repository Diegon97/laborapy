/**
 * VENCIMIENTOS Y CALENDARIO PATRONAL — PARAGUAY
 * Versión: PY-DEADLINES-2026.09.10
 *
 * Plazos regulados:
 *  - IPS REI: 3 días hábiles desde el cese laboral (excluye sábados y domingos).
 *  - MTESS REOP: 30 días corridos para comunicación de egreso.
 *  - Certificado de Trabajo: cese inmediato (Art. 93 C.T.).
 *  - Topes de retención: Art. 242 (30%) y Art. 245 (50% alimentos).
 */

import type {
  SettlementDeadlines,
  DeadlineItem,
  PayrollCalendarEvent,
  RetentionLimits,
  ISODate,
} from './types';

/**
 * Agrega días hábiles a una fecha dada, omitiendo sábados (6) y domingos (0).
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const current = new Date(startDate.getTime());
  let added = 0;
  while (added < businessDays) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return current;
}

/**
 * Parsea una fecha ISO (YYYY-MM-DD) o latina (DD/MM/YYYY) en hora local paraguaya.
 */
export function parseDateLocal(dateStr: string): Date {
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const latMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(trimmed);
  if (latMatch) {
    let year = Number(latMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(latMatch[2]) - 1, Number(latMatch[1]));
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Formatea una fecha a string YYYY-MM-DD local.
 */
export function formatISODateLocal(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula la diferencia en días calendario entre dos fechas (target - today).
 */
function getDaysRemaining(targetDate: Date, todayDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Calcula todos los plazos y trámites obligatorios al momento de la salida de un colaborador.
 *
 * @param fechaEgresoStr Fecha de salida en formato YYYY-MM-DD o DD/MM/YYYY.
 */
export function getSettlementDeadlines(fechaEgresoStr: string): SettlementDeadlines {
  const fechaEgresoDate = parseDateLocal(fechaEgresoStr);
  const fechaEgresoIso = formatISODateLocal(fechaEgresoDate);
  const now = new Date();

  // 1. IPS REI: +3 días hábiles (excluyendo fines de semana)
  const ipsReiDueDate = addBusinessDays(fechaEgresoDate, 3);
  const ipsReiDaysRemaining = getDaysRemaining(ipsReiDueDate, now);
  const ipsReiStatus =
    ipsReiDaysRemaining < 0 ? 'vencido' : ipsReiDaysRemaining <= 1 ? 'proximo' : 'pendiente';

  const ipsReiItem: DeadlineItem = {
    id: 'deadline-ips-rei',
    kind: 'ips_rei',
    concepto: 'Comunicación de Salida en IPS REI',
    descripcion:
      'Registrar la baja del asegurado en el Sistema REI del IPS dentro de los 3 días hábiles posteriores a la fecha de salida.',
    dueDate: formatISODateLocal(ipsReiDueDate),
    daysRemaining: ipsReiDaysRemaining,
    status: ipsReiStatus,
    diasHabiles: 3,
    obligatorio: true,
    organismo: 'IPS',
    legalReference: 'Reglamento General IPS REI · Decreto-Ley N° 1860/50',
    advertenciaLegal:
      'Si no se comunica la baja en plazo, el IPS continuará devengando aportes obrero-patronales y aplicará multas y recargos moratorios automáticos.',
  };

  // 2. MTESS REOP: +30 días corridos
  const mtessDueDate = new Date(fechaEgresoDate.getTime());
  mtessDueDate.setDate(mtessDueDate.getDate() + 30);
  const mtessDaysRemaining = getDaysRemaining(mtessDueDate, now);
  const mtessStatus =
    mtessDaysRemaining < 0 ? 'vencido' : mtessDaysRemaining <= 3 ? 'proximo' : 'pendiente';

  const mtessReopItem: DeadlineItem = {
    id: 'deadline-mtess-reop',
    kind: 'mtess_reop',
    concepto: 'Comunicación de Egreso en MTESS (REOP)',
    descripcion:
      'Registrar la salida del trabajador en el sistema Obrero Patronal del MTESS, adjuntando la liquidación final y constancia de pago.',
    dueDate: formatISODateLocal(mtessDueDate),
    daysRemaining: mtessDaysRemaining,
    status: mtessStatus,
    diasCorridos: 30,
    obligatorio: true,
    organismo: 'MTESS',
    legalReference: 'Resolución MTESS N° 820/2019 · Ley N° 213/93',
    advertenciaLegal:
      'El incumplimiento del plazo de 30 días corridos genera multas de 10 a 30 jornales mínimos por trabajador no registrado en salida.',
  };

  // 3. Certificado de Trabajo: entrega obligatoria e inmediata al cese (Art. 93 C.T.)
  const certDueDate = new Date(fechaEgresoDate.getTime());
  const certDaysRemaining = getDaysRemaining(certDueDate, now);
  const certStatus = certDaysRemaining < 0 ? 'vencido' : 'proximo';

  const certificadoTrabajoItem: DeadlineItem = {
    id: 'deadline-certificado-trabajo',
    kind: 'certificado_trabajo',
    concepto: 'Entrega de Certificado de Trabajo (Art. 93 C.T.)',
    descripcion:
      'Entregar la constancia formal de trabajo indicando fecha de ingreso, fecha de egreso y cargo desempeñado.',
    dueDate: formatISODateLocal(certDueDate),
    daysRemaining: certDaysRemaining,
    status: certStatus,
    obligatorio: true,
    organismo: 'EMPRESA',
    legalReference: 'Art. 93 Ley 213/93 (Código del Trabajo)',
    advertenciaLegal:
      'La ley prohíbe consignar apreciaciones perjudiciales o desfavorables para la reinserción laboral del trabajador.',
  };

  const advertencias: string[] = [];
  if (ipsReiDaysRemaining < 0) {
    advertencias.push('🚨 Plazo de IPS REI VENCIDO. Regularizar de inmediato en el portal para frenar la facturación de aportes.');
  } else if (ipsReiDaysRemaining <= 1) {
    advertencias.push('⚠️ Vencimiento de IPS REI inminente (menos de 24-48 horas restantes).');
  }

  if (mtessDaysRemaining < 0) {
    advertencias.push('🚨 Plazo de comunicación MTESS REOP VENCIDO. Pasible de fiscalización y multa.');
  }

  return {
    fechaEgreso: fechaEgresoIso,
    ipsRei: ipsReiItem,
    mtessReop: mtessReopItem,
    certificadoTrabajo: certificadoTrabajoItem,
    advertencias,
  };
}

/**
 * Calendario patronal recurrente mensual en Paraguay.
 */
export function getMonthlyPayrollCalendar(_year?: number, month?: number): PayrollCalendarEvent[] {
  const m = month ?? new Date().getMonth() + 1;

  const events: PayrollCalendarEvent[] = [
    {
      id: 'cal-pago-salarios',
      dayRange: 'Días 1 al 5',
      title: 'Pago legal de salarios mensuales',
      description:
        'Abono obligatorio de las remuneraciones devengadas del mes anterior, con firma de recibos en doble ejemplar o comprobante bancario.',
      legalReference: 'Art. 232 Ley 213/93 (Código del Trabajo)',
      category: 'pago',
    },
    {
      id: 'cal-vencimiento-ips',
      dayRange: 'Hasta el día 10',
      title: 'Presentación de planilla y pago de aportes IPS REI',
      description:
        'Cierre de la planilla de salarios del mes anterior en el Sistema REI y pago del extracto patronal (16.5% patronal + 9% obrero).',
      legalReference: 'Decreto-Ley N° 1860/50 · Calendario Oficial IPS',
      category: 'aporte',
    },
    {
      id: 'cal-planilla-mtess',
      dayRange: 'Hasta el día 10 / mensual',
      title: 'Cierre y consolidación de altas y bajas laborales MTESS',
      description:
        'Verificación de movimientos del personal y registro de contratos nuevos o adendas de salarios mínimos vigentes.',
      legalReference: 'Resolución MTESS N° 820/2019',
      category: 'planilla',
    },
  ];

  if (m === 12) {
    events.push({
      id: 'cal-aguinaldo-anual',
      dayRange: 'Hasta el 31 de Diciembre',
      title: 'Fecha límite legal para pago de Aguinaldo Anual',
      description:
        'Pago improrrogable del aguinaldo legal (1/12 de todas las remuneraciones del año). Inembargable y 100% exento de descuento de IPS.',
      legalReference: 'Art. 243 Ley 213/93 (Código del Trabajo)',
      category: 'beneficio',
    });
  }

  return events;
}

/**
 * Calcula los topes legales de descuentos y anticipos autorizados por ley (Arts. 242 y 245 C.T.).
 *
 * @param salarioBruto Salario mensual bruto del colaborador en Guaraníes.
 * @param aguinaldoDevengado Monto de aguinaldo acumulado a la fecha (opcional).
 */
export function calculateRetentionLimits(salarioBruto: number, aguinaldoDevengado = 0): RetentionLimits {
  const bruto = Math.max(0, salarioBruto);
  const maxDeduccionesOrdinarias = Math.round(bruto * 0.30);
  const maxPensionAlimenticia = Math.round(bruto * 0.5);
  const maxAnticipoAguinaldo = Math.max(0, aguinaldoDevengado);

  return {
    salarioBruto: bruto,
    maxDeduccionesOrdinarias,
    maxPensionAlimenticia,
    maxAnticipoAguinaldo,
    detalle:
      `Tope ordinario (30%): Gs. ${maxDeduccionesOrdinarias.toLocaleString('es-PY')} | ` +
      `Tope judicial alimentos (50%): Gs. ${maxPensionAlimenticia.toLocaleString('es-PY')} | ` +
      `Tope anticipo aguinaldo: Gs. ${maxAnticipoAguinaldo.toLocaleString('es-PY')}`,
  };
}
