/**
 * GENERADOR DE CONTRATOS INDIVIDUALES DE TRABAJO EN PDF (PARAGUAY)
 * Formato Corporativo Formal basado en el modelo estructurado de 8 Modalidades
 * en estricto cumplimiento con la Ley N.º 213/93 (Código del Trabajo de Paraguay).
 *
 * Incluye:
 * - Encabezado y membrete legal completo.
 * - Párrafo introductorio formal de las partes.
 * - Modalidades 1 a 8:
 *    1. Objeto y clase de trabajo (sección asignada y reglas de traslado > 50 km).
 *    2. Forma de contrato (unidad de tiempo).
 *    3. Remuneración convenida en números y letras.
 *    4. Plazo del contrato (Indefinido) y CLÁUSULA ESPECIAL DE ABSORCIÓN Y RECONOCIMIENTO DE ANTIGÜEDAD.
 *    5. Duración de jornada (48 hs semanales, continuado, rotaciones operativas y domingos).
 *    6. Período ordinario de pago (último día hábil del mes).
 *    7. Viajes y viáticos comisionados asumidos por el empleador.
 *    8. Confidencialidad y normas disciplinarias (8.1 a 8.7: recursos, telegrama colacionado para domicilio,
 *       causal despido Art. 81 inc. h, uniformes obligatorios, rotación de puestos y revisión de bultos/palpación por mismo sexo).
 * - Cierre formal y firmas de Empleador y Trabajador.
 */

import jsPDF from 'jspdf';
import type { ContratoTrabajo, Empleado, EmpresaCliente } from '../types/clientPortal';
import { formatPYG } from '../services/clientStorageService';

/**
 * Convierte un número entero a letras en guaraníes en mayúsculas.
 */
export function numeroALetrasPY(numero: number): string {
  if (!Number.isFinite(numero) || numero === 0) return 'CERO GUARANÍES';
  const n = Math.abs(Math.round(numero));

  const UNIDADES = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
    'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
  ];
  const DECENAS = [
    '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
  ];
  const CENTENAS = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
  ];

  const seccion = (num: number): string => {
    if (num === 0) return '';
    if (num < 21) return UNIDADES[num];
    if (num < 30) return 'VEINTI' + (num === 21 ? 'ÚN' : UNIDADES[num - 20]);
    if (num < 100) {
      const d = Math.floor(num / 10);
      const u = num % 10;
      return DECENAS[d] + (u ? ' Y ' + (u === 1 ? 'UN' : UNIDADES[u]) : '');
    }
    if (num < 1000) {
      const c = Math.floor(num / 100);
      const resto = num % 100;
      if (num === 100) return 'CIEN';
      return CENTENAS[c] + (resto ? ' ' + seccion(resto) : '');
    }
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      const textoMiles = miles === 1 ? 'MIL' : seccion(miles) + ' MIL';
      return textoMiles + (resto ? ' ' + seccion(resto) : '');
    }
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    const textoMillones = millones === 1 ? 'UN MILLÓN' : seccion(millones) + ' MILLONES';
    return textoMillones + (resto ? ' ' + seccion(resto) : '');
  };

  const letras = seccion(n).trim();
  return `${letras} GUARANÍES`;
}

function formatearFechaEspanol(fechaStr: string): { dia: string; mes: string; anho: string } {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const fecha = fechaStr ? new Date(fechaStr + 'T00:00:00') : new Date();
  const dia = isNaN(fecha.getDate()) ? '01' : fecha.getDate().toString().padStart(2, '0');
  const mesIndex = isNaN(fecha.getMonth()) ? 0 : fecha.getMonth();
  const anho = isNaN(fecha.getFullYear()) ? '2026' : fecha.getFullYear().toString();
  return { dia, mes: meses[mesIndex], anho };
}

export function generarContratoTrabajoPDF(
  contrato: ContratoTrabajo,
  empleado: Empleado,
  empresa: EmpresaCliente
): jsPDF {
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
  let y = 20;

  const ensureSpace = (neededMM: number) => {
    if (y + neededMM > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
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
    } = {}
  ) => {
    const {
      bold = false,
      size = 9,
      textColor = [15, 23, 42],
      spacingAfter = 3.5,
      lineSpacing = 4.3,
    } = options;

    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(lineSpacing);
      doc.text(line, margin, y);
      y += lineSpacing;
    }
    y += spacingAfter;
  };

  // 1. Membrete Institucional
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empresa.razonSocial.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const infoLegal = `${empresa.direccion || 'Asunción'} · Tel.: ${empresa.telefono || '806 111 / 800 125'} · RUC: ${empresa.ruc}-${empresa.dv}`;
  doc.text(infoLegal, pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.text(`${empresa.ciudad || 'Asunción'} – Paraguay`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // 2. Título del Documento
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONTRATO INDIVIDUAL DE TRABAJO', pageWidth / 2, y, { align: 'center' });
  y += 7;

  // 3. Párrafo Introductorio Formal
  const { dia, mes, anho } = formatearFechaEspanol(contrato.fechaInicio);
  const introTexto = `En la Ciudad de ${empresa.ciudad || 'Asunción'}, Capital de la República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anho}, por una parte, la firma ${empresa.razonSocial.toUpperCase()} con domicilio en ${empresa.direccion || 'el domicilio legal de la empresa'}, en adelante denominada EMPLEADOR; y por la otra, el/la Sr./Sra. ${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}, con Cédula de Identidad N° ${empleado.ci}, Sexo ${empleado.sexo === 'F' ? 'Femenino' : 'Masculino'}, Estado civil ${empleado.estadoCivil || 'Soltero/a'}, de nacionalidad ${empleado.nacionalidad || 'paraguaya'}, domiciliado/a en ${empleado.domicilio || 'Asunción, Paraguay'}, en adelante denominada/o EL TRABAJADOR, convienen en celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO bajo las siguientes cláusulas y modalidades:`;

  printParagraph(introTexto, { size: 8.8, spacingAfter: 4 });

  // 4. MODALIDADES
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  ensureSpace(6);
  doc.text('MODALIDADES', margin, y);
  y += 5.5;

  // PRIMERA
  const seccion = contrato.seccionAsignada || empleado.departamento || 'OPERACIONES Y TIENDA';
  printParagraph(
    `PRIMERA: a- Clase de trabajo o servicio a ejecutar: Tareas generales, en las funciones que se le asigne. Actualmente es designado a la sección de ${seccion.toUpperCase()} y le serán asignadas las funciones de acuerdo con la necesidad operativa de la Empresa.\n\nb- Lugar o lugares de prestación: En el domicilio legal de la Empresa, o en las oficinas o sucursales que tenga habilitado o habilite en el futuro, en Asunción, ciudades circunvecinas o en el interior del país, donde le asigne el Empleador. Si el traslado es a ciudades a más de cincuenta kilómetros de Asunción, se requerirá el acuerdo del Empleado.`,
    { size: 8.7 }
  );

  // SEGUNDA
  const porUnidadTiempo = contrato.tipoContrato === 'tiempo_parcial' ? 'SI' : 'NO';
  printParagraph(`SEGUNDA: FORMA DE CONTRATO\na- Por unidad de tiempo: ${porUnidadTiempo}`, { size: 8.7 });

  // TERCERA
  const salarioMonto = contrato.salarioPactado || 0;
  const salarioEnLetras = numeroALetrasPY(salarioMonto);
  printParagraph(
    `TERCERA: REMUNERACIÓN CONVENIDA\na- Monto mensual de sueldo básico: Gs. ${formatPYG(salarioMonto)} (${salarioEnLetras.toLowerCase()}).\nEl sistema de pago puede ser modificado de mutuo acuerdo o si la asignación de nuevas funciones lo amerita. De dicha suma se deducirá obligatoriamente el 9% correspondiente al aporte obrero al Seguro Social obligatorio (IPS).`,
    { size: 8.7 }
  );

  // CUARTA
  const esIndefinido = contrato.tipoContrato === 'indefinido' ? 'SI' : 'NO';
  printParagraph(`CUARTA: PLAZO DEL CONTRATO\na- Indefinido: ${esIndefinido}`, { size: 8.7 });

  // Cláusula Especial de Absorción y Reconocimiento de Antigüedad (si aplica)
  if (contrato.absorcionAntiguedad && contrato.absorcionAntiguedad.empresaAnterior) {
    const { empresaAnterior, fechaIngresoAnterior } = contrato.absorcionAntiguedad;
    const clausulaAbsorcion = `Se deja expresa constancia que ${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()} viene de la empresa "${empresaAnterior.toUpperCase()}" en la que tiene acumulada antigüedad desde el ${fechaIngresoAnterior}, y se incorpora a ${empresa.razonSocial.toUpperCase()} con esa antigüedad, antigüedad que ${empresa.razonSocial.toUpperCase()} le reconoce y absorbe.`;
    
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(16, 80, 50); // Verde corporativo
    const absLines = doc.splitTextToSize(clausulaAbsorcion, contentWidth);
    doc.text(absLines, margin, y);
    y += absLines.length * 4.4 + 3.5;
    doc.setTextColor(15, 23, 42);
  }

  // QUINTA
  const horario = `De Lunes a Viernes de ${contrato.horarioInicio || '08:00'} a ${contrato.horarioFin || '18:00'} hs, estos horarios serán modificados según necesidad operativa.`;
  printParagraph(
    `QUINTA: DURACIÓN DE LA JORNADA\na- Diurna: SI\n\nDIVISIÓN DE LA JORNADA:\na- Por la mañana: --------------\nb- Por la tarde: --------------\nc- Por la noche: --------------\nd- Continuado: ${horario}\n\n5.1.- La empresa fijará los horarios de trabajo de acuerdo con la naturaleza de las labores que realizan, con la particularidad de su actividad y de conformidad con las disposiciones legales vigentes, siendo el horario laboral de 48 horas semanales.\n5.2.- El horario podrá ser modificado en función a la época del año y a las necesidades del servicio, así como de los locales al cual fuere destinado.\n5.3.- Las partes acuerdan, que eventualmente el Empleado, puede ser trasladado a diferentes centros de trabajo, conforme las épocas del año, fechas festivas y necesidades del servicio.\n5.4.- El descanso semanal será preferentemente el domingo.\n5.5.- Las partes reconocen y acuerdan, que, por necesidad del servicio, o, de acuerdo a la forma de trabajo en el local asignado al Empleado, el día Domingo podrá ser un día laborable, por lo que su día de descanso será establecido por la Empresa.`,
    { size: 8.7 }
  );

  // SEXTA
  printParagraph(
    `SEXTA: PERIODO ORDINARIO DE PAGO (Sueldo o Salario)\na- Mensual: Cada 30 días.\nb- Fecha: Último día hábil del mes.\nc- Lugar: Local de la Empresa o mediante acreditación bancaria autorizada.`,
    { size: 8.7 }
  );

  // SÉPTIMA
  printParagraph(
    `SÉPTIMA: Según necesidad EL TRABAJADOR podrá realizar viajes dentro del país ya sea comisionado por sus funciones o roles, auditorías, etc. y/o por capacitación, EL EMPLEADOR será responsable de los pagos correspondientes a viáticos u otros gastos que pudiera ocasionarle.`,
    { size: 8.7 }
  );

  // OCTAVA
  printParagraph(
    `OCTAVA: Durante la vigencia del contrato de trabajo entre las partes, e inclusive con posterioridad a su terminación, EL TRABAJADOR se obliga a mantener la más estricta reserva y confidencialidad sobre cualquier información adquirida con motivo o por circunstancias propias del trabajo desempeñado, y a no revelar, divulgar o hacer a terceras personas ninguna información relativa al trabajo que la misma desempeña y que llegue a su conocimiento en forma directa e indirecta, en especial referente a la base de datos de clientes, sus teléfonos y direcciones.\n\n` +
    `8.1.- Está prohibido a la empleada/empleado utilizar los recursos e información de la empresa para provecho personal ni de terceros.\n` +
    `8.2.- El Empleado se compromete a comunicar a la Empresa, por escrito o por telegrama colacionado, el cambio o traslado de su domicilio. Mientras éste no se registre, serán válidas todas las comunicaciones dirigidas al último domicilio denunciado, con todos los efectos legales.\n` +
    `8.3.- Deberá guardar la mayor reserva sobre costos, precios, nómina de clientes, etc. La violación de ésta norma es particularmente grave y podrá ser causal de terminación con justa causa (Art. 81 inc. h del Código del Trabajo).\n` +
    `8.4.- El Empleado se compromete a cumplir todas las normas y pautas que la Empresa vaya dictando para la realización de los trabajos.\n` +
    `8.5.- El Empleado se compromete a cumplir las normas disciplinarias, los horarios de trabajo conforme a su naturaleza especial y acudir con vestimenta pulcra al trabajo. En caso de que la Empresa disponga el uso de uniformes, el mismo será obligatorio.\n` +
    `8.6.- Queda convenido entre las partes, que la Empresa puede efectuar rotaciones de empleados, en horarios y asignaciones, por necesidades del servicio y por política de aprendizaje de diversas funciones de la Empresa.\n` +
    `8.7.- Las partes acuerdan, que, por imagen empresarial y seguridad, los Empleados antes de la salida del lugar de trabajo, podrán ser requeridos a la exhibición de bultos, bolsones, carteras, etc., debiendo acceder a tal requerimiento, pudiendo ser también palpado por persona de su mismo sexo.\n\n` +
    `El incumplimiento de cualquiera de estas obligaciones se considerará falta grave al contrato y autoriza al empleador a dar por terminado el mismo sin responsabilidad alguna de preavisar ni indemnizar.`,
    { size: 8.7 }
  );

  // Cierre y Firmas
  ensureSpace(38);
  printParagraph('Firman en prueba de conformidad en dos ejemplares de un mismo tenor y a un solo efecto.', {
    size: 8.8,
    spacingAfter: 16,
  });

  const firmaY = y;
  const colWidth = (contentWidth - 20) / 2;

  // Firma Trabajador
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(margin, firmaY, margin + colWidth, firmaY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`, margin, firmaY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`C.I. N° ${empleado.ci}`, margin, firmaY + 9.5);
  doc.text('Trabajador/a', margin, firmaY + 14);

  // Firma Empleador
  doc.line(margin + colWidth + 20, firmaY, pageWidth - margin, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(empresa.razonSocial.toUpperCase(), margin + colWidth + 20, firmaY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Representante Legal: ${empresa.representanteLegalNombre || 'Dirección General'}`, margin + colWidth + 20, firmaY + 9.5);
  doc.text(`RUC: ${empresa.ruc}-${empresa.dv}`, margin + colWidth + 20, firmaY + 14);
  doc.text('Empleador', margin + colWidth + 20, firmaY + 18.5);

  return doc;
}
