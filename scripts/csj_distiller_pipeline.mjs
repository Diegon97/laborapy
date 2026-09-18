import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';

// Configuración de endpoints y llaves
const CAPATAZ_URL = 'http://127.0.0.1:8318/v1/chat/completions';
const CAPATAZ_ESTADO_URL = 'http://127.0.0.1:8318/api/estado';
// Usaremos la API oficial de DeepSeek (el usuario debe tener DEEPSEEK_API_KEY en .env)
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

// Cargar variables de entorno
const envPath = path.join(process.cwd(), '.env');
let DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DEEPSEEK_API_KEY=(.*)/);
    if (match) DEEPSEEK_API_KEY = match[1].trim();
}

const CSJ_DIR = path.join(process.cwd(), 'documentos_csj');
const OUTPUT_FILE = path.join(process.cwd(), 'datasets', 'tobi_golden_csj.json');
const PROGRESS_FILE = path.join(process.cwd(), 'datasets', 'csj_progress.json');

// --- UTILIDADES DE TERMINAL ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clearLine = () => {
    if (process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    } else {
        process.stdout.write('\n');
    }
};

// --- TELEMETRÍA Y ESTADO ---
let stats = {
    procesados: 0,
    paresExtraidos: 0,
    aprobadosDeepSeek: 0,
    rechazadosDeepSeek: 0,
    combustiblePromedio: 100,
    archivosTotales: 0
};

let dataset = [];
let archivosPendientes = [];

async function obtenerEstadoCapataz() {
    try {
        const response = await fetch(CAPATAZ_ESTADO_URL);
        const data = await response.json();
        return data.gobernador;
    } catch (e) {
        return null;
    }
}

async function extraerTextoDoc(filePath) {
    // Extractor simple de strings para binarios .doc antiguos
    // En producción podés instalar 'word-extractor'
    const buffer = fs.readFileSync(filePath);
    let text = buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, '');
    return text.substring(0, 15000); // Límite de texto para no saturar tokens
}

async function capatazExtraer(texto) {
    // Usa todas tus cuentas en round-robin a máxima capacidad
    const prompt = `Sos un experto en Derecho Laboral Paraguayo. Leé este fragmento de un fallo de la Corte Suprema de Justicia:
    
"${texto}"

Extraé 2 pares de Pregunta y Respuesta que capturen la enseñanza práctica laboral de este fallo.
REGLA DE ORO: Si el fallo menciona salarios antiguos, actualizá el ejemplo obligatoriamente al salario mínimo vigente de Gs. 3.044.000.

Devolvé ÚNICAMENTE un JSON válido con este formato:
[
  { "instruction": "Pregunta práctica...", "output": "Respuesta práctica aplicando la ley y la lección del fallo..." }
]`;

    try {
        const response = await fetch(CAPATAZ_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-3.8-flash-high', // Usa el worker más rápido y capaz
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2
            })
        });
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return [];
    } catch (e) {
        return [];
    }
}

async function deepseekValidar(pair) {
    if (!DEEPSEEK_API_KEY) return true; // Si no hay llave, asumimos bypass por ahora

    const prompt = `Sos el Revisor CISO y Legal (DeepSeek Reasoner).
    Evaluá este par de entrenamiento para un asistente laboral paraguayo:
    PREGUNTA: ${pair.instruction}
    RESPUESTA: ${pair.output}
    
    ¿Hay algún error matemático, cita falsa de artículos de la Ley 213/93, o usa un salario mínimo distinto a Gs. 3.044.000?
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
    } catch (e) {
        return false;
    }
}

function actualizarDashboard(archivoActual, accion) {
    clearLine();
    const fuelColor = stats.combustiblePromedio > 50 ? '\x1b[32m' : '\x1b[31m';
    const msg = `[${stats.procesados}/${stats.archivosTotales}] 📄 ${archivoActual.substring(0, 15)} | 🤖 Tarea: ${accion.padEnd(15)} | ⛽ Cuota: ${fuelColor}${stats.combustiblePromedio.toFixed(1)}%\x1b[0m | ✅ Golden Pairs: ${stats.aprobadosDeepSeek} | ❌ Rechazos: ${stats.rechazadosDeepSeek}`;
    process.stdout.write(msg);
}

async function iniciarPipeline() {
    console.log("=========================================================");
    console.log("🚀 INICIANDO DATA ENGINE: DESTILACIÓN CSJ & AUDIOS");
    console.log("=========================================================\n");

    if (fs.existsSync(OUTPUT_FILE)) dataset = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    if (fs.existsSync(PROGRESS_FILE)) {
        const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        stats = prog.stats;
        archivosPendientes = prog.pendientes;
    } else {
        const files = fs.readdirSync(CSJ_DIR).filter(f => f.endsWith('.doc') || f.endsWith('.txt'));
        archivosPendientes = files;
        stats.archivosTotales = files.length;
    }

    if (!DEEPSEEK_API_KEY) {
        console.log("⚠️ ATENCIÓN: No se encontró DEEPSEEK_API_KEY en el .env.");
        console.log("DeepSeek Reasoner NO validará los datos (se aceptarán directo de Gemini).");
        console.log("Agregá DEEPSEEK_API_KEY=sk-... a tu .env si querés la auditoría de R1.\n");
    }

    for (let i = 0; i < archivosPendientes.length; i++) {
        const file = archivosPendientes[i];
        
        // 1. Monitoreo de Cuota en tiempo real (El Gobernador)
        const estado = await obtenerEstadoCapataz();
        if (estado) {
            stats.combustiblePromedio = estado.promedioCombustible;
            if (estado.frenoTotal || stats.combustiblePromedio < 5) {
                actualizarDashboard(file, "APAGANDO PC...");
                console.log("\n\n🚨 ALERTA: Cuota de cuentas Capataz agotada o freno de emergencia activado.");
                console.log("💾 Guardando progreso y apagando la computadora en 60 segundos...");
                fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes.slice(i) }, null, 2));
                exec('shutdown /s /t 60');
                process.exit(0);
            }
        }

        // 2. Extracción de Texto
        actualizarDashboard(file, "Extrayendo...");
        const filePath = path.join(CSJ_DIR, file);
        const texto = await extraerTextoDoc(filePath);

        // 3. Destilación con Capataz (Uso de máxima capacidad round-robin)
        actualizarDashboard(file, "Capataz Gemini");
        const pares = await capatazExtraer(texto);
        stats.paresExtraidos += pares.length;

        // 4. Validación estricta con DeepSeek Reasoner
        for (const pair of pares) {
            actualizarDashboard(file, "Validando (R1)");
            const aprobado = await deepseekValidar(pair);
            if (aprobado) {
                stats.aprobadosDeepSeek++;
                // Inyectamos el system prompt dorado de Tobi
                pair.system = "Sos Tobi, el Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy...";
                dataset.push(pair);
            } else {
                stats.rechazadosDeepSeek++;
            }
        }

        // Guardado incremental cada 5 archivos
        stats.procesados++;
        if (stats.procesados % 5 === 0) {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes.slice(i + 1) }, null, 2));
        }
    }

    console.log("\n\n✅ ¡Pipeline Finalizado con Éxito!");
    console.log(`Se destilaron ${stats.aprobadosDeepSeek} pares dorados desde ${stats.archivosTotales} dictámenes.`);
}

iniciarPipeline();
