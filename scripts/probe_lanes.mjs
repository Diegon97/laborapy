#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — PROBE DE SALUD DE LA FLOTA (por lane)
 * ============================================================================
 * Hace una llamada mínima a CADA lane de la flota y reporta ok / latencia / error.
 * Sirve para detectar saturación o degradación de proveedores (Groq/NVIDIA/Z.AI/
 * capataz) antes de lanzar corridas de datasets.
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/probe_lanes.mjs
 * Salidas: 0 = al menos una lane respondió · 1 = ninguna respondió.
 * Nunca imprime claves.
 * ============================================================================
 */

import { resolveFleet, callFleetChat } from './lib/llm_fleet.mjs';

const lanes = resolveFleet();
console.log(`🚀 Lanes: ${lanes.map((lane) => `${lane.name}(${lane.keys.length}k)`).join(' · ')}`);

let okCount = 0;

for (const lane of lanes) {
  if (!Array.isArray(lane.keys) || lane.keys.length === 0) continue;
  const startedAt = Date.now();
  const res = await callFleetChat({
    messages: [
      { role: 'system', content: 'Respondé en español, breve.' },
      { role: 'user', content: 'Decí exactamente: PING-LANE' },
    ],
    temperature: 0,
    maxTokens: 64,
    timeoutMs: 60000,
    maxAttempts: 4,
    lanes: [lane],
  });
  const ms = Date.now() - startedAt;
  if (res.ok) {
    okCount++;
    console.log(`✅ ${lane.name}/${res.model} · ${ms}ms · ${res.content.slice(0, 50)}`);
  } else {
    console.log(`❌ ${lane.name} · ${ms}ms · ${String(res.error).slice(0, 200)}`);
  }
}

process.exitCode = okCount > 0 ? 0 : 1;
