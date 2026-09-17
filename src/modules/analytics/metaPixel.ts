/**
 * SERVICIO DE INTEGRACIÓN CON META ADS (FACEBOOK & INSTAGRAM ADS)
 * Facilita la conexión con el Meta Pixel y el seguimiento de conversiones estándar y personalizadas.
 * Versión: PY-LIQ-2026.09.01
 */

// Clave en localStorage para configurar el Pixel ID sin necesidad de tocar código
export const META_PIXEL_STORAGE_KEY = 'sw_meta_pixel_id';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

/**
 * Obtiene el Pixel ID configurado (prioriza localStorage, fallback a variable de entorno)
 */
export function getMetaPixelId(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(META_PIXEL_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  }
  return (import.meta.env.VITE_META_PIXEL_ID as string) || '';
}

/**
 * Guarda o actualiza el Meta Pixel ID en localStorage
 */
export function setMetaPixelId(pixelId: string): void {
  if (typeof window !== 'undefined') {
    if (pixelId && pixelId.trim()) {
      localStorage.setItem(META_PIXEL_STORAGE_KEY, pixelId.trim());
      initMetaPixel(pixelId.trim());
    } else {
      localStorage.removeItem(META_PIXEL_STORAGE_KEY);
    }
  }
}

/**
 * Inicializa el script oficial de Meta Pixel de forma segura y asíncrona
 */
export function initMetaPixel(pixelId?: string): boolean {
  if (typeof window === 'undefined') return false;

  const id = pixelId || getMetaPixelId();
  if (!id) return false;

  // Si ya está inicializado, registrar PageView
  if (window.fbq) {
    try {
      window.fbq('init', id);
      window.fbq('track', 'PageView');
      return true;
    } catch {
      return false;
    }
  }

  try {
    /* Script oficial de inicialización de Meta Pixel */
    const f: any = window;
    if (f.fbq) return true;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    n('init', id);
    n('track', 'PageView');
    console.log(`[Meta Ads] Pixel inicializado con ID: ${id}`);
    return true;
  } catch (err) {
    console.warn('[Meta Ads] No se pudo inicializar Meta Pixel:', err);
    return false;
  }
}

/**
 * Envía un evento a Meta Ads (estándar o personalizado)
 */
export function trackMetaEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.fbq) {
    // Si Meta Pixel no está activo, registrar en consola para depuración de campañas
    console.debug(`[Meta Ads] Evento simulado (${eventName}):`, params);
    return;
  }

  try {
    window.fbq('track', eventName, params);
  } catch (e) {
    console.warn(`[Meta Ads] Error al enviar evento ${eventName}:`, e);
  }
}

/**
 * Envía un evento personalizado a Meta Ads
 */
export function trackMetaCustomEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.fbq) {
    console.debug(`[Meta Ads Custom] Evento simulado (${eventName}):`, params);
    return;
  }

  try {
    window.fbq('trackCustom', eventName, params);
  } catch (e) {
    console.warn(`[Meta Ads Custom] Error al enviar evento ${eventName}:`, e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Eventos Clave de Conversión para Campañas de Meta Ads (Facebook & Instagram)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evento: Lead / Cálculo de Liquidación
 * Optimizado para campañas con objetivo de Generación de Clientes Potenciales (Leads)
 */
export function trackCalculoLiquidacion(data: {
  motivo: string;
  totalNetoEstimado: number;
  antiguedadAnios: number;
}): void {
  trackMetaEvent('Lead', {
    content_name: 'Cálculo de Liquidación Laboral',
    content_category: 'Recursos Humanos',
    value: data.totalNetoEstimado,
    currency: 'PYG',
    motivo_salida: data.motivo,
    antiguedad_anios: data.antiguedadAnios,
  });

  trackMetaCustomEvent('CalculoLiquidacionCompletado', data);
}

/**
 * Evento: Descarga de Finiquito Oficial en PDF (Conversión de Alto Valor)
 */
export function trackDescargaPDF(data: {
  documento: string;
  empleado?: string;
  montoNeto?: number;
}): void {
  trackMetaEvent('Purchase', {
    content_name: `Descarga ${data.documento}`,
    content_type: 'product',
    value: data.montoNeto || 0,
    currency: 'PYG',
  });

  trackMetaCustomEvent('DescargaDocumentoPDF', data);
}

/**
 * Evento: Descarga de Archivo Word Editable (.docx)
 */
export function trackDescargaDocx(data: { documento: string; empleado?: string }): void {
  trackMetaCustomEvent('DescargaDocumentoWord', data);
}

/**
 * Evento: Emisión de Notificación o Certificado Laboral
 */
export function trackEmisionNota(data: { tipo: string; empleado?: string }): void {
  trackMetaEvent('SubmitApplication', {
    content_name: `Emisión de ${data.tipo}`,
    content_category: 'Documentos Laborales',
  });

  trackMetaCustomEvent('NotaLaboralGenerada', data);
}

/**
 * Evento: Visualización de Contenido (Navegación entre pestañas)
 */
export function trackVisualizacionModulo(modulo: string): void {
  trackMetaEvent('ViewContent', {
    content_name: modulo,
    content_category: 'Sección RRHH',
  });
}

/**
 * Evento Clave: Captura de Lead en Embudo de Descarga (Funnel & Comercio)
 */
export function trackLeadCapturado(data: {
  email: string;
  tipoUsuario: 'empresa' | 'particular';
  empresaNombre?: string;
  telefono?: string;
  documento: string;
  formato: 'pdf' | 'docx';
  montoNeto?: number;
}): void {
  trackMetaEvent('Lead', {
    content_name: `Lead Descarga ${data.documento}`,
    content_category: data.tipoUsuario === 'empresa' ? 'Empresas B2B' : 'Particular B2C',
    user_type: data.tipoUsuario,
    company: data.empresaNombre || '',
    format: data.formato,
    value: data.montoNeto || 0,
    currency: 'PYG',
  });

  trackMetaCustomEvent('LeadEmbudoDescarga', {
    ...data,
    segmento: data.tipoUsuario === 'empresa' ? 'Corporativo' : 'Individual',
  });
}

