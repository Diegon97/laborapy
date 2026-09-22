import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTobiLearningCandidates,
  updateTobiLearningCandidate,
  runTobiAutoCurator,
  getTobiLearningMetrics,
  TOBI_LEARNING_STORAGE_KEY,
  TOBI_LIVE_CONVERSATIONS_KEY,
  type TobiLearningCandidate,
} from '../services/tobiLearningService';

// Mock de localStorage con acceso directo al mapa subyacente para preparar fixtures
const createStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const buildCandidate = (
  id: string,
  consulta: string,
  autorizado: TobiLearningCandidate['autorizado'],
  correccion = ''
): TobiLearningCandidate => ({
  id,
  fecha: hoursAgo(1),
  consulta,
  respuesta_tobi: `Dictamen de prueba para ${id}`,
  proveedor: 'gemini',
  modelo: 'gemini-3.8-flash',
  articulos: ['Art. 84'],
  autorizado,
  correccion_diego: correccion,
});

describe('tobiLearningService - Centro de Aprendizaje Pericial de Tobi', () => {
  let mockLocal: ReturnType<typeof createStorageMock>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLocal = createStorageMock();
    vi.stubGlobal('localStorage', mockLocal);
    vi.stubGlobal('window', { localStorage: mockLocal });
    // Endpoint no disponible => el servicio debe degradar al almacén local
    fetchMock = vi.fn().mockRejectedValue(new Error('endpoint no disponible en test'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── 1. Obtención y filtrado por estado ────────────────────────────────

  it('debe pre-cargar candidatos periciales de demostración cuando el almacén está vacío', async () => {
    const seeded = await getTobiLearningCandidates('all');

    expect(seeded.length).toBe(3);
    expect(seeded.every(candidate => candidate.autorizado === 'PENDIENTE')).toBe(true);
    expect(seeded.some(candidate => candidate.articulos.length > 0)).toBe(true);
    expect(mockLocal.getItem(TOBI_LEARNING_STORAGE_KEY)).toBeTruthy();
  });

  it('debe filtrar los candidatos por estado y devolver todos por defecto', async () => {
    const fixture: TobiLearningCandidate[] = [
      buildCandidate('c1', 'Me despidieron sin causa y quiero saber qué me corresponde', 'PENDIENTE'),
      buildCandidate('c2', 'Descuento indebido del uniforme sobre el salario', 'AUTORIZADO', 'Criterio validado'),
      buildCandidate('c3', 'Consulta extranjera descartada sobre el IMSS', 'DESCARTADO', 'No aplica Paraguay'),
    ];
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify(fixture));

    const all = await getTobiLearningCandidates('all');
    expect(all).toHaveLength(3);

    const pending = await getTobiLearningCandidates('pending');
    expect(pending.map(candidate => candidate.id)).toEqual(['c1']);

    const authorized = await getTobiLearningCandidates('authorized');
    expect(authorized.map(candidate => candidate.id)).toEqual(['c2']);
    expect(authorized[0].correccion_diego).toBe('Criterio validado');

    const discarded = await getTobiLearningCandidates('discarded');
    expect(discarded.map(candidate => candidate.id)).toEqual(['c3']);

    const byDefault = await getTobiLearningCandidates();
    expect(byDefault).toHaveLength(3);
  });

  it('debe priorizar la respuesta del endpoint serverless sobre el almacén local', async () => {
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify([buildCandidate('local_1', 'Caso local', 'PENDIENTE')]));

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [buildCandidate('server_1', 'Caso devuelto por el servidor', 'PENDIENTE')],
        }),
    });

    const list = await getTobiLearningCandidates('all');

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('server_1');
    expect(mockLocal.getItem(TOBI_LEARNING_STORAGE_KEY)).toBeTruthy();
  });

  // ── 2. Actualización de candidatos ───────────────────────────────────

  it('debe autorizar un caso y sellar la fecha de auditoría', async () => {
    const fixture = [buildCandidate('c1', 'Me despidieron sin causa tras 4 años de antigüedad', 'PENDIENTE')];
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify(fixture));

    const result = await updateTobiLearningCandidate('c1', {
      autorizado: 'AUTORIZADO',
      correccion_diego: 'Corresponde Art. 84 y preaviso del Art. 87.',
    });
    expect(result.success).toBe(true);

    const updated = (await getTobiLearningCandidates('all')).find(candidate => candidate.id === 'c1');
    expect(updated?.autorizado).toBe('AUTORIZADO');
    expect(updated?.correccion_diego).toBe('Corresponde Art. 84 y preaviso del Art. 87.');
    expect(updated?.auditado_at).toBeTruthy();
  });

  it('debe descartar un caso manteniendo su comentario', async () => {
    const fixture = [buildCandidate('c1', 'Consulta sobre legislación extranjera (AFIP)', 'PENDIENTE')];
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify(fixture));

    const result = await updateTobiLearningCandidate('c1', {
      autorizado: 'DESCARTADO',
      correccion_diego: 'No aplica a Paraguay.',
    });
    expect(result.success).toBe(true);

    const updated = (await getTobiLearningCandidates('all')).find(candidate => candidate.id === 'c1');
    expect(updated?.autorizado).toBe('DESCARTADO');
    expect(updated?.correccion_diego).toBe('No aplica a Paraguay.');
    expect(updated?.auditado_at).toBeTruthy();
  });

  it('debe guardar únicamente el comentario sin alterar el estado ni la auditoría', async () => {
    const fixture = [buildCandidate('c1', 'Consulta sobre aguinaldo proporcional', 'PENDIENTE')];
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify(fixture));

    const result = await updateTobiLearningCandidate('c1', {
      correccion_diego: 'Aclarar que el aguinaldo se calcula sobre haberes devengados.',
    });
    expect(result.success).toBe(true);

    const updated = (await getTobiLearningCandidates('all')).find(candidate => candidate.id === 'c1');
    expect(updated?.autorizado).toBe('PENDIENTE');
    expect(updated?.correccion_diego).toBe('Aclarar que el aguinaldo se calcula sobre haberes devengados.');
    expect(updated?.auditado_at).toBeUndefined();
  });

  it('debe rechazar actualizaciones inválidas sin cambios ni identificador', async () => {
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify([buildCandidate('c1', 'Caso válido', 'PENDIENTE')]));

    const noId = await updateTobiLearningCandidate('   ', { autorizado: 'AUTORIZADO' });
    expect(noId.success).toBe(false);
    expect(noId.error).toContain('Identificador');

    const noChanges = await updateTobiLearningCandidate('c1', {});
    expect(noChanges.success).toBe(false);
    expect(noChanges.error).toContain('ningún cambio');

    const missing = await updateTobiLearningCandidate('inexistente', { autorizado: 'AUTORIZADO' });
    expect(missing.success).toBe(false);
    expect(missing.error).toContain('No se encontró');
  });

  // ── 3. Curador automático con deduplicación ──────────────────────────

  it('debe curar interacciones nuevas y deduplicar por consulta y por identificador', async () => {
    const duplicatedQuery = 'Me despidieron sin causa después de 4 años, ¿qué me corresponde?';
    mockLocal.setItem(
      TOBI_LEARNING_STORAGE_KEY,
      JSON.stringify([buildCandidate('c1', duplicatedQuery, 'PENDIENTE')])
    );

    mockLocal.setItem(
      TOBI_LIVE_CONVERSATIONS_KEY,
      JSON.stringify([
        {
          id: 'live_1',
          timestamp: hoursAgo(1),
          prompt: duplicatedQuery,
          response: 'Respuesta ya incorporada a la memoria.',
          metadata: { provider: 'gemini', model: 'gemini-3.8-flash' },
        },
        {
          id: 'live_2',
          timestamp: hoursAgo(1),
          prompt: 'Hola, buenas tardes',
          response: 'Saludo cordial de Tobi.',
          metadata: {},
        },
        {
          id: 'live_3',
          timestamp: hoursAgo(3),
          prompt: 'Me descuentan del sueldo el uniforme y no me inscribieron en IPS',
          response: 'Dictamen nuevo sobre descuentos indebidos y aportes.',
          metadata: { provider: 'deepseek', model: 'deepseek-v4.1-flash' },
        },
        {
          id: 'live_4',
          timestamp: hoursAgo(72),
          prompt: 'Consulta vieja fuera de la ventana de 24 horas sobre vacaciones',
          response: 'Dictamen antiguo.',
          metadata: {},
        },
      ])
    );

    const result = await runTobiAutoCurator(24);

    expect(result.success).toBe(true);
    expect(result.newCandidates).toBe(1);
    expect(result.message).toContain('1 caso');

    const all = await getTobiLearningCandidates('all');
    expect(all).toHaveLength(2);

    const created = all.find(candidate => candidate.id === 'tobi_interaccion_live_3');
    expect(created).toBeDefined();
    expect(created?.autorizado).toBe('PENDIENTE');
    expect(created?.proveedor).toBe('deepseek');
    expect(created?.modelo).toBe('deepseek-v4.1-flash');
    expect(created?.articulos).toContain('Dec-Ley 1860/50');

    expect(all.some(candidate => candidate.id === 'tobi_interaccion_live_2')).toBe(false);
    expect(all.some(candidate => candidate.id === 'tobi_interaccion_live_4')).toBe(false);
  });

  it('no debe volver a incorporar casos ya curados en una segunda ejecución', async () => {
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify([buildCandidate('c1', 'Caso previo', 'PENDIENTE')]));
    mockLocal.setItem(
      TOBI_LIVE_CONVERSATIONS_KEY,
      JSON.stringify([
        {
          id: 'live_9',
          timestamp: hoursAgo(2),
          prompt: 'Trabajé sin contrato ni IPS durante tres años, ¿puedo reclamar antigüedad?',
          response: 'Dictamen pericial completo.',
          metadata: {},
        },
      ])
    );

    const first = await runTobiAutoCurator(24);
    expect(first.newCandidates).toBe(1);

    const second = await runTobiAutoCurator(24);
    expect(second.success).toBe(true);
    expect(second.newCandidates).toBe(0);
    expect(second.message).toContain('Sin novedades');
  });

  it('debe informar sin novedades cuando no hay interacciones registradas', async () => {
    mockLocal.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify([buildCandidate('c1', 'Caso previo', 'PENDIENTE')]));

    const result = await runTobiAutoCurator(24);

    expect(result.success).toBe(true);
    expect(result.newCandidates).toBe(0);
    expect(result.message).toContain('Sin novedades');
    expect(await getTobiLearningCandidates('all')).toHaveLength(1);
  });

  // ── 4. Cálculo de métricas ───────────────────────────────────────────

  it('debe calcular las métricas agregadas del centro de aprendizaje', async () => {
    mockLocal.setItem(
      TOBI_LEARNING_STORAGE_KEY,
      JSON.stringify([
        buildCandidate('m1', 'Consulta pendiente uno sobre despido', 'PENDIENTE'),
        buildCandidate('m2', 'Consulta pendiente dos sobre preaviso', 'PENDIENTE'),
        buildCandidate('m3', 'Consulta autorizada sobre aguinaldo', 'AUTORIZADO'),
        buildCandidate('m4', 'Consulta descartada sobre IMSS', 'DESCARTADO'),
      ])
    );

    const metrics = await getTobiLearningMetrics();

    expect(metrics).toEqual({ total: 4, pending: 2, authorized: 1, discarded: 1 });
  });

  it('debe reportar métricas consistentes sobre los candidatos de demostración', async () => {
    const metrics = await getTobiLearningMetrics();

    expect(metrics.total).toBe(3);
    expect(metrics.pending).toBe(3);
    expect(metrics.authorized).toBe(0);
    expect(metrics.discarded).toBe(0);
  });
});
