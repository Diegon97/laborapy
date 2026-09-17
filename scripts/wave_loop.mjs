#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — LOOP DE WAVES DE GENERACIÓN ("a toda máquina" por ventana)
 * ============================================================================
 * Corre waves SECUENCIALES del generador (append sobre el archivo objetivo),
 * incrementando el id-base en cada wave para evitar colisiones de IDs, hasta
 * `--until` o `--max-waves`. El generador usa la flota multi-proveedor completa.
 *
 * Uso:
 *   node --env-file=.env --env-file=.env.local scripts/wave_loop.mjs \
 *     --start-base=9 --step=4 --max-waves=6 \
 *     --until=2026-09-16T13:15:00-03:00 \
 *     --out-file=datasets/tobi_battery_v3_candidates.json
 *
 * (El wrapper ya pasa --env-file a los hijos.)
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function getArg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const startBase = parseInt(getArg('start-base', '9'), 10);
const step = parseInt(getArg('step', '4'), 10);
const maxWaves = parseInt(getArg('max-waves', '6'), 10);
const batches = getArg('batches', '12');
const perBatch = getArg('per-batch', '4');
const concurrency = getArg('concurrency', '8');
const outFile = getArg('out-file', 'datasets/tobi_battery_v3_candidates.json');
let until;
const untilRaw = getArg('until', '');
if (untilRaw) {
  until = new Date(untilRaw);
} else {
  until = new Date();
  until.setHours(13, 15, 0, 0);
}

console.log(`🌊 Loop iniciado — base ${startBase} (paso ${step}) · max ${maxWaves} waves · hasta ${until.toISOString()} · out ${outFile}`);

let wave = 0;
let base = startBase;

while (wave < maxWaves && Date.now() < until.getTime()) {
  wave += 1;
  console.log(`\n🌊 ===== Wave ${wave}/${maxWaves} · id-base ${base} · ${new Date().toISOString()} =====`);
  const result = spawnSync('node', [
    '--env-file=.env',
    '--env-file=.env.local',
    'scripts/generate_battery_v2.mjs',
    `--batches=${batches}`,
    `--per-batch=${perBatch}`,
    `--concurrency=${concurrency}`,
    `--id-base=${base}`,
    '--append',
    `--out=${outFile}`,
  ], { cwd: ROOT, stdio: 'inherit' });
  console.log(`🌊 Wave ${wave} terminada — exit ${result.status} — ${new Date().toISOString()}`);
  base += step;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

console.log(`\n🌊 Loop finalizado (${wave} waves ejecutadas).`);
