/**
 * GENERADOR OFICIAL DE TELEGRAMAS COLACIONADOS (COPACO / CORREO PARAGUAYO)
 * Base Legal: Código del Trabajo de Paraguay (Ley N.º 213/93)
 * Art. 81 inc. a) (Inasistencias injustificadas reiteradas)
 * Art. 81 inc. j) (Abandono de trabajo por más de 3 días consecutivos o 4 alternados en el mes)
 */

import jsPDF from 'jspdf';

export interface TelegramConfig {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  cityAndDate: string; // ej: "Asunción, 10 de setiembre de 2026"
  recipientName: string; // ej: "JUAN CARLOS BOGADO"
  recipientDoc: string; // ej: "3.456.789"
  recipientAddress: string; // ej: "AVDA. EUSEBIO AYALA KM 4.5 C/ DE LA VICTORIA"
  recipientPhone?: string; // ej: "0981-123456"
  deadlineHours: string; // ej: "48 hs." | "72 hs."
  absenceDaysText: string; // ej: "los días lunes 07, martes 08 y miércoles 09 del corriente mes y año"
  laborCodeArticle?: string; // ej: "Art. 81 inc. j)"
}

export interface AbsenceLawValidation {
  isValid: boolean;
  consecutiveStreak: number;
  maxInMonth: number;
  hasConsecutiveRequirement: boolean;
  hasMonthlyRequirement: boolean;
  message: string;
  articleCitation: string;
}

/**
 * Formatea número con puntos de miles para C.I. paraguaya
 */
export function formatCiNumber(ci?: string): string {
  if (!ci) return '';
  const digits = ci.replace(/[^0-9]/g, '');
  if (!digits) return ci;
  return Number(digits).toLocaleString('es-PY');
}

/**
 * Convierte un arreglo de fechas YYYY-MM-DD en texto formal en español
 */
export function formatAbsenceDatesToSpanish(dateStrings: string[]): string {
  if (!dateStrings || dateStrings.length === 0) {
    return 'los días de ausencia injustificada del corriente mes y año';
  }

  const sortedDates = [...dateStrings].sort();
  const daysOfWeek = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'setiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  const parsed = sortedDates.map(ds => {
    const d = new Date(ds + 'T12:00:00');
    return {
      dayOfWeek: daysOfWeek[d.getDay()],
      dayNum: d.getDate(),
      monthNum: d.getMonth(),
      monthName: months[d.getMonth()],
      year: d.getFullYear(),
    };
  });

  if (parsed.length === 1) {
    return `el día ${parsed[0].dayOfWeek} ${parsed[0].dayNum} de ${parsed[0].monthName} del corriente año`;
  }

  const sameMonth = parsed.every(p => p.monthNum === parsed[0].monthNum && p.year === parsed[0].year);

  if (sameMonth) {
    const daysFormatted = parsed.map(p => `${p.dayOfWeek} ${p.dayNum}`);
    const lastDay = daysFormatted.pop();
    const joined = `${daysFormatted.join(', ')} y ${lastDay}`;
    return `los días ${joined} del corriente mes y año`;
  } else {
    const datesFormatted = parsed.map(p => `${p.dayOfWeek} ${p.dayNum} de ${p.monthName}`);
    const last = datesFormatted.pop();
    return `los días ${datesFormatted.join(', ')} y ${last} del corriente año`;
  }
}

/**
 * Valida si las ausencias cumplen el requisito legal del Código de Trabajo (Art. 81):
 * - 3 días consecutivos (incluyendo puente fin de semana)
 * - O 4 días en el transcurso del mes
 */
export function validateAbsencesLaborLaw(dateStrings: string[]): AbsenceLawValidation {
  const articleCitation = 'Art. 81 inc. a) y j) del Código del Trabajo (Ley N.º 213/93)';

  if (!dateStrings || dateStrings.length === 0) {
    return {
      isValid: false,
      consecutiveStreak: 0,
      maxInMonth: 0,
      hasConsecutiveRequirement: false,
      hasMonthlyRequirement: false,
      message: 'No se han seleccionado fechas de inasistencia.',
      articleCitation,
    };
  }

  const uniqueDates = Array.from(new Set(dateStrings)).sort();
  const dateObjs = uniqueDates.map(ds => new Date(ds + 'T12:00:00'));

  // Calcular racha máxima consecutiva (puente Viernes a Lunes)
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 0; i < dateObjs.length - 1; i++) {
    const d1 = dateObjs[i];
    const d2 = dateObjs[i + 1];
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

    const isConsecutiveDay = diffDays === 1;
    const isWeekendJump =
      (d1.getDay() === 5 && d2.getDay() === 1 && diffDays === 3) ||
      (d1.getDay() === 6 && d2.getDay() === 1 && diffDays === 2);

    if (isConsecutiveDay || isWeekendJump) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }

  // Calcular ausencias por mes
  const monthCounts: Record<string, number> = {};
  dateObjs.forEach(d => {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  const maxInMonth = Math.max(...Object.values(monthCounts), 0);

  const hasConsecutiveRequirement = maxStreak >= 3;
  const hasMonthlyRequirement = maxInMonth >= 4;
  const isValid = hasConsecutiveRequirement || hasMonthlyRequirement;

  let message = '';
  if (isValid) {
    if (hasConsecutiveRequirement && hasMonthlyRequirement) {
      message = `Cumple con ambas causales legales: ${maxStreak} días consecutivos y ${maxInMonth} días en el mes.`;
    } else if (hasConsecutiveRequirement) {
      message = `Cumple causal legal de más de 3 días consecutivos de inasistencia (${maxStreak} días seguidos detectados).`;
    } else {
      message = `Cumple causal legal de 4 inasistencias en el mes (${maxInMonth} días acumulados en el mes).`;
    }
  } else {
    message = `Se requiere un mínimo de 3 días consecutivos de ausencia o 4 días alternados en el mes según el ${articleCitation}. Actualmente registra ${maxStreak} día(s) consecutivos y ${maxInMonth} día(s) en el mes.`;
  }

  return {
    isValid,
    consecutiveStreak: maxStreak,
    maxInMonth,
    hasConsecutiveRequirement,
    hasMonthlyRequirement,
    message,
    articleCitation,
  };
}

/**
 * Genera el documento PDF idéntico al modelo de Telegrama Colacionado oficial COPACO
 */
export function generateTelegramPDF(config: TelegramConfig): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const marginX = 22;
  const pageWidth = 210;
  const contentWidth = pageWidth - marginX * 2; // 166mm

  // 1. Cabecera institucional
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Título centrado oficial
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('TELEGRAMA COLACIONADO', pageWidth / 2, 28, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('(CON AVISO DE RETORNO - COPACO)', pageWidth / 2, 35, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(marginX, 40, pageWidth - marginX, 40);

  // 3. Lugar y fecha a la derecha
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(config.cityAndDate, pageWidth - marginX, 49, { align: 'right' });

  // 4. Datos del destinatario (empleado a intimar)
  let curY = 60;
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);

  doc.text(`DESTINATARIO: ${config.recipientName.toUpperCase()}`, marginX, curY);
  curY += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10.5);
  doc.text(`C.I. N.º: ${formatCiNumber(config.recipientDoc)}`, marginX, curY);
  curY += 6;

  const addressLines = doc.splitTextToSize(`DOMICILIO: ${config.recipientAddress.toUpperCase()}`, contentWidth);
  doc.text(addressLines, marginX, curY);
  curY += addressLines.length * 5.5;

  if (config.recipientPhone) {
    doc.text(`TELÉFONO / CELULAR: ${config.recipientPhone}`, marginX, curY);
    curY += 6;
  }

  curY += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, curY, pageWidth - marginX, curY);
  curY += 10;

  // 5. Cuerpo de la intimación laboral con apercibimiento
  const bodyText =
    `Intimamos justifique fehacientemente en el perentorio plazo de ${config.deadlineHours} su inasistencia al trabajo sin justificación ` +
    `${config.absenceDaysText}, y asista inmediatamente a su puesto de trabajo en el mismo plazo bajo apercibimiento formal de que, ` +
    `en caso contrario, se considerará consumado el ABANDONO DE TRABAJO previsto en el ${config.laborCodeArticle || 'Art. 81 inc. j)'} ` +
    `y concordantes del Código del Trabajo (Ley N.º 213/93), con rescisión culpable del contrato sin derecho a preaviso ni indemnización.`;

  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  const textLines = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(textLines, marginX, curY, { maxWidth: contentWidth, align: 'justify' });
  curY += textLines.length * 6 + 10;

  // 6. Fórmula obligatoria de cierre
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text('Colaciónese.', marginX, curY);
  curY += 16;

  // 7. Datos de la empresa remitente
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, curY, pageWidth - marginX, curY);
  curY += 8;

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(`REMITENTE: ${config.companyName.toUpperCase()}`, marginX, curY);
  curY += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text(`Dirección: ${config.companyAddress}`, marginX, curY);
  curY += 5;

  doc.text(`Teléfono: ${config.companyPhone}`, marginX, curY);
  curY += 18;

  // 8. Espacio para firma patronal
  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  doc.text('________________________________________________', marginX, curY);
  curY += 5;
  doc.setFont('courier', 'bold');
  doc.text('Firma y Sello de la Empresa Empleadora', marginX, curY);

  // 9. Pie legal
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'LaboraPy ERP · Válido para trámite de imposición en ventanilla COPACO / Notificación de fe de entrega judicial',
    pageWidth / 2,
    285,
    { align: 'center' }
  );

  return doc;
}

/**
 * Descarga directamente el archivo PDF del telegrama colacionado
 */
export function downloadTelegramPDF(config: TelegramConfig, fileName?: string): void {
  const doc = generateTelegramPDF(config);
  const safeName =
    fileName || `Telegrama_Colacionado_${config.recipientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(safeName);
}
