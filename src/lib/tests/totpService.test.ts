import { describe, it, expect } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTOTPSecret,
  generateOTPAuthURI,
  calculateTOTP,
  verifyTOTP,
  generateBackupCodes,
  formatSecretKey,
} from '../totpService';

describe('totpService - Algoritmo TOTP (RFC 6238) y Base32', () => {
  it('debe codificar y decodificar en Base32 simétricamente', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 33]); // "Hello!"
    const encoded = base32Encode(original);
    expect(encoded).toBe('JBSWY3DPEE');

    const decoded = base32Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('debe generar un secreto TOTP de 32 caracteres en Base32 válido', () => {
    const secret = generateTOTPSecret();
    expect(secret.length).toBe(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);

    const decoded = base32Decode(secret);
    expect(decoded.length).toBe(20); // 160 bits
  });

  it('debe generar la URI estándar de otpauth con todos los parámetros requeridos', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const uri = generateOTPAuthURI({
      secret,
      accountName: 'admin@laborapy.com.py',
      issuer: 'LaboraPy Paraguay',
    });

    expect(uri).toContain('otpauth://totp/LaboraPy%20Paraguay:admin%40laborapy.com.py');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=LaboraPy+Paraguay');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('debe calcular códigos TOTP de exactamente 6 dígitos numéricos', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = await calculateTOTP(secret, 1725740000000);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('debe verificar con éxito el código generado para el momento actual y tolerar ±30s', async () => {
    const secret = generateTOTPSecret();
    const now = Date.now();
    const currentCode = await calculateTOTP(secret, now);

    // Verificación exacta
    const isValid = await verifyTOTP(currentCode, secret, now);
    expect(isValid).toBe(true);

    // Verificación 25 segundos después (dentro de ventana)
    const isValidWindow = await verifyTOTP(currentCode, secret, now + 25000);
    expect(isValidWindow).toBe(true);

    // Rechazar código inválido
    const isInvalid = await verifyTOTP('000000', secret, now);
    expect(isInvalid).toBe(false);

    // Rechazar longitud diferente
    const isMalformed = await verifyTOTP('123', secret, now);
    expect(isMalformed).toBe(false);
  });

  it('debe generar 6 códigos de respaldo únicos con formato XXXX-XXXX', () => {
    const codes = generateBackupCodes(6);
    expect(codes.length).toBe(6);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    }

    const uniqueSet = new Set(codes);
    expect(uniqueSet.size).toBe(6);
  });

  it('debe formatear claves secretas en bloques de 4 caracteres legibles', () => {
    const raw = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const formatted = formatSecretKey(raw);
    expect(formatted).toBe('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');
  });
});
