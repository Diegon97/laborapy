/**
 * SERVICIO ORQUESTADOR DEL ASISTENTE RRHH — LABORAPY
 * Versión: PY-SRV-2026.09.15
 *
 * Características:
 *  1. Motor Híbrido:
 *     - Offline / Determinístico: Base de conocimiento paraguaya (BACN/CT) y motor de auditoría instantáneo.
 *     - Online / IA: endpoint serverless con cascada multi-modelo por STREAMING SSE (Gemini → Groq →
 *       Cloudflare → OpenRouter → DeepSeek) y, como respaldo directo, la DeepSeek Chat API en cliente.
 *  2. Prompt unificado: la personalidad y el marco normativo de Tobi viajan en TOBI_SYSTEM_PROMPT.
 *  3. Memoria conversacional: soporte de historial acotado (máx. 8 turnos) en todas las rutas online.
 *  4. Persistencia Supabase Multi-Tenant:
 *     - Historial de auditorías (`hr_audit_records`) vinculado a empresa/cliente.
 *     - Conversaciones en tiempo real (`hr_chat_sessions` y `hr_chat_messages`).
 */

import type {
  AssistantAttachment,
  AssistantMessage,
  AssistantQueryContext,
  AuditReport,
  HRAuditRecord,
  HRChatMessage,
  TobiChatTurn,
  TobiFeedbackRating,
} from './types';
import { searchKnowledgeBase } from './hrKnowledgeBase';
import { auditSettlement } from './hrAuditor';
import { getSettlementDeadlines } from './hrDeadlines';
import { TOBI_SYSTEM_PROMPT } from './tobiSystemPrompt';
import { consumeSseChunk } from './sse';
import { supabase } from '../../lib/supabase';

/**
 * Opciones del asistente: key directa opcional, memoria conversacional y callback de streaming.
 */
export interface TobiAssistantOptions {
  apiKey?: string;
  history?: readonly TobiChatTurn[];
  onDelta?: (delta: string) => void;
  attachments?: readonly AssistantAttachment[];
}

const STREAM_IDLE_TIMEOUT_MS = 25000;
const STREAM_TOTAL_TIMEOUT_MS = 55000;

/**
 * Construye un mensaje de asistente normalizado con id y timestamp actuales.
 */
function buildAssistantMessage(content: string): AssistantMessage {
  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Genera una respuesta inmediata usando el motor local de conocimiento y auditoría.
 */
export function generateOfflineAnswer(
  query: string,
  context?: AssistantQueryContext,
): AssistantMessage {
  const trimmed = query.trim();

  // Intención 1: Auditoría directa
  if (/auditar|revisar liquidaci[oó]n|segundo ojo|verificar c[aá]lculo/i.test(trimmed)) {
    if (context?.liquidacionInput) {
      const report = auditSettlement(context.liquidacionInput, context.liquidacionResult ?? undefined);
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content:
          `🔍 **Auditoría Express (Segundo Ojo)**\n\n` +
          `• **Estado de Salud:** ${report.healthStatus.toUpperCase()}\n` +
          `• **Puntaje:** ${report.score}/100\n` +
          `• **Hallazgos detectados:** ${report.summary.totalFindings} ` +
          `(${report.summary.errors} errores, ${report.summary.warnings} observaciones).\n\n` +
          report.findings
            .map((f) => `• [${f.severity.toUpperCase()}] **${f.title}**: ${f.detail} *(Ref: ${f.legalReference ?? 'C.T.'})*`)
            .join('\n'),
        createdAt: new Date().toISOString(),
        auditReportId: report.id,
      };
    }
    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content:
        'Para auditar una liquidación, podés ingresar los datos en la pestaña **"Segundo Ojo"** o completar el formulario de finiquito para una verificación automática en tiempo real.',
      createdAt: new Date().toISOString(),
    };
  }

  // Intención 2: Plazos y Vencimientos
  if (/plazo|vencimiento|ips rei|reop|fecha limite|cuantos dias/i.test(trimmed)) {
    const deadlines = context?.deadlines ?? getSettlementDeadlines(new Date().toISOString().slice(0, 10));
    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content:
        `📅 **Plazos Legales de Cese Laboral (Paraguay)**\n\n` +
        `• **IPS REI:** Vence el **${deadlines.ipsRei.dueDate}** (3 días hábiles). ${deadlines.ipsRei.daysRemaining} días restantes.\n` +
        `• **MTESS REOP:** Vence el **${deadlines.mtessReop.dueDate}** (30 días corridos).\n` +
        `• **Certificado de Trabajo (Art. 93 C.T.):** Entrega inmediata obligatoria al término del vínculo.\n\n` +
        (deadlines.advertencias.length > 0 ? `⚠️ **Atención:**\n${deadlines.advertencias.join('\n')}` : ''),
      createdAt: new Date().toISOString(),
    };
  }

  // Búsqueda en la Base de Conocimiento
  const searchResults = searchKnowledgeBase(trimmed, 3);
  if (searchResults.length > 0) {
    const topResult = searchResults[0]!;
    const citations = searchResults.map((r) => ({
      entryId: r.entry.id,
      title: r.entry.title,
      legalReference: r.entry.legalBasis.join('; '),
    }));

    let content =
      `**Diagnóstico y Resumen:**\n` +
      `**${topResult.entry.title}**\n${topResult.entry.content}\n\n` +
      `**Respaldo Legal:**\n` +
      `${topResult.entry.legalBasis?.length ? `Garantizado conforme a: **${topResult.entry.legalBasis.join('; ')}**.` : 'Conforme a la normativa laboral paraguaya vigente.'}\n\n` +
      `**Recomendaciones y Próximos Pasos:**\n` +
      `1. Guardar y respaldar contratos, recibos de salarios y comprobantes de comunicación.\n` +
      `2. No firmar documentos en blanco ni bajo coacción o sin previa revisión legal.\n` +
      `3. Para liquidaciones oficiales o cálculo de haberes, podés emitirlas con las herramientas de LaboraPy.`;

    if (searchResults.length > 1) {
      content += `\n\n📌 *Artículos y temas relacionados:*\n` +
        searchResults
          .slice(1)
          .map((r) => `• ${r.entry.title} (${r.entry.legalBasis[0] ?? 'C.T.'})`)
          .join('\n');
    }

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      citations,
    };
  }

  // Respuesta general de fallback
  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content:
      '¡Hola! Soy **Tobi**, Asesor Senior de RRHH y Legislación Laboral de LaboraPy.\n\n' +
      'Estoy a tu disposición para orientarte con solvencia jurídica y precisión técnica en cualquier consulta laboral, liquidación o procedimiento corporativo.\n\n' +
      '**Áreas de consulta frecuentes:**\n' +
      '• **Vacaciones y Antigüedad:** Cómputo de días y remuneración (Arts. 218-221 C.T.).\n' +
      '• **Aguinaldo:** Cálculo proporcional y carácter inembargable (Art. 243 C.T.).\n' +
      '• **Despido y Preaviso:** Plazos, indemnizaciones y causales (Arts. 58 y 87 C.T.).\n' +
      '• **Primacía de la Realidad:** Subordinación y cumplimiento de horario vs. facturación (Art. 19 C.T.).\n' +
      '• **Maternidad y Fuero Especial:** Licencias remuneradas y protección legal (Ley 5508/15).\n\n' +
      '¿Qué tema o caso puntual deseás analizar hoy?',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Cliente SSE del endpoint serverless con timeout de inactividad y timeout total.
 * Consume los eventos `delta` acumulando el texto e invoca `onDelta` por cada fragmento.
 */
async function streamServerAssistant(args: {
  prompt: string;
  context?: AssistantQueryContext;
  attachment?: AssistantAttachment | null;
  attachments?: readonly AssistantAttachment[];
  history?: readonly TobiChatTurn[];
  onDelta?: (delta: string) => void;
}): Promise<{ ok: boolean; content: string }> {
  let content = '';
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
  };
  const hardTimer = setTimeout(() => controller.abort(), STREAM_TOTAL_TIMEOUT_MS);
  try {
    resetIdle();
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        prompt: args.prompt,
        context: args.context,
        attachment: args.attachment,
        attachments: args.attachments,
        history: args.history,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, content: '' };

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      // Compatibilidad transitoria con formato JSON legado
      try {
        const data = await response.json();
        if (data?.ok && typeof data.content === 'string' && data.content) {
          return { ok: true, content: data.content };
        }
      } catch {
        // ignorar
      }
      return { ok: false, content: '' };
    }

    if (!response.body) return { ok: false, content: '' };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;

    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSseChunk(buffer);
      buffer = parsed.rest;
      for (const payload of parsed.events) {
        let event: any = null;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        if (event?.type === 'delta' && typeof event.text === 'string' && event.text.length > 0) {
          content += event.text;
          args.onDelta?.(event.text);
        } else if (event?.type === 'done' || event?.type === 'fallback' || event?.type === 'error') {
          finished = true;
          break;
        }
      }
    }

    try {
      await reader.cancel();
    } catch {
      // ignorar
    }
    return { ok: content.length > 0, content };
  } catch {
    return { ok: content.length > 0, content };
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(hardTimer);
  }
}

/**
 * Consulta avanzada con motor en escalera serverless (streaming SSE) y respaldo directo/offline.
 * Firma: 4º parámetro `options` con key directa opcional, historial (máx. 8 turnos) y callback de streaming.
 */
export async function askDeepSeekAssistant(
  prompt: string,
  context?: AssistantQueryContext,
  attachment?: AssistantAttachment | null,
  options?: TobiAssistantOptions,
): Promise<AssistantMessage> {
  // 1. Intento primario: endpoint serverless con cascada multi-modelo y streaming SSE
  const server = await streamServerAssistant({
    prompt,
    context,
    attachment,
    attachments: options?.attachments,
    history: options?.history,
    onDelta: options?.onDelta,
  });
  if (server.ok && server.content) return buildAssistantMessage(server.content);

  // 2. Intento secundario: key directa de DeepSeek en cliente (si existe)
  const directKey = options?.apiKey ?? (typeof process !== 'undefined' ? process.env?.DEEPSEEK_API_KEY : undefined);
  if (directKey) {
    try {
      const userMessage = context?.liquidacionInput
        ? `Contexto de liquidación actual: ${JSON.stringify(context.liquidacionInput)}\n\nPregunta: ${prompt}`
        : prompt;
      const messages = [
        { role: 'system', content: TOBI_SYSTEM_PROMPT },
        ...(options?.history ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
        { role: 'user', content: userMessage },
      ];
      const directController = new AbortController();
      const directTimer = setTimeout(() => directController.abort(), 15000);
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directKey}`,
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 1024 }),
        signal: directController.signal,
      }).finally(() => clearTimeout(directTimer));
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        if (content) return buildAssistantMessage(content);
      }
    } catch {
      // cae al motor local
    }
  }

  // 3. Fallback determinístico
  return generateOfflineAnswer(prompt, context);
}

export const askHRAssistant = askDeepSeekAssistant;

/* ==========================================================================
 * Persistencia en Supabase en Tiempo Real (Multi-Tenant por Cliente)
 * ========================================================================== */

/**
 * Guarda un reporte de auditoría del Segundo Ojo en Supabase vinculado al cliente/empresa.
 */
export async function saveAuditRecordToSupabase(
  clientId: string,
  companyId: string,
  report: AuditReport,
): Promise<HRAuditRecord | null> {
  if (!supabase) return null;

  try {
    const record = {
      id: report.id,
      client_id: clientId,
      company_id: companyId,
      health_status: report.healthStatus,
      score: report.score,
      summary: report.summary,
      findings: report.findings,
      options: report.options,
      created_at: report.generatedAt,
    };

    const { data, error } = await supabase.from('hr_audit_records').insert([record]).select().single();
    if (error) {
      console.warn('[LaboraPy Assistant] Error persistiendo auditoría en Supabase:', error.message);
      return null;
    }
    return data as HRAuditRecord;
  } catch (err) {
    console.warn('[LaboraPy Assistant] Error de red Supabase:', err);
    return null;
  }
}

/**
 * Obtiene el historial de auditorías de una empresa o cliente desde Supabase.
 */
export async function fetchAuditHistoryFromSupabase(clientId: string): Promise<HRAuditRecord[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('hr_audit_records')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return [];
    return (data ?? []) as HRAuditRecord[];
  } catch (_err) {
    return [];
  }
}

/**
 * Guarda un mensaje de chat en la sesión activa del cliente.
 */
export async function saveChatMessageToSupabase(
  sessionId: string,
  clientId: string,
  companyId: string,
  message: AssistantMessage,
): Promise<HRChatMessage | null> {
  if (!supabase) return null;

  try {
    const record = {
      id: message.id,
      session_id: sessionId,
      client_id: clientId,
      company_id: companyId,
      role: message.role,
      content: message.content,
      citations: message.citations ?? [],
      audit_report_id: message.auditReportId ?? null,
      created_at: message.createdAt,
    };

    const { data, error } = await supabase.from('hr_chat_messages').insert([record]).select().single();
    if (error) return null;
    return data as HRChatMessage;
  } catch (_err) {
    return null;
  }
}

/**
 * Registra el feedback del usuario (positivo o negativo) sobre una respuesta pericial de Tobi
 * con persistencia dual tolerante a fallos (localStorage y Supabase) para aprendizaje continuo.
 */
export async function recordTobiFeedback(
  sessionId: string,
  messageId: string,
  rating: TobiFeedbackRating,
  query?: string,
  answer?: string,
): Promise<void> {
  if (!sessionId || !messageId) return;
  const createdAt = new Date().toISOString();

  // 1) Persistencia local defensiva en localStorage para métricas y resiliencia offline
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('tobi_feedback_history') : null;
    const parsed = raw ? JSON.parse(raw) : [];
    const history = Array.isArray(parsed) ? parsed.filter((i: any) => i?.messageId !== messageId) : [];
    history.push({ sessionId, messageId, rating, query, answer, createdAt });
    if (typeof window !== 'undefined') {
      localStorage.setItem('tobi_feedback_history', JSON.stringify(history.slice(-200)));
    }
  } catch (_err) {
    // Tolerante a fallos en caso de modo incógnito o storage lleno
  }

  // 2) Persistencia remota en Supabase si el cliente está inicializado
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('hr_chat_messages')
      .update({ feedback: rating, feedback_at: createdAt })
      .eq('id', messageId)
      .select('id');

    if ((!data || data.length === 0) && answer) {
      await supabase.from('hr_chat_messages').upsert({
        id: messageId,
        session_id: sessionId,
        role: 'assistant',
        content: answer,
        feedback: rating,
        feedback_at: createdAt,
      });
    }
  } catch (_err) {
    // Silencioso para garantizar cero interrupción en la UI
  }
}
