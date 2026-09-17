/**
 * SERVICIO DE GESTIÓN DE POSTULACIONES Y TALENTO — LABORAPY
 * Versión: PY-REC-2026.09.16
 */

import type { Postulante, EstadoPostulacion, AreaInteresLaboral } from '../types';

export const POSTULANTES_STORAGE_KEY = 'laboralpy_job_applicants';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const memoryStore = new Map<string, string>();

function getSafeStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Modo privado o storage bloqueado
  }
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
  };
}

export function getStoredPostulantes(): Postulante[] {
  try {
    const raw = getSafeStorage().getItem(POSTULANTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePostulante(
  postulanteData: Omit<Postulante, 'id' | 'fechaPostulacion' | 'estado'>
): Postulante {
  const postulantes = getStoredPostulantes();
  const nuevo: Postulante = {
    ...postulanteData,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fechaPostulacion: new Date().toISOString(),
    estado: 'nuevo',
  };

  const actualizados = [nuevo, ...postulantes];
  try {
    getSafeStorage().setItem(POSTULANTES_STORAGE_KEY, JSON.stringify(actualizados));
  } catch {
    // Defensivo
  }

  return nuevo;
}

export function updatePostulanteEstado(
  id: string,
  estado: EstadoPostulacion,
  notas?: string
): boolean {
  const postulantes = getStoredPostulantes();
  const index = postulantes.findIndex((p) => p.id === id);
  if (index === -1) return false;

  postulantes[index].estado = estado;
  if (notas !== undefined) {
    postulantes[index].notas = notas;
  }

  try {
    getSafeStorage().setItem(POSTULANTES_STORAGE_KEY, JSON.stringify(postulantes));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredPostulantes(): void {
  try {
    getSafeStorage().removeItem(POSTULANTES_STORAGE_KEY);
  } catch {
    // Defensivo
  }
}

export function filterPostulantes(params: {
  area?: AreaInteresLaboral | 'todas';
  estado?: EstadoPostulacion | 'todos';
  busqueda?: string;
  empresaId?: string;
}): Postulante[] {
  const postulantes = getStoredPostulantes();
  return postulantes.filter((p) => {
    if (params.area && params.area !== 'todas' && p.areaInteres !== params.area) {
      return false;
    }
    if (params.estado && params.estado !== 'todos' && p.estado !== params.estado) {
      return false;
    }
    if (params.empresaId && p.empresaIdAsignada && p.empresaIdAsignada !== params.empresaId) {
      return false;
    }
    if (params.busqueda) {
      const q = params.busqueda.toLowerCase();
      const matchText =
        p.nombres.toLowerCase().includes(q) ||
        p.apellidos.toLowerCase().includes(q) ||
        p.ci.toLowerCase().includes(q) ||
        p.cargoPostulado.toLowerCase().includes(q) ||
        p.ciudad.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    return true;
  });
}
