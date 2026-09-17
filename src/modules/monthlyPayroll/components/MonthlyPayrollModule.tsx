/**
 * MÓDULO DE LIQUIDACIÓN Y PAGO DE SALARIO MENSUAL (LABORAPY)
 *
 * Módulo integral basado en la lógica y fórmulas corporativas de la hoja NOMINA GRAL.
 * Permite tanto la simulación y liquidación individual como la gestión de planillas generales de nómina de empresas.
 */

import React, { useState } from 'react';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { SinglePayrollCalculator } from './SinglePayrollCalculator';
import { BatchPayrollTable } from './BatchPayrollTable';
import { ExcelPayrollGrid } from './ExcelPayrollGrid';
import { PayrollClosingDashboard } from './PayrollClosingDashboard';
import { SALARIO_MINIMO_LEGAL_VIGENTE, formatGuaranies } from '../engine/monthlyPayrollEngine';

interface Props {
  empresa?: EmpresaCliente;
}

export const MonthlyPayrollModule: React.FC<Props> = ({ empresa }) => {
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'batch' | 'excel' | 'cierre' | 'legal'>(
    empresa ? 'batch' : 'individual'
  );

  return (
    <div style={{ maxWidth: activeSubTab === 'excel' ? '100%' : '1280px', margin: '0 auto', padding: activeSubTab === 'excel' ? '12px 4px' : '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ── Encabezado del Módulo con Contexto ERP ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '22px 26px',
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
          borderRadius: '16px',
          color: '#ffffff',
          boxShadow: '0 8px 20px -4px rgba(6, 78, 59, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              backdropFilter: 'blur(8px)',
            }}
          >
            💵
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Liquidación y Pago de Salario Mensual
              </h1>
              {empresa ? (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    backgroundColor: '#fef08a',
                    color: '#854d0e',
                    textTransform: 'uppercase',
                  }}
                >
                  🏢 {empresa.razonSocial}
                </span>
              ) : (
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#34d399',
                    color: '#064e3b',
                    textTransform: 'uppercase',
                  }}
                >
                  Nómina General
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
              {empresa
                ? `RUC: ${empresa.ruc}${empresa.dv ? `-${empresa.dv}` : ''} · Patronal IPS: ${empresa.nroPatronalIps || 'Asignada'} · Solo empleados vinculados a esta empresa`
                : 'Cálculo legal exacto para Cotizantes IPS (9% obrero / 16.5% patronal) y Prestadores con Factura (IVA 10% y Retención 30%).'}
            </p>
          </div>
        </div>

        {/* Badge de SMLV Vigente */}
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '11px', opacity: 0.8 }}>Salario Mínimo Legal Vigente:</div>
          <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace' }}>
            {formatGuaranies(SALARIO_MINIMO_LEGAL_VIGENTE)}
          </div>
          <div style={{ fontSize: '10px', color: '#a7f3d0' }}>Vigente hasta junio 2027 · Base 30 días · 240 hs</div>
        </div>
      </div>

      {/* ── Selector de Subpestañas ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => setActiveSubTab('individual')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubTab === 'individual' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'individual' ? '#065f46' : '#64748b',
            fontWeight: activeSubTab === 'individual' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🧮</span>
          <span>Calculadora & Simulador Individual</span>
        </button>

        <button
          onClick={() => setActiveSubTab('batch')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubTab === 'batch' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'batch' ? '#065f46' : '#64748b',
            fontWeight: activeSubTab === 'batch' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📊</span>
          <span>Planilla General de Nómina (Empresa)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('excel')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubTab === 'excel' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'excel' ? '#065f46' : '#64748b',
            fontWeight: activeSubTab === 'excel' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📗</span>
          <span>Planilla Editable (Excel)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cierre')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubTab === 'cierre' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'cierre' ? '#065f46' : '#64748b',
            fontWeight: activeSubTab === 'cierre' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🔒</span>
          <span>Cierre Mensual</span>
        </button>

        <button
          onClick={() => setActiveSubTab('legal')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeSubTab === 'legal' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeSubTab === 'legal' ? '#065f46' : '#64748b',
            fontWeight: activeSubTab === 'legal' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📖</span>
          <span>Guía de Fórmulas & Base Legal</span>
        </button>
      </div>

      {/* ── Contenido de las Pestañas ── */}
      {activeSubTab === 'individual' && <SinglePayrollCalculator empresa={empresa} />}
      {activeSubTab === 'batch' && <BatchPayrollTable empresa={empresa} />}
      {activeSubTab === 'excel' && <ExcelPayrollGrid empresa={empresa} />}
      {activeSubTab === 'cierre' && <PayrollClosingDashboard empresa={empresa} />}
      {activeSubTab === 'legal' && (
        <div
          style={{
            padding: '28px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              Fundamentos y Fórmulas Matemáticas de la Hoja NOMINA GRAL
            </h2>
            <p style={{ color: '#475569', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
              Este módulo reproduce con fidelidad matemática las prácticas de liquidación salarial de medianas y grandes empresas en Paraguay,
              cumpliendo las directrices del Código del Trabajo (Ley N.º 213/93), las normativas previsionales del IPS y los regímenes tributarios de la DNIT.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                1. Base Mensual y Cómputo de Días
              </div>
              <ul style={{ fontSize: '13px', color: '#334155', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li><strong>Base 30 días:</strong> Todo mes laboral se estandariza en 30 días comerciales.</li>
                <li><strong>Base 240 horas:</strong> 30 días × 8 horas diarias legales ordinarias.</li>
                <li><strong>Valor Día:</strong> <code>Salario Fijo / 30</code>.</li>
                <li><strong>Valor Hora Normal:</strong> <code>Salario Fijo / 240</code>.</li>
                <li><strong>Días Trabajados:</strong> <code>30 - Días_Vacaciones - Días_Reposo</code> (o días efectivos si el empleado ingresó durante el mes).</li>
              </ul>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                2. Horas Extras y Feriados
              </div>
              <ul style={{ fontSize: '13px', color: '#334155', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li><strong>Horas 50%:</strong> Horas extras diurnas en días hábiles = <code>Valor_Hora × 1.5 × Cantidad</code>.</li>
                <li><strong>Horas 130%:</strong> Horas extras nocturnas en domingos o feriados = <code>Valor_Hora × 1.3 × 2 × Cantidad</code> (factor 2.6x).</li>
                <li><strong>Horas 100% / Feriados:</strong> Dado que el día feriado ya está incluido en el salario mensual de 30 días, el recargo adicional por trabajar el feriado es de 1 vez el valor hora: <code>Valor_Hora × 1.0 × Cantidad</code>.</li>
                <li><strong>Recargo Nocturno:</strong> Horas ordinarias entre 20:00 y 06:00 = <code>Valor_Hora × 0.30 × Cantidad</code>.</li>
              </ul>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                3. Bonificación Familiar (Exenta de IPS)
              </div>
              <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.6 }}>
                Conforme al <strong>Art. 261 del Código del Trabajo</strong>, corresponde el <strong>5% del Salario Mínimo Legal Vigente</strong> (Gs. 152.200) por cada hijo menor de 18 años o con discapacidad.
                <br /><br />
                <strong style={{ color: '#16a34a' }}>⚠️ Principio Legal Crítico:</strong> El Art. 262 establece que la bonificación familiar <strong>no sufre descuentos previsionales</strong>, por lo que <em>no integra la base imponible del 9% al IPS</em>.
              </p>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                4. Prestadores de Servicios con Factura
              </div>
              <ul style={{ fontSize: '13px', color: '#334155', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li>No son dependientes en relación laboral formal, por lo que <strong>no pagan aporte obrero al IPS (0%)</strong>.</li>
                <li>Emiten factura legal con <strong>IVA 10%</strong> sobre sus honorarios: <code>Base × 10%</code>.</li>
                <li>La empresa actúa como Agente de Retención según resoluciones de la DNIT / ex-SET y aplica la <strong>Retención del 30% sobre el monto del IVA</strong>: <code>IVA × 30%</code>.</li>
                <li><strong>Neto a Cobrar:</strong> <code>(Total Facturado - Retención IVA) - Descuentos Comerciales</code>.</li>
              </ul>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                5. Descuentos y Deducciones de Nómina
              </div>
              <ul style={{ fontSize: '13px', color: '#334155', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li><strong>Aporte Obrero IPS (9%):</strong> Deducción previsional obligatoria para cotizantes dependientes.</li>
                <li><strong>Ausencias y Suspensiones:</strong> Descuento proporcional de días no trabajados: <code>(Salario Fijo / 30) × Días</code>.</li>
                <li><strong>Embargos Judiciales:</strong> Retenciones ordenadas por oficios de juzgados de la niñez o civiles.</li>
                <li><strong>Seguro Médico Privado / Asismed:</strong> Cuotas de pólizas corporativas o copagos.</li>
                <li><strong>Anticipos de Salario:</strong> Vales y adelantos concedidos en quincena.</li>
                <li><strong>Compras a Crédito en la Empresa:</strong> Vales de compras internas y cadenas asociadas del grupo.</li>
                <li><strong>Faltantes de Caja y Mercadería:</strong> Arqueos desfavorables y diferencias de inventario imputables.</li>
                <li><strong>Teléfono / Notebook:</strong> Descuentos por renovación de smartphone o cuotas de computadoras de trabajo.</li>
              </ul>
            </div>

            <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>
                6. Cargas Patronales y Provisiones
              </div>
              <ul style={{ fontSize: '13px', color: '#334155', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li><strong>Aporte Patronal IPS (16.5%):</strong> Costo a cargo exclusivo del empleador sobre la totalidad de los haberes imponibles.</li>
                <li><strong>Provisión de Aguinaldo:</strong> Reserva contable mensual equivalente a <code>Total Haberes / 12</code> (1/12 de las remuneraciones percibidas).</li>
                <li><strong>Subsidio de Reposo Médico:</strong> En la práctica de la empresa, el empleador abona el 50% del valor día por cada día de reposo y el trabajador gestiona el restante subsidio ante el IPS.</li>
              </ul>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
