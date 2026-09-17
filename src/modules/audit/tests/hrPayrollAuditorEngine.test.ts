import { describe, it, expect } from 'vitest';
import {
  auditarNominaPatronal,
  generarDictamenAuditoriaPdf,
  SMLV_MENSUAL_2026,
  JORNAL_MINIMO_2026,
} from '../index';
import type {
  EmpresaCliente,
  Empleado,
  ContratoTrabajo,
} from '../../clientPortal/types/clientPortal';

const mockEmpresa: EmpresaCliente = {
  id: 'emp_test_01',
  ruc: '80012345',
  dv: '6',
  razonSocial: 'EMPRESA AUDITADA S.A.',
  nombreFantasia: 'Auditada Corp',
  actividadEconomica: 'Comercio General',
  direccion: 'Avda. Mariscal López 1234',
  telefono: '021 123 456',
  emailCorporativo: 'rrhh@auditada.com.py',
  nroPatronalIps: '123456',
  nroPatronalMtess: '987654',
  representanteLegalNombre: 'Juan Pérez',
  representanteLegalCi: '1.234.567',
  representanteLegalCargo: 'Director General',
  ciudad: 'Asunción',
  activo: true,
  createdAt: '2025-01-01',
};

const mockEmpleadoLimpio: Empleado = {
  id: 'emp_01',
  clienteId: 'cli_01',
  ci: '4.500.000',
  nombres: 'Carlos',
  apellidos: 'Gómez',
  fechaNacimiento: '1995-05-10',
  nacionalidad: 'Paraguaya',
  estadoCivil: 'Soltero/a',
  sexo: 'M',
  domicilio: 'Asunción',
  telefono: '0981 111 222',
  email: 'carlos@empresa.com.py',
  hijosMenores: 0,
  hijosDiscapacidad: 0,
  cargo: 'Analista Contable',
  departamento: 'Administración',
  fechaIngreso: '2024-01-15',
  salarioBase: SMLV_MENSUAL_2026 + 500_000,
  modalidadPago: 'mensual',
  nroIps: '998877',
  estado: 'activo',
  periodoPruebaDias: 30,
  vacacionesCausadasAcumuladas: 0,
  vacacionesTomadas: 0,
  estadoMaternidad: 'ninguno',
  createdAt: '2024-01-15',
};

const mockContrato: ContratoTrabajo = {
  id: 'ct_01',
  clienteId: 'cli_01',
  empleadoId: 'emp_01',
  tipoContrato: 'indefinido',
  fechaInicio: '2024-01-15',
  periodoPruebaDias: 30,
  salarioPactado: mockEmpleadoLimpio.salarioBase,
  jornadaLaboral: 'diurna',
  horarioInicio: '08:00',
  horarioFin: '17:00',
  lugarPrestacion: 'Asunción',
  estado: 'firmado',
  createdAt: '2024-01-15',
};

describe('Módulo de Auditoría Patronal Pre-MTESS — hrPayrollAuditorEngine', () => {
  it('evalúa una nómina 100% en regla con score 100/100 y riesgo BAJO', () => {
    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [mockEmpleadoLimpio],
      contratos: [mockContrato],
      datosComplementarios: {
        emp_01: {
          tieneContratoEscrito: true,
        },
      },
    });

    expect(resultado.resumen.scoreCumplimiento).toBe(100);
    expect(resultado.resumen.semaforo.nivel).toBe('bajo');
    expect(resultado.resumen.semaforo.etiqueta).toBe('BAJO');
    expect(resultado.resumen.totalHallazgos).toBe(0);
    expect(resultado.resumen.multaTotalEstimadaPYG).toBe(0);
  });

  it('detecta fraude laboral por régimen de factura (Art. 19 C.T.) con severidad CRÍTICO', () => {
    const empleadoFactura: Empleado = {
      ...mockEmpleadoLimpio,
      id: 'emp_factura',
      modalidadPago: 'factura',
      nroIps: undefined,
    };

    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [empleadoFactura],
    });

    expect(resultado.resumen.criticos).toBeGreaterThanOrEqual(1);
    expect(resultado.resumen.semaforo.nivel).toBe('critico');
    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'simulacion_factura');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.severidad).toBe('critico');
    expect(hallazgo?.baseLegal).toMatch(/19/);
    expect(hallazgo?.multaEstimadaPYG).toBe(30 * JORNAL_MINIMO_2026);
  });

  it('detecta trabajador activo sin número de IPS (Decreto-Ley 1860/50)', () => {
    const empleadoSinIps: Empleado = {
      ...mockEmpleadoLimpio,
      id: 'emp_sin_ips',
      nroIps: '',
      modalidadPago: 'mensual',
    };

    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [empleadoSinIps],
    });

    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'omision_ips');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.severidad).toBe('critico');
    expect(hallazgo?.baseLegal).toContain('1860/50');
  });

  it('detecta salario por debajo del Salario Mínimo Legal Vigente mensual', () => {
    const empleadoSalarioBajo: Empleado = {
      ...mockEmpleadoLimpio,
      id: 'emp_bajo',
      salarioBase: 2_000_000, // Menor a 2.798.309
    };

    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [empleadoSalarioBajo],
    });

    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'salario_bajo_minimo');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.evidencia).toContain('2.000.000');
  });

  it('detecta exceso de horas extraordinarias (Art. 202 C.T.: >3h/día o >57h/semana)', () => {
    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [mockEmpleadoLimpio],
      datosComplementarios: {
        emp_01: {
          horasExtrasDiarias: 4.5,
          horasExtrasSemanales: 62,
          tieneContratoEscrito: true,
        },
      },
    });

    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'exceso_horas_extras');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.baseLegal).toMatch(/202/);
  });

  it('detecta omisión de bonificación familiar para empleados con hijos declarados (Art. 261 C.T.)', () => {
    const empleadoConHijos: Empleado = {
      ...mockEmpleadoLimpio,
      id: 'emp_hijos',
      salarioBase: SMLV_MENSUAL_2026,
      hijosMenores: 2,
    };

    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [empleadoConHijos],
      datosComplementarios: {
        emp_hijos: {
          bonificacionFamiliarPagada: 0,
          tieneContratoEscrito: true,
        },
      },
    });

    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'omision_bonificacion_familiar');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.baseLegal).toMatch(/261/);
    expect(hallazgo?.evidencia).toContain('Hijos declarados: 2');
  });

  it('detecta trabajadora con fuero maternal en proceso de desvinculación (Ley 5508/15)', () => {
    const empleadaMaternal: Empleado = {
      ...mockEmpleadoLimpio,
      id: 'emp_maternal',
      sexo: 'F',
      estadoMaternidad: 'embarazada',
    };

    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [empleadaMaternal],
      datosComplementarios: {
        emp_maternal: {
          fueroMaternalActivo: true,
          enProcesoDesvinculacion: true,
          tieneContratoEscrito: true,
        },
      },
    });

    const hallazgo = resultado.hallazgos.find((h) => h.tipo === 'fuero_maternal_riesgo');
    expect(hallazgo).toBeDefined();
    expect(hallazgo?.severidad).toBe('critico');
    expect(hallazgo?.baseLegal).toContain('5508/15');
  });

  it('genera un informe PDF oficial del dictamen sin arrojar excepciones', () => {
    const resultado = auditarNominaPatronal({
      empresa: mockEmpresa,
      empleados: [
        mockEmpleadoLimpio,
        {
          ...mockEmpleadoLimpio,
          id: 'emp_02',
          modalidadPago: 'factura',
        },
      ],
    });

    const doc = generarDictamenAuditoriaPdf(resultado);
    expect(doc).toBeDefined();
    const pdfOutput = doc.output('arraybuffer');
    expect(pdfOutput.byteLength).toBeGreaterThan(1000);
  });
});
