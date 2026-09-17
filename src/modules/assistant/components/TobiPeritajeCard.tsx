/**
 * TARJETA DE PERITAJE PRELIMINAR SYSTEM ONE — LABORAPY (TOBI)
 *
 * Renderiza el dictamen técnico emitido por el subsistema System One:
 *  - Causal jurídica tipificada (motivoEgreso según Código del Trabajo).
 *  - Intención detectada (consulta_despido, fraude_factura, fuero_maternal, etc.).
 *  - Riesgo de primacía de la realidad / facturación encubierta (Art. 19 C.T.).
 *  - Alerta de prescripción fatal (60 días corridos Art. 399 C.T.).
 */

import React, { useState } from 'react';
import type { TobiPeritajeJudgment } from '../systemOne/types';

export interface TobiPeritajeCardProps {
  readonly judgment: TobiPeritajeJudgment;
  readonly isMobile?: boolean;
}

export const TobiPeritajeCard: React.FC<TobiPeritajeCardProps> = ({
  judgment,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!judgment) return null;

  // Solo considerar fraude si es intención explícita de facturación, flagrante o nivel >= 3 (escala 1 a 5)
  const hasFraud =
    judgment.intencion === 'fraude_facturacion' ||
    judgment.riesgoFraudeArt19.flagrante ||
    judgment.riesgoFraudeArt19.nivel >= 3;

  // Solo mostrar la tarjeta de peritaje si es relevante (despido tipificado, fraude real o plazo fatal)
  const isRelevant =
    judgment.intencion !== 'fuera_de_dominio' &&
    (judgment.motivoEgreso !== 'no_aplica' ||
      hasFraud ||
      judgment.esUrgentePrescripcion);

  if (!isRelevant) return null;

  // Porcentaje de riesgo de fraude sobre escala 1..5: nivel 1=0%, 2=25%, 3=50%, 4=75%, 5=100%
  const fraudScore = Math.min(100, Math.max(0, Math.round(((judgment.riesgoFraudeArt19.score - 1) / 4) * 100)));

  return (
    <div
      style={{
        marginTop: 10,
        marginBottom: 6,
        borderRadius: 10,
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: hasFraud ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        fontSize: 12,
        color: '#f8fafc',
      }}
    >
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: hasFraud ? 'rgba(239, 68, 68, 0.12)' : 'rgba(99, 102, 241, 0.14)',
          border: 'none',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700 }}>
          <span style={{ fontSize: 14 }}>{hasFraud ? '⚠️' : '⚖️'}</span>
          <span style={{ color: hasFraud ? '#fca5a5' : '#c7d2fe', letterSpacing: '0.01em' }}>
            Peritaje Jurídico Preliminar (System One)
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontWeight: 500,
            }}
          >
            Certeza: {Math.round(judgment.confianza * 100)}%
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Cuerpo expandido */}
      {isExpanded && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Causal y resumen */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {judgment.motivoEgreso !== 'no_aplica' && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#93c5fd',
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                Causal: {judgment.motivoEgreso.replace(/_/g, ' ').toUpperCase()}
              </span>
            )}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#a7f3d0',
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              Materia: {judgment.intencion.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Detección de fraude laboral / factura (Art. 19 C.T.) */}
          {hasFraud && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#f87171' }}>Primacía de la Realidad (Art. 19 C.T.):</strong>
                <span style={{ color: '#fca5a5', fontWeight: 700 }}>
                  {fraudScore}% riesgo de relación encubierta
                </span>
              </div>
              <p style={{ margin: 0, color: '#fecaca', fontSize: 11, lineHeight: 1.4 }}>
                Se detectaron indicios de facturación por servicios en relación de subordinación técnica o económica. Corresponde exigibilidad de aportes al IPS y liquidación de haberes como trabajador dependiente.
              </p>
            </div>
          )}

          {/* Advertencia de Prescripción urgente (Art. 399 C.T.) */}
          {judgment.esUrgentePrescripcion && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                color: '#fbbf24',
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              <span style={{ flexShrink: 0 }}>⏱️</span>
              <span>
                <strong>Plazo Fatal:</strong> Rige el término de prescripción de 60 días corridos desde el despido para entablar reclamo judicial de indemnizaciones y preaviso (Art. 399 Código del Trabajo).
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
