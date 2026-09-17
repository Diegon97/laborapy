/**
 * SERVICIO DE CUMPLIMIENTO LEGAL Y CIERRE DE NÓMINA (LABORAPY)
 * Impacto en IPS REI, MTESS REOP (Resolución 820/2019) y advertencias por régimen.
 */
import type { PeriodoNomina, TipoLiquidacion, MonedaNomina } from '../types/noveltyTypes';
import type { LiquidacionMensualResult } from '../types';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { roundGs } from '../engine/monthlyPayrollEngine';

export interface PlazoLegalItem {
  entidad: 'IPS' | 'MTESS';
  concepto: string;
  diasPlazo: number;
  tipoPlazo: 'habiles' | 'corridos';
  fechaLimite: string;
  baseLegal: string;
}

export interface ReporteBajaREI {
  funcionario: {
    ci: string;
    nombre: string;
    fechaEgreso: string;
    motivoEgreso: string;
    codigoEgresoIPS: string;
  };
  salarioImponible: number;
  aporteObrero9: number;
  aportePatronal165: number;
  totalAporteIps: number;
  plazoVencimiento: string;
}

export interface ConstanciaMTESS {
  nroDocumento: string;
  fechaEmision: string;
  empleado: string;
  ci: string;
  motivo: string;
  plazoPresentacionReop: string;
  baseLegal: string;
}

export interface ResumenFinancieroCierre {
  cantidadLiquidaciones: number;
  totalHaberes: number;
  totalDescuentos: number;
  totalNeto: number;
  totalImponibleIps: number;
  totalAporteObrero9: number;
  totalAportePatronal165: number;
  totalAporteIps255: number;
}

export interface ImpactoCierreLegal {
  periodoId: string;
  tipoLiquidacion: TipoLiquidacion;
  moneda: MonedaNomina;
  resumenFinanciero: ResumenFinancieroCierre;
  plazosLegales: PlazoLegalItem[];
  reporteBajaREI?: ReporteBajaREI;
  constanciaMTESS?: ConstanciaMTESS;
  advertencias: string[];
}

export type CodigoEgresoIPS = '01' | '02' | '03';

export function addBusinessDays(startDateStr: string, days: number): string {
  const parts = (startDateStr || '').slice(0, 10).split('-');
  if (parts.length !== 3) return startDateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return startDateStr;

  let added = 0;
  const step = days >= 0 ? 1 : -1;
  const target = Math.abs(days);
  while (added < target) {
    d.setDate(d.getDate() + step);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(startDateStr: string, days: number): string {
  const parts = (startDateStr || '').slice(0, 10).split('-');
  if (parts.length !== 3) return startDateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return startDateStr;
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function determinarCodigoEgresoIPS(motivo?: string): CodigoEgresoIPS {
  if (!motivo || !motivo.trim()) return '01';
  const m = motivo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/\binjustificad/.test(m) || /\bno\s+justificad/.test(m)) return '03';
  if (m.includes('renuncia') || m.includes('retiro voluntario')) return '01';
  if (m.includes('mutuo') || m.includes('acuerdo')) return '03';
  if (m.includes('justificad')) return '02';
  return '01';
}

export function generarImpactoCierreLegal(
  periodo: PeriodoNomina,
  liquidaciones: LiquidacionMensualResult[],
  _empresa?: EmpresaCliente
): ImpactoCierreLegal {
  const tipo = (periodo.tipoLiquidacion || 'mensual_ips') as TipoLiquidacion;
  const moneda = (periodo.moneda || (tipo === 'moneda_usd' ? 'USD' : 'PYG')) as MonedaNomina;
  const advertencias: string[] = [];
  const plazosLegales: PlazoLegalItem[] = [];

  const totalHaberes = roundGs(liquidaciones.reduce((acc, l) => acc + (l.haberes?.totalHaberesBrutos || 0), 0));
  const totalDescuentos = roundGs(liquidaciones.reduce((acc, l) => acc + (l.descuentos?.totalDescuentos || 0), 0));
  const totalNeto = roundGs(liquidaciones.reduce((acc, l) => acc + (l.netoACobrar || 0), 0));
  const totalImponibleIps = roundGs(liquidaciones.reduce((acc, l) => acc + (l.haberesImponiblesIps || 0), 0));
  const totalAporteObrero9 = roundGs(liquidaciones.reduce((acc, l) => acc + (l.descuentos?.aporteObreroIps || 0), 0));
  const totalAportePatronal165 = roundGs(liquidaciones.reduce((acc, l) => acc + (l.aportePatronalIps || roundGs(l.haberesImponiblesIps * 0.165)), 0));
  const totalAporteIps255 = roundGs(totalAporteObrero9 + totalAportePatronal165);

  const resumenFinanciero: ResumenFinancieroCierre = {
    cantidadLiquidaciones: liquidaciones.length,
    totalHaberes,
    totalDescuentos,
    totalNeto,
    totalImponibleIps,
    totalAporteObrero9,
    totalAportePatronal165,
    totalAporteIps255,
  };

  let reporteBajaREI: ReporteBajaREI | undefined;
  let constanciaMTESS: ConstanciaMTESS | undefined;

  switch (tipo) {
    case 'liquidacion_final': {
      const salida = periodo.empleadoSalida;
      const liqSalida = liquidaciones[0];
      const ci = salida?.ci || liqSalida?.input?.ci || '0000000';
      const nombre = salida?.nombre || liqSalida?.input?.nombre || 'Funcionario';
      const fechaEgreso = salida?.fechaEgreso || new Date().toISOString().split('T')[0];
      const motivo = salida?.motivo || 'Despido / Salida';
      const codigoIPS = determinarCodigoEgresoIPS(motivo);

      const salarioImponible = liqSalida?.haberesImponiblesIps || totalImponibleIps;
      const aporteObrero = liqSalida?.descuentos?.aporteObreroIps || totalAporteObrero9;
      const aportePatronal = roundGs(salarioImponible * 0.165);
      const fechaLimiteRei = addBusinessDays(fechaEgreso, 3);
      const fechaLimiteMtess = addCalendarDays(fechaEgreso, 30);

      reporteBajaREI = {
        funcionario: { ci, nombre, fechaEgreso, motivoEgreso: motivo, codigoEgresoIPS: codigoIPS },
        salarioImponible,
        aporteObrero9: aporteObrero,
        aportePatronal165: aportePatronal,
        totalAporteIps: roundGs(aporteObrero + aportePatronal),
        plazoVencimiento: fechaLimiteRei,
      };

      constanciaMTESS = {
        nroDocumento: `MTESS-REOP-${periodo.anio}-${ci}`,
        fechaEmision: fechaEgreso,
        empleado: nombre,
        ci,
        motivo,
        plazoPresentacionReop: fechaLimiteMtess,
        baseLegal: 'Resolución MTESS N° 820/2019',
      };

      plazosLegales.push({
        entidad: 'IPS',
        concepto: 'Comunicación de Baja en Sistema REI (3 días hábiles)',
        diasPlazo: 3,
        tipoPlazo: 'habiles',
        fechaLimite: fechaLimiteRei,
        baseLegal: 'Reglamento General IPS REI · Decreto-Ley N° 1860/50',
      });
      plazosLegales.push({
        entidad: 'MTESS',
        concepto: 'Registro de Egreso en Portal REOP (30 días corridos)',
        diasPlazo: 30,
        tipoPlazo: 'corridos',
        fechaLimite: fechaLimiteMtess,
        baseLegal: 'Resolución MTESS N° 820/2019',
      });
      break;
    }

    case 'facturacion_honorarios':
      advertencias.push('Prestación de servicios con factura: no sujeto a retenciones ni aportes IPS según Ley 213/93.');
      break;

    case 'moneda_usd':
      advertencias.push('Nómina pactada en USD: aportes IPS deben cotizarse al tipo de cambio interbancario BCP de la fecha de pago.');
      plazosLegales.push({
        entidad: 'IPS',
        concepto: 'Presentación de Planilla y Pago Aportes IPS en Guaraníes (día 15)',
        diasPlazo: 15,
        tipoPlazo: 'corridos',
        fechaLimite: `${periodo.anio}-${String(periodo.mes === 12 ? 1 : periodo.mes + 1).padStart(2, '0')}-15`,
        baseLegal: 'Ley N° 98/92 y Reglamento de Aporte Obrero Patronal IPS',
      });
      break;

    case 'mensual_ips':
    default:
      plazosLegales.push({
        entidad: 'IPS',
        concepto: 'Presentación de Planilla de Salarios y Pago Aportes REI (día 15)',
        diasPlazo: 15,
        tipoPlazo: 'corridos',
        fechaLimite: `${periodo.anio}-${String(periodo.mes === 12 ? 1 : periodo.mes + 1).padStart(2, '0')}-15`,
        baseLegal: 'Reglamento General IPS REI · Decreto-Ley N° 1860/50',
      });
      break;
  }

  return {
    periodoId: periodo.id,
    tipoLiquidacion: tipo,
    moneda,
    resumenFinanciero,
    plazosLegales,
    reporteBajaREI,
    constanciaMTESS,
    advertencias,
  };
}
