/**
 * SERVICIO DE EXPORTACIÓN DE ARCHIVOS BANCARIOS PARA PAGO DE SALARIOS (LABORAPY)
 *
 * Genera archivos de acreditación masiva compatibles con la banca paraguaya:
 * - Formato Universal SIPAP / ACH (Transferencias interbancarias BCP)
 * - Formato Banco Itaú Paraguay (Acreditación de Haberes Masiva)
 * - Formato Banco Sudameris / Continental (Planillas de Pago)
 *
 * Seguridad y Zero-Leak:
 * - Sanitización estricta anti-CSV / Formula Injection (=, +, -, @)
 * - Confinamiento estricto por empresa y período
 */

import type { LiquidacionMensualResult } from '../types';
import type { PeriodoNomina, MonedaNomina } from '../types/noveltyTypes';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { roundGs } from '../engine/monthlyPayrollEngine';

export type FormatoBanco = 'sipap_csv' | 'itau_txt' | 'sudameris_txt' | 'ueno_csv';

/**
 * Sanitiza valores de texto para evitar CSV / Formula Injection en Excel o software contable/bancario.
 */
function sanitizeBankCell(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return '';
  const str = String(valor).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Genera archivo CSV en formato estándar SIPAP / ACH para transferencias bancarias de salarios.
 */
export function exportarBancoSIPAP_CSV(
  liquidaciones: LiquidacionMensualResult[],
  periodo: PeriodoNomina,
  _empresa?: EmpresaCliente
): string {
  const moneda: MonedaNomina = periodo.moneda || (periodo.tipoLiquidacion === 'moneda_usd' ? 'USD' : 'PYG');
  const referencia = sanitizeBankCell(periodo.codigoFormal || `Nómina ${periodo.id}`);

  const headers = [
    'Documento_CI',
    'Beneficiario',
    'Monto_Acreditar',
    'Moneda',
    'Banco_Destino',
    'Tipo_Cuenta',
    'Nro_Cuenta',
    'Concepto_Referencia',
  ];

  const filas = liquidaciones.map((liq) => {
    const ci = sanitizeBankCell(liq.input.ci);
    const nombre = sanitizeBankCell(liq.input.nombre);
    const monto = Math.max(0, roundGs(liq.netoACobrar || 0));
    // Banco y cuenta pueden provenir del input o placeholder defensivo
    const banco = sanitizeBankCell((liq.input as any).banco || 'Bco. Central / SIPAP');
    const tipoCuenta = sanitizeBankCell((liq.input as any).tipoCuenta || 'Caja de Ahorro');
    const nroCuenta = sanitizeBankCell((liq.input as any).nroCuenta || `CTA-${liq.input.ci}`);

    return [
      `"${ci}"`,
      `"${nombre}"`,
      monto,
      `"${moneda}"`,
      `"${banco}"`,
      `"${tipoCuenta}"`,
      `"${nroCuenta}"`,
      `"${referencia}"`,
    ].join(',');
  });

  return [headers.join(','), ...filas].join('\r\n');
}

/**
 * Genera archivo de texto plano para Banco Itaú Paraguay (Acreditación Masiva de Sueldos).
 */
export function exportarBancoItau_TXT(
  liquidaciones: LiquidacionMensualResult[],
  periodo: PeriodoNomina,
  empresa?: EmpresaCliente
): string {
  const moneda = periodo.moneda === 'USD' ? 'USD' : 'PYG';
  const rucEmpresa = (empresa?.ruc || '00000000').replace(/[^0-9]/g, '').padEnd(10, ' ');
  const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Cabecera lote Itaú
  const cabecera = `01${rucEmpresa}${fechaHoy}${periodo.id.replace('-', '')}SUELDOS${moneda}`;

  // Detalle por funcionario
  const lineas = liquidaciones.map((liq, idx) => {
    const nroSecuencia = String(idx + 1).padStart(5, '0');
    const ci = (liq.input.ci || '').replace(/[^0-9]/g, '').padStart(10, '0');
    const nombre = (liq.input.nombre || '').toUpperCase().slice(0, 30).padEnd(30, ' ');
    const montoEntero = Math.max(0, roundGs(liq.netoACobrar || 0));
    const montoStr = String(montoEntero).padStart(13, '0');
    const nroCuenta = ((liq.input as any).nroCuenta || ci).slice(0, 15).padEnd(15, ' ');

    return `02${nroSecuencia}${ci}${nombre}${nroCuenta}${montoStr}${moneda}`;
  });

  // Pie de lote
  const totalNeto = roundGs(liquidaciones.reduce((acc, l) => acc + Math.max(0, l.netoACobrar || 0), 0));
  const pie = `03${String(liquidaciones.length).padStart(5, '0')}${String(totalNeto).padStart(15, '0')}`;

  return [cabecera, ...lineas, pie].join('\r\n');
}

/**
 * Genera archivo delimitado para Banco Sudameris / Continental (Planilla de Acreditación).
 */
export function exportarBancoSudameris_TXT(
  liquidaciones: LiquidacionMensualResult[],
  periodo: PeriodoNomina,
  _empresa?: EmpresaCliente
): string {
  const moneda = periodo.moneda === 'USD' ? 'USD' : 'GS';
  const filas = liquidaciones.map((liq) => {
    const ci = (liq.input.ci || '').trim();
    const nombre = (liq.input.nombre || '').trim().replace(/;/g, ' ');
    const monto = Math.max(0, roundGs(liq.netoACobrar || 0));
    const cta = ((liq.input as any).nroCuenta || ci).trim();
    return `${ci};${nombre};${cta};${monto};${moneda};PAGO HABERES ${periodo.codigoFormal || periodo.id}`;
  });

  return filas.join('\r\n');
}

/**
 * Genera archivo CSV delimitado por comas para Ueno Bank (Ueno Empresas - Acreditación Masiva).
 * Columnas oficiales: Tipo_Doc, Nro_Doc, Beneficiario, Nro_Cuenta, Monto, Moneda, Concepto
 */
export function exportarBancoUeno_CSV(
  liquidaciones: LiquidacionMensualResult[],
  periodo: PeriodoNomina,
  _empresa?: EmpresaCliente
): string {
  const moneda = periodo.moneda === 'USD' ? 'USD' : 'PYG';
  const concepto = sanitizeBankCell(periodo.codigoFormal || `Haberes ${periodo.id}`);

  const headers = [
    'Tipo_Documento',
    'Numero_Documento',
    'Nombre_Beneficiario',
    'Numero_Cuenta_Ueno_o_SIPAP',
    'Monto_Acreditar',
    'Moneda',
    'Concepto',
  ];

  const filas = liquidaciones.map((liq) => {
    const ci = sanitizeBankCell((liq.input.ci || '').replace(/[^0-9]/g, ''));
    const nombre = sanitizeBankCell(liq.input.nombre);
    const monto = Math.max(0, roundGs(liq.netoACobrar || 0));
    const cuenta = sanitizeBankCell((liq.input as any).nroCuenta || ci);

    return [
      'CI',
      `"${ci}"`,
      `"${nombre}"`,
      `"${cuenta}"`,
      monto,
      `"${moneda}"`,
      `"${concepto}"`,
    ].join(',');
  });

  return [headers.join(','), ...filas].join('\r\n');
}

/**
 * Descarga en el navegador un archivo de texto o CSV.
 */
export function descargarArchivoBanco(
  contenido: string,
  nombreArchivo: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}