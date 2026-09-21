#!/usr/bin/env node
/**
 * =============================================================================
 * WORD SIMPLE — TODOS LOS COMENTARIOS COSECHADOS PARA REVISION MANUAL
 * =============================================================================
 * Genera un documento plano y legible con TODOS los comentarios unicos reales
 * cosechados en TikTok, con el veredicto del filtro paraguayo y un espacio para
 * autorizar / rechazar / corregir cada uno.
 *
 * Entrada : calculadora-rrhh-py/datasets/comentarios_revision_5_abogados.json
 * Salida  : COMENTARIOS_COSECHA_REVISION.docx (raiz del proyecto)
 * =============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as docx from 'docx';

const {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer,
} = docx;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENTRADA = path.resolve(__dirname, '../datasets/comentarios_revision_5_abogados.json');
const SALIDA = path.resolve(__dirname, '../../COMENTARIOS_COSECHA_REVISION.docx');

/** URLs de los videos cosechados (4 por abogado) — los comentarios de 4 abogados no llegaron. */
const VIDEOS_POR_ABOGADO = {
  dahianavalos: [
    'https://www.tiktok.com/@dahianavalos/video/7651641545980005640',
    'https://www.tiktok.com/@dahianavalos/video/7613167230808837394',
    'https://www.tiktok.com/@dahianavalos/video/7566317080543333644',
    'https://www.tiktok.com/@dahianavalos/video/7687023858574036232',
  ],
  juanbernis: [
    'https://www.tiktok.com/@juanbernis/video/7620656085594017042',
    'https://www.tiktok.com/@juanbernis/video/7666626316015324436',
    'https://www.tiktok.com/@juanbernis/video/7587607780379364664',
    'https://www.tiktok.com/@juanbernis/video/7687232224965512468',
  ],
  'abg.clara.lopez': [
    'https://www.tiktok.com/@abg.clara.lopez/video/7539290388260064518',
    'https://www.tiktok.com/@abg.clara.lopez/video/7578273737179450636',
    'https://www.tiktok.com/@abg.clara.lopez/video/7511769274684280120',
    'https://www.tiktok.com/@abg.clara.lopez/video/7686550516243156232',
  ],
  ernestoyampey: [
    'https://www.tiktok.com/@ernestoyampey/video/7645425683774147860',
    'https://www.tiktok.com/@ernestoyampey/video/7686592127081696532',
    'https://www.tiktok.com/@ernestoyampey/video/7686591201859947797',
    'https://www.tiktok.com/@ernestoyampey/video/7686589435353517333',
  ],
  jorgefleitasoficial8: [
    'https://www.tiktok.com/@jorgefleitasoficial8/video/7607432951747398919',
    'https://www.tiktok.com/@jorgefleitasoficial8/video/7557514900579323147',
    'https://www.tiktok.com/@jorgefleitasoficial8/video/7547685981688712454',
    'https://www.tiktok.com/@jorgefleitasoficial8/video/7681687065536449813',
  ],
};

if (!fs.existsSync(ENTRADA)) {
  console.error(`No se encontro ${ENTRADA}`);
  process.exit(1);
}

const datos = JSON.parse(fs.readFileSync(ENTRADA, 'utf8'));
const validos = Array.isArray(datos.validos) ? datos.validos : [];
const descartados = Array.isArray(datos.descartados) ? datos.descartados : [];
console.log(`Validos: ${validos.length} | Descartados: ${descartados.length}`);

function titulo(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 140 },
    children: [new TextRun({ text: texto, bold: true, size: 24, color: '0F172A' })],
  });
}

function lineaSimple(texto, opciones = {}) {
  return new Paragraph({
    spacing: { before: opciones.before ?? 40, after: opciones.after ?? 40 },
    children: [new TextRun({ text: texto, size: opciones.size ?? 18, bold: opciones.bold === true, italics: opciones.italics === true, color: opciones.color })],
  });
}

/** Bloque de un comentario: cabecera corta + texto + veredicto + casillas de decision. */
function bloqueComentario(registro, numero) {
  const cabecera = `#${numero}  ·  @${registro.abogado}  ·  ${registro.likes} me gusta  ·  ${registro.fecha || 'sin fecha'}${registro.autor_comentario ? `  ·  autor: @${registro.autor_comentario}` : ''}`;
  const veredicto = registro.valido === true
    ? `Filtro automatico: VALIDA  (${registro.motivo})`
    : `Filtro automatico: DESCARTADA  (${registro.motivo})`;

  return [
    new Paragraph({
      spacing: { before: 160, after: 20 },
      children: [new TextRun({ text: cabecera, bold: true, size: 16, color: '475569' })],
    }),
    new Paragraph({
      spacing: { before: 20, after: 20 },
      shading: { type: 'clear', fill: 'FEF9E7' },
      children: [new TextRun({ text: `"${registro.comentario}"`, size: 20 })],
    }),
    new Paragraph({
      spacing: { before: 20, after: 60 },
      children: [new TextRun({ text: veredicto, size: 15, italics: true, color: registro.valido ? '047857' : 'B45309' })],
    }),
    new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: '[   ] AUTORIZAR        [   ] RECHAZAR        Correccion: ______________________________________________________', size: 16, color: '64748B' })],
    }),
  ];
}

const hijos = [];

// --- ENCABEZADO ---
hijos.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'COMENTARIOS COSECHADOS EN TIKTOK — REVISION MANUAL', bold: true, size: 26, color: '047857' })],
}));
hijos.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: 'Para autorizar, rechazar o corregir el dataset del RAG de Tobi', italics: true, size: 18, color: '64748B' })],
}));

// --- HALLAZGO (corto y directo) ---
hijos.push(titulo('QUE HAY Y QUE FALTA (leer antes de revisar)'));
hijos.push(lineaSimple(`Total de comentarios unicos cosechados: ${validos.length + descartados.length} (todos del perfil @dahianavalos).`));
hijos.push(lineaSimple(`De esos, el filtro automatico acepto ${validos.length} y descarto ${descartados.length}. Los ${descartados.length} estan incluidos aca abajo para que puedas rescatar los que el filtro no entendio.`));
hijos.push(lineaSimple(''));
hijos.push(lineaSimple('HALLAZGO: de @juanbernis, @ernestoyampey, @abg.clara.lopez y @jorgefleitasoficial8 NO hay ni un comentario cosechado.', { bold: true }));
hijos.push(lineaSimple('Motivo tecnico verificado: los 20 videos cosechados (4 por abogado) apuntan TODOS al mismo dataset de comentarios de Apify (id 4QCk1QU5DTGMCQlc8) y devuelven exactamente el mismo contenido (mismo hash 1cf0cf19aa94b4b9, 314 comentarios por video, todos los de Dahiana).'));
hijos.push(lineaSimple('En criollo: el scraper guardo los comentarios de un solo video y los repitio en los 20. Cuando el filtro descarto duplicados, se quedo solo con los de la primera cuenta. Los comentarios de los otros 4 abogados nunca se bajaron.'));
hijos.push(lineaSimple(''));
hijos.push(lineaSimple('VIDEOS CUYOS COMENTARIOS FALTAN (4 por abogado):', { bold: true }));

for (const [abogado, urls] of Object.entries(VIDEOS_POR_ABOGADO)) {
  if (abogado === 'dahianavalos') continue;
  hijos.push(lineaSimple(`@${abogado}:`, { bold: true, before: 80 }));
  for (const u of urls) hijos.push(lineaSimple(u, { size: 15, color: '2563EB' }));
}

// --- VALIDOS ---
hijos.push(titulo(`1) ACEPTADOS POR EL FILTRO — ${validos.length} comentarios`));
hijos.push(lineaSimple('Si estas de acuerdo, no hace falta que escribas nada: los tomo como autorizados.', { italics: true, color: '475569' }));
validos.forEach((r, i) => {
  for (const p of bloqueComentario(r, r.id ?? i + 1)) hijos.push(p);
});

// --- DESCARTADOS ---
hijos.push(titulo(`2) DESCARTADOS POR EL FILTRO — ${descartados.length} comentarios`));
hijos.push(lineaSimple('Aca esta la plata: reviza los que el filtro no entendio (jopara, sin terminos tecnicos, mensajes cortos). Marca AUTORIZAR en los que sirvan.', { italics: true, color: '475569' }));
descartados.forEach((r, i) => {
  for (const p of bloqueComentario(r, r.id ?? i + 1)) hijos.push(p);
});

const doc = new Document({
  creator: 'LaboraPy',
  title: 'Comentarios cosechados para revision',
  description: 'Revision manual de comentarios cosechados en TikTok para el RAG de Tobi',
  sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: hijos }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(SALIDA, buffer);
console.log(`Word generado: ${SALIDA} (${(buffer.length / 1024).toFixed(1)} KB)`);
