/**
 * INDEMNIZACIÓN POR DESPIDO — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 *
 * Art. 91-92, Ley N.º 213/93
 *
 * "En caso de despido sin justa causa, el empleador deberá abonar al
 * trabajador una indemnización equivalente a quince (15) salarios diarios
 * por cada año de servicio o fracción superior a seis (6) meses,
 * calculando en la forma mencionada en el Inc. B) del Artículo 92 del C.T."
 *
 * Art. 92 inc. B):
 * "La indemnización se calculará tomando como base el promedio de los
 * salarios devengados por el trabajador, durante los últimos seis (6)
 * meses que tenga vigencia el contrato o fracción de tiempo menor,
 * si no se hubiese ajustado dicho término."
 *
 * CRÍTICO: NO usar fórmula argentina (1 sueldo × años + fracción de 3 meses).
 * Paraguay: 15 salarios diarios × años (o fracción > 6 meses).
 */

import type { Concepto, Alerta, Antiguedad, MotivoEgreso } from '../types';
import { DIAS_INDEMNIZACION_POR_ANIO } from '../constants';
import { calcularAniosIndemnizables } from './dates';
import { calcularBaseIndemnizacion } from './salaryBase';

// ─────────────────────────────────────────────────────────────────────────────
// Motivos con derecho a indemnización
// ─────────────────────────────────────────────────────────────────────────────

export const MOTIVOS_CON_INDEMNIZACION: MotivoEgreso[] = [
  'despido_sin_causa',
  'retiro_justificado', // condicional — requiere validación
];

export const MOTIVOS_SIN_INDEMNIZACION: MotivoEgreso[] = [
  'renuncia',
  'despido_con_causa',
  'abandono',
  'periodo_prueba',
  'jubilacion',
];

// ─────────────────────────────────────────────────────────────────────────────
// Resultado
// ─────────────────────────────────────────────────────────────────────────────

export interface IndemnizacionResult {
  concepto?: Concepto;
  alertas: Alerta[];
  aplica: boolean;
  aniosIndemnizables: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la indemnización por despido según Art. 91-92, Ley 213/93.
 *
 * Fórmula:
 * Indemnización = 15 días × aniosIndemnizables × jornalDiarioPromedio
 *
 * Donde:
 * - aniosIndemnizables = años completos + 1 si fracción > 6 meses
 * - jornalDiarioPromedio = promedio mensual últimos 6 meses ÷ 30
 *
 * NOTA: Para "retiro justificado" el resultado es provisional y requiere
 * verificación de que la causa encaje en el Art. 84 C.T.
 */
export function calcularIndemnizacion(
  salarioMensual: number,
  antiguedad: Antiguedad,
  motivo: MotivoEgreso,
  remuneracionesUltimos6Meses?: number[],
): IndemnizacionResult {
  const alertas: Alerta[] = [];

  // ── Verificar si aplica ───────────────────────────────────────────────────
  if (MOTIVOS_SIN_INDEMNIZACION.includes(motivo)) {
    return { aplica: false, alertas, aniosIndemnizables: 0 };
  }

  // Mutuo acuerdo: no asumir automáticamente
  if (motivo === 'mutuo_acuerdo') {
    alertas.push({
      id: 'A04_mutuo_acuerdo',
      tipo: 'amarilla',
      mensaje:
        'En mutuo acuerdo, la indemnización depende de lo pactado. ' +
        'No se calculó automáticamente. Revisar el documento de acuerdo.',
      accion: 'revisar',
    });
    return { aplica: false, alertas, aniosIndemnizables: 0 };
  }

  // Contrato a plazo fijo: flujo separado
  if (motivo === 'contrato_plazo_fijo') {
    alertas.push({
      id: 'A08_indemnizacion',
      tipo: 'amarilla',
      mensaje:
        'El contrato a plazo fijo tiene un tratamiento de indemnización diferente. ' +
        'Este flujo no está incluido en el cálculo estándar. Revisar con profesional.',
      accion: 'revisar',
    });
    return { aplica: false, alertas, aniosIndemnizables: 0 };
  }

  // ── Alerta por estabilidad ≥ 10 años ──────────────────────────────────────
  if (antiguedad.years >= 10) {
    alertas.push({
      id: 'A01',
      tipo: 'roja',
      mensaje:
        'El trabajador tiene 10 o más años de antigüedad. Puede tener estabilidad adquirida. ' +
        'El cálculo de indemnización requiere REVISIÓN PROFESIONAL antes de ser presentado como definitivo. ' +
        'NO se calcula automáticamente "indemnización × 2" — la estabilidad tiene consecuencias jurídicas específicas.',
      accion: 'derivar_profesional',
    });
  }

  // ── Base salarial (Art. 92 inc. B) ───────────────────────────────────────
  const baseResult = calcularBaseIndemnizacion(salarioMensual, remuneracionesUltimos6Meses);
  const jornalDiarioPromedio = baseResult.jornalDiarioPromedio;

  // ── Años indemnizables ────────────────────────────────────────────────────
  const aniosIndemnizables = calcularAniosIndemnizables(antiguedad);

  // Si hay menos de 1 año Y la fracción no supera 6 meses → sin indemnización
  if (aniosIndemnizables === 0) {
    return { aplica: false, alertas, aniosIndemnizables: 0 };
  }

  // ── Cálculo final ─────────────────────────────────────────────────────────
  const diasTotales = DIAS_INDEMNIZACION_POR_ANIO * aniosIndemnizables;
  const monto = Math.round(jornalDiarioPromedio * diasTotales);

  const incertidumbreBase = baseResult.incertidumbre;
  const incertidumbreMotivo =
    motivo === 'retiro_justificado'
      ? 'En retiro justificado, la indemnización está condicionada a que la causa sea válida (Art. 84 C.T.). Resultado provisional.'
      : undefined;
  const incertidumbre = [incertidumbreBase, incertidumbreMotivo]
    .filter(Boolean)
    .join(' ');

  const concepto: Concepto = {
    id: 'indemnizacion',
    nombre: `Indemnización por Despido (${aniosIndemnizables} año${aniosIndemnizables !== 1 ? 's' : ''})`,
    monto,
    dias: diasTotales,
    base: jornalDiarioPromedio,
    formula:
      `15 días × ${aniosIndemnizables} año(s) = ${diasTotales} días × ` +
      `Gs. ${Math.round(jornalDiarioPromedio).toLocaleString('es-PY')}/día (promedio 6 meses)`,
    fuenteLegal: 'Art. 91-92, Ley N.º 213/93',
    incertidumbre: incertidumbre || undefined,
    esDescuento: false,
  };

  return { concepto, aplica: true, alertas, aniosIndemnizables };
}
