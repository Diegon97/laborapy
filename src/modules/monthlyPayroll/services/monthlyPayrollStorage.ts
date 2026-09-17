/**
 * ALMACENAMIENTO LOCAL DE LA PLANILLA MENSUAL EDITABLE (ERP LABORAPY)
 *
 * Persiste la nómina editada por RRHH por empresa cliente y período (mes/año),
 * bajo la clave `laborapy_nomina_mensual_<cliente|general>_<YYYY-MM>`.
 *
 * Toda operación de almacenamiento es defensiva: en modo privado de Safari,
 * cuota excedida o JSON corrupto NUNCA se lanza un error hacia la UI.
 */

import type { EmpleadoNominaInput, GridColumnDef } from '../types';

export interface NominaPeriodoGuardada {
  clienteId: string; // '' si es nómina general sin empresa
  periodo: string; // 'YYYY-MM'
  actualizadoEn: string; // ISO datetime
  empleados: EmpleadoNominaInput[];
  customColumns?: GridColumnDef[];
  hiddenColumnIds?: string[];
}

const STORAGE_KEY_PREFIX = 'laborapy_nomina_mensual_';

/**
 * Clave de almacenamiento por cliente y período.
 * Cliente vacío => segmento 'general'.
 */
export function getStorageKey(clienteId: string, periodo: string): string {
  return `${STORAGE_KEY_PREFIX}${clienteId || 'general'}_${periodo}`;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// Respaldo en memoria cuando localStorage no está disponible (SSR / tests / modo privado).
const memoryStore = new Map<string, string>();

/**
 * Devuelve un manejador de almacenamiento seguro, priorizando window.localStorage
 * y cayendo a un respaldo en memoria si el acceso está bloqueado.
 */
function getSafeStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Acceso a localStorage bloqueado (modo privado / políticas del navegador).
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage;
    }
  } catch {
    // Sin acceso al almacenamiento global.
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

/**
 * Lee la planilla guardada de un período. Devuelve null si no existe o el JSON es inválido.
 * Los ítems malformados (sin ci/nombre válidos) se descartan defensivamente para que
 * la UI nunca reviente al consumir los datos persistidos.
 */
export function loadNominaPeriodo(
  clienteId: string,
  periodo: string,
): NominaPeriodoGuardada | null {
  try {
    const raw = getSafeStorage().getItem(getStorageKey(clienteId, periodo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NominaPeriodoGuardada | null;
    if (!parsed || !Array.isArray(parsed.empleados)) return null;
    parsed.empleados = parsed.empleados
      .filter(
        (e): e is EmpleadoNominaInput =>
          !!e &&
          typeof e === 'object' &&
          typeof e.ci === 'string' &&
          e.ci.trim() !== '' &&
          typeof e.nombre === 'string' &&
          e.nombre.trim() !== '',
      )
      .map((e) => ({
        ...e,
        cargo: typeof e.cargo === 'string' ? e.cargo : '',
        customFields: e.customFields && typeof e.customFields === 'object' ? e.customFields : undefined,
      }));

    if (Array.isArray(parsed.customColumns)) {
      parsed.customColumns = parsed.customColumns.filter(
        (c) => !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.label === 'string',
      );
    }
    if (Array.isArray(parsed.hiddenColumnIds)) {
      parsed.hiddenColumnIds = parsed.hiddenColumnIds.filter((id) => typeof id === 'string');
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Guarda la planilla completa del período. Devuelve true si persistió correctamente
 * y false si falló (cuota/seguridad), para que la UI pueda informar al usuario
 * en lugar de asumir un guardado exitoso.
 */
export function saveNominaPeriodo(
  clienteId: string,
  periodo: string,
  empleados: EmpleadoNominaInput[],
  customColumns?: GridColumnDef[],
  hiddenColumnIds?: string[],
): boolean {
  const registro: NominaPeriodoGuardada = {
    clienteId,
    periodo,
    actualizadoEn: new Date().toISOString(),
    empleados,
    customColumns,
    hiddenColumnIds,
  };
  try {
    getSafeStorage().setItem(getStorageKey(clienteId, periodo), JSON.stringify(registro));
    return true;
  } catch {
    // Cuota excedida o almacenamiento no disponible: se informa el fallo sin lanzar.
    return false;
  }
}

/**
 * Elimina la planilla guardada de un período (botón "Reiniciar periodo").
 */
export function deleteNominaPeriodo(clienteId: string, periodo: string): void {
  try {
    getSafeStorage().removeItem(getStorageKey(clienteId, periodo));
  } catch {
    // Eliminación defensiva: nunca lanza hacia la UI.
  }
}
