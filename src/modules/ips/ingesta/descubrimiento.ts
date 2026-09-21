/**
 * DESCUBRIMIENTO DE FUENTES IPS — CLASIFICACIÓN POR FIRMA DE CONTENIDO
 *
 * Capa de dominio pura: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Problema: cada empresa cliente exporta desde un ERP distinto y los nombres de archivo
 * son caóticos, así que NO se puede confiar en el nombre para saber qué es cada planilla.
 * La única señal confiable es la FIRMA DE CONTENIDO: qué columnas y qué valores trae la tabla.
 *
 * Firmas (protocolo IPS §3.1):
 *  - A: nómina mensual (identificación + haberes + líquido o bonificación familiar).
 *  - B: variables/comisiones (comisión + identificación + al menos una celda numérica).
 *  - C: acreditación bancaria (frases de débito/crédito, banco o cuenta).
 *  - D: target de contabilidad (cuenta contable 401xxxx/402xxxx/5xxxxx + rótulo de base imponible).
 *  - E: finiquito/egreso (título de egreso + identificación).
 *
 * Determinismo: misma `Tabla` de entrada → mismo `FuenteClasificada`. La clasificación no muta
 * la entrada y nunca lanza excepciones; ante datos degenerados degrada a `tipos: []` y
 * `confianza: 'media'`.
 *
 * Normativa de referencia: Decreto-Ley N.º 1860/50 y Ley N.º 213/93.
 */

import type {
  AlertaIngesta,
  FuenteClasificada,
  InventarioFuentes,
  Tabla,
  TipoFuente,
} from './tipos';
import { buscarColumna, normalizarEncabezado, textoDeCelda } from './normalizacion';

// ---------------------------------------------------------------------------
// Listas de claves y patrones que definen cada firma (protocolo IPS §3.1)
// ---------------------------------------------------------------------------

/** Columnas que delatan la identificación de la persona en cualquier ERP. */
const CLAVES_IDENTIFICACION: string[] = [
  'C.I.',
  'CI',
  'CEDULA',
  'CEDULA DE IDENTIDAD',
  'DOCUMENTO',
  'N DE DOCUMENTO',
  'NRO DOCUMENTO',
  'RUC',
  'LEGAJO',
  'CODIGO',
  'ID',
];

/** Columnas de haberes/remuneración de una nómina mensual. */
const CLAVES_HABERES: string[] = [
  'SALARIO BASE',
  'HAB C RET',
  'HABERES',
  'TOTAL HABERES',
  'HABS',
  'SUELDO',
  'SUELDO BASICO',
  'JORNAL',
];

/** Columnas del líquido a percibir por el trabajador. */
const CLAVES_LIQUIDO: string[] = [
  'NETO',
  'NETO A PAGAR',
  'A PAGAR',
  'LIQUIDO',
  'TOTAL A PAGAR',
];

/** Columnas de bonificación/asignación familiar. */
const CLAVES_BONIF_FAMILIAR: string[] = [
  'BONIFICACION FAMILIAR',
  'BONIF FAM',
  'ASIGNACION FAMILIAR',
];

/** Columnas de remuneración variable: comisiones, incentivos y premios. */
const CLAVES_COMISION: string[] = [
  'COMISION',
  'COMISIONES',
  'VARIABLE',
  'VENTAS',
  'INCENTIVO',
  'INCENTIVOS',
  'PREMIOS',
  'PREMIO',
];

/** Frases que solo aparecen en una acreditación bancaria o un instructivo de débito. */
const FRASES_BANCARIAS: string[] = [
  'AUTORIZAMOS DEBITAR',
  'N DE DOCUMENTO',
  'N DE CUENTA',
  'DENOMINACION',
  'IMPORTE',
  'ACREDITACION',
  'ITAU',
  'BNF',
  'BANCO CONTINENTAL',
  'SUDAMERIS',
  'BANCO FAMILIAR',
  'VISION BANCO',
  'ATLAS',
  'UENO',
  'BASA',
];

/** Títulos que identifican una liquidación final o un egreso de personal. */
const TITULOS_EGRESO: string[] = [
  'LIQUIDACION FINAL',
  'FINIQUITO',
  'RM1',
  'RM2',
  'EGRESO',
  'BAJA',
  'DESVINCULACION',
];

/** Rótulos que acompañan al target de base imponible de contabilidad. */
const ROTULOS_TARGET: string[] = ['BASE IMPONIBLE', 'IMPONIBLE'];

/** Cuenta contable del libro mayor: 401xxxx / 402xxxx (haberes) o 5xxxxx (egresos). */
const PATRON_CUENTA_CONTABLE = /^(40[12]\d{4}|5\d{5})$/;

/**
 * Tipos de fuente sin los cuales no se puede conciliar ni liquidar.
 *
 * A (nómina), B (variables) y D (target de contabilidad) son obligatorios todos los meses.
 * C (acreditación bancaria) y E (finiquitos) NO son críticos: puede haber períodos sin la
 * acreditación bancaria cargada y meses sin egresos, y su ausencia no impide liquidar.
 */
const TIPOS_CRITICOS: TipoFuente[] = ['A', 'B', 'D'];

/** Descripción legible de cada firma, usada en las alertas de trazabilidad. */
const SIGNIFICADO_TIPO: Record<TipoFuente, string> = {
  A: 'nómina mensual de todo el personal',
  B: 'variables, comisiones y horas extras',
  C: 'acreditación bancaria del líquido',
  D: 'target de base imponible de contabilidad',
  E: 'finiquito o egreso',
};

// ---------------------------------------------------------------------------
// Helpers privados de preparación y detección
// ---------------------------------------------------------------------------

/** Vistas previas precalculadas una sola vez por tabla. */
interface VistasTabla {
  /** Encabezados normalizados en el mismo orden que `tabla.encabezados`. */
  encabezadosNormalizados: string[];
  /** Encabezados + primeras 15 filas, unidos y normalizados; base de las firmas textuales. */
  textoTabla: string;
}

/**
 * Prepara las dos vistas previas de una tabla:
 *  - encabezados normalizados (para buscar columnas);
 *  - `textoTabla`, el encabezado y las primeras 15 filas unidas por espacio y pasadas
 *    por `normalizarEncabezado`, de modo que el texto quede comparable con las frases
 *    y rótulos de las firmas.
 */
function prepararTexto(tabla: Tabla): VistasTabla {
  const encabezadosNormalizados = tabla.encabezados.map(normalizarEncabezado);
  const primerasFilas = tabla.filas.slice(0, 15).flat();
  const bloque = [...tabla.encabezados, ...primerasFilas].join(' ');
  return {
    encabezadosNormalizados,
    textoTabla: normalizarEncabezado(bloque),
  };
}

/** ¿Existe alguna columna que corresponda a alguna de las claves? */
function hayColumna(encabezados: string[], claves: string[]): boolean {
  return buscarColumna(encabezados, claves) !== -1;
}

/**
 * Devuelve el subconjunto de claves efectivamente presentes en los encabezados,
 * respetando el orden de la lista de claves (evidencia concreta de la firma).
 */
function clavesPresentes(encabezados: string[], claves: string[]): string[] {
  return claves.filter((clave) => buscarColumna(encabezados, [clave]) !== -1);
}

/**
 * Firma A — nómina mensual: identificación + haberes + (líquido o bonificación familiar).
 * Devuelve las claves presentes como evidencia; `[]` si no se activa.
 */
function detectarTipoA(encabezados: string[]): string[] {
  if (!hayColumna(encabezados, CLAVES_IDENTIFICACION)) {
    return [];
  }
  if (!hayColumna(encabezados, CLAVES_HABERES)) {
    return [];
  }
  const hayLiquido = hayColumna(encabezados, CLAVES_LIQUIDO);
  const hayBonif = hayColumna(encabezados, CLAVES_BONIF_FAMILIAR);
  if (!hayLiquido && !hayBonif) {
    return [];
  }
  return [
    ...clavesPresentes(encabezados, CLAVES_IDENTIFICACION),
    ...clavesPresentes(encabezados, CLAVES_HABERES),
    ...clavesPresentes(encabezados, CLAVES_LIQUIDO),
    ...clavesPresentes(encabezados, CLAVES_BONIF_FAMILIAR),
  ];
}

/**
 * Firma B — variables: comisión + identificación + al menos una celda con dígito en la
 * columna de comisión. Si no hay columna de comisión, el tipo no puede activarse.
 */
function detectarTipoB(encabezados: string[], filas: string[][]): string[] {
  if (!hayColumna(encabezados, CLAVES_COMISION)) {
    return [];
  }
  if (!hayColumna(encabezados, CLAVES_IDENTIFICACION)) {
    return [];
  }
  const indiceComision = buscarColumna(encabezados, CLAVES_COMISION);
  if (indiceComision === -1) {
    return [];
  }
  const hayMonto = filas.some((fila) => /\d/.test(textoDeCelda(fila[indiceComision])));
  if (!hayMonto) {
    return [];
  }
  return [
    ...clavesPresentes(encabezados, CLAVES_COMISION),
    ...clavesPresentes(encabezados, CLAVES_IDENTIFICACION),
  ];
}

/** Firma C — acreditación bancaria: frases propias de un débito/crédito bancario. */
function detectarTipoC(textoTabla: string): string[] {
  return FRASES_BANCARIAS.filter((frase) => textoTabla.includes(normalizarEncabezado(frase)));
}

/**
 * Firma D — target de contabilidad: alguna celda es una cuenta contable y el texto trae
 * el rótulo de base imponible. Se recorre toda la tabla y se corta en la primera cuenta.
 */
function detectarTipoD(textoTabla: string, filas: string[][]): string[] {
  const tieneRotulo = ROTULOS_TARGET.some((rotulo) =>
    textoTabla.includes(normalizarEncabezado(rotulo)),
  );
  if (!tieneRotulo) {
    return [];
  }
  for (const fila of filas) {
    for (const celda of fila) {
      const texto = textoDeCelda(celda).trim();
      if (PATRON_CUENTA_CONTABLE.test(texto)) {
        return [texto];
      }
    }
  }
  return [];
}

/**
 * ¿El texto menciona la frase como palabra (o palabras) completa(s)?
 *
 * Se usa para los títulos de egreso, que incluyen tokens cortos y genéricos como `BAJA`: una
 * búsqueda por inclusión simple da falsos positivos, porque `BAJA` aparece dentro de
 * `TRABAJADOS` y toda nómina termina clasificándose como finiquito. Con límites de palabra,
 * `DIAS TRABAJADOS` ya no activa la firma de egreso.
 *
 * La frase se normaliza antes de construir la expresión, y la normalización garantiza que solo
 * contenga letras, dígitos y espacios, así que no hay metacaracteres de expresión regular.
 */
function mencionaComoPalabra(textoTabla: string, frase: string): boolean {
  const normalizada = normalizarEncabezado(frase);
  if (normalizada === '') {
    return false;
  }
  return new RegExp(`\\b${normalizada}\\b`).test(textoTabla);
}

/** Firma E — finiquito/egreso: título de egreso + columna de identificación. */
function detectarTipoE(encabezados: string[], textoTabla: string): string[] {
  const titulos = TITULOS_EGRESO.filter((titulo) => mencionaComoPalabra(textoTabla, titulo));
  if (titulos.length === 0) {
    return [];
  }
  if (!hayColumna(encabezados, CLAVES_IDENTIFICACION)) {
    return [];
  }
  return [...titulos, ...clavesPresentes(encabezados, CLAVES_IDENTIFICACION)];
}

/** Objeto `porTipo` con las cinco claves siempre presentes y vacías. */
function crearPorTipoVacio(): Record<TipoFuente, FuenteClasificada[]> {
  return { A: [], B: [], C: [], D: [], E: [] };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Clasifica una tabla por firma de contenido. Nunca usa `tabla.origen` para clasificar.
 *
 * Tabla sin encabezados o sin filas → `tipos: []`, `firmaDetectada: []`, `confianza: 'media'`.
 * `tipos` sale siempre ordenado `['A','B','C','D','E']`; `confianza` es `'alta'` solo cuando
 * se activa exactamente un tipo.
 */
export function clasificarTabla(tabla: Tabla): FuenteClasificada {
  if (tabla.encabezados.length === 0 || tabla.filas.length === 0) {
    return { tabla, tipos: [], firmaDetectada: [], confianza: 'media' };
  }

  const { encabezadosNormalizados, textoTabla } = prepararTexto(tabla);

  const evaluadas: { tipo: TipoFuente; tokens: string[] }[] = [
    { tipo: 'A', tokens: detectarTipoA(encabezadosNormalizados) },
    { tipo: 'B', tokens: detectarTipoB(encabezadosNormalizados, tabla.filas) },
    { tipo: 'C', tokens: detectarTipoC(textoTabla) },
    { tipo: 'D', tokens: detectarTipoD(textoTabla, tabla.filas) },
    { tipo: 'E', tokens: detectarTipoE(encabezadosNormalizados, textoTabla) },
  ];

  const tipos: TipoFuente[] = [];
  const firmaDetectada: string[] = [];
  for (const { tipo, tokens } of evaluadas) {
    if (tokens.length === 0) {
      continue;
    }
    tipos.push(tipo);
    for (const token of tokens) {
      const firma = `${tipo}:${token}`;
      if (!firmaDetectada.includes(firma)) {
        firmaDetectada.push(firma);
      }
    }
  }

  return {
    tabla,
    tipos,
    firmaDetectada,
    confianza: tipos.length === 1 ? 'alta' : 'media',
  };
}

/**
 * Inventaría un lote de tablas: qué firma tiene cada una, qué tipos hay presentes y cuáles
 * faltan. Nunca lanza excepciones; siempre devuelve el inventario completo y la lista de
 * alertas en orden de emisión (sin fuentes, sin encabezados, no clasificadas, críticas ausentes).
 */
export function inventariarFuentes(
  tablas: Tabla[],
): { inventario: InventarioFuentes; alertas: AlertaIngesta[] } {
  const todas = tablas.map(clasificarTabla);

  const porTipo = crearPorTipoVacio();
  for (const fuente of todas) {
    for (const tipo of fuente.tipos) {
      porTipo[tipo].push(fuente);
    }
  }

  // Con cero fuentes no hay nada que conciliar: el inventario queda vacío (incluidos los
  // faltantes críticos, porque la alerta bloqueante de abajo ya expresa la gravedad).
  const faltantesCriticos =
    tablas.length === 0 ? [] : TIPOS_CRITICOS.filter((tipo) => porTipo[tipo].length === 0);

  const inventario: InventarioFuentes = { todas, porTipo, faltantesCriticos };
  const alertas: AlertaIngesta[] = [];

  // 1) Sin fuentes: una sola alerta bloqueante y se corta el análisis.
  if (tablas.length === 0) {
    alertas.push({
      codigo: 'SIN_FUENTES',
      severidad: 'bloqueante',
      mensaje: 'No se recibió ninguna fuente: sin fuentes no hay nada que liquidar.',
    });
    return { inventario, alertas };
  }

  // 2) Fuentes sin encabezados: no se pueden clasificar ni leer sus columnas.
  for (const tabla of tablas) {
    if (tabla.encabezados.length === 0) {
      alertas.push({
        codigo: 'SIN_ENCABEZADOS',
        severidad: 'advertencia',
        mensaje: `La fuente "${tabla.origen}" no tiene encabezados: no se puede clasificar ni leer sus columnas.`,
        origen: tabla.origen,
      });
    }
  }

  // 3) Fuentes con encabezados que no coinciden con ninguna firma conocida.
  for (const fuente of todas) {
    if (fuente.tabla.encabezados.length > 0 && fuente.tipos.length === 0) {
      alertas.push({
        codigo: 'FUENTE_NO_CLASIFICADA',
        severidad: 'advertencia',
        mensaje: `La fuente "${fuente.tabla.origen}" no coincide con ninguna firma conocida: se esperaba nómina, variables, contabilidad, acreditación o finiquito.`,
        origen: fuente.tabla.origen,
      });
    }
  }

  // 4) Faltantes críticos (A, B y D), en ese orden.
  for (const tipo of faltantesCriticos) {
    alertas.push({
      codigo: 'FUENTE_CRITICA_AUSENTE',
      severidad: 'advertencia',
      mensaje: `Falta la fuente crítica ${tipo}: ${SIGNIFICADO_TIPO[tipo]}.`,
    });
  }

  return { inventario, alertas };
}
