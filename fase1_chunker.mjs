import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const INPUT_FILE = './datasets/tobi_golden_csj.json';
const OUTPUT_FILE = './datasets/rag_chunks_csj.json';

function generateId(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function processDataset() {
  console.log(`[Fase 1] Iniciando chunking y limpieza...`);
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: No se encuentra el archivo ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Leídos ${rawData.length} registros del archivo CSJ.`);

  const chunks = [];

  rawData.forEach((item, index) => {
    if (!item.instruction || !item.output) return;

    // Limpiamos espacios y saltos extra
    const instruction = item.instruction.trim();
    const output = item.output.trim();

    // Estructuramos el chunk semántico
    const chunkText = `Consulta Jurídica/Laboral: ${instruction}\nResolución/Dictamen: ${output}`;
    
    chunks.push({
      id: generateId(chunkText),
      content: chunkText,
      metadata: {
        fuente: 'CSJ',
        tipo: 'jurisprudencia_dictamen',
        index_origen: index
      }
    });
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(chunks, null, 2), 'utf8');
  console.log(`[Fase 1] Éxito: Se generaron ${chunks.length} chunks listos para pgvector.`);
  console.log(`Guardados en: ${OUTPUT_FILE}`);
}

processDataset();