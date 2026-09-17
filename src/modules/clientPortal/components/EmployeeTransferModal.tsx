/**
 * MODAL: TRASLADO DE SUCURSAL Y LUGAR DE TRABAJO — ERP LABORAPY
 * Permite cambiar la sucursal de un funcionario, actualizar su lugar de trabajo y departamento geográfico,
 * asentar la adenda contractual y generar de inmediato la Nota Oficial de Traslado en PDF.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { EmpresaCliente, Empleado, AdendaContrato } from '../types/clientPortal';
import {
  DEPARTAMENTOS_PARAGUAY,
  buildSucursalesOptions,
  getSucursalById,
  type SucursalOption,
} from '../types/clientPortal';
import {
  saveEmpleado,
  saveAdendaContrato,
  getSiguienteNroAdenda,
} from '../services/clientStorageService';
import { descargarNotaTrasladoPDF } from '../generators/transferNoticePdfGenerator';

export interface EmployeeTransferModalProps {
  isOpen: boolean;
  empleado: Empleado | null;
  empresa: EmpresaCliente;
  onClose: () => void;
  onTransferSuccess?: (empleadoActualizado: Empleado) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const EmployeeTransferModal: React.FC<EmployeeTransferModalProps> = ({
  isOpen,
  empleado,
  empresa,
  onClose,
  onTransferSuccess,
}) => {
  const sucursales = useMemo(() => buildSucursalesOptions(empresa), [empresa]);

  const sucursalActual: SucursalOption = useMemo(() => {
    if (!empleado) return sucursales[0];
    return getSucursalById(empresa, empleado.sucursalId);
  }, [empleado, empresa, sucursales]);

  const [sucursalDestinoId, setSucursalDestinoId] = useState<string>('');
  const [lugarTrabajoNuevo, setLugarTrabajoNuevo] = useState<string>('');
  const [departamentoNuevo, setDepartamentoNuevo] = useState<string>('Central');
  const [fechaVigencia, setFechaVigencia] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<string>('Necesidades operativas y organizativas de la empresa');
  const [compensacion, setCompensacion] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Inicializar valores al abrir
  useEffect(() => {
    if (isOpen && empleado) {
      // Elegir por defecto la primera sucursal destino que sea diferente a la actual
      const otraSucursal = sucursales.find(s => s.id !== (empleado.sucursalId || 'principal'));
      const idInicial = otraSucursal ? otraSucursal.id : 'principal';
      setSucursalDestinoId(idInicial);

      const target = sucursales.find(s => s.id === idInicial);
      setLugarTrabajoNuevo(target ? target.direccion || target.ciudad || target.label : '');
      setDepartamentoNuevo(target?.departamento || empleado.departamentoGeografico || 'Central');
      setFechaVigencia(new Date().toISOString().slice(0, 10));
      setMotivo('Necesidades operativas y organizativas de la empresa');
      setCompensacion('0');
      setError(null);
    }
  }, [isOpen, empleado, sucursales]);

  // Al cambiar la sucursal destino, sugerir automáticamente su lugar y departamento
  const handleSucursalDestinoChange = (id: string) => {
    setSucursalDestinoId(id);
    const target = sucursales.find(s => s.id === id);
    if (target) {
      setLugarTrabajoNuevo(target.direccion || target.ciudad || target.label);
      if (target.departamento) {
        setDepartamentoNuevo(target.departamento);
      }
    }
  };

  const sucursalDestino = useMemo(() => {
    return sucursales.find(s => s.id === sucursalDestinoId) || null;
  }, [sucursales, sucursalDestinoId]);

  if (!isOpen || !empleado) return null;

  const handleConfirmarTraslado = () => {
    setError(null);

    if (!sucursalDestino) {
      setError('Por favor selecciona una sucursal de destino.');
      return;
    }

    if (sucursalDestino.id === (empleado.sucursalId || 'principal')) {
      setError('La sucursal de destino debe ser diferente a la sucursal actual.');
      return;
    }

    if (!lugarTrabajoNuevo.trim()) {
      setError('El nuevo lugar de trabajo es obligatorio.');
      return;
    }

    if (!fechaVigencia) {
      setError('La fecha efectiva de vigencia del traslado es obligatoria.');
      return;
    }

    setProcesando(true);

    try {
      // 1) Actualizar el empleado
      const empleadoActualizado: Empleado = {
        ...empleado,
        sucursalId: sucursalDestino.id === 'principal' ? undefined : sucursalDestino.id,
        lugarTrabajo: lugarTrabajoNuevo.trim(),
        departamentoGeografico: departamentoNuevo,
      };

      saveEmpleado(empleadoActualizado);

      // 2) Registrar Adenda Contractual para trazabilidad histórica
      const proximoNro = getSiguienteNroAdenda(empresa.id, empleado.id);
      const compensacionNum = parseFloat(compensacion.replace(/\D/g, '')) || 0;

      const adenda: AdendaContrato = {
        id: `adenda_${Date.now()}`,
        clienteId: empresa.id,
        empleadoId: empleado.id,
        fechaContratoOriginal: empleado.fechaIngreso,
        nroAdenda: proximoNro,
        motivo: 'traslado_sucursal',
        tituloAdenda: `Adenda N.º ${proximoNro} — Traslado de Lugar de Trabajo`,
        fechaEmision: new Date().toISOString().slice(0, 10),
        fechaVigencia,
        lugarAnterior: empleado.lugarTrabajo || sucursalActual.label,
        nuevoLugar: `${sucursalDestino.label} (${lugarTrabajoNuevo.trim()})`,
        compensacionTraslado: compensacionNum > 0 ? `Gs. ${compensacionNum.toLocaleString('es-PY')}` : 'Sin asignación adicional',
        clausulasEspecificas: `Se traslada la prestación de servicios a ${sucursalDestino.label}. Motivo: ${motivo.trim()}. Se garantiza la intangibilidad salarial conforme al Art. 81 del Código Laboral.`,
        estado: 'firmado',
        createdAt: new Date().toISOString(),
      };

      saveAdendaContrato(adenda);

      // 3) Generar y descargar la Nota Oficial de Traslado en PDF
      descargarNotaTrasladoPDF({
        empresa,
        empleado: empleadoActualizado,
        sucursalOrigenLabel: sucursalActual.label,
        sucursalDestinoLabel: sucursalDestino.label,
        lugarTrabajoAnterior: empleado.lugarTrabajo || sucursalActual.direccion || 'Establecimiento Principal',
        lugarTrabajoNuevo: lugarTrabajoNuevo.trim(),
        departamentoGeograficoNuevo: departamentoNuevo,
        fechaVigencia,
        motivoTraslado: motivo.trim(),
        compensacionTraslado: compensacionNum,
        ciudadEmision: empresa.ciudad || 'Asunción',
        nroPatronalMtessDestino: sucursalDestino.nroPatronalMtess,
        nroPatronalIpsDestino: sucursalDestino.nroPatronalIps,
      });

      if (onTransferSuccess) {
        onTransferSuccess(empleadoActualizado);
      }

      onClose();
    } catch (err: any) {
      console.error('[EmployeeTransferModal] error al trasladar:', err);
      setError('Ocurrió un error al procesar el traslado: ' + (err?.message || String(err)));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🔄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Mudar de Sucursal y Lugar de Trabajo
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#bfdbfe' }}>
                Reasignación laboral formal con emisión de Nota de Traslado legal (Art. 81 C.T.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body con Scroll ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#991b1b',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Tarjeta del Funcionario y Sucursal Actual */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Colaborador Notificado
              </span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {empleado.nombres} {empleado.apellidos}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                C.I. N.° {empleado.ci} · Cargo: <strong>{empleado.cargo}</strong>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Sucursal Actual
              </span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                {sucursalActual.label}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Lugar: {empleado.lugarTrabajo || 'Establecimiento Principal'} ({empleado.departamentoGeografico || 'Central'})
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                MTESS: <strong>{sucursalActual.nroPatronalMtess || 'Casa Central'}</strong> · IPS: <strong>{sucursalActual.nroPatronalIps || 'Casa Central'}</strong>
              </div>
            </div>
          </div>

          {/* Selector de Sucursal Destino */}
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '16px 18px',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏬</span> Seleccionar Nueva Sucursal de Destino
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
              <div style={{ gridColumn: 'span 12' }}>
                <label style={labelStyle}>Sucursal Destino *</label>
                <select
                  value={sucursalDestinoId}
                  onChange={e => handleSucursalDestinoChange(e.target.value)}
                  style={{
                    ...inputStyle,
                    fontWeight: 700,
                    color: '#1e3a8a',
                    cursor: 'pointer',
                  }}
                >
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.label} [MTESS: {s.nroPatronalMtess || 'N/A'}] [IPS: {s.nroPatronalIps || 'N/A'}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 7' }}>
                <label style={labelStyle}>Nuevo Lugar Físico de Trabajo *</label>
                <input
                  type="text"
                  value={lugarTrabajoNuevo}
                  onChange={e => setLugarTrabajoNuevo(e.target.value)}
                  placeholder="Ej. Sede Shopping del Este - Piso 2"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: 'span 5' }}>
                <label style={labelStyle}>Departamento Geográfico *</label>
                <select
                  value={departamentoNuevo}
                  onChange={e => setDepartamentoNuevo(e.target.value)}
                  style={inputStyle}
                >
                  {DEPARTAMENTOS_PARAGUAY.map(dep => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Condiciones Legales del Traslado */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px 18px',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚖️</span> Condiciones Operativas y Salario (Art. 81 Ley 213/93)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Fecha Efectiva del Traslado *</label>
                <input
                  type="date"
                  value={fechaVigencia}
                  onChange={e => setFechaVigencia(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Compensación / Viático (Gs.)</label>
                <input
                  type="text"
                  value={compensacion}
                  onChange={e => setCompensacion(e.target.value)}
                  placeholder="0 si mantiene condiciones"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: 'span 4' }}>
                <label style={labelStyle}>Condición Salarial</label>
                <input
                  type="text"
                  value="Intangible (Sin menoscabo)"
                  disabled
                  style={{ ...inputStyle, background: '#f8fafc', color: '#15803d', fontWeight: 700 }}
                />
              </div>

              <div style={{ gridColumn: 'span 12' }}>
                <label style={labelStyle}>Motivo / Justificación Operativa</label>
                <input
                  type="text"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej: Refuerzo operativo de la sede Ciudad del Este, solicitud voluntaria, etc."
                  style={inputStyle}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  Aparecerá redactado en la cláusula formal de la Nota de Traslado.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer de Acciones ── */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
            ℹ️ Al confirmar, se actualizará el legajo del colaborador y se descargará la Nota en PDF.
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={procesando}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmarTraslado}
              disabled={procesando}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: procesando ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <span>{procesando ? 'Procesando...' : '📄 Confirmar Traslado y Descargar PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
