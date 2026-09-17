/**
 * CALCULADORA DE HORAS EXTRAS Y RECARGOS LEGALES — ERP LABORAPY
 * Ley N.º 213/93 Código del Trabajo de la República del Paraguay:
 * - Jornal = Salario / 30
 * - Hora = Jornal / 8
 * - Horas Extras Diurnas (50%): Lunes a Sábado en jornada diurna (Art. 234 inc. a)
 * - Horas Extras Domingos / Feriados (100%): Domingos, feriados y descansos (Art. 234 inc. b)
 * - Horas Extras Nocturnas (130%): Extraordinarias después de las 20:00 (Art. 234 inc. b + nocturno)
 * - Recargo Nocturno Ordinario (30%): Horas ordinarias trabajadas de 20:00 a 06:00 (Art. 234 inc. c)
 * - Feriado o Día Libre Trabajado: +1 Jornal íntegro
 * 
 * Modos:
 * 1. Carga Directa Manual & Biometría API (Predeterminada, rápida y editable)
 * 2. Asistente de Fichaje Día por Día (Opcional, con transferencia automática a inputs manuales)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Empleado, ReciboSalario } from '../types/clientPortal';
import {
  TURNOS_PREDEFINIDOS,
  ORDEN_DIAS_SEMANA,
  type DiaMarcacionInput,
  type SemanaOvertimeResult,
  calcularSemanaOvertime,
  calcularOvertimeManual,
  type OvertimeManualResult,
  formatearMinutosAHora,
  formatGs,
} from '../services/overtimeCalculationEngine';
import {
  getAjusteHorasExtrasEmpleado,
  saveAjusteHorasExtrasEmpleado,
  obtenerHorasSugeridasBiometrico,
} from '../services/attendanceService';
import {
  getRecibosByCliente,
  saveRecibosBatch,
  calcularReciboSalario,
} from '../services/clientStorageService';

export interface WeeklyOvertimeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  empleadoSeleccionado?: Empleado | null;
  empresaId?: string;
  empleadosDisponibles?: Empleado[];
  mes?: number;
  anho?: number;
  onAplicarANomina?: (resultado: OvertimeManualResult, empleadoId?: string) => void;
}

const DIAS_INICIALES: DiaMarcacionInput[] = ORDEN_DIAS_SEMANA.map((dia, idx) => ({
  dia,
  turnoId: idx >= 5 ? 'full' : 'manana',
  jornadaPactada: idx >= 5 ? '8:00' : '5:50',
  horaEntrada: '',
  horaSalida: '',
  descansoMinutos: 40,
  esFeriado: false,
  esDiaLibreTrabajado: false,
}));

export const WeeklyOvertimeCalculatorModal: React.FC<WeeklyOvertimeCalculatorModalProps> = ({
  isOpen,
  onClose,
  empleadoSeleccionado,
  empresaId,
  empleadosDisponibles = [],
  mes = new Date().getMonth() + 1,
  anho = new Date().getFullYear(),
  onAplicarANomina,
}) => {
  // Pestaña activa: 'directa' (default) o 'diario'
  const [activeTab, setActiveTab] = useState<'directa' | 'diario'>('directa');

  // Empleado seleccionado actual
  const [empActualId, setEmpActualId] = useState<string>(
    empleadoSeleccionado?.id || empleadosDisponibles[0]?.id || ''
  );

  const empleado = useMemo(() => {
    if (empleadoSeleccionado && empleadoSeleccionado.id === empActualId) {
      return empleadoSeleccionado;
    }
    return (
      empleadosDisponibles.find((e) => e.id === empActualId) ||
      empleadoSeleccionado ||
      null
    );
  }, [empleadoSeleccionado, empleadosDisponibles, empActualId]);

  const clienteIdEfectivo = empresaId || empleado?.clienteId || 'emp_guarani_001';

  // Salario Mensual editable (permite borrar el 0 sin trabarse)
  const [salarioMensualStr, setSalarioMensualStr] = useState<string>(() =>
    String(empleado?.salarioBase || 3044000)
  );

  // Inputs directos de horas (como strings para permitir borrar el 0 y teclear libremente decimales)
  const [horas50Str, setHoras50Str] = useState<string>('3.7');
  const [horas100Str, setHoras100Str] = useState<string>('5');
  const [horas130Str, setHoras130Str] = useState<string>('3');
  const [recargoNocturnoStr, setRecargoNocturnoStr] = useState<string>('0');
  const [feriadosTrabajadosStr, setFeriadosTrabajadosStr] = useState<string>('0');

  // Estado de origen de los datos y avisos
  const [fuenteDatos, setFuenteDatos] = useState<'manual' | 'biometrico_sincronizado'>('manual');
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'info' | 'error'; mensaje: string } | null>(null);

  // Estado para asistente día por día
  const [dias, setDias] = useState<DiaMarcacionInput[]>(DIAS_INICIALES);
  const [resultadoSemanal, setResultadoSemanal] = useState<SemanaOvertimeResult | null>(null);

  // Sincronizar cuando cambia el empleado seleccionado
  useEffect(() => {
    if (empleadoSeleccionado?.id) {
      setEmpActualId(empleadoSeleccionado.id);
    }
  }, [empleadoSeleccionado?.id]);

  // Cargar datos del empleado o ajustes guardados
  useEffect(() => {
    if (!isOpen) return;

    const sal = empleado?.salarioBase || 3044000;
    setSalarioMensualStr(String(sal));

    if (empleado?.id) {
      const ajusteGuardado = getAjusteHorasExtrasEmpleado(clienteIdEfectivo, empleado.id, mes, anho);
      if (ajusteGuardado) {
        setHoras50Str(String(ajusteGuardado.horas50));
        setHoras100Str(String(ajusteGuardado.horas100));
        setHoras130Str(String(ajusteGuardado.horas130));
        setRecargoNocturnoStr(String(ajusteGuardado.horasRecargoNocturno));
        setFeriadosTrabajadosStr(String(ajusteGuardado.feriadosTrabajados));
        setFuenteDatos(ajusteGuardado.fuente);
        setNotificacion({
          tipo: 'info',
          mensaje: 'Se cargaron las horas extras previamente guardadas para este período.',
        });
        return;
      }
    }

    // Por defecto, precargar el ejemplo rápido solicitado
    setHoras50Str('3.7');
    setHoras100Str('5');
    setHoras130Str('3');
    setRecargoNocturnoStr('0');
    setFeriadosTrabajadosStr('0');
    setFuenteDatos('manual');
    setNotificacion(null);
  }, [isOpen, empActualId, empleado?.salarioBase, clienteIdEfectivo, mes, anho]);

  // Helper para parsear números decimales sin fallos
  const parseDecimal = (val: string): number => {
    if (!val || val.trim() === '') return 0;
    const clean = val.replace(',', '.');
    const n = parseFloat(clean);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const salarioMensualNum = parseDecimal(salarioMensualStr);

  // Tarifas base oficiales según Ley 213/93
  const tarifasBase = useMemo(() => {
    const jornal = salarioMensualNum / 30;
    const hora = jornal / 8;
    return {
      jornal,
      hora,
      tarifa50: hora * 1.5,
      tarifa100: hora * 2.0,
      tarifa130: hora * 2.6,
      tarifaRecargo: hora * 0.3,
    };
  }, [salarioMensualNum]);

  // Cálculo en vivo del modo directo
  const calculoDirecto: OvertimeManualResult = useMemo(() => {
    return calcularOvertimeManual({
      salarioMensual: salarioMensualNum,
      horas50: parseDecimal(horas50Str),
      horas100: parseDecimal(horas100Str),
      horas130: parseDecimal(horas130Str),
      horasRecargoNocturno: parseDecimal(recargoNocturnoStr),
      feriadosTrabajados: parseDecimal(feriadosTrabajadosStr),
    });
  }, [
    salarioMensualNum,
    horas50Str,
    horas100Str,
    horas130Str,
    recargoNocturnoStr,
    feriadosTrabajadosStr,
  ]);

  // Acción: Estirar desde Marcador Biométrico (API / Reloj)
  const handleEstirarBiometrico = useCallback(() => {
    if (!empleado?.id) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Seleccioná un empleado para consultar sus marcaciones biométricas.',
      });
      return;
    }

    const sugerencia = obtenerHorasSugeridasBiometrico(clienteIdEfectivo, empleado.id, mes, anho);
    setHoras50Str(String(sugerencia.horas50));
    setHoras100Str(String(sugerencia.horas100));
    setHoras130Str(String(sugerencia.horas130));
    setRecargoNocturnoStr(String(sugerencia.horasRecargoNocturno));
    setFeriadosTrabajadosStr(String(sugerencia.feriadosTrabajados));
    setFuenteDatos('biometrico_sincronizado');

    if (sugerencia.fuente === 'marcador_api') {
      setNotificacion({
        tipo: 'success',
        mensaje: `✓ Horas estiradas exitosamente desde ${sugerencia.totalMarcaciones} marcaciones biométricas registradas. Los valores son 100% modificables por el usuario.`,
      });
    } else {
      setNotificacion({
        tipo: 'info',
        mensaje: '✓ Datos sugeridos desde el motor biométrico. Podés ajustar y modificar cada valor libremente.',
      });
    }
  }, [empleado?.id, clienteIdEfectivo, mes, anho]);

  // Acción: Cargar Ejemplo Rápido
  const handleCargarEjemploDirecto = () => {
    setHoras50Str('3.7');
    setHoras100Str('5');
    setHoras130Str('3');
    setRecargoNocturnoStr('2');
    setFeriadosTrabajadosStr('0');
    setFuenteDatos('manual');
    setNotificacion({
      tipo: 'info',
      mensaje: 'Ejemplo cargado: 50%: 3.7h | 100%: 5h | 130%: 3h | Rec. Noct: 2h.',
    });
  };

  // Acción: Limpiar a Cero
  const handleLimpiarDirecto = () => {
    setHoras50Str('');
    setHoras100Str('');
    setHoras130Str('');
    setRecargoNocturnoStr('');
    setFeriadosTrabajadosStr('');
    setFuenteDatos('manual');
    setNotificacion(null);
  };

  // Asistente día por día: Handlers
  const handleTurnoChange = (index: number, turnoId: string) => {
    const turno = TURNOS_PREDEFINIDOS.find((t) => t.id === turnoId);
    if (!turno) return;
    setDias((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        turnoId,
        jornadaPactada: turno.j,
      };
      return updated;
    });
  };

  const handleFieldChangeDia = (
    index: number,
    field: keyof DiaMarcacionInput,
    value: any
  ) => {
    setDias((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleCalcularSemana = () => {
    const res = calcularSemanaOvertime(salarioMensualNum, dias);
    setResultadoSemanal(res);
  };

  // Transferir desde Asistente Día por Día a Carga Directa
  const handleTransferirADirecto = () => {
    if (!resultadoSemanal) {
      handleCalcularSemana();
    }
    const res = resultadoSemanal || calcularSemanaOvertime(salarioMensualNum, dias);
    const h50 = Math.round((res.totales.totalHe50Minutos / 60) * 10) / 10;
    const h100 = Math.round((res.totales.totalHe100Minutos / 60) * 10) / 10;
    const h130 = Math.round((res.totales.totalHe130Minutos / 60) * 10) / 10;
    const recNoct = Math.round((res.totales.totalRecargoNocturnoMinutos / 60) * 10) / 10;
    const jExtra = res.totales.totalJornalesExtra;

    setHoras50Str(h50 > 0 ? String(h50) : '');
    setHoras100Str(h100 > 0 ? String(h100) : '');
    setHoras130Str(h130 > 0 ? String(h130) : '');
    setRecargoNocturnoStr(recNoct > 0 ? String(recNoct) : '');
    setFeriadosTrabajadosStr(jExtra > 0 ? String(jExtra) : '');
    setActiveTab('directa');
    setNotificacion({
      tipo: 'success',
      mensaje: '✓ Totales del fichaje transferidos a la carga manual. Podés editarlos o modificarlos libremente.',
    });
  };

  // Guardar y Aplicar a Nómina / Recibo
  const handleGuardarYAplicar = () => {
    if (!empleado?.id) {
      setNotificacion({
        tipo: 'error',
        mensaje: 'Seleccioná un empleado para registrar las horas extras.',
      });
      return;
    }

    // 1. Guardar ajuste en el servicio de presentismo
    saveAjusteHorasExtrasEmpleado({
      clienteId: clienteIdEfectivo,
      empleadoId: empleado.id,
      mes,
      anho,
      horas50: calculoDirecto.horas50,
      horas100: calculoDirecto.horas100,
      horas130: calculoDirecto.horas130,
      horasRecargoNocturno: calculoDirecto.horasRecargoNocturno,
      feriadosTrabajados: calculoDirecto.feriadosTrabajados,
      salarioMensual: salarioMensualNum,
      montoTotal: calculoDirecto.totalMontoGs,
      fuente: fuenteDatos,
      updatedAt: new Date().toISOString(),
    });

    // 2. Si existe recibo para el período, actualizarlo automáticamente
    try {
      const recibos = getRecibosByCliente(clienteIdEfectivo, mes, anho);
      const idx = recibos.findIndex((r) => r.empleadoId === empleado.id);
      if (idx >= 0) {
        const actual = recibos[idx];
        const recalculado: ReciboSalario = calcularReciboSalario(empleado, mes, anho, {
          diasTrabajados: actual.diasTrabajados,
          horasExtras50Cant: calculoDirecto.horas50,
          horasExtras100Cant: calculoDirecto.horas100,
          comisionesPremios: actual.comisionesPremios,
          anticiposQuincena: actual.anticiposQuincena,
          judicialesAlimentos: actual.judicialesAlimentos,
          otrosDescuentos: actual.otrosDescuentos,
          diasReposo: actual.diasReposo,
        });
        recibos[idx] = recalculado;
        saveRecibosBatch(recibos);
      }
    } catch (err) {
      console.warn('[WeeklyOvertimeCalculatorModal] No se pudo sincronizar recibo existente:', err);
    }

    // 3. Invocar callback de nómina
    onAplicarANomina?.(calculoDirecto, empleado.id);

    setNotificacion({
      tipo: 'success',
      mensaje: `¡Horas extras aplicadas con éxito! Total adicional: ${formatGs(calculoDirecto.totalMontoGs)} para ${empleado.nombres} ${empleado.apellidos}.`,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header Institucional */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shadow-md">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">🧮</span>
              <h2 className="text-lg font-bold tracking-tight">
                Calculadora de Horas Extras y Recargos Legales
              </h2>
              <span className="text-[11px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2.5 py-0.5 rounded-full font-semibold">
                Ley N.º 213/93 C.T. · Paraguay
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Carga manual directa por concepto (50%, 100%, 130%, Recargo Nocturno) o sincronización con marcador biométrico (API).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition text-lg"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Notificación Toast si existe */}
        {notificacion && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              notificacion.tipo === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : notificacion.tipo === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{notificacion.tipo === 'success' ? '✓' : notificacion.tipo === 'error' ? '⚠️' : 'ℹ️'}</span>
              <span>{notificacion.mensaje}</span>
            </div>
            <button
              onClick={() => setNotificacion(null)}
              className="text-slate-500 hover:text-slate-800 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de Empleado, Salario y Tarifas Base */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            {/* Selector de Empleado (si hay lista) o Información */}
            <div className="space-y-1 min-w-[260px] flex-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Empleado para Liquidación
              </label>
              {empleadosDisponibles.length > 0 ? (
                <select
                  value={empActualId}
                  onChange={(e) => setEmpActualId(e.target.value)}
                  className="w-full max-w-md px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {empleadosDisponibles.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombres} {emp.apellidos} — CI: {emp.ci} ({emp.cargo})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-3 py-2 rounded-lg inline-block">
                  {empleado
                    ? `${empleado.nombres} ${empleado.apellidos} (${empleado.cargo})`
                    : 'Cálculo Libre / Simulación'}
                </div>
              )}
            </div>

            {/* Salario Fijo Mensual Input (Permite borrar el 0) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Salario Mensual Base (Gs.)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={salarioMensualStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*$/.test(val)) {
                      setSalarioMensualStr(val);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-48 px-3 py-2 text-sm font-extrabold bg-white border border-slate-300 rounded-lg text-slate-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Badges de Tarifas Horarias Oficiales */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/80">
            <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-slate-500">Jornal (÷30)</span>
              <span className="font-bold text-slate-900">{formatGs(tarifasBase.jornal)}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-slate-500">Hora Normal (÷8)</span>
              <span className="font-bold text-slate-900">{formatGs(tarifasBase.hora)}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-amber-700">HE 50% (1.5x)</span>
              <span className="font-bold text-amber-900">{formatGs(tarifasBase.tarifa50)}</span>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-orange-700">HE 100% (2.0x)</span>
              <span className="font-bold text-orange-900">{formatGs(tarifasBase.tarifa100)}</span>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-purple-700">HE 130% Noct (2.6x)</span>
              <span className="font-bold text-purple-900">{formatGs(tarifasBase.tarifa130)}</span>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1 shadow-sm text-xs">
              <span className="block text-[9px] uppercase font-bold text-teal-700">Rec. Noct. 30% (0.3x)</span>
              <span className="font-bold text-teal-900">{formatGs(tarifasBase.tarifaRecargo)}</span>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('directa')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'directa'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-t-lg'
            }`}
          >
            <span>⚡ Carga Directa Manual & Biometría API</span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded font-extrabold">
              Recomendado
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diario')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'diario'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-t-lg'
            }`}
          >
            <span>📅 Asistente de Fichaje Día por Día</span>
          </button>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'directa' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Barra de Acciones y Automatización Biometría */}
              <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 border border-indigo-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📡</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Automatización con Reloj Biométrico (API)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Estirá las horas calculadas por el marcador. Podés modificarlas o afinarlas en cualquier momento.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleEstirarBiometrico}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
                    title="Estira las horas extras del reloj biométrico (ZKTeco, Hikvision o API)"
                  >
                    <span>📡</span> Estirar desde Marcador Biométrico (API)
                  </button>
                  <button
                    type="button"
                    onClick={handleCargarEjemploDirecto}
                    className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition"
                    title="Carga el ejemplo 50%: 3.7h, 100%: 5h, 130%: 3h"
                  >
                    💡 Cargar Ejemplo
                  </button>
                  <button
                    type="button"
                    onClick={handleLimpiarDirecto}
                    className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Grid de Inputs Directos (Las tarjetas solicitadas por el usuario) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tarjeta 1: HE 50% */}
                <div className="bg-amber-50/40 border-2 border-amber-200/80 hover:border-amber-400 rounded-xl p-4 transition space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                      <span>☀️</span> HE 50% (Diurna)
                    </span>
                    <span className="text-[10px] font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full">
                      1.5x Base
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-medium block mb-1">
                      Horas acumuladas (ej: 3.7)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={horas50Str}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                            setHoras50Str(val);
                            setFuenteDatos('manual');
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.0"
                        className="w-full px-3 py-2 text-lg font-bold bg-white border border-amber-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">hs</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Subtotal a pagar:</span>
                    <span className="font-extrabold text-amber-900">
                      {formatGs(calculoDirecto.montoHoras50)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Lunes a sábado en exceso de la jornada ordinaria diurna (Art. 234 inc. a).
                  </p>
                </div>

                {/* Tarjeta 2: HE 100% */}
                <div className="bg-orange-50/40 border-2 border-orange-200/80 hover:border-orange-400 rounded-xl p-4 transition space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-orange-800 tracking-wider flex items-center gap-1.5">
                      <span>🏖️</span> HE 100% (Domingo/Fer)
                    </span>
                    <span className="text-[10px] font-bold bg-orange-200/60 text-orange-900 px-2 py-0.5 rounded-full">
                      2.0x Base
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-medium block mb-1">
                      Horas acumuladas (ej: 5.0)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={horas100Str}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                            setHoras100Str(val);
                            setFuenteDatos('manual');
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.0"
                        className="w-full px-3 py-2 text-lg font-bold bg-white border border-orange-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">hs</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-orange-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Subtotal a pagar:</span>
                    <span className="font-extrabold text-orange-900">
                      {formatGs(calculoDirecto.montoHoras100)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Trabajadas en domingo, feriado nacional o día de descanso semanal (Art. 234 inc. b).
                  </p>
                </div>

                {/* Tarjeta 3: HE 130% */}
                <div className="bg-purple-50/40 border-2 border-purple-200/80 hover:border-purple-400 rounded-xl p-4 transition space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-purple-800 tracking-wider flex items-center gap-1.5">
                      <span>🌙</span> HE 130% (Nocturna)
                    </span>
                    <span className="text-[10px] font-bold bg-purple-200/60 text-purple-900 px-2 py-0.5 rounded-full">
                      2.6x Base
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-medium block mb-1">
                      Horas acumuladas (ej: 3.0)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={horas130Str}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                            setHoras130Str(val);
                            setFuenteDatos('manual');
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.0"
                        className="w-full px-3 py-2 text-lg font-bold bg-white border border-purple-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">hs</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Subtotal a pagar:</span>
                    <span className="font-extrabold text-purple-900">
                      {formatGs(calculoDirecto.montoHoras130)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Horas extraordinarias nocturnas cumplidas entre 20:00 y 06:00 (Art. 234 inc. b + recargo).
                  </p>
                </div>

                {/* Tarjeta 4: Recargo Nocturno 30% */}
                <div className="bg-teal-50/40 border-2 border-teal-200/80 hover:border-teal-400 rounded-xl p-4 transition space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-teal-800 tracking-wider flex items-center gap-1.5">
                      <span>🌃</span> Recargo Noct. 30%
                    </span>
                    <span className="text-[10px] font-bold bg-teal-200/60 text-teal-900 px-2 py-0.5 rounded-full">
                      +0.3x Base
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-medium block mb-1">
                      Horas ordinarias nocturnas
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={recargoNocturnoStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                            setRecargoNocturnoStr(val);
                            setFuenteDatos('manual');
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.0"
                        className="w-full px-3 py-2 text-lg font-bold bg-white border border-teal-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">hs</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Subtotal a pagar:</span>
                    <span className="font-extrabold text-teal-900">
                      {formatGs(calculoDirecto.montoRecargoNocturno)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Horas normales de turno nocturno cumplidas entre 20:00 y 06:00 (Art. 234 inc. c).
                  </p>
                </div>
              </div>

              {/* Panel de Resumen Financiero Total */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest block">
                    Resumen Total de Liquidación de Horas Extras
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-emerald-400">
                      {formatGs(calculoDirecto.totalMontoGs)}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      ({calculoDirecto.totalHorasExtras} horas extras totales)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Calculado con base en salario mensual de {formatGs(salarioMensualNum)} (Jornal: {formatGs(tarifasBase.jornal)} · Hora: {formatGs(tarifasBase.hora)}).
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGuardarYAplicar}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-extrabold text-sm shadow-lg shadow-emerald-900/40 transition transform active:scale-95 flex items-center gap-2"
                  >
                    <span>💾</span> Guardar y Aplicar a Nómina
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diario' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Tabla de Fichaje Día por Día */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Marcaciones Detalladas de la Semana
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Completá entrada y salida. El descanso se deduce de las horas netas.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCalcularSemana}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition"
                    >
                      ⚡ Calcular Semana
                    </button>
                    <button
                      type="button"
                      onClick={handleTransferirADirecto}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
                      title="Transfiere los subtotales a la pestaña de carga manual"
                    >
                      ➡️ Transferir a Carga Manual
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="p-2.5">Día</th>
                        <th className="p-2.5">Turno</th>
                        <th className="p-2.5">Jornada (h:mm)</th>
                        <th className="p-2.5">Entrada</th>
                        <th className="p-2.5">Salida</th>
                        <th className="p-2.5 text-center">Descanso (min)</th>
                        <th className="p-2.5">Ocasión Especial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dias.map((d, idx) => (
                        <tr key={d.dia} className="hover:bg-slate-50/80 transition">
                          <td className="p-2.5 font-bold text-slate-900">
                            {d.dia}
                            {idx === 6 && (
                              <span className="ml-1 text-[10px] text-orange-600 bg-orange-100 px-1 py-0.5 rounded font-normal">
                                Dom
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <select
                              value={d.turnoId || ''}
                              onChange={(e) => handleTurnoChange(idx, e.target.value)}
                              className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                            >
                              {TURNOS_PREDEFINIDOS.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={d.jornadaPactada}
                              onChange={(e) => handleFieldChangeDia(idx, 'jornadaPactada', e.target.value)}
                              placeholder="5:50"
                              className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-center font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="time"
                              value={d.horaEntrada}
                              onChange={(e) => handleFieldChangeDia(idx, 'horaEntrada', e.target.value)}
                              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="time"
                              value={d.horaSalida}
                              onChange={(e) => handleFieldChangeDia(idx, 'horaSalida', e.target.value)}
                              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              value={d.descansoMinutos}
                              onChange={(e) =>
                                handleFieldChangeDia(idx, 'descansoMinutos', Math.max(0, parseInt(e.target.value, 10) || 0))
                              }
                              step={5}
                              className="w-14 bg-white border border-slate-300 rounded px-2 py-1 text-center text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1 cursor-pointer text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={d.esFeriado}
                                  onChange={(e) => handleFieldChangeDia(idx, 'esFeriado', e.target.checked)}
                                  className="accent-indigo-600 rounded"
                                />
                                <span>Feriado</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={d.esDiaLibreTrabajado}
                                  onChange={(e) => handleFieldChangeDia(idx, 'esDiaLibreTrabajado', e.target.checked)}
                                  className="accent-indigo-600 rounded"
                                />
                                <span>Día libre trab.</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detalle si se calculó */}
              {resultadoSemanal && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-700">Totales Semanales Calculados</h4>
                    <span className="text-xs font-extrabold text-indigo-700">
                      {formatGs(resultadoSemanal.totales.totalMontoGs)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">HE 50%</span>
                      <span className="font-bold text-amber-800">
                        {formatearMinutosAHora(resultadoSemanal.totales.totalHe50Minutos)} hs
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">HE 100%</span>
                      <span className="font-bold text-orange-800">
                        {formatearMinutosAHora(resultadoSemanal.totales.totalHe100Minutos)} hs
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">HE 130% Noct</span>
                      <span className="font-bold text-purple-800">
                        {formatearMinutosAHora(resultadoSemanal.totales.totalHe130Minutos)} hs
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Recargo Nocturno</span>
                      <span className="font-bold text-teal-800">
                        {formatearMinutosAHora(resultadoSemanal.totales.totalRecargoNocturnoMinutos)} hs
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center gap-3">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            {fuenteDatos === 'biometrico_sincronizado'
              ? '📡 Datos vinculados con Marcador Biométrico (Editables libremente)'
              : '✏️ Carga manual directa activa'}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleGuardarYAplicar}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <span>💾</span> Guardar y Aplicar a Nómina
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
