/**
 * MOTOR DE CÁLCULO DE LIQUIDACIÓN Y PAGO DE SALARIO MENSUAL (LABORAPY)
 *
 * Basado estrictamente en la lógica de cálculo corporativo de la hoja NOMINA GRAL.
 *
 * Bases de cálculo legal vigentes en Paraguay:
 *  - Mes laboral estándar: 30 días
 *  - Carga horaria estándar mensual: 240 horas (30 días * 8 horas)
 *  - Salario Mínimo Legal Vigente (SMLV): Gs. 3.044.000 (vigente hasta Junio 2027)
 *  - Bonificación Familiar: 5% del SMLV por cada hijo menor de 18 años (Art. 261 CT, exenta de IPS)
 *  - Aporte Obrero IPS: 9% sobre Haberes Imponibles
 *  - Aporte Patronal IPS: 16.5% sobre Haberes Imponibles
 *  - Prestador de Servicios / Factura: IVA 10% y Retención de IVA del 30% en la fuente (DNIT / ex-SET)
 *  - Agente Retentor DNIT: si la empresa NO es retentora, los facturadores no sufren retención del 30% del IVA.
 */

import type {
  EmpleadoNominaInput,
  LiquidacionMensualResult,
  DetalleHaberes,
  DetalleDescuentos,
  NominaMasivaResult,
  TotalesNominaMasiva,
} from '../types';
import { aplicarTasaPorMil } from '../../ips';

/* =========================================================================
 * CONSTANTES LEGALES Y CORPORATIVAS
 * ========================================================================= */

export const SALARIO_MINIMO_LEGAL_VIGENTE = 3_044_000;
export const PORCENTAJE_BONIF_FAMILIAR = 0.05;
export const MONTO_UNITARIO_BONIF_FAMILIAR = Math.round(
  SALARIO_MINIMO_LEGAL_VIGENTE * PORCENTAJE_BONIF_FAMILIAR,
); // Gs. 152.200

/**
 * Tasa obrera del IPS como fracción decimal (9 %).
 *
 * NO debe usarse para calcular aportes: multiplicar una base en guaraníes por esta fracción
 * introduce aritmética de punto flotante y puede desviar ₲1 del valor legal (caso demostrado:
 * 7.032.050 × 9 % = 632.884,5 exacto; el float devuelve 632.884 y el valor legal es 632.885).
 * La tasa de cálculo es `TASA_IPS_OBRERO_POR_MIL` con `aplicarTasaPorMil`.
 */
export const PORCENTAJE_IPS_OBRERO = 0.09;

/**
 * Tasa patronal del IPS como fracción decimal (16,5 %).
 *
 * NO debe usarse para calcular aportes, por la misma razón que la tasa obrera.
 * La tasa de cálculo es `TASA_IPS_PATRONAL_POR_MIL` con `aplicarTasaPorMil`.
 */
export const PORCENTAJE_IPS_PATRONAL = 0.165;

/** Tasa obrera del IPS en enteros por mil (9 % → 90). Unidad de la aritmética exacta. */
export const TASA_IPS_OBRERO_POR_MIL = 90;

/** Tasa patronal del IPS en enteros por mil (16,5 % → 165). Unidad de la aritmética exacta. */
export const TASA_IPS_PATRONAL_POR_MIL = 165;

export const TASA_IVA_SERVICIOS = 0.10;
export const TASA_RETENCION_IVA = 0.30;

export const DIAS_BASE_MES = 30;
export const HORAS_BASE_MES = 240;

/* =========================================================================
 * HELPERS NUMÉRICOS
 * ========================================================================= */

const n = (v: number | undefined | null): number =>
  typeof v === 'number' && isFinite(v) ? v : 0;

const gt0 = (v: number | undefined | null): number => {
  const x = n(v);
  return x > 0 ? x : 0;
};

/**
 * Redondeo oficial comercial a Guaraníes (entero sin decimales).
 */
export const roundGs = (v: number): number => {
  if (!isFinite(v)) return 0;
  return Math.round(v);
};

/**
 * Formateador de moneda en Guaraníes para visualización
 */
export const formatGuaranies = (valor: number): string => {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  })
    .format(Math.round(valor))
    .replace('PYG', 'Gs.');
};

/**
 * Formateador multimoneda para Guaraníes (PYG) y Dólares (USD).
 */
export function formatMontoMoneda(valor: number, moneda: 'PYG' | 'USD' = 'PYG'): string {
  if (!Number.isFinite(valor)) {
    return moneda === 'USD' ? '$ 0.00' : formatGuaranies(0);
  }
  if (moneda === 'USD') {
    const formatted = Math.abs(valor).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return valor < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
  }
  return formatGuaranies(valor);
}

/**
 * Determina los días trabajados computables en el mes:
 * Si el usuario ingresa días explícitos (ej. ingreso a mitad de mes), se respeta.
 * De lo contrario, aplica la fórmula corporativa: 30 - Días_Vacaciones - Días_Reposo.
 */
export const calcularDiasTrabajadosEfectivos = (input: EmpleadoNominaInput): number => {
  if (typeof input.diasTrabajados === 'number' && isFinite(input.diasTrabajados)) {
    return Math.max(0, input.diasTrabajados);
  }
  const vac = gt0(input.diasVacaciones);
  const repo = gt0(input.diasReposo);
  return Math.max(0, DIAS_BASE_MES - vac - repo);
};

/* =========================================================================
 * CÁLCULO INDIVIDUAL DE LIQUIDACIÓN MENSUAL
 * ========================================================================= */

export function calcularLiquidacionMensual(
  input: EmpleadoNominaInput,
  smlv: number = SALARIO_MINIMO_LEGAL_VIGENTE,
  esAgenteRetentor = true,
): LiquidacionMensualResult {
  const salarioFijo = gt0(input.salarioFijo);
  const diasTrabajadosEfectivos = calcularDiasTrabajadosEfectivos(input);

  // Valor día y hora sin redondear para conservar la precisión matemática
  const valorDia = salarioFijo / DIAS_BASE_MES;
  const valorHora = salarioFijo / HORAS_BASE_MES;

  /* ------------------- 1. HABERES BASE Y BENEFICIOS ------------------- */
  // Salario total por días trabajados = (Salario Fijo / 30) * Días Trabajados
  const salarioBaseDiasTrabajados = roundGs(valorDia * diasTrabajadosEfectivos);

  // Vacaciones causadas en el mes = (Salario Fijo / 30) * Días Vacaciones
  const diasVacaciones = gt0(input.diasVacaciones);
  const montoVacaciones = roundGs(valorDia * diasVacaciones);

  // Reposo médico = (Salario Fijo / 30) * Días Reposo / 2 (50% a cargo patronal)
  const diasReposo = gt0(input.diasReposo);
  const montoReposo = roundGs((valorDia * diasReposo) / 2);

  // Plus o adicional por cargo / responsabilidad / variable / bonificaciones extraordinarias
  const adicionalCargo = roundGs(gt0(input.adicionalCargo) + gt0(input.bonificaciones));

  /* ------------------- 2. HORAS EXTRAS Y RECARGOS ------------------- */
  // Horas 50% = (Salario Fijo / 240 * 1.5) * Cantidad
  const cantHs50 = gt0(input.cantHoras50);
  const montoHoras50 = roundGs(valorHora * 1.5 * cantHs50);

  // Horas 130% = (Salario Fijo / 240 * 1.3 * 2) * Cantidad (factor 2.6)
  const cantHs130 = gt0(input.cantHoras130);
  const montoHoras130 = roundGs(valorHora * 1.3 * 2 * cantHs130);

  // Horas 100% / Feriados = (Salario Fijo / 240) * Cantidad (recargo adicional 1x)
  const cantHs100 = gt0(input.cantHoras100);
  const montoHoras100 = roundGs(valorHora * cantHs100);

  // Recargo ordinario nocturno 30% (20:00 a 06:00) = (Salario Fijo / 240 * 0.30) * Cantidad
  const cantHsNoct = gt0(input.cantHorasNocturnas);
  const montoRecargoNocturno = roundGs(valorHora * 0.30 * cantHsNoct);

  /* ------------------- 3. BONIFICACIÓN FAMILIAR ------------------- */
  // Art. 261 CT: 5% del SMLV por cada hijo menor de 18 años. EXENTA DE IPS.
  const cantidadHijos = gt0(input.cantidadHijos);
  const bonificacionFamiliar = roundGs(smlv * PORCENTAJE_BONIF_FAMILIAR * cantidadHijos);

  // Refrigerio y traslado (viáticos o subsidios alimentarios)
  const refrigerioTraslado = roundGs(gt0(input.refrigerioTraslado));

  /* ------------------- 4. IVA FACTURA (PRESTADORES) ------------------- */
  const esFactura = input.tipo === 'factura';

  // Base imponible del IVA: Salario Base + Horas Extras + Adicional Cargo
  const baseIvaFactura =
    salarioBaseDiasTrabajados +
    montoHoras50 +
    montoHoras130 +
    montoHoras100 +
    adicionalCargo;

  const ivaMonto = esFactura ? roundGs(baseIvaFactura * TASA_IVA_SERVICIOS) : 0;

  /* ------------------- 5. TOTAL HABERES BRUTOS ------------------- */
  const totalHaberesBrutos = roundGs(
    salarioBaseDiasTrabajados +
      adicionalCargo +
      montoVacaciones +
      montoReposo +
      montoHoras50 +
      montoHoras130 +
      montoHoras100 +
      montoRecargoNocturno +
      bonificacionFamiliar +
      refrigerioTraslado +
      ivaMonto,
  );

  const haberes: DetalleHaberes = {
    salarioBaseDiasTrabajados,
    adicionalCargo,
    montoVacaciones,
    montoReposo,
    montoHoras50,
    montoHoras130,
    montoHoras100,
    montoRecargoNocturno,
    bonificacionFamiliar,
    refrigerioTraslado,
    ivaMonto,
    totalHaberesBrutos,
  };

  /* ------------------- 6. HABERES IMPONIBLES IPS ------------------- */
  // Días de ausencia / suspensiones no justificados: (Salario Fijo / 30) * Días
  const diasAusencias = gt0(input.diasAusencias);
  const descuentoAusencias = roundGs(valorDia * diasAusencias);

  // Regla legal y fórmula de NOMINA GRAL:
  // Haberes Imponibles = Salario + Variable + Hs50 + Hs130 + Hs100 + Reposo + Vacaciones + Recargo_Noct + Refrigerio - Ausencias
  // EXCLUYE: Bonificación Familiar (exenta por ley) e IVA (no aplica a IPS).
  // Si es Prestador con Factura: Imponible = 0.
  const haberesImponiblesIps = esFactura
    ? 0
    : Math.max(
        0,
        roundGs(
          salarioBaseDiasTrabajados +
            adicionalCargo +
            montoHoras50 +
            montoHoras130 +
            montoHoras100 +
            montoReposo +
            montoVacaciones +
            montoRecargoNocturno +
            refrigerioTraslado -
            descuentoAusencias,
        ),
      );

  // Aporte Obrero IPS (9 %): aritmética exacta (BigInt + ROUND_HALF_UP) sobre la base imponible,
  // con un único redondeo al guaraní. Decreto-Ley N.º 1860/50, Art. 76.
  const aporteObreroIps = esFactura
    ? 0
    : aplicarTasaPorMil(haberesImponiblesIps, TASA_IPS_OBRERO_POR_MIL);

  // Aporte Patronal IPS (16,5 %): misma aritmética exacta, redondeo independiente.
  const aportePatronalIps = esFactura
    ? 0
    : aplicarTasaPorMil(haberesImponiblesIps, TASA_IPS_PATRONAL_POR_MIL);

  // Retención de IVA en la fuente: 30% del IVA facturado SOLO si la empresa es agente retentor (DNIT / ex-SET)
  const retencionIva = esFactura && esAgenteRetentor ? roundGs(ivaMonto * TASA_RETENCION_IVA) : 0;

  /* ------------------- 7. DESCUENTOS ADMINISTRATIVOS ------------------- */
  const embargosJudiciales = roundGs(gt0(input.embargosJudiciales));
  const seguroMedicoPrivado = roundGs(gt0(input.seguroMedicoPrivado));
  const anticipoSalario = roundGs(gt0(input.anticipoSalario));
  const prestamosEmpresa = roundGs(gt0(input.prestamosEmpresa));
  const faltanteCaja = roundGs(gt0(input.faltanteCaja));
  const faltanteMercaderia = roundGs(gt0(input.faltanteMercaderia));
  const telefonoNotebook = roundGs(gt0(input.telefonoNotebook));
  const compraCreditoEmpresa = roundGs(gt0(input.compraCreditoEmpresa));
  const otrosDescuentos = roundGs(gt0(input.otrosDescuentos));

  // Total Descuentos = IPS + Ausencias + Deducciones administrativas / corporativas
  const totalDescuentos = roundGs(
    aporteObreroIps +
      descuentoAusencias +
      embargosJudiciales +
      seguroMedicoPrivado +
      anticipoSalario +
      prestamosEmpresa +
      faltanteCaja +
      faltanteMercaderia +
      telefonoNotebook +
      compraCreditoEmpresa +
      otrosDescuentos,
  );

  const descuentos: DetalleDescuentos = {
    retencionIva,
    aporteObreroIps,
    descuentoAusencias,
    embargosJudiciales,
    seguroMedicoPrivado,
    anticipoSalario,
    prestamosEmpresa,
    faltanteCaja,
    faltanteMercaderia,
    telefonoNotebook,
    compraCreditoEmpresa,
    otrosDescuentos,
    totalDescuentos,
  };

  /* ------------------- 8. SUELDO MENOS RETENCIÓN Y NETO A COBRAR ------------------- */
  // Sueldo Menos Retención = Total Haberes - Retención IVA (si factura)
  const sueldoMenosRetencion = roundGs(totalHaberesBrutos - retencionIva);

  // Neto a Cobrar = Sueldo Menos Retención - Total Descuentos
  const netoACobrar = roundGs(sueldoMenosRetencion - totalDescuentos);

  // Provisión mensual de aguinaldo legal (1/12 de los haberes que computan para aguinaldo)
  const baseAguinaldo = totalHaberesBrutos - ivaMonto;
  const provisionAguinaldoMensual = roundGs(baseAguinaldo / 12);

  return {
    input,
    diasTrabajadosEfectivos,
    valorDia,
    valorHora,
    haberes,
    haberesImponiblesIps,
    retencionIva,
    sueldoMenosRetencion,
    descuentos,
    netoACobrar,
    aportePatronalIps,
    provisionAguinaldoMensual,
  };
}

/* =========================================================================
 * CÁLCULO MASIVO DE NÓMINA GENERAL
 * ========================================================================= */

export function calcularNominaMasiva(
  empleados: EmpleadoNominaInput[],
  smlv: number = SALARIO_MINIMO_LEGAL_VIGENTE,
  esAgenteRetentor = true,
): NominaMasivaResult {
  const liquidaciones: LiquidacionMensualResult[] = empleados.map((emp) =>
    calcularLiquidacionMensual(emp, smlv, esAgenteRetentor),
  );

  const totales: TotalesNominaMasiva = liquidaciones.reduce<TotalesNominaMasiva>(
    (acc, liq) => {
      acc.cantidadEmpleados += 1;
      acc.totalBruto += liq.haberes.totalHaberesBrutos;
      acc.totalHaberesImponibles += liq.haberesImponiblesIps;
      acc.totalIpsObrero += liq.descuentos.aporteObreroIps;
      acc.totalIpsPatronal += liq.aportePatronalIps;
      acc.totalIva += liq.haberes.ivaMonto;
      acc.totalRetencionIva += liq.retencionIva;
      acc.totalDescuentos += liq.descuentos.totalDescuentos;
      acc.totalNeto += liq.netoACobrar;
      return acc;
    },
    {
      cantidadEmpleados: 0,
      totalBruto: 0,
      totalHaberesImponibles: 0,
      totalIpsObrero: 0,
      totalIpsPatronal: 0,
      totalIva: 0,
      totalRetencionIva: 0,
      totalDescuentos: 0,
      totalNeto: 0,
    },
  );

  return { liquidaciones, totales };
}
