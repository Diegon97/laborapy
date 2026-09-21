/**
 * ADAPTADOR DE HOJAS DE CÁLCULO → TABLA DE INGESTA IPS
 *
 * Único punto de la capa de ingesta que conoce un formato de archivo. Convierte un libro de
 * Excel/CSV ya leído a memoria (ArrayBuffer) en las `Tabla` que consume el descubrimiento por
 * firma de contenido.
 *
 * Reutiliza `xlsx`, que ya es dependencia del proyecto: no se agrega nada nuevo.
 *
 * Este adaptador NO clasifica ni interpreta: solo extrae encabezados y filas normalizadas a
 * texto. La decisión de qué es cada fuente vive en `descubrimiento.ts` y se toma por contenido.
 */

import * as XLSX from 'xlsx';
import type { Tabla } from './tipos';
import { textoDeCelda } from './normalizacion';

/** Cantidad máxima de filas iniciales donde se busca la fila de encabezados. */
const FILAS_BUSQUEDA_ENCABEZADO = 10;

/** Cantidad mínima de celdas con texto para considerar que una fila es la de encabezados. */
const MINIMO_CELDAS_ENCABEZADO = 3;

/**
 * Determina si una fila parece ser la fila de encabezados: al menos
 * `MINIMO_CELDAS_ENCABEZADO` celdas con texto no numérico.
 *
 * Se evalúa solo sobre las primeras filas del libro, porque las exportaciones suelen traer
 * títulos, logos o líneas en blanco antes de la tabla real.
 */
function pareceEncabezado(fila: string[]): boolean {
  let celdasConTexto = 0;
  for (const celda of fila) {
    const texto = celda.trim();
    if (texto === '') {
      continue;
    }
    // Un número no es un encabezado.
    if (/^-?[\d.,]+$/.test(texto)) {
      continue;
    }
    celdasConTexto += 1;
  }
  return celdasConTexto >= MINIMO_CELDAS_ENCABEZADO;
}

/**
 * Convierte una matriz cruda de celdas en una `Tabla`, detectando la fila de encabezados y
 * descartando las filas totalmente vacías.
 *
 * @returns `undefined` si no se encontró una fila de encabezados o si no quedó ninguna fila de datos.
 */
function tablaDesdeMatriz(
  matriz: unknown[][],
  origen: string,
  hoja?: string,
): Tabla | undefined {
  const filasTexto = matriz.map((fila) => fila.map(textoDeCelda));

  let indiceEncabezado = -1;
  const limite = Math.min(filasTexto.length, FILAS_BUSQUEDA_ENCABEZADO);
  for (let indice = 0; indice < limite; indice += 1) {
    if (pareceEncabezado(filasTexto[indice])) {
      indiceEncabezado = indice;
      break;
    }
  }

  if (indiceEncabezado === -1) {
    return undefined;
  }

  const encabezados = filasTexto[indiceEncabezado];
  const filas = filasTexto
    .slice(indiceEncabezado + 1)
    .filter((fila) => fila.some((celda) => celda.trim() !== ''));

  if (filas.length === 0) {
    return undefined;
  }

  const tabla: Tabla = { origen, encabezados, filas };
  if (hoja !== undefined) {
    tabla.hoja = hoja;
  }
  return tabla;
}

/**
 * Lee un libro de Excel o CSV desde memoria y devuelve una `Tabla` por cada hoja que tenga
 * encabezados detectables y al menos una fila de datos.
 *
 * Las hojas sin datos no producen tabla: es preferible devolver menos fuentes y que el
 * inventario avise, antes que inventar una tabla vacía.
 */
export function tablasDesdeXlsx(datos: ArrayBuffer, origen: string): Tabla[] {
  const libro = XLSX.read(datos, { type: 'array' });

  const tablas: Tabla[] = [];
  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja];
    if (hoja === undefined) {
      continue;
    }

    const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true,
    });

    const tabla = tablaDesdeMatriz(matriz, origen, nombreHoja);
    if (tabla !== undefined) {
      tablas.push(tabla);
    }
  }

  return tablas;
}
