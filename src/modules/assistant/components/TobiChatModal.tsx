import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { AssistantAttachment, AssistantMessage, AssistantQueryContext, TobiFeedbackRating } from '../types';
import { askDeepSeekAssistant, generateOfflineAnswer, recordTobiFeedback, saveChatMessageToSupabase } from '../assistantService';
import { createWhatsAppUrl, LABORAPY_CONFIG } from '../../../config/laborapy';
import { processMediaFile, MAX_FILES_PER_DROP } from '../mediaProcessor';
import {
  extractSettlementAction,
  executeSettlementAction,
  toSettlementActionPayload,
  applyAgenticSettlementAdjustment,
  cleanAllActionBlockMarkers,
  extractSettlementFromUserPrompt,
} from '../tobiSettlementAction';
import { prepareContextForInference } from '../sessionManager';
import { SALARIO_MINIMO_MENSUAL_2026 } from '../../payroll/constants';
import {
  extractDocumentAction,
  isDocumentIntent,
  extractDocContextFromHistory,
  type TobiDocumentFormInitialData,
} from '../tobiDocumentAction';
import { extractContinuationOptions } from '../tobiOptionsAction';
import { evaluateTobiPeritaje } from '../systemOne';
import { useTobiVoice } from '../hooks/useTobiVoice';
import { TobiSettlementCard } from './TobiSettlementCard';
import { TobiDocumentCard } from './TobiDocumentCard';
import { TobiContinuationOptions } from './TobiContinuationOptions';
import { TobiPeritajeCard } from './TobiPeritajeCard';
import { TobiDocumentFormCard } from './TobiDocumentFormCard';
import { TobiSettlementFormCard } from './TobiSettlementFormCard';
import type { TobiDocumentType, TobiDocumentActionPayload, TobiSettlementActionPayload } from '../types';

export interface TobiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
  clientId?: string;
  companyId?: string;
  isGuest?: boolean;
  initialPrompt?: string;
}

const GUEST_QUERY_KEY = 'laborapy_tobi_guest_queries_count';
const GUEST_QUERY_LIMIT = 3;
let guestMemoryFallback = 0;

const WHATSAPP_NUMBER = LABORAPY_CONFIG.whatsAppNumber || '595984469005';

const QUICK_SUGGESTIONS: string[] = [
  '¿Cómo calculo el aguinaldo proporcional?',
  '¿Qué me corresponde por despido injustificado?',
  'Me hacen facturar pero cumplo horario (Art. 19)',
  '¿Cuáles son los plazos de comunicación a IPS y MTESS?',
];

const SPECIALIST_KEYWORDS = [
  'especialista',
  'abogado',
  'asesor',
  'asesoría',
  'asesoria',
  'demanda',
  'juicio',
  'tribunal',
  'audiencia',
  'inspección',
  'inspeccion',
  'denuncia',
  'ministerio',
];

let messageIdCounter = 0;
const nextId = (prefix: string): string => {
  messageIdCounter += 1;
  return `${prefix}-${Date.now()}-${messageIdCounter}`;
};

const buildSessionId = (clientId?: string, companyId?: string): string => {
  const c = clientId || 'anon-client';
  const co = companyId || 'anon-company';
  return `tobi-${co}-${c}-${Math.floor(Date.now() / 86400000)}`;
};

const needsSpecialist = (text: string): boolean => {
  const normalized = (text || '').toLowerCase();
  return SPECIALIST_KEYWORDS.some((kw) => normalized.includes(kw));
};

const buildWhatsAppLink = (question?: string): string => {
  const base = 'Hola, necesito asesoría con un especialista de LaboraPy.';
  const extra = question ? ` Mi consulta fue: "${question}".` : '';
  const text = encodeURIComponent(`${base}${extra}`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
};

const formatInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`b-${key++}`} style={{ color: '#c7d2fe', fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={`c-${key++}`}
          style={{
            background: 'rgba(99,102,241,0.18)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: '0.85em',
            color: '#e0e7ff',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <em key={`i-${key++}`} style={{ color: '#a5b4fc' }}>
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) parts.push(text);
  return parts;
};

const cleanAndRenderContent = (raw?: string): React.ReactNode => {
  if (!raw || typeof raw !== 'string') return null;

  // Filtro preventivo estricto: eliminar cualquier residuo de etiquetas condescendientes o rígidas
  const sanitizedHeader = raw
    .replace(/^🤝\s*\**\s*(?:Contención y )?Empatía(?:\s*Inicial)?\s*:?\**\s*/gim, '')
    .replace(/^💡\s*\**\s*(?:Explicación en )?Cristiano(?:\s*\(A prueba de bobos\))?\s*:?\**\s*/gim, '')
    .replace(/\(A prueba de bobos\)/gi, '')
    .replace(/a prueba de bobos/gi, '')
    .replace(/^⚖️\s*\**\s*(?:El )?Respaldo de la Ley(?:\s*Paraguaya)?\s*:?\**\s*/gim, '### Respaldo Normativo\n')
    .replace(/^📋\s*\**\s*(?:Tu )?Plan de Acción(?:\s*Paso a Paso)?\s*:?\**\s*/gim, '### Recomendaciones y Próximos Pasos\n');

  const cleaned = cleanAllActionBlockMarkers(sanitizedHeader).trim();

  const lines = cleaned.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();

    if (!line) {
      elements.push(<div key={`gap-${i}`} style={{ height: 6 }} />);
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      const headingText = line.replace(/^#{2,3}\s*/, '');
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: '#c7d2fe',
            marginTop: 8,
            marginBottom: 3,
            letterSpacing: '0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{headingText}</span>
        </div>,
      );
    } else if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      const bulletText = line.replace(/^[•\-*]\s*/, '');
      elements.push(
        <div
          key={`b-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginLeft: 4,
            marginBottom: 3,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: '#818cf8', fontWeight: 700, lineHeight: 1.4 }}>•</span>
          <span style={{ flex: 1 }}>{formatInline(bulletText)}</span>
        </div>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s*(.*)$/);
      const num = match ? match[1] : '';
      const text = match ? match[2] : line;
      elements.push(
        <div
          key={`num-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginLeft: 4,
            marginBottom: 3,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: '#a5b4fc', fontWeight: 700, minWidth: 18 }}>{num}</span>
          <span style={{ flex: 1 }}>{formatInline(text)}</span>
        </div>,
      );
    } else {
      elements.push(
        <div key={`p-${i}`} style={{ lineHeight: 1.55, marginBottom: 3 }}>
          {formatInline(rawLine)}
        </div>,
      );
    }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{elements}</div>;
};

const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= 480 : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

export const TobiChatModal: React.FC<TobiChatModalProps> = ({
  isOpen,
  onClose,
  companyName,
  clientId,
  companyId,
  isGuest = !clientId,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMinimized = false;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [guestQueriesCount, setGuestQueriesCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem(GUEST_QUERY_KEY);
      const parsed = stored ? parseInt(stored, 10) : 0;
      return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, GUEST_QUERY_LIMIT)) : 0;
    } catch {
      return guestMemoryFallback;
    }
  });

  const isLimitReached = Boolean(isGuest && guestQueriesCount >= GUEST_QUERY_LIMIT);

  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasBootstrapped = useRef<boolean>(false);
  const activeRequestRef = useRef<boolean>(false);

  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [pdfProcessing, setPdfProcessing] = useState<boolean>(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);
  const [activeDocFormTipo, setActiveDocFormTipo] = useState<TobiDocumentType | null>(null);
  const [activeDocInitialData, setActiveDocInitialData] = useState<TobiDocumentFormInitialData | null>(null);
  const [isSettlementFormActive, setIsSettlementFormActive] = useState<boolean>(false);
  // Síntesis de voz (Text-to-Speech) para escuchar respuestas manualmente
  const { isSpeaking, currentlySpeakingText, speakText, stopSpeaking } = useTobiVoice();

  const handleProcessIncomingFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_FILES_PER_DROP);
    if (list.length === 0) return;
    if (files.length > MAX_FILES_PER_DROP) {
      alert(`Podés adjuntar hasta ${MAX_FILES_PER_DROP} archivos a la vez. Procesando los primeros ${MAX_FILES_PER_DROP}.`);
    }

    setPdfProcessing(true);
    try {
      const allAttachments: AssistantAttachment[] = [];
      for (const f of list) {
        const result = await processMediaFile(f);
        allAttachments.push(...result);
      }
      setAttachments((prev) => [...prev, ...allAttachments].slice(0, 5));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo procesar el archivo adjunto.');
    } finally {
      setPdfProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleProcessIncomingFiles(e.target.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sessionId = useMemo(() => buildSessionId(clientId, companyId), [clientId, companyId]);
  const safeClientId = clientId || 'anon-client';
  const safeCompanyId = companyId || 'anon-company';

  const lastSettlement = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.settlementData) return messages[i].settlementData;
    }
    return null;
  }, [messages]);

  const queryContext: AssistantQueryContext = useMemo(
    () => ({
      companyName,
      clientId,
      companyId,
      liquidacionInput: lastSettlement?.input,
      liquidacionResult: lastSettlement?.result,
    }) as AssistantQueryContext,
    [companyName, clientId, companyId, lastSettlement],
  );

  const lastUserQuestion = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && (m.role === 'user' || (m as any).sender === 'user')) {
        return m.content || '';
      }
    }
    return '';
  }, [messages]);

  const showSpecialistCTA = useMemo(() => {
    if (messages.length === 0) return false;
    const lastAssistant = [...messages].reverse().find(
      (m) => m.role === 'assistant' || (m as any).sender === 'assistant',
    );
    if (!lastAssistant) return false;
    return needsSpecialist(lastAssistant.content || '') || needsSpecialist(lastUserQuestion);
  }, [messages, lastUserQuestion]);

  const conversationStarting = messages.length <= 1;

  useEffect(() => {
    if (!isOpen) return;
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    const greetingText = companyName
      ? `¡Hola! Soy **Tobi**, tu Copilot y Profesor de Recursos Humanos y Legislación Laboral para **${companyName}**.\n\nEstoy a tu disposición para orientarte en liquidaciones, cálculos de haberes, contratos, aportes de IPS, gestiones del MTESS y cualquier duda sobre la ley laboral en Paraguay con paciencia y tranquilidad.\n\n¿En qué consulta te puedo orientar hoy?`
      : `¡Hola! Soy **Tobi**, tu Copilot y Profesor de Recursos Humanos y Legislación Laboral de **LaboraPy**.\n\nEstoy a tu disposición para orientarte en liquidaciones, cálculos de haberes, contratos, aportes de IPS, trámites del MTESS y cualquier consulta laboral en Paraguay con paciencia y tranquilidad.\n\n¿En qué te puedo orientar hoy?`;

    const greeting: AssistantMessage = {
      id: nextId('assistant'),
      role: 'assistant',
      content: greetingText,
      createdAt: new Date().toISOString(),
    };

    setMessages([greeting]);
  }, [isOpen, companyName]);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen) return;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen, isMobile]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, 140);
    ta.style.height = `${next}px`;
  }, [input, isOpen]);

  const persist = useCallback(
    async (message: AssistantMessage) => {
      try {
        await saveChatMessageToSupabase(sessionId, safeClientId, safeCompanyId, message);
      } catch (_err) {
        // Silencioso: persistencia opcional
      }
    },
    [sessionId, safeClientId, safeCompanyId],
  );

  const handleSend = useCallback(
    async (
      rawText?: string,
      explicitAttachments?: AssistantAttachment[],
      _options?: { readonly skipTts?: boolean },
    ): Promise<string | null> => {
      const activeAttachments = explicitAttachments ?? attachments;
      const text =
        (rawText ?? input).trim() ||
        (activeAttachments.length
          ? (activeAttachments[0].mimeType.startsWith('audio/')
              ? 'Consulta por nota de voz grabada'
              : `Auditoría pericial jurídica del documento adjunto (${activeAttachments[0].name})`)
          : '');
      if (!text || isLoading || activeRequestRef.current || pdfProcessing) return null;

      if (isGuest && guestQueriesCount >= GUEST_QUERY_LIMIT) {
        return null;
      }

      activeRequestRef.current = true;

      setErrorMessage(null);
      setInput('');

      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const userMessage: AssistantMessage = {
        id: nextId('user'),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        attachment: activeAttachments.length ? { ...activeAttachments[0] } : null,
      };

      const history = prepareContextForInference(messages);

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      void persist(userMessage);

      if (isGuest) {
        const nextCount = Math.min(GUEST_QUERY_LIMIT, guestQueriesCount + 1);
        setGuestQueriesCount(nextCount);
        guestMemoryFallback = nextCount;
        try {
          localStorage.setItem(GUEST_QUERY_KEY, String(nextCount));
        } catch {
          // in-memory fallback
        }
      }

      // Si el usuario expresa intención directa de documentar o completar datos,
      // abrimos las casillas de inmediato sin hacerlo esperar ni generar fricción
      if (isDocumentIntent(text)) {
        const { tipo: detectedTipo, data: initialData } = extractDocContextFromHistory(
          [...messages, userMessage],
          text,
        );
        setActiveDocFormTipo(detectedTipo);
        setActiveDocInitialData(initialData);
        setIsSettlementFormActive(false);
      }

      const draftId = nextId('assistant');
      let streamedText = '';
      let streamStarted = false;

      const onDelta = (delta: string) => {
        streamedText += delta;
        if (!streamStarted) {
          streamStarted = true;
          setIsLoading(false);
          const draft: AssistantMessage = {
            id: draftId,
            role: 'assistant',
            content: streamedText,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, draft]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === draftId ? { ...m, content: streamedText } : m)),
          );
        }
      };

      try {
        // Evaluación pericial preliminar System One en segundo plano
        let systemOneJudgment: any = null;
        try {
          systemOneJudgment = await evaluateTobiPeritaje(text);
        } catch (_errPeritaje) {
          // Fallback silencioso
        }

        let assistantMessage: AssistantMessage | null = null;
        try {
          assistantMessage = await askDeepSeekAssistant(text, queryContext, null, {
            history,
            onDelta,
            attachments: activeAttachments,
          });
          if (!assistantMessage || !assistantMessage.content) {
            assistantMessage = null;
          }
        } catch (_err) {
          assistantMessage = null;
        }

        if (assistantMessage && assistantMessage.content) {
          if (!assistantMessage.id) {
            (assistantMessage as any).id = nextId('assistant');
          }
          if (!assistantMessage.role) {
            (assistantMessage as any).role = 'assistant';
          }
          if (!assistantMessage.createdAt) {
            (assistantMessage as any).createdAt = new Date().toISOString();
          }

          const rawContent = assistantMessage.content || streamedText;
          const { cleanedText: textAfterLiq, payload } = extractSettlementAction(rawContent);
          const { cleanedText: textAfterDoc, payload: docPayload } = extractDocumentAction(textAfterLiq);
          const { cleanedText, options: continuationOptions } = extractContinuationOptions(textAfterDoc);

          let settlementData: { input: any; result: any } | null = null;
          if (payload) {
            try {
              settlementData = executeSettlementAction(payload);
            } catch (err) {
              console.warn('Error al calcular liquidación automática de Tobi:', err);
            }
          } else if (lastSettlement?.input) {
            try {
              const basePayload = toSettlementActionPayload(lastSettlement.input);
              const adjusted = applyAgenticSettlementAdjustment(basePayload, text);
              if (adjusted) {
                settlementData = executeSettlementAction(adjusted);
              }
            } catch (err) {
              console.warn('Error al aplicar ajuste agéntico determinístico:', err);
            }
          } else {
            try {
              let promptPayload = extractSettlementFromUserPrompt(text);
              if (!promptPayload) {
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'user') {
                    promptPayload = extractSettlementFromUserPrompt(messages[i].content);
                    if (promptPayload) break;
                  }
                }
              }
              if (promptPayload) {
                settlementData = executeSettlementAction(promptPayload);
              }
            } catch (err) {
              console.warn('Error en auto-detección desde prompt en modal:', err);
            }
          }

          // Si el asistente emitió un documentData que requiere completar casillas o el usuario pidió redactarlo,
          // abrimos directamente el formulario interactivo precargado sin fricción
          if (docPayload) {
            const isPlaceholderDoc =
              !docPayload.nombreEmpleado ||
              docPayload.nombreEmpleado.includes('[Completar') ||
              !docPayload.ciEmpleado ||
              docPayload.ciEmpleado.includes('[Completar') ||
              docPayload.ciEmpleado === '—';
            if (isPlaceholderDoc || isDocumentIntent(text)) {
              const { data: initialData } = extractDocContextFromHistory(
                [...messages, userMessage],
                text,
              );
              setActiveDocFormTipo(docPayload.tipo);
              setActiveDocInitialData({ ...initialData, ...docPayload });
              setIsSettlementFormActive(false);
            }
          }

          if (streamStarted) {
            // Reemplaza el draft existente (mismo id) conservando citas y auditoría
            const finalMessage: AssistantMessage = {
              ...assistantMessage,
              id: draftId,
              role: 'assistant',
              content: cleanedText || rawContent,
              createdAt: assistantMessage.createdAt || new Date().toISOString(),
              settlementData,
              documentData: docPayload,
              continuationOptions,
              systemOneJudgment,
            };
            setMessages((prev) => prev.map((m) => (m.id === draftId ? finalMessage : m)));
            void persist(finalMessage);
            return finalMessage.content;
          } else {
            const finalMessage: AssistantMessage = {
              ...assistantMessage,
              content: cleanedText || rawContent,
              settlementData,
              documentData: docPayload,
              continuationOptions,
              systemOneJudgment,
            };
            setMessages((prev) => [...prev, finalMessage]);
            void persist(finalMessage);
            return finalMessage.content;
          }
        } else if (streamStarted) {
          // Hay texto parcial visible: no se pisa ni se reemplaza por offline; se persiste tal cual
          const { cleanedText: textAfterLiq, payload } = extractSettlementAction(streamedText);
          const { cleanedText: textAfterDoc, payload: docPayload } = extractDocumentAction(textAfterLiq);
          const { cleanedText, options: continuationOptions } = extractContinuationOptions(textAfterDoc);

          let settlementData: { input: any; result: any } | null = null;
          if (payload) {
            try {
              settlementData = executeSettlementAction(payload);
            } catch (err) {
              console.warn('Error al calcular liquidación automática de Tobi:', err);
            }
          } else if (lastSettlement?.input) {
            try {
              const basePayload = toSettlementActionPayload(lastSettlement.input);
              const adjusted = applyAgenticSettlementAdjustment(basePayload, text);
              if (adjusted) {
                settlementData = executeSettlementAction(adjusted);
              }
            } catch (err) {
              console.warn('Error al aplicar ajuste agéntico determinístico:', err);
            }
          } else {
            try {
              let promptPayload = extractSettlementFromUserPrompt(text);
              if (!promptPayload) {
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'user') {
                    promptPayload = extractSettlementFromUserPrompt(messages[i].content);
                    if (promptPayload) break;
                  }
                }
              }
              if (promptPayload) {
                settlementData = executeSettlementAction(promptPayload);
              }
            } catch (err) {
              console.warn('Error en auto-detección desde prompt en modal stream:', err);
            }
          }
          const partial: AssistantMessage = {
            id: draftId,
            role: 'assistant',
            content: cleanedText || streamedText,
            createdAt: new Date().toISOString(),
            settlementData,
            documentData: docPayload,
            continuationOptions,
            systemOneJudgment,
          };
          void persist(partial);
          return partial.content;
        } else {
          const offline = generateOfflineAnswer(text, queryContext);
          const { cleanedText: offClean, options: offOptions } = extractContinuationOptions(offline.content);
          const enrichedOffline: AssistantMessage = {
            ...offline,
            content: offClean,
            continuationOptions: offOptions,
            systemOneJudgment,
          };
          setMessages((prev) => [...prev, enrichedOffline]);
          void persist(enrichedOffline);
          return enrichedOffline.content;
        }
      } catch (_err) {
        if (streamStarted) {
          // No borrar el texto parcial ya renderizado
          const partial: AssistantMessage = {
            id: draftId,
            role: 'assistant',
            content: streamedText,
            createdAt: new Date().toISOString(),
          };
          void persist(partial);
          return partial.content;
        } else {
          setErrorMessage('No pude procesar tu consulta. Intenta nuevamente.');
          const fallback: AssistantMessage = {
            id: nextId('assistant'),
            role: 'assistant',
            content:
              'Disculpá, se presentó una breve intermitencia con el servicio de IA.\n\nPor favor reintentá tu consulta en unos segundos o, si es un caso urgente, podés comunicarte directamente con nuestro equipo de especialistas vía WhatsApp.',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, fallback]);
          return fallback.content;
        }
      } finally {
        activeRequestRef.current = false;
        setIsLoading(false);
      }
    },
    [input, isLoading, persist, queryContext, isGuest, guestQueriesCount, attachments, pdfProcessing, messages],
  );

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const initialPromptProcessedRef = useRef(false);

  useEffect(() => {
    if (isOpen && initialPrompt && !initialPromptProcessedRef.current) {
      initialPromptProcessedRef.current = true;
      const t = setTimeout(() => {
        if (handleSendRef.current) {
          void handleSendRef.current(initialPrompt);
        }
      }, 150);
      return () => clearTimeout(t);
    }
    if (!isOpen) {
      initialPromptProcessedRef.current = false;
    }
  }, [isOpen, initialPrompt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleFeedback = useCallback(
    async (messageId: string, rating: TobiFeedbackRating) => {
      const targetMessage = messages.find((m) => m.id === messageId);
      if (!targetMessage || targetMessage.feedback === rating) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m)),
      );

      const previousUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === 'user');

      void recordTobiFeedback(
        sessionId,
        messageId,
        rating,
        previousUserMsg?.content,
        targetMessage.content,
      );
    },
    [messages, sessionId],
  );

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((curr) => (curr === messageId ? null : curr));
      }, 2000);
    } catch (err) {
      console.warn('No se pudo copiar el texto:', err);
    }
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setInput('');
    setErrorMessage(null);
    hasBootstrapped.current = true;
    const resetText = companyName
      ? `Conversación reiniciada. ¿En qué consulta laboral para **${companyName}** te puedo colaborar?`
      : 'Conversación reiniciada. Estoy listo para asistirte con cualquier consulta sobre legislación y gestión laboral en Paraguay.';

    const reset: AssistantMessage = {
      id: nextId('assistant'),
      role: 'assistant',
      content: resetText,
      createdAt: new Date().toISOString(),
    };
    setMessages([reset]);
  }, []);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      const norm = suggestion.toLowerCase();
      if (norm.includes('casillas') || norm.includes('cargar datos')) {
        if (norm.includes('liquidación') || norm.includes('calcular')) {
          setIsSettlementFormActive(true);
          setActiveDocFormTipo(null);
          setActiveDocInitialData(null);
          return;
        }

        // Extraer contexto del caso desde el historial para precargar casillas sin fricción
        const { tipo: detectedTipo, data: initialData } = extractDocContextFromHistory(messages, suggestion);
        setActiveDocFormTipo(detectedTipo);
        setActiveDocInitialData(initialData);
        setIsSettlementFormActive(false);
        return;
      }

      void handleSend(suggestion);
    },
    [handleSend, messages],
  );

  const handleDocumentFormSubmit = useCallback(
    (payload: TobiDocumentActionPayload) => {
      setActiveDocFormTipo(null);
      setActiveDocInitialData(null);
      const docMessage: AssistantMessage = {
        id: nextId('assistant'),
        role: 'assistant',
        content: `¡Listo! Generé el documento oficial de **${payload.tipo.replace(/_/g, ' ')}** para **${payload.nombreEmpleado}** conforme a las normativas del Código del Trabajo (Ley 213/93). Podés descargarlo al instante en PDF membretado o en Word (.docx) editable:`,
        createdAt: new Date().toISOString(),
        documentData: payload,
      };
      setMessages((prev) => [...prev, docMessage]);
      void persist(docMessage);
    },
    [persist],
  );

  const handleSettlementFormSubmit = useCallback(
    (payload: TobiSettlementActionPayload) => {
      setIsSettlementFormActive(false);
      let settlementData: { input: any; result: any } | null = null;
      try {
        settlementData = executeSettlementAction(payload);
      } catch (err) {
        console.warn('Error calculando liquidación:', err);
      }

      const salarioDeclarado = payload.salarioMensual;
      const esMenorAlMinimo = salarioDeclarado > 0 && salarioDeclarado < SALARIO_MINIMO_MENSUAL_2026;
      const explicacionSalario = esMenorAlMinimo
        ? `Noté amablemente que tu salario mensual declarado (**Gs. ${salarioDeclarado.toLocaleString('es-PY')}**) es inferior al Salario Mínimo Legal Vigente (**Gs. ${SALARIO_MINIMO_MENSUAL_2026.toLocaleString('es-PY')}**).\n\n⚖️ **Protección Legal Pro-Operario (Art. 249 y concordantes del Código del Trabajo):** La legislación laboral paraguaya es de orden público. Tu empleador no puede beneficiarse de pagar por debajo del piso legal ni liquidarte indemnizaciones sobre un salario inferior a la ley. Por este motivo, **calculé tu liquidación oficial tomando como base el salario mínimo legal vigente de Gs. ${SALARIO_MINIMO_MENSUAL_2026.toLocaleString('es-PY')}** para proteger tus derechos y asegurar que reclames lo que legalmente te corresponde.`
        : `Realicé el cálculo oficial de liquidación laboral conforme a la Ley 213/93 y 496/95 para un salario mensual de **Gs. ${salarioDeclarado.toLocaleString('es-PY')}**.`;

      const liqMessage: AssistantMessage = {
        id: nextId('assistant'),
        role: 'assistant',
        content: `¡Listo! ${explicacionSalario}\n\nPodés revisar los rubros desglosados y descargar el finiquito blindado:`,
        createdAt: new Date().toISOString(),
        settlementData,
      };
      setMessages((prev) => [...prev, liqMessage]);
      void persist(liqMessage);
    },
    [persist],
  );

  if (!isOpen) return null;

  const isUserMessage = (m: AssistantMessage): boolean =>
    m.role === 'user' || (m as any).sender === 'user';

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    maxWidth: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    borderRadius: 0,
    overflowX: 'hidden',
    display: isMinimized ? 'none' : 'flex',
    flexDirection: 'column',
    background: '#070c18',
    zIndex: 99999,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #090e17 0%, #0f1c30 50%, #064e3b 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: isMobile ? '12px 14px' : '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f8fafc',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div
      style={containerStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Chat con Tobi"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* HEADER */}
      <div style={headerStyle}>
        <div
          style={{
            width: '100%',
            maxWidth: 860,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: isMobile ? 36 : 42,
                height: isMobile ? 36 : 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 18 : 20,
                boxShadow: '0 0 0 2px rgba(255,255,255,0.15), 0 8px 20px rgba(16,185,129,0.35)',
                flexShrink: 0,
                animation: 'tobiPulse 3.2s ease-in-out infinite',
              }}
            >
              <span role="img" aria-label="destello">
                ✨
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'nowrap',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: isMobile ? 15 : 17,
                    letterSpacing: 0.2,
                    whiteSpace: 'nowrap',
                    color: '#ffffff',
                  }}
                >
                  TOBI
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(16,185,129,0.18)',
                    border: '1px solid rgba(16,185,129,0.45)',
                    color: '#a7f3d0',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Jurisprudencia CSJ
                </span>
                {isGuest && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: isLimitReached ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                      border: `1px solid ${isLimitReached ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.4)'}`,
                      color: isLimitReached ? '#fca5a5' : '#c7d2fe',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isLimitReached ? '🔒 Límite 3/3' : `⚡ Cortesía ${guestQueriesCount}/3`}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: '#94a3b8',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Copilot Pericial & Notarial Laboral · LaboraPy
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              aria-label="Nueva consulta"
              title="Nueva consulta (limpiar conversación)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e8f0',
                height: 34,
                padding: isMobile ? '0 10px' : '0 14px',
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
              onClick={handleClear}
            >
              <span>+</span>
              <span style={{ display: isMobile ? 'none' : 'inline' }}>Nueva consulta</span>
            </button>

            <button
              type="button"
              aria-label="Volver a la web"
              title="Cerrar y volver a la web"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                height: 34,
                padding: '0 12px',
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
              onClick={onClose}
            >
              <span>✕</span>
              <span>Volver</span>
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* MENSAJES */}
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: isMobile ? '16px 12px' : '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              background:
                'radial-gradient(1200px 400px at 50% -10%, rgba(99,102,241,0.07), transparent 65%), #070c18',
              scrollBehavior: 'smooth',
              position: 'relative',
            }}
          >
            {/* OVERLAY DRAG & DROP */}
            {isDragging && (
              <div
                style={{
                  position: 'absolute',
                  inset: 12,
                  zIndex: 100,
                  background: 'rgba(7, 12, 24, 0.92)',
                  backdropFilter: 'blur(10px)',
                  border: '2px dashed #6366f1',
                  borderRadius: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#f8fafc',
                  pointerEvents: 'none',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.35)',
                }}
              >
                <span style={{ fontSize: 42 }}>📥</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#c7d2fe' }}>
                  Soltá acá tus documentos o fotos
                </span>
                <span style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center', maxWidth: 420, paddingInline: 16 }}>
                  Soporta PDFs (hasta 15 págs), documentos Word (.docx/.doc), fotos o notas de voz (hasta 12 MB). Máx. 3 archivos.
                </span>
              </div>
            )}
            <div
              style={{
                width: '100%',
                maxWidth: 860,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
            {messages.map((m, idx) => {
              const user = isUserMessage(m);
              return (
                <div
                  key={m.id || `${m.createdAt}-${Math.random()}`}
                  style={{
                    display: 'flex',
                    justifyContent: user ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 8,
                    maxWidth: '100%',
                    minWidth: 0,
                  }}
                >
                  {!user && (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                      }}
                    >
                      ✨
                    </div>
                  )}
                  <div
                    style={
                      user
                        ? {
                            maxWidth: '82%',
                            background:
                              'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                            color: '#eef2ff',
                            padding: '10px 14px',
                            borderRadius: '16px 16px 4px 16px',
                            fontSize: 14,
                            lineHeight: 1.55,
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            border: '1px solid rgba(99,102,241,0.35)',
                            boxShadow: '0 6px 18px rgba(30,27,75,0.5)',
                          }
                        : {
                            maxWidth: '88%',
                            background:
                              'linear-gradient(160deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.92) 100%)',
                            color: '#e2e8f0',
                            padding: '12px 14px',
                            borderRadius: '16px 16px 16px 4px',
                            fontSize: 14,
                            lineHeight: 1.6,
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            border: '1px solid rgba(148,163,184,0.18)',
                            boxShadow: '0 6px 20px rgba(2,6,23,0.45)',
                          }
                    }
                  >
                    {user ? (
                      <div>
                        {m.attachment && (
                          <div
                            style={{
                              marginBottom: 8,
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: 'rgba(15,23,42,0.6)',
                              border: '1px solid rgba(255,255,255,0.18)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              maxWidth: '100%',
                            }}
                          >
                            {m.attachment.mimeType.startsWith('audio/') ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span>🎵</span> {m.attachment.name}
                                </span>
                                <audio controls src={m.attachment.previewUrl || m.attachment.data} style={{ height: 30, maxWidth: 220 }} />
                              </div>
                            ) : m.attachment.previewUrl ? (
                              <img
                                src={m.attachment.previewUrl}
                                alt={m.attachment.name}
                                style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{ fontSize: 18, flexShrink: 0 }}>
                                {m.attachment.name.endsWith('.docx') || m.attachment.name.endsWith('.doc') ? '📝' : '📄'}
                              </span>
                            )}
                            {!m.attachment.mimeType.startsWith('audio/') && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: '#e0e7ff',
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {m.attachment.name}
                              </span>
                            )}
                          </div>
                        )}
                        <div>{m.content}</div>
                      </div>
                    ) : (
                      <>
                        {/* Tarjeta de Peritaje Preliminar System One */}
                        {m.systemOneJudgment && (
                          <TobiPeritajeCard judgment={m.systemOneJudgment} isMobile={isMobile} />
                        )}

                        {cleanAndRenderContent(m.content || '')}
                        {(() => {
                          const contentStr = typeof m.content === 'string' ? m.content : '';
                          const sData = m.settlementData || (m.role === 'assistant' && contentStr.includes(':::liquidacion_action') ? (() => {
                            const { payload } = extractSettlementAction(contentStr);
                            return payload ? executeSettlementAction(payload) : null;
                          })() : null);

                          if (!sData) return null;
                          return (
                            <div style={{ marginTop: 12 }}>
                              <TobiSettlementCard settlementData={sData} />
                            </div>
                          );
                        })()}
                        {(() => {
                          const contentStr = typeof m.content === 'string' ? m.content : '';
                          const docData = m.documentData || (m.role === 'assistant' && contentStr.includes(':::documento_action') ? extractDocumentAction(contentStr).payload : null);
                          if (!docData) return null;
                          return (
                            <div style={{ marginTop: 12 }}>
                              <TobiDocumentCard
                                documentData={docData}
                                companyName={companyName}
                                onEdit={(payload) => {
                                  const { data: histData } = extractDocContextFromHistory(messages);
                                  setActiveDocFormTipo(payload.tipo);
                                  setActiveDocInitialData({ ...histData, ...payload });
                                  setIsSettlementFormActive(false);
                                }}
                              />
                            </div>
                          );
                        })()}

                        {/* 4 Opciones interactivas de continuación para profundizar */}
                        {(() => {
                          const isLastAssistant = !isLoading && idx === messages.length - 1 && m.role === 'assistant';
                          if (!isLastAssistant) return null;
                          const options = m.continuationOptions || extractContinuationOptions(m.content || '').options;
                          if (!options || options.length === 0) return null;
                          return (
                            <TobiContinuationOptions
                              options={options}
                              onSelectOption={(opt) => void handleSuggestionClick(opt)}
                              disabled={isLoading}
                              isMobile={isMobile}
                            />
                          );
                        })()}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {(() => {
                              try {
                                const d = m.createdAt ? new Date(m.createdAt) : new Date();
                                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              } catch {
                                return '';
                              }
                            })()} · Tobi Pericial
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isSpeaking && currentlySpeakingText === m.content) {
                                  stopSpeaking();
                                } else {
                                  speakText(m.content);
                                }
                              }}
                              title={
                                isSpeaking && currentlySpeakingText === m.content
                                  ? 'Detener voz de Tobi'
                                  : 'Escuchar respuesta de Tobi en voz alta'
                              }
                              style={{
                                background:
                                  isSpeaking && currentlySpeakingText === m.content
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(16, 185, 129, 0.12)',
                                border:
                                  isSpeaking && currentlySpeakingText === m.content
                                    ? '1px solid #ef4444'
                                    : '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                color:
                                  isSpeaking && currentlySpeakingText === m.content ? '#fca5a5' : '#a7f3d0',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>{isSpeaking && currentlySpeakingText === m.content ? '⏹️' : '🔊'}</span>
                              <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                {isSpeaking && currentlySpeakingText === m.content ? 'Detener' : 'Escuchar'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopy(m.id, m.content)}
                              title="Copiar respuesta al portapapeles"
                              style={{
                                background: copiedMessageId === m.id ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                border: copiedMessageId === m.id ? '1px solid #818cf8' : '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                color: copiedMessageId === m.id ? '#a5b4fc' : '#94a3b8',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>{copiedMessageId === m.id ? '✓' : '📋'}</span>
                              <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                {copiedMessageId === m.id ? 'Copiado' : 'Copiar'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, 'positive')}
                              title="Esta orientación fue jurídicamente útil"
                              style={{
                                background: m.feedback === 'positive' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                                border: m.feedback === 'positive' ? '1px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                color: m.feedback === 'positive' ? '#4ade80' : '#94a3b8',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>👍</span>
                              {m.feedback === 'positive' && <span style={{ fontSize: '10px', fontWeight: 600 }}>Útil</span>}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, 'negative')}
                              title="Reportar ajuste o falta de precisión"
                              style={{
                                background: m.feedback === 'negative' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                border: m.feedback === 'negative' ? '1px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                color: m.feedback === 'negative' ? '#f87171' : '#94a3b8',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>👎</span>
                              {m.feedback === 'negative' && <span style={{ fontSize: '10px', fontWeight: 600 }}>Reportado</span>}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Casillas interactivas para completar notas laborales */}
            {activeDocFormTipo && (
              <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <TobiDocumentFormCard
                  initialTipo={activeDocFormTipo}
                  initialData={activeDocInitialData}
                  defaultEmpresa={companyName}
                  onSubmit={handleDocumentFormSubmit}
                  onCancel={() => {
                    setActiveDocFormTipo(null);
                    setActiveDocInitialData(null);
                  }}
                  isMobile={isMobile}
                />
              </div>
            )}

            {/* Casillas interactivas para calcular liquidación */}
            {isSettlementFormActive && (
              <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <TobiSettlementFormCard
                  onSubmit={handleSettlementFormSubmit}
                  onCancel={() => setIsSettlementFormActive(false)}
                  isMobile={isMobile}
                />
              </div>
            )}

            {showSpecialistCTA && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '92%',
                  background:
                    'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(99,102,241,0.14) 100%)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  color: '#d1fae5',
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  🔎 Tu caso parece requerir{' '}
                  <strong style={{ color: '#a7f3d0' }}>asesoría con un especialista</strong>. Un
                  profesional puede revisar tu situación con detalle.
                </div>
                <a
                  href={buildWhatsAppLink(lastUserQuestion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                    background: '#25D366',
                    color: '#06281a',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '9px 14px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    boxShadow: '0 6px 18px rgba(37,211,102,0.35)',
                  }}
                >
                  <span aria-hidden="true">💬</span>
                  Hablar por WhatsApp con un especialista
                </a>
              </div>
            )}

            {isLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 14,
                  color: '#c7d2fe',
                  fontSize: 13,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background:
                      'conic-gradient(from 0deg, #6366f1, #10b981, #f59e0b, #ec4899, #6366f1)',
                    animation: 'tobiSpin 1.1s linear infinite',
                  }}
                />
                <span>Tobi está pensando…</span>
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#fecaca',
                  fontSize: 12.5,
                }}
              >
                {errorMessage}
              </div>
            )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* SUGERENCIAS RÁPIDAS */}
          {conversationStarting && (
            <div
              style={{
                padding: isMobile ? '8px 12px 6px' : '10px 16px 6px',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0,
                background: '#070c18',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                overflowX: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 860,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: isMobile ? 'flex-start' : 'center',
                }}
              >
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    disabled={isLoading || pdfProcessing}
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      color: '#c7d2fe',
                      fontSize: 11.5,
                      padding: '5px 12px',
                      borderRadius: 999,
                      cursor: isLoading || pdfProcessing ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s ease, transform 0.15s ease',
                      textAlign: 'left',
                      fontWeight: 500,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT O PAYWALL CARD SI SE ALCANZÓ EL LÍMITE */}
          {isLimitReached ? (
            <div
              style={{
                padding: isMobile ? '14px 12px 18px' : '18px 20px 20px',
                background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,27,75,0.95) 100%)',
                borderTop: '1px solid rgba(245,158,11,0.35)',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#fbbf24',
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                <span>🔒 Límite de cortesía alcanzado (3 de 3 consultas)</span>
              </div>
              <div style={{ color: '#f8fafc', fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>
                ¿Querés profundizar en este caso o tener asesoría continua?
              </div>
              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  lineHeight: 1.45,
                  marginBottom: 14,
                  maxWidth: 440,
                  marginInline: 'auto',
                }}
              >
                Completaste tus consultas gratuitas de cortesía. Para consultas periciales ilimitadas, análisis de contratos y liquidaciones oficiales, conectá con un especialista o activá tu suscripción.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href={createWhatsAppUrl(
                    `Hola LaboraPy, estuve consultando con Tobi sobre legislación laboral y me gustaría hablar con un asesor especialista sobre mi caso:\n"${lastUserQuestion.slice(0, 120)}..."`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    borderRadius: 12,
                    background: '#25d366',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13,
                    textDecoration: 'none',
                    boxShadow: '0 6px 18px rgba(37,211,102,0.4)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span>💬 Hablar por WhatsApp (+595)</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: 'rgba(99,102,241,0.18)',
                    border: '1px solid rgba(99,102,241,0.45)',
                    color: '#c7d2fe',
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar y Ver Planes
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: isMobile ? '10px 12px 14px' : '14px 20px 18px',
                background: 'rgba(7, 12, 24, 0.96)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                flexShrink: 0,
              }}
            >
              <div style={{ width: '100%', maxWidth: 860, margin: '0 auto' }}>
              {/* Indicador de procesamiento de PDF */}
              {pdfProcessing && (
                <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 12, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#a7f3d0', fontSize: 12.5 }}>
                  ⏳ Procesando PDF… (máx. 15 páginas, comprimiendo para la ruta gratuita)
                </div>
              )}

              {/* Tarjeta de preview de adjunto si existe */}
              {attachments.length > 0 && (
                <div
                  style={{
                    padding: '8px 12px',
                    marginBottom: 10,
                    borderRadius: 12,
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    maxWidth: '100%',
                  }}
                >
                  {attachments[0].previewUrl ? (
                    <img
                      src={attachments[0].previewUrl}
                      alt={attachments[0].name}
                      style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e0e7ff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachments[0].name}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                      {attachments[0].mimeType === 'text/plain' ? 'Texto extraído listo para análisis' : 'Listo para auditoría forense con IA'}
                    </div>
                  </div>
                  {attachments.length > 1 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(16,185,129,0.18)',
                        border: '1px solid rgba(16,185,129,0.45)',
                        color: '#a7f3d0',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {attachments.length} páginas
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    style={{
                      border: 'none',
                      background: 'rgba(239,68,68,0.2)',
                      color: '#fca5a5',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                    title="Quitar archivo"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Sugerencias forenses automáticas si hay archivo adjunto */}
              {attachments.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {[
                    '📑 Auditar Nota de Despido (Art. 81 vs 84)',
                    '📄 Auditar Carta de Renuncia / Vicios (Art. 19)',
                    '🧾 Validar conceptos de este Recibo/Liquidación',
                    '📬 Auditar Notificación / Plazos Fatales (Art. 399)',
                    '⚖️ Investigar Dictamen / Jurisprudencia CSJ',
                  ].map((pText) => (
                    <button
                      key={pText}
                      type="button"
                      onClick={() => void handleSend(pText)}
                      disabled={isLoading || pdfProcessing}
                      style={{
                        background: 'rgba(16,185,129,0.14)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        color: '#a7f3d0',
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 999,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {pText}
                    </button>
                  ))}
                </div>
              )}

              {/* Banner de Tobi hablando con síntesis de voz */}
              {isSpeaking && (
                <div
                  style={{
                    padding: '6px 12px',
                    marginBottom: 8,
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#a7f3d0',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🔊</span>
                    <span>Tobi te está respondiendo en voz alta…</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    style={{
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#fca5a5',
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Silenciar
                  </button>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
                  background: 'rgba(30,41,59,0.65)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  borderRadius: 22,
                  padding: '6px 6px 6px 10px',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                  maxWidth: '100%',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Input oculto de subida de archivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.docx,.doc,audio/*,.txt,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                {/* Botón Clip para adjuntar documento, word, foto o audio */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || pdfProcessing}
                  aria-label="Adjuntar documento, foto o audio"
                  title="Adjuntar PDF (máx 15 págs), Word (.docx/.doc), foto o archivo hasta 12 MB"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: attachments.length > 0 ? '#818cf8' : '#94a3b8',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: 18,
                    padding: '6px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                >
                  📎
                </button>

                {/* Botón de Parar a Tobi */}
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    title="Interrumpir a Tobi"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      borderRadius: '50%',
                      width: 34,
                      height: 34,
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontSize: 17,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    ⏹️
                  </button>
                )}

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    attachments.length > 0
                      ? `Documento adjunto: ${attachments[0].name}${attachments.length > 1 ? ` (+${attachments.length - 1} archivos)` : ''}. Escribí una indicación o enviá directo…`
                      : isGuest
                      ? `Escribe tu consulta laboral (${GUEST_QUERY_LIMIT - guestQueriesCount} de ${GUEST_QUERY_LIMIT} restantes)…`
                      : 'Escribe tu consulta o caso laboral…'
                  }
                  rows={1}
                  disabled={isLoading || pdfProcessing}
                    style={{
                      flex: 1,
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: '#e2e8f0',
                      fontSize: 14,
                      lineHeight: 1.5,
                      padding: '8px 0',
                      maxHeight: 140,
                      overflowY: 'auto',
                      fontFamily: 'inherit',
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isLoading || pdfProcessing || (input.trim().length === 0 && attachments.length === 0)}
                  aria-label="Enviar mensaje"
                  title="Enviar"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: isLoading || pdfProcessing || (input.trim().length === 0 && attachments.length === 0) ? 'not-allowed' : 'pointer',
                    background:
                      isLoading || pdfProcessing || (input.trim().length === 0 && attachments.length === 0)
                        ? 'rgba(99,102,241,0.25)'
                        : 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
                    color: '#f8fafc',
                    fontSize: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                    boxShadow:
                      isLoading || pdfProcessing || (input.trim().length === 0 && attachments.length === 0)
                        ? 'none'
                        : '0 6px 16px rgba(99,102,241,0.45)',
                  }}
                >
                  {isLoading ? (
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.35)',
                        borderTopColor: '#ffffff',
                        animation: 'tobiSpin 0.9s linear infinite',
                      }}
                    />
                  ) : (
                    '➤'
                  )}
                </button>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  marginTop: 8,
                  textAlign: 'center',
                  lineHeight: 1.4,
                  padding: '0 8px',
                }}
              >
                {isGuest && (
                  <span style={{ display: 'block', marginBottom: 2, color: '#94a3b8' }}>
                    Modo Invitado: {GUEST_QUERY_LIMIT - guestQueriesCount} de {GUEST_QUERY_LIMIT} consultas gratuitas restantes.
                  </span>
                )}
                ⚠️ <strong>Aviso legal:</strong> Tobi es una inteligencia artificial orientativa y puede cometer errores o fallar. Sus respuestas no constituyen dictamen legal vinculante ni reemplazan el patrocinio letrado. LaboraPy no se hace responsable por las decisiones u omisiones adoptadas a partir del contenido generado.
              </div>
            </div>
            </div>
          )}
        </>
      )}

      <style>
        {`
          @keyframes tobiSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes tobiPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
        `}
      </style>
    </div>
  );
};

export default TobiChatModal;
