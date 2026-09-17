/**
 * CONTRATOS Y ADENDAS LABORALES EN PDF (LEY N.º 213/93) — ERP LABORAPY
 * Generación, control de período de prueba, redacción de contratos y adendas modificatorias
 * Motivos de Adenda: Modificación Salarial/Comisiones, Traslados, Confidencialidad y Jornadas
 */

import React, { useState } from 'react';
import type {
  EmpresaCliente,
  Empleado,
  ContratoTrabajo,
  TipoContratoLaboral,
  AdendaContrato,
  MotivoAdenda,
} from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  getContratosByCliente,
  saveContratoTrabajo,
  getAdendasByCliente,
  getSiguienteNroAdenda,
  saveAdendaContrato,
  deleteAdendaContrato,
  formatPYG,
} from '../services/clientStorageService';
import { generarContratoTrabajoPDF } from '../generators/employmentContractPdfGenerator';
import { generarAdendaContratoPDF } from '../generators/addendumPdfGenerator';

interface Props {
  empresa: EmpresaCliente;
}

const BADGES_MOTIVOS: Record<MotivoAdenda, { label: string; bg: string; color: string; icon: string; refLegal: string }> = {
  modificacion_salarial: {
    label: 'Modificación Salarial',
    bg: '#eff6ff',
    color: '#0284c7',
    icon: '💰',
    refLegal: 'Arts. 230-231 C.T.',
  },
  traslado_sucursal: {
    label: 'Traslado de Sucursal',
    bg: '#f0fdf4',
    color: '#15803d',
    icon: '🏢',
    refLegal: 'Arts. 67, 72 C.T.',
  },
  confidencialidad_nda: {
    label: 'Confidencialidad / NDA',
    bg: '#faf5ff',
    color: '#7e22ce',
    icon: '🔒',
    refLegal: 'Art. 65 inc. g C.T.',
  },
  cambio_jornada_teletrabajo: {
    label: 'Jornada / Teletrabajo',
    bg: '#fffbeb',
    color: '#b45309',
    icon: '⏰',
    refLegal: 'Ley N.º 6738/21',
  },
  otro: {
    label: 'Otro Motivo',
    bg: '#f1f5f9',
    color: '#64748b',
    icon: '📄',
    refLegal: 'Ley N.º 213/93',
  },
};

export const EmploymentContractsTab: React.FC<Props> = ({ empresa }) => {
  const [empleados] = useState<Empleado[]>(() => getEmpleadosByCliente(empresa.id));
  const [contratos, setContratos] = useState<ContratoTrabajo[]>(() => getContratosByCliente(empresa.id));
  const [adendas, setAdendas] = useState<AdendaContrato[]>(() => getAdendasByCliente(empresa.id));

  // Sub-pestaña activa: 'contratos' | 'adendas'
  const [subTab, setSubTab] = useState<'contratos' | 'adendas'>('contratos');

  // Filtro de motivo para adendas
  const [filtroMotivo, setFiltroMotivo] = useState<string>('todos');

  // ── Modales ──
  const [isModalContratoOpen, setIsModalContratoOpen] = useState(false);
  const [isModalAdendaOpen, setIsModalAdendaOpen] = useState(false);

  // ── Formulario Nuevo Contrato ──
  const [selectedEmpId, setSelectedEmpId] = useState<string>(empleados[0]?.id || '');
  const [tipoContrato, setTipoContrato] = useState<TipoContratoLaboral>('indefinido');
  const [fechaInicio, setFechaInicio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState<string>('');
  const [diasPrueba, setDiasPrueba] = useState<number | ''>(30);
  const [salario, setSalario] = useState<number | ''>(empleados[0]?.salarioBase || 2800000);
  const [jornada, setJornada] = useState<string>('48 horas semanales (Lunes a Sábado)');
  const [horarioInicio, setHorarioInicio] = useState<string>('08:00');
  const [horarioFin, setHorarioFin] = useState<string>('17:00');
  const [lugar, setLugar] = useState<string>(empresa.direccion);
  const [seccionAsignada, setSeccionAsignada] = useState<string>('Tienda y Ventas');
  const [tieneAbsorcion, setTieneAbsorcion] = useState<boolean>(false);
  const [empresaAnterior, setEmpresaAnterior] = useState<string>('');
  const [fechaIngresoAnterior, setFechaIngresoAnterior] = useState<string>('01/01/2021');
  const [clausulas, setClausulas] = useState<string>('Sujeto a período de prueba legal. Confidencialidad y lealtad laboral.');

  // ── Formulario Nueva Adenda ──
  const [adendaEmpId, setAdendaEmpId] = useState<string>(empleados[0]?.id || '');
  const [adendaMotivo, setAdendaMotivo] = useState<MotivoAdenda>('modificacion_salarial');
  const [adendaTitulo, setAdendaTitulo] = useState<string>('Actualización de Remuneración y Régimen Salarial');
  const [adendaFechaEmision, setAdendaFechaEmision] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adendaFechaVigencia, setAdendaFechaVigencia] = useState<string>(new Date().toISOString().split('T')[0]);

  // Campos específicos de adenda
  const [salarioAnterior, setSalarioAnterior] = useState<number | ''>(empleados[0]?.salarioBase || 3000000);
  const [nuevoSalario, setNuevoSalario] = useState<number | ''>((empleados[0]?.salarioBase || 3000000) + 500000);
  const [detalleComisiones, setDetalleComisiones] = useState<string>('2% sobre cobranzas efectivas del mes.');

  const [lugarAnterior, setLugarAnterior] = useState<string>(empresa.direccion);
  const [nuevoLugar, setNuevoLugar] = useState<string>('Sucursal Este - Km 4, Ciudad del Este');
  const [compensacionTraslado, setCompensacionTraslado] = useState<string>('Asignación mensual no remunerativa de Gs. 1.000.000 para movilidad.');

  const [alcanceConfidencialidad, setAlcanceConfidencialidad] = useState<string>(
    'Bases de datos de clientes, código fuente, secretos industriales, know-how y políticas comerciales.'
  );
  const [penalidadIncumplimiento, setPenalidadIncumplimiento] = useState<string>(
    'Causal de despido justificado bajo Art. 81 inc. c y h del Código del Trabajo, más resarcimiento de daños y perjuicios.'
  );

  const [nuevaJornada, setNuevaJornada] = useState<string>('40 horas semanales en modalidad híbrida (3 presenciales, 2 teletrabajo)');
  const [nuevoHorario, setNuevoHorario] = useState<string>('08:30 a 17:00 horas');
  const [clausulasEspecificas, setClausulasEspecificas] = useState<string>('');

  const handleEmpleadoContratoChange = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = empleados.find(e => e.id === empId);
    if (emp) {
      setSalario(emp.salarioBase);
      setFechaInicio(emp.fechaIngreso);
    }
  };

  const handleEmpleadoAdendaChange = (empId: string) => {
    setAdendaEmpId(empId);
    const emp = empleados.find(e => e.id === empId);
    if (emp) {
      setSalarioAnterior(emp.salarioBase);
      setNuevoSalario(emp.salarioBase + 500000);
    }
  };

  const handleMotivoAdendaChange = (motivo: MotivoAdenda) => {
    setAdendaMotivo(motivo);
    if (motivo === 'modificacion_salarial') {
      setAdendaTitulo('Modificación de Remuneración y Comisiones');
    } else if (motivo === 'traslado_sucursal') {
      setAdendaTitulo('Traslado de Lugar de Trabajo y Establecimiento');
    } else if (motivo === 'confidencialidad_nda') {
      setAdendaTitulo('Pacto Especial de Confidencialidad, Secreto y No Concurrencia');
    } else if (motivo === 'cambio_jornada_teletrabajo') {
      setAdendaTitulo('Adecuación de Jornada Laboral y Teletrabajo');
    } else {
      setAdendaTitulo('Modificación de Estipulaciones Contractuales');
    }
  };

  const handleCrearContrato = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = empleados.find(e => e.id === selectedEmpId);
    if (!emp) return;

    const nuevo: ContratoTrabajo = {
      id: `cto_${Date.now()}`,
      clienteId: empresa.id,
      empleadoId: emp.id,
      tipoContrato,
      fechaInicio,
      fechaFin: tipoContrato === 'plazo_fijo' ? fechaFin : undefined,
      periodoPruebaDias: Number(diasPrueba) || 30,
      salarioPactado: Number(salario) || 0,
      jornadaLaboral: jornada,
      horarioInicio,
      horarioFin,
      lugarPrestacion: lugar,
      seccionAsignada: seccionAsignada || undefined,
      absorcionAntiguedad: tieneAbsorcion && empresaAnterior ? {
        empresaAnterior,
        fechaIngresoAnterior: fechaIngresoAnterior || '01/01/2021',
      } : undefined,
      clausulasAdicionales: clausulas,
      estado: 'firmado',
      createdAt: new Date().toISOString(),
    };

    saveContratoTrabajo(nuevo);
    setContratos(getContratosByCliente(empresa.id));
    setIsModalContratoOpen(false);

    // Descarga automática inmediata
    const pdf = generarContratoTrabajoPDF(nuevo, emp, empresa);
    pdf.save(`CONTRATO_${emp.ci.replace(/\D/g, '')}_${tipoContrato.toUpperCase()}.pdf`);
  };

  const handleDescargarContratoPDF = (contrato: ContratoTrabajo) => {
    const emp = empleados.find(e => e.id === contrato.empleadoId);
    if (!emp) return;
    const pdf = generarContratoTrabajoPDF(contrato, emp, empresa);
    pdf.save(`CONTRATO_${emp.ci.replace(/\D/g, '')}_${contrato.tipoContrato.toUpperCase()}.pdf`);
  };

  const handleCrearAdenda = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = empleados.find(e => e.id === adendaEmpId);
    if (!emp) return;

    const nroAdenda = getSiguienteNroAdenda(empresa.id, emp.id);

    const nuevaAdenda: AdendaContrato = {
      id: `ade_${Date.now()}`,
      clienteId: empresa.id,
      empleadoId: emp.id,
      fechaContratoOriginal: emp.fechaIngreso,
      nroAdenda,
      motivo: adendaMotivo,
      tituloAdenda: adendaTitulo,
      fechaEmision: adendaFechaEmision,
      fechaVigencia: adendaFechaVigencia,
      salarioAnterior: adendaMotivo === 'modificacion_salarial' ? (Number(salarioAnterior) || 0) : undefined,
      nuevoSalario: adendaMotivo === 'modificacion_salarial' ? (Number(nuevoSalario) || 0) : undefined,
      detalleComisiones: adendaMotivo === 'modificacion_salarial' ? detalleComisiones : undefined,
      lugarAnterior: adendaMotivo === 'traslado_sucursal' ? lugarAnterior : undefined,
      nuevoLugar: adendaMotivo === 'traslado_sucursal' ? nuevoLugar : undefined,
      compensacionTraslado: adendaMotivo === 'traslado_sucursal' ? compensacionTraslado : undefined,
      alcanceConfidencialidad: adendaMotivo === 'confidencialidad_nda' ? alcanceConfidencialidad : undefined,
      penalidadIncumplimiento: adendaMotivo === 'confidencialidad_nda' ? penalidadIncumplimiento : undefined,
      nuevaJornada: adendaMotivo === 'cambio_jornada_teletrabajo' ? nuevaJornada : undefined,
      nuevoHorario: adendaMotivo === 'cambio_jornada_teletrabajo' ? nuevoHorario : undefined,
      clausulasEspecificas: adendaMotivo === 'otro' ? clausulasEspecificas : undefined,
      estado: 'firmado',
      createdAt: new Date().toISOString(),
    };

    saveAdendaContrato(nuevaAdenda);
    setAdendas(getAdendasByCliente(empresa.id));
    setIsModalAdendaOpen(false);

    // Descarga automática inmediata
    const pdf = generarAdendaContratoPDF(nuevaAdenda, emp, empresa);
    pdf.save(`ADENDA_${nuevaAdenda.nroAdenda}_${adendaMotivo.toUpperCase()}_${emp.ci.replace(/\D/g, '')}.pdf`);
  };

  const handleDescargarAdendaPDF = (adenda: AdendaContrato) => {
    const emp = empleados.find(e => e.id === adenda.empleadoId);
    if (!emp) return;
    const pdf = generarAdendaContratoPDF(adenda, emp, empresa);
    pdf.save(`ADENDA_${adenda.nroAdenda}_${adenda.motivo.toUpperCase()}_${emp.ci.replace(/\D/g, '')}.pdf`);
  };

  const handleEliminarAdenda = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta adenda contractual?')) {
      deleteAdendaContrato(id);
      setAdendas(getAdendasByCliente(empresa.id));
    }
  };

  const adendasFiltradas = adendas.filter(a => {
    if (filtroMotivo === 'todos') return true;
    return a.motivo === filtroMotivo;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Selector de Sub-pestaña (Segmented Control) ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: '#f8fafc',
          padding: '6px',
          borderRadius: '10px',
          width: 'fit-content',
        }}
      >
        <button
          onClick={() => setSubTab('contratos')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: subTab === 'contratos' ? '#0f172a' : 'transparent',
            color: subTab === 'contratos' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📄</span>
          <span>Contratos de Trabajo ({contratos.length})</span>
        </button>

        <button
          onClick={() => setSubTab('adendas')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: subTab === 'adendas' ? '#0284c7' : 'transparent',
            color: subTab === 'adendas' ? '#ffffff' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📑</span>
          <span>Adendas Contractuales ({adendas.length})</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: CONTRATOS DE TRABAJO                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'contratos' && (
        <>
          {/* Encabezado y Botón de Emisión de Contratos */}
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
              gap: '14px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Contratos de Trabajo Formalizados (Ley N.º 213/93)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                Generación y descarga directa en PDF con cláusulas de período de prueba, confidencialidad y fueros.
              </p>
            </div>

            <button
              onClick={() => setIsModalContratoOpen(true)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: '#ffffff',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(15, 23, 42, 0.2)',
              }}
            >
              <span>✍️</span>
              <span>Redactar Nuevo Contrato</span>
            </button>
          </div>

          {/* Tabla de Contratos */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>EMPLEADO / C.I.</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>MODALIDAD</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>FECHA INICIO</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>PERÍODO DE PRUEBA</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>SALARIO PACTADO</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>ESTADO</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                        No hay contratos generados para esta empresa.
                      </td>
                    </tr>
                  ) : (
                    contratos.map((cto, idx) => {
                      const emp = empleados.find(e => e.id === cto.empleadoId);
                      return (
                        <tr
                          key={cto.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>
                              {emp ? `${emp.nombres} ${emp.apellidos}` : 'Empleado'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              C.I. N.º {emp?.ci} · Cargo: {emp?.cargo}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 700, color: '#64748b', textTransform: 'capitalize' }}>
                              {cto.tipoContrato.replace('_', ' ')}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', color: '#64748b' }}>
                            {cto.fechaInicio}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}>
                              {cto.periodoPruebaDias} días
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                            {formatPYG(cto.salarioPactado)}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                              {cto.estado}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDescargarContratoPDF(cto)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#0284c7',
                                border: 'none',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>📄</span>
                              <span>Descargar PDF</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: ADENDAS CONTRACTUALES                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'adendas' && (
        <>
          {/* Encabezado y Botón de Emisión de Adendas */}
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
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Generador de Adendas al Contrato de Trabajo
                </h3>
                <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0369a1', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                  Ley N.º 213/93 C.T.
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Acuerdos modificatorios formales para traslados de sucursal, pactos de confidencialidad y cambios de salario o comisiones.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Filtro de Motivo */}
              <select
                value={filtroMotivo}
                onChange={e => setFiltroMotivo(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12.5px',
                  background: '#ffffff',
                  color: '#64748b',
                  fontWeight: 600,
                }}
              >
                <option value="todos">Todos los Motivos</option>
                <option value="modificacion_salarial">💰 Modificación Salarial</option>
                <option value="traslado_sucursal">🏢 Traslado de Sucursal</option>
                <option value="confidencialidad_nda">🔒 Confidencialidad / NDA</option>
                <option value="cambio_jornada_teletrabajo">⏰ Jornada / Teletrabajo</option>
              </select>

              <button
                onClick={() => setIsModalAdendaOpen(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                }}
              >
                <span>➕</span>
                <span>Redactar Nueva Adenda</span>
              </button>
            </div>
          </div>

          {/* Tabla de Adendas */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>EMPLEADO / C.I.</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>ADENDA</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>MOTIVO Y BASE LEGAL</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>VIGENCIA</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>MODIFICACIÓN PRINCIPAL</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {adendasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        No hay adendas registradas con el criterio seleccionado.
                      </td>
                    </tr>
                  ) : (
                    adendasFiltradas.map((ade, idx) => {
                      const emp = empleados.find(e => e.id === ade.empleadoId);
                      const badge = BADGES_MOTIVOS[ade.motivo] || BADGES_MOTIVOS.otro;

                      return (
                        <tr
                          key={ade.id}
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
                              C.I. {emp?.ci} · {emp?.cargo}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 800, color: '#0284c7', background: '#f0f9ff', padding: '3px 8px', borderRadius: '6px' }}>
                              N.º {ade.nroAdenda}
                            </span>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                              Emisión: {ade.fechaEmision}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
                              <span>{badge.icon}</span>
                              <span>{badge.label}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                              {badge.refLegal}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>
                            {ade.fechaVigencia}
                          </td>

                          <td style={{ padding: '12px 16px', maxWidth: '320px' }}>
                            {ade.motivo === 'modificacion_salarial' && (
                              <div>
                                <strong style={{ color: '#0f172a' }}>
                                  {formatPYG(ade.salarioAnterior || 0)} → {formatPYG(ade.nuevoSalario || 0)}
                                </strong>
                                {ade.detalleComisiones && (
                                  <div style={{ fontSize: '11.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ade.detalleComisiones}
                                  </div>
                                )}
                              </div>
                            )}

                            {ade.motivo === 'traslado_sucursal' && (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                <div><strong>Nueva Sede:</strong> {ade.nuevoLugar}</div>
                                {ade.compensacionTraslado && (
                                  <div style={{ fontSize: '11px', color: '#16a34a' }}>Viáticos: {ade.compensacionTraslado}</div>
                                )}
                              </div>
                            )}

                            {ade.motivo === 'confidencialidad_nda' && (
                              <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ade.alcanceConfidencialidad || 'Deber de secreto profesional reforzado.'}
                              </div>
                            )}

                            {ade.motivo === 'cambio_jornada_teletrabajo' && (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                <div>{ade.nuevaJornada}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{ade.nuevoHorario}</div>
                              </div>
                            )}

                            {ade.motivo === 'otro' && (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {ade.tituloAdenda}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => handleDescargarAdendaPDF(ade)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  background: '#0284c7',
                                  border: 'none',
                                  color: '#fff',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>📄</span>
                                <span>Descargar PDF</span>
                              </button>

                              <button
                                onClick={() => handleEliminarAdenda(ade.id)}
                                title="Eliminar Adenda"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: 'none',
                                  color: '#dc2626',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                🗑️
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: NUEVO CONTRATO DE TRABAJO                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isModalContratoOpen && (
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
          onClick={() => setIsModalContratoOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '600px',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#ffffff', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Generar Contrato Laboral en PDF
              </h3>
              <button
                onClick={() => setIsModalContratoOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearContrato} style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Seleccionar Empleado *
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={e => handleEmpleadoContratoChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff' }}
                  >
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.nombres} {e.apellidos} (CI: {e.ci} - {e.cargo})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Tipo de Contrato *
                    </label>
                    <select
                      value={tipoContrato}
                      onChange={e => setTipoContrato(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff' }}
                    >
                      <option value="indefinido">Tiempo Indefinido</option>
                      <option value="plazo_fijo">A Plazo Determinado</option>
                      <option value="tiempo_parcial">Tiempo Parcial (Ley 6339/19)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Período de Prueba (Art. 58)
                    </label>
                    <select
                      value={diasPrueba}
                      onChange={e => setDiasPrueba(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff' }}
                    >
                      <option value={30}>30 Días (Trabajadores generales)</option>
                      <option value={60}>60 Días (Trabajadores calificados)</option>
                      <option value={90}>90 Días (Técnicos o personal de confianza)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Fecha de Inicio *
                    </label>
                    <input
                      type="date"
                      required
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {tipoContrato === 'plazo_fijo' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Fecha de Vencimiento *
                      </label>
                      <input
                        type="date"
                        required
                        value={fechaFin}
                        onChange={e => setFechaFin(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Salario Mensual Pactado (PYG) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={salario}
                        onChange={e => {
                          const val = e.target.value;
                          setSalario(val === '' ? '' : Math.max(0, Number(val)));
                        }}
                        onFocus={e => e.target.select()}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>

                {tipoContrato === 'plazo_fijo' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Salario Mensual Pactado (PYG) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={salario}
                      onChange={e => {
                        const val = e.target.value;
                        setSalario(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Jornada Laboral
                  </label>
                  <input
                    type="text"
                    value={jornada}
                    onChange={e => setJornada(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Horario Entrada
                    </label>
                    <input
                      type="time"
                      value={horarioInicio}
                      onChange={e => setHorarioInicio(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Horario Salida
                    </label>
                    <input
                      type="time"
                      value={horarioFin}
                      onChange={e => setHorarioFin(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Sección Asignada (Modalidad Primera)
                  </label>
                  <input
                    type="text"
                    value={seccionAsignada}
                    onChange={e => setSeccionAsignada(e.target.value)}
                    placeholder="Ej. TIENDA, VENTAS, DEPÓSITO, MARKETING"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tieneAbsorcion}
                      onChange={e => setTieneAbsorcion(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>🏛️ Cláusula Especial de Absorción y Reconocimiento de Antigüedad</span>
                  </label>

                  {tieneAbsorcion && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                          Empresa Anterior
                        </label>
                        <input
                          type="text"
                          value={empresaAnterior}
                          onChange={e => setEmpresaAnterior(e.target.value)}
                          placeholder="Ej. EMPRESA ANTERIOR S.A."
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                          Fecha de Ingreso Acumulada
                        </label>
                        <input
                          type="text"
                          value={fechaIngresoAnterior}
                          onChange={e => setFechaIngresoAnterior(e.target.value)}
                          placeholder="dd/mm/aaaa (Ej. 01/07/2021)"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Lugar de Prestación
                  </label>
                  <input
                    type="text"
                    value={lugar}
                    onChange={e => setLugar(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Cláusulas Adicionales / Acuerdos
                  </label>
                  <input
                    type="text"
                    value={clausulas}
                    onChange={e => setClausulas(e.target.value)}
                    placeholder="Confidencialidad, uso de herramientas, etc."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalContratoOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '6px', background: '#ffffff', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Generar y Descargar PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: REDACTAR NUEVA ADENDA CONTRACTUAL                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isModalAdendaOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsModalAdendaOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '680px',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Redactar Adenda al Contrato de Trabajo
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.9 }}>
                  Acuerdo modificatorio conforme a la Ley N.º 213/93 del Código del Trabajo
                </p>
              </div>
              <button
                onClick={() => setIsModalAdendaOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearAdenda} style={{ padding: '24px', maxHeight: '78vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                {/* 1. Selección de Empleado */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Seleccionar Colaborador *
                  </label>
                  <select
                    value={adendaEmpId}
                    onChange={e => handleEmpleadoAdendaChange(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff' }}
                  >
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.nombres} {e.apellidos} (CI: {e.ci} · Salario Actual: {formatPYG(e.salarioBase)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Motivo de Adenda */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Motivo Legal de la Adenda *
                  </label>
                  <select
                    value={adendaMotivo}
                    onChange={e => handleMotivoAdendaChange(e.target.value as MotivoAdenda)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '2px solid #0284c7', fontSize: '13px', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
                  >
                    <option value="modificacion_salarial">💰 Modificación de Sueldo / Comisiones (Arts. 230 y 231 C.T.)</option>
                    <option value="traslado_sucursal">🏢 Traslado de Lugar de Trabajo / Sucursal (Arts. 67 y 72 C.T.)</option>
                    <option value="confidencialidad_nda">🔒 Pacto Especial de Confidencialidad y Secreto (Art. 65 inc. g C.T.)</option>
                    <option value="cambio_jornada_teletrabajo">⏰ Cambio de Horario / Teletrabajo (Ley N.º 6738/21)</option>
                    <option value="otro">📄 Otro Motivo / Cláusula Especial</option>
                  </select>
                </div>

                {/* Título de la Adenda */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Título del Instrumento
                  </label>
                  <input
                    type="text"
                    required
                    value={adendaTitulo}
                    onChange={e => setAdendaTitulo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Fechas de Emisión y Vigencia */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Fecha de Firma / Emisión *
                    </label>
                    <input
                      type="date"
                      required
                      value={adendaFechaEmision}
                      onChange={e => setAdendaFechaEmision(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Fecha de Entrada en Vigencia *
                    </label>
                    <input
                      type="date"
                      required
                      value={adendaFechaVigencia}
                      onChange={e => setAdendaFechaVigencia(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* ── CAMPOS CONDICIONALES POR MOTIVO ── */}

                {/* A) MODIFICACIÓN SALARIAL */}
                {adendaMotivo === 'modificacion_salarial' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0284c7' }}>
                      Detalles de Remuneración y Comisiones
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                          Salario Base Anterior (PYG)
                        </label>
                        <input
                          type="number"
                          value={salarioAnterior}
                          onChange={e => {
                            const val = e.target.value;
                            setSalarioAnterior(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                          Nuevo Salario Base Pactado (PYG) *
                        </label>
                        <input
                          type="number"
                          required
                          value={nuevoSalario}
                          onChange={e => {
                            const val = e.target.value;
                            setNuevoSalario(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '13px', boxSizing: 'border-box', fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Esquema de Comisiones, Premios o Metas (Opcional)
                      </label>
                      <input
                        type="text"
                        value={detalleComisiones}
                        onChange={e => setDetalleComisiones(e.target.value)}
                        placeholder="Ej.: 2% sobre cobranzas mensuales + Gs. 300.000 por cumplimiento de cuota"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}

                {/* B) TRASLADO DE SUCURSAL */}
                {adendaMotivo === 'traslado_sucursal' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#15803d' }}>
                      Movilidad Geográfica y Traslado de Establecimiento
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Establecimiento de Origen / Anterior
                      </label>
                      <input
                        type="text"
                        value={lugarAnterior}
                        onChange={e => setLugarAnterior(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>
                        Nuevo Establecimiento o Sucursal Asignada *
                      </label>
                      <input
                        type="text"
                        required
                        value={nuevoLugar}
                        onChange={e => setNuevoLugar(e.target.value)}
                        placeholder="Ej.: Sucursal Encarnación - Ruta 1 Km 3"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #22c55e', fontSize: '13px', boxSizing: 'border-box', fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Compensación por Traslado / Viáticos (Opcional)
                      </label>
                      <input
                        type="text"
                        value={compensacionTraslado}
                        onChange={e => setCompensacionTraslado(e.target.value)}
                        placeholder="Ej.: Asignación mensual no remunerativa de Gs. 800.000 para transporte"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}

                {/* C) CONFIDENCIALIDAD / NDA */}
                {adendaMotivo === 'confidencialidad_nda' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#7e22ce' }}>
                      Pacto de Deber de Reserva y No Concurrencia
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Alcance de la Información Protegida *
                      </label>
                      <textarea
                        rows={2}
                        value={alcanceConfidencialidad}
                        onChange={e => setAlcanceConfidencialidad(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Penalidades y Sanciones por Incumplimiento (Art. 81 C.T.)
                      </label>
                      <textarea
                        rows={2}
                        value={penalidadIncumplimiento}
                        onChange={e => setPenalidadIncumplimiento(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                )}

                {/* D) JORNADA / TELETRABAJO */}
                {adendaMotivo === 'cambio_jornada_teletrabajo' && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#b45309' }}>
                      Régimen Horario y Modalidad
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Jornada Convenida (Horas semanales / Modalidad)
                      </label>
                      <input
                        type="text"
                        value={nuevaJornada}
                        onChange={e => setNuevaJornada(e.target.value)}
                        placeholder="Ej.: 40 horas semanales híbrido (3 presenciales, 2 teletrabajo)"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        Horario de Labor
                      </label>
                      <input
                        type="text"
                        value={nuevoHorario}
                        onChange={e => setNuevoHorario(e.target.value)}
                        placeholder="Ej.: 08:30 a 17:30 horas"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}

                {/* E) OTRO MOTIVO */}
                {adendaMotivo === 'otro' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Cláusulas Específicas / Acuerdos Particulares *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={clausulasEspecificas}
                      onChange={e => setClausulasEspecificas(e.target.value)}
                      placeholder="Escriba las estipulaciones modificatorias convenidas..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalAdendaOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  📜 Generar y Descargar Adenda en PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
