/**
 * GENERADOR DE NOTA FORMAL DE CONCESIÓN Y RECIBO DE VACACIONES EN PDF (PARAGUAY)
 * Cumplimiento estricto con los Artículos 218, 222, 224 y 225 del Código del Trabajo (Ley N.º 213/93)
 * Incluye:
 * 1. Membrete institucional y diseño corporativo de alta legibilidad (One-Page Fit).
 * 2. Notificación formal de concesión con preaviso legal de 15 días (Art. 222 C.T.).
 * 3. Cronograma de usufructo y fecha de reincorporación efectiva.
 * 4. Liquidación y recibo de pago anticipado de vacaciones (Art. 225 C.T.) con retención legal IPS 9%.
 * 5. Doble bloque de firmas de conformidad (Patronal RRHH y Trabajador).
 * 6. Sello criptográfico digital y Código QR vectorial escaneable para validación de documentos.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RegistroVacacion, Empleado, EmpresaCliente } from '../types/clientPortal';
import { renderVectorQRCode, computeDocumentSealHex } from '../../payroll/generators/settlementPdfGenerator';
import { numeroALetrasGuaranies } from '../../payroll/utils/numberToWordsPY';
import { LABORAPY_CONFIG } from '../../../config/laborapy';

// ==============================================================
// CONSTANTES LEGALES PARAGUAY
// ==============================================================
export const SALARIO_MINIMO_LEGAL_VIGENTE = 3_044_000; // ₲/mes vigente hasta Junio 2027
export const APORTE_IPS_OBRERO = 0.09; // 9% aporte trabajador al IPS (Ley N.º 98/92 y modif.)
export const DIAS_MES_COMERCIAL = 30; // Base de cálculo según Código del Trabajo
export const DIAS_VACACIONES_DEFAULT = 12;

// ==============================================================
// FORMATEADORES Y UTILIDADES
// ==============================================================

/**
 * Formato compatible para cadenas en pantalla o tests que requieran el glifo '₲'.
 */
export function formatGuaranies(monto: number): string {
  if (!Number.isFinite(monto)) return '₲ 0';
  const redondeado = Math.round(monto);
  const signo = redondeado < 0 ? '-' : '';
  const abs = Math.abs(redondeado);
  const conSeparadores = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}₲ ${conSeparadores}`;
}

/**
 * Formato seguro para jsPDF (Helvetica / WinAnsi).
 * El símbolo '₲' (U+20B2) no existe en WinAnsi y provoca que jsPDF rompa el kerning y dibuje un '2' flotante.
 * 'Gs. ' garantiza renderizado tipográfico impecable sin descuadres.
 */
export function formatGs(monto: number): string {
  if (!Number.isFinite(monto)) return 'Gs. 0';
  const redondeado = Math.round(monto);
  const signo = redondeado < 0 ? '-' : '';
  const abs = Math.abs(redondeado);
  const conSeparadores = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}Gs. ${conSeparadores}`;
}

export function formatFechaDDMMYYYY(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const soloFecha = isoDate.slice(0, 10);
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return isoDate;
  const [y, m, d] = partes;
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function formatearFechaTexto(fechaStr: string): string {
  if (!fechaStr || fechaStr.includes('definir') || fechaStr.includes('hábil') || fechaStr === '—') return fechaStr;
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  try {
    const partes = fechaStr.slice(0, 10).split('-');
    if (partes.length === 3) {
      const dia = parseInt(partes[2], 10);
      const mesIdx = parseInt(partes[1], 10) - 1;
      const anho = partes[0];
      if (!isNaN(dia) && mesIdx >= 0 && mesIdx < 12) {
        return `${dia} de ${meses[mesIdx]} de ${anho}`;
      }
    }
    return fechaStr;
  } catch {
    return fechaStr;
  }
}

export function sumarDiasISO(fechaISO: string, dias: number): string {
  try {
    const partes = fechaISO.slice(0, 10).split('-').map(Number);
    if (partes.length !== 3 || partes.some(p => !Number.isFinite(p))) return fechaISO;
    const [y, m, d] = partes;
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + dias);
    const yy = base.getUTCFullYear();
    const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(base.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  } catch {
    return fechaISO;
  }
}

// ==============================================================
// LIQUIDACIÓN ECONÓMICA DE VACACIONES (Art. 225 C.T.)
// ==============================================================
export interface LiquidacionVacaciones {
  salarioMensual: number;
  salarioDiarioExacto: number;
  salarioDiario: number;
  importeBruto: number;
  aporteIps: number;
  netoPercibir: number;
  diasUsufructuados: number;
}

export function calcularLiquidacionVacaciones(
  salarioBaseMensual: number,
  diasUsufructuados: number
): LiquidacionVacaciones {
  const salarioMensual = Number.isFinite(salarioBaseMensual) && salarioBaseMensual > 0
    ? salarioBaseMensual
    : SALARIO_MINIMO_LEGAL_VIGENTE;

  const dias = Number.isFinite(diasUsufructuados) && diasUsufructuados > 0
    ? Math.floor(diasUsufructuados)
    : DIAS_VACACIONES_DEFAULT;

  const salarioDiarioExacto = salarioMensual / DIAS_MES_COMERCIAL;
  const importeBruto = Math.round(salarioDiarioExacto * dias);
  const aporteIps = Math.round(importeBruto * APORTE_IPS_OBRERO);
  const netoPercibir = importeBruto - aporteIps;

  return {
    salarioMensual,
    salarioDiarioExacto,
    salarioDiario: Math.round(salarioDiarioExacto),
    importeBruto,
    aporteIps,
    netoPercibir,
    diasUsufructuados: dias,
  };
}

// ==============================================================
// GENERACIÓN DE DOCUMENTO PDF OFICIAL
// ==============================================================
export function generarNotaConcesionVacacionesPDF(
  vacacion: RegistroVacacion,
  empleado: Empleado,
  empresa: EmpresaCliente
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let y = 10;

  const diasGozados = vacacion.diasUsufructuadosReal || vacacion.diasCorrespondientes || 12;
  const fechaInicio = vacacion.fechaInicioReal || 'A definir';
  const fechaFin = vacacion.fechaFinReal || (vacacion.fechaInicioReal ? sumarDiasISO(vacacion.fechaInicioReal, diasGozados - 1) : 'A definir');
  const fechaRetorno = vacacion.fechaFinReal ? sumarDiasISO(vacacion.fechaFinReal, 1) : 'Día hábil siguiente';
  const fechaNotif = vacacion.fechaInicioReal
    ? sumarDiasISO(vacacion.fechaInicioReal, -16)
    : new Date().toISOString().split('T')[0];

  const liq = calcularLiquidacionVacaciones(empleado.salarioBase, diasGozados);

  // 1. Banda superior institucional oficial LaboraPy / Corporativa
  doc.setFillColor(15, 81, 50); // Verde institucional #0F5132
  doc.rect(margin, y, contentWidth, 2, 'F');
  y += 5;

  // 2. Membrete de la Empresa
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text((empresa.razonSocial || 'EMPRESA').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const datosRegistro = [
    `RUC: ${empresa.ruc}-${empresa.dv}`,
    `Patronal IPS: ${empresa.nroPatronalIps || 'Registrado'}`,
    `Patronal MTESS: ${empresa.nroPatronalMtess || 'Inscripto'}`,
  ].join('  ·  ');
  doc.text(datosRegistro, pageWidth / 2, y, { align: 'center' });
  y += 3.8;

  doc.text(empresa.direccion || 'Asunción, República del Paraguay', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  // 3. Título Oficial
  const esAdelantada = vacacion.esAdelantada === true;
  doc.setFontSize(esAdelantada ? 10.5 : 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const titulo = esAdelantada
    ? 'NOTIFICACIÓN Y RECIBO DE VACACIONES ADELANTADAS (CON AUTORIZACIÓN PATRONAL)'
    : 'NOTIFICACIÓN DE CONCESIÓN Y RECIBO DE VACACIONES ANUALES REMUNERADAS';
  doc.text(titulo, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  const subtitulo = esAdelantada
    ? '(Anticipo Autorizado por el Empleador - Imputable al Período Causado · Ley N.º 213/93)'
    : '(Arts. 218, 222, 224 y 225 del Código del Trabajo - Ley N.º 213/93 de Paraguay)';
  doc.text(subtitulo, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // 4. Lugar y Fecha de Emisión
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Asunción, ${formatearFechaTexto(fechaNotif)}`, margin, y);
  y += 3.5;

  // 5. SECCIÓN 1: DATOS DEL TRABAJADOR / BENEFICIARIO (AutoTable con columnas calculadas)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text('1 - DATOS DEL TRABAJADOR / BENEFICIARIO', margin, y);
  y += 2;

  const colKeyW = 34;
  const colValW = (contentWidth - colKeyW * 2) / 2; // (182 - 68) / 2 = 57 mm

  const datosEmpleadoTabla = [
    [
      { content: 'Colaborador:', fontStyle: 'bold' },
      { content: `${empleado.nombres} ${empleado.apellidos}` },
      { content: 'C.I. N.º:', fontStyle: 'bold' },
      { content: `${empleado.ci} (IPS: ${empleado.nroIps || empleado.ci})` },
    ],
    [
      { content: 'Cargo / Función:', fontStyle: 'bold' },
      { content: empleado.cargo || 'General' },
      { content: 'Departamento / Área:', fontStyle: 'bold' },
      { content: empleado.departamento || 'Operaciones' },
    ],
    [
      { content: 'Fecha de Ingreso:', fontStyle: 'bold' },
      { content: formatFechaDDMMYYYY(empleado.fechaIngreso) },
      { content: 'Antigüedad:', fontStyle: 'bold' },
      { content: `Ingreso ${formatFechaDDMMYYYY(empleado.fechaIngreso)}` },
    ],
    [
      { content: 'Salario Base Mensual:', fontStyle: 'bold' },
      { content: `${formatGs(liq.salarioMensual)} mensual` },
      { content: 'Jornal Diario Base:', fontStyle: 'bold' },
      { content: `${formatGs(liq.salarioDiario)} / día` },
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: datosEmpleadoTabla as any,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: colKeyW, fillColor: [248, 250, 252], textColor: [15, 81, 50] },
      1: { cellWidth: colValW },
      2: { cellWidth: colKeyW, fillColor: [248, 250, 252], textColor: [15, 81, 50] },
      3: { cellWidth: colValW },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 3.5;

  // 6. SECCIÓN 2: CRONOGRAMA DE USUFRUCTO (AutoTable)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text('2 - CRONOGRAMA DE USUFRUCTO (DESCANSO ANUAL REMUNERADO)', margin, y);
  y += 2;

  const diasLabel = esAdelantada
    ? `${diasGozados} días corridos (Anticipo autorizado por la patronal)`
    : `${diasGozados} días corridos (Total causados: ${vacacion.diasCorrespondientes} días)`;

  const cronogramaTabla = [
    [
      `Año ${vacacion.periodoAnho}${esAdelantada ? ' (Anticipo)' : ''}`,
      diasLabel,
      `Del ${formatearFechaTexto(fechaInicio)} al ${formatearFechaTexto(fechaFin)}`,
      `${formatearFechaTexto(fechaRetorno)} (Día hábil siguiente)`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Período Causado', 'Días Otorgados', 'Período de Usufructo', 'Reincorporación Efectiva']],
    body: cronogramaTabla,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [40, 90, 60],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 46, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 54, halign: 'center' },
      3: { cellWidth: 50, halign: 'center', fontStyle: 'bold', textColor: [2, 132, 199] },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 3.5;

  // 7. SECCIÓN 3: LIQUIDACIÓN ECONÓMICA DE VACACIONES (Art. 225 C.T.)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text('3 - LIQUIDACIÓN Y RECIBO DE PAGO ANTICIPADO DE VACACIONES (Art. 225 Código del Trabajo)', margin, y);
  y += 2;

  const montoEnLetras = numeroALetrasGuaranies(liq.netoPercibir);

  const filasLiquidacion = [
    [
      `Remuneración Bruta de Vacaciones (${liq.diasUsufructuados} días x Jornal ${formatGs(liq.salarioDiario)}):`,
      'Base de cálculo según Art. 224 C.T.',
      formatGs(liq.importeBruto),
    ],
    [
      'Retención Legal Obligatoria Aporte Obrero IPS (9% s/ Bruto):',
      'Descuento Seguro Social obligatorio (Ley N.º 98/92)',
      `- ${formatGs(liq.aporteIps)}`,
    ],
    [
      { content: 'IMPORTE NETO PERCIBIDO POR VACACIONES:', styles: { fontStyle: 'bold', textColor: [15, 81, 50] } },
      { content: 'Percibido con anterioridad al inicio (Art. 225 C.T.)', styles: { fontStyle: 'italic', textColor: [70, 90, 80] } },
      { content: formatGs(liq.netoPercibir), styles: { fontStyle: 'bold', textColor: [15, 81, 50], fontSize: 9 } },
    ],
    [
      { content: `Son en letras: ${montoEnLetras}`, colSpan: 3, styles: { fontStyle: 'italic', textColor: [50, 70, 60], fillColor: [244, 250, 246] } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Concepto Liquidado', 'Referencia / Base Legal', 'Total']],
    body: filasLiquidacion as any,
    theme: 'striped',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.3,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 81, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 58 },
      2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 1 && data.column.index === 2) {
        data.cell.styles.textColor = [220, 38, 38]; // Rojo para la retención IPS
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 3.5;

  // 8. SECCIÓN 4: DECLARACIÓN DE CONFORMIDAD Y PREAVISO LEGAL DE 15 DÍAS (Art. 222 C.T.)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const clausulaConforme = esAdelantada
    ? 'El/La trabajador/a y la parte empleadora dejan expresa constancia de que el presente descanso se otorga y recibe en concepto de ' +
      'VACACIONES ADELANTADAS con la debida conformidad y autorización patronal expresa (Arts. 218 y 225 C.T.), a imputarse al período laboral correspondiente una vez cumplida la causación. ' +
      'Asimismo, el trabajador declara haber recibido en legal tiempo y forma la remuneración neta anticipada de vacaciones a su entera satisfacción, ' +
      'comprometiéndose a reincorporarse puntualmente a sus labores en la fecha indicada.'
    : 'El/La trabajador/a abajo firmante declara haber recibido en legal tiempo y forma la notificación formal de concesión del descanso ' +
      'anual remunerado con más de quince (15) días de preaviso de antelación legal (Art. 222 C.T.), así como la suma neta arriba liquidada en concepto de ' +
      'remuneración anticipada de vacaciones (Art. 225 C.T.) a su entera satisfacción, comprometiéndose a reincorporarse puntualmente ' +
      'a sus labores habituales en la fecha indicada. Las vacaciones no son compensables en dinero durante la vigencia del contrato (Art. 226 C.T.).';

  const splitClausula = doc.splitTextToSize(clausulaConforme, contentWidth);
  doc.text(splitClausula, margin, y);
  y += splitClausula.length * 3.2 + 8;

  // 9. SECCIÓN 5: DOBLE BLOQUE DE FIRMAS (Patronal RRHH y Trabajador)
  const firmaWidth = (contentWidth - 16) / 2;
  const xFirma1 = margin;
  const xFirma2 = margin + firmaWidth + 16;
  const yLineaFirma = y + 10;

  // Firma Empleador
  doc.setDrawColor(70, 80, 75);
  doc.setLineWidth(0.4);
  doc.line(xFirma1, yLineaFirma, xFirma1 + firmaWidth, yLineaFirma);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text('POR LA PATRONAL (RRHH)', xFirma1 + firmaWidth / 2, yLineaFirma + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 70, 65);
  doc.text(empresa.representanteLegalNombre || 'Gerencia de Talento Humano', xFirma1 + firmaWidth / 2, yLineaFirma + 7.5, { align: 'center' });
  doc.text(`${empresa.razonSocial} · RUC: ${empresa.ruc}-${empresa.dv}`, xFirma1 + firmaWidth / 2, yLineaFirma + 11, { align: 'center' });

  // Firma Trabajador
  doc.line(xFirma2, yLineaFirma, xFirma2 + firmaWidth, yLineaFirma);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 81, 50);
  doc.text('RECIBÍ CONFORME (TRABAJADOR)', xFirma2 + firmaWidth / 2, yLineaFirma + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 70, 65);
  doc.text(`${empleado.nombres} ${empleado.apellidos}`, xFirma2 + firmaWidth / 2, yLineaFirma + 7.5, { align: 'center' });
  doc.text(`C.I. N.º: ${empleado.ci}`, xFirma2 + firmaWidth / 2, yLineaFirma + 11, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('Fecha de recepción manuscrita: _____ / _____ / 2026', xFirma2 + firmaWidth / 2, yLineaFirma + 14.5, { align: 'center' });

  y = yLineaFirma + 18;

  // 10. SECCIÓN 6: SELLO DIGITAL DE INTEGRIDAD & CÓDIGO QR ESCANEABLE
  const sealHex = computeDocumentSealHex(
    `VACACIONES|${empleado.ci}|${empleado.nombres} ${empleado.apellidos}|${empresa.razonSocial}|${vacacion.periodoAnho}|${diasGozados}|${liq.netoPercibir}|${fechaInicio}|${fechaFin}`
  );

  const blockHeight = 18;
  doc.setFillColor(244, 250, 246);
  doc.setDrawColor(16, 115, 70);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, blockHeight, 1.6, 1.6, 'FD');

  // URL con parámetros de validación
  const baseUrl = 'https://calculadora-rrhh-py.vercel.app';
  const qrParams = new URLSearchParams({
    validar: '1',
    tipo: 'vacaciones',
    sello: sealHex,
    ci: empleado.ci || '',
    nombre: `${empleado.nombres} ${empleado.apellidos}`,
    empresa: empresa.razonSocial || '',
    cargo: empleado.cargo || '',
    inicio: fechaInicio,
    fin: fechaFin,
    retorno: fechaRetorno,
    dias: String(diasGozados),
    periodo: String(vacacion.periodoAnho || ''),
    neto: String(liq.netoPercibir),
    salario: String(liq.salarioMensual),
  });
  const qrValidationUrl = `${baseUrl}/?${qrParams.toString()}`;

  // QR Vectorial a la izquierda
  const qrSize = 14.5;
  const qrX = margin + 2;
  const qrY = y + 1.7;
  renderVectorQRCode(doc, qrValidationUrl, qrX, qrY, qrSize, [0, 0, 0]);

  // Texto explicativo a la derecha del QR
  const textX = qrX + qrSize + 3.5;
  let textY = y + 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 81, 50);
  doc.text('SELLO DIGITAL DE INTEGRIDAD & VALIDACIÓN DE DOCUMENTO (LEY N.º 213/93)', textX, textY);
  textY += 3.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(30, 45, 35);
  doc.text(`Identificador Único Criptográfico: [${sealHex}] · Registro LaboraPy Oficial`, textX, textY);
  textY += 2.8;

  doc.setFontSize(5.8);
  doc.setTextColor(70, 85, 75);
  doc.text('Escanee el código QR con cualquier smartphone o haga clic sobre él para auditar la autenticidad e integridad en línea.', textX, textY);
  textY += 2.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(15, 81, 50);
  doc.textWithLink('Verificar online: calculadora-rrhh-py.vercel.app', textX, textY, { url: qrValidationUrl });
  textY += 2.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.3);
  doc.setTextColor(80, 95, 85);
  doc.text(`LaboraPy ERP · Asistencia Oficial RRHH & Consultas: ${LABORAPY_CONFIG.whatsAppDisplay}`, textX, textY);

  // 11. Pie de página institucional oficial
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento oficial generado por LaboraPy ERP · Válido para fiscalización laboral MTESS y auditoría IPS · Ref: VAC-${empleado.ci}-${vacacion.periodoAnho} · Página 1 de 1`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  return doc;
}
