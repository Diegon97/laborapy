import { describe, it, expect, beforeEach } from 'vitest';
import {
  SUBSCRIPTION_PLANS,
  calcularPrecioPlan,
  getPlanById,
  getPlanPricing,
  formatPYG,
  createSubscriptionOrder,
  getStoredOrders,
  clearStoredOrders,
  updateOrderStatus,
  getSubscriptionMetrics,
} from '../index';

describe('Módulo de Suscripciones y Checkout — subscriptionService', () => {
  beforeEach(() => {
    clearStoredOrders();
  });

  it('cuenta con el catálogo oficial de planes con precios en Guaraníes (PYG)', () => {
    expect(SUBSCRIPTION_PLANS.length).toBeGreaterThanOrEqual(4);
    const free = getPlanById('free');
    const pro = getPlanById('profesional');
    const bus = getPlanById('business');
    const ent = getPlanById('enterprise');

    expect(free?.precioMensualPYG).toBe(0);
    expect(pro?.precioMensualPYG).toBe(149_000);
    expect(bus?.precioMensualPYG).toBe(449_000);
    expect(ent?.precioMensualPYG).toBe(1_190_000);
  });

  it('calcula correctamente el precio anual aplicando 2 meses gratis (10 meses facturados)', () => {
    const pro = getPlanById('profesional')!;
    const precioAnual = calcularPrecioPlan(pro, 'anual');
    expect(precioAnual).toBe(149_000 * 10);

    const pricing = getPlanPricing('profesional', 'anual');
    expect(pricing.montoPYG).toBe(1_490_000);
    expect(pricing.ahorroPYG).toBe(298_000);
  });

  it('crea y almacena una orden de pago con número único y URL de WhatsApp', () => {
    const orden = createSubscriptionOrder({
      planId: 'business',
      ciclo: 'mensual',
      metodoPago: 'sipap',
      clienteNombre: 'María Acosta',
      clienteEmail: 'maria@acosta.com.py',
      clienteTelefono: '0981222333',
      empresaNombre: 'Acosta & Asociados',
      ruc: '80055544-3',
    });

    expect(orden.id).toBeDefined();
    expect(orden.numeroOrden).toMatch(/^LAB-\d{8}-[0-9A-F]{4}$/);
    expect(orden.montoPYG).toBe(449_000);
    expect(orden.whatsappUrl).toContain('wa.me');
    expect(orden.whatsappUrl).toContain(encodeURIComponent(orden.numeroOrden));

    const guardadas = getStoredOrders();
    expect(guardadas.length).toBe(1);
    expect(guardadas[0].id).toBe(orden.id);
  });

  it('permite actualizar el estado de una orden y computar métricas comerciales (MRR)', () => {
    const orden = createSubscriptionOrder({
      planId: 'profesional',
      ciclo: 'mensual',
      metodoPago: 'sipap',
    });

    updateOrderStatus(orden.id, 'pagado');

    const metricas = getSubscriptionMetrics();
    expect(metricas.totalOrdenes).toBe(1);
    expect(metricas.ordenesPagadas).toBe(1);
    expect(metricas.montoPagadoPYG).toBe(149_000);
    expect(metricas.mrrEstimadoPYG).toBe(149_000);
  });

  it('formatea montos en Guaraníes con separadores de miles estándar', () => {
    expect(formatPYG(149000)).toBe('Gs. 149.000');
    expect(formatPYG(1190000)).toBe('Gs. 1.190.000');
  });
});
