/**
 * MODO VOZ TÁCTIL TIPO GEMINI WEB MOBILE — LABORAPY (TOBI)
 *
 * Experiencia sólida de voz en tres toques (sin bucle continuo de SpeechRecognition):
 *  - 'idle':      botón circular grande "Tocá para hablar con Tobi".
 *  - 'recording': grabación con MediaRecorder estándar (iOS/Android), contador mm:ss,
 *                 pulso rojo, "Cancelar" y "Enviar audio a Tobi".
 *  - 'thinking':  espera elegante mientras Tobi analiza el caso laboral.
 *  - 'responding': lectura en voz alta inmediata de la respuesta (TTS en español con
 *                 cadencia humana) + texto legible y controles grandes de reproducción.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { AssistantAttachment } from '../types';
import { processMediaFile } from '../mediaProcessor';
import { useAudioRecorder, formatDuration } from '../hooks/useAudioRecorder';
import {
  sanitizeForSpeech,
  getBestSpanishVoice,
  splitIntoSpeechChunks,
  isIOSDevice,
} from '../hooks/useTobiVoice';

export interface TobiGeminiLiveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSendQuery: (text: string, explicitAttachments?: AssistantAttachment[]) => Promise<string | null>;
  readonly isMobile?: boolean;
}

type TobiLiveStatus = 'idle' | 'thinking' | 'responding';

/** Texto que acompaña a la nota de voz grabada en el historial del chat. */
const RECORDED_AUDIO_QUERY = 'Consulta grabada por nota de voz';

export const TobiGeminiLiveModal: React.FC<TobiGeminiLiveModalProps> = ({
  isOpen,
  onClose,
  onSendQuery,
  isMobile = false,
}) => {
  const [status, setStatus] = useState<TobiLiveStatus>('idle');
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isComponentOpenRef = useRef<boolean>(isOpen);
  isComponentOpenRef.current = isOpen;
  const isSpeakingRef = useRef<boolean>(false);
  // Token de reproducción: ignora callbacks de lecturas ya reemplazadas.
  const playbackIdRef = useRef<number>(0);

  const {
    isRecording,
    recordingDuration,
    isSupported: isAudioRecordingSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const stopSpeaking = () => {
    playbackIdRef.current += 1;
    isSpeakingRef.current = false;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  /** Desbloquea SpeechSynthesis dentro del gesto del usuario (requisito de iOS WebKit). */
  const unlockSpeechSynthesis = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const dummy = new SpeechSynthesisUtterance('');
      dummy.lang = 'es-ES';
      dummy.volume = 0;
      window.speechSynthesis.speak(dummy);
    } catch {
      // ignore
    }
  };

  const speakAssistantText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !isComponentOpenRef.current) {
        resolve();
        return;
      }

      const cleaned = sanitizeForSpeech(text);
      if (!cleaned) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      unlockSpeechSynthesis();

      playbackIdRef.current += 1;
      const playbackId = playbackIdRef.current;
      isSpeakingRef.current = true;
      setStatus('responding');

      const chunks = splitIntoSpeechChunks(cleaned);
      if (chunks.length === 0) {
        isSpeakingRef.current = false;
        setStatus('idle');
        resolve();
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      const voice = getBestSpanishVoice(voices);
      const preferredLang = voice?.lang || (isIOSDevice() ? 'es-MX' : 'es-ES');

      const playChunk = (index: number) => {
        if (playbackId !== playbackIdRef.current || !isComponentOpenRef.current) {
          resolve();
          return;
        }

        if (index >= chunks.length) {
          isSpeakingRef.current = false;
          if (isComponentOpenRef.current) {
            setStatus('idle');
          }
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = preferredLang;
        utterance.rate = 0.98; // Cadencia humana natural
        utterance.pitch = 1.0;
        if (voice) utterance.voice = voice;

        utterance.onend = () => {
          if (playbackId !== playbackIdRef.current || !isComponentOpenRef.current) {
            resolve();
            return;
          }
          // Micro-pausa de respiración natural entre oraciones
          setTimeout(() => {
            playChunk(index + 1);
          }, 50);
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis chunk error in Live modal:', e);
          if (playbackId !== playbackIdRef.current || !isComponentOpenRef.current) {
            resolve();
            return;
          }
          playChunk(index + 1);
        };

        window.speechSynthesis.speak(utterance);
      };

      playChunk(0);
    });
  };

  const handleStartRecording = async () => {
    setErrorMessage('');
    setLastAssistantResponse('');
    stopSpeaking();
    unlockSpeechSynthesis(); // Desbloqueo iOS dentro del tap del usuario
    await startRecording();
  };

  const handleCancelRecording = () => {
    cancelRecording();
    setStatus('idle');
  };

  const handleSendRecording = async () => {
    unlockSpeechSynthesis(); // Desbloqueo iOS dentro del tap del usuario
    setErrorMessage('');

    const audioFile = await stopRecording();
    if (!isComponentOpenRef.current) return;

    if (!audioFile) {
      setStatus('idle');
      setErrorMessage('No se capturó audio. Tocá de nuevo para grabar tu consulta.');
      return;
    }

    setStatus('thinking');
    try {
      const processed = await processMediaFile(audioFile);
      const response = await onSendQuery(RECORDED_AUDIO_QUERY, processed);
      if (!isComponentOpenRef.current) return;

      if (response) {
        setLastAssistantResponse(response);
        await speakAssistantText(response);
      } else {
        setErrorMessage('No pude procesar tu consulta de voz. Probá de nuevo o consultá por escrito.');
        setStatus('idle');
      }
    } catch (err) {
      if (!isComponentOpenRef.current) return;
      setErrorMessage(
        err instanceof Error ? err.message : 'Hubo un inconveniente con tu consulta de voz.',
      );
      setStatus('idle');
    }
  };

  const handleNewVoiceQuery = () => {
    void handleStartRecording();
  };

  const handleSeeInChat = () => {
    stopSpeaking();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setErrorMessage('');
    } else {
      playbackIdRef.current += 1;
      isSpeakingRef.current = false;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      cancelRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      playbackIdRef.current += 1;
      isSpeakingRef.current = false;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const viewState: 'idle' | 'recording' | 'thinking' | 'responding' = isRecording
    ? 'recording'
    : status;

  const controlButtonBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 800,
    fontSize: isMobile ? 14 : 15,
    padding: isMobile ? '13px 18px' : '14px 22px',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Voz con Tobi"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'radial-gradient(circle at 50% 35%, #0f1c3a 0%, #060a14 70%, #03050a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '20px 16px 36px' : '30px 24px 44px',
        color: '#ffffff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Barra Superior */}
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'tobiPulse 1.5s infinite',
              }}
            />
            TOBI VOZ
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Nota de voz · Ley 213/93</span>
        </div>

        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            onClose();
          }}
          title="Salir del modo voz"
          aria-label="Cerrar modo voz"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#e2e8f0',
            width: 36,
            height: 36,
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* ÁREA CENTRAL */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          maxWidth: 580,
          margin: '20px 0',
          textAlign: 'center',
        }}
      >
        {viewState === 'idle' && (
          <>
            <button
              type="button"
              onClick={() => void handleStartRecording()}
              aria-label="Tocá para hablar con Tobi"
              title="Tocá para hablar con Tobi"
              style={{
                width: isMobile ? 112 : 132,
                height: isMobile ? 112 : 132,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: 'radial-gradient(circle at 35% 35%, #818cf8 0%, #4f46e5 60%, #1e1b4b 100%)',
                boxShadow: '0 0 50px rgba(99, 102, 241, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 46 : 56,
                animation: 'tobiPulse 3s ease-in-out infinite',
                WebkitTapHighlightColor: 'transparent',
                marginBottom: 26,
              }}
            >
              🎙️
            </button>

            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
              Tocá para hablar con Tobi
            </div>
            <div style={{ fontSize: isMobile ? 12.5 : 14, color: '#94a3b8', maxWidth: 420, lineHeight: 1.5 }}>
              Grabá tu consulta laboral y Tobi la analiza y te responde en voz alta, con el texto en pantalla.
            </div>
            {!isAudioRecordingSupported && (
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  maxWidth: 420,
                }}
              >
                Tu navegador no soporta grabación de audio. Podés escribir tu consulta directamente en el chat.
              </div>
            )}
          </>
        )}

        {viewState === 'recording' && (
          <>
            <div
              style={{
                position: 'relative',
                width: isMobile ? 132 : 152,
                height: isMobile ? 132 : 152,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: -18,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, transparent 70%)',
                  animation: 'tobiLiveRipple 1.8s ease-out infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: '50%',
                  border: '2px solid rgba(239, 68, 68, 0.5)',
                  animation: 'tobiPulse 1.4s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #f87171 0%, #dc2626 50%, #7f1d1d 100%)',
                  boxShadow: '0 0 50px rgba(239, 68, 68, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 44 : 52,
                }}
              >
                🔴
              </div>
            </div>

            <div
              style={{
                fontSize: isMobile ? 30 : 38,
                fontWeight: 800,
                color: '#ffffff',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 6,
              }}
            >
              {formatDuration(recordingDuration)}
            </div>
            <div style={{ fontSize: isMobile ? 13 : 14.5, color: '#fca5a5', marginBottom: 24 }}>
              Grabando tu consulta laboral…
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleCancelRecording}
                style={{
                  ...controlButtonBase,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#e2e8f0',
                }}
              >
                ✕ Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSendRecording()}
                style={{
                  ...controlButtonBase,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#022c22',
                  boxShadow: '0 0 25px rgba(16, 185, 129, 0.5)',
                }}
              >
                ✓ Enviar audio a Tobi
              </button>
            </div>
          </>
        )}

        {viewState === 'thinking' && (
          <>
            <div
              style={{
                width: isMobile ? 84 : 96,
                height: isMobile ? 84 : 96,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, #6366f1, #38bdf8, #10b981, #f59e0b, #6366f1)',
                animation: 'tobiSpin 1.1s linear infinite',
                marginBottom: 24,
                boxShadow: '0 0 40px rgba(99, 102, 241, 0.55)',
              }}
            />
            <div style={{ fontSize: isMobile ? 16 : 19, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>
              Analizando tu caso laboral…
            </div>
            <div style={{ fontSize: isMobile ? 12.5 : 14, color: '#94a3b8', maxWidth: 420, lineHeight: 1.5 }}>
              Tobi está contrastando tu consulta con la Ley 213/93 y la jurisprudencia de la CSJ.
            </div>
          </>
        )}

        {viewState === 'responding' && (
          <>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'tobiPulse 1.2s infinite',
                }}
              />
              Tobi te está respondiendo en voz alta
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: 520,
                maxHeight: isMobile ? '42dvh' : '46dvh',
                overflowY: 'auto',
                padding: '16px 18px',
                borderRadius: 16,
                background: 'rgba(15, 23, 42, 0.78)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                fontSize: isMobile ? 15 : 16,
                lineHeight: 1.65,
                color: '#e2e8f0',
                textAlign: 'left',
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
                marginBottom: 22,
              }}
            >
              {lastAssistantResponse}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => stopSpeaking()}
                style={{
                  ...controlButtonBase,
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#fca5a5',
                }}
              >
                ⏹️ Detener voz
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastAssistantResponse) {
                    void speakAssistantText(lastAssistantResponse);
                  }
                }}
                style={{
                  ...controlButtonBase,
                  background: 'rgba(16, 185, 129, 0.16)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: '#a7f3d0',
                }}
              >
                🔊 Escuchar de nuevo
              </button>
              <button
                type="button"
                onClick={handleNewVoiceQuery}
                style={{
                  ...controlButtonBase,
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  color: '#c7d2fe',
                }}
              >
                🎙️ Otra consulta por voz
              </button>
              <button
                type="button"
                onClick={handleSeeInChat}
                style={{
                  ...controlButtonBase,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#e2e8f0',
                }}
              >
                💬 Ver en el chat
              </button>
            </div>
          </>
        )}

        {errorMessage && (
          <div
            style={{
              marginTop: 18,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: 12.5,
              lineHeight: 1.45,
              maxWidth: 440,
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* PIE */}
      <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', maxWidth: 460, lineHeight: 1.45 }}>
        Grabá una sola consulta por vez. Tobi responde en voz alta y también muestra el texto en pantalla.
      </div>

      <style>
        {`
          @keyframes tobiLiveRipple {
            0% { transform: scale(0.9); opacity: 0.8; }
            100% { transform: scale(1.45); opacity: 0; }
          }
          @keyframes tobiPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes tobiSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
