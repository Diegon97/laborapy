import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getShortLink,
  resolveShortLink,
  clearShortLinkCache,
  getShortLinkCacheSize,
  SHORTEN_ENDPOINT,
} from '../services/shortLinkService';

const CANONICAL_URL = `https://laborapy.com/calculadora#s=${'A'.repeat(1500)}`;
const TINY_URL = 'https://tinyurl.com/2abc9xyz'; // 28 caracteres
const CLCK_URL = 'https://clck.ru/3AbCdE'; // 22 caracteres

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function installFetch(impl: (input: unknown, init?: unknown) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('shortLinkService — Enlaces cortos de conversación (LaboraPy)', () => {
  beforeEach(() => {
    clearShortLinkCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. acorta la URL canónica con TinyURL y devuelve exactamente 28 caracteres', async () => {
    installFetch(async () => mockResponse({ shortUrl: TINY_URL, provider: 'tinyurl' }));

    const short = await getShortLink(CANONICAL_URL);

    expect(short).toBe(TINY_URL);
    expect(short.length).toBe(28);
    expect(short.length).toBeLessThan(CANONICAL_URL.length);
  });

  it('2. llama a /api/shorten por POST enviando { url } en el cuerpo', async () => {
    const fetchMock = installFetch(async () =>
      mockResponse({ shortUrl: TINY_URL, provider: 'tinyurl' }),
    );

    await getShortLink(CANONICAL_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(SHORTEN_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ url: CANONICAL_URL });
  });

  it('3. reutiliza la caché en memoria y no dispara una segunda petición de red', async () => {
    const fetchMock = installFetch(async () =>
      mockResponse({ shortUrl: TINY_URL, provider: 'tinyurl' }),
    );

    const first = await getShortLink(CANONICAL_URL);
    const second = await getShortLink(CANONICAL_URL);

    expect(first).toBe(TINY_URL);
    expect(second).toBe(TINY_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getShortLinkCacheSize()).toBe(1);

    const resolution = await resolveShortLink(CANONICAL_URL);
    expect(resolution.provider).toBe('cache');
  });

  it('4. soporta clck.ru como proveedor alternativo (22 caracteres)', async () => {
    installFetch(async () => mockResponse({ shortUrl: CLCK_URL, provider: 'clck' }));

    const resolution = await resolveShortLink(CANONICAL_URL);

    expect(resolution.shortened).toBe(true);
    expect(resolution.provider).toBe('clck');
    expect(resolution.url).toBe(CLCK_URL);
    expect(resolution.url.length).toBe(22);
  });

  it('5. devuelve la URL canónica cuando el endpoint responde con error HTTP y fallback directo falla', async () => {
    installFetch(async () =>
      mockResponse({ error: 'providers_unavailable' }, { ok: false, status: 502 }),
    );

    await expect(getShortLink(CANONICAL_URL)).resolves.toBe(CANONICAL_URL);
  });

  it('6. devuelve la URL canónica cuando el proveedor no devuelve shortUrl válido', async () => {
    installFetch(async () => mockResponse({ shortUrl: null, provider: null }));

    await expect(getShortLink(CANONICAL_URL)).resolves.toBe(CANONICAL_URL);
  });

  it('7. rechaza un shortUrl de dominio no confiable (anti open-redirect)', async () => {
    installFetch(async () => mockResponse({ shortUrl: 'https://evil.example.com/abc' }));

    await expect(getShortLink(CANONICAL_URL)).resolves.toBe(CANONICAL_URL);
  });

  it('8. devuelve la URL canónica si la petición es abortada por timeout en ambos proveedores', async () => {
    installFetch(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    await expect(getShortLink(CANONICAL_URL)).resolves.toBe(CANONICAL_URL);
  });

  it('9. devuelve la URL canónica ante un error de red (offline)', async () => {
    installFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(getShortLink(CANONICAL_URL)).resolves.toBe(CANONICAL_URL);
  });

  it('10. cae a fallback directo a TinyURL si /api/shorten no está disponible', async () => {
    const fetchMock = installFetch(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/api/shorten')) {
        throw new Error('Vite dev: 404 endpoint not found');
      }
      if (url.includes('tinyurl.com/api-create.php')) {
        return mockResponse(TINY_URL);
      }
      return mockResponse('', { ok: false, status: 404 });
    });

    const short = await getShortLink(CANONICAL_URL);
    expect(short).toBe(TINY_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
