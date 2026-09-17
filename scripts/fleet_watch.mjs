#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — WATCHER DE SALUD DE LA FLOTA (probe directo cada N minutos)
 * ============================================================================
 * Prueba cada lane (groq / nvidia / zai / capataz) con una llamada mínima y
 * loguea el resultado en `scripts/fleet_health.log`. Detecta saturación (429),
 * claves muertas (401/403), respuestas vacías y latencias degradadas.
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/fleet_watch.mjs
 *   --interval-ms=N   Intervalo entre rondas (default: 300000 = 5 min)
 *   --until=ISO       Hora de corte (default: HOY 15:00 local)
 * Nunca imprime claves. Usa fetch directo (sin caches del fleet) para que cada
 * ronda refleje el estado real.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFleet } from './lib/llm_fleet.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, 'fleet_health.log');
const args = process.argv.slice(2);

function getArg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

const intervalMs = Math.max(60000, parseInt(getArg('interval-ms', '300000'), 10) || 300000);
const untilRaw = getArg('until', '');
let until;
if (untilRaw) {
  until = new Date(untilRaw);
} else {
  until = new Date();
  until.setHours(15, 0, 0, 0);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  } catch {
    /* log best-effort */
  }
}

async function probeLane(lane) {
  for (const model of lane.models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const startedAt = Date.now();
    try {
      const res = await fetch(`${lane.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lane.keys[0]}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Decí exactamente: OK' }],
          max_tokens: 48,
          temperature: 0,
          stream: false,
        }),
        signal: ctrl.signal,
      });
      const ms = Date.now() - startedAt;
      if (res.status === 200) {
        const data = await res.json().catch(() => null);
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
          return { ok: true, model, ms, detail: content.trim().slice(0, 24) };
        }
        return { ok: false, model, ms, detail: 'respuesta vacía' };
      }
      return { ok: false, model, ms, detail: `HTTP ${res.status}` };
    } catch (err) {
      const ms = Date.now() - startedAt;
      return { ok: false, model, ms, detail: err?.name === 'AbortError' ? 'TIMEOUT' : (err?.message || 'error de red') };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, model: null, ms: 0, detail: 'sin modelos' };
}

async function round() {
  const lanes = resolveFleet();
  for (const lane of lanes) {
    if (!Array.isArray(lane.keys) || lane.keys.length === 0) {
      log(`⏭️ ${lane.name}: sin claves`);
      continue;
    }
    const r = await probeLane(lane);
    if (r.ok) log(`✅ ${lane.name}/${r.model} · ${r.ms}ms · ${r.detail}`);
    else log(`❌ ${lane.name}/${r.model || '-'} · ${r.ms}ms · ${r.detail}`);
  }
}

log(`🩺 Watcher iniciado (cada ${Math.round(intervalMs / 1000)}s, hasta ${until.toISOString()})`);
while (Date.now() < until.getTime()) {
  await round();
  const remaining = until.getTime() - Date.now();
  if (remaining <= 0) break;
  await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
}
log('🩺 Watcher finalizado.');
