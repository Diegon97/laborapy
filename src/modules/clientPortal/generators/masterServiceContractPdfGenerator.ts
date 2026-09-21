/**
 * GENERADOR DE CONTRATO MAESTRO DE PRESTACIÓN DE SERVICIOS TOBI EN PDF (PARAGUAY)
 * Formato Corporativo Institucional B2B con membrete oficial, foliado dinámico,
 * espacio para media firma / rúbrica en todas las páginas y cláusulas de blindaje:
 * - Corte histórico y deslinde de pasivos preexistentes (MTESS / IPS).
 * - SLA Asíncrono digital (12 a 24 hs, sin llamadas telefónicas en horario de oficina).
 * - Cláusula de indemnidad (Hold Harmless) y límite de responsabilidad patrimonial (Cap 3 meses).
 * - Jurisdicción exclusiva en los Tribunales Civiles y Comerciales de Asunción.
 */

import jsPDF from 'jspdf';
import type { EmpresaCliente } from '../types/clientPortal';
import { numeroALetrasPY } from './employmentContractPdfGenerator';

export interface ContratoMaestroInput {
  // Datos de la Prestadora (Tobi)
  prestadoraNombre?: string;
  prestadoraRuc?: string;
  prestadoraRepresentante?: string;
  prestadoraDomicilio?: string;

  // Datos del Cliente (precompletados desde EmpresaCliente o manuales)
  razonSocial: string;
  ruc: string;
  dv: string;
  representanteLegalNombre: string;
  representanteLegalCi: string;
  domicilioLegal: string;
  ciudad?: string;

  // Condiciones Comerciales
  planNombre: string;
  montoMensualPYG: number;
  montoSetupPYG?: number;
  fechaInicioServicio: string; // YYYY-MM-DD
}

function formatearFechaEspanol(fechaStr: string): { dia: string; mes: string; anho: string } {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const fecha = fechaStr ? new Date(fechaStr + 'T00:00:00') : new Date();
  const dia = isNaN(fecha.getDate()) ? '01' : fecha.getDate().toString().padStart(2, '0');
  const mesIndex = isNaN(fecha.getMonth()) ? 0 : fecha.getMonth();
  const anho = isNaN(fecha.getFullYear()) ? '2026' : fecha.getFullYear().toString();
  return { dia, mes: meses[mesIndex], anho };
}

export function generarContratoMaestroPDF(input: ContratoMaestroInput): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 22;
  let y = 24;

  const ensureSpace = (neededMM: number) => {
    if (y + neededMM > pageHeight - bottomMargin) {
      doc.addPage();
      y = 24;
    }
  };

  const printParagraph = (
    text: string,
    options: {
      bold?: boolean;
      size?: number;
      textColor?: [number, number, number];
      spacingAfter?: number;
      lineSpacing?: number;
      align?: 'left' | 'center' | 'right' | 'justify';
    } = {}
  ) => {
    const {
      bold = false,
      size = 8.8,
      textColor = [15, 23, 42],
      spacingAfter = 3.5,
      lineSpacing = 4.2,
      align = 'left',
    } = options;

    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(lineSpacing);
      if (align === 'center') {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text(line, margin, y);
      }
      y += lineSpacing;
    }
    y += spacingAfter;
  };

  // Valores por defecto para Prestadora
  const prestadoraNombre = input.prestadoraNombre || 'TOBI SOLUCIONES LABORALES & TECNOLÓGICAS (LABORAPY)';
  const prestadoraRuc = input.prestadoraRuc || '80012345-6';
  const prestadoraRepresentante = input.prestadoraRepresentante || 'DIRECCIÓN EJECUTIVA TOBI';
  const prestadoraDomicilio = input.prestadoraDomicilio || 'Asunción, República del Paraguay';

  const { dia, mes, anho } = formatearFechaEspanol(input.fechaInicioServicio);
  const montoMensualLetras = numeroALetrasPY(input.montoMensualPYG);
  const montoSetup = input.montoSetupPYG || 0;
  const montoSetupLetras = montoSetup > 0 ? numeroALetrasPY(montoSetup) : '';

  // 1. Membrete Institucional Oficial
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOBI // LABORAPY - SISTEMAS DE CUMPLIMIENTO LABORAL', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('TECNOLOGÍA EN GESTIÓN DE NÓMINA, LIQUIDACIÓN Y AUDITORÍA PATRONAL PREVENTIVA (MTESS / IPS)', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Título del Instrumento Legal
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONTRATO PRIVADO DE PRESTACIÓN DE SERVICIOS TECNOLÓGICOS Y GESTIÓN OPERATIVA DE NÓMINA', pageWidth / 2, y, { align: 'center' });
  y += 7;

  // Comparecencia / Párrafo Introductorio
  printParagraph(
    `Entre las partes: Por una parte, ${prestadoraNombre}, con RUC N° ${prestadoraRuc}, representada en este acto por ${prestadoraRepresentante}, con domicilio legal en ${prestadoraDomicilio}, en adelante denominada "LA PRESTADORA" (titular de la plataforma tecnológica TOBI); y por la otra parte, ${input.razonSocial.toUpperCase()}, con RUC N° ${input.ruc}-${input.dv}, representada por su Representante Legal el/la Sr./Sra. ${input.representanteLegalNombre.toUpperCase()}, con C.I. N° ${input.representanteLegalCi}, con domicilio legal en ${input.domicilioLegal}, en la ciudad de ${input.ciudad || 'Asunción'}, República del Paraguay, en adelante denominada "LA CLIENTE"; convienen en celebrar el presente Contrato sujeto a las siguientes cláusulas y condiciones:`,
    { lineSpacing: 4.2, spacingAfter: 4 }
  );

  // CLÁUSULA PRIMERA
  printParagraph('CLÁUSULA PRIMERA: OBJETO DEL CONTRATO', { bold: true });
  printParagraph(
    `LA PRESTADORA concede a LA CLIENTE el acceso a la plataforma tecnológica TOBI (${input.planNombre.toUpperCase()}) y proveerá los servicios auxiliares de procesamiento algorítmico de nómina, cálculo determinista de liquidaciones de salarios conforme a la Ley N.º 213/93 (Código del Trabajo), emisión de borradores de recibos con validez oficial, generación de archivos para acreditación bancaria masiva (Itaú, Continental, Sudameris, Ueno y SIPAP/BCP) y reportes estructurados para los libros de registro del MTESS e IPS.`
  );

  // CLÁUSULA SEGUNDA
  printParagraph('CLÁUSULA SEGUNDA: DECLARACIÓN JURADA DE INFORMACIÓN FIDEDIGNA', { bold: true });
  printParagraph(
    'LA CLIENTE asume la obligación indelegable de suministrar datos verídicos, exactos y completos respecto a: legajos del personal, remuneraciones reales pactadas, fechas efectivas de ingreso, horarios, horas extraordinarias y descansos. LA CLIENTE declara bajo fe de juramento que la información ingresada a la plataforma refleja fielmente la realidad fáctica de la relación laboral con sus dependientes. LA PRESTADORA no asume responsabilidad civil, laboral ni penal por simulaciones salariales, pagos no declarados o datos inexactos suministrados por LA CLIENTE.'
  );

  // CLÁUSULA TERCERA
  printParagraph('CLÁUSULA TERCERA: LÍNEA DE BASE, CORTE HISTÓRICO Y PASIVOS PREEXISTENTES', { bold: true });
  printParagraph(
    `Las partes fijan expresamente como Fecha de Inicio Efectiva de los Servicios el día ${dia} de ${mes} de ${anho}. Las partes convienen de forma irrevocable que: 1) LA PRESTADORA inicia sus cómputos y asistencia técnica exclusivamente a partir de la fecha señalada; 2) Todo pasivo laboral preexistente, omisión de aportes al IPS, falta de formalización de contratos escritos de ejercicios anteriores, vacaciones no gozadas acumuladas o demandas por despidos previos a dicha fecha son de única y exclusiva responsabilidad de LA CLIENTE; 3) La contratación de TOBI no regulariza retroactivamente contingencias pasadas ni purga incumplimientos originados antes del corte.`
  );

  // CLÁUSULA CUARTA
  printParagraph('CLÁUSULA CUARTA: EXCLUSIÓN DE REPRESENTACIÓN JURÍDICA Y PATROCINIO', { bold: true });
  printParagraph(
    'El presente contrato constituye un arrendamiento de servicios técnicos y de software. LA PRESTADORA no ejerce mandato judicial, representación legal ni patrocinio letrado de LA CLIENTE en juicio ni en audiencias de mediación ante el Ministerio de Trabajo, Empleo y Seguridad Social (MTESS) o los Tribunales del Trabajo. Los reportes, finiquitos y simulaciones emitidos por TOBI son herramientas auxiliares de cálculo y gestión documental administrativa.'
  );

  // CLÁUSULA QUINTA
  printParagraph('CLÁUSULA QUINTA: MODALIDAD OPERATIVA ASÍNCRONA Y ACUERDO DE SERVICIO (SLA)', { bold: true });
  printParagraph(
    'Para salvaguardar la rigurosidad técnica y la trazabilidad de los procesos: 1) La atención, recepción de novedades (reposos, permisos, ausencias) y el soporte técnico se canalizan de manera estrictamente asíncrona y digital mediante la plataforma TOBI y su canal oficial de WhatsApp; 2) Se excluye expresamente la atención telefónica de emergencia y guardias presenciales; 3) Los requerimientos de liquidación ordinaria y consultas documentales serán procesados dentro de un plazo estándar de 12 a 24 horas hábiles; 4) LA CLIENTE remitirá las novedades del personal con una antelación mínima de cuarenta y ocho (48) horas hábiles al cierre bancario de haberes.'
  );

  // CLÁUSULA SEXTA
  printParagraph('CLÁUSULA SEXTA: CLÁUSULA DE INDEMNIDAD ("HOLD HARMLESS")', { bold: true });
  printParagraph(
    'LA CLIENTE se obliga expresamente a mantener indemne, defender y deslindar de toda responsabilidad a LA PRESTADORA, sus socios, directores y dependientes frente a cualquier demanda, reclamo administrativo, sumario o sanción pecuniaria emitida por el MTESS, IPS, la DNIT o el Poder Judicial que tenga su origen en: a) Incumplimientos patronales o violaciones a leyes sociales cometidas por LA CLIENTE; b) Despidos ejecutados por LA CLIENTE prescindiendo de los procedimientos legales; c) Datos extemporáneos o erróneos provistos por LA CLIENTE.'
  );

  // CLÁUSULA SÉPTIMA
  printParagraph('CLÁUSULA SÉPTIMA: LÍMITE MÁXIMO DE RESPONSABILIDAD PATRIMONIAL (CAP)', { bold: true });
  printParagraph(
    'En el eventual caso de comprobarse judicialmente una responsabilidad imputable a LA PRESTADORA por error manifiesto y directo de cálculo o falla técnica del sistema, la indemnización total máxima exigible no podrá exceder bajo ningún concepto el importe equivalente a las últimas tres (3) mensualidades efectivamente percibidas por LA PRESTADORA de LA CLIENTE. Queda excluida toda reparación por daño moral, lucro cesante o pérdidas consecuenciales.'
  );

  // CLÁUSULA OCTAVA
  printParagraph('CLÁUSULA OCTAVA: CONDICIONES ECONÓMICAS, MORA Y SUSPENSIÓN', { bold: true });
  const setupTexto = montoSetup > 0
    ? ` Asimismo, se pacta un pago único de instalación, relevamiento inicial y corte histórico de Guaraníes ${input.montoSetupPYG?.toLocaleString('es-PY')} (${montoSetupLetras}), abonado a la suscripción.`
    : '';
  printParagraph(
    `LA CLIENTE abonará en concepto de remuneración mensual por el servicio la suma de Guaraníes ${input.montoMensualPYG.toLocaleString('es-PY')} (${montoMensualLetras}), IVA incluido, pagadero del 1 al 5 de cada mes.${setupTexto} La falta de pago al décimo día corrido facultará a LA PRESTADORA a suspender el acceso a la plataforma y cesar la remisión de archivos bancarios, sin incurrir en mora ni responsabilidad ante los empleados de LA CLIENTE.`
  );

  // CLÁUSULA NOVENA
  printParagraph('CLÁUSULA NOVENA: CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS', { bold: true });
  printParagraph(
    'Ambas partes se comprometen a guardar absoluta reserva sobre los datos personales, nóminas, salarios y secretos comerciales a los que accedan en virtud del presente instrumento, rigiéndose por los estándares de secreto profesional y la legislación nacional sobre protección de datos personales.'
  );

  // CLÁUSULA DÉCIMA
  printParagraph('CLÁUSULA DÉCIMA: JURISDICCIÓN Y COMPETENCIA', { bold: true });
  printParagraph(
    'Para dirimir cualquier controversia resultante del cumplimiento o interpretación del presente contrato, las partes fijan domicilios especiales en los individualizados en el encabezamiento y se someten irrevocablemente a la jurisdicción y competencia de los Jueces y Tribunales en lo Civil y Comercial de la ciudad de Asunción, renunciando expresamente a cualquier otro fuero que pudiera corresponderles.'
  );

  // Cierre y Firmas
  ensureSpace(42);
  printParagraph(
    `En prueba de entera conformidad y aceptación, se firman dos (2) ejemplares de un mismo tenor y a un solo efecto, estampando las partes su firma al pie del presente instrumento y su media firma (rúbrica) en el margen de todas las fojas precedentes, en la ciudad de ${input.ciudad || 'Asunción'}, República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anho}.`,
    { spacingAfter: 14 }
  );

  const firmaY = y;
  const colWidth = (contentWidth - 20) / 2;

  // Firma Prestadora
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(margin, firmaY, margin + colWidth, firmaY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(prestadoraNombre.toUpperCase(), margin, firmaY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`RUC: ${prestadoraRuc}`, margin, firmaY + 9.5);
  doc.text('Por LA PRESTADORA (TOBI)', margin, firmaY + 14);

  // Firma Cliente
  doc.line(margin + colWidth + 20, firmaY, pageWidth - margin, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(input.razonSocial.toUpperCase(), margin + colWidth + 20, firmaY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Representante: ${input.representanteLegalNombre.toUpperCase()}`, margin + colWidth + 20, firmaY + 9.5);
  doc.text(`C.I. N° ${input.representanteLegalCi} // RUC: ${input.ruc}-${input.dv}`, margin + colWidth + 20, firmaY + 14);
  doc.text('Por LA CLIENTE', margin + colWidth + 20, firmaY + 18.5);

  // Paginación y foliado con espacio de media firma en TODAS las páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Encabezado sutil superior (a partir de la página 2)
    if (i > 1) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `TOBI // Contrato de Servicios B2B · ${input.razonSocial.toUpperCase()} (RUC ${input.ruc}-${input.dv})`,
        margin,
        12
      );
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, 14, pageWidth - margin, 14);
    }

    // Pie de página con espacio para media firma
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    // Rúbrica en el margen izquierdo/central
    doc.text('Media firma Cliente: _________________   Media firma Prestadora: _________________', margin, pageHeight - 9);

    // Foliado en el margen derecho
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }

  return doc;
}

/**
 * Función auxiliar para generar el PDF desde una EmpresaCliente existente en el ERP.
 */
export function generarContratoMaestroDesdeEmpresa(
  empresa: EmpresaCliente,
  opciones?: {
    planNombre?: string;
    montoMensualPYG?: number;
    montoSetupPYG?: number;
    fechaInicio?: string;
  }
): jsPDF {
  return generarContratoMaestroPDF({
    razonSocial: empresa.razonSocial,
    ruc: empresa.ruc,
    dv: empresa.dv,
    representanteLegalNombre: empresa.representanteLegalNombre || 'REPRESENTANTE LEGAL',
    representanteLegalCi: empresa.representanteLegalCi || '1234567',
    domicilioLegal: empresa.direccion || 'Asunción, Paraguay',
    ciudad: empresa.ciudad || 'Asunción',
    planNombre: opciones?.planNombre || 'Tobi PyME Integral',
    montoMensualPYG: opciones?.montoMensualPYG || 1450000,
    montoSetupPYG: opciones?.montoSetupPYG || 1500000,
    fechaInicioServicio: opciones?.fechaInicio || new Date().toISOString().split('T')[0],
  });
}
