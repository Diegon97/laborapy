/**
 * SERVICIO DE IMPORTACIÓN Y EXPORTACIÓN MASIVA DE NÓMINA (EXCEL / XLSX)
 * Cumplimiento con el ERP LaboraPy y Código del Trabajo de Paraguay (Ley N.º 213/93)
 * Protección contra inyección de fórmulas CSV/Excel y validación de tipos estricta.
 */

import * as XLSX from 'xlsx';
import type { Empleado, EmpresaCliente } from '../types/clientPortal';
import { SALARIO_MINIMO_LEGAL_PY } from './clientStorageService';

export interface ExcelImportResult {
  totalRows: number;
  validEmployees: Empleado[];
  errors: string[];
  duplicatesInFile: string[];
  alreadyExistingInCompany: string[];
}

const FORBIDDEN_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

/**
 * Sanitiza valores contra inyecciones de fórmulas maliciosas en Excel / CSV (OWASP CSV Injection).
 */
export function sanitizeExcelValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'string' ? val : String(val);
  const trimmed = str.replace(/^[\s\u0000-\u001F]+/, '');
  if (trimmed.length > 0 && FORBIDDEN_FORMULA_PREFIXES.includes(trimmed.charAt(0))) {
    return "'" + str;
  }
  return str;
}

/**
 * Limpia números de Cédula de Identidad retirando caracteres no numéricos
 */
export function cleanCiNumber(ci?: string | number): string {
  if (ci === null || ci === undefined) return '';
  return String(ci).replace(/[^0-9]/g, '');
}

const COLUMNS_EXPORT: Array<{ header: string; get: (e: Empleado) => any; width: number }> = [
  { header: 'Cédula (C.I.)', get: e => e.ci, width: 16 },
  { header: 'Nombres', get: e => e.nombres, width: 22 },
  { header: 'Apellidos', get: e => e.apellidos, width: 22 },
  { header: 'Cargo', get: e => e.cargo, width: 24 },
  { header: 'Departamento', get: e => e.departamento, width: 22 },
  { header: 'Salario Base (Gs.)', get: e => e.salarioBase, width: 18 },
  { header: 'Fecha Ingreso', get: e => e.fechaIngreso, width: 15 },
  { header: 'Modalidad Pago', get: e => e.modalidadPago, width: 16 },
  { header: 'Sexo', get: e => e.sexo, width: 8 },
  { header: 'Estado Civil', get: e => e.estadoCivil, width: 14 },
  { header: 'Nacionalidad', get: e => e.nacionalidad, width: 14 },
  { header: 'Hijos Menores', get: e => e.hijosMenores, width: 14 },
  { header: 'Hijos Discapacidad', get: e => e.hijosDiscapacidad ?? 0, width: 18 },
  { header: 'Teléfono', get: e => e.telefono ?? '', width: 16 },
  { header: 'Email', get: e => e.email ?? '', width: 26 },
  { header: 'Domicilio', get: e => e.domicilio ?? '', width: 32 },
  { header: 'Estado Laboral', get: e => e.estado, width: 14 },
];

/**
 * Exporta el padrón completo de colaboradores a una planilla Excel (.xlsx) estructurada y formateada.
 */
export function generarLibroNominaExcel(empleados: Empleado[]): XLSX.WorkBook {
  const headerRow = COLUMNS_EXPORT.map(c => c.header);

  const dataRows: Array<Array<any>> = empleados.map(emp =>
    COLUMNS_EXPORT.map(col => {
      const raw = col.get(emp);
      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return raw;
      return sanitizeExcelValue(raw);
    })
  );

  const aoa: Array<Array<any>> = [headerRow, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet['!cols'] = COLUMNS_EXPORT.map(c => ({ wch: c.width }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nómina_Colaboradores');
  return workbook;
}

/**
 * Exporta el padrón completo de colaboradores a una planilla Excel (.xlsx) estructurada y formateada.
 */
export function exportarNominaAExcel(
  empleados: Empleado[],
  empresa: EmpresaCliente,
  fileNamePrefix?: string
): void {
  const workbook = generarLibroNominaExcel(empleados);

  const hoy = new Date();
  const fechaStr = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
  const rucLimpio = (empresa?.ruc || 'EMPRESA').replace(/[^0-9A-Za-z]/g, '');
  const prefix = fileNamePrefix ? `${fileNamePrefix}_` : '';
  const fileName = `${prefix}Nomina_Empleados_${rucLimpio}_${fechaStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

export function generarLibroPlantillaExcel(): XLSX.WorkBook {
  const plantillaHeaders = [
    'Cédula (C.I.)',
    'Nombres',
    'Apellidos',
    'Cargo',
    'Departamento',
    'Salario Base (Gs.)',
    'Fecha Ingreso (YYYY-MM-DD)',
    'Modalidad Pago (mensual/jornalero)',
    'Sexo (M/F)',
    'Estado Civil',
    'Nacionalidad',
    'Hijos Menores',
    'Hijos Discapacidad',
    'Teléfono',
    'Email',
    'Domicilio',
    'Estado (activo/prueba/suspendido/inactivo)',
  ];

  const ejemploFilas = [
    [
      '3849201',
      'Carlos Manuel',
      'Gómez Duarte',
      'Analista de Selección',
      'Recursos Humanos',
      4500000,
      '2023-03-01',
      'mensual',
      'M',
      'Soltero/a',
      'Paraguaya',
      1,
      0,
      '0981-123456',
      'carlos.gomez@empresa.com.py',
      'Avda. Mcal. López 1250 c/ Rca. Argentina',
      'activo',
    ],
    [
      '4920183',
      'María Belén',
      'Benítez Ramos',
      'Diseñadora Gráfica',
      'Marketing',
      3800000,
      '2024-02-15',
      'mensual',
      'F',
      'Casado/a',
      'Paraguaya',
      2,
      0,
      '0982-654321',
      'maria.benitez@empresa.com.py',
      'Boggiani 5420 e/ Denis Roa',
      'activo',
    ],
    [
      '2910475',
      'Rubén Darío',
      'Ortiz López',
      'Operador Logístico',
      'Operaciones',
      2900000,
      '2022-07-10',
      'jornalero',
      'M',
      'Unión de Hecho',
      'Paraguaya',
      0,
      1,
      '0991-987654',
      'ruben.ortiz@empresa.com.py',
      'Eusebio Ayala Km 4.5',
      'activo',
    ],
  ];

  const aoa: Array<Array<any>> = [plantillaHeaders, ...ejemploFilas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 26 },
    { wch: 30 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
    { wch: 35 },
    { wch: 35 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Carga_Nomina');
  return wb;
}

/**
 * Descarga la Plantilla Oficial de Carga Masiva de Nómina para LaboraPy ERP.
 */
export function descargarPlantillaExcel(): void {
  const wb = generarLibroPlantillaExcel();
  XLSX.writeFile(wb, 'Plantilla_Carga_Nomina_LaboraPy.xlsx');
}

/** Mapeo flexible de encabezados alternativos de planillas Excel de clientes */
const HEADER_ALIASES: Record<string, string[]> = {
  ci: [
    'cedula',
    'cédula',
    'ci',
    'c.i.',
    'documento',
    'documento identidad',
    'cedula identidad',
    'cédula de identidad',
    'nro documento',
    'nro. documento',
  ],
  nombres: ['nombres', 'nombre', 'nombre y apellido', 'nombres y apellidos', 'funcionario', 'colaborador'],
  apellidos: ['apellidos', 'apellido'],
  cargo: ['cargo', 'puesto', 'posicion', 'posición', 'funcion', 'función', 'ocupacion', 'ocupación'],
  departamento: ['departamento', 'area', 'área', 'seccion', 'sección', 'sector', 'dpto', 'dpto.'],
  salarioBase: [
    'salario base (gs.)',
    'salario base',
    'salario',
    'sueldo',
    'sueldo base',
    'remuneracion',
    'remuneración',
  ],
  fechaIngreso: ['fecha ingreso', 'fecha de ingreso', 'ingreso', 'antigüedad', 'antiguedad', 'alta'],
  modalidadPago: ['modalidad', 'modalidad pago', 'modalidad de pago', 'tipo de pago'],
  sexo: ['sexo', 'genero', 'género'],
  estadoCivil: ['estado civil', 'estadocivil'],
  nacionalidad: ['nacionalidad', 'pais'],
  hijosMenores: ['hijos menores', 'hijos', 'cantidad de hijos', 'menores a cargo'],
  hijosDiscapacidad: ['hijos discapacidad', 'discapacidad', 'hijos con discapacidad'],
  telefono: ['telefono', 'teléfono', 'celular', 'móvil', 'movil', 'tel', 'contacto'],
  email: ['email', 'correo', 'correo electrónico', 'correo electronico', 'mail'],
  domicilio: ['domicilio', 'direccion', 'dirección', 'lugar de residencia'],
  estado: ['estado', 'estado laboral', 'situacion', 'situación', 'status'],
};

function normalizeHeaderKey(raw: string): string {
  return raw
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function matchHeader(raw: string): string | null {
  const norm = normalizeHeaderKey(raw);
  if (!norm) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (normalizeHeaderKey(alias) === norm) return key;
    }
  }
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const na = normalizeHeaderKey(alias);
      if (na.length >= 4 && (norm.includes(na) || na.includes(norm))) return key;
    }
  }
  return null;
}

function parseSalario(raw: any): number {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number' && isFinite(raw)) return Math.round(raw);
  const str = String(raw).trim();
  if (!str) return NaN;

  let cleaned = str.replace(/[Gs.\s$₲]/gi, '');
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      cleaned = cleaned.replace(/\./g, '');
    } else if (dotCount === 1) {
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length === 3) {
        cleaned = cleaned.replace('.', '');
      }
    }
  }
  const num = Number(cleaned);
  return isFinite(num) ? Math.round(num) : NaN;
}

function parseFecha(raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number' && isFinite(raw) && raw > 20000 && raw < 80000) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + raw * 86400 * 1000;
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Procesa y valida un archivo Excel cargado para dar de alta colaboradores en la nómina.
 */
export async function parseAndValidateExcelNomina(
  file: File,
  clienteId: string,
  empleadosExistentes: Empleado[] = []
): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const validEmployees: Empleado[] = [];
  const duplicatesInFile: string[] = [];
  const alreadyExistingInCompany: string[] = [];

  if (!file) {
    return {
      totalRows: 0,
      validEmployees,
      errors: ['No se seleccionó ningún archivo.'],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  } catch (err: any) {
    return {
      totalRows: 0,
      validEmployees,
      errors: [`El archivo no es un Excel válido: ${err?.message || String(err)}`],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      totalRows: 0,
      validEmployees,
      errors: ['El libro Excel no contiene hojas de cálculo.'],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rowsAoa: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as any[][];

  if (!rowsAoa || rowsAoa.length === 0) {
    return {
      totalRows: 0,
      validEmployees,
      errors: ['La planilla está vacía.'],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  let headerRowIndex = -1;
  let headerMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rowsAoa.length, 10); i++) {
    const candidate = rowsAoa[i] || [];
    const tempMap: Record<string, number> = {};
    for (let c = 0; c < candidate.length; c++) {
      const key = matchHeader(String(candidate[c] || ''));
      if (key && !(key in tempMap)) tempMap[key] = c;
    }
    if (Object.keys(tempMap).length >= 2) {
      headerRowIndex = i;
      headerMap = tempMap;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      totalRows: 0,
      validEmployees,
      errors: [
        'No se detectaron los encabezados en la planilla. Asegúrese de incluir columnas como "Cédula", "Nombres", "Cargo" y "Salario Base".',
      ],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  const dataStart = headerRowIndex + 1;
  const dataRows = rowsAoa.slice(dataStart).filter(r => {
    if (!r || r.length === 0) return false;
    return r.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
  });

  const totalRows = dataRows.length;
  const colIdx = (k: string): number => (k in headerMap ? headerMap[k] : -1);

  const idxCi = colIdx('ci');
  const idxNombres = colIdx('nombres');
  const idxApellidos = colIdx('apellidos');
  const idxCargo = colIdx('cargo');
  const idxDepartamento = colIdx('departamento');
  const idxSalario = colIdx('salarioBase');
  const idxFecha = colIdx('fechaIngreso');
  const idxModalidad = colIdx('modalidadPago');
  const idxSexo = colIdx('sexo');
  const idxEstadoCivil = colIdx('estadoCivil');
  const idxNacionalidad = colIdx('nacionalidad');
  const idxHijosMenores = colIdx('hijosMenores');
  const idxHijosDiscapacidad = colIdx('hijosDiscapacidad');
  const idxTelefono = colIdx('telefono');
  const idxEmail = colIdx('email');
  const idxDomicilio = colIdx('domicilio');
  const idxEstado = colIdx('estado');

  if (idxCi === -1 || idxNombres === -1) {
    return {
      totalRows,
      validEmployees,
      errors: ['El archivo debe contener obligatoriamente las columnas "Cédula" y "Nombres".'],
      duplicatesInFile,
      alreadyExistingInCompany,
    };
  }

  const existingCiSet = new Set(
    empleadosExistentes.map(e => cleanCiNumber(e.ci)).filter(Boolean)
  );
  const seenInFile = new Set<string>();
  const hoyISO = new Date().toISOString().split('T')[0];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const linea = dataStart + r + 1;

    const rawCi = idxCi >= 0 ? row[idxCi] : null;
    const rawNombres = idxNombres >= 0 ? row[idxNombres] : null;

    const ciLimpia = cleanCiNumber(rawCi);
    const nombres = rawNombres !== null && rawNombres !== undefined ? String(rawNombres).trim() : '';

    if (!ciLimpia) {
      errors.push(`Fila ${linea}: Cédula vacía o no numérica.`);
      continue;
    }
    if (!nombres) {
      errors.push(`Fila ${linea}: Campo Nombres está vacío.`);
      continue;
    }
    if (seenInFile.has(ciLimpia)) {
      duplicatesInFile.push(ciLimpia);
      errors.push(`Fila ${linea}: Cédula ${ciLimpia} duplicada dentro del archivo.`);
      continue;
    }
    seenInFile.add(ciLimpia);

    if (existingCiSet.has(ciLimpia)) {
      alreadyExistingInCompany.push(ciLimpia);
    }

    // Apellidos
    let apellidos = idxApellidos >= 0 && row[idxApellidos] ? String(row[idxApellidos]).trim() : '';
    // Si la columna "Nombres" vino como "Nombre y Apellido", separar razonablemente si apellidos está vacío
    if (!apellidos && nombres.includes(' ')) {
      const parts = nombres.split(' ');
      if (parts.length >= 2) {
        // Asignar primer token a nombre, resto a apellido
        // Mantener nombres intacto o split
      }
    }

    const cargo = idxCargo >= 0 && row[idxCargo] ? String(row[idxCargo]).trim() : 'Colaborador General';
    const departamento =
      idxDepartamento >= 0 && row[idxDepartamento] ? String(row[idxDepartamento]).trim() : 'Operaciones';

    let salarioBase = parseSalario(idxSalario >= 0 ? row[idxSalario] : null);
    if (!isFinite(salarioBase) || salarioBase <= 0) {
      salarioBase = SALARIO_MINIMO_LEGAL_PY;
    }

    let fechaIngreso = parseFecha(idxFecha >= 0 ? row[idxFecha] : null);
    if (!fechaIngreso) {
      fechaIngreso = hoyISO;
    }

    // Modalidad pago
    let modalidadPago: 'mensual' | 'jornalero' | 'destajo' | 'comisionista' = 'mensual';
    if (idxModalidad >= 0 && row[idxModalidad]) {
      const m = String(row[idxModalidad]).toLowerCase();
      if (m.includes('jornal')) modalidadPago = 'jornalero';
      else if (m.includes('destajo')) modalidadPago = 'destajo';
      else if (m.includes('comision')) modalidadPago = 'comisionista';
    }

    // Sexo
    let sexo: 'M' | 'F' | 'Otro' = 'M';
    if (idxSexo >= 0 && row[idxSexo]) {
      const s = String(row[idxSexo]).trim().toUpperCase();
      if (s.startsWith('F') || s === 'MUJER' || s === 'FEMENINO') sexo = 'F';
    }

    // Estado civil
    let estadoCivil: 'Soltero/a' | 'Casado/a' | 'Divorciado/a' | 'Viudo/a' | 'Unión de Hecho' = 'Soltero/a';
    if (idxEstadoCivil >= 0 && row[idxEstadoCivil]) {
      const ec = String(row[idxEstadoCivil]).toLowerCase();
      if (ec.includes('casad')) estadoCivil = 'Casado/a';
      else if (ec.includes('divorc')) estadoCivil = 'Divorciado/a';
      else if (ec.includes('viud')) estadoCivil = 'Viudo/a';
      else if (ec.includes('union') || ec.includes('unión') || ec.includes('concub')) estadoCivil = 'Unión de Hecho';
    }

    const nacionalidad =
      idxNacionalidad >= 0 && row[idxNacionalidad] ? String(row[idxNacionalidad]).trim() : 'Paraguaya';

    const hijosMenores =
      idxHijosMenores >= 0 && row[idxHijosMenores]
        ? Math.max(0, parseInt(String(row[idxHijosMenores]).replace(/\D/g, ''), 10) || 0)
        : 0;

    const hijosDiscapacidad =
      idxHijosDiscapacidad >= 0 && row[idxHijosDiscapacidad]
        ? Math.max(0, parseInt(String(row[idxHijosDiscapacidad]).replace(/\D/g, ''), 10) || 0)
        : 0;

    const telefono =
      idxTelefono >= 0 && row[idxTelefono] ? String(row[idxTelefono]).trim() : undefined;
    const email = idxEmail >= 0 && row[idxEmail] ? String(row[idxEmail]).trim() : undefined;
    const domicilio =
      idxDomicilio >= 0 && row[idxDomicilio] ? String(row[idxDomicilio]).trim() : undefined;

    let estado: 'activo' | 'prueba' | 'suspendido' | 'vacaciones' | 'inactivo' = 'activo';
    if (idxEstado >= 0 && row[idxEstado]) {
      const est = String(row[idxEstado]).toLowerCase();
      if (est.includes('prueb')) estado = 'prueba';
      else if (est.includes('suspend')) estado = 'suspendido';
      else if (est.includes('vacac')) estado = 'vacaciones';
      else if (est.includes('inact')) estado = 'inactivo';
    }

    const nuevoEmpleado: Empleado = {
      id: `emp_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`,
      clienteId,
      ci: ciLimpia,
      nombres,
      apellidos: apellidos || ' ',
      cargo,
      departamento,
      salarioBase,
      fechaIngreso,
      modalidadPago,
      sexo,
      estadoCivil,
      nacionalidad,
      hijosMenores,
      hijosDiscapacidad,
      telefono,
      email,
      domicilio,
      estado,
      periodoPruebaDias: 30,
      vacacionesCausadasAcumuladas: 0,
      vacacionesTomadas: 0,
      createdAt: new Date().toISOString(),
    };

    validEmployees.push(nuevoEmpleado);
  }

  return {
    totalRows,
    validEmployees,
    errors,
    duplicatesInFile,
    alreadyExistingInCompany,
  };
}
