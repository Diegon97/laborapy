import { describe, it, expect } from 'vitest';
import {
  calcularNominaMasiva,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from './monthlyPayrollEngine';
import { auditarNomina } from './payrollAudit';
import type { AlertaCierre } from './payrollAudit';
import type { EmpleadoNominaInput } from '../types';

const SMLV = SALARIO_MINIMO_LEGAL_VIGENTE; // 3.044.000 Gs.

/** Ejecuta el motor real de nómina y devuelve las alertas de auditoría. */
function auditar(empleados: EmpleadoNominaInput[], esAgenteRetentor = true): AlertaCierre[] {
  const { liquidaciones } = calcularNominaMasiva(empleados, SMLV, esAgenteRetentor);
  return auditarNomina(empleados, liquidaciones, esAgenteRetentor, SMLV);
}

const encontrar = (alertas: AlertaCierre[], id: string): AlertaCierre | undefined =>
  alertas.find((a) => a.id === id);

describe('Auditoría pre-cierre de nómina', () => {
  const base = (over: Partial<EmpleadoNominaInput>): EmpleadoNominaInput => ({
    ci: '0000000',
    nombre: 'FUNCIONARIO DE PRUEBA',
    cargo: 'AUXILIAR',
    tipo: 'cotizante_ips',
    salarioFijo: SMLV,
    ...over,
  });

  it('detecta neto negativo como crítico', () => {
    const alertas = auditar([base({ ci: '1', anticipoSalario: 3_500_000 })]);
    const alerta = encontrar(alertas, 'neto_negativo');
    expect(alerta?.nivel).toBe('critico');
    expect(alerta?.empleados).toHaveLength(1);
  });

  it('detecta vacaciones + reposo por encima de 30 días', () => {
    const alertas = auditar([base({ ci: '2', diasVacaciones: 20, diasReposo: 15 })]);
    expect(encontrar(alertas, 'dias_excedidos')?.nivel).toBe('critico');
  });

  it('advierte cotizante con salario bajo el mínimo', () => {
    const alertas = auditar([base({ ci: '3', salarioFijo: 2_000_000 })]);
    expect(encontrar(alertas, 'bajo_minimo')?.nivel).toBe('advertencia');
  });

  it('advierte cuando los descuentos superan el 50% del bruto', () => {
    const alertas = auditar([base({ ci: '4', anticipoSalario: 1_500_000 })]);
    expect(encontrar(alertas, 'descuentos_altos')?.nivel).toBe('advertencia');
  });

  it('advierte ausentismo de 5 o más días', () => {
    const alertas = auditar([base({ ci: '5', diasAusencias: 6 })]);
    expect(encontrar(alertas, 'ausentismo_alto')?.nivel).toBe('advertencia');
  });

  it('informa facturadores sin retención solo si la empresa no es agente retentor', () => {
    const emp = base({ ci: '6', tipo: 'factura', salarioFijo: 7_800_000 });

    const conNoRetencion = auditar([emp], false);
    expect(encontrar(conNoRetencion, 'sin_retencion')?.nivel).toBe('info');

    const conRetencion = auditar([emp], true);
    expect(encontrar(conRetencion, 'sin_retencion')).toBeUndefined();
  });

  it('marca listo para cerrar cuando no hay hallazgos', () => {
    const alertas = auditar([base({ ci: '7' })]);
    expect(encontrar(alertas, 'ok')?.nivel).toBe('info');
  });

  it('devuelve únicamente sin_datos cuando no hay empleados', () => {
    const alertas = auditar([]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].id).toBe('sin_datos');
    expect(alertas[0].nivel).toBe('info');
  });
});
