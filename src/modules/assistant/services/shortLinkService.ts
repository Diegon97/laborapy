/**
 * SERVICIO CLIENTE DE ENLACES CORTOS (LABORAPY)
 * Acorta los enlaces de compartir conversación (#s= / #c=) llamando a /api/shorten
 * con fallback resiliente a TinyURL y caché en memoria.
 *
 * Estrategia de 3 capas:
 *   1. Caché en memoria (FIFO, tope 200 entradas) para evitar peticiones repetidas.
 *   2. Petición POST a /api/shorten con timeout (AbortController).
 *   3. Fallback directo a TinyURL si el endpoint local no está montado (ej. Vite standalone).
 *   4. Fallback seguro: devuelve SIEMPRE un enlace utilizable (canónico) si algo falla.
 *
 * SEGURIDAD (Zero-Leak):
 *   - No se manejan secretos ni tokens en el cliente.
 *   - La respuesta del endpoint se re-valida: https + host conocido (tinyurl.com/clck.ru)
 *     + estrictamente más corta que la original (anti open-redirect / anti basura).
 */

export const SHORTEN_ENDPOINT = '/api/shorten';
export const SHORT_LINK_TIMEOUT_MS = 4000;
export const MAX_SHORTENABLE_URL_LENGTH = 8000;
export const MAX_CACHE_ENTRIES = 200;

const TRUSTED_SHORT_HOSTS: readonly string[] = ['tinyurl.com', 'clck.ru'];

export type ShortLinkProvider = 'cache' | 'tinyurl' | 'clck' | 'canonical';

export interface ShortLinkResolution {
  url: string;
  provider: ShortLinkProvider;
  shortened: boolean;
}

const cache = new Map<string, string>();

export function clearShortLinkCache(): void {
  cache.clear();
}

export function getShortLinkCacheSize(): number {
  return cache.size;
}

function isShortenableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > MAX_SHORTENABLE_URL_LENGTH) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isTrustedShortUrl(candidate: unknown, original: string): candidate is string {
  if (typeof candidate !== 'string') return false;
  const value = candidate.trim();
  if (value.length === 0 || value.length >= original.length) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return TRUSTED_SHORT_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function rememberInCache(key: string, value: string): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
}

/**
 * Resuelve el enlace corto de una URL canónica. Nunca lanza: en cualquier
 * fallo (offline, timeout, respuesta inválida) devuelve la URL canónica.
 */
export async function resolveShortLink(canonicalUrl: string): Promise<ShortLinkResolution> {
  if (!isShortenableUrl(canonicalUrl)) {
    return { url: canonicalUrl, provider: 'canonical', shortened: false };
  }

  const trimmed = canonicalUrl.trim();

  const cached = cache.get(trimmed);
  if (cached) {
    return { url: cached, provider: 'cache', shortened: true };
  }

  // 1) Intento primario: endpoint serverless /api/shorten
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SHORT_LINK_TIMEOUT_MS);
    const response = await fetch(SHORTEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: trimmed }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (response.ok) {
      const payload = (await response.json()) as { shortUrl?: unknown; provider?: unknown } | null;
      const shortUrl = payload?.shortUrl;

      if (isTrustedShortUrl(shortUrl, trimmed)) {
        const provider: ShortLinkProvider = String(shortUrl).includes('clck.ru') ? 'clck' : 'tinyurl';
        rememberInCache(trimmed, shortUrl);
        return { url: shortUrl, provider, shortened: true };
      }
    }
  } catch {
    // Si /api/shorten falla (ej. Vite local sin Vercel CLI), intentar fallback directo
  }

  // 2) Fallback directo a TinyURL (resiliente para entorno local o bypass)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SHORT_LINK_TIMEOUT_MS);
    const directRes = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(trimmed)}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    if (directRes.ok) {
      const text = (await directRes.text()).trim();
      if (isTrustedShortUrl(text, trimmed)) {
        rememberInCache(trimmed, text);
        return { url: text, provider: 'tinyurl', shortened: true };
      }
    }
  } catch {
    // Silencioso: cae al fallback seguro canónico
  }

  return { url: trimmed, provider: 'canonical', shortened: false };
}

/** Atajo que devuelve directamente el string a copiar/compartir. */
export async function getShortLink(canonicalUrl: string): Promise<string> {
  const resolution = await resolveShortLink(canonicalUrl);
  return resolution.url;
}
