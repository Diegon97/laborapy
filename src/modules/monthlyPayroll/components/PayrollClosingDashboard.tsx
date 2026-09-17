/**
 * TABLERO DE CIERRE MENSUAL Y AUDITORÍA PRE-CIERRE (ERP LABORAPY)
 *
 * D1 · Tablero de Cierre: resume la liquidación GUARDADA del período (KPIs, comparativa
 *      contra el mes anterior, composición del bruto y paquete de cierre en CSV).
 * D2 · Auditoría pre-cierre: checklist automático de reglas que evita pagar mal.
 *
 * Ambas secciones leen la liquidación guardada del período (localStorage) bajo la misma
 * clave empresa+período que usa la Planilla Editable. Base legal: Ley N.º 213/93 (CT)
 * y Decreto-Ley N.º 1860/50 (IPS). Solo lectura: no persiste ni modifica datos.
 */

import React, { useMemo, useState } from 'react';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { getEmpresaById } from '../../clientPortal/services/clientStorageService';
import {
  calcularNominaMasiva,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';
import { auditarNomina } from '../engine/payrollAudit';
import type { NivelAlerta } from '../engine/payrollAudit';
import { loadNominaPeriodo } from '../services/monthlyPayrollStorage';
import { exportNominaCSV, exportBankCSV } from '../services/payrollCsvExport';
import { AccountingEntryCard } from './AccountingEntryCard';
import { PayrollPeriodManagerBar } from './PayrollPeriodManagerBar';
import { PayrollNoveltiesModal } from './PayrollNoveltiesModal';
import {
  loadPeriodosEmpresa,
  crearPeriodo,
  cerrarPeriodoContable,
  reabrirPeriodoContable,
  replicarPeriodo,
} from '../services/payrollNoveltiesStorage';
import { generarAsientoContableNomina } from '../engine/payrollAccountingEngine';

interface PayrollClosingDashboardProps {
  empresa?: EmpresaCliente;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  padding: '18px 20px',
};

const kpiBase: React.CSSProperties = {
  padding: '16px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 16px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  backgroundColor: '#f1f5f9',
  color: '#334155',
  fontSize: '11px',
  fontWeight: 700,
  textAlign: 'left',
  textTransform: 'uppercase',
  borderBottom: '1px solid #cbd5e1',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const bordeNivel: Record<NivelAlerta, string> = {
  critico: '#dc2626',
  advertencia: '#d97706',
  info: '#2563eb',
};

const bgNivel: Record<NivelAlerta, string> = {
  critico: '#fef2f2',
  advertencia: '#fffbeb',
  info: '#eff6ff',
};

const iconoNivel: Record<NivelAlerta, string> = {
  critico: '⛔',
  advertencia: '⚠️',
  info: 'ℹ️',
};

/** Encabezado del banner de estado de la auditoría. */
function calcularBanner(
  tieneDatos: boolean,
  cantCriticos: number,
  cantAdvertencias: number,
): { texto: string; bg: string; color: string; border: string } {
  if (!tieneDatos) {
    return {
      texto: 'Sin liquidación guardada para auditar',
      bg: '#f1f5f9',
      color: '#475569',
      border: '#cbd5e1',
    };
  }
  if (cantCriticos > 0) {
    return {
      texto: `⛔ No cerrar — ${cantCriticos} hallazgo(s) crítico(s)`,
      bg: '#fef2f2',
      color: '#991b1b',
      border: '#fecaca',
    };
  }
  if (cantAdvertencias > 0) {
    return {
      texto: `⚠️ Listo con observaciones: ${cantAdvertencias}`,
      bg: '#fffbeb',
      color: '#92400e',
      border: '#fde68a',
    };
  }
  return {
    texto: '✅ Listo para cerrar',
    bg: '#ecfdf5',
    color: '#065f46',
    border: '#a7f3d0',
  };
}

export const PayrollClosingDashboard: React.FC<PayrollClosingDashboardProps> = ({ empresa }) => {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<{ mes: number; anho: number }>(() => ({
    mes: hoy.getMonth() + 1,
    anho: hoy.getFullYear(),
  }));

  const periodoKey = `${periodo.anho}-${String(periodo.mes).padStart(2, '0')}`;
  const tituloPeriodo = `${MESES[periodo.mes - 1]} ${periodo.anho}`;

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [mostrarModalNovedades, setMostrarModalNovedades] = useState(false);

  const periodos = useMemo(() => {
    const list = loadPeriodosEmpresa(empresa?.id || '');
    if (list.length === 0) {
      const p = crearPeriodo(empresa?.id || '', periodo.anho, periodo.mes);
      return [p];
    }
    return list;
  }, [empresa, periodo.anho, periodo.mes, reloadTrigger]);

  const handleSeleccionarPeriodo = (periodoId: string) => {
    const parts = periodoId.split('-');
    if (parts.length === 2) {
      setPeriodo({ anho: Number(parts[0]), mes: Number(parts[1]) });
    }
  };

  const handleCrearPeriodo = (anio: number, mes: number) => {
    crearPeriodo(empresa?.id || '', anio, mes);
    setPeriodo({ anho: anio, mes });
    setReloadTrigger((v) => v + 1);
  };

  const handleReplicarPeriodo = (origenId: string, destinoId: string) => {
    const res = replicarPeriodo(empresa?.id || '', origenId, destinoId);
    alert(res.mensaje);
    if (res.exito) {
      setReloadTrigger((v) => v + 1);
    }
  };

  const handleCerrarPeriodo = (periodoId: string) => {
    if (!empleados.length) {
      alert('No hay funcionarios registrados en este período para cerrar.');
      return;
    }
    const confirmado = window.confirm(
      `¿Desea cerrar oficialmente el período ${periodoId}?\n\nEsto congelará el asiento contable consolidado y amortizará las novedades salariales (saldos de embargos y préstamos).`,
    );
    if (!confirmado) return;

    const asiento = generarAsientoContableNomina(
      totales,
      liquidaciones,
      periodoKey,
      undefined,
      {
        id: empresa?.id || 'empresa_activa',
        nombre: empresa?.razonSocial || 'Mi Empresa S.A.',
        ruc: `${empresa?.ruc || '80000000'}${empresa?.dv ? `-${empresa.dv}` : '-1'}`,
      },
    );

    const res = cerrarPeriodoContable(
      empresa?.id || '',
      periodoId,
      totales,
      asiento,
      'RRHH / Administración',
    );
    alert(res.mensaje);
    if (res.exito) {
      setReloadTrigger((v) => v + 1);
    }
  };

  const handleReabrirPeriodo = (periodoId: string) => {
    const confirmado = window.confirm(
      `¿Desea reabrir el período ${periodoId} para permitir correcciones?`,
    );
    if (!confirmado) return;

    const res = reabrirPeriodoContable(empresa?.id || '', periodoId);
    alert(res.mensaje);
    if (res.exito) {
      setReloadTrigger((v) => v + 1);
    }
  };

  // Condición fiscal de la empresa: si no es Agente de Retención, no se retiene IVA a facturadores.
  const esAgenteRetentor = useMemo(
    () => (empresa ? (getEmpresaById(empresa.id)?.esAgenteRetentor ?? true) : true),
    [empresa],
  );

  // Liquidación GUARDADA del período (misma clave empresa+período que la planilla editable).
  const guardada = useMemo(
    () => loadNominaPeriodo(empresa?.id || '', periodoKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empresa, periodoKey],
  );
  const empleados = useMemo(() => guardada?.empleados ?? [], [guardada]);

  const { liquidaciones, totales } = useMemo(
    () => calcularNominaMasiva(empleados, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor),
    [empleados, esAgenteRetentor],
  );

  // Período anterior: mes-1, con enero → diciembre del año anterior.
  const periodoAnterior = useMemo(() => {
    const mesAnt = periodo.mes === 1 ? 12 : periodo.mes - 1;
    const anhoAnt = periodo.mes === 1 ? periodo.anho - 1 : periodo.anho;
    return `${anhoAnt}-${String(mesAnt).padStart(2, '0')}`;
  }, [periodo]);

  // Lectura directa en render de la liquidación del mes anterior (puede no existir).
  const ant = loadNominaPeriodo(empresa?.id || '', periodoAnterior);
  const totAnt = ant
    ? calcularNominaMasiva(ant.empleados, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor).totales
    : null;

  // ── KPIs derivados ──
  const headcount = totales.cantidadEmpleados;
  const cantIPS = useMemo(
    () => empleados.filter((e) => e.tipo === 'cotizante_ips').length,
    [empleados],
  );
  const cantFactura = useMemo(
    () => empleados.filter((e) => e.tipo === 'factura').length,
    [empleados],
  );
  const provisionAguinaldo = useMemo(
    () => liquidaciones.reduce((acc, l) => acc + l.provisionAguinaldoMensual, 0),
    [liquidaciones],
  );
  const costoEmpresa = totales.totalNeto + totales.totalIpsPatronal + totales.totalRetencionIva;
  const ticketPromedio = headcount > 0 ? totales.totalNeto / headcount : 0;

  // ── D1 · Composición del bruto (segmentos apilados) ──
  const composicion = useMemo(() => {
    const totalBruto = totales.totalBruto > 0 ? totales.totalBruto : 0;
    const items = [
      { label: 'Neto a desembolsar', valor: totales.totalNeto, color: '#047857' },
      { label: 'IPS obrero 9%', valor: totales.totalIpsObrero, color: '#2563eb' },
      { label: 'Retención IVA', valor: totales.totalRetencionIva, color: '#d97706' },
      {
        label: 'Otros descuentos',
        valor: totales.totalDescuentos - totales.totalIpsObrero,
        color: '#dc2626',
      },
    ];
    return items.map((it) => ({
      ...it,
      pct: totalBruto > 0 ? Math.max(0, (it.valor / totalBruto) * 100) : 0,
    }));
  }, [totales]);

  // ── D1 · Bruto por régimen (IPS vs Factura) ──
  const regimen = useMemo(() => {
    let brutoIps = 0;
    let brutoFactura = 0;
    liquidaciones.forEach((l, i) => {
      const tipo = (empleados[i] ?? l.input).tipo;
      if (tipo === 'factura') {
        brutoFactura += l.haberes.totalHaberesBrutos;
      } else {
        brutoIps += l.haberes.totalHaberesBrutos;
      }
    });
    const total = brutoIps + brutoFactura;
    return [
      { label: 'Cotizantes IPS', valor: brutoIps, color: '#2563eb', pct: total > 0 ? (brutoIps / total) * 100 : 0 },
      { label: 'Prestadores Factura', valor: brutoFactura, color: '#d97706', pct: total > 0 ? (brutoFactura / total) * 100 : 0 },
    ];
  }, [liquidaciones, empleados]);

  // ── D1 · Comparativa contra el mes anterior ──
  const filasComparativas = [
    { label: 'Masa Bruta', actual: totales.totalBruto, anterior: totAnt ? totAnt.totalBruto : null, moneda: true },
    { label: 'Total Descuentos', actual: totales.totalDescuentos, anterior: totAnt ? totAnt.totalDescuentos : null, moneda: true },
    { label: 'Neto a Desembolsar', actual: totales.totalNeto, anterior: totAnt ? totAnt.totalNeto : null, moneda: true },
    { label: 'Aporte Patronal IPS', actual: totales.totalIpsPatronal, anterior: totAnt ? totAnt.totalIpsPatronal : null, moneda: true },
    { label: 'Headcount', actual: totales.cantidadEmpleados, anterior: totAnt ? totAnt.cantidadEmpleados : null, moneda: false },
  ];

  // ── D2 · Auditoría pre-cierre ──
  const alertas = useMemo(
    () => auditarNomina(empleados, liquidaciones, esAgenteRetentor, SALARIO_MINIMO_LEGAL_VIGENTE),
    [empleados, liquidaciones, esAgenteRetentor],
  );
  const cantCriticos = alertas.filter((a) => a.nivel === 'critico').length;
  const cantAdvertencias = alertas.filter((a) => a.nivel === 'advertencia').length;
  const banner = calcularBanner(empleados.length > 0, cantCriticos, cantAdvertencias);

  const tieneDatos = empleados.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Barra Ejecutiva de Control de Períodos y Cierres (MEN 08, MEN 07, etc.) ── */}
      <PayrollPeriodManagerBar
        empresaId={empresa?.id || ''}
        periodos={periodos}
        periodoSeleccionadoId={periodoKey}
        onSeleccionarPeriodo={handleSeleccionarPeriodo}
        onCrearPeriodo={handleCrearPeriodo}
        onReplicarPeriodo={handleReplicarPeriodo}
        onCerrarPeriodo={handleCerrarPeriodo}
        onReabrirPeriodo={handleReabrirPeriodo}
        onAbrirModalNovedades={() => setMostrarModalNovedades(true)}
      />

      {/* Modal de Novedades y Cola de Embargos */}
      <PayrollNoveltiesModal
        isOpen={mostrarModalNovedades}
        onClose={() => setMostrarModalNovedades(false)}
        empresaId={empresa?.id || ''}
        empleados={empleados}
        periodoId={periodoKey}
        onNovedadesActualizadas={() => setReloadTrigger((v) => v + 1)}
      />

      {/* ══════════════ D1 · TABLERO DE CIERRE ══════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          📊 Tablero de Cierre Mensual
        </h3>

        {!tieneDatos ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '30px', marginBottom: '8px' }}>🗂️</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Sin liquidación guardada para {tituloPeriodo}.
            </div>
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              Cargá la 📗 Planilla Editable y usá Guardar Periodo.
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Masa Bruta', valor: formatGuaranies(totales.totalBruto), sub: `${headcount} funcionario(s)` },
                { label: 'Total Descuentos', valor: formatGuaranies(totales.totalDescuentos), sub: 'IPS + anticipos + deducciones' },
                { label: 'Neto a Desembolsar', valor: formatGuaranies(totales.totalNeto), sub: 'Total a pagar', hero: true },
                { label: 'Costo Total Empresa', valor: formatGuaranies(costoEmpresa), sub: 'Neto + patronal + ret. IVA' },
                { label: 'IPS Patronal 16.5%', valor: formatGuaranies(totales.totalIpsPatronal), sub: 'Carga social empresa' },
                { label: 'Retención IVA', valor: formatGuaranies(totales.totalRetencionIva), sub: 'Facturadores retenidos' },
                { label: 'Provisión Aguinaldo', valor: formatGuaranies(provisionAguinaldo), sub: '1/12 de haberes' },
                { label: 'Headcount', valor: `${headcount}`, sub: `IPS ${cantIPS} · Fac ${cantFactura}` },
                { label: 'Ticket Promedio', valor: formatGuaranies(ticketPromedio), sub: 'Neto por funcionario' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={
                    kpi.hero
                      ? {
                          ...kpiBase,
                          backgroundColor: '#064e3b',
                          border: '1px solid #065f46',
                          color: '#ffffff',
                          boxShadow: '0 4px 12px rgba(6, 78, 59, 0.2)',
                        }
                      : kpiBase
                  }
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: kpi.hero ? 'rgba(255,255,255,0.9)' : '#64748b',
                    }}
                  >
                    {kpi.label}
                  </div>
                  <div
                    style={{
                      fontSize: kpi.hero ? '20px' : '18px',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      marginTop: '4px',
                      color: kpi.hero ? '#ffffff' : '#0f172a',
                    }}
                  >
                    {kpi.valor}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      marginTop: '2px',
                      color: kpi.hero ? 'rgba(255,255,255,0.8)' : '#64748b',
                    }}
                  >
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparativa vs mes anterior */}
            <div style={cardStyle}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                Comparativa vs mes anterior ({periodoAnterior})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Concepto</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Anterior</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Δ Gs</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Δ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasComparativas.map((f, idx) => {
                      const delta = f.anterior === null ? null : f.actual - f.anterior;
                      const pct =
                        f.anterior !== null && f.anterior !== 0 && delta !== null
                          ? (delta / f.anterior) * 100
                          : null;
                      const colorDelta =
                        delta === null ? '#94a3b8' : delta > 0 ? '#047857' : delta < 0 ? '#dc2626' : '#64748b';
                      return (
                        <tr key={f.label} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#334155' }}>{f.label}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                            {f.anterior === null ? '—' : f.moneda ? formatGuaranies(f.anterior) : f.anterior}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                            {f.moneda ? formatGuaranies(f.actual) : f.actual}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: colorDelta }}>
                            {delta === null ? '—' : `${delta > 0 ? '+' : ''}${f.moneda ? formatGuaranies(delta) : delta}`}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: colorDelta }}>
                            {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Barras CSS: composición + régimen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                  Composición del bruto
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: '22px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                  }}
                >
                  {composicion.map((seg) => (
                    <div
                      key={seg.label}
                      title={`${seg.label}: ${formatGuaranies(seg.valor)} (${seg.pct.toFixed(1)}%)`}
                      style={{ width: `${seg.pct}%`, backgroundColor: seg.color, transition: 'width 0.2s ease' }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px' }}>
                  {composicion.map((seg) => (
                    <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: seg.color }} />
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {seg.label}: <strong style={{ fontFamily: 'monospace' }}>{formatGuaranies(seg.valor)}</strong>{' '}
                        ({seg.pct.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
                  Régimen
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: '22px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f1f5f9',
                  }}
                >
                  {regimen.map((seg) => (
                    <div
                      key={seg.label}
                      title={`${seg.label}: ${formatGuaranies(seg.valor)} (${seg.pct.toFixed(1)}%)`}
                      style={{ width: `${seg.pct}%`, backgroundColor: seg.color, transition: 'width 0.2s ease' }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px' }}>
                  {regimen.map((seg) => (
                    <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: seg.color }} />
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {seg.label}: <strong style={{ fontFamily: 'monospace' }}>{formatGuaranies(seg.valor)}</strong>{' '}
                        ({seg.pct.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Paquete de cierre */}
            <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginRight: '6px' }}>
                Paquete de cierre:
              </span>
              <button
                onClick={() => exportNominaCSV(empleados, liquidaciones, periodoKey)}
                style={{ ...btnStyle, backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #1d4ed8' }}
              >
                📥 Exportar Nómina (CSV)
              </button>
              <button onClick={() => exportBankCSV(liquidaciones)} style={btnStyle}>
                🏦 Archivo Bancario (CSV)
              </button>
            </div>

            {/* Asiento Contable General Consolidado (Odoo, SAP, Universal) */}
            <AccountingEntryCard
              totales={totales}
              liquidaciones={liquidaciones}
              periodoKey={periodoKey}
              empresaMetadata={{
                id: empresa?.id || 'empresa_activa',
                nombre: empresa?.razonSocial || 'Mi Empresa S.A.',
                ruc: `${empresa?.ruc || '80000000'}${empresa?.dv ? `-${empresa.dv}` : '-1'}`,
              }}
            />
          </>
        )}
      </div>

      {/* ══════════════ D2 · AUDITORÍA PRE-CIERRE ══════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
          🛡️ Auditoría pre-cierre
        </h3>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '14px',
            backgroundColor: banner.bg,
            color: banner.color,
            border: `1px solid ${banner.border}`,
          }}
        >
          {banner.texto}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              style={{
                borderRadius: '10px',
                border: `1px solid ${bordeNivel[alerta.nivel]}`,
                borderLeft: `5px solid ${bordeNivel[alerta.nivel]}`,
                backgroundColor: bgNivel[alerta.nivel],
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>
                  {iconoNivel[alerta.nivel]} {alerta.titulo}
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    color: '#ffffff',
                    backgroundColor: bordeNivel[alerta.nivel],
                  }}
                >
                  {alerta.nivel}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '6px' }}>{alerta.detalle}</div>

              {alerta.empleados.length > 0 && (
                <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {alerta.empleados.map((emp, idx) => (
                    <li key={`${alerta.id}-${emp.ci}-${idx}`} style={{ fontSize: '12.5px', color: '#334155' }}>
                      {emp.nombre} ({emp.ci}) — <strong style={{ fontFamily: 'monospace' }}>{emp.valor}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
