/**
 * PANEL COMERCIAL Y GESTIÓN DE LEADS — LABORAPY
 * Permite al equipo comercial de LaboraPy visualizar, filtrar, exportar (CSV/JSON)
 * y sincronizar leads en tiempo real con sistemas CRM / Webhooks.
 * Sistema de diseño Linear: Canvas #f8fafc, Surface-1 #ffffff, Surface-2 #f8fafc, Borders #e2e8f0.
 * Versión: PY-LEAD-2026.09.05
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  getStoredLeads,
  getLeadMetrics,
  downloadLeadsCSV,
  downloadLeadsJSON,
  syncLeadsToCommercial,
  getCRMWebhookUrl,
  setCRMWebhookUrl,
  markLeadsAsSynced,
  markAllLeadsAsSynced,
  deleteLead,
  clearStoredLeads,
  filterLeads,
  syncPendingLeadsToSupabase,
  type LeadData,
  type TipoUsuario,
} from '../services/leadService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CommercialLeadsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'all' | TipoUsuario>('all');
  const [syncFilter, setSyncFilter] = useState<'all' | 'synced' | 'unsynced'>('all');
  const [webhookUrl, setWebhookUrlInput] = useState('');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reloadData = () => {
    setLeads(getStoredLeads());
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
      setWebhookUrlInput(getCRMWebhookUrl());
      setSyncFeedback(null);
    }
  }, [isOpen]);

  const metrics = useMemo(() => getLeadMetrics(), [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (tipoFilter !== 'all') {
      result = filterLeads({ tipoUsuario: tipoFilter }, result);
    }
    if (syncFilter === 'synced') {
      result = filterLeads({ sincronizado: true }, result);
    } else if (syncFilter === 'unsynced') {
      result = filterLeads({ sincronizado: false }, result);
    }
    if (searchTerm.trim()) {
      result = filterLeads({ query: searchTerm.trim() }, result);
    }
    return result;
  }, [leads, tipoFilter, syncFilter, searchTerm]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    const success = downloadLeadsCSV();
    if (success) {
      setSyncFeedback({ type: 'success', message: 'Archivo CSV descargado con codificación UTF-8 compatible con Excel.' });
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleExportJSON = () => {
    const success = downloadLeadsJSON();
    if (success) {
      setSyncFeedback({ type: 'success', message: 'Archivo JSON descargado exitosamente.' });
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    setCRMWebhookUrl(webhookUrl);
    setSyncFeedback({ type: 'success', message: 'URL del Webhook CRM guardada correctamente.' });
    setShowWebhookConfig(false);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleSyncCRM = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncLeadsToCommercial();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.message || `${res.count} lead(s) sincronizados exitosamente.`,
        });
        reloadData();
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'No se pudo sincronizar con el CRM.',
        });
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e.message || 'Error de red al intentar sincronizar.',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncFeedback(null);
    try {
      const res = await syncPendingLeadsToSupabase();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message:
            res.count > 0
              ? `${res.count} lead(s) sincronizados exitosamente con Supabase Cloud.`
              : 'Todos los leads ya están sincronizados en Supabase Cloud.',
        });
        reloadData();
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'No se pudo conectar con Supabase Cloud.',
        });
      }
    } catch (e: any) {
      setSyncFeedback({
        type: 'error',
        message: e.message || 'Error de conexión con Supabase Cloud.',
      });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleMarkAsSynced = (leadId: string) => {
    markLeadsAsSynced([leadId]);
    reloadData();
  };

  const handleMarkAllSynced = () => {
    markAllLeadsAsSynced();
    reloadData();
  };

  const handleDelete = (leadId: string) => {
    if (window.confirm('Â¿Seguro que deseas eliminar este lead del registro local?')) {
      deleteLead(leadId);
      reloadData();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('ATENCIÓN: Esto eliminará TODOS los leads almacenados localmente. Â¿Deseas continuar?')) {
      clearStoredLeads();
      reloadData();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '1120px',
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          border: '1px solid #e2e8f0',
          fontFamily: 'inherit',
          overflow: 'hidden',
          color: '#0f172a',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>ðŸ’¼</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
                Panel Comercial & Gestión de Leads Â· LaboraPy
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                Embudo de conversión comercial, exportación y sincronización en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            âœ•
          </button>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div
            style={{
              padding: '12px 24px',
              background: syncFeedback.type === 'success' ? '#0d2818' : '#2d1217',
              color: syncFeedback.type === 'success' ? '#4ade80' : '#f87171',
              borderBottom: `1px solid ${syncFeedback.type === 'success' ? '#1c4a2a' : '#4c1d24'}`,
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{syncFeedback.type === 'success' ? 'âœ…' : 'âš ï¸'} {syncFeedback.message}</span>
            <button
              onClick={() => setSyncFeedback(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
            >
              âœ•
            </button>
          </div>
        )}

        {/* Contenido con scroll */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#ffffff' }}>
          {/* Métricas Comerciales */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Leads</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{metrics.totalLeads}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #1b3325' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.4px' }}>B2B Empresas</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#6ee7b7', marginTop: '4px' }}>{metrics.b2bCount}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #1e2d4a' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>B2C Particulares</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#93c5fd', marginTop: '4px' }}>{metrics.b2cCount}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #3b2c14' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cartera en Juego</div>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#fef08a', marginTop: '6px' }}>
                Gs. {metrics.totalEstimadoGs.toLocaleString('es-PY')}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #2e1d44' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Con WhatsApp</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#d8b4fe', marginTop: '4px' }}>{metrics.withPhoneCount}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: `1px solid ${metrics.unsyncedCount > 0 ? '#4c1d24' : '#1b3325'}` }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: metrics.unsyncedCount > 0 ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Pendientes Sync
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: metrics.unsyncedCount > 0 ? '#fca5a5' : '#6ee7b7', marginTop: '4px' }}>
                {metrics.unsyncedCount}
              </div>
            </div>
          </div>

          {/* Barra de Acciones de Exportación y Sincronización */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportCSV}
                style={{
                  fontSize: '13px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0369a1')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0284c7')}
              >
                <span>ðŸ“¥</span> Descargar CSV (Excel)
              </button>

              <button
                onClick={handleExportJSON}
                style={{
                  fontSize: '13px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#1c1d1f',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <span>ðŸ“‹</span> Descargar JSON
              </button>

              <button
                onClick={handleSyncCRM}
                disabled={isSyncing}
                style={{
                  fontSize: '13px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #059669',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isSyncing ? 0.7 : 1,
                }}
              >
                <span>ðŸ”„</span> {isSyncing ? 'Sincronizando...' : 'Sincronizar CRM'}
              </button>

              <button
                onClick={handleSyncSupabase}
                disabled={isSyncingSupabase}
                style={{
                  fontSize: '13px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  fontWeight: 600,
                  cursor: isSyncingSupabase ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isSyncingSupabase ? 0.7 : 1,
                }}
              >
                <span>â˜ï¸</span> {isSyncingSupabase ? 'Subiendo...' : 'Supabase Cloud'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                style={{
                  fontSize: '12.5px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#1c1d1f',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>âš™ï¸</span> Webhook CRM
              </button>

              {metrics.unsyncedCount > 0 && (
                <button
                  onClick={handleMarkAllSynced}
                  style={{
                    fontSize: '12.5px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #1c3829',
                    background: '#14201a',
                    color: '#34d399',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  âœ“ Marcar todos sincronizados
                </button>
              )}

              {leads.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    fontSize: '12px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #4a1d24',
                    background: '#231518',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  ðŸ—‘ï¸ Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Formulario de Configuración de Webhook CRM */}
          {showWebhookConfig && (
            <form
              onSubmit={handleSaveWebhook}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0f172a', marginBottom: '6px' }}>
                Configuración del Webhook Comercial (CRM / Zapier / Make / Sheets)
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                Ingresa una URL HTTP POST a la cual enviar automáticamente los leads del embudo comercial:
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrlInput(e.target.value)}
                  placeholder="https://hook.eu1.make.com/... o https://api.crm.tuempresa.com/leads"
                  style={{
                    flex: 1,
                    minWidth: '280px',
                    fontSize: '13px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    color: '#0f172a',
                    padding: '8px 12px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Guardar URL
                </button>
                <button
                  type="button"
                  onClick={() => setShowWebhookConfig(false)}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    background: '#1c1d1f',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  Cerrar
                </button>
              </div>
            </form>
          )}

          {/* Filtros de búsqueda */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ðŸ” Buscar por nombre, email, empresa, motivo o teléfono..."
                style={{
                  width: '100%',
                  fontSize: '13.5px',
                  height: '40px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  padding: '0 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <select
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value as any)}
              style={{
                width: 'auto',
                minWidth: '160px',
                height: '40px',
                fontSize: '13px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 10px',
                outline: 'none',
              }}
            >
              <option value="all">Todos los tipos</option>
              <option value="empresa">ðŸ¢ Solo Empresas (B2B)</option>
              <option value="particular">ðŸ‘¤ Solo Particulares (B2C)</option>
            </select>

            <select
              value={syncFilter}
              onChange={e => setSyncFilter(e.target.value as any)}
              style={{
                width: 'auto',
                minWidth: '160px',
                height: '40px',
                fontSize: '13px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 10px',
                outline: 'none',
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="unsynced">â³ Pendientes de Sync</option>
              <option value="synced">âœ… Sincronizados</option>
            </select>
          </div>

          {/* Tabla de Leads */}
          {filteredLeads.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed #e2e8f0',
              }}
            >
              <span style={{ fontSize: '32px' }}>ðŸ“­</span>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '13.5px', fontWeight: 500 }}>
                {leads.length === 0 ? 'Aún no se han capturado leads en el embudo comercial.' : 'No hay leads que coincidan con los filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px' }}>Fecha</th>
                    <th style={{ padding: '10px 12px' }}>Contacto</th>
                    <th style={{ padding: '10px 12px' }}>Segmento</th>
                    <th style={{ padding: '10px 12px' }}>Motivo / Documento</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Monto Estimado</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Sync</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => {
                    const phone = lead.telefono || lead.telefonoWhatsApp;
                    const cleanPhoneDigits = phone ? phone.replace(/\D/g, '') : '';
                    const waLink = cleanPhoneDigits ? `https://wa.me/${cleanPhoneDigits.startsWith('595') ? cleanPhoneDigits : '595' + cleanPhoneDigits.replace(/^0/, '')}` : null;
                    const amount = lead.calculoEstimado ?? lead.montoNeto;

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: '#ffffff',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {lead.timestamp ? new Date(lead.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{lead.nombre || 'Sin nombre registrado'}</div>
                          <a href={`mailto:${lead.email}`} style={{ color: '#0369a1', textDecoration: 'none', fontSize: '12px' }}>
                            {lead.email}
                          </a>
                          {phone && (
                            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 500 }}>ðŸ“ž {phone}</span>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '10.5px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: '#25d366',
                                    color: '#fff',
                                    textDecoration: 'none',
                                    fontWeight: 700,
                                  }}
                                >
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: lead.tipoUsuario === 'empresa' ? '#14201a' : '#161a2e',
                              color: lead.tipoUsuario === 'empresa' ? '#34d399' : '#93c5fd',
                              border: `1px solid ${lead.tipoUsuario === 'empresa' ? '#1c3829' : '#202a50'}`,
                            }}
                          >
                            {lead.tipoUsuario === 'empresa' ? 'ðŸ¢ Empresa' : 'ðŸ‘¤ Particular'}
                          </span>
                          {lead.empresaNombre && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                              {lead.empresaNombre}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 500, color: '#475569' }}>{lead.motivoConsulta || lead.documento || '-'}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>Formato: {lead.formato?.toUpperCase() || 'PDF'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {amount !== undefined && amount > 0 ? `Gs. ${amount.toLocaleString('es-PY')}` : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {lead.sincronizado ? (
                            <span style={{ fontSize: '11px', color: '#34d399', background: '#14201a', border: '1px solid #1c3829', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              SÃ
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#f87171', background: '#261417', border: '1px solid #471d24', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              PENDIENTE
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {!lead.sincronizado && (
                              <button
                                onClick={() => handleMarkAsSynced(lead.id)}
                                title="Marcar como sincronizado"
                                style={{
                                  border: '1px solid #1c3829',
                                  background: '#14201a',
                                  color: '#34d399',
                                  borderRadius: '6px',
                                  padding: '3px 7px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                }}
                              >
                                âœ“
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(lead.id)}
                              title="Eliminar lead"
                              style={{
                                border: '1px solid #471d24',
                                background: '#261417',
                                color: '#f87171',
                                borderRadius: '6px',
                                padding: '3px 7px',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                            >
                              âœ•
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            fontSize: '12.5px',
            color: '#64748b',
          }}
        >
          <div>
            Mostrando {filteredLeads.length} de {leads.length} leads capturados
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0369a1')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0284c7')}
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};
