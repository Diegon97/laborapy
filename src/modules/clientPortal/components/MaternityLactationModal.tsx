/**
 * MODAL DE GESTIÓN DE MATERNIDAD, LACTANCIA & FUERO LABORAL — ERP LABORAPY
 * Normativa: Ley N.º 5508/15, Ley N.º 7097/23 y Art. 136 Ley N.º 213/93 (Código del Trabajo)
 * Versión: PY-ERP-MATERNIDAD-MODAL-2026.09.09
 */

import React, { useState } from 'react';
import type {
  EmpresaCliente,
  Empleado,
  RegistroMaternidad,
  EstadoMaternidadLactancia,
  ModalidadLactancia90Min,
  CertificadoLactanciaTrimestral,
} from '../types/clientPortal';
import {
  getRegistroMaternidadByEmpleadoId,
  saveRegistroMaternidad,
  deleteRegistroMaternidad,
  calcularCronogramaMaternidadLactancia,
  agregarCertificadoLactanciaTrimestral,
} from '../services/clientStorageService';
import { generarConstanciaMaternidadPDF } from '../generators/maternityNoticePdfGenerator';

interface Props {
  empresa: EmpresaCliente;
  empleado: Empleado;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const MaternityLactationModal: React.FC<Props> = ({
  empresa,
  empleado,
  isOpen,
  onClose,
  onSaved,
}) => {
  const existente = getRegistroMaternidadByEmpleadoId(empleado.id);
  const hoy = new Date().toISOString().split('T')[0];
  const fppDefault = new Date();
  fppDefault.setMonth(fppDefault.getMonth() + 3);

  const [activeTab, setActiveTab] = useState<'cronograma' | 'lactancia' | 'certificados'>('cronograma');

  // Datos principales
  const [registroId] = useState<string>(() => existente ? existente.id : `mat_${empleado.id}`);
  const [estado, setEstado] = useState<EstadoMaternidadLactancia>(() => existente ? existente.estado : 'embarazada');
  const [fechaNotificacion, setFechaNotificacion] = useState<string>(() => existente ? existente.fechaNotificacionEmbarazo : hoy);
  const [fechaFPP, setFechaFPP] = useState<string>(() => existente ? existente.fechaProbablePartoFPP : fppDefault.toISOString().split('T')[0]);
  const [fechaPartoReal, setFechaPartoReal] = useState<string>(() => existente?.fechaPartoReal || '');
  const [inicioAnticipadoDias, setInicioAnticipadoDias] = useState<number>(14);
  const [subsidioIpsEstado, setSubsidioIpsEstado] = useState<'pendiente' | 'tramitado' | 'cobrado_por_asegurada'>(() => existente ? existente.subsidioIpsEstado : 'pendiente');

  // Lactancia
  const [modalidadLactancia, setModalidadLactancia] = useState<ModalidadLactancia90Min>(() => existente ? existente.modalidadLactancia : 'dos_pausas_45min');
  const [deseaExtension, setDeseaExtension] = useState<boolean>(() => existente ? existente.deseaExtensionLactancia : true);
  const [fueroActivo, setFueroActivo] = useState<boolean>(() => existente ? existente.fueroMaternalActivo : true);
  const [notas, setNotas] = useState<string>(() => existente?.notas || '');

  // Certificados trimestrales
  const [certificados, setCertificados] = useState<CertificadoLactanciaTrimestral[]>(() => existente?.certificadosTrimestrales || []);
  const [nuevoCertTrimestre, setNuevoCertTrimestre] = useState<number>(1);
  const [nuevoCertFecha, setNuevoCertFecha] = useState<string>(hoy);
  const [nuevoCertPediatra, setNuevoCertPediatra] = useState<string>('');
  const [nuevoCertRegProf, setNuevoCertRegProf] = useState<string>('');
  const [nuevoCertObs, setNuevoCertObs] = useState<string>('');

  if (!isOpen) return null;

  // Cálculo en tiempo real de fechas legales
  const cronogramaCalculado = fechaFPP
    ? calcularCronogramaMaternidadLactancia(
        fechaFPP,
        fechaNotificacion,
        fechaPartoReal || undefined,
        inicioAnticipadoDias
      )
    : null;

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaFPP || !fechaNotificacion) {
      alert('Por favor complete la Fecha de Notificación y la Fecha Probable de Parto (FPP).');
      return;
    }

    if (!cronogramaCalculado) return;

    const nuevoRegistro: RegistroMaternidad = {
      id: registroId,
      clienteId: empresa.id,
      empleadoId: empleado.id,
      estado,
      fechaNotificacionEmbarazo: fechaNotificacion,
      fechaProbablePartoFPP: fechaFPP,
      fechaPartoReal: fechaPartoReal || undefined,
      fechaInicioReposo: cronogramaCalculado.fechaInicioReposo,
      fechaFinReposo: cronogramaCalculado.fechaFinReposo,
      fechaReincorporacionTrabajo: cronogramaCalculado.fechaReincorporacionTrabajo,
      subsidioIpsEstado,
      modalidadLactancia,
      fechaFinLactanciaObligatoria: cronogramaCalculado.fechaFinLactanciaObligatoria,
      deseaExtensionLactancia: deseaExtension,
      fechaLimiteMaximoLactancia24Meses: cronogramaCalculado.fechaLimiteMaximoLactancia24Meses,
      certificadosTrimestrales: certificados,
      proximoVencimientoCertificado:
        certificados.length > 0
          ? certificados[certificados.length - 1].fechaVencimiento
          : cronogramaCalculado.fechaFinLactanciaObligatoria,
      fueroMaternalActivo: fueroActivo,
      fechaFinEstimadaFuero:
        certificados.length > 0
          ? certificados[certificados.length - 1].fechaVencimiento
          : cronogramaCalculado.fechaFinLactanciaObligatoria,
      notas,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRegistroMaternidad(nuevoRegistro);
    if (onSaved) onSaved();
    onClose();
  };

  const handleAgregarCertificado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCertFecha || !nuevoCertPediatra.trim()) {
      alert('Por favor indique la fecha de presentación y el médico pediatra.');
      return;
    }

    // Calcular fecha de vencimiento (+3 meses desde fecha presentación)
    const [y, m, d] = nuevoCertFecha.split('-').map(Number);
    const vDate = new Date(y, m - 1, d);
    vDate.setMonth(vDate.getMonth() + 3);
    const vencimiento = `${vDate.getFullYear()}-${String(vDate.getMonth() + 1).padStart(2, '0')}-${String(vDate.getDate()).padStart(2, '0')}`;

    const nuevoCert: CertificadoLactanciaTrimestral = {
      id: `cert_${Date.now()}`,
      nroTrimestre: nuevoCertTrimestre,
      fechaPresentacion: nuevoCertFecha,
      fechaVencimiento: vencimiento,
      medicoPediatra: nuevoCertPediatra.trim(),
      registroProfesional: nuevoCertRegProf.trim() || undefined,
      observaciones: nuevoCertObs.trim() || undefined,
      esVigente: true,
    };

    // Actualizar estado local
    const actualizados = certificados.map(c => ({ ...c, esVigente: false }));
    actualizados.push(nuevoCert);
    setCertificados(actualizados);

    // Guardar directamente si ya existe en storage
    if (registroId) {
      agregarCertificadoLactanciaTrimestral(registroId, nuevoCert);
    }

    // Reset formulario de certificado
    setNuevoCertTrimestre(prev => Math.min(6, prev + 1));
    setNuevoCertPediatra('');
    setNuevoCertRegProf('');
    setNuevoCertObs('');
    alert(`Certificado del Trimestre ${nuevoCertTrimestre} registrado con éxito. Vence el ${vencimiento}.`);
  };

  const handleDescargarPDF = () => {
    if (!cronogramaCalculado) {
      alert('Complete los datos básicos para poder generar la constancia oficial.');
      return;
    }

    const regTemp: RegistroMaternidad = {
      id: registroId,
      clienteId: empresa.id,
      empleadoId: empleado.id,
      estado,
      fechaNotificacionEmbarazo: fechaNotificacion,
      fechaProbablePartoFPP: fechaFPP,
      fechaPartoReal: fechaPartoReal || undefined,
      fechaInicioReposo: cronogramaCalculado.fechaInicioReposo,
      fechaFinReposo: cronogramaCalculado.fechaFinReposo,
      fechaReincorporacionTrabajo: cronogramaCalculado.fechaReincorporacionTrabajo,
      subsidioIpsEstado,
      modalidadLactancia,
      fechaFinLactanciaObligatoria: cronogramaCalculado.fechaFinLactanciaObligatoria,
      deseaExtensionLactancia: deseaExtension,
      fechaLimiteMaximoLactancia24Meses: cronogramaCalculado.fechaLimiteMaximoLactancia24Meses,
      certificadosTrimestrales: certificados,
      proximoVencimientoCertificado:
        certificados.length > 0
          ? certificados[certificados.length - 1].fechaVencimiento
          : cronogramaCalculado.fechaFinLactanciaObligatoria,
      fueroMaternalActivo: fueroActivo,
      fechaFinEstimadaFuero:
        certificados.length > 0
          ? certificados[certificados.length - 1].fechaVencimiento
          : cronogramaCalculado.fechaFinLactanciaObligatoria,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const doc = generarConstanciaMaternidadPDF({
      empresa,
      empleado,
      registro: regTemp,
    });

    doc.save(`Constancia_Maternidad_Lactancia_${empleado.ci}_${empresa.razonSocial.slice(0, 10)}.pdf`);
  };

  const handleEliminarRegistro = () => {
    if (confirm(`¿Confirma que desea eliminar el legajo de maternidad de ${empleado.nombres} ${empleado.apellidos}?`)) {
      if (registroId) {
        deleteRegistroMaternidad(registroId);
      }
      if (onSaved) onSaved();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Encabezado Modal ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '18px 24px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🤰</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                PROTECCIÓN DE MATERNIDAD & LACTANCIA · LEY 5508/15 & 7097/23
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '17px', fontWeight: 800 }}>
              {empleado.nombres} {empleado.apellidos}
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              C.I. N.º {empleado.ci} · Cargo: {empleado.cargo} · {empleado.departamento}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Banner de Fuero Maternal e Inamovilidad Laboral ── */}
        <div
          style={{
            background: fueroActivo ? '#ecfdf5' : '#fef2f2',
            borderBottom: `1px solid ${fueroActivo ? '#a7f3d0' : '#fecaca'}`,
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{fueroActivo ? '🛡️' : '⚠️'}</span>
            <span style={{ fontWeight: 700, color: fueroActivo ? '#065f46' : '#991b1b' }}>
              {fueroActivo
                ? 'FUERO MATERNAL ACTIVO (INAMOVILIDAD REFORZADA · ART. 136 CÓDIGO LABORAL)'
                : 'FUERO MATERNAL INACTIVO / CESADO'}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}>
            <input
              type="checkbox"
              checked={fueroActivo}
              onChange={e => setFueroActivo(e.target.checked)}
            />
            Inamovilidad legal activa
          </label>
        </div>

        {/* ── Pestañas de Navegación ── */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0 24px',
          }}
        >
          <button
            onClick={() => setActiveTab('cronograma')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'cronograma' ? '2px solid #0284c7' : 'none',
              color: activeTab === 'cronograma' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'cronograma' ? 800 : 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            1. Reposo de 18 Semanas (126 Días)
          </button>
          <button
            onClick={() => setActiveTab('lactancia')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'lactancia' ? '2px solid #0284c7' : 'none',
              color: activeTab === 'lactancia' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'lactancia' ? 800 : 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            2. Horario de Lactancia (90 min)
          </button>
          <button
            onClick={() => setActiveTab('certificados')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'certificados' ? '2px solid #0284c7' : 'none',
              color: activeTab === 'certificados' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'certificados' ? 800 : 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>3. Certificados Trimestrales (24 Meses)</span>
            <span
              style={{
                background: certificados.length > 0 ? '#0284c7' : '#94a3b8',
                color: '#fff',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              {certificados.length}
            </span>
          </button>
        </div>

        {/* ── Contenido de las Pestañas ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* ── PESTAÑA 1: CRONOGRAMA DE 18 SEMANAS ── */}
          {activeTab === 'cronograma' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Estado Actual del Caso *
                  </label>
                  <select
                    value={estado}
                    onChange={e => setEstado(e.target.value as EstadoMaternidadLactancia)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="embarazada">🤰 Embarazada (En actividad con Fuero)</option>
                    <option value="reposo_maternidad">🏥 En Reposo de Maternidad (18 Semanas)</option>
                    <option value="lactancia_obligatoria">🍼 En Lactancia Obligatoria (0 a 6 Meses)</option>
                    <option value="lactancia_extendida">👶 En Lactancia Extendida (6 a 24 Meses)</option>
                    <option value="lactancia_finalizada">🏁 Lactancia Finalizada (&gt;24 Meses)</option>
                    <option value="ninguno">Ninguno / Sin registro activo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Fecha Notificación de Gravidez *
                  </label>
                  <input
                    type="date"
                    value={fechaNotificacion}
                    onChange={e => setFechaNotificacion(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Fecha formal de recepción con certificado médico.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Fecha Probable de Parto (FPP) *
                  </label>
                  <input
                    type="date"
                    value={fechaFPP}
                    onChange={e => setFechaFPP(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Semana 40 según ecografía/médico tratante.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Fecha de Parto Real (Opcional)
                  </label>
                  <input
                    type="date"
                    value={fechaPartoReal}
                    onChange={e => setFechaPartoReal(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Cargar cuando se produzca el nacimiento.
                  </span>
                </div>
              </div>

              {/* Parámetros de Reposo y Subsidio IPS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '4px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Inicio Anticipado del Reposo (Días pre-parto):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={inicioAnticipadoDias}
                    onChange={e => setInicioAnticipadoDias(parseInt(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Normalmente 14 días (2 semanas) antes de la FPP (Semana 38).
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Estado del Subsidio 100% IPS:
                  </label>
                  <select
                    value={subsidioIpsEstado}
                    onChange={e => setSubsidioIpsEstado(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="pendiente">Pendiente de trámite en IPS REI</option>
                    <option value="tramitado">Trámite ingresado en IPS REI</option>
                    <option value="cobrado_por_asegurada">Subsidio 100% percibido por la trabajadora</option>
                  </select>
                </div>
              </div>

              {/* Tarjetas de Cómputo Legal */}
              {cronogramaCalculado && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '8px',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#166534', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚖️</span>
                    <span>CÓMPUTO OFICIAL DE REPOSO (LEY N.º 5508/15 Y LEY N.º 7097/23)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                        Inicio de Reposo
                      </span>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#14532d', marginTop: '2px' }}>
                        {cronogramaCalculado.fechaInicioReposo}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Semana 38 prenatal</span>
                    </div>

                    <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                        Fin de Reposo (18 sem)
                      </span>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#14532d', marginTop: '2px' }}>
                        {cronogramaCalculado.fechaFinReposo}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>126 días continuos</span>
                    </div>

                    <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
                        Reincorporación
                      </span>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#14532d', marginTop: '2px' }}>
                        {cronogramaCalculado.fechaReincorporacionTrabajo}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Día hábil siguiente</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#166534', lineHeight: 1.4 }}>
                    💡 <strong>Recordatorio Legal:</strong> Durante las 18 semanas de reposo, el contrato de trabajo se encuentra suspendido. La empresa no abona salarios sino que IPS liquida el subsidio dinerario del 100% directamente a la asegurada.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PESTAÑA 2: HORARIO DE LACTANCIA 90 MIN ── */}
          {activeTab === 'lactancia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '12.5px',
                  color: '#0369a1',
                }}
              >
                🍼 <strong>Permiso Diario de Lactancia (Art. 14 Ley N.º 5508/15):</strong> Corresponde a <strong>90 minutos diarios remunerados</strong> computados como tiempo de trabajo efectivo, sin deducción salarial alguna.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  Modalidad de Usufructo Convenida con la Trabajadora:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    {
                      key: 'dos_pausas_45min',
                      title: 'Dos descansos de 45 minutos durante la jornada',
                      desc: 'Ejemplo: 45 min a media mañana y 45 min a media tarde.',
                    },
                    {
                      key: 'salida_temprana_90min',
                      title: 'Retiro anticipado 90 minutos antes del término de la jornada',
                      desc: 'La colaboradora se retira 1 hora y media antes de su horario habitual.',
                    },
                    {
                      key: 'entrada_tardia_90min',
                      title: 'Ingreso 90 minutos más tarde del inicio de la jornada',
                      desc: 'La colaboradora ingresa 1 hora y media después de su horario habitual.',
                    },
                    {
                      key: 'continuo_intermedio_90min',
                      title: 'Un descanso continuado de 90 minutos dentro de la jornada',
                      desc: 'Pausa de 1h30 para extracción de leche en sala de lactancia institucional.',
                    },
                  ].map(opt => (
                    <label
                      key={opt.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: modalidadLactancia === opt.key ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: modalidadLactancia === opt.key ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="modalidadLactancia"
                        value={opt.key}
                        checked={modalidadLactancia === opt.key}
                        onChange={() => setModalidadLactancia(opt.key as ModalidadLactancia90Min)}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{opt.title}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {cronogramaCalculado && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '6px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Etapa 1: Lactancia Obligatoria (0 a 6 Meses)
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                      Hasta el {cronogramaCalculado.fechaFinLactanciaObligatoria}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                      Derecho automático no sujeto a condición médica.
                    </div>
                  </div>

                  <div style={{ background: '#fefce8', padding: '12px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 700, textTransform: 'uppercase' }}>
                      Etapa 2: Tope Legal Máximo (24 Meses / 2 Años)
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#a16207', marginTop: '4px' }}>
                      Hasta el {cronogramaCalculado.fechaLimiteMaximoLactancia24Meses}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#854d0e', marginTop: '4px' }}>
                      Sujeto a presentación de constancia médica pediátrica cada 3 meses.
                    </div>
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={deseaExtension}
                  onChange={e => setDeseaExtension(e.target.checked)}
                />
                <span>Solicitar extensión de lactancia materna hasta los 24 meses (Ley N.º 7097/23)</span>
              </label>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  Observaciones y Acuerdos de Horario:
                </label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: La trabajadora ingresará a las 09:30 hs de lunes a viernes en vez de las 08:00 hs. Coordinado con gerencia de operaciones."
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* ── PESTAÑA 3: CERTIFICADOS PEDIÁTRICOS TRIMESTRALES (24 MESES) ── */}
          {activeTab === 'certificados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '12.5px',
                  color: '#92400e',
                  lineHeight: 1.4,
                }}
              >
                👶 <strong>Prórrogas Trimestrales (Ley N.º 7097/23):</strong> Para extender el permiso de lactancia de 90 minutos desde los 6 meses hasta los 24 meses (2 años), la madre debe entregar <strong>cada 3 meses un Certificado Médico Pediátrico</strong> que acredite la lactancia efectiva.
              </div>

              {/* Calendario Legal de Vencimientos */}
              {cronogramaCalculado && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    📅 Calendario de Renovación Trimestral Sugerido:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                    {cronogramaCalculado.fechasRecomendadasCertificadosTrimestrales.map(t => (
                      <div
                        key={t.nroTrimestre}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '8px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                          Trimestre {t.nroTrimestre}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Mes {t.mesVidaBebe} del bebé</div>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                          {t.fechaLimitePresentacion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de Certificados Registrados */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  📋 Constancias Pediátricas Registradas ({certificados.length}):
                </h4>
                {certificados.length === 0 ? (
                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '12.5px', color: '#64748b', textAlign: 'center' }}>
                    Aún no se han cargado certificados trimestrales. Cargue el primero abajo.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>TRIMESTRE</th>
                        <th style={{ padding: '8px 10px' }}>PRESENTACIÓN</th>
                        <th style={{ padding: '8px 10px' }}>VENCIMIENTO</th>
                        <th style={{ padding: '8px 10px' }}>PEDIATRA / REG.</th>
                        <th style={{ padding: '8px 10px' }}>ESTADO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certificados.map((c, i) => (
                        <tr key={c.id || i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>Trimestre {c.nroTrimestre}</td>
                          <td style={{ padding: '8px 10px' }}>{c.fechaPresentacion}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0284c7' }}>{c.fechaVencimiento}</td>
                          <td style={{ padding: '8px 10px' }}>{c.medicoPediatra}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: c.esVigente ? '#dcfce7' : '#f1f5f9',
                                color: c.esVigente ? '#15803d' : '#64748b',
                              }}
                            >
                              {c.esVigente ? 'Vigente' : 'Histórico'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Formulario para registrar nuevo certificado trimestral */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  ➕ Registrar Nueva Constancia Pediátrica Trimestral
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      N.º de Trimestre:
                    </label>
                    <select
                      value={nuevoCertTrimestre}
                      onChange={e => setNuevoCertTrimestre(parseInt(e.target.value) || 1)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}
                    >
                      <option value={1}>Trimestre 1 (Mes 9)</option>
                      <option value={2}>Trimestre 2 (Mes 12 / 1 Año)</option>
                      <option value={3}>Trimestre 3 (Mes 15)</option>
                      <option value={4}>Trimestre 4 (Mes 18 / 1.5 Años)</option>
                      <option value={5}>Trimestre 5 (Mes 21)</option>
                      <option value={6}>Trimestre 6 (Mes 24 / 2 Años)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      Fecha de Presentación:
                    </label>
                    <input
                      type="date"
                      value={nuevoCertFecha}
                      onChange={e => setNuevoCertFecha(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      Médico Pediatra Tratante:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Dra. Sandra Peralta"
                      value={nuevoCertPediatra}
                      onChange={e => setNuevoCertPediatra(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      Registro Profesional N.º:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 14.520"
                      value={nuevoCertRegProf}
                      onChange={e => setNuevoCertRegProf(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleAgregarCertificado}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: '#0284c7',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Guardar Certificado Trimestral (+3 meses)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Pie de Botones y Acciones ── */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDescargarPDF}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#047857',
                border: 'none',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Descargar Constancia Oficial en PDF con firmas y base legal"
            >
              <span>📄</span>
              <span>Descargar Constancia PDF (Ley 5508)</span>
            </button>

            {registroId && (
              <button
                type="button"
                onClick={handleEliminarRegistro}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Eliminar Registro
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
              }}
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
