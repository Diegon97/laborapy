/**
 * PARSER DE OPCIONES INTERACTIVAS DE CONTINUACIÓN DE TOBI — LABORAPY
 *
 * Extrae el bloque estructurado `:::opciones_continuar [...] :::` emitido por
 * Tobi al final de sus respuestas de profundización. Si el bloque no está presente
 * o resulta inválido, genera 4 opciones inteligentes de respaldo considerando:
 *  - 3 opciones de profundización (contexto, causal/fáctica y tipo de salida/liquidación/nota).
 *  - 1 opción libre/alternativa ("Consultar otro tema laboral" o "Hablar con un asesor por WhatsApp").
 */

export const OPTIONS_ACTION_REGEX = /:::opciones_continuar\s*([\s\S]*?)\s*:::/;

/** Límite de longitud recomendado por opción de continuación (anti-abrumación). */
export const MAX_OPTION_LENGTH = 80;

export interface ExtractedContinuationOptions {
  readonly cleanedText: string;
  readonly options: string[] | null;
}

/**
 * Normaliza texto eliminando acentos diacríticos y pasando a minúsculas para
 * facilitar matching tolerante de palabras clave laborales.
 */
function normalizeForSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Genera 4 opciones de continuación inteligentes de respaldo en primera persona
 * analizando la temática predominante en el texto de la respuesta.
 */
export function generateFallbackOptions(text: string): string[] {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [
      'Quiero calcular una liquidación laboral exacta',
      'Tengo dudas sobre mi antigüedad y salario promedio',
      'Verificar requisitos legales según el Código del Trabajo',
      'Hablar con un asesor por WhatsApp (+595 984 469 005)',
    ];
  }

  const norm = normalizeForSearch(text);

  // 1. Faltas gravísimas, agresión física, peleas y violencia en el lugar de trabajo
  if (
    norm.includes('pelea') ||
    norm.includes('golpe') ||
    norm.includes('agresion') ||
    norm.includes('violencia')
  ) {
    return [
      'El despido fue verbal en el momento, ¿cómo lo formalizo?',
      '📝 Cargar datos en casillas y generar nota de despido',
      'Redactar telegrama de despido justificado por agresión física',
      '¿Qué pruebas exige el MTESS para sostener el Art. 81?',
    ];
  }

  // 1 bis. Cálculo de liquidación / indemnizaciones / finiquito / despidos normales
  if (
    norm.includes('calcular') ||
    norm.includes('calculo') ||
    norm.includes('liquidacion') ||
    norm.includes('finiquito') ||
    norm.includes('cuanto me corresponde') ||
    norm.includes('despido') ||
    norm.includes('indemniz') ||
    norm.includes('preaviso') ||
    norm.includes('desvincul') ||
    norm.includes('echaron')
  ) {
    return [
      '📊 Cargar datos en casillas y calcular liquidación',
      '📄 Emitía facturas con RUC sin IPS (Art. 19 C.T.)',
      '💼 Estaba en planilla formal con seguro social IPS',
      '¿Qué me corresponde cobrar por despido injustificado?',
    ];
  }

  // 2. Renuncia voluntaria / retiro justificado / fin de contrato
  if (
    norm.includes('renuncia') ||
    norm.includes('dimision') ||
    norm.includes('retiro justificado') ||
    norm.includes('plazo fijo') ||
    norm.includes('salida voluntaria')
  ) {
    return [
      '📊 Cargar datos en casillas y calcular liquidación',
      '📄 Emitía factura con RUC sin IPS (Art. 19 C.T.)',
      'Llevo más de un año en la empresa y quiero saber el plazo de preaviso',
      'Hablar con un asesor por WhatsApp (+595 984 469 005)',
    ];
  }

  // 3. Sanciones disciplinarias / amonestaciones / suspensiones / traslados
  if (
    norm.includes('amonest') ||
    norm.includes('suspens') ||
    norm.includes('sancion') ||
    norm.includes('traslado') ||
    norm.includes('disciplin') ||
    norm.includes('falta') ||
    norm.includes('descargo')
  ) {
    return [
      '📝 Cargar datos en casillas y generar nota',
      'No tengo antecedentes ni amonestaciones previas en mi legajo',
      'Redactar nota de descargo o rechazo de sanción disciplinaria',
      'Consultar otro tema laboral paraguayo',
    ];
  }

  // 4. Maternidad / lactancia / fuero y estabilidad laboral
  if (
    norm.includes('matern') ||
    norm.includes('embaraz') ||
    norm.includes('lactanc') ||
    norm.includes('fuero') ||
    norm.includes('estabilidad') ||
    norm.includes('reposo')
  ) {
    return [
      'Notifiqué mi estado de gravidez con certificado médico y ecografía',
      'Pretenden despedirme o modificar mis condiciones de trabajo',
      'Conocer subsidios de IPS y descansos obligatorios de lactancia',
      'Hablar con un asesor por WhatsApp (+595 984 469 005)',
    ];
  }

  // 5. Aguinaldo / vacaciones / salarios / descuentos / IPS
  if (
    norm.includes('aguinaldo') ||
    norm.includes('vacacion') ||
    norm.includes('salario') ||
    norm.includes('descuento') ||
    norm.includes('ips') ||
    norm.includes('hora extra') ||
    norm.includes('recibo')
  ) {
    return [
      'Trabajé horas extraordinarias y feriados no incluidos en recibo',
      'La empresa adeuda el pago o realizó descuentos sin mi autorización',
      'Verificar el cálculo legal de aguinaldo y vacaciones causadas',
      'Consultar otro tema laboral paraguayo',
    ];
  }

  // 6. Certificado de trabajo / constancias laborales
  if (
    norm.includes('certificado') ||
    norm.includes('constancia') ||
    norm.includes('art. 93') ||
    norm.includes('reop')
  ) {
    return [
      'Necesito certificar mis fechas reales de inicio y egreso laboral',
      'El empleador se niega a expedir o incluyó calificaciones negativas',
      'Generar modelo formal de certificado de trabajo objetivo',
      'Consultar otro tema laboral paraguayo',
    ];
  }

  // 7. Respaldo general para consultas abiertas
  return [
    'Tengo dudas sobre mi antigüedad laboral y fecha de ingreso',
    'Quiero saber qué pruebas necesito presentar ante el MTESS',
    'Calcular mi liquidación estimada según el Código del Trabajo',
    'Hablar con un asesor por WhatsApp (+595 984 469 005)',
  ];
}

/**
 * Extrae el bloque `:::opciones_continuar [...] :::` del texto emitido por Tobi.
 * Si el bloque existe, lo remueve de `cleanedText` y devuelve el arreglo de opciones.
 * Si no está presente o el JSON interno es inválido, invoca `generateFallbackOptions`.
 */
export function extractContinuationOptions(text: string): ExtractedContinuationOptions {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text || '', options: null };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { cleanedText: '', options: null };
  }

  const match = OPTIONS_ACTION_REGEX.exec(text);
  if (match) {
    const rawJson = match[1].trim();
    let parsedOptions: string[] | null = null;

    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, MAX_OPTION_LENGTH));

        if (cleaned.length > 0) {
          parsedOptions = cleaned.slice(0, 4);
        }
      }
    } catch {
      parsedOptions = null;
    }

    const cleanedText = text
      .replace(OPTIONS_ACTION_REGEX, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const options = parsedOptions ?? generateFallbackOptions(cleanedText);

    return {
      cleanedText,
      options,
    };
  }

  return {
    cleanedText: text.trim(),
    options: generateFallbackOptions(text),
  };
}
