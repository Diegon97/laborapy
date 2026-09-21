/**
 * CASOS BORDE DE LA LIQUIDACIÓN IPS — MOTOR PURO
 *
 * Función pura y determinista: no muta la entrada, no depende de la fecha del sistema
 * ni del orden de iteración del entorno.
 *
 * El `movimiento` es metadato del motor para los controles y la UI: NO es un campo de
 * la línea de 121 caracteres de la REI, así que nunca debe agregarse al layout de ancho fijo.
 *
 * Base legal: Decreto-Ley N.º 1860/50, Art. 76; Ley N.º 5508/15 (reposo por maternidad);
 * Ley N.º 6339/19 (tiempo parcial).
 */

import { resolverConceptoCanonico } from './catalogoConceptos';
import type {
  AlertaIPS,
  CodigoAlertaIPS,
  ConfiguracionLiquidacionIPS,
  MovimientoREI,
  SeveridadAlerta,
  SituacionLaboralIPS,
} from './types';

/** Resultado de aplicar la tabla de casos borde a una situación laboral. */
export interface ResolucionCasoBorde {
  dias: number;
  movimiento: MovimientoREI;
  incluirEnPadron: boolean;
  casosAplicados: string[];
  alertas: AlertaIPS[];
}

/** Límite inferior de días computables en el período mensual. */
const DIAS_MINIMOS = 0;

/** Días de un mes completo: tope del clampeo y umbral de licencia prolongada (30 días). */
const DIAS_MES = 30;

/** Construye una alerta omitiendo `ci` cuando no hay cédula informada. */
function alerta(
  codigo: CodigoAlertaIPS,
  severidad: SeveridadAlerta,
  mensaje: string,
  ci?: string,
): AlertaIPS {
  return ci === undefined ? { codigo, severidad, mensaje } : { codigo, severidad, mensaje, ci };
}

/** Trunca los días a enteros y los lleva al rango 0..30. */
function clampearDias(dias: number): number {
  if (!Number.isFinite(dias)) {
    return DIAS_MINIMOS;
  }
  const diasEnteros = Math.trunc(dias);
  if (diasEnteros < DIAS_MINIMOS) {
    return DIAS_MINIMOS;
  }
  if (diasEnteros > DIAS_MES) {
    return DIAS_MES;
  }
  return diasEnteros;
}

/** Detecta días trabajados inválidos: no finitos, no enteros o fuera del rango 0..30. */
function diasFueraDeRango(dias: number): boolean {
  return (
    !Number.isFinite(dias) || !Number.isInteger(dias) || dias < DIAS_MINIMOS || dias > DIAS_MES
  );
}

/** Indica si algún concepto de la situación fue resuelto como IVA de factura. */
function tieneConceptoIvaFactura(situacion: SituacionLaboralIPS): boolean {
  return situacion.conceptos.some(
    (concepto) => resolverConceptoCanonico(concepto.etiqueta)?.id === 'IVA_FACTURA',
  );
}

/**
 * Aplica la tabla de casos borde, evaluada en orden: la primera coincidencia gana.
 *
 * Excepción documentada: el reposo por maternidad (CB03) siempre impone `dias = 0` y
 * `movimiento: 'REPOSO'` sobre un `diasTrabajados` inconsistente (Ley N.º 5508/15 — si se
 * declara con días mayores a cero el IPS interpreta que hubo prestación de servicios, no
 * paga el subsidio y el costo queda a cargo de la empresa). Por eso CB01 y CB02, que solo
 * gobiernan la inclusión en el padrón, respetan ese cómputo cuando ambas condiciones
 * concurren, informando ambos casos en `casosAplicados`.
 *
 * @param situacion Datos declarados de la persona para el período.
 * @param _config Configuración de la liquidación (no interviene en estas reglas; se conserva la firma del contrato).
 * @param baseImponibleConceptos Base imponible ya resuelta de los conceptos, en guaraníes.
 */
export function resolverSituacionLaboral(
  situacion: SituacionLaboralIPS,
  _config: ConfiguracionLiquidacionIPS,
  baseImponibleConceptos: number,
): ResolucionCasoBorde {
  const ci = situacion.ci.trim() === '' ? undefined : situacion.ci;
  const alertas: AlertaIPS[] = [];

  const diasClampeados = clampearDias(situacion.diasTrabajados);
  if (diasFueraDeRango(situacion.diasTrabajados)) {
    alertas.push(
      alerta(
        'DIAS_FUERA_DE_RANGO',
        'bloqueante',
        `Días trabajados fuera del rango válido 0..30 (valor informado: ${String(situacion.diasTrabajados)}). El motor lo ajustó a ${diasClampeados}.`,
        ci,
      ),
    );
  }

  // CB03 — reposo por maternidad: los días siempre se fuerzan a cero.
  const esMaternidad = situacion.esReposoMaternidad === true;
  if (esMaternidad && situacion.diasTrabajados > 0) {
    alertas.push(
      alerta(
        'MATERNIDAD_DIAS_MAYOR_A_CERO',
        'advertencia',
        'Se declaró reposo por maternidad con días trabajados mayores a cero; el IPS interpreta que hubo prestación de servicios, no paga el subsidio y el costo queda a cargo de la empresa (Ley N.º 5508/15). El motor fijó los días en 0.',
        ci,
      ),
    );
  }
  const diasConMaternidad = DIAS_MINIMOS;
  const movimientoConMaternidad: MovimientoREI = 'REPOSO';

  // CB01 — prestador que factura (relación civil con IVA): nunca integra el padrón IPS.
  if (situacion.vinculo === 'factura') {
    if (tieneConceptoIvaFactura(situacion)) {
      alertas.push(
        alerta(
          'PRESTADOR_IVA_INCLUIDO',
          'info',
          'Se detectó un concepto de IVA/factura en un vínculo civil: el prestador queda fuera del padrón IPS.',
          ci,
        ),
      );
    }
    return {
      dias: esMaternidad ? diasConMaternidad : diasClampeados,
      movimiento: esMaternidad ? movimientoConMaternidad : 'NORMAL',
      incluirEnPadron: false,
      casosAplicados: esMaternidad ? ['CB01', 'CB03'] : ['CB01'],
      alertas,
    };
  }

  // CB02 — regímenes especiales (doméstico, aprendiz, pasante): fuera del padrón general.
  if (
    situacion.vinculo === 'domestico' ||
    situacion.vinculo === 'aprendiz' ||
    situacion.vinculo === 'pasante'
  ) {
    alertas.push(
      alerta(
        'REGIMEN_ESPECIAL_NO_SOPORTADO',
        'advertencia',
        `El vínculo "${situacion.vinculo}" tiene régimen previsional especial: no se asume la alícuota general del Art. 76 (Decreto-Ley N.º 1860/50). Queda fuera del padrón hasta validación.`,
        ci,
      ),
    );
    return {
      dias: esMaternidad ? diasConMaternidad : diasClampeados,
      movimiento: esMaternidad ? movimientoConMaternidad : 'NORMAL',
      incluirEnPadron: false,
      casosAplicados: esMaternidad ? ['CB02', 'CB03'] : ['CB02'],
      alertas,
    };
  }

  // CB03 — reposo por maternidad: días forzados a cero y movimiento REPOSO.
  if (esMaternidad) {
    return {
      dias: DIAS_MINIMOS,
      movimiento: 'REPOSO',
      incluirEnPadron: true,
      casosAplicados: ['CB03'],
      alertas,
    };
  }

  // CB04 — ausencia de 30 días o más en el período.
  if (situacion.diasAusencia >= DIAS_MES) {
    return {
      dias: DIAS_MINIMOS,
      movimiento: 'PERMISO',
      incluirEnPadron: true,
      casosAplicados: ['CB04'],
      alertas,
    };
  }

  // CB05 — reposo prolongado (30 días o más) sin días trabajados.
  if (situacion.diasReposo >= DIAS_MES && situacion.diasTrabajados === 0) {
    return {
      dias: DIAS_MINIMOS,
      movimiento: 'REPOSO',
      incluirEnPadron: true,
      casosAplicados: ['CB05'],
      alertas,
    };
  }

  // CB06 — reposo parcial dentro del mes: se liquidan solo los días trabajados.
  if (situacion.diasReposo > 0 && situacion.diasReposo < DIAS_MES) {
    return {
      dias: diasClampeados,
      movimiento: 'REPOSO',
      incluirEnPadron: true,
      casosAplicados: ['CB06'],
      alertas,
    };
  }

  // CB07 — egreso dentro del período: se liquidan los días trabajados.
  if (situacion.egresoEnPeriodo !== undefined) {
    return {
      dias: diasClampeados,
      movimiento: 'NORMAL',
      incluirEnPadron: true,
      casosAplicados: ['CB07'],
      alertas,
    };
  }

  // CB08 — tiempo parcial (Ley N.º 6339/19): requiere horas contratadas para prorratear.
  if (situacion.vinculo === 'tiempo_parcial') {
    if (situacion.horasContratadasSemana === undefined) {
      alertas.push(
        alerta(
          'TIEMPO_PARCIAL_SIN_PRORRATA',
          'advertencia',
          'Tiempo parcial sin horas contratadas semanales declaradas: no se puede prorratear la base ni validar el tope de jornada (Ley N.º 6339/19).',
          ci,
        ),
      );
    }
    return {
      dias: diasClampeados,
      movimiento: 'NORMAL',
      incluirEnPadron: true,
      casosAplicados: ['CB08'],
      alertas,
    };
  }

  // CB09 — base imponible y días en cero sin causal declarada.
  if (baseImponibleConceptos === 0 && situacion.diasTrabajados === 0) {
    alertas.push(
      alerta(
        'CERO_SIN_JUSTIFICAR',
        'advertencia',
        'El cotizante declara base imponible y días trabajados en cero sin causal informada. Permanece en el padrón: un cotizante con 0 días nunca se elimina.',
        ci,
      ),
    );
    return {
      dias: DIAS_MINIMOS,
      movimiento: 'PERMISO',
      incluirEnPadron: true,
      casosAplicados: ['CB09'],
      alertas,
    };
  }

  // CB10 — caso normal.
  return {
    dias: diasClampeados,
    movimiento: 'NORMAL',
    incluirEnPadron: true,
    casosAplicados: ['CB10'],
    alertas,
  };
}
