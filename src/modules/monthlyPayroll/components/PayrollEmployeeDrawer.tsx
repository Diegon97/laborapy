import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import type { EmpleadoNominaInput, GridColumnDef, LiquidacionMensualResult } from '../types';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import {
  calcularLiquidacionMensual,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';
import { loadNovedadesEmpresa } from '../services/payrollNoveltiesStorage';

export interface PayrollEmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  empleado: EmpleadoNominaInput | null;
  empleadoIndex: number;
  totalEmpleados: number;
  onUpdateEmpleado: (index: number, updated: EmpleadoNominaInput) => void;
  onNavigate: (newIndex: number) => void;
  customColumns: GridColumnDef[];
  empresa?: EmpresaCliente;
  onOpenNovelties?: (ci: string) => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const PayrollEmployeeDrawer: React.FC<PayrollEmployeeDrawerProps> = ({
  isOpen,
  onClose,
  empleado,
  empleadoIndex,
  totalEmpleados,
  onUpdateEmpleado,
  onNavigate,
  customColumns,
  empresa,
  onOpenNovelties,
}) => {
  const esAgenteRetentor = Boolean(empresa?.esAgenteRetentor ?? true);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const liquidacion: LiquidacionMensualResult | null = useMemo(() => {
    if (!empleado) return null;
    return calcularLiquidacionMensual(empleado, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor);
  }, [empleado, esAgenteRetentor]);

  const novedadesEmpleado = useMemo(() => {
    if (!empresa?.id || !empleado?.ci) return [];
    const todas = loadNovedadesEmpresa(empresa.id);
    return todas.filter((n) => n.ci.trim() === empleado.ci.trim());
  }, [empresa?.id, empleado?.ci, isOpen]);

  const editableCustomCols = useMemo(
    () => customColumns.filter((c) => c.isCustom && c.type !== 'formula'),
    [customColumns]
  );

  const updateField = useCallback(
    <K extends keyof EmpleadoNominaInput>(field: K, value: EmpleadoNominaInput[K]) => {
      if (!empleado) return;
      onUpdateEmpleado(empleadoIndex, { ...empleado, [field]: value });
    },
    [empleado, empleadoIndex, onUpdateEmpleado]
  );

  const updateCustomField = useCallback(
    (colId: string, value: string | number) => {
      if (!empleado) return;
      const currentCustom = empleado.customFields || {};
      onUpdateEmpleado(empleadoIndex, {
        ...empleado,
        customFields: { ...currentCustom, [colId]: value },
      });
    },
    [empleado, empleadoIndex, onUpdateEmpleado]
  );

  const isFirst = empleadoIndex <= 0;
  const isLast = empleadoIndex >= totalEmpleados - 1;

  const handleNext = useCallback(() => {
    if (!isLast) onNavigate(empleadoIndex + 1);
    else onClose();
  }, [isLast, empleadoIndex, onNavigate, onClose]);

  const handlePrev = useCallback(() => {
    if (!isFirst) onNavigate(empleadoIndex - 1);
  }, [isFirst, empleadoIndex, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, handleNext]);

  if (!isOpen || !empleado || !liquidacion) return null;

  const initials = (empleado.nombre || 'F')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              {initials}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{empleado.nombre}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                CI: {empleado.ci} · {empleado.cargo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '18px',
              cursor: 'pointer',
            }}
            aria-label="Cerrar panel"
          >
            ✕
          </button>
        </div>

        {/* Tarjeta de Cálculo en Vivo */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
          }}
        >
          <div style={{ padding: '8px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Haberes</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              {formatGuaranies(liquidacion.haberes.totalHaberesBrutos)}
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>IPS 9% Obrero</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>
              -{formatGuaranies(liquidacion.descuentos.aporteObreroIps)}
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Descuentos</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>
              -{formatGuaranies(liquidacion.descuentos.totalDescuentos)}
            </div>
          </div>
          <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>Neto a Cobrar</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#15803d' }}>
              {formatGuaranies(liquidacion.netoACobrar)}
            </div>
          </div>
        </div>

        {/* Formulario Modular */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Asistencia */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>📅 Asistencia</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => updateField('diasTrabajados', 30)}
                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  30 días
                </button>
                <button
                  type="button"
                  onClick={() => updateField('diasTrabajados', 15)}
                  style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                >
                  15 días
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Días Trab.</label>
                <input
                  type="number"
                  value={empleado.diasTrabajados ?? 30}
                  onChange={(e) => updateField('diasTrabajados', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Días Vacac.</label>
                <input
                  type="number"
                  value={empleado.diasVacaciones ?? 0}
                  onChange={(e) => updateField('diasVacaciones', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Días Reposo</label>
                <input
                  type="number"
                  value={empleado.diasReposo ?? 0}
                  onChange={(e) => updateField('diasReposo', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Días Ausenc.</label>
                <input
                  type="number"
                  value={empleado.diasAusencias ?? 0}
                  onChange={(e) => updateField('diasAusencias', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Haberes */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>💰 Haberes y Extras</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Salario Fijo</label>
                <input
                  type="number"
                  value={empleado.salarioFijo ?? 0}
                  onChange={(e) => updateField('salarioFijo', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Adic. Cargo</label>
                <input
                  type="number"
                  value={empleado.adicionalCargo ?? 0}
                  onChange={(e) => updateField('adicionalCargo', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Hs 50%</label>
                <input
                  type="number"
                  step="0.5"
                  value={empleado.cantHoras50 ?? 0}
                  onChange={(e) => updateField('cantHoras50', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Hs 130%</label>
                <input
                  type="number"
                  step="0.5"
                  value={empleado.cantHoras130 ?? 0}
                  onChange={(e) => updateField('cantHoras130', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Hs 100%</label>
                <input
                  type="number"
                  step="0.5"
                  value={empleado.cantHoras100 ?? 0}
                  onChange={(e) => updateField('cantHoras100', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Hs Nocturnas</label>
                <input
                  type="number"
                  step="0.5"
                  value={empleado.cantHorasNocturnas ?? 0}
                  onChange={(e) => updateField('cantHorasNocturnas', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Hijos</label>
                <input
                  type="number"
                  value={empleado.cantidadHijos ?? 0}
                  onChange={(e) => updateField('cantidadHijos', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Refrigerio</label>
                <input
                  type="number"
                  value={empleado.refrigerioTraslado ?? 0}
                  onChange={(e) => updateField('refrigerioTraslado', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Descuentos */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>📉 Descuentos</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Anticipo</label>
                <input
                  type="number"
                  value={empleado.anticipoSalario ?? 0}
                  onChange={(e) => updateField('anticipoSalario', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Préstamos</label>
                <input
                  type="number"
                  value={empleado.prestamosEmpresa ?? 0}
                  onChange={(e) => updateField('prestamosEmpresa', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Embargos Judic.</label>
                <input
                  type="number"
                  value={empleado.embargosJudiciales ?? 0}
                  onChange={(e) => updateField('embargosJudiciales', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Seg. Médico</label>
                <input
                  type="number"
                  value={empleado.seguroMedicoPrivado ?? 0}
                  onChange={(e) => updateField('seguroMedicoPrivado', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Faltante Caja</label>
                <input
                  type="number"
                  value={empleado.faltanteCaja ?? 0}
                  onChange={(e) => updateField('faltanteCaja', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Otros Desc.</label>
                <input
                  type="number"
                  value={empleado.otrosDescuentos ?? 0}
                  onChange={(e) => updateField('otrosDescuentos', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Novedades y Embargos Activos */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚡ Novedades & Embargos ({novedadesEmpleado.length})
              </span>
              {onOpenNovelties && (
                <button
                  type="button"
                  onClick={() => onOpenNovelties(empleado.ci)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #93c5fd',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ➕ Nueva Novedad
                </button>
              )}
            </div>

            {novedadesEmpleado.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                Sin novedades ni embargos activos para este funcionario.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {novedadesEmpleado.map((nov) => {
                  const tieneSaldo = typeof nov.saldoPendiente === 'number' && typeof nov.montoOriginal === 'number' && nov.montoOriginal > 0;
                  const pctAmortizado = tieneSaldo
                    ? Math.min(100, Math.max(0, ((nov.montoOriginal! - nov.saldoPendiente!) / nov.montoOriginal!) * 100))
                    : 0;

                  return (
                    <div
                      key={nov.id}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>
                            {nov.tipoConcepto === 'haber' ? '🌟' : '⚖️'} {nov.descripcion}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: nov.modalidadCalculo === 'porcentaje_variable' ? '#eff6ff' : '#f1f5f9',
                              color: nov.modalidadCalculo === 'porcentaje_variable' ? '#1d4ed8' : '#475569',
                            }}
                          >
                            {nov.modalidadCalculo === 'porcentaje_variable'
                              ? `${nov.porcentajeVariable ?? 25}% Variable`
                              : nov.cuotaMensual
                              ? formatGuaranies(nov.cuotaMensual)
                              : 'Fijo'}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: nov.activo ? '#dcfce7' : '#fee2e2',
                            color: nov.activo ? '#166534' : '#991b1b',
                          }}
                        >
                          {nov.activo ? 'Activo' : 'Pausado'}
                        </span>
                      </div>

                      {tieneSaldo && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b', marginBottom: '2px' }}>
                            <span>Saldo: <strong style={{ color: '#0f172a' }}>{formatGuaranies(nov.saldoPendiente!)}</strong></span>
                            <span>Deuda: {formatGuaranies(nov.montoOriginal!)} ({pctAmortizado.toFixed(0)}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pctAmortizado}%`,
                                height: '100%',
                                backgroundColor: pctAmortizado >= 100 ? '#10b981' : '#3b82f6',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columnas Personalizadas */}
          {editableCustomCols.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>✨ Campos Personalizados</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {editableCustomCols.map((col) => (
                  <div key={col.id}>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>{col.label}</label>
                    <input
                      type={col.type === 'number' || col.type === 'currency' ? 'number' : 'text'}
                      value={empleado.customFields?.[col.id] ?? ''}
                      onChange={(e) =>
                        updateCustomField(
                          col.id,
                          col.type === 'number' || col.type === 'currency'
                            ? Number(e.target.value) || 0
                            : e.target.value
                        )
                      }
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={isFirst}
              onClick={handlePrev}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: isFirst ? '#f1f5f9' : '#ffffff',
                color: isFirst ? '#94a3b8' : '#334155',
                cursor: isFirst ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ◀ Anterior
            </button>
            <span style={{ fontSize: '12px', color: '#64748b', alignSelf: 'center' }}>
              {empleadoIndex + 1} / {totalEmpleados}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {isLast ? 'Guardar y Listo ✓' : 'Guardar y Siguiente ➡️'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
