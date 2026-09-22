/**
 * ORQUESTADOR — Motor de Liquidación Final de Haberes
 * Motor Liquidación PY · Versión PY-LIQ-2026.09.01
 *
 * Este es el punto de entrada del motor.
 * Recibe LiquidacionInput → devuelve LiquidacionResult.
 *
 * Principios de diseño (Master Legal §2):
 * (A) Datos de entrada  →  (B) Reglas legales parametrizadas  →  (C) Cálculo/resultado
 * NUNCA mezclar texto de UI con fórmulas.
 *
 * Fuentes: Ley N.º 213/93, Decreto-Ley N.º 1860/50, Decreto N.º 6225/2026
 */

import type {
  LiquidacionInput,
  LiquidacionResult,
  Concepto,
  Alerta,
  FuenteLegal,
} from './types';
import { validarInput } from './validation';
import { calcularAntiguedad } from './engine/dates';
import { calcularAguinaldo } from './engine/aguinaldo';
import { calcularVacaciones } from './engine/vacaciones';
import { calcularPreaviso } from './engine/preaviso';
import { calcularIndemnizacion } from './engine/indemnizacion';
import { calcularBonificacionFamiliar } from './engine/bonificacion';
import { calcularDescuentoIPS } from './engine/ips';
import { calcularJornalDiario } from './engine/salaryBase';
import { numeroALetrasGuaranies } from './utils/numberToWordsPY';
import { VERSION_REGLAS, FUENTES_LEGALES, DIVISOR_JORNAL_DIARIO } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes del motor (fijas)
// ─────────────────────────────────────────────────────────────────────────────

const FUENTES_MOTOR: FuenteLegal[] = [
  {
    norma: FUENTES_LEGALES.CODIGO_TRABAJO.norma,
    articulo: 'Arts. 87-92, 218-223, 243-244, 261-268',
    concepto: 'Código del Trabajo — fuente primaria',
  },
  {
    norma: FUENTES_LEGALES.IPS.norma,
    articulo: 'Art. 76',
    concepto: 'Base imponible IPS y aportes',
  },
  {
    norma: FUENTES_LEGALES.SALARIO_MINIMO_2026.norma,
    articulo: '—',
    concepto: 'Salario mínimo vigente 2026',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Motor principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la liquidación final de haberes.
 *
 * @throws Error si el input es inválido (no supera las validaciones)
 * @returns LiquidacionResult con todos los conceptos, alertas y totales
 */
export function calcularLiquidacion(input: LiquidacionInput): LiquidacionResult {
  // ── 1. Validar entrada ────────────────────────────────────────────────────
  const validacion = validarInput(input);
  if (!validacion.valido) {
    throw new Error(
      'Input inválido: ' +
        validacion.errores.map((e) => `[${e.field}] ${e.mensaje}`).join('; '),
    );
  }

  // ── 2. Antigüedad ─────────────────────────────────────────────────────────
  const antiguedad = calcularAntiguedad(input.fechaIngreso, input.fechaEgreso);

  // ── 3. Colecciones de resultados ──────────────────────────────────────────
  const conceptos: Concepto[] = [];
  const alertas: Alerta[] = [];

  // ── 4. Alerta por motivos especiales ──────────────────────────────────────

  // Despido con causa: advertencia de validez
  if (input.motivo === 'despido_con_causa') {
    alertas.push({
      id: 'A02',
      tipo: 'amarilla',
      mensaje:
        'La existencia y validez de una justa causa depende de hechos y pruebas. ' +
        'Esta calculadora no determina si la causa es jurídicamente válida.',
      accion: 'informar',
    });
  }

  // Abandono de trabajo (Art. 81 inc. j C.T.)
  if (input.motivo === 'abandono') {
    if (input.validacionAbandono?.notificadoEfectivo && !input.validacionAbandono?.reintegroCumplido) {
      alertas.push({
        id: 'A02_ABANDONO_CONFIGURADO',
        tipo: 'info',
        mensaje:
          `Abandono de Trabajo Configurado (Art. 81 inc. j C.T.): Se acreditó intimación formal por Telegrama Colacionado ` +
          `N.º ${input.validacionAbandono.nroTelegramaIntimacion} (${input.validacionAbandono.fechaEnvioTelegrama}) ` +
          `con plazo de ${input.validacionAbandono.plazoHorasOtorgado} hs vencido sin reintegro del colaborador. ` +
          'Se liquidan salarios trabajados, vacaciones y aguinaldo proporcional, sin preaviso ni indemnización.',
        accion: 'informar',
      });
    } else {
      alertas.push({
        id: 'A02_ABANDONO_RIESGO_PROCESAL',
        tipo: 'roja',
        mensaje:
          'ALERTA DE ALTO RIESGO PROCESAL — Abandono de Trabajo (Art. 81 inc. j C.T.): Para configurar válidamente el abandono ' +
          'ante el MTESS y tribunales, la jurisprudencia exige intimación formal previa vía Telegrama Colacionado con plazo de 48 a 72 hs. ' +
          'Sin constancia de recepción fehaciente y vencimiento del plazo, el trabajador puede demandar despido injustificado (indemnización + preaviso).',
        accion: 'derivar_profesional',
      });
    }
  }

  // Retiro justificado
  if (input.motivo === 'retiro_justificado') {
    alertas.push({
      id: 'A03',
      tipo: 'amarilla',
      mensaje:
        'El retiro justificado requiere verificar si la causa encaja en los ' +
        'supuestos del Art. 84 C.T. El resultado es provisional y requiere ' +
        'revisión profesional antes de ser presentado como definitivo.',
      accion: 'derivar_profesional',
    });
  }

  // Mutuo acuerdo
  if (input.motivo === 'mutuo_acuerdo') {
    alertas.push({
      id: 'A04',
      tipo: 'amarilla',
      mensaje:
        'En el mutuo acuerdo, los montos pactados pueden modificar el resultado. ' +
        'Revisar el documento de acuerdo antes de firmar.',
      accion: 'revisar',
    });
  }

  // Contrato a plazo fijo
  if (input.motivo === 'contrato_plazo_fijo') {
    alertas.push({
      id: 'A08',
      tipo: 'amarilla',
      mensaje:
        'El contrato a plazo fijo tiene un tratamiento especial. ' +
        'Este motor calcula la liquidación estándar del Código del Trabajo. ' +
        'Revisión profesional recomendada.',
      accion: 'revisar',
    });
  }

  // Variables sin datos completos
  if (input.tieneVariables && !input.remuneracionesUltimos6Meses?.length) {
    alertas.push({
      id: 'A06',
      tipo: 'amarilla',
      mensaje:
        'El trabajador tiene remuneraciones variables (comisiones, horas extras, etc.) ' +
        'pero no se ingresaron los datos históricos. El resultado puede diferir del real.',
      accion: 'informar',
    });
  }

  // ── 5. Salario pendiente (días del mes en curso) ──────────────────────────
  if (input.salariosPendientes && input.salariosPendientes > 0) {
    conceptos.push({
      id: 'salario_pendiente',
      nombre: 'Salarios Pendientes',
      monto: input.salariosPendientes,
      base: calcularJornalDiario(input.salarioMensual),
      formula: `Monto ingresado manualmente: Gs. ${input.salariosPendientes.toLocaleString('es-PY')}`,
      fuenteLegal: 'Art. 227, Ley N.º 213/93',
      esDescuento: false,
    });
  } else {
    // Calcular automáticamente: días del mes en curso hasta la fecha de egreso
    const diaEgreso = new Date(input.fechaEgreso + 'T00:00:00').getDate();
    const jornalDiario = calcularJornalDiario(input.salarioMensual);
    const montoSalarioDias = Math.round(jornalDiario * diaEgreso);

    conceptos.push({
      id: 'salario_base',
      nombre: `Salario Proporcional (${diaEgreso} días)`,
      monto: montoSalarioDias,
      dias: diaEgreso,
      base: jornalDiario,
      formula: `Gs. ${Math.round(jornalDiario).toLocaleString('es-PY')}/día × ${diaEgreso} días`,
      fuenteLegal: `Art. 227 y 232, Ley N.º 213/93 (÷ ${DIVISOR_JORNAL_DIARIO})`,
      esDescuento: false,
    });
  }

  // ── 5.1. Comisiones y Horas Extras (Haber Imponible) ─────────────────────
  if (input.comisiones && input.comisiones > 0) {
    conceptos.push({
      id: 'comisiones',
      nombre: 'Comisiones Devengadas',
      monto: input.comisiones,
      formula: `Monto declarado: Gs. ${input.comisiones.toLocaleString('es-PY')}`,
      fuenteLegal: 'Art. 231, Ley N.º 213/93 (Haber Imponible)',
      esDescuento: false,
    });
  }

  if (input.horasExtras && input.horasExtras > 0) {
    conceptos.push({
      id: 'horas_extras',
      nombre: 'Horas Extraordinarias Devengadas',
      monto: input.horasExtras,
      formula: `Monto declarado: Gs. ${input.horasExtras.toLocaleString('es-PY')}`,
      fuenteLegal: 'Art. 234, Ley N.º 213/93 (Haber Imponible)',
      esDescuento: false,
    });
  }

  // ── 6. Preaviso ───────────────────────────────────────────────────────────
  const preavisoResult = calcularPreaviso(
    input.salarioMensual,
    antiguedad,
    input.motivo,
    input.preaviso,
    input.regimenLaboral,
  );
  conceptos.push(...preavisoResult.conceptos);
  alertas.push(...preavisoResult.alertas);

  // ── 7. Indemnización ──────────────────────────────────────────────────────
  const indemnizacionResult = calcularIndemnizacion(
    input.salarioMensual,
    antiguedad,
    input.motivo,
    input.remuneracionesUltimos6Meses,
  );
  if (indemnizacionResult.concepto) {
    conceptos.push(indemnizacionResult.concepto);
  }
  alertas.push(...indemnizacionResult.alertas);

  // ── 8. Vacaciones ─────────────────────────────────────────────────────────
  const vacacionesResult = calcularVacaciones(
    input.salarioMensual,
    antiguedad,
    input.motivo,
    input.vacacionesPeriodosAnteriores ?? 0,
    input.vacacionesPeriodoActual ?? 0,
    input.vacacionesAnterioresVencidas,
    input.vacacionesPeriodoActualPendientes,
  );
  conceptos.push(...vacacionesResult.conceptos);
  alertas.push(...vacacionesResult.alertas);

  // ── 9. Aguinaldo proporcional ─────────────────────────────────────────────
  const aguinaldoResult = calcularAguinaldo(
    input.salarioMensual,
    input.fechaEgreso,
    input.remuneracionesAnio,
  );

  // ── 9.1. Aguinaldo de períodos anteriores impago ──────────────────────────
  if (input.aguinaldoAnteriorPendiente && input.aguinaldoAnteriorPendiente > 0) {
    conceptos.push({
      id: 'aguinaldo_anterior_pendiente',
      nombre: 'Aguinaldo Impago (Año Anterior / Períodos Pasados)',
      monto: input.aguinaldoAnteriorPendiente,
      formula: `Monto adeudado: Gs. ${input.aguinaldoAnteriorPendiente.toLocaleString('es-PY')}`,
      fuenteLegal: 'Art. 243, Ley N.º 213/93 (Obligación Legal Impostergable)',
      esDescuento: false,
      exentoIPS: true,
    });
    alertas.push({
      id: 'A09_AGUINALDO_IMPAGO',
      tipo: 'amarilla',
      mensaje:
        `Se incluye aguinaldo adeudado de períodos anteriores por Gs. ${input.aguinaldoAnteriorPendiente.toLocaleString('es-PY')}. ` +
        'El pago antes del 31 de diciembre es una obligación legal indelegable del empleador (Art. 243 Código del Trabajo). ' +
        'Se liquida íntegro sin descuentos de IPS.',
      accion: 'revisar',
    });
  }

  // ── 9.2. Protección de Maternidad y Fuero de Lactancia (Ley N.º 5508/15) ─
  if (input.estadoMaternidadLactancia && input.estadoMaternidadLactancia !== 'ninguno') {
    const condicionDesc = input.estadoMaternidadLactancia === 'embarazo'
      ? 'Estado de Embarazo / Gestación'
      : 'Período de Lactancia Materna';
    alertas.push({
      id: 'A10_MATERNIDAD_LACTANCIA',
      tipo: 'roja',
      mensaje:
        `🚨 ¡NO TE PUEDEN DESPEDIR! INAMOVILIDAD LABORAL ABSOLUTA (${condicionDesc} - Ley N.º 5508/15 y Art. 136 C.T.). ` +
        'En Paraguay, la trabajadora embarazada o en período de lactancia goza de fuero e inamovilidad. ' +
        'Todo despido dispuesto sin autorización judicial previa es NULO de pleno derecho. Tienes derecho a rechazar la desvinculación, ' +
        'exigir tu reincorporación inmediata o reclamar indemnización agravada con salarios caídos. ' +
        '¡NO firmes renuncia ni finiquito sin asesoramiento legal especializado!',
      accion: 'derivar_profesional',
    });
  }

  // ── 9.3. Bonificación Familiar (Arts. 261 al 271, Ley N.º 213/93) ─────────
  const diaEgresoBonif = new Date(input.fechaEgreso + 'T00:00:00').getDate();
  const bonifResult = calcularBonificacionFamiliar(input, diaEgresoBonif);
  if (bonifResult.concepto) {
    conceptos.push(bonifResult.concepto);
  }
  alertas.push(...bonifResult.alertas);

  // ── 10. Descuentos adicionales (comerciales) ──────────────────────────────
  if (input.descuentosAdicionales?.length) {
    for (const d of input.descuentosAdicionales) {
      conceptos.push({
        id: `descuento_${d.concepto.toLowerCase().replace(/\s+/g, '_')}`,
        nombre: d.concepto,
        monto: d.monto,
        formula: `Monto ingresado: Gs. ${d.monto.toLocaleString('es-PY')}`,
        fuenteLegal: 'Descuento pactado',
        esDescuento: true,
      });
    }
  }

  // ── 11. IPS (descuento trabajador) ────────────────────────────────────────
  const ipsResult = calcularDescuentoIPS(
    [...conceptos, aguinaldoResult.concepto],
    input.regimen ?? 'general',
    input.salarioMensual,
  );
  if (ipsResult.descuentoTrabajador) {
    conceptos.push(ipsResult.descuentoTrabajador);
  }
  alertas.push(...ipsResult.alertas);

  // ── 12. Totales ───────────────────────────────────────────────────────────
  const totalBruto = conceptos
    .filter((c) => !c.esDescuento)
    .reduce((acc, c) => acc + c.monto, 0);

  const totalDescuentos = conceptos
    .filter((c) => c.esDescuento)
    .reduce((acc, c) => acc + c.monto, 0);

  const aguinaldoProporcional = aguinaldoResult.concepto.monto;

  // Neto = Bruto - Descuentos + Aguinaldo (el aguinaldo se suma aparte por ser exento IPS)
  const totalNetoEstimado = totalBruto - totalDescuentos + aguinaldoProporcional;

  // ── 13. ¿Es provisional? ──────────────────────────────────────────────────
  const tieneAlertaRoja = alertas.some((a) => a.tipo === 'roja');
  const tieneIncertidumbre = conceptos.some((c) => c.incertidumbre);
  const esProvisional = tieneAlertaRoja || tieneIncertidumbre;

  // ── 14. Monto en letras ───────────────────────────────────────────────────
  const montoEnLetras = numeroALetrasGuaranies(totalNetoEstimado);

  // ── 15. Agregar aguinaldo a la lista de conceptos (al final, separado) ───
  conceptos.push(aguinaldoResult.concepto);

  return {
    totalBruto,
    aguinaldoProporcional,
    totalDescuentos,
    totalNetoEstimado,
    baseImponibleIPS: ipsResult.baseImponible,
    conceptos,
    alertas,
    antiguedad,
    fuentes: FUENTES_MOTOR,
    versionReglas: VERSION_REGLAS,
    montoEnLetras,
    esProvisional,
  };
}
