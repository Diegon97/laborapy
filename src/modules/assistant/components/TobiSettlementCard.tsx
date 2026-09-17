import React, { useState, useCallback } from 'react';
import type { LiquidacionInput, LiquidacionResult } from '../../payroll/types';
import { generarLiquidacionPDF } from '../../payroll/generators/settlementPdfGenerator';

export interface TobiSettlementCardProps {
  settlementData: {
    input: LiquidacionInput;
    result: LiquidacionResult;
  };
  onDownloadPdf?: () => void;
}

const formatGs = (val: number): string => {
  return 'Gs. ' + Math.round(val).toLocaleString('es-PY');
};

export const TobiSettlementCard: React.FC<TobiSettlementCardProps> = ({
  settlementData,
  onDownloadPdf,
}) => {
  const { input, result } = settlementData;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(() => {
    setDownloading(true);
    try {
      if (onDownloadPdf) {
        onDownloadPdf();
      } else {
        const doc = generarLiquidacionPDF(input, result);
        const slug = input.nombreEmpleado
          ? input.nombreEmpleado.trim().replace(/\s+/g, '_')
          : 'Laboral';
        doc.save(`Finiquito_${slug}.pdf`);
      }
    } catch (err) {
      console.error('Error al generar Finiquito PDF:', err);
    } finally {
      setDownloading(false);
    }
  }, [input, result, onDownloadPdf]);

  const indemnizacionConcepto = result.conceptos.find((c) => c.id === 'indemnizacion');
  const preavisoConcepto = result.conceptos.find((c) => c.id === 'preaviso');
  const vacacionesConcepto = result.conceptos.find((c) => c.id.startsWith('vacaciones'));
  const ipsConcepto = result.conceptos.find((c) => c.id === 'ips_obrero' || c.esDescuento);

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 14,
        border: '1px solid rgba(16, 185, 129, 0.35)',
        padding: '14px',
        color: '#f8fafc',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        fontSize: 13,
      }}
    >
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
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontWeight: 700, color: '#a7f3d0' }}>Liquidación Oficial Calculada</span>
        </div>
        <span
          style={{
            fontSize: 10.5,
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#c7d2fe',
            padding: '2px 8px',
            borderRadius: 999,
            fontWeight: 600,
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          Antigüedad: {result.antiguedad.years}a {result.antiguedad.months}m {result.antiguedad.days}d
        </span>
      </div>

      <div
        style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: '#d1fae5', fontWeight: 600 }}>Total Neto Estimado:</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#34d399', letterSpacing: 0.3 }}>
          {formatGs(result.totalNetoEstimado)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>Total Haberes Brutos:</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatGs(result.totalBruto)}</span>
        </div>
        {indemnizacionConcepto && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
            <span>Indemnización (Art. 91):</span>
            <span style={{ color: '#e2e8f0' }}>{formatGs(indemnizacionConcepto.monto)}</span>
          </div>
        )}
        {preavisoConcepto && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
            <span>Preaviso (Art. 87/90):</span>
            <span style={{ color: '#e2e8f0' }}>{formatGs(preavisoConcepto.monto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>Aguinaldo Proporcional (Exento):</span>
          <span style={{ color: '#e2e8f0' }}>{formatGs(result.aguinaldoProporcional)}</span>
        </div>
        {vacacionesConcepto && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
            <span>Vacaciones Proporcionales:</span>
            <span style={{ color: '#e2e8f0' }}>{formatGs(vacacionesConcepto.monto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>Total Descuentos {ipsConcepto ? '(inc. IPS 9%)' : ''}:</span>
          <span style={{ color: '#f87171' }}>-{formatGs(result.totalDescuentos)}</span>
        </div>
      </div>

      {result.alertas && result.alertas.length > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 12,
            fontSize: 11,
            color: '#fca5a5',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {result.alertas.slice(0, 2).map((a) => (
            <div key={a.id}>⚠️ {a.mensaje}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          border: 'none',
          borderRadius: 8,
          padding: '9px 12px',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 12.5,
          cursor: downloading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          transition: 'all 0.15s ease',
        }}
      >
        <span>📥</span>
        <span>{downloading ? 'Generando PDF...' : 'Descargar Finiquito Oficial en PDF'}</span>
      </button>
    </div>
  );
};
