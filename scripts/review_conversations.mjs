#!/usr/bin/env node
/**
 * REVIEW_CONVERSATIONS.MJS — AUDITOR AUTOMÁTICO DE CONVERSACIONES REALES
 * Lee las interacciones reales registradas en Supabase (tobi_events / tobi_conversations)
 * o desde un archivo local, las audita contra el marco legal paraguayo (Ley 213/93),
 * detecta alucinaciones en caliente (ej: 36 días o Art. 166) y permite incorporarlas
 * directamente al dataset de entrenamiento QLoRA (tobi_gold_dataset_final.jsonl).
 *
 * Uso:
 *   node --env-file=.env --env-file=.env.local scripts/review_conversations.mjs [opciones]
 *
 * Opciones:
 *   --auto-ingest    Incorpora automáticamente las aprobadas (0 errores críticos/altos) al dataset de oro
 *   --limit=N        Cantidad de conversaciones a auditar (default: 25)
 *   --file=RUTA      Audita desde un JSON local en vez de Supabase
 *   --help           Muestra la ayuda
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const GOLD_FILE = path.join(PROJECT_ROOT, 'datasets', 'tobi_gold_dataset_final.jsonl');

const args = process.argv.slice(2);
const autoIngest = args.includes('--auto-ingest');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 25;
const fileArg = args.find((a) => a.startsWith('--file='));
const localFile = fileArg ? fileArg.split('=')[1] : null;

// ── PENALIZACIONES DE SCORE POR SEVERIDAD ──
const SEVERITY_PENALTY = { critical: 40, high: 25, medium: 10 };

// ── REGLAS DE AUDITORÍA LEGAL PARAGUAYA ──
const AUDIT_RULES = [
  {
    name: 'Vacaciones — Prohibición 36 días',
    test: (text) =>
      /36\s*d[ií]as/i.test(text) &&
      !/(?:no\s+(?:te\s+)?(?:corresponden?|son)|nunca|jam[aá]s|prohibid[oa]|incorrect[oa]|err[oó]ne|alucinaci[oó]n|for[aá]ne)/i.test(
        text
      ),
    severity: 'critical',
    error: 'Alucinación: La ley paraguaya no contempla 36 días. El tope máximo es 30 días hábiles (Art. 218).',
  },
  {
    name: 'Vacaciones — Prohibición Art. 166',
    test: (text) =>
      /Art(?:ículo|\.)?\s*166/i.test(text) &&
      /vacaci/i.test(text) &&
      !/(?:no\s+(?:regula|trata|corresponde)|no\s+se\s+refiere|incorrect|err[oó]ne|alucinaci[oó]n)/i.test(text),
    severity: 'critical',
    error: 'Alucinación grave: El Art. 166 trata sobre vivienda rural de peones, no sobre vacaciones (Art. 218).',
  },
  {
    name: 'Salario Mínimo — Prohibición valor viejo (Gs. 2.798.309 como vigente)',
    test: (text) =>
      /2\.798\.309/i.test(text) &&
      /(?:es|era|ser[aá]|corresponde|vigente|monto)\s*(?:de\s+)?(?:gs\.?\s*)?2\.798\.309|2\.798\.309\s*(?:es|vigente|legal|corresponde)/i.test(
        text
      ) &&
      !/(?:vencid|viej|anterior|2024|obsolet|desactualizad|incorrect|no\s+es|no\s+corresponde|no\s+vigente)/i.test(text),
    severity: 'critical',
    error: 'Salario vencido: Gs. 2.798.309 era de 2024. El vigente 2026 es Gs. 3.044.000.',
  },
  {
    name: 'Jornada Mixta — 8h ordinarias prohibidas',
    test: (text) => /8\s*horas\s*(?:ordinarias|diarias)?[^.]*(?:jornada\s*mixta|mixta)[^.]*(?:es legal|sin horas extra)/i.test(text),
    severity: 'high',
    error: 'Tope legal excedido: La jornada mixta tiene tope de 7,5h diarias y 45h semanales (Art. 196).',
  },
  {
    name: 'Recargo Nocturno — Prohibición 25%',
    test: (text) =>
      /recargo\s*nocturno[^.]*25\s*%/i.test(text) &&
      !/(?:no\s+es|nunca|incorrect|err[oó]ne|corrige|30\s*%)/i.test(text),
    severity: 'high',
    error: 'Recargo foráneo: En Paraguay el recargo nocturno es 30% (Art. 234 inc. c).',
  },
  {
    name: 'Horas Extras — Esquema foráneo 50/100',
    test: (text) => /50%\s*la\s*primera\s*hora\s*y\s*100%\s*la\s*segunda/i.test(text) || /horas\s*triples/i.test(text),
    severity: 'high',
    error: 'Esquema foráneo: En Paraguay las horas extras son 50% diurnas y 100% nocturnas/feriados.',
  },
  {
    name: 'Aguinaldo — Retención IPS prohibida',
    test: (text) => /(?:descuento|retenci[oó]n|9%)\s*(?:al|del|sobre\s*el)?\s*aguinaldo/i.test(text) && !/(?:no\s*se\s*descuenta|exento|libre|inembargable)/i.test(text),
    severity: 'critical',
    error: 'Descuento ilegal: El aguinaldo está 100% exento de IPS (Art. 76 D-L 1860/50).',
  },
  {
    name: 'Identidad — Fuga de proveedor foráneo',
    test: (text) => {
      const leak =
        /(?:fui|soy|he\s+sido)\s+(?:un\s+)?(?:modelo\s+)?(?:desarrollad[oa]|cread[oa]|entrenad[oa])\s+por\s+(?:OpenAI|Anthropic|Google|Meta)/i.test(
          text
        ) ||
        /(?:arquitectura|modelo|versi[oó]n)\s+GPT[-\s]?\d/i.test(text) ||
        /(?:soy|fui|he\s+sido)\s+(?:ChatGPT|Claude|Gemini|un\s+modelo\s+de\s+(?:OpenAI|Anthropic|Google|Meta))/i.test(text);
      if (!leak) return false;
      const denial = /(?:no\s+(?:soy|fui|pertenezco|estoy)|creado\s+(?:y\s+desarrollado\s+)?por\s+Diego|desarrollado\s+por\s+Diego)/i.test(text);
      return !denial;
    },
    severity: 'critical',
    error: 'Fuga de identidad: Tobi fue creado por Diego Núñez (LaboraPy) y no debe atribuirse a OpenAI, Anthropic, GPT-4 ni proveedores externos.',
  },
  {
    name: 'Leyes apócrifas — Ley 527/96, 5272/14 o Dto 3525/12',
    test: (text) =>
      /(?:Ley\s*527\/96|Ley\s*5272\/14|Decreto\s*3525\/12)/i.test(text) &&
      !/(?:no\s+existe|inexistente|ap[oó]crif|derogad|no\s+vigente|no\s+contempla|no\s+figura|carece|prohibid|no\s+la\s+(?:cite|menciones)|whitelist)/i.test(
        text
      ),
    severity: 'critical',
    error: 'Normativa inexistente o apócrifa detectada fuera de la whitelist paraguaya.',
  },
  {
    name: 'Código del Trabajo — Art. 31 atribuido a salario mínimo',
    test: (text) =>
      /Art(?:ículo|\.)?\s*31/i.test(text) &&
      /(?:salario\s*m[ií]nimo|remuneraci[oó]n\s*m[ií]nima)/i.test(text) &&
      !/(?:no\s+(?:regula|fija|establece|corresponde)|no\s+se\s+refiere|incorrect|err[oó]ne)/i.test(text),
    severity: 'high',
    error: 'Atribución errónea: El Art. 31 regula condiciones de higiene y seguridad, no el salario mínimo.',
  },
  {
    name: 'Código del Trabajo — Art. 22 atribuido a desconexión',
    test: (text) =>
      /Art(?:ículo|\.)?\s*22/i.test(text) &&
      /(?:desconexi[oó]n|desconectar)/i.test(text) &&
      !/(?:no\s+(?:regula|contempla|establece)|inexistente|no\s+existe|incorrect|corrige)/i.test(text),
    severity: 'high',
    error: 'Atribución inexistente: El Código del Trabajo paraguayo no regula derecho a la desconexión en el Art. 22.',
  },
  {
    name: 'Prescripción despido — Art. 399 citado como 2 años',
    test: (text) =>
      /Art(?:ículo|\.)?\s*399/i.test(text) &&
      /2\s*a[ñn]os/i.test(text) &&
      !/(?:no\s+(?:es|son)\s+(?:de\s+)?2|nunca\s+2|60\s*d[ií]as|corrige|incorrect|err[oó]ne)/i.test(text),
    severity: 'critical',
    error: 'Plazo erróneo: La prescripción por despido injustificado (Art. 399) es de 60 días corridos, no 2 años.',
  },
  {
    name: 'Formato — Etiquetas HTML crudas en Markdown',
    test: (text) => /<br\s*\/?>/i.test(text),
    severity: 'medium',
    error: 'Formato inválido: Se detectaron etiquetas <br> crudas en tablas o texto Markdown.',
  },
];

async function fetchSupabaseEvents() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return [];
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tobi_events?select=id,created_at,answered_provider,answered_model,detail&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    const conversations = [];

    for (const row of rows) {
      if (row.detail) {
        try {
          const parsed = JSON.parse(row.detail);
          if (parsed.prompt && parsed.response) {
            conversations.push({
              id: row.id,
              createdAt: row.created_at,
              provider: row.answered_provider || parsed.provider || 'unknown',
              model: row.answered_model || parsed.model || 'unknown',
              prompt: parsed.prompt,
              response: parsed.response,
            });
          }
        } catch {}
      }
    }
    return conversations;
  } catch {
    return [];
  }
}

function auditConversation(conv) {
  const issues = [];
  let score = 100;

  for (const rule of AUDIT_RULES) {
    if (rule.test(conv.response || '')) {
      issues.push({
        rule: rule.name,
        severity: rule.severity,
        error: rule.error,
      });
      score -= SEVERITY_PENALTY[rule.severity] ?? 10;
    }
  }

  score = Math.max(0, score);
  const blockingIssues = issues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  );
  return {
    ...conv,
    score,
    passed: score >= 85 && blockingIssues.length === 0,
    issues,
  };
}

async function main() {
  console.log('================================================================');
  console.log('🛡️  AUDITOR AUTOMÁTICO DE CONVERSACIONES REALES — LABORAPY CLI');
  console.log(`🎯 Modo: ${autoIngest ? 'Ingesta Automática Activada' : 'Solo Auditoría e Inspección'}`);
  console.log('================================================================\n');

  let rawConversations = [];

  if (localFile && fs.existsSync(localFile)) {
    console.log(`📂 Leyendo archivo local: ${localFile}`);
    try {
      const parsed = JSON.parse(fs.readFileSync(localFile, 'utf8'));
      rawConversations = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error leyendo JSON:', e.message);
    }
  } else {
    console.log('🌐 Consultando telemetría de conversaciones en Supabase...');
    rawConversations = await fetchSupabaseEvents();
    if (rawConversations.length === 0) {
      console.log('ℹ️  No se encontraron eventos recientes en Supabase.');
      console.log('💡 Utilizando muestras simuladas de auditoría para demostración CLI.');
      rawConversations = [
        {
          id: 'test-1',
          createdAt: new Date().toISOString(),
          provider: 'groq',
          model: 'qwen3.8-27b',
          prompt: '¿Cuántos días de vacaciones me corresponden si tengo 6 años en la empresa?',
          response: 'En Paraguay, según el Art. 218 del Código del Trabajo, por 6 años te corresponden 18 días hábiles de vacaciones.',
        },
        {
          id: 'test-2',
          createdAt: new Date().toISOString(),
          provider: 'groq',
          model: 'gpt-oss-120b',
          prompt: '¿Cuánto me toca de vacaciones con 22 años de trabajo?',
          response: 'Según el Art. 166 tenés derecho a 36 días corridos de vacaciones.',
        },
      ];
    }
  }

  console.log(`📊 Conversaciones obtenidas: ${rawConversations.length}\n`);

  const audited = rawConversations.map(auditConversation);

  let approvedCount = 0;
  let flaggedCount = 0;

  for (let i = 0; i < audited.length; i++) {
    const item = audited[i];
    const userText = item.prompt ?? '';
    console.log(`----------------------------------------------------------------`);
    console.log(`[${i + 1}/${audited.length}] Conversación ${item.id} · ${item.provider}/${item.model}`);
    console.log(`👤 Usuario: "${userText.slice(0, 80)}${userText.length > 80 ? '...' : ''}"`);

    if (item.passed) {
      approvedCount++;
      console.log(`✅ RESULTADO: APROBADO [Score: ${item.score}/100]`);
    } else {
      flaggedCount++;
      console.log(`🚨 RESULTADO: RECHAZADO / ALUCINACIÓN DETECTADA [Score: ${item.score}/100]`);
      for (const issue of item.issues) {
        console.log(`   ❌ [${issue.severity.toUpperCase()}] ${issue.rule}`);
        console.log(`      ↳ ${issue.error}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('📊 RESUMEN EJECUTIVO DE AUDITORÍA');
  console.log(`Total Analizadas:        ${audited.length}`);
  console.log(`Aprobadas para Training:  ${approvedCount}`);
  console.log(`Alucinaciones/Errores:   ${flaggedCount}`);
  console.log('================================================================');

  if (autoIngest) {
    const blockingConversations = audited.filter((a) =>
      a.issues.some((i) => i.severity === 'critical' || i.severity === 'high')
    );

    if (blockingConversations.length > 0) {
      console.log(
        `\n🚫 Ingesta automática BLOQUEADA: ${blockingConversations.length} conversación(es) con hallazgos de severidad crítica/alta. Revisá y corregí antes de re-ejecutar.`
      );
    } else {
      const approvedEntries = audited.filter((a) => a.passed);

      if (approvedEntries.length === 0) {
        console.log('\nℹ️  No hay conversaciones aprobadas (score ≥ 85) para ingestar.');
      } else {
        console.log(`\n📥 Ingestando ${approvedEntries.length} pares aprobados a ${GOLD_FILE}...`);
        let appended = 0;

        for (const app of approvedEntries) {
          const line = JSON.stringify({
            id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category: 'Interacción Real en Producción',
            title: 'Consulta Auditada',
            prompt: app.prompt,
            response: app.response,
            origin: 'production_live',
            verified: true,
          });
          fs.appendFileSync(GOLD_FILE, line + '\n', 'utf8');
          appended++;
        }

        console.log(`✅ ${appended} conversaciones agregadas con éxito al dataset de oro.`);
      }
    }
  } else if (approvedCount > 0) {
    console.log('\n💡 Tip: Ejecutá con `--auto-ingest` para incorporar las aprobadas automáticamente.');
  }
}

main();
