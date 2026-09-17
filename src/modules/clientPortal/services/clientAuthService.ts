/**
 * SERVICIO DE AUTENTICACIÓN Y SESIÓN DEL PORTAL DE CLIENTES
 * Manejo de credenciales de clientes, multi-empresa, tokens de sesión y protección anti-fuerza bruta
 */

import type { ClienteUsuario, ClientSession, EmpresaCliente } from '../types/clientPortal';
import { DEMO_USUARIOS } from '../constants/demoData';
import { getEmpresasClientes, saveEmpresaCliente } from './clientStorageService';
import { sha256 } from '../../../lib/crypto';

export const CLIENT_SESSION_KEY = 'laborapy_client_session';
export const CLIENT_USERS_STORAGE_KEY = 'laborapy_client_custom_users';
export const CLIENT_LOCKOUT_STORAGE_KEY = 'laborapy_client_lockouts';
export const CLIENT_REMEMBERED_EMAIL_KEY = 'laborapy_client_remembered_email';
export const CLIENT_RECOVERY_STORAGE_KEY = 'laborapy_client_recovery_tokens';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_TIME_MS = 30 * 1000; // 30 segundos de bloqueo temporal

const DEFAULT_DEMO_EMAIL = 'cliente@laborapy.com';
const DEFAULT_DEMO_PASS = 'Cliente2026!';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

interface LockoutEntry {
  failed: number;
  lockedUntil: number;
}

type LockoutStore = Record<string, LockoutEntry>;

interface RecoveryTokenEntry {
  email: string;
  token: string;
  expiresAt: number;
}

type RecoveryTokenStore = Record<string, RecoveryTokenEntry>;

let memorySession: ClientSession | null = null;
let memoryLockouts: LockoutStore = {};
let memoryRememberedEmail = '';
let memoryRecoveryTokens: RecoveryTokenStore = {};
let memoryCustomUsers: ClienteUsuario[] = [];

/**
 * Interruptor administrativo del acceso de prueba / demo al ERP.
 * Por defecto DESHABILITADO en ejecución estándar; su reactivación es explícita
 * mediante setDemoLoginEnabled(true) (pruebas automatizadas o habilitación bajo demanda).
 */
let demoLoginEnabled = false;

/**
 * Indica si el acceso de prueba / demo al ERP se encuentra habilitado.
 */
export function isDemoLoginEnabled(): boolean {
  return demoLoginEnabled;
}

/**
 * Habilita o deshabilita el acceso de prueba / demo al ERP.
 */
export function setDemoLoginEnabled(enabled: boolean): void {
  demoLoginEnabled = enabled === true;
}

function getSafeStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function readLockouts(): LockoutStore {
  const storage = getSafeStorage();
  if (!storage) return memoryLockouts;
  try {
    const raw = storage.getItem(CLIENT_LOCKOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : memoryLockouts;
  } catch {
    return memoryLockouts;
  }
}

function writeLockouts(store: LockoutStore): void {
  memoryLockouts = store;
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(CLIENT_LOCKOUT_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Degradar a memoria si falla el storage
    }
  }
}

/**
 * Verifica si una cuenta cliente está bloqueada por intentos fallidos.
 */
export function checkLockout(email: string): { isLocked: boolean; remainingSeconds: number } {
  const key = email.trim().toLowerCase();
  if (!key) return { isLocked: false, remainingSeconds: 0 };

  const store = readLockouts();
  const entry = store[key];
  if (!entry) return { isLocked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (entry.lockedUntil > now) {
    return {
      isLocked: true,
      remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Si el bloqueo expiró, limpiar
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    delete store[key];
    writeLockouts(store);
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Registra un intento fallido y bloquea si alcanza el límite.
 */
export function recordFailedAttempt(email: string): void {
  const key = email.trim().toLowerCase();
  if (!key) return;

  const store = readLockouts();
  const entry: LockoutEntry = store[key] ?? { failed: 0, lockedUntil: 0 };

  entry.failed += 1;
  if (entry.failed >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_TIME_MS;
    entry.failed = 0; // Se reinicia tras aplicar el castigo
  }

  store[key] = entry;
  writeLockouts(store);
}

/**
 * Restablece los intentos fallidos tras login exitoso o desbloqueo manual.
 */
export function resetLockout(email: string): void {
  const key = email.trim().toLowerCase();
  if (!key) return;

  const store = readLockouts();
  if (store[key]) {
    delete store[key];
    writeLockouts(store);
  }
}

/**
 * Obtiene el correo corporativo recordado para autocompletar en el modal.
 */
export function getRememberedEmail(): string {
  const storage = getSafeStorage();
  if (!storage) return memoryRememberedEmail;
  return storage.getItem(CLIENT_REMEMBERED_EMAIL_KEY) || memoryRememberedEmail;
}

/**
 * Guarda o borra el correo recordado según la preferencia del usuario.
 */
export function setRememberedEmail(email: string, remember: boolean): void {
  const cleanEmail = email.trim().toLowerCase();
  memoryRememberedEmail = remember && cleanEmail ? cleanEmail : '';
  const storage = getSafeStorage();
  if (!storage) return;
  if (remember && cleanEmail) {
    storage.setItem(CLIENT_REMEMBERED_EMAIL_KEY, cleanEmail);
  } else {
    storage.removeItem(CLIENT_REMEMBERED_EMAIL_KEY);
  }
}

function readRecoveryTokens(): RecoveryTokenStore {
  const storage = getSafeStorage();
  if (!storage) return memoryRecoveryTokens;
  try {
    const raw = storage.getItem(CLIENT_RECOVERY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : memoryRecoveryTokens;
  } catch {
    return memoryRecoveryTokens;
  }
}

function writeRecoveryTokens(store: RecoveryTokenStore): void {
  memoryRecoveryTokens = store;
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(CLIENT_RECOVERY_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignorar errores de storage
    }
  }
}

/**
 * Genera un código de 6 dígitos para recuperación de contraseña (validez 15 min).
 */
export async function requestClientPasswordReset(
  email: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Por favor ingrese su correo corporativo.' };
  }

  const users = getStoredUsers();
  const exists = users.some(u => u.email.toLowerCase() === cleanEmail) || cleanEmail === DEFAULT_DEMO_EMAIL;
  if (!exists) {
    return {
      success: false,
      error: 'No se encontró ninguna empresa cliente asociada a este correo electrónico.',
    };
  }

  // Generar código numérico de 6 dígitos seguro
  let code = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    code = (100000 + (arr[0] % 900000)).toString();
  } else {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const store = readRecoveryTokens();
  store[cleanEmail] = {
    email: cleanEmail,
    token: code,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  writeRecoveryTokens(store);

  return { success: true, token: code };
}

/**
 * Valida el código de recuperación y actualiza la contraseña del cliente aplicando SHA-256.
 */
export async function confirmClientPasswordReset(
  email: string,
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();
  const cleanPass = newPassword.trim();

  if (!cleanEmail || !cleanToken || !cleanPass) {
    return { success: false, error: 'Por favor complete todos los campos de restablecimiento.' };
  }

  if (cleanPass.length < 6) {
    return { success: false, error: 'La nueva contraseña debe contener al menos 6 caracteres.' };
  }

  const store = readRecoveryTokens();
  const entry = store[cleanEmail];

  if (!entry || entry.token !== cleanToken) {
    return { success: false, error: 'El código de verificación es incorrecto o no coincide.' };
  }

  if (Date.now() > entry.expiresAt) {
    delete store[cleanEmail];
    writeRecoveryTokens(store);
    return { success: false, error: 'El código de verificación ha expirado (válido 15 minutos). Solicite uno nuevo.' };
  }

  // Código válido: actualizar contraseña
  const users = getStoredUsers();
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user && cleanEmail === DEFAULT_DEMO_EMAIL) {
    user = {
      id: 'usr_guarani_admin',
      clienteId: 'emp_guarani_001',
      email: cleanEmail,
      nombreContacto: 'Lic. Rodrigo Solís',
      rol: 'cliente_admin',
      activo: true,
    };
  }

  if (!user) {
    return { success: false, error: 'No se encontró la cuenta de usuario para actualizar.' };
  }

  const hash = await sha256(cleanPass);
  user.passwordHash = hash;
  saveClientUser(user);

  // Limpiar token usado y resetear cualquier bloqueo previo
  delete store[cleanEmail];
  writeRecoveryTokens(store);
  resetLockout(cleanEmail);

  return { success: true };
}

function getStoredUsers(): ClienteUsuario[] {
  const storage = getSafeStorage();
  let custom: ClienteUsuario[] = memoryCustomUsers;
  if (storage) {
    try {
      const raw = storage.getItem(CLIENT_USERS_STORAGE_KEY);
      if (raw) {
        custom = JSON.parse(raw);
      }
    } catch {
      custom = memoryCustomUsers;
    }
  }
  const map = new Map<string, ClienteUsuario>();
  DEMO_USUARIOS.forEach(u => map.set(u.email.toLowerCase(), u));
  custom.forEach(u => map.set(u.email.toLowerCase(), u));
  return Array.from(map.values());
}

export function saveClientUser(user: ClienteUsuario): void {
  const storage = getSafeStorage();
  const current = getStoredUsers();
  const idx = current.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...user };
  } else {
    current.push(user);
  }
  memoryCustomUsers = current;
  if (storage) {
    try {
      storage.setItem(CLIENT_USERS_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignorar errores de storage
    }
  }
}

/**
 * Actualiza la contraseña de un usuario cliente aplicando hash criptográfico SHA-256.
 */
export async function setClientUserPassword(email: string, plainPass: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = plainPass.trim();
  if (!cleanEmail || !cleanPass) return false;

  const users = getStoredUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) return false;

  const hash = await sha256(cleanPass);
  user.passwordHash = hash;
  saveClientUser(user);
  return true;
}

/**
 * Registra o da de alta a un usuario cliente con contraseña cifrada en SHA-256.
 */
export async function registerClientUser(
  userData: Omit<ClienteUsuario, 'passwordHash'>,
  plainPass: string
): Promise<ClienteUsuario> {
  const cleanPass = plainPass.trim();
  const hash = await sha256(cleanPass);
  const user: ClienteUsuario = {
    ...userData,
    email: userData.email.trim().toLowerCase(),
    passwordHash: hash,
  };
  saveClientUser(user);
  return user;
}

export async function loginClient(
  email: string,
  pass: string
): Promise<{ success: boolean; session?: ClientSession; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  // Validación básica
  if (!cleanEmail || !cleanPass) {
    return { success: false, error: 'Por favor complete todos los campos.' };
  }

  // 0) Interruptor administrativo: bloqueo inmediato y reversible del acceso de prueba / demo
  if (cleanEmail === DEFAULT_DEMO_EMAIL && !isDemoLoginEnabled()) {
    return {
      success: false,
      error: 'El acceso de prueba al ERP se encuentra temporalmente deshabilitado por administración.',
    };
  }

  // 1) Verificar bloqueo por fuerza bruta
  const lock = checkLockout(cleanEmail);
  if (lock.isLocked) {
    return {
      success: false,
      error: `Cuenta bloqueada temporalmente por seguridad. Reintente en ${lock.remainingSeconds} segundo${lock.remainingSeconds === 1 ? '' : 's'}.`,
    };
  }

  // 2) Validar credenciales
  const inputHash = await sha256(cleanPass);
  let credentialsValid = false;

  if (cleanEmail === DEFAULT_DEMO_EMAIL) {
    const users = getStoredUsers();
    const customDemoUser = users.find(u => u.email.toLowerCase() === DEFAULT_DEMO_EMAIL);
    if (customDemoUser && customDemoUser.passwordHash) {
      credentialsValid = customDemoUser.passwordHash === inputHash || customDemoUser.passwordHash === cleanPass;
    } else {
      const demoHash = await sha256(DEFAULT_DEMO_PASS);
      credentialsValid = cleanPass === DEFAULT_DEMO_PASS || inputHash === demoHash;
    }
  } else {
    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      if (!user.passwordHash) {
        // Si no tiene contraseña configurada, valida contra demo pass o inputHash
        credentialsValid = cleanPass === DEFAULT_DEMO_PASS;
      } else {
        // Compara contra hash SHA-256 o texto plano (para compatibilidad de tests legados)
        credentialsValid = user.passwordHash === inputHash || user.passwordHash === cleanPass;
      }
    }
  }

  if (!credentialsValid) {
    recordFailedAttempt(cleanEmail);
    const postLock = checkLockout(cleanEmail);
    if (postLock.isLocked) {
      return {
        success: false,
        error: `Demasiados intentos fallidos. Cuenta bloqueada por ${postLock.remainingSeconds} segundos.`,
      };
    }
    return { success: false, error: 'Correo electrónico o contraseña incorrectos.' };
  }

  // 3) Éxito: resetear bloqueo y construir sesión
  resetLockout(cleanEmail);

  const users = getStoredUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  const activeUser = user || {
    id: 'usr_guarani_admin',
    clienteId: 'emp_guarani_001',
    email: cleanEmail,
    nombreContacto: 'Lic. Rodrigo Solís',
    cargoContacto: 'Gerente Administrativo & Finanzas',
    telefono: '(0981) 777-888',
    rol: 'cliente_admin' as const,
    activo: true,
  };

  const empresas = getEmpresasClientes();
  let empresaPrincipal = empresas.find(e => e.id === activeUser.clienteId);

  if (!empresaPrincipal && empresas.length > 0) {
    empresaPrincipal = empresas[0];
  }

  if (!empresaPrincipal) {
    return { success: false, error: 'No se encontró la empresa asignada a este usuario.' };
  }

  // Generar sesión
  const token = `cli_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const session: ClientSession = {
    token,
    usuario: activeUser,
    empresa: empresaPrincipal,
    empresasDisponibles: empresas,
    expiresAt,
  };

  memorySession = session;
  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
  }

  return { success: true, session };
}

export function getClientSession(): ClientSession | null {
  const storage = getSafeStorage();
  if (storage) {
    try {
      const raw = storage.getItem(CLIENT_SESSION_KEY);
      if (raw) {
        const session: ClientSession = JSON.parse(raw);
        if (Date.now() > session.expiresAt) {
          logoutClient();
          return null;
        }
        return session;
      }
    } catch {
      // fallback to memory
    }
  }
  if (memorySession && Date.now() <= memorySession.expiresAt) {
    return memorySession;
  }
  return null;
}

export function isClientAuthenticated(): boolean {
  return getClientSession() !== null;
}

export function logoutClient(): void {
  memorySession = null;
  const storage = getSafeStorage();
  if (storage) {
    storage.removeItem(CLIENT_SESSION_KEY);
  }
}

export function switchClientEmpresa(empresaId: string): ClientSession | null {
  const session = getClientSession();
  if (!session) return null;

  const nuevaEmpresa = session.empresasDisponibles.find(e => e.id === empresaId);
  if (!nuevaEmpresa) return session;

  session.empresa = nuevaEmpresa;
  memorySession = session;
  const storage = getSafeStorage();
  if (storage) {
    storage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

/**
 * Actualiza la información de la empresa activa en la sesión y catálogo local.
 * Sincroniza la lista de empresas disponibles y persiste en memoria y storage.
 */
export function updateCurrentEmpresa(empresa: EmpresaCliente): ClientSession | null {
  if (!empresa || !empresa.id) return null;

  // 1) Persistir en el almacenamiento general de empresas
  saveEmpresaCliente(empresa);

  // 2) Obtener la sesión activa
  const session = getClientSession();
  if (!session) return null;

  // 3) Actualizar la empresa activa
  session.empresa = { ...empresa };

  // 4) Actualizar la lista de empresas disponibles en la sesión
  const disponibles = Array.isArray(session.empresasDisponibles)
    ? [...session.empresasDisponibles]
    : [];
  const idx = disponibles.findIndex(e => e.id === empresa.id);
  if (idx >= 0) {
    disponibles[idx] = { ...empresa };
  } else {
    disponibles.push({ ...empresa });
  }
  session.empresasDisponibles = disponibles;

  // 5) Guardar sesión en memoria y en localStorage
  memorySession = session;
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Degradar a memoria si falla el storage
    }
  }

  return session;
}

