import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export interface CompactDatePickerProps {
  value: string; // ISO 'YYYY-MM-DD'
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  label?: string;
  quickAction?: {
    label: string;
    onClick: () => void;
  };
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAYS_SHORT_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function parseIso(value: string): { year: number; month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidYmd(year, month, day) ? { year, month, day } : null;
}

export function formatDisplayFromIso(value: string): string {
  const parsed = parseIso(value);
  if (!parsed) return '';
  return `${pad2(parsed.day)}/${pad2(parsed.month)}/${parsed.year}`;
}

/** Parsea texto DD/MM/AAAA (tolerante con / o -) */
export function parseDisplayText(text: string): string | null {
  const cleaned = text.trim().replace(/[.\-\s]+/g, '/');
  if (!cleaned) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > 2100) return null;
  if (!isValidYmd(year, month, day)) return null;
  return toIso(year, month - 1, day);
}

/** Máscara inteligente para escritura DD/MM/AAAA */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += '/';
    out += digits[i];
  }
  return out;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Lunes = 0 ... Domingo = 6 */
function getMondayBasedWeekday(year: number, monthIndex: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

function getDecadeBlock(year: number): { start: number; end: number } {
  const start = Math.floor(year / 12) * 12;
  return { start, end: start + 11 };
}

export const CompactDatePicker: React.FC<CompactDatePickerProps> = ({
  value,
  onChange,
  className,
  id,
  label,
  quickAction,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [view, setView] = useState<'calendar' | 'years'>('calendar');
  const [textValue, setTextValue] = useState<string>(() => formatDisplayFromIso(value));

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);

  const parsed = useMemo(() => parseIso(value), [value]);

  const [cursorYear, setCursorYear] = useState<number>(parsed?.year ?? today.year);
  const [cursorMonth, setCursorMonth] = useState<number>(
    parsed ? parsed.month - 1 : today.month
  );
  const [yearBlockStart, setYearBlockStart] = useState<number>(
    () => getDecadeBlock(parsed?.year ?? today.year).start
  );
  const [yearInputValue, setYearInputValue] = useState<string>(
    String(parsed?.year ?? today.year)
  );

  // Sincronizar el texto del input cuando el valor externo cambia
  useEffect(() => {
    setTextValue(formatDisplayFromIso(value));
  }, [value]);

  // Sincronizar cursor al cambiar de fecha
  useEffect(() => {
    if (parsed) {
      setCursorYear(parsed.year);
      setCursorMonth(parsed.month - 1);
      setYearBlockStart(getDecadeBlock(parsed.year).start);
      setYearInputValue(String(parsed.year));
    }
  }, [parsed?.year, parsed?.month]);

  // Cierre al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
        setView('calendar');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setView('calendar');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Autofocus en el input del año al abrir la vista de años
  useEffect(() => {
    if (isOpen && view === 'years') {
      const t = window.setTimeout(() => {
        yearInputRef.current?.focus();
        yearInputRef.current?.select();
      }, 40);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, view]);

  const commitText = useCallback(
    (raw: string) => {
      const masked = maskDateInput(raw);
      setTextValue(masked);
      if (!masked) {
        onChange('');
        return;
      }
      const iso = parseDisplayText(masked);
      if (iso) {
        onChange(iso);
      }
    },
    [onChange]
  );

  const handleTextBlur = useCallback(() => {
    const iso = parseDisplayText(textValue);
    if (iso) {
      onChange(iso);
      setTextValue(formatDisplayFromIso(iso));
    } else if (!textValue.trim()) {
      onChange('');
      setTextValue('');
    } else {
      // Restaurar el valor válido previo si el texto quedó a medias
      setTextValue(formatDisplayFromIso(value));
    }
  }, [textValue, onChange, value]);

  const handleSelectDay = useCallback(
    (day: number) => {
      const iso = toIso(cursorYear, cursorMonth, day);
      onChange(iso);
      setTextValue(formatDisplayFromIso(iso));
      setIsOpen(false);
      setView('calendar');
    },
    [cursorYear, cursorMonth, onChange]
  );

  const changeMonth = useCallback(
    (delta: number) => {
      let m = cursorMonth + delta;
      let y = cursorYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      while (m > 11) {
        m -= 12;
        y += 1;
      }
      setCursorMonth(m);
      setCursorYear(y);
    },
    [cursorMonth, cursorYear]
  );

  const changeYear = useCallback((delta: number) => {
    setCursorYear((y) => y + delta);
  }, []);

  const openYearsView = useCallback(() => {
    setYearBlockStart(getDecadeBlock(cursorYear).start);
    setYearInputValue(String(cursorYear));
    setView('years');
  }, [cursorYear]);

  const selectYear = useCallback(
    (year: number) => {
      setCursorYear(year);
      setYearBlockStart(getDecadeBlock(year).start);
      setYearInputValue(String(year));
      setView('calendar');
    },
    []
  );

  const handleYearInputSubmit = useCallback(() => {
    const yr = Number(yearInputValue);
    if (Number.isFinite(yr) && yr >= 1900 && yr <= 2100) {
      selectYear(Math.trunc(yr));
    } else {
      setYearInputValue(String(cursorYear));
    }
  }, [yearInputValue, cursorYear, selectYear]);

  const handleToday = useCallback(() => {
    const iso = toIso(today.year, today.month, today.day);
    onChange(iso);
    setTextValue(formatDisplayFromIso(iso));
    setCursorYear(today.year);
    setCursorMonth(today.month);
    setIsOpen(false);
    setView('calendar');
  }, [today, onChange]);

  const todayIso = useMemo(
    () => toIso(today.year, today.month, today.day),
    [today]
  );

  const calendarCells = useMemo(() => {
    const totalDays = daysInMonth(cursorYear, cursorMonth);
    const firstWeekday = getMondayBasedWeekday(cursorYear, cursorMonth, 1);
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells.slice(0, 42);
  }, [cursorYear, cursorMonth]);

  const yearButtons = useMemo(() => {
    const arr: number[] = [];
    for (let y = yearBlockStart; y <= yearBlockStart + 11; y++) arr.push(y);
    return arr;
  }, [yearBlockStart]);

  const currentIsoForSelection = parsed ? value : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%' }}
    >
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label
            htmlFor={id}
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              margin: 0,
            }}
          >
            {label}
          </label>
          {quickAction && (
            <button
              type="button"
              onClick={quickAction.onClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#047857',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {quickAction.label}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          value={textValue}
          onChange={(e) => commitText(e.target.value)}
          onBlur={handleTextBlur}
          onFocus={() => {
            // No auto-abrir al enfocar para permitir escribir rápido con teclado
          }}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '9px 12px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            outline: 'none',
            color: '#0f172a',
            backgroundColor: '#ffffff',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'border-color 0.15s ease',
          }}
        />
        <button
          type="button"
          aria-label="Abrir calendario"
          title="Abrir calendario"
          onClick={() => {
            setIsOpen((o) => !o);
            if (!isOpen) {
              setView('calendar');
            }
          }}
          style={{
            flex: '0 0 auto',
            padding: '0 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            backgroundColor: isOpen ? '#f1f5f9' : '#ffffff',
            cursor: 'pointer',
            fontSize: '15px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease',
          }}
        >
          📅
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Selector de fecha compacto"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1050,
            width: '268px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 12px 24px -4px rgba(0,0,0,0.15), 0 4px 8px -2px rgba(0,0,0,0.08)',
            padding: '12px',
            fontSize: '12px',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {view === 'calendar' ? (
            <>
              {/* Barra superior de mes y año */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  marginBottom: '8px',
                }}
              >
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => changeMonth(-1)}
                  style={navBtnStyle}
                  title="Mes anterior"
                >
                  ‹
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flex: 1,
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                    {MONTH_NAMES_ES[cursorMonth]}
                  </span>
                  <button
                    type="button"
                    onClick={openYearsView}
                    title="Clic para elegir año en cuadrícula (sin scroll)"
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '5px',
                      padding: '2px 7px',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span>{cursorYear}</span>
                    <span style={{ fontSize: '9px' }}>▾</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => changeMonth(1)}
                  style={navBtnStyle}
                  title="Mes siguiente"
                >
                  ›
                </button>
              </div>

              {/* Botones rápidos de ajuste anual: sin deslizar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  marginBottom: '8px',
                  padding: '4px 6px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => changeYear(-1)}
                  title="Restar 1 año"
                  style={miniBtnStyle}
                >
                  −1 año
                </button>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Año actual: <strong>{cursorYear}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => changeYear(1)}
                  title="Sumar 1 año"
                  style={miniBtnStyle}
                >
                  +1 año
                </button>
              </div>

              {/* Días de la semana */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '2px',
                  marginBottom: '4px',
                }}
              >
                {WEEKDAYS_SHORT_ES.map((d, i) => (
                  <div
                    key={`${d}-${i}`}
                    style={{
                      textAlign: 'center',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#64748b',
                      padding: '2px 0',
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Cuadrícula de días */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '2px',
                }}
              >
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} style={{ height: '26px' }} />;
                  }
                  const iso = toIso(cursorYear, cursorMonth, day);
                  const isSelected = iso === currentIsoForSelection;
                  const isToday = iso === todayIso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      style={{
                        height: '26px',
                        padding: 0,
                        fontSize: '11.5px',
                        borderRadius: '5px',
                        border: isSelected
                          ? '1px solid #047857'
                          : isToday
                          ? '1px solid #6ee7b7'
                          : '1px solid transparent',
                        backgroundColor: isSelected
                          ? '#047857'
                          : isToday
                          ? '#ecfdf5'
                          : 'transparent',
                        color: isSelected ? '#ffffff' : isToday ? '#065f46' : '#0f172a',
                        fontWeight: isSelected || isToday ? 800 : 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Vista alternativa de años: ¡Grilla directa, cero scroll! */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  marginBottom: '8px',
                }}
              >
                <button
                  type="button"
                  aria-label="Bloque anterior"
                  onClick={() => setYearBlockStart((s) => s - 12)}
                  style={navBtnStyle}
                  title="12 años atrás"
                >
                  ‹‹
                </button>
                <span style={{ fontWeight: 800, fontSize: '12px', color: '#1e293b' }}>
                  Años {yearBlockStart} - {yearBlockStart + 11}
                </span>
                <button
                  type="button"
                  aria-label="Bloque siguiente"
                  onClick={() => setYearBlockStart((s) => s + 12)}
                  style={navBtnStyle}
                  title="12 años adelante"
                >
                  ››
                </button>
              </div>

              {/* Input numérico directo para escribir el año de una sola vez */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '8px',
                }}
              >
                <input
                  ref={yearInputRef}
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2100}
                  value={yearInputValue}
                  onChange={(e) => setYearInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleYearInputSubmit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setView('calendar');
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                  placeholder="Teclear año ej: 2018"
                />
                <button
                  type="button"
                  onClick={handleYearInputSubmit}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fijar
                </button>
              </div>

              {/* Cuadrícula compacta 3x4 de años para selección inmediata */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '4px',
                }}
              >
                {yearButtons.map((year) => {
                  const isCurrent = year === cursorYear;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => selectYear(year)}
                      style={{
                        padding: '6px 0',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: isCurrent ? '1px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: isCurrent ? '#0284c7' : '#f8fafc',
                        color: isCurrent ? '#ffffff' : '#0f172a',
                        fontWeight: isCurrent ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setView('calendar')}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '6px 0',
                  fontSize: '11.5px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← Volver al mes
              </button>
            </>
          )}

          {/* Pie con accesos rápidos */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={handleToday}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '5px',
                border: '1px solid #a7f3d0',
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Hoy
            </button>
            {quickAction && (
              <button
                type="button"
                onClick={() => {
                  quickAction.onClick();
                  setIsOpen(false);
                  setView('calendar');
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {quickAction.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setView('calendar');
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const navBtnStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
  color: '#0f172a',
  padding: 0,
};

const miniBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '11px',
  borderRadius: '4px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  fontWeight: 700,
};

export default CompactDatePicker;