/**
 * BOTÓN FLOTANTE DEL AUXILIAR RRHH ("SEGUNDO OJO") — LABORAPY
 * Versión: PY-WIDGET-2026.09.10 (Estilos Nativos Puros sin dependencia de Tailwind)
 */

import React, { useState } from 'react';

interface HRAssistantWidgetProps {
  onClick: () => void;
  alertCount?: number;
  isOpen?: boolean;
}

export const HRAssistantWidget: React.FC<HRAssistantWidgetProps> = ({
  onClick,
  alertCount = 0,
  isOpen = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '96px',
        zIndex: 9980,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {/* Tooltip flotante */}
      {isHovered && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.15)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🛡️ Auxiliar RRHH · Segundo Ojo</span>
          {alertCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '999px',
              }}
            >
              {alertCount} alertas
            </span>
          )}
        </div>
      )}

      {/* Botón flotante animado */}
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #0f766e 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          boxShadow: isHovered
            ? '0 12px 28px rgba(5, 150, 105, 0.55), 0 0 0 4px rgba(16, 185, 129, 0.35)'
            : '0 6px 18px rgba(5, 150, 105, 0.45)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
          outline: 'none',
        }}
        aria-label="Abrir Auxiliar Inteligente de RRHH"
        title="Auxiliar Inteligente de RRHH — Segundo Ojo & Copilot Laboral"
      >
        <span style={{ userSelect: 'none', pointerEvents: 'none' }}>🛡️</span>

        {/* Indicador de estado activo */}
        <span
          style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid #ffffff',
            boxShadow: '0 0 8px #10b981',
          }}
        />
      </button>
    </div>
  );
};
