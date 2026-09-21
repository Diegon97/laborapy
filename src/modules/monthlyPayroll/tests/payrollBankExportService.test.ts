/**
 * TEST: Servicio de Exportación de Archivos Bancarios para Pago de Salarios
 */

import { describe, it, expect } from 'vitest';
import {
  exportarBancoSIPAP_CSV,
  exportarBancoItau_TXT,
  exportarBancoSudameris_TXT,
  exportarBancoUeno_CSV,
} from '../services/payrollBankExportService';
import type { LiquidacionMensualResult } from '../types';
import type { PeriodoNomina } from '../types/noveltyTypes';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';

describe('payrollBankExportService — Exportación Masiva a Bancos Paraguayos', () => {
  const periodoMock: PeriodoNomina = {
    id: '2026-09',
    anio: 2026,
    mes: 9,
    estado: 'abierto',
    moneda: 'PYG',
    codigoFormal: 'NOM-2026-09',
  };

  const empresaMock: EmpresaCliente = {
    id: 'emp_1',
    razonSocial: 'CONSTRUCTORA MBARACAYU S.A.',
    ruc: '80012345',
    dv: '6',
    direccion: 'Asunción',
    telefono: '021-123456',
    emailCorporativo: 'contacto@mbaracayu.com.py',
    representanteLegalNombre: 'Ing. Carlos Ayala',
    representanteLegalCi: '1234567',
    activo: true,
    createdAt: '2026-01-01',
  };

  const liquidacionesMock: LiquidacionMensualResult[] = [
    {
      input: {
        ci: '1234567',
        nombre: 'Juan Carlos Benítez',
        cargo: 'Oficial de Obra',
        tipo: 'cotizante_ips',
        salarioFijo: 3500000,
        nroCuenta: '001-23456-7',
      } as any,
      diasTrabajadosEfectivos: 30,
      valorDia: 116666.67,
      valorHora: 14583.33,
      haberes: {
        salarioBaseDiasTrabajados: 3500000,
        adicionalCargo: 0,
        montoVacaciones: 0,
        montoReposo: 0,
        montoHoras50: 0,
        montoHoras130: 0,
        montoHoras100: 0,
        montoRecargoNocturno: 0,
        bonificacionFamiliar: 0,
        refrigerioTraslado: 0,
        ivaMonto: 0,
        totalHaberesBrutos: 3500000,
      },
      haberesImponiblesIps: 3500000,
      retencionIva: 0,
      sueldoMenosRetencion: 3500000,
      descuentos: {
        retencionIva: 0,
        aporteObreroIps: 315000,
        descuentoAusencias: 0,
        embargosJudiciales: 0,
        seguroMedicoPrivado: 0,
        anticipoSalario: 0,
        prestamosEmpresa: 0,
        faltanteCaja: 0,
        faltanteMercaderia: 0,
        telefonoNotebook: 0,
        compraCreditoEmpresa: 0,
        otrosDescuentos: 0,
        totalDescuentos: 315000,
      },
      netoACobrar: 3185000,
      aportePatronalIps: 577500,
      provisionAguinaldoMensual: 291666.67,
    },
    {
      input: {
        ci: '2345678',
        nombre: 'María Elena Villalba',
        cargo: 'Administrativa',
        tipo: 'cotizante_ips',
        salarioFijo: 4200000,
        nroCuenta: '002-98765-4',
      } as any,
      diasTrabajadosEfectivos: 30,
      valorDia: 140000,
      valorHora: 17500,
      haberes: {
        salarioBaseDiasTrabajados: 4200000,
        adicionalCargo: 0,
        montoVacaciones: 0,
        montoReposo: 0,
        montoHoras50: 0,
        montoHoras130: 0,
        montoHoras100: 0,
        montoRecargoNocturno: 0,
        bonificacionFamiliar: 0,
        refrigerioTraslado: 0,
        ivaMonto: 0,
        totalHaberesBrutos: 4200000,
      },
      haberesImponiblesIps: 4200000,
      retencionIva: 0,
      sueldoMenosRetencion: 4200000,
      descuentos: {
        retencionIva: 0,
        aporteObreroIps: 378000,
        descuentoAusencias: 0,
        embargosJudiciales: 0,
        seguroMedicoPrivado: 0,
        anticipoSalario: 0,
        prestamosEmpresa: 0,
        faltanteCaja: 0,
        faltanteMercaderia: 0,
        telefonoNotebook: 0,
        compraCreditoEmpresa: 0,
        otrosDescuentos: 0,
        totalDescuentos: 378000,
      },
      netoACobrar: 3822000,
      aportePatronalIps: 693000,
      provisionAguinaldoMensual: 350000,
    },
  ];

  it('debe generar archivo SIPAP CSV con encabezados y montos correctos', () => {
    const csv = exportarBancoSIPAP_CSV(liquidacionesMock, periodoMock, empresaMock);
    expect(csv).toContain('Documento_CI,Beneficiario,Monto_Acreditar,Moneda');
    expect(csv).toContain('"1234567"');
    expect(csv).toContain('"Juan Carlos Benítez"');
    expect(csv).toContain('3185000');
  });

  it('debe generar archivo TXT de Banco Itaú con cabecera y detalle por funcionario', () => {
    const txt = exportarBancoItau_TXT(liquidacionesMock, periodoMock, empresaMock);
    expect(txt).toContain('0180012345');
    expect(txt).toContain('SUELDOSPYG');
    expect(txt).toContain('02000010001234567JUAN CARLOS BENÍTEZ');
    expect(txt).toContain('0300002'); // Pie de lote: 2 funcionarios
  });

  it('debe generar archivo delimitado para Banco Sudameris / Continental', () => {
    const txt = exportarBancoSudameris_TXT(liquidacionesMock, periodoMock, empresaMock);
    expect(txt).toContain('1234567;Juan Carlos Benítez;001-23456-7;3185000;GS;');
    expect(txt).toContain('2345678;María Elena Villalba;002-98765-4;3822000;GS;');
  });

  it('debe generar archivo CSV para Ueno Empresas con columnas oficiales', () => {
    const csv = exportarBancoUeno_CSV(liquidacionesMock, periodoMock, empresaMock);
    expect(csv).toContain('Tipo_Documento,Numero_Documento,Nombre_Beneficiario,Numero_Cuenta_Ueno_o_SIPAP,Monto_Acreditar,Moneda,Concepto');
    expect(csv).toContain('CI,"1234567","Juan Carlos Benítez","001-23456-7",3185000,"PYG"');
    expect(csv).toContain('CI,"2345678","María Elena Villalba","002-98765-4",3822000,"PYG"');
  });
});
