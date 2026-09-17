import React, { useState, useEffect } from 'react';
import type { GridColumnDef, ColumnType, ColumnColor, ColumnOption } from '../types';

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (column: GridColumnDef) => void;
  editingColumn?: GridColumnDef | null;
  availableColumns: { id: string; label: string }[];
}

const COLOR_PALETTE: { id: ColumnColor; label: string; bg: string; text: string; border: string }[] = [
  { id: 'default', label: 'Default', bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  { id: 'blue', label: 'Azul', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  { id: 'emerald', label: 'Esmeralda', bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  { id: 'amber', label: 'Ámbar', bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  { id: 'rose', label: 'Rosa', bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  { id: 'purple', label: 'Púrpura', bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  { id: 'indigo', label: 'Índigo', bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  { id: 'cyan', label: 'Cian', bg: '#cffafe', text: '#155e75', border: '#a5f3fc' },
  { id: 'slate', label: 'Pizarra', bg: '#e2e8f0', text: '#1e293b', border: '#cbd5e1' },
];

export const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingColumn,
  availableColumns,
}) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ColumnType>('currency');
  const [color, setColor] = useState<ColumnColor>('default');
  const [formula, setFormula] = useState('');
  const [impactsLiquidation, setImpactsLiquidation] = useState<'none' | 'haber' | 'descuento'>('none');
  const [options, setOptions] = useState<ColumnOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  useEffect(() => {
    if (editingColumn) {
      setLabel(editingColumn.label);
      setType(editingColumn.type);
      setColor(editingColumn.color || 'default');
      setFormula(editingColumn.formula || '');
      setImpactsLiquidation(editingColumn.impactsLiquidation || 'none');
      setOptions(editingColumn.options || []);
    } else {
      setLabel('');
      setType('currency');
      setColor('default');
      setFormula('');
      setImpactsLiquidation('none');
      setOptions([]);
    }
  }, [editingColumn, isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    const trimmed = newOptionLabel.trim();
    if (!trimmed) return;
    const colors: ColumnColor[] = ['blue', 'emerald', 'amber', 'rose', 'purple', 'indigo', 'cyan'];
    const assignedColor = colors[options.length % colors.length];
    setOptions([...options, { label: trimmed, color: assignedColor }]);
    setNewOptionLabel('');
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const insertIntoFormula = (snippet: string) => {
    setFormula((prev) => prev + snippet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      alert('Por favor asigná un nombre a la columna.');
      return;
    }

    const colId = editingColumn?.id || `col_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const newCol: GridColumnDef = {
      id: colId,
      label: label.trim(),
      type,
      isCustom: editingColumn ? editingColumn.isCustom : true,
      editable: type !== 'formula',
      visible: editingColumn ? editingColumn.visible : true,
      color,
      formula: type === 'formula' ? formula.trim() : undefined,
      impactsLiquidation: type === 'currency' || type === 'number' ? impactsLiquidation : 'none',
      options: type === 'select' ? options : undefined,
      minWidth: type === 'formula' || type === 'currency' ? '130px' : '110px',
    };

    onSave(newCol);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              {editingColumn ? '✏️ Modificar Columna' : '➕ Agregar Nueva Columna'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Configuración de campo tipo Excel / Notion
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Nombre */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Nombre de la Columna
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Bono Productividad, Calificación, etc."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tipo de dato y Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Tipo de Dato
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ColumnType)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="currency">💵 Moneda (Gs.)</option>
                <option value="number">🔢 Número</option>
                <option value="percentage">📊 Porcentaje (%)</option>
                <option value="text">📝 Texto</option>
                <option value="date">📅 Fecha (YYYY-MM-DD)</option>
                <option value="select">🏷️ Selección / Tag</option>
                <option value="formula">📐 Fórmula Calculada</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Color de Cabecera (Notion)
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value as ColumnColor)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {COLOR_PALETTE.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paleta visual de colores */}
          <div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {COLOR_PALETTE.map((c) => {
                const isSelected = color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: c.bg,
                      color: c.text,
                      border: isSelected ? `2px solid ${c.text}` : `1px solid ${c.border}`,
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor de Fórmula */}
          {type === 'formula' && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                📐 Programación de Fórmula (estilo Excel / Notion)
              </label>

              <input
                type="text"
                placeholder="=[salarioFijo] * 0.05"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #94a3b8',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Hacé clic en una columna para insertarla en la fórmula:
              </div>

              {/* Botones de Columnas disponibles */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxHeight: '100px', overflowY: 'auto' }}>
                {availableColumns.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => insertIntoFormula(`[${col.label}]`)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + [{col.label}]
                  </button>
                ))}
              </div>

              {/* Botones de operadores y funciones rápidas */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['+', '-', '*', '/', '^', '(', ')'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => insertIntoFormula(` ${op} `)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {op}
                  </button>
                ))}
                {['SUM()', 'ROUND()', 'IF()', 'AVG()'].map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => insertIntoFormula(fn)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    {fn}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: '#047857', backgroundColor: '#ecfdf5', padding: '6px 10px', borderRadius: '6px' }}>
                💡 <strong>Ejemplos:</strong> <code>=[salarioFijo] * 0.05</code> · <code>=[Total Haberes] - [Total Desc.]</code> · <code>=IF([salarioFijo] &gt; 3000000, 100000, 50000)</code>
              </div>
            </div>
          )}

          {/* Opciones de Select / Tags */}
          {type === 'select' && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                🏷️ Opciones / Etiquetas de Selección
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Nueva opción (ej. Comercial, Planta, Destacado)"
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ➕ Añadir
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', minHeight: '32px' }}>
                {options.map((opt, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                    }}
                  >
                    {opt.label}
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6366f1',
                        padding: 0,
                        fontSize: '12px',
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Impacto en liquidación */}
          {(type === 'currency' || type === 'number') && (
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Impacto en la Liquidación
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="impact"
                    value="none"
                    checked={impactsLiquidation === 'none'}
                    onChange={() => setImpactsLiquidation('none')}
                  />
                  <span>Solo informativo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="impact"
                    value="haber"
                    checked={impactsLiquidation === 'haber'}
                    onChange={() => setImpactsLiquidation('haber')}
                  />
                  <span>➕ Sumar a Haberes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="impact"
                    value="descuento"
                    checked={impactsLiquidation === 'descuento'}
                    onChange={() => setImpactsLiquidation('descuento')}
                  />
                  <span>➖ Sumar a Descuentos</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {editingColumn ? 'Guardar Cambios' : 'Crear Columna'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
