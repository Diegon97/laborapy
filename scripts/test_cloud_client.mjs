#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI — VERIFICACIÓN DEL CLIENTE GROQ CLOUD
 * ============================================================================
 * Chequea el pool de claves Groq y ejecuta UNA llamada real de smoke test.
 *
 * Uso: node --env-file=.env --env-file=.env.local scripts/test_cloud_client.mjs
 * Salidas: 0 = OK · 1 = fallo de llamada · 2 = sin claves en el entorno.
 * ============================================================================
 */

import { resolveGroqPool, callGroqChat } from './lib/cloud_llm_client.mjs';

const keys = resolveGroqPool();
if (keys.length === 0) {
  console.error('⛔ Sin claves Groq en el entorno (usar --env-file)');
  process.exit(2);
}
console.log(`🔑 Pool: ${keys.length} claves`);

const startedAt = Date.now();
const result = await callGroqChat({
  keys,
  messages: [
    { role: 'system', content: 'Respondé en español, breve.' },
    { role: 'user', content: 'Decí exactamente: PONG-TOBI' },
  ],
  temperature: 0,
  maxTokens: 32,
  timeoutMs: 60000,
  maxAttempts: 6,
});
const elapsed = Date.now() - startedAt;

if (result.ok) {
  console.log(`✅ OK — modelo: ${result.model} · clave #${result.keyIndex + 1} · ${elapsed}ms · respuesta: ${result.content.slice(0, 80)}`);
  process.exit(0);
}
console.log(`❌ FALLO — ${result.error}`);
process.exit(1);
