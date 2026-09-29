/**
 * SCRIPT ANTI-PAUSE KEEP-ALIVE SUPABASE — LABORAPY
 *
 * Ejecuta una consulta ligera a PostgreSQL para registrar actividad activa de DB,
 * evitando que Supabase pause el proyecto tras 7 días de inactividad.
 *
 * Uso:
 *   node scripts/keep-supabase-alive.mjs
 *   npm run supabase:ping
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de .env o .env.local si no están en process.env
function loadEnv() {
  const envFiles = [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../.env'),
  ];

  for (const file of envFiles) {
    if (existsSync(file)) {
      try {
        const content = readFileSync(file, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      } catch {
        // Ignorar fallos de lectura en archivos secundarios
      }
    }
  }
}

loadEnv();

const rawUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const rawAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseUrl = rawUrl.replace(/\/+$/, '');
const supabaseKey = rawServiceKey || rawAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [Anti-Pause] Faltan variables de entorno SUPABASE_URL / ANON_KEY.');
  process.exit(1);
}

const maskedUrl = supabaseUrl.replace(/^(https?:\/\/[a-z0-9]+)\..*$/, '$1.***');
console.log(`📡 [Anti-Pause] Conectando a Supabase (${maskedUrl})...`);

const candidateEndpoints = [
  `${supabaseUrl}/rest/v1/autores_laborales?select=id&limit=1`,
  `${supabaseUrl}/rest/v1/jurisprudencia_multimedia?select=id&limit=1`,
  `${supabaseUrl}/auth/v1/health`,
];

async function ping() {
  const start = Date.now();
  let success = false;
  let lastStatus = 0;

  for (const endpoint of candidateEndpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      lastStatus = res.status;
      if (res.ok) {
        const elapsed = Date.now() - start;
        const targetName = endpoint.split('/rest/v1/')[1] || 'root';
        console.log(`✅ [Anti-Pause] Ping exitoso a [${targetName}] en ${elapsed}ms (HTTP ${res.status}).`);
        success = true;
        break;
      }
    } catch (err) {
      console.warn(`⚠️ [Anti-Pause] Intento fallido contra ${endpoint}:`, err?.message || err);
    }
  }

  if (!success) {
    console.error(`❌ [Anti-Pause] No se pudo contactar a Supabase (último HTTP status: ${lastStatus}).`);
    process.exit(1);
  }
}

ping();
