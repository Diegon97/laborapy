import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('datasets/rag_chunks_csj.json');
const backupPath = path.resolve('datasets/rag_chunks_csj.json.bak');

const raw = fs.readFileSync(filePath, 'utf8');
const chunks = JSON.parse(raw);

if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, raw, 'utf8');
  console.log(`✅ Respaldo creado en ${backupPath}`);
}

console.log(`Procesando y enriqueciendo ${chunks.length} chunks de jurisprudencia CSJ...`);

let enrichedCount = 0;
const seenIds = new Set();

const enrichedChunks = chunks.map((chunk, idx) => {
  if (seenIds.has(chunk.id)) {
    console.warn(`⚠️ ID duplicado detectado: ${chunk.id}`);
  }
  seenIds.add(chunk.id);

  const content = chunk.content.trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  // Extraer resolución (ej. A. y S. N° 135/1995, A. y S. N° 199/1995)
  const resMatch = content.match(/(?:A\.\s*y\s*S\.|Acuerdo\s+y\s+Sentencia|Resoluci[óo]n)\s+(?:N[°ºo\.]*\s*)?(\d+)(?:\s*[\/-]\s*(\d{4}))?/i);
  let resolucion = null;
  let anio = null;
  if (resMatch) {
    const num = resMatch[1];
    anio = resMatch[2] ? parseInt(resMatch[2], 10) : null;
    resolucion = `A. y S. N° ${num}${anio ? '/' + anio : ''}`;
  }

  // Si no se extrajo el año de la resolución, buscar año explícito (1980-2026)
  if (!anio) {
    const yearMatch = content.match(/\b(19[89]\d|20[0-2]\d)\b/);
    if (yearMatch) {
      anio = parseInt(yearMatch[1], 10);
    }
  }

  // Extraer leyes o artículos citados
  const articulosCitados = new Set();
  const artMatches = content.matchAll(/(?:Art[íi]culos?|Arts?\.)\s*(\d+)(?:\s*(?:al?|y|,)\s*(\d+))?(?:\s*(?:del?\s+C[óo]digo\s+del?\s+Trabajo|C\.?T\.?|CPL|Ley\s*N?[°ºo]?\s*\d+[\/\d]*))?/gi);
  for (const m of artMatches) {
    const artText = m[0].replace(/\s+/g, ' ').trim();
    if (artText.length < 50) {
      articulosCitados.add(artText);
    }
  }

  const leyMatches = content.matchAll(/Ley\s*N?[°ºo]?\s*\d+(?:\/\d+)?/gi);
  for (const m of leyMatches) {
    articulosCitados.add(m[0].trim());
  }

  const existingMeta = chunk.metadata || {};

  const metadata = {
    fuente: 'CSJ',
    sala: 'Laboral',
    instancia: 'Corte Suprema de Justicia',
    jurisdiccion: 'Paraguay',
    tipo: existingMeta.tipo || 'jurisprudencia_dictamen',
    index_origen: existingMeta.index_origen !== undefined ? existingMeta.index_origen : idx,
    ...(resolucion ? { resolucion } : {}),
    ...(anio ? { anio } : {}),
    articulos_citados: Array.from(articulosCitados),
  };

  if (resolucion || articulosCitados.size > 0) enrichedCount++;

  return {
    id: chunk.id,
    content,
    metadata,
  };
});

fs.writeFileSync(filePath, JSON.stringify(enrichedChunks, null, 2), 'utf8');

console.log(`\n🎉 Enriquecimiento finalizado con éxito:`);
console.log(`- Total chunks: ${enrichedChunks.length}`);
console.log(`- Chunks con metadatos específicos detectados: ${enrichedCount}`);
console.log(`- IDs únicos garantizados: ${seenIds.size}/${enrichedChunks.length}`);
console.log(`- Muestra metadata chunk 0:`, JSON.stringify(enrichedChunks[0].metadata, null, 2));
