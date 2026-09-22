/**
 * CONFIGURACIÓN INSTITUCIONAL Y COMERCIAL — LABORAPY
 * LaboraPy - Soluciones Laborales y Contables (Paraguay)
 * Versión: PY-CONFIG-2026.09.05
 */

export const LABORAPY_CONFIG = {
  brandName: 'LaboraPy - RRHH, Selección & Contabilidad Tributaria',
  shortBrandName: 'LaboraPy',
  subtitle: 'División RRHH & Selección de Talentos · División Contabilidad, Impuestos & Balances (DNIT)',
  tagline: 'Soluciones integrales de Recursos Humanos, selección de personal y gestión contable, impositiva (IVA/IRE/IRP) y financiera en Paraguay',
  legalBadge: 'Ley 213/93 · IPS · DNIT Ley 6380/19',
  location: 'Asunción, República del Paraguay',
  whatsAppNumber: ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WHATSAPP_NUMBER) as string | undefined) || '595984469005',
  whatsAppDisplay: ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WHATSAPP_DISPLAY) as string | undefined) || '+595 984 469 005',
  contactEmail: ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CONTACT_EMAIL) as string | undefined) || 'diegonunez1997@gmail.com',
  horarioAtencion: 'Lunes a Viernes de 08:00 a 18:00 hs',
};

/**
 * Genera el enlace directo para iniciar una conversación en WhatsApp
 */
export const createWhatsAppUrl = (message: string, customPhone?: string): string => {
  const phone = (customPhone || LABORAPY_CONFIG.whatsAppNumber).replace(/[^0-9]/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

/**
 * Mensajes contextuales optimizados para conversión en RRHH, Selección y Contabilidad
 */
export const WhatsAppMessages = {
  general: () =>
    'Hola LaboraPy, me pongo en contacto desde el sitio web para consultar sobre sus servicios de RRHH, Selección de Personal o Contabilidad e Impuestos.',

  // ── DIVISIÓN CONTABILIDAD & IMPUESTOS (DNIT) ──
  contabilidadGeneral: () =>
    'Hola LaboraPy, me comunico para consultar sobre sus servicios contables y tributarios (IVA, IRE, IRP, Balances y Estados Financieros ante la DNIT).',

  contabilidadIvaRenta: (impuesto?: string) =>
    `Hola LaboraPy, deseo consultar sobre la liquidación y presentación de ${
      impuesto || 'IVA mensual (Formulario 120), IRE Simple/General o IRP'
    } en el Sistema Marangatu de la DNIT.`,

  estadosFinancieros: (destino?: string) =>
    `Hola LaboraPy, necesito la elaboración y certificación de Estados Financieros y Balances Generales${
      destino ? ` para presentar ante: ${destino}` : ' (Bancos / Créditos / Licitaciones / Cierre fiscal anual)'
    } con firma de Contador Matriculado.`,

  librosContablesRuc: () =>
    'Hola LaboraPy, deseo consultar sobre compliance contable para empresas, llevanza de libros obligatorios (Diario, Mayor, Inventario), registro de comprobantes (RG 90) o trámites de RUC.',

  // ── GESTIONES ANTE LA DNIT / SET & REACTIVACIÓN TRIBUTARIA ──
  dnitGestiones: (tramite?: string) =>
    `Hola LaboraPy, me contacto para solicitar acompañamiento contable en gestiones ante la DNIT / SET${
      tramite ? ` (${tramite})` : ' (estado de deudas tributarias, trámites varios o consultas de cuenta corriente)'
    }.`,

  reactivacionIvaPerfil: () =>
    'Hola LaboraPy, necesito que estudien mi caso para la reactivación de mi IVA y perfil tributario ante la DNIT (regularización de declaraciones juradas atrasadas, levantamiento de suspensión de RUC o recuperación de timbrado).',

  estadoDeudasDnit: () =>
    'Hola LaboraPy, deseo consultar mi estado de deudas con la DNIT / SET, verificar inconsistencias en el Sistema Marangatu y tramitar mi Certificado de Cumplimiento Tributario.',

  // ── DIVISIÓN RRHH & SELECCIÓN DE TALENTO ──
  seleccionEmpresa: (categoria?: string) =>
    `Hola LaboraPy, me comunico desde mi empresa para solicitar el servicio de Búsqueda y Selección de Personal${
      categoria ? ` para el perfil: ${categoria}` : ' (Personal Operativo / Supervisores / Profesionales y Mandos Medios)'
    }. Deseo conocer la propuesta y metodología de trabajo.`,

  postulacionCandidato: (area?: string) =>
    `Hola LaboraPy, deseo postularme a sus búsquedas laborales activas y remitir mi Currículum Vitae (CV)${
      area ? ` para el área de: ${area}` : ''
    }. ¿A qué medio o formato puedo remitirlo?`,

  b2bEmpresas: (servicio?: string) =>
    `Hola LaboraPy, me comunico desde mi empresa para coordinar asesoramiento profesional de RRHH y gestión laboral${
      servicio ? ` (${servicio})` : ' (Liquidaciones, nóminas IPS/MTESS, comunicaciones mensuales de salarios y planillas anuales REOP)'
    }.`,

  mtessPlanillas: () =>
    'Hola LaboraPy, me comunico desde mi empresa para consultar sobre la gestión de comunicaciones mensuales (salarios, entradas, salidas y liquidaciones) y la presentación de planillas anuales obligatorias ante el MTESS (REOP).',

  b2cParticulares: (asunto?: string) =>
    `Hola LaboraPy, deseo consultar con un profesional de RRHH${
      asunto ? ` respecto a: ${asunto}` : ' (Revisión de liquidación, finiquito, renuncia o facturación mensual)'
    } para tomar una decisión con seguridad.`,

  maternidad: () =>
    'Hola LaboraPy, me contacto para consultar sobre mis derechos laborales ante un caso de embarazo o período de lactancia (Ley N.º 5508/15) para evaluar mis opciones.',

  primaciaRealidad: () =>
    'Hola LaboraPy, percibo mi remuneración mediante facturación mensual con IVA y deseo asesoramiento técnico de RRHH para analizar si existe relación de dependencia.',

  estabilidad10Anios: () =>
    'Hola LaboraPy, cuento con más de 10 años de antigüedad laboral y necesito asesoría de un profesional de RRHH para evaluar mi liquidación y alternativas.',

  calculoResultado: (montoNeto?: number) =>
    `Hola LaboraPy, utilicé su calculadora laboral y obtuve un estimado de liquidación de Gs. ${
      montoNeto ? montoNeto.toLocaleString('es-PY') : '...'
    }. Deseo coordinar una consulta con un asesor de RRHH para revisar mis números y recibir orientación.`,

  documentos: (docTipo?: string) =>
    `Hola LaboraPy, necesito asistencia y revisión técnica de RRHH sobre un documento laboral${
      docTipo ? ` (${docTipo})` : ''
    } antes de formalizarlo.`,

  expatHrDesk: () =>
    'Hello LaboraPy / Hola, me comunico con la Mesa Corporativa Expat HR Desk para coordinar asesoramiento bilingüe en contratación de personal extranjero, nómina multimoneda y cumplimiento legal en Paraguay (Ley 213/93 e IPS).',
};
