import { describe, it, expect } from 'vitest';
import type { DiaMarcacionInput } from '../services/overtimeCalculationEngine';
import {
  calcularDiaOvertime,
  calcularSemanaOvertime,
  calcularOvertimeManual,
  parseHoraMinutos,
  parseJornada,
  formatearMinutosAHora,
} from '../services/overtimeCalculationEngine';
import {
  generarContratoTrabajoPDF,
  numeroALetrasPY,
} from '../generators/employmentContractPdfGenerator';
import type { ContratoTrabajo, Empleado, EmpresaCliente } from '../types/clientPortal';

describe('Motor de Cálculo de Horas Extras y Recargos (Ley N.º 213/93)', () => {
  const salarioEjemplo = 3044000;
  const jornal = salarioEjemplo / 30; // 101.466,67
  const hora = jornal / 8; // 12.683,33

  it('debe parsear horas y jornadas correctamente', () => {
    expect(parseHoraMinutos('08:30')).toBe(8 * 60 + 30);
    expect(parseHoraMinutos('20:00')).toBe(20 * 60);
    expect(parseHoraMinutos('24:00')).toBe(24 * 60);
    expect(parseHoraMinutos('')).toBeNull();
    expect(parseHoraMinutos('invalido')).toBeNull();

    expect(parseJornada('5:50')).toBe(350);
    expect(parseJornada('8:00')).toBe(480);
    expect(parseJornada('')).toBe(0);
  });

  it('debe formatear minutos a cadena H:mm correctamente', () => {
    expect(formatearMinutosAHora(350)).toBe('5:50');
    expect(formatearMinutosAHora(90)).toBe('1:30');
    expect(formatearMinutosAHora(0)).toBe('0:00');
    expect(formatearMinutosAHora(-10)).toBe('0:00');
  });

  it('debe calcular día normal sin horas extras dentro de la jornada', () => {
    // Entrada 08:30, Salida 15:00, Descanso 40m.
    // Bruto = 6h 30m = 390 min. Neto = 390 - 40 = 350 min (5h 50m).
    // Jornada = 5:50 = 350 min. HE = 0, Recargo = 0.
    const dia: DiaMarcacionInput = {
      dia: 'Lunes',
      jornadaPactada: '5:50',
      horaEntrada: '08:30',
      horaSalida: '15:00',
      descansoMinutos: 40,
      esFeriado: false,
      esDiaLibreTrabajado: false,
    };

    const res = calcularDiaOvertime(dia, 0, salarioEjemplo);
    expect(res.minutosTrabajadosNetos).toBe(350);
    expect(res.he50Minutos).toBe(0);
    expect(res.he100Minutos).toBe(0);
    expect(res.he130Minutos).toBe(0);
    expect(res.recargoNocturnoMinutos).toBe(0);
    expect(res.montoGs).toBe(0);
    expect(res.estado).toBe('normal');
    expect(res.nota).toContain('Dentro de su jornada');
  });

  it('debe computar horas extras al 50% en día de semana diurno', () => {
    // Entrada 08:00, Salida 18:00 (10h = 600m), Descanso 60m -> Neto 540m (9h).
    // Jornada 8h = 480m. HE = 60 min (1h) diurna (Lunes).
    const dia: DiaMarcacionInput = {
      dia: 'Martes',
      jornadaPactada: '8:00',
      horaEntrada: '08:00',
      horaSalida: '18:00',
      descansoMinutos: 60,
      esFeriado: false,
      esDiaLibreTrabajado: false,
    };

    const res = calcularDiaOvertime(dia, 1, salarioEjemplo);
    expect(res.minutosTrabajadosNetos).toBe(540);
    expect(res.he50Minutos).toBe(60);
    expect(res.he100Minutos).toBe(0);
    expect(res.he130Minutos).toBe(0);
    expect(res.recargoNocturnoMinutos).toBe(0);
    // 1 hora al 50% = hora * 1.5 = 12683.33 * 1.5 = 19025 Gs
    expect(res.montoGs).toBe(Math.round(hora * 1.5));
  });

  it('debe computar horas extras al 100% en domingo o feriado', () => {
    // Domingo: Entrada 09:00, Salida 14:00 (5h = 300m), Descanso 0, Jornada 0h
    // Todas las 5h (300m) son HE al 100%
    const dia: DiaMarcacionInput = {
      dia: 'Domingo',
      jornadaPactada: '0:00',
      horaEntrada: '09:00',
      horaSalida: '14:00',
      descansoMinutos: 0,
      esFeriado: false,
      esDiaLibreTrabajado: false,
    };

    const res = calcularDiaOvertime(dia, 6, salarioEjemplo);
    expect(res.esDomingo).toBe(true);
    expect(res.minutosTrabajadosNetos).toBe(300);
    expect(res.he100Minutos).toBe(300);
    expect(res.he50Minutos).toBe(0);
    // 5 horas al 100% = 5 * hora * 2.0
    expect(res.montoGs).toBe(Math.round(5 * hora * 2.0));
  });

  it('debe computar HE nocturna al 130% y recargo nocturno del 30% después de las 20:00', () => {
    // Sábado: Entrada 08:30, Salida 21:00 (12h 30m = 750m), Descanso 70m -> Neto = 680m (11h 20m).
    // Jornada pactada: 8:00 (480m). HE total = 680 - 480 = 200m.
    // Minutos después de las 20:00 = de 20:00 a 21:00 = 60m.
    // HE nocturnas (h130) = min(he=200, after20=60) = 60m.
    // HE diurnas (h50) = 200 - 60 = 140m.
    // Recargo nocturno normales = after20(60) - heN(60) = 0.
    const dia: DiaMarcacionInput = {
      dia: 'Sábado',
      jornadaPactada: '8:00',
      horaEntrada: '08:30',
      horaSalida: '21:00',
      descansoMinutos: 70,
      esFeriado: false,
      esDiaLibreTrabajado: false,
    };

    const res = calcularDiaOvertime(dia, 5, salarioEjemplo);
    expect(res.minutosTrabajadosNetos).toBe(680);
    expect(res.he50Minutos).toBe(140);
    expect(res.he130Minutos).toBe(60);
    expect(res.recargoNocturnoMinutos).toBe(0);
    // h50: (140/60) * (hora * 1.5)
    // h130: (60/60) * (hora * 2.6)
    const esperadomonto = (140 / 60) * (hora * 1.5) + (60 / 60) * (hora * 2.6);
    expect(res.montoGs).toBe(Math.round(esperadomonto));
  });

  it('debe otorgar 1 jornal extra por feriado trabajado y 1 jornal por día libre trabajado', () => {
    const dia: DiaMarcacionInput = {
      dia: 'Viernes',
      jornadaPactada: '5:50',
      horaEntrada: '08:30',
      horaSalida: '15:00',
      descansoMinutos: 40,
      esFeriado: true,
      esDiaLibreTrabajado: true,
    };

    const res = calcularDiaOvertime(dia, 4, salarioEjemplo);
    expect(res.jornalesExtra).toBe(2);
    // 2 jornales = 2 * jornal
    expect(res.montoJornalesExtraGs).toBe(Math.round(2 * jornal));
    expect(res.nota).toContain('Feriado trabajado: +1 jornal');
    expect(res.nota).toContain('Día libre trabajado: +1 jornal');
  });

  it('debe calcular la semana completa consolidando totales correctamente', () => {
    const semana: DiaMarcacionInput[] = [
      { dia: 'Lunes', jornadaPactada: '5:50', horaEntrada: '08:30', horaSalida: '15:00', descansoMinutos: 40, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Martes', jornadaPactada: '5:50', horaEntrada: '08:30', horaSalida: '15:00', descansoMinutos: 40, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Miércoles', jornadaPactada: '5:50', horaEntrada: '08:30', horaSalida: '15:00', descansoMinutos: 40, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Jueves', jornadaPactada: '5:50', horaEntrada: '08:30', horaSalida: '15:00', descansoMinutos: 40, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Viernes', jornadaPactada: '5:50', horaEntrada: '08:30', horaSalida: '15:00', descansoMinutos: 40, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Sábado', jornadaPactada: '8:00', horaEntrada: '08:30', horaSalida: '21:00', descansoMinutos: 70, esFeriado: false, esDiaLibreTrabajado: false },
      { dia: 'Domingo', jornadaPactada: '0:00', horaEntrada: '', horaSalida: '', descansoMinutos: 0, esFeriado: false, esDiaLibreTrabajado: false },
    ];

    const res = calcularSemanaOvertime(salarioEjemplo, semana);
    expect(res.dias.length).toBe(7);
    expect(res.totales.totalHe50Minutos).toBe(140); // Del sábado
    expect(res.totales.totalHe130Minutos).toBe(60); // Del sábado
    expect(res.totales.totalMontoGs).toBeGreaterThan(0);
  });

  describe('Carga Directa Manual de Horas Extras (50%, 100%, 130%, Recargos)', () => {
    it('debe calcular con precisión la carga manual con decimales solicitada por el usuario (50%: 3.7h, 100%: 5h, 130%: 3h)', () => {
      // Salario 3.044.000 Gs.
      // Jornal = 101.466,67 Gs. | Hora = 12.683,33 Gs.
      // 50%  = 12.683,33 * 1.5 = 19.025 Gs./h
      // 100% = 12.683,33 * 2.0 = 25.367 Gs./h
      // 130% = 12.683,33 * 2.6 = 32.977 Gs./h
      const resultado = calcularOvertimeManual({
        salarioMensual: 3044000,
        horas50: 3.7,
        horas100: 5,
        horas130: 3,
        horasRecargoNocturno: 0,
        feriadosTrabajados: 0,
      });

      expect(resultado.horas50).toBe(3.7);
      expect(resultado.horas100).toBe(5);
      expect(resultado.horas130).toBe(3);
      expect(resultado.totalHorasExtras).toBe(11.7);

      // Verificación de subtotales
      expect(resultado.montoHoras50).toBe(Math.round(3.7 * hora * 1.5));
      expect(resultado.montoHoras100).toBe(Math.round(5 * hora * 2.0));
      expect(resultado.montoHoras130).toBe(Math.round(3 * hora * 2.6));

      // Total acumulado
      const esperado =
        Math.round(3.7 * hora * 1.5) +
        Math.round(5 * hora * 2.0) +
        Math.round(3 * hora * 2.6);
      expect(resultado.totalMontoGs).toBe(esperado);
    });

    it('debe computar recargo nocturno ordinario del 30% y feriados trabajados', () => {
      const resultado = calcularOvertimeManual({
        salarioMensual: 3044000,
        horas50: 0,
        horas100: 0,
        horas130: 0,
        horasRecargoNocturno: 4,
        feriadosTrabajados: 1,
      });

      expect(resultado.montoRecargoNocturno).toBe(Math.round(4 * hora * 0.3));
      expect(resultado.montoFeriados).toBe(Math.round(1 * jornal));
      expect(resultado.totalMontoGs).toBe(
        Math.round(4 * hora * 0.3) + Math.round(1 * jornal)
      );
    });

    it('debe manejar entradas vacías, ceros o nulas de forma segura sin romper cálculos', () => {
      const resultado = calcularOvertimeManual({
        salarioMensual: 0,
        horas50: 0,
        horas100: 0,
        horas130: 0,
      });
      expect(resultado.totalHorasExtras).toBe(0);
      expect(resultado.totalMontoGs).toBe(0);
    });
  });
});

describe('Generador de Contratos Formales Corporativos (8 Modalidades C.T.)', () => {
  const empresaMock: EmpresaCliente = {
    id: 'emp_1',
    razonSocial: 'COMERCIAL MODELO S.A.',
    ruc: '80012345',
    dv: '6',
    direccion: 'Avda. Mcal. López 1234 c/ Rca. Argentina',
    telefono: '(021) 600-000',
    emailCorporativo: 'contacto@empresa.com.py',
    ciudad: 'Asunción',
    representanteLegalNombre: 'Directorio General',
    representanteLegalCi: '1.234.567',
    activo: true,
    createdAt: '2026-01-01',
  };

  const empleadoMock: Empleado = {
    id: 'emp_juan',
    clienteId: 'emp_1',
    nombres: 'Francisco Javier',
    apellidos: 'Ibarrola Maciel',
    ci: '3.635.441',
    sexo: 'M',
    estadoCivil: 'Soltero/a',
    nacionalidad: 'paraguaya',
    domicilio: 'Humaitá e/ Ytororó 179, Mariano Roque Alonso',
    fechaNacimiento: '1995-05-10',
    fechaIngreso: '2026-01-23',
    cargo: 'Encargado de Tienda',
    departamento: 'Tienda',
    salarioBase: 3600000,
    modalidadPago: 'mensual',
    periodoPruebaDias: 30,
    vacacionesCausadasAcumuladas: 0,
    vacacionesTomadas: 0,
    hijosMenores: 0,
    estado: 'activo',
    createdAt: '2026-01-23',
  };

  it('debe convertir números a letras guaraníes correctamente', () => {
    expect(numeroALetrasPY(3600000)).toBe('TRES MILLONES SEISCIENTOS MIL GUARANÍES');
    expect(numeroALetrasPY(15000000)).toBe('QUINCE MILLONES GUARANÍES');
    expect(numeroALetrasPY(2800000)).toBe('DOS MILLONES OCHOCIENTOS MIL GUARANÍES');
    expect(numeroALetrasPY(0)).toBe('CERO GUARANÍES');
  });

  it('debe generar el PDF del contrato corporativo formal', () => {
    const contrato: ContratoTrabajo = {
      id: 'cto_1',
      clienteId: empresaMock.id,
      empleadoId: empleadoMock.id,
      tipoContrato: 'indefinido',
      fechaInicio: '2026-01-23',
      periodoPruebaDias: 30,
      salarioPactado: 3600000,
      jornadaLaboral: '48 horas semanales',
      horarioInicio: '08:00',
      horarioFin: '18:00',
      lugarPrestacion: empresaMock.direccion,
      seccionAsignada: 'TIENDA',
      estado: 'firmado',
      createdAt: '2026-01-23',
    };

    const doc = generarContratoTrabajoPDF(contrato, empleadoMock, empresaMock);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('debe generar el contrato con Cláusula de Absorción y Reconocimiento de Antigüedad', () => {
    const contratoConAbsorcion: ContratoTrabajo = {
      id: 'cto_2',
      clienteId: empresaMock.id,
      empleadoId: empleadoMock.id,
      tipoContrato: 'indefinido',
      fechaInicio: '2026-01-23',
      periodoPruebaDias: 30,
      salarioPactado: 3600000,
      jornadaLaboral: '48 horas semanales',
      horarioInicio: '08:00',
      horarioFin: '18:00',
      lugarPrestacion: empresaMock.direccion,
      seccionAsignada: 'TIENDA',
      absorcionAntiguedad: {
        empresaAnterior: 'EMPRESA ANTERIOR S.A.',
        fechaIngresoAnterior: '01/07/2021',
      },
      estado: 'firmado',
      createdAt: '2026-01-23',
    };

    const doc = generarContratoTrabajoPDF(contratoConAbsorcion, empleadoMock, empresaMock);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});
