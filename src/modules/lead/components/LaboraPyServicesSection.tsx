
/**
 * SECCIÓN DESTACADA: SERVICIOS PROFESIONALES DE ASESORÍA LABORAL Y CONTABLE
 * LaboraPy - Soluciones Laborales y Contables (Paraguay)
 * Segmentación B2B (Empresas) y B2C (Particulares) con CTAs directos a WhatsApp (+595)
 */

import React, { useState } from 'react';
import { LABORAPY_CONFIG, createWhatsAppUrl, WhatsAppMessages } from '../../../config/laborapy';

interface Props {
  onSelectTab?: (tab: 'settlement' | 'documents' | 'legal') => void;
}

export const LaboraPyServicesSection: React.FC<Props> = ({ onSelectTab }) => {
  const [filter, setFilter] = useState<'all' | 'contabilidad' | 'rrhh' | 'seleccion' | 'b2b' | 'b2c'>('all');

  // WhatsApp URLs para RRHH y Selección
  const seleccionWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.seleccionEmpresa());
  const postularCvWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.postulacionCandidato());
  const b2bWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.b2bEmpresas());
  const expatWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.expatHrDesk());
  const b2cWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.b2cParticulares());
  const maternidadWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.maternidad());
  const primaciaWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.primaciaRealidad());

  // WhatsApp URLs para Contabilidad, Impuestos & Balances (DNIT)
  const contabilidadWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.contabilidadGeneral());
  const ivaRentaWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.contabilidadIvaRenta());
  const balancesWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.estadosFinancieros());
  const dnitGestionesWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.dnitGestiones());
  const reactivacionIvaWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.reactivacionIvaPerfil());
  const estadoDeudasWhatsAppUrl = createWhatsAppUrl(WhatsAppMessages.estadoDeudasDnit());

  return (
    <section className="services-section-wrapper" id="servicios-profesionales">
      {/* ── Encabezado de Sección ── */}
      <div className="services-header">
        <div className="services-pill">
          <span>💼</span>
          <span>Nuestros Servicios Profesionales</span>
        </div>
        <h2 className="services-title">
          Catálogo de Servicios: RRHH, Selección & Contabilidad
        </h2>
        <p className="services-subtitle">
          Soluciones integrales y especializadas para empresas y profesionales en Paraguay: 
          <strong> Búsqueda de Talentos, Liquidaciones Laborales & Nóminas (Ley 213/93)</strong> junto con 
          <strong> Contabilidad General, Liquidación de Impuestos (IVA/IRE/IRP) y Estados Financieros certificados ante la DNIT</strong>.
        </p>

        {/* Aviso de Alcance y Transparencia */}
        <div style={{
          marginTop: '16px',
          padding: '14px 18px',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          fontSize: '13px',
          color: '#334155',
          lineHeight: '1.5',
          textAlign: 'left',
          maxWidth: '820px',
          margin: '16px auto 0',
        }}>
          <strong>ℹ️ Alcance Profesional y Transparencia:</strong> LaboraPy ofrece dos divisiones especializadas:
          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
            <li><strong>División Contable y Tributaria:</strong> Servicios de liquidación impositiva (Ley N.º 6380/19), auditoría contable y estados financieros oficiales con <strong>firma de Contador Público Matriculado</strong> ante la DNIT.</li>
            <li><strong>División Recursos Humanos:</strong> Búsqueda y selección de talentos por competencias, consultoría y <strong>segunda opinión técnica de expertos en RRHH</strong> para desvinculaciones y liquidaciones (no ofrecemos patrocinio letrado ni representación judicial ante tribunales).</li>
          </ul>
        </div>

        {/* Filtro interactivo por divisiones y segmentos */}
        <div className="services-filter-bar">
          <button
            type="button"
            className={`services-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos los Servicios
          </button>
          <button
            type="button"
            className={`services-filter-btn ${filter === 'b2b' ? 'active' : ''}`}
            onClick={() => setFilter('b2b')}
          >
            🏢 Empresas (B2B)
          </button>
          <button
            type="button"
            className={`services-filter-btn ${filter === 'b2c' ? 'active' : ''}`}
            onClick={() => setFilter('b2c')}
          >
            👤 Colaboradores (B2C)
          </button>
          <button
            type="button"
            className={`services-filter-btn ${filter === 'rrhh' ? 'active' : ''}`}
            onClick={() => setFilter('rrhh')}
          >
            ⚖️ Asesoría Laboral & Nóminas
          </button>
          <button
            type="button"
            className={`services-filter-btn ${filter === 'seleccion' ? 'active' : ''}`}
            onClick={() => setFilter('seleccion')}
          >
            👥 Búsqueda y Selección
          </button>
          <button
            type="button"
            className={`services-filter-btn ${filter === 'contabilidad' ? 'active' : ''}`}
            onClick={() => setFilter('contabilidad')}
          >
            📊 Contabilidad & Impuestos
          </button>
        </div>
      </div>

      {/* ── Grilla Principal de Servicios ── */}
      <div className="services-grid">
        {/* 🏢 TARJETA B2B: PARA EMPRESAS */}
        {(filter === 'all' || filter === 'b2b' || filter === 'rrhh') && (
          <div
            className="service-card service-card-b2b"
            style={{
              gridColumn: filter === 'all' || filter === 'rrhh' ? undefined : '1 / -1',
              border: '2px solid #047857',
              background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)',
            }}
          >
            <div className="service-card-badge-top b2b">
              <span>🏢</span> Empresas (B2B) · Asesoría Laboral & Nóminas
            </div>

            <h3 className="service-card-title">
              Asesoría en Desvinculaciones y Liquidaciones para Empresas
            </h3>
            <p className="service-card-desc">
              Evite pagar de más, cometer errores de cálculo o generar contingencias laborales innecesarias antes de comunicar o acordar una salida.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              margin: '16px 0 20px',
            }}>
              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🔍</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Revisión & Cálculo de Liquidaciones</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Revisión exhaustiva de cálculos de desvinculación, haberes devengados, aguinaldo proporcional y vacaciones antes de formalizar el pago.
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>📋</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Comunicaciones & Planillas MTESS (REOP)</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Comunicación mensual de salarios devengados, entradas, salidas y finiquitos en REOP, más presentación de Planillas Anuales Obligatorias.
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>📊</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Tercerización de Nóminas (Payroll & IPS)</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Liquidación mensual de salarios, horas extras, comisiones, emisión de recibos legales y carga de planillas previsionales REI ante el IPS.
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🤝</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Acuerdos & Auditoría de Legajos</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Orientación técnica en acuerdos de mutuo consentimiento y auditoría preventiva de contratos de trabajo bajo la Ley N.º 213/93.
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1.5px solid #3b82f6', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(59,130,246,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🌐</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1d4ed8' }}>Expat HR Desk (Bilingual EN/ES)</div>
                </div>
                <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.45' }}>
                  Asesoría para multinacionales e inversores: cuotas de personal extranjero (Art. 10), enrolamiento obligatorio en IPS y nóminas en USD/multimoneda.
                </div>
              </div>
            </div>

            {/* CTAs B2B */}
            <div className="service-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
                <a
                  href={b2bWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp b2b-btn"
                  style={{ flex: '1 1 240px' }}
                >
                  <span>💬</span>
                  <span>Consultar para mi Empresa</span>
                </a>
                <a
                  href={expatWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                  style={{
                    flex: '1 1 240px',
                    background: '#1e40af',
                    borderColor: '#1d4ed8',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '14px',
                    borderRadius: '10px',
                    padding: '12px 18px',
                  }}
                >
                  <span>🌐</span>
                  <span>Expat HR Desk (English / B2B)</span>
                </a>
              </div>
              <div className="service-guarantee-note">
                ⚡ Respuesta ágil · Criterio profesional, objetivo y confidencial ({LABORAPY_CONFIG.whatsAppDisplay})
              </div>
            </div>
          </div>
        )}

        {/* 👤 TARJETA B2C: PARA PARTICULARES Y TRABAJADORES */}
        {(filter === 'all' || filter === 'b2c' || filter === 'rrhh') && (
          <div
            className="service-card service-card-b2c"
            style={{
              gridColumn: filter === 'all' || filter === 'rrhh' ? undefined : '1 / -1',
              border: '2px solid #2563eb',
              background: 'linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)',
            }}
          >
            <div className="service-card-badge-top b2c">
              <span>👤</span> Colaboradores (B2C) · Asesoría Laboral
            </div>

            <h3 className="service-card-title">
              Revisión y Asesoría de tu Liquidación antes de Firmar
            </h3>
            <p className="service-card-desc">
              Analiza tu situación con un profesional senior de RRHH para saber qué te corresponde realmente y tomar decisiones con seguridad.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              margin: '16px 0 20px',
            }}>
              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>💰</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Revisión de tu Liquidación</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  ¿Te despidieron o propusieron un acuerdo? Verificamos que el monto respete preaviso, indemnización, aguinaldo y vacaciones.
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>📑</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Facturación Mensual (IVA)</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Si emitís facturas continuadas cumpliendo horario o directivas, evaluamos la primacía de la realidad antes de negociar.
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>🤱</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Fuero Maternal & Estabilidad</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Protección si estás en gestación, lactancia (Ley 5508/15) o con más de 10 años de antigüedad (estabilidad decenal).
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>📊</span>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Informe para Negociación</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Informe con fundamentos y números listos para dialogar con tu empleador o presentar ante un abogado o el MTESS.
                </div>
              </div>
            </div>

            {/* CTAs B2C */}
            <div className="service-card-footer">
              <a
                href={b2cWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp b2c-btn"
              >
                <span>💬</span>
                <span>Consultar sobre mi Caso en WhatsApp</span>
              </a>
              <div className="service-guarantee-note">
                🔒 Consulta 100% confidencial · Toma una decisión informada antes de firmar cualquier documento
              </div>
            </div>
          </div>
        )}

        {/* 📊 TARJETA DESTACADA: DIVISIÓN CONTABILIDAD, IMPUESTOS & BALANCES (DNIT) */}
        {(filter === 'all' || filter === 'contabilidad' || filter === 'b2b') && (
          <div
            className="service-card service-card-accounting"
            style={{
              gridColumn: '1 / -1',
              border: '2px solid #0284c7',
              background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
            }}
          >
            <div className="service-card-badge-top" style={{ background: '#0284c7', color: '#ffffff' }}>
              <span>📊</span> División Contabilidad & Tributación · DNIT / Ley N.º 6380/19
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <h3 className="service-card-title" style={{ fontSize: '20px', color: '#0369a1', marginBottom: '4px' }}>
                  Servicios Contables, Liquidación de Impuestos & Estados Financieros
                </h3>
                <p className="service-card-desc" style={{ fontSize: '13.5px', color: '#334155', margin: '0' }}>
                  Asesoramiento contable e impositivo integral para empresas, profesionales independientes y unipersonales en Paraguay. Llevanza de libros contables, liquidación de tributos ante la DNIT (Sistema Marangatu), estados financieros auditables y balances certificados con firma de Contador Matriculado.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '5px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  ✓ Contador Matriculado
                </span>
                <span style={{ padding: '5px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  ✓ DNIT / Marangatu RG 90
                </span>
                <span style={{ padding: '5px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  ✓ Balances para Bancos y DNCP
                </span>
              </div>
            </div>

            {/* Grilla de 3 Especialidades Contables */}
            <div className="selection-categories-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
              margin: '18px 0',
            }}>
              {/* Bloque 1: IVA y Registro de Comprobantes */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>📑</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      IVA Mensual & RG 90 Marangatu
                    </div>
                    <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
                      Formulario 120 y Comprobantes
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Liquidación mensual del <strong>Impuesto al Valor Agregado (IVA General y Servicios Personales)</strong>, carga y cruce de compras y ventas en el <strong>Registro Electrónico (RG 90)</strong>, control riguroso de deducciones y créditos fiscales para evitar multas.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Declaraciones juradas a tiempo sin contingencias ni bloqueos de timbrado.</em>
                </div>
              </div>

              {/* Bloque 2: IRE e IRP */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>💰</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Renta: IRE e IRP (DNIT)
                    </div>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
                      Empresas y Personas Físicas
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Liquidación anual del <strong>Impuesto a la Renta Empresarial (IRE Simple, Resimple y General)</strong> e <strong>Impuesto a la Renta Personal (IRP - Servicios Personales y Ganancias de Capital)</strong>. Determinación técnica de la renta neta imponible y anticipos.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Planificación tributaria preventiva con aplicación legítima de gastos deducibles.</em>
                </div>
              </div>

              {/* Bloque 3: Estados Financieros y Balances */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>📈</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Estados Financieros & Balances
                    </div>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                      Firma de Contador y Bancos
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  Elaboración de <strong>Balance General, Estado de Resultados, Flujo de Efectivo y Evolución del Patrimonio Neto</strong>. Certificación de balances para <strong>Bancos (solicitud de créditos), Licitaciones Públicas (DNCP)</strong>, asambleas societarias y cierre anual.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Informes contables auditables y ratios de liquidez/solvencia confiables.</em>
                </div>
              </div>

              {/* Bloque 4: Gestiones ante la DNIT / SET & Reactivación de IVA */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>🏛️</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Gestiones DNIT & Reactivación IVA
                    </div>
                    <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>
                      Estado de Deudas & Desbloqueo de RUC
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  <strong>Acompañamiento contable personalizado ante la DNIT / ex SET</strong>: diagnóstico exhaustivo de <strong>estado de deudas tributarias y multas en Marangatu</strong>, regularización de declaraciones juradas omitidas (IVA, IRE, IRP), <strong>reactivación de perfil tributario</strong>, levantamiento de suspensión de RUC y recuperación de timbrado.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Estudio individual de tu caso para volver a facturar y tramitar tu CCT.</em>
                </div>
              </div>
            </div>

            {/* Servicios Complementarios de Contabilidad */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '12px 16px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#334155',
            }}>
              <strong>Compliance Contable, Tributario y Gestiones DNIT para Empresas y Contribuyentes:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span>•</span><span>📖 Libros Diario, Mayor e Inventario (Ley 1034/83)</span></div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span>•</span><span>🪪 Inscripción, Actualización y Regularización de RUC</span></div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span>•</span><span>🔄 Reactivación de IVA & Levantamiento de Bloqueos DNIT</span></div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span>•</span><span>📑 Estado de Deudas & Certificados de Cumplimiento (CCT)</span></div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}><span>•</span><span>🛡️ Compliance Tributario & Contabilidad para Empresas</span></div>
              </div>
            </div>

            {/* Acciones para Contabilidad */}
            <div className="service-card-footer" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={contabilidadWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                style={{ flex: '1 1 220px', background: '#0284c7', minHeight: '44px', fontSize: '13px', padding: '12px 16px' }}
              >
                <span>💬</span>
                <span>Consultar con Equipo Contable</span>
              </a>

              <a
                href={reactivacionIvaWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                style={{ flex: '1 1 240px', background: '#7c3aed', minHeight: '44px', fontSize: '13px', padding: '12px 16px' }}
              >
                <span>🔄</span>
                <span>Reactivación de IVA / Gestiones DNIT</span>
              </a>

              <a
                href={balancesWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                style={{ flex: '1 1 200px', background: '#0f766e', minHeight: '44px', fontSize: '13px', padding: '12px 16px' }}
              >
                <span>📈</span>
                <span>Solicitar Balances o Liquidación</span>
              </a>
            </div>
            <div className="service-guarantee-note" style={{ textAlign: 'center', marginTop: '8px' }}>
              🔒 Confidencialidad contable garantizada · Cumplimiento estricto de la Ley N.º 6380/19 ({LABORAPY_CONFIG.whatsAppDisplay})
            </div>
          </div>
        )}
        {/* 👥 TARJETA DESTACADA: BÚSQUEDA Y SELECCIÓN DE PERSONAL */}
        {(filter === 'all' || filter === 'seleccion' || filter === 'b2b') && (
          <div
            className="service-card service-card-selection"
            style={{
              gridColumn: '1 / -1',
              border: '2px solid #059669',
              background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)',
            }}
          >
            <div className="service-card-badge-top" style={{ background: '#059669', color: '#ffffff' }}>
              <span>👥</span> Búsqueda & Selección de Talentos · Paraguay
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <h3 className="service-card-title" style={{ fontSize: '20px', color: '#064e3b', marginBottom: '4px' }}>
                  Búsqueda y Selección de Personal: Operativo, Mandos Medios y Profesionales
                </h3>
                <p className="service-card-desc" style={{ fontSize: '13.5px', color: '#334155', margin: '0' }}>
                  Atracción y selección integral de talentos con rigor técnico de RRHH. Realizamos filtros curriculares, entrevistas por competencias, validación exhaustiva de referencias laborales y chequeo de antecedentes para asegurar el candidato ideal con garantía de reposición.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '5px 12px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  ✓ Garantía Período de Prueba
                </span>
                <span style={{ padding: '5px 12px', background: '#dbeafe', color: '#1e40af', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                  ✓ Chequeo de Referencias 100%
                </span>
              </div>
            </div>

            {/* Grilla de 3 Categorías de Búsqueda */}
            <div className="selection-categories-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
              margin: '18px 0',
            }}>
              {/* Categoría 1: Personal Operativo */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>👷‍♂️</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Personal Operativo y Logística
                    </div>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                      Operarios, Choferes, Maestranza y Caja
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  <strong>Perfiles:</strong> Operarios de planta y fábrica, choferes y repartidores, cajeros, repositores, atención al cliente, limpieza y maestranza, guardias de seguridad y auxiliares.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Reclutamiento ágil masivo o individual, prueba de confiabilidad y disponibilidad inmediata.</em>
                </div>
              </div>

              {/* Categoría 2: Mandos Medios y Supervisores */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>👔</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Supervisores y Mandos Medios
                    </div>
                    <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
                      Jefes de Turno, Encargados y Coordinadores
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  <strong>Perfiles:</strong> Jefes de sector, encargados de sucursal, supervisores de área/planta, coordinadores de ventas, líderes de equipo y jefaturas operativas.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Evaluación de liderazgo situacional, manejo de personal y resolución práctica de problemas.</em>
                </div>
              </div>

              {/* Categoría 3: Profesionales y Mandos Ejecutivos */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>🎓</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Profesionales y Ejecutivos
                    </div>
                    <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>
                      Técnicos, Analistas y Gerencias
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  <strong>Perfiles:</strong> Contadores, analistas de finanzas y RRHH, ingenieros, licenciados en enfermería y salud, especialistas técnicos y gerentes de área.
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                  🎯 <em>Headhunting específico, entrevistas por competencias y presentación de terna calificada.</em>
                </div>
              </div>
            </div>

            {/* Metodología Paso a Paso */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '12px 16px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#334155',
            }}>
              <strong>Nuestro Proceso de Selección Garantizado:</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>1️⃣</span><span>Relevamiento de perfil</span></div> <span style={{ color: '#94a3b8' }}>➔</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>2️⃣</span><span>Filtro curricular</span></div> <span style={{ color: '#94a3b8' }}>➔</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>3️⃣</span><span>Entrevistas</span></div> <span style={{ color: '#94a3b8' }}>➔</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>4️⃣</span><span>Referencias</span></div> <span style={{ color: '#94a3b8' }}>➔</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>5️⃣</span><span>Terna finalista</span></div>
              </div>
            </div>

            {/* Acciones Duales: Para Empresas y Para Candidatos */}
            <div className="service-card-footer" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={seleccionWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                style={{ flex: '1 1 240px', background: '#059669', minHeight: '44px', fontSize: '13px', padding: '12px 16px' }}
              >
                <span>🏢</span>
                <span>Solicitar Búsqueda para mi Empresa en WhatsApp</span>
              </a>

              <a
                href={postularCvWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                style={{ flex: '1 1 200px', background: '#0284c7', minHeight: '44px', fontSize: '13px', padding: '12px 16px' }}
              >
                <span>📄</span>
                <span>Enviar mi CV para Búsquedas Activas</span>
              </a>
            </div>
            <div className="service-guarantee-note" style={{ textAlign: 'center', marginTop: '8px' }}>
              🤝 Proceso confidencial y profesional adaptado al mercado laboral paraguayo ({LABORAPY_CONFIG.whatsAppDisplay})
            </div>
          </div>
        )}
      </div>

      {/* ── Atajos Rápidos Contextuales ── */}
      <div className="contextual-shortcuts-panel">
        <div className="shortcuts-intro">
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
            ¿Tienes consultas sobre tu situación laboral o contable?
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Contáctanos directamente por WhatsApp para recibir atención personalizada:
          </div>
        </div>

        <div className="shortcuts-chips-grid">
          <a
            href={seleccionWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
          >
            <span>👥</span>
            <span>Solicitar Búsqueda de Personal</span>
          </a>

          <a
            href={postularCvWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}
          >
            <span>📄</span>
            <span>Enviar CV a Base de Talentos</span>
          </a>

          <a
            href={ivaRentaWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
          >
            <span>📑</span>
            <span>Liquidación IVA / RG 90</span>
          </a>

          <a
            href={balancesWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}
          >
            <span>📈</span>
            <span>Balances para Bancos / DNCP</span>
          </a>

          <a
            href={reactivacionIvaWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' }}
          >
            <span>🔄</span>
            <span>Reactivación IVA / Perfil DNIT</span>
          </a>

          <a
            href={estadoDeudasWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}
          >
            <span>📊</span>
            <span>Estado de Deudas DNIT / SET</span>
          </a>

          <a
            href={dnitGestionesWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
          >
            <span>🏛️</span>
            <span>Gestiones & Trámites DNIT</span>
          </a>

          <a
            href={createWhatsAppUrl(WhatsAppMessages.contabilidadIvaRenta('IRE e IRP'))}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}
          >
            <span>💰</span>
            <span>Impuesto a la Renta (IRE / IRP)</span>
          </a>

          <a
            href={createWhatsAppUrl(WhatsAppMessages.librosContablesRuc())}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#faf5ff', borderColor: '#e9d5ff', color: '#6b21a8' }}
          >
            <span>📚</span>
            <span>Libros Contables & RUC</span>
          </a>

          <a
            href={createWhatsAppUrl(WhatsAppMessages.mtessPlanillas())}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip"
            style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' }}
          >
            <span>📋</span>
            <span>Comunicaciones & Planillas MTESS</span>
          </a>

          <a
            href={maternidadWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip urgent"
          >
            <span>🤱</span>
            <span>Embarazo / Lactancia (Fuero Maternal)</span>
          </a>

          <a
            href={primaciaWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip reality"
          >
            <span>⚖️</span>
            <span>Facturo con IVA (Relación de Dependencia)</span>
          </a>

          <a
            href={createWhatsAppUrl(WhatsAppMessages.estabilidad10Anios())}
            target="_blank"
            rel="noopener noreferrer"
            className="shortcut-chip stability"
          >
            <span>⏳</span>
            <span>Antigüedad +10 Años (Estabilidad Laboral)</span>
          </a>

          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('settlement')}
              className="shortcut-chip calc"
            >
              <span>🧮</span>
              <span>Calcular Liquidación Gratis</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};