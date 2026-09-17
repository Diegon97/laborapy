/**
 * TIPOS E INTERFACES - GESTIÓN DE PERÍODOS Y NOVEDADES SALARIALES RECURRENTES (LABORAPY)
 *
 * Base legal y corporativa:
 * - Ley 213/93 Código del Trabajo Paraguay (Art. 245 sobre embargos judiciales)
 * - Nomenclatura formal: MEN 08 (Agosto 2026)
 * - Cola de embargos judiciales con tope legal acumulado del 25% de haberes imponibles
 */

import type { EmpleadoNominaInput, TotalesNominaMasiva } from '../types';
import type { AsientoContableGeneral } from './accountingTypes';

export type EstadoPeriodo = 'abierto' | 'cerrado';

export type TipoLiquidacion =
  | 'mensual_ips'
  | 'facturacion_honorarios'
  | 'liquidacion_final'
  | 'moneda_usd';

export type MonedaNomina = 'PYG' | 'USD';

export type TipoNovedad =
  | 'embargo_judicial'
  | 'anticipo_recurrente'
  | 'prestamo_empresa'
  | 'seguro_medico'
  | 'cuota_equipo'
  | 'otro_descuento_fijo'
  | 'adicional_cargo'
  | 'refrigerio_traslado'
  | 'bono_fijo'
  | 'otro_haber';

export type SubtipoNovedad =
  | 'embargo_judicial'
  | 'anticipo_salario'
  | 'prestamo_empresa'
  | 'seguro_medico'
  | 'descuento_manual'
  | 'bonificacion_extraordinaria'
  | 'gratificacion_ocasional'
  | 'adicional_cargo'
  | 'refrigerio_viatico'
  | 'haber_manual';

export type ModalidadCalculoNovedad = 'monto_fijo' | 'porcentaje_variable';
export type TipoVigenciaNovedad = 'mes_unico' | 'rango_meses' | 'hasta_saldo_cero' | 'permanente';
export type CodigoLiquidacionImpacto = 'MEN' | 'COM' | 'HRE' | 'AGU' | 'FIN';

export interface AuditoriaNovedadRegistro {
  fecha: string;          // ISO string
  usuario: string;        // Nombre o email del operador/auditor
  accion: 'creacion' | 'modificacion' | 'pisado' | 'pausado' | 'reactivado' | 'eliminado';
  detalle: string;
  valorAnterior?: number;
  valorNuevo?: number;
  periodoAfectado?: string;
}

export interface NovedadPersonal {
  id: string;
  ci: string;
  tipo: TipoNovedad;
  descripcion: string;
  montoOriginal?: number;        // Monto inicial del embargo o préstamo
  saldoPendiente?: number;       // Saldo restante decreciente
  cuotaMensual?: number;         // Cuota periódica o monto recurrente
  porcentajeTope?: number;       // Default 0.25 (25% legal según Ley 213/93)
  activo: boolean;
  prioridad?: number;            // 1 = máxima prioridad en cola FIFO
  fechaCreacion: string;         // ISO string
  fechaFinalizacion?: string;    // ISO string cuando queda saldado
  expedienteJudicial?: string;   // Ej: "Oficio N° 124/2026 Juzgado de Paz"
  tipoConcepto?: 'haber' | 'descuento';
  conceptoClave?: string;        // Ej: 'adicionalCargo', 'refrigerioTraslado', 'embargo_judicial', etc.
  codigoVariable?: string;       // Código oficial de variable definible (ej: 'SALDOL', 'ANDOL', 'COMISION')
  numeroConcepto?: number;       // Número oficial de concepto (ej: 1000, 2000, 2500, 4000, 4075)
  nombreConcepto?: string;       // Denominación oficial contable del concepto
  subtipo?: string;
  modalidadCalculo?: ModalidadCalculoNovedad;
  porcentajeVariable?: number;   // Ej: 25 para 25%
  tipoVigencia?: TipoVigenciaNovedad;
  mesUnico?: string;             // 'YYYY-MM'
  regimenVigencia?: 'indeterminado' | 'definido';
  periodoDesde?: string;         // 'YYYY-MM'
  periodoHasta?: string;         // 'YYYY-MM'
  liquidacionesImpactadas?: CodigoLiquidacionImpacto[];
  saldoInicial?: number;
  creadoPor?: string;
  modificadoPor?: string;
  fechaModificacion?: string;
  pisadaPorId?: string;
  reemplazaNovedadId?: string;
  historialAuditoria?: AuditoriaNovedadRegistro[];
}

export interface PeriodoNomina {
  id: string;                    // 'YYYY-MM', ej: '2026-08'
  codigoFormal: string;          // 'MEN 08 (Agosto 2026)'
  mes: number;                   // 1 - 12
  anio: number;                  // ej: 2026
  estado: EstadoPeriodo;
  tipoLiquidacion?: TipoLiquidacion;
  moneda?: MonedaNomina;
  empleadoSalida?: {
    ci: string;
    nombre: string;
    motivo: string;
    fechaEgreso: string;
  };
  fechaCierre?: string;
  cerradoPor?: string;
  snapshotTotales?: TotalesNominaMasiva;
  snapshotAsiento?: AsientoContableGeneral;
  observaciones?: string;
}

export interface DesgloseNovedadAplicada {
  novedadId: string;
  tipo: TipoNovedad;
  montoDescontado: number;
  saldoAnterior: number;
  saldoNuevo: number;
  saldadoTotalmente: boolean;
}

export interface ResultadoAplicacionNovedades {
  empleado: EmpleadoNominaInput;
  desgloses: DesgloseNovedadAplicada[];
  totalEmbargosAplicados: number;
  totalAnticiposAplicados: number;
  totalPrestamosAplicados: number;
  totalOtrosDescuentosAplicados: number;
  totalHaberesAdicionalesAplicados: number;
}
