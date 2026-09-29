import { createClient } from '@supabase/supabase-js';

declare const process: any;

export const config = { maxDuration: 15 };

// Tablas accesibles con lectura pública (RLS anon) para garantizar que la consulta
// toque físicamente el motor PostgreSQL y registre actividad de base de datos
const READABLE_TABLES = ['autores_laborales', 'jurisprudencia_multimedia', 'laborapy_leads'];
const FALLBACK_PATH = '/auth/v1/health';

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Validación opcional de Vercel Cron Secret si está configurado en el entorno
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = String(req.headers?.authorization || '');
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
  }

  const rawUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const rawAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const supabaseKey = rawServiceKey || rawAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({
      success: false,
      error: 'Supabase credentials missing on serverless environment (SUPABASE_URL / ANON_KEY)',
    });
    return;
  }

  const timestamp = new Date().toISOString();

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const start = Date.now();
    let querySuccess = false;
    let queriedTable = '';
    let lastError: any = null;

    // Intentar consulta real a nivel de tabla en PostgreSQL para activar telemetría
    for (const table of READABLE_TABLES) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) {
          querySuccess = true;
          queriedTable = table;
          break;
        } else {
          lastError = error;
        }
      } catch (err) {
        lastError = err;
      }
    }

    // Fallback a endpoint REST si las tablas fallan
    if (!querySuccess) {
      const restRes = await fetch(`${supabaseUrl}${FALLBACK_PATH}`, {
        headers: {
          apikey: rawAnonKey || supabaseKey,
          Authorization: `Bearer ${rawAnonKey || supabaseKey}`,
        },
      });
      if (!restRes.ok && restRes.status >= 500) {
        throw new Error(`REST fallback failed with status ${restRes.status} (last table error: ${lastError?.message || 'unknown'})`);
      }
      queriedTable = 'rest_openapi_fallback';
    }

    const latencyMs = Date.now() - start;

    res.status(200).json({
      success: true,
      message: 'Supabase keep-alive anti-pause ping exitoso',
      target: queriedTable,
      usingServiceRole: Boolean(rawServiceKey),
      timestamp,
      latencyMs,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Supabase keep-alive fallo',
      error: err?.message || 'Error desconocido',
      timestamp,
    });
  }
}
