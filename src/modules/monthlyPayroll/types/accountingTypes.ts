/**
 * TIPOS E INTERFACES - CONTABILIDAD Y ASIENTO CONSOLIDADO DE NÓMINA (LABORAPY)
 *
 * Soporte universal para Odoo, SAP Business One, ERPs locales paraguayos
 * y sistemas contables bajo normativa DNIT / IFRS.
 */

export type NaturalezaCuenta = 'DEBE' | 'HABER';
export type TipoSistemaContable = 'odoo' | 'sap' | 'universal';
export type CategoriaCuenta =
  | 'gasto_personal'
  | 'cargas_sociales'
  | 'pasivo_laboral'
  | 'pasivo_fiscal'
  | 'regularizadora'
  | 'activo_personal';

export interface CuentaContableConfig {
  id: string;
  codigo: string;
  nombre: string;
  naturaleza: NaturalezaCuenta;
  categoria: CategoriaCuenta;
  descripcion?: string;
}

export interface LineaAsientoContable {
  numeroLinea: number;
  codigoCuenta: string;
  nombreCuenta: string;
  concepto: string;
  debe: number;
  haber: number;
  centroCostos?: string;
  referencia?: string;
  departamento?: string;
  empleadoId?: string;
  esProvision?: boolean;
}

export interface MetadataAsiento {
  cantidadEmpleados: number;
  totalCotizantes: number;
  totalFacturadores: number;
  incluyeAguinaldoProvision: boolean;
  generadoEn: string;
  empresaId?: string;
  empresaNombre?: string;
  empresaRuc?: string;
}

export interface AsientoContableGeneral {
  id: string;
  fechaAsiento: string;
  periodo: string;
  glosaGeneral: string;
  moneda: 'PYG' | 'USD' | 'BIMONETARIO';
  tipoCambioGs?: number;
  empresa: {
    id: string;
    nombre: string;
    ruc: string;
  };
  lineas: LineaAsientoContable[];
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  estaCuadrado: boolean;
  metadata: MetadataAsiento;
}

export type PlanDeCuentasNomina = Record<string, CuentaContableConfig>;

export interface OpcionesAsientoNomina {
  incluirProvisionAguinaldo?: boolean;
  desglosarPorDepartamento?: boolean;
  desglosarPorCentroCostos?: boolean;
  prefijoGlosa?: string;
  fechaContable?: string;
  moneda?: 'PYG' | 'USD' | 'BIMONETARIO';
  tipoCambioGs?: number;
}
