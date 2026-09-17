/**
 * GESTOR INTEGRAL DE VACACIONES (REALES VS MTESS) — ERP LABORAPY
 * Control de usufructo interno, escala legal (Art. 218), notas de concesión (Art. 222)
 * y comunicaciones mensuales obligatorias al MTESS (Sistema REOP)
 */

import React, { useState } from 'react';
import type { EmpresaCliente, RegistroVacacion } from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  getVacacionesByCliente,
  saveRegistroVacacion,
  deleteRegistroVacacion,
  marcarVacacionComunicadaMtess,
  generarPlanillaVacacionesMtessCSV,
  calcularDiasVacacionesSegunAntiguedad,
} from '../services/clientStorageService';
import { generarNotaConcesionVacacionesPDF, sumarDiasISO } from '../generators/vacationNoticePdfGenerator';
import { CompactDatePicker } from '../../payroll/components/CompactDatePicker';

interface Props {
  empresa: EmpresaCliente;
}

function generateVacId(): string {
  return `vac_${Date.now()}`;
}

function generateComprobanteCode(): string {
  return `REOP-VAC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
}

export const VacationsManagementTab: React.FC<Props> = ({ empresa }) => {
  const [subTab, setSubTab] = useState<'real' | 'mtess'>('real');
  const empleados = getEmpleadosByCliente(empresa.id).filter(e => e.estado !== 'inactivo');
  const [vacaciones, setVacaciones] = useState<RegistroVacacion[]>(() => getVacacionesByCliente(empresa.id));

  // Modal para Nuevo/Editar Usufructo Real
  const [isRealModalOpen, setIsRealModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(empleados[0]?.id || '');
  const [periodoAnho, setPeriodoAnho] = useState<number>(new Date().getFullYear());
  const [fechaInicioReal, setFechaInicioReal] = useState<string>('');
  const [fechaFinReal, setFechaFinReal] = useState<string>('');
  const [diasUsufructuados, setDiasUsufructuados] = useState<number>(12);
  const [esAdelantada, setEsAdelantada] = useState<boolean>(false);
  const [autorizadoPorEmpleador, setAutorizadoPorEmpleador] = useState<boolean>(true);
  const [notasReal, setNotasReal] = useState<string>('');

  // Modal para Comunicación MTESS REOP
  const [isMtessModalOpen, setIsMtessModalOpen] = useState(false);
  const [selectedVacacionId, setSelectedVacacionId] = useState<string>('');
  const [nroComprobanteMtess, setNroComprobanteMtess] = useState<string>('');
  const [mesMtess, setMesMtess] = useState<string>('2026-08');
  const [diasDeclaradosMtess, setDiasDeclaradosMtess] = useState<number>(12);

  // Filtro de búsqueda
  const [filtroTexto, setFiltroTexto] = useState('');

  // Estadísticas globales
  const totalCausados = vacaciones.reduce((sum, v) => sum + v.diasCorrespondientes, 0);
  const totalUsufructuados = vacaciones.reduce((sum, v) => sum + v.diasUsufructuadosReal, 0);
  const totalPendientes = vacaciones.reduce((sum, v) => sum + v.diasPendientesReal, 0);
  const totalComunicadosMtess = vacaciones.filter(v => v.comunicadoMtess).length;
  const totalPendientesMtess = vacaciones.filter(v => !v.comunicadoMtess && v.diasUsufructuadosReal > 0).length;

  const handleOpenNuevoUsufructo = () => {
    const emp = empleados[0];
    let defaultDias = 12;
    let autoAdelantada = false;
    if (emp) {
      setSelectedEmpId(emp.id);
      const { diasEscala } = calcularDiasVacacionesSegunAntiguedad(emp.fechaIngreso);
      autoAdelantada = diasEscala === 0;
      defaultDias = autoAdelantada ? 12 : (diasEscala || 12);
      setDiasUsufructuados(defaultDias);
    }
    setEsAdelantada(autoAdelantada);
    setAutorizadoPorEmpleador(true);
    setPeriodoAnho(new Date().getFullYear());
    setFechaInicioReal('');
    setFechaFinReal('');
    setNotasReal('');
    setIsRealModalOpen(true);
  };

  const handleFechaInicioChange = (nuevaFechaInicio: string) => {
    setFechaInicioReal(nuevaFechaInicio);
    if (nuevaFechaInicio && diasUsufructuados > 0) {
      setFechaFinReal(sumarDiasISO(nuevaFechaInicio, diasUsufructuados - 1));
    }
  };

  const handleDiasUsufructuadosChange = (nuevosDias: number) => {
    setDiasUsufructuados(nuevosDias);
    if (fechaInicioReal && nuevosDias > 0) {
      setFechaFinReal(sumarDiasISO(fechaInicioReal, nuevosDias - 1));
    }
  };

  const handleGuardarUsufructo = (e?: React.FormEvent, descargarPDF: boolean = false) => {
    if (e) e.preventDefault();
    const emp = empleados.find(em => em.id === selectedEmpId);
    if (!emp) return;

    if (esAdelantada && !autorizadoPorEmpleador) {
      alert('Las vacaciones adelantadas requieren la confirmación de autorización patronal.');
      return;
    }

    if (fechaInicioReal && fechaFinReal && fechaFinReal < fechaInicioReal) {
      alert('La fecha de finalización no puede ser anterior a la fecha de inicio.');
      return;
    }

    const { diasEscala } = calcularDiasVacacionesSegunAntiguedad(emp.fechaIngreso);
    
    let diasTotal: number;
    let tomados: number;
    let pendientes: number;

    if (esAdelantada) {
      // En vacaciones adelantadas autorizadas, no se trunca a escala causada cero
      diasTotal = diasUsufructuados;
      tomados = diasUsufructuados;
      pendientes = 0;
    } else {
      diasTotal = diasEscala || 12;
      tomados = Math.min(diasUsufructuados, diasTotal);
      pendientes = Math.max(0, diasTotal - tomados);
    }

    // Calcular fecha límite de usufructo (Art. 224: dentro de los 6 meses de causado el derecho)
    const fIng = new Date(emp.fechaIngreso);
    const fechaLimite = new Date(fIng);
    fechaLimite.setFullYear(periodoAnho + 1);
    fechaLimite.setMonth(fechaLimite.getMonth() + 6);

    let estadoReal: RegistroVacacion['estadoReal'] = 'pendiente';
    if (tomados >= diasTotal) estadoReal = 'gozado';
    else if (tomados > 0) estadoReal = 'fraccionado';
    else if (fechaInicioReal) estadoReal = 'en_curso';

    const fechaFinCalculada = fechaFinReal || (fechaInicioReal ? sumarDiasISO(fechaInicioReal, tomados - 1) : undefined);

    const nuevoRegistro: RegistroVacacion = {
      id: generateVacId(),
      clienteId: empresa.id,
      empleadoId: emp.id,
      periodoAnho,
      diasCorrespondientes: diasTotal,
      fechaInicioReal: fechaInicioReal || undefined,
      fechaFinReal: fechaFinCalculada,
      diasUsufructuadosReal: tomados,
      diasPendientesReal: pendientes,
      estadoReal,
      fechaLimiteUsufructo: fechaLimite.toISOString().split('T')[0],
      comunicadoMtess: false,
      esAdelantada: esAdelantada || undefined,
      autorizadoPorEmpleador: esAdelantada ? autorizadoPorEmpleador : undefined,
      notas: notasReal || undefined,
      createdAt: new Date().toISOString(),
    };

    saveRegistroVacacion(nuevoRegistro);
    setVacaciones(getVacacionesByCliente(empresa.id));

    if (descargarPDF) {
      try {
        const doc = generarNotaConcesionVacacionesPDF(nuevoRegistro, emp, empresa);
        const tipoArchivo = nuevoRegistro.esAdelantada ? 'ADELANTADAS' : 'ORDINARIAS';
        doc.save(`NOTA_VACACIONES_${tipoArchivo}_${emp.ci}_PERIODO_${nuevoRegistro.periodoAnho}.pdf`);
      } catch (err) {
        console.error('Error al generar PDF de vacaciones:', err);
      }
    }

    setIsRealModalOpen(false);
  };

  const handleEliminarVacacion = (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este registro de vacaciones?')) {
      deleteRegistroVacacion(id);
      setVacaciones(getVacacionesByCliente(empresa.id));
    }
  };

  const handleDescargarNotaPDF = (vac: RegistroVacacion) => {
    const emp = empleados.find(e => e.id === vac.empleadoId);
    if (!emp) return;
    const doc = generarNotaConcesionVacacionesPDF(vac, emp, empresa);
    doc.save(`NOTA_CONCESION_VACACIONES_${emp.ci}_PERIODO_${vac.periodoAnho}.pdf`);
  };

  const handleAbrirDeclaracionMtess = (vac: RegistroVacacion) => {
    setSelectedVacacionId(vac.id);
    setNroComprobanteMtess(generateComprobanteCode());
    setMesMtess(new Date().toISOString().slice(0, 7));
    setDiasDeclaradosMtess(vac.diasUsufructuadosReal || vac.diasCorrespondientes);
    setIsMtessModalOpen(true);
  };

  const handleConfirmarMtess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacacionId || !nroComprobanteMtess.trim()) return;

    marcarVacacionComunicadaMtess(selectedVacacionId, nroComprobanteMtess, mesMtess, diasDeclaradosMtess);
    setVacaciones(getVacacionesByCliente(empresa.id));
    setIsMtessModalOpen(false);
  };

  const handleExportarCSV = () => {
    const csvContent = generarPlanillaVacacionesMtessCSV(vacaciones, empleados, empresa);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MTESS_PLANILLA_VACACIONES_REOP_${empresa.ruc}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const vacacionesFiltradas = vacaciones.filter(v => {
    const emp = empleados.find(e => e.id === v.empleadoId);
    if (!filtroTexto.trim()) return true;
    const term = filtroTexto.toLowerCase();
    return (
      emp?.nombres.toLowerCase().includes(term) ||
      emp?.apellidos.toLowerCase().includes(term) ||
      emp?.ci.includes(term) ||
      v.periodoAnho.toString().includes(term) ||
      v.nroComprobanteMtess?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Encabezado y Explicación Legal ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>🏖️</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              Gestor Integral de Vacaciones (Reales vs. MTESS)
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Control dual de descansos reales otorgados al trabajador (Arts. 218 a 226 Código del Trabajo) y declaraciones mensuales obligatorias en el sistema REOP del MTESS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleOpenNuevoUsufructo}
            style={{
              padding: '10px 16px',
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
          >
            <span>➕</span>
            <span>Registrar Período / Usufructo</span>
          </button>
          <button
            onClick={handleExportarCSV}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#0f766e',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Exportar archivo CSV con estructura para comunicación mensual en REOP"
          >
            <span>📥</span>
            <span>Planilla REOP (CSV)</span>
          </button>
        </div>
      </div>

      {/* ── Tarjetas Métricas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Días Causados Totales
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            {totalCausados} días
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Según escala Art. 218</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
            Días Gozados Reales
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {totalUsufructuados} días
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Usufructo efectivo con nota firmada</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
            Días Pendientes de Goce
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
            {totalPendientes} días
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>A conceder antes de 6 meses (Art. 224)</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>
            Estado MTESS REOP
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a' }}>
              {totalComunicadosMtess} OK
            </span>
            {totalPendientesMtess > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626' }}>
                ({totalPendientesMtess} pendientes)
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Declaración mensual reglamentaria</div>
        </div>
      </div>

      {/* ── Selector de Sub-Pestaña ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => setSubTab('real')}
          style={{
            padding: '10px 18px',
            background: subTab === 'real' ? '#0284c7' : 'transparent',
            color: subTab === 'real' ? '#ffffff' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🏖️</span>
          <span>1. Vacaciones Reales (Control Interno & Descansos)</span>
        </button>

        <button
          onClick={() => setSubTab('mtess')}
          style={{
            padding: '10px 18px',
            background: subTab === 'mtess' ? '#0f766e' : 'transparent',
            color: subTab === 'mtess' ? '#ffffff' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>⚖️</span>
          <span>2. Comunicaciones Mensuales al MTESS (Sistema REOP)</span>
        </button>
      </div>

      {/* ── Buscador y Filtro ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por empleado, CI o comprobante..."
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
            width: '320px',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: '12.5px', color: '#64748b' }}>
          Mostrando <strong>{vacacionesFiltradas.length}</strong> registro(s)
        </div>
      </div>

      {/* ── SUB-TAB 1: VACACIONES REALES ── */}
      {subTab === 'real' && (
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
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Empleado</th>
                  <th style={{ padding: '12px 16px' }}>Período</th>
                  <th style={{ padding: '12px 16px' }}>Días Ley (Art. 218)</th>
                  <th style={{ padding: '12px 16px' }}>Fechas Reales</th>
                  <th style={{ padding: '12px 16px' }}>Gozados</th>
                  <th style={{ padding: '12px 16px' }}>Pendientes</th>
                  <th style={{ padding: '12px 16px' }}>Límite Usufructo (Art. 224)</th>
                  <th style={{ padding: '12px 16px' }}>Estado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vacacionesFiltradas.map(vac => {
                  const emp = empleados.find(e => e.id === vac.empleadoId);
                  const fIng = emp ? new Date(emp.fechaIngreso) : new Date();
                  const anhosAntig = Math.floor((new Date().getTime() - fIng.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

                  return (
                    <tr key={vac.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {emp ? `${emp.nombres} ${emp.apellidos}` : 'Empleado no encontrado'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          CI: {emp?.ci} · {anhosAntig} años antig.
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>
                        Período {vac.periodoAnho}
                        {vac.esAdelantada && (
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                              }}
                              title="Vacaciones otorgadas por adelantado con autorización patronal"
                            >
                              🏖️ Adelantadas (Autorizadas)
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{vac.diasCorrespondientes}</span> días
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          {vac.diasCorrespondientes === 12 ? '1 a 5 años' : vac.diasCorrespondientes === 18 ? '5 a 10 años' : '> 10 años'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {vac.fechaInicioReal ? (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Del <strong>{vac.fechaInicioReal}</strong> al <strong>{vac.fechaFinReal}</strong>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin fecha fijada</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#059669' }}>
                        {vac.diasUsufructuadosReal} días
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: vac.diasPendientesReal > 0 ? '#d97706' : '#64748b' }}>
                        {vac.diasPendientesReal} días
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                          {vac.fechaLimiteUsufructo}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          6 meses pos causación
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background:
                              vac.estadoReal === 'gozado'
                                ? '#dcfce7'
                                : vac.estadoReal === 'fraccionado'
                                ? '#fef3c7'
                                : vac.estadoReal === 'en_curso'
                                ? '#dbeafe'
                                : '#f1f5f9',
                            color:
                              vac.estadoReal === 'gozado'
                                ? '#166534'
                                : vac.estadoReal === 'fraccionado'
                                ? '#92400e'
                                : vac.estadoReal === 'en_curso'
                                ? '#1e40af'
                                : '#475569',
                          }}
                        >
                          {vac.estadoReal === 'gozado'
                            ? 'Completado'
                            : vac.estadoReal === 'fraccionado'
                            ? 'Fraccionado'
                            : vac.estadoReal === 'en_curso'
                            ? 'En curso'
                            : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleDescargarNotaPDF(vac)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              color: '#0369a1',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Descargar Notificación y Recibo de Vacaciones (Arts. 218, 222 y 225) para firma de conformidad"
                          >
                            <span>📄</span>
                            <span>PDF para Firma</span>
                          </button>
                          <button
                            onClick={() => handleEliminarVacacion(vac.id)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid #fca5a5',
                              color: '#991b1b',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                            title="Eliminar registro"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: COMUNICACIONES AL MTESS (REOP) ── */}
      {subTab === 'mtess' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Banner Explicativo REOP */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: '24px' }}>⚖️</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#166534' }}>
                Cumplimiento Mensual ante el MTESS (Resolución REOP de Comunicación de Vacaciones)
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#15803d' }}>
                En Paraguay, además del acuerdo interno de goce con el trabajador, la patronal debe comunicar al Registro Obrero Patronal (REOP) las vacaciones causadas y usufructuadas mensualmente. La omisión puede generar sumarios administrativos y multas laborales.
              </p>
            </div>
          </div>

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
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Empleado</th>
                    <th style={{ padding: '12px 16px' }}>Período</th>
                    <th style={{ padding: '12px 16px' }}>Días Reales</th>
                    <th style={{ padding: '12px 16px' }}>Días Declarados MTESS</th>
                    <th style={{ padding: '12px 16px' }}>Estado Comunicación</th>
                    <th style={{ padding: '12px 16px' }}>N.º Comprobante REOP</th>
                    <th style={{ padding: '12px 16px' }}>Mes Declarado</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vacacionesFiltradas.map(vac => {
                    const emp = empleados.find(e => e.id === vac.empleadoId);
                    const brecha = vac.diasUsufructuadosReal - (vac.diasComunicadosMtess || 0);

                    return (
                      <tr key={vac.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {emp ? `${emp.nombres} ${emp.apellidos}` : 'N/D'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>CI: {emp?.ci}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f766e' }}>
                          Período {vac.periodoAnho}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                          {vac.diasUsufructuadosReal} días
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: vac.comunicadoMtess ? '#16a34a' : '#94a3b8' }}>
                          {vac.diasComunicadosMtess || 0} días
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {vac.comunicadoMtess ? (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#166534',
                              }}
                            >
                              ✅ Declarado en REOP
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#991b1b',
                              }}
                            >
                              {brecha > 0 ? `⚠️ Pendiente (${brecha}d sin reportar)` : '⚪ Sin goce aún'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {vac.nroComprobanteMtess ? (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                              {vac.nroComprobanteMtess}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin comprobante</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {vac.mesComunicacionMtess || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleAbrirDeclaracionMtess(vac)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: vac.comunicadoMtess ? '#f1f5f9' : '#0f766e',
                              color: vac.comunicadoMtess ? '#334155' : '#ffffff',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {vac.comunicadoMtess ? 'Actualizar REOP' : 'Registrar REOP'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR USUFRUCTO REAL ── */}
      {isRealModalOpen && (
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
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                ➕ Registrar Período / Usufructo de Vacaciones
              </h3>
              <button
                onClick={() => setIsRealModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarUsufructo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  Seleccionar Empleado:
                </label>
                <select
                  value={selectedEmpId}
                  onChange={e => {
                    const empId = e.target.value;
                    setSelectedEmpId(empId);
                    const emp = empleados.find(em => em.id === empId);
                    if (emp) {
                      const { diasEscala } = calcularDiasVacacionesSegunAntiguedad(emp.fechaIngreso);
                      const autoAdelantada = diasEscala === 0;
                      setEsAdelantada(autoAdelantada);
                      setAutorizadoPorEmpleador(true);
                      setDiasUsufructuados(autoAdelantada ? 12 : (diasEscala || 12));
                    }
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  required
                >
                  {empleados.map(emp => {
                    const { diasEscala } = calcularDiasVacacionesSegunAntiguedad(emp.fechaIngreso);
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombres} {emp.apellidos} (CI: {emp.ci}) — {diasEscala > 0 ? `${diasEscala} días por ley` : 'Menos de 1 año (Adelanto posible)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Panel Interactivo: Vacaciones Adelantadas con Autorización Patronal */}
              <div
                style={{
                  padding: '12px 14px',
                  background: esAdelantada ? '#ecfdf5' : '#f8fafc',
                  borderRadius: '10px',
                  border: esAdelantada ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={esAdelantada}
                    onChange={e => {
                      const checked = e.target.checked;
                      setEsAdelantada(checked);
                      if (checked) setAutorizadoPorEmpleador(true);
                    }}
                    style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: esAdelantada ? '#065f46' : '#1e293b' }}>
                      🏖️ ¿Vacaciones Adelantadas? (Con autorización patronal)
                    </div>
                    <div style={{ fontSize: '11.5px', color: esAdelantada ? '#047857' : '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
                      Permite otorgar días a cuenta del período vacacional que causará el trabajador, o anticipar descansos antes de cumplir el año de antigüedad (Art. 218 Ley N.º 213/93). Los días no se truncan.
                    </div>
                  </div>
                </label>

                {esAdelantada && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #a7f3d0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, color: '#065f46' }}>
                      <input
                        type="checkbox"
                        checked={autorizadoPorEmpleador}
                        onChange={e => setAutorizadoPorEmpleador(e.target.checked)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span>Autorizado formalmente por la parte empleadora</span>
                    </label>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#065f46', background: '#d1fae5', padding: '6px 10px', borderRadius: '6px' }}>
                      ⚖️ <strong>Respaldo Legal:</strong> Se generará el recibo oficial con el título de <em>Vacaciones Adelantadas (Con Autorización Patronal)</em> y la cláusula expresa de anticipo imputable a la causación.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    {esAdelantada ? 'Período Imputable:' : 'Período Anual Causado:'}
                  </label>
                  <input
                    type="number"
                    value={periodoAnho}
                    onChange={e => setPeriodoAnho(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Días a Usufructuar:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={diasUsufructuados}
                    onChange={e => handleDiasUsufructuadosChange(parseInt(e.target.value, 10) || 1)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    required
                  />
                  {esAdelantada && (
                    <span style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>
                      ✓ Se conceden {diasUsufructuados} días autorizados
                    </span>
                  )}
                </div>
              </div>

              {/* Herramientas de fechas consistentes con la calculadora de liquidación del landing (CompactDatePicker) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <CompactDatePicker
                    label="Fecha de Inicio"
                    value={fechaInicioReal}
                    onChange={handleFechaInicioChange}
                    quickAction={{
                      label: 'Hoy',
                      onClick: () => handleFechaInicioChange(new Date().toISOString().split('T')[0]),
                    }}
                  />
                </div>

                <div>
                  <CompactDatePicker
                    label="Fecha de Finalización"
                    value={fechaFinReal}
                    onChange={setFechaFinReal}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  Observaciones internas:
                </label>
                <textarea
                  rows={2}
                  value={notasReal}
                  onChange={e => setNotasReal(e.target.value)}
                  placeholder="Ej: Acordado fraccionamiento. Segundo tramo fijado para diciembre."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setIsRealModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}
                >
                  Cancelar
                </button>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={(e) => handleGuardarUsufructo(e, false)}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                  >
                    💾 Solo Guardar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleGuardarUsufructo(e, true)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#0284c7',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(2, 132, 199, 0.3)',
                    }}
                  >
                    <span>📄💾</span>
                    <span>Guardar y Descargar PDF para Firma</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR DECLARACIÓN MTESS REOP ── */}
      {isMtessModalOpen && (
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
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#0f172a' }}>
                ⚖️ Registrar Declaración Mensual MTESS (REOP)
              </h3>
              <button
                onClick={() => setIsMtessModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarMtess} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  N.º Comprobante Oficial Transacción REOP:
                </label>
                <input
                  type="text"
                  value={nroComprobanteMtess}
                  onChange={e => setNroComprobanteMtess(e.target.value)}
                  placeholder="Ej: REOP-VAC-2026-9912"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Identificador alfanumérico emitido al presentar la planilla mensual en la web del MTESS.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Mes Declarado:
                  </label>
                  <input
                    type="month"
                    value={mesMtess}
                    onChange={e => setMesMtess(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Días Declarados:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={diasDeclaradosMtess}
                    onChange={e => setDiasDeclaradosMtess(parseInt(e.target.value, 10) || 1)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsMtessModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Confirmar Declaración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
