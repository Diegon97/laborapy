/**
 * CATÁLOGO CANÓNICO DE CONCEPTOS — LIQUIDACIÓN IPS
 *
 * Cada etiqueta que llega de la nómina se resuelve contra este catálogo; el catálogo
 * manda por sobre cualquier tabla auxiliar. Nunca se inventa gravabilidad: las
 * etiquetas no mapeadas devuelven `undefined` y el motor las alerta.
 *
 * Base legal: Decreto-Ley N.º 1860/50, Art. 76 (haber imponible), con las
 * excepciones del Código del Trabajo (Ley N.º 213/93) para Aguinaldo (Art. 245)
 * y Bonificación Familiar (Art. 263).
 *
 * NOTA DE DIVERGENCIA: `IMPONIBILIDAD_IPS` (src/modules/payroll/constants.ts) marca
 * preaviso e indemnización como imponibles:true por criterio de retención del cliente;
 * este catálogo los trata como no salariales (reparación de daño). El catálogo canónico
 * es el que gobierna el módulo IPS y la divergencia se documenta aquí a propósito,
 * sin importar la constante para no arrastrar una dependencia no utilizada.
 */

import type { ClaseConcepto } from './types';

/** Definición canónica de un concepto IPS: identidad, clase, fuente legal y alias de nómina. */
export interface DefinicionConceptoIPS {
  id: string;
  descripcion: string;
  clase: ClaseConcepto;
  fuenteLegal: string;
  alias: string[];
}

/** Identificador reservado para etiquetas que no logran resolverse contra el catálogo. */
export const CONCEPTO_DESCONOCIDO_ID = 'CONCEPTO_DESCONOCIDO';

const FUENTE_ART_76 = 'Art. 76, Decreto-Ley N.º 1860/50';

/** Catálogo canónico de conceptos IPS (imponibles, exentos y fuera de la base). */
export const CATALOGO_CONCEPTOS_IPS: DefinicionConceptoIPS[] = [
  {
    id: 'SALARIO_BASE',
    descripcion: 'Salario base mensual o jornal devengado en el período',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['SALARIO BASE', 'SUELDO', 'BASICO', 'JORNAL', 'HA1000', 'SAL. FIJO'],
  },
  {
    id: 'SALARIO_USD',
    descripcion: 'Salario base pactado en dólares, convertido a guaraníes',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['SUELDO USD', 'SALARIO BASE DOLARES', 'HA1001'],
  },
  {
    id: 'ADICIONAL_CARGO',
    descripcion: 'Adicional por cargo o función asignada',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['ADICIONAL POR CARGO', 'ADICIONAL FUNCION', 'HA1200'],
  },
  {
    id: 'FERIADO_TRABAJADO',
    descripcion: 'Feriado o domingo trabajado con la remuneración adicional correspondiente',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['FERIADO TRABAJADO', 'DOMINGO TRABAJADO', 'HA1212'],
  },
  {
    id: 'RECARGO_NOCTURNO',
    descripcion: 'Recargo por trabajo en jornada nocturna',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['RECARGO NOCTURNO', 'HA1213'],
  },
  {
    id: 'HORAS_EXTRA_50',
    descripcion: 'Horas extraordinarias con recargo del 50 %',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['HS. EXTRAS AL 50 %', 'HE 50', 'HA2000'],
  },
  {
    id: 'HORAS_EXTRA_100',
    descripcion: 'Horas extraordinarias con recargo del 100 %',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['HS. EXTRAS AL 100 %', 'HE 100', 'HA2010'],
  },
  {
    id: 'HORAS_EXTRA_130',
    descripcion: 'Horas extraordinarias con recargo del 130 %',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['HS. EXTRAS AL 130 %', 'HE 130', 'HA2015'],
  },
  {
    id: 'COMISIONES',
    descripcion: 'Comisiones y remuneraciones variables del período',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['COMISIONES', 'MONTO COMISION', 'VARIABLE', 'HA2500'],
  },
  {
    id: 'COMISION_PRESTADOR_USD',
    descripcion: 'Comisiones de prestadores expresadas en dólares',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['COMISIONES PRESTADORES DOLARES', 'HA2502'],
  },
  {
    id: 'COMISION_MAYORISTA',
    descripcion: 'Comisiones del canal mayorista',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['COMISIONES MAYORISTAS', 'CANAL MAYORISTA', 'HA2550'],
  },
  {
    id: 'VACACIONES_GOZADAS',
    descripcion: 'Vacaciones gozadas durante el período',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['VACACIONES', 'HA5100'],
  },
  {
    id: 'VACACIONES_CAUSADAS',
    descripcion: 'Vacaciones causadas y no gozadas liquidadas en el período',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['SALDO VACACIONES', 'VACACIONES NO GOZADAS', 'HA5111'],
  },
  {
    id: 'LICENCIA_ENFERMEDAD_PATRONAL',
    descripcion: 'Licencia por enfermedad con cobertura a cargo del empleador',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['LICENCIA POR ENFERMEDAD', 'REPOSO ENFERM.', 'HA1310'],
  },
  {
    id: 'LICENCIA_MATERNIDAD',
    descripcion: 'Licencia por maternidad (subsidio o cobertura complementaria)',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['LICENCIA POR MATERNIDAD', 'REPOSO MATERNIDAD', 'HA1330'],
  },
  {
    id: 'BONO_IMPONIBLE',
    descripcion: 'Bonificaciones extraordinarias, gratificaciones y premios imponibles',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['BONIFICACION EXTRAORDINARIA', 'GRATIFICACION', 'PREMIO IMPONIBLE', 'HA4020106'],
  },
  {
    id: 'PARTICIPACION_UTILIDADES',
    descripcion: 'Participación en utilidades de la empresa',
    clase: 'imponible',
    fuenteLegal: FUENTE_ART_76,
    alias: ['PARTICIPACION EN UTILIDADES'],
  },
  {
    id: 'AGUINALDO',
    descripcion: 'Aguinaldo (SAC) anual o proporcional',
    clase: 'exento',
    fuenteLegal:
      'Art. 245, Ley N.º 213/93 (Código del Trabajo) · excluido por Art. 76, Decreto-Ley N.º 1860/50',
    alias: ['AGUINALDO PROPORCIONAL', 'SAC', 'HA5070'],
  },
  {
    id: 'BONIFICACION_FAMILIAR',
    descripcion: 'Bonificación o asignación familiar',
    clase: 'exento',
    fuenteLegal:
      'Art. 263, Ley N.º 213/93 (Código del Trabajo) · excluido por Art. 76, Decreto-Ley N.º 1860/50',
    alias: ['BONIFICACION FAMILIAR', 'BONIF. FAM.', 'ASIGNACION FAMILIAR'],
  },
  {
    id: 'VIATICOS',
    descripcion: 'Viáticos y movilidad (reintegro de gastos del trabajador)',
    clase: 'exento',
    fuenteLegal:
      'Fuera de la base imponible — reintegro de gastos (Art. 76, Decreto-Ley N.º 1860/50)',
    alias: ['VIATICOS', 'REF Y VIATICOS', 'MOVILIDAD'],
  },
  {
    id: 'REFRIGERIO',
    descripcion: 'Refrigerio entregado en el lugar de trabajo',
    clase: 'exento',
    fuenteLegal:
      'Fuera de la base imponible — prestación en especie (Art. 76, Decreto-Ley N.º 1860/50)',
    alias: ['REFRIGERIO', 'ALIMENTACION IN SITU'],
  },
  {
    id: 'PREAVISO',
    descripcion: 'Preaviso sustitutivo en dinero',
    clase: 'exento',
    fuenteLegal: 'Reparación de daño — no salarial',
    alias: ['PREAVISO'],
  },
  {
    id: 'INDEMNIZACION',
    descripcion: 'Indemnización por despido injustificado',
    clase: 'exento',
    fuenteLegal: 'Reparación de daño — no salarial',
    alias: ['INDEMNIZACION', 'DESPIDO'],
  },
  {
    id: 'SUBSIDIO_IPS',
    descripcion: 'Subsidio del IPS pagado o adelantado por reposo',
    clase: 'exento',
    fuenteLegal:
      'Fuera de la base imponible — subsidio previsional (Art. 76, Decreto-Ley N.º 1860/50)',
    alias: ['SUBSIDIO IPS', 'SUBSIDIO POR REPOSO'],
  },
  {
    id: 'IVA_FACTURA',
    descripcion: 'IVA o retención de IVA de facturas de prestadores',
    clase: 'no_aplica',
    fuenteLegal: 'Relación civil o deducción — fuera de la base',
    alias: ['I.V.A.', 'IVA', 'RETENCION IVA', 'HA1100'],
  },
  {
    id: 'DESCUENTO_AUSENCIA',
    descripcion: 'Descuento por ausencia o falta injustificada',
    clase: 'no_aplica',
    fuenteLegal: 'Relación civil o deducción — fuera de la base',
    alias: ['DESCUENTO POR AUSENCIA', 'AUSENCIA', 'FALTA', 'HA1365'],
  },
];

/**
 * Normaliza una etiqueta de nómina: recorta extremos, remueve acentos,
 * colapsa espacios múltiples y pasa a mayúsculas.
 */
export function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Índice determinista alias normalizado → definición canónica. */
function construirIndice(
  catalogo: DefinicionConceptoIPS[],
): Map<string, DefinicionConceptoIPS> {
  const indice = new Map<string, DefinicionConceptoIPS>();
  for (const definicion of catalogo) {
    for (const alias of definicion.alias) {
      indice.set(normalizarEtiqueta(alias), definicion);
    }
  }
  return indice;
}

const INDICE_CONCEPTOS_IPS = construirIndice(CATALOGO_CONCEPTOS_IPS);

/**
 * Resuelve una etiqueta de nómina contra el catálogo canónico.
 * Devuelve `undefined` para etiquetas no mapeadas: nunca se asume gravabilidad.
 */
export function resolverConceptoCanonico(
  etiqueta: string,
): DefinicionConceptoIPS | undefined {
  return INDICE_CONCEPTOS_IPS.get(normalizarEtiqueta(etiqueta));
}
