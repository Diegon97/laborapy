import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

function createTobiDoc() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Paleta de colores corporativa
  const navy = [15, 23, 42];        // #0f172a
  const slate = [51, 65, 85];       // #334155
  const accent = [2, 132, 199];     // #0284c7 (Azul LaboraPy)
  const emerald = [16, 185, 129];   // #10b981
  const bgLight = [248, 250, 252];  // #f8fafc
  const lineBorder = [226, 232, 240];

  // Helper para encabezado
  function renderHeader(pageNum) {
    // Franja superior
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Detalle dorado/azul
    doc.setFillColor(...accent);
    doc.rect(0, 18, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('LABORAPY · DIRECCIÓN DE TECNOLOGÍA & RRHH', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(186, 230, 253);
    doc.text('AUDITORÍA TÉCNICA · ARQUITECTURA TOBI IA', pageWidth - margin, 11, { align: 'right' });
  }

  // Helper para pie de página
  function renderFooter(pageNum) {
    const y = pageHeight - 10;
    doc.setDrawColor(...lineBorder);
    doc.setLineWidth(0.4);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Documento Oficial Confidencial · Sistema de Inteligencia Laboral LaboraPy Paraguay', margin, y + 2);
    doc.text(`Página ${pageNum} de 2`, pageWidth - margin, y + 2, { align: 'right' });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: APRENDIZAJE E INGESTA + ALMACENAMIENTO EN SUPABASE
  // ═════════════════════════════════════════════════════════════════════════
  renderHeader(1);

  let y = 26;

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text('ARQUITECTURA DE APRENDIZAJE Y SEGURIDAD: TOBI IA', margin, y);
  y += 5;

  // Metadatos
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Fecha: Septiembre 2026  |  Clasificación: Técnico / Ejecutivo  |  Entorno: Supabase Cloud & Vercel Serverless', margin, y);
  y += 6;

  // Banner Informativo de Introducción
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...slate);
  const introTxt = 'Tobi es el copiloto pericial de LaboraPy especializado en la normativa laboral paraguaya. Su solvencia no proviene de respuestas alucinadas, sino de una arquitectura híbrida de RAG (Retrieval-Augmented Generation) sobre bases de datos vectoriales y jurisprudencia vinculante del Paraguay.';
  doc.text(doc.splitTextToSize(introTxt, contentWidth - 6), margin + 3, y + 4.5);
  y += 18;

  // ── SECCIÓN 1: ¿CÓMO APRENDIÓ TOBI LO QUE SABE DE LEYES? ──
  doc.setFillColor(...navy);
  doc.rect(margin, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text('1. PROCESO DE APRENDIZAJE E INGESTA JURÍDICA', margin + 5, y + 4.5);
  y += 8;

  // Cuadros de fuentes de aprendizaje
  const boxWidth = (contentWidth - 6) / 2;
  const boxHeight = 31;

  // Caja 1: Normativa Positiva Paraguaya
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...lineBorder);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accent);
  doc.text('A. Legislación Laboral de Fondo', margin + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate);
  const t1 = '• Código del Trabajo (Ley N.º 213/93 y modif. Ley 496/95).\n• Código Procesal Laboral (Ley N.º 742/61).\n• Ley N.º 5508/15 y Ley N.º 7140/23 (Maternidad y Lactancia).\n• Régimen Previsional IPS (Decreto-Ley N.º 1860/50).\n• Pautas y decretos de salarios mínimos vigentes.';
  doc.text(t1, margin + 3, y + 10);

  // Caja 2: Jurisprudencia Oficial CSJ
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...lineBorder);
  doc.roundedRect(margin + boxWidth + 6, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accent);
  doc.text('B. Fallos de la Corte Suprema (CSJ)', margin + boxWidth + 9, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate);
  const t2 = '• Acuerdos y Sentencias (A&S) de Salas Laboral y Constitucional.\n• Doctrina de inmediatez y causal taxativa de despido (Art. 81).\n• Presunción del contrato de trabajo y Primacía de la Realidad.\n• Ratio decidendi extraída y categorizada por materia jurídica.';
  doc.text(t2, margin + boxWidth + 9, y + 10);

  y += boxHeight + 4;

  // Caja 3: Doctrina Forense y Expertos
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...lineBorder);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accent);
  doc.text('C. Doctrina de Tratadistas Nacionales', margin + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate);
  const t3 = '• Obras de referencia de Jorge Bernis y Enrique Yampey.\n• Transcripciones de ponencias y audios forenses laborales.\n• Casos fácticos reales de reclamos ante MTESS e IPS.\n• Pautas de prevención de abusos procesales y nulidades.';
  doc.text(t3, margin + 3, y + 10);

  // Caja 4: Reglas Taxativas (Master Legal Spec)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...lineBorder);
  doc.roundedRect(margin + boxWidth + 6, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accent);
  doc.text('D. Pautas Algorítmicas Determinísticas', margin + boxWidth + 9, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate);
  const t4 = '• Especificación canónica Master Legal Specification.\n• Salario mínimo piso estricto: Gs. 3.044.000.\n• Fórmulas exactas: preaviso, indemnización, aguinaldo e IPS.\n• Reglas no negociables blindadas en tobiSystemPrompt.ts.';
  doc.text(t4, margin + boxWidth + 9, y + 10);

  y += boxHeight + 8;

  // ── SECCIÓN 2: ¿DÓNDE SE ALMACENA LA INFORMACIÓN? (SUPABASE POSTGRES) ──
  doc.setFillColor(...navy);
  doc.rect(margin, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text('2. INFRAESTRUCTURA DE ALMACENAMIENTO EN SUPABASE CLOUD', margin + 5, y + 4.5);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...slate);
  doc.text(
    'Toda la base de conocimiento está centralizada en una base de datos relacional y vectorial Supabase Postgres (AWS São Paulo, baja latencia a Asunción), estructurada en esquemas especializados:',
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 7;

  // Tabla con jsPDF AutoTable
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: slate,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 36 },
      2: { cellWidth: 'auto' },
    },
    head: [['Tabla en Supabase', 'Tipo de Motor / Índice', 'Contenido y Propósito en el Razonamiento']],
    body: [
      [
        'jurisprudencia_csj',
        'Postgres Relacional + FTS\n(Full-Text Search Español)',
        'Acuerdos y Sentencias de la CSJ: carátula, sala, año, número, resultado de acción, doctrina oficial y URL del fallo original.',
      ],
      [
        'jurisprudencia_multimedia',
        'pgvector (Vector 768 dims)\nÍndice HNSW / Cosine',
        'Criterios prácticos de laboralistas paraguayos, audios transcritos, casos fácticos y embeddings vectoriales de 768 dimensiones.',
      ],
      [
        'tobi_events',
        'Postgres Inmutable\nAppend-Only Audit Log',
        'Telemetría, tipo de consulta, tiempo de respuesta de inferencia y metadatos de ejecución forense sin almacenar datos privados.',
      ],
      [
        'hr_audit_records / chat',
        'Postgres Relacional\n(Row Level Security)',
        'Historial de auditorías documentales, cálculos verificados y consultas autorizadas vinculadas al cliente autenticado.',
      ],
    ],
  });

  renderFooter(1);

  // ═════════════════════════════════════════════════════════════════════════
  // PÁGINA 2: CONSULTAS A SUPABASE (RAG) + SEGURIDAD Y API KEYS
  // ═════════════════════════════════════════════════════════════════════════
  doc.addPage();
  renderHeader(2);

  y = 26;

  // ── SECCIÓN 3: CÓMO CONSULTA TOBI A SUPABASE (PIPELINE RAG) ──
  doc.setFillColor(...navy);
  doc.rect(margin, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text('3. PIPELINE DE CONSULTA: RAG HÍBRIDO EN TIEMPO REAL', margin + 5, y + 4.5);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...slate);
  doc.text(
    'Cuando el usuario formula una pregunta o sube un documento (nota de despido/renuncia/recibo), se ejecuta un pipeline en menos de 900 ms dentro de la Edge Function en Vercel (/api/assistant):',
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 6;

  // Diagrama de 4 Pasos
  const stepHeight = 15;
  const steps = [
    {
      n: 'PASO 1',
      title: 'Vectorización Semántica (Embedding)',
      desc: 'El texto de la consulta o extracto del documento es convertido en un vector denso de 768 dimensiones mediante el modelo text-embedding-004 de Google en 120 ms.',
      color: accent,
    },
    {
      n: 'PASO 2',
      title: 'Búsqueda Dual en Supabase (RPCs)',
      desc: 'Se lanzan en paralelo dos RPCs: 1) buscar_criterios_laborales (similitud de coseno sobre pgvector) y 2) buscar_jurisprudencia_csj (FTS ponderado por relevancia judicial).',
      color: emerald,
    },
    {
      n: 'PASO 3',
      title: 'Aumento de Contexto Dinámico',
      desc: 'Los mejores 3 fallos de la CSJ y criterios prácticos se inyectan en tiempo de ejecución en las secciones [JURISPRUDENCIA CSJ] y [Criterios Prácticos] del prompt maestro.',
      color: [147, 51, 234],
    },
    {
      n: 'PASO 4',
      title: 'Inferencia en Cascada (Waterfall Streaming)',
      desc: 'El prompt enriquecido se envía al motor de inferencia con tolerancia a fallos: Gemini 1.5/3.8 Flash -> Groq Llama 3.3 -> Cloudflare Workers -> OpenAI -> DeepSeek.',
      color: navy,
    },
  ];

  steps.forEach((st) => {
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...st.color);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, stepHeight, 1.5, 1.5, 'FD');

    // Badge Paso
    doc.setFillColor(...st.color);
    doc.roundedRect(margin + 2.5, y + 2.5, 16, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(st.n, margin + 10.5, y + 6, { align: 'center' });

    // Titulo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...navy);
    doc.text(st.title, margin + 22, y + 6);

    // Descripcion
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...slate);
    doc.text(doc.splitTextToSize(st.desc, contentWidth - 25), margin + 22, y + 10.5);

    y += stepHeight + 2.5;
  });

  y += 4;

  // ── SECCIÓN 4: SEGURIDAD, API KEYS Y ARQUITECTURA ZERO-LEAK ──
  doc.setFillColor(...navy);
  doc.rect(margin, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text('4. GOBERNANZA DE SEGURIDAD, API KEYS Y PROTOCOLO ZERO-LEAK', margin + 5, y + 4.5);
  y += 7;

  // Tabla de seguridad de API Keys y Componentes
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: slate,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 36 },
      2: { cellWidth: 'auto' },
    },
    head: [['Componente / Credencial', 'Ubicación de Custodia', 'Garantía Criptográfica / Zero-Leak']],
    body: [
      [
        'SUPABASE_SERVICE_ROLE_KEY',
        'Vercel Environment Variables\n(Solo Servidor Seguro)',
        'Nunca llega al frontend. Utilizada exclusivamente por api/assistant.ts para ejecutar las funciones RPC autorizadas.',
      ],
      [
        'GEMINI_API_KEY /\nGROQ_API_KEYS / OPENAI',
        'Vercel Serverless Secrets\n(Pool rotativo en memoria)',
        'Inaccesibles desde la consola o red del cliente. El frontend solo recibe stream SSE de texto depurado.',
      ],
      [
        'Políticas RLS en Supabase\n(Row Level Security)',
        'Motor Postgres Interno\n(Reglas a nivel de fila)',
        'Las tablas de clientes y auditorías requieren JWT autenticado. Tablas de jurisprudencia protegidas contra escritura pública.',
      ],
      [
        'Sanitización de Archivos\n(PDF / Imágenes OCR)',
        'Cliente y Servidor\n(Buffer Memory Only)',
        'Los archivos adjuntos se procesan en memoria volátil (máx. 15 págs/4MB); no se guardan en disco persistente.',
      ],
    ],
  });

  y = doc.lastAutoTable.finalY + 6;

  // Resumen Ejecutivo / Cuadro de Certificación
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...emerald);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 23, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text('CERTIFICACIÓN DE CIBERSEGURIDAD & COMPLIANCE PARAGUAY', margin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(...slate);
  const certTxt = '1. Cero exposición de credenciales: La directiva del sistema prohíbe taxativamente divulgar keys en el chat.\n2. Verificabilidad jurídica: Toda cita normativa de Tobi está respaldada por artículos y números de sentencias CSJ auditables.\n3. Blindaje de datos sensibles: Se aplica el guard check-no-sensitive-data.mjs antes de cualquier despliegue a producción.';
  doc.text(certTxt, margin + 4, y + 10.5);

  renderFooter(2);

  return doc;
}

// Generar y guardar
const doc = createTobiDoc();
const outDir = 'C:\\Users\\dnunez.SWOOSH\\Documents\\Calculadora RRHH';
const outPath = path.join(outDir, 'ARQUITECTURA_Y_APRENDIZAJE_TOBI_IA.pdf');
const desktopPath = 'C:\\Users\\dnunez.SWOOSH\\Desktop\\ARQUITECTURA_Y_APRENDIZAJE_TOBI_IA.pdf';

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

fs.writeFileSync(outPath, pdfBuffer);
console.log(`PDF generado exitosamente en: ${outPath}`);

try {
  fs.writeFileSync(desktopPath, pdfBuffer);
  console.log(`Copia guardada en el Escritorio: ${desktopPath}`);
} catch (e) {
  console.log('No se pudo guardar en Desktop, pero sí en Documents:', e.message);
}

const pageCount = doc.getNumberOfPages();
console.log(`TOTAL DE PÁGINAS: ${pageCount}`);
