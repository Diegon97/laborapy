import React, { useState, useCallback } from 'react';
import type { LiquidacionInput, LiquidacionResult } from '../../payroll/types';
import { generarLiquidacionPDF } from '../../payroll/generators/settlementPdfGenerator';

export interface TobiArtifactPanelProps {
  settlementData: {
    input: LiquidacionInput;
    result: LiquidacionResult;
  };
  onClose?: () => void;
  onOpenForm?: () => void;
  onShare?: () => void;
}

const formatGs = (val: number): string => {
  return 'Gs. ' + Math.round(val).toLocaleString('es-PY');
};

export const TobiArtifactPanel: React.FC<TobiArtifactPanelProps> = ({
  settlementData,
  onClose,
  onOpenForm,
  onShare,
}) => {
  const { input, result } = settlementData;
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadPdf = useCallback(() => {
    setDownloading(true);
    try {
      const doc = generarLiquidacionPDF(input, result);
      const slug = input.nombreEmpleado
        ? input.nombreEmpleado.trim().replace(/\s+/g, '_')
        : 'Laboral';
      doc.save(`Finiquito_${slug}.pdf`);
    } catch (err) {
      console.error('Error al generar Finiquito PDF:', err);
    } finally {
      setDownloading(false);
    }
  }, [input, result]);

  const handleCopySummary = useCallback(() => {
    try {
      const vacAnt = input.vacacionesPeriodosAnteriores ?? 0;
      const lines = [
        `*FINIQUITO DE LIQUIDACIÓN LABORAL — LABORAPY*`,
        `Salario base: ${formatGs(input.salarioMensual)}`,
        `Antigüedad: ${result.antiguedad.years} años, ${result.antiguedad.months} meses, ${result.antiguedad.days} días`,
        `Ingreso: ${input.fechaIngreso} | Egreso: ${input.fechaEgreso}`,
        `Motivo: ${input.motivo}`,
        `---`,
        `• Total Haberes Brutos: ${formatGs(result.totalBruto)}`,
        `• Total Descuentos: -${formatGs(result.totalDescuentos)}`,
        `*TOTAL NETO A PERCIBIR: ${formatGs(result.totalNetoEstimado)}*`,
        vacAnt > 0 ? `• Vacaciones pendientes adeudadas: ${vacAnt} días` : '',
        `\nGenerado con Tobi en LaboraPy (https://calculadora-rrhh-py.vercel.app)`,
      ]
        .filter(Boolean)
        .join('\n');

      void navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [input, result]);

  const indemnizacion = result.conceptos.find((c) => c.id === 'indemnizacion');
  const preaviso = result.conceptos.find((c) => c.id === 'preaviso');
  const vacacionesConceptos = result.conceptos.filter((c) => c.id.startsWith('vacaciones'));
  const ips = result.conceptos.find((c) => c.id === 'ips_trabajador');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#f8fafc',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      {/* ── Header Estilo Claude Artifacts ── */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            📄
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Finiquito Oficial en PDF</span>
              <span
                style={{
                  fontSize: 10,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                LISTO
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Ley N° 213/93 · One-Page Fit Oficial
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Cerrar panel de finiquito"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '5px 9px',
                fontSize: 12,
                transition: 'all 0.15s ease',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Cuerpo del Artifact ── */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Monto Neto Principal Destacado */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 12,
            padding: '16px 18px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
          }}
        >
          <div style={{ fontSize: 11.5, color: '#a7f3d0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Total Neto Oficial a Cobrar
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399', letterSpacing: -0.5 }}>
            {formatGs(result.totalNetoEstimado)}
          </div>
          <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span>✓</span>
            <span>Liquidación conforme al Código del Trabajo de Paraguay</span>
          </div>
        </div>

        {/* Ficha técnica rápida */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Salario Imponible</div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginTop: 2 }}>{formatGs(input.salarioMensual)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Antigüedad</div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginTop: 2 }}>
              {result.antiguedad.years}a {result.antiguedad.months}m {result.antiguedad.days}d
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Ingreso</div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>{input.fechaIngreso}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Egreso</div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>{input.fechaEgreso}</div>
          </div>
        </div>

        {/* Desglose de Conceptos */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '14px',
            fontSize: 12.5,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Desglose de Conceptos Liquidables
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {indemnizacion && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>Indemnización por Despido (Art. 91)</span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{formatGs(indemnizacion.monto)}</span>
              </div>
            )}
            {preaviso && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>Preaviso Legal (Art. 87/90)</span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{formatGs(preaviso.monto)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
              <span>Aguinaldo Proporcional (Art. 243, Exento)</span>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{formatGs(result.aguinaldoProporcional)}</span>
            </div>
            {vacacionesConceptos.map((v) => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>{v.nombre}</span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{formatGs(v.monto)}</span>
              </div>
            ))}
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: 8,
                marginTop: 2,
                display: 'flex',
                justifyContent: 'space-between',
                color: '#f87171',
              }}
            >
              <span>Total Retenciones {ips ? '(inc. IPS 9%)' : ''}</span>
              <span style={{ fontWeight: 600 }}>-{formatGs(result.totalDescuentos)}</span>
            </div>
          </div>
        </div>

        {/* Botón de Acción Principal: Descargar PDF */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading}
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            border: 'none',
            borderRadius: 10,
            padding: '13px 18px',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 14,
            cursor: downloading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 16 }}>📥</span>
          <span>{downloading ? 'Generando Documento...' : 'Descargar Finiquito Oficial en PDF'}</span>
        </button>

        {/* Botones secundarios */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {onOpenForm && (
            <button
              type="button"
              onClick={onOpenForm}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#cbd5e1',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>✏️</span>
              <span>Ajustar Casillas</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? '¡Copiado!' : 'Copiar Detalle'}</span>
          </button>
        </div>

        {onShare && (
          <button
            type="button"
            onClick={onShare}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 8,
              padding: '9px 12px',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>🔗</span>
            <span>Compartir enlace corto de este Finiquito</span>
          </button>
        )}
      </div>
    </div>
  );
};
