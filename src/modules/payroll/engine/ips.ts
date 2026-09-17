/**
 * IPS — TABLA DE IMPONIBILIDAD PARAMETRIZABLE
 * Motor Liquidación PY · Versión PY-LIQ-2026.09.01
 *
 * Decreto-Ley N.º 1860/50, Art. 76
 *
 * CRÍTICO: NO aplicar 9% universal a todos los conceptos.
 * Cada concepto tiene tratamiento diferente según la Ley IPS.
 *
 * Aportes régimen general:
 * - Trabajador: 9% sobre la base imponible
 * - Empleador: 16.5% sobre la base imponible
 *
 * Base imponible IPS incluye (Art. 76 Decreto-Ley 1860/50):
 * - Salario, horas extraordinarias, comisiones, sobresueldos,
 *   gratificaciones, premios, honorarios, participaciones.
 * EXCLUYE: Aguinaldos (explícitamente mencionado en el Art. 76).
 * EXCLUYE: Asignación familiar (Art. 268 C.T.).
 */

import type { Concepto, Alerta, RegimenIPS } from '../types';
import { IPS_TASAS, IMPONIBILIDAD_IPS } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Resultado
// ─────────────────────────────────────────────────────────────────────────────

export interface IPSResult {
  descuentoTrabajador?: Concepto;
  alertas: Alerta[];
  baseImponible: number;
  montoDescuento: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de descuento IPS del trabajador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el descuento de IPS sobre los conceptos imponibles.
 *
 * Solo aplica el 9% a los conceptos marcados como imponibles=true.
 * Los marcados como 'validar' generan una alerta pero NO se descuentan
 * automáticamente (requieren confirmación profesional).
 *
 * @param conceptos Lista de conceptos de ingresos
 * @param regimen 'general' | 'especial' | 'factura'
 * @param salarioMensual Salario mensual bruto
 */
export function calcularDescuentoIPS(
  conceptos: Concepto[],
  regimen: RegimenIPS = 'general',
  salarioMensual: number,
): IPSResult {
  const alertas: Alerta[] = [];

  // Modalidad Factura / Honorarios (Relación de Dependencia Encubierta - Arts. 18 y 19 C.T.)
  if (regimen === 'factura') {
    alertas.push({
      id: 'A08_FACTURA',
      tipo: 'info',
      mensaje:
        'Modalidad Facturación Mensual: No se aplica retención del 9% de IPS en este cálculo. ' +
        'Conforme a los Arts. 18 y 19 del Código del Trabajo (Ley N.º 213/93) y el Principio de Primacía de la Realidad, la facturación mensual recurrente a la misma empresa presume relación de dependencia laboral, correspondiendo el cobro íntegro de indemnización, preaviso, aguinaldo proporcional y vacaciones, además del derecho a reclamar los aportes no ingresados al IPS.',
      accion: 'informar',
    });
    return { alertas, baseImponible: 0, montoDescuento: 0 };
  }

  // Régimen especial: no calcular automáticamente
  if (regimen === 'especial') {
    alertas.push({
      id: 'A07',
      tipo: 'amarilla',
      mensaje:
        'El trabajador tiene régimen IPS especial. ' +
        'No se aplicó el 9% del régimen general automáticamente. ' +
        'Revisar con contador o asesor IPS.',
      accion: 'derivar_profesional',
    });
    return { alertas, baseImponible: 0, montoDescuento: 0 };
  }

  // Calcular base imponible solo con conceptos confirmados como imponibles
  // Para la liquidación, la base principal es el salario del mes
  // Los demás conceptos (preaviso, vacaciones, indemnización) son 'validar'

  // Base imponible clara: el salario mensual y sus variables confirmadas
  let baseImponible = 0;
  const conceptosPendientesValidacion: string[] = [];

  for (const concepto of conceptos) {
    // Aguinaldo está marcado como exentoIPS = true → no aporta
    if (concepto.exentoIPS) continue;
    if (concepto.esDescuento) continue;

    const reglaImponibilidad = IMPONIBILIDAD_IPS[concepto.id];

    if (!reglaImponibilidad) {
      // Concepto no mapeado explícitamente → no incluir y marcar
      conceptosPendientesValidacion.push(concepto.nombre);
      continue;
    }

    if (reglaImponibilidad.imponible === true) {
      baseImponible += concepto.monto;
    } else if (reglaImponibilidad.imponible === 'validar') {
      conceptosPendientesValidacion.push(concepto.nombre);
    }
    // imponible === false → no aporta, no alertar
  }

  // Alerta si hay conceptos pendientes de validación
  if (conceptosPendientesValidacion.length > 0) {
    alertas.push({
      id: 'A07_validar',
      tipo: 'amarilla',
      mensaje:
        `Los siguientes conceptos tienen tratamiento IPS pendiente de validación profesional: ` +
        `${conceptosPendientesValidacion.join(', ')}. ` +
        `No se incluyeron en la base imponible. El descuento real puede diferir.`,
      accion: 'revisar',
    });
  }

  // Usar al menos el salario del mes como base si no hay otro concepto imponible mapeado
  // El salario base mensual siempre es imponible
  if (baseImponible === 0) {
    baseImponible = salarioMensual;
  }

  const montoDescuento = Math.round(baseImponible * IPS_TASAS.TRABAJADOR);

  if (montoDescuento === 0) {
    return { alertas, baseImponible, montoDescuento: 0 };
  }

  const descuentoTrabajador: Concepto = {
    id: 'ips_trabajador',
    nombre: `Aporte IPS Trabajador (9%)`,
    monto: montoDescuento,
    base: baseImponible,
    formula: `Gs. ${baseImponible.toLocaleString('es-PY')} × 9%`,
    fuenteLegal: 'Art. 76, Decreto-Ley N.º 1860/50',
    incertidumbre:
      conceptosPendientesValidacion.length > 0
        ? 'Base imponible parcial — algunos conceptos requieren validación profesional.'
        : undefined,
    esDescuento: true,
  };

  return { descuentoTrabajador, alertas, baseImponible, montoDescuento };
}
