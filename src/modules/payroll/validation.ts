/**
 * VALIDACIONES DE ENTRADA — Motor Liquidación PY
 * Versión: PY-LIQ-2026.09.01
 */

import type { LiquidacionInput, ValidationResult, ValidationError } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isFinitePositive(n: unknown): boolean {
  return typeof n === 'number' && isFinite(n) && n > 0;
}

function isFiniteNonNegative(n: unknown): boolean {
  return typeof n === 'number' && isFinite(n) && n >= 0;
}

function isValidISODate(s: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s)) return false;
  const d = new Date(s);
  return d instanceof Date && !isNaN(d.getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Validador principal
// ─────────────────────────────────────────────────────────────────────────────

export function validarInput(input: LiquidacionInput): ValidationResult {
  const errores: ValidationError[] = [];

  // ── Fechas ───────────────────────────────────────────────────────────────
  if (!input.fechaIngreso || !isValidISODate(input.fechaIngreso)) {
    errores.push({
      field: 'fechaIngreso',
      mensaje: 'La fecha de ingreso es obligatoria y debe tener formato YYYY-MM-DD.',
    });
  }

  if (!input.fechaEgreso || !isValidISODate(input.fechaEgreso)) {
    errores.push({
      field: 'fechaEgreso',
      mensaje: 'La fecha de egreso es obligatoria y debe tener formato YYYY-MM-DD.',
    });
  }

  if (
    isValidISODate(input.fechaIngreso) &&
    isValidISODate(input.fechaEgreso) &&
    new Date(input.fechaEgreso) < new Date(input.fechaIngreso)
  ) {
    errores.push({
      field: 'fechaEgreso',
      mensaje: 'La fecha de egreso no puede ser anterior a la fecha de ingreso.',
    });
  }

  // ── Motivo ────────────────────────────────────────────────────────────────
  const motivosValidos = [
    'renuncia',
    'despido_sin_causa',
    'despido_con_causa',
    'abandono',
    'retiro_justificado',
    'mutuo_acuerdo',
    'contrato_plazo_fijo',
    'periodo_prueba',
    'jubilacion',
  ];
  if (!input.motivo || !motivosValidos.includes(input.motivo)) {
    errores.push({
      field: 'motivo',
      mensaje: `El motivo de egreso es obligatorio. Valores válidos: ${motivosValidos.join(', ')}.`,
    });
  }

  // ── Salario ───────────────────────────────────────────────────────────────
  if (!isFinitePositive(input.salarioMensual)) {
    errores.push({
      field: 'salarioMensual',
      mensaje: 'El salario mensual debe ser un número positivo y finito (en Guaraníes).',
    });
  }

  // ── Variables ─────────────────────────────────────────────────────────────
  if (
    input.remuneracionesAnio !== undefined &&
    !Array.isArray(input.remuneracionesAnio)
  ) {
    errores.push({
      field: 'remuneracionesAnio',
      mensaje: 'remuneracionesAnio debe ser un arreglo de montos mensuales.',
    });
  }

  if (Array.isArray(input.remuneracionesAnio)) {
    const invalidos = input.remuneracionesAnio.filter((v) => !isFiniteNonNegative(v));
    if (invalidos.length > 0) {
      errores.push({
        field: 'remuneracionesAnio',
        mensaje: 'Todos los valores de remuneracionesAnio deben ser números no negativos.',
      });
    }
  }

  if (
    input.remuneracionesUltimos6Meses !== undefined &&
    Array.isArray(input.remuneracionesUltimos6Meses) &&
    input.remuneracionesUltimos6Meses.length > 6
  ) {
    errores.push({
      field: 'remuneracionesUltimos6Meses',
      mensaje: 'remuneracionesUltimos6Meses no puede tener más de 6 elementos.',
    });
  }

  // ── Vacaciones ────────────────────────────────────────────────────────────
  if (
    input.vacacionesPeriodoActual !== undefined &&
    !isFiniteNonNegative(input.vacacionesPeriodoActual)
  ) {
    errores.push({
      field: 'vacacionesPeriodoActual',
      mensaje: 'Los días de vacaciones del período actual deben ser 0 o un número positivo.',
    });
  }

  if (
    input.vacacionesPeriodosAnteriores !== undefined &&
    !isFiniteNonNegative(input.vacacionesPeriodosAnteriores)
  ) {
    errores.push({
      field: 'vacacionesPeriodosAnteriores',
      mensaje: 'Los días de vacaciones de períodos anteriores deben ser 0 o un número positivo.',
    });
  }

  // ── Salarios pendientes ───────────────────────────────────────────────────
  if (
    input.salariosPendientes !== undefined &&
    !isFiniteNonNegative(input.salariosPendientes)
  ) {
    errores.push({
      field: 'salariosPendientes',
      mensaje: 'Los salarios pendientes deben ser 0 o un número positivo.',
    });
  }

  // ── Preaviso ──────────────────────────────────────────────────────────────
  if (input.preaviso !== undefined) {
    if (!['empleador', 'trabajador'].includes(input.preaviso.obligado)) {
      errores.push({
        field: 'preaviso.obligado',
        mensaje: 'El campo obligado del preaviso debe ser "empleador" o "trabajador".',
      });
    }
    if (
      input.preaviso.diasOtorgados !== undefined &&
      !isFiniteNonNegative(input.preaviso.diasOtorgados)
    ) {
      errores.push({
        field: 'preaviso.diasOtorgados',
        mensaje: 'Los días de preaviso otorgados deben ser 0 o un número positivo.',
      });
    }
  }

  // ── Descuentos adicionales ────────────────────────────────────────────────
  if (Array.isArray(input.descuentosAdicionales)) {
    input.descuentosAdicionales.forEach((d, i) => {
      if (!isFiniteNonNegative(d.monto)) {
        errores.push({
          field: `descuentosAdicionales[${i}].monto`,
          mensaje: `El monto del descuento "${d.concepto}" debe ser 0 o un número positivo.`,
        });
      }
    });
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}
