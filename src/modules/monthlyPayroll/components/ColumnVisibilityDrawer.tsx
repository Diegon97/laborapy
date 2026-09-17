import React, { useState } from 'react';
import type { GridColumnDef } from '../types';

interface ColumnVisibilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: GridColumnDef[];
  hiddenColumnIds: string[];
  onToggleColumn: (columnId: string) => void;
  onResetDefaults: () => void;
}

export const ColumnVisibilityDrawer: React.FC<ColumnVisibilityDrawerProps> = ({
  isOpen,
  onClose,
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;

  const filtered = columns.filter(
    (c) =>
      c.id !== 'nro' &&
      c.id !== 'ci' &&
      c.id !== 'nombre' &&
      c.id !== 'acciones' &&
      c.label.toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15,23,42,0.4)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              👁️ Columnas Visibles
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Activá o desactivá columnas según tu necesidad
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '13px', color: '#94a3b8' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar columna..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
            Columnas Configurables ({filtered.length})
          </div>

          {filtered.map((col) => {
            const isVisible = !hiddenColumnIds.includes(col.id);
            return (
              <label
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: isVisible ? '#f8fafc' : '#ffffff',
                  border: isVisible ? '1px solid #e2e8f0' : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggleColumn(col.id)}
                  style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                />
                <span
                  style={{
                    flex: 1,
                    fontWeight: isVisible ? 600 : 400,
                    color: isVisible ? '#0f172a' : '#94a3b8',
                  }}
                >
                  {col.label}
                </span>

                {col.isCustom && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    Custom
                  </span>
                )}

                {col.type === 'formula' && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    fx
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            onClick={onResetDefaults}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🔄 Restablecer
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
