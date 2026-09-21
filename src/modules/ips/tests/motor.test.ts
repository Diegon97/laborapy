/**
 * TESTS — Motor de liquidación IPS
 * Decreto-Ley N.º 1860/50, Art. 76 · Ley N.º 5508/15 · Ley N.º 6339/19
 */

import { describe, it, expect } from 'vitest';
import { liquidarPeriodoIPS } from '../motor';
import { aplicarTasaPorMil } from '../aritmetica';
import type {
  AlertaIPS,
  CodigoAlertaIPS,
  ConfiguracionLiquidacionIPS,
  CotizanteIPS,
  ResultadoLiquidacionIPS,
  SituacionLaboralIPS,
} from '../types';

const PATRONAL_A = '0001234567';
const PATRONAL_B = '0007894561';
const SML = 3_044_000;

function configBase(overrides?: Partial<ConfiguracionLiquidacionIPS>): ConfiguracionLiquidacionIPS {
  return {
    ruc: '80012345',
    dv: '6',
    razonSocial: 'EMPRESA DEMO S.A.',
    mes: 8,
    anho: 2026,
    salarioMinimoLegal: SML,
    tasaObreroPorMil: 90,
    tasaPatronalPorMil: 165,
    codigoActividad: '00',
    toleranciaConciliacionGs: 0,
    patronales: [
      { numeroPatronal: PATRONAL_A, descripcion: 'Casa central' },
      { numeroPatronal: PATRONAL_B, sucursalId: 'suc-2', descripcion: 'Sucursal 2' },
    ],
    ...overrides,
  };
}

function situacionBase(overrides?: Partial<SituacionLaboralIPS>): SituacionLaboralIPS {
  return {
    ci: '1000001',
    apellidos: 'PEREZ GOMEZ',
    nombres: 'JUAN CARLOS',
    numeroPatronal: PATRONAL_A,
    vinculo: 'cotizante',
    diasTrabajados: 30,
    diasReposo: 0,
    diasVacaciones: 0,
    diasAusencia: 0,
    esReposoMaternidad: false,
    subsidioAdelantadoPorEmpleador: 0,
    coberturaReposoPorcentaje: 0,
    conceptos: [{ etiqueta: 'SALARIO BASE', monto: SML }],
    ...overrides,
  };
}

/**
 * Reúne alertas globales y por cotizante para que las aserciones no dependan
 * de si el motor adjuntó la alerta al lote o a la línea.
 */
function todasLasAlertas(resultado: ResultadoLiquidacionIPS): AlertaIPS[] {
  const alertas: AlertaIPS[] = [...resultado.alertas];
  for (const planilla of resultado.planillas) {
    for (const cotizante of planilla.cotizantes) {
      alertas.push(...cotizante.alertas);
    }
  }
  return alertas;
}

function buscarAlerta(
  resultado: ResultadoLiquidacionIPS,
  codigo: CodigoAlertaIPS,
): AlertaIPS | undefined {
  return todasLasAlertas(resultado).find((alerta) => alerta.codigo === codigo);
}

function primerCotizante(resultado: ResultadoLiquidacionIPS): CotizanteIPS {
  return resultado.planillas[0].cotizantes[0];
}

function ciEnPlanillas(resultado: ResultadoLiquidacionIPS, ci: string): boolean {
  return resultado.planillas.some((planilla) =>
    planilla.cotizantes.some((cotizante) => cotizante.ci === ci),
  );
}

describe('motor IPS - liquidacion de periodo', () => {
  it('A01: lote vacio devuelve planillas vacias, totales en cero y apto para presentar', () => {
    const resultado = liquidarPeriodoIPS([], configBase());
    expect(resultado.planillas).toEqual([]);
    expect(resultado.totales.cotizantes).toBe(0);
    expect(resultado.totales.baseImponible).toBe(0);
    expect(resultado.totales.aporteObrero).toBe(0);
    expect(resultado.totales.aportePatronal).toBe(0);
    expect(resultado.totales.aporteTotal).toBe(0);
    expect(resultado.aptoParaPresentar).toBe(true);
  });

  it('A02: cotizante normal mes completo (30 dias) con aportes al 9% y 16,5%', () => {
    const situacion = situacionBase({
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_000 }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.dias).toBe(30);
    expect(cotizante.movimiento).toBe('NORMAL');
    expect(cotizante.baseImponible).toBe(4_000_000);
    expect(cotizante.aporteObrero).toBe(360_000); // 4.000.000 x 90 / 1000
    expect(cotizante.aportePatronal).toBe(660_000); // 4.000.000 x 165 / 1000
    expect(cotizante.aporteTotal).toBe(1_020_000);
  });

  it('A03: aguinaldo y bonificacion familiar quedan fuera de la base imponible', () => {
    const situacion = situacionBase({
      conceptos: [
        { etiqueta: 'SALARIO BASE', monto: 4_000_000 },
        { etiqueta: 'AGUINALDO PROPORCIONAL', monto: 1_000_000 },
        { etiqueta: 'BONIFICACION FAMILIAR', monto: 152_200 },
      ],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.baseImponible).toBe(4_000_000);
    expect(cotizante.detalle).toHaveLength(3);
    const aguinaldo = cotizante.detalle.find((d) => d.etiqueta === 'AGUINALDO PROPORCIONAL');
    const bonificacion = cotizante.detalle.find((d) => d.etiqueta === 'BONIFICACION FAMILIAR');
    expect(aguinaldo?.grava).toBe(false);
    expect(aguinaldo?.clase).toBe('exento');
    expect(bonificacion?.grava).toBe(false);
    expect(bonificacion?.clase).toBe('exento');
  });

  it('A04: maternidad fuerza dias 0, movimiento REPOSO y alerta por dias trabajados', () => {
    const situacion = situacionBase({
      esReposoMaternidad: true,
      diasTrabajados: 10,
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_000 }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.dias).toBe(0);
    expect(cotizante.movimiento).toBe('REPOSO');
    expect(cotizante.casosAplicados).toContain('CB03');
    expect(cotizante.alertas.map((alerta) => alerta.codigo)).toContain(
      'MATERNIDAD_DIAS_MAYOR_A_CERO',
    );
  });

  it('A05: reposo corto con base bajo el minimo emite EXT_MONTO_MENOR_AL_MINIMO sin bloquear', () => {
    // Caso 2 del protocolo IPS: reposo de 1 a 7 dias, base prorrateada por debajo del SML.
    // El validador REI rechaza la planilla y la unica salida es el estirado manual del reposo.
    // El motor DEBE advertirlo: con dias > 0 el piso minimo no esta justificado.
    const situacion = situacionBase({
      diasReposo: 3,
      diasTrabajados: 27,
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 2_900_000 }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.movimiento).toBe('REPOSO');
    expect(cotizante.dias).toBe(27);
    expect(cotizante.casosAplicados).toContain('CB06');
    const alerta = buscarAlerta(resultado, 'EXT_MONTO_MENOR_AL_MINIMO');
    expect(alerta?.severidad).toBe('advertencia');
    expect(resultado.aptoParaPresentar).toBe(true);
  });

  it('A06: concepto desconocido no grava, queda fuera de la base y advierte', () => {
    const situacion = situacionBase({
      conceptos: [
        { etiqueta: 'SALARIO BASE', monto: 4_000_000 },
        { etiqueta: 'VIATICO ESPECIAL XXX', monto: 500_000 },
      ],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.baseImponible).toBe(4_000_000);
    const desconocido = cotizante.detalle.find(
      (d) => d.conceptoCanonico === 'CONCEPTO_DESCONOCIDO',
    );
    expect(desconocido?.clase).toBe('desconocido');
    expect(desconocido?.grava).toBe(false);
    const alerta = buscarAlerta(resultado, 'CONCEPTO_DESCONOCIDO');
    expect(alerta?.severidad).toBe('advertencia');
  });

  it('A07: concepto en USD sin tipo de cambio bloquea la liquidacion', () => {
    const situacion = situacionBase({
      conceptos: [{ etiqueta: 'SUELDO USD', monto: 1000, moneda: 'USD' }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const alerta = buscarAlerta(resultado, 'FX_USD_REQUERIDO');
    expect(alerta?.severidad).toBe('bloqueante');
    expect(resultado.planillas).toEqual([]);
    expect(resultado.totales.cotizantes).toBe(0);
    expect(resultado.aptoParaPresentar).toBe(false);
  });

  it('A08: concepto en USD con tipo de cambio se convierte a guaranies y aporta', () => {
    const situacion = situacionBase({
      conceptos: [{ etiqueta: 'SUELDO USD', monto: 1000, moneda: 'USD' }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase({ tipoCambioUsdPyg: 7930 }));
    const cotizante = primerCotizante(resultado);
    // 1.000 USD x 7.930 = 7.930.000 Gs.
    expect(cotizante.baseImponible).toBe(7_930_000);
    expect(cotizante.aporteObrero).toBe(713_700); // 7.930.000 x 90 / 1000
    expect(cotizante.aportePatronal).toBe(1_308_450); // 7.930.000 x 165 / 1000
  });

  it('A09: C.I. alfanumerica se conserva tal cual sin romper la planilla', () => {
    const situacion = situacionBase({ ci: '1154471A' });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(primerCotizante(resultado).ci).toBe('1154471A');
  });

  it('A10: C.I. duplicada bloquea y conserva la primera del array de entrada', () => {
    const primera = situacionBase({
      ci: '1000001',
      apellidos: 'PEREZ GOMEZ',
      nombres: 'JUAN CARLOS',
    });
    const segunda = situacionBase({
      ci: '1000001',
      apellidos: 'GONZALEZ ORTIZ',
      nombres: 'MARIA ELISA',
    });
    const resultado = liquidarPeriodoIPS([primera, segunda], configBase());
    const alerta = buscarAlerta(resultado, 'CI_DUPLICADA');
    expect(alerta?.severidad).toBe('bloqueante');
    expect(resultado.planillas[0].cotizantes).toHaveLength(1);
    expect(resultado.planillas[0].cotizantes[0].apellidos).toBe('PEREZ GOMEZ');
    expect(resultado.aptoParaPresentar).toBe(false);
  });

  it('A11: patronal inexistente bloquea y excluye a la persona de toda planilla', () => {
    const situacion = situacionBase({ numeroPatronal: '0009999999' });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(buscarAlerta(resultado, 'PATRONAL_INEXISTENTE')?.severidad).toBe('bloqueante');
    expect(ciEnPlanillas(resultado, '1000001')).toBe(false);
  });

  it('A12: patronal invalida en configuracion bloquea la presentacion', () => {
    const resultado = liquidarPeriodoIPS(
      [situacionBase()],
      configBase({ patronales: [{ numeroPatronal: '123', descripcion: 'mala' }] }),
    );
    expect(buscarAlerta(resultado, 'PATRONAL_INVALIDA')?.severidad).toBe('bloqueante');
    expect(resultado.aptoParaPresentar).toBe(false);
  });

  it('A13: periodo invalido (mes 13) bloquea la presentacion', () => {
    const resultado = liquidarPeriodoIPS([situacionBase()], configBase({ mes: 13 }));
    expect(buscarAlerta(resultado, 'PERIODO_INVALIDO')?.severidad).toBe('bloqueante');
    expect(resultado.aptoParaPresentar).toBe(false);
  });

  it('A14: dias trabajados fuera de rango bloquea y se clampea a 30', () => {
    const resultado = liquidarPeriodoIPS([situacionBase({ diasTrabajados: 45 })], configBase());
    expect(buscarAlerta(resultado, 'DIAS_FUERA_DE_RANGO')?.severidad).toBe('bloqueante');
    expect(primerCotizante(resultado).dias).toBe(30);
  });

  it('A15: multi-patronal agrupa por numero patronal y consolida totales', () => {
    const personas = [
      situacionBase({
        ci: '1000001',
        apellidos: 'PEREZ GOMEZ',
        numeroPatronal: PATRONAL_A,
        conceptos: [{ etiqueta: 'SALARIO BASE', monto: SML }],
      }),
      situacionBase({
        ci: '2000002',
        apellidos: 'GONZALEZ ORTIZ',
        numeroPatronal: PATRONAL_A,
        conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_000 }],
      }),
      situacionBase({
        ci: '3000003',
        apellidos: 'BENITEZ ACOSTA',
        numeroPatronal: PATRONAL_B,
        conceptos: [{ etiqueta: 'SALARIO BASE', monto: 5_000_000 }],
      }),
    ];
    const resultado = liquidarPeriodoIPS(personas, configBase());
    expect(resultado.planillas).toHaveLength(2);
    expect(resultado.planillas[0].numeroPatronal).toBe(PATRONAL_A);
    expect(resultado.planillas[0].cotizantes).toHaveLength(2);
    expect(resultado.planillas[1].numeroPatronal).toBe(PATRONAL_B);
    expect(resultado.planillas[1].cotizantes).toHaveLength(1);
    expect(resultado.totales.cotizantes).toBe(3);
    expect(resultado.totales.baseImponible).toBe(SML + 4_000_000 + 5_000_000);
  });

  it('A16: orden alfabetico determinista por (apellidos, nombres, ci)', () => {
    const personas = [
      situacionBase({ ci: '3000003', apellidos: 'ZAPATA DIAZ', nombres: 'ANA' }),
      situacionBase({ ci: '1000001', apellidos: 'BENITEZ ACOSTA', nombres: 'MARIO' }),
      situacionBase({ ci: '2000002', apellidos: 'ALVAREZ GIMENEZ', nombres: 'LUCIA' }),
    ];
    const primero = liquidarPeriodoIPS(personas, configBase());
    const segundo = liquidarPeriodoIPS(personas, configBase());
    expect(primero.planillas[0].cotizantes.map((c) => c.apellidos)).toEqual([
      'ALVAREZ GIMENEZ',
      'BENITEZ ACOSTA',
      'ZAPATA DIAZ',
    ]);
    expect(segundo).toEqual(primero);
  });

  it('A17: el total es la suma de los redondeos individuales, no el porcentaje del agregado', () => {
    // Base 1 = 4.000.080 -> 4.000.080 x 90 / 1000 = 360.007,2 -> half-up 360.007
    // Base 2 = 4.000.060 -> 4.000.060 x 90 / 1000 = 360.005,4 -> half-up 360.005
    // Suma de redondeos individuales = 720.012
    // Agregado = 8.000.140 -> 8.000.140 x 90 / 1000 = 720.012,6 -> half-up 720.013 (difiere en 1)
    const personas = [
      situacionBase({
        ci: '1000001',
        apellidos: 'PEREZ GOMEZ',
        conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_080 }],
      }),
      situacionBase({
        ci: '2000002',
        apellidos: 'GONZALEZ ORTIZ',
        conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_060 }],
      }),
    ];
    const resultado = liquidarPeriodoIPS(personas, configBase());
    expect(aplicarTasaPorMil(4_000_080, 90)).toBe(360_007);
    expect(aplicarTasaPorMil(4_000_060, 90)).toBe(360_005);
    expect(resultado.totales.aporteObrero).toBe(720_012);
    expect(aplicarTasaPorMil(8_000_140, 90)).toBe(720_013);
    expect(resultado.totales.aporteObrero).not.toBe(aplicarTasaPorMil(8_000_140, 90));
  });

  it('A18: prestador con factura e I.V.A. queda fuera del padron y alerta PRESTADOR_IVA_INCLUIDO', () => {
    const situacion = situacionBase({
      vinculo: 'factura',
      conceptos: [{ etiqueta: 'I.V.A.', monto: 500_000 }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(ciEnPlanillas(resultado, '1000001')).toBe(false);
    expect(resultado.alertas.map((a) => a.codigo)).toContain('PRESTADOR_IVA_INCLUIDO');
  });

  it('A19: cero justificado por reposo prolongado no elimina al cotizante del padron', () => {
    const situacion = situacionBase({
      diasTrabajados: 0,
      diasReposo: 30,
      conceptos: [],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(ciEnPlanillas(resultado, '1000001')).toBe(true);
    const cotizante = primerCotizante(resultado);
    expect(cotizante.dias).toBe(0);
    expect(cotizante.movimiento).toBe('REPOSO');
    expect(cotizante.baseImponible).toBe(0);
  });

  it('A20: tiempo parcial prorratea el piso minimo por horas contratadas', () => {
    // Piso prorrateado = 3.044.000 x 24 / 48 = 1.522.000
    const conHoras = situacionBase({
      vinculo: 'tiempo_parcial',
      horasContratadasSemana: 24,
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 1_522_000 }],
    });
    const resultadoConHoras = liquidarPeriodoIPS([conHoras], configBase());
    expect(buscarAlerta(resultadoConHoras, 'EXT_MONTO_MENOR_AL_MINIMO')).toBeUndefined();
    expect(primerCotizante(resultadoConHoras).casosAplicados).toContain('CB08');

    // Sin horas contratadas no se prorratea: rige el piso completo y corresponde alertar.
    const sinHoras = situacionBase({
      vinculo: 'tiempo_parcial',
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 1_522_000 }],
    });
    const resultadoSinHoras = liquidarPeriodoIPS([sinHoras], configBase());
    expect(buscarAlerta(resultadoSinHoras, 'EXT_MONTO_MENOR_AL_MINIMO')?.severidad).toBe(
      'advertencia',
    );
    expect(buscarAlerta(resultadoSinHoras, 'TIEMPO_PARCIAL_SIN_PRORRATA')?.severidad).toBe(
      'advertencia',
    );
  });

  it('A21: reposo corto que iguala o supera el minimo no emite alerta de piso', () => {
    const situacion = situacionBase({
      diasReposo: 4,
      diasTrabajados: 26,
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 4_000_000 }],
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(primerCotizante(resultado).movimiento).toBe('REPOSO');
    expect(buscarAlerta(resultado, 'EXT_MONTO_MENOR_AL_MINIMO')).toBeUndefined();
  });

  it('A22: egreso en el periodo con base proporcional no emite alerta de piso', () => {
    const situacion = situacionBase({
      diasTrabajados: 14,
      conceptos: [{ etiqueta: 'SALARIO BASE', monto: 1_420_000 }],
      egresoEnPeriodo: { fecha: '2026-08-14', motivo: 'Egreso en el período' },
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    expect(primerCotizante(resultado).casosAplicados).toContain('CB07');
    expect(buscarAlerta(resultado, 'EXT_MONTO_MENOR_AL_MINIMO')).toBeUndefined();
  });

  it('A23: subsidio adelantado por el empleador integra la base cuando no hay conceptos', () => {
    const situacion = situacionBase({
      diasTrabajados: 0,
      diasReposo: 30,
      conceptos: [],
      subsidioAdelantadoPorEmpleador: 3_044_000,
    });
    const resultado = liquidarPeriodoIPS([situacion], configBase());
    const cotizante = primerCotizante(resultado);
    expect(cotizante.baseImponible).toBe(3_044_000);
    expect(cotizante.aporteObrero).toBe(273_960); // 3.044.000 x 90 / 1000
    expect(cotizante.aportePatronal).toBe(502_260); // 3.044.000 x 165 / 1000
    expect(cotizante.dias).toBe(0);
  });
});
