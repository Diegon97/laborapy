/**
 * DUAL BENCHMARK: TYPESAFE (JEV) VS CAPATAZ (GEMINI 3.8 ADAPTER)
 */

import { evaluateLaborCase } from './tobiSystemOneEngine.mjs';

async function runDual() {
  const caso = 'Llevo 11 años como jefe de compras en una distribuidora. Ayer me dieron una nota de despido por supuesta reestructuración. Cobro 8.500.000 Gs.';

  console.log('⚖️ EVALUANDO CON TYPESAFE NATIVO (JEV-LATEST)...');
  const t0 = Date.now();
  const resJev = await evaluateLaborCase(caso, 'typesafe');
  const tJev = Date.now() - t0;
  console.log(`⏱️ Jev completado en ${tJev} ms`);
  console.log('Respuestas Jev:\n', JSON.stringify(resJev.answers, null, 2));

  console.log('\n⚖️ EVALUANDO CON CAPATAZ ADAPTER (GEMINI 3.8 FLASH - COSTO $0)...');
  const t1 = Date.now();
  const resCapataz = await evaluateLaborCase(caso, 'capataz');
  const tCapataz = Date.now() - t1;
  console.log(`⏱️ Capataz Adapter completado en ${tCapataz} ms`);
  console.log('Respuestas Capataz Adapter:\n', JSON.stringify(resCapataz.answers, null, 2));
}

runDual();
