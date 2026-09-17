/**
 * MODAL DE CAPTURA DE LEADS PARA EMBUDO Y COMERCIO (B2B & B2C)
 * Pasarela previa a la descarga de finiquitos y documentos laborales.
 * Captura datos completos: nombre, email, teléfono, empresa/particular, motivo y monto.
 * Sistema de diseño Linear: Canvas #f8fafc, Surface-1 #ffffff, Surface-2 #f8fafc, Borders #e2e8f0.
 * Versión: PY-LEAD-2026.09.05
 */

import React, { useState, useEffect } from 'react';
import { getLastLeadInfo, recordLead, type TipoUsuario } from './services/leadService';

export interface LeadCapturedData {
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data?: LeadCapturedData) => void;
  documentTitle: string;
  documentFormat: 'pdf' | 'docx';
  montoNeto?: number;
  initialEmpresa?: string;
  initialNombre?: string;
  initialMotivo?: string;
}

export const LeadCaptureModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  documentTitle,
  documentFormat,
  montoNeto,
  initialEmpresa,
  initialNombre,
  initialMotivo,
}) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('empresa');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [errorEmail, setErrorEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      const lastInfo = getLastLeadInfo();
      if (lastInfo.email) setEmail(lastInfo.email);
      if (lastInfo.tipoUsuario) setTipoUsuario(lastInfo.tipoUsuario);
      
      // Nombre
      if (initialNombre && initialNombre.trim()) {
        setNombre(initialNombre.trim());
      } else if (lastInfo.nombre) {
        setNombre(lastInfo.nombre);
      } else {
        setNombre('');
      }

      // Empresa
      if (initialEmpresa && initialEmpresa.trim()) {
        setEmpresaNombre(initialEmpresa.trim());
      } else if (lastInfo.empresa) {
        setEmpresaNombre(lastInfo.empresa);
      } else {
        setEmpresaNombre('');
      }

      // Teléfono
      if (lastInfo.telefono) {
        setTelefonoWhatsApp(lastInfo.telefono);
      } else {
        setTelefonoWhatsApp('');
      }

      // Motivo
      if (initialMotivo && initialMotivo.trim()) {
        setMotivoConsulta(initialMotivo.trim());
      } else {
        setMotivoConsulta(documentTitle || 'Liquidación Laboral');
      }

      setErrorEmail('');
    }
  }, [isOpen, initialEmpresa, initialNombre, initialMotivo, documentTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validación rigurosa de email
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorEmail('Por favor, ingresa un correo electrónico válido (ej: contacto@empresa.com).');
      return;
    }

    // Registrar lead completo para el funnel comercial, CRM y Meta Ads
    recordLead({
      nombre: nombre.trim() || undefined,
      email: trimmedEmail,
      tipoUsuario,
      empresaNombre: empresaNombre.trim() || undefined,
      telefono: telefonoWhatsApp.trim() || undefined,
      telefonoWhatsApp: telefonoWhatsApp.trim() || undefined,
      motivoConsulta: motivoConsulta.trim() || documentTitle,
      calculoEstimado: montoNeto,
      montoNeto,
      documento: documentTitle,
      formato: documentFormat,
    });

    // Proceder con la descarga pasando los datos capturados
    onSuccess({
      nombre: nombre.trim(),
      email: trimmedEmail,
      empresa: empresaNombre.trim(),
      telefono: telefonoWhatsApp.trim(),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          border: '1px solid #e2e8f0',
          fontFamily: 'inherit',
          color: '#0f172a',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Encabezado del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>ðŸ“¥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
                Habilitar Descarga Oficial
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Formato: {documentFormat.toUpperCase()} Â· {documentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            âœ•
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }}>
          Completa tus datos para habilitar la descarga inmediata del documento legal formal y recibir una copia de respaldo.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Segmentación Comercial (Empresa vs Particular) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
              Â¿Para quién es este documento?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setTipoUsuario('empresa')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: tipoUsuario === 'empresa' ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                  background: tipoUsuario === 'empresa' ? '#1c1d28' : '#f8fafc',
                  color: tipoUsuario === 'empresa' ? '#0f172a' : '#64748b',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>ðŸ¢</span>
                <span>Empresa / RRHH</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoUsuario('particular')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: tipoUsuario === 'particular' ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                  background: tipoUsuario === 'particular' ? '#1c1d28' : '#f8fafc',
                  color: tipoUsuario === 'particular' ? '#0f172a' : '#64748b',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>ðŸ‘¤</span>
                <span>Trabajador</span>
              </button>
            </div>
          </div>

          {/* Nombre Completo */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
              Nombre y Apellido (o Contacto):
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Lic. María González"
              style={{
                width: '100%',
                minHeight: '40px',
                fontSize: '13.5px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Campo de Correo Electrónico (Obligatorio) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
              Correo Electrónico <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (errorEmail) setErrorEmail('');
              }}
              placeholder={tipoUsuario === 'empresa' ? 'rrhh@tuempresa.com' : 'tu.correo@gmail.com'}
              style={{
                width: '100%',
                minHeight: '42px',
                fontSize: '13.5px',
                fontWeight: 500,
                background: '#f8fafc',
                border: `1px solid ${errorEmail ? '#f87171' : '#e2e8f0'}`,
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errorEmail && (
              <span style={{ display: 'block', fontSize: '12px', color: '#f87171', marginTop: '5px' }}>
                {errorEmail}
              </span>
            )}
          </div>

          {/* Teléfono / WhatsApp */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
              Teléfono / WhatsApp (Opcional):
            </label>
            <input
              type="tel"
              value={telefonoWhatsApp}
              onChange={e => setTelefonoWhatsApp(e.target.value)}
              placeholder="Ej: 0981 123 456"
              style={{
                width: '100%',
                minHeight: '40px',
                fontSize: '13.5px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Campos adicionales para Empresas (Funnel B2B) */}
          {tipoUsuario === 'empresa' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
                Nombre de la Empresa o Razón Social:
              </label>
              <input
                type="text"
                value={empresaNombre}
                onChange={e => setEmpresaNombre(e.target.value)}
                placeholder="Ej: Distribuidora Central S.A."
                style={{
                  width: '100%',
                  minHeight: '40px',
                  fontSize: '13.5px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  padding: '0 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Motivo de Consulta / Trámite */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
              Motivo o Trámite:
            </label>
            <input
              type="text"
              value={motivoConsulta}
              onChange={e => setMotivoConsulta(e.target.value)}
              placeholder="Ej: Cálculo de Despido / Liquidación Final"
              style={{
                width: '100%',
                minHeight: '40px',
                fontSize: '13.5px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Resumen del Monto Estimado si existe */}
          {montoNeto !== undefined && montoNeto > 0 && (
            <div
              style={{
                padding: '10px 14px',
                background: '#14201a',
                borderRadius: '8px',
                border: '1px solid #1c3829',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Total Estimado a Liquidar:</span>
              <span style={{ fontSize: '14px', color: '#34d399', fontWeight: 700 }}>Gs. {montoNeto.toLocaleString('es-PY')}</span>
            </div>
          )}

          {/* Botón Principal de Descarga */}
          <button
            type="submit"
            style={{
              minHeight: '46px',
              fontSize: '14.5px',
              borderRadius: '8px',
              marginBottom: '10px',
              width: '100%',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0369a1')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0284c7')}
          >
            ðŸš€ Habilitar y Descargar {documentFormat.toUpperCase()}
          </button>

          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
            ðŸ”’ Tus datos están protegidos y sólo se utilizarán para fines del servicio laboral conforme a la ley.
          </p>
        </form>
      </div>
    </div>
  );
};
