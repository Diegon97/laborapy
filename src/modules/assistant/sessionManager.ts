/**
 * GESTOR DE SESIONES DE CHAT Y PODA DE CONTEXTO — LABORAPY (TOBI)
 *
 * Administra el historial de conversaciones multi-chat (estilo ChatGPT/Claude/Gemini):
 *  - Creación, listado, guardado y eliminación de sesiones de chat independientes.
 *  - Generación automática de títulos fácticos basados en la primera consulta.
 *  - Poda de contexto (Sliding Window): mantiene solo los últimos 4 a 6 turnos.
 *  - Poda de adjuntos (Attachment Stripping): evita reenviar DataURLs gigantes al LLM.
 *  - Scratchpad fáctico: preserva variables clave (salario, nombre, causal) con ~30 tokens.
 */

import type { AssistantMessage, TobiChatTurn } from './types';

export interface ChatSession {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly AssistantMessage[];
  readonly memoryScratchpad?: Readonly<Record<string, string | number>>;
}

const STORAGE_SESSIONS_KEY = 'laborapy_tobi_sessions_v1';
const STORAGE_ACTIVE_SESSION_KEY = 'laborapy_tobi_active_session_id';
const MAX_STORED_SESSIONS = 30;

/** Ventana deslizante de memoria para no saturar el contexto del modelo. */
export const MAX_INFERENCE_HISTORY_TURNS = 6;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear?: () => void;
}

const memoryStore = new Map<string, string>();

function getSafeStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // fallback
  }
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
  };
}

/** Limpia todas las sesiones almacenadas (útil para tests y reinicio forzado). */
export function clearAllSessions(): void {
  const storage = getSafeStorage();
  storage.removeItem(STORAGE_SESSIONS_KEY);
  storage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
  if (storage.clear) storage.clear();
}

/** Genera un título limpio y descriptivo de 3 a 5 palabras a partir del primer mensaje. */
export function generateChatTitle(firstPrompt: string): string {
  if (!firstPrompt || typeof firstPrompt !== 'string') return 'Nueva consulta';

  const cleaned = firstPrompt
    .replace(/^hola\s*(tobi)?\s*,?\s*/i, '')
    .replace(/^buenas\s*(tardes|dias|noches)?\s*,?\s*/i, '')
    .replace(/^(quiero|necesito|quisiera)\s*/i, '')
    .trim();

  if (!cleaned) return 'Consulta laboral';

  // Capitalizar primera letra
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return title.length > 36 ? title.slice(0, 35) + '…' : title;
}

/** Obtiene la lista de sesiones de chat ordenadas de más reciente a más antigua. */
export function listChatSessions(): ChatSession[] {
  const storage = getSafeStorage();
  try {
    const raw = storage.getItem(STORAGE_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  } catch {
    return [];
  }
}

/** Obtiene una sesión específica por su ID. */
export function getChatSession(sessionId: string): ChatSession | null {
  const sessions = listChatSessions();
  return sessions.find((s) => s.id === sessionId) ?? null;
}

/** Guarda o actualiza una sesión de chat en localStorage/storage defensivo. */
export function saveChatSession(session: ChatSession): void {
  const storage = getSafeStorage();
  try {
    const sessions = listChatSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);

    let updatedList: ChatSession[];
    if (existingIndex >= 0) {
      updatedList = [
        ...sessions.slice(0, existingIndex),
        session,
        ...sessions.slice(existingIndex + 1),
      ];
    } else {
      updatedList = [session, ...sessions];
    }

    const trimmedList = updatedList.slice(0, MAX_STORED_SESSIONS);
    storage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(trimmedList));
    storage.setItem(STORAGE_ACTIVE_SESSION_KEY, session.id);
  } catch (_err) {
    // Silencioso ante cuotas de storage
  }
}

/** Crea una nueva sesión de chat limpia. */
export function createChatSession(firstPrompt?: string): ChatSession {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const title = firstPrompt ? generateChatTitle(firstPrompt) : 'Nueva consulta';

  const newSession: ChatSession = {
    id,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  saveChatSession(newSession);
  return newSession;
}

/** Elimina una sesión del historial. */
export function deleteChatSession(sessionId: string): void {
  const storage = getSafeStorage();
  try {
    const sessions = listChatSessions().filter((s) => s.id !== sessionId);
    storage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));

    const activeId = storage.getItem(STORAGE_ACTIVE_SESSION_KEY);
    if (activeId === sessionId) {
      storage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

/** Obtiene el ID de la última sesión activa o null. */
export function getActiveSessionId(): string | null {
  const storage = getSafeStorage();
  return storage.getItem(STORAGE_ACTIVE_SESSION_KEY);
}

/**
 * PODA DE CONTEXTO INTELIGENTE (SLIDING WINDOW + ATTACHMENT STRIPPING):
 * Prepara el historial de turnos para enviar al LLM evitando que el contexto
 * se degrade o supere los límites de tokens:
 *  1. Sliding Window: toma solo los últimos MAX_INFERENCE_HISTORY_TURNS mensajes.
 *  2. Attachment Stripping: en los turnos históricos poda los base64 pesados.
 *  3. Inyecta el Scratchpad de variables confirmadas como pre-contexto liviano (~30 tokens).
 */
export function prepareContextForInference(
  messages: readonly AssistantMessage[],
  scratchpad?: Readonly<Record<string, string | number>>,
): readonly TobiChatTurn[] {
  // 1. Filtrar solo turnos de usuario y asistente
  const validMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  // 2. Aplicar ventana deslizante (últimos N turnos)
  const windowSlice = validMessages.slice(-MAX_INFERENCE_HISTORY_TURNS);

  // 3. Poda de adjuntos pesados en turnos históricos
  const turns: TobiChatTurn[] = windowSlice.map((m, idx) => {
    let content = m.content;

    // Si es un turno previo que tenía adjunto, asegurar que no viaje el base64 crudo en el texto
    if (m.attachment && idx < windowSlice.length - 1) {
      const summaryTag = `[Documento adjunto analizado: ${m.attachment.name}]`;
      if (!content.includes(m.attachment.name)) {
        content = `${summaryTag}\n${content}`;
      }
    }

    return {
      role: m.role as 'user' | 'assistant',
      content,
    };
  });

  // 4. Inyección del Scratchpad fáctico en el primer turno del historial si existe información confirmada
  if (scratchpad && Object.keys(scratchpad).length > 0 && turns.length > 0) {
    const factsList = Object.entries(scratchpad)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const memoryTag = `[Ficha del caso confirmada: ${factsList}]`;

    if (!turns[0].content.includes('[Ficha del caso')) {
      turns[0] = {
        role: turns[0].role,
        content: `${memoryTag}\n${turns[0].content}`,
      };
    }
  }

  return turns;
}
