import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSupabaseJurisprudence } from '../../../../api/assistant';

const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
const TEST_SERVICE_KEY = 'test-service-role-key';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

// Neutraliza SIEMPRE las variantes VITE_* y las claves del entorno real
function stubBaseEnv(): void {
  vi.stubEnv('SUPABASE_URL', TEST_SUPABASE_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', TEST_SERVICE_KEY);
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.stubEnv('CF_API_TOKEN', '');
  vi.stubEnv('CF_ACCOUNT_ID', '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchSupabaseJurisprudence — RAG semántico con fallback ILIKE garantizado', () => {
  it('usa embedding + RPC semántico cuando hay CF_API_TOKEN y hay matches', async () => {
    stubBaseEnv();
    vi.stubEnv('CF_API_TOKEN', 'test-cf-key');
    vi.stubEnv('CF_ACCOUNT_ID', 'test-account-id');

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = readUrl(input);
      calls.push(url);

      if (url.includes('embeddinggemma-300m')) {
        expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
        return jsonResponse({ success: true, result: { data: [new Array(768).fill(0.01)] } });
      }
      if (url.includes('/rpc/match_tobi_knowledge')) {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        expect(payload.match_threshold).toBe(0.3);
        expect(payload.match_count).toBe(4);
        expect(payload.query_embedding).toHaveLength(768);
        return jsonResponse([
          {
            id: 'a152db4e-0000-0000-0000-000000000000',
            content: 'Caso fáctico: Exigir factura legal a cajera con horario fijo. Criterio: No firmar renuncia. Art. 19 C.T.',
            metadata: { source: 'multimedia', type: 'audio_transcription' },
            similarity: 0.91,
          },
        ]);
      }
      throw new Error(`URL inesperada en test semántico: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSupabaseJurisprudence('despido sin registro en IPS', 2000);

    expect(result).toContain('Art. 19 C.T.');
    expect(calls.some((u) => u.includes('jurisprudencia_multimedia?'))).toBe(false);
  });

  it('cae al ILIKE cuando falta CF_API_TOKEN', async () => {
    stubBaseEnv();

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = readUrl(input);
      calls.push(url);
      if (url.includes('jurisprudencia_multimedia?')) {
        return jsonResponse([
          {
            titulo_tema: 'Despido injustificado',
            caso_abuso_detectado: 'Trabajador despedido sin preaviso',
            criterio_practico: 'Reclamar indemnización y preaviso',
            fundamento_juridico: 'Art. 84 C.T.',
          },
        ]);
      }
      throw new Error(`No debería llamarse sin CF_API_TOKEN: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSupabaseJurisprudence('despido injustificado sin preaviso', 2000);

    expect(result).toContain('Caso fáctico');
    expect(calls.some((u) => u.includes('embeddinggemma-300m'))).toBe(false);
  });

  it('cae al ILIKE cuando el RPC semántico devuelve 0 matches', async () => {
    stubBaseEnv();
    vi.stubEnv('CF_API_TOKEN', 'test-cf-key');
    vi.stubEnv('CF_ACCOUNT_ID', 'test-account-id');

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = readUrl(input);
      calls.push(url);
      if (url.includes('embeddinggemma-300m')) {
        return jsonResponse({ success: true, result: { data: [new Array(768).fill(0.02)] } });
      }
      if (url.includes('/rpc/match_tobi_knowledge')) return jsonResponse([]);
      if (url.includes('jurisprudencia_multimedia?')) {
        return jsonResponse([
          {
            titulo_tema: 'Renuncia forzada',
            caso_abuso_detectado: 'Caso fáctico de renuncia inducida',
            criterio_practico: 'Intimar reconocimiento de antigüedad',
            fundamento_juridico: 'Art. 243 C.T.',
          },
        ]);
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSupabaseJurisprudence('despido sin causa', 2000);

    expect(result).toContain('Caso fáctico');
    expect(result).toContain('Art. 243 C.T.');
    expect(calls.some((u) => u.includes('embeddinggemma-300m'))).toBe(true);
    expect(calls.some((u) => u.includes('/rpc/match_tobi_knowledge'))).toBe(true);
    expect(calls.some((u) => u.includes('jurisprudencia_multimedia?'))).toBe(true);
  });
});
