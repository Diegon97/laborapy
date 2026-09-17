
/**
 * DASHBOARD EJECUTIVO Y ALERTAS PREVENTIVAS — ERP LABORAPY
 * KPIs clave, Costo Real Empresa (+31% sobre nominal) y Semáforo de Período de Prueba
 */

import React, { useState } from 'react';
import type { EmpresaCliente, ConfiguracionAntiguedad, Empleado } from '../types/clientPortal';
import {
  getDashboardMetrics,
  formatPYG,
  saveConfiguracionAntiguedad,
  getEmpleadoById,
} from '../services/clientStorageService';
import { MaternityLactationModal } from './MaternityLactationModal';

interface Props {
  empresa: EmpresaCliente;
  onNavigateTab: (tabId: string) => void;
  onEmitirNotaPrueba?: (empleadoId: string) => void;
}

export const ClientDashboardTab: React.FC<Props> = ({ empresa, onNavigateTab, onEmitirNotaPrueba }) => {
  const [, setRefreshKey] = useState(0);
  const metrics = getDashboardMetrics(empresa.id);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedMaternityEmployee, setSelectedMaternityEmployee] = useState<Empleado | null>(null);
  const [umbralHombres, setUmbralHombres] = useState<number>(metrics.configAntiguedad?.umbralAnhosHombres ?? 9);
  const [umbralMujeres, setUmbralMujeres] = useState<number>(metrics.configAntiguedad?.umbralAnhosMujeres ?? 8);

  const handleGuardarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevaConfig: ConfiguracionAntiguedad = {
      umbralAnhosHombres: Number(umbralHombres),
      umbralAnhosMujeres: Number(umbralMujeres),
      alertarDiasAntes: 60,
    };
    saveConfiguracionAntiguedad(empresa.id, nuevaConfig);
    setIsConfigModalOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Banner de Bienvenida y Empresa ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '14px',
          padding: '24px',
          color: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>🇵🇾</span>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
              PANEL DE CONTROL LABORAL & NÓMINA · PARAGUAY
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>
            {empresa.razonSocial}
          </h2>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            RUC: <strong>{empresa.ruc}-{empresa.dv}</strong> · Patronal IPS: <strong>{empresa.nroPatronalIps || 'Registrado'}</strong> · MTESS: <strong>{empresa.nroPatronalMtess || 'Activo'}</strong>
          </div>
        </div>

        <div className="erp-quick-actions-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigateTab('payroll')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#047857',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💰</span>
            <span>Liquidación Mensual</span>
          </button>
          <button
            onClick={() => onNavigateTab('receipts')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💵</span>
            <span>Ver Recibos del Mes</span>
          </button>
          <button
            onClick={() => onNavigateTab('ips')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🏥</span>
            <span>Generar TXT IPS</span>
          </button>
          <button
            onClick={() => onNavigateTab('company')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Gestionar RUC, Razón Social, Patronales IPS y MTESS"
          >
            <span>🏢</span>
            <span>Datos Empresa</span>
          </button>
          <button
            onClick={() => onNavigateTab('assistant')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: '1px solid #10b981',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Abrir Auxiliar Inteligente de RRHH (Segundo Ojo & Copilot)"
          >
            <span>🛡️</span>
            <span>Auxiliar RRHH</span>
          </button>
        </div>
      </div>

      {/* ── ALERTA PREVENTIVA: Completar Datos Legales de la Empresa ── */}
      {(!empresa.nroPatronalIps || !empresa.nroPatronalMtess || !empresa.ruc || !empresa.representanteLegalNombre) && (
        <div
          style={{
            background: '#eff6ff',
            border: '2px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🏢</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
                Datos de la Empresa incompletos para reportes legales
              </div>
              <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
                Faltan números patronales o datos del representante legal para emitir archivos IPS (.PRN) y Libros MTESS correctamente.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('company')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Completar Datos Ahora →
          </button>
        </div>
      )}

      {/* ── ALERTA CRÍTICA: Semáforo de Vencimiento de Período de Prueba (Art. 58) ── */}
      {metrics.alertasPeriodoPrueba.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '2px solid #fde68a',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>⏳</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#92400e' }}>
                  Semáforo Preventivo: Períodos de Prueba Próximos a Vencer (Art. 58 Código Laboral)
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#b45309' }}>
                  ¡Atención! Si el contrato de prueba vence sin comunicación de cese, el empleado adquiere estabilidad ordinaria de pleno derecho.
                </p>
              </div>
            </div>
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {metrics.alertasPeriodoPrueba.length} empleado(s) en seguimiento
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
            {metrics.alertasPeriodoPrueba.map(alerta => {
              const esCritico = alerta.diasRestantes <= 5;
              return (
                <div
                  key={alerta.empleadoId}
                  style={{
                    background: '#ffffff',
                    border: `1.5px solid ${esCritico ? '#f87171' : '#fde047'}`,
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>
                        {alerta.nombreCompleto}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: esCritico ? '#fee2e2' : '#fef9c3',
                          color: esCritico ? '#991b1b' : '#854d0e',
                        }}
                      >
                        {alerta.diasRestantes <= 0 ? '¡Vencido hoy!' : `Quedan ${alerta.diasRestantes} días`}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      CI: {alerta.ci} · Cargo: {alerta.cargo}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                      Ingreso: <strong>{alerta.fechaIngreso}</strong> (Plazo: {alerta.diasPrueba} días) · Vence: <strong>{alerta.fechaFinPrueba}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => onNavigateTab('employees')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver Ficha
                    </button>
                    {onEmitirNotaPrueba && (
                      <button
                        onClick={() => onEmitirNotaPrueba(alerta.empleadoId)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#dc2626',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Generar Nota Formal de Término de Período de Prueba"
                      >
                        Emitir Cese
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ALERTA ESTRATÉGICA: Semáforo Preventivo de Antigüedad & Estabilidad Especial (Art. 94) ── */}
      <div
        style={{
          background: metrics.alertasAntiguedad.length > 0 ? '#fff1f2' : '#ffffff',
          border: `2px solid ${metrics.alertasAntiguedad.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🛡️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#881337' }}>
                  Semáforo Preventivo: Antigüedad & Estabilidad Especial (Art. 94 Código del Trabajo)
                </h4>
                <span
                  style={{
                    background: '#ffe4e6',
                    color: '#9f1239',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Umbrales: ♂️ {metrics.configAntiguedad.umbralAnhosHombres} años · ♀️ {metrics.configAntiguedad.umbralAnhosMujeres} años
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#9f1239' }}>
                Al cumplir 10 años continuos, el trabajador adquiere <strong>estabilidad especial propia</strong> (despido posterior requiere juicio laboral previo de justificación de causal).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Ajustar años de alerta por género para su empresa"
            >
              <span>⚙️</span>
              <span>Configurar Umbrales</span>
            </button>
          </div>
        </div>

        {metrics.alertasAntiguedad.length === 0 ? (
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', fontSize: '12.5px', color: '#64748b' }}>
            ✅ Ningún empleado activo ha alcanzado aún los umbrales de alerta configurados ({metrics.configAntiguedad.umbralAnhosHombres} años hombres / {metrics.configAntiguedad.umbralAnhosMujeres} años mujeres).
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
            {metrics.alertasAntiguedad.map(alerta => {
              const esEstable = alerta.nivelRiesgo === 'estable_adquirida';
              const esCritico = alerta.nivelRiesgo === 'critico_proximo_10';
              const borderColor = esEstable ? '#818cf8' : esCritico ? '#f43f5e' : '#f59e0b';
              const badgeBg = esEstable ? '#e0e7ff' : esCritico ? '#ffe4e6' : '#fef3c7';
              const badgeColor = esEstable ? '#3730a3' : esCritico ? '#9f1239' : '#92400e';

              return (
                <div
                  key={alerta.empleadoId}
                  style={{
                    background: '#ffffff',
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                          {alerta.nombreCompleto}
                        </span>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {alerta.cargo} · {alerta.departamento} ({alerta.sexo === 'M' ? '♂️ Hombre' : '♀️ Mujer'})
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {esEstable ? '🛡️ Estabilidad Adquirida' : esCritico ? '🚨 Crítico (<6 meses)' : '⚠️ Alerta Preventiva'}
                      </span>
                    </div>

                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Antigüedad actual:</span>
                        <strong style={{ color: '#0f172a' }}>{alerta.antiguedadTexto}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ color: '#64748b' }}>Ingreso:</span>
                        <span>{alerta.fechaIngreso}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ color: '#64748b' }}>Hacia los 10 años:</span>
                        <strong style={{ color: esCritico ? '#e11d48' : '#0284c7' }}>
                          {alerta.tiempoRestanteParaEstabilidadTexto}
                        </strong>
                      </div>
                    </div>

                    <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                      💡 {alerta.mensajeEstrategico}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => onNavigateTab('employees')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver Ficha de Personal
                    </button>
                    <button
                      onClick={() => onNavigateTab('vacations')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0369a1',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver Vacaciones
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ALERTA DE MATERNIDAD, LACTANCIA & FUERO LABORAL (LEY 5508/15 Y 7097/23) ── */}
      <div
        style={{
          background: metrics.alertasMaternidad.length > 0 ? '#fdf2f8' : '#ffffff',
          border: `2px solid ${metrics.alertasMaternidad.length > 0 ? '#fbcfe8' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🤰</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#831843' }}>
                  Semáforo de Maternidad, Lactancia (90 min) & Fuero Laboral (Ley 5508/15 y 7097/23)
                </h4>
                <span
                  style={{
                    background: '#fce7f3',
                    color: '#9d174d',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {metrics.alertasMaternidad.length} evento(s) activo(s)
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#9d174d' }}>
                Reposo legal de 18 semanas (126 días) subsidiado 100% por IPS · Permiso de 90 min diarios · Prórrogas trimestrales hasta 24 meses · Inamovilidad absoluta (Art. 136).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab('employees')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>👥</span>
              <span>Ver Fichas de Nómina</span>
            </button>
          </div>
        </div>

        {metrics.alertasMaternidad.length === 0 ? (
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', fontSize: '12.5px', color: '#64748b' }}>
            ✅ No se registran alertas inmediatas de inicio/fin de reposo ni vencimientos trimestrales de constancia pediátrica.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {metrics.alertasMaternidad.map(alerta => {
              const esCritico = alerta.nivelUrgencia === 'critico';
              const esAdvertencia = alerta.nivelUrgencia === 'advertencia';
              const borderColor = esCritico ? '#e11d48' : esAdvertencia ? '#f59e0b' : '#38bdf8';
              const badgeBg = esCritico ? '#ffe4e6' : esAdvertencia ? '#fef3c7' : '#e0f2fe';
              const badgeColor = esCritico ? '#9f1239' : esAdvertencia ? '#92400e' : '#0369a1';

              return (
                <div
                  key={`${alerta.registroId}_${alerta.tipoAlerta}`}
                  style={{
                    background: '#ffffff',
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                          {alerta.nombreCompleto}
                        </span>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          C.I. {alerta.ci} · {alerta.cargo} ({alerta.departamento})
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: badgeBg,
                          color: badgeColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {alerta.tipoAlerta === 'reposo_proximo_inicio' && '⏳ Reposo Próximo'}
                        {alerta.tipoAlerta === 'reposo_proximo_fin' && '🏥 Fin Reposo 18 Sem'}
                        {alerta.tipoAlerta === 'lactancia_6meses_por_vencer' && '🍼 6 Meses Lactancia'}
                        {alerta.tipoAlerta === 'certificado_trimestral_por_vencer' && '⚠️ Certificado a Vencer'}
                        {alerta.tipoAlerta === 'certificado_trimestral_vencido' && '🚨 Certificado Vencido'}
                        {alerta.tipoAlerta === 'lactancia_24meses_fin' && '🏁 Finiquito 2 Años'}
                        {alerta.tipoAlerta === 'fuero_maternal_activo' && '🛡️ Fuero Activo'}
                      </span>
                    </div>

                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{alerta.titulo}</div>
                      <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                        {alerta.descripcion}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        <span>Fecha evento clave: <strong>{alerta.fechaEventoClave}</strong></span>
                        <span>Días restantes: <strong style={{ color: esCritico ? '#e11d48' : '#0f172a' }}>{alerta.diasRestantes}</strong></span>
                      </div>
                    </div>

                    <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#831843', lineHeight: 1.35 }}>
                      💡 <strong>Acción requerida:</strong> {alerta.accionRecomendada}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => {
                        const emp = getEmpleadoById(alerta.empleadoId);
                        if (emp) setSelectedMaternityEmployee(emp);
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '6px',
                        background: '#fdf2f8',
                        border: '1px solid #fbcfe8',
                        color: '#db2777',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>⚙️</span>
                      <span>Gestionar Caso / Certificados</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tarjetas de KPIs Principales de Nómina e IPS ── */}
      <div className="erp-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* KPI 1: Total Empleados */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Nómina Activa
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>
              {metrics.totalEmpleadosActivos}
            </span>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>
              {metrics.totalEmpleadosPrueba} en prueba
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px' }}>
            Empleados dados de alta en IPS y MTESS
          </div>
        </div>

        {/* KPI 2: Masa Salarial Bruta */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Masa Salarial Bruta
          </div>
          <div style={{ marginTop: '6px', fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
            {formatPYG(metrics.masaSalarialBruta)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px' }}>
            Total remuneraciones devengadas en el mes
          </div>
        </div>

        {/* KPI 3: Aporte IPS Total (25.5%) */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Aporte Total IPS (25.5%)
          </div>
          <div style={{ marginTop: '6px', fontSize: '22px', fontWeight: 900, color: '#0284c7' }}>
            {formatPYG(metrics.totalIps255)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Obrero 9%: <strong>{formatPYG(metrics.totalIpsObrero9)}</strong><br />
            Patronal 16.5%: <strong>{formatPYG(metrics.totalIpsPatronal165)}</strong>
          </div>
        </div>

        {/* KPI 4: Costo Real Empresa */}
        <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '18px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
            +{metrics.porcentajeSobrecosto}% real
          </div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase' }}>
            Costo Empresa Real
          </div>
          <div style={{ marginTop: '6px', fontSize: '22px', fontWeight: 900, color: '#1e40af' }}>
            {formatPYG(metrics.costoRealPatronalTotal)}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
            Incluye IPS 16.5%, 1/12 Aguinaldo y Vacaciones
          </div>
        </div>
      </div>

      {/* ── Desglose del Costo Total Empleado (Propuesta de Valor) ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              💡 Radiografía de Costo Patronal Mensual (Provisión y Pasivos Laborales)
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
              Lo que tu empresa debe provisionar cada mes para evitar asfixia financiera en diciembre o al cierre fiscal.
            </p>
          </div>
        </div>

        <div className="erp-cost-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>1. Sueldo Nominal</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {formatPYG(metrics.masaSalarialBruta)}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>100% Base Salarial</div>
          </div>

          <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 600 }}>2. IPS Patronal (16.5%)</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
              {formatPYG(metrics.totalIpsPatronal165)}
            </div>
            <div style={{ fontSize: '11px', color: '#0284c7' }}>Obligación mensual no recuperable</div>
          </div>

          <div style={{ background: '#fefce8', padding: '12px', borderRadius: '8px', border: '1px solid #fef08a' }}>
            <div style={{ fontSize: '11.5px', color: '#854d0e', fontWeight: 600 }}>3. Provisión Aguinaldo (1/12)</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#a16207', marginTop: '4px' }}>
              {formatPYG(metrics.provisionAguinaldoMensual)}
            </div>
            <div style={{ fontSize: '11px', color: '#a16207' }}>Exigible antes del 31 de diciembre</div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 600 }}>4. Provisión Vacaciones</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
              {formatPYG(metrics.provisionVacacionesMensual)}
            </div>
            <div style={{ fontSize: '11px', color: '#16a34a' }}>Descanso anual remunerado</div>
          </div>
        </div>
      </div>

      {/* ── Calendario de Próximos Vencimientos Tributarios & Laborales ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
          📅 Próximas Fechas Clave de Cumplimiento (Paraguay)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '24px' }}>🏥</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                Instituto de Previsión Social (IPS)
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {metrics.proximoVencimientoIps}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Presentación de Planilla Electrónica REI y pago de extracto sin recargo mora.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '24px' }}>⚖️</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                Ministerio de Trabajo (MTESS - REOP)
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {metrics.proximoVencimientoMtess}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Comunicación obligatoria de salarios devengados y movimientos de personal.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: CONFIGURAR UMBRALES DE ANTIGÜEDAD (ART. 94) ── */}
      {isConfigModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                ⚙️ Configurar Umbrales de Antigüedad
              </h3>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
              Defina los años de servicio a partir de los cuales el sistema activará alertas preventivas antes de que el personal adquiera estabilidad propia a los 10 años (Art. 94 Ley N.º 213/93).
            </p>

            <form onSubmit={handleGuardarConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  ♂️ Umbral de Alerta para Hombres (años):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={umbralHombres}
                  onChange={e => setUmbralHombres(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Predeterminado: 9 años (permite 1 año de margen estratégico previo a los 10 años).
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  ♀️ Umbral de Alerta para Mujeres (años):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={umbralMujeres}
                  onChange={e => setUmbralMujeres(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Predeterminado: 8 años (permite 2 años de margen estratégico de evaluación).
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE GESTIÓN DE MATERNIDAD & LACTANCIA ── */}
      {selectedMaternityEmployee && (
        <MaternityLactationModal
          empresa={empresa}
          empleado={selectedMaternityEmployee}
          isOpen={!!selectedMaternityEmployee}
          onClose={() => setSelectedMaternityEmployee(null)}
          onSaved={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
};