/**
 * PREAVISO — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 *
 * Art. 87-90, Ley N.º 213/93
 *
 * Escala (Art. 87):
 * - Hasta 1 año: 30 días
 * - > 1 y hasta 5 años: 45 días
 * - > 5 y hasta 10 años: 60 días
 * - > 10 años: 90 días
 *
 * Art. 90: Si el empleador omite el preaviso → paga el equivalente.
 * Art. 90: Si el trabajador omite el preaviso → paga la MITAD del equivalente.
 */

import type { Concepto, Alerta, Antiguedad, PreavisoInput, MotivoEgreso, RegimenLaboral } from '../types';
import { ESCALA_PREAVISO, ESCALA_PREAVISO_DOMESTICO, DIVISOR_JORNAL_DIARIO } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Escala de preaviso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene los días de preaviso según la antigüedad y régimen legal.
 * Art. 87 C.T. o Ley N.º 5407/15.
 */
export function getDiasPreaviso(antiguedadInput: number | Antiguedad, regimenLaboral: RegimenLaboral = 'general'): {
  dias: number;
  fuenteLegal: string;
  descripcion: string;
} {
  const isObj = typeof antiguedadInput === 'object';
  const years = isObj ? antiguedadInput.years : Math.floor(antiguedadInput);
  const hasExtra = isObj
    ? (antiguedadInput.months > 0 || antiguedadInput.days > 0)
    : antiguedadInput > years;

  if (regimenLaboral === 'domestico') {
    // Mayor a 1 año → 15 días
    if (years > 1 || (years === 1 && hasExtra)) {
      return {
        dias: ESCALA_PREAVISO_DOMESTICO[1].dias,
        fuenteLegal: ESCALA_PREAVISO_DOMESTICO[1].fuenteLegal,
        descripcion: ESCALA_PREAVISO_DOMESTICO[1].descripcion,
      };
    }
    // Menor a 1 año → 7 días
    return {
      dias: ESCALA_PREAVISO_DOMESTICO[0].dias,
      fuenteLegal: ESCALA_PREAVISO_DOMESTICO[0].fuenteLegal,
      descripcion: ESCALA_PREAVISO_DOMESTICO[0].descripcion,
    };
  }

  // Más de 10 años en adelante → 90 días (Art. 87 inc. d)
  if (years > 10 || (years === 10 && hasExtra)) {
    return {
      dias: ESCALA_PREAVISO[3].dias,
      fuenteLegal: ESCALA_PREAVISO[3].fuenteLegal,
      descripcion: ESCALA_PREAVISO[3].descripcion,
    };
  }
  // Más de 5 y hasta 10 años → 60 días (Art. 87 inc. c)
  if (years > 5 || (years === 5 && hasExtra)) {
    return {
      dias: ESCALA_PREAVISO[2].dias,
      fuenteLegal: ESCALA_PREAVISO[2].fuenteLegal,
      descripcion: ESCALA_PREAVISO[2].descripcion,
    };
  }
  // Más de 1 y hasta 5 años → 45 días (Art. 87 inc. b)
  if (years > 1 || (years === 1 && hasExtra)) {
    return {
      dias: ESCALA_PREAVISO[1].dias,
      fuenteLegal: ESCALA_PREAVISO[1].fuenteLegal,
      descripcion: ESCALA_PREAVISO[1].descripcion,
    };
  }
  // Cumplido periodo de prueba hasta 1 año → 30 días (Art. 87 inc. a)
  return {
    dias: ESCALA_PREAVISO[0].dias,
    fuenteLegal: ESCALA_PREAVISO[0].fuenteLegal,
    descripcion: ESCALA_PREAVISO[0].descripcion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado de preaviso
// ─────────────────────────────────────────────────────────────────────────────

export interface PreavisoResult {
  conceptos: Concepto[];
  alertas: Alerta[];
  diasCorresponden: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el efecto económico del preaviso según el motivo de egreso.
 *
 * Lógica:
 * - despido_sin_causa + empleador no preavisó → INGRESO: pago sustitutivo completo (Art. 90)
 * - despido_sin_causa + empleador preavisó parcialmente → INGRESO: diferencia
 * - renuncia + trabajador no preavisó → DESCUENTO: mitad del preaviso (Art. 90 2da parte)
 * - despido_con_causa → ningún efecto de preaviso
 * - periodo_prueba → ningún efecto de preaviso (Art. 60)
 */
export function calcularPreaviso(
  salarioMensual: number,
  antiguedad: Antiguedad,
  motivo: MotivoEgreso,
  preavisoInput?: PreavisoInput,
  regimenLaboral: RegimenLaboral = 'general'
): PreavisoResult {
  const alertas: Alerta[] = [];
  const conceptos: Concepto[] = [];

  // Período de prueba o jubilación: sin preaviso
  if (motivo === 'periodo_prueba' || motivo === 'jubilacion') {
    return { conceptos, alertas, diasCorresponden: 0 };
  }

  // Despido con causa o Abandono de trabajo: sin pago sustitutivo de preaviso
  if (motivo === 'despido_con_causa' || motivo === 'abandono') {
    return { conceptos, alertas, diasCorresponden: 0 };
  }

  const escala = getDiasPreaviso(antiguedad, regimenLaboral);
  const jornalDiario = salarioMensual / DIVISOR_JORNAL_DIARIO;
  const diasCorresponden = escala.dias;

  // ── Despido sin causa ──────────────────────────────────────────────────────
  if (motivo === 'despido_sin_causa') {
    // Si el empleador no preavisó → pago sustitutivo total
    if (!preavisoInput || !preavisoInput.otorgado) {
      const monto = Math.round(jornalDiario * diasCorresponden);
      conceptos.push({
        id: 'preaviso_sustitutivo',
        nombre: `Preaviso (Pago Sustitutivo ${diasCorresponden} días)`,
        monto,
        dias: diasCorresponden,
        base: jornalDiario,
        formula: `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día × ${diasCorresponden} días`,
        fuenteLegal: `Art. 87 y 90, Ley N.º 213/93 — ${escala.descripcion}`,
        esDescuento: false,
      });
    }
    // Si fue parcial → pagar la diferencia
    else if (
      preavisoInput.otorgado &&
      preavisoInput.diasOtorgados !== undefined &&
      preavisoInput.diasOtorgados < diasCorresponden
    ) {
      const diasFaltantes = diasCorresponden - preavisoInput.diasOtorgados;
      const monto = Math.round(jornalDiario * diasFaltantes);
      conceptos.push({
        id: 'preaviso_sustitutivo_parcial',
        nombre: `Preaviso Sustitutivo Parcial (${diasFaltantes} días restantes)`,
        monto,
        dias: diasFaltantes,
        base: jornalDiario,
        formula:
          `${diasCorresponden} días - ${preavisoInput.diasOtorgados} días otorgados = ` +
          `${diasFaltantes} días × Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día`,
        fuenteLegal: `Art. 87 y 90, Ley N.º 213/93`,
        esDescuento: false,
      });
    }
    // Si el preaviso fue completo → sin efecto económico adicional
    return { conceptos, alertas, diasCorresponden };
  }

  // ── Renuncia voluntaria ────────────────────────────────────────────────────
  if (motivo === 'renuncia') {
    // Si el trabajador no preavisó → DESCUENTO: mitad del valor del preaviso
    const trabajadorNoPreavisó =
      !preavisoInput || !preavisoInput.otorgado;
    if (trabajadorNoPreavisó) {
      const diasDescuento = Math.ceil(diasCorresponden / 2);
      const monto = Math.round(jornalDiario * diasDescuento);
      conceptos.push({
        id: 'descuento_preaviso_renuncia',
        nombre: `Descuento Preaviso Omitido (${diasDescuento} días)`,
        monto,
        dias: diasDescuento,
        base: jornalDiario,
        formula:
          `${diasCorresponden} días de preaviso ÷ 2 = ${diasDescuento} días × ` +
          `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día`,
        fuenteLegal: 'Art. 90 (2do párrafo), Ley N.º 213/93',
        incertidumbre:
          'El trabajador debía preavisar y no lo hizo. Se descuenta la mitad del preaviso correspondiente.',
        esDescuento: true,
      });
    }
    return { conceptos, alertas, diasCorresponden };
  }

  // ── Retiro justificado ─────────────────────────────────────────────────────
  if (motivo === 'retiro_justificado') {
    // Similar a despido sin causa si la causa es válida
    const monto = Math.round(jornalDiario * diasCorresponden);
    conceptos.push({
      id: 'preaviso_retiro_justificado',
      nombre: `Preaviso (Retiro Justificado — ${diasCorresponden} días)`,
      monto,
      dias: diasCorresponden,
      base: jornalDiario,
      formula: `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día × ${diasCorresponden} días`,
      fuenteLegal: `Art. 84 y 87, Ley N.º 213/93`,
      incertidumbre:
        'El preaviso en retiro justificado depende de que la causa sea válida (Art. 84 C.T.). Resultado provisional.',
      esDescuento: false,
    });
    return { conceptos, alertas, diasCorresponden };
  }

  // ── Mutuo acuerdo ──────────────────────────────────────────────────────────
  if (motivo === 'mutuo_acuerdo') {
    alertas.push({
      id: 'A04_preaviso',
      tipo: 'amarilla',
      mensaje:
        'En el mutuo acuerdo, el preaviso depende de lo pactado. ' +
        'No se calculó ningún monto automáticamente. Revisar el documento de acuerdo.',
      accion: 'revisar',
    });
    return { conceptos, alertas, diasCorresponden };
  }

  return { conceptos, alertas, diasCorresponden };
}
