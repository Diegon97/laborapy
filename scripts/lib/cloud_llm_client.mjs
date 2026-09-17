/**
 * Cliente HTTP para inferencia cloud vía Groq (OpenAI-compatible) con pool de
 * claves y failover automático entre modelos.
 *
 * Sin dependencias npm: usa el fetch global de Node 20+ y la API estándar.
 * Zero-Leak: nunca se registran claves ni cabeceras de autorización en logs.
 */

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_TEXT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

export function resolveGroqPool(env = process.env) {
  const candidateNames = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4'];
  const pool = [];
  const seen = new Set();
  for (const name of candidateNames) {
    const rawVal = env?.[name];
    if (typeof rawVal === 'string') {
      const trimmed = rawVal.trim();
      if (trimmed.length > 0 && !seen.has(trimmed)) {
        seen.add(trimmed);
        pool.push(trimmed);
      }
    }
  }
  return pool;
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

export async function callGroqChat({
  keys, models = GROQ_TEXT_MODELS, messages, temperature = 0.2, maxTokens = 1800,
  timeoutMs = 120000, signal = null, maxAttempts = 12, pacingMs = 1500
} = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, error: 'sin claves Groq (GROQ_POOL_VACIO)', aborted: false };
  }
  if (signal?.aborted) {
    return { ok: false, error: 'interrumpido', aborted: true };
  }

  const modelList = Array.isArray(models) && models.length > 0 ? models : GROQ_TEXT_MODELS;
  const deadKeys = new Set();
  let attemptsCount = 0;
  let lastError = 'fallo desconocido sin intentos';

  for (let k = 0; k < keys.length; k++) {
    if (deadKeys.has(k)) continue;
    const apiKey = keys[k];
    for (let m = 0; m < modelList.length; m++) {
      if (signal?.aborted) return { ok: false, error: 'interrumpido', aborted: true };
      if (attemptsCount >= maxAttempts) return { ok: false, error: lastError, aborted: false };
      attemptsCount++;
      const model = modelList[m];

      // Un intento HTTP: el timeout y la señal externa cubren TODA la operación
      // (conexión + headers + lectura del body) y se limpian siempre en el finally.
      const attemptController = new AbortController();
      let timeoutFired = false;
      let externalFired = false;
      const onExternalAbort = () => { externalFired = true; attemptController.abort(); };
      if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
      const timer = setTimeout(() => { timeoutFired = true; attemptController.abort(); }, timeoutMs);

      let outcome;
      try {
        const response = await fetch(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
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
          deadKeys.add(k);
          outcome = { kind: 'deadkey', error: `HTTP ${status}` };
        } else if (status === 400 || status === 413 || status === 422) {
          const bodyText = await readSnippet(response);
          outcome = { kind: 'fatal', error: `HTTP ${status}: ${bodyText}` };
        } else if (status === 429) {
          let waitMs = pacingMs;
          const retryAfterHeader = response.headers.get('retry-after');
          if (retryAfterHeader) {
            const parsedSec = Number.parseFloat(retryAfterHeader);
            if (Number.isFinite(parsedSec) && parsedSec > 0) waitMs = Math.min(parsedSec * 1000, 30000);
          }
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

      if (outcome.kind === 'success') return { ok: true, content: outcome.content, model, keyIndex: k };
      if (outcome.kind === 'abort') return { ok: false, error: 'interrumpido', aborted: true };
      if (outcome.kind === 'fatal') return { ok: false, error: outcome.error, aborted: false };

      lastError = outcome.error;
      if (outcome.kind === 'deadkey') break;

      try {
        await wait(outcome.waitMs ?? pacingMs, signal);
      } catch {
        return { ok: false, error: 'interrumpido', aborted: true };
      }
    }
  }
  return { ok: false, error: lastError, aborted: false };
}
