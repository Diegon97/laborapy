import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { embed } from "../lib/embedding";

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testRag() {
  const query = "Me despidieron estando embarazada de 4 meses, ¿qué me corresponde?";
  console.log(`\n🔍 Probando motor RAG...`);
  console.log(`Pregunta: "${query}"\n`);
  
  try {
    process.stdout.write("1️⃣  Calculando embedding de la pregunta vía Cloudflare... ");
    const [queryEmbedding] = await embed([query]);
    console.log("✅ OK");

    process.stdout.write("2️⃣  Buscando en Supabase (tobi_knowledge_base)... ");
    const { data, error } = await supabase.rpc("match_tobi_knowledge", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5, // umbral de similitud mínima
      match_count: 3        // traer los 3 mejores resultados
    });

    if (error) throw error;
    console.log("✅ OK\n");

    if (!data || data.length === 0) {
      console.log("⚠️ No se encontraron resultados que superen el umbral de similitud.");
      return;
    }

    console.log("🏆 TOP 3 RESULTADOS ENCONTRADOS:\n");
    data.forEach((match: any, index: number) => {
      console.log(`--- Resultado #${index + 1} (Similitud: ${(match.similarity * 100).toFixed(2)}%) ---`);
      console.log(`Fuente: ${match.metadata?.fuente} | Origen: ${match.metadata?.origen || 'CSJ'}`);
      console.log(`${match.content}\n`);
    });

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

testRag();
