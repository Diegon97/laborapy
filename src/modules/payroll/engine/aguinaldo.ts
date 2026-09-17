/**
 * AGUINALDO PROPORCIONAL — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 *
 * Art. 243-244, Ley N.º 213/93
 * "Aguinaldo es la remuneración anual complementaria equivalente a la
 * doceava parte de las remuneraciones durante el año calendario a favor
 * del trabajador en todo concepto (Salario, horas extraordinarias,
 * comisiones y otras)"
 *
 * IMPORTANTE: El aguinaldo está EXCLUIDO de la base imponible IPS.
 * Fuente: Art. 76, Decreto-Ley N.º 1860/50 ("exceptuando los aguinaldos")
 */

import type { Concepto } from '../types';
import { calcularBaseAguinaldo } from './salaryBase';

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de Aguinaldo
// ─────────────────────────────────────────────────────────────────────────────

export interface AguinaldoResult {
  concepto: Concepto;
  detalles: {
    sumaRemuneraciones: number;
    mesesIncluidos: number;
    monto: number;
    formula: string;
    esSimplificacion: boolean;
  };
}

/**
 * Calcula el aguinaldo proporcional al momento del egreso.
 *
 * @param salarioMensual Salario mensual fijo en Gs.
 * @param fechaEgreso Fecha de egreso (ISO 8601)
 * @param remuneracionesAnio Remuneraciones reales del año (opcional, mejora precisión)
 */
export function calcularAguinaldo(
  salarioMensual: number,
  fechaEgreso: string,
  remuneracionesAnio?: number[],
): AguinaldoResult {
  const base = calcularBaseAguinaldo(salarioMensual, fechaEgreso, remuneracionesAnio);

  // Aguinaldo = suma de remuneraciones del año ÷ 12
  const monto = Math.round(base.sumaRemuneraciones / 12);

  const formula = base.esSimplificacion
    ? `Gs. ${base.sumaRemuneraciones.toLocaleString('es-PY')} (${salarioMensual.toLocaleString('es-PY')} × ${base.mesesIncluidos} meses) ÷ 12`
    : `Gs. ${base.sumaRemuneraciones.toLocaleString('es-PY')} (suma real de remuneraciones) ÷ 12`;

  const concepto: Concepto = {
    id: 'aguinaldo_proporcional',
    nombre: 'Aguinaldo Proporcional',
    monto,
    base: base.sumaRemuneraciones,
    formula,
    fuenteLegal: 'Art. 243-244, Ley N.º 213/93',
    incertidumbre: base.incertidumbre,
    esDescuento: false,
    exentoIPS: true, // Art. 76 Decreto-Ley IPS
  };

  return {
    concepto,
    detalles: {
      sumaRemuneraciones: base.sumaRemuneraciones,
      mesesIncluidos: base.mesesIncluidos,
      monto,
      formula,
      esSimplificacion: base.esSimplificacion,
    },
  };
}
