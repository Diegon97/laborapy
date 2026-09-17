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

  it('genera 4 opciones inteligentes por fallback temático si Tobi no emitió el bloque', () => {
    const textDespido = 'Te despidieron sin causa justificada conforme al Art. 84 del Código del Trabajo.';
    const result = extractContinuationOptions(textDespido);

    expect(result.options).not.toBeNull();
    expect(result.options).toHaveLength(4);
    expect(result.options?.[0]).toMatch(/antigüedad|salario/i);
    expect(result.options?.[3]).toMatch(/WhatsApp/i);
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
    expect(options[1]).toContain('Emitía facturas con RUC sin IPS');
    expect(options[2]).toContain('Estaba en planilla formal con seguro social IPS');
    expect(JSON.stringify(options)).not.toMatch(/agresión física|pelea|golpes/i);
  });
});
