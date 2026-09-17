import { describe, it, expect } from 'vitest';
import { sanitizeAttachments, parseAssistantRequestBody, buildEnrichedPrompt } from '../../../../api/assistant';

const TINY_B64 = 'SGVsbG8=';

function buildImage(name: string, data: string = TINY_B64) {
  return { name, mimeType: 'image/jpeg', data };
}

describe('api/assistant — sanitizeAttachments (adjuntos múltiples)', () => {
  it('limita la cantidad de adjuntos a MAX_ATTACHMENTS (15)', () => {
    const raw = Array.from({ length: 20 }, (_, i) => buildImage(`pagina-${i + 1}.jpg`));
    const result = sanitizeAttachments(raw);
    expect(result).toHaveLength(15);
  });

  it('admite notas de voz y archivos de audio (audio/webm, audio/m4a, audio/mpeg)', () => {
    const raw = [
      { name: 'nota_voz.webm', mimeType: 'audio/webm', data: TINY_B64 },
      { name: 'grabacion.m4a', mimeType: 'audio/m4a', data: TINY_B64 },
    ];
    const result = sanitizeAttachments(raw);
    expect(result).toHaveLength(2);
    expect(result[0].mimeType).toBe('audio/webm');
    expect(result[1].mimeType).toBe('audio/m4a');
  });

  it('excluye mimes no permitidos y conserva/recorta text/plain a 60000 chars', () => {
    const longText = 'x'.repeat(70000);
    const raw = [
      { name: 'malware.exe', mimeType: 'application/x-msdownload', data: TINY_B64 },
      { name: 'nota.txt', mimeType: 'text/plain', data: longText },
    ];
    const result = sanitizeAttachments(raw);
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('text/plain');
    expect(result[0].cleanBase64).toHaveLength(60000);
  });

  it('respeta el presupuesto total de base64 excluyendo los que lo exceden', () => {
    const chunk = 'A'.repeat(400 * 1024);
    const raw = Array.from({ length: 12 }, (_, i) => ({
      name: `pagina-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      data: chunk,
    }));
    const result = sanitizeAttachments(raw);
    expect(result).toHaveLength(9);
  });

  it('parseAssistantRequestBody expone attachments y mantiene el contrato legado', () => {
    const multi = parseAssistantRequestBody({
      prompt: 'Analizá estos documentos',
      attachments: [{ name: 'nota.txt', mimeType: 'text/plain', data: 'hola mundo' }],
    });
    expect(multi.attachments).toHaveLength(1);
    expect(multi.attachment).toBeNull();

    const legacy = parseAssistantRequestBody({
      prompt: 'Auditar nota de despido',
      attachment: { name: 'nota.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK' },
    });
    expect(legacy.attachments).toHaveLength(1);
    expect(legacy.attachment?.mimeType).toBe('application/pdf');
  });
});

describe('api/assistant — buildEnrichedPrompt con adjuntos', () => {
  it('describe el texto extraído y el PDF adjunto', () => {
    const withText = buildEnrichedPrompt({
      prompt: 'P',
      attachments: [{ name: 'extracto.txt', mimeType: 'text/plain', cleanBase64: 'contenido extraído de prueba' }],
    });
    expect(withText).toContain('texto extraído');
    expect(withText).toContain('contenido extraído de prueba');

    const withPdf = buildEnrichedPrompt({
      prompt: 'P',
      attachments: [{ name: 'nota.pdf', mimeType: 'application/pdf', cleanBase64: 'JVBERi0xLjQK' }],
    });
    expect(withPdf).toContain('documento PDF adjunto');
  });
});
