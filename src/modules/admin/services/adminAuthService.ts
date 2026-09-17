/**
 * SERVICIO DE AUTENTICACIÓN Y SEGURIDAD DEL PANEL ADMINISTRATIVO — 2FA & MULTI-DEVICE
 * LaboraPy — Control de Acceso Criptográfico (SHA-256 + TOTP RFC 6238 + Dispositivos Vinculados)
 * Versión: PY-ADMIN-AUTH-2FA-2026.09.07
 */

import QRCode from 'qrcode';
import { sha256, sanitizeInput, generateSecureToken } from '../../../lib/crypto';
import {
  generateTOTPSecret,
  generateOTPAuthURI,
  verifyTOTP,
  generateBackupCodes,
} from '../../../lib/totpService';
import { getCRMWebhookUrl } from '../../lead/services/leadService';
import { createWhatsAppUrl } from '../../../config/laborapy';

export const ADMIN_SESSION_KEY = 'laborapy_admin_session_token';
export const ADMIN_CUSTOM_HASH_KEY = 'laborapy_admin_custom_hash';
export const ADMIN_LOCKOUT_KEY = 'laborapy_admin_auth_lockout';
export const ADMIN_2FA_PROFILE_KEY = 'laborapy_admin_2fa_profile';
export const ADMIN_DEVICE_ID_KEY = 'laborapy_admin_device_id';
export const ADMIN_RECOVERY_KEY = 'laborapy_admin_recovery_challenge';

const DEFAULT_ADMIN_PASS = 'LaboraPy2026!Admin';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 segundos
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas
const TRUSTED_DEVICE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  registeredAt: number;
  lastUsedAt: number;
  expiresAt: number;
}

export interface AdminSecurityProfile {
  email: string;
  phone: string;
  totpSecret: string; // Base32
  is2FAEnabled: boolean;
  backupCodeHashes: string[]; // Hashes SHA-256 de los códigos
  trustedDevices: TrustedDevice[];
  updatedAt: number;
}

interface LockoutData {
  attempts: number;
  lockUntil: number;
}

interface SessionData {
  token: string;
  expiresAt: number;
  authenticatedWith2FA: boolean;
  deviceId: string;
}

/**
 * Obtiene o genera un identificador persistente único para el dispositivo/navegador actual
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'device_unknown';
  }

  let deviceId = localStorage.getItem(ADMIN_DEVICE_ID_KEY);
  if (!deviceId || !deviceId.trim()) {
    deviceId = `dev_${Date.now()}_${generateSecureToken().substring(0, 12)}`;
    localStorage.setItem(ADMIN_DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Detecta un nombre amigable para el dispositivo actual
 */
export function getDeviceFriendlyName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Dispositivo Navegador Web';
  }

  const ua = navigator.userAgent;
  let os = 'Dispositivo';
  if (/Windows/i.test(ua)) os = 'PC Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS (iPhone/iPad)';
  else if (/Android/i.test(ua)) os = 'Celular Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Web';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return `${browser} en ${os}`;
}

/**
 * Obtiene el perfil de seguridad 2FA almacenado
 */
export function getAdminSecurityProfile(): AdminSecurityProfile | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(ADMIN_2FA_PROFILE_KEY);
    if (!raw) return null;
    const parsed: AdminSecurityProfile = JSON.parse(raw);
    if (parsed.is2FAEnabled && parsed.totpSecret) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica si el 2FA está configurado y habilitado
 */
export function is2FAConfigured(): boolean {
  const profile = getAdminSecurityProfile();
  return Boolean(profile && profile.is2FAEnabled && profile.totpSecret);
}

/**
 * Devuelve el correo y teléfono enmascarados para visualización segura en la interfaz
 */
export function getMaskedProfile(): { email: string; phone: string } | null {
  const profile = getAdminSecurityProfile();
  if (!profile) return null;

  // Enmascarar email: d***z@empresa.com
  let maskedEmail = profile.email;
  const parts = profile.email.split('@');
  if (parts.length === 2) {
    const user = parts[0];
    const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
    maskedEmail = `${maskedUser}@${parts[1]}`;
  }

  // Enmascarar teléfono: +595 981 *** 456
  let maskedPhone = profile.phone;
  if (profile.phone.length > 7) {
    const start = profile.phone.substring(0, profile.phone.length - 6);
    const end = profile.phone.substring(profile.phone.length - 3);
    maskedPhone = `${start} *** ${end}`;
  }

  return { email: maskedEmail, phone: maskedPhone };
}

/**
 * Verifica si el dispositivo actual es de confianza
 */
export function isCurrentDeviceTrusted(): boolean {
  const profile = getAdminSecurityProfile();
  if (!profile || !profile.trustedDevices || profile.trustedDevices.length === 0) {
    return false;
  }

  const currentDeviceId = getOrCreateDeviceId();
  const device = profile.trustedDevices.find(d => d.deviceId === currentDeviceId);
  if (!device) return false;

  if (Date.now() > device.expiresAt) {
    // Expirado
    revokeTrustedDevice(currentDeviceId);
    return false;
  }

  return true;
}

/**
 * Obtiene la contraseña administrativa esperada (desde variable de entorno o valor predeterminado)
 */
export function getExpectedAdminPassword(): string {
  const envPass = (import.meta.env?.VITE_ADMIN_PASSWORD as string | undefined)?.trim();
  return envPass || DEFAULT_ADMIN_PASS;
}

/**
 * Obtiene el hash SHA-256 esperado (personalizado o el predeterminado)
 */
export async function getExpectedPasswordHash(): Promise<string> {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const customHash = localStorage.getItem(ADMIN_CUSTOM_HASH_KEY);
    if (customHash && customHash.trim()) {
      return customHash.trim();
    }
  }
  return await sha256(getExpectedAdminPassword());
}

/**
 * Verifica si el usuario actual tiene una sesión de administrador válida y activa
 */
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return false;
  }

  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return false;

    const data: SessionData = JSON.parse(raw);
    if (!data.expiresAt || !data.token) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return false;
    }

    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return false;
    }

    // Si 2FA está configurado, la sesión DEBE tener authenticatedWith2FA: true
    if (is2FAConfigured() && !data.authenticatedWith2FA) {
      return false;
    }

    return true;
  } catch {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return false;
  }
}

/**
 * Consulta el estado actual de bloqueo por intentos fallidos de autenticación
 */
export function getLockoutStatus(): { isLocked: boolean; remainingSeconds: number } {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { isLocked: false, remainingSeconds: 0 };
  }

  try {
    const raw = localStorage.getItem(ADMIN_LOCKOUT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };

    const data: LockoutData = JSON.parse(raw);
    if (data.lockUntil && Date.now() < data.lockUntil) {
      const remainingSeconds = Math.ceil((data.lockUntil - Date.now()) / 1000);
      return { isLocked: true, remainingSeconds };
    }

    if (data.lockUntil && Date.now() >= data.lockUntil) {
      localStorage.removeItem(ADMIN_LOCKOUT_KEY);
    }

    return { isLocked: false, remainingSeconds: 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0 };
  }
}

function recordFailedAttempt(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    const raw = localStorage.getItem(ADMIN_LOCKOUT_KEY);
    const data: LockoutData = raw ? JSON.parse(raw) : { attempts: 0, lockUntil: 0 };

    data.attempts = (data.attempts || 0) + 1;

    if (data.attempts >= MAX_FAILED_ATTEMPTS) {
      data.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    }

    localStorage.setItem(ADMIN_LOCKOUT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[AdminAuth] Error al registrar intento fallido:', e);
  }
}

function resetFailedAttempts(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_LOCKOUT_KEY);
  } catch {
    // Silencioso
  }
}

/**
 * Paso 1: Valida la contraseña maestra del administrador
 */
export async function verifyMasterPassword(password: string): Promise<{
  success: boolean;
  requires2FA: boolean;
  requiresSetup: boolean;
  isDeviceTrusted: boolean;
  error?: string;
}> {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    return {
      success: false,
      requires2FA: false,
      requiresSetup: false,
      isDeviceTrusted: false,
      error: `Demasiados intentos fallidos. Espere ${lockout.remainingSeconds} segundos.`,
    };
  }

  const cleanPass = (password || '').trim();
  if (!cleanPass) {
    return {
      success: false,
      requires2FA: false,
      requiresSetup: false,
      isDeviceTrusted: false,
      error: 'Por favor, ingrese la contraseña de administrador.',
    };
  }

  const inputHash = await sha256(cleanPass);
  const expectedHash = await getExpectedPasswordHash();

  if (inputHash !== expectedHash) {
    recordFailedAttempt();
    const updatedLockout = getLockoutStatus();
    if (updatedLockout.isLocked) {
      return {
        success: false,
        requires2FA: false,
        requiresSetup: false,
        isDeviceTrusted: false,
        error: `Límite de intentos superado. Acceso bloqueado por ${updatedLockout.remainingSeconds} segundos.`,
      };
    }
    return {
      success: false,
      requires2FA: false,
      requiresSetup: false,
      isDeviceTrusted: false,
      error: 'Contraseña de administrador incorrecta.',
    };
  }

  // Contraseña correcta
  resetFailedAttempts();

  const isConfigured = is2FAConfigured();
  const isTrusted = isCurrentDeviceTrusted();

  // Si 2FA está configurado y el dispositivo ES DE CONFIANZA, se autentica directamente
  if (isConfigured && isTrusted) {
    establishAdminSession(true);
    return {
      success: true,
      requires2FA: false,
      requiresSetup: false,
      isDeviceTrusted: true,
    };
  }

  // Si 2FA está configurado pero es un dispositivo nuevo o expirado -> Requerir 2FA
  if (isConfigured) {
    return {
      success: true,
      requires2FA: true,
      requiresSetup: false,
      isDeviceTrusted: false,
    };
  }

  // Si 2FA NO está configurado -> Requerir Setup de 2FA
  return {
    success: true,
    requires2FA: true,
    requiresSetup: true,
    isDeviceTrusted: false,
  };
}

/**
 * Inicia el asistente de configuración 2FA generando un nuevo secret TOTP, URI otpauth y código QR
 */
export async function initiate2FASetup(email: string, _phone?: string): Promise<{
  secret: string;
  otpAuthUri: string;
  qrDataUrl: string;
  backupCodes: string[];
}> {
  const secret = generateTOTPSecret();
  const cleanEmail = sanitizeInput(email).trim().toLowerCase();
  const otpAuthUri = generateOTPAuthURI({
    secret,
    accountName: cleanEmail || 'admin@laborapy.com.py',
    issuer: 'LaboraPy Paraguay',
  });

  const qrDataUrl = await QRCode.toDataURL(otpAuthUri, {
    width: 220,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const backupCodes = generateBackupCodes(6);

  return {
    secret,
    otpAuthUri,
    qrDataUrl,
    backupCodes,
  };
}

/**
 * Confirma la activación del 2FA validando el primer token de 6 dígitos emitido por el Authenticator
 */
export async function confirm2FAActivation(params: {
  tempSecret: string;
  email: string;
  phone: string;
  token: string;
  backupCodes: string[];
  trustDevice?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const cleanToken = params.token.replace(/[\s-]/g, '').trim();
  const isValid = await verifyTOTP(cleanToken, params.tempSecret);

  if (!isValid) {
    return {
      success: false,
      error: 'El código de 6 dígitos ingresado es incorrecto o ya expiró. Verifique su app Authenticator.',
    };
  }

  // Hashear códigos de respaldo con SHA-256
  const backupCodeHashes = await Promise.all(
    params.backupCodes.map(code => sha256(code.replace(/[\s-]/g, '').toUpperCase()))
  );

  const deviceId = getOrCreateDeviceId();
  const trustedDevices: TrustedDevice[] = [];

  if (params.trustDevice) {
    trustedDevices.push({
      deviceId,
      deviceName: getDeviceFriendlyName(),
      registeredAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + TRUSTED_DEVICE_DURATION_MS,
    });
  }

  const profile: AdminSecurityProfile = {
    email: sanitizeInput(params.email).trim().toLowerCase(),
    phone: sanitizeInput(params.phone).trim(),
    totpSecret: params.tempSecret,
    is2FAEnabled: true,
    backupCodeHashes,
    trustedDevices,
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
  }

  establishAdminSession(true);
  return { success: true };
}

/**
 * Paso 2: Valida el código TOTP de 6 dígitos o un código de respaldo para completar el login
 */
export async function verify2FALogin(
  tokenOrBackupCode: string,
  trustDevice: boolean = false
): Promise<{ success: boolean; error?: string; usedBackupCode?: boolean }> {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Acceso temporalmente restringido. Espere ${lockout.remainingSeconds} segundos.`,
    };
  }

  const profile = getAdminSecurityProfile();
  if (!profile || !profile.totpSecret) {
    return { success: false, error: 'La seguridad 2FA no está configurada.' };
  }

  const cleanInput = tokenOrBackupCode.replace(/[\s-]/g, '').trim();

  // Intento 1: ¿Es un código TOTP de 6 dígitos?
  if (/^\d{6}$/.test(cleanInput)) {
    const isValid = await verifyTOTP(cleanInput, profile.totpSecret);
    if (isValid) {
      resetFailedAttempts();
      handleDeviceTrustOnSuccess(profile, trustDevice);
      establishAdminSession(true);
      return { success: true, usedBackupCode: false };
    }
  }

  // Intento 2: ¿Es un código de respaldo de 8 caracteres?
  const inputHash = await sha256(cleanInput.toUpperCase());
  const backupIndex = profile.backupCodeHashes.indexOf(inputHash);

  if (backupIndex !== -1) {
    // Código de respaldo válido -> Quemar el código para que no se repita
    profile.backupCodeHashes.splice(backupIndex, 1);
    profile.updatedAt = Date.now();
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));

    resetFailedAttempts();
    handleDeviceTrustOnSuccess(profile, trustDevice);
    establishAdminSession(true);
    return { success: true, usedBackupCode: true };
  }

  // Falló la verificación
  recordFailedAttempt();
  const updatedLockout = getLockoutStatus();
  if (updatedLockout.isLocked) {
    return {
      success: false,
      error: `Ha superado el límite de intentos. Acceso bloqueado por ${updatedLockout.remainingSeconds} segundos.`,
    };
  }

  return {
    success: false,
    error: 'Código de autenticación o de respaldo incorrecto.',
  };
}

/**
 * Guarda o actualiza este dispositivo en la lista de dispositivos de confianza del perfil
 */
function handleDeviceTrustOnSuccess(profile: AdminSecurityProfile, trustDevice: boolean): void {
  const deviceId = getOrCreateDeviceId();
  profile.trustedDevices = profile.trustedDevices || [];

  const existingIndex = profile.trustedDevices.findIndex(d => d.deviceId === deviceId);
  if (trustDevice) {
    const deviceEntry: TrustedDevice = {
      deviceId,
      deviceName: getDeviceFriendlyName(),
      registeredAt: existingIndex !== -1 ? profile.trustedDevices[existingIndex].registeredAt : Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + TRUSTED_DEVICE_DURATION_MS,
    };

    if (existingIndex !== -1) {
      profile.trustedDevices[existingIndex] = deviceEntry;
    } else {
      profile.trustedDevices.push(deviceEntry);
    }
  } else if (existingIndex !== -1) {
    // Si ya existía, actualizar último uso
    profile.trustedDevices[existingIndex].lastUsedAt = Date.now();
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
  }
}

/**
 * Establece la sesión activa en sessionStorage
 */
function establishAdminSession(authenticatedWith2FA: boolean): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

  const sessionData: SessionData = {
    token: `admin_token_${Date.now()}_${generateSecureToken().substring(0, 16)}`,
    expiresAt: Date.now() + SESSION_DURATION_MS,
    authenticatedWith2FA,
    deviceId: getOrCreateDeviceId(),
  };

  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
}

/**
 * Cierra la sesión administrativa
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

/**
 * Cambia la contraseña maestra
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanCurrent = (currentPassword || '').trim();
  const cleanNew = sanitizeInput(newPassword || '').trim();

  if (!cleanCurrent) {
    return { success: false, error: 'Debe ingresar la contraseña actual.' };
  }

  if (!cleanNew || cleanNew.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  const currentHash = await sha256(cleanCurrent);
  const expectedHash = await getExpectedPasswordHash();

  if (currentHash !== expectedHash) {
    return { success: false, error: 'La contraseña actual no es correcta.' };
  }

  const newHash = await sha256(cleanNew);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_CUSTOM_HASH_KEY, newHash);
  }

  return { success: true };
}

/**
 * Revoca un dispositivo de confianza específico
 */
export function revokeTrustedDevice(deviceId: string): void {
  const profile = getAdminSecurityProfile();
  if (!profile || !profile.trustedDevices) return;

  profile.trustedDevices = profile.trustedDevices.filter(d => d.deviceId !== deviceId);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
  }
}

/**
 * Revoca todos los dispositivos de confianza vinculados
 */
export function revokeAllTrustedDevices(): void {
  const profile = getAdminSecurityProfile();
  if (!profile) return;

  profile.trustedDevices = [];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
  }
}

/**
 * Regenera un nuevo lote de 6 códigos de respaldo
 */
export async function regenerateBackupCodes(): Promise<string[]> {
  const profile = getAdminSecurityProfile();
  if (!profile) throw new Error('No hay perfil 2FA activo.');

  const newCodes = generateBackupCodes(6);
  profile.backupCodeHashes = await Promise.all(
    newCodes.map(code => sha256(code.replace(/[\s-]/g, '').toUpperCase()))
  );
  profile.updatedAt = Date.now();

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
  }

  return newCodes;
}

/**
 * Restaura la contraseña predeterminada (elimina personalizaciones en localStorage)
 */
export function resetCustomPassword(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(ADMIN_CUSTOM_HASH_KEY);
  }
}

/**
 * Restaura el estado de 2FA por completo (para pruebas o reset del sistema)
 */
export function reset2FAProfile(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(ADMIN_2FA_PROFILE_KEY);
  }
}

/**
 * Restablece las credenciales administrativas de fábrica (Contraseña predeterminada y 2FA desactivado)
 */
export function factoryResetAdminAccess(): void {
  if (typeof window !== 'undefined') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_CUSTOM_HASH_KEY);
      localStorage.removeItem(ADMIN_2FA_PROFILE_KEY);
      localStorage.removeItem(ADMIN_LOCKOUT_KEY);
      localStorage.removeItem(ADMIN_DEVICE_ID_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_RECOVERY_KEY);
    }
    resetFailedAttempts();
  }
}

if (typeof window !== 'undefined') {
  (window as any).__resetAdminAccess = factoryResetAdminAccess;
  (window as any).resetLaboraPyAdmin = factoryResetAdminAccess;
}

export interface RecoveryChallenge {
  code: string;
  email: string;
  phone: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Consulta si se ha configurado una contraseña personalizada en este navegador
 */
export function isCustomPasswordConfigured(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  const custom = localStorage.getItem(ADMIN_CUSTOM_HASH_KEY);
  return Boolean(custom && custom.trim());
}

/**
 * Solicita la recuperación de contraseña validando correo y celular vinculados,
 * generando un token OTP de 6 dígitos con validez de 10 minutos y despachándolo a Webhook y WhatsApp.
 */
export async function requestPasswordRecovery(
  inputEmail: string,
  inputPhone: string
): Promise<{
  success: boolean;
  error?: string;
  directWhatsAppUrl?: string;
  expiresInMinutes?: number;
  hasWebhook?: boolean;
  emergencyCode?: string;
}> {
  const cleanEmail = sanitizeInput(inputEmail).trim().toLowerCase();
  const cleanPhone = sanitizeInput(inputPhone).replace(/[^0-9+]/g, '');

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Por favor, ingrese un correo electrónico válido.' };
  }
  if (!cleanPhone || cleanPhone.length < 8) {
    return { success: false, error: 'Por favor, ingrese un número de celular válido (+595...).' };
  }

  const profile = getAdminSecurityProfile();
  if (profile) {
    // Validar coincidencia con perfil vinculado
    const profileEmail = profile.email.trim().toLowerCase();
    const profilePhone = profile.phone.replace(/[^0-9+]/g, '');

    const inputSuffix = cleanPhone.slice(-8);
    const profileSuffix = profilePhone.slice(-8);

    if (cleanEmail !== profileEmail || inputSuffix !== profileSuffix) {
      return {
        success: false,
        error: 'Los datos ingresados no coinciden con el perfil de seguridad vinculado al administrador.',
      };
    }
  }

  // Generar código aleatorio seguro de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const challenge: RecoveryChallenge = {
    code,
    email: cleanEmail,
    phone: cleanPhone,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutos
    createdAt: Date.now(),
  };

  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(ADMIN_RECOVERY_KEY, JSON.stringify(challenge));
  }

  // Notificar al Webhook comercial si está configurado
  const webhookUrl = getCRMWebhookUrl();
  let hasWebhook = false;
  if (webhookUrl && webhookUrl.trim()) {
    hasWebhook = true;
    try {
      fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ADMIN_PASSWORD_RESET_REQUEST',
          timestamp: new Date().toISOString(),
          adminEmail: cleanEmail,
          adminPhone: cleanPhone,
          recoveryCode: code,
          expiresInMinutes: 10,
          source: 'LaboraPy Portal Admin',
        }),
      }).catch(err => console.warn('[AdminRecovery] Notificación a Webhook falló de forma no bloqueante:', err));
    } catch {
      // Ignorar fallo de red
    }
  }

  // Enlace directo para auto-confirmar en WhatsApp
  const waMsg = `LaboraPy Seguridad: Mi código de recuperación para el panel administrativo es [ ${code} ]. Solicito confirmación.`;
  const directWhatsAppUrl = createWhatsAppUrl(waMsg, cleanPhone);

  return {
    success: true,
    expiresInMinutes: 10,
    directWhatsAppUrl,
    hasWebhook,
    emergencyCode: code,
  };
}

/**
 * Restablece la contraseña utilizando directamente uno de los 6 códigos de respaldo de emergencia del 2FA.
 * Útil cuando el administrador no tiene acceso a WhatsApp ni a servidores de correo.
 */
export async function resetPasswordWithBackupCode(params: {
  backupCode: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanBackup = (params.backupCode || '').replace(/[\s-]/g, '').toUpperCase();
  if (!cleanBackup) {
    return { success: false, error: 'Por favor, ingrese un código de respaldo.' };
  }

  const cleanNew = sanitizeInput(params.newPassword).trim();
  if (!cleanNew || cleanNew.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  const profile = getAdminSecurityProfile();
  if (!profile || !profile.is2FAEnabled || !profile.backupCodeHashes || profile.backupCodeHashes.length === 0) {
    return {
      success: false,
      error: 'No se encontró un perfil 2FA con códigos de respaldo configurados. Utilice el código de recuperación estándar.',
    };
  }

  const tokenHash = await sha256(cleanBackup);
  const backupIndex = profile.backupCodeHashes.indexOf(tokenHash);

  if (backupIndex === -1) {
    return { success: false, error: 'El código de respaldo es incorrecto o ya ha sido utilizado anteriormente.' };
  }

  // Consumir el código de respaldo
  profile.backupCodeHashes.splice(backupIndex, 1);
  profile.updatedAt = Date.now();

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
    const newHash = await sha256(cleanNew);
    localStorage.setItem(ADMIN_CUSTOM_HASH_KEY, newHash);
  }

  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(ADMIN_RECOVERY_KEY);
  }
  resetFailedAttempts();

  return { success: true };
}

/**
 * Valida el código de recuperación, el segundo factor (si 2FA está activo) y establece la nueva clave
 */
export async function verifyRecoveryAndResetPassword(params: {
  code: string;
  newPassword: string;
  twoFactorToken?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return { success: false, error: 'Entorno no compatible.' };
  }

  const rawChallenge = sessionStorage.getItem(ADMIN_RECOVERY_KEY);
  if (!rawChallenge) {
    return { success: false, error: 'No hay una solicitud de recuperación activa o ya expiró.' };
  }

  let challenge: RecoveryChallenge;
  try {
    challenge = JSON.parse(rawChallenge);
  } catch {
    return { success: false, error: 'Error al leer el token de recuperación.' };
  }

  if (Date.now() > challenge.expiresAt) {
    sessionStorage.removeItem(ADMIN_RECOVERY_KEY);
    return { success: false, error: 'El código de recuperación ha expirado (límite 10 minutos). Solicite uno nuevo.' };
  }

  const cleanInputCode = params.code.replace(/[\s-]/g, '').trim();
  if (cleanInputCode !== challenge.code) {
    return { success: false, error: 'El código de recuperación ingresado es incorrecto.' };
  }

  const cleanNewPass = sanitizeInput(params.newPassword).trim();
  if (!cleanNewPass || cleanNewPass.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  // Si 2FA está configurado, exigir también la validación de 2FA o código de respaldo
  const profile = getAdminSecurityProfile();
  if (profile && profile.is2FAEnabled && profile.totpSecret) {
    const clean2FAToken = (params.twoFactorToken || '').replace(/[\s-]/g, '').trim();
    if (!clean2FAToken) {
      return {
        success: false,
        error: 'Debe ingresar su código de 6 dígitos de Google Authenticator o un código de respaldo.',
      };
    }

    let is2FAValid = false;
    if (/^\d{6}$/.test(clean2FAToken)) {
      is2FAValid = await verifyTOTP(clean2FAToken, profile.totpSecret);
    }

    if (!is2FAValid) {
      // Verificar si es código de respaldo
      const tokenHash = await sha256(clean2FAToken.toUpperCase());
      const backupIndex = profile.backupCodeHashes.indexOf(tokenHash);
      if (backupIndex !== -1) {
        profile.backupCodeHashes.splice(backupIndex, 1);
        profile.updatedAt = Date.now();
        localStorage.setItem(ADMIN_2FA_PROFILE_KEY, JSON.stringify(profile));
        is2FAValid = true;
      }
    }

    if (!is2FAValid) {
      return { success: false, error: 'Código de Google Authenticator o de respaldo incorrecto.' };
    }
  }

  // Guardar nueva contraseña hasheada
  const newHash = await sha256(cleanNewPass);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ADMIN_CUSTOM_HASH_KEY, newHash);
  }

  // Limpiar desafío de recuperación y reestablecer intentos
  sessionStorage.removeItem(ADMIN_RECOVERY_KEY);
  resetFailedAttempts();

  return { success: true };
}

