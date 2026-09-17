/**
 * CONVERSOR DE NÚMERO A LETRAS EN GUARANÍES — Paraguay
 * Versión: PY-LIQ-2026.09.01
 *
 * Convierte montos enteros en Guaraníes a su expresión en letras mayúsculas.
 * Ejemplo: 39_428_440 → "TREINTA Y NUEVE MILLONES CUATROCIENTOS VEINTIOCHO MIL CUATROCIENTOS CUARENTA"
 *
 * Formato del PDF de Liquidación Final de Haberes:
 * "SON GUARANIES: [monto en letras]"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tablas de palabras
// ─────────────────────────────────────────────────────────────────────────────

const UNIDADES = [
  '',
  'UN',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
];

const DECENAS = [
  '',
  'DIEZ',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function convertirCentenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const centena = Math.floor(n / 100);
  const resto = n % 100;

  let resultado = centena > 0 ? CENTENAS[centena] : '';

  if (resto > 0) {
    if (resultado) resultado += ' ';
    resultado += convertirDecenas(resto);
  }

  return resultado;
}

function convertirDecenas(n: number): string {
  if (n < 20) return UNIDADES[n];

  const decena = Math.floor(n / 10);
  const unidad = n % 10;

  if (unidad === 0) return DECENAS[decena];

  return `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
}

function convertirMiles(n: number): string {
  if (n === 0) return '';
  if (n === 1) return 'MIL';

  const miles = Math.floor(n / 1000);
  const resto = n % 1000;

  let resultado = '';

  if (miles > 0) {
    resultado = convertirCentenas(miles);
    resultado += ' MIL';
  }

  if (resto > 0) {
    resultado += ' ' + convertirCentenas(resto);
  }

  return resultado.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un monto entero en Guaraníes a su representación en letras.
 *
 * @param monto Monto en Guaraníes (entero positivo)
 * @returns Cadena en mayúsculas, por ejemplo:
 *          "SON GUARANIES: TREINTA Y NUEVE MILLONES CUATROCIENTOS..."
 */
export function numeroALetrasGuaranies(monto: number): string {
  if (!isFinite(monto) || isNaN(monto)) return 'SON GUARANIES: MONTO INVÁLIDO';
  if (monto < 0) return 'SON GUARANIES: MONTO NEGATIVO';

  const n = Math.round(monto);

  if (n === 0) return 'SON GUARANIES: CERO';

  let resultado = '';

  // Billones (hasta 999.999.999.999)
  const billones = Math.floor(n / 1_000_000_000);
  if (billones > 0) {
    resultado += convertirCentenas(billones);
    resultado += billones === 1 ? ' MIL MILLONES' : ' MIL MILLONES';
  }

  // Millones
  const millones = Math.floor((n % 1_000_000_000) / 1_000_000);
  if (millones > 0) {
    if (resultado) resultado += ' ';
    resultado += convertirCentenas(millones);
    resultado += millones === 1 ? ' MILLÓN' : ' MILLONES';
  }

  // Miles y unidades
  const resto = n % 1_000_000;
  if (resto > 0) {
    if (resultado) resultado += ' ';
    resultado += convertirMiles(resto);
  }

  return `SON GUARANIES: ${resultado.trim()}`;
}

/**
 * Solo el número en letras sin el prefijo "SON GUARANIES:"
 */
export function soloLetras(monto: number): string {
  const completo = numeroALetrasGuaranies(monto);
  return completo.replace('SON GUARANIES: ', '');
}
