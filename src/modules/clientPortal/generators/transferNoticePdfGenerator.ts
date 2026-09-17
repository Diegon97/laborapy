/**
 * GENERADOR DE NOTA OFICIAL DE TRASLADO DE LUGAR DE TRABAJO (PDF) — PARAGUAY
 * Base Legal: Arts. 67, 72, 73 y 81 de la Ley N.º 213/93 (Código del Trabajo de la República del Paraguay)
 * Garantiza el ejercicio legítimo del Ius Variandi con notificación formal,
 * sin menoscabo moral ni económico y con registro de patronales MTESS e IPS correspondientes.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EmpresaCliente, Empleado } from '../types/clientPortal';

export interface TransferPdfData {
  empresa: EmpresaCliente;
  empleado: Empleado;
  sucursalOrigenLabel: string;
  sucursalDestinoLabel: string;
  lugarTrabajoAnterior: string;
  lugarTrabajoNuevo: string;
  departamentoGeograficoNuevo: string;
  fechaVigencia: string; // YYYY-MM-DD
  motivoTraslado: string;
  compensacionTraslado?: number | string;
  ciudadEmision?: string;
  fechaEmision?: string; // YYYY-MM-DD
  nroPatronalMtessDestino?: string;
  nroPatronalIpsDestino?: string;
}

function formatFechaLarga(fechaISO: string): string {
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
  const d = parseInt(partes[2], 10);
  const m = parseInt(partes[1], 10) - 1;
  const y = partes[0];
  return `${d} de ${meses[m]} de ${y}`;
}

function formatPYGLocal(val: number | string | undefined): string {
  if (!val) return 'Sin asignación extraordinaria';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\D/g, ''));
  if (isNaN(num) || num <= 0) return 'Sin asignación extraordinaria';
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

export function generarNotaTrasladoPDF(datos: TransferPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  let y = 18;

  // ── 1. Membrete Corporativo Oficial ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(datos.empresa.razonSocial.toUpperCase(), marginX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  const infoFiscal = `RUC: ${datos.empresa.ruc}-${datos.empresa.dv} · Domicilio Legal: ${datos.empresa.direccion}`;
  doc.text(infoFiscal, marginX, y);
  y += 4;

  const infoPatronal = `N° Patronal IPS Casa Central: ${datos.empresa.nroPatronalIps || 'N/D'} · N° Patronal MTESS: ${datos.empresa.nroPatronalMtess || 'N/D'}`;
  doc.text(infoPatronal, marginX, y);
  y += 6;

  // Línea divisoria elegante
  doc.setDrawColor(37, 99, 235); // #2563eb
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // ── 2. Título Formal del Documento ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(30, 58, 138); // #1e3a8a
  doc.text('COMUNICACIÓN FORMAL DE TRASLADO DE LUGAR DE TRABAJO', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Conforme a los Arts. 67, 72, 73 y 81 de la Ley N.º 213/93 (Código del Trabajo de la República del Paraguay)', pageWidth / 2, y, { align: 'center' });
  y += 7;

  // Lugar y Fecha de Emisión
  const fechaHoy = datos.fechaEmision || new Date().toISOString().slice(0, 10);
  const ciudadEmision = datos.ciudadEmision || datos.empresa.ciudad || 'Asunción';
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`${ciudadEmision}, ${formatFechaLarga(fechaHoy)}`, pageWidth - marginX, y, { align: 'right' });
  y += 6;

  // ── 3. Datos del Colaborador Notificado ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('I. IDENTIFICACIÓN DEL TRABAJADOR', marginX, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 'auto' },
    },
    body: [
      ['Trabajador / Empleado:', `${datos.empleado.nombres} ${datos.empleado.apellidos}`],
      ['Cédula de Identidad:', `C.I. N.° ${datos.empleado.ci}`],
      ['Cargo / Función:', datos.empleado.cargo],
      ['Área / Departamento:', datos.empleado.departamento],
      ['Fecha de Ingreso:', formatFechaLarga(datos.empleado.fechaIngreso)],
    ],
    margin: { left: marginX, right: marginX },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 4. Cuadro Comparativo del Traslado de Sucursal ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('II. CONDICIONES Y DETALLE DEL TRASLADO', marginX, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Parámetro', 'Situación Origen (Actual)', 'Situación Destino (Nueva)']],
    body: [
      [
        'Sede / Sucursal:',
        datos.sucursalOrigenLabel,
        datos.sucursalDestinoLabel,
      ],
      [
        'Lugar Físico de Trabajo:',
        datos.lugarTrabajoAnterior || 'Establecimiento Principal',
        datos.lugarTrabajoNuevo,
      ],
      [
        'Departamento Geográfico:',
        datos.empleado.departamentoGeografico || 'Central / Capital',
        datos.departamentoGeograficoNuevo,
      ],
      [
        'Patronal MTESS de Asignación:',
        datos.empresa.nroPatronalMtess || 'Principal',
        datos.nroPatronalMtessDestino || datos.empresa.nroPatronalMtess || 'Principal',
      ],
      [
        'Patronal IPS Registrada:',
        datos.empresa.nroPatronalIps || 'Principal',
        datos.nroPatronalIpsDestino || datos.empresa.nroPatronalIps || 'Principal',
      ],
      [
        'Fecha Efectiva del Traslado:',
        '—',
        formatFechaLarga(datos.fechaVigencia),
      ],
      [
        'Compensación / Viático Movilidad:',
        '—',
        formatPYGLocal(datos.compensacionTraslado),
      ],
    ],
    margin: { left: marginX, right: marginX },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 5. Cláusulas Legales (Ius Variandi & Intangibilidad Salarial) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('III. MARCO LEGAL Y GARANTÍAS CONTRACTUALES', marginX, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const clausulas = [
    `1. FUNDAMENTO OPERATIVO: El presente traslado se dispone fundado en razones operativas, organizativas y de mejor servicio de la empresa empleadora, ejerciendo las facultades de dirección y organización reconocidas por el Código del Trabajo. Motivo expuesto: "${datos.motivoTraslado || 'Necesidades operativas del servicio'}"`,
    `2. GARANTÍA DE INTANGIBILIDAD SALARIAL (Art. 81 Ley 213/93): La empleadora garantiza expresamente que el presente traslado no implica disminución alguna en la remuneración, categoría profesional, derechos adquiridos ni antigüedad del colaborador, manteniéndose plenos todos sus beneficios laborales.`,
    `3. COMUNICACIÓN A AUTORIDADES: La empleadora procederá a asentar la asignación del colaborador a la patronal MTESS e IPS de la sucursal de destino en las planillas mensuales reglamentarias y el Libro Laboral REOP correspondiente.`,
    `4. CONSTANCIA DE NOTIFICACIÓN: El trabajador recibe en este acto copia íntegra de la presente comunicación, manifestando con su firma el acuse de recibo formal y su conformidad con los términos pactados.`,
  ];

  clausulas.forEach(clausula => {
    const lines = doc.splitTextToSize(clausula, pageWidth - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 3.6 + 1.5;
  });

  y += 6;

  // ── 6. Bloque de Firmas ──
  // Si queda poco espacio, añadir página
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 25;
  }

  const anchoFirma = 65;
  const colFirma1 = marginX + 10;
  const colFirma2 = pageWidth - marginX - anchoFirma - 10;
  const yLineaFirma = y + 20;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);

  // Firma Empleador
  doc.line(colFirma1, yLineaFirma, colFirma1 + anchoFirma, yLineaFirma);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Por la Empleadora', colFirma1 + anchoFirma / 2, yLineaFirma + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(datos.empresa.representanteLegalNombre || datos.empresa.razonSocial, colFirma1 + anchoFirma / 2, yLineaFirma + 8, { align: 'center' });
  doc.text(`C.I. N.° ${datos.empresa.representanteLegalCi || 'Firma Autorizada'}`, colFirma1 + anchoFirma / 2, yLineaFirma + 12, { align: 'center' });

  // Firma Trabajador
  doc.line(colFirma2, yLineaFirma, colFirma2 + anchoFirma, yLineaFirma);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('El Trabajador (Notificado)', colFirma2 + anchoFirma / 2, yLineaFirma + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${datos.empleado.nombres} ${datos.empleado.apellidos}`, colFirma2 + anchoFirma / 2, yLineaFirma + 8, { align: 'center' });
  doc.text(`C.I. N.° ${datos.empleado.ci}`, colFirma2 + anchoFirma / 2, yLineaFirma + 12, { align: 'center' });

  // Pie de página institucional
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'LaboraPy ERP · Documento emitido con validez legal bajo la normativa laboral de la República del Paraguay',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
}

export function descargarNotaTrasladoPDF(datos: TransferPdfData): void {
  const doc = generarNotaTrasladoPDF(datos);
  const cleanName = `${datos.empleado.apellidos.replace(/\s+/g, '_')}_${datos.empleado.ci}`;
  const fileName = `Nota_Traslado_${cleanName}_${datos.fechaVigencia}.pdf`;
  doc.save(fileName);
}
