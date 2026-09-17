/**
 * BACKFILL DE EMBEDDINGS — LABORAPY
 *
 * Rellena la columna `embedding vector(768)` de public.jurisprudencia_multimedia
 * en las filas con `embedding IS NULL`, usando Gemini `text-embedding-004`.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL="https://<proyecto>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
 *   $env:GEMINI_API_KEY="<google-ai-studio-key>"
 *   node scripts/backfill_jurisprudencia_embeddings.mjs [--limit N] [--dry-run]
 *
 * Requisitos:
 *   - Extensión pgvector habilitada y columna embedding vector(768).
 *   - Si falta SUPABASE_URL se usa VITE_SUPABASE_URL; si falta GEMINI_API_KEY se usa VITE_GEMINI_API_KEY.
 *   - NUNCA se hardcodean credenciales: solo se leen de variables de entorno (fail-fast).
 *
 * Características: idempotente (filtra embedding IS NULL), reintentos 429/red, PATCH minimal.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();

const EMBED_MODEL = 'text-embedding-004';
const EMBED_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const EMBED_DIMENSIONS = 768;
const EXTRACTO_MAX_CHARS = 1500;
const CONTENT_MAX_CHARS = 6000;
const PAGE_SIZE = 100;
const SLEEP_MS = 300;
const MAX_RETRIES = 4;
const EMBED_TIMEOUT_MS = 20000;

const USAGE = [
  'Uso (PowerShell):',
  '  node scripts/backfill_jurisprudencia_embeddings.mjs [--limit N] [--dry-run] [--help]',
  '  Variables: SUPABASE_URL (o VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY (o VITE_GEMINI_API_KEY).',
].join('\n');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const opts = { limit: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const raw = arg === '--limit' ? argv[i + 1] : arg.slice('--limit='.length);
      if (arg === '--limit') i += 1;
      const value = Number.parseInt(raw, 10);
      if (!Number.isInteger(value) || value <= 0) {
        console.error('[Backfill] --limit requiere un entero positivo.');
        process.exit(1);
      }
      opts.limit = value;
    } else {
      console.error(`[Backfill] Argumento desconocido: ${arg}`);
      process.exit(1);
    }
  }
  return opts;
}

function buildRowContent(row) {
  const articulos = Array.isArray(row.articulos_citados) ? row.articulos_citados.join(', ') : '';
  const extracto =
    typeof row.audio_transcripcion === 'string' ? row.audio_transcripcion.slice(0, EXTRACTO_MAX_CHARS) : '';
  const parts = [
    row.titulo_tema ? `Título: ${row.titulo_tema}` : '',
    row.caso_abuso_detectado ? `Caso: ${row.caso_abuso_detectado}` : '',
    row.criterio_practico ? `Criterio: ${row.criterio_practico}` : '',
    row.fundamento_juridico ? `Fundamento: ${row.fundamento_juridico}` : '',
    articulos ? `Artículos: ${articulos}` : '',
    extracto ? `Extracto: ${extracto}` : '',
  ].filter(Boolean);
  return parts.join('\n').slice(0, CONTENT_MAX_CHARS);
}

async function fetchPendingRows() {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const select =
    'id,titulo_tema,caso_abuso_detectado,criterio_practico,fundamento_juridico,articulos_citados,audio_transcripcion';
  const rows = [];
  // Traer TODO antes de escribir: el filtro embedding=is.null permanece estable durante el paginado offset.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${SUPABASE_URL}/rest/v1/jurisprudencia_multimedia?select=${select}&embedding=is.null&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase select HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error('Supabase select: la respuesta no es un arreglo');
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function embedText(text) {
  const body = JSON.stringify({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
  });
  let lastError = new Error('Embedding falló sin detalle');
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
    try {
      const res = await fetch(`${EMBED_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (res.status === 429) {
        lastError = new Error('Gemini 429 (rate limit)');
        await sleep(4000 * attempt);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const error = new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`);
        error.noRetry = true;
        throw error;
      }

      const data = await res.json();
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBED_DIMENSIONS) {
        const error = new Error(
          `Embedding con dimensiones inválidas: ${Array.isArray(values) ? values.length : 'n/a'} (esperado ${EMBED_DIMENSIONS})`,
        );
        error.noRetry = true;
        throw error;
      }
      return values;
    } catch (error) {
      if (error?.noRetry) throw error;
      lastError = error;
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(1500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function updateEmbedding(id, values) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/jurisprudencia_multimedia?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ embedding: values }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase update HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  if (!SUPABASE_URL) {
    console.error('[Backfill] Falta SUPABASE_URL (o VITE_SUPABASE_URL). Abortando.');
    process.exit(1);
  }
  if (!SERVICE_KEY) {
    console.error('[Backfill] Falta SUPABASE_SERVICE_ROLE_KEY. Abortando.');
    process.exit(1);
  }
  if (!opts.dryRun && !GEMINI_API_KEY) {
    console.error('[Backfill] Falta GEMINI_API_KEY (o VITE_GEMINI_API_KEY). Abortando.');
    process.exit(1);
  }

  console.log(`[Backfill] Supabase: ${SUPABASE_URL}${opts.dryRun ? ' · modo dry-run' : ''}`);
  const pending = await fetchPendingRows();
  const rows = opts.limit ? pending.slice(0, opts.limit) : pending;
  console.log(`[Backfill] Pendientes (embedding IS NULL): ${pending.length} | A procesar: ${rows.length}`);

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  const failedIds = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.id) {
      skipped += 1;
      console.warn(`[SKIP] Fila sin id en posición ${i}`);
      continue;
    }
    const content = buildRowContent(row);
    if (!content) {
      skipped += 1;
      console.warn(`[SKIP] ${row.id}: contenido vacío`);
      continue;
    }

    try {
      if (opts.dryRun) {
        console.log(`[DRY] ${row.id} (${content.length} chars): ${content.replace(/\n/g, ' | ').slice(0, 120)}...`);
        ok += 1;
      } else {
        const values = await embedText(content);
        await updateEmbedding(row.id, values);
        ok += 1;
        if ((i + 1) % 10 === 0 || i === rows.length - 1) {
          console.log(`[Backfill] Progreso: ${i + 1}/${rows.length} (ok=${ok}, fail=${failed})`);
        }
        await sleep(SLEEP_MS);
      }
    } catch (error) {
      failed += 1;
      failedIds.push(row.id);
      console.error(`[FAIL] ${row.id}: ${error?.message ?? error}`);
    }
  }

  console.log(`\n[Backfill] Resumen → total=${rows.length} ok=${ok} fallidas=${failed} saltadas=${skipped}`);
  if (failedIds.length > 0) {
    console.log(`[Backfill] IDs fallidos (máx 10): ${failedIds.slice(0, 10).join(', ')}`);
  }
  if (!opts.dryRun) process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(`[Backfill] Error fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
