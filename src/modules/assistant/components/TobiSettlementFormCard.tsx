/**
 * FORMULARIO INTERACTIVO DE CASILLAS PARA LIQUIDACIÓN — LABORAPY
 *
 * Permite al usuario completar las casillas de liquidación (salario mensual,
 * fechas de ingreso y egreso, motivo, preaviso y RÉGIMEN CONTRACTUAL: IPS vs Factura)
 * directamente en el chat para calcular la liquidación oficial al instante según la Ley 213/93.
 */

import React, { useState } from 'react';
import type { TobiSettlementActionPayload } from '../types';
import type { MotivoEgreso, RegimenIPS } from '../../payroll/types';

export interface TobiSettlementFormCardProps {
  readonly defaultSalario?: number;
  readonly onSubmit: (payload: TobiSettlementActionPayload) => void;
  readonly onCancel?: () => void;
  readonly isMobile?: boolean;
}

export const TobiSettlementFormCard: React.FC<TobiSettlementFormCardProps> = ({
  defaultSalario = 3044000,
  onSubmit,
  onCancel,
  isMobile = false,
}) => {
  const [salarioMensual, setSalarioMensual] = useState<number>(defaultSalario);
  const [fechaIngreso, setFechaIngreso] = useState<string>('2023-01-15');
  const [fechaEgreso, setFechaEgreso] = useState<string>(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<MotivoEgreso>('despido_sin_causa');
  const [regimen, setRegimen] = useState<RegimenIPS>('general');
  const [preavisoOtorgado, setPreavisoOtorgado] = useState<boolean>(false);
  const [nombreEmpleado, setNombreEmpleado] = useState<string>('');
  const [ciEmpleado, setCiEmpleado] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salarioMensual || salarioMensual < 100000) {
      setErrorMsg('Ingresá un salario mensual válido.');
      return;
    }
    if (!fechaIngreso || !fechaEgreso) {
      setErrorMsg('Las fechas de ingreso y egreso son obligatorias.');
      return;
    }
    if (new Date(fechaIngreso) > new Date(fechaEgreso)) {
      setErrorMsg('La fecha de ingreso no puede ser posterior a la de egreso.');
      return;
    }

    const payload: TobiSettlementActionPayload = {
      salarioMensual,
      fechaIngreso,
      fechaEgreso,
      motivo,
      regimen,
      preavisoOtorgado,
      preavisoObligado: motivo === 'renuncia' ? 'trabajador' : 'empleador',
      nombreEmpleado: nombreEmpleado.trim() || undefined,
      ciEmpleado: ciEmpleado.trim() || undefined,
      tieneVariables: false,
    };

    onSubmit(payload);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    fontSize: 12.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: 3,
    display: 'block',
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 14,
        background: 'linear-gradient(145deg, #090e1a 0%, #172238 100%)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        padding: isMobile ? 12 : 16,
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#a7f3d0' }}>
            Completar datos de liquidación y calcular
          </span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: '6px 10px', marginBottom: 10, borderRadius: 6, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: 11.5 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Régimen Contractual (IPS vs Factura Art. 19 C.T.) */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Régimen de Seguro Social y Contrato (¿IPS o Factura?):</label>
        <select
          value={regimen}
          onChange={(e) => setRegimen(e.target.value as RegimenIPS)}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            borderColor: regimen === 'factura' ? '#f59e0b' : 'rgba(16, 185, 129, 0.4)',
            color: regimen === 'factura' ? '#fef08a' : '#ffffff',
            fontWeight: 600,
          }}
        >
          <option value="general">💼 En planilla formal con seguro social IPS (con descuento del 9%)</option>
          <option value="factura">📄 Facturación con RUC / Sin IPS (Primacía de la Realidad Art. 19 C.T. - Sin descuento de IPS)</option>
        </select>
        {regimen === 'factura' && (
          <div style={{ padding: '6px 10px', marginTop: 6, borderRadius: 6, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#fef3c7', fontSize: 11, lineHeight: 1.4 }}>
            ⚖️ <strong>Primacía de la Realidad (Art. 19 C.T.):</strong> Al haber prestado servicios con factura sin IPS bajo subordinación o cumplimiento de horario, la ley paraguaya te protege: <strong>NO se te descuenta el 9% de IPS en la liquidación</strong> y tenés derecho a cobrar indemnización, preaviso y aguinaldo completo.
          </div>
        )}
      </div>

      {/* Salario mensual */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Salario Mensual Bruto (Gs.) *</label>
        <input
          type="number"
          min={0}
          step="any"
          required
          value={salarioMensual || ''}
          onChange={(e) => setSalarioMensual(parseInt(e.target.value, 10) || 0)}
          style={{ ...inputStyle, fontWeight: 700, color: '#34d399' }}
        />
        <span style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, display: 'block' }}>
          Salario mínimo legal vigente: Gs. 3.044.000
        </span>
      </div>

      {/* Fechas de ingreso y egreso */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Fecha de Ingreso *</label>
          <input
            type="date"
            required
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Fecha de Egreso / Desvinculación *</label>
          <input
            type="date"
            required
            value={fechaEgreso}
            onChange={(e) => setFechaEgreso(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Motivo de Egreso */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Motivo de la Desvinculación:</label>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoEgreso)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="despido_sin_causa">Despido Injustificado / Sin Causa (Art. 84 - Indemnización + Preaviso)</option>
          <option value="despido_con_causa">Despido Justificado con Causa Comprobada (Art. 81 - Sin indemnización)</option>
          <option value="renuncia">Renuncia Voluntaria del Trabajador</option>
          <option value="retiro_justificado">Retiro Justificado por Falta Patronal (Art. 85)</option>
          <option value="mutuo_acuerdo">Mutuo Acuerdo entre Partes</option>
          <option value="periodo_prueba">Terminación durante Período de Prueba</option>
        </select>
      </div>

      {/* Preaviso otorgado */}
      {motivo === 'despido_sin_causa' && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="chkPreaviso"
            checked={preavisoOtorgado}
            onChange={(e) => setPreavisoOtorgado(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="chkPreaviso" style={{ fontSize: 12, color: '#e2e8f0', cursor: 'pointer' }}>
            ¿El empleador le dio el preaviso trabajado con antelación?
          </label>
        </div>
      )}

      {/* Nombre y CI opcionales */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Nombre del Colaborador (opcional)</label>
          <input
            type="text"
            placeholder="Ej: Juan Pérez"
            value={nombreEmpleado}
            onChange={(e) => setNombreEmpleado(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Cédula C.I. (opcional)</label>
          <input
            type="text"
            placeholder="Ej: 4.123.456"
            value={ciEmpleado}
            onChange={(e) => setCiEmpleado(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          }}
        >
          <span>⚡</span>
          <span>Calcular Liquidación al toque</span>
        </button>
      </div>
    </form>
  );
};
