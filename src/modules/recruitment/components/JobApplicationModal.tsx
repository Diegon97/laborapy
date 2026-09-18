/**
 * MODAL DE POSTULACIÓN LABORAL & BANCO DE TALENTOS — LABORAPY
 * Formulario público para trabajadores y profesionales de Paraguay
 * Versión: PY-REC-MODAL-2026.09.16
 */

import React, { useState } from 'react';
import { CIUDADES_PARAGUAY } from '../constants';
import { savePostulante } from '../services/recruitmentService';
import type { AreaInteresLaboral, DisponibilidadLaboral, Postulante } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPostulacionExitosa?: (postulante: Postulante) => void;
}

export const JobApplicationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPostulacionExitosa,
}) => {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [ci, setCi] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState<string>(CIUDADES_PARAGUAY[0]);
  const [departamento] = useState('Central');
  const [areaInteres, setAreaInteres] = useState<AreaInteresLaboral>('administrativo');
  const [cargoPostulado, setCargoPostulado] = useState('');
  const [nivelEstudios] = useState('Universitario en curso');
  const [experienciaAnios, setExperienciaAnios] = useState<number>(1);
  const [pretensionSalarialPYG, setPretensionSalarialPYG] = useState<number>(3_000_000);
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadLaboral>('inmediata');
  const [cvNombre, setCvNombre] = useState<string>('');

  const [enviado, setEnviado] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCvNombre(file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nuevo = savePostulante({
      nombres,
      apellidos,
      ci,
      email,
      telefono,
      ciudad,
      departamento,
      cargoPostulado: cargoPostulado || 'Postulación General / Banco de Talentos',
      areaInteres,
      nivelEstudios,
      experienciaAnios,
      pretensionSalarialPYG,
      disponibilidad,
      cvNombre,
    });

    setEnviado(true);
    if (onPostulacionExitosa) {
      onPostulacionExitosa(nuevo);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          maxWidth: 780,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#f8fafc',
        }}
      >
        {/* ── Encabezado ── */}
        <header
          style={{
            padding: '16px 24px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Oportunidades Laborales Paraguay
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ffffff' }}>
              {enviado ? '¡Postulación Recibida!' : 'Postulación al Banco de Talentos LaboraPy'}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </header>

        {/* ── Cuerpo ── */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <span style={{ fontSize: 48 }}>✅</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '12px 0 6px 0', color: '#ffffff' }}>
                ¡Muchas gracias, {nombres}!
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 480, margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                Tu perfil y CV han sido ingresados con éxito a la base de datos confidencial de LaboraPy. Nuestro equipo de selección te contactará vía WhatsApp cuando surjan vacantes acordes a tu perfil.
              </p>
              <button
                onClick={onClose}
                style={{
                  background: '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Nombres *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Belén"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Gómez Silva"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    C.I. N.º *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="4.123.456"
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    WhatsApp / Celular *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0981 111 222"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="maria@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Ciudad de Residencia *
                  </label>
                  <select
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  >
                    {CIUDADES_PARAGUAY.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Área de Interés *
                  </label>
                  <select
                    value={areaInteres}
                    onChange={(e) => setAreaInteres(e.target.value as AreaInteresLaboral)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  >
                    <option value="administrativo">Administración & Contabilidad</option>
                    <option value="operativo">Operativo & Logística / Chofer</option>
                    <option value="comercial">Comercial & Ventas / Atención</option>
                    <option value="mandos_medios">Supervisión / Mandos Medios</option>
                    <option value="profesional">Profesional / Mandos Ejecutivos</option>
                    <option value="tecnico">Técnico / TI / Oficios</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Cargo o Puesto Deseado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Auxiliar Contable / Chofer Repartidor"
                    value={cargoPostulado}
                    onChange={(e) => setCargoPostulado(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Pretensión Salarial (PYG mensual) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={pretensionSalarialPYG}
                    onChange={(e) => setPretensionSalarialPYG(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Años de Experiencia Laboral
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={experienciaAnios}
                    onChange={(e) => setExperienciaAnios(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Disponibilidad para Incorporación
                  </label>
                  <select
                    value={disponibilidad}
                    onChange={(e) => setDisponibilidad(e.target.value as DisponibilidadLaboral)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: 13,
                    }}
                  >
                    <option value="inmediata">Inmediata</option>
                    <option value="15_dias">15 días de aviso</option>
                    <option value="1_mes">1 mes</option>
                  </select>
                </div>
              </div>

              {/* Adjunto CV */}
              <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px dashed #475569', marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', display: 'block', marginBottom: 4 }}>
                  📄 Adjuntar Curriculum Vitae (PDF o Word)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  style={{ fontSize: 12, color: '#94a3b8' }}
                />
                {cvNombre && (
                  <span style={{ fontSize: 12, color: '#38bdf8', display: 'block', marginTop: 4 }}>
                    ✓ Archivo seleccionado: {cvNombre}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 24px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Enviar Postulación ➔
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
