/**
 * MODAL DE RECIBO OFICIAL DE SALARIO MENSUAL (LABORAPY)
 * Cumple con los Arts. 235 y 236 del Código del Trabajo de Paraguay (Ley N.º 213/93).
 * Formato legal con duplicado (Original: Trabajador / Duplicado: Empleador) y estilos @media print.
 */

import React, { useEffect } from 'react';
import type { LiquidacionMensualResult } from '../types';
import { formatGuaranies } from '../engine/monthlyPayrollEngine';

export interface PayrollSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacion: LiquidacionMensualResult;
  empresaNombre?: string;
  periodo?: string;
}

export const PayrollSlipModal: React.FC<PayrollSlipModalProps> = ({
  isOpen,
  onClose,
  liquidacion,
  empresaNombre = 'EMPRESA CLIENTE S.A.',
  periodo = 'Período Mensual',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { input, diasTrabajadosEfectivos, haberes, haberesImponiblesIps, retencionIva, descuentos, netoACobrar } = liquidacion;
  const esFactura = input.tipo === 'factura';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .payroll-slip-print, .payroll-slip-print * { visibility: visible !important; }
          .payroll-slip-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      <div
        className="payroll-slip-print"
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          margin: '20px auto',
        }}
      >
        {/* Barra superior de acciones (no imprimible) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📄</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Recibo Oficial de Salario Mensual</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Art. 235 y 236 – Ley N.º 213/93 Código del Trabajo</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              🖨️ Imprimir Recibo
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#334155',
                color: '#ffffff',
                border: 'none',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        </div>

        {/* Contenido del Recibo (Duplicado para cumplimiento legal) */}
        <div style={{ padding: '28px 32px' }}>
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              style={{
                marginTop: copyIndex === 1 ? '32px' : '0',
                paddingTop: copyIndex === 1 ? '28px' : '0',
                borderTop: copyIndex === 1 ? '2px dashed #cbd5e1' : 'none',
              }}
            >
              {/* Encabezado del Recibo */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                  {input.empresa || empresaNombre}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  RECIBO DE SALARIO — {copyIndex === 0 ? 'ORIGINAL (TRABAJADOR)' : 'DUPLICADO (EMPLEADOR)'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Período Liquidado: <strong>{periodo}</strong> · Base mensual: 30 días (240 hs)
                </div>
              </div>

              {/* Ficha del Funcionario */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Funcionario: </span>
                  <strong style={{ color: '#0f172a' }}>{input.nombre}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>CI N°: </span>
                  <strong style={{ color: '#0f172a' }}>{input.ci}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Cargo: </span>
                  <strong style={{ color: '#0f172a' }}>{input.cargo}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Régimen: </span>
                  <strong style={{ color: esFactura ? '#d97706' : '#2563eb' }}>
                    {esFactura ? 'Prestador de Servicios (Factura)' : 'Cotizante General IPS'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Días Computables: </span>
                  <strong style={{ color: '#0f172a' }}>{diasTrabajadosEfectivos} días</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Salario Fijo: </span>
                  <strong style={{ color: '#0f172a' }}>{formatGuaranies(input.salarioFijo)}</strong>
                </div>
              </div>

              {/* Tabla de Haberes vs Descuentos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Columna Haberes */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#ecfdf5',
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#065f46',
                      borderBottom: '1px solid #a7f3d0',
                      textTransform: 'uppercase',
                    }}
                  >
                    Haberes / Remuneraciones
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 12px', color: '#334155' }}>Salario Total Días Trabajados</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {formatGuaranies(haberes.salarioBaseDiasTrabajados)}
                        </td>
                      </tr>
                      {haberes.adicionalCargo > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Adicional por Cargo / Variable</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.adicionalCargo)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoVacaciones > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Vacaciones ({input.diasVacaciones} días)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoVacaciones)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoReposo > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Subsidio Reposo (50% empresa)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoReposo)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoHoras50 > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Horas Extras 50% ({input.cantHoras50} hs)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoHoras50)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoHoras130 > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Horas Extras 130% ({input.cantHoras130} hs)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoHoras130)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoHoras100 > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Feriados / Hs. 100% ({input.cantHoras100} hs)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoHoras100)}
                          </td>
                        </tr>
                      )}
                      {haberes.montoRecargoNocturno > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Recargo Nocturno 30%</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.montoRecargoNocturno)}
                          </td>
                        </tr>
                      )}
                      {haberes.bonificacionFamiliar > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f0fdf4' }}>
                          <td style={{ padding: '6px 12px', color: '#15803d' }}>
                            Bonificación Familiar (Exenta IPS)
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                            {formatGuaranies(haberes.bonificacionFamiliar)}
                          </td>
                        </tr>
                      )}
                      {haberes.refrigerioTraslado > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Refrigerio y Traslado</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(haberes.refrigerioTraslado)}
                          </td>
                        </tr>
                      )}
                      {haberes.ivaMonto > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fffbeb' }}>
                          <td style={{ padding: '6px 12px', color: '#b45309' }}>I.V.A. Factura (10%)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                            {formatGuaranies(haberes.ivaMonto)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#065f46' }}>Total Haberes</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#065f46' }}>
                          {formatGuaranies(haberes.totalHaberesBrutos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Columna Descuentos */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#fff1f2',
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#9f1239',
                      borderBottom: '1px solid #fecdd3',
                      textTransform: 'uppercase',
                    }}
                  >
                    Deducciones / Descuentos
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {descuentos.aporteObreroIps > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fef2f2' }}>
                          <td style={{ padding: '6px 12px', color: '#991b1b' }}>Aporte Obrero IPS (9%)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#991b1b' }}>
                            {formatGuaranies(descuentos.aporteObreroIps)}
                          </td>
                        </tr>
                      )}
                      {descuentos.retencionIva > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fffbeb' }}>
                          <td style={{ padding: '6px 12px', color: '#b45309' }}>Retención IVA (30% s/ IVA)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                            {formatGuaranies(descuentos.retencionIva)}
                          </td>
                        </tr>
                      )}
                      {descuentos.descuentoAusencias > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Ausencias / Suspensiones ({input.diasAusencias} d)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.descuentoAusencias)}
                          </td>
                        </tr>
                      )}
                      {descuentos.embargosJudiciales > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Embargos Judiciales</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.embargosJudiciales)}
                          </td>
                        </tr>
                      )}
                      {descuentos.seguroMedicoPrivado > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Seguro Médico Privado / Asismed</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.seguroMedicoPrivado)}
                          </td>
                        </tr>
                      )}
                      {descuentos.anticipoSalario > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Anticipo de Salario / Vales</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.anticipoSalario)}
                          </td>
                        </tr>
                      )}
                      {descuentos.faltanteCaja > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Faltante de Caja</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.faltanteCaja)}
                          </td>
                        </tr>
                      )}
                      {descuentos.faltanteMercaderia > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Faltante de Mercadería / Inventario</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.faltanteMercaderia)}
                          </td>
                        </tr>
                      )}
                      {descuentos.telefonoNotebook > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Teléfono Corporativo / Notebook</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.telefonoNotebook)}
                          </td>
                        </tr>
                      )}
                      {descuentos.compraCreditoEmpresa > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Compra a Crédito Empresa (Cta Cte)</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.compraCreditoEmpresa)}
                          </td>
                        </tr>
                      )}
                      {descuentos.prestamosEmpresa > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Préstamos de la Empresa</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.prestamosEmpresa)}
                          </td>
                        </tr>
                      )}
                      {descuentos.otrosDescuentos > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', color: '#334155' }}>Otros Descuentos / Donación</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {formatGuaranies(descuentos.otrosDescuentos)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#fff1f2', borderTop: '1px solid #fecdd3' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#9f1239' }}>Total Deducciones</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#9f1239' }}>
                          {formatGuaranies(descuentos.totalDescuentos + (esFactura ? retencionIva : 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Total Neto a Cobrar Destacado */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  borderRadius: '10px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
                    Neto a Percibir / Desembolso Final
                  </div>
                  {!esFactura && (
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                      Haberes Imponibles IPS: {formatGuaranies(haberesImponiblesIps)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace' }}>
                  {formatGuaranies(netoACobrar)}
                </div>
              </div>

              {/* Declaración Legal */}
              <p style={{ fontSize: '9.5px', color: '#64748b', lineHeight: 1.4, margin: '0 0 16px 0' }}>
                Constancia emitida en estricto cumplimiento de los Artículos 235 y 236 de la Ley N.º 213/93 del Código del Trabajo.
                El trabajador/prestador declara conformidad con la liquidación practicada por el período arriba indicado.
                El duplicado suscripto queda archivado como constancia de pago de la patronal.
              </p>

              {/* Firmas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '40px',
                  textAlign: 'center',
                  fontSize: '10.5px',
                  color: '#334155',
                  paddingTop: '16px',
                }}
              >
                <div>
                  <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '4px' }}>
                    <strong>Firma del Trabajador</strong>
                  </div>
                  <div>Aclaración: {input.nombre}</div>
                  <div>CI N°: {input.ci}</div>
                </div>
                <div>
                  <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '4px' }}>
                    <strong>Firma y Sello de la Empresa</strong>
                  </div>
                  <div>{input.empresa || empresaNombre}</div>
                  <div>Administración / RRHH</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
