/**
 * CALCULADORA DE LIQUIDACIÓN LABORAL — PARAGUAY
 * Interfaz moderna, simplificada y ejecutiva de alta precisión
 * 100% Confidencial y Neutral · Versión: PY-LIQ-2026.09.01
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { LiquidacionInput, MotivoEgreso, RegimenIPS } from '../types';
import { calcularLiquidacion } from '../liquidacion';
import { generarLiquidacionPDF } from '../generators/settlementPdfGenerator';
import { formatearAntiguedad } from '../engine/dates';
import {
  SALARIO_MINIMO_MENSUAL_2026,
  CATEGORIAS_SALARIALES_MTESS,
  ASIGNACION_FAMILIAR_LIMITE_SALARIO,
} from '../constants';
import { trackCalculoLiquidacion, trackDescargaPDF } from '../../analytics/metaPixel';
import { LeadCaptureModal } from '../../lead/LeadCaptureModal';
import { getLastLeadInfo } from '../../lead/services/leadService';
import { LABORAPY_CONFIG, createWhatsAppUrl, WhatsAppMessages } from '../../../config/laborapy';
import { CompactDatePicker } from './CompactDatePicker';

interface Props {
  onClose?: () => void;
}

export const FinalSettlementModal: React.FC<Props> = ({ onClose }) => {
  // ── 1. Parámetros Esenciales ────────────────────────────────────────────────
  const [salarioMensual, setSalarioMensual] = useState<number | ''>(SALARIO_MINIMO_MENSUAL_2026);
  const [categoriaSeleccionadaId, setCategoriaSeleccionadaId] = useState<string>('general_diurno');
  const [fechaIngreso, setFechaIngreso] = useState('2023-01-15');
  const [fechaEgreso, setFechaEgreso] = useState(() => new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState<MotivoEgreso>('despido_sin_causa');

  const categoriaActiva = CATEGORIAS_SALARIALES_MTESS.find(c => c.id === categoriaSeleccionadaId);

  const handleSeleccionarCategoria = (catId: string) => {
    setCategoriaSeleccionadaId(catId);
    const cat = CATEGORIAS_SALARIALES_MTESS.find(c => c.id === catId);
    if (cat) {
      setSalarioMensual(cat.salarioMensual);
    }
    if (catId === 'factura_honorarios') {
      setRegimen('factura');
    } else if (regimen === 'factura') {
      setRegimen('general');
    }
  };

  const handleCambioRegimen = (nuevoRegimen: RegimenIPS) => {
    setRegimen(nuevoRegimen);
    if (nuevoRegimen === 'factura') {
      setCategoriaSeleccionadaId('factura_honorarios');
    } else if (categoriaSeleccionadaId === 'factura_honorarios') {
      setCategoriaSeleccionadaId('general_diurno');
    }
  };

  // ── 2. Opciones Avanzadas (Colapsadas por Defecto) ──────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLegalBreakdown, setShowLegalBreakdown] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  // Datos del Colaborador y Empresa (para el PDF, 100% opcionales)
  const [empresa, setEmpresa] = useState('');
  const [nombreEmpleado, setNombreEmpleado] = useState('');
  const [ciEmpleado, setCiEmpleado] = useState('');
  const [cargoEmpleado, setCargoEmpleado] = useState('');
  const [codigoEmpleado, setCodigoEmpleado] = useState('');
  const [regimen, setRegimen] = useState<RegimenIPS>('general');

  // Preaviso y Vacaciones avanzadas
  const [preavisoOtorgado, setPreavisoOtorgado] = useState(false);
  const [preavisoDiasOtorgados, setPreavisoDiasOtorgados] = useState<number | ''>(0);
  const [vacacionesPeriodosAnteriores, setVacacionesPeriodosAnteriores] = useState<number | ''>(0);
  const [vacacionesAnterioresVencidas, setVacacionesAnterioresVencidas] = useState(true);
  const [vacacionesPeriodoActualGozadas, setVacacionesPeriodoActualGozadas] = useState<number | ''>(0);

  // Aguinaldo de período anterior pendiente
  const [adeudaAguinaldoAnterior, setAdeudaAguinaldoAnterior] = useState(false);
  const [montoAguinaldoAnterior, setMontoAguinaldoAnterior] = useState<number | ''>(0);

  // Bonificación Familiar (Arts. 261 al 271, Ley N.º 213/93)
  const [hijosMenoresACargo, setHijosMenoresACargo] = useState<number | ''>(0);
  const [adeudaBonificacionAnterior, setAdeudaBonificacionAnterior] = useState(false);
  const [montoBonificacionAnterior, setMontoBonificacionAnterior] = useState<number | ''>(0);

  // Protección Maternidad y Lactancia
  const [estadoMaternidadLactancia, setEstadoMaternidadLactancia] = useState<'ninguno' | 'embarazo' | 'lactancia'>('ninguno');

  // Variables
  const [tieneVariables, setTieneVariables] = useState(false);
  const [comisiones, setComisiones] = useState<number | ''>(0);
  const [horasExtras, setHorasExtras] = useState<number | ''>(0);
  const [ultimos6MesesStr, setUltimos6MesesStr] = useState('3500000, 3500000, 3500000, 3500000, 3500000, 3500000');

  // Descuentos comerciales o anticipos
  const [anticipoAguinaldo, setAnticipoAguinaldo] = useState<number | ''>(0);
  const [otrosDescuentos, setOtrosDescuentos] = useState<number | ''>(0);
  const [embargoJudicial, setEmbargoJudicial] = useState<number | ''>(0);

  // ── Cálculo reactivo instantáneo ───────────────────────────────────────────
  const { resultado, error } = useMemo(() => {
    try {
      const rem6m = tieneVariables
        ? ultimos6MesesStr
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n) && n > 0)
        : undefined;

      const esTopeBonificacion = (Number(salarioMensual) || 0) > ASIGNACION_FAMILIAR_LIMITE_SALARIO;
      const hijosACargoFinal = esTopeBonificacion ? 0 : (Number(hijosMenoresACargo) || 0);
      const bonifPendienteFinal = esTopeBonificacion ? undefined : (adeudaBonificacionAnterior ? Number(montoBonificacionAnterior) || 0 : undefined);

      const salarioImponibleBase = Number(salarioMensual) || 0;
      const topeEmbargo25 = Math.round(salarioImponibleBase * 0.25);
      const montoEmbargoEfectivo = Math.min(Number(embargoJudicial) || 0, topeEmbargo25);

      const input: LiquidacionInput = {
        empresa,
        nombreEmpleado,
        ciEmpleado,
        cargoEmpleado,
        codigoEmpleado,
        fechaIngreso,
        fechaEgreso,
        motivo,
        salarioMensual: Number(salarioMensual) || 0,
        tieneVariables,
        comisiones: Number(comisiones) || 0,
        horasExtras: Number(horasExtras) || 0,
        remuneracionesUltimos6Meses: rem6m,
        vacacionesPeriodosAnteriores: Number(vacacionesPeriodosAnteriores) || 0,
        vacacionesAnterioresVencidas,
        vacacionesPeriodoActual: Number(vacacionesPeriodoActualGozadas) || 0,
        preaviso: {
          obligado: motivo === 'renuncia' ? 'trabajador' : 'empleador',
          otorgado: preavisoOtorgado,
          diasOtorgados: Number(preavisoDiasOtorgados) || 0,
        },
        regimen,
        regimenLaboral: categoriaSeleccionadaId === 'trabajo_domestico' ? 'domestico' : 'general',
        aguinaldoAnteriorPendiente: adeudaAguinaldoAnterior ? Number(montoAguinaldoAnterior) || 0 : undefined,
        hijosMenoresACargo: hijosACargoFinal,
        bonificacionFamiliarPendiente: bonifPendienteFinal,
        estadoMaternidadLactancia,
        descuentosAdicionales: [
          ...(Number(anticipoAguinaldo) > 0
            ? [{ concepto: 'Anticipo de Aguinaldo', monto: Number(anticipoAguinaldo) }]
            : []),
          ...(Number(otrosDescuentos) > 0
            ? [{ concepto: 'Descuentos Varios', monto: Number(otrosDescuentos) }]
            : []),
          ...(montoEmbargoEfectivo > 0
            ? [{ concepto: 'Embargo Judicial (Tope 25% Art. 245 C.T.)', monto: montoEmbargoEfectivo }]
            : []),
        ],
      };

      const res = calcularLiquidacion(input);
      return { resultado: res, error: null };
    } catch (err: any) {
      return { resultado: null, error: err.message };
    }
  }, [
    empresa,
    nombreEmpleado,
    ciEmpleado,
    cargoEmpleado,
    codigoEmpleado,
    fechaIngreso,
    fechaEgreso,
    motivo,
    salarioMensual,
    categoriaSeleccionadaId,
    regimen,
    adeudaAguinaldoAnterior,
    montoAguinaldoAnterior,
    hijosMenoresACargo,
    adeudaBonificacionAnterior,
    montoBonificacionAnterior,
    estadoMaternidadLactancia,
    preavisoOtorgado,
    preavisoDiasOtorgados,
    vacacionesPeriodosAnteriores,
    vacacionesAnterioresVencidas,
    vacacionesPeriodoActualGozadas,
    tieneVariables,
    comisiones,
    horasExtras,
    ultimos6MesesStr,
    anticipoAguinaldo,
    otrosDescuentos,
  ]);

  // Tracking para Meta Ads al calcular
  useEffect(() => {
    if (resultado) {
      trackCalculoLiquidacion({
        motivo,
        totalNetoEstimado: resultado.totalNetoEstimado,
        antiguedadAnios: resultado.antiguedad.years,
      });
    }
  }, [resultado?.totalNetoEstimado, motivo]);

  // Ejemplos Rápidos de Escenarios Reales (100% Genéricos y Neutros)
  const cargarEjemploDespido = () => {
    setSalarioMensual(3500000);
    setFechaIngreso('2022-03-01');
    setFechaEgreso(new Date().toISOString().split('T')[0]);
    setMotivo('despido_sin_causa');
    setPreavisoOtorgado(false);
    setTieneVariables(false);
    setVacacionesPeriodosAnteriores(0);
    setAnticipoAguinaldo(0);
    setOtrosDescuentos(0);
  };

  const cargarEjemploRenuncia = () => {
    setSalarioMensual(4000000);
    setFechaIngreso('2023-01-10');
    setFechaEgreso(new Date().toISOString().split('T')[0]);
    setMotivo('renuncia');
    setPreavisoOtorgado(true);
    setTieneVariables(false);
    setVacacionesPeriodosAnteriores(0);
    setAnticipoAguinaldo(0);
    setOtrosDescuentos(0);
  };

  const cargarEjemploAntiguedad = () => {
    setSalarioMensual(5000000);
    setFechaIngreso('2014-06-15');
    setFechaEgreso(new Date().toISOString().split('T')[0]);
    setMotivo('despido_sin_causa');
    setPreavisoOtorgado(false);
    setVacacionesPeriodosAnteriores(12);
  };

  const fijarFechaHoy = () => {
    setFechaEgreso(new Date().toISOString().split('T')[0]);
  };

  const ejecutarDescargaPDF = (overrides?: { empresaOverride?: string; nombreOverride?: string }) => {
    if (!resultado) return;
    const empFinal = (overrides?.empresaOverride || empresa || '').trim();
    const nomFinal = (overrides?.nombreOverride || nombreEmpleado || '').trim();

    const rem6m = tieneVariables
      ? ultimos6MesesStr
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => !isNaN(n) && n > 0)
      : undefined;

    const input: LiquidacionInput = {
      empresa: empFinal,
      nombreEmpleado: nomFinal,
      ciEmpleado,
      cargoEmpleado,
      codigoEmpleado,
      fechaIngreso,
      fechaEgreso,
      motivo,
      salarioMensual: Number(salarioMensual) || 0,
      tieneVariables,
      comisiones: Number(comisiones) || 0,
      horasExtras: Number(horasExtras) || 0,
      remuneracionesUltimos6Meses: rem6m,
      vacacionesPeriodosAnteriores: Number(vacacionesPeriodosAnteriores) || 0,
      vacacionesAnterioresVencidas,
      vacacionesPeriodoActual: Number(vacacionesPeriodoActualGozadas) || 0,
      preaviso: {
        obligado: motivo === 'renuncia' ? 'trabajador' : 'empleador',
        otorgado: preavisoOtorgado,
        diasOtorgados: Number(preavisoDiasOtorgados) || 0,
      },
      regimen,
      regimenLaboral: categoriaSeleccionadaId === 'trabajo_domestico' ? 'domestico' : 'general',
      aguinaldoAnteriorPendiente: adeudaAguinaldoAnterior ? Number(montoAguinaldoAnterior) || 0 : undefined,
      hijosMenoresACargo: (Number(salarioMensual) || 0) > ASIGNACION_FAMILIAR_LIMITE_SALARIO ? 0 : (Number(hijosMenoresACargo) || 0),
      bonificacionFamiliarPendiente: (Number(salarioMensual) || 0) > ASIGNACION_FAMILIAR_LIMITE_SALARIO ? undefined : (adeudaBonificacionAnterior ? Number(montoBonificacionAnterior) || 0 : undefined),
      estadoMaternidadLactancia,
      descuentosAdicionales: [
        ...(Number(anticipoAguinaldo) > 0
          ? [{ concepto: 'Anticipo de Aguinaldo', monto: Number(anticipoAguinaldo) }]
          : []),
        ...(Number(otrosDescuentos) > 0
          ? [{ concepto: 'Descuentos Varios', monto: Number(otrosDescuentos) }]
          : []),
      ],
    };
    trackDescargaPDF({
      documento: 'Finiquito Oficial de Liquidación (PDF)',
      empleado: nomFinal || 'Trabajador',
      montoNeto: resultado.totalNetoEstimado,
    });
    const pdf = generarLiquidacionPDF(input, resultado);
    const slug = nomFinal && nomFinal.trim()
      ? nomFinal.trim().replace(/\s+/g, '_')
      : 'Liquidacion_Laboral';
    pdf.save(`Finiquito_${slug}.pdf`);
  };

  const solicitarDescarga = () => {
    setIsLeadModalOpen(true);
  };

  // Conceptos agrupados para la vista amigable
  const montoIndemnizacion =
    resultado?.conceptos.find(c => c.id === 'indemnizacion')?.monto || 0;

  const montoPreaviso =
    resultado?.conceptos.find(c => c.id.includes('preaviso') && !c.esDescuento)?.monto || 0;

  const descuentoPreaviso =
    resultado?.conceptos.find(c => c.id === 'descuento_preaviso_renuncia')?.monto || 0;

  const montoVacaciones =
    (resultado?.conceptos.find(c => c.id === 'vacaciones_causadas')?.monto || 0) +
    (resultado?.conceptos.find(c => c.id === 'vacaciones_proporcionales')?.monto || 0) +
    (resultado?.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores')?.monto || 0);

  const montoAguinaldo =
    (resultado?.aguinaldoProporcional || 0) +
    (resultado?.conceptos.find(c => c.id === 'aguinaldo_anterior_pendiente')?.monto || 0);

  const montoBonificacion =
    resultado?.conceptos.find(c => c.id === 'bonificacion_familiar')?.monto || 0;

  return (
    <div>
      {/* ── Barra Superior con Casos Rápidos ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Calculadora de Liquidación Laboral
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>
            Completa los 3 datos principales para obtener el cálculo exacto al instante.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={cargarEjemploDespido}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            🔴 Ejemplo Despido
          </button>
          <button
            onClick={cargarEjemploRenuncia}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            🟡 Ejemplo Renuncia
          </button>
          <button
            onClick={cargarEjemploAntiguedad}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            👑 +10 Años
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Grilla Principal: 3 Pasos a la Izquierda / Resultado a la Derecha ── */}
      <div className="calc-grid">
        {/* COLUMNA IZQUIERDA: 3 Pasos Clave */}
        <div>
          {/* ── PASO 1: Salario Mensual ── */}
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">1</div>
              <div>
                <div className="step-title">¿Cuál es tu salario mensual bruto?</div>
                <div className="step-subtitle">Tu sueldo base mensual en Guaraníes (antes de descuentos)</div>
              </div>
            </div>

            <div className="salary-input-container">
              <span className="salary-prefix">Gs.</span>
              <input
                type="number"
                value={salarioMensual}
                onChange={e => {
                  const val = e.target.value;
                  setSalarioMensual(val === '' ? '' : Math.max(0, Number(val)));
                }}
                onFocus={e => e.target.select()}
                className="salary-input"
                min="0"
                placeholder="0"
              />
            </div>

            <div className="quick-chips-group">
              <button
                type="button"
                onClick={() => handleSeleccionarCategoria('general_diurno')}
                className={`quick-chip ${categoriaSeleccionadaId === 'general_diurno' ? 'active' : ''}`}
              >
                ⚖️ Mínimo General Diurno: Gs. {SALARIO_MINIMO_MENSUAL_2026.toLocaleString('es-PY')}
              </button>
              <button
                type="button"
                onClick={() => handleSeleccionarCategoria('guardia_seguridad_12h')}
                className={`quick-chip ${categoriaSeleccionadaId === 'guardia_seguridad_12h' ? 'active' : ''}`}
              >
                🛡️ Guardia (12 hs): Gs. 4.566.001
              </button>
              <button
                type="button"
                onClick={() => handleSeleccionarCategoria('enfermeria_profesional')}
                className={`quick-chip ${categoriaSeleccionadaId === 'enfermeria_profesional' ? 'active' : ''}`}
              >
                🏥 Enfermería: Gs. 3.957.200
              </button>
              <button
                type="button"
                onClick={() => handleSeleccionarCategoria('trabajo_domestico')}
                className={`quick-chip ${categoriaSeleccionadaId === 'trabajo_domestico' ? 'active' : ''}`}
              >
                🧹 Trabajo Doméstico (Ley 5407)
              </button>
              <button
                type="button"
                onClick={() => handleSeleccionarCategoria('factura_honorarios')}
                className={`quick-chip ${regimen === 'factura' ? 'active' : ''}`}
              >
                📑 Facturo mi Salario
              </button>
            </div>

            {/* ── Selector Desplegable de Rubros y Actividades Especiales (MTESS) ── */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                🏢 O selecciona según la resolución de tu rubro o actividad (MTESS / CONASAM):
              </label>
              <select
                value={categoriaSeleccionadaId}
                onChange={e => handleSeleccionarCategoria(e.target.value)}
                className="input-control"
                style={{ background: '#f8fafc', fontWeight: 600, color: '#0f172a', borderColor: '#cbd5e1' }}
              >
                {CATEGORIAS_SALARIALES_MTESS.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre} — Gs. {cat.salarioMensual.toLocaleString('es-PY')}
                  </option>
                ))}
              </select>

              {categoriaActiva && (
                <div style={{ marginTop: '8px', padding: '10px 14px', background: categoriaActiva.id === 'factura_honorarios' ? '#eff6ff' : '#f0fdf4', borderRadius: '8px', border: `1px solid ${categoriaActiva.id === 'factura_honorarios' ? '#bfdbfe' : '#bbf7d0'}`, fontSize: '12.5px', color: categoriaActiva.id === 'factura_honorarios' ? '#1e40af' : '#166534', lineHeight: '1.45' }}>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{categoriaActiva.id === 'factura_honorarios' ? '⚖️' : '✓'}</span>
                    <span>{categoriaActiva.nombre}</span>
                    <span style={{ fontSize: '11px', background: categoriaActiva.id === 'factura_honorarios' ? '#dbeafe' : '#dcfce7', padding: '2px 6px', borderRadius: '10px', color: categoriaActiva.id === 'factura_honorarios' ? '#1d4ed8' : '#15803d' }}>
                      {categoriaActiva.rubro}
                    </span>
                  </div>
                  <div style={{ marginTop: '2px', color: '#334155' }}>
                    {categoriaActiva.descripcion}. {categoriaActiva.jornalDiario ? `(Jornal diario mínimo: Gs. ${categoriaActiva.jornalDiario.toLocaleString('es-PY')}).` : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: categoriaActiva.id === 'factura_honorarios' ? '#1d4ed8' : '#15803d', marginTop: '3px', fontWeight: 600 }}>
                    Respaldado por: {categoriaActiva.normativa}
                  </div>
                </div>
              )}
            </div>

            {/* ── Pregunta Clave: ¿Tenés IPS o Facturás tu Salario? ── */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>❓</span>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  ¿Tenés IPS o facturás tu salario?
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleCambioRegimen('general')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: regimen === 'general' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: regimen === 'general' ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: regimen === 'general' ? '0 2px 4px rgba(5,150,105,0.12)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🏢</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: regimen === 'general' ? '#065f46' : '#1e293b' }}>
                      En Planilla con IPS
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Relación formal · Retención 9% IPS
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleCambioRegimen('factura')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: regimen === 'factura' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: regimen === 'factura' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: regimen === 'factura' ? '0 2px 4px rgba(37,99,235,0.15)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>📑</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: regimen === 'factura' ? '#1e40af' : '#1e293b' }}>
                      Facturo mi Salario
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Factura mensual con IVA · Sin IPS
                    </div>
                  </div>
                </button>
              </div>

              {/* ── Aclaración Legal Clave para Personas que Facturan ── */}
              {regimen === 'factura' && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '14px 16px',
                    background: '#eff6ff',
                    borderRadius: '10px',
                    border: '1.5px solid #93c5fd',
                    color: '#1e3a8a',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13.5px', color: '#1d4ed8', marginBottom: '6px' }}>
                    <span style={{ fontSize: '20px' }}>⚖️</span>
                    <span>Aclaración Legal: Si facturás todos los meses, tenés Relación de Dependencia</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.55', color: '#1e293b' }}>
                    Conforme al <strong>Principio de Primacía de la Realidad</strong> (Arts. 18 y 19 del Código del Trabajo, Ley N.º 213/93), si emites facturas con IVA periódicamente a una misma empresa, cumples horario habitual o recibes directivas, <strong>la ley paraguaya presume automáticamente un contrato de trabajo en relación de dependencia</strong>, sin importar que te hagan figurar como 'prestador de servicios' o 'honorarios'.
                  </p>
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12px', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <strong>✅ Cobro Íntegro de Liquidación:</strong> Al terminar la relación laboral, te corresponden legalmente indemnización por despido injustificado (Art. 91), preaviso (Art. 87), aguinaldo proporcional y vacaciones acumuladas.
                    </div>
                    <div>
                      <strong>✅ Sin Descuento del 9% IPS:</strong> Esta calculadora no descuenta el 9% de IPS porque la patronal no te realizaba dicha retención en tus facturas, mostrándote el monto bruto íntegro a cobrar.
                    </div>
                    <div>
                      <strong>⚖️ Reclamo de Aportes Jubilatorios a IPS:</strong> Tienes el derecho legal de denunciar ante el MTESS o demandar judicialmente que la empresa abone retroactivamente todos los aportes de jubilación y salud omitidos.
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <a
                        href={createWhatsAppUrl(WhatsAppMessages.primaciaRealidad())}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          background: '#1d4ed8',
                          color: '#ffffff',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          boxShadow: '0 1px 4px rgba(29, 78, 216, 0.25)',
                        }}
                      >
                        <span>💬</span>
                        <span>Asesorarme sobre Primacía de la Realidad en WhatsApp ({LABORAPY_CONFIG.whatsAppDisplay})</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── ¿Te adeudan aguinaldo del año anterior? ── */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🎁</span>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                    ¿Te adeudan aguinaldo del año anterior o períodos pasados?
                  </label>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    El pago antes del 31 de diciembre es una obligación patronal ineludible (Art. 243 C.T.)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAdeudaAguinaldoAnterior(false);
                    setMontoAguinaldoAnterior(0);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: !adeudaAguinaldoAnterior ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: !adeudaAguinaldoAnterior ? '#ecfdf5' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    color: !adeudaAguinaldoAnterior ? '#065f46' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  ✓ No, está al día
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdeudaAguinaldoAnterior(true);
                    if (!montoAguinaldoAnterior || montoAguinaldoAnterior === 0) setMontoAguinaldoAnterior(salarioMensual);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: adeudaAguinaldoAnterior ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: adeudaAguinaldoAnterior ? '#fff7ed' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    color: adeudaAguinaldoAnterior ? '#c2410c' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  ⚠️ Sí, me adeudan
                </button>
              </div>

              {adeudaAguinaldoAnterior && (
                <div style={{ marginTop: '12px', padding: '12px 14px', background: '#fff7ed', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#9a3412' }}>
                      Monto adeudado de aguinaldo (Gs.):
                    </label>
                    <button
                      type="button"
                      onClick={() => setMontoAguinaldoAnterior(salarioMensual)}
                      style={{
                        background: '#fed7aa',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#9a3412',
                        cursor: 'pointer',
                      }}
                    >
                      1 Sueldo Completo (Gs. {(Number(salarioMensual) || 0).toLocaleString('es-PY')})
                    </button>
                  </div>
                  <input
                    type="number"
                    value={montoAguinaldoAnterior}
                    onChange={e => {
                      const val = e.target.value;
                      setMontoAguinaldoAnterior(val === '' ? '' : Math.max(0, Number(val)));
                    }}
                    onFocus={e => e.target.select()}
                    className="input-control"
                    style={{ fontWeight: 800, color: '#9a3412', borderColor: '#fdba74' }}
                    min="0"
                    placeholder="0"
                  />
                  <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '6px', lineHeight: '1.4' }}>
                    ⚖️ <strong>Art. 243 Código del Trabajo:</strong> Es una obligación que el empleador debe abonar a más tardar el 31 de diciembre. Se suma al 100% íntegro a tu liquidación libre de descuentos de IPS.
                  </div>
                </div>
              )}

              {/* ── Sub-sección: Bonificación Familiar (Arts. 261 al 271, Ley 213/93) ── */}
              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1.5px dashed #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👶</span>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                      Hijos Menores de 18 Años (Bonificación Familiar · Art. 261 C.T.)
                    </label>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      5% del salario mínimo legal (Gs. 152.200 / mes por hijo). Inembargable y 100% exento de IPS.
                    </div>
                  </div>
                </div>

                {Number(salarioMensual) > ASIGNACION_FAMILIAR_LIMITE_SALARIO ? (
                  <div style={{ padding: '12px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '16px', lineHeight: '1.2' }}>ℹ️</span>
                      <div style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.45' }}>
                        <strong>Tope Legal (Art. 263 C.T.):</strong> Tu salario mensual de Gs. {Number(salarioMensual).toLocaleString('es-PY')} supera los 2 salarios mínimos (Gs. {ASIGNACION_FAMILIAR_LIMITE_SALARIO.toLocaleString('es-PY')}). La ley laboral establece que cesa la obligación patronal de pagar asignación familiar obligatoria.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {[0, 1, 2, 3, 4].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setHijosMenoresACargo(num)}
                          style={{
                            flex: 1,
                            minWidth: '55px',
                            minHeight: '44px',
                            padding: '10px 8px',
                            borderRadius: '8px',
                            border: hijosMenoresACargo === num ? '2px solid #059669' : '1px solid #cbd5e1',
                            background: hijosMenoresACargo === num ? '#ecfdf5' : '#ffffff',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            color: hijosMenoresACargo === num ? '#065f46' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          {num === 0 ? 'Sin hijos' : `${num} ${num === 1 ? 'Hijo' : 'Hijos'}`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setHijosMenoresACargo(Number(hijosMenoresACargo) >= 5 ? hijosMenoresACargo : 5)}
                        style={{
                          flex: 1,
                          minWidth: '55px',
                          minHeight: '44px',
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: Number(hijosMenoresACargo) >= 5 ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: Number(hijosMenoresACargo) >= 5 ? '#ecfdf5' : '#ffffff',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          color: Number(hijosMenoresACargo) >= 5 ? '#065f46' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        5+ Hijos
                      </button>
                    </div>

                    {Number(hijosMenoresACargo) >= 5 && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>
                          Especificar cantidad de hijos:
                        </label>
                        <input
                          type="number"
                          value={hijosMenoresACargo}
                          onChange={e => {
                            const val = e.target.value;
                            setHijosMenoresACargo(val === '' ? '' : Math.max(0, Number(val)));
                          }}
                          onFocus={e => e.target.select()}
                          className="input-control"
                          style={{ width: '90px', padding: '6px 10px', fontWeight: 800 }}
                          min="0"
                          max="20"
                          placeholder="0"
                        />
                      </div>
                    )}

                    {Number(hijosMenoresACargo) > 0 && (
                      <div style={{ marginTop: '10px', padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✓</span>
                          <span>
                            Asignación mensual: Gs. {((Number(hijosMenoresACargo) || 0) * 152_200).toLocaleString('es-PY')} (Gs. 152.200 × {Number(hijosMenoresACargo) || 0})
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px', lineHeight: '1.4' }}>
                          En la liquidación se abona de forma íntegra mensual (Art. 269 C.T.). Es 100% inembargable y exento de aporte jubilatorio a IPS (Art. 268 C.T.).
                        </div>

                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #a7f3d0' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 700, color: '#065f46', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={adeudaBonificacionAnterior}
                              onChange={e => {
                                setAdeudaBonificacionAnterior(e.target.checked);
                                if (e.target.checked && (!montoBonificacionAnterior || montoBonificacionAnterior === 0)) {
                                  setMontoBonificacionAnterior((Number(hijosMenoresACargo) || 0) * 152_200);
                                }
                              }}
                              style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                            />
                            ¿Te adeudan asignaciones familiares de meses anteriores?
                          </label>

                          {adeudaBonificacionAnterior && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <label style={{ fontSize: '11px', color: '#065f46' }}>Monto adeudado anterior (Gs.):</label>
                              <input
                                type="number"
                                value={montoBonificacionAnterior}
                                onChange={e => {
                                  const val = e.target.value;
                                  setMontoBonificacionAnterior(val === '' ? '' : Math.max(0, Number(val)));
                                }}
                                onFocus={e => e.target.select()}
                                className="input-control"
                                style={{ width: '160px', padding: '6px 10px', fontWeight: 800, color: '#065f46' }}
                                min="0"
                                placeholder="0"
                              />
                              <button
                                type="button"
                                onClick={() => setMontoBonificacionAnterior((Number(hijosMenoresACargo) || 0) * 152_200)}
                                style={{
                                  background: '#a7f3d0',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#065f46',
                                  cursor: 'pointer',
                                }}
                              >
                                1 Mes (Gs. {((Number(hijosMenoresACargo) || 0) * 152_200).toLocaleString('es-PY')})
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PASO 2: Fechas de Trabajo ── */}
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">2</div>
              <div>
                <div className="step-title">¿Cuándo empezaste y cuándo terminó la relación laboral?</div>
                <div className="step-subtitle">Calculamos tu antigüedad exacta en años, meses y días</div>
              </div>
            </div>

            <div className="grid-2col">
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
                  quickAction={{ label: 'Hoy', onClick: fijarFechaHoy }}
                />
              </div>
            </div>

            {resultado && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⏳</span>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                    Antigüedad Calculada:
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857' }}>
                    {formatearAntiguedad(resultado.antiguedad)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── PASO 3: Motivo de Salida ── */}
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">3</div>
              <div>
                <div className="step-title">¿Cuál fue el motivo de salida?</div>
                <div className="step-subtitle">El motivo define si corresponde indemnización y preaviso</div>
              </div>
            </div>

            <div className="motivos-grid">
              <div
                onClick={() => setMotivo('despido_sin_causa')}
                className={`motivo-card ${motivo === 'despido_sin_causa' ? 'selected' : ''}`}
              >
                <div className="motivo-icon">🔴</div>
                <div>
                  <div className="motivo-card-title">Despido Sin Causa</div>
                  <div className="motivo-card-desc">Me despidieron injustificadamente. Corresponde indemnización y preaviso.</div>
                </div>
              </div>

              <div
                onClick={() => setMotivo('renuncia')}
                className={`motivo-card ${motivo === 'renuncia' ? 'selected' : ''}`}
              >
                <div className="motivo-icon">🟡</div>
                <div>
                  <div className="motivo-card-title">Renuncia Voluntaria</div>
                  <div className="motivo-card-desc">Renuncié voluntariamente. Corresponde aguinaldo y vacaciones causadas.</div>
                </div>
              </div>

              <div
                onClick={() => setMotivo('despido_con_causa')}
                className={`motivo-card ${motivo === 'despido_con_causa' ? 'selected' : ''}`}
              >
                <div className="motivo-icon">⚪</div>
                <div>
                  <div className="motivo-card-title">Despido Con Causa</div>
                  <div className="motivo-card-desc">Despido justificado según causas del Art. 81 del Código Laboral.</div>
                </div>
              </div>

              <div
                onClick={() => setMotivo('mutuo_acuerdo')}
                className={`motivo-card ${motivo === 'mutuo_acuerdo' ? 'selected' : ''}`}
              >
                <div className="motivo-icon">🤝</div>
                <div>
                  <div className="motivo-card-title">Mutuo Acuerdo</div>
                  <div className="motivo-card-desc">Salida pactada de común acuerdo entre ambas partes.</div>
                </div>
              </div>
            </div>

            {/* ── Protección Especial: Embarazo y Lactancia Materna ── */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🤱</span>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                    ¿Afectada por Estado de Embarazo o Período de Lactancia?
                  </label>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Protección especial de inamovilidad y fuero maternal (Ley N.º 5508/15)
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEstadoMaternidadLactancia('ninguno')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: estadoMaternidadLactancia === 'ninguno' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: estadoMaternidadLactancia === 'ninguno' ? '#ecfdf5' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: estadoMaternidadLactancia === 'ninguno' ? '#065f46' : '#64748b',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  ⚪ No aplica
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoMaternidadLactancia('embarazo')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: estadoMaternidadLactancia === 'embarazo' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    background: estadoMaternidadLactancia === 'embarazo' ? '#fef2f2' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: estadoMaternidadLactancia === 'embarazo' ? '#b91c1c' : '#64748b',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  🤰 En Embarazo / Gestación
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoMaternidadLactancia('lactancia')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: estadoMaternidadLactancia === 'lactancia' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    background: estadoMaternidadLactancia === 'lactancia' ? '#fef2f2' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: estadoMaternidadLactancia === 'lactancia' ? '#b91c1c' : '#64748b',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  🤱 En Período de Lactancia
                </button>
              </div>

              {estadoMaternidadLactancia !== 'ninguno' && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '16px',
                    background: '#fef2f2',
                    borderRadius: '12px',
                    border: '2px solid #ef4444',
                    color: '#991b1b',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '14.5px', color: '#b91c1c' }}>
                    <span style={{ fontSize: '24px' }}>🚨</span>
                    <span>¡NO TE PUEDEN DESPEDIR! INAMOVILIDAD LABORAL ABSOLUTA</span>
                  </div>
                  <p style={{ margin: '8px 0', fontSize: '12.5px', lineHeight: '1.55', color: '#7f1d1d' }}>
                    Conforme a la <strong>Ley N.º 5508/15</strong> (Protección de la Maternidad y Apoyo a la Lactancia Materna) y el <strong>Art. 136 del Código del Trabajo</strong>, la trabajadora en estado de gestación o en período de lactancia goza de <strong>FUERO MATERNAL E INAMOVILIDAD LABORAL</strong>.
                  </p>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '12px', color: '#991b1b', lineHeight: '1.55', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <strong>❌ El despido es NULO:</strong> Ningún empleador puede despedirte sin una autorización judicial previa obtenida en un juicio de justificación de causal ante el Juzgado Laboral.
                    </div>
                    <div>
                      <strong>⚖️ Derecho a Reincorporación Inmediata:</strong> Tienes derecho a rechazar el despido y exigir volver a tu puesto laboral cobrando todos los salarios devengados.
                    </div>
                    <div>
                      <strong>💰 Salarios Caídos e Indemnización Agravada:</strong> Si la patronal insiste en desvincularte, la ley contempla el cobro de todos los sueldos caídos hasta el fin del período protegido más indemnizaciones agravadas especiales.
                    </div>
                    <div>
                      <strong>⚠️ Advertencia Vital:</strong> ¡NO firmes ninguna carta de renuncia voluntaria ni acuerdo de mutuo acuerdo bajo presión patronal!
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => solicitarDescarga()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 18px',
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                      }}
                    >
                      <span>⚖️</span>
                      <span>Solicitar Asesoramiento de Experto en RRHH</span>
                    </button>

                    <a
                      href={createWhatsAppUrl(WhatsAppMessages.maternidad())}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 18px',
                        background: '#25d366',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(37, 211, 102, 0.35)',
                      }}
                    >
                      <span>💬</span>
                      <span>Contactar Urgente por WhatsApp ({LABORAPY_CONFIG.whatsAppDisplay})</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── OPCIONES AVANZADAS (Colapsadas por Defecto) ── */}
          <div className="advanced-accordion">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="advanced-toggle-btn"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Opciones avanzadas y personalización (opcional)
              </span>
              <span>{showAdvanced ? '▲ Ocultar' : '▼ Mostrar'}</span>
            </button>

            {showAdvanced && (
              <div className="advanced-content">
                {/* Comisiones y variables */}
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tieneVariables}
                      onChange={e => setTieneVariables(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                    />
                    ¿Percibías comisiones u horas extras?
                  </label>
                  {tieneVariables && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="grid-2col field-group" style={{ marginBottom: '10px' }}>
                        <div>
                          <label className="field-label">Comisiones Devengadas del Período (Gs.)</label>
                          <input
                            type="number"
                            value={comisiones}
                            onChange={e => {
                              const val = e.target.value;
                              setComisiones(val === '' ? '' : Math.max(0, Number(val)));
                            }}
                            onFocus={e => e.target.select()}
                            className="input-control"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="field-label">Horas Extras del Período (Gs.)</label>
                          <input
                            type="number"
                            value={horasExtras}
                            onChange={e => {
                              const val = e.target.value;
                              setHorasExtras(val === '' ? '' : Math.max(0, Number(val)));
                            }}
                            onFocus={e => e.target.select()}
                            className="input-control"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                        Histórico últimos 6 meses (para base de indemnización Art. 92 inc. b C.T., separados por coma):
                      </label>
                      <input
                        type="text"
                        value={ultimos6MesesStr}
                        onChange={e => setUltimos6MesesStr(e.target.value)}
                        className="input-control"
                      />
                    </div>
                  )}
                </div>

                {/* Preaviso cumplido */}
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={preavisoOtorgado}
                      onChange={e => setPreavisoOtorgado(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                    />
                    ¿El preaviso fue trabajado / otorgado en tiempo y forma?
                  </label>
                  {preavisoOtorgado && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                        Días efectivamente otorgados:
                      </label>
                      <input
                        type="number"
                        value={preavisoDiasOtorgados}
                        onChange={e => {
                          const val = e.target.value;
                          setPreavisoDiasOtorgados(val === '' ? '' : Math.max(0, Number(val)));
                        }}
                        onFocus={e => e.target.select()}
                        className="input-control"
                        style={{ width: '100px' }}
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>

                {/* Vacaciones pendientes */}
                <div className="grid-2col field-group">
                  <div>
                    <label className="field-label">Vacaciones Años Anteriores (Días pendientes)</label>
                    <input
                      type="number"
                      value={vacacionesPeriodosAnteriores}
                      onChange={e => {
                        const val = e.target.value;
                        setVacacionesPeriodosAnteriores(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      onFocus={e => e.target.select()}
                      className="input-control"
                      placeholder="0"
                    />
                    {Number(vacacionesPeriodosAnteriores) > 0 && (
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '6px', fontSize: '11.5px', color: '#047857', fontWeight: 600, cursor: 'pointer', lineHeight: '1.35' }}>
                        <input
                          type="checkbox"
                          checked={vacacionesAnterioresVencidas}
                          onChange={e => setVacacionesAnterioresVencidas(e.target.checked)}
                          style={{ accentColor: '#059669', marginTop: '2px' }}
                        />
                        <span>
                          <strong>Períodos vencidos (&gt; 6 meses de causados)</strong>: Se abonan al <strong>doble (x2)</strong> por ley (Arts. 221 y 223 C.T.).
                        </span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Vacaciones Gozadas Año Actual</label>
                    <input
                      type="number"
                      value={vacacionesPeriodoActualGozadas}
                      onChange={e => {
                        const val = e.target.value;
                        setVacacionesPeriodoActualGozadas(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      onFocus={e => e.target.select()}
                      className="input-control"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Descuentos o Anticipos */}
                <div className="grid-2col field-group">
                  <div>
                    <label className="field-label">Anticipo de Aguinaldo a Devolver (Gs.)</label>
                    <input
                      type="number"
                      value={anticipoAguinaldo}
                      onChange={e => {
                        const val = e.target.value;
                        setAnticipoAguinaldo(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      onFocus={e => e.target.select()}
                      className="input-control"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="field-label">Otros Descuentos Comerciales (Gs.)</label>
                    <input
                      type="number"
                      value={otrosDescuentos}
                      onChange={e => {
                        const val = e.target.value;
                        setOtrosDescuentos(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      onFocus={e => e.target.select()}
                      className="input-control"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="field-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Embargo Judicial (Gs., tope 25% Art. 245 C.T.)</label>
                  <input
                    type="number"
                    value={embargoJudicial}
                    onChange={e => {
                      const val = e.target.value;
                      setEmbargoJudicial(val === '' ? '' : Math.max(0, Number(val)));
                    }}
                    onFocus={e => e.target.select()}
                    className="input-control"
                    placeholder="0"
                  />
                </div>

                {/* Datos para el documento formal */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Datos para el Finiquito en PDF / Word (Opcional):
                  </div>
                  <div className="grid-2col field-group">
                    <div>
                      <label className="field-label">Empresa o Empleador</label>
                      <input
                        type="text"
                        value={empresa}
                        onChange={e => setEmpresa(e.target.value)}
                        className="input-control"
                        placeholder="Nombre o Razón Social (Opcional)"
                      />
                    </div>
                    <div>
                      <label className="field-label">Nombre del Trabajador</label>
                      <input
                        type="text"
                        value={nombreEmpleado}
                        onChange={e => setNombreEmpleado(e.target.value)}
                        className="input-control"
                        placeholder="Nombre y Apellido (Opcional)"
                      />
                    </div>
                  </div>
                  <div className="grid-2col field-group">
                    <div>
                      <label className="field-label">C.I. Nº</label>
                      <input
                        type="text"
                        value={ciEmpleado}
                        onChange={e => setCiEmpleado(e.target.value)}
                        className="input-control"
                        placeholder="Ej: 3.456.789"
                      />
                    </div>
                    <div>
                      <label className="field-label">Cargo / Función</label>
                      <input
                        type="text"
                        value={cargoEmpleado}
                        onChange={e => setCargoEmpleado(e.target.value)}
                        className="input-control"
                        placeholder="Ej: Auxiliar / Vendedor"
                      />
                    </div>
                  </div>

                  <div className="grid-2col field-group">
                    <div>
                      <label className="field-label">Código / Legajo</label>
                      <input
                        type="text"
                        value={codigoEmpleado}
                        onChange={e => setCodigoEmpleado(e.target.value)}
                        className="input-control"
                        placeholder="Ej: 0110 (Opcional)"
                      />
                    </div>
                    <div>
                      <label className="field-label">Régimen IPS</label>
                      <select
                        value={regimen}
                        onChange={e => handleCambioRegimen(e.target.value as RegimenIPS)}
                        className="input-control"
                      >
                        <option value="general">General en Planilla (9% Aporte Obrero)</option>
                        <option value="factura">Facturación Mensual (Sin Retención IPS / Art. 19 C.T.)</option>
                        <option value="especial">Especial / Docente</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: Resultado Destacado */}
        <div>
          {error && (
            <div style={{ padding: '14px', background: '#fee2e2', color: '#991b1b', borderRadius: '10px', border: '1px solid #f87171', marginBottom: '16px', fontSize: '13px' }}>
              <strong>⚠️ Verifica los datos:</strong> {error}
            </div>
          )}

          {resultado && (
            <div className="result-panel">
              {/* Alertas Rojas Críticas */}
              {resultado.alertas.filter(a => a.tipo === 'roja').map((alerta, idx) => (
                <div key={idx} style={{ padding: '12px 14px', background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '8px', color: '#991b1b', fontSize: '12px', lineHeight: '1.45', marginBottom: '14px' }}>
                  <strong>{alerta.id === 'A10_MATERNIDAD_LACTANCIA' ? '🚨 INAMOVILIDAD POR MATERNIDAD / LACTANCIA:' : 'ℹ️ ESTABILIDAD ESPECIAL (+10 AÑOS):'}</strong> {alerta.mensaje}
                  {alerta.id === 'A10_MATERNIDAD_LACTANCIA' && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => solicitarDescarga()}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>⚖️</span>
                        <span>Solicitar Asesoría</span>
                      </button>
                      <a
                        href={createWhatsAppUrl(WhatsAppMessages.maternidad())}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#25d366',
                          color: '#fff',
                          textDecoration: 'none',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>💬</span>
                        <span>WhatsApp Especialista (+595)</span>
                      </a>
                    </div>
                  )}
                  {alerta.id === 'A01' && (
                    <div style={{ marginTop: '10px' }}>
                      <a
                        href={createWhatsAppUrl(WhatsAppMessages.estabilidad10Anios())}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#b45309',
                          color: '#fff',
                          textDecoration: 'none',
                          padding: '8px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>💬</span>
                        <span>Consultar Estabilidad Decenal en WhatsApp (+595)</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}

              {/* Tarjeta Heroica del Neto */}
              <div className="hero-neto-card">
                <div className="hero-neto-label">Total Neto Estimado a Cobrar</div>
                <div className="hero-neto-amount">
                  Gs. {resultado.totalNetoEstimado.toLocaleString('es-PY')}
                </div>
                <div className="hero-neto-letras">
                  {resultado.montoEnLetras}
                </div>
              </div>

              {/* Badge Informativo de Modalidad Factura */}
              {regimen === 'factura' && (
                <div style={{ marginTop: '10px', marginBottom: '14px', padding: '9px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: '1.4' }}>
                  <span style={{ fontSize: '16px' }}>⚖️</span>
                  <span><strong>Facturación Mensual:</strong> Liquidación amparada en la Primacía de la Realidad (Art. 19 C.T.) sin retención del 9% de IPS.</span>
                </div>
              )}

              {/* 3 Pilares del Cálculo */}
              <div className="pillars-grid">
                <div className="pillar-item">
                  <div className="pillar-item-label">
                    <span>💼</span>
                    <span>Indemnización por Despido</span>
                  </div>
                  <div className="pillar-item-value" style={{ color: montoIndemnizacion > 0 ? '#047857' : '#94a3b8' }}>
                    {montoIndemnizacion > 0
                      ? `Gs. ${montoIndemnizacion.toLocaleString('es-PY')}`
                      : 'No aplica'}
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-item-label">
                    <span>⏳</span>
                    <span>Preaviso</span>
                  </div>
                  <div className="pillar-item-value" style={{ color: montoPreaviso > 0 ? '#047857' : descuentoPreaviso > 0 ? '#dc2626' : '#94a3b8' }}>
                    {montoPreaviso > 0
                      ? `Gs. ${montoPreaviso.toLocaleString('es-PY')}`
                      : descuentoPreaviso > 0
                      ? `- Gs. ${descuentoPreaviso.toLocaleString('es-PY')} (Desc.)`
                      : 'No aplica / Cumplido'}
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-item-label">
                    <span>🏖️</span>
                    <span>Vacaciones y Aguinaldo</span>
                  </div>
                  <div className="pillar-item-value" style={{ color: '#047857' }}>
                    Gs. {(montoVacaciones + montoAguinaldo).toLocaleString('es-PY')}
                  </div>
                </div>

                {montoBonificacion > 0 && (
                  <div className="pillar-item" style={{ gridColumn: '1 / -1', background: '#ecfdf5', border: '1.5px solid #6ee7b7' }}>
                    <div className="pillar-item-label" style={{ color: '#065f46' }}>
                      <span>👶</span>
                      <span>Bonificación Familiar (Art. 261 C.T. · 100% Exento IPS)</span>
                    </div>
                    <div className="pillar-item-value" style={{ color: '#047857', fontWeight: 800 }}>
                      + Gs. {montoBonificacion.toLocaleString('es-PY')}
                    </div>
                  </div>
                )}
              </div>

              {/* Resumen de Haber Imponible IPS */}
              <div
                style={{
                  marginTop: '12px',
                  marginBottom: '14px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Haber Imponible Total (IPS / Liquidación)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Salario, comisiones, horas extras, vacaciones, indemnización y preaviso
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Gs. {(resultado.baseImponibleIPS ?? 0).toLocaleString('es-PY')}
                </div>
              </div>

              {/* Botón Único de Descarga Oficial — Documento PDF Inmutable y Certificado */}
              <button onClick={solicitarDescarga} className="btn-cta-primary">
                📄 Descargar Finiquito Oficial (PDF)
              </button>

              {/* ── Banner Exclusivo ERP RRHH para Empresas (Planillas MTESS & Gestión Masiva) ── */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px 16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 240px' }}>
                  <span style={{ fontSize: '24px' }}>🏢</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      ¿Tu empresa necesita exportar la Planilla Oficial MTESS (27 columnas)?
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
                      La generación de libros de sueldos y planillas de liquidación del Ministerio es una función exclusiva para empresas en <strong>{LABORAPY_CONFIG.brandName} ERP RRHH</strong>.
                    </div>
                  </div>
                </div>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.general())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#0284c7',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Consultar con asesores para habilitar el módulo ERP RRHH"
                >
                  <span>Acceso ERP RRHH →</span>
                </a>
              </div>

              {/* ── DISCLAIMER LEGAL ESTIMATIVO PROMINENTE ── */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  background: '#fffbeb',
                  borderRadius: '12px',
                  border: '2px solid #f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '13px', color: '#b45309', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <span>DECLARACIÓN ESTIMATIVA Y DESCARGO DE RESPONSABILIDAD (DISCLAIMER)</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '11.5px', lineHeight: '1.55', color: '#78350f' }}>
                  Esta liquidación es <strong>estrictamente estimativa, orientativa y referencial</strong>, calculada de manera automatizada a partir de los datos declarados y provistos unilateralmente por la parte interesada. <strong>No refleja necesariamente la realidad fáctica ni jurídica del caso concreto</strong> y puede experimentar variaciones sustanciales frente a legajos oficiales, libros de sueldos y jornales, recibos de pago firmados, registros del IPS o resoluciones administrativas del MTESS y los juzgados laborales.
                </p>
                <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '11px', color: '#92400e', lineHeight: '1.45', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>• <strong>Sin auditoría independiente:</strong> No se han compulsado documentalmente recibos, extractos ni planillas oficiales.</div>
                  <div>• <strong>Posibles variaciones:</strong> Pueden existir compensaciones, anticipos o diferencias en cómputos de promedios de horas extras y comisiones.</div>
                  <div>• <strong>Recomendación:</strong> Se aconseja validar estos importes con un profesional de Recursos Humanos o asesor legal antes de firmar finiquitos o realizar pagos.</div>
                </div>
              </div>

              {/* ── Asesoría Contextual Directa LaboraPy ── */}
              <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                  ¿Deseas validar técnicamente este finiquito?
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px', lineHeight: '1.45' }}>
                  Un profesional senior de Recursos Humanos de <strong>{LABORAPY_CONFIG.brandName}</strong> analiza tu caso y tus números para que tomes una decisión con seguridad antes de firmar o pagar.
                </p>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.calculoResultado(resultado.totalNetoEstimado))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                  style={{ minHeight: '44px', fontSize: '13px', padding: '10px 16px', background: '#25d366' }}
                >
                  <span>💬</span>
                  <span>Consultar con un Asesor por WhatsApp ({LABORAPY_CONFIG.whatsAppDisplay})</span>
                </a>
              </div>

              {/* Desglose Detallado Opcional */}
              <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowLegalBreakdown(!showLegalBreakdown)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: 0,
                  }}
                >
                  <span>{showLegalBreakdown ? '▲ Ocultar desglose legal' : '🔍 ¿Cómo se calculó? Ver desglose legal'}</span>
                </button>

                {showLegalBreakdown && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#475569' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      {resultado.conceptos.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: i % 2 === 0 ? '#fff' : '#f8fafc',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: c.esDescuento ? '#dc2626' : '#1e293b' }}>
                              {c.nombre}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {c.fuenteLegal}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: c.esDescuento ? '#dc2626' : '#047857' }}>
                            {c.esDescuento ? `- Gs. ${c.monto.toLocaleString('es-PY')}` : `Gs. ${c.monto.toLocaleString('es-PY')}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pasarela Comercial y Funnel de Leads para Descargas */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={(leadData) => {
          setIsLeadModalOpen(false);
          const empFinal = (leadData?.empresa || empresa || getLastLeadInfo()?.empresa || '').trim();
          const nomFinal = (leadData?.nombre || nombreEmpleado || getLastLeadInfo()?.nombre || '').trim();
          if (empFinal && !empresa) setEmpresa(empFinal);
          if (nomFinal && !nombreEmpleado) setNombreEmpleado(nomFinal);
          ejecutarDescargaPDF({ empresaOverride: empFinal, nombreOverride: nomFinal });
        }}
        documentTitle="Finiquito Oficial de Liquidación Laboral"
        documentFormat="pdf"
        montoNeto={resultado?.totalNetoEstimado}
        initialEmpresa={empresa}
        initialNombre={nombreEmpleado}
        initialMotivo={`Liquidación Laboral (${motivo.replace(/_/g, ' ')})`}
      />
    </div>
  );
};
