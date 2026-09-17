/**
 * CÁLCULO DE ANTIGÜEDAD — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 * Fuente: Master Legal §4
 *
 * Calcula la antigüedad cronológica exacta entre dos fechas.
 * NO se reduce a decimal — se mantienen años, meses y días por separado.
 */

import type { Antiguedad } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo principal de antigüedad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la antigüedad cronológica entre dos fechas ISO (YYYY-MM-DD).
 * Usa aritmética de fecha pura sin bibliotecas externas para máxima precisión.
 *
 * Ejemplos de borde (del Master Legal §22):
 * - ingreso = egreso → 0, 0, 0
 * - 1 día → 0, 0, 1
 * - exactamente 1 año → 1, 0, 0
 * - exactamente 5 años → 5, 0, 0
 * - exactamente 10 años → 10, 0, 0
 */
export function calcularAntiguedad(
  fechaIngreso: string,
  fechaEgreso: string,
): Antiguedad {
  const inicio = new Date(fechaIngreso + 'T00:00:00');
  const fin = new Date(fechaEgreso + 'T00:00:00');

  let years = fin.getFullYear() - inicio.getFullYear();
  let months = fin.getMonth() - inicio.getMonth();
  let days = fin.getDate() - inicio.getDate();

  // Ajuste de días negativos (borrow de meses)
  if (days < 0) {
    months--;
    // Días del mes anterior al mes de fin
    const mesAnterior = new Date(fin.getFullYear(), fin.getMonth(), 0);
    days += mesAnterior.getDate();
  }

  // Ajuste de meses negativos (borrow de años)
  if (months < 0) {
    years--;
    months += 12;
  }

  // Total de días calendarios (para cálculos internos)
  const totalDias = Math.floor(
    (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24),
  );

  return { years, months, days, totalDias };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers derivados de la antigüedad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve true si la antigüedad tiene fracción de más de 6 meses
 * (que cuenta como un año completo a efectos de indemnización).
 *
 * Art. 91 C.T.: "fracción superior a seis (6) meses"
 * Interpretación: months > 6, o (months === 6 && days > 0).
 *
 * Caso borde exacto de 6 meses 0 días: NO cuenta (debe ser "superior a 6 meses").
 */
export function fraccionCuentaComoAnio(meses: number, dias: number): boolean {
  if (meses > 6) return true;
  if (meses === 6 && dias > 0) return true;
  return false;
}

/**
 * Calcula los años completos para indemnización,
 * agregando 1 si la fracción de meses supera los 6 meses.
 *
 * Art. 91 C.T.: "15 salarios diarios por cada año de servicio o fracción
 * superior a seis (6) meses"
 */
export function calcularAniosIndemnizables(ant: Antiguedad): number {
  const { years, months, days } = ant;
  let aniosIndemnizables = years;
  if (fraccionCuentaComoAnio(months, days)) {
    aniosIndemnizables++;
  }
  return aniosIndemnizables;
}

/**
 * Devuelve la antigüedad en formato legible para mostrar en UI y PDF.
 * Ejemplo: "10 años 2 meses 15 días"
 */
export function formatearAntiguedad(ant: Antiguedad): string {
  const partes: string[] = [];
  if (ant.years > 0) partes.push(`${ant.years} ${ant.years === 1 ? 'año' : 'años'}`);
  if (ant.months > 0) partes.push(`${ant.months} ${ant.months === 1 ? 'mes' : 'meses'}`);
  if (ant.days > 0) partes.push(`${ant.days} ${ant.days === 1 ? 'día' : 'días'}`);
  if (partes.length === 0) return '0 días';
  return partes.join(' ');
}

/**
 * Calcula los meses trabajados en el período corriente para vacaciones proporcionales.
 * Cuenta los meses completos transcurridos desde el último aniversario de vacaciones
 * hasta la fecha de egreso.
 *
 * Ejemplo: si el año laboral empieza el 17/03 y el egreso es 17/10 → 7 meses
 * (March 17 → April 17 = 1 mes, ..., Sept 17 → Oct 17 = 7 meses)
 */
export function calcularMesesEnPeriodoCorriente(
  _fechaIngreso: string,
  _fechaEgreso: string,
  antiguedad: Antiguedad,
): number {
  // La fracción actual son los meses (y días) que no forman un año completo
  // La antigüedad ya nos da los meses del período corriente
  let meses = antiguedad.months;
  // Si hay días sueltos además de los meses, contar un mes más (proporcional parcial)
  // El cálculo real de vacaciones proporcionales usa los meses completos cumplidos
  // desde el último aniversario.
  // Para vacaciones proporcionales según el ejemplo del material de Solutions Consulting:
  // 1 mes por cada mes completo desde la fecha aniversaria
  return meses;
}
