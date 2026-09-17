import type { NotaLaboralOptions } from '../payroll/generators/noticePdfGenerator';
import type { AssistantMessage, TobiDocumentActionPayload, TobiDocumentType } from './types';

export const DOCUMENT_ACTION_REGEX = /:::documento_action\s*([\s\S]*?)\s*:::/;

export const TIPOS_DOCUMENTO_VALIDOS = [
  'amonestacion',
  'suspension_disciplinaria',
  'traslado',
  'despido_justificado',
  'despido_injustificado',
  'renuncia',
  'certificado_trabajo',
] as const;

const ALIAS_TIPO_DOCUMENTO: Readonly<Record<string, TobiDocumentType>> = {
  apercibimiento: 'amonestacion',
  'amonestación': 'amonestacion',
  suspension: 'suspension_disciplinaria',
  certificado: 'certificado_trabajo',
  certificado_laboral: 'certificado_trabajo',
};

/** Datos iniciales estructurados para precargar en el formulario interactivo de notas. */
export interface TobiDocumentFormInitialData extends Partial<TobiDocumentActionPayload> {
  readonly tieneAntecedentes?: boolean;
  readonly tieneSumario?: boolean;
  readonly maxDiasPermitidos?: number;
  readonly motivoBloqueoDias?: string;
}

/**
 * Detecta si el texto del usuario expresa intención directa de completar o redactar
 * una nota, abrir casillas o cargar datos del documento.
 */
export function isDocumentIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Patrones directos de intención de documentación
  const patronesIntencion = [
    /(?:cargar|completar|llenar|ingresar|redactar|generar|hacer|crear|emitir|preparar)\s+(?:los\s+)?(?:datos|casillas|la\s+nota|el\s+documento|nota|formulario|suspensi|amonesta|traslado|despido|renuncia|certificado)/i,
    /(?:quiero|voy a|te paso|paso ahora)\s+(?:ahora\s+)?(?:redactar|completar|cargar|los datos|la nota|el documento)/i,
    /(?:formulario|casillas\s+interactivas|nota\s+oficial\s+lista|generar\s+nota\s+al\s+toque)/i,
    /completar\s+los\s+datos\s+exactos/i,
    /te\s+paso\s+ahora\s+todos\s+los\s+datos/i,
  ];

  return patronesIntencion.some((rgx) => rgx.test(norm));
}

/**
 * Identifica el tipo de documento legal aplicable según el texto analizado.
 */
export function detectDocumentTypeFromText(
  text: string,
  fallback: TobiDocumentType = 'suspension_disciplinaria',
): TobiDocumentType {
  if (!text || typeof text !== 'string') return fallback;
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('suspens')) return 'suspension_disciplinaria';
  if (norm.includes('amonest') || norm.includes('apercib')) return 'amonestacion';
  if (norm.includes('traslado')) return 'traslado';
  if (norm.includes('renuncia') || norm.includes('dimisi')) return 'renuncia';
  if (norm.includes('certificado') || norm.includes('constancia')) return 'certificado_trabajo';
  if (norm.includes('despido')) {
    if (norm.includes('con causa') || norm.includes('justific') || norm.includes('falta grave')) {
      return 'despido_justificado';
    }
    return 'despido_injustificado';
  }

  return fallback;
}

/**
 * Limpia placeholders automáticos emitidos por Tobi (como "[Completar nombre]")
 * para que no aparezcan como valores reales en los campos de entrada.
 */
function cleanPlaceholder(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('[') || trimmed.includes('Completar') || trimmed === '—') {
    return '';
  }
  return trimmed;
}

/**
 * Extrae contexto histórico de la conversación previa para precargar casillas
 * de notas laborales sin fricción, respetando estrictamente los días de suspensión
 * acordados en el caso inicial y el principio de gradualidad (Arts. 352, 353 y 354 C.T.).
 */
export function extractDocContextFromHistory(
  messages: readonly AssistantMessage[],
  currentPrompt = '',
): { tipo: TobiDocumentType; data: TobiDocumentFormInitialData } {
  let detectedTipo: TobiDocumentType | null = null;
  let basePayload: Partial<TobiDocumentActionPayload> = {};
  let tieneAntecedentes = false;
  let tieneSumario = false;
  let diasCasoInicial: number | undefined;
  let hechosEncontrados = '';

  // 1. Prioridad: Buscar documentData previo en los mensajes de asistente
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.documentData) {
      basePayload = { ...m.documentData };
      detectedTipo = m.documentData.tipo;
      if (m.documentData.diasSuspension) {
        diasCasoInicial = m.documentData.diasSuspension;
      }
      if (m.documentData.hechosOcurridos) {
        hechosEncontrados = m.documentData.hechosOcurridos;
      }
      break;
    }
  }

  // 2. Escanear todo el historial (de inicio a fin) para detectar parámetros del caso inicial
  const allTexts = [...messages.map((m) => m.content), currentPrompt].filter(Boolean);
  const combinedNorm = allTexts
    .join(' \n ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!detectedTipo) {
    detectedTipo = detectDocumentTypeFromText(combinedNorm, 'suspension_disciplinaria');
  }

  // Antecedentes previos: "ya le amoneste", "amonestacion previa", "antecedente"
  if (
    combinedNorm.includes('ya le amonest') ||
    combinedNorm.includes('amonestacion previa') ||
    combinedNorm.includes('amoneste anteriormente') ||
    combinedNorm.includes('antecedente') ||
    combinedNorm.includes('reinciden') ||
    combinedNorm.includes('reiterad')
  ) {
    tieneAntecedentes = true;
  }

  // Sumario administrativo previo (Art. 354 C.T.)
  if (
    combinedNorm.includes('sumario') ||
    combinedNorm.includes('reglamento interno homologado')
  ) {
    tieneSumario = true;
  }

  // Días de suspensión indicados en el caso inicial (ej: "2 dias", "dos dias", "1 dia")
  if (diasCasoInicial === undefined) {
    const matchDias =
      /(?:suspender.*?|suspensi[oó]n.*?|[por|durante]\s*)(\d+)\s*d[ií]as/i.exec(combinedNorm) ||
      /\b([1-8])\s*d[ií]as?\b/i.exec(combinedNorm);

    if (matchDias) {
      const parsed = parseInt(matchDias[1], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
        diasCasoInicial = parsed;
      }
    } else if (combinedNorm.includes('dos dias')) {
      diasCasoInicial = 2;
    } else if (combinedNorm.includes('un dia')) {
      diasCasoInicial = 1;
    } else if (combinedNorm.includes('tres dias')) {
      diasCasoInicial = 3;
    }
  }

  // Si hubo mención de amonestación previa y suspensión > 1 día, antecedentes es true
  if (diasCasoInicial && diasCasoInicial > 1) {
    tieneAntecedentes = true;
  }

  // Hechos concretos si no vinieron en documentData
  if (!hechosEncontrados) {
    if (combinedNorm.includes('mala actitud')) {
      hechosEncontrados =
        'Conducta inapropiada reiterada y mala actitud en el desempeño de sus funciones, con amonestación escrita previa en legajo.';
    } else if (combinedNorm.includes('llegadas tardias') || combinedNorm.includes('tardanza')) {
      hechosEncontrados = 'Reiteradas llegadas tardías injustificadas en el horario de ingreso.';
    } else if (combinedNorm.includes('ausencia') || combinedNorm.includes('falto')) {
      hechosEncontrados = 'Inasistencia injustificada a su jornada laboral habitual.';
    }
  }

  // Límite estricto de días según el caso inicial:
  // Si el caso inicial fue de 2 días, no se le puede dejar generar 8 días a elección.
  const finalDias = diasCasoInicial ?? (tieneAntecedentes ? 2 : 1);
  const maxDiasPermitidos = diasCasoInicial !== undefined ? diasCasoInicial : (tieneSumario ? 8 : (tieneAntecedentes ? 3 : 1));

  const data: TobiDocumentFormInitialData = {
    tipo: detectedTipo,
    nombreEmpleado: cleanPlaceholder(basePayload.nombreEmpleado),
    ciEmpleado: cleanPlaceholder(basePayload.ciEmpleado),
    empresa: cleanPlaceholder(basePayload.empresa),
    cargoEmpleado: cleanPlaceholder(basePayload.cargoEmpleado),
    hechosOcurridos: hechosEncontrados || cleanPlaceholder(basePayload.hechosOcurridos),
    fundamentoLegal:
      basePayload.fundamentoLegal ||
      (detectedTipo === 'suspension_disciplinaria'
        ? 'Arts. 353 inc. a), 352 inc. i) y 354 del Código del Trabajo (Ley 213/93)'
        : undefined),
    diasSuspension: finalDias,
    tieneAntecedentes,
    tieneSumario,
    maxDiasPermitidos,
    motivoBloqueoDias:
      diasCasoInicial !== undefined
        ? `Ajustado al caso inicial analizado de ${diasCasoInicial} ${diasCasoInicial === 1 ? 'día' : 'días'} (Principio de proporcionalidad Art. 352 inc. i C.T.)`
        : undefined,
  };

  return { tipo: detectedTipo, data };
}

export function extractDocumentAction(text: string): {
  cleanedText: string;
  payload: TobiDocumentActionPayload | null;
} {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text || '', payload: null };
  }

  const match = DOCUMENT_ACTION_REGEX.exec(text);
  if (!match) {
    return { cleanedText: text, payload: null };
  }

  const rawJson = match[1].trim();
  let payload: TobiDocumentActionPayload | null = null;

  try {
    const parsed = JSON.parse(rawJson);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.tipo === 'string' &&
      typeof parsed.nombreEmpleado === 'string' &&
      parsed.nombreEmpleado.trim().length > 0
    ) {
      const tipoNormalizado = ALIAS_TIPO_DOCUMENTO[parsed.tipo] ?? parsed.tipo;
      if ((TIPOS_DOCUMENTO_VALIDOS as readonly string[]).includes(tipoNormalizado)) {
        payload = { ...parsed, tipo: tipoNormalizado } as TobiDocumentActionPayload;
      }
    }
  } catch {
    payload = null;
  }

  const cleanedText = text
    .replace(DOCUMENT_ACTION_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanedText, payload };
}

export function toNotaLaboralOptions(
  payload: TobiDocumentActionPayload,
  fallbackEmpresa = 'Corporación Empleadora',
): NotaLaboralOptions {
  const hoy = new Date();
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const lugarFechaDefecto = `Asunción, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  return {
    tipo: payload.tipo,
    empresa: payload.empresa?.trim() || fallbackEmpresa,
    lugarFecha: payload.lugarFecha?.trim() || lugarFechaDefecto,
    nombreEmpleado: payload.nombreEmpleado.trim(),
    ciEmpleado: payload.ciEmpleado?.trim() || '—',
    cargoEmpleado: payload.cargoEmpleado?.trim() || 'Colaborador',
    fechaIngreso: payload.fechaIngreso,
    fechaEgreso: payload.fechaEgreso,
    diasPreaviso: payload.diasPreaviso,
    causaJustificada: payload.causaJustificada,
    salarioMensual: payload.salarioMensual,
    hechosOcurridos: payload.hechosOcurridos,
    fundamentoLegal:
      payload.fundamentoLegal?.trim() ||
      (payload.tipo === 'suspension_disciplinaria'
        ? 'Arts. 353 inc. a), 352 inc. i) y 354 del Código del Trabajo (Ley Nº 213/93)'
        : undefined),
    diasSuspension:
      payload.diasSuspension !== undefined
        ? Math.min(Math.max(1, Math.round(payload.diasSuspension)), 8)
        : undefined,
    fechaInicioSuspension: payload.fechaInicioSuspension,
    fechaFinSuspension: payload.fechaFinSuspension,
    sucursalOrigen: payload.sucursalOrigen,
    sucursalDestino: payload.sucursalDestino,
    fechaEfectivaTraslado: payload.fechaEfectivaTraslado,
    compensacionTraslado: payload.compensacionTraslado,
  };
}
