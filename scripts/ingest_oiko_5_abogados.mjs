/**
 * INGESTA RAG — DATASET 5 ABOGADOS OIKO FINAL REVISIÓN (465 CASOS)
 * Ingesta de conocimiento laboral pericial paraguayo en public.tobi_knowledge_base
 * Embeddings: Cloudflare Workers AI (@cf/google/embeddinggemma-300m, 768 dims)
 * L2 Normalized para búsqueda por similitud de coseno en pgvector
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan credenciales de Supabase en .env.local');
  process.exit(1);
}

if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error('❌ Faltan credenciales de Cloudflare Workers AI (CF_ACCOUNT_ID / CF_API_TOKEN) en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const CF_MODEL = '@cf/google/embeddinggemma-300m';
const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
const EMBED_DIM = 768;

function l2(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

async function getEmbeddings(texts) {
  const res = await fetch(CF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare API HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Cloudflare AI Error: ${JSON.stringify(data.errors)}`);
  }

  const vecs = data.result.data;
  for (let i = 0; i < vecs.length; i++) {
    if (vecs[i].length !== EMBED_DIM) {
      throw new Error(`Vector ${i} tiene dimensión ${vecs[i].length}, se esperaba ${EMBED_DIM}`);
    }
  }

  return vecs.map(l2);
}

async function run() {
  const datasetPath = path.resolve(__dirname, '../datasets/oiko_465_rag_ready.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`❌ No existe el dataset en ${datasetPath}`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const total = cases.length;
  console.log(`\n======================================================`);
  console.log(`🚀 INGESTA RAG TOBI AI — DATASET 5 ABOGADOS OIKO (${total} CASOS)`);
  console.log(`======================================================`);
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🤖 Modelo Embeddings: ${CF_MODEL} (${EMBED_DIM} dims)`);
  console.log(`📚 Casos totales a procesar: ${total}`);

  const BATCH_SIZE = 10;
  const DELAY_MS = 350;
  let totalSuccess = 0;
  let totalRetries = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);
    const label = `[Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}] (${i + 1} a ${Math.min(i + BATCH_SIZE, total)})`;

    let success = false;
    let attempts = 0;

    while (!success && attempts < 4) {
      attempts++;
      process.stdout.write(`⏳ ${label} Embebiendo ${batch.length} registros... `);

      try {
        const texts = batch.map((item) => item.content);
        const embeddings = await getEmbeddings(texts);

        const rows = batch.map((item, idx) => ({
          id: item.id,
          content: item.content,
          metadata: item.metadata,
          embedding: embeddings[idx],
        }));

        const { error } = await supabase.from('tobi_knowledge_base').upsert(rows);
        if (error) throw error;

        console.log(`✅ OK (${rows.length} upserted)`);
        totalSuccess += rows.length;
        success = true;

        if (i + BATCH_SIZE < total) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      } catch (err) {
        totalRetries++;
        console.log(`❌ Error: ${err.message}`);
        if (attempts < 4) {
          const waitTime = attempts * 2500;
          console.log(`   ⏳ Reintentando en ${waitTime}ms (intento ${attempts + 1}/4)...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          console.error(`   🚨 Fallo crítico en el lote tras 4 intentos. Continuando.`);
        }
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 INGESTA COMPLETADA EXITOSAMENTE`);
  console.log(`✅ Registros ingresados/actualizados: ${totalSuccess} / ${total}`);
  console.log(`🔁 Reintentos realizados: ${totalRetries}`);
  console.log(`======================================================\n`);
}

run().catch((err) => {
  console.error('💥 Error fatal en ingesta:', err);
  process.exit(1);
});
