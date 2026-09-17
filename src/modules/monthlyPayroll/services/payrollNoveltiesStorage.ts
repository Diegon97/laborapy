/**
 * SERVICIO DE ALMACENAMIENTO DE PERÍODOS Y NOVEDADES SALARIALES (ERP LABORAPY)
 *
 * Persistencia multi-tenant por empresa cliente en LocalStorage con fallback en memoria.
 * Inmutabilidad de cierres contables y amortización automática de saldos de embargos/préstamos.
 */

import type { TotalesNominaMasiva } from '../types';
import type { AsientoContableGeneral } from '../types/accountingTypes';
import type {
  PeriodoNomina,
  NovedadPersonal,
  DesgloseNovedadAplicada,
  TipoLiquidacion,
  MonedaNomina,
} from '../types/noveltyTypes';
import {
  formatPeriodoFormal,
  aplicarNovedadesANominaCompleta,
  procesarAmortizacionCierrePeriodo,
} from '../engine/payrollNoveltiesEngine';
import {
  loadNominaPeriodo,
  saveNominaPeriodo,
} from './monthlyPayrollStorage';

const STORAGE_PREFIX_PERIODOS = 'laborapy_periodos_';
const STORAGE_PREFIX_NOVEDADES = 'laborapy_novedades_';

export function getPeriodosStorageKey(empresaId: string): string {
  return `${STORAGE_PREFIX_PERIODOS}${empresaId?.trim() || 'general'}`;
}

export function getNovedadesStorageKey(empresaId: string): string {
  return `${STORAGE_PREFIX_NOVEDADES}${empresaId?.trim() || 'general'}`;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const memoryStore = new Map<string, string>();

function getSafeStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Modo privado o storage bloqueado
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage;
    }
  } catch {
    // Sin acceso a localStorage
  }
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
  };
}

/* =========================================================================
 * GESTIÓN DE PERÍODOS FORMALES
 * ========================================================================= */

export function loadPeriodosEmpresa(empresaId: string): PeriodoNomina[] {
  try {
    const raw = getSafeStorage().getItem(getPeriodosStorageKey(empresaId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PeriodoNomina =>
        !!p && typeof p.id === 'string' && typeof p.estado === 'string',
    );
  } catch {
    return [];
  }
}

export function savePeriodosEmpresa(empresaId: string, periodos: PeriodoNomina[]): boolean {
  try {
    getSafeStorage().setItem(getPeriodosStorageKey(empresaId), JSON.stringify(periodos));
    return true;
  } catch {
    return false;
  }
}

export function getPeriodo(empresaId: string, periodoId: string): PeriodoNomina | null {
  const periodos = loadPeriodosEmpresa(empresaId);
  return periodos.find((p) => p.id === periodoId) ?? null;
}

export function crearPeriodo(
  empresaId: string,
  anio: number,
  mes: number,
  tipoLiquidacion?: TipoLiquidacion,
  moneda?: MonedaNomina,
  empleadoSalida?: { ci: string; nombre: string; motivo: string; fechaEgreso: string },
): PeriodoNomina {
  const mesPadded = String(mes).padStart(2, '0');
  const sufijo = tipoLiquidacion && tipoLiquidacion !== 'mensual_ips' ? `_${tipoLiquidacion}` : '';
  const id = `${anio}-${mesPadded}${sufijo}`;
  const periodos = loadPeriodosEmpresa(empresaId);

  const existente = periodos.find((p) => p.id === id);
  if (existente) return existente;

  const nuevo: PeriodoNomina = {
    id,
    codigoFormal: formatPeriodoFormal(id, tipoLiquidacion, empleadoSalida?.nombre),
    mes,
    anio,
    estado: 'abierto',
    tipoLiquidacion: tipoLiquidacion || 'mensual_ips',
    moneda: moneda || 'PYG',
    empleadoSalida,
  };

  periodos.push(nuevo);
  // Ordenar cronológicamente descendente
  periodos.sort((a, b) => b.id.localeCompare(a.id));
  savePeriodosEmpresa(empresaId, periodos);

  return nuevo;
}

/* =========================================================================
 * GESTIÓN DE NOVEDADES RECURRENTES
 * ========================================================================= */

export function loadNovedadesEmpresa(empresaId: string): NovedadPersonal[] {
  try {
    const raw = getSafeStorage().getItem(getNovedadesStorageKey(empresaId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is NovedadPersonal =>
        !!n && typeof n.id === 'string' && typeof n.ci === 'string' && typeof n.tipo === 'string',
    );
  } catch {
    return [];
  }
}

export function saveNovedadesEmpresa(empresaId: string, novedades: NovedadPersonal[]): boolean {
  try {
    getSafeStorage().setItem(getNovedadesStorageKey(empresaId), JSON.stringify(novedades));
    return true;
  } catch {
    return false;
  }
}

/**
 * Calcula el mes calendario inmediatamente anterior en formato 'YYYY-MM'.
 * Si recibe formato no válido, retorna el string original.
 */
export function getMesAnterior(periodoId: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodoId.trim());
  if (!match) return periodoId;
  let anio = Number(match[1]);
  let mes = Number(match[2]);
  if (mes === 1) {
    anio -= 1;
    mes = 12;
  } else {
    mes -= 1;
  }
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Comprueba si dos novedades corresponden al mismo concepto funcional para un funcionario.
 */
export function sonMismoConcepto(n1: NovedadPersonal, n2: NovedadPersonal): boolean {
  if (!n1 || !n2) return false;
  if (n1.ci.trim() !== n2.ci.trim()) return false;

  // 1. Coincidencia por variable definible oficial (ej: 'SALDOL', 'ASISMED')
  if (n1.codigoVariable && n2.codigoVariable) {
    return n1.codigoVariable.trim().toUpperCase() === n2.codigoVariable.trim().toUpperCase();
  }

  // 2. Coincidencia por concepto clave
  if (n1.conceptoClave && n2.conceptoClave) {
    return n1.conceptoClave.trim() === n2.conceptoClave.trim();
  }

  // 3. Coincidencia por subtipo y naturaleza
  const cat1 = n1.tipoConcepto || 'descuento';
  const cat2 = n2.tipoConcepto || 'descuento';
  if (n1.subtipo && n2.subtipo && n1.subtipo === n2.subtipo && cat1 === cat2) {
    return true;
  }

  // 4. Coincidencia por tipo principal y naturaleza
  return n1.tipo === n2.tipo && cat1 === cat2;
}

export function upsertNovedad(empresaId: string, novedad: NovedadPersonal): boolean {
  return upsertNovedadConPisado(empresaId, novedad).exito;
}

/**
 * Inserta o actualiza una novedad salarial aplicando pisado inteligente y auditoría:
 * Si ya existe una novedad del mismo concepto para el funcionario:
 * - Si la nueva rige a partir de un nuevo mes (ej: octubre vs septiembre):
 *   la anterior acorta su vigencia hasta el mes anterior (septiembre), quedando ambas vigentes en sus períodos.
 * - Si coinciden en fecha de inicio o la anterior queda sin vigencia:
 *   la anterior se desactiva y queda archivada como pisada.
 * - Ambas novedades registran la trazabilidad completa en historialAuditoria.
 */
export function upsertNovedadConPisado(
  empresaId: string,
  novedad: NovedadPersonal,
  usuario: string = 'Operador RRHH',
): { exito: boolean; novedadPisadaId?: string } {
  const novedades = loadNovedadesEmpresa(empresaId);
  const ahoraIso = new Date().toISOString();
  const idxExistente = novedades.findIndex((n) => n.id === novedad.id);

  // CASO 1: Edición de una novedad existente
  if (idxExistente >= 0) {
    const previa = novedades[idxExistente];
    const valorAnt = previa.cuotaMensual ?? previa.montoOriginal ?? 0;
    const valorNue = novedad.cuotaMensual ?? novedad.montoOriginal ?? 0;

    const historial = previa.historialAuditoria ? [...previa.historialAuditoria] : [];
    historial.push({
      fecha: ahoraIso,
      usuario,
      accion: 'modificacion',
      detalle: `Modificación de valores: ${valorAnt.toLocaleString('es-PY')} Gs. ➔ ${valorNue.toLocaleString('es-PY')} Gs. Vigencia: ${novedad.tipoVigencia || 'permanente'}`,
      valorAnterior: valorAnt,
      valorNuevo: valorNue,
    });

    novedades[idxExistente] = {
      ...novedad,
      creadoPor: previa.creadoPor || novedad.creadoPor || usuario,
      fechaCreacion: previa.fechaCreacion || novedad.fechaCreacion || ahoraIso,
      modificadoPor: usuario,
      fechaModificacion: ahoraIso,
      historialAuditoria: historial,
    };

    const guardado = saveNovedadesEmpresa(empresaId, novedades);
    return { exito: guardado };
  }

  // CASO 2: Nueva novedad -> Comprobar colisión con novedad previa activa del mismo concepto
  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const nuevoInicio = novedad.periodoDesde || novedad.mesUnico || mesActualStr;

  const nuevaConAuditoria: NovedadPersonal = {
    ...novedad,
    creadoPor: novedad.creadoPor || usuario,
    fechaCreacion: novedad.fechaCreacion || ahoraIso,
    historialAuditoria: novedad.historialAuditoria ? [...novedad.historialAuditoria] : [],
  };

  const valorNuevo = nuevaConAuditoria.cuotaMensual ?? nuevaConAuditoria.montoOriginal ?? 0;

  nuevaConAuditoria.historialAuditoria!.push({
    fecha: ahoraIso,
    usuario,
    accion: 'creacion',
    detalle: `Carga de novedad: ${nuevaConAuditoria.descripcion} (${valorNuevo.toLocaleString('es-PY')} Gs.) desde ${nuevoInicio}`,
    valorNuevo,
    periodoAfectado: nuevoInicio,
  });

  // Buscar novedad previa activa para el mismo funcionario y concepto
  const previaIdx = novedades.findIndex(
    (n) => n.activo && sonMismoConcepto(n, nuevaConAuditoria),
  );

  let novedadPisadaId: string | undefined;

  if (previaIdx >= 0) {
    const previa = { ...novedades[previaIdx] };
    novedadPisadaId = previa.id;
    const previoInicio = previa.periodoDesde || previa.mesUnico || '2000-01';
    const valorAnterior = previa.cuotaMensual ?? previa.montoOriginal ?? 0;
    const histPrevia = previa.historialAuditoria ? [...previa.historialAuditoria] : [];

    if (nuevoInicio > previoInicio) {
      // El nuevo le pisa a partir de nuevoInicio: acortar vigencia de la anterior al mes anterior
      const mesAnterior = getMesAnterior(nuevoInicio);
      previa.periodoHasta = mesAnterior;
      previa.regimenVigencia = 'definido';
      previa.pisadaPorId = nuevaConAuditoria.id;
      previa.modificadoPor = usuario;
      previa.fechaModificacion = ahoraIso;

      histPrevia.push({
        fecha: ahoraIso,
        usuario,
        accion: 'pisado',
        detalle: `Vigencia acortada hasta ${mesAnterior} (pisada por nueva novedad de ${valorNuevo.toLocaleString('es-PY')} Gs. a partir de ${nuevoInicio})`,
        valorAnterior,
        valorNuevo,
        periodoAfectado: nuevoInicio,
      });
      previa.historialAuditoria = histPrevia;

      nuevaConAuditoria.reemplazaNovedadId = previa.id;
      nuevaConAuditoria.historialAuditoria!.push({
        fecha: ahoraIso,
        usuario,
        accion: 'pisado',
        detalle: `Pisa a novedad previa (${previa.descripcion} - ${valorAnterior.toLocaleString('es-PY')} Gs.) cuya vigencia quedó limitada hasta ${mesAnterior}`,
        valorAnterior,
        valorNuevo,
        periodoAfectado: nuevoInicio,
      });

      novedades[previaIdx] = previa;
    } else {
      // Mismo período de inicio o retroactivo: la anterior queda completamente reemplazada y desactivada
      previa.activo = false;
      previa.pisadaPorId = nuevaConAuditoria.id;
      previa.fechaFinalizacion = ahoraIso;
      previa.modificadoPor = usuario;
      previa.fechaModificacion = ahoraIso;

      histPrevia.push({
        fecha: ahoraIso,
        usuario,
        accion: 'pisado',
        detalle: `Desactivada y reemplazada totalmente en ${nuevoInicio} por novedad de ${valorNuevo.toLocaleString('es-PY')} Gs.`,
        valorAnterior,
        valorNuevo,
        periodoAfectado: nuevoInicio,
      });
      previa.historialAuditoria = histPrevia;

      nuevaConAuditoria.reemplazaNovedadId = previa.id;
      nuevaConAuditoria.historialAuditoria!.push({
        fecha: ahoraIso,
        usuario,
        accion: 'pisado',
        detalle: `Reemplaza y desactiva a novedad anterior (${previa.descripcion} - ${valorAnterior.toLocaleString('es-PY')} Gs.)`,
        valorAnterior,
        valorNuevo,
        periodoAfectado: nuevoInicio,
      });

      novedades[previaIdx] = previa;
    }
  }

  novedades.push(nuevaConAuditoria);
  const guardado = saveNovedadesEmpresa(empresaId, novedades);
  return { exito: guardado, novedadPisadaId };
}

export function deleteNovedad(empresaId: string, novedadId: string): boolean {
  const novedades = loadNovedadesEmpresa(empresaId);
  const filtradas = novedades.filter((n) => n.id !== novedadId);
  if (filtradas.length === novedades.length) return false;
  return saveNovedadesEmpresa(empresaId, filtradas);
}

/* =========================================================================
 * OPERACIONES DE CIERRE Y REAPERTURA CONTABLE
 * ========================================================================= */

export function cerrarPeriodoContable(
  empresaId: string,
  periodoId: string,
  totales: TotalesNominaMasiva,
  asiento: AsientoContableGeneral,
  cerradoPor: string = 'RRHH / Finanzas',
  desglosesExplicit?: DesgloseNovedadAplicada[],
): { exito: boolean; mensaje: string } {
  const periodos = loadPeriodosEmpresa(empresaId);
  const periodoIdx = periodos.findIndex((p) => p.id === periodoId);

  if (periodoIdx < 0) {
    return { exito: false, mensaje: `El período ${periodoId} no existe en el sistema.` };
  }

  const periodo = periodos[periodoIdx];
  if (periodo.estado === 'cerrado') {
    return { exito: false, mensaje: `El período ${periodo.codigoFormal} ya está oficialmente cerrado.` };
  }

  // 1. Amortizar saldos de embargos y préstamos
  let desglosesParaAmortizar = desglosesExplicit;

  if (!desglosesParaAmortizar) {
    const nominaGuardada = loadNominaPeriodo(empresaId, periodoId);
    if (nominaGuardada && Array.isArray(nominaGuardada.empleados)) {
      const novedades = loadNovedadesEmpresa(empresaId);
      const resultado = aplicarNovedadesANominaCompleta(nominaGuardada.empleados, novedades);
      desglosesParaAmortizar = resultado.todosLosDesgloses;
    } else {
      desglosesParaAmortizar = [];
    }
  }

  const novedadesActuales = loadNovedadesEmpresa(empresaId);
  const novedadesAmortizadas = procesarAmortizacionCierrePeriodo(
    novedadesActuales,
    desglosesParaAmortizar,
  );
  saveNovedadesEmpresa(empresaId, novedadesAmortizadas);

  // 2. Congelar el período contablemente
  const periodoCerrado: PeriodoNomina = {
    ...periodo,
    estado: 'cerrado',
    fechaCierre: new Date().toISOString(),
    cerradoPor,
    snapshotTotales: totales,
    snapshotAsiento: asiento,
  };

  periodos[periodoIdx] = periodoCerrado;
  savePeriodosEmpresa(empresaId, periodos);

  return {
    exito: true,
    mensaje: `Cierre contable de ${periodo.codigoFormal} ejecutado y congelado exitosamente.`,
  };
}

export function reabrirPeriodoContable(
  empresaId: string,
  periodoId: string,
): { exito: boolean; mensaje: string } {
  const periodos = loadPeriodosEmpresa(empresaId);
  const periodoIdx = periodos.findIndex((p) => p.id === periodoId);

  if (periodoIdx < 0) {
    return { exito: false, mensaje: `El período ${periodoId} no existe.` };
  }

  const periodo = periodos[periodoIdx];
  if (periodo.estado === 'abierto') {
    return { exito: false, mensaje: `El período ${periodo.codigoFormal} ya se encuentra abierto.` };
  }

  periodos[periodoIdx] = {
    ...periodo,
    estado: 'abierto',
    fechaCierre: undefined,
    cerradoPor: undefined,
  };

  savePeriodosEmpresa(empresaId, periodos);

  return {
    exito: true,
    mensaje: `Período ${periodo.codigoFormal} reabierto para edición.`,
  };
}

/* =========================================================================
 * REPLICACIÓN DE PLANILLA ENTRE MESES
 * ========================================================================= */

export function replicarPeriodo(
  empresaId: string,
  periodoOrigenId: string,
  periodoDestinoId: string,
): { exito: boolean; empleadosReplicados: number; mensaje: string } {
  // 1. Cargar nómina de origen
  const origen = loadNominaPeriodo(empresaId, periodoOrigenId);
  if (!origen || !Array.isArray(origen.empleados) || origen.empleados.length === 0) {
    return {
      exito: false,
      empleadosReplicados: 0,
      mensaje: `No se encontraron funcionarios guardados en el período origen ${periodoOrigenId}.`,
    };
  }

  // 2. Limpiar deducciones manuales y re-aplicar novedades recurrentes vigentes
  const plantillaBase = origen.empleados.map((emp) => ({
    ...emp,
    diasVacaciones: 0,
    diasReposo: 0,
    diasAusencias: 0,
    cantHoras50: 0,
    cantHoras130: 0,
    cantHoras100: 0,
    cantHorasNocturnas: 0,
    faltanteCaja: 0,
    faltanteMercaderia: 0,
    embargosJudiciales: 0,
    anticipoSalario: 0,
    prestamosEmpresa: 0,
    seguroMedicoPrivado: 0,
    telefonoNotebook: 0,
    compraCreditoEmpresa: 0,
    otrosDescuentos: 0,
  }));

  const novedades = loadNovedadesEmpresa(empresaId);
  const { empleadosActualizados } = aplicarNovedadesANominaCompleta(plantillaBase, novedades);

  // 3. Persistir en destino
  const guardado = saveNominaPeriodo(empresaId, periodoDestinoId, empleadosActualizados);
  if (!guardado) {
    return {
      exito: false,
      empleadosReplicados: 0,
      mensaje: `Error de almacenamiento al intentar guardar la nómina replicada en ${periodoDestinoId}.`,
    };
  }

  // 4. Asegurar que el período destino esté registrado
  const periodos = loadPeriodosEmpresa(empresaId);
  if (!periodos.some((p) => p.id === periodoDestinoId)) {
    const match = /^(\d{4})-(\d{1,2})$/.exec(periodoDestinoId);
    if (match) {
      crearPeriodo(empresaId, Number(match[1]), Number(match[2]));
    }
  }

  return {
    exito: true,
    empleadosReplicados: empleadosActualizados.length,
    mensaje: `Se replicaron ${empleadosActualizados.length} funcionarios de ${formatPeriodoFormal(periodoOrigenId)} a ${formatPeriodoFormal(periodoDestinoId)} con sus novedades aplicadas.`,
  };
}
