/**
 * MODAL DEL CENTRO DE CONTROL ADMINISTRATIVO — LABORAPY (ADMIN HUB)
 * Punto de mando protegido para gestionar Leads Comerciales, Webhooks, Meta Ads y 2FA
 * Versión: PY-ADMIN-HUB-2FA-2026.09.07
 */

import React, { useState, useEffect } from 'react';
import {
  logoutAdmin,
  changeAdminPassword,
  getAdminSecurityProfile,
  is2FAConfigured,
  revokeAllTrustedDevices,
  regenerateBackupCodes,
  reset2FAProfile,
  type AdminSecurityProfile,
} from '../services/adminAuthService';
import { getLeadMetrics, type LeadMetrics } from '../../lead/services/leadService';
import { getMetaPixelId } from '../../analytics/metaPixel';
import { getTobiLearningMetrics } from '../services/tobiLearningService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommercial: () => void;
  onOpenMetaPixel: () => void;
  onLogout: () => void;
  onReconfigure2FA?: () => void;
  onOpenClientERP?: () => void;
  onOpenTobiLearning?: () => void;
}

export const AdminHubModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenCommercial,
  onOpenMetaPixel,
  onLogout,
  onReconfigure2FA,
  onOpenClientERP,
  onOpenTobiLearning,
}) => {
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [pixelId, setPixelId] = useState('');
  const [securityProfile, setSecurityProfile] = useState<AdminSecurityProfile | null>(null);
  const [tobiPendingCount, setTobiPendingCount] = useState(0);

  // Cambio de contraseña
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Gestión de Códigos de Respaldo
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [securityFeedback, setSecurityFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMetrics(getLeadMetrics());
      setPixelId(getMetaPixelId());
      setSecurityProfile(getAdminSecurityProfile());
      void getTobiLearningMetrics().then(m => setTobiPendingCount(m.pending)).catch(() => {});
      setShowPasswordChange(false);
      setCurrentPass('');
      setNewPass('');
      setPassError('');
      setPassSuccess('');
      setNewBackupCodes(null);
      setSecurityFeedback('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = () => {
    logoutAdmin();
    onLogout();
    onClose();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    setIsChangingPass(true);

    try {
      const result = await changeAdminPassword(currentPass, newPass);
      if (result.success) {
        setPassSuccess('Contraseña de administrador actualizada con éxito.');
        setCurrentPass('');
        setNewPass('');
        setTimeout(() => {
          setShowPasswordChange(false);
          setPassSuccess('');
        }, 2000);
      } else {
        setPassError(result.error || 'Error al cambiar la contraseña.');
      }
    } catch {
      setPassError('Error al procesar el cambio de clave.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleRegenerateCodes = async () => {
    try {
      const codes = await regenerateBackupCodes();
      setNewBackupCodes(codes);
      setSecurityFeedback('Nuevos códigos de respaldo generados correctamente.');
      setSecurityProfile(getAdminSecurityProfile());
    } catch {
      setSecurityFeedback('Error al generar nuevos códigos.');
    }
  };

  const handleRevokeDevices = () => {
    revokeAllTrustedDevices();
    setSecurityProfile(getAdminSecurityProfile());
    setSecurityFeedback('Se han revocado todos los dispositivos vinculados. Deberán ingresar con 2FA.');
  };

  const handleReset2FA = () => {
    if (confirm('¿Está seguro de restablecer el 2FA? Deberá volver a escanear el QR y vincular su celular.')) {
      reset2FAProfile();
      setSecurityProfile(null);
      setSecurityFeedback('2FA restablecido.');
      if (onReconfigure2FA) {
        onClose();
        onReconfigure2FA();
      }
    }
  };

  const is2FAActive = is2FAConfigured();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="admin-hub-modal-box"
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '580px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px #334155',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            borderRadius: '6px',
          }}
          aria-label="Cerrar ventana"
        >
          ✕
        </button>

        {/* Encabezado y Estado de Sesión */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              border: '1px solid #3b82f6',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Centro de Control Administrativo
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid #10b981',
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  fontWeight: '600',
                }}
              >
                Sesión 2FA Activa
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
              LaboraPy — Panel Comercial, Leads, Meta Ads y Seguridad Criptográfica
            </p>
          </div>
        </div>

        {/* Tarjeta de Seguridad 2FA y Dispositivos Vinculados */}
        {securityProfile && is2FAActive && (
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>📱</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8' }}>
                  2FA Authenticator & Dispositivos Vinculados
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: '600' }}>● Activo</span>
            </div>

            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '10px' }}>
              <div>• <strong>Celular Vinculado:</strong> {securityProfile.phone}</div>
              <div>• <strong>Correo Administrador:</strong> {securityProfile.email}</div>
              <div>• <strong>Dispositivos de Confianza:</strong> {securityProfile.trustedDevices?.length || 0} registrados</div>
            </div>

            {securityFeedback && (
              <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '10px' }}>
                ℹ️ {securityFeedback}
              </div>
            )}

            {/* Mostrar nuevos códigos de respaldo si se generaron */}
            {newBackupCodes && (
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#fbbf24', marginBottom: '6px' }}>
                  Nuevos Códigos de Respaldo de Emergencia:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}>
                  {newBackupCodes.map((c, i) => (
                    <span key={i} style={{ backgroundColor: '#1e293b', padding: '3px', borderRadius: '4px' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRegenerateCodes}
                style={{
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                🔑 Ver/Regenerar Códigos Respaldo
              </button>
              <button
                type="button"
                onClick={handleRevokeDevices}
                style={{
                  backgroundColor: '#334155',
                  color: '#fca5a5',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                🚫 Revocar Otros Dispositivos
              </button>
              <button
                type="button"
                onClick={handleReset2FA}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                🔄 Reconfigurar
              </button>
            </div>
          </div>
        )}

        {/* Métricas Resumidas */}
        {metrics && (
          <div
            className="admin-metrics-grid"
            style={{
              display: 'grid',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Leads</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                {metrics.totalLeads}
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Empresas B2B</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                {metrics.b2bCount}
              </div>
            </div>
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #334155',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Pend. Webhook</div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: metrics.unsyncedCount > 0 ? '#fbbf24' : '#94a3b8',
                  marginTop: '2px',
                }}
              >
                {metrics.unsyncedCount}
              </div>
            </div>
          </div>
        )}

        {/* Botones de Módulos Principales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* Módulo Comercial & Leads */}
          <button
            onClick={() => {
              onClose();
              onOpenCommercial();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#34d399';
              e.currentTarget.style.backgroundColor = '#1f3440';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#334155';
              e.currentTarget.style.backgroundColor = '#1e293b';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>💼</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>
                  Panel Comercial & Base de Leads
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Ver contactos capturados, exportar CSV/JSON y sincronizar CRM.
                </div>
              </div>
            </div>
            <span style={{ color: '#34d399', fontSize: '18px' }}>➔</span>
          </button>

          {/* Módulo Portal ERP de Clientes (Supervisión) */}
          {onOpenClientERP && (
            <button
              onClick={() => {
                onClose();
                onOpenClientERP();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.backgroundColor = '#162b45';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#334155';
                e.currentTarget.style.backgroundColor = '#1e293b';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🏢</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>
                    Portal de Clientes ERP (Supervisión Staff)
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Ingresar a empresas clientes, nóminas, contratos, IPS y libros MTESS.
                  </div>
                </div>
              </div>
              <span style={{ color: '#38bdf8', fontSize: '18px' }}>➔</span>
            </button>
          )}

          {/* Módulo Centro de Aprendizaje Pericial de Tobi */}
          {onOpenTobiLearning && (
            <button
              onClick={() => {
                onClose();
                onOpenTobiLearning();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                backgroundColor: '#1e293b',
                border: '1px solid #6366f1',
                borderRadius: '12px',
                color: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#a855f7';
                e.currentTarget.style.backgroundColor = '#251b3d';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.backgroundColor = '#1e293b';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🧠</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>
                      Centro de Aprendizaje de Tobi
                    </span>
                    {tobiPendingCount > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          backgroundColor: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid #f59e0b',
                          borderRadius: '9999px',
                          padding: '1px 7px',
                          fontWeight: '600',
                        }}
                      >
                        {tobiPendingCount} pendiente(s)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Auditar casos reales, autorizar aprendizaje pericial y fijar criterios oficiales.
                  </div>
                </div>
              </div>
              <span style={{ color: '#a855f7', fontSize: '18px' }}>➔</span>
            </button>
          )}

          {/* Módulo Meta Ads */}
          <button
            onClick={() => {
              onClose();
              onOpenMetaPixel();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#60a5fa';
              e.currentTarget.style.backgroundColor = '#1e2c44';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#334155';
              e.currentTarget.style.backgroundColor = '#1e293b';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🎯</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>
                  Configuración de Meta Ads (Pixel)
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {pixelId ? `Pixel Activo (${pixelId})` : 'Pixel no configurado'} · Conversiones FB & IG
                </div>
              </div>
            </div>
            <span style={{ color: '#60a5fa', fontSize: '18px' }}>➔</span>
          </button>
        </div>

        {/* Sección de Cambio de Contraseña */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12.5px',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🔑</span>
            <span>{showPasswordChange ? 'Ocultar cambio de contraseña' : 'Cambiar contraseña de administrador'}</span>
          </button>

          {showPasswordChange && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '12px' }}>
              {passError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px' }}>
                  ⚠️ {passError}
                </div>
              )}
              {passSuccess && (
                <div style={{ color: '#34d399', fontSize: '12px', marginBottom: '8px' }}>
                  ✅ {passSuccess}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="password"
                  placeholder="Contraseña actual"
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                />
                <input
                  type="password"
                  placeholder="Nueva contraseña (mín 8 car.)"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isChangingPass || !currentPass || !newPass}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: isChangingPass ? 'not-allowed' : 'pointer',
                }}
              >
                {isChangingPass ? 'Guardando...' : 'Actualizar Clave'}
              </button>
            </form>
          )}
        </div>

        {/* Barra Inferior: Cerrar Sesión */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #1e293b',
            paddingTop: '14px',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Atajo: <kbd style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + Shift + A</kbd>
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};
