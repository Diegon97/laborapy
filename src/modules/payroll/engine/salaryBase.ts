/**
 * BASE SALARIAL — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 *
 * Calcula la base salarial para cada concepto.
 * NUNCA mezclar la base de un concepto con otro.
 *
 * Fuentes:
 * - Art. 92 inc. B), Ley 213/93 (base indemnización: promedio últimos 6 meses)
 * - Art. 220, Ley 213/93 (base vacaciones: salario actual)
 * - Art. 243, Ley 213/93 (base aguinaldo: suma anual)
 * - Art. 76, Decreto-Ley 1860/50 (base IPS)
 */

import { DIVISOR_JORNAL_DIARIO } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Jornal diario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el jornal diario a partir del salario mensual.
 * Criterio operativo Paraguay: salarioMensual ÷ 30.
 * NOTA: Pendiente de validación por laboralista.
 */
export function calcularJornalDiario(salarioMensual: number): number {
  return salarioMensual / DIVISOR_JORNAL_DIARIO;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base para Indemnización (Art. 92 inc. B, Ley 213/93)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseIndemnizacionResult {
  /** Promedio de los salarios devengados en los últimos 6 meses */
  promedioMensual: number;
  /** Jornal diario promedio (promedioMensual ÷ 30) */
  jornalDiarioPromedio: number;
  /** Meses de datos disponibles (puede ser < 6 si el contrato fue corto) */
  mesesDisponibles: number;
  /** Si los datos son completos (6 meses) o si es una estimación */
  esEstimacion: boolean;
  /** Mensaje de incertidumbre (si aplica) */
  incertidumbre?: string;
}

/**
 * Calcula la base para indemnización según Art. 92 inc. B).
 *
 * La base es el promedio de los salarios devengados en los últimos 6 meses
 * (o fracción si el contrato fue más corto).
 *
 * Incluye: salario base + horas extras + comisiones + variables.
 *
 * @param salarioMensual Salario mensual fijo (fallback si no hay variables)
 * @param remuneracionesUltimos6Meses Array de hasta 6 remuneraciones (más antiguo primero)
 */
export function calcularBaseIndemnizacion(
  salarioMensual: number,
  remuneracionesUltimos6Meses?: number[],
): BaseIndemnizacionResult {
  // Si se proveen datos históricos, usarlos
  if (
    remuneracionesUltimos6Meses &&
    remuneracionesUltimos6Meses.length > 0
  ) {
    const mesesDisponibles = remuneracionesUltimos6Meses.length;
    const sumaTotal = remuneracionesUltimos6Meses.reduce((acc, v) => acc + v, 0);
    const promedioMensual = sumaTotal / mesesDisponibles;
    const jornalDiarioPromedio = promedioMensual / DIVISOR_JORNAL_DIARIO;

    return {
      promedioMensual,
      jornalDiarioPromedio,
      mesesDisponibles,
      esEstimacion: mesesDisponibles < 6,
      incertidumbre:
        mesesDisponibles < 6
          ? `Solo se dispone de ${mesesDisponibles} mes(es) de datos. El Art. 92 C.T. establece el promedio de los últimos 6 meses. El resultado puede diferir.`
          : undefined,
    };
  }

  // Fallback: usar el salario mensual actual (solo si no hay variables)
  const jornalDiarioPromedio = salarioMensual / DIVISOR_JORNAL_DIARIO;

  return {
    promedioMensual: salarioMensual,
    jornalDiarioPromedio,
    mesesDisponibles: 0,
    esEstimacion: true,
    incertidumbre:
      'No se ingresaron remuneraciones variables de los últimos 6 meses. ' +
      'Se usó el salario mensual fijo como estimación. ' +
      'Si existieron variables (comisiones, horas extras), el monto puede ser mayor. ' +
      'Fuente: Art. 92 inc. B), Ley N.º 213/93.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Base para Aguinaldo (Art. 243, Ley 213/93)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseAguinaldoResult {
  /** Suma total de remuneraciones devengadas en el año calendario */
  sumaRemuneraciones: number;
  /** Meses incluidos en el cálculo */
  mesesIncluidos: number;
  /** true si se usó la simplificación (sin variables) */
  esSimplificacion: boolean;
  incertidumbre?: string;
}

/**
 * Calcula la base para el aguinaldo proporcional según Art. 243 C.T.
 *
 * "Aguinaldo es la remuneración anual complementaria equivalente a la
 * doceava parte de las remuneraciones durante el año calendario a favor
 * del trabajador en todo concepto (Salario, horas extraordinarias,
 * comisiones y otras)"
 *
 * @param salarioMensual Salario mensual fijo
 * @param fechaEgreso Fecha de egreso (para contar los meses del año en curso)
 * @param remuneracionesAnio Array con remuneraciones de cada mes del año (index 0 = enero)
 */
export function calcularBaseAguinaldo(
  salarioMensual: number,
  fechaEgreso: string,
  remuneracionesAnio?: number[],
): BaseAguinaldoResult {
  const mesEgreso = new Date(fechaEgreso + 'T00:00:00').getMonth(); // 0-based (0=enero)
  const mesesIncluidos = mesEgreso + 1; // enero=1, ..., diciembre=12

  // Si se proveen datos reales del año
  if (remuneracionesAnio && remuneracionesAnio.length >= mesesIncluidos) {
    const sumaRemuneraciones = remuneracionesAnio
      .slice(0, mesesIncluidos)
      .reduce((acc, v) => acc + v, 0);

    return {
      sumaRemuneraciones,
      mesesIncluidos,
      esSimplificacion: false,
    };
  }

  // Simplificación: salario fijo × meses (aceptable solo si no hay variables)
  const sumaRemuneraciones = salarioMensual * mesesIncluidos;

  return {
    sumaRemuneraciones,
    mesesIncluidos,
    esSimplificacion: true,
    incertidumbre:
      'Se usó la simplificación sueldo × meses. Si existieron comisiones, ' +
      'horas extras u otras remuneraciones variables, el aguinaldo puede diferir. ' +
      'Provea las remuneraciones reales del año para un cálculo exacto. ' +
      'Fuente: Art. 243, Ley N.º 213/93.',
  };
}
