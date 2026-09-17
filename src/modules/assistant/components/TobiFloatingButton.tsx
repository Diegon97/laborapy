import React, { useEffect, useState } from 'react';

export interface TobiFloatingButtonProps {
  onClick: () => void;
  isOpen?: boolean;
  hasUnread?: boolean;
}

const SPARKLE_PATH =
  'M12 2l1.6 4.9L18.5 8.5 13.6 10.1 12 15l-1.6-4.9L5.5 8.5l4.9-1.6L12 2zm6.5 11l.95 2.9 2.9.95-2.9.95-.95 2.9-.95-2.9-2.9-.95 2.9-.95.95-2.9zM5.5 14l.75 2.25 2.25.75-2.25.75L5.5 20l-.75-2.25L2.5 17l2.25-.75L5.5 14z';

const GLOBAL_KEYFRAMES_ID = 'tobi-floating-button-keyframes';

const GLOBAL_CSS = `
@keyframes tobiSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes tobiPulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.95; transform: scale(1.08); }
}
@keyframes tobiTwinkle {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.12) rotate(8deg); opacity: 0.85; }
}
@keyframes tobiBlink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
@keyframes tobiBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes tobiFadeIn {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
@media (max-width: 480px) {
  .tobi-fab-wrapper {
    bottom: calc(84px + env(safe-area-inset-bottom, 0px)) !important;
    right: 16px !important;
  }
  .tobi-fab-button {
    width: 58px !important;
    height: 58px !important;
  }
  .tobi-fab-tooltip {
    right: 68px !important;
    font-size: 12px !important;
    padding: 8px 12px !important;
  }
}
`;

export const TobiFloatingButton: React.FC<TobiFloatingButtonProps> = ({
  onClick,
  isOpen = false,
  hasUnread = false,
}) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(GLOBAL_KEYFRAMES_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = GLOBAL_KEYFRAMES_ID;
    styleEl.setAttribute('data-tobi-fab', 'true');
    styleEl.appendChild(document.createTextNode(GLOBAL_CSS));
    document.head.appendChild(styleEl);
  }, []);

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  if (isOpen) return null;

  return (
    <div
      className="tobi-fab-wrapper"
      style={{
        position: 'fixed',
        bottom: '96px',
        right: '24px',
        zIndex: 9980,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
        {isHovered && (
          <div
            className="tobi-fab-tooltip"
            role="tooltip"
            style={{
              position: 'absolute',
              right: 76,
              bottom: 10,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.96)',
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 24px -8px rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              animation: 'tobiFadeIn 180ms ease forwards',
              pointerEvents: 'none',
              zIndex: 9981,
            }}
          >
            <span style={{ display: 'block', fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>
              Chatear con Tobi (Copilot RRHH)
            </span>
            <span style={{ display: 'block', marginTop: 2, color: '#93c5fd', fontSize: 11, fontWeight: 500 }}>
              Asistente inteligente de Recursos Humanos
            </span>
          </div>
        )}

        <button
          type="button"
          className="tobi-fab-button"
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setIsPressed(false);
          }}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          aria-label="Chatear con Tobi (Copilot RRHH)"
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #065f46 100%)',
            boxShadow: isHovered
              ? '0 18px 36px -8px rgba(30, 27, 75, 0.65), 0 10px 20px -6px rgba(6, 95, 70, 0.55), inset 0 1px 0 rgba(255,255,255,0.22)'
              : '0 12px 28px -6px rgba(30, 27, 75, 0.55), 0 6px 14px -4px rgba(6, 95, 70, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            padding: 0,
            outline: 'none',
            transform: isPressed ? 'scale(0.94)' : isHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Halo de pulso */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, rgba(16,185,129,0.0) 0deg, rgba(16,185,129,0.75) 90deg, rgba(99,102,241,0.85) 200deg, rgba(16,185,129,0) 360deg)',
              opacity: 0.85,
              filter: 'blur(1px)',
              animation: 'tobiSpin 6s linear infinite',
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />

          {/* Avatar central con destello ✨ */}
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #065f46 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(226, 232, 240, 0.28)',
              boxShadow: 'inset 0 0 12px rgba(16,185,129,0.35), inset 0 0 22px rgba(99,102,241,0.35)',
              position: 'relative',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                fill: '#e0f2fe',
                filter: 'drop-shadow(0 0 6px rgba(125, 211, 252, 0.9))',
                animation: 'tobiTwinkle 2.4s ease-in-out infinite',
              }}
            >
              <path d={SPARKLE_PATH} />
            </svg>
          </span>

          {/* Badge de estado activo */}
          {hasUnread ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #0f172a',
                animation: 'tobiBounce 1.4s ease-in-out infinite',
              }}
            >
              !
            </span>
          ) : (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                padding: '3px 8px 3px 7px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: '#ecfdf5',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                boxShadow: '0 4px 10px -2px rgba(4, 120, 87, 0.6)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: '1.5px solid rgba(6, 95, 70, 0.6)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#a7f3d0',
                  boxShadow: '0 0 6px rgba(167, 243, 208, 0.95)',
                  animation: 'tobiBlink 1.6s ease-in-out infinite',
                }}
              />
              Activo
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default TobiFloatingButton;
