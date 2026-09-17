/**
 * MODAL DE PLANES, PRICING Y CHECKOUT — LABORAPY
 * Diseño corporativo moderno con selector de planes en Guaraníes (PYG),
 * toggle mensual/anual con ahorro, pasarela SIPAP / QR / WhatsApp y confirmación.
 * Versión: PY-SUB-2026.09.16
 */

import React, { useState } from 'react';
import {
  NOTA_PRECIOS_PYG,
  PAYMENT_METHODS,
  PLANES_EVENTO,
  PLANES_RECURRENTES,
  PLAN_POR_DEFECTO,
  SIPAP_BANK_DATA,
  calcularPrecioPlan,
  formatPYG,
  getPlanById,
} from '../constants';
import {
  createSubscriptionOrder,
} from '../services/subscriptionService';
import type {
  BillingCycle,
  MetodoPagoId,
  PaymentOrder,
  PlanId,
} from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultPlanId?: PlanId;
  onOrderCreated?: (order: PaymentOrder) => void;
}

type Paso = 'planes' | 'pago' | 'confirmacion';

export const PricingPlansModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultPlanId = PLAN_POR_DEFECTO,
  onOrderCreated,
}) => {
  const [paso, setPaso] = useState<Paso>('planes');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(defaultPlanId);
  const [ciclo, setCiclo] = useState<BillingCycle>('mensual');
  const [metodoPago, setMetodoPago] = useState<MetodoPagoId>('sipap');

  // Formulario de datos
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [notas] = useState('');

  // Orden creada
  const [ordenCreada, setOrdenCreada] = useState<PaymentOrder | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const planSeleccionado = getPlanById(selectedPlanId) || PLANES_RECURRENTES[1];
  const cicloEfectivo: BillingCycle = planSeleccionado.esEvento ? 'unico' : ciclo;
  const precioEfectivo = calcularPrecioPlan(planSeleccionado, cicloEfectivo);

  const handleSeleccionarPlan = (planId: PlanId) => {
    setSelectedPlanId(planId);
    const p = getPlanById(planId);
    if (p?.esEvento) {
      setCiclo('unico');
    } else if (ciclo === 'unico') {
      setCiclo('mensual');
    }
    setPaso('pago');
  };

  const handleCrearOrden = (e: React.FormEvent) => {
    e.preventDefault();
    const orden = createSubscriptionOrder({
      planId: selectedPlanId,
      ciclo: cicloEfectivo,
      metodoPago,
      clienteNombre,
      clienteEmail,
      clienteTelefono,
      empresaNombre,
      ruc,
      notas,
    });

    setOrdenCreada(orden);
    if (onOrderCreated) {
      onOrderCreated(orden);
    }
    setPaso('confirmacion');
  };

  const handleCopiarDatosBancarios = () => {
    const texto = `BANCO: ${SIPAP_BANK_DATA.banco}\nTITULAR: ${SIPAP_BANK_DATA.titular}\nRUC: ${SIPAP_BANK_DATA.ruc}\nCUENTA: ${SIPAP_BANK_DATA.numeroCuenta} (${SIPAP_BANK_DATA.tipoCuenta})\nALIAS: ${SIPAP_BANK_DATA.alias}\nORDEN: ${ordenCreada?.numeroOrden || 'LAB-ORDEN'}`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const handleAbrirWhatsApp = () => {
    if (ordenCreada?.whatsappUrl) {
      window.open(ordenCreada.whatsappUrl, '_blank');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          maxWidth: 1100,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f8fafc',
        }}
      >
        {/* ── Encabezado ── */}
        <header
          style={{
            padding: '16px 24px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Planes Oficiales & Pasarela PYG
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ffffff' }}>
              {paso === 'planes' && 'Elegí el Plan Ideal para tu Empresa'}
              {paso === 'pago' && `Checkout · Plan ${planSeleccionado.nombre}`}
              {paso === 'confirmacion' && '¡Orden de Pago Generada con Éxito!'}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </header>

        {/* ── Barra de Pasos ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#090d16', padding: '8px 24px', gap: 16, fontSize: 12 }}>
          <span style={{ color: paso === 'planes' ? '#38bdf8' : '#94a3b8', fontWeight: paso === 'planes' ? 700 : 500 }}>
            1. Planes & Precios
          </span>
          <span style={{ color: '#475569' }}>➔</span>
          <span style={{ color: paso === 'pago' ? '#38bdf8' : '#94a3b8', fontWeight: paso === 'pago' ? 700 : 500 }}>
            2. Datos & Método de Pago
          </span>
          <span style={{ color: '#475569' }}>➔</span>
          <span style={{ color: paso === 'confirmacion' ? '#38bdf8' : '#94a3b8', fontWeight: paso === 'confirmacion' ? 700 : 500 }}>
            3. Confirmación
          </span>
        </div>

        {/* ── Cuerpo Scrollable ── */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* PASO 1: SELECCIÓN DE PLANES */}
          {paso === 'planes' && (
            <div>
              {/* Toggle Mensual / Anual */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 13, color: ciclo === 'mensual' ? '#ffffff' : '#94a3b8', fontWeight: ciclo === 'mensual' ? 700 : 500 }}>
                  Facturación Mensual
                </span>
                <button
                  type="button"
                  onClick={() => setCiclo(ciclo === 'mensual' ? 'anual' : 'mensual')}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 20,
                    width: 48,
                    height: 26,
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: '#38bdf8',
                      position: 'absolute',
                      top: 2,
                      left: ciclo === 'anual' ? 24 : 2,
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: ciclo === 'anual' ? '#ffffff' : '#94a3b8', fontWeight: ciclo === 'anual' ? 700 : 500 }}>
                    Facturación Anual
                  </span>
                  <span style={{ background: '#16a34a', color: '#ffffff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                    2 MESES GRATIS
                  </span>
                </div>
              </div>

              {/* Grid de Planes Recurrentes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                {PLANES_RECURRENTES.map((plan) => {
                  const precio = calcularPrecioPlan(plan, ciclo);
                  const isDestacado = plan.destacado;
                  return (
                    <div
                      key={plan.id}
                      style={{
                        background: isDestacado ? '#1e293b' : '#0f172a',
                        border: isDestacado ? '2px solid #38bdf8' : '1px solid #334155',
                        borderRadius: 12,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                    >
                      {plan.badge && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -10,
                            right: 16,
                            background: '#38bdf8',
                            color: '#0f172a',
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 10,
                            textTransform: 'uppercase',
                          }}
                        >
                          {plan.badge}
                        </div>
                      )}

                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0', color: '#ffffff' }}>
                          {plan.nombre}
                        </h3>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0', minHeight: 32 }}>
                          {plan.descripcion}
                        </p>

                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontSize: 26, fontWeight: 800, color: '#ffffff' }}>
                            {plan.precioMensualPYG === 0 ? 'Gratis' : formatPYG(precio)}
                          </span>
                          {plan.precioMensualPYG > 0 && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>
                              {ciclo === 'anual' ? ' / año' : ' / mes'}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', marginBottom: 12 }}>
                          👥 {plan.limiteEmpleadosLabel}
                        </div>

                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                          {plan.features.map((feat, i) => (
                            <li key={i} style={{ display: 'flex', gap: 6, color: '#cbd5e1' }}>
                              <span style={{ color: '#22c55e' }}>✓</span> {feat}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => handleSeleccionarPlan(plan.id)}
                        style={{
                          marginTop: 20,
                          background: isDestacado ? '#38bdf8' : '#334155',
                          color: isDestacado ? '#0f172a' : '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        {plan.ctaLabel}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Servicios por Evento */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e293b' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: '#94a3b8' }}>
                  O Servicios por Evento Único (Sin Suscripción)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {PLANES_EVENTO.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: '#131b2e',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                        padding: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: '#ffffff' }}>{p.nombre}</strong>
                        <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700 }}>
                          {formatPYG(p.precioMensualPYG)} (pago único)
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.descripcion}</div>
                      </div>
                      <button
                        onClick={() => handleSeleccionarPlan(p.id)}
                        style={{
                          background: '#334155',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Comprar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: FORMULARIO Y MÉTODO DE PAGO */}
          {paso === 'pago' && (
            <form onSubmit={handleCrearOrden}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {/* Columna Izquierda: Datos del Cliente */}
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', color: '#ffffff' }}>
                    1. Datos de Facturación
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Razón Social / Empresa
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Comercial Guaraní S.A."
                        value={empresaNombre}
                        onChange={(e) => setEmpresaNombre(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                          RUC
                        </label>
                        <input
                          type="text"
                          placeholder="80012345-6"
                          value={ruc}
                          onChange={(e) => setRuc(e.target.value)}
                          style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '8px 12px',
                            color: '#ffffff',
                            fontSize: 13,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                          Teléfono / WhatsApp *
                        </label>
                        <input
                          type="text"
                          placeholder="0981 123 456"
                          required
                          value={clienteTelefono}
                          onChange={(e) => setClienteTelefono(e.target.value)}
                          style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 6,
                            padding: '8px 12px',
                            color: '#ffffff',
                            fontSize: 13,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Nombre del Contacto *
                      </label>
                      <input
                        type="text"
                        placeholder="Juan Pérez"
                        required
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        placeholder="contacto@empresa.com.py"
                        required
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Método de Pago & Resumen */}
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', color: '#ffffff' }}>
                    2. Método de Pago en Paraguay
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {PAYMENT_METHODS.map((met) => (
                      <div
                        key={met.id}
                        onClick={() => setMetodoPago(met.id)}
                        style={{
                          background: metodoPago === met.id ? '#1e293b' : '#0f172a',
                          border: metodoPago === met.id ? '2px solid #38bdf8' : '1px solid #334155',
                          borderRadius: 8,
                          padding: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{met.icono}</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 13, color: '#ffffff', display: 'block' }}>
                            {met.nombre}
                          </strong>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{met.descripcion}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de la Orden */}
                  <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, border: '1px solid #334155' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Total a Abonar:</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', marginBottom: 6 }}>
                      {formatPYG(precioEfectivo)}
                    </div>
                    <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                      Plan {planSeleccionado.nombre} ({planSeleccionado.esEvento ? 'Pago único' : ciclo === 'anual' ? 'Anual' : 'Mensual'})
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                      {NOTA_PRECIOS_PYG}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Navegación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e293b' }}>
                <button
                  type="button"
                  onClick={() => setPaso('planes')}
                  style={{
                    background: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Volver a Planes
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Generar Orden & Instrucciones ➔
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: CONFIRMACIÓN DE ORDEN */}
          {paso === 'confirmacion' && ordenCreada && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <span style={{ fontSize: 48 }}>🎉</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '8px 0', color: '#ffffff' }}>
                ¡Orden de Pago {ordenCreada.numeroOrden} Registrada!
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 500, margin: '0 auto 20px auto' }}>
                Tu solicitud para el <strong>Plan {ordenCreada.planNombre}</strong> por{' '}
                <strong style={{ color: '#38bdf8' }}>{formatPYG(ordenCreada.montoPYG)}</strong> ha sido creada.
              </p>

              {/* Datos Bancarios SIPAP */}
              {ordenCreada.metodoPago === 'sipap' && (
                <div
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: 18,
                    maxWidth: 540,
                    margin: '0 auto 20px auto',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <strong style={{ fontSize: 13, color: '#38bdf8' }}>Datos para Transferencia SIPAP:</strong>
                    <button
                      onClick={handleCopiarDatosBancarios}
                      style={{
                        background: '#334155',
                        border: 'none',
                        color: '#ffffff',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {copiado ? '✓ Copiado' : '📋 Copiar Datos'}
                    </button>
                  </div>

                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#cbd5e1' }}>
                    <div><strong>Banco:</strong> {SIPAP_BANK_DATA.banco}</div>
                    <div><strong>Titular:</strong> {SIPAP_BANK_DATA.titular}</div>
                    <div><strong>RUC:</strong> {SIPAP_BANK_DATA.ruc}</div>
                    <div><strong>Cuenta:</strong> {SIPAP_BANK_DATA.numeroCuenta} ({SIPAP_BANK_DATA.tipoCuenta})</div>
                    <div><strong>Alias SIPAP:</strong> {SIPAP_BANK_DATA.alias}</div>
                    <div><strong>Concepto Obligatorio:</strong> {ordenCreada.referenciaPago}</div>
                  </div>
                </div>
              )}

              {/* Botón WhatsApp de Confirmación */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={handleAbrirWhatsApp}
                  style={{
                    background: '#25d366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>💬</span> Enviar Comprobante por WhatsApp
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
