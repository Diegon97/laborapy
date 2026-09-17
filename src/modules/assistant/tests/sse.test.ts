import { describe, it, expect } from 'vitest';
import { consumeSseChunk } from '../sse';

describe('consumeSseChunk', () => {
  it('extrae un evento completo y no deja resto', () => {
    const result = consumeSseChunk('data: {"a":1}\n\n');
    expect(result.events).toEqual(['{"a":1}']);
    expect(result.rest).toBe('');
  });

  it('procesa múltiples eventos y conserva el resto parcial', () => {
    const result = consumeSseChunk('data: {"a":1}\n\ndata: {"b"');
    expect(result.events).toEqual(['{"a":1}']);
    expect(result.rest).toBe('data: {"b"');
  });

  it('soporta saltos de línea CRLF', () => {
    const result = consumeSseChunk('data: {"x":1}\r\n\r\n');
    expect(result.events).toEqual(['{"x":1}']);
    expect(result.rest).toBe('');
  });

  it('ignora comentarios y bloques sin data', () => {
    const result = consumeSseChunk(': ping\n\ndata: hola\n\n');
    expect(result.events).toEqual(['hola']);
  });

  it('concatena múltiples líneas data de un mismo evento', () => {
    const result = consumeSseChunk('data: a\ndata: b\n\n');
    expect(result.events).toEqual(['a\nb']);
  });
});
