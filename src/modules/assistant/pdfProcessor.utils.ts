/**
 * UTILIDADES PURAS DE PROCESAMIENTO DE PDF — LABORAPY
 *
 * Sin dependencias externas. Gobiernan cuándo un PDF con capa de texto puede
 * enviarse como `text/plain` (payload liviano) y cómo fusionar el texto de
 * varias páginas respetando un presupuesto de caracteres.
 */

/** Máximo de páginas aceptadas por documento (límite de la ruta $0). */
export const MAX_PDF_PAGES = 15;

/** Tamaño máximo del archivo fuente (30 MB). */
export const MAX_PDF_FILE_BYTES = 30 * 1024 * 1024; // 30MB del archivo fuente

/** Ratio mínimo de páginas con texto para preferir el modo texto (60%). */
export const PDF_TEXT_MODE_MIN_RATIO = 0.6;

/** Presupuesto máximo de caracteres para el texto extraído. */
export const PDF_TEXT_MAX_CHARS = 55000;

/** Cantidad mínima de caracteres útiles para considerar que una página "tiene texto". */
const PDF_TEXT_PAGE_MIN_CHARS = 40;

/**
 * Decide si conviene enviar el PDF como texto plano en lugar de imágenes.
 * Devuelve `true` cuando al menos el 60% de las páginas tienen 40 caracteres
 * o más de texto útil y existe como mínimo una página.
 */
export function shouldUseTextMode(pageTexts: readonly string[]): boolean {
  if (pageTexts.length === 0) return false;
  const pagesWithText = pageTexts.filter(
    (text) => (text ?? '').trim().length >= PDF_TEXT_PAGE_MIN_CHARS,
  ).length;
  return pagesWithText / pageTexts.length >= PDF_TEXT_MODE_MIN_RATIO;
}

/**
 * Une el texto de las páginas con marcadores numerados ('\n\n--- Página N ---\n\n')
 * y recorta el resultado a `maxChars` si excede el presupuesto.
 */
export function mergePageTexts(pageTexts: readonly string[], maxChars: number): string {
  const merged = pageTexts
    .map((text, index) => `\n\n--- Página ${index + 1} ---\n\n${(text ?? '').trim()}`)
    .join('')
    .trim();
  if (merged.length <= maxChars) return merged;
  return merged.slice(0, maxChars);
}
