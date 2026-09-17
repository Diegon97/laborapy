#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI RRHH — SMOKE TEST DE LA FLOTA MULTI-PROVEEDOR
 * ============================================================================
 * Verifica que la flota (Groq + NVIDIA NIM + Z.AI) esté disponible y hace UNA
 * llamada real mínima. Nunca imprime claves: solo nombres de lanes y conteos.
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/test_fleet.mjs
 * Salidas: 0 = OK · 1 = fallo de llamada · 2 = flota vacía.
 * ============================================================================
 */

import { resolveFleet, callFleetChat } from './lib/llm_fleet.mjs';

const lanes = resolveFleet();
const usable = lanes.filter((lane) => Array.isArray(lane.keys) && lane.keys.length > 0);

if (usable.length === 0) {
  console.error('⛔ Flota vacía: sin claves disponibles (Groq/NVIDIA/ZAI)');
  process.exit(2);
}

console.log(`🚀 Flota: ${usable.length} lane(s)`);
for (const lane of usable) {
  console.log(`   - ${lane.name}: ${lane.keys.length} clave(s) · modelos: ${lane.models.join(', ')}`);
}

const startedAt = Date.now();
const result = await callFleetChat({
  messages: [
    { role: 'system', content: 'Respondé en español, breve.' },
    { role: 'user', content: 'Decí exactamente: PONG-FLEET' },
  ],
  temperature: 0,
  maxTokens: 32,
  timeoutMs: 90000,
  maxAttempts: 6,
});
const elapsed = Date.now() - startedAt;

if (result.ok) {
  console.log(`✅ OK — ${result.provider}/${result.model} · ${elapsed}ms · respuesta: ${result.content.slice(0, 80)}`);
  process.exit(0);
}
console.log(`❌ FALLO — ${result.error}`);
process.exit(1);
