import type { LiquidacionInput, LiquidacionResult, MotivoEgreso } from '../payroll/types';
import { calcularLiquidacion } from '../payroll/liquidacion';
import { SALARIO_MINIMO_MENSUAL_2026 } from '../payroll/constants';
import type { TobiSettlementActionPayload } from './types';

export const SETTLEMENT_ACTION_REGEX =
  /(?:\*{0,2}[^\n]*?)?liquidacion_action\s*(\{[\s\S]*?\})\s*(?::::?|$)/i;

/** Regex secundario para limpiar cualquier residuo que los LLMs hayan dejado como texto */
export const SETTLEMENT_ACTION_CLEAN_REGEX =
  /(?:\*{0,2}[^\n]*?)?liquidacion_action[\s\S]*?(?::::?|$)/gi;

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
  despido: 'despido_sin_causa',
  renuncia_voluntaria: 'renuncia',
  'jubilación': 'jubilacion',
  fin_de_contrato: 'contrato_plazo_fijo',
};

/**
 * Intenta reparar y parsear JSON malformado generado por LLMs
 * (por ejemplo: comillas sin cerrar, claves sin comillas o valores string desnudos).
 */
function parseSettlementJsonOrFallback(rawJson: string): TobiSettlementActionPayload | null {
  if (!rawJson || typeof rawJson !== 'string') return null;

  // Intento 1: JSON nativo estándar
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === 'object') {
      const sal = Number(parsed.salarioMensual);
      const ing = typeof parsed.fechaIngreso === 'string' ? parsed.fechaIngreso.trim() : null;
      const egr = typeof parsed.fechaEgreso === 'string' ? parsed.fechaEgreso.trim() : null;
      const motRaw = typeof parsed.motivo === 'string' ? parsed.motivo.trim() : 'despido_sin_causa';
      const mot = ALIAS_MOTIVO[motRaw] ?? (motRaw as MotivoEgreso);

      if (sal > 0 && ing && egr && (MOTIVOS_VALIDOS as readonly string[]).includes(mot)) {
        return {
          ...parsed,
          salarioMensual: sal,
          fechaIngreso: ing,
          fechaEgreso: egr,
          motivo: mot,
        } as TobiSettlementActionPayload;
      }
    }
  } catch {
    // Si falla, proceder con rescate tolerante
  }

  // Intento 2: Extracción campo por campo mediante expresiones regulares tolerantes
  const getMatch = (regex: RegExp): string | null => {
    const m = regex.exec(rawJson);
    return m ? m[1].trim() : null;
  };

  const salarioStr = getMatch(/(?:salarioMensual|salario)["']?\s*:\s*(\d+)/i);
  const ingresoRaw = getMatch(/(?:fechaIngreso|ingreso)["']?\s*:\s*["']?(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})["']?/i);
  const egresoRaw = getMatch(/(?:fechaEgreso|egreso)["']?\s*:\s*["']?(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})["']?/i);
  const motivoRaw = getMatch(/(?:motivo)["']?\s*:\s*["']?([a-zA-Z_]+)["']?/i) || 'despido_sin_causa';
  const vacAntStr = getMatch(/(?:vacacionesPeriodosAnteriores)["']?\s*:\s*(\d+)/i);
  const vacActStr = getMatch(/(?:vacacionesPeriodoActual)["']?\s*:\s*(\d+)/i);
  const preavisoOtStr = getMatch(/(?:preavisoOtorgado)["']?\s*:\s*(true|false)/i);
  const preavisoObStr = getMatch(/(?:preavisoObligado)["']?\s*:\s*["']?([a-zA-Z_]+)["']?/i);
  const comisionesStr = getMatch(/(?:comisiones)["']?\s*:\s*(\d+)/i);
  const horasExtrasStr = getMatch(/(?:horasExtras)["']?\s*:\s*(\d+)/i);
  const aguinaldoAntStr = getMatch(/(?:aguinaldoAnteriorPendiente)["']?\s*:\s*(\d+)/i);
  const embargoStr = getMatch(/(?:embargoJudicial)["']?\s*:\s*(\d+)/i);
  const nombreEmpleado = getMatch(/(?:nombreEmpleado)["']?\s*:\s*["']?([^"',}\n]+)["']?/i);
  const ciEmpleado = getMatch(/(?:ciEmpleado)["']?\s*:\s*["']?([^"',}\n]+)["']?/i);

  if (!salarioStr || !ingresoRaw || !egresoRaw) return null;

  const normalizarFecha = (f: string): string | null => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
    const parts = f.split(/[\/\-\.]/);
    if (parts.length === 3) {
      return parseDateComponents(parts[0], parts[1], parts[2]);
    }
    return null;
  };

  const fechaIngreso = normalizarFecha(ingresoRaw);
  const fechaEgreso = normalizarFecha(egresoRaw);
  if (!fechaIngreso || !fechaEgreso) return null;

  const salarioMensual = Number(salarioStr);
  if (!Number.isFinite(salarioMensual) || salarioMensual <= 0) return null;

  const motivoNormalizado = ALIAS_MOTIVO[motivoRaw] ?? (motivoRaw as MotivoEgreso);
  if (!(MOTIVOS_VALIDOS as readonly string[]).includes(motivoNormalizado)) {
    return null;
  }

  return {
    salarioMensual,
    fechaIngreso,
    fechaEgreso,
    motivo: motivoNormalizado,
    vacacionesPeriodosAnteriores: vacAntStr ? Number(vacAntStr) : undefined,
    vacacionesPeriodoActual: vacActStr ? Number(vacActStr) : undefined,
    preavisoOtorgado: preavisoOtStr ? preavisoOtStr.toLowerCase() === 'true' : false,
    preavisoObligado: preavisoObStr === 'trabajador' ? 'trabajador' : 'empleador',
    comisiones: comisionesStr ? Number(comisionesStr) : undefined,
    horasExtras: horasExtrasStr ? Number(horasExtrasStr) : undefined,
    aguinaldoAnteriorPendiente: aguinaldoAntStr ? Number(aguinaldoAntStr) : undefined,
    embargoJudicial: embargoStr ? Number(embargoStr) : undefined,
    nombreEmpleado: nombreEmpleado ?? undefined,
    ciEmpleado: ciEmpleado ?? undefined,
    tieneVariables: (Number(comisionesStr) || 0) > 0 || (Number(horasExtrasStr) || 0) > 0,
  };
}

export function extractSettlementAction(text: string): {
  cleanedText: string;
  payload: TobiSettlementActionPayload | null;
} {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text || '', payload: null };
  }

  const match = SETTLEMENT_ACTION_REGEX.exec(text);
  let payload: TobiSettlementActionPayload | null = null;

  if (match) {
    const rawJson = match[1].trim();
    payload = parseSettlementJsonOrFallback(rawJson);
  }

  const cleanedText = text
    .replace(SETTLEMENT_ACTION_CLEAN_REGEX, '')
    .replace(/\*{0,2}Bloque de acci[oó]n\s+liquidacion_action[^\n]*\n?/gi, '')
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
    vacacionesPeriodoActualPendientes: payload.vacacionesPeriodoActualPendientes,
    vacacionesPeriodosAnteriores: payload.vacacionesPeriodosAnteriores,
    salariosPendientes: payload.salariosPendientes,
    aguinaldoAnteriorPendiente: payload.aguinaldoAnteriorPendiente,
    descuentosAdicionales: payload.embargoJudicial && payload.embargoJudicial > 0
      ? [{ concepto: 'Embargo Judicial (Tope 25% Art. 245 C.T.)', monto: payload.embargoJudicial }]
      : undefined,
  };

  if (payload.preavisoOtorgado !== undefined || payload.preavisoObligado !== undefined || payload.preavisoExonerado !== undefined) {
    const obligadoPorDefecto: 'empleador' | 'trabajador' =
      payload.motivo === 'renuncia' || payload.motivo === 'abandono' ? 'trabajador' : 'empleador';
    input.preaviso = {
      obligado: payload.preavisoObligado ?? obligadoPorDefecto,
      otorgado: payload.preavisoOtorgado ?? false,
      diasOtorgados: payload.diasPreavisoOtorgados,
      exonerado: payload.preavisoExonerado,
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
    vacacionesPeriodoActualPendientes: input.vacacionesPeriodoActualPendientes,
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
      preavisoExonerado: input.preaviso.exonerado,
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

/**
 * Limpia de forma exhaustiva cualquier marcador de bloque de máquina residual
 * para garantizar que el usuario nunca vea sintaxis técnica en pantalla.
 */
export function cleanAllActionBlockMarkers(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/(?:\*{0,2}(?:Bloque de acci[oó]n:?\s*)?:::?|:::)?liquidacion_action[\s\S]*?(?::::?|\*{0,2}|$)/gi, '')
    .replace(/(?:\*{0,2}(?:Bloque de acci[oó]n:?\s*)?:::?|:::)?documento_action[\s\S]*?(?::::?|\*{0,2}|$)/gi, '')
    .replace(/(?:\*{0,2}(?:Bloque de acci[oó]n:?\s*)?:::?|:::)?opciones_continuar[\s\S]*?(?::::?|\*{0,2}|$)/gi, '')
    .replace(/\*{0,2}Bloque de acci[oó]n\s+[a-zA-Z_]+[^\n]*\n?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fallback agéntico de auto-detección proactiva:
 * Si el usuario envía un mensaje con sus datos clave de liquidación (ej:
 * "3500000, ingrese 01/06/2019, egrese 18/09/26, despido injustificado, tengo 6 dias de vacaciones pendientes"),
 * esta función extrae determinísticamente los parámetros y construye el payload oficial.
 */
export function extractSettlementFromUserPrompt(
  userText: string,
  fallbackSalary?: number,
): TobiSettlementActionPayload | null {
  if (!userText || typeof userText !== 'string') return null;

  const raw = userText.trim();
  const norm = normalizeText(raw);

  // 1. Detección de salario mensual
  let salario: number | null = null;
  const salRegex = /(?:salario|sueldo|ganaba|cobraba|percib[ia]|monto)?[^\d]{0,12}(?:gs\.?|guaranies\s*)?(\d{1,3}(?:\.\d{3}){1,3}|\d{6,9})/i;
  const salMatch = salRegex.exec(raw);
  if (salMatch) {
    const parsed = parseInt(salMatch[1].replace(/\./g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= 100000) {
      salario = parsed;
    }
  }
  if (!salario && fallbackSalary && fallbackSalary > 0) {
    salario = fallbackSalary;
  }

  // 2. Detección de fechas (busca patrones DD/MM/YYYY o DD/MM/YY o YYYY-MM-DD)
  const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const foundDates: string[] = [];
  let dMatch: RegExpExecArray | null;
  while ((dMatch = dateRegex.exec(raw)) !== null) {
    const iso = parseDateComponents(dMatch[1], dMatch[2], dMatch[3]);
    if (iso && !foundDates.includes(iso)) {
      foundDates.push(iso);
    }
  }

  // Si no encontró con separadores comunes, buscar formato ISO YYYY-MM-DD
  if (foundDates.length < 2) {
    const isoRegex = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
    let isoMatch: RegExpExecArray | null;
    while ((isoMatch = isoRegex.exec(raw)) !== null) {
      const iso = parseDateComponents(isoMatch[3], isoMatch[2], isoMatch[1]);
      if (iso && !foundDates.includes(iso)) {
        foundDates.push(iso);
      }
    }
  }

  // Identificar fecha de ingreso y egreso
  let fechaIngreso: string | null = null;
  let fechaEgreso: string | null = null;

  const ingMatch = /(?:ingres[oe]|entr[eé]|inicio|desde)[^\d]{0,15}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})/i.exec(raw);
  if (ingMatch) {
    const dStr = ingMatch[1];
    const parts = dStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      fechaIngreso = parts[0].length === 4
        ? parseDateComponents(parts[2], parts[1], parts[0])
        : parseDateComponents(parts[0], parts[1], parts[2]);
    }
  }

  const egMatch = /(?:egres[oe]|sal[ií]|despidieron|hasta|cese|termino)[^\d]{0,15}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})/i.exec(raw);
  if (egMatch) {
    const dStr = egMatch[1];
    const parts = dStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      fechaEgreso = parts[0].length === 4
        ? parseDateComponents(parts[2], parts[1], parts[0])
        : parseDateComponents(parts[0], parts[1], parts[2]);
    }
  }

  // Fallback si encontramos exactamente 2 fechas ordenadas cronológicamente
  if ((!fechaIngreso || !fechaEgreso) && foundDates.length >= 2) {
    foundDates.sort();
    if (!fechaIngreso) fechaIngreso = foundDates[0];
    if (!fechaEgreso) fechaEgreso = foundDates[foundDates.length - 1];
  }

  if (!salario || !fechaIngreso || !fechaEgreso) {
    return null;
  }

  // 3. Detección de motivo
  let motivo: MotivoEgreso = 'despido_sin_causa';
  if (/renuncia/.test(norm)) {
    motivo = 'renuncia';
  } else if (/retiro\s+justificado|culpa\s+patronal/.test(norm)) {
    motivo = 'retiro_justificado';
  } else if (/mutuo\s+acuerdo/.test(norm)) {
    motivo = 'mutuo_acuerdo';
  } else if (/con\s+causa|justificado/.test(norm) && !/injustificado|sin\s+causa/.test(norm)) {
    motivo = 'despido_con_causa';
  } else if (/despido|echaron|desvincularon/.test(norm)) {
    motivo = 'despido_sin_causa';
  }

  // 4. Detección de vacaciones pendientes
  let vacacionesPeriodosAnteriores: number | undefined;
  const vacMatch = /(\d{1,2})\s*dias?(?:\s*de\s*vacacion)?/i.exec(norm) ||
    /(?:vacacion(?:es)?)[^\d]{0,15}(\d{1,2})\s*dias?/i.exec(norm);
  if (vacMatch) {
    const dias = parseInt(vacMatch[1], 10);
    if (Number.isFinite(dias) && dias > 0) {
      vacacionesPeriodosAnteriores = dias;
    }
  }

  return {
    salarioMensual: salario,
    fechaIngreso,
    fechaEgreso,
    motivo,
    vacacionesPeriodosAnteriores,
    preavisoOtorgado: false,
    preavisoObligado: motivo === 'renuncia' ? 'trabajador' : 'empleador',
  };
}
