/**
 * BUILDERS PUROS DE ARCHIVOS PLANOS DEL IPS — PARAGUAY
 * Decreto-Ley N.º 1860/50, Art. 76 (aportes obrero-patronales).
 *
 * Este módulo no hace I/O, no depende del DOM ni de React: solo transforma
 * cotizantes y planillas ya liquidados en los archivos que acepta el IPS.
 *
 * Formatos:
 *  - 121 columnas posicional (.txt): formato primario, verificado contra un
 *    archivo real aceptado por el IPS de 373 registros.
 *  - 109 columnas posicional (.prn): formato histórico.
 *  - Delimitado por pipe "|" (.txt) para el sistema REI.
 */

import type {
  CotizanteIPS,
  ConfiguracionLiquidacionIPS,
  PlanillaPatronalIPS,
  ResultadoLiquidacionIPS,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de formato
// ─────────────────────────────────────────────────────────────────────────────

export const ANCHO_LINEA_121 = 121;
export const ANCHO_LINEA_109 = 109;

/** Separador de línea exacto; el archivo termina siempre con este par. */
const SEPARADOR_LINEA = '\r\n';
/** Categoría fija de empleado dependiente en el layout del IPS. */
const CATEGORIA_EMPLEADO = 'E';
/** Código de actividad usado cuando la configuración trae el campo vacío. */
const CODIGO_ACTIVIDAD_POR_DEFECTO = '00';
/** Nombres de mes en mayúsculas y sin acentos para los nombres de archivo. */
const NOMBRES_MES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Deja exactamente 10 dígitos; lanza si tras limpiar no los tiene. */
function normalizarPatronalIPS(valor: string): string {
  const digitos = soloDigitos(valor);
  if (digitos.length !== 10) {
    throw new Error(`Número patronal inválido: "${valor}" (se esperaban 10 dígitos, se obtuvieron ${digitos.length})`);
  }
  return digitos;
}

/**
 * La C.I. es identificador, no nombre: se admite alfanumérica (extranjeros).
 * Una C.I. vacía se conserva vacía (el motor de reglas ya la bloquea).
 */
function normalizarCiIPS(valor: string): string {
  const limpio = valor.trim().toUpperCase();
  if (limpio.length > 0 && !/^[A-Z0-9]+$/.test(limpio)) {
    throw new Error(`C.I. inválida: "${valor}" (solo se admiten letras A-Z y dígitos)`);
  }
  return limpio;
}

/** Exige longitud exacta 2; el vacío se resuelve con el código por defecto. */
function normalizarCodigoActividad(valor: string): string {
  const limpio = valor.trim().toUpperCase();
  if (limpio.length === 0) return CODIGO_ACTIVIDAD_POR_DEFECTO;
  if (limpio.length !== 2) {
    throw new Error(`Código de actividad inválido: "${valor}" (se esperaban exactamente 2 caracteres)`);
  }
  return limpio;
}

function rellenarDerecha(texto: string, ancho: number): string {
  return texto.padEnd(ancho, ' ');
}

function rellenarIzquierda(texto: string, ancho: number): string {
  return texto.padStart(ancho, ' ');
}

/** Entero no negativo rellenado con ceros a la izquierda. Nunca recorta. */
function numeroConCeros(valor: number, ancho: number): string {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`Se esperaba un entero no negativo en un campo numérico, se recibió ${String(valor)}`);
  }
  const texto = String(valor);
  if (texto.length > ancho) {
    throw new Error(`El número ${texto} no cabe en un campo de ${ancho} caracteres`);
  }
  return texto.padStart(ancho, '0');
}

/** Entero no negativo alineado a la derecha con espacios. Nunca recorta. */
function numeroAlineado(valor: number, ancho: number): string {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`Se esperaba un entero no negativo en un campo numérico, se recibió ${String(valor)}`);
  }
  const texto = String(valor);
  if (texto.length > ancho) {
    throw new Error(`El número ${texto} no cabe en un campo de ${ancho} caracteres`);
  }
  return texto.padStart(ancho, ' ');
}

function verificarLargo(linea: string, ancho: number, ci: string): void {
  if (linea.length !== ancho) {
    throw new Error(`Línea IPS con largo inválido para C.I. "${ci}": se esperaban ${ancho} caracteres, se obtuvieron ${linea.length}`);
  }
}

function unirLineas(lineas: string[]): string {
  if (lineas.length === 0) return '';
  return `${lineas.join(SEPARADOR_LINEA)}${SEPARADOR_LINEA}`;
}

/** Período del layout 121: mes con cero a la izquierda + año, ej. "082026". */
function periodoMMAAAA(config: ConfiguracionLiquidacionIPS): string {
  return `${String(config.mes).padStart(2, '0')}${String(config.anho).padStart(4, '0')}`;
}

/** Período AAAAMM para REI y nombres de archivo, ej. "202608". */
function periodoAAAAMM(config: ConfiguracionLiquidacionIPS): string {
  return `${String(config.anho).padStart(4, '0')}${String(config.mes).padStart(2, '0')}`;
}

/**
 * Período del layout 109: mes alineado a la derecha en 2 posiciones + año de 4 dígitos.
 * Agosto queda como `" 82026"` y diciembre como `"122026"`: el campo mide 6 siempre.
 */
function periodo109(config: ConfiguracionLiquidacionIPS): string {
  const mes = String(config.mes).padStart(2, ' ');
  const anho = String(config.anho).padStart(4, '0');
  const periodo = `${mes}${anho}`;
  if (periodo.length !== 6) {
    throw new Error(
      `Período inválido para el formato 109: mes ${String(config.mes)}, año ${String(config.anho)} (se obtuvieron ${periodo.length} caracteres)`,
    );
  }
  return periodo;
}

function nombreMes(mes: number): string {
  return NOMBRES_MES[mes - 1] ?? 'PERIODO';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitización de texto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza apellidos/nombres al set ASCII que admite el IPS.
 * Si el resultado supera el ancho permitido LANZA: truncar en silencio es la
 * causa real de rechazo del lote. Un texto más corto nunca lanza, solo se rellena.
 */
export function sanitizarTextoIPS(texto: string, ancho: number): string {
  const limpio = texto
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '');
  if (limpio.length > ancho) {
    throw new Error(`sanitizarTextoIPS: el texto "${texto}" excede el ancho de ${ancho} caracteres (largo obtenido: ${limpio.length})`);
  }
  return limpio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout posicional de 121 columnas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye una línea del layout primario de 121 caracteres.
 * Offsets: patronal(0,10) · nro asegurado vacío(10,10) · C.I.(20,10 izq) ·
 * apellidos(30,30 izq) · nombres(60,30 izq) · categoría(90,1) · días(91,2 der) ·
 * salario imponible(93,10 der) · período MMAAAA(103,6) · actividad(109,2) ·
 * salario real(111,10 der).
 */
export function construirLinea121(cotizante: CotizanteIPS, config: ConfiguracionLiquidacionIPS): string {
  const ci = normalizarCiIPS(cotizante.ci);
  const salario = numeroAlineado(cotizante.baseImponible, 10);
  const linea =
    normalizarPatronalIPS(cotizante.numeroPatronal) +
    ' '.repeat(10) +
    rellenarDerecha(ci, 10) +
    rellenarDerecha(sanitizarTextoIPS(cotizante.apellidos, 30), 30) +
    rellenarDerecha(sanitizarTextoIPS(cotizante.nombres, 30), 30) +
    CATEGORIA_EMPLEADO +
    numeroAlineado(cotizante.dias, 2) +
    salario +
    periodoMMAAAA(config) +
    normalizarCodigoActividad(config.codigoActividad) +
    salario;
  verificarLargo(linea, ANCHO_LINEA_121, ci);
  return linea;
}

/** Une todas las líneas de 121 columnas de una planilla patronal. */
export function construirArchivo121(planilla: PlanillaPatronalIPS, config: ConfiguracionLiquidacionIPS): string {
  return unirLineas(planilla.cotizantes.map((cotizante) => construirLinea121(cotizante, config)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout posicional de 109 columnas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye una línea del layout histórico de 109 caracteres.
 * Offsets: patronal(0,10) · C.I.(10,20 der) · apellidos(30,30 der) ·
 * nombres(60,30 der) · categoría(90,1) · días(91,2 der) ·
 * salario imponible(93,10 der) · período(103,6).
 */
export function construirLinea109(cotizante: CotizanteIPS, config: ConfiguracionLiquidacionIPS): string {
  const ci = normalizarCiIPS(cotizante.ci);
  const linea =
    normalizarPatronalIPS(cotizante.numeroPatronal) +
    rellenarIzquierda(ci, 20) +
    rellenarIzquierda(sanitizarTextoIPS(cotizante.apellidos, 30), 30) +
    rellenarIzquierda(sanitizarTextoIPS(cotizante.nombres, 30), 30) +
    CATEGORIA_EMPLEADO +
    numeroAlineado(cotizante.dias, 2) +
    numeroAlineado(cotizante.baseImponible, 10) +
    periodo109(config);
  verificarLargo(linea, ANCHO_LINEA_109, ci);
  return linea;
}

/** Une todas las líneas de 109 columnas de una planilla patronal. */
export function construirArchivo109(planilla: PlanillaPatronalIPS, config: ConfiguracionLiquidacionIPS): string {
  return unirLineas(planilla.cotizantes.map((cotizante) => construirLinea109(cotizante, config)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato delimitado por pipe (REI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emite un bloque REI (cabecera tipo 1 + detalle tipo 2 + pie tipo 3) por cada
 * planilla del resultado, en su orden original. Sin planillas devuelve ''.
 * El ancho de C.I. en este formato es 12, no 20.
 */
export function construirArchivoREI(resultado: ResultadoLiquidacionIPS, config: ConfiguracionLiquidacionIPS): string {
  if (resultado.planillas.length === 0) return '';
  const ruc = soloDigitos(config.ruc);
  const periodo = periodoAAAAMM(config);
  const lineas: string[] = [];
  for (const planilla of resultado.planillas) {
    const patronal = normalizarPatronalIPS(planilla.numeroPatronal);
    const cantidad = planilla.cotizantes.length;
    lineas.push(
      `1|IPS-REI|${ruc}|${config.dv}|${patronal}|${periodo}|${numeroConCeros(cantidad, 6)}|${numeroConCeros(planilla.totales.baseImponible, 14)}|${numeroConCeros(planilla.totales.aporteTotal, 14)}`
    );
    for (const cotizante of planilla.cotizantes) {
      const ci = rellenarDerecha(normalizarCiIPS(cotizante.ci), 12);
      const apellidos = rellenarDerecha(sanitizarTextoIPS(cotizante.apellidos, 30), 30);
      const nombres = rellenarDerecha(sanitizarTextoIPS(cotizante.nombres, 30), 30);
      lineas.push(
        `2|CI|${ci}|${apellidos}|${nombres}|${numeroConCeros(cotizante.dias, 2)}|${numeroConCeros(cotizante.baseImponible, 12)}|${numeroConCeros(cotizante.aporteObrero, 10)}|${numeroConCeros(cotizante.aportePatronal, 10)}|${numeroConCeros(cotizante.aporteTotal, 10)}|ACTIVO`
      );
    }
    lineas.push(
      `3|CONTROL|${periodo}|TOTAL_COTIZANTES:${cantidad}|APORTE_OBRERO:${planilla.totales.aporteObrero}|APORTE_PATRONAL:${planilla.totales.aportePatronal}|TOTAL_APORTE:${planilla.totales.aporteTotal}|FIN`
    );
  }
  return unirLineas(lineas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de bytes, diagnóstico y nombres de archivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte texto a bytes Latin-1 byte a byte (no UTF-8).
 * Lanza si algún carácter cae fuera de 0x00..0xFF.
 */
export function aBytesLatin1(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const codePoint = texto.charCodeAt(i);
    if (codePoint > 0xff) {
      throw new Error(`aBytesLatin1: el carácter "${texto.charAt(i)}" (U+${codePoint.toString(16).toUpperCase()}) está fuera del rango Latin-1`);
    }
    bytes[i] = codePoint;
  }
  return bytes;
}

/**
 * Diagnóstico sobre un archivo ya generado: recorre las líneas separadas por
 * '\r\n' (ignora la última si está vacía) y devuelve las mal medidas con su
 * número de línea base 1. No lanza.
 */
export function validarAnchos(texto: string, anchoEsperado: number): { linea: number; largo: number }[] {
  const lineas = texto.split(SEPARADOR_LINEA);
  const ultimo = lineas.length - 1;
  const limite = ultimo >= 0 && lineas[ultimo] === '' ? ultimo : lineas.length;
  const problemas: { linea: number; largo: number }[] = [];
  for (let i = 0; i < limite; i += 1) {
    const largo = lineas[i].length;
    if (largo !== anchoEsperado) {
      problemas.push({ linea: i + 1, largo });
    }
  }
  return problemas;
}

/** Nombre del archivo posicional de 121 columnas: IPS_{MES}_{ANHO}.txt */
export function nombreArchivo121(config: ConfiguracionLiquidacionIPS): string {
  return `IPS_${nombreMes(config.mes)}_${config.anho}.txt`;
}

/** Nombre del archivo posicional de 109 columnas: IPS_{MES}_{ANHO}.prn */
export function nombreArchivo109(config: ConfiguracionLiquidacionIPS): string {
  return `IPS_${nombreMes(config.mes)}_${config.anho}.prn`;
}

/** Nombre del archivo REI: IPS_REI_{RUC}_{AAAAMM}.txt */
export function nombreArchivoREI(config: ConfiguracionLiquidacionIPS): string {
  return `IPS_REI_${soloDigitos(config.ruc)}_${periodoAAAAMM(config)}.txt`;
}
