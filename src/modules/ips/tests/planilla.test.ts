/**
 * TESTS — Builders de archivos planos del IPS
 * Formato 121 (oficial aceptado) · formato 109 · delimitado por pipe (REI)
 * Decreto-Ley N.º 1860/50, Art. 76
 */

import { describe, it, expect } from 'vitest';
import {
  ANCHO_LINEA_109,
  ANCHO_LINEA_121,
  aBytesLatin1,
  construirArchivo109,
  construirArchivo121,
  construirArchivoREI,
  construirLinea109,
  construirLinea121,
  nombreArchivo109,
  nombreArchivo121,
  nombreArchivoREI,
  sanitizarTextoIPS,
  validarAnchos,
} from '../planilla';
import type {
  ConfiguracionLiquidacionIPS,
  CotizanteIPS,
  PlanillaPatronalIPS,
  ResultadoLiquidacionIPS,
  TotalesIPS,
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

function totalesDe(cotizantes: CotizanteIPS[]): TotalesIPS {
  return {
    cotizantes: cotizantes.length,
    baseImponible: cotizantes.reduce((acc, c) => acc + c.baseImponible, 0),
    aporteObrero: cotizantes.reduce((acc, c) => acc + c.aporteObrero, 0),
    aportePatronal: cotizantes.reduce((acc, c) => acc + c.aportePatronal, 0),
    aporteTotal: cotizantes.reduce((acc, c) => acc + c.aporteTotal, 0),
  };
}

function planillaDe(cotizantes: CotizanteIPS[]): PlanillaPatronalIPS {
  return { numeroPatronal: PATRONAL_A, cotizantes, totales: totalesDe(cotizantes) };
}

function resultadoDe(planillas: PlanillaPatronalIPS[]): ResultadoLiquidacionIPS {
  const cotizantes = planillas.flatMap((p) => p.cotizantes);
  return {
    planillas,
    totales: totalesDe(cotizantes),
    alertas: [],
    aptoParaPresentar: true,
  };
}

function lineasDe(texto: string): string[] {
  const partes = texto.split('\r\n');
  if (partes[partes.length - 1] === '') partes.pop();
  return partes;
}

describe('planilla IPS - formato posicional 121 (oficial aceptado)', () => {
  it('B01: la linea mide exactamente 121 caracteres y termina en CRLF', () => {
    const linea = construirLinea121(cotizanteBase(), configBase());
    expect(linea).toHaveLength(ANCHO_LINEA_121);
    expect(ANCHO_LINEA_121).toBe(121);

    const archivo = construirArchivo121(planillaDe([cotizanteBase()]), configBase());
    expect(archivo.endsWith('\r\n')).toBe(true);
    expect(archivo.includes('\n\r')).toBe(false);
    expect(archivo.replace(/\r\n/g, '')).not.toContain('\n');
    expect(archivo.replace(/\r\n/g, '')).not.toContain('\r');
  });

  it('B02: cada campo cae en el offset verificado contra un archivo real aceptado por el IPS', () => {
    const linea = construirLinea121(cotizanteBase(), configBase());
    expect(linea.substring(0, 10)).toBe('0001234567'); // patronal
    expect(linea.substring(10, 20)).toBe(' '.repeat(10)); // nro asegurado, siempre vacio
    expect(linea.substring(20, 30)).toBe('1000001   '); // C.I. alineada a la izquierda
    expect(linea.substring(30, 60)).toBe('PEREZ GOMEZ'.padEnd(30, ' ')); // apellidos
    expect(linea.substring(60, 90)).toBe('JUAN CARLOS'.padEnd(30, ' ')); // nombres
    expect(linea.charAt(90)).toBe('E'); // categoria
    expect(linea.substring(91, 93)).toBe('30'); // dias, alineado a la derecha
    expect(linea.substring(93, 103)).toBe('   4000000'); // salario imponible
    expect(linea.substring(103, 109)).toBe('082026'); // periodo MMAAAA
    expect(linea.substring(109, 111)).toBe('00'); // codigo de actividad
    expect(linea.substring(111, 121)).toBe('   4000000'); // salario real
  });

  it('B03: la C.I. alfanumerica de extranjero entra en el campo de 10 sin perder letras', () => {
    const linea = construirLinea121(cotizanteBase({ ci: '1154471A' }), configBase());
    expect(linea).toHaveLength(ANCHO_LINEA_121);
    expect(linea.substring(20, 30)).toBe('1154471A  ');
  });

  it('B04: los dias 0 se emiten alineados a la derecha y el archivo lleva una linea por cotizante', () => {
    const lineas = lineasDe(
      construirArchivo121(
        planillaDe([
          cotizanteBase({ ci: '1000001', dias: 0, baseImponible: 0, movimiento: 'REPOSO' }),
          cotizanteBase({ ci: '2000002', apellidos: 'GONZALEZ ORTIZ', nombres: 'MARIA ELISA' }),
        ]),
        configBase(),
      ),
    );
    expect(lineas).toHaveLength(2);
    expect(lineas[0].substring(91, 93)).toBe(' 0');
    expect(lineas[0].substring(93, 103)).toBe('         0');
    expect(lineas[1].substring(20, 30)).toBe('2000002   ');
  });

  it('B05: el periodo cambia con el mes y diciembre sigue midiendo 6 caracteres', () => {
    const agosto = construirLinea121(cotizanteBase(), configBase({ mes: 8 }));
    const diciembre = construirLinea121(cotizanteBase(), configBase({ mes: 12 }));
    expect(agosto.substring(103, 109)).toBe('082026');
    expect(diciembre.substring(103, 109)).toBe('122026');
    expect(diciembre).toHaveLength(ANCHO_LINEA_121);
  });

  it('B06: sanitizarTextoIPS quita acentos, sube a mayusculas y LANZA si excede el ancho', () => {
    // El saneo no colapsa espacios internos (es un campo de texto, no una etiqueta canonica);
    // lo que importa es que el resultado sea ASCII puro y quepa en el ancho.
    expect(sanitizarTextoIPS('  Benítez  Núñez ', 30)).toBe('BENITEZ  NUNEZ');
    expect(sanitizarTextoIPS('Muñoz González', 30)).toBe('MUNOZ GONZALEZ');
    // Un apellido de mas de 30 caracteres es un error de datos: nunca se trunca en silencio.
    const apellidoLargo = 'A'.repeat(31);
    expect(() => sanitizarTextoIPS(apellidoLargo, 30)).toThrow();
    expect(() =>
      construirLinea121(cotizanteBase({ apellidos: apellidoLargo }), configBase()),
    ).toThrow();
  });

  it('B07: un numero que no cabe en su campo lanza en vez de recortarse', () => {
    // 11 digitos no caben en el campo de 10 del salario imponible.
    expect(() =>
      construirLinea121(cotizanteBase({ baseImponible: 99_999_999_999 }), configBase()),
    ).toThrow();
  });

  it('B08: una C.I. con caracteres invalidos lanza', () => {
    expect(() => construirLinea121(cotizanteBase({ ci: '100-001' }), configBase())).toThrow();
  });
});

describe('planilla IPS - formato posicional 109', () => {
  it('B09: la linea mide exactamente 109 caracteres con C.I. alineada a la derecha', () => {
    const linea = construirLinea109(cotizanteBase(), configBase());
    expect(linea).toHaveLength(ANCHO_LINEA_109);
    expect(ANCHO_LINEA_109).toBe(109);
    expect(linea.substring(0, 10)).toBe('0001234567');
    expect(linea.substring(10, 30)).toBe('1000001'.padStart(20, ' '));
    expect(linea.substring(30, 60)).toBe('PEREZ GOMEZ'.padStart(30, ' '));
    expect(linea.substring(60, 90)).toBe('JUAN CARLOS'.padStart(30, ' '));
    expect(linea.charAt(90)).toBe('E');
    expect(linea.substring(91, 93)).toBe('30');
    expect(linea.substring(93, 103)).toBe('   4000000');
  });

  it('B10: el periodo de 109 mide 6 tanto en agosto como en diciembre', () => {
    const agosto = construirLinea109(cotizanteBase(), configBase({ mes: 8 }));
    const diciembre = construirLinea109(cotizanteBase(), configBase({ mes: 12 }));
    expect(agosto.substring(103, 109)).toBe(' 82026');
    expect(diciembre.substring(103, 109)).toBe('122026');
    expect(agosto).toHaveLength(ANCHO_LINEA_109);
    expect(diciembre).toHaveLength(ANCHO_LINEA_109);
  });

  it('B11: el archivo 109 une las lineas con CRLF y termina con CRLF', () => {
    const archivo = construirArchivo109(
      planillaDe([cotizanteBase(), cotizanteBase({ ci: '2000002' })]),
      configBase(),
    );
    expect(archivo.endsWith('\r\n')).toBe(true);
    expect(lineasDe(archivo)).toHaveLength(2);
  });
});

describe('planilla IPS - utilidades de bytes, diagnostico y nombres', () => {
  it('B12: aBytesLatin1 devuelve los bytes exactos y lanza fuera de Latin-1', () => {
    const bytes = aBytesLatin1('A\r\nB');
    expect(Array.from(bytes)).toEqual([0x41, 0x0d, 0x0a, 0x42]);
    // 'ñ' es U+00F1, dentro de Latin-1; '€' (U+20AC) no lo es.
    expect(Array.from(aBytesLatin1('ñ'))).toEqual([0xf1]);
    expect(() => aBytesLatin1('€')).toThrow();
  });

  it('B13: validarAnchos detecta la linea corrupta e ignora el ultimo CRLF', () => {
    const linea = construirLinea121(cotizanteBase(), configBase());
    const archivo = `${linea}\r\n${linea.slice(0, 100)}\r\n${linea}\r\n`;
    const problemas = validarAnchos(archivo, ANCHO_LINEA_121);
    expect(problemas).toEqual([{ linea: 2, largo: 100 }]);
    expect(validarAnchos(construirArchivo121(planillaDe([cotizanteBase()]), configBase()), ANCHO_LINEA_121)).toEqual([]);
  });

  it('B14: los nombres de archivo siguen la convencion del IPS', () => {
    expect(nombreArchivo121(configBase())).toBe('IPS_AGOSTO_2026.txt');
    expect(nombreArchivo109(configBase())).toBe('IPS_AGOSTO_2026.prn');
    expect(nombreArchivoREI(configBase())).toBe('IPS_REI_80012345_202608.txt');
    expect(nombreArchivo121(configBase({ mes: 12 }))).toBe('IPS_DICIEMBRE_2026.txt');
    expect(nombreArchivo121(configBase({ mes: 13 }))).toBe('IPS_PERIODO_2026.txt');
  });
});

describe('planilla IPS - formato delimitado por pipe (REI)', () => {
  it('B15: la cabecera, el detalle y el pie respetan el ancho de C.I. en 12', () => {
    const archivo = construirArchivoREI(resultadoDe([planillaDe([cotizanteBase()])]), configBase());
    const lineas = lineasDe(archivo);
    expect(lineas).toHaveLength(3);

    expect(lineas[0]).toBe(
      '1|IPS-REI|80012345|6|0001234567|202608|000001|00000004000000|00000001020000',
    );

    const detalle = lineas[1].split('|');
    expect(detalle).toHaveLength(11);
    expect(detalle[0]).toBe('2');
    expect(detalle[1]).toBe('CI');
    expect(detalle[2]).toBe('1000001     '); // ancho 12, no 20
    expect(detalle[2]).toHaveLength(12);
    expect(detalle[3]).toBe('PEREZ GOMEZ'.padEnd(30, ' '));
    expect(detalle[4]).toBe('JUAN CARLOS'.padEnd(30, ' '));
    expect(detalle[5]).toBe('30');
    expect(detalle[6]).toBe('000004000000');
    expect(detalle[7]).toBe('0000360000');
    expect(detalle[8]).toBe('0000660000');
    expect(detalle[9]).toBe('0001020000');
    expect(detalle[10]).toBe('ACTIVO');

    expect(lineas[2]).toBe(
      '3|CONTROL|202608|TOTAL_COTIZANTES:1|APORTE_OBRERO:360000|APORTE_PATRONAL:660000|TOTAL_APORTE:1020000|FIN',
    );
  });

  it('B16: emite un bloque por planilla y devuelve vacio cuando no hay planillas', () => {
    const archivo = construirArchivoREI(
      resultadoDe([
        planillaDe([cotizanteBase()]),
        { numeroPatronal: '0007894561', cotizantes: [cotizanteBase({ ci: '2000002', numeroPatronal: '0007894561' })], totales: totalesDe([cotizanteBase()]) },
      ]),
      configBase(),
    );
    const lineas = lineasDe(archivo);
    expect(lineas).toHaveLength(6);
    expect(lineas[0].startsWith('1|IPS-REI|')).toBe(true);
    expect(lineas[3].startsWith('1|IPS-REI|')).toBe(true);
    expect(lineas[3]).toContain('0007894561');

    expect(construirArchivoREI(resultadoDe([]), configBase())).toBe('');
  });
});
