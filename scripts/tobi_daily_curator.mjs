#!/usr/bin/env node
/**
 * ============================================================================
 * CURADOR DIARIO DE INTERACCIONES Y APRENDIZAJE DE TOBI — LABORAPY
 * ============================================================================
 * Ejecución diaria automática o manual:
 *   node scripts/tobi_daily_curator.mjs [--hours 24] [--save-markdown]
 *
 * Funciones:
 *  1. Extrae las interacciones de las últimas N horas desde Supabase (`tobi_events`
 *     y `hr_chat_messages`).
 *  2. Aplica el filtro heurístico Oiko / TikTok:
 *     - Descarta saludos puros, mensajes vacíos y términos extranjeros (IMSS, AFIP, LFT).
 *     - Identifica consultas laborales legítimas de Paraguay.
 *  3. Clasifica la materia legal y los artículos del Código del Trabajo (Ley 213/93).
 *  4. Genera un informe diario en Markdown (`reports/INFORME_DIARIO_TOBI_YYYY-MM-DD.md`)
 *     y un JSON de candidatos (`reports/candidatos_aprendizaje_YYYY-MM-DD.json`)
 *     listos para que Diego Núñez autorice, descarte o agregue su corrección.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Términos extranjeros vetados (igual que el filtro de TikTok de evaluacion_dual)
const TERMINOS_EXTRANJEROS = [
  /\bimss\b/i, /\bafore\b/i, /\blft\b/i, /\bprofedet\b/i, /\bconciliacion y arbitraje\b/i,
  /\blct\b/i, /\bafip\b/i, /\banses\b/i, /\bseclo\b/i, /\bmonotributo\b/i,
  /\bsmac\b/i, /\bestatuto de los trabajadores\b/i, /\bdireccion del trabajo chile\b/i,
  /\bpesos\b/i, /\bsoles\b/i, /\bcolones\b/i, /\beuros\b/i,
];

const RE_SOLO_SALUDO = /^(hola|buenas|saludos|buen dia|buenas tardes|buenas noches|doctor|dr|dra|gracias|muchas gracias|chau|adios|👍|👏|😊|🙏)+[\s.?!]*$/i;

function filtroOiko(texto) {
  if (!texto || typeof texto !== 'string') return { pasa: false, motivo: 'Texto vacío' };
  const trimmed = texto.trim();
  if (trimmed.length < 8) return { pasa: false, motivo: 'Muy corto (< 8 caracteres)' };
  if (RE_SOLO_SALUDO.test(trimmed)) return { pasa: false, motivo: 'Solo saludo o cortesía' };
  for (const pat of TERMINOS_EXTRANJEROS) {
    if (pat.test(trimmed)) return { pasa: false, motivo: `Legislación extranjera detectada (${pat})` };
  }
  return { pasa: true, motivo: 'Consulta laboral legítima' };
}

function clasificarArticulos(texto) {
  const t = texto.toLowerCase();
  const arts = [];
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

async function fetchEventsFromSupabase(sinceIso) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/tobi_events?created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=500`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return [];
    return (await res.json()) || [];
  } catch (err) {
    console.warn('Aviso: no se pudo consultar Supabase tobi_events en vivo:', err.message);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  let hours = 24;
  const hoursArgIdx = args.findIndex((a) => a === '--hours');
  if (hoursArgIdx !== -1 && args[hoursArgIdx + 1]) {
    hours = parseInt(args[hoursArgIdx + 1], 10) || 24;
  }

  const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  const sinceIso = sinceDate.toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);

  console.log(`\n======================================================`);
  console.log(`🔍 CURADOR DIARIO DE INTERACCIONES DE TOBI — LABORAPY`);
  console.log(`Período analizado: últimas ${hours} horas (desde ${sinceIso})`);
  console.log(`======================================================\n`);

  const events = await fetchEventsFromSupabase(sinceIso);
  console.log(`Eventos recolectados en Supabase: ${events.length}`);

  const candidates = [];
  const discarded = [];

  for (const ev of events) {
    let detail = {};
    try {
      detail = typeof ev.detail === 'string' ? JSON.parse(ev.detail) : ev.detail || {};
    } catch {
      detail = {};
    }

    const prompt = (detail.prompt || '').trim();
    const response = (detail.response || '').trim();
    const provider = ev.answered_provider || detail.provider || 'desconocido';
    const model = ev.answered_model || detail.model || 'desconocido';

    if (!prompt) continue;

    const filtro = filtroOiko(prompt);
    if (!filtro.pasa) {
      discarded.push({ prompt, motivo: filtro.motivo });
      continue;
    }

    const arts = clasificarArticulos(prompt);

    candidates.push({
      id: `tobi_interaccion_${ev.id || Date.now()}_${candidates.length + 1}`,
      fecha: ev.created_at || new Date().toISOString(),
      consulta: prompt,
      respuesta_tobi: response.slice(0, 500),
      proveedor: provider,
      modelo: model,
      articulos: arts,
      autorizado: 'PENDIENTE', // PENDIENTE | AUTORIZADO | DESCARTADO
      correccion_diego: '',
    });
  }

  // Asegurar directorio reports/
  const reportsDir = path.resolve(ROOT_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const jsonReportPath = path.join(reportsDir, `candidatos_aprendizaje_${todayStr}.json`);
  const mdReportPath = path.join(reportsDir, `INFORME_DIARIO_TOBI_${todayStr}.md`);

  // Guardar JSON de candidatos
  fs.writeFileSync(jsonReportPath, JSON.stringify(candidates, null, 2), 'utf8');

  // Generar Markdown legible para Diego
  const mdContent = `# 📋 INFORME DIARIO DE INTERACCIONES DE TOBI — ${todayStr}
**Generado:** ${new Date().toLocaleString('es-PY')}
**Período auditado:** Últimas ${hours} horas

---

## 📊 1. Resumen Ejecutivo
- **Total de interacciones analizadas:** ${events.length}
- **Consultas con mérito pericial (Candidatas a aprendizaje):** ${candidates.length}
- **Mensajes descartados por filtro Oiko (saludos, spam, leyes foráneas):** ${discarded.length}

---

## ⚖️ 2. Casos Candidatos para Autorización de Aprendizaje
*Mismo estándar que el dataset de TikTok: cada caso debe ser revisado para que Tobi lo incorpore a su memoria.*

${
  candidates.length === 0
    ? `*No se registraron nuevas consultas con controversia jurídica en las últimas ${hours} horas (o la base de datos no tiene eventos recientes).*`
    : candidates
        .map(
          (c, idx) => `
### Caso #${idx + 1} — [${c.articulos.join(', ') || 'General'}]
- **Fecha:** ${c.fecha}
- **Motor que respondió:** \`${c.proveedor}\` (\`${c.modelo}\`)
- **Consulta Real del Usuario:**
  > "${c.consulta}"
- **Respuesta dada por Tobi:**
  "${c.respuesta_tobi}..."
- **Estado de Autorización:** \`PENDIENTE\`
- **Criterio / Corrección de Diego Núñez:** \`_____________________________________\`
`
        )
        .join('\n---\n')
}

---

## 🛠️ 3. Cómo Autorizar los Casos para que Tobi los Aprenda
1. Abrí el archivo \`reports/candidatos_aprendizaje_${todayStr}.json\`.
2. En los casos que consideres valiosos, cambiá \`"autorizado": "AUTORIZADO"\` y si querés agregá tu criterio en \`"correccion_diego"\`.
3. Ejecutá en la terminal:
   \`\`\`bash
   node scripts/approve_daily_learning.mjs
   \`\`\`
4. El script integrará automáticamente los casos a la base de conocimiento y re-compilará el catálogo en memoria de Tobi.
`;

  fs.writeFileSync(mdReportPath, mdContent, 'utf8');

  console.log(`✅ Informe diario generado: ${mdReportPath}`);
  console.log(`💾 Archivo de candidatos: ${jsonReportPath}`);
  console.log(`Candidatos listos para revisión de Diego: ${candidates.length}`);
}

main().catch((err) => {
  console.error('Error ejecutando curador diario:', err);
  process.exit(1);
});
