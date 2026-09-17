/**
 * TESTS DE INTEGRACIÓN — Motor de Liquidación Final de Haberes
 * Versión: PY-LIQ-2026.09.01
 * Cumple con la Matriz de Casos de Prueba (Master Legal §21 y §22)
 */

import { describe, it, expect } from 'vitest';
import { calcularLiquidacion } from '../liquidacion';
import type { LiquidacionInput } from '../types';

describe('calcularLiquidacion — Matriz de Pruebas de Integración', () => {
  it('T01: Renuncia < 1 año → Sin indemnización, sin preaviso a pagar por empleador', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2024-01-01',
      fechaEgreso: '2024-06-30',
      motivo: 'renuncia',
      salarioMensual: 3_000_000,
      tieneVariables: false,
      preaviso: { obligado: 'trabajador', otorgado: true },
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'preaviso_sustitutivo')).toBeUndefined();
    expect(res.aguinaldoProporcional).toBeGreaterThan(0);
    expect(res.totalNetoEstimado).toBeGreaterThan(0);
  });

  it('T02: Renuncia 4 años sin preaviso → Descuento preaviso omitido (mitad de 45 días)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2020-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'renuncia',
      salarioMensual: 4_500_000, // jornal: 150.000
      tieneVariables: false,
      preaviso: { obligado: 'trabajador', otorgado: false },
    };

    const res = calcularLiquidacion(input);

    const descuento = res.conceptos.find(c => c.id === 'descuento_preaviso_renuncia');
    expect(descuento).toBeDefined();
    expect(descuento?.esDescuento).toBe(true);
    expect(descuento?.dias).toBe(23); // Math.ceil(45 / 2)
    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
  });

  it('T03: Despido sin causa 2 años → Indemnización (30 días) + Preaviso (45 días) + Proporcionales', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000, // jornal: 100.000
      tieneVariables: false,
      preaviso: { obligado: 'empleador', otorgado: false },
    };

    const res = calcularLiquidacion(input);

    const indemnizacion = res.conceptos.find(c => c.id === 'indemnizacion');
    const preaviso = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');

    expect(indemnizacion).toBeDefined();
    expect(indemnizacion?.dias).toBe(30); // 15 días * 2
    expect(indemnizacion?.monto).toBe(3_000_000);

    expect(preaviso).toBeDefined();
    expect(preaviso?.dias).toBe(45);
    expect(preaviso?.monto).toBe(4_500_000);
  });

  it('T04: Despido 5 años exactos → Borde de tramo (Preaviso 45 días, Vacaciones 12 días)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2019-01-01',
      fechaEgreso: '2024-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    const preaviso = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    expect(preaviso?.dias).toBe(45); // hasta 5 años inclusive = 45 días

    const vac = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    expect(vac?.dias).toBe(12); // hasta 5 años inclusive = 12 días
  });

  it('T05: Despido 5 años + 1 día → Borde superado (Preaviso 60 días, Vacaciones 18 días)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2019-01-01',
      fechaEgreso: '2024-01-02',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    const preaviso = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    expect(preaviso?.dias).toBe(60); // más de 5 años = 60 días

    const vac = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    expect(vac?.dias).toBe(18); // más de 5 años = 18 días
  });

  it('T06: Fracción indemnizatoria de 6 meses → Comparación borde', () => {
    // 5 meses 29 días: fracción no cuenta
    const resMenor = calcularLiquidacion({
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-06-29',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    });
    const indemMenor = resMenor.conceptos.find(c => c.id === 'indemnizacion');
    expect(indemMenor?.dias).toBe(30); // 2 años * 15

    // 6 meses + 1 día: cuenta como año adicional
    const resMayor = calcularLiquidacion({
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-07-02',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    });
    const indemMayor = resMayor.conceptos.find(c => c.id === 'indemnizacion');
    expect(indemMayor?.dias).toBe(45); // (2 + 1) * 15
  });

  it('T07: Despido con antigüedad ≥ 10 años → Alerta roja de estabilidad', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2014-01-01',
      fechaEgreso: '2024-06-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 4_000_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    const alertaEstabilidad = res.alertas.find(a => a.id === 'A01');
    expect(alertaEstabilidad).toBeDefined();
    expect(alertaEstabilidad?.tipo).toBe('roja');
    expect(alertaEstabilidad?.accion).toBe('derivar_profesional');
    expect(res.esProvisional).toBe(true);
  });

  it('T08: Despido con causa → Sin indemnización y con alerta jurídica A02', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2020-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'despido_con_causa',
      salarioMensual: 3_500_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'preaviso_sustitutivo')).toBeUndefined();

    const alerta = res.alertas.find(a => a.id === 'A02');
    expect(alerta).toBeDefined();
  });

  it('T09: Retiro justificado → Cálculo condicionado y alerta A03', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'retiro_justificado',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeDefined();
    const alerta = res.alertas.find(a => a.id === 'A03');
    expect(alerta).toBeDefined();
    expect(res.esProvisional).toBe(true);
  });

  it('T10: Mutuo acuerdo → No asume indemnización automáticamente (alerta A04)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2020-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'mutuo_acuerdo',
      salarioMensual: 3_000_000,
      tieneVariables: false,
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'preaviso_sustitutivo')).toBeUndefined();
    expect(res.alertas.some(a => a.id.includes('A04'))).toBe(true);
  });

  it('T11: Variables históricas → Utiliza promedio de 6 meses para base de indemnización', () => {
    const rem6m = [3_000_000, 3_200_000, 3_100_000, 3_500_000, 3_600_000, 3_400_000];
    const prom = rem6m.reduce((a, b) => a + b, 0) / 6; // 3.300.000
    const jornalProm = prom / 30; // 110.000

    const input: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-01-01', // 2 años
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: true,
      remuneracionesUltimos6Meses: rem6m,
    };

    const res = calcularLiquidacion(input);

    const indemnizacion = res.conceptos.find(c => c.id === 'indemnizacion');
    expect(indemnizacion?.monto).toBe(Math.round(jornalProm * 30));
  });

  it('T12: Vacaciones anteriores pendientes → Genera alerta A05', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2020-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
      vacacionesPeriodosAnteriores: 10,
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores')).toBeDefined();
    expect(res.alertas.find(a => a.id.startsWith('A05'))).toBeDefined();
  });

  it('T13: Validación: datos inválidos arrojan error controlado', () => {
    expect(() =>
      calcularLiquidacion({
        fechaIngreso: '2024-05-01',
        fechaEgreso: '2024-01-01', // egreso antes de ingreso
        motivo: 'renuncia',
        salarioMensual: 3_000_000,
        tieneVariables: false,
      }),
    ).toThrowError(/fechaEgreso/);

    expect(() =>
      calcularLiquidacion({
        fechaIngreso: '2024-01-01',
        fechaEgreso: '2024-05-01',
        motivo: 'renuncia',
        salarioMensual: -100, // salario negativo
        tieneVariables: false,
      }),
    ).toThrowError(/salarioMensual/);
  });

  it('T14: IPS régimen general → Aplica tabla de imponibilidad y aguinaldo está exento', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2024-01-31',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_000_000,
      tieneVariables: false,
      regimen: 'general',
    };

    const res = calcularLiquidacion(input);

    const ips = res.conceptos.find(c => c.id === 'ips_trabajador');
    expect(ips).toBeDefined();
    expect(ips?.esDescuento).toBe(true);

    const aguinaldo = res.conceptos.find(c => c.id === 'aguinaldo_proporcional');
    expect(aguinaldo?.exentoIPS).toBe(true);
  });

  it('T15: Caso Completo — 10 años 2 meses con descuentos comerciales', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2016-06-20',
      fechaEgreso: '2026-08-31',
      motivo: 'despido_sin_causa',
      salarioMensual: 4_500_000, // jornal 150.000
      tieneVariables: false,
      preaviso: { obligado: 'empleador', otorgado: false },
      vacacionesPeriodosAnteriores: 18,
      descuentosAdicionales: [
        { concepto: 'Compra mercaderías internas A', monto: 1_288_620 },
        { concepto: 'Compra mercaderías internas B', monto: 1_505_940 },
        { concepto: 'Devolución anticipo Aguinaldo Gs', monto: 2_000_000 },
      ],
    };

    const res = calcularLiquidacion(input);

    // Antigüedad > 10 años -> alerta roja
    expect(res.alertas.some(a => a.tipo === 'roja')).toBe(true);

    // Indemnización: 10 años * 15 días * 150.000 = 22.500.000
    const indem = res.conceptos.find(c => c.id === 'indemnizacion');
    expect(indem?.monto).toBe(22_500_000);

    // Preaviso: > 10 años = 90 días = 13.500.000
    const preaviso = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    expect(preaviso?.dias).toBe(90);

    // Vacaciones anteriores vencidas (>6 meses, Arts. 221 y 223 C.T. pago doble x2)
    const vacAnt = res.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores');
    expect(vacAnt?.monto).toBe(18 * 150_000 * 2);

    // Monto en letras
    expect(res.montoEnLetras).toContain('SON GUARANIES:');
  });

  it('T16: Salario Mínimo Legal General Diurno 2026 (3.044.000 Gs.)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2025-01-01',
      fechaEgreso: '2026-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      preaviso: { obligado: 'empleador', otorgado: false },
    };

    const res = calcularLiquidacion(input);
    const indem = res.conceptos.find(c => c.id === 'indemnizacion');
    expect(indem?.dias).toBe(15);
    expect(res.totalNetoEstimado).toBeGreaterThan(0);
  });

  it('T17: Sectorial — Guardia de Seguridad 12 hs (4.566.001 Gs. Res. MTESS 670/2026)', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2024-06-01',
      fechaEgreso: '2026-06-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 4_566_001,
      tieneVariables: false,
      preaviso: { obligado: 'empleador', otorgado: false },
    };

    const res = calcularLiquidacion(input);
    expect(res.antiguedad.years).toBe(2);
    // Indemnización: 2 años * 15 días * (4.566.001 / 30) = 30 días
    const indem = res.conceptos.find(c => c.id === 'indemnizacion');
    expect(indem?.dias).toBe(30);
    expect(res.totalNetoEstimado).toBeGreaterThan(0);
  });

  it('T18: Facturación Mensual — Primacía de la Realidad (Art. 19 C.T.) sin retención de IPS y cobro íntegro', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2025-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_500_000,
      tieneVariables: false,
      regimen: 'factura',
      preaviso: { obligado: 'empleador', otorgado: false },
    };

    const res = calcularLiquidacion(input);

    // No debe existir descuento de IPS del 9% porque el trabajador cobraba por factura
    const ips = res.conceptos.find(c => c.id === 'ips_trabajador');
    expect(ips).toBeUndefined();

    // Debe contener la alerta informativa sobre Primacía de la Realidad y Arts. 18/19
    const alertaFactura = res.alertas.find(a => a.id === 'A08_FACTURA');
    expect(alertaFactura).toBeDefined();
    expect(alertaFactura?.mensaje).toContain('Primacía de la Realidad');

    // No debe haber descuentos aplicados
    expect(res.totalDescuentos).toBe(0);
    expect(res.totalNetoEstimado).toBe(res.totalBruto + res.aguinaldoProporcional);
  });

  it('T19: Aguinaldo del año anterior impago (Art. 243 C.T.) se suma íntegro y exento de IPS', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2025-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      aguinaldoAnteriorPendiente: 3_044_000, // Le deben un aguinaldo completo del año pasado
      preaviso: { obligado: 'empleador', otorgado: false },
    };

    const res = calcularLiquidacion(input);

    const conceptoAguinaldoImpago = res.conceptos.find(c => c.id === 'aguinaldo_anterior_pendiente');
    expect(conceptoAguinaldoImpago).toBeDefined();
    expect(conceptoAguinaldoImpago?.monto).toBe(3_044_000);
    expect(conceptoAguinaldoImpago?.exentoIPS).toBe(true);

    // Alerta de aguinaldo pendiente generada
    const alertaAguinaldo = res.alertas.find(a => a.id === 'A09_AGUINALDO_IMPAGO');
    expect(alertaAguinaldo).toBeDefined();

    // Comprobar que suma en el neto
    expect(res.totalNetoEstimado).toBeGreaterThan(10_000_000);
  });

  it('T20: Protección Maternidad y Lactancia (Ley N.º 5508/15) genera Alerta Roja de Inamovilidad', () => {
    const inputEmbarazo: LiquidacionInput = {
      fechaIngreso: '2024-01-01',
      fechaEgreso: '2025-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      estadoMaternidadLactancia: 'embarazo',
    };

    const resEmbarazo = calcularLiquidacion(inputEmbarazo);
    const alertaRojaEmbarazo = resEmbarazo.alertas.find(a => a.id === 'A10_MATERNIDAD_LACTANCIA');
    expect(alertaRojaEmbarazo).toBeDefined();
    expect(alertaRojaEmbarazo?.tipo).toBe('roja');
    expect(alertaRojaEmbarazo?.mensaje).toContain('INAMOVILIDAD LABORAL ABSOLUTA');
    expect(alertaRojaEmbarazo?.mensaje).toContain('Embarazo');
    expect(resEmbarazo.alertas.some(a => a.tipo === 'roja')).toBe(true);

    const inputLactancia: LiquidacionInput = {
      fechaIngreso: '2023-01-01',
      fechaEgreso: '2025-01-01',
      motivo: 'despido_sin_causa',
      salarioMensual: 3_044_000,
      tieneVariables: false,
      estadoMaternidadLactancia: 'lactancia',
    };

    const resLactancia = calcularLiquidacion(inputLactancia);
    const alertaRojaLactancia = resLactancia.alertas.find(a => a.id === 'A10_MATERNIDAD_LACTANCIA');
    expect(alertaRojaLactancia).toBeDefined();
    expect(alertaRojaLactancia?.tipo).toBe('roja');
    expect(alertaRojaLactancia?.mensaje).toContain('Lactancia Materna');
  });

  it('T21: Haber Imponible Integral — Salario, comisiones, horas extras, vacaciones, indemnización y preaviso', () => {
    const inputCompleto: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2024-06-30',
      motivo: 'despido_sin_causa',
      salarioMensual: 4_500_000,
      tieneVariables: true,
      comisiones: 1_200_000,
      horasExtras: 800_000,
      preaviso: { obligado: 'empleador', otorgado: false },
      vacacionesPeriodosAnteriores: 6,
      hijosMenoresACargo: 1, // bonificación familiar exenta
      regimen: 'general',
    };

    const res = calcularLiquidacion(inputCompleto);

    // Conceptos presentes
    const salario = res.conceptos.find(c => c.id === 'salario_base' || c.id === 'salario_pendiente');
    const comisiones = res.conceptos.find(c => c.id === 'comisiones');
    const horasExtras = res.conceptos.find(c => c.id === 'horas_extras');
    const indemnizacion = res.conceptos.find(c => c.id === 'indemnizacion');
    const preaviso = res.conceptos.find(c => c.id === 'preaviso_sustitutivo');
    const vacAnteriores = res.conceptos.find(c => c.id === 'vacaciones_periodos_anteriores');
    const vacCausadas = res.conceptos.find(c => c.id === 'vacaciones_causadas');
    const vacProporcionales = res.conceptos.find(c => c.id === 'vacaciones_proporcionales');
    const ips = res.conceptos.find(c => c.id === 'ips_trabajador');

    expect(salario).toBeDefined();
    expect(comisiones?.monto).toBe(1_200_000);
    expect(horasExtras?.monto).toBe(800_000);
    expect(indemnizacion).toBeDefined();
    expect(preaviso).toBeDefined();
    expect(vacAnteriores).toBeDefined();

    // Suma esperada de conceptos imponibles
    const sumaImponibleEsperada =
      (salario?.monto || 0) +
      (comisiones?.monto || 0) +
      (horasExtras?.monto || 0) +
      (indemnizacion?.monto || 0) +
      (preaviso?.monto || 0) +
      (vacAnteriores?.monto || 0) +
      (vacCausadas?.monto || 0) +
      (vacProporcionales?.monto || 0);

    expect(res.baseImponibleIPS).toBe(sumaImponibleEsperada);
    expect(ips?.base).toBe(sumaImponibleEsperada);
    expect(ips?.monto).toBe(Math.round(sumaImponibleEsperada * 0.09));

    // Aguinaldo y Bonificación Familiar NO deben estar en base imponible
    const aguinaldo = res.conceptos.find(c => c.id === 'aguinaldo_proporcional');
    const bonificacion = res.conceptos.find(c => c.id === 'bonificacion_familiar');
    expect(aguinaldo?.exentoIPS).toBe(true);
    expect(bonificacion?.exentoIPS).toBe(true);
    expect(res.baseImponibleIPS).not.toContain(aguinaldo?.monto);
  });

  it('T22: Abandono de Trabajo con telegramas colacionados válidos → 0 indemnización, 0 preaviso, alerta A02_ABANDONO_CONFIGURADO', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2026-03-31',
      motivo: 'abandono',
      salarioMensual: 4_000_000,
      tieneVariables: false,
      validacionAbandono: {
        nroTelegramaIntimacion: 'TEL-COPACO-2026-999',
        fechaEnvioTelegrama: '2026-03-25',
        plazoHorasOtorgado: 48,
        notificadoEfectivo: true,
        reintegroCumplido: false,
      },
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'preaviso_sustitutivo')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'descuento_preaviso_renuncia')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'aguinaldo_proporcional')).toBeDefined();
    expect(res.conceptos.find(c => c.id === 'vacaciones_causadas')).toBeDefined();
    expect(res.alertas.some(a => a.id === 'A02_ABANDONO_CONFIGURADO')).toBe(true);
    expect(res.esProvisional).toBe(false);
  });

  it('T23: Abandono de Trabajo SIN telegramas o sin notificación fehaciente → Alerta roja A02_ABANDONO_RIESGO_PROCESAL y cálculo provisional', () => {
    const input: LiquidacionInput = {
      fechaIngreso: '2022-01-01',
      fechaEgreso: '2026-03-31',
      motivo: 'abandono',
      salarioMensual: 4_000_000,
      tieneVariables: false,
      // Sin validacionAbandono
    };

    const res = calcularLiquidacion(input);

    expect(res.conceptos.find(c => c.id === 'indemnizacion')).toBeUndefined();
    expect(res.conceptos.find(c => c.id === 'preaviso_sustitutivo')).toBeUndefined();
    expect(res.alertas.some(a => a.id === 'A02_ABANDONO_RIESGO_PROCESAL')).toBe(true);
    expect(res.esProvisional).toBe(true);
  });
});

