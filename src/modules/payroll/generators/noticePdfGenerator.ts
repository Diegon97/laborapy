/**
 * GENERADOR DE NOTAS LABORALES EN PDF (Paraguay)
 * Formatos oficiales: Nota de Despido, Carta de Renuncia, Certificado de Trabajo
 * Versión: PY-LIQ-2026.09.01
 */

import jsPDF from 'jspdf';

export interface NotaLaboralOptions {
  tipo:
    | 'despido_injustificado'
    | 'despido_justificado'
    | 'renuncia'
    | 'certificado_trabajo'
    | 'amonestacion'
    | 'suspension_disciplinaria'
    | 'traslado';
  empresa: string;
  lugarFecha: string; // ej: "Asunción, 31 de agosto de 2026"
  nombreEmpleado: string;
  ciEmpleado: string;
  cargoEmpleado: string;
  fechaIngreso?: string;
  fechaEgreso?: string;
  diasPreaviso?: number;
  causaJustificada?: string;
  salarioMensual?: number;
  incluirSalarioEnCertificado?: boolean;
  // Campos específicos para sanciones y traslados
  hechosOcurridos?: string;
  fundamentoLegal?: string;
  diasSuspension?: number;
  fechaInicioSuspension?: string;
  fechaFinSuspension?: string;
  sucursalOrigen?: string;
  sucursalDestino?: string;
  fechaEfectivaTraslado?: string;
  compensacionTraslado?: string;
}

export function generarNotaLaboralPDF(opts: NotaLaboralOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  // ── Membrete ───────────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 60, 40);
  doc.text(opts.empresa.toUpperCase(), margin, y);
  y += 6;

  doc.setDrawColor(40, 100, 60);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ── Lugar y Fecha ──────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(opts.lugarFecha, pageWidth - margin, y, { align: 'right' });
  y += 15;

  // ── Contenido según tipo ───────────────────────────────────────────────────
  if (opts.tipo === 'despido_injustificado') {
    doc.text('Señor(a):', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: NOTIFICACIÓN DE DESPIDO', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const texto =
      `Nos dirigimos a Usted con el objeto de comunicarle la decisión de la empresa de dar por ` +
      `terminada la relación laboral sin causa justificada, con efectividad a partir de la fecha.\n\n` +
      (opts.diasPreaviso && opts.diasPreaviso > 0
        ? `Conforme a la normativa laboral vigente (Ley N.º 213/93, Código del Trabajo), le corresponden ${opts.diasPreaviso} días de preaviso o su correspondiente compensación sustitutiva en la liquidación final.\n\n`
        : '') +
      `Sírvase presentarse a las oficinas del Departamento de Recursos Humanos a fin de formalizar la ` +
      `percepción de sus haberes y liquidación final resultante, de estricta conformidad con las leyes laborales.\n\n` +
      `Agradecemos los servicios prestados a nuestra institución.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 25;

    // Firmas y talón
    doc.text('Atentamente,', margin, y); y += 15;
    doc.line(margin, y, margin + 60, y);
    doc.text('Recursos Humanos', margin, y + 5);
    doc.text(opts.empresa, margin, y + 10);

    y += 30;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('RECIBÍ CONFORME NOTIFICACIÓN (Duplicado para la Empresa)', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre y Apellido: ${opts.nombreEmpleado}`, margin, y); y += 5;
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Fecha y Hora de Recepción: _____/_____/_________  ____:____ hs`, margin, y); y += 15;
    doc.line(margin, y, margin + 70, y);
    doc.text('Firma del Trabajador', margin, y + 5);

  } else if (opts.tipo === 'renuncia') {
    doc.text('Señores:', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.empresa.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: RENUNCIA VOLUNTARIA INDECLINABLE', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const texto =
      `El que suscribe, ${opts.nombreEmpleado}, con Cédula de Identidad Nº ${opts.ciEmpleado}, ` +
      `quien desempeña actualmente el cargo de ${opts.cargoEmpleado}, se dirige a Ustedes a fin de comunicar ` +
      `mi decisión voluntaria e indeclinable de RENUNCIAR al puesto de trabajo que ocupo en la empresa, ` +
      `obedeciendo dicha determinación a estrictas razones de índole particular.\n\n` +
      `Hago constar que durante mi desempeño laboral la empresa ha cumplido a cabalidad con todas sus ` +
      `obligaciones legales y salariales, no teniendo reclamo alguno de índole laboral que formular.\n\n` +
      `Agradezco la oportunidad brindada y la confianza depositada en mi persona durante el tiempo de trabajo.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 20;

    doc.line(margin, y, margin + 70, y);
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado, margin, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y + 10);
    y += 25;

    doc.setFont('helvetica', 'bold');
    doc.text('TESTIGOS DE LA DECISIÓN VOLUNTARIA:', margin, y); y += 10;
    doc.setFont('helvetica', 'normal');

    const tCol1 = margin;
    const tCol2 = margin + 80;
    doc.line(tCol1, y, tCol1 + 60, y);
    doc.line(tCol2, y, tCol2 + 60, y);
    doc.text('Firma Testigo 1: ................................', tCol1, y + 5);
    doc.text('Firma Testigo 2: ................................', tCol2, y + 5);
    doc.text('Aclaración: ....................................', tCol1, y + 10);
    doc.text('Aclaración: ....................................', tCol2, y + 10);
    doc.text('C.I. Nº: .......................................', tCol1, y + 15);
    doc.text('C.I. Nº: .......................................', tCol2, y + 15);

  } else if (opts.tipo === 'certificado_trabajo') {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO LABORAL', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('A QUIEN CORRESPONDA:', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    let salarioTexto = '';
    if (opts.incluirSalarioEnCertificado && opts.salarioMensual) {
      salarioTexto = ` percibe/percibía una remuneración mensual de Gs. ${opts.salarioMensual.toLocaleString('es-PY')},`;
    }

    const texto =
      `Por medio del presente documento, la empresa ${opts.empresa.toUpperCase()} CERTIFICA que ` +
      `el/la Sr.(a) ${opts.nombreEmpleado.toUpperCase()}, con Cédula de Identidad Civil Nº ${opts.ciEmpleado}, ` +
      `presta/prestó servicios en nuestra institución desde el ${opts.fechaIngreso || '—'} ` +
      (opts.fechaEgreso ? `hasta el ${opts.fechaEgreso}, ` : 'hasta la actualidad, ') +
      `desempeñando el cargo de ${opts.cargoEmpleado.toUpperCase()}.${salarioTexto}\n\n` +
      `Durante su permanencia en nuestra empresa, ha demostrado honorabilidad, eficiencia, ` +
      `responsabilidad y cabal cumplimiento de las obligaciones inherentes a sus funciones.\n\n` +
      `Se expide el presente certificado a petición de la parte interesada y a los efectos que hubiere lugar, ` +
      `en la ciudad de ${opts.lugarFecha}.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 35;

    doc.line(pageWidth / 2 - 35, y, pageWidth / 2 + 35, y);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', pageWidth / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(opts.empresa, pageWidth / 2, y + 10, { align: 'center' });

  } else if (opts.tipo === 'despido_justificado') {
    doc.text('Señor(a):', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: NOTIFICACIÓN DE DESPIDO CON CAUSA JUSTIFICADA', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const causal = opts.causaJustificada || opts.hechosOcurridos || 'incumplimiento grave de las obligaciones laborales';
    const fund = opts.fundamentoLegal || 'Art. 81 del Código del Trabajo (Ley Nº 213/93)';

    const texto =
      `Nos dirigimos a Usted con el objeto de comunicarle que la empresa ha resuelto rescindir ` +
      `el contrato individual de trabajo que nos vincula, CON CAUSA JUSTIFICADA, con efectividad a partir de la fecha, ` +
      `conforme a las prescripciones del ${fund}.\n\n` +
      `Fundamenta la presente determinación los siguientes hechos comprobados:\n` +
      `"${causal}".\n\n` +
      `Por tanto, no corresponde el abono de indemnización ni preaviso, quedando a su entera disposición ` +
      `en el Departamento de Recursos Humanos la liquidación de sus haberes devengados e irrenunciables (salario proporcional, ` +
      `aguinaldo proporcional y vacaciones causadas) en los plazos legales establecidos.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 20;

    doc.text('Atentamente,', margin, y); y += 15;
    doc.line(margin, y, margin + 60, y);
    doc.text('Recursos Humanos / Dirección', margin, y + 5);
    doc.text(opts.empresa, margin, y + 10);

    y += 28;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('CONSTANCIA DE NOTIFICACIÓN (Duplicado para Legajo Empresarial)', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Notificado: ${opts.nombreEmpleado} — C.I. Nº ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Fecha y Hora de Recepción: _____/_____/_________  ____:____ hs`, margin, y); y += 14;
    doc.line(margin, y, margin + 70, y);
    doc.text('Firma / Aclaración del Notificado', margin, y + 5);

  } else if (opts.tipo === 'amonestacion') {
    doc.text('Señor(a):', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Cargo: ${opts.cargoEmpleado}`, margin, y); y += 5;
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: APERCIBIMIENTO / AMONESTACIÓN DISCIPLINARIA ESCRITA', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const hechos = opts.hechosOcurridos || 'haber incurrido en inasistencias injustificadas / llegadas tardías reiteradas';
    const fund = opts.fundamentoLegal || 'Código del Trabajo (Ley Nº 213/93, Arts. 65 y concordantes)';

    const texto =
      `Por medio de la presente, la Dirección de la empresa ${opts.empresa} procede a aplicar una ` +
      `AMONESTACIÓN DISCIPLINARIA POR ESCRITO con constancia en su legajo personal, motivada en los siguientes antecedentes:\n\n` +
      `"${hechos}".\n\n` +
      `Dicho actuar constituye un incumplimiento de sus deberes contractuales y de las disposiciones del ${fund}.\n\n` +
      `Se le exhorta a deponer dicha conducta y dar estricto cumplimiento a las normas reglamentarias de la empresa, ` +
      `advirtiéndosele formalmente que la reincidencia en faltas similares dará lugar a sanciones disciplinarias más severas ` +
      `o a la rescisión justificada del contrato laboral de conformidad con el Art. 81 del Código del Trabajo.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 20;

    doc.text('Atentamente,', margin, y); y += 15;
    doc.line(margin, y, margin + 60, y);
    doc.text('Jefatura de Personal / Recursos Humanos', margin, y + 5);
    doc.text(opts.empresa, margin, y + 10);

    y += 28;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('RECIBÍ CONFORME (Copia debidamente notificada para Legajo MTESS)', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Colaborador: ${opts.nombreEmpleado} — C.I. Nº ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Fecha y Hora: _____/_____/_________  ____:____ hs`, margin, y); y += 14;
    doc.line(margin, y, margin + 70, y);
    doc.text('Firma del Colaborador', margin, y + 5);

  } else if (opts.tipo === 'suspension_disciplinaria') {
    doc.text('Señor(a):', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Cargo: ${opts.cargoEmpleado}`, margin, y); y += 5;
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: NOTIFICACIÓN DE SUSPENSIÓN DISCIPLINARIA DE TRABAJO', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const dias = Math.min(Math.max(1, opts.diasSuspension || 1), 8); // Tope legal: 8 días según Código Laboral
    const hechos = opts.hechosOcurridos || 'infracción grave a las normas de conducta y disciplina laboral';
    const inicio = opts.fechaInicioSuspension || opts.lugarFecha;
    const reingreso = opts.fechaFinSuspension || 'al término del plazo legal fijado';

    const texto =
      `Nos dirigimos a Usted a fin de comunicarle formalmente que la empresa ha resuelto aplicarle la medida ` +
      `disciplinaria de SUSPENSIÓN LABORAL SIN GOCE DE SALARIO por el término de ${dias} día(s), en estricta conformidad ` +
      `con lo dispuesto en los Artículos 353 inc. a), 352 inc. i) y 354 del Código del Trabajo (Ley Nº 213/93).\n\n` +
      `La referida sanción se fundamenta en los siguientes hechos comprobados:\n` +
      `"${hechos}".\n\n` +
      `La suspensión tendrá vigencia a partir del ${inicio}, debiendo reincorporarse a sus tareas habituales el día ${reingreso}.\n\n` +
      `Se deja expresa constancia de que la reiteración de conductas pasibles de sanción facultará a la patronal a rescindir ` +
      `el contrato de trabajo con justa causa bajo las causales del Art. 81 del Código Laboral.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 20;

    doc.text('Atentamente,', margin, y); y += 15;
    doc.line(margin, y, margin + 60, y);
    doc.text('Dirección / Recursos Humanos', margin, y + 5);
    doc.text(opts.empresa, margin, y + 10);

    y += 28;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('NOTIFICACIÓN RECIBIDA (Duplicado para Registro)', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Colaborador: ${opts.nombreEmpleado} — C.I. Nº ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Fecha y Hora de Notificación: _____/_____/_________  ____:____ hs`, margin, y); y += 14;
    doc.line(margin, y, margin + 70, y);
    doc.text('Firma del Colaborador Sancionado', margin, y + 5);

  } else if (opts.tipo === 'traslado') {
    doc.text('Señor(a):', margin, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(opts.nombreEmpleado.toUpperCase(), margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`C.I. Nº: ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Cargo: ${opts.cargoEmpleado}`, margin, y); y += 5;
    doc.text('Presente.-', margin, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('REF: COMUNICACIÓN FORMAL DE TRASLADO DE PUESTO / SUCURSAL', margin, y); y += 8;

    doc.setFont('helvetica', 'normal');
    const origen = opts.sucursalOrigen || 'la sede actual';
    const destino = opts.sucursalDestino || 'la nueva sucursal asignada';
    const fechaEf = opts.fechaEfectivaTraslado || opts.lugarFecha;
    const compensacion = opts.compensacionTraslado ? `\n\nCompensación y condiciones acordadas: ${opts.compensacionTraslado}.` : '';

    const texto =
      `Por medio de la presente, la empresa ${opts.empresa} le comunica que por estrictas razones organizativas, ` +
      `operativas y de mejor servicio, se ha dispuesto su TRASLADO desde ${origen} hacia ${destino}, ` +
      `con efectividad a partir del ${fechaEf}, en los términos y condiciones del Art. 34 del Código del Trabajo (Ley Nº 213/93).\n\n` +
      `Se deja expresa constancia de que la presente reasignación preserva de manera irrestricta su remuneración mensual, ` +
      `categoría profesional, antigüedad laboral acumulada y demás derechos adquiridos, garantizándose que la medida ` +
      `no ocasiona menoscabo moral ni perjuicio patrimonial alguno.${compensacion}\n\n` +
      `Agradecemos desde ya su habitual compromiso y colaboración con el crecimiento de nuestra organización.`;

    const lineas = doc.splitTextToSize(texto, contentWidth);
    doc.text(lineas, margin, y);
    y += lineas.length * 5 + 20;

    doc.text('Atentamente,', margin, y); y += 15;
    doc.line(margin, y, margin + 60, y);
    doc.text('Gerencia General / Recursos Humanos', margin, y + 5);
    doc.text(opts.empresa, margin, y + 10);

    y += 28;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('ACUSE DE RECIBO Y NOTIFICACIÓN', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Colaborador: ${opts.nombreEmpleado} — C.I. Nº ${opts.ciEmpleado}`, margin, y); y += 5;
    doc.text(`Fecha y Hora de Recepción: _____/_____/_________  ____:____ hs`, margin, y); y += 14;
    doc.line(margin, y, margin + 70, y);
    doc.text('Firma del Colaborador Notificado', margin, y + 5);
  }

  return doc;
}
