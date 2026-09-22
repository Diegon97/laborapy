/**
 * TESTS — Preaviso
 * Versión: PY-LIQ-2026.09.01
 * Art. 87-90, Ley N.º 213/93
 */

import { describe, it, expect } from 'vitest';
import { calcularPreaviso, getDiasPreaviso } from '../engine/preaviso';
import { calcularAntiguedad } from '../engine/dates';

const SALARIO = 4_500_000; // Gs. Jornal diario: 150.000 Gs.

describe('getDiasPreaviso — Escala Art. 87 C.T.', () => {
  it('Antigüedad hasta 1 año → 30 días', () => {
    expect(getDiasPreaviso(1).dias).toBe(30);
  });

  it('Antigüedad 5 años exactos → 45 días (> 1 y hasta 5)', () => {
    expect(getDiasPreaviso(5).dias).toBe(45);
  });

  it('Antigüedad 6 años → 60 días (> 5 y hasta 10)', () => {
    expect(getDiasPreaviso(6).dias).toBe(60);
  });

  it('Antigüedad 10 años exactos → 60 días (hasta 10 inclusive)', () => {
    expect(getDiasPreaviso(10).dias).toBe(60);
  });

  it('Antigüedad 11 años → 90 días (> 10 años)', () => {
    expect(getDiasPreaviso(11).dias).toBe(90);
  });
});

describe('calcularPreaviso — Escenarios Empleador y Trabajador', () => {
  it('P01: Despido sin causa no preavisado (antigüedad 3 años) → Pago sustitutivo 45 días', () => {
    const ant = calcularAntiguedad('2021-01-01', '2024-01-01');
    const res = calcularPreaviso(SALARIO, ant, 'despido_sin_causa', {
      obligado: 'empleador',
      otorgado: false,
    });

    const concepto = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    expect(concepto).toBeDefined();
    expect(concepto?.dias).toBe(45);
    expect(concepto?.monto).toBe(45 * 150_000);
    expect(concepto?.esDescuento).toBe(false);
  });

  it('P02: Despido sin causa con preaviso parcial (otorgados 15 de 45) → Diferencia 30 días', () => {
    const ant = calcularAntiguedad('2021-01-01', '2024-01-01');
    const res = calcularPreaviso(SALARIO, ant, 'despido_sin_causa', {
      obligado: 'empleador',
      otorgado: true,
      diasOtorgados: 15,
    });

    const concepto = res.conceptos.find(c => c.id === 'preaviso_sustitutivo_parcial');
    expect(concepto).toBeDefined();
    expect(concepto?.dias).toBe(30);
    expect(concepto?.monto).toBe(30 * 150_000);
  });

  it('P03: Renuncia sin preaviso (antigüedad 4 años) → Descuento del 50% del preaviso (Art. 90)', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01'); // 4 años -> 45 días
    const res = calcularPreaviso(SALARIO, ant, 'renuncia', {
      obligado: 'trabajador',
      otorgado: false,
    });

    const concepto = res.conceptos.find(c => c.id === 'descuento_preaviso_renuncia');
    expect(concepto).toBeDefined();
    expect(concepto?.esDescuento).toBe(true);
    // 45 / 2 = 23 días (Math.ceil)
    expect(concepto?.dias).toBe(23);
    expect(concepto?.monto).toBe(23 * 150_000);
  });

  it('P04: Renuncia con preaviso cumplido → Sin descuento', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01');
    const res = calcularPreaviso(SALARIO, ant, 'renuncia', {
      obligado: 'trabajador',
      otorgado: true,
      diasOtorgados: 45,
    });

    expect(res.conceptos.length).toBe(0);
  });

  it('P05: Despido con causa → Sin preaviso sustitutivo', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01');
    const res = calcularPreaviso(SALARIO, ant, 'despido_con_causa');
    expect(res.conceptos.length).toBe(0);
  });

  it('P06: Renuncia con exoneración patronal → Sin descuento y con alerta informativa', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01'); // 4 años -> 45 días
    const res = calcularPreaviso(SALARIO, ant, 'renuncia', {
      obligado: 'trabajador',
      otorgado: false,
      exonerado: true,
    });
    expect(res.conceptos.length).toBe(0);
    const alerta = res.alertas.find(a => a.id === 'PREAVISO_EXONERADO');
    expect(alerta).toBeDefined();
    expect(alerta?.tipo).toBe('info');
  });

  it('P07: Renuncia con cumplimiento parcial de preaviso → Descuento de la mitad de días omitidos', () => {
    const ant = calcularAntiguedad('2020-01-01', '2022-01-01'); // 2 años -> 45 días
    const res = calcularPreaviso(SALARIO, ant, 'renuncia', {
      obligado: 'trabajador',
      otorgado: true,
      diasOtorgados: 15, // faltan 30 días
    });
    const concepto = res.conceptos.find(c => c.id === 'descuento_preaviso_renuncia');
    expect(concepto).toBeDefined();
    expect(concepto?.dias).toBe(15); // 30 / 2 = 15 días de descuento
    expect(concepto?.monto).toBe(15 * 150_000);
    expect(concepto?.esDescuento).toBe(true);
  });

  it('P08: Renuncia con cumplimiento total de preaviso → Sin descuento', () => {
    const ant = calcularAntiguedad('2020-01-01', '2022-01-01'); // 45 días
    const res = calcularPreaviso(SALARIO, ant, 'renuncia', {
      obligado: 'trabajador',
      otorgado: true,
      diasOtorgados: 45,
    });
    expect(res.conceptos.length).toBe(0);
  });
});

describe('getDiasPreaviso — Escala Trabajo Doméstico Ley 5407/15', () => {
  it('Antigüedad menor a 1 año → 7 días', () => {
    expect(getDiasPreaviso({ years: 0, months: 6, days: 0, totalDias: 180 }, 'domestico').dias).toBe(7);
  });

  it('Antigüedad mayor a 1 año → 15 días', () => {
    expect(getDiasPreaviso(1.1, 'domestico').dias).toBe(15);
    expect(getDiasPreaviso({ years: 1, months: 1, days: 0, totalDias: 400 }, 'domestico').dias).toBe(15);
  });

  it('Despido sin causa no preavisado doméstico (>1 año) → 15 días pago sustitutivo', () => {
    const ant = calcularAntiguedad('2021-01-01', '2024-01-01');
    const res = calcularPreaviso(SALARIO, ant, 'despido_sin_causa', {
      obligado: 'empleador',
      otorgado: false,
    }, 'domestico');

    const concepto = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    expect(concepto?.dias).toBe(15);
  });
});
