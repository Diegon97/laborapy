/**
 * CLIENTE SUPABASE - LABORAPY
 * Conexión centralizada a Supabase para captura de leads y almacenamiento en la nube.
 * Compatible con Vercel y entornos de producción.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL as string) || '';

const SUPABASE_ANON_KEY = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return null;
    }
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('[LaboraPy Supabase] Error al inicializar cliente:', err);
    return null;
  }
}

export const supabase = getSupabaseClient();

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export interface SupabaseLeadPayload {
  id: string;
  nombre?: string;
  email: string;
  telefono?: string;
  tipo_usuario: 'empresa' | 'particular';
  empresa_nombre?: string;
  motivo_consulta?: string;
  calculo_estimado?: number;
  documento?: string;
  formato?: string;
  origen?: string;
  notas?: string;
  sincronizado?: boolean;
}

/**
 * Guarda un lead en Supabase de manera segura y resiliente (Append-only / Solo inserción)
 */
export async function saveLeadToSupabase(payload: SupabaseLeadPayload): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Cliente de Supabase no configurado' };
  }

  try {
    const { error } = await client
      .from('laborapy_leads')
      .insert(payload);

    if (error) {
      console.warn('[Supabase Cloud] Error al guardar lead:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido al conectar con Supabase';
    console.warn('[Supabase Cloud] Excepción de conexión:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Guarda un lote de leads en Supabase
 */
export async function saveLeadsBatchToSupabase(
  payloads: SupabaseLeadPayload[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client || payloads.length === 0) {
    return { success: false, count: 0, error: 'No hay leads o cliente no configurado' };
  }

  try {
    const { error } = await client
      .from('laborapy_leads')
      .insert(payloads);

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: payloads.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, count: 0, error: msg };
  }
}

