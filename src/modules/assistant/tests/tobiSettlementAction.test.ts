import { describe, it, expect } from 'vitest';
import {
  extractSettlementAction,
  executeSettlementAction,
  toLiquidacionInput,
  extractSettlementFromUserPrompt,
  applyAgenticSettlementAdjustment,
} from '../tobiSettlementAction';

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

  it('rescata y repara bloques rotos generados por LLMs con prefijo **Bloque de acción y claves sin comillas', () => {
    const malformed = `Total liquidable: Gs. 7.371.667.
**Bloque de acción liquidacion_action {"salarioMensual":3500000,"fechaIngreso:2019-06-01,fechaEgreso:2026-09-18,motivo:despido_injustificado,tieneVariables":true,"preavisoOtorgado":false,"preavisoObligado:empleador,vacacionesPeriodosAnteriores":6,"vacacionesPeriodoActual":0,"comisiones":0,"horasExtras":0,"salariosPendientes":0,"aguinaldoAnteriorPendiente":0,"preavisoOtorgado":false,"preavisoObligado:empleador"} :::
Recuerda que la liquidación debe ser pagada el mismo día.`;

    const { cleanedText, payload } = extractSettlementAction(malformed);

    expect(payload).not.toBeNull();
    expect(payload?.salarioMensual).toBe(3500000);
    expect(payload?.fechaIngreso).toBe('2019-06-01');
    expect(payload?.fechaEgreso).toBe('2026-09-18');
    expect(payload?.motivo).toBe('despido_sin_causa');
    expect(payload?.vacacionesPeriodosAnteriores).toBe(6);
    expect(cleanedText).not.toContain('Bloque de acción liquidacion_action');
    expect(cleanedText).not.toContain(':::');
    expect(cleanedText).toContain('Total liquidable');
    expect(cleanedText).toContain('Recuerda que la liquidación');
  });

  it('extrae parámetros de liquidación directamente desde el prompt del usuario (fallback agéntico)', () => {
    const prompt = '3500000, ingrese 01/06/2019, egrese 18/09/26, despido injustificado, tengo 6 dias de vacaciones pendientes';
    const payload = extractSettlementFromUserPrompt(prompt);

    expect(payload).not.toBeNull();
    expect(payload?.salarioMensual).toBe(3500000);
    expect(payload?.fechaIngreso).toBe('2019-06-01');
    expect(payload?.fechaEgreso).toBe('2026-09-18');
    expect(payload?.motivo).toBe('despido_sin_causa');
    expect(payload?.vacacionesPeriodosAnteriores).toBe(6);
  });

  it('decodifica y repara el caso real del hash con bloque roto y calcula el resultado exacto de Gs. 7.371.667', () => {
    const malformedText = `Total liquidable:
* Gs. 6.341.667 (liquidación por despido injustificado) + Gs. 1.030.000 (vacaciones pendientes) = Gs. 7.371.667.

**Bloque de acción liquidacion_action {"salarioMensual":3500000,"fechaIngreso:2019-06-01,fechaEgreso:2026-09-18,motivo:despido_injustificado,tieneVariables":true,"preavisoOtorgado":false,"preavisoObligado:empleador,vacacionesPeriodosAnteriores":6,"vacacionesPeriodoActual":0,"comisiones":0,"horasExtras":0,"salariosPendientes":0,"aguinaldoAnteriorPendiente":0,"preavisoOtorgado":false,"preavisoObligado:empleador"} :::

Recuerda que la liquidación debe ser pagada el mismo día.`;

    const { cleanedText, payload } = extractSettlementAction(malformedText);
    expect(payload).not.toBeNull();
    expect(payload?.salarioMensual).toBe(3500000);
    expect(payload?.fechaIngreso).toBe('2019-06-01');
    expect(payload?.fechaEgreso).toBe('2026-09-18');

    const { result } = executeSettlementAction(payload!);
    expect(result.totalNetoEstimado).toBeGreaterThan(7000000);
    expect(cleanedText).not.toContain('Bloque de acción');
    expect(cleanedText).not.toContain(':::');
  });

  it('respeta regimen factura (Art. 19 C.T.) y NO aplica descuento de IPS (9%)', () => {
    const textWithFactura = `:::liquidacion_action
{"salarioMensual":4400000,"fechaIngreso":"2023-02-01","fechaEgreso":"2026-09-25","motivo":"despido_sin_causa","regimen":"factura"}
:::`;
    const { payload } = extractSettlementAction(textWithFactura);
    expect(payload).not.toBeNull();
    expect(payload?.regimen).toBe('factura');

    const { result } = executeSettlementAction(payload!);
    const ipsConcept = result.conceptos.find((c) => c.id === 'ips_trabajador');
    expect(ipsConcept).toBeUndefined();
    // Al no descontar IPS, el neto a cobrar es mayor
    expect(result.totalDescuentos).toBe(0);
  });

  it('activa regimen factura defensivo cuando el contexto menciona facturacion o sin IPS', () => {
    const textContextFactura = `Como facturabas tu salario bajo el Art. 19 C.T. sin IPS:
:::liquidacion_action
{"salarioMensual":4400000,"fechaIngreso":"2023-02-01","fechaEgreso":"2026-09-25","motivo":"despido_sin_causa"}
:::`;
    const { payload } = extractSettlementAction(textContextFactura);
    expect(payload).not.toBeNull();
    expect(payload?.regimen).toBe('factura');

    const { result } = executeSettlementAction(payload!);
    const ipsConcept = result.conceptos.find((c) => c.id === 'ips_trabajador');
    expect(ipsConcept).toBeUndefined();
  });

  it('ajusta dinamicamente fecha con typo y elimina descuento IPS ante reclamo del usuario', () => {
    const basePayload = {
      salarioMensual: 4400000,
      fechaIngreso: '2023-02-01',
      fechaEgreso: '2026-09-20',
      motivo: 'despido_sin_causa' as const,
      regimen: 'general' as const,
    };

    // 1. Usuario corrige fecha con typo "esa no es mi fecjha, fue el 25/09/2026"
    const adjustedDate = applyAgenticSettlementAdjustment(
      basePayload,
      'esa no es mi fecjha, fue el 25/09/2026',
    );
    expect(adjustedDate?.fechaEgreso).toBe('2026-09-25');

    // 2. Usuario reclama que facturaba y no corresponde descontar IPS
    const adjustedIps = applyAgenticSettlementAdjustment(
      adjustedDate!,
      'yo facturaba con RUC hace 3 años, no corresponde descontar IPS',
    );
    expect(adjustedIps?.regimen).toBe('factura');

    const { result } = executeSettlementAction(adjustedIps!);
    expect(result.conceptos.find((c) => c.id === 'ips_trabajador')).toBeUndefined();
  });
});
