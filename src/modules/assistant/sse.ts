/**
 * UTILIDADES SSE (Server-Sent Events) — LABORAPY
 * Parsing incremental de eventos `data:` con soporte de buffers parciales.
 */

export interface SseChunkResult {
  /** Payloads (contenido tras "data:") de los eventos COMPLETOS encontrados. */
  readonly events: readonly string[];
  /** Resto incompleto que debe conservarse para el próximo chunk. */
  readonly rest: string;
}

export function consumeSseChunk(buffer: string): SseChunkResult {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: string[] = [];
  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length > 0) events.push(dataLines.join('\n'));
  }
  return { events, rest };
}
