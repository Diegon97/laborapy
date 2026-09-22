import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_ENTRIES,
  getKnowledgeEntryById,
  searchKnowledgeBase,
} from '../hrKnowledgeBase';

/**
 * Batería de pruebas de regresión normativa para la Base de Conocimiento de RRHH.
 * Verifica la exactitud legal paraguaya según Ley 213/93 y Decreto-Ley 1860/50.
 */
describe('hrKnowledgeBase — Reglas legales y regresiones normativas', () => {
  it('cuenta con al menos 10 entradas normativas cargadas en el catálogo', () => {
    expect(KNOWLEDGE_ENTRIES.length).toBeGreaterThanOrEqual(10);
  });

  describe('Entrada: Certificado de Trabajo (Art. 93 C.T.)', () => {
    it('existe, cita el Art. 93 C.T. y no contiene referencias erróneas al Art. 81', () => {
      const entry = getKnowledgeEntryById('certificado-trabajo');
      expect(entry).toBeDefined();
      expect(entry?.title).toContain('Art. 93 C.T.');
      expect(entry?.legalBasis.some((basis) => basis.includes('Art. 93'))).toBe(true);
      expect(entry?.content).not.toContain('El Art. 81 del Código');
    });

    it('devuelve al menos un resultado con id "certificado-trabajo" al buscar por término', () => {
      const results = searchKnowledgeBase('certificado de trabajo');
      expect(results.length).toBeGreaterThan(0);
      const found = results.some((item) => item.entry.id === 'certificado-trabajo');
      expect(found).toBe(true);
    });
  });

  describe('Entrada: Escala de Preaviso y Licencia Remunerada', () => {
    it('incluye escala de 45 días, licencia de 2 horas y sustitutivo del Art. 90', () => {
      const entry = getKnowledgeEntryById('preaviso-escala');
      expect(entry).toBeDefined();
      expect(entry?.content).toContain('45 días');
      expect(entry?.content).toContain('2 horas');
      expect(entry?.content).toContain('Art. 90');
    });

    it('elimina toda relativización del resumen omitiendo la frase "según práctica"', () => {
      const entry = getKnowledgeEntryById('preaviso-escala');
      expect(entry).toBeDefined();
      expect(entry?.summary).not.toContain('según práctica');
    });
  });

  describe('Entrada: Exención de Aportes IPS sobre Aguinaldo', () => {
    it('existe y ratifica expresamente la exención de IPS en su contenido o resumen', () => {
      const entry = getKnowledgeEntryById('aguinaldo-exencion-ips');
      expect(entry).toBeDefined();
      const textToInspect = `${entry?.summary ?? ''} ${entry?.content ?? ''}`;
      expect(textToInspect).toMatch(/exento/i);
    });
  });

  describe('Entrada: Límites de Descuentos y Retenciones Salariales', () => {
    it('existe, ratifica tope 30% para deducciones ordinarias (Art. 242) y 50% alimentos (Art. 245)', () => {
      const entry = getKnowledgeEntryById('descuentos-limites');
      expect(entry).toBeDefined();
      expect(entry?.title).toContain('30% ordinario');
      expect(entry?.title).toContain('50%');
      expect(entry?.content).toContain('30% del salario mensual');
      expect(entry?.content).toContain('50%');
      expect(entry?.content).not.toContain('30% del salario mensual para obreros y el 50% para empleados');
      expect(entry?.legalBasis.some((b) => b.includes('Arts. 242 y 245'))).toBe(true);
    });
  });

  describe('Precisión semántica: Fraude de facturación y derechos irrenunciables', () => {
    it('prioriza Primacía de la Realidad (Art. 19) y jamás sugiere licencias por matrimonio/duelo ante reclamos de facturación encubierta', () => {
      const query = 'trabajo hace 11 años en un estudio contable y me hacen facturar, mi patron no me quiere pagar mis vacaciones ni aguinaldo.';
      const results = searchKnowledgeBase(query, 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe('primacia-realidad-factura');
      const ids = results.map((r) => r.entry.id);
      expect(ids).not.toContain('licencias-especiales');
    });
  });
});
