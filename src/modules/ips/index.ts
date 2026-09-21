/**
 * PUNTO DE ENTRADA PÚBLICO DEL MÓDULO DE LIQUIDACIÓN IPS
 *
 * Reexporta la superficie completa del módulo:
 *  - `./types`: contratos de tipo (solo declaraciones → `export type *`).
 *  - `./aritmetica`: aritmética exacta en guaraníes (redondeo half-up, tasas por mil, FX).
 *  - `./catalogoConceptos`: catálogo canónico de conceptos y su imponibilidad.
 *  - `./casosBorde`: resolución de situaciones laborales especiales.
 *  - `./motor`: motor de liquidación del período.
 *  - `./planilla`: constructores de archivos planos 121 / 109 / REI.
 *  - `./controles`: conciliación de 4 puntos y controles de cierre.
 *  - `./adaptadorNomina`: puente entre la nómina de la aplicación y el motor IPS.
 *  - `./ingesta`: descubrimiento, normalización y consolidación de las fuentes caóticas
 *    (nómina, variables, acreditación bancaria, contabilidad y finiquitos).
 *
 * Los módulos que mezclan valores y tipos se reexportan con `export *`; TypeScript los trata
 * correctamente bajo `verbatimModuleSyntax`.
 *
 * Normativa de referencia: Decreto-Ley N.º 1860/50 y Ley N.º 213/93.
 */

export type * from './types';
export * from './aritmetica';
export * from './catalogoConceptos';
export * from './casosBorde';
export * from './motor';
export * from './planilla';
export * from './controles';
export * from './adaptadorNomina';
export type * from './ingesta/tipos';
export * from './ingesta/normalizacion';
export * from './ingesta/descubrimiento';
export * from './ingesta/consolidacion';
