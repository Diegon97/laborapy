#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI CONSULT — Cliente de consulta directa para Termux y cualquier shell
 * ============================================================================
 * Habla con el Granjero (middleware local) que resuelve el nivel de razonamiento
 * y reenvía al Capataz -> Gemini. Sin dependencias externas (solo Node >= 18).
 *
 * USO:
 *   node tobi-consult.mjs flash "¿Cuál es el recargo nocturno?"
 *   node tobi-consult.mjs deepthink "Analizá este despido..."
 *   node tobi-consult.mjs max "Dictamen pericial completo sobre..."
 *   node tobi-consult.mjs                      # modo interactivo (REPL)
 *
 * VARIABLES DE ENTORNO:
 *   GRANJERO_URL    (default http://127.0.0.1:8319/v1/chat/completions)
 *   GRANJERO_TOKEN  (opcional) token Bearer si el granjero lo exige.
 *   TOBI_STREAM     "1" para mostrar la respuesta en streaming.
 * ============================================================================
 */

import readline from 'node:readline';

const GRANJERO_URL = process.env.GRANJERO_URL || 'http://127.0.0.1:8319/v1/chat/completions';
const GRANJERO_TOKEN = (process.env.GRANJERO_TOKEN || '').trim();
const USE_STREAM = process.env.TOBI_STREAM === '1';

const LEVELS = ['flash', 'deepthink', 'max', 'pro'];
const LEVEL_LABEL = {
  flash: '⚡ Flash (Gemini 3.7 · low)',
  deepthink: '🧠 DeepThink (Gemini 3.7 · medium)',
  max: '🔬 Max Thinking (Gemini 3.8 · high)',
  pro: '🏛️ Pro (Gemini 3.1 Pro)',
};

function usage() {
  console.log(`Uso: node tobi-consult.mjs [nivel] "consulta"

Niveles válidos: ${LEVELS.join(', ')}
  flash      -> Gemini 3.7 Flash (reasoning low)    — consulta rápida
  deepthink  -> Gemini 3.7 Flash (reasoning medium) — peritaje
  max        -> Gemini 3.8 Flash (reasoning high)   — máximo pensamiento
  pro        -> Gemini 3.1 Pro                      — arquitectura

Sin argumentos abre el modo interactivo.
Ejemplo: node tobi-consult.mjs deepthink "¿Cuántos días de vacaciones con 7 años de antigüedad?"`);
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (GRANJERO_TOKEN) headers.Authorization = `Bearer ${GRANJERO_TOKEN}`;
  return headers;
}

/**
 * Envía una consulta al granjero y devuelve el texto de respuesta.
 * @param {string} level
 * @param {string} query
 * @returns {Promise<string>}
 */
async function ask(level, query) {
  const res = await fetch(GRANJERO_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ model: level, messages: [{ role: 'user', content: query }], stream: false }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Granjero HTTP ${res.status}: ${detail.slice(0, 400)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error(`Respuesta sin contenido: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const meta = data.granjero;
  if (meta) {
    process.stderr.write(`   ↳ ${meta.level} · ${meta.model} · reasoning=${meta.reasoningEffort || 'n/a'}\n`);
  }
  return content;
}

async function askStream(level, query) {
  const res = await fetch(GRANJERO_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ model: level, messages: [{ role: 'user', content: query }], stream: true }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Granjero HTTP ${res.status}: ${detail.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
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
        const text = (json?.choices?.[0]?.delta?.content) || '';
        if (text) {
          full += text;
          process.stdout.write(text);
        }
      } catch {
        // chunk parcial: ignorar
      }
    }
  }
  process.stdout.write('\n');
  return full;
}

function separator() {
  console.log('\n' + '─'.repeat(72) + '\n');
}

async function runOnce(level, query) {
  if (!LEVELS.includes(level)) {
    console.error(`❌ Nivel inválido: "${level}". Válidos: ${LEVELS.join(', ')}`);
    process.exit(1);
  }
  try {
    if (USE_STREAM) {
      console.log(`\n${LEVEL_LABEL[level]}\n`);
      await askStream(level, query);
    } else {
      console.log(`\n${LEVEL_LABEL[level]}\n`);
      const answer = await ask(level, query);
      console.log(answer);
    }
    separator();
  } catch (err) {
    console.error(`❌ ${err && err.message ? err.message : err}`);
    process.exit(1);
  }
}

async function runInteractive() {
  console.log('🌾 Tobi — modo interactivo (Granjero ' + GRANJERO_URL + ')');
  console.log(`Comandos: :flash | :deepthink | :max | :pro | :salir\n`);

  let level = 'flash';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const promptNext = () => {
    rl.question(`[${level}] › `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return promptNext();

      if (trimmed === ':salir' || trimmed === ':exit' || trimmed === ':q') {
        rl.close();
        console.log('👋 Chau.');
        return;
      }
      if (trimmed.startsWith(':')) {
        const candidate = trimmed.slice(1).toLowerCase();
        if (LEVELS.includes(candidate)) {
          level = candidate;
          console.log(`✅ Nivel -> ${LEVEL_LABEL[level]}`);
        } else {
          console.log(`❌ Nivel desconocido. Válidos: ${LEVELS.join(', ')}`);
        }
        return promptNext();
      }

      try {
        const answer = USE_STREAM ? await askStream(level, trimmed) : await ask(level, trimmed);
        if (!USE_STREAM) console.log(`\n${answer}\n`);
      } catch (err) {
        console.error(`❌ ${err && err.message ? err.message : err}`);
      }
      return promptNext();
    });
  };

  promptNext();
}

const args = process.argv.slice(2);

if (args.length === 0) {
  runInteractive();
} else if (args[0] === '--help' || args[0] === '-h') {
  usage();
} else if (LEVELS.includes(args[0].toLowerCase())) {
  const level = args[0].toLowerCase();
  const query = args.slice(1).join(' ').trim();
  if (!query) {
    console.error('❌ Falta la consulta. Ejemplo: node tobi-consult.mjs flash "¿Cuál es el salario mínimo?"');
    process.exit(1);
  }
  runOnce(level, query);
} else {
  runOnce('flash', args.join(' '));
}
