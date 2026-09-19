import { describe, it, expect } from 'vitest';
import {
  extractContinuationOptions,
  generateFallbackOptions,
} from '../tobiOptionsAction';

describe('tobiOptionsAction — Parser de Opciones de Continuación', () => {
  it('extrae exitosamente 4 opciones estructuradas desde el bloque :::opciones_continuar', () => {
    const rawText = `
Hola, según el Código del Trabajo tenés derecho al cobro de indemnizaciones.

:::opciones_continuar
[
  "Quiero calcular mi liquidación exacta",
  "Tengo contrato escrito firmado",
  "Me despidieron de forma verbal",
  "Hablar con un asesor por WhatsApp"
]
:::
    `.trim();

    const result = extractContinuationOptions(rawText);
    expect(result.options).not.toBeNull();
    expect(result.options).toHaveLength(4);
    expect(result.options?.[0]).toBe('Quiero calcular mi liquidación exacta');
    expect(result.options?.[1]).toBe('Tengo contrato escrito firmado');
    expect(result.options?.[2]).toBe('Me despidieron de forma verbal');
    expect(result.options?.[3]).toBe('Hablar con un asesor por WhatsApp');
    expect(result.cleanedText).not.toContain(':::opciones_continuar');
    expect(result.cleanedText).toContain('tenés derecho al cobro de indemnizaciones');
  });

  it('prioriza opciones de identidad y creador cuando el texto menciona a Diego Núñez o LaboraPy', () => {
    const textCreador =
      'Fui creado y desarrollado por Diego Núñez, fundador de LaboraPy, el Copilot de RRHH paraguayo.';
    const options = generateFallbackOptions(textCreador);

    expect(options).toHaveLength(4);
    expect(options[0]).toMatch(/Diego Núñez/i);
    expect(JSON.stringify(options)).toMatch(/liquidación|LaboraPy/i);
    expect(options[3]).toMatch(/WhatsApp/i);
    expect(JSON.stringify(options)).not.toMatch(/pelea|agresión|golpes/i);
  });

  it('ofrece la opción de adjuntar la nota de despido en contextos de liquidación y despido (Art. 81 vs 84)', () => {
    const textLiquidacion =
      'Vamos a calcular tu liquidación por despido. Necesito tu salario mensual y las fechas de ingreso y egreso.';
    const options = generateFallbackOptions(textLiquidacion);

    expect(options).toHaveLength(4);
    expect(options[0]).toContain('Cargar datos en casillas y calcular liquidación');
    expect(options.some((o) => /Adjuntar nota de despido/i.test(o))).toBe(true);
    expect(JSON.stringify(options)).toMatch(/justificado o injustificado/i);
  });

  it('detecta la variante verbal "me despidieron" y ofrece liquidación y nota de despido, NUNCA agresión física', () => {
    const textDespidoVerbal = 'Me despidieron el viernes sin explicación alguna y sin carta.';
    const options = generateFallbackOptions(textDespidoVerbal);

    expect(options).toHaveLength(4);
    expect(options[0]).toContain('Cargar datos en casillas y calcular liquidación');
    expect(options.some((o) => /Adjuntar nota de despido/i.test(o))).toBe(true);
    expect(JSON.stringify(options)).not.toMatch(/agresión física|pelea|golpes/i);
  });

  it('genera 4 opciones inteligentes por fallback temático si Tobi no emitió el bloque', () => {
    const textDespido = 'Te despidieron sin causa justificada conforme al Art. 84 del Código del Trabajo.';
    const result = extractContinuationOptions(textDespido);

    expect(result.options).not.toBeNull();
    expect(result.options).toHaveLength(4);
    expect(JSON.stringify(result.options)).toMatch(/liquidación|nota de despido/i);
    expect(result.options?.[3]).toMatch(/despido injustificado|WhatsApp/i);
  });

  it('genera opciones adaptadas a maternidad y lactancia si detecta fuero maternal', () => {
    const textMaternidad = 'La trabajadora con fuero maternal bajo la Ley 5508/15 tiene inamovilidad laboral.';
    const options = generateFallbackOptions(textMaternidad);

    expect(options).toHaveLength(4);
    expect(options[0]).toMatch(/gravidez|médico/i);
    expect(options[2]).toMatch(/IPS|lactancia/i);
  });

  it('genera opciones adaptadas a sanciones y amonestaciones disciplinarias', () => {
    const textAmonestacion = 'Para aplicar una amonestación o sanción según el Art. 352 se requiere falta.';
    const options = generateFallbackOptions(textAmonestacion);

    expect(options).toHaveLength(4);
    expect(options[2]).toMatch(/descargo|sanción/i);
  });

  it('genera opciones adaptadas a agresión física, riñas y despidos verbales', () => {
    const textPelea = 'El colaborador tuvo una pelea a golpes con su jefe en planta y se configuró despido justificado.';
    const options = generateFallbackOptions(textPelea);

    expect(options).toHaveLength(4);
    expect(options[0]).toMatch(/despido fue verbal/i);
    expect(options[1]).toMatch(/nota de despido/i);
    expect(options[2]).toMatch(/agresión física/i);
  });

  it('maneja strings vacíos o nulos sin lanzar excepción', () => {
    const emptyResult = extractContinuationOptions('');
    expect(emptyResult.options).toBeNull();

    const nullResult = extractContinuationOptions(null as any);
    expect(nullResult.options).toBeNull();
  });

  it('tolera JSON malformado dentro del bloque recuperando opciones mediante fallback', () => {
    const malformed = `
Tu consulta sobre el aguinaldo proporcional fue analizada.

:::opciones_continuar
[
  "Opción rota sin cerrar comillas
]
:::
    `;
    const result = extractContinuationOptions(malformed);
    expect(result.options).not.toBeNull();
    expect(result.options).toHaveLength(4);
    expect(result.cleanedText).not.toContain(':::opciones_continuar');
  });

  it('devuelve opciones de liquidación coherentes y casillas cuando el texto menciona despido con o sin causa, NUNCA agresión física', () => {
    const textCasoUsuario = '¡Hola! Con mucho gusto te ayudo a calcular tu liquidación. Para hacerlo bien necesito: Salario, fecha de ingreso y egreso, y si fue despido sin causa, despido con causa o renuncia.';
    const options = generateFallbackOptions(textCasoUsuario);

    expect(options[0]).toContain('Cargar datos en casillas y calcular liquidación');
    expect(options[1]).toContain('Adjuntar nota de despido');
    expect(options[2]).toContain('Emitía facturas con RUC sin IPS');
    expect(JSON.stringify(options)).not.toMatch(/agresión física|pelea|golpes/i);
  });
});
