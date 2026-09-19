import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { AssistantAttachment, AssistantMessage, AssistantQueryContext } from '../types';
import { askDeepSeekAssistant, generateOfflineAnswer } from '../assistantService';
import {
  extractSettlementAction,
  executeSettlementAction,
  toSettlementActionPayload,
  applyAgenticSettlementAdjustment,
} from '../tobiSettlementAction';
import { SALARIO_MINIMO_MENSUAL_2026 } from '../../payroll/constants';
import {
  extractDocumentAction,
  isDocumentIntent,
  extractDocContextFromHistory,
  type TobiDocumentFormInitialData,
} from '../tobiDocumentAction';
import { extractContinuationOptions } from '../tobiOptionsAction';
import { processMediaFile, MAX_FILES_PER_DROP } from '../mediaProcessor';
import { useTobiVoice } from '../hooks/useTobiVoice';
import { evaluateTobiPeritaje } from '../systemOne';
import { TobiSettlementCard } from './TobiSettlementCard';
import { TobiDocumentCard } from './TobiDocumentCard';
import { TobiContinuationOptions } from './TobiContinuationOptions';
import { TobiDocumentFormCard } from './TobiDocumentFormCard';
import { TobiSettlementFormCard } from './TobiSettlementFormCard';
import { TobiPeritajeCard } from './TobiPeritajeCard';
import { TobiSidebar } from './TobiSidebar';
import {
  listChatSessions,
  saveChatSession,
  createChatSession,
  deleteChatSession,
  getActiveSessionId,
  generateChatTitle,
  prepareContextForInference,
  type ChatSession,
} from '../sessionManager';
import type { TobiDocumentType, TobiDocumentActionPayload, TobiSettlementActionPayload } from '../types';

export interface TobiChatLandingProps {
  companyName?: string;
  clientId?: string;
  companyId?: string;
  userName?: string;
  onNavigate?: (route: any) => void;
  onOpenClientPortal?: () => void;
}

interface ActionPill {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  prompt: string;
}

const ACTION_PILLS: readonly ActionPill[] = [
  {
    id: 'amonestacion',
    icon: '📄',
    title: 'Amonestación Escrita',
    subtitle: 'Apercibimiento por llegadas tardías o faltas',
    prompt: 'Necesito redactar una amonestación escrita formal para un colaborador que incurrió en faltas laborales reiteradas.',
  },
  {
    id: 'liquidacion',
    icon: '📊',
    title: 'Calcular Liquidación',
    subtitle: 'Finiquito, indemnización Art. 91 y preaviso',
    prompt: 'Quiero calcular la liquidación laboral oficial de un colaborador con salario mensual y fechas de ingreso y egreso.',
  },
  {
    id: 'suspension',
    icon: '⚠️',
    title: 'Suspensión Disciplinaria',
    subtitle: 'Sanción sin goce (Arts. 352/353 C.T.)',
    prompt: 'Necesito redactar una notificación formal de suspensión disciplinaria laboral conforme a los Arts. 352 y 353 del Código del Trabajo.',
  },
  {
    id: 'traslado',
    icon: '🔄',
    title: 'Nota de Traslado',
    subtitle: 'Cambio de sucursal o puesto según Art. 34 C.T.',
    prompt: 'Necesito comunicar formalmente el traslado de sucursal de un colaborador preservando categoría y salario según el Art. 34 del Código Laboral.',
  },
  {
    id: 'renuncia',
    icon: '📝',
    title: 'Despido / Renuncia',
    subtitle: 'Notificación oficial con causales o renuncia',
    prompt: 'Quiero redactar una nota oficial de despido o renuncia voluntaria con constancia de recepción para legajo.',
  },
  {
    id: 'csj',
    icon: '⚖️',
    title: 'Jurisprudencia CSJ',
    subtitle: 'Fallos vinculantes de la Corte Suprema en lo laboral',
    prompt: '¿Cuáles son los criterios vinculantes y precedentes de la Corte Suprema de Justicia (CSJ) sobre despidos y fraude laboral en Paraguay?',
  },
];

let messageIdCounter = 0;
const nextId = (prefix: string): string => {
  messageIdCounter += 1;
  return `${prefix}-${Date.now()}-${messageIdCounter}`;
};

function encodeShareChat(msgs: AssistantMessage[]): string {
  try {
    // Poda extrema: solo serializa role (1: user, 0: assistant), texto y datos mínimos de entrada
    const compact = msgs.map((m) => {
      const item: any = [m.role === 'user' ? 1 : 0, m.content || ''];
      if (m.settlementData?.input) {
        const inp = m.settlementData.input;
        item[2] = {
          s: inp.salarioMensual,
          i: inp.fechaIngreso,
          e: inp.fechaEgreso,
          m: inp.motivo,
          r: inp.regimen,
          p: inp.preaviso?.otorgado,
          n: inp.nombreEmpleado,
          c: inp.ciEmpleado,
        };
      } else if (m.documentData) {
        item[3] = m.documentData;
      }
      return item;
    });

    const json = JSON.stringify(compact);
    const b64 = window
      .btoa(
        encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodeURIComponent(b64);
  } catch {
    return '';
  }
}

function decodeShareChat(encoded: string): AssistantMessage[] | null {
  try {
    let b64 = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) {
      b64 += '=';
    }

    const binary = window.atob(b64);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;

    // Formato ultra-compacto nuevo (arrays [role, content, settlementInput, docPayload])
    if (parsed.length > 0 && Array.isArray(parsed[0])) {
      return parsed.map((item: any, idx: number) => {
        const isUser = item[0] === 1;
        const content = item[1] || '';
        let settlementData: any = null;

        if (item[2]) {
          const s = item[2];
          const payload: any = {
            salarioMensual: s.s,
            fechaIngreso: s.i,
            fechaEgreso: s.e,
            motivo: s.m,
            regimen: s.r,
            preavisoOtorgado: s.p,
            nombreEmpleado: s.n,
            ciEmpleado: s.c,
          };
          try {
            settlementData = executeSettlementAction(payload);
          } catch {
            // ignore
          }
        }

        return {
          id: `shared-${idx}-${Date.now()}`,
          role: isUser ? 'user' : 'assistant',
          content,
          createdAt: new Date().toISOString(),
          settlementData,
          documentData: item[3] || null,
        };
      });
    }

    // Retrocompatibilidad con formato antiguo completo
    return parsed.map((m: any, idx: number) => ({
      id: `shared-${idx}-${Date.now()}`,
      role: m.role || 'assistant',
      content: m.content || '',
      createdAt: m.createdAt || new Date().toISOString(),
      settlementData: m.settlementData,
      documentData: m.documentData,
    }));
  } catch {
    return null;
  }
}

export function recordLiveConversation(prompt: string, response: string, metadata?: any): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem('tobi_live_training_conversations');
    const list = raw ? JSON.parse(raw) : [];
    const entry = {
      id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      prompt,
      response,
      metadata,
    };
    const updated = [entry, ...(Array.isArray(list) ? list : [])].slice(0, 300);
    window.localStorage.setItem('tobi_live_training_conversations', JSON.stringify(updated));
  } catch {
    // best-effort
  }
}

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      void navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      style={{
        background: '#090e17',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 10,
        margin: '12px 0',
        overflow: 'hidden',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: 11.5,
          color: '#94a3b8',
          fontFamily: 'monospace',
          textTransform: 'lowercase',
        }}
      >
        <span>{lang || 'código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(16,185,129,0.2)' : 'transparent',
            border: 'none',
            color: copied ? '#34d399' : '#cbd5e1',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ Copiado' : '📋 Copiar código'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '12px 14px',
          overflowX: 'auto',
          fontSize: 12.5,
          lineHeight: 1.55,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          color: '#e2e8f0',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

const MarkdownTable: React.FC<{ rawRows: string[] }> = ({ rawRows }) => {
  if (!rawRows || rawRows.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const headerCells = parseRow(rawRows[0]);
  const isSeparator = (line: string) => /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(line);

  const startBodyIdx = isSeparator(rawRows[1]) ? 2 : 1;
  const bodyRows = rawRows.slice(startBodyIdx).map(parseRow);

  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12.5,
          textAlign: 'left',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
            {headerCells.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', fontWeight: 700, color: '#c7d2fe' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
        <em key={`i-${key++}`} style={{ color: '#cbd5e1' }}>
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const cleanAndRenderContent = (raw?: string): React.ReactNode => {
  if (!raw || typeof raw !== 'string') return null;

  const cleaned = raw
    .replace(/^🤝\s*\**\s*(?:Contención y )?Empatía(?:\s*Inicial)?\s*:?\**\s*/gim, '')
    .replace(/^💡\s*\**\s*(?:Explicación en )?Cristiano(?:\s*\(A prueba de bobos\))?\s*:?\**\s*/gim, '')
    .replace(/\(A prueba de bobos\)/gi, '')
    .replace(/a prueba de bobos/gi, '')
    .replace(/^⚖️\s*\**\s*(?:El )?Respaldo de la Ley(?:\s*Paraguaya)?\s*:?\**\s*/gim, '### Respaldo Normativo\n')
    .replace(/^📋\s*\**\s*(?:Tu )?Plan de Acción(?:\s*Paso a Paso)?\s*:?\**\s*/gim, '### Recomendaciones y Próximos Pasos\n')
    .replace(/:::liquidacion_action[\s\S]*?(:::|$)/g, '')
    .replace(/:::documento_action[\s\S]*?(:::|$)/g, '')
    .replace(/:::opciones_continuar[\s\S]*?(:::|$)/g, '')
    .trim();

  const lines = cleaned.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();

    if (!line) {
      elements.push(<div key={`gap-${i}`} style={{ height: 6 }} />);
      continue;
    }

    // Bloques de código (```lang ... ```)
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(<CodeBlock key={`code-${i}`} lang={lang} code={codeLines.join('\n')} />);
      continue;
    }

    // Tablas Markdown (| Col 1 | Col 2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [line];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith('|') &&
        lines[i + 1].trim().endsWith('|')
      ) {
        i++;
        tableLines.push(lines[i].trim());
      }
      elements.push(<MarkdownTable key={`tbl-${i}`} rawRows={tableLines} />);
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      const headingText = line.replace(/^#{2,3}\s*/, '');
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#c7d2fe',
            marginTop: 10,
            marginBottom: 4,
            letterSpacing: '0.01em',
          }}
        >
          {headingText}
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
            marginBottom: 4,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: '#10b981', flexShrink: 0 }}>•</span>
          <span style={{ flex: 1 }}>{formatInline(bulletText)}</span>
        </div>,
      );
    } else {
      elements.push(
        <p key={`p-${i}`} style={{ margin: '0 0 6px 0', lineHeight: 1.55 }}>
          {formatInline(rawLine)}
        </p>,
      );
    }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{elements}</div>;
};

const useIsMobile = (breakpoint = 640): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
};

export const TobiChatLanding: React.FC<TobiChatLandingProps> = ({
  companyName,
  clientId,
  companyId,
  userName,
  onNavigate: _onNavigate,
  onOpenClientPortal,
}) => {
  const isMobile = useIsMobile(640);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);

  // Estados de Casillas Rápidas
  const [activeDocFormTipo, setActiveDocFormTipo] = useState<TobiDocumentType | null>(null);
  const [activeDocInitialData, setActiveDocInitialData] = useState<TobiDocumentFormInitialData | null>(null);
  const [isSettlementFormActive, setIsSettlementFormActive] = useState(false);

  // Estados de Sidebar y Múltiples Sesiones de Chat (estilo ChatGPT/Gemini)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => listChatSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => getActiveSessionId());

  const handleSelectSession = useCallback((sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setCurrentSessionId(target.id);
      setMessages([...target.messages]);
      setActiveDocFormTipo(null);
      setActiveDocInitialData(null);
      setIsSettlementFormActive(false);
    }
  }, [sessions]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
    setActiveDocFormTipo(null);
    setActiveDocInitialData(null);
    setIsSettlementFormActive(false);
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteChatSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId]);

  // Síntesis de voz (Text-to-Speech) para escuchar respuestas de Tobi bajo demanda
  const { isSpeaking, currentlySpeakingText, speakText, stopSpeaking } = useTobiVoice();

  // Estado de compartir chat
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharedSession, setIsSharedSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestRef = useRef(false);

  // Detección de conversación compartida en el Hash de la URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#share=')) {
      const encoded = hash.slice(7);
      const decoded = decodeShareChat(encoded);
      if (decoded && decoded.length > 0) {
        setMessages(decoded);
        setIsSharedSession(true);
      }
    }
  }, []);

  const saludo = useMemo(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const nombreMostrado = userName?.trim();
  const saludoCompleto = nombreMostrado ? `${saludo}, ${nombreMostrado}` : saludo;
  const subtituloManos = nombreMostrado ? `¡Manos a la obra, ${nombreMostrado}!` : '¡Manos a la obra!';

  const lastSettlement = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.settlementData) return messages[i].settlementData;
    }
    return null;
  }, [messages]);

  const queryContext: AssistantQueryContext = useMemo(
    () => ({
      clientId,
      companyId,
      companyName,
      liquidacionInput: lastSettlement?.input,
      liquidacionResult: lastSettlement?.result,
    }),
    [clientId, companyId, companyName, lastSettlement],
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

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

      activeRequestRef.current = true;
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

      const persistToSession = (assistantMsg: AssistantMessage) => {
        let activeId = currentSessionId;
        if (!activeId) {
          const newSess = createChatSession(text);
          activeId = newSess.id;
          setCurrentSessionId(activeId);
        }
        const existingSess = sessions.find((s) => s.id === activeId);
        saveChatSession({
          id: activeId,
          title: existingSess?.title || generateChatTitle(text),
          createdAt: existingSess?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [...messages, userMessage, assistantMsg],
        });
        setSessions(listChatSessions());
      };

      try {
        let systemOneJudgment: any = null;
        try {
          systemOneJudgment = await evaluateTobiPeritaje(text);
        } catch {
          // fallback silencioso
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
        } catch {
          assistantMessage = null;
        }

        if (assistantMessage && assistantMessage.content) {
          const rawContent = assistantMessage.content || streamedText;
          const { cleanedText: textAfterLiq, payload: liqPayload } = extractSettlementAction(rawContent);
          const { cleanedText: textAfterDoc, payload: docPayload } = extractDocumentAction(textAfterLiq);
          const { cleanedText, options: continuationOptions } = extractContinuationOptions(textAfterDoc);

          let settlementData: { input: any; result: any } | null = null;
          if (liqPayload) {
            try {
              settlementData = executeSettlementAction(liqPayload);
            } catch (err) {
              console.warn('Error calculando liquidación:', err);
            }
          } else if (lastSettlement?.input) {
            // Fallback agéntico determinístico: si el usuario solicitó un ajuste sobre una liquidación activa
            try {
              const basePayload = toSettlementActionPayload(lastSettlement.input);
              const adjusted = applyAgenticSettlementAdjustment(basePayload, text);
              if (adjusted) {
                settlementData = executeSettlementAction(adjusted);
              }
            } catch (err) {
              console.warn('Error en ajuste agéntico determinístico:', err);
            }
          }

          const finalMessage: AssistantMessage = {
            id: draftId,
            role: 'assistant',
            content: cleanedText || rawContent,
            createdAt: new Date().toISOString(),
            settlementData,
            documentData: docPayload,
            continuationOptions,
            systemOneJudgment,
          };

          recordLiveConversation(text, finalMessage.content, { settlementData, documentData: docPayload });

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
                [...messages, userMessage, finalMessage],
                text,
              );
              setActiveDocFormTipo(docPayload.tipo);
              setActiveDocInitialData({ ...initialData, ...docPayload });
              setIsSettlementFormActive(false);
            }
          }

          setMessages((prev) => {
            const hasDraft = prev.some((m) => m.id === draftId);
            if (hasDraft) {
              return prev.map((m) => (m.id === draftId ? finalMessage : m));
            }
            return [...prev, finalMessage];
          });
          persistToSession(finalMessage);
          return finalMessage.content;
        } else if (streamStarted && streamedText) {
          const { cleanedText: textAfterLiq, payload: liqPayload } = extractSettlementAction(streamedText);
          const { cleanedText: textAfterDoc, payload: docPayload } = extractDocumentAction(textAfterLiq);
          const { cleanedText, options: continuationOptions } = extractContinuationOptions(textAfterDoc);

          let settlementData: { input: any; result: any } | null = null;
          if (liqPayload) {
            try {
              settlementData = executeSettlementAction(liqPayload);
            } catch (err) {
              console.warn('Error calculando liquidación:', err);
            }
          } else if (lastSettlement?.input) {
            try {
              const basePayload = toSettlementActionPayload(lastSettlement.input);
              const adjusted = applyAgenticSettlementAdjustment(basePayload, text);
              if (adjusted) {
                settlementData = executeSettlementAction(adjusted);
              }
            } catch (err) {
              console.warn('Error en ajuste agéntico determinístico:', err);
            }
          }

          const finalMessage: AssistantMessage = {
            id: draftId,
            role: 'assistant',
            content: cleanedText || streamedText,
            createdAt: new Date().toISOString(),
            settlementData,
            documentData: docPayload,
            continuationOptions,
            systemOneJudgment,
          };
          recordLiveConversation(text, finalMessage.content, { settlementData, documentData: docPayload });
          setMessages((prev) => {
            const hasDraft = prev.some((m) => m.id === draftId);
            if (hasDraft) {
              return prev.map((m) => (m.id === draftId ? finalMessage : m));
            }
            return [...prev, finalMessage];
          });
          persistToSession(finalMessage);
          return finalMessage.content;
        } else {
          // Fallback determinístico offline garantizado
          const fallback = generateOfflineAnswer(text, queryContext);
          const { cleanedText: offClean, options: offOptions } = extractContinuationOptions(fallback.content);
          const enrichedFallback: AssistantMessage = {
            ...fallback,
            content: offClean,
            continuationOptions: offOptions,
            systemOneJudgment,
          };
          setMessages((prev) => {
            const hasDraft = prev.some((m) => m.id === draftId);
            if (hasDraft) {
              return prev.map((m) => (m.id === draftId ? enrichedFallback : m));
            }
            return [...prev, enrichedFallback];
          });
          persistToSession(enrichedFallback);
          return enrichedFallback.content;
        }
      } catch {
        const fallback = generateOfflineAnswer(text, queryContext);
        setMessages((prev) => {
          const hasDraft = prev.some((m) => m.id === draftId);
          if (hasDraft) {
            return prev.map((m) => (m.id === draftId ? fallback : m));
          }
          return [...prev, fallback];
        });
        return fallback.content;
      } finally {
        activeRequestRef.current = false;
        setIsLoading(false);
      }
    },
    [input, isLoading, pdfProcessing, attachments, messages, queryContext, currentSessionId, sessions],
  );

  const handleClear = () => {
    setMessages([]);
    setInput('');
    setAttachments([]);
    setIsSharedSession(false);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#share=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const getShareUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const hash = encodeShareChat(messages);
    return `${window.location.origin}${window.location.pathname}#share=${hash}`;
  };

  const handleCopyShareLink = () => {
    try {
      void navigator.clipboard.writeText(getShareUrl());
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      alert('Enlace: ' + getShareUrl());
    }
  };

  const handleShareWhatsApp = () => {
    const url = getShareUrl();
    const text = encodeURIComponent(`Revisá esta asesoría y cálculos laborales en LaboraPy:\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCopyFullTranscript = () => {
    const text = messages
      .map((m) => {
        const remitente = m.role === 'user' ? 'Usuario' : 'Tobi (LaboraPy)';
        return `[${remitente}]:\n${m.content}\n`;
      })
      .join('\n---\n\n');
    try {
      void navigator.clipboard.writeText(text);
      alert('¡Transcripción completa copiada al portapapeles!');
    } catch {
      // fallback
    }
  };

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
    },
    [],
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
    },
    [],
  );

  const hasMessages = messages.length > 0;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100vw',
        maxWidth: '100vw',
        background: '#070c18',
        color: '#f8fafc',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        WebkitOverflowScrolling: 'touch',
        zIndex: 50,
      }}
    >
      {/* OVERLAY DRAG & DROP ESTILO CLAUDE / CHATGPT */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 12,
            zIndex: 9999,
            background: 'rgba(7, 12, 24, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '2px dashed #10b981',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            color: '#f8fafc',
            pointerEvents: 'none',
            boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)',
            animation: 'tobiPulse 2s infinite',
          }}
        >
          <span style={{ fontSize: 50 }}>📥</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#a7f3d0', letterSpacing: '-0.01em' }}>
            Soltá acá tus documentos o fotos
          </span>
          <span style={{ fontSize: 13.5, color: '#94a3b8', textAlign: 'center', maxWidth: 460, paddingInline: 16, lineHeight: 1.5 }}>
            Soporta PDFs membretados, liquidaciones, cartas de despido o renuncia, contratos, recibos de sueldo, imágenes y notas (hasta 12 MB).
          </span>
        </div>
      )}

      {/* Banner si es sesión compartida */}
      {isSharedSession && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1e1b4b 0%, #064e3b 100%)',
            borderBottom: '1px solid rgba(52, 211, 153, 0.3)',
            padding: isMobile ? '6px 12px' : '8px 16px',
            fontSize: isMobile ? 11.5 : 12.5,
            color: '#a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 30,
            gap: 8,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            👀 Conversación compartida
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: '#10b981',
              color: '#022c22',
              border: 'none',
              borderRadius: 6,
              padding: '3px 9px',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Nueva
          </button>
        </div>
      )}

      {/* ── TOP BAR MINIMALISTA (Estilo Claude / ChatGPT / Gemini) ── */}
      <header
        style={{
          height: isMobile ? 52 : 60,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(7, 12, 24, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 20px',
          flexShrink: 0,
          zIndex: 20,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title="Mis Consultas (panel lateral)"
            aria-label="Abrir historial de consultas"
            style={{
              background: isSidebarOpen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              border: isSidebarOpen ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isSidebarOpen ? '#a7f3d0' : '#ffffff',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }} onClick={handleNewChat}>
            <div
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                fontSize: isMobile ? 13 : 15,
              }}
            >
              ✨
            </div>
            <span style={{ fontWeight: 800, fontSize: isMobile ? 15 : 16, letterSpacing: -0.2, color: '#ffffff' }}>
              TOBI
            </span>
            {!isMobile && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#6ee7b7',
                }}
              >
                CSJ Jurisprudencia
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'nowrap', flexShrink: 0 }}>
          {/* Selector de consultas de ejemplo */}
          <button
            type="button"
            onClick={handleNewChat}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              height: 32,
              padding: isMobile ? '0 9px' : '0 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Nueva consulta (limpiar conversación)"
          >
            <span>+</span>
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Nueva consulta</span>
          </button>

          {hasMessages && (
            <>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: '#c7d2fe',
                  height: 32,
                  padding: isMobile ? '0 9px' : '0 12px',
                  borderRadius: 8,
                  fontSize: isMobile ? 12 : 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
                title="Compartir conversación completa como ChatGPT"
              >
                <span>🔗</span>
                {!isMobile && <span>Compartir</span>}
              </button>

              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  height: 32,
                  padding: isMobile ? '0 9px' : '0 12px',
                  borderRadius: 8,
                  fontSize: isMobile ? 12 : 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
                title="Nueva consulta"
              >
                <span>+</span>
                {!isMobile && <span>Nueva consulta</span>}
              </button>
            </>
          )}

          {onOpenClientPortal && (
            <button
              type="button"
              onClick={onOpenClientPortal}
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#cbd5e1',
                height: 32,
                padding: isMobile ? '0 9px' : '0 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
              title="Acceso Clientes ERP"
            >
              <span>🏢</span>
              {!isMobile && <span>Acceso ERP</span>}
            </button>
          )}
        </div>
      </header>

      {/* ── CUERPO CON SIDEBAR (ESTILO CHATGPT / GEMINI) ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <TobiSidebar
          isOpen={isSidebarOpen}
          sessions={sessions}
          activeSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onClose={() => setIsSidebarOpen(false)}
          isMobile={isMobile}
        />

        {/* ── COLUMNA PRINCIPAL DEL CHAT (MENSAJES + FOOTER) ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ── CUERPO PRINCIPAL DE SCROLL DE MENSAJES ── */}
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
        {/* Glows de fondo */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 300,
            background: 'rgba(16, 185, 129, 0.08)',
            filter: 'blur(120px)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />

        {!hasMessages ? (
          /* ── VISTA INICIAL VACÍA (CLAUDE / CHATGPT STYLE HERO) ── */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: isMobile ? 'flex-start' : 'center',
              padding: isMobile ? '20px 12px 24px' : '40px 16px',
              maxWidth: 820,
              margin: '0 auto',
              width: '100%',
              textAlign: 'center',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                borderRadius: 9999,
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontSize: isMobile ? 10.5 : 11.5,
                fontWeight: 700,
                letterSpacing: 0.8,
                marginBottom: isMobile ? 12 : 16,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                }}
              />
              <span>TOBI · ASISTENTE PERICIAL & LEGAL RRHH</span>
            </div>

            <h1
              style={{
                fontSize: isMobile ? 24 : 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                letterSpacing: -0.6,
                color: '#ffffff',
                margin: '0 0 4px 0',
                lineHeight: 1.15,
              }}
            >
              {saludoCompleto}
            </h1>
            <h2
              style={{
                fontSize: isMobile ? 16 : 'clamp(18px, 2.5vw, 24px)',
                fontWeight: 700,
                margin: '0 0 10px 0',
                background: 'linear-gradient(135deg, #34d399 0%, #2dd4bf 50%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.3,
              }}
            >
              {subtituloManos} ¿Qué resolvemos hoy?
            </h2>
            <p
              style={{
                fontSize: isMobile ? 12.5 : 14.5,
                color: '#94a3b8',
                maxWidth: 620,
                margin: isMobile ? '0 auto 16px' : '0 auto 28px',
                lineHeight: 1.5,
              }}
            >
              Especialista en derecho laboral paraguayo (Ley Nº 213/93). Redactá amonestaciones, suspensiones o traslados,
              calculá liquidaciones oficiales o auditá contingencias con fallos de la CSJ en segundos.
            </p>

            {/* Input Box Central */}
            <div
              style={{
                width: '100%',
                maxWidth: 680,
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 18,
                padding: isMobile ? '10px 12px' : '12px 16px',
                marginBottom: isMobile ? 16 : 24,
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={isMobile ? "Escribí tu consulta laboral… (ej: amonestar a un chofer)" : "Escribí tu consulta o caso laboral... (ej: 'Necesito amonestar por escrito a un chofer que no vino el lunes')"}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: isMobile ? 16 : 15,
                  lineHeight: 1.5,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {!isMobile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748b' }}>
                    <span>Presioná</span>
                    <kbd
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontSize: 10.5,
                        color: '#94a3b8',
                      }}
                    >
                      Enter ↵
                    </kbd>
                    <span>para consultar</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: '#64748b' }}>IA Paraguay</span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      ⏹️
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.docx,.doc,audio/*,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar documento o foto"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: attachments.length ? '#10b981' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: 18,
                    }}
                  >
                    📎
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() && !attachments.length}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#022c22',
                      fontWeight: 700,
                      fontSize: 12.5,
                      border: 'none',
                      borderRadius: 10,
                      padding: isMobile ? '6px 14px' : '7px 16px',
                      cursor: !input.trim() && !attachments.length ? 'not-allowed' : 'pointer',
                      opacity: !input.trim() && !attachments.length ? 0.45 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span>Consultar</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Pills */}
            <div style={{ width: '100%', maxWidth: 740 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.9,
                  color: '#64748b',
                  marginBottom: 8,
                }}
              >
                Acciones rápidas frecuentes
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: isMobile ? 6 : 10,
                  width: '100%',
                }}
              >
                {ACTION_PILLS.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => void handleSend(pill.prompt)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: isMobile ? '8px 10px' : '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
                      e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.35)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: isMobile ? 14 : 16 }}>{pill.icon}</span>
                      <span style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.25 }}>
                        {pill.title}
                      </span>
                    </div>
                    {!isMobile && (
                      <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginLeft: 24 }}>
                        {pill.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── VISTA DE CONVERSACIÓN (STREAM CENTRAL CON AVATARES) ── */
          <div
            style={{
              maxWidth: 840,
              width: '100%',
              margin: '0 auto',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxSizing: 'border-box',
            }}
          >
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isUser
                        ? '#334155'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: 14,
                      boxShadow: isUser ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {isUser ? '👤' : '✨'}
                  </div>

                  <div
                    style={{
                      maxWidth: isUser ? '80%' : '100%',
                      background: isUser ? '#1e293b' : 'transparent',
                      border: isUser ? '1px solid #334155' : 'none',
                      borderRadius: isUser ? 16 : 0,
                      padding: isUser ? '10px 16px' : '2px 0',
                      color: '#f8fafc',
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      flex: isUser ? 'none' : 1,
                      minWidth: 0,
                    }}
                  >
                    {isUser ? (
                      <div>
                        {m.attachment && m.attachment.mimeType.startsWith('audio/') ? (
                          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6ee7b7', fontWeight: 600 }}>
                              <span>🎙️</span>
                              <span>Nota de voz enviada a Tobi</span>
                            </div>
                            <audio
                              controls
                              src={m.attachment.previewUrl || m.attachment.data}
                              style={{ height: 32, maxWidth: '100%', borderRadius: 8 }}
                            />
                          </div>
                        ) : m.attachment ? (
                          <div style={{ marginBottom: 6, fontSize: 12.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📎</span>
                            <span>{m.attachment.name}</span>
                          </div>
                        ) : null}
                        <div>{m.content}</div>
                      </div>
                    ) : (
                      <>
                        {m.systemOneJudgment && (
                          <TobiPeritajeCard judgment={m.systemOneJudgment} isMobile={isMobile} />
                        )}
                        {cleanAndRenderContent(m.content || '')}
                        {(() => {
                          const contentStr = typeof m.content === 'string' ? m.content : '';
                          const sData =
                            m.settlementData ||
                            (m.role === 'assistant' && contentStr.includes(':::liquidacion_action')
                              ? (() => {
                                  const { payload } = extractSettlementAction(contentStr);
                                  return payload ? executeSettlementAction(payload) : null;
                                })()
                              : null);

                          if (!sData) return null;
                          return (
                            <div style={{ marginTop: 12 }}>
                              <TobiSettlementCard settlementData={sData} />
                            </div>
                          );
                        })()}
                        {(() => {
                          const contentStr = typeof m.content === 'string' ? m.content : '';
                          const docData =
                            m.documentData ||
                            (m.role === 'assistant' && contentStr.includes(':::documento_action')
                              ? extractDocumentAction(contentStr).payload
                              : null);

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

                        {/* Botón de voz en mensaje — Accesible y claro para trabajadores */}
                        {m.role === 'assistant' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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
                                  : 'Escuchar esta respuesta en voz alta'
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
                                borderRadius: 8,
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                color:
                                  isSpeaking && currentlySpeakingText === m.content ? '#fca5a5' : '#a7f3d0',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                WebkitTapHighlightColor: 'transparent',
                              }}
                            >
                              <span>{isSpeaking && currentlySpeakingText === m.content ? '⏹️' : '🔊'}</span>
                              <span>
                                {isSpeaking && currentlySpeakingText === m.content
                                  ? 'Detener voz'
                                  : 'Escuchar respuesta'}
                              </span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Casillas interactivas para completar notas laborales */}
            {activeDocFormTipo && (
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
            )}

            {/* Casillas interactivas para calcular liquidación */}
            {isSettlementFormActive && (
              <TobiSettlementFormCard
                onSubmit={handleSettlementFormSubmit}
                onCancel={() => setIsSettlementFormActive(false)}
                isMobile={isMobile}
              />
            )}

            {isLoading && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#34d399', fontSize: 13 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✨
                </div>
                <span>Tobi está analizando y fundamentando con el Código del Trabajo y CSJ…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── BARRA INFERIOR FIJA (VISIBLE CUANDO HAY CONVERSACIÓN) ── */}
      {hasMessages && (
        <footer
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(7, 12, 24, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '12px 16px 14px',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
            {/* Banner de Tobi hablando */}
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
                  <span>🔊</span>
                  <span>Tobi te está respondiendo en voz alta…</span>
                </div>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  style={{
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    borderRadius: 4,
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

            {attachments.length > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                <span>📎 {attachments[0].name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments([])}
                  style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 16,
                padding: '8px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                transition: 'border 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.docx,.doc,audio/*,.txt"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar documento o foto"
                style={{
                  background: 'none',
                  border: 'none',
                  color: attachments.length ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '0 4px',
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
                    width: 32,
                    height: 32,
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: 16,
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
                rows={1}
                placeholder="Escribí tu consulta o indicación adicional a Tobi…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: 14.5,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  maxHeight: 120,
                }}
              />

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isLoading || (!input.trim() && !attachments.length)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#022c22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoading || (!input.trim() && !attachments.length) ? 'not-allowed' : 'pointer',
                  opacity: isLoading || (!input.trim() && !attachments.length) ? 0.4 : 1,
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ➤
              </button>
            </div>

            {/* Aviso legal y disclaimer de IA */}
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
              ⚠️ <strong>Aviso legal:</strong> Tobi es una inteligencia artificial orientativa y puede cometer errores o fallar. Sus respuestas no constituyen dictamen legal vinculante ni reemplazan el patrocinio letrado. LaboraPy no se hace responsable por las decisiones u omisiones adoptadas a partir del contenido generado.
            </div>
          </div>
        </footer>
      )}
      </div>

      </div>

      {/* ── MODAL DE COMPARTIR CHAT (ESTILO CHATGPT) ── */}
      {isShareModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16,
          }}
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              color: '#f8fafc',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🔗</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#ffffff' }}>
                  Compartir enlace a la conversación
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Cualquier persona que tenga este enlace podrá ver esta consulta con Tobi, incluyendo las
              fundamentaciones legales, cálculos y documentos generados.
            </p>

            {/* Input con URL */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#070c18',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 10,
                padding: '6px 10px',
                marginBottom: 16,
              }}
            >
              <input
                readOnly
                value={getShareUrl()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                style={{
                  background: shareCopied ? '#059669' : '#10b981',
                  color: '#022c22',
                  fontWeight: 700,
                  fontSize: 12,
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                {shareCopied ? '✓ ¡Copiado!' : 'Copiar enlace'}
              </button>
            </div>

            {/* Acciones Secundarias */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                style={{
                  flex: '1 1 180px',
                  background: 'rgba(37, 211, 102, 0.15)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  color: '#4ade80',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>💬</span>
                <span>Compartir en WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFullTranscript}
                style={{
                  flex: '1 1 180px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>📄</span>
                <span>Copiar texto del chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TobiChatLanding;
