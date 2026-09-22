/**
 * SERVICIO DE CURACIÓN Y APRENDIZAJE PERICIAL DE TOBI — LABORAPY
 * Curación automática de interacciones y memoria pericial (Ley N.º 213/93 y concordantes).
 *
 * Estrategia de persistencia tolerante a fallos (el usuario nunca ejecuta comandos):
 *  1. Endpoints serverless: GET/PATCH `/api/tobi-learning` y POST `/api/tobi-curator`
 *     (disparados por el cron de Vercel).
 *  2. Fallback a localStorage (`laborapy_tobi_learning_candidates`) para desarrollo local,
 *     modo offline o si el endpoint aún no está desplegado.
 *
 * El curador local replica el filtro heurístico y la clasificación de artículos de
 * `scripts/tobi_daily_curator.mjs` (filtro Oiko / TikTok) sobre el histórico de
 * conversaciones que produce `recordLiveConversation` (`tobi_live_training_conversations`).
 *
 * Versión: PY-TOBI-LEARNING-2026.09.21
 */

import { sanitizeInput } from '../../../lib/crypto';

export type TobiCandidateStatus = 'PENDIENTE' | 'AUTORIZADO' | 'DESCARTADO';

export interface TobiLearningCandidate {
  id: string;
  fecha: string;
  consulta: string;
  respuesta_tobi: string;
  proveedor: string;
  modelo: string;
  articulos: string[];
  autorizado: TobiCandidateStatus;
  correccion_diego: string;
  auditado_at?: string;
}

export interface TobiLearningMetrics {
  total: number;
  pending: number;
  authorized: number;
  discarded: number;
}

export type TobiLearningFilter = 'all' | 'pending' | 'authorized' | 'discarded';

export interface TobiCandidateUpdate {
  autorizado?: TobiCandidateStatus;
  correccion_diego?: string;
}

export const TOBI_LEARNING_STORAGE_KEY = 'laborapy_tobi_learning_candidates';
export const TOBI_LEARNING_ENDPOINT = '/api/tobi-learning';
export const TOBI_CURATOR_ENDPOINT = '/api/tobi-curator';
/** Histórico local escrito por `recordLiveConversation` (TobiChatLanding.tsx). */
export const TOBI_LIVE_CONVERSATIONS_KEY = 'tobi_live_training_conversations';

const DEFAULT_CURATOR_HOURS = 24;
const MAX_CONSULTA_LENGTH = 1200;
const MAX_RESPUESTA_LENGTH = 500;

/** Términos de legislación extranjera vetados (mismo criterio que scripts/tobi_daily_curator.mjs). */
const TERMINOS_EXTRANJEROS: RegExp[] = [
  /\bimss\b/i, /\bafore\b/i, /\blft\b/i, /\bprofedet\b/i, /\bconciliacion y arbitraje\b/i,
  /\blct\b/i, /\bafip\b/i, /\banses\b/i, /\bseclo\b/i, /\bmonotributo\b/i,
  /\bsmac\b/i, /\bestatuto de los trabajadores\b/i, /\bdireccion del trabajo chile\b/i,
  /\bpesos\b/i, /\bsoles\b/i, /\bcolones\b/i, /\beuros\b/i,
];

const RE_SOLO_SALUDO = /^(?:hola|buenas|saludos|buen dia|buenos dias|buenas tardes|buenas noches|doctor|dr|dra|gracias|muchas gracias|chau|adios|👍|👏|😊|🙏|[\s,;.!?-])+$/i;

interface RawTobiInteraction {
  id: string;
  timestamp: string;
  prompt: string;
  response: string;
  provider: string;
  model: string;
}

interface TobiOikoVerdict {
  pasa: boolean;
  motivo: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Utilidades internas
// ────────────────────────────────────────────────────────────────────────────

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function toSafeString(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function toTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeStatus(value: unknown): TobiCandidateStatus {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'AUTORIZADO') return 'AUTORIZADO';
  if (raw === 'DESCARTADO') return 'DESCARTADO';
  return 'PENDIENTE';
}

function normalizeArticles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const clean = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim());
  return Array.from(new Set(clean));
}

function normalizeCandidate(raw: unknown, index: number): TobiLearningCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const consulta = toSafeString(record.consulta ?? record.prompt);
  if (!consulta) return null;

  const fecha = toSafeString(record.fecha ?? record.timestamp, new Date().toISOString());
  const id = toSafeString(record.id, `tobi_candidato_${index + 1}_${Date.now()}`);
  const auditadoAt = toSafeString(record.auditado_at);

  const candidate: TobiLearningCandidate = {
    id,
    fecha,
    consulta: consulta.slice(0, MAX_CONSULTA_LENGTH),
    respuesta_tobi: toSafeString(record.respuesta_tobi ?? record.response).slice(0, MAX_RESPUESTA_LENGTH),
    proveedor: toSafeString(record.proveedor ?? record.provider, 'tobi-web'),
    modelo: toSafeString(record.modelo ?? record.model, 'desconocido'),
    articulos: normalizeArticles(record.articulos ?? record.articles),
    autorizado: normalizeStatus(record.autorizado),
    correccion_diego: toSafeString(record.correccion_diego),
  };

  if (auditadoAt) candidate.auditado_at = auditadoAt;
  return candidate;
}

function normalizeCandidateList(items: unknown[]): TobiLearningCandidate[] {
  return items
    .map((item, index) => normalizeCandidate(item, index))
    .filter((candidate): candidate is TobiLearningCandidate => candidate !== null);
}

/** Clave de deduplicación: consulta normalizada (minúsculas, sin signos ni espacios redundantes). */
function normalizeQueryKey(consulta: string): string {
  return consulta
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortByFechaDesc(candidates: TobiLearningCandidate[]): TobiLearningCandidate[] {
  return [...candidates].sort((a, b) => toTimestamp(b.fecha) - toTimestamp(a.fecha));
}

function applyFilter(candidates: TobiLearningCandidate[], filter: TobiLearningFilter): TobiLearningCandidate[] {
  switch (filter) {
    case 'pending':
      return candidates.filter(candidate => candidate.autorizado === 'PENDIENTE');
    case 'authorized':
      return candidates.filter(candidate => candidate.autorizado === 'AUTORIZADO');
    case 'discarded':
      return candidates.filter(candidate => candidate.autorizado === 'DESCARTADO');
    default:
      return candidates;
  }
}

function readLocalCandidates(): TobiLearningCandidate[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(TOBI_LEARNING_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeCandidateList(parsed);
  } catch (error) {
    console.warn('[TobiLearning] No se pudo leer el almacén local de candidatos:', error);
    return [];
  }
}

function writeLocalCandidates(candidates: TobiLearningCandidate[]): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(TOBI_LEARNING_STORAGE_KEY, JSON.stringify(candidates));
  } catch (error) {
    console.warn('[TobiLearning] No se pudo persistir el almacén local de candidatos:', error);
  }
}

/**
 * Candidatos de demostración periciales para el primer uso (cuando aún no hay
 * interacciones reales). Quedan en estado PENDIENTE a la espera de Diego Núñez.
 */
function buildDemoCandidates(): TobiLearningCandidate[] {
  const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'tobi_demo_001',
      fecha: hoursAgo(2),
      consulta:
        'Trabajé 4 años en una despensa y me despidieron sin causa. Me avisaron el mismo día que ya no vaya, ¿qué me corresponde cobrar?',
      respuesta_tobi:
        'Por el despido sin causa corresponde la indemnización por antigüedad del Art. 84 de la Ley 213/93 (un sueldo y medio por año, proporcional por fracción mayor a 6 meses), más el preaviso del Art. 87 y las vacaciones y aguinaldo proporcionales.',
      proveedor: 'gemini',
      modelo: 'gemini-3.8-flash',
      articulos: ['Art. 84', 'Art. 87', 'Art. 91'],
      autorizado: 'PENDIENTE',
      correccion_diego: '',
    },
    {
      id: 'tobi_demo_002',
      fecha: hoursAgo(9),
      consulta:
        'La empresa me descuenta del sueldo la campera del uniforme porque dice que es obligatorio usarla. ¿Eso es legal?',
      respuesta_tobi:
        'No es legal. Los útiles y elementos necesarios para el trabajo, incluido el uniforme exigido por el empleador, no pueden descontarse del salario (Art. 62 y Art. 240 de la Ley 213/93). Podés reclamar la restitución ante el MTESS.',
      proveedor: 'deepseek',
      modelo: 'deepseek-v4.1-flash',
      articulos: ['Art. 62', 'Art. 240'],
      autorizado: 'PENDIENTE',
      correccion_diego: '',
    },
    {
      id: 'tobi_demo_003',
      fecha: hoursAgo(26),
      consulta:
        'Me tienen facturando honorarios hace tres años, sin contrato ni aportes al IPS. Si renuncio pierdo la antigüedad?',
      respuesta_tobi:
        'La facturación de honorarios es una simulación laboral (Art. 18 y 19 de la Ley 213/93): la relación real es de trabajo y la antigüedad no se pierde. Corresponde reconocer la relación, regularizar los aportes al IPS (Dec-Ley 1860/50) y abonar los derechos derivados.',
      proveedor: 'openai',
      modelo: 'gpt-4o-mini',
      articulos: ['Art. 19', 'Dec-Ley 1860/50'],
      autorizado: 'PENDIENTE',
      correccion_diego: '',
    },
  ];
}

function ensureLocalCandidates(): TobiLearningCandidate[] {
  const existing = readLocalCandidates();
  if (existing.length > 0) return existing;
  const seeded = buildDemoCandidates();
  writeLocalCandidates(seeded);
  return seeded;
}

// ────────────────────────────────────────────────────────────────────────────
// Capa de acceso remoto (endpoints serverless) con fallback
// ────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta una petición y devuelve el JSON parseado, o `null` si el endpoint
 * no está disponible, no es JSON o devuelve un error. Nunca lanza excepción.
 */
async function requestJson(url: string, init?: RequestInit): Promise<unknown | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const response = await fetch(url, init);
    if (!response || !response.ok) return null;
    const body = await response.text();
    if (!body || body.trim().length === 0) return null;
    try {
      return JSON.parse(body);
    } catch {
      // Respuesta no-JSON (p. ej. el index.html del dev server) => se usa el fallback local.
      return null;
    }
  } catch (error) {
    console.warn(`[TobiLearning] Endpoint no disponible (${url}); se usará el almacén local:`, error);
    return null;
  }
}

function extractCandidateArray(payload: unknown): TobiLearningCandidate[] | null {
  if (Array.isArray(payload)) return normalizeCandidateList(payload);
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.candidates)) return normalizeCandidateList(record.candidates);
    if (Array.isArray(record.data)) return normalizeCandidateList(record.data);
  }
  return null;
}

async function fetchRemoteCandidates(): Promise<TobiLearningCandidate[] | null> {
  const payload = await requestJson(TOBI_LEARNING_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return extractCandidateArray(payload);
}

// ────────────────────────────────────────────────────────────────────────────
// Curador local (fallback): heurística Oiko + clasificación de artículos
// ────────────────────────────────────────────────────────────────────────────

function filtroOiko(texto: string): TobiOikoVerdict {
  if (!texto || typeof texto !== 'string') return { pasa: false, motivo: 'Texto vacío' };
  const trimmed = texto.trim();
  if (trimmed.length < 8) return { pasa: false, motivo: 'Muy corto (< 8 caracteres)' };
  if (RE_SOLO_SALUDO.test(trimmed)) return { pasa: false, motivo: 'Solo saludo o cortesía' };
  for (const pattern of TERMINOS_EXTRANJEROS) {
    if (pattern.test(trimmed)) return { pasa: false, motivo: `Legislación extranjera detectada (${pattern})` };
  }
  return { pasa: true, motivo: 'Consulta laboral legítima' };
}

/** Clasifica la materia legal y los artículos aplicables (Ley 213/93 y concordantes). */
function clasificarArticulos(texto: string): string[] {
  const t = texto.toLowerCase();
  const arts: string[] = [];

  if (/despid|echaron|sacaron/i.test(t)) {
    arts.push('Art. 84');
    if (/causa|falta|robo|llegada|inconducta|abandono/i.test(t)) arts.push('Art. 81');
    arts.push('Art. 91');
  }
  if (/preaviso/i.test(t)) arts.push('Art. 87');
  if (/vacacion/i.test(t)) arts.push('Art. 218');
  if (/aguinaldo/i.test(t)) arts.push('Art. 243');
  if (/factur|sin ips|boleta|honorario/i.test(t)) arts.push('Art. 19');
  if (/10 a[ñn]os|estabilidad/i.test(t)) arts.push('Art. 94');
  if (/descuento|caja|faltante/i.test(t)) arts.push('Art. 240', 'Art. 242');
  if (/renuncia|obligan a firmar/i.test(t)) arts.push('Art. 19', 'Art. 84');
  if (/maternidad|embaraz|lactancia/i.test(t)) arts.push('Ley 5508/15');
  if (/ips|seguro social/i.test(t)) arts.push('Dec-Ley 1860/50');

  return Array.from(new Set(arts));
}

function readLocalInteractions(): RawTobiInteraction[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(TOBI_LIVE_CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap<RawTobiInteraction>((item, index) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const prompt = toSafeString(record.prompt ?? record.consulta);
      if (!prompt) return [];

      const metadata =
        record.metadata && typeof record.metadata === 'object'
          ? (record.metadata as Record<string, unknown>)
          : {};

      return [
        {
          id: toSafeString(record.id, `raw_${index + 1}`),
          timestamp: toSafeString(record.timestamp ?? record.fecha ?? record.createdAt, new Date().toISOString()),
          prompt,
          response: toSafeString(record.response ?? record.respuesta_tobi),
          provider: toSafeString(metadata.provider, 'tobi-web'),
          model: toSafeString(metadata.model, 'desconocido'),
        },
      ];
    });
  } catch (error) {
    console.warn('[TobiLearning] No se pudo leer el histórico local de conversaciones de Tobi:', error);
    return [];
  }
}

function buildCandidatesFromLocalInteractions(hours: number): TobiLearningCandidate[] {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const candidates: TobiLearningCandidate[] = [];

  for (const interaction of readLocalInteractions()) {
    const time = toTimestamp(interaction.timestamp);
    if (time > 0 && time < since) continue;
    if (!filtroOiko(interaction.prompt).pasa) continue;

    const candidate = normalizeCandidate(
      {
        id: `tobi_interaccion_${interaction.id}`,
        fecha: interaction.timestamp,
        consulta: interaction.prompt,
        respuesta_tobi: interaction.response,
        proveedor: interaction.provider,
        modelo: interaction.model,
        articulos: clasificarArticulos(interaction.prompt),
        autorizado: 'PENDIENTE',
        correccion_diego: '',
      },
      candidates.length
    );

    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

/** Fusiona candidatos evitando duplicados por ID y por consulta normalizada. */
function mergeCandidates(
  existing: TobiLearningCandidate[],
  incoming: TobiLearningCandidate[]
): { list: TobiLearningCandidate[]; added: number } {
  const list = [...existing];
  const ids = new Set(existing.map(candidate => candidate.id));
  const queries = new Set(
    existing.map(candidate => normalizeQueryKey(candidate.consulta)).filter(key => key.length > 0)
  );
  let added = 0;

  for (const candidate of incoming) {
    const queryKey = normalizeQueryKey(candidate.consulta);
    if (ids.has(candidate.id)) continue;
    if (queryKey.length > 0 && queries.has(queryKey)) continue;

    ids.add(candidate.id);
    if (queryKey.length > 0) queries.add(queryKey);
    list.push(candidate);
    added++;
  }

  return { list, added };
}

// ────────────────────────────────────────────────────────────────────────────
// API pública
// ────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene los casos candidatos a aprendizaje de Tobi.
 * Consulta primero `/api/tobi-learning`; si no está disponible, usa localStorage.
 */
export async function getTobiLearningCandidates(
  filter: TobiLearningFilter = 'all'
): Promise<TobiLearningCandidate[]> {
  const remote = await fetchRemoteCandidates();
  const source = remote !== null ? remote : ensureLocalCandidates();
  return sortByFechaDesc(applyFilter(source, filter));
}

/**
 * Autoriza, descarta o comenta un caso pericial.
 * Intenta PATCH `/api/tobi-learning` y refleja el cambio en el almacén local.
 */
export async function updateTobiLearningCandidate(
  id: string,
  update: TobiCandidateUpdate
): Promise<{ success: boolean; error?: string }> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    return { success: false, error: 'Identificador de caso pericial inválido.' };
  }

  const patch: TobiCandidateUpdate = {};
  if (update && update.autorizado !== undefined) {
    patch.autorizado = normalizeStatus(update.autorizado);
  }
  if (update && update.correccion_diego !== undefined) {
    patch.correccion_diego = sanitizeInput(update.correccion_diego);
  }

  if (patch.autorizado === undefined && patch.correccion_diego === undefined) {
    return { success: false, error: 'No se recibió ningún cambio para aplicar al caso pericial.' };
  }

  const remotePayload = await requestJson(TOBI_LEARNING_ENDPOINT, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: cleanId, ...patch }),
  });
  const remoteAccepted = remotePayload !== null;

  const local = ensureLocalCandidates();
  const index = local.findIndex(candidate => candidate.id === cleanId);

  if (index === -1 && !remoteAccepted) {
    return { success: false, error: 'No se encontró el caso pericial solicitado.' };
  }

  if (index !== -1) {
    const updated: TobiLearningCandidate = { ...local[index], ...patch };
    if (patch.autorizado !== undefined) {
      updated.auditado_at = new Date().toISOString();
    }
    local[index] = updated;
    writeLocalCandidates(local);
  }

  return { success: true };
}

/**
 * Ejecuta el curador automático de Tobi.
 * Invoca POST `/api/tobi-curator`; si no está disponible, aplica la heurística local
 * sobre el histórico de conversaciones de las últimas `hours` horas.
 */
export async function runTobiAutoCurator(
  hours: number = DEFAULT_CURATOR_HOURS
): Promise<{ success: boolean; newCandidates: number; message: string }> {
  const windowHours = Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : DEFAULT_CURATOR_HOURS;

  const remotePayload = await requestJson(TOBI_CURATOR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ hours: windowHours }),
  });
  const remoteCandidates = extractCandidateArray(remotePayload);

  const incoming =
    remoteCandidates !== null ? remoteCandidates : buildCandidatesFromLocalInteractions(windowHours);

  const existing = ensureLocalCandidates();
  const { list, added } = mergeCandidates(existing, incoming);
  if (added > 0) writeLocalCandidates(list);

  if (added === 0) {
    return {
      success: true,
      newCandidates: 0,
      message: `Sin novedades: no se detectaron consultas periciales nuevas en las últimas ${windowHours} horas.`,
    };
  }

  return {
    success: true,
    newCandidates: added,
    message: `Se incorporaron ${added} caso(s) nuevo(s) al Centro de Aprendizaje para tu revisión.`,
  };
}

/** Calcula las métricas agregadas del Centro de Aprendizaje Pericial de Tobi. */
export async function getTobiLearningMetrics(): Promise<TobiLearningMetrics> {
  const candidates = await getTobiLearningCandidates('all');

  let pending = 0;
  let authorized = 0;
  let discarded = 0;

  for (const candidate of candidates) {
    if (candidate.autorizado === 'AUTORIZADO') authorized++;
    else if (candidate.autorizado === 'DESCARTADO') discarded++;
    else pending++;
  }

  return {
    total: candidates.length,
    pending,
    authorized,
    discarded,
  };
}
