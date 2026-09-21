/**
 * TESTS — Controles de cierre y conciliación de la liquidación IPS
 * Triangulación de 4 puntos + los 6 controles obligatorios de cierre.
 *
 * Estos controles existen porque el proceso manual anterior presentó ante el IPS un archivo
 * desincronizado y la inconsistencia se detectó a mano, después de la presentación.
 */

import { describe, it, expect } from 'vitest';
import { conciliar4Puntos, ejecutarControlesCierre } from '../controles';
import type { HallazgoControl } from '../controles';
import type {
  ConfiguracionLiquidacionIPS,
  CotizanteIPS,
  PlanillaPatronalIPS,
  ResultadoLiquidacionIPS,
} from '../types';

const PATRONAL_A = '0001234567';

function configBase(overrides?: Partial<ConfiguracionLiquidacionIPS>): ConfiguracionLiquidacionIPS {
  return {
    ruc: '80012345',
    dv: '6',
    razonSocial: 'EMPRESA DEMO S.A.',
    mes: 8,
    anho: 2026,
    salarioMinimoLegal: 3_044_000,
    tasaObreroPorMil: 90,
    tasaPatronalPorMil: 165,
    codigoActividad: '00',
    toleranciaConciliacionGs: 0,
    patronales: [{ numeroPatronal: PATRONAL_A, descripcion: 'Casa central' }],
    ...overrides,
  };
}

function cotizanteBase(overrides?: Partial<CotizanteIPS>): CotizanteIPS {
  return {
    ci: '1000001',
    apellidos: 'PEREZ GOMEZ',
    nombres: 'JUAN CARLOS',
    numeroPatronal: PATRONAL_A,
    dias: 30,
    movimiento: 'NORMAL',
    baseImponible: 4_000_000,
    aporteObrero: 360_000,
    aportePatronal: 660_000,
    aporteTotal: 1_020_000,
    casosAplicados: ['CB10'],
    alertas: [],
    detalle: [],
    ...overrides,
  };
}

function resultadoDe(cotizantes: CotizanteIPS[]): ResultadoLiquidacionIPS {
  const planilla: PlanillaPatronalIPS = {
    numeroPatronal: PATRONAL_A,
    cotizantes,
    totales: {
      cotizantes: cotizantes.length,
      baseImponible: cotizantes.reduce((acc, c) => acc + c.baseImponible, 0),
      aporteObrero: cotizantes.reduce((acc, c) => acc + c.aporteObrero, 0),
      aportePatronal: cotizantes.reduce((acc, c) => acc + c.aportePatronal, 0),
      aporteTotal: cotizantes.reduce((acc, c) => acc + c.aporteTotal, 0),
    },
  };
  return { planillas: cotizantes.length === 0 ? [] : [planilla], totales: planilla.totales, alertas: [], aptoParaPresentar: true };
}

function hallazgo(resultado: ResultadoLiquidacionIPS, id: string): HallazgoControl {
  const encontrado = ejecutarControlesCierre(resultado, configBase()).find((h) => h.id === id);
  if (encontrado === undefined) {
    throw new Error(`No se devolvió el control ${id}`);
  }
  return encontrado;
}

describe('controles IPS - los 6 controles obligatorios de cierre', () => {
  it('C01: siempre devuelve los 6 controles, en orden y sin lanzar', () => {
    const hallazgos = ejecutarControlesCierre(resultadoDe([cotizanteBase()]), configBase());
    expect(hallazgos.map((h) => h.id)).toEqual([
      'CTRL01',
      'CTRL02',
      'CTRL03',
      'CTRL04',
      'CTRL05',
      'CTRL06',
    ]);
  });

  it('C02: con lote vacio los controles quedan conformes y sin C.I. afectadas', () => {
    const hallazgos = ejecutarControlesCierre(resultadoDe([]), configBase());
    expect(hallazgos.every((h) => h.ok)).toBe(true);
    expect(hallazgos.every((h) => h.cies.length === 0)).toBe(true);
  });

  it('C03: CTRL01 conforme sin casos de maternidad y con maternidad en dias 0', () => {
    const sinCasos = hallazgo(resultadoDe([cotizanteBase()]), 'CTRL01');
    expect(sinCasos.ok).toBe(true);
    expect(sinCasos.detalle).toBe('Sin casos de maternidad en el período');

    const maternidadOk = hallazgo(
      resultadoDe([
        cotizanteBase({ ci: '2000002', dias: 0, movimiento: 'REPOSO', casosAplicados: ['CB03'] }),
      ]),
      'CTRL01',
    );
    expect(maternidadOk.ok).toBe(true);
    expect(maternidadOk.cies).toEqual([]);
  });

  it('C04: CTRL01 falla si una maternidad quedo declarada con dias mayores a cero', () => {
    const control = hallazgo(
      resultadoDe([cotizanteBase({ ci: '2000002', dias: 5, casosAplicados: ['CB03'] })]),
      'CTRL01',
    );
    expect(control.ok).toBe(false);
    expect(control.cies).toEqual(['2000002']);
  });

  it('C05: CTRL02 detecta los reposos por debajo del minimo y exige el estirado manual en REI', () => {
    const conforme = hallazgo(resultadoDe([cotizanteBase()]), 'CTRL02');
    expect(conforme.ok).toBe(true);
    expect(conforme.detalle).toContain('REI');

    const conAlerta = hallazgo(
      resultadoDe([
        cotizanteBase({
          ci: '3000003',
          baseImponible: 2_900_000,
          alertas: [
            {
              codigo: 'EXT_MONTO_MENOR_AL_MINIMO',
              severidad: 'advertencia',
              mensaje: 'Base por debajo del mínimo.',
            },
          ],
        }),
      ]),
      'CTRL02',
    );
    expect(conAlerta.ok).toBe(false);
    expect(conAlerta.cies).toEqual(['3000003']);
    expect(conAlerta.detalle).toContain('REI');
  });

  it('C06: CTRL03 falla si un prestador con IVA quedo dentro del padron', () => {
    expect(hallazgo(resultadoDe([cotizanteBase()]), 'CTRL03').ok).toBe(true);

    const conPrestador = hallazgo(
      resultadoDe([cotizanteBase({ ci: '4000004', casosAplicados: ['CB01'] })]),
      'CTRL03',
    );
    expect(conPrestador.ok).toBe(false);
    expect(conPrestador.cies).toEqual(['4000004']);
  });

  it('C07: CTRL04 exige que todo cero tenga un movimiento que lo justifique', () => {
    expect(
      hallazgo(
        resultadoDe([cotizanteBase({ dias: 0, movimiento: 'REPOSO', casosAplicados: ['CB05'] })]),
        'CTRL04',
      ).ok,
    ).toBe(true);

    const injustificado = hallazgo(
      resultadoDe([cotizanteBase({ ci: '5000005', dias: 0, movimiento: 'NORMAL' })]),
      'CTRL04',
    );
    expect(injustificado.ok).toBe(false);
    expect(injustificado.cies).toEqual(['5000005']);
  });

  it('C08: CTRL05 detecta C.I. duplicadas de forma insensible a mayusculas', () => {
    expect(hallazgo(resultadoDe([cotizanteBase()]), 'CTRL05').ok).toBe(true);

    const duplicado = hallazgo(
      resultadoDe([
        cotizanteBase({ ci: '1154471A' }),
        cotizanteBase({ ci: '1154471a', apellidos: 'GONZALEZ ORTIZ' }),
      ]),
      'CTRL05',
    );
    expect(duplicado.ok).toBe(false);
    expect(duplicado.cies).toEqual(['1154471A']);
  });

  it('C09: CTRL06 valida el ancho exacto del archivo 121 y expone el error del builder', () => {
    const conforme = hallazgo(resultadoDe([cotizanteBase()]), 'CTRL06');
    expect(conforme.ok).toBe(true);
    expect(conforme.detalle).toContain('121');

    // Un apellido que excede el ancho del campo hace que el builder lance: el control lo captura
    // y lo reporta como hallazgo fallido en vez de propagar la excepcion.
    const desborde = hallazgo(
      resultadoDe([cotizanteBase({ ci: '6000006', apellidos: 'A'.repeat(31) })]),
      'CTRL06',
    );
    expect(desborde.ok).toBe(false);
    expect(desborde.detalle).toContain('no pudo generarse');
  });
});

describe('controles IPS - triangulacion de 4 puntos', () => {
  it('C10: cierra cuando las cuatro fuentes coinciden dentro de la tolerancia', () => {
    const resultado = conciliar4Puntos(10_000_000, 10_000_000, 10_000_000, 10_000_000, 0);
    expect(resultado.puntos).toHaveLength(4);
    expect(resultado.puntos.map((p) => p.fuente)).toEqual([
      'Archivos planos generados',
      'Extracto oficial del IPS',
      'Target de contabilidad',
      'Excel de haberes',
    ]);
    expect(resultado.delta).toBe(0);
    expect(resultado.cierra).toBe(true);
  });

  it('C11: NO declara cierre sin evidencia cuando no hay ninguna fuente adicional', () => {
    const resultado = conciliar4Puntos(10_000_000, undefined, undefined, undefined, 0);
    expect(resultado.puntos.filter((p) => p.disponible)).toHaveLength(1);
    expect(resultado.cierra).toBe(false);
    expect(resultado.delta).toBe(0);
    expect(resultado.mensaje).toContain('falta de evidencia');
  });

  it('C12: tolera la diferencia del guaraní cuando la tolerancia lo permite', () => {
    const resultado = conciliar4Puntos(10_000_000, 10_000_001, undefined, undefined, 1);
    expect(resultado.delta).toBe(1);
    expect(resultado.cierra).toBe(true);

    const estricto = conciliar4Puntos(10_000_000, 10_000_001, undefined, undefined, 0);
    expect(estricto.cierra).toBe(false);
  });

  it('C13: informa la mayor diferencia y detalla cada fuente cuando no cierra', () => {
    const resultado = conciliar4Puntos(10_000_000, 9_999_000, 10_000_000, undefined, 0);
    expect(resultado.delta).toBe(1_000);
    expect(resultado.cierra).toBe(false);
    expect(resultado.mensaje).toContain('Extracto oficial del IPS');
    expect(resultado.mensaje).not.toContain('Excel de haberes');
  });
});
