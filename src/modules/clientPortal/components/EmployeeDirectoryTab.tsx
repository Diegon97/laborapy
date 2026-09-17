/**
 * FICHA ELECTRÓNICA Y NÓMINA DE EMPLEADOS — ERP LABORAPY
 * Legajo digital, gestión de personal, certificados con QR y pre-liquidación
 */

import React, { useState } from 'react';
import type { EmpresaCliente, Empleado } from '../types/clientPortal';
import {
  getEmpleadosByCliente,
  saveEmpleado,
  deleteEmpleado,
  formatPYG,
  SALARIO_MINIMO_LEGAL_PY,
} from '../services/clientStorageService';
import { generarNotaLaboralPDF } from '../../payroll/generators/noticePdfGenerator';
import { MaternityLactationModal } from './MaternityLactationModal';
import { QuickSettlementModal } from './QuickSettlementModal';
import { EmployeeTransferModal } from './EmployeeTransferModal';
import {
  buildSucursalesOptions,
  getSucursalById,
  DEPARTAMENTOS_PARAGUAY,
} from '../types/clientPortal';
import {
  exportarNominaAExcel,
  descargarPlantillaExcel,
  parseAndValidateExcelNomina,
  type ExcelImportResult,
} from '../services/employeeExcelService';

interface Props {
  empresa: EmpresaCliente;
  onSimulateSettlement?: (empleado: Empleado) => void;
}

export const EmployeeDirectoryTab: React.FC<Props> = ({ empresa, onSimulateSettlement }) => {
  const [empleados, setEmpleados] = useState<Empleado[]>(() => getEmpleadosByCliente(empresa.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [filterSucursal, setFilterSucursal] = useState<string>('todas');

  // Modal de Alta / Edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null);

  // Modal de Traslado de Sucursal (Arts. 67, 72, 81 Ley 213/93)
  const [transferEmployee, setTransferEmployee] = useState<Empleado | null>(null);

  // Modal de Ficha Electrónica Detallada
  const [viewingEmployee, setViewingEmployee] = useState<Empleado | null>(null);

  // Modal de Maternidad & Lactancia (Ley 5508/15)
  const [maternityEmployee, setMaternityEmployee] = useState<Empleado | null>(null);

  // Modal de Liquidación Rápida (Casos más comunes: Despido Injustificado, Abandono de Trabajo, Renuncia)
  const [quickSettlementEmployee, setQuickSettlementEmployee] = useState<Empleado | null>(null);

  // Estados para Operaciones Masivas Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const reloadData = () => {
    setEmpleados(getEmpleadosByCliente(empresa.id));
  };

  const handleExportarExcel = () => {
    exportarNominaAExcel(filteredEmpleados, empresa);
  };

  const handleDescargarPlantilla = () => {
    descargarPlantillaExcel();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const res = await parseAndValidateExcelNomina(file, empresa.id, empleados);
      setImportResult(res);
      setIsImportModalOpen(true);
    } catch (err: any) {
      alert('Error al procesar el archivo Excel: ' + (err?.message || String(err)));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmarImportacion = () => {
    if (!importResult || importResult.validEmployees.length === 0) return;
    importResult.validEmployees.forEach(emp => {
      saveEmpleado(emp);
    });
    alert(`¡Éxito! Se han importado ${importResult.validEmployees.length} colaboradores al legajo digital.`);
    setIsImportModalOpen(false);
    setImportResult(null);
    reloadData();
  };

  const filteredEmpleados = empleados.filter(e => {
    const matchesSearch =
      e.ci.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cargo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = filterEstado === 'todos' ? true : e.estado === filterEstado;
    const resolvedSucursal = getSucursalById(empresa, e.sucursalId);
    const matchesSucursal =
      filterSucursal === 'todas'
        ? true
        : (resolvedSucursal?.id || 'casa_central') === filterSucursal;

    return matchesSearch && matchesEstado && matchesSucursal;
  });

  const handleOpenCreate = () => {
    const sucursales = buildSucursalesOptions(empresa);
    const defaultSucursal = sucursales[0];

    setEditingEmployee({
      id: `emp_${Date.now()}`,
      clienteId: empresa.id,
      ci: '',
      nombres: '',
      apellidos: '',
      nacionalidad: 'Paraguaya',
      estadoCivil: 'Soltero/a',
      sexo: 'M',
      hijosMenores: 0,
      cargo: '',
      departamento: 'Operaciones',
      sucursalId: defaultSucursal?.id || 'casa_central',
      lugarTrabajo: defaultSucursal?.direccion || empresa.direccion || 'Casa Central',
      departamentoGeografico: defaultSucursal?.departamentoGeografico || 'Central',
      fechaIngreso: new Date().toISOString().split('T')[0],
      salarioBase: SALARIO_MINIMO_LEGAL_PY,
      modalidadPago: 'mensual',
      estado: 'activo',
      periodoPruebaDias: 30,
      vacacionesCausadasAcumuladas: 0,
      vacacionesTomadas: 0,
      createdAt: new Date().toISOString(),
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (emp: Empleado) => {
    setEditingEmployee({ ...emp });
    setIsEditModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    if (!editingEmployee.ci.trim() || !editingEmployee.nombres.trim() || !editingEmployee.apellidos.trim()) {
      alert('Por favor complete Cédula, Nombres y Apellidos.');
      return;
    }

    saveEmpleado(editingEmployee);
    setIsEditModalOpen(false);
    setEditingEmployee(null);
    reloadData();
  };

  const handleDeleteEmployee = (id: string, nombre: string) => {
    if (confirm(`¿Confirma que desea eliminar el registro de ${nombre}?`)) {
      deleteEmpleado(id);
      reloadData();
    }
  };

  const handleDescargarCertificado = (emp: Empleado) => {
    const pdf = generarNotaLaboralPDF({
      tipo: 'certificado_trabajo',
      empresa: empresa.razonSocial,
      lugarFecha: `Asunción, ${new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      nombreEmpleado: `${emp.nombres} ${emp.apellidos}`,
      ciEmpleado: emp.ci,
      cargoEmpleado: emp.cargo,
      fechaIngreso: emp.fechaIngreso,
      salarioMensual: emp.salarioBase,
      incluirSalarioEnCertificado: true,
    });
    pdf.save(`CERTIFICADO_LABORAL_${emp.ci}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Barra de Herramientas y Filtros ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div className="erp-filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, minWidth: '0' }}>
          <input
            type="text"
            placeholder="🔍 Buscar por Cédula, Nombre o Cargo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13.5px',
              minWidth: 'min(100%, 240px)',
              outline: 'none',
            }}
          />

          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              background: '#ffffff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="todos">Todos los Estados ({empleados.length})</option>
            <option value="activo">Activos</option>
            <option value="prueba">En Período de Prueba</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={filterSucursal}
            onChange={e => setFilterSucursal(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              background: '#ffffff',
              outline: 'none',
              cursor: 'pointer',
            }}
            title="Filtrar colaboradores por sucursal o establecimiento"
          >
            <option value="todas">🏢 Todas las Sucursales ({empleados.length})</option>
            {buildSucursalesOptions(empresa).map(op => (
              <option key={op.id} value={op.id}>
                {op.esCasaCentral ? '🏠' : '🏢'} {op.nombre} {op.departamentoGeografico ? `(${op.departamentoGeografico})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
          />

          <button
            onClick={handleDescargarPlantilla}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Descargar plantilla oficial Excel para carga masiva de colaboradores"
          >
            <span>📄</span>
            <span>Plantilla Excel</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: isImporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Cargar archivo Excel con colaboradores para dar de alta en masa"
          >
            <span>📥</span>
            <span>{isImporting ? 'Procesando...' : 'Importar Excel'}</span>
          </button>

          <button
            onClick={handleExportarExcel}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Exportar nómina a formato Excel oficial de RRHH"
          >
            <span>📤</span>
            <span>Exportar Nómina ({filteredEmpleados.length})</span>
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
            }}
          >
            <span>➕</span>
            <span>Dar de Alta Empleado</span>
          </button>
        </div>
      </div>

      {/* ── Tabla de Empleados ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>EMPLEADO / C.I.</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>CARGO & DEPTO.</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>INGRESO</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>SUELDO BASE</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>HIJOS (BONIF.)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>ESTADO</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No se encontraron empleados registrados.
                  </td>
                </tr>
              ) : (
                filteredEmpleados.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>
                        {emp.nombres} {emp.apellidos}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        C.I. N.º {emp.ci} · IPS: {emp.nroIps || 'Pendiente'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{emp.cargo}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {emp.departamento}
                        {emp.lugarTrabajo && ` · 📍 ${emp.lugarTrabajo}`}
                      </div>
                      {(() => {
                        const suc = getSucursalById(empresa, emp.sucursalId);
                        return suc ? (
                          <div style={{ marginTop: '4px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: suc.esCasaCentral ? '#f1f5f9' : '#eff6ff',
                                color: suc.esCasaCentral ? '#475569' : '#1d4ed8',
                                border: `1px solid ${suc.esCasaCentral ? '#cbd5e1' : '#bfdbfe'}`,
                              }}
                              title={`Patronal MTESS: ${suc.nroPatronalMtess || 'Casa Central'} | IPS: ${suc.nroPatronalIps || 'Casa Central'}`}
                            >
                              {suc.esCasaCentral ? '🏠' : '🏢'} {suc.nombre}
                              {suc.departamentoGeografico ? ` (${suc.departamentoGeografico})` : ''}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </td>

                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {emp.fechaIngreso}
                    </td>

                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                      {formatPYG(emp.salarioBase)}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {emp.hijosMenores > 0 ? (
                        <span style={{ color: '#059669', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px' }}>
                          👶 {emp.hijosMenores} ({formatPYG(Math.round(SALARIO_MINIMO_LEGAL_PY * 0.05 * emp.hijosMenores))})
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>0</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background:
                              emp.estado === 'activo'
                                ? '#dcfce7'
                                : emp.estado === 'prueba'
                                ? '#fef9c3'
                                : '#fee2e2',
                            color:
                              emp.estado === 'activo'
                                ? '#15803d'
                                : emp.estado === 'prueba'
                                ? '#854d0e'
                                : '#991b1b',
                          }}
                        >
                          {emp.estado === 'prueba' ? 'A Prueba' : emp.estado}
                        </span>

                        {emp.estadoMaternidad && emp.estadoMaternidad !== 'ninguno' && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background:
                                emp.estadoMaternidad === 'embarazada'
                                  ? '#fdf2f8'
                                  : emp.estadoMaternidad === 'reposo_maternidad'
                                  ? '#f5f3ff'
                                  : emp.estadoMaternidad === 'lactancia_obligatoria'
                                  ? '#ecfeff'
                                  : '#fffbeb',
                              color:
                                emp.estadoMaternidad === 'embarazada'
                                  ? '#db2777'
                                  : emp.estadoMaternidad === 'reposo_maternidad'
                                  ? '#7c3aed'
                                  : emp.estadoMaternidad === 'lactancia_obligatoria'
                                  ? '#0891b2'
                                  : '#b45309',
                              border: `1px solid ${
                                emp.estadoMaternidad === 'embarazada'
                                  ? '#fbcfe8'
                                  : emp.estadoMaternidad === 'reposo_maternidad'
                                  ? '#ddd6fe'
                                  : emp.estadoMaternidad === 'lactancia_obligatoria'
                                  ? '#a5f3fc'
                                  : '#fde68a'
                              }`,
                            }}
                          >
                            {emp.estadoMaternidad === 'embarazada' && '🤰 Embarazo'}
                            {emp.estadoMaternidad === 'reposo_maternidad' && '🏥 Reposo 18 sem'}
                            {emp.estadoMaternidad === 'lactancia_obligatoria' && '🍼 Lactancia 90m'}
                            {emp.estadoMaternidad === 'lactancia_extendida' && '👶 Lact. Ext. 24m'}
                            {emp.estadoMaternidad === 'lactancia_finalizada' && '🏁 Fin Lactancia'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {(emp.sexo === 'F' || (emp.estadoMaternidad && emp.estadoMaternidad !== 'ninguno')) && (
                          <button
                            onClick={() => setMaternityEmployee(emp)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fbcfe8',
                              background: '#fdf2f8',
                              color: '#db2777',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title="Gestionar Maternidad, Reposo de 18 semanas y Lactancia (Ley 5508/15)"
                          >
                            <span>🤰</span>
                            <span>Maternidad</span>
                          </button>
                        )}
                        <button
                          onClick={() => setQuickSettlementEmployee(emp)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #c7d2fe',
                            background: '#eef2ff',
                            color: '#4338ca',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Calcular Liquidación Rápida (Despido Injustificado, Abandono de Trabajo, Renuncia Voluntaria)"
                        >
                          <span>⚡</span>
                          <span>Liquidar</span>
                        </button>
                        <button
                          onClick={() => setTransferEmployee(emp)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fed7aa',
                            background: '#fff7ed',
                            color: '#c2410c',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Mudar de Sucursal y Generar Nota Oficial de Traslado (Arts. 67, 72, 81 Ley 213/93)"
                        >
                          <span>🔄</span>
                          <span>Trasladar</span>
                        </button>
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Ver Legajo Electrónico Completo"
                        >
                          Ficha
                        </button>
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Editar Datos"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, `${emp.nombres} ${emp.apellidos}`)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fee2e2',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE FICHA ELECTRÓNICA COMPLETA (LEGAJO DIGITAL) ── */}
      {viewingEmployee && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setViewingEmployee(null)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '680px',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header Ficha */}
            <div style={{ background: '#ffffff', padding: '20px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Legajo Electrónico del Trabajador
                </div>
                <h3 style={{ margin: '3px 0 0', fontSize: '18px', fontWeight: 800 }}>
                  {viewingEmployee.nombres} {viewingEmployee.apellidos}
                </h3>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Contenido Ficha */}
            <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Cédula de Identidad</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{viewingEmployee.ci}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Nacionalidad & Estado Civil</div>
                  <div style={{ fontSize: '13.5px', color: '#0f172a' }}>{viewingEmployee.nacionalidad} · {viewingEmployee.estadoCivil}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Fecha de Nacimiento</div>
                  <div style={{ fontSize: '13.5px', color: '#0f172a' }}>{viewingEmployee.fechaNacimiento || 'No registrada'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Hijos Menores de 18 años</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: viewingEmployee.hijosMenores > 0 ? '#059669' : '#64748b' }}>
                    {viewingEmployee.hijosMenores} hijo(s)
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  Datos Laborales & Remuneración (Art. 235)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Cargo</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{viewingEmployee.cargo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Departamento</div>
                    <div style={{ fontSize: '13.5px', color: '#0f172a' }}>{viewingEmployee.departamento}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Fecha de Ingreso</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>{viewingEmployee.fechaIngreso}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Salario Base Mensual</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0284c7' }}>{formatPYG(viewingEmployee.salarioBase)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>N.º Asegurado IPS</div>
                    <div style={{ fontSize: '13.5px', color: '#0f172a' }}>{viewingEmployee.nroIps || 'N/D'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Vacaciones Pendientes</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#16a34a' }}>
                      {Math.max(0, viewingEmployee.vacacionesCausadasAcumuladas - viewingEmployee.vacacionesTomadas)} días
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección de Establecimiento, Sucursal y Patronales */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                    Establecimiento, Sucursal & Patronales
                  </h4>
                  <button
                    onClick={() => {
                      const emp = viewingEmployee;
                      setViewingEmployee(null);
                      setTransferEmployee(emp);
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#c2410c',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Mudar de Sucursal
                  </button>
                </div>
                {(() => {
                  const suc = getSucursalById(empresa, viewingEmployee.sucursalId);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>Sucursal Asignada</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                          {suc ? `${suc.esCasaCentral ? '🏠' : '🏢'} ${suc.nombre}` : 'Casa Central'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>Lugar de Trabajo / Dirección</div>
                        <div style={{ fontSize: '13.5px', color: '#0f172a' }}>
                          {viewingEmployee.lugarTrabajo || suc?.direccion || empresa.direccion || 'Casa Central'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>Departamento Geográfico</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                          {viewingEmployee.departamentoGeografico || suc?.departamentoGeografico || 'Central'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>N.º Patronal MTESS</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e40af' }}>
                          {suc?.nroPatronalMtess || empresa.nroPatronalMtess || 'N/D'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>N.º Patronal IPS</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#059669' }}>
                          {suc?.nroPatronalIps || empresa.nroPatronalIps || 'N/D'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sección de Maternidad y Lactancia (Ley 5508/15 y 7097/23) */}
              {(viewingEmployee.sexo === 'F' || (viewingEmployee.estadoMaternidad && viewingEmployee.estadoMaternidad !== 'ninguno')) && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      Protección de Maternidad & Lactancia (Ley N.º 5508/15 & 7097/23)
                    </h4>
                    <button
                      onClick={() => {
                        const empToOpen = viewingEmployee;
                        setViewingEmployee(null);
                        setMaternityEmployee(empToOpen);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#fdf2f8',
                        border: '1px solid #fbcfe8',
                        color: '#db2777',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⚙️ Gestionar Maternidad / Lactancia
                    </button>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '8px', background: '#fdf2f8', border: '1px solid #fbcfe8', fontSize: '12.5px', color: '#831843' }}>
                    {viewingEmployee.estadoMaternidad && viewingEmployee.estadoMaternidad !== 'ninguno' ? (
                      <div>
                        <strong>Estado registrado: </strong>
                        {viewingEmployee.estadoMaternidad === 'embarazada' && '🤰 Embarazo Notificado · Fuero Maternal Activo (Inamovilidad Legal Art. 136)'}
                        {viewingEmployee.estadoMaternidad === 'reposo_maternidad' && '🏥 Reposo de Maternidad de 18 Semanas (126 días) subsidiado 100% por IPS'}
                        {viewingEmployee.estadoMaternidad === 'lactancia_obligatoria' && '🍼 Lactancia Obligatoria de 90 min diarios (Primeros 6 meses de vida)'}
                        {viewingEmployee.estadoMaternidad === 'lactancia_extendida' && '👶 Lactancia Extendida hasta los 24 meses (Certificados Pediátricos Trimestrales Ley 7097/23)'}
                        {viewingEmployee.estadoMaternidad === 'lactancia_finalizada' && '🏁 Período de Lactancia Legal Concluido'}
                      </div>
                    ) : (
                      <div>
                        No registra expediente activo de maternidad. Presione "Gestionar Maternidad / Lactancia" para registrar gravidez, cronograma de reposo o acuerdos de horario de lactancia.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acciones Rápidas de Alto Valor */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  onClick={() => handleDescargarCertificado(viewingEmployee)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#059669',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>📜</span>
                  <span>Descargar Certificado Laboral PDF (con QR)</span>
                </button>
                <button
                  onClick={() => {
                    const emp = viewingEmployee;
                    setViewingEmployee(null);
                    setQuickSettlementEmployee(emp);
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    color: '#4338ca',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>⚡</span>
                  <span>Liquidar (Despido, Abandono, Renuncia)</span>
                </button>

                {onSimulateSettlement && (
                  <button
                    onClick={() => {
                      onSimulateSettlement(viewingEmployee);
                      setViewingEmployee(null);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#4f46e5',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🧮</span>
                    <span>Simular Finiquito en Calculadora</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CREACIÓN / EDICIÓN DE EMPLEADO ── */}
      {isEditModalOpen && editingEmployee && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '620px',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#ffffff', padding: '18px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                {editingEmployee.ci ? 'Modificar Datos del Empleado' : 'Registrar Nuevo Empleado'}
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Cédula de Identidad (C.I.) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.ci}
                    onChange={e => setEditingEmployee({ ...editingEmployee, ci: e.target.value })}
                    placeholder="Ej: 4.123.456"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    N.º Asegurado IPS
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.nroIps || ''}
                    onChange={e => setEditingEmployee({ ...editingEmployee, nroIps: e.target.value })}
                    placeholder="Ej: 4123456-01"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Nombres *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.nombres}
                    onChange={e => setEditingEmployee({ ...editingEmployee, nombres: e.target.value })}
                    placeholder="Ej: Juan Carlos"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.apellidos}
                    onChange={e => setEditingEmployee({ ...editingEmployee, apellidos: e.target.value })}
                    placeholder="Ej: Pérez Rodríguez"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Cargo Laboral *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.cargo}
                    onChange={e => setEditingEmployee({ ...editingEmployee, cargo: e.target.value })}
                    placeholder="Ej: Auxiliar Contable"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Departamento / Área
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.departamento}
                    onChange={e => setEditingEmployee({ ...editingEmployee, departamento: e.target.value })}
                    placeholder="Ej: Administración"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Sucursal Asignada *
                  </label>
                  <select
                    value={editingEmployee.sucursalId || 'casa_central'}
                    onChange={e => {
                      const selectedSucId = e.target.value;
                      const options = buildSucursalesOptions(empresa);
                      const suc = options.find(s => s.id === selectedSucId);
                      setEditingEmployee({
                        ...editingEmployee,
                        sucursalId: selectedSucId,
                        lugarTrabajo:
                          !editingEmployee.lugarTrabajo || editingEmployee.lugarTrabajo === 'Casa Central'
                            ? (suc?.direccion || empresa.direccion || 'Casa Central')
                            : editingEmployee.lugarTrabajo,
                        departamentoGeografico:
                          !editingEmployee.departamentoGeografico || editingEmployee.departamentoGeografico === 'Central'
                            ? (suc?.departamentoGeografico || 'Central')
                            : editingEmployee.departamentoGeografico,
                      });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {buildSucursalesOptions(empresa).map(op => (
                      <option key={op.id} value={op.id}>
                        {op.esCasaCentral ? '🏠' : '🏢'} {op.nombre} {op.departamentoGeografico ? `(${op.departamentoGeografico})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Lugar de Trabajo (Establecimiento Físico)
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.lugarTrabajo || ''}
                    onChange={e => setEditingEmployee({ ...editingEmployee, lugarTrabajo: e.target.value })}
                    placeholder="Ej: Avda. Mcal. López 1234 c/ San Martín"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Departamento Geográfico (Paraguay) *
                  </label>
                  <select
                    value={editingEmployee.departamentoGeografico || 'Central'}
                    onChange={e => setEditingEmployee({ ...editingEmployee, departamentoGeografico: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {DEPARTAMENTOS_PARAGUAY.map(dep => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Fecha de Ingreso *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingEmployee.fechaIngreso}
                    onChange={e => setEditingEmployee({ ...editingEmployee, fechaIngreso: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Salario Base Mensual (PYG) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={editingEmployee.salarioBase}
                    onChange={e => setEditingEmployee({ ...editingEmployee, salarioBase: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Mínimo legal: {formatPYG(SALARIO_MINIMO_LEGAL_PY)}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Hijos Menores de 18 años (Bonificación Fam. 5%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={editingEmployee.hijosMenores}
                    onChange={e => setEditingEmployee({ ...editingEmployee, hijosMenores: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Hijos con Discapacidad (Art. 261 C.T. · Vitalicio)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={editingEmployee.hijosDiscapacidad || 0}
                    onChange={e => setEditingEmployee({ ...editingEmployee, hijosDiscapacidad: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Cobro de por vida sin límite de edad (5% SML)
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Pareja en esta Empresa (Art. 265 C.T.)
                  </label>
                  <select
                    value={editingEmployee.parejaEmpleadoId || ''}
                    onChange={e => setEditingEmployee({ ...editingEmployee, parejaEmpleadoId: e.target.value || undefined })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="">Ninguna / No trabaja en la empresa</option>
                    {empleados
                      .filter(e => e.id !== editingEmployee.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombres} {c.apellidos} ({c.ci}) · {c.sexo === 'F' ? 'Madre' : 'Padre'}
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Si ambos trabajan en la empresa, cobra la madre con exclusividad.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    Estado del Trabajador
                  </label>
                  <select
                    value={editingEmployee.estado}
                    onChange={e => setEditingEmployee({ ...editingEmployee, estado: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="activo">Activo (Estable)</option>
                    <option value="prueba">En Período de Prueba (Art. 58)</option>
                    <option value="suspendido">Suspendido</option>
                    <option value="vacaciones">De Vacaciones</option>
                    <option value="inactivo">Inactivo / Egresado</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '6px', background: '#0284c7', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Guardar Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE MATERNIDAD, REPOSO 18 SEM & HORARIO DE LACTANCIA ── */}
      {maternityEmployee && (
        <MaternityLactationModal
          empresa={empresa}
          empleado={maternityEmployee}
          isOpen={!!maternityEmployee}
          onClose={() => setMaternityEmployee(null)}
          onSaved={reloadData}
        />
      )}

      {/* ── MODAL DE LIQUIDACIÓN RÁPIDA (CASOS MÁS COMUNES: DESPIDO, ABANDONO, RENUNCIA) ── */}
      {quickSettlementEmployee && (
        <QuickSettlementModal
          isOpen={!!quickSettlementEmployee}
          onClose={() => setQuickSettlementEmployee(null)}
          empleado={quickSettlementEmployee}
          empresa={empresa}
          onOpenFullSimulation={() => {
            if (onSimulateSettlement) {
              onSimulateSettlement(quickSettlementEmployee);
            }
          }}
        />
      )}

      {/* ── MODAL DE VISTA PREVIA E IMPORTACIÓN EXCEL ── */}
      {isImportModalOpen && importResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: '#ffffff',
                padding: '18px 24px',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📥</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Importación Masiva de Colaboradores (Excel)
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>FILAS LEÍDAS</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{importResult.totalRows}</div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 700 }}>VÁLIDOS PARA ALTA</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669' }}>
                    {importResult.validEmployees.length}
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700 }}>OBSERVACIONES</div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#dc2626' }}>{importResult.errors.length}</div>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid #fde68a',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#92400e', marginBottom: '6px' }}>
                    ⚠️ Advertencias detectadas en la planilla:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#78350f' }}>
                    {importResult.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>
                VISTA PREVIA DE COLABORADORES A INCORPORAR ({importResult.validEmployees.length})
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>C.I.</th>
                      <th style={{ padding: '8px 12px' }}>Nombre Completo</th>
                      <th style={{ padding: '8px 12px' }}>Cargo</th>
                      <th style={{ padding: '8px 12px' }}>Salario Base</th>
                      <th style={{ padding: '8px 12px' }}>Modalidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.validEmployees.slice(0, 10).map((emp: Empleado) => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{emp.ci}</td>
                        <td style={{ padding: '8px 12px' }}>{emp.nombres} {emp.apellidos}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{emp.cargo}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#059669' }}>
                          {formatPYG(emp.salarioBase)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{emp.modalidadPago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importResult.validEmployees.length > 10 && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'center' }}>
                  ... y {importResult.validEmployees.length - 10} colaboradores más listos para incorporar.
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmarImportacion}
                disabled={importResult.validEmployees.length === 0}
                style={{
                  padding: '9px 20px',
                  borderRadius: '6px',
                  background: '#059669',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: importResult.validEmployees.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>✓</span>
                <span>Confirmar e Importar {importResult.validEmployees.length} Empleados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE TRASLADO DE SUCURSAL Y LUGAR DE TRABAJO (ARTS. 67, 72, 81 LEY 213/93) ── */}
      {transferEmployee && (
        <EmployeeTransferModal
          isOpen={!!transferEmployee}
          onClose={() => setTransferEmployee(null)}
          empleado={transferEmployee}
          empresa={empresa}
          onTransferSuccess={() => {
            setTransferEmployee(null);
            reloadData();
          }}
        />
      )}
    </div>
  );
};
