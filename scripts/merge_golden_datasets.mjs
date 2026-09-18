import fs from 'fs';
import path from 'path';

const CSJ_DATASET = path.join(process.cwd(), 'datasets', 'tobi_golden_csj.json');
const AUDIO_DATASET = path.join(process.cwd(), 'datasets', 'tobi_golden_audios.json');
const OUTPUT_JSONL = path.join(process.cwd(), 'datasets', 'tobi_gold_dataset_v3_combined.jsonl');

function loadDataset(filePath) {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    console.warn(`No se encontró el dataset: ${filePath}`);
    return [];
}

const csjData = loadDataset(CSJ_DATASET);
const audioData = loadDataset(AUDIO_DATASET);

// Juntar en un solo paquete/bolsa
const bolsaCombinada = [...csjData, ...audioData];

console.log(`\n============================================`);
console.log(`📦 PAQUETE FINAL COMBINADO`);
console.log(`============================================`);
console.log(`- CSJ Dictámenes: ${csjData.length} pares`);
console.log(`- Audios Laborales: ${audioData.length} pares`);
console.log(`- TOTAL BOLSA: ${bolsaCombinada.length} pares dorados`);

// Exportar a JSONL formato ChatML para QLoRA / Unsloth
const fd = fs.openSync(OUTPUT_JSONL, 'w');
for (const item of bolsaCombinada) {
    const chatML = {
        messages: [
            { role: "system", content: item.system },
            { role: "user", content: item.instruction },
            { role: "assistant", content: item.output }
        ]
    };
    fs.appendFileSync(fd, JSON.stringify(chatML) + '\n');
}
fs.closeSync(fd);

console.log(`\n✅ Dataset empaquetado en: ${OUTPUT_JSONL}`);
console.log(`(Formato ChatML listo para fine-tuning con LLaMA-Factory / Unsloth)`);
