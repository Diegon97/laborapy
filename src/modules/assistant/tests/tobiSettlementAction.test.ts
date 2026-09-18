import { describe, it, expect } from 'vitest';
import { extractSettlementAction, executeSettlementAction, toLiquidacionInput } from '../tobiSettlementAction';

describe('tobiSettlementAction — extracción y cálculo', () => {
  it('extrae el bloque :::liquidacion_action y limpia el texto visible', () => {
    const input = `Estimado cliente, he procedido con el análisis.
:::liquidacion_action
{
  "salarioMensual": 3500000,
  "fechaIngreso": "2024-01-01",
  "fechaEgreso": "2026-06-30",
  "motivo": "despido_sin_causa",
  "tieneVariables": false
}
:::
Quedo a las órdenes para cualquier duda adicional.`;

    const { cleanedText, payload } = extractSettlementAction(input);

    expect(payload).not.toBeNull();
    expect(payload?.salarioMensual).toBe(3500000);
    expect(payload?.motivo).toBe('despido_sin_causa');
    expect(cleanedText).not.toContain(':::liquidacion_action');
    expect(cleanedText).toContain('Estimado cliente');
    expect(cleanedText).toContain('Quedo a las órdenes');
  });

  it('retorna payload null y texto intacto cuando no hay bloque', () => {
    const text = 'Consulta general sobre vacaciones laborales.';
    const { cleanedText, payload } = extractSettlementAction(text);

    expect(payload).toBeNull();
    expect(cleanedText).toBe(text);
  });

  it('retorna payload null y limpia el bloque si el JSON es inválido', () => {
    const input = `Texto antes
:::liquidacion_action
{ json_invalido_sin_comillas: true,
:::
Texto después`;

    const { cleanedText, payload } = extractSettlementAction(input);

    expect(payload).toBeNull();
    expect(cleanedText).not.toContain(':::liquidacion_action');
    expect(cleanedText).toContain('Texto antes');
    expect(cleanedText).toContain('Texto después');
  });

  it('ejecuta calcularLiquidacion correctamente a través de executeSettlementAction', () => {
    const payload = {
      salarioMensual: 3044000,
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-09-15',
      motivo: 'despido_sin_causa' as const,
      tieneVariables: false,
    };

    const { input, result } = executeSettlementAction(payload);

    expect(input.salarioMensual).toBe(3044000);
    expect(result.totalNetoEstimado).toBeGreaterThan(0);
    expect(result.conceptos.length).toBeGreaterThan(0);
    expect(result.antiguedad.years).toBe(3);
  });

  it('mapea correctamente payload con preaviso mediante toLiquidacionInput', () => {
    const payload = {
      salarioMensual: 4000000,
      fechaIngreso: '2022-05-01',
      fechaEgreso: '2026-08-30',
      motivo: 'renuncia' as const,
      preavisoOtorgado: true,
      preavisoObligado: 'trabajador' as const,
      nombreEmpleado: 'María González',
      empresa: 'Corporación PY',
    };

    const input = toLiquidacionInput(payload);
    expect(input.nombreEmpleado).toBe('María González');
    expect(input.empresa).toBe('Corporación PY');
    expect(input.preaviso?.obligado).toBe('trabajador');
    expect(input.preaviso?.otorgado).toBe(true);
  });

  it('aplica piso de salario mínimo legal vigente (Gs. 3.044.000) cuando el salario declarado es inferior', () => {
    const payload = {
      salarioMensual: 2000000, // Menor al mínimo de 3.044.000
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-09-15',
      motivo: 'despido_sin_causa' as const,
      tieneVariables: false,
    };

    const { input, result } = executeSettlementAction(payload);

    // Debe elevarse automáticamente al salario mínimo legal para proteger al trabajador
    expect(input.salarioMensual).toBe(3044000);
    expect(result.totalNetoEstimado).toBeGreaterThan(0);
    expect(result.alertas.some((a) => a.id === 'ALERTA_PISO_SALARIO_MINIMO')).toBe(true);
  });
});
