import { describe, it, expect } from 'vitest';
import { parseAssistantRequestBody, buildEnrichedPrompt } from '../../../../api/assistant';

describe('api/assistant — Desacoplamiento de Parser y Handler Canónico', () => {
  describe('parseAssistantRequestBody', () => {
    it('rechaza bodies vacíos o sin prompt', () => {
      expect(parseAssistantRequestBody(null).valid).toBe(false);
      expect(parseAssistantRequestBody({}).valid).toBe(false);
      expect(parseAssistantRequestBody({ prompt: '   ' }).valid).toBe(false);
    });

    it('parsea correctamente un prompt válido', () => {
      const result = parseAssistantRequestBody({ prompt: '¿Cómo calculo el aguinaldo?' });
      expect(result.valid).toBe(true);
      expect(result.prompt).toBe('¿Cómo calculo el aguinaldo?');
      expect(result.attachment).toBeNull();
      expect(result.history).toEqual([]);
    });

    it('sanitiza adjuntos no permitidos y preserva imágenes válidas', () => {
      const invalidResult = parseAssistantRequestBody({
        prompt: 'Revisar este ejecutable',
        attachment: {
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          data: 'SGVsbG8=',
        },
      });
      expect(invalidResult.valid).toBe(true);
      expect(invalidResult.attachment).toBeNull();

      const validResult = parseAssistantRequestBody({
        prompt: 'Auditar nota de despido',
        attachment: {
          name: 'nota.pdf',
          mimeType: 'application/pdf',
          data: 'JVBERi0xLjQK',
        },
      });
      expect(validResult.valid).toBe(true);
      expect(validResult.attachment).not.toBeNull();
      expect(validResult.attachment?.mimeType).toBe('application/pdf');
    });

    it('soporta body en formato JSON string', () => {
      const stringified = JSON.stringify({ prompt: 'Consulta de prueba' });
      const result = parseAssistantRequestBody(stringified);
      expect(result.valid).toBe(true);
      expect(result.prompt).toBe('Consulta de prueba');
    });
  });

  describe('buildEnrichedPrompt', () => {
    it('construye el prompt enriquecido integrando jurisprudencia y contexto sin residuos', () => {
      const prompt = buildEnrichedPrompt({
        prompt: '¿Tengo derecho a indemnización?',
        context: 'Salario: Gs. 3.500.000, Antigüedad: 2 años',
        jurisprudence: '• Precedente: Art. 84 C.T. indemnización 15 días por año',
      });

      expect(prompt).toContain('[Consulta del Usuario]');
      expect(prompt).toContain('¿Tengo derecho a indemnización?');
      expect(prompt).toContain('[Contexto de Liquidación / Contrato]');
      expect(prompt).toContain('Salario: Gs. 3.500.000');
      expect(prompt).toContain('[Jurisprudencia y Criterios Prácticos de Abogados Laboralistas Paraguayos]');
    });
  });
});
