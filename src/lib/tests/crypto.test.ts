import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  sanitizeExcelFormula,
  generateSecureToken,
  sha256,
  encryptData,
  decryptData,
} from '../crypto';

describe('Módulo Criptográfico y Sanitización (src/lib/crypto.ts)', () => {
  it('debe sanitizar cadenas para prevenir ataques XSS', () => {
    const raw = '<script>alert("hack")</script><img src=x onerror=alert(1)>';
    const clean = sanitizeInput(raw);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('>');
    expect(clean).toContain('&lt;script&gt;');
  });

  it('debe neutralizar fórmulas maliciosas de Excel (CWE-1236)', () => {
    expect(sanitizeExcelFormula('=CMD|"/C calc"!A0')).toBe("'=CMD|\"/C calc\"!A0");
    expect(sanitizeExcelFormula('+12345')).toBe("'+12345");
    expect(sanitizeExcelFormula('-5000')).toBe("'-5000");
    expect(sanitizeExcelFormula('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(sanitizeExcelFormula('Texto Normal')).toBe('Texto Normal');
  });

  it('debe generar tokens criptográficos de 64 caracteres hexadecimales (256 bits)', () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();
    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
  });

  it('debe generar hashes SHA-256 consistentes', async () => {
    const hash1 = await sha256('laborapy2026');
    const hash2 = await sha256('laborapy2026');
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('debe cifrar y descifrar objetos con AES-256-GCM correctamente', async () => {
    const original = {
      nombre: 'Lic. María González',
      email: 'maria@corporativo.com.py',
      salario: 15000000,
    };

    const encrypted = await encryptData(original);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toContain('maria@corporativo.com.py');
    expect(encrypted.startsWith('enc_gcm:') || encrypted.startsWith('enc_b64:')).toBe(true);

    const decrypted = await decryptData<typeof original>(encrypted);
    expect(decrypted).toEqual(original);
  });
});

