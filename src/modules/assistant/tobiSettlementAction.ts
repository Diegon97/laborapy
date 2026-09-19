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

/**
 * Convierte un LiquidacionInput ya calculado al payload canónico de la acción
 * de liquidación, permitiendo reutilizarlo como base para ajustes agénticos.
 *
 * Preserva el embargo judicial (descuentosAdicionales) para que ningún recálculo
 * agéntico elimine silenciosamente un descuento de orden judicial (Art. 245 C.T.).
 */
export function toSettlementActionPayload(input: LiquidacionInput): TobiSettlementActionPayload {
  const embargo = (input.descuentosAdicionales ?? []).find(
    (d) => d.monto > 0 && /embargo/i.test(d.concepto),
  );

  const payload: TobiSettlementActionPayload = {
    salarioMensual: input.salarioMensual,
    fechaIngreso: input.fechaIngreso,
    fechaEgreso: input.fechaEgreso,
    motivo: input.motivo,
    tieneVariables: input.tieneVariables,
    comisiones: input.comisiones,
    horasExtras: input.horasExtras,
    regimen: input.regimen,
    regimenLaboral: input.regimenLaboral,
    nombreEmpleado: input.nombreEmpleado,
    ciEmpleado: input.ciEmpleado,
    cargoEmpleado: input.cargoEmpleado,
    empresa: input.empresa,
    vacacionesPeriodoActual: input.vacacionesPeriodoActual,
    vacacionesPeriodosAnteriores: input.vacacionesPeriodosAnteriores,
    salariosPendientes: input.salariosPendientes,
    aguinaldoAnteriorPendiente: input.aguinaldoAnteriorPendiente,
    embargoJudicial: embargo ? embargo.monto : undefined,
  };

  if (input.preaviso) {
    return {
      ...payload,
      preavisoOtorgado: input.preaviso.otorgado,
      preavisoObligado: input.preaviso.obligado,
      diasPreavisoOtorgados: input.preaviso.diasOtorgados,
    };
  }

  return payload;
}

/** Normaliza texto quitando acentos y a minúsculas. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Intención explícita de corregir/ajustar datos ya cargados en la liquidación activa.
 * Evita que una pregunta conceptual con números dispare una mutación del finiquito.
 */
const CORRECTION_INTENT =
  /(?:era|eran|fue|ganaba|cobraba|percib|recib|corrig|actualiz|cambia|cambiar|en\s+realidad|realmente|en\s+verdad|equivoc|no\s+es|deberia|agreg|sum|anad|adeud|pendient|deb)/;

/** Intención de reportar vacaciones adeudadas, no gozadas o pendientes de suma. */
const VACATION_CLAIM_INTENT =
  /(?:agreg|sum|anad|faltan|deb|pendient|goz|sin\s+us|no\s+(?:la?s?\s+)?us|adeud|qued|resta)/;

/** Normaliza componentes de fecha a ISO YYYY-MM-DD. */
function parseDateComponents(dayStr: string, monthStr: string, yearStr: string): string | null {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    year = year < 70 ? 2000 + year : 1900 + year;
  }
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type MutableSettlementPayload = {
  -readonly [K in keyof TobiSettlementActionPayload]?: TobiSettlementActionPayload[K];
};

/**
 * Fallback agéntico determinístico para liquidaciones activas.
 *
 * Cuando el usuario solicita ajustes ("agrégale me faltan 10 días de vacaciones",
 * "entré el 15/09/2023", "mi salario era 4.500.000", etc.) sobre una liquidación que
 * ya existe en la sesión, esta función interpreta la intención y devuelve el nuevo payload.
 *
 * Solo muta la liquidación ante evidencia explícita de intención de ajuste; las preguntas
 * conceptuales que mencionan números no alteran el finiquito en pantalla.
 */
export function applyAgenticSettlementAdjustment(
  basePayload: TobiSettlementActionPayload,
  userText: string,
): TobiSettlementActionPayload | null {
  if (!basePayload || typeof userText !== 'string' || !userText.trim()) return null;

  const raw = userText.trim();
  const norm = normalizeText(raw);
  const adjustments: MutableSettlementPayload = {};

  // 1. Días de vacaciones pendientes de goce
  // Ejemplos: "agregale me faltan 10 dias de vacaciones", "tengo 10 dias de vacaciones",
  // "agregale 5 dias de vacaciones", "me deben 12 dias de vacaciones"
  const isVacationIntent =
    (/vacacion/.test(norm) && VACATION_CLAIM_INTENT.test(norm)) ||
    /faltan\s*\d+\s*dias?/.test(norm);
  if (isVacationIntent) {
    const daysMatch =
      /(\d{1,2})\s*dias?(?:\s*de\s*vacacion)?/i.exec(norm) ||
      /(?:vacacion(?:es)?)[^\d]{0,20}(\d{1,2})\s*dias?/i.exec(norm) ||
      /(?:faltan|agregale|sumale)\s*(\d{1,2})\s*dias?/i.exec(norm);

    if (daysMatch) {
      const dias = parseInt(daysMatch[1], 10);
      if (Number.isFinite(dias) && dias > 0) {
        const esAditivo = /(?:agreg|sum|anad|mas)/.test(norm);
        adjustments.vacacionesPeriodosAnteriores = esAditivo && (basePayload.vacacionesPeriodosAnteriores ?? 0) > 0
          ? (basePayload.vacacionesPeriodosAnteriores ?? 0) + dias
          : dias;
      }
    }
  }

  // 2. Corrección de fecha de ingreso
  // Ejemplos: "Entr ele 15/09/2023", "entre el 15/09/2023", "ingrese el 15-09-2023", "ingreso 2023-09-15"
  // `entr(?!eg)` excluye falsos positivos como "entregar documentos el 15/09/2023".
  const isIngresoIntent = /(?:entr(?!eg)|ingres)/i.test(raw);
  if (isIngresoIntent) {
    const dmyMatch = /(?:entr(?!eg)|ingres)[^\d]{0,25}(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i.exec(raw);
    if (dmyMatch) {
      const iso = parseDateComponents(dmyMatch[1], dmyMatch[2], dmyMatch[3]);
      if (iso) adjustments.fechaIngreso = iso;
    } else {
      const isoMatch = /(?:entr(?!eg)|ingres)[^\d]{0,25}(\d{4})-(\d{1,2})-(\d{1,2})/i.exec(raw);
      if (isoMatch) {
        const iso = parseDateComponents(isoMatch[3], isoMatch[2], isoMatch[1]);
        if (iso) adjustments.fechaIngreso = iso;
      }
    }
  }

  // 3. Corrección de fecha de egreso
  const isEgresoIntent = /(?:egreso|sal[ií]|despidieron|cese)/i.test(raw);
  if (isEgresoIntent) {
    const dmyMatch = /(?:egreso|sal[ií]|despidieron|cese)[^\d]{0,25}(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i.exec(raw);
    if (dmyMatch) {
      const iso = parseDateComponents(dmyMatch[1], dmyMatch[2], dmyMatch[3]);
      if (iso) adjustments.fechaEgreso = iso;
    } else {
      const isoMatch = /(?:egreso|sal[ií]|despidieron|cese)[^\d]{0,25}(\d{4})-(\d{1,2})-(\d{1,2})/i.exec(raw);
      if (isoMatch) {
        const iso = parseDateComponents(isoMatch[3], isoMatch[2], isoMatch[1]);
        if (iso) adjustments.fechaEgreso = iso;
      }
    }
  }

  // 4. Corrección de salario mensual
  // Ejemplos: "mi salario era 4.500.000", "sueldo de 3.500.000", "salario 4000000"
  const isSalaryIntent = /(?:salario|sueldo)/i.test(norm) && CORRECTION_INTENT.test(norm);
  if (isSalaryIntent) {
    const salaryMatch = /(?:salario|sueldo)[^\d]{0,20}(?:gs\.?|guaranies\s*)?([\d][\d\.]{3,})/i.exec(norm);
    if (salaryMatch) {
      const salario = parseInt(salaryMatch[1].replace(/\./g, ''), 10);
      if (Number.isFinite(salario) && salario >= 100000) {
        adjustments.salarioMensual = salario;
      }
    }
  }

  // 5. Comisiones o remuneraciones variables
  const isComisionIntent = /comision/.test(norm) && CORRECTION_INTENT.test(norm);
  if (isComisionIntent) {
    const comMatch = /comision[^\d]{0,20}(?:gs\.?|guaranies\s*)?([\d][\d\.]{3,})/i.exec(norm);
    if (comMatch) {
      const comision = parseInt(comMatch[1].replace(/\./g, ''), 10);
      if (Number.isFinite(comision) && comision > 0) {
        adjustments.comisiones = comision;
        adjustments.tieneVariables = true;
      }
    }
  }

  if (Object.keys(adjustments).length === 0) return null;

  return { ...basePayload, ...adjustments };
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
