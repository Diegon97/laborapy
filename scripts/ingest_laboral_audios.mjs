import fs from 'fs';
import path from 'path';

// Claves obtenidas de forma segura
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wbbcqololvxlnmxajurd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Ingesta] Faltan variables de entorno: GROQ_API_KEY y/o SUPABASE_SERVICE_ROLE_KEY. Abortando.');
  process.exit(1);
}

const YAMPEY_AUTOR_ID = 'a152db4e-ff49-4fec-8413-34b9e2e6e460';
const STATE_FILE = 'ingestion_state.json';

// Cargar o inicializar estado de ingesta
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
      return { processed: {}, failed: {} };
    }
  }
  return { processed: {}, failed: {} };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// 1. Transcripción con Groq Whisper
async function transcribeAudioGroq(filePath, maxRetries = 3) {
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'audio/mp3' });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const form = new FormData();
      form.append('file', blob, path.basename(filePath));
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'es');
      form.append('temperature', '0');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: form,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        console.warn(`[Groq 429] Rate limit alcanzado. Esperando 5s (intento ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 5000));
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
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('Groq transcripción agotó reintentos');
}

// Función robusta para parsear JSON incluso si viene con markdown
function parseJsonSafe(raw) {
  if (!raw) throw new Error('Respuesta vacía');
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`JSON inválido: ${raw.slice(0, 100)}`);
  }
}

// 2. Estructuración Legal con Cascada Rápida (DeepSeek -> Groq Llama 3.3 70B)
async function analyzeLegalWithDeepSeek(transcript) {
  const systemPrompt = `Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay.
Tu misión es extraer el valor legal de las explicaciones prácticas del Abg. Ernesto Yampey.
Debes responder SIEMPRE con un JSON válido y estricto.
Fundamenta en el Código del Trabajo paraguayo (Ley 213/93), Ley 5508/15 (maternidad/lactancia), Decreto-Ley 1860/50 (IPS), Art. 19 (Principio de Primacía de la Realidad contra facturación fraudulenta), etc.
NO inventes artículos que no existan en la legislación paraguaya.`;

  const userPrompt = `Transcripción del video de Yampey:
"""${transcript}"""

Devolvé ÚNICAMENTE un JSON con:
{
  "titulo_tema": "Título breve y descriptivo (máx 150 caracteres)",
  "caso_abuso_detectado": "Detalle de la situación, abuso patronal o consulta del trabajador planteada",
  "fundamento_juridico": "Artículos y leyes paraguayas aplicables (ej: Art. 19 Código del Trabajo, Ley 1860/50 IPS)",
  "criterio_practico": "Consejo y criterio concreto: qué debe hacer el trabajador o qué dictamina la ley",
  "articulos_citados": ["Art. ..."]
}`;

  // Intento 1: DeepSeek (timeout 8s)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return parseJsonSafe(content);
    }
  } catch (err) {
    console.warn(`[DeepSeek lento/falló: ${err.message}] Pasando inmediatamente a Groq Llama 3.3 70B...`);
  }

  // Fallback Inmediato: Groq Llama 3.3 70B (ultra veloz en LPUs)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + ' Respond strictly with valid JSON.' },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return parseJsonSafe(content);
    }
    const errText = await res.text();
    throw new Error(`Groq LLM HTTP ${res.status}: ${errText.slice(0, 100)}`);
  } catch (err) {
    throw new Error(`Todos los modelos LLM (DeepSeek y Groq) fallaron: ${err.message}`);
  }
}

// 3. Inserción en Supabase con Service Role Key
async function insertToSupabase(record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jurisprudencia_multimedia`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      autor_id: record.autor_id,
      plataforma: 'tiktok',
      titulo_tema: record.titulo_tema.slice(0, 300),
      audio_transcripcion: record.audio_transcripcion,
      caso_abuso_detectado: record.caso_abuso_detectado,
      fundamento_juridico: record.fundamento_juridico,
      criterio_practico: record.criterio_practico,
      articulos_citados: record.articulos_citados || [],
      metadata: record.metadata || {},
      activo: true
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert HTTP ${res.status}: ${err}`);
  }

  const inserted = await res.json();
  return inserted[0]?.id;
}

// Función principal exportada para prueba o ejecución completa
export async function processSingleAudio(filePath, autorId = YAMPEY_AUTOR_ID) {
  const fileName = path.basename(filePath);
  const t0 = Date.now();
  console.log(`[Audio: ${fileName}] Paso 1: Transcribiendo con Groq Whisper...`);

  // Paso 1: Groq Whisper
  const transcript = await transcribeAudioGroq(filePath);
  console.log(`[Audio: ${fileName}] Paso 1 OK (${Date.now() - t0}ms). Transcripción: "${transcript.slice(0, 80)}..."`);
  if (!transcript || transcript.length < 15) {
    throw new Error('Transcripción vacía o demasiado corta');
  }
  const t1 = Date.now();

  // Paso 2: DeepSeek Legal Analysis
  console.log(`[Audio: ${fileName}] Paso 2: Analizando jurídicamente con DeepSeek...`);
  const analysis = await analyzeLegalWithDeepSeek(transcript);
  console.log(`[Audio: ${fileName}] Paso 2 OK (${Date.now() - t1}ms). Título: "${analysis.titulo_tema}"`);
  const t2 = Date.now();

  // Paso 3: Guardar en Supabase
  console.log(`[Audio: ${fileName}] Paso 3: Insertando en Supabase...`);
  const id = await insertToSupabase({
    autor_id: autorId,
    titulo_tema: analysis.titulo_tema || fileName.replace('.mp3', ''),
    audio_transcripcion: transcript,
    caso_abuso_detectado: analysis.caso_abuso_detectado || 'Consulta laboral',
    fundamento_juridico: analysis.fundamento_juridico || 'Código del Trabajo',
    criterio_practico: analysis.criterio_practico || '',
    articulos_citados: analysis.articulos_citados || [],
    metadata: {
      file: fileName,
      whisper_time_ms: t1 - t0,
      deepseek_time_ms: t2 - t1,
      total_time_ms: Date.now() - t0
    }
  });
  console.log(`[Audio: ${fileName}] Paso 3 OK (${Date.now() - t2}ms). ID: ${id}`);

  return { id, fileName, analysis, transcript, durationMs: Date.now() - t0 };
}

// Si se ejecuta directamente como script
if (process.argv[1] && process.argv[1].endsWith('ingest_laboral_audios.mjs')) {
  const isTest = process.argv.includes('--test');
  const dir = 'audios/yampey';

  if (!fs.existsSync(dir)) {
    console.error(`Carpeta ${dir} no encontrada.`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.mp3'));
  console.log(`[Inicio] Total de audios de Yampey encontrados: ${allFiles.length}`);

  if (isTest) {
    console.log('[Modo Test] Procesando únicamente el primer audio de prueba...');
    const testFile = path.join(dir, allFiles[0]);
    processSingleAudio(testFile)
      .then(res => {
        console.log('✅ ÉXITO TOTAL en prueba:');
        console.log('ID Supabase:', res.id);
        console.log('Título:', res.analysis.titulo_tema);
        console.log('Abuso:', res.analysis.caso_abuso_detectado);
        console.log('Fundamento:', res.analysis.fundamento_juridico);
        console.log('Criterio:', res.analysis.criterio_practico);
        console.log('Artículos:', res.analysis.articulos_citados);
        console.log(`Tiempo total: ${(res.durationMs / 1000).toFixed(2)}s`);
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Error en prueba:', err);
        process.exit(1);
      });
  } else {
    // Pipeline completo con monitor minuto a minuto y control de concurrencia
    async function runFullIngestion() {
      const state = loadState();
      const filesToProcess = allFiles.filter(f => !state.processed[f]);
      console.log(`Pendientes por procesar: ${filesToProcess.length} de ${allFiles.length}`);

      let successCount = Object.keys(state.processed).length;
      let failCount = 0;
      let consecutiveErrors = 0;
      const startTime = Date.now();
      let lastReportTime = Date.now();

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const filePath = path.join(dir, file);
        const itemStart = Date.now();

        try {
          const res = await processSingleAudio(filePath, YAMPEY_AUTOR_ID);
          state.processed[file] = {
            id: res.id,
            timestamp: new Date().toISOString(),
            durationMs: res.durationMs
          };
          delete state.failed[file];
          saveState(state);
          successCount++;
          consecutiveErrors = 0;

          const itemTime = ((Date.now() - itemStart) / 1000).toFixed(1);
          console.log(`[${successCount}/${allFiles.length}] ✅ ${file.slice(0, 35)}... (${itemTime}s) -> ${res.analysis.titulo_tema.slice(0, 40)}`);

          // Respetar límite de Groq (20 req/min -> ~3s por audio)
          await new Promise(r => setTimeout(r, 2200));
        } catch (err) {
          console.error(`[FALLO] ${file}: ${err.message}`);
          state.failed[file] = { error: err.message, timestamp: new Date().toISOString() };
          saveState(state);
          failCount++;
          consecutiveErrors++;

          if (consecutiveErrors >= 4) {
            console.error('🛑 ALERTA: 4 fallos consecutivos. Deteniendo ingesta para protección.');
            process.exit(1);
          }
          await new Promise(r => setTimeout(r, 4000));
        }

        // Reporte minuto a minuto
        if (Date.now() - lastReportTime >= 60000 || i === filesToProcess.length - 1) {
          lastReportTime = Date.now();
          const elapsedSecs = Math.round((Date.now() - startTime) / 1000);
          const processedInSession = i + 1;
          const avgPerItem = processedInSession > 0 ? (elapsedSecs / processedInSession).toFixed(1) : 0;
          const remaining = filesToProcess.length - processedInSession;
          const estMinsLeft = ((remaining * avgPerItem) / 60).toFixed(1);

          console.log(`\n📊 === REPORTE MINUTO A MINUTO ===`);
          console.log(`⏱️ Transcurrido: ${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`);
          console.log(`📈 Avance global: ${successCount}/${allFiles.length} (${((successCount / allFiles.length) * 100).toFixed(1)}%)`);
          console.log(`⚡ Ritmo promedio: ${avgPerItem}s por audio`);
          console.log(`⏳ Tiempo restante estimado: ~${estMinsLeft} minutos`);
          console.log(`==================================\n`);
        }
      }

      console.log(`🎉 ¡Ingesta de Yampey finalizada! Éxito: ${successCount}, Fallos: ${failCount}`);
    }

    runFullIngestion();
  }
}
