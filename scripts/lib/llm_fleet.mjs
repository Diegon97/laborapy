/**
 * ============================================================================
 * TOBI RRHH — FLOTA DE INFERENCIA MULTI-PROVEEDOR ("a toda máquina")
 * ============================================================================
 * Agrega todos los tanques de inferencia disponibles en un único pool con
 * failover y balanceo round-robin entre proveedores:
 *   - Groq        (pool de claves, OpenAI-compatible)
 *   - NVIDIA NIM  (https://integrate.api.nvidia.com/v1)
 *   - Z.AI / GLM  (https://api.z.ai/api/paas/v4)
 *
 * Las claves de NVIDIA/ZAI se leen del entorno (NVIDIA_API_KEY / ZAI_API_KEY)
 * o, si no están, del auth.json de opencode. Ruta configurable con
 * OPENCODE_AUTH_PATH.
 *
 * Zero-Leak: JAMÁS se registran claves ni cabeceras de autorización en logs.
 * Sin dependencias npm: usa el fetch global de Node 20+.
 * ============================================================================
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveGroqPool, GROQ_TEXT_MODELS } from './cloud_llm_client.mjs';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';
export const NVIDIA_MODELS = ['deepseek-ai/deepseek-v4-flash-0731', 'google/gemma-4-31b-it'];
export const ZAI_MODELS = ['glm-5.3-flash', 'glm-4.7'];
export const CAPATAZ_FALLBACK_BASE_URL = 'http://127.0.0.1:8317/v1';
export const CAPATAZ_MODELS = [
  'gemini-3.7-flash-high',
  'gemini-3.6-flash-high',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-low',
  'gemini-3-flash',
  'claude-sonnet-4-6',
  'claude-opus-4-6-thinking',
  'gpt-oss-120b-medium',
];

// Cursor de balanceo module-level: llamadas sucesivas arrancan por una lane distinta.
let fleetLaneCursor = 0;

// Cachés de salud module-level (por proceso): evitan reintentar claves muertas
// (401/403) y claves saturadas (429) durante un tiempo de enfriamiento.
const globalDeadKeys = new Set();
const keyCooldownUntil = new Map();
const KEY_COOLDOWN_MS = 20000;

function readAuthFile(env) {
  try {
    const authPath = env?.OPENCODE_AUTH_PATH || path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
    const raw = fs.readFileSync(authPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readOpencodeConfig(env) {
  try {
    const cfgPath = env?.OPENCODE_CONFIG_PATH || path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = JSON.parse(raw);
    const capataz = parsed?.provider?.capataz;
    return capataz && typeof capataz === 'object' ? capataz : null;
  } catch {
    return null;
  }
}

function extractProviderKey(auth, provider) {
  const entry = auth?.[provider];
  if (!entry) return null;
  const rawKey = typeof entry === 'string' ? entry : (typeof entry?.key === 'string' ? entry.key : null);
  if (typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveEnvOrAuthKey(env, envName, auth, providerName) {
  const raw = env?.[envName];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return extractProviderKey(auth, providerName);
}

/**
 * Resuelve la flota de lanes disponibles. Cada lane: { name, baseUrl, keys, models }.
 * La lane `groq` siempre figura (aunque su pool venga vacío); NVIDIA y ZAI se
 * omiten si no tienen clave. Nunca expone valores de claves.
 */
export function resolveFleet(env = process.env) {
  const auth = readAuthFile(env);
  const lanes = [
    { name: 'groq', baseUrl: GROQ_BASE_URL, keys: resolveGroqPool(env), models: [...GROQ_TEXT_MODELS] }
  ];

  const nvidiaKey = resolveEnvOrAuthKey(env, 'NVIDIA_API_KEY', auth, 'nvidia');
  if (nvidiaKey) lanes.push({ name: 'nvidia', baseUrl: NVIDIA_BASE_URL, keys: [nvidiaKey], models: [...NVIDIA_MODELS] });

  const zaiKey = resolveEnvOrAuthKey(env, 'ZAI_API_KEY', auth, 'zai');
  if (zaiKey) lanes.push({ name: 'zai', baseUrl: ZAI_BASE_URL, keys: [zaiKey], models: [...ZAI_MODELS] });

  if (String(env?.CAPATAZ_LANE ?? '1') !== '0') {
    const capatazEntry = readOpencodeConfig(env);
    const capatazKey = (typeof env?.CAPATAZ_API_KEY === 'string' && env.CAPATAZ_API_KEY.trim().length > 0)
      ? env.CAPATAZ_API_KEY.trim()
      : (typeof capatazEntry?.options?.apiKey === 'string' ? capatazEntry.options.apiKey.trim() : null);
    const capatazBase = (typeof env?.CAPATAZ_BASE_URL === 'string' && env.CAPATAZ_BASE_URL.trim().length > 0)
      ? env.CAPATAZ_BASE_URL.trim()
      : (typeof capatazEntry?.options?.baseURL === 'string' ? capatazEntry.options.baseURL.trim() : CAPATAZ_FALLBACK_BASE_URL);
    if (capatazKey) lanes.push({ name: 'capataz', baseUrl: capatazBase.replace(/\/+$/, ''), keys: [capatazKey], models: [...CAPATAZ_MODELS] });
  }

  return lanes;
}

function wait(ms, signal) {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('interrumpido', 'AbortError'));
      return;
    }
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('interrumpido', 'AbortError'));
    };
    timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function readSnippet(response, limit = 300) {
  try {
    return (await response.text()).slice(0, limit);
  } catch {
    return '';
  }
}

/**
 * Llama a la flota completa con failover y round-robin. Presupuesto global de
 * intentos acotado por maxAttempts. Un intento HTTP cubre conexión + headers +
 * lectura del body, y su timeout se limpia siempre en el finally.
 */
export async function callFleetChat({
  messages,
  temperature = 0.2,
  maxTokens = 4096,
  timeoutMs = 120000,
  signal = null,
  pacingMs = 1200,
  lanes = null,
  maxAttempts = 10
} = {}) {
  const activeLanes = Array.isArray(lanes) ? lanes : resolveFleet();
  const usableLanes = activeLanes.filter((lane) => (
    lane
    && Array.isArray(lane.keys) && lane.keys.length > 0
    && Array.isArray(lane.models) && lane.models.length > 0
  ));
  if (usableLanes.length === 0) {
    return { ok: false, error: 'sin claves de inferencia (FLEET_VACIO)', aborted: false };
  }
  if (signal?.aborted) {
    return { ok: false, error: 'interrumpido', aborted: true };
  }

  // Round-robin start: cada llamada comienza por una lane distinta.
  const startIndex = fleetLaneCursor % usableLanes.length;
  fleetLaneCursor = (fleetLaneCursor + 1) % 1000000;

  const deadKeys = globalDeadKeys;
  let attemptsCount = 0;
  let lastError = 'fallo desconocido sin intentos';
  let lastProvider = null;

        // Orden de intentos INTERCALADO por lane (model >> key >> lane, con
        // rotación de inicio): ninguna lane puede consumir sola el presupuesto
        // de intentos y dejar a las demás sin intentar, garantizando el failover
        // real entre proveedores.
        const maxKeys = Math.max(...usableLanes.map((l) => l.keys.length));
        const maxModels = Math.max(...usableLanes.map((l) => l.models.length));
        const attemptTargets = [];
        for (let m = 0; m < maxModels; m++) {
          for (let k = 0; k < maxKeys; k++) {
            for (let li = 0; li < usableLanes.length; li++) {
              const candidateLane = usableLanes[(startIndex + li) % usableLanes.length];
              if (k < candidateLane.keys.length && m < candidateLane.models.length) {
                attemptTargets.push({ lane: candidateLane, keyIndex: k, model: candidateLane.models[m] });
              }
            }
          }
        }

        for (const target of attemptTargets) {
          const lane = target.lane;
          const k = target.keyIndex;
          const model = target.model;
          lastProvider = lane.name;
          const keyId = `${lane.name}:${k}`;
          if (deadKeys.has(keyId)) continue;
          const cooldownUntil = keyCooldownUntil.get(keyId) || 0;
          if (Date.now() < cooldownUntil) continue;
          if (signal?.aborted) return { ok: false, error: 'interrumpido', aborted: true, provider: lane.name };
          if (attemptsCount >= maxAttempts) return { ok: false, error: lastError, aborted: false, provider: lastProvider };
          attemptsCount++;
          const apiKey = lane.keys[k];
          const chatUrl = `${lane.baseUrl.replace(/\/+$/, '')}/chat/completions`;

        // El timeout y la señal externa cubren TODA la operación (conexión +
        // headers + lectura del body) y se limpian siempre en el finally.
        const attemptController = new AbortController();
        let timeoutFired = false;
        let externalFired = false;
        const onExternalAbort = () => { externalFired = true; attemptController.abort(); };
        if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
        const timer = setTimeout(() => { timeoutFired = true; attemptController.abort(); }, timeoutMs);

        let outcome;
        try {
          const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
            signal: attemptController.signal
          });

          const status = response.status;
          if (status === 200) {
            let data = null;
            try { data = await response.json(); } catch { data = null; }
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content === 'string' && content.trim().length > 0) {
              outcome = { kind: 'success', content: content.trim() };
            } else {
              outcome = { kind: 'retry', error: 'respuesta vacía' };
            }
          } else if (status === 401 || status === 403) {
            deadKeys.add(keyId);
            outcome = { kind: 'deadkey', error: `HTTP ${status}` };
          } else if (status === 400 || status === 422) {
            const bodyText = await readSnippet(response);
            outcome = { kind: 'fatal', error: `HTTP ${status}: ${bodyText}` };
          } else if (status === 413) {
            const bodyText = await readSnippet(response);
            outcome = { kind: 'retry', error: `HTTP 413: ${bodyText}` };
          } else if (status === 429) {
            let waitMs = pacingMs;
            const retryAfterHeader = response.headers.get('retry-after');
            if (retryAfterHeader) {
              const parsedSec = Number.parseFloat(retryAfterHeader);
              if (Number.isFinite(parsedSec) && parsedSec > 0) waitMs = Math.min(parsedSec * 1000, 30000);
            }
            keyCooldownUntil.set(keyId, Date.now() + Math.max(waitMs * 2, KEY_COOLDOWN_MS));
            outcome = { kind: 'retry', error: 'HTTP 429 rate limit', waitMs };
          } else {
            const snippet = await readSnippet(response);
            outcome = { kind: 'retry', error: snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}` };
          }
        } catch (err) {
          if (externalFired || signal?.aborted) {
            outcome = { kind: 'abort' };
          } else {
            outcome = {
              kind: 'retry',
              error: timeoutFired ? `TIMEOUT (${Math.round(timeoutMs / 1000)}s)` : (err?.message || 'error de red')
            };
          }
        } finally {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onExternalAbort);
        }

        if (outcome.kind === 'success') {
          return { ok: true, content: outcome.content, provider: lane.name, model, keyIndex: k };
        }
        if (outcome.kind === 'abort') return { ok: false, error: 'interrumpido', aborted: true, provider: lane.name };
        if (outcome.kind === 'fatal') return { ok: false, error: outcome.error, aborted: false, provider: lane.name };

          lastError = outcome.error;
          if (outcome.kind === 'deadkey') continue;

          try {
            await wait(outcome.waitMs ?? pacingMs, signal);
          } catch {
            return { ok: false, error: 'interrumpido', aborted: true, provider: lane.name };
          }
        }

  return { ok: false, error: lastError, aborted: false, provider: lastProvider };
}

/**
 * Worker pool async. Ejecuta hasta `limit` invocaciones de `fn(item, index)` en
 * paralelo y devuelve un array en el ORDEN original de `items`, con la forma
 * `{ ok: true, value }` u `{ ok: false, error }`. Nunca lanza por errores
 * individuales de `fn`. `limit` se clampa a un mínimo de 1.
 */
export async function mapConcurrent(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const results = new Array(total);
  if (total === 0) return results;

  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit >= 1 ? parsedLimit : 1;
  const effectiveLimit = Math.min(safeLimit, total);

  let nextIndex = 0;
  const worker = async () => {
    for (;;) {
      const current = nextIndex++;
      if (current >= total) return;
      try {
        const value = await fn(list[current], current);
        results[current] = { ok: true, value };
      } catch (err) {
        results[current] = { ok: false, error: err?.message || String(err) };
      }
    }
  };

  const workers = [];
  for (let i = 0; i < effectiveLimit; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}
