/**
 * TESTS — Aguinaldo Proporcional
 * Versión: PY-LIQ-2026.09.01
 * Art. 243-244, Ley N.º 213/93
 */

import { describe, it, expect } from 'vitest';
import { calcularAguinaldo } from '../engine/aguinaldo';

describe('calcularAguinaldo — Art. 243-244 C.T.', () => {
  it('A01: Salario fijo, egreso 31 de julio (7 meses) → (salario × 7) ÷ 12', () => {
    const salario = 2_400_000;
    const res = calcularAguinaldo(salario, '2024-07-31');

    // 7 meses acumulados: 2.400.000 * 7 = 16.800.000 / 12 = 1.400.000
    expect(res.concepto.monto).toBe(1_400_000);
    expect(res.concepto.exentoIPS).toBe(true);
    expect(res.detalles.esSimplificacion).toBe(true);
  });

  it('A02: Remuneraciones variables proporcionadas → Suma real ÷ 12', () => {
    // Enero a Octubre (10 meses)
    const variablesAnio = [
      2_000_000, 2_200_000, 2_100_000, 2_500_000, 2_400_000,
      3_000_000, 3_100_000, 2_800_000, 2_900_000, 3_000_000,
    ];
    const suma = variablesAnio.reduce((a, b) => a + b, 0); // 26.000.000
    const esperado = Math.round(suma / 12); // 2.166.667

    const res = calcularAguinaldo(2_500_000, '2024-10-31', variablesAnio);

    expect(res.concepto.monto).toBe(esperado);
    expect(res.detalles.esSimplificacion).toBe(false);
    expect(res.concepto.exentoIPS).toBe(true);
  });

  it('A03: Salario mínimo completo año trabajado (egreso 31 de diciembre)', () => {
    const salario = 3_000_000;
    const res = calcularAguinaldo(salario, '2024-12-31');

    // 12 meses: 3.000.000 * 12 / 12 = 3.000.000
    expect(res.concepto.monto).toBe(3_000_000);
  });
});
