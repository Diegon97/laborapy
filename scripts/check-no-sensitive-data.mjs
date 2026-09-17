/**
 * GUARD DE PROTECCION DE DATOS Y CREDENCIALES - LABORAPY
 *
 * El sistema es NETAMENTE EXPLICATIVO Y DEMOSTRATIVO.
 * Queda estrictamente prohibido incorporar informacion real de las empresas
 * Zavidoro, Merco Sur y Meta Lab, sus funcionarios, cedulas, salarios o
 * cualquier dato personal o confidencial.
 *
 * Ademas, BLOQUEA la compilacion si detecta secretos hardcodeados:
 * API keys (Groq, estilo sk-, Google) o JWT con rol service_role.
 *
 * Este guard se ejecuta antes de cada build y BLOQUEA la compilacion si detecta
 * terminos prohibidos o credenciales en el codigo fuente o en los archivos publicos.
 * NUNCA imprime el valor del secreto detectado (solo archivo + tipo).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TERMINOS_PROHIBIDOS = [
  'zavidoro',
  'cantero',
  'busto',
  'azco',
  '5162734',
  '5173620',
  '1343704',
  'merco sur',
  'mercosur',
  'meta lab',
  'metalab',
];

const RAICES_EMPRESA = ['src', 'public', 'index.html'];
const RAICES_SECRETOS = ['src', 'public', 'index.html', 'api', 'scripts'];

const EXTENSIONES_IGNORADAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.zip', '.xlsx',
]);

function* recorrer(ruta) {
  let estado;
  try {
    estado = statSync(ruta);
  } catch {
    return;
  }
  if (estado.isDirectory()) {
    for (const entrada of readdirSync(ruta)) {
      if (entrada === 'node_modules' || entrada === '.git') continue;
      yield* recorrer(join(ruta, entrada));
    }
    return;
  }
  if (!EXTENSIONES_IGNORADAS.has(extname(ruta).toLowerCase())) {
    yield ruta;
  }
}

const PATRONES_SECRETOS = [
  { nombre: 'Groq API key', regex: /gsk_[A-Za-z0-9]{20,}/ },
  { nombre: 'OpenAI/DeepSeek API key', regex: /sk-[A-Za-z0-9]{20,}/ },
  { nombre: 'Google API key', regex: /AIza[0-9A-Za-z_-]{30,}/ },
];

const PATRON_JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g;

function rolDeJwt(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const data = JSON.parse(decoded);
    return typeof data?.role === 'string' ? data.role : null;
  } catch {
    return null;
  }
}

const hallazgosEmpresa = [];
for (const raiz of RAICES_EMPRESA) {
  for (const archivo of recorrer(raiz)) {
    const contenido = readFileSync(archivo, 'utf8').toLowerCase();
    for (const termino of TERMINOS_PROHIBIDOS) {
      if (contenido.includes(termino)) {
        hallazgosEmpresa.push(`${archivo} contiene "${termino}"`);
      }
    }
  }
}

const hallazgosSecretos = [];
for (const raiz of RAICES_SECRETOS) {
  for (const archivo of recorrer(raiz)) {
    const contenido = readFileSync(archivo, 'utf8');

    for (const { nombre, regex } of PATRONES_SECRETOS) {
      if (regex.test(contenido)) {
        hallazgosSecretos.push(`${archivo}: posible ${nombre} hardcodeada`);
      }
    }

    PATRON_JWT.lastIndex = 0;
    let match;
    while ((match = PATRON_JWT.exec(contenido)) !== null) {
      if (rolDeJwt(match[0]) === 'service_role') {
        hallazgosSecretos.push(`${archivo}: JWT con role "service_role" hardcodeado`);
      }
    }
    PATRON_JWT.lastIndex = 0;
  }
}

if (hallazgosEmpresa.length > 0 || hallazgosSecretos.length > 0) {
  console.error('');
  console.error('[SEGURIDAD] BUILD BLOQUEADO.');
  if (hallazgosEmpresa.length > 0) {
    console.error('[PROTECCION DE DATOS] Informacion prohibida de empresas o funcionarios:');
    for (const hallazgo of hallazgosEmpresa) console.error('  - ' + hallazgo);
  }
  if (hallazgosSecretos.length > 0) {
    console.error('[CREDENCIALES] Secretos hardcodeados detectados (valores omitidos):');
    for (const hallazgo of hallazgosSecretos) console.error('  - ' + hallazgo);
  }
  console.error('');
  process.exit(1);
}

console.log('[SEGURIDAD] OK: sin informacion prohibida de empresas/funcionarios y sin credenciales hardcodeadas.');
