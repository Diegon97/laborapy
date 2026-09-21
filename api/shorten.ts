/**
 * VERCEL SERVERLESS FUNCTION: ACORTADOR DE ENLACES DE CONVERSACIÓN (LABORAPY)
 * Convierte los enlaces kilométricos de compartir chat/finiquito (#s= / #c=)
 * en enlaces cortos de ~28 caracteres.
 *
 * Proveedores en cascada (con timeout):
 *   1. TinyURL  https://tinyurl.com/api-create.php
 *   2. clck.ru  https://clck.ru/--
 *
 * SEGURIDAD (SSRF / Zero-Leak):
 *   - Solo URLs http(s) absolutas y parseables.
 *   - Bloqueo de hosts loopback/privados/metadata (localhost, 10/8, 172.16/12,
 *     192.168/16, 169.254/16, ::1, fc00:, fe80:, *.local, *.internal).
 *   - Rechazo de credenciales embebidas (user:pass@host) para no filtrar secretos.
 *   - La URL se envía siempre con encodeURIComponent: cero inyección de query/CRLF.
 *   - La salida del acortador se re-valida (https + host conocido exacto) para
 *     evitar open-redirect si el proveedor devuelve contenido inesperado.
 *   - Sin credenciales en el código: APIs públicas sin API key.
 */

export const config = { maxDuration: 10 };

const PROVIDER_TIMEOUT_MS = 4000;
const MAX_TARGET_URL_LENGTH = 8000;
const MIN_TARGET_URL_LENGTH = 12;

const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^\[?::1\]?$/,
  /^127\./,
  /^0\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

interface SafetyVerdict {
  ok: boolean;
  reason?: string;
}

function validateTarget(raw: unknown): SafetyVerdict {
  if (typeof raw !== 'string') return { ok: false, reason: 'url_required' };

  const value = raw.trim();
  if (value.length < MIN_TARGET_URL_LENGTH) return { ok: false, reason: 'url_too_short' };
  if (value.length > MAX_TARGET_URL_LENGTH) return { ok: false, reason: 'url_too_long' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'url_unparseable' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'protocol_not_allowed' };
  }
  if (!parsed.hostname) return { ok: false, reason: 'host_missing' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials_not_allowed' };

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return { ok: false, reason: 'host_blocked' };
  }

  return { ok: true };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { accept: 'text/plain' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeProviderOutput(
  raw: string,
  expectedHost: string,
  target: string,
): string | null {
  const candidate = (raw || '').trim();
  if (!candidate || candidate.length >= target.length) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname.toLowerCase() !== expectedHost) return null;
  return candidate;
}

async function shortenWithTinyUrl(target: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(target)}`,
    );
    if (!response.ok) return null;
    return sanitizeProviderOutput(await response.text(), 'tinyurl.com', target);
  } catch {
    return null;
  }
}

async function shortenWithClck(target: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `https://clck.ru/--?url=${encodeURIComponent(target)}`,
    );
    if (!response.ok) return null;
    return sanitizeProviderOutput(await response.text(), 'clck.ru', target);
  } catch {
    return null;
  }
}

function readBodyUrl(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return (JSON.parse(body) as { url?: unknown } | null)?.url;
    } catch {
      return undefined;
    }
  }
  if (body && typeof body === 'object') {
    return (body as { url?: unknown }).url;
  }
  return undefined;
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req?.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req?.method !== 'POST') {
    res.status(405).json({ shortUrl: null, provider: null, error: 'method_not_allowed' });
    return;
  }

  const target = readBodyUrl(req?.body);
  const verdict = validateTarget(target);
  if (!verdict.ok) {
    res.status(400).json({ shortUrl: null, provider: null, error: verdict.reason });
    return;
  }

  const safeTarget = (target as string).trim();

  const tinyUrl = await shortenWithTinyUrl(safeTarget);
  if (tinyUrl) {
    res.status(200).json({ shortUrl: tinyUrl, provider: 'tinyurl' });
    return;
  }

  const clckUrl = await shortenWithClck(safeTarget);
  if (clckUrl) {
    res.status(200).json({ shortUrl: clckUrl, provider: 'clck' });
    return;
  }

  res.status(200).json({ shortUrl: null, provider: null, error: 'providers_unavailable' });
}
