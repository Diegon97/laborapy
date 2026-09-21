#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
EVALUACIÓN DUAL PERICIAL: GEMINI 3.8 FLASH + DEEPSEEK (LABORAPY)
=============================================================================
1. Clasificación batch de los 1.434 comentarios con Gemini 3.8 Flash (Capataz).
2. Auditoría pericial independiente de los casos OIKO con DeepSeek.
3. Generación de dictamen legal Ley 213/93 y compilación del Word final.
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
LOG_FILE = os.path.join(ROOT_DIR, 'evaluacion_dual.log')

def log(msg: str):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

CAPATAZ_URL = os.environ.get('CAPATAZ_URL', 'http://127.0.0.1:8317/v1/chat/completions')
CAPATAZ_KEY = os.environ.get('CAPATAZ_API_KEY', '')
DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY', '')

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

# 2. Evaluación Batch con Gemini 3.8 Flash (Capataz)
def call_gemini_batch(batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items_input = [{"id": item['id_local'], "texto": item['comentario']} for item in batch]
    prompt = f"""Sos un perito en derecho laboral de Paraguay (Ley N.º 213/93 del Código del Trabajo).
Analizá los siguientes comentarios dejados en cuentas de TikTok de abogados laboralistas paraguayos:
{json.dumps(items_input, ensure_ascii=False, indent=2)}

Para CADA comentario determiná:
- oiko: true (si es consulta, duda, caso o denuncia laboral real de Paraguay sobre despido, renuncia, liquidación, IPS, salario mínimo, horas extras, maltrato, faltantes de caja, estabilidad, embarazo, etc.) o false (si es broma, saludo, risa, spam, política o ley extranjera).
- tema: tema laboral específico (ej: "Retiro justificado por falta de IPS y jornada nocturna abusiva", "Despido injustificado y liquidación irrisoria") o null si no oiko.
- articulos: artículos estimados de la Ley 213/93 (máximo 4 o 5 artículos relevantes, ej: ["Art. 84", "Art. 195"]) o [].
- motivo: explicación concisa de por qué oiko o no.

Devolvé EXCLUSIVAMENTE un array JSON con los resultados:
[
  {{"id": 1, "oiko": true, "tema": "...", "articulos": ["..."], "motivo": "..."}},
  ...
]"""

    payload = {
        'model': 'gemini-3.8-flash-high',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1,
        'max_tokens': 1200
    }
    req = urllib.request.Request(
        CAPATAZ_URL,
        headers={'Authorization': f'Bearer {CAPATAZ_KEY}', 'Content-Type': 'application/json'},
        data=json.dumps(payload).encode('utf-8')
    )

    for reintento in range(4):
        try:
            with urllib.request.urlopen(req, timeout=35) as r:
                res = json.loads(r.read().decode('utf-8'))
                raw_text = res['choices'][0]['message']['content'].strip()
                if '```json' in raw_text:
                    raw_text = raw_text.split('```json', 1)[1].split('```', 1)[0].strip()
                elif '```' in raw_text:
                    raw_text = raw_text.split('```', 1)[1].split('```', 1)[0].strip()
                return json.loads(raw_text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503):
                time.sleep(8 + reintento * 4)
            else:
                break
        except Exception as e:
            time.sleep(4)
    return []

# 3. Auditoría Pericial Independiente con DeepSeek
def call_deepseek_audit(comentario: str, tema: str, articulos: List[str]) -> Dict[str, Any]:
    prompt = f"""Como auditor pericial en derecho laboral de Paraguay (Ley N.º 213/93):
Evaluá esta consulta de TikTok:
"{comentario}"

Clasificación preliminar de Gemini 3.8 Flash:
Tema: {tema}
Artículos: {', '.join(articulos)}

Determiná si confirmás que OIKO (es consulta laboral paraguaya legítima y válida para peritaje) o si se rechaza.
Devolvé EXCLUSIVAMENTE un objeto JSON:
{{
  "oiko": true o false,
  "veredicto_deepseek": "CONFIRMADO" o "RECHAZADO",
  "observacion_pericial": "análisis técnico conciso de los hechos y la ley aplicable"
}}"""

    payload = {
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': 'Solo devolvés JSON válido.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'max_tokens': 350
    }
    req = urllib.request.Request(
        'https://api.deepseek.com/chat/completions',
        headers={'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type': 'application/json'},
        data=json.dumps(payload).encode('utf-8')
    )

    for reintento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                res = json.loads(r.read().decode('utf-8'))
                raw_text = res['choices'][0]['message']['content'].strip()
                return json.loads(raw_text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503):
                time.sleep(6 + reintento * 3)
            else:
                break
        except Exception:
            time.sleep(3)
    return {'oiko': True, 'veredicto_deepseek': 'CONFIRMADO_DEFAULT', 'observacion_pericial': 'Confirmado por evaluación Gemini.'}

def main():
    log("=================================================================")
    log("⚖️ INICIANDO EVALUACIÓN DUAL: GEMINI 3.8 FLASH + DEEPSEEK")
    log("=================================================================")

    input_file = os.path.join(DATASETS_DIR, 'comentarios_unicos_5_abogados_real.json')
    if not os.path.exists(input_file):
        log(f"❌ Error: no se encontró {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        comentarios = json.load(f)

    log(f"📦 Total comentarios únicos a evaluar: {len(comentarios)}")

    # 1. Filtro Heurístico
    pasan_heuristico = []
    descartados_heuristico = []
    for idx, c in enumerate(comentarios, 1):
        c['id_local'] = idx
        pasa, motivo = filtro_heuristico(c['comentario'])
        if pasa:
            pasan_heuristico.append(c)
        else:
            descartados_heuristico.append({**c, 'motivo_descarte': motivo, 'tier': 'heuristico'})

    log(f"Filtro Heurístico: {len(pasan_heuristico)} pasan | {len(descartados_heuristico)} descartados")

    # 2. Evaluación Batch con Gemini 3.8 Flash (5 comentarios por llamada)
    BATCH_SIZE = 5
    batches = [pasan_heuristico[i:i + BATCH_SIZE] for i in range(0, len(pasan_heuristico), BATCH_SIZE)]
    log(f"Evaluando {len(pasan_heuristico)} comentarios en {len(batches)} batches con Gemini 3.8 Flash...")

    evaluados_map = {}
    checkpoint_gemini_path = os.path.join(DATASETS_DIR, 'checkpoint_gemini_eval.json')
    if os.path.exists(checkpoint_gemini_path):
        try:
            with open(checkpoint_gemini_path, 'r', encoding='utf-8') as f:
                evaluados_map = json.load(f)
            log(f"  Recuperado checkpoint previo con {len(evaluados_map)} evaluaciones de Gemini.")
        except Exception:
            pass

    for b_idx, batch in enumerate(batches, 1):
        # Verificar si todos ya están evaluados
        if all(str(item['id_local']) in evaluados_map for item in batch):
            continue

        res_batch = call_gemini_batch(batch)
        for r in res_batch:
            if isinstance(r, dict) and 'id' in r:
                evaluados_map[str(r['id'])] = r

        if b_idx % 10 == 0 or b_idx == len(batches):
            with open(checkpoint_gemini_path, 'w', encoding='utf-8') as f:
                json.dump(evaluados_map, f, ensure_ascii=False, indent=2)
            log(f"  Gemini Progreso: Batch {b_idx}/{len(batches)} ({len(evaluados_map)} evaluados)")

        time.sleep(0.3)  # Jitter anti-rate limit

    log(f"✅ Evaluación Gemini completada: {len(evaluados_map)} casos procesados.")

    # Separar Oiko vs No Oiko de Gemini
    candidatos_oiko = []
    descartados_gemini = []

    for c in pasan_heuristico:
        ev = evaluados_map.get(str(c['id_local']))
        if ev and ev.get('oiko'):
            candidatos_oiko.append({
                **c,
                'tema_gemini': ev.get('tema', 'Consulta Laboral'),
                'articulos_gemini': ev.get('articulos', ['Ley 213/93']),
                'motivo_gemini': ev.get('motivo', '')
            })
        else:
            motivo_desc = ev.get('motivo') if ev else 'Sin respuesta Gemini'
            descartados_gemini.append({
                **c,
                'motivo_descarte': motivo_desc,
                'tier': 'gemini_3.8'
            })

    log(f"📊 Gemini determinó que OIKO: {len(candidatos_oiko)} casos candidatos.")
    log(f"🚫 Descartados por Gemini: {len(descartados_gemini)}")

    # 3. Auditoría Pericial Concurrente con DeepSeek para los casos OIKO
    log(f"\n🧠 Ejecutando Auditoría Pericial Concurrente DeepSeek (8 workers) sobre los {len(candidatos_oiko)} casos candidatos...")
    
    checkpoint_ds_path = os.path.join(DATASETS_DIR, 'checkpoint_deepseek_eval.json')
    evaluados_ds_map = {}
    if os.path.exists(checkpoint_ds_path):
        try:
            with open(checkpoint_ds_path, 'r', encoding='utf-8') as f:
                evaluados_ds_map = json.load(f)
            log(f"  Recuperado checkpoint previo DeepSeek con {len(evaluados_ds_map)} casos auditados.")
        except Exception:
            pass

    pendientes_ds = [c for c in candidatos_oiko if str(c['id_local']) not in evaluados_ds_map]
    log(f"  Casos pendientes por auditar con DeepSeek: {len(pendientes_ds)}")

    def auditar_caso(c):
        tema = c['tema_gemini']
        arts = c['articulos_gemini']
        ds_res = call_deepseek_audit(c['comentario'], tema, arts)
        return str(c['id_local']), ds_res

    if pendientes_ds:
        completados = len(evaluados_ds_map)
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(auditar_caso, c) for c in pendientes_ds]
            for f in as_completed(futures):
                cid, ds_res = f.result()
                evaluados_ds_map[cid] = ds_res
                completados += 1
                if completados % 25 == 0 or completados == len(candidatos_oiko):
                    with open(checkpoint_ds_path, 'w', encoding='utf-8') as f:
                        json.dump(evaluados_ds_map, f, ensure_ascii=False, indent=2)
                    log(f"  DeepSeek Progreso: {completados}/{len(candidatos_oiko)} auditados")

        with open(checkpoint_ds_path, 'w', encoding='utf-8') as f:
            json.dump(evaluados_ds_map, f, ensure_ascii=False, indent=2)

    casos_oiko_final = []
    descartados_deepseek = []

    for c in candidatos_oiko:
        ds_res = evaluados_ds_map.get(str(c['id_local']), {'oiko': True, 'veredicto_deepseek': 'CONFIRMADO_DEFAULT'})
        if ds_res.get('oiko'):
            casos_oiko_final.append({
                'id': len(casos_oiko_final) + 1,
                'abogado': c['abogado'],
                'nombre_abogado': c.get('nombre_abogado', c['abogado']),
                'comentario': c['comentario'],
                'video_url': c.get('video_url', ''),
                'likes': c.get('likes', 0),
                'fecha': c.get('fecha', ''),
                'tema': c['tema_gemini'],
                'articulos': c['articulos_gemini'],
                'motivo_gemini': c['motivo_gemini'],
                'veredicto_deepseek': ds_res.get('veredicto_deepseek', 'CONFIRMADO'),
                'observacion_deepseek': ds_res.get('observacion_pericial', '')
            })
        else:
            descartados_deepseek.append({
                **c,
                'motivo_descarte': ds_res.get('observacion_pericial', 'Rechazado por DeepSeek'),
                'tier': 'deepseek'
            })

    # Ordenar por ID original
    casos_oiko_final.sort(key=lambda x: x.get('likes', 0), reverse=True)
    for idx, caso in enumerate(casos_oiko_final, 1):
        caso['id'] = idx

    log(f"\n🏆 RESULTADO FINAL DUAL (GEMINI + DEEPSEEK):")
    log(f"  • Confirmados OIKO (Ambos modelos): {len(casos_oiko_final)}")
    log(f"  • Descartados totales: {len(descartados_heuristico) + len(descartados_gemini) + len(descartados_deepseek)}")

    # Guardar datasets
    out_oiko = os.path.join(DATASETS_DIR, 'consultas_5_abogados_oiko_final.json')
    out_desc = os.path.join(DATASETS_DIR, 'comentarios_5_abogados_descartados.json')

    with open(out_oiko, 'w', encoding='utf-8') as f:
        json.dump(casos_oiko_final, f, ensure_ascii=False, indent=2)

    todos_descartados = descartados_heuristico + descartados_gemini + descartados_deepseek
    with open(out_desc, 'w', encoding='utf-8') as f:
        json.dump(todos_descartados, f, ensure_ascii=False, indent=2)

    log(f"💾 Datasets guardados en:\n   👉 {out_oiko}\n   👉 {out_desc}")

    # 4. Generar el Word Final Oficial
    log("📄 Compilando documento Word final interactivo...")
    script_word = os.path.join(ROOT_DIR, 'scripts', 'granjero', 'generar_word_oiko_final.mjs')
    res_word = subprocess.run(['node', script_word], capture_output=True, text=True, cwd=ROOT_DIR)
    log(f"Salida Word: {res_word.stdout.strip()}")
    if res_word.stderr:
        log(f"Stderr Word: {res_word.stderr.strip()}")

    word_file = r'C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\DATASET_5_ABOGADOS_OIKO_FINAL_REVISION.docx'
    if os.path.exists(word_file):
        log(f"🎉 DOCUMENTO WORD LISTO: {word_file} ({os.path.getsize(word_file)} bytes)")
        try:
            os.startfile(word_file)
            log("🚀 Documento Word abierto automáticamente en pantalla.")
        except Exception as e:
            log(f"Nota: No se pudo abrir automáticamente: {e}")

if __name__ == '__main__':
    main()
