import { describe, it, expect } from 'vitest';
import {
  MAX_PDF_PAGES,
  MAX_PDF_FILE_BYTES,
  PDF_TEXT_MODE_MIN_RATIO,
  PDF_TEXT_MAX_CHARS,
  mergePageTexts,
  shouldUseTextMode,
} from '../pdfProcessor.utils';

/** Genera una cadena con `n` caracteres útiles (no whitespace). */
const texto = (n: number): string => 'a'.repeat(n);

describe('shouldUseTextMode', () => {
  it('devuelve false para un array vacío (sin páginas)', () => {
    expect(shouldUseTextMode([])).toBe(false);
  });

  it('devuelve true cuando la mayoría de las páginas tiene texto suficiente', () => {
    expect(shouldUseTextMode([texto(40), texto(120), texto(80)])).toBe(true);
  });

  it('devuelve false cuando menos del 60% de las páginas tiene texto', () => {
    // 2 de 4 páginas con texto = 50% < 60%
    expect(shouldUseTextMode([texto(50), texto(50), '', ''])).toBe(false);
  });

  it('devuelve true justo en el umbral del 60%', () => {
    // 3 de 5 páginas con texto = 60%
    expect(shouldUseTextMode([texto(40), texto(40), texto(40), '', ''])).toBe(true);
  });

  it('ignora páginas con menos de 40 caracteres útiles (umbral)', () => {
    expect(shouldUseTextMode([texto(39), texto(39), texto(39)])).toBe(false);
  });

  it('cuenta el umbral exacto de 40 caracteres como texto válido', () => {
    expect(shouldUseTextMode([texto(40), texto(40)])).toBe(true);
  });

  it('no cuenta los espacios en blanco como texto', () => {
    expect(shouldUseTextMode([' '.repeat(80), ' '.repeat(80)])).toBe(false);
  });
});

describe('mergePageTexts', () => {
  it('une las páginas con marcadores numerados', () => {
    const merged = mergePageTexts(['Hola', 'Mundo'], 1000);
    expect(merged).toContain('--- Página 1 ---');
    expect(merged).toContain('--- Página 2 ---');
    expect(merged).toContain('Hola');
    expect(merged).toContain('Mundo');
  });

  it('recorta el resultado exactamente a maxChars', () => {
    const merged = mergePageTexts([texto(500), texto(500)], 50);
    expect(merged.length).toBe(50);
  });

  it('no recorta cuando el contenido entra en el presupuesto', () => {
    const merged = mergePageTexts(['Corta', 'Breve'], 1000);
    expect(merged.length).toBeLessThan(1000);
    expect(merged.startsWith('--- Página 1 ---')).toBe(true);
  });

  it('conserva el presupuesto de 55000 caracteres de PDF_TEXT_MAX_CHARS', () => {
    const merged = mergePageTexts([texto(60000)], PDF_TEXT_MAX_CHARS);
    expect(merged.length).toBe(PDF_TEXT_MAX_CHARS);
  });

  it('expone constantes coherentes con la especificación', () => {
    expect(MAX_PDF_PAGES).toBe(15);
    expect(MAX_PDF_FILE_BYTES).toBe(30 * 1024 * 1024);
    expect(PDF_TEXT_MODE_MIN_RATIO).toBe(0.6);
    expect(PDF_TEXT_MAX_CHARS).toBe(55000);
  });
});
