import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCsjJurisprudence, fetchSupabaseJurisprudence } from '../../../../api/assistant';

const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
const TEST_SERVICE_KEY = 'test-service-role-key';

interface CsjMatchMock {
  id: string;
  codigo_csj: number;
  tipo_resolucion: string;
  numero_resolucion: number;
  anio: number;
  fecha_resolucion: string;
  caratula: string;
  sala: string;
  resultado_accion: string;
  decision: string;
  url_documento: string;
  fragmento: string;
  rank: number;
}

const MOCK_CSJ_ITEMS: CsjMatchMock[] = [
  {
    id: 'b152db4e-0000-0000-0000-000000000001',
    codigo_csj: 10001,
    tipo_resolucion: 'A&S',
    numero_resolucion: 123,
    anio: 2024,
    fecha_resolucion: '2024-05-15',
    caratula: 'Juana Pérez c/ Textil del Este S.A. s/ Despido injustificado',
    sala: 'Sala Laboral',
    resultado_accion: 'Hacer lugar a la demanda laboral y condenar al pago de indemnizaciones',
    decision: 'Hacer lugar a la demanda laboral y condenar al pago de indemnizaciones',
    url_documento: 'https://www.csj.gov.py/jurisprudencia/resolucion_123_2024.pdf',
    fragmento: '«Corresponde la indemnización por despido injustificado y preaviso conforme al Código del Trabajo»',
    rank: 0.95,
  },
  {
    id: 'b152db4e-0000-0000-0000-000000000002',
    codigo_csj: 10002,
    tipo_resolucion: 'Auto Interlocutorio',
    numero_resolucion: 456,
    anio: 2023,
    fecha_resolucion: '2023-11-20',
    caratula: 'Carlos Gómez c/ Logística Guaraní S.R.L. s/ Cobro de guaraníes',
    sala: 'Sala Laboral',
    resultado_accion: 'Confirmar sentencia de primera instancia en todas sus partes',
    decision: 'Confirmar sentencia de primera instancia en todas sus partes',
    url_documento: 'https://www.csj.gov.py/jurisprudencia/resolucion_456_2023.pdf',
    fragmento: '«El cómputo de la antigüedad laboral se extiende hasta la fecha efectiva del cese de actividades»',
    rank: 0.88,
  },
];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function stubBaseEnv(): void {
  vi.stubEnv('SUPABASE_URL', TEST_SUPABASE_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', TEST_SERVICE_KEY);
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchCsjJurisprudence — Búsqueda RPC en jurisprudencia CSJ', () => {
  it('Caso 1: Retorno exitoso de RPC buscar_jurisprudencia_csj con 2 sentencias de la CSJ', async () => {
    stubBaseEnv();

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = readUrl(input);
      calls.push(url);

      if (url.includes('/rpc/buscar_jurisprudencia_csj')) {
        expect(init?.headers).toMatchObject({
          'Content-Type': 'application/json',
          apikey: TEST_SERVICE_KEY,
          Authorization: `Bearer ${TEST_SERVICE_KEY}`,
        });
        return jsonResponse(MOCK_CSJ_ITEMS);
      }
      throw new Error(`URL no esperada en Caso 1: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCsjJurisprudence('despido injustificado', 2000);

    expect(calls.some((u) => u.includes('/rpc/buscar_jurisprudencia_csj'))).toBe(true);

    // Verificación de campos requeridos para Sentencia 1
    expect(result).toContain('A&S');
    expect(result).toContain('123');
    expect(result).toContain('2024');
    expect(result).toContain('Juana Pérez c/ Textil del Este S.A.');
    expect(result).toContain('Hacer lugar a la demanda laboral');
    expect(result).toContain('Corresponde la indemnización por despido injustificado y preaviso');

    // Verificación de campos requeridos para Sentencia 2
    expect(result).toContain('Auto Interlocutorio');
    expect(result).toContain('456');
    expect(result).toContain('2023');
    expect(result).toContain('Carlos Gómez c/ Logística Guaraní S.R.L.');
    expect(result).toContain('Confirmar sentencia de primera instancia');
    expect(result).toContain('cómputo de la antigüedad laboral');
  });

  it('Caso 2a: Error 500 del backend devuelve string vacío limpiamente sin lanzar excepciones', async () => {
    stubBaseEnv();

    const fetchMock = vi.fn(async (): Promise<Response> => {
      return jsonResponse({ message: 'Internal Server Error' }, false, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCsjJurisprudence('estabilidad laboral', 2000);
    expect(result).toBe('');
  });

  it('Caso 2b: Timeout de red o caída de conexión devuelve string vacío limpiamente', async () => {
    stubBaseEnv();

    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error('Connection timed out / aborted');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCsjJurisprudence('despido con causa', 2000);
    expect(result).toBe('');
  });

  it('Caso 3: Array vacío devuelto por la CSJ (sin coincidencia) devuelve string vacío', async () => {
    stubBaseEnv();

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = readUrl(input);
      if (url.includes('/rpc/buscar_jurisprudencia_csj')) {
        return jsonResponse([]);
      }
      throw new Error(`URL no esperada en Caso 3: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCsjJurisprudence('término inexistente xkwqz', 2000);
    expect(result).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Caso 4: Parámetros vacíos o query en blanco devuelve string vacío sin invocar fetch', async () => {
    stubBaseEnv();

    const fetchMock = vi.fn(async (): Promise<Response> => {
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const resEmpty = await fetchCsjJurisprudence('', 2000);
    expect(resEmpty).toBe('');

    const resSpaces = await fetchCsjJurisprudence('     ', 2000);
    expect(resSpaces).toBe('');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Caso 4b: Ausencia de variables de entorno de Supabase devuelve string vacío sin invocar fetch', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCsjJurisprudence('despido injustificado', 2000);
    expect(result).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchSupabaseJurisprudence — Integración combinada CSJ y Multimedia', () => {
  it('Caso 5: Integración combinada: cuando hay CSJ y hay multimedia, incluye ambas secciones', async () => {
    stubBaseEnv();
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = readUrl(input);
      calls.push(url);

      if (url.includes('/rpc/buscar_jurisprudencia_csj')) {
        return jsonResponse([MOCK_CSJ_ITEMS[0]]);
      }
      if (url.includes(':embedContent')) {
        return jsonResponse({ embedding: { values: new Array(768).fill(0.01) } });
      }
      if (url.includes('/rpc/buscar_criterios_laborales')) {
        return jsonResponse([
          {
            id: 'a152db4e-0000-0000-0000-000000000000',
            autor_handle: '@juanbernis',
            autor_nombre: 'Abg. Juan Bernis',
            titulo_tema: 'Primacía de la realidad en tercerizaciones',
            caso_abuso_detectado: 'Exigir factura legal con horario estricto',
            fundamento_juridico: 'Art. 19 C.T. (Primacía de la Realidad)',
            criterio_practico: 'No firmar renuncia y remitir telegrama colacionado',
            articulos_citados: ['Art. 19'],
            url_video: 'https://example.com/video',
            similarity: 0.93,
          },
        ]);
      }
      if (url.includes('jurisprudencia_multimedia?')) {
        return jsonResponse([
          {
            titulo_tema: 'Primacía de la realidad en tercerizaciones',
            caso_abuso_detectado: 'Exigir factura legal con horario estricto',
            criterio_practico: 'No firmar renuncia y remitir telegrama colacionado',
            fundamento_juridico: 'Art. 19 C.T.',
          },
        ]);
      }
      throw new Error(`URL no manejada en Caso 5: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSupabaseJurisprudence('despido y primacia de la realidad', 3000);

    // Sección CSJ
    expect(result).toContain('A&S');
    expect(result).toContain('123');
    expect(result).toContain('Juana Pérez c/ Textil del Este S.A.');
    expect(result).toContain('Hacer lugar a la demanda laboral');

    // Sección Multimedia / Criterio Doctrinario
    expect(result).toContain('Abg. Juan Bernis');
    expect(result).toContain('Primacía de la realidad');
    expect(result).toContain('Art. 19 C.T.');
  });
});
