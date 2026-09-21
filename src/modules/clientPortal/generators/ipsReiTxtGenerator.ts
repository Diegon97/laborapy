/**
 * GENERADOR DE ARCHIVOS PLANOS TXT PARA EL SISTEMA REI DEL IPS (PARAGUAY)
 * Decreto-Ley N.º 1860/50 y Resoluciones de la Dirección de Aporte Obrero Patronal (AOP).
 *
 * IMPORTANTE: este archivo ya NO contiene lógica de cálculo ni layouts posicionales propios.
 * Delega íntegramente en `src/modules/ips`, que es la ÚNICA fuente de verdad de las alícuotas,
 * del redondeo legal y de los anchos de campo. Antes existían acá una segunda implementación de
 * los porcentajes y del formato, y esa duplicación produjo una presentación desincronizada ante
 * el IPS. Se conservan las firmas públicas para no romper a los consumidores existentes.
 */

import type { ReciboSalario, Empleado, EmpresaCliente } from '../types/clientPortal';
import {
  construirConfiguracionIPS,
  construirSituacionesDesdeRecibos,
  construirArchivo109,
  construirArchivoREI,
  liquidarPeriodoIPS,
  nombreArchivo109,
  nombreArchivoREI,
} from '../../ips';
import type { AlertaIPS, ResultadoLiquidacionIPS } from '../../ips';

export interface IpsReiTxtOutput {
  fileName: string;
  content: string;
  totalEmpleados: number;
  totalSalariosImponibles: number;
  totalAporteObrero9: number;
  totalAportePatronal165: number;
  totalAporteIps255: number;
  /** Alertas del motor. Si `aptoParaPresentar` es falso, el archivo NO debe presentarse. */
  alertas: AlertaIPS[];
  /** Falso cuando existe al menos una alerta bloqueante (patronal inválida, C.I. duplicada, etc.). */
  aptoParaPresentar: boolean;
}

export interface IpsPrnOutput {
  fileName: string;
  content: string;
  totalEmpleados: number;
  totalSalariosImponibles: number;
  totalAporteObrero9: number;
  totalAportePatronal165: number;
  totalAporteIps255: number;
  /** Alertas del motor. Si `aptoParaPresentar` es falso, el archivo NO debe presentarse. */
  alertas: AlertaIPS[];
  /** Falso cuando existe al menos una alerta bloqueante (patronal inválida, C.I. duplicada, etc.). */
  aptoParaPresentar: boolean;
}

/**
 * Corre el motor de liquidación IPS para el período indicado.
 *
 * Si la empresa no tiene un número patronal IPS válido de 10 dígitos, el motor devuelve
 * `planillas: []` con una alerta bloqueante `PATRONAL_INVALIDA`: el archivo sale vacío y con
 * el motivo declarado, en lugar de emitirse con una patronal inventada.
 */
function liquidarConMotor(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number,
): { config: ReturnType<typeof construirConfiguracionIPS>; resultado: ResultadoLiquidacionIPS } {
  const config = construirConfiguracionIPS(empresa, mes, anho);
  const situaciones = construirSituacionesDesdeRecibos(recibos, empleados, empresa);
  const resultado = liquidarPeriodoIPS(situaciones, config);
  return { config, resultado };
}

/**
 * Genera el archivo plano posicional .PRN de 109 caracteres por línea aceptado por el IPS.
 *
 * El layout, el redondeo y los totales los define `src/modules/ips/planilla.ts` y `motor.ts`.
 * El archivo termina con el par CRLF, igual que el archivo real aceptado por el IPS.
 */
export function generarIpsPrn(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number,
): IpsPrnOutput {
  const { config, resultado } = liquidarConMotor(recibos, empleados, empresa, mes, anho);

  const content = resultado.planillas
    .map((planilla) => construirArchivo109(planilla, config))
    .join('');

  return {
    fileName: nombreArchivo109(config),
    content,
    totalEmpleados: resultado.totales.cotizantes,
    totalSalariosImponibles: resultado.totales.baseImponible,
    totalAporteObrero9: resultado.totales.aporteObrero,
    totalAportePatronal165: resultado.totales.aportePatronal,
    totalAporteIps255: resultado.totales.aporteTotal,
    alertas: resultado.alertas,
    aptoParaPresentar: resultado.aptoParaPresentar,
  };
}

/**
 * Genera el archivo delimitado por pipe para importar al Sistema REI del IPS.
 * Emite un bloque (cabecera / detalle / control) por cada número patronal involucrado.
 */
export function generarIpsReiTxt(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number,
): IpsReiTxtOutput {
  const { config, resultado } = liquidarConMotor(recibos, empleados, empresa, mes, anho);

  return {
    fileName: nombreArchivoREI(config),
    content: construirArchivoREI(resultado, config),
    totalEmpleados: resultado.totales.cotizantes,
    totalSalariosImponibles: resultado.totales.baseImponible,
    totalAporteObrero9: resultado.totales.aporteObrero,
    totalAportePatronal165: resultado.totales.aportePatronal,
    totalAporteIps255: resultado.totales.aporteTotal,
    alertas: resultado.alertas,
    aptoParaPresentar: resultado.aptoParaPresentar,
  };
}

/**
 * Genera archivo plano CSV/TXT para pago de salarios por acreditación bancaria
 * (Itaú, BNF, Continental, etc.). No forma parte de la liquidación de aportes: queda
 * fuera del alcance del motor IPS.
 */
export function generarArchivoAcreditacionBancaria(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
  mes: number,
  anho: number,
): { fileName: string; content: string } {
  const empMap = new Map<string, Empleado>();
  empleados.forEach((e) => empMap.set(e.id, e));

  const periodoStr = `${anho}${String(mes).padStart(2, '0')}`;
  const rucLimpio = empresa.ruc.replace(/\D/g, '');

  const lineas: string[] = [
    `RUC_EMPRESA;RAZON_SOCIAL;PERIODO;TIPO_DOC;CI_EMPLEADO;BENEFICIARIO;CARGO;SALARIO_NETO_PYG;CONCEPTO`,
  ];

  for (const r of recibos) {
    const emp = empMap.get(r.empleadoId);
    if (!emp) continue;

    lineas.push(
      `${rucLimpio};${empresa.razonSocial};${periodoStr};CI;${emp.ci.replace(/\D/g, '')};${emp.apellidos} ${emp.nombres};${emp.cargo};${r.salarioNeto};SALARIO_${periodoStr}`,
    );
  }

  return {
    fileName: `NOMINA_BANCO_${rucLimpio}_${periodoStr}.csv`,
    content: lineas.join('\r\n'),
  };
}

/**
 * Descarga en el navegador un archivo de texto o binario.
 * Para los archivos del IPS usar `aBytesLatin1` de `src/modules/ips/planilla.ts` y descargar
 * como `application/octet-stream`: el IPS espera latin-1, no UTF-8.
 */
export function descargarArchivoTexto(
  fileName: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
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
