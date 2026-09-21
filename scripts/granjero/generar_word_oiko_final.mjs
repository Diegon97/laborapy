#!/usr/bin/env node
/**
 * =============================================================================
 * GENERADOR DE WORD FINAL — DATASET 5 ABOGADOS "OIKO O NO" (LABORAPY)
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
  ShadingType,
  Packer,
} = docx;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OIKO_PATH = path.resolve(__dirname, '../../datasets/consultas_5_abogados_oiko_final.json');
const DESCARTADOS_PATH = path.resolve(__dirname, '../../datasets/comentarios_5_abogados_descartados.json');
const SALIDA_DOCX = path.resolve(__dirname, '../../../DATASET_5_ABOGADOS_OIKO_FINAL_REVISION.docx');

if (!fs.existsSync(OIKO_PATH)) {
  console.log(`Nota: ${OIKO_PATH} aún no se generó. Esperando corrida del pipeline.`);
  process.exit(0);
}

const casosOiko = JSON.parse(fs.readFileSync(OIKO_PATH, 'utf8'));
const casosDescartadosRaw = fs.existsSync(DESCARTADOS_PATH)
  ? JSON.parse(fs.readFileSync(DESCARTADOS_PATH, 'utf8'))
  : [];

// Separar en Ambiguos / Fronterizos vs Ruido Evidente
const kwLaboral = [
  'despido', 'renuncia', 'ips', 'sueldo', 'salario', 'guarani', 'plata', 'cobro',
  'año', 'mes', 'dia', 'hora', 'extra', 'patron', 'jefe', 'empresa', 'trabaj',
  'liquidacion', 'aguinaldo', 'vacacion', 'embarazo', 'maternidad', 'reposo',
  'preaviso', 'indemniz', 'contrato', 'factur', 'multa', 'descuento', 'justific',
  'injustific', 'acoso', 'maltrato', 'caja', 'faltante', 'cuanto', 'puedo', 'debo'
];

const casosAmbiguos = [];
const casosRuido = [];

for (const d of casosDescartadosRaw) {
  const com = (d.comentario || '').toLowerCase();
  const esPregunta = com.includes('?') || com.includes('como') || com.includes('cuanto') || com.includes('puedo') || com.includes('debo') || com.includes('que pasa');
  const tieneTemaLaboral = kwLaboral.some(kw => com.includes(kw));

  if ((tieneTemaLaboral || esPregunta) && (d.comentario || '').trim().length > 18) {
    casosAmbiguos.push(d);
  } else {
    casosRuido.push(d);
  }
}

console.log(`Compilando Word: ${casosOiko.length} OIKO, ${casosAmbiguos.length} AMBIGUOS/FRONTERIZOS, ${casosRuido.length} RUIDO EVIDENTE...`);

const doc = new Document({
  creator: 'LaboraPy',
  title: 'Dataset 5 Abogados Laboralistas — Filtro Pericial Oiko',
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'LABORAPY — DATASET 5 ABOGADOS LABORALISTAS (PARAGUAY)',
              bold: true,
              size: 28,
              color: '047857',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: 'COSECHA COMPLETA & FILTRO PERICIAL "OIKO O NO" (GROQ + GEMINI 3.8 FLASH)',
              italics: true,
              size: 18,
              color: '475569',
            }),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 150 },
          children: [
            new TextRun({
              text: `1. CONSULTAS LABORALES VERIFICADAS ("OIKO") — TOTAL: ${casosOiko.length}`,
              bold: true,
              size: 22,
              color: '0F172A',
            }),
          ],
        }),
        ...casosOiko.flatMap((caso) => [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 80 },
            children: [
              new TextRun({
                text: `CASO #${caso.id}: ${caso.tema.toUpperCase()} (@${caso.abogado})`,
                bold: true,
                size: 20,
                color: '047857',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Abogado / Video:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: `@${caso.abogado} (${caso.nombre_abogado}) | Likes: ${caso.likes || 0} | ${caso.video_url}`, size: 17, color: '2563EB' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Consulta Textual:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: `"${caso.comentario}"`, bold: true, italics: true, size: 18, color: '92400E' })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Peritaje Dual (Gemini + DeepSeek):', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: '⚡ Gemini 3.8 Flash: ', bold: true, size: 17, color: '047857' }),
                          new TextRun({ text: `${caso.motivo_gemini || ''} [Artículos Ley 213/93: ${(caso.articulos || []).join(', ')}]`, size: 17 }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [
                          new TextRun({ text: `🧠 DeepSeek (${caso.veredicto_deepseek || 'AUDITADO'}): `, bold: true, size: 17, color: '1D4ED8' }),
                          new TextRun({ text: caso.observacion_deepseek || caso.dictamen_gemini || 'Confirmado para peritaje', size: 17 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Autorización:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: '[   ] AUTORIZADO (Sin cambios)       [   ] MODIFICADO       [   ] RECHAZADO', bold: true, size: 17 }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [
                          new TextRun({ text: 'Corrección de Diego Núñez: ______________________________________________________', color: '94A3B8', size: 16 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 150 } }),
        ]),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 150 },
          children: [
            new TextRun({
              text: `2. CASOS AMBIGUOS / ZONA GRIS (PARA CONFIRMACIÓN DE DIEGO NÚÑEZ) — TOTAL: ${casosAmbiguos.length}`,
              bold: true,
              size: 22,
              color: 'D97706',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Estos comentarios mencionan conceptos laborales o preguntas sobre derechos en Paraguay, pero fueron descartados preliminarmente por brevedad o tono. Marque [X] para rescatar aquellos con valor real para Tobi AI.',
              italics: true,
              size: 17,
              color: '64748B',
            }),
          ],
        }),
        ...casosAmbiguos.flatMap((caso, idx) => [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text: `AMBIGUO #${idx + 1} (@${caso.abogado || 'abogado'})`,
                bold: true,
                size: 19,
                color: 'B45309',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Comentario Textual:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'FEF3C7' },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: `"${caso.comentario}"`, bold: true, italics: true, size: 17, color: '92400E' })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Motivo de Descarte IA:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: caso.motivo_descarte || caso.motivo || 'Descartado por IA', size: 16, color: 'DC2626' })],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'E2E8F0' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Confirmación Diego:', bold: true, size: 17 })] })],
                  }),
                  new TableCell({
                    width: { size: 78, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: '[   ] RESCATAR (Pasar a OIKO para Tobi)       [   ] CONFIRMAR DESCARTE', bold: true, size: 17 }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [
                          new TextRun({ text: 'Nota / Corrección de Diego Núñez: ________________________________________________', color: '94A3B8', size: 16 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 120 } }),
        ]),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 150 },
          children: [
            new TextRun({
              text: `3. COMENTARIOS DESCARTADOS DIRECTOS (RUIDO / SPAM) — TOTAL: ${casosRuido.length}`,
              bold: true,
              size: 22,
              color: '0F172A',
            }),
          ],
        }),
        ...casosRuido.map((d, i) =>
          new Paragraph({
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({ text: `${i + 1}. [@${d.abogado || 'abogado'}]: `, bold: true, size: 16, color: '64748B' }),
              new TextRun({ text: `"${d.comentario}" `, size: 16 }),
              new TextRun({ text: `[${d.motivo_descarte || d.motivo || 'Ruido'}]`, italics: true, size: 15, color: '94A3B8' }),
            ],
          })
        ),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(SALIDA_DOCX, buffer);
  console.log(`\n✅ Word final generado exitosamente en:\n   👉 ${SALIDA_DOCX}`);
}).catch((err) => {
  console.error('Error generando Word:', err);
});
