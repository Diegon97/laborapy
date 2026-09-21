/**
 * ADAPTADOR DE NÓMINA → MOTOR IPS
 * Capa de dominio pura: sin React, sin DOM, sin I/O y sin dependencias externas.
 *
 * Responsabilidad:
 *  - Traducir las entidades de la aplicación (`EmpresaCliente`, `Empleado`, `ReciboSalario`)
 *    al contrato que consume el motor de liquidación IPS.
 *  - Este archivo NO calcula aportes ni redondeos legales: eso es responsabilidad exclusiva
 *    del motor (`./motor`), que aplica redondeo half-up sobre la base imponible.
 *
 * Normativa de referencia: Decreto-Ley N.º 1860/50 (art. 76) y Ley N.º 213/93.
 */

import type {
  ConceptoEntrada,
  ConfiguracionLiquidacionIPS,
  ConfiguracionPatronalIPS,
  SituacionLaboralIPS,
} from './types';
import type { EmpresaCliente, Empleado, ReciboSalario } from '../clientPortal/types/clientPortal';
import { SALARIO_MINIMO_MENSUAL_2026 } from '../payroll/constants';

/**
 * Devuelve únicamente los dígitos de un texto, descartando cualquier otro carácter
 * (guiones, puntos, barras o espacios).
 */
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Normaliza un número patronal IPS a 10 dígitos.
 *
 * Devuelve la cadena SOLO si el texto limpio tiene exactamente 10 dígitos. En cualquier otro
 * caso devuelve `undefined`: nunca se inventa ni se completa una patronal inválida. Si no hay
 * patronal válida, el motor debe reportar `PATRONAL_INVALIDA`.
 */
function aPatronal10(valor: string | undefined): string | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }
  const digitos = soloDigitos(valor);
  if (digitos.length !== 10) {
    return undefined;
  }
  return digitos.padStart(10, '0');
}

/**
 * Devuelve `valor` si es un número finito; en caso contrario, el valor por defecto.
 * Evita que `undefined` o `NaN` contaminen la configuración legal.
 */
function legible(valor: number | undefined, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto;
}

/**
 * Normaliza la C.I. al formato canónico que exige el motor: ASCII alfanumérico en mayúsculas,
 * sin separadores. La aplicación guarda las cédulas formateadas (ej. `'4.000.000'`) y el motor
 * es deliberadamente estricto para no emitir un identificador inválido al IPS, así que la
 * limpieza le corresponde a este borde, que conoce la convención de origen.
 */
function normalizarCiEmpleado(ci: string): string {
  return ci.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Determina si una fecha ISO `YYYY-MM-DD` cae en el mes/año indicado.
 *
 * Se parsean los dígitos del string (no se usa `new Date`) para no depender de la zona
 * horaria del entorno: `2026-09-30` debe pertenecer a setiembre de 2026 en cualquier máquina.
 */
function esEgresoEnMesAnho(fecha: string, mes: number, anho: number): boolean {
  const digitos = soloDigitos(fecha);
  if (digitos.length < 6) {
    return false;
  }
  const anhoFecha = Number.parseInt(digitos.slice(0, 4), 10);
  const mesFecha = Number.parseInt(digitos.slice(4, 6), 10);
  return anhoFecha === anho && mesFecha === mes;
}

/**
 * Resuelve el número patronal IPS de un empleado, en el orden de prelación exigido:
 *   1. La sucursal asignada presente en la configuración construida (incluye las que comparten
 *      la patronal principal y las que tienen patronal IPS propia).
 *   2. La sucursal secundaria con `usarIpsPrincipal === false` y `nroPatronalIps` válido.
 *   3. La patronal de casa central.
 *   4. Cadena vacía: el motor lo marcará con `PATRONAL_INEXISTENTE`. Nunca se inventa una.
 */
function resolverNumeroPatronal(
  empleado: Empleado,
  patronalPorSucursal: Map<string, string>,
  empresa: EmpresaCliente,
  patronalCasaCentral: string | undefined,
): string {
  const sucursalId = typeof empleado.sucursalId === 'string' ? empleado.sucursalId.trim() : '';

  if (sucursalId !== '') {
    const desdeConfiguracion = patronalPorSucursal.get(sucursalId);
    if (desdeConfiguracion !== undefined) {
      return desdeConfiguracion;
    }

    const sucursales = empresa.patronalesMtessSecundarias ?? [];
    for (const suc of sucursales) {
      if (suc.id === sucursalId && suc.usarIpsPrincipal === false) {
        const patronalSucursal = aPatronal10(suc.nroPatronalIps);
        if (patronalSucursal !== undefined) {
          return patronalSucursal;
        }
      }
    }
  }

  if (patronalCasaCentral !== undefined) {
    return patronalCasaCentral;
  }

  return '';
}

/**
 * Construye la configuración de liquidación IPS a partir de la empresa cliente.
 *
 * Valores por defecto (documentados):
 *  - `salarioMinimoLegal`: `SALARIO_MINIMO_MENSUAL_2026` (3.044.000 Gs.).
 *  - `tasaObreroPorMil`: 90 (9 %).
 *  - `tasaPatronalPorMil`: 165 (16,5 %).
 *  - `toleranciaConciliacionGs`: 0.
 *  - `codigoActividad`: '00'.
 *  - `tipoCambioUsdPyg`: `undefined` cuando no se informa (el motor exigirá FX solo si aparece
 *    un concepto en USD).
 *
 * Patronales generadas:
 *  1. Casa central, si `empresa.nroPatronalIps` es una patronal válida de 10 dígitos.
 *  2. Por cada sucursal secundaria, la resolución por `sucursalId` debe funcionar:
 *     - Con `usarIpsPrincipal !== false`, la sucursal comparte la patronal IPS principal:
 *       NO se agrega un número patronal nuevo, pero SÍ una entrada que replica la patronal de
 *       casa central con el `sucursalId` de la sucursal. Si la patronal principal no es válida,
 *       se omite.
 *     - Con `usarIpsPrincipal === false`, se usa `suc.nroPatronalIps` si es válida.
 *  3. Se deduplica por `(numeroPatronal, sucursalId)` preservando la primera aparición.
 *
 * IMPORTANTE: `PatronalMtessSucursal.id` es el identificador que se usa como `sucursalId` en
 * estas entradas, porque es el mismo valor que `Empleado.sucursalId` referencia.
 *
 * Si no queda ninguna patronal, se devuelve `patronales: []`. Está PROHIBIDO inyectar una
 * patronal por defecto hardcodeada: el motor debe fallar con `PATRONAL_INVALIDA`.
 */
export function construirConfiguracionIPS(
  empresa: EmpresaCliente,
  mes: number,
  anho: number,
  opciones?: {
    salarioMinimoLegal?: number;
    tipoCambioUsdPyg?: number;
    tasaObreroPorMil?: number;
    tasaPatronalPorMil?: number;
    toleranciaConciliacionGs?: number;
  },
): ConfiguracionLiquidacionIPS {
  const {
    salarioMinimoLegal,
    tipoCambioUsdPyg,
    tasaObreroPorMil,
    tasaPatronalPorMil,
    toleranciaConciliacionGs,
  } = opciones ?? {};

  const patronalCasaCentral = aPatronal10(empresa.nroPatronalIps);

  const entradas: ConfiguracionPatronalIPS[] = [];

  // 1. Casa central.
  if (patronalCasaCentral !== undefined) {
    entradas.push({
      numeroPatronal: patronalCasaCentral,
      sucursalId: undefined,
      descripcion: 'Casa central',
    });
  }

  // 2. Sucursales secundarias.
  const sucursales = empresa.patronalesMtessSecundarias ?? [];
  for (const suc of sucursales) {
    if (suc.usarIpsPrincipal !== false) {
      // Comparte la patronal IPS principal: se registra la sucursal con la patronal de casa central.
      if (patronalCasaCentral !== undefined) {
        entradas.push({
          numeroPatronal: patronalCasaCentral,
          sucursalId: suc.id,
          descripcion: suc.sucursalNombre,
        });
      }
    } else {
      const patronalSucursal = aPatronal10(suc.nroPatronalIps);
      if (patronalSucursal !== undefined) {
        entradas.push({
          numeroPatronal: patronalSucursal,
          sucursalId: suc.id,
          descripcion: suc.sucursalNombre,
        });
      }
    }
  }

  // 3. Deduplicación por (numeroPatronal, sucursalId) preservando la primera aparición.
  const clavesVistas = new Set<string>();
  const patronales = entradas.filter((entrada) => {
    const clave = `${entrada.numeroPatronal}|${entrada.sucursalId ?? ''}`;
    if (clavesVistas.has(clave)) {
      return false;
    }
    clavesVistas.add(clave);
    return true;
  });

  return {
    ruc: soloDigitos(empresa.ruc),
    dv: empresa.dv,
    razonSocial: typeof empresa.razonSocial === 'string' ? empresa.razonSocial : '',
    mes,
    anho,
    salarioMinimoLegal: legible(salarioMinimoLegal, SALARIO_MINIMO_MENSUAL_2026),
    tasaObreroPorMil: legible(tasaObreroPorMil, 90),
    tasaPatronalPorMil: legible(tasaPatronalPorMil, 165),
    tipoCambioUsdPyg,
    codigoActividad: '00',
    toleranciaConciliacionGs: legible(toleranciaConciliacionGs, 0),
    patronales,
  };
}

/**
 * Construye las situaciones laborales IPS que consume el motor a partir de los recibos
 * de salario emitidos en el período.
 *
 * Reglas:
 *  - Índice de empleados por `id`. Si un recibo no encuentra su empleado, se descarta
 *    (nunca se inventan datos).
 *  - Solo se incorporan montos mayores a cero. El `Math.round` es saneamiento de la entrada
 *    (los montos pueden llegar con decimales desde el origen) y NO es el cálculo de aportes:
 *    los aportes los calcula el motor con redondeo half-up sobre la base imponible.
 *  - NO se lee `recibo.ipsObrero9` ni ningún otro campo de descuento. Tomar el 9 % ya calculado
 *    por el origen duplicaría la lógica de cálculo y rompería la fuente única de verdad
 *    (el motor es el único que determina la base imponible y los aportes).
 *  - La bonificación familiar queda registrada en el detalle, pero el catálogo la marca como
 *    exenta, por lo que no suma a la base imponible.
 *  - `subsidioAdelantadoPorEmpleador` se informa en cero: el adelanto del subsidio lo declara
 *    quien liquida; el adaptador no lo infiere.
 *  - Función pura: no muta los arrays de entrada.
 */
export function construirSituacionesDesdeRecibos(
  recibos: ReciboSalario[],
  empleados: Empleado[],
  empresa: EmpresaCliente,
): SituacionLaboralIPS[] {
  const primerRecibo = recibos[0];
  if (primerRecibo === undefined) {
    // Sin recibos no hay período que liquidar. La configuración de referencia se arma con el
    // período del primer recibo; a falta de este, se corta de inmediato.
    return [];
  }

  const indiceEmpleados = new Map<string, Empleado>();
  for (const empleado of empleados) {
    indiceEmpleados.set(empleado.id, empleado);
  }

  // La configuración se construye UNA sola vez con el período del primer recibo.
  const configuracion = construirConfiguracionIPS(empresa, primerRecibo.mes, primerRecibo.anho);

  const patronalPorSucursal = new Map<string, string>();
  for (const entrada of configuracion.patronales) {
    if (entrada.sucursalId !== undefined && !patronalPorSucursal.has(entrada.sucursalId)) {
      patronalPorSucursal.set(entrada.sucursalId, entrada.numeroPatronal);
    }
  }

  const patronalCasaCentral = aPatronal10(empresa.nroPatronalIps);

  const situaciones: SituacionLaboralIPS[] = [];

  for (const recibo of recibos) {
    const empleado = indiceEmpleados.get(recibo.empleadoId);
    if (empleado === undefined) {
      continue;
    }

    const conceptos: ConceptoEntrada[] = [];
    const agregarConcepto = (etiqueta: string, monto: number): void => {
      if (typeof monto === 'number' && monto > 0) {
        conceptos.push({ etiqueta, monto: Math.round(monto) });
      }
    };

    agregarConcepto('SALARIO BASE', recibo.salarioDevengado);
    agregarConcepto('HS. EXTRAS AL 50 %', recibo.horasExtras50Monto);
    agregarConcepto('HS. EXTRAS AL 100 %', recibo.horasExtras100Monto);
    agregarConcepto('COMISIONES', recibo.comisionesPremios);
    agregarConcepto('BONIFICACION FAMILIAR', recibo.bonificacionFamiliar);

    const diasReposo = Math.round(recibo.diasReposo ?? 0);
    const montoReposoPagadoPatronal = recibo.montoReposoPagadoPatronal;
    if (
      diasReposo > 0 &&
      typeof montoReposoPagadoPatronal === 'number' &&
      montoReposoPagadoPatronal > 0
    ) {
      agregarConcepto('LICENCIA POR ENFERMEDAD', montoReposoPagadoPatronal);
    }

    const numeroPatronal = resolverNumeroPatronal(
      empleado,
      patronalPorSucursal,
      empresa,
      patronalCasaCentral,
    );

    const tieneRegistroMaternidad =
      empleado.registroMaternidadId !== undefined && empleado.registroMaternidadId !== null;
    const tieneEstadoMaternidad =
      empleado.estadoMaternidad !== undefined && empleado.estadoMaternidad !== null;

    const fechaEgreso = empleado.fechaEgreso;
    let egresoEnPeriodo: { fecha: string; motivo: string } | undefined;
    if (
      typeof fechaEgreso === 'string' &&
      fechaEgreso.length > 0 &&
      esEgresoEnMesAnho(fechaEgreso, recibo.mes, recibo.anho)
    ) {
      egresoEnPeriodo = { fecha: fechaEgreso, motivo: 'Egreso en el período' };
    }

    situaciones.push({
      ci: normalizarCiEmpleado(empleado.ci),
      apellidos: empleado.apellidos,
      nombres: empleado.nombres,
      numeroPatronal,
      vinculo: empleado.modalidadPago === 'factura' ? 'factura' : 'cotizante',
      diasTrabajados: Math.round(recibo.diasTrabajados),
      diasReposo,
      diasVacaciones: 0,
      diasAusencia: 0,
      esReposoMaternidad: tieneRegistroMaternidad || tieneEstadoMaternidad,
      subsidioAdelantadoPorEmpleador: 0,
      coberturaReposoPorcentaje: recibo.coberturaPatronalReposoPorcentaje ?? 0,
      conceptos,
      egresoEnPeriodo,
    });
  }

  return situaciones;
}
