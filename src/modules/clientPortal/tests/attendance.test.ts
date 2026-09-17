/**
 * PRUEBAS UNITARIAS: MÓDULO DE PRESENTISMO, BIOMETRÍA Y HORAS EXTRAS (LEY 213/93)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Empleado, ConfigBiometricoCliente, RegistroMarcacion, NovedadPresentismo } from '../types/clientPortal';
import {
  parseZkTecoLog,
  parseHikvisionJson,
  parseUniversalCsv,
  calcularJornadaDiaria,
  esFeriadoParaguay,
  esDomingoOFeriado,
  getCumpleanherosDelMes,
  saveNovedad,
  calcularResumenAsistenciaMensual,
  aplicarAsistenciaARecibosSalario,
  saveAjusteHorasExtrasEmpleado,
  getAjusteHorasExtrasEmpleado,
  obtenerHorasSugeridasBiometrico,
} from '../services/attendanceService';
import { getSafeStorage, getRecibosByCliente } from '../services/clientStorageService';

const EMPLEADOS_TEST: Empleado[] = [
  {
    id: 'emp_01',
    clienteId: 'cliente_test',
    ci: '4.567.890',
    nombres: 'Jorge David',
    apellidos: 'Ramírez',
    fechaNacimiento: '1992-08-15',
    nacionalidad: 'Paraguaya',
    estadoCivil: 'Casado/a',
    sexo: 'M',
    domicilio: 'Asunción',
    telefono: '0971123456',
    email: 'jorge@test.com',
    hijosMenores: 2,
    cargo: 'Supervisor',
    departamento: 'Operaciones',
    fechaIngreso: '2021-03-01',
    salarioBase: 4800000,
    modalidadPago: 'mensual',
    periodoPruebaDias: 30,
    vacacionesCausadasAcumuladas: 12,
    vacacionesTomadas: 0,
    createdAt: '2021-03-01T08:00:00Z',
    estado: 'activo',
  },
  {
    id: 'emp_02',
    clienteId: 'cliente_test',
    ci: '5.123.456',
    nombres: 'Claudia Elizabeth',
    apellidos: 'González',
    fechaNacimiento: '1996-08-20',
    nacionalidad: 'Paraguaya',
    estadoCivil: 'Soltero/a',
    sexo: 'F',
    domicilio: 'San Lorenzo',
    telefono: '0983123456',
    email: 'claudia@test.com',
    hijosMenores: 0,
    cargo: 'Analista',
    departamento: 'Administración',
    fechaIngreso: '2023-07-15',
    salarioBase: 3500000,
    modalidadPago: 'mensual',
    periodoPruebaDias: 30,
    vacacionesCausadasAcumuladas: 12,
    vacacionesTomadas: 0,
    createdAt: '2023-07-15T08:00:00Z',
    estado: 'activo',
  },
];

const CONFIG_TEST: ConfigBiometricoCliente = {
  clienteId: 'cliente_test',
  apiKey: 'test_key_123',
  webhookUrl: 'https://test.com/api',
  horaEntradaPredeterminada: '08:00',
  horaSalidaPredeterminada: '17:00',
  toleranciaMinutosTardia: 10,
  horaInicioNocturno: '20:00',
  horaFinNocturno: '06:00',
  descontarTardanzas: true,
};

describe('Módulo de Presentismo, Biometría y Horas Extras (LaboraPy ERP)', () => {
  beforeEach(() => {
    getSafeStorage().clear();
  });

  describe('1. Parsers de Archivos Biométricos (ZKTeco, Hikvision, CSV)', () => {
    it('parsea correctamente archivo ZKTeco attlog.dat / TSV', () => {
      const rawZK = `4567890\t2026-08-10 07:55:00\t0\t1\n4567890\t2026-08-10 18:30:00\t1\t1`;
      const marcaciones = parseZkTecoLog(rawZK, 'cliente_test', EMPLEADOS_TEST);

      expect(marcaciones.length).toBe(2);
      expect(marcaciones[0].empleadoId).toBe('emp_01');
      expect(marcaciones[0].ci).toBe('4.567.890');
      expect(marcaciones[0].tipo).toBe('entrada');
      expect(marcaciones[0].marca).toBe('zkteco');
      expect(marcaciones[1].tipo).toBe('salida');
      expect(marcaciones[1].timestamp).toContain('2026-08-10T18:30:00');
    });

    it('parsea correctamente eventos JSON de Hikvision MinMoe (ISAPI)', () => {
      const rawHik = [
        {
          employeeNoString: '5.123.456',
          time: '2026-08-11T08:05:00',
          type: 'entrada',
          minorType: 'fingerprint',
          deviceId: 'HIK_MINMOE_01',
        },
        {
          employeeNoString: '5.123.456',
          time: '2026-08-11T17:00:00',
          type: 'salida',
          deviceId: 'HIK_MINMOE_01',
        },
      ];

      const marcaciones = parseHikvisionJson(rawHik, 'cliente_test', EMPLEADOS_TEST);
      expect(marcaciones.length).toBe(2);
      expect(marcaciones[0].empleadoId).toBe('emp_02');
      expect(marcaciones[0].metodo).toBe('huella');
      expect(marcaciones[0].marca).toBe('hikvision');
    });

    it('parsea correctamente archivo CSV universal de marcaciones', () => {
      const rawCsv = `Cédula,FechaHora,Tipo,Metodo,Dispositivo\n4.567.890,2026-08-12 08:00:00,entrada,facial,RELOJ_CENTRAL\n4.567.890,2026-08-12 20:30:00,salida,facial,RELOJ_CENTRAL`;
      const marcaciones = parseUniversalCsv(rawCsv, 'cliente_test', EMPLEADOS_TEST);

      expect(marcaciones.length).toBe(2);
      expect(marcaciones[0].tipo).toBe('entrada');
      expect(marcaciones[1].tipo).toBe('salida');
      expect(marcaciones[1].timestamp).toBe('2026-08-12T20:30:00');
    });
  });

  describe('2. Motor de Cómputo de Horas Extras e Incidencias (Ley 213/93)', () => {
    it('calcula horas extras diurnas al 50% cuando la jornada ordinaria supera 8 horas', () => {
      // 08:00 a 19:00 = 11 horas de trabajo -> 8h normales + 3h extras diurnas al 50%
      const marcaciones: RegistroMarcacion[] = [
        {
          id: 'm1',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-12T08:00:00',
          tipo: 'entrada',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
        {
          id: 'm2',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-12T19:00:00',
          tipo: 'salida',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
      ];

      const res = calcularJornadaDiaria('2026-08-12', marcaciones, CONFIG_TEST);
      expect(res.minutosTardanza).toBe(0);
      expect(res.trabajoEfectivoHoras).toBe(11);
      expect(res.horas50).toBe(3); // 11 - 8 = 3 horas extras diurnas
      expect(res.horas100).toBe(0);
    });

    it('calcula horas extras nocturnas al 100% cuando el exceso supera las 20:00', () => {
      // 08:00 a 22:00 = 14 horas de trabajo -> 8h normales + 4h extras diurnas (hasta 20:00) + 2h extras nocturnas (20:00 a 22:00 al 100%)
      const marcaciones: RegistroMarcacion[] = [
        {
          id: 'm1',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-13T08:00:00',
          tipo: 'entrada',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
        {
          id: 'm2',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-13T22:00:00',
          tipo: 'salida',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
      ];

      const res = calcularJornadaDiaria('2026-08-13', marcaciones, CONFIG_TEST);
      expect(res.trabajoEfectivoHoras).toBe(14);
      expect(res.horas50).toBe(4);  // de 16:00 a 20:00
      expect(res.horas100).toBe(2); // de 20:00 a 22:00 al 100%
    });

    it('calcula 100% de recargo en todas las horas trabajadas en domingos o feriados nacionales', () => {
      // 15 de Agosto: Feriado Nacional Fundación de Asunción
      expect(esFeriadoParaguay(new Date('2026-08-15T12:00:00'))).toBe(true);
      expect(esDomingoOFeriado(new Date('2026-08-15T12:00:00'))).toBe(true);

      const marcaciones: RegistroMarcacion[] = [
        {
          id: 'm1',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-15T08:00:00',
          tipo: 'entrada',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
        {
          id: 'm2',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-15T14:00:00',
          tipo: 'salida',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
      ];

      const res = calcularJornadaDiaria('2026-08-15', marcaciones, CONFIG_TEST);
      expect(res.esFeriadoODomingo).toBe(true);
      expect(res.horas100).toBe(6); // 6 horas trabajadas al 100% de recargo
      expect(res.horas50).toBe(0);
    });

    it('detecta llegadas tardías respetando el margen de tolerancia configurable', () => {
      // Entrada a las 08:08 (tolerancia 10 min) -> 0 min tardanza
      const marcEnTolerancia: RegistroMarcacion[] = [
        {
          id: 'm1',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-17T08:08:00',
          tipo: 'entrada',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
        {
          id: 'm2',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-17T17:00:00',
          tipo: 'salida',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
      ];
      const resTolerancia = calcularJornadaDiaria('2026-08-17', marcEnTolerancia, CONFIG_TEST);
      expect(resTolerancia.minutosTardanza).toBe(0);

      // Entrada a las 08:35 (supera tolerancia de 10 min por 25 min)
      const marcTardia: RegistroMarcacion[] = [
        {
          id: 'm3',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-18T08:35:00',
          tipo: 'entrada',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
        {
          id: 'm4',
          clienteId: 'cliente_test',
          empleadoId: 'emp_01',
          ci: '4.567.890',
          timestamp: '2026-08-18T17:00:00',
          tipo: 'salida',
          metodo: 'huella',
          dispositivoId: 'ZK01',
          marca: 'zkteco',
        },
      ];
      const resTardia = calcularJornadaDiaria('2026-08-18', marcTardia, CONFIG_TEST);
      expect(resTardia.minutosTardanza).toBe(25);
    });
  });

  describe('3. Detector de Cumpleaños del Mes', () => {
    it('detecta correctamente empleados que cumplen años en el mes consultado', () => {
      // Jorge Ramírez (15 de Agosto) y Claudia González (20 de Agosto) cumplen en mes 8
      const cumpleanherosAgosto = getCumpleanherosDelMes('emp_guarani_001', 8);
      expect(cumpleanherosAgosto.length).toBeGreaterThanOrEqual(1);

      const jorge = cumpleanherosAgosto.find(c => c.empleado.ci === '4.567.890');
      if (jorge) {
        expect(jorge.dia).toBe(15);
      }
    });
  });

  describe('4. Consolidación Mensual e Integración con Liquidación de Salarios', () => {
    it('computa el resumen mensual de asistencia considerando ausencias injustificadas en la base 30', () => {
      // Registramos una ausencia injustificada de 2 días para Jorge Ramírez
      const novInjustificada: NovedadPresentismo = {
        id: 'nov_test_injust',
        clienteId: 'emp_guarani_001',
        empleadoId: 'emp_01',
        tipoNovedad: 'ausencia_injustificada',
        fechaInicio: '2026-08-26',
        fechaFin: '2026-08-27',
        dias: 2,
        remunerado: false,
        descuentaJornal: true,
        motivo: 'Ausencia sin justificación',
        estado: 'aprobado',
        createdAt: '2026-08-26T08:00:00Z',
      };
      saveNovedad(novInjustificada);

      const resumenes = calcularResumenAsistenciaMensual('emp_guarani_001', 8, 2026);
      const resJorge = resumenes.find(r => r.empleadoId === 'emp_01');

      expect(resJorge).toBeDefined();
      if (resJorge) {
        expect(resJorge.diasAusenciasInjustificadas).toBe(2);
        // Base 30 días - 2 días de ausencia injustificada = 28 días liquidados
        expect(resJorge.diasLiquidadosBase30).toBe(28);
        expect(resJorge.salarioDevengadoCalculado).toBe(Math.round((resJorge.salarioBase / 30) * 28));
      }
    });

    it('sincroniza en 1 clic los datos de asistencia con los recibos de salarios', () => {
      const sync = aplicarAsistenciaARecibosSalario('emp_guarani_001', 8, 2026);
      expect(sync.recibosActualizados).toBeGreaterThan(0);

      const recibos = getRecibosByCliente('emp_guarani_001', 8, 2026);
      expect(recibos.length).toBe(sync.recibosActualizados);
    });

    it('permite guardar ajustes manuales de horas extras (50%, 100%, 130%) y los refleja en el resumen mensual', () => {
      // Guardar ajuste manual para Jorge Ramírez en agosto 2026
      saveAjusteHorasExtrasEmpleado({
        clienteId: 'emp_guarani_001',
        empleadoId: 'emp_01',
        mes: 8,
        anho: 2026,
        horas50: 3.7,
        horas100: 5.0,
        horas130: 3.0,
        horasRecargoNocturno: 2.0,
        feriadosTrabajados: 0,
        salarioMensual: 4800000,
        montoTotal: 350000,
        fuente: 'manual',
        updatedAt: new Date().toISOString(),
      });

      const ajusteRecuperado = getAjusteHorasExtrasEmpleado('emp_guarani_001', 'emp_01', 8, 2026);
      expect(ajusteRecuperado).toBeDefined();
      expect(ajusteRecuperado?.horas50).toBe(3.7);
      expect(ajusteRecuperado?.horas100).toBe(5.0);
      expect(ajusteRecuperado?.horas130).toBe(3.0);
      expect(ajusteRecuperado?.horasRecargoNocturno).toBe(2.0);

      // Al calcular el resumen mensual, debe prevalecer el ajuste manual
      const resumenes = calcularResumenAsistenciaMensual('emp_guarani_001', 8, 2026);
      const resJorge = resumenes.find(r => r.empleadoId === 'emp_01');
      expect(resJorge).toBeDefined();
      if (resJorge) {
        expect(resJorge.horasExtras50Cant).toBe(3.7);
        expect(resJorge.horasExtras100Cant).toBe(5.0);
        expect(resJorge.recargoNocturno30Horas).toBe(2.0);
      }
    });

    it('retorna sugerencias editables desde el marcador biométrico (API / Reloj)', () => {
      const sugerencia = obtenerHorasSugeridasBiometrico('emp_guarani_001', 'emp_01', 8, 2026);
      expect(sugerencia).toBeDefined();
      expect(typeof sugerencia.horas50).toBe('number');
      expect(typeof sugerencia.horas100).toBe('number');
      expect(typeof sugerencia.horas130).toBe('number');
    });
  });
});
