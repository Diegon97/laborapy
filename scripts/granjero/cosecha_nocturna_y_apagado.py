#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
PIPELINE NOCTURNO: EVALUACIÓN PERICIAL "OIKO O NO", WORD FINAL & APAGADO
=============================================================================
1. Evalúa los 1.434 comentarios únicos de los 5 abogados con Groq Pool (4 keys).
2. Genera dictámenes periciales (Ley 213/93) con Gemini 3.8 Flash (Capataz) con checkpointing.
3. Compila el Word oficial: DATASET_5_ABOGADOS_OIKO_FINAL_REVISION.docx.
4. Al completar al 100%, apaga la computadora: shutdown /s /t 60.
=============================================================================
"""

import os
import sys
import json
import time
import re
import urllib.request
import urllib.error
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = r'C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\calculadora-rrhh-py'
DATASETS_DIR = os.path.join(ROOT_DIR, 'datasets')
LOG_FILE = os.path.join(ROOT_DIR, 'cosecha_nocturna.log')
ENV_PATH = os.path.join(ROOT_DIR, '.env')

def log(msg: str):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

def cargar_env():
    env = {}
    if os.path.exists(ENV_PATH):
        for line in open(ENV_PATH, encoding='utf-8'):
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

ENV = cargar_env()

GROQ_KEYS = [
    ENV.get('GROQ_API_KEY_1'),
    ENV.get('GROQ_API_KEY_2'),
    ENV.get('GROQ_API_KEY_3'),
    ENV.get('GROQ_API_KEY_4')
]
GROQ_KEYS = [k for k in GROQ_KEYS if k]

CAPATAZ_URL = 'http://127.0.0.1:8317/v1/chat/completions'
CAPATAZ_KEY = 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8'

# 1. Filtro Heurístico
TERMINOS_EXTRANJEROS = [
    r'\bimss\b', r'\bafore\b', r'\blft\b', r'\bprofedet\b', r'\bconciliacion y arbitraje\b',
    r'\blct\b', r'\bart\b', r'\bafip\b', r'\banses\b', r'\bseclo\b', r'\bmonotributo\b',
    r'\bsmac\b', r'\bestatuto de los trabajadores\b', r'\bdireccion del trabajo chile\b',
    r'\bpesos\b', r'\bsoles\b', r'\bcolones\b', r'\beuros\b'
]

def filtro_heuristico(texto: str):
    t_lower = texto.lower()
    for pat in TERMINOS_EXTRANJEROS:
        if re.search(pat, t_lower):
            return False, f"Término extranjero: {pat}"
    if re.fullmatch(r'^(hola|buenas|saludos|jajaja|buen dia|dr|dra|doctor|doctora|😂😂😂|👍|👏)+[\s\.\?!]*$', t_lower):
        return False, "Solo saludo o reacción"
    return True, "OK"

# 2. Worker de Groq con reintentos y auto-pausa
def call_groq_worker(item_idx: int, item: Dict[str, Any], key: str):
    txt = item['comentario']
    prompt = f"""Sos un perito en derecho laboral de Paraguay (Ley N.º 213/93 del Código del Trabajo).
Analizá este comentario de TikTok de un abogado laboralista paraguayo:
"{txt}"

Determiná si el comentario "OIKO" (es consulta, duda o reclamo laboral real de Paraguay sobre despido, renuncia, liquidación, IPS, salario mínimo, horas extras, maltrato, faltantes de caja, estabilidad, embarazo, vacaciones, aguinaldo, etc.) o "NO_OIKO" (saludo, broma, comentario político, deuda comercial/banco no laboral, spam o extranjero).

Respondé EXCLUSIVAMENTE un JSON:
{{
  "oiko": true o false,
  "motivo": "explicación concisa",
  "tema": "tema laboral específico",
  "articulos_estimados": ["Art. 84", "Ley 213/93"]
}}"""

    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    }
    payload = {
        'model': 'llama-3.3-70b-versatile',
        'messages': [
            {'role': 'system', 'content': 'Sos un perito estricto en derecho laboral paraguayo. Solo devolvés JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.1,
        'response_format': {'type': 'json_object'}
    }

    for reintento in range(3):
        req = urllib.request.Request(
            'https://api.groq.com/openai/v1/chat/completions',
            headers=headers,
            data=json.dumps(payload).encode('utf-8')
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                res = json.loads(r.read().decode('utf-8'))
                content = res['choices'][0]['message']['content']
                eval_res = json.loads(content)
                return {'idx': item_idx, 'item': item, 'eval': eval_res, 'error': None}
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(5 + reintento * 5)
            else:
                return {'idx': item_idx, 'item': item, 'eval': {'oiko': False, 'motivo': f'HTTP {e.code}'}, 'error': str(e)}
        except Exception:
            time.sleep(3)

    return {'idx': item_idx, 'item': item, 'eval': {'oiko': False, 'motivo': 'Timeout/Saturación'}, 'error': 'Groq timeout'}

# 3. Dictamen Pericial Gemini 3.8 Flash (Capataz)
def call_gemini_dictamen(comentario: str, tema: str, articulos: List[str]):
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
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.2,
        'max_tokens': 600
    }

    for reintento in range(3):
        req = urllib.request.Request(
            CAPATAZ_URL,
            headers=headers,
            data=json.dumps(payload).encode('utf-8')
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                res = json.loads(r.read().decode('utf-8'))
                return res['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503):
                time.sleep(8)
            else:
                break
        except Exception:
            time.sleep(4)
    return None

def main():
    log("=================================================================")
    log("🌙 INICIANDO PIPELINE NOCTURNO COMPLETO (EVALUACIÓN + WORD + APAGADO)")
    log("=================================================================")

    input_file = os.path.join(DATASETS_DIR, 'comentarios_unicos_5_abogados_real.json')
    if not os.path.exists(input_file):
        log(f"❌ Error: no se encontró {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        comentarios = json.load(f)

    log(f"📦 Total comentarios únicos a procesar: {len(comentarios)}")

    # 1. Filtro Heurístico
    pasan_heuristico = []
    descartados_heuristico = []
    for idx, c in enumerate(comentarios):
        pasa, motivo = filtro_heuristico(c['comentario'])
        if pasa:
            pasan_heuristico.append((idx, c))
        else:
            descartados_heuristico.append({**c, 'motivo_descarte': motivo, 'tier': 'heuristico'})

    log(f"Filtro Heurístico: {len(pasan_heuristico)} pasan | {len(descartados_heuristico)} descartados")

    # 2. Evaluación con Groq Pool (4 hilos concurrentes)
    log(f"Evaluando con Groq LLaMA 3.3 70B (Pool de {len(GROQ_KEYS)} keys)...")
    evaluados_groq = []
    with ThreadPoolExecutor(max_workers=len(GROQ_KEYS)) as executor:
        futures = []
        for i, (orig_idx, item) in enumerate(pasan_heuristico):
            key = GROQ_KEYS[i % len(GROQ_KEYS)]
            futures.append(executor.submit(call_groq_worker, orig_idx, item, key))
            if i % 25 == 0 and i > 0:
                time.sleep(0.4)

        completados = 0
        for fut in as_completed(futures):
            res = fut.result()
            evaluados_groq.append(res)
            completados += 1
            if completados % 100 == 0 or completados == len(futures):
                log(f"  Groq Progreso: {completados}/{len(futures)} comentarios evaluados")

    casos_oiko_pre = []
    descartados_groq = []
    for r in evaluados_groq:
        item = r['item']
        ev = r['eval']
        if ev.get('oiko'):
            casos_oiko_pre.append({
                **item,
                'tema': ev.get('tema', 'Consulta Laboral'),
                'articulos': ev.get('articulos_estimados', ['Ley 213/93']),
                'motivo_groq': ev.get('motivo', '')
            })
        else:
            descartados_groq.append({
                **item,
                'motivo_descarte': ev.get('motivo', 'Descartado por Groq'),
                'tier': 'groq'
            })

    log(f"🏆 Consultas laborales confirmadas que OIKO: {len(casos_oiko_pre)}")
    log(f"🚫 Descartados por Groq: {len(descartados_groq)}")

    # Guardar descartados
    todos_descartados = descartados_heuristico + descartados_groq
    out_desc = os.path.join(DATASETS_DIR, 'comentarios_5_abogados_descartados.json')
    with open(out_desc, 'w', encoding='utf-8') as f:
        json.dump(todos_descartados, f, ensure_ascii=False, indent=2)

    # 3. Dictamen Pericial con Gemini 3.8 Flash (con checkpointing cada 10 casos)
    log(f"⚖️ Generando dictámenes periciales con Gemini 3.8 Flash para {len(casos_oiko_pre)} casos...")
    casos_oiko_final = []
    out_oiko = os.path.join(DATASETS_DIR, 'consultas_5_abogados_oiko_final.json')

    for idx, c in enumerate(casos_oiko_pre, 1):
        dictamen = call_gemini_dictamen(c['comentario'], c['tema'], c['articulos'])
        casos_oiko_final.append({
            'id': idx,
            'abogado': c['abogado'],
            'nombre_abogado': c.get('nombre_abogado', c['abogado']),
            'comentario': c['comentario'],
            'video_url': c.get('video_url', ''),
            'likes': c.get('likes', 0),
            'fecha': c.get('fecha', ''),
            'tema': c['tema'],
            'articulos': c['articulos'],
            'motivo_oiko': c['motivo_groq'],
            'dictamen_gemini': dictamen
        })

        if idx % 10 == 0 or idx == len(casos_oiko_pre):
            # Checkpoint en disco
            with open(out_oiko, 'w', encoding='utf-8') as f:
                json.dump(casos_oiko_final, f, ensure_ascii=False, indent=2)
            log(f"  Gemini Progreso: {idx}/{len(casos_oiko_pre)} dictámenes completados (Checkpoint guardado)")

        time.sleep(0.4)

    log(f"✅ Todos los dictámenes finalizados y guardados en {out_oiko}")

    # 4. Generar el Documento Word Final
    log("📄 Compilando documento Word final interactivo...")
    script_word = os.path.join(ROOT_DIR, 'scripts', 'granjero', 'generar_word_oiko_final.mjs')
    res_word = subprocess.run(['node', script_word], capture_output=True, text=True, cwd=ROOT_DIR)
    log(f"Salida Word generator: {res_word.stdout.strip()}")
    if res_word.stderr:
        log(f"Stderr Word generator: {res_word.stderr.strip()}")

    word_file = r'C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\DATASET_5_ABOGADOS_OIKO_FINAL_REVISION.docx'
    if os.path.exists(word_file) and os.path.getsize(word_file) > 10000:
        log(f"🎉 DOCUMENTO WORD VERIFICADO CON ÉXITO: {word_file} ({os.path.getsize(word_file)} bytes)")
        log("=================================================================")
        log("💤 TRABAJO COMPLETADO AL 100%. APAGANDO COMPUTADORA EN 60 SEGUNDOS...")
        log("=================================================================")
        # Apagado programado en 60 segundos
        subprocess.run(['shutdown', '/s', '/t', '60', '/c', 'LaboraPy: Cosecha y dataset de 5 abogados completados al 100%. Buenas noches Diego.'])
    else:
        log("⚠️ Advertencia: No se pudo verificar el archivo Word final. No se ejecutará shutdown para preservar datos.")

if __name__ == '__main__':
    main()
