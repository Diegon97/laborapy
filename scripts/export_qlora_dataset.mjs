#!/usr/bin/env node
/**
 * EXPORTADOR DE DATASET CANÓNICO PARA FINE-TUNING QLORA / LORA — LABORAPY
 * Convierte y unifica los datasets de oro al formato estándar ChatML / OpenAI Messages JSONL
 * y formato Alpaca JSON, listos para Unsloth, HuggingFace TRL, Axolotl o Llama-Factory.
 * Versión: PY-QLORA-EXPORT-2026.09.16
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function loadSystemPrompt() {
  const tsPath = path.join(PROJECT_ROOT, 'src', 'modules', 'assistant', 'tobiSystemPrompt.ts');
  const content = fs.readFileSync(tsPath, 'utf8');
  const match = content.match(/export const TOBI_SYSTEM_PROMPT:\s*string\s*=\s*\[([\s\S]*?)\]\.join/);
  if (match) {
    try {
      const lines = eval(`[${match[1]}]`);
      return lines.join('\n\n');
    } catch {}
  }
  return 'Sos Tobi, el Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy en Paraguay.';
}

const TOBI_SYSTEM_PROMPT = loadSystemPrompt();

const GOLD_FINAL_FILE = path.join(PROJECT_ROOT, 'datasets', 'tobi_gold_dataset_final.jsonl');
const REGEN_FILE = path.join(PROJECT_ROOT, 'datasets', 'tobi_battery_v2_regen.json');
const CANDIDATES_FILE = path.join(PROJECT_ROOT, 'datasets', 'tobi_battery_v3_candidates.json');

const OUT_MESSAGES_JSONL = path.join(PROJECT_ROOT, 'datasets', 'tobi_qlora_messages.jsonl');
const OUT_ALPACA_JSON = path.join(PROJECT_ROOT, 'datasets', 'tobi_qlora_alpaca.json');
const OUT_SUMMARY_MD = path.join(PROJECT_ROOT, 'datasets', 'tobi_qlora_dataset_summary.md');

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const items = [];
  for (const line of lines) {
    try {
      items.push(JSON.parse(line));
    } catch {}
  }
  return items;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.cases || [];
  } catch {
    return [];
  }
}

function main() {
  console.log('================================================================');
  console.log('📦 EXPORTADOR DE DATASET PARA FINE-TUNING QLORA / LORA (TOBI)');
  console.log('================================================================\n');

  const goldItems = readJsonl(GOLD_FINAL_FILE);
  console.log(`🔹 Dataset de Oro Final: ${goldItems.length} casos`);

  const regenItems = readJson(REGEN_FILE);
  console.log(`🔹 Casos Regenerados (v2): ${regenItems.length} casos`);

  const candidateItems = readJson(CANDIDATES_FILE);
  console.log(`🔹 Candidatos Aceptados (v3): ${candidateItems.length} casos`);

  // Unificación y deduplicación por prompt/ID
  const datasetEntries = [];
  const seenPrompts = new Set();

  // 1. Agregar los casos de oro (máxima prioridad)
  for (const item of goldItems) {
    if (item.prompt && item.response) {
      const promptClean = item.prompt.trim().toLowerCase();
      if (!seenPrompts.has(promptClean)) {
        seenPrompts.add(promptClean);
        datasetEntries.push({
          id: item.id || `gold_${datasetEntries.length + 1}`,
          category: item.category || 'General',
          title: item.title || 'Consulta Laboral',
          prompt: item.prompt.trim(),
          response: item.response.trim(),
          source: 'gold_final',
        });
      }
    }
  }

  // 2. Agregar casos regenerados que tengan prompt y response o explicación
  for (const item of regenItems) {
    if (item.prompt && (item.response || item.expectedResponse || item.solution)) {
      const resp = item.response || item.expectedResponse || item.solution;
      const promptClean = item.prompt.trim().toLowerCase();
      if (!seenPrompts.has(promptClean)) {
        seenPrompts.add(promptClean);
        datasetEntries.push({
          id: item.id || `regen_${datasetEntries.length + 1}`,
          category: item.category || 'Regenerado',
          title: item.title || 'Caso Normativo',
          prompt: item.prompt.trim(),
          response: resp.trim(),
          source: 'battery_v2_regen',
        });
      }
    }
  }

  console.log(`\n📊 Total de pares instructivos consolidados: ${datasetEntries.length}`);

  // Generar Formato ChatML / OpenAI Messages JSONL
  const chatmlLines = datasetEntries.map((entry) => {
    return JSON.stringify({
      id: entry.id,
      category: entry.category,
      messages: [
        { role: 'system', content: TOBI_SYSTEM_PROMPT },
        { role: 'user', content: entry.prompt },
        { role: 'assistant', content: entry.response },
      ],
    });
  });

  fs.writeFileSync(OUT_MESSAGES_JSONL, chatmlLines.join('\n') + '\n', 'utf8');
  console.log(`✅ Archivo ChatML JSONL exportado: ${OUT_MESSAGES_JSONL}`);

  // Generar Formato Alpaca JSON
  const alpacaList = datasetEntries.map((entry) => ({
    instruction: entry.prompt,
    input: '',
    output: entry.response,
    system: TOBI_SYSTEM_PROMPT,
  }));

  fs.writeFileSync(OUT_ALPACA_JSON, JSON.stringify(alpacaList, null, 2), 'utf8');
  console.log(`✅ Archivo Alpaca JSON exportado: ${OUT_ALPACA_JSON}`);

  // Generar Summary Markdown
  const summaryMd = `# DATASET DE ENTRENAMIENTO QLORA / LORA — TOBI RRHH
Fecha de exportación: ${new Date().toISOString()}
Total de pares canónicos: ${datasetEntries.length}

## Formatos Disponibles:
1. **ChatML / OpenAI Messages JSONL**: \`datasets/tobi_qlora_messages.jsonl\` (ideal para Unsloth, HuggingFace SFTTrainer, TRL).
2. **Alpaca Instruction JSON**: \`datasets/tobi_qlora_alpaca.json\` (ideal para LLaMA-Factory, Axolotl, FastChat).

## Estructura por Categorías:
${Object.entries(
  datasetEntries.reduce((acc, cur) => {
    acc[cur.category] = (acc[cur.category] || 0) + 1;
    return acc;
  }, {})
)
  .map(([cat, count]) => `- **${cat}**: ${count} ejemplos`)
  .join('\n')}

## Parámetros Sugeridos para Fine-Tuning QLoRA:
- **Base Model**: \`Qwen/Qwen2.5-7B-Instruct\` o \`meta-llama/Llama-3.1-8B-Instruct\`
- **LoRA Rank (r)**: 16 o 32
- **LoRA Alpha**: 32 o 64
- **Target Modules**: \`q_proj\`, \`k_proj\`, \`v_proj\`, \`o_proj\`, \`gate_proj\`, \`up_proj\`, \`down_proj\`
- **Quantization**: 4-bit (bitsandbytes NF4)
- **Learning Rate**: 2e-4
- **Epochs**: 3 a 5
- **Optimizer**: AdamW 8-bit / paged_adamw_8bit
`;

  fs.writeFileSync(OUT_SUMMARY_MD, summaryMd, 'utf8');
  console.log(`📝 Resumen Markdown generado: ${OUT_SUMMARY_MD}`);
  console.log('\n🚀 Dataset 100% listo para fine-tuning QLoRA/LoRA.');
}

main();
