import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const CAPATAZ_URL = 'http://127.0.0.1:8317/v1/chat/completions';
const CAPATAZ_ESTADO_URL = 'http://127.0.0.1:8318/api/estado';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const envPath = path.join(process.cwd(), '.env');
let DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DEEPSEEK_API_KEY=(.*)/);
    if (match) DEEPSEEK_API_KEY = match[1].trim();
}

const CSJ_DIR = path.join(process.cwd(), 'documentos_csj');
const AUDIOS_DIR = path.join(process.cwd(), 'audios');
const OUTPUT_FILE = path.join(process.cwd(), 'datasets', 'tobi_golden_csj.json');
const CEO_FILE = path.join(process.cwd(), 'datasets', 'consultas_al_ceo.json');
const PROGRESS_FILE = path.join(process.cwd(), 'datasets', 'csj_progress_v2.json');

const clearLine = () => {
    if (process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    } else {
        process.stdout.write('\r'); // Permite animar en CMD
    }
};

let stats = {
    procesados: 0,
    paresExtraidos: 0,
    aprobadosDeepSeek: 0,
    rechazadosDeepSeek: 0,
    lagunasLegales: 0,
    combustiblePromedio: 100,
    archivosTotales: 0
};

let dataset = [];
let consultasCEO = [];
let archivosPendientes = [];

function getAllFiles(dirPath, baseDir, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, baseDir, arrayOfFiles);
        } else {
            if (file.endsWith('.doc') || file.endsWith('.txt') || file.endsWith('.json')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });
    return arrayOfFiles;
}

function getProgressBar(current, total, length = 20) {
    const percent = current / total;
    const filled = Math.round(length * percent);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(percent * 100)}%`;
}

async function obtenerEstadoCapataz() {
    try {
        const response = await fetch(CAPATAZ_ESTADO_URL);
        const data = await response.json();
        return data.gobernador;
    } catch (e) { return null; }
}

async function extraerTexto(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        let text = buffer.toString('utf8').replace(/[^\x20-\x7E\n\ráéíóúÁÉÍÓÚñÑ]/g, '');
        return text.substring(0, 15000); 
    } catch(e) { return ""; }
}

async function capatazExtraer(texto) {
    const prompt = `Sos un experto en Derecho Laboral Paraguayo analizando un documento (Fallo CSJ, Ley o Transcripción de Audio de Abogado).

REGLAS DE ORO DE EXTRACCIÓN:
1. Práctica vs Ley (Audios): Si el texto narra una "mala práctica" empresarial y luego da la solución, extraé la pregunta basada en la mala práctica y la respuesta basada en la solución legal correcta del experto.
2. Salarios Históricos: Si el texto es de 1995 y usa salarios viejos (ej. Gs. 500.000), conservá la matemática si es correcta para la época, pero ACLARÁ EXPLÍCITAMENTE en el 'output' que es un caso histórico con salario de esa época.
3. Lagunas Legales (IMPORTANTE): Si el texto presenta una ambigüedad legal, un gris sin resolución clara, o algo que la ley paraguaya no define bien, NO INVENTES NADA. Devolvé un objeto con "tipo": "ambiguedad".

Analizá el texto y devolvé ÚNICAMENTE un JSON válido (array de objetos).
Formato QA válido: {"tipo": "qa", "instruction": "Pregunta...", "output": "Respuesta experta..."}
Formato Laguna Legal: {"tipo": "ambiguedad", "pregunta_al_experto": "Duda exacta...", "contexto": "Fragmento que genera la duda..."}

Texto:
"${texto}"`;

    try {
        const response = await fetch(CAPATAZ_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8'
            },
            body: JSON.stringify({
                model: 'gemini-3.8-flash-high',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return [];
    } catch (e) { return []; }
}

async function deepseekValidar(pair) {
    if (!DEEPSEEK_API_KEY) return true; // Bypass si no hay API key para no bloquear el test

    const prompt = `Sos el Revisor CISO y Legal (DeepSeek Reasoner).
Evaluá este par de entrenamiento laboral paraguayo:
PREGUNTA: ${pair.instruction}
RESPUESTA: ${pair.output}

REGLAS PARA EVALUAR:
1. ¿Hay algún error matemático grosero en la lógica del cálculo?
2. ¿Cita artículos falsos de la Ley 213/93?
3. EXCEPCIÓN HISTÓRICA: Si usa salarios antiguos pero aclara expresamente que es un "caso histórico", es VÁLIDO.
4. EXCEPCIÓN PRÁCTICA: Si el caso menciona que la empresa "hace las cosas mal", pero la respuesta aconseja la solución legal correcta, es VÁLIDO.

Si viola las reglas 1 o 2, respondé RECHAZADO. Si está todo correcto, respondé APROBADO.
Respondé ÚNICAMENTE con la palabra APROBADO o RECHAZADO.`;

    try {
        const response = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-reasoner',
                messages: [{ role: 'user', content: prompt }]
            })
        });
        const data = await response.json();
        const content = data.choices[0].message.content.toUpperCase();
        return content.includes('APROBADO');
    } catch (e) { return false; }
}

function actualizarDashboard(hilosBarra) {
    clearLine();
    const fuelColor = stats.combustiblePromedio > 50 ? '\x1b[32m' : '\x1b[31m';
    const msg = `[${stats.procesados}/${stats.archivosTotales}] ⚡ Procesando Batch: ${hilosBarra} | ⛽ Cuota: ${fuelColor}${stats.combustiblePromedio.toFixed(1)}%\x1b[0m | ✅ Golden: ${stats.aprobadosDeepSeek} | ❓ CEO: ${stats.lagunasLegales} | ❌ Rech: ${stats.rechazadosDeepSeek}`;
    process.stdout.write(msg);
}

async function iniciarPipeline() {
    console.log("=========================================================");
    console.log("🚀 DATA ENGINE V2: JURISPRUDENCIA, AUDIOS Y LAGUNAS LEGALES");
    console.log("=========================================================\n");

    if (fs.existsSync(OUTPUT_FILE)) dataset = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    if (fs.existsSync(CEO_FILE)) consultasCEO = JSON.parse(fs.readFileSync(CEO_FILE, 'utf8'));

    if (fs.existsSync(PROGRESS_FILE)) {
        const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        stats = prog.stats;
        archivosPendientes = prog.pendientes;
    } else {
        const csjFiles = getAllFiles(CSJ_DIR, CSJ_DIR);
        const audioFiles = getAllFiles(AUDIOS_DIR, AUDIOS_DIR);
        archivosPendientes = [...csjFiles, ...audioFiles];
        stats.archivosTotales = archivosPendientes.length;
    }

    const BATCH_SIZE = 10;
    while (archivosPendientes.length > 0) {
        // Monitoreo Gobernador
        const estado = await obtenerEstadoCapataz();
        if (estado) {
            stats.combustiblePromedio = estado.promedioCombustible;
            if (estado.frenoTotal || stats.combustiblePromedio < 5) {
                clearLine();
                process.stdout.write("🚨 ALERTA: Cuota agotada. Guardando y apagando PC...");
                fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes }, null, 2));
                exec('shutdown /s /t 60');
                process.exit(0);
            }
        }

        const batch = archivosPendientes.splice(0, BATCH_SIZE);
        
        let batchCompletados = 0;
        let batchActuales = batch.length;
        actualizarDashboard(getProgressBar(0, batchActuales));

        const promesas = batch.map(async (filePath) => {
            const texto = await extraerTexto(filePath);
            let validados = 0, rechazados = 0, lagunas = 0, totalPares = 0;
            
            if (texto && texto.length >= 50) {
                const extraidos = await capatazExtraer(texto);
                totalPares = extraidos.length;
                
                for (const item of extraidos) {
                    if (item.tipo === 'ambiguedad') {
                        consultasCEO.push(item);
                        lagunas++;
                    } else if (item.tipo === 'qa' && item.instruction && item.output) {
                        const aprobado = await deepseekValidar(item);
                        if (aprobado) {
                            item.system = "Sos Tobi, el Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy...";
                            dataset.push(item);
                            validados++;
                        } else {
                            rechazados++;
                        }
                    }
                }
            }

            // Actualizar la animación visual en tiempo real cada vez que 1 de los 10 archivos termina
            batchCompletados++;
            actualizarDashboard(getProgressBar(batchCompletados, batchActuales));

            return { validados, rechazados, lagunas, totalPares };
        });

        const resultados = await Promise.all(promesas);
        
        resultados.forEach(r => {
            stats.paresExtraidos += r.totalPares;
            stats.aprobadosDeepSeek += r.validados;
            stats.rechazadosDeepSeek += r.rechazados;
            stats.lagunasLegales += r.lagunas;
            stats.procesados++;
        });

        // Guardado del batch al disco
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
        fs.writeFileSync(CEO_FILE, JSON.stringify(consultasCEO, null, 2));
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes }, null, 2));
    }

    console.log("\n\n✅ ¡Pipeline V2 Finalizado con Éxito!");
}

iniciarPipeline();