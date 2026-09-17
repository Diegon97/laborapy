/**
 * PLANILLA GENERAL DE NÓMINA MENSUAL (ERP LABORAPY)
 *
 * Visualizador y gestor masivo de nómina corporativa conforme a la Ley N.Âº 213/93 del Código del Trabajo.
 * Permite filtrar, buscar, agregar empleados, auditar haberes/descuentos, exportar a CSV/Excel y emitir recibos individuales.
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { EmpleadoNominaInput, LiquidacionMensualResult } from '../types';
import type { EmpresaCliente, Empleado } from '../../clientPortal/types/clientPortal';
import { getEmpleadosByCliente, getEmpresaById, saveEmpleado } from '../../clientPortal/services/clientStorageService';
import {
  calcularNominaMasiva,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';
import { PayrollSlipModal } from './PayrollSlipModal';

interface BatchPayrollTableProps {
  empresa?: EmpresaCliente;
}

export const BatchPayrollTable: React.FC<BatchPayrollTableProps> = ({ empresa }) => {
  const [empleados, setEmpleados] = useState<EmpleadoNominaInput[]>(() => {
    if (empresa) {
      const dbEmps = getEmpleadosByCliente(empresa.id).filter(
        e => e.clienteId === empresa.id && e.estado !== 'inactivo'
      );
      return dbEmps.map(emp => ({
        ci: emp.ci,
        nombre: `${emp.apellidos || ''}, ${emp.nombres || ''}`.trim() || emp.ci,
        cargo: emp.cargo || 'FUNCIONARIO',
        departamento: emp.departamento || 'OPERACIONES',
        empresa: empresa.razonSocial,
        tipo: emp.modalidadPago === 'factura' ? 'factura' : 'cotizante_ips',
        salarioFijo: emp.salarioBase || SALARIO_MINIMO_LEGAL_VIGENTE,
        diasTrabajados: 30,
        cantidadHijos: emp.hijosMenores || 0,
      }));
    }
    return [];
  });

  useEffect(() => {
    if (empresa) {
      const dbEmps = getEmpleadosByCliente(empresa.id).filter(
        e => e.clienteId === empresa.id && e.estado !== 'inactivo'
      );
      setEmpleados(
        dbEmps.map(emp => ({
          ci: emp.ci,
          nombre: `${emp.apellidos || ''}, ${emp.nombres || ''}`.trim() || emp.ci,
          cargo: emp.cargo || 'FUNCIONARIO',
          departamento: emp.departamento || 'OPERACIONES',
          empresa: empresa.razonSocial,
          tipo: emp.modalidadPago === 'factura' ? 'factura' : 'cotizante_ips',
          salarioFijo: emp.salarioBase || SALARIO_MINIMO_LEGAL_VIGENTE,
          diasTrabajados: 30,
          cantidadHijos: emp.hijosMenores || 0,
        }))
      );
    }
  }, [empresa]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todos' | 'cotizante_ips' | 'factura'>('todos');
  const [selectedLiquidation, setSelectedLiquidation] = useState<LiquidacionMensualResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Formulario de nuevo empleado rápido
  const [newEmp, setNewEmp] = useState<EmpleadoNominaInput>({
    ci: '',
    nombre: '',
    cargo: '',
    departamento: 'OPERACIONES',
    empresa: empresa?.razonSocial || 'EMPRESA CLIENTE S.A.',
    tipo: 'cotizante_ips',
    salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
    diasTrabajados: 30,
    cantidadHijos: 0,
  });

  // Condición fiscal de la empresa: si no es Agente de Retención, no se retiene IVA a facturadores.
  const esAgenteRetentor = useMemo(
    () => (empresa ? (getEmpresaById(empresa.id)?.esAgenteRetentor ?? true) : true),
    [empresa],
  );

  // Cálculo consolidado de la nómina masiva
  const { liquidaciones, totales } = useMemo(() => {
    return calcularNominaMasiva(empleados, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor);
  }, [empleados, esAgenteRetentor]);

  // Filtrado de la lista para la tabla
  const filteredLiquidaciones = useMemo(() => {
    return liquidaciones.filter((liq) => {
      const matchSearch =
        liq.input.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        liq.input.ci.includes(searchTerm) ||
        liq.input.cargo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchTipo = filterTipo === 'todos' || liq.input.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
  }, [liquidaciones, searchTerm, filterTipo]);

  const handleOpenReceipt = (liq: LiquidacionMensualResult) => {
    setSelectedLiquidation(liq);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = (ci: string) => {
    if (window.confirm('Â¿Seguro que deseas quitar a este funcionario de la nómina?')) {
      setEmpleados((prev) => prev.filter((e) => e.ci !== ci));
    }
  };

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.nombre || !newEmp.ci || !newEmp.salarioFijo) {
      alert('Por favor completa Cédula, Nombre y Salario Fijo.');
      return;
    }
    setEmpleados((prev) => [newEmp, ...prev]);

    if (empresa) {
      const parts = newEmp.nombre.split(',');
      const apellidos = parts[0]?.trim() || newEmp.nombre;
      const nombres = parts.slice(1).join(',').trim() || apellidos;
      const empDb: Empleado = {
        id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clienteId: empresa.id,
        ci: newEmp.ci.trim(),
        nombres,
        apellidos,
        cargo: newEmp.cargo || 'FUNCIONARIO',
        departamento: newEmp.departamento || 'OPERACIONES',
        salarioBase: newEmp.salarioFijo,
        modalidadPago: newEmp.tipo === 'factura' ? 'factura' : 'mensual',
        hijosMenores: newEmp.cantidadHijos || 0,
        nacionalidad: 'Paraguaya',
        estadoCivil: 'Soltero/a',
        sexo: 'M',
        fechaIngreso: new Date().toISOString().split('T')[0],
        estado: 'activo',
        periodoPruebaDias: 30,
        vacacionesCausadasAcumuladas: 0,
        vacacionesTomadas: 0,
        createdAt: new Date().toISOString(),
      };
      saveEmpleado(empDb);
    }

    setNewEmp({
      ci: '',
      nombre: '',
      cargo: '',
      departamento: 'OPERACIONES',
      empresa: empresa?.razonSocial || 'EMPRESA CLIENTE S.A.',
      tipo: 'cotizante_ips',
      salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
      diasTrabajados: 30,
      cantidadHijos: 0,
    });
    setIsAddModalOpen(false);
  };

  // Exportar a CSV compatible con Microsoft Excel (con BOM UTF-8)
  const handleExportCSV = () => {
    const headers = [
      'Nro',
      'CI',
      'Funcionario',
      'Cargo',
      'Departamento',
      'Tipo Contrato',
      'Salario Fijo',
      'Dias Trabajados',
      'Salario Total',
      'Adicional Cargo',
      'Vacaciones',
      'Reposo',
      'Horas 50%',
      'Horas 130%',
      'Horas 100%',
      'Recargo Nocturno',
      'Bonif Fam',
      'IVA',
      'Total Haberes',
      'Haberes Imponibles',
      'IPS Obrero (9%)',
      'Retencion IVA (30%)',
      'Ausencias',
      'Anticipo',
      'Judiciales',
      'Seguro Medico',
      'Faltante Caja',
      'Faltante Mercaderia',
      'Telefono Notebook',
      'Compra Credito Empresa',
      'Total Descuentos',
      'Neto a Pagar',
      'Aporte Patronal IPS (16.5%)',
    ];

    const rows = liquidaciones.map((l, index) => {
      const i = l.input;
      const h = l.haberes;
      const d = l.descuentos;
      return [
        index + 1,
        `"${i.ci}"`,
        `"${i.nombre}"`,
        `"${i.cargo}"`,
        `"${i.departamento || ''}"`,
        `"${i.tipo === 'factura' ? 'Prestador Factura' : 'Cotizante General'}"`,
        i.salarioFijo,
        l.diasTrabajadosEfectivos,
        h.salarioBaseDiasTrabajados,
        h.adicionalCargo,
        h.montoVacaciones,
        h.montoReposo,
        h.montoHoras50,
        h.montoHoras130,
        h.montoHoras100,
        h.montoRecargoNocturno,
        h.bonificacionFamiliar,
        h.ivaMonto,
        h.totalHaberesBrutos,
        l.haberesImponiblesIps,
        d.aporteObreroIps,
        l.retencionIva,
        d.descuentoAusencias,
        d.anticipoSalario,
        d.embargosJudiciales,
        d.seguroMedicoPrivado,
        d.faltanteCaja,
        d.faltanteMercaderia,
        d.telefonoNotebook,
        d.compraCreditoEmpresa,
        d.totalDescuentos,
        l.netoACobrar,
        l.aportePatronalIps,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Nomina_General_Salarios_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Descargar formato estándar de acreditación bancaria (Sudameris / Itaú / Continental)
  const handleExportBankCSV = () => {
    const headers = ['Tipo Doc', 'Nro Documento', 'Beneficiario', 'Importe Guaranies', 'Concepto'];
    const rows = liquidaciones.map((l) => [
      'CI',
      l.input.ci.replace(/\D/g, ''),
      `"${l.input.nombre}"`,
      l.netoACobrar,
      `"PAGO SALARIO MENSUAL"`,
    ].join(';'));

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Acreditacion_Bancaria_Salarios.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── KPIs Globales de la Nómina — Linear Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Empleados</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{totales.cantidadEmpleados}</div>
          <div style={{ fontSize: '11px', color: '#27a644', marginTop: '2px' }}>Personal activo en nómina</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Masa Salarial Bruta</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{formatGuaranies(totales.totalBruto)}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Total haberes devengados</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aporte Obrero IPS (9%)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{formatGuaranies(totales.totalIpsObrero)}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Retención a dependientes</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aporte Patronal IPS (16.5%)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{formatGuaranies(totales.totalIpsPatronal)}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Carga social empresa</div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', letterSpacing: '0.04em' }}>Total Neto a Desembolsar</div>
          <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', color: '#27a644', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{formatGuaranies(totales.totalNeto)}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Total a pagar a funcionarios</div>
        </div>
      </div>

      {/* ── Barra de Herramientas y Filtros ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
          {/* Input Buscador */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '14px', color: '#64748b' }}>ðŸ”</span>
            <input
              type="text"
              placeholder="Buscar por funcionario o CI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Filtro Régimen */}
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as 'todos' | 'cotizante_ips' | 'factura')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              color: '#475569',
            }}
          >
            <option value="todos">Todos los regímenes</option>
            <option value="cotizante_ips">Cotizantes IPS</option>
            <option value="factura">Prestadores con Factura</option>
          </select>

          {/* Badge de condición fiscal */}
          <span
            title={esAgenteRetentor
              ? 'Retiene el 30% del IVA a prestadores con factura (DNIT / ex-SET)'
              : 'No es Agente de Retención: no aplica retención de IVA a prestadores con factura'}
            style={{
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: esAgenteRetentor ? 'rgba(245, 158, 11, 0.12)' : '#f8fafc',
              color: esAgenteRetentor ? '#f59e0b' : '#64748b',
              border: `1px solid ${esAgenteRetentor ? 'rgba(245, 158, 11, 0.28)' : '#e2e8f0'}`,
            }}
          >
            {esAgenteRetentor ? 'ðŸ›ï¸ Agente de Retención IVA' : 'No Agente de Retención'}
          </span>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            âž• Nuevo Funcionario
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              color: '#475569',
              border: '1px solid #e2e8f0',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ðŸ“¥ Exportar Excel (CSV)
          </button>

          <button
            onClick={handleExportBankCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              color: '#475569',
              border: '1px solid #e2e8f0',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ðŸ¦ Archivo Bancario
          </button>
        </div>
      </div>

      {/* ── Tabla de Nómina General Interactiva ── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                <th style={{ padding: '12px 14px' }}>NÂ°</th>
                <th style={{ padding: '12px 14px' }}>CI NÂ°</th>
                <th style={{ padding: '12px 14px' }}>Funcionario</th>
                <th style={{ padding: '12px 14px' }}>Cargo</th>
                <th style={{ padding: '12px 14px' }}>Régimen</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Salario Fijo</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Días</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Haberes</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Imponible IPS</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>IPS (9%)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Descuentos</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Neto a Cobrar</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredLiquidaciones.map((l, idx) => {
                const isFact = l.input.tipo === 'factura';
                return (
                  <tr
                    key={l.input.ci}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc')}
                  >
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>{l.input.ci}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{l.input.nombre}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{l.input.cargo}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: isFact ? 'rgba(245, 158, 11, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                          color: isFact ? '#f59e0b' : '#0369a1',
                          border: `1px solid ${isFact ? 'rgba(245, 158, 11, 0.3)' : 'rgba(2, 132, 199, 0.3)'}`,
                        }}
                      >
                        {isFact ? 'Factura IVA' : 'Cotizante IPS'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                      {formatGuaranies(l.input.salarioFijo)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                      {l.diasTrabajadosEfectivos}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#27a644' }}>
                      {formatGuaranies(l.haberes.totalHaberesBrutos)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: '#0369a1' }}>
                      {isFact ? '—' : formatGuaranies(l.haberesImponiblesIps)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>
                      {isFact ? '—' : formatGuaranies(l.descuentos.aporteObreroIps)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>
                      {formatGuaranies(l.descuentos.totalDescuentos)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#27a644' }}>
                      {formatGuaranies(l.netoACobrar)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleOpenReceipt(l)}
                          title="Ver Recibo Oficial"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(39, 166, 68, 0.12)',
                            color: '#27a644',
                            border: '1px solid rgba(39, 166, 68, 0.28)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          ðŸ“„ Recibo
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(l.input.ci)}
                          title="Quitar de nómina"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.28)',
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
      </div>

      {/* ── Modal de Recibo Individual ── */}
      {selectedLiquidation && (
        <PayrollSlipModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLiquidation(null);
          }}
          liquidacion={selectedLiquidation}
          empresaNombre={empresa?.razonSocial || 'EMPRESA CLIENTE S.A.'}
          periodo={new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' })}
        />
      )}

      {/* ── Modal para Agregar Funcionario ── */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                âž• Agregar Funcionario a la Nómina
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                âœ•
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Nombre y Apellido
                </label>
                <input
                  type="text"
                  required
                  value={newEmp.nombre}
                  onChange={(e) => setNewEmp({ ...newEmp, nombre: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Cédula (CI NÂ°)
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmp.ci}
                    onChange={(e) => setNewEmp({ ...newEmp, ci: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={newEmp.cargo}
                    onChange={(e) => setNewEmp({ ...newEmp, cargo: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Tipo de Contrato
                  </label>
                  <select
                    value={newEmp.tipo}
                    onChange={(e) => setNewEmp({ ...newEmp, tipo: e.target.value as EmpleadoNominaInput['tipo'] })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#f8fafc', color: '#0f172a' }}
                  >
                    <option value="cotizante_ips">Cotizante IPS (9%)</option>
                    <option value="factura">Prestador Factura (IVA 10%)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Salario Fijo (Gs.)
                  </label>
                  <input
                    type="number"
                    required
                    value={newEmp.salarioFijo}
                    onChange={(e) => setNewEmp({ ...newEmp, salarioFijo: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  Guardar Funcionario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
