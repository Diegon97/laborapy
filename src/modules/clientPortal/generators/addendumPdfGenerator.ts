/**
 * GENERADOR DE ADENDAS CONTRACTUALES EN PDF (PARAGUAY)
 * Cumplimiento con la Ley N.º 213/93 (Código del Trabajo) y Ley N.º 6738/21 (Teletrabajo)
 * Motivos: Modificación Salarial/Comisiones, Traslados de Sucursal, Confidencialidad/NDA y Jornadas
 */

import jsPDF from 'jspdf';
import type { AdendaContrato, Empleado, EmpresaCliente, MotivoAdenda } from '../types/clientPortal';
import { formatPYG } from '../services/clientStorageService';
import { numeroALetrasGuaranies } from '../../payroll/utils/numberToWordsPY';

const TITULOS_MOTIVOS: Record<MotivoAdenda, { titulo: string; refLegal: string }> = {
  modificacion_salarial: {
    titulo: 'MODIFICACIÓN DE REMUNERACIÓN Y RÉGIMEN DE COMISIONES',
    refLegal: 'Arts. 230 y 231, Ley N.º 213/93 (Intangibilidad e Irrenunciabilidad Salarial)',
  },
  traslado_sucursal: {
    titulo: 'TRASLADO DE LUGAR DE TRABAJO Y ESTABLECIMIENTO',
    refLegal: 'Arts. 67, 72 y 73, Ley N.º 213/93 (Ius Variandi y Movilidad Geográfica)',
  },
  confidencialidad_nda: {
    titulo: 'PACTO ESPECIAL DE CONFIDENCIALIDAD, SECRETO Y NO CONCURRENCIA',
    refLegal: 'Art. 65 inc. g y Art. 81 inc. c y h, Ley N.º 213/93 (Deber de Reserva y Lealtad)',
  },
  cambio_jornada_teletrabajo: {
    titulo: 'ADECUACIÓN DE JORNADA LABORAL Y MODALIDAD DE PRESTACIÓN',
    refLegal: 'Capítulo II, Ley N.º 213/93 y Ley N.º 6738/21 (Teletrabajo en Paraguay)',
  },
  otro: {
    titulo: 'MODIFICACIÓN DE CONDICIONES CONTRACTUALES',
    refLegal: 'Ley N.º 213/93 (Código del Trabajo de la República del Paraguay)',
  },
};

function formatFechaLargaPY(fechaISO: string): string {
  if (!fechaISO) return '';
  const partes = fechaISO.split('-');
  if (partes.length !== 3) return fechaISO;
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const y = partes[0];
  const m = parseInt(partes[1], 10) - 1;
  const d = parseInt(partes[2], 10);
  return `${d} de ${meses[m]} de ${y}`;
}

export function generarAdendaContratoPDF(
  adenda: AdendaContrato,
  empleado: Empleado,
  empresa: EmpresaCliente
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ── 1. Membrete Institucional ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empresa.razonSocial.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const rucTexto = `RUC: ${empresa.ruc}-${empresa.dv} · Reg. Patronal IPS: ${empresa.nroPatronalIps || 'N/D'} · MTESS: ${empresa.nroPatronalMtess || 'N/D'}`;
  doc.text(rucTexto, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(empresa.direccion, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // ── 2. Título de la Adenda ──
  const motivoInfo = TITULOS_MOTIVOS[adenda.motivo] || TITULOS_MOTIVOS.otro;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199); // Azul corporativo
  doc.text(
    `ADENDA N.º ${adenda.nroAdenda} AL CONTRATO INDIVIDUAL DE TRABAJO`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(motivoInfo.titulo, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`Ref.: ${motivoInfo.refLegal}`, pageWidth / 2, y, { align: 'center' });
  y += 7;

  // ── 3. Párrafo Introductorio y Comparecencia ──
  doc.setFontSize(8.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  const intro =
    `En la ciudad de Asunción, Capital de la República del Paraguay, comparecen por una parte la firma ` +
    `${empresa.razonSocial}, con RUC N.º ${empresa.ruc}-${empresa.dv}, domiciliada en ${empresa.direccion}, ` +
    `en adelante denominada EL EMPLEADOR, representada en este acto por el/la Sr./Sra. ${empresa.representanteLegalNombre}, ` +
    `con Cédula de Identidad N.º ${empresa.representanteLegalCi}; y por la otra parte el/la Sr./Sra. ` +
    `${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}, de nacionalidad ${empleado.nacionalidad}, ` +
    `con Cédula de Identidad N.º ${empleado.ci}, estado civil ${empleado.estadoCivil}, domiciliado/a en ` +
    `${empleado.domicilio || 'Asunción, Paraguay'}, en adelante denominado/a EL TRABAJADOR; ` +
    `ambas partes convienen de común acuerdo en celebrar la presente ADENDA MODIFICATORIA AL CONTRATO INDIVIDUAL DE TRABAJO, ` +
    `con arreglo a las siguientes cláusulas:`;

  const introLines = doc.splitTextToSize(intro, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 3.9 + 4;

  // ── 4. Cláusulas Específicas ──
  const clausulas: { num: string; texto: string }[] = [];

  // PRIMERA: Antecedentes
  clausulas.push({
    num: 'PRIMERA (ANTECEDENTES Y CONTINUIDAD DE LA RELACIÓN):',
    texto:
      `Las partes ratifican la vigencia ininterrumpida de la relación laboral iniciada en fecha ${formatFechaLargaPY(adenda.fechaContratoOriginal || empleado.fechaIngreso)}, ` +
      `originada en el Contrato Individual de Trabajo formalmente celebrado. La presente adenda modifica únicamente las estipulaciones expresamente ` +
      `detalladas a continuación, conservando EL TRABAJADOR en su plenitud la antigüedad computable, categoría profesional y todos los derechos ` +
      `adquiridos tutelados por el Art. 3 del Código del Trabajo (Principio de Conservación de la Relación Laboral).`,
  });

  // SEGUNDA: Motivo
  if (adenda.motivo === 'modificacion_salarial') {
    const nuevoMonto = adenda.nuevoSalario || empleado.salarioBase;
    const anteriorMonto = adenda.salarioAnterior || empleado.salarioBase;
    const letrasNuevo = numeroALetrasGuaranies(nuevoMonto);

    let textoSalarial =
      `En virtud de lo dispuesto en los Arts. 230 y 231 del Código del Trabajo, las partes convienen de mutuo acuerdo fijar la nueva remuneración mensual ` +
      `de EL TRABAJADOR en la suma de ${formatPYG(nuevoMonto)} (${letrasNuevo}), rigiendo dicha actualización salarial a partir del día ` +
      `${formatFechaLargaPY(adenda.fechaVigencia)}. La suma pactada sustituye el salario base anterior de ${formatPYG(anteriorMonto)}.`;

    if (adenda.detalleComisiones && adenda.detalleComisiones.trim().length > 0) {
      textoSalarial += ` Asimismo, se estipula el siguiente régimen de comisiones e incentivos: ${adenda.detalleComisiones.trim()}`;
    }

    textoSalarial +=
      ` Se deja expresa constancia de que sobre la nueva remuneración devengada se efectuarán las retenciones de ley correspondientes al ` +
      `aporte obrero del 9% al Instituto de Previsión Social (IPS) de conformidad con el Decreto-Ley N.º 1860/50 y normas concordantes, ` +
      `asumiendo EL EMPLEADOR el aporte patronal legal obligatorio.`;

    clausulas.push({
      num: 'SEGUNDA (ACTUALIZACIÓN SALARIAL Y RÉGIMEN DE COMISIONES):',
      texto: textoSalarial,
    });
  } else if (adenda.motivo === 'traslado_sucursal') {
    const lugarAnt = adenda.lugarAnterior || 'Establecimiento habitual de la empresa';
    const lugarNue = adenda.nuevoLugar || empresa.direccion;

    let textoTraslado =
      `En ejercicio razonable de las facultades de dirección y organización previstas en los Arts. 67, 72 y 73 del Código del Trabajo (Ius Variandi), ` +
      `y por estrictas razones técnicas, comerciales y operativas de la firma, se acuerda el traslado de EL TRABAJADOR ` +
      `del establecimiento de origen ubicado en "${lugarAnt}" a la nueva sede/sucursal sita en "${lugarNue}", ` +
      `haciéndose efectivo dicho traslado a partir del día ${formatFechaLargaPY(adenda.fechaVigencia)}.`;

    if (adenda.compensacionTraslado && adenda.compensacionTraslado.trim().length > 0) {
      textoTraslado += ` En concepto de compensación por gastos de movilidad y traslado, EL EMPLEADOR abonará: ${adenda.compensacionTraslado.trim()}`;
    }

    textoTraslado +=
      ` Las partes dejan asentado que el traslado no ocasiona perjuicio material ni menoscabo moral o salarial al trabajador, ` +
      `respetándose todas sus condiciones laborales esenciales.`;

    clausulas.push({
      num: 'SEGUNDA (TRASLADO DE ESTABLECIMIENTO Y SEDE DE PRESTACIÓN):',
      texto: textoTraslado,
    });
  } else if (adenda.motivo === 'confidencialidad_nda') {
    const alcance =
      adenda.alcanceConfidencialidad ||
      'Bases de datos de clientes, código fuente, secretos industriales, know-how, fórmulas, listas de precios, estrategias de marketing y políticas financieras de EL EMPLEADOR.';
    const penalidad =
      adenda.penalidadIncumplimiento ||
      'Constituirá falta gravísima conforme a los Arts. 81 inc. c) y h) del Código del Trabajo, facultando al despido justificado sin derecho a indemnización ni preaviso, más la obligación de resarcir daños y perjuicios y las acciones penales que correspondan.';

    const textoConf =
      `Conforme a los deberes de fidelidad y secreto profesional consagrados en el Art. 65 inc. g) del Código del Trabajo, EL TRABAJADOR ` +
      `asume formalmente el compromiso irrestricto de guardar estricta reserva y confidencialidad respecto a: ${alcance}. ` +
      `Queda prohibida toda divulgación, reproducción o transmisión no autorizada a terceros, directa o indirectamente. ` +
      `Asimismo, el trabajador se obliga a no competir deslealmente con el empleador mientras dure el contrato de trabajo ni utilizar la información ` +
      `para provecho propio o ajeno. Esta obligación pervivirá con posterioridad a la terminación del contrato de trabajo por el plazo máximo legal. ` +
      `Consecuencias por incumplimiento: ${penalidad}`;

    clausulas.push({
      num: 'SEGUNDA (PACTO REFORZADO DE CONFIDENCIALIDAD, SECRETO Y NO CONCURRENCIA):',
      texto: textoConf,
    });
  } else if (adenda.motivo === 'cambio_jornada_teletrabajo') {
    const jornada = adenda.nuevaJornada || '48 horas semanales (Lunes a Sábado)';
    const horario = adenda.nuevoHorario || '08:00 a 17:00 hs con intervalo de almuerzo';

    const textoJornada =
      `Las partes convienen en readecuar el régimen de trabajo a partir del día ${formatFechaLargaPY(adenda.fechaVigencia)}, ` +
      `estableciéndose la jornada ordinaria en ${jornada}, cumpliéndose en el horario de ${horario}. ` +
      `En caso de modalidad de teletrabajo o esquema híbrido, regirán plenamente las disposiciones y garantías consagradas en la Ley N.º 6738/21 ` +
      `(derecho a la desconexión digital, provisión de herramientas operativas y registro de jornada).`;

    clausulas.push({
      num: 'SEGUNDA (NUEVA DISTRIBUCIÓN HORARIA Y MODALIDAD DE PRESTACIÓN):',
      texto: textoJornada,
    });
  } else {
    clausulas.push({
      num: 'SEGUNDA (MODIFICACIONES ESPECÍFICAS):',
      texto:
        adenda.clausulasEspecificas ||
        `Las partes convienen de común acuerdo en actualizar las condiciones de trabajo a partir del ${formatFechaLargaPY(adenda.fechaVigencia)}.`,
    });
  }

  // TERCERA: Ratificación y subsistencia
  clausulas.push({
    num: 'TERCERA (RATIFICACIÓN Y SUBSISTENCIA DE LAS DEMÁS CLÁUSULAS):',
    texto:
      `Salvo las modificaciones puntuales convenidas en la presente adenda, todas y cada una de las demás cláusulas, derechos, ` +
      `beneficios y obligaciones estipulados en el Contrato Individual de Trabajo original permanecen plenamente vigentes, ratificándose en su totalidad ` +
      `sin novación de la relación jurídica.`,
  });

  // CUARTA: Jurisdicción laboral
  clausulas.push({
    num: 'CUARTA (LEGISLACIÓN APLICABLE Y JURISDICCIÓN):',
    texto:
      `Para todos los efectos legales, interpretativos y derivados del presente instrumento, las partes se someten a la normativa del Código del Trabajo ` +
      `de la República del Paraguay (Ley N.º 213/93) y a la jurisdicción exclusiva de los Juzgados y Tribunales del Trabajo de la Capital (Asunción), ` +
      `renunciando a cualquier otro fuero o domicilio.`,
  });

  // Renderizar cláusulas con control de paginación
  for (const c of clausulas) {
    if (y > 245) {
      doc.addPage();
      y = 22;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(c.num, margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(c.texto, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 3.8 + 3.5;
  }

  // ── 5. Cierre y Fecha ──
  if (y > 235) {
    doc.addPage();
    y = 22;
  }

  y += 2;
  const fechaCierre = adenda.fechaEmision || new Date().toISOString().split('T')[0];
  const cierre =
    `En prueba de entera conformidad y previa lectura y ratificación de todas y cada una de sus estipulaciones, se firman ` +
    `dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Asunción, a los ${formatFechaLargaPY(fechaCierre)}.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const cierreLines = doc.splitTextToSize(cierre, contentWidth);
  doc.text(cierreLines, margin, y);
  y += cierreLines.length * 3.8 + 22;

  // ── 6. Firmas Duales ──
  if (y > 265) {
    doc.addPage();
    y = 35;
  }

  const firmaWidth = 65;
  const firma1X = margin + 10;
  const firma2X = pageWidth - margin - firmaWidth - 10;

  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.5);
  doc.line(firma1X, y, firma1X + firmaWidth, y);
  doc.line(firma2X, y, firma2X + firmaWidth, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empresa.representanteLegalNombre, firma1X + firmaWidth / 2, y, { align: 'center' });
  doc.text(`${empleado.nombres} ${empleado.apellidos}`, firma2X + firmaWidth / 2, y, { align: 'center' });
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('POR EL EMPLEADOR', firma1X + firmaWidth / 2, y, { align: 'center' });
  doc.text('EL TRABAJADOR', firma2X + firmaWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(`C.I. N.º ${empresa.representanteLegalCi}`, firma1X + firmaWidth / 2, y, { align: 'center' });
  doc.text(`C.I. N.º ${empleado.ci}`, firma2X + firmaWidth / 2, y, { align: 'center' });

  return doc;
}
