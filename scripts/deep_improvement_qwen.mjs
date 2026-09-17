#!/usr/bin/env node
/**
 * ============================================================================
 * TOBI — MEJORA PROFUNDA NOCTURNA (FASE 2) · ENTRYPOINT QWEN 2.5
 * ============================================================================
 * Orquesta la Fase 2 del entrenamiento nocturno de Tobi: estudio, re-test y
 * auditoría iterativa sobre el motor `deep_improvement_engine.mjs`.
 *
 * Uso:   node scripts/deep_improvement_qwen.mjs [--no-wait] [--deadline-iso=ISO] [--smoke]
 *                                            [--provider=ollama|groq] [--model=ID]
 * Requisitos: Ollama local en http://localhost:11434 con `qwen2.5:7b` descargado.
 *             Para --provider=groq: claves GROQ_API_KEY[_1..4] en .env/.env.local y
 *             lanzar con `node --env-file=.env --env-file=.env.local ...`.
 * ============================================================================
 */

import { run, runSmoke, requestInterrupt, PATHS } from './lib/deep_improvement_engine.mjs';

// ---------------------------------------------------------------------------
// Parseo de argumentos CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { noWait: false, smoke: false, deadlineIso: null, provider: null, model: null };
  const args = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-wait') {
      opts.noWait = true;
    } else if (arg === '--smoke') {
      opts.smoke = true;
    } else if (arg.startsWith('--deadline-iso=')) {
      const value = arg.slice('--deadline-iso='.length).trim();
      opts.deadlineIso = value.length > 0 ? value : null;
    } else if (arg === '--deadline-iso') {
      const next = args[i + 1];
      if (typeof next === 'string' && !next.startsWith('--')) {
        opts.deadlineIso = next;
        i++;
      } else {
        console.warn('⚠️ --deadline-iso sin valor: se ignora el flag.');
      }
    } else if (arg.startsWith('--provider=')) {
      const value = arg.slice('--provider='.length).trim().toLowerCase();
      if (value === 'ollama' || value === 'groq') opts.provider = value;
      else console.warn(`⚠️ Provider inválido "${value}": se ignora el flag.`);
    } else if (arg === '--provider') {
      const next = args[i + 1];
      const value = typeof next === 'string' ? next.trim().toLowerCase() : '';
      if (value === 'ollama' || value === 'groq') {
        opts.provider = value;
        i++;
      } else {
        console.warn(`⚠️ Provider inválido "${typeof next === 'string' ? next : ''}": se ignora el flag.`);
      }
    } else if (arg.startsWith('--model=')) {
      const value = arg.slice('--model='.length).trim();
      if (value.length > 0) opts.model = value;
      else console.warn('⚠️ --model sin valor: se ignora el flag.');
    } else if (arg === '--model') {
      const next = args[i + 1];
      if (typeof next === 'string' && next.trim().length > 0 && !next.startsWith('--')) {
        opts.model = next.trim();
        i++;
      } else {
        console.warn('⚠️ --model sin valor: se ignora el flag.');
      }
    } else {
      console.warn(`⚠️ Flag desconocido ignorado: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Interrupción cooperativa (no cortar el proceso: delegar en el motor)
// ---------------------------------------------------------------------------
let sigintCount = 0;
process.on('SIGINT', () => {
  sigintCount += 1;
  if (sigintCount >= 2) {
    console.log('⏹️ Segundo SIGINT: salida forzada inmediata.');
    process.exit(130);
  }
  console.log('⏹️ Interrupción recibida. Solicitando cierre ordenado del motor...');
  requestInterrupt();
});

// ---------------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------------
async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));

    console.log('================================================================');
    console.log('🌙 TOBI — MEJORA PROFUNDA NOCTURNA (FASE 2) · QWEN 2.5');
    console.log(`⚙️  Flags activos — no-wait: ${opts.noWait ? 'sí' : 'no'} | smoke: ${opts.smoke ? 'sí' : 'no'} | deadline: ${opts.deadlineIso ?? 'sin límite'} | provider: ${opts.provider ?? '(env)'} | modelo: ${opts.model ?? '(default)'}`);
    console.log('================================================================\n');

    if (opts.smoke) {
      if (opts.provider || opts.model) {
        console.warn('⚠️ --smoke ignora --provider/--model; usá TOBI_STUDY_PROVIDER/TOBI_STUDY_MODEL del entorno.');
      }
      const result = await runSmoke();
      console.log('🧪 Resultado del smoke test:');
      console.log(`   studyOk:      ${result.studyOk ? '✅' : '❌'}`);
      console.log(`   retestOk:     ${result.retestOk ? '✅' : '❌'}`);
      console.log(`   Evaluación:   ${result.evaluation?.total ?? 0}/100 (${result.evaluation?.passed ?? 0} aprobados)`);
      process.exit(result.ok ? 0 : 1);
    }

    const summary = await run({ noWait: opts.noWait, deadlineIso: opts.deadlineIso, provider: opts.provider, model: opts.model });

    console.log('\n================================================================');
    console.log('📊 RESUMEN FINAL — MEJORA PROFUNDA NOCTURNA');
    console.log(`Estado:        ${summary.status}`);
    console.log(`Procesados:    ${summary.processed}`);
    console.log(`Verificados:   ${summary.verified}`);
    console.log(`Sin verificar: ${summary.unverified}`);
    console.log(`Auditorías:    ${summary.audits}`);
    console.log('================================================================');
    for (const [name, route] of Object.entries(PATHS)) {
      console.log(`📄 ${name}: ${route}`);
    }

    process.exit(summary.status === 'interrupted' ? 130 : (summary.status === 'aborted' ? 2 : 0));
  } catch (err) {
    console.error('❌ Error no capturado en la mejora profunda nocturna:', err);
    process.exit(1);
  }
}

main();