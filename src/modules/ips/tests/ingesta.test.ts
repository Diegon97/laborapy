/**
 * TESTS — Capa de ingesta del módulo IPS
 * Descubrimiento por firma de contenido, normalización y consolidación del período.
 *
 * Decreto-Ley N.º 1860/50, Art. 76 · protocolo universal de liquidación IPS §3.
 */

import { describe, it, expect } from 'vitest';
import {
  buscarColumna,
  normalizarCi,
  normalizarEncabezado,
  parsearCantidad,
  parsearMontoGs,
  textoDeCelda,
} from '../ingesta/normalizacion';
import { clasificarTabla, inventariarFuentes } from '../ingesta/descubrimiento';
import { consolidarPeriodoIPS } from '../ingesta/consolidacion';
import type { Tabla } from '../ingesta/tipos';
import type { ConfiguracionLiquidacionIPS } from '../types';

const PATRONAL_A = '0001234567';
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
    patronales: [{ numeroPatronal: PATRONAL_A, descripcion: 'Casa central' }],
    ...overrides,
  };
}

/** Nómina mensual: firma A (identificación + haberes + líquido + bonificación familiar). */
const TABLA_NOMINA: Tabla = {
  origen: 'planilla.xls',
  encabezados: [
    'C.I.',
    'Apellidos',
    'Nombres',
    'Salario Base',
    'Bonificación Familiar',
    'Neto',
    'Días Trabajados',
    'Legajo',
  ],
  filas: [
    ['1.000.001', 'Perez Gomez', 'Juan Carlos', '3.500.000', '152.200', '3.185.900', '30', '0001'],
    ['2000002', 'Gonzalez Ortiz', 'Maria Elisa', '4.000.000', '0', '3.640.000', '30', '0002'],
    ['1154471A', 'Benitez Acosta', 'Luis Alberto', '5.000.000', '304.400', '4.550.000', '30', '0003'],
  ],
};

/** Comisiones por legajo: firma B (comisión + identificación + celda numérica). */
const TABLA_COMISIONES: Tabla = {
  origen: 'comisiones.prn',
  encabezados: ['Legajo', 'Comisión'],
  filas: [
    ['0001', '500.000'],
    ['0003', '250.000'],
  ],
};

/** Target de contabilidad: firma D (cuenta contable 402xxxx + rótulo BASE IMPONIBLE). */
const TABLA_CONTABILIDAD: Tabla = {
  origen: 'resumen contable.xlsx',
  encabezados: ['Cuenta', 'Concepto', 'Monto'],
  filas: [
    ['4020102', 'Sueldos y Jornales', '13.250.000'],
    ['BASE IMPONIBLE', '', '13.250.000'],
  ],
};

describe('ingesta IPS - normalizacion', () => {
  it('D01: normalizarEncabezado homologa acentos, separadores y mayúsculas', () => {
    expect(normalizarEncabezado('N° de Documento')).toBe('N DE DOCUMENTO');
    expect(normalizarEncabezado('C.I.')).toBe('C I');
    expect(normalizarEncabezado('Salario_Base')).toBe('SALARIO BASE');
    expect(normalizarEncabezado('Hab c/ret')).toBe('HAB C RET');
    expect(normalizarEncabezado('  Bonificación   Familiar ')).toBe('BONIFICACION FAMILIAR');
  });

  it('D02: normalizarCi limpia separadores y NUNCA descarta las letras del extranjero', () => {
    expect(normalizarCi('1.234.567')).toBe('1234567');
    expect(normalizarCi('1.154.471-A')).toBe('1154471A');
    expect(normalizarCi('1154471A')).toBe('1154471A');
    expect(normalizarCi('')).toBe('');
  });

  it('D03: parsearMontoGs interpreta la convención paraguaya y la anglosajona', () => {
    expect(parsearMontoGs('3.500.000')).toBe(3_500_000);
    expect(parsearMontoGs('3500000')).toBe(3_500_000);
    expect(parsearMontoGs('Gs. 3.500.000')).toBe(3_500_000);
    expect(parsearMontoGs('₲ 3.500.000')).toBe(3_500_000);
    expect(parsearMontoGs('3,500,000.00')).toBe(3_500_000);
    expect(parsearMontoGs('1.500')).toBe(1500);
    expect(parsearMontoGs('1.50')).toBe(2);
  });

  it('D04: parsearMontoGs redondea el decimal con half-up y no con aritmética flotante', () => {
    // 3.500.000,50 Gs -> 3500001 (half-up)
    expect(parsearMontoGs('3.500.000,50')).toBe(3_500_001);
    // 3.500.000,49 Gs -> 3500000
    expect(parsearMontoGs('3.500.000,49')).toBe(3_500_000);
  });

  it('D05: parsearMontoGs maneja negativos contables y valores no monetarios', () => {
    expect(parsearMontoGs('(1.000.000)')).toBe(-1_000_000);
    expect(parsearMontoGs('-1.000.000')).toBe(-1_000_000);
    expect(parsearMontoGs('')).toBeUndefined();
    expect(parsearMontoGs('-')).toBeUndefined();
    expect(parsearMontoGs('N/A')).toBeUndefined();
    expect(parsearMontoGs('S/D')).toBeUndefined();
  });

  it('D06: parsearCantidad devuelve enteros no negativos', () => {
    expect(parsearCantidad('30')).toBe(30);
    expect(parsearCantidad('30,00')).toBe(30);
    expect(parsearCantidad(' 30 ')).toBe(30);
    expect(parsearCantidad('-5')).toBeUndefined();
    expect(parsearCantidad('sin dato')).toBeUndefined();
  });

  it('D07: buscarColumna prioriza la coincidencia exacta e ignora espacios internos', () => {
    const encabezados = ['C.I.', 'Apellidos', 'Salario Base Mensual', 'Neto'];
    expect(buscarColumna(encabezados, ['CI'])).toBe(0);
    expect(buscarColumna(encabezados, ['APELLIDOS'])).toBe(1);
    // La clave se encuentra por inclusión dentro del encabezado.
    expect(buscarColumna(encabezados, ['SALARIO BASE'])).toBe(2);
    expect(buscarColumna(encabezados, ['COMISIONES'])).toBe(-1);
  });

  it('D08: textoDeCelda convierte celdas crudas de forma determinista', () => {
    expect(textoDeCelda(undefined)).toBe('');
    expect(textoDeCelda(null)).toBe('');
    expect(textoDeCelda(3500000)).toBe('3500000');
    expect(textoDeCelda(3500000.5)).toBe('3500000.50');
    expect(textoDeCelda(true)).toBe('SI');
    expect(textoDeCelda(false)).toBe('NO');
    expect(textoDeCelda('texto')).toBe('texto');
  });
});

describe('ingesta IPS - descubrimiento por firma de contenido', () => {
  it('D09: clasifica la nomina como tipo A con confianza alta', () => {
    const fuente = clasificarTabla(TABLA_NOMINA);
    expect(fuente.tipos).toEqual(['A']);
    expect(fuente.confianza).toBe('alta');
    expect(fuente.firmaDetectada.length).toBeGreaterThan(0);
    expect(fuente.firmaDetectada.every((firma) => firma.startsWith('A:'))).toBe(true);
  });

  it('D10: clasifica las comisiones como tipo B y la contabilidad como tipo D', () => {
    expect(clasificarTabla(TABLA_COMISIONES).tipos).toEqual(['B']);
    const contabilidad = clasificarTabla(TABLA_CONTABILIDAD);
    expect(contabilidad.tipos).toEqual(['D']);
    expect(contabilidad.firmaDetectada).toContain('D:4020102');
  });

  it('D11: clasifica una acreditacion bancaria como tipo C por sus frases, no por el nombre', () => {
    const banco: Tabla = {
      origen: 'archivo_sin_nombre_util.dat',
      encabezados: ['N° de Cuenta', 'Denominación', 'Importe'],
      filas: [['1234567890', 'PEREZ GOMEZ JUAN CARLOS', '3.185.900']],
    };
    expect(clasificarTabla(banco).tipos).toContain('C');
  });

  it('D12: clasifica un finiquito como tipo E', () => {
    const finiquito: Tabla = {
      origen: 'liquidaciones del mes.xlsx',
      encabezados: ['C.I.', 'Nombre Completo', 'Monto Imponible Final', 'Fecha Egreso'],
      filas: [['3000003', 'BENITEZ ACOSTA LUIS ALBERTO', '2.000.000', '2026-08-14']],
    };
    expect(clasificarTabla(finiquito).tipos).toContain('E');
  });

  it('D13: una tabla mixta (nomina con comisiones) se marca con confianza media', () => {
    const mixta: Tabla = {
      origen: 'todo junto.xls',
      encabezados: ['C.I.', 'Apellidos', 'Nombres', 'Salario Base', 'Comisiones', 'Neto'],
      filas: [['1000001', 'PEREZ GOMEZ', 'JUAN CARLOS', '3.500.000', '500.000', '3.640.000']],
    };
    const fuente = clasificarTabla(mixta);
    expect(fuente.tipos).toEqual(['A', 'B']);
    expect(fuente.confianza).toBe('media');
  });

  it('D14: una tabla ajena a toda firma no se clasifica y se advierte', () => {
    const ajena: Tabla = {
      origen: 'lista de precios.xlsx',
      encabezados: ['Producto', 'Precio'],
      filas: [['Cemento', '45.000']],
    };
    const fuente = clasificarTabla(ajena);
    expect(fuente.tipos).toEqual([]);
    expect(fuente.confianza).toBe('media');

    const { alertas } = inventariarFuentes([ajena]);
    expect(alertas.some((alerta) => alerta.codigo === 'FUENTE_NO_CLASIFICADA')).toBe(true);
  });

  it('D15: el inventario reporta los tipos faltantes criticos y no los no criticos', () => {
    const { inventario, alertas } = inventariarFuentes([TABLA_NOMINA]);
    expect(inventario.porTipo.A).toHaveLength(1);
    expect(inventario.porTipo.B).toHaveLength(0);
    // B y D faltan; C y E NO son criticos.
    expect(inventario.faltantesCriticos).toEqual(['B', 'D']);
    expect(alertas.filter((alerta) => alerta.codigo === 'FUENTE_CRITICA_AUSENTE')).toHaveLength(2);
  });

  it('D16: un lote vacio produce una unica alerta bloqueante', () => {
    const { inventario, alertas } = inventariarFuentes([]);
    expect(inventario.todas).toEqual([]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].codigo).toBe('SIN_FUENTES');
    expect(alertas[0].severidad).toBe('bloqueante');
  });
});

describe('ingesta IPS - consolidacion del periodo', () => {
  it('D17: consolida nomina + comisiones y acumula las comisiones por legajo', () => {
    const consolidado = consolidarPeriodoIPS(
      [TABLA_NOMINA, TABLA_COMISIONES, TABLA_CONTABILIDAD],
      configBase(),
    );

    // Tres cotizantes: las comisiones se acumulan sobre la persona del legajo, no crean personas.
    expect(consolidado.situaciones).toHaveLength(3);
    expect(consolidado.resultado.totales.cotizantes).toBe(3);

    // Base: 3.500.000 + 500.000 (comision legajo 0001), 4.000.000 y 5.000.000 + 250.000.
    // La bonificacion familiar queda excluida por el catalogo.
    expect(consolidado.resultado.totales.baseImponible).toBe(13_250_000);
    expect(consolidado.resultado.totales.aporteObrero).toBe(1_192_500);
    expect(consolidado.resultado.totales.aportePatronal).toBe(2_186_250);
    expect(consolidado.resultado.totales.aporteTotal).toBe(3_378_750);
  });

  it('D18: normaliza la C.I. con puntos y conserva la alfanumerica del extranjero', () => {
    const consolidado = consolidarPeriodoIPS([TABLA_NOMINA], configBase());
    const cies = consolidado.situaciones.map((situacion) => situacion.ci).sort();
    expect(cies).toEqual(['1000001', '1154471A', '2000002']);
  });

  it('D19: lee el target de la fuente de contabilidad y la conciliacion cierra', () => {
    const consolidado = consolidarPeriodoIPS(
      [TABLA_NOMINA, TABLA_COMISIONES, TABLA_CONTABILIDAD],
      configBase(),
    );
    expect(consolidado.targetUsado).toBe(13_250_000);
    expect(consolidado.conciliacion.cierra).toBe(true);
    expect(consolidado.conciliacion.delta).toBe(0);
    expect(
      consolidado.alertas.some((alerta) => alerta.codigo === 'DIFERENCIA_CONTRA_TARGET'),
    ).toBe(false);
    expect(consolidado.resultado.aptoParaPresentar).toBe(true);
  });

  it('D20: una diferencia contra el target bloquea la presentacion', () => {
    const consolidado = consolidarPeriodoIPS(
      [TABLA_NOMINA, TABLA_COMISIONES, TABLA_CONTABILIDAD],
      configBase(),
      { targetContabilidad: 12_500_000 },
    );
    expect(consolidado.targetUsado).toBe(12_500_000);
    expect(consolidado.conciliacion.cierra).toBe(false);
    const alerta = consolidado.alertas.find(
      (item) => item.codigo === 'DIFERENCIA_CONTRA_TARGET',
    );
    expect(alerta?.severidad).toBe('bloqueante');
    expect(alerta?.mensaje).toContain('750.000');
  });

  it('D21: un finiquito que tambien parece nomina solo marca el egreso, sin duplicar', () => {
    const finiquitoConFormaDeNomina: Tabla = {
      origen: 'RM1 agosto.xlsx',
      encabezados: [
        'C.I.',
        'Apellidos',
        'Nombres',
        'Salario Base',
        'Neto a Pagar',
        'Fecha Egreso',
      ],
      filas: [['4000004', 'RAMIREZ SOSA', 'ANA LUCIA', '2.000.000', '1.820.000', '2026-08-14']],
    };

    const consolidado = consolidarPeriodoIPS(
      [TABLA_NOMINA, finiquitoConFormaDeNomina],
      configBase(),
    );

    // Sin C.I. duplicada: la tabla se clasifico A y E a la vez y se proceso una sola vez.
    expect(consolidado.alertas.some((alerta) => alerta.codigo === 'CI_DUPLICADA_ENTRE_FUENTES')).toBe(false);
    expect(consolidado.resultado.totales.cotizantes).toBe(4);

    const egresado = consolidado.resultado.planillas
      .flatMap((planilla) => planilla.cotizantes)
      .find((cotizante) => cotizante.ci === '4000004');
    expect(egresado?.casosAplicados).toContain('CB07');
    expect(egresado?.baseImponible).toBe(2_000_000);
  });

  it('D22: excluye del padron al prestador con IVA y lo alerta', () => {
    const nominaConIva: Tabla = {
      origen: 'prestadores.xls',
      encabezados: ['C.I.', 'Apellidos', 'Nombres', 'Salario Base', 'I.V.A.', 'Neto'],
      filas: [['5000005', 'MOLINAS BENITEZ', 'CARLOS', '2.000.000', '200.000', '2.200.000']],
    };

    const consolidado = consolidarPeriodoIPS([nominaConIva], configBase());
    expect(consolidado.resultado.totales.cotizantes).toBe(0);
    expect(
      consolidado.resultado.alertas.some((alerta) => alerta.codigo === 'PRESTADOR_IVA_INCLUIDO'),
    ).toBe(true);
  });

  it('D23: una fila sin C.I. se omite y se alerta', () => {
    const conFilaRota: Tabla = {
      origen: 'planilla.xls',
      encabezados: ['C.I.', 'Apellidos', 'Nombres', 'Salario Base', 'Neto'],
      filas: [
        ['1000001', 'PEREZ GOMEZ', 'JUAN CARLOS', '3.500.000', '3.185.000'],
        ['', 'SIN DOCUMENTO', 'ANONIMO', '1.000.000', '910.000'],
      ],
    };

    const consolidado = consolidarPeriodoIPS([conFilaRota], configBase());
    expect(consolidado.situaciones).toHaveLength(1);
    expect(consolidado.alertas.some((alerta) => alerta.codigo === 'FILA_SIN_CI')).toBe(true);
  });

  it('D24: un lote vacio no lanza y reporta la ausencia de fuentes', () => {
    const consolidado = consolidarPeriodoIPS([], configBase());
    expect(consolidado.situaciones).toEqual([]);
    expect(consolidado.resultado.planillas).toEqual([]);
    expect(consolidado.targetUsado).toBeUndefined();
    expect(consolidado.conciliacion.cierra).toBe(false);
    expect(consolidado.controles).toHaveLength(6);
    expect(consolidado.controles.every((h) => h.ok)).toBe(true);
    expect(consolidado.alertas.some((alerta) => alerta.codigo === 'SIN_FUENTES')).toBe(true);
  });

  it('D25: la consolidacion es determinista ante la misma entrada', () => {
    const primera = consolidarPeriodoIPS(
      [TABLA_NOMINA, TABLA_COMISIONES, TABLA_CONTABILIDAD],
      configBase(),
    );
    const segunda = consolidarPeriodoIPS(
      [TABLA_NOMINA, TABLA_COMISIONES, TABLA_CONTABILIDAD],
      configBase(),
    );
    expect(segunda).toEqual(primera);
  });
});
