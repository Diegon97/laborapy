/**
 * ============================================================================
 * GRANJERO MIDDLEWARE v2 — Puente Tobi (Termux / Web) -> Capataz -> Gemini
 * ============================================================================
 * Escucha peticiones compatibles con la API de OpenAI en /v1/chat/completions,
 * resuelve el nivel de razonamiento solicitado, inyecta el system prompt
 * canónico de Tobi (identidad + Ficha Canónica extraída del .ts) y reenvía al
 * Capataz local (CLIProxyAPI), que hace round-robin sobre las cuentas Gemini.
 *
 * NIVELES (mapModel):
 *   "flash"     -> gemini-3.7-flash-high  + reasoning_effort "low"    (consulta rápida)
 *   "deepthink" -> gemini-3.7-flash-high  + reasoning_effort "medium" (peritaje)
 *   "max"       -> gemini-3.8-flash-high  + reasoning_effort "high"   (máximo pensamiento)
 *   alias: "deep" -> deepthink · "investigate" -> max
 *   "pro"       -> gemini-pro-agent                                    (arquitecto)
 *
 * VARIABLES DE ENTORNO:
 *   PORT          (default 8319)   Puerto de escucha del granjero.
 *   CAPATAZ_URL   (default http://127.0.0.1:8317/v1/chat/completions)
 *   CAPATAZ_KEY   (default clave local del capataz)
 *   GRANJERO_TOKEN (opcional)      Si se define, exige Authorization: Bearer <token>.
 *
 * USO RÁPIDO (desde Termux o cualquier shell):
 *   curl -s http://<ip-pc>:8319/v1/chat/completions \
 *     -H 'Content-Type: application/json' \
 *     -d '{"model":"deepthink","messages":[{"role":"user","content":"...consulta..."}]}'
 * ============================================================================
 */

import http from 'node:http';
import { buildTobiSystemPrompt, getAnswerSheetVersion } from '../lib/tobi_context_builder.mjs';

const PORT = Number(process.env.PORT || 8319);
const CAPATAZ_URL = process.env.CAPATAZ_URL || 'http://127.0.0.1:9317/v1/chat/completions';
const CAPATAZ_URLS = (process.env.CAPATAZ_URLS || `${CAPATAZ_URL},http://127.0.0.1:9327/v1/chat/completions`)
  .split(',')
  .map((u) => u.trim())
  .filter((u, i, arr) => u && arr.indexOf(u) === i);
let roundRobinNodeIdx = 0;
const CAPATAZ_KEY =
  process.env.CAPATAZ_KEY || 'cpa-nodo-b348c415de9419898e7bd43852592a4a4dd3c1db';
const GRANJERO_TOKEN = (process.env.GRANJERO_TOKEN || '').trim();

// El system prompt canónico se extrae una sola vez al arrancar (la ficha es
// estática). Si el archivo no está disponible, el granjero arranca igual y
// reporta el error en /health sin bloquear el servicio.
let SYSTEM_PROMPT = '';
let SYSTEM_PROMPT_ERROR = null;
try {
  SYSTEM_PROMPT = buildTobiSystemPrompt();
} catch (err) {
  SYSTEM_PROMPT_ERROR = err && err.message ? err.message : String(err);
}

const ANSWER_SHEET_VERSION = getAnswerSheetVersion();

/**
 * Resuelve el nivel solicitado a una CADENA de candidatos (modelo, effort) del
 * Capataz. Si el primero devuelve 429/5xx (cooldown o saturación), el granjero
 * pasa al siguiente, garantizando que la consulta nunca se caiga.
 * @param {string|undefined} requested Nivel o ID de modelo pedido por el cliente.
 * @returns {Array<{ model: string, reasoningEffort: string|null, level: string }>}
 */
export function resolveLevels(requested) {
  const key = String(requested || 'flash').trim().toLowerCase();

  // Passthrough explícito: si ya viene un ID de modelo del capataz, se respeta.
  if (key.startsWith('gemini-') || key.startsWith('capataz/')) {
    return [{ model: key.replace(/^capataz\//, ''), reasoningEffort: null, level: 'passthrough' }];
  }

  switch (key) {
    case 'flash':
    case 'consulta':
    case 'fast':
      return [
        { model: 'gemini-3.7-flash-high', reasoningEffort: 'low', level: 'flash' },
        { model: 'gemini-3.5-flash-lite', reasoningEffort: 'low', level: 'flash-fallback-3.5' },
      ];
    case 'deepthink':
    case 'deep':
    case 'peritaje':
      return [
        { model: 'gemini-3.7-flash-high', reasoningEffort: 'medium', level: 'deepthink' },
        { model: 'gemini-3.5-flash-lite', reasoningEffort: 'medium', level: 'deepthink-fallback-3.5' },
        { model: 'gemini-3.8-flash-high', reasoningEffort: 'medium', level: 'deepthink-fallback-3.8' },
      ];
    case 'max':
    case 'maxthinking':
    case 'max-thinking':
    case 'investigate':
      return [
        { model: 'gemini-3.8-flash-high', reasoningEffort: 'high', level: 'max' },
        { model: 'gemini-3.7-flash-high', reasoningEffort: 'high', level: 'max-fallback-3.7' },
        { model: 'gemini-3.5-flash-lite', reasoningEffort: 'high', level: 'max-fallback-3.5' },
      ];
    case 'pro':
    case 'arquitecto':
      return [
        { model: 'gemini-pro-agent', reasoningEffort: null, level: 'pro' },
        { model: 'gemini-3.8-flash-high', reasoningEffort: 'high', level: 'pro-fallback-3.8' },
      ];
    default:
      return [
        { model: 'gemini-3.7-flash-high', reasoningEffort: 'low', level: 'flash' },
        { model: 'gemini-3.5-flash-lite', reasoningEffort: 'low', level: 'flash-fallback-3.5' },
      ];
  }
}

/**
 * Inyecta el system prompt canónico si el cliente no proveyó uno propio.
 * @param {Array} messages
 * @param {boolean} force Inyectar incluso si ya existe un role system.
 * @returns {Array}
 */
function injectSystemPrompt(messages, force = false) {
  const list = Array.isArray(messages) ? [...messages] : [];
  const hasSystem = list.some((m) => m && m.role === 'system');

  if (!SYSTEM_PROMPT) return list;
  if (hasSystem && !force) return list;

  if (hasSystem) {
    const index = list.findIndex((m) => m && m.role === 'system');
    list[index] = { ...list[index], content: `${SYSTEM_PROMPT}\n\n${list[index].content || ''}` };
    return list;
  }
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...list];
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function handleChat(body, res) {
  const { model, messages, stream, temperature, max_tokens, reasoning_effort, injectFicha } = body;
  const candidates = resolveLevels(model);
  const finalMessages = injectSystemPrompt(messages, injectFicha === true);
  const wantsStream = stream === true;
  const retryableStatuses = new Set([408, 409, 429, 500, 502, 503, 504]);

  let upstream = null;
  let chosen = null;
  const attempted = [];
  let lastErrorDetail = '';

  const startIdx = roundRobinNodeIdx++ % CAPATAZ_URLS.length;
  const orderedNodes = CAPATAZ_URLS.map((_, idx) => CAPATAZ_URLS[(startIdx + idx) % CAPATAZ_URLS.length]);

  for (const candidate of candidates) {
    const reasoningEffort = reasoning_effort || candidate.reasoningEffort;

    for (const targetUrl of orderedNodes) {
      const nodeLabel = targetUrl.includes('9327') ? 'Josema:9327' : targetUrl.includes('9317') ? 'Diego:9317' : targetUrl;
      console.log(
        `[${new Date().toISOString()}] 🚀 nodo=${nodeLabel} nivel=${candidate.level} modelo=${candidate.model} reasoning=${
          reasoningEffort || 'n/a'
        } stream=${wantsStream}`,
      );

      let attempt;
      try {
        attempt = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: wantsStream ? 'text/event-stream' : 'application/json',
            Authorization: `Bearer ${CAPATAZ_KEY}`,
          },
          body: JSON.stringify({
            model: candidate.model,
            messages: finalMessages,
            temperature: typeof temperature === 'number' ? temperature : 0.1,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 900,
            stream: wantsStream,
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          }),
        });
      } catch (err) {
        lastErrorDetail = err && err.message ? err.message : String(err);
        attempted.push(`${nodeLabel}/${candidate.level} (red)`);
        continue;
      }

      if (attempt.ok) {
        upstream = attempt;
        chosen = { ...candidate, reasoningEffort, node: nodeLabel };
        break;
      }

      lastErrorDetail = await attempt.text().catch(() => '');
      attempted.push(`${nodeLabel}/${candidate.level} (HTTP ${attempt.status})`);

      if (!retryableStatuses.has(attempt.status)) {
        sendJson(res, attempt.status, {
          error: `Capataz (${nodeLabel}) respondió HTTP ${attempt.status}`,
          detail: lastErrorDetail.slice(0, 500),
          level: candidate.level,
          model: candidate.model,
        });
        return;
      }
      console.warn(`⚠️ ${nodeLabel}/${candidate.level} no disponible (HTTP ${attempt.status}); probando siguiente nodo/carril...`);
    }

    if (upstream && chosen) break;
  }

  if (!upstream || !chosen) {
    sendJson(res, 503, {
      error: 'Ningún carril del Capataz disponible (todos en cooldown o saturados).',
      attempted,
      detail: lastErrorDetail.slice(0, 500),
      capatazUrl: CAPATAZ_URL,
    });
    return;
  }

  if (attempted.length > 0) {
    console.log(`↪️  Fallback aplicado. Carriles previos: ${attempted.join(', ')}`);
  }

  if (!wantsStream) {
    const data = await upstream.json().catch(() => null);
    if (!data) {
      sendJson(res, 502, { error: 'Respuesta no-JSON del Capataz' });
      return;
    }
    if (data.choices?.[0]?.message) {
      data.granjero = {
        level: chosen.level,
        model: chosen.model,
        reasoningEffort: chosen.reasoningEffort,
        fallbackFrom: attempted.length > 0 ? attempted : null,
      };
    }
    sendJson(res, 200, data);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (err) {
    console.error('⚠️ Corte de stream:', err && err.message ? err.message : String(err));
  } finally {
    res.end();
  }
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    sendJson(res, 200, {
      service: 'granjero-tobi',
      status: SYSTEM_PROMPT ? 'ok' : 'degraded',
      answerSheetVersion: ANSWER_SHEET_VERSION,
      systemPromptChars: SYSTEM_PROMPT.length,
      systemPromptError: SYSTEM_PROMPT_ERROR,
      capatazUrl: CAPATAZ_URL,
      levels: {
        flash: ['gemini-3.7-flash-high (low)', 'gemini-3.5-flash-lite (low)'],
        deepthink: ['gemini-3.7-flash-high (medium)', 'gemini-3.5-flash-lite (medium)', 'gemini-3.8-flash-high (medium)'],
        max: ['gemini-3.8-flash-high (high)', 'gemini-3.7-flash-high (high)', 'gemini-3.5-flash-lite (high)'],
        pro: ['gemini-pro-agent', 'gemini-3.8-flash-high (high)'],
      },
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    sendJson(res, 404, { error: 'Ruta no encontrada. Usá POST /v1/chat/completions o GET /health.' });
    return;
  }

  if (GRANJERO_TOKEN) {
    const auth = String(req.headers.authorization || '');
    if (auth !== `Bearer ${GRANJERO_TOKEN}`) {
      sendJson(res, 401, { error: 'Token de granjero inválido o ausente.' });
      return;
    }
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 2_000_000) {
      sendJson(res, 413, { error: 'Payload demasiado grande.' });
      req.destroy();
    }
  });

  req.on('end', async () => {
    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      sendJson(res, 400, { error: 'JSON inválido.' });
      return;
    }
    try {
      await handleChat(body, res);
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: err && err.message ? err.message : String(err) });
      } else {
        res.end();
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🌾 Granjero Middleware v2 iniciado.');
  console.log(`🔌 Capataz destino: ${CAPATAZ_URL}`);
  console.log(`📖 Ficha canónica: v${ANSWER_SHEET_VERSION} (${SYSTEM_PROMPT.length} chars)`);
  if (SYSTEM_PROMPT_ERROR) console.warn(`⚠️ Ficha no cargada: ${SYSTEM_PROMPT_ERROR}`);
  console.log(`🎚️  Niveles: flash (3.7 low) · deepthink (3.7 medium) · max (3.8 high) · pro`);
  console.log(`🌐 Escuchando en http://0.0.0.0:${PORT}/v1/chat/completions`);
});
