/**
 * MOTOR DE CONTABILIDAD Y ASIENTO GENERAL CONSOLIDADO DE NÓMINA (LABORAPY)
 *
 * Consolida la totalidad de haberes, descuentos, aportes IPS (obrero 9% y patronal 16.5%),
 * retenciones fiscales DNIT y pasivos netos a pagar al cierre del período mensual.
 *
 * Cumple estrictamente la partida doble: Total Debe === Total Haber (Diferencia = 0 Gs.).
 * Compatible con Odoo, SAP Business One, ERPs locales y estándares IFRS / DNIT.
 */

import type { TotalesNominaMasiva, LiquidacionMensualResult } from '../types';
import type { LiquidacionInput, LiquidacionResult } from '../../payroll/types';
import type {
  PlanDeCuentasNomina,
  AsientoContableGeneral,
  LineaAsientoContable,
  OpcionesAsientoNomina,
  CuentaContableConfig,
} from '../types/accountingTypes';
import { roundGs } from './monthlyPayrollEngine';

/**
 * Plan de cuentas contable por defecto para nómina paraguaya (DNIT / NIIF)
 */
export const DEFAULT_CHART_OF_ACCOUNTS: PlanDeCuentasNomina = {
  // ── DEBE: Gastos de Personal y Cargas Sociales ──
  salario_base: {
    id: 'salario_base',
    codigo: '6.1.1.01.01',
    nombre: 'Sueldos y Jornales',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Remuneraciones base por días trabajados en el mes (cotizantes dependientes)',
  },
  adicional_cargo: {
    id: 'adicional_cargo',
    codigo: '6.1.1.01.02',
    nombre: 'Adicional por Cargo y Responsabilidad',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Plus por cargo, función directiva o remuneración variable',
  },
  horas_extras: {
    id: 'horas_extras',
    codigo: '6.1.1.01.03',
    nombre: 'Horas Extraordinarias y Feriados',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Recargos legales diurnos (50%), nocturnos (30%), feriados (100%) y mixtos (130%)',
  },
  vacaciones: {
    id: 'vacaciones',
    codigo: '6.1.1.01.04',
    nombre: 'Vacaciones Causadas y Pagadas',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Remuneración de días de descanso anual remunerado (Art. 218 CT)',
  },
  reposo_empresa: {
    id: 'reposo_empresa',
    codigo: '6.1.1.01.05',
    nombre: 'Subsidio por Reposo Cargo Empresa (50%)',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Abono patronal del 50% por días de reposo médico del personal',
  },
  bonificacion_familiar: {
    id: 'bonificacion_familiar',
    codigo: '6.1.1.01.06',
    nombre: 'Bonificación Familiar (Art. 261 CT)',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Asignación legal del 5% del SMLV por hijo, no sujeta a descuentos previsionales',
  },
  refrigerio_traslado: {
    id: 'refrigerio_traslado',
    codigo: '6.1.1.01.07',
    nombre: 'Refrigerio, Viáticos y Traslado',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Subsidios no remunerativos para almuerzo, transporte y viáticos operativos',
  },
  honorarios_factura: {
    id: 'honorarios_factura',
    codigo: '6.1.2.01.01',
    nombre: 'Honorarios Profesionales y Servicios Facturados',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Servicios contratados independientes con factura legal e IVA incluido',
  },
  ips_patronal: {
    id: 'ips_patronal',
    codigo: '6.1.1.02.01',
    nombre: 'Cargas Sociales - Aporte Patronal IPS (16.5%)',
    naturaleza: 'DEBE',
    categoria: 'cargas_sociales',
    descripcion: 'Costo patronal previsional obligatorio sobre haberes imponibles (Decreto-Ley 1860/50)',
  },
  provision_aguinaldo: {
    id: 'provision_aguinaldo',
    codigo: '6.1.1.02.02',
    nombre: 'Gastos de Personal - Provisión Aguinaldo (1/12)',
    naturaleza: 'DEBE',
    categoria: 'cargas_sociales',
    descripcion: 'Devengamiento mensual de la doceava parte del salario anual complementario (Art. 243 CT)',
  },
  indemnizacion_despido: {
    id: 'indemnizacion_despido',
    codigo: '6.1.1.01.08',
    nombre: 'Indemnización por Despido (Art. 91 CT)',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Compensación legal por antigüedad en despido injustificado o retiro justificado',
  },
  preaviso_omitido: {
    id: 'preaviso_omitido',
    codigo: '6.1.1.01.09',
    nombre: 'Preaviso Omitido (Art. 92 CT)',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Indemnización compensatoria sustitutiva del preaviso legal no otorgado',
  },

  // ── HABER: Pasivos Laborales, Previsionales, Fiscales y Regularizadoras ──
  sueldos_a_pagar: {
    id: 'sueldos_a_pagar',
    codigo: '2.1.2.01.01',
    nombre: 'Sueldos y Jornales a Pagar (Cotizantes)',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Pasivo exigible: neto líquido a desembolsar a empleados dependientes bancarizados o en efectivo',
  },
  liquidaciones_a_pagar: {
    id: 'liquidaciones_a_pagar',
    codigo: '2.1.2.01.03',
    nombre: 'Liquidaciones y Finiquitos a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Pasivo exigible por finiquito o liquidación final de haberes del personal',
  },
  honorarios_a_pagar: {
    id: 'honorarios_a_pagar',
    codigo: '2.1.2.01.02',
    nombre: 'Honorarios y Servicios a Pagar (Facturas)',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Pasivo exigible: importe neto a transferir a prestadores con factura tras retención',
  },
  ips_a_pagar: {
    id: 'ips_a_pagar',
    codigo: '2.1.2.02.01',
    nombre: 'Aportes y Retenciones IPS a Pagar (25.5%)',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Total consolidado a abonar a IPS: Obrero 9% + Patronal 16.5%',
  },
  retencion_iva_a_pagar: {
    id: 'retencion_iva_a_pagar',
    codigo: '2.1.3.01.01',
    nombre: 'Retenciones de IVA a Pagar (30% DNIT)',
    naturaleza: 'HABER',
    categoria: 'pasivo_fiscal',
    descripcion: 'Retenciones practicadas sobre el IVA a ingresar a la DNIT mediante comprobante virtual',
  },
  descuento_ausencias: {
    id: 'descuento_ausencias',
    codigo: '6.1.1.01.99',
    nombre: 'Recupero / Regularización Días de Ausencia',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
    descripcion: 'Descuento de salario base por días de ausencia, suspensión o permisos no remunerados',
  },
  anticipos_sueldo: {
    id: 'anticipos_sueldo',
    codigo: '1.1.2.03.01',
    nombre: 'Anticipos de Sueldos al Personal',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
    descripcion: 'Descargo de los anticipos concedidos en quincena debitados previamente al activo',
  },
  prestamos_empresa: {
    id: 'prestamos_empresa',
    codigo: '1.1.2.03.02',
    nombre: 'Préstamos al Personal',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
    descripcion: 'Amortización de cuotas de préstamos otorgados por la empresa',
  },
  embargos_judiciales_a_pagar: {
    id: 'embargos_judiciales_a_pagar',
    codigo: '2.1.2.03.01',
    nombre: 'Retenciones Judiciales a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Fondos retenidos por orden judicial de juzgados civiles o de la niñez para transferencia',
  },
  seguro_medico_a_pagar: {
    id: 'seguro_medico_a_pagar',
    codigo: '2.1.2.03.02',
    nombre: 'Retenciones Seguro Médico Privado a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Retenciones corporativas para pago de primas a seguros médicos privados',
  },
  faltante_caja: {
    id: 'faltante_caja',
    codigo: '1.1.1.01.99',
    nombre: 'Recupero Faltantes de Caja',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
    descripcion: 'Deducciones salariales para compensar diferencias en arqueos de cajeros',
  },
  faltante_mercaderia: {
    id: 'faltante_mercaderia',
    codigo: '1.1.3.01.99',
    nombre: 'Recupero Faltantes de Mercadería',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
    descripcion: 'Deducciones salariales para compensar mermas o pérdidas imputables en inventario',
  },
  telefono_notebook: {
    id: 'telefono_notebook',
    codigo: '1.1.2.03.03',
    nombre: 'Cuentas Corrientes Personal - Equipos',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
    descripcion: 'Cuotas de adquisición o recambio de teléfonos, notebooks y accesorios',
  },
  compra_credito_empresa: {
    id: 'compra_credito_empresa',
    codigo: '1.1.2.03.04',
    nombre: 'Cuentas Corrientes Personal - Compras Internas',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
    descripcion: 'Deducciones por compras a crédito en las tiendas o negocios de la empresa',
  },
  otros_descuentos: {
    id: 'otros_descuentos',
    codigo: '2.1.2.03.99',
    nombre: 'Otras Retenciones y Descuentos a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Aportes a mutuales, fondos de ayuda mutua, donaciones sindicales u otros',
  },
  provision_aguinaldo_a_pagar: {
    id: 'provision_aguinaldo_a_pagar',
    codigo: '2.1.2.02.03',
    nombre: 'Provisión para Aguinaldo a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
    descripcion: 'Pasivo laboral acumulado para el desembolso del aguinaldo en diciembre',
  },
};

/**
 * Plan de cuentas oficial corporativo para nómina paraguaya (ML y ME - Dólares)
 */
export const ENTERPRISE_CHART_OF_ACCOUNTS: PlanDeCuentasNomina = {
  salario_base: {
    id: 'salario_base',
    codigo: '4020102',
    nombre: 'Sueldos y Jornales',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
    descripcion: 'Sueldos, jornales y salarios base del personal dependiente',
  },
  adicional_cargo: {
    id: 'adicional_cargo',
    codigo: '4020102',
    nombre: 'Sueldos y Jornales - Adicionales',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  horas_extras: {
    id: 'horas_extras',
    codigo: '4020105',
    nombre: 'Horas Extras',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  vacaciones: {
    id: 'vacaciones',
    codigo: '4020109',
    nombre: 'Vacaciones',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  reposo_empresa: {
    id: 'reposo_empresa',
    codigo: '4020102',
    nombre: 'Sueldos y Jornales - Reposos',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  bonificacion_familiar: {
    id: 'bonificacion_familiar',
    codigo: '4020122',
    nombre: 'Bonificacion Familiar',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  refrigerio_traslado: {
    id: 'refrigerio_traslado',
    codigo: '4020102',
    nombre: 'Sueldos y Jornales - Refrigerios y Viaticos',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  honorarios_factura: {
    id: 'honorarios_factura',
    codigo: '4100101',
    nombre: 'Honorarios Profesionales',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  ips_patronal: {
    id: 'ips_patronal',
    codigo: '4020114',
    nombre: 'IPS - Aporte Patronal',
    naturaleza: 'DEBE',
    categoria: 'cargas_sociales',
  },
  provision_aguinaldo: {
    id: 'provision_aguinaldo',
    codigo: '4020104',
    nombre: 'Aguinaldos',
    naturaleza: 'DEBE',
    categoria: 'cargas_sociales',
  },
  indemnizacion_despido: {
    id: 'indemnizacion_despido',
    codigo: '4020110',
    nombre: 'Indemnizacion por Despido',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  preaviso_omitido: {
    id: 'preaviso_omitido',
    codigo: '4020108',
    nombre: 'Preaviso Omitido',
    naturaleza: 'DEBE',
    categoria: 'gasto_personal',
  },
  sueldos_a_pagar: {
    id: 'sueldos_a_pagar',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  liquidaciones_a_pagar: {
    id: 'liquidaciones_a_pagar',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML - Liquidaciones Finales',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  sueldos_a_pagar_usd: {
    id: 'sueldos_a_pagar_usd',
    codigo: '2010615',
    nombre: 'Nominas a Pagar ME',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  honorarios_a_pagar: {
    id: 'honorarios_a_pagar',
    codigo: '4100101',
    nombre: 'Honorarios Profesionales a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  ips_a_pagar: {
    id: 'ips_a_pagar',
    codigo: '2010601',
    nombre: 'IPS a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  retencion_iva_a_pagar: {
    id: 'retencion_iva_a_pagar',
    codigo: '4100101',
    nombre: 'Retencion IVA a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_fiscal',
  },
  descuento_ausencias: {
    id: 'descuento_ausencias',
    codigo: '4020102',
    nombre: 'Sueldos y Jornales - Descuento Ausencias',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
  },
  anticipos_sueldo: {
    id: 'anticipos_sueldo',
    codigo: '1020315',
    nombre: 'Anticipos al Personal',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  anticipos_sueldo_usd: {
    id: 'anticipos_sueldo_usd',
    codigo: '1020317',
    nombre: 'Anticipos al Pnal. U$',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  prestamos_empresa: {
    id: 'prestamos_empresa',
    codigo: '1020314',
    nombre: 'Prestamo al Pna. c/Pagare',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  prestamos_empresa_usd: {
    id: 'prestamos_empresa_usd',
    codigo: '1020316',
    nombre: 'Prestamos al Pnal USD',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  embargos_judiciales_a_pagar: {
    id: 'embargos_judiciales_a_pagar',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML - Retenciones Judiciales',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  seguro_medico_a_pagar: {
    id: 'seguro_medico_a_pagar',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML - Seguro Medico',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  faltante_caja: {
    id: 'faltante_caja',
    codigo: '1020315',
    nombre: 'Anticipos al Personal - Faltante Caja',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
  },
  faltante_mercaderia: {
    id: 'faltante_mercaderia',
    codigo: '1020315',
    nombre: 'Anticipos al Personal - Faltante Mercaderia',
    naturaleza: 'HABER',
    categoria: 'regularizadora',
  },
  telefono_notebook: {
    id: 'telefono_notebook',
    codigo: '1020315',
    nombre: 'Anticipos al Personal - Cuota Telefonos',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  compra_credito_empresa: {
    id: 'compra_credito_empresa',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML - Compras Internas',
    naturaleza: 'HABER',
    categoria: 'activo_personal',
  },
  otros_descuentos: {
    id: 'otros_descuentos',
    codigo: '2010614',
    nombre: 'Nominas a Pagar ML - Otros Descuentos',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  provision_aguinaldo_a_pagar: {
    id: 'provision_aguinaldo_a_pagar',
    codigo: '2010603',
    nombre: 'Aguinaldos a Pagar',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
  provision_aguinaldo_a_pagar_usd: {
    id: 'provision_aguinaldo_a_pagar_usd',
    codigo: '2010616',
    nombre: 'Aguinaldos a pagar M/E',
    naturaleza: 'HABER',
    categoria: 'pasivo_laboral',
  },
};

/**
 * Genera el Asiento Contable General Consolidado de la liquidación de nómina.
 * Garantiza cuadratura estricta: Total Debe === Total Haber.
 */
export function generarAsientoContableNomina(
  totales: TotalesNominaMasiva,
  liquidaciones: LiquidacionMensualResult[],
  periodoKey: string,
  configCuentas?: Partial<PlanDeCuentasNomina>,
  metadataEmpresa?: { id: string; nombre: string; ruc: string },
  opciones?: OpcionesAsientoNomina,
): AsientoContableGeneral {
  const chart: PlanDeCuentasNomina = {
    ...DEFAULT_CHART_OF_ACCOUNTS,
    ...(configCuentas || {}),
  } as PlanDeCuentasNomina;

  const incluirProvision = opciones?.incluirProvisionAguinaldo ?? true;
  const fechaAsiento =
    opciones?.fechaContable ||
    (() => {
      // Por defecto, último día del mes del período (YYYY-MM)
      const parts = periodoKey.split('-');
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m)) {
          const ultimoDia = new Date(y, m, 0).getDate();
          return `${y}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        }
      }
      return new Date().toISOString().slice(0, 10);
    })();

  // ── Acumuladores de Haberes (DEBE) ──
  let debeSalarioBase = 0;
  let debeAdicionalCargo = 0;
  let debeHorasExtras = 0;
  let debeVacaciones = 0;
  let debeReposoEmpresa = 0;
  let debeBonificacionFamiliar = 0;
  let debeRefrigerio = 0;
  let debeHonorariosFactura = 0;
  let debeProvisionAguinaldo = 0;

  // ── Acumuladores de Descuentos y Pasivos (HABER) ──
  let haberSueldosPagar = 0;
  let haberHonorariosPagar = 0;
  let haberDescuentoAusencias = 0;
  let haberAnticipos = 0;
  let haberPrestamos = 0;
  let haberEmbargos = 0;
  let haberSeguro = 0;
  let haberFaltanteCaja = 0;
  let haberFaltanteMercaderia = 0;
  let haberTelefonoNotebook = 0;
  let haberCompraCredito = 0;
  let haberOtrosDescuentos = 0;

  let totalCotizantes = 0;
  let totalFacturadores = 0;

  // Procesar liquidaciones individuales
  liquidaciones.forEach((liq) => {
    const esFactura = liq.input.tipo === 'factura';

    if (esFactura) {
      totalFacturadores++;
      debeHonorariosFactura += liq.haberes.totalHaberesBrutos;
      haberHonorariosPagar += liq.netoACobrar;
    } else {
      totalCotizantes++;
      debeSalarioBase += liq.haberes.salarioBaseDiasTrabajados;
      debeAdicionalCargo += liq.haberes.adicionalCargo;
      debeHorasExtras +=
        liq.haberes.montoHoras50 +
        liq.haberes.montoHoras130 +
        liq.haberes.montoHoras100 +
        liq.haberes.montoRecargoNocturno;
      debeVacaciones += liq.haberes.montoVacaciones;
      debeReposoEmpresa += liq.haberes.montoReposo;
      debeBonificacionFamiliar += liq.haberes.bonificacionFamiliar;
      debeRefrigerio += liq.haberes.refrigerioTraslado;
      haberSueldosPagar += liq.netoACobrar;
    }

    if (incluirProvision) {
      debeProvisionAguinaldo += liq.provisionAguinaldoMensual;
    }

    // Descuentos aplicables a ambos regímenes
    haberDescuentoAusencias += liq.descuentos.descuentoAusencias;
    haberAnticipos += liq.descuentos.anticipoSalario;
    haberPrestamos += liq.descuentos.prestamosEmpresa;
    haberEmbargos += liq.descuentos.embargosJudiciales;
    haberSeguro += liq.descuentos.seguroMedicoPrivado;
    haberFaltanteCaja += liq.descuentos.faltanteCaja;
    haberFaltanteMercaderia += liq.descuentos.faltanteMercaderia;
    haberTelefonoNotebook += liq.descuentos.telefonoNotebook;
    haberCompraCredito += liq.descuentos.compraCreditoEmpresa;
    haberOtrosDescuentos += liq.descuentos.otrosDescuentos;
  });

  // Cargas patronales e IPS consolidadas
  const debeIpsPatronal = roundGs(totales.totalIpsPatronal);
  // Total IPS a pagar: 9% obrero + 16.5% patronal = 25.5% sobre imponible
  const haberIpsAPagar = roundGs(totales.totalIpsObrero + totales.totalIpsPatronal);
  const haberRetencionIva = roundGs(totales.totalRetencionIva);

  // Redondear a Guaraníes enteros
  debeSalarioBase = roundGs(debeSalarioBase);
  debeAdicionalCargo = roundGs(debeAdicionalCargo);
  debeHorasExtras = roundGs(debeHorasExtras);
  debeVacaciones = roundGs(debeVacaciones);
  debeReposoEmpresa = roundGs(debeReposoEmpresa);
  debeBonificacionFamiliar = roundGs(debeBonificacionFamiliar);
  debeRefrigerio = roundGs(debeRefrigerio);
  debeHonorariosFactura = roundGs(debeHonorariosFactura);
  debeProvisionAguinaldo = roundGs(debeProvisionAguinaldo);

  haberSueldosPagar = roundGs(haberSueldosPagar);
  haberHonorariosPagar = roundGs(haberHonorariosPagar);
  haberDescuentoAusencias = roundGs(haberDescuentoAusencias);
  haberAnticipos = roundGs(haberAnticipos);
  haberPrestamos = roundGs(haberPrestamos);
  haberEmbargos = roundGs(haberEmbargos);
  haberSeguro = roundGs(haberSeguro);
  haberFaltanteCaja = roundGs(haberFaltanteCaja);
  haberFaltanteMercaderia = roundGs(haberFaltanteMercaderia);
  haberTelefonoNotebook = roundGs(haberTelefonoNotebook);
  haberCompraCredito = roundGs(haberCompraCredito);
  haberOtrosDescuentos = roundGs(haberOtrosDescuentos);

  // Estructurar líneas de asiento
  interface LineaDraft {
    cuenta: CuentaContableConfig;
    concepto: string;
    debe: number;
    haber: number;
    esProvision?: boolean;
  }

  const rawLineas: LineaDraft[] = [];

  const agregarLinea = (
    cuenta: CuentaContableConfig,
    concepto: string,
    debe: number,
    haber: number,
    esProvision = false,
  ) => {
    const d = roundGs(debe);
    const h = roundGs(haber);
    if (d === 0 && h === 0) return;
    rawLineas.push({ cuenta, concepto, debe: d, haber: h, esProvision });
  };

  // 1. Líneas de DEBE (Gastos y Costos)
  if (debeSalarioBase > 0) {
    agregarLinea(chart.salario_base, 'Sueldos y jornales devengados del mes', debeSalarioBase, 0);
  }
  if (debeAdicionalCargo > 0) {
    agregarLinea(chart.adicional_cargo, 'Adicionales y plus por cargo/responsabilidad', debeAdicionalCargo, 0);
  }
  if (debeHorasExtras > 0) {
    agregarLinea(chart.horas_extras, 'Horas extraordinarias, feriados y recargo nocturno', debeHorasExtras, 0);
  }
  if (debeVacaciones > 0) {
    agregarLinea(chart.vacaciones, 'Descanso anual remunerado (vacaciones)', debeVacaciones, 0);
  }
  if (debeReposoEmpresa > 0) {
    agregarLinea(chart.reposo_empresa, 'Subsidio por reposo médico a cargo patronal (50%)', debeReposoEmpresa, 0);
  }
  if (debeBonificacionFamiliar > 0) {
    agregarLinea(chart.bonificacion_familiar, 'Bonificación familiar legal por hijos (Art. 261 CT)', debeBonificacionFamiliar, 0);
  }
  if (debeRefrigerio > 0) {
    agregarLinea(chart.refrigerio_traslado, 'Refrigerio, viáticos y asignaciones de traslado', debeRefrigerio, 0);
  }
  if (debeHonorariosFactura > 0) {
    agregarLinea(chart.honorarios_factura, 'Honorarios de prestadores independientes con factura legal', debeHonorariosFactura, 0);
  }
  if (debeIpsPatronal > 0) {
    agregarLinea(chart.ips_patronal, 'Aporte patronal obligatorio IPS (16.5%)', debeIpsPatronal, 0);
  }
  if (incluirProvision && debeProvisionAguinaldo > 0) {
    agregarLinea(chart.provision_aguinaldo, 'Provisión mensual de aguinaldo legal (1/12)', debeProvisionAguinaldo, 0, true);
  }

  // 2. Líneas de HABER (Pasivos, Retenciones y Recuperos)
  const esUSD = opciones?.moneda === 'USD';
  const cSueldos = esUSD && (chart as any).sueldos_a_pagar_usd ? (chart as any).sueldos_a_pagar_usd : chart.sueldos_a_pagar;
  const cAnticipos = esUSD && (chart as any).anticipos_sueldo_usd ? (chart as any).anticipos_sueldo_usd : chart.anticipos_sueldo;
  const cPrestamos = esUSD && (chart as any).prestamos_empresa_usd ? (chart as any).prestamos_empresa_usd : chart.prestamos_empresa;
  const cAguinaldo = esUSD && (chart as any).provision_aguinaldo_a_pagar_usd ? (chart as any).provision_aguinaldo_a_pagar_usd : chart.provision_aguinaldo_a_pagar;

  if (haberSueldosPagar > 0) {
    agregarLinea(cSueldos, 'Sueldos netos a desembolsar (cotizantes dependientes)', 0, haberSueldosPagar);
  }
  if (haberHonorariosPagar > 0) {
    agregarLinea(chart.honorarios_a_pagar, 'Honorarios netos a transferir a prestadores de servicios', 0, haberHonorariosPagar);
  }
  if (haberIpsAPagar > 0) {
    agregarLinea(chart.ips_a_pagar, 'Planilla consolidada IPS (9% Obrero + 16.5% Patronal)', 0, haberIpsAPagar);
  }
  if (haberRetencionIva > 0) {
    agregarLinea(chart.retencion_iva_a_pagar, 'Retenciones de IVA a ingresar a la DNIT (30%)', 0, haberRetencionIva);
  }
  if (haberDescuentoAusencias > 0) {
    agregarLinea(chart.descuento_ausencias, 'Deducción salarial por ausencias no justificadas / permisos', 0, haberDescuentoAusencias);
  }
  if (haberAnticipos > 0) {
    agregarLinea(cAnticipos, 'Regularización / descargo de anticipos de sueldos en quincena', 0, haberAnticipos);
  }
  if (haberPrestamos > 0) {
    agregarLinea(cPrestamos, 'Cobro de cuotas de préstamos internos al personal', 0, haberPrestamos);
  }
  if (haberEmbargos > 0) {
    agregarLinea(chart.embargos_judiciales_a_pagar, 'Retenciones judiciales de salarios a depositar', 0, haberEmbargos);
  }
  if (haberSeguro > 0) {
    agregarLinea(chart.seguro_medico_a_pagar, 'Retención de cuotas de seguro médico privado / copagos', 0, haberSeguro);
  }
  if (haberFaltanteCaja > 0) {
    agregarLinea(chart.faltante_caja, 'Deducción para recupero de diferencias en caja', 0, haberFaltanteCaja);
  }
  if (haberFaltanteMercaderia > 0) {
    agregarLinea(chart.faltante_mercaderia, 'Deducción para recupero de faltantes de mercadería', 0, haberFaltanteMercaderia);
  }
  if (haberTelefonoNotebook > 0) {
    agregarLinea(chart.telefono_notebook, 'Cuotas de telefonía / equipos informáticos del personal', 0, haberTelefonoNotebook);
  }
  if (haberCompraCredito > 0) {
    agregarLinea(chart.compra_credito_empresa, 'Compras a crédito de empleados en la empresa', 0, haberCompraCredito);
  }
  if (haberOtrosDescuentos > 0) {
    agregarLinea(chart.otros_descuentos, 'Otras deducciones y aportes a mutuales / fondos', 0, haberOtrosDescuentos);
  }
  if (incluirProvision && debeProvisionAguinaldo > 0) {
    agregarLinea(cAguinaldo, 'Pasivo acumulado provisión para aguinaldo legal (1/12)', 0, debeProvisionAguinaldo, true);
  }

  // ── Validación de Cuadratura Matemática ──
  let totalDebe = rawLineas.reduce((acc, l) => acc + l.debe, 0);
  let totalHaber = rawLineas.reduce((acc, l) => acc + l.haber, 0);
  let diferencia = roundGs(totalDebe - totalHaber);

  // Micro-ajuste seguro de redondeo: si la diferencia es de +- 1 o 2 Gs
  // originada por redondeos individuales en Guaraníes, se absorbe en sueldos_a_pagar
  // para garantizar cuadratura exacta al 100%. Si excede 2 Gs, no se fuerza.
  if (Math.abs(diferencia) <= 2 && diferencia !== 0) {
    const lineaSueldos = rawLineas.find((l) => l.cuenta.id === 'sueldos_a_pagar');
    if (lineaSueldos) {
      lineaSueldos.haber += diferencia;
    } else {
      const lineaHonorarios = rawLineas.find((l) => l.cuenta.id === 'honorarios_a_pagar');
      if (lineaHonorarios) {
        lineaHonorarios.haber += diferencia;
      }
    }
    totalHaber = rawLineas.reduce((acc, l) => acc + l.haber, 0);
    diferencia = roundGs(totalDebe - totalHaber);
  }

  const estaCuadrado = diferencia === 0;

  // Convertir a líneas definitivas numeradas
  const lineas: LineaAsientoContable[] = rawLineas.map((l, idx) => ({
    numeroLinea: idx + 1,
    codigoCuenta: l.cuenta.codigo,
    nombreCuenta: l.cuenta.nombre,
    concepto: l.concepto,
    debe: l.debe,
    haber: l.haber,
    esProvision: l.esProvision,
  }));

  const empresaData = {
    id: metadataEmpresa?.id || 'DEFAULT',
    nombre: metadataEmpresa?.nombre || 'Empresa Empleadora',
    ruc: metadataEmpresa?.ruc || '80000000-1',
  };

  const glosaGeneral = `${opciones?.prefijoGlosa || 'Devengamiento y liquidación de nómina de salarios e IPS'} - Período ${periodoKey}`;

  return {
    id: `ASIENTO-NOMINA-${periodoKey}-${Date.now().toString(36).toUpperCase()}`,
    fechaAsiento,
    periodo: periodoKey,
    glosaGeneral,
    moneda: opciones?.moneda || 'PYG',
    tipoCambioGs: opciones?.tipoCambioGs,
    empresa: empresaData,
    lineas,
    totalDebe,
    totalHaber,
    diferencia,
    estaCuadrado,
    metadata: {
      cantidadEmpleados: liquidaciones.length,
      totalCotizantes,
      totalFacturadores,
      incluyeAguinaldoProvision: incluirProvision,
      generadoEn: new Date().toISOString(),
      empresaId: empresaData.id,
      empresaNombre: empresaData.nombre,
      empresaRuc: empresaData.ruc,
    },
  };
}

export interface NovedadDescontadaFiniquito {
  id?: string;
  concepto: string;
  monto: number;
  codigoVariable?: string;
  tipoNovedad?: string;
}

/**
 * Genera el Asiento Contable General de Liquidación Final / Egreso Laboral (LaboraPy).
 * Cumple estrictamente la partida doble: Total Debe === Total Haber (Diferencia = 0 Gs.).
 *
 * Contempla:
 * - DEBE: Indemnización por despido (Art. 91 CT), preaviso omitido (Art. 92 CT),
 *   vacaciones causadas y proporcionales (Art. 218 CT), aguinaldo proporcional (Art. 243 CT),
 *   salarios pendientes, comisiones devengadas y bonificación familiar.
 * - HABER: Retención IPS Obrero 9% (sobre conceptos remunerativos imponibles),
 *   compensación y cobro de deudas activas/novedades (embargos judiciales, préstamos,
 *   compras a crédito, anticipos) y Pasivo de Liquidaciones Finales a Pagar.
 */
export function generarAsientoContableLiquidacionFinal(
  input: LiquidacionInput,
  resultado: LiquidacionResult,
  novedadesDescontadas: NovedadDescontadaFiniquito[] = [],
  configCuentas?: Partial<PlanDeCuentasNomina>,
  metadataEmpresa?: { id: string; nombre: string; ruc: string },
  opciones?: OpcionesAsientoNomina,
): AsientoContableGeneral {
  const chart: PlanDeCuentasNomina = {
    ...DEFAULT_CHART_OF_ACCOUNTS,
    ...(configCuentas || {}),
  } as PlanDeCuentasNomina;

  const fechaAsiento =
    opciones?.fechaContable ||
    input.fechaEgreso ||
    new Date().toISOString().slice(0, 10);

  type RawLinea = {
    cuenta: CuentaContableConfig;
    concepto: string;
    debe: number;
    haber: number;
  };

  const rawLineas: RawLinea[] = [];

  const pushDebe = (cuenta: CuentaContableConfig, concepto: string, monto: number) => {
    const m = roundGs(monto);
    if (m <= 0) return;
    rawLineas.push({ cuenta, concepto, debe: m, haber: 0 });
  };

  const pushHaber = (cuenta: CuentaContableConfig, concepto: string, monto: number) => {
    const m = roundGs(monto);
    if (m <= 0) return;
    rawLineas.push({ cuenta, concepto, debe: 0, haber: m });
  };

  // Helper para buscar monto por ID o prefijo de ID en resultado.conceptos
  const conceptoMonto = (id: string) => {
    const c = resultado.conceptos.find((item) => item.id === id);
    return c && !c.esDescuento ? roundGs(c.monto) : 0;
  };

  // 1. Indemnización por Despido (Art. 91 CT)
  const indemnizacion =
    conceptoMonto('indemnizacion') ||
    conceptoMonto('indemnizacion_despido') ||
    conceptoMonto('indemnizacion_antiguedad');
  if (indemnizacion > 0) {
    pushDebe(
      chart.indemnizacion_despido || chart.salario_base,
      `Indemnización por antigüedad (Art. 91 CT) - ${input.nombreEmpleado || 'Colaborador'}`,
      indemnizacion,
    );
  }

  // 2. Preaviso omitido / sustitutivo (Art. 92 CT)
  const preaviso =
    conceptoMonto('preaviso') ||
    conceptoMonto('preaviso_sustitutivo') ||
    conceptoMonto('preaviso_sustitutivo_parcial') ||
    conceptoMonto('preaviso_retiro_justificado');
  if (preaviso > 0) {
    pushDebe(
      chart.preaviso_omitido || chart.salario_base,
      `Preaviso omitido en dinero (Art. 92 CT) - ${input.nombreEmpleado || 'Colaborador'}`,
      preaviso,
    );
  }

  // 3. Vacaciones proporcionales y causadas pendientes (Art. 218 CT)
  const vacacionesMonto =
    conceptoMonto('vacaciones_proporcionales') +
    conceptoMonto('vacaciones_causadas') +
    conceptoMonto('vacaciones_periodos_anteriores') +
    conceptoMonto('vacaciones');
  if (vacacionesMonto > 0) {
    pushDebe(
      chart.vacaciones,
      `Vacaciones causadas y proporcionales compensadas - ${input.nombreEmpleado || 'Colaborador'}`,
      vacacionesMonto,
    );
  }

  // 4. Aguinaldo Proporcional de Egreso (Art. 243 CT - Exento IPS)
  const aguinaldoMonto =
    resultado.aguinaldoProporcional ||
    conceptoMonto('aguinaldo_proporcional') ||
    conceptoMonto('aguinaldo');
  if (aguinaldoMonto > 0) {
    pushDebe(
      chart.provision_aguinaldo,
      `Aguinaldo proporcional de egreso (Art. 243 CT) - ${input.nombreEmpleado || 'Colaborador'}`,
      aguinaldoMonto,
    );
  }

  // 5. Salarios días trabajados en el mes / salarios pendientes
  const salarioDiasMonto =
    conceptoMonto('salario_dias') ||
    conceptoMonto('salarios_pendientes') ||
    conceptoMonto('salario_pendiente') ||
    conceptoMonto('salario_base');
  if (salarioDiasMonto > 0) {
    pushDebe(
      chart.salario_base,
      `Salario por días trabajados en mes de egreso - ${input.nombreEmpleado || 'Colaborador'}`,
      salarioDiasMonto,
    );
  }

  // 6. Bonificación Familiar (Art. 261 CT)
  const bonifMonto = conceptoMonto('bonificacion_familiar');
  if (bonifMonto > 0) {
    pushDebe(
      chart.bonificacion_familiar,
      `Bonificación familiar asignada - ${input.nombreEmpleado || 'Colaborador'}`,
      bonifMonto,
    );
  }

  // 7. Comisiones y Horas Extras devengadas
  const comisionesMonto =
    conceptoMonto('comisiones') ||
    conceptoMonto('comision') ||
    conceptoMonto('comision_ventas');
  if (comisionesMonto > 0) {
    pushDebe(
      chart.adicional_cargo,
      `Comisiones devengadas pendientes de liquidación - ${input.nombreEmpleado || 'Colaborador'}`,
      comisionesMonto,
    );
  }

  const horasExtrasMonto =
    conceptoMonto('horas_extras_50') +
    conceptoMonto('horas_extras_100') +
    conceptoMonto('horas_extras');
  if (horasExtrasMonto > 0) {
    pushDebe(
      chart.horas_extras,
      `Horas extraordinarias de egreso - ${input.nombreEmpleado || 'Colaborador'}`,
      horasExtrasMonto,
    );
  }

  // Otros conceptos de haber no mapeados explícitamente
  const idsMapeadosHaberes = new Set([
    'indemnizacion',
    'indemnizacion_despido',
    'indemnizacion_antiguedad',
    'preaviso',
    'preaviso_sustitutivo',
    'preaviso_sustitutivo_parcial',
    'preaviso_retiro_justificado',
    'vacaciones_proporcionales',
    'vacaciones_causadas',
    'vacaciones_periodos_anteriores',
    'vacaciones',
    'aguinaldo_proporcional',
    'aguinaldo',
    'salario_dias',
    'salarios_pendientes',
    'salario_pendiente',
    'salario_base',
    'bonificacion_familiar',
    'comisiones',
    'comision',
    'comision_ventas',
    'horas_extras_50',
    'horas_extras_100',
    'horas_extras',
  ]);

  resultado.conceptos.forEach((c) => {
    if (!c.esDescuento && !idsMapeadosHaberes.has(c.id) && c.monto > 0) {
      pushDebe(
        chart.adicional_cargo,
        `${c.nombre} - ${input.nombreEmpleado || 'Colaborador'}`,
        c.monto,
      );
    }
  });

  // ── HABER: Retenciones, Deudas / Novedades y Pasivo Neto ──

  // A. Aporte IPS Obrero 9%
  const conceptoIps = resultado.conceptos.find(
    (c) => c.esDescuento && (c.id === 'ips_obrero' || c.id === 'ips' || c.nombre.toLowerCase().includes('ips')),
  );
  let ipsObreroMonto = conceptoIps ? roundGs(conceptoIps.monto) : 0;
  if (ipsObreroMonto <= 0 && resultado.baseImponibleIPS && resultado.baseImponibleIPS > 0) {
    ipsObreroMonto = roundGs(resultado.baseImponibleIPS * 0.09);
  } else if (ipsObreroMonto <= 0) {
    // Si no vino provisto, calcular sobre haberes estrictamente imponibles (salarios, vacaciones, extras, comisiones)
    const baseComputable = salarioDiasMonto + vacacionesMonto + comisionesMonto + horasExtrasMonto;
    if (baseComputable > 0) {
      ipsObreroMonto = roundGs(baseComputable * 0.09);
    }
  }

  if (ipsObreroMonto > 0) {
    pushHaber(
      chart.ips_a_pagar,
      `Aporte Obrero IPS Retenido (9%) - ${input.nombreEmpleado || 'Colaborador'}`,
      ipsObreroMonto,
    );
  }

  // B. Descuentos de Novedades y Deudas Vivas (Embargos, Préstamos, Mercaderías, Anticipos)
  const nombresDescontadosEnConceptos = new Set<string>();

  novedadesDescontadas.forEach((nov) => {
    const monto = roundGs(nov.monto);
    if (monto <= 0) return;

    const tipo = (nov.tipoNovedad || '').toLowerCase();
    const codVar = (nov.codigoVariable || '').toUpperCase();
    const nombreLower = nov.concepto.toLowerCase();

    let ctaDestino = chart.otros_descuentos;

    if (tipo.includes('embargo') || codVar.startsWith('EMB') || nombreLower.includes('embargo')) {
      ctaDestino = chart.embargos_judiciales_a_pagar;
    } else if (tipo.includes('prestamo') || codVar.startsWith('PRES') || nombreLower.includes('prestamo')) {
      ctaDestino = chart.prestamos_empresa;
    } else if (
      tipo.includes('anticipo') ||
      codVar.startsWith('DESC_ANT') ||
      codVar.startsWith('ANDOL') ||
      nombreLower.includes('anticipo')
    ) {
      ctaDestino = chart.anticipos_sueldo;
    } else if (codVar.startsWith('MER') || nombreLower.includes('mercader') || nombreLower.includes('compra')) {
      ctaDestino = chart.compra_credito_empresa;
    } else if (codVar.startsWith('FAL') || nombreLower.includes('faltante')) {
      ctaDestino = chart.faltante_caja;
    } else if (codVar.startsWith('DESC_CEL') || nombreLower.includes('telefono') || nombreLower.includes('notebook')) {
      ctaDestino = chart.telefono_notebook;
    } else if (tipo.includes('seguro') || codVar.startsWith('ASISMED') || codVar.startsWith('IMPPLAN')) {
      ctaDestino = chart.seguro_medico_a_pagar;
    }

    pushHaber(
      ctaDestino,
      `Compensación en finiquito: ${nov.concepto} - ${input.nombreEmpleado || 'Colaborador'}`,
      monto,
    );
    nombresDescontadosEnConceptos.add(nov.concepto.trim().toLowerCase());
  });

  // Procesar otros descuentos que vinieron en resultado.conceptos que no sean IPS ni las novedades ya procesadas
  resultado.conceptos.forEach((c) => {
    if (!c.esDescuento) return;
    if (c.id === 'ips_obrero' || c.id === 'ips' || c.nombre.toLowerCase().includes('ips')) return;

    const cNombre = c.nombre.trim().toLowerCase();
    if (nombresDescontadosEnConceptos.has(cNombre)) return;

    let ctaDesc = chart.otros_descuentos;
    if (cNombre.includes('embargo')) ctaDesc = chart.embargos_judiciales_a_pagar;
    else if (cNombre.includes('prestamo')) ctaDesc = chart.prestamos_empresa;
    else if (cNombre.includes('anticipo')) ctaDesc = chart.anticipos_sueldo;
    else if (cNombre.includes('mercader') || cNombre.includes('compra')) ctaDesc = chart.compra_credito_empresa;

    pushHaber(
      ctaDesc,
      `${c.nombre} - ${input.nombreEmpleado || 'Colaborador'}`,
      c.monto,
    );
  });

  // C. Pasivo Líquido a Pagar (Total Neto de Finiquito)
  const sumaDebe = rawLineas.reduce((acc, l) => acc + l.debe, 0);
  const sumaHaber = rawLineas.reduce((acc, l) => acc + l.haber, 0);

  const netoCalculado = roundGs(sumaDebe - sumaHaber);

  if (netoCalculado > 0) {
    const ctaNeto = chart.liquidaciones_a_pagar || chart.sueldos_a_pagar;
    pushHaber(
      ctaNeto,
      `Neto a percibir por finiquito de egreso - ${input.nombreEmpleado || 'Colaborador'}`,
      netoCalculado,
    );
  } else if (netoCalculado < 0) {
    pushDebe(
      chart.anticipos_sueldo,
      `Saldo deudor a favor de la empresa tras finiquito - ${input.nombreEmpleado || 'Colaborador'}`,
      Math.abs(netoCalculado),
    );
  }

  // Verificación final de cuadratura estricta (Partida Doble)
  let totalDebe = roundGs(rawLineas.reduce((acc, l) => acc + l.debe, 0));
  let totalHaber = roundGs(rawLineas.reduce((acc, l) => acc + l.haber, 0));
  let diferencia = roundGs(totalDebe - totalHaber);

  if (diferencia !== 0) {
    if (rawLineas.length > 0) {
      const ultima = rawLineas[rawLineas.length - 1];
      if (ultima.haber > 0) {
        ultima.haber = roundGs(ultima.haber + diferencia);
      } else {
        ultima.debe = roundGs(ultima.debe - diferencia);
      }
    }
    totalDebe = roundGs(rawLineas.reduce((acc, l) => acc + l.debe, 0));
    totalHaber = roundGs(rawLineas.reduce((acc, l) => acc + l.haber, 0));
    diferencia = roundGs(totalDebe - totalHaber);
  }

  const estaCuadrado = diferencia === 0;

  const lineas: LineaAsientoContable[] = rawLineas.map((l, idx) => ({
    numeroLinea: idx + 1,
    codigoCuenta: l.cuenta.codigo,
    nombreCuenta: l.cuenta.nombre,
    concepto: l.concepto,
    debe: l.debe,
    haber: l.haber,
    empleadoId: input.ciEmpleado,
    referencia: `CI ${input.ciEmpleado || ''}`,
  }));

  const empresaData = {
    id: metadataEmpresa?.id || 'EMPRESA',
    nombre: metadataEmpresa?.nombre || input.empresa || 'Empresa Empleadora',
    ruc: metadataEmpresa?.ruc || '80000000-1',
  };

  const cleanCi = (input.ciEmpleado || '').replace(/\D/g, '');
  const asientoId = `ASIENTO-FIN-${cleanCi || 'EGRESO'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    id: asientoId,
    fechaAsiento,
    periodo: fechaAsiento.slice(0, 7),
    glosaGeneral: `Liquidación Final y Finiquito de Haberes - ${input.nombreEmpleado || 'Colaborador'} (CI: ${input.ciEmpleado || 'N/A'}) - Causal: ${input.motivo || 'Egreso'}`,
    moneda: opciones?.moneda || 'PYG',
    tipoCambioGs: opciones?.tipoCambioGs,
    empresa: empresaData,
    lineas,
    totalDebe,
    totalHaber,
    diferencia,
    estaCuadrado,
    metadata: {
      cantidadEmpleados: 1,
      totalCotizantes: 1,
      totalFacturadores: 0,
      incluyeAguinaldoProvision: aguinaldoMonto > 0,
      generadoEn: new Date().toISOString(),
      empresaId: empresaData.id,
      empresaNombre: empresaData.nombre,
      empresaRuc: empresaData.ruc,
    },
  };
}

