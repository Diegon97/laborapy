/**
 * INGESTA DE JURISPRUDENCIA LABORAL CSJ — LABORAPY
 *
 * Ingesta por lotes de jurisprudencia laboral de la Corte Suprema de Justicia
 * de Paraguay (https://www.csj.gov.py/jurisprudencia) hacia Supabase (`jurisprudencia_csj`).
 *
 * Características:
 *   - Scraping respetuoso con sesión ASP.NET + cookies + __RequestVerificationToken.
 *   - Detección polimórfica de formato (PDF / DOC OLE2 / DOCX / RTF) por headers y número mágico.
 *   - Extracción de texto multiformato (pdfjs-dist, CP1252/UTF-16LE, zlib nativo, limpieza RTF).
 *   - Fallback resiliente: PDF corrupto (`Invalid PDF structure`) reintenta como `.doc`.
 *   - Copia íntegra de cada archivo descargado en `./documentos_csj/` (idempotente).
 *   - Telemetría en vivo cada 60 s: docs/min, duración, % de avance y ETA.
 *   - Persistencia de progreso en `ingestion_progress.json`.
 *   - Lotes progresivos con ramp exponencial (1, 2, 4, 8, 16...) y pausas de enfriamiento.
 *   - Detección de bloqueos HTTP 403/429 con cooldown de 15 min y salida con exit code 2.
 *   - Idempotencia por `codigo_csj` (saltea filas con estado 'ok' o 'sin_texto' salvo --force).
 *   - Blindaje de credenciales: fail-fast de variables de entorno sin exponer secretos.
 *
 * Uso típico:
 *   node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs
 *   node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --years 2023,2024 --limit 5
 *   node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const CSJ_BASE_URL = 'https://www.csj.gov.py/jurisprudencia';
const USER_AGENT = 'LaboraPyBot/1.0 (+https://calculadora-rrhh-py.vercel.app)';
const MATERIA_LABORAL = '2';
const UMBRAL_TEXTO_CHARS = 1500;
const MAX_CONSECUTIVE_NETWORK_ERRORS = 10;
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_PAUSE_MIN = 5;
const DEFAULT_COOLDOWN_MIN = 15;
const DEFAULT_PAGE_LENGTH = 100;
const START_YEAR = 1995;
const END_YEAR = 2026;

const DOCUMENTOS_DIR = path.resolve(process.cwd(), 'documentos_csj');
const PROGRESS_FILE = path.resolve(process.cwd(), 'ingestion_progress.json');
const TELEMETRY_INTERVAL_MS = 60000;
const KNOWN_EXTENSIONS = ['pdf', 'doc', 'docx', 'rtf'];
const MIN_RUN_LENGTH = 24;
const MIN_RUN_LETTERS = 15;

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/**
 * Pausa la ejecución durante N milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula una pausa con jitter de ±30%.
 * @param {number} baseMs
 * @returns {Promise<void>}
 */
async function sleepWithJitter(baseMs) {
  const factor = 0.7 + Math.random() * 0.6; // [0.7, 1.3]
  const finalMs = Math.max(100, Math.round(baseMs * factor));
  await sleep(finalMs);
}

/**
 * Parsea argumentos de línea de comandos.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const opts = {
    years: null,
    fromYear: null,
    toYear: null,
    limit: null,
    dryRun: false,
    force: false,
    ramp: true,
    delayMs: DEFAULT_DELAY_MS,
    pauseMin: DEFAULT_PAUSE_MIN,
    cooldownMin: DEFAULT_COOLDOWN_MIN,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--no-ramp') {
      opts.ramp = false;
    } else if (arg === '--ramp') {
      opts.ramp = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--years' || arg.startsWith('--years=')) {
      const raw = arg === '--years' ? argv[++i] : arg.slice('--years='.length);
      opts.years = String(raw || '').split(',').map((y) => Number.parseInt(y.trim(), 10)).filter(Number.isInteger);
      opts.ramp = false;
    } else if (arg === '--from-year' || arg.startsWith('--from-year=')) {
      const raw = arg === '--from-year' ? argv[++i] : arg.slice('--from-year='.length);
      opts.fromYear = Number.parseInt(raw, 10);
    } else if (arg === '--to-year' || arg.startsWith('--to-year=')) {
      const raw = arg === '--to-year' ? argv[++i] : arg.slice('--to-year='.length);
      opts.toYear = Number.parseInt(raw, 10);
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const raw = arg === '--limit' ? argv[++i] : arg.slice('--limit='.length);
      opts.limit = Number.parseInt(raw, 10);
    } else if (arg === '--delay-ms' || arg.startsWith('--delay-ms=')) {
      const raw = arg === '--delay-ms' ? argv[++i] : arg.slice('--delay-ms='.length);
      opts.delayMs = Number.parseInt(raw, 10);
    } else if (arg === '--pause-min' || arg.startsWith('--pause-min=')) {
      const raw = arg === '--pause-min' ? argv[++i] : arg.slice('--pause-min='.length);
      opts.pauseMin = Number.parseFloat(raw);
    } else if (arg === '--cooldown-min' || arg.startsWith('--cooldown-min=')) {
      const raw = arg === '--cooldown-min' ? argv[++i] : arg.slice('--cooldown-min='.length);
      opts.cooldownMin = Number.parseFloat(raw);
    } else {
      console.error(`[CSJ] Argumento desconocido: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Uso:
  node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs [opciones]

Opciones:
  --dry-run             Solo lista conteos y plan de lotes sin tocar Supabase ni descargar documentos
  --years 2023,2024     Lote explícito de años separados por coma (desactiva ramp)
  --from-year N         Año inicial (default: 1995)
  --to-year M           Año final (default: 2026)
  --limit N             Límite máximo de documentos por lote (ideal para pruebas)
  --delay-ms N          Delay base en ms entre descargas con jitter ±30% (default: 1500)
  --pause-min N         Pausa en minutos entre lotes progresivos (default: 5)
  --cooldown-min N      Pausa en minutos ante detección de bloqueo 403/429 (default: 15)
  --force               Reprocesa documentos existentes con estado 'ok' o 'sin_texto'
  --no-ramp             Procesa todos los años en un único lote secuencial
  --help, -h            Muestra esta ayuda
`);
}

/* ============================================================================
 * ALMACÉN LOCAL DE DOCUMENTOS (./documentos_csj)
 * ==========================================================================*/

/**
 * Crea el directorio local de documentos si no existe.
 * @returns {void}
 */
function initializeDocumentStore() {
  fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true });
}

/**
 * Construye un nombre de archivo seguro para el código CSJ.
 * @param {number|string} year
 * @param {number|string} codigo
 * @param {string} ext
 * @returns {string}
 */
function buildDocumentFileName(year, codigo, ext) {
  const safeCodigo = String(codigo).replace(/[^0-9A-Za-z_-]/g, '');
  return `${year}_${safeCodigo}.${ext}`;
}

/**
 * Busca una copia local previa del documento (cualquier extensión conocida).
 * @param {number|string} year
 * @param {number|string} codigo
 * @returns {{path: string, ext: string}|null}
 */
function findExistingDocument(year, codigo) {
  for (const ext of KNOWN_EXTENSIONS) {
    const candidate = path.join(DOCUMENTOS_DIR, buildDocumentFileName(year, codigo, ext));
    if (fs.existsSync(candidate)) {
      return { path: candidate, ext };
    }
  }
  return null;
}

/**
 * Persiste el buffer íntegro del documento. No sobreescribe si ya existe.
 * @param {number|string} year
 * @param {number|string} codigo
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {string} ext
 * @returns {string} ruta final en disco
 */
function saveDocumentToDisk(year, codigo, buffer, ext) {
  initializeDocumentStore();
  const filePath = path.join(DOCUMENTOS_DIR, buildDocumentFileName(year, codigo, ext));
  if (!fs.existsSync(filePath)) {
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    fs.writeFileSync(filePath, data);
  }
  return filePath;
}

/* ============================================================================
 * DETECCIÓN DE FORMATO
 * ==========================================================================*/

/**
 * Detecta el formato por número mágico binario.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {'pdf'|'doc'|'docx'|'rtf'|null}
 */
function detectBinaryFormat(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 5
    && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'pdf'; // %PDF-
  }
  if (bytes.length >= 4
    && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return 'doc'; // CFBF / OLE2
  }
  if (bytes.length >= 4
    && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'docx'; // ZIP local header
  }
  if (bytes.length >= 5
    && bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66) {
    return 'rtf'; // {\rtf
  }
  return null;
}

/**
 * Determina el formato combinando número mágico, content-disposition y content-type.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {{contentType?: string, contentDisposition?: string}} [headers]
 * @returns {'pdf'|'doc'|'docx'|'rtf'}
 */
function detectDocumentFormat(buffer, headers = {}) {
  const magic = detectBinaryFormat(buffer);
  if (magic) return magic;

  const disposition = String(headers.contentDisposition || '');
  const contentType = String(headers.contentType || '').toLowerCase();

  const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (fileNameMatch && fileNameMatch[1]) {
    let rawName = fileNameMatch[1].trim().replace(/^"|"$/g, '');
    try {
      rawName = decodeURIComponent(rawName);
    } catch {
      /* nombre no URL-encoded: se usa tal cual */
    }
    const ext = path.extname(rawName).replace('.', '').toLowerCase();
    if (KNOWN_EXTENSIONS.includes(ext)) return ext;
  }

  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('rtf')) return 'rtf';
  if (contentType.includes('officedocument.wordprocessingml')) return 'docx';
  if (contentType.includes('msword')) return 'doc';

  return 'pdf';
}

/* ============================================================================
 * EXTRACCIÓN POLIMÓRFICA DE TEXTO
 * ==========================================================================*/

let cp1252Decoder = null;

/**
 * Decodifica bytes Windows-1252 preservando acentos (con fallback latin1).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function decodeCp1252(bytes) {
  if (typeof TextDecoder === 'function') {
    if (!cp1252Decoder) {
      try {
        cp1252Decoder = new TextDecoder('windows-1252');
      } catch {
        cp1252Decoder = null;
      }
    }
    if (cp1252Decoder) {
      try {
        return cp1252Decoder.decode(bytes);
      } catch {
        /* cae al fallback latin1 */
      }
    }
  }
  return Buffer.from(bytes).toString('latin1');
}

/**
 * Cuenta coincidencias de un regex global.
 * @param {string} text
 * @param {RegExp} re
 * @returns {number}
 */
function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Puntúa un candidato de texto para elegir el más humano/legible.
 * @param {string} text
 * @returns {number}
 */
function scoreExtractedText(text) {
  if (!text) return 0;
  const total = Math.max(text.length, 1);
  const letters = countMatches(text, /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g);
  const accented = countMatches(text, /[ÁÉÍÓÚÜÑáéíóúüñ]/g);
  const spaces = countMatches(text, /[ \t\n]/g);
  return letters + accented * 4 + (letters / total) * 500 + spaces * 0.25;
}

/**
 * Determina si un run extraído es texto plausible y no basura binaria.
 * @param {string} text
 * @returns {boolean}
 */
function isMeaningfulRun(text) {
  if (text.length < MIN_RUN_LENGTH) return false;
  const letters = countMatches(text, /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g);
  return letters >= MIN_RUN_LETTERS && letters / text.length >= 0.35;
}

/**
 * Extrae runs de texto codificados en CP1252/Latin1 filtrando basura binaria.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function extractRunsFromLatin1(bytes) {
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length > 0) {
      const decoded = decodeCp1252(Uint8Array.from(current));
      if (isMeaningfulRun(decoded)) runs.push(decoded);
    }
    current = [];
  };
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    const isWhitespace = b === 0x09 || b === 0x0a || b === 0x0d;
    const isPrintable = b >= 0x20 && b !== 0x7f;
    if (isWhitespace || isPrintable) current.push(b);
    else flush();
  }
  flush();
  return cleanText(runs.join('\n'));
}

/**
 * Indica si un code unit UTF-16 pertenece a texto legible.
 * @param {number} code
 * @returns {boolean}
 */
function isUtf16TextCode(code) {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0x00a0 && code <= 0x024f) return true; // Latin-1 + Latin Extended (á, é, ñ, ü...)
  if (code >= 0x2010 && code <= 0x2014) return true; // guiones
  if (code >= 0x2018 && code <= 0x201d) return true; // comillas tipográficas
  return false;
}

/**
 * Extrae runs de texto UTF-16LE filtrando basura binaria.
 * @param {Uint8Array} bytes
 * @param {number} startOffset
 * @returns {string}
 */
function extractRunsFromUtf16(bytes, startOffset) {
  const runs = [];
  let current = [];
  const flush = () => {
    if (current.length > 0) {
      const buf = Buffer.alloc(current.length * 2);
      for (let k = 0; k < current.length; k += 1) buf.writeUInt16LE(current[k], k * 2);
      const decoded = buf.toString('utf16le');
      if (isMeaningfulRun(decoded)) runs.push(decoded);
    }
    current = [];
  };
  for (let i = startOffset; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (isUtf16TextCode(code)) current.push(code);
    else flush();
  }
  flush();
  return cleanText(runs.join('\n'));
}

/**
 * Extrae texto de un archivo binario Word .doc (OLE2/CFBF) con heurística CP1252/UTF-16LE.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function extractDocText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const candidates = [
    { label: 'utf16le@0', text: extractRunsFromUtf16(bytes, 0) },
    { label: 'utf16le@1', text: extractRunsFromUtf16(bytes, 1) },
    { label: 'cp1252', text: extractRunsFromLatin1(bytes) },
  ];
  candidates.sort((a, b) => scoreExtractedText(b.text) - scoreExtractedText(a.text));
  return candidates[0].text;
}

/**
 * Localiza la entrada central del ZIP que corresponde al nombre pedido.
 * @param {Buffer} buf
 * @param {string} targetName
 * @returns {{method: number, compSize: number, localOffset: number}|null}
 */
function findZipEntry(buf, targetName) {
  let eocd = -1;
  const minPos = Math.max(0, buf.length - 65558);
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (i >= 0 && buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const cdCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < cdCount; n += 1) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const fnLen = buf.readUInt16LE(offset + 28);
    const exLen = buf.readUInt16LE(offset + 30);
    const cmLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + fnLen);
    if (name === targetName) return { method, compSize, localOffset };
    offset += 46 + fnLen + exLen + cmLen;
  }
  return null;
}

/**
 * Descomprime (stored o deflate) la entrada ZIP indicada.
 * @param {Buffer} buf
 * @param {{method: number, compSize: number, localOffset: number}} entry
 * @returns {Buffer|null}
 */
function extractZipEntryData(buf, entry) {
  const { method, compSize, localOffset } = entry;
  if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) return null;
  const fnLen = buf.readUInt16LE(localOffset + 26);
  const exLen = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + fnLen + exLen;
  if (dataStart > buf.length) return null;
  const compressed = buf.subarray(dataStart, Math.min(dataStart + compSize, buf.length));
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed);
  return null;
}

/**
 * Decodifica entidades XML a texto plano.
 * @param {string} text
 * @returns {string}
 */
function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/**
 * Convierte el XML OOXML `word/document.xml` a texto plano.
 * @param {string} xml
 * @returns {string}
 */
function xmlToText(xml) {
  let text = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  text = decodeXmlEntities(text);
  return cleanText(text);
}

/**
 * Extrae texto de un .docx (ZIP/OOXML) usando zlib nativo.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function extractDocxText(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const entry = findZipEntry(buf, 'word/document.xml');
  if (!entry) throw new Error('DOCX sin entrada word/document.xml');
  const data = extractZipEntryData(buf, entry);
  if (!data) throw new Error('No se pudo descomprimir word/document.xml');
  return xmlToText(data.toString('utf8'));
}

/**
 * Extrae texto de un archivo RTF mapeando secuencias de control a texto plano.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function extractRtfText(buffer) {
  let text = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : Buffer.from(buffer).toString('latin1');

  // Unicode RTF: \uN?
  text = text.replace(/\\u(-?\d+)\s?\??/g, (_, digits) => {
    const code = Number.parseInt(digits, 10);
    const normalized = code < 0 ? code + 65536 : code;
    return String.fromCharCode(normalized);
  });

  // Bytes hex CP1252: \'hh
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => decodeCp1252(Uint8Array.of(Number.parseInt(hex, 16))));

  // Destinos ignorables \*\xxx ... (sin anidamiento complejo)
  text = text.replace(/\{\\\*[^{}]*\}/g, '');

  // Saltos y tabulaciones
  text = text.replace(/\\(par|line)\b/g, '\n');
  text = text.replace(/\\tab\b/g, '\t');

  // Palabras de control restantes
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '');

  // Símbolos de control sueltos
  text = text.replace(/\\[^a-zA-Z]/g, '');

  // Llaves sobrantes
  text = text.replace(/[{}]/g, '');

  return cleanText(text);
}

/**
 * Extrae texto plano por páginas usando pdfjs-dist.
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 * @returns {Promise<string>}
 */
async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const task = pdfjs.getDocument({
    data,
    verbosity: 0,
    useSystemFonts: true,
  });

  try {
    const doc = await task.promise;
    const numPages = doc.numPages;
    const pages = [];
    for (let i = 1; i <= numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageStr = content.items.map((it) => it.str || '').join(' ');
      pages.push(pageStr);
    }
    return cleanText(pages.join('\n\n'));
  } finally {
    await task.destroy();
  }
}

/**
 * Extrae texto según el formato detectado, con fallback resiliente a `.doc`.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @param {string} format
 * @returns {Promise<{text: string, format: string}>}
 */
async function extractWithFallback(buffer, format) {
  const normalized = KNOWN_EXTENSIONS.includes(format) ? format : 'pdf';
  try {
    if (normalized === 'pdf') return { text: await extractPdfText(buffer), format: 'pdf' };
    if (normalized === 'docx') return { text: extractDocxText(buffer), format: 'docx' };
    if (normalized === 'rtf') return { text: extractRtfText(buffer), format: 'rtf' };
    return { text: extractDocText(buffer), format: 'doc' };
  } catch (err) {
    const message = String((err && err.message) || err);
    if (normalized === 'pdf' && /invalid pdf structure/i.test(message)) {
      console.warn('[CSJ] PDF inválido detectado; reintentando extracción como .doc ...');
      return { text: extractDocText(buffer), format: 'doc' };
    }
    if (normalized !== 'doc') {
      const fallbackText = extractDocText(buffer);
      if (fallbackText.length > 0) return { text: fallbackText, format: 'doc' };
    }
    throw err;
  }
}

/* ============================================================================
 * TELEMETRÍA
 * ==========================================================================*/

const telemetry = {
  startTime: Date.now(),
  processed: 0,
  expected: 0,
  ok: 0,
  sinTexto: 0,
  error: 0,
  saltados: 0,
  timer: null,
  state: {
    phase: 'init',
    batch: 0,
    totalBatches: 0,
    year: null,
    codigo: null,
    lastSavedFile: null,
  },
};

/**
 * Formatea milisegundos como "Xm Ys" o "Y s".
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Calcula las métricas de progreso en vivo.
 * @returns {{elapsedMs: number, elapsedMinutes: number, processed: number, expected: number, percent: number, docsPerMinute: number, remaining: number, etaMinutes: number|null}}
 */
function computeMetrics() {
  const elapsedMs = Date.now() - telemetry.startTime;
  const elapsedMinutes = elapsedMs / 60000;
  const docsPerMinute = elapsedMinutes > 0 ? telemetry.processed / elapsedMinutes : 0;
  const expected = Math.max(telemetry.expected, telemetry.processed);
  const remaining = Math.max(expected - telemetry.processed, 0);
  const percent = expected > 0 ? Math.min(100, (telemetry.processed / expected) * 100) : 0;
  const etaMinutes = docsPerMinute > 0 ? remaining / docsPerMinute : null;
  return {
    elapsedMs,
    elapsedMinutes,
    processed: telemetry.processed,
    expected,
    percent,
    docsPerMinute,
    remaining,
    etaMinutes,
  };
}

/**
 * Imprime en consola el bloque de telemetría.
 * @returns {void}
 */
function reportTelemetry() {
  const m = computeMetrics();
  const hora = new Date().toISOString().slice(11, 19);
  const eta = m.etaMinutes === null ? 'N/D' : formatDuration(m.etaMinutes * 60000);
  const line = '='.repeat(70);
  console.log(`\n${line}`);
  console.log(` TELEMETRÍA CSJ — ${hora} UTC`);
  console.log(line);
  console.log(` Transcurrido   : ${formatDuration(m.elapsedMs)}`);
  console.log(` Procesados     : ${m.processed} / ${m.expected}  (${m.percent.toFixed(1)}%)`);
  console.log(` Velocidad      : ${m.docsPerMinute.toFixed(2)} docs/min`);
  console.log(` Restantes      : ${m.remaining}  —  ETA: ${eta}`);
  console.log(` OK: ${telemetry.ok} | Sin texto: ${telemetry.sinTexto} | Error: ${telemetry.error} | Saltados: ${telemetry.saltados}`);
  console.log(` Estado         : lote ${telemetry.state.batch}/${telemetry.state.totalBatches} · año ${telemetry.state.year ?? '-'} · #${telemetry.state.codigo ?? '-'}`);
  console.log(`${line}\n`);
}

/**
 * Persiste el progreso en `ingestion_progress.json` con timestamp y métricas.
 * @returns {void}
 */
function persistProgress() {
  const m = computeMetrics();
  const payload = {
    updated_at: new Date().toISOString(),
    started_at: new Date(telemetry.startTime).toISOString(),
    state: { ...telemetry.state },
    metrics: {
      processed: m.processed,
      expected: m.expected,
      percent: Number(m.percent.toFixed(2)),
      elapsed_seconds: Math.round(m.elapsedMs / 1000),
      docs_per_minute: Number(m.docsPerMinute.toFixed(3)),
      remaining: m.remaining,
      eta_seconds: m.etaMinutes === null ? null : Math.round(m.etaMinutes * 60),
      ok: telemetry.ok,
      sin_texto: telemetry.sinTexto,
      error: telemetry.error,
      saltados: telemetry.saltados,
    },
  };
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[CSJ] No se pudo persistir ${PROGRESS_FILE}: ${err.message}`);
  }
}

/**
 * Inicia el reporte periódico de telemetría (cada 60 s).
 * @returns {void}
 */
function startTelemetry() {
  if (telemetry.timer) return;
  telemetry.timer = setInterval(() => {
    reportTelemetry();
    persistProgress();
  }, TELEMETRY_INTERVAL_MS);
  persistProgress();
}

/**
 * Detiene el reporte periódico de telemetría.
 * @returns {void}
 */
function stopTelemetry() {
  if (telemetry.timer) {
    clearInterval(telemetry.timer);
    telemetry.timer = null;
  }
}

/* ============================================================================
 * SESIÓN HTTP CSJ
 * ==========================================================================*/

class CsjSession {
  constructor() {
    /** @type {Map<string, string>} */
    this.cookies = new Map();
    /** @type {string|null} */
    this.verificationToken = null;
  }

  /**
   * Actualiza la cookie jar a partir de los headers Set-Cookie.
   * @param {Response} res
   */
  updateCookies(res) {
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];

    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        const k = pair.slice(0, eqIdx).trim();
        const v = pair.slice(eqIdx + 1).trim();
        if (k) this.cookies.set(k, v);
      }
    }
  }

  /**
   * Retorna la cabecera Cookie combinada.
   * @returns {string}
   */
  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Inicializa la sesión CSJ: GET /Home/Criterios y extrae el token antiforgery.
   * @returns {Promise<void>}
   */
  async init() {
    const url = `${CSJ_BASE_URL}/Home/Criterios`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(60000),
    });

    this.updateCookies(res);

    if (!res.ok) {
      throw new Error(`Fallo al inicializar sesión CSJ (HTTP ${res.status})`);
    }

    const html = await res.text();
    const match = html.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i)
      || html.match(/value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["']/i);

    if (!match || !match[1]) {
      throw new Error('No se encontró __RequestVerificationToken en /Home/Criterios');
    }

    this.verificationToken = match[1];
  }

  /**
   * Configura los criterios de búsqueda para un año laboral en la sesión del servidor.
   * @param {number} year
   * @returns {Promise<void>}
   */
  async setYearSearchCriteria(year) {
    if (!this.verificationToken) {
      await this.init();
    }

    const url = `${CSJ_BASE_URL}/Home/Busqueda`;
    const body = new URLSearchParams({
      __RequestVerificationToken: this.verificationToken,
      PalabrasTexto: '',
      TipoResolucion: '',
      Numero: '',
      Anno: String(year),
      RangoFecha: '',
      Materias: MATERIA_LABORAL,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        'Cookie': this.getCookieHeader(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(60000),
    });

    this.updateCookies(res);

    if (res.status === 403 || res.status === 429) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    if (!res.ok) {
      throw new Error(`Error en POST /Home/Busqueda para año ${year} (HTTP ${res.status})`);
    }

    // Drenar cuerpo para liberar conexión
    await res.text();
  }

  /**
   * Obtiene una página DataTables de jurisprudencias para la búsqueda activa.
   * @param {number} start
   * @param {number} length
   * @param {number} draw
   * @returns {Promise<{draw: number, recordsTotal: number, recordsFiltered: number, data: any[]}>}
   */
  async getDataPage(start = 0, length = DEFAULT_PAGE_LENGTH, draw = 1) {
    const url = `${CSJ_BASE_URL}/Jurisprudencias/GetData`;
    const body = new URLSearchParams({
      draw: String(draw),
      start: String(start),
      length: String(length),
      'search[value]': '',
      'search[regex]': 'false',
      // El servidor de la CSJ devuelve 0 filas si no se envían los params de orden (verificado en vivo 15/09/2026)
      'order[0][column]': '3',
      'order[0][dir]': 'desc',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': USER_AGENT,
        'Cookie': this.getCookieHeader(),
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(60000),
    });

    this.updateCookies(res);

    if (res.status === 403 || res.status === 429) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    if (!res.ok) {
      throw new Error(`Error en /Jurisprudencias/GetData (HTTP ${res.status})`);
    }

    const json = await res.json();
    return json;
  }

  /**
   * Descarga el documento oficial de una jurisprudencia en memoria,
   * conservando content-type y content-disposition para la detección de formato.
   * @param {number} codigo
   * @returns {Promise<{buffer: Buffer, headers: {contentType: string, contentDisposition: string}}>}
   */
  async downloadDocument(codigo) {
    const url = `${CSJ_BASE_URL}/home/DocumentoJurisprudencia?codigo=${codigo}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Cookie': this.getCookieHeader(),
        'Accept': 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,*/*',
      },
      signal: AbortSignal.timeout(120000),
    });

    this.updateCookies(res);

    if (res.status === 403 || res.status === 429) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al descargar documento`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      buffer,
      headers: {
        contentType: res.headers.get('content-type') || '',
        contentDisposition: res.headers.get('content-disposition') || '',
      },
    };
  }
}

/**
 * Parsea fechas tipo Microsoft JSON Date `/Date(1482894000000)/` a YYYY-MM-DD.
 * @param {string|null} raw
 * @returns {string|null}
 */
function parseCsjDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const match = raw.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) {
      const ms = Number(match[1]);
      if (Number.isFinite(ms)) {
        return new Date(ms).toISOString().slice(0, 10);
      }
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
  }
  return null;
}

/**
 * Limpia texto extraído de OCR o campo directo.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanea el objeto de metadata original recortando campos strings gigantes.
 * @param {object} raw
 * @param {object} extra
 * @returns {object}
 */
function sanitizeMetadata(raw, extra = {}) {
  const out = { ...raw, ...extra };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v.length > 5000) {
      out[k] = '[omitido]';
    }
  }
  return out;
}

/**
 * Genera los lotes progresivos (1, 2, 4, 8, 16, 32...) o lote único.
 * @param {number[]} years
 * @param {boolean} isRamp
 * @returns {number[][]}
 */
function buildBatches(years, isRamp) {
  if (!isRamp) {
    return [years];
  }
  const batches = [];
  let remaining = [...years];
  let size = 1;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, size);
    batches.push(chunk);
    remaining = remaining.slice(size);
    size *= 2;
  }
  return batches;
}

/**
 * Reintenta una operación con backoff exponencial.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number[]} backoffsMs
 * @returns {Promise<T>}
 */
async function retryOperation(fn, backoffsMs = [5000, 15000, 45000]) {
  let lastErr = null;
  for (let attempt = 0; attempt <= backoffsMs.length; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.status === 403 || err.status === 429) {
        throw err; // El bloqueo global se gestiona a nivel lote
      }
      if (attempt < backoffsMs.length) {
        await sleep(backoffsMs[attempt]);
      }
    }
  }
  throw lastErr;
}

/**
 * Ejecuta pausa global de cooldown avisando minutos restantes.
 * @param {number} minutes
 */
async function executeCooldown(minutes) {
  console.warn(`[CSJ] Detectado posible bloqueo (403/429). Entrando en cooldown de ${minutes} min...`);
  const totalSeconds = Math.round(minutes * 60);
  for (let left = totalSeconds; left > 0; left -= 30) {
    const minLeft = Math.ceil(left / 60);
    console.warn(`[CSJ] Cooldown anti-bloqueo: restan aprox. ${minLeft} min...`);
    await sleep(Math.min(30000, left * 1000));
  }
  console.log('[CSJ] Cooldown finalizado. Reanudando reintento...');
}

/**
 * Consulta códigos existentes en Supabase para los años dados.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number[]} years
 * @returns {Promise<Map<number, string>>} codigo_csj => texto_estado
 */
async function fetchExistingCodes(supabase, years) {
  const map = new Map();
  const chunkSize = 20; // Años por consulta IN
  const pageSize = 1000; // Supabase limita cada select a 1000 filas → paginar
  for (let i = 0; i < years.length; i += chunkSize) {
    const slice = years.slice(i, i + chunkSize);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('jurisprudencia_csj')
        .select('codigo_csj, texto_estado')
        .in('anio', slice)
        .order('codigo_csj', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.error('\n[CSJ Error] La tabla `jurisprudencia_csj` no existe en Supabase.');
          console.error('Pegá primero supabase/schema_laborapy_jurisprudencia_csj.sql en el SQL Editor de Supabase.\n');
          process.exit(1);
        }
        throw new Error(`Error al consultar existentes en Supabase: ${error.message}`);
      }

      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        map.set(row.codigo_csj, row.texto_estado);
      }
      if (rows.length < pageSize) break;
    }
  }
  return map;
}

/**
 * Mapea una fila cruda de la CSJ al esquema de la tabla `jurisprudencia_csj`.
 * @param {object} row
 * @param {number} year
 * @param {string} texto
 * @param {'ok'|'sin_texto'|'error'} estado
 * @param {object} [metadataExtra]
 * @returns {object}
 */
function mapRowToRecord(row, year, texto, estado, metadataExtra = {}) {
  const codigo = row.CodigoJurisprudencia;
  const preopinanteArr = [
    row.MinistroPreopinante?.NombreFuncionario,
    row.MinistroPreopinante?.ApellidoFuncionario,
  ].filter(Boolean).map((s) => String(s).trim()).filter(Boolean);

  const preopinante = preopinanteArr.length > 0 ? preopinanteArr.join(' ') : null;

  const resultadoAccion = row.InstanciaPrevia?.DescripcionInstancia
    || (row.Observaciones ? String(row.Observaciones).slice(0, 200) : null);

  const tribunalOrigen = row.TribunalOrigen
    || row.InstanciaPrevia?.DescripcionTribunal
    || null;

  return {
    codigo_csj: codigo,
    tipo_resolucion: row.TipoResolucionJudicial?.DescripcionTipoResolucionJudicial || null,
    numero_resolucion: row.NoResolucionJudicial ?? null,
    anio: year,
    fecha_resolucion: parseCsjDate(row.FechaResolucionJudicial),
    caratula: row.CaratulaPublicacion || null,
    sala: row.Sala?.DescripcionSala || null,
    preopinante,
    materia: 'Laboral',
    accion_resuelta: row.AccionResuleta?.DescripcionAccionResuelta || null,
    resultado_accion: resultadoAccion,
    tribunal_origen: tribunalOrigen,
    url_documento: `${CSJ_BASE_URL}/home/DocumentoJurisprudencia?codigo=${codigo}`,
    texto_completo: texto || '',
    texto_estado: estado,
    texto_chars: texto ? texto.length : 0,
    metadata: sanitizeMetadata(row, metadataExtra),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Salida controlada: persiste telemetría y termina.
 * @param {number} code
 * @returns {never}
 */
function shutdown(code) {
  stopTelemetry();
  persistProgress();
  process.exit(code);
}

/**
 * Punto de entrada principal.
 */
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.years !== null && opts.years.length === 0) {
    console.error('[CSJ Error] --years no contiene años válidos.');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log(' LABORAPY — INGESTA DE JURISPRUDENCIA LABORAL CSJ');
  console.log('='.repeat(70));

  let supabase = null;
  if (!opts.dryRun) {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('[CSJ Error] Faltan variables de entorno SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(1);
    }
    try {
      const parsedUrl = new URL(SUPABASE_URL);
      console.log(`[CSJ] Conectando a Supabase host: ${parsedUrl.host}`);
    } catch {
      console.error('[CSJ Error] SUPABASE_URL inválida.');
      process.exit(1);
    }
    supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    console.log('[CSJ] MODO DRY-RUN: No se modificará Supabase ni se descargarán documentos.');
  }

  initializeDocumentStore();
  console.log(`[CSJ] Almacén local de documentos: ${DOCUMENTOS_DIR}`);

  process.on('SIGINT', () => {
    console.warn('\n[CSJ] Interrupción manual (SIGINT). Persistiendo progreso...');
    shutdown(130);
  });

  // Definición del universo de años
  let targetYears = [];
  if (opts.years && opts.years.length > 0) {
    targetYears = opts.years.sort((a, b) => a - b);
  } else {
    const from = opts.fromYear || START_YEAR;
    const to = opts.toYear || END_YEAR;
    for (let y = from; y <= to; y += 1) {
      targetYears.push(y);
    }
  }

  const batches = buildBatches(targetYears, opts.ramp);
  telemetry.state.totalBatches = batches.length;
  console.log(`[CSJ] Plan de ingesta: ${targetYears.length} años en ${batches.length} lote(s).`);
  batches.forEach((b, idx) => {
    console.log(`  - Lote ${idx + 1}: [${b.join(', ')}] (${b.length} años)`);
  });
  console.log('');

  const session = new CsjSession();
  await session.init();

  startTelemetry();

  const globalStats = {};
  for (const y of targetYears) {
    globalStats[y] = { total: 0, ok: 0, sinTexto: 0, error: 0, saltados: 0 };
  }

  let consecutiveNetworkErrors = 0;
  const startTime = Date.now();

  for (let bIndex = 0; bIndex < batches.length; bIndex += 1) {
    const batchYears = batches[bIndex];
    telemetry.state.batch = bIndex + 1;
    telemetry.state.phase = 'batch';
    console.log(`\n>>> INICIANDO LOTE ${bIndex + 1}/${batches.length}: Años [${batchYears.join(', ')}]`);

    let existingMap = new Map();
    if (!opts.dryRun) {
      existingMap = await fetchExistingCodes(supabase, batchYears);
      console.log(`[CSJ] Documentos ya existentes en Supabase para este lote: ${existingMap.size}`);
    }

    let batchAttemptedDocs = 0;
    let batchErrors = 0;
    let cooldownTriggeredInBatch = 0;
    let limitReachedInBatch = false;

    for (let yIndex = 0; yIndex < batchYears.length; yIndex += 1) {
      const year = batchYears[yIndex];
      const yStats = globalStats[year];
      telemetry.state.year = year;
      telemetry.state.phase = 'year';

      console.log(`\n--- Consultando Año ${year} ---`);
      try {
        await session.setYearSearchCriteria(year);
      } catch (err) {
        if (err.status === 403 || err.status === 429) {
          if (cooldownTriggeredInBatch >= 1) {
            console.error('[CSJ] Segundo bloqueo detectado en el mismo lote. Deteniendo ejecución.');
            console.log(`[CSJ] Para reanudar: node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --from-year ${year}`);
            shutdown(2);
          }
          cooldownTriggeredInBatch += 1;
          await executeCooldown(opts.cooldownMin);
          await session.init();
          try {
            await session.setYearSearchCriteria(year);
          } catch (retryErr) {
            if (retryErr.status === 403 || retryErr.status === 429) {
              console.error('[CSJ] Bloqueo persistente tras el cooldown al configurar la búsqueda. Deteniendo ejecución.');
              console.log(`[CSJ] Para reanudar: node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --from-year ${year}`);
              shutdown(2);
            }
            console.error(`[CSJ Error] No se pudo configurar búsqueda para el año ${year} tras el cooldown: ${retryErr.message}`);
            continue;
          }
        } else {
          console.error(`[CSJ Error] No se pudo configurar búsqueda para el año ${year}: ${err.message}`);
          continue;
        }
      }

      // Obtener primer página para total
      let firstPage;
      try {
        firstPage = await session.getDataPage(0, DEFAULT_PAGE_LENGTH, 1);
      } catch (err) {
        console.error(`[CSJ Error] Error al obtener listado inicial para ${year}: ${err.message}`);
        continue;
      }

      const recordsTotal = firstPage.recordsFiltered ?? firstPage.recordsTotal ?? 0;
      yStats.total = recordsTotal;
      telemetry.expected += recordsTotal;
      console.log(`[CSJ] Año ${year}: ${recordsTotal} resoluciones laborales encontradas.`);

      if (recordsTotal === 0) {
        continue;
      }

      const allRows = [...(Array.isArray(firstPage.data) ? firstPage.data : [])];
      let start = DEFAULT_PAGE_LENGTH;

      while (start < recordsTotal) {
        await sleep(400); // Pausa respetuosa entre páginas de listado
        let page;
        try {
          page = await session.getDataPage(start, DEFAULT_PAGE_LENGTH, Math.floor(start / DEFAULT_PAGE_LENGTH) + 1);
        } catch (err) {
          console.error(`[CSJ] Error obteniendo página start=${start} año ${year}: ${err.message}`);
          break;
        }

        const items = Array.isArray(page.data) ? page.data : [];
        if (items.length === 0) break;
        allRows.push(...items);
        start += DEFAULT_PAGE_LENGTH;
      }

      if (opts.dryRun) {
        console.log(`[DRY-RUN] Año ${year}: listados ${allRows.length} registros (sin procesar documentos/DB).`);
        continue;
      }

      // Procesamiento de documentos del año
      telemetry.state.phase = 'documents';
      for (let rIndex = 0; rIndex < allRows.length; rIndex += 1) {
        if (opts.limit && batchAttemptedDocs >= opts.limit) {
          console.log(`[CSJ] Límite por lote alcanzado (--limit ${opts.limit}).`);
          limitReachedInBatch = true;
          break;
        }

        const row = allRows[rIndex];
        const codigo = row?.CodigoJurisprudencia;

        if (codigo === undefined || codigo === null) {
          console.warn(`[CSJ] Fila ${rIndex + 1}/${allRows.length} del año ${year} sin CodigoJurisprudencia; se omite.`);
          continue;
        }

        telemetry.state.codigo = codigo;
        const prevEstado = existingMap.get(codigo) ?? null;

        // Verificación de idempotencia en Supabase
        if (!opts.force && (prevEstado === 'ok' || prevEstado === 'sin_texto')) {
          yStats.saltados += 1;
          telemetry.saltados += 1;
          telemetry.processed += 1;
          continue;
        }

        batchAttemptedDocs += 1;
        telemetry.processed += 1;
        const logPrefix = `[${year} ${rIndex + 1}/${allRows.length}] #${codigo}`;

        let textoFinal = '';
        let estadoFinal = 'ok';
        let metadataExtra = {};

        // 1. Verificar si viene TextoResolucion utilizable directamente (>= 1500 chars)
        const directText = cleanText(row.TextoResolucion || '');
        if (directText.length >= UMBRAL_TEXTO_CHARS) {
          textoFinal = directText;
          estadoFinal = 'ok';
          consecutiveNetworkErrors = 0;
          console.log(`${logPrefix} ok (directo) ${(textoFinal.length / 1000).toFixed(1)}k chars`);
        } else {
          // 2. Descargar (o reutilizar copia local), guardar y extraer polimórficamente
          await sleepWithJitter(opts.delayMs);

          try {
            let documentBuffer;
            let documentExt;

            const existing = opts.force ? null : findExistingDocument(year, codigo);
            if (existing) {
              documentBuffer = fs.readFileSync(existing.path);
              documentExt = existing.ext;
              console.log(`${logPrefix} reutiliza copia local ${path.basename(existing.path)}`);
            } else {
              const download = await retryOperation(async () => {
                return await session.downloadDocument(codigo);
              });
              documentBuffer = download.buffer;
              documentExt = detectDocumentFormat(download.buffer, download.headers);
              const savedPath = saveDocumentToDisk(year, codigo, download.buffer, documentExt);
              telemetry.state.lastSavedFile = savedPath;
            }

            consecutiveNetworkErrors = 0;
            const extracted = await extractWithFallback(documentBuffer, documentExt);
            const candidateText = extracted.text.length > 0 ? extracted.text : directText;

            if (candidateText.length >= UMBRAL_TEXTO_CHARS) {
              textoFinal = candidateText;
              estadoFinal = 'ok';
              console.log(`${logPrefix} ok (${extracted.format}) ${(textoFinal.length / 1000).toFixed(1)}k chars`);
            } else {
              textoFinal = candidateText;
              estadoFinal = 'sin_texto';
              console.log(`${logPrefix} sin_texto (${extracted.format}, ${textoFinal.length} chars)`);
            }
          } catch (err) {
            consecutiveNetworkErrors += 1;
            batchErrors += 1;
            yStats.error += 1;
            telemetry.error += 1;

            if (err.status === 403 || err.status === 429) {
              if (cooldownTriggeredInBatch >= 1) {
                console.error(`\n[CSJ] Bloqueo persistente durante descarga del doc #${codigo}. Abortando lote.`);
                console.log(`[CSJ] Para reanudar: node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --from-year ${year}`);
                shutdown(2);
              }
              cooldownTriggeredInBatch += 1;
              await executeCooldown(opts.cooldownMin);
              await session.init();
              rIndex -= 1; // Reintentar este mismo documento
              batchAttemptedDocs -= 1;
              batchErrors -= 1;
              yStats.error -= 1;
              telemetry.error -= 1;
              telemetry.processed -= 1;
              continue;
            }

            if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
              console.error(`\n[CSJ] ${MAX_CONSECUTIVE_NETWORK_ERRORS} errores de red consecutivos. Deteniendo ejecución para evitar bloqueo.`);
              console.log(`[CSJ] Para reanudar: node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --from-year ${year}`);
              shutdown(2);
            }

            textoFinal = directText;
            estadoFinal = 'error';
            metadataExtra = { error: String(err.message || err).slice(0, 300) };
            console.warn(`${logPrefix} error: ${err.message}`);
          }
        }

        // No degradar una fila que ya tenía texto válido ('ok') almacenado
        if (prevEstado === 'ok' && estadoFinal !== 'ok') {
          console.warn(`${logPrefix} ${estadoFinal}: se preserva el texto 'ok' previamente almacenado (no se sobrescribe).`);
          continue;
        }

        if (estadoFinal === 'ok') {
          yStats.ok += 1;
          telemetry.ok += 1;
        } else if (estadoFinal === 'sin_texto') {
          yStats.sinTexto += 1;
          telemetry.sinTexto += 1;
        }

        // Upsert en Supabase
        const dbRecord = mapRowToRecord(row, year, textoFinal, estadoFinal, metadataExtra);
        const { error: upsertErr } = await supabase
          .from('jurisprudencia_csj')
          .upsert(dbRecord, { onConflict: 'codigo_csj' });

        if (upsertErr) {
          if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('does not exist')) {
            console.error('\n[CSJ Error] La tabla `jurisprudencia_csj` no existe en Supabase.');
            console.error('Pegá primero supabase/schema_laborapy_jurisprudencia_csj.sql en el SQL Editor de Supabase.\n');
            process.exit(1);
          }
          console.error(`[CSJ Error DB] Falló upsert doc #${codigo}: ${upsertErr.message}`);
          batchErrors += 1;
          if (estadoFinal === 'ok') {
            yStats.ok -= 1;
            yStats.error += 1;
            telemetry.ok -= 1;
            telemetry.error += 1;
          } else if (estadoFinal === 'sin_texto') {
            yStats.sinTexto -= 1;
            yStats.error += 1;
            telemetry.sinTexto -= 1;
            telemetry.error += 1;
          }
          continue;
        }

        existingMap.set(codigo, estadoFinal);
      }

      // Límite por lote alcanzado: no seguir consultando años restantes
      if (limitReachedInBatch) break;

      // Pausa entre años del mismo lote
      if (yIndex < batchYears.length - 1) {
        await sleep(2000);
      }
    }

    if (opts.dryRun) {
      console.log(`[DRY-RUN] Finalizado Lote ${bIndex + 1}.`);
      continue;
    }

    // Validación de criterios para avanzar de lote
    const maxAllowedErrors = Math.max(2, Math.floor(batchAttemptedDocs * 0.05));
    if (batchAttemptedDocs > 0 && batchErrors > maxAllowedErrors) {
      console.error(`\n[CSJ] Criterio de avance NO cumplido en Lote ${bIndex + 1}: ${batchErrors} errores exceden el límite permitido (${maxAllowedErrors}).`);
      const nextYear = batchYears[batchYears.length - 1];
      console.log(`[CSJ] Para reanudar: node --env-file=.env scripts/ingest_jurisprudencia_csj.mjs --from-year ${nextYear}`);
      shutdown(2);
    }

    // Pausa entre lotes progresivos si quedan más
    if (bIndex < batches.length - 1) {
      console.log(`\n[CSJ] Lote ${bIndex + 1} completado exitosamente. Pausa de enfriamiento entre lotes: ${opts.pauseMin} min...`);
      const pauseSeconds = Math.round(opts.pauseMin * 60);
      for (let s = pauseSeconds; s > 0; s -= 30) {
        const m = Math.ceil(s / 60);
        console.log(`[CSJ] Próximo lote en aprox. ${m} min...`);
        await sleep(Math.min(30000, s * 1000));
      }
    }
  }

  // Resumen final acumulado
  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const durationMin = (durationSec / 60).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log(' RESUMEN DE INGESTA JURISPRUDENCIA CSJ');
  console.log('='.repeat(70));
  console.log('Año   | Total CSJ | OK     | Sin Texto | Error | Saltados');
  console.log('------+-----------+--------+-----------+-------+---------');

  let sumTotal = 0;
  let sumOk = 0;
  let sumSinTexto = 0;
  let sumError = 0;
  let sumSaltados = 0;

  for (const y of targetYears) {
    const s = globalStats[y];
    sumTotal += s.total;
    sumOk += s.ok;
    sumSinTexto += s.sinTexto;
    sumError += s.error;
    sumSaltados += s.saltados;
    const rowStr = [
      String(y).padEnd(5),
      String(s.total).padStart(9),
      String(s.ok).padStart(6),
      String(s.sinTexto).padStart(9),
      String(s.error).padStart(5),
      String(s.saltados).padStart(8),
    ].join(' | ');
    console.log(rowStr);
  }

  console.log('------+-----------+--------+-----------+-------+---------');
  const totStr = [
    'TOTAL'.padEnd(5),
    String(sumTotal).padStart(9),
    String(sumOk).padStart(6),
    String(sumSinTexto).padStart(9),
    String(sumError).padStart(5),
    String(sumSaltados).padStart(8),
  ].join(' | ');
  console.log(totStr);
  console.log(`\nDuración total: ${durationMin} minutos (${durationSec} segundos).`);
  console.log('Ingesta finalizada con éxito.');

  telemetry.state.phase = 'done';
  shutdown(0);
}

main().catch((fatal) => {
  console.error('[CSJ Fatal Error]', fatal);
  stopTelemetry();
  persistProgress();
  process.exit(1);
});
