/**
 * MOTOR DE AUTENTICACIÓN TOTP (RFC 6238 / RFC 4226) & BASE32 (RFC 4648)
 * LaboraPy — Implementación Criptográfica Nativa con Web Crypto API
 * Compatible con Google Authenticator, Microsoft Authenticator, Authy y Apple Passwords.
 * Versión: PY-TOTP-2026.09.07
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function getCrypto(): Crypto | null {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
  return null;
}

/**
 * Decodifica una cadena Base32 a un arreglo de bytes (Uint8Array)
 */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue; // Ignorar caracteres no válidos

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Codifica un arreglo de bytes (Uint8Array) a una cadena Base32
 */
export function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

/**
 * Genera una clave secreta aleatoria criptográficamente segura en Base32 (160 bits = 20 bytes)
 */
export function generateTOTPSecret(): string {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(20);
  if (cryptoObj) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return base32Encode(bytes);
}

/**
 * Genera la URI estándar otpauth:// para escanear o abrir en aplicaciones Authenticator
 */
export function generateOTPAuthURI(options: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = options.issuer || 'LaboraPy Paraguay';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(options.accountName)}`;
  const params = new URLSearchParams({
    secret: options.secret.replace(/[\s-]/g, '').toUpperCase(),
    issuer: issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Convierte un número entero de 64 bits a un buffer de 8 bytes big-endian
 */
function intToBigEndianBuffer(counter: number): Uint8Array {
  const buffer = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  return buffer;
}

/**
 * Calcula el código TOTP dinámico de 6 dígitos para un secreto Base32 dado y timestamp (RFC 6238)
 */
export async function calculateTOTP(secretBase32: string, timestampMs: number = Date.now()): Promise<string> {
  const cryptoObj = getCrypto();
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API no disponible en este entorno.');
  }

  const keyBytes = base32Decode(secretBase32);
  const timeStep = Math.floor(timestampMs / 1000 / 30);
  const timeBuffer = intToBigEndianBuffer(timeStep);

  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, timeBuffer as any);
  const hash = new Uint8Array(signature);

  // Truncamiento dinámico (RFC 4226 Sección 5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifica un código TOTP contra un secreto con tolerancia a desfasajes de reloj (±1 paso de 30s)
 */
export async function verifyTOTP(
  token: string,
  secretBase32: string,
  currentTimestampMs: number = Date.now(),
  windowSteps: number = 1
): Promise<boolean> {
  const cleanToken = token.replace(/[\s-]/g, '').trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const checkTime = currentTimestampMs + step * 30 * 1000;
    try {
      const calculated = await calculateTOTP(secretBase32, checkTime);
      if (calculated === cleanToken) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Genera un conjunto de 6 códigos de respaldo únicos de 8 caracteres (formato: XXXX-XXXX)
 */
export function generateBackupCodes(count: number = 6): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin caracteres confusos (0, 1, I, O)
  const cryptoObj = getCrypto();
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    if (cryptoObj) {
      cryptoObj.getRandomValues(bytes);
    } else {
      for (let j = 0; j < 8; j++) bytes[j] = Math.floor(Math.random() * 256);
    }

    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
      if (j === 3) code += '-';
    }
    codes.push(code);
  }

  return codes;
}

/**
 * Formatea una clave secreta en grupos legibles de 4 caracteres para facilitar la carga manual
 * Ej: ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567
 */
export function formatSecretKey(secret: string): string {
  const clean = secret.replace(/[\s-]/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}
