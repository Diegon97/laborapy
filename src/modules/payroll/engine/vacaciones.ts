/**
 * VACACIONES — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 *
 * Art. 218-223, Ley N.º 213/93
 *
 * Tipos de vacaciones:
 * 1. Causadas (no gozadas de períodos completos anteriores)
 * 2. Proporcionales (del período corriente, en casos de despido sin causa)
 * 3. Multa por no otorgamiento en plazo (Art. 223: doble del valor)
 */

import type { Concepto, Alerta, Antiguedad, MotivoEgreso } from '../types';
import { ESCALA_VACACIONES, DIVISOR_JORNAL_DIARIO } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Escala de vacaciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene los días de vacaciones correspondientes según la antigüedad.
 * Art. 218 C.T.:
 * - Hasta 5 años: 12 días hábiles corridos
 * - Más de 5 y hasta 10 años: 18 días hábiles corridos
 * - Más de 10 años: 30 días hábiles corridos
 */
export function getDiasVacacionesPorAntiguedad(antiguedadInput: number | Antiguedad): {
  dias: number;
  fuenteLegal: string;
  descripcion: string;
} {
  const isObj = typeof antiguedadInput === 'object';
  const years = isObj ? antiguedadInput.years : Math.floor(antiguedadInput);
  const hasExtra = isObj
    ? (antiguedadInput.months > 0 || antiguedadInput.days > 0)
    : antiguedadInput > years;

  // Más de 10 años → 30 días (Art. 218 inc. c)
  if (years > 10 || (years === 10 && hasExtra)) {
    return {
      dias: ESCALA_VACACIONES[2].dias,
      fuenteLegal: ESCALA_VACACIONES[2].fuenteLegal,
      descripcion: ESCALA_VACACIONES[2].descripcion,
    };
  }
  // Más de 5 y hasta 10 años → 18 días (Art. 218 inc. b)
  if (years > 5 || (years === 5 && hasExtra)) {
    return {
      dias: ESCALA_VACACIONES[1].dias,
      fuenteLegal: ESCALA_VACACIONES[1].fuenteLegal,
      descripcion: ESCALA_VACACIONES[1].descripcion,
    };
  }
  // Hasta 5 años → 12 días (Art. 218 inc. a)
  return {
    dias: ESCALA_VACACIONES[0].dias,
    fuenteLegal: ESCALA_VACACIONES[0].fuenteLegal,
    descripcion: ESCALA_VACACIONES[0].descripcion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado de vacaciones
// ─────────────────────────────────────────────────────────────────────────────

export interface VacacionesResult {
  conceptos: Concepto[];
  alertas: Alerta[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula los conceptos de vacaciones según el motivo de egreso y la antigüedad.
 *
 * Tabla por motivo (Material de Liquidaciones — Solutions Consulting, p. 7-8):
 * - Período de prueba: vacaciones proporcionales (Art. 60 C.T.)
 * - Renuncia: solo vacaciones causadas (no proporcionales) — Art. 221: solo por causas del empleador
 * - Despido con causa: solo vacaciones causadas
 * - Despido sin causa: vacaciones causadas + proporcionales
 * - Retiro justificado: vacaciones causadas + proporcionales (provisional, requiere validación)
 * - Mutuo acuerdo: vacaciones causadas
 * - Jubilación: según acuerdo
 */
export function calcularVacaciones(
  salarioMensual: number,
  antiguedad: Antiguedad,
  motivo: MotivoEgreso,
  vacacionesPeriodosAnteriores: number = 0,
  vacacionesPeriodoActualGozadas: number = 0,
  vacacionesAnterioresVencidas: boolean = true,
): VacacionesResult {
  const conceptos: Concepto[] = [];
  const alertas: Alerta[] = [];

  const escala = getDiasVacacionesPorAntiguedad(antiguedad);
  const jornalDiario = salarioMensual / DIVISOR_JORNAL_DIARIO;

  // ── 1. Vacaciones de períodos ANTERIORES (causadas no gozadas) ────────────
  if (vacacionesPeriodosAnteriores > 0) {
    const esVencida = vacacionesAnterioresVencidas !== false;
    const baseCalculo = esVencida ? Math.round(jornalDiario * 2) : Math.round(jornalDiario);
    const monto = Math.round(jornalDiario * vacacionesPeriodosAnteriores) * (esVencida ? 2 : 1);

    conceptos.push({
      id: 'vacaciones_periodos_anteriores',
      nombre: esVencida
        ? `Vacaciones Vencidas Períodos Anteriores (${vacacionesPeriodosAnteriores} días · Pago Doble Art. 221/223 C.T.)`
        : `Vacaciones Períodos Anteriores (${vacacionesPeriodosAnteriores} días)`,
      monto,
      dias: vacacionesPeriodosAnteriores,
      base: baseCalculo,
      formula: esVencida
        ? `${vacacionesPeriodosAnteriores} días × Gs. ${baseCalculo.toLocaleString('es-PY')}/día (Doble Jornal Arts. 221/223 C.T.) = Gs. ${monto.toLocaleString('es-PY')}`
        : `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día × ${vacacionesPeriodosAnteriores} días`,
      fuenteLegal: esVencida
        ? 'Arts. 219, 221 y 223, Ley N.º 213/93 (Pago Doble por Vacaciones Vencidas)'
        : 'Arts. 218-221, Ley N.º 213/93',
      esDescuento: false,
    });

    if (esVencida) {
      alertas.push({
        id: 'A05_VENCIDAS_DOBLE',
        tipo: 'info',
        mensaje:
          `Vacaciones Vencidas de Períodos Anteriores: Conforme a los Arts. 221 y 223 del Código del Trabajo (Ley N.º 213/93), ` +
          `al haber transcurrido el plazo legal de seis meses de la época de goce (Art. 222 C.T.), ` +
          `las vacaciones causadas no usufructuadas se abonan obligatoriamente al doble de su valor (x2).`,
        accion: 'informar',
      });
    } else {
      alertas.push({
        id: 'A05',
        tipo: 'amarilla',
        mensaje:
          'Se liquidaron vacaciones de períodos anteriores a valor simple. ' +
          'Si hubiesen transcurrido más de seis meses desde su causación, ' +
          'corresponde el doble del valor por vencimiento (Arts. 221 y 223 C.T.). Revisar con profesional.',
        accion: 'revisar',
      });
    }
  }

  // ── 2. Vacaciones del período ACTUAL (causadas no gozadas) ────────────────
  // Aplica cuando el trabajador tiene al menos 1 año completo en el período actual
  // y aún no gozó las vacaciones correspondientes.
  if (antiguedad.years >= 1) {
    const diasDisponibles = escala.dias - vacacionesPeriodoActualGozadas;
    if (diasDisponibles > 0) {
      const monto = Math.round(jornalDiario * diasDisponibles);
      conceptos.push({
        id: 'vacaciones_causadas',
        nombre: `Vacaciones Causadas (${diasDisponibles} días)`,
        monto,
        dias: diasDisponibles,
        base: jornalDiario,
        formula: `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día × ${diasDisponibles} días`,
        fuenteLegal: `Art. 218 y 221, Ley N.º 213/93 — ${escala.descripcion}`,
        esDescuento: false,
      });
    }
  }

  // ── 3. Vacaciones PROPORCIONALES del período corriente ────────────────────
  // Solo aplica en: despido sin causa, retiro justificado, período de prueba
  // NO aplica en: renuncia, despido con causa, mutuo acuerdo (solo causadas)
  // Fuente: Art. 221 C.T. "si el contrato termina antes del año por causas imputables al empleador"
  const motivosConProporional: MotivoEgreso[] = [
    'despido_sin_causa',
    'retiro_justificado',
    'periodo_prueba',
  ];

  if (motivosConProporional.includes(motivo)) {
    // Meses del período corriente (sin el año completo que ya se calculó arriba)
    const mesesParciales = antiguedad.months;
    const diasParciales = antiguedad.days;

    if (mesesParciales > 0 || diasParciales > 0) {
      // Proporcional: días de escala × meses completos ÷ 12
      // Ejemplo (Solutions Consulting, p. 4): 1 día de vacaciones por cada mes completo cumplido
      // Para escala de 12 días: 12 ÷ 12 = 1 día por mes
      const diasPorMes = escala.dias / 12;
      const diasProporcionales = Math.round(diasPorMes * mesesParciales);

      if (diasProporcionales > 0) {
        const monto = Math.round(jornalDiario * diasProporcionales);
        const incertidumbre =
          motivo === 'retiro_justificado'
            ? 'Las vacaciones proporcionales en retiro justificado están condicionadas a que la causa sea válida (Art. 221 C.T.). Resultado provisional.'
            : undefined;

        conceptos.push({
          id: 'vacaciones_proporcionales',
          nombre: `Vacaciones Proporcionales (${diasProporcionales} días)`,
          monto,
          dias: diasProporcionales,
          base: jornalDiario,
          formula:
            `${escala.dias} días ÷ 12 × ${mesesParciales} meses = ${diasProporcionales} días × ` +
            `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día`,
          fuenteLegal: 'Art. 221, Ley N.º 213/93',
          incertidumbre,
          esDescuento: false,
        });
      }
    }
  }

  return { conceptos, alertas };
}
