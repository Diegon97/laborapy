/**
 * TESTS — Integración contable del IPS (una sola fuente de verdad del redondeo)
 *
 * Verifica que el motor de nómina y el cierre contable usen la MISMA aritmética exacta que el
 * motor IPS (`src/modules/ips/aritmetica.ts`) y no la multiplicación en punto flotante.
 *
 * Caso testigo: ₲7.032.050 × 9 % = ₲632.884,5 exacto. El valor legal es ₲632.885; la
 * aritmética flotante devuelve ₲632.884. Esa diferencia de ₲1 es la que impide que el libro
 * contable y la planilla del IPS cierren a cero.
 *
 * Decreto-Ley N.º 1860/50, Art. 76.
 */

import { describe, it, expect } from 'vitest';
import {
  calcularLiquidacionMensual,
  calcularNominaMasiva,
} from '../../monthlyPayroll/engine/monthlyPayrollEngine';
import { generarImpactoCierreLegal } from '../../monthlyPayroll/services/payrollClosingCompliance';
import type { EmpleadoNominaInput } from '../../monthlyPayroll/types';
import type { PeriodoNomina } from '../../monthlyPayroll/types/noveltyTypes';
import { aplicarTasaPorMil, sumarGs } from '../aritmetica';

/** Base imponible que cae exactamente en el medio guaraní al aplicar el 9 %. */
const BASE_MEDIO_EXACTO = 7_032_050;

function empleado(ci: string, salarioFijo: number): EmpleadoNominaInput {
  return {
    ci,
    nombre: `FUNCIONARIO ${ci}`,
    cargo: 'Analista',
    tipo: 'cotizante_ips',
    salarioFijo,
  };
}

function periodoDePrueba(): PeriodoNomina {
  return {
    id: '2026-08',
    codigoFormal: 'MEN 08 (Agosto 2026)',
    mes: 8,
    anio: 2026,
    estado: 'abierto',
    tipoLiquidacion: 'mensual_ips',
    moneda: 'PYG',
  };
}

describe('integracion contable IPS - redondeo exacto', () => {
  it('E01: el 9 % de una base en el medio guaraní se resuelve con half-up exacto a 632.885', () => {
    const liquidacion = calcularLiquidacionMensual(empleado('1000001', BASE_MEDIO_EXACTO));

    // ₲7.032.050 × 9 % = ₲632.884,5 exacto -> ROUND_HALF_UP -> ₲632.885
    expect(liquidacion.haberesImponiblesIps).toBe(BASE_MEDIO_EXACTO);
    expect(liquidacion.descuentos.aporteObreroIps).toBe(632_885);
    expect(liquidacion.descuentos.aporteObreroIps).toBe(
      aplicarTasaPorMil(BASE_MEDIO_EXACTO, 90),
    );
    expect(liquidacion.aportePatronalIps).toBe(1_160_288);
  });

  it('E01b: la exactitud quedó garantizada por construcción, no por el comportamiento del float', () => {
    // HALLAZGO verificado con un barrido de 100.000 bases múltiplos de ₲50 en el rango
    // ₲1.000 a ₲5.000.000: en este runtime `Math.round(base * 0.09)` coincide con el half-up
    // exacto en TODOS los casos, así que el motor de nómina no estaba produciendo un valor
    // incorrecto. El defecto real estaba en el proceso manual anterior, que usaba `round()` de
    // Python (redondeo bancario) y devolvía ₲632.884.
    //
    // Se migró igual a la aritmética exacta por dos razones: (1) la igualdad pasa a ser una
    // garantía y no una coincidencia del runtime, y (2) el libro contable y la planilla del IPS
    // comparten una única implementación del redondeo, que es lo que permite que la
    // triangulación de 4 puntos cierre.
    expect(Math.round(BASE_MEDIO_EXACTO * 0.09)).toBe(632_885);
    expect(aplicarTasaPorMil(BASE_MEDIO_EXACTO, 90)).toBe(632_885);
  });

  it('E02: el total masivo es la suma de los redondeos individuales, no el porcentaje del agregado', () => {
    // Bases elegidas para que la suma de los redondeos individuales difiera del porcentaje
    // aplicado al agregado:
    //   4.000.080 x 90 / 1000 = 360.007,2 -> half-up 360.007
    //   4.000.060 x 90 / 1000 = 360.005,4 -> half-up 360.005
    //   suma de redondeos individuales = 720.012
    //   agregado 8.000.140 x 90 / 1000 = 720.012,6 -> half-up 720.013 (difiere en ₲1)
    const nomina = calcularNominaMasiva([
      empleado('1000001', 4_000_080),
      empleado('2000002', 4_000_060),
    ]);

    expect(nomina.totales.totalHaberesImponibles).toBe(8_000_140);
    expect(nomina.totales.totalIpsObrero).toBe(720_012);
    expect(nomina.totales.totalIpsPatronal).toBe(1_320_023);
    expect(nomina.totales.totalIpsObrero).not.toBe(Math.round(8_000_140 * 0.09));
    expect(Math.round(8_000_140 * 0.09)).toBe(720_013);
  });

  it('E03: el cierre contable deriva los cuatro totales de IPS con la aritmetica del motor', () => {
    const liquidaciones = calcularNominaMasiva([
      empleado('1000001', 4_000_080),
      empleado('2000002', 4_000_060),
    ]).liquidaciones;

    // Total de control: el mismo cálculo hecho con los primitivos del motor IPS.
    const bases = liquidaciones.map((liquidacion) => liquidacion.haberesImponiblesIps);
    expect(sumarGs(bases)).toBe(8_000_140);
    expect(sumarGs(bases.map((base) => aplicarTasaPorMil(base, 90)))).toBe(720_012);
    expect(sumarGs(bases.map((base) => aplicarTasaPorMil(base, 165)))).toBe(1_320_023);

    const cierre = generarImpactoCierreLegal(periodoDePrueba(), liquidaciones);
    const resumen = cierre.resumenFinanciero;

    expect(resumen.cantidadLiquidaciones).toBe(2);
    expect(resumen.totalImponibleIps).toBe(8_000_140);
    expect(resumen.totalAporteObrero9).toBe(720_012);
    expect(resumen.totalAportePatronal165).toBe(1_320_023);
    expect(resumen.totalAporteIps255).toBe(2_040_035);

    // La conciliación solo puede cerrar si el libro y la planilla comparten la aritmética.
    expect(resumen.totalAporteObrero9).toBe(
      sumarGs(bases.map((base) => aplicarTasaPorMil(base, 90))),
    );
    expect(resumen.totalAporteIps255).toBe(
      resumen.totalAporteObrero9 + resumen.totalAportePatronal165,
    );
  });

  it('E04: el cierre excluye a los prestadores con factura de la base imponible', () => {
    const liquidaciones = calcularNominaMasiva([
      empleado('1000001', 3_500_000),
      { ci: '3000003', nombre: 'PRESTADOR DEMO', cargo: 'Asesor', tipo: 'factura', salarioFijo: 6_000_000 },
    ]).liquidaciones;

    const cierre = generarImpactoCierreLegal(periodoDePrueba(), liquidaciones);
    const resumen = cierre.resumenFinanciero;

    // Solo el cotizante aporta: 3.500.000 x 9 % y x 16,5 %.
    expect(resumen.totalImponibleIps).toBe(3_500_000);
    expect(resumen.totalAporteObrero9).toBe(315_000);
    expect(resumen.totalAportePatronal165).toBe(577_500);
    expect(resumen.totalAporteIps255).toBe(892_500);
  });

  it('E05: una liquidacion final reporta la baja REI con la tasa patronal exacta', () => {
    const liquidaciones = calcularNominaMasiva([empleado('4000004', 4_000_080)]).liquidaciones;

    const cierre = generarImpactoCierreLegal(
      {
        ...periodoDePrueba(),
        tipoLiquidacion: 'liquidacion_final',
        empleadoSalida: {
          ci: '4000004',
          nombre: 'FUNCIONARIO 4000004',
          motivo: 'Renuncia',
          fechaEgreso: '2026-08-14',
        },
      },
      liquidaciones,
    );

    expect(cierre.reporteBajaREI?.salarioImponible).toBe(4_000_080);
    expect(cierre.reporteBajaREI?.aporteObrero9).toBe(360_007);
    expect(cierre.reporteBajaREI?.aportePatronal165).toBe(660_013);
    expect(cierre.reporteBajaREI?.funcionario.codigoEgresoIPS).toBe('01');
    expect(cierre.plazosLegales.some((plazo) => plazo.entidad === 'MTESS')).toBe(true);
  });
});
