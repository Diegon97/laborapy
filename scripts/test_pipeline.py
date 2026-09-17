import os, sys, time, json, requests

GROQ_KEY = os.environ.get('GROQ_API_KEY')
DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://wbbcqololvxlnmxajurd.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not GROQ_KEY or not SUPABASE_SERVICE_KEY:
    print('[Config] Faltan variables de entorno: GROQ_API_KEY y/o SUPABASE_SERVICE_ROLE_KEY.', file=sys.stderr)
    sys.exit(1)
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

audio_file = 'audios/yampey/4 DERECHOS BASICOS.mp3'

print(f"[1/3] Transcribiendo con Groq Whisper ({audio_file})...", flush=True)
t0 = time.time()
with open(audio_file, 'rb') as f:
    resp = requests.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        headers={'Authorization': f'Bearer {GROQ_KEY}'},
        files={'file': ('audio.mp3', f, 'audio/mp3')},
        data={'model': 'whisper-large-v3-turbo', 'language': 'es'},
        timeout=20
    )
resp.raise_for_status()
transcript = resp.json().get('text', '')
t_whisper = time.time() - t0
print(f"✅ Transcripción lista en {t_whisper:.2f}s: \"{transcript[:70]}...\"", flush=True)

print("[2/3] Analizando jurídicamente con Groq Llama 3.3 70B...", flush=True)
t1 = time.time()
prompt = f"""Analizá esta transcripción de un video del abogado laboralista Ernesto Yampey sobre el derecho laboral de Paraguay:
"{transcript}"

Devolvé ÚNICAMENTE un JSON válido con esta estructura:
{{
  "titulo_tema": "Título breve y descriptivo (máx 150 caracteres)",
  "caso_abuso_detectado": "Detalle de la situación, abuso patronal o consulta del trabajador planteada",
  "fundamento_juridico": "Artículos y leyes paraguayas aplicables (ej: Art. 19 Código del Trabajo Ley 213/93, Ley 1860/50 IPS)",
  "criterio_practico": "Consejo y criterio concreto: qué debe hacer el trabajador o qué dictamina la ley",
  "articulos_citados": ["Art. ..."]
}}"""

resp_llm = requests.post(
    'https://api.groq.com/openai/v1/chat/completions',
    headers={'Authorization': f'Bearer {GROQ_KEY}', 'Content-Type': 'application/json'},
    json={
        'model': 'llama-3.3-70b-versatile',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay. Responde en JSON válido.'},
            {'role': 'user', 'content': prompt}
        ]
    },
    timeout=15
)
resp_llm.raise_for_status()
raw_json = resp_llm.json()['choices'][0]['message']['content']
analysis = json.loads(raw_json)
t_llm = time.time() - t1
print(f"✅ Análisis jurídico listo en {t_llm:.2f}s:", flush=True)
print(f"   Título: {analysis.get('titulo_tema')}", flush=True)
print(f"   Abuso: {analysis.get('caso_abuso_detectado')}", flush=True)
print(f"   Fundamento: {analysis.get('fundamento_juridico')}", flush=True)
print(f"   Criterio: {analysis.get('criterio_practico')}", flush=True)
print(f"   Artículos: {analysis.get('articulos_citados')}", flush=True)

print("[3/3] Guardando en Supabase...", flush=True)
t2 = time.time()
insert_data = {
    'autor_id': YAMPEY_ID,
    'plataforma': 'tiktok',
    'titulo_tema': analysis.get('titulo_tema', '4 Derechos Básicos')[:300],
    'audio_transcripcion': transcript,
    'caso_abuso_detectado': analysis.get('caso_abuso_detectado', ''),
    'fundamento_juridico': analysis.get('fundamento_juridico', ''),
    'criterio_practico': analysis.get('criterio_practico', ''),
    'articulos_citados': analysis.get('articulos_citados', []),
    'metadata': {'file': '4 DERECHOS BASICOS.mp3', 'whisper_s': t_whisper, 'deepseek_s': t_llm},
    'activo': True
}

resp_sub = requests.post(
    f"{SUPABASE_URL}/rest/v1/jurisprudencia_multimedia",
    headers={
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    },
    json=insert_data,
    timeout=15
)
resp_sub.raise_for_status()
inserted_row = resp_sub.json()[0]
t_sub = time.time() - t2
print(f"✅ Guardado en Supabase en {t_sub:.2f}s con ID: {inserted_row.get('id')}", flush=True)
print(f"\n🎉 TIEMPO TOTAL PIPELINE: {time.time() - t0:.2f}s", flush=True)
