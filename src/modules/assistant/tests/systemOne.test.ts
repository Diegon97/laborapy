import { describe, it, expect } from 'vitest';
import {
  choice,
  score,
  noul,
  normalizeProbabilities,
  calculateConfidence,
  evaluateTobiPeritaje,
  heuristicTobiPeritaje,
} from '../systemOne/systemOneEngine';

const OFFLINE = { endpoint: '' } as const;

describe('systemOne — primitivas y utilidades', () => {
  it('construye preguntas tipadas choice/score/noul', () => {
    const c = choice('¿Intención?', { a: 'Opción A', b: 'Opción B' });
    expect(c.type).toBe('choice');
    expect(Object.keys(c.criteria)).toHaveLength(2);

    const s = score('¿Nivel?', ['L1', 'L2', 'L3']);
    expect(s.type).toBe('score');
    expect(s.criteria).toHaveLength(3);

    const n = noul('¿Urgente?');
    expect(n.type).toBe('noul');
    expect(n.criteria).toBeNull();
  });

  it('normaliza probabilidades para que sumen 1.0', () => {
    const result = normalizeProbabilities({ a: 2, b: 2 });
    expect(result.a).toBeCloseTo(0.5, 4);
    expect(result.b).toBeCloseTo(0.5, 4);
    const sum = Object.values(result).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  it('reparte uniformemente con probabilidades en cero y devuelve {} sin claves', () => {
    const uniform = normalizeProbabilities({ a: 0, b: 0, c: 0 });
    expect(uniform.a).toBeCloseTo(1 / 3, 4);
    expect(uniform.b).toBeCloseTo(1 / 3, 4);
    expect(normalizeProbabilities({})).toEqual({});
  });

  it('calcula la confianza según la concentración de probabilidad', () => {
    expect(calculateConfidence({ a: 0.9, b: 0.1 })).toBe(0.85);
    expect(calculateConfidence({ solo: 1 })).toBe(1);
    expect(calculateConfidence({})).toBe(0);
  });
});

describe('systemOne — evaluación pericial de Tobi', () => {
  it('detecta y mapea un despido injustificado (liquidación)', async () => {
    const j = await evaluateTobiPeritaje(
      'Ayer me despidieron sin causa luego de 3 años de trabajo. Cobraba 4.000.000 Gs.',
      OFFLINE,
    );
    expect(j.intencion).toBe('calcular_liquidacion');
    expect(j.motivoEgreso).toBe('despido_injustificado');
    expect(j.confianza).toBeGreaterThan(0.5);
  });

  it('mapea la estabilidad de 10 años (Art. 94 C.T.)', async () => {
    const j = await evaluateTobiPeritaje(
      'Llevo 11 años como jefe de compras y me dieron una nota de despido por supuesta reestructuración. Cobro 8.500.000 Gs.',
      OFFLINE,
    );
    expect(j.motivoEgreso).toBe('estabilidad_10_anos');
  });

  it('detecta fraude laboral por facturación (Art. 19 C.T.)', async () => {
    const j = await evaluateTobiPeritaje(
      'La empresa me obliga a emitir factura por 4.500.000 Gs. cada mes. Mi jefe me da órdenes, debo marcar tarjeta de 8 a 17 hs, uso la PC de la oficina y trabajo solo para ellos.',
      OFFLINE,
    );
    expect(j.intencion).toBe('fraude_facturacion');
    expect(j.riesgoFraudeArt19.nivel).toBeGreaterThanOrEqual(4);
    expect(j.riesgoFraudeArt19.flagrante).toBe(true);
  });

  it('detecta prescripción urgente de 60 días (Art. 399 C.T.)', async () => {
    const j = await evaluateTobiPeritaje(
      'Mi reclamo está por prescribir: el plazo de 60 días vence la semana que viene.',
      OFFLINE,
    );
    expect(j.esUrgentePrescripcion).toBe(true);
  });

  it('detecta un lead B2B corporativo', async () => {
    const j = await evaluateTobiPeritaje(
      'Buenas tardes, somos una distribuidora con 45 empleados en Luque. Necesitamos tercerizar las planillas anuales del MTESS (REOP).',
      OFFLINE,
    );
    expect(j.leadB2B).toBe(true);
  });

  it('maneja texto vacío como fuera de dominio y sin confianza', async () => {
    const j = await evaluateTobiPeritaje('   ', OFFLINE);
    expect(j.intencion).toBe('fuera_de_dominio');
    expect(j.motivoEgreso).toBe('no_aplica');
    expect(j.confianza).toBe(0);
  });

  it('clasifica como fuera de dominio un texto ajeno a lo laboral', async () => {
    const j = await evaluateTobiPeritaje('Receta de milanesas con puré para cuatro personas.', OFFLINE);
    expect(j.intencion).toBe('fuera_de_dominio');
    expect(j.esUrgentePrescripcion).toBe(false);
    expect(j.leadB2B).toBe(false);
  });

  it('cae al fallback heurístico cuando el endpoint de red falla', async () => {
    const j = await evaluateTobiPeritaje('Me despidieron sin causa', {
      endpoint: 'http://127.0.0.1:9/systemone',
    });
    expect(j.motivoEgreso).toBe('despido_injustificado');
  });

  it('expone la heurística determinística de forma síncrona', () => {
    const j = heuristicTobiPeritaje('Renuncié por falta de pago de mi salario.');
    expect(j.motivoEgreso).toBe('renuncia_voluntaria');
    expect(j.riesgoFraudeArt19.flagrante).toBe(false);
  });

  it('clasifica la suspensión disciplinaria como auditoria_documento y motivoEgreso no_aplica', () => {
    const j = heuristicTobiPeritaje('Quiero suspender a mi empleado por conducta inapropiada');
    expect(j.intencion).toBe('auditoria_documento');
    expect(j.motivoEgreso).toBe('no_aplica');
  });

  it('mantiene intencion calcular_liquidacion cuando coexisten despido y sanción', () => {
    const j = heuristicTobiPeritaje('Me despidieron y me aplicaron una sancion, quiero calcular mi liquidacion');
    expect(j.intencion).toBe('calcular_liquidacion');
    expect(j.motivoEgreso).toBe('despido_injustificado');
  });

  it('no arroja falso positivo de fraude laboral (Art. 19) en consultas de suspensión ordinarias', () => {
    const j = heuristicTobiPeritaje('Hola tobi quiero suspenderle 3 dias a mi empleado');
    expect(j.intencion).toBe('auditoria_documento');
    expect(j.motivoEgreso).toBe('no_aplica');
    expect(j.riesgoFraudeArt19.nivel).toBe(1);
    expect(j.riesgoFraudeArt19.flagrante).toBe(false);
  });
});
