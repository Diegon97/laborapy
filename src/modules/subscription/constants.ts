/**
 * CATÁLOGO COMERCIAL Y PARÁMETROS DE PAGO — SUSCRIPCIONES LABORAPY
 * Planes oficiales en Guaraníes (PYG) con IVA 10% incluido y datos de cobro
 * para transferencias SIPAP / QR Bancario / WhatsApp Asistido.
 * Versión: PY-SUB-2026.09.16
 */

import { LABORAPY_CONFIG } from '../../config/laborapy';
import type {
  BillingCycle,
  DatosBancariosSIPAP,
  MetodoPagoId,
  MetodoPagoInfo,
  PlanId,
  PlanPricing,
  SubscriptionPlan,
} from './types';

export const MESES_GRATIS_PLAN_ANUAL = 2;
export const MESES_FACTURADOS_PLAN_ANUAL = 12 - MESES_GRATIS_PLAN_ANUAL;
export const NOTA_PRECIOS_PYG = 'Precios en guaraníes (PYG) con IVA 10% incluido.';
export const PLAN_POR_DEFECTO: PlanId = 'profesional';

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: 'free',
    nombre: 'Free',
    descripcion: 'Para probar la calculadora y resolver consultas puntuales sin costo.',
    precioMensualPYG: 0,
    limiteEmpleados: 3,
    limiteEmpleadosLabel: 'Hasta 3 empleados',
    esEvento: false,
    destacado: false,
    ctaLabel: 'Comenzar gratis',
    moneyMakers: ['1 finiquito blindado por mes'],
    features: [
      'Calculadora de liquidación completa (Ley 213/93)',
      '1 finiquito blindado por mes',
      'Descarga de documentos en PDF y Word',
      'Captura de leads y consultas por WhatsApp',
    ],
  },
  {
    id: 'profesional',
    nombre: 'Profesional',
    descripcion: 'Para estudios contables y PyMEs que liquidan nómina todos los meses.',
    precioMensualPYG: 149_000,
    limiteEmpleados: 25,
    limiteEmpleadosLabel: 'Hasta 25 empleados',
    esEvento: false,
    destacado: true,
    badge: 'Más elegido',
    ctaLabel: 'Suscribirme',
    moneyMakers: ['Finiquitos blindados ilimitados'],
    features: [
      'Finiquitos blindados ilimitados con sello criptográfico',
      'Nómina mensual editable y cierre de planilla',
      'Recibos de salario en PDF y Word',
      'Exportaciones MTESS / REOP y aportes IPS',
      'Soporte por WhatsApp en horario laboral',
    ],
  },
  {
    id: 'business',
    nombre: 'Business',
    descripcion: 'ERP de RRHH con Copilot legal y auditoría preventiva Pre-MTESS.',
    precioMensualPYG: 449_000,
    limiteEmpleados: 120,
    limiteEmpleadosLabel: 'Hasta 120 empleados',
    esEvento: false,
    destacado: false,
    ctaLabel: 'Suscribirme',
    moneyMakers: ['Finiquitos blindados', 'Copilot RRHH', 'Auditoría MTESS'],
    features: [
      'Todo lo incluido en Profesional',
      'Copilot RRHH (asistente de derecho laboral paraguayo)',
      'Auditoría patronal Pre-MTESS de la nómina',
      'Portal de clientes multi-usuario',
      'Multi-sucursal hasta 5 sedes',
    ],
  },
  {
    id: 'enterprise',
    nombre: 'Enterprise',
    descripcion: 'Operación multi-sucursal con SLA, integraciones y acompañamiento dedicado.',
    precioMensualPYG: 1_190_000,
    limiteEmpleados: null,
    limiteEmpleadosLabel: 'Empleados ilimitados',
    esEvento: false,
    destacado: false,
    badge: 'A medida',
    ctaLabel: 'Coordinar propuesta',
    moneyMakers: ['Todos los Money-Makers', 'Nómina Multi-Sucursal', 'SLA'],
    features: [
      'Todos los Money-Makers incluidos',
      'Nómina Multi-Sucursal sin límite de sedes',
      'Onboarding y capacitación asistida',
      'SLA de soporte prioritario',
      'Integración SIFEN y API para sistemas propios',
    ],
  },
  {
    id: 'finiquito_suelto',
    nombre: 'Finiquito Suelto',
    descripcion: 'Liquidación final puntual con validez jurídica para presentar.',
    precioMensualPYG: 45_000,
    limiteEmpleados: null,
    limiteEmpleadosLabel: 'Un trabajador por orden',
    esEvento: true,
    destacado: false,
    ctaLabel: 'Pagar finiquito',
    moneyMakers: ['Finiquito blindado por evento'],
    features: [
      'Una liquidación final completa',
      'Sello criptográfico de integridad documental',
      'Descarga PDF y Word lista para firma',
    ],
  },
  {
    id: 'auditoria_suelta',
    nombre: 'Auditoría Suelta',
    descripcion: 'Escaneo Pre-MTESS de tu nómina antes de una inspección.',
    precioMensualPYG: 450_000,
    limiteEmpleados: null,
    limiteEmpleadosLabel: 'Una nómina por orden',
    esEvento: true,
    destacado: false,
    ctaLabel: 'Pagar auditoría',
    moneyMakers: ['Auditoría Patronal Pre-MTESS por evento'],
    features: [
      'Escaneo Pre-MTESS de una nómina completa',
      'Detección de omisiones de aportes IPS y aguinaldos',
      'Informe ejecutivo PDF con multas estimadas',
    ],
  },
];

export const PLANES_RECURRENTES: readonly SubscriptionPlan[] = SUBSCRIPTION_PLANS.filter(
  (plan) => !plan.esEvento,
);

export const PLANES_EVENTO: readonly SubscriptionPlan[] = SUBSCRIPTION_PLANS.filter(
  (plan) => plan.esEvento,
);

export function getPlanById(planId: PlanId): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

export function calcularPrecioPlan(plan: SubscriptionPlan, ciclo: BillingCycle): number {
  if (plan.esEvento) return plan.precioMensualPYG;
  if (ciclo === 'anual') return plan.precioMensualPYG * MESES_FACTURADOS_PLAN_ANUAL;
  return plan.precioMensualPYG;
}

export function getPlanPricing(planId: PlanId, ciclo: BillingCycle): PlanPricing {
  const plan = getPlanById(planId);
  if (!plan) {
    throw new Error(`Plan no reconocido: ${planId}`);
  }
  const cicloEfectivo: BillingCycle = plan.esEvento ? 'unico' : ciclo;
  const montoPYG = calcularPrecioPlan(plan, cicloEfectivo);
  const precioMensualEquivalentePYG =
    cicloEfectivo === 'anual' ? Math.round(montoPYG / 12) : montoPYG;
  const ahorroPYG =
    cicloEfectivo === 'anual' ? plan.precioMensualPYG * MESES_GRATIS_PLAN_ANUAL : 0;
  return {
    planId: plan.id,
    ciclo: cicloEfectivo,
    montoPYG,
    precioMensualEquivalentePYG,
    ahorroPYG,
  };
}

export const PAYMENT_METHODS: readonly MetodoPagoInfo[] = [
  {
    id: 'sipap',
    nombre: 'Transferencia SIPAP',
    descripcion: 'Transferencia interbancaria 24/7 al instante desde tu banco o billetera.',
    icono: '🏦',
    tiempoAcreditacion: 'Acreditación inmediata 24/7',
    requiereComprobante: true,
    instrucciones: [
      'Transferí el monto exacto desde tu banco usando los datos de la cuenta.',
      'Incluí el número de orden en el concepto de la transferencia.',
      'Enviá el comprobante por WhatsApp para activar tu cuenta.',
    ],
  },
  {
    id: 'qr_bancario',
    nombre: 'QR Bancario',
    descripcion: 'Escaneá el QR dinámico con la app de tu banco y pagá en segundos.',
    icono: '📱',
    tiempoAcreditacion: 'Acreditación inmediata',
    requiereComprobante: true,
    instrucciones: [
      'Solicitá el QR dinámico de tu orden por WhatsApp.',
      'Escanealo desde la app de tu banco o billetera electrónica.',
      'Reenviá el comprobante generado para confirmar la activación.',
    ],
  },
  {
    id: 'whatsapp_asistido',
    nombre: 'WhatsApp Asistido',
    descripcion: 'Un asesor comercial cierra la suscripción y activa tu cuenta contigo.',
    icono: '💬',
    tiempoAcreditacion: 'Activación en menos de 24 h hábiles',
    requiereComprobante: false,
    instrucciones: [
      'Generá la orden y abrí la conversación de WhatsApp con el mensaje precargado.',
      'Un asesor confirma el plan, el monto y el medio de pago disponible.',
      'Recibís la activación y la factura electrónica de tu suscripción.',
    ],
  },
];

export function getMetodoPagoById(metodoPago: MetodoPagoId): MetodoPagoInfo | undefined {
  return PAYMENT_METHODS.find((metodo) => metodo.id === metodoPago);
}

export const SIPAP_BANK_DATA: DatosBancariosSIPAP = {
  titular: `${LABORAPY_CONFIG.shortBrandName} - Soluciones Laborales y Contables`,
  ruc: '80012345-6',
  banco: 'Banco Continental S.A.E.C.A.',
  tipoCuenta: 'Cuenta Corriente',
  numeroCuenta: '000-0000000-0',
  moneda: 'Guaraníes (PYG)',
  alias: 'laborapy.pagos',
  conceptoBase: 'Suscripción LaboraPy',
};

export function formatPYG(monto: number): string {
  return 'Gs. ' + Math.round(monto).toLocaleString('es-PY');
}
