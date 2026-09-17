/**
 * HOOK DE VOZ BIDIRECCIONAL ESTILO GEMINI LIVE — LABORAPY (TOBI)
 *
 * Provee:
 *  - Speech-to-Text (STT) en tiempo real con Web Speech API:
 *      * Transcribe en vivo a medida que el usuario habla ("streaming en pantalla").
 *      * Detección de silencios y final de frase.
 *      * Compatibilidad con 'es-419' (español latinoamericano) y solicitud proactiva de getUserMedia.
 *  - Text-to-Speech (TTS) con SpeechSynthesis:
 *      * Lee las respuestas de Tobi con voz en español (removiendo markdown y JSON).
 *      * Control de pausa/cancelar.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseTobiVoiceOptions {
  readonly onTranscriptChange?: (text: string) => void;
  readonly onSpeechEnd?: (finalText: string) => void;
}

export interface UseTobiVoiceReturn {
  readonly isVoiceSupported: boolean;
  readonly isListening: boolean;
  readonly isSpeaking: boolean;
  readonly liveTranscript: string;
  readonly startListening: () => void;
  readonly stopListening: () => void;
  readonly toggleListening: () => void;
  readonly speakText: (rawMarkdown: string) => void;
  readonly stopSpeaking: () => void;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getPreferredSpeechLang(): string {
  if (isIOSDevice()) {
    // Apple Siri / Dictado en iOS NO soporta 'es-419' (falla con language-not-supported o silencio).
    // Soporta nativamente 'es-MX' y 'es-ES'.
    return 'es-MX';
  }
  const navLang = typeof navigator !== 'undefined' ? navigator.language : '';
  if (navLang && navLang.toLowerCase().startsWith('es')) {
    return navLang;
  }
  return 'es-ES';
}

/**
 * Selecciona la voz en español de mayor calidad natural disponible en el dispositivo.
 * Prioriza voces neuronales de Microsoft (Natural/Online), Google y Apple Enhanced.
 */
export function getBestSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 1. Voces neuronales de Microsoft (Edge / Windows 11 / Chrome en Windows)
  // Ej: "Microsoft Jorge Online (Natural) - Spanish (Mexico)", "Microsoft Gonzalo Online (Natural)"
  const naturalOnline = voices.find((v) => {
    const name = v.name.toLowerCase();
    const isLangSpanish = v.lang.toLowerCase().startsWith('es');
    return isLangSpanish && (name.includes('natural') || name.includes('online') || name.includes('neural'));
  });
  if (naturalOnline) return naturalOnline;

  // 2. Voces neuronales de Google (Chrome en Android / Mac / PC)
  const googleSpanish = voices.find((v) => {
    const name = v.name.toLowerCase();
    const isLangSpanish = v.lang.toLowerCase().startsWith('es');
    return isLangSpanish && name.includes('google');
  });
  if (googleSpanish) return googleSpanish;

  // 3. Voces mejoradas de Apple (Safari en iOS / macOS / Chrome iOS)
  const appleEnhanced = voices.find((v) => {
    const name = v.name.toLowerCase();
    const isLangSpanish = v.lang.toLowerCase().startsWith('es');
    return isLangSpanish && (name.includes('enhanced') || name.includes('premium') || name.includes('compact') || name.includes('siri'));
  });
  if (appleEnhanced) return appleEnhanced;

  // 4. Voces de calidad estándar de Apple en iOS (Mónica, Paulina, Jorge, Juan)
  const appleStandard = voices.find((v) => {
    const name = v.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isLangSpanish = v.lang.toLowerCase().startsWith('es');
    return isLangSpanish && (name.includes('monica') || name.includes('paulina') || name.includes('jorge') || name.includes('juan'));
  });
  if (appleStandard) return appleStandard;

  // 5. Español latinoamericano preferente (es-MX, es-US, es-419, es-PY, es-AR)
  const latinSpanish = voices.find((v) => {
    const lang = v.lang.toLowerCase();
    return lang === 'es-mx' || lang === 'es-us' || lang === 'es-419' || lang === 'es-py' || lang === 'es-ar';
  });
  if (latinSpanish) return latinSpanish;

  // 6. Cualquier voz en español
  const anySpanish = voices.find((v) => v.lang.toLowerCase().startsWith('es'));
  return anySpanish || null;
}

/**
 * Segmenta el texto en fragmentos oracionales cortos para una cadencia humana y
 * evitar el bug de congelamiento de Chrome (speech synthesis freeze after 15s).
 */
export function splitIntoSpeechChunks(text: string, maxChunkLength = 160): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  // Dividir por delimitadores de oraciones mayores (punto, interrogación, exclamación, dos puntos, saltos de línea)
  const sentences = clean.split(/(?<=[.?!:;\n])\s+/);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    if (s.length <= maxChunkLength) {
      chunks.push(s);
    } else {
      // Si la oración es muy larga, dividir por comas para simular pausas de respiración
      const subParts = s.split(/(?<=[,])\s+/);
      let currentBuffer = '';

      for (const part of subParts) {
        if (!currentBuffer) {
          currentBuffer = part;
        } else if (currentBuffer.length + part.length + 1 <= maxChunkLength) {
          currentBuffer += ' ' + part;
        } else {
          chunks.push(currentBuffer.trim());
          currentBuffer = part;
        }
      }
      if (currentBuffer.trim()) {
        chunks.push(currentBuffer.trim());
      }
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/** Limpia markdown, bloques de máquina y caracteres especiales para síntesis de voz natural. */
export function sanitizeForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/:::liquidacion_action[\s\S]*?(:::|$)/g, '')
    .replace(/:::documento_action[\s\S]*?(:::|$)/g, '')
    .replace(/:::opciones_continuar[\s\S]*?(:::|$)/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[•\-\*]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useTobiVoice(options?: UseTobiVoiceOptions): UseTobiVoiceReturn {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const isSupportedRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cancelPlaybackRef = useRef<boolean>(false);
  const voiceCacheRef = useRef<SpeechSynthesisVoice | null>(null);

  // Detección segura de soporte de Web Speech API
  const isVoiceSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  isSupportedRef.current = isVoiceSupported;

  // Cargar y almacenar en caché la mejor voz disponible inmediatamente y ante cambios
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const refreshVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const best = getBestSpanishVoice(voices);
      if (best) {
        voiceCacheRef.current = best;
      }
    };

    refreshVoice();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoice);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoice);
    };
  }, []);

  // Limpiar síntesis de voz al desmontar
  useEffect(() => {
    return () => {
      cancelPlaybackRef.current = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupportedRef.current || typeof window === 'undefined') {
      alert('Tu navegador no soporta entrada de voz directa (Web Speech API). Podés escribir normalmente en el teclado.');
      return;
    }

    // Si ya estaba hablando Tobi, silenciarlo primero
    cancelPlaybackRef.current = true;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getPreferredSpeechLang();

    let accumulatedFinal = '';

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedFinal += (accumulatedFinal ? ' ' : '') + transcript;
        } else {
          interim += transcript;
        }
      }

      const fullLive = (accumulatedFinal + (interim ? ' ' + interim : '')).trim();
      setLiveTranscript(fullLive);
      if (optionsRef.current?.onTranscriptChange) {
        optionsRef.current.onTranscriptChange(fullLive);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('El acceso al micrófono está bloqueado en tu navegador. Habilitalo en la barra de direcciones para usar la voz.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalText = accumulatedFinal.trim();
      if (finalText && optionsRef.current?.onSpeechEnd) {
        optionsRef.current.onSpeechEnd(finalText);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn('No se pudo iniciar el reconocimiento de voz:', err);
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const stopSpeaking = useCallback(() => {
    cancelPlaybackRef.current = true;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((rawMarkdown: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const cleaned = sanitizeForSpeech(rawMarkdown);
    if (!cleaned) return;

    // Desbloquear audio síncronamente en iOS WebKit (Chrome/Safari en iPhone)
    try {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.lang = 'es-ES';
      window.speechSynthesis.speak(unlock);
    } catch {
      // ignore
    }

    // Detener reproducción en curso
    cancelPlaybackRef.current = false;
    window.speechSynthesis.cancel();

    const chunks = splitIntoSpeechChunks(cleaned);
    if (chunks.length === 0) return;

    setIsSpeaking(true);

    const voices = window.speechSynthesis.getVoices();
    const voice = voiceCacheRef.current || getBestSpanishVoice(voices);
    const preferredLang = voice?.lang || (isIOSDevice() ? 'es-MX' : 'es-ES');

    const speakChunk = (index: number) => {
      if (cancelPlaybackRef.current || index >= chunks.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = preferredLang;
      utterance.rate = 0.98; // Cadencia natural y cercana (sin apresuramiento)
      utterance.pitch = 1.0;
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        if (cancelPlaybackRef.current) {
          setIsSpeaking(false);
          return;
        }
        // Pausa de respiración natural de 50ms entre oraciones
        setTimeout(() => {
          speakChunk(index + 1);
        }, 50);
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error on chunk:', e);
        if (cancelPlaybackRef.current) {
          setIsSpeaking(false);
          return;
        }
        speakChunk(index + 1);
      };

      window.speechSynthesis.speak(utterance);
    };

    // Invocar DIRECTO e inmediatamente de forma síncrona en el tap del usuario (sin setTimeout)
    speakChunk(0);
  }, []);

  return {
    isVoiceSupported,
    isListening,
    isSpeaking,
    liveTranscript,
    startListening,
    stopListening,
    toggleListening,
    speakText,
    stopSpeaking,
  };
}
