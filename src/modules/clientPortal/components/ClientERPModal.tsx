/**
 * MODAL PRINCIPAL DEL ERP DE CLIENTES — LABORAPY
 * Contenedor maestro con selector de empresa, navegación por módulos y cierre de sesión
 */

import React, { useState } from 'react';
import type { ClientSession, Empleado, EmpresaCliente } from '../types/clientPortal';
import { logoutClient, switchClientEmpresa, updateCurrentEmpresa } from '../services/clientAuthService';
import { ClientDashboardTab } from './ClientDashboardTab';
import { CompanyProfileTab } from './CompanyProfileTab';
import { EmployeeDirectoryTab } from './EmployeeDirectoryTab';
import { SalaryReceiptsTab } from './SalaryReceiptsTab';
import { EmploymentContractsTab } from './EmploymentContractsTab';
import { VacationsManagementTab } from './VacationsManagementTab';
import { IpsComplianceTab } from './IpsComplianceTab';
import { MtessComplianceTab } from './MtessComplianceTab';
import { AttendanceAndPayrollTab } from './AttendanceAndPayrollTab';
import { PreMtessAuditTab } from './PreMtessAuditTab';
import { RecruitmentERPTab } from '../../recruitment';
import { MonthlyPayrollModule } from '../../monthlyPayroll';
import { TobiChatModal, TobiFloatingButton } from '../../assistant';

interface Props {
  isOpen: boolean;
  session: ClientSession;
  onClose: () => void;
  onLogout: () => void;
  onSimulateSettlement?: (empleado: Empleado) => void;
}

export const ClientERPModal: React.FC<Props> = ({
  isOpen,
  session,
  onClose,
  onLogout,
  onSimulateSettlement,
}) => {
  const [currentSession, setCurrentSession] = useState<ClientSession>(session);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSwitchEmpresa = (nuevaEmpresaId: string) => {
    const updated = switchClientEmpresa(nuevaEmpresaId);
    if (updated) {
      setCurrentSession({ ...updated });
    }
  };

  const handleLogout = () => {
    logoutClient();
    onLogout();
    onClose();
  };

  const handleEmpresaUpdated = (empresaActualizada: EmpresaCliente) => {
    const updated = updateCurrentEmpresa(empresaActualizada);
    if (updated) {
      setCurrentSession({ ...updated });
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard & Costos', icon: '📊' },
    { id: 'company', label: 'Datos de la Empresa', icon: '🏢' },
    { id: 'employees', label: 'Ficha de Empleados', icon: '👥' },
    { id: 'attendance', label: 'Presentismo & Marcaciones', icon: '⏰' },
    { id: 'receipts', label: 'Recibos de Salario', icon: '💵' },
    { id: 'payroll', label: 'Liquidación Mensual', icon: '💰' },
    { id: 'contracts', label: 'Contratos Laborales', icon: '📄' },
    { id: 'vacations', label: 'Vacaciones & MTESS', icon: '🏖️' },
    { id: 'ips', label: 'IPS (TXT & Extractos)', icon: '🏥' },
    { id: 'mtess', label: 'MTESS (Libros & REOP)', icon: '⚖️' },
    { id: 'audit', label: 'Auditoría Pre-MTESS 🛡️', icon: '🛡️' },
    { id: 'recruitment', label: 'Bolsa de Talentos 🤝', icon: '🤝' },
    { id: 'assistant', label: 'Tobi Copilot RRHH ✨', icon: '✨' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Barra Superior del ERP ── */}
      <header
        className="erp-modal-header"
        style={{
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          padding: '12px 24px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '24px' }}>🏢</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              LaboraPy ERP · Portal Clientes
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
              {currentSession.empresa.razonSocial}
            </div>
          </div>

          {/* Selector de Empresa (Multi-tenant) */}
          {currentSession.empresasDisponibles.length > 1 && (
            <select
              value={currentSession.empresa.id}
              onChange={e => handleSwitchEmpresa(e.target.value)}
              style={{
                marginLeft: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Cambiar de empresa o razón social"
            >
              {currentSession.empresasDisponibles.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombreFantasia || emp.razonSocial} ({emp.ruc}-{emp.dv})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Info Usuario y Botones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Botón rápido de Tobi Copilot RRHH para clientes */}
          <button
            onClick={() => setIsAssistantOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #065f46 100%)',
              border: '1px solid #10b981',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
            title="Abrir Tobi Copilot RRHH (Asistente Inteligente)"
          >
            <span>✨</span>
            <span>Tobi Copilot</span>
          </button>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              {currentSession.usuario.nombreContacto}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {currentSession.usuario.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Salir
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Volver a la Web ✕
          </button>
        </div>
      </header>

      {/* ── Barra de Navegación por Pestañas ── */}
      <nav
        className="erp-nav-tabs"
        style={{
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '0 16px',
          gap: '4px',
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`erp-tab-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (tab.id === 'assistant') {
                  setIsAssistantOpen(true);
                } else {
                  setActiveTab(tab.id);
                }
              }}
              style={{
                padding: '12px 18px',
                background: isActive ? '#ffffff' : 'transparent',
                border: 'none',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                color: isActive ? '#0f172a' : '#94a3b8',
                fontWeight: isActive ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Contenido Principal Scrollable ── */}
      <main
        className="erp-main-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#f8fafc',
        }}
      >
        <div style={{ maxWidth: activeTab === 'payroll' ? '100%' : '1280px', margin: '0 auto', padding: activeTab === 'payroll' ? '0 12px' : undefined }}>
          {activeTab === 'dashboard' && (
            <ClientDashboardTab
              empresa={currentSession.empresa}
              onNavigateTab={tabId => setActiveTab(tabId)}
              onEmitirNotaPrueba={() => {
                setActiveTab('contracts');
              }}
            />
          )}

          {activeTab === 'company' && (
            <CompanyProfileTab
              empresa={currentSession.empresa}
              onEmpresaUpdated={handleEmpresaUpdated}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeDirectoryTab
              empresa={currentSession.empresa}
              onSimulateSettlement={emp => {
                if (onSimulateSettlement) {
                  onSimulateSettlement(emp);
                  onClose();
                }
              }}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceAndPayrollTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'receipts' && (
            <SalaryReceiptsTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'payroll' && (
            <MonthlyPayrollModule empresa={currentSession.empresa} />
          )}

          {activeTab === 'contracts' && (
            <EmploymentContractsTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'vacations' && (
            <VacationsManagementTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'ips' && (
            <IpsComplianceTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'mtess' && (
            <MtessComplianceTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'audit' && (
            <PreMtessAuditTab empresa={currentSession.empresa} />
          )}

          {activeTab === 'recruitment' && (
            <RecruitmentERPTab empresa={currentSession.empresa} />
          )}

          {/* ── Tobi Copilot RRHH (Chatbot Inteligente tipo Gemini) — Exclusivo Clientes ERP ── */}
          <TobiChatModal
            isOpen={isAssistantOpen || activeTab === 'assistant'}
            onClose={() => {
              setIsAssistantOpen(false);
              if (activeTab === 'assistant') {
                setActiveTab('dashboard');
              }
            }}
            companyName={currentSession.empresa.nombreFantasia || currentSession.empresa.razonSocial}
            clientId={currentSession.usuario.clienteId}
            companyId={currentSession.empresa.id}
          />

          {/* Botón flotante para invocar a Tobi desde cualquier parte del ERP */}
          <TobiFloatingButton
            onClick={() => setIsAssistantOpen(true)}
            isOpen={isAssistantOpen || activeTab === 'assistant'}
          />
        </div>
      </main>
    </div>
  );
};
