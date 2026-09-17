import type { PlanDeCuentasNomina } from '../types/accountingTypes';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../engine/payrollAccountingEngine';

const STORAGE_PREFIX = 'LABORAPY_ACCOUNTING_CONFIG';

function getStorageKey(empresaId?: string): string {
  const cleanId = empresaId && empresaId.trim() !== '' ? empresaId.trim() : 'DEFAULT';
  return `${STORAGE_PREFIX}_${cleanId}`;
}

function getStorage(): Storage | undefined {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function loadAccountingConfig(empresaId?: string): PlanDeCuentasNomina {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_CHART_OF_ACCOUNTS };
  }
  try {
    const stored = storage.getItem(getStorageKey(empresaId));
    if (!stored) return { ...DEFAULT_CHART_OF_ACCOUNTS };
    const parsed = JSON.parse(stored) as Record<string, any>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CHART_OF_ACCOUNTS };
    return { ...DEFAULT_CHART_OF_ACCOUNTS, ...parsed };
  } catch {
    return { ...DEFAULT_CHART_OF_ACCOUNTS };
  }
}

export function saveAccountingConfig(empresaId: string | undefined, config: PlanDeCuentasNomina): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getStorageKey(empresaId), JSON.stringify(config));
  } catch (e) {
    console.error('Error al guardar configuración contable en localStorage:', e);
  }
}

export function resetAccountingConfig(empresaId?: string): PlanDeCuentasNomina {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(getStorageKey(empresaId));
    } catch {}
  }
  return { ...DEFAULT_CHART_OF_ACCOUNTS };
}
