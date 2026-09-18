import { describe, it, expect } from 'vitest';
import {
  sanitizeForSpeech,
  splitIntoSpeechChunks,
  getBestSpanishVoice,
} from '../hooks/useTobiVoice';

describe('useTobiVoice — limpieza y optimización para síntesis de voz natural', () => {
  it('limpia bloques de máquina, markdown y opciones de continuación', () => {
    const raw = `
### Diagnóstico de Despido
El trabajador tiene derecho a **indemnización** y *preaviso*.
:::documento_action
{"tipo":"despido_injustificado"}
:::
:::opciones_continuar
["Opción 1", "Opción 2"]
:::
• Primer punto
• Segundo punto
    `;

    const cleaned = sanitizeForSpeech(raw);

    expect(cleaned).not.toContain('###');
    expect(cleaned).not.toContain(':::documento_action');
    expect(cleaned).not.toContain(':::opciones_continuar');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('*');
    expect(cleaned).not.toContain('•');
    expect(cleaned).toContain('El trabajador tiene derecho a indemnización y preaviso');
    expect(cleaned).toContain('Primer punto');
  });

  it('segmenta el texto en fragmentos oracionales para respiración y fluidez', () => {
    const text = 'Hola, ¿cómo estás? Te explico con gusto tu liquidación. Este es un caso de despido injustificado.';
    const chunks = splitIntoSpeechChunks(text);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]).toContain('Hola, ¿cómo estás?');
    expect(chunks[1]).toContain('Te explico con gusto tu liquidación.');
    expect(chunks[2]).toContain('Este es un caso de despido injustificado.');
  });

  it('divide oraciones excesivamente largas por pausas de coma', () => {
    const longSentence =
      'En relación a su consulta sobre las normativas laborales vigentes en Paraguay según la Ley doscientos trece barra noventa y tres, es indispensable verificar si el empleador cumplió con la debida notificación por escrito, si se acreditó la causal invocada de forma circunstanciada, y si se abonaron oportunamente los haberes devengados.';
    const chunks = splitIntoSpeechChunks(longSentence, 120);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(130);
    });
  });

  it('prioriza voces neuronales de Microsoft Natural / Online sobre sintetizadores legacy', () => {
    const mockVoices = [
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES' } as SpeechSynthesisVoice,
      { name: 'Microsoft Sabina - Spanish (Mexico)', lang: 'es-MX' } as SpeechSynthesisVoice,
      { name: 'Microsoft Jorge Online (Natural) - Spanish (Mexico)', lang: 'es-MX' } as SpeechSynthesisVoice,
      { name: 'Google español', lang: 'es-ES' } as SpeechSynthesisVoice,
    ];

    const best = getBestSpanishVoice(mockVoices);
    expect(best?.name).toBe('Microsoft Jorge Online (Natural) - Spanish (Mexico)');
  });

  it('prioriza voces de Google en ausencia de Microsoft Natural', () => {
    const mockVoices = [
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES' } as SpeechSynthesisVoice,
      { name: 'Google español de Estados Unidos', lang: 'es-US' } as SpeechSynthesisVoice,
    ];

    const best = getBestSpanishVoice(mockVoices);
    expect(best?.name).toBe('Google español de Estados Unidos');
  });

  it('prioriza voces Apple Enhanced en ausencia de Google y Microsoft Natural', () => {
    const mockVoices = [
      { name: 'Helena', lang: 'es-ES' } as SpeechSynthesisVoice,
      { name: 'Jorge (Enhanced)', lang: 'es-MX' } as SpeechSynthesisVoice,
    ];

    const best = getBestSpanishVoice(mockVoices);
    expect(best?.name).toBe('Jorge (Enhanced)');
  });

  it('prioriza voces estándar de Apple (Jorge/Juan) sobre voces legacy', () => {
    const mockVoices = [
      { name: 'SAPI Legacy Voice', lang: 'es-ES' } as SpeechSynthesisVoice,
      { name: 'Jorge', lang: 'es-MX' } as SpeechSynthesisVoice,
    ];

    const best = getBestSpanishVoice(mockVoices);
    expect(best?.name).toBe('Jorge');
  });

  it('retorna null si no hay voces disponibles', () => {
    expect(getBestSpanishVoice([])).toBeNull();
  });
});
