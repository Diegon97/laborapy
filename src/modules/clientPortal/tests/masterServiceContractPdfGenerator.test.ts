/**
 * TEST: Generador de Contrato Maestro de Prestación de Servicios Tobi en PDF
 */

import { describe, it, expect } from 'vitest';
import {
  generarContratoMaestroPDF,
  generarContratoMaestroDesdeEmpresa,
  type ContratoMaestroInput,
} from '../generators/masterServiceContractPdfGenerator';
import type { EmpresaCliente } from '../types/clientPortal';

describe('masterServiceContractPdfGenerator — Contrato Maestro de Servicios Tobi', () => {
  const inputMock: ContratoMaestroInput = {
    razonSocial: 'COMERCIAL DEL ESTE S.A.',
    ruc: '80045678',
    dv: '4',
    representanteLegalNombre: 'Carlos Gómez Ferreira',
    representanteLegalCi: '2345678',
    domicilioLegal: 'Avda. Eusebio Ayala 1234 c/ Choferes del Chaco',
    ciudad: 'Asunción',
    planNombre: 'Tobi PyME Integral',
    montoMensualPYG: 1450000,
    montoSetupPYG: 1500000,
    fechaInicioServicio: '2026-10-01',
  };

  it('debe generar un documento jsPDF válido con múltiples páginas y foliado dinámico', () => {
    const doc = generarContratoMaestroPDF(inputMock);
    expect(doc).toBeDefined();

    const numPaginas = doc.getNumberOfPages();
    expect(numPaginas).toBeGreaterThanOrEqual(2);
  });

  it('debe generar correctamente el contrato desde una EmpresaCliente existente', () => {
    const empresaMock: EmpresaCliente = {
      id: 'emp_test_1',
      razonSocial: 'AGROINDUSTRIAL CHACO S.R.L.',
      ruc: '80099887',
      dv: '9',
      direccion: 'Ruta Transchaco Km 18',
      telefono: '021-987654',
      emailCorporativo: 'rrhh@agrochaco.com.py',
      activo: true,
      representanteLegalNombre: 'Klaus Müller',
      representanteLegalCi: '4567890',
      ciudad: 'Filadelfia',
      nroPatronalIps: '0001234567',
      nroPatronalMtess: 'MTESS-9988',
      actividadEconomica: 'Ganadería y Frigorífico',
      createdAt: '2026-09-01',
    };

    const doc = generarContratoMaestroDesdeEmpresa(empresaMock, {
      planNombre: 'Tobi Business Agro',
      montoMensualPYG: 2200000,
      montoSetupPYG: 2500000,
      fechaInicio: '2026-10-15',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});
