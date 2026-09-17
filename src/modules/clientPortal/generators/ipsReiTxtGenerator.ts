/**
 * GENERADOR DE ARCHIVOS PLANOS TXT PARA EL SISTEMA REI DEL IPS (PARAGUAY)
 * Formato oficial para presentación y pago de aportes de seguridad social
 * Decreto-Ley N.º 1860/50 y Resoluciones de la Dirección de Aporte Obrero Patronal (AOP - IPS)
 */

import type { ReciboSalario, Empleado, EmpresaCliente } from '../types/clientPortal';
import { getSucursalById } from '../types/clientPortal';

export interface IpsReiTxtOutput {
  fileName: string;
  content: string;
  totalEmpleados: number;
  totalSalariosImponibles: number;
  totalAporteObrero9: number;
  totalAportePatronal165: number;
  totalAporteIps255: number;
}

export interface IpsPrnOutput {
  fileName: string;
  content: string;
  totalEmpleados: number;
  totalSalariosImponibles: number;
  totalAporteObrero9: number;
  totalAportePatronal165: number;
  totalAporteIps255: number;
}

/**
 * Sanitiza textos (apellidos/nombres) para el formato posicional del IPS (.prn)
 * Convierte a mayúsculas y remueve acentos para garantizar compatibilidad ASCII pura
 */
function sanitizeTextoPrn(texto: string, maxLength: number): string {
  if (!texto) return ''.padStart(maxLength, ' ');
  const normalized = texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();
  return normalized.substring(0, maxLength).padStart(maxLength, ' ');
}

/**
 * Genera el archivo plano posicional .PRN oficial aceptado por el sistema de IPS
 * Estructura fija de exactamente 109 caracteres por línea (conforme a "IPS JULIO.prn"):
 * - Pos 0..9    (10): Número patronal IPS relleno con ceros a la izquierda
 * - Pos 10..29  (20): C.I. del trabajador alineado a la derecha con espacios
 * - Pos 30..59  (30): Apellidos del trabajador alineado a la derecha con espacios
 * - Pos 60..89  (30): Nombres del trabajador alineado a la derecha con espacios
 * - Pos 90      (1) : Tipo de cotizante 'E'
 * - Pos 91..92  (2) : Días trabajados alineado a la derecha con espacios (ej. '30', ' 0')
 * - Pos 93..102 (10): Salario imponible IPS en Guaraníes alineado a la derecha con espacios
 * - Pos 103..108 (6): Período: Mes (2 chars con espacio, ej. ' 7') + Año (4 chars)
 */
export function generarIpsPrn(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number
): IpsPrnOutput {
  const empMap = new Map<string, Empleado>();
  empleados.forEach(e => empMap.set(e.id, e));

  const mesStr = String(mes).padStart(2, ' ');
  const anhoStr = String(anho);
  const periodo6 = `${mesStr}${anhoStr}`;

  let totalSalariosImponibles = 0;
  let totalAporteObrero9 = 0;
  let totalAportePatronal165 = 0;
  let totalAporteIps255 = 0;

  const lineas: string[] = [];

  for (const r of recibos) {
    const emp = empMap.get(r.empleadoId);
    if (!emp) continue;

    const baseImponible = Math.round(
      (r.salarioDevengado || 0) +
      (r.horasExtras50Monto || 0) +
      (r.horasExtras100Monto || 0) +
      (r.comisionesPremios || 0)
    );
    const obrero9 = Math.round(baseImponible * 0.09);
    const patronal165 = Math.round(baseImponible * 0.165);
    const total255 = obrero9 + patronal165;

    totalSalariosImponibles += baseImponible;
    totalAporteObrero9 += obrero9;
    totalAportePatronal165 += patronal165;
    totalAporteIps255 += total255;

    // Resuelve patronal IPS de la sucursal del empleado si tiene patronal propia asignada
    const suc = getSucursalById(empresa, emp.sucursalId);
    const patronalDigits = (suc?.nroPatronalIps || empresa.nroPatronalIps || '0004612819').replace(/\D/g, '');
    const empPatronal10 = (patronalDigits || '0004612819').padStart(10, '0').slice(-10);

    const ciLimpia = emp.ci.replace(/\D/g, '').padStart(20, ' ').substring(0, 20);
    const apellidos = sanitizeTextoPrn(emp.apellidos, 30);
    const nombres = sanitizeTextoPrn(emp.nombres, 30);
    const tipo = 'E';
    const dias = String(Math.min(Math.max(r.diasTrabajados ?? 30, 0), 30)).padStart(2, ' ');
    const salario = String(baseImponible).padStart(10, ' ');

    const linea = `${empPatronal10}${ciLimpia}${apellidos}${nombres}${tipo}${dias}${salario}${periodo6}`;
    lineas.push(linea);
  }

  const content = lineas.join('\r\n');
  const meses = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];
  const mesNombre = meses[mes - 1] || 'PERIODO';
  const fileName = `IPS_${mesNombre}_${anho}.prn`;

  return {
    fileName,
    content,
    totalEmpleados: recibos.length,
    totalSalariosImponibles,
    totalAporteObrero9,
    totalAportePatronal165,
    totalAporteIps255,
  };
}

/**
 * Genera el archivo plano TXT con la estructura de Sueldos y Jornales para importar al Sistema REI del IPS
 */
export function generarIpsReiTxt(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number
): IpsReiTxtOutput {
  const empMap = new Map<string, Empleado>();
  empleados.forEach(e => empMap.set(e.id, e));

  const periodoStr = `${anho}${String(mes).padStart(2, '0')}`;
  const rucLimpio = empresa.ruc.replace(/\D/g, '');
  const patronalIps = (empresa.nroPatronalIps || '000000').replace(/[^a-zA-Z0-9]/g, '');

  let totalSalariosImponibles = 0;
  let totalAporteObrero9 = 0;
  let totalAportePatronal165 = 0;
  let totalAporteIps255 = 0;

  const lineasDetalle: string[] = [];

  for (const r of recibos) {
    const emp = empMap.get(r.empleadoId);
    if (!emp) continue;

    // Base imponible según IPS: Salario devengado + horas extras + comisiones (excluye bonificación familiar)
    const baseImponible = r.salarioDevengado + r.horasExtras50Monto + r.horasExtras100Monto + r.comisionesPremios;
    const obrero9 = Math.round(baseImponible * 0.09);
    const patronal165 = Math.round(baseImponible * 0.165);
    const total255 = obrero9 + patronal165;

    totalSalariosImponibles += baseImponible;
    totalAporteObrero9 += obrero9;
    totalAportePatronal165 += patronal165;
    totalAporteIps255 += total255;

    const ciLimpia = emp.ci.replace(/\D/g, '');
    const nombres = emp.nombres.trim().toUpperCase().padEnd(30, ' ').substring(0, 30);
    const apellidos = emp.apellidos.trim().toUpperCase().padEnd(30, ' ').substring(0, 30);
    const dias = String(Math.min(r.diasTrabajados, 30)).padStart(2, '0');
    const salarioStr = String(baseImponible).padStart(12, '0');
    const obreroStr = String(obrero9).padStart(10, '0');
    const patronalStr = String(patronal165).padStart(10, '0');
    const totalAporteStr = String(total255).padStart(10, '0');

    // Registro Tipo 2: Detalle de Cotizante
    // Formato delimitado por Pipe '|' estándar REI y posicional compatible
    const linea = `2|CI|${ciLimpia.padEnd(12, ' ')}|${apellidos}|${nombres}|${dias}|${salarioStr}|${obreroStr}|${patronalStr}|${totalAporteStr}|ACTIVO`;
    lineasDetalle.push(linea);
  }

  // Registro Tipo 1: Cabecera Patronal
  const cabecera = `1|IPS-REI|${rucLimpio}|${empresa.dv}|${patronalIps}|${periodoStr}|${String(recibos.length).padStart(6, '0')}|${String(totalSalariosImponibles).padStart(14, '0')}|${String(totalAporteIps255).padStart(14, '0')}`;

  // Registro Tipo 3: Pie de Control y Hash
  const pie = `3|CONTROL|${periodoStr}|TOTAL_COTIZANTES:${recibos.length}|APORTE_OBRERO:${totalAporteObrero9}|APORTE_PATRONAL:${totalAportePatronal165}|TOTAL_APORTE:${totalAporteIps255}|FIN`;

  const content = [cabecera, ...lineasDetalle, pie].join('\r\n');
  const fileName = `IPS_REI_${rucLimpio}_${periodoStr}.txt`;

  return {
    fileName,
    content,
    totalEmpleados: recibos.length,
    totalSalariosImponibles,
    totalAporteObrero9,
    totalAportePatronal165,
    totalAporteIps255,
  };
}

/**
 * Genera archivo plano CSV/TXT para pago de salarios por acreditación bancaria (Itaú, BNF, Continental, etc.)
 */
export function generarArchivoAcreditacionBancaria(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number
): { fileName: string; content: string } {
  const empMap = new Map<string, Empleado>();
  empleados.forEach(e => empMap.set(e.id, e));

  const periodoStr = `${anho}${String(mes).padStart(2, '0')}`;
  const rucLimpio = empresa.ruc.replace(/\D/g, '');

  const lineas: string[] = [
    `RUC_EMPRESA;RAZON_SOCIAL;PERIODO;TIPO_DOC;CI_EMPLEADO;BENEFICIARIO;CARGO;SALARIO_NETO_PYG;CONCEPTO`,
  ];

  for (const r of recibos) {
    const emp = empMap.get(r.empleadoId);
    if (!emp) continue;

    lineas.push(
      `${rucLimpio};${empresa.razonSocial};${periodoStr};CI;${emp.ci.replace(/\D/g, '')};${emp.apellidos} ${emp.nombres};${emp.cargo};${r.salarioNeto};SALARIO_${periodoStr}`
    );
  }

  return {
    fileName: `NOMINA_BANCO_${rucLimpio}_${periodoStr}.csv`,
    content: lineas.join('\r\n'),
  };
}

/**
 * Descarga en el navegador un archivo de texto o binario
 */
export function descargarArchivoTexto(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
