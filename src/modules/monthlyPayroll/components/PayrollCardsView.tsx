import React, { useMemo } from 'react';
import type { EmpleadoNominaInput } from '../types';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import {
  calcularLiquidacionMensual,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';

export interface PayrollCardsViewProps {
  empleados: EmpleadoNominaInput[];
  onUpdateEmpleado: (index: number, updated: EmpleadoNominaInput) => void;
  onOpenDrawer: (index: number) => void;
  onDeleteEmpleado: (index: number) => void;
  empresa?: EmpresaCliente;
}

const AVATAR_BG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const PayrollCardsView: React.FC<PayrollCardsViewProps> = ({
  empleados,
  onUpdateEmpleado,
  onOpenDrawer,
  onDeleteEmpleado,
  empresa,
}) => {
  const esAgenteRetentor = Boolean(empresa?.esAgenteRetentor ?? true);

  const liquidaciones = useMemo(
    () => empleados.map((emp) => calcularLiquidacionMensual(emp, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor)),
    [empleados, esAgenteRetentor]
  );

  const getInitials = (nombre: string) => {
    return (nombre || 'F')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
      {empleados.map((emp, index) => {
        const liq = liquidaciones[index];
        const color = AVATAR_BG_COLORS[index % AVATAR_BG_COLORS.length];
        const isNegativo = liq ? liq.netoACobrar < 0 : false;
        const neto = liq ? liq.netoACobrar : 0;

        return (
          <div
            key={emp.ci || `emp-${index}`}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Header Tarjeta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {getInitials(emp.nombre)}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {emp.nombre}
                  </h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    CI: {emp.ci} · {emp.cargo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`¿Eliminar a ${emp.nombre} de la nómina?`)) {
                    onDeleteEmpleado(index);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#94a3b8',
                }}
                title="Eliminar funcionario"
              >
                🗑️
              </button>
            </div>

            {/* Salario Fijo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
              <span style={{ color: '#64748b' }}>Salario Fijo:</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{formatGuaranies(emp.salarioFijo)}</span>
            </div>

            {/* Inputs Inline Rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Días Trab.</label>
                <input
                  type="number"
                  value={emp.diasTrabajados ?? 30}
                  onChange={(e) => onUpdateEmpleado(index, { ...emp, diasTrabajados: Number(e.target.value) })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Hs 50%</label>
                <input
                  type="number"
                  step="0.5"
                  value={emp.cantHoras50 ?? 0}
                  onChange={(e) => onUpdateEmpleado(index, { ...emp, cantHoras50: Number(e.target.value) })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Anticipo</label>
                <input
                  type="number"
                  value={emp.anticipoSalario ?? 0}
                  onChange={(e) => onUpdateEmpleado(index, { ...emp, anticipoSalario: Number(e.target.value) })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Neto en Guaraníes & Botón Drawer */}
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Neto a Cobrar:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: isNegativo ? '#dc2626' : '#059669' }}>
                  {formatGuaranies(neto)}
                </span>
              </div>
              <button
                onClick={() => onOpenDrawer(index)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⚡ Ficha Completa
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
