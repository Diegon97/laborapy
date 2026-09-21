/**
 * ARITMÉTICA EXACTA EN GUARANÍES — LIQUIDACIÓN IPS
 *
 * Regla de redondeo: ROUND_HALF_UP al guaraní entero, aplicado UNA SOLA VEZ por
 * persona (un redondeo para el aporte obrero y otro para el patronal; jamás sobre
 * la base ni sobre el 25,5 %). Prohibido ROUND_HALF_EVEN, `Math.round` y `toFixed`
 * sobre productos de dinero.
 *
 * Todo producto por una tasa se hace en `bigint` para no perder exactitud con
 * flotantes. Sin dependencias externas (nada de decimal.js).
 *
 * Base legal: Decreto-Ley N.º 1860/50, Art. 76.
 */

/** Denominador de las tasas por mil del IPS (9 % → 90 por mil; 16,5 % → 165 por mil). */
const DENOMINADOR_POR_MIL = 1000n;

/** Máximo entero representable sin pérdida en un `number`. */
const MAXIMO_SEGURO = Number.MAX_SAFE_INTEGER;

/**
 * Valida y devuelve un importe en guaraníes enteros.
 * Lanza si el valor no es finito, si no es entero o si excede el rango seguro de Number.
 */
export function aGs(valor: number): number {
  if (!Number.isFinite(valor)) {
    throw new Error(
      `Importe en guaraníes inválido: se esperaba un número finito y se recibió ${String(valor)}.`,
    );
  }
  if (!Number.isInteger(valor)) {
    throw new Error(
      `Importe en guaraníes inválido: se esperaba un entero de guaraníes y se recibió ${String(valor)}. Redondee antes de llamar a aGs().`,
    );
  }
  if (Math.abs(valor) > MAXIMO_SEGURO) {
    throw new Error(
      `Importe en guaraníes fuera de rango seguro: ${String(valor)} excede Number.MAX_SAFE_INTEGER.`,
    );
  }
  return valor;
}

/**
 * División entera con desempate `.5` alejándose de cero (ROUND_HALF_UP con signo).
 * Opera sobre valores absolutos y reaplica el signo al final.
 */
export function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  if (denominador === 0n) {
    throw new Error('División por cero en aritmética de guaraníes');
  }

  const negativo = numerador < 0n !== denominador < 0n;
  const absolutoNumerador = numerador < 0n ? -numerador : numerador;
  const absolutoDenominador = denominador < 0n ? -denominador : denominador;

  let cociente = absolutoNumerador / absolutoDenominador;
  const resto = absolutoNumerador % absolutoDenominador;

  // Desempate exacto en .5: se aleja de cero (half-up).
  if (2n * resto >= absolutoDenominador) {
    cociente += 1n;
  }

  return negativo ? -cociente : cociente;
}

/**
 * Aplica una tasa expresada en enteros por mil (90 = 9 %, 165 = 16,5 %)
 * sobre una base en guaraníes, con un único redondeo half-up al guaraní.
 */
export function aplicarTasaPorMil(baseGs: number, porMil: number): number {
  if (!Number.isFinite(porMil) || !Number.isInteger(porMil)) {
    throw new Error(
      `Tasa por mil inválida: se esperaba un entero finito (por ejemplo 90 o 165) y se recibió ${String(porMil)}.`,
    );
  }

  const base = aGs(baseGs);
  const producto = BigInt(base) * BigInt(porMil);
  return Number(dividirHalfUp(producto, DENOMINADOR_POR_MIL));
}

/** Suma exacta en guaraníes (acumula en bigint y valida el total una vez). */
export function sumarGs(valores: number[]): number {
  let acumulado = 0n;
  for (const valor of valores) {
    acumulado += BigInt(aGs(valor));
  }
  return aGs(Number(acumulado));
}

/**
 * Convierte un monto entero en dólares a guaraníes con el tipo de cambio
 * (guaraníes enteros por dólar). El producto es exacto en bigint.
 */
export function convertirUsdAPyg(usd: number, tipoCambio: number): number {
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    throw new Error(
      `Tipo de cambio inválido: se esperaba un valor finito mayor a cero y se recibió ${String(tipoCambio)}.`,
    );
  }
  if (!Number.isInteger(tipoCambio)) {
    throw new Error(
      `Tipo de cambio inválido: se esperaban guaraníes enteros por dólar y se recibió ${String(tipoCambio)}.`,
    );
  }
  if (!Number.isFinite(usd)) {
    throw new Error(
      `Monto en dólares inválido: se esperaba un número finito y se recibió ${String(usd)}.`,
    );
  }
  if (!Number.isInteger(usd)) {
    throw new Error(
      `Monto en dólares inválido: se esperaba un entero de dólares y se recibió ${String(usd)}. Exprese los centavos en una unidad entera antes de convertir.`,
    );
  }

  const productoExacto = BigInt(usd) * BigInt(tipoCambio);
  return aGs(Number(dividirHalfUp(productoExacto, 1n)));
}

/**
 * Formatea un importe en guaraníes con separador de miles manual ('.').
 * Prohibido `toLocaleString`: depende del ICU del runtime y rompe el determinismo
 * entre Node y el navegador. Soporta negativos.
 */
export function formatearGs(monto: number): string {
  const gs = aGs(monto);
  const signo = gs < 0 ? '-' : '';
  const digitos = Math.abs(gs).toString(10);

  let agrupado = '';
  for (let indice = digitos.length - 1; indice >= 0; indice -= 1) {
    agrupado = digitos.charAt(indice) + agrupado;
    const posicionDesdeLaDerecha = digitos.length - indice;
    if (posicionDesdeLaDerecha % 3 === 0 && indice > 0) {
      agrupado = '.' + agrupado;
    }
  }

  return signo + agrupado;
}
