/**
 * GENERADOR OFICIAL DE DICTAMEN DE AUDITORÍA PATRONAL PRE-MTESS EN PDF
 * LaboraPy — Soluciones Laborales y Contables de Paraguay
 * Versión: PY-AUD-PDF-2026.09.16
 */

import jsPDF from 'jspdf';
import type { AuditoriaPatronalResult } from '../types';

export function generarDictamenAuditoriaPdf(auditoria: AuditoriaPatronalResult): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const dibujarMembreteCompacto = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, y, contentWidth, 10, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('LABORAPY · DICTAMEN DE AUDITORÍA PATRONAL PRE-MTESS', margin + 4, y + 6.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Empresa: ${auditoria.razonSocial.slice(0, 35)} · RUC: ${auditoria.ruc}`, pageWidth - margin - 4, y + 6.5, { align: 'right' });

    y += 14;
  };

  const verificarEspacio = (necesarioMm: number): boolean => {
    if (y + necesarioMm > pageHeight - margin) {
      doc.addPage();
      y = margin;
      dibujarMembreteCompacto();
      return true;
    }
    return false;
  };

  // ── 1. Membrete Principal ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 18, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LABORAPY · AUDITORÍA PATRONAL PRE-MTESS & COMPLIANCE LABORAL', margin + 5, y + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Razón Social: ${auditoria.razonSocial} · RUC: ${auditoria.ruc} · Patronal MTESS: ${auditoria.nroPatronalMtess || 'S/N'} · IPS: ${auditoria.nroPatronalIps || 'S/N'}`,
    margin + 5,
    y + 13
  );

  y += 24;

  // ── 2. Título Oficial ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DICTAMEN TÉCNICO DE RIESGO LABORAL PREVENTIVO', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Evaluación conforme a la Ley N.º 213/93, Decreto N.º 6225/2026, Res. MTESS N.º 670/2026 y Decreto-Ley N.º 1860/50',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 8;

  // ── 3. Panel de Resumen Ejecutivo y Semáforo de Riesgo ──
  const semaforo = auditoria.resumen.semaforo;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  // Tarjeta de Nivel de Riesgo (Semáforo)
  doc.setFillColor(semaforo.rgb[0], semaforo.rgb[1], semaforo.rgb[2]);
  doc.roundedRect(margin + 4, y + 4, 48, 24, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NIVEL DE RIESGO', margin + 28, y + 10, { align: 'center' });

  doc.setFontSize(13);
  doc.text(semaforo.etiqueta, margin + 28, y + 18, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Score: ${auditoria.resumen.scoreCumplimiento}/100`, margin + 28, y + 24, { align: 'center' });

  // Métricas del Resumen
  const colX1 = margin + 56;
  const colX2 = margin + 116;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Empleados Auditados: ${auditoria.resumen.totalEmpleados}`, colX1, y + 9);
  doc.text(`Empleados con Hallazgos: ${auditoria.resumen.empleadosConHallazgos}`, colX1, y + 16);
  doc.text(`Total Contingencias Detectadas: ${auditoria.resumen.totalHallazgos}`, colX1, y + 23);

  doc.text(`Hallazgos Críticos: ${auditoria.resumen.criticos}`, colX2, y + 9);
  doc.text(`Hallazgos Altos: ${auditoria.resumen.altos}`, colX2, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(
    `Multa MTESS Estimada: Gs. ${Math.round(auditoria.resumen.multaTotalEstimadaPYG).toLocaleString('es-PY')}`,
    colX2,
    y + 23
  );

  y += 38;

  // ── 4. Matriz de Hallazgos y Contingencias ──
  verificarEspacio(25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. MATRIZ DE CONTINGENCIAS Y MULTAS ESTIMADAS (MTESS / IPS)', margin, y);
  y += 5;

  if (auditoria.hallazgos.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text('✓ NO SE DETECTARON CONTINGENCIAS LABORALES CRÍTICAS EN LA NÓMINA EVALUADA.', margin + 5, y + 8);
    y += 18;
  } else {
    const dibujarEncabezadoTabla = () => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 7, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('TRABAJADOR / CI', margin + 3, y + 5);
      doc.text('CONTINGENCIA / BASE LEGAL', margin + 48, y + 5);
      doc.text('SEVERIDAD', margin + 120, y + 5);
      doc.text('MULTA ESTIMADA', pageWidth - margin - 3, y + 5, { align: 'right' });
      y += 7;
    };

    dibujarEncabezadoTabla();

    for (const h of auditoria.hallazgos) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const lnNombre = doc.splitTextToSize(h.empleadoNombre, 42);
      const lnTitulo = doc.splitTextToSize(h.titulo, 68);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      const lnCi = doc.splitTextToSize(`CI: ${h.ci} · ${h.cargo}`, 42);

      doc.setFont('helvetica', 'italic');
      const lnBase = doc.splitTextToSize(h.baseLegal, 68);

      const altoIzq = 6 + lnNombre.length * 3.2 + lnCi.length * 3.4;
      const altoDer = 6 + lnTitulo.length * 3.4 + lnBase.length * 3.4;
      const altoFila = Math.max(altoIzq, altoDer);

      const cambioPagina = verificarEspacio(altoFila);
      if (cambioPagina) dibujarEncabezadoTabla();

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentWidth, y);

      let yIzq = y + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(lnNombre, margin + 3, yIzq);
      yIzq += lnNombre.length * 3.2;

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(lnCi, margin + 3, yIzq);

      let yCen = y + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(lnTitulo, margin + 48, yCen);
      yCen += lnTitulo.length * 3.4;

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      doc.text(lnBase, margin + 48, yCen);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      if (h.severidad === 'critico') doc.setTextColor(185, 28, 28);
      else if (h.severidad === 'alto') doc.setTextColor(217, 119, 6);
      else if (h.severidad === 'medio') doc.setTextColor(202, 138, 4);
      else doc.setTextColor(21, 128, 61);
      doc.text(h.severidad.toUpperCase(), margin + 120, y + 4.5);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text(`Gs. ${Math.round(h.multaEstimadaPYG).toLocaleString('es-PY')}`, pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += altoFila + 1;
    }
    y += 5;
  }

  // ── 5. Recomendaciones Técnicas ──
  verificarEspacio(25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. RECOMENDACIONES TÉCNICAS DE REGULARIZACIÓN', margin, y);
  y += 5;

  for (const rec of auditoria.recomendaciones) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const lnTituloRec = doc.splitTextToSize(`• ${rec.titulo}`, contentWidth - 8);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const lnDetalle = doc.splitTextToSize(rec.detalle, contentWidth - 10);

    const altoCaja = 6 + lnTituloRec.length * 3.6 + lnDetalle.length * 3.2;
    verificarEspacio(altoCaja + 2);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, altoCaja, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(lnTituloRec, margin + 3, y + 4.5);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(lnDetalle, margin + 5, y + 4.5 + lnTituloRec.length * 3.6 + 0.5);

    y += altoCaja + 2;
  }

  // ── 6. Plan de Mitigación en Fases ──
  verificarEspacio(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. PLAN DE MITIGACIÓN SUGERIDO (CRONOGRAMA DE BLINDAJE)', margin, y);
  y += 5;

  for (const fase of auditoria.planMitigacion) {
    verificarEspacio(14);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Fase ${fase.fase}: ${fase.titulo} (Plazo: ${fase.plazoDias} días)`, margin + 3, y);
    y += 4;

    for (const accion of fase.acciones) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const lnAccion = doc.splitTextToSize(`  - ${accion}`, contentWidth - 6);
      const altoAccion = lnAccion.length * 3.5;
      verificarEspacio(altoAccion + 1);
      doc.setTextColor(71, 85, 105);
      doc.text(lnAccion, margin + 4, y);
      y += altoAccion + 0.5;
    }
    y += 2;
  }

  // ── 7. Pie de Documento y Disclaimer Legal ──
  verificarEspacio(20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  const disclaimer =
    'Dictamen emitido por el Motor de Cumplimiento Laboral LaboraPy. Este informe tiene carácter preventivo y orientativo ' +
    'conforme al marco normativo vigente en la República del Paraguay (Ley N.º 213/93 y Decretos reglamentarios). No sustituye ' +
    'la resolución oficial del MTESS ni resoluciones judiciales.';
  const splitDisc = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(splitDisc, margin, y);

  return doc;
}
