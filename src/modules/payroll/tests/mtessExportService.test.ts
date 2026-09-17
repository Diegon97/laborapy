import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  generateMtessMonthlyWorkbooks,
  generateMtessSettlementWorkbooks,
  MTESS_MONTHLY_COLUMNS,
  MTESS_SETTLEMENT_COLUMNS,
  formatDateYMD,
  __test__,
} from '../generators/mtessExportService';
import type {
  MtessMonthlyEmployeeRecord,
  MtessSettlementEmployeeRecord,
} from '../generators/mtessExportService';

describe('MTESS Export Service — Pruebas de Cumplimiento Normativo MTESS Paraguay', () => {
  describe('Planilla Mensual de Salarios (32 Columnas)', () => {
    it('debe contener exactamente las 32 columnas oficiales exigidas por MTESS', () => {
      expect(MTESS_MONTHLY_COLUMNS).toHaveLength(32);
      expect(MTESS_MONTHLY_COLUMNS[0]).toBe('numero_patronal');
      expect(MTESS_MONTHLY_COLUMNS[1]).toBe('nro_ci');
      expect(MTESS_MONTHLY_COLUMNS[7]).toBe(' horas_ordinarias '); // espacios oficiales
      expect(MTESS_MONTHLY_COLUMNS[25]).toBe('Aporte Seg. Social');
      expect(MTESS_MONTHLY_COLUMNS[31]).toBe('Concepto descuentos 3');
    });

    it('debe rellenar con 0 los conceptos no percibidos (Regla de Cero Obligatorio)', () => {
      const records: MtessMonthlyEmployeeRecord[] = [
        {
          numeroPatronalMtess: 38451,
          sucursalLabel: 'ASU',
          ci: 3913649,
          periodoDesde: '2026-07-01',
          periodoHasta: '2026-07-31',
          formaPago: 3,
          diasTrabajados: 30,
          piezasTareas: undefined, // no trabaja por piezas -> debe ser 0
          horasOrdinarias: 192,
          horasExtraordinarias: undefined, // debe ser 0
          salarioBasico: 3044000,
          comisiones: undefined, // debe ser 0
        },
      ];

      const workbooksMap = generateMtessMonthlyWorkbooks(records);
      expect(workbooksMap.has('38451')).toBe(true);

      const wbResult = workbooksMap.get('38451')!;
      const sheetName = wbResult.workbook.SheetNames[0];
      const sheet = wbResult.workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      expect(data).toHaveLength(2); // Header + 1 fila
      const row = data[1];
      expect(row).toHaveLength(32);

      // Índices 0-based:
      // 0: numero_patronal, 1: nro_ci, 2: desde, 3: hasta, 4: forma_pago, 5: dias, 6: piezas
      expect(row[0]).toBe(38451);
      expect(row[1]).toBe(3913649);
      expect(row[2]).toBe('2026-07-01');
      expect(row[3]).toBe('2026-07-31');
      expect(row[4]).toBe(3);
      expect(row[5]).toBe(30);
      expect(row[6]).toBe(0); // piezasTareas -> 0
      expect(row[7]).toBe(192);
      expect(row[8]).toBe(0); // horasExtras -> 0
      expect(row[9]).toBe(3044000);
      expect(row[10]).toBe(0); // comisiones -> 0
    });

    it('debe calcular el Aporte Seg. Social como exactamente el 9% redondeado de la base imponible', () => {
      // Salario 3.044.000 + Horas extras 50% 295.313 = 3.339.313
      // 9% de 3.339.313 = 300.538,17 -> Redondeo entero: 300.538
      const record: MtessMonthlyEmployeeRecord = {
        numeroPatronalMtess: '38451',
        ci: '4736629',
        periodoDesde: '2026-07-01',
        periodoHasta: '2026-07-31',
        formaPago: 3,
        diasTrabajados: 28,
        horasOrdinarias: 179,
        salarioBasico: 3044000,
        horasExtras50: 295313,
      };

      const base = __test__.calcularBaseImponibleMensual(record);
      expect(base).toBe(3339313);

      const aporte = __test__.calcularAporteSegSocial(base);
      expect(aporte).toBe(300538); // 3339313 * 0.09 = 300538.17 -> 300538
    });

    it('debe respetar el límite de 3 conceptos de descuentos y consolidar los sobrantes en "Descuentos varios"', () => {
      const record: MtessMonthlyEmployeeRecord = {
        numeroPatronalMtess: 38451,
        ci: 4772809,
        periodoDesde: '2026-07-01',
        periodoHasta: '2026-07-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 192,
        salarioBasico: 5000000,
        descuentosAdicionales: [
          { concepto: 'Embargo Judicial', monto: 500000 },
          { concepto: 'Asistencia Medica', monto: 150000 },
          { concepto: 'Compras credito', monto: 100000 },
          { concepto: 'Prestamo', monto: 80000 },
          { concepto: 'Donacion', monto: 20000 },
        ],
      };

      const row = __test__.buildMonthlyRow(record);
      expect(row).toHaveLength(32);

      // Descuentos 1: Embargo Judicial = 500.000
      expect(row[26]).toBe(500000);
      expect(row[27]).toBe('Embargo Judicial');

      // Descuentos 2: Asistencia Medica = 150.000
      expect(row[28]).toBe(150000);
      expect(row[29]).toBe('Asistencia Medica');

      // Descuentos 3: Consolidación (100.000 + 80.000 + 20.000 = 200.000) bajo 'Descuentos varios'
      expect(row[30]).toBe(200000);
      expect(row[31]).toBe('Descuentos varios');
    });

    it('debe garantizar CERO celdas vacías en toda la fila mensual cuando no hay descuentos ni variables', () => {
      const record: MtessMonthlyEmployeeRecord = {
        numeroPatronalMtess: 38451,
        ci: 4123456,
        periodoDesde: '2026-08-01',
        periodoHasta: '2026-08-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 192,
        salarioBasico: 3044000,
        // Sin conceptos de descuentos ni asignaciones extras
      };

      const row = __test__.buildMonthlyRow(record);
      expect(row).toHaveLength(32);
      // NINGUNA celda puede ser string vacío, null o undefined
      row.forEach((cell, idx) => {
        expect(cell, `Columna ${idx} (${MTESS_MONTHLY_COLUMNS[idx]}) no debe estar vacía`).not.toBe('');
        expect(cell, `Columna ${idx} (${MTESS_MONTHLY_COLUMNS[idx]}) no debe ser null`).not.toBeNull();
        expect(cell, `Columna ${idx} (${MTESS_MONTHLY_COLUMNS[idx]}) no debe ser undefined`).not.toBeUndefined();
      });

      // Específicamente los conceptos de descuentos deben ser 0 si no hay
      expect(row[26]).toBe(0); // Descuentos 1 monto
      expect(row[27]).toBe(0); // Concepto descuentos 1
      expect(row[28]).toBe(0); // Descuentos 2 monto
      expect(row[29]).toBe(0); // Concepto descuentos 2
      expect(row[30]).toBe(0); // Descuentos 3 monto
      expect(row[31]).toBe(0); // Concepto descuentos 3
    });
  });

  describe('Planilla de Liquidaciones (27 Columnas)', () => {
    it('debe contener exactamente las 27 columnas de liquidaciones del MTESS', () => {
      expect(MTESS_SETTLEMENT_COLUMNS).toHaveLength(27);
      expect(MTESS_SETTLEMENT_COLUMNS[0]).toBe('numero_patronal');
      expect(MTESS_SETTLEMENT_COLUMNS[16]).toBe('otras_asignaciones_1');
      expect(MTESS_SETTLEMENT_COLUMNS[17]).toBe('concepto_otras_asignaciones_1');
      expect(MTESS_SETTLEMENT_COLUMNS[18]).toBe('otras_asignaciones_2');
      expect(MTESS_SETTLEMENT_COLUMNS[19]).toBe('concepto_otras_asignaciones_2');
      expect(MTESS_SETTLEMENT_COLUMNS[20]).toBe('aporte_seg_social');
      expect(MTESS_SETTLEMENT_COLUMNS[25]).toBe('descuentos_3');
      expect(MTESS_SETTLEMENT_COLUMNS[26]).toBe('concepto_descuentos_3');
    });

    it('debe limitar a 2 asignaciones adicionales y hasta 3 descuentos en la liquidación', () => {
      const record: MtessSettlementEmployeeRecord = {
        numeroPatronalMtess: 38451,
        sucursalLabel: 'ASU',
        ci: 5811691,
        fechaPago: '2026-03-16',
        formaPago: 2,
        diasTrabajados: 16,
        horasOrdinarias: 102,
        salarioBasico: 1546159,
        vacacionesCausadas: 1387147,
        aguinaldoProporcional: 986130,
        aporteSegSocial: 389537,
        otrasAsignaciones: [
          { concepto: 'ASIGNACIONES VARIAS', monto: 701307 },
          { concepto: 'ASIGNACIONES VARIAS 2', monto: 693573 },
          { concepto: 'TERCERA ASIGNACION DESCARTADA', monto: 100000 },
        ],
        descuentos: [
          { concepto: 'AUSENCIA', monto: 100000 },
          { concepto: 'desc varios', monto: 1174875 },
          { concepto: 'Anticipo', monto: 50000 },
          { concepto: 'Excedente', monto: 25000 },
        ],
      };

      const row = __test__.buildSettlementRow(record);
      expect(row).toHaveLength(27);

      // Asignación 1
      expect(row[16]).toBe(701307);
      expect(row[17]).toBe('ASIGNACIONES VARIAS');
      // Asignación 2
      expect(row[18]).toBe(693573);
      expect(row[19]).toBe('ASIGNACIONES VARIAS 2');

      // Descuento 1
      expect(row[21]).toBe(100000);
      expect(row[22]).toBe('AUSENCIA');
      // Descuento 2
      expect(row[23]).toBe(1174875);
      expect(row[24]).toBe('desc varios');
      // Descuento 3 (50.000 + 25.000 = 75.000) bajo 'Descuentos varios'
      expect(row[25]).toBe(75000);
      expect(row[26]).toBe('Descuentos varios');
    });

    it('debe generar workbooks de liquidaciones agrupados por patronal con generateMtessSettlementWorkbooks', () => {
      const records: MtessSettlementEmployeeRecord[] = [
        {
          numeroPatronalMtess: 38451,
          sucursalLabel: 'ASU',
          ci: 5811691,
          fechaPago: '2026-03-16',
          formaPago: 2,
          diasTrabajados: 16,
          horasOrdinarias: 102,
          salarioBasico: 1546159,
          vacacionesCausadas: 1387147,
          aguinaldoProporcional: 986130,
          aporteSegSocial: 389537,
        },
      ];

      const workbooksMap = generateMtessSettlementWorkbooks(records);
      expect(workbooksMap.has('38451')).toBe(true);
      const res = workbooksMap.get('38451')!;
      expect(res.fileName).toContain('LIQUIDACIONES_MTESS_38451_ASU');
    });

    it('debe garantizar CERO celdas vacías en toda la planilla de liquidaciones (concepto_otras_asignaciones y descuentos en 0 si no hay)', () => {
      const records: MtessSettlementEmployeeRecord[] = [
        {
          numeroPatronalMtess: 38451,
          sucursalLabel: 'CASA_MATRIZ',
          ci: 4123456,
          fechaPago: '2026-08-31',
          formaPago: 3,
          diasTrabajados: 30,
          horasOrdinarias: 240,
          horasExtraordinarias: 0,
          salarioBasico: 3044000,
          vacacionesProporcionales: 1217600,
          vacacionesCausadas: 0,
          aguinaldoProporcional: 2029333,
          bonificacionFamiliar: 0,
          aporteSegSocial: 383544,
          // Sin asignaciones adicionales ni descuentos
          otrasAsignaciones: [],
          descuentos: [],
        },
      ];

      const workbooksMap = generateMtessSettlementWorkbooks(records);
      const res = workbooksMap.get('38451')!;
      const sheetName = res.workbook.SheetNames[0];
      const sheet = res.workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      expect(data).toHaveLength(2); // Header + 1 fila
      const row = data[1];
      expect(row).toHaveLength(27);

      // NINGUNA celda puede ser string vacío, null o undefined
      row.forEach((cell, idx) => {
        expect(cell, `Columna ${idx} (${MTESS_SETTLEMENT_COLUMNS[idx]}) no debe ser vacía ni null`).not.toBe('');
        expect(cell, `Columna ${idx} (${MTESS_SETTLEMENT_COLUMNS[idx]}) no debe ser null`).not.toBeNull();
        expect(cell, `Columna ${idx} (${MTESS_SETTLEMENT_COLUMNS[idx]}) no debe ser undefined`).not.toBeUndefined();
      });

      // Validar que las columnas específicas señaladas en la captura sean 0 (nunca celdas vacías)
      // 16: otras_asignaciones_1 -> 0
      // 17: concepto_otras_asignaciones_1 -> 0
      // 18: otras_asignaciones_2 -> 0
      // 19: concepto_otras_asignaciones_2 -> 0
      // 21: descuentos_1 -> 0
      // 22: concepto_descuentos_1 -> 0
      // 23: descuentos_2 -> 0
      // 24: concepto_descuentos_2 -> 0
      // 25: descuentos_3 -> 0
      // 26: concepto_descuentos_3 -> 0
      expect(row[16]).toBe(0);
      expect(row[17]).toBe(0);
      expect(row[18]).toBe(0);
      expect(row[19]).toBe(0);
      expect(row[21]).toBe(0);
      expect(row[22]).toBe(0);
      expect(row[23]).toBe(0);
      expect(row[24]).toBe(0);
      expect(row[25]).toBe(0);
      expect(row[26]).toBe(0);
    });
  });

  describe('Soporte Multi-Patronal MTESS con Patronal IPS Unificada', () => {
    it('debe dividir los empleados en archivos Excel separados según su patronal MTESS (ej. ASU vs CDE)', () => {
      const records: MtessMonthlyEmployeeRecord[] = [
        // Empleado 1: Sucursal Asunción (Patronal MTESS 38451)
        {
          numeroPatronalMtess: 38451,
          sucursalLabel: 'ASU',
          patronalIps: 'IPS-CENTRAL-01',
          ci: 3913649,
          periodoDesde: '2026-07-01',
          periodoHasta: '2026-07-31',
          formaPago: 3,
          diasTrabajados: 30,
          horasOrdinarias: 192,
          salarioBasico: 7000000,
        },
        // Empleado 2: Sucursal Asunción (Patronal MTESS 38451)
        {
          numeroPatronalMtess: 38451,
          sucursalLabel: 'ASU',
          patronalIps: 'IPS-CENTRAL-01',
          ci: 4772809,
          periodoDesde: '2026-07-01',
          periodoHasta: '2026-07-31',
          formaPago: 3,
          diasTrabajados: 30,
          horasOrdinarias: 192,
          salarioBasico: 5000000,
        },
        // Empleado 3: Sucursal Ciudad del Este (Patronal MTESS 38452)
        {
          numeroPatronalMtess: 38452,
          sucursalLabel: 'CDE',
          patronalIps: 'IPS-CENTRAL-01', // Mismo IPS
          ci: 4888999,
          periodoDesde: '2026-07-01',
          periodoHasta: '2026-07-31',
          formaPago: 3,
          diasTrabajados: 30,
          horasOrdinarias: 192,
          salarioBasico: 3500000,
        },
      ];

      const workbooksMap = generateMtessMonthlyWorkbooks(records);

      // Deben generarse 2 workbooks distintos
      expect(workbooksMap.size).toBe(2);
      expect(workbooksMap.has('38451')).toBe(true);
      expect(workbooksMap.has('38452')).toBe(true);

      const asuWb = workbooksMap.get('38451')!;
      expect(asuWb.sucursal).toBe('ASU');
      expect(asuWb.fileName).toContain('38451');
      expect(asuWb.fileName).toContain('ASU');
      const asuRows = XLSX.utils.sheet_to_json(asuWb.workbook.Sheets[asuWb.workbook.SheetNames[0]], { header: 1 });
      expect(asuRows).toHaveLength(3); // 1 header + 2 empleados ASU

      const cdeWb = workbooksMap.get('38452')!;
      expect(cdeWb.sucursal).toBe('CDE');
      expect(cdeWb.fileName).toContain('38452');
      expect(cdeWb.fileName).toContain('CDE');
      const cdeRows = XLSX.utils.sheet_to_json(cdeWb.workbook.Sheets[cdeWb.workbook.SheetNames[0]], { header: 1 });
      expect(cdeRows).toHaveLength(2); // 1 header + 1 empleado CDE
    });
  });

  describe('Manejo seguro de Fechas (Timezone Safety)', () => {
    it('no debe desplazar las fechas por zona horaria UTC', () => {
      expect(formatDateYMD('2026-07-01')).toBe('2026-07-01');
      expect(formatDateYMD('01/07/2026')).toBe('2026-07-01');
      expect(formatDateYMD(new Date(2026, 6, 1))).toBe('2026-07-01');
    });
  });

  describe('Cálculo de Base Imponible y Aporte IPS 9% en Liquidaciones (Cumplimiento MTESS)', () => {
    it('debe incluir salario, horas extras, preaviso, indemnización, vacaciones (vencidas y proporcionales) y otras asignaciones en la base imponible', () => {
      const record: MtessSettlementEmployeeRecord = {
        numeroPatronalMtess: 38451,
        ci: 4123456,
        fechaPago: '2026-08-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 240,
        salarioBasico: 3044000,
        horasExtras50: 150000,
        horasExtras100: 200000,
        preaviso: 3044000,
        indemnizacion: 4566000,
        vacacionesProporcionales: 1217600,
        vacacionesCausadas: 1522000, // vacaciones causadas y vencidas de periodos anteriores
        aguinaldoProporcional: 2029333,
        bonificacionFamiliar: 152200,
        otrasAsignaciones: [
          { concepto: 'PLUS PRODUCTIVIDAD', monto: 500000 },
          { concepto: 'BONO EXTRAORDINARIO', monto: 250000 },
        ],
        aporteSegSocial: 0, // Se deja en 0 para probar el cálculo automático
      };

      // Base imponible esperada:
      // 3.044.000 + 150.000 + 200.000 + 3.044.000 + 4.566.000 + 1.217.600 + 1.522.000 + 500.000 + 250.000 = 14.493.600
      const base = __test__.calcularBaseImponibleLiquidacion(record);
      expect(base).toBe(14493600);

      // 9% de 14.493.600 = 1.304.424
      const row = __test__.buildSettlementRow(record);
      expect(row).toHaveLength(27);
      expect(row[20]).toBe(1304424); // Columna 21 (índice 20): Aporte Seg. Social
    });

    it('debe excluir estrictamente aguinaldo proporcional y bonificación familiar de la base imponible del 9% IPS', () => {
      const recordConAguinaldo: MtessSettlementEmployeeRecord = {
        numeroPatronalMtess: 38451,
        ci: 4123456,
        fechaPago: '2026-08-31',
        formaPago: 3,
        diasTrabajados: 30,
        horasOrdinarias: 240,
        salarioBasico: 3000000,
        aguinaldoProporcional: 2500000, // 100% exento IPS (Art. 245 C.T.)
        bonificacionFamiliar: 300000,  // 100% exento IPS (Art. 270 C.T.)
        aporteSegSocial: 0,
      };

      const base = __test__.calcularBaseImponibleLiquidacion(recordConAguinaldo);
      // Solo el salario básico debe formar parte de la base
      expect(base).toBe(3000000);

      const row = __test__.buildSettlementRow(recordConAguinaldo);
      // 9% de 3.000.000 = 270.000
      expect(row[20]).toBe(270000);
    });
  });
});
