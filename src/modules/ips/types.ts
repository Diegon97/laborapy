/**
 * CAPA DE DOMINIO — LIQUIDACIÓN IPS (PARAGUAY)
 * Tipos puros del módulo `ips`: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Base legal: Decreto-Ley N.º 1860/50 (Ley Orgánica del Instituto de Previsión
 * Social), Art. 76 — aporte obrero del 9 % y patronal del 16,5 %.
 *
 * Las tasas se representan como enteros por mil (90 y 165) para que el cálculo se
 * haga con aritmética exacta en guaraníes; nunca se usa 0,09 ni 0,165 en el cálculo
 * y nunca se aplica 25,5 % sobre la base (el total es la suma de los dos redondeos).
 */

/** Moneda en la que viene expresado el monto de un concepto de entrada. */
export type MonedaConcepto = 'PYG' | 'USD';

/** Vínculo del trabajador con el patronal a los efectos del padrón IPS. */
export type VinculoIPS =
  | 'cotizante'
  | 'factura'
  | 'domestico'
  | 'aprendiz'
  | 'pasante'
  | 'tiempo_parcial';

/**
 * Movimiento del período informado en la Relación de Empleados y Ingresos (REI).
 * Es metadato del motor para controles y UI: NO es una columna de la línea de
 * 121 caracteres, por lo que nunca debe agregarse al layout de ancho fijo.
 */
export type MovimientoREI = 'NORMAL' | 'REPOSO' | 'PERMISO' | 'SANCION';

/** Clasificación de un concepto respecto de la base imponible del IPS. */
export type ClaseConcepto = 'imponible' | 'exento' | 'no_aplica' | 'desconocido';

/** Severidad de una alerta emitida por el motor de liquidación. */
export type SeveridadAlerta = 'bloqueante' | 'advertencia' | 'info';

/** Códigos estables de alerta. No reordenar ni renombrar: los consume la UI y las pruebas. */
export type CodigoAlertaIPS =
  | 'EXT_MONTO_MENOR_AL_MINIMO'
  | 'CI_DUPLICADA'
  | 'CI_VACIA'
  | 'CONCEPTO_DESCONOCIDO'
  | 'MATERNIDAD_DIAS_MAYOR_A_CERO'
  | 'PRESTADOR_IVA_INCLUIDO'
  | 'PERIODO_INVALIDO'
  | 'PATRONAL_INEXISTENTE'
  | 'PATRONAL_INVALIDA'
  | 'FX_USD_REQUERIDO'
  | 'CAMPO_EXCEDE_ANCHO'
  | 'TIEMPO_PARCIAL_SIN_PRORRATA'
  | 'CERO_SIN_JUSTIFICAR'
  | 'REGIMEN_ESPECIAL_NO_SOPORTADO'
  | 'CONCILIACION_NO_CIERRA'
  | 'DIAS_FUERA_DE_RANGO'
  | 'CONCEPTO_NEGATIVO';

/** Alerta emitida por el motor, asociada o no a una cédula concreta. */
export interface AlertaIPS {
  codigo: CodigoAlertaIPS;
  severidad: SeveridadAlerta;
  mensaje: string;
  ci?: string;
}

/** Concepto tal como llega desde la nómina o el archivo del cliente, sin interpretar. */
export interface ConceptoEntrada {
  etiqueta: string;
  monto: number;
  moneda?: MonedaConcepto;
}

/** Situación laboral declarada de una persona para el período liquidado. */
export interface SituacionLaboralIPS {
  ci: string;
  apellidos: string;
  nombres: string;
  numeroPatronal: string;
  vinculo: VinculoIPS;
  diasTrabajados: number;
  diasReposo: number;
  diasVacaciones: number;
  diasAusencia: number;
  esReposoMaternidad: boolean;
  subsidioAdelantadoPorEmpleador: number;
  coberturaReposoPorcentaje: 0 | 50 | 100;
  horasContratadasSemana?: number;
  horasSemanaCategoria?: number;
  conceptos: ConceptoEntrada[];
  egresoEnPeriodo?: { fecha: string; motivo: string };
}

/** Concepto ya resuelto contra el catálogo canónico y valuado en guaraníes. */
export interface DetalleConceptoIPS {
  etiqueta: string;
  conceptoCanonico: string;
  clase: ClaseConcepto;
  montoGs: number;
  grava: boolean;
}

/** Línea de cotizante con su base imponible y sus dos aportes redondeados por separado. */
export interface CotizanteIPS {
  ci: string;
  apellidos: string;
  nombres: string;
  numeroPatronal: string;
  dias: number;
  movimiento: MovimientoREI;
  baseImponible: number;
  aporteObrero: number;
  aportePatronal: number;
  aporteTotal: number;
  casosAplicados: string[];
  alertas: AlertaIPS[];
  detalle: DetalleConceptoIPS[];
}

/** Totales consolidados de una planilla o de toda la liquidación. */
export interface TotalesIPS {
  cotizantes: number;
  baseImponible: number;
  aporteObrero: number;
  aportePatronal: number;
  aporteTotal: number;
}

/** Planilla de un número patronal: cotizantes y totales del patronal. */
export interface PlanillaPatronalIPS {
  numeroPatronal: string;
  cotizantes: CotizanteIPS[];
  totales: TotalesIPS;
}

/** Configuración de un patronal (número patronal, sucursal y descripción) dentro de la liquidación. */
export interface ConfiguracionPatronalIPS {
  numeroPatronal: string;
  sucursalId?: string;
  descripcion: string;
}

/** Parámetros completos de una corrida de liquidación IPS. */
export interface ConfiguracionLiquidacionIPS {
  ruc: string;
  dv: string;
  razonSocial: string;
  mes: number;
  anho: number;
  salarioMinimoLegal: number;
  tasaObreroPorMil: number;
  tasaPatronalPorMil: number;
  tipoCambioUsdPyg?: number;
  codigoActividad: string;
  toleranciaConciliacionGs: number;
  patronales: ConfiguracionPatronalIPS[];
}

/** Resultado completo de la liquidación: planillas, totales, alertas y aptitud de presentación. */
export interface ResultadoLiquidacionIPS {
  planillas: PlanillaPatronalIPS[];
  totales: TotalesIPS;
  alertas: AlertaIPS[];
  aptoParaPresentar: boolean;
}
