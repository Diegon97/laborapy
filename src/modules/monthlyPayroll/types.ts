/**
 * TIPOS E INTERFACES - LIQUIDACIÓN DE NÓMINA MENSUAL (LABORAPY)
 *
 * Base legal y corporativa (Planilla NOMINA GRAL):
 *  - Mes legal/comercial: 30 días
 *  - Carga horaria estándar: 240 horas mensuales (30 * 8)
 *  - SMLV Paraguay (vigente hasta Junio 2027): Gs. 3.044.000
 */

export type TipoContratoLiquidacion = 'cotizante_ips' | 'factura';

export interface EmpleadoNominaInput {
  // Identificación y datos personales
  ci: string;
  nombre: string;
  cargo: string;
  departamento?: string;
  empresa?: string;
  fechaIngreso?: string;

  // Régimen laboral
  tipo: TipoContratoLiquidacion;

  // Salario base pactado
  salarioFijo: number;

  // Días laborables y ausencias
  diasTrabajados?: number; // si se omite, se calcula 30 - diasVacaciones - diasReposo
  diasVacaciones?: number;
  diasReposo?: number;
  diasAusencias?: number; // suspensiones, permisos no remunerados o tardanzas en días

  // Conceptos y haberes adicionales
  adicionalCargo?: number; // plus por responsabilidad, función o variable
  cantHoras50?: number;    // horas extras diurnas (50%)
  cantHoras130?: number;   // horas extras nocturnas feriado/domingo (factor 2.6)
  cantHoras100?: number;   // feriados / descansos diurnos (recargo 100%)
  cantHorasNocturnas?: number; // recargo ordinario nocturno 30%
  cantidadHijos?: number;  // bonificación familiar (5% del SMLV por hijo, exenta de IPS)
  refrigerioTraslado?: number; // viáticos / subsidio de alimentación
  bonificaciones?: number; // bonificaciones extraordinarias, gratificaciones o premios

  // Deducciones y descuentos de nómina
  embargosJudiciales?: number;
  seguroMedicoPrivado?: number; // Asismed, copagos, planes complementarios
  anticipoSalario?: number;     // adelantos de quincena o vales
  prestamosEmpresa?: number;    // cuotas de préstamos internos
  faltanteCaja?: number;        // arqueos de cajeros/as
  faltanteMercaderia?: number;  // diferencias en inventario
  telefonoNotebook?: number;    // cuotas de celular, notebook o equipos de trabajo
  compraCreditoEmpresa?: number;// compras a crédito en la empresa (Cta. Cte.)
  otrosDescuentos?: number;     // donaciones, fondo solidario, mutual

  // Campos y columnas dinámicas personalizadas (estilo Excel / Notion)
  customFields?: Record<string, any>;
}

export type ColumnType =
  | 'currency'
  | 'number'
  | 'text'
  | 'percentage'
  | 'date'
  | 'select'
  | 'formula';

export type ColumnColor =
  | 'default'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'indigo'
  | 'cyan'
  | 'slate';

export interface ColumnOption {
  label: string;
  color: string;
}

export interface GridColumnDef {
  id: string;
  label: string;
  type: ColumnType;
  isCustom?: boolean;
  editable?: boolean;
  visible?: boolean;
  width?: string;
  minWidth?: string;
  color?: ColumnColor;
  formula?: string;
  options?: ColumnOption[];
  impactsLiquidation?: 'haber' | 'descuento' | 'none';
  step?: number;
}

export interface DetalleHaberes {
  salarioBaseDiasTrabajados: number;
  adicionalCargo: number;
  montoVacaciones: number;
  montoReposo: number;
  montoHoras50: number;
  montoHoras130: number;
  montoHoras100: number;
  montoRecargoNocturno: number;
  bonificacionFamiliar: number;
  refrigerioTraslado: number;
  ivaMonto: number; // 10% si factura
  totalHaberesBrutos: number;
}

export interface DetalleDescuentos {
  retencionIva: number; // 30% del IVA si factura
  aporteObreroIps: number; // 9% si cotizante
  descuentoAusencias: number;
  embargosJudiciales: number;
  seguroMedicoPrivado: number;
  anticipoSalario: number;
  prestamosEmpresa: number;
  faltanteCaja: number;
  faltanteMercaderia: number;
  telefonoNotebook: number;
  compraCreditoEmpresa: number;
  otrosDescuentos: number;
  totalDescuentos: number;
}

export interface LiquidacionMensualResult {
  input: EmpleadoNominaInput;
  diasTrabajadosEfectivos: number;
  valorDia: number;
  valorHora: number;
  haberes: DetalleHaberes;
  haberesImponiblesIps: number;
  retencionIva: number;
  sueldoMenosRetencion: number;
  descuentos: DetalleDescuentos;
  netoACobrar: number;
  aportePatronalIps: number; // 16.5% si cotizante
  provisionAguinaldoMensual: number; // (totalHaberes - iva) / 12
}

export interface TotalesNominaMasiva {
  cantidadEmpleados: number;
  totalBruto: number;
  totalHaberesImponibles: number;
  totalIpsObrero: number;
  totalIpsPatronal: number;
  totalIva: number;
  totalRetencionIva: number;
  totalDescuentos: number;
  totalNeto: number;
}

export interface NominaMasivaResult {
  liquidaciones: LiquidacionMensualResult[];
  totales: TotalesNominaMasiva;
}
