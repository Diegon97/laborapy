// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { EmpleadoNominaInput } from '../types';
import type { NovedadPersonal, DesgloseNovedadAplicada } from '../types/noveltyTypes';
import type { AsientoContableGeneral } from '../types/accountingTypes';
import {
  formatPeriodoFormal,
  parsePeriodoId,
  aplicarNovedadesAEmpleado,
  procesarAmortizacionCierrePeriodo,
} from '../engine/payrollNoveltiesEngine';
import {
  loadPeriodosEmpresa,
  crearPeriodo,
  saveNovedadesEmpresa,
  loadNovedadesEmpresa,
  cerrarPeriodoContable,
  reabrirPeriodoContable,
  replicarPeriodo,
  getMesAnterior,
  sonMismoConcepto,
  upsertNovedadConPisado,
} from '../services/payrollNoveltiesStorage';
import { filtrarOpciones } from '../components/SearchableSelect';
import { saveNominaPeriodo, loadNominaPeriodo } from '../services/monthlyPayrollStorage';

describe('Motor de Períodos y Novedades Salariales (LaboraPy)', () => {
  const mockEmpleado: EmpleadoNominaInput = {
    ci: '1234567',
    nombre: 'Juan Pérez',
    cargo: 'Desarrollador Senior',
    tipo: 'cotizante_ips',
    salarioFijo: 10_000_000,
    diasTrabajados: 30,
  };

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  // 1. Nomenclatura e Historial de Períodos
  it('1. formatPeriodoFormal debe formatear correctamente YYYY-MM a "MEN MM (Mes YYYY)"', () => {
    expect(formatPeriodoFormal('2026-08')).toBe('MEN 08 (Agosto 2026)');
    expect(formatPeriodoFormal('2026-07')).toBe('MEN 07 (Julio 2026)');
    expect(formatPeriodoFormal('2025-12')).toBe('MEN 12 (Diciembre 2025)');
    expect(formatPeriodoFormal('2024-01')).toBe('MEN 01 (Enero 2024)');
  });

  it('1b. parsePeriodoId debe extraer año y mes numéricos', () => {
    const res = parsePeriodoId('2026-08');
    expect(res.anio).toBe(2026);
    expect(res.mes).toBe(8);
  });

  // 2. Embargo judicial único con saldo: respeta tope 25% legal
  it('2. Embargo judicial único con saldo: respeta el tope legal estricto del 25% de haberes imponibles', () => {
    // Haberes imponibles = 10.000.000 Gs. Tope 25% = 2.500.000 Gs.
    const embargo: NovedadPersonal = {
      id: 'emb-001',
      ci: '1234567',
      tipo: 'embargo_judicial',
      descripcion: 'Embargo Banco Familiar',
      montoOriginal: 10_000_000,
      saldoPendiente: 10_000_000,
      porcentajeTope: 0.25,
      activo: true,
      prioridad: 1,
      fechaCreacion: '2026-08-01T10:00:00Z',
    };

    const resultado = aplicarNovedadesAEmpleado(mockEmpleado, [embargo], 10_000_000);

    // Debe descontar exactamente el 25% (2.500.000 Gs)
    expect(resultado.totalEmbargosAplicados).toBe(2_500_000);
    expect(resultado.empleado.embargosJudiciales).toBe(2_500_000);
    expect(resultado.desgloses).toHaveLength(1);
    expect(resultado.desgloses[0].montoDescontado).toBe(2_500_000);
    expect(resultado.desgloses[0].saldoNuevo).toBe(7_500_000);
    expect(resultado.desgloses[0].saldadoTotalmente).toBe(false);
  });

  // 3. Saldo menor al tope 25%: descuenta únicamente el saldo restante y marca saldado
  it('3. Saldo menor al tope 25%: descuenta únicamente el saldo restante y marca saldadoTotalmente', () => {
    const embargo: NovedadPersonal = {
      id: 'emb-002',
      ci: '1234567',
      tipo: 'embargo_judicial',
      descripcion: 'Última cuota embargo',
      montoOriginal: 5_000_000,
      saldoPendiente: 600_000, // Menor al tope de 2.500.000
      porcentajeTope: 0.25,
      activo: true,
      prioridad: 1,
      fechaCreacion: '2026-08-01T10:00:00Z',
    };

    const resultado = aplicarNovedadesAEmpleado(mockEmpleado, [embargo], 10_000_000);

    // Debe descontar solo 600.000 Gs
    expect(resultado.totalEmbargosAplicados).toBe(600_000);
    expect(resultado.desgloses[0].montoDescontado).toBe(600_000);
    expect(resultado.desgloses[0].saldoNuevo).toBe(0);
    expect(resultado.desgloses[0].saldadoTotalmente).toBe(true);
  });

  // 4. Cola de embargos múltiples para el mismo empleado: FIFO y tope 25% acumulado estricto
  it('4. Cola de embargos múltiples: respeta orden FIFO/prioridad y nunca excede el 25% legal acumulado', () => {
    // Base 10.000.000 -> Cupo total del mes: 2.500.000 Gs
    const embargos: NovedadPersonal[] = [
      {
        id: 'emb-pri-1',
        ci: '1234567',
        tipo: 'embargo_judicial',
        descripcion: 'Primer embargo (Saldo 1.500.000)',
        montoOriginal: 3_000_000,
        saldoPendiente: 1_500_000,
        porcentajeTope: 0.25,
        activo: true,
        prioridad: 1,
        fechaCreacion: '2026-01-01T10:00:00Z',
      },
      {
        id: 'emb-pri-2',
        ci: '1234567',
        tipo: 'embargo_judicial',
        descripcion: 'Segundo embargo (Saldo 4.000.000)',
        montoOriginal: 4_000_000,
        saldoPendiente: 4_000_000,
        porcentajeTope: 0.25,
        activo: true,
        prioridad: 2,
        fechaCreacion: '2026-02-01T10:00:00Z',
      },
    ];

    const resultado = aplicarNovedadesAEmpleado(mockEmpleado, embargos, 10_000_000);

    // Embargo 1 toma 1.500.000 Gs (se salda)
    // Embargo 2 solo puede tomar 1.000.000 Gs (agota el cupo restante de 2.500.000)
    expect(resultado.totalEmbargosAplicados).toBe(2_500_000);
    expect(resultado.desgloses).toHaveLength(2);

    const desglose1 = resultado.desgloses.find((d) => d.novedadId === 'emb-pri-1');
    const desglose2 = resultado.desgloses.find((d) => d.novedadId === 'emb-pri-2');

    expect(desglose1?.montoDescontado).toBe(1_500_000);
    expect(desglose1?.saldoNuevo).toBe(0);
    expect(desglose1?.saldadoTotalmente).toBe(true);

    expect(desglose2?.montoDescontado).toBe(1_000_000);
    expect(desglose2?.saldoNuevo).toBe(3_000_000);
    expect(desglose2?.saldadoTotalmente).toBe(false);
  });

  // 5. Anticipos recurrentes: se arrastran automáticamente
  it('5. Anticipos recurrentes: se imputan a anticipoSalario y persisten mes a mes', () => {
    const anticipo: NovedadPersonal = {
      id: 'ant-001',
      ci: '1234567',
      tipo: 'anticipo_recurrente',
      descripcion: 'Adelanto Quincenal Fijo',
      cuotaMensual: 1_500_000,
      activo: true,
      fechaCreacion: '2026-01-01T10:00:00Z',
    };

    const resultado = aplicarNovedadesAEmpleado(mockEmpleado, [anticipo], 10_000_000);

    expect(resultado.totalAnticiposAplicados).toBe(1_500_000);
    expect(resultado.empleado.anticipoSalario).toBe(1_500_000);
    expect(resultado.desgloses[0].saldadoTotalmente).toBe(false); // Recurrente indefinido
  });

  // 6. Préstamos con saldo: cuota fija y saldo decreciente
  it('6. Préstamos de empresa: descuenta la cuota fija mensual hasta agotar el saldo', () => {
    const prestamo: NovedadPersonal = {
      id: 'prest-001',
      ci: '1234567',
      tipo: 'prestamo_empresa',
      descripcion: 'Préstamo Equipamiento',
      montoOriginal: 2_000_000,
      saldoPendiente: 400_000, // Saldo menor a la cuota
      cuotaMensual: 500_000,
      activo: true,
      fechaCreacion: '2026-01-01T10:00:00Z',
    };

    const resultado = aplicarNovedadesAEmpleado(mockEmpleado, [prestamo], 10_000_000);

    // Debe descontar solo el saldo de 400.000 Gs
    expect(resultado.totalPrestamosAplicados).toBe(400_000);
    expect(resultado.empleado.prestamosEmpresa).toBe(400_000);
    expect(resultado.desgloses[0].saldoNuevo).toBe(0);
    expect(resultado.desgloses[0].saldadoTotalmente).toBe(true);
  });

  // 7. procesarAmortizacionCierrePeriodo: actualiza saldos y desactiva deudas saldadas
  it('7. procesarAmortizacionCierrePeriodo: amortiza saldos y desactiva novedades saldadas', () => {
    const novedades: NovedadPersonal[] = [
      {
        id: 'emb-amort-1',
        ci: '1234567',
        tipo: 'embargo_judicial',
        descripcion: 'Embargo a Salir',
        montoOriginal: 2_000_000,
        saldoPendiente: 500_000,
        activo: true,
        fechaCreacion: '2026-01-01T10:00:00Z',
      },
      {
        id: 'ant-recur',
        ci: '1234567',
        tipo: 'anticipo_recurrente',
        descripcion: 'Anticipo mensual continuo',
        cuotaMensual: 800_000,
        activo: true,
        fechaCreacion: '2026-01-01T10:00:00Z',
      },
    ];

    const desgloses: DesgloseNovedadAplicada[] = [
      {
        novedadId: 'emb-amort-1',
        tipo: 'embargo_judicial',
        montoDescontado: 500_000,
        saldoAnterior: 500_000,
        saldoNuevo: 0,
        saldadoTotalmente: true,
      },
      {
        novedadId: 'ant-recur',
        tipo: 'anticipo_recurrente',
        montoDescontado: 800_000,
        saldoAnterior: 800_000,
        saldoNuevo: 800_000,
        saldadoTotalmente: false,
      },
    ];

    const amortizadas = procesarAmortizacionCierrePeriodo(novedades, desgloses);

    const embFinal = amortizadas.find((n) => n.id === 'emb-amort-1');
    const antFinal = amortizadas.find((n) => n.id === 'ant-recur');

    expect(embFinal?.saldoPendiente).toBe(0);
    expect(embFinal?.activo).toBe(false);
    expect(embFinal?.fechaFinalizacion).toBeDefined();

    // El anticipo sigue activo para los próximos períodos
    expect(antFinal?.activo).toBe(true);
  });

  // 8. Replicación de período y Cierre Contable
  it('8. replicarPeriodo: clona nómina de origen aplicando novedades recurrentes en destino', () => {
    const empresaId = 'test-corp';
    const periodoOrigen = '2026-07';
    const periodoDestino = '2026-08';

    // 1. Guardar nómina origen
    saveNominaPeriodo(empresaId, periodoOrigen, [mockEmpleado]);

    // 2. Guardar novedad recurrente para el empleado
    const novedad: NovedadPersonal = {
      id: 'ant-test',
      ci: '1234567',
      tipo: 'anticipo_recurrente',
      descripcion: 'Anticipo 1.000.000',
      cuotaMensual: 1_000_000,
      activo: true,
      fechaCreacion: '2026-07-01T10:00:00Z',
    };
    saveNovedadesEmpresa(empresaId, [novedad]);

    // 3. Replicar
    const resultado = replicarPeriodo(empresaId, periodoOrigen, periodoDestino);
    expect(resultado.exito).toBe(true);
    expect(resultado.empleadosReplicados).toBe(1);

    // 4. Verificar que destino tiene al empleado con su anticipoSalario cargado
    const destinoGuardado = loadNominaPeriodo(empresaId, periodoDestino);
    expect(destinoGuardado).not.toBeNull();
    expect(destinoGuardado?.empleados).toHaveLength(1);
    expect(destinoGuardado?.empleados[0].anticipoSalario).toBe(1_000_000);
  });

  it('9. Cierre y reapertura de período contable', () => {
    const empresaId = 'test-corp';
    const p = crearPeriodo(empresaId, 2026, 8);
    expect(p.estado).toBe('abierto');

    // Cierre contable
    const totales = {
      cantidadEmpleados: 1,
      totalBruto: 10_000_000,
      totalHaberesImponibles: 10_000_000,
      totalIpsObrero: 900_000,
      totalIpsPatronal: 1_650_000,
      totalIva: 0,
      totalRetencionIva: 0,
      totalDescuentos: 900_000,
      totalNeto: 9_100_000,
    };

    const mockAsiento: AsientoContableGeneral = {
      id: 'asiento-01',
      periodo: '2026-08',
      fechaAsiento: '2026-08-31',
      glosaGeneral: 'Asiento Nómina Agosto 2026',
      moneda: 'PYG',
      empresa: { id: 'test-corp', nombre: 'Test S.A.', ruc: '80000000-1' },
      lineas: [],
      totalDebe: 11_650_000,
      totalHaber: 11_650_000,
      diferencia: 0,
      estaCuadrado: true,
      metadata: {
        cantidadEmpleados: 1,
        totalCotizantes: 1,
        totalFacturadores: 0,
        incluyeAguinaldoProvision: false,
        generadoEn: '2026-08-31T20:00:00Z',
      },
    };

    const resCierre = cerrarPeriodoContable(
      empresaId,
      '2026-08',
      totales,
      mockAsiento,
      'Auditor Interno',
      [],
    );
    expect(resCierre.exito).toBe(true);

    const periodosCerrados = loadPeriodosEmpresa(empresaId);
    const pCerrado = periodosCerrados.find((x) => x.id === '2026-08');
    expect(pCerrado?.estado).toBe('cerrado');
    expect(pCerrado?.snapshotTotales).toBeDefined();

    // Intentar cerrar nuevamente debe fallar
    const resSegundoCierre = cerrarPeriodoContable(
      empresaId,
      '2026-08',
      totales,
      mockAsiento,
      'Auditor Interno',
      [],
    );
    expect(resSegundoCierre.exito).toBe(false);

    // Reabrir período
    const resReapertura = reabrirPeriodoContable(empresaId, '2026-08');
    expect(resReapertura.exito).toBe(true);

    const periodosReabiertos = loadPeriodosEmpresa(empresaId);
    const pReabierto = periodosReabiertos.find((x) => x.id === '2026-08');
    expect(pReabierto?.estado).toBe('abierto');
  });

  // 11. Caso Usuario: Embargo de 10.000.000 Gs al 25% variable de todos los ingresos hasta agotar saldo
  it('11. Embargo con saldo 10.000.000 Gs, variable 25%, vigencia hasta saldo cero e impacto en MEN', () => {
    const embargoVariable: NovedadPersonal = {
      id: 'emb-var-001',
      ci: '1234567',
      tipo: 'embargo_judicial',
      subtipo: 'embargo_judicial',
      descripcion: 'Embargo Judicial 25% Variable hasta saldo 0',
      montoOriginal: 10_000_000,
      saldoPendiente: 10_000_000,
      modalidadCalculo: 'porcentaje_variable',
      porcentajeVariable: 25,
      tipoVigencia: 'hasta_saldo_cero',
      liquidacionesImpactadas: ['MEN', 'COM', 'HRE'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    // Primera liquidación mensual con base 10.000.000 Gs
    const res1 = aplicarNovedadesAEmpleado(mockEmpleado, [embargoVariable], 10_000_000, '2026-09', 'MEN');
    expect(res1.totalEmbargosAplicados).toBe(2_500_000);
    expect(res1.desgloses[0].saldoNuevo).toBe(7_500_000);
    expect(res1.desgloses[0].saldadoTotalmente).toBe(false);

    // Amortizamos y simulamos siguiente mes con saldo 7.500.000
    const embargoMes2: NovedadPersonal = {
      ...embargoVariable,
      saldoPendiente: 7_500_000,
    };
    const res2 = aplicarNovedadesAEmpleado(mockEmpleado, [embargoMes2], 10_000_000, '2026-10', 'MEN');
    expect(res2.totalEmbargosAplicados).toBe(2_500_000);
    expect(res2.desgloses[0].saldoNuevo).toBe(5_000_000);

    // En liquidación final cuando el saldo es solo 1.000.000 Gs
    const embargoMesFinal: NovedadPersonal = {
      ...embargoVariable,
      saldoPendiente: 1_000_000,
    };
    const resFinal = aplicarNovedadesAEmpleado(mockEmpleado, [embargoMesFinal], 10_000_000, '2026-12', 'MEN');
    expect(resFinal.totalEmbargosAplicados).toBe(1_000_000);
    expect(resFinal.desgloses[0].saldoNuevo).toBe(0);
    expect(resFinal.desgloses[0].saldadoTotalmente).toBe(true);
  });

  // 12. Filtrado por liquidacionesImpactadas (MEN vs COM vs HRE)
  it('12. Novedad que impacta solo COM no se aplica en liquidación MEN', () => {
    const novedadComisiones: NovedadPersonal = {
      id: 'nov-com-01',
      ci: '1234567',
      tipo: 'otro_descuento_fijo',
      subtipo: 'descuento_manual',
      descripcion: 'Descuento especial solo en comisiones',
      cuotaMensual: 500_000,
      liquidacionesImpactadas: ['COM'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    // Aplicando a liquidación MEN -> No debe aplicar
    const resMen = aplicarNovedadesAEmpleado(mockEmpleado, [novedadComisiones], 10_000_000, '2026-09', 'MEN');
    expect(resMen.totalOtrosDescuentosAplicados).toBe(0);

    // Aplicando a liquidación COM -> Sí debe aplicar
    const resCom = aplicarNovedadesAEmpleado(mockEmpleado, [novedadComisiones], 10_000_000, '2026-09', 'COM');
    expect(resCom.totalOtrosDescuentosAplicados).toBe(500_000);
  });

  // 13. Vigencia mes único (mes_unico)
  it('13. Novedad de mes_unico solo impacta en el período especificado', () => {
    const bonificacionUnica: NovedadPersonal = {
      id: 'bono-sep',
      ci: '1234567',
      tipo: 'bono_fijo',
      subtipo: 'bonificacion_extraordinaria',
      tipoConcepto: 'haber',
      descripcion: 'Bono especial aniversario',
      cuotaMensual: 1_000_000,
      tipoVigencia: 'mes_unico',
      mesUnico: '2026-09',
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    // En 2026-09 sí aplica
    const resSep = aplicarNovedadesAEmpleado(mockEmpleado, [bonificacionUnica], 10_000_000, '2026-09', 'MEN');
    expect(resSep.totalHaberesAdicionalesAplicados).toBe(1_000_000);
    expect(resSep.empleado.bonificaciones).toBe(1_000_000);

    // En 2026-10 no aplica
    const resOct = aplicarNovedadesAEmpleado(mockEmpleado, [bonificacionUnica], 10_000_000, '2026-10', 'MEN');
    expect(resOct.totalHaberesAdicionalesAplicados).toBe(0);
  });

  // 14. Cálculo exacto de mes anterior
  it('14. getMesAnterior calcula correctamente el mes previo calendario', () => {
    expect(getMesAnterior('2026-10')).toBe('2026-09');
    expect(getMesAnterior('2026-01')).toBe('2025-12');
    expect(getMesAnterior('2026-08')).toBe('2026-07');
    expect(getMesAnterior('invalido')).toBe('invalido');
  });

  // 15. Detección de mismo concepto funcional
  it('15. sonMismoConcepto identifica si dos novedades colisionan para el mismo empleado', () => {
    const nov1: NovedadPersonal = {
      id: 'nov-1',
      ci: '4174819',
      tipo: 'adicional_cargo',
      subtipo: 'adicional_cargo',
      tipoConcepto: 'haber',
      descripcion: 'Plus Adicional por Cargo',
      cuotaMensual: 550_000,
      activo: true,
      fechaCreacion: '2026-09-01T00:00:00Z',
    };

    const nov2: NovedadPersonal = {
      id: 'nov-2',
      ci: '4174819',
      tipo: 'adicional_cargo',
      subtipo: 'adicional_cargo',
      tipoConcepto: 'haber',
      descripcion: 'Plus Adicional por Cargo Actualizado',
      cuotaMensual: 1_100_000,
      activo: true,
      fechaCreacion: '2026-10-01T00:00:00Z',
    };

    expect(sonMismoConcepto(nov1, nov2)).toBe(true);

    // Diferente CI
    expect(sonMismoConcepto(nov1, { ...nov2, ci: '9999999' })).toBe(false);

    // Misma CI pero diferente naturaleza/tipo
    expect(sonMismoConcepto(nov1, { ...nov2, tipoConcepto: 'descuento', subtipo: 'embargo_judicial' })).toBe(false);
  });

  // 16. Regla de "Pisado" automático con trazabilidad (Caso Diego Núñez CI 4174819)
  it('16. upsertNovedadConPisado: nueva novedad permanente en 2026-10 le pisa a la de 550.000 acortándola a 2026-09 con auditoría', () => {
    const empresaId = 'emp_test_pisado';

    // 1. Cargar novedad inicial de septiembre a octubre (550.000 Gs.)
    const novSeptiembre: NovedadPersonal = {
      id: 'nov-diego-550k',
      ci: '4174819',
      tipo: 'adicional_cargo',
      subtipo: 'adicional_cargo',
      tipoConcepto: 'haber',
      descripcion: 'Plus Adicional por Cargo',
      cuotaMensual: 550_000,
      modalidadCalculo: 'monto_fijo',
      tipoVigencia: 'rango_meses',
      periodoDesde: '2026-09',
      periodoHasta: '2026-10',
      liquidacionesImpactadas: ['MEN'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    const res1 = upsertNovedadConPisado(empresaId, novSeptiembre, 'Diego Núñez (RRHH)');
    expect(res1.exito).toBe(true);

    // 2. En octubre se le carga 1.100.000 de forma permanente
    const novOctubre: NovedadPersonal = {
      id: 'nov-diego-1100k',
      ci: '4174819',
      tipo: 'adicional_cargo',
      subtipo: 'adicional_cargo',
      tipoConcepto: 'haber',
      descripcion: 'Plus Adicional por Cargo Aumento',
      cuotaMensual: 1_100_000,
      modalidadCalculo: 'monto_fijo',
      tipoVigencia: 'permanente',
      periodoDesde: '2026-10',
      liquidacionesImpactadas: ['MEN'],
      activo: true,
      fechaCreacion: '2026-10-01T10:00:00Z',
    };

    const res2 = upsertNovedadConPisado(empresaId, novOctubre, 'Auditor RRHH');
    expect(res2.exito).toBe(true);
    expect(res2.novedadPisadaId).toBe('nov-diego-550k');

    // 3. Verificar estado en almacenamiento
    const lista = loadNovedadesEmpresa(empresaId);
    expect(lista).toHaveLength(2);

    const nov1EnStorage = lista.find((n) => n.id === 'nov-diego-550k')!;
    const nov2EnStorage = lista.find((n) => n.id === 'nov-diego-1100k')!;

    // La anterior fue acortada a 2026-09
    expect(nov1EnStorage.periodoHasta).toBe('2026-09');
    expect(nov1EnStorage.pisadaPorId).toBe('nov-diego-1100k');
    expect(nov1EnStorage.historialAuditoria).toBeDefined();
    expect(nov1EnStorage.historialAuditoria!.some((h) => h.accion === 'pisado')).toBe(true);

    // La nueva rige desde 2026-10 y referencia a la anterior
    expect(nov2EnStorage.periodoDesde).toBe('2026-10');
    expect(nov2EnStorage.cuotaMensual).toBe(1_100_000);
    expect(nov2EnStorage.reemplazaNovedadId).toBe('nov-diego-550k');
    expect(nov2EnStorage.historialAuditoria).toBeDefined();

    // 4. Verificar aplicación en nómina:
    // Para septiembre (2026-09): debe aplicar 550.000
    const empDiego: EmpleadoNominaInput = {
      ci: '4174819',
      nombre: 'Diego Núñez',
      cargo: 'Jefe de Sistemas',
      tipo: 'cotizante_ips',
      salarioFijo: 8_000_000,
      diasTrabajados: 30,
    };

    const resSep = aplicarNovedadesAEmpleado(empDiego, lista, 8_000_000, '2026-09', 'MEN');
    expect(resSep.totalHaberesAdicionalesAplicados).toBe(550_000);
    expect(resSep.empleado.adicionalCargo).toBe(550_000);

    // Para octubre (2026-10): debe aplicar 1.100.000 (el nuevo pisó al anterior para octubre)
    const resOct = aplicarNovedadesAEmpleado(empDiego, lista, 8_000_000, '2026-10', 'MEN');
    expect(resOct.totalHaberesAdicionalesAplicados).toBe(1_100_000);
    expect(resOct.empleado.adicionalCargo).toBe(1_100_000);
  });

  // 17. Filtrado multi-query de opciones en SearchableSelect
  it('17. filtrarOpciones filtra con múltiples términos separados por espacios e insensible a acentos', () => {
    const opciones = [
      { value: '1', label: 'Diego Nuñez', sublabel: 'CI: 4174819 — Jefe', keywords: '4174819 diego nunez jefe' },
      { value: '2', label: 'Jorge David Ramírez', sublabel: 'CI: 4567890 — Analista', keywords: '4567890 jorge ramirez' },
      { value: '3', label: 'Ana María Gómez', sublabel: 'CI: 3333333 — Abogada', keywords: '3333333 ana gomez' },
    ];

    // Multi-query término nombre + CI
    const res1 = filtrarOpciones(opciones, 'diego 4174819');
    expect(res1).toHaveLength(1);
    expect(res1[0].value).toBe('1');

    // Insensible a acentos: 'ramirez' encuentra 'Ramírez'
    const res2 = filtrarOpciones(opciones, 'ramirez');
    expect(res2).toHaveLength(1);
    expect(res2[0].value).toBe('2');

    // Término que no existe
    const res3 = filtrarOpciones(opciones, 'carlos 999');
    expect(res3).toHaveLength(0);
  });

  // 18. Imputación de variables oficiales de haberes: COMISION se asigna a customFields.comision
  it('18. Novedad con variable oficial COMISION imputa correctamente en customFields.comision', () => {
    const novComision: NovedadPersonal = {
      id: 'nov-comision-01',
      ci: '1234567',
      tipo: 'otro_haber',
      subtipo: 'haber_manual',
      tipoConcepto: 'haber',
      codigoVariable: 'COMISION',
      numeroConcepto: 2500,
      nombreConcepto: 'Comision en guaranies',
      descripcion: 'Comisiones de ventas del mes',
      cuotaMensual: 1_250_000,
      modalidadCalculo: 'monto_fijo',
      tipoVigencia: 'permanente',
      liquidacionesImpactadas: ['COM', 'MEN'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    const res = aplicarNovedadesAEmpleado(mockEmpleado, [novComision], 10_000_000, '2026-09', 'MEN');
    expect(res.totalHaberesAdicionalesAplicados).toBe(1_250_000);
    expect(res.empleado.customFields?.comision).toBe(1_250_000);
  });

  // 19. Imputación de deducciones por variable oficial: FALCAJ y DESC_CEL
  it('19. Novedades con FALCAJ y DESC_CEL imputan a faltanteCaja y telefonoNotebook con trazabilidad de conceptos', () => {
    const novFaltante: NovedadPersonal = {
      id: 'nov-falcaj-01',
      ci: '1234567',
      tipo: 'otro_descuento_fijo',
      subtipo: 'descuento_manual',
      tipoConcepto: 'descuento',
      codigoVariable: 'FALCAJ',
      numeroConcepto: 4050,
      nombreConcepto: 'Faltante de caja',
      descripcion: 'Diferencia arqueo de caja central',
      cuotaMensual: 180_000,
      modalidadCalculo: 'monto_fijo',
      tipoVigencia: 'mes_unico',
      mesUnico: '2026-09',
      liquidacionesImpactadas: ['MEN'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    const novCelular: NovedadPersonal = {
      id: 'nov-cel-01',
      ci: '1234567',
      tipo: 'cuota_equipo',
      subtipo: 'descuento_manual',
      tipoConcepto: 'descuento',
      codigoVariable: 'DESC_CEL',
      numeroConcepto: 199,
      nombreConcepto: 'Descuento por celulares',
      descripcion: 'Exceso consumo plan corporativo',
      cuotaMensual: 75_000,
      modalidadCalculo: 'monto_fijo',
      tipoVigencia: 'mes_unico',
      mesUnico: '2026-09',
      liquidacionesImpactadas: ['MEN'],
      activo: true,
      fechaCreacion: '2026-09-01T10:00:00Z',
    };

    const res = aplicarNovedadesAEmpleado(mockEmpleado, [novFaltante, novCelular], 10_000_000, '2026-09', 'MEN');
    expect(res.totalOtrosDescuentosAplicados).toBe(255_000);
    expect(res.empleado.faltanteCaja).toBe(180_000);
    expect(res.empleado.telefonoNotebook).toBe(75_000);
    expect(res.desgloses).toHaveLength(2);
  });
});

