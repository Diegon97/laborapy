/**
 * PESTAÑA DEL ERP: AUDITORÍA PATRONAL PRE-MTESS & SCANNER DE CONTINGENCIAS
 * LaboraPy — Soluciones Laborales y Contables de Paraguay
 * Versión: PY-AUD-TAB-2026.09.16
 */

import React, { useState, useMemo } from 'react';
import type { EmpresaCliente } from '../types/clientPortal';
import { getEmpleadosByCliente, getContratosByCliente, getRegistrosMaternidadByCliente } from '../services/clientStorageService';
import { auditarNominaPatronal, generarDictamenAuditoriaPdf } from '../../audit';
import { createWhatsAppUrl } from '../../../config/laborapy';

interface Props {
  empresa: EmpresaCliente;
}

export const PreMtessAuditTab: React.FC<Props> = ({ empresa }) => {
  const [filtroSeveridad, setFiltroSeveridad] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');

  const empleados = useMemo(() => getEmpleadosByCliente(empresa.id), [empresa.id]);
  const contratos = useMemo(() => getContratosByCliente(empresa.id), [empresa.id]);
  const registrosMaternidad = useMemo(() => getRegistrosMaternidadByCliente(empresa.id), [empresa.id]);

  const resultadoAuditoria = useMemo(() => {
    return auditarNominaPatronal({
      empresa,
      empleados,
      contratos,
      registrosMaternidad,
    });
  }, [empresa, empleados, contratos, registrosMaternidad]);

  const hallazgosFiltrados = useMemo(() => {
    return resultadoAuditoria.hallazgos.filter((h) => {
      const matchSev = filtroSeveridad === 'todas' || h.severidad === filtroSeveridad;
      const q = busqueda.toLowerCase().trim();
      const matchText =
        !q ||
        h.empleadoNombre.toLowerCase().includes(q) ||
        h.ci.toLowerCase().includes(q) ||
        h.titulo.toLowerCase().includes(q) ||
        h.descripcion.toLowerCase().includes(q);
      return matchSev && matchText;
    });
  }, [resultadoAuditoria.hallazgos, filtroSeveridad, busqueda]);

  const handleDescargarPdf = () => {
    const doc = generarDictamenAuditoriaPdf(resultadoAuditoria);
    const filename = `Dictamen_Auditoria_PreMTESS_${empresa.ruc || 'Empresa'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const handleSolicitarBlindajeWA = () => {
    const msg = `Hola LaboraPy, acabamos de ejecutar la Auditoría Pre-MTESS para ${empresa.razonSocial} (RUC ${empresa.ruc}) y obtuvimos un Score de ${resultadoAuditoria.resumen.scoreCumplimiento}/100 con ${resultadoAuditoria.resumen.totalHallazgos} contingencias detectadas. Quisiera solicitar asesoría para blindar la empresa.`;
    const url = createWhatsAppUrl(msg);
    window.open(url, '_blank');
  };

  const semaforo = resultadoAuditoria.resumen.semaforo;

  return (
    <div style={{ padding: '20px 24px', color: '#f8fafc' }}>
      {/* ── Encabezado Principal ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛡️</span> Auditoría Patronal Pre-MTESS & Scanner Laboral
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
            Diagnóstico preventivo de riesgos ante inspecciones del MTESS, evasión de IPS y contingencias salariales.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleDescargarPdf}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📄</span> Descargar Dictamen PDF
          </button>
          <button
            onClick={handleSolicitarBlindajeWA}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💬</span> Asesoría de Blindaje
          </button>
        </div>
      </div>

      {/* ── Panel de Semáforo y Métricas Clave ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {/* Tarjeta de Riesgo Global */}
        <div
          style={{
            background: '#1e293b',
            border: `1px solid ${semaforo.colorHex}`,
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>NIVEL DE RIESGO GLOBAL</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: semaforo.colorHex, marginTop: 4 }}>
            {semaforo.etiqueta}
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
            {semaforo.descripcion}
          </div>
        </div>

        {/* Score de Cumplimiento */}
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>SCORE DE SALUD LABORAL</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {resultadoAuditoria.resumen.scoreCumplimiento} / 100
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {resultadoAuditoria.resumen.totalEmpleados} empleados evaluados ({resultadoAuditoria.resumen.empleadosConHallazgos} con observaciones)
          </div>
        </div>

        {/* Multas Estimadas */}
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>MULTAS MTESS ESTIMADAS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
            Gs. {Math.round(resultadoAuditoria.resumen.multaTotalEstimadaPYG).toLocaleString('es-PY')}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Calculado en base a {resultadoAuditoria.hallazgos.reduce((s, h) => s + h.jornalesMulta, 0)} jornales mínimos legales
          </div>
        </div>

        {/* Distribución de Severidades */}
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>DESGLOSE DE CONTINGENCIAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#f87171' }}>🔴 Críticos:</span>
              <span style={{ fontWeight: 700 }}>{resultadoAuditoria.resumen.criticos}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fbbf24' }}>🟠 Altos:</span>
              <span style={{ fontWeight: 700 }}>{resultadoAuditoria.resumen.altos}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fde047' }}>🟡 Medios:</span>
              <span style={{ fontWeight: 700 }}>{resultadoAuditoria.resumen.medios}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtros y Búsqueda ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por empleado, CI o contingencia..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: 13,
          }}
        />
        <select
          value={filtroSeveridad}
          onChange={(e) => setFiltroSeveridad(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: 13,
          }}
        >
          <option value="todas">Todas las severidades</option>
          <option value="critico">Solo Críticos</option>
          <option value="alto">Solo Altos</option>
          <option value="medio">Solo Medios</option>
          <option value="bajo">Solo Bajos</option>
        </select>
      </div>

      {/* ── Lista de Hallazgos ── */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #334155', fontWeight: 600, fontSize: 13 }}>
          Contingencias Detectadas ({hallazgosFiltrados.length})
        </div>

        {hallazgosFiltrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            <span style={{ fontSize: 24 }}>✅</span>
            <p style={{ margin: '8px 0 0 0', fontSize: 14 }}>
              {resultadoAuditoria.hallazgos.length === 0
                ? '¡Excelente! No se detectaron contingencias laborales en la nómina actual.'
                : 'No se encontraron hallazgos con el filtro seleccionado.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {hallazgosFiltrados.map((h) => {
              const badgeBg =
                h.severidad === 'critico'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : h.severidad === 'alto'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : h.severidad === 'medio'
                  ? 'rgba(234, 179, 8, 0.2)'
                  : 'rgba(34, 197, 94, 0.2)';
              const badgeColor =
                h.severidad === 'critico'
                  ? '#f87171'
                  : h.severidad === 'alto'
                  ? '#fbbf24'
                  : h.severidad === 'medio'
                  ? '#fde047'
                  : '#4ade80';

              return (
                <div
                  key={h.id}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: badgeBg,
                            color: badgeColor,
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {h.severidad}
                        </span>
                        <strong style={{ fontSize: 14, color: '#ffffff' }}>{h.titulo}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        Trabajador: <strong style={{ color: '#e2e8f0' }}>{h.empleadoNombre}</strong> (CI: {h.ci} · {h.cargo})
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Multa Estimada:</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
                        Gs. {Math.round(h.multaEstimadaPYG).toLocaleString('es-PY')}
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#cbd5e1' }}>
                    {h.descripcion}
                  </p>

                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                    Base legal: {h.baseLegal}
                  </div>

                  <div
                    style={{
                      background: '#0f172a',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: '#38bdf8',
                      marginTop: 4,
                    }}
                  >
                    <strong>💡 Recomendación:</strong> {h.recomendacion}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Plan de Mitigación en Fases ── */}
      <div style={{ marginTop: 24, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>
          📋 Plan de Mitigación Recomendado (Blindaje en 3 Fases)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {resultadoAuditoria.planMitigacion.map((fase) => (
            <div
              key={fase.fase}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                FASE {fase.fase} · PLAZO: {fase.plazoDias} DÍAS
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', margin: '4px 0 8px 0' }}>
                {fase.titulo}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8' }}>
                {fase.acciones.map((acc, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {acc}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
