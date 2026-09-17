/**
 * MODAL PRINCIPAL DEL AUXILIAR DE RRHH — LABORAPY
 * Versión: PY-MODAL-2026.09.10 (Estilos Nativos Puros sin dependencia de Tailwind)
 */

import React, { useState, useEffect, useRef } from 'react';
import type {
  AuditReport,
  SettlementDeadlines,
  RetentionLimits,
  MotivoEgreso,
  LiquidacionInput,
  LiquidacionResult,
} from '../types';
import { generateOfflineAnswer, askDeepSeekAssistant } from '../assistantService';
import { auditSettlement } from '../hrAuditor';
import { getSettlementDeadlines, calculateRetentionLimits, getMonthlyPayrollCalendar } from '../hrDeadlines';

interface HRAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInput?: Partial<LiquidacionInput>;
  initialResult?: Partial<LiquidacionResult>;
  clientId?: string;
  companyId?: string;
}

type TabType = 'chat' | 'auditor' | 'deadlines';

export const HRAssistantModal: React.FC<HRAssistantModalProps> = ({
  isOpen,
  onClose,
  initialInput,
  initialResult,
  clientId,
  companyId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  // ── Pestaña 1: Chat ──────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; citations?: Array<{ title: string; legalReference: string }> }>>([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu **Auxiliar Inteligente de RRHH** para Paraguay. Consultame sobre vacaciones, aguinaldo, plazos de IPS o probá el auditor en la pestaña "Segundo Ojo".',
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);

  // ── Pestaña 2: Segundo Ojo (Auditor) ────────────────────────────────────
  const [auditForm, setAuditForm] = useState<{
    salarioMensual: string;
    motivo: MotivoEgreso;
    antiguedadAnios: string;
    indemnizacion: string;
    preavisoDias: string;
    aguinaldo: string;
    ipsAguinaldo: string;
    descuentos: string;
    anticipoAguinaldo: string;
  }>({
    salarioMensual: initialInput?.salarioMensual ? String(initialInput.salarioMensual) : '3044000',
    motivo: initialInput?.motivo ?? 'despido_sin_causa',
    antiguedadAnios: '2',
    indemnizacion: initialResult?.conceptos?.find((c) => c.id === 'indemnizacion')?.monto ? String(initialResult.conceptos.find((c) => c.id === 'indemnizacion')?.monto) : '3044000',
    preavisoDias: '0',
    aguinaldo: '1500000',
    ipsAguinaldo: '0',
    descuentos: '250000',
    anticipoAguinaldo: '0',
  });

  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  // ── Pestaña 3: Vencimientos y Trámites ──────────────────────────────────
  const [fechaEgresoInput, setFechaEgresoInput] = useState(
    initialInput?.fechaEgreso ?? new Date().toISOString().slice(0, 10),
  );
  const [deadlines, setDeadlines] = useState<SettlementDeadlines>(() =>
    getSettlementDeadlines(new Date().toISOString().slice(0, 10)),
  );
  const [salarioRetencionInput, setSalarioRetencionInput] = useState('3044000');
  const [retentionLimits, setRetentionLimits] = useState<RetentionLimits>(() =>
    calculateRetentionLimits(3044000, 1522000),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && !auditReport) {
      handleRunAudit();
    }
  }, [isOpen, auditReport]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, activeTab]);

  const renderFormattedMessage = (text: string) => {
    const lines = text.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={lIdx} style={{ height: '4px' }} />;
          }

          // Helper to format inline bold: **text**
          const parseInlineBold = (str: string) => {
            const parts = str.split(/(\*\*[^*]+\*\*)/g);
            return parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return (
                  <strong key={pIdx} style={{ color: '#064e3b', fontWeight: 800 }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            });
          };

          // Check if bullet point
          const isBullet = /^[•\-\*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
          if (isBullet) {
            const bulletContent = trimmed.replace(/^[•\-\*]\s+/, '').replace(/^\d+\.\s+/, '');
            return (
              <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                <span style={{ color: '#059669', fontWeight: 900, fontSize: '13px', lineHeight: '1.4' }}>•</span>
                <span style={{ flex: 1, color: '#1e293b', fontSize: '13.5px', lineHeight: '1.5' }}>
                  {parseInlineBold(bulletContent)}
                </span>
              </div>
            );
          }

          // Check if header line
          const isHeader = /^#{1,3}\s+/.test(trimmed);
          if (isHeader) {
            const headerText = trimmed.replace(/^#{1,3}\s+/, '');
            return (
              <div key={lIdx} style={{ fontWeight: 800, color: '#064e3b', fontSize: '14px', marginTop: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                {parseInlineBold(headerText)}
              </div>
            );
          }

          return (
            <p key={lIdx} style={{ margin: 0, color: '#1e293b', fontSize: '13.5px', lineHeight: '1.55' }}>
              {parseInlineBold(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  const handleSendMessage = async (customQuery?: string) => {
    const query = customQuery ?? chatInput;
    if (!query.trim()) return;

    const userMsg = { role: 'user' as const, text: query };
    setMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setChatInput('');
    setIsThinking(true);

    try {
      const response = await askDeepSeekAssistant(query, {
        clientId,
        companyId,
        liquidacionInput: initialInput,
        liquidacionResult: initialResult,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.content,
          citations: response.citations ? [...response.citations] : undefined,
        },
      ]);
    } catch (_e) {
      const fallback = generateOfflineAnswer(query);
      setMessages((prev) => [...prev, { role: 'assistant', text: fallback.content }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRunAudit = () => {
    const inputMock: Partial<LiquidacionInput> = {
      salarioMensual: Number(auditForm.salarioMensual) || 0,
      motivo: auditForm.motivo,
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-01-01',
      tieneVariables: false,
      preaviso: {
        obligado: 'empleador',
        otorgado: Number(auditForm.preavisoDias) > 0,
        diasOtorgados: Number(auditForm.preavisoDias) || 0,
      },
      descuentosAdicionales: Number(auditForm.descuentos)
        ? [{ concepto: 'Descuentos', monto: Number(auditForm.descuentos) }]
        : [],
    };

    const resultMock = {
      totalBruto: Number(auditForm.salarioMensual) || 0,
      totalDescuentos: Number(auditForm.descuentos) || 0,
      aguinaldoProporcional: Number(auditForm.aguinaldo) || 0,
      antiguedad: { years: Number(auditForm.antiguedadAnios) || 0, months: 0, days: 0, totalDias: 730 },
      conceptos: [
        {
          id: 'indemnizacion',
          nombre: 'Indemnización por Antigüedad',
          monto: Number(auditForm.indemnizacion) || 0,
          fuenteLegal: 'Art. 91 C.T.',
          esDescuento: false,
        },
        ...(Number(auditForm.ipsAguinaldo) > 0
          ? [
              {
                id: 'ips_aguinaldo',
                nombre: 'Aporte Obrero IPS sobre Aguinaldo',
                monto: Number(auditForm.ipsAguinaldo),
                fuenteLegal: 'Retención ilegal',
                esDescuento: true,
              },
            ]
          : []),
      ],
    } as unknown as Partial<LiquidacionResult>;

    const report = auditSettlement(inputMock, resultMock);
    setAuditReport(report);
  };

  const handleCalculateDeadlines = (fecha: string) => {
    setFechaEgresoInput(fecha);
    setDeadlines(getSettlementDeadlines(fecha));
  };

  const handleCalculateRetentions = (salario: number) => {
    setRetentionLimits(calculateRetentionLimits(salario, Math.round(salario / 2)));
  };

  return (
    <div className="hr-modal-overlay" onClick={onClose}>
      <div className="hr-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* ── Encabezado Institucional ── */}
        <div className="hr-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontSize: '24px', flexShrink: 0 }}>🛡️</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>
                  Auxiliar RRHH
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(110, 231, 183, 0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  LaboraPy Copilot
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#a7f3d0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Segundo Ojo de Liquidaciones & Consultoría Laboral Paraguay (Ley 213/93)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              color: '#ffffff',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── Barra de Navegación por Pestañas ── */}
        <div className="hr-modal-nav-tabs">
          {[
            { id: 'chat' as TabType, icon: '💬', label: 'Consultas Laborales' },
            { id: 'auditor' as TabType, icon: '👁️', label: 'Segundo Ojo (Auditor)' },
            { id: 'deadlines' as TabType, icon: '📅', label: 'Vencimientos y Trámites' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`hr-modal-tab-btn ${isActive ? 'active' : ''}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'auditor' && auditReport && auditReport.summary.errors > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 900,
                      padding: '1px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {auditReport.summary.errors}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Cuerpo del Modal ── */}
        <div className={`hr-modal-body ${activeTab === 'chat' ? 'hr-modal-body--chat' : ''}`}>
          {/* ═════════ TAB 1: CHAT LABORAL ═════════ */}
          {activeTab === 'chat' && (
            <div className="hr-chat-wrapper">
              {/* Sugerencias Rápidas en fila horizontal deslizable */}
              <div className="hr-chat-suggestions">
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', alignSelf: 'center', whiteSpace: 'nowrap', paddingRight: '2px' }}>
                  💡 Sugerencias:
                </span>
                {[
                  '¿Cuántos días de vacaciones por 6 años?',
                  '¿El aguinaldo lleva descuento de IPS?',
                  '¿Cuál es el plazo para dar baja en IPS REI?',
                  '¿Cuánto corresponde de preaviso por despido?',
                ].map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sug)}
                    className="hr-chat-suggestion-chip"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* Historial de Mensajes con lectura rápida */}
              <div className="hr-chat-messages">
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      className={isUser ? 'hr-chat-bubble-user' : 'hr-chat-bubble-assistant'}
                    >
                      {isUser ? m.text : renderFormattedMessage(m.text)}
                      {m.citations && m.citations.length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #cbd5e1', fontSize: '11px' }}>
                          <p style={{ margin: '0 0 4px', fontWeight: 800, color: '#047857' }}>📖 Base Legal Oficial:</p>
                          {m.citations.map((c, cIdx) => (
                            <div key={cIdx} style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.title}</span>
                              <div style={{ color: '#64748b', fontSize: '10px' }}>{c.legalReference}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {isThinking && (
                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600, fontStyle: 'italic', padding: '6px 12px', background: '#ecfdf5', borderRadius: '8px', alignSelf: 'flex-start' }}>
                    ⚙️ Consultando legislación paraguaya con DeepSeek V4.1...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="hr-chat-input-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribí una duda laboral, artículo, plazo o cálculo..."
                  className="hr-chat-input"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isThinking || !chatInput.trim()}
                  className="hr-chat-send-btn"
                  style={{ opacity: isThinking || !chatInput.trim() ? 0.5 : 1 }}
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* ═════════ TAB 2: SEGUNDO OJO AUDITOR ═════════ */}
          {activeTab === 'auditor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Formulario */}
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                  ⚙️ Variables de la Liquidación a Auditar
                </h3>
                <div className="hr-auditor-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Salario Mensual (Gs.)
                    </label>
                    <input
                      type="number"
                      value={auditForm.salarioMensual}
                      onChange={(e) => setAuditForm({ ...auditForm, salarioMensual: e.target.value })}
                      className="hr-auditor-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Causa de Egreso
                    </label>
                    <select
                      value={auditForm.motivo}
                      onChange={(e) => setAuditForm({ ...auditForm, motivo: e.target.value as MotivoEgreso })}
                      className="hr-auditor-input"
                      style={{ background: '#ffffff' }}
                    >
                      <option value="despido_sin_causa">Despido Injustificado</option>
                      <option value="renuncia">Renuncia Voluntaria</option>
                      <option value="despido_con_causa">Despido Justificado (Art. 81)</option>
                      <option value="retiro_justificado">Retiro Justificado (Art. 84)</option>
                      <option value="abandono">Abandono de Trabajo</option>
                      <option value="periodo_prueba">Período de Prueba</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Años de Antigüedad
                    </label>
                    <input
                      type="number"
                      value={auditForm.antiguedadAnios}
                      onChange={(e) => setAuditForm({ ...auditForm, antiguedadAnios: e.target.value })}
                      className="hr-auditor-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Indemnización Liquidada (Gs.)
                    </label>
                    <input
                      type="number"
                      value={auditForm.indemnizacion}
                      onChange={(e) => setAuditForm({ ...auditForm, indemnizacion: e.target.value })}
                      className="hr-auditor-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Días de Preaviso Otorgados
                    </label>
                    <input
                      type="number"
                      value={auditForm.preavisoDias}
                      onChange={(e) => setAuditForm({ ...auditForm, preavisoDias: e.target.value })}
                      className="hr-auditor-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      IPS descontado s/ Aguinaldo
                    </label>
                    <input
                      type="number"
                      value={auditForm.ipsAguinaldo}
                      onChange={(e) => setAuditForm({ ...auditForm, ipsAguinaldo: e.target.value })}
                      placeholder="Debe ser 0 (Exento)"
                      className="hr-auditor-input"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleRunAudit}
                    style={{
                      padding: '8px 16px',
                      background: '#059669',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                    }}
                  >
                    ⚡ Re-Auditar con Segundo Ojo
                  </button>
                </div>
              </div>

              {/* Resultado */}
              {auditReport && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor:
                        auditReport.healthStatus === 'optimo'
                          ? '#a7f3d0'
                          : auditReport.healthStatus === 'observaciones'
                          ? '#fde68a'
                          : '#fca5a5',
                      background:
                        auditReport.healthStatus === 'optimo'
                          ? '#ecfdf5'
                          : auditReport.healthStatus === 'observaciones'
                          ? '#fffbeb'
                          : '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        background:
                          auditReport.healthStatus === 'optimo'
                            ? '#059669'
                            : auditReport.healthStatus === 'observaciones'
                            ? '#d97706'
                            : '#dc2626',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 900,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                      }}
                    >
                      {auditReport.score}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                        Salud de la Liquidación: <span style={{ textTransform: 'uppercase' }}>{auditReport.healthStatus}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                        {auditReport.summary.errors} errores críticos · {auditReport.summary.warnings} observaciones · {auditReport.summary.infos} informativas.
                      </div>
                    </div>
                  </div>

                  {/* Lista de Hallazgos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {auditReport.findings.length === 0 ? (
                      <div style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
                        ✅ Liquidación 100% conforme a las normativas del Código del Trabajo e IPS.
                      </div>
                    ) : (
                      auditReport.findings.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: f.severity === 'error' ? '#fca5a5' : f.severity === 'warning' ? '#fde68a' : '#cbd5e1',
                            background: f.severity === 'error' ? '#fff1f2' : f.severity === 'warning' ? '#fffbeb' : '#ffffff',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, color: f.severity === 'error' ? '#991b1b' : f.severity === 'warning' ? '#92400e' : '#1e293b' }}>
                              {f.severity === 'error' ? '🔴 Error Crítico: ' : f.severity === 'warning' ? '🟡 Alerta: ' : 'ℹ️ '}{f.title}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                              {f.code}
                            </span>
                          </div>
                          <div style={{ color: '#334155', lineHeight: '1.4' }}>{f.detail}</div>
                          {f.legalReference && (
                            <div style={{ marginTop: '4px', fontWeight: 700, color: '#0f766e', fontSize: '11px' }}>
                              ⚖️ Base Legal: {f.legalReference}
                            </div>
                          )}
                          {f.recommendation && (
                            <div style={{ marginTop: '6px', padding: '6px 10px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#064e3b', fontWeight: 600 }}>
                              👉 {f.recommendation}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════ TAB 3: VENCIMIENTOS Y TRÁMITES ═════════ */}
          {activeTab === 'deadlines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Plazos Legales */}
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Plazos Legales de Egreso (IPS & MTESS)</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>Cálculo de fechas límites perentorias para evitar multas.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Fecha de Salida:</label>
                    <input
                      type="date"
                      value={fechaEgresoInput}
                      onChange={(e) => handleCalculateDeadlines(e.target.value)}
                      className="hr-auditor-input"
                    />
                  </div>
                </div>

                <div className="hr-deadlines-grid">
                  {/* Card IPS REI */}
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                      <span style={{ color: '#1d4ed8' }}>IPS REI</span>
                      <span style={{ color: '#1e40af' }}>3 Días Hábiles</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{deadlines.ipsRei.concepto}</div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>{deadlines.ipsRei.descripcion}</div>
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #bfdbfe', fontSize: '12px', fontWeight: 800, color: '#1d4ed8' }}>
                      Vence: {deadlines.ipsRei.dueDate} ({deadlines.ipsRei.daysRemaining} días)
                    </div>
                  </div>

                  {/* Card MTESS REOP */}
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                      <span style={{ color: '#7e22ce' }}>MTESS REOP</span>
                      <span style={{ color: '#6b21a8' }}>30 Días Corridos</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{deadlines.mtessReop.concepto}</div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>{deadlines.mtessReop.descripcion}</div>
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e9d5ff', fontSize: '12px', fontWeight: 800, color: '#7e22ce' }}>
                      Vence: {deadlines.mtessReop.dueDate}
                    </div>
                  </div>

                  {/* Card Certificado Art. 93 */}
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                      <span style={{ color: '#047857' }}>EMPRESA</span>
                      <span style={{ color: '#065f46' }}>Inmediato</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{deadlines.certificadoTrabajo.concepto}</div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>{deadlines.certificadoTrabajo.descripcion}</div>
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #a7f3d0', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
                      Entrega al cese del contrato
                    </div>
                  </div>
                </div>
              </div>

              {/* Topes de Retención */}
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Topes Legales de Retención Salarial</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>Art. 242 (25% ordinario) y Art. 245 (50% alimentos) del Código del Trabajo.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <label style={{ fontWeight: 700, color: '#334155' }}>Salario Bruto:</label>
                    <input
                      type="number"
                      value={salarioRetencionInput}
                      onChange={(e) => {
                        setSalarioRetencionInput(e.target.value);
                        handleCalculateRetentions(Number(e.target.value) || 0);
                      }}
                      className="hr-auditor-input"
                      style={{ width: '140px' }}
                    />
                  </div>
                </div>

                <div className="hr-deadlines-grid">
                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Tope Deducciones Ordinarias (25%)</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                      Gs. {retentionLimits.maxDeduccionesOrdinarias.toLocaleString('es-PY')}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Anticipos, compras o préstamos autorizados.</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Tope Alimentos Judiciales (50%)</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#4338ca', margin: '4px 0' }}>
                      Gs. {retentionLimits.maxPensionAlimenticia.toLocaleString('es-PY')}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Fijado por Juzgados de la Niñez y Adolescencia.</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Tope Anticipo de Aguinaldo</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#047857', margin: '4px 0' }}>
                      Gs. {retentionLimits.maxAnticipoAguinaldo.toLocaleString('es-PY')}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Tope máximo: monto devengado a la fecha.</div>
                  </div>
                </div>
              </div>

              {/* Calendario Patronal */}
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Calendario Patronal Mensual Recurrente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getMonthlyPayrollCalendar(2026, 12).map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', whiteSpace: 'nowrap' }}>
                        {ev.dayRange}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                          {ev.title} <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748b' }}>({ev.legalReference})</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{ev.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
