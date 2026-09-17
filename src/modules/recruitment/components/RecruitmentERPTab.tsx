/**
 * PESTAÑA ERP: BANCO DE TALENTOS & SELECCIÓN DE PERSONAL — LABORAPY
 * Gestión de candidatos, filtros por área y armado de ternas
 * Versión: PY-REC-ERP-2026.09.16
 */

import React, { useState, useMemo } from 'react';
import type { EmpresaCliente } from '../../clientPortal/types/clientPortal';
import { getStoredPostulantes, updatePostulanteEstado } from '../services/recruitmentService';
import type { EstadoPostulacion } from '../types';

interface Props {
  empresa: EmpresaCliente;
}

export const RecruitmentERPTab: React.FC<Props> = ({ empresa }) => {
  const [postulantes, setPostulantes] = useState(() => getStoredPostulantes());
  const [filtroArea, setFiltroArea] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');

  const candidatosFiltrados = useMemo(() => {
    return postulantes.filter((p) => {
      const matchArea = filtroArea === 'todas' || p.areaInteres === filtroArea;
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      const q = busqueda.toLowerCase().trim();
      const matchText =
        !q ||
        p.nombres.toLowerCase().includes(q) ||
        p.apellidos.toLowerCase().includes(q) ||
        p.cargoPostulado.toLowerCase().includes(q) ||
        p.ciudad.toLowerCase().includes(q);
      return matchArea && matchEstado && matchText;
    });
  }, [postulantes, filtroArea, filtroEstado, busqueda]);

  const handleCambiarEstado = (id: string, nuevoEstado: EstadoPostulacion) => {
    updatePostulanteEstado(id, nuevoEstado);
    setPostulantes(getStoredPostulantes());
  };

  return (
    <div style={{ padding: '20px 24px', color: '#f8fafc' }}>
      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span> Reclutamiento & Banco de Talentos LaboraPy
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
            Base de postulantes calificados en Paraguay para cobertura de vacantes operativas y profesionales.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>
            {candidatosFiltrados.length} candidatos en base
          </div>
        </div>
      </div>

      {/* ── Filtros y Buscador ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por candidato, cargo o ciudad..."
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
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: 13,
          }}
        >
          <option value="todas">Todas las áreas</option>
          <option value="administrativo">Administración & Contabilidad</option>
          <option value="operativo">Operativo & Logística</option>
          <option value="comercial">Comercial & Ventas</option>
          <option value="mandos_medios">Mandos Medios</option>
          <option value="profesional">Profesional</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: 13,
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="nuevo">Nuevo</option>
          <option value="en_revision">En Revisión</option>
          <option value="entrevista">Terna / Entrevista</option>
          <option value="seleccionado">Seleccionado</option>
          <option value="descartado">Descartado</option>
        </select>
      </div>

      {/* ── Lista de Candidatos ── */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #334155', fontWeight: 600, fontSize: 13 }}>
          Candidatos Postulados ({candidatosFiltrados.length})
        </div>

        {candidatosFiltrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            <span style={{ fontSize: 24 }}>📋</span>
            <p style={{ margin: '8px 0 0 0', fontSize: 14 }}>
              No hay postulantes registrados con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {candidatosFiltrados.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14, color: '#ffffff' }}>
                      {c.nombres} {c.apellidos}
                    </strong>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>(CI: {c.ci})</span>
                    <span
                      style={{
                        background:
                          c.estado === 'nuevo'
                            ? 'rgba(56, 189, 248, 0.2)'
                            : c.estado === 'entrevista'
                            ? 'rgba(234, 179, 8, 0.2)'
                            : c.estado === 'seleccionado'
                            ? 'rgba(34, 197, 94, 0.2)'
                            : 'rgba(148, 163, 184, 0.2)',
                        color:
                          c.estado === 'nuevo'
                            ? '#38bdf8'
                            : c.estado === 'entrevista'
                            ? '#facc15'
                            : c.estado === 'seleccionado'
                            ? '#4ade80'
                            : '#94a3b8',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.estado}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
                    Puesto: <strong style={{ color: '#38bdf8' }}>{c.cargoPostulado}</strong> · Ciudad: {c.ciudad} · Exp: {c.experienciaAnios} años
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Pretensión: Gs. {c.pretensionSalarialPYG.toLocaleString('es-PY')} · Contacto: {c.telefono} ({c.email})
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={c.estado}
                    onChange={(e) => handleCambiarEstado(c.id, e.target.value as EstadoPostulacion)}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: '#ffffff',
                      fontSize: 12,
                    }}
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="en_revision">En Revisión</option>
                    <option value="entrevista">Terna / Entrevista</option>
                    <option value="seleccionado">Seleccionado</option>
                    <option value="descartado">Descartado</option>
                  </select>

                  <button
                    onClick={() => {
                      const msg = `Hola ${c.nombres}, te contactamos desde ${empresa.razonSocial} a través del portal LaboraPy respecto a tu postulación para ${c.cargoPostulado}.`;
                      window.open(`https://wa.me/595${c.telefono.replace(/\D+/g, '').replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
