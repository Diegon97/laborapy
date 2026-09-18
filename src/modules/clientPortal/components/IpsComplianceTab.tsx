/**
 * IPS: GENERADOR TXT REI & BÓVEDA DE EXTRACTOS — ERP LABORAPY
 * Cumplimiento del Decreto-Ley N.º 1860/50 y Dirección de Aporte Obrero Patronal (AOP)
 */

import React, { useState } from 'react';
import type { EmpresaCliente, DocumentoCumplimiento } from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  getRecibosByCliente,
  getDocumentosByCliente,
  saveDocumentoCumplimiento,
  formatPYG,
  obtenerNombreMes,
} from '../services/clientStorageService';
import {
  generarIpsReiTxt,
  generarIpsPrn,
  descargarArchivoTexto,
} from '../generators/ipsReiTxtGenerator';

interface Props {
  empresa: EmpresaCliente;
}

export const IpsComplianceTab: React.FC<Props> = ({ empresa }) => {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState<number>(currentDate.getMonth() + 1);
  const [selectedAnho, setSelectedAnho] = useState<number>(currentDate.getFullYear());
  const [formatoVista, setFormatoVista] = useState<'prn' | 'txt'>('prn');

  const empleados = getEmpleadosByCliente(empresa.id).filter(e => e.estado !== 'inactivo');
  const recibos = getRecibosByCliente(empresa.id, selectedMes, selectedAnho);
  const [documentos, setDocumentos] = useState<DocumentoCumplimiento[]>(() =>
    getDocumentosByCliente(empresa.id).filter(d => d.tipo === 'extracto_ips' || d.tipo === 'factura_pago_ips')
  );

  const [isModalUploadOpen, setIsModalUploadOpen] = useState(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newPeriodo, setNewPeriodo] = useState(`${selectedAnho}-${String(selectedMes).padStart(2, '0')}`);
  const [newTransaccion, setNewTransaccion] = useState('');
  const [newMonto, setNewMonto] = useState<number>(0);

  const prnData = generarIpsPrn(recibos, empleados, empresa, selectedMes, selectedAnho);
  const txtData = generarIpsReiTxt(recibos, empleados, empresa, selectedMes, selectedAnho);

  const handleDescargarPrn = () => {
    descargarArchivoTexto(prnData.fileName, prnData.content);
  };

  const handleDescargarTxtRei = () => {
    descargarArchivoTexto(txtData.fileName, txtData.content);
  };

  const handleGuardarExtracto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitulo.trim()) return;

    const nuevo: DocumentoCumplimiento = {
      id: `doc_ips_${Date.now()}`,
      clienteId: empresa.id,
      tipo: 'extracto_ips',
      periodo: newPeriodo,
      titulo: newTitulo,
      archivoNombre: `IPS_EXTRACTO_${newPeriodo.replace('-', '')}.pdf`,
      nroTransaccionOficial: newTransaccion || `EXT-IPS-${Date.now().toString().slice(-6)}`,
      fechaPresentacion: new Date().toISOString().split('T')[0],
      montoAbonado: newMonto,
      createdAt: new Date().toISOString(),
    };

    saveDocumentoCumplimiento(nuevo);
    setDocumentos(getDocumentosByCliente(empresa.id).filter(d => d.tipo === 'extracto_ips' || d.tipo === 'factura_pago_ips'));
    setIsModalUploadOpen(false);
    setNewTitulo('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── SECCIÓN 1: Generador TXT Planilla REI del IPS ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏥</span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Generador de Archivo Plano IPS REI (TXT)
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Genera la planilla electrónica mensual de aportes requerida por el Sistema REI del Instituto de Previsión Social.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={selectedMes}
              onChange={e => setSelectedMes(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, background: '#ffffff' }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>
                  {obtenerNombreMes(m)}
                </option>
              ))}
            </select>
            <select
              value={selectedAnho}
              onChange={e => setSelectedAnho(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, background: '#ffffff' }}
            >
              {[2025, 2026, 2027].map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen de la Planilla a Declarar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cotizantes Declarados</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {txtData.totalEmpleados} empleados
            </div>
          </div>

          <div style={{ background: '#f0f9ff', padding: '14px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>Salarios Imponibles</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
              {formatPYG(txtData.totalSalariosImponibles)}
            </div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>Aporte Total 25.5% (IPS)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
              {formatPYG(txtData.totalAporteIps255)}
            </div>
            <div style={{ fontSize: '10.5px', color: '#15803d', marginTop: '2px' }}>
              9% Obrero: {formatPYG(txtData.totalAporteObrero9)} · 16.5% Patronal: {formatPYG(txtData.totalAportePatronal165)}
            </div>
          </div>
        </div>

        {/* Selector y Vista Previa del Archivo Oficial (PRN vs TXT) */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#64748b' }}>
              Estructura Técnica del Archivo ({formatoVista === 'prn' ? prnData.fileName : txtData.fileName}):
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setFormatoVista('prn')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: formatoVista === 'prn' ? '#047857' : '#ffffff',
                  color: formatoVista === 'prn' ? '#ffffff' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ★ Formato Oficial Aceptado (.PRN · 109 cols)
              </button>
              <button
                type="button"
                onClick={() => setFormatoVista('txt')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: formatoVista === 'txt' ? '#0284c7' : '#ffffff',
                  color: formatoVista === 'txt' ? '#ffffff' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Formato REI Delimitado (.TXT)
              </button>
            </div>
          </div>

          <pre
            style={{
              background: '#ffffff',
              color: formatoVista === 'prn' ? '#34d399' : '#38bdf8',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              maxHeight: '150px',
              overflowY: 'auto',
              overflowX: 'auto',
              whiteSpace: 'pre',
              margin: 0,
            }}
          >
            {formatoVista === 'prn' ? prnData.content : txtData.content}
          </pre>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {formatoVista === 'prn'
              ? 'Formato posicional estricto de 109 caracteres de ancho fijo: Patronal(10) + CI(20) + Apellidos(30) + Nombres(30) + Tipo(1) + Días(2) + Salario(10) + Período(6).'
              : 'Formato plano delimitado por pipes (|) estándar REI con cabecera (1), detalle (2) y pie de control (3).'}
          </div>
        </div>

        {/* Botones de Descarga */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDescargarPrn}
            disabled={prnData.totalEmpleados === 0}
            style={{
              padding: '11px 22px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: prnData.totalEmpleados === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
            }}
            title="Descargar archivo plano posicional .PRN aceptado por el sistema de IPS (ej. IPS JULIO.prn)"
          >
            <span>💾</span>
            <span>Descargar Archivo Oficial IPS (.prn)</span>
          </button>

          <button
            onClick={handleDescargarTxtRei}
            disabled={txtData.totalEmpleados === 0}
            style={{
              padding: '11px 18px',
              borderRadius: '8px',
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: txtData.totalEmpleados === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)',
            }}
            title="Descargar formato delimitado por pipes (|) para Sistema REI"
          >
            <span>📄</span>
            <span>Descargar Formato REI Delimitado (.txt)</span>
          </button>
        </div>
      </div>

      {/* ── SECCIÓN 2: Repositorio y Acceso a Extractos de IPS ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📁</span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Bóveda de Extractos & Comprobantes de Pago IPS
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Custodia digital de los extractos oficiales emitidos por el IPS y constancias de pago bancario de tu empresa.
            </p>
          </div>

          <button
            onClick={() => setIsModalUploadOpen(true)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#ffffff',
              border: 'none',
              color: '#fff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📤</span>
            <span>Registrar Extracto Oficial</span>
          </button>
        </div>

        {/* Tabla de Extractos */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>DOCUMENTO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>PERÍODO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>TRANSACCIÓN OFICIAL</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>FECHA DE PAGO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>MONTO CANCELADO</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {documentos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No hay extractos registrados. Haz clic en "Registrar Extracto Oficial" para añadir uno.
                  </td>
                </tr>
              ) : (
                documentos.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{doc.titulo}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{doc.archivoNombre}</div>
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#64748b' }}>
                      {doc.periodo}
                    </td>

                    <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'monospace' }}>
                      {doc.nroTransaccionOficial || 'N/D'}
                    </td>

                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {doc.fechaPresentacion || 'Fecha no informada'}
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                      {doc.montoAbonado ? formatPYG(doc.montoAbonado) : 'Al día'}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#15803d', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                        ✓ Homologado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE REGISTRO DE EXTRACTO ── */}
      {isModalUploadOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsModalUploadOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#ffffff', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Registrar Extracto Oficial de IPS
              </h3>
              <button
                onClick={() => setIsModalUploadOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarExtracto} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Título o Descripción del Extracto *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitulo}
                    onChange={e => setNewTitulo(e.target.value)}
                    placeholder="Ej: Extracto AOP IPS - Agosto 2026"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Período (YYYY-MM) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPeriodo}
                      onChange={e => setNewPeriodo(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Monto Abonado (PYG)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newMonto}
                      onChange={e => setNewMonto(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    N.º de Transacción / Boleta IPS
                  </label>
                  <input
                    type="text"
                    value={newTransaccion}
                    onChange={e => setNewTransaccion(e.target.value)}
                    placeholder="Ej: EXT-202608-55421"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalUploadOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', background: '#0284c7', border: 'none', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Guardar Extracto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
