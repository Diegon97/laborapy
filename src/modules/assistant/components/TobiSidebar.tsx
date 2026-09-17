/**
 * BARRA LATERAL DE HISTORIAL DE CHATS (SIDEBAR) — LABORAPY (TOBI)
 *
 * Interfaz estilo ChatGPT / Claude / Gemini:
 *  - Lista de conversaciones previas ordenadas por fecha.
 *  - Botón prominente "+ Nuevo Chat".
 *  - Selección de conversación, indicador de chat activo y borrado.
 *  - Soporte responsivo (drawer móvil y sidebar colapsable en desktop).
 */

import React from 'react';
import type { ChatSession } from '../sessionManager';

export interface TobiSidebarProps {
  readonly isOpen: boolean;
  readonly sessions: readonly ChatSession[];
  readonly activeSessionId: string | null;
  readonly onSelectSession: (sessionId: string) => void;
  readonly onNewChat: () => void;
  readonly onDeleteSession: (sessionId: string) => void;
  readonly onClose: () => void;
  readonly isMobile?: boolean;
}

export const TobiSidebar: React.FC<TobiSidebarProps> = ({
  isOpen,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClose,
  isMobile = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop en móvil */}
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99998,
          }}
        />
      )}

      <aside
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          width: isMobile ? 280 : 260,
          maxWidth: '85vw',
          height: '100%',
          background: 'linear-gradient(180deg, #090e17 0%, #0c1424 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99999,
          boxShadow: isMobile ? '4px 0 25px rgba(0, 0, 0, 0.6)' : 'none',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {/* Header del Sidebar */}
        <div
          style={{
            padding: '14px 14px 10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.01em' }}>
              Mis Consultas
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar panel lateral"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 16,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Botón Nuevo Chat */}
        <div style={{ padding: '12px 14px' }}>
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (isMobile) onClose();
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
            }}
          >
            <span style={{ fontSize: 15 }}>+</span>
            <span>Nuevo Chat</span>
          </button>
        </div>

        {/* Lista de Sesiones con Scroll */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 8px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {sessions.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
              No tenés consultas anteriores guardadas. Iniciá una nueva conversación para comenzar.
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isActive ? 'rgba(30, 41, 59, 0.85)' : 'transparent',
                    border: isActive ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: 6,
                  }}
                  onClick={() => {
                    onSelectSession(sess.id);
                    if (isMobile) onClose();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, flexShrink: 0, color: isActive ? '#34d399' : '#64748b' }}>
                      💭
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: isActive ? '#f8fafc' : '#cbd5e1',
                          fontWeight: isActive ? 700 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sess.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                        {new Date(sess.updatedAt).toLocaleDateString([], {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Botón Borrar Chat */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar la conversación "${sess.title}"?`)) {
                        onDeleteSession(sess.id);
                      }
                    }}
                    title="Eliminar consulta"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: '2px 4px',
                      borderRadius: 4,
                      opacity: isActive ? 0.8 : 0.4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fca5a5';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.opacity = isActive ? '0.8' : '0.4';
                    }}
                  >
                    🗑️
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer del Sidebar con créditos de privacidad */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: 10.5,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          🔒 Consultas guardadas de forma segura
        </div>
      </aside>
    </>
  );
};
