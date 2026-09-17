#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const PROGRESS_FILE = path.join(SCRIPT_DIR, 'deep_improvement_progress.json');
const LOG_FILE = path.join(SCRIPT_DIR, 'fase2_mopup.log');

// Estados de buildProgressDoc() que indican que Fase 2 sigue viva:
// running/waiting (procesando) + consolidating/auditing (cierre y auditorías).
// Solo los estados terminales (completed/interrupted/aborted) permiten relanzar.
const ACTIVE_FASE2_STATUSES = new Set(['running', 'waiting', 'consolidating', 'auditing']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLocalIsoWithOffset(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffsetMin);
  const offH = pad(Math.floor(absOffset / 60));
  const offM = pad(absOffset % 60);
  return `${y}-${m}-${d}T${h}:${min}:${s}${sign}${offH}:${offM}`;
}

function getDefaultWaitUntil() {
  const d = new Date();
  d.setHours(12, 33, 0, 0);
  return d;
}

function getDefaultDeadlineIso() {
  const d = new Date();
  d.setHours(14, 0, 0, 0);
  return formatLocalIsoWithOffset(d);
}

function log(msg) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (err) {
    console.error(`Error escribiendo log en ${LOG_FILE}:`, err && err.message ? err.message : err);
  }
}

function printHelp() {
  console.log(`
Uso: node scripts/fase2_mopup.mjs [opciones]

Opciones:
  --wait-until=ISO     Momento de inicio de evaluación (default: HOY 12:33 local).
  --deadline-iso=ISO   Deadline para relanzar Fase 2 (default: HOY 14:00 local con offset).
  --poll-ms=N          Intervalo de polling en ms (default: 120000).
  --help, -h           Muestra esta ayuda.
`);
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let waitUntil = getDefaultWaitUntil();
  let deadlineIso = getDefaultDeadlineIso();
  let pollMs = 120000;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    const waitMatch = arg.match(/^--wait-until=(.+)$/);
    if (waitMatch) {
      const parsed = new Date(waitMatch[1].trim());
      if (Number.isNaN(parsed.getTime())) {
        console.error(`❌ Valor inválido para --wait-until: ${waitMatch[1]}`);
        process.exit(1);
      }
      waitUntil = parsed;
      continue;
    }
    const deadlineMatch = arg.match(/^--deadline-iso=(.+)$/);
    if (deadlineMatch) {
      deadlineIso = deadlineMatch[1].trim();
      continue;
    }
    const pollMatch = arg.match(/^--poll-ms=(\d+)$/);
    if (pollMatch) {
      pollMs = parseInt(pollMatch[1], 10);
      continue;
    }
    if (arg.startsWith('--')) {
      console.warn(`⚠️ Flag desconocido ignorado: ${arg}`);
    }
  }

  return { waitUntil, deadlineIso, pollMs };
}

function readProgressOrExit() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    log(`⚠️ Archivo de progreso no encontrado: ${PROGRESS_FILE}`);
    process.exit(1);
  }
  let raw = '';
  try {
    raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
  } catch (err) {
    log(`⚠️ No se pudo leer archivo de progreso (${PROGRESS_FILE}): ${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }
  let doc = null;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    log(`⚠️ Archivo de progreso corrupto o ilegible (${PROGRESS_FILE}): ${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }
  if (!doc || typeof doc !== 'object') {
    log(`⚠️ Contenido inválido en archivo de progreso (${PROGRESS_FILE}): no es un objeto JSON.`);
    process.exit(1);
  }
  return doc;
}

async function main() {
  const { waitUntil, deadlineIso, pollMs } = parseCliArgs();
  const waitUntilMs = waitUntil.getTime();
  const targetIso = waitUntil.toISOString();

  while (Date.now() < waitUntilMs) {
    const hora = new Date().toTimeString().slice(0, 8);
    log(`⏳ ${hora} — esperando mop-up (objetivo ${targetIso})...`);
    const remaining = waitUntilMs - Date.now();
    const sleepTime = Math.min(pollMs, Math.max(1000, remaining));
    await sleep(sleepTime);
  }

  const maxWaitTime = waitUntilMs + 20 * 60 * 1000;

  while (true) {
    const doc = readProgressOrExit();
    const cases = Array.isArray(doc.cases) ? doc.cases : [];
    const leftovers = cases.filter((c) => c && c.status !== 'verified').length;
    const status = doc.status;

    if (ACTIVE_FASE2_STATUSES.has(status)) {
      if (Date.now() >= maxWaitTime) {
        log('⚠️ Fase 2 aún en ejecución; NO se relanza (evita doble motor).');
        process.exit(0);
      }
      log(`⏳ Fase 2 en estado '${status}'. Polleando cada ${Math.round(pollMs / 1000)}s hasta ${new Date(maxWaitTime).toISOString()}...`);
      await sleep(pollMs);
      continue;
    }

    if (leftovers > 0) {
      const logFd = fs.openSync(path.join(SCRIPT_DIR, 'deep_improvement_mopup_console.log'), 'a');
      const child = spawn(
        'node',
        [
          '--env-file=.env',
          '--env-file=.env.local',
          '--experimental-strip-types',
          'scripts\\deep_improvement_qwen.mjs',
          '--provider=groq',
          `--deadline-iso=${deadlineIso}`,
        ],
        {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          windowsHide: true,
        }
      );
      child.unref();

      log(`🚀 Mop-up lanzado: ${leftovers} pendientes · deadline ${deadlineIso} · PID ${child.pid}`);
      process.exit(0);
    } else {
      log('✅ Sin pendientes: nada que relanzar.');
      process.exit(0);
    }
  }
}

await main();
