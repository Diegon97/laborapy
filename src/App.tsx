
/**
 * LANDING PAGE & PLATAFORMA RRHH PARAGUAY — LABORAPY
 * LaboraPy - Soluciones Laborales y Contables
 * Diseño Moderno, Intuitivo y de Alto Nivel Corporativo
 * Optimizado para Móviles y Computadoras · Versión: PY-LIQ-2026.09.05
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FinalSettlementModal } from './modules/payroll/components/FinalSettlementModal';
import { HRDocumentModal } from './modules/payroll/components/HRDocumentModal';
import { LaboraPyServicesSection } from './modules/lead/components/LaboraPyServicesSection';
import { FloatingWhatsAppButton } from './modules/lead/components/FloatingWhatsAppButton';
import { CommercialLeadsModal } from './modules/lead/components/CommercialLeadsModal';
import { MetaPixelConfigModal } from './modules/analytics/MetaPixelConfigModal';
import {
  isAdminAuthenticated,
  AdminLoginModal,
  AdminHubModal,
} from './modules/admin';
import {
  ClientLoginModal,
  ClientERPModal,
  getClientSession,
  type ClientSession,
} from './modules/clientPortal';
import {
  DocumentVerificationModal,
  type VerificationData,
} from './modules/payroll/components/DocumentVerificationModal';
import { initMetaPixel, trackVisualizacionModulo } from './modules/analytics/metaPixel';
import { LABORAPY_CONFIG, createWhatsAppUrl, WhatsAppMessages } from './config/laborapy';
import type { AppRoute } from './modules/lead/components/LandingHeroPainSection';
import { TobiFloatingButton, TobiChatModal, TobiChatLanding } from './modules/assistant';
import { PricingPlansModal } from './modules/subscription';
import { JobApplicationModal } from './modules/recruitment';

export const pathToRoute = (pathname: string): AppRoute => {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'calculadora' || clean === 'settlement' || clean === 'liquidacion') return 'calculadora';
  if (clean === 'servicios' || clean === 'services' || clean === 'contabilidad') return 'servicios';
  if (clean === 'cliente-login' || clean === 'login' || clean === 'portal' || clean === 'erp') return 'cliente-login';
  if (clean === 'documentos' || clean === 'documents') return 'documentos';
  if (clean === 'legal' || clean === 'faq' || clean === 'preguntas') return 'legal';
  return 'home';
};

export const routeToPath = (route: AppRoute): string => {
  switch (route) {
    case 'calculadora': return '/calculadora';
    case 'servicios': return '/servicios';
    case 'cliente-login': return '/cliente-login';
    case 'documentos': return '/documentos';
    case 'legal': return '/legal';
    default: return '/';
  }
};

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      return pathToRoute(window.location.pathname);
    }
    return 'home';
  });
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false);
  const [isMetaPixelModalOpen, setIsMetaPixelModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminHubOpen, setIsAdminHubOpen] = useState(false);

  // Estado de Verificación Oficial QR (Estilo Reposo IPS)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);

  // Estado del Portal de Clientes (ERP)
  const [isClientLoginOpen, setIsClientLoginOpen] = useState(false);
  const [isClientERPOpen, setIsClientERPOpen] = useState(false);
  const [clientSession, setClientSession] = useState<ClientSession | null>(() => getClientSession());

  // Estado de Suscripciones & Checkout PYG
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // Estado de Postulación Laboral & Bolsa de Talentos
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

  // Estado del Copilot RRHH Tobi
  const [isTobiOpen, setIsTobiOpen] = useState(false);
  const [tobiInitialPrompt, setTobiInitialPrompt] = useState<string | undefined>(undefined);

  const handleOpenClientPortal = () => {
    const session = getClientSession();
    if (session) {
      setClientSession(session);
      setIsClientERPOpen(true);
    } else {
      setIsClientLoginOpen(true);
    }
  };

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated()) {
      setIsAdminHubOpen(true);
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  useEffect(() => {
    // Inicialización silenciosa en segundo plano para Meta Ads
    initMetaPixel();

    // Atajo de teclado para acceso administrativo seguro (Ctrl + Shift + A o Cmd + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        handleOpenAdmin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Detección opcional por parámetro de URL (?validar=1 estilo Reposo IPS, ?admin=1, ?portal=1)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('validar') === '1' || params.get('sello') || params.get('s')) {
        setVerificationData({
          tipo: params.get('tipo') || params.get('t_doc') || (params.get('periodo') || params.get('inicio') ? 'vacaciones' : 'finiquito'),
          sello: params.get('sello') || params.get('s') || '',
          ci: params.get('ci') || params.get('c') || '',
          nombre: params.get('nombre') || params.get('n') || '',
          empresa: params.get('empresa') || params.get('e') || '',
          cargo: params.get('cargo') || '',
          motivo: params.get('motivo') || params.get('m') || '',
          fechaIngreso: params.get('ingreso') || params.get('fi') || '',
          fechaEgreso: params.get('egreso') || params.get('fe') || '',
          fechaInicio: params.get('inicio') || '',
          fechaFin: params.get('fin') || '',
          fechaRetorno: params.get('retorno') || '',
          dias: Number(params.get('dias')) || 0,
          periodo: params.get('periodo') || '',
          totalNeto: Number(params.get('neto') || params.get('t')) || 0,
          salarioMensual: Number(params.get('salario') || params.get('sal')) || 0,
          regimen: params.get('regimen') || params.get('r') || 'general',
        });
        setIsVerificationModalOpen(true);
      }
      if (params.get('admin') === '1' || params.get('admin') === 'true') {
        handleOpenAdmin();
      }
      if (params.get('portal') === '1' || params.get('cliente') === '1') {
        handleOpenClientPortal();
      }
      if (params.get('planes') === '1' || params.get('precios') === '1' || params.get('pricing') === '1') {
        setIsPricingModalOpen(true);
      }
      if (params.get('empleos') === '1' || params.get('postulacion') === '1' || params.get('talentos') === '1') {
        setIsJobModalOpen(true);
      }
    }

    // Sincronización con botones Atrás / Adelante del navegador (History API)
    const onPopState = () => {
      const nextRoute = pathToRoute(window.location.pathname);
      setCurrentRoute(nextRoute);
      if (nextRoute === 'cliente-login') {
        handleOpenClientPortal();
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const navigateTo = useCallback((route: AppRoute) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      const targetPath = routeToPath(route);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ route }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Registro en analíticas Meta Pixel
    const label =
      route === 'home'
        ? 'Landing Principal LaboraPy'
        : route === 'calculadora'
        ? 'Calculadora de Liquidación'
        : route === 'servicios'
        ? 'Servicios Profesionales LaboraPy'
        : route === 'cliente-login'
        ? 'Portal Clientes ERP'
        : route === 'documentos'
        ? 'Generador de Documentos'
        : 'Preguntas Frecuentes & Marco Legal';
    trackVisualizacionModulo(label);

    if (route === 'cliente-login') {
      handleOpenClientPortal();
    }
  }, []);

  const faqs = [
    {
      q: '¿Cómo se calcula la indemnización por despido injustificado en Paraguay?',
      a: 'Conforme al Art. 91 del Código del Trabajo (Ley N.º 213/93), la indemnización equivale a 15 salarios diarios por cada año de servicio o fracción superior a 6 meses. La base salarial diaria se calcula tomando el promedio mensual de las remuneraciones devengadas durante los últimos 6 meses dividido entre 30 (Art. 92 inc. B).'
    },
    {
      q: '¿Cuántos días de preaviso corresponden según la antigüedad laboral?',
      a: 'El Art. 87 de la Ley N.º 213/93 establece: hasta 1 año de servicio corresponden 30 días; más de 1 y hasta 5 años, 45 días; más de 5 y hasta 10 años, 60 días; y más de 10 años de antigüedad en adelante, 90 días.'
    },
    {
      q: '¿El aguinaldo proporcional paga aporte al IPS en Paraguay?',
      a: 'No. El Art. 76 del Decreto-Ley N.º 1860/50 del IPS excluye expresamente al aguinaldo de la base imponible ("exceptuando los aguinaldos"). Por tanto, el aguinaldo proporcional se liquida íntegro y libre de deducciones previsionales.'
    },
    {
      q: '¿Qué ocurre si el trabajador renuncia sin otorgar el preaviso?',
      a: 'De acuerdo con el Art. 90 (segundo párrafo) de la Ley N.º 213/93, si el trabajador omite el preaviso correspondiente en su renuncia, el empleador está facultado a descontar de la liquidación una cantidad equivalente a la mitad (50%) del salario correspondiente al término del preaviso.'
    },
    {
      q: '¿Cómo se calculan las vacaciones anuales causadas y proporcionales?',
      a: 'El Art. 218 establece la escala anual: 12 días corridos (hasta 5 años de antigüedad), 18 días (entre 5 y 10 años) y 30 días (más de 10 años). Las vacaciones proporcionales corresponden ante despido sin justa causa imputable al empleador (Art. 221).'
    },
    {
      q: '¿Qué ocurre si el empleado tiene 10 o más años de antigüedad?',
      a: 'A partir de los 10 años, el trabajador adquiere la estabilidad especial prevista en el Código Laboral (Art. 94). Nuestro motor genera una advertencia preventiva indicando que se requiere revisión profesional antes de formalizar la desvinculación.'
    },
    {
      q: '¿Tengo derecho a indemnización y aguinaldo si facturo todos los meses en vez de tener IPS?',
      a: 'Sí, plenamente. En la República del Paraguay rige el Principio de Primacía de la Realidad (Arts. 18 y 19 de la Ley N.º 213/93). Si una persona emite facturas con IVA periódicamente a una misma empresa, cumple un horario y acata órdenes, la ley laboral presume de pleno derecho la existencia de un contrato de trabajo en relación de dependencia. No importa si se firmó un contrato de "locación de servicios": los derechos laborales son irrenunciables (Art. 3) y corresponden indemnización por despido, preaviso, aguinaldo proporcional, vacaciones y el derecho a demandar o denunciar ante el MTESS/IPS los aportes jubilatorios evadidos.'
    },
    {
      q: '¿Me pueden despedir si estoy embarazada o en período de lactancia materna?',
      a: '¡No! La Ley N.º 5508/15 y el Art. 136 del Código del Trabajo otorgan Inamovilidad Laboral Absoluta y Fuero Maternal. Desde la notificación del embarazo y durante todo el período de lactancia, ningún empleador puede despedirte válidamente sin haber obtenido previamente una sentencia judicial favorable en un juicio de justificación de causal ante el Juzgado del Trabajo. Cualquier despido unilateral es nulo de pleno derecho, dando lugar a la reincorporación inmediata o al pago de salarios caídos más indemnizaciones agravadas.'
    },
    {
      q: '¿Qué ocurre si el empleador me adeuda el aguinaldo del año anterior?',
      a: 'Conforme al Art. 243 de la Ley N.º 213/93, el pago del aguinaldo antes del 31 de diciembre es una obligación legal indelegable del empleador. Si la empresa omitió abonarte el aguinaldo pasado, esa suma constituye un crédito laboral exigible e irrenunciable que debe sumarse al 100% íntegro a tu liquidación final, completamente libre de retenciones al IPS.'
    },
    {
      q: '¿Cómo funciona el servicio de Búsqueda y Selección de Personal de LaboraPy?',
      a: 'Brindamos un servicio profesional integral de reclutamiento y headhunting adaptado a las necesidades de empresas en Paraguay. Cubrimos personal operativo (fábrica, choferes, logística, caja), mandos medios (supervisores, jefes de turno, encargados) y profesionales (contadores, analistas, ingenieros, mandos ejecutivos). Nuestro proceso incluye: relevamiento del perfil, filtros curriculares, entrevistas por competencias, validación exhaustiva de referencias laborales y presentación de terna finalista con garantía de reemplazo durante el período de prueba.'
    },
    {
      q: '¿Cómo puedo postularme a las búsquedas laborales activas o remitir mi CV?',
      a: 'Si buscas empleo o deseas postularte a las oportunidades laborales gestionadas por LaboraPy, puedes enviarnos tu CV actualizado a través de nuestro botón de WhatsApp o al correo de contacto indicando tu área de experiencia y pretensión salarial. Tu perfil será ingresado a nuestra base confidencial de talentos para ser considerado en búsquedas presentes y futuras.'
    },
    {
      q: '¿Cómo se liquida el IVA mensual y qué exige el Registro Electrónico de Comprobantes (RG 90) en Marangatu?',
      a: 'El Impuesto al Valor Agregado (IVA General 10% y tasas diferenciadas) se liquida mensualmente a través del Formulario 120 en el Sistema Marangatu de la DNIT. Según la Resolución General N.º 90/2021, todos los contribuyentes obligados al IVA deben registrar electrónicamente sus comprobantes de compras y ventas mes a mes. En LaboraPy realizamos la carga, validación rigurosa de deducciones y cruce fiscal para garantizar el aprovechamiento lícito de créditos fiscales y evitar bloqueos de timbrado o multas por contravención.'
    },
    {
      q: '¿Cuáles son las diferencias entre IRE Simple, IRE Resimple e IRE General bajo la Ley N.º 6380/19?',
      a: 'El Impuesto a la Renta Empresarial (IRE) grava las utilidades de actividades comerciales, industriales o de servicios: 1) IRE Resimple: Para unipersonales y microempresas con ingresos brutos hasta Gs. 80.000.000 anuales (pago de cuota fija trimestral sin IVA). 2) IRE Simple: Para pequeñas empresas con facturación anual hasta Gs. 2.000.000.000 (determina renta por base real o presunta). 3) IRE General: Obligatorio para empresas que superen los Gs. 2.000.000.000 o sociedades comerciales (S.A., S.R.L., E.A.S.), con tasa del 10% sobre renta neta y exigencia de contabilidad completa con libros rubricados y estados financieros.'
    },
    {
      q: '¿Quiénes están alcanzados por el Impuesto a la Renta Personal (IRP) en Paraguay?',
      a: 'El IRP grava a las personas físicas en dos categorías independientes: 1) Rentas de Servicios Personales (RSP): Alcanza a dependientes o profesionales independientes que presten servicios sin relación societaria cuando sus ingresos brutos superen los 80 millones de guaraníes en el ejercicio fiscal, con tasas progresivas del 8%, 9% y 10%. 2) Rentas y Ganancias de Capital (RGC): Grava dividendos, utilidades, alquileres de inmuebles y venta ocasional de bienes a una tasa fija del 8% sin rango no incidido.'
    },
    {
      q: '¿Qué requisitos deben tener los Estados Financieros y Balances para créditos bancarios o licitaciones públicas (DNCP)?',
      a: 'Los Estados Financieros (Balance General, Estado de Resultados, Estado de Flujo de Efectivo y Estado de Variación del Patrimonio Neto) deben elaborarse conforme a las Normas Contables y resoluciones de la DNIT, acompañados del cuadro de revalúo y depreciación de bienes del activo fijo. Para el sistema bancario y la DNCP es obligatoria la firma de un Contador Público Matriculado con RUC activo y, en empresas de mayor porte, informe de auditoría externa impositiva. En LaboraPy elaboramos y certificamos balances con ratios financieros auditables que demuestran la solidez y liquidez de tu empresa.'
    },
    {
      q: '¿Cuáles son las comunicaciones mensuales y planillas anuales obligatorias ante el MTESS en Paraguay?',
      a: 'Toda empresa en Paraguay tiene obligaciones patronales periódicas ante el Ministerio de Trabajo, Empleo y Seguridad Social (MTESS): 1) Mensualmente: A través del sistema REOP se debe registrar mensualmente la comunicación de salarios devengados, así como las entradas, salidas, permisos, sanciones y finiquitos de liquidación final en los plazos legales establecidos. 2) Anualmente: Es obligatoria la presentación anual de las tres planillas laborales oficiales (Planilla de Empleados y Obreros, Sueldos y Jornales, y Resumen General de Personas Ocupadas) dentro del calendario fijado por el MTESS. Omitir estas comunicaciones genera multas por contravención y sumarios. En LaboraPy nos encargamos de las comunicaciones mensuales y planillas anuales del MTESS para mantener a su empresa 100% en regla.'
    },
    {
      q: '¿Cómo nos ayuda LaboraPy con el estado de deudas tributarias y la reactivación de IVA o perfil tributario ante la DNIT (ex SET)?',
      a: 'En LaboraPy brindamos acompañamiento contable integral para gestiones ante la Dirección Nacional de Ingresos Tributarios (DNIT / ex SET). Realizamos un estudio exhaustivo de cada caso: 1) Diagnóstico de Estado de Deudas: Verificamos en el Sistema Marangatu la cuenta corriente tributaria, multas por contravención, omisiones y determinamos el saldo real exigible para tramitar facilidades de pago o el Certificado de Cumplimiento Tributario (CCT). 2) Reactivación de IVA y Perfil Tributario: Si tu RUC fue suspendido temporalmente, bloqueado o no puedes solicitar timbrado por falta de presentación de declaraciones juradas mensuales (F.120 IVA, RG 90) o anuales (IRE/IRP), regularizamos los periodos pendientes, gestionamos el levantamiento de bloqueos ante la DNIT y te dejamos habilitado para volver a facturar con total normalidad.'
    }
  ];

  return (
    <div
      style={{
        minHeight: currentRoute === 'home' ? '100dvh' : '100vh',
        height: currentRoute === 'home' ? '100dvh' : undefined,
        maxHeight: currentRoute === 'home' ? '100dvh' : undefined,
        overflow: currentRoute === 'home' ? 'hidden' : undefined,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── RUTA: HOME (100% TOBI AI CHAT LANDING — Estilo Claude / ChatGPT / Gemini) ── */}
      {currentRoute === 'home' ? (
        <TobiChatLanding
          userName={clientSession?.usuario?.nombreContacto?.split(' ')[0]}
          companyName={clientSession?.empresa?.nombreFantasia || clientSession?.empresa?.razonSocial}
          clientId={clientSession?.usuario.clienteId}
          companyId={clientSession?.empresa.id}
          onNavigate={navigateTo}
          onOpenClientPortal={handleOpenClientPortal}
        />
      ) : (
        <>
          {/* ── Encabezado para Subpáginas (Calculadora, Servicios, etc.) ── */}
          <header className="app-header">
            <div className="brand-wrapper" onClick={() => navigateTo('home')}>
              <span style={{ fontSize: '28px' }}>🇵🇾</span>
              <div>
                <div className="brand-title">
                  {LABORAPY_CONFIG.shortBrandName}
                  <span className="brand-badge">{LABORAPY_CONFIG.legalBadge}</span>
                </div>
                <div className="brand-subtitle">
                  {LABORAPY_CONFIG.subtitle}
                </div>
              </div>
            </div>

            {/* ── Menú de Navegación / Selector de Rutas SPA ── */}
            <nav className="nav-tabs" aria-label="Navegación principal">
              <button
                onClick={() => navigateTo('home')}
                className="nav-tab-btn"
              >
                <span className="nav-tab-icon">✨</span>
                <span>Asistente Tobi</span>
              </button>
              <button
                onClick={() => navigateTo('calculadora')}
                className={`nav-tab-btn ${currentRoute === 'calculadora' ? 'active' : ''}`}
              >
                <span className="nav-tab-icon">🧮</span>
                <span>Liquidación Final</span>
              </button>
              <button
                onClick={() => navigateTo('servicios')}
                className={`nav-tab-btn ${currentRoute === 'servicios' ? 'active' : ''}`}
              >
                <span className="nav-tab-icon">💼</span>
                <span>Servicios & Contabilidad</span>
              </button>
              <button
                onClick={() => navigateTo('documentos')}
                className={`nav-tab-btn ${currentRoute === 'documentos' ? 'active' : ''}`}
              >
                <span className="nav-tab-icon">📄</span>
                <span>Documentos</span>
              </button>
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className="nav-tab-btn"
                title="Planes y precios de suscripción en Guaraníes (PYG)"
              >
                <span className="nav-tab-icon">💳</span>
                <span>Planes & Precios</span>
              </button>
              <button
                onClick={() => setIsJobModalOpen(true)}
                className="nav-tab-btn"
                title="Bolsa de trabajo y postulación de talentos en Paraguay"
              >
                <span className="nav-tab-icon">🤝</span>
                <span>Empleos</span>
              </button>
              <button
                onClick={() => navigateTo('legal')}
                className={`nav-tab-btn ${currentRoute === 'legal' ? 'active' : ''}`}
              >
                <span className="nav-tab-icon">❓</span>
                <span>Preguntas</span>
              </button>
            </nav>

            {/* ── Botón de Acceso Clientes ERP ── */}
            <button
              onClick={() => navigateTo('cliente-login')}
              className="header-erp-btn"
              title="Acceso inmediato al ERP para empresas clientes: nóminas, contratos en PDF, IPS y MTESS"
            >
              <span className="header-erp-icon">🏢</span>
              <span>Acceso Clientes</span>
              <span className="header-erp-tag">ERP</span>
            </button>

            {/* ── Botón Rápido de WhatsApp en Header (Desktop) ── */}
            <a
              href={createWhatsAppUrl(WhatsAppMessages.general())}
              target="_blank"
              rel="noopener noreferrer"
              className="header-whatsapp-btn"
              title={`Contactar especialistas de LaboraPy (${LABORAPY_CONFIG.whatsAppDisplay})`}
            >
              <span>💬</span>
              <span>WhatsApp (+595)</span>
            </a>
          </header>
        </>
      )}

      {/* ── RUTA: CALCULADORA (Página Dedicada Directa al Cálculo) ── */}
      {currentRoute === 'calculadora' && (
        <main className="page-container subpage-container" style={{ flex: 1 }}>
          <div className="subpage-header-bar">
            <button
              type="button"
              className="subpage-back-btn"
              onClick={() => navigateTo('home')}
            >
              ← Volver al Inicio
            </button>
            <div className="subpage-title-badge">
              <span>🧮</span>
              <span>Calculadora de Liquidación Laboral · Ley N.º 213/93 & IPS</span>
            </div>
          </div>

          <FinalSettlementModal />
        </main>
      )}

      {/* ── RUTA: SERVICIOS (Página Dedicada B2B, RRHH & Contabilidad) ── */}
      {currentRoute === 'servicios' && (
        <main className="page-container subpage-container" style={{ flex: 1 }}>
          <div className="subpage-header-bar">
            <button
              type="button"
              className="subpage-back-btn"
              onClick={() => navigateTo('home')}
            >
              ← Volver al Inicio
            </button>
            <div className="subpage-title-badge">
              <span>💼</span>
              <span>Servicios Profesionales: B2B, Selección & Contabilidad DNIT</span>
            </div>
          </div>

          <LaboraPyServicesSection onSelectTab={(tab) => {
            if (tab === 'settlement') navigateTo('calculadora');
            else if (tab === 'documents') navigateTo('documentos');
            else if (tab === 'legal') navigateTo('legal');
          }} />
        </main>
      )}

      {/* ── RUTA: CLIENTE-LOGIN (Acceso al Portal Empresas ERP) ── */}
      {currentRoute === 'cliente-login' && (
        <main className="page-container subpage-container" style={{ flex: 1, textAlign: 'center', padding: '40px 16px' }}>
          <div className="subpage-header-bar">
            <button
              type="button"
              className="subpage-back-btn"
              onClick={() => navigateTo('home')}
            >
              ← Volver al Inicio
            </button>
            <div className="subpage-title-badge">
              <span>🏢</span>
              <span>Portal de Clientes ERP</span>
            </div>
          </div>

          <div style={{ maxWidth: '600px', margin: '40px auto', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '18px', padding: '36px 24px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🏢</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>
              Portal Empresas ERP LaboraPy
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '24px' }}>
              Gestión centralizada de nóminas, emisión de recibos con firma digital, planillas del MTESS (REOP), y contratos laborales en PDF blindados.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleOpenClientPortal}
                className="hero-cta-btn hero-cta-erp"
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                <span>🔑</span>
                <span>Ingresar al Portal ERP</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="hero-cta-btn hero-cta-calc"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ── RUTA: DOCUMENTOS (Generador de Documentos Laborales) ── */}
      {currentRoute === 'documentos' && (
        <main className="page-container subpage-container" style={{ flex: 1 }}>
          <div className="subpage-header-bar">
            <button
              type="button"
              className="subpage-back-btn"
              onClick={() => navigateTo('home')}
            >
              ← Volver al Inicio
            </button>
            <div className="subpage-title-badge">
              <span>📄</span>
              <span>Generador de Documentos Laborales Oficiales</span>
            </div>
          </div>

          <HRDocumentModal />
        </main>
      )}

      {/* ── RUTA: LEGAL (Preguntas Frecuentes y Fundamento Jurídico) ── */}
      {currentRoute === 'legal' && (
        <main className="page-container subpage-container" style={{ flex: 1 }}>
          <div className="subpage-header-bar">
            <button
              type="button"
              className="subpage-back-btn"
              onClick={() => navigateTo('home')}
            >
              ← Volver al Inicio
            </button>
            <div className="subpage-title-badge">
              <span>❓</span>
              <span>Preguntas Frecuentes y Marco Legal (Paraguay)</span>
            </div>
          </div>

          <div style={{ maxWidth: '840px', margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ color: '#0f172a', marginTop: 0, fontSize: '20px', fontWeight: 800 }}>
              Preguntas Frecuentes y Marco Legal (Paraguay)
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
              Fundamentos jurídicos del cálculo según el Código del Trabajo y el régimen del IPS:
            </p>

            {/* Acordeón de FAQs */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#fafafa',
                  }}
                >
                  <button
                    onClick={() => setFaqOpenIndex(faqOpenIndex === i ? null : i)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '16px 18px',
                      background: '#fff',
                      border: 'none',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ fontSize: '18px', color: '#047857', fontWeight: 900 }}>
                      {faqOpenIndex === i ? '−' : '+'}
                    </span>
                  </button>
                  {faqOpenIndex === i && (
                    <div
                      style={{
                        padding: '16px 18px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#475569',
                        borderTop: '1px solid #e2e8f0',
                        background: '#f8fafc',
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
              <strong>⚠️ Estimación Referencial:</strong> Este sistema genera una liquidación referencial basada en los parámetros de la Ley 213/93 y normativas del IPS. Para consultas específicas o controversias laborales, solicite asesoría profesional con los especialistas de LaboraPy.
            </div>
          </div>
        </main>
      )}

      {/* ── Footer Neutral y Profesional con Branding Completo LaboraPy (Subpáginas) ── */}
      {currentRoute !== 'home' && (
        <footer
          style={{
            background: '#0f172a',
            color: '#94a3b8',
            padding: '36px 20px',
            borderTop: '1px solid #1e293b',
            marginTop: 'auto',
            fontSize: '13px',
          }}
        >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          {/* Columna 1: Identidad y Contacto Directo */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '17px', color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🇵🇾</span> {LABORAPY_CONFIG.brandName}
            </div>
            <p style={{ margin: '0 0 12px', lineHeight: '1.6' }}>
              Soluciones integrales para empresas y profesionales en Paraguay: Selección de personal, consultoría en desvinculaciones laborales y contabilidad tributaria (DNIT / Ley 6380/19).
            </p>
            <div style={{ marginTop: '10px' }}>
              <a
                href={createWhatsAppUrl(WhatsAppMessages.general())}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#25d366',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '13px',
                }}
              >
                <span>💬</span>
                <span>WhatsApp: {LABORAPY_CONFIG.whatsAppDisplay}</span>
              </a>
            </div>
          </div>

          {/* Columna 2: Servicios para Empresas B2B */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0', textTransform: 'uppercase', marginBottom: '8px' }}>
              RRHH & Selección
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.9' }}>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.seleccionEmpresa())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Búsqueda y Selección de Talentos
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.b2bEmpresas('Auditorías Laborales'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Auditoría Laboral (Ley 213/93)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.b2bEmpresas('Tercerización de Nóminas IPS/MTESS'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Tercerización Nóminas IPS/MTESS
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.mtessPlanillas())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Comunicaciones & Planillas MTESS
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.b2bEmpresas('Liquidaciones y Finiquitos'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Liquidaciones & Finiquitos Laborales
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.postulacionCandidato())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Postulación a Empleos (Enviar CV)
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 3: Contabilidad & Impuestos DNIT */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0', textTransform: 'uppercase', marginBottom: '8px' }}>
              Contabilidad & DNIT
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.9' }}>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.contabilidadIvaRenta('IVA y RG 90'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Liquidación IVA & RG 90 (F120)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.contabilidadIvaRenta('IRE Simple y General'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Renta Empresarial (IRE Simple/General)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.contabilidadIvaRenta('IRP'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Renta Personal (IRP Servicios y Capital)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.estadosFinancieros('Bancos y Licitaciones DNCP'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Balances para Bancos & DNCP
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.librosContablesRuc())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Libros Contables, Compliance & RUC
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.estadoDeudasDnit())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Gestiones DNIT & Estado de Deudas
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.reactivacionIvaPerfil())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#c084fc', textDecoration: 'none' }}
                >
                  • Reactivación IVA & Perfil DNIT
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 4: Servicios para Particulares B2C */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0', textTransform: 'uppercase', marginBottom: '8px' }}>
              Particulares (B2C)
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.9' }}>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.b2cParticulares('Despido Injustificado'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Asesoría en Despidos y Liquidaciones
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.primaciaRealidad())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Facturación IVA (Relación Dependencia)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.reactivacionIvaPerfil())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#c084fc', textDecoration: 'none' }}
                >
                  • Reactivación de IVA / RUC (DNIT)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.maternidad())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Fuero Maternal (Ley N.º 5508/15)
                </a>
              </li>
              <li>
                <a
                  href={createWhatsAppUrl(WhatsAppMessages.estabilidad10Anios())}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', textDecoration: 'none' }}
                >
                  • Estabilidad Laboral (+10 Años)
                </a>
              </li>
            </ul>
          </div>

          {/* Columna 5: Herramientas Gratuitas */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e2e8f0', textTransform: 'uppercase', marginBottom: '8px' }}>
              Herramientas & Portal
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.9' }}>
              <li>
                <a href="#calculadora" onClick={(e) => { e.preventDefault(); navigateTo('calculadora'); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  • Calculadora de Liquidación
                </a>
              </li>
              <li>
                <a href="#servicios" onClick={(e) => { e.preventDefault(); navigateTo('servicios'); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  • Catálogo de Servicios LaboraPy
                </a>
              </li>
              <li>
                <a href="#documentos" onClick={(e) => { e.preventDefault(); navigateTo('documentos'); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  • Generador de Documentos
                </a>
              </li>
              <li>
                <a href="#legal" onClick={(e) => { e.preventDefault(); navigateTo('legal'); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  • Preguntas Frecuentes & Marco Legal
                </a>
              </li>
              <li style={{ marginBottom: '6px' }}>
                <button
                  onClick={handleOpenClientPortal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    padding: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '12px',
                    textAlign: 'left',
                    fontWeight: 700,
                  }}
                  title="Acceso al Portal ERP para Empresas Clientes (Nóminas, Contratos, IPS, MTESS)"
                >
                  • 🏢 Acceso a Clientes (ERP Web)
                </button>
              </li>
              <li>
                <button
                  onClick={handleOpenAdmin}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    padding: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '12px',
                    textAlign: 'left',
                    opacity: 0.75,
                    transition: 'color 0.2s, opacity 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.opacity = '0.75';
                  }}
                  title="Acceso restringido para personal de LaboraPy (Ctrl + Shift + A)"
                >
                  • 🔒 Acceso Staff / Admin
                </button>
              </li>
            </ul>
          </div>
        </div>

          <div style={{ maxWidth: '1200px', margin: '28px auto 0', paddingTop: '16px', borderTop: '1px solid #1e293b', textAlign: 'center', fontSize: '11.5px', lineHeight: '1.5', color: '#64748b' }}>
            <div>© 2026 {LABORAPY_CONFIG.brandName} · Todos los derechos reservados · Asunción, Paraguay</div>
            <div style={{ marginTop: '4px', opacity: 0.85 }}>
              Aviso: Servicios contables, balances y gestiones tributarias ante la DNIT (reactivación de IVA, regularización de perfil fiscal y estado de deudas) con certificación y firma de Contador Matriculado (Ley N.º 6380/19). Servicios de consultoría de RRHH y selección de talentos como segunda opinión técnica especializada (no constituye patrocinio letrado ni representación jurídica ante tribunales).
            </div>
          </div>
        </footer>
      )}

      {/* ── Botones Flotantes solo en Subpáginas (En Home todo el espacio es Tobi) ── */}
      {currentRoute !== 'home' && <FloatingWhatsAppButton />}

      {currentRoute !== 'home' && !isClientERPOpen && (
        <TobiFloatingButton
          onClick={() => setIsTobiOpen(true)}
          isOpen={isTobiOpen}
        />
      )}
      {currentRoute !== 'home' && (
        <TobiChatModal
          isOpen={isTobiOpen && !isClientERPOpen}
          onClose={() => {
            setIsTobiOpen(false);
            setTobiInitialPrompt(undefined);
          }}
          isGuest={!clientSession}
          clientId={clientSession?.usuario.clienteId}
          companyId={clientSession?.empresa.id}
          companyName={clientSession?.empresa.nombreFantasia || clientSession?.empresa.razonSocial}
          initialPrompt={tobiInitialPrompt}
        />
      )}

      {/* Modal de Inicio de Sesión de Clientes */}
      <ClientLoginModal
        isOpen={isClientLoginOpen}
        onClose={() => setIsClientLoginOpen(false)}
        onLoginSuccess={() => {
          setIsClientLoginOpen(false);
          const sess = getClientSession();
          if (sess) {
            setClientSession(sess);
            setIsClientERPOpen(true);
          }
        }}
      />

      {/* Portal Maestro ERP de Clientes (Si está autenticado) */}
      {clientSession && (
        <ClientERPModal
          isOpen={isClientERPOpen}
          session={clientSession}
          onClose={() => setIsClientERPOpen(false)}
          onLogout={() => {
            setClientSession(null);
            setIsClientERPOpen(false);
          }}
          onSimulateSettlement={_emp => {
            setIsClientERPOpen(false);
            navigateTo('calculadora');
          }}
        />
      )}

      {/* Modal de Autenticación de Administrador */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onAuthenticated={() => {
          setIsAdminLoginOpen(false);
          setIsAdminHubOpen(true);
        }}
      />

      {/* Centro de Control Administrativo (Solo si está autenticado) */}
      <AdminHubModal
        isOpen={isAdminHubOpen}
        onClose={() => setIsAdminHubOpen(false)}
        onOpenCommercial={() => setIsCommercialModalOpen(true)}
        onOpenMetaPixel={() => setIsMetaPixelModalOpen(true)}
        onLogout={() => {
          setIsAdminHubOpen(false);
          setIsCommercialModalOpen(false);
          setIsMetaPixelModalOpen(false);
        }}
        onReconfigure2FA={() => {
          setIsAdminLoginOpen(true);
        }}
        onOpenClientERP={() => {
          setIsAdminHubOpen(false);
          handleOpenClientPortal();
        }}
      />

      {/* Modal Comercial de Gestión y Exportación de Leads (Protegido con sesión) */}
      {isAdminAuthenticated() && (
        <CommercialLeadsModal
          isOpen={isCommercialModalOpen}
          onClose={() => {
            setIsCommercialModalOpen(false);
            setIsAdminHubOpen(true);
          }}
        />
      )}

      {/* Modal de Configuración Rápida de Meta Ads (Facebook & Instagram) (Protegido con sesión) */}
      {isAdminAuthenticated() && (
        <MetaPixelConfigModal
          isOpen={isMetaPixelModalOpen}
          onClose={() => {
            setIsMetaPixelModalOpen(false);
            setIsAdminHubOpen(true);
          }}
        />
      )}

      {/* Modal Oficial de Consulta y Auditoría de Autenticidad QR (Estilo Reposo IPS) */}
      {isVerificationModalOpen && verificationData && (
        <DocumentVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          data={verificationData}
        />
      )}

      {/* Modal de Planes, Precios y Checkout PYG (SIPAP / QR / WhatsApp) */}
      <PricingPlansModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      {/* Modal de Postulación Laboral y Banco de Talentos */}
      <JobApplicationModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
      />
    </div>
  );
};

export default App;