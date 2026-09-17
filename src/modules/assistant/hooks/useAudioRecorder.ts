/**
 * HOOK DE GRABACIÓN DE AUDIO SIMPLE Y ROBUSTO — LABORAPY (TOBI)
 * Estilo Gemini Web / WhatsApp / ChatGPT:
 *  - Graba audio mediante HTML5 MediaRecorder estándar.
 *  - Compatible con iOS (iPhone/iPad en Safari/Chrome con audio/mp4) y Android/Desktop (audio/webm).
 *  - Provee timer de duración en segundos.
 *  - Devuelve un objeto File estándar listo para procesar con processMediaFile.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderReturn {
  readonly isRecording: boolean;
  readonly recordingDuration: number;
  readonly isSupported: boolean;
  readonly startRecording: () => Promise<void>;
  readonly stopRecording: () => Promise<File | null>;
  readonly cancelRecording: () => void;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    // Safari / WebKit en iOS
    return 'audio/mp4';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/ogg')) {
    return 'audio/ogg';
  }
  if (MediaRecorder.isTypeSupported('audio/wav')) {
    return 'audio/wav';
  }
  return 'audio/webm';
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const cleanupTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  };

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    cleanupTracks();
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  // Limpiar recursos al desmontar el componente
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  const startRecording = useCallback(async () => {
    cancelRecording();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Tu navegador no soporta grabación de audio. Podés escribir tu consulta o adjuntar un archivo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(250); // Recolectar datos en intervalos cortos de 250ms
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err: any) {
      console.warn('Error al iniciar grabación de micrófono:', err);
      cleanupTracks();
      setIsRecording(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        alert('Permiso de micrófono no otorgado. Habilitá el micrófono en los permisos de tu navegador.');
      } else {
        alert('No se pudo acceder al micrófono: ' + (err?.message || 'Error desconocido'));
      }
    }
  }, [cancelRecording]);

  const stopRecording = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cancelRecording();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        cleanupTracks();
        const rawMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: rawMime });
        chunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        const ext = rawMime.includes('mp4')
          ? 'm4a'
          : rawMime.includes('ogg')
          ? 'ogg'
          : rawMime.includes('wav')
          ? 'wav'
          : 'webm';

        const file = new File([blob], `audio_consulta_${Date.now()}.${ext}`, {
          type: rawMime,
          lastModified: Date.now(),
        });
        resolve(file);
      };

      try {
        recorder.stop();
      } catch {
        cancelRecording();
        resolve(null);
      }
    });
  }, [cancelRecording]);

  return {
    isRecording,
    recordingDuration,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
