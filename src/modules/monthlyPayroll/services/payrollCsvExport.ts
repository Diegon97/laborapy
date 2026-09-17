/**
 * EXPORTACIÓN CSV DEL CIERRE DE NÓMINA MENSUAL (ERP LABORAPY)
 *
 * Centraliza la descarga de archivos CSV compatibles con Excel (BOM UTF-8,
 * separador ';') para la planilla editable y el archivo de acreditación bancaria.
 */

import type { EmpleadoNominaInput, LiquidacionMensualResult, GridColumnDef } from '../types';
import { sanitizeExcelFormula } from '../../../lib/crypto';
import { evaluateFormula } from '../engine/safeFormulaEvaluator';

/**
 * Descarga un CSV compatible con Excel: BOM UTF-8, separador ';' y salto CRLF.
 * Libera la URL del objeto temporal una vez disparada la descarga.
 */
export function descargarCSV(nombreArchivo: string, headers: string[], rows: string[]): void {
  const sanitizedHeaders = headers.map((h) => sanitizeExcelFormula(h));
  const csvContent = '\uFEFF' + [sanitizedHeaders.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta la planilla editable del período. Si se especifican columnasVisibles,
 * exporta exactamente esas columnas (incluyendo las personalizadas y fórmulas).
 * Archivo: Planilla_Editable_<periodo>.csv
 */
export function exportNominaCSV(
  empleados: EmpleadoNominaInput[],
  liquidaciones: LiquidacionMensualResult[],
  periodoKey: string,
  columnasVisibles?: GridColumnDef[],
): void {
  if (columnasVisibles && columnasVisibles.length > 0) {
    const cols = columnasVisibles.filter((c) => c.id !== 'acciones');
    const headers = cols.map((c) => c.label);

    const rows = liquidaciones.map((l, idx) => {
      const emp = empleados[idx] ?? l.input;

      // Diccionario combinado de valores de la fila para resolver referencias
      const rowContext: Record<string, any> = {
        nro: idx + 1,
        ci: emp.ci,
        funcionario: emp.nombre,
        nombre: emp.nombre,
        cargo: emp.cargo || '',
        tipo: emp.tipo === 'factura' ? 'Prestador Factura' : 'Cotizante IPS',
        diasVacaciones: emp.diasVacaciones || 0,
        diasReposo: emp.diasReposo || 0,
        diasAusencias: emp.diasAusencias || 0,
        diasTrabajados: l.diasTrabajadosEfectivos,
        salarioFijo: emp.salarioFijo || 0,
        adicionalCargo: emp.adicionalCargo || 0,
        cantHoras50: emp.cantHoras50 || 0,
        cantHoras130: emp.cantHoras130 || 0,
        cantHoras100: emp.cantHoras100 || 0,
        cantHorasNocturnas: emp.cantHorasNocturnas || 0,
        cantidadHijos: emp.cantidadHijos || 0,
        refrigerioTraslado: emp.refrigerioTraslado || 0,
        totalHaberes: l.haberes.totalHaberesBrutos,
        imponibleIps: emp.tipo === 'factura' ? 0 : l.haberesImponiblesIps,
        ipsObrero: emp.tipo === 'factura' ? 0 : l.descuentos.aporteObreroIps,
        embargosJudiciales: emp.embargosJudiciales || 0,
        seguroMedicoPrivado: emp.seguroMedicoPrivado || 0,
        anticipoSalario: emp.anticipoSalario || 0,
        prestamosEmpresa: emp.prestamosEmpresa || 0,
        faltanteCaja: emp.faltanteCaja || 0,
        faltanteMercaderia: emp.faltanteMercaderia || 0,
        telefonoNotebook: emp.telefonoNotebook || 0,
        compraCreditoEmpresa: emp.compraCreditoEmpresa || 0,
        otrosDescuentos: emp.otrosDescuentos || 0,
        totalDescuentos: l.descuentos.totalDescuentos,
        netoACobrar: l.netoACobrar,
        ...(emp.customFields || {}),
      };

      const cellValues = cols.map((col) => {
        let val: any = '';

        if (col.id === 'nro') val = idx + 1;
        else if (col.id === 'ci') val = emp.ci;
        else if (col.id === 'nombre') val = emp.nombre;
        else if (col.id === 'cargo') val = emp.cargo || '';
        else if (col.id === 'tipo') val = emp.tipo === 'factura' ? 'Prestador Factura' : 'Cotizante IPS';
        else if (col.id === 'diasTrabajados') val = l.diasTrabajadosEfectivos;
        else if (col.id === 'totalHaberes') val = l.haberes.totalHaberesBrutos;
        else if (col.id === 'imponibleIps') val = emp.tipo === 'factura' ? 0 : l.haberesImponiblesIps;
        else if (col.id === 'ipsObrero') val = emp.tipo === 'factura' ? 0 : l.descuentos.aporteObreroIps;
        else if (col.id === 'totalDescuentos') val = l.descuentos.totalDescuentos;
        else if (col.id === 'netoACobrar') val = l.netoACobrar;
        else if (col.type === 'formula' && col.formula) {
          val = evaluateFormula(col.formula, rowContext);
        } else if (col.isCustom) {
          val = emp.customFields?.[col.id] ?? '';
        } else {
          val = (emp as any)[col.id] ?? 0;
        }

        const str = typeof val === 'number' ? String(val) : String(val ?? '');
        return `"${sanitizeExcelFormula(str).replace(/"/g, '""')}"`;
      });

      return cellValues.join(';');
    });

    descargarCSV(`Planilla_Editable_${periodoKey}.csv`, headers, rows);
    return;
  }

  // Fallback con las 31 columnas estándar
  const headers = [
    'Nro',
    'CI',
    'Funcionario',
    'Cargo',
    'Tipo',
    'Dias Vacaciones',
    'Dias Reposo',
    'Dias Ausencias',
    'Dias Trabajados',
    'Salario Fijo',
    'Adicional Cargo',
    'Horas 50%',
    'Horas 130%',
    'Horas 100%',
    'Horas Nocturnas',
    'Hijos',
    'Refrigerio Traslado',
    'Total Haberes',
    'Imponible IPS',
    'IPS Obrero 9%',
    'Embargos Judiciales',
    'Seguro Medico',
    'Anticipo Salario',
    'Prestamos Empresa',
    'Faltante Caja',
    'Faltante Mercaderia',
    'Telefono Notebook',
    'Compra Credito Empresa',
    'Otros Descuentos',
    'Total Descuentos',
    'Neto a Cobrar',
  ];
  const rows = liquidaciones.map((l, idx) => {
    const i = empleados[idx] ?? l.input;
    return [
      idx + 1,
      `"${sanitizeExcelFormula(i.ci)}"`,
      `"${sanitizeExcelFormula(i.nombre)}"`,
      `"${sanitizeExcelFormula(i.cargo || '')}"`,
      `"${i.tipo === 'factura' ? 'Prestador Factura' : 'Cotizante IPS'}"`,
      i.diasVacaciones || 0,
      i.diasReposo || 0,
      i.diasAusencias || 0,
      l.diasTrabajadosEfectivos,
      i.salarioFijo,
      i.adicionalCargo || 0,
      i.cantHoras50 || 0,
      i.cantHoras130 || 0,
      i.cantHoras100 || 0,
      i.cantHorasNocturnas || 0,
      i.cantidadHijos || 0,
      i.refrigerioTraslado || 0,
      l.haberes.totalHaberesBrutos,
      l.haberesImponiblesIps,
      l.descuentos.aporteObreroIps,
      i.embargosJudiciales || 0,
      i.seguroMedicoPrivado || 0,
      i.anticipoSalario || 0,
      i.prestamosEmpresa || 0,
      i.faltanteCaja || 0,
      i.faltanteMercaderia || 0,
      i.telefonoNotebook || 0,
      i.compraCreditoEmpresa || 0,
      i.otrosDescuentos || 0,
      l.descuentos.totalDescuentos,
      l.netoACobrar,
    ].join(';');
  });
  descargarCSV(`Planilla_Editable_${periodoKey}.csv`, headers, rows);
}

/**
 * Exporta el formato estándar de acreditación bancaria (Sudameris / Itaú / Continental):
 * tipo doc, CI solo dígitos, beneficiario, importe y concepto fijo de pago salarial.
 */
export function exportBankCSV(liquidaciones: LiquidacionMensualResult[]): void {
  const headers = ['Tipo Doc', 'Nro Documento', 'Beneficiario', 'Importe Guaranies', 'Concepto'];
  const rows = liquidaciones.map((l) =>
    [
      'CI',
      l.input.ci.replace(/\D/g, ''),
      `"${l.input.nombre}"`,
      l.netoACobrar,
      `"PAGO SALARIO MENSUAL"`,
    ].join(';'),
  );
  descargarCSV('Acreditacion_Bancaria_Salarios.csv', headers, rows);
}
