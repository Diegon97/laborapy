/**
 * GESTOR DE PRESENTISMO, BIOMETRÍA (OPEN API) Y LIQUIDACIÓN DE SALARIO — ERP LABORAPY
 * Control de novedades (reposos, ausencias, licencias, cumpleaños),
 * ingesta biométrica (ZKTeco, Hikvision, Dahua, Anviz, Suprema)
 * y cálculo de horas extras (50%, 100%, recargo nocturno 30%) integrado con ReciboSalario.
 */

import React, { useState, useMemo } from 'react';
import type {
  EmpresaCliente,
  Empleado,
  NovedadPresentismo,
  TipoNovedadPresentismo,
  RegistroMarcacion,
  TipoMarcacion,
  MetodoVerificacionMarcacion,
  MarcaDispositivoBiometrico,
  ConfigBiometricoCliente,
  ResumenAsistenciaEmpleadoMes,
} from '../types/clientPortal';

import {
  getEmpleadosByCliente,
  getRecibosByCliente,
  formatPYG,
  obtenerNombreMes,
  saveEmpresaCliente,
} from '../services/clientStorageService';
import {
  exportMtessMonthly,
  type MtessMonthlyEmployeeRecord,
} from '../../payroll/generators/mtessExportService';

import {
  getNovedadesByCliente,
  saveNovedad,
  deleteNovedad,
  getMarcacionesByCliente,
  saveMarcacion,
  saveMarcacionesBatch,
  deleteMarcacion,
  limpiarMarcacionesCliente,
  getConfigBiometricoByCliente,
  saveConfigBiometrico,
  generarNuevaApiKey,
  parseZkTecoLog,
  parseHikvisionJson,
  parseUniversalCsv,
  calcularResumenAsistenciaMensual,
  aplicarAsistenciaARecibosSalario,
  getCumpleanherosDelMes,
} from '../services/attendanceService';
import { WeeklyOvertimeCalculatorModal } from './WeeklyOvertimeCalculatorModal';
import { QuickSettlementModal } from './QuickSettlementModal';

interface Props {
  empresa: EmpresaCliente;
}

export const AttendanceAndPayrollTab: React.FC<Props> = ({ empresa }) => {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState<number>(currentDate.getMonth() + 1);
  const [selectedAnho, setSelectedAnho] = useState<number>(currentDate.getFullYear());
  const [activeSubTab, setActiveSubTab] = useState<'novedades' | 'biometria' | 'horas_extras'>('horas_extras');
  const [isOvertimeCalculatorOpen, setIsOvertimeCalculatorOpen] = useState(false);
  const [selectedEmpleadoOvertime, setSelectedEmpleadoOvertime] = useState<Empleado | null>(null);
  const [settlementEmployee, setSettlementEmployee] = useState<Empleado | null>(null);

  // Política Patronal de Reposo Médico
  const [politicaReposo, setPoliticaReposo] = useState<0 | 50 | 100>(
    empresa.politicaReposoPatronal?.coberturaPorcentaje ?? 0
  );

  const handleUpdatePoliticaReposo = (val: 0 | 50 | 100) => {
    setPoliticaReposo(val);
    saveEmpresaCliente({
      ...empresa,
      politicaReposoPatronal: { coberturaPorcentaje: val },
    });
    setNotification({
      tipo: 'success',
      mensaje: `Política de reposo actualizada: ${val === 0 ? '0% Legal Estricto' : `${val}% Patronal`}. Los días de reposo impactan siempre en IPS.`,
    });
  };

  const empleados = useMemo(() => {
    return getEmpleadosByCliente(empresa.id).filter(e => e.estado !== 'inactivo');
  }, [empresa.id]);

  // Estados de datos reactivos
  const [novedades, setNovedades] = useState<NovedadPresentismo[]>(() => getNovedadesByCliente(empresa.id));
  const [marcaciones, setMarcaciones] = useState<RegistroMarcacion[]>(() => getMarcacionesByCliente(empresa.id));
  const [configBiometrico, setConfigBiometrico] = useState<ConfigBiometricoCliente>(() => getConfigBiometricoByCliente(empresa.id));
  const [notification, setNotification] = useState<{ tipo: 'success' | 'info' | 'error'; mensaje: string } | null>(null);

  // Modal Nueva Novedad
  const [isNovedadModalOpen, setIsNovedadModalOpen] = useState(false);
  const [formEmpId, setFormEmpId] = useState<string>(empleados[0]?.id || '');
  const [formTipoNov, setFormTipoNov] = useState<TipoNovedadPresentismo>('reposo_patronal');
  const [formFechaInicio, setFormFechaInicio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formFechaFin, setFormFechaFin] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDias, setFormDias] = useState<number>(1);
  const [formMotivo, setFormMotivo] = useState<string>('');

  // Modal Open API & Webhooks
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Modal Simulador de Marcación
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [simEmpId, setSimEmpId] = useState<string>(empleados[0]?.id || '');
  const [simFechaHora, setSimFechaHora] = useState<string>(`${new Date().toISOString().split('T')[0]}T08:00`);
  const [simTipo, setSimTipo] = useState<TipoMarcacion>('entrada');
  const [simMetodo, setSimMetodo] = useState<MetodoVerificacionMarcacion>('facial');
  const [simMarca, setSimMarca] = useState<MarcaDispositivoBiometrico>('zkteco');

  // Modal Importador de Archivo Biométrico
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadText, setUploadText] = useState<string>('');
  const [uploadTipoFormato, setUploadTipoFormato] = useState<'zkteco' | 'hikvision' | 'csv'>('zkteco');

  // Cómputo del resumen mensual
  const resumenMensual: ResumenAsistenciaEmpleadoMes[] = useMemo(() => {
    if (novedades.length < 0 || marcaciones.length < 0 || !configBiometrico) return [];
    return calcularResumenAsistenciaMensual(empresa.id, selectedMes, selectedAnho);
  }, [empresa.id, selectedMes, selectedAnho, novedades, marcaciones, configBiometrico]);

  // Cumpleañeros del mes
  const cumpleanherosMes = useMemo(() => {
    if (novedades.length < 0) return [];
    return getCumpleanherosDelMes(empresa.id, selectedMes);
  }, [empresa.id, selectedMes, novedades]);

  // Totales generales para KPIs
  const totalesKpi = useMemo(() => {
    return resumenMensual.reduce(
      (acc, r) => ({
        he50Cant: acc.he50Cant + r.horasExtras50Cant,
        he50Monto: acc.he50Monto + r.horasExtras50Monto,
        he100Cant: acc.he100Cant + r.horasExtras100Cant,
        he100Monto: acc.he100Monto + r.horasExtras100Monto,
        recargoNocturnoMonto: acc.recargoNocturnoMonto + r.recargoNocturno30Monto,
        descuentosTardanzas: acc.descuentosTardanzas + r.montoDescuentoTardanzas,
      }),
      { he50Cant: 0, he50Monto: 0, he100Cant: 0, he100Monto: 0, recargoNocturnoMonto: 0, descuentosTardanzas: 0 }
    );
  }, [resumenMensual]);

  // Acciones de Novedad
  const handleCambiarTipoNovedad = (tipo: TipoNovedadPresentismo) => {
    setFormTipoNov(tipo);
    // Asignar duración legal predeterminada
    switch (tipo) {
      case 'licencia_matrimonio':
      case 'licencia_duelo':
        setFormDias(3);
        break;
      case 'licencia_paternidad':
        setFormDias(14);
        break;
      case 'licencia_examen_preventivo':
        setFormDias(2);
        break;
      case 'licencia_donacion_sangre':
      case 'cumpleanos_asueto':
        setFormDias(1);
        break;
      case 'reposo_patronal':
        setFormDias(2);
        break;
      default:
        setFormDias(1);
        break;
    }
  };

  const handleGuardarNovedad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpId) return;

    const esRemunerado = ![
      'ausencia_justificada_sin_goce',
      'ausencia_injustificada',
      'reposo_ips',
      'reposo_maternidad',
    ].includes(formTipoNov);

    const descuentaJornal = ['ausencia_justificada_sin_goce', 'ausencia_injustificada'].includes(formTipoNov);

    const nuevaNov: NovedadPresentismo = {
      id: '',
      clienteId: empresa.id,
      empleadoId: formEmpId,
      tipoNovedad: formTipoNov,
      fechaInicio: formFechaInicio,
      fechaFin: formFechaFin,
      dias: Number(formDias) || 1,
      remunerado: esRemunerado,
      descuentaJornal,
      motivo: formMotivo || 'Registrado por administración de RRHH',
      estado: 'aprobado',
      createdAt: new Date().toISOString(),
    };

    saveNovedad(nuevaNov);
    setNovedades(getNovedadesByCliente(empresa.id));
    setIsNovedadModalOpen(false);
    setFormMotivo('');
    setNotification({ tipo: 'success', mensaje: 'Novedad de presentismo registrada exitosamente.' });
  };

  const handleEliminarNovedad = (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar esta novedad de presentismo?')) {
      deleteNovedad(empresa.id, id);
      setNovedades(getNovedadesByCliente(empresa.id));
      setNotification({ tipo: 'info', mensaje: 'Novedad eliminada.' });
    }
  };

  const handleAsignarAsuetoCumpleanos = (emp: Empleado, fechaCumple: string) => {
    const nuevaNov: NovedadPresentismo = {
      id: '',
      clienteId: empresa.id,
      empleadoId: emp.id,
      tipoNovedad: 'cumpleanos_asueto',
      fechaInicio: fechaCumple,
      fechaFin: fechaCumple,
      dias: 1,
      remunerado: true,
      descuentaJornal: false,
      motivo: `Día de cumpleaños del colaborador ${emp.nombres} ${emp.apellidos} (Asueto remunerado institucional)`,
      estado: 'aprobado',
      createdAt: new Date().toISOString(),
    };

    saveNovedad(nuevaNov);
    setNovedades(getNovedadesByCliente(empresa.id));
    setNotification({ tipo: 'success', mensaje: `Asueto de cumpleaños concedido a ${emp.nombres} ${emp.apellidos}.` });
  };

  // Acciones de Marcaciones
  const handleGuardarSimulacion = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = empleados.find(em => em.id === simEmpId);
    if (!emp) return;

    const nuevaMarc: RegistroMarcacion = {
      id: '',
      clienteId: empresa.id,
      empleadoId: emp.id,
      ci: emp.ci,
      timestamp: simFechaHora,
      tipo: simTipo,
      metodo: simMetodo,
      dispositivoId: 'SIMULADOR_WEB',
      marca: simMarca,
    };

    saveMarcacion(nuevaMarc);
    setMarcaciones(getMarcacionesByCliente(empresa.id));
    setIsSimulatorModalOpen(false);
    setNotification({ tipo: 'success', mensaje: `Marcación simulada registrada para ${emp.nombres} ${emp.apellidos}.` });
  };

  const handleEliminarMarcacion = (id: string) => {
    deleteMarcacion(empresa.id, id);
    setMarcaciones(getMarcacionesByCliente(empresa.id));
  };

  const handleLimpiarMarcaciones = () => {
    if (window.confirm('¿Seguro que deseas eliminar TODAS las marcaciones de esta empresa?')) {
      limpiarMarcacionesCliente(empresa.id);
      setMarcaciones([]);
      setNotification({ tipo: 'info', mensaje: 'Marcaciones biométricas borradas.' });
    }
  };

  const handleImportarArchivo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadText.trim()) return;

    let parsed: RegistroMarcacion[] = [];
    if (uploadTipoFormato === 'zkteco') {
      parsed = parseZkTecoLog(uploadText, empresa.id, empleados);
    } else if (uploadTipoFormato === 'hikvision') {
      parsed = parseHikvisionJson(uploadText, empresa.id, empleados);
    } else {
      parsed = parseUniversalCsv(uploadText, empresa.id, empleados);
    }

    if (parsed.length === 0) {
      alert('No se pudieron extraer registros válidos. Verifique el formato y que los identificadores/CI coincidan con los empleados.');
      return;
    }

    saveMarcacionesBatch(parsed);
    setMarcaciones(getMarcacionesByCliente(empresa.id));
    setIsUploadModalOpen(false);
    setUploadText('');
    setNotification({ tipo: 'success', mensaje: `Se importaron exitosamente ${parsed.length} marcaciones biométricas.` });
  };

  const handleRegenerarApiKey = () => {
    if (window.confirm('¿Deseas generar una nueva API Key? Los dispositivos biométricos deberán actualizar su token.')) {
      const nueva = generarNuevaApiKey(empresa.id);
      setConfigBiometrico(prev => ({ ...prev, apiKey: nueva }));
      setNotification({ tipo: 'info', mensaje: 'Nueva API Key generada.' });
    }
  };

  // Puente directo a la liquidación de salarios
  const handleAplicarAsistenciaALiquidacion = () => {
    const res = aplicarAsistenciaARecibosSalario(empresa.id, selectedMes, selectedAnho);
    setNotification({
      tipo: 'success',
      mensaje: `¡Liquidación sincronizada! Se actualizaron ${res.recibosActualizados} recibos de salario con horas extras, tardanzas y novedades de ${obtenerNombreMes(selectedMes)} ${selectedAnho}.`,
    });
  };

  const handleExportarAsistenciaCsv = () => {
    const headers = [
      'Cédula',
      'Empleado',
      'Cargo',
      'Mes',
      'Año',
      'Días Trabajados',
      'Días Base 30',
      'Tardanzas (min)',
      'Descuento Tardanzas (Gs)',
      'HE 50% (Cant)',
      'HE 50% (Monto Gs)',
      'HE 100% (Cant)',
      'HE 100% (Monto Gs)',
      'Recargo Nocturno 30% (Gs)',
      'Total Adicionales (Gs)',
      'Salario Devengado (Gs)',
    ];

    const rows = resumenMensual.map(r => [
      r.ci,
      `"${r.nombreCompleto}"`,
      `"${r.cargo}"`,
      r.mes,
      r.anho,
      r.diasTrabajadosEfectivos,
      r.diasLiquidadosBase30,
      r.minutosTardanzaTotal,
      r.montoDescuentoTardanzas,
      r.horasExtras50Cant,
      r.horasExtras50Monto,
      r.horasExtras100Cant,
      r.horasExtras100Monto,
      r.recargoNocturno30Monto,
      r.totalAdicionalesHoras,
      r.salarioDevengadoCalculado,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ASISTENCIA_HORAS_EXTRAS_${empresa.ruc}_${selectedAnho}_${String(selectedMes).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportarLibroMtess = () => {
    try {
      const recs = getRecibosByCliente(empresa.id, selectedMes, selectedAnho);
      const patronalDigits = (empresa.nroPatronalMtess || '').replace(/\D+/g, ' ').trim().split(/\s+/).filter(Boolean);
      const patronal = patronalDigits.length > 0 ? patronalDigits[patronalDigits.length - 1] : '38451';
      const diasMes = new Date(selectedAnho, selectedMes, 0).getDate();
      const periodoDesde = `${selectedAnho}-${String(selectedMes).padStart(2, '0')}-01`;
      const periodoHasta = `${selectedAnho}-${String(selectedMes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;

      const registros: MtessMonthlyEmployeeRecord[] = empleados.map(emp => {
        const recibo = recs.find(r => r.empleadoId === emp.id || r.empleadoId === emp.ci);
        const diasTrabajados = recibo ? recibo.diasTrabajados : 30;
        const salarioBasico = recibo ? recibo.salarioBase : emp.salarioBase;
        const horasOrdinarias = Math.round(diasTrabajados * 8);

        return {
          numeroPatronalMtess: patronal,
          sucursalLabel: emp.departamento,
          ci: emp.ci.replace(/\D/g, '') || emp.ci,
          periodoDesde,
          periodoHasta,
          formaPago: 3,
          diasTrabajados,
          piezasTareas: 0,
          horasOrdinarias,
          horasExtraordinarias: recibo ? (recibo.horasExtras50Cant + recibo.horasExtras100Cant) : 0,
          salarioBasico,
          comisiones: recibo ? recibo.comisionesPremios : 0,
          horasExtras50: recibo ? recibo.horasExtras50Monto : 0,
          recargoNocturno: 0,
          horasExtras100: recibo ? recibo.horasExtras100Monto : 0,
          premios: 0,
          salarioEspecie: 0,
          regalias: 0,
          gratificaciones: 0,
          gradoAcademico: 0,
          feriados: 0,
          dietas: 0,
          complementoSalarial: 0,
          bonificacionFamiliar: recibo ? recibo.bonificacionFamiliar : (emp.hijosMenores > 0 ? emp.hijosMenores * Math.round(emp.salarioBase * 0.05) : 0),
          antiguedad: 0,
          anticipos: recibo ? recibo.anticiposQuincena : 0,
        };
      });

      if (registros.length === 0) {
        setNotification({ tipo: 'info', mensaje: 'No hay empleados activos para exportar al MTESS.' });
        return;
      }

      const generated = exportMtessMonthly(registros);
      const nombres = generated.map(g => g.fileName).join(', ');
      setNotification({
        tipo: 'success',
        mensaje: `✅ Libro Mensual MTESS (.xlsx) generado con éxito (${registros.length} empleados): ${nombres}`,
      });
    } catch (err) {
      console.error('[MTESS Attendance Export Error]', err);
      setNotification({
        tipo: 'error',
        mensaje: `Error al exportar libro MTESS: ${(err as Error).message || 'desconocido'}`,
      });
    }
  };

  const curlExample = `curl -X POST "${configBiometrico.webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-LaboraPy-API-Key: ${configBiometrico.apiKey}" \\
  -d '{
    "dispositivoId": "ZK_PRINCIPAL",
    "marca": "zkteco",
    "marcaciones": [
      {
        "ci": "4567890",
        "timestamp": "2026-08-10T08:02:15",
        "tipo": "entrada",
        "metodo": "facial"
      }
    ]
  }'`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Encabezado del Módulo ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⏰</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Liquidación de Salarios, Presentismo & Biometría
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#0284c7',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.05em',
              }}
            >
              OPEN API REST
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Control de reposos, ausencias, licencias legales, cumpleaños y cálculo automatizado de horas extras (50%, 100% y 30% nocturno) según la Ley N.º 213/93.
          </p>
        </div>

        {/* Selector de Período y Botón de API */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={selectedMes}
              onChange={e => setSelectedMes(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #2e3038',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
              }}
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
              style={{
                padding: '8px 12px',
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #2e3038',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <button
            onClick={() => setIsApiModalOpen(true)}
            style={{
              padding: '8px 14px',
              background: '#e2e8f0',
              color: '#707ee6',
              border: '1px solid #0284c7',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🔑</span> API Reloj Biométrico
          </button>
        </div>
      </div>

      {/* Banner de Notificación */}
      {notification && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: notification.tipo === 'success' ? 'rgba(16, 185, 129, 0.12)' : notification.tipo === 'info' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: notification.tipo === 'success' ? '#a7f3d0' : notification.tipo === 'info' ? '#bfdbfe' : '#fecaca',
            border: `1px solid ${notification.tipo === 'success' ? 'rgba(16, 185, 129, 0.3)' : notification.tipo === 'info' ? 'rgba(2, 132, 199, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          <span>{notification.mensaje}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '15px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Sub-pestañas de Navegación ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('horas_extras')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'horas_extras' ? '#0284c7' : '#f8fafc',
            color: activeSubTab === 'horas_extras' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🧮</span> Cómputo de Horas Extras & Liquidación ({resumenMensual.length})
        </button>

        <button
          onClick={() => setActiveSubTab('novedades')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'novedades' ? '#0284c7' : '#f8fafc',
            color: activeSubTab === 'novedades' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📋</span> Presentismo & Novedades ({novedades.length})
        </button>

        <button
          onClick={() => setActiveSubTab('biometria')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'biometria' ? '#0284c7' : '#f8fafc',
            color: activeSubTab === 'biometria' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⏱️</span> Marcaciones Biométricas ({marcaciones.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 1: CÓMPUTO DE HORAS EXTRAS & LIQUIDACIÓN                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'horas_extras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Tarjetas de KPIs de Nómina y Horas Extras */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Horas Extras 50% (Diurnas)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#707ee6', marginTop: '6px' }}>
                {totalesKpi.he50Cant} hs
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Monto: <strong style={{ color: '#0f172a' }}>{formatPYG(totalesKpi.he50Monto)}</strong>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Horas Extras 100% (Nocturnas / Feriados)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
                {totalesKpi.he100Cant} hs
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Monto: <strong style={{ color: '#0f172a' }}>{formatPYG(totalesKpi.he100Monto)}</strong>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Recargo Nocturno 30% (Ordinario)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#a855f7', marginTop: '6px' }}>
                {formatPYG(totalesKpi.recargoNocturnoMonto)}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Horario 20:00 a 06:00 (Art. 234 inc. c)
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Descuento Tardanzas
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444', marginTop: '6px' }}>
                {formatPYG(totalesKpi.descuentosTardanzas)}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Tolerancia: {configBiometrico.toleranciaMinutosTardia} min
              </div>
            </div>
          </div>

          {/* Barra de Acciones Principales */}
          <div
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Resumen de Asistencia y Liquidación — {obtenerNombreMes(selectedMes)} {selectedAnho}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Los cálculos se basan en las marcaciones de reloj y las novedades aprobadas.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSelectedEmpleadoOvertime(empleados[0] || null);
                  setIsOvertimeCalculatorOpen(true);
                }}
                style={{
                  padding: '9px 16px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                }}
                title="Abre la calculadora de horas extras con carga directa manual (50%, 100%, 130%), recargos y sincronización con marcador biométrico (API)"
              >
                <span>🧮</span> Calculadora de Horas Extras
              </button>

              <button
                onClick={handleExportarAsistenciaCsv}
                style={{
                  padding: '9px 16px',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  border: '1px solid #2e3038',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📊</span> Exportar CSV
              </button>

              <button
                onClick={handleExportarLibroMtess}
                style={{
                  padding: '9px 16px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}
                title="Generar y descargar el Libro Mensual de Salarios oficial del MTESS (32 columnas .xlsx)"
              >
                <span>📗</span> Exportar Libro MTESS (.xlsx)
              </button>

              <button
                onClick={handleAplicarAsistenciaALiquidacion}
                style={{
                  padding: '9px 18px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
                title="Actualiza los recibos de salarios con las horas extras, tardanzas y días calculados"
              >
                <span>⚡</span> Aplicar a Recibos de Salario
              </button>
            </div>
          </div>

          {/* Tabla de Empleados y Horas Extras */}
          <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Empleado</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Días Base 30</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Tardanzas</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>HE 50%</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>HE 100%</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Adicionales</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Salario Devengado</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensual.map(r => (
                  <tr key={r.empleadoId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.nombreCompleto}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        CI: {r.ci} · {r.cargo}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: r.diasLiquidadosBase30 === 30 ? 'rgba(16, 185, 129, 0.12)' : '#7c2d12',
                          color: r.diasLiquidadosBase30 === 30 ? '#34d399' : '#fdba74',
                        }}
                      >
                        {r.diasLiquidadosBase30} / 30
                      </span>
                      {r.diasAusenciasInjustificadas > 0 && (
                        <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>
                          -{r.diasAusenciasInjustificadas} aus. injust.
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {r.minutosTardanzaTotal > 0 ? (
                        <div>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>{r.minutosTardanzaTotal} min</span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>-{formatPYG(r.montoDescuentoTardanzas)}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#10b981' }}>0 min</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {r.horasExtras50Cant > 0 ? (
                        <div>
                          <span style={{ color: '#707ee6', fontWeight: 700 }}>{r.horasExtras50Cant} hs</span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>+{formatPYG(r.horasExtras50Monto)}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {r.horasExtras100Cant > 0 ? (
                        <div>
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{r.horasExtras100Cant} hs</span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>+{formatPYG(r.horasExtras100Monto)}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                      +{formatPYG(r.totalAdicionalesHoras)}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {formatPYG(r.salarioDevengadoCalculado)}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            const emp = empleados.find(e => e.id === r.empleadoId);
                            setSelectedEmpleadoOvertime(emp || null);
                            setIsOvertimeCalculatorOpen(true);
                          }}
                          style={{
                            padding: '5px 9px',
                            background: '#312e81',
                            color: '#c7d2fe',
                            border: '1px solid #4338ca',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="Calcular horas extras día por día para este empleado"
                        >
                          🧮 Horas Extras
                        </button>
                        <button
                          onClick={() => {
                            const emp = empleados.find(e => e.id === r.empleadoId);
                            if (emp) setSettlementEmployee(emp);
                          }}
                          style={{
                            padding: '5px 9px',
                            background: '#1e1b4b',
                            color: '#a5b4fc',
                            border: '1px solid #6366f1',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                          }}
                          title="Liquidar colaborador (Despido, Abandono de trabajo con Telegrama, Renuncia)"
                        >
                          <span>⚡</span>
                          <span>Liquidar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 2: PRESENTISMO & NOVEDADES                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'novedades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card de Configuración: Política Patronal de Reposos Médicos e Impacto en IPS */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '16px 20px',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🏥</span>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                    Política Patronal de Cobertura de Reposos Médicos
                  </span>
                  <span style={{ fontSize: '11px', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    IPS Dec-Ley 1860/50
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                  El empleador <strong>no tiene la obligación legal</strong> de abonar salarios durante reposos médicos (el subsidio dinerario es a cargo exclusivo del IPS). La empresa puede optar voluntariamente por cubrir un porcentaje del jornal. <em>Los días de reposo impactan siempre en la planilla y archivo TXT REI de IPS</em>.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Pago empresa:</span>
                <select
                  value={politicaReposo}
                  onChange={e => handleUpdatePoliticaReposo(Number(e.target.value) as 0 | 50 | 100)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    color: '#707ee6',
                    border: '1px solid #0284c7',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value={0}>0% (Legal estricto · Sin costo empresa, subsidio IPS)</option>
                  <option value={50}>50% (Pago compartido voluntario)</option>
                  <option value={100}>100% (Beneficio patronal completo)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Alerta de Cumpleaños del Mes */}
          {cumpleanherosMes.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid #0284c7',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🎂</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    Cumpleañeros de {obtenerNombreMes(selectedMes)} ({cumpleanherosMes.length})
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Política de Asueto Remunerado: Los colaboradores tienen derecho a 1 día de descanso remunerado en la fecha de su natalicio.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {cumpleanherosMes.map(c => (
                  <div
                    key={c.empleado.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#ffffff',
                    }}
                  >
                    <span>
                      {c.empleado.nombres} ({c.dia} de {obtenerNombreMes(selectedMes)})
                    </span>
                    {c.yaTieneAsueto ? (
                      <span style={{ background: 'rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        ✓ Asueto Asignado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAsignarAsuetoCumpleanos(c.empleado, c.fechaCumple)}
                        style={{
                          background: '#ec4899',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Conceder Asueto
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de Acciones de Novedades */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Registro de Reposos, Ausencias y Licencias Legales
            </div>

            <button
              onClick={() => setIsNovedadModalOpen(true)}
              style={{
                padding: '9px 16px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>+</span> Registrar Novedad / Licencia
            </button>
          </div>

          {/* Tabla de Novedades */}
          <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Empleado</th>
                  <th style={{ padding: '12px 14px' }}>Tipo de Novedad</th>
                  <th style={{ padding: '12px 14px' }}>Período</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Días</th>
                  <th style={{ padding: '12px 14px' }}>Impacto en Nómina</th>
                  <th style={{ padding: '12px 14px' }}>Motivo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {novedades.map(nov => {
                  const emp = empleados.find(e => e.id === nov.empleadoId);
                  return (
                    <tr key={nov.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {emp ? `${emp.nombres} ${emp.apellidos}` : 'Empleado'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>CI: {emp?.ci}</div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background:
                              nov.tipoNovedad.startsWith('reposo')
                                ? 'rgba(2, 132, 199, 0.12)'
                                : nov.tipoNovedad.startsWith('licencia')
                                ? '#065f46'
                                : nov.tipoNovedad === 'cumpleanos_asueto'
                                ? '#831843'
                                : '#7c2d12',
                            color: '#ffffff',
                          }}
                        >
                          {nov.tipoNovedad === 'reposo_patronal' && '🏥 Reposo Patronal (1-3 d)'}
                          {nov.tipoNovedad === 'reposo_ips' && '🏥 Reposo IPS (Subsidio 50%)'}
                          {nov.tipoNovedad === 'reposo_maternidad' && '🤰 Maternidad (18 sem / IPS)'}
                          {nov.tipoNovedad === 'licencia_matrimonio' && '💍 Matrimonio (3 d)'}
                          {nov.tipoNovedad === 'licencia_paternidad' && '👶 Paternidad (14 d)'}
                          {nov.tipoNovedad === 'licencia_duelo' && '🕊️ Duelo Familiar (3 d)'}
                          {nov.tipoNovedad === 'licencia_examen_preventivo' && '🩺 Chequeo Médico (2 d)'}
                          {nov.tipoNovedad === 'licencia_donacion_sangre' && '🩸 Donación Sangre (1 d)'}
                          {nov.tipoNovedad === 'cumpleanos_asueto' && '🎂 Asueto Cumpleaños (1 d)'}
                          {nov.tipoNovedad === 'ausencia_injustificada' && '⚠️ Ausencia Injustificada'}
                          {nov.tipoNovedad === 'ausencia_justificada_sin_goce' && '⏳ Permiso Sin Goce'}
                          {nov.tipoNovedad === 'ausencia_justificada_con_goce' && '✓ Permiso Con Goce'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569' }}>
                        {nov.fechaInicio} al {nov.fechaFin}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                        {nov.dias} d
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                        {nov.descuentaJornal ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>Descuenta jornal (-{nov.dias} d)</span>
                        ) : nov.tipoNovedad === 'reposo_ips' || nov.tipoNovedad === 'reposo_maternidad' ? (
                          <span style={{ color: '#707ee6' }}>Subsidio a cargo de IPS</span>
                        ) : (
                          <span style={{ color: '#10b981' }}>100% Remunerado con goce</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', maxWidth: '240px' }}>
                        {nov.motivo}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleEliminarNovedad(nov.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Eliminar registro"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 3: MARCACIONES BIOMÉTRICAS & OPEN API                         */}
      {/* ========================================================================= */}
      {activeSubTab === 'biometria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Insignias de Marcas de Biométricos Soportadas */}
          <div
            style={{
              background: '#ffffff',
              padding: '14px 20px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Hardware Compatible:
              </span>
              <span style={{ background: '#f8fafc', border: '1px solid #2e3038', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                ZKTeco (ADMS/attlog)
              </span>
              <span style={{ background: '#f8fafc', border: '1px solid #2e3038', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                Hikvision (MinMoe ISAPI)
              </span>
              <span style={{ background: '#f8fafc', border: '1px solid #2e3038', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                Dahua (DHI-ASI)
              </span>
              <span style={{ background: '#f8fafc', border: '1px solid #2e3038', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                Anviz (CrossChex)
              </span>
              <span style={{ background: '#f8fafc', border: '1px solid #2e3038', color: '#0f172a', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                Suprema (BioStar 2)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsSimulatorModalOpen(true)}
                style={{
                  padding: '7px 14px',
                  background: '#e2e8f0',
                  color: '#707ee6',
                  border: '1px solid #0284c7',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>⚡</span> Simular Marcación
              </button>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                style={{
                  padding: '7px 14px',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📁</span> Importar Archivo
              </button>

              <button
                onClick={handleLimpiarMarcaciones}
                style={{
                  padding: '7px 12px',
                  background: '#3f1818',
                  color: '#f87171',
                  border: '1px solid #7f1d1d',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Limpiar todas las marcaciones"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Tabla de Marcaciones Crudas */}
          <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Fecha & Hora</th>
                  <th style={{ padding: '12px 14px' }}>Empleado</th>
                  <th style={{ padding: '12px 14px' }}>Tipo Marcación</th>
                  <th style={{ padding: '12px 14px' }}>Método Biométrico</th>
                  <th style={{ padding: '12px 14px' }}>Dispositivo / Marca</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {marcaciones.map(marc => {
                  const emp = empleados.find(e => e.id === marc.empleadoId);
                  return (
                    <tr key={marc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {marc.timestamp.replace('T', ' ')}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {emp ? `${emp.nombres} ${emp.apellidos}` : 'Desconocido'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>CI: {marc.ci}</div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: marc.tipo.includes('entrada') ? 'rgba(16, 185, 129, 0.12)' : '#7c2d12',
                            color: marc.tipo.includes('entrada') ? '#34d399' : '#fdba74',
                          }}
                        >
                          {marc.tipo === 'entrada' && '🟢 Entrada'}
                          {marc.tipo === 'salida' && '🔴 Salida'}
                          {marc.tipo === 'salida_almuerzo' && '🟡 Salida Almuerzo'}
                          {marc.tipo === 'entrada_almuerzo' && '🔵 Regreso Almuerzo'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textTransform: 'capitalize', color: '#475569' }}>
                        {marc.metodo === 'facial' && '👤 Reconocimiento Facial'}
                        {marc.metodo === 'huella' && '👆 Huella Dactilar'}
                        {marc.metodo === 'tarjeta' && '💳 Tarjeta RFID'}
                        {marc.metodo === 'pin' && '🔢 Teclado / PIN'}
                        {marc.metodo === 'manual' && '✍️ Manual'}
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                        <span style={{ fontWeight: 600, color: '#707ee6', textTransform: 'uppercase' }}>
                          {marc.marca}
                        </span>{' '}
                        · {marc.dispositivoId}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleEliminarMarcacion(marc.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR NOVEDAD DE PRESENTISMO                                 */}
      {/* ========================================================================= */}
      {isNovedadModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                📋 Registrar Novedad de Presentismo / Licencia
              </div>
              <button
                onClick={() => setIsNovedadModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarNovedad} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Colaborador / Funcionario
                </label>
                <select
                  value={formEmpId}
                  onChange={e => setFormEmpId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                >
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nombres} {e.apellidos} (CI: {e.ci}) — {e.cargo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Tipo de Novedad o Licencia Legal
                </label>
                <select
                  value={formTipoNov}
                  onChange={e => handleCambiarTipoNovedad(e.target.value as TipoNovedadPresentismo)}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                >
                  <optgroup label="Reposos Médicos (IPS / Patronal)">
                    <option value="reposo_patronal">Reposo Médico Común (Días 1 a 3 - 100% Patronal)</option>
                    <option value="reposo_ips">Reposo Médico Común (Día 4 en adelante - 50% IPS)</option>
                    <option value="reposo_maternidad">Reposo de Maternidad (18 semanas / 126 días - 100% IPS)</option>
                    <option value="reposo_accidente_laboral">Accidente de Trabajo / Riesgo Profesional (IPS)</option>
                  </optgroup>
                  <optgroup label="Licencias Legales Remuneradas (Código del Trabajo)">
                    <option value="licencia_matrimonio">Licencia por Matrimonio (3 días corridos)</option>
                    <option value="licencia_paternidad">Licencia por Paternidad (14 días corridos - Ley 5508)</option>
                    <option value="licencia_duelo">Licencia por Duelo Familiar (3 días corridos)</option>
                    <option value="licencia_examen_preventivo">Examen Preventivo Mamografía/Próstata (2 días al año)</option>
                    <option value="licencia_donacion_sangre">Donación de Sangre (1 día de descanso)</option>
                    <option value="licencia_estudio">Exámenes Académicos Universitarios</option>
                  </optgroup>
                  <optgroup label="Políticas de Empresa & Ausencias">
                    <option value="cumpleanos_asueto">Asueto por Cumpleaños del Funcionario (1 día)</option>
                    <option value="ausencia_justificada_con_goce">Permiso Especial Justificado (Con Goce)</option>
                    <option value="ausencia_justificada_sin_goce">Permiso Particular (Sin Goce - Descuenta Jornal)</option>
                    <option value="ausencia_injustificada">Ausencia Injustificada (Descuenta Jornal Base 30)</option>
                  </optgroup>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={formFechaInicio}
                    onChange={e => setFormFechaInicio(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={formFechaFin}
                    onChange={e => setFormFechaFin(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Cantidad de Días
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formDias}
                    onChange={e => setFormDias(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Motivo / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={formMotivo}
                  onChange={e => setFormMotivo(e.target.value)}
                  placeholder="Detalle o número de certificado médico presentado..."
                  style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNovedadModalOpen(false)}
                  style={{ padding: '8px 16px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Guardar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIGURACIÓN OPEN API & WEBHOOK BIOMÉTRICO                      */}
      {/* ========================================================================= */}
      {isApiModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '680px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                🔑 Configuración de API Abierta & Webhook Biométrico
              </div>
              <button
                onClick={() => setIsApiModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  URL DE ENDPOINT WEBHOOK (REST PUSH)
                </label>
                <input
                  type="text"
                  readOnly
                  value={configBiometrico.webhookUrl}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#707ee6', fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                    API KEY DE LA EMPRESA (HEADER: X-LaboraPy-API-Key)
                  </label>
                  <button
                    onClick={handleRegenerarApiKey}
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🔄 Regenerar Key
                  </button>
                </div>
                <input
                  type="text"
                  readOnly
                  value={configBiometrico.apiKey}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#34d399', fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>

              {/* Ajustes de Turno Predeterminado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Entrada Ordinaria
                  </label>
                  <input
                    type="time"
                    value={configBiometrico.horaEntradaPredeterminada}
                    onChange={e => {
                      const updated = { ...configBiometrico, horaEntradaPredeterminada: e.target.value };
                      setConfigBiometrico(updated);
                      saveConfigBiometrico(updated);
                    }}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Salida Ordinaria
                  </label>
                  <input
                    type="time"
                    value={configBiometrico.horaSalidaPredeterminada}
                    onChange={e => {
                      const updated = { ...configBiometrico, horaSalidaPredeterminada: e.target.value };
                      setConfigBiometrico(updated);
                      saveConfigBiometrico(updated);
                    }}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Tolerancia Tardanza
                  </label>
                  <input
                    type="number"
                    value={configBiometrico.toleranciaMinutosTardia}
                    onChange={e => {
                      const updated = { ...configBiometrico, toleranciaMinutosTardia: Number(e.target.value) };
                      setConfigBiometrico(updated);
                      saveConfigBiometrico(updated);
                    }}
                    style={{ width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Ejemplo cURL */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                    Ejemplo de Envío cURL / Script para Técnico IT
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(curlExample);
                      setCopiedCurl(true);
                      setTimeout(() => setCopiedCurl(false), 2000);
                    }}
                    style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    {copiedCurl ? '✓ Copiado' : 'Copiar cURL'}
                  </button>
                </div>
                <pre
                  style={{
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '11px',
                    overflowX: 'auto',
                    border: '1px solid #f8fafc',
                  }}
                >
                  {curlExample}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setIsApiModalOpen(false)}
                  style={{ padding: '8px 18px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SIMULADOR DE MARCACIÓN EN VIVO                                   */}
      {/* ========================================================================= */}
      {isSimulatorModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '500px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                ⚡ Simular Marcación Biométrica
              </div>
              <button
                onClick={() => setIsSimulatorModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarSimulacion} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Empleado
                </label>
                <select
                  value={simEmpId}
                  onChange={e => setSimEmpId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                >
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nombres} {e.apellidos} (CI: {e.ci})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Fecha y Hora de Marcación
                </label>
                <input
                  type="datetime-local"
                  value={simFechaHora}
                  onChange={e => setSimFechaHora(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Tipo de Marcación
                  </label>
                  <select
                    value={simTipo}
                    onChange={e => setSimTipo(e.target.value as TipoMarcacion)}
                    style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  >
                    <option value="entrada">🟢 Entrada</option>
                    <option value="salida">🔴 Salida</option>
                    <option value="salida_almuerzo">🟡 Salida Almuerzo</option>
                    <option value="entrada_almuerzo">🔵 Regreso Almuerzo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Método Biométrico
                  </label>
                  <select
                    value={simMetodo}
                    onChange={e => setSimMetodo(e.target.value as MetodoVerificacionMarcacion)}
                    style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                  >
                    <option value="facial">Reconocimiento Facial</option>
                    <option value="huella">Huella Dactilar</option>
                    <option value="tarjeta">Tarjeta RFID</option>
                    <option value="pin">Código / PIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Marca del Dispositivo
                </label>
                <select
                  value={simMarca}
                  onChange={e => setSimMarca(e.target.value as MarcaDispositivoBiometrico)}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                >
                  <option value="zkteco">ZKTeco</option>
                  <option value="hikvision">Hikvision MinMoe</option>
                  <option value="dahua">Dahua Technology</option>
                  <option value="anviz">Anviz</option>
                  <option value="suprema">Suprema</option>
                  <option value="generico">Genérico</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSimulatorModalOpen(false)}
                  style={{ padding: '8px 16px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Simular Marcación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: IMPORTADOR DE ARCHIVO BIOMÉTRICO                                */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '600px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                📁 Importar Archivo de Reloj Biométrico
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportarArchivo} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Formato de Origen
                </label>
                <select
                  value={uploadTipoFormato}
                  onChange={e => setUploadTipoFormato(e.target.value as 'zkteco' | 'hikvision' | 'csv')}
                  style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                >
                  <option value="zkteco">ZKTeco (attlog.dat / TSV / BioTime Export)</option>
                  <option value="hikvision">Hikvision ISAPI (JSON Event Array)</option>
                  <option value="csv">CSV / TXT Universal (Cédula, FechaHora, Tipo, Metodo)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Pega el contenido del archivo aquí
                </label>
                <textarea
                  rows={8}
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  placeholder={
                    uploadTipoFormato === 'zkteco'
                      ? '4567890\t2026-08-10 07:58:00\t0\t1\n4567890\t2026-08-10 18:30:00\t1\t1'
                      : uploadTipoFormato === 'csv'
                      ? 'CI,FechaHora,Tipo,Metodo\n4567890,2026-08-10 08:00:00,entrada,huella\n4567890,2026-08-10 17:30:00,salida,huella'
                      : '[\n  {"employeeNoString": "4567890", "time": "2026-08-10T08:00:00", "type": "entrada"}\n]'
                  }
                  style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#707ee6', fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  style={{ padding: '8px 16px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Procesar e Importar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Calculadora de Horas Extras y Recargos Legales */}
      <WeeklyOvertimeCalculatorModal
        isOpen={isOvertimeCalculatorOpen}
        onClose={() => setIsOvertimeCalculatorOpen(false)}
        empleadoSeleccionado={selectedEmpleadoOvertime}
        empresaId={empresa.id}
        empleadosDisponibles={empleados}
        mes={selectedMes}
        anho={selectedAnho}
        onAplicarANomina={() => {
          setNotification({
            tipo: 'success',
            mensaje: '✓ Horas extras registradas y sincronizadas exitosamente en la liquidación del período.',
          });
          setIsOvertimeCalculatorOpen(false);
        }}
      />

      {/* Modal de Liquidación Rápida (Despido, Abandono con Telegrama, Renuncia) */}
      {settlementEmployee && (
        <QuickSettlementModal
          isOpen={!!settlementEmployee}
          onClose={() => setSettlementEmployee(null)}
          empleado={settlementEmployee}
          empresa={empresa}
        />
      )}
    </div>
  );
};
