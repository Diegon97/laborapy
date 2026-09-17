/**
 * TESTS UNITARIOS DEL MOTOR DE AUDITORÍA LABORAL ("SEGUNDO OJO") — LABORAPY
 * Framework: Vitest
 */

import { describe, it, expect } from 'vitest';
import {
  auditSettlement,
  parseNumericInput,
  calculateSeniorityYears,
  requiredPreavisoDays,
  resolveSalarioMinimo,
  SMV_2026_MONTO,
  SMV_FALLBACK_MONTO,
} from '../hrAuditor';
import type { LiquidacionInput, LiquidacionResult } from '../types';

describe('hrAuditor — Parser Numérico Defensivo', () => {
  it('convierte números directamente', () => {
    expect(parseNumericInput(2798309)).toBe(2798309);
    expect(parseNumericInput(0)).toBe(0);
    expect(parseNumericInput(-1500)).toBe(-1500);
  });

  it('retorna undefined para entradas no numéricas o vacías (nunca 0 silencioso)', () => {
    expect(parseNumericInput('')).toBeUndefined();
    expect(parseNumericInput('   ')).toBeUndefined();
    expect(parseNumericInput(null)).toBeUndefined();
    expect(parseNumericInput(undefined)).toBeUndefined();
    expect(parseNumericInput('abc')).toBeUndefined();
    expect(parseNumericInput(NaN)).toBeUndefined();
  });

  it('procesa formato paraguayo con puntos de miles y comas decimales', () => {
    expect(parseNumericInput('2.798.309')).toBe(2798309);
    expect(parseNumericInput('Gs. 3.044.000')).toBe(3044000);
    expect(parseNumericInput('1.500,50')).toBe(1500.5);
    expect(parseNumericInput('(500.000)')).toBe(-500000);
  });
});

describe('hrAuditor — Parámetros Legales y Antigüedad', () => {
  it('resuelve el salario mínimo legal según el año', () => {
    expect(resolveSalarioMinimo(2026).monto).toBe(SMV_2026_MONTO);
    expect(resolveSalarioMinimo(2024).monto).toBe(SMV_FALLBACK_MONTO);
  });

  it('calcula la antigüedad en años cronológicos', () => {
    expect(calculateSeniorityYears('2020-01-01', '2023-01-01')).toBe(3);
    expect(calculateSeniorityYears('2022-06-01', '2023-05-15')).toBe(0);
    expect(calculateSeniorityYears('2018-05-10', '2028-05-10')).toBe(10);
  });

  it('determina los días de preaviso obligatorios por ley', () => {
    expect(requiredPreavisoDays(1)).toBe(30);
    expect(requiredPreavisoDays(4)).toBe(45);
    expect(requiredPreavisoDays(5)).toBe(45);
    expect(requiredPreavisoDays(10)).toBe(60);
    expect(requiredPreavisoDays(11)).toBe(90);
  });
});

describe('hrAuditor — Reglas de Auditoría de Liquidaciones', () => {
  it('R1: detecta salario por debajo del mínimo legal vigente', () => {
    const input: Partial<LiquidacionInput> = {
      salarioMensual: 2000000,
      motivo: 'renuncia',
    };
    const report = auditSettlement(input, undefined, { year: 2026 });
    expect(report.healthStatus).toBe('critico');
    expect(report.findings.some((f) => f.code === 'SMV_VIOLATION')).toBe(true);
    expect(report.score).toBeLessThanOrEqual(75);
  });

  it('R2: detecta indemnización improcedente en renuncia voluntaria', () => {
    const input: Partial<LiquidacionInput> = {
      salarioMensual: 3044000,
      motivo: 'renuncia',
    };
    const result = {
      indemnizacion: 1500000,
    } as unknown as Partial<LiquidacionResult>;
    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.healthStatus).toBe('critico');
    expect(report.findings.some((f) => f.code === 'INDEMNIZACION_INDEBIDA')).toBe(true);
  });

  it('R2: detecta falta de indemnización obligatoria en despido sin causa', () => {
    const input: Partial<LiquidacionInput> = {
      salarioMensual: 3044000,
      motivo: 'despido_sin_causa',
      fechaIngreso: '2020-01-01',
      fechaEgreso: '2023-01-01',
    };
    const result = {
      indemnizacion: 0,
    } as unknown as Partial<LiquidacionResult>;
    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.healthStatus).toBe('critico');
    expect(report.findings.some((f) => f.code === 'INDEMNIZACION_FALTANTE')).toBe(true);
  });

  it('R3: detecta retención ilegal de IPS sobre el aguinaldo', () => {
    const input: Partial<LiquidacionInput> = {
      salarioMensual: 3044000,
      motivo: 'renuncia',
    };
    const result: Partial<LiquidacionResult> = {
      totalBruto: 3044000,
      conceptos: [
        {
          id: 'ips_aguinaldo',
          nombre: 'Retención IPS sobre Aguinaldo',
          monto: 135000,
          esDescuento: true,
          fuenteLegal: 'Ilegal',
        },
      ],
    };
    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.healthStatus).toBe('critico');
    expect(report.findings.some((f) => f.code === 'IPS_AGUINALDO_PROHIBIDO')).toBe(true);
  });

  it('R4: detecta preaviso insuficiente en despido sin causa', () => {
    const input = {
      salarioMensual: 3044000,
      motivo: 'despido_sin_causa',
      fechaIngreso: '2015-01-01',
      fechaEgreso: '2023-01-01', // 8 años -> corresponde 60 días
      preavisoDias: 30, // se otorgaron solo 30
    } as unknown as Partial<LiquidacionInput>;
    const result = {
      indemnizacion: 12000000,
      preavisoMonto: 0,
    } as unknown as Partial<LiquidacionResult>;
    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.findings.some((f) => f.code === 'PREAVISO_INSUFICIENTE')).toBe(true);
  });

  it('R5: detecta descuentos excesivos (>30% warning y >50% error)', () => {
    const inputWarning: Partial<LiquidacionInput> = {
      salarioMensual: 4000000,
      motivo: 'renuncia',
    };
    const resultWarning: Partial<LiquidacionResult> = {
      totalBruto: 4000000,
      totalDescuentos: 1600000, // 40% -> warning
    };
    const reportWarning = auditSettlement(inputWarning, resultWarning, { year: 2026 });
    expect(reportWarning.findings.some((f) => f.code === 'DESCUENTO_EXCESIVO_30')).toBe(true);

    const resultError: Partial<LiquidacionResult> = {
      totalBruto: 4000000,
      totalDescuentos: 2400000, // 60% -> error
    };
    const reportError = auditSettlement(inputWarning, resultError, { year: 2026 });
    expect(reportError.findings.some((f) => f.code === 'DESCUENTO_EXCESIVO_50')).toBe(true);
  });

  it('R6: detecta anticipo de aguinaldo superior al devengado', () => {
    const input = {
      salarioMensual: 3044000,
      motivo: 'renuncia',
      anticipoAguinaldo: 2000000,
    } as unknown as Partial<LiquidacionInput>;
    const result: Partial<LiquidacionResult> = {
      aguinaldoProporcional: 1000000,
    };
    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.findings.some((f) => f.code === 'ANTICIPO_AGUINALDO_EXCESIVO')).toBe(true);
  });

  it('evalúa una liquidación óptima con puntaje 100 y estado optimo', () => {
    const input: Partial<LiquidacionInput> = {
      salarioMensual: 3500000,
      motivo: 'despido_sin_causa',
      fechaIngreso: '2021-01-01',
      fechaEgreso: '2023-01-01', // 2 años -> 45 días preaviso
      preaviso: {
        obligado: 'empleador',
        otorgado: true,
        diasOtorgados: 45,
      },
    };
    const result = {
      totalBruto: 3500000,
      indemnizacion: 3500000,
      aguinaldoProporcional: 1200000,
      totalDescuentos: 315000, // 9% IPS ordinario (<25%)
      antiguedad: { years: 2, months: 0, days: 0, totalDias: 730 },
      conceptos: [
        {
          id: 'indemnizacion',
          nombre: 'Indemnización por Antigüedad',
          monto: 3500000,
          esDescuento: false,
          fuenteLegal: 'Art. 91 C.T.',
        },
      ],
    } as unknown as Partial<LiquidacionResult>;

    const report = auditSettlement(input, result, { year: 2026 });
    expect(report.healthStatus).toBe('optimo');
    expect(report.score).toBe(100);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });
});
