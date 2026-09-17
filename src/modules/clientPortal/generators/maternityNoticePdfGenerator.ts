/**
 * GENERADOR DE CONSTANCIA DE MATERNIDAD, LACTANCIA & FUERO LABORAL EN PDF
 * Normativa: Ley N.º 5508/15, Ley N.º 7097/23 y Art. 136 Ley N.º 213/93 (Código del Trabajo)
 * Versión: PY-ERP-MATERNIDAD-2026.09.09
 */

import jsPDF from 'jspdf';
import type { EmpresaCliente, Empleado, RegistroMaternidad } from '../types/clientPortal';

export interface GenerarConstanciaMaternidadParams {
  empresa: EmpresaCliente;
  empleado: Empleado;
  registro: RegistroMaternidad;
  lugarFecha?: string;
}

export function generarConstanciaMaternidadPDF(params: GenerarConstanciaMaternidadParams): jsPDF {
  const { empresa, empleado, registro, lugarFecha } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ── 1. Encabezado Institucional ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 18, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(empresa.razonSocial.toUpperCase(), margin + 5, y + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `RUC: ${empresa.ruc}-${empresa.dv} · Patronal IPS: ${empresa.nroPatronalIps || 'S/N'} · Patronal MTESS: ${empresa.nroPatronalMtess || 'S/N'}`,
    margin + 5,
    y + 13
  );

  y += 26;

  // ── 2. Título Oficial del Documento ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    'CONSTANCIA OFICIAL DE REGISTRO DE MATERNIDAD, USUFRUCTO DE REPOSO,',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 5;
  doc.text(
    'HORARIO DE LACTANCIA (90 MINUTOS) Y FUERO LABORAL REFORZADO',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Conforme a la Ley N.º 5508/15, Ley N.º 7097/23 y Art. 136 del Código del Trabajo de la República del Paraguay',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 8;

  // Fecha y Lugar
  const fechaTexto = lugarFecha || `Asunción, ${new Date().toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(fechaTexto, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // ── 3. Datos de la Trabajadora ──
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('I. DATOS DE LA TRABAJADORA BENEFICIARIA', margin + 4, y + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Colaboradora: ${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`, margin + 4, y + 12);
  doc.text(`Cédula de Identidad: C.I. N.º ${empleado.ci}`, margin + 4, y + 17);
  doc.text(`Cargo / Departamento: ${empleado.cargo} (${empleado.departamento})`, margin + 4, y + 22);

  doc.text(`N.º Asegurado IPS: ${empleado.nroIps || 'Pendiente'}`, margin + 95, y + 12);
  doc.text(`Fecha de Ingreso: ${empleado.fechaIngreso}`, margin + 95, y + 17);
  doc.text(`Salario Base: Gs. ${Math.round(empleado.salarioBase).toLocaleString('es-PY')}`, margin + 95, y + 22);

  y += 29;

  // ── 4. Sección Maternidad y Reposo 18 Semanas (126 Días) ──
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('II. NOTIFICACIÓN DE GRAVIDEZ Y REPOSO DE MATERNIDAD (18 SEMANAS / 126 DÍAS)', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const linesMaternidad = doc.splitTextToSize(
    `La trabajadora notificó oportunamente su estado de gravidez en fecha ${registro.fechaNotificacionEmbarazo}, ` +
    `adjuntando certificado médico. Conforme al Art. 13 de la Ley N.º 5508/15 modificado por la Ley N.º 7097/23, ` +
    `se establece el reposo ininterrumpido de 18 semanas continuas (126 días corridos), con subsidio cubierto al 100% por el IPS:`,
    contentWidth - 8
  );
  doc.text(linesMaternidad, margin + 4, y + 12);

  const startYBox = y + 22;
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin + 4, startYBox, contentWidth - 8, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`Inicio de Reposo: ${registro.fechaInicioReposo}`, margin + 8, startYBox + 5);
  doc.text(`Fin de Reposo: ${registro.fechaFinReposo}`, margin + 65, startYBox + 5);
  doc.text(`Reincorporación: ${registro.fechaReincorporacionTrabajo}`, margin + 120, startYBox + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`FPP / Parto: ${registro.fechaPartoReal || registro.fechaProbablePartoFPP} · Total: 126 días corridos (18 semanas) · Trámite IPS: ${registro.subsidioIpsEstado.toUpperCase()}`, margin + 8, startYBox + 9.5);

  y += 43;

  // ── 5. Sección Horario de Lactancia de 90 Minutos ──
  doc.roundedRect(margin, y, contentWidth, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('III. HORARIO DE LACTANCIA MATERNA DE 90 MINUTOS REMUNERADOS (ART. 14 LEY 5508/15)', margin + 4, y + 6);

  const textoModalidad = {
    dos_pausas_45min: 'Dos (2) descansos diarios fraccionados de cuarenta y cinco (45) minutos cada uno durante la jornada.',
    salida_temprana_90min: 'Retiro anticipado noventa (90) minutos antes del término habitual de la jornada laboral.',
    entrada_tardia_90min: 'Ingreso noventa (90) minutos posterior al inicio reglamentario de la jornada laboral.',
    continuo_intermedio_90min: 'Un descanso continuado de noventa (90) minutos dentro de la jornada laboral ordinaria.',
  }[registro.modalidadLactancia] || 'Descanso remunerado de 90 minutos diarios.';

  const linesLactancia = doc.splitTextToSize(
    `A partir de su efectiva reincorporación, la colaboradora gozará de 90 minutos diarios remunerados computados ` +
    `como tiempo de trabajo efectivo. La modalidad formalmente convenida entre las partes es:`,
    contentWidth - 8
  );
  doc.text(linesLactancia, margin + 4, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 116, 144); // cyan-700
  doc.text(`• Modalidad acordada: ${textoModalidad}`, margin + 6, y + 21);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`• Etapa 1 (Obligatoria sin condicionamientos): Hasta los 6 meses de vida (${registro.fechaFinLactanciaObligatoria}).`, margin + 6, y + 26);
  doc.text(`• Etapa 2 (Extensión hasta los 24 meses / 2 años): Límite legal máximo fijado el ${registro.fechaLimiteMaximoLactancia24Meses}.`, margin + 6, y + 31);

  y += 41;

  // ── 6. Prórrogas Trimestrales de Lactancia (Ley 7097/23) ──
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('IV. REQUISITO DE RENOVACIÓN TRIMESTRAL DE LACTANCIA (CADA 3 MESES - LEY 7097/23)', margin + 4, y + 6);

  const linesTrimestral = doc.splitTextToSize(
    `Para mantener el derecho al usufructo del horario de 90 minutos diarios más allá de los primeros 6 meses, ` +
    `la trabajadora deberá presentar al empleador cada tres (3) meses un Certificado Médico Pediátrico que ` +
    `acredite la continuidad de la lactancia materna, de conformidad con la Ley N.º 7097/23:`,
    contentWidth - 8
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(linesTrimestral, margin + 4, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(
    `Próximo vencimiento de constancia médica: ${registro.proximoVencimientoCertificado || registro.fechaFinLactanciaObligatoria}`,
    margin + 6,
    y + 22
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Vencimientos trimestrales legales: Mes 9 · Mes 12 · Mes 15 · Mes 18 · Mes 21 · Mes 24 (Culminación legal definitiva).',
    margin + 6,
    y + 28
  );

  y += 39;

  // ── 7. Fuero Maternal e Inamovilidad Laboral (Art. 136 Código Laboral) ──
  doc.setFillColor(254, 242, 242); // red-50
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(153, 27, 27); // red-800
  doc.text('V. FUERO MATERNAL Y PROTECCIÓN CONTRA EL DESPIDO (ART. 136 CÓDIGO DEL TRABAJO)', margin + 4, y + 5.5);

  const linesFuero = doc.splitTextToSize(
    'La trabajadora goza de INAMOVILIDAD LABORAL ABSOLUTA desde la fecha de notificación de su gravidez, ' +
    'durante todo el embarazo, el reposo de 18 semanas y hasta que concluya el período de lactancia materna acreditado. ' +
    'Cualquier despido o modificación de condiciones sin previa autorización judicial fundada es NULO de pleno derecho.',
    contentWidth - 8
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(127, 29, 29);
  doc.text(linesFuero, margin + 4, y + 10.5);

  y += 28;

  // ── 8. Sección de Firmas ──
  const firmaY = Math.min(y + 6, pageHeight - 35);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);

  // Firma Trabajadora
  doc.line(margin + 10, firmaY, margin + 65, firmaY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${empleado.nombres} ${empleado.apellidos}`, margin + 37.5, firmaY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`C.I. N.º ${empleado.ci}`, margin + 37.5, firmaY + 8, { align: 'center' });
  doc.text('Trabajadora Beneficiaria', margin + 37.5, firmaY + 12, { align: 'center' });

  // Firma Empleador
  doc.line(pageWidth - margin - 65, firmaY, pageWidth - margin - 10, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empresa.representanteLegalNombre || 'Dirección de Recursos Humanos', pageWidth - margin - 37.5, firmaY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`C.I. N.º ${empresa.representanteLegalCi || empresa.ruc}`, pageWidth - margin - 37.5, firmaY + 8, { align: 'center' });
  doc.text(`${empresa.razonSocial}`, pageWidth - margin - 37.5, firmaY + 12, { align: 'center' });

  return doc;
}
