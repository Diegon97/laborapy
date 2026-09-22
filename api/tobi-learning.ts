/**
 * VERCEL SERVERLESS FUNCTION: GESTIÓN DEL APRENDIZAJE PERICIAL DE TOBI
 * API backend para el Centro de Control Administrativo (Admin Hub).
 * Permite listar candidatos y aplicar decisiones periciales de Diego Núñez.
 */

declare const process: any;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return res.status(200).json({
      candidates: [],
      metrics: { total: 0, pending: 0, authorized: 0, discarded: 0 },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GET: Obtener candidatos y métricas
  // ────────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const filter = String(req.query?.filter || 'all').toLowerCase();
      let queryUrl = `${supabaseUrl}/rest/v1/tobi_learning_candidates?select=*&order=created_at.desc&limit=200`;

      if (filter === 'pending') {
        queryUrl += '&autorizado=eq.PENDIENTE';
      } else if (filter === 'authorized') {
        queryUrl += '&autorizado=eq.AUTORIZADO';
      } else if (filter === 'discarded') {
        queryUrl += '&autorizado=eq.DESCARTADO';
      }

      const response = await fetch(queryUrl, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });

      if (!response.ok) {
        return res.status(200).json({
          candidates: [],
          metrics: { total: 0, pending: 0, authorized: 0, discarded: 0 },
        });
      }

      const rows: any[] = await response.json();

      // Obtener conteos para métricas
      let pending = 0;
      let authorized = 0;
      let discarded = 0;

      for (const row of rows) {
        if (row.autorizado === 'AUTORIZADO') authorized++;
        else if (row.autorizado === 'DESCARTADO') discarded++;
        else pending++;
      }

      return res.status(200).json({
        candidates: rows.map(r => ({
          id: r.id,
          fecha: r.created_at || r.fecha,
          consulta: r.consulta,
          respuesta_tobi: r.respuesta_tobi,
          proveedor: r.proveedor,
          modelo: r.modelo,
          articulos: r.articulos || [],
          autorizado: r.autorizado,
          correccion_diego: r.correccion_diego || '',
          auditado_at: r.auditado_at,
        })),
        metrics: {
          total: rows.length,
          pending,
          authorized,
          discarded,
        },
      });
    } catch (err: any) {
      return res.status(200).json({
        candidates: [],
        metrics: { total: 0, pending: 0, authorized: 0, discarded: 0 },
        error: err?.message,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PATCH / POST: Actualizar decisión pericial de Diego
  // ────────────────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH' || req.method === 'POST') {
    try {
      const body = req.body || {};
      const id = String(body.id || '').trim();
      if (!id) {
        return res.status(400).json({ success: false, error: 'Identificador requerido' });
      }

      const updateData: any = {};
      if (body.autorizado) {
        const aut = String(body.autorizado).toUpperCase();
        if (['PENDIENTE', 'AUTORIZADO', 'DESCARTADO'].includes(aut)) {
          updateData.autorizado = aut;
          updateData.auditado_at = new Date().toISOString();
        }
      }
      if (typeof body.correccion_diego === 'string') {
        updateData.correccion_diego = body.correccion_diego.slice(0, 2000);
      }

      const patchUrl = `${supabaseUrl}/rest/v1/tobi_learning_candidates?id=eq.${encodeURIComponent(id)}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(updateData),
      });

      if (!patchRes.ok) {
        return res.status(200).json({ success: false, error: 'Error al persistir en Supabase' });
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(200).json({ success: false, error: err?.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
