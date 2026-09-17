/**
 * PROCESADOR DE PDF — LABORAPY (Ruta $0)
 *
 * Convierte un PDF (hasta 15 páginas) en adjuntos aptos para el endpoint del
 * asistente, evitando enviar el archivo crudo (límite Vercel 4.5MB):
 *  - Si tiene capa de texto → extrae el texto y lo envía como `text/plain`.
 *  - Si es escaneado → renderiza páginas a JPEG comprimidas adaptativamente.
 */

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { AssistantAttachment } from './types';
import {
  MAX_PDF_PAGES,
  MAX_PDF_FILE_BYTES,
  PDF_TEXT_MAX_CHARS,
  mergePageTexts,
  shouldUseTextMode,
} from './pdfProcessor.utils';

// El worker de pdf.js se resuelve vía Vite como URL estática del bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ProcessedPdf {
  readonly mode: 'text' | 'images';
  readonly attachments: AssistantAttachment[];
  readonly pageCount: number;
}

/** Configuración de una pasada de compresión de imágenes (escala relativa y calidad JPEG). */
interface ImagePassConfig {
  readonly scale: number;
  readonly quality: number;
}

/** Ancho objetivo de render por página (px). */
const TARGET_PAGE_WIDTH = 1240;

/** Presupuesto total de caracteres sumados de todos los dataURL de la pasada. */
const MAX_ATTACHMENTS_DATA_CHARS = 2_800_000;

/** Pasadas de compresión adaptativa (máximo 3): base → media → agresiva. */
const IMAGE_PASSES: readonly ImagePassConfig[] = [
  { scale: 1.0, quality: 0.62 },
  { scale: 0.78, quality: 0.5 },
  { scale: 0.62, quality: 0.42 },
];

/** Tipo de página del documento pdf.js (inferido para no depender del nombre exportado). */
type PdfPage = Awaited<ReturnType<pdfjsLib.PDFDocumentProxy['getPage']>>;

/** Convierte un Blob en Data URL usando FileReader. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen renderizada.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Renderiza una página a JPEG comprimido (dataURL), reutilizando el canvas y
 * limpiándolo entre páginas.
 */
async function renderPageToDataUrl(
  page: PdfPage,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pass: ImagePassConfig,
): Promise<string> {
  const baseViewport = page.getViewport({ scale: 1 });
  const baseScale = TARGET_PAGE_WIDTH / baseViewport.width;
  const viewport = page.getViewport({ scale: baseScale * pass.scale });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  // Limpiar el canvas antes de reutilizarlo para la siguiente página.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = width;
  canvas.height = height;

  await page.render({ canvas, viewport }).promise;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', pass.quality);
  });
  if (!blob) throw new Error('No se pudo comprimir la imagen del PDF.');
  return blobToDataUrl(blob);
}

/**
 * Procesa un archivo PDF y devuelve sus adjuntos normalizados.
 * Lanza errores en español ante archivo dañado, exceso de tamaño o de páginas.
 */
export async function processPdfFile(file: File): Promise<ProcessedPdf> {
  // Validación de tipo tolerante: algunos navegadores no reportan el MIME correcto,
  // por lo que no se bloquea el archivo por un `file.type` vacío o inesperado.
  if (file.size > MAX_PDF_FILE_BYTES) {
    throw new Error('El archivo supera los 30 MB.');
  }

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  let doc: pdfjsLib.PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch {
    throw new Error('No se pudo leer el PDF (archivo dañado o protegido).');
  }

  try {
    const pageCount = doc.numPages;
    if (pageCount > MAX_PDF_PAGES) {
      throw new Error('El PDF supera el máximo de 15 páginas.');
    }

    // Pasada 1: extracción de texto por página.
    const texts: string[] = [];
    for (let i = 1; i <= pageCount; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      texts.push(pageText);
    }

    if (shouldUseTextMode(texts)) {
      return {
        mode: 'text',
        attachments: [
          {
            name: file.name,
            mimeType: 'text/plain',
            data: mergePageTexts(texts, PDF_TEXT_MAX_CHARS),
          },
        ],
        pageCount,
      };
    }

    // Pasada de imágenes con compresión adaptativa (máx. 3 intentos).
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el lienzo para renderizar el PDF.');
    }

    for (const pass of IMAGE_PASSES) {
      const attachments: AssistantAttachment[] = [];
      let totalChars = 0;
      for (let i = 1; i <= pageCount; i += 1) {
        const page = await doc.getPage(i);
        const dataUrl = await renderPageToDataUrl(page, canvas, ctx, pass);
        totalChars += dataUrl.length;
        attachments.push({
          name: `${file.name} — pág. ${i}`,
          mimeType: 'image/jpeg',
          data: dataUrl,
        });
      }
      if (totalChars <= MAX_ATTACHMENTS_DATA_CHARS) {
        return { mode: 'images', attachments, pageCount };
      }
    }

    throw new Error(
      'El PDF es demasiado pesado incluso comprimido; probá con menos páginas o subí fotos.',
    );
  } finally {
    // Liberar recursos de pdf.js pase lo que pase.
    try {
      await loadingTask.destroy();
    } catch {
      // Liberación best-effort: no debe enmascarar el resultado principal.
    }
  }
}
