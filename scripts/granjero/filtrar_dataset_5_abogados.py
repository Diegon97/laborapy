#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Descargador y Filtrador de los 6,280 comentarios de los 5 Abogados Laboralistas de Paraguay
Dataset ID: gPqsq8jIfnpmvkyl3
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import json
import requests
from pathlib import Path
from apify_client import ApifyClient

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from cosechador_redes_py import es_comentario_paraguayo_valido
from bot_autonomo_redes import get_apify_token

TOKEN = get_apify_token()
client = ApifyClient(TOKEN)

DATASET_ID = "gPqsq8jIfnpmvkyl3"
print(f"📥 Conectando al Dataset de Apify: {DATASET_ID}...")

dataset = client.dataset(DATASET_ID)
items = list(dataset.iterate_items())
print(f"🎬 Videos scrapeados: {len(items)}")

comentarios_por_autor = {}
comentarios_unicos = set()
consultas_validas_py = []
descartados = 0

for it in items:
    author = it.get('authorMeta', {}).get('name', 'desconocido')
    url = it.get('commentsDatasetUrl')
    v_url = it.get('webVideoUrl', '')
    
    if url:
        try:
            r = requests.get(url, timeout=20)
            if r.status_code == 200:
                for c in r.json():
                    texto = c.get('text', '').strip()
                    if texto and texto not in comentarios_unicos:
                        comentarios_unicos.add(texto)
                        comentarios_por_autor[author] = comentarios_por_autor.get(author, 0) + 1
                        
                        # Filtro 100% Ley Paraguaya
                        es_valido, motivo = es_comentario_paraguayo_valido(texto)
                        if es_valido:
                            consultas_validas_py.append({
                                'abogado': author,
                                'consulta': texto,
                                'video_url': v_url
                            })
                        else:
                            descartados += 1
        except Exception as e:
            print(f"  ⚠️ Error en video: {e}")

print("\n=======================================================")
print(f"📊 Total comentarios únicos analizados: {len(comentarios_unicos)}")
print(f"✅ Consultas laborales paraguayas puras (filtradas): {len(consultas_validas_py)}")
print(f"🚫 Descartados (spam / otros países): {descartados}")
print("=======================================================\n")

for auth, cnt in comentarios_por_autor.items():
    print(f"  - @{auth}: {cnt} comentarios únicos")

# Guardar dataset limpio en disco
out_dir = Path(__file__).resolve().parent.parent.parent / "datasets"
out_dir.mkdir(exist_ok=True)
out_file = out_dir / "consultas_laborales_5_abogados_py.json"

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(consultas_validas_py, f, indent=2, ensure_ascii=False)

print(f"\n📁 Dataset de consultas de Paraguay guardado exitosamente en:")
print(f"   👉 {out_file}")

# Mostrar 5 ejemplos de consultas reales filtradas
print("\n🌟 Muestra de Consultas Reales de la Gente:")
for idx, c in enumerate(consultas_validas_py[:10], 1):
    print(f"{idx}. [@{c['abogado']}]: \"{c['consulta']}\"")
