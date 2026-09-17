/**
 * MOTOR DE AUDITORÍA PRE-CIERRE DE NÓMINA MENSUAL (ERP LABORAPY)
 *
 * Evalúa reglas de negocio sobre la liquidación del período para detectar
 * inconsistencias que impidan un cierre y pago correctos antes de desembolsar.
 *
 * Es un motor puro y determinista: no accede a almacenamiento, red ni DOM.
 * Base legal: Ley N.º 213/93 (Código del Trabajo) y Decreto-Ley N.º 1860/50 (IPS).
 */

import type { EmpleadoNominaInput, LiquidacionMensualResult } from '../types';
import { SALARIO_MINIMO_LEGAL_VIGENTE, formatGuaranies } from './monthlyPayrollEngine';

export type NivelAlerta = 'critico' | 'advertencia' | 'info';

export interface AlertaCierre {
  id: string; // 'neto_negativo' | 'dias_excedidos' | 'bajo_minimo' | 'descuentos_altos' | 'ausentismo_alto' | 'sin_retencion' | 'sin_datos' | 'ok'
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
  /** Empleados afectados por la alerta (vacío para 'ok' y 'sin_datos'). */
  empleados: { ci: string; nombre: string; valor: string }[];
}

/**
 * Ejecuta la auditoría pre-cierre de la nómina.
 *
 * Reglas evaluadas (liquidaciones[i] corresponde a empleados[i]):
 *  R1 · netoACobrar < 0                          → crítico 'neto_negativo'
 *  R2 · días de vacaciones + reposo > 30         → crítico 'dias_excedidos'
 *  R3 · cotizante IPS con salarioFijo < smlv     → advertencia 'bajo_minimo'
 *  R4 · descuentos > 50% del bruto (bruto > 0)   → advertencia 'descuentos_altos'
 *  R5 · diasAusencias >= 5                       → advertencia 'ausentismo_alto'
 *  R6 · empresa NO retentora con facturadores    → info 'sin_retencion'
 *  R7 · sin empleados cargados                   → info 'sin_datos' (única alerta)
 *  R8 · sin críticos ni advertencias             → info 'ok'
 *
 * @param empleados        Funcionarios de la planilla del período.
 * @param liquidaciones    Resultados del motor, alineados por índice con empleados.
 * @param esAgenteRetentor Condición fiscal de la empresa (retención 30% IVA a facturadores).
 * @param smlv             Salario Mínimo Legal Vigente de referencia (por defecto el del engine).
 * @returns Alertas ordenadas: críticos, advertencias e informativas.
 */
export function auditarNomina(
  empleados: EmpleadoNominaInput[],
  liquidaciones: LiquidacionMensualResult[],
  esAgenteRetentor: boolean,
  smlv: number = SALARIO_MINIMO_LEGAL_VIGENTE,
): AlertaCierre[] {
  // R7 · Período sin planilla: no hay nada que auditar.
  if (empleados.length === 0) {
    return [
      {
        id: 'sin_datos',
        nivel: 'info',
        titulo: 'Sin datos para auditar',
        detalle:
          'No hay una liquidación guardada para el período. Cargá la 📗 Planilla Editable y usá Guardar Periodo antes de cerrar.',
        empleados: [],
      },
    ];
  }

  const negativos: AlertaCierre['empleados'] = [];
  const diasExcedidos: AlertaCierre['empleados'] = [];
  const bajoMinimo: AlertaCierre['empleados'] = [];
  const descuentosAltos: AlertaCierre['empleados'] = [];
  const ausentismoAlto: AlertaCierre['empleados'] = [];
  const facturadoresSinRetencion: AlertaCierre['empleados'] = [];
  let netoFacturadores = 0;

  liquidaciones.forEach((liq, i) => {
    const emp = empleados[i] ?? liq.input;
    const ref = { ci: emp.ci, nombre: emp.nombre };

    // R1 · Neto a cobrar negativo: los descuentos superan el sueldo del período.
    if (liq.netoACobrar < 0) {
      negativos.push({ ...ref, valor: formatGuaranies(liq.netoACobrar) });
    }

    // R2 · Días de vacaciones + reposo por encima del mes legal de 30 días.
    const vacaciones = emp.diasVacaciones || 0;
    const reposo = emp.diasReposo || 0;
    if (vacaciones + reposo > 30) {
      diasExcedidos.push({ ...ref, valor: `Vac ${vacaciones} + Rep ${reposo}` });
    }

    // R3 · Cotizante IPS por debajo del Salario Mínimo Legal Vigente.
    if (emp.tipo === 'cotizante_ips' && emp.salarioFijo < smlv) {
      bajoMinimo.push({ ...ref, valor: formatGuaranies(emp.salarioFijo) });
    }

    // R4 · Descuentos superiores a la mitad de los haberes brutos.
    const bruto = liq.haberes.totalHaberesBrutos;
    if (bruto > 0 && liq.descuentos.totalDescuentos > bruto * 0.5) {
      const porcentaje = Math.round((liq.descuentos.totalDescuentos / bruto) * 100);
      descuentosAltos.push({ ...ref, valor: `%: ${porcentaje}%` });
    }

    // R5 · Ausentismo elevado (5 o más días de ausencia).
    const ausencias = emp.diasAusencias || 0;
    if (ausencias >= 5) {
      ausentismoAlto.push({ ...ref, valor: `${ausencias} días` });
    }

    // R6 · Facturadores que cobran sin retención de IVA (empresa no agente retentor).
    if (!esAgenteRetentor && emp.tipo === 'factura') {
      facturadoresSinRetencion.push({ ...ref, valor: formatGuaranies(liq.netoACobrar) });
      netoFacturadores += liq.netoACobrar;
    }
  });

  const criticos: AlertaCierre[] = [];
  const advertencias: AlertaCierre[] = [];
  const infos: AlertaCierre[] = [];

  // ── Críticos ──
  if (negativos.length > 0) {
    criticos.push({
      id: 'neto_negativo',
      nivel: 'critico',
      titulo: 'Neto a cobrar negativo',
      detalle:
        'El neto a cobrar es negativo: los descuentos superan el sueldo del período. Revisá anticipos, préstamos y compras a crédito antes de pagar.',
      empleados: negativos,
    });
  }

  if (diasExcedidos.length > 0) {
    criticos.push({
      id: 'dias_excedidos',
      nivel: 'critico',
      titulo: 'Días de vacaciones/reposo excedidos',
      detalle:
        'La suma de días de vacaciones y reposo supera los 30 días del mes legal. Verificá los días cargados para no liquidar de más.',
      empleados: diasExcedidos,
    });
  }

  // ── Advertencias ──
  if (bajoMinimo.length > 0) {
    advertencias.push({
      id: 'bajo_minimo',
      nivel: 'advertencia',
      titulo: 'Salario por debajo del mínimo legal',
      detalle:
        'El salario fijo es inferior al SMLV vigente. Verificá si corresponde a una jornada parcial legalmente registrada antes de cerrar.',
      empleados: bajoMinimo,
    });
  }

  if (descuentosAltos.length > 0) {
    advertencias.push({
      id: 'descuentos_altos',
      nivel: 'advertencia',
      titulo: 'Descuentos superan el 50% del bruto',
      detalle:
        'Más de la mitad de los haberes brutos se destina a descuentos. Revisá embargos y anticipos por posibles límites legales de retención.',
      empleados: descuentosAltos,
    });
  }

  if (ausentismoAlto.length > 0) {
    advertencias.push({
      id: 'ausentismo_alto',
      nivel: 'advertencia',
      titulo: 'Ausentismo elevado',
      detalle:
        'Se registran 5 o más días de ausencia en el período. Verificá la justificación de las faltas y su impacto en los haberes imponibles al IPS.',
      empleados: ausentismoAlto,
    });
  }

  // ── Informativas ──
  if (facturadoresSinRetencion.length > 0) {
    infos.push({
      id: 'sin_retencion',
      nivel: 'info',
      titulo: 'Facturadores sin retención de IVA',
      detalle: `${facturadoresSinRetencion.length} facturador(es) cobran sin retención IVA. Neto total: ${formatGuaranies(netoFacturadores)}.`,
      empleados: facturadoresSinRetencion,
    });
  }

  // R8 · Sin críticos ni advertencias: el período está listo para cerrar.
  if (criticos.length === 0 && advertencias.length === 0) {
    infos.push({
      id: 'ok',
      nivel: 'info',
      titulo: 'Listo para cerrar',
      detalle:
        'No se detectaron inconsistencias críticas ni observaciones en la liquidación del período.',
      empleados: [],
    });
  }

  return [...criticos, ...advertencias, ...infos];
}
