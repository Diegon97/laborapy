/**
 * MODO VOZ CONVERSACIONAL GEMINI LIVE — LABORAPY (TOBI)
 *
 * Experiencia inmersiva de voz bidireccional continua:
 *  - Orbe cósmico animado que pulsa en tiempo real según el estado (Escuchando / Pensando / Hablando).
 *  - Transcripción en vivo de lo que el usuario va diciendo.
 *  - Síntesis de voz automática de la respuesta de Tobi (lectura en voz alta).
 *  - Bucle continuo de conversación: al terminar de responder Tobi, se activa la escucha automáticamente.
 *  - Sincronización completa con el historial de chat (todos los mensajes hablados quedan guardados).
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  sanitizeForSpeech,
  getBestSpanishVoice,
  splitIntoSpeechChunks,
  getPreferredSpeechLang,
  isIOSDevice,
} from '../hooks/useTobiVoice';

export interface TobiGeminiLiveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSendQuery: (text: string) => Promise<string | null>;
  readonly isMobile?: boolean;
}

export const TobiGeminiLiveModal: React.FC<TobiGeminiLiveModalProps> = ({
  isOpen,
  onClose,
  onSendQuery,
  isMobile = false,
}) => {
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'connecting'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Tocá el micrófono para comenzar');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isComponentOpenRef = useRef<boolean>(isOpen);
  isComponentOpenRef.current = isOpen;

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
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

      // Desbloquear audio en iOS WebKit
      try {
        const dummy = new SpeechSynthesisUtterance('');
        dummy.lang = 'es-ES';
        window.speechSynthesis.speak(dummy);
      } catch {
        // ignore
      }

      window.speechSynthesis.cancel();
      isSpeakingRef.current = true;
      setStatus('speaking');
      setStatusMessage('Tobi está hablando…');

      const chunks = splitIntoSpeechChunks(cleaned);
      if (chunks.length === 0) {
        isSpeakingRef.current = false;
        resolve();
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      const voice = getBestSpanishVoice(voices);
      const preferredLang = voice?.lang || (isIOSDevice() ? 'es-MX' : 'es-ES');

      const playChunk = (index: number) => {
        if (!isSpeakingRef.current || !isComponentOpenRef.current || index >= chunks.length) {
          isSpeakingRef.current = false;
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = preferredLang;
        utterance.rate = 0.98; // Cadencia natural y pausada
        utterance.pitch = 1.0;
        if (voice) utterance.voice = voice;

        utterance.onend = () => {
          if (!isSpeakingRef.current || !isComponentOpenRef.current) {
            resolve();
            return;
          }
          // Micro-pausa de respiración natural de 50ms entre oraciones
          setTimeout(() => {
            playChunk(index + 1);
          }, 50);
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis chunk error in Live modal:', e);
          if (!isSpeakingRef.current || !isComponentOpenRef.current) {
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

  const handleUserSaid = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || !isComponentOpenRef.current) return;

    setStatus('thinking');
    setStatusMessage('Tobi está analizando tu caso…');

    try {
      const response = await onSendQuery(trimmed);
      if (response && isComponentOpenRef.current) {
        setLastAssistantResponse(response);
        await speakAssistantText(response);
      }
    } catch {
      if (isComponentOpenRef.current) {
        setStatusMessage('Hubo un inconveniente de conexión.');
      }
    } finally {
      if (isComponentOpenRef.current && !isMicMuted) {
        startListeningLoop();
      } else {
        setStatus('idle');
      }
    }
  };

  const startListeningLoop = () => {
    if (!isComponentOpenRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no cuenta con la API de reconocimiento de voz. Podés escribir por teclado.');
      onClose();
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    setStatus('connecting');
    setStatusMessage('Iniciando micrófono…');

    const watchdogTimer = setTimeout(() => {
      if (isComponentOpenRef.current && !isSpeakingRef.current) {
        setStatus('idle');
        setStatusMessage('Tocá el orbe o el micrófono para hablar');
      }
    }, 2500);

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Frase por frase para streaming interactivo
    recognition.interimResults = true;
    recognition.lang = getPreferredSpeechLang();

    let finalTranscript = '';

    recognition.onstart = () => {
      clearTimeout(watchdogTimer);
      setStatus('listening');
      setStatusMessage('Te escucho en vivo… decime tu consulta');
      setLiveTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + t;
        } else {
          interim += t;
        }
      }
      setLiveTranscript(finalTranscript || interim);
    };

    recognition.onerror = (event: any) => {
      clearTimeout(watchdogTimer);
      console.warn('Recognition error in Live mode:', event.error);
      if (event.error === 'not-allowed') {
        setStatusMessage('Permiso de micrófono bloqueado en tu navegador.');
      } else if (event.error === 'service-not-allowed') {
        setStatusMessage('En iPhone, activá Dictado en Ajustes > General > Teclado.');
      } else if (event.error === 'language-not-supported') {
        setStatusMessage('Idioma ajustado a español. Tocá para reintentar.');
      } else if (event.error === 'no-speech') {
        setStatusMessage('No detecté sonido. Tocá el orbe para hablar de nuevo.');
      } else {
        setStatusMessage('Tocá el orbe o el micrófono para hablar');
      }
      setStatus('idle');
    };

    recognition.onend = () => {
      clearTimeout(watchdogTimer);
      const textToProcess = finalTranscript.trim();
      if (textToProcess) {
        void handleUserSaid(textToProcess);
      } else {
        setStatus('idle');
        setStatusMessage('Tocá el orbe o el micrófono para hablar');
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      clearTimeout(watchdogTimer);
      console.warn('No se pudo iniciar recognition:', err);
      setStatus('idle');
      setStatusMessage('Tocá el orbe o el micrófono para hablar');
    }
  };

  const toggleMic = () => {
    if (status === 'listening' || status === 'connecting') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setIsMicMuted(true);
      setStatus('idle');
      setStatusMessage('Micrófono en pausa. Tocá el orbe o el botón para hablar.');
    } else {
      setIsMicMuted(false);
      stopSpeaking();
      startListeningLoop();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsMicMuted(false);
      setStatus('connecting');
      setStatusMessage('Conectando con Tobi…');
      // Iniciar escucha directamente
      const timer = setTimeout(() => {
        startListeningLoop();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Voz Gemini Live con Tobi"
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
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'tobiPulse 1.5s infinite' }} />
            TOBI LIVE
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Voz Bidireccional Ley 213/93
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Salir del modo voz"
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

      {/* ÁREA CENTRAL: ORBE CÓSMICO ESTILO GEMINI LIVE */}
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
        }}
      >
        {/* Contenedor del Orbe con pulsos concéntricos */}
        <div
          style={{
            position: 'relative',
            width: isMobile ? 180 : 230,
            height: isMobile ? 180 : 230,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
          {/* Anillos de pulsación */}
          <div
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              background: status === 'listening'
                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, transparent 70%)'
                : status === 'speaking'
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
              animation: 'tobiLiveRipple 2.4s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: '50%',
              border: status === 'listening'
                ? '2px solid rgba(239, 68, 68, 0.4)'
                : status === 'speaking'
                ? '2px solid rgba(52, 211, 153, 0.5)'
                : '2px solid rgba(129, 140, 248, 0.35)',
              animation: 'tobiPulse 2s ease-in-out infinite',
            }}
          />

          {/* Orbe Central */}
          <div
            onClick={toggleMic}
            role="button"
            tabIndex={0}
            title={status === 'listening' ? 'Tocá para pausar micrófono' : 'Tocá para hablar con Tobi'}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              background: status === 'listening'
                ? 'radial-gradient(circle at 35% 35%, #f87171 0%, #dc2626 50%, #7f1d1d 100%)'
                : status === 'connecting'
                ? 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0284c7 60%, #0369a1 100%)'
                : status === 'thinking'
                ? 'conic-gradient(from 0deg, #6366f1, #38bdf8, #10b981, #f59e0b, #6366f1)'
                : status === 'speaking'
                ? 'radial-gradient(circle at 35% 35%, #34d399 0%, #059669 60%, #064e3b 100%)'
                : 'radial-gradient(circle at 35% 35%, #818cf8 0%, #4f46e5 60%, #1e1b4b 100%)',
              boxShadow: status === 'listening'
                ? '0 0 50px rgba(239, 68, 68, 0.65)'
                : status === 'connecting'
                ? '0 0 50px rgba(56, 189, 248, 0.65)'
                : status === 'speaking'
                ? '0 0 50px rgba(16, 185, 129, 0.65)'
                : '0 0 50px rgba(99, 102, 241, 0.65)',
              animation: status === 'thinking' || status === 'connecting' ? 'tobiSpin 2s linear infinite' : 'tobiPulse 3s ease-in-out infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 36 : 48,
              transition: 'background 0.4s ease, box-shadow 0.4s ease',
            }}
          >
            <span>
              {status === 'listening'
                ? '🎙️'
                : status === 'connecting'
                ? '🔄'
                : status === 'speaking'
                ? '✨'
                : status === 'thinking'
                ? '⏳'
                : '💬'}
            </span>
          </div>
        </div>

        {/* Mensaje de Estado */}
        <div
          style={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            color: '#f8fafc',
            textAlign: 'center',
            marginBottom: 16,
            minHeight: 26,
          }}
        >
          {statusMessage}
        </div>

        {/* Tarjeta de Transcripción / Respuesta Hablada */}
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            minHeight: 70,
            maxHeight: 140,
            overflowY: 'auto',
            padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            fontSize: isMobile ? 13 : 14,
            lineHeight: 1.5,
            color: '#cbd5e1',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          {liveTranscript ? (
            <div>
              <span style={{ color: '#fca5a5', fontWeight: 700 }}>Vos: </span>
              <span style={{ color: '#ffffff' }}>"{liveTranscript}"</span>
            </div>
          ) : lastAssistantResponse ? (
            <div>
              <span style={{ color: '#34d399', fontWeight: 700 }}>Tobi: </span>
              <span>{lastAssistantResponse.replace(/:::[\s\S]*?:::/g, '').slice(0, 200)}…</span>
            </div>
          ) : (
            <span style={{ color: '#64748b' }}>
              Hablale naturalmente sobre tu consulta, despido o funcionario…
            </span>
          )}
        </div>

        {/* Entrada alternativa de texto para móvil si el micrófono no responde */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualText.trim()) return;
            const t = manualText.trim();
            setManualText('');
            void handleUserSaid(t);
          }}
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            gap: 8,
            marginTop: 12,
            boxSizing: 'border-box',
          }}
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="O escribí tu consulta acá para escuchar a Tobi…"
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              color: '#ffffff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!manualText.trim() || status === 'thinking'}
            style={{
              background: manualText.trim() ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              color: manualText.trim() ? '#022c22' : '#64748b',
              fontWeight: 700,
              fontSize: 12.5,
              border: 'none',
              borderRadius: 12,
              padding: '8px 14px',
              cursor: manualText.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Enviar
          </button>
        </form>
      </div>

      {/* CONTROLES INFERIORES */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Botón Silenciar / Escuchar voz de Tobi */}
        <button
          type="button"
          onClick={() => {
            if (status === 'speaking' || isSpeakingRef.current) {
              stopSpeaking();
            } else if (lastAssistantResponse) {
              void speakAssistantText(lastAssistantResponse);
            } else {
              void speakAssistantText('Hola, soy Tobi. Tocá el micrófono o el orbe central para hacerme tu consulta laboral.');
            }
          }}
          title={status === 'speaking' ? 'Silenciar a Tobi' : 'Escuchar a Tobi en voz alta'}
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: status === 'speaking' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: status === 'speaking' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          {status === 'speaking' ? '🔇' : '🔊'}
        </button>

        {/* Botón Principal de Micrófono (Hablar / Pausar) */}
        <button
          type="button"
          onClick={toggleMic}
          title={status === 'listening' ? 'Pausar micrófono' : 'Activar micrófono'}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: status === 'listening'
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: status === 'listening'
              ? '0 0 25px rgba(239, 68, 68, 0.6)'
              : '0 0 25px rgba(16, 185, 129, 0.6)',
            transition: 'all 0.2s ease',
          }}
        >
          {status === 'listening' ? '⏸' : '🎙️'}
        </button>

        {/* Botón Salir y volver al texto */}
        <button
          type="button"
          onClick={onClose}
          title="Cerrar y ver chat de texto"
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          ✕
        </button>
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
