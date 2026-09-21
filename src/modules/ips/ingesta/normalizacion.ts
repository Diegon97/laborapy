/**
 * NORMALIZACIÓN DE VALORES DE INGESTA IPS
 *
 * Capa pura: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Cada ERP exporta con convenciones distintas (punto o coma decimal, símbolos de moneda,
 * C.I. con puntos, encabezados con acentos o abreviaturas). Estas funciones convierten todo
 * eso a una forma canónica y determinista, sin aritmética flotante en el redondeo de dinero.
 *
 * Normativa de referencia: Decreto-Ley N.º 1860/50, Art. 76.
 */

/**
 * Quita los diacríticos de un texto mediante descomposición NFD.
 * Se usa en todas las normalizaciones para no repetir la expresión regular.
 */
const quitarAcentos = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Normaliza un encabezado de columna para poder compararlo entre ERPs distintos.
 *
 * Secuencia: quita acentos, convierte `.` `_` `/` `\` `-` en espacio, descarta todo lo que no
 * sea alfanumérico o espacio, colapsa espacios múltiples, recorta y pasa a mayúsculas.
 *
 * Ejemplos: `'N° de Documento'` → `'N DE DOCUMENTO'`, `'C.I.'` → `'C I'`,
 * `'Salario_Base'` → `'SALARIO BASE'`, `'Hab c/ret'` → `'HAB C RET'`.
 */
export function normalizarEncabezado(valor: string): string {
  return quitarAcentos(valor)
    .replace(/[._/\\-]/g, ' ')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Normaliza una C.I. al formato canónico del IPS: solo ASCII alfanumérico en mayúsculas.
 *
 * Las letras NUNCA se descartan: una C.I. de extranjero como `'1154471A'` se conserva completa.
 * Ejemplos: `'1.234.567'` → `'1234567'`, `'1.154.471-A'` → `'1154471A'`, `''` → `''`.
 */
export function normalizarCi(valor: string): string {
  return valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Normaliza un nombre de persona para poder partirlo en apellidos y nombres o compararlo.
 * Conserva letras, dígitos, espacios, comas y puntos; el saneo estricto para el archivo del
 * IPS lo hace `planilla.ts` al construir la línea.
 */
export function normalizarNombre(valor: string): string {
  return quitarAcentos(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9 ,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cómo se interpreta el separador decimal de un importe. */
type FormatoMonto = {
  /** Dígitos enteros ya limpios, sin separadores. */
  parteEntera: string;
  /** Dígitos decimales ya limpios; cadena vacía si no había decimales. */
  parteDecimal: string;
  /** Signo del importe. */
  negativo: boolean;
};

/**
 * Interpreta el formato numérico de un texto de importe.
 *
 * Regla determinista del separador decimal:
 *  - Si aparecen `.` y `,`, el ÚLTIMO en aparecer es el decimal y el otro es de miles.
 *  - Si un mismo separador aparece más de una vez (ej. `'3.500.000'`), todos son de miles.
 *  - Si aparece un único separador y le siguen exactamente 3 dígitos hasta el final, con al
 *    menos un dígito antes, es de miles (`'1.500'` → 1500); en cualquier otro caso es decimal
 *    (`'1.50'` → 1,50).
 *  - Sin separadores, el texto es un entero.
 *
 * Devuelve `undefined` cuando no hay ningún dígito.
 */
function interpretarMonto(texto: string): FormatoMonto | undefined {
  const limpio = texto.trim();
  if (limpio === '') {
    return undefined;
  }

  // Negativo por paréntesis contable o por signo explícito.
  const negativo =
    (limpio.startsWith('(') && limpio.endsWith(')')) || limpio.startsWith('-');

  const soloSeparadores = limpio.replace(/[^0-9.,]/g, '');
  if (!/\d/.test(soloSeparadores)) {
    return undefined;
  }

  const cantidadPuntos = (soloSeparadores.match(/\./g) ?? []).length;
  const cantidadComas = (soloSeparadores.match(/,/g) ?? []).length;

  let normalizado: string;

  if (cantidadPuntos > 0 && cantidadComas > 0) {
    // Ambos presentes: el último en aparecer es el decimal.
    const ultimoPunto = soloSeparadores.lastIndexOf('.');
    const ultimaComa = soloSeparadores.lastIndexOf(',');
    if (ultimaComa > ultimoPunto) {
      normalizado = soloSeparadores.replace(/\./g, '').replace(',', '.');
    } else {
      normalizado = soloSeparadores.replace(/,/g, '');
    }
  } else if (cantidadPuntos > 1 || cantidadComas > 1) {
    // Varias apariciones del mismo separador: todas son de miles.
    normalizado = soloSeparadores.replace(/[.,]/g, '');
  } else if (cantidadPuntos === 1 || cantidadComas === 1) {
    const posicion = Math.max(soloSeparadores.lastIndexOf('.'), soloSeparadores.lastIndexOf(','));
    const digitosDerecha = soloSeparadores.length - posicion - 1;
    const hayDigitosIzquierda = /\d/.test(soloSeparadores.slice(0, posicion));
    const esMiles = digitosDerecha === 3 && hayDigitosIzquierda;
    normalizado = esMiles
      ? soloSeparadores.replace(/[.,]/g, '')
      : `${soloSeparadores.slice(0, posicion).replace(/[.,]/g, '')}.${soloSeparadores.slice(posicion + 1)}`;
  } else {
    normalizado = soloSeparadores;
  }

  const punto = normalizado.indexOf('.');
  const parteEntera = (punto === -1 ? normalizado : normalizado.slice(0, punto)) || '0';
  const parteDecimal = punto === -1 ? '' : normalizado.slice(punto + 1);

  return { parteEntera, parteDecimal, negativo };
}

/**
 * Redondea a un entero con la regla half-up alejándose de cero, **sin aritmética flotante**:
 * se decide con el primer dígito decimal y se incrementa con `BigInt`.
 */
function redondearPartes(parteEntera: string, parteDecimal: string, negativo: boolean): number {
  const enteros = BigInt(parteEntera === '' ? '0' : parteEntera);
  const primerDecimal = parteDecimal.charAt(0);
  const incrementa = primerDecimal !== '' && Number(primerDecimal) >= 5;
  const resultado = incrementa ? enteros + 1n : enteros;
  const conSigno = negativo ? -resultado : resultado;
  const numero = Number(conSigno);

  if (!Number.isSafeInteger(numero)) {
    throw new Error(
      `Importe fuera del rango entero seguro: "${parteEntera}${parteDecimal === '' ? '' : `.${parteDecimal}`}".`,
    );
  }

  return numero;
}

/**
 * Convierte un texto de monto a un **entero** de guaraníes, o `undefined` si el texto no
 * representa un importe.
 *
 * Ejemplos: `'3.500.000'` → `3500000`, `'3500000'` → `3500000`, `'Gs. 3.500.000'` → `3500000`,
 * `'₲ 3.500.000'` → `3500000`, `'3,500,000.00'` → `3500000`, `'3.500.000,50'` → `3500001`,
 * `'(1.000.000)'` → `-1000000`, `'-1.000.000'` → `-1000000`,
 * `''` | `'-'` | `'N/A'` | `'S/D'` → `undefined`.
 *
 * Prohibido `parseFloat` sobre el texto completo: devolvería 3,5 para `'3.500.000'`.
 */
export function parsearMontoGs(valor: string): number | undefined {
  const interpretado = interpretarMonto(valor);
  if (interpretado === undefined) {
    return undefined;
  }
  return redondearPartes(interpretado.parteEntera, interpretado.parteDecimal, interpretado.negativo);
}

/**
 * Convierte un texto de monto a un **entero de dólares**. Los centavos se redondean con la
 * regla half-up y se descartan, porque el motor IPS exige enteros en los conceptos.
 * Devuelve `undefined` en los mismos casos inválidos que `parsearMontoGs`.
 */
export function parsearMontoUsd(valor: string): number | undefined {
  const interpretado = interpretarMonto(valor);
  if (interpretado === undefined) {
    return undefined;
  }
  return redondearPartes(interpretado.parteEntera, interpretado.parteDecimal, interpretado.negativo);
}

/**
 * Convierte un texto de cantidad (días, unidades) a un entero no negativo.
 * Ejemplos: `'30'` → `30`, `'30,00'` → `30`, `'30.0'` → `30`, `' 30 '` → `30`.
 * Devuelve `undefined` si no hay dígitos o si el valor es negativo.
 */
export function parsearCantidad(valor: string): number | undefined {
  const interpretado = interpretarMonto(valor);
  if (interpretado === undefined || interpretado.negativo) {
    return undefined;
  }
  const cantidad = redondearPartes(interpretado.parteEntera, interpretado.parteDecimal, false);
  return cantidad < 0 ? undefined : cantidad;
}

/** Forma comparable de un encabezado o clave: normalizado y sin espacios internos. */
function claveComparable(valor: string): string {
  return normalizarEncabezado(valor).replace(/\s+/g, '');
}

/**
 * Busca la columna cuyo encabezado corresponde a alguna de las claves.
 *
 * Dos pasadas, en este orden: (1) coincidencia exacta; (2) la clave contenida dentro del
 * encabezado, para que `'SALARIO BASE'` encuentre `'Salario Base Mensual'`. Dentro de cada
 * pasada se recorre de izquierda a derecha y se devuelve la primera coincidencia. La
 * comparación ignora los espacios internos, así `'C.I.'` y `'CI'` coinciden.
 *
 * @returns Índice base 0 de la columna, o `-1` si ninguna clave aparece.
 */
export function buscarColumna(encabezados: string[], claves: string[]): number {
  const clavesComparables = claves.map(claveComparable).filter((clave) => clave !== '');
  if (clavesComparables.length === 0) {
    return -1;
  }

  const encabezadosComparables = encabezados.map(claveComparable);

  for (let indice = 0; indice < encabezadosComparables.length; indice += 1) {
    const encabezado = encabezadosComparables[indice];
    if (encabezado !== '' && clavesComparables.includes(encabezado)) {
      return indice;
    }
  }

  for (let indice = 0; indice < encabezadosComparables.length; indice += 1) {
    const encabezado = encabezadosComparables[indice];
    if (encabezado === '') {
      continue;
    }
    if (clavesComparables.some((clave) => encabezado.includes(clave))) {
      return indice;
    }
  }

  return -1;
}

/**
 * Convierte una celda cruda a string de forma determinista.
 *
 * - `undefined` / `null` → `''`
 * - `number` entero → su representación decimal sin notación científica
 * - `number` no entero → `toFixed(2)`
 * - `Date` → `YYYY-MM-DD` (construido con los getters locales: `toISOString` correría el día
 *   según la zona horaria del equipo)
 * - `boolean` → `'SI'` / `'NO'`
 * - string → tal cual
 * - cualquier otro tipo → `''`
 *
 * Prohibido `toLocaleString`: depende del ICU del runtime y rompería el determinismo.
 */
export function textoDeCelda(valor: unknown): string {
  if (valor === undefined || valor === null) {
    return '';
  }

  if (typeof valor === 'string') {
    return valor;
  }

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      return '';
    }
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
  }

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return '';
    }
    const anho = String(valor.getFullYear()).padStart(4, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anho}-${mes}-${dia}`;
  }

  if (typeof valor === 'boolean') {
    return valor ? 'SI' : 'NO';
  }

  return '';
}
