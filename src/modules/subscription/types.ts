/**
 * TIPOS DEL MÓDULO DE SUSCRIPCIONES Y CHECKOUT — LABORAPY
 * Catálogo de planes en Guaraníes (PYG), métodos de pago paraguayos
 * (SIPAP, QR Bancario y WhatsApp Asistido) y órdenes de pago persistibles.
 * Versión: PY-SUB-2026.09.16
 */

export type PlanId =
  | 'free'
  | 'profesional'
  | 'business'
  | 'enterprise'
  | 'finiquito_suelto'
  | 'auditoria_suelta';

export type BillingCycle = 'mensual' | 'anual' | 'unico';

export type MetodoPagoId = 'sipap' | 'qr_bancario' | 'whatsapp_asistido';

export type EstadoOrdenPago =
  | 'pendiente'
  | 'instrucciones_enviadas'
  | 'comprobante_recibido'
  | 'pagado'
  | 'cancelado';

export type MonedaPago = 'PYG';

export interface SubscriptionPlan {
  id: PlanId;
  nombre: string;
  descripcion: string;
  precioMensualPYG: number;
  limiteEmpleados: number | null;
  limiteEmpleadosLabel: string;
  esEvento: boolean;
  destacado: boolean;
  badge?: string;
  ctaLabel: string;
  moneyMakers: string[];
  features: string[];
}

export interface MetodoPagoInfo {
  id: MetodoPagoId;
  nombre: string;
  descripcion: string;
  icono: string;
  tiempoAcreditacion: string;
  requiereComprobante: boolean;
  instrucciones: string[];
}

export interface DatosBancariosSIPAP {
  titular: string;
  ruc: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  moneda: string;
  alias: string;
  conceptoBase: string;
}

export interface PaymentOrder {
  id: string;
  numeroOrden: string;
  planId: PlanId;
  planNombre: string;
  ciclo: BillingCycle;
  metodoPago: MetodoPagoId;
  metodoPagoNombre: string;
  montoPYG: number;
  moneda: MonedaPago;
  estado: EstadoOrdenPago;
  referenciaPago: string;
  creadoEn: string;
  actualizadoEn: string;
  clienteNombre?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  empresaNombre?: string;
  ruc?: string;
  notas?: string;
  whatsappUrl: string;
}

export interface CreatePaymentOrderInput {
  planId: PlanId;
  ciclo?: BillingCycle;
  metodoPago: MetodoPagoId;
  clienteNombre?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  empresaNombre?: string;
  ruc?: string;
  notas?: string;
}

export interface PlanPricing {
  planId: PlanId;
  ciclo: BillingCycle;
  montoPYG: number;
  precioMensualEquivalentePYG: number;
  ahorroPYG: number;
}

export interface SubscriptionMetrics {
  totalOrdenes: number;
  ordenesPagadas: number;
  ordenesPendientes: number;
  montoTotalPYG: number;
  montoPagadoPYG: number;
  mrrEstimadoPYG: number;
}
