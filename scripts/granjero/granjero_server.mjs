import http from 'http';

// --- CONFIGURACIÓN ---
const PORT = process.env.PORT || 8319;
// URL del Capataz que estará corriendo en la misma PC (PC 2)
const CAPATAZ_URL = process.env.CAPATAZ_URL || 'http://127.0.0.1:8318/v1/chat/completions';

console.log(`🌾 Granjero Middleware iniciado.`);
console.log(`🔌 Conectado al motor Antigravity (Capataz) en: ${CAPATAZ_URL}`);

// Mapeo de modos Tobi -> Modelos de Capataz (Antigravity)
function mapModel(requestedModel) {
  let capatazModel = 'capataz/gemini-3.8-flash-high'; // Flash por defecto
  let isInvestigate = false;

  if (requestedModel === 'deep') {
    capatazModel = 'capataz/gemini-pro-agent'; // Pro para pensar profundo
  } else if (requestedModel === 'investigate') {
    capatazModel = 'capataz/gemini-pro-agent'; 
    isInvestigate = true;
  }

  return { capatazModel, isInvestigate };
}

// Inyectar contexto legal para modo investigación
function enrichMessages(messages, isInvestigate) {
  if (!isInvestigate) return messages;

  const extraPrompt = `\n\nIMPORTANTE (MODO INVESTIGACIÓN): Tu respuesta DEBE ser un análisis jurídico profundo. Investigá y citá explícitamente artículos del Código del Trabajo Paraguayo (Ley 213/93), Ley de Maternidad (5508/15) o resoluciones del MTESS aplicables al caso exacto. Actuá como un perito informante laboral de la Corte Suprema.`;

  // Buscar si hay un mensaje de system, sino crearlo
  const newMessages = [...messages];
  const systemIndex = newMessages.findIndex(m => m.role === 'system');

  if (systemIndex >= 0) {
    newMessages[systemIndex] = {
      ...newMessages[systemIndex],
      content: newMessages[systemIndex].content + extraPrompt
    };
  } else {
    newMessages.unshift({ role: 'system', content: extraPrompt });
  }

  return newMessages;
}

// --- SERVIDOR HTTP ---
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Solo POST' }));
    return;
  }

  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk; });
  
  req.on('end', () => {
    try {
      const body = JSON.parse(bodyData);
      const { model, messages, stream } = body;
      
      const { capatazModel, isInvestigate } = mapModel(model);
      const finalMessages = enrichMessages(messages || [], isInvestigate);

      console.log(`[${new Date().toISOString()}] 🚀 Petición -> Modo: ${model} | Derivando a Capataz: ${capatazModel}`);

      // Forward a Capataz
      const payload = JSON.stringify({
        model: capatazModel,
        stream: true,
        messages: finalMessages,
        temperature: 0.1
      });

      const proxyReq = http.request(CAPATAZ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('❌ Error conectando a Capataz:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Falla de conexión con Capataz', details: err.message }));
      });

      proxyReq.write(payload);
      proxyReq.end();

    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'JSON inválido' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌾 Granjero escuchando peticiones de Tobi en http://0.0.0.0:${PORT}/v1/chat/completions`);
});
