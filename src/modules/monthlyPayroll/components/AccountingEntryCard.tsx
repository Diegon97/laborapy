/**
 * COMPONENTE UI: ASIENTO CONTABLE GENERAL CONSOLIDADO DE NÓMINA (LABORAPY)
 *
 * Visualización de partida doble cuadrada (Debe === Haber), sumas iguales,
 * y suite de exportación directa a Odoo, SAP Business One, ERPs locales y Excel.
 */

import React, { useMemo, useState } from 'react';
import type { TotalesNominaMasiva, LiquidacionMensualResult } from '../types';
import type { PlanDeCuentasNomina } from '../types/accountingTypes';
import { formatMontoMoneda } from '../engine/monthlyPayrollEngine';
import {
  generarAsientoContableNomina,
} from '../engine/payrollAccountingEngine';
import {
  exportarAsientoOdooCSV,
  exportarAsientoSapCSV,
  exportarAsientoUniversalCSV,
  exportarAsientoJSON,
  formatearAsientoParaClipboard,
  descargarArchivoContable,
} from '../services/payrollAccountingExportService';
import {
  loadAccountingConfig,
  saveAccountingConfig,
  resetAccountingConfig,
} from '../services/payrollAccountingStorage';

interface Props {
  totales: TotalesNominaMasiva;
  liquidaciones: LiquidacionMensualResult[];
  periodoKey: string;
  empresaMetadata?: {
    id: string;
    nombre: string;
    ruc: string;
  };
}

export const AccountingEntryCard: React.FC<Props> = ({
  totales,
  liquidaciones,
  periodoKey,
  empresaMetadata,
}) => {
  const [configCuentas, setConfigCuentas] = useState<PlanDeCuentasNomina>(() =>
    loadAccountingConfig(empresaMetadata?.id),
  );
  const [mostrarConfigModal, setMostrarConfigModal] = useState(false);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);
  const [incluirAguinaldo, setIncluirAguinaldo] = useState(true);
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<'PYG' | 'USD'>('PYG');
  const [tipoCambio, setTipoCambio] = useState<number>(7500);

  // Generar asiento consolidado reactivamente
  const asiento = useMemo(() => {
    return generarAsientoContableNomina(
      totales,
      liquidaciones,
      periodoKey,
      configCuentas,
      empresaMetadata,
      {
        incluirProvisionAguinaldo: incluirAguinaldo,
        moneda: monedaSeleccionada,
        tipoCambioGs: tipoCambio,
      },
    );
  }, [totales, liquidaciones, periodoKey, configCuentas, empresaMetadata, incluirAguinaldo, monedaSeleccionada, tipoCambio]);

  // Manejo de exportaciones
  const handleExportOdoo = () => {
    const csv = exportarAsientoOdooCSV(asiento);
    descargarArchivoContable(csv, `asiento_odoo_${periodoKey}.csv`);
  };

  const handleExportSap = () => {
    const csv = exportarAsientoSapCSV(asiento);
    descargarArchivoContable(csv, `asiento_sap_${periodoKey}.csv`);
  };

  const handleExportUniversal = () => {
    const csv = exportarAsientoUniversalCSV(asiento);
    descargarArchivoContable(csv, `asiento_contable_${periodoKey}.csv`);
  };

  const handleExportJson = () => {
    const json = exportarAsientoJSON(asiento);
    descargarArchivoContable(json, `asiento_contable_${periodoKey}.json`, 'application/json;charset=utf-8;');
  };

  const handleCopiarClipboard = async () => {
    const tsv = formatearAsientoParaClipboard(asiento);
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2500);
    } catch {
      // Fallback si clipboard API no está disponible
      const ta = document.createElement('textarea');
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2500);
    }
  };

  // Guardar mapeo de cuentas personalizado
  const handleGuardarCuentas = (nuevasCuentas: PlanDeCuentasNomina) => {
    setConfigCuentas(nuevasCuentas);
    saveAccountingConfig(empresaMetadata?.id, nuevasCuentas);
    setMostrarConfigModal(false);
  };

  const handleResetCuentas = () => {
    const porDefecto = resetAccountingConfig(empresaMetadata?.id);
    setConfigCuentas(porDefecto);
    setMostrarConfigModal(false);
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  };

  const btnSecondaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    fontWeight: 600,
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    ...btnSecondaryStyle,
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: '1px solid #0284c7',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    textAlign: 'left',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #1a1c20',
    fontSize: '12.5px',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={cardStyle}>
      {/* ── Encabezado y Estado de Cuadratura ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              ðŸ›ï¸ Asiento Contable General Consolidado
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                color: '#0369a1',
                border: '1px solid rgba(2, 132, 199, 0.3)',
              }}
            >
              Compatible Odoo Â· SAP Â· Universal
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
            Inyección contable global al cierre de fin de mes: agrupa todos los haberes, aportes IPS (25.5%),
            retenciones impositivas y pasivos líquidos en un solo comprobante de diario cuadrado.
          </p>
        </div>

        {/* Badge de Partida Doble */}
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '13px',
            backgroundColor: asiento.estaCuadrado ? 'rgba(39, 166, 68, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: asiento.estaCuadrado ? '#27a644' : '#ef4444',
            border: `1px solid ${asiento.estaCuadrado ? 'rgba(39, 166, 68, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{asiento.estaCuadrado ? 'âœ…' : 'â›”'}</span>
          <span>
            {asiento.estaCuadrado
              ? `Asiento Cuadrado (${asiento.moneda}: Dif. 0)`
              : `Descuadrado: ${formatMontoMoneda(asiento.diferencia, asiento.moneda as 'PYG' | 'USD')}`}
          </span>
        </div>
      </div>

      {/* ── Barra de Opciones y Acciones de Exportación ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Toggle Multimoneda (PYG vs USD) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ffffff', padding: '3px', borderRadius: '8px', gap: '3px', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setMonedaSeleccionada('PYG')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: monedaSeleccionada === 'PYG' ? '#0284c7' : 'transparent',
                color: monedaSeleccionada === 'PYG' ? '#ffffff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              ðŸ‡µðŸ‡¾ Guaraníes (ML)
            </button>
            <button
              type="button"
              onClick={() => setMonedaSeleccionada('USD')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: monedaSeleccionada === 'USD' ? '#0284c7' : 'transparent',
                color: monedaSeleccionada === 'USD' ? '#ffffff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              ðŸ’µ Dólares (ME - USD)
            </button>
          </div>

          {monedaSeleccionada === 'USD' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1' }}>
                COTIZA (Gs.):
              </label>
              <input
                type="number"
                min={1}
                step={50}
                value={tipoCambio}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTipoCambio(val > 0 ? val : 1);
                }}
                style={{
                  width: '85px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
                title="Cotización oficial de cambio Gs. por Dólar (Variable COTIZA)"
              />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={incluirAguinaldo}
              onChange={(e) => setIncluirAguinaldo(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>Incluir provisión de aguinaldo (1/12)</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleExportOdoo} style={btnPrimaryStyle} title="Descargar CSV para Odoo Accounting">
            ðŸŸ£ Exportar Odoo (CSV)
          </button>
          <button onClick={handleExportSap} style={btnSecondaryStyle} title="Descargar CSV para SAP Business One DTW">
            ðŸŸ¡ Exportar SAP (CSV)
          </button>
          <button onClick={handleExportUniversal} style={btnSecondaryStyle} title="Descargar CSV Universal estándar">
            ðŸ“Š Universal (CSV)
          </button>
          <button onClick={handleCopiarClipboard} style={btnSecondaryStyle} title="Copiar al portapapeles para pegar en Excel">
            {copiadoFeedback ? 'âœ… Â¡Copiado!' : 'ðŸ“‹ Copiar para Excel'}
          </button>
          <button onClick={handleExportJson} style={btnSecondaryStyle} title="Descargar payload JSON para API">
            {'{ }'} JSON
          </button>
          <button
            onClick={() => setMostrarConfigModal(true)}
            style={btnSecondaryStyle}
            title="Personalizar códigos de cuenta contable"
          >
            âš™ï¸ Cuentas
          </button>
        </div>
      </div>

      {/* ── Tabla del Asiento Contable Cuadrado ── */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '45px', textAlign: 'center' }}>#</th>
              <th style={{ ...thStyle, width: '110px' }}>Código Cuenta</th>
              <th style={{ ...thStyle, width: '220px' }}>Nombre de la Cuenta</th>
              <th style={thStyle}>Concepto / Glosa Contable</th>
              <th style={{ ...thStyle, width: '130px', textAlign: 'right' }}>Debe ({asiento.moneda})</th>
              <th style={{ ...thStyle, width: '130px', textAlign: 'right' }}>Haber ({asiento.moneda})</th>
            </tr>
          </thead>
          <tbody>
            {asiento.lineas.map((l) => (
              <tr
                key={l.numeroLinea}
                style={{
                  backgroundColor: l.esProvision ? 'rgba(2, 132, 199, 0.05)' : undefined,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = l.esProvision ? 'rgba(2, 132, 199, 0.05)' : 'transparent')
                }
              >
                <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                  {l.numeroLinea}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                  {l.codigoCuenta}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#475569' }}>
                  {l.nombreCuenta}
                  {l.esProvision && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', color: '#0369a1', fontWeight: 700 }}>
                      [Provisión]
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: '#64748b' }}>{l.concepto}</td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: l.debe > 0 ? 700 : 400,
                    color: l.debe > 0 ? '#27a644' : '#64748b',
                  }}
                >
                  {l.debe > 0 ? formatMontoMoneda(l.debe, asiento.moneda as 'PYG' | 'USD') : '—'}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: l.haber > 0 ? 700 : 400,
                    color: l.haber > 0 ? '#0369a1' : '#64748b',
                  }}
                >
                  {l.haber > 0 ? formatMontoMoneda(l.haber, asiento.moneda as 'PYG' | 'USD') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
              <td colSpan={4} style={{ padding: '12px 14px', fontWeight: 800, fontSize: '13px', color: '#0f172a', textAlign: 'right' }}>
                SUMAS IGUALES (PARTIDA DOBLE):
              </td>
              <td
                style={{
                  padding: '12px 14px',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: '#27a644',
                  borderTop: '2px solid #e2e8f0',
                }}
              >
                {formatMontoMoneda(asiento.totalDebe, asiento.moneda as 'PYG' | 'USD')}
              </td>
              <td
                style={{
                  padding: '12px 14px',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: '#0369a1',
                  borderTop: '2px solid #e2e8f0',
                }}
              >
                {formatMontoMoneda(asiento.totalHaber, asiento.moneda as 'PYG' | 'USD')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Modal de Configuración del Plan de Cuentas ── */}
      {mostrarConfigModal && (
        <PlanDeCuentasModal
          configActual={configCuentas}
          onGuardar={handleGuardarCuentas}
          onReset={handleResetCuentas}
          onCerrar={() => setMostrarConfigModal(false)}
        />
      )}
    </div>
  );
};

interface PlanDeCuentasModalProps {
  configActual: PlanDeCuentasNomina;
  onGuardar: (nuevaConfig: PlanDeCuentasNomina) => void;
  onReset: () => void;
  onCerrar: () => void;
}

const PlanDeCuentasModal: React.FC<PlanDeCuentasModalProps> = ({
  configActual,
  onGuardar,
  onReset,
  onCerrar,
}) => {
  const [formState, setFormState] = useState<PlanDeCuentasNomina>(() => ({ ...configActual }));

  const handleChangeCodigo = (id: string, nuevoCodigo: string) => {
    setFormState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        codigo: nuevoCodigo,
      },
    }));
  };

  const handleChangeNombre = (id: string, nuevoNombre: string) => {
    setFormState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        nombre: nuevoNombre,
      },
    }));
  };

  const cuentasArray = Object.values(formState);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              âš™ï¸ Mapeo del Plan de Cuentas Contable
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Ajustá los códigos contables de cada concepto de nómina para coincidir con tu ERP (Odoo, SAP, etc.).
            </p>
          </div>
          <button
            onClick={onCerrar}
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
          >
            âœ•
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>
                  CONCEPTO / TIPO
                </th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>
                  CÓDIGO CUENTA (ERP)
                </th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>
                  NOMBRE DE LA CUENTA
                </th>
              </tr>
            </thead>
            <tbody>
              {cuentasArray.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontSize: '12.5px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.id}</div>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: c.naturaleza === 'DEBE' ? 'rgba(39, 166, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                        color: c.naturaleza === 'DEBE' ? '#27a644' : '#0369a1',
                      }}
                    >
                      {c.naturaleza} Â· {c.categoria}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="text"
                      value={c.codigo}
                      onChange={(e) => handleChangeCodigo(c.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="text"
                      value={c.nombre}
                      onChange={(e) => handleChangeNombre(c.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        fontSize: '13px',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onReset}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            â†º Restaurar Plan por Defecto
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onCerrar}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onGuardar(formState)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #0284c7',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              ðŸ’¾ Guardar Cuentas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
