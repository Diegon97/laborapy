import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Para capataz, cualquier Bearer token o cpa-local funciona, 
// usa tu token habitual de capataz.
const CAPATAZ_TOKEN = "cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8"; 
const CAPATAZ_URL = "http://127.0.0.1:8317"; // El proxy OpenAI de Capataz

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Faltan variables de entorno de Supabase.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const INPUT_FILE = './datasets/rag_chunks_csj.json';

async function getEmbedding(text) {
  // Intentamos pasar la petición nativa de Gemini a través de Capataz
  // Ojo: Dependiendo de la versión de CLIProxyAPI, el endpoint de embeddings puede requerir
  // mapeo específico o devolver body vacío.
  const url = `${CAPATAZ_URL}/v1beta/models/text-embedding-004:embedContent`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CAPATAZ_TOKEN}`
    },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] }
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error en proxy Capataz: ${res.status} ${err}`);
  }
  
  const data = await res.json().catch(() => null);
  
  if (!data) {
    throw new Error("Capataz devolvió un cuerpo vacío. Es probable que CLIProxyAPI no soporte la ruta de embeddings nativa de Gemini.");
  }

  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error("El embedding no tiene 768 dimensiones o falló la respuesta.");
  }
  return values;
}

async function run() {
  const chunks = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`🚀 Iniciando Ingesta de ${chunks.length} dictámenes vía CAPATAZ (Puerto 8317)...`);
  
  let successCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      process.stdout.write(`[${i + 1}/${chunks.length}] Generando vector... `);
      const embedding = await getEmbedding(chunk.content);
      
      const { error } = await supabase
        .from('tobi_knowledge_base')
        .upsert({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embedding
        });
        
      if (error) {
        console.log(`❌ Error DB: ${error.message}`);
      } else {
        console.log(`✅ OK`);
        successCount++;
      }
      
      // Respetar latencia de Capataz
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`❌ Error API: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`\n🎉 Ingesta finalizada. ${successCount}/${chunks.length} exitosos.`);
}

run();