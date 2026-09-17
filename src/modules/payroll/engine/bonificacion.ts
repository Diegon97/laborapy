/**
 * BONIFICACIÓN FAMILIAR (ASIGNACIÓN FAMILIAR) — Arts. 261 al 271, Ley N.º 213/93
 * Motor Liquidación PY · Versión PY-LIQ-2026.09.05
 *
 * Art. 261: 5% del salario mínimo legal mensual por cada hijo menor de 18 años
 *           (o discapacitado sin límite de edad) que dependa económicamente.
 * Art. 262: Hijos que dependan económicamente, menores de 18 años y radicados en el país.
 * Art. 263: Límite de salario: El trabajador tiene derecho siempre que su salario
 *           NO EXCEDA de dos (2) salarios mínimos legales (Gs. 6.088.000).
 * Art. 268: La asignación familiar NO forma parte del salario para aguinaldo ni para
 *           aportes de IPS. Es inembargable.
 */

import type { Concepto, Alerta, LiquidacionInput } from '../types';
import {
  SALARIO_MINIMO_MENSUAL_2026,
  ASIGNACION_FAMILIAR_PORCENTAJE,
  ASIGNACION_FAMILIAR_LIMITE_SALARIO,
} from '../constants';

export interface BonificacionFamiliarResult {
  concepto?: Concepto;
  alertas: Alerta[];
  montoTotal: number;
  correspondePorTope: boolean;
}

export function calcularBonificacionFamiliar(
  input: LiquidacionInput,
  _diaEgreso: number = 30,
): BonificacionFamiliarResult {
  const alertas: Alerta[] = [];
  const hijosMenores = input.hijosMenoresACargo ?? 0;
  const hijosDiscapacidad = input.hijosDiscapacidad ?? 0;
  const totalHijos = hijosMenores + hijosDiscapacidad;
  const pendientes = input.bonificacionFamiliarPendiente ?? 0;

  // Si no tiene hijos declarados y no hay pendientes, no hay bonificación
  if (totalHijos <= 0 && pendientes <= 0) {
    return { alertas, montoTotal: 0, correspondePorTope: false };
  }

  // Verificación del Tope Legal: máximo 2 Salarios Mínimos Legales (Art. 263 C.T.)
  const salarioBase = input.salarioMensual;
  const superaTope = salarioBase > ASIGNACION_FAMILIAR_LIMITE_SALARIO;

  if (superaTope) {
    return { alertas: [], montoTotal: 0, correspondePorTope: false, concepto: undefined };
  }

  // Regla especial de Progenitores en la misma empresa (Art. 265 C.T.):
  // Si ambos trabajan en la empresa, la bonificación se paga a la madre.
  if (input.parejaTrabajaEnMismaEmpresa) {
    // Si el colaborador actual es el padre y la madre trabaja en la empresa
    if (input.esMadreTitular === false) {
      alertas.push({
        id: 'A11_BONIFICACION_MADRE_EXCLUSIVA',
        tipo: 'info',
        mensaje:
          'Titularidad Materna Exclusiva (Art. 265 C.T.): Al prestar servicios ambos progenitores para el mismo empleador, ' +
          'la Bonificación Familiar corresponde legalmente y de forma exclusiva a la madre. El padre no percibe este concepto.',
        accion: 'informar',
      });
      return { alertas, montoTotal: 0, correspondePorTope: false };
    }

    // Si la madre supera los 2 salarios mínimos (ej. vendedora con comisiones o cargo jerárquico),
    // la madre no cobra y NO se traslada el cobro al padre.
    if (input.salarioMadreMismaEmpresa && input.salarioMadreMismaEmpresa > ASIGNACION_FAMILIAR_LIMITE_SALARIO) {
      alertas.push({
        id: 'A11_BONIFICACION_MADRE_SUPERATOPE_NO_TRASLADA',
        tipo: 'info',
        mensaje:
          'Arts. 263 y 265 C.T.: La madre excede el límite legal de dos (2) salarios mínimos vigentes y pierde el derecho ' +
          'a percibir la Bonificación Familiar. Por ley laboral paraguaya, este derecho no se transfiere ni traslada al padre.',
        accion: 'informar',
      });
      return { alertas, montoTotal: 0, correspondePorTope: false };
    }
  }

  // Corresponde bonificación familiar:
  // 5% del salario mínimo legal mensual por cada hijo menor de 18 años o con discapacidad vitalicia
  const montoHijoMes = Math.round(SALARIO_MINIMO_MENSUAL_2026 * ASIGNACION_FAMILIAR_PORCENTAJE); // Gs. 152.200
  const montoHijosMesCompleto = montoHijoMes * totalHijos;

  // Conforme al Art. 269 del Código del Trabajo (Ley N.º 213/93):
  // "Se abonará la asignación familiar simultáneamente con el salario y en forma íntegra."
  // No se fracciona ni prorratea por días: se liquida el mes completo íntegro.
  const montoTotal = montoHijosMesCompleto + pendientes;

  const formulaPartes: string[] = [];
  if (totalHijos > 0) {
    const detalleHijosTexto = hijosDiscapacidad > 0
      ? `${hijosMenores} menor(es) + ${hijosDiscapacidad} con discapacidad (vitalicio)`
      : `${totalHijos} hijo(s)`;

    formulaPartes.push(
      `${detalleHijosTexto} × Gs. ${montoHijoMes.toLocaleString('es-PY')} (5% SML mensual íntegro Art. 269 C.T.) = Gs. ${montoHijosMesCompleto.toLocaleString('es-PY')}`,
    );
  }
  if (pendientes > 0) {
    formulaPartes.push(`Períodos anteriores adeudados: Gs. ${pendientes.toLocaleString('es-PY')}`);
  }

  const nombreConcepto = hijosDiscapacidad > 0
    ? `Bonificación Familiar (Art. 261 C.T. · ${totalHijos} hijo${totalHijos > 1 ? 's' : ''}, incl. ${hijosDiscapacidad} con discapacidad vitalicia)`
    : `Bonificación Familiar (Art. 261 C.T. · ${totalHijos} hijo${totalHijos > 1 ? 's' : ''})`;

  const concepto: Concepto = {
    id: 'bonificacion_familiar',
    nombre: nombreConcepto,
    monto: montoTotal,
    dias: undefined,
    base: montoHijoMes,
    formula: formulaPartes.join(' + '),
    fuenteLegal: 'Arts. 261, 262, 263, 268 y 269, Ley N.º 213/93 (5% SML mensual íntegro por hijo, inembargable y exento de IPS)',
    esDescuento: false,
    exentoIPS: true,
  };

  alertas.push({
    id: 'A12_BONIFICACION_OTORGADA',
    tipo: 'info',
    mensaje:
      `Bonificación Familiar Liquidada: Conforme al Art. 261 de la Ley 213/93, corresponde el 5% del salario mínimo legal ` +
      `(Gs. ${montoHijoMes.toLocaleString('es-PY')}/mes) por cada uno de los ${totalHijos} hijo(s) acreditado(s), por no superar los 2 salarios mínimos.` +
      (hijosDiscapacidad > 0 ? ` Incluye ${hijosDiscapacidad} hijo(s) con discapacidad certificada (cobro vitalicio de por vida conforme al Art. 261).` : '') +
      ' Es inembargable y exento de aporte jubilatorio a IPS (Art. 268 C.T.).',
    accion: 'informar',
  });

  return {
    concepto,
    alertas,
    montoTotal,
    correspondePorTope: true,
  };
}
