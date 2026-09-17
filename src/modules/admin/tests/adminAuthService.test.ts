import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAdminAuthenticated,
  verifyMasterPassword,
  initiate2FASetup,
  confirm2FAActivation,
  verify2FALogin,
  logoutAdmin,
  changeAdminPassword,
  getLockoutStatus,
  is2FAConfigured,
  getMaskedProfile,
  revokeAllTrustedDevices,
  regenerateBackupCodes,
  requestPasswordRecovery,
  verifyRecoveryAndResetPassword,
  resetPasswordWithBackupCode,
  isCustomPasswordConfigured,
  ADMIN_CUSTOM_HASH_KEY,
  ADMIN_2FA_PROFILE_KEY,
  ADMIN_RECOVERY_KEY,
} from '../services/adminAuthService';
import { calculateTOTP } from '../../../lib/totpService';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
};

describe('adminAuthService - Control de Acceso, 2FA y Dispositivos Vinculados', () => {
  let mockSession: ReturnType<typeof createStorageMock>;
  let mockLocal: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    mockSession = createStorageMock();
    mockLocal = createStorageMock();
    vi.stubGlobal('sessionStorage', mockSession);
    vi.stubGlobal('localStorage', mockLocal);
    vi.stubGlobal('window', { sessionStorage: mockSession, localStorage: mockLocal });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe iniciar sin autenticación y sin 2FA activo', () => {
    expect(isAdminAuthenticated()).toBe(false);
    expect(is2FAConfigured()).toBe(false);
    expect(getMaskedProfile()).toBeNull();
  });

  it('debe rechazar contraseña vacía o incorrecta en Paso 1', async () => {
    const empty = await verifyMasterPassword('');
    expect(empty.success).toBe(false);
    expect(empty.error).toContain('ingrese la contraseña');

    const wrong = await verifyMasterPassword('ClaveInvalida999');
    expect(wrong.success).toBe(false);
    expect(wrong.error).toContain('incorrecta');
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('debe requerir configuración 2FA si es el primer ingreso con contraseña válida', async () => {
    const result = await verifyMasterPassword('LaboraPy2026!Admin');
    expect(result.success).toBe(true);
    expect(result.requiresSetup).toBe(true);
    expect(result.requires2FA).toBe(true);
    expect(result.isDeviceTrusted).toBe(false);
  });

  it('debe generar el QR, clave secreta y códigos de respaldo en initiate2FASetup', async () => {
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595981123456');
    expect(setup.secret).toBeTruthy();
    expect(setup.secret.length).toBe(32);
    expect(setup.otpAuthUri).toContain('otpauth://totp/');
    expect(setup.qrDataUrl).toContain('data:image/png;base64');
    expect(setup.backupCodes.length).toBe(6);
  });

  it('debe confirmar la activación del 2FA con un código TOTP válido y persistir perfil', async () => {
    const setup = await initiate2FASetup('diego@empresa.com.py', '+595 981 999 888');
    const validCode = await calculateTOTP(setup.secret);

    // Intento con código inválido
    const failConfirm = await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'diego@empresa.com.py',
      phone: '+595 981 999 888',
      token: '000000',
      backupCodes: setup.backupCodes,
    });
    expect(failConfirm.success).toBe(false);
    expect(is2FAConfigured()).toBe(false);

    // Confirmación exitosa
    const successConfirm = await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'diego@empresa.com.py',
      phone: '+595 981 999 888',
      token: validCode,
      backupCodes: setup.backupCodes,
      trustDevice: true,
    });

    expect(successConfirm.success).toBe(true);
    expect(is2FAConfigured()).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);

    const masked = getMaskedProfile();
    expect(masked?.email).toContain('d***o@empresa.com.py');
    expect(masked?.phone).toContain('***');
  });

  it('debe permitir login 2FA usando el código TOTP dinámico', async () => {
    // Configurar 2FA primero
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
    });

    logoutAdmin();
    expect(isAdminAuthenticated()).toBe(false);

    // Paso 1: Contraseña
    const step1 = await verifyMasterPassword('LaboraPy2026!Admin');
    expect(step1.success).toBe(true);
    expect(step1.requires2FA).toBe(true);

    // Paso 2: Código TOTP
    const loginCode = await calculateTOTP(setup.secret);
    const step2 = await verify2FALogin(loginCode, true);
    expect(step2.success).toBe(true);
    expect(step2.usedBackupCode).toBe(false);
    expect(isAdminAuthenticated()).toBe(true);
  });

  it('debe permitir login con código de respaldo de emergencia y quemar el código utilizado', async () => {
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
    });

    logoutAdmin();

    const emergencyCode = setup.backupCodes[0];
    const loginWithBackup = await verify2FALogin(emergencyCode, false);
    expect(loginWithBackup.success).toBe(true);
    expect(loginWithBackup.usedBackupCode).toBe(true);
    expect(isAdminAuthenticated()).toBe(true);

    // Reutilizar el mismo código de respaldo debe ser rechazado (ya fue quemado)
    logoutAdmin();
    const reuseBackup = await verify2FALogin(emergencyCode, false);
    expect(reuseBackup.success).toBe(false);
  });

  it('debe permitir regenerar códigos de respaldo y revocar dispositivos de confianza', async () => {
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
      trustDevice: true,
    });

    const newCodes = await regenerateBackupCodes();
    expect(newCodes.length).toBe(6);
    expect(newCodes[0]).not.toEqual(setup.backupCodes[0]);

    revokeAllTrustedDevices();
    const profile = JSON.parse(mockLocal.getItem(ADMIN_2FA_PROFILE_KEY)!);
    expect(profile.trustedDevices.length).toBe(0);
  });

  it('debe bloquear tras 5 intentos fallidos en 2FA', async () => {
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
    });

    for (let i = 1; i <= 5; i++) {
      await verify2FALogin('000000');
    }

    const status = getLockoutStatus();
    expect(status.isLocked).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(0);
  });

  it('debe cambiar la contraseña maestra correctamente', async () => {
    const change = await changeAdminPassword('LaboraPy2026!Admin', 'NuevaContrasenaSegura2026!');
    expect(change.success).toBe(true);
    expect(mockLocal.getItem(ADMIN_CUSTOM_HASH_KEY)).toBeTruthy();

    const oldLogin = await verifyMasterPassword('LaboraPy2026!Admin');
    expect(oldLogin.success).toBe(false);

    const newLogin = await verifyMasterPassword('NuevaContrasenaSegura2026!');
    expect(newLogin.success).toBe(true);
  });

  it('debe validar el protocolo de recuperación de contraseña por WhatsApp y Correo', async () => {
    // 1. Configurar 2FA con datos de prueba
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
    });

    logoutAdmin();

    // 2. Intento de recuperación con datos que no coinciden
    const failReq = await requestPasswordRecovery('intruso@fake.com', '+595981000000');
    expect(failReq.success).toBe(false);
    expect(failReq.error).toContain('no coinciden');

    // 3. Solicitud exitosa con datos correctos
    const successReq = await requestPasswordRecovery('admin@laborapy.com.py', '+595 981 123 456');
    expect(successReq.success).toBe(true);
    expect(successReq.expiresInMinutes).toBe(10);
    expect(successReq.directWhatsAppUrl).toContain('wa.me');
    expect(successReq.hasWebhook).toBe(false);
    expect(successReq.emergencyCode).toBeDefined();

    // Obtener el código generado almacenado en el desafío
    const challengeRaw = mockSession.getItem(ADMIN_RECOVERY_KEY);
    expect(challengeRaw).toBeTruthy();
    const challenge = JSON.parse(challengeRaw!);
    expect(challenge.code.length).toBe(6);
    expect(successReq.emergencyCode).toBe(challenge.code);

    // 4. Intento de reseteo con código incorrecto
    const failReset = await verifyRecoveryAndResetPassword({
      code: '000000',
      newPassword: 'MiPasswordRecuperado2026!',
    });
    expect(failReset.success).toBe(false);
    expect(failReset.error).toContain('incorrecto');

    // 5. Intento sin token 2FA cuando 2FA está activo
    const fail2FA = await verifyRecoveryAndResetPassword({
      code: challenge.code,
      newPassword: 'MiPasswordRecuperado2026!',
    });
    expect(fail2FA.success).toBe(false);
    expect(fail2FA.error).toContain('Google Authenticator');

    // 6. Reseteo exitoso con código de recuperación + código TOTP
    const validTOTP = await calculateTOTP(setup.secret);
    const successReset = await verifyRecoveryAndResetPassword({
      code: challenge.code,
      newPassword: 'MiPasswordRecuperado2026!',
      twoFactorToken: validTOTP,
    });
    expect(successReset.success).toBe(true);
    expect(mockSession.getItem(ADMIN_RECOVERY_KEY)).toBeNull();

    // 7. Verificar que la nueva contraseña funciona en el login
    const loginWithNew = await verifyMasterPassword('MiPasswordRecuperado2026!');
    expect(loginWithNew.success).toBe(true);
  });

  it('debe permitir restablecer contraseña utilizando directamente un código de respaldo 2FA', async () => {
    const setup = await initiate2FASetup('admin@laborapy.com.py', '+595 981 123 456');
    const setupCode = await calculateTOTP(setup.secret);
    await confirm2FAActivation({
      tempSecret: setup.secret,
      email: 'admin@laborapy.com.py',
      phone: '+595 981 123 456',
      token: setupCode,
      backupCodes: setup.backupCodes,
    });

    logoutAdmin();

    expect(isCustomPasswordConfigured()).toBe(false);

    const backupCodeToUse = setup.backupCodes[0];
    const resetRes = await resetPasswordWithBackupCode({
      backupCode: backupCodeToUse,
      newPassword: 'NuevaPasswordBackup2026!',
    });
    expect(resetRes.success).toBe(true);
    expect(isCustomPasswordConfigured()).toBe(true);

    // El código de respaldo debe haber sido consumido y no puede reutilizarse
    const retryRes = await resetPasswordWithBackupCode({
      backupCode: backupCodeToUse,
      newPassword: 'OtraPassword2026!',
    });
    expect(retryRes.success).toBe(false);
    expect(retryRes.error).toContain('incorrecto o ya ha sido utilizado');

    // La nueva contraseña debe funcionar en el login
    const loginRes = await verifyMasterPassword('NuevaPasswordBackup2026!');
    expect(loginRes.success).toBe(true);
  });
});
