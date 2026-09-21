#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Radar de Inteligencia de Mercado Laboral Paraguayo — TikTok Trends
Analiza los comentarios crudos de los 5 abogados con Gemini 3.8 Flash (Capataz)
y extrae:
1. Dolores #1 del mercado (Pain Points más frecuentes)
2. Sectores y empresas más denunciadas
3. Oportunidades de negocio y monetización para LaboraPy
4. Ideas de contenido viral y anuncios para WhatsApp
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import json
import re
import requests
from pathlib import Path

CAPATAZ_URL = 'http://127.0.0.1:8317/v1/chat/completions'
CAPATAZ_KEY = 'cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8'

raw_file = Path('datasets/comentarios_crudos_5_abogados.json')
if not raw_file.exists():
    print("❌ No se encontró el archivo de comentarios crudos.")
    sys.exit(1)

with open(raw_file, 'r', encoding='utf-8') as f:
    comentarios = json.load(f)

print(f"📊 Analizando {len(comentarios)} comentarios reales de TikTok...")

# Tomar muestra representativa de textos para el análisis de tendencias
textos_muestra = [c['comentario'] for c in comentarios if len(c['comentario']) > 20][:150]
corpus = "\n---\n".join(textos_muestra)

prompt = f"""Sos el Director de Estrategia de Negocio y CPO de LaboraPy (fundada por Diego Núñez en Paraguay).
Analizá este corpus de 150 comentarios reales de ciudadanos paraguayos en videos de TikTok de los principales abogados laboralistas (Yampey, Bernis, Dahiana Avalos, Jorge Fleitas, Clara López):

COMENTARIOS REALES:
{corpus}

Generá un INFORME EJECUTIVO DE INTELIGENCIA DE MERCADO Y TENDENCIAS en formato JSON válido con:
1. "top_dolores_frecuentes": Lista de los 5 problemas más comunes que sufre la gente (con % estimado de interés y por qué les duele).
2. "sectores_criticos": Rubros o tipos de empresas más mencionados (ej: súper, call centers, farmacias, transporte).
3. "productos_laborapy_a_vender": Qué servicio o cálculo de LaboraPy resuelve ese dolor (Finiquito Blindado, Auditoría Pre-MTESS, Demanda con patrocinio).
4. "ideas_anuncios_virales_whatsapp": 3 ganchos para videos cortos / anuncios de WhatsApp que atraigan clientes directo al WhatsApp de Diego (+595 984 469 005).
5. "resumen_estrategico": 3 líneas con la conclusión ejecutiva para monetizar esta tendencia.
"""

resp = requests.post(
    CAPATAZ_URL,
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {CAPATAZ_KEY}'
    },
    json={
        'model': 'gemini-3.8-flash-high',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': 'Sos el Director de Estrategia y Monetización de LaboraPy. Respondés estrictamente en JSON válido.'},
            {'role': 'user', 'content': prompt}
        ]
    },
    timeout=60
)

if resp.status_code == 200:
    content = resp.json()['choices'][0]['message']['content']
    clean_json = re.sub(r'^```(?:json)?\s*|\s*```$', '', content.strip(), flags=re.MULTILINE)
    data = json.loads(clean_json)
    
    out_file = Path('datasets/radar_tendencias_tiktok_py.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("\n✅ INFORME DE INTELIGENCIA GENERADO:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
else:
    print(f"❌ Error Capataz: {resp.status_code} {resp.text}")
