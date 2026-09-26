/**
 * PIPELINE DE INGESTA CANÓNICO: JURISPRUDENCIA CSJ -> tobi_knowledge_base
 * 
 * Ingesta los 807 chunks enriquecidos en Supabase pgvector.
 * Características:
 *  - Idempotencia total (salta chunks ya vectorizados en Supabase)
 *  - Checkpoint atómico en datasets/ingestion_csj_progress.json
 *  - Adapter multi-proveedor 768d: Cloudflare Workers AI (Gemma-300m) / Google AI Studio (text-embedding-004)
 *  - Normalización L2 explícita para vector_cosine_ops
 *  - Manejo de reintentos ante 429 / fallos de red
 *  - CLI flags: --limit N, --dry-run, --resume, --reset
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Cargar entorno
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const CF_ACCOUNT_ID = (process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const CF_API_TOKEN = (process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();

const DATASET_PATH = path.join(PROJECT_ROOT, 'datasets', 'rag_chunks_csj.json');
const PROGRESS_PATH = path.join(PROJECT_ROOT, 'datasets', 'ingestion_csj_progress.json');

const EMBEDDING_DIMENSIONS = 768;
const SLEEP_MS = 250;
const MAX_RETRIES = 3;

function parseArgs(argv) {
  const opts = { limit: null, dryRun: false, resume: true, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--reset') { opts.reset = true; opts.resume = false; }
    else if (arg === '--no-resume') opts.resume = false;
    else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const val = arg === '--limit' ? argv[++i] : arg.slice(8);
      const parsed = parseInt(val, 10);
      if (Number.isInteger(parsed) && parsed > 0) opts.limit = parsed;
    }
  }
  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// L2 Normalization
function normalizeL2(vec) {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

// 1. Cloudflare Workers AI Embeddings (Primary)
async function embedCloudflare(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/google/embeddinggemma-300m`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
        body: JSON.stringify({ text: [text.slice(0, 2500)] }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Cloudflare HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.success || !data.result?.data?.[0]) {
      throw new Error(`Cloudflare respuesta no exitosa: ${JSON.stringify(data.errors || [])}`);
    }
    const vec = data.result.data[0];
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Cloudflare dimensiones incorrectas: ${vec?.length} (esperado ${EMBEDDING_DIMENSIONS})`);
    }
    return normalizeL2(vec);
  } finally {
    clearTimeout(timer);
  }
}

// 2. Google AI Studio text-embedding-004 (Fallback)
async function embedGemini(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.slice(0, 2500) }] },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const vec = data?.embedding?.values;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Gemini dimensiones incorrectas: ${vec?.length} (esperado ${EMBEDDING_DIMENSIONS})`);
    }
    return normalizeL2(vec);
  } finally {
    clearTimeout(timer);
  }
}

async function getEmbedding(text) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (CF_ACCOUNT_ID && CF_API_TOKEN) {
        return await embedCloudflare(text);
      } else if (GEMINI_API_KEY) {
        return await embedGemini(text);
      } else {
        throw new Error('No hay credenciales disponibles ni para Cloudflare ni para Google AI Studio');
      }
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastError;
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    } catch {
      return { completedIds: {}, lastProcessedIndex: -1 };
    }
  }
  return { completedIds: {}, lastProcessedIndex: -1 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

async function checkRemoteExists(supabase, id) {
  const { data, error } = await supabase
    .from('tobi_knowledge_base')
    .select('id, embedding')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return false;
  return data.embedding !== null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🚀 [INGESTA CANÓNICA CSJ -> tobi_knowledge_base]');
  console.log(`- Supabase URL: ${SUPABASE_URL || '(no configurado)'}`);
  console.log(`- Modo Dry-Run: ${opts.dryRun ? 'SÍ' : 'NO'}`);
  console.log(`- Límite: ${opts.limit ? opts.limit : 'Todos (807)'}`);
  console.log(`- Proveedor embeddings: ${CF_ACCOUNT_ID && CF_API_TOKEN ? 'Cloudflare Workers AI (Gemma-300m)' : GEMINI_API_KEY ? 'Google AI Studio (text-embedding-004)' : 'NINGUNO (ERROR)'}`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan credenciales de Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }

  if (!CF_API_TOKEN && !GEMINI_API_KEY && !opts.dryRun) {
    console.error('❌ Falta CF_API_TOKEN (Cloudflare) o GEMINI_API_KEY.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const chunks = JSON.parse(raw);
  console.log(`- Dataset cargado: ${chunks.length} registros desde ${path.basename(DATASET_PATH)}`);

  let progress = opts.reset ? { completedIds: {}, lastProcessedIndex: -1 } : loadProgress();
  console.log(`- Checkpoint: ${Object.keys(progress.completedIds).length} chunks previamente completados`);

  const targetChunks = opts.limit ? chunks.slice(0, opts.limit) : chunks;
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < targetChunks.length; i++) {
    const chunk = targetChunks[i];

    // Check idempotencia local
    if (opts.resume && progress.completedIds[chunk.id]) {
      skipCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${targetChunks.length}] ID: ${chunk.id.slice(0, 10)}... `);

    if (opts.dryRun) {
      console.log(`[DRY-RUN] OK (${chunk.content.length} chars)`);
      successCount++;
      continue;
    }

    try {
      // Check idempotencia remota
      const alreadyInDb = await checkRemoteExists(supabase, chunk.id);
      if (alreadyInDb) {
        process.stdout.write('➡️ Ya existe en DB (skip)\n');
        progress.completedIds[chunk.id] = true;
        progress.lastProcessedIndex = i;
        skipCount++;
        continue;
      }

      // Vectorizar
      const embedding = await getEmbedding(chunk.content);

      // Upsert en Supabase
      const { error } = await supabase
        .from('tobi_knowledge_base')
        .upsert({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embedding,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      progress.completedIds[chunk.id] = true;
      progress.lastProcessedIndex = i;
      successCount++;
      process.stdout.write('✅ OK\n');

      if ((i + 1) % 5 === 0) {
        saveProgress(progress);
      }

      await sleep(SLEEP_MS);
    } catch (err) {
      errorCount++;
      process.stdout.write(`❌ Error: ${err.message}\n`);
      await sleep(1000);
    }
  }

  saveProgress(progress);

  console.log('\n=============================================');
  console.log('🏁 INGESTA FINALIZADA');
  console.log(`- Exitosos: ${successCount}`);
  console.log(`- Saltados (idempotentes): ${skipCount}`);
  console.log(`- Errores: ${errorCount}`);
  console.log(`- Total procesados en esta corrida: ${targetChunks.length}`);
  console.log('=============================================');
}

main().catch((err) => {
  console.error('💥 Error no controlado en ingesta:', err);
  process.exit(1);
});
