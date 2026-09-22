/**
 * BASE DE CONOCIMIENTO LABORAL PARAGUAYA — LABORAPY
 * Versión: PY-KNOW-2026.09.10
 *
 * Fuentes normativas:
 *  - Ley N° 213/93 "Código del Trabajo de la República del Paraguay"
 *  - Ley N° 5508/15 "De Promoción y Protección de la Maternidad y Lactancia Materna"
 *  - Decreto-Ley N° 1860/50 y Ley N° 98/92 (Régimen Legal del IPS)
 *  - Decreto N° 6225/2026 y Res. MTESS N° 670/2026 (Salario Mínimo Vigente)
 */

import type {
  KnowledgeEntry,
  KnowledgeSearchResult,
  KnowledgeTopic,
} from './types.js';

const STOPWORDS: ReadonlySet<string> = new Set<string>([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'en', 'a', 'al', 'por', 'para', 'con', 'sin',
  'que', 'es', 'son', 'se', 'su', 'sus', 'lo', 'le', 'les', 'me',
  'mi', 'mis', 'tu', 'tus', 'te', 'como', 'mas', 'muy', 'no', 'si', 'sobre', 'entre',
  'cuando', 'donde', 'cual', 'cuales', 'este', 'esta', 'estos', 'estas',
  'ni', 'hace', 'hacen', 'anos', 'meses', 'dias', 'tengo', 'puedo', 'quiere',
  'hola', 'buenas', 'tardes', 'noches', 'favor', 'ayuda',
]);

/**
 * Normaliza texto para búsquedas: quita diacríticos, mayúsculas, signos y espacios extra.
 */
export function normalizeSearchText(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeSearchText(text);
  if (normalized.length === 0) return [];
  return normalized
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export const TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  vacaciones: 'Vacaciones Anuales',
  'periodo-prueba': 'Período de Prueba',
  aguinaldo: 'Aguinaldo Legal',
  licencias: 'Licencias Especiales',
  'horas-extra': 'Horas Extraordinarias',
  descuentos: 'Descuentos y Retenciones',
  preaviso: 'Preaviso Legal',
  indemnizacion: 'Indemnización por Despido',
  'certificado-trabajo': 'Certificado de Trabajo',
  'seguridad-social': 'IPS y MTESS',
  jornada: 'Jornada Laboral',
  general: 'General',
};

/**
 * Catálogo legal de referencia paraguaya con citas precisas y explicaciones prácticas.
 */
export const KNOWLEDGE_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'primacia-realidad-factura',
    topic: 'seguridad-social',
    title: 'Contratos a Factura vs. Dependencia: Principio de Primacía de la Realidad (Art. 19 C.T.)',
    summary:
      'Hacer facturar a un empleado con horario, subordinación y exclusividad es fraude laboral. La factura es nula; rigen multas retroactivas de IPS y pago de beneficios.',
    content:
      'Conforme al Art. 19 del Código del Trabajo (Principio de Primacía de la Realidad), la naturaleza de la relación laboral se determina por los hechos reales y no por la denominación contractual ni la forma de pago. Si existe subordinación jurídica (cumplimiento de horario, órdenes directas, dependencia jerárquica) y prestación continuada de servicios, existe una relación laboral en relación de dependencia. Pretender encubrirla bajo locación de servicios o facturas comerciales constituye simulación y fraude a las leyes laborales y de seguridad social. En caso de reclamo o inspección: 1) La patronal debe inscribir de oficio y de forma retroactiva al trabajador en el IPS desde el primer día de servicio, abonando los aportes patronales (16.5%) y obreros (9%) omitidos, más intereses punitorios y multas del IPS; 2) El trabajador tiene derecho a percibir todos los beneficios laborales impagos: aguinaldo proporcional (Art. 243 C.T.), vacaciones remuneradas (Art. 218 C.T.), horas extras y, en caso de despido, preaviso e indemnización legal completa (Arts. 87 y 91 C.T.); 3) La emisión de facturas o IVA no exonera ni atenúa la responsabilidad patronal frente al MTESS ni al fuero judicial laboral.',
    keywords: [
      'factura',
      'facturar',
      'sin ips',
      'locacion de servicios',
      'prestador',
      'subordinacion',
      'horario',
      'primacia de la realidad',
      'art 19',
      'fraude laboral',
      'honorarios',
      'prestacion de servicios',
    ],
    legalBasis: [
      'Art. 19 Ley 213/93 (Código del Trabajo)',
      'Decreto-Ley N° 1860/50 y Ley 98/92 (Régimen Legal del IPS)',
      'Arts. 87, 91, 218 y 243 Ley 213/93',
    ],
  },
  {
    id: 'vacaciones-escala',
    topic: 'vacaciones',
    title: 'Vacaciones anuales remuneradas: 12, 18 o 30 días hábiles según antigüedad',
    summary:
      'Derecho irrenunciable: 12 días (<5 años), 18 días (5-10 años) y 30 días (>10 años). Días hábiles, incompensables en dinero durante vigencia del contrato.',
    content:
      'Conforme a los Arts. 218 al 221 del Código del Trabajo, todo trabajador con más de 1 año continuo tiene derecho a vacaciones pagadas: 12 días hábiles (hasta 5 años de servicio), 18 días hábiles (de 5 a 10 años) y 30 días hábiles (más de 10 años). Son días hábiles (no se computan domingos ni feriados). Se pagan por anticipado al inicio del descanso. Durante la relación laboral es nulo cualquier pacto de compensación monetaria; solo se abonan en dinero al producirse la desvinculación laboral (vacaciones causadas y proporcionales).',
    keywords: ['vacaciones', 'dias habiles', '12 dias', '18 dias', '30 dias', 'antiguedad', 'descanso anual'],
    legalBasis: ['Arts. 218-221 Ley 213/93 (Código del Trabajo)'],
  },
  {
    id: 'periodo-prueba',
    topic: 'periodo-prueba',
    title: 'Período de prueba legal: plazos y régimen de terminación',
    summary:
      'Obreros: hasta 30 días; calificados o empleados: hasta 60 días; técnicos de confianza: plazo convenido. Cualquiera de las partes puede rescindir sin preaviso ni indemnización.',
    content:
      'El Art. 58 del Código del Trabajo establece el período de prueba: 30 días para obreros y trabajadores domésticos, 60 días para empleados calificados o de oficina, y para especialistas o técnicos de confianza se puede pactar un término mayor según la naturaleza del cargo. Durante este lapso, cualquiera de las partes puede dar por terminado el contrato sin responsabilidad de preaviso ni indemnización, abonándose únicamente los días trabajados y la proporción de aguinaldo.',
    keywords: ['periodo de prueba', '30 dias', '60 dias', 'prueba', 'obreros', 'calificados', 'rescindir'],
    legalBasis: ['Arts. 58-60 Ley 213/93 (Código del Trabajo)'],
  },
  {
    id: 'aguinaldo-legal',
    topic: 'aguinaldo',
    title: 'Aguinaldo (Décimo Tercer Mes): inembargable y exento de aportes IPS',
    summary:
      'Equivale a la 1/12 parte de todas las remuneraciones devengadas en el año calendario. Es inembargable y 100% libre de retención obrera de IPS. Plazo máximo de pago: 31 de diciembre.',
    content:
      'Regulado por el Art. 243 del Código del Trabajo y concordantes. El aguinaldo es la doceava parte de todo lo devengado en dinero en el año (salario fijo, comisiones, horas extras, bonos, etc.). Su pago debe efectuarse antes del 31 de diciembre. Es totalmente inembargable (salvo pensión alimenticia fijada judicialmente) y por mandato del Decreto-Ley N° 1860/50 y Art. 245 C.T. está 100% EXENTO del aporte obrero del 9% de IPS. Retener IPS sobre el aguinaldo constituye una falta grave pasible de sanción patronal.',
    keywords: ['aguinaldo', 'decimo tercer mes', 'inembargable', 'sin ips', 'exento ips', '1/12', 'diciembre'],
    legalBasis: ['Art. 243 Ley 213/93', 'Decreto-Ley N° 1860/50 Art. 76'],
  },
  {
    id: 'licencia-maternidad',
    topic: 'licencias',
    title: 'Licencia por Maternidad y Lactancia (Ley N° 5508/15): 18 semanas remuneradas',
    summary:
      '18 semanas continuas de reposo remunerado al 100% a cargo del subsidio de IPS. Inamovilidad laboral absoluta durante gestación y hasta un año posterior al parto.',
    content:
      'La Ley N° 5508/15 y modificatorias otorgan a la madre trabajadora 18 semanas continuas e ininterrumpidas de permiso remunerado por maternidad. El subsidio lo liquida y abona directamente el IPS (100% del promedio salarial). Rige inamovilidad laboral absoluta desde la notificación del embarazo hasta transcurrido 1 año del nacimiento o cese de lactancia. Despedir a una trabajadora en estado de gestación o lactancia acarrea la nulidad del despido o multas severas e indemnizaciones agravadas (Art. 136 C.T.).',
    keywords: ['maternidad', 'embarazo', 'lactancia', '18 semanas', 'subsidio ips', 'inamovilidad', 'ley 5508'],
    legalBasis: ['Ley N° 5508/15', 'Ley N° 7140/23', 'Art. 136 Ley 213/93'],
  },
  {
    id: 'licencia-paternidad',
    topic: 'licencias',
    title: 'Licencia remunerada por paternidad: 2 semanas corridas (14 días)',
    summary:
      'Permiso obligatorio de 2 semanas corridas (14 días calendario) con goce íntegro de sueldo a cargo del empleador, a computar desde el parto.',
    content:
      'El Art. 13 de la Ley N° 5508/15 establece la licencia por paternidad obligatoria de 2 semanas corridas (14 días) con goce de sueldo a cargo del empleador. El trabajador debe presentar el certificado de nacido vivo expedido por el sanatorio u hospital. Dicho período no puede ser descontado de vacaciones ni sustituido por compensación dineraria.',
    keywords: ['paternidad', 'padre', 'nacimiento', '2 semanas', '14 dias', 'permiso pagado'],
    legalBasis: ['Art. 13 Ley N° 5508/15'],
  },
  {
    id: 'licencias-especiales',
    topic: 'licencias',
    title: 'Licencias especiales con goce de sueldo: matrimonio y duelo',
    summary:
      'Matrimonio: 3 días corridos. Duelo (fallecimiento de cónyuge, padres, hijos o hermanos): 3 días corridos remunerados.',
    content:
      'El Código del Trabajo en sus Arts. 62 y 132 garantiza licencias remuneradas especiales: por matrimonio del trabajador, 3 días hábiles o corridos según convenio; por duelo a causa del fallecimiento de cónyuge, concubino, padres, hijos o hermanos, 3 días corridos. El empleador debe liquidar estos días como efectivamente trabajados previa presentación de las actas correspondientes.',
    keywords: ['matrimonio', 'duelo', 'fallecimiento', '3 dias', 'licencia con goce', 'permiso'],
    legalBasis: ['Art. 132 Ley 213/93 (Código del Trabajo)'],
  },
  {
    id: 'horas-extraordinarias',
    topic: 'horas-extra',
    title: 'Horas extraordinarias: recargos del 50% y 100% y límite legal',
    summary:
      'Diurnas: 50% de recargo sobre hora ordinaria. Nocturnas, domingos y feriados: 100% de recargo. Límite máximo: 3 horas extras por día y 57 horas semanales totales.',
    content:
      'El Art. 231 del Código del Trabajo fija los recargos obligatorios: 50% para horas extras realizadas durante la jornada diurna (06:00 a 20:00) y 100% para horas extras nocturnas (20:00 a 06:00) o cumplidas en días domingos y feriados oficiales. Conforme al Art. 202 C.T., no se podrán realizar más de 3 horas extraordinarias diarias ni superar las 57 horas semanales en total, debiendo registrarse en la planilla de control de asistencia del MTESS.',
    keywords: ['horas extras', '50%', '100%', 'recargo', 'nocturno', 'feriado', 'domingo', 'limite 3 horas'],
    legalBasis: ['Arts. 202, 231 y 234 Ley 213/93'],
  },
  {
    id: 'descuentos-limites',
    topic: 'descuentos',
    title: 'Límites legales de retención salarial: 30% ordinario y hasta 50% por alimentos',
    summary:
      'Deducciones comunes (vales, préstamos, daños): tope legal del 30% del salario bruto. Pensiones alimenticias ordenadas por juzgado de la niñez: hasta el 50%.',
    content:
      'Los Arts. 242 y 245 del Código del Trabajo protegen la intangibilidad salarial. Las deducciones ordinarias autorizadas por el trabajador (anticipos de salarios, cuotas de préstamos o compras de mercaderías de la empresa, daños culposos) no pueden superar el 30% del salario mensual (Art. 242 C.T.). Por su parte, el salario es inembargable salvo para pensiones alimenticias fijadas judicialmente por Juzgados de la Niñez y Adolescencia, en cuyo caso el embargo o retención puede alcanzar hasta el 50% del salario (Art. 245 C.T. y Ley N° 1680/01 Código de la Niñez).',
    keywords: ['descuentos', 'retencion', 'limite 30%', '50% alimentos', 'embargo judicial', 'intangibilidad'],
    legalBasis: ['Arts. 242 y 245 Ley 213/93', 'Ley N° 1680/01 Código de la Niñez'],
  },
  {
    id: 'preaviso-escala',
    topic: 'preaviso',
    title: 'Preaviso obligatorio según antigüedad y licencia de búsqueda laboral (Art. 89 C.T.)',
    summary:
      '<1 año: 30 días; >1 a 5 años: 45 días; >5 a 10 años: 60 días; >10 años: 90 días. Durante el preaviso rigen 2 horas diarias (o 1 día semanal, a opción del trabajador) de búsqueda laboral.',
    content:
      'Según el Art. 87 del Código del Trabajo, el preaviso es obligatorio en caso de rescisión unilateral sin justa causa: a) Cumplido el período de prueba y hasta 1 año de servicio: 30 días; b) Más de 1 año y hasta 5 años: 45 días; c) Más de 5 y hasta 10 años: 60 días; d) Más de 10 años: 90 días. Conforme al Art. 89 C.T., durante el preaviso el trabajador notificado de despido goza de una licencia diaria remunerada de 2 horas dentro de la jornada legal o de 1 día a la semana, a su arbitrio, para buscar nuevo trabajo, pudiendo usufructuarla en forma continuada. Si el empleador no otorga el preaviso en tiempo, debe abonar el importe sustitutivo íntegro (Art. 90 C.T.).',
    keywords: ['preaviso', '30 dias', '60 dias', '90 dias', 'hora libre', 'indemnizacion sustitutiva'],
    legalBasis: ['Arts. 87-90 Ley 213/93'],
  },
  {
    id: 'indemnizacion-despido',
    topic: 'indemnizacion',
    title: 'Indemnización por despido injustificado (Art. 91 C.T.): 15 jornales por año',
    summary:
      '15 salarios diarios por cada año de servicio o fracción mayor a 6 meses. Es acumulable a la indemnización sustitutiva de preaviso.',
    content:
      'El Art. 91 del Código del Trabajo dispone que en despido sin justa causa, el empleador abonará una indemnización equivalente a 15 días de salario por cada año de servicio o fracción superior a 6 meses. El salario base de cálculo se determina promediando los ingresos de los últimos 6 meses (o período menor). No procede en renuncia voluntaria ni en despido con causa justificada debidamente comprobada (Art. 81).',
    keywords: ['indemnizacion', 'despido injustificado', '15 dias', '15 jornales', 'antiguedad', 'promedio 6 meses'],
    legalBasis: ['Arts. 91-93 Ley 213/93'],
  },
  {
    id: 'certificado-trabajo',
    topic: 'certificado-trabajo',
    title: 'Certificado de Trabajo obligatorio al cese (Art. 93 C.T.)',
    summary:
      'Entrega gratuita y obligatoria al término del contrato. Debe indicar fecha de iniciación y conclusión de las labores, clase de trabajo y salarios devengados del último período de pago.',
    content:
      'El Art. 93 del Código del Trabajo obliga al empleador a entregar gratuitamente al trabajador, a la terminación del contrato cualquiera sea su causa, una constancia firmada que exprese únicamente: a) La fecha de iniciación y conclusión de las labores; b) La clase de trabajo desempeñado; y c) Los salarios devengados durante el último período de pago. Si el trabajador lo solicitase, la constancia deberá expresar además su eficacia y comportamiento y la causa o causas de la terminación del contrato.',
    keywords: ['certificado de trabajo', 'art 93', 'constancia laboral', 'cese', 'obligatorio'],
    legalBasis: ['Art. 93 Ley 213/93 (Código del Trabajo)'],
  },
  {
    id: 'ips-rei-y-mtess',
    topic: 'seguridad-social',
    title: 'Trámites obligatorios al egreso: IPS REI (3 días hábiles) y MTESS REOP (30 días corridos)',
    summary:
      'Comunicación de baja en IPS REI dentro de los 3 días hábiles posteriores al egreso. Comunicación de planilla de salida en MTESS REOP dentro de los 30 días corridos.',
    content:
      'Al terminar un vínculo laboral, la patronal tiene 2 obligaciones ineludibles con plazos perentorios: 1) Comunicar la baja en el sistema IPS REI en un plazo máximo de 3 días hábiles; de no hacerlo, el IPS sigue facturando aportes obrero-patronales y aplica multas por omisión. 2) Registrar la salida en el sistema REOP del MTESS dentro de los 30 días corridos adjuntando la liquidación final firmada y el comprobante de pago.',
    keywords: ['ips rei', '3 dias habiles', 'mtess reop', '30 dias corridos', 'baja ips', 'multas patronales'],
    legalBasis: ['Reglamento General IPS REI', 'Resolución MTESS N° 820/2019'],
  },
  {
    id: 'estabilidad-diez-anos',
    topic: 'indemnizacion',
    title: 'Estabilidad Especial Laboral de 10 Años (Art. 94 C.T.) y Juicio Previo Obligatorio',
    summary:
      'Al cumplir 10 años, el trabajador adquiere estabilidad especial propia. Despido directo nulo; se exige juicio previo de justificación de causales ante el juez laboral.',
    content:
      'Conforme al Art. 94 del Código del Trabajo, el trabajador que cumple 10 años continuos de servicio con el mismo empleador adquiere estabilidad especial. A partir de ese momento, la patronal no puede despedirlo unilateralmente ni aun ofreciendo indemnización doble. Para desvincular con causa legal justificada (Art. 81 C.T.), la empresa debe suspender preventivamente al trabajador y promover obligatoriamente un Juicio de Justificación de Causales de Despido ante el Juzgado de Primera Instancia en lo Laboral. Si el juez no aprueba la causal o la empresa lo despide de hecho sin juicio previo, el despido es jurídicamente nulo y procede la reincorporación obligatoria del trabajador a su mismo cargo con salarios caídos devengados durante el proceso judicial.',
    keywords: [
      'estabilidad especial',
      '10 anos',
      '10 años',
      'diez anos',
      'art 94',
      'juicio previo',
      'justificacion de causales',
      'reincorporacion',
      'estabilidad laboral',
    ],
    legalBasis: ['Art. 94 al 99 Ley 213/93 (Código del Trabajo)'],
  },
  {
    id: 'aguinaldo-exencion-ips',
    topic: 'aguinaldo',
    title: 'Exención de Aportes de IPS en el Aguinaldo (Art. 76 Dec-Ley 1860/50)',
    summary:
      'El aguinaldo legal anual está 100% exento de descuentos de IPS (ni el 9% obrero ni el 16.5% patronal). Inembargable por ley.',
    content:
      'De acuerdo con el Art. 76 del Decreto-Ley N° 1860/50 y el Art. 243 del Código del Trabajo, la remuneración anual complementaria (aguinaldo) no sufre ningún tipo de retención ni descuento de seguridad social. En Paraguay, es terminantemente ilegal descontar el 9% del aporte obrero del IPS del aguinaldo, así como la patronal tampoco debe tributar el 16.5% sobre dicho concepto. El aguinaldo es inembargable (salvo pensiones alimenticias judicialmente fijadas) y debe ser abonado de forma íntegra a más tardar el 31 de diciembre.',
    keywords: [
      'aguinaldo ips',
      'descuento ips aguinaldo',
      '9% aguinaldo',
      'exento ips',
      'inembargable aguinaldo',
      'art 76',
    ],
    legalBasis: [
      'Art. 76 Decreto-Ley N° 1860/50',
      'Art. 243 y 245 Ley 213/93 (Código del Trabajo)',
    ],
  },
];

/**
 * Busca artículos dentro de la base de conocimiento utilizando coincidencia de tokens y scoring.
 */
export function searchKnowledgeBase(
  query: string,
  limit = 6,
  topicFilter?: KnowledgeTopic,
): KnowledgeSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const normalizedQuery = normalizeSearchText(query);
  const results: KnowledgeSearchResult[] = [];

  for (const entry of KNOWLEDGE_ENTRIES) {
    if (topicFilter && entry.topic !== topicFilter) continue;

    const normalizedTitle = normalizeSearchText(entry.title);
    const normalizedKeywords = entry.keywords.map(normalizeSearchText);
    const titleWords = new Set(tokenize(entry.title));
    const summaryWords = new Set(tokenize(entry.summary));

    let score = 0;
    const matched = new Set<string>();

    // 1. Coincidencia por frase o palabra clave compuesta (máximo peso)
    for (const kw of normalizedKeywords) {
      if (normalizedQuery.includes(kw)) {
        score += 25;
        matched.add(kw);
      }
    }

    // 2. Coincidencia por tokens exactos
    for (const token of tokens) {
      if (normalizedKeywords.includes(token)) {
        score += 15;
        matched.add(token);
      }
      if (titleWords.has(token)) {
        score += 10;
        matched.add(token);
      }
      if (summaryWords.has(token)) {
        score += 5;
        matched.add(token);
      }
    }

    if (score > 0) {
      if (normalizedQuery.includes(normalizedTitle)) {
        score += 20;
      }
      results.push({
        entry,
        score,
        matchedTerms: Array.from(matched),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(1, limit));
}

/**
 * Obtiene una entrada por su identificador único.
 */
export function getKnowledgeEntryById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE_ENTRIES.find((entry) => entry.id === id);
}

/**
 * Lista los tópicos disponibles con el conteo de artículos cargados.
 */
export function getSuggestedTopics(): { topic: KnowledgeTopic; label: string; count: number }[] {
  const counts = new Map<KnowledgeTopic, number>();
  for (const entry of KNOWLEDGE_ENTRIES) {
    counts.set(entry.topic, (counts.get(entry.topic) ?? 0) + 1);
  }

  const out: { topic: KnowledgeTopic; label: string; count: number }[] = [];
  for (const [topic, count] of counts.entries()) {
    out.push({
      topic,
      label: TOPIC_LABELS[topic] ?? topic,
      count,
    });
  }

  return out.sort((a, b) => b.count - a.count);
}
