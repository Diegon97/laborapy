// @vitest-environment jsdom
/**
 * TESTS UNITARIOS - MOTOR DE CONTABILIDAD Y EXPORTACIÓN ERP (LABORAPY)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcularNominaMasiva,
  SALARIO_MINIMO_LEGAL_VIGENTE,
  formatMontoMoneda,
} from '../engine/monthlyPayrollEngine';
import type { EmpleadoNominaInput } from '../types';
import {
  generarAsientoContableNomina,
  generarAsientoContableLiquidacionFinal,
  DEFAULT_CHART_OF_ACCOUNTS,
  ENTERPRISE_CHART_OF_ACCOUNTS,
} from '../engine/payrollAccountingEngine';
import type { NovedadDescontadaFiniquito } from '../engine/payrollAccountingEngine';
import { calcularLiquidacion } from '../../payroll/liquidacion';
import type { LiquidacionInput } from '../../payroll/types';
import {
  DICCIONARIO_VARIABLES_DEFINIBLES,
  CATALOGO_CONCEPTOS_OFICIALES,
  getVariablesByLiquidacion,
  getVariablesByMoneda,
  findVariableByCodigo,
  findConceptoByNumero,
  findConceptoByVariable,
  validateCatalog,
} from '../types/payrollConceptsCatalog';
import { evaluateFormula } from '../engine/safeFormulaEvaluator';
import {
  exportarAsientoOdooCSV,
  exportarAsientoSapCSV,
  exportarAsientoUniversalCSV,
  exportarAsientoJSON,
  formatearAsientoParaClipboard,
  sanitizeCsvCell,
} from '../services/payrollAccountingExportService';
import {
  loadAccountingConfig,
  saveAccountingConfig,
  resetAccountingConfig,
} from '../services/payrollAccountingStorage';

describe('Motor Contable de Nómina - payrollAccountingEngine', () => {
  it('debe generar un asiento cuadrado (Debe === Haber, Diferencia = 0 Gs) para cotizantes puros', () => {
    const empleados: EmpleadoNominaInput[] = [
      {
        ci: '1.234.567',
        nombre: 'Juan Pérez',
        cargo: 'Desarrollador',
        tipo: 'cotizante_ips',
        salarioFijo: 5_000_000,
        cantHoras50: 10,
        cantidadHijos: 2,
        refrigerioTraslado: 300_000,
      },
      {
        ci: '2.345.678',
        nombre: 'María Gómez',
        cargo: 'Contadora',
        tipo: 'cotizante_ips',
        salarioFijo: 4_500_000,
        diasVacaciones: 6,
        adicionalCargo: 500_000,
      },
    ];

    const { liquidaciones, totales } = calcularNominaMasiva(
      empleados,
      SALARIO_MINIMO_LEGAL_VIGENTE,
      true,
    );

    const asiento = generarAsientoContableNomina(
      totales,
      liquidaciones,
      '2026-09',
      DEFAULT_CHART_OF_ACCOUNTS,
      { id: 'emp_01', nombre: 'Test S.A.', ruc: '80012345-6' },
      { incluirProvisionAguinaldo: true },
    );

    expect(asiento.estaCuadrado).toBe(true);
    expect(asiento.diferencia).toBe(0);
    expect(asiento.totalDebe).toBeGreaterThan(0);
    expect(asiento.totalDebe).toBe(asiento.totalHaber);
    expect(asiento.lineas.length).toBeGreaterThan(4);

    // Debe contener líneas clave
    const lineaSueldos = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.01.01');
    const lineaIpsPatronal = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.02.01');
    const lineaIpsPagar = asiento.lineas.find((l) => l.codigoCuenta === '2.1.2.02.01');
    const lineaNetoPagar = asiento.lineas.find((l) => l.codigoCuenta === '2.1.2.01.01');

    expect(lineaSueldos).toBeDefined();
    expect(lineaIpsPatronal).toBeDefined();
    expect(lineaIpsPagar).toBeDefined();
    expect(lineaNetoPagar).toBeDefined();

    // El IPS a pagar consolidado debe ser la suma exacta de Obrero 9% + Patronal 16.5%
    expect(lineaIpsPagar?.haber).toBe(totales.totalIpsObrero + totales.totalIpsPatronal);
  });

  it('debe cuadrar rigurosamente en nóminas mixtas (cotizantes IPS + prestadores con factura)', () => {
    const empleados: EmpleadoNominaInput[] = [
      {
        ci: '3.456.789',
        nombre: 'Carlos Dependiente',
        cargo: 'Analista',
        tipo: 'cotizante_ips',
        salarioFijo: 3_500_000,
        anticipoSalario: 500_000,
      },
      {
        ci: '4.567.890',
        nombre: 'Dra. Laura Facturadora',
        cargo: 'Asesora Legal',
        tipo: 'factura',
        salarioFijo: 6_000_000, // Factura con IVA 10% y Retención 30%
      },
    ];

    const { liquidaciones, totales } = calcularNominaMasiva(
      empleados,
      SALARIO_MINIMO_LEGAL_VIGENTE,
      true, // Agente retentor
    );

    const asiento = generarAsientoContableNomina(
      totales,
      liquidaciones,
      '2026-09',
      DEFAULT_CHART_OF_ACCOUNTS,
    );

    expect(asiento.estaCuadrado).toBe(true);
    expect(asiento.diferencia).toBe(0);
    expect(asiento.totalDebe).toBe(asiento.totalHaber);

    // Debe contener línea de Honorarios y Retención de IVA
    const lineaHonorarios = asiento.lineas.find((l) => l.codigoCuenta === '6.1.2.01.01');
    const lineaRetencionIva = asiento.lineas.find((l) => l.codigoCuenta === '2.1.3.01.01');
    const lineaHonorariosPagar = asiento.lineas.find((l) => l.codigoCuenta === '2.1.2.01.02');

    expect(lineaHonorarios).toBeDefined();
    expect(lineaRetencionIva).toBeDefined();
    expect(lineaHonorariosPagar).toBeDefined();
    expect(lineaRetencionIva?.haber).toBe(totales.totalRetencionIva);
  });

  it('debe cuadrar perfectamente con ausencias y todos los tipos de descuentos corporativos', () => {
    const empleados: EmpleadoNominaInput[] = [
      {
        ci: '5.678.901',
        nombre: 'Pedro Ramírez',
        cargo: 'Operario',
        tipo: 'cotizante_ips',
        salarioFijo: 4_000_000,
        diasAusencias: 2,
        anticipoSalario: 300_000,
        prestamosEmpresa: 200_000,
        embargosJudiciales: 250_000,
        seguroMedicoPrivado: 150_000,
        faltanteCaja: 50_000,
        telefonoNotebook: 100_000,
        compraCreditoEmpresa: 80_000,
        otrosDescuentos: 20_000,
      },
    ];

    const { liquidaciones, totales } = calcularNominaMasiva(empleados);

    const asiento = generarAsientoContableNomina(totales, liquidaciones, '2026-09');

    expect(asiento.estaCuadrado).toBe(true);
    expect(asiento.diferencia).toBe(0);
    expect(asiento.totalDebe).toBe(asiento.totalHaber);

    // Verificar presencia de líneas de deducción
    const codigosPresentes = asiento.lineas.map((l) => l.codigoCuenta);
    expect(codigosPresentes).toContain('1.1.2.03.01'); // Anticipos
    expect(codigosPresentes).toContain('1.1.2.03.02'); // Préstamos
    expect(codigosPresentes).toContain('2.1.2.03.01'); // Embargos
    expect(codigosPresentes).toContain('2.1.2.03.02'); // Seguro médico
    expect(codigosPresentes).toContain('1.1.1.01.99'); // Faltante caja
    expect(codigosPresentes).toContain('6.1.1.01.99'); // Ausencias
  });
});

describe('Servicios de Exportación ERP - payrollAccountingExportService', () => {
  const dummyAsiento = {
    id: 'ASIENTO-TEST-01',
    fechaAsiento: '2026-09-30',
    periodo: '2026-09',
    glosaGeneral: 'Asiento de prueba',
    moneda: 'PYG' as const,
    empresa: { id: 'e1', nombre: 'Tech S.A.', ruc: '80099999-9' },
    lineas: [
      {
        numeroLinea: 1,
        codigoCuenta: '6.1.1.01.01',
        nombreCuenta: 'Sueldos y Jornales',
        concepto: 'Sueldos devengados',
        debe: 5000000,
        haber: 0,
      },
      {
        numeroLinea: 2,
        codigoCuenta: '2.1.2.01.01',
        nombreCuenta: 'Sueldos a Pagar',
        concepto: 'Neto a cobrar',
        debe: 0,
        haber: 5000000,
      },
    ],
    totalDebe: 5000000,
    totalHaber: 5000000,
    diferencia: 0,
    estaCuadrado: true,
    metadata: {
      cantidadEmpleados: 1,
      totalCotizantes: 1,
      totalFacturadores: 0,
      incluyeAguinaldoProvision: true,
      generadoEn: '2026-09-11T00:00:00Z',
    },
  };

  it('debe sanitizar celdas contra CSV Injection según estándares CISO', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
    expect(sanitizeCsvCell('+cmd|/c calc')).toBe('"\'+\cmd|/c calc"');
    expect(sanitizeCsvCell('-1000')).toBe('"\'\-1000"');
    expect(sanitizeCsvCell('@import')).toBe('"\'\@import"');
    expect(sanitizeCsvCell('Normal text')).toBe('"Normal text"');
  });

  it('debe generar archivo CSV compatible con Odoo', () => {
    const csvOdoo = exportarAsientoOdooCSV(dummyAsiento);
    expect(csvOdoo).toContain('ref');
    expect(csvOdoo).toContain('line_ids/account_id/code');
    expect(csvOdoo).toContain('line_ids/debit');
    expect(csvOdoo).toContain('line_ids/credit');
    expect(csvOdoo).toContain('6.1.1.01.01');
    expect(csvOdoo).toContain('5000000');
  });

  it('debe generar archivo CSV compatible con SAP Business One DTW', () => {
    const csvSap = exportarAsientoSapCSV(dummyAsiento);
    expect(csvSap).toContain('RecordKey');
    expect(csvSap).toContain('AccountCode');
    expect(csvSap).toContain('Debit');
    expect(csvSap).toContain('Credit');
    expect(csvSap).toContain('20260930'); // Formato SAP YYYYMMDD
  });

  it('debe generar formato Universal y Clipboard TSV', () => {
    const csvUniversal = exportarAsientoUniversalCSV(dummyAsiento);
    expect(csvUniversal).toContain('SUMAS IGUALES');
    expect(csvUniversal).toContain('ASIENTO CUADRADO');

    const tsv = formatearAsientoParaClipboard(dummyAsiento);
    expect(tsv).toContain('\t');
    expect(tsv).toContain('6.1.1.01.01');

    const json = exportarAsientoJSON(dummyAsiento);
    const parsed = JSON.parse(json);
    expect(parsed.totalDebe).toBe(5000000);
  });
});

describe('Persistencia de Cuentas - payrollAccountingStorage', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('debe cargar el plan de cuentas por defecto si no hay guardado previo', () => {
    const config = loadAccountingConfig('empresa_test');
    expect(config.salario_base.codigo).toBe('6.1.1.01.01');
  });

  it('debe guardar y resetear configuración contable', () => {
    const personalizada = { ...DEFAULT_CHART_OF_ACCOUNTS };
    personalizada.salario_base = {
      ...personalizada.salario_base,
      codigo: '5.1.01.001',
    };

    saveAccountingConfig('empresa_custom', personalizada);
    const cargada = loadAccountingConfig('empresa_custom');
    expect(cargada.salario_base.codigo).toBe('5.1.01.001');

    resetAccountingConfig('empresa_custom');
    const reseteada = loadAccountingConfig('empresa_custom');
    expect(reseteada.salario_base.codigo).toBe('6.1.1.01.01');
  });
});

describe('Catálogo Oficial de Variables y Conceptos - payrollConceptsCatalog', () => {
  it('debe validar que existen más de 100 variables definibles oficiales registradas', () => {
    const stats = validateCatalog();
    expect(stats.valido).toBe(true);
    expect(stats.totalVariables).toBeGreaterThanOrEqual(100);
    expect(stats.totalConceptos).toBeGreaterThanOrEqual(40);
    expect(DICCIONARIO_VARIABLES_DEFINIBLES['SALARIO']).toBeDefined();
    expect(CATALOGO_CONCEPTOS_OFICIALES.length).toBeGreaterThan(0);
    expect(findVariableByCodigo('COMISION')?.codigo).toBe('COMISION');
  });

  it('debe filtrar variables por tipo de liquidación (MEN, COM, FIN, AGU)', () => {
    const varsMen = getVariablesByLiquidacion('MEN');
    const varsCom = getVariablesByLiquidacion('COM');
    const varsFin = getVariablesByLiquidacion('FIN');
    const varsAgu = getVariablesByLiquidacion('AGU');

    expect(varsMen.some((v) => v.codigo === 'SALARIO')).toBe(true);
    expect(varsMen.some((v) => v.codigo === 'EMB_MES')).toBe(true);
    expect(varsCom.some((v) => v.codigo === 'COMISION')).toBe(true);
    expect(varsCom.some((v) => v.codigo === 'COMDOL')).toBe(true);
    expect(varsFin.some((v) => v.codigo === 'Dias_Indem')).toBe(true);
    expect(varsFin.some((v) => v.codigo === 'IMPPREAV')).toBe(true);
    expect(varsAgu.some((v) => v.codigo === 'IMPMANAGU')).toBe(true);
  });

  it('debe filtrar variables por moneda (PYG vs USD)', () => {
    const varsUsd = getVariablesByMoneda('USD');
    const varsPyg = getVariablesByMoneda('PYG');

    expect(varsUsd.some((v) => v.codigo === 'SALDOL')).toBe(true);
    expect(varsUsd.some((v) => v.codigo === 'VARIDOL')).toBe(true);
    expect(varsUsd.some((v) => v.codigo === 'ANDOLMEN')).toBe(true);
    expect(varsPyg.some((v) => v.codigo === 'SALARIO')).toBe(true);
    expect(varsPyg.some((v) => v.codigo === 'H50')).toBe(true);
  });

  it('debe buscar conceptos por número y por variable', () => {
    const c1001 = findConceptoByNumero(1001);
    expect(c1001).toBeDefined();
    expect(c1001?.nombre).toBe('Salario base Dolares');
    expect(c1001?.cuentaHaberME).toBe('2010615'); // Nominas a Pagar ME

    const cComision = findConceptoByVariable('COMISION');
    expect(cComision).toBeDefined();
    expect(cComision?.cuentaDebeML).toBe('4010111'); // Comisiones Vtas Tiendas
  });

  it('debe resolver variables con formulaDefault en el safeFormulaEvaluator', () => {
    const row = { SALARIO: 3_000_000 };
    const resDia = evaluateFormula('[SALDIA]', row);
    expect(resDia).toBe(100_000); // 3.000.000 / 30

    const resHora = evaluateFormula('[SALHOR]', row);
    expect(resHora).toBe(12_500); // 3.000.000 / 240

    const resH130 = evaluateFormula('[H130]', row);
    expect(resH130).toBe(32_500); // 12.500 * 2.60 = 32.500
  });
});

describe('Asiento Contable Multimoneda y Cuentas Enterprise - USD y PYG', () => {
  it('debe generar un asiento cuadrado en Dólares (USD) con cuentas 2010615 y 1020317', () => {
    const empleadosUSD: EmpleadoNominaInput[] = [
      {
        ci: '4.567.890',
        nombre: 'Carlos Expat',
        cargo: 'Gerente General',
        tipo: 'cotizante_ips',
        salarioFijo: 3_500,
        anticipoSalario: 500,
      },
    ];

    const { liquidaciones, totales } = calcularNominaMasiva(
      empleadosUSD,
      SALARIO_MINIMO_LEGAL_VIGENTE,
      true,
    );

    const asientoUSD = generarAsientoContableNomina(
      totales,
      liquidaciones,
      '2026-09',
      ENTERPRISE_CHART_OF_ACCOUNTS,
      { id: 'emp_usd', nombre: 'Global Corp', ruc: '80099999-9' },
      { moneda: 'USD', incluirProvisionAguinaldo: false },
    );

    expect(asientoUSD.estaCuadrado).toBe(true);
    expect(asientoUSD.moneda).toBe('USD');
    expect(asientoUSD.diferencia).toBe(0);

    // Debe acreditar a Nominas a Pagar ME (2010615)
    const lineaSueldosME = asientoUSD.lineas.find((l) => l.codigoCuenta === '2010615');
    expect(lineaSueldosME).toBeDefined();

    // Debe acreditar anticipos a Anticipos al Pnal. U$ (1020317)
    const lineaAnticiposUSD = asientoUSD.lineas.find((l) => l.codigoCuenta === '1020317');
    expect(lineaAnticiposUSD).toBeDefined();
    expect(lineaAnticiposUSD?.haber).toBe(500);
  });

  it('debe formatear correctamente montos en USD y PYG con formatMontoMoneda', () => {
    expect(formatMontoMoneda(1500, 'USD')).toBe('$ 1,500.00');
    expect(formatMontoMoneda(-250.5, 'USD')).toBe('-$ 250.50');
    expect(formatMontoMoneda(3044000, 'PYG')).toContain('3.044.000');
  });
});

describe('Asiento Contable de Liquidación Final / Finiquito (FIN) con Saldos Vivos de Deudas', () => {
  it('debe generar asiento cuadrado exacto (Debe === Haber, Diferencia Gs. 0) al saldar embargo de 7.5M', () => {
    const inputFiniquito: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2026-09-14',
      motivo: 'despido_sin_causa',
      salarioMensual: 4_500_000,
      tieneVariables: false,
      nombreEmpleado: 'Diego Núñez',
      ciEmpleado: '4.174.819',
      cargoEmpleado: 'Líder Técnico',
      empresa: 'SWOOSH CORP S.A.',
      hijosMenoresACargo: 1,
      hijosDiscapacidad: 0,
      parejaTrabajaEnMismaEmpresa: false,
      esMadreTitular: false,
      preaviso: { obligado: 'empleador', otorgado: false },
      regimenLaboral: 'general',
    };

    const resultado = calcularLiquidacion(inputFiniquito);
    expect(resultado).toBeDefined();

    // Novedad con saldo pendiente vivo de embargo judicial (original 10.000.000, amortizado 2.500.000, saldo 7.500.000)
    const deudasDescontadas: NovedadDescontadaFiniquito[] = [
      {
        id: 'nov_emb_01',
        concepto: 'Embargo Judicial Juzgado 3ra Instancia Exp 102/24',
        monto: 7_500_000,
        codigoVariable: 'EMB_MES',
        tipoNovedad: 'embargo_judicial',
      },
    ];

    const asiento = generarAsientoContableLiquidacionFinal(
      inputFiniquito,
      resultado,
      deudasDescontadas,
      DEFAULT_CHART_OF_ACCOUNTS,
      { id: 'emp_swoosh', nombre: 'SWOOSH CORP S.A.', ruc: '80055443-2' },
    );

    // 1. Verificación matemática estricta de partida doble
    expect(asiento.estaCuadrado).toBe(true);
    expect(asiento.diferencia).toBe(0);
    expect(asiento.totalDebe).toBe(asiento.totalHaber);
    expect(asiento.totalDebe).toBeGreaterThan(10_000_000);

    // 2. Comprobación de líneas de gasto laboral en el DEBE
    const lineaIndemnizacion = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.01.08');
    const lineaPreaviso = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.01.09');
    const lineaAguinaldo = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.02.02');
    const lineaVacaciones = asiento.lineas.find((l) => l.codigoCuenta === '6.1.1.01.04');

    expect(lineaIndemnizacion).toBeDefined();
    expect(lineaIndemnizacion?.debe).toBeGreaterThan(0);
    expect(lineaPreaviso).toBeDefined();
    expect(lineaPreaviso?.debe).toBeGreaterThan(0);
    expect(lineaAguinaldo).toBeDefined();
    expect(lineaVacaciones).toBeDefined();

    // 3. Comprobación de retención de deuda y embargo judicial en el HABER
    const lineaEmbargo = asiento.lineas.find(
      (l) => l.codigoCuenta === '2.1.2.01.02' || l.concepto.includes('Embargo Judicial'),
    );
    expect(lineaEmbargo).toBeDefined();
    expect(lineaEmbargo?.haber).toBe(7_500_000);

    // 4. Comprobación de pasivo exigible neto a pagar
    const lineaNeto = asiento.lineas.find(
      (l) =>
        l.codigoCuenta === '2.1.2.01.03' ||
        l.codigoCuenta === '2.1.2.01.01' ||
        l.codigoCuenta === '2.1.1.01.01' ||
        l.concepto.toLowerCase().includes('neto a percibir'),
    );
    expect(lineaNeto).toBeDefined();
    expect(lineaNeto?.haber).toBeGreaterThan(0);
  });

  it('debe exportar correctamente el asiento de finiquito a formatos Odoo y SAP CSV', () => {
    const inputFiniquito: LiquidacionInput = {
      fechaIngreso: '2024-01-01',
      fechaEgreso: '2026-09-14',
      motivo: 'renuncia',
      salarioMensual: 3_500_000,
      tieneVariables: false,
      nombreEmpleado: 'María González',
      ciEmpleado: '3.987.654',
      cargoEmpleado: 'Asistente Contable',
      empresa: 'SWOOSH CORP S.A.',
      hijosMenoresACargo: 0,
      hijosDiscapacidad: 0,
      parejaTrabajaEnMismaEmpresa: false,
      esMadreTitular: false,
      preaviso: { obligado: 'trabajador', otorgado: true },
      regimenLaboral: 'general',
    };

    const resultado = calcularLiquidacion(inputFiniquito);
    const asiento = generarAsientoContableLiquidacionFinal(
      inputFiniquito,
      resultado,
      [],
      DEFAULT_CHART_OF_ACCOUNTS,
      { id: 'emp_01', nombre: 'Test S.A.', ruc: '80000000-1' },
    );

    // Exportación a Odoo CSV
    const csvOdoo = exportarAsientoOdooCSV(asiento);
    expect(csvOdoo).toContain('ref');
    expect(csvOdoo).toContain('line_ids/account_id/code');
    expect(csvOdoo).toContain('line_ids/debit');
    expect(csvOdoo).toContain('line_ids/credit');
    expect(csvOdoo).toContain('3987654');

    // Exportación a SAP Business One CSV
    const csvSap = exportarAsientoSapCSV(asiento);
    expect(csvSap).toContain('RecordKey');
    expect(csvSap).toContain('AccountCode');
    expect(csvSap).toContain('Debit');
    expect(csvSap).toContain('Credit');
    expect(csvSap).toContain('María González');
    expect(csvSap).toContain('20260914');

    // Exportación a Clipboard TSV para Excel
    const tsv = formatearAsientoParaClipboard(asiento);
    expect(tsv).toContain('Código Cuenta');
    expect(tsv).toContain('SUMAS IGUALES');
  });
});

