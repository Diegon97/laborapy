/**
 * TESTS — Vacaciones
 * Versión: PY-LIQ-2026.09.01
 * Art. 218-223, Ley N.º 213/93
 */

import { describe, it, expect } from 'vitest';
import { calcularVacaciones, getDiasVacacionesPorAntiguedad } from '../engine/vacaciones';
import { calcularAntiguedad } from '../engine/dates';

const SALARIO = 4_500_000; // Gs. Jornal diario: 150.000 Gs.

describe('getDiasVacacionesPorAntiguedad — Escala Art. 218 C.T.', () => {
  it('Antigüedad 1 año → 12 días', () => {
    expect(getDiasVacacionesPorAntiguedad(1).dias).toBe(12);
  });

  it('Antigüedad 5 años exactos → 12 días (hasta 5 años inclusive)', () => {
    expect(getDiasVacacionesPorAntiguedad(5).dias).toBe(12);
  });

  it('Antigüedad 6 años (> 5 y hasta 10) → 18 días', () => {
    expect(getDiasVacacionesPorAntiguedad(6).dias).toBe(18);
  });

  it('Antigüedad 10 años exactos → 18 días (hasta 10 años inclusive)', () => {
    expect(getDiasVacacionesPorAntiguedad(10).dias).toBe(18);
  });

  it('Antigüedad 11 años (> 10 años) → 30 días', () => {
    expect(getDiasVacacionesPorAntiguedad(11).dias).toBe(30);
  });
});

describe('calcularVacaciones — Casos por Motivo y Períodos', () => {
  it('V01: Despido sin causa con 2 años y 6 meses → Causadas (12 días) + Proporcionales', () => {
    const ant = calcularAntiguedad('2022-01-01', '2024-07-01'); // 2 años 6 meses
    const res = calcularVacaciones(SALARIO, ant, 'despido_sin_causa');

    const causadas = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    const proporcionales = res.conceptos.find(c => c.id === 'vacaciones_proporcionales');

    expect(causadas).toBeDefined();
    expect(causadas?.dias).toBe(12);
    expect(causadas?.monto).toBe(12 * 150_000);

    expect(proporcionales).toBeDefined();
    // 12 días / 12 * 6 meses = 6 días
    expect(proporcionales?.dias).toBe(6);
    expect(proporcionales?.monto).toBe(6 * 150_000);
  });

  it('V02: Renuncia → Solo causadas, NO vacaciones proporcionales (Art. 221)', () => {
    const ant = calcularAntiguedad('2022-01-01', '2024-07-01');
    const res = calcularVacaciones(SALARIO, ant, 'renuncia');

    const causadas = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    const proporcionales = res.conceptos.find(c => c.id === 'vacaciones_proporcionales');

    expect(causadas).toBeDefined();
    expect(causadas?.dias).toBe(12);
    expect(proporcionales).toBeUndefined();
  });

  it('V03: Despido con justa causa → Solo causadas, NO proporcionales', () => {
    const ant = calcularAntiguedad('2022-01-01', '2024-07-01');
    const res = calcularVacaciones(SALARIO, ant, 'despido_con_causa');

    const causadas = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    const proporcionales = res.conceptos.find(c => c.id === 'vacaciones_proporcionales');

    expect(causadas).toBeDefined();
    expect(proporcionales).toBeUndefined();
  });

  it('V04: Períodos anteriores vencidos (>6 meses) → Pago Doble x2 (Arts. 221 y 223 C.T.)', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01');
    const res = calcularVacaciones(SALARIO, ant, 'despido_sin_causa', 18, 0, true);

    const anteriores = res.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores');
    expect(anteriores).toBeDefined();
    expect(anteriores?.dias).toBe(18);
    expect(anteriores?.base).toBe(150_000 * 2);
    // 18 * 150.000 * 2 = 5.400.000 Gs.
    expect(anteriores?.monto).toBe(18 * 150_000 * 2);

    const alerta = res.alertas.find(a => a.id === 'A05_VENCIDAS_DOBLE');
    expect(alerta).toBeDefined();
    expect(alerta?.tipo).toBe('info');
  });

  it('V04-b: Períodos anteriores no vencidos (en período de gracia) → Pago Simple x1', () => {
    const ant = calcularAntiguedad('2020-01-01', '2024-01-01');
    const res = calcularVacaciones(SALARIO, ant, 'despido_sin_causa', 18, 0, false);

    const anteriores = res.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores');
    expect(anteriores).toBeDefined();
    expect(anteriores?.dias).toBe(18);
    expect(anteriores?.base).toBe(150_000);
    // 18 * 150.000 * 1 = 2.700.000 Gs.
    expect(anteriores?.monto).toBe(18 * 150_000);

    const alerta = res.alertas.find(a => a.id === 'A05');
    expect(alerta).toBeDefined();
    expect(alerta?.tipo).toBe('amarilla');
  });

  it('V05: Menos de 1 año en período de prueba → Vacaciones proporcionales (Art. 60)', () => {
    const ant = calcularAntiguedad('2024-01-01', '2024-03-01'); // 2 meses
    const res = calcularVacaciones(SALARIO, ant, 'periodo_prueba');

    const causadas = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    const proporcionales = res.conceptos.find(c => c.id === 'vacaciones_proporcionales');

    expect(causadas).toBeUndefined();
    expect(proporcionales).toBeDefined();
    expect(proporcionales?.dias).toBe(2); // 12/12 * 2 = 2 días
    expect(proporcionales?.monto).toBe(2 * 150_000);
  });
});
