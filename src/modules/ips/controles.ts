/**
 * CONTROLES DE CIERRE Y CONCILIACIÓN DE LA LIQUIDACIÓN IPS (PARAGUAY)
 *
 * Base legal: Decreto-Ley N.º 1860/50, Art. 76 (aporte obrero-patronal del IPS).
 *
 * Contexto: el proceso manual anterior falló exactamente en esta instancia. Se presentó ante el
 * IPS un archivo plano desincronizado respecto del cálculo real y la inconsistencia solo se
 * detectó a mano, después de la presentación. Esta capa existe para que ese error no vuelva a
 * pasar: triangula las fuentes de verificación (conciliación de 4 puntos) y ejecuta los seis
 * controles de cierre obligatorios antes de habilitar la presentación.
 *
 * Capa de dominio pura: sin React, sin DOM, sin I/O y sin dependencias nuevas. Ninguna función
 * lanza: los controles son diagnósticos y devuelven hallazgos verificables de forma independiente.
 */

import type {
  ConfiguracionLiquidacionIPS,
  CotizanteIPS,
  PlanillaPatronalIPS,
  ResultadoLiquidacionIPS,
} from './types';
import { formatearGs } from './aritmetica';
import { ANCHO_LINEA_121, construirArchivo121, validarAnchos } from './planilla';

/** Mensaje común para los controles cuando el período no tiene cotizantes cargados. */
const SIN_COTIZANTES = 'No hay cotizantes en el período';

export interface PuntoConciliacion {
  fuente: string;
  monto: number;
  disponible: boolean;
}

export interface ResultadoConciliacion {
  puntos: PuntoConciliacion[];
  delta: number;
  cierra: boolean;
  mensaje: string;
}

export interface HallazgoControl {
  id: string;
  titulo: string;
  ok: boolean;
  detalle: string;
  cies: string[];
}

/**
 * Triangulación de 4 puntos de control contra el total de los archivos planos.
 *
 * Nunca declara cierre sin evidencia: si no hay ninguna fuente adicional disponible (extracto
 * del IPS, target de contabilidad o Excel de haberes), `cierra` queda en `false` aunque `delta`
 * sea 0. Función pura: no lanza.
 */
export function conciliar4Puntos(
  totalPlanos: number,
  extractoIPS: number | undefined,
  targetContabilidad: number | undefined,
  excelHaberes: number | undefined,
  toleranciaGs: number,
): ResultadoConciliacion {
  const puntoPlanos: PuntoConciliacion = {
    fuente: 'Archivos planos generados',
    monto: totalPlanos,
    disponible: true,
  };

  const puntos: PuntoConciliacion[] = [
    puntoPlanos,
    {
      fuente: 'Extracto oficial del IPS',
      monto: extractoIPS ?? 0,
      disponible: extractoIPS !== undefined,
    },
    {
      fuente: 'Target de contabilidad',
      monto: targetContabilidad ?? 0,
      disponible: targetContabilidad !== undefined,
    },
    {
      fuente: 'Excel de haberes',
      monto: excelHaberes ?? 0,
      disponible: excelHaberes !== undefined,
    },
  ];

  // Fuentes adicionales a los planos efectivamente cargadas por el usuario.
  const fuentesAdicionales = puntos.filter((punto) => punto !== puntoPlanos && punto.disponible);

  let delta = 0;
  for (const punto of fuentesAdicionales) {
    const diferencia = Math.abs(totalPlanos - punto.monto);
    if (diferencia > delta) delta = diferencia;
  }

  const cierra = fuentesAdicionales.length > 0 && delta <= toleranciaGs;

  let mensaje: string;
  if (cierra) {
    mensaje =
      `La conciliación cierra: las ${fuentesAdicionales.length} fuente(s) adicionales cuadran con los ` +
      `archivos planos dentro de la tolerancia de ${formatearGs(toleranciaGs)} Gs, con una diferencia ` +
      `máxima de ${formatearGs(delta)} Gs.`;
  } else if (fuentesAdicionales.length === 0) {
    mensaje =
      'La conciliación no cierra por falta de evidencia: no hay ninguna fuente adicional cargada ' +
      '(extracto del IPS, target de contabilidad o Excel de haberes), por lo que el cotejo queda pendiente.';
  } else {
    const detalleFuentes = fuentesAdicionales
      .map(
        (punto) =>
          `${punto.fuente}: ${formatearGs(punto.monto)} Gs (diferencia de ${formatearGs(
            Math.abs(totalPlanos - punto.monto),
          )} Gs contra los planos)`,
      )
      .join('; ');
    mensaje =
      `La conciliación no cierra: la diferencia máxima contra los archivos planos ` +
      `(${formatearGs(totalPlanos)} Gs) supera la tolerancia de ${formatearGs(toleranciaGs)} Gs. ` +
      `Detalle por fuente: ${detalleFuentes}.`;
  }

  return { puntos, delta, cierra, mensaje };
}

/** Consolida los cotizantes de todas las planillas en un único arreglo. */
function cotizantesConsolidados(resultado: ResultadoLiquidacionIPS): CotizanteIPS[] {
  return resultado.planillas.flatMap((planilla) => planilla.cotizantes);
}

/** Devuelve las C.I. afectadas, sin duplicados, preservando el orden de aparición. */
function ciesUnicas(cotizantes: CotizanteIPS[]): string[] {
  const vistas = new Set<string>();
  const cies: string[] = [];
  for (const cotizante of cotizantes) {
    const ci = cotizante.ci.trim();
    if (ci === '') continue;
    const clave = ci.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    cies.push(ci);
  }
  return cies;
}

/** Hallazgo neutro y conforme para un control cuando el período no tiene cotizantes. */
function hallazgoSinCotizantes(id: string, titulo: string): HallazgoControl {
  return { id, titulo, ok: true, detalle: SIN_COTIZANTES, cies: [] };
}

/**
 * CTRL01 — Maternidad siempre con días = 0.
 * Ningún cotizante con caso CB03 (maternidad) puede registrar días trabajados: el reposo por
 * maternidad se informa con 0 días y no se liquida como días de trabajo.
 */
function controlMaternidad(resultado: ResultadoLiquidacionIPS): HallazgoControl {
  const titulo = 'Maternidad siempre con días = 0';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL01', titulo);

  const conMaternidad = cotizantes.filter((cotizante) => cotizante.casosAplicados.includes('CB03'));
  if (conMaternidad.length === 0) {
    return { id: 'CTRL01', titulo, ok: true, detalle: 'Sin casos de maternidad en el período', cies: [] };
  }

  const infractores = conMaternidad.filter((cotizante) => cotizante.dias !== 0);
  if (infractores.length === 0) {
    return {
      id: 'CTRL01',
      titulo,
      ok: true,
      detalle:
        `Los ${conMaternidad.length} caso(s) de maternidad (CB03) del período registran días = 0, ` +
        'conforme al Art. 76 del Decreto-Ley N.º 1860/50.',
      cies: [],
    };
  }

  const detalle = infractores
    .map((cotizante) => `C.I. ${cotizante.ci}: ${cotizante.dias} día(s)`)
    .join('; ');
  return {
    id: 'CTRL01',
    titulo,
    ok: false,
    detalle:
      `Los siguientes cotizantes con caso CB03 (maternidad) registran días distintos de cero: ${detalle}. ` +
      'El reposo por maternidad debe informarse siempre con 0 días.',
    cies: ciesUnicas(infractores),
  };
}

/**
 * CTRL02 — Reposos cortos por debajo del mínimo.
 * Lista las C.I. con la alerta EXT_MONTO_MENOR_AL_MINIMO. La resolución es un paso humano:
 * el portal REI no expone API y exige credenciales patronales privadas, por lo que el estirado
 * manual del reposo no puede automatizarse desde esta capa.
 */
function controlRepososCortos(resultado: ResultadoLiquidacionIPS): HallazgoControl {
  const titulo = 'Reposos cortos por debajo del mínimo';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL02', titulo);

  const afectados = cotizantes.filter((cotizante) =>
    cotizante.alertas.some((alerta) => alerta.codigo === 'EXT_MONTO_MENOR_AL_MINIMO'),
  );

  if (afectados.length === 0) {
    return {
      id: 'CTRL02',
      titulo,
      ok: true,
      detalle:
        'Ningún reposo del período quedó por debajo del monto mínimo exigido. Recordá que cualquier ' +
        'reposo corto debe estirarse manualmente en el portal REI: el portal exige credenciales ' +
        'patronales privadas y no expone API.',
      cies: [],
    };
  }

  const detalle = afectados
    .map((cotizante) => `C.I. ${cotizante.ci} (${formatearGs(cotizante.baseImponible)} Gs)`)
    .join('; ');
  return {
    id: 'CTRL02',
    titulo,
    ok: false,
    detalle:
      `Los siguientes reposos quedaron por debajo del monto mínimo (EXT_MONTO_MENOR_AL_MINIMO): ${detalle}. ` +
      'La resolución es el estirado manual del reposo en el portal REI: el portal exige credenciales ' +
      'patronales privadas y no expone API, por lo que el ajuste es un paso humano obligatorio antes de presentar.',
    cies: ciesUnicas(afectados),
  };
}

/**
 * CTRL03 — Prestadores con IVA excluidos.
 * Ninguna planilla puede incluir cotizantes con casos CB01/CB02 (prestadores alcanzados por IVA),
 * que deben quedar fuera de la liquidación de aportes.
 */
function controlPrestadoresIva(resultado: ResultadoLiquidacionIPS): HallazgoControl {
  const titulo = 'Prestadores con IVA excluidos';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL03', titulo);

  const prestadores = cotizantes.filter(
    (cotizante) =>
      cotizante.casosAplicados.includes('CB01') || cotizante.casosAplicados.includes('CB02'),
  );

  if (prestadores.length === 0) {
    return {
      id: 'CTRL03',
      titulo,
      ok: true,
      detalle:
        'Ninguna planilla incluye prestadores con IVA (CB01/CB02): el consolidado está libre de ' +
        'cotizantes que deban excluirse del aporte.',
      cies: [],
    };
  }

  const detalle = prestadores
    .map((cotizante) => `C.I. ${cotizante.ci} (${cotizante.casosAplicados.join(', ')})`)
    .join('; ');
  return {
    id: 'CTRL03',
    titulo,
    ok: false,
    detalle:
      `Se detectaron cotizantes con casos CB01/CB02 (prestadores con IVA) que deben excluirse de la ` +
      `liquidación de aportes: ${detalle}.`,
    cies: ciesUnicas(prestadores),
  };
}

/**
 * CTRL04 — Ceros justificados.
 * Todo cotizante con 0 días debe tener un movimiento distinto de NORMAL (REPOSO, PERMISO o SANCION).
 */
function controlCerosJustificados(resultado: ResultadoLiquidacionIPS): HallazgoControl {
  const titulo = 'Ceros justificados';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL04', titulo);

  const infractores = cotizantes.filter(
    (cotizante) => cotizante.dias === 0 && cotizante.movimiento === 'NORMAL',
  );

  if (infractores.length === 0) {
    return {
      id: 'CTRL04',
      titulo,
      ok: true,
      detalle:
        'Todos los cotizantes con 0 días del período tienen un movimiento que justifica el cero ' +
        '(REPOSO, PERMISO o SANCION).',
      cies: [],
    };
  }

  const detalle = infractores.map((cotizante) => `C.I. ${cotizante.ci}`).join('; ');
  return {
    id: 'CTRL04',
    titulo,
    ok: false,
    detalle:
      `Los siguientes cotizantes registran 0 días con movimiento NORMAL, por lo que el cero no está ` +
      `justificado: ${detalle}.`,
    cies: ciesUnicas(infractores),
  };
}

/**
 * CTRL05 — Unicidad de C.I.
 * Sin C.I. duplicadas en el consolidado. La comparación es insensible a mayúsculas y recorta
 * espacios; las C.I. vacías se ignoran porque las bloquea el motor con CI_VACIA.
 */
function controlUnicidadCi(resultado: ResultadoLiquidacionIPS): HallazgoControl {
  const titulo = 'Unicidad de C.I.';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL05', titulo);

  const conteo = new Map<string, number>();
  const representante = new Map<string, string>();
  for (const cotizante of cotizantes) {
    const ci = cotizante.ci.trim();
    if (ci === '') continue;
    const clave = ci.toLowerCase();
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    if (!representante.has(clave)) representante.set(clave, ci);
  }

  const clavesDuplicadas: string[] = [];
  for (const [clave, cantidad] of conteo) {
    if (cantidad > 1) clavesDuplicadas.push(clave);
  }

  if (clavesDuplicadas.length === 0) {
    return {
      id: 'CTRL05',
      titulo,
      ok: true,
      detalle:
        `Las ${representante.size} C.I. del consolidado son únicas (comparación insensible a mayúsculas ` +
        'y sin espacios extremos).',
      cies: [],
    };
  }

  const detalle = clavesDuplicadas
    .map((clave) => `${representante.get(clave) ?? clave} (${conteo.get(clave) ?? 0} veces)`)
    .join('; ');
  return {
    id: 'CTRL05',
    titulo,
    ok: false,
    detalle:
      `Se detectaron C.I. duplicadas en el consolidado (comparación insensible a mayúsculas y sin ` +
      `espacios extremos): ${detalle}.`,
    cies: clavesDuplicadas.map((clave) => representante.get(clave) ?? clave),
  };
}

/**
 * CTRL06 — Anchos de línea exactos.
 * Construye el archivo 121 del consolidado en una planilla efímera y verifica que cada línea tenga
 * exactamente ANCHO_LINEA_121 caracteres. La línea usa el numeroPatronal del cotizante, no el de la
 * planilla. Este control es diagnóstico: si construirArchivo121 lanzara (por ejemplo, un apellido o
 * nombre que excede el ancho), la excepción se captura y se expone como hallazgo fallido, porque ese
 * caso es precisamente lo que el control debe detectar y no puede propagar.
 */
function controlAnchosLinea(
  resultado: ResultadoLiquidacionIPS,
  config: ConfiguracionLiquidacionIPS,
): HallazgoControl {
  const titulo = 'Anchos de línea exactos';
  const cotizantes = cotizantesConsolidados(resultado);
  if (cotizantes.length === 0) return hallazgoSinCotizantes('CTRL06', titulo);

  const planillaConsolidada: PlanillaPatronalIPS = {
    numeroPatronal: 'CONSOLIDADO',
    cotizantes,
    totales: {
      cotizantes: 0,
      baseImponible: 0,
      aporteObrero: 0,
      aportePatronal: 0,
      aporteTotal: 0,
    },
  };

  try {
    const texto = construirArchivo121(planillaConsolidada, config);
    const desbordes = validarAnchos(texto, ANCHO_LINEA_121);

    if (desbordes.length === 0) {
      return {
        id: 'CTRL06',
        titulo,
        ok: true,
        detalle: `El archivo 121 del consolidado respeta exactamente ${ANCHO_LINEA_121} caracteres por línea.`,
        cies: [],
      };
    }

    const detalle = desbordes
      .map((desborde) => `línea ${desborde.linea} con ${desborde.largo} caracteres`)
      .join('; ');
    return {
      id: 'CTRL06',
      titulo,
      ok: false,
      detalle:
        `Se detectaron ${desbordes.length} línea(s) fuera del ancho oficial de ${ANCHO_LINEA_121} ` +
        `caracteres: ${detalle}.`,
      cies: [],
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return {
      id: 'CTRL06',
      titulo,
      ok: false,
      detalle: `El archivo 121 del consolidado no pudo generarse: ${mensaje}`,
      cies: [],
    };
  }
}

/**
 * Ejecuta los seis controles de cierre obligatorios, siempre en este orden y sin lanzar:
 * CTRL01, CTRL02, CTRL03, CTRL04, CTRL05 y CTRL06.
 */
export function ejecutarControlesCierre(
  resultado: ResultadoLiquidacionIPS,
  config: ConfiguracionLiquidacionIPS,
): HallazgoControl[] {
  return [
    controlMaternidad(resultado),
    controlRepososCortos(resultado),
    controlPrestadoresIva(resultado),
    controlCerosJustificados(resultado),
    controlUnicidadCi(resultado),
    controlAnchosLinea(resultado, config),
  ];
}
