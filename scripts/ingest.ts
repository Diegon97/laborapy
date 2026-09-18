import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { embed } from "../lib/embedding";

// Carga tolerante de .env.local según el directorio de ejecución
const envPaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "calculadora-rrhh-py", ".env.local"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Faltan credenciales de Supabase (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BATCH = 10;
const DELAY_MS = 1000;
const ERROR_RETRY_DELAY_MS = 5000;
const MAX_RETRIES_PER_BATCH = 3;

interface UnifiedChunk {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

interface CsjRawItem {
  id?: string;
  content?: string;
  texto?: string;
  metadata?: Record<string, any>;
}

interface AudioRawItem {
  instruction: string;
  output: string;
  system?: string;
  source?: string;
}

function resolvePath(relativeFile: string): string {
  const candidates = [
    path.resolve(process.cwd(), relativeFile),
    path.resolve(process.cwd(), "calculadora-rrhh-py", relativeFile),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), relativeFile);
}

function readJsonFile<T>(filePath: string, label: string): T {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado en ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err: any) {
    throw new Error(`Error de fs/parse al leer dataset ${label} (${filePath}): ${err?.message || err}`);
  }
}

function generateSha256(text: string): string {
  try {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
  } catch (err: any) {
    throw new Error(`Error de crypto al calcular SHA-256: ${err?.message || err}`);
  }
}

async function run() {
  console.log("📂 Localizando datasets en ./datasets...");
  const csjPath = resolvePath("./datasets/rag_chunks_csj.json");
  const audiosPath = resolvePath("./datasets/tobi_golden_audios.json");

  const csjRaw = readJsonFile<CsjRawItem[]>(csjPath, "CSJ");
  const audiosRaw = readJsonFile<AudioRawItem[]>(audiosPath, "Tobi_Audios");

  console.log(`📦 Chunks CSJ leídos: ${csjRaw.length}`);
  console.log(`🎙️ Audios leídos: ${audiosRaw.length}`);

  const csjMapped: UnifiedChunk[] = csjRaw.map((item, index) => {
    const content = (item.content || item.texto || "").trim();
    if (!content) {
      throw new Error(`Chunk CSJ en posición ${index} carece de content/texto.`);
    }
    const id = item.id && item.id.trim().length > 0 ? item.id.trim() : generateSha256(content);
    return {
      id,
      content,
      metadata: item.metadata || { fuente: "CSJ" },
    };
  });

  const audiosMapped: UnifiedChunk[] = audiosRaw.map((item, index) => {
    const instruction = (item.instruction || "").trim();
    const output = (item.output || "").trim();
    if (!instruction && !output) {
      throw new Error(`Item de Audio en posición ${index} carece de instruction y output.`);
    }
    const content = `Pregunta: ${instruction}\nRespuesta: ${output}`;
    const id = generateSha256(content);
    return {
      id,
      content,
      metadata: {
        fuente: "Tobi_Audios",
        origen: item.source || "",
      },
    };
  });

  const unifiedChunks: UnifiedChunk[] = [...csjMapped, ...audiosMapped];
  const total = unifiedChunks.length;

  console.log(`🚀 Iniciando Ingesta Unificada de ${total} registros vía Cloudflare Workers AI...`);

  let successCount = 0;

  for (let i = 0; i < total; i += BATCH) {
    const slice = unifiedChunks.slice(i, i + BATCH);
    const rangeLabel = `[Batch ${i + 1} a ${Math.min(i + BATCH, total)} de ${total}]`;
    let batchSuccess = false;
    let attempt = 0;

    while (!batchSuccess && attempt < MAX_RETRIES_PER_BATCH) {
      attempt++;
      const attemptInfo = attempt > 1 ? ` (Reintento ${attempt}/${MAX_RETRIES_PER_BATCH})` : "";
      process.stdout.write(`${rangeLabel}${attemptInfo} Embebiendo... `);

      try {
        const texts = slice.map((c) => c.content);
        const vecs = await embed(texts);

        const { error } = await supabase.from("tobi_knowledge_base").upsert(
          slice.map((c, j) => ({
            id: c.id,
            content: c.content,
            metadata: c.metadata,
            embedding: vecs[j],
          }))
        );

        if (error) throw error;

        console.log("✅ OK");
        successCount += slice.length;
        batchSuccess = true;

        if (i + BATCH < total) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
        if (attempt < MAX_RETRIES_PER_BATCH) {
          console.log(`⏳ Esperando ${ERROR_RETRY_DELAY_MS}ms por rate-limit o transitorio antes de reintentar...`);
          await new Promise((r) => setTimeout(r, ERROR_RETRY_DELAY_MS));
        } else {
          console.error(`🚨 Fallo definitivo en el lote tras ${MAX_RETRIES_PER_BATCH} intentos. Continuando con el siguiente lote.`);
        }
      }
    }
  }

  console.log(`\n🎉 Ingesta finalizada. ${successCount}/${total} registros procesados exitosamente.`);
}

run().catch((err) => {
  console.error(`💥 Error fatal durante la ejecución de ingesta: ${err?.message || err}`);
  process.exit(1);
});