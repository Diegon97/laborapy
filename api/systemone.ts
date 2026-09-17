/**
 * VERCEL SERVERLESS FUNCTION: SYSTEM ONE — LABORAPY / TOBI
 * Versión: PY-SYSTEMONE-2026.09.17
 *
 * Cascada segura:
 *   a) TYPESAFE_API_KEY → API nativa https://api.typesafe.ai/v1/systemone (modelo jev-latest).
 *   b) GROQ_API_KEY / GEMINI_API_KEY → adaptador estructurado (JSON mode / JSON schema).
 *   c) Sin proveedor externo → evaluación determinística de respaldo (heurística local).
 *
 * CISO Zero-Leak: ninguna credencial vive en el código; los errores crudos nunca
 * se exponen al cliente ni se registran.
 */

import {
  TOBI_PERITAJE_QUESTIONS,
  buildSystemOnePrompt,
  deterministicAnswers,
  formatSystemOneAnswers,
  parseSystemOneJson,
} from '../src/modules/assistant/systemOne/systemOneEngine.js';
import type {
  SystemOneAnswer,
  SystemOneQuestion,
} from '../src/modules/assistant/systemOne/types.js';

declare const process: any;
export const config = { maxDuration: 30 };

const TYPESAFE_API_URL = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-latest';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GEMINI_MODEL = 'gemini-2.0-flash';
const PROVIDER_TIMEOUT_MS = 9000;
const TOTAL_BUDGET_MS = 25000;
const MIN_ATTEMPT_MS = 700;
const MAX_STATE_CHARS = 6000;
const MAX_QUESTIONS = 25;
const MAX_CRITERIA = 25;
const MAX_LABEL_CHARS = 240;

const ADAPTER_SYSTEM_PROMPT =
  'Sos el motor de evaluación determinística y probabilística System One de LaboraPy (Tobi). ' +
  'Respondé ÚNICAMENTE un JSON válido con la estructura solicitada, sin introducciones, ' +
  'sin comentarios y sin bloques markdown.';

function readEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) return '';
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeState(raw: unknown): string {
  if (typeof raw === 'string') return raw.slice(0, MAX_STATE_CHARS);
  if (raw && typeof raw === 'object') {
    try { return JSON.stringify(raw).slice(0, MAX_STATE_CHARS); } catch { return ''; }
  }
  return '';
}

function sanitizeQuestions(raw: unknown): Record<string, SystemOneQuestion> {
  if (!isRecord(raw)) return { ...TOBI_PERITAJE_QUESTIONS };
  const out: Record<string, SystemOneQuestion> = {};
  let count = 0;
  for (const [rawId, rawQ] of Object.entries(raw)) {
    if (count >= MAX_QUESTIONS) break;
    const id = rawId.slice(0, 60);
    if (!id || !isRecord(rawQ)) continue;
    const instructions = typeof rawQ.instructions === 'string' ? rawQ.instructions.slice(0, MAX_LABEL_CHARS) : '';
    if (!instructions) continue;
    if (rawQ.type === 'choice') {
      const criteria: Record<string, string> = {};
      if (isRecord(rawQ.criteria)) {
        for (const [k, v] of Object.entries(rawQ.criteria)) {
          if (Object.keys(criteria).length >= MAX_CRITERIA) break;
          if (typeof v === 'string') criteria[k.slice(0, 60)] = v.slice(0, MAX_LABEL_CHARS);
        }
      }
      if (Object.keys(criteria).length === 0) continue;
      out[id] = { type: 'choice', instructions, criteria };
    } else if (rawQ.type === 'score') {
      const criteria: string[] = [];
      if (Array.isArray(rawQ.criteria)) {
        for (const v of rawQ.criteria) {
          if (criteria.length >= MAX_CRITERIA) break;
          if (typeof v === 'string') criteria.push(v.slice(0, MAX_LABEL_CHARS));
        }
      }
      if (criteria.length === 0) continue;
      out[id] = { type: 'score', instructions, criteria };
    } else if (rawQ.type === 'noul') {
      out[id] = { type: 'noul', instructions, criteria: null };
    } else {
      continue;
    }
    count++;
  }
  return count > 0 ? out : { ...TOBI_PERITAJE_QUESTIONS };
}

function nonEmptyAnswers(answers: Record<string, SystemOneAnswer>): Record<string, SystemOneAnswer> | null {
  return Object.keys(answers).length > 0 ? answers : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callTypeSafe(state: string, questions: Record<string, SystemOneQuestion>, timeoutMs: number): Promise<Record<string, SystemOneAnswer> | null> {
  const apiKey = readEnv('TYPESAFE_API_KEY');
  if (!apiKey || timeoutMs <= 0) return null;
  const res = await fetchWithTimeout(TYPESAFE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ state, model: TYPESAFE_MODEL, questions }),
  }, timeoutMs);
  if (!res || !res.ok) return null;
  try {
    const data: unknown = await res.json();
    return nonEmptyAnswers(formatSystemOneAnswers(data, questions));
  } catch { return null; }
}

async function callGroqAdapter(state: string, questions: Record<string, SystemOneQuestion>, timeoutMs: number): Promise<Record<string, SystemOneAnswer> | null> {
  const apiKey = readEnv('GROQ_API_KEY');
  if (!apiKey || timeoutMs <= 0) return null;
  const prompt = buildSystemOnePrompt(state, questions);
  const res = await fetchWithTimeout(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: ADAPTER_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    }),
  }, timeoutMs);
  if (!res || !res.ok) return null;
  try {
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    return nonEmptyAnswers(formatSystemOneAnswers(parseSystemOneJson(content), questions));
  } catch { return null; }
}

async function callGeminiAdapter(state: string, questions: Record<string, SystemOneQuestion>, timeoutMs: number): Promise<Record<string, SystemOneAnswer> | null> {
  const apiKey = readEnv('GEMINI_API_KEY') || readEnv('VITE_GEMINI_API_KEY');
  if (!apiKey || timeoutMs <= 0) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildSystemOnePrompt(state, questions);
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ADAPTER_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  }, timeoutMs);
  if (!res || !res.ok) return null;
  try {
    const data: any = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('') : '';
    if (!text) return null;
    return nonEmptyAnswers(formatSystemOneAnswers(parseSystemOneJson(text), questions));
  } catch { return null; }
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method Not Allowed' }); return; }

  let state = '';
  let questions: Record<string, SystemOneQuestion> = { ...TOBI_PERITAJE_QUESTIONS };

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!isRecord(body)) { res.status(400).json({ ok: false, error: 'Body inválido: se espera JSON { state, questions }' }); return; }
    state = sanitizeState(body.state);
    questions = sanitizeQuestions(body.questions);
  } catch {
    res.status(400).json({ ok: false, error: 'Body inválido: no se pudo parsear el JSON' });
    return;
  }

  if (!state.trim()) { res.status(400).json({ ok: false, error: 'Se requiere un "state" no vacío' }); return; }

  const deadlineAt = Date.now() + TOTAL_BUDGET_MS;
  const budget = (): number => deadlineAt - Date.now();

  try {
    let answers: Record<string, SystemOneAnswer> | null = null;
    let provider = 'laborapy/heuristic';

    if (readEnv('TYPESAFE_API_KEY') && budget() > MIN_ATTEMPT_MS) {
      answers = await callTypeSafe(state, questions, Math.min(PROVIDER_TIMEOUT_MS, budget()));
      if (answers) provider = `typesafe/${TYPESAFE_MODEL}`;
    }
    if (!answers && readEnv('GROQ_API_KEY') && budget() > MIN_ATTEMPT_MS) {
      answers = await callGroqAdapter(state, questions, Math.min(PROVIDER_TIMEOUT_MS, budget()));
      if (answers) provider = `groq/${GROQ_MODEL}`;
    }
    if (!answers && (readEnv('GEMINI_API_KEY') || readEnv('VITE_GEMINI_API_KEY')) && budget() > MIN_ATTEMPT_MS) {
      answers = await callGeminiAdapter(state, questions, Math.min(PROVIDER_TIMEOUT_MS, budget()));
      if (answers) provider = `gemini/${GEMINI_MODEL}`;
    }
    if (!answers) {
      answers = deterministicAnswers(state, questions);
      provider = 'laborapy/heuristic';
    }

    res.status(200).json({ ok: true, model: provider, adapter: true, answers });
  } catch {
    res.status(200).json({
      ok: true,
      model: 'laborapy/heuristic',
      adapter: true,
      fallback: true,
      answers: deterministicAnswers(state, questions),
    });
  }
}
