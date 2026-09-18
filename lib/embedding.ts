import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
const MODEL = "@cf/google/embeddinggemma-300m";
export const EMBED_DIM = 768;

if (!ACCOUNT_ID || !TOKEN) {
  console.warn("Faltan CF_ACCOUNT_ID o CF_API_TOKEN en el entorno.");
}

const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

// Normalización L2 (vital para vector_cosine_ops en Supabase)
function l2(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export async function embed(texts: string[]): Promise<number[][]> {
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });
  
  if (!r.ok) {
    throw new Error(`Cloudflare API Error ${r.status}: ${await r.text()}`);
  }
  
  const data = await r.json();
  if (!data.success) {
    throw new Error(`Cloudflare AI Error: ${JSON.stringify(data.errors)}`);
  }

  const vecs = data.result.data as number[][];
  
  for (let i = 0; i < vecs.length; i++) {
    const v = vecs[i];
    if (v.length !== EMBED_DIM) {
      throw new Error(`Dimensión incorrecta en el vector ${i}: ${v.length}, esperaba ${EMBED_DIM}`);
    }
  }
  
  return vecs.map(l2);
}

// Fase 2b: Prefijos empíricos
// Tras investigar el modelo embeddinggemma-300m en HF y Workers AI, 
// no exige prefijos duros (como "task: search") obligatoriamente, pero 
// agregar un contexto sutil suele mejorar el clustering.
// Lo definimos sin prefijos disruptivos para el documento, y dejamos 
// la puerta abierta para querys más complejas.
const DOC = (t: string) => t; 
const QRY = (t: string) => t;

export const embedDocuments = (t: string[]) => embed(t.map(DOC));
export const embedQuery = async (t: string) => (await embed([QRY(t)]))[0];
