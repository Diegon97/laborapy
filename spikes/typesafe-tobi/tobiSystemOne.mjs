/**
 * PRIMITIVAS SYSTEM ONE PARA TOBI / LABORAPY (PARAGUAY)
 * Implementación modular para el spike en entorno aislado.
 */

import { askTypeSafe } from './typesafeClient.mjs';

/**
 * 1. ENRUTAMIENTO DE INTENCIÓN DE USUARIO
 */
export async function routeTobiIntent(userMessage) {
  const questions = {
    intencion: {
      type: 'choice',
      instructions: '¿Cuál es la intención principal del usuario al comunicarse con LaboraPy?',
      criteria: {
        calcular_liquidacion: 'Desea calcular liquidación por despido, renuncia o retiro',
        generar_documento: 'Solicita redactar o emitir una amonestación, suspensión, traslado o carta',
        consulta_general: 'Pregunta sobre leyes, derechos, vacaciones, permisos, IPS o feriados',
        auditoria_caso: 'Pide revisar una nota de despido recibida, recibo salarial o contrato',
        fuera_de_dominio: 'Petición ajena a temas laborales, RRHH, contables o spam'
      }
    },
    tiene_datos_minimos_calculo: {
      type: 'noul',
      instructions: '¿El mensaje ya contiene al menos dos datos clave para cálculo (como salario, fechas o motivo explícito)?'
    }
  };

  return await askTypeSafe({ state: userMessage, questions });
}

/**
 * 2. CLASIFICACIÓN DEL MOTIVO DE EGRESO SEGÚN CÓDIGO LABORAL (LEY 213/93)
 */
export async function classifyEgresoMotivo(relatoUsuario) {
  const questions = {
    motivo: {
      type: 'choice',
      instructions: '¿Cuál es el motivo de desvinculación laboral que mejor describe la situación?',
      criteria: {
        despido_sin_causa: 'Despido injustificado, verbal, por reestructuración o sin causa probada (Art. 84 C.T.)',
        despido_con_causa: 'Despido justificado por falta grave comprobada del trabajador (Art. 81 C.T.)',
        renuncia: 'Renuncia voluntaria del trabajador por propia decisión',
        retiro_justificado: 'El trabajador se retira por falta de pago de salarios o culpa del empleador (Art. 85 C.T.)',
        abandono: 'El trabajador dejó de asistir injustificadamente a su puesto de trabajo',
        mutuo_acuerdo: 'Acuerdo voluntario firmado entre ambas partes para finalizar el vínculo',
        periodo_prueba: 'Desvinculación durante el periodo de prueba inicial (Art. 58 C.T.)',
        jubilacion: 'Cese por acogimiento a los beneficios de la jubilación de IPS',
        contrato_plazo_fijo: 'Vencimiento del plazo o término estipulado en contrato determinado'
      }
    },
    hubo_preaviso: {
      type: 'noul',
      instructions: '¿Se otorgó o cumplió efectivamente el periodo de preaviso de despido o renuncia?'
    }
  };

  return await askTypeSafe({ state: relatoUsuario, questions });
}

/**
 * 3. TEST DE PRIMACÍA DE LA REALIDAD Y FRAUDE LABORAL (ART. 19 CÓDIGO DEL TRABAJO)
 * Diagnostica si un facturante es en realidad un dependiente encubierto.
 */
export async function evalPrimaciaRealidad(situacionLaboral) {
  const questions = {
    subordinacion_juridica: {
      type: 'noul',
      instructions: '¿El trabajador recibe órdenes directas, supervisiones, directivas o sanciones disciplinarias?'
    },
    cumplimiento_horario: {
      type: 'noul',
      instructions: '¿El trabajador debe cumplir un horario fijo de entrada y salida o marcar asistencia?'
    },
    exclusividad_economica: {
      type: 'noul',
      instructions: '¿El trabajador presta servicios casi con exclusividad para esta sola empresa contratante?'
    },
    herramientas_empresa: {
      type: 'noul',
      instructions: '¿La empresa suministra los equipos, software, vehículos o el espacio físico de trabajo?'
    },
    riesgo_fraude_art19: {
      type: 'score',
      instructions: '¿Cuál es el nivel de contingencia de fraude laboral y relación de dependencia según Art. 19 C.T.?',
      criteria: [
        'Nivel 1: Auténtico prestador de servicios independiente sin subordinación',
        'Nivel 2: Prestador mixto con ciertas pautas de coordinación pero autonomía',
        'Nivel 3: Indicios moderados de laboralidad; relación dudosa',
        'Nivel 4: Fuertes elementos de subordinación; alta probabilidad de dependencia encubierta',
        'Nivel 5: Relación de dependencia flagrante y evidente; fraude laboral ante IPS y MTESS'
      ]
    }
  };

  return await askTypeSafe({ state: situacionLaboral, questions });
}

/**
 * 4. AUDITORÍA DE NOTA DE DESPIDO Y CAUSAL TAXATIVA (ART. 81 CÓDIGO DEL TRABAJO)
 */
export async function auditNotaDespido(textoNota) {
  const questions = {
    causal_art81: {
      type: 'choice',
      instructions: '¿Qué causal taxativa del Art. 81 del Código del Trabajo se alega o configura?',
      criteria: {
        falta_disciplina: 'Desobediencia grave a órdenes o indisciplina laboral reiterada',
        inasistencias_injustificadas: 'Inasistencias injustificadas durante tres días consecutivos o cuatro en el mes',
        embriaguez_o_drogas: 'Presentarse en estado de embriaguez o bajo influencia de estupefacientes',
        dano_material: 'Daño material intencional o por negligencia grave a maquinarias o bienes',
        injurias_o_violencia: 'Injurias, agresiones físicas o malos tratos a jefes o compañeros',
        revelacion_secretos: 'Revelación de secretos industriales, comerciales o de fabricación',
        causal_generica_o_invalida: 'La causal es genérica, vaga, no comprobada o no figura en el Art. 81'
      }
    },
    cumple_principio_inmediatez: {
      type: 'noul',
      instructions: '¿La sanción de despido se aplicó inmediatamente tras conocer la falta, sin perdón tácito?'
    }
  };

  return await askTypeSafe({ state: textoNota, questions });
}

/**
 * 5. SCORING DE LEADS COMERCIALES Y ENRUTAMIENTO WHATSAPP
 */
export async function scoreLeadComercial(datosConsulta) {
  const questions = {
    nivel_lead: {
      type: 'score',
      instructions: '¿Cuál es el valor comercial potencial del lead para los servicios profesionales de LaboraPy?',
      criteria: [
        'Nivel 1: Curioso, estudiante, consulta informativa sin potencial de contratación',
        'Nivel 2: Trabajador particular con consulta simple de cálculo o trámite menor',
        'Nivel 3: Trabajador con caso litigioso o indemnización relevante (> Gs. 15.000.000)',
        'Nivel 4: Caso especial de alto valor (estabilidad de 10 años, fuero maternal, demanda CSJ)',
        'Nivel 5: Empresa o empleador que busca asesoría continua, nóminas IPS o planillas MTESS'
      ]
    },
    canal_sugerido: {
      type: 'choice',
      instructions: '¿Qué canal o mensaje de atención es el más apropiado para convertir este caso?',
      criteria: {
        chat_automatico: 'Atención 100% dentro de la plataforma sin derivación humana',
        whatsapp_b2c: 'Derivación a WhatsApp de Diego Núñez para revisión de liquidación particular',
        whatsapp_b2b: 'Derivación ejecutiva para propuesta corporativa B2B (REOP / MTESS / Contabilidad)',
        whatsapp_urgente: 'Derivación prioritaria por plazo fatal de prescripción (60 días) o fuero especial'
      }
    }
  };

  return await askTypeSafe({ state: datosConsulta, questions });
}

/**
 * 6. VERIFICADOR DE GUARDRAIL LEGAL Y WHITELIST NORMATIVA
 */
export async function verifyGuardrailLegal(textoRespuesta) {
  const questions = {
    menciona_salario_viejo: {
      type: 'noul',
      instructions: '¿El texto menciona o utiliza el salario mínimo viejo y vencido de 2.798.309 Gs. en vez del vigente de 3.044.000 Gs.?'
    },
    inventa_abogados_externos: {
      type: 'noul',
      instructions: '¿El texto recomienda o cita abogados o estudios jurídicos particulares ajenos a LaboraPy?'
    },
    cita_ley_inexistente: {
      type: 'noul',
      instructions: '¿El texto cita leyes falsas o inventadas como Ley 527/96 de teletrabajo o supuesta ley de acoso 5272?'
    }
  };

  return await askTypeSafe({ state: textoRespuesta, questions });
}
