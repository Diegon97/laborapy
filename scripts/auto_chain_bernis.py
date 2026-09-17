import os, sys, time, json, requests

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

GROQ_KEY = os.environ.get('GROQ_API_KEY')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://wbbcqololvxlnmxajurd.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not GROQ_KEY or not SUPABASE_SERVICE_KEY:
    print('[Config] Faltan variables de entorno: GROQ_API_KEY y/o SUPABASE_SERVICE_ROLE_KEY.', file=sys.stderr)
    sys.exit(1)
BERNIS_ID = '4119f45e-dd71-4de6-84e2-d61565fdda6c'

AUDIO_DIR = 'audios/bernis'
STATE_FILE = 'ingestion_state_bernis.json'
PROGRESS_FILE = 'ingestion_progress_bernis.json'
YAMPEY_PROGRESS = 'ingestion_progress.json'

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"processed": {}, "failed": {}}
    return {"processed": {}, "failed": {}}

def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

def update_progress_file(total, processed, failed, last_audio, last_title):
    pct = round((processed / total) * 100, 1) if total > 0 else 0
    info = {
        "autor": "@juanbernis",
        "total": total,
        "processed": processed,
        "remaining": total - processed,
        "failed": failed,
        "percent": pct,
        "last_audio": last_audio,
        "last_title": last_title,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2, ensure_ascii=False)

def transcribe_whisper(file_path):
    with open(file_path, 'rb') as f:
        resp = requests.post(
            'https://api.groq.com/openai/v1/audio/transcriptions',
            headers={'Authorization': f'Bearer {GROQ_KEY}'},
            files={'file': (os.path.basename(file_path), f, 'audio/mp3')},
            data={'model': 'whisper-large-v3-turbo', 'language': 'es'},
            timeout=25
        )
    if resp.status_code == 429:
        time.sleep(5)
        return transcribe_whisper(file_path)
    resp.raise_for_status()
    return resp.json().get('text', '').strip()

def analyze_legal(transcript):
    prompt = f"""Analizá esta transcripción de un video del abogado laboralista Juan Bernis sobre el derecho laboral de Paraguay:
"{transcript}"

Devolvé ÚNICAMENTE un JSON válido con esta estructura:
{{
  "titulo_tema": "Título breve y descriptivo (máx 150 caracteres)",
  "caso_abuso_detectado": "Detalle de la situación, abuso patronal o consulta del trabajador planteada",
  "fundamento_juridico": "Artículos y leyes paraguayas aplicables (ej: Art. 19 Código del Trabajo Ley 213/93, Ley 1860/50 IPS)",
  "criterio_practico": "Consejo y criterio concreto: qué debe hacer el trabajador o qué dictamina la ley",
  "articulos_citados": ["Art. ..."]
}}"""

    resp = requests.post(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={'Authorization': f'Bearer {GROQ_KEY}', 'Content-Type': 'application/json'},
        json={
            'model': 'openai/gpt-oss-120b',
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay. Responde estrictamente en JSON válido.'},
                {'role': 'user', 'content': prompt}
            ]
        },
        timeout=20
    )
    if resp.status_code == 429:
        time.sleep(5)
        return analyze_legal(transcript)
    resp.raise_for_status()
    raw = resp.json()['choices'][0]['message']['content']
    return json.loads(raw)

def insert_supabase(title, transcript, analysis, file_name):
    insert_data = {
        'autor_id': BERNIS_ID,
        'plataforma': 'tiktok',
        'titulo_tema': (analysis.get('titulo_tema') or file_name)[:300],
        'audio_transcripcion': transcript,
        'caso_abuso_detectado': analysis.get('caso_abuso_detectado', ''),
        'fundamento_juridico': analysis.get('fundamento_juridico', ''),
        'criterio_practico': analysis.get('criterio_practico', ''),
        'articulos_citados': [str(a) for a in analysis.get('articulos_citados', [])],
        'metadata': {'file': file_name, 'ingested_via': 'groq_lpu'},
        'activo': True
    }
    resp = requests.post(
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
    resp.raise_for_status()
    return resp.json()[0]['id']

def run_bernis_ingestion():
    if not os.path.exists(AUDIO_DIR):
        print(f"Carpeta {AUDIO_DIR} no encontrada.", flush=True)
        return

    all_files = sorted([f for f in os.listdir(AUDIO_DIR) if f.lower().endswith('.mp3')])
    total = len(all_files)
    state = load_state()
    pending = [f for f in all_files if f not in state['processed']]

    print(f"\n🚀 === ARRANCANDO INGESTA DE BERNIS ===", flush=True)
    print(f"Total audios: {total} | Ya procesados: {len(state['processed'])} | Pendientes: {len(pending)}", flush=True)

    start_time = time.time()
    last_report = time.time()
    success_count = len(state['processed'])
    fail_count = len(state['failed'])

    for idx, f in enumerate(pending, 1):
        file_path = os.path.join(AUDIO_DIR, f)
        t_item = time.time()
        try:
            transcript = transcribe_whisper(file_path)
            if not transcript or len(transcript) < 10:
                raise Exception("Transcripción vacía")

            analysis = analyze_legal(transcript)
            row_id = insert_supabase(analysis.get('titulo_tema', f), transcript, analysis, f)

            state['processed'][f] = {
                'id': row_id,
                'title': analysis.get('titulo_tema'),
                'time_s': round(time.time() - t_item, 2),
                'at': time.strftime("%Y-%m-%d %H:%M:%S")
            }
            if f in state['failed']:
                del state['failed'][f]
            save_state(state)

            success_count += 1
            duration = time.time() - t_item
            title_short = (analysis.get('titulo_tema') or f)[:45]
            print(f"[Bernis {success_count}/{total}] OK ({duration:.1f}s) -> {title_short}", flush=True)
            update_progress_file(total, success_count, fail_count, f, title_short)

            time.sleep(2.0)

        except Exception as e:
            print(f"[Bernis ERROR] en {f}: {str(e)[:80]}", flush=True)
            state['failed'][f] = {'error': str(e), 'at': time.strftime("%Y-%m-%d %H:%M:%S")}
            save_state(state)
            fail_count += 1
            time.sleep(3.0)

        if time.time() - last_report >= 60:
            last_report = time.time()
            elapsed = time.time() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            rem_secs = (len(pending) - idx) / rate if rate > 0 else 0
            pct = (success_count / total) * 100
            print(f"\n--- [REPORTE BERNIS MINUTO A MINUTO] ---", flush=True)
            print(f"Progreso: {success_count}/{total} ({pct:.1f}%) | Errores: {fail_count}", flush=True)
            print(f"Velocidad: {rate*60:.1f} audios/min | Estimado restante: {rem_secs/60:.1f} min", flush=True)
            print(f"---------------------------------------\n", flush=True)

    print(f"🎉 INGESTA DE BERNIS FINALIZADA: {success_count} procesados, {fail_count} fallos.", flush=True)

def wait_for_yampey_then_run():
    print("Esperando a que termine el lote de Yampey para iniciar Bernis automáticamente...", flush=True)
    while True:
        if os.path.exists(YAMPEY_PROGRESS):
            try:
                with open(YAMPEY_PROGRESS, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data.get('remaining', 1) == 0:
                        print("✅ ¡Lote de Yampey completado al 100%! Iniciando Bernis de inmediato...", flush=True)
                        break
            except:
                pass
        time.sleep(10)
    run_bernis_ingestion()

if __name__ == '__main__':
    wait_for_yampey_then_run()
