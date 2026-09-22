#!/usr/bin/env node
/**
 * ============================================================================
 * APROBADOR DE APRENDIZAJE DIARIO DE TOBI — LABORAPY
 * ============================================================================
 * Lee los archivos `reports/candidatos_aprendizaje_*.json`, extrae los casos
 * marcados con `"autorizado": "AUTORIZADO"`, los consolida en el dataset
 * oficial `datasets/oiko_465_rag_ready.json` y re-compila el catálogo
 * en memoria (`tobiKnowledgeCatalog.ts`).
 *
 * Uso:
 *   node scripts/approve_daily_learning.mjs
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const reportsDir = path.join(ROOT_DIR, 'reports');
const oikoPath = path.join(ROOT_DIR, 'datasets/oiko_465_rag_ready.json');

function main() {
  console.log('\n======================================================');
  console.log('🚀 APROBADOR DE APRENDIZAJE DIARIO DE TOBI — LABORAPY');
  console.log('======================================================\n');

  if (!fs.existsSync(reportsDir)) {
    console.log('No se encontró el directorio reports/. Ejecutá primero: node scripts/tobi_daily_curator.mjs');
    return;
  }

  const files = fs.readdirSync(reportsDir).filter((f) => f.startsWith('candidatos_aprendizaje_') && f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No hay archivos de candidatos pendientes en reports/.');
    return;
  }

  const oikoDataset = fs.existsSync(oikoPath) ? JSON.parse(fs.readFileSync(oikoPath, 'utf8')) : [];
  const existingIds = new Set(oikoDataset.map((item) => item.id));

  let newlyAuthorized = 0;

  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const item of content) {
      if (item.autorizado === 'AUTORIZADO' && !existingIds.has(item.id)) {
        existingIds.add(item.id);
        newlyAuthorized++;

        const newEntry = {
          id: item.id,
          num: oikoDataset.length + 1,
          tema: `CONSULTA WEB VERIFICADA (${item.articulos.join(', ') || 'Ley 213/93'})`,
          abogado: '@laborapy.oficial',
          video_url: 'https://calculadora-rrhh-py.vercel.app',
          likes: 1,
          consulta: item.consulta,
          articulos: item.articulos || [],
          gemini_eval: `Caso real web auditado: ${item.consulta}`,
          deepseek_eval: item.respuesta_tobi || 'Dictamen legal conforme a Ley 213/93.',
          correccion_diego: item.correccion_diego || 'Criterio oficial validado por Diego Núñez.',
          autorizado: 'AUTORIZADO',
          content: `CASO LABORAL WEB REAL: ${item.consulta}\nARTÍCULOS: ${item.articulos.join(', ')}\nDICTAMEN: ${item.respuesta_tobi}\nCRITERIO DIEGO: ${item.correccion_diego || 'Aprobado'}`,
          metadata: {
            fuente: 'Tobi_Web_Interacciones',
            tipo: 'caso_real_web',
            fecha: item.fecha,
            articulos: item.articulos,
          },
        };

        oikoDataset.push(newEntry);
      }
    }
  }

  if (newlyAuthorized === 0) {
    console.log('ℹ️ No se encontraron casos marcados con "autorizado": "AUTORIZADO".');
    console.log('👉 Editá los archivos en reports/ y cambiá "PENDIENTE" por "AUTORIZADO" en los casos que desees incorporar.');
    return;
  }

  // Guardar dataset actualizado
  fs.writeFileSync(oikoPath, JSON.stringify(oikoDataset, null, 2), 'utf8');
  console.log(`✅ Se agregaron ${newlyAuthorized} nuevos casos autorizados a ${oikoPath}`);

  // Re-compilar catálogo en memoria
  console.log('🔄 Re-compilando catálogo en memoria tobiKnowledgeCatalog.ts...');
  execSync('node scripts/compile_fast_knowledge.mjs', { cwd: ROOT_DIR, stdio: 'inherit' });

  console.log('\n🎉 ¡Tobi incorporó con éxito los nuevos conocimientos autorizados!');
}

main();
