import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  keywords?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  label?: string;
  id?: string;
}

const normalizar = (txt: string): string =>
  (txt || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const filtrarOpciones = (
  options: SearchableSelectOption[],
  query: string,
): SearchableSelectOption[] => {
  const terminos = normalizar(query).trim().split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return options;
  return options.filter((op) => {
    const heno = normalizar(`${op.label} ${op.sublabel ?? ''} ${op.keywords ?? ''}`);
    return terminos.every((t) => heno.includes(t));
  });
};

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  disabled = false,
  emptyText = 'Sin resultados para la búsqueda',
  label,
  id,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [indiceActivo, setIndiceActivo] = useState(0);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const seleccionada = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtradas = useMemo(() => filtrarOpciones(options, query), [options, query]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setQuery('');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    setIndiceActivo(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [abierto]);

  const seleccionar = (v: string) => {
    onChange(v);
    setAbierto(false);
    setQuery('');
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceActivo((i) => Math.min(i + 1, Math.max(0, filtradas.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const op = filtradas[indiceActivo];
      if (op) seleccionar(op.value);
    }
  };

  return (
    <div
      ref={contenedorRef}
      id={id}
      style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}
    >
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#334155',
            marginBottom: '4px',
          }}
        >
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        style={{
          width: '100%',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          fontSize: '12.5px',
          textAlign: 'left',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          color: seleccionada ? '#0f172a' : '#64748b',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          fontWeight: seleccionada ? 600 : 400,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {seleccionada ? (
            <>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seleccionada.label}</span>
              {seleccionada.sublabel && (
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                  ({seleccionada.sublabel})
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#94a3b8' }}>{placeholder}</span>
          )}
        </div>
        {seleccionada?.badge && (
          <span
            style={{
              background: seleccionada.badgeColor || '#e2e8f0',
              color: '#0f172a',
              borderRadius: '999px',
              padding: '1px 7px',
              fontSize: '10.5px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {seleccionada.badge}
          </span>
        )}
        <span aria-hidden style={{ flex: '0 0 auto', color: '#64748b', fontSize: '10px' }}>
          {abierto ? '▲' : '▼'}
        </span>
      </button>

      {abierto && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 99999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndiceActivo(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="🔍 Escribí para buscar (multi-término)..."
              aria-label="Buscar opción"
              style={{
                width: '100%',
                minHeight: '36px',
                padding: '6px 10px',
                fontSize: '16px', // 16px previene auto-zoom en iOS Safari
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              maxHeight: '230px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {filtradas.length === 0 ? (
              <li
                style={{
                  padding: '14px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                {emptyText}
              </li>
            ) : (
              filtradas.map((op, idx) => {
                const esActivo = idx === indiceActivo;
                const esSeleccionado = op.value === value;
                return (
                  <li
                    key={op.value}
                    role="option"
                    aria-selected={esSeleccionado}
                    onMouseEnter={() => setIndiceActivo(idx)}
                    onClick={() => seleccionar(op.value)}
                    style={{
                      padding: '9px 12px',
                      cursor: 'pointer',
                      background: esActivo ? '#f1f5f9' : esSeleccionado ? '#eff6ff' : '#ffffff',
                      borderBottom: '1px solid #f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: esSeleccionado ? 700 : 500,
                          color: esSeleccionado ? '#1d4ed8' : '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {op.label}
                      </div>
                      {op.sublabel && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {op.sublabel}
                        </div>
                      )}
                    </div>
                    {op.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          background: op.badgeColor || '#e2e8f0',
                          color: '#0f172a',
                          flexShrink: 0,
                        }}
                      >
                        {op.badge}
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
