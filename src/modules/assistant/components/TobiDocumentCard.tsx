import React, { useState, useCallback } from 'react';
import type { TobiDocumentActionPayload } from '../types';
import { toNotaLaboralOptions } from '../tobiDocumentAction';
import { generarNotaLaboralPDF } from '../../payroll/generators/noticePdfGenerator';
import { exportarNotaLaboralDocx } from '../../payroll/generators/noticeDocxGenerator';

export interface TobiDocumentCardProps {
  documentData: TobiDocumentActionPayload;
  companyName?: string;
  onEdit?: (payload: TobiDocumentActionPayload) => void;
}

const getTipoLabel = (tipo: string): { titulo: string; icon: string; badgeColor: string } => {
  switch (tipo) {
    case 'amonestacion':
      return { titulo: 'Amonestación / Apercibimiento Escrito', icon: '📄', badgeColor: '#f59e0b' };
    case 'suspension_disciplinaria':
      return { titulo: 'Suspensión Disciplinaria Laboral', icon: '⚠️', badgeColor: '#ef4444' };
    case 'traslado':
      return { titulo: 'Notificación Formal de Traslado', icon: '🔄', badgeColor: '#3b82f6' };
    case 'despido_justificado':
      return { titulo: 'Notificación de Despido con Causa', icon: '🛑', badgeColor: '#dc2626' };
    case 'despido_injustificado':
      return { titulo: 'Notificación de Despido sin Causa', icon: '📋', badgeColor: '#6366f1' };
    case 'renuncia':
      return { titulo: 'Carta de Renuncia Voluntaria', icon: '📝', badgeColor: '#10b981' };
    case 'certificado_trabajo':
      return { titulo: 'Certificado Laboral Oficial', icon: '📜', badgeColor: '#06b6d4' };
    default:
      return { titulo: 'Documento Notarial Laboral', icon: '📄', badgeColor: '#10b981' };
  }
};

export const TobiDocumentCard: React.FC<TobiDocumentCardProps> = ({
  documentData,
  companyName,
  onEdit,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  const opts = toNotaLaboralOptions(documentData, companyName || 'Corporación Empleadora');
  const info = getTipoLabel(opts.tipo);

  const hasPlaceholders =
    !opts.nombreEmpleado ||
    opts.nombreEmpleado.includes('[Completar') ||
    !opts.ciEmpleado ||
    opts.ciEmpleado.includes('[Completar') ||
    opts.ciEmpleado === '—';

  const handleDownloadPdf = useCallback(() => {
    setDownloadingPdf(true);
    try {
      const doc = generarNotaLaboralPDF(opts);
      const cleanName = opts.nombreEmpleado.replace(/\s+/g, '_');
      doc.save(`Nota_${opts.tipo}_${cleanName}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF de nota laboral:', err);
    } finally {
      setDownloadingPdf(false);
    }
  }, [opts]);

  const handleDownloadDocx = useCallback(async () => {
    setDownloadingDocx(true);
    try {
      const cleanName = opts.nombreEmpleado.replace(/\s+/g, '_');
      await exportarNotaLaboralDocx(opts, `Nota_${opts.tipo}_${cleanName}.docx`);
    } catch (err) {
      console.error('Error al exportar DOCX de nota laboral:', err);
    } finally {
      setDownloadingDocx(false);
    }
  }, [opts]);

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 14,
        border: '1px solid rgba(59, 130, 246, 0.35)',
        padding: '14px',
        color: '#f8fafc',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        fontSize: 13,
        marginTop: 10,
        marginBottom: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{info.icon}</span>
          <span style={{ fontWeight: 700, color: '#93c5fd' }}>{info.titulo}</span>
        </div>
        <span
          style={{
            fontSize: 11,
            background: `${info.badgeColor}22`,
            color: info.badgeColor,
            border: `1px solid ${info.badgeColor}55`,
            padding: '2px 8px',
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          Oficial Ley 213/93
        </span>
      </div>

      {/* Alerta de datos faltantes para evitar descarga de documentos con placeholders */}
      {hasPlaceholders && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 10,
            padding: '9px 12px',
            marginBottom: 10,
            fontSize: 12,
            color: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>⚠️ Faltan datos del colaborador para emitir la nota oficial con valor legal.</span>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(documentData)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              }}
            >
              <span>📝</span>
              <span>Cargar datos al toque</span>
            </button>
          )}
        </div>
      )}

      {/* Datos Clave */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ color: '#94a3b8' }}>Colaborador:</span>
          <strong style={{ color: '#f1f5f9' }}>{opts.nombreEmpleado}</strong>
        </div>
        {opts.ciEmpleado && opts.ciEmpleado !== '—' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ color: '#94a3b8' }}>Cédula de Identidad:</span>
            <span style={{ color: '#cbd5e1' }}>{opts.ciEmpleado}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ color: '#94a3b8' }}>Empresa / Empleador:</span>
          <span style={{ color: '#cbd5e1' }}>{opts.empresa}</span>
        </div>
        {opts.diasSuspension && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ color: '#94a3b8' }}>Días de Suspensión:</span>
            <strong style={{ color: '#ef4444' }}>{opts.diasSuspension} días (sin goce)</strong>
          </div>
        )}
        {opts.sucursalDestino && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ color: '#94a3b8' }}>Nueva Sede / Destino:</span>
            <strong style={{ color: '#60a5fa' }}>{opts.sucursalDestino}</strong>
          </div>
        )}
        {(opts.hechosOcurridos || opts.causaJustificada) && (
          <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#94a3b8', fontSize: 11.5, display: 'block', marginBottom: 2 }}>Motivo / Hechos:</span>
            <span style={{ color: '#e2e8f0', fontSize: 12, fontStyle: 'italic' }}>
              "{opts.causaJustificada || opts.hechosOcurridos}"
            </span>
          </div>
        )}
      </div>

      {/* Botones de Descarga y Edición */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(documentData)}
            style={{
              flex: '1 1 120px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 12px',
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span>✏️</span>
            <span>{hasPlaceholders ? 'Cargar datos' : 'Editar casillas'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          style={{
            flex: '1 1 140px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 12px',
            fontWeight: 600,
            fontSize: 12.5,
            cursor: downloadingPdf ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
            transition: 'all 0.15s ease',
            opacity: downloadingPdf ? 0.7 : 1,
          }}
        >
          <span>📥</span>
          <span>{downloadingPdf ? 'Generando PDF...' : 'Descargar PDF Oficial'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadDocx}
          disabled={downloadingDocx}
          style={{
            flex: '1 1 140px',
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            color: '#93c5fd',
            border: '1px solid rgba(147, 197, 253, 0.3)',
            borderRadius: 8,
            padding: '9px 12px',
            fontWeight: 600,
            fontSize: 12.5,
            cursor: downloadingDocx ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
            opacity: downloadingDocx ? 0.7 : 1,
          }}
        >
          <span>📝</span>
          <span>{downloadingDocx ? 'Generando Word...' : 'Descargar Word (.docx)'}</span>
        </button>
      </div>
    </div>
  );
};
