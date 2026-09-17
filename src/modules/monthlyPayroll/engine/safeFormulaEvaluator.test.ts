import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  evaluateCellMath,
  isFormulaLike,
  extractReferences,
} from './safeFormulaEvaluator';

describe('safeFormulaEvaluator (ERP LaboraPy)', () => {
  // -------------------------------------------------------------------------
  // 1. Aritmética básica y precedencia
  // -------------------------------------------------------------------------
  describe('1. Aritmética básica y precedencia', () => {
    it('respeta la precedencia de operadores: 2 + 3 * 4 = 14', () => {
      expect(evaluateFormula('2 + 3 * 4')).toBe(14);
    });

    it('respeta los paréntesis: (2 + 3) * 4 = 20', () => {
      expect(evaluateFormula('(2 + 3) * 4')).toBe(20);
    });

    it('evalúa la potenciación: 2 ^ 3 = 8', () => {
      expect(evaluateFormula('2 ^ 3')).toBe(8);
    });

    it('evalúa el módulo: 10 % 3 = 1', () => {
      expect(evaluateFormula('10 % 3')).toBe(1);
    });

    it('evalúa la división: 10 / 2 = 5', () => {
      expect(evaluateFormula('10 / 2')).toBe(5);
    });

    it('evalúa el unario negativo: -5 + 10 = 5', () => {
      expect(evaluateFormula('-5 + 10')).toBe(5);
    });

    it('combina operadores y paréntesis anidados', () => {
      expect(evaluateFormula('((2 + 3) * (4 - 1)) / 3')).toBe(5);
    });

    it('soporta prefijo "=" al estilo Excel', () => {
      expect(evaluateFormula('=1000 + 500')).toBe(1500);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Funciones integradas
  // -------------------------------------------------------------------------
  describe('2. Funciones integradas', () => {
    it('SUM(10, 20, 30) = 60', () => {
      expect(evaluateFormula('SUM(10, 20, 30)')).toBe(60);
    });

    it('AVG(10, 20, 30) = 20', () => {
      expect(evaluateFormula('AVG(10, 20, 30)')).toBe(20);
      expect(evaluateFormula('AVERAGE(10, 20, 30)')).toBe(20);
    });

    it('MIN(5, 10, 2) = 2', () => {
      expect(evaluateFormula('MIN(5, 10, 2)')).toBe(2);
    });

    it('MAX(5, 10, 2) = 10', () => {
      expect(evaluateFormula('MAX(5, 10, 2)')).toBe(10);
    });

    it('ROUND(123.456, 2) = 123.46 y ROUND(123.456) = 123', () => {
      expect(evaluateFormula('ROUND(123.456, 2)')).toBe(123.46);
      expect(evaluateFormula('ROUND(123.456)')).toBe(123);
    });

    it('FLOOR y CEIL', () => {
      expect(evaluateFormula('FLOOR(123.8)')).toBe(123);
      expect(evaluateFormula('CEIL(123.2)')).toBe(124);
      expect(evaluateFormula('CEILING(123.2)')).toBe(124);
    });

    it('ABS(-50) = 50', () => {
      expect(evaluateFormula('ABS(-50)')).toBe(50);
    });

    it('IF(10 > 5, 100, 200) = 100 e IF(2 > 5, 100, 200) = 200', () => {
      expect(evaluateFormula('IF(10 > 5, 100, 200)')).toBe(100);
      expect(evaluateFormula('IF(2 > 5, 100, 200)')).toBe(200);
    });

    it('Lógica booleana AND, OR, NOT', () => {
      expect(evaluateFormula('AND(1, 1, 10 > 5)')).toBe(1);
      expect(evaluateFormula('AND(1, 0, 10 > 5)')).toBe(0);
      expect(evaluateFormula('OR(0, 0, 5 == 5)')).toBe(1);
      expect(evaluateFormula('OR(0, 0, 5 == 6)')).toBe(0);
      expect(evaluateFormula('NOT(1)')).toBe(0);
      expect(evaluateFormula('NOT(0)')).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Evaluación Lazy de IF
  // -------------------------------------------------------------------------
  describe('3. Evaluación Lazy de IF', () => {
    it('no evalúa la rama falsa si la condición es verdadera', () => {
      // Si se evaluara eager, 1 / 0 provocaría cálculo innecesario o fallo
      expect(evaluateFormula('IF(10 > 5, 100, 1 / 0)')).toBe(100);
    });

    it('no evalúa la rama verdadera si la condición es falsa', () => {
      expect(evaluateFormula('IF(5 > 10, 1 / 0, 250)')).toBe(250);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Referencias de columnas y case-insensitivity
  // -------------------------------------------------------------------------
  describe('4. Referencias de columnas', () => {
    it('resuelve [salarioFijo] * 0.1 con datos de fila', () => {
      const row = { salarioFijo: 3000000 };
      expect(evaluateFormula('[salarioFijo] * 0.1', row)).toBe(300000);
    });

    it('ignora mayúsculas y minúsculas en los nombres de columnas', () => {
      const row = { salarioFijo: 3000000 };
      expect(evaluateFormula('[SALARIOFIJO] * 0.1', row)).toBe(300000);
      expect(evaluateFormula('[Salario Fijo] * 0.1', row)).toBe(300000);
    });

    it('permite sumar múltiples columnas referenciadas', () => {
      const row = {
        salarioFijo: 3000000,
        adicionalCargo: 500000,
        refrigerioTraslado: 200000,
      };
      expect(evaluateFormula('[salarioFijo] + [adicionalCargo] + [refrigerioTraslado]', row)).toBe(3700000);
    });

    it('permite diamantes de dependencia [A] + [A] sin falso positivo de ciclo', () => {
      const row = { bono: 150000 };
      expect(evaluateFormula('[bono] + [bono]', row)).toBe(300000);
    });

    it('soporta referencias que retornan texto', () => {
      const row = { nombre: 'María González' };
      expect(evaluateFormula('[nombre]', row)).toBe('María González');
    });

    it('coerciona números con formato Guaraní de miles (1.500.000)', () => {
      const row = { salarioTexto: '1.500.000 Gs.' };
      expect(evaluateFormula('[salarioTexto] * 2', row)).toBe(3000000);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Manejo defensivo
  // -------------------------------------------------------------------------
  describe('5. Manejo defensivo', () => {
    it('división por cero retorna 0 en lugar de crash o Infinity', () => {
      expect(evaluateFormula('10 / 0')).toBe(0);
      expect(evaluateFormula('10 % 0')).toBe(0);
    });

    it('sintaxis inválida retorna 0 sin lanzar excepciones hacia la UI', () => {
      expect(evaluateFormula('2 ++ * 3')).toBe(0);
      expect(evaluateFormula('SUM(')).toBe(0);
      expect(evaluateFormula('')).toBe(0);
      expect(evaluateFormula('   ')).toBe(0);
      expect(evaluateFormula('((')).toBe(0);
    });

    it('referencia a columna inexistente retorna 0', () => {
      expect(evaluateFormula('[columnaFantasma] * 2', {})).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Detección de ciclos recursivos
  // -------------------------------------------------------------------------
  describe('6. Detección de ciclos recursivos', () => {
    it('colA -> colB -> colA retorna 0 sin entrar en bucle infinito', () => {
      const row = {
        colA: '=[colB]',
        colB: '=[colA]',
      };
      const res = evaluateFormula('[colA]', row);
      expect(res).toBe(0);
    });

    it('auto-referencia directa [colA] = =[colA] retorna 0', () => {
      const row = {
        colA: '=[colA]',
      };
      const res = evaluateFormula('[colA]', row);
      expect(res).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. evaluateCellMath (cálculo rápido en celda de input)
  // -------------------------------------------------------------------------
  describe('7. evaluateCellMath', () => {
    it('evalúa sumas y multiplicaciones directas en celda', () => {
      expect(evaluateCellMath('=150000+50000')).toBe(200000);
      expect(evaluateCellMath('50000*3')).toBe(150000);
      expect(evaluateCellMath('(100+200)*3')).toBe(900);
    });

    it('división por cero en celda retorna 0', () => {
      expect(evaluateCellMath('10/0')).toBe(0);
    });

    it('rechaza texto puro y retorna null', () => {
      expect(evaluateCellMath('hola')).toBeNull();
      expect(evaluateCellMath('texto plano')).toBeNull();
      expect(evaluateCellMath('')).toBeNull();
    });

    it('rechaza referencias a columnas y retorna null', () => {
      expect(evaluateCellMath('[salarioFijo] * 2')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Helpers auxiliares
  // -------------------------------------------------------------------------
  describe('8. Helpers auxiliares', () => {
    it('isFormulaLike detecta fórmulas por prefijo "=" o corchetes', () => {
      expect(isFormulaLike('=100+200')).toBe(true);
      expect(isFormulaLike('=[salarioFijo]*0.05')).toBe(true);
      expect(isFormulaLike('[bono] + 10')).toBe(true);
      expect(isFormulaLike('150000')).toBe(false);
      expect(isFormulaLike('Juan Pérez')).toBe(false);
      expect(isFormulaLike('')).toBe(false);
      expect(isFormulaLike(null)).toBe(false);
    });

    it('extractReferences extrae los nombres de columnas sin duplicados', () => {
      expect(extractReferences('=[salarioFijo] * 0.05 + [bonoExtra]')).toEqual([
        'salarioFijo',
        'bonoExtra',
      ]);
      expect(extractReferences('[salarioFijo] + [salarioFijo]')).toEqual(['salarioFijo']);
      expect(extractReferences('100 + 200')).toEqual([]);
      expect(extractReferences('')).toEqual([]);
    });
  });
});
