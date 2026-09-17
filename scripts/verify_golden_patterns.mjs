#!/usr/bin/env node
/**
 * VALIDACIÓN DE PATRONES DORADOS — Casos históricamente pendientes del golden set
 * Valida que los 6 casos específicos (SMV-07, JOR-03, JOR-07, FRA-02, DOC-02, LIQ-03)
 * cumplan los patrones exigidos por el evaluador nocturno sobre el campo response.
 * Soporta lectura con reintentos robustos ante escrituras transitorias (mop-up).
 * Salida en texto plano (sin ANSI/emojis) y códigos de salida estándar (0, 1, 2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Definición de la ruta del dataset dorado de manera relativa al script
const DATASET_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'datasets',
  'tobi_gold_dataset_final.jsonl'
);

// Definición de los 6 casos y sus patrones requeridos (regex y descripción textual)
const TARGET_PATTERNS = [
  {
    id: 'SMV-07',
    patterns: [
      { regex: /3\.044\.000/, desc: '/3.044.000/' },
      { regex: /jornada parcial|proporcional/i, desc: '/jornada parcial|proporcional/i (case-insensitive)' }
    ]
  },
  {
    id: 'JOR-03',
    patterns: [
      { regex: /(?:7[.,]5|7\s*horas\s*y\s*media|45\s*horas)/i, desc: '/(?:7[,.]5|7\\s*horas\\s*y\\s*media|45\\s*horas)/i' }
    ]
  },
  {
    id: 'JOR-07',
    patterns: [
      { regex: /(?:7[.,]5|7\s*horas\s*y\s*media)/i, desc: '/(?:7[,.]5|7\\s*horas\\s*y\\s*media)/i' }
    ]
  },
  {
    id: 'FRA-02',
    patterns: [
      { regex: /Art(?:ículo|\.)?\s*19/i, desc: '/Art(?:ículo|\\.)?\\s*19/i' },
      { regex: /(?:renuncia forzada|despido encubierto|primac[ií]a)/i, desc: '/(?:renuncia forzada|despido encubierto|primac[ií]a)/i' }
    ]
  },
  {
    id: 'DOC-02',
    patterns: [
      { regex: /:::documento_action/, desc: '/:::documento_action/' },
      { regex: /"tipo"/, desc: '/"tipo"/' }
    ]
  },
  {
    id: 'LIQ-03',
    patterns: [
      { regex: /:::liquidacion_action/, desc: '/:::liquidacion_action/' },
      { regex: /:::/, desc: '/:::/' }
    ]
  }
];

// Función de utilidad para esperar milisegundos
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lee y parsea el archivo JSONL con reintentos transitorios (hasta 4 intentos, 300ms de espera).
 * Tolera ENOENT y errores de JSON.parse debido al proceso de mop-up.
 */
async function loadDatasetWithRetries() {
  const maxAttempts = 4;
  const delayMs = 300;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!fs.existsSync(DATASET_PATH)) {
        if (attempt < maxAttempts) {
          await sleep(delayMs);
          continue;
        } else {
          return { error: 'ENOENT: Dataset no encontrado tras reintentos' };
        }
      }

      const rawContent = fs.readFileSync(DATASET_PATH, 'utf8');
      const lines = rawContent.split(/\r?\n/);
      const index = new Map();
      let parseError = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          if (item && item.id) {
            index.set(item.id, item);
          }
        } catch (e) {
          parseError = true;
          break;
        }
      }

      if (parseError) {
        if (attempt < maxAttempts) {
          await sleep(delayMs);
          continue;
        } else {
          return { error: 'JSON_PARSE_ERROR: Error al parsear alguna línea del dataset' };
        }
      }

      return { index };
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      } else {
        return { error: `READ_ERROR: ${err.message}` };
      }
    }
  }
  return { error: 'UNKNOWN_READ_ERROR' };
}

async function main() {
  const loadResult = await loadDatasetWithRetries();

  if (loadResult.error) {
    console.error(`ERROR CRITICO DE LECTURA: ${loadResult.error}`);
    process.exit(2);
  }

  const index = loadResult.index;
  let passCount = 0;
  let anyFail = false;

  const resultsTable = [];

  for (const target of TARGET_PATTERNS) {
    const entry = index.get(target.id);
    if (!entry) {
      resultsTable.push({
        id: target.id,
        status: 'FAIL',
        reason: 'No encontrado en el dataset'
      });
      anyFail = true;
      continue;
    }

    const responseText = entry.response || '';
    let casePassed = true;
    const failedPatterns = [];

    for (const pat of target.patterns) {
      if (!pat.regex.test(responseText)) {
        casePassed = false;
        failedPatterns.push(pat.desc);
      }
    }

    if (casePassed) {
      passCount++;
      resultsTable.push({
        id: target.id,
        status: 'PASS',
        reason: 'Todos los patrones cumplidos'
      });
    } else {
      anyFail = true;
      resultsTable.push({
        id: target.id,
        status: 'FAIL',
        reason: `Faltan patrones: ${failedPatterns.join(' AND ')}`
      });
    }
  }

  // Impresión en texto plano legible en Windows (sin colores ANSI, sin emojis)
  console.log('REPORTE DE VALIDACION DE PATRONES DORADOS');
  console.log('--------------------------------------------------------------------------------');
  console.log('ID      | ESTADO | DETALLE');
  console.log('--------------------------------------------------------------------------------');
  for (const r of resultsTable) {
    const idPad = r.id.padEnd(7, ' ');
    const statusPad = r.status.padEnd(6, ' ');
    console.log(`${idPad} | ${statusPad} | ${r.reason}`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`RESUMEN FINAL: ${passCount}/6 OK`);

  if (anyFail) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('ERROR NO CAPTURADO:', err);
  process.exit(2);
});
