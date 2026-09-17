/**
 * COMPONENTE DE 4 OPCIONES INTERACTIVAS DE CONTINUACIÓN — LABORAPY
 *
 * Muestra las 4 opciones emitidas por Tobi (o generadas por fallback)
 * como chips interactivos accesibles con diseño Linear/Dark:
 *  - 3 opciones de profundización (contexto, causal, tipo de salida).
 *  - 1 opción libre / complementaria.
 */

import React from 'react';

export interface TobiContinuationOptionsProps {
  readonly options: readonly string[];
  readonly onSelectOption: (optionText: string) => void;
  readonly disabled?: boolean;
  readonly isMobile?: boolean;
}

export const TobiContinuationOptions: React.FC<TobiContinuationOptionsProps> = ({
  options,
  onSelectOption,
  disabled = false,
  isMobile = false,
}) => {
  if (!options || options.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#818cf8',
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span>💡</span>
        <span>Opciones sugeridas para continuar:</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 6,
        }}
      >
        {options.slice(0, 4).map((opt, idx) => {
          const isAlternative = idx === 3;
          return (
            <button
              key={`${idx}-${opt.slice(0, 20)}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectOption(opt)}
              title={opt}
              style={{
                textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 8,
                background: isAlternative
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(99, 102, 241, 0.12)',
                border: isAlternative
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(99, 102, 241, 0.28)',
                color: isAlternative ? '#a7f3d0' : '#e0e7ff',
                fontSize: 11.5,
                lineHeight: 1.35,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = isAlternative
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(99, 102, 241, 0.22)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = isAlternative
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(99, 102, 241, 0.12)';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                {isAlternative ? '💬' : idx === 0 ? '🔍' : idx === 1 ? '⚖️' : '📋'}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
