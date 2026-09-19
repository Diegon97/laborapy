import { describe, it, expect } from 'vitest';
import {
  applyAgenticSettlementAdjustment,
  toSettlementActionPayload,
  executeSettlementAction,
} from '../tobiSettlementAction';
import { prepareContextForInference } from '../sessionManager';
import { TOBI_SYSTEM_PROMPT } from '../tobiSystemPrompt';
import type { AssistantMessage } from '../types';

describe('Tobi Agéntico — Fallback determinístico de ajustes sobre liquidación activa', () => {
  const basePayload = {
    salarioMensual: 3044000,
    fechaIngreso: '2023-01-15',
    fechaEgreso: '2026-09-19',
    motivo: 'despido_sin_causa' as const,
    preavisoOtorgado: false,
    preavisoObligado: 'empleador' as const,
    vacacionesPeriodosAnteriores: 0,
  };

  it('detecta y aplica "Agrégale me faltan 10 días de vacaciones"', () => {
    const adjusted = applyAgenticSettlementAdjustment(
      basePayload,
      'Agrégale me faltan 10 días de vacaciones',
    );

    expect(adjusted).not.toBeNull();
    expect(adjusted?.vacacionesPeriodosAnteriores).toBe(10);
    expect(adjusted?.salarioMensual).toBe(3044000);
    expect(adjusted?.fechaIngreso).toBe('2023-01-15');
    expect(adjusted?.motivo).toBe('despido_sin_causa');
  });

  it('detecta y aplica "Tengo vacaciones que no use, 10 días"', () => {
    const adjusted = applyAgenticSettlementAdjustment(
      basePayload,
      'Tengo vacaciones que no use, son 10 dias',
    );

    expect(adjusted).not.toBeNull();
    expect(adjusted?.vacacionesPeriodosAnteriores).toBe(10);
  });

  it('aplica suma aditiva si ya tenía vacaciones y el usuario dice "sumale 5 días de vacaciones"', () => {
    const payloadConVacaciones = {
      ...basePayload,
      vacacionesPeriodosAnteriores: 10,
    };

    const adjusted = applyAgenticSettlementAdjustment(
      payloadConVacaciones,
      'Sumale 5 días de vacaciones más',
    );

    expect(adjusted).not.toBeNull();
    expect(adjusted?.vacacionesPeriodosAnteriores).toBe(15);
  });

  it('corrige la fecha de ingreso ante typos como "Entr ele 15/09/2023"', () => {
    const adjusted = applyAgenticSettlementAdjustment(
      basePayload,
      'Entr ele 15/09/2023',
    );

    expect(adjusted).not.toBeNull();
    expect(adjusted?.fechaIngreso).toBe('2023-09-15');
    expect(adjusted?.salarioMensual).toBe(3044000);
  });

  it('corrige el salario mensual cuando el usuario indica "mi salario era 4.500.000"', () => {
    const adjusted = applyAgenticSettlementAdjustment(
      basePayload,
      'En realidad mi salario era 4.500.000',
    );

    expect(adjusted).not.toBeNull();
    expect(adjusted?.salarioMensual).toBe(4500000);
  });

  it('retorna null cuando el mensaje del usuario no solicita ningún ajuste numérico o de fecha', () => {
    const adjusted = applyAgenticSettlementAdjustment(
      basePayload,
      '¿Qué documentos necesito para presentar ante el MTESS?',
    );

    expect(adjusted).toBeNull();
  });

  it('no muta ante preguntas conceptuales que mencionan números o palabras clave (anti falso-positivo)', () => {
    // Caso 1: Pregunta conceptual sobre vacaciones
    const adjVac = applyAgenticSettlementAdjustment(
      basePayload,
      '¿Los 12 días de vacaciones son hábiles o corridos?',
    );
    expect(adjVac).toBeNull();

    // Caso 2: Pregunta conceptual sobre salario
    const adjSal = applyAgenticSettlementAdjustment(
      basePayload,
      '¿El salario mínimo legal en Paraguay es de 3.044.000?',
    );
    expect(adjSal).toBeNull();

    // Caso 3: Frase con "entregar" no debe confundirse con "entrar/ingresar"
    const adjEntregar = applyAgenticSettlementAdjustment(
      basePayload,
      'Debo entregar documentos el 15/09/2023 en la secretaría',
    );
    expect(adjEntregar).toBeNull();
  });
});

describe('Tobi Agéntico — Conversión toSettlementActionPayload y recálculo', () => {
  it('convierte un LiquidacionInput activo a TobiSettlementActionPayload preservando todos los campos', () => {
    const payloadInicial = {
      salarioMensual: 3044000,
      fechaIngreso: '2023-01-15',
      fechaEgreso: '2026-09-19',
      motivo: 'despido_sin_causa' as const,
      preavisoOtorgado: false,
      vacacionesPeriodosAnteriores: 0,
    };

    const { input, result } = executeSettlementAction(payloadInicial);
    expect(result.totalNetoEstimado).toBeGreaterThan(0);

    const reconstructed = toSettlementActionPayload(input);
    expect(reconstructed.salarioMensual).toBe(3044000);
    expect(reconstructed.fechaIngreso).toBe('2023-01-15');
    expect(reconstructed.motivo).toBe('despido_sin_causa');

    // Ahora aplicamos ajuste sobre la liquidación activa reconstruida
    const adjusted = applyAgenticSettlementAdjustment(
      reconstructed,
      'Agrégale me faltan 10 días de vacaciones',
    );
    expect(adjusted?.vacacionesPeriodosAnteriores).toBe(10);

    // Recalculamos con el nuevo ajuste
    const recalculada = executeSettlementAction(adjusted!);
    expect(recalculada.result.totalNetoEstimado).toBeGreaterThan(result.totalNetoEstimado);

    // Debe incluir el concepto de vacaciones de períodos anteriores
    const conceptoVacAnteriores = recalculada.result.conceptos.find(
      (c) => c.id === 'vacaciones_periodos_anteriores',
    );
    expect(conceptoVacAnteriores).toBeDefined();
    expect(conceptoVacAnteriores?.dias).toBe(10);
  });

  it('preserva el embargo judicial en el round-trip de toSettlementActionPayload', () => {
    const payloadConEmbargo = {
      salarioMensual: 4000000,
      fechaIngreso: '2023-01-15',
      fechaEgreso: '2026-09-19',
      motivo: 'despido_sin_causa' as const,
      embargoJudicial: 500000,
    };

    const { input } = executeSettlementAction(payloadConEmbargo);
    expect(input.descuentosAdicionales?.[0]?.monto).toBe(500000);

    const reconstructed = toSettlementActionPayload(input);
    expect(reconstructed.embargoJudicial).toBe(500000);

    const reejecutada = executeSettlementAction(reconstructed);
    expect(reejecutada.input.descuentosAdicionales?.[0]?.monto).toBe(500000);
  });
});

describe('Tobi Agéntico — Ficha técnica en prepareContextForInference', () => {
  it('inyecta la ficha técnica resumida en el turno del asistente si contiene settlementData', () => {
    const payload = {
      salarioMensual: 3044000,
      fechaIngreso: '2023-01-15',
      fechaEgreso: '2026-09-19',
      motivo: 'despido_sin_causa' as const,
      vacacionesPeriodosAnteriores: 10,
    };

    const settlementData = executeSettlementAction(payload);

    const messages: AssistantMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Calculame mi liquidación',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: '¡Listo! Realicé el cálculo oficial de liquidación laboral.',
        createdAt: new Date().toISOString(),
        settlementData,
      },
    ];

    const turns = prepareContextForInference(messages);
    expect(turns.length).toBe(2);

    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.content).toContain('[Liquidación activa en pantalla:');
    expect(assistantTurn?.content).toContain('Salario Gs. 3.044.000');
    expect(assistantTurn?.content).toContain('Ingreso: 2023-01-15');
    expect(assistantTurn?.content).toContain('Egreso: 2026-09-19');
    expect(assistantTurn?.content).toContain('Vacaciones anteriores adeudadas: 10 días');
  });
});

describe('Tobi Agéntico — Directivas del prompt de sistema', () => {
  it('contiene la directiva inexpugnable de actitud agéntica y cero preguntas redundantes', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/ACTITUD AGÉNTICA TOTAL — CERO PREGUNTAS REDUNDANTES/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/TERMINANTEMENTE PROHIBIDO volver a pedir datos ya conocidos/i);
  });

  it('contiene la regla taxativa sobre vacaciones pendientes y bloque :::liquidacion_action', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/VACACIONES PENDIENTES NO GOZADAS/i);
    expect(TOBI_SYSTEM_PROMPT).toContain('vacacionesPeriodosAnteriores');
    expect(TOBI_SYSTEM_PROMPT).toMatch(/explicá pedagógicamente el cálculo en guaraníes/i);
  });

  it('contiene la regla de corrección de fechas con typos como "Entr ele"', () => {
    expect(TOBI_SYSTEM_PROMPT).toMatch(/Entr ele 15\/09\/2023/i);
    expect(TOBI_SYSTEM_PROMPT).toMatch(/CORRECCIONES DE FECHAS, TYPOS Y SALARIO/i);
  });
});
