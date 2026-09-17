/**
 * TIPOS Y MODELOS DE DATOS — PORTAL DE CLIENTES (ERP LABORAPY)
 * Normativa: Ley N.º 213/93 (Código del Trabajo), Decreto-Ley N.º 1860/50 (IPS) y MTESS REOP
 * Versión: PY-ERP-CLIENT-2026.09.09
 */

export interface PatronalMtessSucursal {
  id: string;
  nroPatronalMtess: string;
  sucursalNombre: string;
  ciudad: string;
  esPrincipal?: boolean;
  usarIpsPrincipal?: boolean;
  nroPatronalIps?: string;
  departamento?: string;
  direccion?: string;
}

export interface EmpresaCliente {
  id: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  nombreFantasia?: string;
  actividadEconomica?: string;
  direccion: string;
  telefono: string;
  emailCorporativo: string;
  nroPatronalIps?: string;
  nroPatronalMtess?: string;
  esAgenteRetentor?: boolean; // true = aplica retención 30% IVA a facturadores (DNIT). undefined = legacy → se trata como true.
  patronalesMtessSecundarias?: PatronalMtessSucursal[];
  representanteLegalNombre: string;
  representanteLegalCi: string;
  representanteLegalCargo?: string;
  logoUrl?: string;
  configAntiguedad?: ConfiguracionAntiguedad;
  politicaReposoPatronal?: {
    coberturaPorcentaje: 0 | 50 | 100; // 0% legal estricto (no se paga jornal), 50% voluntario, 100% beneficio
  };
  ciudad?: string;
  activo: boolean;
  createdAt: string;
}

export interface ClienteUsuario {
  id: string;
  clienteId: string;
  email: string;
  nombreContacto: string;
  cargoContacto?: string;
  telefono?: string;
  rol: 'cliente_admin' | 'cliente_operador' | 'cliente_auditor';
  activo: boolean;
  ultimoAcceso?: string;
  passwordHash?: string;
}

export interface Empleado {
  id: string;
  clienteId: string;
  ci: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string;
  nacionalidad: string;
  estadoCivil: 'Soltero/a' | 'Casado/a' | 'Divorciado/a' | 'Viudo/a' | 'Unión de Hecho';
  sexo: 'M' | 'F' | 'Otro';
  domicilio?: string;
  telefono?: string;
  email?: string;
  hijosMenores: number; // hasta 17 años cumplidos (menores de 18 años)
  hijosDiscapacidad?: number; // hijos con discapacidad física o psíquica (cobro vitalicio)
  parejaEmpleadoId?: string; // ID del cónyuge/pareja si ambos trabajan en la misma empresa cliente
  cargo: string;
  departamento: string;
  sucursalId?: string; // ID de la sucursal asignada o 'principal' / undefined para Casa Central
  lugarTrabajo?: string; // Denominación o dirección del establecimiento físico
  departamentoGeografico?: string; // Departamento geográfico (ej. Central, Alto Paraná, Capital)
  fechaIngreso: string;
  fechaEgreso?: string;
  salarioBase: number;
  modalidadPago: 'mensual' | 'jornalero' | 'destajo' | 'comisionista' | 'factura';
  nroIps?: string;
  estado: 'activo' | 'prueba' | 'suspendido' | 'vacaciones' | 'inactivo';
  periodoPruebaDias: 30 | 60 | 90;
  vacacionesCausadasAcumuladas: number;
  vacacionesTomadas: number;
  registroMaternidadId?: string;
  estadoMaternidad?: EstadoMaternidadLactancia;
  notas?: string;
  createdAt: string;
}

export type TipoContratoLaboral = 
  | 'indefinido' 
  | 'plazo_fijo' 
  | 'tiempo_parcial' 
  | 'aprendizaje' 
  | 'obra';

export interface ContratoTrabajo {
  id: string;
  clienteId: string;
  empleadoId: string;
  tipoContrato: TipoContratoLaboral;
  fechaInicio: string;
  fechaFin?: string;
  periodoPruebaDias: number;
  salarioPactado: number;
  jornadaLaboral: string;
  horarioInicio: string;
  horarioFin: string;
  lugarPrestacion: string;
  seccionAsignada?: string;
  absorcionAntiguedad?: {
    empresaAnterior: string;
    fechaIngresoAnterior: string;
  };
  clausulasAdicionales?: string;
  estado: 'borrador' | 'firmado' | 'vencido' | 'rescindido';
  createdAt: string;
}

export type MotivoAdenda =
  | 'modificacion_salarial'
  | 'traslado_sucursal'
  | 'confidencialidad_nda'
  | 'cambio_jornada_teletrabajo'
  | 'otro';

export interface AdendaContrato {
  id: string;
  clienteId: string;
  empleadoId: string;
  contratoOriginalId?: string;
  fechaContratoOriginal: string;
  nroAdenda: number;
  motivo: MotivoAdenda;
  tituloAdenda: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaVigencia: string; // YYYY-MM-DD
  // Motivo: Modificación Salarial
  salarioAnterior?: number;
  nuevoSalario?: number;
  detalleComisiones?: string;
  // Motivo: Traslado de Sucursal
  lugarAnterior?: string;
  nuevoLugar?: string;
  compensacionTraslado?: string;
  // Motivo: Confidencialidad y NDA
  alcanceConfidencialidad?: string;
  penalidadIncumplimiento?: string;
  // Motivo: Jornada / Teletrabajo
  nuevaJornada?: string;
  nuevoHorario?: string;
  // Cláusulas generales
  clausulasEspecificas?: string;
  estado: 'borrador' | 'firmado';
  createdAt: string;
}


export interface ReciboSalario {
  id: string;
  clienteId: string;
  empleadoId: string;
  mes: number; // 1-12
  anho: number; // 2026
  diasTrabajados: number; // max 30
  salarioBase: number;
  salarioDevengado: number;
  horasExtras50Cant: number;
  horasExtras50Monto: number;
  horasExtras100Cant: number;
  horasExtras100Monto: number;
  comisionesPremios: number;
  bonificacionFamiliar: number; // 5% salario mínimo por hijo menor (Art. 261)
  totalIngresosBrutos: number;
  ipsObrero9: number; // 9% retenido sobre ingresos imponibles
  anticiposQuincena: number;
  judicialesAlimentos: number;
  otrosDescuentos: number;
  totalDeducciones: number;
  salarioNeto: number;
  salarioNetoLetras: string;
  diasReposo?: number;
  coberturaPatronalReposoPorcentaje?: 0 | 50 | 100;
  descuentoReposo?: number;
  montoReposoPagadoPatronal?: number;
  qrVerificacion?: string;
  fechaEmision: string;
}

export interface NominaPeriodo {
  id: string;
  clienteId: string;
  mes: number;
  anho: number;
  totalSalariosBrutos: number;
  totalIpsObrero9: number;
  totalIpsPatronal165: number;
  totalIps255: number;
  totalNetoPagar: number;
  estado: 'abierto' | 'cerrado' | 'pagado';
  fechaPago?: string;
}

export type TipoDocumentoCumplimiento =
  | 'extracto_ips'
  | 'factura_pago_ips'
  | 'comprobante_reop_mensual'
  | 'comprobante_libro_anual_mtess'
  | 'libro_sueldos_jornales_pdf'
  | 'libro_empleados_obreros_pdf'
  | 'rgpo_mtess_pdf';

export interface DocumentoCumplimiento {
  id: string;
  clienteId: string;
  tipo: TipoDocumentoCumplimiento;
  periodo: string; // ej: '2026-08' o '2025'
  titulo: string;
  archivoNombre: string;
  archivoUrl?: string;
  nroTransaccionOficial?: string;
  fechaPresentacion?: string;
  montoAbonado?: number;
  notas?: string;
  createdAt: string;
}

export interface ClientSession {
  token: string;
  usuario: ClienteUsuario;
  empresa: EmpresaCliente;
  empresasDisponibles: EmpresaCliente[];
  expiresAt: number;
}

export interface ConfiguracionAntiguedad {
  umbralAnhosHombres: number; // Por defecto: 9 años
  umbralAnhosMujeres: number; // Por defecto: 8 años
  alertarDiasAntes?: number; // Días de anticipación preventiva
}

export interface AlertaAntiguedad {
  empleadoId: string;
  nombreCompleto: string;
  ci: string;
  cargo: string;
  departamento: string;
  sexo: 'M' | 'F' | 'Otro';
  fechaIngreso: string;
  antiguedadAnhos: number;
  antiguedadMeses: number;
  antiguedadDias: number;
  antiguedadTexto: string;
  umbralAplicadoAnhos: number;
  alcanzoUmbral: boolean;
  anhosParaEstabilidad10: number;
  tiempoRestanteParaEstabilidadTexto: string;
  nivelRiesgo: 'alerta_preventiva' | 'critico_proximo_10' | 'estable_adquirida';
  mensajeEstrategico: string;
}

export interface RegistroVacacion {
  id: string;
  clienteId: string;
  empleadoId: string;
  periodoAnho: number; // Ej: 2025 o 2026
  diasCorrespondientes: number; // 12, 18, 30 según Art. 218
  // Control Real e Interno del Usufructo
  fechaInicioReal?: string; // YYYY-MM-DD
  fechaFinReal?: string; // YYYY-MM-DD
  diasUsufructuadosReal: number;
  diasPendientesReal: number;
  estadoReal: 'pendiente' | 'en_curso' | 'gozado' | 'fraccionado';
  fechaLimiteUsufructo: string; // Art. 224: límite de 6 meses desde causación
  // Declaración / Comunicación Mensual al MTESS (REOP)
  comunicadoMtess: boolean;
  mesComunicacionMtess?: string; // YYYY-MM ej: '2026-07'
  fechaComunicacionMtess?: string;
  nroComprobanteMtess?: string;
  diasComunicadosMtess?: number;
  // Vacaciones Adelantadas / Anticipadas
  esAdelantada?: boolean; // True si es anticipo / vacaciones adelantadas autorizadas
  autorizadoPorEmpleador?: boolean; // True si cuenta con autorización patronal expresa
  notas?: string;
  createdAt: string;
}

export interface TrialPeriodAlert {
  empleadoId: string;
  nombreCompleto: string;
  ci: string;
  cargo: string;
  fechaIngreso: string;
  diasPrueba: number;
  fechaFinPrueba: string;
  diasRestantes: number;
  urgencia: 'alta' | 'media' | 'baja' | 'vencido';
}

export interface VacationAlert {
  empleadoId: string;
  nombreCompleto: string;
  ci: string;
  antiguedadAnhos: number;
  diasCausados: number;
  diasTomados: number;
  diasPendientes: number;
  debeGozarAntesDe: string;
}

export interface DashboardMetrics {
  totalEmpleadosActivos: number;
  totalEmpleadosPrueba: number;
  masaSalarialBruta: number;
  totalIpsObrero9: number;
  totalIpsPatronal165: number;
  totalIps255: number;
  provisionAguinaldoMensual: number; // 1/12
  provisionVacacionesMensual: number;
  costoRealPatronalTotal: number;
  porcentajeSobrecosto: number;
  alertasPeriodoPrueba: TrialPeriodAlert[];
  alertasVacaciones: VacationAlert[];
  alertasAntiguedad: AlertaAntiguedad[];
  alertasMaternidad: AlertaMaternidadLactancia[];
  configAntiguedad: ConfiguracionAntiguedad;
  proximoVencimientoIps: string;
  proximoVencimientoMtess: string;
}

// ==============================================================================
// GESTIÓN DE MATERNIDAD, LACTANCIA & FUERO LABORAL (LEY 5508/15 Y LEY 7097/23)
// ==============================================================================

export type EstadoMaternidadLactancia =
  | 'ninguno'
  | 'embarazada'             // Notificó embarazo con certificado; trabajando bajo fuero
  | 'reposo_maternidad'      // En reposo obligatorio de 18 semanas (126 días) subsidiado 100% IPS
  | 'lactancia_obligatoria'  // 0 a 6 meses de vida del recién nacido (90 min/día)
  | 'lactancia_extendida'    // 6 a 24 meses con constancias médicas pediátricas trimestrales
  | 'lactancia_finalizada';  // Superó los 24 meses o concluyó la lactancia

export type ModalidadLactancia90Min =
  | 'dos_pausas_45min'         // Dos descansos de 45 minutos durante la jornada
  | 'salida_temprana_90min'    // Retiro 90 minutos antes del término de la jornada
  | 'entrada_tardia_90min'     // Ingreso 90 minutos después del inicio de la jornada
  | 'continuo_intermedio_90min'; // Un descanso continuado de 90 minutos en jornada

export interface CertificadoLactanciaTrimestral {
  id: string;
  nroTrimestre: number; // 1 (mes 9), 2 (mes 12), 3 (mes 15), 4 (mes 18), 5 (mes 21), 6 (mes 24)
  fechaPresentacion: string; // YYYY-MM-DD
  fechaVencimiento: string;  // YYYY-MM-DD (+3 meses aprox)
  medicoPediatra: string;
  registroProfesional?: string;
  observaciones?: string;
  archivoAdjunto?: string;
  esVigente: boolean;
}

export interface RegistroMaternidad {
  id: string;
  clienteId: string;
  empleadoId: string;
  estado: EstadoMaternidadLactancia;

  // 1. Notificación y Embarazo (Inicio de Inamovilidad)
  fechaNotificacionEmbarazo: string; // YYYY-MM-DD (Inicio formal del fuero maternal Art. 136)
  fechaProbablePartoFPP: string;     // YYYY-MM-DD (Estimación médica)
  fechaPartoReal?: string;          // YYYY-MM-DD (Fecha efectiva de nacimiento)

  // 2. Reposo de Maternidad (18 semanas / 126 días corridos - Art. 13 Ley 5508/15 modif. Ley 7097/23)
  fechaInicioReposo: string;        // YYYY-MM-DD (Habitualmente FPP - 14 días)
  fechaFinReposo: string;           // YYYY-MM-DD (Inicio + 125 días = 126 días corridos)
  fechaReincorporacionTrabajo: string; // YYYY-MM-DD (Día siguiente al fin del reposo)
  subsidioIpsEstado: 'pendiente' | 'tramitado' | 'cobrado_por_asegurada';

  // 3. Lactancia Obligatoria de 90 Minutos (Primeros 6 meses de vida - Art. 14 Ley 5508/15)
  modalidadLactancia: ModalidadLactancia90Min;
  fechaFinLactanciaObligatoria: string; // YYYY-MM-DD (Nacimiento + 6 meses)

  // 4. Extensión Trimestral de Lactancia hasta los 24 meses (Ley 7097/23)
  deseaExtensionLactancia: boolean;
  fechaLimiteMaximoLactancia24Meses: string; // YYYY-MM-DD (Nacimiento + 24 meses / 2 años)
  certificadosTrimestrales: CertificadoLactanciaTrimestral[];
  proximoVencimientoCertificado?: string;

  // 5. Fuero Maternal e Inamovilidad (Art. 136 Cód. Laboral y Art. 16 Ley 5508/15)
  fueroMaternalActivo: boolean;
  fechaFinEstimadaFuero: string; // Vigente hasta fin de reposo o de lactancia acreditada

  notas?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertaMaternidadLactancia {
  registroId: string;
  empleadoId: string;
  nombreCompleto: string;
  ci: string;
  cargo: string;
  departamento: string;
  tipoAlerta:
    | 'reposo_proximo_inicio'
    | 'reposo_proximo_fin'
    | 'lactancia_6meses_por_vencer'
    | 'certificado_trimestral_por_vencer'
    | 'certificado_trimestral_vencido'
    | 'lactancia_24meses_fin'
    | 'fuero_maternal_activo';
  nivelUrgencia: 'info' | 'advertencia' | 'critico';
  titulo: string;
  descripcion: string;
  fechaEventoClave: string;
  diasRestantes: number;
  accionRecomendada: string;
}

// ==============================================================================
// MÓDULO DE LIQUIDACIÓN, PRESENTISMO Y MARCACIONES BIOMÉTRICAS (OPEN API)
// ==============================================================================

export type TipoNovedadPresentismo =
  | 'reposo_patronal'            // Días 1-3 a cargo del empleador (Art. 36 Dec-Ley 1860/50)
  | 'reposo_ips'                 // Día 4 en adelante subsidiado al 50% por IPS
  | 'reposo_maternidad'          // 18 semanas / 126 días 100% subsidiado por IPS (Ley 5508/15)
  | 'reposo_accidente_laboral'   // Riesgo profesional IPS
  | 'ausencia_justificada_con_goce'
  | 'ausencia_justificada_sin_goce' // Descuenta jornal (base 30)
  | 'ausencia_injustificada'     // Descuenta jornal (base 30) y afecta presentismo
  | 'licencia_matrimonio'        // 3 días corridos remunerados (Art. 62 inc. e Ley 213/93)
  | 'licencia_paternidad'        // 14 días corridos remunerados (Art. 13 Ley 5508/15)
  | 'licencia_duelo'             // 3 días corridos remunerados (Art. 62 inc. e Ley 213/93)
  | 'licencia_examen_preventivo' // 2 días remunerados al año (Leyes 3803/09 y 6211/18)
  | 'licencia_donacion_sangre'   // 1 día remunerado (Ley 4582/12)
  | 'licencia_estudio'           // Hasta 2 días remunerados por examen
  | 'cumpleanos_asueto';         // Asueto remunerado por cumpleaños del empleado

export interface NovedadPresentismo {
  id: string;
  clienteId: string;
  empleadoId: string;
  tipoNovedad: TipoNovedadPresentismo;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
  dias: number;
  remunerado: boolean;
  descuentaJornal: boolean;
  motivo: string;
  documentoUrl?: string;
  estado: 'aprobado' | 'pendiente' | 'rechazado';
  createdAt: string;
}

export type MetodoVerificacionMarcacion = 'facial' | 'huella' | 'tarjeta' | 'pin' | 'manual';

export type MarcaDispositivoBiometrico = 'zkteco' | 'hikvision' | 'dahua' | 'anviz' | 'suprema' | 'generico';

export type TipoMarcacion = 'entrada' | 'salida' | 'salida_almuerzo' | 'entrada_almuerzo';

export interface RegistroMarcacion {
  id: string;
  clienteId: string;
  empleadoId: string;
  ci: string;
  timestamp: string; // ISO 8601 (YYYY-MM-DDTHH:mm:ss)
  tipo: TipoMarcacion;
  metodo: MetodoVerificacionMarcacion;
  dispositivoId: string;
  marca: MarcaDispositivoBiometrico;
  rawLog?: string;
}

export interface ConfigBiometricoCliente {
  clienteId: string;
  apiKey: string;
  webhookUrl: string;
  horaEntradaPredeterminada: string; // HH:mm (ej: '08:00')
  horaSalidaPredeterminada: string;  // HH:mm (ej: '17:00')
  toleranciaMinutosTardia: number;   // ej: 10 min
  horaInicioNocturno: string;        // HH:mm (ej: '20:00')
  horaFinNocturno: string;           // HH:mm (ej: '06:00')
  descontarTardanzas: boolean;
}

export interface ResumenAsistenciaEmpleadoMes {
  empleadoId: string;
  nombreCompleto: string;
  ci: string;
  cargo: string;
  departamento: string;
  mes: number;
  anho: number;
  diasLaborables: number;
  diasTrabajadosEfectivos: number;
  diasReposoPatronal: number;
  diasReposoIps: number;
  diasLicenciasPagas: number;
  diasCumpleanos: number;
  diasAusenciasInjustificadas: number;
  diasAusenciasSinGoce: number;
  minutosTardanzaTotal: number;
  montoDescuentoTardanzas: number;
  horasExtras50Cant: number;
  horasExtras50Monto: number;
  horasExtras100Cant: number;
  horasExtras100Monto: number;
  recargoNocturno30Horas: number;
  recargoNocturno30Monto: number;
  totalAdicionalesHoras: number;
  totalDescuentosAsistencia: number;
  salarioBase: number;
  diasLiquidadosBase30: number; // Max 30 días según Código del Trabajo
  salarioDevengadoCalculado: number;
}

export const DEPARTAMENTOS_PARAGUAY = [
  'Capital / Asunción',
  'Central',
  'Alto Paraná',
  'Itapúa',
  'Caaguazú',
  'San Pedro',
  'Cordillera',
  'Guairá',
  'Paraguarí',
  'Caazapá',
  'Misiones',
  'Ñeembucú',
  'Amambay',
  'Canindeyú',
  'Presidente Hayes',
  'Boquerón',
  'Alto Paraguay',
  'Concepción',
] as const;

export type DepartamentoParaguay = (typeof DEPARTAMENTOS_PARAGUAY)[number];

export interface SucursalOption {
  id: string;
  label: string;
  nombre?: string;
  nroPatronalMtess: string;
  nroPatronalIps: string;
  ciudad: string;
  departamento?: string;
  departamentoGeografico?: string;
  direccion?: string;
  esPrincipal: boolean;
  esCasaCentral?: boolean;
}

export function buildSucursalesOptions(empresa: EmpresaCliente): SucursalOption[] {
  const opciones: SucursalOption[] = [];

  // Casa Central (Principal)
  opciones.push({
    id: 'principal',
    label: `🏢 Casa Central - ${empresa.nombreFantasia || empresa.razonSocial}`,
    nombre: empresa.nombreFantasia || empresa.razonSocial,
    nroPatronalMtess: empresa.nroPatronalMtess || '',
    nroPatronalIps: empresa.nroPatronalIps || '',
    ciudad: empresa.ciudad || 'Asunción',
    departamento: 'Capital / Asunción',
    departamentoGeografico: 'Capital / Asunción',
    direccion: empresa.direccion,
    esPrincipal: true,
    esCasaCentral: true,
  });

  (empresa.patronalesMtessSecundarias || []).forEach(suc => {
    const usaIpsPrincipal = suc.usarIpsPrincipal !== false;
    const ipsEfectivo = usaIpsPrincipal
      ? (empresa.nroPatronalIps || '')
      : (suc.nroPatronalIps || empresa.nroPatronalIps || '');

    opciones.push({
      id: suc.id,
      label: `🏬 ${suc.sucursalNombre || 'Sucursal'} - ${suc.ciudad || ''}`,
      nombre: suc.sucursalNombre || 'Sucursal',
      nroPatronalMtess: suc.nroPatronalMtess,
      nroPatronalIps: ipsEfectivo,
      ciudad: suc.ciudad,
      departamento: suc.departamento,
      departamentoGeografico: suc.departamento,
      direccion: suc.direccion,
      esPrincipal: !!suc.esPrincipal,
      esCasaCentral: false,
    });
  });

  return opciones;
}

export function getSucursalById(empresa: EmpresaCliente, sucursalId?: string): SucursalOption {
  const opciones = buildSucursalesOptions(empresa);
  const targetId = (!sucursalId || sucursalId === 'casa_central' || sucursalId === 'principal') ? 'principal' : sucursalId;
  return opciones.find(s => s.id === targetId || (targetId === 'principal' && s.esPrincipal)) || opciones[0];
}
