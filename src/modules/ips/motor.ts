/**
 * MOTOR DE LIQUIDACIÓN MENSUAL IPS — PARAGUAY
 * Capa de dominio pura: sin React, sin DOM, sin I/O y sin dependencias nuevas.
 *
 * Base legal: Decreto-Ley N.º 1860/50, Art. 76 (aportes obrero-patronales al IPS).
 * Reglas fijas:
 *   - Aporte obrero 9 % → tasa entera por mil 90.
 *   - Aporte patronal 16,5 % → tasa entera por mil 165.
 *   - `aporteTotal` = suma de DOS redondeos independientes (nunca base × 0,255).
 *   - Totales = suma de los redondeos por persona (nunca porcentaje sobre el agregado).
 *   - Redondeo ROUND_HALF_UP al Guaraní (vía `aritmetica.ts`). Prohibido redondeo bancario.
 *
 * El motor NO lanza por datos de negocio: siempre devuelve un `ResultadoLiquidacionIPS`.
 */

import type {
  AlertaIPS,
  ClaseConcepto,
  CodigoAlertaIPS,
  ConceptoEntrada,
  ConfiguracionLiquidacionIPS,
  CotizanteIPS,
  DetalleConceptoIPS,
  PlanillaPatronalIPS,
  ResultadoLiquidacionIPS,
  SeveridadAlerta,
  SituacionLaboralIPS,
  TotalesIPS,
} from './types';
import {
  aGs,
  aplicarTasaPorMil,
  convertirUsdAPyg,
  dividirHalfUp,
  formatearGs,
  sumarGs,
} from './aritmetica';
import {
  CONCEPTO_DESCONOCIDO_ID,
  normalizarEtiqueta,
  resolverConceptoCanonico,
} from './catalogoConceptos';
import type { ResolucionCasoBorde } from './casosBorde';
import { resolverSituacionLaboral } from './casosBorde';

/** Candidato ya procesado, a la espera de agruparse por patronal y deduplicarse por CI. */
interface CandidatoIPS {
  numeroPatronal: string;
  cotizante: CotizanteIPS;
}

/**
 * Liquida un período mensual del IPS para todas las situaciones laborales declaradas.
 *
 * @param situaciones Situaciones laborales del período (una por cotizante/postulante).
 * @param config Configuración de la liquidación (período, tasas, patronales, salario mínimo, FX).
 * @returns Planillas por patronal, totales consolidados, alertas globales y aptitud de presentación.
 */
export function liquidarPeriodoIPS(
  situaciones: SituacionLaboralIPS[],
  config: ConfiguracionLiquidacionIPS,
): ResultadoLiquidacionIPS {
  const alertasGlobales: AlertaIPS[] = [];

  // Paso 1 — Validar la configuración antes de procesar a nadie.
  validarConfiguracion(config, alertasGlobales);

  // Paso 1 (USD) — Sin tipo de cambio no se procesa ninguna situación con montos en USD.
  if (requiereTipoDeCambio(situaciones) && !tipoCambioUsable(config.tipoCambioUsdPyg)) {
    agregarAlerta(
      alertasGlobales,
      'FX_USD_REQUERIDO',
      'bloqueante',
      'Hay conceptos expresados en USD y no se informó un tipo de cambio (tipoCambioUsdPyg) mayor a cero. No se procesa ninguna situación hasta contar con la cotización.',
    );
    return {
      planillas: [],
      totales: totalesVacios(),
      alertas: alertasGlobales,
      aptoParaPresentar: false,
    };
  }

  // Pasos 2 a 8 — Procesar cada persona (canonización, base, caso borde, piso, aportes, patronal).
  const candidatos: CandidatoIPS[] = [];
  for (const situacion of situaciones) {
    const candidato = procesarSituacion(situacion, config, alertasGlobales);
    if (candidato !== undefined) {
      candidatos.push(candidato);
    }
  }

  // Pasos 9 a 12 — Agrupar por patronal, deduplicar por CI y ordenar de forma determinista.
  const agrupados = agruparPorPatronal(candidatos);
  const planillas: PlanillaPatronalIPS[] = [];
  for (const [numeroPatronal, cotizantes] of agrupados) {
    const unicos = deduplicarPorCI(cotizantes, numeroPatronal, alertasGlobales);
    if (unicos.length === 0) {
      continue;
    }
    unicos.sort((a, b) => claveOrden(a).localeCompare(claveOrden(b)));
    planillas.push({ numeroPatronal, cotizantes: unicos, totales: totalesDe(unicos) });
  }
  planillas.sort((a, b) => compararPatronales(a.numeroPatronal, b.numeroPatronal));

  // Paso 11 — Totales consolidados = suma de los totales de cada planilla.
  const totales = consolidarTotales(planillas);

  // Paso 13 — Solo es apto si no queda ninguna alerta bloqueante (globales + por persona).
  const aptoParaPresentar = esAptoParaPresentar(alertasGlobales, planillas);

  return { planillas, totales, alertas: alertasGlobales, aptoParaPresentar };
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 1 — Validación de configuración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acumula las alertas bloqueantes de configuración. No corta el procesamiento:
 * se sigue para reunir todas las alertas, pero `aptoParaPresentar` ya será `false`.
 */
function validarConfiguracion(config: ConfiguracionLiquidacionIPS, alertas: AlertaIPS[]): void {
  const mesValido = Number.isInteger(config.mes) && config.mes >= 1 && config.mes <= 12;
  const anhoValido = Number.isInteger(config.anho) && config.anho >= 1000 && config.anho <= 9999;
  if (!mesValido || !anhoValido) {
    agregarAlerta(
      alertas,
      'PERIODO_INVALIDO',
      'bloqueante',
      `El período declarado (mes ${String(config.mes)}, año ${String(config.anho)}) es inválido: se espera un mes entero entre 1 y 12 y un año de 4 dígitos.`,
    );
  }

  if (!(Number.isFinite(config.salarioMinimoLegal) && config.salarioMinimoLegal > 0)) {
    agregarAlerta(
      alertas,
      'PATRONAL_INVALIDA',
      'bloqueante',
      'El parámetro config.salarioMinimoLegal debe ser un número mayor a cero.',
    );
  }
  if (!(Number.isFinite(config.tasaObreroPorMil) && config.tasaObreroPorMil > 0)) {
    agregarAlerta(
      alertas,
      'PATRONAL_INVALIDA',
      'bloqueante',
      'El parámetro config.tasaObreroPorMil debe ser un número mayor a cero.',
    );
  }
  if (!(Number.isFinite(config.tasaPatronalPorMil) && config.tasaPatronalPorMil > 0)) {
    agregarAlerta(
      alertas,
      'PATRONAL_INVALIDA',
      'bloqueante',
      'El parámetro config.tasaPatronalPorMil debe ser un número mayor a cero.',
    );
  }

  if (config.patronales.length === 0) {
    agregarAlerta(
      alertas,
      'PATRONAL_INVALIDA',
      'bloqueante',
      'No se configuró ninguna patronal: se requiere al menos una con número de exactamente 10 dígitos.',
    );
  } else {
    for (const patronal of config.patronales) {
      if (!/^\d{10}$/.test(patronal.numeroPatronal)) {
        agregarAlerta(
          alertas,
          'PATRONAL_INVALIDA',
          'bloqueante',
          `La patronal configurada "${patronal.numeroPatronal}" no cumple el formato de exactamente 10 dígitos.`,
        );
      }
    }
  }
}

/** ¿Alguna situación trae al menos un concepto expresado en USD? */
function requiereTipoDeCambio(situaciones: SituacionLaboralIPS[]): boolean {
  return situaciones.some((situacion) =>
    situacion.conceptos.some((concepto) => concepto.moneda === 'USD'),
  );
}

/** ¿El tipo de cambio es utilizable (definido, finito y mayor a cero)? */
function tipoCambioUsable(tipoCambio: number | undefined): boolean {
  return tipoCambio !== undefined && Number.isFinite(tipoCambio) && tipoCambio > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos 2 a 8 — Procesamiento por persona
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canoniza conceptos, resuelve el caso borde, calcula la base y los aportes, y valida la patronal.
 * Devuelve `undefined` si la persona queda fuera del padrón o con patronal inexistente.
 */
function procesarSituacion(
  situacion: SituacionLaboralIPS,
  config: ConfiguracionLiquidacionIPS,
  alertasGlobales: AlertaIPS[],
): CandidatoIPS | undefined {
  const alertasPersona: AlertaIPS[] = [];

  // Paso 2 — Canonizar conceptos (clase, gravabilidad y monto en Gs).
  const detalle = canonizarConceptos(situacion, config, alertasPersona);

  // Paso 3 — Base imponible preliminar para resolver el caso borde.
  const basePreliminar = baseImponibleDe(detalle);

  // Paso 4 — Resolver caso borde (CB01..CB10).
  const resolucion = resolverSituacionLaboral(situacion, config, basePreliminar);
  if (!resolucion.incluirEnPadron) {
    for (const alerta of alertasPersona) {
      alertasGlobales.push(alerta);
    }
    for (const alerta of resolucion.alertas) {
      alertasGlobales.push(alerta);
    }
    return undefined;
  }
  for (const alerta of resolucion.alertas) {
    alertasPersona.push(alerta);
  }

  // Paso 5 — Base imponible definitiva (subsidio adelantado si no hay base de conceptos).
  const baseImponible = calcularBaseImponible(detalle, situacion);

  // Paso 6 — Piso mínimo legal.
  aplicarAlertaPisoMinimo(situacion, config, baseImponible, resolucion, alertasPersona);

  // Paso 7 — Aportes: dos redondeos independientes; nunca base × 0,255.
  const aporteObrero = aplicarTasaPorMil(baseImponible, config.tasaObreroPorMil);
  const aportePatronal = aplicarTasaPorMil(baseImponible, config.tasaPatronalPorMil);
  const aporteTotal = aporteObrero + aportePatronal;

  // Paso 8 — Patronal válida: jamás se emite con una patronal inventada.
  const numeroPatronal = normalizarPatronal(situacion.numeroPatronal);
  if (!patronalExiste(numeroPatronal, config)) {
    agregarAlerta(
      alertasGlobales,
      'PATRONAL_INEXISTENTE',
      'bloqueante',
      `La situación de CI ${situacion.ci} declara la patronal "${numeroPatronal}", que no existe entre las patronales configuradas. La persona se excluye de todas las planillas: jamás se emite con una patronal inventada.`,
      situacion.ci,
    );
    return undefined;
  }

  const cotizante: CotizanteIPS = {
    ci: situacion.ci,
    apellidos: situacion.apellidos,
    nombres: situacion.nombres,
    numeroPatronal,
    dias: resolucion.dias,
    movimiento: resolucion.movimiento,
    baseImponible,
    aporteObrero,
    aportePatronal,
    aporteTotal,
    casosAplicados: [...resolucion.casosAplicados],
    alertas: alertasPersona,
    detalle,
  };

  return { numeroPatronal, cotizante };
}

/** Canoniza la lista de conceptos de una situación. */
function canonizarConceptos(
  situacion: SituacionLaboralIPS,
  config: ConfiguracionLiquidacionIPS,
  alertas: AlertaIPS[],
): DetalleConceptoIPS[] {
  return situacion.conceptos.map((concepto) =>
    canonizarConcepto(concepto, situacion.ci, config, alertas),
  );
}

/**
 * Resuelve el concepto canónico de una etiqueta. Si no está en el catálogo NUNCA se asume
 * gravabilidad: queda como `desconocido`, no grava y avisa con severidad advertencia.
 */
function canonizarConcepto(
  concepto: ConceptoEntrada,
  ci: string,
  config: ConfiguracionLiquidacionIPS,
  alertas: AlertaIPS[],
): DetalleConceptoIPS {
  const definicion = resolverConceptoCanonico(concepto.etiqueta);
  let conceptoCanonico: string;
  let clase: ClaseConcepto;
  let grava: boolean;

  if (definicion === undefined) {
    conceptoCanonico = CONCEPTO_DESCONOCIDO_ID;
    clase = 'desconocido';
    grava = false;
    agregarAlerta(
      alertas,
      'CONCEPTO_DESCONOCIDO',
      'advertencia',
      `El concepto "${concepto.etiqueta}" no figura en el catálogo del IPS. No se asume gravable: queda fuera de la base imponible hasta su revisión.`,
      ci,
    );
  } else {
    conceptoCanonico = definicion.id;
    clase = definicion.clase;
    grava = definicion.clase === 'imponible';
  }

  const montoGs = convertirMontoAGs(concepto, config);
  if (montoGs < 0) {
    agregarAlerta(
      alertas,
      'CONCEPTO_NEGATIVO',
      'advertencia',
      `El concepto "${concepto.etiqueta}" tiene un monto negativo (${montoGs}). No se incorpora a la base imponible; revisá la carga antes de presentar.`,
      ci,
    );
  }

  return { etiqueta: concepto.etiqueta, conceptoCanonico, clase, montoGs, grava };
}

/**
 * Convierte el monto del concepto a Guaraníes. En USD se usa el tipo de cambio de la
 * configuración (el caso sin cotización ya se descartó con `FX_USD_REQUERIDO`).
 */
function convertirMontoAGs(
  concepto: ConceptoEntrada,
  config: ConfiguracionLiquidacionIPS,
): number {
  if (concepto.moneda === 'USD') {
    return convertirUsdAPyg(concepto.monto, config.tipoCambioUsdPyg ?? 0);
  }
  return aGs(concepto.monto);
}

/** Suma de los montos imponibles no negativos (base imponible por conceptos). */
function baseImponibleDe(detalle: DetalleConceptoIPS[]): number {
  return sumarGs(
    detalle
      .filter((concepto) => concepto.clase === 'imponible' && concepto.montoGs >= 0)
      .map((concepto) => concepto.montoGs),
  );
}

/**
 * Paso 5 — Base imponible definitiva. Si no hay base de conceptos y el empleador adelantó
 * el subsidio de reposo, ese subsidio pasa a ser la base declarable.
 */
function calcularBaseImponible(
  detalle: DetalleConceptoIPS[],
  situacion: SituacionLaboralIPS,
): number {
  const baseConceptos = baseImponibleDe(detalle);
  if (baseConceptos > 0) {
    return baseConceptos;
  }
  const subsidio = situacion.subsidioAdelantadoPorEmpleador;
  if (Number.isFinite(subsidio) && subsidio > 0) {
    return aGs(subsidio);
  }
  return 0;
}

/**
 * Paso 6 — Piso mínimo legal. El tiempo parcial se prorratea por horas contratadas
 * (ROUND_HALF_UP); sin horas válidas rige el piso completo, no se inventa una prorrata.
 */
function calcularPisoMinimo(
  situacion: SituacionLaboralIPS,
  config: ConfiguracionLiquidacionIPS,
): number {
  if (situacion.vinculo !== 'tiempo_parcial') {
    return config.salarioMinimoLegal;
  }

  const horasContratadas = situacion.horasContratadasSemana;
  if (
    horasContratadas === undefined ||
    !Number.isFinite(horasContratadas) ||
    !Number.isInteger(horasContratadas) ||
    horasContratadas <= 0
  ) {
    return config.salarioMinimoLegal;
  }

  if (!Number.isInteger(config.salarioMinimoLegal)) {
    return config.salarioMinimoLegal;
  }

  const horasCategoria = situacion.horasSemanaCategoria;
  const denominador =
    horasCategoria !== undefined &&
    Number.isFinite(horasCategoria) &&
    Number.isInteger(horasCategoria) &&
    horasCategoria > 0
      ? horasCategoria
      : 48;

  const numerador = BigInt(aGs(config.salarioMinimoLegal)) * BigInt(horasContratadas);
  return Number(dividirHalfUp(numerador, BigInt(denominador)));
}

/**
 * Emite `EXT_MONTO_MENOR_AL_MINIMO` cuando la base cae por debajo del mínimo sin una causa
 * que lo justifique.
 *
 * El único justificante automático es el egreso en el período (la base es proporcional a los
 * días trabajados por definición legal). El reposo corto NO justifica el piso: con días > 0 el
 * validador del IPS rechaza la planilla y la única salida es que un humano estire el reposo en
 * el portal REI. Los casos de días = 0 (maternidad, reposo prolongado, suspensión, cero
 * justificado) quedan excluidos por la propia condición `dias > 0`.
 *
 * La regularización en el portal REI exige credenciales patronales privadas y no expone API:
 * es un paso no automatizable.
 */
function aplicarAlertaPisoMinimo(
  situacion: SituacionLaboralIPS,
  config: ConfiguracionLiquidacionIPS,
  baseImponible: number,
  resolucion: ResolucionCasoBorde,
  alertas: AlertaIPS[],
): void {
  const pisoEfectivo = calcularPisoMinimo(situacion, config);
  const hayEgreso = situacion.egresoEnPeriodo !== undefined;

  if (resolucion.dias > 0 && baseImponible < pisoEfectivo && !hayEgreso) {
    agregarAlerta(
      alertas,
      'EXT_MONTO_MENOR_AL_MINIMO',
      'advertencia',
      `La base imponible declarada (${formatearGs(baseImponible)} Gs.) queda por debajo del salario mínimo legal prorrateado (${formatearGs(pisoEfectivo)} Gs.): el validador del IPS rechazará la planilla. La regularización requiere que una persona confirme o estire el reposo en el portal REI; es un paso no automatizable porque el portal exige credenciales patronales privadas y no expone API. (Decreto-Ley N.º 1860/50, Art. 76)`,
      situacion.ci,
    );
  }
}

/** ¿Existe la patronal normalizada entre las configuradas? */
function patronalExiste(numeroPatronal: string, config: ConfiguracionLiquidacionIPS): boolean {
  return config.patronales.some(
    (patronal) => normalizarPatronal(patronal.numeroPatronal) === numeroPatronal,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos 9 a 12 — Agrupación, deduplicación, orden y totales
// ─────────────────────────────────────────────────────────────────────────────

/** Agrupa los candidatos por número de patronal normalizado, preservando el orden de entrada. */
function agruparPorPatronal(candidatos: CandidatoIPS[]): Map<string, CotizanteIPS[]> {
  const agrupados = new Map<string, CotizanteIPS[]>();
  for (const candidato of candidatos) {
    const existentes = agrupados.get(candidato.numeroPatronal);
    if (existentes === undefined) {
      agrupados.set(candidato.numeroPatronal, [candidato.cotizante]);
    } else {
      existentes.push(candidato.cotizante);
    }
  }
  return agrupados;
}

/**
 * Paso 9 — Unicidad de CI dentro de la planilla. CI vacía se descarta. Ante CI duplicada se
 * conserva el PRIMER registro según el orden de entrada (el origen lo declaró primero) y se
 * descartan los posteriores; regla fija para garantizar determinismo.
 */
function deduplicarPorCI(
  cotizantes: CotizanteIPS[],
  numeroPatronal: string,
  alertasGlobales: AlertaIPS[],
): CotizanteIPS[] {
  const vistos = new Set<string>();
  const unicos: CotizanteIPS[] = [];
  for (const cotizante of cotizantes) {
    const ci = cotizante.ci.trim();
    if (ci === '') {
      agregarAlerta(
        alertasGlobales,
        'CI_VACIA',
        'bloqueante',
        `Se descartó un cotizante de la planilla ${numeroPatronal} con CI vacía: sin CI no puede identificarse en el padrón del IPS.`,
      );
      continue;
    }
    if (vistos.has(ci)) {
      agregarAlerta(
        alertasGlobales,
        'CI_DUPLICADA',
        'bloqueante',
        `La CI ${ci} aparece más de una vez en la planilla ${numeroPatronal}. Se conserva el primer registro según el orden de entrada y se descarta este duplicado.`,
        ci,
      );
      continue;
    }
    vistos.add(ci);
    unicos.push(cotizante);
  }
  return unicos;
}

/**
 * Paso 10 — Clave de orden alfabético determinista: `(apellidos, nombres, ci)` con cada
 * campo ya normalizado. El orden no depende del orden de entrada.
 */
function claveOrden(cotizante: CotizanteIPS): string {
  return [
    normalizarEtiqueta(cotizante.apellidos),
    normalizarEtiqueta(cotizante.nombres),
    normalizarEtiqueta(cotizante.ci),
  ].join('\u0000');
}

/** Comparación de números de patronal por orden de cadena ascendente. */
function compararPatronales(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** Totales de una planilla: suma de los redondeos por persona, nunca sobre el agregado. */
function totalesDe(cotizantes: CotizanteIPS[]): TotalesIPS {
  return {
    cotizantes: cotizantes.length,
    baseImponible: sumarGs(cotizantes.map((cotizante) => cotizante.baseImponible)),
    aporteObrero: sumarGs(cotizantes.map((cotizante) => cotizante.aporteObrero)),
    aportePatronal: sumarGs(cotizantes.map((cotizante) => cotizante.aportePatronal)),
    aporteTotal: sumarGs(cotizantes.map((cotizante) => cotizante.aporteTotal)),
  };
}

/** Totales consolidados = suma de los totales de cada planilla. */
function consolidarTotales(planillas: PlanillaPatronalIPS[]): TotalesIPS {
  let consolidado = totalesVacios();
  for (const planilla of planillas) {
    consolidado = {
      cotizantes: consolidado.cotizantes + planilla.totales.cotizantes,
      baseImponible: sumarGs([consolidado.baseImponible, planilla.totales.baseImponible]),
      aporteObrero: sumarGs([consolidado.aporteObrero, planilla.totales.aporteObrero]),
      aportePatronal: sumarGs([consolidado.aportePatronal, planilla.totales.aportePatronal]),
      aporteTotal: sumarGs([consolidado.aporteTotal, planilla.totales.aporteTotal]),
    };
  }
  return consolidado;
}

/** Totales en cero: lote vacío o corte por falta de tipo de cambio. */
function totalesVacios(): TotalesIPS {
  return {
    cotizantes: 0,
    baseImponible: 0,
    aporteObrero: 0,
    aportePatronal: 0,
    aporteTotal: 0,
  };
}

/**
 * Paso 13 — Apto para presentar solo si no queda ninguna alerta bloqueante, ni global ni
 * dentro de los cotizantes de cada planilla.
 */
function esAptoParaPresentar(
  alertasGlobales: AlertaIPS[],
  planillas: PlanillaPatronalIPS[],
): boolean {
  if (alertasGlobales.some((alerta) => alerta.severidad === 'bloqueante')) {
    return false;
  }
  for (const planilla of planillas) {
    for (const cotizante of planilla.cotizantes) {
      if (cotizante.alertas.some((alerta) => alerta.severidad === 'bloqueante')) {
        return false;
      }
    }
  }
  return true;
}

/** Normaliza el número de patronal a 10 dígitos con relleno a la izquierda. */
function normalizarPatronal(numeroPatronal: string): string {
  return numeroPatronal.padStart(10, '0');
}

/** Helper único para agregar alertas, con CI opcional. */
function agregarAlerta(
  destino: AlertaIPS[],
  codigo: CodigoAlertaIPS,
  severidad: SeveridadAlerta,
  mensaje: string,
  ci?: string,
): void {
  const alerta: AlertaIPS = { codigo, severidad, mensaje };
  if (ci !== undefined) {
    alerta.ci = ci;
  }
  destino.push(alerta);
}
