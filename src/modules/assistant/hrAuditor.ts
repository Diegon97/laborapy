/**
 * MOTOR DE AUDITORÍA LABORAL ("SEGUNDO OJO") — PARAGUAY
 * Versión de reglas: PY-AUDIT-2026.09.10-REV2
 *
 * Fuente legal:
 *  - Ley N° 213/93 (Código del Trabajo de Paraguay)
 *  - Decreto N° 6225/2026 y Res. MTESS N° 670/2026
 *  - Decreto-Ley N° 1860/50 Art. 76 (Exención de IPS en Aguinaldo)
 */

import type {
  LiquidacionInput,
  LiquidacionResult,
  MotivoEgreso,
  AuditOptions,
  AuditReport,
  AuditFinding,
  HealthStatus,
  Severity,
} from './types';

export const SMV_2026_MONTO = 3_044_000;
export const SMV_2026_BASE_LEGAL = 'Decreto N° 6225/2026 y Res. MTESS N° 670/2026';

export const SMV_FALLBACK_MONTO = 2_798_309;
export const SMV_FALLBACK_BASE_LEGAL = 'Salario Mínimo Legal Vigente PY (Decreto N° 1473/2024)';

export const UMBRAL_DESCUENTO_WARNING = 0.30;
export const UMBRAL_DESCUENTO_ERROR = 0.5;

const PENALIZACION: Readonly<Record<Severity, number>> = {
  error: 25,
  warning: 10,
  info: 2,
};

export function parseNumericInput(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof raw !== 'string') return undefined;

  let text = raw.replace(/\u00a0/g, ' ').trim();
  if (text.length === 0) return undefined;

  const esParentesisNegativo = /^\(.*\)$/.test(text);
  if (esParentesisNegativo) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/₲/g, '').replace(/\b(?:gs|pyg)\.?/gi, '').replace(/\bgs\b/gi, '');

  const limpio = text.replace(/[^0-9.,+-]/g, '');
  if (!/[0-9]/.test(limpio)) return undefined;

  const esNegativo = esParentesisNegativo || limpio.startsWith('-');
  const sinSigno = limpio.replace(/^[+-]/, '');
  if (sinSigno.length === 0) return undefined;

  const tienePunto = sinSigno.includes('.');
  const tieneComa = sinSigno.includes(',');
  let normalizado: string;

  if (tienePunto && tieneComa) {
    const ultimaComa = sinSigno.lastIndexOf(',');
    const ultimoPunto = sinSigno.lastIndexOf('.');
    normalizado =
      ultimaComa > ultimoPunto
        ? sinSigno.replace(/\./g, '').replace(/,/g, '.')
        : sinSigno.replace(/,/g, '');
  } else if (tieneComa) {
    normalizado = /^\d{1,3}(,\d{3})+$/.test(sinSigno)
      ? sinSigno.replace(/,/g, '')
      : sinSigno.replace(/,/g, '.');
  } else if (tienePunto) {
    normalizado = /^\d{1,3}(\.\d{3})+$/.test(sinSigno)
      ? sinSigno.replace(/\./g, '')
      : sinSigno;
  } else {
    normalizado = sinSigno;
  }

  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return undefined;
  return esNegativo ? -Math.abs(valor) : valor;
}

function parseLocalDate(input?: string): Date | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const s = input.trim();

  const mIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (mIso) {
    const year = Number(mIso[1]);
    const month = Number(mIso[2]) - 1;
    const day = Number(mIso[3]);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const mLat = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s);
  if (mLat) {
    let year = Number(mLat[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(mLat[2]) - 1, Number(mLat[1]));
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback;
}

export function calculateSeniorityYears(fechaIngreso?: string, fechaEgreso?: string): number {
  const start = parseLocalDate(fechaIngreso);
  if (!start) return 0;
  const end = parseLocalDate(fechaEgreso) ?? new Date();
  if (end.getTime() < start.getTime()) return 0;

  let years = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  return Math.max(0, years);
}

export function requiredPreavisoDays(antiguedadAnios: number): number {
  if (antiguedadAnios <= 1) return 30;
  if (antiguedadAnios <= 5) return 45;
  if (antiguedadAnios <= 10) return 60;
  return 90;
}

export function resolveSalarioMinimo(year?: number): { monto: number; legalBase: string } {
  const y = typeof year === 'number' && Number.isFinite(year) ? year : new Date().getFullYear();
  if (y >= 2026) {
    return { monto: SMV_2026_MONTO, legalBase: SMV_2026_BASE_LEGAL };
  }
  return { monto: SMV_FALLBACK_MONTO, legalBase: SMV_FALLBACK_BASE_LEGAL };
}

function formatGs(amount: number): string {
  return `Gs. ${Math.round(amount).toLocaleString('es-PY')}`;
}

export function auditSettlement(
  input: Partial<LiquidacionInput>,
  result?: Partial<LiquidacionResult>,
  options: AuditOptions = {},
): AuditReport {
  const findings: AuditFinding[] = [];

  const rawInput = input as Record<string, unknown>;
  const rawResult = (result ?? {}) as Record<string, unknown>;

  const fechaEgresoStr = (rawInput.fechaEgreso ?? rawResult.fechaEgreso) as string | undefined;
  const fechaEgresoDate = parseLocalDate(fechaEgresoStr);
  const auditYear = options.year ?? fechaEgresoDate?.getFullYear() ?? new Date().getFullYear();

  const smvInfo = options.salarioMinimoOverride
    ? { monto: options.salarioMinimoOverride, legalBase: 'Salario mínimo configurado por el usuario' }
    : resolveSalarioMinimo(auditYear);

  const salarioBruto =
    parseNumericInput(rawInput.salarioMensual) ??
    parseNumericInput(rawInput.salarioBase) ??
    parseNumericInput(rawResult.totalBruto) ??
    parseNumericInput(rawInput.salarioBruto);

  const motivo = (rawInput.motivo ?? rawInput.motivoEgreso) as MotivoEgreso | undefined;

  const fechaIngresoStr = rawInput.fechaIngreso as string | undefined;
  const antiguedadAnios =
    typeof rawResult.antiguedad === 'object' && rawResult.antiguedad !== null && 'years' in rawResult.antiguedad
      ? Number((rawResult.antiguedad as { years: number }).years)
      : calculateSeniorityYears(fechaIngresoStr, fechaEgresoStr);

  // Indemnización
  let indemnizacionMonto: number | undefined = parseNumericInput(rawResult.indemnizacion);
  if (indemnizacionMonto === undefined && Array.isArray(rawResult.conceptos)) {
    const cIndem = (rawResult.conceptos as Array<{ id?: string; nombre?: string; monto?: number }>).find(
      (c) => c.id === 'indemnizacion' || /indemnizaci[oó]n/i.test(c.nombre ?? ''),
    );
    if (cIndem) indemnizacionMonto = parseNumericInput(cIndem.monto);
  }

  // Preaviso
  const preavisoDiasOtorgados =
    typeof rawInput.preaviso === 'object' && rawInput.preaviso !== null && 'diasOtorgados' in rawInput.preaviso
      ? parseNumericInput((rawInput.preaviso as { diasOtorgados?: number }).diasOtorgados)
      : parseNumericInput(rawInput.preavisoDias);

  const preavisoFueOtorgado =
    typeof rawInput.preaviso === 'object' && rawInput.preaviso !== null && 'otorgado' in rawInput.preaviso
      ? Boolean((rawInput.preaviso as { otorgado?: boolean }).otorgado)
      : undefined;

  let preavisoMontoSustitutivo: number | undefined = parseNumericInput(rawResult.preavisoMonto);
  if (preavisoMontoSustitutivo === undefined && Array.isArray(rawResult.conceptos)) {
    const cPreaviso = (rawResult.conceptos as Array<{ id?: string; nombre?: string; monto?: number }>).find(
      (c) => c.id === 'preaviso' || /preaviso/i.test(c.nombre ?? ''),
    );
    if (cPreaviso) preavisoMontoSustitutivo = parseNumericInput(cPreaviso.monto);
  }

  // Aguinaldo
  const aguinaldoDevengado =
    parseNumericInput(rawResult.aguinaldoProporcional) ??
    parseNumericInput(rawResult.aguinaldo) ??
    parseNumericInput(rawInput.aguinaldoAnteriorPendiente);

  // Descuentos
  let descuentosTotales = parseNumericInput(rawResult.totalDescuentos);
  if (descuentosTotales === undefined && Array.isArray(rawInput.descuentosAdicionales)) {
    descuentosTotales = (rawInput.descuentosAdicionales as Array<{ monto: number }>).reduce(
      (acc, d) => acc + (parseNumericInput(d.monto) ?? 0),
      0,
    );
  }

  // ── REGLA 1: Salario < Salario Mínimo Legal Vigente ─────────────────────
  if (salarioBruto === undefined) {
    findings.push({
      id: 'SMV-MISSING',
      code: 'SMV_MISSING',
      severity: 'info',
      category: 'remuneraciones',
      title: 'Salario base no informado',
      detail: 'No se detectó el salario base para auditar el cumplimiento del salario mínimo legal.',
      legalReference: smvInfo.legalBase,
      recommendation: 'Completá el salario mensual del colaborador para auditar la escala mínima vigente (salvo jornada a tiempo parcial proporcional Ley 6338/19).',
      field: 'salarioMensual',
    });
  } else if (salarioBruto < smvInfo.monto) {
    findings.push({
      id: 'SMV-VIOLATION',
      code: 'SMV_VIOLATION',
      severity: 'error',
      category: 'remuneraciones',
      title: 'Salario por debajo del mínimo legal vigente',
      detail: `El salario registrado (${formatGs(salarioBruto)}) es inferior al salario mínimo legal vigente (${formatGs(smvInfo.monto)}).`,
      legalReference: smvInfo.legalBase,
      recommendation: `Ajustá el salario base al mínimo de ley (${formatGs(smvInfo.monto)}) o documentá el régimen de empleo a tiempo parcial (Ley 6338/19).`,
      field: 'salarioMensual',
      expected: smvInfo.monto,
      actual: salarioBruto,
    });
  }

  // ── REGLA 2: Causa de Egreso vs Procedencia de Indemnización ──────────────
  const causasSinIndemnizacion: MotivoEgreso[] = [
    'renuncia',
    'despido_con_causa',
    'abandono',
    'periodo_prueba',
    'jubilacion',
  ];

  const causasConIndemnizacion: MotivoEgreso[] = [
    'despido_sin_causa',
    'retiro_justificado',
  ];

  if (motivo && causasSinIndemnizacion.includes(motivo)) {
    if (indemnizacionMonto !== undefined && indemnizacionMonto > 0) {
      findings.push({
        id: 'INDEMNIZACION-INDEBIDA',
        code: 'INDEMNIZACION_INDEBIDA',
        severity: 'error',
        category: 'desvinculacion',
        title: 'Indemnización improcedente según la causa de egreso',
        detail: `El motivo "${motivo}" no genera derecho a indemnización por despido, pero se calculó ${formatGs(indemnizacionMonto)}.`,
        legalReference: 'Art. 81, 87 y 91 Ley 213/93 (Código del Trabajo)',
        recommendation: 'Eliminá el rubro de indemnización por antigüedad para evitar pagos indebidos o contingencias tributarias.',
        field: 'indemnizacion',
        expected: 0,
        actual: indemnizacionMonto,
      });
    }
  }

  if (motivo && causasConIndemnizacion.includes(motivo)) {
    if (indemnizacionMonto === undefined || indemnizacionMonto <= 0) {
      findings.push({
        id: 'INDEMNIZACION-FALTANTE',
        code: 'INDEMNIZACION_FALTANTE',
        severity: 'error',
        category: 'desvinculacion',
        title: 'Falta indemnización por despido injustificado o retiro justificado',
        detail: `El motivo "${motivo}" exige el pago legal de indemnización por antigüedad (15 días de salario por año de servicio o fracción mayor a 6 meses).`,
        legalReference: 'Art. 91 Ley 213/93 (Código del Trabajo)',
        recommendation: 'Calculá y liquidá la indemnización por antigüedad correspondiente a los años de servicio.',
        field: 'indemnizacion',
      });
    }
  }

  // ── REGLA 3: Prohibición de Retención de IPS sobre Aguinaldo ──────────────
  let retencionIpsSobreAguinaldoDetectada = false;
  let montoIpsAguinaldo = 0;

  if (Array.isArray(rawResult.conceptos)) {
    for (const c of rawResult.conceptos as Array<{ nombre?: string; concepto?: string; monto?: number; esDescuento?: boolean; exentoIPS?: boolean }>) {
      const texto = `${c.nombre ?? ''} ${c.concepto ?? ''}`.toLowerCase();
      if (/ips/i.test(texto) && /aguinaldo/i.test(texto) && Boolean(c.esDescuento)) {
        retencionIpsSobreAguinaldoDetectada = true;
        montoIpsAguinaldo += Math.abs(c.monto ?? 0);
      }
    }
  }

  if (parseNumericInput(rawInput.ipsAguinaldo) || parseNumericInput(rawResult.ipsAguinaldo)) {
    retencionIpsSobreAguinaldoDetectada = true;
    montoIpsAguinaldo += parseNumericInput(rawInput.ipsAguinaldo) ?? parseNumericInput(rawResult.ipsAguinaldo) ?? 0;
  }

  if (retencionIpsSobreAguinaldoDetectada) {
    findings.push({
      id: 'IPS-AGUINALDO-PROHIBIDO',
      code: 'IPS_AGUINALDO_PROHIBIDO',
      severity: 'error',
      category: 'aguinaldo',
      title: 'Retención ilegal de IPS sobre el aguinaldo',
      detail: `Se detectó descuento de IPS sobre el aguinaldo (${formatGs(montoIpsAguinaldo)}). El aguinaldo es 100% inembargable y exento de aportes obreros de IPS.`,
      legalReference: 'Arts. 243 y 245 Ley 213/93 y Art. 76 Decreto-Ley N° 1860/50',
      recommendation: 'Eliminá de inmediato la retención de IPS aplicada sobre el aguinaldo proporcional.',
      field: 'aguinaldoProporcional',
      actual: montoIpsAguinaldo,
      expected: 0,
    });
  }

  // ── REGLA 4: Días de Preaviso Obligatorios según Antigüedad ──────────────
  if (motivo === 'despido_sin_causa' || motivo === 'retiro_justificado') {
    const diasRequeridos = requiredPreavisoDays(antiguedadAnios);
    const diasEfectivos = preavisoDiasOtorgados ?? (preavisoFueOtorgado ? diasRequeridos : 0);
    const tieneMontoSustitutivo = preavisoMontoSustitutivo !== undefined && preavisoMontoSustitutivo > 0;

    if (diasEfectivos < diasRequeridos && !tieneMontoSustitutivo) {
      findings.push({
        id: 'PREAVISO-INSUFICIENTE',
        code: 'PREAVISO_INSUFICIENTE',
        severity: 'error',
        category: 'preaviso',
        title: 'Preaviso omitido o insuficiente sin indemnización sustitutiva',
        detail: `Por antigüedad de ${antiguedadAnios} años corresponden ${diasRequeridos} días de preaviso legal. Se registraron ${diasEfectivos} días sin abonar la indemnización sustitutiva correspondiente.`,
        legalReference: 'Arts. 87, 88 y 90 Ley 213/93 (Código del Trabajo)',
        recommendation: `Otorgá los ${diasRequeridos} días de preaviso o aboná la indemnización sustitutiva de preaviso equivalente.`,
        field: 'preaviso',
        expected: diasRequeridos,
        actual: diasEfectivos,
      });
    }
  }

  // ── REGLA 5: Descuentos Excesivos (>25% warning/error, >50% error) ────────
  if (salarioBruto !== undefined && salarioBruto > 0 && descuentosTotales !== undefined && descuentosTotales > 0) {
    const porcentajeDescuento = descuentosTotales / salarioBruto;

    if (porcentajeDescuento > UMBRAL_DESCUENTO_ERROR) {
      findings.push({
        id: 'DESCUENTO-EXCESIVO-50',
        code: 'DESCUENTO_EXCESIVO_50',
        severity: 'error',
        category: 'remuneraciones',
        title: 'Descuentos salariales superan el límite absoluto del 50%',
        detail: `Los descuentos (${formatGs(descuentosTotales)}) representan el ${(porcentajeDescuento * 100).toFixed(1)}% del salario bruto, superando el tope legal del 50% aplicable exclusivamente a pensiones alimenticias.`,
        legalReference: 'Art. 242 y 245 Ley 213/93 (Código del Trabajo)',
        recommendation: 'Reducí los descuentos o acordá un plan de pagos en cuotas para preservar el mínimo inembargable de subsistencia.',
        field: 'totalDescuentos',
        expected: salarioBruto * 0.5,
        actual: descuentosTotales,
      });
    } else if (porcentajeDescuento > UMBRAL_DESCUENTO_WARNING) {
      findings.push({
        id: 'DESCUENTO-EXCESIVO-30',
        code: 'DESCUENTO_EXCESIVO_30',
        severity: 'warning',
        category: 'remuneraciones',
        title: 'Descuentos ordinarios superan el tope legal del 30%',
        detail: `Los descuentos (${formatGs(descuentosTotales)}) representan el ${(porcentajeDescuento * 100).toFixed(1)}% del salario bruto. Por Art. 242 C.T., las retenciones no judiciales tienen un tope máximo del 30%.`,
        legalReference: 'Art. 242 Ley 213/93',
        recommendation: 'Asegurate de contar con autorización expresa del trabajador o verificar que exceda solo por orden judicial de alimentos.',
        field: 'totalDescuentos',
        expected: salarioBruto * 0.30,
        actual: descuentosTotales,
      });
    }
  }

  // ── REGLA 6: Anticipo de Aguinaldo Excesivo ──────────────────────────────
  const anticipoAguinaldo =
    parseNumericInput(rawInput.anticipoAguinaldo) ??
    parseNumericInput(rawResult.anticipoAguinaldo);

  if (anticipoAguinaldo !== undefined && aguinaldoDevengado !== undefined) {
    if (anticipoAguinaldo > aguinaldoDevengado) {
      findings.push({
        id: 'ANTICIPO-AGUINALDO-EXCESIVO',
        code: 'ANTICIPO_AGUINALDO_EXCESIVO',
        severity: 'warning',
        category: 'aguinaldo',
        title: 'Anticipo de aguinaldo superior al aguinaldo devengado',
        detail: `El anticipo registrado (${formatGs(anticipoAguinaldo)}) supera el aguinaldo proporcional devengado a la fecha (${formatGs(aguinaldoDevengado)}).`,
        legalReference: 'Art. 243 Ley 213/93',
        recommendation: 'Verificá si el saldo en exceso debe imputarse como anticipo de salario ordinario.',
        field: 'anticipoAguinaldo',
        expected: aguinaldoDevengado,
        actual: anticipoAguinaldo,
      });
    }
  }

  // ── 4. Cálculo de Score y Estado de Salud Laboral ─────────────────────────
  let score = 100;
  let errorsCount = 0;
  let warningsCount = 0;
  let infosCount = 0;

  for (const f of findings) {
    score -= PENALIZACION[f.severity];
    if (f.severity === 'error') errorsCount++;
    else if (f.severity === 'warning') warningsCount++;
    else infosCount++;
  }

  score = Math.max(0, Math.min(100, score));

  let healthStatus: HealthStatus = 'optimo';
  if (errorsCount > 0) {
    healthStatus = 'critico';
  } else if (warningsCount > 0) {
    healthStatus = 'observaciones';
  }

  return {
    id: `audit-${Date.now()}`,
    healthStatus,
    score,
    summary: {
      totalFindings: findings.length,
      errors: errorsCount,
      warnings: warningsCount,
      infos: infosCount,
    },
    findings,
    options,
    generatedAt: new Date().toISOString(),
  };
}
