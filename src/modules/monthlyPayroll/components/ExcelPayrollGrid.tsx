/**
 * PLANILLA EDITABLE TIPO EXCEL / NOTION — LIQUIDACIÓN MENSUAL (ERP LABORAPY)
 *
 * Grilla interactiva de liquidación de nómina con experiencia similar a Excel y Notion Databases:
 *  - Columnas dinámicas (agregar, modificar, renombrar, reordenar y eliminar columnas).
 *  - Formato por columna: Moneda (Gs.), Número, Texto, Porcentaje, Fecha, Selección (tags) y Fórmulas calculadas.
 *  - Paleta de colores Notion para cabeceras y etiquetas.
 *  - Motor de fórmulas seguro (safeFormulaEvaluator) para programar funciones automáticas (ej: =[salarioFijo]*0.05).
 *  - Evaluación rápida de operaciones matemáticas en celdas (=150000+50000).
 *  - Control de visibilidad de columnas (ocultar / mostrar).
 *  - Persistencia local por empresa y período (empleados, customColumns, hiddenColumnIds).
 *  - Exportación CSV completa y emisión de recibos oficiales.
 *
 * Base legal: Ley N.º 213/93 (Código del Trabajo) y Decreto-Ley N.º 1860/50 (IPS).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type {
  EmpleadoNominaInput,
  LiquidacionMensualResult,
  GridColumnDef,
  ColumnType,
  ColumnColor,
} from '../types';
import type { EmpresaCliente, Empleado } from '../../clientPortal/types/clientPortal';
import {
  getEmpleadosByCliente,
  getEmpresaById,
  saveEmpleado,
} from '../../clientPortal/services/clientStorageService';
import {
  calcularNominaMasiva,
  formatGuaranies,
  SALARIO_MINIMO_LEGAL_VIGENTE,
} from '../engine/monthlyPayrollEngine';
import {
  evaluateFormula,
  evaluateCellMath,
} from '../engine/safeFormulaEvaluator';
import { PayrollSlipModal } from './PayrollSlipModal';
import { ColumnConfigModal } from './ColumnConfigModal';
import { ColumnVisibilityDrawer } from './ColumnVisibilityDrawer';
import { PayrollEmployeeDrawer } from './PayrollEmployeeDrawer';
import { PayrollCardsView } from './PayrollCardsView';
import { PayrollNoveltiesModal } from './PayrollNoveltiesModal';
import { aplicarNovedadesANominaCompleta } from '../engine/payrollNoveltiesEngine';
import { loadNovedadesEmpresa } from '../services/payrollNoveltiesStorage';
import {
  loadNominaPeriodo,
  saveNominaPeriodo,
  deleteNominaPeriodo,
  getStorageKey,
} from '../services/monthlyPayrollStorage';
import { exportNominaCSV } from '../services/payrollCsvExport';

export type ColumnPreset = 'all' | 'novedades' | 'haberes' | 'descuentos' | 'costos';
export type ViewMode = 'table' | 'cards';

const PRESET_COLUMNS: Record<ColumnPreset, string[]> = {
  novedades: [
    'nro',
    'ci',
    'nombre',
    'diasTrabajados',
    'cantHoras50',
    'cantHoras100',
    'anticipoSalario',
    'netoACobrar',
    'acciones',
  ],
  haberes: [
    'nro',
    'ci',
    'nombre',
    'cargo',
    'salarioFijo',
    'adicionalCargo',
    'diasTrabajados',
    'cantHoras50',
    'cantHoras130',
    'cantHoras100',
    'cantHorasNocturnas',
    'totalHaberes',
    'acciones',
  ],
  descuentos: [
    'nro',
    'ci',
    'nombre',
    'totalHaberes',
    'ipsObrero',
    'anticipoSalario',
    'prestamosEmpresa',
    'embargosJudiciales',
    'totalDescuentos',
    'netoACobrar',
    'acciones',
  ],
  costos: [
    'nro',
    'ci',
    'nombre',
    'salarioFijo',
    'totalHaberes',
    'imponibleIps',
    'ipsObrero',
    'netoACobrar',
    'acciones',
  ],
  all: [],
};

interface ExcelPayrollGridProps {
  empresa?: EmpresaCliente;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ANIOS = Array.from({ length: 12 }, (_, i) => 2024 + i);

const NOTION_COLOR_STYLES: Record<ColumnColor, { bg: string; text: string; border: string }> = {
  default: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  blue: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  emerald: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  amber: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  rose: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  cyan: { bg: '#cffafe', text: '#155e75', border: '#a5f3fc' },
  slate: { bg: '#e2e8f0', text: '#1e293b', border: '#cbd5e1' },
};

const getTypeIcon = (type: ColumnType): string => {
  switch (type) {
    case 'currency': return '💵';
    case 'number': return '🔢';
    case 'percentage': return '%';
    case 'text': return '📝';
    case 'date': return '📅';
    case 'select': return '🏷️';
    case 'formula': return 'fx';
    default: return '📄';
  }
};

const DEFAULT_COLUMNS: GridColumnDef[] = [
  { id: 'nro', label: 'N°', type: 'number', editable: false, visible: true, width: '46px', minWidth: '46px', color: 'default' },
  { id: 'ci', label: 'CI', type: 'text', editable: false, visible: true, width: '110px', minWidth: '110px', color: 'default' },
  { id: 'nombre', label: 'Funcionario', type: 'text', editable: false, visible: true, width: '220px', minWidth: '220px', color: 'default' },
  { id: 'diasVacaciones', label: 'Días Vacac.', type: 'number', editable: true, visible: true, minWidth: '82px', step: 1 },
  { id: 'diasReposo', label: 'Días Reposo', type: 'number', editable: true, visible: true, minWidth: '82px', step: 1 },
  { id: 'diasAusencias', label: 'Días Ausenc.', type: 'number', editable: true, visible: true, minWidth: '82px', step: 1 },
  { id: 'diasTrabajados', label: 'Días Trab.', type: 'number', editable: false, visible: true, minWidth: '82px' },
  { id: 'salarioFijo', label: 'Salario Fijo', type: 'currency', editable: true, visible: true, minWidth: '125px', step: 1000 },
  { id: 'adicionalCargo', label: 'Adic. Cargo', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'cantHoras50', label: 'Hs 50%', type: 'number', editable: true, visible: true, minWidth: '78px', step: 0.5 },
  { id: 'cantHoras130', label: 'Hs 130%', type: 'number', editable: true, visible: true, minWidth: '78px', step: 0.5 },
  { id: 'cantHoras100', label: 'Hs 100%', type: 'number', editable: true, visible: true, minWidth: '78px', step: 0.5 },
  { id: 'cantHorasNocturnas', label: 'Hs Noct.', type: 'number', editable: true, visible: true, minWidth: '78px', step: 0.5 },
  { id: 'cantidadHijos', label: 'Hijos', type: 'number', editable: true, visible: true, minWidth: '72px', step: 1 },
  { id: 'refrigerioTraslado', label: 'Refrigerio', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'totalHaberes', label: 'Total Haberes', type: 'currency', editable: false, visible: true, minWidth: '125px', color: 'emerald' },
  { id: 'imponibleIps', label: 'Imponible IPS', type: 'currency', editable: false, visible: true, minWidth: '125px', color: 'blue' },
  { id: 'ipsObrero', label: 'IPS 9%', type: 'currency', editable: false, visible: true, minWidth: '115px', color: 'rose' },
  { id: 'embargosJudiciales', label: 'Embargos', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'seguroMedicoPrivado', label: 'Seg. Médico', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'anticipoSalario', label: 'Anticipo', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'prestamosEmpresa', label: 'Préstamos', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'faltanteCaja', label: 'Falt. Caja', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'faltanteMercaderia', label: 'Falt. Mercad.', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'telefonoNotebook', label: 'Tel/Notebook', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'compraCreditoEmpresa', label: 'Compras Créd.', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'otrosDescuentos', label: 'Otros Desc.', type: 'currency', editable: true, visible: true, minWidth: '115px', step: 1000 },
  { id: 'totalDescuentos', label: 'Total Desc.', type: 'currency', editable: false, visible: true, minWidth: '125px', color: 'rose' },
  { id: 'netoACobrar', label: 'Neto a Cobrar', type: 'currency', editable: false, visible: true, minWidth: '130px', color: 'emerald' },
  { id: 'acciones', label: 'Acciones', type: 'text', editable: false, visible: true, minWidth: '95px' },
];

const ANCHO_NRO = '46px';
const ANCHO_CI = '110px';
const ANCHO_FUNCIONARIO = '220px';
const OFFSET_CI = '46px';
const OFFSET_FUNCIONARIO = '156px';

const thBase: React.CSSProperties = {
  padding: '10px 8px',
  backgroundColor: '#f1f5f9',
  color: '#334155',
  fontSize: '12px',
  fontWeight: 700,
  textAlign: 'center',
  borderBottom: '1px solid #cbd5e1',
  borderRight: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

const tdBase: React.CSSProperties = {
  padding: '3px 4px',
  borderBottom: '1px solid #f1f5f9',
  borderRight: '1px solid #f1f5f9',
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const calcStyle: React.CSSProperties = {
  ...tdBase,
  textAlign: 'right',
  fontFamily: 'monospace',
  fontWeight: 600,
  color: '#065f46',
  fontSize: '13px',
  padding: '8px 10px',
};

const tdFoot: React.CSSProperties = {
  padding: '8px 6px',
  textAlign: 'right',
  fontFamily: 'monospace',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  borderRight: '1px solid #1e293b',
};

const inputCell: React.CSSProperties = {
  width: '100%',
  padding: '7px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '13.5px',
  fontFamily: 'monospace',
  textAlign: 'right',
  backgroundColor: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 13px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnRecibo: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  backgroundColor: '#ecfdf5',
  color: '#065f46',
  border: '1px solid #a7f3d0',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
};

export const ExcelPayrollGrid: React.FC<ExcelPayrollGridProps> = ({ empresa }) => {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<{ mes: number; anho: number }>(() => ({
    mes: hoy.getMonth() + 1,
    anho: hoy.getFullYear(),
  }));
  const [empleados, setEmpleados] = useState<EmpleadoNominaInput[]>([]);
  const [columns, setColumns] = useState<GridColumnDef[]>(DEFAULT_COLUMNS);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLiquidation, setSelectedLiquidation] = useState<LiquidacionMensualResult | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isVisibilityDrawerOpen, setIsVisibilityDrawerOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<GridColumnDef | null>(null);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [activePreset, setActivePreset] = useState<ColumnPreset>('novedades');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [drawerEmpleadoIndex, setDrawerEmpleadoIndex] = useState<number | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [isNoveltiesModalOpen, setIsNoveltiesModalOpen] = useState(false);
  const [initialCiForNovelty, setInitialCiForNovelty] = useState<string | undefined>(undefined);
  const [novedadesMsg, setNovedadesMsg] = useState<string | null>(null);

  // Buffer de edición para celdas (permite escribir =100+200 sin formateo prematuro)
  const [cellBuffers, setCellBuffers] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const savedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current !== null) {
        window.clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Cierra menú contextual al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenColumnMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape para salir de modo zen o pantalla completa
  useEffect(() => {
    if (!expandido && !zenMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerEmpleadoIndex === null) {
        setExpandido(false);
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandido, zenMode, drawerEmpleadoIndex]);

  const [newEmp, setNewEmp] = useState<EmpleadoNominaInput>(() => ({
    ci: '',
    nombre: '',
    cargo: '',
    departamento: 'OPERACIONES',
    empresa: empresa?.razonSocial,
    tipo: 'cotizante_ips',
    salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
    cantidadHijos: 0,
  }));

  const periodoKey = `${periodo.anho}-${String(periodo.mes).padStart(2, '0')}`;
  const tituloPeriodo = `${MESES[periodo.mes - 1]} ${periodo.anho}`;

  const esAgenteRetentor = useMemo(
    () => (empresa ? (getEmpresaById(empresa.id)?.esAgenteRetentor ?? true) : true),
    [empresa],
  );

  const construirBase = (): EmpleadoNominaInput[] => {
    if (!empresa) return [];
    const dbEmps = getEmpleadosByCliente(empresa.id).filter(
      (e) => e.clienteId === empresa.id && e.estado !== 'inactivo',
    );
    return dbEmps.map((emp) => ({
      ci: emp.ci,
      nombre: `${emp.apellidos || ''}, ${emp.nombres || ''}`.trim() || emp.ci,
      cargo: emp.cargo || 'FUNCIONARIO',
      departamento: emp.departamento || 'OPERACIONES',
      empresa: empresa.razonSocial,
      tipo: emp.modalidadPago === 'factura' ? 'factura' : 'cotizante_ips',
      salarioFijo: emp.salarioBase || SALARIO_MINIMO_LEGAL_VIGENTE,
      cantidadHijos: emp.hijosMenores || 0,
    }));
  };

  // Carga inicial y cambio de período
  useEffect(() => {
    const guardada = loadNominaPeriodo(empresa?.id || '', periodoKey);
    if (guardada && Array.isArray(guardada.empleados)) {
      setEmpleados(guardada.empleados);
      setGuardadoEn(guardada.actualizadoEn ?? null);

      // Reconstruir columnas combinando predeterminadas con las personalizadas guardadas
      if (Array.isArray(guardada.customColumns) && guardada.customColumns.length > 0) {
        const accionesCol = DEFAULT_COLUMNS.find((c) => c.id === 'acciones')!;
        const baseColsSinAcciones = DEFAULT_COLUMNS.filter((c) => c.id !== 'acciones');
        setColumns([...baseColsSinAcciones, ...guardada.customColumns, accionesCol]);
      } else {
        setColumns(DEFAULT_COLUMNS);
      }

      if (Array.isArray(guardada.hiddenColumnIds)) {
        setHiddenColumnIds(guardada.hiddenColumnIds);
      } else {
        setHiddenColumnIds([]);
      }
    } else {
      setEmpleados(construirBase());
      setColumns(DEFAULT_COLUMNS);
      setHiddenColumnIds([]);
      setGuardadoEn(null);
    }
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, periodo]);

  // Columnas visibles calculadas con soporte para Presets Inteligentes
  const visibleColumns = useMemo(() => {
    return columns.filter((c) => {
      if (hiddenColumnIds.includes(c.id)) return false;
      if (activePreset === 'all') return true;
      const presetList = PRESET_COLUMNS[activePreset];
      if (!presetList || presetList.length === 0) return true;
      return presetList.includes(c.id);
    });
  }, [columns, hiddenColumnIds, activePreset]);

  // Columnas disponibles para asistente de fórmulas
  const availableFormulaColumns = useMemo(() => {
    return columns
      .filter((c) => c.id !== 'acciones')
      .map((c) => ({ id: c.id, label: c.label }));
  }, [columns]);

  // Cálculo consolidado de liquidación mensual
  const { liquidaciones } = useMemo(
    () => calcularNominaMasiva(empleados, SALARIO_MINIMO_LEGAL_VIGENTE, esAgenteRetentor),
    [empleados, esAgenteRetentor],
  );

  // Filas visibles filtradas por término de búsqueda
  const filas = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return empleados
      .map((emp, realIndex) => ({ emp, realIndex, liq: liquidaciones[realIndex] }))
      .filter(({ emp }) => {
        if (!term) return true;
        return (
          (emp.nombre || '').toLowerCase().includes(term) ||
          String(emp.ci || '').includes(searchTerm) ||
          (emp.cargo || '').toLowerCase().includes(term)
        );
      });
  }, [empleados, liquidaciones, searchTerm]);

  /** Construye el diccionario de contexto de la fila para fórmulas */
  const getRowContext = (emp: EmpleadoNominaInput, liq: LiquidacionMensualResult, index: number): Record<string, any> => {
    return {
      nro: index + 1,
      ci: emp.ci,
      funcionario: emp.nombre,
      nombre: emp.nombre,
      cargo: emp.cargo || '',
      tipo: emp.tipo === 'factura' ? 'Prestador Factura' : 'Cotizante IPS',
      diasVacaciones: emp.diasVacaciones || 0,
      diasReposo: emp.diasReposo || 0,
      diasAusencias: emp.diasAusencias || 0,
      diasTrabajados: liq.diasTrabajadosEfectivos,
      salarioFijo: emp.salarioFijo || 0,
      adicionalCargo: emp.adicionalCargo || 0,
      cantHoras50: emp.cantHoras50 || 0,
      cantHoras130: emp.cantHoras130 || 0,
      cantHoras100: emp.cantHoras100 || 0,
      cantHorasNocturnas: emp.cantHorasNocturnas || 0,
      cantidadHijos: emp.cantidadHijos || 0,
      refrigerioTraslado: emp.refrigerioTraslado || 0,
      totalHaberes: liq.haberes.totalHaberesBrutos,
      imponibleIps: emp.tipo === 'factura' ? 0 : liq.haberesImponiblesIps,
      ipsObrero: emp.tipo === 'factura' ? 0 : liq.descuentos.aporteObreroIps,
      embargosJudiciales: emp.embargosJudiciales || 0,
      seguroMedicoPrivado: emp.seguroMedicoPrivado || 0,
      anticipoSalario: emp.anticipoSalario || 0,
      prestamosEmpresa: emp.prestamosEmpresa || 0,
      faltanteCaja: emp.faltanteCaja || 0,
      faltanteMercaderia: emp.faltanteMercaderia || 0,
      telefonoNotebook: emp.telefonoNotebook || 0,
      compraCreditoEmpresa: emp.compraCreditoEmpresa || 0,
      otrosDescuentos: emp.otrosDescuentos || 0,
      totalDescuentos: liq.descuentos.totalDescuentos,
      netoACobrar: liq.netoACobrar,
      ...(emp.customFields || {}),
    };
  };

  /** Totales dinámicos en TFOOT para todas las columnas visibles */
  const totalesPorColumna = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const col of visibleColumns) {
      if (col.id === 'nro') {
        totals[col.id] = filas.length;
        continue;
      }
      if (col.id === 'ci' || col.id === 'nombre' || col.id === 'acciones' || col.type === 'text' || col.type === 'date' || col.type === 'select') {
        totals[col.id] = 0;
        continue;
      }

      let sum = 0;
      for (let idx = 0; idx < filas.length; idx++) {
        const { emp, liq } = filas[idx];
        if (col.id === 'diasTrabajados') sum += liq.diasTrabajadosEfectivos;
        else if (col.id === 'totalHaberes') sum += liq.haberes.totalHaberesBrutos;
        else if (col.id === 'imponibleIps') sum += emp.tipo === 'factura' ? 0 : liq.haberesImponiblesIps;
        else if (col.id === 'ipsObrero') sum += emp.tipo === 'factura' ? 0 : liq.descuentos.aporteObreroIps;
        else if (col.id === 'totalDescuentos') sum += liq.descuentos.totalDescuentos;
        else if (col.id === 'netoACobrar') sum += liq.netoACobrar;
        else if (col.type === 'formula' && col.formula) {
          const rowCtx = getRowContext(emp, liq, idx);
          const val = evaluateFormula(col.formula, rowCtx);
          sum += typeof val === 'number' ? val : 0;
        } else if (col.isCustom) {
          const val = emp.customFields?.[col.id];
          sum += typeof val === 'number' ? val : 0;
        } else {
          sum += (emp as any)[col.id] || 0;
        }
      }
      totals[col.id] = sum;
    }

    return totals;
  }, [filas, visibleColumns]);

  /** Actualiza un campo numérico con soporte para fórmulas de celda */
  const updateCampo = (realIndex: number, campo: string, rawVal: string, isCustom = false) => {
    // 1. Evaluar si el usuario escribió una fórmula de celda (ej: =150000+50000)
    let finalVal: any = undefined;
    const mathResult = evaluateCellMath(rawVal);

    if (mathResult !== null) {
      finalVal = Math.max(0, mathResult);
    } else if (rawVal !== '') {
      finalVal = Number(rawVal);
      if (isNaN(finalVal)) finalVal = rawVal;
      else finalVal = Math.max(0, finalVal);
    }

    setEmpleados((prev) =>
      prev.map((e, i) => {
        if (i !== realIndex) return e;
        if (isCustom) {
          return {
            ...e,
            customFields: {
              ...(e.customFields || {}),
              [campo]: finalVal,
            },
          };
        }
        return {
          ...e,
          [campo]: finalVal,
        };
      }),
    );
    setDirty(true);
  };

  /** Navegación por teclado tipo Excel */
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    visRow: number,
    colIdx: number,
    realIndex: number,
    colDef: GridColumnDef,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Si había algo en el buffer, aplicarlo
      const cellKey = `${realIndex}-${colDef.id}`;
      if (cellBuffers[cellKey] !== undefined) {
        updateCampo(realIndex, colDef.id, cellBuffers[cellKey], colDef.isCustom);
      }

      const destRow = e.shiftKey ? visRow - 1 : visRow + 1;
      const target = Math.max(0, Math.min(filas.length - 1, destRow));
      const el = document.querySelector<HTMLInputElement>(`[data-row="${target}"][data-col="${colIdx}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        el.select();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const target = Math.max(0, visRow - 1);
      const el = document.querySelector<HTMLInputElement>(`[data-row="${target}"][data-col="${colIdx}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        el.select();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const target = Math.min(filas.length - 1, visRow + 1);
      const el = document.querySelector<HTMLInputElement>(`[data-row="${target}"][data-col="${colIdx}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        el.select();
      }
      return;
    }
  };

  const handlePeriodoChange = (nuevoMes: number, nuevoAnho: number) => {
    if (nuevoMes === periodo.mes && nuevoAnho === periodo.anho) return;
    if (dirty) {
      const confirmar = window.confirm(
        'Hay cambios sin guardar en el periodo actual. ¿Deseas descartarlos y cambiar de periodo?',
      );
      if (!confirmar) return;
    }
    setPeriodo({ mes: nuevoMes, anho: nuevoAnho });
  };

  const handleSave = () => {
    const customOnly = columns.filter((c) => c.isCustom);
    const ok = saveNominaPeriodo(
      empresa?.id || '',
      periodoKey,
      empleados,
      customOnly,
      hiddenColumnIds,
    );
    if (ok) {
      setDirty(false);
      setSavedMsg(true);
      setGuardadoEn(new Date().toISOString());
      if (savedTimeoutRef.current !== null) {
        window.clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = window.setTimeout(() => setSavedMsg(false), 2500);
    } else {
      window.alert(
        'No se pudo guardar el periodo (almacenamiento no disponible o cuota excedida). Los cambios permanecen en pantalla.',
      );
    }
  };

  const handleResetPeriod = () => {
    const confirmar = window.confirm(
      '¿Reiniciar el periodo? Se borrarán todos los datos guardados y se recargará la nómina base.',
    );
    if (!confirmar) return;
    deleteNominaPeriodo(empresa?.id || '', periodoKey);
    setEmpleados(construirBase());
    setColumns(DEFAULT_COLUMNS);
    setHiddenColumnIds([]);
    setDirty(false);
    setGuardadoEn(null);
  };

  const handleSaveColumn = (newCol: GridColumnDef) => {
    setColumns((prev) => {
      const exists = prev.findIndex((c) => c.id === newCol.id);
      if (exists !== -1) {
        return prev.map((c, i) => (i === exists ? { ...c, ...newCol } : c));
      }
      const accionesIdx = prev.findIndex((c) => c.id === 'acciones');
      const copy = [...prev];
      if (accionesIdx !== -1) {
        copy.splice(accionesIdx, 0, newCol);
      } else {
        copy.push(newCol);
      }
      return copy;
    });
    setDirty(true);
  };

  const handleDeleteColumn = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.isCustom) return;
    if (!window.confirm(`¿Eliminar la columna "${col.label}"?`)) return;

    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setEmpleados((prev) =>
      prev.map((e) => {
        if (!e.customFields) return e;
        const copy = { ...e.customFields };
        delete copy[columnId];
        return { ...e, customFields: copy };
      }),
    );
    setDirty(true);
  };

  const handleDeleteEmployee = (realIdx: number) => {
    setEmpleados((prev) => prev.filter((_, idx) => idx !== realIdx));
    setDirty(true);
  };

  const moveColumn = (columnId: string, direction: 'left' | 'right') => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === columnId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      // No mover por delante de las columnas sticky (nro, ci, nombre) ni por detrás de acciones
      if (targetIdx < 3 || targetIdx >= prev.length - 1) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, removed);
      return copy;
    });
    setDirty(true);
  };

  const toggleHideColumn = (columnId: string) => {
    setHiddenColumnIds((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId],
    );
    setDirty(true);
  };

  const handleExportCSV = () => {
    exportNominaCSV(
      filas.map((f) => f.emp),
      filas.map((f) => f.liq),
      periodoKey,
      visibleColumns,
    );
  };

  const handleAplicarNovedades = () => {
    if (!empresa?.id) return;
    const novedades = loadNovedadesEmpresa(empresa.id);
    if (novedades.length === 0) {
      alert('No hay novedades ni embargos programados registrados para esta empresa.');
      return;
    }
    const res = aplicarNovedadesANominaCompleta(empleados, novedades, periodoKey, 'MEN');
    setEmpleados(res.empleadosActualizados);
    setDirty(true);
    setNovedadesMsg(`⚡ Novedades aplicadas: ${res.todosLosDesgloses.length} conceptos imputados`);
    if (savedTimeoutRef.current !== null) {
      window.clearTimeout(savedTimeoutRef.current);
    }
    savedTimeoutRef.current = window.setTimeout(() => setNovedadesMsg(null), 4000);
  };

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.nombre || !newEmp.ci || !newEmp.salarioFijo) {
      alert('Por favor completa Cédula, Nombre y Salario Fijo.');
      return;
    }
    const nuevo: EmpleadoNominaInput = {
      ...newEmp,
      ci: newEmp.ci.trim(),
      nombre: newEmp.nombre.trim(),
    };
    setEmpleados((prev) => [nuevo, ...prev]);
    setDirty(true);

    if (empresa) {
      const parts = nuevo.nombre.split(',');
      const apellidos = parts[0]?.trim() || nuevo.nombre;
      const nombres = parts.slice(1).join(',').trim() || apellidos;
      const empDb: Empleado = {
        id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clienteId: empresa.id,
        ci: nuevo.ci,
        nombres,
        apellidos,
        cargo: nuevo.cargo || 'FUNCIONARIO',
        departamento: nuevo.departamento || 'OPERACIONES',
        salarioBase: nuevo.salarioFijo,
        modalidadPago: nuevo.tipo === 'factura' ? 'factura' : 'mensual',
        hijosMenores: nuevo.cantidadHijos || 0,
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
      empresa: empresa?.razonSocial,
      tipo: 'cotizante_ips',
      salarioFijo: SALARIO_MINIMO_LEGAL_VIGENTE,
      cantidadHijos: 0,
    });
    setIsAddModalOpen(false);
  };

  return (
    <div
      style={
        zenMode || expandido
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 99990,
              backgroundColor: '#f8fafc',
              padding: '16px',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }
          : { display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }
      }
    >
      {/* ── Encabezado y selector de período ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              📗 Planilla Editable — {tituloPeriodo}
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                padding: '3px 8px',
                borderRadius: '12px',
              }}
            >
              Excel & Notion Experience
            </span>
            {(zenMode || expandido) && (
              <button
                type="button"
                onClick={() => {
                  setZenMode(false);
                  setExpandido(false);
                }}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ✕ Salir de Modo Zen (Esc)
              </button>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            💾 Clave: {getStorageKey(empresa?.id || '', periodoKey)} · {guardadoEn ? `Guardado: ${new Date(guardadoEn).toLocaleTimeString('es-PY')}` : 'Sin guardar'} · Ingresá fórmulas con prefijo = en cualquier celda numérica.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={periodo.mes}
            onChange={(ev) => handlePeriodoChange(Number(ev.target.value), periodo.anho)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>

          <select
            value={periodo.anho}
            onChange={(ev) => handlePeriodoChange(periodo.mes, Number(ev.target.value))}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
          >
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <span
            style={{
              padding: '5px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: esAgenteRetentor ? '#fef3c7' : '#f1f5f9',
              color: esAgenteRetentor ? '#b45309' : '#475569',
            }}
          >
            {esAgenteRetentor ? '🏛️ Retentor IVA' : 'No Retentor'}
          </span>

          {dirty && (
            <span style={{ padding: '5px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309' }}>
              ● Cambios sin guardar
            </span>
          )}
          {savedMsg && (
            <span style={{ padding: '5px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d' }}>
              ✅ Guardado
            </span>
          )}
          {novedadesMsg && (
            <span style={{ padding: '5px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
              {novedadesMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Barra de herramientas enriquecida ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <span style={{ position: 'absolute', left: '10px', top: '8px', fontSize: '14px', color: '#94a3b8' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar funcionario o CI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Alternador de Modo de Vista: Grilla vs Fichas */}
          <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '2px', backgroundColor: '#f1f5f9' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'table' ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              📊 Hoja Excel
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'cards' ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              📇 Fichas
            </button>
          </div>

          {/* Botón Agregar Columna */}
          <button
            onClick={() => {
              setEditingColumn(null);
              setIsColumnModalOpen(true);
            }}
            style={{
              ...btnSecondary,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
            title="Crear nueva columna (Moneda, Número, Fórmula, Select, etc.)"
          >
            ➕ Columna
          </button>

          {/* Botón Selector de Columnas Visibles */}
          <button
            onClick={() => setIsVisibilityDrawerOpen(true)}
            style={btnSecondary}
            title="Mostrar u ocultar columnas de la planilla"
          >
            👁️ Columnas {hiddenColumnIds.length > 0 ? `(${visibleColumns.length})` : ''}
          </button>

          {/* Botón Agregar Funcionario */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{ ...btnSecondary, backgroundColor: '#059669', color: '#ffffff', border: '1px solid #047857' }}
          >
            ➕ Funcionario
          </button>

          {/* Botón Novedades Programadas */}
          <button
            onClick={() => {
              setInitialCiForNovelty(undefined);
              setIsNoveltiesModalOpen(true);
            }}
            style={{
              ...btnSecondary,
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fcd34d',
            }}
            title="Gestionar novedades salariales, embargos judiciales (25%) y anticipos"
          >
            ⚡ Novedades
          </button>

          {/* Botón Aplicar Novedades */}
          <button
            onClick={handleAplicarNovedades}
            style={{
              ...btnSecondary,
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #86efac',
            }}
            title="Sincronizar novedades y embargos vigentes a las columnas de la nómina"
          >
            🔄 Aplicar Novedades
          </button>

          {/* Botón Guardar Periodo */}
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={{
              ...btnSecondary,
              backgroundColor: dirty ? '#2563eb' : '#f1f5f9',
              color: dirty ? '#ffffff' : '#94a3b8',
              border: dirty ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            💾 Guardar
          </button>

          {/* Botón Reiniciar Periodo */}
          <button onClick={handleResetPeriod} style={btnSecondary} title="Reiniciar a nómina base">
            🗑️
          </button>

          {/* Botón Exportar CSV */}
          <button onClick={handleExportCSV} style={btnSecondary} title="Descargar CSV con columnas y fórmulas">
            📥 CSV
          </button>

          {/* Botón Expandir Pantalla / Zen */}
          <button
            onClick={() => {
              setZenMode((v) => !v);
              setExpandido((v) => !v);
            }}
            style={{
              ...btnSecondary,
              backgroundColor: zenMode || expandido ? '#0f172a' : '#ffffff',
              color: zenMode || expandido ? '#ffffff' : '#334155',
            }}
            title={zenMode || expandido ? 'Salir de pantalla completa (Esc)' : 'Modo Inmersivo / Pantalla Completa'}
          >
            {zenMode || expandido ? '🗗 Salir Zen' : '⛶ Modo Zen'}
          </button>

          {/* Desplazamiento horizontal rápido */}
          {viewMode === 'table' && (
            <>
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -450, behavior: 'smooth' })}
                style={{ ...btnSecondary, padding: '7px 10px' }}
                title="Desplazar a la izquierda"
              >
                ◀
              </button>
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 450, behavior: 'smooth' })}
                style={{ ...btnSecondary, padding: '7px 10px' }}
                title="Desplazar a la derecha"
              >
                ▶
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Barra de Presets Inteligentes de Columnas ── */}
      {viewMode === 'table' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>
              Vistas Rápidas:
            </span>
            {[
              { id: 'novedades', label: '⚡ Novedades del Mes (Cero Scroll)', color: '#059669', badge: 'Recomendada' },
              { id: 'haberes', label: '➕ Haberes & Extras', color: '#2563eb' },
              { id: 'descuentos', label: '➖ Deducciones', color: '#d97706' },
              { id: 'costos', label: '💼 Costos Empresa', color: '#7c3aed' },
              { id: 'all', label: '📋 Planilla Completa', color: '#475569' },
            ].map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePreset(p.id as ColumnPreset)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '6px',
                    border: isActive ? `1.5px solid ${p.color}` : '1px solid #e2e8f0',
                    backgroundColor: isActive ? `${p.color}15` : '#ffffff',
                    color: isActive ? p.color : '#475569',
                    fontSize: '11.5px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{p.label}</span>
                  {p.badge && !isActive && (
                    <span style={{ fontSize: '9px', backgroundColor: '#d1fae5', color: '#065f46', padding: '1px 4px', borderRadius: '4px' }}>
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Mostrando {visibleColumns.length} columnas
            </span>
            <button
              type="button"
              onClick={() => {
                if (filas.length > 0) {
                  setDrawerEmpleadoIndex(filas[0].realIndex);
                }
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #059669',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Abrir panel lateral de carga guiada"
            >
              ⚡ Carga Guiada
            </button>
          </div>
        </div>
      )}

      {/* ── Vista Condicional: Grilla Excel vs Fichas ── */}
      {viewMode === 'cards' ? (
        <PayrollCardsView
          empleados={filas.map((f) => f.emp)}
          onUpdateEmpleado={(idx, updated) => {
            const realIdx = filas[idx]?.realIndex ?? idx;
            setEmpleados((prev) => {
              const copy = [...prev];
              copy[realIdx] = updated;
              return copy;
            });
            setDirty(true);
          }}
          onOpenDrawer={(idx) => {
            const realIdx = filas[idx]?.realIndex ?? idx;
            setDrawerEmpleadoIndex(realIdx);
          }}
          onDeleteEmpleado={(idx) => {
            const realIdx = filas[idx]?.realIndex ?? idx;
            handleDeleteEmployee(realIdx);
          }}
          empresa={empresa}
        />
      ) : (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div ref={scrollRef} style={{ overflow: 'auto', maxHeight: zenMode || expandido ? 'calc(100vh - 220px)' : '72vh' }}>
            <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              width: 'max-content',
              minWidth: '100%',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr>
                {visibleColumns.map((col) => {
                  const colorTheme = NOTION_COLOR_STYLES[col.color || 'default'];
                  const isStickyNro = col.id === 'nro';
                  const isStickyCi = col.id === 'ci';
                  const isStickyNombre = col.id === 'nombre';

                  const stickyStyles: React.CSSProperties = isStickyNro
                    ? { position: 'sticky', left: 0, zIndex: 5, minWidth: ANCHO_NRO, textAlign: 'center' }
                    : isStickyCi
                    ? { position: 'sticky', left: OFFSET_CI, zIndex: 5, minWidth: ANCHO_CI, textAlign: 'left' }
                    : isStickyNombre
                    ? {
                        position: 'sticky',
                        left: OFFSET_FUNCIONARIO,
                        zIndex: 5,
                        minWidth: ANCHO_FUNCIONARIO,
                        textAlign: 'left',
                        boxShadow: '2px 0 3px -1px rgba(0,0,0,0.12)',
                      }
                    : {};

                  return (
                    <th
                      key={col.id}
                      style={{
                        ...thBase,
                        backgroundColor: colorTheme.bg,
                        color: colorTheme.text,
                        minWidth: col.minWidth || '100px',
                        ...stickyStyles,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ opacity: 0.7, fontSize: '11px' }}>{getTypeIcon(col.type)}</span>
                          <span>{col.label}</span>
                        </span>

                        {col.id !== 'nro' && col.id !== 'ci' && col.id !== 'nombre' && col.id !== 'acciones' && (
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setOpenColumnMenuId(openColumnMenuId === col.id ? null : col.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: colorTheme.text,
                                fontSize: '13px',
                                padding: '1px 3px',
                                opacity: 0.7,
                                borderRadius: '4px',
                              }}
                              title="Opciones de columna"
                            >
                              ⋮
                            </button>

                            {/* Menú Contextual Dropdown */}
                            {openColumnMenuId === col.id && (
                              <div
                                ref={menuRef}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: '4px',
                                  zIndex: 10,
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
                                  width: '180px',
                                  textAlign: 'left',
                                  padding: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingColumn(col);
                                    setIsColumnModalOpen(true);
                                    setOpenColumnMenuId(null);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: '4px',
                                    color: '#0f172a',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  ✏️ Modificar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    moveColumn(col.id, 'left');
                                    setOpenColumnMenuId(null);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: '4px',
                                    color: '#0f172a',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  ⬅ Mover izquierda
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    moveColumn(col.id, 'right');
                                    setOpenColumnMenuId(null);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: '4px',
                                    color: '#0f172a',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  ➡ Mover derecha
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    toggleHideColumn(col.id);
                                    setOpenColumnMenuId(null);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: '4px',
                                    color: '#0f172a',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  👁️ Ocultar columna
                                </button>

                                {col.isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteColumn(col.id);
                                      setOpenColumnMenuId(null);
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      padding: '6px 10px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      borderRadius: '4px',
                                      color: '#be123c',
                                      borderTop: '1px solid #f1f5f9',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff1f2')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    🗑️ Eliminar columna
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Cabecera botón + para añadir columna */}
                <th
                  style={{
                    ...thBase,
                    padding: '8px',
                    width: '36px',
                    minWidth: '36px',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setEditingColumn(null);
                    setIsColumnModalOpen(true);
                  }}
                  title="Agregar columna personalizada"
                >
                  <span style={{ fontSize: '15px', color: '#059669', fontWeight: 800 }}>+</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    style={{
                      padding: '30px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '13px',
                    }}
                  >
                    No se encontraron funcionarios para el período o filtro actual.
                  </td>
                </tr>
              )}

              {filas.map((f, visIdx) => {
                const negativo = f.liq.netoACobrar < 0;
                const rowBg = negativo ? '#fef2f2' : visIdx % 2 === 0 ? '#ffffff' : '#fafafa';
                const rowContext = getRowContext(f.emp, f.liq, visIdx);

                return (
                  <tr key={`${f.emp.ci}-${f.realIndex}`} style={{ backgroundColor: rowBg }}>
                    {visibleColumns.map((col, colIdx) => {
                      const isStickyNro = col.id === 'nro';
                      const isStickyCi = col.id === 'ci';
                      const isStickyNombre = col.id === 'nombre';

                      const stickyCellStyles: React.CSSProperties = isStickyNro
                        ? { position: 'sticky', left: 0, zIndex: 1, backgroundColor: rowBg, textAlign: 'center', color: '#94a3b8', fontWeight: 600, minWidth: ANCHO_NRO }
                        : isStickyCi
                        ? { position: 'sticky', left: OFFSET_CI, zIndex: 1, backgroundColor: rowBg, fontWeight: 600, color: '#334155', minWidth: ANCHO_CI }
                        : isStickyNombre
                        ? {
                            position: 'sticky',
                            left: OFFSET_FUNCIONARIO,
                            zIndex: 1,
                            backgroundColor: rowBg,
                            fontWeight: 700,
                            color: '#0f172a',
                            minWidth: ANCHO_FUNCIONARIO,
                            boxShadow: '2px 0 3px -1px rgba(0,0,0,0.08)',
                          }
                        : {};

                      // 1. Columnas Fijas (N°, CI, Funcionario)
                      if (isStickyNro) {
                        return (
                          <td key={col.id} style={{ ...tdBase, ...stickyCellStyles, padding: '6px 8px' }}>
                            {visIdx + 1}
                          </td>
                        );
                      }
                      if (isStickyCi) {
                        return (
                          <td key={col.id} style={{ ...tdBase, ...stickyCellStyles, padding: '6px 10px' }}>
                            {f.emp.ci}
                          </td>
                        );
                      }
                      if (isStickyNombre) {
                        return (
                          <td
                            key={col.id}
                            style={{ ...tdBase, ...stickyCellStyles, padding: '6px 10px', cursor: 'pointer' }}
                            onDoubleClick={() => setDrawerEmpleadoIndex(f.realIndex)}
                            title="Doble clic para abrir Ficha de Carga Rápida"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                              <span>{f.emp.nombre}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrawerEmpleadoIndex(f.realIndex);
                                }}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '1px 5px',
                                  color: '#059669',
                                  fontWeight: 700,
                                }}
                                title="Editar en Ficha Rápida"
                              >
                                ⚡
                              </button>
                            </div>
                          </td>
                        );
                      }

                      // 2. Columna Acciones
                      if (col.id === 'acciones') {
                        return (
                          <td key={col.id} style={{ ...tdBase, textAlign: 'center', padding: '4px 6px' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setDrawerEmpleadoIndex(f.realIndex)}
                                style={{
                                  padding: '3px 7px',
                                  borderRadius: '4px',
                                  border: '1px solid #059669',
                                  backgroundColor: '#ecfdf5',
                                  color: '#047857',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Carga Rápida Asistida"
                              >
                                ⚡ Ficha
                              </button>
                              <button
                                onClick={() => setSelectedLiquidation(f.liq)}
                                style={btnRecibo}
                                title="Ver Recibo Oficial"
                              >
                                📄
                              </button>
                            </div>
                          </td>
                        );
                      }

                      // 3. Columnas Calculadas Nativas del Sistema
                      if (col.id === 'diasTrabajados') {
                        return (
                          <td key={col.id} style={{ ...tdBase, textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                            {f.liq.diasTrabajadosEfectivos}
                          </td>
                        );
                      }
                      if (col.id === 'totalHaberes') {
                        return (
                          <td key={col.id} style={calcStyle}>
                            {formatGuaranies(f.liq.haberes.totalHaberesBrutos)}
                          </td>
                        );
                      }
                      if (col.id === 'imponibleIps') {
                        return (
                          <td key={col.id} style={{ ...calcStyle, color: '#2563eb' }}>
                            {f.emp.tipo === 'factura' ? '—' : formatGuaranies(f.liq.haberesImponiblesIps)}
                          </td>
                        );
                      }
                      if (col.id === 'ipsObrero') {
                        return (
                          <td key={col.id} style={{ ...calcStyle, color: '#dc2626' }}>
                            {f.emp.tipo === 'factura' ? '—' : formatGuaranies(f.liq.descuentos.aporteObreroIps)}
                          </td>
                        );
                      }
                      if (col.id === 'totalDescuentos') {
                        return (
                          <td key={col.id} style={{ ...calcStyle, color: '#dc2626' }}>
                            {formatGuaranies(f.liq.descuentos.totalDescuentos)}
                          </td>
                        );
                      }
                      if (col.id === 'netoACobrar') {
                        return (
                          <td
                            key={col.id}
                            style={{
                              ...calcStyle,
                              fontWeight: 800,
                              color: negativo ? '#dc2626' : '#047857',
                            }}
                          >
                            {formatGuaranies(f.liq.netoACobrar)}
                          </td>
                        );
                      }

                      // 4. Columna de Fórmula (fx)
                      if (col.type === 'formula') {
                        const formulaVal = col.formula ? evaluateFormula(col.formula, rowContext) : 0;
                        const formatted = typeof formulaVal === 'number' ? formatGuaranies(formulaVal) : String(formulaVal);
                        return (
                          <td
                            key={col.id}
                            title={`Fórmula: ${col.formula || 'No definida'}`}
                            style={{
                              ...calcStyle,
                              backgroundColor: '#f8fafc',
                              color: '#0f172a',
                              fontFamily: typeof formulaVal === 'number' ? 'monospace' : 'inherit',
                            }}
                          >
                            {formatted}
                          </td>
                        );
                      }

                      // 5. Columna de Selección (Select / Tags)
                      if (col.type === 'select') {
                        const currentTag = f.emp.customFields?.[col.id] || '';
                        return (
                          <td key={col.id} style={{ ...tdBase, textAlign: 'center' }}>
                            <select
                              value={currentTag}
                              onChange={(e) => updateCampo(f.realIndex, col.id, e.target.value, col.isCustom)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                backgroundColor: currentTag ? '#e0e7ff' : '#ffffff',
                                color: currentTag ? '#3730a3' : '#64748b',
                                fontWeight: currentTag ? 700 : 400,
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">(Sin asignar)</option>
                              {(col.options || []).map((opt, i) => (
                                <option key={i} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      // 6. Columna de Fecha
                      if (col.type === 'date') {
                        const dateVal = col.isCustom ? f.emp.customFields?.[col.id] || '' : (f.emp as any)[col.id] || '';
                        return (
                          <td key={col.id} style={tdBase}>
                            <input
                              type="date"
                              value={dateVal}
                              onChange={(e) => updateCampo(f.realIndex, col.id, e.target.value, col.isCustom)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            />
                          </td>
                        );
                      }

                      // 7. Columna de Texto Libre
                      if (col.type === 'text') {
                        const textVal = col.isCustom ? f.emp.customFields?.[col.id] || '' : (f.emp as any)[col.id] || '';
                        return (
                          <td key={col.id} style={tdBase}>
                            <input
                              type="text"
                              value={textVal}
                              onChange={(e) => updateCampo(f.realIndex, col.id, e.target.value, col.isCustom)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '12.5px',
                                boxSizing: 'border-box',
                              }}
                            />
                          </td>
                        );
                      }

                      // 8. Columna Numérica / Moneda / Porcentaje Editable (con Excel in-cell formula)
                      const cellKey = `${f.realIndex}-${col.id}`;
                      const rawNumericVal = col.isCustom ? f.emp.customFields?.[col.id] : (f.emp as any)[col.id];
                      const displayVal = cellBuffers[cellKey] !== undefined
                        ? cellBuffers[cellKey]
                        : rawNumericVal === undefined || rawNumericVal === null
                        ? ''
                        : String(rawNumericVal);

                      return (
                        <td key={col.id} style={tdBase}>
                          <input
                            type="text"
                            value={displayVal}
                            data-row={visIdx}
                            data-col={colIdx}
                            placeholder="0"
                            onChange={(ev) => {
                              const val = ev.target.value;
                              setCellBuffers((prev) => ({ ...prev, [cellKey]: val }));
                            }}
                            onBlur={() => {
                              const buf = cellBuffers[cellKey];
                              if (buf !== undefined) {
                                updateCampo(f.realIndex, col.id, buf, col.isCustom);
                                setCellBuffers((prev) => {
                                  const copy = { ...prev };
                                  delete copy[cellKey];
                                  return copy;
                                });
                              }
                            }}
                            onKeyDown={(ev) => handleCellKeyDown(ev, visIdx, colIdx, f.realIndex, col)}
                            onFocus={(ev) => {
                              ev.currentTarget.style.backgroundColor = '#fffbeb';
                            }}
                            style={{
                              ...inputCell,
                              minWidth: col.minWidth || '100px',
                            }}
                          />
                        </td>
                      );
                    })}

                    {/* Celda vacía correspondiente a la columna "+" */}
                    <td style={{ ...tdBase, width: '36px', backgroundColor: '#f8fafc' }} />
                  </tr>
                );
              })}
            </tbody>

            {/* ── Fila de Totales Dinámica ── */}
            <tfoot>
              <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700 }}>
                {visibleColumns.map((col) => {
                  const isStickyNro = col.id === 'nro';
                  const isStickyCi = col.id === 'ci';
                  const isStickyNombre = col.id === 'nombre';

                  const stickyFootStyles: React.CSSProperties = isStickyNro
                    ? { position: 'sticky', left: 0, zIndex: 3, textAlign: 'center', backgroundColor: '#0f172a', minWidth: ANCHO_NRO }
                    : isStickyCi
                    ? { position: 'sticky', left: OFFSET_CI, zIndex: 3, textAlign: 'left', backgroundColor: '#0f172a', minWidth: ANCHO_CI }
                    : isStickyNombre
                    ? {
                        position: 'sticky',
                        left: OFFSET_FUNCIONARIO,
                        zIndex: 3,
                        textAlign: 'left',
                        backgroundColor: '#0f172a',
                        minWidth: ANCHO_FUNCIONARIO,
                        boxShadow: '2px 0 3px -1px rgba(0,0,0,0.3)',
                      }
                    : {};

                  if (isStickyNro) {
                    return (
                      <td key={col.id} style={{ ...tdFoot, ...stickyFootStyles }}>
                        {totalesPorColumna.nro}
                      </td>
                    );
                  }
                  if (isStickyCi) {
                    return (
                      <td key={col.id} style={{ ...tdFoot, ...stickyFootStyles }}>
                        —
                      </td>
                    );
                  }
                  if (isStickyNombre) {
                    return (
                      <td key={col.id} style={{ ...tdFoot, ...stickyFootStyles }}>
                        TOTALES ({totalesPorColumna.nro})
                      </td>
                    );
                  }
                  if (col.id === 'acciones' || col.type === 'text' || col.type === 'date' || col.type === 'select') {
                    return (
                      <td key={col.id} style={tdFoot}>
                        —
                      </td>
                    );
                  }

                  const totalVal = totalesPorColumna[col.id] || 0;
                  const isCurrency = col.type === 'currency' || col.id === 'totalHaberes' || col.id === 'imponibleIps' || col.id === 'ipsObrero' || col.id === 'totalDescuentos' || col.id === 'netoACobrar';

                  return (
                    <td
                      key={col.id}
                      style={{
                        ...tdFoot,
                        color: col.id === 'totalHaberes' || col.id === 'netoACobrar' ? '#6ee7b7' : col.id === 'ipsObrero' || col.id === 'totalDescuentos' ? '#fca5a5' : '#ffffff',
                      }}
                    >
                      {isCurrency ? formatGuaranies(totalVal) : totalVal}
                    </td>
                  );
                })}

                <td style={{ ...tdFoot, width: '36px', backgroundColor: '#0f172a' }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )}

    {/* ── Focus Drawer Lateral para Carga Rápida de Empleado ── */}
    <PayrollEmployeeDrawer
      isOpen={drawerEmpleadoIndex !== null}
      onClose={() => setDrawerEmpleadoIndex(null)}
      empleado={drawerEmpleadoIndex !== null ? empleados[drawerEmpleadoIndex] : null}
      empleadoIndex={drawerEmpleadoIndex ?? 0}
      totalEmpleados={empleados.length}
      onUpdateEmpleado={(idx, updated) => {
        setEmpleados((prev) => {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        });
        setDirty(true);
      }}
      onNavigate={(newIdx) => setDrawerEmpleadoIndex(newIdx)}
      customColumns={columns}
      empresa={empresa}
      onOpenNovelties={(ci) => {
        setInitialCiForNovelty(ci);
        setIsNoveltiesModalOpen(true);
      }}
    />

    {/* ── Modal de Gestión y Programación de Novedades Salariales ── */}
    <PayrollNoveltiesModal
      isOpen={isNoveltiesModalOpen}
      onClose={() => {
        setIsNoveltiesModalOpen(false);
        setInitialCiForNovelty(undefined);
      }}
      empresaId={empresa?.id || ''}
      empleados={empleados}
      initialCi={initialCiForNovelty}
      periodoId={periodoKey}
      onNovedadesActualizadas={() => {
        handleAplicarNovedades();
      }}
    />

      {/* ── Modal de Configuración / Creación de Columna ── */}
      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => {
          setIsColumnModalOpen(false);
          setEditingColumn(null);
        }}
        onSave={handleSaveColumn}
        editingColumn={editingColumn}
        availableColumns={availableFormulaColumns}
      />

      {/* ── Drawer de Visibilidad de Columnas ── */}
      <ColumnVisibilityDrawer
        isOpen={isVisibilityDrawerOpen}
        onClose={() => setIsVisibilityDrawerOpen(false)}
        columns={columns}
        hiddenColumnIds={hiddenColumnIds}
        onToggleColumn={toggleHideColumn}
        onResetDefaults={() => {
          setHiddenColumnIds([]);
          setDirty(true);
        }}
      />

      {/* ── Modal de Recibo Individual ── */}
      {selectedLiquidation && (
        <PayrollSlipModal
          isOpen={true}
          onClose={() => setSelectedLiquidation(null)}
          liquidacion={selectedLiquidation}
          empresaNombre={empresa?.razonSocial || 'EMPRESA CLIENTE S.A.'}
          periodo={tituloPeriodo}
        />
      )}

      {/* ── Modal para Agregar Funcionario ── */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                ➕ Agregar Funcionario a la Nómina
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
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
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Cédula (CI N°)
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmp.ci}
                    onChange={(e) => setNewEmp({ ...newEmp, ci: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
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
                    onChange={(e) => setNewEmp({ ...newEmp, tipo: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
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
