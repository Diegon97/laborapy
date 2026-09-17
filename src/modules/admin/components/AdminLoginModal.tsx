/**
 * MODAL DE AUTENTICACIÓN ADMINISTRATIVA CON 2FA & DISPOSITIVOS VINCULADOS
 * LaboraPy — Paso 1: Clave Maestra | Paso 2: Google/Microsoft Authenticator (RFC 6238)
 * Versión: PY-ADMIN-LOGIN-2FA-2026.09.07
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  verifyMasterPassword,
  initiate2FASetup,
  confirm2FAActivation,
  verify2FALogin,
  getLockoutStatus,
  getMaskedProfile,
  isCurrentDeviceTrusted,
  is2FAConfigured,
  requestPasswordRecovery,
  verifyRecoveryAndResetPassword,
  resetPasswordWithBackupCode,
  isCustomPasswordConfigured,
  factoryResetAdminAccess,
} from '../services/adminAuthService';
import { formatSecretKey } from '../../../lib/totpService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

type AuthStep = 'password' | 'setup_profile' | 'setup_qr' | 'verify_2fa' | 'recovery_request' | 'recovery_verify';

export const AdminLoginModal: React.FC<Props> = ({ isOpen, onClose, onAuthenticated }) => {
  // Estados de pasos
  const [step, setStep] = useState<AuthStep>('password');

  // Paso 1: Contraseña
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showInitialPasswordHint, setShowInitialPasswordHint] = useState(false);

  // Paso 2A: Setup Inicial
  const [adminEmail, setAdminEmail] = useState('admin@laborapy.com.py');
  const [adminPhone, setAdminPhone] = useState('+595 981 ');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupOtpUri, setSetupOtpUri] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([]);
  const [setupToken, setSetupToken] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Paso 2B: Verificación 2FA
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);

  // Paso 3: Recuperación de Contraseña por WhatsApp & Correo
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('+595 981 ');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recovery2FAToken, setRecovery2FAToken] = useState('');
  const [recoveryNewPass, setRecoveryNewPass] = useState('');
  const [recoveryConfirmPass, setRecoveryConfirmPass] = useState('');
  const [recoveryWhatsAppUrl, setRecoveryWhatsAppUrl] = useState('');
  const [recoveryExpiresMin, setRecoveryExpiresMin] = useState(10);
  const [recoveryHasWebhook, setRecoveryHasWebhook] = useState(false);
  const [recoveryEmergencyCode, setRecoveryEmergencyCode] = useState('');
  const [showEmergencyCode, setShowEmergencyCode] = useState(false);
  const [recoveryUseBackupOnly, setRecoveryUseBackupOnly] = useState(false);
  const [recoveryBackupCode, setRecoveryBackupCode] = useState('');

  // Control general
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const passwordRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('password');
      setPassword('');
      setShowPassword(false);
      setError('');
      setSetupToken('');
      setTwoFactorToken('');
      setUseBackupCode(false);
      setTrustDevice(true);
      setCopiedKey(false);
      setCopiedCodes(false);
      setShowInitialPasswordHint(false);
      setRecoveryEmail('');
      setRecoveryPhone('+595 981 ');
      setRecoveryCode('');
      setRecovery2FAToken('');
      setRecoveryNewPass('');
      setRecoveryConfirmPass('');
      setRecoveryWhatsAppUrl('');
      setRecoveryHasWebhook(false);
      setRecoveryEmergencyCode('');
      setShowEmergencyCode(false);
      setRecoveryUseBackupOnly(false);
      setRecoveryBackupCode('');

      const lockout = getLockoutStatus();
      setLockoutSeconds(lockout.remainingSeconds);

      setTimeout(() => {
        passwordRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Manejo del contador de bloqueo anti-fuerza bruta
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Foco automático al cambiar de paso
  useEffect(() => {
    if (step === 'verify_2fa' || step === 'setup_qr') {
      setTimeout(() => {
        tokenRef.current?.focus();
      }, 150);
    }
  }, [step]);

  if (!isOpen) return null;

  // 1. Envío del Paso 1: Contraseña
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockoutSeconds > 0) return;

    setIsLoading(true);
    try {
      const result = await verifyMasterPassword(password);
      if (!result.success) {
        setError(result.error || 'Contraseña incorrecta.');
        const lockout = getLockoutStatus();
        if (lockout.isLocked) setLockoutSeconds(lockout.remainingSeconds);
        return;
      }

      // Si el dispositivo ya es de confianza y tiene 2FA -> ingresa directo
      if (result.isDeviceTrusted) {
        onAuthenticated();
        return;
      }

      // Si requiere configurar 2FA por primera vez
      if (result.requiresSetup) {
        setStep('setup_profile');
        return;
      }

      // Si requiere verificar con 2FA
      if (result.requires2FA) {
        setStep('verify_2fa');
      }
    } catch {
      setError('Error inesperado al validar credenciales.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Envío del Perfil para generar QR
  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminEmail.includes('@')) {
      setError('Ingrese un correo electrónico válido.');
      return;
    }
    if (adminPhone.trim().length < 8) {
      setError('Ingrese un número de celular válido para vincular (ej: +595 981 123 456).');
      return;
    }

    setIsLoading(true);
    try {
      const setup = await initiate2FASetup(adminEmail, adminPhone);
      setSetupSecret(setup.secret);
      setSetupOtpUri(setup.otpAuthUri);
      setSetupQrUrl(setup.qrDataUrl);
      setSetupBackupCodes(setup.backupCodes);
      setStep('setup_qr');
    } catch {
      setError('No se pudo generar la clave QR.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Confirmación de activación 2FA
  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!setupToken.trim()) {
      setError('Ingrese el código de 6 dígitos que muestra su aplicación Authenticator.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await confirm2FAActivation({
        tempSecret: setupSecret,
        email: adminEmail,
        phone: adminPhone,
        token: setupToken,
        backupCodes: setupBackupCodes,
        trustDevice,
      });

      if (result.success) {
        onAuthenticated();
      } else {
        setError(result.error || 'Código incorrecto. Verifique e intente nuevamente.');
      }
    } catch {
      setError('Error al activar 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Verificación de 2FA en login
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!twoFactorToken.trim()) {
      setError(useBackupCode ? 'Ingrese el código de respaldo.' : 'Ingrese el código de 6 dígitos.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verify2FALogin(twoFactorToken, trustDevice);
      if (result.success) {
        onAuthenticated();
      } else {
        setError(result.error || 'Código incorrecto.');
        const lockout = getLockoutStatus();
        if (lockout.isLocked) setLockoutSeconds(lockout.remainingSeconds);
      }
    } catch {
      setError('Error al validar código 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupSecret) {
      navigator.clipboard.writeText(setupSecret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleCopyBackupCodes = () => {
    if (setupBackupCodes.length > 0) {
      const text = `CÓDIGOS DE RESPALDO DE EMERGENCIA LABORAPY (2FA)\n==============================================\nFecha: ${new Date().toLocaleDateString('es-PY')}\n\n` +
        setupBackupCodes.join('\n') +
        `\n\nGuarde estos códigos en un lugar seguro. Cada código solo puede usarse 1 vez.`;
      navigator.clipboard.writeText(text);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
    }
  };

  const masked = getMaskedProfile();
  const isTrusted = isCurrentDeviceTrusted();
  const is2FA = is2FAConfigured();

  // 5. Solicitar recuperación por WhatsApp y Correo
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recoveryEmail.includes('@')) {
      setError('Por favor, ingrese un correo electrónico válido.');
      return;
    }
    if (recoveryPhone.trim().length < 8) {
      setError('Por favor, ingrese un número de celular válido (+595...).');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPasswordRecovery(recoveryEmail, recoveryPhone);
      if (result.success) {
        setRecoveryWhatsAppUrl(result.directWhatsAppUrl || '');
        setRecoveryExpiresMin(result.expiresInMinutes || 10);
        setRecoveryHasWebhook(Boolean(result.hasWebhook));
        setRecoveryEmergencyCode(result.emergencyCode || '');
        setShowEmergencyCode(false);
        setStep('recovery_verify');
      } else {
        setError(result.error || 'No se pudo procesar la solicitud.');
      }
    } catch {
      setError('Error al solicitar la recuperación de contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6A. Restablecer contraseña con código de respaldo 2FA directamente
  const handleResetWithBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = recoveryBackupCode.trim();
    if (!cleanCode) {
      setError('Por favor ingrese uno de sus 6 códigos de respaldo de emergencia (ej: A1B2-C3D4).');
      return;
    }

    if (!recoveryNewPass || recoveryNewPass.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (recoveryNewPass !== recoveryConfirmPass) {
      setError('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPasswordWithBackupCode({
        backupCode: cleanCode,
        newPassword: recoveryNewPass,
      });

      if (result.success) {
        setStep('password');
        setPassword('');
        setError('');
        alert('✅ ¡Contraseña restablecida con éxito con su Código de Respaldo! Ya puede iniciar sesión con su nueva clave.');
      } else {
        setError(result.error || 'Código de respaldo no válido o ya utilizado.');
      }
    } catch {
      setError('Error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Validar código y restablecer la contraseña
  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recoveryCode.trim()) {
      setError('Por favor, ingrese el código de 6 dígitos que recibió.');
      return;
    }

    if (!recoveryNewPass || recoveryNewPass.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (recoveryNewPass !== recoveryConfirmPass) {
      setError('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyRecoveryAndResetPassword({
        code: recoveryCode,
        newPassword: recoveryNewPass,
        twoFactorToken: recovery2FAToken,
      });

      if (result.success) {
        setStep('password');
        setPassword('');
        setError('');
        alert('✅ ¡Contraseña restablecida con éxito! Ahora puede ingresar con su nueva clave.');
      } else {
        setError(result.error || 'Código incorrecto o expirado.');
      }
    } catch {
      setError('Error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

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
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: step === 'setup_qr' ? '520px' : '440px',
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
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* ── PASO 1: CONTRASEÑA MAESTRA ── */}
        {step === 'password' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  margin: '0 auto 14px',
                  backgroundColor: '#1e293b',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '2px solid #3b82f6',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)',
                }}
              >
                🔒
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: '700', color: '#f8fafc' }}>
                Acceso Administrativo
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
                Paso 1: Ingrese su contraseña de administrador.
              </p>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Contraseña de Administrador
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={lockoutSeconds > 0 || isLoading}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 40px 11px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '15px',
                      padding: 0,
                    }}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
                {lockoutSeconds > 0 && (
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: '#f87171' }}>
                    Bloqueado por seguridad. Espere {lockoutSeconds} segundos.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || lockoutSeconds > 0 || !password.trim()}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  backgroundColor: lockoutSeconds > 0 || !password.trim() ? '#475569' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: lockoutSeconds > 0 || !password.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Verificando...' : 'Continuar ➔'}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep('recovery_request');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#38bdf8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                >
                  ¿Olvidaste tu contraseña? Recuperar por WhatsApp / Correo
                </button>
              </div>

              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowInitialPasswordHint(!showInitialPasswordHint)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  💡 ¿Primera vez ingresando? Ver contraseña predeterminada
                </button>
                {showInitialPasswordHint && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      color: '#93c5fd',
                      textAlign: 'left',
                    }}
                  >
                    {!isCustomPasswordConfigured() ? (
                      <>
                        Clave de fábrica predeterminada:{' '}
                        <code
                          style={{
                            fontWeight: 'bold',
                            backgroundColor: '#1e293b',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#34d399',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPassword('LaboraPy2026!Admin')}
                          title="Tocar para autocompletar"
                        >
                          LaboraPy2026!Admin
                        </code>{' '}
                        <span style={{ fontSize: '10.5px', color: '#cbd5e1' }}>(Toque la clave para autocompletarla)</span>
                      </>
                    ) : (
                      <span>Se ha personalizado la contraseña en este equipo. Use la opción de recuperación arriba si no la recuerda.</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #334155', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Restablecer el acceso administrativo a los valores de fábrica?\n\n• Contraseña: LaboraPy2026!Admin\n• 2FA / Authenticator: Desactivado')) {
                      factoryResetAdminAccess();
                      setPassword('LaboraPy2026!Admin');
                      setError('');
                      alert('✅ Acceso restablecido con éxito.\n\nContraseña activa: LaboraPy2026!Admin\n2FA: Desactivado');
                      window.location.reload();
                    }
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  🔄 Restablecer Acceso de Fábrica (LaboraPy2026!Admin)
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PASO 2A: REGISTRO DE VINCULACIÓN MÓVIL & EMAIL ── */}
        {step === 'setup_profile' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  margin: '0 auto 12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '2px solid #10b981',
                }}
              >
                📱
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Vincular Identidad y Celular
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Para proteger el acceso desde múltiples dispositivos, vincule su número de teléfono y correo.
              </p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleGenerateQR}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '5px' }}>
                  Número de Celular para Vinculación (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  placeholder="+595 981 123 456"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '5px' }}>
                  Correo Electrónico del Administrador
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="admin@empresa.com.py"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    flex: 2,
                    padding: '10px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {isLoading ? 'Generando...' : 'Generar Código QR ➔'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PASO 2A (CONTINUACIÓN): ESCANEO QR Y ACTIVACIÓN ── */}
        {step === 'setup_qr' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Escanear en Google Authenticator
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Abra Google Authenticator, Microsoft Authenticator o Authy en su celular y escanee:
              </p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Contenedor del Código QR */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
              {setupQrUrl ? (
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    marginBottom: '10px',
                  }}
                >
                  <img src={setupQrUrl} alt="Código QR 2FA LaboraPy" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
              ) : (
                <div style={{ width: '180px', height: '180px', backgroundColor: '#334155', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Cargando QR...
                </div>
              )}

              {/* Botón directo para abrir en celular */}
              <a
                href={setupOtpUri}
                style={{
                  fontSize: '11.5px',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  marginBottom: '8px',
                }}
              >
                📲 ¿Estás en tu celular? Toca aquí para abrir la app directamente
              </a>

              {/* Clave manual con botón de copiar */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11.5px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>CLAVE MANUAL:</span>
                  <code style={{ color: '#34d399', fontWeight: '600', letterSpacing: '0.5px' }}>
                    {formatSecretKey(setupSecret)}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  style={{
                    backgroundColor: copiedKey ? '#10b981' : '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {copiedKey ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Códigos de respaldo */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#fbbf24' }}>
                  🔑 Códigos de Respaldo de Emergencia (6):
                </span>
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  style={{
                    backgroundColor: copiedCodes ? '#10b981' : '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                  }}
                >
                  {copiedCodes ? '✓ Códigos Copiados' : '📋 Copiar Códigos'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '11px', color: '#cbd5e1', textAlign: 'center' }}>
                {setupBackupCodes.map((c, i) => (
                  <span key={i} style={{ backgroundColor: '#0f172a', padding: '3px 4px', borderRadius: '4px', fontFamily: 'monospace' }}>
                    {c}
                  </span>
                ))}
              </div>
              <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                Guárdelos. Si pierde su celular, estos códigos le permitirán ingresar.
              </span>
            </div>

            {/* Formulario de Confirmación con el código de 6 dígitos */}
            <form onSubmit={handleConfirmSetup}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Ingrese el código de 6 dígitos que muestra su app:
                </label>
                <input
                  ref={tokenRef}
                  type="text"
                  maxLength={6}
                  value={setupToken}
                  onChange={e => setSetupToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '22px',
                    textAlign: 'center',
                    letterSpacing: '6px',
                    fontWeight: '700',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="checkbox"
                  id="trust-device-setup"
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="trust-device-setup" style={{ fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                  Recordar este dispositivo por 30 días
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep('setup_profile')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={isLoading || setupToken.length < 6}
                  style={{
                    flex: 2,
                    padding: '10px',
                    backgroundColor: setupToken.length === 6 ? '#2563eb' : '#475569',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: setupToken.length === 6 ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isLoading ? 'Verificando...' : 'Confirmar y Activar 2FA'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PASO 2B: VERIFICACIÓN 2FA EN LOGIN REGULAR O NUEVO DISPOSITIVO ── */}
        {step === 'verify_2fa' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  margin: '0 auto 12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '2px solid #3b82f6',
                }}
              >
                🛡️
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Verificación de Dos Factores (2FA)
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8' }}>
                {useBackupCode
                  ? 'Ingrese uno de sus 6 códigos de respaldo de emergencia'
                  : 'Ingrese el código dinámico de 6 dígitos de su aplicación Authenticator'}
              </p>
            </div>

            {/* Notificación de vinculación de dispositivo */}
            {masked && (
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#bfdbfe',
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                  {isTrusted ? 'Dispositivo reconocido' : '⚠️ Nuevo dispositivo detectado'}
                </div>
                <div>Vinculado a: <strong>{masked.phone}</strong> · {masked.email}</div>
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleVerify2FA}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  ref={tokenRef}
                  type="text"
                  maxLength={useBackupCode ? 10 : 6}
                  value={twoFactorToken}
                  onChange={e => {
                    const val = useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '');
                    setTwoFactorToken(val);
                  }}
                  placeholder={useBackupCode ? 'XXXX-XXXX' : '123456'}
                  disabled={lockoutSeconds > 0 || isLoading}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: useBackupCode ? '18px' : '24px',
                    textAlign: 'center',
                    letterSpacing: useBackupCode ? '2px' : '6px',
                    fontWeight: '700',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="trust-device-login"
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="trust-device-login" style={{ fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                  Recordar este dispositivo por 30 días
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || lockoutSeconds > 0 || !twoFactorToken.trim()}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  backgroundColor: !twoFactorToken.trim() || lockoutSeconds > 0 ? '#475569' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: !twoFactorToken.trim() || lockoutSeconds > 0 ? 'not-allowed' : 'pointer',
                  marginBottom: '12px',
                }}
              >
                {isLoading ? 'Verificando...' : 'Verificar y Acceder'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setTwoFactorToken('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {useBackupCode ? 'Volver a código de Authenticator' : '¿No tienes tu celular? Usar código de respaldo'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PASO 3A: SOLICITAR RECUPERACIÓN POR WHATSAPP Y CORREO ── */}
        {step === 'recovery_request' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  margin: '0 auto 12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '2px solid #38bdf8',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)',
                }}
              >
                🔄
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Recuperación de Contraseña
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                Ingrese el correo y celular vinculados a su cuenta. Le enviaremos un código de seguridad de 6 dígitos con validez de 10 minutos por WhatsApp y Correo.
              </p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleRequestRecovery}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Correo Electrónico del Administrador
                </label>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  placeholder="admin@empresa.com.py"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Número de Celular Vinculado (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={recoveryPhone}
                  onChange={e => setRecoveryPhone(e.target.value)}
                  placeholder="+595 981 123 456"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep('password');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    color: '#94a3b8',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !recoveryEmail.trim() || !recoveryPhone.trim()}
                  style={{
                    flex: 2,
                    padding: '10px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Enviando código...' : 'Enviar Código ➔'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── PASO 3B: RESTABLECER CONTRASEÑA ── */}
        {step === 'recovery_verify' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  margin: '0 auto 10px',
                  backgroundColor: '#1e293b',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  border: '2px solid #10b981',
                }}
              >
                🔐
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>
                Restablecer Contraseña
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                {recoveryUseBackupOnly
                  ? 'Ingrese su código de respaldo de 8 dígitos para redefinir su clave.'
                  : `Hemos generado su código de recuperación temporal (válido por ${recoveryExpiresMin} minutos).`}
              </p>
            </div>

            {/* Aviso de Estado del Canal de Entrega */}
            {!recoveryUseBackupOnly && (
              <>
                {recoveryHasWebhook ? (
                  <div
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      color: '#a7f3d0',
                    }}
                  >
                    🟢 <strong>Webhook Conectado:</strong> Se emitió la solicitud a su pasarela CRM/Email. Verifique su bandeja de entrada o CRM.
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid #eab308',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      color: '#fef08a',
                      lineHeight: '1.4',
                    }}
                  >
                    ⚠️ <strong>Modo Local (Sin Webhook en Vercel):</strong> La app no tiene un servidor de correo (SMTP) conectado para enviar emails de fondo de forma silenciosa. Utilice WhatsApp o su Código de Emergencia abajo:
                  </div>
                )}

                {/* Botón Destacado de WhatsApp */}
                {recoveryWhatsAppUrl && (
                  <a
                    href={recoveryWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: '#25d366',
                      color: '#0f172a',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      marginBottom: '12px',
                      boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                    }}
                  >
                    <span>📲</span> Enviar código a mi WhatsApp ({recoveryPhone})
                  </a>
                )}

                {/* Revelar Código de Emergencia en Pantalla */}
                <div style={{ marginBottom: '14px' }}>
                  {!showEmergencyCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmergencyCode(true);
                        if (recoveryEmergencyCode) {
                          setRecoveryCode(recoveryEmergencyCode);
                        }
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        border: '1px dashed #38bdf8',
                        color: '#38bdf8',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>👁️</span> ¿No le llegó el mensaje? Revelar código de emergencia en pantalla
                    </button>
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                        CÓDIGO DE RECUPERACIÓN GENERADO:
                      </span>
                      <span style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8', letterSpacing: '6px', display: 'block', margin: '4px 0' }}>
                        {recoveryEmergencyCode || recoveryCode}
                      </span>
                      <span style={{ fontSize: '11px', color: '#86efac' }}>
                        ✓ Autocompletado en el formulario abajo
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Formulario 1: Modo Estándar con Código OTP */}
            {!recoveryUseBackupOnly ? (
              <form onSubmit={handleVerifyRecovery}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                    Código de Recuperación (6 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={recoveryCode}
                    onChange={e => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #38bdf8',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '18px',
                      textAlign: 'center',
                      letterSpacing: '4px',
                      fontWeight: '700',
                    }}
                  />
                </div>

                {/* Si 2FA está activo, pedir también el token 2FA para evitar secuestro */}
                {is2FA && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                      Código de Google Authenticator (o Código de Respaldo)
                    </label>
                    <input
                      type="text"
                      value={recovery2FAToken}
                      onChange={e => setRecovery2FAToken(e.target.value.trim())}
                      placeholder="6 dígitos o XXXX-XXXX"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #3b82f6',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>
                      Requerido para confirmar la titularidad vinculada a este equipo.
                    </span>
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                    Nueva Contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    value={recoveryNewPass}
                    onChange={e => setRecoveryNewPass(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={recoveryConfirmPass}
                    onChange={e => setRecoveryConfirmPass(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep('recovery_request');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !recoveryCode.trim() || !recoveryNewPass.trim()}
                    style={{
                      flex: 2,
                      padding: '10px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Actualizando...' : 'Guardar Nueva Clave'}
                  </button>
                </div>
              </form>
            ) : (
              /* Formulario 2: Modo Restablecimiento con Código de Respaldo 2FA */
              <form onSubmit={handleResetWithBackupCode}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#fbbf24', marginBottom: '4px' }}>
                    Código de Respaldo 2FA (8 caracteres)
                  </label>
                  <input
                    type="text"
                    value={recoveryBackupCode}
                    onChange={e => setRecoveryBackupCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-1234"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #fbbf24',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '15px',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>
                    Uno de los 6 códigos de emergencia generados al activar 2FA.
                  </span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                    Nueva Contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    value={recoveryNewPass}
                    onChange={e => setRecoveryNewPass(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={recoveryConfirmPass}
                    onChange={e => setRecoveryConfirmPass(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setRecoveryUseBackupOnly(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #475569',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !recoveryBackupCode.trim() || !recoveryNewPass.trim()}
                    style={{
                      flex: 2,
                      padding: '10px',
                      backgroundColor: '#f59e0b',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Restableciendo...' : 'Restablecer con Respaldo'}
                  </button>
                </div>
              </form>
            )}

            {/* Alternar entre Modo Estándar y Códigos de Respaldo */}
            {is2FA && (
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setRecoveryUseBackupOnly(!recoveryUseBackupOnly);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fbbf24',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {recoveryUseBackupOnly
                    ? '← Volver al modo de recuperación por código OTP'
                    : '🔑 ¿Tiene sus Códigos de Respaldo? Restablecer directo sin esperar correo'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
