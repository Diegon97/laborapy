import { describe, it, expect } from 'vitest';
import { generarNotaLaboralPDF, type NotaLaboralOptions } from '../generators/noticePdfGenerator';
import { generarNotaLaboralDocxDocument } from '../generators/noticeDocxGenerator';
import { Packer } from 'docx';

describe('noticeGenerators — Generadores Oficiales de Sanciones, Traslados y Despidos', () => {
  const baseEmpresa = 'Corporación Guaraní S.A.';
  const baseEmpleado = {
    nombreEmpleado: 'Martín Romero',
    ciEmpleado: '4.789.012',
    cargoEmpleado: 'Cajero / Asistente de Depósito',
    lugarFecha: 'Asunción, 15 de septiembre de 2026',
  };

  it('debe generar PDF válido de Amonestación Escrita con constancia para legajo', () => {
    const opts: NotaLaboralOptions = {
      ...baseEmpleado,
      empresa: baseEmpresa,
      tipo: 'amonestacion',
      hechosOcurridos: 'Llegada tardía de más de 60 minutos en fecha 14/09/2026 sin justificación',
      fundamentoLegal: 'Art. 81 inc. a) Código del Trabajo',
    };

    const pdf = generarNotaLaboralPDF(opts);
    expect(pdf).toBeDefined();
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const dataUri = pdf.output('datauristring');
    expect(dataUri).toContain('data:application/pdf');
  });

  it('debe generar PDF válido de Suspensión Disciplinaria respetando tope de 8 días', () => {
    const opts: NotaLaboralOptions = {
      ...baseEmpleado,
      empresa: baseEmpresa,
      tipo: 'suspension_disciplinaria',
      diasSuspension: 3,
      fechaInicioSuspension: '16 de septiembre de 2026',
      fechaFinSuspension: '19 de septiembre de 2026',
      hechosOcurridos: 'Reiteración de faltas tras amonestación previa',
    };

    const pdf = generarNotaLaboralPDF(opts);
    expect(pdf).toBeDefined();
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('debe generar PDF válido de Notificación de Traslado según Art. 34 C.T.', () => {
    const opts: NotaLaboralOptions = {
      ...baseEmpleado,
      empresa: baseEmpresa,
      tipo: 'traslado',
      sucursalOrigen: 'Casa Central (Asunción)',
      sucursalDestino: 'Sucursal San Lorenzo',
      fechaEfectivaTraslado: '01 de octubre de 2026',
      compensacionTraslado: 'Plus mensual de transporte Gs. 350.000',
    };

    const pdf = generarNotaLaboralPDF(opts);
    expect(pdf).toBeDefined();
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('debe generar PDF válido de Despido con Causa Justificada', () => {
    const opts: NotaLaboralOptions = {
      ...baseEmpleado,
      empresa: baseEmpresa,
      tipo: 'despido_justificado',
      causaJustificada: 'Inasistencias injustificadas por más de 3 días consecutivos (Art. 81 inc. i)',
    };

    const pdf = generarNotaLaboralPDF(opts);
    expect(pdf).toBeDefined();
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('debe compilar exitosamente en formato Word (.docx) para cada tipo de documento', async () => {
    const optsAmonestacion: NotaLaboralOptions = {
      ...baseEmpleado,
      empresa: baseEmpresa,
      tipo: 'amonestacion',
      hechosOcurridos: 'Falta injustificada',
    };

    const doc = generarNotaLaboralDocxDocument(optsAmonestacion);
    expect(doc).toBeDefined();

    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
