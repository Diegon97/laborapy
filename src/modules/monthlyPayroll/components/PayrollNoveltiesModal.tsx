/**
 * MODAL DE GESTIÓN DE NOVEDADES RECURRENTES Y COLA DE EMBARGOS (LABORAPY)
 *
 * Permite cargar, editar, visualizar amortizaciones y dar de baja:
 * - Embargos Judiciales con tope legal (25%) y seguimiento de saldo
 * - Anticipos mensuales recurrentes (se arrastran automáticamente)
 * - Préstamos de empresa con cuotas y amortización decreciente
 * - Deducciones fijas (seguros, notebooks/celulares, mutuales, compras mercaderías)
 * - Haberes recurrentes, Comisiones y Horas Extras vinculadas al catálogo oficial
 * - Sincronización obligatoria y bidireccional entre Variable Oficial y Concepto Contable
 * - Trazabilidad inmutable de auditoría y regla de pisado cronológico
 *
 * Diseño 100% responsive certificado para Web Desktop y Móviles (360px-430px).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { EmpleadoNominaInput } from '../types';
import type {
  NovedadPersonal,
  TipoNovedad,
  SubtipoNovedad,
  ModalidadCalculoNovedad,
  TipoVigenciaNovedad,
  CodigoLiquidacionImpacto,
} from '../types/noveltyTypes';
import { formatGuaranies, roundGs } from '../engine/monthlyPayrollEngine';
import {
  DICCIONARIO_VARIABLES_DEFINIBLES,
  CATALOGO_CONCEPTOS_OFICIALES,
  findVariableByCodigo,
  findConceptoByNumero,
  findConceptoByVariable,
} from '../types/payrollConceptsCatalog';
import {
  loadNovedadesEmpresa,
  upsertNovedadConPisado,
  deleteNovedad,
} from '../services/payrollNoveltiesStorage';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';

export interface PayrollNoveltiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
  empleados: EmpleadoNominaInput[];
  onNovedadesActualizadas?: () => void;
  initialCi?: string;
  periodoId?: string; // Ej: '2026-09'
}

type TabFiltro =
  | 'todos'
  | 'haberes'
  | 'descuentos'
  | 'embargo_judicial'
  | 'anticipo_recurrente'
  | 'prestamo_empresa';

export const PayrollNoveltiesModal: React.FC<PayrollNoveltiesModalProps> = ({
  isOpen,
  onClose,
  empresaId,
  empleados,
  onNovedadesActualizadas,
  initialCi,
  periodoId,
}) => {
  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const periodoVigente = periodoId || mesActualStr;

  const [tabActiva, setTabActiva] = useState<TabFiltro>('todos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<string | null>(null);
  const [filtroCi, setFiltroCi] = useState('');
  const [soloPeriodoActivo, setSoloPeriodoActivo] = useState<boolean>(true);
  const [historialAbiertoId, setHistorialAbiertoId] = useState<string | null>(null);

  const formularioRef = useRef<HTMLFormElement | null>(null);

  // Form state - LIMPIO / EN BLANCO POR DEFECTO
  const [ciSeleccionado, setCiSeleccionado] = useState(initialCi || '');
  const [tipoConcepto, setTipoConcepto] = useState<'haber' | 'descuento'>('haber');
  const [subtipo, setSubtipo] = useState<SubtipoNovedad>('adicional_cargo');
  const [modalidadCalculo, setModalidadCalculo] = useState<ModalidadCalculoNovedad>('monto_fijo');
  const [porcentajeVariable, setPorcentajeVariable] = useState<string>('');
  const [montoOriginal, setMontoOriginal] = useState<string>('');
  const [saldoPendiente, setSaldoPendiente] = useState<string>('');
  const [cuotaMensual, setCuotaMensual] = useState<string>('');
  const [tipoVigencia, setTipoVigencia] = useState<TipoVigenciaNovedad>('permanente');
  const [mesUnico, setMesUnico] = useState<string>(periodoVigente);
  const [periodoDesde, setPeriodoDesde] = useState<string>(periodoVigente);
  const [periodoHasta, setPeriodoHasta] = useState<string>('');
  const [liquidacionesImpactadas, setLiquidacionesImpactadas] = useState<CodigoLiquidacionImpacto[]>([
    'MEN',
  ]);
  const [codigoVariable, setCodigoVariable] = useState<string>('');
  const [numeroConcepto, setNumeroConcepto] = useState<number | undefined>(undefined);
  const [nombreConcepto, setNombreConcepto] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [expedienteJudicial, setExpedienteJudicial] = useState('');
  const [prioridad] = useState<string>('1');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Filtro de variables disponibles por naturaleza (incluye Comisiones, Horas Extras, Faltantes, etc.)
  const variablesDisponiblesPorNaturaleza = useMemo(() => {
    return Object.values(DICCIONARIO_VARIABLES_DEFINIBLES).filter((vDef) => {
      if (tipoConcepto === 'haber') {
        return vDef.categoria === 'haber';
      }
      return (
        vDef.categoria === 'descuento' ||
        vDef.categoria === 'porcentaje' ||
        vDef.codigo.startsWith('EMB') ||
        vDef.codigo.startsWith('DESC') ||
        vDef.codigo.startsWith('FAL')
      );
    });
  }, [tipoConcepto]);

  // Conceptos oficiales de nómina filtrados por naturaleza
  const conceptosOficialesDisponibles = useMemo(() => {
    return CATALOGO_CONCEPTOS_OFICIALES.filter((c) => {
      if (tipoConcepto === 'haber') {
        return c.tipo === 'HABER' || c.tipo === 'SALARIO_FAMILIAR';
      }
      return c.tipo === 'RETENCION' || c.tipo === 'APORTE' || c.tipo === 'CONTRIBUCION';
    });
  }, [tipoConcepto]);

  // Preselección si viene initialCi
  useEffect(() => {
    if (initialCi) {
      setCiSeleccionado(initialCi);
      setMostrarFormulario(true);
    }
  }, [initialCi, isOpen]);

  // Resetea el formulario totalmente en blanco
  const resetFormulario = () => {
    setModoEdicionId(null);
    setCiSeleccionado(initialCi || '');
    setTipoConcepto('haber');
    setSubtipo('adicional_cargo');
    setCodigoVariable('');
    setNumeroConcepto(undefined);
    setNombreConcepto('');
    setModalidadCalculo('monto_fijo');
    setPorcentajeVariable('');
    setMontoOriginal('');
    setSaldoPendiente('');
    setCuotaMensual('');
    setTipoVigencia('permanente');
    setMesUnico(periodoVigente);
    setPeriodoDesde(periodoVigente);
    setPeriodoHasta('');
    setLiquidacionesImpactadas(['MEN']);
    setDescripcion('');
    setExpedienteJudicial('');
    setErrorValidacion(null);
  };

  // Carga de novedades desde storage
  const novedades = useMemo(() => {
    if (!isOpen) return [];
    return loadNovedadesEmpresa(empresaId);
  }, [isOpen, empresaId, mostrarFormulario]);

  if (!isOpen) return null;

  // Lógica de si una novedad aplica al período seleccionado
  const aplicaAlPeriodo = (nov: NovedadPersonal, targetPeriodo: string): boolean => {
    if (nov.tipoVigencia === 'mes_unico') {
      return (nov.mesUnico || nov.periodoDesde) === targetPeriodo;
    }
    if (nov.tipoVigencia === 'rango_meses' || nov.regimenVigencia === 'definido') {
      if (nov.periodoDesde && nov.periodoDesde > targetPeriodo) return false;
      if (nov.periodoHasta && nov.periodoHasta < targetPeriodo) return false;
      return true;
    }
    if (nov.tipoVigencia === 'hasta_saldo_cero') {
      const saldo = typeof nov.saldoPendiente === 'number' ? nov.saldoPendiente : (nov.montoOriginal ?? 0);
      return saldo > 0;
    }
    // Permanente
    if (nov.periodoDesde && nov.periodoDesde > targetPeriodo) return false;
    if (nov.periodoHasta && nov.periodoHasta < targetPeriodo) return false;
    return true;
  };

  // Filtrado de novedades
  const novedadesFiltradas = novedades.filter((nov) => {
    if (soloPeriodoActivo && periodoVigente) {
      if (!aplicaAlPeriodo(nov, periodoVigente)) return false;
    }

    if (tabActiva === 'haberes') {
      const esHaber =
        nov.tipoConcepto === 'haber' ||
        ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(nov.tipo);
      if (!esHaber) return false;
    } else if (tabActiva === 'descuentos') {
      const esHaber =
        nov.tipoConcepto === 'haber' ||
        ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(nov.tipo);
      if (esHaber) return false;
    } else if (tabActiva !== 'todos' && nov.tipo !== tabActiva) {
      return false;
    }
    if (filtroCi && !nov.ci.toLowerCase().includes(filtroCi.toLowerCase())) return false;
    return true;
  });

  const getNombreEmpleado = (ci: string): string => {
    const emp = empleados.find((e) => e.ci === ci);
    return emp ? emp.nombre : `CI: ${ci}`;
  };

  const toggleLiquidacion = (codigo: CodigoLiquidacionImpacto) => {
    setLiquidacionesImpactadas((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo],
    );
  };

  // Opciones para SearchableSelect de Funcionario
  const opcionesFuncionarios: SearchableSelectOption[] = empleados.map((emp) => ({
    value: emp.ci,
    label: emp.nombre,
    sublabel: `CI: ${emp.ci} — ${emp.cargo || 'Funcionario'}`,
    keywords: `${emp.ci} ${emp.nombre} ${emp.cargo || ''}`,
  }));

  // Opciones para SearchableSelect de Variable Oficial (con Comisiones, Horas Extras, etc.)
  const opcionesVariables: SearchableSelectOption[] = variablesDisponiblesPorNaturaleza.map((vDef) => ({
    value: vDef.codigo,
    label: `[${vDef.codigo}] ${vDef.descripcion}`,
    sublabel: `Concepto N° ${vDef.conceptoRelacionadoNumero ?? 'Asignado'} · ${vDef.moneda} · Impacta: ${vDef.liquidacionesImpactadas.join('/')}`,
    badge: vDef.moneda,
    badgeColor: vDef.moneda === 'USD' ? '#d1fae5' : undefined,
    keywords: `${vDef.codigo} ${vDef.descripcion} ${vDef.categoria} ${vDef.moneda} ${vDef.liquidacionesImpactadas.join(' ')}`,
  }));

  // Opciones para SearchableSelect de Concepto Contable / Nómina Oficial
  const opcionesConceptosOficiales: SearchableSelectOption[] = conceptosOficialesDisponibles.map((c) => ({
    value: String(c.numero),
    label: `[N° ${c.numero}] ${c.nombre}`,
    sublabel: `Variable: [${c.codigoVariable}] · Impacta: ${c.liquidacionesImpactadas.join('/')} · Debe: ${c.cuentaDebeML}`,
    badge: `N° ${c.numero}`,
    keywords: `${c.numero} ${c.nombre} ${c.codigoVariable} ${c.liquidacionesImpactadas.join(' ')}`,
  }));

  // Sincronización cuando se selecciona una Variable Oficial -> Estira Concepto Oficial
  const handleSeleccionarVariable = (cod: string) => {
    setCodigoVariable(cod);
    if (!cod) {
      setNumeroConcepto(undefined);
      setNombreConcepto('');
      return;
    }

    const vDef = findVariableByCodigo(cod);
    if (vDef) {
      if (vDef.categoria === 'haber') setTipoConcepto('haber');
      else if (vDef.categoria === 'descuento') setTipoConcepto('descuento');

      // Buscar concepto oficial correspondiente
      const conc =
        (vDef.conceptoRelacionadoNumero ? findConceptoByNumero(vDef.conceptoRelacionadoNumero) : undefined) ||
        findConceptoByVariable(cod);

      if (conc) {
        setNumeroConcepto(conc.numero);
        setNombreConcepto(conc.nombre);
        if (!descripcion.trim() || descripcion === 'Bonificación Extraordinaria' || descripcion === 'Embargo Judicial 25%') {
          setDescripcion(conc.nombre);
        }
      } else {
        setNumeroConcepto(vDef.conceptoRelacionadoNumero);
        setNombreConcepto(vDef.descripcion);
        if (!descripcion.trim()) {
          setDescripcion(vDef.descripcion);
        }
      }

      // Mapeo contextual del subtipo
      const codUpper = cod.toUpperCase();
      if (['COMISION', 'COMDOL', 'VARICOMI'].includes(codUpper)) {
        setSubtipo('haber_manual');
      } else if (['H50', 'H100', 'H130', 'HRN', 'SALNOC', 'HORAEXTRA'].includes(codUpper)) {
        setSubtipo('adicional_cargo');
      } else if (['EMB_MES', 'EMB_MAN', 'EMB_CDOL', 'EMB_COGS', 'EMBARGOS'].includes(codUpper)) {
        setSubtipo('embargo_judicial');
        setModalidadCalculo('porcentaje_variable');
        if (!porcentajeVariable) setPorcentajeVariable('25');
      } else if (['DESC_ANT', 'ANDOL', 'ANDOLMEN', 'ANTICIPOVA'].includes(codUpper)) {
        setSubtipo('anticipo_salario');
      } else if (['PRES_EMP_GS', 'PRES_EMP_USD', 'PRES_COMI_USD', 'PRES_SOL'].includes(codUpper)) {
        setSubtipo('prestamo_empresa');
      } else if (['ASISMED', 'IMPPLAN'].includes(codUpper)) {
        setSubtipo('seguro_medico');
      }

      // Sincronizar liquidaciones impactadas
      if (vDef.liquidacionesImpactadas && vDef.liquidacionesImpactadas.length > 0) {
        const validLiqs: CodigoLiquidacionImpacto[] = [];
        for (const l of vDef.liquidacionesImpactadas) {
          if (l === 'MEN' || l === 'COM' || l === 'AGU' || l === 'FIN') {
            validLiqs.push(l);
          }
        }
        if (validLiqs.length > 0) setLiquidacionesImpactadas(validLiqs);
      }
    }
  };

  // Sincronización cuando se selecciona un Concepto Oficial -> Estira Variable Oficial
  const handleSeleccionarConcepto = (numStr: string) => {
    const num = Number(numStr);
    if (!num) {
      setNumeroConcepto(undefined);
      setNombreConcepto('');
      return;
    }

    const conc = findConceptoByNumero(num);
    if (conc) {
      setNumeroConcepto(conc.numero);
      setNombreConcepto(conc.nombre);
      if (!descripcion.trim() || descripcion === 'Bonificación Extraordinaria' || descripcion === 'Embargo Judicial 25%') {
        setDescripcion(conc.nombre);
      }

      // Estirar variable si existe en el concepto
      if (conc.codigoVariable) {
        setCodigoVariable(conc.codigoVariable);
        const vDef = findVariableByCodigo(conc.codigoVariable);
        if (vDef) {
          if (vDef.categoria === 'haber') setTipoConcepto('haber');
          else if (vDef.categoria === 'descuento') setTipoConcepto('descuento');
        }
      }

      // Sincronizar liquidaciones impactadas
      if (conc.liquidacionesImpactadas && conc.liquidacionesImpactadas.length > 0) {
        const validLiqs: CodigoLiquidacionImpacto[] = [];
        for (const l of conc.liquidacionesImpactadas) {
          if (l === 'MEN' || l === 'COM' || l === 'AGU' || l === 'FIN') {
            validLiqs.push(l);
          }
        }
        if (validLiqs.length > 0) setLiquidacionesImpactadas(validLiqs);
      }
    }
  };

  // Cambio de naturaleza (Haber / Descuento)
  const handleCambioNaturaleza = (nuevaNaturaleza: 'haber' | 'descuento') => {
    setTipoConcepto(nuevaNaturaleza);
    setCodigoVariable('');
    setNumeroConcepto(undefined);
    setNombreConcepto('');
    if (nuevaNaturaleza === 'haber') {
      setSubtipo('adicional_cargo');
      setModalidadCalculo('monto_fijo');
      setTipoVigencia('permanente');
      setLiquidacionesImpactadas(['MEN']);
      setDescripcion('');
      setMontoOriginal('');
      setSaldoPendiente('');
      setCuotaMensual('');
      setPorcentajeVariable('');
    } else {
      setSubtipo('embargo_judicial');
      setModalidadCalculo('monto_fijo');
      setPorcentajeVariable('');
      setTipoVigencia('hasta_saldo_cero');
      setLiquidacionesImpactadas(['MEN']);
      setDescripcion('');
      setMontoOriginal('');
      setSaldoPendiente('');
      setCuotaMensual('');
    }
  };

  // Abrir para crear nueva novedad
  const handleAbrirNuevaNovedad = () => {
    if (mostrarFormulario && !modoEdicionId) {
      setMostrarFormulario(false);
    } else {
      resetFormulario();
      setMostrarFormulario(true);
      setTimeout(() => {
        formularioRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  // Abrir para editar una novedad existente
  const handleEditarNovedad = (nov: NovedadPersonal) => {
    setModoEdicionId(nov.id);
    setCiSeleccionado(nov.ci);
    const esHaber =
      nov.tipoConcepto === 'haber' ||
      ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(nov.tipo);
    setTipoConcepto(esHaber ? 'haber' : 'descuento');
    setSubtipo((nov.subtipo as SubtipoNovedad) || (esHaber ? 'adicional_cargo' : 'descuento_manual'));
    setCodigoVariable(nov.codigoVariable || '');
    setNumeroConcepto(nov.numeroConcepto);
    setNombreConcepto(nov.nombreConcepto || '');
    setModalidadCalculo(nov.modalidadCalculo || (nov.porcentajeVariable ? 'porcentaje_variable' : 'monto_fijo'));
    setPorcentajeVariable(nov.porcentajeVariable ? String(nov.porcentajeVariable) : '');
    setMontoOriginal(nov.montoOriginal ? String(nov.montoOriginal) : '');
    setSaldoPendiente(nov.saldoPendiente ? String(nov.saldoPendiente) : '');
    setCuotaMensual(nov.cuotaMensual ? String(nov.cuotaMensual) : '');
    setTipoVigencia(nov.tipoVigencia || (nov.regimenVigencia === 'definido' ? 'rango_meses' : 'permanente'));
    setMesUnico(nov.mesUnico || nov.periodoDesde || periodoVigente);
    setPeriodoDesde(nov.periodoDesde || periodoVigente);
    setPeriodoHasta(nov.periodoHasta || '');
    setLiquidacionesImpactadas(
      nov.liquidacionesImpactadas && nov.liquidacionesImpactadas.length > 0
        ? nov.liquidacionesImpactadas
        : ['MEN'],
    );
    setDescripcion(nov.descripcion || '');
    setExpedienteJudicial(nov.expedienteJudicial || '');
    setErrorValidacion(null);
    setMostrarFormulario(true);
    setTimeout(() => {
      formularioRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleGuardarNovedad = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!ciSeleccionado) {
      setErrorValidacion('Debe seleccionar un funcionario.');
      return;
    }
    if (!codigoVariable.trim() && !numeroConcepto) {
      setErrorValidacion('Debe asignar la Variable Oficial y su Concepto asociado (obligatorio).');
      return;
    }
    if (!descripcion.trim()) {
      setErrorValidacion('Ingrese una descripción clara para la novedad.');
      return;
    }
    if (liquidacionesImpactadas.length === 0) {
      setErrorValidacion('Debe seleccionar al menos un tipo de liquidación impactada (ej: MEN, COM).');
      return;
    }

    const mOriginal = Number(montoOriginal) || 0;
    const sPendiente = saldoPendiente ? Number(saldoPendiente) : mOriginal;
    const cuota = Number(cuotaMensual) || 0;
    const pctVar = Number(porcentajeVariable) || 0;

    if (modalidadCalculo === 'porcentaje_variable') {
      if (pctVar <= 0 || pctVar > 100) {
        setErrorValidacion('El porcentaje variable debe ser un valor entre 1% y 100%.');
        return;
      }
    } else {
      if (cuota <= 0 && mOriginal <= 0) {
        setErrorValidacion('Debe especificar una cuota o monto mayor a 0 Gs.');
        return;
      }
    }

    if (tipoVigencia === 'hasta_saldo_cero' && mOriginal <= 0 && sPendiente <= 0) {
      setErrorValidacion('Para vigencia hasta agotar saldo, debe ingresar el monto de deuda o saldo.');
      return;
    }

    let tipoMapeado: TipoNovedad = 'otro_descuento_fijo';
    const codUpper = (codigoVariable || '').toUpperCase();
    if (subtipo === 'embargo_judicial' || codUpper.startsWith('EMB')) tipoMapeado = 'embargo_judicial';
    else if (subtipo === 'anticipo_salario' || codUpper.startsWith('DESC_ANT') || codUpper.startsWith('ANDOL')) tipoMapeado = 'anticipo_recurrente';
    else if (subtipo === 'prestamo_empresa' || codUpper.startsWith('PRES')) tipoMapeado = 'prestamo_empresa';
    else if (subtipo === 'seguro_medico' || codUpper === 'ASISMED' || codUpper === 'IMPPLAN') tipoMapeado = 'seguro_medico';
    else if (subtipo === 'adicional_cargo' || ['H50', 'H100', 'H130', 'HRN', 'SALNOC', 'HORAEXTRA', 'FALLO_CAJ'].includes(codUpper)) tipoMapeado = 'adicional_cargo';
    else if (subtipo === 'refrigerio_viatico' || ['REFRIGERIO', 'REFRI', 'VIATI', 'VARYREF'].includes(codUpper)) tipoMapeado = 'refrigerio_traslado';
    else if (subtipo === 'bonificacion_extraordinaria' || ['BF_MAN', 'BF_MANCO'].includes(codUpper)) tipoMapeado = 'bono_fijo';
    else if (tipoConcepto === 'haber') tipoMapeado = 'otro_haber';

    const novedadPayload: NovedadPersonal = {
      id: modoEdicionId || `nov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ci: ciSeleccionado,
      tipo: tipoMapeado,
      subtipo,
      tipoConcepto,
      codigoVariable: codigoVariable.trim() ? codigoVariable.trim() : undefined,
      numeroConcepto,
      nombreConcepto: nombreConcepto.trim() ? nombreConcepto.trim() : undefined,
      descripcion: descripcion.trim(),
      modalidadCalculo,
      porcentajeVariable: modalidadCalculo === 'porcentaje_variable' ? pctVar : undefined,
      montoOriginal: mOriginal > 0 ? roundGs(mOriginal) : undefined,
      saldoPendiente: sPendiente > 0 ? roundGs(sPendiente) : undefined,
      saldoInicial: mOriginal > 0 ? roundGs(mOriginal) : undefined,
      cuotaMensual: cuota > 0 ? roundGs(cuota) : undefined,
      porcentajeTope: (Number(porcentajeVariable) || 25) / 100,
      activo: true,
      prioridad: Number(prioridad) || 1,
      fechaCreacion: new Date().toISOString(),
      expedienteJudicial: expedienteJudicial.trim() || undefined,
      conceptoClave:
        subtipo === 'refrigerio_viatico'
          ? 'refrigerioTraslado'
          : subtipo === 'adicional_cargo'
          ? 'adicionalCargo'
          : subtipo,
      tipoVigencia,
      mesUnico: tipoVigencia === 'mes_unico' ? mesUnico : undefined,
      regimenVigencia: tipoVigencia === 'rango_meses' ? 'definido' : 'indeterminado',
      periodoDesde:
        tipoVigencia === 'rango_meses'
          ? periodoDesde
          : tipoVigencia === 'mes_unico'
          ? mesUnico
          : periodoDesde || undefined,
      periodoHasta: tipoVigencia === 'rango_meses' && periodoHasta.trim() ? periodoHasta.trim() : undefined,
      liquidacionesImpactadas,
    };

    const res = upsertNovedadConPisado(empresaId, novedadPayload, 'Operador RRHH');
    if (res.exito) {
      setMostrarFormulario(false);
      setModoEdicionId(null);
      resetFormulario();
      if (onNovedadesActualizadas) onNovedadesActualizadas();
    } else {
      setErrorValidacion('No se pudo guardar la novedad en el almacenamiento.');
    }
  };

  const handleEliminar = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta novedad?')) {
      deleteNovedad(empresaId, id);
      if (onNovedadesActualizadas) onNovedadesActualizadas();
    }
  };

  const handleToggleActivo = (nov: NovedadPersonal) => {
    upsertNovedadConPisado(empresaId, { ...nov, activo: !nov.activo });
    if (onNovedadesActualizadas) onNovedadesActualizadas();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '12px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚖️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Gestión de Novedades Salariales y Embargos
                </h2>
                {periodoVigente && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: '#1e3a8a',
                      color: '#bfdbfe',
                      fontWeight: 700,
                      border: '1px solid #3b82f6',
                    }}
                  >
                    Período Nómina: {periodoVigente}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                Catálogo oficial coherente de variables (Comisiones, Horas Extras, Asismed), embargos y pisado trazable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Barra de pestañas y botones superiores */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTabActiva('todos')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'todos' ? '#4f46e5' : '#e2e8f0',
                color: tabActiva === 'todos' ? '#ffffff' : '#334155',
              }}
            >
              Todas ({novedades.length})
            </button>
            <button
              onClick={() => setTabActiva('haberes')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'haberes' ? '#059669' : '#e2e8f0',
                color: tabActiva === 'haberes' ? '#ffffff' : '#334155',
              }}
            >
              🌟 Haberes ({novedades.filter((n) => n.tipoConcepto === 'haber' || ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(n.tipo)).length})
            </button>
            <button
              onClick={() => setTabActiva('descuentos')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'descuentos' ? '#dc2626' : '#e2e8f0',
                color: tabActiva === 'descuentos' ? '#ffffff' : '#334155',
              }}
            >
              🔻 Descuentos ({novedades.filter((n) => n.tipoConcepto !== 'haber' && !['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(n.tipo)).length})
            </button>
            <button
              onClick={() => setTabActiva('embargo_judicial')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'embargo_judicial' ? '#4f46e5' : '#e2e8f0',
                color: tabActiva === 'embargo_judicial' ? '#ffffff' : '#334155',
              }}
            >
              ⚖️ Embargos ({novedades.filter((n) => n.tipo === 'embargo_judicial').length})
            </button>
            <button
              onClick={() => setTabActiva('anticipo_recurrente')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'anticipo_recurrente' ? '#4f46e5' : '#e2e8f0',
                color: tabActiva === 'anticipo_recurrente' ? '#ffffff' : '#334155',
              }}
            >
              💵 Anticipos ({novedades.filter((n) => n.tipo === 'anticipo_recurrente').length})
            </button>
            <button
              onClick={() => setTabActiva('prestamo_empresa')}
              style={{
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tabActiva === 'prestamo_empresa' ? '#4f46e5' : '#e2e8f0',
                color: tabActiva === 'prestamo_empresa' ? '#ffffff' : '#334155',
              }}
            >
              💳 Préstamos ({novedades.filter((n) => n.tipo === 'prestamo_empresa').length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Toggle de Solo Mes Activo */}
            {periodoVigente && (
              <button
                type="button"
                onClick={() => setSoloPeriodoActivo(!soloPeriodoActivo)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: soloPeriodoActivo ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: soloPeriodoActivo ? '#dbeafe' : '#ffffff',
                  color: soloPeriodoActivo ? '#1e40af' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Muestra únicamente las novedades vigentes en el mes de nómina seleccionado"
              >
                <span>{soloPeriodoActivo ? '📅 Solo mes' : '🌐 Todas'}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>({periodoVigente})</span>
              </button>
            )}

            <button
              onClick={handleAbrirNuevaNovedad}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mostrarFormulario && !modoEdicionId ? '#64748b' : '#059669',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
              }}
            >
              <span>{mostrarFormulario && !modoEdicionId ? '✕' : '+'}</span>
              <span>{mostrarFormulario && !modoEdicionId ? 'Ocultar Formulario' : '➕ Nueva Novedad'}</span>
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Formulario interactivo para Cargar / Editar Novedad */}
          {mostrarFormulario && (
            <form
              ref={formularioRef}
              onSubmit={handleGuardarNovedad}
              style={{
                padding: '16px 18px',
                backgroundColor: modoEdicionId ? '#fffbeb' : '#eff6ff',
                borderRadius: '12px',
                border: modoEdicionId ? '1px solid #fde68a' : '1px solid #bfdbfe',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: modoEdicionId ? '#92400e' : '#1e3a8a' }}>
                    {modoEdicionId ? '✏️ Modificar Novedad Salarial' : '📝 Programar Nueva Novedad Salarial'}
                  </span>
                  {modoEdicionId && (
                    <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                      ID: {modoEdicionId}
                    </span>
                  )}
                </div>

                {/* Selector de Naturaleza */}
                <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '2px', backgroundColor: '#ffffff' }}>
                  <button
                    type="button"
                    onClick={() => handleCambioNaturaleza('haber')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: tipoConcepto === 'haber' ? '#059669' : 'transparent',
                      color: tipoConcepto === 'haber' ? '#ffffff' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    🌟 Haber / Bonificación / Comisión
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCambioNaturaleza('descuento')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: tipoConcepto === 'descuento' ? '#dc2626' : 'transparent',
                      color: tipoConcepto === 'descuento' ? '#ffffff' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    🔻 Retención / Descuento
                  </button>
                </div>
              </div>

              {/* Guía Visual Asistida de 3 Pasos (A prueba de errores) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '11.5px',
                  color: '#334155',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🎯</span>
                  <span>Flujo asistido:</span>
                </span>
                <span
                  style={{
                    color: ciSeleccionado ? '#059669' : '#2563eb',
                    fontWeight: ciSeleccionado ? 800 : 600,
                    backgroundColor: ciSeleccionado ? '#ecfdf5' : '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {ciSeleccionado ? '✓ 1. Funcionario listo' : '1. Elegir Funcionario'}
                </span>
                <span style={{ color: '#94a3b8' }}>→</span>
                <span
                  style={{
                    color: codigoVariable || numeroConcepto ? '#059669' : '#2563eb',
                    fontWeight: codigoVariable || numeroConcepto ? 800 : 600,
                    backgroundColor: codigoVariable || numeroConcepto ? '#ecfdf5' : '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {codigoVariable || numeroConcepto ? '✓ 2. Concepto listo' : '2. Variable y Concepto'}
                </span>
                <span style={{ color: '#94a3b8' }}>→</span>
                <span
                  style={{
                    color: cuotaMensual || montoOriginal || porcentajeVariable ? '#059669' : '#2563eb',
                    fontWeight: cuotaMensual || montoOriginal || porcentajeVariable ? 800 : 600,
                    backgroundColor: cuotaMensual || montoOriginal || porcentajeVariable ? '#ecfdf5' : '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {cuotaMensual || montoOriginal || porcentajeVariable ? '✓ 3. Monto asignado' : '3. Monto y Vigencia'}
                </span>
              </div>

              {errorValidacion && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {errorValidacion}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {/* 1. Funcionario con SearchableSelect multi-query */}
                <div>
                  <SearchableSelect
                    label="1. Funcionario / Personal *"
                    placeholder="Escribí nombre, apellido o CI..."
                    options={opcionesFuncionarios}
                    value={ciSeleccionado}
                    onChange={setCiSeleccionado}
                    emptyText="No se encontró funcionario con ese nombre o CI"
                  />
                </div>

                {/* 2. Variable Oficial / Motor (OBLIGATORIA con Comisiones, Horas Extras, etc.) */}
                <div>
                  <SearchableSelect
                    label="2. Variable Oficial / Motor *"
                    placeholder="Buscar variable (COMISION, H50, ASISMED...)"
                    options={opcionesVariables}
                    value={codigoVariable}
                    onChange={handleSeleccionarVariable}
                    emptyText="No hay variables oficiales que coincidan con la búsqueda"
                  />
                </div>

                {/* 3. Concepto Contable / Nómina Oficial (OBLIGATORIO con sincronización automática) */}
                <div>
                  <SearchableSelect
                    label="3. Concepto Contable / Nómina Oficial *"
                    placeholder="Seleccione concepto contable asignado..."
                    options={opcionesConceptosOficiales}
                    value={numeroConcepto ? String(numeroConcepto) : ''}
                    onChange={handleSeleccionarConcepto}
                    emptyText="No hay conceptos contables oficiales que coincidan"
                  />
                </div>

                {/* 4. Modalidad de Cálculo */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    4. Modalidad de Cálculo *
                  </label>
                  <select
                    value={modalidadCalculo}
                    onChange={(e) => setModalidadCalculo(e.target.value as ModalidadCalculoNovedad)}
                    style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', backgroundColor: '#ffffff', fontWeight: 600 }}
                  >
                    <option value="monto_fijo">💵 Monto Fijo en Guaraníes (Gs.)</option>
                    <option value="porcentaje_variable">📊 Variable % de los Ingresos (ej: 25%)</option>
                  </select>
                </div>

                {/* Monto / Cuota según modalidad */}
                {modalidadCalculo === 'porcentaje_variable' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Porcentaje Variable (%) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Ej: 25"
                        value={porcentajeVariable}
                        onChange={(e) => setPorcentajeVariable(e.target.value)}
                        style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#475569' }}>%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Cuota o Monto Mensual (Gs.) *
                    </label>
                    <input
                      type="number"
                      placeholder="Ej: 550000"
                      value={cuotaMensual}
                      onChange={(e) => setCuotaMensual(e.target.value)}
                      style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Deuda Total Original (para préstamos y embargos) */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Deuda Total Original (Gs.) {subtipo === 'embargo_judicial' ? '*' : '(Opcional)'}
                  </label>
                  <input
                    type="number"
                    placeholder="Dejar vacío si es haber, comisión o cuota fija"
                    value={montoOriginal}
                    onChange={(e) => {
                      setMontoOriginal(e.target.value);
                      if (!saldoPendiente || saldoPendiente === montoOriginal) {
                        setSaldoPendiente(e.target.value);
                      }
                    }}
                    style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Saldo Pendiente Actual */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Saldo Pendiente Actual (Gs.)
                  </label>
                  <input
                    type="number"
                    placeholder="Dejar vacío si no amortiza saldo"
                    value={saldoPendiente}
                    onChange={(e) => setSaldoPendiente(e.target.value)}
                    style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Vigencia Temporal */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    5. Vigencia Temporal *
                  </label>
                  <select
                    value={tipoVigencia}
                    onChange={(e) => setTipoVigencia(e.target.value as TipoVigenciaNovedad)}
                    style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', backgroundColor: '#ffffff', fontWeight: 600 }}
                  >
                    <option value="permanente">♾️ Permanente (rige hasta nueva novedad o baja)</option>
                    <option value="mes_unico">📅 Solo este mes (período específico)</option>
                    <option value="rango_meses">🗓️ Rango de meses (Desde / Hasta)</option>
                    <option value="hasta_saldo_cero">🔄 Hasta agotar saldo (hasta saldo Gs. 0)</option>
                  </select>
                </div>

                {/* Fechas según vigencia */}
                {tipoVigencia === 'mes_unico' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Mes que impacta (YYYY-MM) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 2026-09"
                      value={mesUnico}
                      onChange={(e) => setMesUnico(e.target.value)}
                      style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {(tipoVigencia === 'rango_meses' || tipoVigencia === 'permanente') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Vigente Desde (YYYY-MM)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 2026-09"
                      value={periodoDesde}
                      onChange={(e) => setPeriodoDesde(e.target.value)}
                      style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {tipoVigencia === 'rango_meses' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Vigente Hasta (YYYY-MM) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 2026-10"
                      value={periodoHasta}
                      onChange={(e) => setPeriodoHasta(e.target.value)}
                      style={{ width: '100%', minHeight: '40px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Liquidaciones Impactadas */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    6. ¿Qué Liquidaciones Impacta? (Selección Múltiple) *
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { code: 'MEN' as CodigoLiquidacionImpacto, label: 'MEN (Salario Mensual Ordinario)' },
                      { code: 'COM' as CodigoLiquidacionImpacto, label: 'COM (Comisiones)' },
                      { code: 'HRE' as CodigoLiquidacionImpacto, label: 'HRE (Horas Extras y Recargos)' },
                      { code: 'AGU' as CodigoLiquidacionImpacto, label: 'AGU (Aguinaldo)' },
                      { code: 'FIN' as CodigoLiquidacionImpacto, label: 'FIN (Liquidación Final / Egreso)' },
                    ].map((item) => {
                      const isChecked = liquidacionesImpactadas.includes(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => toggleLiquidacion(item.code)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            border: isChecked ? '1px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: isChecked ? '#dbeafe' : '#ffffff',
                            color: isChecked ? '#1d4ed8' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{isChecked ? '☑' : '☐'}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Descripción / Detalle */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    7. Descripción / Detalle *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Comisiones Ventas / Horas Extras 130% / Asistencia médica Asismed"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    style={{ width: '100%', minHeight: '40px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Expediente judicial si aplica */}
                {(subtipo === 'embargo_judicial' || codigoVariable.toUpperCase().startsWith('EMB')) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Expediente / Autos Judiciales (Oficio)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Juicio Ejecutivo c/ Funcionario s/ Cobro de Guaraníes - Oficio N° 142/26"
                      value={expedienteJudicial}
                      onChange={(e) => setExpedienteJudicial(e.target.value)}
                      style={{ width: '100%', minHeight: '40px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>

              {/* Botones de acción del formulario */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormulario(false);
                    setModoEdicionId(null);
                    resetFormulario();
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: modoEdicionId ? '#d97706' : '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  {modoEdicionId ? '💾 Guardar Cambios' : '💾 Guardar y Programar Novedad'}
                </button>
              </div>
            </form>
          )}

          {/* Buscador por C.I. y estado de filtro por mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Filtrar por C.I.:</span>
              <input
                type="text"
                placeholder="Buscar por cédula..."
                value={filtroCi}
                onChange={(e) => setFiltroCi(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '160px' }}
              />
            </div>
            {soloPeriodoActivo && periodoVigente && (
              <span style={{ fontSize: '11.5px', color: '#1e40af', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                Mostrando únicamente novedades que impactan en <strong>{periodoVigente}</strong>
              </span>
            )}
          </div>

          {/* Listado de Novedades */}
          {novedadesFiltradas.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '13px' }}>
              No hay novedades registradas que apliquen a esta vista.
              {soloPeriodoActivo && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => setSoloPeriodoActivo(false)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                  >
                    Ver todas las novedades de otros meses
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {novedadesFiltradas.map((nov) => {
                const tieneSaldo = typeof nov.saldoPendiente === 'number' && typeof nov.montoOriginal === 'number' && nov.montoOriginal > 0;
                const pctAmortizado = tieneSaldo
                  ? Math.min(100, Math.max(0, ((nov.montoOriginal! - nov.saldoPendiente!) / nov.montoOriginal!) * 100))
                  : 0;
                const estaHistorialAbierto = historialAbiertoId === nov.id;

                return (
                  <div
                    key={nov.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: nov.activo ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                      backgroundColor: nov.activo ? '#ffffff' : '#f8fafc',
                      opacity: nov.activo ? 1 : 0.65,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                            {getNombreEmpleado(nov.ci)}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                            CI: {nov.ci}
                          </span>
                          {/* Badge de Variable Oficial */}
                          {nov.codigoVariable && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                              }}
                              title="Variable Oficial vinculada"
                            >
                              📌 [{nov.codigoVariable}]
                            </span>
                          )}
                          {/* Badge de Concepto Contable Oficial */}
                          {nov.numeroConcepto && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: '#4338ca',
                                color: '#ffffff',
                              }}
                              title={`Concepto Oficial N° ${nov.numeroConcepto} (${nov.nombreConcepto || ''})`}
                            >
                              🏷️ N° {nov.numeroConcepto}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: nov.tipoConcepto === 'haber' ? '#d1fae5' : '#fee2e2',
                              color: nov.tipoConcepto === 'haber' ? '#065f46' : '#991b1b',
                            }}
                          >
                            {nov.tipoConcepto === 'haber' ? '🌟 Haber (+)' : '🔻 Descuento (-)'}
                          </span>

                          {/* Modalidad de cálculo */}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {nov.modalidadCalculo === 'porcentaje_variable'
                              ? `📊 ${nov.porcentajeVariable ?? 25}% Variable`
                              : `💵 ${nov.cuotaMensual ? formatGuaranies(nov.cuotaMensual) : 'Fijo'}`}
                          </span>

                          {/* Vigencia */}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                            }}
                          >
                            {nov.tipoVigencia === 'hasta_saldo_cero'
                              ? '🔄 Hasta saldo Gs. 0'
                              : nov.tipoVigencia === 'mes_unico'
                              ? `📅 Solo ${nov.mesUnico || nov.periodoDesde || 'este mes'}`
                              : nov.tipoVigencia === 'rango_meses' || nov.regimenVigencia === 'definido'
                              ? `🗓️ ${nov.periodoDesde || ''} → ${nov.periodoHasta || 'fin'}`
                              : '♾️ Permanente'}
                          </span>

                          {/* Flags de liquidaciones */}
                          {nov.liquidacionesImpactadas && nov.liquidacionesImpactadas.length > 0 && (
                            <div style={{ display: 'inline-flex', gap: '3px' }}>
                              {nov.liquidacionesImpactadas.map((code) => (
                                <span
                                  key={code}
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    backgroundColor: '#334155',
                                    color: '#ffffff',
                                  }}
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Badge si pisó novedad anterior */}
                          {nov.reemplazaNovedadId && (
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                              }}
                              title="Esta novedad reemplazó a una anterior para este concepto"
                            >
                              ⚡ Pisó anterior
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '4px' }}>
                          <strong>{nov.descripcion}</strong>
                          {nov.nombreConcepto && nov.nombreConcepto !== nov.descripcion && (
                            <span style={{ marginLeft: '6px', color: '#475569', fontSize: '11.5px' }}>
                              — {nov.nombreConcepto}
                            </span>
                          )}
                          {nov.expedienteJudicial && (
                            <span style={{ marginLeft: '6px', color: '#64748b' }}>({nov.expedienteJudicial})</span>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción: EDITAR, ACTIVAR/PAUSAR, ELIMINAR */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleEditarNovedad(nov)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            border: '1px solid #d97706',
                            backgroundColor: '#fffbeb',
                            color: '#b45309',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Editar cuota, vigencia o valores de esta novedad"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleToggleActivo(nov)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            backgroundColor: nov.activo ? '#ecfdf5' : '#f1f5f9',
                            color: nov.activo ? '#047857' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          {nov.activo ? '● Activo' : '○ Pausado'}
                        </button>
                        <button
                          onClick={() => handleEliminar(nov.id)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                          title="Eliminar novedad"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Barra de amortización para deudas */}
                    {tieneSaldo && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#475569', marginBottom: '4px' }}>
                          <span>
                            Saldo Restante: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{formatGuaranies(nov.saldoPendiente!)}</strong>
                          </span>
                          <span>
                            Deuda Original: <span style={{ fontFamily: 'monospace' }}>{formatGuaranies(nov.montoOriginal!)}</span> ({pctAmortizado.toFixed(1)}% saldado)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pctAmortizado}%`,
                              height: '100%',
                              backgroundColor: pctAmortizado >= 100 ? '#10b981' : '#3b82f6',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>

                        {nov.activo && (nov.saldoPendiente || 0) > 0 && (
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '11px',
                              color: '#9a3412',
                              background: '#fff7ed',
                              border: '1px solid #ffedd5',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>🔄</span>
                            <span>
                              <strong>Saldo vivo activo:</strong> Este saldo remanente de {formatGuaranies(nov.saldoPendiente!)} se estirará automáticamente al liquidar el finiquito de este colaborador.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cuota para anticipos o cuotas fijas o haberes recurrentes */}
                    {typeof nov.cuotaMensual === 'number' && nov.cuotaMensual > 0 && !tieneSaldo && (
                      <div
                        style={{
                          fontSize: '12px',
                          color:
                            nov.tipoConcepto === 'haber' ||
                            ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(nov.tipo)
                              ? '#047857'
                              : '#15803d',
                        }}
                      >
                        {nov.tipoConcepto === 'haber' ||
                        ['adicional_cargo', 'refrigerio_traslado', 'bono_fijo', 'otro_haber'].includes(nov.tipo)
                          ? '🌟 Haber / bonificación mensual: '
                          : '🔻 Descuento mensual: '}
                        <strong style={{ fontFamily: 'monospace' }}>{formatGuaranies(nov.cuotaMensual)}</strong>
                      </div>
                    )}

                    {/* Sección de Auditoría y Trazabilidad */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <span>Cargado por: <strong>{nov.creadoPor || 'Operador RRHH'}</strong></span>
                        <span style={{ margin: '0 6px' }}>·</span>
                        <span>Fecha: {new Date(nov.fechaCreacion).toLocaleDateString('es-PY')}</span>
                        {nov.modificadoPor && (
                          <>
                            <span style={{ margin: '0 6px' }}>·</span>
                            <span>Modificado por: <strong>{nov.modificadoPor}</strong> ({new Date(nov.fechaModificacion || '').toLocaleDateString('es-PY')})</span>
                          </>
                        )}
                      </div>

                      {nov.historialAuditoria && nov.historialAuditoria.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setHistorialAbiertoId(estaHistorialAbierto ? null : nov.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>📜 Auditoría ({nov.historialAuditoria.length})</span>
                          <span>{estaHistorialAbierto ? '▲' : '▼'}</span>
                        </button>
                      )}
                    </div>

                    {/* Desplegable de Historial de Auditoría */}
                    {estaHistorialAbierto && nov.historialAuditoria && (
                      <div
                        style={{
                          backgroundColor: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '11.5px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: '#334155' }}>
                          Historial de Movimientos y Pisado de Novedad:
                        </span>
                        {nov.historialAuditoria.map((h, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              paddingBottom: '4px',
                              borderBottom: i < nov.historialAuditoria!.length - 1 ? '1px dashed #e2e8f0' : 'none',
                            }}
                          >
                            <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '10.5px' }}>
                              {new Date(h.fecha).toLocaleString('es-PY')}
                            </span>
                            <span
                              style={{
                                padding: '1px 5px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 800,
                                backgroundColor: h.accion === 'pisado' ? '#fee2e2' : h.accion === 'modificacion' ? '#fef3c7' : '#dcfce7',
                                color: h.accion === 'pisado' ? '#991b1b' : h.accion === 'modificacion' ? '#92400e' : '#166534',
                              }}
                            >
                              {h.accion.toUpperCase()}
                            </span>
                            <div style={{ flex: 1, color: '#1e293b' }}>
                              <strong>{h.usuario}:</strong> {h.detalle}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Base legal: Art. 245 Código del Trabajo (Tope 25% haberes imponibles para embargos).
          </span>
          <button
            onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
