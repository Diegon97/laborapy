/**
 * TESTS UNITARIOS — PORTAL DE CLIENTES (ERP LABORAPY)
 * Verificación de cálculos conforme a la Ley N.º 213/93, Decreto-Ley N.º 1860/50 y REOP
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcularReciboSalario,
  getDashboardMetrics,
  SALARIO_MINIMO_LEGAL_PY,
  calcularDiasVacacionesSegunAntiguedad,
  saveRegistroVacacion,
  marcarVacacionComunicadaMtess,
  getVacacionesByCliente,
  generarPlanillaVacacionesMtessCSV,
  calcularAlertaAntiguedadEmpleado,
  saveConfiguracionAntiguedad,
  getConfiguracionAntiguedad,
  calcularCronogramaMaternidadLactancia,
  saveRegistroMaternidad,
  getRegistrosMaternidadByCliente,
  agregarCertificadoLactanciaTrimestral,
  getAlertasMaternidadLactancia,
  deleteRegistroMaternidad,
  saveEmpresaCliente,
  saveEmpleado,
  getAdendasByCliente,
  saveAdendaContrato,
  deleteAdendaContrato,
  getSiguienteNroAdenda,
} from '../services/clientStorageService';
import {
  generarIpsPrn,
  generarIpsReiTxt,
  generarArchivoAcreditacionBancaria,
} from '../generators/ipsReiTxtGenerator';
import {
  generarNotaConcesionVacacionesPDF,
  calcularLiquidacionVacaciones,
  formatGuaranies,
  formatGs,
  sumarDiasISO,
} from '../generators/vacationNoticePdfGenerator';
import { generarConstanciaMaternidadPDF } from '../generators/maternityNoticePdfGenerator';
import { generarAdendaContratoPDF } from '../generators/addendumPdfGenerator';
import {
  generateTelegramPDF,
  validateAbsencesLaborLaw,
  formatAbsenceDatesToSpanish,
  formatCiNumber,
} from '../generators/telegramPdfGenerator';
import {
  sanitizeExcelValue,
  cleanCiNumber,
  generarLibroNominaExcel,
  generarLibroPlantillaExcel,
  parseAndValidateExcelNomina,
} from '../services/employeeExcelService';
import * as XLSX from 'xlsx';
import {
  loginClient,
  logoutClient,
  getClientSession,
  checkLockout,
  resetLockout,
  registerClientUser,
  setClientUserPassword,
  getRememberedEmail,
  setRememberedEmail,
  requestClientPasswordReset,
  confirmClientPasswordReset,
  updateCurrentEmpresa,
  isDemoLoginEnabled,
  setDemoLoginEnabled,
} from '../services/clientAuthService';
import { calcularDV, formatearPatronalIps } from '../components/CompanyProfileTab';
import type {
  Empleado,
  EmpresaCliente,
  RegistroVacacion,
  ConfiguracionAntiguedad,
  RegistroMaternidad,
  CertificadoLactanciaTrimestral,
  AdendaContrato,
} from '../types/clientPortal';

const EMPRESA_TEST: EmpresaCliente = {
  id: 'emp_test_01',
  ruc: '80012345',
  dv: '6',
  razonSocial: 'PARAGUAY TEST EMPRESA S.A.',
  direccion: 'Asunción, Paraguay',
  telefono: '(021) 123-456',
  emailCorporativo: 'test@empresa.com.py',
  // El numero patronal del IPS es siempre de 10 digitos numericos. El valor anterior
  // ("IPS-999888") no era una patronal valida y el motor ahora lo rechaza con PATRONAL_INVALIDA
  // en lugar de emitirlo dentro del archivo.
  nroPatronalIps: '0009998881',
  nroPatronalMtess: 'MTESS-777',
  representanteLegalNombre: 'Juan Director',
  representanteLegalCi: '1.234.567',
  activo: true,
  createdAt: '2026-01-01',
};

const EMPLEADO_TEST: Empleado = {
  id: 'emp_t1',
  clienteId: 'emp_test_01',
  ci: '4.000.000',
  nombres: 'Carlos',
  apellidos: 'López',
  nacionalidad: 'Paraguaya',
  estadoCivil: 'Casado/a',
  sexo: 'M',
  hijosMenores: 2, // 2 hijos -> 10% del salario mínimo en bonificación familiar
  cargo: 'Analista de Sistemas',
  departamento: 'TI',
  fechaIngreso: '2022-01-15',
  salarioBase: 4000000,
  modalidadPago: 'mensual',
  estado: 'activo',
  periodoPruebaDias: 60,
  vacacionesCausadasAcumuladas: 18,
  vacacionesTomadas: 6,
  createdAt: '2022-01-15',
};

beforeEach(() => {
  setDemoLoginEnabled(true);
});

describe('Módulo Client Portal - Recibos de Salario (Art. 235 y 236)', () => {
  it('calcula correctamente la retención obligatoria del 9% de IPS obrero y la bonificación familiar', () => {
    const recibo = calcularReciboSalario(EMPLEADO_TEST, 8, 2026, {
      diasTrabajados: 30,
      horasExtras50Cant: 10,
      horasExtras100Cant: 0,
    });

    // Salario devengado
    expect(recibo.salarioDevengado).toBe(4000000);

    // Valor hora: (4.000.000 / 30) / 8 = 16.666,67 Gs/hora
    // Horas extras 50%: 10 * 16.666,67 * 1.5 = 250.000 Gs
    expect(recibo.horasExtras50Monto).toBe(250000);

    // Bonificación familiar: 2 hijos * 5% de salario mínimo legal
    const bonifEsperada = Math.round(SALARIO_MINIMO_LEGAL_PY * 0.05) * 2;
    expect(recibo.bonificacionFamiliar).toBe(bonifEsperada);

    // Base imponible IPS: Salario (4.000.000) + Horas Extras (250.000) = 4.250.000
    // Aporte IPS Obrero 9%: 4.250.000 * 0.09 = 382.500
    expect(recibo.ipsObrero9).toBe(382500);

    // Total ingresos brutos
    expect(recibo.totalIngresosBrutos).toBe(4000000 + 250000 + bonifEsperada);

    // Salario neto
    expect(recibo.salarioNeto).toBe(recibo.totalIngresosBrutos - 382500);
    expect(recibo.salarioNetoLetras).toContain('GUARANÍES');
  });

  it('respeta días proporcionales si el trabajador trabajó menos de 30 días', () => {
    const recibo = calcularReciboSalario(EMPLEADO_TEST, 8, 2026, {
      diasTrabajados: 15,
    });

    expect(recibo.salarioDevengado).toBe(2000000);
    expect(recibo.ipsObrero9).toBe(180000); // 9% de 2.000.000
  });
});

describe('Módulo IPS - Generador de Archivo Plano REI (TXT)', () => {
  it('genera estructura válida con cabecera (Tipo 1), detalle (Tipo 2) y control (Tipo 3)', () => {
    const recibo = calcularReciboSalario(EMPLEADO_TEST, 8, 2026);
    const resultado = generarIpsReiTxt([recibo], [EMPLEADO_TEST], EMPRESA_TEST, 8, 2026);

    expect(resultado.fileName).toBe('IPS_REI_80012345_202608.txt');
    expect(resultado.totalEmpleados).toBe(1);
    expect(resultado.totalSalariosImponibles).toBe(4000000);
    expect(resultado.totalAporteObrero9).toBe(360000); // 9%
    expect(resultado.totalAportePatronal165).toBe(660000); // 16.5%
    expect(resultado.totalAporteIps255).toBe(1020000); // 25.5%

    // El archivo termina con CRLF; se filtran los tramos vacios para no contar el salto final.
    const lineas = resultado.content.split('\r\n').filter((linea) => linea.length > 0);
    expect(lineas.length).toBe(3);
    expect(lineas[0]).toContain('1|IPS-REI|80012345|6|0009998881|202608');
    expect(lineas[1]).toContain('2|CI|4000000');
    expect(lineas[2]).toContain('3|CONTROL|202608');
  });

  it('genera archivo de nómina bancaria con formato delimitado para acreditaciones', () => {
    const recibo = calcularReciboSalario(EMPLEADO_TEST, 8, 2026);
    const { fileName, content } = generarArchivoAcreditacionBancaria([recibo], [EMPLEADO_TEST], EMPRESA_TEST, 8, 2026);

    expect(fileName).toBe('NOMINA_BANCO_80012345_202608.csv');
    expect(content).toContain('80012345;PARAGUAY TEST EMPRESA S.A.;202608;CI;4000000');
  });
});

describe('Módulo Client Portal - Autenticación y Sesión', () => {
  it('permite iniciar sesión con credenciales demo predeterminadas', async () => {
    logoutClient();
    expect(getClientSession()).toBeNull();

    const res = await loginClient('cliente@laborapy.com', 'Cliente2026!');
    expect(res.success).toBe(true);
    expect(res.session).toBeDefined();
    expect(res.session?.usuario.email).toBe('cliente@laborapy.com');
    expect(res.session?.empresa).toBeDefined();

    const stored = getClientSession();
    expect(stored?.usuario.email).toBe('cliente@laborapy.com');
  });

  it('bloquea el acceso de prueba cuando isDemoLoginEnabled está deshabilitado', async () => {
    setDemoLoginEnabled(false);
    expect(isDemoLoginEnabled()).toBe(false);

    // Intento con credenciales demo mientras el interruptor está desactivado
    const res = await loginClient('cliente@laborapy.com', 'Cliente2026!');
    expect(res.success).toBe(false);
    expect(res.error).toContain('temporalmente deshabilitado');

    // Restaurar para los tests subsiguientes
    setDemoLoginEnabled(true);
    expect(isDemoLoginEnabled()).toBe(true);
  });

  it('rechaza intentos con campos vacíos', async () => {
    const res1 = await loginClient('', 'Cliente2026!');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('complete todos los campos');

    const res2 = await loginClient('cliente@laborapy.com', '');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('complete todos los campos');
  });

  it('bloquea por fuerza bruta tras 5 intentos fallidos consecutivos', async () => {
    const testEmail = 'fuerza_bruta_test@empresa.com.py';
    resetLockout(testEmail);
    expect(checkLockout(testEmail).isLocked).toBe(false);

    // 4 intentos fallidos
    for (let i = 1; i <= 4; i++) {
      const res = await loginClient(testEmail, `ClaveErronea${i}`);
      expect(res.success).toBe(false);
      expect(checkLockout(testEmail).isLocked).toBe(false);
    }

    // 5to intento fallido activa el bloqueo
    const res5 = await loginClient(testEmail, 'ClaveErronea5');
    expect(res5.success).toBe(false);
    expect(res5.error).toContain('bloqueada');

    const lockStatus = checkLockout(testEmail);
    expect(lockStatus.isLocked).toBe(true);
    expect(lockStatus.remainingSeconds).toBeGreaterThan(0);

    // Intento subsecuente es rechazado de inmediato por bloqueo
    const resBloqueado = await loginClient(testEmail, 'CualquierClave');
    expect(resBloqueado.success).toBe(false);
    expect(resBloqueado.error).toContain('Cuenta bloqueada temporalmente');

    // Desbloqueo manual / reset
    resetLockout(testEmail);
    expect(checkLockout(testEmail).isLocked).toBe(false);
  });

  it('permite registrar y autenticar usuarios clientes con contraseña cifrada SHA-256', async () => {
    const customEmail = 'rrhh.director@corporacion.com.py';
    const plainPass = 'Corporacion2026!#';

    resetLockout(customEmail);

    // Registrar usuario con contraseña en hash
    const nuevoUsuario = await registerClientUser(
      {
        id: 'usr_corp_001',
        clienteId: 'emp_guarani_001',
        email: customEmail,
        nombreContacto: 'Dra. Patricia Benítez',
        cargoContacto: 'Directora de Talento Humano',
        rol: 'cliente_admin',
        activo: true,
      },
      plainPass
    );

    expect(nuevoUsuario.passwordHash).toBeDefined();
    // SHA-256 produce un hash hexadecimal de 64 caracteres
    expect(nuevoUsuario.passwordHash?.length).toBe(64);
    expect(nuevoUsuario.passwordHash).not.toBe(plainPass);

    // Autenticación con contraseña errónea falla
    const resErr = await loginClient(customEmail, 'ClaveEquivocada');
    expect(resErr.success).toBe(false);

    // Autenticación con contraseña correcta triunfa
    const resOk = await loginClient(customEmail, plainPass);
    expect(resOk.success).toBe(true);
    expect(resOk.session?.usuario.email).toBe(customEmail);
    expect(resOk.session?.empresa.id).toBe('emp_guarani_001');

    // Cambiar contraseña con setClientUserPassword
    const newPass = 'NuevaClaveSegura2026!';
    const changed = await setClientUserPassword(customEmail, newPass);
    expect(changed).toBe(true);

    // La contraseña antigua ya no funciona
    const resOld = await loginClient(customEmail, plainPass);
    expect(resOld.success).toBe(false);

    // La nueva contraseña sí funciona
    resetLockout(customEmail);
    const resNew = await loginClient(customEmail, newPass);
    expect(resNew.success).toBe(true);
  });

  it('guarda y limpia correctamente el correo recordado (Recordar mis datos)', () => {
    setRememberedEmail('remember_test@empresa.com.py', true);
    expect(getRememberedEmail()).toBe('remember_test@empresa.com.py');

    // Desmarcar preferencia
    setRememberedEmail('remember_test@empresa.com.py', false);
    expect(getRememberedEmail()).toBe('');
  });

  it('ejecuta el protocolo de recuperación de contraseña ("Olvidé mi contraseña")', async () => {
    const emailRec = 'recuperacion@guaranilogistica.com.py';
    // Registrar usuario
    await registerClientUser(
      {
        id: 'usr_rec_01',
        clienteId: 'emp_guarani_001',
        email: emailRec,
        nombreContacto: 'Ing. Fernando Ayala',
        rol: 'cliente_admin',
        activo: true,
      },
      'ClaveOriginal2026!'
    );

    // 1) Solicitar token para email no registrado falla
    const resInvalido = await requestClientPasswordReset('no_existe@empresa.com.py');
    expect(resInvalido.success).toBe(false);
    expect(resInvalido.error).toContain('No se encontró ninguna empresa cliente');

    // 2) Solicitar token para email válido genera código de 6 dígitos
    const resValido = await requestClientPasswordReset(emailRec);
    expect(resValido.success).toBe(true);
    expect(resValido.token).toBeDefined();
    expect(resValido.token?.length).toBe(6);

    const token = resValido.token!;

    // 3) Confirmar con contraseña muy corta (<6 caracteres) falla
    const resCorta = await confirmClientPasswordReset(emailRec, token, '123');
    expect(resCorta.success).toBe(false);
    expect(resCorta.error).toContain('al menos 6 caracteres');

    // 4) Confirmar con código erróneo falla
    const resTokenErr = await confirmClientPasswordReset(emailRec, '999999', 'NuevaClaveValida2026!');
    expect(resTokenErr.success).toBe(false);
    expect(resTokenErr.error).toContain('incorrecto');

    // 5) Confirmar con código correcto actualiza contraseña
    const resOk = await confirmClientPasswordReset(emailRec, token, 'NuevaClaveValida2026!');
    expect(resOk.success).toBe(true);

    // 6) Iniciar sesión con la nueva contraseña funciona
    const loginOk = await loginClient(emailRec, 'NuevaClaveValida2026!');
    expect(loginOk.success).toBe(true);

    // 7) El token usado ya no se puede reutilizar
    const resReuso = await confirmClientPasswordReset(emailRec, token, 'OtraClave2026!');
    expect(resReuso.success).toBe(false);
  });

  it('calcula métricas y costo real patronal en el dashboard', () => {
    const metrics = getDashboardMetrics('emp_guarani_001');
    expect(metrics.totalEmpleadosActivos).toBeGreaterThan(0);
    expect(metrics.totalIpsPatronal165).toBeGreaterThan(0);
    expect(metrics.costoRealPatronalTotal).toBeGreaterThan(metrics.masaSalarialBruta);
    expect(metrics.porcentajeSobrecosto).toBeGreaterThan(20);
    expect(metrics.alertasAntiguedad).toBeDefined();
    expect(metrics.configAntiguedad).toBeDefined();
  });
});

describe('Módulo Vacaciones - Escala Legal y Control Real vs MTESS (Arts. 218 a 226)', () => {
  it('calcula la escala legal de días de vacaciones según Art. 218 de la Ley N.º 213/93', () => {
    // 0.5 años -> 0 días (no causadas de escala anual completa)
    const d0 = calcularDiasVacacionesSegunAntiguedad('2026-03-01', new Date('2026-09-01'));
    expect(d0.diasEscala).toBe(0);

    // 3 años -> 12 días corridos (1 a 5 años)
    const d3 = calcularDiasVacacionesSegunAntiguedad('2023-01-01', new Date('2026-01-01'));
    expect(d3.diasEscala).toBe(12);

    // 5 años exactos -> 12 días corridos
    const d5 = calcularDiasVacacionesSegunAntiguedad('2021-01-01', new Date('2026-01-01'));
    expect(d5.diasEscala).toBe(12);

    // 7 años -> 18 días corridos (más de 5 a 10 años)
    const d7 = calcularDiasVacacionesSegunAntiguedad('2019-01-01', new Date('2026-01-01'));
    expect(d7.diasEscala).toBe(18);

    // 12 años -> 30 días corridos (más de 10 años)
    const d12 = calcularDiasVacacionesSegunAntiguedad('2014-01-01', new Date('2026-01-01'));
    expect(d12.diasEscala).toBe(30);
  });

  it('genera la nota formal de concesión de vacaciones en PDF con mención a Arts. 218 y 222', () => {
    const regVac: RegistroVacacion = {
      id: 'vac_t1',
      clienteId: EMPRESA_TEST.id,
      empleadoId: EMPLEADO_TEST.id,
      periodoAnho: 2025,
      diasCorrespondientes: 18,
      fechaInicioReal: '2026-10-01',
      fechaFinReal: '2026-10-18',
      diasUsufructuadosReal: 18,
      diasPendientesReal: 0,
      estadoReal: 'gozado',
      fechaLimiteUsufructo: '2026-12-31',
      comunicadoMtess: false,
      createdAt: '2026-09-01',
    };

    const doc = generarNotaConcesionVacacionesPDF(regVac, EMPLEADO_TEST, EMPRESA_TEST);
    expect(doc).toBeDefined();
    // One-Page Fit garantizado (exactamente 1 página)
    expect(doc.getNumberOfPages()).toBe(1);

    // Debe contener el texto de validación y sello digital
    const pdfText = doc.output();
    expect(pdfText).toContain('RECIBO DE VACACIONES');
    expect(pdfText).toContain('validar=1');
    expect(pdfText).toContain('tipo=vacaciones');
  });

  it('genera correctamente el recibo de vacaciones adelantadas con autorización patronal en 1 página', () => {
    const regAdelantada: RegistroVacacion = {
      id: 'vac_adelantada_1',
      clienteId: EMPRESA_TEST.id,
      empleadoId: EMPLEADO_TEST.id,
      periodoAnho: 2026,
      diasCorrespondientes: 12,
      fechaInicioReal: '2026-11-01',
      fechaFinReal: '2026-11-12',
      diasUsufructuadosReal: 12,
      diasPendientesReal: 0,
      estadoReal: 'gozado',
      fechaLimiteUsufructo: '2027-06-30',
      comunicadoMtess: false,
      esAdelantada: true,
      autorizadoPorEmpleador: true,
      createdAt: '2026-09-10',
    };

    const doc = generarNotaConcesionVacacionesPDF(regAdelantada, EMPLEADO_TEST, EMPRESA_TEST);
    expect(doc).toBeDefined();
    // One-Page Fit garantizado
    expect(doc.getNumberOfPages()).toBe(1);

    const pdfText = doc.output();
    expect(pdfText).toContain('VACACIONES ADELANTADAS');
    expect(pdfText).toContain('validar=1');
    expect(pdfText).toContain('tipo=vacaciones');
  });

  it('calcula correctamente la liquidación económica de vacaciones (Art. 225 C.T.) con retención IPS 9%', () => {
    // Salario de ₲ 3.000.000 / 30 = ₲ 100.000 jornal. 12 días = ₲ 1.200.000 bruto. IPS 9% = ₲ 108.000. Neto = ₲ 1.092.000.
    const liq = calcularLiquidacionVacaciones(3000000, 12);
    expect(liq.salarioMensual).toBe(3000000);
    expect(liq.salarioDiario).toBe(100000);
    expect(liq.importeBruto).toBe(1200000);
    expect(liq.aporteIps).toBe(108000);
    expect(liq.netoPercibir).toBe(1092000);
    expect(liq.diasUsufructuados).toBe(12);

    expect(formatGuaranies(1092000)).toBe('₲ 1.092.000');
    expect(formatGuaranies(0)).toBe('₲ 0');

    // formatGs para jsPDF seguro (sin romper caracteres WinAnsi)
    expect(formatGs(1092000)).toBe('Gs. 1.092.000');
    expect(formatGs(0)).toBe('Gs. 0');
    expect(formatGs(-100000)).toBe('-Gs. 100.000');

    // Suma de días ISO para cronograma
    expect(sumarDiasISO('2026-10-01', 11)).toBe('2026-10-12');
  });

  it('genera planilla CSV estructurada para comunicación de vacaciones al MTESS (REOP)', () => {
    const regVac: RegistroVacacion = {
      id: 'vac_t2',
      clienteId: EMPRESA_TEST.id,
      empleadoId: EMPLEADO_TEST.id,
      periodoAnho: 2025,
      diasCorrespondientes: 18,
      fechaInicioReal: '2026-07-01',
      fechaFinReal: '2026-07-18',
      diasUsufructuadosReal: 18,
      diasPendientesReal: 0,
      estadoReal: 'gozado',
      fechaLimiteUsufructo: '2026-12-31',
      comunicadoMtess: true,
      nroComprobanteMtess: 'REOP-VAC-202607-1234',
      mesComunicacionMtess: '2026-07',
      createdAt: '2026-07-01',
    };

    const csv = generarPlanillaVacacionesMtessCSV([regVac], [EMPLEADO_TEST], EMPRESA_TEST);
    expect(csv).toContain('RUC_EMPRESA;PATRONAL_MTESS;DOCUMENTO_CI;APELLIDOS_NOMBRES');
    expect(csv).toContain('4.000.000');
    expect(csv).toContain('REOP-VAC-202607-1234');
    expect(csv).toContain('COMUNICADO_REOP');
  });

  it('permite marcar una vacación como comunicada al MTESS con su comprobante oficial', () => {
    const regVac: RegistroVacacion = {
      id: 'vac_unit_test',
      clienteId: 'emp_guarani_001',
      empleadoId: 'emp_01',
      periodoAnho: 2025,
      diasCorrespondientes: 18,
      diasUsufructuadosReal: 6,
      diasPendientesReal: 12,
      estadoReal: 'fraccionado',
      fechaLimiteUsufructo: '2026-12-31',
      comunicadoMtess: false,
      createdAt: '2026-08-01',
    };

    saveRegistroVacacion(regVac);
    marcarVacacionComunicadaMtess('vac_unit_test', 'REOP-TEST-999', '2026-08', 6);

    const vacs = getVacacionesByCliente('emp_guarani_001');
    const actualizada = vacs.find(v => v.id === 'vac_unit_test');
    expect(actualizada?.comunicadoMtess).toBe(true);
    expect(actualizada?.nroComprobanteMtess).toBe('REOP-TEST-999');
    expect(actualizada?.mesComunicacionMtess).toBe('2026-08');
    expect(actualizada?.diasComunicadosMtess).toBe(6);
  });
});

describe('Módulo Alertas de Antigüedad y Estabilidad Especial (Art. 94 Ley N.º 213/93)', () => {
  const hoyRef = new Date('2026-09-01');

  it('aplica umbrales predeterminados de 9 años para hombres y 8 años para mujeres', () => {
    const configDefecto: ConfiguracionAntiguedad = {
      umbralAnhosHombres: 9,
      umbralAnhosMujeres: 8,
    };

    // Varón con 8.5 años de servicio (ingreso 2018-03-01 -> 8.5 años a sept 2026) -> NO alcanza umbral de 9
    const empVaron85: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_v85',
      sexo: 'M',
      fechaIngreso: '2018-03-01',
    };
    const alertaVaron85 = calcularAlertaAntiguedadEmpleado(empVaron85, configDefecto, hoyRef);
    expect(alertaVaron85.umbralAplicadoAnhos).toBe(9);
    expect(alertaVaron85.alcanzoUmbral).toBe(false);

    // Varón con 9.4 años de servicio (ingreso 2017-04-01) -> SÍ alcanza umbral de 9
    const empVaron94: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_v94',
      sexo: 'M',
      fechaIngreso: '2017-04-01',
    };
    const alertaVaron94 = calcularAlertaAntiguedadEmpleado(empVaron94, configDefecto, hoyRef);
    expect(alertaVaron94.umbralAplicadoAnhos).toBe(9);
    expect(alertaVaron94.alcanzoUmbral).toBe(true);
    expect(alertaVaron94.nivelRiesgo).toBe('alerta_preventiva');

    // Mujer con 7.5 años de servicio (ingreso 2019-03-01) -> NO alcanza umbral de 8
    const empMujer75: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_m75',
      sexo: 'F',
      fechaIngreso: '2019-03-01',
    };
    const alertaMujer75 = calcularAlertaAntiguedadEmpleado(empMujer75, configDefecto, hoyRef);
    expect(alertaMujer75.umbralAplicadoAnhos).toBe(8);
    expect(alertaMujer75.alcanzoUmbral).toBe(false);

    // Mujer con 8.3 años de servicio (ingreso 2018-05-01) -> SÍ alcanza umbral de 8
    const empMujer83: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_m83',
      sexo: 'F',
      fechaIngreso: '2018-05-01',
    };
    const alertaMujer83 = calcularAlertaAntiguedadEmpleado(empMujer83, configDefecto, hoyRef);
    expect(alertaMujer83.umbralAplicadoAnhos).toBe(8);
    expect(alertaMujer83.alcanzoUmbral).toBe(true);
  });

  it('identifica situación crítica cuando faltan menos de 6 meses para los 10 años', () => {
    const configDefecto: ConfiguracionAntiguedad = {
      umbralAnhosHombres: 9,
      umbralAnhosMujeres: 8,
    };

    // Ingreso 2016-11-01 -> a sept 2026 tiene 9 años y 10 meses -> Faltan 2 meses para estabilidad
    const empCritico: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_crit',
      sexo: 'M',
      fechaIngreso: '2016-11-01',
    };
    const alertaCritica = calcularAlertaAntiguedadEmpleado(empCritico, configDefecto, hoyRef);
    expect(alertaCritica.nivelRiesgo).toBe('critico_proximo_10');
    expect(alertaCritica.tiempoRestanteParaEstabilidadTexto).toContain('CRÍTICO');
  });

  it('identifica cuando el trabajador ya consolidó la estabilidad especial propia (>= 10 años)', () => {
    const configDefecto: ConfiguracionAntiguedad = {
      umbralAnhosHombres: 9,
      umbralAnhosMujeres: 8,
    };

    // Ingreso 2014-01-01 -> a sept 2026 tiene 12 años
    const empEstable: Empleado = {
      ...EMPLEADO_TEST,
      id: 'emp_est',
      sexo: 'M',
      fechaIngreso: '2014-01-01',
    };
    const alertaEstable = calcularAlertaAntiguedadEmpleado(empEstable, configDefecto, hoyRef);
    expect(alertaEstable.nivelRiesgo).toBe('estable_adquirida');
    expect(alertaEstable.mensajeEstrategico).toContain('estabilidad especial propia (Art. 94)');
  });

  it('permite configurar umbrales personalizados por empresa', () => {
    const configPersonalizada: ConfiguracionAntiguedad = {
      umbralAnhosHombres: 7, // Empresa decide alertar a los 7 años
      umbralAnhosMujeres: 6, // y a los 6 años para mujeres
    };

    saveConfiguracionAntiguedad(EMPRESA_TEST.id, configPersonalizada);
    const guardada = getConfiguracionAntiguedad(EMPRESA_TEST.id);
    expect(guardada.umbralAnhosHombres).toBe(7);
    expect(guardada.umbralAnhosMujeres).toBe(6);

    const empVaron72: Empleado = {
      ...EMPLEADO_TEST,
      clienteId: EMPRESA_TEST.id,
      sexo: 'M',
      fechaIngreso: '2019-06-01', // 7.2 años a sept 2026
    };
    const alerta = calcularAlertaAntiguedadEmpleado(empVaron72, guardada, hoyRef);
    expect(alerta.alcanzoUmbral).toBe(true);
    expect(alerta.umbralAplicadoAnhos).toBe(7);
  });
});

describe('Módulo Client Portal - Maternidad, Lactancia (90 min) y Alertas Trimestrales (Ley 5508/15 y 7097/23)', () => {
  const EMPLEADA_FEM: Empleado = {
    ...EMPLEADO_TEST,
    id: 'emp_fem_test',
    sexo: 'F',
    nombres: 'María Elena',
    apellidos: 'Villar',
    ci: '4.888.777',
    fechaIngreso: '2023-03-01',
    cargo: 'Contadora Jr.',
    departamento: 'Administración',
  };

  it('calcula con precisión matemática los 126 días corridos (18 semanas) de reposo y la fecha de reincorporación (Ley 5508/15)', () => {
    // FPP: 15 de octubre de 2026. Anticipo: 14 días pre-parto -> Inicio: 01 de octubre de 2026
    const crono = calcularCronogramaMaternidadLactancia('2026-10-15', '2026-05-10', undefined, 14);

    expect(crono.fechaInicioReposo).toBe('2026-10-01');
    expect(crono.diasReposoCorridos).toBe(126);

    // Del 2026-10-01 al 2027-02-03 son exactamente 126 días corridos:
    // Octubre (31 días): 31 días corridos
    // Noviembre (30 días): 30 días corridos
    // Diciembre (31 días): 31 días corridos
    // Enero (31 días): 31 días corridos
    // Febrero (3 días): 3 días corridos -> Total: 31 + 30 + 31 + 31 + 3 = 126 días!
    expect(crono.fechaFinReposo).toBe('2027-02-03');

    // Reincorporación al día hábil siguiente
    expect(crono.fechaReincorporacionTrabajo).toBe('2027-02-04');
  });

  it('calcula la fecha de culminación de los 6 meses obligatorios y el tope legal de 24 meses de lactancia (Ley 7097/23)', () => {
    const crono = calcularCronogramaMaternidadLactancia('2026-04-10', '2026-01-10', '2026-04-10');

    // 6 meses de lactancia obligatoria de 90 min/día
    expect(crono.fechaFinLactanciaObligatoria).toBe('2026-10-10');

    // Tope legal máximo: 24 meses (2 años de edad del recién nacido)
    expect(crono.fechaLimiteMaximoLactancia24Meses).toBe('2028-04-10');

    // 6 trimestres recomendados de renovación médica pediátrica
    expect(crono.fechasRecomendadasCertificadosTrimestrales).toHaveLength(6);
    expect(crono.fechasRecomendadasCertificadosTrimestrales[0]).toEqual({
      nroTrimestre: 1,
      mesVidaBebe: 9,
      fechaLimitePresentacion: '2027-01-10',
    });
    expect(crono.fechasRecomendadasCertificadosTrimestrales[5]).toEqual({
      nroTrimestre: 6,
      mesVidaBebe: 24,
      fechaLimitePresentacion: '2028-04-10',
    });
  });

  it('permite guardar y gestionar un registro de maternidad con sincronización en Empleado', () => {
    const crono = calcularCronogramaMaternidadLactancia('2026-12-01', '2026-08-01');

    const reg: RegistroMaternidad = {
      id: 'mat_test_01',
      clienteId: EMPRESA_TEST.id,
      empleadoId: EMPLEADA_FEM.id,
      estado: 'embarazada',
      fechaNotificacionEmbarazo: '2026-08-01',
      fechaProbablePartoFPP: '2026-12-01',
      fechaInicioReposo: crono.fechaInicioReposo,
      fechaFinReposo: crono.fechaFinReposo,
      fechaReincorporacionTrabajo: crono.fechaReincorporacionTrabajo,
      subsidioIpsEstado: 'pendiente',
      modalidadLactancia: 'salida_temprana_90min',
      fechaFinLactanciaObligatoria: crono.fechaFinLactanciaObligatoria,
      deseaExtensionLactancia: true,
      fechaLimiteMaximoLactancia24Meses: crono.fechaLimiteMaximoLactancia24Meses,
      certificadosTrimestrales: [],
      fueroMaternalActivo: true,
      fechaFinEstimadaFuero: crono.fechaFinLactanciaObligatoria,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z',
    };

    saveRegistroMaternidad(reg);
    const registros = getRegistrosMaternidadByCliente(EMPRESA_TEST.id);
    const encontrado = registros.find(m => m.id === 'mat_test_01');

    expect(encontrado).toBeDefined();
    expect(encontrado?.estado).toBe('embarazada');
    expect(encontrado?.modalidadLactancia).toBe('salida_temprana_90min');
    expect(encontrado?.fueroMaternalActivo).toBe(true);
  });

  it('agrega un certificado trimestral y actualiza la vigencia y prórroga', () => {
    const cert: CertificadoLactanciaTrimestral = {
      id: 'cert_t1',
      nroTrimestre: 1,
      fechaPresentacion: '2026-10-01',
      fechaVencimiento: '2027-01-01',
      medicoPediatra: 'Dr. Fernando Acosta',
      registroProfesional: '15.920',
      observaciones: 'Lactancia exclusiva en curso',
      esVigente: true,
    };

    agregarCertificadoLactanciaTrimestral('mat_test_01', cert);
    const registros = getRegistrosMaternidadByCliente(EMPRESA_TEST.id);
    const reg = registros.find(m => m.id === 'mat_test_01');

    expect(reg?.estado).toBe('lactancia_extendida');
    expect(reg?.certificadosTrimestrales).toHaveLength(1);
    expect(reg?.certificadosTrimestrales[0].esVigente).toBe(true);
    expect(reg?.proximoVencimientoCertificado).toBe('2027-01-01');
  });

  it('genera alertas preventivas de reposo próximo a iniciar y lactancia por vencer', () => {
    // Alerta de reposo próximo a iniciar en 10 días
    const hoySimulado = new Date(2026, 8, 9); // 09 de septiembre de 2026
    const alertas = getAlertasMaternidadLactancia('emp_guarani_001', hoySimulado);

    expect(alertas.length).toBeGreaterThan(0);

    // Debe existir alerta para emp_05 (embarazo con reposo próximo a iniciar el 09-09)
    const alertaReposo = alertas.find(a => a.tipoAlerta === 'reposo_proximo_inicio');
    expect(alertaReposo).toBeDefined();
    expect(alertaReposo?.titulo).toContain('Reposo de Maternidad (18 sem) próximo');

    // Debe existir alerta para emp_02 (bebé cumple 6 meses el 25/09/2026)
    const alerta6m = alertas.find(a => a.tipoAlerta === 'lactancia_6meses_por_vencer');
    expect(alerta6m).toBeDefined();
    expect(alerta6m?.descripcion).toContain('Certificado Médico Pediátrico Trimestral');
  });

  it('detecta vencimiento crítico cuando un certificado trimestral no fue renovado', () => {
    // Fecha en que el certificado de Mirtha Giménez ya haya vencido (noviembre 2026)
    const hoyFuturo = new Date(2026, 10, 15); // 15 de noviembre de 2026 (venció 10/10/2026)
    const alertas = getAlertasMaternidadLactancia('emp_guarani_001', hoyFuturo);

    const alertaVencido = alertas.find(a => a.tipoAlerta === 'certificado_trimestral_vencido');
    expect(alertaVencido).toBeDefined();
    expect(alertaVencido?.nivelUrgencia).toBe('critico');
    expect(alertaVencido?.accionRecomendada).toContain('certificado');
  });

  it('genera exitosamente el PDF oficial de constancia de maternidad, reposo y lactancia', () => {
    const crono = calcularCronogramaMaternidadLactancia('2026-10-15', '2026-05-10');
    const doc = generarConstanciaMaternidadPDF({
      empresa: EMPRESA_TEST,
      empleado: EMPLEADA_FEM,
      registro: {
        id: 'mat_pdf_test',
        clienteId: EMPRESA_TEST.id,
        empleadoId: EMPLEADA_FEM.id,
        estado: 'embarazada',
        fechaNotificacionEmbarazo: '2026-05-10',
        fechaProbablePartoFPP: '2026-10-15',
        fechaInicioReposo: crono.fechaInicioReposo,
        fechaFinReposo: crono.fechaFinReposo,
        fechaReincorporacionTrabajo: crono.fechaReincorporacionTrabajo,
        subsidioIpsEstado: 'tramitado',
        modalidadLactancia: 'dos_pausas_45min',
        fechaFinLactanciaObligatoria: crono.fechaFinLactanciaObligatoria,
        deseaExtensionLactancia: true,
        fechaLimiteMaximoLactancia24Meses: crono.fechaLimiteMaximoLactancia24Meses,
        certificadosTrimestrales: [],
        fueroMaternalActivo: true,
        fechaFinEstimadaFuero: crono.fechaFinLactanciaObligatoria,
        createdAt: '2026-05-10T08:00:00Z',
        updatedAt: '2026-05-10T08:00:00Z',
      },
    });

    expect(doc).toBeDefined();
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('incorpora alertasMaternidad dentro de getDashboardMetrics', () => {
    const metrics = getDashboardMetrics('emp_guarani_001');
    expect(metrics.alertasMaternidad).toBeDefined();
    expect(Array.isArray(metrics.alertasMaternidad)).toBe(true);
    expect(metrics.alertasMaternidad.length).toBeGreaterThan(0);
  });

  it('permite eliminar un registro de maternidad limpiando la referencia en el empleado', () => {
    deleteRegistroMaternidad('mat_test_01');
    const registros = getRegistrosMaternidadByCliente(EMPRESA_TEST.id);
    const encontrado = registros.find(m => m.id === 'mat_test_01');
    expect(encontrado).toBeUndefined();
  });
});

describe('Portal de Clientes — Reposos Médicos y Bonificación Familiar Avanzada', () => {
  const EMPRESA_REPOSO_TEST: EmpresaCliente = {
    ...EMPRESA_TEST,
    id: 'emp_reposo_test',
    razonSocial: 'EMPRESA REPOSOS TEST S.A.',
    politicaReposoPatronal: { coberturaPorcentaje: 0 },
  };

  const EMPLEADO_REPOSO: Empleado = {
    ...EMPLEADO_TEST,
    id: 'emp_rep_01',
    clienteId: 'emp_reposo_test',
    salarioBase: 3_000_000, // Jornal diario = 100.000 Gs.
    hijosMenores: 1,
    hijosDiscapacidad: 0,
  };

  it('Política Reposo 0% (Estricto Legal): Descuenta 100% de días de reposo y ajusta días trabajados para IPS', () => {
    saveEmpresaCliente({
      ...EMPRESA_REPOSO_TEST,
      politicaReposoPatronal: { coberturaPorcentaje: 0 },
    });

    const recibo = calcularReciboSalario(EMPLEADO_REPOSO, 8, 2026, {
      diasTrabajados: 30,
      diasReposo: 5,
    });

    // Jornal: 3.000.000 / 30 = 100.000 Gs. Por 5 días = 500.000 Gs.
    expect(recibo.diasReposo).toBe(5);
    expect(recibo.coberturaPatronalReposoPorcentaje).toBe(0);
    expect(recibo.descuentoReposo).toBe(500_000);
    expect(recibo.montoReposoPagadoPatronal).toBe(0);
    expect(recibo.salarioDevengado).toBe(2_500_000);
    // Para IPS, los días trabajados deben descontar el reposo (30 - 5 = 25 días)
    expect(recibo.diasTrabajados).toBe(25);
  });

  it('Política Reposo 50%: Descuenta 50% y cubre patronalmente el 50% restante', () => {
    saveEmpresaCliente({
      ...EMPRESA_REPOSO_TEST,
      politicaReposoPatronal: { coberturaPorcentaje: 50 },
    });

    const recibo = calcularReciboSalario(EMPLEADO_REPOSO, 8, 2026, {
      diasTrabajados: 30,
      diasReposo: 4,
    });

    // 4 días × 100.000 = 400.000 Gs. 50% = 200.000 Gs.
    expect(recibo.diasReposo).toBe(4);
    expect(recibo.coberturaPatronalReposoPorcentaje).toBe(50);
    expect(recibo.descuentoReposo).toBe(200_000);
    expect(recibo.montoReposoPagadoPatronal).toBe(200_000);
    expect(recibo.salarioDevengado).toBe(2_800_000);
    expect(recibo.diasTrabajados).toBe(26);
  });

  it('Política Reposo 100%: Beneficio patronal total (sin descuento al sueldo), pero días trabajados ajustados para IPS', () => {
    saveEmpresaCliente({
      ...EMPRESA_REPOSO_TEST,
      politicaReposoPatronal: { coberturaPorcentaje: 100 },
    });

    const recibo = calcularReciboSalario(EMPLEADO_REPOSO, 8, 2026, {
      diasTrabajados: 30,
      diasReposo: 6,
    });

    // 6 días × 100.000 = 600.000 Gs.
    expect(recibo.diasReposo).toBe(6);
    expect(recibo.coberturaPatronalReposoPorcentaje).toBe(100);
    expect(recibo.descuentoReposo).toBe(0);
    expect(recibo.montoReposoPagadoPatronal).toBe(600_000);
    expect(recibo.salarioDevengado).toBe(3_000_000);
    // En IPS debe registrarse 24 días efectivamente trabajados
    expect(recibo.diasTrabajados).toBe(24);
  });

  it('Bonificación Familiar con hijos con discapacidad vitalicia (Art. 261 C.T.)', () => {
    saveEmpresaCliente(EMPRESA_REPOSO_TEST);

    const empDiscapacidad: Empleado = {
      ...EMPLEADO_REPOSO,
      id: 'emp_disc_01',
      salarioBase: 3_000_000,
      hijosMenores: 1,
      hijosDiscapacidad: 1, // 1 menor + 1 con discapacidad = 2 hijos
    };

    const recibo = calcularReciboSalario(empDiscapacidad, 8, 2026);
    const bonifEsperada = Math.round(SALARIO_MINIMO_LEGAL_PY * 0.05) * 2; // 304.400 Gs.
    expect(recibo.bonificacionFamiliar).toBe(bonifEsperada);
  });

  it('Bonificación Familiar cesa si el salario base más comisiones excede 2 SML (Art. 263 C.T.)', () => {
    saveEmpresaCliente(EMPRESA_REPOSO_TEST);

    const empComisiones: Empleado = {
      ...EMPLEADO_REPOSO,
      id: 'emp_comis_01',
      salarioBase: 3_000_000,
      hijosMenores: 2,
    };

    // Salario 3.000.000 + comisiones 3.500.000 = 6.500.000 > 6.088.000 (2 SML)
    const recibo = calcularReciboSalario(empComisiones, 8, 2026, {
      comisionesPremios: 3_500_000,
    });

    expect(recibo.bonificacionFamiliar).toBe(0);
  });

  it('Bonificación Familiar: Exclusividad materna y no transferencia al padre cuando la madre supera 2 SML (Art. 265 C.T.)', () => {
    saveEmpresaCliente(EMPRESA_REPOSO_TEST);

    const madreVendedora: Empleado = {
      ...EMPLEADO_REPOSO,
      id: 'emp_madre_01',
      nombres: 'María',
      apellidos: 'González',
      sexo: 'F',
      salarioBase: 7_000_000, // Supera 2 SML
      hijosMenores: 1,
    };

    const padreColaborador: Empleado = {
      ...EMPLEADO_REPOSO,
      id: 'emp_padre_01',
      nombres: 'José',
      apellidos: 'González',
      sexo: 'M',
      salarioBase: 3_000_000, // < 2 SML
      hijosMenores: 1,
      parejaEmpleadoId: 'emp_madre_01',
    };

    saveEmpleado(madreVendedora);
    saveEmpleado(padreColaborador);

    // Padre no cobra porque la madre está en la empresa y porque la madre supera 2 SML (no transfiere)
    const reciboPadre = calcularReciboSalario(padreColaborador, 8, 2026);
    expect(reciboPadre.bonificacionFamiliar).toBe(0);
  });
});

describe('Portal de Clientes — Generador de Adendas al Contrato de Trabajo (Ley 213/93)', () => {
  const adendaSalarial: AdendaContrato = {
    id: 'ade_test_sal',
    clienteId: EMPRESA_TEST.id,
    empleadoId: EMPLEADO_TEST.id,
    fechaContratoOriginal: '2022-01-15',
    nroAdenda: 1,
    motivo: 'modificacion_salarial',
    tituloAdenda: 'Modificación de Remuneración y Comisiones',
    fechaEmision: '2026-03-01',
    fechaVigencia: '2026-03-01',
    salarioAnterior: 4000000,
    nuevoSalario: 4800000,
    detalleComisiones: '3% sobre cobranzas de clientes corporativos',
    estado: 'firmado',
    createdAt: '2026-03-01T08:00:00Z',
  };

  const adendaTraslado: AdendaContrato = {
    id: 'ade_test_tras',
    clienteId: EMPRESA_TEST.id,
    empleadoId: EMPLEADO_TEST.id,
    fechaContratoOriginal: '2022-01-15',
    nroAdenda: 2,
    motivo: 'traslado_sucursal',
    tituloAdenda: 'Traslado a Sucursal CDE',
    fechaEmision: '2026-03-10',
    fechaVigencia: '2026-04-01',
    lugarAnterior: 'Casa Central Asunción',
    nuevoLugar: 'Sucursal Ciudad del Este Km 4',
    compensacionTraslado: 'Gs. 1.000.000 mensuales en concepto de movilidad',
    estado: 'firmado',
    createdAt: '2026-03-10T08:00:00Z',
  };

  const adendaConfidencialidad: AdendaContrato = {
    id: 'ade_test_conf',
    clienteId: EMPRESA_TEST.id,
    empleadoId: EMPLEADO_TEST.id,
    fechaContratoOriginal: '2022-01-15',
    nroAdenda: 3,
    motivo: 'confidencialidad_nda',
    tituloAdenda: 'Pacto Especial de Confidencialidad y Secreto Comercial',
    fechaEmision: '2026-03-15',
    fechaVigencia: '2026-03-15',
    alcanceConfidencialidad: 'Bases de datos de clientes, código fuente, políticas de pricing y secretos industriales',
    penalidadIncumplimiento: 'Causal de despido justificado bajo Art. 81 inc. c y h del Código del Trabajo',
    estado: 'firmado',
    createdAt: '2026-03-15T08:00:00Z',
  };

  it('genera exitosamente el PDF oficial de Adenda por Modificación Salarial', () => {
    const doc = generarAdendaContratoPDF(adendaSalarial, EMPLEADO_TEST, EMPRESA_TEST);
    expect(doc).toBeDefined();
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('genera exitosamente el PDF oficial de Adenda por Traslado de Sucursal (Art. 67 y 72 C.T.)', () => {
    const doc = generarAdendaContratoPDF(adendaTraslado, EMPLEADO_TEST, EMPRESA_TEST);
    expect(doc).toBeDefined();
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('genera exitosamente el PDF oficial de Adenda por Confidencialidad y NDA (Art. 65 inc. g C.T.)', () => {
    const doc = generarAdendaContratoPDF(adendaConfidencialidad, EMPLEADO_TEST, EMPRESA_TEST);
    expect(doc).toBeDefined();
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('gestiona el ciclo de persistencia de adendas (guardar, correlativo y eliminar)', () => {
    // Guardar
    saveAdendaContrato(adendaSalarial);
    saveAdendaContrato(adendaTraslado);

    const listado = getAdendasByCliente(EMPRESA_TEST.id);
    expect(listado.some(a => a.id === adendaSalarial.id)).toBe(true);
    expect(listado.some(a => a.id === adendaTraslado.id)).toBe(true);

    // Siguiente número de adenda
    const siguienteNro = getSiguienteNroAdenda(EMPRESA_TEST.id, EMPLEADO_TEST.id);
    expect(siguienteNro).toBe(3); // nroAdenda 1 y 2 ya existen

    // Eliminar
    deleteAdendaContrato(adendaSalarial.id);
    const listadoPostDelete = getAdendasByCliente(EMPRESA_TEST.id);
    expect(listadoPostDelete.some(a => a.id === adendaSalarial.id)).toBe(false);
  });
});

describe('Módulo Legal - Telegrama Colacionado Copaco & Abandono (Art. 81 C.T.)', () => {
  it('formatea correctamente números de Cédula de Identidad con puntos de miles paraguayos', () => {
    expect(formatCiNumber('4585742')).toBe('4.585.742');
    expect(formatCiNumber('123456')).toBe('123.456');
    expect(formatCiNumber('')).toBe('');
  });

  it('formatea fechas de ausencia al español formal para redacción judicial/notarial', () => {
    const fechas = ['2026-09-07', '2026-09-08', '2026-09-09'];
    const texto = formatAbsenceDatesToSpanish(fechas);
    expect(texto).toContain('corriente mes y año');
    expect(texto).toContain('lunes');
    expect(texto).toContain('miércoles');

    const fechasCruzadas = ['2026-08-31', '2026-09-01'];
    const textoCruzado = formatAbsenceDatesToSpanish(fechasCruzadas);
    expect(textoCruzado).toContain('agosto');
    expect(textoCruzado).toContain('setiembre');
    expect(textoCruzado).toContain('corriente año');
  });

  it('valida rigurosamente causales de inasistencia según Art. 81 inc. a) y j)', () => {
    // Caso 1: 3 días consecutivos (cumple causal)
    const valConsecutiva = validateAbsencesLaborLaw(['2026-09-07', '2026-09-08', '2026-09-09']);
    expect(valConsecutiva.isValid).toBe(true);
    expect(valConsecutiva.hasConsecutiveRequirement).toBe(true);

    // Caso 2: 2 días dispersos (no cumple causal todavía)
    const valInsuficiente = validateAbsencesLaborLaw(['2026-09-02', '2026-09-15']);
    expect(valInsuficiente.isValid).toBe(false);

    // Caso 3: 4 días en el mes (cumple causal de 4 días alternados en el mes)
    const valMensual = validateAbsencesLaborLaw(['2026-09-02', '2026-09-08', '2026-09-15', '2026-09-22']);
    expect(valMensual.isValid).toBe(true);
    expect(valMensual.hasMonthlyRequirement).toBe(true);
  });

  it('genera exitosamente el PDF oficial de Telegrama Colacionado con aviso de retorno Copaco', () => {
    const doc = generateTelegramPDF({
      companyName: 'COMERCIAL & LOGÍSTICA GUARANÍ S.A.',
      companyAddress: 'Avda. Eusebio Ayala Km 4.5 c/ De la Victoria, Asunción',
      companyPhone: '(021) 555-1234',
      cityAndDate: 'Asunción, 10 de setiembre de 2026',
      recipientName: 'Juan Carlos Bogado',
      recipientDoc: '3456789',
      recipientAddress: 'Avda. De la Victoria 1234, San Lorenzo',
      recipientPhone: '0981 123456',
      deadlineHours: '48 hs.',
      absenceDaysText: 'los días lunes 07, martes 08 y miércoles 09 de setiembre del corriente año',
      laborCodeArticle: 'Art. 81 inc. j)',
    });

    expect(doc).toBeDefined();
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });
});

describe('Módulo Operaciones Masivas Excel - employeeExcelService', () => {
  it('sanitiza fórmulas maliciosas previniendo ataques de inyección CSV/Excel (OWASP)', () => {
    expect(sanitizeExcelValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeExcelValue('+cmd|"/C calc"!A0')).toBe("'+cmd|\"/C calc\"!A0");
    expect(sanitizeExcelValue('-1000')).toBe("'-1000");
    expect(sanitizeExcelValue('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(sanitizeExcelValue('Carlos Gómez')).toBe('Carlos Gómez');
    expect(sanitizeExcelValue(3500000)).toBe('3500000');
    expect(sanitizeExcelValue(null)).toBe('');
  });

  it('limpia y normaliza números de cédula paraguaya', () => {
    expect(cleanCiNumber('4.585.742')).toBe('4585742');
    expect(cleanCiNumber(' 1.234.567-8 ')).toBe('12345678');
    expect(cleanCiNumber('')).toBe('');
    expect(cleanCiNumber(undefined)).toBe('');
  });

  it('genera correctamente los Workbooks de nómina y plantilla Excel con estructura estándar', () => {
    const wbNomina = generarLibroNominaExcel([EMPLEADO_TEST]);
    expect(wbNomina.SheetNames).toContain('Nómina_Colaboradores');
    const sheetNomina = wbNomina.Sheets['Nómina_Colaboradores'];
    expect(sheetNomina).toBeDefined();

    const wbPlantilla = generarLibroPlantillaExcel();
    expect(wbPlantilla.SheetNames).toContain('Plantilla_Carga_Nomina');
    const sheetPlantilla = wbPlantilla.Sheets['Plantilla_Carga_Nomina'];
    expect(sheetPlantilla).toBeDefined();
  });

  it('parsea y valida un archivo Excel con filas válidas, rechazando duplicados', async () => {
    // Generar un workbook en memoria
    const wb = XLSX.utils.book_new();
    const data = [
      ['Cédula', 'Nombres', 'Apellidos', 'Cargo', 'Salario Base', 'Modalidad', 'Sexo'],
      ['1111111', 'Ana María', 'Duarte', 'Gerente', '8.500.000', 'mensual', 'F'],
      ['2222222', 'Jorge Luis', 'Vera', 'Operador', '2.800.000', 'jornalero', 'M'],
      ['1111111', 'Ana Duplicada', 'Duarte', 'Gerente', '8.500.000', 'mensual', 'F'], // duplicada
      ['', 'Sin Cedula', 'Pérez', 'Auxiliar', '2.500.000', 'mensual', 'M'], // cédula vacía
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // Mock de File
    const file = new File([arrayBuffer], 'nomina_prueba.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await parseAndValidateExcelNomina(file, EMPRESA_TEST.id, [EMPLEADO_TEST]);

    expect(result.totalRows).toBe(4);
    expect(result.validEmployees.length).toBe(2);
    expect(result.validEmployees[0].ci).toBe('1111111');
    expect(result.validEmployees[0].salarioBase).toBe(8500000);
    expect(result.validEmployees[1].ci).toBe('2222222');
    expect(result.validEmployees[1].modalidadPago).toBe('jornalero');
    expect(result.duplicatesInFile).toContain('1111111');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Generador Oficial de Archivos IPS (.PRN 109 columnas)', () => {
  const EMPRESA_PRN: EmpresaCliente = {
    ...EMPRESA_TEST,
    nroPatronalIps: '0004612819',
  };

  const EMPLEADO_1: Empleado = {
    ...EMPLEADO_TEST,
    id: 'emp_01',
    ci: '4585742',
    apellidos: 'Núñez Ibáñez',
    nombres: 'José Ramón',
    salarioBase: 3500000,
  };

  const EMPLEADO_2: Empleado = {
    ...EMPLEADO_TEST,
    id: 'emp_02',
    ci: '1234567',
    apellidos: 'González Gómez',
    nombres: 'María Elena',
    salarioBase: 2800000,
  };

  it('genera cada línea con exactamente 109 caracteres (excluyendo CRLF)', () => {
    const r1 = calcularReciboSalario(EMPLEADO_1, 7, 2026, { diasTrabajados: 30 });
    const r2 = calcularReciboSalario(EMPLEADO_2, 7, 2026, { diasTrabajados: 25 });

    const resultado = generarIpsPrn([r1, r2], [EMPLEADO_1, EMPLEADO_2], EMPRESA_PRN, 7, 2026);

    expect(resultado.fileName).toBe('IPS_JULIO_2026.prn');
    const lineas = resultado.content.split('\r\n').filter((linea) => linea.length > 0);
    expect(lineas.length).toBe(2);

    for (const linea of lineas) {
      expect(linea.length).toBe(109);
    }
  });

  it('alinea correctamente los campos posicionales según la especificación de IPS (IPS JULIO.prn)', () => {
    const r1 = calcularReciboSalario(EMPLEADO_1, 7, 2026, {
      diasTrabajados: 30,
      horasExtras50Cant: 0,
      horasExtras100Cant: 0,
    });

    const resultado = generarIpsPrn([r1], [EMPLEADO_1], EMPRESA_PRN, 7, 2026);
    // El archivo termina con CRLF: se toma la primera linea, que es la unica del lote.
    const [linea] = resultado.content.split('\r\n');
    expect(linea.length).toBe(109);

    // Pos 0..9 (10 chars): Patronal con padding de ceros a la izquierda
    const patronal = linea.substring(0, 10);
    expect(patronal).toBe('0004612819');

    // Pos 10..29 (20 chars): CI sin puntos, alineado a la derecha con espacios
    const ci = linea.substring(10, 30);
    expect(ci).toBe('             4585742');
    expect(ci.length).toBe(20);

    // Pos 30..59 (30 chars): Apellidos mayúsculas sin acentos, alineado a la derecha con espacios
    const apellidos = linea.substring(30, 60);
    expect(apellidos.length).toBe(30);
    expect(apellidos.trim()).toBe('NUNEZ IBANEZ');
    expect(apellidos).not.toMatch(/[áéíóúÁÉÍÓÚñÑ]/);

    // Pos 60..89 (30 chars): Nombres mayúsculas sin acentos, alineado a la derecha con espacios
    const nombres = linea.substring(60, 90);
    expect(nombres.length).toBe(30);
    expect(nombres.trim()).toBe('JOSE RAMON');
    expect(nombres).not.toMatch(/[áéíóúÁÉÍÓÚñÑ]/);

    // Pos 90 (1 char): 'E' (Empleado cotizante)
    expect(linea.charAt(90)).toBe('E');

    // Pos 91..92 (2 chars): Días trabajados (2 chars con espacio a la izq si < 10)
    const dias = linea.substring(91, 93);
    expect(dias).toBe('30');

    // Pos 93..102 (10 chars): Salario imponible alineado a la derecha con espacios
    const salario = linea.substring(93, 103);
    expect(salario.length).toBe(10);
    expect(Number(salario.trim())).toBe(3500000);

    // Pos 103..108 (6 chars): Periodo (Mes 2 chars + Año 4 chars)
    const periodo = linea.substring(103, 109);
    expect(periodo).toBe(' 72026');
  });

  it('calcula y formatea correctamente los nombres de archivo y totales acumulados de aportes', () => {
    const r1 = calcularReciboSalario(EMPLEADO_1, 7, 2026, { diasTrabajados: 30 });
    const r2 = calcularReciboSalario(EMPLEADO_2, 7, 2026, { diasTrabajados: 30 });

    const resultado = generarIpsPrn([r1, r2], [EMPLEADO_1, EMPLEADO_2], EMPRESA_PRN, 7, 2026);

    expect(resultado.fileName).toBe('IPS_JULIO_2026.prn');
    expect(resultado.totalEmpleados).toBe(2);

    const baseEsperada = r1.salarioDevengado + r2.salarioDevengado;
    expect(resultado.totalSalariosImponibles).toBe(baseEsperada);
    expect(resultado.totalAporteObrero9).toBe(Math.round(baseEsperada * 0.09));
    expect(resultado.totalAportePatronal165).toBe(Math.round(baseEsperada * 0.165));
    expect(resultado.totalAporteIps255).toBe(resultado.totalAporteObrero9 + resultado.totalAportePatronal165);
  });
});

describe('CompanyProfileTab & updateCurrentEmpresa (Gestión Datos de la Empresa)', () => {
  it('calcula correctamente el Dígito Verificador (DV) según algoritmo oficial DNIT/SET de Paraguay', () => {
    // Casos borde
    expect(calcularDV('')).toBe('');
    expect(calcularDV('   ')).toBe('');

    // RUCs de prueba calculados con módulo 11
    // Para RUC 80000123: suma = 3*2 + 2*3 + 1*4 + 0*5 + 0*6 + 0*7 + 0*8 + 8*9 = 6+6+4+72 = 88. 88%11 = 0 => DV = 0
    expect(calcularDV('80000123')).toBe('0');

    // Para RUC 80012345: digits reversed: 5,4,3,2,1,0,0,8 -> 5*2+4*3+3*4+2*5+1*6+0*7+0*8+8*9 = 10+12+12+10+6+0+0+72 = 122. 122%11 = 1 => resto 1 => DV = 0
    expect(calcularDV('80012345')).toBe('0');

    // RUC con resto > 1: ejemplo '4559756' -> 6*2 + 5*3 + 7*4 + 9*5 + 5*6 + 5*7 + 4*8 = 12+15+28+45+30+35+32 = 197. 197%11 = 10. 11 - 10 = 1 => DV = 1
    expect(calcularDV('4559756')).toBe('1');
  });

  it('formatea el Nº Patronal IPS a exactamente 10 dígitos con ceros a la izquierda para archivo .PRN', () => {
    expect(formatearPatronalIps('4612819')).toBe('0004612819');
    expect(formatearPatronalIps('123')).toBe('0000000123');
    expect(formatearPatronalIps('0004612819')).toBe('0004612819');
    expect(formatearPatronalIps(undefined)).toBe('');
    expect(formatearPatronalIps('')).toBe('');
  });

  it('actualiza y persiste los datos de la empresa activa en la sesión del cliente', async () => {
    const loginRes = await loginClient('cliente@laborapy.com', 'Cliente2026!');
    expect(loginRes.success).toBe(true);
    expect(loginRes.session).toBeDefined();

    const empresaModificada: EmpresaCliente = {
      ...loginRes.session!.empresa,
      razonSocial: 'Corporación Guaraní Actualizada S.A.',
      nroPatronalIps: '0004612819',
      nroPatronalMtess: '80012345-1',
      representanteLegalNombre: 'Ing. Fernando Lugo Silva',
      representanteLegalCi: '2.345.678',
      representanteLegalCargo: 'Director General',
      patronalesMtessSecundarias: [
        {
          id: 'suc_cde_01',
          nroPatronalMtess: '80012345-2',
          sucursalNombre: 'Sucursal Ciudad del Este',
          ciudad: 'Ciudad del Este',
          esPrincipal: false,
        },
      ],
    };

    const updatedSession = updateCurrentEmpresa(empresaModificada);
    expect(updatedSession).not.toBeNull();
    expect(updatedSession?.empresa.razonSocial).toBe('Corporación Guaraní Actualizada S.A.');
    expect(updatedSession?.empresa.nroPatronalIps).toBe('0004612819');
    expect(updatedSession?.empresa.patronalesMtessSecundarias?.length).toBe(1);
    expect(updatedSession?.empresa.patronalesMtessSecundarias?.[0].sucursalNombre).toBe('Sucursal Ciudad del Este');

    // Verificar que también se actualizó en la sesión recuperada
    const current = getClientSession();
    expect(current?.empresa.razonSocial).toBe('Corporación Guaraní Actualizada S.A.');
    expect(current?.empresa.representanteLegalNombre).toBe('Ing. Fernando Lugo Silva');
  });
});
