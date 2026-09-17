/**
 * MODAL DE LIQUIDACIÓN RÁPIDA DE HABERES — CASOS MÁS COMUNES
 * Enfocado en:
 * 1. Despido Injustificado (Art. 91 C.T.)
 * 2. Abandono de Trabajo (Art. 81 inc. j C.T. - con validación de Telegramas Colacionados)
 * 3. Renuncia Voluntaria (Art. 87/90 C.T.)
 * Normativa: Ley N.º 213/93 (Código del Trabajo de Paraguay)
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { Empleado, EmpresaCliente } from '../types/clientPortal';
import type { LiquidacionInput, MotivoEgreso, ValidacionTelegramasAbandono } from '../../payroll/types';
import { calcularLiquidacion } from '../../payroll/liquidacion';
import { generarLiquidacionPDF } from '../../payroll/generators/settlementPdfGenerator';
import { formatPYG } from '../services/clientStorageService';
import { downloadTelegramPDF } from '../generators/telegramPdfGenerator';
import {
  exportMtessSettlements,
  type MtessSettlementEmployeeRecord,
} from '../../payroll/generators/mtessExportService';
import { CompactDatePicker } from '../../payroll/components/CompactDatePicker';
import { loadNovedadesEmpresa } from '../../monthlyPayroll/services/payrollNoveltiesStorage';
import {
  generarAsientoContableLiquidacionFinal,
  type NovedadDescontadaFiniquito,
} from '../../monthlyPayroll/engine/payrollAccountingEngine';
import {
  exportarAsientoOdooCSV,
  exportarAsientoSapCSV,
  exportarAsientoUniversalCSV,
  formatearAsientoParaClipboard,
  descargarArchivoContable,
} from '../../monthlyPayroll/services/payrollAccountingExportService';
import type { NovedadPersonal } from '../../monthlyPayroll/types/noveltyTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  empleado: Empleado | null;
  empresa: EmpresaCliente;
  onOpenFullSimulation?: (input: LiquidacionInput) => void;
}

export const QuickSettlementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  empleado,
  empresa,
  onOpenFullSimulation,
}) => {
  if (!isOpen || !empleado) return null;

  return (
    <QuickSettlementModalContent
      onClose={onClose}
      empleado={empleado}
      empresa={empresa}
      onOpenFullSimulation={onOpenFullSimulation}
    />
  );
};

interface QuickSettlementModalContentProps {
  onClose: () => void;
  empleado: Empleado;
  empresa: EmpresaCliente;
  onOpenFullSimulation?: (input: LiquidacionInput) => void;
}

const QuickSettlementModalContent: React.FC<QuickSettlementModalContentProps> = ({
  onClose,
  empleado,
  empresa,
  onOpenFullSimulation,
}) => {

  const todayStr = new Date().toISOString().split('T')[0];

  // Selección de caso común: 'despido_sin_causa' | 'abandono' | 'renuncia'
  const [motivo, setMotivo] = useState<MotivoEgreso>('despido_sin_causa');
  const [fechaEgreso, setFechaEgreso] = useState<string>(todayStr);

  // Parámetros de preaviso
  const [empleadorPreaviso, setEmpleadorPreaviso] = useState<boolean>(false);
  const [trabajadorPreaviso, setTrabajadorPreaviso] = useState<boolean>(true);

  // Validación de Abandono de Trabajo (Telegramas Colacionados Art. 81 inc. j)
  const [telegramaNro, setTelegramaNro] = useState<string>('TEL-COPACO-2026-');
  const [telegramaFecha, setTelegramaFecha] = useState<string>(todayStr);
  const [telegramaPlazoHoras, setTelegramaPlazoHoras] = useState<number>(48);
  const [telegramaNotificado, setTelegramaNotificado] = useState<boolean>(true);
  const [telegramaReintegro, setTelegramaReintegro] = useState<boolean>(false);

  // ── Novedades Salariales y Saldos Vivos (Embargos, Préstamos, Comisiones, etc.) ──
  const novedadesEmpleado = useMemo<NovedadPersonal[]>(() => {
    if (!empresa?.id || !empleado?.ci) return [];
    try {
      const todas = loadNovedadesEmpresa(empresa.id);
      return todas.filter((n) => n && n.activo && n.ci.trim() === empleado.ci.trim());
    } catch {
      return [];
    }
  }, [empresa?.id, empleado?.ci]);

  // Mapa de selección de descuentos de deudas vivas: novedadId -> { activo: boolean; montoADescontar: number }
  const [descuentosNovedades, setDescuentosNovedades] = useState<
    Record<string, { activo: boolean; montoADescontar: number }>
  >({});

  // Inicializar automáticamente cuando cargan las novedades: estirar saldo de todas las deudas activas
  useEffect(() => {
    if (novedadesEmpleado.length === 0) return;
    setDescuentosNovedades((prev) => {
      const nuevo: Record<string, { activo: boolean; montoADescontar: number }> = { ...prev };
      novedadesEmpleado.forEach((nov) => {
        const esHaber = nov.tipoConcepto === 'haber';
        if (!esHaber && nuevo[nov.id] === undefined) {
          const saldo =
            typeof nov.saldoPendiente === 'number' && nov.saldoPendiente > 0
              ? nov.saldoPendiente
              : (nov.montoOriginal ?? nov.cuotaMensual ?? 0);
          nuevo[nov.id] = {
            activo: saldo > 0,
            montoADescontar: saldo,
          };
        }
      });
      return nuevo;
    });
  }, [novedadesEmpleado]);

  // Novedades descontadas seleccionadas por el operador
  const novedadesDescontadasParaFiniquito: NovedadDescontadaFiniquito[] = useMemo(() => {
    return novedadesEmpleado
      .filter(
        (n) =>
          n.tipoConcepto !== 'haber' &&
          descuentosNovedades[n.id]?.activo &&
          (descuentosNovedades[n.id]?.montoADescontar || 0) > 0,
      )
      .map((n) => ({
        id: n.id,
        concepto: `${n.descripcion || 'Descuento'}${n.codigoVariable ? ` [${n.codigoVariable}]` : ''}`,
        monto: descuentosNovedades[n.id].montoADescontar,
        codigoVariable: n.codigoVariable,
        tipoNovedad: n.tipo || n.subtipo,
      }));
  }, [novedadesEmpleado, descuentosNovedades]);

  // Haberes pendientes en novedades (ej: comisiones COMISION/COMDOL, pluses de cargo)
  const haberesNovedades = useMemo(() => {
    return novedadesEmpleado.filter((n) => n.tipoConcepto === 'haber');
  }, [novedadesEmpleado]);

  const totalComisionesNovedades = useMemo(() => {
    return haberesNovedades
      .filter(
        (n) =>
          ['COMISION', 'COMDOL', 'VARICOMI'].includes((n.codigoVariable || '').toUpperCase()) ||
          n.subtipo === 'comision',
      )
      .reduce((acc, n) => acc + (n.cuotaMensual || n.montoOriginal || 0), 0);
  }, [haberesNovedades]);

  const totalOtrosHaberesNovedades = useMemo(() => {
    return haberesNovedades
      .filter(
        (n) =>
          !['COMISION', 'COMDOL', 'VARICOMI'].includes((n.codigoVariable || '').toUpperCase()) &&
          n.subtipo !== 'comision',
      )
      .reduce((acc, n) => acc + (n.cuotaMensual || n.montoOriginal || 0), 0);
  }, [haberesNovedades]);

  // Construir input para el motor de liquidación
  const inputLiquidacion: LiquidacionInput = useMemo(() => {
    const validacionAbandono: ValidacionTelegramasAbandono | undefined =
      motivo === 'abandono'
        ? {
            nroTelegramaIntimacion: telegramaNro,
            fechaEnvioTelegrama: telegramaFecha,
            plazoHorasOtorgado: telegramaPlazoHoras,
            notificadoEfectivo: telegramaNotificado,
            reintegroCumplido: telegramaReintegro,
          }
        : undefined;

    return {
      fechaIngreso: empleado.fechaIngreso,
      fechaEgreso,
      motivo,
      salarioMensual: empleado.salarioBase,
      tieneVariables: totalComisionesNovedades > 0,
      comisiones: totalComisionesNovedades > 0 ? totalComisionesNovedades : undefined,
      salariosPendientes: totalOtrosHaberesNovedades > 0 ? totalOtrosHaberesNovedades : undefined,
      nombreEmpleado: `${empleado.nombres} ${empleado.apellidos}`,
      ciEmpleado: empleado.ci,
      cargoEmpleado: empleado.cargo,
      empresa: empresa.razonSocial,
      hijosMenoresACargo: empleado.hijosMenores,
      hijosDiscapacidad: empleado.hijosDiscapacidad,
      parejaTrabajaEnMismaEmpresa: Boolean(empleado.parejaEmpleadoId),
      esMadreTitular: empleado.sexo === 'F',
      preaviso:
        motivo === 'despido_sin_causa'
          ? { obligado: 'empleador', otorgado: empleadorPreaviso }
          : motivo === 'renuncia'
          ? { obligado: 'trabajador', otorgado: trabajadorPreaviso }
          : undefined,
      descuentosAdicionales: novedadesDescontadasParaFiniquito.map((n) => ({
        concepto: n.concepto,
        monto: n.monto,
      })),
      validacionAbandono,
      regimenLaboral: 'general',
    };
  }, [
    empleado,
    empresa,
    motivo,
    fechaEgreso,
    empleadorPreaviso,
    trabajadorPreaviso,
    telegramaNro,
    telegramaFecha,
    telegramaPlazoHoras,
    telegramaNotificado,
    telegramaReintegro,
    novedadesDescontadasParaFiniquito,
    totalComisionesNovedades,
    totalOtrosHaberesNovedades,
  ]);

  // Cómputo del resultado legal en vivo
  const liquidacionResult = useMemo(() => {
    try {
      return calcularLiquidacion(inputLiquidacion);
    } catch {
      return null;
    }
  }, [inputLiquidacion]);

  // Asiento Contable Oficial balanceado (Partida Doble)
  const [mostrarAsiento, setMostrarAsiento] = useState(false);
  const [copiadoAsiento, setCopiadoAsiento] = useState(false);

  const asientoContable = useMemo(() => {
    if (!liquidacionResult) return null;
    return generarAsientoContableLiquidacionFinal(
      inputLiquidacion,
      liquidacionResult,
      novedadesDescontadasParaFiniquito,
      undefined,
      {
        id: empresa.id,
        nombre: empresa.razonSocial,
        ruc: empresa.ruc || '80000000-1',
      },
    );
  }, [inputLiquidacion, liquidacionResult, novedadesDescontadasParaFiniquito, empresa]);

  const handleCopiarAsiento = async () => {
    if (!asientoContable) return;
    const tsv = formatearAsientoParaClipboard(asientoContable);
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiadoAsiento(true);
      setTimeout(() => setCopiadoAsiento(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiadoAsiento(true);
      setTimeout(() => setCopiadoAsiento(false), 2500);
    }
  };

  const handleExportOdoo = () => {
    if (!asientoContable) return;
    const csv = exportarAsientoOdooCSV(asientoContable);
    descargarArchivoContable(csv, `asiento_finiquito_odoo_${empleado.ci}_${fechaEgreso}.csv`);
  };

  const handleExportSap = () => {
    if (!asientoContable) return;
    const csv = exportarAsientoSapCSV(asientoContable);
    descargarArchivoContable(csv, `asiento_finiquito_sap_${empleado.ci}_${fechaEgreso}.csv`);
  };

  const handleExportUniversal = () => {
    if (!asientoContable) return;
    const csv = exportarAsientoUniversalCSV(asientoContable);
    descargarArchivoContable(csv, `asiento_finiquito_${empleado.ci}_${fechaEgreso}.csv`);
  };

  const totalDeudasVivas = useMemo(() => {
    return novedadesEmpleado
      .filter((n) => n.tipoConcepto !== 'haber')
      .reduce((acc, n) => {
        const saldo =
          typeof n.saldoPendiente === 'number' && n.saldoPendiente > 0
            ? n.saldoPendiente
            : (n.montoOriginal ?? n.cuotaMensual ?? 0);
        return acc + saldo;
      }, 0);
  }, [novedadesEmpleado]);

  const handleSaldarTodasDeudas = () => {
    const nuevo: Record<string, { activo: boolean; montoADescontar: number }> = {};
    novedadesEmpleado.forEach((n) => {
      if (n.tipoConcepto !== 'haber') {
        const saldo =
          typeof n.saldoPendiente === 'number' && n.saldoPendiente > 0
            ? n.saldoPendiente
            : (n.montoOriginal ?? n.cuotaMensual ?? 0);
        nuevo[n.id] = { activo: true, montoADescontar: saldo };
      }
    });
    setDescuentosNovedades(nuevo);
  };

  const handleDesmarcarTodasDeudas = () => {
    const nuevo: Record<string, { activo: boolean; montoADescontar: number }> = {};
    novedadesEmpleado.forEach((n) => {
      if (n.tipoConcepto !== 'haber') {
        nuevo[n.id] = { activo: false, montoADescontar: 0 };
      }
    });
    setDescuentosNovedades(nuevo);
  };

  const handleDownloadPdf = () => {
    if (!liquidacionResult) return;
    const doc = generarLiquidacionPDF(inputLiquidacion, liquidacionResult);
    const fileName = `Finiquito_${motivo}_${empleado.ci.replace(/\D/g, '')}.pdf`;
    doc.save(fileName);
  };

  const handleExportMtessExcel = () => {
    if (!liquidacionResult || !empleado) return;
    try {
      const patronalDigits = (empresa.nroPatronalMtess || '').replace(/\D+/g, ' ').trim().split(/\s+/).filter(Boolean);
      const patronal = patronalDigits.length > 0 ? patronalDigits[patronalDigits.length - 1] : '38451';

      const conceptoMonto = (id: string) => liquidacionResult.conceptos.find(c => c.id === id)?.monto || 0;
      const salarioBasico =
        conceptoMonto('salario_dias') ||
        conceptoMonto('salario_base') ||
        conceptoMonto('salario_pendiente') ||
        (Number.isFinite(empleado.salarioBase) ? empleado.salarioBase : 0);
      const preaviso =
        conceptoMonto('preaviso') ||
        conceptoMonto('preaviso_sustitutivo') ||
        conceptoMonto('preaviso_sustitutivo_parcial') ||
        conceptoMonto('preaviso_retiro_justificado');
      const indemnizacion = conceptoMonto('indemnizacion');
      const vacacionesProp = conceptoMonto('vacaciones_proporcionales');
      const vacacionesCausadas =
        conceptoMonto('vacaciones_causadas') + conceptoMonto('vacaciones_periodos_anteriores');
      const aguinaldoProp =
        liquidacionResult.aguinaldoProporcional || conceptoMonto('aguinaldo_proporcional');
      const bonifFamiliar = conceptoMonto('bonificacion_familiar');
      const he50 = conceptoMonto('horas_extras_50');
      const he100 =
        conceptoMonto('horas_extras_100') ||
        conceptoMonto('horas_extras');

      const baseImponibleLiq =
        salarioBasico +
        he50 +
        he100 +
        preaviso +
        indemnizacion +
        vacacionesProp +
        vacacionesCausadas;

      const aporteSegSocial = Math.round(baseImponibleLiq * 0.09);

      const record: MtessSettlementEmployeeRecord = {
        numeroPatronalMtess: patronal,
        sucursalLabel: empleado.departamento,
        ci: empleado.ci.replace(/\D/g, '') || empleado.ci,
        fechaPago: fechaEgreso,
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 240,
        horasExtraordinarias: 0,
        salarioBasico,
        horasExtras50: he50,
        horasExtras100: he100,
        preaviso,
        indemnizacion,
        vacacionesProporcionales: vacacionesProp,
        vacacionesCausadas,
        aguinaldoProporcional: aguinaldoProp,
        bonificacionFamiliar: bonifFamiliar,
        otrasAsignaciones: [],
        aporteSegSocial,
        descuentos: [],
      };

      exportMtessSettlements([record]);
    } catch (err) {
      console.error('[MTESS Settlement Export Error]', err);
    }
  };

  const handleSimularCompleto = () => {
    if (onOpenFullSimulation) {
      onOpenFullSimulation(inputLiquidacion);
      onClose();
    }
  };

  const handleDownloadTelegrama = () => {
    if (!empleado) return;
    const hoy = new Date();
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const fechaTexto = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
    downloadTelegramPDF({
      companyName: empresa.razonSocial,
      companyAddress: empresa.direccion,
      companyPhone: empresa.telefono || '(021) 000 000',
      cityAndDate: `Asunción, ${fechaTexto}`,
      recipientName: `${empleado.nombres} ${empleado.apellidos}`,
      recipientDoc: empleado.ci,
      recipientAddress: empleado.domicilio || 'Domicilio constituido en legajo laboral',
      recipientPhone: empleado.telefono,
      deadlineHours: `${telegramaPlazoHoras} hs.`,
      absenceDaysText: 'en los días laborables previos sin previo aviso ni justificación fehaciente',
      laborCodeArticle: 'Art. 81 inc. j)',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
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
          maxWidth: '850px',
          maxHeight: '92vh',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '20px 24px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Liquidar Colaborador — Casos Laborales Comunes
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {empleado.nombres} {empleado.apellidos} · C.I. {empleado.ci} · {empleado.cargo} · Salario:{' '}
              <strong style={{ color: '#0f172a' }}>{formatPYG(empleado.salarioBase)}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Selector de los 3 casos más comunes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
              1. Seleccione la Causal de Egreso Laboral
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
              {/* Opción 1: Despido Injustificado */}
              <div
                onClick={() => setMotivo('despido_sin_causa')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${motivo === 'despido_sin_causa' ? '#dc2626' : '#e2e8f0'}`,
                  background: motivo === 'despido_sin_causa' ? '#fef2f2' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>🔴</span>
                  <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#991b1b' }}>
                    Despido Injustificado
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.35 }}>
                  Art. 91 C.T. · Indemnización por antigüedad + Preaviso omitido + Vacaciones + Aguinaldo.
                </div>
              </div>

              {/* Opción 2: Abandono de Trabajo */}
              <div
                onClick={() => setMotivo('abandono')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${motivo === 'abandono' ? '#d97706' : '#e2e8f0'}`,
                  background: motivo === 'abandono' ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#92400e' }}>
                    Abandono de Trabajo
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.35 }}>
                  Art. 81 inc. j C.T. · Justa causa imputable. <strong>Requiere validación de telegramas</strong>.
                </div>
              </div>

              {/* Opción 3: Renuncia Voluntaria */}
              <div
                onClick={() => setMotivo('renuncia')}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `2px solid ${motivo === 'renuncia' ? '#059669' : '#e2e8f0'}`,
                  background: motivo === 'renuncia' ? '#ecfdf5' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>🟢</span>
                  <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#065f46' }}>
                    Renuncia Voluntaria
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.35 }}>
                  Art. 87/90 C.T. · Término por voluntad del trabajador. Salarios + Vacaciones causadas + Aguinaldo.
                </div>
              </div>
            </div>
          </div>

          {/* Fecha de Egreso */}
          <div style={{ marginBottom: '18px', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <CompactDatePicker
                label="Fecha Efectiva de Egreso"
                value={fechaEgreso}
                onChange={setFechaEgreso}
                quickAction={{
                  label: 'Hoy',
                  onClick: () => setFechaEgreso(todayStr),
                }}
              />
            </div>

            {/* Ajustes específicos por causal */}
            {motivo === 'despido_sin_causa' && (
              <div style={{ flex: 1.5 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  ¿El Empleador otorgó el Preaviso en tiempo?
                </label>
                <select
                  value={empleadorPreaviso ? 'si' : 'no'}
                  onChange={e => setEmpleadorPreaviso(e.target.value === 'si')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  <option value="no">No otorgó preaviso (Se paga sustitutivo en dinero)</option>
                  <option value="si">Sí otorgó y trabajó el preaviso (Sin pago sustitutivo)</option>
                </select>
              </div>
            )}

            {motivo === 'renuncia' && (
              <div style={{ flex: 1.5 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  ¿El Trabajador avisó con la antelación legal?
                </label>
                <select
                  value={trabajadorPreaviso ? 'si' : 'no'}
                  onChange={e => setTrabajadorPreaviso(e.target.value === 'si')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  <option value="si">Sí dio preaviso en fecha (Sin descuento)</option>
                  <option value="no">No dio preaviso (Aplica descuento legal del 50% Art. 90)</option>
                </select>
              </div>
            )}
          </div>

          {/* Panel Especial de Validación de Abandono con Telegramas */}
          {motivo === 'abandono' && (
            <div
              style={{
                marginBottom: '20px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>📜</span>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                  Protocolo Legal de Telegrama Colacionado (Art. 81 inc. j C.T.)
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#78350f', marginBottom: '2px' }}>
                    N.º Telegrama Intimatorio
                  </label>
                  <input
                    type="text"
                    value={telegramaNro}
                    onChange={e => setTelegramaNro(e.target.value)}
                    placeholder="TEL-COPACO-12345"
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <CompactDatePicker
                    label="Fecha de Imposición / Envío"
                    value={telegramaFecha}
                    onChange={setTelegramaFecha}
                    quickAction={{
                      label: 'Hoy',
                      onClick: () => setTelegramaFecha(todayStr),
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#78350f', marginBottom: '2px' }}>
                    Plazo Concedido (Horas)
                  </label>
                  <select
                    value={telegramaPlazoHoras}
                    onChange={e => setTelegramaPlazoHoras(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '12px', boxSizing: 'border-box', background: '#ffffff' }}
                  >
                    <option value={48}>48 Horas hábiles (Estándar judicial)</option>
                    <option value={72}>72 Horas hábiles</option>
                    <option value={24}>24 Horas</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#78350f', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={telegramaNotificado}
                    onChange={e => setTelegramaNotificado(e.target.checked)}
                  />
                  <span>Constancia de Notificación Fechada y Recibida en Domicilio Real</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#78350f', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!telegramaReintegro}
                    onChange={e => setTelegramaReintegro(!e.target.checked)}
                  />
                  <span>Transcurso íntegro del plazo legal <strong>SIN reintegro</strong> a las funciones</span>
                </label>
              </div>

              {(!telegramaNotificado || telegramaReintegro || !telegramaNro.trim()) && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    fontSize: '11.5px',
                    fontWeight: 700,
                  }}
                >
                  ⚠️ ALERTA: Si no se acredita la notificación formal por telegrama colacionado y el vencimiento del plazo sin reintegro, el despido puede considerarse injustificado en juicio laboral.
                </div>
              )}

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleDownloadTelegrama}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d97706',
                    background: '#ffffff',
                    color: '#b45309',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>📜</span>
                  <span>Descargar Telegrama Intimatorio Oficial Copaco (PDF)</span>
                </button>
              </div>
            </div>
          )}

          {/* Sección 2: Novedades y Deudas Vivas del Colaborador (Compensación Automática) */}
          {novedadesEmpleado.length > 0 && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid #fed7aa',
                background: 'rgba(245, 158, 11, 0.12)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#9a3412',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>⚖️</span>
                    <span>2. Novedades y Deudas Vivas del Colaborador</span>
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#b45309' }}>
                    Saldos pendientes identificados (embargos, préstamos, compras internas, comisiones).
                  </p>
                </div>

                {/* Acciones Rápidas 1 Clic */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaldarTodasDeudas}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #f59e0b',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#92400e',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Pre-selecciona el saldo total de todas las deudas activas para cancelarlas con el finiquito"
                  >
                    <span>⚡</span>
                    <span>Saldar Todas las Deudas ({formatPYG(totalDeudasVivas)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDesmarcarTodasDeudas}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: '#64748b',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Desmarcar Todo
                  </button>
                </div>
              </div>

              {/* Lista de Deudas y Descuentos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {novedadesEmpleado
                  .filter((n) => n.tipoConcepto !== 'haber')
                  .map((nov) => {
                    const sel = descuentosNovedades[nov.id] || { activo: false, montoADescontar: 0 };
                    const saldoVivo =
                      typeof nov.saldoPendiente === 'number' && nov.saldoPendiente > 0
                        ? nov.saldoPendiente
                        : (nov.montoOriginal ?? nov.cuotaMensual ?? 0);
                    const esEmbargo =
                      nov.tipo === 'embargo_judicial' ||
                      nov.subtipo === 'embargo_comun' ||
                      (nov.codigoVariable || '').startsWith('EMB');
                    const esPrestamo =
                      nov.tipo === 'prestamo_empresa' ||
                      (nov.codigoVariable || '').startsWith('PRES');

                    return (
                      <div
                        key={nov.id}
                        style={{
                          background: sel.activo ? '#ffffff' : '#fefce8',
                          border: sel.activo ? '1.5px solid #f59e0b' : '1px solid #fef08a',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              color: '#0f172a',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={sel.activo}
                              onChange={(e) => {
                                const activo = e.target.checked;
                                setDescuentosNovedades((prev) => ({
                                  ...prev,
                                  [nov.id]: {
                                    activo,
                                    montoADescontar: activo ? (sel.montoADescontar || saldoVivo) : 0,
                                  },
                                }));
                              }}
                              style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                            />
                            <span>
                              {esEmbargo ? '⚖️ ' : esPrestamo ? '💳 ' : '📉 '}
                              {nov.descripcion || nov.subtipo || 'Deuda / Retención'}
                            </span>
                          </label>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {nov.codigoVariable && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontFamily: 'monospace',
                                  background: '#f8fafc',
                                  color: '#64748b',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {nov.codigoVariable}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '11px',
                                color: esEmbargo ? '#b91c1c' : '#0369a1',
                                background: esEmbargo ? '#fee2e2' : '#e0f2fe',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {esEmbargo
                                ? 'Embargo Judicial'
                                : esPrestamo
                                ? 'Préstamo Empresa'
                                : 'Deducción'}
                            </span>
                          </div>
                        </div>

                        {/* Indicadores de Saldos y Monto a Descontar */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            paddingTop: '4px',
                            fontSize: '11.5px',
                          }}
                        >
                          <div style={{ color: '#64748b' }}>
                            <span>Saldo pendiente vivo: </span>
                            <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                              {formatPYG(saldoVivo)}
                            </strong>
                            {nov.montoOriginal && nov.montoOriginal !== saldoVivo && (
                              <span style={{ color: '#64748b', marginLeft: '4px' }}>
                                (Original: {formatPYG(nov.montoOriginal)})
                              </span>
                            )}
                            {nov.expedienteJudicial && (
                              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                Causa: {nov.expedienteJudicial}
                              </div>
                            )}
                          </div>

                          {sel.activo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                A descontar en finiquito (Gs.):
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={saldoVivo > 0 ? saldoVivo * 2 : 100000000}
                                value={sel.montoADescontar || ''}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setDescuentosNovedades((prev) => ({
                                    ...prev,
                                    [nov.id]: {
                                      activo: true,
                                      montoADescontar: val,
                                    },
                                  }));
                                }}
                                style={{
                                  width: '120px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Resumen de Haberes Pendientes en Novedades si existen */}
                {(totalComisionesNovedades > 0 || totalOtrosHaberesNovedades > 0) && (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '11.5px',
                      color: '#065f46',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <span>
                      ✨ <strong>Haberes pendientes computados:</strong>{' '}
                      {totalComisionesNovedades > 0 &&
                        `Comisiones: ${formatPYG(totalComisionesNovedades)} `}
                      {totalOtrosHaberesNovedades > 0 &&
                        `Otros haberes: ${formatPYG(totalOtrosHaberesNovedades)}`}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#047857' }}>
                      (Sumados automáticamente a la base imponible)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sección 3: Resumen del Cómputo Legal */}
          {liquidacionResult && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                  }}
                >
                  3. Liquidación Final Estimada
                </h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Antigüedad: {liquidacionResult.antiguedad.years}a {liquidacionResult.antiguedad.months}m {liquidacionResult.antiguedad.days}d
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {liquidacionResult.conceptos.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12.5px',
                      color: c.esDescuento ? '#dc2626' : '#334155',
                      padding: '4px 0',
                      borderBottom: '1px dashed #e2e8f0',
                    }}
                  >
                    <span>
                      {c.esDescuento ? '(-) ' : '(+) '}
                      {c.nombre}
                    </span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {c.esDescuento ? `-${formatPYG(c.monto)}` : formatPYG(c.monto)}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Total Neto */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>
                    Total Neto a Percibir
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {liquidacionResult.montoEnLetras}
                  </div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7' }}>
                  {formatPYG(liquidacionResult.totalNetoEstimado)}
                </div>
              </div>
            </div>
          )}

          {/* Sección 4: Asiento Contable de Egreso (Partida Doble Oficial) */}
          {asientoContable && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                padding: '14px 16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setMostrarAsiento(!mostrarAsiento)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#0f172a',
                        textTransform: 'uppercase',
                      }}
                    >
                      4. Asiento Contable de Egreso (Partida Doble)
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {mostrarAsiento ? '▲ Ocultar desglose de cuentas' : '▼ Clic para ver partida doble balanceada'}
                    </span>
                  </div>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: asientoContable.estaCuadrado ? '#dcfce7' : '#fee2e2',
                      color: asientoContable.estaCuadrado ? '#166534' : '#991b1b',
                    }}
                  >
                    {asientoContable.estaCuadrado ? '✅ Cuadrado (Dif Gs. 0)' : '⚠️ Descuadrado'}
                  </span>
                </div>
              </div>

              {mostrarAsiento && (
                <div style={{ marginTop: '12px' }}>
                  {/* Botones de Exportación Contable */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginBottom: '12px',
                      padding: '8px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCopiarAsiento}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: copiadoAsiento ? '#166534' : '#0f172a',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{copiadoAsiento ? '✅' : '📋'}</span>
                      <span>{copiadoAsiento ? '¡Copiado a Portapapeles!' : 'Copiar para Excel (TSV)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportOdoo}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #818cf8',
                        background: '#eef2ff',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#4338ca',
                        cursor: 'pointer',
                      }}
                    >
                      📥 Odoo CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSap}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #38bdf8',
                        background: '#f0f9ff',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0369a1',
                        cursor: 'pointer',
                      }}
                    >
                      📥 SAP Business One CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportUniversal}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      📥 Universal CSV
                    </button>
                  </div>

                  {/* Tabla del Asiento Contable (con scroll horizontal en móviles) */}
                  <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ background: '#ffffff', color: '#0f172a', textAlign: 'left' }}>
                          <th style={{ padding: '7px 10px', width: '35px' }}>#</th>
                          <th style={{ padding: '7px 10px', width: '90px' }}>Cuenta</th>
                          <th style={{ padding: '7px 10px' }}>Denominación</th>
                          <th style={{ padding: '7px 10px' }}>Concepto</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', width: '95px' }}>Debe</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', width: '95px' }}>Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asientoContable.lineas.map((linea, idx) => (
                          <tr
                            key={linea.numeroLinea || idx}
                            style={{
                              background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                          >
                            <td style={{ padding: '6px 10px', color: '#64748b', fontFamily: 'monospace' }}>
                              {linea.numeroLinea}
                            </td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#64748b' }}>
                              {linea.codigoCuenta}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#0f172a', fontWeight: 600 }}>
                              {linea.nombreCuenta}
                            </td>
                            <td style={{ padding: '6px 10px', color: '#64748b' }}>
                              {linea.concepto}
                            </td>
                            <td
                              style={{
                                padding: '6px 10px',
                                textAlign: 'right',
                                fontFamily: 'monospace',
                                fontWeight: linea.debe > 0 ? 700 : 400,
                                color: linea.debe > 0 ? '#0f172a' : '#cbd5e1',
                              }}
                            >
                              {linea.debe > 0 ? formatPYG(linea.debe) : '-'}
                            </td>
                            <td
                              style={{
                                padding: '6px 10px',
                                textAlign: 'right',
                                fontFamily: 'monospace',
                                fontWeight: linea.haber > 0 ? 700 : 400,
                                color: linea.haber > 0 ? '#0f172a' : '#cbd5e1',
                              }}
                            >
                              {linea.haber > 0 ? formatPYG(linea.haber) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                          <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', textTransform: 'uppercase' }}>
                            Sumas Iguales
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                            }}
                          >
                            {formatPYG(asientoContable.totalDebe)}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                            }}
                          >
                            {formatPYG(asientoContable.totalHaber)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div
          style={{
            padding: '16px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={handleSimularCompleto}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔍 Abrir en Simulador Completo
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>

            <button
              onClick={handleExportMtessExcel}
              disabled={!liquidacionResult}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: liquidacionResult ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)',
              }}
              title="Descargar Planilla Oficial de Liquidaciones MTESS (27 columnas .xlsx)"
            >
              <span>📗</span>
              <span>Planilla MTESS (.xlsx)</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={!liquidacionResult}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#ffffff',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: liquidacionResult ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            >
              <span>📜</span>
              <span>Descargar Finiquito Oficial (PDF con QR)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
