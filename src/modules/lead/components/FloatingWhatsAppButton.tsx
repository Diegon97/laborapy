/**
 * BOTÓN FLOTANTE DIRECTO DE CONTACTO POR WHATSAPP (+595)
 * LaboraPy - Soluciones Laborales y Contables
 * Proporciona un canal comercial de alta conversión siempre accesible.
 */

import React, { useState } from 'react';
import { LABORAPY_CONFIG, createWhatsAppUrl, WhatsAppMessages } from '../../../config/laborapy';

interface Props {
  montoNetoEstimado?: number;
}

export const FloatingWhatsAppButton: React.FC<Props> = ({ montoNetoEstimado }) => {
  const [isOpenMenu, setIsOpenMenu] = useState(false);

  const defaultUrl = createWhatsAppUrl(
    montoNetoEstimado && montoNetoEstimado > 0
      ? WhatsAppMessages.calculoResultado(montoNetoEstimado)
      : WhatsAppMessages.general()
  );

  const b2bUrl = createWhatsAppUrl(WhatsAppMessages.b2bEmpresas());
  const b2cUrl = createWhatsAppUrl(WhatsAppMessages.b2cParticulares());
  const seleccionUrl = createWhatsAppUrl(WhatsAppMessages.seleccionEmpresa());
  const contabilidadUrl = createWhatsAppUrl(WhatsAppMessages.contabilidadGeneral());

  return (
    <div className="floating-whatsapp-container" aria-label="Contacto directo por WhatsApp">
      {/* Menú desplegable emergente al hacer hover o clic en expandir */}
      {isOpenMenu && (
        <div className="whatsapp-popup-card">
          <div className="whatsapp-popup-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🇵🇾</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                  {LABORAPY_CONFIG.brandName}
                </div>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                  ● Especialistas en línea ({LABORAPY_CONFIG.whatsAppDisplay})
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpenMenu(false)}
              style={{
                border: 'none',
                background: '#f1f5f9',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', lineHeight: '1.4' }}>
            ¿En qué podemos ayudarte hoy? Selecciona tu consulta para derivarte de inmediato:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <a
              href={contabilidadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-popup-option"
              onClick={() => setIsOpenMenu(false)}
            >
              <span style={{ fontSize: '16px' }}>📊</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Contabilidad, IVA & Balances</div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>F120, RG 90, IRE/IRP y Balances Bancos/DNCP</div>
              </div>
            </a>

            <a
              href={seleccionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-popup-option"
              onClick={() => setIsOpenMenu(false)}
            >
              <span style={{ fontSize: '16px' }}>👥</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Búsqueda y Selección</div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Operativos, Supervisores, Profesionales / CV</div>
              </div>
            </a>

            <a
              href={b2bUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-popup-option"
              onClick={() => setIsOpenMenu(false)}
            >
              <span style={{ fontSize: '16px' }}>🏢</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Empresa / Desvinculaciones</div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Asesoría de liquidaciones y nóminas</div>
              </div>
            </a>

            <a
              href={b2cUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-popup-option"
              onClick={() => setIsOpenMenu(false)}
            >
              <span style={{ fontSize: '16px' }}>👤</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Colaborador / Tu Caso</div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Revisión antes de firmar finiquito</div>
              </div>
            </a>
          </div>

          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <a
              href={defaultUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#059669', fontWeight: 700, textDecoration: 'none' }}
              onClick={() => setIsOpenMenu(false)}
            >
              O iniciar chat general directo ➔
            </a>
          </div>
        </div>
      )}

      {/* Botón Flotante Principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="whatsapp-bubble-pill"
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          title="Opciones de contacto"
        >
          <span className="whatsapp-online-dot"></span>
          <span>¿Dudas? Hablá con LaboraPy</span>
        </button>

        <a
          href={defaultUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-main-btn"
          aria-label="Abrir WhatsApp LaboraPy"
          title={`Contactar a LaboraPy por WhatsApp (${LABORAPY_CONFIG.whatsAppDisplay})`}
        >
          {/* SVG Oficial de WhatsApp */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="#ffffff"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.507 14.307l-.009.075c-.238-.12-1.406-.694-1.624-.773-.219-.079-.378-.119-.537.12-.159.239-.616.774-.755.933-.139.159-.279.179-.517.06-.239-.12-1.008-.372-1.92-1.185-.709-.633-1.188-1.415-1.328-1.654-.139-.239-.015-.368.105-.487.108-.107.239-.279.359-.418.12-.139.159-.239.239-.398.08-.159.04-.299-.02-.418-.06-.12-.537-1.294-.736-1.773-.194-.467-.392-.403-.537-.411l-.458-.008c-.159 0-.418.06-.637.299-.219.239-.836.817-.836 1.992s.856 2.311.976 2.47c.12.159 1.684 2.572 4.08 3.606.57.246 1.015.393 1.363.504.573.182 1.094.157 1.506.095.459-.069 1.406-.575 1.605-1.131.199-.556.199-1.033.139-1.131-.06-.098-.219-.158-.458-.278z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.477 2 12c0 1.892.527 3.663 1.442 5.176L2 22l4.966-1.407A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2a8.167 8.167 0 0 1-4.22-1.168l-.303-.18-2.95.837.848-2.875-.198-.315A8.163 8.163 0 0 1 3.8 12c0-4.522 3.678-8.2 8.2-8.2 4.522 0 8.2 3.678 8.2 8.2 0 4.522-3.678 8.2-8.2 8.2z"
            />
          </svg>
        </a>
      </div>
    </div>
  );
};
