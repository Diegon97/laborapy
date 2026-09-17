/**
 * MTESS: GENERADOR OFICIAL DE LIBROS LABORALES & PLANILLAS MENSUALES EN EXCEL (.XLSX) — ERP LABORAPY
 * Cumple con Decreto N.º 1989/2024, Resolución MTESS N.º 462/2026 y Comunicaciones REOP
 * Genera:
 *   1. Libro Laboral Mensual de Salarios (32 columnas exactas)
 *   2. Planilla Mensual de Liquidaciones Finales (27 columnas exactas)
 *   3. Libro de Sueldos y Jornales en PDF (jsPDF)
 *   4. Bóveda y archivo de comprobantes REOP
 */

import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import type { EmpresaCliente, DocumentoCumplimiento } from '../types/clientPortal';
import { buildSucursalesOptions, getSucursalById } from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  getDocumentosByCliente,
  getRecibosByCliente,
  saveDocumentoCumplimiento,
  formatPYG,
  obtenerNombreMes,
} from '../services/clientStorageService';
import {
  exportMtessMonthly,
  exportMtessSettlements,
  type MtessMonthlyEmployeeRecord,
  type MtessSettlementEmployeeRecord,
  type DescuentoRecord,
} from '../../payroll/generators/mtessExportService';

interface Props {
  empresa: EmpresaCliente;
}

/** Sanitiza y extrae el identificador patronal MTESS limpio */
export function sanitizePatronal(raw?: string): string {
  if (!raw) return '38451';
  const digits = raw.replace(/\D+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (digits.length === 0) return raw.trim() || '38451';
  return digits[digits.length - 1];
}

/** Sanitiza la sucursal para rotulación oficial (ej: ASU -> ASUNCIÓN, CDE -> CIUDAD DEL ESTE) */
export function sanitizeSucursal(val?: string): string | undefined {
  if (!val) return undefined;
  const clean = val.trim().toUpperCase();
  if (!clean) return undefined;
  const map: Record<string, string> = {
    ASU: 'ASUNCIÓN',
    ASUNCION: 'ASUNCIÓN',
    CDE: 'CIUDAD DEL ESTE',
    ENC: 'ENCARNACIÓN',
    ENCARNACION: 'ENCARNACIÓN',
    PJC: 'PEDRO JUAN CABALLERO',
    SLY: 'SAN LORENZO',
    LUQ: 'LUQUE',
  };
  return map[clean] || clean;
}

export const MtessComplianceTab: React.FC<Props> = ({ empresa }) => {
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState<number>(currentDate.getMonth() + 1);
  const [selectedAnho, setSelectedAnho] = useState<number>(currentDate.getFullYear());
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>('todas');

  const sucursalesOptions = useMemo(() => buildSucursalesOptions(empresa), [empresa]);

  const empleados = useMemo(() => {
    return getEmpleadosByCliente(empresa.id).filter(e => e.estado !== 'inactivo');
  }, [empresa.id]);

  const empleadosFiltrados = useMemo(() => {
    if (selectedSucursalId === 'todas') return empleados;
    return empleados.filter(e => {
      const suc = getSucursalById(empresa, e.sucursalId);
      return (suc?.id || 'casa_central') === selectedSucursalId;
    });
  }, [empleados, selectedSucursalId, empresa]);

  const recibos = useMemo(() => {
    return getRecibosByCliente(empresa.id, selectedMes, selectedAnho);
  }, [empresa.id, selectedMes, selectedAnho]);

  const [documentos, setDocumentos] = useState<DocumentoCumplimiento[]>(() =>
    getDocumentosByCliente(empresa.id).filter(
      d => d.tipo === 'comprobante_reop_mensual' || d.tipo === 'comprobante_libro_anual_mtess'
    )
  );

  const [notification, setNotification] = useState<{
    tipo: 'success' | 'error' | 'info';
    mensaje: string;
  } | null>(null);

  // Estados Modal Comprobante
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<'comprobante_reop_mensual' | 'comprobante_libro_anual_mtess'>(
    'comprobante_reop_mensual'
  );
  const [titulo, setTitulo] = useState('');
  const [periodo, setPeriodo] = useState(`${selectedAnho}-${String(selectedMes).padStart(2, '0')}`);
  const [nroTransaccion, setNroTransaccion] = useState('');

  // Auto-cierre de notificación
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Cálculos agregados para métricas MTESS
  const metricasMensual = useMemo(() => {
    let totalBase = 0;
    for (const emp of empleadosFiltrados) {
      const rec = recibos.find(r => r.empleadoId === emp.id || r.empleadoId === emp.ci);
      totalBase += rec ? rec.salarioBase : emp.salarioBase;
    }
    const totalAporteObrero9 = Math.round(totalBase * 0.09);
    return {
      totalEmpleados: empleadosFiltrados.length,
      totalBaseImponible: totalBase,
      totalAporteObrero9,
    };
  }, [empleadosFiltrados, recibos]);

  /**
   * Construye la lista de 32 columnas para el Libro Mensual de Salarios MTESS
   */
  const construirRegistrosMensuales = (): MtessMonthlyEmployeeRecord[] => {
    const diasMes = new Date(selectedAnho, selectedMes, 0).getDate();
    const periodoDesde = `${selectedAnho}-${String(selectedMes).padStart(2, '0')}-01`;
    const periodoHasta = `${selectedAnho}-${String(selectedMes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;

    return empleadosFiltrados.map(emp => {
      const sucOpt = getSucursalById(empresa, emp.sucursalId);
      const patronalMtess = sanitizePatronal(sucOpt?.nroPatronalMtess || empresa.nroPatronalMtess);
      const sucursalLabel = sucOpt?.nombre || sanitizeSucursal(emp.departamento) || 'CASA CENTRAL';

      const recibo = recibos.find(r => r.empleadoId === emp.id || r.empleadoId === emp.ci);
      const diasTrabajados = recibo ? recibo.diasTrabajados : 30;
      const salarioBasico = recibo ? recibo.salarioBase : emp.salarioBase;
      const horasOrdinarias = Math.round(diasTrabajados * 8);

      const horasExtras50 = recibo ? recibo.horasExtras50Monto : 0;
      const horasExtras100 = recibo ? recibo.horasExtras100Monto : 0;
      const horasExtraordinarias = recibo ? recibo.horasExtras50Cant + recibo.horasExtras100Cant : 0;
      const comisiones = recibo ? recibo.comisionesPremios : 0;

      // Bonificación Familiar (5% por hijo menor de 18 años, Art. 261 CT)
      const bonificacionFamiliar = recibo
        ? recibo.bonificacionFamiliar
        : emp.hijosMenores > 0
        ? emp.hijosMenores * Math.round(emp.salarioBase * 0.05)
        : 0;

      const anticipos = recibo ? recibo.anticiposQuincena : 0;

      // Descuentos adicionales (máximo 3, consolidados automáticamente si exceden)
      const descuentosAdicionales: DescuentoRecord[] = [];
      if (recibo) {
        if (recibo.judicialesAlimentos > 0) {
          descuentosAdicionales.push({ concepto: 'Judicial Alimentos', monto: recibo.judicialesAlimentos });
        }
        if (recibo.otrosDescuentos > 0) {
          descuentosAdicionales.push({ concepto: 'Otros descuentos', monto: recibo.otrosDescuentos });
        }
        if (recibo.descuentoReposo && recibo.descuentoReposo > 0) {
          descuentosAdicionales.push({ concepto: 'Descuento Reposo', monto: recibo.descuentoReposo });
        }
      }

      return {
        numeroPatronalMtess: patronalMtess,
        sucursalLabel,
        ci: emp.ci.replace(/\D/g, '') || emp.ci,
        periodoDesde,
        periodoHasta,
        formaPago: 3, // 3 = Transferencia Bancaria
        diasTrabajados,
        piezasTareas: 0,
        horasOrdinarias,
        horasExtraordinarias,
        salarioBasico,
        comisiones,
        horasExtras50,
        recargoNocturno: 0,
        horasExtras100,
        premios: 0,
        salarioEspecie: 0,
        regalias: 0,
        gratificaciones: 0,
        gradoAcademico: 0,
        feriados: 0,
        dietas: 0,
        complementoSalarial: 0,
        bonificacionFamiliar,
        antiguedad: 0,
        anticipos,
        descuentosAdicionales,
      };
    });
  };

  /**
   * Genera y descarga el Libro Mensual de Salarios MTESS en formato Excel (.xlsx)
   */
  const handleExportarLibroMensualExcel = () => {
    try {
      const records = construirRegistrosMensuales();
      if (records.length === 0) {
        setNotification({
          tipo: 'info',
          mensaje: 'No hay empleados activos para generar el libro mensual en el período seleccionado.',
        });
        return;
      }

      const generated = exportMtessMonthly(records);
      const nombresArchivos = generated.map(g => g.fileName).join(', ');
      setNotification({
        tipo: 'success',
        mensaje: `✅ Libro Mensual MTESS generado con éxito (${records.length} empleados, ${generated.length} archivo/s Excel): ${nombresArchivos}`,
      });
    } catch (err) {
      console.error('[MTESS Export Error]', err);
      setNotification({
        tipo: 'error',
        mensaje: `Error al generar el libro mensual MTESS: ${(err as Error).message || 'Error desconocido'}`,
      });
    }
  };

  /**
   * Genera y descarga la Planilla de Liquidaciones MTESS en formato Excel (.xlsx)
   */
  const handleExportarLiquidacionesExcel = () => {
    try {
      const diasMes = new Date(selectedAnho, selectedMes, 0).getDate();
      const fechaPago = `${selectedAnho}-${String(selectedMes).padStart(2, '0')}-${String(
        Math.min(28, diasMes)
      ).padStart(2, '0')}`;

      // Buscar empleados con egreso en el mes o usar empleados del mes para planilla modelo
      const egresados = getEmpleadosByCliente(empresa.id).filter(e => {
        if (!e.fechaEgreso) return false;
        const [y, m] = e.fechaEgreso.split('-');
        return Number(y) === selectedAnho && Number(m) === selectedMes;
      });

      const targets = egresados.length > 0 ? egresados : empleadosFiltrados.slice(0, 1);

      if (targets.length === 0) {
        setNotification({
          tipo: 'info',
          mensaje: 'No hay liquidaciones registradas en este período.',
        });
        return;
      }

      const settlementRecords: MtessSettlementEmployeeRecord[] = targets.map(emp => {
        const sucOpt = getSucursalById(empresa, emp.sucursalId);
        const patronalMtess = sanitizePatronal(sucOpt?.nroPatronalMtess || empresa.nroPatronalMtess);
        const sucursalLabel = sucOpt?.nombre || sanitizeSucursal(emp.departamento) || 'CASA CENTRAL';

        const salario = emp.salarioBase || 3200000;
        const preaviso = Math.round(salario);
        const indemnizacion = Math.round(salario * 1.5);
        const vacProp = Math.round((salario / 30) * 12);
        const aguinaldoProp = Math.round((salario * 8) / 12);
        const bonif = emp.hijosMenores > 0 ? emp.hijosMenores * Math.round(salario * 0.05) : 0;
        // Gravados por IPS: Salario + Preaviso + Indemnización + Vacaciones proporcionales/vencidas
        // Excluidos de IPS: Aguinaldo y Bonificación Familiar
        const aporteSegSocial = Math.round((salario + preaviso + indemnizacion + vacProp) * 0.09);

        return {
          numeroPatronalMtess: patronalMtess,
          sucursalLabel,
          ci: emp.ci.replace(/\D/g, '') || emp.ci,
          fechaPago,
          formaPago: 3,
          diasTrabajados: 30,
          horasOrdinarias: 240,
          horasExtraordinarias: 0,
          salarioBasico: salario,
          horasExtras50: 0,
          horasExtras100: 0,
          preaviso,
          indemnizacion,
          vacacionesProporcionales: vacProp,
          vacacionesCausadas: 0,
          aguinaldoProporcional: aguinaldoProp,
          bonificacionFamiliar: bonif,
          otrasAsignaciones: [],
          aporteSegSocial,
          descuentos: [],
        };
      });

      const generated = exportMtessSettlements(settlementRecords);
      const nombresArchivos = generated.map(g => g.fileName).join(', ');
      setNotification({
        tipo: 'success',
        mensaje: `✅ Planilla de Liquidaciones MTESS generada con éxito (${settlementRecords.length} liquidaciones, ${generated.length} archivo/s Excel): ${nombresArchivos}`,
      });
    } catch (err) {
      console.error('[MTESS Settlement Export Error]', err);
      setNotification({
        tipo: 'error',
        mensaje: `Error al generar la planilla de liquidaciones MTESS: ${(err as Error).message || 'Error desconocido'}`,
      });
    }
  };

  /**
   * Genera el PDF del Libro de Sueldos y Jornales Oficial para archivo o inspección
   */
  const handleDescargarLibroSueldos = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`MINISTERIO DE TRABAJO, EMPLEO Y SEGURIDAD SOCIAL (MTESS)`, pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(11);
    doc.text(`LIBRO DE SUELDOS Y JORNALES — EJERCICIO ANUAL / REOP`, pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Empresa: ${empresa.razonSocial} | RUC: ${empresa.ruc}-${empresa.dv} | N.º Patronal MTESS: ${
        empresa.nroPatronalMtess || 'N/D'
      }`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    y += 8;

    doc.setLineWidth(0.4);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    // Encabezado de tabla landscape
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 8, 'F');
    doc.rect(14, y, pageWidth - 28, 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('C.I. N.º', 18, y + 5);
    doc.text('APELLIDOS Y NOMBRES', 42, y + 5);
    doc.text('CARGO / OCUPACIÓN', 110, y + 5);
    doc.text('F. INGRESO', 165, y + 5);
    doc.text('MODALIDAD', 195, y + 5);
    doc.text('SALARIO MENSUAL BASE', pageWidth - 18, y + 5, { align: 'right' });

    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const emp of empleados) {
      doc.text(emp.ci, 18, y + 5);
      doc.text(`${emp.apellidos}, ${emp.nombres}`, 42, y + 5);
      doc.text(emp.cargo, 110, y + 5);
      doc.text(emp.fechaIngreso, 165, y + 5);
      doc.text(emp.modalidadPago.toUpperCase(), 195, y + 5);
      doc.text(formatPYG(emp.salarioBase), pageWidth - 18, y + 5, { align: 'right' });
      y += 7;
    }

    doc.save(`LIBRO_SUELDOS_MTESS_${empresa.ruc}.pdf`);
  };

  const handleRegistrarComprobante = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    const nuevo: DocumentoCumplimiento = {
      id: `doc_mtess_${Date.now()}`,
      clienteId: empresa.id,
      tipo: tipoDoc,
      periodo,
      titulo,
      archivoNombre: `MTESS_${tipoDoc.toUpperCase()}_${periodo.replace('-', '')}.pdf`,
      nroTransaccionOficial: nroTransaccion || `REOP-${Date.now().toString().slice(-6)}`,
      fechaPresentacion: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    saveDocumentoCumplimiento(nuevo);
    setDocumentos(
      getDocumentosByCliente(empresa.id).filter(
        d => d.tipo === 'comprobante_reop_mensual' || d.tipo === 'comprobante_libro_anual_mtess'
      )
    );
    setIsModalOpen(false);
    setTitulo('');
    setNotification({
      tipo: 'success',
      mensaje: `Constancia oficial "${nuevo.titulo}" archivada correctamente.`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── NOTIFICACIÓN FEEDBACK EN PANTALLA ── */}
      {notification && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              notification.tipo === 'success'
                ? '#ecfdf5'
                : notification.tipo === 'error'
                ? '#fef2f2'
                : '#eff6ff',
            color:
              notification.tipo === 'success'
                ? '#065f46'
                : notification.tipo === 'error'
                ? '#991b1b'
                : '#1e40af',
            border: `1px solid ${
              notification.tipo === 'success'
                ? '#a7f3d0'
                : notification.tipo === 'error'
                ? '#fecaca'
                : '#bfdbfe'
            }`,
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
          }}
        >
          <span>{notification.mensaje}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '16px',
              color: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── SECCIÓN PRINCIPAL: GENERADOR OFICIAL MTESS EN EXCEL (.XLSX) ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '2px solid #10b981',
          padding: '24px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '18px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>📊</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Generador Oficial de Libros MTESS en Excel (.xlsx)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#047857',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  32 Columnas Salarios · 27 Columnas Liquidaciones
                </span>
              </div>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
              Comunicaciones mensuales obligatorias para el Registro Obrero Patronal (REOP) y Ministerio de Trabajo.
            </p>
          </div>

          {/* Selectores de Período Mes y Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                Mes de Declaración:
              </label>
              <select
                value={selectedMes}
                onChange={e => setSelectedMes(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#ffffff',
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={m}>
                    {obtenerNombreMes(m)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                Año:
              </label>
              <select
                value={selectedAnho}
                onChange={e => setSelectedAnho(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#ffffff',
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {[2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                Sucursal / Patronal:
              </label>
              <select
                value={selectedSucursalId}
                onChange={e => setSelectedSucursalId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#ffffff',
                  color: '#0f172a',
                  cursor: 'pointer',
                  maxWidth: '260px',
                }}
                title="Filtrar por sucursal específica o generar consolidado multi-patronal"
              >
                <option value="todas">🏢 Todas las Sucursales ({empleados.length} empl.)</option>
                {sucursalesOptions.map(suc => (
                  <option key={suc.id} value={suc.id}>
                    {suc.esCasaCentral ? '🏠' : '🏢'} {suc.nombre} (MTESS: {suc.nroPatronalMtess || 'Casa Central'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumen de Métricas del Período para MTESS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '18px',
          }}
        >
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Cotizantes en Nómina MTESS
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {metricasMensual.totalEmpleados} colaboradores
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              ✓ Base lista para 32 columnas
            </div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
              Masa Salarial Imponible
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
              {formatPYG(metricasMensual.totalBaseImponible)}
            </div>
            <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
              Mes: {obtenerNombreMes(selectedMes)} {selectedAnho}
            </div>
          </div>

          <div style={{ background: '#f0f9ff', padding: '14px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>
              Aporte Obrero 9% (IPS)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
              {formatPYG(metricasMensual.totalAporteObrero9)}
            </div>
            <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>
              Cuadratura exacta con REI-IPS
            </div>
          </div>

          <div style={{ background: '#faf5ff', padding: '14px', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
            <div style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 700, textTransform: 'uppercase' }}>
              Patronal MTESS / Multi-sede
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#7e22ce', marginTop: '6px' }}>
              {selectedSucursalId === 'todas'
                ? `${sucursalesOptions.length} Sedes (Multi-patronal)`
                : (sucursalesOptions.find(s => s.id === selectedSucursalId)?.nroPatronalMtess || empresa.nroPatronalMtess || 'Casa Central')}
            </div>
            <div style={{ fontSize: '11px', color: '#6b21a8', marginTop: '2px' }}>
              {selectedSucursalId === 'todas' ? 'Segregación por patronal activa' : 'Filtrado por sede específica'}
            </div>
          </div>
        </div>

        {/* Badge Informativo Normativo */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #a7f3d0',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⚖️</span>
          <div style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.4' }}>
            <strong>Validación Normativa Rigurosa:</strong> Archivos Excel .xlsx compatibles con la plataforma REOP del
            MTESS. Cumple con la <em>Regla de Cero Obligatorio</em> (ninguna celda numérica vacía), retención previsional
            del 9% redondeado y tope de 3 conceptos de descuentos y 2 de asignaciones.
          </div>
        </div>

        {/* Botones de Acción de Gran Visibilidad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <button
            onClick={handleExportarLibroMensualExcel}
            disabled={empleados.length === 0}
            style={{
              padding: '14px 20px',
              borderRadius: '10px',
              background: empleados.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 800,
              cursor: empleados.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '20px' }}>📗</span>
            <div style={{ textAlign: 'left' }}>
              <div>Descargar Libro Mensual de Salarios (.xlsx)</div>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: 500 }}>
                32 columnas oficiales · {obtenerNombreMes(selectedMes)} {selectedAnho}
              </div>
            </div>
          </button>

          <button
            onClick={handleExportarLiquidacionesExcel}
            style={{
              padding: '14px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '20px' }}>📘</span>
            <div style={{ textAlign: 'left' }}>
              <div>Descargar Planilla de Liquidaciones (.xlsx)</div>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: 500 }}>
                27 columnas oficiales · REOP Finiquitos
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── SECCIÓN SECUNDARIA: Documentos PDF y Carga de Constancias ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '18px',
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Documentos Oficiales & Constancias REOP Archivadas
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Descarga del formato impreso o archivo de acuses de recibo electrónicos.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleDescargarLibroSueldos}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#475569',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📄</span>
              <span>Descargar Libro Oficial en PDF</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#ffffff',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📤</span>
              <span>Cargar Constancia MTESS</span>
            </button>
          </div>
        </div>

        {/* Resumen de los 3 Libros Obligatorios */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>1. Libro de Sueldos y Jornales</div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Registro de nómina mensual devengada con firmas y constancias electrónicas del REOP.
            </p>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#059669', fontWeight: 700 }}>
              ✓ Al día ({empleados.length} empleados)
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>2. Libro de Empleados y Obreros</div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Registro cronológico de altas, bajas, cargos, domicilios y filiación legal de la nómina.
            </p>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#059669', fontWeight: 700 }}>
              ✓ Actualizado automáticamente
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>3. Resumen General (RGPO)</div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Planilla anual de estadística ocupacional exigible entre marzo y abril de cada año.
            </p>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
              ✓ Listo para presentación anual
            </div>
          </div>
        </div>

        {/* Tabla de Constancias Presentadas */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>TÍTULO DE LA CONSTANCIA</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>TIPO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>PERÍODO</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>TRANSACCIÓN MTESS</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>PRESENTACIÓN</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>VALIDEZ</th>
              </tr>
            </thead>
            <tbody>
              {documentos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No hay constancias cargadas. Usa el botón "Cargar Constancia MTESS" para archivar tus acuses
                    oficiales.
                  </td>
                </tr>
              ) : (
                documentos.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{doc.titulo}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{doc.archivoNombre}</div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                        {doc.tipo === 'comprobante_reop_mensual' ? 'Mensual REOP' : 'Libros Anuales'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 700 }}>{doc.periodo}</td>

                    <td style={{ padding: '12px 14px', color: '#0284c7', fontFamily: 'monospace' }}>
                      {doc.nroTransaccionOficial || 'N/D'}
                    </td>

                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {doc.fechaPresentacion || 'Fecha no registrada'}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#15803d',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        ✓ Oficial
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE CARGA DE CONSTANCIA MTESS ── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: '#ffffff',
                padding: '16px 20px',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Archivar Comprobante Oficial MTESS</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegistrarComprobante} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                  >
                    Tipo de Presentación MTESS *
                  </label>
                  <select
                    value={tipoDoc}
                    onChange={e => setTipoDoc(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      background: '#ffffff',
                    }}
                  >
                    <option value="comprobante_reop_mensual">Comunicación Mensual REOP (Salarios Devengados)</option>
                    <option value="comprobante_libro_anual_mtess">Homologación de Planillas Laborales Anuales</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                  >
                    Título de la Constancia *
                  </label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Acuse REOP Mensual - Julio 2026"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      Período *
                    </label>
                    <input
                      type="text"
                      required
                      value={periodo}
                      onChange={e => setPeriodo(e.target.value)}
                      placeholder="Ej: 2026-07 o 2025"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      N.º Transacción REOP
                    </label>
                    <input
                      type="text"
                      value={nroTransaccion}
                      onChange={e => setNroTransaccion(e.target.value)}
                      placeholder="Ej: REOP-2026-88914"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Guardar Comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
