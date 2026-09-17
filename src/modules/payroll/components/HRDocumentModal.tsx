/**
 * GENERADOR DE DOCUMENTOS LABORALES OFICIALES — PARAGUAY
 * Interfaz intuitiva y simplificada · 100% Confidencial y Neutral
 * Versión: PY-LIQ-2026.09.01
 */

import React, { useState } from 'react';
import { generarNotaLaboralPDF, type NotaLaboralOptions } from '../generators/noticePdfGenerator';
import { trackEmisionNota } from '../../analytics/metaPixel';
import { LeadCaptureModal } from '../../lead/LeadCaptureModal';
import { LABORAPY_CONFIG, createWhatsAppUrl, WhatsAppMessages } from '../../../config/laborapy';
import {
  exportMtessMonthly,
  exportMtessSettlements,
  type MtessMonthlyEmployeeRecord,
  type MtessSettlementEmployeeRecord,
} from '../generators/mtessExportService';
import { CompactDatePicker } from './CompactDatePicker';

interface Props {
  onClose?: () => void;
}

export const HRDocumentModal: React.FC<Props> = ({ onClose }) => {
  const [tipo, setTipo] = useState<NotaLaboralOptions['tipo']>('despido_injustificado');
  const [empresa, setEmpresa] = useState('');
  const [lugarFecha, setLugarFecha] = useState('Asunción, 05 de septiembre de 2026');
  const [nombreEmpleado, setNombreEmpleado] = useState('Juan Pérez');
  const [ciEmpleado, setCiEmpleado] = useState('4.123.456');
  const [cargoEmpleado, setCargoEmpleado] = useState('Ejecutivo Comercial');
  const [fechaIngreso, setFechaIngreso] = useState('2022-03-01');
  const [fechaEgreso, setFechaEgreso] = useState('2026-08-31');
  const [diasPreaviso, setDiasPreaviso] = useState<number | ''>(45);
  const [salarioMensual, setSalarioMensual] = useState<number | ''>(3500000);
  const [incluirSalario, setIncluirSalario] = useState<boolean>(true);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  const getDocumentTitle = () => {
    switch (tipo) {
      case 'despido_injustificado':
        return 'Notificación de Despido Injustificado';
      case 'despido_justificado':
        return 'Notificación de Despido Justificado';
      case 'renuncia':
        return 'Nota de Renuncia Voluntaria';
      case 'certificado_trabajo':
        return 'Certificado Laboral Oficial';
      default:
        return 'Documento Laboral Oficial';
    }
  };

  const ejecutarDescargaPDF = () => {
    const opts: NotaLaboralOptions = {
      tipo,
      empresa,
      lugarFecha,
      nombreEmpleado,
      ciEmpleado,
      cargoEmpleado,
      fechaIngreso,
      fechaEgreso,
      diasPreaviso: tipo === 'despido_injustificado' ? (Number(diasPreaviso) || 0) : undefined,
      salarioMensual: Number(salarioMensual) || 0,
      incluirSalarioEnCertificado: incluirSalario,
    };

    trackEmisionNota({
      tipo,
      empleado: nombreEmpleado,
    });

    const pdf = generarNotaLaboralPDF(opts);
    pdf.save(`${tipo.toUpperCase()}_${nombreEmpleado.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDescargarModeloMtessSalarios = () => {
    const records: MtessMonthlyEmployeeRecord[] = [
      {
        numeroPatronalMtess: '38451',
        sucursalLabel: 'ASUNCION',
        ci: ciEmpleado ? ciEmpleado.replace(/\D/g, '') || ciEmpleado : '4123456',
        periodoDesde: '2026-08-01',
        periodoHasta: '2026-08-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 240,
        salarioBasico: Number(salarioMensual) || 3500000,
        comisiones: 0,
        horasExtras50: 0,
        horasExtras100: 0,
        bonificacionFamiliar: 0,
      },
    ];
    exportMtessMonthly(records);
  };

  const handleDescargarModeloMtessLiquidacion = () => {
    const salario = Number(salarioMensual) || 3500000;
    const preaviso = salario;
    const indemnizacion = Math.round(salario * 1.5);
    const vacProp = Math.round((salario / 30) * 12);
    const baseLiq = salario + preaviso + indemnizacion + vacProp;
    const records: MtessSettlementEmployeeRecord[] = [
      {
        numeroPatronalMtess: '38451',
        sucursalLabel: 'ASUNCION',
        ci: ciEmpleado ? ciEmpleado.replace(/\D/g, '') || ciEmpleado : '4123456',
        fechaPago: fechaEgreso || '2026-08-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 240,
        salarioBasico: salario,
        preaviso,
        indemnizacion,
        vacacionesProporcionales: vacProp,
        aguinaldoProporcional: Math.round((salario * 8) / 12),
        bonificacionFamiliar: 0,
        aporteSegSocial: Math.round(baseLiq * 0.09),
        descuentos: [],
      },
    ];
    exportMtessSettlements(records);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            Generador de Documentos Laborales
          </h2>
          <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '13px' }}>
            Emite notas formales con respaldo del Código del Trabajo (Ley N.º 213/93).
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── BANNER PLANILLAS OFICIALES MTESS EXCEL ── */}
      <div
        style={{
          marginBottom: '20px',
          padding: '16px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1.5px solid #a7f3d0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ maxWidth: '440px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚖️</span>
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#065f46' }}>
              Planillas Oficiales MTESS en Excel (.xlsx)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#047857', lineHeight: '1.4' }}>
            Formatos 100% compatibles con el REOP (Decreto 1989/24): 32 columnas de Salarios y 27 de Liquidaciones con Regla de Cero.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDescargarModeloMtessSalarios}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
            }}
          >
            <span>📗</span>
            <span>Salarios MTESS (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleDescargarModeloMtessLiquidacion}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            }}
          >
            <span>📘</span>
            <span>Liquidaciones MTESS (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ── Selector de Documento en 3 Tarjetas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <div
          onClick={() => setTipo('despido_injustificado')}
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: `2px solid ${tipo === 'despido_injustificado' ? '#059669' : '#e2e8f0'}`,
            background: tipo === 'despido_injustificado' ? '#f0fdf4' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '22px', marginBottom: '6px' }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Nota de Despido</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Notificación patronal con talón de recibo y opción de preaviso.
          </div>
        </div>

        <div
          onClick={() => setTipo('renuncia')}
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: `2px solid ${tipo === 'renuncia' ? '#059669' : '#e2e8f0'}`,
            background: tipo === 'renuncia' ? '#f0fdf4' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '22px', marginBottom: '6px' }}>✍️</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Carta de Renuncia</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Renuncia formal del colaborador con firma de 2 testigos legales.
          </div>
        </div>

        <div
          onClick={() => setTipo('certificado_trabajo')}
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: `2px solid ${tipo === 'certificado_trabajo' ? '#059669' : '#e2e8f0'}`,
            background: tipo === 'certificado_trabajo' ? '#f0fdf4' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '22px', marginBottom: '6px' }}>🏆</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Certificado Laboral</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Constancia oficial de servicios y funciones según Art. 111 C.T.
          </div>
        </div>
      </div>

      {/* ── Formulario Rápido ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div>
          <label className="field-label">Nombre de la Empresa o Empleador</label>
          <input
            type="text"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            className="input-control"
            placeholder="Nombre o Razón Social (Opcional)"
          />
        </div>

        <div>
          <label className="field-label">Lugar y Fecha de Emisión</label>
          <input
            type="text"
            value={lugarFecha}
            onChange={e => setLugarFecha(e.target.value)}
            className="input-control"
          />
        </div>

        <div>
          <label className="field-label">Nombre del Colaborador</label>
          <input
            type="text"
            value={nombreEmpleado}
            onChange={e => setNombreEmpleado(e.target.value)}
            className="input-control"
          />
        </div>

        <div>
          <label className="field-label">Cédula de Identidad (C.I.)</label>
          <input
            type="text"
            value={ciEmpleado}
            onChange={e => setCiEmpleado(e.target.value)}
            className="input-control"
          />
        </div>

        <div>
          <label className="field-label">Cargo o Función</label>
          <input
            type="text"
            value={cargoEmpleado}
            onChange={e => setCargoEmpleado(e.target.value)}
            className="input-control"
          />
        </div>

        <div>
          <CompactDatePicker
            label="Fecha de Ingreso"
            value={fechaIngreso}
            onChange={setFechaIngreso}
          />
        </div>

        <div>
          <CompactDatePicker
            label="Fecha de Egreso"
            value={fechaEgreso}
            onChange={setFechaEgreso}
            quickAction={{
              label: 'Hoy',
              onClick: () => setFechaEgreso(new Date().toISOString().split('T')[0]),
            }}
          />
        </div>

        {tipo === 'despido_injustificado' && (
          <div>
            <label className="field-label">Días de Preaviso a Otorgar</label>
            <input
              type="number"
              value={diasPreaviso}
              onChange={e => {
                const val = e.target.value;
                setDiasPreaviso(val === '' ? '' : Math.max(0, Number(val)));
              }}
              onFocus={e => e.target.select()}
              className="input-control"
              placeholder="0"
              min="0"
            />
          </div>
        )}

        {tipo === 'certificado_trabajo' && (
          <div>
            <label className="field-label">Salario Mensual (Gs.)</label>
            <input
              type="number"
              value={salarioMensual}
              onChange={e => {
                const val = e.target.value;
                setSalarioMensual(val === '' ? '' : Math.max(0, Number(val)));
              }}
              onFocus={e => e.target.select()}
              className="input-control"
              placeholder="0"
              min="0"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '6px', color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={incluirSalario}
                onChange={e => setIncluirSalario(e.target.checked)}
              />
              Mencionar salario en el certificado
            </label>
          </div>
        )}
      </div>

      <button onClick={() => setIsLeadModalOpen(true)} className="btn-cta-primary">
        📄 Descargar Documento Oficial en PDF
      </button>

      {/* Asesoría Contextual para Documentos Laborales */}
      <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0', textAlign: 'center' }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
          ¿Necesitas una nota personalizada o justificar una causal (Art. 81)?
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px', lineHeight: '1.45' }}>
          Un profesional senior de Recursos Humanos de <strong>{LABORAPY_CONFIG.brandName}</strong> te brinda asesoría y revisión técnica de notas formales de desvinculación y acuerdos de mutuo consentimiento para tomar decisiones informadas.
        </p>
        <a
          href={createWhatsAppUrl(WhatsAppMessages.documentos(getDocumentTitle()))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-whatsapp"
          style={{ minHeight: '44px', fontSize: '13px', padding: '10px 16px', background: '#25d366' }}
        >
          <span>💬</span>
          <span>Consultar con un Experto en RRHH ({LABORAPY_CONFIG.whatsAppDisplay})</span>
        </a>
      </div>

      {/* Pasarela Comercial y Funnel de Leads para Descargas */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={() => {
          setIsLeadModalOpen(false);
          ejecutarDescargaPDF();
        }}
        documentTitle={getDocumentTitle()}
        documentFormat="pdf"
        montoNeto={tipo === 'certificado_trabajo' && incluirSalario ? (Number(salarioMensual) || 0) : undefined}
        initialEmpresa={empresa}
        initialNombre={nombreEmpleado}
        initialMotivo={getDocumentTitle()}
      />
    </div>
  );
};
