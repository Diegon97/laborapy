/**
 * SERVICIO DE ALMACENAMIENTO Y CÁLCULOS — PORTAL DE CLIENTES (ERP LABORAPY)
 * Capa híbrida con soporte para Supabase Cloud y persistencia local cifrada
 */

import type {
  EmpresaCliente,
  Empleado,
  ReciboSalario,
  ContratoTrabajo,
  DocumentoCumplimiento,
  DashboardMetrics,
  TrialPeriodAlert,
  VacationAlert,
  RegistroVacacion,
  ConfiguracionAntiguedad,
  AlertaAntiguedad,
  CertificadoLactanciaTrimestral,
  RegistroMaternidad,
  AlertaMaternidadLactancia,
  AdendaContrato,
} from '../types/clientPortal';
import {
  DEMO_EMPRESAS,
  DEMO_EMPLEADOS,
  DEMO_CONTRATOS,
  DEMO_DOCUMENTOS,
  DEMO_VACACIONES,
  DEMO_MATERNIDAD,
  DEMO_ADENDAS,
} from '../constants/demoData';

const STORAGE_KEYS = {
  EMPRESAS: 'laborapy_erp_empresas',
  EMPLEADOS: 'laborapy_erp_empleados',
  RECIBOS: 'laborapy_erp_recibos',
  CONTRATOS: 'laborapy_erp_contratos',
  ADENDAS: 'laborapy_erp_adendas',
  DOCUMENTOS: 'laborapy_erp_documentos',
  VACACIONES: 'laborapy_erp_vacaciones',
  MATERNIDAD: 'laborapy_erp_maternidad',
  CONFIG_ANTIGUEDAD: 'laborapy_erp_config_antiguedad',
};

// Salario Mínimo Legal Vigente en Paraguay (vigente hasta Junio 2027): Gs. 3.044.000
export const SALARIO_MINIMO_LEGAL_PY = 3044000;

// Configuración por defecto de antigüedad y estabilidad especial (Art. 94 Ley 213/93)
export const DEFAULT_CONFIG_ANTIGUEDAD: ConfiguracionAntiguedad = {
  umbralAnhosHombres: 9,
  umbralAnhosMujeres: 8,
  alertarDiasAntes: 60,
};

const memoryStore = new Map<string, string>();

export function getSafeStorage(): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  clear: () => void;
} {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return {
    getItem: (k: string) => memoryStore.get(k) || null,
    setItem: (k: string, v: string) => {
      memoryStore.set(k, v);
    },
    removeItem: (k: string) => {
      memoryStore.delete(k);
    },
    clear: () => {
      memoryStore.clear();
    },
  };
}

// 1. Inicialización de datos locales
let isInitializing = false;

function initializeLocalStorage() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    const storage = getSafeStorage();

    if (!storage.getItem(STORAGE_KEYS.EMPRESAS)) {
      storage.setItem(STORAGE_KEYS.EMPRESAS, JSON.stringify(DEMO_EMPRESAS));
    }
    if (!storage.getItem(STORAGE_KEYS.EMPLEADOS)) {
      storage.setItem(STORAGE_KEYS.EMPLEADOS, JSON.stringify(DEMO_EMPLEADOS));
    }
    if (!storage.getItem(STORAGE_KEYS.CONTRATOS)) {
      storage.setItem(STORAGE_KEYS.CONTRATOS, JSON.stringify(DEMO_CONTRATOS));
    }
    if (!storage.getItem(STORAGE_KEYS.DOCUMENTOS)) {
      storage.setItem(STORAGE_KEYS.DOCUMENTOS, JSON.stringify(DEMO_DOCUMENTOS));
    }
    if (!storage.getItem(STORAGE_KEYS.VACACIONES)) {
      storage.setItem(STORAGE_KEYS.VACACIONES, JSON.stringify(DEMO_VACACIONES));
    }
    if (!storage.getItem(STORAGE_KEYS.MATERNIDAD)) {
      storage.setItem(STORAGE_KEYS.MATERNIDAD, JSON.stringify(DEMO_MATERNIDAD));
    }
    if (!storage.getItem(STORAGE_KEYS.ADENDAS)) {
      storage.setItem(STORAGE_KEYS.ADENDAS, JSON.stringify(DEMO_ADENDAS));
    }
    if (!storage.getItem(STORAGE_KEYS.RECIBOS)) {
      storage.setItem(STORAGE_KEYS.RECIBOS, '[]');
      const recibosIniciales = DEMO_EMPLEADOS
        .filter(e => e.clienteId === 'emp_guarani_001' && e.estado !== 'inactivo')
        .map(emp => calcularReciboSalario(emp, 8, 2026));
      storage.setItem(STORAGE_KEYS.RECIBOS, JSON.stringify(recibosIniciales));
    }
  } finally {
    isInitializing = false;
  }
}

// ==============================================================================
// GESTIÓN DE EMPRESAS CLIENTES
// ==============================================================================
export function getEmpresasClientes(): EmpresaCliente[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.EMPRESAS);
    return raw ? JSON.parse(raw) : DEMO_EMPRESAS;
  } catch {
    return DEMO_EMPRESAS;
  }
}

export function getEmpresaById(id: string): EmpresaCliente | undefined {
  const empresas = getEmpresasClientes();
  return empresas.find(e => e.id === id);
}

export function saveEmpresaCliente(empresa: EmpresaCliente): void {
  const empresas = getEmpresasClientes();
  const idx = empresas.findIndex(e => e.id === empresa.id);
  if (idx >= 0) {
    empresas[idx] = empresa;
  } else {
    empresas.push(empresa);
  }
  getSafeStorage().setItem(STORAGE_KEYS.EMPRESAS, JSON.stringify(empresas));
}

// ==============================================================================
// GESTIÓN DE EMPLEADOS (FICHA ELECTRÓNICA)
// ==============================================================================
export function getEmpleadosByCliente(clienteId: string): Empleado[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
    const todos: Empleado[] = raw ? JSON.parse(raw) : DEMO_EMPLEADOS;
    return todos.filter(emp => emp.clienteId === clienteId);
  } catch {
    return DEMO_EMPLEADOS.filter(emp => emp.clienteId === clienteId);
  }
}

export function getEmpleadoById(id: string): Empleado | undefined {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
    const todos: Empleado[] = raw ? JSON.parse(raw) : DEMO_EMPLEADOS;
    return todos.find(emp => emp.id === id);
  } catch {
    return DEMO_EMPLEADOS.find(emp => emp.id === id);
  }
}

export function saveEmpleado(empleado: Empleado): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
  const todos: Empleado[] = raw ? JSON.parse(raw) : DEMO_EMPLEADOS;
  const idx = todos.findIndex(e => e.id === empleado.id);
  if (idx >= 0) {
    todos[idx] = empleado;
  } else {
    todos.unshift(empleado);
  }
  getSafeStorage().setItem(STORAGE_KEYS.EMPLEADOS, JSON.stringify(todos));
}

export function deleteEmpleado(id: string): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
  if (!raw) return;
  const todos: Empleado[] = JSON.parse(raw);
  const filtrados = todos.filter(e => e.id !== id);
  getSafeStorage().setItem(STORAGE_KEYS.EMPLEADOS, JSON.stringify(filtrados));
}

// ==============================================================================
// GESTIÓN DE CONTRATOS LABORALES (PDF)
// ==============================================================================
export function getContratosByCliente(clienteId: string): ContratoTrabajo[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.CONTRATOS);
    const todos: ContratoTrabajo[] = raw ? JSON.parse(raw) : DEMO_CONTRATOS;
    return todos.filter(c => c.clienteId === clienteId);
  } catch {
    return DEMO_CONTRATOS.filter(c => c.clienteId === clienteId);
  }
}

export function saveContratoTrabajo(contrato: ContratoTrabajo): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.CONTRATOS);
  const todos: ContratoTrabajo[] = raw ? JSON.parse(raw) : DEMO_CONTRATOS;
  const idx = todos.findIndex(c => c.id === contrato.id);
  if (idx >= 0) {
    todos[idx] = contrato;
  } else {
    todos.unshift(contrato);
  }
  getSafeStorage().setItem(STORAGE_KEYS.CONTRATOS, JSON.stringify(todos));
}

// ==============================================================================
// GESTIÓN DE ADENDAS CONTRACTUALES (PDF / LEY N.º 213/93)
// ==============================================================================
export function getAdendasByCliente(clienteId: string): AdendaContrato[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.ADENDAS);
    const todas: AdendaContrato[] = raw ? JSON.parse(raw) : DEMO_ADENDAS;
    return todas.filter(a => a.clienteId === clienteId);
  } catch {
    return DEMO_ADENDAS.filter(a => a.clienteId === clienteId);
  }
}

export function getSiguienteNroAdenda(clienteId: string, empleadoId: string): number {
  const adendas = getAdendasByCliente(clienteId).filter(a => a.empleadoId === empleadoId);
  if (adendas.length === 0) return 1;
  return Math.max(...adendas.map(a => a.nroAdenda || 1)) + 1;
}

export function saveAdendaContrato(adenda: AdendaContrato): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.ADENDAS);
  const todas: AdendaContrato[] = raw ? JSON.parse(raw) : DEMO_ADENDAS;
  const idx = todas.findIndex(a => a.id === adenda.id);
  if (idx >= 0) {
    todas[idx] = adenda;
  } else {
    todas.unshift(adenda);
  }
  getSafeStorage().setItem(STORAGE_KEYS.ADENDAS, JSON.stringify(todas));
}

export function deleteAdendaContrato(id: string): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.ADENDAS);
  if (!raw) return;
  const todas: AdendaContrato[] = JSON.parse(raw);
  const filtradas = todas.filter(a => a.id !== id);
  getSafeStorage().setItem(STORAGE_KEYS.ADENDAS, JSON.stringify(filtradas));
}

// ==============================================================================
// GESTIÓN DE DOCUMENTOS DE CUMPLIMIENTO (MTESS / EXTRACTOS IPS)
// ==============================================================================
export function getDocumentosByCliente(clienteId: string): DocumentoCumplimiento[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.DOCUMENTOS);
    const todos: DocumentoCumplimiento[] = raw ? JSON.parse(raw) : DEMO_DOCUMENTOS;
    return todos.filter(d => d.clienteId === clienteId);
  } catch {
    return DEMO_DOCUMENTOS.filter(d => d.clienteId === clienteId);
  }
}

export function saveDocumentoCumplimiento(doc: DocumentoCumplimiento): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.DOCUMENTOS);
  const todos: DocumentoCumplimiento[] = raw ? JSON.parse(raw) : DEMO_DOCUMENTOS;
  const idx = todos.findIndex(d => d.id === doc.id);
  if (idx >= 0) {
    todos[idx] = doc;
  } else {
    todos.unshift(doc);
  }
  getSafeStorage().setItem(STORAGE_KEYS.DOCUMENTOS, JSON.stringify(todos));
}

// ==============================================================================
// GESTIÓN DE VACACIONES (REALES VS MTESS - ARTS. 218 A 226 LEY 213/93)
// ==============================================================================
export function calcularDiasVacacionesSegunAntiguedad(
  fechaIngresoStr: string,
  fechaCalculo: Date = new Date()
): { antiguedadAnhos: number; diasEscala: number } {
  const fIng = new Date(fechaIngresoStr);
  if (isNaN(fIng.getTime())) return { antiguedadAnhos: 0, diasEscala: 0 };

  const diffMs = fechaCalculo.getTime() - fIng.getTime();
  const antiguedadAnhos = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));

  if (antiguedadAnhos < 1) {
    return { antiguedadAnhos, diasEscala: 0 };
  } else if (antiguedadAnhos <= 5) {
    // De 1 a 5 años: 12 días corridos (Art. 218 inc. a)
    return { antiguedadAnhos, diasEscala: 12 };
  } else if (antiguedadAnhos <= 10) {
    // De más de 5 a 10 años: 18 días corridos (Art. 218 inc. b)
    return { antiguedadAnhos, diasEscala: 18 };
  } else {
    // De más de 10 años: 30 días corridos (Art. 218 inc. c)
    return { antiguedadAnhos, diasEscala: 30 };
  }
}

export function getVacacionesByCliente(clienteId: string): RegistroVacacion[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.VACACIONES);
    const todos: RegistroVacacion[] = raw ? JSON.parse(raw) : DEMO_VACACIONES;
    return todos.filter(v => v.clienteId === clienteId);
  } catch {
    return DEMO_VACACIONES.filter(v => v.clienteId === clienteId);
  }
}

export function saveRegistroVacacion(reg: RegistroVacacion): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.VACACIONES);
  const todos: RegistroVacacion[] = raw ? JSON.parse(raw) : DEMO_VACACIONES;
  const idx = todos.findIndex(v => v.id === reg.id);
  if (idx >= 0) {
    todos[idx] = reg;
  } else {
    todos.unshift(reg);
  }
  getSafeStorage().setItem(STORAGE_KEYS.VACACIONES, JSON.stringify(todos));
}

export function deleteRegistroVacacion(id: string): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.VACACIONES);
  if (!raw) return;
  const todos: RegistroVacacion[] = JSON.parse(raw);
  const filtrados = todos.filter(v => v.id !== id);
  getSafeStorage().setItem(STORAGE_KEYS.VACACIONES, JSON.stringify(filtrados));
}

export function marcarVacacionComunicadaMtess(
  id: string,
  nroComprobante: string,
  mesComunicacion: string,
  diasComunicados?: number
): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.VACACIONES);
  if (!raw) return;
  const todos: RegistroVacacion[] = JSON.parse(raw);
  const vac = todos.find(v => v.id === id);
  if (vac) {
    vac.comunicadoMtess = true;
    vac.nroComprobanteMtess = nroComprobante;
    vac.mesComunicacionMtess = mesComunicacion;
    vac.fechaComunicacionMtess = new Date().toISOString().split('T')[0];
    if (diasComunicados !== undefined) {
      vac.diasComunicadosMtess = diasComunicados;
    } else {
      vac.diasComunicadosMtess = vac.diasUsufructuadosReal || vac.diasCorrespondientes;
    }
    getSafeStorage().setItem(STORAGE_KEYS.VACACIONES, JSON.stringify(todos));
  }
}

export function generarPlanillaVacacionesMtessCSV(
  vacaciones: RegistroVacacion[],
  empleados: Empleado[],
  empresa: EmpresaCliente
): string {
  const header = [
    'RUC_EMPRESA',
    'PATRONAL_MTESS',
    'DOCUMENTO_CI',
    'APELLIDOS_NOMBRES',
    'CARGO',
    'FECHA_INGRESO',
    'PERIODO_CAUSADO',
    'DIAS_CAUSADOS',
    'FECHA_INICIO_USUFRUCTO',
    'FECHA_FIN_USUFRUCTO',
    'DIAS_USUFRUCTUADOS',
    'ESTADO_COMUNICACION',
    'NRO_COMPROBANTE_REOP',
    'MES_PRESENTACION'
  ].join(';');

  const empMap = new Map(empleados.map(e => [e.id, e]));

  const rows = vacaciones.map(v => {
    const emp = empMap.get(v.empleadoId);
    return [
      `${empresa.ruc}-${empresa.dv}`,
      empresa.nroPatronalMtess || '',
      emp?.ci || '',
      `"${emp ? `${emp.apellidos}, ${emp.nombres}` : ''}"`,
      `"${emp?.cargo || ''}"`,
      emp?.fechaIngreso || '',
      v.periodoAnho,
      v.diasCorrespondientes,
      v.fechaInicioReal || '',
      v.fechaFinReal || '',
      v.diasUsufructuadosReal,
      v.comunicadoMtess ? 'COMUNICADO_REOP' : 'PENDIENTE',
      v.nroComprobanteMtess || '',
      v.mesComunicacionMtess || '',
    ].join(';');
  });

  return [header, ...rows].join('\r\n');
}

// ==============================================================================
// GESTIÓN DE CONFIGURACIÓN DE ANTIGÜEDAD Y ESTABILIDAD ESPECIAL (ART. 94)
// ==============================================================================
export function getConfiguracionAntiguedad(clienteId: string): ConfiguracionAntiguedad {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(`${STORAGE_KEYS.CONFIG_ANTIGUEDAD}_${clienteId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const empresa = getEmpresaById(clienteId);
  return empresa?.configAntiguedad || DEFAULT_CONFIG_ANTIGUEDAD;
}

export function saveConfiguracionAntiguedad(clienteId: string, config: ConfiguracionAntiguedad): void {
  initializeLocalStorage();
  getSafeStorage().setItem(`${STORAGE_KEYS.CONFIG_ANTIGUEDAD}_${clienteId}`, JSON.stringify(config));
  const empresa = getEmpresaById(clienteId);
  if (empresa) {
    empresa.configAntiguedad = config;
    saveEmpresaCliente(empresa);
  }
}

export function calcularAlertaAntiguedadEmpleado(
  empleado: Empleado,
  config: ConfiguracionAntiguedad,
  hoy: Date = new Date()
): AlertaAntiguedad {
  const fIng = new Date(empleado.fechaIngreso);
  let anhos = hoy.getFullYear() - fIng.getFullYear();
  let meses = hoy.getMonth() - fIng.getMonth();
  let dias = hoy.getDate() - fIng.getDate();

  if (dias < 0) {
    meses -= 1;
    const diasMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
    dias += diasMesAnterior;
  }
  if (meses < 0) {
    anhos -= 1;
    meses += 12;
  }

  const antiguedadDecimal = anhos + meses / 12 + dias / 365.25;
  const umbral = empleado.sexo === 'F' ? config.umbralAnhosMujeres : config.umbralAnhosHombres;
  const alcanzoUmbral = antiguedadDecimal >= umbral;

  const anhosPara10 = Math.max(0, 10 - antiguedadDecimal);
  const mesesPara10 = Math.max(0, Math.round((10 - antiguedadDecimal) * 12));

  let nivelRiesgo: AlertaAntiguedad['nivelRiesgo'] = 'alerta_preventiva';
  let tiempoRestanteTexto = '';
  let mensajeEstrategico = '';

  if (antiguedadDecimal >= 10) {
    nivelRiesgo = 'estable_adquirida';
    tiempoRestanteTexto = 'Estabilidad especial adquirida (>10 años continuos)';
    mensajeEstrategico =
      'El trabajador ha consolidado la estabilidad especial propia (Art. 94). El despido sólo procede mediante juicio previo de justificación de causal ante el Juzgado del Trabajo, con carga probatoria patronal plena.';
  } else if (antiguedadDecimal >= 9.5) {
    nivelRiesgo = 'critico_proximo_10';
    tiempoRestanteTexto = `¡CRÍTICO! Faltan aprox. ${mesesPara10} mes(es) para alcanzar los 10 años`;
    mensajeEstrategico =
      'Ventana crítica de decisión legal: restan menos de 6 meses para que el colaborador adquiera estabilidad absoluta (Art. 94). Se recomienda revisión urgente de legajo con Asesoría Jurídica.';
  } else if (alcanzoUmbral) {
    nivelRiesgo = 'alerta_preventiva';
    tiempoRestanteTexto = `Faltan aprox. ${anhosPara10.toFixed(1)} año(s) (${mesesPara10} meses) para los 10 años`;
    mensajeEstrategico =
      `Alerta preventiva activada (Umbral de ${umbral} años alcanzado para ${empleado.sexo === 'F' ? 'mujeres' : 'hombres'}). Período estratégico para plan de carrera, retención o evaluación de contingencia laboral.`;
  } else {
    tiempoRestanteTexto = `Faltan aprox. ${anhosPara10.toFixed(1)} año(s) para los 10 años`;
    mensajeEstrategico = 'Dentro del régimen ordinario sin proximidad inmediata a la estabilidad especial.';
  }

  const antiguedadTexto = `${anhos} año(s)${meses > 0 ? `, ${meses} mes(es)` : ''}`;

  return {
    empleadoId: empleado.id,
    nombreCompleto: `${empleado.nombres} ${empleado.apellidos}`,
    ci: empleado.ci,
    cargo: empleado.cargo,
    departamento: empleado.departamento,
    sexo: empleado.sexo,
    fechaIngreso: empleado.fechaIngreso,
    antiguedadAnhos: anhos,
    antiguedadMeses: meses,
    antiguedadDias: dias,
    antiguedadTexto,
    umbralAplicadoAnhos: umbral,
    alcanzoUmbral,
    anhosParaEstabilidad10: Number(anhosPara10.toFixed(2)),
    tiempoRestanteParaEstabilidadTexto: tiempoRestanteTexto,
    nivelRiesgo,
    mensajeEstrategico,
  };
}

export function getAlertasAntiguedad(
  clienteId: string,
  customConfig?: ConfiguracionAntiguedad,
  hoy: Date = new Date()
): AlertaAntiguedad[] {
  const config = customConfig || getConfiguracionAntiguedad(clienteId);
  const empleados = getEmpleadosByCliente(clienteId).filter(e => e.estado !== 'inactivo');

  const alertas: AlertaAntiguedad[] = [];
  for (const emp of empleados) {
    const alerta = calcularAlertaAntiguedadEmpleado(emp, config, hoy);
    if (alerta.alcanzoUmbral || alerta.antiguedadAnhos >= 10) {
      alertas.push(alerta);
    }
  }

  // Ordenar primero los que están más próximos o ya pasaron los 10 años
  return alertas.sort((a, b) => b.antiguedadAnhos - a.antiguedadAnhos);
}

// ==============================================================================
// CÁLCULO DE RECIBOS DE SALARIO SEGÚN ART. 235/236 CÓDIGO DEL TRABAJO
// ==============================================================================
export function calcularReciboSalario(
  empleado: Empleado,
  mes: number,
  anho: number,
  params?: {
    diasTrabajados?: number;
    horasExtras50Cant?: number;
    horasExtras100Cant?: number;
    comisionesPremios?: number;
    anticiposQuincena?: number;
    judicialesAlimentos?: number;
    otrosDescuentos?: number;
    diasReposo?: number;
  }
): ReciboSalario {
  const dias = params?.diasTrabajados ?? 30;
  const salarioBase = empleado.salarioBase;

  // Valor hora normal (jornal diario / 8 horas de jornada ordinaria)
  const jornalDiario = salarioBase / 30;
  const valorHora = jornalDiario / 8;

  // Horas Extras
  const he50Cant = params?.horasExtras50Cant ?? 0;
  const he50Monto = Math.round(he50Cant * valorHora * 1.5);

  const he100Cant = params?.horasExtras100Cant ?? 0;
  const he100Monto = Math.round(he100Cant * valorHora * 2.0);

  const comisiones = params?.comisionesPremios ?? 0;

  // ── 1. Política Patronal de Reposos Médicos (0%, 50%, 100%) ────────────────
  // El empleador NO tiene la obligación legal de pagar reposos (subsidio IPS Dec-Ley 1860/50).
  // La empresa puede configurar si asume 0% (legal estricto), 50% o 100% (beneficio patronal).
  const empresa = getEmpresaById(empleado.clienteId);
  const coberturaReposoPorcentaje = empresa?.politicaReposoPatronal?.coberturaPorcentaje ?? 0;
  const diasReposo = params?.diasReposo ?? 0;
  const valorReposoTotal = Math.round(jornalDiario * diasReposo);

  let descuentoReposo = 0;
  let montoReposoPagadoPatronal = 0;

  if (diasReposo > 0) {
    if (coberturaReposoPorcentaje === 0) {
      // 0% cobertura: se descuenta el 100% del valor de los días de reposo
      descuentoReposo = valorReposoTotal;
      montoReposoPagadoPatronal = 0;
    } else if (coberturaReposoPorcentaje === 50) {
      // 50% cobertura: el empleador cubre la mitad
      descuentoReposo = Math.round(valorReposoTotal * 0.5);
      montoReposoPagadoPatronal = valorReposoTotal - descuentoReposo;
    } else if (coberturaReposoPorcentaje === 100) {
      // 100% beneficio patronal completo: no se descuenta del sueldo del trabajador
      descuentoReposo = 0;
      montoReposoPagadoPatronal = valorReposoTotal;
    }
  }

  // Salario devengado con aplicación de política de reposos
  const diasTrabajadosEfectivos = diasReposo > 0 ? Math.max(0, dias - diasReposo) : Math.min(dias, 30);
  const salarioDevengadoBase = Math.round((salarioBase / 30) * Math.min(dias, 30));
  const salarioDevengado = Math.max(0, salarioDevengadoBase - descuentoReposo);

  // ── 2. Bonificación Familiar Avanzada (Arts. 261 al 271 Ley 213/93) ─────────
  // A) Tope Legal: máximo dos (2) Salarios Mínimos Legales (Art. 263 C.T.)
  const topeDosSueldosMinimos = SALARIO_MINIMO_LEGAL_PY * 2;
  const totalRemuneracionComputable = salarioBase + comisiones;
  const superaTopeDosSueldos = totalRemuneracionComputable > topeDosSueldosMinimos;

  // B) Regla de Progenitores en la misma empresa (Art. 265 C.T.):
  //    - Se abona exclusivamente a la madre.
  //    - Si la madre supera 2 salarios mínimos (ej. vendedora), no cobra la madre y NO se traslada al padre.
  let esPadreExcluido = false;
  if (empleado.parejaEmpleadoId) {
    const colegas = getEmpleadosByCliente(empleado.clienteId);
    const conyuge = colegas.find(c => c.id === empleado.parejaEmpleadoId);
    if (conyuge) {
      if (empleado.sexo === 'M' && conyuge.sexo === 'F') {
        // El empleado es el padre y la madre trabaja en la empresa -> cobro exclusivo para la madre
        esPadreExcluido = true;
      }
      if (empleado.sexo === 'M' && ((conyuge.salarioBase + (params?.comisionesPremios ?? 0)) > topeDosSueldosMinimos)) {
        // La madre supera los 2 salarios mínimos -> tampoco cobra el padre
        esPadreExcluido = true;
      }
    }
  }

  // C) Hijos menores de 18 años (hasta 17 cumplidos) + Hijos con discapacidad (vitalicios Art. 261)
  const totalHijosBeneficiarios = (empleado.hijosMenores || 0) + (empleado.hijosDiscapacidad || 0);
  const bonifPorHijo = Math.round(SALARIO_MINIMO_LEGAL_PY * 0.05);

  const bonificacionFamiliar = (superaTopeDosSueldos || esPadreExcluido || totalHijosBeneficiarios <= 0)
    ? 0
    : bonifPorHijo * totalHijosBeneficiarios;

  // Total Ingresos Brutos
  const totalIngresosBrutos = salarioDevengado + he50Monto + he100Monto + comisiones + bonificacionFamiliar;

  // Base Imponible IPS: Según Art. 76 del Dec-Ley 1860/50, incluye salario, horas extras y comisiones (excluye bonificación familiar)
  const baseImponibleIps = salarioDevengado + he50Monto + he100Monto + comisiones;
  const ipsObrero9 = Math.round(baseImponibleIps * 0.09);

  const anticipos = params?.anticiposQuincena ?? 0;
  const judiciales = params?.judicialesAlimentos ?? 0;
  const otrosDesc = params?.otrosDescuentos ?? 0;

  const totalDeducciones = ipsObrero9 + anticipos + judiciales + otrosDesc;
  const salarioNeto = Math.max(0, totalIngresosBrutos - totalDeducciones);

  return {
    id: `rec_${empleado.id}_${anho}_${String(mes).padStart(2, '0')}`,
    clienteId: empleado.clienteId,
    empleadoId: empleado.id,
    mes,
    anho,
    // En IPS los días trabajados efectivos descuentan siempre el reposo para permitir el subsidio
    diasTrabajados: diasReposo > 0 ? diasTrabajadosEfectivos : Math.min(dias, 30),
    salarioBase,
    salarioDevengado,
    horasExtras50Cant: he50Cant,
    horasExtras50Monto: he50Monto,
    horasExtras100Cant: he100Cant,
    horasExtras100Monto: he100Monto,
    comisionesPremios: comisiones,
    bonificacionFamiliar,
    totalIngresosBrutos,
    ipsObrero9,
    anticiposQuincena: anticipos,
    judicialesAlimentos: judiciales,
    otrosDescuentos: otrosDesc,
    totalDeducciones,
    salarioNeto,
    salarioNetoLetras: numeroALetrasGuaranies(salarioNeto),
    diasReposo,
    coberturaPatronalReposoPorcentaje: coberturaReposoPorcentaje,
    descuentoReposo,
    montoReposoPagadoPatronal,
    qrVerificacion: `LABORAPY-RECIBO-${empleado.ci}-${anho}${String(mes).padStart(2, '0')}`,
    fechaEmision: new Date().toISOString().split('T')[0],
  };
}

export function generarRecibosAutomaticosParaEmpresa(
  clienteId: string,
  mes: number,
  anho: number
): ReciboSalario[] {
  const empleados = getEmpleadosByCliente(clienteId).filter(e => e.estado !== 'inactivo');
  return empleados.map(emp => calcularReciboSalario(emp, mes, anho));
}

export function getRecibosByCliente(clienteId: string, mes?: number, anho?: number): ReciboSalario[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.RECIBOS);
    const todos: ReciboSalario[] = raw ? JSON.parse(raw) : [];
    return todos.filter(r => {
      const matchCliente = r.clienteId === clienteId;
      const matchMes = mes ? r.mes === mes : true;
      const matchAnho = anho ? r.anho === anho : true;
      return matchCliente && matchMes && matchAnho;
    });
  } catch {
    return [];
  }
}

export function saveRecibosBatch(recibos: ReciboSalario[]): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.RECIBOS);
  const todos: ReciboSalario[] = raw ? JSON.parse(raw) : [];

  for (const nuevo of recibos) {
    const idx = todos.findIndex(r => r.id === nuevo.id);
    if (idx >= 0) {
      todos[idx] = nuevo;
    } else {
      todos.push(nuevo);
    }
  }

  getSafeStorage().setItem(STORAGE_KEYS.RECIBOS, JSON.stringify(todos));
}

// ==============================================================================
// GESTIÓN DE MATERNIDAD, LACTANCIA (90 MIN) Y FUERO LABORAL (LEY 5508/15 Y 7097/23)
// ==============================================================================

export interface CronogramaMaternidadCalculado {
  fechaInicioReposo: string;
  fechaFinReposo: string;
  diasReposoCorridos: number; // 126 días (18 semanas continuas)
  fechaReincorporacionTrabajo: string;
  fechaFinLactanciaObligatoria: string; // 6 meses desde nacimiento/FPP
  fechaLimiteMaximoLactancia24Meses: string; // 24 meses desde nacimiento/FPP
  fechasRecomendadasCertificadosTrimestrales: {
    nroTrimestre: number;
    mesVidaBebe: number;
    fechaLimitePresentacion: string;
  }[];
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function calcularCronogramaMaternidadLactancia(
  fppStr: string,
  _fechaNotificacionStr?: string,
  fechaPartoRealStr?: string,
  inicioAnticipadoDias: number = 14
): CronogramaMaternidadCalculado {
  const fppDate = parseDateISO(fppStr);
  const inicioDate = new Date(fppDate);
  inicioDate.setDate(inicioDate.getDate() - inicioAnticipadoDias);

  const fechaInicioReposo = formatDateISO(inicioDate);

  // Ley 5508/15 modif. Ley 7097/23: 18 semanas continuas = 126 días corridos
  // El día de inicio cuenta como día 1, el día 126 es inicio + 125 días
  const finReposoDate = new Date(inicioDate);
  finReposoDate.setDate(finReposoDate.getDate() + 125);
  const fechaFinReposo = formatDateISO(finReposoDate);

  const reincorpDate = new Date(finReposoDate);
  reincorpDate.setDate(reincorpDate.getDate() + 1);
  const fechaReincorporacionTrabajo = formatDateISO(reincorpDate);

  // Base para lactancia: Parto real o FPP si aún no nació
  const baseNacimiento = fechaPartoRealStr ? parseDateISO(fechaPartoRealStr) : fppDate;

  // Lactancia obligatoria: Primeros 6 meses de vida (Art. 14 Ley 5508/15)
  const fin6mDate = new Date(baseNacimiento);
  fin6mDate.setMonth(fin6mDate.getMonth() + 6);
  const fechaFinLactanciaObligatoria = formatDateISO(fin6mDate);

  // Tope máximo legal de lactancia: 24 meses / 2 años (Ley 7097/23)
  const fin24mDate = new Date(baseNacimiento);
  fin24mDate.setMonth(fin24mDate.getMonth() + 24);
  const fechaLimiteMaximoLactancia24Meses = formatDateISO(fin24mDate);

  // Calendario de certificados pediátricos trimestrales (meses 9, 12, 15, 18, 21, 24)
  const trimestres = [
    { nroTrimestre: 1, mesVidaBebe: 9 },
    { nroTrimestre: 2, mesVidaBebe: 12 },
    { nroTrimestre: 3, mesVidaBebe: 15 },
    { nroTrimestre: 4, mesVidaBebe: 18 },
    { nroTrimestre: 5, mesVidaBebe: 21 },
    { nroTrimestre: 6, mesVidaBebe: 24 },
  ];

  const fechasRecomendadasCertificadosTrimestrales = trimestres.map(t => {
    const d = new Date(baseNacimiento);
    d.setMonth(d.getMonth() + t.mesVidaBebe);
    return {
      nroTrimestre: t.nroTrimestre,
      mesVidaBebe: t.mesVidaBebe,
      fechaLimitePresentacion: formatDateISO(d),
    };
  });

  return {
    fechaInicioReposo,
    fechaFinReposo,
    diasReposoCorridos: 126,
    fechaReincorporacionTrabajo,
    fechaFinLactanciaObligatoria,
    fechaLimiteMaximoLactancia24Meses,
    fechasRecomendadasCertificadosTrimestrales,
  };
}

export function getRegistrosMaternidadByCliente(clienteId: string): RegistroMaternidad[] {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.MATERNIDAD);
    const todos: RegistroMaternidad[] = raw ? JSON.parse(raw) : DEMO_MATERNIDAD;
    return todos.filter(m => m.clienteId === clienteId);
  } catch {
    return DEMO_MATERNIDAD.filter(m => m.clienteId === clienteId);
  }
}

export function getRegistroMaternidadById(id: string): RegistroMaternidad | undefined {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.MATERNIDAD);
    const todos: RegistroMaternidad[] = raw ? JSON.parse(raw) : DEMO_MATERNIDAD;
    return todos.find(m => m.id === id);
  } catch {
    return DEMO_MATERNIDAD.find(m => m.id === id);
  }
}

export function getRegistroMaternidadByEmpleadoId(empleadoId: string): RegistroMaternidad | undefined {
  initializeLocalStorage();
  try {
    const raw = getSafeStorage().getItem(STORAGE_KEYS.MATERNIDAD);
    const todos: RegistroMaternidad[] = raw ? JSON.parse(raw) : DEMO_MATERNIDAD;
    return todos.find(m => m.empleadoId === empleadoId);
  } catch {
    return DEMO_MATERNIDAD.find(m => m.empleadoId === empleadoId);
  }
}

export function saveRegistroMaternidad(registro: RegistroMaternidad): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.MATERNIDAD);
  const todos: RegistroMaternidad[] = raw ? JSON.parse(raw) : DEMO_MATERNIDAD;

  const idx = todos.findIndex(m => m.id === registro.id);
  if (idx >= 0) {
    todos[idx] = { ...registro, updatedAt: new Date().toISOString() };
  } else {
    todos.push({ ...registro, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  getSafeStorage().setItem(STORAGE_KEYS.MATERNIDAD, JSON.stringify(todos));

  // Sincronizar en Empleado
  const empRaw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
  const empleados: Empleado[] = empRaw ? JSON.parse(empRaw) : DEMO_EMPLEADOS;
  const empIdx = empleados.findIndex(e => e.id === registro.empleadoId);
  if (empIdx >= 0) {
    empleados[empIdx].registroMaternidadId = registro.id;
    empleados[empIdx].estadoMaternidad = registro.estado;
    getSafeStorage().setItem(STORAGE_KEYS.EMPLEADOS, JSON.stringify(empleados));
  }
}

export function deleteRegistroMaternidad(id: string): void {
  initializeLocalStorage();
  const raw = getSafeStorage().getItem(STORAGE_KEYS.MATERNIDAD);
  const todos: RegistroMaternidad[] = raw ? JSON.parse(raw) : DEMO_MATERNIDAD;

  const encontrado = todos.find(m => m.id === id);
  const filtrados = todos.filter(m => m.id !== id);
  getSafeStorage().setItem(STORAGE_KEYS.MATERNIDAD, JSON.stringify(filtrados));

  if (encontrado) {
    const empRaw = getSafeStorage().getItem(STORAGE_KEYS.EMPLEADOS);
    const empleados: Empleado[] = empRaw ? JSON.parse(empRaw) : DEMO_EMPLEADOS;
    const empIdx = empleados.findIndex(e => e.id === encontrado.empleadoId);
    if (empIdx >= 0) {
      delete empleados[empIdx].registroMaternidadId;
      delete empleados[empIdx].estadoMaternidad;
      getSafeStorage().setItem(STORAGE_KEYS.EMPLEADOS, JSON.stringify(empleados));
    }
  }
}

export function agregarCertificadoLactanciaTrimestral(
  registroId: string,
  cert: CertificadoLactanciaTrimestral
): void {
  const reg = getRegistroMaternidadById(registroId);
  if (!reg) return;

  // Marcar certificados previos como no vigentes
  const certificadosActualizados = (reg.certificadosTrimestrales || []).map(c => ({
    ...c,
    esVigente: false,
  }));

  certificadosActualizados.push({ ...cert, esVigente: true });
  reg.certificadosTrimestrales = certificadosActualizados;
  reg.proximoVencimientoCertificado = cert.fechaVencimiento;
  reg.fechaFinEstimadaFuero = cert.fechaVencimiento;
  reg.estado = 'lactancia_extendida';

  saveRegistroMaternidad(reg);
}

export function getAlertasMaternidadLactancia(
  clienteId: string,
  hoy: Date = new Date()
): AlertaMaternidadLactancia[] {
  const registros = getRegistrosMaternidadByCliente(clienteId);
  const empleados = getEmpleadosByCliente(clienteId);
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const msPorDia = 1000 * 60 * 60 * 24;

  const alertas: AlertaMaternidadLactancia[] = [];

  for (const reg of registros) {
    const emp = empleados.find(e => e.id === reg.empleadoId);
    if (!emp || emp.estado === 'inactivo') continue;

    const nombreCompleto = `${emp.nombres} ${emp.apellidos}`;

    // 1. Embarazada: Alerta de reposo de maternidad próximo a iniciar (18 semanas / 126 días)
    if (reg.estado === 'embarazada') {
      const fechaInicio = parseDateISO(reg.fechaInicioReposo);
      const diffDias = Math.round((fechaInicio.getTime() - hoyMid.getTime()) / msPorDia);

      if (diffDias >= 0 && diffDias <= 20) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'reposo_proximo_inicio',
          nivelUrgencia: diffDias <= 7 ? 'advertencia' : 'info',
          titulo: `Reposo de Maternidad (18 sem) próximo a iniciar (${diffDias} días)`,
          descripcion: `La trabajadora iniciará su reposo obligatorio de 126 días continuos el ${reg.fechaInicioReposo}. Requiere tramitación de subsidio 100% IPS REI.`,
          fechaEventoClave: reg.fechaInicioReposo,
          diasRestantes: diffDias,
          accionRecomendada: 'Cargar reposo médico en Sistema REI de IPS y notificar a jefatura.',
        });
      }
    }

    // 2. Reposo en curso: Alerta de culminación de las 18 semanas
    if (reg.estado === 'reposo_maternidad') {
      const fechaFin = parseDateISO(reg.fechaFinReposo);
      const diffDias = Math.round((fechaFin.getTime() - hoyMid.getTime()) / msPorDia);

      if (diffDias >= 0 && diffDias <= 15) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'reposo_proximo_fin',
          nivelUrgencia: diffDias <= 5 ? 'advertencia' : 'info',
          titulo: `Fin de reposo de maternidad en ${diffDias} días`,
          descripcion: `Las 18 semanas de reposo culminan el ${reg.fechaFinReposo}. Reincorporación programada para el ${reg.fechaReincorporacionTrabajo}.`,
          fechaEventoClave: reg.fechaFinReposo,
          diasRestantes: diffDias,
          accionRecomendada: 'Coordinar reincorporación y usufructo del horario de lactancia de 90 min diarios.',
        });
      }
    }

    // 3. Lactancia obligatoria (0 a 6 meses): Alerta de vencimiento de los 6 meses
    if (reg.estado === 'lactancia_obligatoria') {
      const fechaFin6m = parseDateISO(reg.fechaFinLactanciaObligatoria);
      const diffDias = Math.round((fechaFin6m.getTime() - hoyMid.getTime()) / msPorDia);

      if (diffDias >= 0 && diffDias <= 25) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'lactancia_6meses_por_vencer',
          nivelUrgencia: 'advertencia',
          titulo: `Lactancia obligatoria de 6 meses concluye en ${diffDias} días`,
          descripcion: `El bebé cumple 6 meses el ${reg.fechaFinLactanciaObligatoria}. Para extender los 90 min hasta los 24 meses (Ley 7097/23), debe presentar Certificado Médico Pediátrico Trimestral.`,
          fechaEventoClave: reg.fechaFinLactanciaObligatoria,
          diasRestantes: diffDias,
          accionRecomendada: 'Solicitar constancia médica pediátrica para renovar prórroga trimestral.',
        });
      } else if (diffDias < 0 && reg.deseaExtensionLactancia && (!reg.certificadosTrimestrales || reg.certificadosTrimestrales.length === 0)) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'certificado_trimestral_vencido',
          nivelUrgencia: 'critico',
          titulo: 'Certificado Pediátrico Trimestral pendiente / vencido',
          descripcion: `El período obligatorio de 6 meses venció el ${reg.fechaFinLactanciaObligatoria}. Falta registrar la constancia médica de lactancia continua para validar los 90 min.`,
          fechaEventoClave: reg.fechaFinLactanciaObligatoria,
          diasRestantes: diffDias,
          accionRecomendada: 'Exigir certificado pediátrico actualizado o regularizar jornada ordinaria.',
        });
      }
    }

    // 4. Lactancia extendida: Control de certificados trimestrales
    if (reg.estado === 'lactancia_extendida' || (reg.certificadosTrimestrales && reg.certificadosTrimestrales.length > 0)) {
      const fechaVenc = reg.proximoVencimientoCertificado || (
        reg.certificadosTrimestrales && reg.certificadosTrimestrales.length > 0
          ? reg.certificadosTrimestrales[reg.certificadosTrimestrales.length - 1].fechaVencimiento
          : reg.fechaFinLactanciaObligatoria
      );

      const fechaVencDate = parseDateISO(fechaVenc);
      const diffDias = Math.round((fechaVencDate.getTime() - hoyMid.getTime()) / msPorDia);

      if (diffDias < 0) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'certificado_trimestral_vencido',
          nivelUrgencia: 'critico',
          titulo: 'Certificado Trimestral de Lactancia vencido',
          descripcion: `La constancia pediátrica anterior venció el ${fechaVenc} (hace ${Math.abs(diffDias)} días). Requiere renovación trimestral según Ley N.º 7097/23.`,
          fechaEventoClave: fechaVenc,
          diasRestantes: diffDias,
          accionRecomendada: 'Requerir a la trabajadora el nuevo certificado del pediatra tratante.',
        });
      } else if (diffDias <= 20) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'certificado_trimestral_por_vencer',
          nivelUrgencia: diffDias <= 7 ? 'advertencia' : 'info',
          titulo: `Certificado Trimestral de Lactancia vence en ${diffDias} días`,
          descripcion: `La prórroga trimestral vence el ${fechaVenc}. Debe presentar nueva constancia médica pediátrica para mantener el permiso diario de 90 minutos.`,
          fechaEventoClave: fechaVenc,
          diasRestantes: diffDias,
          accionRecomendada: 'Notificar preventivamente a la colaboradora para gestionar su consulta pediátrica.',
        });
      }
    }

    // 5. Tope máximo de 24 meses (2 años) alcanzado
    if (reg.estado !== 'lactancia_finalizada') {
      const fecha24m = parseDateISO(reg.fechaLimiteMaximoLactancia24Meses);
      const diffDias24m = Math.round((fecha24m.getTime() - hoyMid.getTime()) / msPorDia);

      if (diffDias24m <= 0) {
        alertas.push({
          registroId: reg.id,
          empleadoId: emp.id,
          nombreCompleto,
          ci: emp.ci,
          cargo: emp.cargo,
          departamento: emp.departamento,
          tipoAlerta: 'lactancia_24meses_fin',
          nivelUrgencia: 'info',
          titulo: 'Tope legal máximo de lactancia alcanzado (24 meses / 2 años)',
          descripcion: `El hijo/a ha alcanzado los 2 años de edad (${reg.fechaLimiteMaximoLactancia24Meses}). Concluye el régimen legal de descanso diario de 90 minutos y el fuero maternal especial.`,
          fechaEventoClave: reg.fechaLimiteMaximoLactancia24Meses,
          diasRestantes: 0,
          accionRecomendada: 'Restablecer horario laboral habitual y cerrar legajo de maternidad.',
        });
      }
    }
  }

  // Ordenar alertas por urgencia: primero 'critico', luego 'advertencia', luego 'info'
  const pesoUrgencia = { critico: 3, advertencia: 2, info: 1 };
  return alertas.sort((a, b) => pesoUrgencia[b.nivelUrgencia] - pesoUrgencia[a.nivelUrgencia]);
}

// ==============================================================================
// DASHBOARD METRICS, ALERTAS DE PRUEBA Y COSTO PATRONAL
// ==============================================================================
export function getDashboardMetrics(clienteId: string): DashboardMetrics {
  const empleados = getEmpleadosByCliente(clienteId);
  const activos = empleados.filter(e => e.estado !== 'inactivo');
  const enPrueba = empleados.filter(e => e.estado === 'prueba');

  // Masa salarial bruta mensual
  const masaSalarialBruta = activos.reduce((sum, e) => sum + e.salarioBase, 0);

  // Aportes de Seguridad Social IPS (Decreto-Ley 1860/50)
  const totalIpsObrero9 = Math.round(masaSalarialBruta * 0.09);
  const totalIpsPatronal165 = Math.round(masaSalarialBruta * 0.165);
  const totalIps255 = totalIpsObrero9 + totalIpsPatronal165;

  // Provisiones Patronales Obligatorias
  // 1. Aguinaldo anual complementario (1/12 de los salarios devengados - Art. 243)
  const provisionAguinaldoMensual = Math.round(masaSalarialBruta / 12);

  // 2. Provisión de Vacaciones (promedio ponderado 15 días anuales / 12 meses)
  const provisionVacacionesMensual = Math.round((masaSalarialBruta / 30) * (15 / 12));

  // Costo Real Patronal Total
  const costoRealPatronalTotal =
    masaSalarialBruta +
    totalIpsPatronal165 +
    provisionAguinaldoMensual +
    provisionVacacionesMensual;

  const porcentajeSobrecosto =
    masaSalarialBruta > 0
      ? Number((((costoRealPatronalTotal - masaSalarialBruta) / masaSalarialBruta) * 100).toFixed(1))
      : 0;

  // Alertas de Período de Prueba (Art. 58 Código Laboral)
  const hoy = new Date();
  const alertasPeriodoPrueba: TrialPeriodAlert[] = [];

  for (const emp of activos) {
    if (emp.estado === 'prueba' || emp.periodoPruebaDias) {
      const fechaIngreso = new Date(emp.fechaIngreso);
      const fechaFinPrueba = new Date(fechaIngreso);
      fechaFinPrueba.setDate(fechaFinPrueba.getDate() + emp.periodoPruebaDias);

      const diffTime = fechaFinPrueba.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Solo alertar si faltan 45 días o menos, o si ya venció
      if (diasRestantes <= 45) {
        let urgencia: TrialPeriodAlert['urgencia'] = 'baja';
        if (diasRestantes <= 0) urgencia = 'vencido';
        else if (diasRestantes <= 5) urgencia = 'alta';
        else if (diasRestantes <= 15) urgencia = 'media';

        alertasPeriodoPrueba.push({
          empleadoId: emp.id,
          nombreCompleto: `${emp.nombres} ${emp.apellidos}`,
          ci: emp.ci,
          cargo: emp.cargo,
          fechaIngreso: emp.fechaIngreso,
          diasPrueba: emp.periodoPruebaDias,
          fechaFinPrueba: fechaFinPrueba.toISOString().split('T')[0],
          diasRestantes,
          urgencia,
        });
      }
    }
  }

  // Alertas de Vacaciones
  const alertasVacaciones: VacationAlert[] = [];
  for (const emp of activos) {
    const fechaIng = new Date(emp.fechaIngreso);
    const anhos = Math.floor((hoy.getTime() - fechaIng.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

    if (anhos >= 1) {
      // Escala Art. 218: 1 a 5 años = 12 días; 5 a 10 = 18 días; > 10 = 30 días
      let diasEscala = 12;
      if (anhos > 10) diasEscala = 30;
      else if (anhos > 5) diasEscala = 18;

      const causados = emp.vacacionesCausadasAcumuladas || diasEscala;
      const tomados = emp.vacacionesTomadas || 0;
      const pendientes = Math.max(0, causados - tomados);

      if (pendientes > 0) {
        // En Paraguay debe gozarse dentro de los 6 meses de causado (Art. 224)
        const fechaLimite = new Date(fechaIng);
        fechaLimite.setFullYear(fechaLimite.getFullYear() + anhos);
        fechaLimite.setMonth(fechaLimite.getMonth() + 6);

        alertasVacaciones.push({
          empleadoId: emp.id,
          nombreCompleto: `${emp.nombres} ${emp.apellidos}`,
          ci: emp.ci,
          antiguedadAnhos: anhos,
          diasCausados: causados,
          diasTomados: tomados,
          diasPendientes: pendientes,
          debeGozarAntesDe: fechaLimite.toISOString().split('T')[0],
        });
      }
    }
  }

  // Alertas de Antigüedad y Estabilidad Especial (Art. 94)
  const configAntiguedad = getConfiguracionAntiguedad(clienteId);
  const alertasAntiguedad = getAlertasAntiguedad(clienteId, configAntiguedad, hoy);

  // Alertas de Maternidad, Lactancia (90 min) y Fuero Laboral (Ley 5508/15 y 7097/23)
  const alertasMaternidad = getAlertasMaternidadLactancia(clienteId, hoy);

  // Próximas obligaciones
  const proximoMes = hoy.getMonth() + 2 > 12 ? 1 : hoy.getMonth() + 2;
  const proximoVencimientoIps = `20 de ${obtenerNombreMes(hoy.getMonth() + 1)} (Pago Planilla REI)`;
  const proximoVencimientoMtess = `10 de ${obtenerNombreMes(proximoMes)} (Comunicación REOP)`;

  return {
    totalEmpleadosActivos: activos.length,
    totalEmpleadosPrueba: enPrueba.length,
    masaSalarialBruta,
    totalIpsObrero9,
    totalIpsPatronal165,
    totalIps255,
    provisionAguinaldoMensual,
    provisionVacacionesMensual,
    costoRealPatronalTotal,
    porcentajeSobrecosto,
    alertasPeriodoPrueba,
    alertasVacaciones,
    alertasAntiguedad,
    alertasMaternidad,
    configAntiguedad,
    proximoVencimientoIps,
    proximoVencimientoMtess,
  };
}

// ==============================================================================
// HELPERS FORMATO GUARANÍES Y NÚMERO A LETRAS
// ==============================================================================
export function formatPYG(monto: number): string {
  return 'Gs. ' + Math.round(monto).toLocaleString('es-PY');
}

export function obtenerNombreMes(mes: number): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return meses[mes - 1] || 'Mes';
}

function numeroALetrasGuaranies(numero: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales: Record<number, string> = {
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
    25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
  };
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (numero === 0) return 'CERO GUARANÍES';
  if (numero === 100) return 'CIEN GUARANÍES';

  const n = Math.floor(numero);

  function convertirGrupo(val: number): string {
    if (val === 0) return '';
    if (val === 100) return 'CIEN';
    let str = '';
    const c = Math.floor(val / 100);
    const resto = val % 100;
    if (c > 0) str += centenas[c] + ' ';
    if (resto > 0) {
      if (especiales[resto]) {
        str += especiales[resto];
      } else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        if (d > 0) {
          str += decenas[d];
          if (u > 0) str += ' Y ' + unidades[u];
        } else if (u > 0) {
          str += unidades[u];
        }
      }
    }
    return str.trim();
  }

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const cent = n % 1000;

  let resultado = '';
  if (millones > 0) {
    if (millones === 1) resultado += 'UN MILLÓN ';
    else resultado += convertirGrupo(millones) + ' MILLONES ';
  }
  if (miles > 0) {
    if (miles === 1) resultado += 'MIL ';
    else resultado += convertirGrupo(miles) + ' MIL ';
  }
  if (cent > 0) {
    resultado += convertirGrupo(cent);
  }

  return (resultado.trim() + ' GUARANÍES').replace(/\s+/g, ' ');
}
