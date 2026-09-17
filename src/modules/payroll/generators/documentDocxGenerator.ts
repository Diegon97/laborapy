/**
 * GENERADOR DE DOCUMENTOS WORD EDITABLES (.DOCX) — Paraguay
 * Formato institucional oficial de LaboraPy - Plataforma Legal & Contable de Paraguay
 * Versión: PY-LIQ-2026.09.05
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Footer,
} from 'docx';
import { saveAs } from 'file-saver';
import type { LiquidacionResult, LiquidacionInput } from '../types';
import { formatearAntiguedad } from '../engine/dates';

/**
 * Genera una tabla destacada con formato de llamada / alerta legal (Callout box)
 */
function crearCalloutBoxDocx(opts: {
  titulo: string;
  colorTitulo: string;
  colorFondo: string;
  colorBorde: string;
  cuerpo: string;
  colorCuerpo: string;
}): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: opts.colorFondo },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 24, color: opts.colorBorde },
              top: { style: BorderStyle.SINGLE, size: 4, color: opts.colorBorde },
              right: { style: BorderStyle.SINGLE, size: 4, color: opts.colorBorde },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: opts.colorBorde },
            },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: opts.titulo,
                    bold: true,
                    size: 18,
                    color: opts.colorTitulo,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: opts.cuerpo,
                    size: 17,
                    color: opts.colorCuerpo,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function computeDocumentSealHex(content: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p1 + p2).toUpperCase();
}

/**
 * Construye el objeto Document de Word con la liquidación oficial LaboraPy
 */
export function generarLiquidacionDocx(
  input: LiquidacionInput,
  result: LiquidacionResult,
): Document {
  const empresa = input.empresa && input.empresa.trim() ? input.empresa.trim() : '';
  const antiguedadStr = formatearAntiguedad(result.antiguedad);
  const sealHex = computeDocumentSealHex(
    `${input.ciEmpleado || ''}|${input.nombreEmpleado || ''}|${input.empresa || ''}|${result.totalNetoEstimado}|${input.fechaEgreso}|${result.versionReglas}`
  );

  // Verificación de Notas Legales Destacadas
  const tieneFactura = input.regimen === 'factura';
  const montoAguinaldoImpago =
    input.aguinaldoAnteriorPendiente ||
    (result.conceptos.find(c => c.id === 'aguinaldo_anterior_pendiente')?.monto || 0);
  const tieneAguinaldoImpago = Boolean(montoAguinaldoImpago && montoAguinaldoImpago > 0);
  const tieneFueroMaternal = Boolean(input.estadoMaternidadLactancia && input.estadoMaternidadLactancia !== 'ninguno');

  const notasLegalesElementos: (Paragraph | Table)[] = [];

  // 1. Nota Legal: Primacía de la Realidad
  if (tieneFactura) {
    notasLegalesElementos.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    notasLegalesElementos.push(
      crearCalloutBoxDocx({
        titulo: '⚖️ NOTA LEGAL: PRINCIPIO DE PRIMACÍA DE LA REALIDAD (ARTS. 18 Y 19 LEY N.º 213/93)',
        colorTitulo: '92400E', // amber-800
        colorFondo: 'FEF3C7',  // amber-100
        colorBorde: 'D97706',  // amber-600
        cuerpo:
          'Modalidad de facturación mensual recurrente: Al concurrir elementos de subordinación jurídica, cumplimiento de horario de trabajo y dependencia económica, ' +
          'opera de pleno derecho la presunción legal de contrato de trabajo (Principio de Primacía de la Realidad), resultando plenamente exigibles todas las indemnizaciones ' +
          'por despido, preaviso sustitutivo, aguinaldo proporcional y vacaciones del Código del Trabajo paraguayo.',
        colorCuerpo: '78350F', // amber-900
      }),
    );
  }

  // 2. Nota Legal: Aguinaldo Impago Art. 243
  if (tieneAguinaldoImpago) {
    notasLegalesElementos.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    notasLegalesElementos.push(
      crearCalloutBoxDocx({
        titulo: '⚖️ NOTA LEGAL: AGUINALDO IMPAGO DE PERÍODOS ANTERIORES (ART. 243 LEY N.º 213/93)',
        colorTitulo: '1E40AF', // blue-800
        colorFondo: 'EFF6FF',  // blue-50
        colorBorde: '2563EB',  // blue-600
        cuerpo:
          `Se incluye el pago de aguinaldo adeudado de períodos anteriores por un total de Gs. ${montoAguinaldoImpago.toLocaleString('es-PY')}. ` +
          'El pago de la remuneración anual complementaria antes del 31 de diciembre constituye una obligación legal patronal ineludible e impostergable (Art. 243 Código del Trabajo). ' +
          'Dicho importe constituye un crédito laboral exigible e irrenunciable que se liquida al 100% íntegro, totalmente exento de aportes jubilatorios y descuentos del IPS (Art. 76 Dec.-Ley 1860/50).',
        colorCuerpo: '1E3A8A', // blue-900
      }),
    );
  }

  // 3. Nota Legal: Fuero Maternal Ley 5508/15
  if (tieneFueroMaternal) {
    const condicionMaternal =
      input.estadoMaternidadLactancia === 'embarazo'
        ? 'Estado de Gestación / Embarazo'
        : 'Período de Lactancia Materna';

    notasLegalesElementos.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    notasLegalesElementos.push(
      crearCalloutBoxDocx({
        titulo: '⚠️ ADVERTENCIA LEGAL: FUERO MATERNAL E INAMOVILIDAD (LEY N.º 5508/15 Y ART. 136 C.T.)',
        colorTitulo: '991B1B', // red-800
        colorFondo: 'FEF2F2',  // red-50
        colorBorde: 'DC2626',  // red-600
        cuerpo:
          `La trabajadora se encuentra amparada por el fuero especial de inamovilidad laboral de maternidad (${condicionMaternal}). ` +
          'Cualquier desvinculación, preaviso o modificación unilateral de condiciones de trabajo sin previo juicio de justificación de causal legal ante el Juzgado de Primera Instancia en lo Laboral es nula de pleno derecho, ' +
          'habilitando la acción judicial de reinstalación inmediata o pago de las indemnizaciones agravadas de ley.',
        colorCuerpo: '7F1D1D', // red-900
      }),
    );
  }

  return new Document({
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `LaboraPy — Plataforma Legal & Contable de Paraguay | Motor PY v${result.versionReglas} | Documento Referencial Oficial`,
                    size: 16,
                    color: '888888',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── MEMBRETE INSTITUCIONAL LABORAPY ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({
                text: 'LaboraPy',
                bold: true,
                size: 32,
                color: '0F5132',
                font: 'Calibri',
              }),
              new TextRun({
                text: ' — Plataforma Legal & Contable de Paraguay',
                bold: true,
                size: 24,
                color: '1E5032',
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: 'Sistema Oficial de Liquidaciones Laborales · República del Paraguay',
                italics: true,
                size: 18,
                color: '666666',
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: 'LIQUIDACIÓN FINAL DE HABERES LABORALES',
                bold: true,
                size: 28,
                color: '1E5032',
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: input.regimenLaboral === 'domestico'
                  ? 'República del Paraguay — Trabajo Doméstico (Ley N.º 5407/15) · Ley N.º 5508/15'
                  : 'República del Paraguay — Código del Trabajo (Ley N.º 213/93) · Ley N.º 5508/15',
                italics: true,
                size: 20,
                color: '555555',
                font: 'Calibri',
              }),
            ],
          }),
          ...(empresa ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
              children: [
                new TextRun({
                  text: `Empleador / Razón Social: ${empresa}`,
                  bold: true,
                  size: 20,
                  color: '333333',
                  font: 'Calibri',
                }),
              ],
            }),
          ] : []),
          new Paragraph({ text: '', spacing: { after: 80 } }),

          // ── DATOS DEL EMPLEADO ──
          new Paragraph({
            children: [
              new TextRun({ text: '1 - DATOS GENERALES DEL TRABAJADOR Y VÍNCULO', bold: true, size: 20, color: '1E5032', font: 'Calibri' }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Trabajador: ${input.nombreEmpleado || '—'}`)] }),
                  new TableCell({ children: [new Paragraph(`C.I. Nº: ${input.ciEmpleado || '—'}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Cargo / Función: ${input.cargoEmpleado || '—'}`)] }),
                  new TableCell({ children: [new Paragraph(`Código / Ref: ${input.codigoEmpleado || '—'}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Fecha Ingreso: ${input.fechaIngreso}`)] }),
                  new TableCell({ children: [new Paragraph(`Fecha Egreso: ${input.fechaEgreso}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Antigüedad: ${antiguedadStr}`)] }),
                  new TableCell({ children: [new Paragraph(`Motivo: ${input.motivo.replace(/_/g, ' ').toUpperCase()}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Salario Mensual: Gs. ${input.salarioMensual.toLocaleString('es-PY')}`)] }),
                  new TableCell({ children: [new Paragraph(`Salario Diario: Gs. ${Math.round(input.salarioMensual / 30).toLocaleString('es-PY')}`)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(`Régimen: ${input.regimen === 'factura' ? 'Facturación Mensual (Art. 19 C.T.)' : 'General en Planilla (IPS)'}`)] }),
                  new TableCell({ children: [new Paragraph(`Haber Imponible IPS: Gs. ${(result.baseImponibleIPS ?? 0).toLocaleString('es-PY')}`)] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 120 } }),

          // ── DETALLE DE CONCEPTOS ──
          new Paragraph({
            children: [
              new TextRun({ text: '2 - DETALLE DE INGRESOS Y HABERES', bold: true, size: 20, color: '1E5032', font: 'Calibri' }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Concepto', bold: true, font: 'Calibri' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Días / Cant.', bold: true, font: 'Calibri' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total Gs.', bold: true, font: 'Calibri' })] })] }),
                ],
              }),
              ...result.conceptos
                .filter(c => !c.esDescuento && c.id !== 'aguinaldo_proporcional')
                .map(c =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(c.nombre)] }),
                      new TableCell({ children: [new Paragraph(c.dias ? `${c.dias.toFixed(2)} D` : '—')] }),
                      new TableCell({ children: [new Paragraph(`Gs. ${c.monto.toLocaleString('es-PY')}`)] }),
                    ],
                  }),
                ),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL INGRESOS', bold: true, font: 'Calibri' })] })] }),
                  new TableCell({ children: [new Paragraph('')] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Gs. ${result.totalBruto.toLocaleString('es-PY')}`, bold: true, font: 'Calibri' })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 120 } }),

          // ── DESCUENTOS ──
          new Paragraph({
            children: [
              new TextRun({ text: '3 - DESCUENTOS', bold: true, size: 20, color: '822828', font: 'Calibri' }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Concepto', bold: true, font: 'Calibri' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total Gs.', bold: true, font: 'Calibri' })] })] }),
                ],
              }),
              ...result.conceptos
                .filter(c => c.esDescuento)
                .map(c =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(c.nombre)] }),
                      new TableCell({ children: [new Paragraph(`Gs. ${c.monto.toLocaleString('es-PY')}`)] }),
                    ],
                  }),
                ),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL DESCUENTOS', bold: true, font: 'Calibri' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Gs. ${result.totalDescuentos.toLocaleString('es-PY')}`, bold: true, font: 'Calibri' })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 120 } }),

          // ── AGUINALDO PROPORCIONAL ──
          new Paragraph({
            children: [
              new TextRun({ text: 'AGUINALDO PROPORCIONAL (Exento de IPS — Art. 76 Dec.-Ley 1860/50): ', bold: true, font: 'Calibri' }),
              new TextRun({ text: `Gs. ${result.aguinaldoProporcional.toLocaleString('es-PY')}`, bold: true, color: '1E5032', font: 'Calibri' }),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 80 } }),

          // ── NETO A PERCIBIR ──
          new Paragraph({
            children: [
              new TextRun({ text: '4 - NETO A PERCIBIR: ', bold: true, size: 24, color: '1E5032', font: 'Calibri' }),
              new TextRun({ text: `Gs. ${result.totalNetoEstimado.toLocaleString('es-PY')}`, bold: true, size: 24, color: '1E5032', font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: `Son: ${result.montoEnLetras}`, bold: true, italics: true, font: 'Calibri' }),
            ],
          }),

          // ── NOTAS LEGALES DESTACADAS (Primacía, Aguinaldo Impago, Fuero Maternal) ──
          ...notasLegalesElementos,

          new Paragraph({ text: '', spacing: { after: 120 } }),

          // ── CONSTANCIA DE FINIQUITO ──
          new Paragraph({
            children: [
              new TextRun({ text: '5 - CONSTANCIA DE RECEPCIÓN Y FINIQUITO', bold: true, size: 20, color: '1E5032', font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, after: 160 },
            children: [
              new TextRun({
                text:
                  `Recibí de la empresa ${empresa || 'la parte empleadora'} el importe total de la liquidación que antecede, ` +
                  `por los conceptos detallados precedentemente, en estricto cumplimiento del Código del Trabajo (Ley N.º 213/93), el Decreto-Ley N.º 1860/50 ` +
                  `y las disposiciones legales vigentes en la República del Paraguay. Las partes suscriben de conformidad en duplicado de un mismo tenor y a un solo efecto en la fecha indicada.`,
                italics: true,
                size: 18,
                color: '444444',
                font: 'Calibri',
              }),
            ],
          }),

          // ── DUPLICADO DE FIRMAS ──
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '____________________________________', color: '888888' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'TRABAJADOR / EMPLEADO', bold: true, size: 18, font: 'Calibri' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: `Aclaración: ${input.nombreEmpleado || '........................'}`, size: 16, font: 'Calibri' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: `C.I. Nº: ${input.ciEmpleado || '........................'}`, size: 16, font: 'Calibri' })],
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '____________________________________', color: '888888' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'EMPLEADOR / REPRESENTANTE', bold: true, size: 18, font: 'Calibri' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: `Aclaración: ${empresa || '........................'}`, size: 16, font: 'Calibri' })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: `Fecha: ${input.fechaEgreso}`, size: 16, font: 'Calibri' })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 180 } }),

          // ── BLOQUE DE DECLARACIÓN ESTIMATIVA Y DISCLAIMER (LABORAPY) ──
          crearCalloutBoxDocx({
            titulo: '📋 VALIDEZ Y EFECTOS JURÍDICOS DE ESTA LIQUIDACIÓN',
            colorTitulo: '1E5032',
            colorFondo: 'F4FBF7',
            colorBorde: '86EFAC',
            cuerpo:
              `La presente liquidación ha sido calculada conforme a las disposiciones vigentes del Código del Trabajo de la República del Paraguay (Ley N.º 213/93 y sus modificaciones). ` +
              `Tiene carácter de estimación técnica y referencial. La homologación definitiva corresponde a la autoridad administrativa del trabajo (MTESS) o a las partes de común acuerdo. ` +
              `SELLO CRIPTOGRÁFICO DE INTEGRIDAD: [${sealHex}] — LaboraPy v${result.versionReglas} (${input.fechaEgreso}).`,
            colorCuerpo: '374151',
          }),
        ],
      },
    ],
  });
}

export async function descargarLiquidacionDocx(
  input: LiquidacionInput,
  result: LiquidacionResult,
): Promise<void> {
  const doc = generarLiquidacionDocx(input, result);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Liquidacion_${input.nombreEmpleado || 'Colaborador'}.docx`);
}
