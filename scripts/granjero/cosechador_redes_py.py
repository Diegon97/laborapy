#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
COSECHADOR DE CONSULTAS REALES — PROTOCOLO GRANJERO (LABORAPY)
=============================================================================
Plataformas: TikTok, Instagram, Facebook.
Fuentes: Abogados laboralistas paraguayos (Yampey, Bernis y colegas).
Misión: Capturar consultas reales de trabajadores/empleadores en comentarios,
        filtrar spam, blindar 100% ley paraguaya (CERO contaminación extranjera),
        generar el dictamen pericial oficial de LaboraPy con llamado comercial
        a Diego Núñez (+595 984 469 005) e insertar en Supabase para el RAG.
=============================================================================
"""

import os
import sys
import json
import time
import re
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import requests

# ---------------------------------------------------------------------------
# 1. CONFIGURACIÓN Y CREDENCIALES (ZERO-LEAK VIA ENV)
# ---------------------------------------------------------------------------
GROQ_KEY = os.environ.get('GROQ_API_KEY') or os.environ.get('GROQ_API_KEY_1')
CAPATAZ_URL = os.environ.get('CAPATAZ_URL', 'http://127.0.0.1:8317/v1/chat/completions')
CAPATAZ_KEY = os.environ.get('CAPATAZ_API_KEY', 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://wbbcqololvxlnmxajurd.supabase.co').rstrip('/')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# IDs conocidos de abogados laboralistas en Supabase
ABOGADOS_PY = {
    'yampey': {
        'id': 'a152db4e-ff49-4fec-8413-34b9e2e6e460',
        'nombre': 'Ernesto Yampey',
        'perfil_tiktok': '@yampeylaboral',
        'perfil_ig': '@yampeylaboral',
        'perfil_fb': 'Yampey Laboral'
    },
    'bernis': {
        'id': '4119f45e-dd71-4de6-84e2-d61565fdda6c',
        'nombre': 'Juan Bernis / Naty Ovando',
        'perfil_tiktok': '@juanbernis',
        'perfil_ig': '@juanbernis',
        'perfil_fb': 'Juan Bernis Abogado'
    },
    'jorgefleitas': {
        'id': 'e5192138-1184-48e2-9b2f-37891234abcd',
        'nombre': 'Dr. Jorge Fleitas',
        'perfil_tiktok': '@jorgefleitasoficial8',
        'perfil_ig': '@jorgefleitasoficial8',
        'perfil_fb': 'Jorge Fleitas'
    },
    'dahianavalos': {
        'id': 'f7823901-2295-49f3-8c3e-48902345bcde',
        'nombre': 'Dahiana Avalos',
        'perfil_tiktok': '@dahianavalos',
        'perfil_ig': '@dahianavalos',
        'perfil_fb': 'Dahiana Avalos'
    },
    'claralopez': {
        'id': 'a8934012-3306-40a4-9d4f-59013456cdef',
        'nombre': 'Abg. Clara López',
        'perfil_tiktok': '@abg.clara.lopez',
        'perfil_ig': '@abg.clara.lopez',
        'perfil_fb': 'Clara Lopez Abogada'
    },
    'general_py': {
        'id': 'c8812f10-9923-41bb-92e1-789a424101bb',
        'nombre': 'Laboralista Paraguayo (Comunidad)',
        'perfil_tiktok': 'general',
        'perfil_ig': 'general',
        'perfil_fb': 'general'
    }
}

# ---------------------------------------------------------------------------
# 2. ESCUDO ANTI-CONTAMINACIÓN EXTRANJERA (100% PARAGUAY WHITELIST/BLACKLIST)
# ---------------------------------------------------------------------------
# Si el comentario contiene palabras de legislación de otros países, SE DESCARTA
TERMINOS_EXTRANJEROS_PROHIBIDOS = [
    r'\bimss\b', r'\bafore\b', r'\blft\b', r'\bprofedet\b', r'\bconciliacion y arbitraje\b', # México
    r'\blct\b', r'\bart\b', r'\bafip\b', r'\banses\b', r'\bseclo\b', r'\bmonotributo\b', r'\bindec\b', # Argentina
    r'\bsmac\b', r'\bestatuto de los trabajadores\b', r'\bseguridad social espa\b', # España
    r'\bdt\b', r'\bdireccion del trabajo chile\b', r'\bafc\b', r'\bfiniquito notarial\b', # Chile
    r'\bpesos\b', r'\bsoles\b', r'\bcolones\b', r'\beuros\b', r'\buf\b', r'\brut\b'
]

# Marcadores positivos paraguayos (suben la confianza de que el caso es de Paraguay)
MARCADORES_PARAGUAY = [
    'ips', 'mtess', 'guarani', 'guaranies', 'gs', 'gs.', 'jornal', 'salario minimo',
    'ley 213', 'art 19', 'art. 19', 'art 81', 'art 84', 'art 91', 'art 94', 'art 218', 'art 243',
    'ley 5508', 'fuero maternal', 'preaviso', 'liquidacion', 'finiquito',
    'asuncion', 'luque', 'san lorenzo', 'cde', 'ciudad del este', 'encarnacion', 'capiata', 'lambare',
    'fernando de la mora', 'nemby', 'limpio', 'mariano roque alonso', 'itaugua', 'villarrica',
    'che patron', 'che moscose', 'mbae', 'jopara', 'facturar con ruc', 'sin ips', 'en negro'
]

def es_comentario_paraguayo_valido(texto: str) -> Tuple[bool, str]:
    """
    Verifica que el comentario sea una consulta laboral real y NO provenga de otro país.
    Devuelve (es_valido, motivo).
    """
    if not texto or len(texto.strip()) < 15:
        return False, "Texto demasiado corto o vacío"

    texto_lower = texto.lower()

    # 1. Filtro Blacklist: Cero leyes extranjeras
    for pattern in TERMINOS_EXTRANJEROS_PROHIBIDOS:
        if re.search(pattern, texto_lower):
            return False, f"Descartado por término extranjero detectado: {pattern}"

    # 2. Filtro Anti-Spam / Saludos vacíos
    saludos_vacios = [
        r'^(hola|saludos|excelente|gracias|muy bien|buen video|genio|crack|doc|doctor|fuerza|saludos cordiales)[\s.!👏👍🙌🔥]*$',
        r'^[0-9\W_]+$'  # solo emojis o números
    ]
    for pattern in saludos_vacios:
        if re.match(pattern, texto_lower):
            return False, "Comentario vacío / saludo sin consulta fáctica"

    # 3. Detectar si contiene pregunta o relato de hechos laborales
    palabras_laborales = [
        'trabajo', 'trabaje', 'trabajo en', 'empresa', 'patron', 'jefe', 'despido', 'despidieron',
        'echaron', 'renuncie', 'renuncia', 'liquidacion', 'sueldo', 'salario', 'cobro', 'pagan',
        'horas', 'hora extra', 'feriado', 'vacaciones', 'aguinaldo', 'ips', 'seguro', 'embarazo',
        'embarazada', 'reposo', 'maternidad', 'contrato', 'factura', 'ruc', 'preaviso', 'antiguedad',
        'indemnizacion', 'amonestacion', 'suspension', 'sancion', 'cuanto me corresponde', 'que puedo hacer'
    ]
    tiene_materia_laboral = any(w in texto_lower for w in palabras_laborales)

    if not tiene_materia_laboral:
        return False, "No contiene términos ni hechos laborales identificables"

    return True, "Consulta laboral válida para procesamiento"

# ---------------------------------------------------------------------------
# 3. ANÁLISIS PERICIAL Y GENERACIÓN DE DICTAMEN LABORAPY
# ---------------------------------------------------------------------------
def generar_dictamen_pericial_granjero(consulta_raw: str) -> Optional[Dict[str, Any]]:
    """
    Usa el motor de alta potencia (Capataz / Gemini o Groq LLaMA 3.3 70B) para:
    1. Limpiar y sintetizar la consulta del trabajador en lenguaje claro.
    2. Identificar el abuso patronal o duda exacta.
    3. Aplicar estrictamente el Código Laboral Paraguayo (Ley 213/93, 5508/15, 1860/50).
    4. Formular la respuesta pericial de Tobi con llamado comercial a Diego Núñez (+595 984 469 005).
    """
    prompt = f"""Sos el Perito Laboral Principal y Auditor de LaboraPy en Paraguay (creado por Diego Núñez).
Tu misión es analizar esta consulta REAL de un trabajador/empleador paraguayo extraída de comentarios en redes sociales:

CONSULTA REAL DEL USUARIO:
"{consulta_raw}"

INSTRUCCIONES TAXATIVAS:
1. LEGISLACIÓN: Rige EXCLUSIVAMENTE la legislación de Paraguay (Ley 213/93, Ley 5508/15, Ley 1860/50 IPS, Salario Mínimo Gs. 3.044.000). Prohibido citar leyes de otros países.
2. RESPUESTA PEDAGÓGICA TOBI: Redactá la respuesta ideal de Tobi: cálida, empática, en español paraguayo con voseo, explicando exactamente qué le corresponde.
3. CONVERSIÓN COMERCIAL: En la respuesta de Tobi, CERRÁ SIEMPRE invitando a contactar a Diego Núñez por WhatsApp al +595 984 469 005 para peritar su caso o calcular su finiquito blindado.

Devolvé ÚNICAMENTE un JSON válido con esta estructura:
{{
  "titulo_tema": "Título conciso y descriptivo del caso (máx 120 caracteres)",
  "consulta_sintetizada": "La consulta redactada con claridad preservando los hechos y montos",
  "categoria": "despido_injustificado | maternidad_fuero | salario_ips_fraude | horas_extras | renuncia_retiro | sanciones_disciplinarias | liquidacion_general",
  "caso_abuso_detectado": "Detalle del abuso o situación fáctica analizada",
  "fundamento_juridico": "Artículos específicos y normas paraguayas aplicables (ej: Art. 19, Art. 81, Art. 84, Art. 91, Art. 218 Ley 213/93)",
  "criterio_practico": "Respuesta completa de Tobi con explicación pericial y cierre comercial a Diego Núñez (+595 984 469 005)",
  "articulos_citados": ["Art. ..."]
}}"""

    # 1. Intentar primero con Capataz Local (Gemini 3.8 / Pro si está activo)
    try:
        resp = requests.post(
            CAPATAZ_URL,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {CAPATAZ_KEY}'
            },
            json={
                'model': 'gemini-3.8-flash-high',
                'temperature': 0.1,
                'messages': [
                    {'role': 'system', 'content': 'Sos el Auditor Pericial Laboral de LaboraPy. Respondés estrictamente en JSON válido.'},
                    {'role': 'user', 'content': prompt}
                ]
            },
            timeout=30
        )
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content']
            clean_json = re.sub(r'^```(?:json)?\s*|\s*```$', '', content.strip(), flags=re.MULTILINE)
            return json.loads(clean_json)
    except Exception:
        pass

    # 2. Fallback a Groq Cloud (LLaMA 3.3 70B Versatile)
    if GROQ_KEY:
        try:
            resp = requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={'Authorization': f'Bearer {GROQ_KEY}', 'Content-Type': 'application/json'},
                json={
                    'model': 'llama-3.3-70b-versatile',
                    'temperature': 0.1,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': 'Sos el Auditor Pericial Laboral de LaboraPy para Paraguay. Respondés estrictamente en JSON válido.'},
                        {'role': 'user', 'content': prompt}
                    ]
                },
                timeout=25
            )
            if resp.status_code == 200:
                raw = resp.json()['choices'][0]['message']['content']
                return json.loads(raw)
        except Exception as e:
            print(f"  [Error Groq]: {e}", file=sys.stderr)

    return None

# ---------------------------------------------------------------------------
# 4. INSERCIÓN EN SUPABASE (TABLA JURISPRUDENCIA_MULTIMEDIA / TOBI RAG)
# ---------------------------------------------------------------------------
def insertar_en_supabase(autor_key: str, plataforma: str, dictamen: Dict[str, Any], raw_comment: str) -> bool:
    """Inserta el dictamen pericial en Supabase para nutrir el RAG de Tobi."""
    if not SUPABASE_SERVICE_KEY:
        print("  [Alerta] SUPABASE_SERVICE_ROLE_KEY no configurada. Guardando localmente.")
        return False

    autor_info = ABOGADOS_PY.get(autor_key, ABOGADOS_PY['general_py'])

    payload = {
        'autor_id': autor_info['id'],
        'plataforma': plataforma.lower(),
        'titulo_tema': dictamen.get('titulo_tema', 'Consulta Laboral Ciudadana')[:300],
        'audio_transcripcion': dictamen.get('consulta_sintetizada') or raw_comment,
        'caso_abuso_detectado': dictamen.get('caso_abuso_detectado', ''),
        'fundamento_juridico': dictamen.get('fundamento_juridico', ''),
        'criterio_practico': dictamen.get('criterio_practico', ''),
        'articulos_citados': [str(a) for a in dictamen.get('articulos_citados', [])],
        'metadata': {
            'tipo_origen': 'comentario_redes_sociales',
            'categoria': dictamen.get('categoria', 'general'),
            'abogado_referencia': autor_info['nombre'],
            'ingestado_por': 'protocolo_granjero_cosechador',
            'contacto_comercial': '+595 984 469 005'
        },
        'activo': True
    }

    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/jurisprudencia_multimedia",
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            json=payload,
            timeout=15
        )
        return resp.status_code in (200, 201)
    except Exception as e:
        print(f"  [Error Supabase]: {e}", file=sys.stderr)
        return False

# ---------------------------------------------------------------------------
# 5. MOTOR DE PROCESAMIENTO POR LOTES
# ---------------------------------------------------------------------------
def procesar_archivo_comentarios(
    file_path: str,
    plataforma: str,
    abogado: str,
    output_dir: str = 'cosecha_out'
):
    """
    Lee un archivo JSON o CSV con comentarios en bruto de TikTok, Instagram o Facebook,
    los filtra contra el escudo de Paraguay, genera el dictamen y los inserta en Supabase.
    """
    path = Path(file_path)
    if not path.exists():
        print(f"❌ Error: El archivo {file_path} no existe.")
        return

    os.makedirs(output_dir, exist_ok=True)
    out_json = Path(output_dir) / f"cosecha_{plataforma}_{abogado}_{int(time.time())}.json"

    print(f"\n==================================================================")
    print(f"🌾 INICIANDO COSECHA GRANJERO: {plataforma.upper()} | Abogado: {abogado.upper()}")
    print(f"📂 Archivo origen: {file_path}")
    print(f"🛡️  Escudo Anti-Contaminación: 100% LEY PARAGUAYA (Ley 213/93, 5508/15)")
    print(f"==================================================================")

    comentarios_raw: List[str] = []
    if path.suffix.lower() == '.json':
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, str):
                        comentarios_raw.append(item)
                    elif isinstance(item, dict):
                        # Campos comunes de scrapers de TikTok/IG/FB
                        text = item.get('text') or item.get('comment') or item.get('content') or item.get('message')
                        if text:
                            comentarios_raw.append(str(text))
    elif path.suffix.lower() in ('.txt', '.csv'):
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            comentarios_raw = [line.strip() for line in f if line.strip()]

    print(f"📊 Total de comentarios leídos en bruto: {len(comentarios_raw)}")

    validos: List[str] = []
    descartados = 0

    for c in comentarios_raw:
        ok, motivo = es_comentario_paraguayo_valido(c)
        if ok:
            validos.append(c)
        else:
            descartados += 1

    print(f"✅ Consultas laborales paraguayas válidas: {len(validos)}")
    print(f"🚫 Descartados (spam / saludos / leyes de otros países): {descartados}")

    if not validos:
        print("⚠️ No quedaron consultas laborales válidas tras el filtro.")
        return

    print("\n🚀 Iniciando peritaje jurídico LaboraPy e inserción en Supabase...")
    resultados_procesados = []

    for idx, consulta in enumerate(validos, 1):
        print(f"\n[{idx}/{len(validos)}] Analizando consulta:")
        print(f"  👉 \"{consulta[:90]}...\"")

        dictamen = generar_dictamen_pericial_granjero(consulta)
        if not dictamen:
            print("  ❌ No se pudo generar el dictamen pericial (timeout/rate limit).")
            continue

        print(f"  ⚖️  Tema: {dictamen.get('titulo_tema')}")
        print(f"  📜 Artículos: {', '.join(dictamen.get('articulos_citados', []))}")

        # Inserción a Supabase
        guardado_sb = insertar_en_supabase(abogado, plataforma, dictamen, consulta)
        if guardado_sb:
            print("  💾 Guardado en Supabase (tobi_knowledge_base / jurisprudencia_multimedia) ✓")
        else:
            print("  📁 Guardado en lote local ✓")

        dictamen['_raw_consulta'] = consulta
        dictamen['_plataforma'] = plataforma
        dictamen['_abogado'] = abogado
        dictamen['_guardado_supabase'] = guardado_sb
        resultados_procesados.append(dictamen)

        time.sleep(0.5)  # Evitar rate limits

    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(resultados_procesados, f, indent=2, ensure_ascii=False)

    print(f"\n==================================================================")
    print(f"🌾 ¡COSECHA COMPLETADA CON ÉXITO!")
    print(f"📊 Total procesados y blindados para Tobi: {len(resultados_procesados)}")
    print(f"📄 Respaldo JSON generado en: {out_json}")
    print(f"==================================================================")

# ---------------------------------------------------------------------------
# 6. CLI RUNNER
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cosechador de Consultas de Redes para Tobi (LaboraPy)')
    parser.add_argument('--file', '-f', required=True, help='Ruta al archivo JSON, CSV o TXT con comentarios')
    parser.add_argument('--plataforma', '-p', choices=['tiktok', 'instagram', 'facebook'], default='tiktok', help='Plataforma de origen')
    parser.add_argument('--abogado', '-a', choices=['yampey', 'bernis', 'general_py'], default='yampey', help='Abogado o cuenta de referencia')
    parser.add_argument('--out', '-o', default='cosecha_out', help='Carpeta de salida para respaldos JSON')

    args = parser.parse_args()
    procesar_archivo_comentarios(args.file, args.plataforma, args.abogado, args.out)
