/**
 * GENERADOR DE RECIBOS DE SALARIOS (ART. 235/236 LEY N.º 213/93) — ERP LABORAPY
 * Emisión puntual o descarga masiva de todos los recibos en un solo PDF unificado
 */

import React, { useState, useEffect } from 'react';
import type { EmpresaCliente, Empleado, ReciboSalario } from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  getRecibosByCliente,
  calcularReciboSalario,
  saveRecibosBatch,
  formatPYG,
  obtenerNombreMes,
} from '../services/clientStorageService';
import {
  generarReciboSalarioPDF,
  generarRecibosSalarioMasivoPDF,
} from '../generators/salaryReceiptPdfGenerator';
import {
  generarArchivoAcreditacionBancaria,
  descargarArchivoTexto,
} from '../generators/ipsReiTxtGenerator';
import { aplicarAsistenciaARecibosSalario } from '../services/attendanceService';

interface Props {
  empresa: EmpresaCliente;
}

export const SalaryReceiptsTab: React.FC<Props> = ({ empresa }) => {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState<number>(currentDate.getMonth() + 1);
  const [selectedAnho, setSelectedAnho] = useState<number>(currentDate.getFullYear());

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [recibos, setRecibos] = useState<ReciboSalario[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  // Modal para editar novedades (horas extras, anticipos) de un recibo
  const [editingRecibo, setEditingRecibo] = useState<ReciboSalario | null>(null);

  useEffect(() => {
    const emps = getEmpleadosByCliente(empresa.id).filter(e => e.estado !== 'inactivo');
    setEmpleados(emps);

    // Cargar recibos existentes o calcularlos automáticamente
    let recs = getRecibosByCliente(empresa.id, selectedMes, selectedAnho);
    if (recs.length === 0 && emps.length > 0) {
      recs = emps.map(emp => calcularReciboSalario(emp, selectedMes, selectedAnho));
      saveRecibosBatch(recs);
    }
    setRecibos(recs);
  }, [empresa.id, selectedMes, selectedAnho]);

  const handleDescargarPuntual = async (recibo: ReciboSalario) => {
    const emp = empleados.find(e => e.id === recibo.empleadoId);
    if (!emp) return;

    const doc = await generarReciboSalarioPDF(recibo, emp, empresa);
    doc.save(`RECIBO_${emp.ci}_${selectedAnho}_${String(selectedMes).padStart(2, '0')}.pdf`);
  };

  const handleDescargarMasivo = async () => {
    if (recibos.length === 0) return;
    setIsGeneratingBulk(true);

    try {
      const doc = await generarRecibosSalarioMasivoPDF(recibos, empleados, empresa);
      doc.save(`RECIBOS_MASIVOS_${empresa.ruc}_${selectedAnho}_${String(selectedMes).padStart(2, '0')}.pdf`);
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleDescargarNominaBanco = () => {
    const { fileName, content } = generarArchivoAcreditacionBancaria(
      recibos,
      empleados,
      empresa,
      selectedMes,
      selectedAnho
    );
    descargarArchivoTexto(fileName, content, 'text/csv;charset=utf-8');
  };

  const handleSincronizarBiometria = () => {
    const res = aplicarAsistenciaARecibosSalario(empresa.id, selectedMes, selectedAnho);
    const recs = getRecibosByCliente(empresa.id, selectedMes, selectedAnho);
    setRecibos(recs);
    alert(`¡Sincronización exitosa! Se actualizaron ${res.recibosActualizados} recibos de salario con las horas extras, tardanzas y ausencias de ${obtenerNombreMes(selectedMes)} ${selectedAnho}.`);
  };

  const handleSaveReciboAjustes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecibo) return;

    const emp = empleados.find(e => e.id === editingRecibo.empleadoId);
    if (!emp) return;

    const recalculado = calcularReciboSalario(emp, selectedMes, selectedAnho, {
      diasTrabajados: editingRecibo.diasTrabajados,
      horasExtras50Cant: editingRecibo.horasExtras50Cant,
      horasExtras100Cant: editingRecibo.horasExtras100Cant,
      comisionesPremios: editingRecibo.comisionesPremios,
      anticiposQuincena: editingRecibo.anticiposQuincena,
      judicialesAlimentos: editingRecibo.judicialesAlimentos,
      otrosDescuentos: editingRecibo.otrosDescuentos,
    });

    saveRecibosBatch([recalculado]);
    setRecibos(prev => prev.map(r => (r.id === recalculado.id ? recalculado : r)));
    setEditingRecibo(null);
  };

  // Totales de la nómina del mes
  const totalSalariosBrutos = recibos.reduce((acc, r) => acc + r.totalIngresosBrutos, 0);
  const totalIps9 = recibos.reduce((acc, r) => acc + r.ipsObrero9, 0);
  const totalNetoPagar = recibos.reduce((acc, r) => acc + r.salarioNeto, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Barra Superior de Control de Período & Descargas ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Mes de Liquidación
            </label>
            <select
              value={selectedMes}
              onChange={e => setSelectedMes(Number(e.target.value))}
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                fontWeight: 700,
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>
                  {obtenerNombreMes(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Año
            </label>
            <select
              value={selectedAnho}
              onChange={e => setSelectedAnho(Number(e.target.value))}
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                fontWeight: 700,
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {[2025, 2026, 2027].map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones de Exportación Masiva */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button
            onClick={handleSincronizarBiometria}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Importa horas extras, llegadas tardías y novedades de asistencia directamente a la liquidación"
          >
            <span>⏰</span>
            <span>Sincronizar Biometría</span>
          </button>

          <button
            onClick={handleDescargarNominaBanco}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Descargar archivo para transferencia masiva en bancos paraguayos"
          >
            <span>🏦</span>
            <span>Acreditación Bancaria (CSV)</span>
          </button>

          <button
            onClick={handleDescargarMasivo}
            disabled={isGeneratingBulk || recibos.length === 0}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#059669',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isGeneratingBulk ? 'not-allowed' : 'pointer',
              opacity: isGeneratingBulk ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.25)',
            }}
          >
            <span>📄</span>
            <span>{isGeneratingBulk ? 'Generando PDF Masivo...' : 'Descargar Todos los Recibos (PDF Masivo)'}</span>
          </button>
        </div>
      </div>

      {/* ── Resumen de Totales del Mes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Devengado Bruto
          </div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            {formatPYG(totalSalariosBrutos)}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
            Retención Obrero IPS (9%)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>
            {formatPYG(totalIps9)}
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Líquido Neto a Pagar
          </div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#166534', marginTop: '4px' }}>
            {formatPYG(totalNetoPagar)}
          </div>
        </div>
      </div>

      {/* ── Tabla de Recibos Detallados ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>TRABAJADOR</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>DÍAS</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>SUELDO DEVENGADO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>HS. EXTRAS</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>BONIF. FAM.</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>IPS 9% (-)</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>ANTICIPOS (-)</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>LÍQUIDO NETO</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {recibos.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No hay recibos generados para este período.
                  </td>
                </tr>
              ) : (
                recibos.map((r, idx) => {
                  const emp = empleados.find(e => e.id === r.empleadoId);
                  const totalHorasExtrasMonto = r.horasExtras50Monto + r.horasExtras100Monto;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {emp ? `${emp.nombres} ${emp.apellidos}` : 'Empleado'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          C.I. N.º {emp?.ci} · {emp?.cargo}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 600 }}>
                        {r.diasTrabajados}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {formatPYG(r.salarioDevengado)}
                      </td>

                      <td style={{ padding: '12px 14px', color: totalHorasExtrasMonto > 0 ? '#0284c7' : '#94a3b8' }}>
                        {totalHorasExtrasMonto > 0 ? formatPYG(totalHorasExtrasMonto) : '-'}
                      </td>

                      <td style={{ padding: '12px 14px', color: r.bonificacionFamiliar > 0 ? '#059669' : '#94a3b8' }}>
                        {r.bonificacionFamiliar > 0 ? formatPYG(r.bonificacionFamiliar) : '-'}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: 600 }}>
                        {formatPYG(r.ipsObrero9)}
                      </td>

                      <td style={{ padding: '12px 14px', color: r.anticiposQuincena > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {r.anticiposQuincena > 0 ? formatPYG(r.anticiposQuincena) : '-'}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 900, color: '#166534' }}>
                        {formatPYG(r.salarioNeto)}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setEditingRecibo(r)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#64748b',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Modificar días, horas extras o anticipos de este recibo"
                          >
                            Ajustar
                          </button>
                          <button
                            onClick={() => handleDescargarPuntual(r)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#0284c7',
                              color: '#fff',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Descargar Recibo en Duplicado A4 (PDF)"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL PARA AJUSTAR NOVEDADES DE UN RECIBO ── */}
      {editingRecibo && (
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
          onClick={() => setEditingRecibo(null)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '520px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#ffffff', padding: '16px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Ajustar Novedades de Liquidación
              </h3>
              <button
                onClick={() => setEditingRecibo(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReciboAjustes} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Días Trabajados en el Mes
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={editingRecibo.diasTrabajados}
                    onChange={e => setEditingRecibo({ ...editingRecibo, diasTrabajados: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Comisiones / Premios (PYG)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingRecibo.comisionesPremios}
                    onChange={e => setEditingRecibo({ ...editingRecibo, comisionesPremios: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Horas Extras 50% (Cantidad)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editingRecibo.horasExtras50Cant}
                    onChange={e => setEditingRecibo({ ...editingRecibo, horasExtras50Cant: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Horas Extras 100% (Cantidad)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editingRecibo.horasExtras100Cant}
                    onChange={e => setEditingRecibo({ ...editingRecibo, horasExtras100Cant: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Anticipo de Quincena (PYG)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingRecibo.anticiposQuincena}
                    onChange={e => setEditingRecibo({ ...editingRecibo, anticiposQuincena: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Retención Judicial Alimentos
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingRecibo.judicialesAlimentos}
                    onChange={e => setEditingRecibo({ ...editingRecibo, judicialesAlimentos: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingRecibo(null)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', background: '#0284c7', border: 'none', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Recalcular y Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
