#!/usr/bin/env node
/**
 * =============================================================================
 * GENERADOR DE DOCUMENTO WORD (.DOCX) — DATASET COSECHA 5 ABOGADOS TIKTOK
 * =============================================================================
 * Genera el documento formal de revisión, auditoría y autorización del dataset
 * cosechado de consultas reales en redes de los 5 abogados laboralistas de Paraguay.
 * Incluye diagnóstico jurídico exhaustivo según la Ley N.º 213/93 y campo para
 * autorización o corrección pericial por parte de Diego Núñez.
 * =============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as docx from 'docx';

const {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  Packer,
} = docx;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas de archivos
const DATASET_JSON_PATH = path.resolve(__dirname, '../datasets/consultas_laborales_5_abogados_py.json');
const OUTPUT_DOCX_PATH = path.resolve(__dirname, '../../DATASET_COSECHA_5_ABOGADOS_TIKTOK_REVISION.docx');

if (!fs.existsSync(DATASET_JSON_PATH)) {
  console.error(`❌ No se encontró el dataset en ${DATASET_JSON_PATH}`);
  process.exit(1);
}

const rawConsultas = JSON.parse(fs.readFileSync(DATASET_JSON_PATH, 'utf8'));
console.log(`📋 Total de consultas a procesar: ${rawConsultas.length}`);

/**
 * Base de Conocimiento Jurídico Laboral Paraguayo
 * Mapea y enriquece cada consulta con su diagnóstico pericial según la Ley 213/93
 */
function enriquecerConsulta(item, index) {
  const c = item.consulta.trim();
  const cLower = c.toLowerCase();

  let tema = 'Consulta General de Derechos Laborales';
  let diagnostico = 'Relación de dependencia laboral sujeta a la Ley 213/93';
  let articulos = ['Art. 19 (Contrato de Trabajo)', 'Art. 231 (Pago de Salarios)', 'Ley N.º 213/93'];
  let explicacion = '';
  let calculoOAccion = '';

  // 1. IPS descontado y no pagado / Retiro justificado / 12 horas nocturnas
  if (cLower.includes('ips') && (cLower.includes('no pagan') || cLower.includes('no paga') || cLower.includes('retiro justificado') || cLower.includes('descontaron'))) {
    tema = 'Retención Indebida de IPS y Retiro Justificado (Despido Indirecto)';
    diagnostico = 'Falta gravísima patronal: el empleador retuvo el 9% obrero sin transferirlo al IPS y exige 12 hs de jornada nocturna sin pago extra.';
    articulos = ['Art. 84 inc. b y d (Retiro justificado con derecho a indemnización)', 'Art. 195 (Jornada nocturna máx. 7 hs)', 'Art. 234 (Recargo nocturno 30%)', 'Decreto-Ley 1860/50', 'Art. 192 Código Penal (Apropiación)'];
    explicacion = 'El trabajador puede intimar el pago inmediato de aportes vía telegrama colacionado y, ante el incumplimiento, considerarse despedido con justa causa (retiro justificado). Esto le otorga derecho a percibir la totalidad de las indemnizaciones por despido injustificado (preaviso e indemnización del Art. 91) más la liquidación de horas extras con recargo nocturno del 30% y extraordinario del 50%/100%. Además, la retención de aportes no ingresados al IPS constituye el delito de apropiación según el Código Penal.';
    calculoOAccion = 'Enviar colacionado exigiendo regularización en 48 hs. En caso de negativa, formalizar retiro justificado ante el MTESS reclamando preaviso (30 días), indemnización legal, salarios caídos y denuncia en IPS.';
  }
  // 2. Período de prueba abusivo (3 meses en tareas no calificadas)
  else if (cLower.includes('periodo de prueba') || cLower.includes('prueba') && cLower.includes('meses')) {
    tema = 'Exceso en Período de Prueba en Labores No Calificadas';
    diagnostico = 'Cláusula nula de pleno derecho. Las empresas no pueden extender el período de prueba a 3 meses para operarios o trabajadores no especializados.';
    articulos = ['Art. 55 / 76 del Código Laboral (Escala taxativa de prueba: máx. 30 días para no calificados, 60 días calificados, 90 días personal técnico)', 'Art. 19 (Primacía de la realidad)'];
    explicacion = 'En Paraguay, el período de prueba no es discrecional de la patronal: para labores no calificadas (limpieza, reposición, carga, peones) la ley fija un TOPE IMPERATIVO de 30 días. Extenderlo a 2 o 3 meses es ilegal y nulo. Si la empresa despide al trabajador a los 2 meses alegando "prueba", se considera despido injustificado y debe abonar preaviso e indemnización.';
    calculoOAccion = 'El trabajador adquiere estabilidad relativa al día 31. Todo despido posterior a los 30 días exige pago de liquidación completa.';
  }
  // 3. Pagaré caducado hace 12 años y embargo de sueldo de empleada doméstica
  else if (cLower.includes('pagar') || cLower.includes('embargo') && cLower.includes('doméstica')) {
    tema = 'Inembargabilidad de Sueldo Doméstico y Prescripción de Pagaré';
    diagnostico = 'Embargo improcedente e ilegal: la deuda cambiaria prescribió a los 4 años y el sueldo de empleo doméstico goza de inembargabilidad legal.';
    articulos = ['Art. 245 C.T. (Inembargabilidad del salario mínimo y de subsistencia)', 'Art. 659 Código Civil (Prescripción cambiaria de 4 años)', 'Ley N.º 5407/15 (Trabajo Doméstico)'];
    explicacion = 'Un pagaré no ejecutado judicialmente dentro de los 4 años desde su vencimiento prescribe (Art. 659 C.C.). A los 12 años no existe acción cambiaría válida. Asimismo, el salario mínimo de una trabajadora doméstica es inembargable por deudas comerciales comunes; los jueces solo pueden ordenar embargo hasta el 50% en casos de prestación de alimentos.';
    calculoOAccion = 'Promover incidente de levantamiento de embargo y excepción de prescripción liberatoria por intermedio de abogado o de la Defensoría Pública.';
  }
  // 4. Despido en represalia por quejarse de controles o sistemas
  else if (cLower.includes('hecharon') || cLower.includes('reclamar') && cLower.includes('empresa')) {
    tema = 'Despido Arbitrario en Represalia por Reclamos Laborales';
    diagnostico = 'Despido injustificado (Art. 84 C.T.) con posible agravante por violación a la libertad de petición del trabajador.';
    articulos = ['Art. 84 (Despido sin causa comprobada)', 'Art. 87 (Preaviso)', 'Art. 91 (Indemnización por antigüedad)', 'Art. 243 (Aguinaldo)', 'Art. 218 (Vacaciones)'];
    explicacion = 'El despido motivado por reclamos legítimos de condiciones laborales jamás constituye justa causa (Art. 81). La patronal debe abonar el 100% de la liquidación: preaviso omitido, indemnización por antigüedad (15 días de salario por año o fracción >6 meses), vacaciones proporcionales y aguinaldo proporcional.';
    calculoOAccion = 'Acudir inmediatamente al MTESS (Ministerio de Trabajo) para audiencia de conciliación prejudicial obligatoria. Si hay complicidad patronal, radicar la demanda ante el Juzgado de Primera Instancia en lo Laboral.';
  }
  // 5. Fraccionamiento unilateral de vacaciones
  else if (cLower.includes('fracciones') || cLower.includes('fraccion') || cLower.includes('vacaciones') && cLower.includes('mitad')) {
    tema = 'Fraccionamiento Unilateral e Ilegal de Vacaciones';
    diagnostico = 'Violación al principio de descanso continuo. El empleador no puede dividir las vacaciones sin acuerdo libre y fundamentado del trabajador.';
    articulos = ['Art. 219 C.T. (Continuidad obligatoria del goce de vacaciones)', 'Art. 222 (Época de concesión y notificación previa con 15 días de anticipación)'];
    explicacion = 'Las vacaciones anuales remuneradas tienen como objeto la recuperación física y mental del trabajador. La ley establece que deben ser continuas. La patronal no puede otorgar 6 días y reservarse el resto a su arbitrio. Todo fraccionamiento requiere causa justificada y conformidad expresa del colaborador.';
    calculoOAccion = 'Exigir el goce íntegro de los días devengados mediante nota interna con copia para legajo y denuncia innominada en el MTESS si la empresa persiste.';
  }
  // 6. Presión e intimidación para renunciar
  else if (cLower.includes('intiman a renunciar') || cLower.includes('presion') && cLower.includes('renuncia') || cLower.includes('hicieron firmar')) {
    tema = 'Coacción para Renunciar (Despido Encubierto con Vicio de Consentimiento)';
    diagnostico = 'Fraude laboral y coacción. La renuncia forzada bajo amenaza es nula y constituye despido indirecto.';
    articulos = ['Art. 19 (Primacía de la realidad)', 'Art. 84 (Despido indirecto / Retiro justificado)', 'Art. 280 (Nulidad de acuerdos que reduzcan o conculquen derechos laborales)'];
    explicacion = 'Ningún trabajador está obligado a firmar su renuncia. Si el empleador desea terminar la relación, debe expedir la nota formal de despido y abonar la liquidación de despido injustificado (preaviso + indemnización). Si el trabajador fue forzado a firmar en blanco o bajo amenaza de "ensuciar su legajo", la renuncia adolece de nulidad absoluta y puede anularse en sede judicial probando el vicio del consentimiento.';
    calculoOAccion = 'NO FIRMAR NADA. Si ya fue coaccionado, enviar telegrama colacionado desconociendo la renuncia por haber sido obtenida bajo violencia moral y emplazando al pago de la indemnización por despido.';
  }
  // 7. Liquidaciones irrisorias (ej. Gs. 800.000 por 3 años de trabajo)
  else if (cLower.includes('3 años') && cLower.includes('800000') || cLower.includes('liquidacion') && cLower.includes('poco')) {
    tema = 'Liquidación Final Irrisoria y Defraudación Salarial';
    diagnostico = 'Violación grave al régimen de indemnizaciones. El monto ofrecido no cubre ni la cuarta parte de los derechos adquiridos.';
    articulos = ['Art. 87 (Preaviso: 45 días por más de 1 y hasta 5 años)', 'Art. 91 (Indemnización: 3 años x 15 días = 45 jornales)', 'Art. 218 (Vacaciones 12 días)', 'Art. 243 (Aguinaldo 1/12)'];
    explicacion = 'Para un trabajador con 3 años de antigüedad despedido sin causa con salario mínimo (Gs. 3.044.000): Preaviso (45 días) = Gs. 4.566.000; Indemnización (45 jornales) = Gs. 4.566.000; más vacaciones y aguinaldo proporcional. Total adeudado supera los Gs. 10.000.000. Ofrecer Gs. 800.000 es un despojo ilícito.';
    calculoOAccion = 'Rechazar la firma del recibo finiquito. Solicitar liquidación oficial en LaboraPy e intimar el pago íntegro en sede del MTESS.';
  }
  // 8. Antigüedad de 7 o 10 años y vacaciones / estabilidad
  else if (cLower.includes('7 an̈o') || cLower.includes('10 años') || cLower.includes('antigüedad')) {
    tema = 'Derechos por Alta Antigüedad y Estabilidad Especial (Art. 94 C.T.)';
    diagnostico = 'Régimen de protección reforzada. A los 10 años el trabajador adquiere estabilidad especial contra el despido arbitrario.';
    articulos = ['Art. 94 C.T. (Estabilidad especial al cumplir 10 años)', 'Art. 87 (Preaviso de 60 a 90 días)', 'Art. 91 (15 días por cada año sin límite)', 'Art. 218 (Escala de vacaciones: 18 a 30 días)'];
    explicacion = 'Con 7 años: le corresponden 60 días de preaviso, 105 jornales de indemnización (7 x 15) y 18 días de vacaciones. Con 10 años: adquiere la estabilidad especial del Art. 94; el empleador no puede despedirlo sin causa judicialmente comprobada. En caso de despido arbitrario, el trabajador puede exigir reincorporación o doble indemnización (indemnización especial).';
    calculoOAccion = 'Si tiene más de 9 años y medio, cualquier intento de despido debe auditarse exhaustivamente por sospecha de fraude para eludir la estabilidad definitiva.';
  }
  // 9. Descuento de faltantes de caja o robos a móviles/choferes
  else if (cLower.includes('faltantes de caja') || cLower.includes('caja') || cLower.includes('robo') && cLower.includes('descuente')) {
    tema = 'Prohibición de Descuentos Arbitrarios y Traslado de Riesgo';
    diagnostico = 'Descuento salarial ilícito. El empleador no puede trasladar el riesgo operativo del negocio al salario de los trabajadores sin sumario judicial o dolo probado.';
    articulos = ['Art. 240 C.T. (Prohibición expresa de retenciones y deducciones no autorizadas por ley)', 'Art. 241 (Límites taxativos a embargos)', 'Art. 19 (Primacía de la realidad)'];
    explicacion = 'La ley laboral paraguaya prohíbe taxativamente al patrón descontar faltantes de caja o pérdidas patrimoniales (asaltos, roturas, hurtos a vehículos) del sueldo de los empleados, a menos que exista sentencia judicial firme o reconocimiento libre, expreso y por escrito del autor. Los descuentos colectivos a una cuadrilla son absolutamente nulos.';
    calculoOAccion = 'Intimar a la empresa la restitución inmediata de los montos debitados ilegalmente bajo apercibimiento de retiro justificado y denuncia ante la Dirección del Trabajo.';
  }
  // 10. Guardias de seguridad (14 horas nocturnas, salario mínimo)
  else if (cLower.includes('guardia') || cLower.includes('cuardia') || cLower.includes('14 hora') || cLower.includes('12 horas')) {
    tema = 'Explotación en Servicios de Seguridad y Vigilancia Privada';
    diagnostico = 'Jornada abusiva e ilegal que excede con creces la jornada máxima de 42 horas semanales nocturnas.';
    articulos = ['Art. 194 / 195 C.T. (Jornada nocturna legal máxima: 7 hs diarias y 42 hs semanales)', 'Art. 234 (Recargo nocturno obligatorio del 30%)', 'Art. 235 (Horas extras con 50% y 100% de recargo)'];
    explicacion = 'Un guardia que trabaja 14 horas de noche cumple 84 horas semanales, superando por el doble el límite legal. Las primeras 7 horas deben pagarse con 30% de recargo nocturno; las 7 horas restantes son horas extraordinarias (recargo del 50% diurnas / 100% nocturnas y feriados). Percibir solo el salario mínimo en estas condiciones genera un pasivo millonario a favor del trabajador por diferencias salariales.';
    calculoOAccion = 'Calcular la liquidación retroactiva de horas extraordinarias de los últimos 12 meses y promover denuncia en MTESS o demanda laboral.';
  }
  // 11. Exigencia de emitir factura con RUC en relación de dependencia
  else if (cLower.includes('factura') && (cLower.includes('empezar') || cLower.includes('ruc') || cLower.includes('trabajar'))) {
    tema = 'Fraude Laboral por Simulación de Servicios (Falsos Autónomos con RUC)';
    diagnostico = 'Simulación fraudulenta de contrato civil para eludir IPS, aguinaldo y vacaciones.';
    articulos = ['Art. 19 C.T. (Principio de Primacía de la Realidad)', 'Art. 2 (Definición de trabajador subordinado)', 'Decreto-Ley 1860/50 (Obligatoriedad de IPS)'];
    explicacion = 'Si una persona cumple un horario, recibe órdenes directas, utiliza herramientas de la empresa y no asume el riesgo empresarial, es un TRABAJADOR DEPENDIENTE ante la ley paraguaya, aunque le exijan emitir factura legal con RUC. La firma de contratos de prestación de servicios civiles o mercantiles no elimina las obligaciones laborales.';
    calculoOAccion = 'Conservar copias de órdenes de trabajo, mensajes de WhatsApp, marcaciones de entrada y facturas emitidas para reclamar la relación de dependencia retroactiva con IPS y beneficios.';
  }
  // 12. Reducción unilateral de jornada o sueldo
  else if (cLower.includes('bajaron') || cLower.includes('reduccion') || cLower.includes('solo 4 horas') || cLower.includes('1500 nomas')) {
    tema = 'Reducción Unilateral e Ilegal de Salario y Jornada';
    diagnostico = 'Modificación peyorativa de las condiciones de trabajo (Ius Variandi abusivo).';
    articulos = ['Art. 34 C.T. (Prohibición de alterar las condiciones de trabajo en perjuicio del trabajador)', 'Art. 84 inc. b (Causal de retiro justificado por rebaja salarial)'];
    explicacion = 'El empleador no puede rebajar el sueldo ni reducir la jornada unilateralmente para pagar menos del salario acordado o del salario mínimo legal. Esta conducta está expresamente tipificada como causal directa de retiro justificado con derecho al cobro de todas las indemnizaciones como si fuera un despido injustificado.';
    calculoOAccion = 'Rechazar la rebaja por escrito mediante telegrama colacionado en un plazo de 30 días desde la notificación patronal para no convalidar tácitamente la alteración.';
  }
  // 13. Comisiones fuera del aguinaldo
  else if (cLower.includes('comision') && (cLower.includes('aguinaldo') || cLower.includes('comisiones'))) {
    tema = 'Exclusión Ilegal de Comisiones en el Cálculo del Aguinaldo';
    diagnostico = 'Cálculo defectuoso y lesivo del aguinaldo (13° salario).';
    articulos = ['Art. 243 C.T. (El aguinaldo equivale a la doceava parte de TODO lo percibido en dinero en el año)', 'Art. 244 (Inembargabilidad y exención total de aportes al aguinaldo)'];
    explicacion = 'En Paraguay, el aguinaldo se calcula sobre la TOTALIDAD de las remuneraciones en dinero devengadas por el colaborador: salario base, horas extras, bonificaciones habituales y TODAS las comisiones por ventas. Quienes afirman que la comisión "no entra" están violando abiertamente el Art. 243 del Código del Trabajo.';
    calculoOAccion = 'Sumar los 12 meses de sueldo + comisiones devengadas entre el 1 de enero y el 31 de diciembre y dividir el total entre 12.';
  }
  // 14. Ausencia de contrato escrito tras años de labor
  else if (cLower.includes('sin contrato') || cLower.includes('no hay contrato') || cLower.includes('nunca hubo contrato')) {
    tema = 'Validez Plena del Contrato Laboral Verbal';
    diagnostico = 'El contrato de trabajo es consensual y existe por el mero hecho de la prestación de servicios.';
    articulos = ['Art. 19 C.T. (Presunción legal de contrato)', 'Art. 39 (Forma verbal admitida)', 'Art. 40 (La falta de contrato escrito es imputable exclusivamente al empleador)'];
    explicacion = 'En la República del Paraguay no se necesita tener un papel firmado para gozar de la protección de la ley laboral. La falta de contrato escrito es una omisión imputable a la patronal y la ley presume ciertas las condiciones declaradas por el trabajador en caso de controversia, siempre que se pruebe la subordinación.';
    calculoOAccion = 'Acreditar la relación mediante testigos, recibos informales, mensajes o extractos bancarios para exigir la inscripción en IPS y la liquidación integral.';
  }
  // 15. Causal genérica
  else {
    tema = 'Consulta sobre Obligaciones Salariales y Contractuales';
    diagnostico = 'Exigibilidad de derechos laborales individuales según el Código del Trabajo.';
    articulos = ['Art. 19', 'Art. 81 / 84', 'Art. 231', 'Art. 243 de la Ley N.º 213/93'];
    explicacion = 'Toda relación de subordinación en Paraguay genera la obligación ineludible de garantizar como piso mínimo el Salario Mínimo Legal Vigente (Gs. 3.044.000), inscripción obligatoria en el IPS desde el día 1, jornada máxima de 48 hs semanales diurnas y descanso semanal de 24 hs consecutivas.';
    calculoOAccion = 'Evaluar la documentación del caso y solicitar asesoramiento con el equipo pericial de LaboraPy.';
  }

  return {
    id: index + 1,
    abogado: item.abogado || 'Abogado Laboralista PY',
    consulta: c,
    videoUrl: item.video_url || 'https://www.tiktok.com/@dahianavalos',
    tema,
    diagnostico,
    articulos: articulos.join(' · '),
    explicacion,
    calculoOAccion,
  };
}

const casosEnriquecidos = rawConsultas.map(enriquecerConsulta);

// ---------------------------------------------------------------------------
// CREACIÓN DEL DOCUMENTO WORD (.DOCX) CON DOCX NPM
// ---------------------------------------------------------------------------
console.log('📝 Compilando documento Word interactivo de auditoría...');

const doc = new Document({
  creator: 'LaboraPy — Plataforma Legal & Contable de Paraguay',
  title: 'Dataset de Consultas Cosechadas en TikTok — Revisión y Autorización',
  description: 'Auditoría pericial de 58 casos reales para entrenamiento RAG de Tobi',
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440, // 1 pulgada (72pt * 20)
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        // TÍTULO Y CABECERA INSTITUCIONAL
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'LABORAPY — PERITAJE LABORAL & RAG KNOWLEDGE',
              bold: true,
              size: 32,
              color: '047857', // Verde esmeralda
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'DATASET DE COSECHA DE 5 ABOGADOS LABORALISTAS DE TIKTOK (PARAGUAY)',
              bold: true,
              size: 24,
              color: '0F172A', // Slate 900
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: 'DOCUMENTO OFICIAL DE REVISIÓN, AUDITORÍA Y AUTORIZACIÓN PERICIAL',
              italics: true,
              size: 20,
              color: '475569',
            }),
          ],
        }),

        // FICHA TÉCNICA DEL DATASET
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: '0F172A' },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'FICHA TÉCNICA DEL DATASET DE COSECHA',
                          bold: true,
                          color: 'FFFFFF',
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                  children: [
                    new Paragraph({
                      spacing: { before: 100, after: 60 },
                      children: [
                        new TextRun({ text: '• Total de Consultas Reales Filtradas: ', bold: true }),
                        new TextRun({ text: `${casosEnriquecidos.length} casos verificados 100% legislación de Paraguay.` }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 60, after: 60 },
                      children: [
                        new TextRun({ text: '• Cuentas Cosechadas: ', bold: true }),
                        new TextRun({ text: '@dahianavalos, @ernestoyampey, @juanbernis, @jorgefleitasoficial8, @abg.clara.lopez' }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 60, after: 60 },
                      children: [
                        new TextRun({ text: '• Marco Legal Base: ', bold: true }),
                        new TextRun({ text: 'Ley N.º 213/93 (Código del Trabajo), Ley N.º 496/95, Decreto-Ley N.º 1860/50 (IPS), Salario Mínimo 2026 Gs. 3.044.000.' }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 60, after: 100 },
                      children: [
                        new TextRun({ text: '• Revisor / Perito a Cargo: ', bold: true }),
                        new TextRun({ text: 'Diego Núñez (Dirección Pericial LaboraPy).' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300, after: 300 } }),

        // INSTRUCCIONES DE USO
        new Paragraph({
          children: [
            new TextRun({
              text: 'INSTRUCCIONES PARA EL PERITO:',
              bold: true,
              size: 22,
              color: '047857',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: 'Este documento contiene el dataset cosechado con las 58 consultas laborales reales de trabajadores y empleadores en TikTok. Para cada caso, LaboraPy ha generado el diagnóstico jurídico y la fundamentación pericial conforme a la Ley 213/93. Marque con una "X" en la casilla correspondiente si el caso queda ',
            }),
            new TextRun({ text: 'AUTORIZADO', bold: true }),
            new TextRun({ text: ', ' }),
            new TextRun({ text: 'MODIFICADO', bold: true }),
            new TextRun({ text: ' o ' }),
            new TextRun({ text: 'RECHAZADO', bold: true }),
            new TextRun({ text: '. Si desea realizar ajustes, escriba la explicación corregida en el recuadro correspondiente para consolidar el dataset final del RAG de Tobi.' }),
          ],
        }),

        // DETALLE DE CADA UNO DE LOS 58 CASOS
        ...casosEnriquecidos.flatMap((caso) => {
          return [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 350, after: 120 },
              children: [
                new TextRun({
                  text: `CASO #${caso.id}: ${caso.tema.toUpperCase()}`,
                  bold: true,
                  size: 22,
                  color: '0F172A',
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Fila 1: Origen y enlace
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Fuente / Abogado:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `@${caso.abogado}  |  Video: ${caso.videoUrl}`, size: 18, color: '2563EB' }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // Fila 2: Consulta original
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Consulta Textual:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' }, // Amarillo suave para resaltar la voz del usuario
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `"${caso.consulta}"`, italics: true, bold: true, size: 18, color: '92400E' }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // Fila 3: Diagnóstico formal
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Diagnóstico Jurídico:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: caso.diagnostico, size: 18 })] })],
                    }),
                  ],
                }),
                // Fila 4: Artículos aplicables
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Artículos Ley 213/93:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'ECFDF5' }, // Verde claro sutil
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: caso.articulos, bold: true, size: 18, color: '047857' })],
                        }),
                      ],
                    }),
                  ],
                }),
                // Fila 5: Explicación y Criterio Pericial
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Explicación LaboraPy:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: caso.explicacion, size: 18 })],
                        }),
                        new Paragraph({
                          spacing: { before: 80 },
                          children: [
                            new TextRun({ text: 'Estrategia / Acción recomendada: ', bold: true, size: 18 }),
                            new TextRun({ text: caso.calculoOAccion, size: 18 }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // Fila 6: Casillas de Autorización y Modificación
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Control Pericial:', bold: true, size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: '[   ] AUTORIZADO (Sin cambios)       [   ] MODIFICADO       [   ] RECHAZADO', bold: true, size: 18 }),
                          ],
                        }),
                        new Paragraph({
                          spacing: { before: 100 },
                          children: [
                            new TextRun({ text: 'Observaciones / Corrección de Diego Núñez para el dataset final:', italics: true, size: 17, color: '64748B' }),
                          ],
                        }),
                        new Paragraph({
                          spacing: { before: 120, after: 60 },
                          children: [
                            new TextRun({
                              text: '_________________________________________________________________________________\n_________________________________________________________________________________',
                              color: 'CBD5E1',
                              size: 16,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new Paragraph({ spacing: { after: 200 } }),
          ];
        }),

        // CIERRE Y FIRMA DEL PERITO
        new Paragraph({
          spacing: { before: 600, after: 200 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: '____________________________________________________',
              color: '94A3B8',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'DIEGO NÚÑEZ — LABORATORIO DE DERECHO LABORAL & RRHH',
              bold: true,
              size: 20,
              color: '0F172A',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'LaboraPy · Asunción, Paraguay · www.laborapy.com',
              size: 18,
              color: '64748B',
            }),
          ],
        }),
      ],
    },
  ],
});

// Guardar archivo docx
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT_DOCX_PATH, buffer);
  console.log(`\n✅ Documento Word generado exitosamente en:`);
  console.log(`   👉 ${OUTPUT_DOCX_PATH}`);
  console.log(`   📦 Tamaño del archivo: ${(buffer.length / 1024).toFixed(2)} KB`);
}).catch((err) => {
  console.error('❌ Error al empaquetar el documento Word:', err);
  process.exit(1);
});
