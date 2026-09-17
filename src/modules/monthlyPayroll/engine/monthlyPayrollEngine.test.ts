import { describe, it, expect } from 'vitest';
import {
  calcularLiquidacionMensual,
  calcularNominaMasiva,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from './monthlyPayrollEngine';
import type { EmpleadoNominaInput } from '../types';

const SMLV = SALARIO_MINIMO_LEGAL_VIGENTE; // 3.044.000 Gs.

describe('Motor de Liquidación y Pago Salarial Mensual - NOMINA GRAL', () => {
  /* -------------------------------------------------------------------
   * TEST 1: Cotizante IPS estándar con SMLV, 10 hs 50% y 1 hijo.
   * Caso representativo de liquidación corporativa.
   * ------------------------------------------------------------------- */
  it('Test 1: Cotizante IPS con SMLV, 10 hs al 50% y 1 hijo', () => {
    const input: EmpleadoNominaInput = {
      ci: '1000001',
      nombre: 'COLABORADOR DE DEPOSITO',
      cargo: 'AUXILIAR DE DEPOSITO',
      tipo: 'cotizante_ips',
      salarioFijo: 3_100_000,
      cantHoras50: 10,
      cantidadHijos: 1,
      anticipoSalario: 620_000,
      compraCreditoEmpresa: 360_000, // 200.000 + 160.000
    };

    const r = calcularLiquidacionMensual(input, SMLV);

    expect(r.diasTrabajadosEfectivos).toBe(30);
    expect(r.haberes.salarioBaseDiasTrabajados).toBe(3_100_000);

    // 10 hs al 50% = (3.100.000 / 240 * 1.5) * 10 = 193.750 Gs.
    expect(r.haberes.montoHoras50).toBe(193_750);

    // Bonificación familiar: 5% de 3.044.000 = 152.200 Gs.
    expect(r.haberes.bonificacionFamiliar).toBe(152_200);

    // Total Bruto: 3.100.000 + 193.750 + 152.200 = 3.445.950 Gs.
    expect(r.haberes.totalHaberesBrutos).toBe(3_445_950);

    // Imponible IPS: EXCLUYE Bonificación Familiar (3.100.000 + 193.750 = 3.293.750)
    expect(r.haberesImponiblesIps).toBe(3_293_750);

    // IPS Obrero 9%: 3.293.750 * 9% = 296.438 Gs.
    expect(r.descuentos.aporteObreroIps).toBe(296_438);

    // Total descuentos = 296.438 (IPS) + 620.000 (Anticipo) + 360.000 (Cta Cte) = 1.276.438
    expect(r.descuentos.totalDescuentos).toBe(1_276_438);

    // Neto a cobrar = 3.445.950 - 1.276.438 = 2.169.512 Gs.
    expect(r.netoACobrar).toBe(2_169_512);
  });

  /* -------------------------------------------------------------------
   * TEST 2: Cotizante IPS con 1 día de reposo y 6.5 hs feriado 100%.
   * Caso representativo de liquidación corporativa.
   * ------------------------------------------------------------------- */
  it('Test 2: Cotizante IPS con 1 día reposo y 6.5 hs al 100% (feriado)', () => {
    const input: EmpleadoNominaInput = {
      ci: '1000002',
      nombre: 'COLABORADOR DE TIENDA',
      cargo: 'SALE ATHLETE',
      tipo: 'cotizante_ips',
      salarioFijo: SMLV, // 3.044.000
      diasReposo: 1,
      cantHoras50: 27,
      cantHoras100: 6.5,
      compraCreditoEmpresa: 280_000,
    };

    const r = calcularLiquidacionMensual(input, SMLV);

    // Días trabajados: 30 - 1 reposo = 29 días
    expect(r.diasTrabajadosEfectivos).toBe(29);

    const valorDia = SMLV / 30;
    const valorHora = SMLV / 240;

    // Salario 29 días: 3.044.000 / 30 * 29 = 2.942.533
    expect(r.haberes.salarioBaseDiasTrabajados).toBe(Math.round(valorDia * 29));

    // Reposo 1 día (50% empresa): 3.044.000 / 30 * 1 / 2 = 50.733
    expect(r.haberes.montoReposo).toBe(Math.round(valorDia * 0.5));

    // 27 hs 50%: (3.044.000 / 240 * 1.5) * 27 = 513.675
    expect(r.haberes.montoHoras50).toBe(Math.round(valorHora * 1.5 * 27));

    // 6.5 hs 100%: (3.044.000 / 240) * 6.5 = 82.442
    expect(r.haberes.montoHoras100).toBe(Math.round(valorHora * 6.5));

    // Haberes imponibles = Salario + Reposo + Hs50 + Hs100
    const esperadoImponible =
      r.haberes.salarioBaseDiasTrabajados +
      r.haberes.montoReposo +
      r.haberes.montoHoras50 +
      r.haberes.montoHoras100;
    expect(r.haberesImponiblesIps).toBe(esperadoImponible);

    // IPS 9%
    expect(r.descuentos.aporteObreroIps).toBe(Math.round(esperadoImponible * 0.09));

    // Neto
    expect(r.netoACobrar).toBe(
      r.haberes.totalHaberesBrutos - r.descuentos.totalDescuentos,
    );
  });

  /* -------------------------------------------------------------------
   * TEST 3: Prestador de Servicios con Factura (Honorarios 7.800.000 Gs).
   * Caso representativo de liquidación corporativa.
   * IVA 10% = 780.000, Retención IVA 30% = 234.000, IPS = 0.
   * ------------------------------------------------------------------- */
  it('Test 3: Prestador de Servicios con Factura (IVA 10% y Retención 30%)', () => {
    const input: EmpleadoNominaInput = {
      ci: '1000003',
      nombre: 'PRESTADORA DE SERVICIOS',
      cargo: 'CONTADORA EXTERNA',
      tipo: 'factura',
      salarioFijo: 7_800_000,
      compraCreditoEmpresa: 350_000,
    };

    const r = calcularLiquidacionMensual(input, SMLV);

    expect(r.haberes.salarioBaseDiasTrabajados).toBe(7_800_000);

    // IVA 10% sobre honorarios facturados = 780.000 Gs.
    expect(r.haberes.ivaMonto).toBe(780_000);

    // Total Haberes Brutos = 7.800.000 + 780.000 = 8.580.000 Gs.
    expect(r.haberes.totalHaberesBrutos).toBe(8_580_000);

    // Retención 30% del IVA = 780.000 * 30% = 234.000 Gs.
    expect(r.retencionIva).toBe(234_000);

    // Sueldo Menos Retención = 8.580.000 - 234.000 = 8.346.000 Gs.
    expect(r.sueldoMenosRetencion).toBe(8_346_000);

    // IPS = 0 (no es dependiente)
    expect(r.haberesImponiblesIps).toBe(0);
    expect(r.descuentos.aporteObreroIps).toBe(0);
    expect(r.aportePatronalIps).toBe(0);

    // Descuento compra a crédito = 350.000
    expect(r.descuentos.compraCreditoEmpresa).toBe(350_000);
    expect(r.descuentos.totalDescuentos).toBe(350_000);

    // Neto a Cobrar = 8.346.000 - 350.000 = 7.996.000 Gs.
    expect(r.netoACobrar).toBe(7_996_000);
  });

  /* -------------------------------------------------------------------
   * TEST 4: Empleado con 2 días de ausencia injustificada y compras
   * a crédito de la empresa.
   * ------------------------------------------------------------------- */
  it('Test 4: Empleado con 2 días de ausencia y compras a crédito', () => {
    const salario = 4_500_000;
    const compra = 300_000;

    const input: EmpleadoNominaInput = {
      ci: '4567890',
      nombre: 'EMPLEADO CON AUSENCIAS',
      cargo: 'Ventas',
      tipo: 'cotizante_ips',
      salarioFijo: salario,
      diasAusencias: 2,
      compraCreditoEmpresa: compra,
    };

    const r = calcularLiquidacionMensual(input, SMLV);

    const valorDia = salario / 30; // 150.000
    expect(r.valorDia).toBe(valorDia);
    expect(r.descuentos.descuentoAusencias).toBe(300_000); // 150.000 * 2

    // Imponible disminuye por ausencias: 4.500.000 - 300.000 = 4.200.000
    expect(r.haberesImponiblesIps).toBe(4_200_000);

    // IPS 9%: 4.200.000 * 9% = 378.000
    expect(r.descuentos.aporteObreroIps).toBe(378_000);

    // Total descuentos = 378.000 (IPS) + 300.000 (Ausencias) + 300.000 (Compra) = 978.000
    expect(r.descuentos.totalDescuentos).toBe(978_000);

    // Neto = 4.500.000 - 978.000 = 3.522.000
    expect(r.netoACobrar).toBe(3_522_000);
  });

  /* -------------------------------------------------------------------
   * TEST 5: Nómina masiva y consistencia de totales acumulados.
   * ------------------------------------------------------------------- */
  it('Test 5: Cálculo de nómina masiva con consistencia de totales', () => {
    const empleados: EmpleadoNominaInput[] = [
      {
        ci: '1111111',
        nombre: 'Empleado Uno',
        cargo: 'Operario',
        tipo: 'cotizante_ips',
        salarioFijo: SMLV,
        cantidadHijos: 1,
      },
      {
        ci: '2222222',
        nombre: 'Empleado Dos',
        cargo: 'Supervisor',
        tipo: 'cotizante_ips',
        salarioFijo: 5_000_000,
        cantHoras50: 10,
      },
      {
        ci: '3333333',
        nombre: 'Prestador Tres',
        cargo: 'Asesor',
        tipo: 'factura',
        salarioFijo: 7_800_000,
      },
    ];

    const { liquidaciones, totales } = calcularNominaMasiva(empleados, SMLV);

    expect(liquidaciones).toHaveLength(3);
    expect(totales.cantidadEmpleados).toBe(3);

    // Identidad contable: Total Bruto - Total Retención IVA - Total Descuentos == Total Neto
    expect(
      totales.totalBruto - totales.totalRetencionIva - totales.totalDescuentos,
    ).toBe(totales.totalNeto);
  });

  /* -------------------------------------------------------------------
   * TEST 6: Facturador bajo una empresa NO agente retentor (DNIT).
   * Sin retención de IVA: el prestador cobra el total facturado.
   * Con el default true se recupera el comportamiento histórico.
   * ------------------------------------------------------------------- */
  it('Test 6: Facturador con empresa NO retentora no sufre retención IVA', () => {
    const input: EmpleadoNominaInput = {
      ci: '1000006',
      nombre: 'PRESTADOR SIN RETENCION',
      cargo: 'ASESOR',
      tipo: 'factura',
      salarioFijo: 7_800_000,
      compraCreditoEmpresa: 350_000,
    };
    const r = calcularLiquidacionMensual(input, SMLV, false);
    expect(r.haberes.ivaMonto).toBe(780_000);
    expect(r.retencionIva).toBe(0);
    expect(r.sueldoMenosRetencion).toBe(8_580_000);
    expect(r.descuentos.totalDescuentos).toBe(350_000);
    expect(r.netoACobrar).toBe(8_230_000);
    const r2 = calcularLiquidacionMensual(input, SMLV);
    expect(r2.retencionIva).toBe(234_000);
    const mas = calcularNominaMasiva([input], SMLV, false);
    expect(mas.totales.totalRetencionIva).toBe(0);
    expect(mas.totales.totalNeto).toBe(8_230_000);
  });
});
