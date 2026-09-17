/**
 * GENERADOR DE NOTAS LABORALES EDITABLES EN WORD (.DOCX) — Paraguay
 * Formatos oficiales: Amonestación, Suspensión, Traslado, Despido, Renuncia, Certificado
 * LaboraPy - Soluciones Laborales y Contables de Paraguay
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
} from 'docx';
import { saveAs } from 'file-saver';
import type { NotaLaboralOptions } from './noticePdfGenerator';

export function generarNotaLaboralDocxDocument(opts: NotaLaboralOptions): Document {
  const primaryColor = '143C28'; // Verde institucional LaboraPy

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: '28643C' },
      top: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { bottom: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: opts.empresa.toUpperCase(),
                    bold: true,
                    size: 26,
                    color: primaryColor,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80, after: 120 },
                children: [
                  new TextRun({
                    text: opts.lugarFecha,
                    size: 20,
                    color: '555555',
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

  const getTituloYTexto = (): { titulo: string; texto: string } => {
    switch (opts.tipo) {
      case 'amonestacion': {
        const hechos = opts.hechosOcurridos || 'haber incurrido en inasistencias injustificadas / faltas disciplinarias reiteradas';
        const fund = opts.fundamentoLegal || 'Código del Trabajo (Ley Nº 213/93, Arts. 65 y concordantes)';
        return {
          titulo: 'REF: APERCIBIMIENTO / AMONESTACIÓN DISCIPLINARIA ESCRITA',
          texto:
            `Por medio de la presente, la Dirección de la empresa ${opts.empresa} procede a aplicar una AMONESTACIÓN DISCIPLINARIA POR ESCRITO con constancia en su legajo personal, motivada en los siguientes antecedentes:\n\n` +
            `"${hechos}".\n\n` +
            `Dicho actuar constituye un incumplimiento grave de sus deberes contractuales y de las disposiciones del ${fund}.\n\n` +
            `Se le exhorta a deponer dicha conducta y dar estricto cumplimiento a las normas reglamentarias de la empresa, advirtiéndosele formalmente que la reincidencia en faltas similares dará lugar a sanciones disciplinarias más severas o a la rescisión justificada del contrato laboral de conformidad con el Art. 81 del Código del Trabajo.`,
        };
      }
      case 'suspension_disciplinaria': {
        const dias = Math.min(Math.max(1, opts.diasSuspension || 1), 8);
        const hechos = opts.hechosOcurridos || 'infracción a las normas de conducta y disciplina laboral';
        const inicio = opts.fechaInicioSuspension || opts.lugarFecha;
        const reingreso = opts.fechaFinSuspension || 'al término del plazo fijado';
        return {
          titulo: 'REF: NOTIFICACIÓN DE SUSPENSIÓN DISCIPLINARIA DE TRABAJO',
          texto:
            `Nos dirigimos a Usted a fin de comunicarle formalmente que la empresa ha resuelto aplicarle la medida disciplinaria de SUSPENSIÓN LABORAL SIN GOCE DE SALARIO por el término de ${dias} día(s), en estricta conformidad con lo dispuesto en los Artículos 353 inc. a), 352 inc. i) y 354 del Código del Trabajo (Ley Nº 213/93).\n\n` +
            `La referida sanción se fundamenta en los siguientes hechos comprobados:\n` +
            `"${hechos}".\n\n` +
            `La suspensión tendrá vigencia a partir del ${inicio}, debiendo reincorporarse a sus tareas habituales el día ${reingreso}.\n\n` +
            `Se deja expresa constancia de que la reiteración de conductas pasibles de sanción facultará a la patronal a rescindir el contrato de trabajo con justa causa bajo las causales del Art. 81 del Código Laboral.`,
        };
      }
      case 'traslado': {
        const origen = opts.sucursalOrigen || 'la sede actual';
        const destino = opts.sucursalDestino || 'la nueva sucursal asignada';
        const fechaEf = opts.fechaEfectivaTraslado || opts.lugarFecha;
        const compensacion = opts.compensacionTraslado ? `\n\nCompensación y condiciones acordadas: ${opts.compensacionTraslado}.` : '';
        return {
          titulo: 'REF: COMUNICACIÓN FORMAL DE TRASLADO DE PUESTO / SUCURSAL',
          texto:
            `Por medio de la presente, la empresa ${opts.empresa} le comunica que por estrictas razones organizativas, operativas y de mejor servicio, se ha dispuesto su TRASLADO desde ${origen} hacia ${destino}, con efectividad a partir del ${fechaEf}, en los términos y condiciones del Art. 34 del Código del Trabajo (Ley Nº 213/93).\n\n` +
            `Se deja expresa constancia de que la presente reasignación preserva de manera irrestricta su remuneración mensual, categoría profesional, antigüedad laboral acumulada y demás derechos adquiridos, garantizándose que la medida no ocasiona menoscabo moral ni perjuicio patrimonial alguno.${compensacion}\n\n` +
            `Agradecemos desde ya su habitual compromiso y colaboración con el crecimiento de nuestra organización.`,
        };
      }
      case 'despido_justificado': {
        const causal = opts.causaJustificada || opts.hechosOcurridos || 'incumplimiento grave de las obligaciones laborales';
        const fund = opts.fundamentoLegal || 'Art. 81 del Código del Trabajo (Ley Nº 213/93)';
        return {
          titulo: 'REF: NOTIFICACIÓN DE DESPIDO CON CAUSA JUSTIFICADA',
          texto:
            `Nos dirigimos a Usted con el objeto de comunicarle que la empresa ha resuelto rescindir el contrato individual de trabajo que nos vincula, CON CAUSA JUSTIFICADA, con efectividad a partir de la fecha, conforme a las prescripciones del ${fund}.\n\n` +
            `Fundamenta la presente determinación los siguientes hechos comprobados:\n` +
            `"${causal}".\n\n` +
            `Por tanto, no corresponde el abono de indemnización ni preaviso, quedando a su entera disposición en el Departamento de Recursos Humanos la liquidación de sus haberes devengados e irrenunciables en los plazos legales establecidos.`,
        };
      }
      case 'despido_injustificado': {
        return {
          titulo: 'REF: NOTIFICACIÓN DE DESPIDO',
          texto:
            `Nos dirigimos a Usted con el objeto de comunicarle la decisión de la empresa de dar por terminada la relación laboral sin causa justificada, con efectividad a partir de la fecha.\n\n` +
            (opts.diasPreaviso && opts.diasPreaviso > 0
              ? `Conforme a la normativa laboral vigente (Ley N.º 213/93, Código del Trabajo), le corresponden ${opts.diasPreaviso} días de preaviso o su correspondiente compensación sustitutiva en la liquidación final.\n\n`
              : '') +
            `Sírvase presentarse a las oficinas del Departamento de Recursos Humanos a fin de formalizar la percepción de sus haberes y liquidación final resultante, de estricta conformidad con las leyes laborales.\n\n` +
            `Agradecemos los servicios prestados a nuestra institución.`,
        };
      }
      case 'renuncia': {
        return {
          titulo: 'REF: RENUNCIA VOLUNTARIA INDECLINABLE',
          texto:
            `El que suscribe, ${opts.nombreEmpleado}, con Cédula de Identidad Nº ${opts.ciEmpleado}, quien desempeña actualmente el cargo de ${opts.cargoEmpleado}, se dirige a Ustedes a fin de comunicar mi decisión voluntaria e indeclinable de RENUNCIAR al puesto de trabajo que ocupo en la empresa, obedeciendo dicha determinación a estrictas razones de índole particular.\n\n` +
            `Hago constar que durante mi desempeño laboral la empresa ha cumplido a cabalidad con todas sus obligaciones legales y salariales, no teniendo reclamo alguno de índole laboral que formular.\n\n` +
            `Agradezco la oportunidad brindada y la confianza depositada en mi persona durante el tiempo de trabajo.`,
        };
      }
      case 'certificado_trabajo': {
        let salarioTexto = '';
        if (opts.incluirSalarioEnCertificado && opts.salarioMensual) {
          salarioTexto = ` percibe/percibía una remuneración mensual de Gs. ${opts.salarioMensual.toLocaleString('es-PY')},`;
        }
        return {
          titulo: 'CERTIFICADO LABORAL',
          texto:
            `Por medio del presente documento, la empresa ${opts.empresa.toUpperCase()} CERTIFICA que el/la Sr.(a) ${opts.nombreEmpleado.toUpperCase()}, con Cédula de Identidad Civil Nº ${opts.ciEmpleado}, presta/prestó servicios en nuestra institución desde el ${opts.fechaIngreso || '—'} ` +
            (opts.fechaEgreso ? `hasta el ${opts.fechaEgreso}, ` : 'hasta la actualidad, ') +
            `desempeñando el cargo de ${opts.cargoEmpleado.toUpperCase()}.${salarioTexto}\n\n` +
            `Durante su permanencia en nuestra empresa, ha demostrado honorabilidad, eficiencia, responsabilidad y cabal cumplimiento de las obligaciones inherentes a sus funciones.\n\n` +
            `Se expide el presente certificado a petición de la parte interesada y a los efectos que hubiere lugar, en la ciudad de ${opts.lugarFecha}.`,
        };
      }
    }
  };

  const { titulo, texto } = getTituloYTexto();

  const destinatarioParrafos =
    opts.tipo === 'renuncia'
      ? [
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [new TextRun({ text: 'Señores:', size: 22, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: opts.empresa.toUpperCase(), bold: true, size: 22, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [new TextRun({ text: 'Presente.-', size: 22, font: 'Calibri' })],
          }),
        ]
      : opts.tipo === 'certificado_trabajo'
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 180, after: 180 },
              children: [new TextRun({ text: 'A QUIEN CORRESPONDA:', bold: true, size: 24, font: 'Calibri' })],
            }),
          ]
        : [
            new Paragraph({
              spacing: { before: 120, after: 40 },
              children: [new TextRun({ text: 'Señor(a):', size: 22, font: 'Calibri' })],
            }),
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: opts.nombreEmpleado.toUpperCase(), bold: true, size: 22, font: 'Calibri' })],
            }),
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: `C.I. Nº: ${opts.ciEmpleado}`, size: 20, font: 'Calibri' })],
            }),
            ...(opts.cargoEmpleado
              ? [
                  new Paragraph({
                    spacing: { after: 40 },
                    children: [new TextRun({ text: `Cargo: ${opts.cargoEmpleado}`, size: 20, font: 'Calibri' })],
                  }),
                ]
              : []),
            new Paragraph({
              spacing: { after: 180 },
              children: [new TextRun({ text: 'Presente.-', size: 22, font: 'Calibri' })],
            }),
          ];

  const parrafosCuerpo = texto.split('\n\n').map((p) => {
    return new Paragraph({
      spacing: { after: 120, line: 276 },
      children: [
        new TextRun({
          text: p,
          size: 22,
          font: 'Calibri',
          color: '222222',
        }),
      ],
    });
  });

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          headerTable,
          ...destinatarioParrafos,
          new Paragraph({
            spacing: { before: 140, after: 140 },
            children: [
              new TextRun({
                text: titulo,
                bold: true,
                size: 22,
                font: 'Calibri',
                color: primaryColor,
              }),
            ],
          }),
          ...parrafosCuerpo,
          new Paragraph({
            spacing: { before: 360, after: 360 },
            children: [
              new TextRun({
                text: '___________________________________\nRecursos Humanos / Dirección\n' + opts.empresa,
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });
}

export async function exportarNotaLaboralDocx(opts: NotaLaboralOptions, nombreArchivo?: string): Promise<void> {
  const doc = generarNotaLaboralDocxDocument(opts);
  const blob = await Packer.toBlob(doc);
  const filename = nombreArchivo || `Nota_${opts.tipo}_${opts.ciEmpleado.replace(/[^a-zA-Z0-9]/g, '')}.docx`;
  saveAs(blob, filename);
}
