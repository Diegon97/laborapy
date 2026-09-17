/**
 * FORMULARIO INTERACTIVO DE CASILLAS PARA NOTAS Y DOCUMENTOS — LABORAPY
 *
 * Permite al usuario completar las casillas necesarias (Nombre, C.I., Empresa,
 * Cargo, Días de Suspensión, Hechos, etc.) directamente en el chat para generar
 * el documento oficial al instante en PDF y Word sin fricción.
 */

import React, { useState, useEffect } from 'react';
import type { TobiDocumentActionPayload, TobiDocumentType } from '../types';
import type { TobiDocumentFormInitialData } from '../tobiDocumentAction';

export interface TobiDocumentFormCardProps {
  readonly initialTipo?: TobiDocumentType;
  readonly initialData?: TobiDocumentFormInitialData | null;
  readonly defaultEmpresa?: string;
  readonly defaultCargo?: string;
  readonly onSubmit: (payload: TobiDocumentActionPayload) => void;
  readonly onCancel?: () => void;
  readonly isMobile?: boolean;
}

export const TobiDocumentFormCard: React.FC<TobiDocumentFormCardProps> = ({
  initialTipo = 'suspension_disciplinaria',
  initialData = null,
  defaultEmpresa = '',
  defaultCargo = '',
  onSubmit,
  onCancel,
  isMobile = false,
}) => {
  const [tipo, setTipo] = useState<TobiDocumentType>(initialData?.tipo || initialTipo);
  const [nombreEmpleado, setNombreEmpleado] = useState(initialData?.nombreEmpleado || '');
  const [ciEmpleado, setCiEmpleado] = useState(initialData?.ciEmpleado || '');
  const [empresa, setEmpresa] = useState(initialData?.empresa || defaultEmpresa);
  const [cargoEmpleado, setCargoEmpleado] = useState(initialData?.cargoEmpleado || defaultCargo);

  // Antecedentes y sumario administrativo
  const [tieneAntecedentes, setTieneAntecedentes] = useState<boolean>(
    initialData?.tieneAntecedentes ?? (Boolean(initialData?.diasSuspension && initialData.diasSuspension > 1)),
  );
  const [tieneSumario, setTieneSumario] = useState<boolean>(initialData?.tieneSumario ?? false);

  // Días y límite estricto según el caso inicial analizado
  const caseMaxDias = initialData?.maxDiasPermitidos;
  const initialDias = initialData?.diasSuspension ?? (caseMaxDias ? Math.min(caseMaxDias, 8) : 1);
  const [diasSuspension, setDiasSuspension] = useState<number>(initialDias);

  const [hechosOcurridos, setHechosOcurridos] = useState(initialData?.hechosOcurridos || '');
  const [sucursalOrigen, setSucursalOrigen] = useState(initialData?.sucursalOrigen || '');
  const [sucursalDestino, setSucursalDestino] = useState(initialData?.sucursalDestino || '');
  const [fechaIngreso, setFechaIngreso] = useState(initialData?.fechaIngreso || '');
  const [fechaEgreso, setFechaEgreso] = useState(initialData?.fechaEgreso || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tope legal y de caso estricto:
  // 1. Sin antecedentes: máx 1 día.
  // 2. Si el caso inicial fijó N días (ej: 2 días): tope absoluto es N días (prohibido 8 días arbitrarios).
  // 3. Si no hay restricción de caso inicial:
  //    - Con antecedentes sin sumario: máx 3 días (Principio de proporcionalidad Art. 352 inc. i).
  //    - Con sumario administrativo previo y reglamento interno homologado: máx 8 días (Art. 354 C.T.).
  const maxAllowedDias = !tieneAntecedentes
    ? 1
    : caseMaxDias !== undefined
    ? caseMaxDias
    : tieneSumario
    ? 8
    : 3;

  // Sincronizar días si cambian los antecedentes o los topes
  useEffect(() => {
    if (diasSuspension > maxAllowedDias) {
      setDiasSuspension(maxAllowedDias);
    }
  }, [maxAllowedDias, diasSuspension]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreEmpleado.trim()) {
      setErrorMsg('Por favor ingresá el nombre del colaborador.');
      return;
    }

    const payload: TobiDocumentActionPayload = {
      tipo,
      nombreEmpleado: nombreEmpleado.trim(),
      ciEmpleado: ciEmpleado.trim() || '—',
      empresa: empresa.trim() || 'Corporación Empleadora',
      cargoEmpleado: cargoEmpleado.trim() || 'Colaborador',
      hechosOcurridos: hechosOcurridos.trim() || undefined,
      diasSuspension: tipo === 'suspension_disciplinaria' ? diasSuspension : undefined,
      sucursalOrigen: tipo === 'traslado' ? sucursalOrigen.trim() || undefined : undefined,
      sucursalDestino: tipo === 'traslado' ? sucursalDestino.trim() || undefined : undefined,
      fechaIngreso: fechaIngreso.trim() || undefined,
      fechaEgreso: fechaEgreso.trim() || undefined,
      fundamentoLegal:
        tipo === 'suspension_disciplinaria'
          ? 'Arts. 353 inc. a), 352 inc. i) y 354 del Código del Trabajo (Ley 213/93)'
          : tipo === 'amonestacion'
          ? 'Art. 81 y Reglamento Interno de Trabajo'
          : tipo === 'traslado'
          ? 'Art. 34 del Código del Trabajo (Ley 213/93)'
          : tipo === 'despido_justificado'
          ? 'Art. 81 del Código del Trabajo (Ley 213/93)'
          : tipo === 'certificado_trabajo'
          ? 'Art. 93 del Código del Trabajo (Ley 213/93)'
          : undefined,
    };

    onSubmit(payload);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    fontSize: 12.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: 3,
    display: 'block',
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 14,
        background: 'linear-gradient(145deg, #090e1a 0%, #172238 100%)',
        border: '1px solid rgba(99, 102, 241, 0.45)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        padding: isMobile ? 12 : 16,
        color: '#f8fafc',
      }}
    >
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>📝</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#c7d2fe' }}>
            Completar datos en casillas y generar nota
          </span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: '6px 10px', marginBottom: 10, borderRadius: 6, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: 11.5 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Selector de Tipo de Documento */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Tipo de Documento:</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TobiDocumentType)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="suspension_disciplinaria">⚠️ Suspensión Disciplinaria (Arts. 352/353 C.T., máx 8 días)</option>
          <option value="amonestacion">📄 Amonestación Escrita / Apercibimiento</option>
          <option value="traslado">🔄 Notificación Formal de Traslado (Art. 34)</option>
          <option value="despido_justificado">🛑 Despido con Causa Justificada (Art. 81)</option>
          <option value="despido_injustificado">📋 Notificación de Despido sin Causa (Art. 84)</option>
          <option value="renuncia">📝 Carta de Renuncia Voluntaria</option>
          <option value="certificado_trabajo">📜 Certificado Laboral Oficial (Art. 93)</option>
        </select>
      </div>

      {/* Grid de 2 columnas para datos personales */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Nombre y Apellido del Colaborador *</label>
          <input
            type="text"
            required
            placeholder="Ej: Juan Pérez"
            value={nombreEmpleado}
            onChange={(e) => setNombreEmpleado(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>N° de Cédula de Identidad (C.I.)</label>
          <input
            type="text"
            placeholder="Ej: 4.567.890"
            value={ciEmpleado}
            onChange={(e) => setCiEmpleado(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Empresa / Empleador</label>
          <input
            type="text"
            placeholder="Nombre de tu empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Cargo o Función</label>
          <input
            type="text"
            placeholder="Ej: Funcionario de Logística"
            value={cargoEmpleado}
            onChange={(e) => setCargoEmpleado(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Campos condicionales según el tipo */}
      {tipo === 'suspension_disciplinaria' && (
        <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          {/* Checkbox de antecedentes */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8, fontSize: 12, color: '#e2e8f0' }}>
            <input
              type="checkbox"
              checked={tieneAntecedentes}
              onChange={(e) => {
                const checked = e.target.checked;
                setTieneAntecedentes(checked);
                if (!checked) setDiasSuspension(1);
              }}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <span>
              <strong>Cuenta con amonestaciones previas en su legajo laboral</strong>
              <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>
                Requisito legal para aplicar suspensiones de más de 1 día (Arts. 352 inc. i y 353 C.T.).
              </span>
            </span>
          </label>

          {/* Sumario administrativo (solo visible si no viene fijado por el caso inicial) */}
          {caseMaxDias === undefined && tieneAntecedentes && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8, fontSize: 12, color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={tieneSumario}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTieneSumario(checked);
                  if (!checked && diasSuspension > 3) setDiasSuspension(3);
                }}
                style={{ marginTop: 2, cursor: 'pointer' }}
              />
              <span>
                <strong>Cuenta con Sumario Administrativo formal y Reglamento Interno homologado MTESS</strong>
                <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>
                  Requisito imperativo del Art. 354 C.T. para suspensiones severas de 4 a 8 días.
                </span>
              </span>
            </label>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ ...labelStyle, color: '#fca5a5', marginBottom: 0 }}>Días de Suspensión sin goce de sueldo:</label>
            <span style={{ fontSize: 11, color: '#fca5a5', fontWeight: 700 }}>
              {diasSuspension} {diasSuspension === 1 ? 'día' : 'días'}{' '}
              {!tieneAntecedentes
                ? '(Límite: 1 día sin antecedentes)'
                : caseMaxDias !== undefined
                ? `(Tope del caso analizado: ${caseMaxDias} ${caseMaxDias === 1 ? 'día' : 'días'})`
                : !tieneSumario
                ? '(Tope sin sumario: 3 días)'
                : '(Tope legal con sumario: 8 días)'}
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={maxAllowedDias}
            value={diasSuspension}
            onChange={(e) => setDiasSuspension(parseInt(e.target.value, 10))}
            disabled={!tieneAntecedentes || maxAllowedDias <= 1}
            style={{
              width: '100%',
              cursor: tieneAntecedentes && maxAllowedDias > 1 ? 'pointer' : 'not-allowed',
              opacity: tieneAntecedentes ? 1 : 0.6,
            }}
          />

          <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 6, lineHeight: 1.35 }}>
            ⚖️ <strong>Principio de proporcionalidad y gradualidad:</strong>{' '}
            {!tieneAntecedentes
              ? 'Al no constar amonestación escrita previa, la ley limita la sanción a 1 día para prevenir reclamos patronales por despido indirecto (Art. 85 C.T.).'
              : caseMaxDias !== undefined
              ? `Sanción calibrada estrictamente en ${caseMaxDias} ${caseMaxDias === 1 ? 'día' : 'días'} conforme al diagnóstico del caso inicial analizado. No se permite elevar libremente a 8 días a elección sin sumario previo formal (Art. 354 C.T.).`
              : !tieneSumario
              ? 'Con amonestación previa por faltas reiteradas se admiten hasta 3 días directos. Para aplicar de 4 a 8 días se exige sumario previo y Reglamento homologado ante el MTESS (Art. 354 C.T.).'
              : 'Sanción con Sumario Administrativo y Reglamento Homologado ante el MTESS (Arts. 353 inc. a y 354 C.T., tope máximo 8 días).'}
          </div>
        </div>
      )}

      {tipo === 'traslado' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Sucursal de Origen</label>
            <input
              type="text"
              placeholder="Ej: Casa Central (Asunción)"
              value={sucursalOrigen}
              onChange={(e) => setSucursalOrigen(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Sucursal de Destino</label>
            <input
              type="text"
              placeholder="Ej: Depósito Luque"
              value={sucursalDestino}
              onChange={(e) => setSucursalDestino(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {(tipo === 'certificado_trabajo' || tipo === 'renuncia') && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Fecha de Ingreso</label>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Fecha de Salida</label>
            <input
              type="date"
              value={fechaEgreso}
              onChange={(e) => setFechaEgreso(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Hechos ocurridos (para amonestación, suspensión o despido justificado) */}
      {(tipo === 'suspension_disciplinaria' || tipo === 'amonestacion' || tipo === 'despido_justificado') && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Hechos concretos ocurridos (qué ocurrió, fecha y lugar):</label>
          <textarea
            rows={2}
            placeholder="Ej: El colaborador se ausentó de su puesto en el sector de logística el día lunes 15/09 sin justificación previa..."
            value={hechosOcurridos}
            onChange={(e) => setHechosOcurridos(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          }}
        >
          <span>⚡</span>
          <span>Generar Documento al toque</span>
        </button>
      </div>
    </form>
  );
};
