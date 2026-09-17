import { createClient } from '@supabase/supabase-js';

declare const process: any;

export const config = { maxDuration: 15 };

const TABLE_NAME = 'laborapy_leads';
const FALLBACK_PATH = '/rest/v1/';

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

  // Validación opcional de Vercel Cron Secret si está configurado
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = String(req.headers?.authorization || '');
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
  }

  const rawUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const rawKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const supabaseAnonKey = rawKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({
      success: false,
      error: 'Supabase credentials missing on serverless environment',
    });
    return;
  }

  const timestamp = new Date().toISOString();

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const start = Date.now();
    const { error } = await supabase.from(TABLE_NAME).select('id').limit(1);
    const latencyMs = Date.now() - start;

    if (error) {
      const restRes = await fetch(`${supabaseUrl}${FALLBACK_PATH}`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });
      if (!restRes.ok && restRes.status >= 500) {
        throw new Error(`REST fallback failed with status ${restRes.status}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Supabase keep-alive ping exitoso',
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
