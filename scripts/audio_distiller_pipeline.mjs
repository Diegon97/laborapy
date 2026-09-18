import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';

// Configuración de endpoints
const CAPATAZ_URL = 'http://127.0.0.1:8317/v1/chat/completions';
const CAPATAZ_ESTADO_URL = 'http://127.0.0.1:8318/api/estado';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const envPath = path.join(process.cwd(), '.env');
let DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
let groqKeys = [];

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dsMatch = envContent.match(/DEEPSEEK_API_KEY=(.*)/);
    if (dsMatch) DEEPSEEK_API_KEY = dsMatch[1].trim();
    
    // Cargar todo el pool de llaves Groq para round-robin masivo
    for (let i = 1; i <= 10; i++) {
        const match = envContent.match(new RegExp(`GROQ_API_KEY_${i}=(.*)`));
        if (match) groqKeys.push(match[1].trim());
    }
    if (groqKeys.length === 0) {
        const singleMatch = envContent.match(/GROQ_API_KEY=(.*)/);
        if (singleMatch) groqKeys.push(singleMatch[1].trim());
    }
}

if (groqKeys.length === 0) {
    console.error("Faltan llaves de GROQ en el .env");
    process.exit(1);
}

// Round-Robin ultra-rápido de Groq Keys
let groqIndex = 0;
function getGroqKey() {
    const k = groqKeys[groqIndex];
    groqIndex = (groqIndex + 1) % groqKeys.length;
    return k;
}

const AUDIOS_DIR = path.join(process.cwd(), '..', 'audios');
const OUTPUT_FILE = path.join(process.cwd(), 'datasets', 'tobi_golden_audios.json');
const PROGRESS_FILE = path.join(process.cwd(), 'datasets', 'audio_progress.json');

// --- UTILIDADES ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clearLine = () => {
    if (process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    } else {
        process.stdout.write('\n');
    }
};

let stats = {
    procesados: 0,
    paresExtraidos: 0,
    aprobadosDeepSeek: 0,
    rechazadosDeepSeek: 0,
    combustiblePromedio: 100,
    archivosTotales: 0,
    groqRateLimits: 0
};

let dataset = [];
let archivosPendientes = [];

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.toLowerCase().endsWith('.mp3') || file.toLowerCase().endsWith('.wav')) {
                arrayOfFiles.push(path.relative(AUDIOS_DIR, fullPath));
            }
        }
    });
    return arrayOfFiles;
}

async function obtenerEstadoCapataz() {
    try {
        const response = await fetch(CAPATAZ_ESTADO_URL);
        const data = await response.json();
        return data.gobernador;
    } catch (e) {
        return null;
    }
}

// 1. Transcripción hiper-paralelizada (usando Round-Robin de keys en 429)
async function transcribeAudioGroq(filePath, maxRetries = 5) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'audio/mp3' });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const currentKey = getGroqKey();
    try {
      const form = new FormData();
      form.append('file', blob, path.basename(filePath));
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'es');
      form.append('temperature', '0');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // Fail fast

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentKey}` },
        body: form,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        stats.groqRateLimits++;
        // Cambió de key instantáneo, sin esperar 5 segundos, probamos con la siguiente
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      return (data.text || '').trim();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Espera mínima (500ms) si falló por timeout
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return "";
}

// 2. Extracción ultra-veloz vía Capataz
async function capatazExtraer(texto) {
    if (!texto || texto.length < 50) return [];
    
    const prompt = `Sos experto en Derecho Laboral Paraguayo. Transcripción de abogado laboralista:
"${texto}"
Extraé 1 a 2 pares de Pregunta y Respuesta. Actualizá salario viejo a Gs. 3.044.000.
Devolvé ÚNICAMENTE JSON: [{"instruction": "...", "output": "..."}]`;

    try {
        const response = await fetch(CAPATAZ_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8'
            },
            body: JSON.stringify({
                model: 'gemini-3.8-flash-high', // El pool Antigravity se encarga del round robin
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

// 3. Auditoría DeepSeek
async function deepseekValidar(pair) {
    if (!DEEPSEEK_API_KEY) return true;

    const prompt = `Revisor Legal Paraguay. PREGUNTA: ${pair.instruction} | RESPUESTA: ${pair.output}
¿Hay error matemático, cita falsa de Ley 213/93 o salario distinto a Gs. 3.044.000? Responde SOLO APROBADO o RECHAZADO.`;

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
        return data.choices[0].message.content.toUpperCase().includes('APROBADO');
    } catch (e) {
        return false;
    }
}

let startTime = null;

function actualizarDashboard(archivoActual, accion) {
    if (!startTime) startTime = Date.now();
    clearLine();
    const elapsedMs = Date.now() - startTime;
    const elapsedMins = elapsedMs / 60000;
    
    let speed = 0;
    let etaMsg = "Calculando...";
    if (stats.procesados > 0 && elapsedMins > 0) {
        speed = stats.procesados / elapsedMins;
        const remaining = stats.archivosTotales - stats.procesados;
        const etaMins = remaining / speed;
        const h = Math.floor(etaMins / 60);
        const m = Math.floor(etaMins % 60);
        etaMsg = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    const fuelColor = stats.combustiblePromedio > 50 ? '\x1b[32m' : '\x1b[31m';
    const progressPct = ((stats.procesados / stats.archivosTotales) * 100).toFixed(1);
    
    const msg = `\r[${stats.procesados}/${stats.archivosTotales} - ${progressPct}%] 🎵 ${accion.padEnd(12)} | ⚡ Vel: ${speed.toFixed(1)} audios/min | ⏳ ETA: ${etaMsg} | ⛽ Capataz: ${fuelColor}${stats.combustiblePromedio.toFixed(1)}%\x1b[0m | 🏆 Pairs: ${stats.aprobadosDeepSeek}`;
    
    process.stdout.write(msg);
}

async function iniciarPipeline() {
    console.log("=========================================================");
    console.log("⚡ INICIANDO DATA ENGINE: MODO FULL PUSH (Hyper-Threading)");
    console.log(`🔑 Pool Groq: ${groqKeys.length} llaves cargadas. Bypassing Rate Limits.`);
    console.log("=========================================================\n");

    if (fs.existsSync(OUTPUT_FILE)) dataset = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    if (fs.existsSync(PROGRESS_FILE)) {
        const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        stats = prog.stats;
        archivosPendientes = prog.pendientes;
    } else {
        archivosPendientes = getAllFiles(AUDIOS_DIR);
        stats.archivosTotales = archivosPendientes.length;
    }

    // Aceleración controlada: Procesar 10 audios a la vez. 
    // Esto iguala exactamente el BATCH_SIZE del CSJ pipeline que funcionó de maravilla.
    // Garantiza ~3 requests concurrentes por cuenta Capataz (0 riesgo de ban).
    const BATCH_SIZE = 10; 
    
    while (archivosPendientes.length > 0) {
        const estadoActual = await obtenerEstadoCapataz();
        if (estadoActual) {
            stats.combustiblePromedio = estadoActual.promedioCombustible;
            if (estadoActual.frenoTotal || stats.combustiblePromedio < 5) {
                console.log("\n\n🛑 ALERTA: Cuota Capataz agotada. Frenando por seguro anti-ban.");
                fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes }, null, 2));
                process.exit(0);
            }
        }

        const batch = archivosPendientes.splice(0, BATCH_SIZE);
        actualizarDashboard(`Procesando ${batch.length} audios...`, `Batch Paralelo ${BATCH_SIZE}`);

        const promesas = batch.map(async (file) => {
            const filePath = path.join(AUDIOS_DIR, file);
            let validados = 0;
            let rechazados = 0;
            let total = 0;

            try {
                const texto = await transcribeAudioGroq(filePath);
                
                if (texto) {
                    const pares = await capatazExtraer(texto);
                    total = pares.length;
                    
                    // Paralelizamos también la auditoría de DeepSeek
                    const deepseekPromises = pares.map(async (pair) => {
                        const aprobado = await deepseekValidar(pair);
                        if (aprobado) {
                            pair.system = "Sos Tobi, el Copilot y Asesor Senior de Recursos Humanos y Legislación Laboral de LaboraPy...";
                            pair.source = file;
                            dataset.push(pair);
                            validados++;
                        } else {
                            rechazados++;
                        }
                    });
                    
                    await Promise.all(deepseekPromises);
                }
            } catch (err) {
                archivosPendientes.push(file); 
            }
            
            return { validados, rechazados, total };
        });

        const resultados = await Promise.all(promesas);
        
        resultados.forEach(r => {
            stats.paresExtraidos += r.total;
            stats.aprobadosDeepSeek += r.validados;
            stats.rechazadosDeepSeek += r.rechazados;
            stats.procesados++;
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ stats, pendientes: archivosPendientes }, null, 2));
        
        actualizarDashboard(`Quedan ${archivosPendientes.length}`, `OK. Siguiente...`);
    }

    console.log("\n\n🏆 ¡Hyper-Pipeline Finalizado con Éxito!");
    console.log(`Se destilaron ${stats.aprobadosDeepSeek} pares dorados desde ${stats.archivosTotales} audios.`);
}

iniciarPipeline();
