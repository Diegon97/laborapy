/**
 * TESTS — Bonificación Familiar (Asignación Familiar)
 * Versión: PY-LIQ-2026.09.05
 * Arts. 261 al 271, Ley N.º 213/93 (Código del Trabajo de Paraguay)
 */

import { describe, it, expect } from 'vitest';
import { calcularBonificacionFamiliar } from '../engine/bonificacion';
import { calcularLiquidacion } from '../liquidacion';
import { SALARIO_MINIMO_MENSUAL_2026, ASIGNACION_FAMILIAR_LIMITE_SALARIO } from '../constants';
import type { LiquidacionInput } from '../types';

describe('calcularBonificacionFamiliar — Arts. 261 al 271 C.T.', () => {
  it('B01: Sin hijos y sin pendientes → 0 Gs., sin concepto y sin derecho por tope', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-31',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 0,
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(0);
    expect(res.concepto).toBeUndefined();
    expect(res.correspondePorTope).toBe(false);
  });

  it('B02: 1 hijo, 30 días de egreso, salario mínimo (Gs. 3.044.000) → Gs. 152.200 exactos (5% SML)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: SALARIO_MINIMO_MENSUAL_2026,
      tieneVariables: false,
      hijosMenoresACargo: 1,
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(152_200);
    expect(res.correspondePorTope).toBe(true);
    expect(res.concepto).toBeDefined();
    expect(res.concepto?.monto).toBe(152_200);
    expect(res.concepto?.exentoIPS).toBe(true);
    expect(res.concepto?.esDescuento).toBe(false);
    expect(res.alertas.some(a => a.id === 'A12_BONIFICACION_OTORGADA')).toBe(true);
  });

  it('B03: 2 hijos, egreso el día 15 de mes → pago íntegro mensual Gs. 304.400 (Art. 269 C.T.)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-15',
      motivo: 'renuncia',
      salarioMensual: 3_500_000,
      tieneVariables: false,
      hijosMenoresACargo: 2,
    };
    // Art. 269 C.T.: la bonificación familiar se abona simultáneamente con el salario y en forma íntegra (152.200 * 2 = 304.400 Gs.)
    const res = calcularBonificacionFamiliar(input, 15);
    expect(res.montoTotal).toBe(304_400);
    expect(res.correspondePorTope).toBe(true);
  });

  it('B04: Salario exactamente en el tope de 2 salarios mínimos (Gs. 6.088.000) → SÍ corresponde por ley', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-31',
      motivo: 'despido_sin_causa',
      salarioMensual: ASIGNACION_FAMILIAR_LIMITE_SALARIO, // 6.088.000
      tieneVariables: false,
      hijosMenoresACargo: 1,
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.correspondePorTope).toBe(true);
    expect(res.montoTotal).toBe(152_200);
  });

  it('B05: Salario supera el tope de 2 salarios mínimos (Gs. 6.088.001) → NO corresponde por Art. 263 C.T.', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-31',
      motivo: 'despido_sin_causa',
      salarioMensual: ASIGNACION_FAMILIAR_LIMITE_SALARIO + 1, // 6.088.001
      tieneVariables: false,
      hijosMenoresACargo: 2,
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.correspondePorTope).toBe(false);
    expect(res.montoTotal).toBe(0);
    expect(res.concepto).toBeUndefined();
    expect(res.alertas).toHaveLength(0);
  });

  it('B06: Con asignación pendiente de meses anteriores adeudada → Suma íntegro al total', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 1,
      bonificacionFamiliarPendiente: 304_400, // 2 meses atrasados adeudados
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(152_200 + 304_400); // 456.600
    expect(res.concepto?.monto).toBe(456_600);
  });

  it('B08: Pareja trabaja en la misma empresa y empleado liquidado es el padre → 0 Gs. (exclusividad materna Art. 265)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 1,
      parejaTrabajaEnMismaEmpresa: true,
      esMadreTitular: false, // Es el padre
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(0);
    expect(res.correspondePorTope).toBe(false);
    expect(res.concepto).toBeUndefined();
    expect(res.alertas.some(a => a.id === 'A11_BONIFICACION_MADRE_EXCLUSIVA')).toBe(true);
  });

  it('B09: Pareja en misma empresa y madre supera 2 SML → No cobra y NO se traslada al padre (Arts. 263 y 265)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 2,
      parejaTrabajaEnMismaEmpresa: true,
      esMadreTitular: true,
      salarioMadreMismaEmpresa: ASIGNACION_FAMILIAR_LIMITE_SALARIO + 500_000, // 6.588.000 > 2 SML
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(0);
    expect(res.correspondePorTope).toBe(false);
    expect(res.concepto).toBeUndefined();
    expect(res.alertas.some(a => a.id === 'A11_BONIFICACION_MADRE_SUPERATOPE_NO_TRASLADA')).toBe(true);
  });

  it('B10: Hijo con discapacidad acreditada → Cobro vitalicio de por vida (Art. 261 C.T.)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 0,
      hijosDiscapacidad: 1, // Hijo con discapacidad sin límite de edad
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(152_200);
    expect(res.correspondePorTope).toBe(true);
    expect(res.concepto).toBeDefined();
    expect(res.concepto?.nombre).toContain('discapacidad vitalicia');
    expect(res.alertas.some(a => a.id === 'A12_BONIFICACION_OTORGADA')).toBe(true);
  });

  it('B11: Combinación de 1 hijo menor + 1 hijo con discapacidad → 2 hijos computables (Gs. 304.400)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-03-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 1,
      hijosDiscapacidad: 1,
    };
    const res = calcularBonificacionFamiliar(input, 30);
    expect(res.montoTotal).toBe(304_400);
    expect(res.correspondePorTope).toBe(true);
    expect(res.concepto?.monto).toBe(304_400);
  });
});

describe('calcularLiquidacion — Integración con Bonificación Familiar', () => {
  it('B07: Integración completa: suma al total bruto y neto sin descuento de IPS ni aumento de aguinaldo', () => {
    const baseSinHijos: LiquidacionInput = {
      fechaIngreso: '2024-01-01',
      fechaEgreso: '2026-01-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      hijosMenoresACargo: 0,
      regimen: 'general',
    };
    const baseConHijos: LiquidacionInput = {
      ...baseSinHijos,
      hijosMenoresACargo: 2, // 2 hijos = 304.400 Gs.
    };

    const resSin = calcularLiquidacion(baseSinHijos);
    const resCon = calcularLiquidacion(baseConHijos);

    const bonifConcepto = resCon.conceptos.find(c => c.id === 'bonificacion_familiar');
    expect(bonifConcepto).toBeDefined();
    expect(bonifConcepto?.monto).toBe(304_400);

    // El aguinaldo no debe verse afectado (Art. 268 C.T.)
    expect(resCon.aguinaldoProporcional).toBe(resSin.aguinaldoProporcional);

    // Los descuentos de IPS no deben aumentar por la bonificación (exento de IPS)
    expect(resCon.totalDescuentos).toBe(resSin.totalDescuentos);

    // El neto a cobrar debe aumentar exactamente en los 304.400 Gs. de la bonificación
    expect(resCon.totalNetoEstimado).toBe(resSin.totalNetoEstimado + 304_400);
  });
});
