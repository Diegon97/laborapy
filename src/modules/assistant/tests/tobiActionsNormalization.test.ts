import { describe, it, expect } from 'vitest';
import { extractSettlementAction, toLiquidacionInput } from '../tobiSettlementAction';
import { extractDocumentAction, toNotaLaboralOptions } from '../tobiDocumentAction';
import type { TobiSettlementActionPayload, TobiDocumentActionPayload } from '../types';

describe('tobiActionsNormalization — normalización y validación de acciones', () => {
  describe('extractSettlementAction — normalización de motivos y descarte de inválidos', () => {
    it('normaliza alias despido_justificado a despido_con_causa', () => {
      const text = `Acción detectada:
:::liquidacion_action
{
  "fechaIngreso": "2023-01-15",
  "fechaEgreso": "2024-05-20",
  "motivo": "despido_justificado",
  "salarioMensual": 3500000
}
:::`;
      const { payload } = extractSettlementAction(text);
      expect(payload).not.toBeNull();
      expect(payload?.motivo).toBe('despido_con_causa');
    });

    it('normaliza alias despido_injustificado a despido_sin_causa', () => {
      const text = `Acción detectada:
:::liquidacion_action
{
  "fechaIngreso": "2022-03-01",
  "fechaEgreso": "2024-08-31",
  "motivo": "despido_injustificado",
  "salarioMensual": 4200000
}
:::`;
      const { payload } = extractSettlementAction(text);
      expect(payload).not.toBeNull();
      expect(payload?.motivo).toBe('despido_sin_causa');
    });

    it('retorna payload null si el motivo es desconocido', () => {
      const text = `Acción con motivo desconocido:
:::liquidacion_action
{
  "fechaIngreso": "2023-01-01",
  "fechaEgreso": "2024-01-01",
  "motivo": "quiere_irse",
  "salarioMensual": 3000000
}
:::`;
      const { payload } = extractSettlementAction(text);
      expect(payload).toBeNull();
    });
  });

  describe('toLiquidacionInput — asignación de obligado en preaviso por defecto y explícito', () => {
    const basePayload: TobiSettlementActionPayload = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-01-01',
      salarioMensual: 3500000,
      motivo: 'renuncia',
      preavisoOtorgado: false,
    };

    it('asigna obligado trabajador por defecto cuando el motivo es renuncia y no se especifica', () => {
      const payload: TobiSettlementActionPayload = {
        ...basePayload,
        motivo: 'renuncia',
        preavisoObligado: undefined,
      };
      const input = toLiquidacionInput(payload);
      expect(input.preaviso?.obligado).toBe('trabajador');
      expect(input.preaviso?.otorgado).toBe(false);
    });

    it('asigna obligado empleador por defecto cuando el motivo es despido_sin_causa y no se especifica', () => {
      const payload: TobiSettlementActionPayload = {
        ...basePayload,
        motivo: 'despido_sin_causa',
        preavisoObligado: undefined,
      };
      const input = toLiquidacionInput(payload);
      expect(input.preaviso?.obligado).toBe('empleador');
    });

    it('respeta obligado empleador explícito aun cuando el motivo es renuncia', () => {
      const payload: TobiSettlementActionPayload = {
        ...basePayload,
        motivo: 'renuncia',
        preavisoObligado: 'empleador',
      };
      const input = toLiquidacionInput(payload);
      expect(input.preaviso?.obligado).toBe('empleador');
    });
  });

  describe('extractDocumentAction — normalización de tipos y descarte de inválidos', () => {
    it('normaliza alias certificado a certificado_trabajo', () => {
      const text = `Documento solicitado:
:::documento_action
{
  "tipo": "certificado",
  "nombreEmpleado": "María Duarte"
}
:::`;
      const { payload } = extractDocumentAction(text);
      expect(payload).not.toBeNull();
      expect(payload?.tipo).toBe('certificado_trabajo');
      expect(payload?.nombreEmpleado).toBe('María Duarte');
    });

    it('normaliza alias suspension a suspension_disciplinaria', () => {
      const text = `Documento solicitado:
:::documento_action
{
  "tipo": "suspension",
  "nombreEmpleado": "Roberto Rojas"
}
:::`;
      const { payload } = extractDocumentAction(text);
      expect(payload).not.toBeNull();
      expect(payload?.tipo).toBe('suspension_disciplinaria');
    });

    it('retorna payload null si el tipo de documento es desconocido', () => {
      const text = `Documento desconocido:
:::documento_action
{
  "tipo": "foo",
  "nombreEmpleado": "Juan Pérez"
}
:::`;
      const { payload } = extractDocumentAction(text);
      expect(payload).toBeNull();
    });
  });

  describe('toNotaLaboralOptions — acotación de diasSuspension entre 1 y 8', () => {
    const basePayload: TobiDocumentActionPayload = {
      tipo: 'suspension_disciplinaria',
      nombreEmpleado: 'Esteban Arce',
      ciEmpleado: '1.234.567',
    };

    it('acota diasSuspension a 8 cuando el valor recibido es 15', () => {
      const options = toNotaLaboralOptions({
        ...basePayload,
        diasSuspension: 15,
      });
      expect(options.diasSuspension).toBe(8);
    });

    it('acota diasSuspension a 1 cuando el valor recibido es 0', () => {
      const options = toNotaLaboralOptions({
        ...basePayload,
        diasSuspension: 0,
      });
      expect(options.diasSuspension).toBe(1);
    });

    it('mantiene undefined cuando diasSuspension no está definido', () => {
      const options = toNotaLaboralOptions({
        ...basePayload,
        diasSuspension: undefined,
      });
      expect(options.diasSuspension).toBeUndefined();
    });

    it('conserva el valor y el tipo suspension_disciplinaria cuando diasSuspension es 3', () => {
      const options = toNotaLaboralOptions({
        ...basePayload,
        tipo: 'suspension_disciplinaria',
        diasSuspension: 3,
      });
      expect(options.tipo).toBe('suspension_disciplinaria');
      expect(options.diasSuspension).toBe(3);
    });
  });
});
