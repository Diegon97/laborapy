/**
 * MOTOR DE GESTIÓN DE PERÍODOS Y NOVEDADES RECURRENTES / COLA DE EMBARGOS (LABORAPY)
 *
 * Funciones puras de cálculo:
 * 1. Nomenclatura formal de períodos (MEN 08 (Agosto 2026))
 * 2. Cola de embargos judiciales con orden FIFO/prioridad y tope legal acumulado del 25% (Ley 213/93)
 * 3. Anticipos mensuales recurrentes que se trasladan mes a mes automáticamente
 * 4. Préstamos de empresa con amortización de saldo decreciente
 * 5. Amortización contable de cierre de período
 */

import type { EmpleadoNominaInput } from '../types';
import {
  calcularLiquidacionMensual,
  roundGs,
} from './monthlyPayrollEngine';
import type {
  NovedadPersonal,
  DesgloseNovedadAplicada,
  ResultadoAplicacionNovedades,
  TipoLiquidacion,
  CodigoLiquidacionImpacto,
} from '../types/noveltyTypes';
import { findVariableByCodigo } from '../types/payrollConceptsCatalog';

export const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const TOPE_LEGAL_EMBARGOS = 0.25;

/**
 * Formatea un identificador 'YYYY-MM' al formato formal corporativo:
 * Ej: '2026-08' -> 'MEN 08 (Agosto 2026)', 'HON 08 (Agosto 2026)', 'FIN 08 - Juan Pérez (Agosto 2026)', etc.
 */
export function formatPeriodoFormal(
  periodoId: string,
  tipoLiquidacion?: TipoLiquidacion,
  empleadoSalidaNombre?: string,
): string {
  const match = /^(\d{4})-(\d{1,2})$/.exec(periodoId.trim());
  if (!match) return periodoId;
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return periodoId;
  }
  const nombreMes = MESES_ES[mes - 1];
  const mesPadded = String(mes).padStart(2, '0');

  if (tipoLiquidacion === 'facturacion_honorarios') {
    return `HON ${mesPadded} (${nombreMes} ${anio})`;
  }
  if (tipoLiquidacion === 'liquidacion_final') {
    const nombre = empleadoSalidaNombre?.trim() || 'Salida';
    return `FIN ${mesPadded} - ${nombre} (${nombreMes} ${anio})`;
  }
  if (tipoLiquidacion === 'moneda_usd') {
    return `USD ${mesPadded} (${nombreMes} ${anio})`;
  }
  return `MEN ${mesPadded} (${nombreMes} ${anio})`;
}

/**
 * Parsea un identificador 'YYYY-MM'
 */
export function parsePeriodoId(periodoId: string): { anio: number; mes: number } {
  const match = /^(\d{4})-(\d{1,2})$/.exec(periodoId.trim());
  if (!match) {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  }
  return { anio: Number(match[1]), mes: Number(match[2]) };
}

/**
 * Calcula el tope legal mensual acumulado para embargos judiciales.
 * Regla legal: Math.floor para no exceder jamás el 25% estricto de haberes imponibles.
 */
export function calcularTopeLegalEmbargos(
  haberesImponiblesIps: number,
  porcentaje: number = TOPE_LEGAL_EMBARGOS,
): number {
  if (!Number.isFinite(haberesImponiblesIps) || haberesImponiblesIps <= 0) return 0;
  const pct = Number.isFinite(porcentaje) && porcentaje > 0 ? Math.min(porcentaje, 0.25) : 0.25;
  return Math.floor(haberesImponiblesIps * pct);
}

/**
 * Aplica todas las novedades salariales activas a un funcionario, procesando la
 * cola de embargos judiciales bajo el tope legal acumulado del 25% de haberes imponibles.
 */
export function aplicarNovedadesAEmpleado(
  empleado: EmpleadoNominaInput,
  novedadesEmpleado: NovedadPersonal[],
  haberesImponiblesIps?: number,
  periodoId?: string,
  tipoLiquidacionCodigo: CodigoLiquidacionImpacto = 'MEN',
): ResultadoAplicacionNovedades {
  // 1. Obtener base imponible oficial si no viene provista
  const baseImponible =
    typeof haberesImponiblesIps === 'number' && Number.isFinite(haberesImponiblesIps)
      ? Math.max(0, haberesImponiblesIps)
      : Math.max(0, calcularLiquidacionMensual(empleado).haberesImponiblesIps);

  const empleadoAjustado: EmpleadoNominaInput = { ...empleado };
  const desgloses: DesgloseNovedadAplicada[] = [];

  // Filtrar solo novedades activas pertenecientes a este funcionario y vigentes en el período
  const activas = (novedadesEmpleado || []).filter((n) => {
    if (!n || !n.activo || n.ci.trim() !== empleado.ci.trim()) return false;

    // Impacto por tipo de liquidación (MEN, COM, HRE, AGU)
    if (n.liquidacionesImpactadas && n.liquidacionesImpactadas.length > 0) {
      if (!n.liquidacionesImpactadas.includes(tipoLiquidacionCodigo)) {
        return false;
      }
    }

    // Vigencia por tipoVigencia o regimenVigencia
    if (n.tipoVigencia === 'mes_unico') {
      const targetMes = n.mesUnico || n.periodoDesde;
      if (periodoId && targetMes && periodoId !== targetMes) {
        return false;
      }
    } else if (n.tipoVigencia === 'rango_meses' || n.regimenVigencia === 'definido') {
      if (periodoId) {
        if (n.periodoDesde && n.periodoDesde > periodoId) return false;
        if (n.periodoHasta && n.periodoHasta < periodoId) return false;
      }
    } else if (n.tipoVigencia === 'hasta_saldo_cero') {
      const saldo = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : (n.montoOriginal ?? 0);
      if (saldo <= 0) return false;
      if (periodoId) {
        if (n.periodoDesde && n.periodoDesde > periodoId) return false;
      }
    } else {
      // Vigencia permanente o indefinida: respeta periodoDesde y periodoHasta si están definidos
      if (periodoId) {
        if (n.periodoDesde && n.periodoDesde > periodoId) return false;
        if (n.periodoHasta && n.periodoHasta < periodoId) return false;
      }
    }

    return true;
  });

  let totalAnticipos = 0;
  let totalPrestamos = 0;
  let totalEmbargos = 0;
  let totalOtros = 0;
  let totalHaberes = 0;

  // ── 0. HABERES Y PLUSES ADICIONALES (ADICIONAL CARGO, REFRIGERIO, BONOS) ──
  const haberes = activas.filter((n) => {
    const varDef = n.codigoVariable ? findVariableByCodigo(n.codigoVariable) : undefined;
    return (
      n.tipoConcepto === 'haber' ||
      varDef?.categoria === 'haber' ||
      n.tipo === 'adicional_cargo' ||
      n.tipo === 'refrigerio_traslado' ||
      n.tipo === 'bono_fijo' ||
      n.tipo === 'otro_haber'
    );
  });

  for (const n of haberes) {
    let cuota = 0;
    if (n.modalidadCalculo === 'porcentaje_variable' && typeof n.porcentajeVariable === 'number') {
      const pct = Math.max(0, Math.min(100, n.porcentajeVariable)) / 100;
      cuota = roundGs(baseImponible * pct);
    } else {
      cuota = Math.max(0, roundGs(n.cuotaMensual ?? n.montoOriginal ?? 0));
    }

    if (typeof n.saldoPendiente === 'number' && n.saldoPendiente > 0) {
      cuota = Math.min(cuota, n.saldoPendiente);
    }

    if (cuota <= 0) continue;

    const codVar = (n.codigoVariable || '').trim().toUpperCase();
    if (['COMISION', 'COMDOL', 'VARICOMI'].includes(codVar) || n.subtipo === 'comision') {
      const comisionActual = Number(empleadoAjustado.customFields?.comision) || 0;
      empleadoAjustado.customFields = {
        ...(empleadoAjustado.customFields || {}),
        comision: roundGs(comisionActual + cuota),
      };
    } else if (['H50', 'H100', 'H130', 'HRN', 'SALNOC', 'HORAEXTRA'].includes(codVar)) {
      empleadoAjustado.adicionalCargo = roundGs((empleadoAjustado.adicionalCargo || 0) + cuota);
    } else if (codVar === 'FALLO_CAJ') {
      empleadoAjustado.adicionalCargo = roundGs((empleadoAjustado.adicionalCargo || 0) + cuota);
    } else if (n.subtipo === 'bonificacion_extraordinaria' || ['BF_MAN', 'BF_MANCO'].includes(codVar)) {
      empleadoAjustado.bonificaciones = roundGs((empleadoAjustado.bonificaciones || 0) + cuota);
    } else if (
      n.conceptoClave === 'refrigerioTraslado' ||
      n.tipo === 'refrigerio_traslado' ||
      n.subtipo === 'refrigerio_viatico' ||
      ['REFRIGERIO', 'REFRI', 'VIATI', 'VARYREF'].includes(codVar)
    ) {
      empleadoAjustado.refrigerioTraslado = roundGs((empleadoAjustado.refrigerioTraslado || 0) + cuota);
    } else {
      empleadoAjustado.adicionalCargo = roundGs((empleadoAjustado.adicionalCargo || 0) + cuota);
    }

    totalHaberes = roundGs(totalHaberes + cuota);
    const saldoAnterior = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : cuota;
    const saldoNuevo = typeof n.saldoPendiente === 'number' ? Math.max(0, roundGs(saldoAnterior - cuota)) : saldoAnterior;

    desgloses.push({
      novedadId: n.id,
      tipo: n.tipo,
      montoDescontado: cuota,
      saldoAnterior,
      saldoNuevo,
      saldadoTotalmente: typeof n.saldoPendiente === 'number' && saldoNuevo <= 0,
    });
  }

  // ── 1. ANTICIPOS MENSUALES RECURRENTES ──
  const anticipos = activas.filter(
    (n) => n.tipo === 'anticipo_recurrente' || n.subtipo === 'anticipo_salario',
  );
  for (const n of anticipos) {
    let cuota = 0;
    if (n.modalidadCalculo === 'porcentaje_variable' && typeof n.porcentajeVariable === 'number') {
      const pct = Math.max(0, Math.min(100, n.porcentajeVariable)) / 100;
      cuota = roundGs(baseImponible * pct);
    } else {
      cuota = Math.max(0, roundGs(n.cuotaMensual ?? n.montoOriginal ?? 0));
    }

    if (typeof n.saldoPendiente === 'number' && n.saldoPendiente > 0) {
      cuota = Math.min(cuota, n.saldoPendiente);
    }

    if (cuota <= 0) continue;

    empleadoAjustado.anticipoSalario = roundGs((empleadoAjustado.anticipoSalario || 0) + cuota);
    totalAnticipos = roundGs(totalAnticipos + cuota);

    const saldoAnterior = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : cuota;
    const saldoNuevo = typeof n.saldoPendiente === 'number' ? Math.max(0, roundGs(saldoAnterior - cuota)) : cuota;
    const saldadoTotalmente = typeof n.saldoPendiente === 'number' && saldoNuevo <= 0;

    desgloses.push({
      novedadId: n.id,
      tipo: n.tipo,
      montoDescontado: cuota,
      saldoAnterior,
      saldoNuevo,
      saldadoTotalmente,
    });
  }

  // ── 2. PRÉSTAMOS DE EMPRESA (CON CUOTA Y SALDO DECRECIENTE) ──
  const prestamos = activas.filter(
    (n) => n.tipo === 'prestamo_empresa' || n.subtipo === 'prestamo_empresa',
  );
  for (const n of prestamos) {
    const saldo = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : (n.montoOriginal ?? 0);
    if (saldo <= 0) continue;

    let cuota = 0;
    if (n.modalidadCalculo === 'porcentaje_variable' && typeof n.porcentajeVariable === 'number') {
      const pct = Math.max(0, Math.min(100, n.porcentajeVariable)) / 100;
      cuota = roundGs(baseImponible * pct);
    } else {
      cuota = Math.max(0, roundGs(n.cuotaMensual ?? saldo));
    }

    const montoDescontar = Math.min(cuota, saldo);
    if (montoDescontar <= 0) continue;

    empleadoAjustado.prestamosEmpresa = roundGs((empleadoAjustado.prestamosEmpresa || 0) + montoDescontar);
    totalPrestamos = roundGs(totalPrestamos + montoDescontar);

    const saldoNuevo = Math.max(0, roundGs(saldo - montoDescontar));
    desgloses.push({
      novedadId: n.id,
      tipo: n.tipo,
      montoDescontado: montoDescontar,
      saldoAnterior: saldo,
      saldoNuevo,
      saldadoTotalmente: saldoNuevo <= 0,
    });
  }

  // ── 3. COLA DE EMBARGOS JUDICIALES (FIFO / PRIORIDAD + TOPE 25%) ──
  const embargos = activas
    .filter((n) => n.tipo === 'embargo_judicial' || n.subtipo === 'embargo_judicial')
    .filter((n) => {
      const saldo = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : (n.montoOriginal ?? 0);
      return saldo > 0;
    })
    .sort((a, b) => {
      const pa = a.prioridad ?? 1;
      const pb = b.prioridad ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.fechaCreacion || '').localeCompare(b.fechaCreacion || '');
    });

  const topeGlobalAcumulado = calcularTopeLegalEmbargos(baseImponible, TOPE_LEGAL_EMBARGOS);
  let cupoRestanteMes = topeGlobalAcumulado;

  for (const emb of embargos) {
    if (cupoRestanteMes <= 0) break;

    const saldo = typeof emb.saldoPendiente === 'number' ? emb.saldoPendiente : (emb.montoOriginal ?? 0);
    if (saldo <= 0) continue;

    // Calcular tope del oficio según porcentaje configurado o legal 25%
    const pctOficio =
      emb.modalidadCalculo === 'porcentaje_variable' && typeof emb.porcentajeVariable === 'number'
        ? Math.min(emb.porcentajeVariable / 100, TOPE_LEGAL_EMBARGOS)
        : (emb.porcentajeTope ?? TOPE_LEGAL_EMBARGOS);

    const topeIndividual = calcularTopeLegalEmbargos(baseImponible, pctOficio);

    // Si tiene cuota fija definida en modalidad fija, no superar cuota
    let montoMaximoPermitido = Math.min(saldo, topeIndividual, cupoRestanteMes);
    if (emb.modalidadCalculo === 'monto_fijo' && emb.cuotaMensual && emb.cuotaMensual > 0) {
      montoMaximoPermitido = Math.min(montoMaximoPermitido, emb.cuotaMensual);
    }

    const montoDescontar = roundGs(montoMaximoPermitido);
    if (montoDescontar <= 0) continue;

    cupoRestanteMes = Math.max(0, cupoRestanteMes - montoDescontar);
    empleadoAjustado.embargosJudiciales = roundGs((empleadoAjustado.embargosJudiciales || 0) + montoDescontar);
    totalEmbargos = roundGs(totalEmbargos + montoDescontar);

    const saldoNuevo = Math.max(0, roundGs(saldo - montoDescontar));
    desgloses.push({
      novedadId: emb.id,
      tipo: emb.tipo,
      montoDescontado: montoDescontar,
      saldoAnterior: saldo,
      saldoNuevo,
      saldadoTotalmente: saldoNuevo <= 0,
    });
  }

  // ── 4. DEDUCCIONES FIJAS RECURRENTES (SEGURO, EQUIPOS, OTROS) ──
  const deduccionesFijas = activas.filter(
    (n) =>
      ['seguro_medico', 'cuota_equipo', 'otro_descuento_fijo'].includes(n.tipo) ||
      (n.tipoConcepto === 'descuento' &&
        n.tipo !== 'embargo_judicial' &&
        n.tipo !== 'anticipo_recurrente' &&
        n.tipo !== 'prestamo_empresa' &&
        n.subtipo !== 'embargo_judicial' &&
        n.subtipo !== 'anticipo_salario' &&
        n.subtipo !== 'prestamo_empresa'),
  );

  for (const n of deduccionesFijas) {
    let cuota = 0;
    if (n.modalidadCalculo === 'porcentaje_variable' && typeof n.porcentajeVariable === 'number') {
      const pct = Math.max(0, Math.min(100, n.porcentajeVariable)) / 100;
      cuota = roundGs(baseImponible * pct);
    } else {
      cuota = Math.max(0, roundGs(n.cuotaMensual ?? n.montoOriginal ?? 0));
    }

    const saldo = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : (n.montoOriginal ?? cuota);
    if (typeof n.saldoPendiente === 'number' && n.saldoPendiente > 0) {
      cuota = Math.min(cuota, n.saldoPendiente);
    }

    if (cuota <= 0) continue;

    const codVar = (n.codigoVariable || '').trim().toUpperCase();
    if (
      n.tipo === 'seguro_medico' ||
      n.subtipo === 'seguro_medico' ||
      ['ASISMED', 'IMPPLAN'].includes(codVar)
    ) {
      empleadoAjustado.seguroMedicoPrivado = roundGs((empleadoAjustado.seguroMedicoPrivado || 0) + cuota);
    } else if (n.tipo === 'cuota_equipo' || codVar === 'DESC_CEL') {
      empleadoAjustado.telefonoNotebook = roundGs((empleadoAjustado.telefonoNotebook || 0) + cuota);
    } else if (codVar === 'FALCAJ') {
      empleadoAjustado.faltanteCaja = roundGs((empleadoAjustado.faltanteCaja || 0) + cuota);
    } else if (['FALMER', 'FALTRA', 'DTOMER'].includes(codVar)) {
      empleadoAjustado.faltanteMercaderia = roundGs((empleadoAjustado.faltanteMercaderia || 0) + cuota);
    } else if (['MER1', 'MER2', 'MER3'].includes(codVar)) {
      empleadoAjustado.compraCreditoEmpresa = roundGs((empleadoAjustado.compraCreditoEmpresa || 0) + cuota);
    } else {
      empleadoAjustado.otrosDescuentos = roundGs((empleadoAjustado.otrosDescuentos || 0) + cuota);
    }

    totalOtros = roundGs(totalOtros + cuota);
    const saldoNuevo = typeof n.saldoPendiente === 'number' ? Math.max(0, roundGs(saldo - cuota)) : saldo;

    desgloses.push({
      novedadId: n.id,
      tipo: n.tipo,
      montoDescontado: cuota,
      saldoAnterior: saldo,
      saldoNuevo,
      saldadoTotalmente: typeof n.saldoPendiente === 'number' && saldoNuevo <= 0,
    });
  }

  return {
    empleado: empleadoAjustado,
    desgloses,
    totalEmbargosAplicados: totalEmbargos,
    totalAnticiposAplicados: totalAnticipos,
    totalPrestamosAplicados: totalPrestamos,
    totalOtrosDescuentosAplicados: totalOtros,
    totalHaberesAdicionalesAplicados: totalHaberes,
  };
}

/**
 * Aplica novedades a la plantilla completa de funcionarios.
 */
export function aplicarNovedadesANominaCompleta(
  empleados: EmpleadoNominaInput[],
  novedades: NovedadPersonal[],
  periodoId?: string,
  tipoLiquidacionCodigo: CodigoLiquidacionImpacto = 'MEN',
): {
  empleadosActualizados: EmpleadoNominaInput[];
  desglosesPorCi: Record<string, DesgloseNovedadAplicada[]>;
  todosLosDesgloses: DesgloseNovedadAplicada[];
} {
  const porCi = new Map<string, NovedadPersonal[]>();
  for (const n of novedades) {
    if (!n.activo) continue;
    const ciKey = n.ci.trim();
    const list = porCi.get(ciKey) ?? [];
    list.push(n);
    porCi.set(ciKey, list);
  }

  const empleadosActualizados: EmpleadoNominaInput[] = [];
  const desglosesPorCi: Record<string, DesgloseNovedadAplicada[]> = {};
  const todosLosDesgloses: DesgloseNovedadAplicada[] = [];

  for (const emp of empleados) {
    const novedadesDelEmp = porCi.get(emp.ci.trim()) ?? [];
    const res = aplicarNovedadesAEmpleado(emp, novedadesDelEmp, undefined, periodoId, tipoLiquidacionCodigo);
    empleadosActualizados.push(res.empleado);
    desglosesPorCi[emp.ci] = res.desgloses;
    todosLosDesgloses.push(...res.desgloses);
  }

  return {
    empleadosActualizados,
    desglosesPorCi,
    todosLosDesgloses,
  };
}

/**
 * Procesa la amortización contable al cerrar el período:
 * Reduce saldos pendientes de embargos y préstamos. Si el saldo llega a 0,
 * desactiva la novedad y registra su fecha de finalización.
 */
export function procesarAmortizacionCierrePeriodo(
  novedades: NovedadPersonal[],
  desgloses: DesgloseNovedadAplicada[],
): NovedadPersonal[] {
  const amortizadoPorId = new Map<string, number>();
  for (const d of desgloses) {
    amortizadoPorId.set(
      d.novedadId,
      roundGs((amortizadoPorId.get(d.novedadId) ?? 0) + d.montoDescontado),
    );
  }

  const ahoraIso = new Date().toISOString();

  return novedades.map((n) => {
    const amortizado = amortizadoPorId.get(n.id);
    const tieneSaldo = typeof n.saldoPendiente === 'number';
    const esTipoAmortizable = n.tipo === 'embargo_judicial' || n.tipo === 'prestamo_empresa';

    if (!amortizado || (!tieneSaldo && !esTipoAmortizable)) {
      return n;
    }

    const saldoAnterior = typeof n.saldoPendiente === 'number' ? n.saldoPendiente : (n.montoOriginal ?? 0);
    const saldoNuevo = Math.max(0, roundGs(saldoAnterior - amortizado));
    const saldado = saldoNuevo <= 0;

    return {
      ...n,
      saldoPendiente: saldoNuevo,
      activo: saldado ? false : n.activo,
      fechaFinalizacion: saldado ? n.fechaFinalizacion ?? ahoraIso : n.fechaFinalizacion,
    };
  });
}
