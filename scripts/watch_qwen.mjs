#!/usr/bin/env node
/**
 * WATCH_QWEN — monitor TUI en vivo de la Fase 2 del entrenamiento de Tobi (Qwen 2.5).
 * Solo lectura (nunca escribe en disco), sin dependencias npm.
 * Uso: node scripts/watch_qwen.mjs [--refresh=N] [--once] [--no-color]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_PATH = path.join(__dirname, 'deep_improvement_progress.json');
const LOG_PATH = path.join(__dirname, 'deep_improvement_console.log');
const OLLAMA_PS_URL = 'http://localhost:11434/api/ps';
const WIDTH = 100, BAR_CELLS = 18, CASES_SHOWN = 8, LOG_LINES_SHOWN = 12;
const TAIL_LINES = 60, TAIL_MAX_BYTES = 262144, MINUTES_PER_CASE = 10;
const SPINNER_BRAILLE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_ASCII = ['|', '/', '-', '\\'];
const HELP = [
  'WATCH_QWEN — monitor en vivo de la Fase 2 (Qwen 2.5)',
  'Uso: node scripts/watch_qwen.mjs [--refresh=N] [--once] [--no-color]',
  '  --refresh=N  segundos entre refrescos (default 3, mínimo 1)',
  '  --once       renderiza un único frame y sale',
  '  --no-color   sin códigos ANSI (símbolos ASCII)',
  '  --help, -h   muestra esta ayuda'
].join('\n');

// --- Estado en memoria (actividad, spinner y cache de Ollama) ---------------
let spinning = 0, refreshCount = 0, lastActivity = null, activitySinceMs = 0;
let ollamaCache = { ok: false, model: null, error: 'consultando...' };

// --- CLI --------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { refresh: 3, once: false, noColor: false };
  const args = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--once') opts.once = true;
    else if (arg === '--no-color') opts.noColor = true;
    else if (arg === '--help' || arg === '-h') { console.log(HELP); process.exit(0); }
    else if (arg === '--refresh' || arg.startsWith('--refresh=')) {
      const raw = arg.includes('=') ? arg.slice('--refresh='.length) : args[++i];
      const n = Number.parseInt(raw, 10);
      if (Number.isInteger(n) && n >= 1) opts.refresh = n;
      else console.warn(`⚠️ --refresh inválido ("${raw ?? ''}"); uso ${opts.refresh}s.`);
    } else console.warn(`⚠️ Flag desconocido ignorado: ${arg}`);
  }
  return opts;
}

// --- Utilidades de formato --------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => (Number.isFinite(v) ? v : 0);

function pad(text, len) {
  const s = text == null ? '' : String(text);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function truncate(text, max) {
  const s = text == null ? '' : String(text);
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function humanAge(ms) {
  if (!Number.isFinite(ms)) return '—';
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

function makePalette(enabled) {
  const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);
  return { enabled, bold: wrap('1'), dim: wrap('2'), cyan: wrap('36'), green: wrap('32'), yellow: wrap('33'), red: wrap('31') };
}

function makeGlyphs(ascii) {
  return ascii
    ? { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', barFull: '#', barEmpty: '-', dot: '.' }
    : { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', barFull: '█', barEmpty: '░', dot: '·' };
}

function sectionHeader(title, G, P) {
  const head = `  ${G.h}${G.h} ${title} `;
  return P.cyan(head + G.h.repeat(Math.max(0, WIDTH - 2 - head.length)));
}

function caseGlyph(status, ascii) {
  const map = { verified: ['✅', '[OK]'], unverified: ['⚠️', '[!]'], requeued: ['🔄', '[~]'], deadline: ['⏰', '[T]'], failed: ['❌', '[X]'], running: ['⏩', '[>]'] };
  const pair = map[String(status || '').toLowerCase()] || ['•', '-'];
  return ascii ? pair[1] : pair[0];
}

function caseColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'verified') return 'green';
  if (s === 'failed' || s === 'deadline') return 'red';
  if (s === 'requeued' || s === 'unverified') return 'yellow';
  if (s === 'running') return 'cyan';
  return 'dim';
}

function caseStatusText(c) {
  const s = String(c?.status || '').toLowerCase();
  if (s === 'requeued') return `re-encolado (ciclo ${num(c?.cycles)})`;
  return { verified: 'verificado', unverified: 'sin verificar', deadline: 'deadline', failed: 'falló', running: 'en curso' }[s] || s || '(desconocido)';
}

function colorLogLine(text, raw, P) {
  if (raw.includes('VERIFICADO')) return P.green(text);
  if (raw.includes('Error') || raw.includes('❌') || raw.includes('⏰')) return P.red(text);
  if (raw.includes('estudio') || raw.includes('re-test')) return P.cyan(text);
  return P.dim(text);
}

function deriveStatus(progress, ageMs) {
  const s = String(progress?.status || '').toLowerCase();
  if (s === 'completed') return { icon: '🏁', ascii: '[OK]', color: 'green', text: 'COMPLETADO' };
  if (s === 'interrupted') return { icon: '⏹️', ascii: '[STOP]', color: 'yellow', text: 'INTERRUMPIDO' };
  if (s === 'aborted') return { icon: '🚫', ascii: '[X]', color: 'red', text: 'ABORTADO' };
  const minutes = ageMs / 60000;
  if (minutes < 8) return { icon: '🟢', ascii: '[OK]', color: 'green', text: 'CORRIENDO' };
  if (minutes <= 15) return { icon: '🟡', ascii: '[!]', color: 'yellow', text: `SIN CAMBIOS HACE ${Math.floor(minutes)}m` };
  return { icon: '🔴', ascii: '[X]', color: 'red', text: 'DETENIDO/TERMINADO' };
}

function renderOllama(ollama, now, P) {
  if (!ollama?.ok || !ollama.model) return P.yellow('no cargado / sin conexión');
  const m = ollama.model;
  const gb = m.sizeBytes != null ? ` · ${(m.sizeBytes / 1073741824).toFixed(1)} GB` : '';
  let exp = '';
  if (m.expiresAt) {
    const left = Math.round((Date.parse(m.expiresAt) - now.getTime()) / 60000);
    exp = ` · ${left > 0 ? `expira en ${left}m` : 'expirado'}`;
  }
  return P.green(`${m.name || '(desconocido)'}${gb}${exp}`);
}

// --- Lectura defensiva de datos ---------------------------------------------
function readProgress() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function logMtimeMs() {
  try { return fs.statSync(LOG_PATH).mtimeMs; } catch { return 0; }
}

function readTail(filePath, maxLines) {
  try {
    const stat = fs.statSync(filePath);
    const bytes = Math.min(stat.size, TAIL_MAX_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(bytes);
    fs.readSync(fd, buf, 0, bytes, stat.size - bytes);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split(/\r?\n/);
    if (stat.size > bytes && lines.length > 0) lines.shift();
    return lines.filter((l) => l.length > 0).slice(-maxLines);
  } catch { return []; }
}

function findActivity(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/\[[A-Za-z]+-?\d+\]/.test(line) || line.includes('VERIFICADO') || line.includes('Error')) return line.trim();
  }
  return null;
}

async function fetchOllama() {
  try {
    const res = await fetch(OLLAMA_PS_URL, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, model: null, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    if (models.length === 0) return { ok: false, model: null, error: 'sin modelos' };
    const m = models[0];
    return {
      ok: true,
      model: {
        name: typeof m?.name === 'string' ? m.name : '(desconocido)',
        sizeBytes: Number.isFinite(m?.size) ? m.size : null,
        expiresAt: typeof m?.expires_at === 'string' ? m.expires_at : null
      },
      error: null
    };
  } catch (err) {
    return { ok: false, model: null, error: err?.name === 'TimeoutError' ? 'timeout' : 'sin conexión' };
  }
}

// --- Render del frame -------------------------------------------------------
function buildFrame(ctx) {
  const { progress, logLines, activity, activitySinceMs, ollama, now, opts, colorEnabled } = ctx;
  const ascii = !colorEnabled;
  const G = makeGlyphs(ascii);
  const P = makePalette(colorEnabled);
  const out = [];
  const inner = WIDTH - 2;

  const title = `  ${ascii ? '[QWEN]' : '🧠'} QWEN 2.5 EN VIVO — Tobi Deep Improvement (Fase 2)`;
  out.push(P.cyan(G.tl + G.h.repeat(inner) + G.tr));
  out.push(P.cyan(G.v) + P.bold(pad(title, inner)) + P.cyan(G.v));
  out.push(P.cyan(G.bl + G.h.repeat(inner) + G.br));

  const spinnerFrames = ascii ? SPINNER_ASCII : SPINNER_BRAILLE;
  const spinner = spinnerFrames[spinning % spinnerFrames.length];
  const tick = P.dim(G.dot);

  if (progress) {
    const updatedMs = progress.updatedAt ? Date.parse(progress.updatedAt) : NaN;
    const refMs = Math.max(Number.isFinite(updatedMs) ? updatedMs : 0, logMtimeMs());
    const ageMs = refMs > 0 ? Math.max(0, now.getTime() - refMs) : Infinity;
    const st = deriveStatus(progress, ageMs);
    const clock = `Hora: ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const ageTxt = Number.isFinite(ageMs) ? `(última actualización hace ${humanAge(ageMs)})` : '(sin marca de tiempo)';
    out.push('  Estado:    ' + P[st.color](`${ascii ? st.ascii : st.icon} ${st.text}`) + ' ' + P.dim(ageTxt) + '   ' + P.dim(clock));

    if (activity) {
      const since = activitySinceMs > 0 ? ` — en curso hace ${humanAge(now.getTime() - activitySinceMs)}` : '';
      out.push('  Actividad: ' + P.cyan(`${spinner} ${truncate(activity, 70)}`) + P.dim(since));
    } else {
      out.push('  Actividad: ' + P.dim('(sin actividad registrada en el log)'));
    }

    const total = Math.max(1, num(progress.weakTotal) + num(progress.nearTotal));
    const processed = num(progress.processed);
    const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((processed / total) * BAR_CELLS)));
    const bar = P.green(G.barFull.repeat(filled)) + P.dim(G.barEmpty.repeat(BAR_CELLS - filled));
    out.push(`  Progreso:  [${bar}]  ${processed}/${total}  ${tick}  ${ascii ? '[OK]' : '✅'} verificados ${num(progress.verifiedImproved)}  ${tick}  ${ascii ? '[!]' : '⚠️'} sin verificar ${num(progress.unverified)}  ${tick}  ${ascii ? '[~]' : '🔄'} re-encolados ${num(progress.requeued)}`);

    const deadlineMs = progress.deadlineAt ? Date.parse(progress.deadlineAt) : NaN;
    let deadlineTxt = 'sin deadline';
    if (Number.isFinite(deadlineMs)) {
      const dl = new Date(deadlineMs);
      const diff = deadlineMs - now.getTime();
      const rel = diff >= 0 ? `faltan ${humanAge(diff)}` : `vencido hace ${humanAge(-diff)}`;
      deadlineTxt = `${pad2(dl.getHours())}:${pad2(dl.getMinutes())} (${rel})`;
    }
    const pendientes = Math.max(0, total - processed) + num(progress.requeued);
    const eta = new Date(now.getTime() + pendientes * MINUTES_PER_CASE * 60000);
    out.push('  Deadline:  ' + P.bold(deadlineTxt) + '  ' + tick + '  ' + P.dim(`ETA aprox fin de cola: ~${pad2(eta.getHours())}:${pad2(eta.getMinutes())}`));

    out.push('  Ollama:    ' + renderOllama(ollama, now, P));
    out.push(sectionHeader('Últimos casos', G, P));

    const cases = Array.isArray(progress.cases) ? progress.cases.slice(-CASES_SHOWN) : [];
    if (cases.length === 0) out.push(P.dim('   (sin casos registrados todavía)'));
    else for (const c of cases) {
      const score = c?.score != null && c.score !== ''
        ? (typeof c.score === 'number' ? `${Math.round(c.score)}/100` : String(c.score))
        : '';
      out.push('  ' + caseGlyph(c?.status, ascii) + ' ' + pad(c?.id ?? '????', 7) + ' ' + pad(c?.title ?? '', 34) + ' ' + pad(score, 8) + ' ' + P[caseColor(c?.status)](caseStatusText(c)));
    }
  } else {
    out.push('  ' + P.yellow(`${ascii ? '[~]' : '⏳'} esperando datos... (no existe ${path.basename(PROGRESS_PATH)})`));
    out.push('  Ollama:    ' + renderOllama(ollama, now, P));
  }

  out.push(sectionHeader(`Registro en vivo (últimas ${LOG_LINES_SHOWN} líneas)`, G, P));
  const shown = logLines.slice(-LOG_LINES_SHOWN);
  if (shown.length === 0) out.push(P.dim('   (sin registro todavía)'));
  else for (const line of shown) out.push(colorLogLine('  ' + truncate(line.trim(), 94), line, P));

  out.push(P.dim('  ' + G.h.repeat(WIDTH - 4)));
  out.push(P.dim(`  Ctrl+C para cerrar · refresh ${opts.refresh}s · scripts/watch_qwen.mjs`));
  return out.join('\n');
}

// --- Recolección de datos ---------------------------------------------------
async function gather() {
  const progress = readProgress();
  const logLines = readTail(LOG_PATH, TAIL_LINES);
  const activity = findActivity(logLines);
  if (activity !== null && activity !== lastActivity) {
    lastActivity = activity;
    activitySinceMs = Date.now();
  }
  if (refreshCount % 3 === 0) ollamaCache = await fetchOllama();
  refreshCount += 1;
  return { progress, logLines, activity: lastActivity, activitySinceMs, ollama: ollamaCache };
}

async function renderOnce(opts, colorEnabled) {
  const data = await gather();
  const frame = buildFrame({ ...data, now: new Date(), opts, colorEnabled });
  spinning += 1;
  return frame;
}

// --- Punto de entrada -------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tty = Boolean(process.stdout.isTTY);
  const colorEnabled = !opts.noColor && tty;

  if (opts.once) {
    process.stdout.write((await renderOnce(opts, colorEnabled)) + '\n');
    return;
  }

  const showCursor = () => { if (tty) process.stdout.write('\x1b[?25h'); };
  if (tty) process.stdout.write('\x1b[?25l');
  process.on('exit', showCursor);
  process.on('SIGINT', () => { showCursor(); process.exit(0); });
  process.on('SIGTERM', () => { showCursor(); process.exit(0); });

  const draw = async () => {
    try {
      const frame = await renderOnce(opts, colorEnabled);
      if (tty) process.stdout.write('\x1b[H\x1b[J' + frame);
      else process.stdout.write('\n' + '='.repeat(WIDTH) + '\n' + frame + '\n');
    } catch (err) {
      const msg = `❌ Error en el refresco: ${err?.message ? err.message : String(err)}\n`;
      process.stdout.write(tty ? '\x1b[H\x1b[J' + msg : msg);
    }
  };

  await draw();
  setInterval(draw, opts.refresh * 1000);
}

main().catch((err) => {
  console.error(`❌ Error fatal en watch_qwen: ${err?.message ? err.message : String(err)}`);
  process.exit(1);
});