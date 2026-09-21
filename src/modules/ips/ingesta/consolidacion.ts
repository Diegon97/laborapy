/**
 * CONSOLIDACIÓN DE UN PERÍODO IPS — CEREBRO DE LA LIQUIDACIÓN
 *
 * Capa de dominio pura: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Toma las fuentes caóticas ya clasificadas por firma de contenido (`descubrimiento.ts`) y
 * produce el paquete completo de liquidación:
 *   1. Las situaciones laborales (una por C.I.) acumuladas desde nómina (A), variables (B),
 *      finiquitos (E) y el target de contabilidad (D).
 *   2. La liquidación del período por medio del motor (`../motor`).
 *   3. La conciliación de 4 puntos y los seis controles de cierre (`../controles`).
 *
 * Reglas duras:
 *  - Nunca lanza por datos de negocio: siempre devuelve un `ResultadoConsolidacion`.
 *  - Determinismo total: sin `Date.now()`, sin `new Date()` sin argumentos y sin `Math.random()`.
 *    La única fecha permitida se deriva de `config` o de una celda de la fuente.
 *  - Nunca se inventa una patronal de 10 dígitos.
 *
 * Normativa de referencia: Decreto-Ley N.º 1860/50, Art. 76 y Ley N.º 213/93.
 */

import type {
  AlertaIngesta,
  CodigoAlertaIngesta,
  FuenteClasificada,
  InventarioFuentes,
  Tabla,
} from './tipos';
import {
  buscarColumna,
  normalizarCi,
  normalizarEncabezado,
  normalizarNombre,
  parsearCantidad,
  parsearMontoGs,
  textoDeCelda,
} from './normalizacion';
import { inventariarFuentes } from './descubrimiento';
import type {
  ConceptoEntrada,
  ConfiguracionLiquidacionIPS,
  ResultadoLiquidacionIPS,
  SeveridadAlerta,
  SituacionLaboralIPS,
} from '../types';
import { liquidarPeriodoIPS } from '../motor';
import { conciliar4Puntos, ejecutarControlesCierre } from '../controles';
import type { HallazgoControl, ResultadoConciliacion } from '../controles';
import { formatearGs, sumarGs } from '../aritmetica';

// ─────────────────────────────────────────────────────────────────────────────
// Contrato público
// ─────────────────────────────────────────────────────────────────────────────

/** Opciones de consolidación: sobrescriben datos que las fuentes no informan. */
export interface OpcionesConsolidacion {
  /** Target de base imponible informado por Contabilidad, si no se pudo leer de la fuente D. */
  targetContabilidad?: number;
  /** Base imponible del extracto oficial del IPS, si el período ya se presentó. */
  extractoIPS?: number;
  /** Base imponible del Excel de haberes de origen. */
  excelHaberes?: number;
  /** Número patronal a usar cuando la fuente no lo informa. */
  patronalPorDefecto?: string;
  /** Días trabajados a asumir cuando la fuente no los informa. Por defecto 30. */
  diasPorDefecto?: number;
}

/** Resultado completo de consolidar un período: situaciones, liquidación, conciliación y controles. */
export interface ResultadoConsolidacion {
  situaciones: SituacionLaboralIPS[];
  resultado: ResultadoLiquidacionIPS;
  inventario: InventarioFuentes;
  conciliacion: ResultadoConciliacion;
  controles: HallazgoControl[];
  alertas: AlertaIngesta[];
  /** Target de base imponible efectivamente usado en la conciliación, o undefined si no hubo. */
  targetUsado?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos privados
// ─────────────────────────────────────────────────────────────────────────────

/** Índices de columna (base 0; -1 si no está) resueltos una vez por tabla de nómina. */
interface ColumnasNomina {
  ci: number;
  apellidos: number;
  nombres: number;
  nombreCompleto: number;
  salario: number;
  haberes: number;
  horas50: number;
  horas100: number;
  comisiones: number;
  bonifFamiliar: number;
  dias: number;
  reposo: number;
  legajo: number;
  iva: number;
}

/** Persona acumulada a lo largo de todas las fuentes, antes de convertirse en situación. */
interface AcumuladorPersona {
  ci: string;
  apellidos: string;
  nombres: string;
  numeroPatronal: string;
  conceptos: ConceptoEntrada[];
  diasTrabajados: number;
  diasReposo: number;
  esReposoMaternidad: boolean;
  esFactura: boolean;
  legajo?: string;
  egresoEnPeriodo?: { fecha: string; motivo: string };
}

/** Contexto de procesamiento de una fila de nómina (A) o de finiquito (E). */
interface ContextoFilaNomina {
  fila: string[];
  encabezados: string[];
  columnas: ColumnasNomina;
  origen: string;
  numeroPatronal: string;
  diasPorDefecto: number;
  esFiniquito: boolean;
  columnaFechaEgreso: number;
  fechaRespaldo: string;
  acumuladores: Map<string, AcumuladorPersona>;
  alertas: AlertaIngesta[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claves de C.I. estrictas, sin `LEGAJO`, `CODIGO` ni `ID`.
 *
 * Es imprescindible separarlas de las claves de identificación amplias que usa la clasificación
 * por firma de contenido: una planilla de comisiones que solo trae la columna `Legajo` sería
 * leída como si el legajo fuera una C.I. y generaría personas fantasma en lugar de acumular el
 * importe sobre la persona real.
 */
const CLAVES_CI_ESTRICTO: string[] = [
  'C.I.',
  'CI',
  'CEDULA',
  'CEDULA DE IDENTIDAD',
  'DOCUMENTO',
  'N DE DOCUMENTO',
  'NRO DOCUMENTO',
  'RUC',
];

/** Crea una alerta de ingesta, omitiendo los campos opcionales que no se informan. */
function crearAlerta(
  codigo: CodigoAlertaIngesta,
  severidad: SeveridadAlerta,
  mensaje: string,
  origen?: string,
  ci?: string,
): AlertaIngesta {
  const alerta: AlertaIngesta = { codigo, severidad, mensaje };
  if (origen !== undefined) {
    alerta.origen = origen;
  }
  if (ci !== undefined) {
    alerta.ci = ci;
  }
  return alerta;
}

/**
 * Resuelve, con `buscarColumna`, los índices de todas las columnas que puede traer una
 * nómina. Cada índice es base 0 y vale `-1` cuando la columna no existe.
 */
function leerConfiguracionDeColumnas(encabezados: string[]): ColumnasNomina {
  return {
    ci: buscarColumna(encabezados, CLAVES_CI_ESTRICTO),
    apellidos: buscarColumna(encabezados, ['APELLIDOS', 'APELLIDO', 'APELLIDOS Y NOMBRES']),
    nombres: buscarColumna(encabezados, ['NOMBRES', 'NOMBRE']),
    nombreCompleto: buscarColumna(encabezados, [
      'FUNCIONARIO',
      'NOMBRE COMPLETO',
      'DENOMINACION',
      'ASEGURADO',
      'BENEFICIARIO',
    ]),
    salario: buscarColumna(encabezados, ['SALARIO BASE', 'SUELDO', 'SUELDO BASICO', 'JORNAL']),
    haberes: buscarColumna(encabezados, ['TOTAL HABERES', 'HABS', 'HAB C RET', 'HABERES']),
    horas50: buscarColumna(encabezados, ['HS EXTRAS AL 50', 'HE 50', 'HORAS EXTRAS 50']),
    horas100: buscarColumna(encabezados, [
      'HS EXTRAS AL 100',
      'HE 100',
      'HORAS EXTRAS 100',
      'FERIADO TRABAJADO',
    ]),
    comisiones: buscarColumna(encabezados, ['COMISIONES', 'COMISION', 'VARIABLE']),
    bonifFamiliar: buscarColumna(encabezados, [
      'BONIFICACION FAMILIAR',
      'BONIF FAM',
      'ASIGNACION FAMILIAR',
    ]),
    dias: buscarColumna(encabezados, ['DIAS TRABAJADOS', 'DIAS', 'DIAS LIQUIDADOS']),
    reposo: buscarColumna(encabezados, ['DIAS REPOSO', 'REPOSO']),
    legajo: buscarColumna(encabezados, ['LEGAJO', 'CODIGO', 'ID']),
    iva: buscarColumna(encabezados, ['I.V.A.', 'IVA', 'RETENCION IVA']),
  };
}

/**
 * Parte un nombre completo en apellidos y nombres.
 *
 * Heurística determinista: si hay coma, lo anterior son apellidos y lo posterior, nombres; sin
 * coma, con 3 o más palabras las 2 primeras son apellidos y el resto nombres; con 2 palabras, la
 * primera es apellido y la segunda nombre; con 1 palabra, todo es apellido.
 */
function partirNombreCompleto(texto: string): { apellidos: string; nombres: string } {
  const limpio = texto.trim();
  if (limpio === '') {
    return { apellidos: '', nombres: '' };
  }

  if (limpio.includes(',')) {
    const partes = limpio.split(',');
    const apellidosCrudos = partes[0] ?? '';
    const nombresCrudos = partes.slice(1).join(' ');
    return {
      apellidos: normalizarNombre(apellidosCrudos),
      nombres: normalizarNombre(nombresCrudos),
    };
  }

  const palabras = limpio.split(/\s+/).filter((palabra) => palabra !== '');
  if (palabras.length >= 3) {
    return {
      apellidos: normalizarNombre(palabras.slice(0, 2).join(' ')),
      nombres: normalizarNombre(palabras.slice(2).join(' ')),
    };
  }
  if (palabras.length === 2) {
    return {
      apellidos: normalizarNombre(palabras[0] ?? ''),
      nombres: normalizarNombre(palabras[1] ?? ''),
    };
  }
  return { apellidos: normalizarNombre(palabras[0] ?? ''), nombres: '' };
}

/**
 * Lee el monto de una celda de la columna indicada. Devuelve `undefined` si la celda está
 * vacía o si el texto no representa un importe; en este último caso emite `MONTO_INPARSEABLE`.
 */
function montoDeColumna(
  fila: string[],
  indice: number,
  encabezado: string,
  origen: string,
  ci: string,
  alertas: AlertaIngesta[],
): number | undefined {
  if (indice === -1) {
    return undefined;
  }
  const texto = textoDeCelda(fila[indice]);
  if (texto.trim() === '') {
    return undefined;
  }
  const monto = parsearMontoGs(texto);
  if (monto === undefined) {
    alertas.push(
      crearAlerta(
        'MONTO_INPARSEABLE',
        'advertencia',
        `No se pudo interpretar el monto "${texto}" de la columna "${encabezado}" en la fuente "${origen}" (C.I. ${ci}): se omite el valor.`,
        origen,
        ci,
      ),
    );
    return undefined;
  }
  return monto;
}

/**
 * Agrega un concepto al acumulador. Solo suma montos mayores a cero y, si el concepto ya
 * existe, acumula el importe en lugar de duplicar la etiqueta.
 */
function agregarConcepto(
  acumulador: AcumuladorPersona,
  etiqueta: string,
  montoGs: number,
): void {
  if (!(montoGs > 0)) {
    return;
  }
  const existente = acumulador.conceptos.find((concepto) => concepto.etiqueta === etiqueta);
  if (existente === undefined) {
    acumulador.conceptos.push({ etiqueta, monto: montoGs });
    return;
  }
  existente.monto = sumarGs([existente.monto, montoGs]);
}

/**
 * Resuelve el número patronal a declarar: la opción explícita tiene prioridad; si no, la primera
 * patronal de la configuración; si no hay ninguna, cadena vacía (el motor la marcará con
 * `PATRONAL_INEXISTENTE`). Nunca se inventa una patronal de 10 dígitos.
 */
function resolverNumeroPatronal(
  config: ConfiguracionLiquidacionIPS,
  opciones?: OpcionesConsolidacion,
): string {
  if (opciones?.patronalPorDefecto !== undefined) {
    return opciones.patronalPorDefecto;
  }
  const primera = config.patronales[0];
  return primera !== undefined ? primera.numeroPatronal : '';
}

/** Primer día del período en ISO `YYYY-MM-DD`, derivado solo de `config` (nunca del sistema). */
function fechaInicioPeriodo(config: ConfiguracionLiquidacionIPS): string {
  const mes = String(config.mes).padStart(2, '0');
  const anho = String(config.anho).padStart(4, '0');
  return `${anho}-${mes}-01`;
}

/** Arma una fecha ISO validando rangos; `undefined` si el año, mes o día no son válidos. */
function componerFecha(anho: number, mes: number, dia: number): string | undefined {
  if (!Number.isInteger(anho) || anho < 1900 || anho > 9999) {
    return undefined;
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return undefined;
  }
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    return undefined;
  }
  return `${String(anho).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Convierte el texto de una celda de fecha a ISO `YYYY-MM-DD` de forma determinista, sin usar
 * `new Date()`. Reconoce `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `DD-MM-YYYY` y `YYYYMMDD`.
 * Devuelve `undefined` cuando el texto no es una fecha válida.
 */
function fechaEnIso(valor: string): string | undefined {
  const texto = valor.trim();
  if (texto === '') {
    return undefined;
  }

  const anhoPrimero = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(texto);
  if (anhoPrimero !== null) {
    return componerFecha(Number(anhoPrimero[1]), Number(anhoPrimero[2]), Number(anhoPrimero[3]));
  }

  const compacto = /^(\d{4})(\d{2})(\d{2})$/.exec(texto);
  if (compacto !== null) {
    return componerFecha(Number(compacto[1]), Number(compacto[2]), Number(compacto[3]));
  }

  const diaPrimero = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(texto);
  if (diaPrimero !== null) {
    const anhoCrudo = Number(diaPrimero[3]);
    const anho = diaPrimero[3].length <= 2 ? 2000 + anhoCrudo : anhoCrudo;
    return componerFecha(anho, Number(diaPrimero[2]), Number(diaPrimero[1]));
  }

  return undefined;
}

/** Acumulador mínimo para una persona que solo aparece en variables o comisiones. */
function crearAcumuladorVacio(
  ci: string,
  numeroPatronal: string,
  diasPorDefecto: number,
): AcumuladorPersona {
  return {
    ci,
    apellidos: '',
    nombres: '',
    numeroPatronal,
    conceptos: [],
    diasTrabajados: diasPorDefecto,
    diasReposo: 0,
    esReposoMaternidad: false,
    esFactura: false,
  };
}

/** Busca una persona por legajo normalizado; devuelve la primera coincidencia del orden de alta. */
function buscarPorLegajo(
  legajo: string,
  acumuladores: Map<string, AcumuladorPersona>,
): AcumuladorPersona | undefined {
  for (const acumulador of acumuladores.values()) {
    if (acumulador.legajo === legajo) {
      return acumulador;
    }
  }
  return undefined;
}

/**
 * Procesa una fila de nómina (A) o de finiquito (E) y la incorpora al acumulador de su C.I.
 *
 * Reglas: sin C.I. se salta la fila; si la C.I. ya existe se conserva el primer registro (no se
 * pisa) y se avisa con `CI_DUPLICADA_ENTRE_FUENTES`; el finiquito nunca marca factura.
 */
function procesarFilaNomina(contexto: ContextoFilaNomina): void {
  const {
    fila,
    encabezados,
    columnas,
    origen,
    numeroPatronal,
    diasPorDefecto,
    esFiniquito,
    columnaFechaEgreso,
    fechaRespaldo,
    acumuladores,
    alertas,
  } = contexto;

  const ci = normalizarCi(textoDeCelda(fila[columnas.ci]));
  if (ci === '') {
    alertas.push(
      crearAlerta(
        'FILA_SIN_CI',
        'advertencia',
        `La fuente "${origen}" tiene una fila sin C.I.: se omite la fila.`,
        origen,
      ),
    );
    return;
  }

  if (acumuladores.has(ci)) {
    alertas.push(
      crearAlerta(
        'CI_DUPLICADA_ENTRE_FUENTES',
        'advertencia',
        `La C.I. ${ci} aparece más de una vez (fuente "${origen}"): se conserva el primer registro y se omite este duplicado.`,
        origen,
        ci,
      ),
    );
    return;
  }

  // Apellidos y nombres: columnas separadas si existen; si no, se parte el nombre completo.
  let apellidos = '';
  let nombres = '';
  if (columnas.apellidos !== -1 && columnas.nombres !== -1) {
    apellidos = normalizarNombre(textoDeCelda(fila[columnas.apellidos]));
    nombres = normalizarNombre(textoDeCelda(fila[columnas.nombres]));
  } else if (columnas.nombreCompleto !== -1) {
    const partido = partirNombreCompleto(textoDeCelda(fila[columnas.nombreCompleto]));
    apellidos = partido.apellidos;
    nombres = partido.nombres;
  }

  const acumulador: AcumuladorPersona = {
    ci,
    apellidos,
    nombres,
    numeroPatronal,
    conceptos: [],
    diasTrabajados: 0,
    diasReposo: 0,
    esReposoMaternidad: false,
    esFactura: false,
  };

  // Días: los de la fuente si son válidos; si no, el valor por defecto, con tope de 30.
  const diasLeidos =
    columnas.dias !== -1 ? parsearCantidad(textoDeCelda(fila[columnas.dias])) : undefined;
  let diasTrabajados = diasLeidos ?? diasPorDefecto;
  if (diasTrabajados > 30) {
    diasTrabajados = 30;
  }
  acumulador.diasTrabajados = diasTrabajados;
  acumulador.diasReposo =
    columnas.reposo !== -1 ? parsearCantidad(textoDeCelda(fila[columnas.reposo])) ?? 0 : 0;

  // Legajo normalizado, solo si la fuente lo informa y no queda vacío.
  if (columnas.legajo !== -1) {
    const legajo = normalizarEncabezado(textoDeCelda(fila[columnas.legajo]));
    if (legajo !== '') {
      acumulador.legajo = legajo;
    }
  }

  // Conceptos: la base usa salario; si no hay, haberes. Nunca las dos, para no sumar dos veces.
  const columnaBase = columnas.salario !== -1 ? columnas.salario : columnas.haberes;
  const columnasConcepto: { indice: number; etiqueta: string }[] = [
    { indice: columnaBase, etiqueta: 'SALARIO BASE' },
    { indice: columnas.horas50, etiqueta: 'HS. EXTRAS AL 50 %' },
    { indice: columnas.horas100, etiqueta: 'HS. EXTRAS AL 100 %' },
    { indice: columnas.comisiones, etiqueta: 'COMISIONES' },
    { indice: columnas.bonifFamiliar, etiqueta: 'BONIFICACION FAMILIAR' },
  ];
  for (const { indice, etiqueta } of columnasConcepto) {
    if (indice === -1) {
      continue;
    }
    const monto = montoDeColumna(
      fila,
      indice,
      encabezados[indice] ?? etiqueta,
      origen,
      ci,
      alertas,
    );
    if (monto !== undefined) {
      agregarConcepto(acumulador, etiqueta, monto);
    }
  }

  // IVA: un monto mayor a cero convierte a la persona en prestador con factura. El finiquito
  // nunca marca factura.
  if (!esFiniquito && columnas.iva !== -1) {
    const montoIva = montoDeColumna(
      fila,
      columnas.iva,
      encabezados[columnas.iva] ?? 'IVA',
      origen,
      ci,
      alertas,
    );
    if (montoIva !== undefined && montoIva > 0) {
      acumulador.esFactura = true;
      // El IVA se registra en el detalle para que quede trazable. El catálogo lo clasifica como
      // no_aplica, así que no afecta la base imponible, y su presencia es la evidencia que el
      // caso borde CB01 usa para emitir la alerta PRESTADOR_IVA_INCLUIDO.
      agregarConcepto(acumulador, 'I.V.A.', montoIva);
    }
  }

  // Egreso: la fecha sale de la celda si parsea; si no, del primer día del período (nunca del
  // sistema), para que el resultado sea determinista.
  if (esFiniquito) {
    const fechaLeida =
      columnaFechaEgreso !== -1
        ? fechaEnIso(textoDeCelda(fila[columnaFechaEgreso]))
        : undefined;
    acumulador.egresoEnPeriodo = {
      fecha: fechaLeida ?? fechaRespaldo,
      motivo: 'Egreso en el período',
    };
  }

  acumuladores.set(ci, acumulador);
}

/** ¿El rótulo normalizado corresponde a una base imponible gravada (y no a una exenta)? */
function esRotuloBaseImponible(rotulo: string): boolean {
  if (rotulo.includes('BASE IMPONIBLE')) {
    return true;
  }
  return rotulo.includes('IMPONIBLE') && !rotulo.includes('NO IMPONIBLE');
}

/**
 * Lee el target de base imponible de una fuente de contabilidad.
 *
 * La forma del archivo contable varía por empresa, así que la lectura es heurística: busca el
 * primer rótulo de base imponible, suma los importes de su misma fila y sigue cada columna con
 * importe hacia abajo hasta la primera celda vacía. Si la lectura automática no cierra, el
 * humano puede informar el target por `opciones.targetContabilidad`, que tiene precedencia
 * sobre lo leído.
 *
 * @returns `encontrado: false` cuando la tabla no trae ningún rótulo reconocible.
 */
function leerTargetDeFuenteD(fuente: FuenteClasificada): {
  encontrado: boolean;
  monto: number;
} {
  const filas = fuente.tabla.filas;
  for (let indiceFila = 0; indiceFila < filas.length; indiceFila += 1) {
    const fila = filas[indiceFila];
    for (let columna = 0; columna < fila.length; columna += 1) {
      if (!esRotuloBaseImponible(normalizarEncabezado(textoDeCelda(fila[columna])))) {
        continue;
      }

      const montos: number[] = [];
      const columnasConMonto: number[] = [];
      for (let indice = 0; indice < fila.length; indice += 1) {
        const monto = parsearMontoGs(textoDeCelda(fila[indice]));
        if (monto !== undefined) {
          montos.push(monto);
          columnasConMonto.push(indice);
        }
      }

      // Se recorren las columnas con importe hacia abajo desde la fila siguiente (la fila del
      // rótulo ya quedó sumada arriba) hasta la primera celda vacía de cada columna.
      for (const columnaAbajo of columnasConMonto) {
        for (let indiceAbajo = indiceFila + 1; indiceAbajo < filas.length; indiceAbajo += 1) {
          const texto = textoDeCelda(filas[indiceAbajo][columnaAbajo]);
          if (texto.trim() === '') {
            break;
          }
          const montoAbajo = parsearMontoGs(texto);
          if (montoAbajo === undefined) {
            break;
          }
          montos.push(montoAbajo);
        }
      }

      return { encontrado: true, monto: sumarGs(montos) };
    }
  }
  return { encontrado: false, monto: 0 };
}

/**
 * Sanea un importe opcional a un entero seguro no negativo; devuelve `undefined` si no lo es.
 * Es la guarda que evita que `formatearGs` (aritmética) y la conciliación lancen ante datos
 * aritméticamente imposibles.
 */
function aMontoSeguro(valor: number | undefined): number | undefined {
  if (valor === undefined) {
    return undefined;
  }
  return Number.isSafeInteger(valor) && valor >= 0 ? valor : undefined;
}

/** Sanea la tolerancia de conciliación a un entero seguro no negativo; si no lo es, usa 0. */
function toleranciaSegura(valor: number): number {
  return Number.isSafeInteger(valor) && valor >= 0 ? valor : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consolida un período IPS completo a partir de las tablas crudas del lote.
 *
 * Orden del algoritmo: inventario → nómina (A) → variables (B) → finiquitos (E) → target de
 * contabilidad (D) → situaciones → liquidación → controles → conciliación → alertas.
 *
 * Nunca lanza por datos de negocio: ante un lote vacío o sin C.I. devuelve igualmente un
 * `ResultadoConsolidacion` con las alertas correspondientes.
 */
export function consolidarPeriodoIPS(
  tablas: Tabla[],
  config: ConfiguracionLiquidacionIPS,
  opciones?: OpcionesConsolidacion,
): ResultadoConsolidacion {
  // Paso 1 — Descubrimiento: las alertas de la capa de ingesta inician la lista de salida.
  const { inventario, alertas } = inventariarFuentes(tablas);

  const diasPorDefecto = opciones?.diasPorDefecto ?? 30;
  const numeroPatronal = resolverNumeroPatronal(config, opciones);
  const fechaRespaldo = fechaInicioPeriodo(config);

  // Paso 2 — Acumulador por persona, indexado por la C.I. normalizada.
  const acumuladores = new Map<string, AcumuladorPersona>();

  // Fuentes ya leídas como nómina: evita releer su columna de comisiones en el paso de variables.
  const procesadasComoNomina = new Set<FuenteClasificada>();

  // Paso 3 — Fuente A: nómina mensual de todo el personal.
  for (const fuente of inventario.porTipo.A) {
    const { tabla } = fuente;
    const columnas = leerConfiguracionDeColumnas(tabla.encabezados);
    if (columnas.ci === -1) {
      alertas.push(
        crearAlerta(
          'COLUMNA_NO_ENCONTRADA',
          'bloqueante',
          `La fuente "${tabla.origen}" no tiene columna de C.I.: sin C.I. no puede armarse el padrón, se omite la fuente.`,
          tabla.origen,
        ),
      );
      continue;
    }
    procesadasComoNomina.add(fuente);
    for (const fila of tabla.filas) {
      procesarFilaNomina({
        fila,
        encabezados: tabla.encabezados,
        columnas,
        origen: tabla.origen,
        numeroPatronal,
        diasPorDefecto,
        esFiniquito: false,
        columnaFechaEgreso: -1,
        fechaRespaldo,
        acumuladores,
        alertas,
      });
    }
  }

  // Paso 4 — Fuente B: variables, comisiones y horas extras de archivos propios.
  // Se omiten las fuentes ya leídas como nómina (su columna de comisiones ya se sumó) y las que
  // también son finiquito (su lectura como E ya trae los conceptos), para no duplicar montos.
  for (const fuente of inventario.porTipo.B) {
    if (procesadasComoNomina.has(fuente) || fuente.tipos.includes('E')) {
      continue;
    }
    const { tabla } = fuente;
    const columnas = leerConfiguracionDeColumnas(tabla.encabezados);
    const columnaComisiones = buscarColumna(tabla.encabezados, [
      'COMISIONES',
      'COMISION',
      'VARIABLE',
      'MONTO COMISION',
      'VENTAS',
    ]);
    const columnaLegajo = buscarColumna(tabla.encabezados, ['LEGAJO', 'CODIGO', 'ID']);

    for (const fila of tabla.filas) {
      const ci = columnas.ci !== -1 ? normalizarCi(textoDeCelda(fila[columnas.ci])) : '';
      let acumulador: AcumuladorPersona | undefined;
      if (ci !== '') {
        acumulador = acumuladores.get(ci);
        if (acumulador === undefined) {
          // Una persona que solo cobra comisiones igual cotiza.
          acumulador = crearAcumuladorVacio(ci, numeroPatronal, diasPorDefecto);
          acumuladores.set(ci, acumulador);
        }
      } else if (columnaLegajo !== -1) {
        const legajo = normalizarEncabezado(textoDeCelda(fila[columnaLegajo]));
        if (legajo !== '') {
          acumulador = buscarPorLegajo(legajo, acumuladores);
        }
      }

      if (acumulador === undefined) {
        alertas.push(
          crearAlerta(
            'COLUMNA_NO_ENCONTRADA',
            'advertencia',
            `Una fila de la fuente de variables "${tabla.origen}" no encontró su persona: no tiene C.I. ni un legajo que coincida con la nómina.`,
            tabla.origen,
          ),
        );
        continue;
      }

      if (columnaComisiones === -1) {
        continue;
      }
      const monto = montoDeColumna(
        fila,
        columnaComisiones,
        tabla.encabezados[columnaComisiones] ?? 'COMISIONES',
        tabla.origen,
        acumulador.ci,
        alertas,
      );
      if (monto !== undefined) {
        agregarConcepto(acumulador, 'COMISIONES', monto);
      }
    }
  }

  // Paso 5 — Fuente E: finiquitos y egresos del período.
  for (const fuente of inventario.porTipo.E) {
    const { tabla } = fuente;
    const columnas = leerConfiguracionDeColumnas(tabla.encabezados);
    if (columnas.ci === -1) {
      alertas.push(
        crearAlerta(
          'COLUMNA_NO_ENCONTRADA',
          'bloqueante',
          `La fuente de finiquito "${tabla.origen}" no tiene columna de C.I.: sin C.I. no puede armarse el padrón, se omite la fuente.`,
          tabla.origen,
        ),
      );
      continue;
    }
    const columnaFechaEgreso = buscarColumna(tabla.encabezados, [
      'FECHA EGRESO',
      'FECHA DE EGRESO',
      'FECHA BAJA',
      'FECHA',
    ]);

    // Una planilla de finiquito suele tener forma de nómina, así que se clasifica A y E a la vez.
    // Si la tabla ya se leyó como nómina, NO se vuelve a procesar: solo se marca el egreso sobre
    // las personas ya acumuladas. Reprocesarla duplicaría conceptos y emitiría una falsa
    // C.I. duplicada.
    if (procesadasComoNomina.has(fuente)) {
      for (const fila of tabla.filas) {
        const ci = normalizarCi(textoDeCelda(fila[columnas.ci]));
        if (ci === '') {
          continue;
        }
        const acumulador = acumuladores.get(ci);
        if (acumulador === undefined) {
          continue;
        }
        const fechaLeida =
          columnaFechaEgreso !== -1
            ? fechaEnIso(textoDeCelda(fila[columnaFechaEgreso]))
            : undefined;
        acumulador.egresoEnPeriodo = {
          fecha: fechaLeida ?? fechaRespaldo,
          motivo: 'Egreso en el período',
        };
      }
      continue;
    }

    for (const fila of tabla.filas) {
      procesarFilaNomina({
        fila,
        encabezados: tabla.encabezados,
        columnas,
        origen: tabla.origen,
        numeroPatronal,
        diasPorDefecto,
        esFiniquito: true,
        columnaFechaEgreso,
        fechaRespaldo,
        acumuladores,
        alertas,
      });
    }
  }

  // Paso 6 — Fuente D: target de base imponible informado por contabilidad. Si hay más de una
  // fuente D, el target es la suma de todas. La lectura es heurística porque la forma del archivo
  // contable varía por empresa; el humano puede pasar el target por
  // `opciones.targetContabilidad`, que tiene precedencia sobre lo leído.
  let targetLeidoDeFuenteD: number | undefined;
  {
    let acumulado = 0;
    let encontrado = false;
    for (const fuente of inventario.porTipo.D) {
      const lectura = leerTargetDeFuenteD(fuente);
      if (!lectura.encontrado) {
        alertas.push(
          crearAlerta(
            'COLUMNA_NO_ENCONTRADA',
            'advertencia',
            `La fuente de contabilidad "${fuente.tabla.origen}" no contiene el rótulo "BASE IMPONIBLE": no pudo leerse el target automáticamente.`,
            fuente.tabla.origen,
          ),
        );
        continue;
      }
      acumulado = sumarGs([acumulado, lectura.monto]);
      encontrado = true;
    }
    targetLeidoDeFuenteD = encontrado ? acumulado : undefined;
  }

  // Paso 7 — Construir las situaciones laborales en el orden de inserción del `Map` (determinista).
  const situaciones: SituacionLaboralIPS[] = [];
  for (const acumulador of acumuladores.values()) {
    situaciones.push({
      ci: acumulador.ci,
      apellidos: acumulador.apellidos,
      nombres: acumulador.nombres,
      numeroPatronal: acumulador.numeroPatronal,
      vinculo: acumulador.esFactura ? 'factura' : 'cotizante',
      diasTrabajados: acumulador.diasTrabajados,
      diasReposo: acumulador.diasReposo,
      diasVacaciones: 0,
      diasAusencia: 0,
      esReposoMaternidad: acumulador.esReposoMaternidad,
      subsidioAdelantadoPorEmpleador: 0,
      coberturaReposoPorcentaje: 0,
      conceptos: acumulador.conceptos,
      egresoEnPeriodo: acumulador.egresoEnPeriodo,
    });
  }

  // Paso 8 — Liquidar el período con el motor del IPS.
  const resultado = liquidarPeriodoIPS(situaciones, config);

  // Paso 9 — Controles de cierre obligatorios.
  const controles = ejecutarControlesCierre(resultado, config);

  // Paso 10/11 — Target efectivo (la opción explícita tiene precedencia sobre la fuente D) y
  // conciliación de 4 puntos. Los importes se sanean a enteros seguros: así los formateadores y
  // la conciliación nunca lanzan ante un valor imposible.
  const targetUsado = aMontoSeguro(opciones?.targetContabilidad ?? targetLeidoDeFuenteD);
  const extracto = aMontoSeguro(opciones?.extractoIPS);
  const excelHaberes = aMontoSeguro(opciones?.excelHaberes);
  const tolerancia = toleranciaSegura(config.toleranciaConciliacionGs);

  const conciliacion = conciliar4Puntos(
    resultado.totales.baseImponible,
    extracto,
    targetUsado,
    excelHaberes,
    tolerancia,
  );

  // Paso 12 — Diferencia contra el target por encima de la tolerancia de conciliación.
  if (targetUsado !== undefined) {
    const diferencia = Math.abs(resultado.totales.baseImponible - targetUsado);
    if (diferencia > tolerancia) {
      alertas.push(
        crearAlerta(
          'DIFERENCIA_CONTRA_TARGET',
          'bloqueante',
          `La base imponible de los archivos planos (${formatearGs(resultado.totales.baseImponible)} Gs) difiere del target (${formatearGs(targetUsado)} Gs) en ${formatearGs(diferencia)} Gs, por encima de la tolerancia de ${formatearGs(tolerancia)} Gs.`,
        ),
      );
    }
  }

  // Paso 13 — Las alertas del motor NO se copian a `alertas`: ya viajan dentro de
  // `resultado.alertas`. Duplicarlas acá haría que la UI muestre el mismo problema dos veces.
  return { situaciones, resultado, inventario, conciliacion, controles, alertas, targetUsado };
}
