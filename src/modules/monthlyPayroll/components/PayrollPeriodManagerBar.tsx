/**
 * BARRA DE CONTROL DE PERÍODOS MENSUALES Y CIERRES CONTABLES (LABORAPY)
 *
 * Funcionalidades:
 * - Selector formal de períodos: 'MEN 08 (Agosto 2026)', 'MEN 07 (Julio 2026)'
 * - Badge de estado visual: Abierto (verde) vs Cerrado (candado inmutable)
 * - Botón "+ Nuevo Período"
 * - Botón "Replicar Mes Anterior" (arrastra plantilla y aplica novedades automáticas)
 * - Botón "Cerrar Período / Cierre Contable" (o Reabrir)
 * - Acceso directo al Modal de Novedades y Embargos Judiciales
 *
 * 100% responsivo para Web Desktop y Móviles (360px-430px).
 * Cero dependencias externas.
 */

import React, { useState } from 'react';
import type { PeriodoNomina, TipoLiquidacion, MonedaNomina } from '../types/noveltyTypes';
import { formatPeriodoFormal } from '../engine/payrollNoveltiesEngine';

interface PayrollPeriodManagerBarProps {
  empresaId: string;
  periodos: PeriodoNomina[];
  periodoSeleccionadoId: string;
  onSeleccionarPeriodo: (periodoId: string) => void;
  onCrearPeriodo: (
    anio: number,
    mes: number,
    tipoLiquidacion?: TipoLiquidacion,
    moneda?: MonedaNomina,
    empleadoSalida?: { ci: string; nombre: string; motivo: string; fechaEgreso: string },
  ) => void;
  onReplicarPeriodo: (origenId: string, destinoId: string) => void;
  onCerrarPeriodo: (periodoId: string) => void;
  onReabrirPeriodo: (periodoId: string) => void;
  onAbrirModalNovedades: () => void;
  onExportarBanco?: () => void;
  disabled?: boolean;
}

export const PayrollPeriodManagerBar: React.FC<PayrollPeriodManagerBarProps> = ({
  periodos,
  periodoSeleccionadoId,
  onSeleccionarPeriodo,
  onCrearPeriodo,
  onReplicarPeriodo,
  onCerrarPeriodo,
  onReabrirPeriodo,
  onAbrirModalNovedades,
  onExportarBanco,
  disabled = false,
}) => {
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoAnio, setNuevoAnio] = useState(new Date().getFullYear());
  const [nuevoMes, setNuevoMes] = useState(new Date().getMonth() + 1);
  const [tipoLiquidacion, setTipoLiquidacion] = useState<TipoLiquidacion>('mensual_ips');
  const [moneda, setMoneda] = useState<MonedaNomina>('PYG');
  const [empleadoSalidaCi, setEmpleadoSalidaCi] = useState('');
  const [empleadoSalidaNombre, setEmpleadoSalidaNombre] = useState('');
  const [empleadoSalidaMotivo, setEmpleadoSalidaMotivo] = useState('Renuncia voluntaria');
  const [empleadoSalidaFecha, setEmpleadoSalidaFecha] = useState(new Date().toISOString().split('T')[0]);

  const periodoActual = periodos.find((p) => p.id === periodoSeleccionadoId);
  const estaCerrado = periodoActual?.estado === 'cerrado';

  // Buscar el período cronológicamente anterior para replicación
  const periodoAnterior = [...periodos]
    .sort((a, b) => b.id.localeCompare(a.id))
    .find((p) => p.id < periodoSeleccionadoId);

  const handleCrearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCrearPeriodo(
      nuevoAnio,
      nuevoMes,
      tipoLiquidacion,
      moneda,
      tipoLiquidacion === 'liquidacion_final'
        ? {
            ci: empleadoSalidaCi.trim(),
            nombre: empleadoSalidaNombre.trim(),
            motivo: empleadoSalidaMotivo.trim(),
            fechaEgreso: empleadoSalidaFecha,
          }
        : undefined,
    );
    setMostrarModalNuevo(false);
  };

  const handleReplicar = () => {
    if (!periodoAnterior) {
      alert('No se encontró un período anterior registrado para replicar.');
      return;
    }
    const confirmado = window.confirm(
      `¿Desea replicar la nómina desde ${periodoAnterior.codigoFormal} hacia ${
        periodoActual?.codigoFormal || periodoSeleccionadoId
      }?\n\nEsto copiará la nómina y aplicará automáticamente las novedades y embargos vigentes.`,
    );
    if (confirmado) {
      onReplicarPeriodo(periodoAnterior.id, periodoSeleccionadoId);
    }
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 13px',
    borderRadius: '8px',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Barra Principal */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 8px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Selector formal y Badge de estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📅</span>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                Período Liquidación
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={periodoSeleccionadoId}
                  onChange={(e) => onSeleccionarPeriodo(e.target.value)}
                  disabled={disabled}
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {periodos.length === 0 ? (
                    <option value={periodoSeleccionadoId}>
                      {formatPeriodoFormal(periodoSeleccionadoId)}
                    </option>
                  ) : (
                    periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigoFormal} {p.estado === 'cerrado' ? '🔒' : ''}
                      </option>
                    ))
                  )}
                </select>

                {/* Badge Estado */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    backgroundColor: estaCerrado ? '#fef2f2' : '#ecfdf5',
                    color: estaCerrado ? '#991b1b' : '#065f46',
                    border: `1px solid ${estaCerrado ? '#fecaca' : '#a7f3d0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{estaCerrado ? '🔒' : '🟢'}</span>
                  <span>{estaCerrado ? 'Cerrado Contablemente' : 'Abierto (Borrador)'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones de Período y Novedades */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMostrarModalNuevo(true)}
            style={{ ...btnStyle, backgroundColor: '#f8fafc' }}
            title="Crear un nuevo período formal de liquidación"
          >
            <span>+</span>
            <span>Nuevo Período</span>
          </button>

          <button
            onClick={handleReplicar}
            disabled={disabled || estaCerrado || !periodoAnterior}
            style={{
              ...btnStyle,
              backgroundColor: '#f0fdf4',
              color: '#166534',
              borderColor: '#bbf7d0',
              opacity: disabled || estaCerrado || !periodoAnterior ? 0.5 : 1,
            }}
            title={
              periodoAnterior
                ? `Copiar nómina desde ${periodoAnterior.codigoFormal} y aplicar novedades`
                : 'No hay período anterior para replicar'
            }
          >
            <span>📋</span>
            <span>Replicar Mes Anterior</span>
          </button>

          <button
            onClick={onAbrirModalNovedades}
            style={{ ...btnStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}
            title="Administrar embargos judiciales, anticipos recurrentes y préstamos"
          >
            <span>⚖️</span>
            <span>Novedades & Embargos</span>
          </button>

          {onExportarBanco && (
            <button
              onClick={onExportarBanco}
              style={{ ...btnStyle, backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
              title="Generar y descargar archivos bancarios (SIPAP, Itaú, Sudameris)"
            >
              <span>🏦</span>
              <span>Archivo de Banco</span>
            </button>
          )}

          {estaCerrado ? (
            <button
              onClick={() => onReabrirPeriodo(periodoSeleccionadoId)}
              style={{ ...btnStyle, backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}
              title="Reabrir período para permitir correcciones"
            >
              <span>🔓</span>
              <span>Reabrir Período</span>
            </button>
          ) : (
            <button
              onClick={() => onCerrarPeriodo(periodoSeleccionadoId)}
              style={{
                ...btnStyle,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                borderColor: '#b91c1c',
                fontWeight: 700,
              }}
              title="Congelar período y amortizar saldos de embargos"
            >
              <span>🔒</span>
              <span>Cierre Contable Oficial</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Crear Nuevo Período */}
      {mostrarModalNuevo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #cbd5e1',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              ➕ Crear Nuevo Período de Liquidación
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Definí el mes, año, tipo de nómina y moneda formal en el ERP.
            </p>

            <form onSubmit={handleCrearSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tipo de Liquidación *:
                </label>
                <select
                  value={tipoLiquidacion}
                  onChange={(e) => setTipoLiquidacion(e.target.value as TipoLiquidacion)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                >
                  <option value="mensual_ips">🏢 MEN - Nómina General Cotizantes IPS</option>
                  <option value="facturacion_honorarios">📑 HON - Prestadores con Factura</option>
                  <option value="liquidacion_final">🚪 FIN - Liquidación de Salida / Egreso</option>
                  <option value="moneda_usd">💵 USD - Nómina en Dólares</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Moneda de la Nómina *:
                </label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as MonedaNomina)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="PYG">Guaraníes (PYG ₲)</option>
                  <option value="USD">Dólares Americanos (USD $)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Mes de Liquidación:
                  </label>
                  <select
                    value={nuevoMes}
                    onChange={(e) => setNuevoMes(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    {[
                      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
                    ].map((mesNombre, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {String(idx + 1).padStart(2, '0')} — {mesNombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Año:
                  </label>
                  <input
                    type="number"
                    value={nuevoAnio}
                    onChange={(e) => setNuevoAnio(Number(e.target.value))}
                    min={2020}
                    max={2035}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {tipoLiquidacion === 'liquidacion_final' && (
                <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b' }}>
                    🚪 Datos del Empleado para Liquidación Final (Baja REI/IPS y MTESS)
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Cédula de Identidad *:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 3456789"
                      value={empleadoSalidaCi}
                      onChange={(e) => setEmpleadoSalidaCi(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Nombre y Apellido *:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      value={empleadoSalidaNombre}
                      onChange={(e) => setEmpleadoSalidaNombre(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Motivo de Salida *:
                    </label>
                    <select
                      value={empleadoSalidaMotivo}
                      onChange={(e) => setEmpleadoSalidaMotivo(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                    >
                      <option value="Renuncia voluntaria">Renuncia voluntaria</option>
                      <option value="Despido justificado (Art. 81 CT)">Despido justificado (Art. 81 CT)</option>
                      <option value="Despido injustificado (Art. 91 CT)">Despido injustificado (Art. 91 CT)</option>
                      <option value="Mutuo acuerdo (Art. 78 CT)">Mutuo acuerdo (Art. 78 CT)</option>
                      <option value="Jubilación">Jubilación</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Fecha de Egreso *:
                    </label>
                    <input
                      type="date"
                      value={empleadoSalidaFecha}
                      onChange={(e) => setEmpleadoSalidaFecha(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#ffffff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Crear Período
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
