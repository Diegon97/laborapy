/**
 * VERCEL SERVERLESS FUNCTION: CURADOR DIARIO AUTOMÁTICO DE APRENDIZAJE DE TOBI
 * Ejecutado por Vercel Cron diariamente o invocado a demanda por Diego Núñez
 * desde el Centro de Control Administrativo (Admin Hub).
 *
 * Flujo:
 *  1. Extrae interacciones recientes de Supabase (`tobi_events`).
 *  2. Aplica filtro Oiko (descarta saludos y legislaciones extranjeras).
 *  3. Clasifica artículos de la Ley 213/93.
 *  4. Registra los casos en `tobi_learning_candidates` con estado 'PENDIENTE'.
 */

declare const process: any;

const TERMINOS_EXTRANJEROS = [
  /\bimss\b/i, /\bafore\b/i, /\blft\b/i, /\bprofedet\b/i, /\bconciliacion y arbitraje\b/i,
  /\blct\b/i, /\bafip\b/i, /\banses\b/i, /\bseclo\b/i, /\bmonotributo\b/i,
  /\bsmac\b/i, /\bestatuto de los trabajadores\b/i, /\bdireccion del trabajo chile\b/i,
  /\bpesos\b/i, /\bsoles\b/i, /\bcolones\b/i, /\beuros\b/i,
];

const RE_SOLO_SALUDO = /^(?:hola|buenas|saludos|buen dia|buenos dias|buenas tardes|buenas noches|doctor|dr|dra|gracias|muchas gracias|chau|adios|👍|👏|😊|🙏|[\s,;.!?-])+$/i;

function filtroOiko(texto: string): { pasa: boolean; motivo: string } {
  if (!texto || typeof texto !== 'string') return { pasa: false, motivo: 'Texto vacío' };
  const trimmed = texto.trim();
  if (trimmed.length < 8) return { pasa: false, motivo: 'Muy corto (< 8 caracteres)' };
  if (RE_SOLO_SALUDO.test(trimmed)) return { pasa: false, motivo: 'Solo saludo o cortesía' };
  for (const pat of TERMINOS_EXTRANJEROS) {
    if (pat.test(trimmed)) return { pasa: false, motivo: `Legislación extranjera (${pat})` };
  }
  return { pasa: true, motivo: 'Consulta laboral legítima' };
}

function clasificarArticulos(texto: string): string[] {
  const t = texto.toLowerCase();
  const arts: string[] = [];
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const hours = Math.max(1, Math.min(168, Number(req.body?.hours || req.query?.hours || 48)));
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  if (!supabaseUrl || !serviceKey) {
    return res.status(200).json({
      success: true,
      newCandidates: 0,
      candidates: [],
      message: 'Supabase no configurado; curador operando en modo local.',
    });
  }

  try {
    // 1. Obtener eventos recientes de tobi_events
    const eventsUrl = `${supabaseUrl}/rest/v1/tobi_events?created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=300`;
    const evRes = await fetch(eventsUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

    const events = evRes.ok ? await evRes.json() : [];

    // 2. Obtener IDs y consultas existentes para deduplicación
    const existingUrl = `${supabaseUrl}/rest/v1/tobi_learning_candidates?select=id,consulta&limit=1000`;
    const exRes = await fetch(existingUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

    const existingRows = exRes.ok ? await exRes.json() : [];
    const existingIds = new Set(existingRows.map((r: any) => r.id));
    const existingQueries = new Set(existingRows.map((r: any) => (r.consulta || '').trim().toLowerCase()));

    const candidatesToInsert: any[] = [];

    for (const ev of events) {
      let detail: any = {};
      try {
        detail = typeof ev.detail === 'string' ? JSON.parse(ev.detail) : ev.detail || {};
      } catch {
        detail = {};
      }

      const prompt = (detail.prompt || '').trim();
      const response = (detail.response || '').trim();
      const provider = ev.answered_provider || detail.provider || 'tobi-web';
      const model = ev.answered_model || detail.model || 'desconocido';

      if (!prompt) continue;

      const filtro = filtroOiko(prompt);
      if (!filtro.pasa) continue;

      const normQ = prompt.toLowerCase();
      if (existingQueries.has(normQ)) continue;
      existingQueries.add(normQ);

      const candidateId = `tobi_ev_${ev.id || Date.now()}`;
      if (existingIds.has(candidateId)) continue;
      existingIds.add(candidateId);

      const arts = clasificarArticulos(prompt);

      candidatesToInsert.push({
        id: candidateId,
        fecha: ev.created_at || new Date().toISOString(),
        consulta: prompt.slice(0, 1200),
        respuesta_tobi: response.slice(0, 500),
        proveedor: provider,
        modelo: model,
        articulos: arts,
        autorizado: 'PENDIENTE',
        correccion_diego: '',
      });
    }

    // 3. Insertar nuevos candidatos en Supabase si hay alguno
    if (candidatesToInsert.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/tobi_learning_candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(candidatesToInsert),
      });
    }

    return res.status(200).json({
      success: true,
      newCandidates: candidatesToInsert.length,
      candidates: candidatesToInsert,
      message:
        candidatesToInsert.length > 0
          ? `Curación completada: se incorporaron ${candidatesToInsert.length} caso(s) nuevo(s) para revisión.`
          : 'Sin novedades: no se detectaron nuevas consultas en el período evaluado.',
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      newCandidates: 0,
      candidates: [],
      message: `Aviso del curador: ${error?.message || 'Error de procesamiento'}`,
    });
  }
}
