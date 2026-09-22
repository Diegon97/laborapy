/**
 * VERCEL SERVERLESS FUNCTION: AUXILIAR INTELIGENTE RRHH LABORAPY
 * Motor de Inferencia en Escalera (Cascade Waterfall) con STREAMING SSE y doble motor:
 *  - mode 'flash'     : Gemini (Context Caching) -> DeepSeek V3 -> GPT-4o-mini -> Groq (120B) -> Cloudflare (70B)
 *  - mode 'deepthink' : DeepSeek Reasoner -> Gemini Thinking -> DeepSeek V3 -> Gemini Flash -> GPT-4o-mini
 *
 * Base de conocimiento in-memory: Ley 213/93 (hrKnowledgeBase), casos TikTok/Oiko peritados
 * y doctrina CSJ (tobiKnowledgeCatalog) + clasificación semáforo System One (heuristicTobiPeritaje),
 * inyectada ANTES del RAG remoto.
 *
 * SEGURIDAD: ninguna credencial vive en el código fuente. El pool de Groq,
 * Gemini, Cloudflare, OpenRouter, OpenAI y DeepSeek se resuelve SOLO desde env vars.
 *
 * El prompt canónico se importa de src/modules/assistant/tobiSystemPrompt.ts
 * (fuente única de verdad, incluye la regla del salario mínimo Gs. 3.044.000).
 */

import { TOBI_SYSTEM_PROMPT } from '../src/modules/assistant/tobiSystemPrompt.js';
import { TOBI_CANONICAL_ANSWER_SHEET } from '../src/modules/assistant/tobiCanonicalAnswerSheet.js';
import { queryFastKnowledge } from '../src/modules/assistant/tobiKnowledgeCatalog.js';
import { searchKnowledgeBase } from '../src/modules/assistant/hrKnowledgeBase.js';
import { heuristicTobiPeritaje } from '../src/modules/assistant/systemOne/systemOneEngine.js';
import type { TobiEngineMode } from '../src/modules/assistant/types.js';
import type { TobiPeritajeJudgment } from '../src/modules/assistant/systemOne/types.js';

declare const process: any;
declare const Buffer: any;

/**
 * Bloque de sistema COMPLETO: prompt canónico + Ficha Canónica de Respuestas.
 * La ficha es un bloque estático y determinístico (constantes legales, tabla de
 * trampas y contratos de salida) que se sirve como PREFIJO CACHEABLE. Al estar
 * literalmente en el contexto, cualquier IA responde el dato exacto en vez de
 * re-deducirlo, eliminando la alucinación en la raíz.
 */
const TOBI_FULL_SYSTEM_PROMPT: string = `${TOBI_SYSTEM_PROMPT}\n\n${TOBI_CANONICAL_ANSWER_SHEET}`;

export const config = { maxDuration: 60 };

const PROVIDER_TIMEOUT_MS = 18000;
const TOTAL_DEADLINE_MS = 45000;
const ATTACHMENT_DEADLINE_MS = 55000;
const MAX_PROMPT_CHARS = 8000;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_TURN_CHARS = 2000;
const MAX_GROQ_ATTEMPTS = 6;
const MIN_ATTEMPT_MS = 700;

// Gemini Context Caching (fallback transparente si la creación falla)
const GEMINI_CACHE_TTL_SECONDS = 3600;
const GEMINI_CACHE_MIN_CHARS = 1500;
const GEMINI_FLASH_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];
const GEMINI_THINKING_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp'];

// Adjuntos múltiples (resultado del procesamiento de PDFs en el cliente)
const MAX_ATTACHMENTS = 15;
const MAX_ATTACHMENT_BASE64 = 750 * 1024; // ~550KB binarios por adjunto
const MAX_TOTAL_ATTACHMENTS_BASE64 = 3_800_000; // margen bajo el límite de Vercel (~4.5MB)
const MAX_TEXT_ATTACHMENT_CHARS = 60000;

// Proveedor premium de respaldo (OpenAI), activado por OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini';

export interface SanitizedAttachment {
  name: string;
  mimeType: string;
  cleanBase64: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
]);

const MAX_BASE64_LENGTH = 5.5 * 1024 * 1024; // ~4MB raw binary limit

function sanitizeAttachment(raw: any): SanitizedAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawMime = typeof raw.mimeType === 'string' ? raw.mimeType.toLowerCase().trim() : '';
  const mimeType = rawMime.split(';')[0]; // Ignorar sufijos como ;codecs=opus
  const data = typeof raw.data === 'string' ? raw.data.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'documento';

  if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;
  if (!data || data.length > MAX_BASE64_LENGTH) return null;

  const cleanBase64 = data.replace(/^data:[^,]+,/, '').trim();
  // Validar caracteres base64 válidos
  if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64.slice(0, 1000))) return null;

  return { name, mimeType, cleanBase64 };
}

/**
 * Normaliza y sanitiza la lista de adjuntos múltiples.
 * Acepta texto ya extraído (text/plain) e imágenes/PDF en base64.
 * Aplica caps por cantidad, tamaño por adjunto y presupuesto total.
 */
export function sanitizeAttachments(raw: any): SanitizedAttachment[] {
  const items: any[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const result: SanitizedAttachment[] = [];
  let totalBase64 = 0;

  for (const item of items) {
    if (result.length >= MAX_ATTACHMENTS) break;
    if (!item || typeof item !== 'object') continue;

    const mimeType = typeof item.mimeType === 'string' ? item.mimeType.toLowerCase().trim() : '';
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.slice(0, 120) : 'documento';
    const rawData = typeof item.data === 'string' ? item.data.trim() : '';
    if (!rawData) continue;

    // Texto ya extraído en el cliente (no consume el presupuesto de binarios)
    if (mimeType === 'text/plain') {
      let text = rawData;
      if (text.startsWith('data:text/plain;base64,')) {
        const b64 = text.slice('data:text/plain;base64,'.length).trim();
        if (typeof Buffer !== 'undefined') {
          try {
            text = Buffer.from(b64, 'base64').toString('utf8');
          } catch {
            text = b64;
          }
        } else {
          text = b64;
        }
      } else if (text.startsWith('data:text/plain,')) {
        text = text.slice('data:text/plain,'.length);
      }
      text = text.slice(0, MAX_TEXT_ATTACHMENT_CHARS);
      if (!text.trim()) continue;
      result.push({ name, mimeType, cleanBase64: text });
      continue;
    }

    // Binarios: reutilizamos el sanitizador legado (mime permitido + regex base64)
    const binary = sanitizeAttachment(item);
    if (!binary) continue;
    if (binary.cleanBase64.length > MAX_ATTACHMENT_BASE64) continue;
    if (totalBase64 + binary.cleanBase64.length > MAX_TOTAL_ATTACHMENTS_BASE64) continue;
    totalBase64 += binary.cleanBase64.length;
    result.push(binary);
  }

  return result;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizeHistory(raw: any): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim().length > 0)
    .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, MAX_HISTORY_TURN_CHARS) }))
    .slice(-MAX_HISTORY_TURNS);
}

function beginSseStream(res: any): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(`: ${' '.repeat(2048)}\n\n`);
}

function writeSseEvent(res: any, payload: any): void {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Cliente desconectado: ignorar
  }
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T | null> {
  if (timeoutMs <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/*                    Streaming: primitiva OpenAI-compatible                   */
/* -------------------------------------------------------------------------- */

interface StreamOutcome {
  committed: boolean;
  content?: string;
  error?: string;
}

async function streamOpenAiCompatible(params: {
  url: string;
  apiKey?: string;
  model: string;
  messages: any[];
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
  /** DeepSeek Reasoner rechaza temperature/penalties: omitir muestreo si es true. */
  omitSampling?: boolean;
  maxTokens?: number;
  onDelta: (text: string) => void;
  externalSignal: AbortSignal;
}): Promise<StreamOutcome> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (params.externalSignal.aborted) controller.abort();
  params.externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  let committed = false;
  let content = '';
  try {
    const res = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
        ...(params.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: params.model,
        stream: true,
        ...(params.omitSampling ? {} : { temperature: 0.1 }),
        max_tokens: params.maxTokens ?? 1400,
        messages: params.messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[OpenAI-Compat Error] ${params.url} (${params.model}) HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return { committed: false, error: `HTTP ${res.status}` };
    }
    if (!res.body) return { committed: false, error: 'stream-empty' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          // Solo se transmite `content`; el `reasoning_content` de deepseek-reasoner se descarta internamente
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            committed = true;
            content += delta;
            params.onDelta(delta);
          }
        } catch {
          // Chunk parcial o no-JSON: ignorar
        }
      }
    }
    if (!committed) return { committed: false, error: 'stream-empty' };
    return { committed: true, content };
  } catch {
    return { committed, content: content || undefined, error: committed ? undefined : 'network' };
  } finally {
    clearTimeout(timer);
    params.externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/* -------------------------------------------------------------------------- */
/*                           Streaming: Google Gemini                         */
/* -------------------------------------------------------------------------- */

/**
 * Construye el array `contents` de Gemini normalizado.
 * Gemini exige que el primer turno sea `user` y que se alterne user/model;
 * el historial del cliente puede empezar con el saludo de Tobi (assistant).
 */
function normalizeGeminiContents(history: ChatTurn[], parts: any[]): any[] {
  const contents: any[] = [];
  for (const turn of history) {
    const role = turn.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text = `${last.parts[0].text}\n${turn.content}`;
    } else {
      contents.push({ role, parts: [{ text: turn.content }] });
    }
  }
  // Descartar turnos iniciales que no sean 'user' (p. ej. saludo del asistente)
  while (contents.length > 0 && contents[0].role !== 'user') contents.shift();
  // Descartar turnos 'user' colgantes: la consulta actual es el último turno user
  while (contents.length > 0 && contents[contents.length - 1].role === 'user') contents.pop();
  contents.push({ role: 'user', parts });
  return contents;
}

/**
 * Crea un CachedContent de Gemini con el BLOQUE ESTÁTICO (prompt canónico +
 * Ficha Canónica de Respuestas). Al cachear solo contenido estático e inmutable,
 * la caché es reutilizable entre consultas y se sirve a ~10% del costo de tokens.
 * Fallback transparente: si la API falla o expira, devuelve null y se inyecta
 * el mismo bloque de forma inline (TOBI_FULL_SYSTEM_PROMPT).
 */
async function createGeminiContextCache(params: {
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<string | null> {
  if (params.timeoutMs <= 0) return null;
  const data = await fetchJson<{ name?: string }>(
    `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${params.model}`,
        systemInstruction: { parts: [{ text: TOBI_SYSTEM_PROMPT }] },
        contents: [
          { role: 'user', parts: [{ text: TOBI_CANONICAL_ANSWER_SHEET }] },
          { role: 'model', parts: [{ text: 'Ficha canónica normativa recibida y fijada como fuente de verdad.' }] },
        ],
        ttl: `${GEMINI_CACHE_TTL_SECONDS}s`,
      }),
    },
    params.timeoutMs,
  );
  return typeof data?.name === 'string' && data.name ? data.name : null;
}

async function streamGeminiModel(params: {
  apiKey: string;
  model: string;
  parts: any[];
  history: ChatTurn[];
  timeoutMs: number;
  cachedContent?: string | null;
  thinkingBudget?: number;
  onDelta: (text: string) => void;
  externalSignal: AbortSignal;
}): Promise<StreamOutcome> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (params.externalSignal.aborted) controller.abort();
  params.externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  let committed = false;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${params.apiKey}`;
    const generationConfig: any = {
      temperature: 0.1,
      maxOutputTokens: 1400,
      ...(params.thinkingBudget && params.thinkingBudget > 0
        ? { thinkingConfig: { thinkingBudget: params.thinkingBudget } }
        : {}),
    };
    const requestBody: any = {
      ...(params.cachedContent
        ? { cachedContent: params.cachedContent }
        : { systemInstruction: { parts: [{ text: TOBI_FULL_SYSTEM_PROMPT }] } }),
      contents: normalizeGeminiContents(params.history, params.parts),
      generationConfig,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!res.ok) return { committed: false, error: `HTTP ${res.status}` };
    if (!res.body) return { committed: false, error: 'stream-empty' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const text = (json?.candidates?.[0]?.content?.parts ?? [])
            .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
            .join('');
          if (text.length > 0) {
            committed = true;
            params.onDelta(text);
          }
        } catch {
          // Chunk parcial o no-JSON: ignorar
        }
      }
    }
    return committed ? { committed: true } : { committed: false, error: 'stream-empty' };
  } catch {
    return { committed, error: committed ? undefined : 'network' };
  } finally {
    clearTimeout(timer);
    params.externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/* -------------------------------------------------------------------------- */
/*                         Streaming: Cloudflare Workers AI                    */
/* -------------------------------------------------------------------------- */

async function streamCloudflare(params: {
  url: string;
  token: string;
  messages: any[];
  timeoutMs: number;
  onDelta: (text: string) => void;
  externalSignal: AbortSignal;
}): Promise<StreamOutcome> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (params.externalSignal.aborted) controller.abort();
  params.externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  let committed = false;
  try {
    const res = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({
        stream: true,
        messages: params.messages,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Cloudflare Error] HTTP ${res.status}: ${errText.slice(0, 300)}`);
      return { committed: false, error: `HTTP ${res.status}` };
    }
    if (!res.body) return { committed: false, error: 'stream-empty' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const text =
            typeof json?.response === 'string'
              ? json.response
              : typeof json?.choices?.[0]?.delta?.content === 'string'
                ? json.choices[0].delta.content
                : '';
          if (text.length > 0) {
            committed = true;
            params.onDelta(text);
          }
        } catch {
          // Chunk parcial o no-JSON: ignorar
        }
      }
    }
    return committed ? { committed: true } : { committed: false, error: 'stream-empty' };
  } catch {
    return { committed, error: committed ? undefined : 'network' };
  } finally {
    clearTimeout(timer);
    params.externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/* -------------------------------------------------------------------------- */
/*                          Wrappers por proveedor                            */
/* -------------------------------------------------------------------------- */

// 0. Granjero Protocol (API Gateway Local para Tobi)
async function callGranjero(
  prompt: string,
  timeoutMs: number,
  mode: 'simple' | 'deep' | 'investigate',
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
): Promise<{ provider: string; model: string } | null> {
  const url = process.env.GRANJERO_URL?.trim();
  if (!url) return null; // Salto silencioso a la cascada normal si no hay Granjero
  const outcome = await streamOpenAiCompatible({
    url,
    model: mode, // El Granjero interpreta el mode (simple/deep/investigate)
    messages: [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prompt },
    ],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'granjero', model: mode };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

// 0.5. (Opcional dev) Ollama local
async function callLocalLLM(
  prompt: string,
  timeoutMs: number,
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
): Promise<{ provider: string; model: string } | null> {
  const rawUrl = process.env.TOBI_LOCAL_LLM_URL?.trim();
  if (!rawUrl) return null;
  const baseUrl = rawUrl.replace(/\/+$/, '');
  const url = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : baseUrl.endsWith('/v1')
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;
  const model = process.env.TOBI_LOCAL_LLM_MODEL?.trim() || 'qwen2.5:7b';
  const outcome = await streamOpenAiCompatible({
    url,
    model,
    messages: [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prompt },
    ],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'local', model };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

// 1. Google Gemini (Flash con Context Caching o Thinking según el modo)
async function callGemini(
  prompt: string,
  timeoutMs: number,
  attachments: readonly SanitizedAttachment[],
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
  opts?: { mode?: TobiEngineMode; thinkingBudget?: number },
): Promise<{ provider: string; model: string } | null> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)?.trim();
  if (!apiKey) return null;
  const models = opts?.mode === 'deepthink' ? GEMINI_THINKING_MODELS : GEMINI_FLASH_MODELS;

  // Los text/plain ya vienen incorporados en el prompt: imagen, PDF y audio van como inlineData.
  const parts: any[] = [];
  for (const attachment of attachments) {
    if (
      attachment.mimeType.startsWith('image/') ||
      attachment.mimeType === 'application/pdf' ||
      attachment.mimeType.startsWith('audio/')
    ) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.cleanBase64,
        },
      });
    }
  }
  parts.push({ text: prompt });

  // Context Caching del BLOQUE ESTÁTICO (prompt + ficha canónica):
  // intento con fallback transparente a inyección inline.
  let cachedContent: string | null = null;
  if (timeoutMs > MIN_ATTEMPT_MS && TOBI_CANONICAL_ANSWER_SHEET.length >= GEMINI_CACHE_MIN_CHARS) {
    cachedContent = await createGeminiContextCache({
      apiKey,
      model: models[0],
      timeoutMs: Math.min(2000, timeoutMs),
    });
  }

  const deadlineAt = Date.now() + timeoutMs;
  let lastError: string | undefined;
  for (const model of models) {
    const remaining = deadlineAt - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const outcome = await streamGeminiModel({
      apiKey,
      model,
      parts,
      history,
      timeoutMs: Math.min(remaining, PROVIDER_TIMEOUT_MS),
      cachedContent,
      thinkingBudget: opts?.thinkingBudget,
      onDelta,
      externalSignal,
    });
    if (outcome.committed) return { provider: 'gemini', model };
    lastError = outcome.error;
  }
  onError?.(lastError ?? 'sin respuesta');
  return null;
}

function getGroqPool(): string[] {
  return Array.from(
    new Set(
      [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3,
        process.env.GROQ_API_KEY_4,
      ]
        .map((k: any) => (typeof k === 'string' ? k.replace(/^["']|["']$/g, '').trim() : ''))
        .filter(Boolean),
    ),
  );
}

async function callGroq(
  prompt: string,
  timeoutMs: number,
  attachments: readonly SanitizedAttachment[],
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
): Promise<{ provider: string; model: string } | null> {
  const pool = getGroqPool();
  if (pool.length === 0) return null;

  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const GROQ_VISION_MODELS: string[] = [];

  if (images.length > 0 && GROQ_VISION_MODELS.length === 0) {
    onError?.('sin modelos de visión en el catálogo actual de Groq');
    return null;
  }

  const deadlineAt = Date.now() + timeoutMs;
  let attempts = 0;
  let lastError: string | undefined;

  const runCall = async (
    models: string[],
    userContent: any,
  ): Promise<{ provider: string; model: string } | null> => {
    const messages = [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userContent },
    ];
    for (const apiKey of pool) {
      for (const model of models) {
        if (attempts >= MAX_GROQ_ATTEMPTS) return null;
        if (deadlineAt - Date.now() < MIN_ATTEMPT_MS) return null;
        attempts++;
        const outcome = await streamOpenAiCompatible({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey,
          model,
          messages,
          maxTokens: 800,
          timeoutMs: Math.min(deadlineAt - Date.now(), PROVIDER_TIMEOUT_MS),
          onDelta,
          externalSignal,
        });
        if (outcome.committed) return { provider: 'groq', model };
        lastError = outcome.error;
      }
    }
    return null;
  };

  // Solo modelos de alta capacidad: qwen 27b ultra veloz primero, respaldo gpt 120b
  const textModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

  if (images.length <= 1) {
    const isImage = images.length === 1;
    const userContent: any = isImage
      ? [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${images[0].mimeType};base64,${images[0].cleanBase64}` },
          },
        ]
      : prompt;
    const answer = await runCall(isImage ? GROQ_VISION_MODELS : textModels, userContent);
    if (answer) return answer;
    onError?.(lastError ?? 'sin respuesta');
    return null;
  }

  const multiContent: any = [
    { type: 'text', text: prompt },
    ...images.map((a) => ({
      type: 'image_url',
      image_url: { url: `data:${a.mimeType};base64,${a.cleanBase64}` },
    })),
  ];
  const multiAnswer = await runCall(GROQ_VISION_MODELS, multiContent);
  if (multiAnswer) return multiAnswer;

  onError?.(lastError ?? 'sin respuesta');
  return null;
}

// 3. Cloudflare Workers AI (modelo 70B y Reasoner: sin 8B en la cascada)
async function callCloudflare(
  prompt: string,
  timeoutMs: number,
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
  reasoner = false,
): Promise<{ provider: string; model: string } | null> {
  const token = (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN)?.trim();
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID)?.trim();
  if (!token || !accountId) return null;
  const model = reasoner
    ? '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
    : '@cf/meta/llama-3.1-70b-instruct';
  const outcome = await streamCloudflare({
    url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    token,
    messages: [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prompt },
    ],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'cloudflare', model };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

// 4. OpenRouter Free
async function callOpenRouter(
  prompt: string,
  timeoutMs: number,
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
): Promise<{ provider: string; model: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const model = 'meta-llama/llama-3.3-70b-instruct:free';
  const outcome = await streamOpenAiCompatible({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey,
    model,
    extraHeaders: {
      'HTTP-Referer': 'https://calculadora-rrhh-py.vercel.app',
      'X-Title': 'Calculadora RRHH PY',
    },
    messages: [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prompt },
    ],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'openrouter', model };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

// 5. OpenAI (respaldo premium, activado por OPENAI_API_KEY)
async function callOpenAI(
  prompt: string,
  timeoutMs: number,
  attachments: readonly SanitizedAttachment[],
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
): Promise<{ provider: string; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const userContent: any = attachments.some((a) => a.mimeType !== 'text/plain')
    ? [
        { type: 'text', text: prompt },
        ...attachments.filter((a) => a.mimeType !== 'text/plain').map((a) =>
          a.mimeType === 'application/pdf'
            ? { type: 'file', file: { filename: a.name.endsWith('.pdf') ? a.name : `${a.name}.pdf`, file_data: `data:application/pdf;base64,${a.cleanBase64}` } }
            : { type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.cleanBase64}` } },
        ),
      ]
    : prompt;
  const outcome = await streamOpenAiCompatible({
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey,
    model: OPENAI_MODEL,
    messages: [{ role: 'system', content: TOBI_SYSTEM_PROMPT }, ...history, { role: 'user', content: userContent }],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'openai', model: OPENAI_MODEL };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

// 6. DeepSeek (V3 chat y Reasoner para modo deepthink)
async function callDeepSeek(
  prompt: string,
  timeoutMs: number,
  history: ChatTurn[],
  onDelta: (text: string) => void,
  externalSignal: AbortSignal,
  onError?: (msg: string) => void,
  reasoner = false,
): Promise<{ provider: string; model: string } | null> {
  const apiKey = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY)?.trim();
  if (!apiKey) return null;
  const model = reasoner ? 'deepseek-reasoner' : 'deepseek-chat';
  const outcome = await streamOpenAiCompatible({
    url: 'https://api.deepseek.com/chat/completions',
    apiKey,
    model,
    omitSampling: reasoner,
    messages: [
      { role: 'system', content: TOBI_FULL_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prompt },
    ],
    timeoutMs,
    onDelta,
    externalSignal,
  });
  if (outcome.committed) return { provider: 'deepseek', model };
  onError?.(outcome.error ?? 'sin respuesta');
  return null;
}

const EMBEDDING_DIMENSIONS = 768;
const SEMANTIC_MATCH_THRESHOLD = 0.3;
const SEMANTIC_MATCH_COUNT = 4;

interface TobiKnowledgeMatch {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

/**
 * Genera el embedding (768 dims, gemma-300m) usando Cloudflare Workers AI.
 * Aplica normalización L2 explícita para la métrica coseno de pgvector.
 */
async function embedQueryText(query: string, timeoutMs: number): Promise<number[] | null> {
  const accountId = (process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID)?.trim();
  const token = (process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)?.trim();
  if (!accountId || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/google/embeddinggemma-300m`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: [query.slice(0, 2000)] }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;

    const v = data.result.data[0];
    if (!Array.isArray(v) || v.length !== EMBEDDING_DIMENSIONS) return null;

    // Normalización L2 requerida para operator class vector_cosine_ops en Supabase
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm === 0 ? v : v.map((x) => x / norm);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * RAG unificado sobre tobi_knowledge_base (pgvector) vía RPC match_tobi_knowledge.
 */
async function fetchSemanticJurisprudence(
  query: string,
  supabaseUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const startedAt = Date.now();
    const embedding = await embedQueryText(query, Math.min(1200, timeoutMs));
    if (!embedding) return '';

    const remaining = timeoutMs - (Date.now() - startedAt);
    if (remaining < 300) return '';

    const matches = await fetchJson<TobiKnowledgeMatch[]>(
      `${supabaseUrl}/rest/v1/rpc/match_tobi_knowledge`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          query_embedding: embedding,
          match_threshold: SEMANTIC_MATCH_THRESHOLD,
          match_count: SEMANTIC_MATCH_COUNT,
        }),
      },
      Math.min(remaining, 900),
    );

    if (!matches || matches.length === 0) return '';

    return matches
      .map((m) => {
        let title = 'Precedente Legal / Base de Conocimiento';
        if (m.metadata?.source === 'csj' || m.metadata?.fuente === 'CSJ') {
          title = `Corte Suprema de Justicia (${m.metadata?.sala || 'Sala Laboral'})`;
        } else if (m.metadata?.type === 'audio_transcription' || m.metadata?.fuente === 'Tobi_Audios') {
          title = 'Consulta Similar (Audio/Video Resuelto)';
        } else if (m.metadata?.fuente === 'Peritaje_5_Abogados_Oiko' || m.metadata?.tipo === 'peritaje_laboral_social') {
          title = `Dictamen Pericial Laboral Verificado (${m.metadata?.abogado || '5 Abogados'})`;
        } else if (m.metadata?.source === 'multimedia') {
          title = 'Jurisprudencia y Criterio Práctico Multimedia';
        }

        return (
          `• [${title}]:\n` +
          `  ${m.content.replace(/\n/g, '\n  ')}`
        );
      })
      .join('\n\n');
  } catch {
    return '';
  }
}

export interface CsjJurisprudenceMatch {
  id: string;
  codigo_csj: number;
  tipo_resolucion: string;
  numero_resolucion: number;
  anio: number;
  fecha_resolucion: string;
  caratula: string;
  sala: string;
  resultado_accion: string;
  decision?: string;
  url_documento: string;
  fragmento: string;
  rank: number;
}

/**
 * Consulta RPC a public.buscar_jurisprudencia_csj en Supabase Postgres.
 * Retorna jurisprudencia oficial de la Corte Suprema de Justicia del Paraguay.
 */
export async function fetchCsjJurisprudence(
  query: string,
  timeoutMs = 2000,
  explicitSupabaseUrl?: string,
  explicitServiceKey?: string,
): Promise<string> {
  const supabaseUrl = (explicitSupabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const serviceKey = (explicitServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed || !supabaseUrl || !serviceKey || timeoutMs <= 0) return '';

  try {
    const matches = await fetchJson<CsjJurisprudenceMatch[]>(
      `${supabaseUrl}/rest/v1/rpc/buscar_jurisprudencia_csj`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          p_query: trimmed,
          p_match_count: 3,
        }),
      },
      Math.min(timeoutMs, 1200),
    );

    if (!matches || !Array.isArray(matches) || matches.length === 0) return '';

    return matches
      .map((m) => {
        const sala = m.sala || 'Laboral';
        const tipo = m.tipo_resolucion || 'A&S';
        const fragmento = m.fragmento ? `  Doctrina/Extracto: ${m.fragmento.replace(/\s+/g, ' ').trim()}\n` : '';
        const urlDoc = m.url_documento ? `  Documento Oficial: ${m.url_documento}` : '';
        const decision = m.decision || m.resultado_accion || 'No consignado';
        return (
          `• CSJ Sala ${sala} — ${tipo} N° ${m.numero_resolucion}/${m.anio}\n` +
          `  Carátula: "${m.caratula || ''}"\n` +
          `  Decisión: ${decision}\n` +
          fragmento +
          urlDoc
        ).trimEnd();
      })
      .join('\n\n');
  } catch {
    return '';
  }
}

async function fetchMultimediaJurisprudence(
  query: string,
  supabaseUrl: string,
  serviceKey: string,
  timeoutMs: number,
): Promise<string> {
  // 1) RAG semántico (pgvector + embeddings) — se activa con CF_API_TOKEN y backfill aplicado
  const semantic = await fetchSemanticJurisprudence(query, supabaseUrl, serviceKey, timeoutMs);
  if (semantic) return semantic;

  // 2) Fallback determinístico: búsqueda por palabras clave (ILIKE)
  const stopWords = new Set([
    'como', 'para', 'pero', 'este', 'esta', 'estos', 'estas', 'donde', 'porque', 'cuando',
    'sobre', 'desde', 'hacer', 'puedo', 'pueden', 'quiero', 'tengo', 'documento', 'adjunto',
    'auditoria', 'pericial', 'juridica', 'favor', 'ayuda', 'hola', 'buenas', 'tardes', 'dias',
  ]);

  const KEY_LEGAL_TERMS = [
    'demanda', 'dictamen', 'sentencia', 'despido', 'renuncia', 'estabilidad', 'justificada',
    'injustificada', 'preaviso', 'indemnizacion', 'vacaciones', 'aguinaldo', 'ips', 'comision',
    'horas extras', 'acoso', 'mobbing', 'accidente', 'causal', 'falta', 'notificacion',
  ];

  const lowerQuery = query.toLowerCase();
  const detectedLegalTerms = KEY_LEGAL_TERMS.filter((t) => lowerQuery.includes(t));

  const words = lowerQuery
    .replace(/[^a-záéíóúñ0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  const cleanWords = Array.from(new Set([...detectedLegalTerms, ...words])).slice(0, 3);
  if (cleanWords.length === 0) return '';

  const orClause = cleanWords
    .map((w) => `titulo_tema.ilike.*${encodeURIComponent(w)}*,caso_abuso_detectado.ilike.*${encodeURIComponent(w)}*,criterio_practico.ilike.*${encodeURIComponent(w)}*`)
    .join(',');

  const url = `${supabaseUrl}/rest/v1/jurisprudencia_multimedia?select=titulo_tema,caso_abuso_detectado,criterio_practico,fundamento_juridico&or=(${orClause})&limit=3`;

  try {
    const data = await fetchJson<Array<{
      titulo_tema: string;
      caso_abuso_detectado: string;
      criterio_practico: string;
      fundamento_juridico: string;
    }>>(
      url,
      {
        method: 'GET',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
      Math.min(1500, timeoutMs),
    );

    if (!data || data.length === 0) return '';

    return data
      .map(
        (item) =>
          `• Criterio/Precedente Paraguayo: "${item.titulo_tema}"\n  Caso fáctico: ${item.caso_abuso_detectado}\n  Criterio práctico de expertos: ${item.criterio_practico}\n  Leyes aplicables: ${item.fundamento_juridico}`,
      )
      .join('\n\n');
  } catch {
    return '';
  }
}

export async function fetchSupabaseJurisprudence(query: string, timeoutMs: number): Promise<string> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!supabaseUrl || !serviceKey || timeoutMs <= 300) return '';

  const [csjText, multimediaText] = await Promise.all([
    fetchCsjJurisprudence(query, timeoutMs, supabaseUrl, serviceKey),
    fetchMultimediaJurisprudence(query, supabaseUrl, serviceKey, timeoutMs),
  ]);

  const sections: string[] = [];
  if (csjText) sections.push(`[JURISPRUDENCIA CORTE SUPREMA DE JUSTICIA (PARAGUAY)]\n${csjText}`);
  if (multimediaText) sections.push(`[CRITERIOS Y CASOS PRÁCTICOS LABORALES]\n${multimediaText}`);

  return sections.join('\n\n');
}

/* -------------------------------------------------------------------------- */
/*                       Conocimiento in-memory (pre-RAG)                     */
/* -------------------------------------------------------------------------- */

/**
 * Construye el bloque de conocimiento en memoria (sin red, <1ms):
 *  - Ley 213/93 y complementarias vía hrKnowledgeBase (searchKnowledgeBase).
 *  - Casos TikTok/Oiko peritados + doctrina CSJ vía tobiKnowledgeCatalog (queryFastKnowledge).
 */
function buildInMemoryKnowledgeBlock(query: string): string {
  const sections: string[] = [];

  const kbResults = searchKnowledgeBase(query, 3);
  if (kbResults.length > 0) {
    const kbText = kbResults
      .map((r) => `• ${r.entry.title} (${r.entry.legalBasis.join('; ') || 'Ley 213/93'}): ${r.entry.summary}`)
      .join('\n');
    sections.push(`[BASE DE CONOCIMIENTO NORMATIVA (LEY 213/93 Y CONCORDANTES)]\n${kbText}`);
  }

  const fast = queryFastKnowledge(query, 3, 2);
  if (fast.formattedContext) sections.push(fast.formattedContext);

  return sections.join('\n\n');
}

interface CachedAuthorizedCases {
  timestamp: number;
  cases: Array<{
    consulta: string;
    articulos: string[];
    respuesta_tobi: string;
    correccion_diego: string;
  }>;
}

let cachedAuthorizedCases: CachedAuthorizedCases | null = null;
const AUTHORIZED_CASES_CACHE_TTL_MS = 60_000;

/**
 * Consulta en Supabase los casos periciales recientemente autorizados y comentados
 * por Diego Núñez en el Centro de Control Administrativo (con caché RAM de 60s).
 */
export async function fetchAuthorizedLearningCases(query: string): Promise<string> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!supabaseUrl || !serviceKey) return '';

  try {
    const now = Date.now();
    let cases = cachedAuthorizedCases?.cases || [];

    if (!cachedAuthorizedCases || now - cachedAuthorizedCases.timestamp > AUTHORIZED_CASES_CACHE_TTL_MS) {
      const url = `${supabaseUrl}/rest/v1/tobi_learning_candidates?autorizado=eq.AUTORIZADO&select=consulta,articulos,respuesta_tobi,correccion_diego&order=auditado_at.desc&limit=50`;
      const res = await fetchJson<any[]>(
        url,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
        800,
      );

      if (res && Array.isArray(res)) {
        cases = res;
        cachedAuthorizedCases = { timestamp: now, cases };
      }
    }

    if (cases.length === 0) return '';

    const lowerQ = query.toLowerCase();
    const words = lowerQ
      .replace(/[^a-záéíóúñ0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4);

    const relevant = cases
      .filter((c) => {
        const q = (c.consulta || '').toLowerCase();
        const arts = (c.articulos || []).map((a: string) => a.toLowerCase());
        return words.some((w) => q.includes(w)) || arts.some((a) => lowerQ.includes(a));
      })
      .slice(0, 3);

    if (relevant.length === 0) return '';

    const lines = relevant.map((c) => {
      const criterio = c.correccion_diego || c.respuesta_tobi || 'Criterio oficial validado.';
      return (
        `• Consulta laboral autorizada: "${c.consulta}"\n` +
        `  Artículos: ${(c.articulos || []).join(', ') || 'Ley 213/93'}\n` +
        `  Criterio de Diego Núñez: ${criterio}`
      );
    });

    return `[CRITERIOS Y CASOS PERICIALES AUTORIZADOS POR DIEGO NÚÑEZ (MÁXIMA PRECEDENCIA)]\n${lines.join('\n\n')}`;
  } catch {
    return '';
  }
}

/**
 * Bloque de directiva derivado del veredicto determinístico de System One (semáforo).
 */
function buildSystemOneDirective(judgment: TobiPeritajeJudgment): string {
  const rf = judgment.riesgoFraudeArt19;
  const lines = [
    `• Intención detectada: ${judgment.intencion}`,
    `• Motivo de egreso probable: ${judgment.motivoEgreso}`,
    `• Riesgo de fraude Art. 19 C.T.: nivel ${rf.nivel}/5${rf.flagrante ? ' (FLAGRANTE)' : ''}`,
    `• Urgente por prescripción: ${judgment.esUrgentePrescripcion ? 'SÍ' : 'no'}`,
    `• Lead B2B: ${judgment.leadB2B ? 'SÍ' : 'no'}`,
    `• Confianza del clasificador: ${judgment.confianza}`,
  ];
  return (
    `[CLASIFICACIÓN SEMÁFORO SYSTEM ONE (VEREDICTO DETERMINÍSTICO)]\n` +
    lines.join('\n') +
    `\nRespetá esta clasificación y priorizá los artículos correspondientes.`
  );
}

const TOBI_INTENCIONES = new Set(['calcular_liquidacion', 'auditoria_documento', 'consulta_derechos', 'fraude_facturacion', 'fuera_de_dominio']);
const TOBI_MOTIVOS_EGRESO = new Set(['despido_injustificado', 'despido_justificado', 'renuncia_voluntaria', 'retiro_justificado', 'estabilidad_10_anos', 'no_aplica']);

function sanitizeSystemOneJudgment(raw: any): TobiPeritajeJudgment | null {
  if (!raw || typeof raw !== 'object') return null;
  const intencion = TOBI_INTENCIONES.has(raw.intencion) ? raw.intencion : null;
  const motivoEgreso = TOBI_MOTIVOS_EGRESO.has(raw.motivoEgreso) ? raw.motivoEgreso : null;
  if (!intencion || !motivoEgreso) return null;
  const rf = raw.riesgoFraudeArt19 && typeof raw.riesgoFraudeArt19 === 'object' ? raw.riesgoFraudeArt19 : {};
  const score = Number(rf.score);
  const nivel = Number(rf.nivel);
  const confianza = Number(raw.confianza);
  return {
    intencion,
    motivoEgreso,
    riesgoFraudeArt19: {
      score: Number.isFinite(score) ? Math.min(5, Math.max(1, score)) : 1,
      nivel: (Number.isFinite(nivel) ? Math.min(5, Math.max(1, Math.round(nivel))) : 1) as 1 | 2 | 3 | 4 | 5,
      flagrante: rf.flagrante === true,
    },
    esUrgentePrescripcion: raw.esUrgentePrescripcion === true,
    leadB2B: raw.leadB2B === true,
    confianza: Number.isFinite(confianza) ? Math.min(0.95, Math.max(0, confianza)) : 0.2,
  };
}

export interface ParsedAssistantRequest {
  readonly valid: boolean;
  readonly prompt: string;
  readonly context: string;
  readonly attachment: SanitizedAttachment | null;
  readonly attachments: SanitizedAttachment[];
  readonly history: ChatTurn[];
  readonly mode: TobiEngineMode;
  readonly systemOneJudgment: TobiPeritajeJudgment | null;
  readonly error?: string;
}

export function parseAssistantRequestBody(rawBody: unknown): ParsedAssistantRequest {
  const body =
    typeof rawBody === 'string'
      ? (() => {
          try {
            return JSON.parse(rawBody);
          } catch {
            return {};
          }
        })()
      : ((rawBody as Record<string, any>) || {});

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : '';
  if (!prompt) {
    return {
      valid: false,
      prompt: '',
      context: '',
      attachment: null,
      attachments: [],
      history: [],
      mode: 'flash',
      systemOneJudgment: null,
      error: 'Prompt requerido',
    };
  }

  const rawContext = body?.context;
  const context = rawContext
    ? (typeof rawContext === 'string' ? rawContext : JSON.stringify(rawContext)).slice(0, 12000)
    : '';

  // Parser dual con fallback seguro y retrocompatibilidad con 'deep'/'investigate'.
  const rawMode = body?.mode;
  const mode: TobiEngineMode =
    rawMode === 'deepthink' || rawMode === 'deep' || rawMode === 'investigate' ? 'deepthink' : 'flash';

  const systemOneJudgment = sanitizeSystemOneJudgment(body?.systemOneJudgment);

  const attachments = sanitizeAttachments([
    ...(Array.isArray(body?.attachments) ? body.attachments : []),
    ...(body?.attachment ? [body.attachment] : []),
  ]);
  const attachment = attachments.find((a) => a.mimeType !== 'text/plain') ?? null;
  const history = sanitizeHistory(body?.history);

  return {
    valid: true,
    prompt,
    context,
    attachment,
    attachments,
    history,
    mode,
    systemOneJudgment,
  };
}

function formatContextBlock(rawContext?: string): string {
  if (!rawContext) return '';
  try {
    const parsed = typeof rawContext === 'string' ? JSON.parse(rawContext) : rawContext;
    if (parsed && typeof parsed === 'object' && parsed.liquidacionInput) {
      const inp = parsed.liquidacionInput;
      const res = parsed.liquidacionResult;
      const vacAnt = inp.vacacionesPeriodosAnteriores ?? 0;
      const vacAct = inp.vacacionesPeriodoActual ?? 0;
      const antig = res?.antiguedad
        ? `${res.antiguedad.years} años, ${res.antiguedad.months} meses, ${res.antiguedad.days} días`
        : 'calculada';
      const totalNeto = res?.totalNetoEstimado
        ? `Gs. ${Number(res.totalNetoEstimado).toLocaleString('es-PY')}`
        : 'calculado';

      return (
        `[Liquidación Laboral Activa en Pantalla]\n` +
        `• Salario mensual: Gs. ${Number(inp.salarioMensual || 3044000).toLocaleString('es-PY')}\n` +
        `• Fecha de ingreso: ${inp.fechaIngreso || '—'}\n` +
        `• Fecha de egreso: ${inp.fechaEgreso || '—'}\n` +
        `• Motivo de egreso: ${inp.motivo || 'despido_sin_causa'}\n` +
        `• Antigüedad del colaborador: ${antig}\n` +
        `• Vacaciones pendientes no gozadas (períodos anteriores): ${vacAnt} días\n` +
        `• Vacaciones gozadas período actual: ${vacAct} días\n` +
        `• Total neto calculado actualmente: ${totalNeto}\n\n` +
        `[DIRECTIVA AGÉNTICA DE LIQUIDACIÓN]: El usuario ya tiene esta liquidación calculada en pantalla. Si solicita agregar o modificar días de vacaciones, salarios, fechas o conceptos, NO vuelvas a pedir los datos que ya tenés. Aplicá la adición o corrección inmediatamente sobre esta base y emití obligatoriamente el bloque :::liquidacion_action recalculado al final.`
      );
    }
  } catch {
    // Si no es JSON, continuar
  }
  return `[Contexto de Liquidación / Contrato]\n${rawContext}`;
}

export function buildEnrichedPrompt(params: {
  readonly prompt: string;
  readonly context?: string;
  readonly attachment?: SanitizedAttachment | null;
  readonly attachments?: readonly SanitizedAttachment[];
  readonly fastKnowledge?: string;
  readonly authorizedCases?: string;
  readonly systemOneDirective?: string;
  readonly jurisprudence?: string;
}): string {
  const attachmentBlocks: string[] = [];
  if (params.attachments && params.attachments.length > 0) {
    const imagesCount = params.attachments.filter((a) => a.mimeType.startsWith('image/')).length;
    for (const a of params.attachments) {
      if (a.mimeType === 'text/plain') {
        attachmentBlocks.push(`[Documento Adjunto: ${a.name} (texto extraído)]\n${a.cleanBase64}`);
      } else if (a.mimeType.startsWith('audio/')) {
        attachmentBlocks.push(`[Audio Adjunto: ${a.name} (${a.mimeType}) — Nota de voz del usuario con su consulta laboral en audio]`);
      } else if (a.mimeType === 'application/pdf') {
        attachmentBlocks.push(`[Documento Adjunto: ${a.name} (${a.mimeType}) — documento PDF adjunto para auditoría pericial jurídica]`);
      } else {
        const pagesLabel = imagesCount > 1 ? `${imagesCount} páginas adjuntas` : 'documento adjunto';
        attachmentBlocks.push(`[Documento Adjunto: ${a.name} (${a.mimeType}) — ${pagesLabel} para auditoría pericial jurídica]`);
      }
    }
  } else if (params.attachment) {
    attachmentBlocks.push(`[Documento Adjunto: ${params.attachment.name} (${params.attachment.mimeType})]\nSe adjunta imagen/archivo del documento para auditoría pericial jurídica.`);
  }

  const contextFormatted = formatContextBlock(params.context);

  return [
    contextFormatted,
    ...attachmentBlocks,
    params.authorizedCases ?? '',
    params.fastKnowledge
      ? `[BASE DE CONOCIMIENTO EN MEMORIA — LEYES, CASOS PERITADOS Y DOCTRINA CSJ]\n${params.fastKnowledge}`
      : '',
    params.systemOneDirective ?? '',
    params.jurisprudence
      ? `[Jurisprudencia y Criterios Prácticos de Abogados Laboralistas Paraguayos]\n${params.jurisprudence}`
      : '',
    `[Consulta del Usuario]\n${params.prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Deriva metadatos NO sensibles de los adjuntos para telemetría:
 * tipo (none/text/image/images/pdf/mixed) y cantidad de páginas/adjuntos.
 */
function deriveAttachmentInfo(attachments: readonly SanitizedAttachment[]): { kind: string; pages: number } {
  if (attachments.length === 0) return { kind: 'none', pages: 0 };
  const imageCount = attachments.filter((a) => a.mimeType.startsWith('image/')).length;
  const pdfCount = attachments.filter((a) => a.mimeType === 'application/pdf').length;
  const textCount = attachments.filter((a) => a.mimeType === 'text/plain').length;
  const audioCount = attachments.filter((a) => a.mimeType.startsWith('audio/')).length;
  const distinctTypes =
    (imageCount > 0 ? 1 : 0) +
    (pdfCount > 0 ? 1 : 0) +
    (textCount > 0 ? 1 : 0) +
    (audioCount > 0 ? 1 : 0);

  let kind = 'text';
  if (distinctTypes > 1) kind = 'mixed';
  else if (audioCount > 0) kind = 'audio';
  else if (imageCount > 1) kind = 'images';
  else if (imageCount === 1) kind = 'image';
  else if (pdfCount > 0) kind = 'pdf';

  const pages = imageCount > 0 ? imageCount : attachments.length;
  return { kind, pages };
}

interface TobiEventPayload {
  kind: string;
  answered_provider: string | null;
  answered_model: string | null;
  providers_failed: string;
  attachment_kind: string;
  attachment_pages: number;
  duration_ms: number;
  detail?: string;
}

/**
 * Registra telemetría y conversación en Supabase (tabla tobi_events).
 * Permite auditar y entrenar modelos QLoRA con interacciones reales.
 */
async function logTobiEvent(payload: TobiEventPayload): Promise<void> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${supabaseUrl}/rest/v1/tobi_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ...payload, providers_failed: payload.providers_failed.slice(0, 300) }),
      signal: controller.signal,
    });
  } catch {
    // best-effort: nunca romper el flujo por la telemetría
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/*                        Transcripción de Audio (Whisper)                    */
/* -------------------------------------------------------------------------- */

async function transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
  const pool = getGroqPool();
  if (pool.length === 0) return '';
  const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
  for (const apiKey of pool) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, `audio.${ext}`);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'es');
      
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData as any,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) return data.text.trim();
      } else {
        console.warn('Groq Whisper error:', await res.text());
      }
    } catch (err) {
      console.warn('Groq Whisper exception:', err);
    }
  }
  return '';
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const startedAt = Date.now();

  const parsed = parseAssistantRequestBody(req.body);
  if (!parsed.valid || !parsed.prompt) {
    res.status(400).json({ ok: false, error: parsed.error || 'Prompt requerido', fallbackToOffline: true });
    return;
  }

  const { prompt, context } = parsed;
  const attachmentInfo = deriveAttachmentInfo(parsed.attachments);

  // Transcribir audios antes del RAG usando Groq Whisper para que TODOS los modelos puedan leerlo
  for (const a of parsed.attachments) {
    if (a.mimeType.startsWith('audio/')) {
      const transcript = await transcribeAudio(a.cleanBase64, a.mimeType);
      if (transcript) {
        a.mimeType = 'text/plain';
        a.cleanBase64 = `[Transcripción de la nota de voz del usuario]: "${transcript}"`;
        a.name = `${a.name} (Transcrito)`;
      } else {
        a.mimeType = 'text/plain';
        a.cleanBase64 = `[Error: La nota de voz recibida estaba completamente en silencio o no contenía voz humana. Pide al usuario que escriba su consulta o verifique su micrófono.]`;
        a.name = `${a.name} (Fallo)`;
      }
    }
  }

  // 1. Semáforo pericial determinístico con System One / Jev
  const systemOneJudgment = parsed.systemOneJudgment ?? heuristicTobiPeritaje(prompt);
  const systemOneDirective = buildSystemOneDirective(systemOneJudgment);

  // 2. Base de conocimiento in-memory (<1ms): Leyes 213/93, casos TikTok/Oiko peritados y doctrina CSJ
  const fastKnowledge = buildInMemoryKnowledgeBlock(prompt);

  // 3. Casos y criterios periciales aprobados por Diego Núñez en el Centro de Control
  const authorizedCases = await fetchAuthorizedLearningCases(prompt);

  // 4. RAG remoto en Supabase (si responde en menos de 800ms)
  const jurisprudence = await fetchSupabaseJurisprudence(prompt, 800);

  const enrichedPrompt = buildEnrichedPrompt({
    prompt,
    context,
    attachments: parsed.attachments,
    fastKnowledge,
    authorizedCases,
    systemOneDirective,
    jurisprudence,
  });

  beginSseStream(res);

  const abortController = new AbortController();
  const handleClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  try {
    if (typeof res.on === 'function') res.on('close', handleClose);
    else if (typeof req.on === 'function') req.on('close', handleClose);
  } catch {
    // Runtime sin soporte de eventos: continuar sin abort externo
  }

  let anyDelta = false;
  let fullAssistantResponse = '';
  const onDelta = (t: string) => {
    if (!t) return;
    anyDelta = true;
    fullAssistantResponse += t;
    writeSseEvent(res, { type: 'delta', text: t });
  };

  const deadline = Date.now() + (parsed.attachments.length > 0 ? ATTACHMENT_DEADLINE_MS : TOTAL_DEADLINE_MS);
  const failedReasons: string[] = [];

  // Cascada dual según el modo: 'deepthink' (razonamiento profundo) vs 'flash' (velocidad y caché)
  const isDeepThink = parsed.mode === 'deepthink';

  const steps: Array<{ name: string; run: (p: string, b: number) => Promise<{ provider: string; model: string } | null> }> = isDeepThink
    ? [
        // Modo DeepThink: 1) DeepSeek Reasoner, 2) Gemini Thinking, 3) Cloudflare Reasoner (DeepSeek R1), 4) Groq 120B, 5) DeepSeek V3, 6) Gemini Flash, 7) OpenAI
        {
          name: 'deepseek-reasoner',
          run: (p, b) =>
            callDeepSeek(p, Math.min(b, 28000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`deepseek-reasoner: ${m}`), true),
        },
        {
          name: 'gemini-thinking',
          run: (p, b) =>
            callGemini(p, Math.min(b, 20000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`gemini-thinking: ${m}`), {
              mode: 'deepthink',
              thinkingBudget: 1024,
            }),
        },
        {
          name: 'cloudflare-reasoner',
          run: (p, b) =>
            callCloudflare(p, Math.min(b, 20000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`cloudflare-reasoner: ${m}`), true),
        },
        {
          name: 'groq',
          run: (p, b) => callGroq(p, Math.min(b, 15000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`groq: ${m}`)),
        },
        {
          name: 'deepseek-chat',
          run: (p, b) =>
            callDeepSeek(p, Math.min(b, 15000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`deepseek-chat: ${m}`), false),
        },
        {
          name: 'gemini-flash',
          run: (p, b) =>
            callGemini(p, Math.min(b, 12000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`gemini-flash: ${m}`), {
              mode: 'flash',
            }),
        },
        {
          name: 'openai',
          run: (p, b) => callOpenAI(p, Math.min(b, 15000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`openai: ${m}`)),
        },
      ]
    : [
        // Modo Flash: 1) Granjero/Local (dev), 2) Gemini Flash con Context Cache, 3) Groq (120B ultra veloz), 4) Cloudflare (70B), 5) DeepSeek V3, 6) OpenAI, 7) OpenRouter
        ...(process.env.GRANJERO_URL?.trim()
          ? [{ name: 'granjero', run: (p: string, b: number) => callGranjero(p, Math.min(b, 45000), 'simple', parsed.history, onDelta, abortController.signal, (m: string) => failedReasons.push(`granjero: ${m}`)) }]
          : []),
        ...(process.env.TOBI_LOCAL_LLM_URL?.trim()
          ? [{ name: 'local', run: (p: string, b: number) => callLocalLLM(p, Math.min(b, 45000), parsed.history, onDelta, abortController.signal, (m: string) => failedReasons.push(`local: ${m}`)) }]
          : []),
        {
          name: 'gemini',
          run: (p, b) =>
            callGemini(p, Math.min(b, 12000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`gemini: ${m}`), {
              mode: 'flash',
            }),
        },
        {
          name: 'groq',
          run: (p, b) => callGroq(p, Math.min(b, 15000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`groq: ${m}`)),
        },
        {
          name: 'cloudflare',
          run: (p, b) => callCloudflare(p, Math.min(b, 25000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`cloudflare: ${m}`), false),
        },
        {
          name: 'deepseek',
          run: (p, b) =>
            callDeepSeek(p, Math.min(b, 12000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`deepseek: ${m}`), false),
        },
        {
          name: 'openai',
          run: (p, b) => callOpenAI(p, Math.min(b, 12000), parsed.attachments, parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`openai: ${m}`)),
        },
        {
          name: 'openrouter',
          run: (p, b) => callOpenRouter(p, Math.min(b, 10000), parsed.history, onDelta, abortController.signal, (m) => failedReasons.push(`openrouter: ${m}`)),
        },
      ];

  let answered: { provider: string; model: string } | null = null;

  const emitTelemetry = async (kind: string): Promise<void> => {
    await logTobiEvent({
      kind,
      answered_provider: answered?.provider ?? null,
      answered_model: answered?.model ?? null,
      providers_failed: failedReasons.join('; '),
      attachment_kind: attachmentInfo.kind,
      attachment_pages: attachmentInfo.pages,
      duration_ms: Date.now() - startedAt,
      detail: JSON.stringify({
        prompt: prompt.slice(0, 2500),
        response: fullAssistantResponse.slice(0, 4000),
        mode: parsed.mode,
        provider: answered?.provider ?? 'fallback',
        model: answered?.model ?? 'local',
        timestamp: new Date().toISOString(),
      }),
    });
  };

  try {
    for (const step of steps) {
      const budget = Math.min(PROVIDER_TIMEOUT_MS, Math.max(0, deadline - Date.now()));
      if (budget <= 0 || abortController.signal.aborted) break;
      const answer = await step.run(enrichedPrompt, budget);
      if (answer) {
        answered = answer;
        await emitTelemetry('request_ok');
        writeSseEvent(res, { type: 'done', provider: answer.provider, model: answer.model });
        res.end();
        return;
      }
      if (anyDelta) {
        await emitTelemetry('request_partial');
        writeSseEvent(res, { type: 'done', provider: 'partial', model: 'stream' });
        res.end();
        return;
      }
    }
    await emitTelemetry(anyDelta ? 'request_partial' : 'request_fallback');
    writeSseEvent(res, { type: 'fallback', reason: failedReasons.join('; ') });
    res.end();
  } catch (err: any) {
    await emitTelemetry(answered ? 'request_ok' : anyDelta ? 'request_partial' : 'request_fallback');
    if (anyDelta) writeSseEvent(res, { type: 'done', provider: 'partial', model: 'stream' });
    else writeSseEvent(res, { type: 'fallback', reason: err?.message || failedReasons.join('; ') });
    try { res.end(); } catch { /* ya cerrado */ }
  }
}
