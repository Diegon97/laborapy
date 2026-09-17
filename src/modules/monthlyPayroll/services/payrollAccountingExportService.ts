/**
 * SERVICIO DE EXPORTACIÓN Y ADAPTADORES ERP PARA ASIENTOS CONTABLES (LABORAPY)
 *
 * Formatos soportados:
 *  1. Odoo ERP (CSV estructurado para importación de account.move y account.move.line)
 *  2. SAP Business One / S/4HANA (Data Transfer Workbench - DTW Journal Entry CSV)
 *  3. Formato Contable Universal (CSV / TSV para Excel y software contable paraguayo)
 *  4. JSON estructurado para inyección directa vía Webhooks / REST APIs
 *
 * Ciberseguridad: Sanitización estricta anti-CSV Injection (RFC 4180 + escape de fórmulas).
 */

import type { AsientoContableGeneral } from '../types/accountingTypes';

/**
 * Sanitiza celdas para prevenir ataques de inyección en hojas de cálculo (CSV Injection).
 * Si la cadena comienza con caracteres de control de fórmulas (=, +, -, @, \t, \r),
 * antepone un apóstrofe (') y escapa comillas dobles según RFC 4180.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';

  let str = String(value);

  // Prevenir inyección de fórmulas de Excel/Sheets
  if (/^[\s]*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escapar comillas dobles duplicándolas
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Genera archivo CSV estructurado para importación directa en Odoo Accounting.
 * Compatible con Odoo v14 a v18 (modelo account.move / account.move.line).
 */
export function exportarAsientoOdooCSV(asiento: AsientoContableGeneral): string {
  const headers = [
    'ref',
    'date',
    'journal_id',
    'line_ids/account_id/code',
    'line_ids/name',
    'line_ids/debit',
    'line_ids/credit',
  ];

  const rows: string[][] = [];

  asiento.lineas.forEach((linea) => {
    rows.push([
      asiento.id,
      asiento.fechaAsiento,
      'Sueldos / Salarios', // Diario de sueldos Odoo
      linea.codigoCuenta,
      linea.concepto,
      linea.debe.toString(),
      linea.haber.toString(),
    ]);
  });

  const csvContent = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ].join('\r\n');

  return `\uFEFF${csvContent}`; // BOM UTF-8 para compatibilidad Excel
}

/**
 * Genera archivo CSV para SAP Business One (Data Transfer Workbench - JournalEntries).
 */
export function exportarAsientoSapCSV(asiento: AsientoContableGeneral): string {
  const headers = [
    'RecordKey',
    'LineNum',
    'AccountCode',
    'Debit',
    'Credit',
    'LineMemo',
    'ReferenceDate',
    'DueDate',
    'TaxDate',
  ];

  const rows: string[][] = [];

  asiento.lineas.forEach((linea, idx) => {
    rows.push([
      '1', // RecordKey de la transacción
      idx.toString(),
      linea.codigoCuenta,
      linea.debe.toString(),
      linea.haber.toString(),
      linea.concepto,
      asiento.fechaAsiento.replace(/-/g, ''), // YYYYMMDD para SAP
      asiento.fechaAsiento.replace(/-/g, ''),
      asiento.fechaAsiento.replace(/-/g, ''),
    ]);
  });

  const csvContent = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ].join('\r\n');

  return `\uFEFF${csvContent}`;
}

/**
 * Genera archivo CSV en Formato Universal Contable (legible por contadores paraguayos y cualquier ERP).
 */
export function exportarAsientoUniversalCSV(asiento: AsientoContableGeneral): string {
  const headers = [
    'Nro Linea',
    'Fecha',
    'Periodo',
    'Codigo Cuenta',
    'Nombre Cuenta',
    'Concepto / Glosa',
    'Debe (PYG)',
    'Haber (PYG)',
  ];

  const rows: string[][] = [];

  asiento.lineas.forEach((l) => {
    rows.push([
      l.numeroLinea.toString(),
      asiento.fechaAsiento,
      asiento.periodo,
      l.codigoCuenta,
      l.nombreCuenta,
      l.concepto,
      l.debe.toString(),
      l.haber.toString(),
    ]);
  });

  // Fila de totales de control
  rows.push([
    '',
    '',
    '',
    '',
    'SUMAS IGUALES',
    asiento.estaCuadrado ? 'ASIENTO CUADRADO' : `DESBALANCE: ${asiento.diferencia} Gs.`,
    asiento.totalDebe.toString(),
    asiento.totalHaber.toString(),
  ]);

  const csvContent = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ].join('\r\n');

  return `\uFEFF${csvContent}`;
}

/**
 * Formatea el asiento contable en TSV (valores separados por tabulador)
 * listo para copiar y pegar directamente en Microsoft Excel o Google Sheets.
 */
export function formatearAsientoParaClipboard(asiento: AsientoContableGeneral): string {
  const headers = [
    'N° Línea',
    'Código Cuenta',
    'Nombre Cuenta',
    'Glosa / Concepto',
    'Debe (Gs.)',
    'Haber (Gs.)',
  ];

  const lines = [headers.join('\t')];

  asiento.lineas.forEach((l) => {
    lines.push(
      [
        l.numeroLinea,
        l.codigoCuenta,
        l.nombreCuenta,
        l.concepto,
        l.debe,
        l.haber,
      ].join('\t'),
    );
  });

  lines.push(['', '', 'SUMAS IGUALES', asiento.estaCuadrado ? 'CUADRADO' : 'DESCUADRADO', asiento.totalDebe, asiento.totalHaber].join('\t'));

  return lines.join('\n');
}

/**
 * Exporta el asiento como JSON estructurado para inyección vía API/Webhook
 */
export function exportarAsientoJSON(asiento: AsientoContableGeneral): string {
  return JSON.stringify(asiento, null, 2);
}

/**
 * Descarga un archivo en el navegador del usuario
 */
export function descargarArchivoContable(
  contenido: string,
  nombreArchivo: string,
  mimeType = 'text/csv;charset=utf-8;',
): void {
  if (typeof window === 'undefined' || !window.document) return;

  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', nombreArchivo);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
