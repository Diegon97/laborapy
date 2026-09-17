/**
 * MODAL DE INICIO DE SESIÓN — PORTAL DE CLIENTES (ERP LABORAPY)
 * Acceso seguro, credenciales protegidas, recordar datos, protocolo de olvido de contraseña
 * y diseño responsivo adaptado para Web y Dispositivos Móviles (iOS y Android).
 */

import React, { useState, useEffect } from 'react';
import {
  loginClient,
  checkLockout,
  getRememberedEmail,
  setRememberedEmail,
  requestClientPasswordReset,
  confirmClientPasswordReset,
  isDemoLoginEnabled,
} from '../services/clientAuthService';
import { createWhatsAppUrl } from '../../../config/laborapy';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const ClientLoginModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [view, setView] = useState<'login' | 'forgot_password'>('login');

  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de Recuperación de Contraseña
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Contador de cuenta regresiva si la cuenta está bloqueada temporalmente
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Inicialización y carga de credenciales recordadas al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const savedEmail = getRememberedEmail();
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
        const lock = checkLockout(savedEmail);
        setLockoutRemaining(lock.isLocked ? lock.remainingSeconds : 0);
      } else {
        setEmail('');
        setRememberMe(false);
        setLockoutRemaining(0);
      }
      setPassword('');
      setError('');
      setShowPassword(false);
      setLoading(false);
      setView('login');
      setRecoveryError('');
      setRecoverySuccess('');
      setGeneratedCode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const lock = checkLockout(cleanEmail);
    if (lock.isLocked) {
      setLockoutRemaining(lock.remainingSeconds);
      setError(`Cuenta bloqueada temporalmente por seguridad. Reintente en ${lock.remainingSeconds}s.`);
      return;
    }

    setLoading(true);

    try {
      const res = await loginClient(cleanEmail, password);
      if (res.success) {
        // Guardar o borrar preferencia de recordar correo
        setRememberedEmail(cleanEmail, rememberMe);
        onLoginSuccess();
      } else {
        setError(res.error || 'Credenciales inválidas.');
        const postLock = checkLockout(cleanEmail);
        if (postLock.isLocked) {
          setLockoutRemaining(postLock.remainingSeconds);
        }
      }
    } catch {
      setError('Error de comunicación con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecoveryToken = async () => {
    setRecoveryError('');
    setRecoverySuccess('');
    setGeneratedCode(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError('Ingrese su correo corporativo para solicitar el código.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await requestClientPasswordReset(cleanEmail);
      if (res.success && res.token) {
        setGeneratedCode(res.token);
        setRecoveryToken(res.token);
        setRecoverySuccess('Código de verificación generado con validez de 15 minutos.');
      } else {
        setRecoveryError(res.error || 'No se pudo generar el código de recuperación.');
      }
    } catch {
      setRecoveryError('Error al contactar con el servicio de autenticación.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    const cleanToken = recoveryToken.trim();
    const cleanPass = newPassword.trim();

    if (!cleanEmail || !cleanToken || !cleanPass) {
      setRecoveryError('Complete todos los campos requeridos.');
      return;
    }

    if (cleanPass.length < 6) {
      setRecoveryError('La contraseña debe contener al menos 6 caracteres.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setRecoveryError('Las contraseñas no coinciden. Verifíquelas.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await confirmClientPasswordReset(cleanEmail, cleanToken, cleanPass);
      if (res.success) {
        setRecoverySuccess('¡Contraseña restablecida con éxito! Ya puedes iniciar sesión.');
        setEmail(cleanEmail);
        setPassword('');
        setRecoveryToken('');
        setNewPassword('');
        setConfirmPassword('');
        setGeneratedCode(null);
      } else {
        setRecoveryError(res.error || 'No se pudo actualizar la contraseña.');
      }
    } catch {
      setRecoveryError('Error al procesar el cambio de contraseña.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const isBlocked = lockoutRemaining > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
          overflowY: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado Corporativo */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '20px 24px',
            color: '#fff',
            position: 'relative',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#64748b',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >
            ✕
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🏢</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LaboraPy · Portal Empresas
              </div>
              <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {view === 'login' ? 'Acceso a Clientes ERP' : 'Recuperar Contraseña'}
              </h3>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: '1.4' }}>
            {view === 'login'
              ? 'Gestión confidencial de nóminas, contratos, extractos IPS y libros MTESS.'
              : 'Protocolo de seguridad y restablecimiento de credenciales corporativas.'}
          </p>
        </div>

        {/* ── VISTA 1: FORMULARIO DE INICIO DE SESIÓN ── */}
        {view === 'login' && (
          <div style={{ padding: '24px 20px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            {(error || isBlocked) && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: isBlocked ? '#fffbeb' : '#fef2f2',
                  border: isBlocked ? '1px solid #fde68a' : '1px solid #fecaca',
                  color: isBlocked ? '#b45309' : '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{isBlocked ? '⏳' : '⚠️'}</span>
                <span>
                  {isBlocked
                    ? `Cuenta bloqueada por seguridad. Reintente en ${lockoutRemaining} segundos.`
                    : error}
                </span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Correo Electrónico Corporativo
                </label>
                <input
                  type="email"
                  required
                  disabled={loading || isBlocked}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@tuempresa.com.py"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '16px', // 16px previene el zoom involuntario en iOS Safari
                    boxSizing: 'border-box',
                    outline: 'none',
                    backgroundColor: isBlocked ? '#f1f5f9' : '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Contraseña de Acceso
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading || isBlocked}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 44px 10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '16px', // 16px previene zoom en iOS
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: isBlocked ? '#f1f5f9' : '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || isBlocked}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: isBlocked ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      padding: '8px',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      touchAction: 'manipulation',
                    }}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    tabIndex={-1}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              {/* Fila: Recordar Contraseña & Olvidé Contraseña */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  paddingTop: '2px',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#64748b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#0284c7',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  <span style={{ fontWeight: 500 }}>Recordar mis datos</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setView('forgot_password');
                    setRecoveryEmail(email);
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 0',
                    textDecoration: 'underline',
                    touchAction: 'manipulation',
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || isBlocked}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: isBlocked ? '#94a3b8' : '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  cursor: loading || isBlocked ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: isBlocked ? 'none' : '0 4px 6px -1px rgba(2, 132, 199, 0.3)',
                  transition: 'background 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                {loading
                  ? 'Iniciando sesión...'
                  : isBlocked
                  ? `Bloqueado temporalmente (${lockoutRemaining}s)`
                  : 'Ingresar al Portal ERP →'}
              </button>

              {/* Acceso Rápido Demo para Evaluación Inmediata (solo si el interruptor está habilitado) */}
              {isDemoLoginEnabled() && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      setEmail('cliente@laborapy.com');
                      setPassword('Cliente2026!');
                      setLoading(true);
                      setError('');
                      try {
                        const res = await loginClient('cliente@laborapy.com', 'Cliente2026!');
                        if (res.success) {
                          onLoginSuccess();
                        } else {
                          setError(res.error || 'No se pudo iniciar la demo.');
                        }
                      } catch {
                        setError('Error al conectar con la demo.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#f0fdf4',
                      border: '1.5px dashed #10b981',
                      color: '#047857',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>⚡</span>
                    <span>Probar Demo Instantánea (Logística Guaraní S.A.)</span>
                  </button>
                </div>
              )}
            </form>

            {/* Insignia de Seguridad Criptográfica */}
            <div
              style={{
                marginTop: '20px',
                padding: '10px 12px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '11.5px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🛡️</span>
              <span>Acceso encriptado SHA-256 y protegido contra fuerza bruta. Sesión segura de 8 horas.</span>
            </div>

            {/* Ayuda y Soporte por WhatsApp */}
            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
              ¿Aún no tienes usuario o necesitas ayuda?{' '}
              <a
                href={createWhatsAppUrl(`Hola LaboraPy, solicito credenciales para el Portal de Clientes ERP de mi empresa.`)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
              >
                Solicitar por WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* ── VISTA 2: PROTOCOLO OLVIDÉ CONTRASEÑA ── */}
        {view === 'forgot_password' && (
          <div style={{ padding: '24px 20px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            {recoveryError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{recoveryError}</span>
              </div>
            )}

            {recoverySuccess && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✅</span>
                <span>{recoverySuccess}</span>
              </div>
            )}

            {/* Opción 1: Canal Oficial WhatsApp (+595) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: '4px' }}>
                Opción A · Atención Inmediata Oficial
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                Restablecer a través de Soporte LaboraPy (+595)
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                Comunícate directamente con nuestro equipo de asistencia técnica para validar tu identidad corporativa y recibir una contraseña temporal.
              </p>
              <a
                href={createWhatsAppUrl(
                  `Hola LaboraPy, solicito restablecer la contraseña para el usuario cliente: ${
                    recoveryEmail || 'mi cuenta corporativa'
                  }.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  minHeight: '44px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#16a34a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                }}
              >
                <span>💬</span>
                <span>Contactar Soporte por WhatsApp</span>
              </a>
            </div>

            {/* Separador */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '18px 0',
                color: '#64748b',
                fontSize: '11.5px',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              <span style={{ padding: '0 10px' }}>O mediante código de verificación</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            </div>

            {/* Opción 2: Formulario con Código de Verificación */}
            <form onSubmit={handleConfirmPasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Correo Electrónico Corporativo
                </label>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'row' }}>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    placeholder="ejemplo@tuempresa.com.py"
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRequestRecoveryToken}
                    disabled={recoveryLoading}
                    style={{
                      padding: '0 14px',
                      minHeight: '44px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: recoveryLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      touchAction: 'manipulation',
                    }}
                  >
                    {recoveryLoading ? 'Generando...' : 'Obtener Código'}
                  </button>
                </div>
              </div>

              {generatedCode && (
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#eff6ff',
                    border: '1px dashed #3b82f6',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    color: '#0284c7',
                  }}
                >
                  <span>🔑 Código de verificación emitido: </span>
                  <strong style={{ letterSpacing: '1px', fontSize: '14px' }}>{generatedCode}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    (Código cargado automáticamente en el formulario)
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Código de Verificación (6 dígitos)
                </label>
                <input
                  type="text"
                  required
                  value={recoveryToken}
                  onChange={e => setRecoveryToken(e.target.value)}
                  placeholder="Ej: 123456"
                  maxLength={6}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '16px',
                    letterSpacing: '2px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Nueva Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 44px 10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '8px',
                      color: '#64748b',
                    }}
                    tabIndex={-1}
                  >
                    {showNewPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: recoveryLoading ? 'not-allowed' : 'pointer',
                  opacity: recoveryLoading ? 0.7 : 1,
                  boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.3)',
                  transition: 'background 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                {recoveryLoading ? 'Actualizando contraseña...' : 'Restablecer y Actualizar Contraseña →'}
              </button>
            </form>

            {/* Botón de Retorno */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setRecoveryError('');
                  setRecoverySuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  touchAction: 'manipulation',
                }}
              >
                ← Volver al formulario de inicio de sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


