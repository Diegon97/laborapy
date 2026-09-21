/**
 * TIPOS DE INGESTA IPS — LIQUIDACIÓN PARAGUAY
 *
 * Capa pura: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Las firmas de contenido que clasifican cada fuente provienen del protocolo universal de
 * liquidación IPS (Decreto-Ley N.º 1860/50, Art. 76): los archivos se reconocen por lo que
 * CONTIENEN (encabezados, cuentas contables, rótulos, frases bancarias). La clasificación
 * NUNCA usa el nombre del archivo como señal.
 *
 * Este archivo contiene únicamente declaraciones de tipo.
 */

import type { SeveridadAlerta } from '../types';

/** Tipo de fuente del árbol de descubrimiento del protocolo de liquidación IPS. */
export type TipoFuente =
  | 'A' // Nómina mensual de todo el personal
  | 'B' // Variables: comisiones, horas extras, incentivos
  | 'C' // Acreditación bancaria (control de pagos reales)
  | 'D' // Contabilidad / target de base imponible (objetivo de conciliación)
  | 'E'; // Finiquito / liquidación final

/**
 * Tabla cruda extraída de un origen, normalizada a texto: encabezados detectados y filas de
 * datos alineadas posicionalmente con esos encabezados.
 */
export interface Tabla {
  /** Ruta o nombre del archivo de origen, tal como lo informó el usuario. */
  origen: string;
  /** Nombre de la hoja o sección cuando el origen tiene más de una. */
  hoja?: string;
  /** Títulos de columna detectados, en su orden original. */
  encabezados: string[];
  /** Filas de datos alineadas posicionalmente con `encabezados`. */
  filas: string[][];
}

/** Resultado de clasificar una tabla contra las firmas de contenido. */
export interface FuenteClasificada {
  /** Tabla cruda que se clasificó. */
  tabla: Tabla;
  /** Uno o más tipos: un archivo puede ser Tipo A y contener además datos de Tipo B. */
  tipos: TipoFuente[];
  /** Tokens concretos que dispararon cada tipo, para que la decisión sea auditable. */
  firmaDetectada: string[];
  /** `'alta'` = un solo tipo; `'media'` = dos o más (tabla mixta) o ninguno. */
  confianza: 'alta' | 'media';
}

/** Inventario completo de las fuentes descubiertas en un período. */
export interface InventarioFuentes {
  /** Todas las fuentes clasificadas, en el orden en que se descubrieron. */
  todas: FuenteClasificada[];
  /** Fuentes agrupadas por tipo; hay siempre una entrada por cada `TipoFuente`. */
  porTipo: Record<TipoFuente, FuenteClasificada[]>;
  /** Tipos que el protocolo considera críticos y que no aparecieron en el lote. */
  faltantesCriticos: TipoFuente[];
}

/**
 * Códigos estables de alerta de la capa de ingesta.
 * No reordenar ni renombrar: los consumen la UI y las pruebas.
 */
export type CodigoAlertaIngesta =
  | 'FUENTE_NO_CLASIFICADA'
  | 'FUENTE_CRITICA_AUSENTE'
  | 'SIN_ENCABEZADOS'
  | 'COLUMNA_NO_ENCONTRADA'
  | 'MONTO_INPARSEABLE'
  | 'FILA_SIN_CI'
  | 'CI_DUPLICADA_ENTRE_FUENTES'
  | 'CI_NO_ENCONTRADA_EN_BANCO'
  | 'DIFERENCIA_CONTRA_TARGET'
  | 'SIN_FUENTES';

/** Alerta de la capa de ingesta. Reutiliza la severidad del módulo IPS. */
export interface AlertaIngesta {
  codigo: CodigoAlertaIngesta;
  severidad: SeveridadAlerta;
  mensaje: string;
  /** Archivo o tabla que originó la alerta, cuando aplica. */
  origen?: string;
  /** C.I. afectada, cuando la alerta es por persona. */
  ci?: string;
}
