import { describe, it, expect } from 'vitest';
import { processMediaFile } from '../mediaProcessor';

describe('mediaProcessor — Procesador Multiformato con Límites Coherentes', () => {
  it('rechaza terminantemente archivos de video con mensaje amigable', async () => {
    const videoFile = new File(['fake-video-content'], 'pelicula.mp4', { type: 'video/mp4' });
    await expect(processMediaFile(videoFile)).rejects.toThrow(/archivos de video no están permitidos/i);
  });

  it('rechaza archivos que superen los límites coherentes de imagen (máx 6 MB)', async () => {
    // Archivo simulado que sobrepasa 6 MB
    const bigFile = new File(['a'], 'foto_gigante.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 7 * 1024 * 1024 });

    await expect(processMediaFile(bigFile)).rejects.toThrow(/supera el límite de 6 MB/i);
  });

  it('rechaza notas de voz que superen los 12 MB', async () => {
    const bigAudio = new File(['a'], 'audio_largo.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(bigAudio, 'size', { value: 14 * 1024 * 1024 });

    await expect(processMediaFile(bigAudio)).rejects.toThrow(/supera el límite de 12 MB/i);
  });

  it('procesa archivos de texto plano (.txt) extrayendo el contenido textual', async () => {
    const textContent = 'Nota de aviso de despido laboral notificada el 15/09/2026.';
    const txtFile = new File([textContent], 'aviso.txt', { type: 'text/plain' });

    const attachments = await processMediaFile(txtFile);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].mimeType).toBe('text/plain');
    expect(attachments[0].data).toBe(textContent);
    expect(attachments[0].name).toBe('aviso.txt');
  });

  it('procesa audios generando objeto con dataUrl y preview para reproducción', async () => {
    const audioContent = 'audio-simulado';
    const audioFile = new File([audioContent], 'nota_de_voz.m4a', { type: 'audio/m4a' });

    const attachments = await processMediaFile(audioFile);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].mimeType).toBe('audio/m4a');
    expect(attachments[0].previewUrl).toBeDefined();
    expect(attachments[0].name).toBe('nota_de_voz.m4a');
  });
});
