import type { LiquidacionInput, LiquidacionResult, MotivoEgreso } from '../payroll/types';
import { calcularLiquidacion } from '../payroll/liquidacion';
import { SALARIO_MINIMO_MENSUAL_2026 } from '../payroll/constants';
import type { TobiSettlementActionPayload } from './types';

export const SETTLEMENT_ACTION_REGEX = /:::liquidacion_action\s*([\s\S]*?)\s*:::/;

export const MOTIVOS_VALIDOS = [
  'renuncia',
  'despido_sin_causa',
  'despido_con_causa',
  'abandono',
  'retiro_justificado',
  'mutuo_acuerdo',
  'contrato_plazo_fijo',
  'periodo_prueba',
  'jubilacion',
] as const;

const ALIAS_MOTIVO: Readonly<Record<string, MotivoEgreso>> = {
  despido_justificado: 'despido_con_causa',
  despido_injustificado: 'despido_sin_causa',
  renuncia_voluntaria: 'renuncia',
  'jubilación': 'jubilacion',
  fin_de_contrato: 'contrato_plazo_fijo',
};

export function extractSettlementAction(text: string): {
  cleanedText: string;
  payload: TobiSettlementActionPayload | null;
} {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text || '', payload: null };
  }

  const match = SETTLEMENT_ACTION_REGEX.exec(text);
  if (!match) {
    return { cleanedText: text, payload: null };
  }

  const rawJson = match[1].trim();
  let payload: TobiSettlementActionPayload | null = null;

  try {
    const parsed = JSON.parse(rawJson);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.fechaIngreso === 'string' &&
      typeof parsed.fechaEgreso === 'string' &&
      typeof parsed.motivo === 'string' &&
      typeof parsed.salarioMensual === 'number' &&
      parsed.salarioMensual > 0
    ) {
      const motivoNormalizado = ALIAS_MOTIVO[parsed.motivo] ?? parsed.motivo;
      if ((MOTIVOS_VALIDOS as readonly string[]).includes(motivoNormalizado)) {
        payload = { ...parsed, motivo: motivoNormalizado } as TobiSettlementActionPayload;
      }
    }
  } catch {
    payload = null;
  }

  const cleanedText = text
    .replace(SETTLEMENT_ACTION_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanedText, payload };
}

export function toLiquidacionInput(payload: TobiSettlementActionPayload): LiquidacionInput {
  const salarioDeclarado = Math.round(payload.salarioMensual);
  // Piso de orden público laboral (Art. 249 C.T.): si percibe menos del mínimo legal en jornada completa,
  // el cálculo de la liquidación oficial se efectúa sobre la base piso de al menos el Salario Mínimo Legal Vigente.
  const salarioEfectivo =
    salarioDeclarado > 0 && salarioDeclarado < SALARIO_MINIMO_MENSUAL_2026
      ? SALARIO_MINIMO_MENSUAL_2026
      : salarioDeclarado;

  const input: LiquidacionInput = {
    fechaIngreso: payload.fechaIngreso,
    fechaEgreso: payload.fechaEgreso,
    motivo: payload.motivo,
    salarioMensual: salarioEfectivo,
    tieneVariables: payload.tieneVariables ?? ((payload.comisiones ?? 0) > 0 || (payload.horasExtras ?? 0) > 0),
    comisiones: payload.comisiones,
    horasExtras: payload.horasExtras,
    regimen: payload.regimen,
    regimenLaboral: payload.regimenLaboral,
    nombreEmpleado: payload.nombreEmpleado,
    ciEmpleado: payload.ciEmpleado,
    cargoEmpleado: payload.cargoEmpleado,
    empresa: payload.empresa,
    vacacionesPeriodoActual: payload.vacacionesPeriodoActual,
    vacacionesPeriodosAnteriores: payload.vacacionesPeriodosAnteriores,
    salariosPendientes: payload.salariosPendientes,
    aguinaldoAnteriorPendiente: payload.aguinaldoAnteriorPendiente,
    descuentosAdicionales: payload.embargoJudicial && payload.embargoJudicial > 0
      ? [{ concepto: 'Embargo Judicial (Tope 25% Art. 245 C.T.)', monto: payload.embargoJudicial }]
      : undefined,
  };

  if (payload.preavisoOtorgado !== undefined || payload.preavisoObligado !== undefined) {
    const obligadoPorDefecto: 'empleador' | 'trabajador' =
      payload.motivo === 'renuncia' || payload.motivo === 'abandono' ? 'trabajador' : 'empleador';
    input.preaviso = {
      obligado: payload.preavisoObligado ?? obligadoPorDefecto,
      otorgado: payload.preavisoOtorgado ?? false,
      diasOtorgados: payload.diasPreavisoOtorgados,
    };
  }

  return input;
}

export function executeSettlementAction(payload: TobiSettlementActionPayload): {
  input: LiquidacionInput;
  result: LiquidacionResult;
} {
  const input = toLiquidacionInput(payload);
  const result = calcularLiquidacion(input);

  const salarioDeclarado = Math.round(payload.salarioMensual);
  if (salarioDeclarado > 0 && salarioDeclarado < SALARIO_MINIMO_MENSUAL_2026) {
    result.alertas = result.alertas || [];
    const yaExiste = result.alertas.some((a) => a.id === 'ALERTA_PISO_SALARIO_MINIMO');
    if (!yaExiste) {
      result.alertas.unshift({
        id: 'ALERTA_PISO_SALARIO_MINIMO',
        tipo: 'info',
        mensaje: `Piso de Protección Salarial (Art. 249 C.T.): Tu salario percibido (Gs. ${salarioDeclarado.toLocaleString('es-PY')}) es inferior al mínimo legal vigente. Por orden público, la liquidación fue calculada sobre el piso legal de Gs. ${SALARIO_MINIMO_MENSUAL_2026.toLocaleString('es-PY')} para proteger tus derechos irrenunciables.`,
        accion: 'informar',
      });
    }
  }

  return { input, result };
}
