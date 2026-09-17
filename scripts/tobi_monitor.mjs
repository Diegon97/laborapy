#!/usr/bin/env node
/**
 * MONITOR DE TELEMETRÍA DE TOBI — LABORAPY
 *
 * Lee la tabla `tobi_events` de Supabase y muestra los últimos eventos del
 * asistente (proveedor que respondió, fallos de la cascada, adjuntos, duración).
 *
 * Requisitos (variables de entorno — sin credenciales hardcodeadas):
 *   SUPABASE_URL o VITE_SUPABASE_URL   → URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY          → key service_role (lectura)
 *
 * Uso:
 *   node scripts/tobi_monitor.mjs [--limit N] [--errors-only] [--kind <kind>] [--summary]
 *   Ej. PowerShell:
 *   $env:SUPABASE_URL='...'; $env:SUPABASE_SERVICE_ROLE_KEY='...'
 *   node scripts/tobi_monitor.mjs --limit 30
 *   node scripts/tobi_monitor.mjs --summary
 */

// --- Configuración desde entorno (fail-fast, sin secretos hardcodeados) ---
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Campos que se listan por evento y campos que necesita el resumen
const SELECT_LIST = 'created_at,kind,answered_provider,answered_model,providers_failed,attachment_kind,attachment_pages,duration_ms';
const SELECT_SUMMARY = 'kind,answered_provider,providers_failed,duration_ms';
const SUMMARY_LIMIT = 200;

const HELP_TEXT = [
  'MONITOR DE TELEMETRÍA DE TOBI — LABORAPY',
  '',
  'Uso:',
  '  node scripts/tobi_monitor.mjs [opciones]',
  '',
  'Opciones:',
  '  --limit N        Cantidad de eventos a listar (default: 20)',
  '  --errors-only    Excluye los eventos con kind = request_ok',
  '  --kind <kind>    Filtra por un kind exacto (request_ok | request_partial | request_fallback)',
  '  --summary        Modo resumen (últimos 200 eventos: kinds, proveedores, fallos y duración)',
  '  --help, -h       Muestra esta ayuda',
  '',
  'Variables de entorno:',
  '  SUPABASE_URL o VITE_SUPABASE_URL   URL del proyecto Supabase',
  '  SUPABASE_SERVICE_ROLE_KEY          key service_role (solo lectura)'
].join('\n');

// --- Parseo de argumentos CLI ---
function parseArgs(argv) {
  const opts = { limit: 20, errorsOnly: false, kind: null, summary: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--summary') {
      opts.summary = true;
    } else if (arg === '--errors-only') {
      opts.errorsOnly = true;
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const raw = arg.includes('=') ? arg.slice('--limit='.length) : argv[++i];
      const n = Number.parseInt(raw, 10);
      if (!Number.isInteger(n) || n <= 0 || String(n) !== String(raw).trim()) {
        throw new Error(`Valor inválido para --limit: "${raw}". Debe ser un entero positivo.`);
      }
      opts.limit = n;
    } else if (arg === '--kind' || arg.startsWith('--kind=')) {
      const raw = arg.includes('=') ? arg.slice('--kind='.length) : argv[++i];
      if (!raw || raw.startsWith('--')) {
        throw new Error(`Falta el valor de --kind. Ejemplo: --kind request_fallback`);
      }
      opts.kind = raw;
    } else {
      throw new Error(`Flag desconocido: "${arg}". Usá --help para ver las opciones.`);
    }
  }
  return opts;
}

// --- Consulta PostgREST con manejo de errores legible ---
async function fetchEvents(query) {
  const url = `${SUPABASE_URL}/rest/v1/tobi_events?${query}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json'
      }
    });
  } catch (err) {
    throw new Error(`No se pudo conectar con Supabase: ${err.message}`);
  }

  if (!res.ok) {
    const body = await res.text();
    // 404 / 42P01 => la tabla no existe todavía
    if (res.status === 404 || body.includes('42P01')) {
      throw new Error('La tabla tobi_events no existe: ejecutá supabase/schema_laborapy_tobi_telemetry.sql');
    }
    throw new Error(`Supabase HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

// --- Formateo de cada campo para el listado ---
function formatTime(value) {
  if (!value) return '--:--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('es-PY');
}

function formatProvider(ev) {
  if (!ev.answered_provider) return '-';
  return ev.answered_model ? `${ev.answered_provider}/${ev.answered_model}` : ev.answered_provider;
}

function formatAttachments(ev) {
  if (!ev.attachment_kind) return '-';
  const pages = Number.isFinite(ev.attachment_pages) ? ev.attachment_pages : 0;
  return `${ev.attachment_kind}(${pages})`;
}

function formatDuration(ev) {
  return Number.isFinite(ev.duration_ms) ? `${ev.duration_ms}ms` : '-';
}

function printEventLine(ev) {
  const fallos = ev.providers_failed ? ev.providers_failed : '-';
  console.log(`[${formatTime(ev.created_at)}] ${ev.kind} | ok=${formatProvider(ev)} | fallos=${fallos} | adj=${formatAttachments(ev)} | ${formatDuration(ev)}`);
}

// --- Tabla de texto simple para el resumen ---
function printTable(title, headers, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('  (sin datos)');
    return;
  }
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));
  for (const row of rows) {
    console.log(row.map((c, i) => String(c).padEnd(widths[i])).join(' | '));
  }
}

function sortEntriesDesc(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

// --- Modo listado (default) ---
async function runList(opts) {
  const params = [`select=${SELECT_LIST}`, 'order=created_at.desc', `limit=${opts.limit}`];
  if (opts.errorsOnly) params.push('kind=neq.request_ok');
  if (opts.kind) params.push(`kind=eq.${encodeURIComponent(opts.kind)}`);

  const events = await fetchEvents(params.join('&'));
  if (!Array.isArray(events) || events.length === 0) {
    console.log('(sin eventos para los filtros indicados)');
    return;
  }

  console.log(`📡 Últimos ${events.length} eventos de tobi_events:`);
  console.log('');
  for (const ev of events) printEventLine(ev);
}

// --- Modo resumen (--summary) ---
async function runSummary() {
  const params = [`select=${SELECT_SUMMARY}`, 'order=created_at.desc', `limit=${SUMMARY_LIMIT}`];
  const events = await fetchEvents(params.join('&'));

  if (!Array.isArray(events) || events.length === 0) {
    console.log('(sin eventos para resumir)');
    return;
  }

  const byKind = new Map();
  const byProvider = new Map();
  const byFailure = new Map();
  let durationSum = 0;
  let durationCount = 0;

  for (const ev of events) {
    byKind.set(ev.kind, (byKind.get(ev.kind) || 0) + 1);

    const provider = ev.answered_provider || '(sin proveedor)';
    byProvider.set(provider, (byProvider.get(provider) || 0) + 1);

    if (ev.providers_failed) {
      for (const part of String(ev.providers_failed).split(';')) {
        const reason = part.trim();
        if (reason) byFailure.set(reason, (byFailure.get(reason) || 0) + 1);
      }
    }

    if (Number.isFinite(ev.duration_ms)) {
      durationSum += ev.duration_ms;
      durationCount++;
    }
  }

  const total = events.length;
  console.log(`📊 Resumen de telemetría de Tobi (últimos ${total} eventos)`);

  const kindRows = sortEntriesDesc(byKind).map(([kind, count]) => [
    kind,
    count,
    `${((count / total) * 100).toFixed(1)}%`
  ]);
  printTable('Por kind:', ['kind', 'eventos', '%'], kindRows);

  const providerRows = sortEntriesDesc(byProvider).map(([provider, count]) => [
    provider,
    count,
    `${((count / total) * 100).toFixed(1)}%`
  ]);
  printTable('Por proveedor que respondió:', ['proveedor', 'eventos', '%'], providerRows);

  const failureRows = sortEntriesDesc(byFailure).slice(0, 5).map(([reason, count]) => [reason, count]);
  printTable('Top 5 motivos de fallo:', ['motivo', 'ocurrencias'], failureRows);

  const avg = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
  printTable('Duración:', ['métrica', 'valor'], [
    ['promedio (ms)', avg],
    ['muestras válidas', durationCount]
  ]);
}

// --- Punto de entrada ---
async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (opts.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (!SUPABASE_URL) {
    console.error('❌ Falta SUPABASE_URL (o VITE_SUPABASE_URL) en el entorno. Configurala antes de ejecutar el monitor.');
    process.exitCode = 1;
    return;
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. Se requiere para leer la telemetría.');
    process.exitCode = 1;
    return;
  }

  try {
    if (opts.summary) {
      await runSummary();
    } else {
      await runList(opts);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  }
}

await main();
