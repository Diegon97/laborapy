/**
 * TESTS UNITARIOS: GESTIÓN DE SUCURSALES, MULTI-PATRONAL IPS & TRASLADO DE PERSONAL
 * Conforme a Ley N.º 213/93, Decreto-Ley N.º 1860/50 y Resoluciones AOP-IPS / MTESS REOP
 */

import { describe, it, expect } from 'vitest';
import type { EmpresaCliente, Empleado, ReciboSalario } from '../types/clientPortal';
import {
  buildSucursalesOptions,
  getSucursalById,
  DEPARTAMENTOS_PARAGUAY,
} from '../types/clientPortal';
import { generarIpsPrn } from '../generators/ipsReiTxtGenerator';
import { generarNotaTrasladoPDF } from '../generators/transferNoticePdfGenerator';

describe('Gestión de Sucursales y Multi-patronal (IPS / MTESS)', () => {
  const empresaMock: EmpresaCliente = {
    id: 'emp_test_multi',
    razonSocial: 'PARAGUAY RETAIL S.A.',
    ruc: '80012345-6',
    dv: '6',
    direccion: 'Avda. España 1234, Asunción',
    nroPatronalMtess: '38451',
    nroPatronalIps: '0004612819',
    representanteLegalNombre: 'Juan Valdéz',
    representanteLegalCi: '1.234.567',
    representanteLegalCargo: 'Director General',
    emailCorporativo: 'rrhh@paraguayretail.com.py',
    telefono: '021-123456',
    activo: true,
    createdAt: '2026-01-01',
    patronalesMtessSecundarias: [
      {
        id: 'suc_cde',
        sucursalNombre: 'Sucursal Ciudad del Este',
        nroPatronalMtess: '55102',
        departamento: 'Alto Paraná',
        ciudad: 'Ciudad del Este',
        direccion: 'Avda. San Blas Km 4, CDE',
        usarIpsPrincipal: false,
        nroPatronalIps: '0008899771',
      },
      {
        id: 'suc_enc',
        sucursalNombre: 'Sucursal Encarnación',
        nroPatronalMtess: '66203',
        departamento: 'Itapúa',
        ciudad: 'Encarnación',
        direccion: 'Costanera San José, Encarnación',
        usarIpsPrincipal: true, // Comparte la patronal IPS principal
      },
    ],
  };

  it('buildSucursalesOptions genera Casa Central y opciones de sucursales correctamente', () => {
    const options = buildSucursalesOptions(empresaMock);
    expect(options).toHaveLength(3);

    // 1. Casa Central
    expect(options[0].id).toBe('principal');
    expect(options[0].label).toContain('Casa Central');
    expect(options[0].nroPatronalMtess).toBe('38451');
    expect(options[0].nroPatronalIps).toBe('0004612819');
    expect(options[0].esCasaCentral).toBe(true);

    // 2. Sucursal CDE (propia patronal IPS)
    expect(options[1].id).toBe('suc_cde');
    expect(options[1].nombre).toBe('Sucursal Ciudad del Este');
    expect(options[1].nroPatronalMtess).toBe('55102');
    expect(options[1].nroPatronalIps).toBe('0008899771');
    expect(options[1].departamentoGeografico).toBe('Alto Paraná');
    expect(options[1].esCasaCentral).toBe(false);

    // 3. Sucursal Encarnación (comparte IPS de Casa Central)
    expect(options[2].id).toBe('suc_enc');
    expect(options[2].nombre).toBe('Sucursal Encarnación');
    expect(options[2].nroPatronalMtess).toBe('66203');
    expect(options[2].nroPatronalIps).toBe('0004612819'); // Heredada de Casa Central
    expect(options[2].esCasaCentral).toBe(false);
  });

  it('getSucursalById resuelve correctamente sucursales y fallbacks', () => {
    // Buscar por ID existente
    const cde = getSucursalById(empresaMock, 'suc_cde');
    expect(cde).toBeDefined();
    expect(cde.nombre).toBe('Sucursal Ciudad del Este');
    expect(cde.nroPatronalIps).toBe('0008899771');

    // Buscar sin ID o con casa_central / principal
    const central1 = getSucursalById(empresaMock, undefined);
    expect(central1.esCasaCentral).toBe(true);
    expect(central1.nroPatronalMtess).toBe('38451');

    const central2 = getSucursalById(empresaMock, 'casa_central');
    expect(central2.esCasaCentral).toBe(true);

    const central3 = getSucursalById(empresaMock, 'principal');
    expect(central3.esCasaCentral).toBe(true);

    // Buscar con ID inexistente hace fallback a Casa Central
    const fallback = getSucursalById(empresaMock, 'suc_fantasma');
    expect(fallback.esCasaCentral).toBe(true);
  });

  it('DEPARTAMENTOS_PARAGUAY contiene los 17 departamentos oficiales más Capital Asunción', () => {
    expect(DEPARTAMENTOS_PARAGUAY.length).toBe(18);
    expect(DEPARTAMENTOS_PARAGUAY).toContain('Capital / Asunción');
    expect(DEPARTAMENTOS_PARAGUAY).toContain('Alto Paraná');
    expect(DEPARTAMENTOS_PARAGUAY).toContain('Itapúa');
    expect(DEPARTAMENTOS_PARAGUAY).toContain('Central');
  });

  it('generarIpsPrn estampa el número patronal IPS específico para cada empleado según su sucursal', () => {
    const empCasaCentral: Empleado = {
      id: 'emp_1',
      clienteId: empresaMock.id,
      ci: '1234567',
      nombres: 'Carlos',
      apellidos: 'Benitez',
      nacionalidad: 'Paraguaya',
      estadoCivil: 'Soltero/a',
      sexo: 'M',
      hijosMenores: 0,
      cargo: 'Cajero Central',
      departamento: 'Operaciones',
      sucursalId: 'principal',
      fechaIngreso: '2024-01-15',
      salarioBase: 3000000,
      modalidadPago: 'mensual',
      estado: 'activo',
      periodoPruebaDias: 30,
      vacacionesCausadasAcumuladas: 0,
      vacacionesTomadas: 0,
      createdAt: '2024-01-15',
    };

    const empCde: Empleado = {
      id: 'emp_2',
      clienteId: empresaMock.id,
      ci: '9876543',
      nombres: 'Maria',
      apellidos: 'González',
      nacionalidad: 'Paraguaya',
      estadoCivil: 'Casado/a',
      sexo: 'F',
      hijosMenores: 1,
      cargo: 'Vendedora CDE',
      departamento: 'Ventas',
      sucursalId: 'suc_cde', // Patronal IPS propia: 0008899771
      fechaIngreso: '2024-02-01',
      salarioBase: 3500000,
      modalidadPago: 'mensual',
      estado: 'activo',
      periodoPruebaDias: 30,
      vacacionesCausadasAcumuladas: 0,
      vacacionesTomadas: 0,
      createdAt: '2024-02-01',
    };

    const recibo1: ReciboSalario = {
      id: 'rec_1',
      clienteId: empresaMock.id,
      empleadoId: 'emp_1',
      mes: 7,
      anho: 2026,
      salarioBase: 3000000,
      diasTrabajados: 30,
      salarioDevengado: 3000000,
      horasExtras50Cant: 0,
      horasExtras50Monto: 0,
      horasExtras100Cant: 0,
      horasExtras100Monto: 0,
      comisionesPremios: 0,
      bonificacionFamiliar: 0,
      totalIngresosBrutos: 3000000,
      ipsObrero9: 270000,
      anticiposQuincena: 0,
      judicialesAlimentos: 0,
      otrosDescuentos: 0,
      totalDeducciones: 270000,
      salarioNeto: 2730000,
      salarioNetoLetras: 'Dos millones setecientos treinta mil',
      fechaEmision: '2026-07-31',
    };

    const recibo2: ReciboSalario = {
      id: 'rec_2',
      clienteId: empresaMock.id,
      empleadoId: 'emp_2',
      mes: 7,
      anho: 2026,
      salarioBase: 3500000,
      diasTrabajados: 30,
      salarioDevengado: 3500000,
      horasExtras50Cant: 0,
      horasExtras50Monto: 0,
      horasExtras100Cant: 0,
      horasExtras100Monto: 0,
      comisionesPremios: 0,
      bonificacionFamiliar: 140000,
      totalIngresosBrutos: 3640000,
      ipsObrero9: 315000,
      anticiposQuincena: 0,
      judicialesAlimentos: 0,
      otrosDescuentos: 0,
      totalDeducciones: 315000,
      salarioNeto: 3325000,
      salarioNetoLetras: 'Tres millones trescientos veinticinco mil',
      fechaEmision: '2026-07-31',
    };

    const resultadoPrn = generarIpsPrn([recibo1, recibo2], [empCasaCentral, empCde], empresaMock, 7, 2026);
    expect(resultadoPrn.fileName).toBe('IPS_JULIO_2026.prn');
    expect(resultadoPrn.totalEmpleados).toBe(2);

    const lineas = resultadoPrn.content.split('\r\n');
    expect(lineas).toHaveLength(2);

    // Línea 1 (Casa Central): debe iniciar con los 10 dígitos de la patronal IPS principal
    const patronalLinea1 = lineas[0].substring(0, 10);
    expect(patronalLinea1).toBe('0004612819');
    expect(lineas[0].length).toBe(109);

    // Línea 2 (Sucursal CDE): debe iniciar con los 10 dígitos de la patronal IPS de la sucursal
    const patronalLinea2 = lineas[1].substring(0, 10);
    expect(patronalLinea2).toBe('0008899771');
    expect(lineas[1].length).toBe(109);
  });

  it('generarNotaTrasladoPDF genera correctamente la Nota Oficial de Traslado conforme al Código Laboral', () => {
    const empleado: Empleado = {
      id: 'emp_traslado',
      clienteId: empresaMock.id,
      ci: '3.456.789',
      nombres: 'Rodrigo',
      apellidos: 'Giménez',
      nacionalidad: 'Paraguaya',
      estadoCivil: 'Casado/a',
      sexo: 'M',
      hijosMenores: 2,
      cargo: 'Jefe de Operaciones',
      departamento: 'Logística',
      sucursalId: 'principal',
      lugarTrabajo: 'Casa Central Asunción',
      departamentoGeografico: 'Capital / Asunción',
      fechaIngreso: '2022-03-01',
      salarioBase: 6500000,
      modalidadPago: 'mensual',
      estado: 'activo',
      periodoPruebaDias: 60,
      vacacionesCausadasAcumuladas: 24,
      vacacionesTomadas: 12,
      createdAt: '2022-03-01',
    };

    const doc = generarNotaTrasladoPDF({
      empresa: empresaMock,
      empleado,
      sucursalOrigenLabel: 'Casa Central Asunción',
      sucursalDestinoLabel: 'Sucursal Ciudad del Este',
      lugarTrabajoAnterior: 'Avda. España 1234, Asunción',
      lugarTrabajoNuevo: 'Avda. San Blas Km 4, CDE',
      departamentoGeograficoNuevo: 'Alto Paraná',
      fechaVigencia: '2026-10-01',
      motivoTraslado: 'Apertura y puesta en marcha operativa del Centro Logístico de Ciudad del Este',
      compensacionTraslado: 'Asignación mensual de viático de traslado y radicación',
      nroPatronalMtessDestino: '55102',
      nroPatronalIpsDestino: '0008899771',
    });

    expect(doc).toBeDefined();
    // Verifica que tenga al menos 1 página generada
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
