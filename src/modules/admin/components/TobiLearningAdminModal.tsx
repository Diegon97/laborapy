/**
 * MODAL DEL CENTRO DE APRENDIZAJE PERICIAL DE TOBI — LABORAPY
 * Panel de curación donde Diego Núñez autoriza, descarta y comenta los casos
 * que Tobi incorporará a su memoria pericial (Ley 213/93 y concordantes).
 * Versión: PY-TOBI-LEARNING-MODAL-2026.09.21
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  getTobiLearningCandidates,
  getTobiLearningMetrics,
  runTobiAutoCurator,
  updateTobiLearningCandidate,
  type TobiCandidateStatus,
  type TobiCandidateUpdate,
  type TobiLearningCandidate,
  type TobiLearningFilter,
  type TobiLearningMetrics,
} from '../services/tobiLearningService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_METRICS: TobiLearningMetrics = { total: 0, pending: 0, authorized: 0, discarded: 0 };

const STATUS_META: Record<TobiCandidateStatus, { label: string; color: string; background: string; border: string }> = {
  PENDIENTE: {
    label: 'Pendiente de auditoría',
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.12)',
    border: '#f59e0b',
  },
  AUTORIZADO: {
    label: 'Autorizado en memoria',
    color: '#34d399',
    background: 'rgba(52, 211, 153, 0.12)',
    border: '#10b981',
  },
  DESCARTADO: {
    label: 'Descartado',
    color: '#f87171',
    background: 'rgba(248, 113, 113, 0.12)',
    border: '#ef4444',
  },
};

function toTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatRelativeDate(fecha: string): string {
  const time = toTimestamp(fecha);
  if (time === 0) return 'Fecha desconocida';
  const diffMinutes = Math.round((Date.now() - time) / 60000);
  if (diffMinutes <= 0) return 'Recién ingresado';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays} día(s)`;
  return `Hace ${Math.round(diffDays / 30)} mes(es)`;
}

function formatExactDate(fecha: string): string {
  const time = toTimestamp(fecha);
  if (time === 0) return fecha || 'Sin registro';
  return new Date(time).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' });
}

export const TobiLearningAdminModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [candidates, setCandidates] = useState<TobiLearningCandidate[]>([]);
  const [metrics, setMetrics] = useState<TobiLearningMetrics>(EMPTY_METRICS);
  const [activeFilter, setActiveFilter] = useState<TobiLearningFilter>('pending');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async (filter: TobiLearningFilter) => {
    setIsLoading(true);
    try {
      const [list, nextMetrics] = await Promise.all([
        getTobiLearningCandidates(filter),
        getTobiLearningMetrics(),
      ]);
      setCandidates(list);
      setMetrics(nextMetrics);
      setDrafts(prev => {
        const next: Record<string, string> = {};
        for (const candidate of list) {
          next[candidate.id] = prev[candidate.id] ?? candidate.correccion_diego;
        }
        return next;
      });
    } catch (error) {
      console.error('[TobiLearning] Error al cargar los casos periciales:', error);
      setFeedback({
        type: 'error',
        text: 'No se pudieron cargar los casos periciales. Verifique la conexión e intente nuevamente.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    setActiveFilter('pending');
    void loadData('pending');
  }, [isOpen, loadData]);

  // Auto-dismiss de los mensajes de éxito o error
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Cierre con la tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filterTabs: Array<{ id: TobiLearningFilter; label: string; count: number }> = [
    { id: 'pending', label: 'Pendientes', count: metrics.pending },
    { id: 'authorized', label: 'Autorizados', count: metrics.authorized },
    { id: 'discarded', label: 'Descartados', count: metrics.discarded },
    { id: 'all', label: 'Todos', count: metrics.total },
  ];

  const headerBadge =
    metrics.pending > 0
      ? {
          text: `${metrics.pending} caso(s) por auditar`,
          color: '#fbbf24',
          background: 'rgba(251, 191, 36, 0.15)',
          border: '#f59e0b',
        }
      : {
          text: 'Memoria pericial al día',
          color: '#34d399',
          background: 'rgba(52, 211, 153, 0.15)',
          border: '#10b981',
        };

  const handleFilterChange = (filter: TobiLearningFilter) => {
    setActiveFilter(filter);
    void loadData(filter);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await runTobiAutoCurator(24);
      setFeedback({ type: result.success ? 'success' : 'error', text: result.message });
      await loadData(activeFilter);
    } catch (error) {
      console.error('[TobiLearning] Error al ejecutar el curador automático:', error);
      setFeedback({ type: 'error', text: 'No se pudo ejecutar el curador automático de Tobi.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdate = async (id: string, update: TobiCandidateUpdate, successText: string) => {
    setBusyId(id);
    try {
      const result = await updateTobiLearningCandidate(id, update);
      if (!result.success) {
        setFeedback({ type: 'error', text: result.error || 'No se pudo actualizar el caso pericial.' });
        return;
      }
      setFeedback({ type: 'success', text: successText });
      await loadData(activeFilter);
    } catch (error) {
      console.error('[TobiLearning] Error al actualizar el caso pericial:', error);
      setFeedback({ type: 'error', text: 'Error inesperado al actualizar el caso pericial.' });
    } finally {
      setBusyId(null);
    }
  };

  const renderSpinner = (color: string = '#38bdf8') => (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '13px',
        height: '13px',
        border: '2px solid rgba(148, 163, 184, 0.35)',
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'tobiLearningSpin 0.8s linear infinite',
      }}
    />
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'tobiLearningFadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes tobiLearningSpin { to { transform: rotate(360deg); } }
        @keyframes tobiLearningFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        className="admin-hub-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tobi-learning-title"
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '16px',
          padding: '26px',
          width: '100%',
          maxWidth: '760px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px #334155',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el Centro de Aprendizaje Pericial"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            borderRadius: '6px',
          }}
        >
          ✕
        </button>

        {/* Encabezado: título, subtítulo, badge de estado y sincronización */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              border: '1px solid #8b5cf6',
              flexShrink: 0,
            }}
          >
            🧠
          </div>

          <div style={{ flex: '1 1 260px', minWidth: 0, paddingRight: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 id="tobi-learning-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                Centro de Aprendizaje Pericial de Tobi
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: headerBadge.background,
                  color: headerBadge.color,
                  border: `1px solid ${headerBadge.border}`,
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  fontWeight: 600,
                }}
              >
                {headerBadge.text}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Casos reales respondidos por Tobi. Autorizá los que deban entrar a su memoria pericial, descartá los
              erróneos y dejá tu criterio jurídico como corrección oficial (Ley 213/93).
            </p>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isSyncing ? '#1e293b' : '#4f46e5',
              color: '#f8fafc',
              border: '1px solid #6366f1',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {isSyncing ? renderSpinner('#c7d2fe') : <span aria-hidden="true">🔄</span>}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Nuevas Consultas'}
          </button>
        </div>

        {/* Mensajes de éxito o error con auto-dismiss */}
        <div role="status" aria-live="polite">
          {feedback && (
            <div
              style={{
                backgroundColor: feedback.type === 'success' ? 'rgba(52, 211, 153, 0.14)' : 'rgba(248, 113, 113, 0.14)',
                border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
                color: feedback.type === 'success' ? '#34d399' : '#f87171',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12.5px',
                marginBottom: '14px',
              }}
            >
              {feedback.type === 'success' ? '✅ ' : '⚠️ '}
              {feedback.text}
            </div>
          )}
        </div>

        {/* Métricas visuales */}
        <div
          className="admin-metrics-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          {[
            { label: 'Total Casos', value: metrics.total, color: '#38bdf8' },
            { label: 'Pendientes', value: metrics.pending, color: '#fbbf24' },
            { label: 'Autorizados en Memoria', value: metrics.authorized, color: '#34d399' },
            { label: 'Descartados', value: metrics.discarded, color: '#f87171' },
          ].map(metric => (
            <div
              key={metric.label}
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', lineHeight: 1.3 }}>
                {metric.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: metric.color, marginTop: '2px' }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros de pestañas */}
        <div role="tablist" aria-label="Filtros de casos periciales" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {filterTabs.map(tab => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleFilterChange(tab.id)}
                style={{
                  backgroundColor: isActive ? '#4f46e5' : '#1e293b',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  border: `1px solid ${isActive ? '#6366f1' : '#334155'}`,
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Listado de casos */}
        {isLoading && candidates.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '32px 12px',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            {renderSpinner()}
            Cargando casos periciales de Tobi...
          </div>
        )}

        {!isLoading && candidates.length === 0 && (
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px dashed #475569',
              borderRadius: '12px',
              padding: '28px 16px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            <div style={{ fontSize: '26px', marginBottom: '8px' }}>🗂️</div>
            No hay casos en este estado. Usá «🔄 Sincronizar Nuevas Consultas» para incorporar las últimas
            interacciones reales de Tobi.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {candidates.map(candidate => {
            const statusMeta = STATUS_META[candidate.autorizado];
            const isBusy = busyId === candidate.id;
            const draft = drafts[candidate.id] ?? candidate.correccion_diego;

            return (
              <article
                key={candidate.id}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderLeft: `4px solid ${statusMeta.border}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  animation: 'tobiLearningFadeIn 0.25s ease-out',
                }}
              >
                {/* Fecha, motor y estado */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#e2e8f0' }}>
                      {formatRelativeDate(candidate.fecha)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{formatExactDate(candidate.fecha)}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid #1e3a5f',
                        borderRadius: '6px',
                        padding: '1px 6px',
                      }}
                    >
                      {candidate.proveedor} · {candidate.modelo}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: statusMeta.color,
                      backgroundColor: statusMeta.background,
                      border: `1px solid ${statusMeta.border}`,
                      borderRadius: '9999px',
                      padding: '2px 8px',
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                {/* Artículos detectados */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' }}>
                  {candidate.articulos.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Sin artículos detectados</span>
                  ) : (
                    candidate.articulos.map(articulo => (
                      <span
                        key={articulo}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#c4b5fd',
                          backgroundColor: 'rgba(139, 92, 246, 0.14)',
                          border: '1px solid #7c3aed',
                          borderRadius: '6px',
                          padding: '1px 7px',
                        }}
                      >
                        {articulo}
                      </span>
                    ))
                  )}
                </div>

                {/* Consulta real del usuario */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Consulta real del usuario
                  </div>
                  <blockquote
                    style={{
                      margin: 0,
                      borderLeft: '3px solid #475569',
                      paddingLeft: '10px',
                      fontSize: '12.5px',
                      color: '#e2e8f0',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    «{candidate.consulta}»
                  </blockquote>
                </div>

                {/* Respuesta de Tobi */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Respuesta generada por Tobi
                  </div>
                  <div
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '12.5px',
                      color: '#cbd5e1',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {candidate.respuesta_tobi || 'Sin respuesta registrada.'}
                  </div>
                </div>

                {/* Criterio / Corrección de Diego Núñez */}
                <label
                  htmlFor={`criterio-${candidate.id}`}
                  style={{ display: 'block', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}
                >
                  Criterio / Corrección de Diego Núñez
                </label>
                <textarea
                  id={`criterio-${candidate.id}`}
                  value={draft}
                  onChange={event =>
                    setDrafts(prev => ({ ...prev, [candidate.id]: event.target.value }))
                  }
                  disabled={isBusy}
                  rows={3}
                  placeholder="Ej.: Corresponde Art. 84 más preaviso del Art. 87. Aclarar que el aguinaldo se calcula sobre los haberes devengados y que el reclamo prescribe a los 6 meses."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    padding: '9px 11px',
                    color: '#f8fafc',
                    fontSize: '12.5px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />

                {/* Botones de acción */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleUpdate(
                        candidate.id,
                        {
                          autorizado: 'AUTORIZADO',
                          correccion_diego: drafts[candidate.id] ?? candidate.correccion_diego,
                        },
                        'Caso autorizado: Tobi lo incorporará a su memoria pericial.'
                      )
                    }
                    style={{
                      backgroundColor: isBusy ? '#1e293b' : '#059669',
                      color: '#ecfdf5',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '7px 13px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✅ Autorizar Aprendizaje
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleUpdate(
                        candidate.id,
                        { autorizado: 'DESCARTADO' },
                        'Caso descartado: no se incorporará a la memoria de Tobi.'
                      )
                    }
                    style={{
                      backgroundColor: isBusy ? '#1e293b' : '#334155',
                      color: '#fca5a5',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      padding: '7px 13px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    🚫 Descartar
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleUpdate(
                        candidate.id,
                        { correccion_diego: drafts[candidate.id] ?? candidate.correccion_diego },
                        'Comentario pericial guardado correctamente.'
                      )
                    }
                    style={{
                      backgroundColor: isBusy ? '#1e293b' : '#3b82f6',
                      color: '#ffffff',
                      border: '1px solid #60a5fa',
                      borderRadius: '8px',
                      padding: '7px 13px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    💾 Guardar Comentario
                  </button>

                  {isBusy && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8' }}>
                      {renderSpinner()}
                      Guardando...
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Barra inferior */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            borderTop: '1px solid #1e293b',
            marginTop: '18px',
            paddingTop: '14px',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Los casos autorizados se consolidan automáticamente en la memoria pericial de Tobi (cron de Vercel).
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#cbd5e1',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
