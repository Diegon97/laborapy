/**
 * GENERADOR DE RECIBOS DE SALARIO EN PDF (PARAGUAY)
 * Cumplimiento estricto con Art. 235 y 236 del Código del Trabajo (Ley N.º 213/93)
 * Emisión en duplicado (Original Trabajador / Duplicado Empleador)
 * Soporte para descarga individual y masiva
 */

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { ReciboSalario, Empleado, EmpresaCliente } from '../types/clientPortal';
import { formatPYG, obtenerNombreMes } from '../services/clientStorageService';

export async function generarReciboSalarioPDF(
  recibo: ReciboSalario,
  empleado: Empleado,
  empresa: EmpresaCliente
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await renderReciboEnPagina(doc, recibo, empleado, empresa);
  return doc;
}

export async function generarRecibosSalarioMasivoPDF(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const empMap = new Map<string, Empleado>();
  empleados.forEach(e => empMap.set(e.id, e));

  for (let i = 0; i < recibos.length; i++) {
    if (i > 0) {
      doc.addPage();
    }
    const r = recibos[i];
    const emp = empMap.get(r.empleadoId);
    if (emp) {
      await renderReciboEnPagina(doc, r, emp, empresa);
    }
  }

  return doc;
}

/**
 * Renderiza la mitad superior (Original) y la mitad inferior (Duplicado) en la misma página A4
 */
async function renderReciboEnPagina(
  doc: jsPDF,
  recibo: ReciboSalario,
  empleado: Empleado,
  empresa: EmpresaCliente
): Promise<void> {
  // Generar QR en base64
  let qrDataUrl = '';
  try {
    const qrText = `RECIBO-PY|EMPRESA:${empresa.ruc}-${empresa.dv}|CI:${empleado.ci}|PERIODO:${recibo.anho}-${String(recibo.mes).padStart(2, '0')}|NETO:${recibo.salarioNeto}|HASH:${recibo.id}`;
    qrDataUrl = await QRCode.toDataURL(qrText, { width: 100, margin: 1 });
  } catch {
    // Si falla QR, continúa sin bloquear
  }

  // Mitad 1: ORIGINAL (PARA EL TRABAJADOR)
  renderSeccionRecibo(doc, recibo, empleado, empresa, 12, 'ORIGINAL: PARA EL TRABAJADOR', qrDataUrl);

  // Línea de corte divisoria
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(180, 190, 205);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(10, 148, pageWidth - 10, 148);
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 145);
  doc.text('✂ - - - - - - - - - - - - - - - - - LÍNEA DE CORTE - - - - - - - - - - - - - - - - - ✂', pageWidth / 2, 147.2, { align: 'center' });
  doc.setLineDashPattern([], 0); // Restaurar línea sólida

  // Mitad 2: DUPLICADO (PARA EL EMPLEADOR)
  renderSeccionRecibo(doc, recibo, empleado, empresa, 154, 'DUPLICADO: PARA EL EMPLEADOR (COPIA FIRMADA)', qrDataUrl);
}

function renderSeccionRecibo(
  doc: jsPDF,
  recibo: ReciboSalario,
  empleado: Empleado,
  empresa: EmpresaCliente,
  startY: number,
  subtituloCopia: string,
  qrDataUrl: string
): void {
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - margin * 2;
  let y = startY;

  // 1. Marco exterior
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, width, 130, 2, 2);

  // 2. Encabezado de la empresa
  doc.setFillColor(245, 248, 252);
  doc.rect(margin, y, width, 18, 'F');
  doc.line(margin, y + 18, margin + width, y + 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empresa.razonSocial, margin + 4, y + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`RUC: ${empresa.ruc}-${empresa.dv} · Patronal IPS: ${empresa.nroPatronalIps || 'N/D'} · MTESS: ${empresa.nroPatronalMtess || 'N/D'}`, margin + 4, y + 11);
  doc.text(empresa.direccion, margin + 4, y + 15);

  // Caja Periodo & Tipo Copia (a la derecha)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 80, 50);
  doc.text(`RECIBO DE SALARIO`, margin + width - 4, y + 6, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Período: ${obtenerNombreMes(recibo.mes).toUpperCase()} / ${recibo.anho}`, margin + width - 4, y + 11, { align: 'right' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(subtituloCopia, margin + width - 4, y + 15, { align: 'right' });

  y += 20;

  // 3. Datos del Empleado (Fila de 2 columnas)
  doc.setFillColor(250, 252, 255);
  doc.rect(margin + 2, y, width - 4, 14, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin + 2, y, width - 4, 14);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Empleado:`, margin + 4, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`, margin + 22, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`C.I. N.º:`, margin + 4, y + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(empleado.ci, margin + 22, y + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Cargo:`, margin + 70, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(empleado.cargo, margin + 82, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`F. Ingreso:`, margin + 70, y + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(empleado.fechaIngreso, margin + 86, y + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Días Liq.:`, margin + width - 35, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${recibo.diasTrabajados} días`, margin + width - 18, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Sal. Base:`, margin + width - 35, y + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPYG(recibo.salarioBase), margin + width - 18, y + 9.5);

  y += 16;

  // 4. Tabla de Ingresos y Deducciones (2 columnas lado a lado)
  const colW = (width - 4) / 2;
  const col1X = margin + 2;
  const col2X = margin + 2 + colW;

  // Encabezado de columnas
  doc.setFillColor(235, 242, 250);
  doc.rect(col1X, y, colW, 6, 'F');
  doc.rect(col2X, y, colW, 6, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(col1X, y, colW, 6);
  doc.rect(col2X, y, colW, 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('INGRESOS DEVENGADOS (+)', col1X + 3, y + 4.2);
  doc.text('IMPORTE', col1X + colW - 3, y + 4.2, { align: 'right' });

  doc.text('DEDUCCIONES & RETENCIONES (-)', col2X + 3, y + 4.2);
  doc.text('IMPORTE', col2X + colW - 3, y + 4.2, { align: 'right' });

  y += 7;

  // Filas de conceptos
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Renglón 1: Salario Ordinario vs Retención IPS 9%
  doc.text(`Salario Devengado (${recibo.diasTrabajados} días)`, col1X + 3, y + 3.5);
  doc.text(formatPYG(recibo.salarioDevengado), col1X + colW - 3, y + 3.5, { align: 'right' });

  doc.text('Aporte Obrero IPS (9% obligatorio)', col2X + 3, y + 3.5);
  doc.text(formatPYG(recibo.ipsObrero9), col2X + colW - 3, y + 3.5, { align: 'right' });
  y += 5;

  // Renglón 2: Horas Extras 50% vs Anticipos
  doc.text(
    recibo.horasExtras50Cant > 0 ? `Horas Extras 50% (${recibo.horasExtras50Cant} hs)` : 'Horas Extras 50%',
    col1X + 3,
    y + 3.5
  );
  doc.text(recibo.horasExtras50Monto > 0 ? formatPYG(recibo.horasExtras50Monto) : '-', col1X + colW - 3, y + 3.5, { align: 'right' });

  doc.text('Anticipos de Salario / Vales', col2X + 3, y + 3.5);
  doc.text(recibo.anticiposQuincena > 0 ? formatPYG(recibo.anticiposQuincena) : '-', col2X + colW - 3, y + 3.5, { align: 'right' });
  y += 5;

  // Renglón 3: Horas Extras 100% vs Descuento Judicial
  doc.text(
    recibo.horasExtras100Cant > 0 ? `Horas Extras 100% (${recibo.horasExtras100Cant} hs)` : 'Horas Extras 100%',
    col1X + 3,
    y + 3.5
  );
  doc.text(recibo.horasExtras100Monto > 0 ? formatPYG(recibo.horasExtras100Monto) : '-', col1X + colW - 3, y + 3.5, { align: 'right' });

  doc.text('Retención Judicial / Alimentos', col2X + 3, y + 3.5);
  doc.text(recibo.judicialesAlimentos > 0 ? formatPYG(recibo.judicialesAlimentos) : '-', col2X + colW - 3, y + 3.5, { align: 'right' });
  y += 5;

  // Renglón 4: Bonificación Familiar (Art. 261) vs Otros Descuentos
  doc.text(
    empleado.hijosMenores > 0 ? `Bonificación Familiar (${empleado.hijosMenores} hijos - Art. 261)` : 'Bonificación Familiar (5% SML)',
    col1X + 3,
    y + 3.5
  );
  doc.text(recibo.bonificacionFamiliar > 0 ? formatPYG(recibo.bonificacionFamiliar) : '-', col1X + colW - 3, y + 3.5, { align: 'right' });

  doc.text('Otros Descuentos Autorizados', col2X + 3, y + 3.5);
  doc.text(recibo.otrosDescuentos > 0 ? formatPYG(recibo.otrosDescuentos) : '-', col2X + colW - 3, y + 3.5, { align: 'right' });
  y += 5;

  // Renglón 5: Comisiones / Premios
  doc.text('Comisiones / Premios / Plus', col1X + 3, y + 3.5);
  doc.text(recibo.comisionesPremios > 0 ? formatPYG(recibo.comisionesPremios) : '-', col1X + colW - 3, y + 3.5, { align: 'right' });

  doc.text('-', col2X + 3, y + 3.5);
  doc.text('-', col2X + colW - 3, y + 3.5, { align: 'right' });
  y += 6;

  // Totales de columnas
  doc.setDrawColor(203, 213, 225);
  doc.line(col1X, y, col1X + colW, y);
  doc.line(col2X, y, col2X + colW, y);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL HABERES:', col1X + 3, y + 4);
  doc.text(formatPYG(recibo.totalIngresosBrutos), col1X + colW - 3, y + 4, { align: 'right' });

  doc.text('TOTAL DEDUCCIONES:', col2X + 3, y + 4);
  doc.text(formatPYG(recibo.totalDeducciones), col2X + colW - 3, y + 4, { align: 'right' });

  y += 7;

  // 5. CAJA DE LÍQUIDO A COBRAR (NETO)
  doc.setFillColor(240, 253, 244); // Verde claro
  doc.rect(margin + 2, y, width - 4, 11, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(margin + 2, y, width - 4, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('LÍQUIDO A PERCIBIR (NETO):', margin + 5, y + 5);
  doc.setFontSize(10);
  doc.text(formatPYG(recibo.salarioNeto), margin + width - 6, y + 5.5, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(`Son: ${recibo.salarioNetoLetras}`, margin + 5, y + 9.2);

  y += 13;

  // 6. Pie con QR y Firmas (Conforme a Ley 213/93 Arts. 235-236)
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', margin + 3, y + 1, 14, 14);
  }

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Constancia de pago según Ley N.º 213/93 Art. 235 y 236.', margin + 19, y + 4);
  doc.text('Aporte Obrero 9% deducido y transferido al Instituto de Previsión Social.', margin + 19, y + 8);
  doc.text(`Fecha de Pago: ${recibo.fechaEmision} · Asunción, Paraguay`, margin + 19, y + 12);

  // Líneas de firma
  const firma1X = margin + width - 85;
  const firma2X = margin + width - 38;

  doc.setDrawColor(100, 116, 139);
  doc.line(firma1X, y + 10, firma1X + 35, y + 10);
  doc.line(firma2X, y + 10, firma2X + 35, y + 10);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Firma Empleador / Responsable', firma1X + 17.5, y + 13, { align: 'center' });
  doc.text('Firma del Trabajador (Copia)', firma2X + 17.5, y + 13, { align: 'center' });
}
