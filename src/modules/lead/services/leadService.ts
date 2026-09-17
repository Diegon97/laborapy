/**
 * SERVICIO DE GESTIÓN DE LEADS, FUNNEL COMERCIAL Y SINCRONIZACIÓN CRM
 * LaboraPy — Calculadora Laboral de Paraguay (Ley N.º 213/93)
 * Captura, segmenta, exporta (CSV/JSON) y sincroniza contactos B2B (Empresas) y B2C (Trabajadores).
 * Versión: PY-LEAD-2026.09.05
 */

import { trackLeadCapturado } from '../../analytics/metaPixel';
import {
  saveLeadToSupabase,
  saveLeadsBatchToSupabase,
  isSupabaseConfigured,
  type SupabaseLeadPayload,
} from '../../../lib/supabase';
import { sanitizeInput, sanitizeExcelFormula, encryptData, decryptData } from '../../../lib/crypto';

export type TipoUsuario = 'empresa' | 'particular';

export interface LeadData {
  id: string;
  nombre?: string;
  email: string;
  telefono?: string;
  telefonoWhatsApp?: string; // Retrocompatibilidad
  tipoUsuario: TipoUsuario;
  empresaNombre?: string;
  motivoConsulta?: string;
  calculoEstimado?: number;
  montoNeto?: number; // Retrocompatibilidad
  documento?: string;
  formato?: 'pdf' | 'docx';
  origen: string;
  timestamp: string;
  sincronizado?: boolean;
  sincronizadoAt?: string;
  notas?: string;
}

export interface CreateLeadInput {
  email: string;
  tipoUsuario: TipoUsuario;
  nombre?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  empresaNombre?: string;
  motivoConsulta?: string;
  calculoEstimado?: number;
  montoNeto?: number;
  documento?: string;
  formato?: 'pdf' | 'docx';
  origen?: string;
  notas?: string;
  sincronizado?: boolean;
}

export interface LastLeadInfo {
  email: string;
  tipoUsuario: TipoUsuario;
  empresa: string;
  nombre: string;
  telefono: string;
}

export interface LeadMetrics {
  totalLeads: number;
  b2bCount: number;
  b2cCount: number;
  totalEstimadoGs: number;
  promedioEstimadoGs: number;
  withPhoneCount: number;
  syncedCount: number;
  unsyncedCount: number;
}

export interface SyncLeadsOptions {
  endpointUrl?: string;
  apiKey?: string;
  onlyUnsynced?: boolean;
  customHeaders?: Record<string, string>;
}

export interface SyncResult {
  success: boolean;
  count: number;
  syncedIds?: string[];
  error?: string;
  message?: string;
}

export interface LeadFilterOptions {
  tipoUsuario?: 'empresa' | 'particular' | 'all';
  sincronizado?: boolean;
  query?: string;
}

export const LEADS_STORAGE_KEY = 'laboralpy_captured_leads';
export const LAST_LEAD_EMAIL_KEY = 'laboralpy_last_lead_email';
export const LAST_LEAD_USER_TYPE_KEY = 'laboralpy_last_lead_user_type';
export const LAST_LEAD_COMPANY_KEY = 'laboralpy_last_lead_company';
export const LAST_LEAD_NAME_KEY = 'laboralpy_last_lead_name';
export const LAST_LEAD_PHONE_KEY = 'laboralpy_last_lead_phone';
export const CRM_WEBHOOK_URL_KEY = 'laboralpy_crm_webhook_url';
export const CRM_API_KEY_STORAGE_KEY = 'laboralpy_crm_api_key';

// Caché en memoria para acceso síncrono ultra-rápido y coherencia criptográfica
let lastRawData: string | null = null;
let lastParsedLeads: LeadData[] = [];

/**
 * Obtiene todos los leads guardados localmente en el almacén seguro (AES-256-GCM / Vault)
 */
export function getStoredLeads(): LeadData[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      lastRawData = null;
      lastParsedLeads = [];
      return [];
    }

    if (raw === lastRawData) {
      return lastParsedLeads;
    }

    // 1. Compatibilidad en caliente con formato plano (legado o tests)
    if (raw.startsWith('[') || raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      lastParsedLeads = Array.isArray(parsed) ? parsed : [];
      lastRawData = raw;
      return lastParsedLeads;
    }

    // 2. Formato Base64 seguro
    if (raw.startsWith('enc_b64:')) {
      try {
        const json = decodeURIComponent(atob(raw.slice(8)));
        const parsed = JSON.parse(json);
        lastParsedLeads = Array.isArray(parsed) ? parsed : [];
        lastRawData = raw;
        return lastParsedLeads;
      } catch {}
    }

    // 3. Formato AES-256-GCM: descifrado asíncrono para actualizar caché
    decryptData<LeadData[]>(raw).then((decrypted) => {
      if (decrypted && Array.isArray(decrypted)) {
        lastRawData = raw;
        lastParsedLeads = decrypted;
      }
    }).catch(() => {});

    return lastParsedLeads;
  } catch {
    return [];
  }
}

/**
 * Obtiene los leads de forma asíncrona asegurando descifrado completo de AES-256-GCM
 */
export async function getStoredLeadsAsync(): Promise<LeadData[]> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      lastRawData = null;
      lastParsedLeads = [];
      return [];
    }

    if (raw.startsWith('[') || raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      lastParsedLeads = Array.isArray(parsed) ? parsed : [];
      lastRawData = raw;
      return lastParsedLeads;
    }

    const decrypted = await decryptData<LeadData[]>(raw);
    if (decrypted && Array.isArray(decrypted)) {
      lastRawData = raw;
      lastParsedLeads = decrypted;
      return lastParsedLeads;
    }

    return lastParsedLeads;
  } catch {
    return [];
  }
}

/**
 * Guarda la colección de leads en localStorage protegida bajo cifrado AES-256-GCM
 */
function persistLeads(leads: LeadData[]): void {
  lastParsedLeads = leads;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    const jsonStr = JSON.stringify(leads);
    lastRawData = jsonStr;
    localStorage.setItem(LEADS_STORAGE_KEY, jsonStr);

    // Cifrar con Web Crypto API nativa (AES-256-GCM + PBKDF2) en segundo plano
    encryptData(leads).then((encrypted) => {
      try {
        lastRawData = encrypted;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LEADS_STORAGE_KEY, encrypted);
        }
      } catch (e) {
        console.warn('[Lead Funnel] Error al escribir almacén cifrado:', e);
      }
    }).catch(() => {});
  } catch (e) {
    console.warn('[Lead Funnel] No se pudo persistir la lista de leads:', e);
  }
}

/**
 * Obtiene los datos del último lead registrado para pre-llenar formularios
 */
export function getLastLeadInfo(): LastLeadInfo {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { email: '', tipoUsuario: 'empresa', empresa: '', nombre: '', telefono: '' };
  }
  return {
    email: localStorage.getItem(LAST_LEAD_EMAIL_KEY) || '',
    tipoUsuario: (localStorage.getItem(LAST_LEAD_USER_TYPE_KEY) as TipoUsuario) || 'empresa',
    empresa: localStorage.getItem(LAST_LEAD_COMPANY_KEY) || '',
    nombre: localStorage.getItem(LAST_LEAD_NAME_KEY) || '',
    telefono: localStorage.getItem(LAST_LEAD_PHONE_KEY) || '',
  };
}

/**
 * Registra un nuevo lead del funnel comercial, almacena en localStorage y notifica a Meta Pixel
 */
export function recordLead(leadInput: CreateLeadInput): LeadData {
  const cleanEmail = sanitizeInput(leadInput.email || '').trim().toLowerCase();
  const rawPhone = leadInput.telefono || leadInput.telefonoWhatsApp || '';
  const phone = rawPhone ? sanitizeInput(rawPhone).trim() : undefined;
  const estimatedAmount = leadInput.calculoEstimado ?? leadInput.montoNeto;
  const nombre = leadInput.nombre ? sanitizeInput(leadInput.nombre).trim() : undefined;
  const empresaNombre = leadInput.empresaNombre ? sanitizeInput(leadInput.empresaNombre).trim() : undefined;
  const motivoConsulta = leadInput.motivoConsulta ? sanitizeInput(leadInput.motivoConsulta).trim() : undefined;
  const documento = leadInput.documento ? sanitizeInput(leadInput.documento).trim() : 'Finiquito de Liquidación Laboral';
  const formato = leadInput.formato || 'pdf';
  const origen = leadInput.origen ? sanitizeInput(leadInput.origen).trim() : 'Calculadora Laboral Paraguay (Web)';
  const notas = leadInput.notas ? sanitizeInput(leadInput.notas).trim() : undefined;

  const lead: LeadData = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    nombre,
    email: cleanEmail,
    telefono: phone,
    telefonoWhatsApp: phone,
    tipoUsuario: leadInput.tipoUsuario,
    empresaNombre,
    motivoConsulta,
    calculoEstimado: estimatedAmount,
    montoNeto: estimatedAmount,
    documento,
    formato,
    timestamp: new Date().toISOString(),
    origen,
    sincronizado: leadInput.sincronizado ?? false,
    notas,
  };

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const existing = getStoredLeads();
      existing.push(lead);
      persistLeads(existing);

      // Guardar información del último contacto para agilizar posteriores usos
      localStorage.setItem(LAST_LEAD_EMAIL_KEY, lead.email);
      localStorage.setItem(LAST_LEAD_USER_TYPE_KEY, lead.tipoUsuario);
      if (lead.nombre) localStorage.setItem(LAST_LEAD_NAME_KEY, lead.nombre);
      if (lead.telefono) localStorage.setItem(LAST_LEAD_PHONE_KEY, lead.telefono);
      if (lead.empresaNombre) {
        localStorage.setItem(LAST_LEAD_COMPANY_KEY, lead.empresaNombre);
      }
    } catch (e) {
      console.warn('[Lead Funnel] No se pudo guardar localmente el lead:', e);
    }
  }

  // Notificar al motor de Meta Ads (Pixel & Conversiones)
  trackLeadCapturado({
    email: lead.email,
    tipoUsuario: lead.tipoUsuario,
    empresaNombre: lead.empresaNombre,
    telefono: lead.telefono,
    documento: lead.documento || 'Documento Laboral',
    formato: lead.formato || 'pdf',
    montoNeto: lead.calculoEstimado,
  });

  // Enviar a la nube en Supabase en segundo plano sin bloquear la experiencia del usuario
  if (isSupabaseConfigured()) {
    saveLeadToSupabase({
      id: lead.id,
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.telefono,
      tipo_usuario: lead.tipoUsuario,
      empresa_nombre: lead.empresaNombre,
      motivo_consulta: lead.motivoConsulta,
      calculo_estimado: lead.calculoEstimado,
      documento: lead.documento,
      formato: lead.formato,
      origen: lead.origen,
      notas: lead.notas,
      sincronizado: true,
    })
      .then(res => {
        if (res.success) {
          markLeadsAsSynced([lead.id]);
        }
      })
      .catch(err => {
        console.warn('[Lead Supabase Sync] Lead guardado localmente, pendiente de subida a la nube:', err);
      });
  }

  return lead;
}

/**
 * Sincroniza todos los leads locales pendientes con la base de datos de Supabase
 */
export async function syncPendingLeadsToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  const unsynced = getUnsyncedLeads();
  if (unsynced.length === 0) {
    return { success: true, count: 0 };
  }

  const payloads: SupabaseLeadPayload[] = unsynced.map(lead => ({
    id: lead.id,
    nombre: lead.nombre,
    email: lead.email,
    telefono: lead.telefono || lead.telefonoWhatsApp,
    tipo_usuario: lead.tipoUsuario,
    empresa_nombre: lead.empresaNombre,
    motivo_consulta: lead.motivoConsulta,
    calculo_estimado: lead.calculoEstimado ?? lead.montoNeto,
    documento: lead.documento,
    formato: lead.formato,
    origen: lead.origen,
    notas: lead.notas,
    sincronizado: true,
  }));

  const res = await saveLeadsBatchToSupabase(payloads);
  if (res.success && res.count > 0) {
    markLeadsAsSynced(unsynced.map(l => l.id));
  }
  return res;
}

/**
 * Exporta los leads capturados a formato JSON formateado
 */
export function exportLeadsToJSON(leads?: LeadData[], pretty: boolean = true): string {
  const data = leads ?? getStoredLeads();
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Escapa valores para asegurar compatibilidad RFC 4180 con Excel y CSV,
 * previniendo inyecciones de fórmulas maliciosas (=, +, -, @, \t, \r).
 */
function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const sanitized = sanitizeExcelFormula(value);
  // Escapar comillas dobles duplicándolas
  const escaped = sanitized.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exporta los leads en formato CSV con BOM UTF-8 para apertura directa en Excel
 */
export function exportLeadsToCSV(leads?: LeadData[]): string {
  const data = leads ?? getStoredLeads();

  const headers = [
    'ID',
    'Fecha Registro',
    'Nombre y Apellido',
    'Correo Electrónico',
    'Teléfono / WhatsApp',
    'Tipo de Usuario',
    'Empresa / Organización',
    'Motivo de Consulta',
    'Cálculo Estimado (Gs.)',
    'Documento Generado',
    'Formato Descargado',
    'Sincronizado CRM',
    'Fecha Sincronización',
    'Origen del Lead',
    'Notas Adicionales',
  ];

  const rows = data.map(l => [
    escapeCSVCell(l.id),
    escapeCSVCell(l.timestamp),
    escapeCSVCell(l.nombre || ''),
    escapeCSVCell(l.email),
    escapeCSVCell(l.telefono || l.telefonoWhatsApp || ''),
    escapeCSVCell(l.tipoUsuario === 'empresa' ? 'Empresa (B2B)' : 'Particular (B2C)'),
    escapeCSVCell(l.empresaNombre || ''),
    escapeCSVCell(l.motivoConsulta || ''),
    escapeCSVCell(l.calculoEstimado !== undefined ? l.calculoEstimado : (l.montoNeto !== undefined ? l.montoNeto : '')),
    escapeCSVCell(l.documento || ''),
    escapeCSVCell(l.formato ? l.formato.toUpperCase() : ''),
    escapeCSVCell(l.sincronizado ? 'SÍ' : 'NO'),
    escapeCSVCell(l.sincronizadoAt || ''),
    escapeCSVCell(l.origen || ''),
    escapeCSVCell(l.notas || ''),
  ]);

  // \uFEFF es el BOM (Byte Order Mark) que fuerza a Microsoft Excel a interpretar UTF-8
  const csvContent = '\uFEFF' + [headers.map(escapeCSVCell).join(','), ...rows.map(r => r.join(','))].join('\r\n');
  return csvContent;
}

/**
 * Descarga en el navegador los leads en formato CSV
 */
export function downloadLeadsCSV(filename?: string, leads?: LeadData[]): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    const csv = exportLeadsToCSV(leads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', filename || `leads_laboralpy_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('[Lead Export] Error al descargar CSV:', e);
    return false;
  }
}

/**
 * Descarga en el navegador los leads en formato JSON
 */
export function downloadLeadsJSON(filename?: string, leads?: LeadData[]): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    const json = exportLeadsToJSON(leads, true);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', filename || `leads_laboralpy_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('[Lead Export] Error al descargar JSON:', e);
    return false;
  }
}

/**
 * Obtiene los leads que aún no han sido sincronizados con el CRM comercial
 */
export function getUnsyncedLeads(): LeadData[] {
  return getStoredLeads().filter(lead => !lead.sincronizado);
}

/**
 * Marca una lista de IDs de leads como sincronizados
 */
export function markLeadsAsSynced(leadIds: string[]): number {
  if (!leadIds || leadIds.length === 0) return 0;
  const set = new Set(leadIds);
  const all = getStoredLeads();
  let updatedCount = 0;
  const now = new Date().toISOString();

  const updated = all.map(lead => {
    if (set.has(lead.id) && !lead.sincronizado) {
      updatedCount++;
      return { ...lead, sincronizado: true, sincronizadoAt: now };
    }
    return lead;
  });

  if (updatedCount > 0) {
    persistLeads(updated);
  }
  return updatedCount;
}

/**
 * Marca todos los leads almacenados como sincronizados
 */
export function markAllLeadsAsSynced(): number {
  const all = getStoredLeads();
  const unsynced = all.filter(l => !l.sincronizado);
  if (unsynced.length === 0) return 0;
  const now = new Date().toISOString();
  const updated = all.map(lead => ({ ...lead, sincronizado: true, sincronizadoAt: lead.sincronizadoAt || now }));
  persistLeads(updated);
  return unsynced.length;
}

/**
 * Elimina un lead específico por ID
 */
export function deleteLead(leadId: string): boolean {
  const all = getStoredLeads();
  const filtered = all.filter(l => l.id !== leadId);
  if (filtered.length !== all.length) {
    persistLeads(filtered);
    return true;
  }
  return false;
}

/**
 * Limpia todos los leads almacenados localmente
 */
export function clearStoredLeads(): void {
  lastRawData = null;
  lastParsedLeads = [];
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.removeItem(LEADS_STORAGE_KEY);
}

/**
 * Importa leads externos evitando duplicados por ID
 */
export function importLeads(incomingLeads: LeadData[]): { imported: number; duplicates: number } {
  if (!Array.isArray(incomingLeads) || incomingLeads.length === 0) {
    return { imported: 0, duplicates: 0 };
  }

  const existing = getStoredLeads();
  const existingIds = new Set(existing.map(l => l.id));
  let imported = 0;
  let duplicates = 0;

  for (const lead of incomingLeads) {
    if (!lead || !lead.id || !lead.email) continue;
    if (existingIds.has(lead.id)) {
      duplicates++;
    } else {
      existing.push(lead);
      existingIds.add(lead.id);
      imported++;
    }
  }

  if (imported > 0) {
    persistLeads(existing);
  }

  return { imported, duplicates };
}

/**
 * Obtiene métricas agregadas del funnel comercial de LaboraPy
 */
export function getLeadMetrics(): LeadMetrics {
  const leads = getStoredLeads();
  let b2bCount = 0;
  let b2cCount = 0;
  let totalEstimadoGs = 0;
  let withPhoneCount = 0;
  let syncedCount = 0;
  let unsyncedCount = 0;

  for (const l of leads) {
    if (l.tipoUsuario === 'empresa') b2bCount++;
    else b2cCount++;

    const amount = l.calculoEstimado ?? l.montoNeto ?? 0;
    totalEstimadoGs += amount;

    if (l.telefono || l.telefonoWhatsApp) withPhoneCount++;
    if (l.sincronizado) syncedCount++;
    else unsyncedCount++;
  }

  const totalLeads = leads.length;
  const promedioEstimadoGs = totalLeads > 0 ? Math.round(totalEstimadoGs / totalLeads) : 0;

  return {
    totalLeads,
    b2bCount,
    b2cCount,
    totalEstimadoGs,
    promedioEstimadoGs,
    withPhoneCount,
    syncedCount,
    unsyncedCount,
  };
}

/**
 * Filtra leads por tipo, estado de sincronización y búsqueda libre
 */
export function filterLeads(filters: LeadFilterOptions, leads?: LeadData[]): LeadData[] {
  const source = leads ?? getStoredLeads();
  const q = filters.query ? filters.query.toLowerCase().trim() : '';

  return source.filter(lead => {
    if (filters.tipoUsuario && filters.tipoUsuario !== 'all') {
      if (lead.tipoUsuario !== filters.tipoUsuario) return false;
    }
    if (filters.sincronizado !== undefined) {
      if (Boolean(lead.sincronizado) !== filters.sincronizado) return false;
    }
    if (q) {
      const matchName = lead.nombre?.toLowerCase().includes(q);
      const matchEmail = lead.email.toLowerCase().includes(q);
      const matchCompany = lead.empresaNombre?.toLowerCase().includes(q);
      const matchReason = lead.motivoConsulta?.toLowerCase().includes(q);
      const matchDoc = lead.documento?.toLowerCase().includes(q);
      const matchPhone = (lead.telefono || lead.telefonoWhatsApp)?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchCompany && !matchReason && !matchDoc && !matchPhone) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Obtiene la URL configurada del Webhook / CRM Comercial
 */
export function getCRMWebhookUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(CRM_WEBHOOK_URL_KEY);
    if (stored && stored.trim()) return stored.trim();
  }
  return (import.meta.env?.VITE_LEADS_SYNC_WEBHOOK_URL as string) || '';
}

/**
 * Guarda o actualiza la URL del Webhook comercial en localStorage
 */
export function setCRMWebhookUrl(url: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (url && url.trim()) {
    localStorage.setItem(CRM_WEBHOOK_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(CRM_WEBHOOK_URL_KEY);
  }
}

/**
 * Obtiene la API Key del CRM comercial si estuviese configurada
 */
export function getCRMApiKey(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(CRM_API_KEY_STORAGE_KEY) || '';
  }
  return '';
}

/**
 * Guarda o actualiza la API Key del CRM comercial
 */
export function setCRMApiKey(key: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (key && key.trim()) {
    localStorage.setItem(CRM_API_KEY_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(CRM_API_KEY_STORAGE_KEY);
  }
}

/**
 * Sincroniza los leads con un CRM externo (Google Sheets, Zapier, HubSpot, backend propio, etc.)
 */
export function syncLeadsToCommercial(options?: SyncLeadsOptions): Promise<SyncResult> {
  const endpoint = options?.endpointUrl || getCRMWebhookUrl();
  const apiKey = options?.apiKey || getCRMApiKey();
  const onlyUnsynced = options?.onlyUnsynced ?? true;

  const leadsToSync = onlyUnsynced ? getUnsyncedLeads() : getStoredLeads();

  if (leadsToSync.length === 0) {
    return Promise.resolve({
      success: true,
      count: 0,
      message: 'No hay leads pendientes de sincronización.',
    });
  }

  if (!endpoint) {
    return Promise.resolve({
      success: false,
      count: 0,
      error: 'No se ha configurado la URL del Webhook o API del CRM comercial.',
    });
  }

  const payload = {
    source: 'LaboraPy Funnel Comercial',
    timestamp: new Date().toISOString(),
    totalLeads: leadsToSync.length,
    leads: leadsToSync,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.customHeaders || {}),
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-KEY'] = apiKey;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
    .then(async response => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Error en servidor CRM (${response.status}): ${errorText || response.statusText}`);
      }
      const syncedIds = leadsToSync.map(l => l.id);
      markLeadsAsSynced(syncedIds);
      return {
        success: true,
        count: syncedIds.length,
        syncedIds,
        message: `${syncedIds.length} lead(s) sincronizado(s) exitosamente con el equipo comercial.`,
      };
    })
    .catch(err => {
      console.warn('[CRM Sync] Error al sincronizar leads:', err);
      return {
        success: false,
        count: 0,
        error: err instanceof Error ? err.message : 'Error desconocido al sincronizar leads',
      };
    });
}
