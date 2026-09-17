/**
 * CALCULADORA Y SIMULADOR INDIVIDUAL DE SALARIO MENSUAL (ERP LABORAPY)
 *
 * Implementa la liquidación punto a punto por funcionario con soporte para:
 * - Cotizantes IPS (descuento 9% obrero y 16.5% patronal)
 * - Prestadores de Servicios con Factura (IVA 10% y Retención 30% en la fuente)
 * - Normativa legal paraguaya: Ley N.º 213/93 del Código del Trabajo
 */

import React, { useState, useMemo } from 'react';
import type { EmpleadoNominaInput } from '../types';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { getEmpleadosByCliente, getEmpresaById } from '../../clientPortal/services/clientStorageService';
import {
  calcularLiquidacionMensual,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';
import { PayrollSlipModal } from './PayrollSlipModal';

// Presets con datos genéricos de simulación
const PRESETS_GENERICOS = [
  {
    label: 'Perfil Cotizante Estándar',
    desc: 'Salario Mínimo Legal · Jornada completa 30 días · 1 hijo (Bonif. Fam.)',
    data: {
      ci: '1234567',
      nombre: 'COLABORADOR EJEMPLO 1',
      cargo: 'AUXILIAR DE OPERACIONES',
      departamento: 'OPERACIONES',
      empresa: 'EMPRESA DEMO S.A.',
      tipo: 'cotizante_ips' as const,
      salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
      diasTrabajados: 30,
      diasVacaciones: 0,
      diasReposo: 0,
      diasAusencias: 0,
      adicionalCargo: 0,
      cantHoras50: 0,
      cantHoras130: 0,
      cantHoras100: 0,
      cantHorasNocturnas: 0,
      cantidadHijos: 1,
      refrigerioTraslado: 0,
      embargosJudiciales: 0,
      seguroMedicoPrivado: 0,
      anticipoSalario: 0,
      prestamosEmpresa: 0,
      faltanteCaja: 0,
      faltanteMercaderia: 0,
      telefonoNotebook: 0,
      compraCreditoEmpresa: 0,
      otrosDescuentos: 0,
    },
  },
  {
    label: 'Perfil con Horas Extras',
    desc: 'Salario Gs. 3.500.000 · 10 hs 50% · 4 hs 100% · Anticipo Gs. 500.000',
    data: {
      ci: '2345678',
      nombre: 'COLABORADOR EJEMPLO 2',
      cargo: 'ENCARGADO DE SUCURSAL',
      departamento: 'VENTAS',
      empresa: 'EMPRESA DEMO S.A.',
      tipo: 'cotizante_ips' as const,
      salarioFijo: 3500000,
      diasTrabajados: 30,
      diasVacaciones: 0,
      diasReposo: 0,
      diasAusencias: 0,
      adicionalCargo: 300000,
      cantHoras50: 10,
      cantHoras130: 0,
      cantHoras100: 4,
      cantHorasNocturnas: 0,
      cantidadHijos: 0,
      refrigerioTraslado: 0,
      embargosJudiciales: 0,
      seguroMedicoPrivado: 0,
      anticipoSalario: 500000,
      prestamosEmpresa: 0,
      faltanteCaja: 0,
      faltanteMercaderia: 0,
      telefonoNotebook: 0,
      compraCreditoEmpresa: 0,
      otrosDescuentos: 0,
    },
  },
  {
    label: 'Perfil Prestador Factura',
    desc: 'Honorarios Gs. 5.000.000 · Factura IVA 10% · Retención 30% · Sin IPS',
    data: {
      ci: '3456789',
      nombre: 'PROFESIONAL INDEPENDIENTE',
      cargo: 'CONSULTOR EXTERNO',
      departamento: 'ADMINISTRACION',
      empresa: 'EMPRESA DEMO S.A.',
      tipo: 'factura' as const,
      salarioFijo: 5000000,
      diasTrabajados: 30,
      diasVacaciones: 0,
      diasReposo: 0,
      diasAusencias: 0,
      adicionalCargo: 0,
      cantHoras50: 0,
      cantHoras130: 0,
      cantHoras100: 0,
      cantHorasNocturnas: 0,
      cantidadHijos: 0,
      refrigerioTraslado: 0,
      embargosJudiciales: 0,
      seguroMedicoPrivado: 0,
      anticipoSalario: 0,
      prestamosEmpresa: 0,
      faltanteCaja: 0,
      faltanteMercaderia: 0,
      telefonoNotebook: 0,
      compraCreditoEmpresa: 0,
      otrosDescuentos: 0,
    },
  },
];

const DEFAULT_EMPLEADO: EmpleadoNominaInput = {
  ci: '1234567',
  nombre: 'FUNCIONARIO EJEMPLO',
  cargo: 'AUXILIAR OPERATIVO',
  departamento: 'OPERACIONES',
  empresa: 'EMPRESA DEMO S.A.',
  tipo: 'cotizante_ips',
  salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
  diasTrabajados: 30,
  diasVacaciones: 0,
  diasReposo: 0,
  diasAusencias: 0,
  adicionalCargo: 0,
  cantHoras50: 0,
  cantHoras130: 0,
  cantHoras100: 0,
  cantHorasNocturnas: 0,
  cantidadHijos: 0,
  refrigerioTraslado: 0,
  embargosJudiciales: 0,
  seguroMedicoPrivado: 0,
  anticipoSalario: 0,
  prestamosEmpresa: 0,
  faltanteCaja: 0,
  faltanteMercaderia: 0,
  telefonoNotebook: 0,
  compraCreditoEmpresa: 0,
  otrosDescuentos: 0,
};

interface SinglePayrollCalculatorProps {
  empresa?: EmpresaCliente;
}

export const SinglePayrollCalculator: React.FC<SinglePayrollCalculatorProps> = ({ empresa }) => {
  const [formData, setFormData] = useState<EmpleadoNominaInput>(() => ({
    ...DEFAULT_EMPLEADO,
    empresa: empresa?.razonSocial || 'EMPRESA DEMO S.A.',
  }));
  const [periodo, setPeriodo] = useState(() =>
    new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' })
  );
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const empresaEmpleados = useMemo(() => {
    if (!empresa) return [];
    return getEmpleadosByCliente(empresa.id).filter(
      e => e.clienteId === empresa.id && e.estado !== 'inactivo'
    );
  }, [empresa]);

  // Condición fiscal de la empresa: si no es Agente de Retención, no se retiene IVA a facturadores.
  const esAgenteRetentor = useMemo(
    () => (empresa ? (getEmpresaById(empresa.id)?.esAgenteRetentor ?? true) : true),
    [empresa],
  );

  // Cálculo en tiempo real ultra rápido
  const liquidacion = useMemo(() => {
    return calcularLiquidacionMensual(formData, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor);
  }, [formData, esAgenteRetentor]);

  const updateField = <K extends keyof EmpleadoNominaInput>(field: K, value: EmpleadoNominaInput[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Si cambian vacaciones o reposo y no se forzó días manuales, auto-calcular
      if (field === 'diasVacaciones' || field === 'diasReposo') {
        const vac = Number(field === 'diasVacaciones' ? value : prev.diasVacaciones) || 0;
        const repo = Number(field === 'diasReposo' ? value : prev.diasReposo) || 0;
        next.diasTrabajados = Math.max(0, 30 - vac - repo);
      }
      return next;
    });
  };

  const handleApplyPreset = (presetData: EmpleadoNominaInput) => {
    setFormData(presetData);
  };

  const esFactura = formData.tipo === 'factura';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Barra de Simulación y Selección de Funcionario ── */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <div>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                {empresa ? `Liquidación Individual: ${empresa.razonSocial}` : 'Simulación de Perfiles Salariales:'}
              </strong>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {empresa
                  ? 'Selecciona un colaborador o carga un perfil modelo para simular'
                  : 'Prueba escenarios estándar con retenciones legales, horas extras o facturación'}
              </div>
            </div>
          </div>

          {/* Si hay empleados de la empresa, selector directo */}
          {empresaEmpleados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Cargar Funcionario:
              </label>
              <select
                onChange={(e) => {
                  const emp = empresaEmpleados.find(x => x.id === e.target.value);
                  if (emp) {
                    setFormData(prev => ({
                      ...prev,
                      ci: emp.ci,
                      nombre: `${emp.apellidos || ''}, ${emp.nombres || ''}`.trim() || emp.ci,
                      cargo: emp.cargo || 'FUNCIONARIO',
                      departamento: emp.departamento || 'OPERACIONES',
                      empresa: empresa?.razonSocial || 'EMPRESA CLIENTE S.A.',
                      tipo: emp.modalidadPago === 'factura' ? 'factura' : 'cotizante_ips',
                      salarioFijo: emp.salarioBase || SALARIO_MINIMO_LEGAL_VIGENTE,
                      cantidadHijos: emp.hijosMenores || 0,
                    }));
                  }
                }}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff' }}
              >
                <option value="">-- Seleccionar de la Ficha --</option>
                {empresaEmpleados.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.apellidos}, {emp.nombres} ({emp.ci})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PRESETS_GENERICOS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleApplyPreset(preset.data)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                title={preset.desc}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFormData(DEFAULT_EMPLEADO)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              🔄 Restablecer
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenedor Principal: Formulario a la Izquierda, Resumen a la Derecha ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* ================= FORMULARIO DE LIQUIDACIÓN ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 1. Datos Identificatorios y Régimen */}
          <section
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                1. Datos Identificatorios y Régimen Laboral
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Nombre y Apellido
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => updateField('nombre', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cédula de Identidad (CI N°)
                </label>
                <input
                  type="text"
                  value={formData.ci}
                  onChange={(e) => updateField('ci', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cargo u Ocupación
                </label>
                <input
                  type="text"
                  value={formData.cargo}
                  onChange={(e) => updateField('cargo', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Período Liquidado
                </label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="ej. Junio 2025"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              {/* Selector de Tipo de Contrato */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Tipo de Contratación (Regla de Descuento vs. Facturación)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => updateField('tipo', 'cotizante_ips')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: !esFactura ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: !esFactura ? '#eff6ff' : '#ffffff',
                      color: !esFactura ? '#1e40af' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span>🛡️ Cotizante General IPS</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 400, color: !esFactura ? '#3b82f6' : '#94a3b8' }}>
                      Aporte obrero 9% s/ Haberes Imponibles · Patronal 16.5%
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField('tipo', 'factura')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: esFactura ? '2px solid #d97706' : '1px solid #cbd5e1',
                      backgroundColor: esFactura ? '#fffbeb' : '#ffffff',
                      color: esFactura ? '#b45309' : '#64748b',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span>📑 Prestador con Factura</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 400, color: esFactura ? '#d97706' : '#94a3b8' }}>
                      Genera IVA 10% · Retención en origen 30% · IPS Gs. 0
                    </span>
                  </button>
                </div>
              </div>

              {/* Salario Fijo */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Salario FIJO Mensual Pactado (Gs.)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={formData.salarioFijo}
                    onChange={(e) => updateField('salarioFijo', Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  />
                  <div style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: '#64748b' }}>
                    Gs.
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Valor día: <strong>{formatGuaranies(liquidacion.valorDia)}</strong> · Valor hora normal: <strong>{formatGuaranies(liquidacion.valorHora)}</strong> (Base 30 d / 240 hs)
                </div>
              </div>
            </div>
          </section>

          {/* 2. Días Trabajados, Vacaciones, Reposos y Horas Extras */}
          <section
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>⏱️</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                2. Días Computables, Vacaciones, Reposos y Horas Extras
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Días Trabajados
                </label>
                <input
                  type="number"
                  value={formData.diasTrabajados ?? 30}
                  onChange={(e) => updateField('diasTrabajados', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>Base normal: 30</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Días Vacaciones
                </label>
                <input
                  type="number"
                  value={formData.diasVacaciones ?? 0}
                  onChange={(e) => updateField('diasVacaciones', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>Paga 100% día</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Días Reposo
                </label>
                <input
                  type="number"
                  value={formData.diasReposo ?? 0}
                  onChange={(e) => updateField('diasReposo', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>50% empresa</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cant. Hs 50% (Diurnas)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.cantHoras50 ?? 0}
                  onChange={(e) => updateField('cantHoras50', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cant. Hs 130% (Feriado Noct.)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.cantHoras130 ?? 0}
                  onChange={(e) => updateField('cantHoras130', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cant. Hs 100% (Feriados)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.cantHoras100 ?? 0}
                  onChange={(e) => updateField('cantHoras100', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cant. Hs Nocturnas (30%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.cantHorasNocturnas ?? 0}
                  onChange={(e) => updateField('cantHorasNocturnas', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Beneficios Adicionales: Bonificación Familiar y Plus */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Cant. de Hijos (Bonif. Fam.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.cantidadHijos ?? 0}
                  onChange={(e) => updateField('cantidadHijos', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                  5% SMLV por hijo · Exenta IPS
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Adicional por Cargo / Plus
                </label>
                <input
                  type="number"
                  value={formData.adicionalCargo ?? 0}
                  onChange={(e) => updateField('adicionalCargo', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>Suma a haberes</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Refrigerio y Traslado
                </label>
                <input
                  type="number"
                  value={formData.refrigerioTraslado ?? 0}
                  onChange={(e) => updateField('refrigerioTraslado', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>Viáticos / Subsidios</span>
              </div>
            </div>
          </section>

          {/* 3. Deducciones y Descuentos de Nómina */}
          <section
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>📉</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                3. Deducciones y Descuentos de Nómina (Lógica corporativa)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Días de Ausencias / Suspensiones
                </label>
                <input
                  type="number"
                  value={formData.diasAusencias ?? 0}
                  onChange={(e) => updateField('diasAusencias', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#ef4444' }}>
                  Descuenta {formatGuaranies(liquidacion.descuentos.descuentoAusencias)}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Anticipo de Salario / Vales
                </label>
                <input
                  type="number"
                  value={formData.anticipoSalario ?? 0}
                  onChange={(e) => updateField('anticipoSalario', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Embargos Judiciales
                </label>
                <input
                  type="number"
                  value={formData.embargosJudiciales ?? 0}
                  onChange={(e) => updateField('embargosJudiciales', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Seguro Médico Privado / Asismed
                </label>
                <input
                  type="number"
                  value={formData.seguroMedicoPrivado ?? 0}
                  onChange={(e) => updateField('seguroMedicoPrivado', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Faltante de Caja
                </label>
                <input
                  type="number"
                  value={formData.faltanteCaja ?? 0}
                  onChange={(e) => updateField('faltanteCaja', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Faltante de Mercadería / Inventario
                </label>
                <input
                  type="number"
                  value={formData.faltanteMercaderia ?? 0}
                  onChange={(e) => updateField('faltanteMercaderia', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Teléfono Corporativo / Notebook
                </label>
                <input
                  type="number"
                  value={formData.telefonoNotebook ?? 0}
                  onChange={(e) => updateField('telefonoNotebook', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Compra a Crédito Empresa (Cta Cte)
                </label>
                <input
                  type="number"
                  value={formData.compraCreditoEmpresa ?? 0}
                  onChange={(e) => updateField('compraCreditoEmpresa', Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>Descuento mercadería a crédito</span>
              </div>
            </div>
          </section>
        </div>

        {/* ================= PANEL LATERAL DE RESUMEN Y RESULTADOS ================= */}
        <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tarjeta de Resumen Principal */}
          <div
            style={{
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Resumen de Liquidación
              </span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: esFactura ? '#fef3c7' : '#dbeafe',
                  color: esFactura ? '#92400e' : '#1e40af',
                }}
              >
                {esFactura ? 'Factura con IVA' : 'Cotizante IPS 9%'}
              </span>
            </div>

            {/* Total Neto a Cobrar - Gigante */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '12px',
                backgroundColor: '#064e3b',
                color: '#ffffff',
                marginBottom: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(6, 78, 59, 0.25)',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
                Neto a Cobrar / Desembolso
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'monospace', margin: '6px 0' }}>
                {formatGuaranies(liquidacion.netoACobrar)}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>
                {formData.nombre}
              </div>
            </div>

            {/* Desglose Numérico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Total Haberes Brutos:</span>
                <strong style={{ color: '#0f172a' }}>{formatGuaranies(liquidacion.haberes.totalHaberesBrutos)}</strong>
              </div>

              {!esFactura ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>Haberes Imponibles IPS:</span>
                    <strong style={{ color: '#2563eb' }}>{formatGuaranies(liquidacion.haberesImponiblesIps)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>Aporte Obrero IPS (9%):</span>
                    <strong style={{ color: '#dc2626' }}>- {formatGuaranies(liquidacion.descuentos.aporteObreroIps)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>IVA Facturado (10%):</span>
                    <strong style={{ color: '#d97706' }}>+ {formatGuaranies(liquidacion.haberes.ivaMonto)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>Retención IVA (30% s/ IVA):</span>
                    <strong style={{ color: '#dc2626' }}>- {formatGuaranies(liquidacion.retencionIva)}</strong>
                  </div>
                </>
              )}

              {liquidacion.haberes.bonificacionFamiliar > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', color: '#15803d' }}>
                  <span>Bonificación Fam. (Exenta):</span>
                  <strong>+ {formatGuaranies(liquidacion.haberes.bonificacionFamiliar)}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#475569' }}>Total Deducciones:</span>
                <strong style={{ color: '#dc2626' }}>- {formatGuaranies(liquidacion.descuentos.totalDescuentos)}</strong>
              </div>
            </div>

            {/* Botón de Acción Principal */}
            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(true)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px 18px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
            >
              <span>📄</span>
              <span>Emitir Recibo Oficial (PDF/Imprimir)</span>
            </button>
          </div>

          {/* Tarjeta de Costo Empleador / Provisión Patronal */}
          {!esFactura && (
            <div
              style={{
                padding: '18px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                🏢 Datos de Carga Patronal & Provisiones:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Aporte Patronal IPS (16.5%):</span>
                <strong style={{ color: '#0f172a' }}>{formatGuaranies(liquidacion.aportePatronalIps)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Provisión Mensual Aguinaldo:</span>
                <strong style={{ color: '#0f172a' }}>{formatGuaranies(liquidacion.provisionAguinaldoMensual)}</strong>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#334155', fontWeight: 600 }}>Costo Total Empresa:</span>
                <strong style={{ color: '#0f172a' }}>
                  {formatGuaranies(liquidacion.haberes.totalHaberesBrutos + liquidacion.aportePatronalIps)}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Recibo Oficial Imprimible */}
      <PayrollSlipModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        liquidacion={liquidacion}
        empresaNombre={formData.empresa || 'EMPRESA CLIENTE S.A.'}
        periodo={periodo}
      />
    </div>
  );
};
