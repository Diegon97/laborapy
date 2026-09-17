/**
 * EJECUTOR DEL SPIKE DE EVALUACIÓN TYPESAFE EN TOBI
 * Corre casos emblemáticos de derecho laboral paraguayo y mide latencia y precisión.
 */

import {
  routeTobiIntent,
  classifyEgresoMotivo,
  evalPrimaciaRealidad,
  auditNotaDespido,
  scoreLeadComercial,
  verifyGuardrailLegal,
} from './tobiSystemOne.mjs';

async function main() {
  console.log('🚀 INICIANDO SPIKE DE EVALUACIÓN TYPESAFE SYSTEM ONE EN TOBI...');
  const t0 = Date.now();

  try {
    // Caso 1: Despido verbal
    console.log('\n--- CASO 1: Despido Verbal y Liquidación ---');
    const caso1 = 'Hola, ayer mi jefe me dijo que ya no me vaya a trabajar porque bajaron las ventas. Tengo 4 años de antigüedad y cobro 3.800.000 Gs. mensual.';
    const resIntencion = await routeTobiIntent(caso1);
    console.log('Intención:', JSON.stringify(resIntencion.answers, null, 2));

    const resMotivo = await classifyEgresoMotivo(caso1);
    console.log('Motivo Egreso:', JSON.stringify(resMotivo.answers, null, 2));

    // Caso 2: Facturación encubierta (Art. 19)
    console.log('\n--- CASO 2: Primacía de la Realidad (Art. 19 C.T.) ---');
    const caso2 = 'Entré hace 2 años a una empresa de logística. Me hacen emitir factura IVA cada mes por 4.500.000 Gs., pero tengo que marcar tarjeta de 8 a 17 hs todos los días, uso la PC de la oficina y si llego tarde me descuentan. No me pagan IPS.';
    const resArt19 = await evalPrimaciaRealidad(caso2);
    console.log('Evaluación Art. 19:', JSON.stringify(resArt19.answers, null, 2));

    // Caso 3: Nota de despido genérica (Art. 81)
    console.log('\n--- CASO 3: Auditoría de Nota de Despido (Art. 81 C.T.) ---');
    const caso3 = 'Por medio de la presente le notificamos su despido justificado por motivos de reorganización interna y falta de compromiso general con la visión de la empresa.';
    const resNota = await auditNotaDespido(caso3);
    console.log('Auditoría Nota:', JSON.stringify(resNota.answers, null, 2));

    // Caso 4: Lead B2B de alto valor
    console.log('\n--- CASO 4: Calificación de Lead B2B ---');
    const caso4 = 'Buenas tardes, somos una distribuidora con 45 empleados en Luque. Necesitamos tercerizar las planillas anuales del MTESS (REOP) y revisar las liquidaciones de aguinaldos e IPS.';
    const resLead = await scoreLeadComercial(caso4);
    console.log('Scoring Lead:', JSON.stringify(resLead.answers, null, 2));

    // Caso 5: Guardrail Anti-Alucinación (Salario mínimo viejo)
    console.log('\n--- CASO 5: Guardrail Anti-Alucinación ---');
    const caso5 = 'El salario mínimo aplicable es Gs. 2.798.309 según la escala legal vigente.';
    const resGuardrail = await verifyGuardrailLegal(caso5);
    console.log('Guardrail Check:', JSON.stringify(resGuardrail.answers, null, 2));

    console.log(`\n✅ SPIKE EJECUTADO CON ÉXITO EN ${Date.now() - t0} ms.`);
  } catch (error) {
    console.error('❌ Error en ejecución del spike:', error);
  }
}

main();
