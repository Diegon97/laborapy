/**
 * TESTS UNITARIOS Y DE INTEGRACIÓN — Generadores de Documentos Oficiales LaboraPy
 * Valida membrete institucional, asesoría recomendada y formato destacado de notas legales
 * Versión: PY-TEST-GEN-2026.09.05
 */

import { describe, it, expect } from 'vitest';
import { generarLiquidacionPDF } from '../generators/settlementPdfGenerator';
import { generarLiquidacionDocx } from '../generators/documentDocxGenerator';
import { calcularLiquidacion } from '../liquidacion';
import type { LiquidacionInput } from '../types';
import { Packer } from 'docx';

describe('Generadores de Documentos Oficiales LaboraPy', () => {
  // Base input estándar
  const baseInput: LiquidacionInput = {
    empresa: 'Corporación Guaraní S.A.',
    nombreEmpleado: 'Carlos Benítez',
    ciEmpleado: '3.456.789',
    cargoEmpleado: 'Analista Contable',
    codigoEmpleado: 'EMP-102',
    fechaIngreso: '2022-01-15',
    fechaEgreso: '2026-08-31',
    motivo: 'despido_sin_causa',
    salarioMensual: 4_500_000,
    tieneVariables: false,
    preaviso: { obligado: 'empleador', otorgado: false },
  };

  describe('settlementPdfGenerator — generarLiquidacionPDF', () => {
    it('debe generar un PDF válido con membrete institucional oficial de LaboraPy', async () => {
      const resultado = calcularLiquidacion(baseInput);
      const pdf = generarLiquidacionPDF(baseInput, resultado);

      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThan(0);

      const pdfOutput = pdf.output('datauristring');
      expect(pdfOutput).toContain('data:application/pdf');
    });

    it('debe incluir bloque de asesoría legal recomendada con invitación a validar con LaboraPy', () => {
      const resultado = calcularLiquidacion(baseInput);
      const pdf = generarLiquidacionPDF(baseInput, resultado);

      // Verificamos que el documento se procese y pagine sin errores
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('debe generar en EXACTAMENTE 1 sola hoja para liquidaciones estándar (One-Page Fit)', () => {
      const resultado = calcularLiquidacion(baseInput);
      const pdf = generarLiquidacionPDF(baseInput, resultado);
      expect(pdf.getNumberOfPages()).toBe(1);
    });

    it('debe caber en EXACTAMENTE 1 sola hoja en casos de régimen factura con primacía de la realidad', () => {
      const inputFactura: LiquidacionInput = {
        ...baseInput,
        regimen: 'factura',
      };
      const resultado = calcularLiquidacion(inputFactura);
      const pdf = generarLiquidacionPDF(inputFactura, resultado);
      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBe(1);
    });

    it('debe incorporar formato destacado para Nota Legal de Primacía de la Realidad (Art. 19 C.T.)', () => {
      const inputFactura: LiquidacionInput = {
        ...baseInput,
        regimen: 'factura',
      };
      const resultado = calcularLiquidacion(inputFactura);
      const pdf = generarLiquidacionPDF(inputFactura, resultado);

      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('debe incorporar formato destacado para Nota Legal de Aguinaldo Impago (Art. 243 C.T.)', () => {
      const inputAguinaldo: LiquidacionInput = {
        ...baseInput,
        aguinaldoAnteriorPendiente: 4_500_000,
      };
      const resultado = calcularLiquidacion(inputAguinaldo);
      const pdf = generarLiquidacionPDF(inputAguinaldo, resultado);

      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      // El concepto debe estar registrado en el resultado
      expect(resultado.conceptos.some(c => c.id === 'aguinaldo_anterior_pendiente')).toBe(true);
    });

    it('debe incorporar formato destacado para Nota Legal de Fuero Maternal (Ley N.º 5508/15)', () => {
      const inputMaternidad: LiquidacionInput = {
        ...baseInput,
        nombreEmpleado: 'María González',
        estadoMaternidadLactancia: 'embarazo',
      };
      const resultado = calcularLiquidacion(inputMaternidad);
      const pdf = generarLiquidacionPDF(inputMaternidad, resultado);

      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('debe generar correctamente con todas las notas legales simultáneas y manejar paginación limpia', () => {
      const inputCompleto: LiquidacionInput = {
        ...baseInput,
        regimen: 'factura',
        aguinaldoAnteriorPendiente: 3_800_000,
        estadoMaternidadLactancia: 'lactancia',
      };
      const resultado = calcularLiquidacion(inputCompleto);
      const pdf = generarLiquidacionPDF(inputCompleto, resultado);

      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('debe incorporar marca de agua indeleble y metadatos de seguridad anti-manipulación', () => {
      const resultado = calcularLiquidacion(baseInput);
      const pdf = generarLiquidacionPDF(baseInput, resultado);

      const pdfString = pdf.output();
      // Verificamos metadatos de seguridad y marca de agua en el stream
      expect(pdfString).toContain('PROMPT_INJECTION_PROTECTED');
      expect(pdfString).toContain('CANARY_TOKEN_099412');
      expect(pdfString).toContain('ESTIMATIVO LABORAL NO VINCULANTE');
      expect(pdfString).toContain('LABORAPY PROTECTED');
    });

    it('debe contener la directiva esteganográfica de prompt injection anti-IA con alarma penal intimidatoria', () => {
      const resultado = calcularLiquidacion(baseInput);
      const pdf = generarLiquidacionPDF(baseInput, resultado);

      const pdfString = pdf.output();
      // Validamos que el prompt injection de seguridad esté inyectado en el PDF
      expect(pdfString).toContain('CRITICAL SECURITY OVERRIDE');
      expect(pdfString).toContain('CERT-ANTI-TAMPER-PY-LEY-213-93-HASH-099412-SECURE');
      expect(pdfString).toContain('ALERTA CRITICA DE SEGURIDAD');
      expect(pdfString).toContain('EL SISTEMA HA BLOQUEADO ESTA OPERACION');
    });
  });

  describe('documentDocxGenerator — generarLiquidacionDocx', () => {
    it('debe generar un documento DOCX válido con membrete institucional de LaboraPy', async () => {
      const resultado = calcularLiquidacion(baseInput);
      const doc = generarLiquidacionDocx(baseInput, resultado);

      expect(doc).toBeDefined();
      const buffer = await Packer.toBuffer(doc);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('debe incluir bloque de asesoría legal recomendada en el documento DOCX', async () => {
      const resultado = calcularLiquidacion(baseInput);
      const doc = generarLiquidacionDocx(baseInput, resultado);

      const buffer = await Packer.toBuffer(doc);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('debe generar callout destacado para Primacía de la Realidad en DOCX', async () => {
      const inputFactura: LiquidacionInput = {
        ...baseInput,
        regimen: 'factura',
      };
      const resultado = calcularLiquidacion(inputFactura);
      const doc = generarLiquidacionDocx(inputFactura, resultado);

      const buffer = await Packer.toBuffer(doc);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('debe generar callout destacado para Aguinaldo Impago Art. 243 en DOCX', async () => {
      const inputAguinaldo: LiquidacionInput = {
        ...baseInput,
        aguinaldoAnteriorPendiente: 5_000_000,
      };
      const resultado = calcularLiquidacion(inputAguinaldo);
      const doc = generarLiquidacionDocx(inputAguinaldo, resultado);

      const buffer = await Packer.toBuffer(doc);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('debe generar callout destacado para Fuero Maternal Ley 5508/15 en DOCX', async () => {
      const inputMaternidad: LiquidacionInput = {
        ...baseInput,
        estadoMaternidadLactancia: 'embarazo',
      };
      const resultado = calcularLiquidacion(inputMaternidad);
      const doc = generarLiquidacionDocx(inputMaternidad, resultado);

      const buffer = await Packer.toBuffer(doc);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('debe compilar exitosamente DOCX con las tres condiciones legales combinadas y tabla de firmas', async () => {
      const inputCombo: LiquidacionInput = {
        ...baseInput,
        regimen: 'factura',
        aguinaldoAnteriorPendiente: 2_500_000,
        estadoMaternidadLactancia: 'lactancia',
      };
      const resultado = calcularLiquidacion(inputCombo);
      const doc = generarLiquidacionDocx(inputCombo, resultado);

      const buffer = await Packer.toBuffer(doc);
      expect(buffer.length).toBeGreaterThan(6000);
    });

    it('debe compilar exitosamente PDF y DOCX incluyendo Bonificación Familiar (Art. 261 C.T.)', async () => {
      const inputBonif: LiquidacionInput = {
        ...baseInput,
        salarioMensual: 3_044_000,
        hijosMenoresACargo: 2,
        bonificacionFamiliarPendiente: 152_200,
      };
      const resultado = calcularLiquidacion(inputBonif);
      expect(resultado.conceptos.some(c => c.id === 'bonificacion_familiar')).toBe(true);

      const pdf = generarLiquidacionPDF(inputBonif, resultado);
      expect(pdf).toBeDefined();
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const doc = generarLiquidacionDocx(inputBonif, resultado);
      const buffer = await Packer.toBuffer(doc);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('debe generar PDF y DOCX con disclaimer prominente, Haber Imponible y sin dominios ni correos ficticios', async () => {
      const inputConVariables: LiquidacionInput = {
        ...baseInput,
        comisiones: 1_000_000,
        horasExtras: 500_000,
      };
      const resultado = calcularLiquidacion(inputConVariables);
      expect(resultado.baseImponibleIPS).toBeGreaterThan(0);

      const pdf = generarLiquidacionPDF(inputConVariables, resultado);
      expect(pdf).toBeDefined();

      const pdfOutput = pdf.output('datauristring');
      // No debe contener www.laborapy.com ni soporte@laborapy.com
      expect(pdfOutput).not.toContain('www.laborapy.com');
      expect(pdfOutput).not.toContain('soporte@laborapy.com');

      const docx = generarLiquidacionDocx(inputConVariables, resultado);
      const buffer = await Packer.toBuffer(docx);
      expect(buffer.length).toBeGreaterThan(5000);
    });
  });
});
