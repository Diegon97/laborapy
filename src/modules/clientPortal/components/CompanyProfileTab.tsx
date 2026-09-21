/**
 * PESTAÑA: DATOS DE LA EMPRESA (PORTAL DE CLIENTES - ERP LABORAPY)
 * Gestión y actualización formal de datos corporativos, tributarios, patronales y legales:
 * RUC, DV oficial DNIT, Razón Social, Domicilio Fiscal, Representante Legal,
 * Nº Patronal IPS (formato PRN 10 dígitos) y Patronales MTESS (multisucursal).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DEPARTAMENTOS_PARAGUAY,
  type EmpresaCliente,
  type PatronalMtessSucursal,
} from '../types/clientPortal';
import { generarContratoMaestroDesdeEmpresa } from '../generators/masterServiceContractPdfGenerator';

export interface CompanyProfileTabProps {
  empresa: EmpresaCliente;
  onEmpresaUpdated?: (empresa: EmpresaCliente) => void;
}

/**
 * Calcula el Dígito Verificador (DV) oficial para RUC paraguayo (DNIT / SET).
 * Aplica algoritmo de módulo 11 con factores ponderados [2, 3, 4, 5, 6, 7, 8, 9] de derecha a izquierda.
 * Regla oficial: Si resto > 1 => DV = 11 - resto, sino (resto 0 o 1) => DV = 0.
 */
export function calcularDV(ruc: string): string {
  const digits = String(ruc || '').replace(/\D/g, '');
  if (!digits) return '';
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let suma = 0;
  for (let i = digits.length - 1, k = 0; i >= 0; i--, k++) {
    suma += parseInt(digits[i], 10) * pesos[k % pesos.length];
  }
  const resto = suma % 11;
  const dv = resto > 1 ? 11 - resto : 0;
  return String(dv);
}

/**
 * Normaliza el número patronal IPS a 10 dígitos con ceros a la izquierda,
 * requerido para el formato de 109 columnas del archivo plano .PRN de IPS.
 * Ej: '1234567' -> '0001234567'
 */
export function formatearPatronalIps(nro: string | undefined): string {
  const digits = String(nro || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(10, '0').slice(-10);
}

interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
}

// Estilos base reutilizables
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const sectionCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: '15px',
  fontWeight: 700,
  color: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

export const CompanyProfileTab: React.FC<CompanyProfileTabProps> = ({
  empresa,
  onEmpresaUpdated,
}) => {
  const [form, setForm] = useState<EmpresaCliente>(() => ({
    ...empresa,
    // undefined (legacy) se trata como true: mantiene el comportamiento previo.
    esAgenteRetentor: empresa.esAgenteRetentor ?? true,
    patronalesMtessSecundarias: empresa.patronalesMtessSecundarias
      ? empresa.patronalesMtessSecundarias.map(s => ({ ...s }))
      : [],
  }));

  const [dvManual, setDvManual] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // Sincronizar si cambia el ID de empresa activa en el ERP (multi-empresa)
  useEffect(() => {
    setForm({
      ...empresa,
      esAgenteRetentor: empresa.esAgenteRetentor ?? true,
      patronalesMtessSecundarias: empresa.patronalesMtessSecundarias
        ? empresa.patronalesMtessSecundarias.map(s => ({ ...s }))
        : [],
    });
  }, [empresa.id]);

  // Limpiar timer de feedback al desmontar
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const showFeedback = (tipo: 'ok' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      savedTimerRef.current = null;
    }, 4500);
  };

  const updateField = <K extends keyof EmpresaCliente>(key: K, value: EmpresaCliente[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleRucChange = (raw: string) => {
    const limpio = raw.replace(/\D/g, '').slice(0, 8);
    setForm(prev => {
      const updated = { ...prev, ruc: limpio };
      if (!dvManual) {
        updated.dv = calcularDV(limpio);
      }
      return updated;
    });
  };

  const handleRecalcularDvAuto = () => {
    setDvManual(false);
    updateField('dv', calcularDV(form.ruc));
  };

  /* ── Gestión de Sucursales MTESS ── */
  const agregarSucursal = () => {
    const nueva: PatronalMtessSucursal = {
      id: `suc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nroPatronalMtess: '',
      sucursalNombre: '',
      ciudad: '',
      esPrincipal: false,
      usarIpsPrincipal: true,
      nroPatronalIps: '',
      departamento: 'Central',
      direccion: '',
    };
    setForm(prev => ({
      ...prev,
      patronalesMtessSecundarias: [...(prev.patronalesMtessSecundarias || []), nueva],
    }));
  };

  const actualizarSucursal = (id: string, patch: Partial<PatronalMtessSucursal>) => {
    setForm(prev => {
      let sucursales = prev.patronalesMtessSecundarias || [];
      if (patch.esPrincipal) {
        // Exclusividad: si se marca como principal, desmarcar las demás
        sucursales = sucursales.map(s => ({ ...s, esPrincipal: false }));
      }
      return {
        ...prev,
        patronalesMtessSecundarias: sucursales.map(s => (s.id === id ? { ...s, ...patch } : s)),
      };
    });
  };

  const eliminarSucursal = (id: string) => {
    setForm(prev => ({
      ...prev,
      patronalesMtessSecundarias: (prev.patronalesMtessSecundarias || []).filter(s => s.id !== id),
    }));
  };

  /* ── Checklist de Integridad Documental ── */
  const checklist: ChecklistItem[] = useMemo(() => {
    const rucClean = (form.ruc || '').replace(/\D/g, '');
    const ipsClean = (form.nroPatronalIps || '').replace(/\D/g, '');
    return [
      {
        key: 'ruc',
        label: 'RUC y DV válidos',
        ok: rucClean.length >= 6 && /^\d$/.test(form.dv || ''),
        hint: 'Obligatorio en Recibos, Libros y Contratos',
      },
      {
        key: 'razonSocial',
        label: 'Razón Social',
        ok: (form.razonSocial || '').trim().length >= 3,
        hint: 'Nombre legal de la entidad empleadora',
      },
      {
        key: 'direccion',
        label: 'Dirección Fiscal',
        ok: (form.direccion || '').trim().length >= 5,
        hint: 'Domicilio laboral ante MTESS e IPS',
      },
      {
        key: 'contacto',
        label: 'Teléfono y Email',
        ok: (form.telefono || '').trim().length >= 6 && /@/.test(form.emailCorporativo || ''),
        hint: 'Canal corporativo oficial para notificaciones',
      },
      {
        key: 'repLegal',
        label: 'Representante Legal',
        ok: (form.representanteLegalNombre || '').trim().length >= 3 && (form.representanteLegalCi || '').trim().length >= 4,
        hint: 'Firma contratos y comparece ante MTESS',
      },
      {
        key: 'ips',
        label: 'N° Patronal IPS',
        ok: ipsClean.length >= 6 && ipsClean.length <= 10,
        hint: 'Se formatea a 10 dígitos para el archivo .PRN',
      },
      {
        key: 'mtess',
        label: 'N° Patronal MTESS',
        ok: (form.nroPatronalMtess || '').trim().length >= 4,
        hint: 'Exigido en Libros Laborales y Planillas REOP',
      },
    ];
  }, [form]);

  const totalOk = checklist.filter(c => c.ok).length;
  const porcentaje = Math.round((totalOk / checklist.length) * 100);

  /* ── Guardar Datos ── */
  const handleGuardar = () => {
    const rucClean = (form.ruc || '').replace(/\D/g, '');
    if (rucClean.length < 6) {
      showFeedback('error', 'El RUC debe contener al menos 6 dígitos numéricos.');
      return;
    }

    const dvEsperado = calcularDV(rucClean);
    const dvFinal = form.dv ? form.dv.replace(/\D/g, '').slice(0, 1) : dvEsperado;
    if (!/^\d$/.test(dvFinal)) {
      showFeedback('error', 'El Dígito Verificador (DV) debe ser un único dígito numérico (0-9).');
      return;
    }

    if (!(form.razonSocial || '').trim()) {
      showFeedback('error', 'La Razón Social de la empresa es obligatoria.');
      return;
    }

    if (!(form.representanteLegalNombre || '').trim()) {
      showFeedback('error', 'El nombre del Representante Legal es obligatorio.');
      return;
    }

    // Limpieza de sucursales incompletas y normalización
    const sucursalesLimpias = (form.patronalesMtessSecundarias || []).filter(
      s => s.nroPatronalMtess.trim() !== '' || s.sucursalNombre.trim() !== '' || s.ciudad.trim() !== ''
    ).map(s => ({
      ...s,
      nroPatronalIps: s.usarIpsPrincipal !== false ? undefined : (s.nroPatronalIps ? formatearPatronalIps(s.nroPatronalIps) : ''),
    }));

    const ipsFormateado = form.nroPatronalIps ? formatearPatronalIps(form.nroPatronalIps) : '';

    const payload: EmpresaCliente = {
      ...form,
      ruc: rucClean,
      dv: dvFinal,
      nroPatronalIps: ipsFormateado,
      patronalesMtessSecundarias: sucursalesLimpias.length > 0 ? sucursalesLimpias : undefined,
    };

    setForm(payload);

    if (onEmpresaUpdated) {
      onEmpresaUpdated(payload);
    }

    showFeedback('ok', '✅ Datos de la empresa guardados correctamente.');
  };

  const handleRestaurar = () => {
    setForm({
      ...empresa,
      esAgenteRetentor: empresa.esAgenteRetentor ?? true,
      patronalesMtessSecundarias: empresa.patronalesMtessSecundarias
        ? empresa.patronalesMtessSecundarias.map(s => ({ ...s }))
        : [],
    });
    setDvManual(false);
    showFeedback('ok', '↺ Datos restaurados a la versión guardada.');
  };

  const handleDescargarContratoMaestro = () => {
    try {
      const doc = generarContratoMaestroDesdeEmpresa(form);
      const rucLimpio = (form.ruc || 'EMPRESA').replace(/\D/g, '');
      doc.save(`Contrato_Maestro_Tobi_${rucLimpio}.pdf`);
      showFeedback('ok', '📄 Contrato Maestro de Servicios generado exitosamente en PDF para imprimir.');
    } catch {
      showFeedback('error', 'Error al generar el contrato en PDF. Verifique los datos de la empresa.');
    }
  };

  const ipsPreview = formatearPatronalIps(form.nroPatronalIps);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#0f172a' }}>
      {/* ── Banner de Cabecera ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '22px 28px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(30, 58, 138, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            🏢
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Datos de la Empresa y Patronales
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#93c5fd' }}>
              Parámetros corporativos y legales obligatorios para el funcionamiento del ERP LaboraPy
            </p>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚖️</span>
          <span>
            Estos datos alimentan automáticamente la generación de <strong>Recibos de Salario</strong>,
            archivos <strong>IPS (.PRN 109 columnas / REI TXT)</strong>, <strong>Libros Laborales MTESS (REOP)</strong> y <strong>Contratos de Trabajo</strong>.
          </span>
        </div>
      </div>

      {/* ── Checklist de Integridad Documental ── */}
      <div style={sectionCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ ...sectionHeaderStyle, margin: 0 }}>
            <span>📋</span> Estado de Integridad Documental
          </h3>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: porcentaje === 100 ? '#166534' : '#92400e',
              background: porcentaje === 100 ? '#dcfce7' : '#fef3c7',
              border: `1px solid ${porcentaje === 100 ? '#86efac' : '#fde68a'}`,
              padding: '4px 12px',
              borderRadius: '20px',
            }}
          >
            {totalOk}/{checklist.length} completos · {porcentaje}%
          </span>
        </div>

        {/* Barra de Progreso */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: '#e2e8f0',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: `${porcentaje}%`,
              height: '100%',
              background:
                porcentaje === 100
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #f59e0b, #d97706)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Badges de Checklist */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px',
          }}
        >
          {checklist.map(item => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 12px',
                background: item.ok ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${item.ok ? '#bbf7d0' : '#fef08a'}`,
                borderRadius: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: item.ok ? '#16a34a' : '#d97706',
                  marginTop: '1px',
                }}
              >
                {item.ok ? '✓' : '!'}
              </span>
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: item.ok ? '#166534' : '#92400e',
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                  {item.hint}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sección 1: Identificación Tributaria y Legal ── */}
      <div style={sectionCardStyle}>
        <h3 style={sectionHeaderStyle}>
          <span>🧾</span> 1. Identificación Tributaria y Legal
        </h3>
        <div className="erp-form-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
          {/* RUC */}
          <div style={{ gridColumn: 'span 4' }}>
            <label style={labelStyle}>RUC (sin DV ni guion) *</label>
            <input
              type="text"
              value={form.ruc}
              onChange={e => handleRucChange(e.target.value)}
              placeholder="80012345"
              maxLength={8}
              inputMode="numeric"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              6 a 8 dígitos numéricos
            </span>
          </div>

          {/* DV */}
          <div style={{ gridColumn: 'span 3' }}>
            <label style={labelStyle}>DV *</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={form.dv}
                onChange={e => {
                  setDvManual(true);
                  updateField('dv', e.target.value.replace(/\D/g, '').slice(0, 1));
                }}
                maxLength={1}
                inputMode="numeric"
                style={{
                  ...inputStyle,
                  width: '60px',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#1e3a8a',
                  background: dvManual ? '#fffbeb' : '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={handleRecalcularDvAuto}
                title={dvManual ? 'Volver a cálculo automático oficial' : 'Recalcular DV automático'}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #93c5fd',
                  background: dvManual ? '#eff6ff' : '#f1f5f9',
                  color: '#0284c7',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {dvManual ? '⟳ Auto' : '✓ Auto'}
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              {dvManual ? 'Modo manual activo' : 'Algoritmo DNIT oficial'}
            </span>
          </div>

          {/* Razón Social */}
          <div style={{ gridColumn: 'span 5' }}>
            <label style={labelStyle}>Razón Social Legal *</label>
            <input
              type="text"
              value={form.razonSocial}
              onChange={e => updateField('razonSocial', e.target.value)}
              placeholder="CORPORACIÓN GUARANÍ S.A."
              style={inputStyle}
            />
          </div>

          {/* Nombre de Fantasía */}
          <div style={{ gridColumn: 'span 6' }}>
            <label style={labelStyle}>Nombre de Fantasía / Comercial</label>
            <input
              type="text"
              value={form.nombreFantasia || ''}
              onChange={e => updateField('nombreFantasia', e.target.value)}
              placeholder="Guaraní Express"
              style={inputStyle}
            />
          </div>

          {/* Actividad Económica */}
          <div style={{ gridColumn: 'span 6' }}>
            <label style={labelStyle}>Actividad Económica Principal</label>
            <input
              type="text"
              value={form.actividadEconomica || ''}
              onChange={e => updateField('actividadEconomica', e.target.value)}
              placeholder="Comercio al por mayor y menor de insumos"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Sección 2: Domicilio Fiscal y Contacto ── */}
      <div style={sectionCardStyle}>
        <h3 style={sectionHeaderStyle}>
          <span>📍</span> 2. Domicilio Fiscal y Contacto
        </h3>
        <div className="erp-form-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
          <div style={{ gridColumn: 'span 7' }}>
            <label style={labelStyle}>Dirección Fiscal (Calle, Número, Edificio) *</label>
            <input
              type="text"
              value={form.direccion}
              onChange={e => updateField('direccion', e.target.value)}
              placeholder="Avda. Aviadores del Chaco N.º 2050 c/ Sta. Teresa"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 5' }}>
            <label style={labelStyle}>Ciudad / Departamento</label>
            <input
              type="text"
              value={form.ciudad || ''}
              onChange={e => updateField('ciudad', e.target.value)}
              placeholder="Asunción"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <label style={labelStyle}>Teléfono Corporativo *</label>
            <input
              type="text"
              value={form.telefono}
              onChange={e => updateField('telefono', e.target.value)}
              placeholder="(021) 600-700 / (0981) 123-456"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 5' }}>
            <label style={labelStyle}>Email Corporativo / RRHH *</label>
            <input
              type="email"
              value={form.emailCorporativo}
              onChange={e => updateField('emailCorporativo', e.target.value)}
              placeholder="rrhh@empresa.com.py"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <label style={labelStyle}>URL del Logo (Opcional)</label>
            <input
              type="text"
              value={form.logoUrl || ''}
              onChange={e => updateField('logoUrl', e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Sección 3: Representación Legal ── */}
      <div style={sectionCardStyle}>
        <h3 style={sectionHeaderStyle}>
          <span>👤</span> 3. Representación Legal (Firma Autorizada)
        </h3>
        <div className="erp-form-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '14px' }}>
          <div style={{ gridColumn: 'span 6' }}>
            <label style={labelStyle}>Nombre y Apellidos del Representante Legal *</label>
            <input
              type="text"
              value={form.representanteLegalNombre}
              onChange={e => updateField('representanteLegalNombre', e.target.value)}
              placeholder="Lic. Roberto Gómez Fernández"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <label style={labelStyle}>Cédula de Identidad (C.I.) *</label>
            <input
              type="text"
              value={form.representanteLegalCi}
              onChange={e => updateField('representanteLegalCi', e.target.value)}
              placeholder="1.234.567"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <label style={labelStyle}>Cargo en la Empresa</label>
            <input
              type="text"
              value={form.representanteLegalCargo || ''}
              onChange={e => updateField('representanteLegalCargo', e.target.value)}
              placeholder="Presidente / Gerente General"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Sección 4: Patronales Oficiales (IPS y MTESS) ── */}
      <div style={sectionCardStyle}>
        <h3 style={sectionHeaderStyle}>
          <span>🏛️</span> 4. Números Patronales Oficiales (IPS y MTESS)
        </h3>
        <div className="erp-form-grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
          {/* Patronal IPS */}
          <div style={{ gridColumn: 'span 6' }}>
            <label style={labelStyle}>Nº Patronal IPS (Formato REI)</label>
            <input
              type="text"
              value={form.nroPatronalIps || ''}
              onChange={e => updateField('nroPatronalIps', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="4612819"
              maxLength={10}
              inputMode="numeric"
              style={inputStyle}
            />
            {/* Preview en vivo a 10 dígitos para .PRN */}
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 700, color: '#64748b' }}>Preview Archivo IPS (.PRN):</span>
              <code
                style={{
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontWeight: 800,
                  color: '#0284c7',
                  background: '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.08em',
                }}
              >
                {ipsPreview || '0000000000'}
              </code>
              <span style={{ fontSize: '11px', color: '#64748b' }}>(10 dígitos)</span>
            </div>
          </div>

          {/* Patronal MTESS Principal */}
          <div style={{ gridColumn: 'span 6' }}>
            <label style={labelStyle}>Nº Patronal MTESS (Casa Central / Principal)</label>
            <input
              type="text"
              value={form.nroPatronalMtess || ''}
              onChange={e => updateField('nroPatronalMtess', e.target.value)}
              placeholder="80012345-1 / 10542"
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', display: 'block' }}>
              Utilizado en el encabezado de Libros Laborales (Empleados, Sueldos, Vacaciones) y Planillas MTESS.
            </span>
          </div>

          {/* Agente Retentor de IVA (DNIT) */}
          <div style={{ gridColumn: 'span 6' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#64748b', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.esAgenteRetentor ?? true}
                onChange={e => updateField('esAgenteRetentor', e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>
                <strong>🏷️ Empresa es Agente Retentor de IVA (DNIT)</strong>
                <br />
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Si está activo, en la liquidación se retiene el 30% del IVA a prestadores con factura. Si no, cobran el total facturado sin retención.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Sección 5: Patronales MTESS Secundarias (Multisucursal) ── */}
      <div style={sectionCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ ...sectionHeaderStyle, margin: 0 }}>
              <span>🏬</span> 5. Sucursales y Patronales MTESS Secundarias
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
              Para empresas con múltiples inscripciones patronales ante el MTESS (ej. Casa Central Asunción, Sucursal CDE, etc.)
            </p>
          </div>
          <button
            type="button"
            onClick={agregarSucursal}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #93c5fd',
              background: '#eff6ff',
              color: '#0284c7',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>➕</span> Agregar Sucursal
          </button>
        </div>

        {(!form.patronalesMtessSecundarias || form.patronalesMtessSecundarias.length === 0) ? (
          <div
            style={{
              padding: '16px',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
            }}
          >
            No hay sucursales MTESS secundarias registradas. Si tu empresa opera con una única patronal MTESS, no es necesario agregar sucursales.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {form.patronalesMtessSecundarias.map((suc, idx) => {
              const usaIpsPrincipal = suc.usarIpsPrincipal !== false;
              const previewIpsSucursal = formatearPatronalIps(suc.nroPatronalIps);

              return (
                <div
                  key={suc.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    background: '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px', alignItems: 'center' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Nombre de Sucursal #{idx + 1} *</label>
                      <input
                        type="text"
                        value={suc.sucursalNombre}
                        onChange={e => actualizarSucursal(suc.id, { sucursalNombre: e.target.value })}
                        placeholder="Sucursal Ciudad del Este"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={labelStyle}>Ciudad *</label>
                      <input
                        type="text"
                        value={suc.ciudad}
                        onChange={e => actualizarSucursal(suc.id, { ciudad: e.target.value })}
                        placeholder="Ciudad del Este"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={labelStyle}>Departamento Geográfico</label>
                      <select
                        value={suc.departamento || 'Central'}
                        onChange={e => actualizarSucursal(suc.id, { departamento: e.target.value })}
                        style={inputStyle}
                      >
                        {DEPARTAMENTOS_PARAGUAY.map(dep => (
                          <option key={dep} value={dep}>
                            {dep}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                      <button
                        type="button"
                        onClick={() => eliminarSucursal(suc.id)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '6px',
                          border: '1px solid #fecaca',
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#dc2626',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Eliminar esta sucursal"
                      >
                        🗑️ Quitar
                      </button>
                    </div>

                    <div style={{ gridColumn: 'span 7' }}>
                      <label style={labelStyle}>Dirección Física del Establecimiento</label>
                      <input
                        type="text"
                        value={suc.direccion || ''}
                        onChange={e => actualizarSucursal(suc.id, { direccion: e.target.value })}
                        placeholder="Avda. Monseñor Rodríguez c/ Avda. Pioneros del Este"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 5' }}>
                      <label style={labelStyle}>Nº Patronal MTESS (Esta Sucursal) *</label>
                      <input
                        type="text"
                        value={suc.nroPatronalMtess}
                        onChange={e => actualizarSucursal(suc.id, { nroPatronalMtess: e.target.value })}
                        placeholder="80012345-2"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Configuración de Patronal IPS de la Sucursal */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={usaIpsPrincipal}
                        onChange={e => actualizarSucursal(suc.id, { usarIpsPrincipal: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>¿Usa la misma Patronal de IPS que Casa Central ({form.nroPatronalIps ? formatearPatronalIps(form.nroPatronalIps) : 'Sin asignar'})?</span>
                    </label>

                    {!usaIpsPrincipal && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px', marginTop: '4px', alignItems: 'center' }}>
                        <div style={{ gridColumn: 'span 6' }}>
                          <label style={labelStyle}>Nº Patronal IPS Propio para esta Sucursal</label>
                          <input
                            type="text"
                            value={suc.nroPatronalIps || ''}
                            onChange={e => actualizarSucursal(suc.id, { nroPatronalIps: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            placeholder="4612999"
                            maxLength={10}
                            inputMode="numeric"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 6' }}>
                          <div
                            style={{
                              padding: '6px 10px',
                              background: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11.5px',
                              marginTop: '16px',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#64748b' }}>Preview .PRN IPS Sucursal:</span>
                            <code style={{ fontFamily: 'Consolas, monospace', fontWeight: 800, color: '#0284c7' }}>
                              {previewIpsSucursal || '0000000000'}
                            </code>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Barra Flotante de Acciones y Feedback ── */}
      <div
        style={{
          position: 'sticky',
          bottom: '16px',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 20px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          {feedback ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                background: feedback.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
                color: feedback.tipo === 'ok' ? '#166534' : '#991b1b',
                border: `1px solid ${feedback.tipo === 'ok' ? '#86efac' : '#fca5a5'}`,
              }}
            >
              {feedback.mensaje}
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Asegúrate de guardar los cambios para actualizar recibos, archivos IPS y planillas MTESS.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDescargarContratoMaestro}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)',
            }}
            title="Genera el contrato oficial con membrete Tobi listo para imprimir en papel y firmar"
          >
            <span>📄</span> Contrato Maestro (PDF)
          </button>

          <button
            type="button"
            onClick={handleRestaurar}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>↺</span> Restaurar
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
            }}
          >
            <span>💾</span> Guardar Datos de la Empresa
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfileTab;
