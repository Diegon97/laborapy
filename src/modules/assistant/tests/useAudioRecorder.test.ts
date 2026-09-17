import { describe, it, expect } from 'vitest';
import { formatDuration, getSupportedAudioMimeType } from '../hooks/useAudioRecorder';

describe('useAudioRecorder — helpers de grabación de audio', () => {
  it('formatea segundos a mm:ss correctamente', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('devuelve un tipo mime de audio por defecto razonable en entorno de test', () => {
    const mime = getSupportedAudioMimeType();
    expect(mime).toMatch(/^audio\//);
  });
});
