/**
 * SERVICIO DE PRESENTISMO, BIOMETRÍA (API ABIERTA) Y HORAS EXTRAS — LABOARAPY ERP
 * 
 * Cumplimiento con:
 * - Código del Trabajo de Paraguay (Ley N.º 213/93):
 *   - Jornada ordinaria diurna (8h/día, 48h/sem) y nocturna (7h/día, 42h/sem)
 *   - Horas extras diurnas al 50% (Art. 234 inc. a)
 *   - Horas extras nocturnas y feriados/domingos al 100% (Art. 234 inc. b)
 *   - Recargo nocturno ordinario del 30% (Art. 234 inc. c)
 *   - Base 30 días para liquidación mensual
 * - Decreto-Ley N.º 1860/50 y Ley N.º 98/92 (IPS):
 *   - Reposos comunes: primeros 3 días empleador, día 4+ subsidio 50% IPS
 *   - Reposo maternidad (Ley 5508/15): 126 días 100% IPS
 * - Licencias legales paraguayas (Matrimonio 3d, Paternidad 14d, Duelo 3d, Examen preventivo 2d)
 * - Compatibilidad con biométricos: ZKTeco (attlog.dat/ADMS), Hikvision (ISAPI), Dahua, Anviz, Suprema, CSV.
 */

import type {
  Empleado,
  ReciboSalario,
  NovedadPresentismo,
  RegistroMarcacion,
  TipoMarcacion,
  MetodoVerificacionMarcacion,
  ConfigBiometricoCliente,
  ResumenAsistenciaEmpleadoMes,
} from '../types/clientPortal';

import {
  getSafeStorage,
  getEmpleadosByCliente,
  getRecibosByCliente,
  saveRecibosBatch,
  calcularReciboSalario,
} from './clientStorageService';

// ==============================================================================
// CONSTANTES Y CLAVES DE ALMACENAMIENTO
// ==============================================================================

export const ATTENDANCE_STORAGE_KEYS = {
  NOVEDADES: 'laborapy_erp_novedades',
  MARCACIONES: 'laborapy_erp_marcaciones',
  CONFIG_BIOMETRICO: 'laborapy_erp_config_biometrico',
  AJUSTES_OVERTIME: 'laborapy_erp_ajustes_overtime',
};

// Feriados fijos de la República del Paraguay (Ley N.º 6631/2020 y conexas)
const FERIADOS_FIJOS_PARAGUAY: Record<number, number[]> = {
  1: [1],       // 1 de Enero: Año Nuevo
  3: [1],       // 1 de Marzo: Día de los Héroes de la Patria
  5: [1, 14, 15], // 1 de Mayo: Día de los Trabajadores / 14 y 15 de Mayo: Independencia Nacional
  6: [12],      // 12 de Junio: Día de la Paz del Chaco
  8: [15],      // 15 de Agosto: Fundación de Asunción
  9: [29],      // 29 de Septiembre: Victoria de Boquerón
  12: [8, 25],  // 8 de Diciembre: Virgen de Caacupé / 25 de Diciembre: Navidad
};

// ==============================================================================
// DATOS DEMO INICIALES
// ==============================================================================

export const DEMO_CONFIG_BIOMETRICO: ConfigBiometricoCliente[] = [
  {
    clienteId: 'emp_guarani_001',
    apiKey: 'lpy_live_zk_9874561230abcdef4567890123',
    webhookUrl: 'https://erp.laborapy.com.py/api/v1/attendance/punch',
    horaEntradaPredeterminada: '08:00',
    horaSalidaPredeterminada: '17:00',
    toleranciaMinutosTardia: 10,
    horaInicioNocturno: '20:00',
    horaFinNocturno: '06:00',
    descontarTardanzas: true,
  },
];

export const DEMO_NOVEDADES: NovedadPresentismo[] = [
  {
    id: 'nov_01',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_01', // Jorge Ramírez
    tipoNovedad: 'reposo_patronal',
    fechaInicio: '2026-08-04',
    fechaFin: '2026-08-05',
    dias: 2,
    remunerado: true,
    descuentaJornal: false,
    motivo: 'Cuadro gripal agudo con reposo médico certificado (primeros 2 días a cargo patronal)',
    estado: 'aprobado',
    createdAt: '2026-08-04T08:30:00Z',
  },
  {
    id: 'nov_02',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_03', // Víctor Torres (Chofer)
    tipoNovedad: 'licencia_paternidad',
    fechaInicio: '2026-08-10',
    fechaFin: '2026-08-23',
    dias: 14,
    remunerado: true,
    descuentaJornal: false,
    motivo: 'Nacimiento de hijo (Art. 13 Ley 5508/15 - 14 días corridos remunerados por empleador)',
    estado: 'aprobado',
    createdAt: '2026-08-10T09:00:00Z',
  },
  {
    id: 'nov_03',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_02', // Claudia González (Lactancia / Cumpleaños 20 de Agosto)
    tipoNovedad: 'cumpleanos_asueto',
    fechaInicio: '2026-08-20',
    fechaFin: '2026-08-20',
    dias: 1,
    remunerado: true,
    descuentaJornal: false,
    motivo: 'Día de cumpleaños del colaborador (Asueto remunerado institucional)',
    estado: 'aprobado',
    createdAt: '2026-08-20T08:00:00Z',
  },
  {
    id: 'nov_04',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_04', // Esteban Rivarola (Auxiliar en prueba)
    tipoNovedad: 'ausencia_injustificada',
    fechaInicio: '2026-08-28',
    fechaFin: '2026-08-28',
    dias: 1,
    remunerado: false,
    descuentaJornal: true,
    motivo: 'Ausencia sin aviso ni justificativo médico fehaciente (descuento de 1 jornal)',
    estado: 'aprobado',
    createdAt: '2026-08-28T18:00:00Z',
  },
];

export const DEMO_MARCACIONES: RegistroMarcacion[] = [
  // Jorge Ramírez (Supervisor) - 2026-08-03: Jornada normal con 2 horas extras diurnas (salió a las 19:00)
  {
    id: 'marc_01',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_01',
    ci: '4.567.890',
    timestamp: '2026-08-03T07:55:00',
    tipo: 'entrada',
    metodo: 'huella',
    dispositivoId: 'ZK_RELOJ_PRINCIPAL',
    marca: 'zkteco',
  },
  {
    id: 'marc_02',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_01',
    ci: '4.567.890',
    timestamp: '2026-08-03T19:00:00',
    tipo: 'salida',
    metodo: 'huella',
    dispositivoId: 'ZK_RELOJ_PRINCIPAL',
    marca: 'zkteco',
  },
  // Jorge Ramírez - 2026-08-06: Salida a las 21:30 (incluye hora extra diurna + nocturna)
  {
    id: 'marc_03',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_01',
    ci: '4.567.890',
    timestamp: '2026-08-06T08:00:00',
    tipo: 'entrada',
    metodo: 'huella',
    dispositivoId: 'ZK_RELOJ_PRINCIPAL',
    marca: 'zkteco',
  },
  {
    id: 'marc_04',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_01',
    ci: '4.567.890',
    timestamp: '2026-08-06T21:30:00',
    tipo: 'salida',
    metodo: 'huella',
    dispositivoId: 'ZK_RELOJ_PRINCIPAL',
    marca: 'zkteco',
  },
  // Esteban Rivarola (Auxiliar) - 2026-08-25: Llegada tardía (08:35 con tolerancia de 10 min = 25 min retraso)
  {
    id: 'marc_05',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_04',
    ci: '6.234.567',
    timestamp: '2026-08-25T08:35:00',
    tipo: 'entrada',
    metodo: 'facial',
    dispositivoId: 'HIK_MINMOE_ACCESO',
    marca: 'hikvision',
  },
  {
    id: 'marc_06',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_04',
    ci: '6.234.567',
    timestamp: '2026-08-25T17:00:00',
    tipo: 'salida',
    metodo: 'facial',
    dispositivoId: 'HIK_MINMOE_ACCESO',
    marca: 'hikvision',
  },
  // Esteban Rivarola - 2026-08-15 (Feriado Fundación de Asunción): Trabajo especial 4 horas feriado (100% recargo)
  {
    id: 'marc_07',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_04',
    ci: '6.234.567',
    timestamp: '2026-08-15T08:00:00',
    tipo: 'entrada',
    metodo: 'facial',
    dispositivoId: 'HIK_MINMOE_ACCESO',
    marca: 'hikvision',
  },
  {
    id: 'marc_08',
    clienteId: 'emp_guarani_001',
    empleadoId: 'emp_04',
    ci: '6.234.567',
    timestamp: '2026-08-15T12:00:00',
    tipo: 'salida',
    metodo: 'facial',
    dispositivoId: 'HIK_MINMOE_ACCESO',
    marca: 'hikvision',
  },
];

// ==============================================================================
// HELPERS Y UTILIDADES DE FECHAS
// ==============================================================================

function generarId(prefijo: string): string {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function esFeriadoParaguay(fecha: Date): boolean {
  const mes = fecha.getMonth() + 1;
  const dia = fecha.getDate();
  const fijos = FERIADOS_FIJOS_PARAGUAY[mes];
  return Boolean(fijos && fijos.includes(dia));
}

export function esDomingo(fecha: Date): boolean {
  return fecha.getDay() === 0;
}

export function esDomingoOFeriado(fecha: Date): boolean {
  return esDomingo(fecha) || esFeriadoParaguay(fecha);
}

export function formatIsoLocalDateTime(d: Date, originalStr?: string): string {
  if (originalStr && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(originalStr.trim())) {
    const s = originalStr.trim().replace(' ', 'T');
    return s.length === 16 ? `${s}:00` : s;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${dia}T${h}:${min}:${sec}`;
}

// ==============================================================================
// OPERACIONES CRUD: NOVEDADES DE PRESENTISMO
// ==============================================================================

export function getNovedadesByCliente(clienteId: string): NovedadPresentismo[] {
  const storage = getSafeStorage();
  try {
    const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.NOVEDADES);
    const todas: NovedadPresentismo[] = raw ? JSON.parse(raw) : DEMO_NOVEDADES;
    return todas.filter(n => n.clienteId === clienteId);
  } catch {
    return DEMO_NOVEDADES.filter(n => n.clienteId === clienteId);
  }
}

export function getNovedadesByEmpleado(clienteId: string, empleadoId: string): NovedadPresentismo[] {
  return getNovedadesByCliente(clienteId).filter(n => n.empleadoId === empleadoId);
}

export function saveNovedad(novedad: NovedadPresentismo): NovedadPresentismo {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.NOVEDADES);
  const todas: NovedadPresentismo[] = raw ? JSON.parse(raw) : [...DEMO_NOVEDADES];

  const itemGuardar: NovedadPresentismo = {
    ...novedad,
    id: novedad.id || generarId('nov'),
    createdAt: novedad.createdAt || new Date().toISOString(),
  };

  const idx = todas.findIndex(n => n.id === itemGuardar.id);
  if (idx >= 0) {
    todas[idx] = itemGuardar;
  } else {
    todas.unshift(itemGuardar);
  }

  storage.setItem(ATTENDANCE_STORAGE_KEYS.NOVEDADES, JSON.stringify(todas));
  return itemGuardar;
}

export function deleteNovedad(clienteId: string, id: string): boolean {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.NOVEDADES);
  if (!raw) return false;
  const todas: NovedadPresentismo[] = JSON.parse(raw);
  const filtradas = todas.filter(n => !(n.clienteId === clienteId && n.id === id));
  storage.setItem(ATTENDANCE_STORAGE_KEYS.NOVEDADES, JSON.stringify(filtradas));
  return filtradas.length !== todas.length;
}

// ==============================================================================
// OPERACIONES CRUD: MARCACIONES BIOMÉTRICAS
// ==============================================================================

export function getMarcacionesByCliente(clienteId: string): RegistroMarcacion[] {
  const storage = getSafeStorage();
  try {
    const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES);
    const todas: RegistroMarcacion[] = raw ? JSON.parse(raw) : DEMO_MARCACIONES;
    return todas.filter(m => m.clienteId === clienteId);
  } catch {
    return DEMO_MARCACIONES.filter(m => m.clienteId === clienteId);
  }
}

export function saveMarcacion(marcacion: RegistroMarcacion): RegistroMarcacion {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES);
  const todas: RegistroMarcacion[] = raw ? JSON.parse(raw) : [...DEMO_MARCACIONES];

  const nueva: RegistroMarcacion = {
    ...marcacion,
    id: marcacion.id || generarId('marc'),
  };

  const idx = todas.findIndex(m => m.id === nueva.id);
  if (idx >= 0) {
    todas[idx] = nueva;
  } else {
    todas.unshift(nueva);
  }

  storage.setItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES, JSON.stringify(todas));
  return nueva;
}

export function saveMarcacionesBatch(marcaciones: RegistroMarcacion[]): RegistroMarcacion[] {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES);
  const todas: RegistroMarcacion[] = raw ? JSON.parse(raw) : [...DEMO_MARCACIONES];

  const procesadas = marcaciones.map(m => ({
    ...m,
    id: m.id || generarId('marc'),
  }));

  // Agregamos evitando duplicados exactos de (empleadoId, timestamp, tipo)
  for (const item of procesadas) {
    const yaExiste = todas.some(
      t => t.empleadoId === item.empleadoId && t.timestamp === item.timestamp && t.tipo === item.tipo
    );
    if (!yaExiste) {
      todas.unshift(item);
    }
  }

  storage.setItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES, JSON.stringify(todas));
  return procesadas;
}

export function deleteMarcacion(clienteId: string, id: string): boolean {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES);
  if (!raw) return false;
  const todas: RegistroMarcacion[] = JSON.parse(raw);
  const filtradas = todas.filter(m => !(m.clienteId === clienteId && m.id === id));
  storage.setItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES, JSON.stringify(filtradas));
  return filtradas.length !== todas.length;
}

export function limpiarMarcacionesCliente(clienteId: string): boolean {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES);
  if (!raw) return false;
  const todas: RegistroMarcacion[] = JSON.parse(raw);
  const filtradas = todas.filter(m => m.clienteId !== clienteId);
  storage.setItem(ATTENDANCE_STORAGE_KEYS.MARCACIONES, JSON.stringify(filtradas));
  return true;
}

// ==============================================================================
// CONFIGURACIÓN DE BIOMETRÍA & OPEN API
// ==============================================================================

export function getConfigBiometricoByCliente(clienteId: string): ConfigBiometricoCliente {
  const storage = getSafeStorage();
  try {
    const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.CONFIG_BIOMETRICO);
    const configs: ConfigBiometricoCliente[] = raw ? JSON.parse(raw) : DEMO_CONFIG_BIOMETRICO;
    const encontrada = configs.find(c => c.clienteId === clienteId);
    if (encontrada) return encontrada;
  } catch {
    // fallback
  }

  // Configuración predeterminada
  return {
    clienteId,
    apiKey: `lpy_live_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString().slice(-6)}`,
    webhookUrl: 'https://erp.laborapy.com.py/api/v1/attendance/punch',
    horaEntradaPredeterminada: '08:00',
    horaSalidaPredeterminada: '17:00',
    toleranciaMinutosTardia: 10,
    horaInicioNocturno: '20:00',
    horaFinNocturno: '06:00',
    descontarTardanzas: true,
  };
}

export function saveConfigBiometrico(config: ConfigBiometricoCliente): ConfigBiometricoCliente {
  const storage = getSafeStorage();
  const raw = storage.getItem(ATTENDANCE_STORAGE_KEYS.CONFIG_BIOMETRICO);
  const configs: ConfigBiometricoCliente[] = raw ? JSON.parse(raw) : [...DEMO_CONFIG_BIOMETRICO];

  const idx = configs.findIndex(c => c.clienteId === config.clienteId);
  if (idx >= 0) {
    configs[idx] = config;
  } else {
    configs.push(config);
  }

  storage.setItem(ATTENDANCE_STORAGE_KEYS.CONFIG_BIOMETRICO, JSON.stringify(configs));
  return config;
}

export function generarNuevaApiKey(clienteId: string): string {
  const actual = getConfigBiometricoByCliente(clienteId);
  const nuevaKey = `lpy_live_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
  saveConfigBiometrico({
    ...actual,
    apiKey: nuevaKey,
  });
  return nuevaKey;
}

// ==============================================================================
// PARSERS DE ARCHIVOS BIOMÉTRICOS (ZKTECO, HIKVISION, DAHUA, UNIVERSAL CSV)
// ==============================================================================

/**
 * Normaliza y empareja un CI o UserID con la lista de empleados
 */
function buscarEmpleadoPorIdentificador(idOci: string, empleados: Empleado[]): Empleado | undefined {
  const limpio = idOci.trim().replace(/\./g, '').toLowerCase();
  return empleados.find(emp => {
    const ciLimpio = emp.ci.replace(/\./g, '').toLowerCase();
    return emp.id.toLowerCase() === limpio || ciLimpio === limpio;
  });
}

/**
 * Parser de archivos de reloj ZKTeco (attlog.dat / TSV / CSV)
 * Formato estándar ZK: [UserID / CI \t YYYY-MM-DD HH:mm:ss \t State \t VerifyMode]
 */
export function parseZkTecoLog(
  rawText: string,
  clienteId: string,
  empleados: Empleado[]
): RegistroMarcacion[] {
  const lineas = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const marcaciones: RegistroMarcacion[] = [];

  for (const linea of lineas) {
    // Soporta tabulador, coma o múltiples espacios como separador
    const partes = linea.includes('\t')
      ? linea.split('\t')
      : linea.includes(',')
      ? linea.split(',')
      : linea.trim().split(/\s{2,}|\s+/);

    if (partes.length < 2) continue;

    const userIdent = partes[0].trim();
    const fechaHora = partes[1].trim();

    // Validar formato de fecha YYYY-MM-DD HH:mm(:ss)
    const fechaParsed = new Date(fechaHora.replace(' ', 'T'));
    if (isNaN(fechaParsed.getTime())) continue;

    const emp = buscarEmpleadoPorIdentificador(userIdent, empleados);
    if (!emp) continue;

    // Estado de marcación en ZK: 0=Entrada, 1=Salida, 2=Salida Almuerzo, 3=Entrada Almuerzo
    const estadoRaw = partes[2]?.trim() || '0';
    let tipo: TipoMarcacion = 'entrada';
    if (estadoRaw === '1' || estadoRaw.toLowerCase() === 'out') tipo = 'salida';
    else if (estadoRaw === '2') tipo = 'salida_almuerzo';
    else if (estadoRaw === '3') tipo = 'entrada_almuerzo';
    else if (fechaParsed.getHours() >= 13) tipo = 'salida';

    // Modo de verificación ZK: 1=Huella, 2=PIN, 15=Facial, 4=Tarjeta RFID
    const verifyRaw = partes[3]?.trim() || '1';
    let metodo: MetodoVerificacionMarcacion = 'huella';
    if (verifyRaw === '15') metodo = 'facial';
    else if (verifyRaw === '4') metodo = 'tarjeta';
    else if (verifyRaw === '2') metodo = 'pin';

    marcaciones.push({
      id: generarId('zk'),
      clienteId,
      empleadoId: emp.id,
      ci: emp.ci,
      timestamp: formatIsoLocalDateTime(fechaParsed, fechaHora),
      tipo,
      metodo,
      dispositivoId: 'ZK_DEVICE_AUTO',
      marca: 'zkteco',
      rawLog: linea.trim(),
    });
  }

  return marcaciones;
}

/**
 * Parser de eventos JSON de terminales faciales Hikvision (ISAPI / MinMoe)
 */
export function parseHikvisionJson(
  jsonContent: string | Record<string, unknown> | unknown[],
  clienteId: string,
  empleados: Empleado[]
): RegistroMarcacion[] {
  let data: any;
  try {
    data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
  } catch {
    return [];
  }

  const eventos: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data?.AccessControllerEvent?.events)
    ? data.AccessControllerEvent.events
    : data?.AccessControllerEvent
    ? [data.AccessControllerEvent]
    : [data];

  const marcaciones: RegistroMarcacion[] = [];

  for (const ev of eventos) {
    const ident = ev.employeeNoString || ev.cardNo || ev.name || ev.userId || ev.ci;
    const timeStr = ev.time || ev.timestamp || ev.dateTime;
    if (!ident || !timeStr) continue;

    const emp = buscarEmpleadoPorIdentificador(String(ident), empleados);
    if (!emp) continue;

    const fecha = new Date(String(timeStr));
    if (isNaN(fecha.getTime())) continue;

    // Tipo de marcación
    let tipo: TipoMarcacion = 'entrada';
    if (ev.type === 'salida' || ev.direction === 'out' || ev.doorStatus === 'exit') {
      tipo = 'salida';
    } else if (fecha.getHours() >= 14) {
      tipo = 'salida';
    }

    // Método biométrico
    let metodo: MetodoVerificacionMarcacion = 'facial';
    if (ev.minorType === 'card' || ev.cardNo) metodo = 'tarjeta';
    else if (ev.minorType === 'fingerprint') metodo = 'huella';

    marcaciones.push({
      id: generarId('hik'),
      clienteId,
      empleadoId: emp.id,
      ci: emp.ci,
      timestamp: formatIsoLocalDateTime(fecha, String(timeStr)),
      tipo,
      metodo,
      dispositivoId: ev.deviceId || 'HIK_MINMOE_TERMINAL',
      marca: 'hikvision',
      rawLog: JSON.stringify(ev),
    });
  }

  return marcaciones;
}

/**
 * Parser Universal de archivos CSV / TXT delimitados por comas o punto y coma
 * Columnas: [CI o Legajo, FechaHora (YYYY-MM-DD HH:mm), Tipo (entrada/salida), Metodo, Dispositivo]
 */
export function parseUniversalCsv(
  csvContent: string,
  clienteId: string,
  empleados: Empleado[]
): RegistroMarcacion[] {
  const lineas = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  const marcaciones: RegistroMarcacion[] = [];

  for (const linea of lineas) {
    // Si es cabecera, ignorar
    const lower = linea.toLowerCase();
    if (lower.includes('cedula') || lower.includes('fecha') || lower.includes('timestamp') || lower.includes('userid')) {
      continue;
    }

    const sep = linea.includes(';') ? ';' : ',';
    const partes = linea.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (partes.length < 2) continue;

    const ident = partes[0];
    const fechaHora = partes[1];
    const emp = buscarEmpleadoPorIdentificador(ident, empleados);
    if (!emp) continue;

    const fecha = new Date(fechaHora.replace(' ', 'T'));
    if (isNaN(fecha.getTime())) continue;

    const tipoRaw = (partes[2] || '').toLowerCase();
    let tipo: TipoMarcacion = 'entrada';
    if (tipoRaw.includes('salida') || tipoRaw.includes('out') || fecha.getHours() >= 14) {
      tipo = 'salida';
    }

    const metodoRaw = (partes[3] || '').toLowerCase();
    let metodo: MetodoVerificacionMarcacion = 'huella';
    if (metodoRaw.includes('face') || metodoRaw.includes('facial')) metodo = 'facial';
    else if (metodoRaw.includes('card') || metodoRaw.includes('tarjeta')) metodo = 'tarjeta';
    else if (metodoRaw.includes('pin')) metodo = 'pin';
    else if (metodoRaw.includes('manual')) metodo = 'manual';

    marcaciones.push({
      id: generarId('csv'),
      clienteId,
      empleadoId: emp.id,
      ci: emp.ci,
      timestamp: formatIsoLocalDateTime(fecha, fechaHora),
      tipo,
      metodo,
      dispositivoId: partes[4] || 'CSV_IMPORT',
      marca: 'generico',
      rawLog: linea,
    });
  }

  return marcaciones;
}

// ==============================================================================
// MOTOR DE CÓMPUTO DE ASISTENCIA DIARIA Y HORAS EXTRAS (LEY 213/93)
// ==============================================================================

export interface CalculoDiaResult {
  fechaStr: string;
  minutosTardanza: number;
  horas50: number;
  horas100: number;
  recargoNocturnoHoras: number;
  esFeriadoODomingo: boolean;
  trabajoEfectivoHoras: number;
}

/**
 * Calcula la jornada de un empleado en una fecha específica
 */
export function calcularJornadaDiaria(
  fechaDiaStr: string, // YYYY-MM-DD
  marcacionesDia: RegistroMarcacion[],
  config: ConfigBiometricoCliente
): CalculoDiaResult {
  const fechaDate = new Date(`${fechaDiaStr}T12:00:00`);
  const esEspecial = esDomingoOFeriado(fechaDate);

  if (marcacionesDia.length === 0) {
    return {
      fechaStr: fechaDiaStr,
      minutosTardanza: 0,
      horas50: 0,
      horas100: 0,
      recargoNocturnoHoras: 0,
      esFeriadoODomingo: esEspecial,
      trabajoEfectivoHoras: 0,
    };
  }

  // Ordenamos cronológicamente
  const ordenadas = [...marcacionesDia].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const primera = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];

  const dEntrada = new Date(primera.timestamp);
  const dSalida = new Date(ultima.timestamp);

  // Si solo hay una marcación, asumimos jornada estándar de 8 horas sin extras
  let horasTotales = Math.max(0, (dSalida.getTime() - dEntrada.getTime()) / 3600000);
  if (ordenadas.length === 1 || horasTotales < 0.2) {
    horasTotales = 8.0;
  }

  // 1. Cómputo de llegadas tardías
  const [hExp, mExp] = config.horaEntradaPredeterminada.split(':').map(Number);
  const dEsperada = new Date(dEntrada);
  dEsperada.setHours(hExp, mExp, 0, 0);

  const toleranciaMs = config.toleranciaMinutosTardia * 60000;
  let minutosTardanza = 0;
  if (!esEspecial && dEntrada.getTime() > dEsperada.getTime() + toleranciaMs) {
    minutosTardanza = Math.floor((dEntrada.getTime() - (dEsperada.getTime() + toleranciaMs)) / 60000);
  }

  // 2. Si es Domingo o Feriado Nacional:
  // Conforme al Art. 234 inc. b del Código del Trabajo, toda hora trabajada se abona con recargo del 100%
  if (esEspecial) {
    return {
      fechaStr: fechaDiaStr,
      minutosTardanza: 0,
      horas50: 0,
      horas100: Math.round(horasTotales * 10) / 10,
      recargoNocturnoHoras: 0,
      esFeriadoODomingo: true,
      trabajoEfectivoHoras: Math.round(horasTotales * 10) / 10,
    };
  }

  // 3. Jornada ordinaria en día normal (Lunes a Sábado):
  // Jornada máxima legal diurna = 8 horas (Art. 194)
  const exceso = Math.max(0, horasTotales - 8.0);

  // Verificamos si la salida supera las 20:00 (inicio de horario nocturno según Art. 196)
  const dLimiteNoche = new Date(dEntrada);
  dLimiteNoche.setHours(20, 0, 0, 0);

  let horas50 = 0;
  let horas100 = 0;
  let recargoNocturnoHoras = 0;

  if (exceso > 0) {
    if (dSalida.getTime() > dLimiteNoche.getTime()) {
      // Fracción nocturna extraordinaria (después de las 20:00) -> 100% extra (Art. 234 inc. b)
      const horasNocheExtra = Math.min(exceso, (dSalida.getTime() - dLimiteNoche.getTime()) / 3600000);
      horas100 = Math.round(horasNocheExtra * 10) / 10;
      horas50 = Math.round(Math.max(0, exceso - horasNocheExtra) * 10) / 10;
    } else {
      // Todo el exceso ocurrió antes de las 20:00 -> 50% extra diurna (Art. 234 inc. a)
      horas50 = Math.round(exceso * 10) / 10;
    }
  }

  // Recargo nocturno ordinario del 30% (Art. 234 inc. c):
  // Si trabajó en horario nocturno (20:00 a 06:00) dentro de sus 8 horas ordinarias
  if (dSalida.getTime() > dLimiteNoche.getTime() && exceso <= 0) {
    recargoNocturnoHoras = Math.round(((dSalida.getTime() - dLimiteNoche.getTime()) / 3600000) * 10) / 10;
  }

  return {
    fechaStr: fechaDiaStr,
    minutosTardanza,
    horas50,
    horas100,
    recargoNocturnoHoras,
    esFeriadoODomingo: false,
    trabajoEfectivoHoras: Math.round(horasTotales * 10) / 10,
  };
}

// ==============================================================================
// MOTOR DE CONSOLIDACIÓN MENSUAL (PRESENTISMO + NOVEDADES + HORAS EXTRAS)
// ==============================================================================

export function calcularResumenAsistenciaMensual(
  clienteId: string,
  mes: number,
  anho: number
): ResumenAsistenciaEmpleadoMes[] {
  const empleados = getEmpleadosByCliente(clienteId).filter(e => e.estado !== 'inactivo');
  const todasMarcaciones = getMarcacionesByCliente(clienteId);
  const todasNovedades = getNovedadesByCliente(clienteId);
  const config = getConfigBiometricoByCliente(clienteId);

  const diasEnMes = new Date(anho, mes, 0).getDate();
  const resumenes: ResumenAsistenciaEmpleadoMes[] = [];

  for (const emp of empleados) {
    const marcacionesEmp = todasMarcaciones.filter(m => m.empleadoId === emp.id);
    const novedadesEmp = todasNovedades.filter(n => n.empleadoId === emp.id && n.estado === 'aprobado');

    let diasTrabajadosEfectivos = 0;
    let diasReposoPatronal = 0;
    let diasReposoIps = 0;
    let diasLicenciasPagas = 0;
    let diasCumpleanos = 0;
    let diasAusenciasInjustificadas = 0;
    let diasAusenciasSinGoce = 0;

    let minutosTardanzaTotal = 0;
    let horasExtras50Cant = 0;
    let horasExtras100Cant = 0;
    let recargoNocturno30Horas = 0;
    let diasLaborables = 0;

    // Recorremos cada día del mes
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaStr = `${anho}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const fechaDate = new Date(`${fechaStr}T12:00:00`);
      const esEspecial = esDomingoOFeriado(fechaDate);

      if (!esEspecial) {
        diasLaborables++;
      }

      // Verificamos si existe novedad activa en esta fecha
      const novedadActiva = novedadesEmp.find(n => n.fechaInicio <= fechaStr && n.fechaFin >= fechaStr);

      if (novedadActiva) {
        switch (novedadActiva.tipoNovedad) {
          case 'reposo_patronal':
            diasReposoPatronal++;
            break;
          case 'reposo_ips':
          case 'reposo_maternidad':
          case 'reposo_accidente_laboral':
            diasReposoIps++;
            break;
          case 'licencia_matrimonio':
          case 'licencia_paternidad':
          case 'licencia_duelo':
          case 'licencia_examen_preventivo':
          case 'licencia_donacion_sangre':
          case 'licencia_estudio':
          case 'ausencia_justificada_con_goce':
            diasLicenciasPagas++;
            break;
          case 'cumpleanos_asueto':
            diasCumpleanos++;
            break;
          case 'ausencia_injustificada':
            diasAusenciasInjustificadas++;
            break;
          case 'ausencia_justificada_sin_goce':
            diasAusenciasSinGoce++;
            break;
        }
        // Si hay novedad de día completo, no procesamos marcaciones ordinarias
        continue;
      }

      // Filtramos marcaciones del día
      const marcacionesDelDia = marcacionesEmp.filter(m => m.timestamp.startsWith(fechaStr));

      if (marcacionesDelDia.length > 0) {
        diasTrabajadosEfectivos++;
        const calcDia = calcularJornadaDiaria(fechaStr, marcacionesDelDia, config);
        minutosTardanzaTotal += calcDia.minutosTardanza;
        horasExtras50Cant += calcDia.horas50;
        horasExtras100Cant += calcDia.horas100;
        recargoNocturno30Horas += calcDia.recargoNocturnoHoras;
      }
    }

    // Si existe ajuste manual o sincronizado guardado por el usuario, prevalece sobre el conteo bruto
    const ajusteOvertime = getAjusteHorasExtrasEmpleado(clienteId, emp.id, mes, anho);
    if (ajusteOvertime) {
      horasExtras50Cant = ajusteOvertime.horas50;
      horasExtras100Cant = ajusteOvertime.horas100;
      recargoNocturno30Horas = ajusteOvertime.horasRecargoNocturno;
    }

    // Cálculo legal de base 30 (Código del Trabajo de Paraguay):
    // El mes laboral legal se estandariza en base 30.
    // Se descuentan ausencias injustificadas, permisos sin goce y reposos a cargo del IPS (que se suspenden en la nómina patronal).
    const diasADescontar = diasAusenciasInjustificadas + diasAusenciasSinGoce + diasReposoIps;
    const diasLiquidadosBase30 = Math.max(0, Math.min(30, 30 - diasADescontar));

    // Valor hora y cálculos monetarios en Guaraníes
    const salarioBase = emp.salarioBase;
    const jornal = salarioBase / 30;
    const valorHora = jornal / 8;

    const horasExtras50Monto = Math.round(horasExtras50Cant * valorHora * 1.5);
    const horasExtras100Monto = Math.round(horasExtras100Cant * valorHora * 2.0);
    const recargoNocturno30Monto = Math.round(recargoNocturno30Horas * valorHora * 0.3);

    const montoDescuentoTardanzas = config.descontarTardanzas
      ? Math.round((minutosTardanzaTotal / 60) * valorHora)
      : 0;

    const totalAdicionalesHoras = horasExtras50Monto + horasExtras100Monto + recargoNocturno30Monto;
    const totalDescuentosAsistencia = montoDescuentoTardanzas;
    const salarioDevengadoCalculado = Math.round(jornal * diasLiquidadosBase30);

    resumenes.push({
      empleadoId: emp.id,
      nombreCompleto: `${emp.nombres} ${emp.apellidos}`,
      ci: emp.ci,
      cargo: emp.cargo,
      departamento: emp.departamento,
      mes,
      anho,
      diasLaborables,
      diasTrabajadosEfectivos,
      diasReposoPatronal,
      diasReposoIps,
      diasLicenciasPagas,
      diasCumpleanos,
      diasAusenciasInjustificadas,
      diasAusenciasSinGoce,
      minutosTardanzaTotal,
      montoDescuentoTardanzas,
      horasExtras50Cant: Math.round(horasExtras50Cant * 10) / 10,
      horasExtras50Monto,
      horasExtras100Cant: Math.round(horasExtras100Cant * 10) / 10,
      horasExtras100Monto,
      recargoNocturno30Horas: Math.round(recargoNocturno30Horas * 10) / 10,
      recargoNocturno30Monto,
      totalAdicionalesHoras,
      totalDescuentosAsistencia,
      salarioBase,
      diasLiquidadosBase30,
      salarioDevengadoCalculado,
    });
  }

  return resumenes;
}

// ==============================================================================
// PUENTE DE INTEGRACIÓN: APLICAR ASISTENCIA A RECIBOS DE SALARIO
// ==============================================================================

/**
 * Transfiere los cálculos de horas extras, presentismo y ausencias directamente
 * a los recibos de salarios del mes seleccionado
 */
export function aplicarAsistenciaARecibosSalario(
  clienteId: string,
  mes: number,
  anho: number
): { recibosActualizados: number } {
  const resumenes = calcularResumenAsistenciaMensual(clienteId, mes, anho);
  const empleados = getEmpleadosByCliente(clienteId);
  const recibosExistentes = getRecibosByCliente(clienteId, mes, anho);

  const recibosNuevos: ReciboSalario[] = [];

  for (const emp of empleados) {
    if (emp.estado === 'inactivo') continue;
    const res = resumenes.find(r => r.empleadoId === emp.id);
    const actual = recibosExistentes.find(r => r.empleadoId === emp.id);

    const dias = res ? res.diasLiquidadosBase30 : (actual?.diasTrabajados ?? 30);
    const he50 = res ? res.horasExtras50Cant : (actual?.horasExtras50Cant ?? 0);
    const he100 = res ? res.horasExtras100Cant : (actual?.horasExtras100Cant ?? 0);
    const descTardanzas = res ? res.montoDescuentoTardanzas : 0;
    const otrosDescTotal = (actual?.otrosDescuentos || 0) + descTardanzas;
    const totalDiasReposo = (res?.diasReposoPatronal || 0) + (res?.diasReposoIps || 0);

    const recalculado = calcularReciboSalario(emp, mes, anho, {
      diasTrabajados: dias,
      horasExtras50Cant: he50,
      horasExtras100Cant: he100,
      comisionesPremios: actual?.comisionesPremios ?? 0,
      anticiposQuincena: actual?.anticiposQuincena ?? 0,
      judicialesAlimentos: actual?.judicialesAlimentos ?? 0,
      otrosDescuentos: otrosDescTotal,
      diasReposo: totalDiasReposo,
    });

    recibosNuevos.push(recalculado);
  }

  saveRecibosBatch(recibosNuevos);
  return { recibosActualizados: recibosNuevos.length };
}

// ==============================================================================
// DETECTOR DE CUMPLEAÑOS DEL MES (ASUETO INSTITUCIONAL)
// ==============================================================================

export interface CumpleanheroMes {
  empleado: Empleado;
  dia: number;
  fechaCumple: string;
  yaTieneAsueto: boolean;
}

export function getCumpleanherosDelMes(clienteId: string, mes: number): CumpleanheroMes[] {
  const empleados = getEmpleadosByCliente(clienteId).filter(e => e.estado !== 'inactivo');
  const novedades = getNovedadesByCliente(clienteId);
  const anhoActual = new Date().getFullYear();

  const cumpleanheros: CumpleanheroMes[] = [];

  for (const emp of empleados) {
    if (!emp.fechaNacimiento) continue;
    const [, mesNac, diaNac] = emp.fechaNacimiento.split('-').map(Number);
    if (mesNac === mes) {
      const fechaCumple = `${anhoActual}-${String(mes).padStart(2, '0')}-${String(diaNac).padStart(2, '0')}`;
      const yaTiene = novedades.some(
        n => n.empleadoId === emp.id && n.tipoNovedad === 'cumpleanos_asueto' && n.fechaInicio.startsWith(`${anhoActual}-${String(mes).padStart(2, '0')}`)
      );

      cumpleanheros.push({
        empleado: emp,
        dia: diaNac,
        fechaCumple,
        yaTieneAsueto: yaTiene,
      });
    }
  }

  return cumpleanheros.sort((a, b) => a.dia - b.dia);
}

// ==============================================================================
// GESTIÓN DE AJUSTES MANUALES Y SUGERENCIAS BIOMÉTRICAS DE HORAS EXTRAS
// ==============================================================================

export interface AjusteHorasExtrasEmpleado {
  clienteId: string;
  empleadoId: string;
  mes: number;
  anho: number;
  horas50: number;
  horas100: number;
  horas130: number;
  horasRecargoNocturno: number;
  feriadosTrabajados: number;
  salarioMensual: number;
  montoTotal: number;
  fuente: 'manual' | 'biometrico_sincronizado';
  updatedAt: string;
}

export function getAjustesHorasExtrasByCliente(clienteId: string): AjusteHorasExtrasEmpleado[] {
  const raw = getSafeStorage().getItem(ATTENDANCE_STORAGE_KEYS.AJUSTES_OVERTIME);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((a: any) => a.clienteId === clienteId) : [];
  } catch {
    return [];
  }
}

export function getAjusteHorasExtrasEmpleado(
  clienteId: string,
  empleadoId: string,
  mes: number,
  anho: number
): AjusteHorasExtrasEmpleado | null {
  const ajustes = getAjustesHorasExtrasByCliente(clienteId);
  return (
    ajustes.find((a) => a.empleadoId === empleadoId && a.mes === mes && a.anho === anho) || null
  );
}

export function saveAjusteHorasExtrasEmpleado(ajuste: AjusteHorasExtrasEmpleado): void {
  const raw = getSafeStorage().getItem(ATTENDANCE_STORAGE_KEYS.AJUSTES_OVERTIME);
  let list: AjusteHorasExtrasEmpleado[] = [];
  try {
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  const filtered = list.filter(
    (a) =>
      !(
        a.clienteId === ajuste.clienteId &&
        a.empleadoId === ajuste.empleadoId &&
        a.mes === ajuste.mes &&
        a.anho === ajuste.anho
      )
  );
  filtered.push(ajuste);
  try {
    getSafeStorage().setItem(ATTENDANCE_STORAGE_KEYS.AJUSTES_OVERTIME, JSON.stringify(filtered));
  } catch (e) {
    console.error('[attendanceService] Error guardando ajuste overtime:', e);
  }
}

export function deleteAjusteHorasExtrasEmpleado(
  clienteId: string,
  empleadoId: string,
  mes: number,
  anho: number
): void {
  const raw = getSafeStorage().getItem(ATTENDANCE_STORAGE_KEYS.AJUSTES_OVERTIME);
  if (!raw) return;
  try {
    const list: AjusteHorasExtrasEmpleado[] = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const filtered = list.filter(
      (a) =>
        !(
          a.clienteId === clienteId &&
          a.empleadoId === empleadoId &&
          a.mes === mes &&
          a.anho === anho
        )
    );
    getSafeStorage().setItem(ATTENDANCE_STORAGE_KEYS.AJUSTES_OVERTIME, JSON.stringify(filtered));
  } catch (e) {
    console.error('[attendanceService] Error eliminando ajuste overtime:', e);
  }
}

/**
 * Obtiene las horas estimadas o reales desde el marcador biométrico (API / Reloj) para un empleado.
 * Los valores retornados son 100% editables por el usuario.
 */
export function obtenerHorasSugeridasBiometrico(
  clienteId: string,
  empleadoId: string,
  mes: number,
  anho: number
): {
  horas50: number;
  horas100: number;
  horas130: number;
  horasRecargoNocturno: number;
  feriadosTrabajados: number;
  totalMarcaciones: number;
  fuente: 'marcador_api' | 'estimado_demostracion';
} {
  const todasMarcaciones = getMarcacionesByCliente(clienteId);
  const empMarcaciones = todasMarcaciones.filter((m) => {
    if (m.empleadoId !== empleadoId) return false;
    const d = new Date(m.timestamp);
    return d.getMonth() + 1 === mes && d.getFullYear() === anho;
  });

  if (empMarcaciones.length > 0) {
    const config = getConfigBiometricoByCliente(clienteId);
    const diasEnMes = new Date(anho, mes, 0).getDate();
    let h50 = 0;
    let h100 = 0;
    let recNoct = 0;

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaStr = `${anho}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const marcDia = empMarcaciones.filter((m) => m.timestamp.startsWith(fechaStr));
      if (marcDia.length > 0) {
        const c = calcularJornadaDiaria(fechaStr, marcDia, config);
        h50 += c.horas50;
        h100 += c.horas100;
        recNoct += c.recargoNocturnoHoras;
      }
    }

    return {
      horas50: Math.round(h50 * 10) / 10,
      horas100: Math.round(h100 * 10) / 10,
      horas130: 0,
      horasRecargoNocturno: Math.round(recNoct * 10) / 10,
      feriadosTrabajados: 0,
      totalMarcaciones: empMarcaciones.length,
      fuente: 'marcador_api',
    };
  }

  // Ejemplo inteligente editable sugerido cuando aún no hay marcaciones en el período
  return {
    horas50: 3.7,
    horas100: 5.0,
    horas130: 3.0,
    horasRecargoNocturno: 2.0,
    feriadosTrabajados: 0,
    totalMarcaciones: 0,
    fuente: 'estimado_demostracion',
  };
}
