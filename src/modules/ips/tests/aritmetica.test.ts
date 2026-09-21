/**
 * TESTS — Aritmética exacta de guaraníes (liquidación IPS)
 * Decreto-Ley N.º 1860/50, Art. 76 · redondeo ROUND_HALF_UP
 */

import { describe, it, expect } from 'vitest';
import {
  aGs,
  dividirHalfUp,
  aplicarTasaPorMil,
  sumarGs,
  convertirUsdAPyg,
  formatearGs,
} from '../aritmetica';

describe('aritmetica IPS - redondeo half-up, validacion de enteros y formato guaranies', () => {
  // ---------------------------------------------------------------------
  // dividirHalfUp: desempate alejandose de cero
  // ---------------------------------------------------------------------
  it('A01: dividirHalfUp resuelve el desempate exacto en 0,5 alejandose de cero (10/4 = 3)', () => {
    expect(dividirHalfUp(10n, 4n)).toBe(3n);
  });

  it('A02: dividirHalfUp redondea hacia abajo cuando el resto es menor a la mitad (9/4 = 2)', () => {
    expect(dividirHalfUp(9n, 4n)).toBe(2n);
  });

  it('A03: dividirHalfUp con negativos alejandose de cero (-10/4 = -3, -9/4 = -2)', () => {
    // -10/4 = -2,5 -> half-up alejandose de cero -> -3
    expect(dividirHalfUp(-10n, 4n)).toBe(-3n);
    // -9/4 = -2,25 -> redondea a -2
    expect(dividirHalfUp(-9n, 4n)).toBe(-2n);
  });

  it('A04: dividirHalfUp lanza al dividir por cero', () => {
    expect(() => dividirHalfUp(1n, 0n)).toThrow();
  });

  // ---------------------------------------------------------------------
  // aplicarTasaPorMil: tasa por mil con BigInt y half-up
  // ---------------------------------------------------------------------
  it('A05: aplicarTasaPorMil(7.032.050, 90) = 632.885 (half-up sube; el proceso manual con redondeo bancario devolvia 632.884)', () => {
    // 7.032.050 x 90 / 1000 = 632.884,5 exacto -> half-up sube a 632.885
    expect(aplicarTasaPorMil(7_032_050, 90)).toBe(632_885);
  });

  it('A06: aplicarTasaPorMil(7.032.050, 165) = 1.160.288', () => {
    // 7.032.050 x 165 / 1000 = 1.160.288,25 -> half-up 1.160.288
    expect(aplicarTasaPorMil(7_032_050, 165)).toBe(1_160_288);
  });

  it('A07: aplicarTasaPorMil(3.044.000, 90) = 273.960 (sin decimales)', () => {
    // 3.044.000 x 90 / 1000 = 273.960 exacto
    expect(aplicarTasaPorMil(3_044_000, 90)).toBe(273_960);
  });

  it('A08: la suma de los redondeos por tasa no coincide con la tasa combinada del 25,5%', () => {
    // Base elegida: 4.000.002 (con 7.032.050 la suma coincide con la tasa combinada,
    // por eso se busca una base donde la diferencia sea real).
    //   90  por mil -> 4.000.002 x 90  / 1000 = 360.000,18  -> half-up 360.000
    //   165 por mil -> 4.000.002 x 165 / 1000 = 660.000,33  -> half-up 660.000
    //   Suma de redondeos individuales = 1.020.000
    //   255 por mil -> 4.000.002 x 255 / 1000 = 1.020.000,51 -> half-up 1.020.001
    const base = 4_000_002;
    const obrero = aplicarTasaPorMil(base, 90);
    const patronal = aplicarTasaPorMil(base, 165);
    const combinada = aplicarTasaPorMil(base, 255);
    expect(obrero).toBe(360_000);
    expect(patronal).toBe(660_000);
    expect(obrero + patronal).toBe(1_020_000);
    expect(combinada).toBe(1_020_001);
    expect(obrero + patronal).not.toBe(combinada);
  });

  it('A09: aplicarTasaPorMil lanza si porMil no es entero (90,5)', () => {
    expect(() => aplicarTasaPorMil(1_000_000, 90.5)).toThrow();
  });

  // ---------------------------------------------------------------------
  // aGs: validacion de enteros finitos seguros
  // ---------------------------------------------------------------------
  it('A10: aGs acepta enteros seguros y rechaza decimales, NaN, Infinity y fuera de rango seguro', () => {
    expect(aGs(3_044_000)).toBe(3_044_000);
    expect(aGs(0)).toBe(0);
    expect(() => aGs(1.5)).toThrow();
    expect(() => aGs(NaN)).toThrow();
    expect(() => aGs(Infinity)).toThrow();
    expect(() => aGs(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  // ---------------------------------------------------------------------
  // sumarGs
  // ---------------------------------------------------------------------
  it('A11: sumarGs suma listas y devuelve 0 para la lista vacia', () => {
    expect(sumarGs([1, 2, 3])).toBe(6);
    expect(sumarGs([])).toBe(0);
  });

  // ---------------------------------------------------------------------
  // convertirUsdAPyg
  // ---------------------------------------------------------------------
  it('A12: convertirUsdAPyg convierte enteros exactos y rechaza tipo de cambio invalido', () => {
    expect(convertirUsdAPyg(1000, 7930)).toBe(7_930_000);
    expect(() => convertirUsdAPyg(1000, 0)).toThrow();
    expect(() => convertirUsdAPyg(1000, -5)).toThrow();
    // La implementacion exige enteros: 7930,5 no es convertible a BigInt.
    expect(() => convertirUsdAPyg(1000, 7930.5)).toThrow();
  });

  // ---------------------------------------------------------------------
  // formatearGs
  // ---------------------------------------------------------------------
  it('A13: formatearGs agrupa miles con punto de forma exacta', () => {
    expect(formatearGs(3_044_000)).toBe('3.044.000');
    expect(formatearGs(0)).toBe('0');
    expect(formatearGs(999)).toBe('999');
    expect(formatearGs(1_234_567_890)).toBe('1.234.567.890');
    expect(formatearGs(-3_044_000)).toBe('-3.044.000');
  });

  it('A14: formatearGs no depende de toLocaleString (agrupado manual determinista)', () => {
    // Si formatearGs usara toLocaleString, este stub lo delataria lanzando.
    const original = Number.prototype.toLocaleString;
    Number.prototype.toLocaleString = function (): string {
      throw new Error('formatearGs no debe depender de toLocaleString');
    };
    try {
      expect(formatearGs(3_044_000)).toBe('3.044.000');
      expect(formatearGs(-1_234_567_890)).toBe('-1.234.567.890');
    } finally {
      Number.prototype.toLocaleString = original;
    }
  });
});
