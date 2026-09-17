/**
 * Test de integridad estructural del golden set de Tobi.
 * Utiliza la importación cruda (?raw) provista por Vite para evitar dependencias
 * del módulo Node.js (fs) y garantizar compatibilidad con el entorno de pruebas frontend (Vitest).
 */
import { describe, it, expect } from 'vitest';
import rawDataset from '../../../../datasets/tobi_gold_dataset_final.jsonl?raw';

interface GoldEntry {
  id: string;
  category: string;
  title: string;
  prompt: string;
  response: string;
  origin: string;
}

describe('Tobi Gold Dataset — Integridad Estructural', () => {
  const lines = rawDataset.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const entries: GoldEntry[] = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`Error al parsear la línea ${index + 1} del JSONL: ${(err as Error).message}`);
    }
  });

  it('Estructura general y tamaño mínimo', () => {
    expect(entries.length).toBeGreaterThanOrEqual(43);

    entries.forEach((entry, idx) => {
      expect(entry, `Entrada en índice ${idx} debe ser un objeto`).toBeTypeOf('object');
      expect(typeof entry.id).toBe('string');
      expect(entry.id.trim()).not.toBe('');
      expect(typeof entry.category).toBe('string');
      expect(entry.category.trim()).not.toBe('');
      expect(typeof entry.title).toBe('string');
      expect(entry.title.trim()).not.toBe('');
      expect(typeof entry.prompt).toBe('string');
      expect(entry.prompt.trim()).not.toBe('');
      expect(typeof entry.response).toBe('string');
      expect(entry.response.trim()).not.toBe('');
      expect(typeof entry.origin).toBe('string');
      expect(entry.origin.trim()).not.toBe('');
    });
  });

  it('IDs únicos y formato estricto /^[A-Z]{3}-\\d{2}$/', () => {
    const idRegex = /^[A-Z]{3}-\d{2}$/;
    const ids = entries.map((e) => e.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);

    ids.forEach((id) => {
      expect(id).toMatch(idRegex);
    });
  });

  it('Existencia de los 6 casos históricamente pendientes', () => {
    const requiredIds = ['SMV-07', 'JOR-03', 'JOR-07', 'FRA-02', 'DOC-02', 'LIQ-03'];
    const existingIds = new Set(entries.map((e) => e.id));

    requiredIds.forEach((reqId) => {
      expect(existingIds.has(reqId), `Falta el caso históricamente pendiente: ${reqId}`).toBe(true);
    });
  });

  it('Longitud mínima de los responses (al menos 40 caracteres)', () => {
    entries.forEach((entry) => {
      expect(
        entry.response.trim().length,
        `El response del caso ${entry.id} tiene menos de 40 caracteres`
      ).toBeGreaterThanOrEqual(40);
    });
  });
});
