// @vitest-environment jsdom
/**
 * TESTS — ALMACENAMIENTO LOCAL DE LA PLANILLA MENSUAL EDITABLE (ERP LABORAPY)
 *
 * Verifica la persistencia por empresa+período del servicio monthlyPayrollStorage:
 * roundtrip, clave inexistente, JSON corrupto tolerado, borrado y generación de claves.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStorageKey,
  loadNominaPeriodo,
  saveNominaPeriodo,
  deleteNominaPeriodo,
} from './monthlyPayrollStorage';
import type { EmpleadoNominaInput } from '../types';

const empleadoCompleto: EmpleadoNominaInput = {
  ci: '1234567',
  nombre: 'BENITEZ, JUAN CARLOS',
  cargo: 'OPERARIO DE PLANTA',
  departamento: 'PRODUCCION',
  empresa: 'EMPRESA DEMO S.A.',
  tipo: 'cotizante_ips',
  salarioFijo: 3_000_000,
  diasVacaciones: 5,
  diasReposo: 2,
  diasAusencias: 1,
  adicionalCargo: 250_000,
  cantHoras50: 10,
  cantHoras130: 4,
  cantHoras100: 6.5,
  cantHorasNocturnas: 8,
  cantidadHijos: 2,
  refrigerioTraslado: 300_000,
  embargosJudiciales: 150_000,
  seguroMedicoPrivado: 120_000,
  anticipoSalario: 500_000,
  prestamosEmpresa: 200_000,
  faltanteCaja: 0,
  faltanteMercaderia: 0,
  telefonoNotebook: 100_000,
  compraCreditoEmpresa: 50_000,
  otrosDescuentos: 0,
};

describe('monthlyPayrollStorage — Planilla mensual editable', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('roundtrip: guarda y recupera la planilla completa del período', () => {
    const ok = saveNominaPeriodo('emp_001', '2026-09', [empleadoCompleto]);
    expect(ok).toBe(true);

    const rec = loadNominaPeriodo('emp_001', '2026-09');

    expect(rec).not.toBeNull();
    expect(rec?.clienteId).toBe('emp_001');
    expect(rec?.periodo).toBe('2026-09');
    expect(typeof rec?.actualizadoEn).toBe('string');
    expect(rec?.empleados).toHaveLength(1);
    expect(rec?.empleados[0]).toEqual(empleadoCompleto);
  });

  it('load descarta ítems malformados (sin ci/nombre) de un JSON manipulado', () => {
    const key = getStorageKey('emp_004', '2026-09');
    const manipulado = {
      clienteId: 'emp_004',
      periodo: '2026-09',
      actualizadoEn: new Date().toISOString(),
      empleados: [{}, { ci: '', nombre: 'SIN CI' }, empleadoCompleto],
    };
    localStorage.setItem(key, JSON.stringify(manipulado));

    const rec = loadNominaPeriodo('emp_004', '2026-09');

    expect(rec).not.toBeNull();
    expect(rec?.empleados).toHaveLength(1);
    expect(rec?.empleados[0].ci).toBe(empleadoCompleto.ci);
  });

  it('load de una clave inexistente devuelve null', () => {
    expect(loadNominaPeriodo('emp_inexistente', '2099-01')).toBeNull();
  });

  it('load con JSON corrupto devuelve null y un save posterior lo sobrescribe', () => {
    const key = getStorageKey('emp_002', '2026-08');
    localStorage.setItem(key, '{esto-no-es-un-json-valido');

    expect(loadNominaPeriodo('emp_002', '2026-08')).toBeNull();

    saveNominaPeriodo('emp_002', '2026-08', [empleadoCompleto]);

    const rec = loadNominaPeriodo('emp_002', '2026-08');
    expect(rec).not.toBeNull();
    expect(rec?.empleados).toHaveLength(1);
    expect(rec?.empleados[0]).toEqual(empleadoCompleto);
  });

  it('delete elimina el período guardado y load devuelve null', () => {
    saveNominaPeriodo('emp_003', '2026-07', [empleadoCompleto]);
    expect(loadNominaPeriodo('emp_003', '2026-07')).not.toBeNull();

    deleteNominaPeriodo('emp_003', '2026-07');

    expect(loadNominaPeriodo('emp_003', '2026-07')).toBeNull();
  });

  it("getStorageKey genera 'general' cuando el cliente es vacío", () => {
    expect(getStorageKey('', '2026-09')).toBe('laborapy_nomina_mensual_general_2026-09');
  });

  it('guarda y recupera columnas personalizadas (customColumns) y columnas ocultas (hiddenColumnIds)', () => {
    const customCol = {
      id: 'col_bono_extra',
      label: 'Bono Productividad',
      type: 'currency' as const,
      isCustom: true,
      color: 'emerald' as const,
      formula: '=[salarioFijo] * 0.05',
    };
    const empConCustom: EmpleadoNominaInput = {
      ...empleadoCompleto,
      customFields: { col_bono_extra: 150_000 },
    };

    saveNominaPeriodo('emp_005', '2026-09', [empConCustom], [customCol], ['telefonoNotebook']);

    const rec = loadNominaPeriodo('emp_005', '2026-09');
    expect(rec).not.toBeNull();
    expect(rec?.customColumns).toHaveLength(1);
    expect(rec?.customColumns?.[0].label).toBe('Bono Productividad');
    expect(rec?.hiddenColumnIds).toEqual(['telefonoNotebook']);
    expect(rec?.empleados[0].customFields?.col_bono_extra).toBe(150_000);
  });
});
