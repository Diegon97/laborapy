/**
 * MODAL DE CONFIGURACIÓN RÃPIDA DE META ADS (FACEBOOK & INSTAGRAM ADS)
 * Permite ingresar el Pixel ID de Meta en 5 segundos sin tocar código.
 * Sistema de diseño Linear: Canvas #f8fafc, Surface-1 #ffffff, Surface-2 #f8fafc, Borders #e2e8f0.
 * Versión: PY-LIQ-2026.09.01
 */

import React, { useState, useEffect } from 'react';
import { getMetaPixelId, setMetaPixelId, trackMetaCustomEvent } from './metaPixel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MetaPixelConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [pixelId, setPixelIdState] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPixelIdState(getMetaPixelId());
      setSavedSuccess(false);
      setTestSent(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setMetaPixelId(pixelId);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleEnviarEventoPrueba = () => {
    trackMetaCustomEvent('PruebaConexionMetaAds', {
      timestamp: new Date().toISOString(),
      estado: 'Conexión Exitosa',
      plataforma: 'Calculadora RRHH Paraguay',
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3500);
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
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          border: '1px solid #e2e8f0',
          fontFamily: 'inherit',
          color: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>ðŸŽ¯</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Conexión con Meta Ads (Facebook / Instagram)
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
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

        <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }}>
          Ingresa tu <strong>Meta Pixel ID</strong> para medir automáticamente conversiones, descargas de finiquitos y leads en tus campañas de Facebook e Instagram Ads.
        </p>

        <form onSubmit={handleGuardar}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.4px' }}>
              Meta Pixel ID (Conjunto de Datos):
            </label>
            <input
              type="text"
              placeholder="Ej: 123456789012345"
              value={pixelId}
              onChange={e => setPixelIdState(e.target.value)}
              style={{
                width: '100%',
                minHeight: '40px',
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '0.5px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '5px' }}>
              Encuéntralo en Meta Events Manager (Administrador de Eventos) â†’ Orígenes de datos.
            </span>
          </div>

          {savedSuccess && (
            <div style={{ padding: '10px 14px', background: '#14201a', border: '1px solid #1c3829', color: '#34d399', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, marginBottom: '14px' }}>
              âœ… Pixel ID guardado e inicializado correctamente.
            </div>
          )}

          {testSent && (
            <div style={{ padding: '10px 14px', background: '#162035', border: '1px solid #223760', color: '#60a5fa', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, marginBottom: '14px' }}>
              ðŸš€ Evento de prueba enviado a Meta Pixel (revisa en Meta Events Manager).
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '12px', color: '#475569' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '5px' }}>Eventos rastreados automáticamente:</div>
            <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.6', color: '#64748b' }}>
              <li><strong style={{ color: '#0f172a' }}>Lead:</strong> Al calcular cualquier liquidación de haberes.</li>
              <li><strong style={{ color: '#0f172a' }}>Purchase / Descarga:</strong> Al exportar el finiquito oficial en PDF o Word.</li>
              <li><strong style={{ color: '#0f172a' }}>SubmitApplication:</strong> Al generar notas de despido o renuncia.</li>
              <li><strong style={{ color: '#0f172a' }}>ViewContent:</strong> Al cambiar entre módulos y herramientas.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {pixelId && (
              <button
                type="button"
                onClick={handleEnviarEventoPrueba}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #2a4680',
                  background: '#162035',
                  color: '#93c5fd',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ðŸ“¡ Enviar Evento de Prueba
              </button>
            )}
            <button
              type="submit"
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0369a1')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0284c7')}
            >
              ðŸ’¾ Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
