/**
 * MOTOR HÍBRIDO SYSTEM ONE PARA TOBI / LABORAPY
 * Unifica TypeSafe Nativo (Jev) y System One Adapter (Capataz a $0).
 */

import { TypeSafeClient } from './typesafeNativeClient.mjs';
import { SystemOneAdapterClient } from './systemOneAdapter.mjs';
import { choice, score, noul } from './systemOneCore.mjs';

export function getSystemOneClient(provider = 'typesafe') {
  if (provider === 'capataz') {
    return new SystemOneAdapterClient({
      baseUrl: 'http://127.0.0.1:8317/v1/chat/completions',
      model: 'gemini-3.8-flash-high',
      providerName: 'capataz',
    });
  }

  return new TypeSafeClient({
    apiKey: process.env.TYPESAFE_API_KEY,
    model: 'jev-latest',
  });
}

/**
 * Evaluador de caso integral para Tobi
 */
export async function evaluateLaborCase(textoUsuario, provider = 'typesafe') {
  const client = getSystemOneClient(provider);

  const questions = {
    intencion: choice('¿Cuál es la intención primaria del usuario?', {
      calcular_liquidacion: 'Calcular indemnización o liquidación por despido/renuncia',
      auditoria_documento: 'Revisar nota de despido, finiquito, suspensión o contrato',
      consulta_derechos: 'Consultar sobre vacaciones, permisos, IPS o feriados',
      fraude_facturacion: 'Evaluar relación de dependencia encubierta por factura',
      fuera_de_dominio: 'Petición ajena a temas laborales o de RRHH'
    }),
    motivo_desvinculacion: choice('¿Qué motivo legal de desvinculación se configura según el Código del Trabajo?', {
      despido_injustificado: 'Despido sin causa o por reestructuración (Art. 84 C.T.)',
      despido_justificado: 'Despido por falta grave comprobada (Art. 81 C.T.)',
      renuncia_voluntaria: 'Renuncia decidida libremente por el empleado',
      retiro_justificado: 'Retiro por falta de pago o injurias del empleador (Art. 85 C.T.)',
      estabilidad_10_anos: 'Despido ilegal de empleado con más de 10 años (Art. 94 C.T.)',
      no_aplica: 'No hay desvinculación o es consulta general'
    }),
    riesgo_fraude_art19: score('Nivel de contingencia por facturación con relación de dependencia encubierta:', [
      'Nivel 1: Autónomo legítimo',
      'Nivel 2: Coordinación técnica sin subordinación',
      'Nivel 3: Indicios moderados de laboralidad',
      'Nivel 4: Fuerte subordinación y exclusividad',
      'Nivel 5: Dependencia laboral flagrante'
    ]),
    es_urgente_prescripcion: noul('¿El caso está cerca de prescribir (plazo fatal de 60 días corridos del Art. 399 C.T.)?'),
    calificacion_lead_b2b: noul('¿La consulta proviene de una empresa o empleador con potencial de contratar servicios de nóminas/RRHH?')
  };

  return await client.systemOne({ state: textoUsuario, questions });
}
