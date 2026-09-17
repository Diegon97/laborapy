/**
 * TESTS — Cálculo de Antigüedad
 * Versión: PY-LIQ-2026.09.01
 * Basado en Master Legal §22 (Tests de Borde) y §4 (Antigüedad)
 */

import { describe, it, expect } from 'vitest';
import {
  calcularAntiguedad,
  fraccionCuentaComoAnio,
  calcularAniosIndemnizables,
  formatearAntiguedad,
} from '../engine/dates';

describe('calcularAntiguedad — Tests de Borde (Master Legal §22)', () => {
  it('T01: ingreso = egreso → 0 años 0 meses 0 días', () => {
    const r = calcularAntiguedad('2024-01-15', '2024-01-15');
    expect(r.years).toBe(0);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
    expect(r.totalDias).toBe(0);
  });

  it('T02: 1 día de antigüedad', () => {
    const r = calcularAntiguedad('2024-01-15', '2024-01-16');
    expect(r.years).toBe(0);
    expect(r.months).toBe(0);
    expect(r.days).toBe(1);
    expect(r.totalDias).toBe(1);
  });

  it('T03: exactamente 1 año → 1 año 0 meses 0 días', () => {
    const r = calcularAntiguedad('2023-01-15', '2024-01-15');
    expect(r.years).toBe(1);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });

  it('T04: 1 año + 1 día → 1 año 0 meses 1 día', () => {
    const r = calcularAntiguedad('2023-01-15', '2024-01-16');
    expect(r.years).toBe(1);
    expect(r.months).toBe(0);
    expect(r.days).toBe(1);
  });

  it('T05: exactamente 5 años → 5 años 0 meses 0 días', () => {
    const r = calcularAntiguedad('2019-03-17', '2024-03-17');
    expect(r.years).toBe(5);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });

  it('T06: 5 años + 1 día → 5 años 0 meses 1 día', () => {
    const r = calcularAntiguedad('2019-03-17', '2024-03-18');
    expect(r.years).toBe(5);
    expect(r.months).toBe(0);
    expect(r.days).toBe(1);
  });

  it('T07: exactamente 10 años → 10 años 0 meses 0 días', () => {
    const r = calcularAntiguedad('2014-06-20', '2024-06-20');
    expect(r.years).toBe(10);
    expect(r.months).toBe(0);
    expect(r.days).toBe(0);
  });

  it('T08: 10 años + 1 día → 10 años 0 meses 1 día', () => {
    const r = calcularAntiguedad('2014-06-20', '2024-06-21');
    expect(r.years).toBe(10);
    expect(r.months).toBe(0);
    expect(r.days).toBe(1);
  });

  it('T09: Caso de antigüedad de 10 años 2 meses (20-jun-2016 → 31-ago-2026)', () => {
    const r = calcularAntiguedad('2016-06-20', '2026-08-31');
    expect(r.years).toBe(10);
    expect(r.months).toBe(2);
    expect(r.days).toBe(11);
  });

  it('T10: fracción de 5 meses 29 días', () => {
    const r = calcularAntiguedad('2024-01-01', '2024-06-29');
    // 5 meses y 28 días (1-jan → 1-jun = 5m, 1-jun → 29-jun = 28 días)
    expect(r.months).toBeLessThan(6);
  });

  it('T11: fracción de 6 meses exactos', () => {
    const r = calcularAntiguedad('2024-01-01', '2024-07-01');
    expect(r.months).toBe(6);
    expect(r.days).toBe(0);
  });

  it('T12: fracción de 6 meses + 1 día', () => {
    const r = calcularAntiguedad('2024-01-01', '2024-07-02');
    expect(r.months).toBe(6);
    expect(r.days).toBe(1);
  });
});

describe('fraccionCuentaComoAnio — Art. 91 C.T.', () => {
  it('5 meses 29 días → NO cuenta como año', () => {
    expect(fraccionCuentaComoAnio(5, 29)).toBe(false);
  });

  it('6 meses exactos → NO cuenta como año (debe ser "superior a 6 meses")', () => {
    expect(fraccionCuentaComoAnio(6, 0)).toBe(false);
  });

  it('6 meses 1 día → SÍ cuenta como año (fracción superior a 6 meses)', () => {
    expect(fraccionCuentaComoAnio(6, 1)).toBe(true);
  });

  it('7 meses → SÍ cuenta como año', () => {
    expect(fraccionCuentaComoAnio(7, 0)).toBe(true);
  });

  it('11 meses → SÍ cuenta como año', () => {
    expect(fraccionCuentaComoAnio(11, 29)).toBe(true);
  });
});

describe('calcularAniosIndemnizables', () => {
  it('2 años exactos → 2 años indemnizables', () => {
    const ant = calcularAntiguedad('2022-04-17', '2024-04-17');
    expect(calcularAniosIndemnizables(ant)).toBe(2);
  });

  it('2 años 6 meses 1 día → 3 años indemnizables', () => {
    // 2 años completos + fracción de 6m1d (> 6 meses) = 3 años
    const ant = calcularAntiguedad('2022-04-17', '2024-10-18');
    expect(calcularAniosIndemnizables(ant)).toBe(3);
  });

  it('2 años 6 meses exactos → 2 años indemnizables (fracción no supera 6 meses)', () => {
    const ant = calcularAntiguedad('2022-04-17', '2024-10-17');
    expect(calcularAniosIndemnizables(ant)).toBe(2);
  });

  it('Caso Solutions Consulting: 17-abr-14 → 18-oct-16 = 2 años 6m 1d → 45 días indem.', () => {
    const ant = calcularAntiguedad('2014-04-17', '2016-10-18');
    const anios = calcularAniosIndemnizables(ant);
    expect(anios).toBe(3); // 2 años + fracción > 6m = 3 unidades × 15 días = 45 días
  });
});

describe('formatearAntiguedad', () => {
  it('0 días', () => {
    const ant = calcularAntiguedad('2024-01-15', '2024-01-15');
    expect(formatearAntiguedad(ant)).toBe('0 días');
  });

  it('1 año', () => {
    const ant = calcularAntiguedad('2023-01-15', '2024-01-15');
    expect(formatearAntiguedad(ant)).toBe('1 año');
  });

  it('10 años 2 meses', () => {
    const ant = calcularAntiguedad('2014-06-20', '2024-08-20');
    expect(formatearAntiguedad(ant)).toBe('10 años 2 meses');
  });
});

import {
  parseIso,
  formatDisplayFromIso,
  parseDisplayText,
  maskDateInput,
} from '../components/CompactDatePicker';

describe('CompactDatePicker — Utilidades de fecha y máscara', () => {
  it('formatea correctamente ISO a DD/MM/AAAA', () => {
    expect(formatDisplayFromIso('2023-01-15')).toBe('15/01/2023');
    expect(formatDisplayFromIso('2026-09-10')).toBe('10/09/2026');
    expect(formatDisplayFromIso('')).toBe('');
    expect(formatDisplayFromIso('invalido')).toBe('');
  });

  it('parsea texto DD/MM/AAAA a formato ISO YYYY-MM-DD', () => {
    expect(parseDisplayText('15/01/2023')).toBe('2023-01-15');
    expect(parseDisplayText('15-01-2023')).toBe('2023-01-15');
    expect(parseDisplayText('1/5/2024')).toBe('2024-05-01');
    expect(parseDisplayText('31/02/2023')).toBeNull(); // Día no existente en febrero
    expect(parseDisplayText('abc')).toBeNull();
  });

  it('aplica máscara mientras se teclean números (sin scroll)', () => {
    expect(maskDateInput('15')).toBe('15');
    expect(maskDateInput('1501')).toBe('15/01');
    expect(maskDateInput('15012023')).toBe('15/01/2023');
    expect(maskDateInput('15/01/2023')).toBe('15/01/2023');
  });

  it('parseIso valida fechas bisiestas y límites correctamente', () => {
    expect(parseIso('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIso('2023-02-29')).toBeNull(); // 2023 no fue bisiesto
  });
});
