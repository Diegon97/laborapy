#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
PIPELINE MAESTRO DE COSECHA & EVALUACIÓN PERICIAL "OIKO O NO" (LABORAPY)
=============================================================================
Pool de Cuentas:
- 4 Cuentas Apify ($20.00 USD de crédito total gratuito)
- 4 API Keys de Groq Cloud (LLaMA 3.3 70B con auto-pausa por 429/503)
- Gemini 3.8 Flash (Capataz Local 8317 con auto-pausa)
- Escudo Anti-Contaminación 100% Ley 213/93 (Paraguay)
=============================================================================
"""

import os
import sys
import json
import time
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / '.env'

def cargar_env() -> Dict[str, str]:
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

ENV = cargar_env()

# ---------------------------------------------------------------------------
# 1. CONFIGURACIÓN DEL POOL DE 4 CUENTAS APIFY
# ---------------------------------------------------------------------------
APIFY_TOKENS = [
    ENV.get('APIFY_API_TOKEN_1') or ENV.get('APIFY_API_TOKEN'),
    ENV.get('APIFY_API_TOKEN_2'),
    ENV.get('APIFY_API_TOKEN_3'),
    ENV.get('APIFY_API_TOKEN_4')
]
APIFY_TOKENS = [t for t in APIFY_TOKENS if t]

# ---------------------------------------------------------------------------
# 2. CONFIGURACIÓN DEL POOL DE 4 KEYS DE GROQ CLOUD
# ---------------------------------------------------------------------------
GROQ_KEYS = [
    ENV.get('GROQ_API_KEY_1') or ENV.get('GROQ_API_KEY'),
    ENV.get('GROQ_API_KEY_2'),
    ENV.get('GROQ_API_KEY_3'),
    ENV.get('GROQ_API_KEY_4')
]
GROQ_KEYS = [k for k in GROQ_KEYS if k]

# ---------------------------------------------------------------------------
# 3. CAPATAZ LOCAL (GEMINI 3.8 FLASH)
# ---------------------------------------------------------------------------
CAPATAZ_URL = os.environ.get('CAPATAZ_URL', 'http://127.0.0.1:8317/v1/chat/completions')
CAPATAZ_KEY = os.environ.get('CAPATAZ_API_KEY', 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8')

# ---------------------------------------------------------------------------
# 4. OBJETIVOS: LOS 5 ABOGADOS LABORALISTAS DE PARAGUAY
# ---------------------------------------------------------------------------
ABOGADOS_OBJETIVO = [
    {
        'clave': 'yampey',
        'usuario': 'ernestoyampey',
        'nombre': 'Ernesto Yampey',
        'token_index': 0  # Cuenta Apify #1
    },
    {
        'clave': 'bernis',
        'usuario': 'juanbernis',
        'nombre': 'Juan Bernis / Naty Ovando',
        'token_index': 1  # Cuenta Apify #2
    },
    {
        'clave': 'jorgefleitas',
        'usuario': 'jorgefleitasoficial8',
        'nombre': 'Dr. Jorge Fleitas',
        'token_index': 2  # Cuenta Apify #3
    },
    {
        'clave': 'claralopez',
        'usuario': 'abg.clara.lopez',
        'nombre': 'Abg. Clara López',
        'token_index': 3  # Cuenta Apify #4
    },
    {
        'clave': 'dahianavalos',
        'usuario': 'dahianavalos',
        'nombre': 'Dahiana Ávalos',
        'token_index': 3  # Cuenta Apify #4 (comparte con Clara)
    }
]

# ---------------------------------------------------------------------------
# 5. FILTRO HEURÍSTICO RÁPIDO (COSTO $0)
# ---------------------------------------------------------------------------
TERMINOS_EXTRANJEROS = [
    r'\bimss\b', r'\bafore\b', r'\blft\b', r'\bprofedet\b', r'\bconciliacion y arbitraje\b',
    r'\blct\b', r'\bart\b', r'\bafip\b', r'\banses\b', r'\bseclo\b', r'\bmonotributo\b',
    r'\bsmac\b', r'\bestatuto de los trabajadores\b', r'\bdireccion del trabajo chile\b',
    r'\bpesos\b', r'\bsoles\b', r'\bcolones\b', r'\beuros\b'
]

def filtro_heuristico_base(texto: str) -> Tuple[bool, str]:
    if not texto or len(texto.strip()) < 15:
        return False, "Texto demasiado corto o vacío"
    t_lower = texto.lower()
    for pat in TERMINOS_EXTRANJEROS:
        if re.search(pat, t_lower):
            return False, f"Descartado por término extranjero detectado: {pat}"
    # Descarte de saludos o risas sin hechos
    if re.fullmatch(r'^(hola|buenas|saludos|jajaja|buen dia|dr|dra|doctor|doctora|😂😂😂|👍|👏)+[\s\.\?!]*$', t_lower):
        return False, "Solo saludo o reacción sin consulta"
    return True, "Pasa filtro heurístico base"

# ---------------------------------------------------------------------------
# 6. EVALUADOR GROQ POOL CON AUTO-PAUSA POR SATURACIÓN (429/503)
# ---------------------------------------------------------------------------
_groq_key_index = 0

def call_groq_oiko(comentario: str) -> Dict[str, Any]:
    global _groq_key_index
    if not GROQ_KEYS:
        return {'oiko': True, 'motivo': 'Groq no configurado, pasa por defecto', 'tema': 'General'}

    prompt = f"""Sos un perito en derecho laboral de Paraguay (Ley N.º 213/93 del Código del Trabajo).
Analizá el siguiente comentario dejado por un usuario en un video de TikTok de un abogado laboralista:
"{comentario}"

Determiná si el comentario "OIKO" (es una consulta, duda o denuncia laboral real de Paraguay sobre despido, renuncia, liquidación, IPS, salario mínimo, horas extras, maltrato, faltantes de caja, estabilidad, embarazo, etc.) o "NO_OIKO" (es saludo, broma, comentario político, cobranza comercial no laboral, spam o leyes de otro país).

Respondé EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{{
  "oiko": true o false,
  "motivo": "explicación concisa de por qué oiko o no",
  "tema": "tema laboral identificado (ej: Despido Injustificado, Retiro Justificado por falta de IPS, Horas Extras Nocturnas, Descuento de Caja, etc.)",
  "articulos_estimados": ["Art. 84", "Art. 195", "Decreto-Ley 1860/50"]
}}"""

    max_intentos = len(GROQ_KEYS) * 2
    for intento in range(max_intentos):
        key = GROQ_KEYS[_groq_key_index % len(GROQ_KEYS)]
        headers = {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
        payload = {
            'model': 'llama-3.3-70b-versatile',
            'messages': [
                {'role': 'system', 'content': 'Sos un clasificador estricto de consultas laborales paraguayas. Solo devolvés JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.1,
            'response_format': {'type': 'json_object'}
        }
        req = urllib.request.Request(
            'https://api.groq.com/openai/v1/chat/completions',
            headers=headers,
            data=json.dumps(payload).encode('utf-8')
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                res = json.loads(r.read().decode('utf-8'))
                content = res['choices'][0]['message']['content']
                return json.loads(content)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                print(f"  ⚠️ Groq Key #{(_groq_key_index % len(GROQ_KEYS)) + 1} saturada (HTTP {e.code}). Rotando key...")
                _groq_key_index += 1
                time.sleep(2)
            else:
                print(f"  ❌ Error HTTP Groq: {e.code} - {e.reason}")
                _groq_key_index += 1
        except Exception as e:
            print(f"  ⚠️ Error de conexión con Groq: {e}. Reintentando...")
            _groq_key_index += 1
            time.sleep(2)

    # Si todas las keys se saturaron, pausa de seguridad
    print("  🛑 Todas las keys de Groq alcanzaron rate limit. PAUSA AUTOMÁTICA de 15 segundos...")
    time.sleep(15)
    return {'oiko': False, 'motivo': 'Error o saturación en Groq tras reintentos', 'tema': 'Desconocido'}

# ---------------------------------------------------------------------------
# 7. EVALUADOR PERICIAL GEMINI 3.8 FLASH (CAPATAZ LOCAL) CON AUTO-PAUSA
# ---------------------------------------------------------------------------
def call_gemini_dictamen(comentario: str, tema: str, articulos: List[str]) -> Optional[str]:
    prompt = f"""Como perito laboral de LaboraPy en Paraguay, emití un dictamen pericial exacto para esta consulta real de TikTok:
Consulta: "{comentario}"
Tema preliminar: {tema}
Artículos sugeridos: {', '.join(articulos)}

Redactá la explicación pericial formal conforme a la Ley N.º 213/93 (Código del Trabajo de Paraguay), Ley 496/95 y normativas del IPS.
Indicá claramente:
1. Diagnóstico jurídico del caso.
2. Artículos legales aplicables exactos.
3. Qué le corresponde cobrar o reclamar (cálculo o base legal).
4. Estrategia táctica recomendada (MTESS, colacionado o reclamo judicial).
Sé directo, riguroso y sin rodeos."""

    headers = {
        'Authorization': f'Bearer {CAPATAZ_KEY}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': 'gemini-3.8-flash-high',
        'messages': [
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.2,
        'max_tokens': 600
    }
    req = urllib.request.Request(
        CAPATAZ_URL,
        headers=headers,
        data=json.dumps(payload).encode('utf-8')
    )

    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                res = json.loads(r.read().decode('utf-8'))
                return res['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503):
                print(f"  ⚠️ Capataz / Gemini 3.8 Flash saturado (HTTP {e.code}). PAUSA AUTOMÁTICA de 10s...")
                time.sleep(10)
            else:
                print(f"  ❌ Error HTTP Capataz: {e.code}")
                break
        except Exception as e:
            print(f"  ⚠️ Error Capataz: {e}. Reintentando en 5s...")
            time.sleep(5)
    return None

# ---------------------------------------------------------------------------
# 8. SCRAPING CONTROLADO EN APIFY (POR ABOGADO)
# ---------------------------------------------------------------------------
def raspar_abogado_apify(abogado_info: Dict[str, Any], max_videos: int = 25, comments_per_post: int = 20) -> List[Dict[str, Any]]:
    token = APIFY_TOKENS[abogado_info['token_index'] % len(APIFY_TOKENS)]
    usuario = abogado_info['usuario']
    nombre = abogado_info['nombre']
    
    print(f"\n🚜 Iniciando cosecha de @{usuario} ({nombre}) con Cuenta Apify #{abogado_info['token_index'] + 1}...")
    
    actor_id = 'GdWCkxBtKWOsKjdch'  # clockworks/tiktok-scraper
    run_input = {
        "profiles": [usuario],
        "resultsPerPage": max_videos,
        "commentsPerPost": comments_per_post,
        "profileScrapeSections": ["videos"],
        "profileSorting": "latest",
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
        "excludePinnedPosts": False
    }
    
    # 1. Iniciar la corrida en Apify
    url_run = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={token}"
    req = urllib.request.Request(
        url_run,
        headers={'Content-Type': 'application/json'},
        data=json.dumps(run_input).encode('utf-8')
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            run_data = json.loads(r.read().decode('utf-8'))['data']
            run_id = run_data['id']
            dataset_id = run_data['defaultDatasetId']
            print(f"  🎬 Corrida lanzada en Apify: {run_id} | Dataset: {dataset_id}")
    except Exception as e:
        print(f"  ❌ Error iniciando corrida para @{usuario}: {e}")
        return []

    # 2. Esperar a que termine la corrida (Polling cada 5s)
    url_status = f"https://api.apify.com/v2/actor-runs/{run_id}?token={token}"
    while True:
        time.sleep(5)
        try:
            req_st = urllib.request.Request(url_status)
            with urllib.request.urlopen(req_st, timeout=20) as r:
                st_data = json.loads(r.read().decode('utf-8'))['data']
                status = st_data['status']
                if status == 'SUCCEEDED':
                    cost = st_data.get('usageTotalUsd', 0)
                    print(f"  ✅ Corrida finalizada con éxito. Costo: ${cost:.4f} USD")
                    break
                elif status in ('FAILED', 'ABORTED', 'TIMED-OUT'):
                    print(f"  ❌ Corrida terminó con estado: {status}")
                    return []
                else:
                    print(f"  ⏳ Procesando en Apify (estado: {status})...")
        except Exception as e:
            print(f"  ⚠️ Error consultando estado de la corrida: {e}")

    # 3. Leer los items del dataset de videos y comentarios
    url_items = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={token}&clean=true"
    comentarios_cosechados = []
    try:
        with urllib.request.urlopen(urllib.request.Request(url_items), timeout=60) as r:
            items = json.loads(r.read().decode('utf-8'))
            print(f"  📦 Videos devueltos por Apify: {len(items)}")
            
            for it in items:
                v_url = it.get('webVideoUrl', '')
                c_url = it.get('commentsDatasetUrl')
                if c_url:
                    try:
                        with urllib.request.urlopen(urllib.request.Request(c_url), timeout=30) as cr:
                            c_list = json.loads(cr.read().decode('utf-8'))
                            for c in c_list:
                                txt = (c.get('text') or '').strip()
                                if txt:
                                    comentarios_cosechados.append({
                                        'abogado': usuario,
                                        'nombre_abogado': nombre,
                                        'comentario': txt,
                                        'video_url': v_url,
                                        'likes': c.get('diggCount', 0),
                                        'fecha': c.get('createTimeISO', ''),
                                        'autor': c.get('uniqueId', '')
                                    })
                    except Exception as e:
                        print(f"    ⚠️ Error leyendo comentarios de video: {e}")
    except Exception as e:
        print(f"  ❌ Error descargando dataset: {e}")

    print(f"  💬 Total comentarios crudos extraídos de @{usuario}: {len(comentarios_cosechados)}")
    return comentarios_cosechados

from concurrent.futures import ThreadPoolExecutor, as_completed

# ---------------------------------------------------------------------------
# 9. PIPELINE COMPLETO
# ---------------------------------------------------------------------------
def ejecutar_pipeline_completo():
    print("=" * 75)
    print("🌾 INICIANDO PIPELINE DE COSECHA & EVALUACIÓN 'OIKO O NO'")
    print(f"  • Cuentas Apify en Pool: {len(APIFY_TOKENS)} ($20.00 USD disponibles)")
    print(f"  • Keys de Groq en Pool : {len(GROQ_KEYS)} (LLaMA 3.3 70B con auto-pausa)")
    print(f"  • Capataz Gemini 3.8   : {CAPATAZ_URL}")
    print("=" * 75)

    todos_los_comentarios = []
    
    # 1. Cosecha distribuida y concurrente (los 5 abogados al mismo tiempo en Apify)
    print("\n🚀 Lanzando cosecha concurrente de los 5 abogados en Apify Cloud...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futuros = {
            executor.submit(raspar_abogado_apify, ab, 25, 25): ab['usuario']
            for ab in ABOGADOS_OBJETIVO
        }
        for fut in as_completed(futuros):
            usr = futuros[fut]
            try:
                comentarios_ab = fut.result()
                todos_los_comentarios.extend(comentarios_ab)
                print(f"  ✨ Finalizado @{usr}: {len(comentarios_ab)} comentarios aportados")
            except Exception as e:
                print(f"  ❌ Error en cosecha de @{usr}: {e}")

    print("\n" + "=" * 75)
    print(f"📊 RESUMEN COSECHA: {len(todos_los_comentarios)} comentarios crudos totales")
    print("=" * 75)

    # 2. Deduplicación por texto normalizado
    unicos = {}
    for c in todos_los_comentarios:
        clave = ' '.join(c['comentario'].lower().split())
        if clave not in unicos:
            unicos[clave] = c
        else:
            unicos[clave]['likes'] = max(unicos[clave].get('likes', 0), c.get('likes', 0))

    comentarios_unicos = list(unicos.values())
    print(f"✨ Comentarios únicos tras deduplicación: {len(comentarios_unicos)}")

    # 3. Evaluación Multi-Tier ("Oiko o No")
    casos_oiko = []
    casos_descartados = []

    print("\n⚖️ INICIANDO EVALUACIÓN PERICIAL CON GROQ & GEMINI 3.8 FLASH...")
    for idx, c in enumerate(comentarios_unicos, 1):
        txt = c['comentario']
        print(f"[{idx}/{len(comentarios_unicos)}] [@{c['abogado']}]: \"{txt[:60]}...\"", end=" -> ")

        # Tier 1: Heurístico
        pasa_h, motivo_h = filtro_heuristico_base(txt)
        if not pasa_h:
            print(f"🚫 NO OIKO ({motivo_h})")
            casos_descartados.append({**c, 'motivo_descarte': motivo_h, 'tier': 'heuristico'})
            continue

        # Tier 2: Groq LLaMA 3.3 70B
        eval_groq = call_groq_oiko(txt)
        if not eval_groq.get('oiko'):
            motivo_g = eval_groq.get('motivo', 'Descartado por Groq')
            print(f"🚫 NO OIKO ({motivo_g})")
            casos_descartados.append({**c, 'motivo_descarte': motivo_g, 'tier': 'groq'})
            continue

        # Tier 3: ¡OIKO! Generar dictamen pericial con Gemini 3.8 Flash
        tema = eval_groq.get('tema', 'Consulta Laboral')
        articulos = eval_groq.get('articulos_estimados', ['Ley 213/93'])
        print(f"✅ ¡OIKO! [{tema}]", end=" -> Dictaminando...")

        dictamen = call_gemini_dictamen(txt, tema, articulos)
        print(" OK!")

        casos_oiko.append({
            'id': len(casos_oiko) + 1,
            'abogado': c['abogado'],
            'nombre_abogado': c['nombre_abogado'],
            'comentario': txt,
            'video_url': c.get('video_url', ''),
            'likes': c.get('likes', 0),
            'fecha': c.get('fecha', ''),
            'tema': tema,
            'articulos': articulos,
            'evaluacion_groq': eval_groq,
            'dictamen_gemini': dictamen
        })

    print("\n" + "=" * 75)
    print(f"🏆 RESULTADO FINAL DEL PERITAJE:")
    print(f"  • Consultas laborales paraguayas puras (OIKO): {len(casos_oiko)}")
    print(f"  • Comentarios descartados (NO OIKO)         : {len(casos_descartados)}")
    print("=" * 75)

    # Guardar datasets en disco
    out_dir = ROOT_DIR / 'calculadora-rrhh-py' / 'datasets'
    out_dir.mkdir(exist_ok=True)

    with open(out_dir / 'consultas_5_abogados_oiko_final.json', 'w', encoding='utf-8') as f:
        json.dump(casos_oiko, f, ensure_ascii=False, indent=2)

    with open(out_dir / 'comentarios_5_abogados_descartados.json', 'w', encoding='utf-8') as f:
        json.dump(casos_descartados, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Datasets guardados exitosamente en:")
    print(f"   👉 {out_dir / 'consultas_5_abogados_oiko_final.json'}")
    print(f"   👉 {out_dir / 'comentarios_5_abogados_descartados.json'}")

if __name__ == '__main__':
    ejecutar_pipeline_completo()
