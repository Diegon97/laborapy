/**
 * SERVICIO DE SUSCRIPCIONES Y ÓRDENES DE PAGO — LABORAPY
 * Genera órdenes en Guaraníes (PYG), persiste el historial de compras en
 * localStorage y produce los enlaces de pago/asistencia vía WhatsApp.
 * Versión: PY-SUB-2026.09.16
 */

import { LABORAPY_CONFIG, createWhatsAppUrl } from '../../../config/laborapy';
import {
  calcularPrecioPlan,
  formatPYG,
  getMetodoPagoById,
  getPlanById,
} from '../constants';
import type {
  BillingCycle,
  CreatePaymentOrderInput,
  EstadoOrdenPago,
  MetodoPagoId,
  PaymentOrder,
  SubscriptionMetrics,
  SubscriptionPlan,
} from '../types';

export const ORDERS_STORAGE_KEY = 'laboralpy_subscription_orders';
const MAX_STORED_ORDERS = 200;

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
    // Modo privado o storage deshabilitado
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

function generateId(): string {
  const cripto = globalThis.crypto;
  if (cripto && typeof cripto.randomUUID === 'function') {
    return cripto.randomUUID();
  }
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function pad2(valor: number): string {
  return valor.toString().padStart(2, '0');
}

export function generateOrderNumber(fecha: Date = new Date()): string {
  const y = fecha.getFullYear();
  const m = pad2(fecha.getMonth() + 1);
  const d = pad2(fecha.getDate());
  const sufijo = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `LAB-${y}${m}${d}-${sufijo}`;
}

function esOrdenValida(valor: unknown): valor is PaymentOrder {
  if (!valor || typeof valor !== 'object') return false;
  const orden = valor as Partial<PaymentOrder>;
  return (
    typeof orden.id === 'string' &&
    typeof orden.numeroOrden === 'string' &&
    typeof orden.planId === 'string' &&
    typeof orden.montoPYG === 'number' &&
    typeof orden.estado === 'string'
  );
}

export function getStoredOrders(): PaymentOrder[] {
  try {
    const raw = getSafeStorage().getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(esOrdenValida);
  } catch {
    return [];
  }
}

export function saveStoredOrders(orders: PaymentOrder[]): boolean {
  try {
    getSafeStorage().setItem(
      ORDERS_STORAGE_KEY,
      JSON.stringify(orders.slice(0, MAX_STORED_ORDERS)),
    );
    return true;
  } catch {
    return false;
  }
}

export function deleteOrder(orderId: string): boolean {
  const historial = getStoredOrders();
  const filtrado = historial.filter((orden) => orden.id !== orderId);
  if (filtrado.length === historial.length) return false;
  saveStoredOrders(filtrado);
  return true;
}

export function clearStoredOrders(): void {
  try {
    getSafeStorage().removeItem(ORDERS_STORAGE_KEY);
  } catch {
    // Defensivo
  }
}

function etiquetaCicloTexto(ciclo: BillingCycle): string {
  if (ciclo === 'anual') return 'Anual';
  if (ciclo === 'unico') return 'Pago único';
  return 'Mensual';
}

export function buildPaymentMessage(order: PaymentOrder): string {
  const lineas: string[] = [
    `Hola ${LABORAPY_CONFIG.shortBrandName} 👋 Quiero activar el *Plan ${order.planNombre}* (${etiquetaCicloTexto(order.ciclo)}).`,
    `🧾 Orden de pago: ${order.numeroOrden}`,
    `💳 Método: ${order.metodoPagoNombre}`,
    `💰 Monto: ${formatPYG(order.montoPYG)}`,
  ];
  if (order.empresaNombre) lineas.push(`🏢 Empresa: ${order.empresaNombre}`);
  if (order.ruc) lineas.push(`🪪 RUC: ${order.ruc}`);
  if (order.clienteNombre) lineas.push(`👤 Titular: ${order.clienteNombre}`);
  if (order.clienteEmail) lineas.push(`✉️ Email: ${order.clienteEmail}`);
  if (order.clienteTelefono) lineas.push(`📞 Teléfono: ${order.clienteTelefono}`);
  lineas.push(
    '',
    `Referencia de pago: ${order.referenciaPago}`,
    'Adjunto el comprobante para la activación inmediata.',
  );
  return lineas.join('\n');
}

export function buildPaymentWhatsAppUrl(order: PaymentOrder): string {
  return createWhatsAppUrl(buildPaymentMessage(order));
}

export function buildAssistanceWhatsAppUrl(
  plan: SubscriptionPlan,
  ciclo: BillingCycle,
  mensaje?: string,
): string {
  const texto =
    mensaje ??
    `Hola ${LABORAPY_CONFIG.shortBrandName} 👋 Quiero suscribirme al *Plan ${plan.nombre}* (${etiquetaCicloTexto(
      plan.esEvento ? 'unico' : ciclo,
    )}) por ${formatPYG(calcularPrecioPlan(plan, plan.esEvento ? 'unico' : ciclo))}. ¿Me ayudan a completar el pago?`;
  return createWhatsAppUrl(texto);
}

export function createSubscriptionOrder(input: CreatePaymentOrderInput): PaymentOrder {
  const plan = getPlanById(input.planId);
  if (!plan) {
    throw new Error(`Plan no reconocido: ${input.planId}`);
  }
  const metodoSolicitado = getMetodoPagoById(input.metodoPago);
  if (!metodoSolicitado) {
    throw new Error(`Método de pago no reconocido: ${input.metodoPago}`);
  }

  const ciclo: BillingCycle = plan.esEvento ? 'unico' : input.ciclo ?? 'mensual';
  const montoPYG = calcularPrecioPlan(plan, ciclo);
  const metodoEfectivo: MetodoPagoId = montoPYG === 0 ? 'whatsapp_asistido' : input.metodoPago;
  const metodoInfo = getMetodoPagoById(metodoEfectivo) ?? metodoSolicitado;

  const ahora = new Date().toISOString();
  const numeroOrden = generateOrderNumber();

  const orden: PaymentOrder = {
    id: generateId(),
    numeroOrden,
    planId: plan.id,
    planNombre: plan.nombre,
    ciclo,
    metodoPago: metodoEfectivo,
    metodoPagoNombre: metodoInfo.nombre,
    montoPYG,
    moneda: 'PYG',
    estado: 'instrucciones_enviadas',
    referenciaPago: `${numeroOrden} · ${plan.nombre}`,
    creadoEn: ahora,
    actualizadoEn: ahora,
    clienteNombre: input.clienteNombre?.trim() || undefined,
    clienteEmail: input.clienteEmail?.trim() || undefined,
    clienteTelefono: input.clienteTelefono?.trim() || undefined,
    empresaNombre: input.empresaNombre?.trim() || undefined,
    ruc: input.ruc?.trim() || undefined,
    notas: input.notas?.trim() || undefined,
    whatsappUrl: '',
  };
  orden.whatsappUrl = buildPaymentWhatsAppUrl(orden);

  saveStoredOrders([orden, ...getStoredOrders()]);
  return orden;
}

export function updateOrderStatus(
  orderId: string,
  estado: EstadoOrdenPago,
  notas?: string,
): PaymentOrder | null {
  const historial = getStoredOrders();
  const indice = historial.findIndex((orden) => orden.id === orderId);
  if (indice === -1) return null;
  const actualizada: PaymentOrder = {
    ...historial[indice],
    estado,
    actualizadoEn: new Date().toISOString(),
    notas: notas !== undefined ? notas : historial[indice].notas,
  };
  historial[indice] = actualizada;
  saveStoredOrders(historial);
  return actualizada;
}

export function getSubscriptionMetrics(): SubscriptionMetrics {
  const ordenes = getStoredOrders();
  let montoTotalPYG = 0;
  let montoPagadoPYG = 0;
  let ordenesPagadas = 0;
  let ordenesPendientes = 0;
  let mrrEstimadoPYG = 0;

  for (const orden of ordenes) {
    montoTotalPYG += orden.montoPYG;
    if (orden.estado === 'pagado') {
      ordenesPagadas += 1;
      montoPagadoPYG += orden.montoPYG;
      const plan = getPlanById(orden.planId);
      if (plan && !plan.esEvento) {
        mrrEstimadoPYG +=
          orden.ciclo === 'anual' ? Math.round(orden.montoPYG / 12) : orden.montoPYG;
      }
    } else if (
      orden.estado === 'pendiente' ||
      orden.estado === 'instrucciones_enviadas' ||
      orden.estado === 'comprobante_recibido'
    ) {
      ordenesPendientes += 1;
    }
  }

  return {
    totalOrdenes: ordenes.length,
    ordenesPagadas,
    ordenesPendientes,
    montoTotalPYG,
    montoPagadoPYG,
    mrrEstimadoPYG,
  };
}
