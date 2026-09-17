/**
 * CATÁLOGO OFICIAL DE VARIABLES DEFINIBLES Y CONCEPTOS CONTABLES (LABORAPY)
 * Motor liquidador multimoneda: Salario Ordinario (MEN), Comisiones (COM),
 * Liquidación Final / Egreso (FIN) y Aguinaldo (AGU).
 *
 * Mapeo de cuentas Debe y Haber para Moneda Local (ML) y Moneda Extranjera (ME - USD).
 * Cumplimiento estricto de ciberseguridad Zero-Leak y protección de datos.
 */

export type TipoLiquidacionImpacto = 'MEN' | 'COM' | 'FIN' | 'AGU';
export type CategoriaVariable = 'haber' | 'descuento' | 'parametro' | 'dias' | 'porcentaje' | 'sistema';
export type MonedaVariable = 'PYG' | 'USD' | 'AMBAS';
export type TipoConceptoNomina = 'HABER' | 'RETENCION' | 'APORTE' | 'CONTRIBUCION' | 'SALARIO_FAMILIAR';

export interface VariableDefinibleNomina {
  codigo: string;
  descripcion: string;
  categoria: CategoriaVariable;
  moneda: MonedaVariable;
  liquidacionesImpactadas: TipoLiquidacionImpacto[];
  conceptoRelacionadoNumero?: number;
  formulaDefault?: string;
}

export interface ConceptoNominaOficial {
  numero: number;
  codigoVariable: string;
  nombre: string;
  tipo: TipoConceptoNomina;
  cuentaDebeML: string;
  cuentaHaberML: string;
  cuentaDebeME: string;
  cuentaHaberME: string;
  liquidacionesImpactadas: TipoLiquidacionImpacto[];
}

const v = (
  codigo: string,
  descripcion: string,
  categoria: CategoriaVariable,
  moneda: MonedaVariable,
  liq: TipoLiquidacionImpacto[],
  conc?: number,
  formula?: string,
): VariableDefinibleNomina => ({
  codigo,
  descripcion,
  categoria,
  moneda,
  liquidacionesImpactadas: liq,
  conceptoRelacionadoNumero: conc,
  formulaDefault: formula,
});

const c = (
  numero: number,
  codigoVariable: string,
  nombre: string,
  tipo: TipoConceptoNomina,
  cuentaDebeML: string,
  cuentaHaberML: string,
  cuentaDebeME: string,
  cuentaHaberME: string,
  liq: TipoLiquidacionImpacto[],
): ConceptoNominaOficial => ({
  numero,
  codigoVariable,
  nombre,
  tipo,
  cuentaDebeML,
  cuentaHaberML,
  cuentaDebeME,
  cuentaHaberME,
  liquidacionesImpactadas: liq,
});

export const DICCIONARIO_VARIABLES_DEFINIBLES: Record<string, VariableDefinibleNomina> = {
  ANT_AGUI: v('ANT_AGUI', 'Anticipo o Antigüedad Aguinaldo', 'parametro', 'PYG', ['AGU'], 6001),
  ANDOL: v('ANDOL', 'Anticipo Comisiones Dolares', 'descuento', 'USD', ['COM'], 6100),
  ANDOLMEN: v('ANDOLMEN', 'Anticipo Mensual Dolares', 'descuento', 'USD', ['MEN'], 6101),
  ANTICIPOVA: v('ANTICIPOVA', 'Anticipo Varios USD', 'descuento', 'USD', ['MEN', 'COM'], 9045),
  ASISMED: v('ASISMED', 'Asistencia medica', 'descuento', 'PYG', ['MEN', 'COM', 'FIN'], 4075),
  BF_MAN: v('BF_MAN', 'Bonificacion manual', 'haber', 'PYG', ['MEN'], 1000),
  BF_MANCO: v('BF_MANCO', 'Bonificacion manual Comision', 'haber', 'PYG', ['COM'], 1001),
  COMDOL: v('COMDOL', 'Comision en dolares', 'haber', 'USD', ['COM'], 2502),
  COMISION: v('COMISION', 'Comision en guaranies', 'haber', 'PYG', ['COM'], 2500),
  MER1: v('MER1', 'Compra mercs. 1', 'descuento', 'PYG', ['MEN', 'COM'], 4050),
  MER2: v('MER2', 'Compra mercs. 2', 'descuento', 'PYG', ['MEN', 'COM'], 4055),
  MER3: v('MER3', 'Compra mercs. 3', 'descuento', 'PYG', ['MEN', 'COM'], 4053),
  COTIZA: v('COTIZA', 'Cotizacion dolar', 'parametro', 'USD', ['MEN', 'COM', 'FIN']),
  DESC_ANT: v('DESC_ANT', 'Descuento anticipo manual', 'descuento', 'PYG', ['MEN', 'COM'], 6000),
  DESC_ANTA: v('DESC_ANTA', 'Descuento anticipo manual Aguinaldo', 'descuento', 'PYG', ['AGU'], 6001),
  DTOMER: v('DTOMER', 'Descuento de mercaderia', 'descuento', 'PYG', ['MEN', 'COM'], 4050),
  DESC_CEL: v('DESC_CEL', 'Descuento por celulares', 'descuento', 'PYG', ['MEN', 'COM'], 199),
  AUSEN: v('AUSEN', 'Dias de ausencias (solo mensuales)', 'dias', 'PYG', ['MEN'], 1365),
  SUSPEN: v('SUSPEN', 'Dias de suspension (solo mensuales)', 'dias', 'PYG', ['MEN'], 1360),
  DIAFERIADO: v('DIAFERIADO', 'DIAS FERIADO', 'dias', 'PYG', ['MEN', 'COM'], 2020),
  Dias_Indem: v('Dias_Indem', 'Dias Indemnizacion', 'dias', 'PYG', ['FIN'], 5200),
  DIALIBRE: v('DIALIBRE', 'DIAS LIBRE', 'dias', 'PYG', ['MEN', 'COM'], 1215),
  DNT: v('DNT', 'Días no trabajados', 'dias', 'PYG', ['MEN']),
  Dias_preav: v('Dias_preav', 'Dias preaviso', 'dias', 'PYG', ['FIN'], 5050),
  D_PREAV50: v('D_PREAV50', 'Dias preaviso 50%', 'dias', 'PYG', ['FIN'], 5051),
  DSVACNG: v('DSVACNG', 'Dias total de vacaciones no gozadas', 'dias', 'PYG', ['FIN']),
  DTR: v('DTR', 'Días trabajados', 'dias', 'PYG', ['MEN', 'COM', 'FIN', 'AGU'], 1000),
  DSVAC_VEN: v('DSVAC_VEN', 'Dias vacaciones vencidas', 'dias', 'PYG', ['MEN', 'FIN']),
  DSVACVEN4: v('DSVACVEN4', 'Dias vacaciones vencidas IV', 'dias', 'PYG', ['FIN']),
  DSVACVENll: v('DSVACVENll', 'Dias vacaciones vencidas ll', 'dias', 'PYG', ['FIN']),
  DSVACVEN3: v('DSVACVEN3', 'Dias vacaciones vencidas lll', 'dias', 'PYG', ['FIN']),
  DSVAC_CAU: v('DSVAC_CAU', 'Dias Vacs. causadas', 'dias', 'PYG', ['FIN'], 5100),
  DSVA_CAU: v('DSVA_CAU', 'Dias Vacs. causadas P', 'dias', 'PYG', ['FIN'], 5101),
  DSVAC_PRO: v('DSVAC_PRO', 'Dias Vacs. proporcionales', 'dias', 'PYG', ['FIN'], 5120),
  DIF_APOR: v('DIF_APOR', 'Diferencia de Aporte', 'descuento', 'PYG', ['MEN', 'COM'], 4095),
  DIF_HORA: v('DIF_HORA', 'Diferencia de Horas', 'haber', 'PYG', ['MEN', 'COM'], 1030),
  EMB_MAN: v('EMB_MAN', 'Embargo - importe manual', 'descuento', 'PYG', ['MEN'], 4000),
  EMB_CDOL: v('EMB_CDOL', 'Embargo - importe manual comision Dolares', 'descuento', 'USD', ['COM'], 4002),
  EMB_COGS: v('EMB_COGS', 'Embargo - Importe Manual Comision Gs', 'descuento', 'PYG', ['COM'], 4004),
  EMB_MES: v('EMB_MES', 'Embargo mensual', 'descuento', 'PYG', ['MEN'], 4000),
  EMBARGOS: v('EMBARGOS', 'Embargos', 'descuento', 'AMBAS', ['MEN', 'COM'], 4000),
  ESCOM: v('ESCOM', 'Es liquidacion de comision', 'parametro', 'AMBAS', ['COM']),
  FACDOL: v('FACDOL', 'Factura dolares', 'haber', 'USD', ['COM', 'MEN']),
  FACGS: v('FACGS', 'Factura guaranies', 'haber', 'PYG', ['COM', 'MEN']),
  FALLO_CAJ: v('FALLO_CAJ', 'Fallo de caja', 'haber', 'PYG', ['MEN', 'COM'], 2200),
  FALCAJ: v('FALCAJ', 'Faltante de caja', 'descuento', 'PYG', ['MEN', 'COM']),
  FALTRA: v('FALTRA', 'Faltante de Elemento de trabajo', 'descuento', 'PYG', ['MEN', 'COM']),
  FALMER: v('FALMER', 'Faltante de mercaderias', 'descuento', 'PYG', ['MEN', 'COM']),
  H100: v('H100', 'Horas extras al 100%', 'haber', 'PYG', ['MEN', 'COM'], 2010, 'SALHOR * 2.00'),
  H130: v('H130', 'Horas extras al 130%', 'haber', 'PYG', ['MEN', 'COM'], 2015, 'SALHOR * 2.60'),
  H50: v('H50', 'Horas extras al 50%', 'haber', 'PYG', ['MEN', 'COM'], 2000, 'SALHOR * 1.50'),
  HRN: v('HRN', 'HORAS RECARGO NOCTURNO.-', 'haber', 'PYG', ['MEN', 'COM'], 2016),
  DONACION: v('DONACION', 'Importe de donacion', 'descuento', 'AMBAS', ['MEN', 'COM'], 6050),
  HORAEXTRA: v('HORAEXTRA', 'Importe HORA EXTRA MANUAL', 'haber', 'PYG', ['MEN', 'COM']),
  IMPMANAGU: v('IMPMANAGU', 'Importe manual Aguinaldo', 'haber', 'PYG', ['AGU', 'FIN'], 4000),
  IMPINDEM: v('IMPINDEM', 'Importe manual de indemnizacion', 'haber', 'PYG', ['FIN'], 5200),
  IMPPREAV: v('IMPPREAV', 'Importe manual de preaviso', 'haber', 'PYG', ['FIN'], 5050),
  MANSAC: v('MANSAC', 'Importe manual de SAC', 'haber', 'PYG', ['AGU', 'FIN'], 4000),
  SACPROPIMP: v('SACPROPIMP', 'Importe manual de SAC proporcional', 'haber', 'PYG', ['FIN'], 5070),
  VACNOGOZIM: v('VACNOGOZIM', 'Importe manual de vacaciones no gozadas', 'haber', 'PYG', ['FIN']),
  MANVAC_CAU: v('MANVAC_CAU', 'Importe manual vacaciones causadas', 'haber', 'PYG', ['FIN'], 5100),
  MANVAC_PRO: v('MANVAC_PRO', 'Importe manual vacaciones proporcionales', 'haber', 'PYG', ['FIN'], 5120),
  MANVAC_VEN: v('MANVAC_VEN', 'Importe manual vacaciones vencidas', 'haber', 'PYG', ['FIN']),
  MIN_IPS: v('MIN_IPS', 'Importe minimo para calculo del IPS', 'parametro', 'PYG', ['MEN', 'COM', 'AGU']),
  IMPPLAN: v('IMPPLAN', 'Importe plan de medico', 'descuento', 'PYG', ['MEN', 'COM'], 4075),
  VARIABLE: v('VARIABLE', 'Importe variable', 'haber', 'PYG', ['MEN', 'COM'], 1214),
  VARICOMI: v('VARICOMI', 'Importe Variable Comi', 'haber', 'PYG', ['COM'], 2503),
  VARIABLEll: v('VARIABLEll', 'Importe Variable ll', 'haber', 'PYG', ['MEN', 'COM'], 2503),
  VARISALARI: v('VARISALARI', 'Importe variable Salario', 'haber', 'PYG', ['MEN'], 1214),
  VARIDOL: v('VARIDOL', 'Importe variable USD', 'haber', 'USD', ['MEN', 'COM'], 1209),
  VARYREF: v('VARYREF', 'Importe varyref', 'haber', 'PYG', ['MEN', 'COM'], 1202),
  LICGOC: v('LICGOC', 'Licencia con goces', 'dias', 'PYG', ['MEN']),
  LPM25: v('LPM25', 'Licencia de maternidad 25', 'dias', 'PYG', ['MEN'], 1331),
  LPN: v('LPN', 'Licencia no pagas', 'dias', 'PYG', ['MEN']),
  LAC: v('LAC', 'Licencia por accidente', 'dias', 'PYG', ['MEN'], 1350),
  LAC_PAR: v('LAC_PAR', 'Licencia por accidente (pago parcial)', 'dias', 'PYG', ['MEN']),
  LCA: v('LCA', 'Licencia por casamiento', 'dias', 'PYG', ['MEN']),
  LFA: v('LFA', 'Licencia por duelo', 'dias', 'PYG', ['MEN'], 1324),
  LPF: v('LPF', 'Licencia por enfermedad', 'dias', 'PYG', ['MEN'], 1310),
  LPF_PAR: v('LPF_PAR', 'Licencia por enfermedad (pago parcial)', 'dias', 'PYG', ['MEN']),
  LPM: v('LPM', 'Licencia por maternidad', 'dias', 'PYG', ['MEN'], 1330),
  LNA: v('LNA', 'Licencia por paternidad', 'dias', 'PYG', ['MEN'], 1323),
  LRESPUES: v('LRESPUES', 'Licencia reserva de puesto', 'dias', 'PYG', ['MEN']),
  LICNOGOC: v('LICNOGOC', 'Licencias sin goce', 'dias', 'PYG', ['MEN']),
  MONTO_MAN: v('MONTO_MAN', 'MONTO MANUAL', 'haber', 'AMBAS', ['MEN', 'COM']),
  CIPS: v('CIPS', 'Porcentaje de contribucion del IPS', 'porcentaje', 'PYG', ['MEN', 'COM', 'AGU'], 1000),
  PRESALI: v('PRESALI', 'Porcentaje de prestacion alimentaria', 'porcentaje', 'PYG', ['MEN', 'COM']),
  RIPS: v('RIPS', 'Porcentaje de retencion del IPS', 'porcentaje', 'PYG', ['MEN', 'COM', 'AGU'], 1000),
  POREMB: v('POREMB', 'Porcentaje Embargo', 'porcentaje', 'AMBAS', ['MEN', 'COM'], 4000),
  PRES_SOL: v('PRES_SOL', 'Prestamo Credito Solucion', 'descuento', 'PYG', ['MEN'], 4071),
  PRES_EMP_GS: v('PRES_EMP_GS', 'Prestamo Empresa Pagare', 'descuento', 'PYG', ['MEN'], 4080),
  PRES_EMP_USD: v('PRES_EMP_USD', 'Prestamo Empresa Dolares Salario', 'descuento', 'USD', ['MEN'], 4082),
  PRES_COMI_USD: v('PRES_COMI_USD', 'Prestamo Empresa Dolares Comi', 'descuento', 'USD', ['COM'], 4083),
  PROMSAL: v('PROMSAL', 'Promedio Salarial diario p/ calc de las indeminiz', 'parametro', 'PYG', ['FIN']),
  PSE_SET: v('PSE_SET', 'PSE_SET', 'parametro', 'PYG', ['MEN']),
  REEMBO: v('REEMBO', 'REEMBOLSO', 'haber', 'PYG', ['MEN', 'COM'], 1203),
  REFRIGERIO: v('REFRIGERIO', 'Refrigerio ll', 'haber', 'PYG', ['MEN', 'COM'], 1206),
  REFRI: v('REFRI', 'Refrigerio.-', 'haber', 'PYG', ['MEN'], 1216),
  REPOUSD: v('REPOUSD', 'Reposo UDS', 'haber', 'USD', ['MEN'], 1201),
  SALARIO: v('SALARIO', 'Salario a utilizar', 'haber', 'AMBAS', ['MEN', 'COM', 'FIN', 'AGU'], 1000),
  SALDIA: v('SALDIA', 'Salario diario', 'haber', 'AMBAS', ['MEN', 'FIN'], 1000, 'SALARIO / 30'),
  SALDOL: v('SALDOL', 'Salario Dolares', 'haber', 'USD', ['MEN', 'COM', 'FIN'], 1001),
  SALHOR: v('SALHOR', 'Salario hora', 'haber', 'AMBAS', ['MEN', 'FIN'], 1000, 'SALARIO / 240'),
  SALMEN: v('SALMEN', 'Salario mensual - calculado por el sistema', 'haber', 'PYG', ['MEN'], 1000),
  SALMIN: v('SALMIN', 'Salario minimo', 'parametro', 'PYG', ['MEN', 'COM', 'FIN', 'AGU']),
  SALNOC: v('SALNOC', 'Salario Nocturno', 'haber', 'PYG', ['MEN'], 2016),
  SER_SET: v('SER_SET', 'SER_SET', 'parametro', 'PYG', ['MEN']),
  SUEMIN: v('SUEMIN', 'Sueldo minimo vital y movil', 'parametro', 'PYG', ['MEN', 'FIN']),
  REC_SUELDO: v('REC_SUELDO', 'Sueldo para recibo', 'haber', 'PYG', ['MEN']),
  VACDOL: v('VACDOL', 'Vacaciones Causadas (USD)', 'haber', 'USD', ['MEN', 'FIN'], 2551),
  VACNGANT: v('VACNGANT', 'Vacaciones no gozadas años anteriores', 'haber', 'PYG', ['FIN']),
  V1000: v('V1000', 'Variable del recibo de Haberes 1000', 'haber', 'PYG', ['MEN']),
  VARIADIC: v('VARIADIC', 'Variable DIC', 'haber', 'PYG', ['MEN'], 1207),
  Viati: v('Viati', 'Viatico.-', 'haber', 'PYG', ['MEN'], 1217),
};

export const CATALOGO_CONCEPTOS_OFICIALES: ConceptoNominaOficial[] = [
  // ── Haberes en Dólares (ME) y Guaraníes (ML) ──
  c(1001, 'SALDOL', 'Salario base Dolares', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN', 'FIN']),
  c(1005, 'SALDOL', 'Salario base dolares (auxiliar)', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1209, 'VARIDOL', 'Variable USD', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN', 'COM']),
  c(2502, 'COMDOL', 'Comisiones Prestadores Dolares', 'HABER', '4020102', '2010614', '4020102', '2010615', ['COM']),
  c(1002, 'REPOUSD', 'Licencia por Maternidad USD', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(2551, 'VACDOL', 'Vacaciones Causadas USD', 'HABER', '4010126', '2010614', '4010126', '2010615', ['MEN', 'FIN']),
  c(2552, 'VACDOL', 'Vacaciones Causadas ll USD', 'HABER', '4010126', '2010614', '4010126', '2010615', ['MEN', 'FIN']),
  c(6101, 'ANDOLMEN', 'Anticipo Mensual Dolares', 'HABER', '1020315', '2010614', '1020317', '2010615', ['MEN']),
  c(6100, 'ANDOL', 'Anticipo Comisiones Dolares', 'HABER', '1020106', '2010614', '1020106', '2010615', ['COM']),

  // ── Haberes en Moneda Local (ML) ──
  c(1000, 'SALARIO', 'Salario base Gs', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN', 'FIN', 'AGU']),
  c(1010, 'SALARIO', 'Salario primera quincena', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1015, 'SALARIO', 'Salario segunda quincena', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1214, 'VARIABLE', 'Variable.-', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1217, 'Viati', 'Viatico.-', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1202, 'VARYREF', 'Refrigerios y Viaticos', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(1206, 'REFRIGERIO', 'Refrigerio ll', 'HABER', '4010111', '2010614', '4010111', '2010615', ['MEN']),
  c(1216, 'REFRI', 'Refrigerio.-', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(2000, 'H50', 'Hs. extras al 50 %', 'HABER', '4020105', '2010614', '4020105', '2010615', ['MEN', 'COM']),
  c(2010, 'H100', 'Hs. extras al 100 %', 'HABER', '4020105', '2010614', '4020105', '2010615', ['MEN', 'COM']),
  c(2015, 'H130', 'Hs. extras al 130 %', 'HABER', '4020105', '2010614', '4020105', '2010615', ['MEN', 'COM']),
  c(2016, 'SALNOC', 'Salario Nocturno', 'HABER', '4020102', '2010614', '4020102', '2010615', ['MEN']),
  c(2200, 'FALLO_CAJ', 'Fallo de Caja', 'HABER', '4020106', '2010614', '4020106', '2010615', ['MEN', 'COM']),
  c(2500, 'COMISION', 'Comisiones Ventas', 'HABER', '4010111', '2010614', '4010111', '2010615', ['COM']),
  c(2503, 'VARICOMI', 'Variable Comisiones ll', 'HABER', '4010111', '2010614', '4010111', '2010615', ['COM']),
  c(3000, 'DSVAC_CAU', 'Vacaciones', 'HABER', '4020109', '2010614', '4020109', '2010615', ['MEN', 'FIN']),
  c(4000, 'IMPMANAGU', 'Aguinaldo', 'HABER', '4020104', '2010603', '4020104', '2010616', ['AGU', 'FIN']),
  c(5050, 'IMPPREAV', 'Preaviso', 'HABER', '4020120', '2010614', '4020120', '2010615', ['FIN']),
  c(5200, 'IMPINDEM', 'Indemnizacion por antiguedad', 'HABER', '4020124', '2010614', '4020124', '2010615', ['FIN']),

  // ── Retenciones y Descuentos en Dólares (ME) y Moneda Local (ML) ──
  c(1002, 'RIPS', 'IPS Mensual Dolares', 'RETENCION', '2010614', '4020114', '2010615', '4020114', ['MEN']),
  c(1003, 'RIPS', 'IPS Comisiones Dolares', 'RETENCION', '2010614', '4020114', '2010615', '4020114', ['COM']),
  c(4003, 'EMB_CDOL', 'Embargo Judicial USD', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['MEN', 'COM']),
  c(4002, 'EMB_CDOL', 'Embargo Judicial Dolares Comision', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['COM']),
  c(4082, 'PRES_EMP_USD', 'Prestamo Empresa Dolares Salario', 'RETENCION', '2010614', '1020314', '2010615', '1020316', ['MEN']),
  c(4083, 'PRES_COMI_USD', 'Prestamo Empresa Dolares Comi', 'RETENCION', '2010614', '1020314', '2010615', '1020316', ['COM']),
  c(4077, 'ASISMED', 'Asistencia Medica Mensual Dolares', 'RETENCION', '2010614', '2010614', '2010615', '2010615', ['MEN']),
  c(9045, 'ANTICIPOVA', 'Anticipos Varios USD', 'RETENCION', '2010614', '2010614', '2010615', '2010615', ['MEN', 'COM']),

  // ── Retenciones en Moneda Local (ML) ──
  c(1000, 'RIPS', 'IPS Mensual Gs', 'RETENCION', '2010614', '4020114', '2010615', '4020114', ['MEN', 'COM', 'AGU']),
  c(4000, 'EMB_MES', 'Embargo Judicial Mensual Gs', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['MEN']),
  c(4004, 'EMB_COGS', 'Embargo Judicial Comision Gs', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['COM']),
  c(4070, 'DESC_ANT', 'Adelanto de Salario', 'RETENCION', '2010614', '1020315', '2010615', '1020317', ['MEN', 'COM']),
  c(4080, 'PRES_EMP_GS', 'Prestamo Empresa GS', 'RETENCION', '2010614', '1020314', '2010615', '1020316', ['MEN']),
  c(4075, 'ASISMED', 'Asistencia Medica Mensual Gs', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['MEN']),
  c(4050, 'MER1', 'Compra mercs. Proveedor 1', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['MEN']),
  c(4055, 'MER2', 'Compra mercs. Proveedor 2', 'RETENCION', '2010614', '2010614', '2010615', '2010614', ['MEN']),

  // ── Salario Familiar y Contribuciones ──
  c(1000, 'BF_MAN', 'Bonificacion familiar', 'SALARIO_FAMILIAR', '4020122', '2010614', '4020122', '2010615', ['MEN']),
  c(1001, 'BF_MANCO', 'Bonificacion Familiar Comisiones Gs', 'SALARIO_FAMILIAR', '4020122', '2010614', '4020122', '2010615', ['COM']),
  c(1000, 'CIPS', 'Contribución - IPS', 'CONTRIBUCION', '4020114', '2010601', '4020114', '2010601', ['MEN', 'COM', 'AGU']),
  c(1003, 'CIPS', 'Contribución-IPS Mensual USD', 'CONTRIBUCION', '4020114', '2010601', '4020114', '2010601', ['MEN', 'COM', 'AGU']),
  c(1160, 'IMPMANAGU', 'Previsión de Aguinaldo', 'CONTRIBUCION', '4020104', '2010603', '4020104', '2010616', ['AGU']),
  c(1161, 'IMPMANAGU', 'Previsión de Aguinaldo USD', 'CONTRIBUCION', '4020104', '2010603', '4020104', '2010616', ['AGU']),
];

export function getVariablesByLiquidacion(tipo: TipoLiquidacionImpacto): VariableDefinibleNomina[] {
  return Object.values(DICCIONARIO_VARIABLES_DEFINIBLES).filter((item) =>
    item.liquidacionesImpactadas.includes(tipo),
  );
}

export function getVariablesByMoneda(moneda: 'PYG' | 'USD'): VariableDefinibleNomina[] {
  return Object.values(DICCIONARIO_VARIABLES_DEFINIBLES).filter(
    (item) => item.moneda === moneda || item.moneda === 'AMBAS',
  );
}

export function findVariableByCodigo(codigo: string): VariableDefinibleNomina | undefined {
  if (!codigo) return undefined;
  const clean = codigo.trim().replace(/^\[|\]$/g, '');
  return DICCIONARIO_VARIABLES_DEFINIBLES[clean];
}

export function findConceptoByNumero(numero: number): ConceptoNominaOficial | undefined {
  return CATALOGO_CONCEPTOS_OFICIALES.find((c) => c.numero === numero);
}

export function findConceptoByVariable(codigoVariable: string): ConceptoNominaOficial | undefined {
  if (!codigoVariable) return undefined;
  const clean = codigoVariable.trim().replace(/^\[|\]$/g, '');
  return CATALOGO_CONCEPTOS_OFICIALES.find((c) => c.codigoVariable === clean);
}

export function validateCatalog(): { totalVariables: number; totalConceptos: number; valido: boolean } {
  const vars = Object.keys(DICCIONARIO_VARIABLES_DEFINIBLES);
  const conceptos = CATALOGO_CONCEPTOS_OFICIALES;
  return {
    totalVariables: vars.length,
    totalConceptos: conceptos.length,
    valido: vars.length >= 100 && conceptos.length > 0,
  };
}
