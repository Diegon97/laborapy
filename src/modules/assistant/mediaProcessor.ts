/**
 * PROCESADOR MULTIFORMATO DE ADJUNTOS CON LÍMITES COHERENTES — LABORAPY
 *
 * Gestiona la ingesta de archivos arrastrados o adjuntados en el chat de Tobi
 * aplicando reglas y límites estrictos de seguridad, volumen y costos:
 *  - PDF: máx. 15 páginas y 12 MB (procesado localmente).
 *  - Imágenes (JPEG, PNG, WebP): máx. 6 MB.
 *  - Documentos Word (.docx, .doc): máx. 8 MB (extracción local de párrafos XML).
 *  - Archivos de audio (MP3, WAV, M4A, OGG): máx. 12 MB (notas de voz / audios laborales).
 *  - Texto plano (.txt, .md, .csv): máx. 2 MB.
 *  - Bloqueo estricto de videos (.mp4, .mkv, .avi) y binarios ajenos.
 *  - Máximo 3 archivos simultáneos por envío.
 */

import { processPdfFile } from './pdfProcessor';
import type { AssistantAttachment } from './types';

/** Límites coherentes de tamaño por tipo de archivo */
export const MAX_PDF_FILE_BYTES = 12 * 1024 * 1024; // 12 MB
export const MAX_IMAGE_FILE_BYTES = 6 * 1024 * 1024; // 6 MB
export const MAX_DOC_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_AUDIO_FILE_BYTES = 12 * 1024 * 1024; // 12 MB
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FILES_PER_DROP = 3;

/** Presupuesto máximo de caracteres extraídos de texto (anti-abrumación) */
export const MAX_DOC_TEXT_CHARS = 50_000;

/** Extensiones de video prohibidas */
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm_video', '.m4v', '.3gp'
]);

/** Convierte un Blob o File en Data URL usando FileReader o buffer fallback. */
function fileToDataUrl(file: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Formato de datos no válido al leer el archivo.'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo adjunto.'));
      reader.readAsDataURL(file);
    });
  }

  // Fallback transparente para entornos de prueba / Node.js
  return file.arrayBuffer().then((buf) => {
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(buf).toString('base64') : '';
    const mime = file.type || 'application/octet-stream';
    return `data:${mime};base64,${base64}`;
  });
}

/** Desescapa entidades XML estándar. */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

/** Extrae texto legible a partir del contenido XML de `word/document.xml`. */
function extractTextFromDocumentXml(xml: string): string {
  const normalized = xml
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:tab[^>]*\/>/gi, '\t');

  const regex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi;
  const parts: string[] = [];
  let match: RegExpExecArray | null = regex.exec(normalized);

  while (match !== null) {
    parts.push(match[1]);
    match = regex.exec(normalized);
  }

  const text = parts.length > 0 ? parts.join('') : normalized.replace(/<[^>]+>/g, ' ');

  return decodeXmlEntities(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** Descomprime un buffer raw DEFLATE usando DecompressionStream nativo del navegador. */
async function decompressDeflate(compressedBytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    return '';
  }

  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    await writer.write(compressedBytes as any);
    await writer.close();
    const response = new Response(ds.readable);
    const buffer = await response.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  } catch {
    try {
      const ds2 = new DecompressionStream('deflate');
      const writer2 = ds2.writable.getWriter();
      await writer2.write(compressedBytes as any);
      await writer2.close();
      const response2 = new Response(ds2.readable);
      const buffer2 = await response2.arrayBuffer();
      return new TextDecoder('utf-8').decode(buffer2);
    } catch {
      return '';
    }
  }
}

/**
 * Parser PKZIP nativo en memoria para extraer `word/document.xml` de un `.docx`.
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let eocdOffset = -1;
  const maxSearch = Math.min(bytes.length, 65557);
  for (let i = bytes.length - 22; i >= bytes.length - maxSearch; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  let xmlContent = '';

  if (eocdOffset !== -1) {
    const cdEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');
    let currentOffset = cdOffset;

    for (let i = 0; i < cdEntries && currentOffset < eocdOffset; i += 1) {
      if (view.getUint32(currentOffset, true) !== 0x02014b50) break;
      const compression = view.getUint16(currentOffset + 10, true);
      const compressedSize = view.getUint32(currentOffset + 20, true);
      const fnLen = view.getUint16(currentOffset + 28, true);
      const extraLen = view.getUint16(currentOffset + 30, true);
      const commentLen = view.getUint16(currentOffset + 32, true);
      const localHeaderOffset = view.getUint32(currentOffset + 42, true);

      const fnBytes = bytes.subarray(currentOffset + 46, currentOffset + 46 + fnLen);
      const filename = decoder.decode(fnBytes);

      if (filename === 'word/document.xml') {
        if (view.getUint32(localHeaderOffset, true) === 0x04034b50) {
          const localFnLen = view.getUint16(localHeaderOffset + 26, true);
          const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
          const dataStart = localHeaderOffset + 30 + localFnLen + localExtraLen;
          const compressedData = bytes.subarray(dataStart, dataStart + compressedSize);

          if (compression === 0) {
            xmlContent = decoder.decode(compressedData);
          } else if (compression === 8) {
            xmlContent = await decompressDeflate(compressedData);
          }
        }
        break;
      }

      currentOffset += 46 + fnLen + extraLen + commentLen;
    }
  }

  if (!xmlContent) {
    const rawUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (rawUtf8.includes('<w:t')) {
      xmlContent = rawUtf8;
    }
  }

  if (!xmlContent) {
    throw new Error('No se pudo localizar el texto principal en el archivo .docx.');
  }

  const extracted = extractTextFromDocumentXml(xmlContent);
  if (extracted.trim().length === 0) {
    throw new Error('El archivo .docx no contiene texto legible.');
  }

  return extracted.length > MAX_DOC_TEXT_CHARS
    ? extracted.slice(0, MAX_DOC_TEXT_CHARS)
    : extracted;
}

/**
 * Extrae texto legible de archivos binarios Word 97-2003 (.doc).
 */
function extractDocBinaryText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  let currentU16 = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const low = bytes[i];
    const high = bytes[i + 1];
    if (high === 0 && ((low >= 32 && low <= 126) || low === 10 || low === 13 || (low >= 160 && low <= 255))) {
      currentU16 += String.fromCharCode(low);
    } else {
      if (currentU16.trim().length >= 4) chunks.push(currentU16.trim());
      currentU16 = '';
    }
  }
  if (currentU16.trim().length >= 4) chunks.push(currentU16.trim());

  let currentAscii = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || (b >= 160 && b <= 255)) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.trim().length >= 5) chunks.push(currentAscii.trim());
      currentAscii = '';
    }
  }
  if (currentAscii.trim().length >= 5) chunks.push(currentAscii.trim());

  const noisePattern = /^(Normal\.dot|Times New Roman|Calibri|Arial|Courier New|Tahoma|Symbol|Microsoft Word Document|WordDocument|CompObj)$/i;
  const filtered = chunks.filter((chunk) => chunk.length >= 4 && !noisePattern.test(chunk));
  const unique = Array.from(new Set(filtered));
  const joined = unique.join('\n\n');

  if (joined.trim().length < 20) {
    throw new Error('No se pudo extraer texto legible del documento .doc antiguo. Guardalo como .docx o PDF.');
  }

  return joined.length > MAX_DOC_TEXT_CHARS ? joined.slice(0, MAX_DOC_TEXT_CHARS) : joined;
}

/**
 * Valida límites y procesa un archivo individual multiformato.
 */
export async function processMediaFile(file: File): Promise<AssistantAttachment[]> {
  if (!file) {
    throw new Error('No se proporcionó ningún archivo para procesar.');
  }

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  // Bloqueo explícito de videos
  for (const ext of VIDEO_EXTENSIONS) {
    if (name.endsWith(ext) || type.startsWith('video/')) {
      throw new Error(
        `Los archivos de video no están permitidos. Para consultas laborales podés adjuntar notas de voz (audio), documentos o fotos de hasta 12 MB.`
      );
    }
  }

  // 1. Archivos PDF (máx 12 MB y máx 15 páginas)
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    if (file.size > MAX_PDF_FILE_BYTES) {
      throw new Error(
        `El PDF "${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El límite máximo para PDFs es de 12 MB (hasta 15 páginas). Adjuntá solo las páginas relevantes del contrato o liquidación.`
      );
    }
    const processed = await processPdfFile(file);
    return processed.attachments;
  }

  // 2. Imágenes (máx 6 MB)
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      throw new Error(
        `La imagen "${file.name}" supera el límite de 6 MB. Por favor reducila o tomá una foto más liviana de la nota laboral.`
      );
    }
    const dataUrl = await fileToDataUrl(file);
    return [
      {
        name: file.name,
        mimeType: file.type || 'image/jpeg',
        data: dataUrl,
        previewUrl: dataUrl,
        sizeBytes: file.size,
      },
    ];
  }

  // 3. Documentos Word .docx (máx 8 MB)
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    if (file.size > MAX_DOC_FILE_BYTES) {
      throw new Error(`El documento Word "${file.name}" supera el límite de 8 MB.`);
    }
    const buffer = await file.arrayBuffer();
    const text = await extractDocxText(buffer);
    return [
      {
        name: file.name,
        mimeType: 'text/plain',
        data: text,
        sizeBytes: file.size,
      },
    ];
  }

  // 4. Documentos Word .doc (máx 8 MB)
  if (type === 'application/msword' || name.endsWith('.doc')) {
    if (file.size > MAX_DOC_FILE_BYTES) {
      throw new Error(`El documento Word .doc "${file.name}" supera el límite de 8 MB.`);
    }
    const buffer = await file.arrayBuffer();
    const text = extractDocBinaryText(buffer);
    return [
      {
        name: file.name,
        mimeType: 'text/plain',
        data: text,
        sizeBytes: file.size,
      },
    ];
  }

  // 5. Audios / notas de voz laborales (máx 12 MB)
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|aac)$/i.test(name)) {
    if (file.size > MAX_AUDIO_FILE_BYTES) {
      throw new Error(
        `El audio "${file.name}" supera el límite de 12 MB (equivalente a una nota de voz de ~10 minutos). Por favor recortalo al fragmento laboral clave.`
      );
    }
    const dataUrl = await fileToDataUrl(file);
    return [
      {
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        data: dataUrl,
        previewUrl: dataUrl,
        sizeBytes: file.size,
      },
    ];
  }

  // 6. Texto plano (.txt, .md, .csv, máx 2 MB)
  if (type.startsWith('text/') || /\.(txt|md|csv)$/i.test(name)) {
    if (file.size > MAX_TEXT_FILE_BYTES) {
      throw new Error(`El archivo de texto "${file.name}" supera el límite de 2 MB.`);
    }
    const text = await file.text();
    const trimmed = text.length > MAX_DOC_TEXT_CHARS ? text.slice(0, MAX_DOC_TEXT_CHARS) : text;
    return [
      {
        name: file.name,
        mimeType: 'text/plain',
        data: trimmed,
        sizeBytes: file.size,
      },
    ];
  }

  throw new Error(
    `Formato no soportado ("${file.name}"). Podés adjuntar PDFs (hasta 15 págs), documentos Word (.docx/.doc), fotos o audios de hasta 12 MB.`
  );
}
