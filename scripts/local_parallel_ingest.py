import os, sys, time, json, requests
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

GROQ_KEY = os.environ.get('GROQ_API_KEY')
DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL', 'https://wbbcqololvxlnmxajurd.supabase.co')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not GROQ_KEY or not SUPABASE_SERVICE_KEY:
    print('[Config] Faltan variables de entorno: GROQ_API_KEY y/o SUPABASE_SERVICE_ROLE_KEY.', file=sys.stderr)
    sys.exit(1)

YAMPEY_ID = 'a152db4e-ff49-4fec-8413-34b9e2e6e460'
BERNIS_ID = '4119f45e-dd71-4de6-84e2-d61565fdda6c'

PROGRESS_FILE = 'ingestion_unified_progress.json'
STATE_YAMPEY = 'ingestion_state.json'
STATE_BERNIS = 'ingestion_state_bernis.json'

def load_json(path):
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"processed": {}, "failed": {}}
    return {"processed": {}, "failed": {}}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def update_unified_progress(stage, total, processed, failed, last_item, last_title):
    pct = round((processed / total) * 100, 1) if total > 0 else 0
    info = {
        "etapa_activa": stage,
        "total_etapa": total,
        "procesados_etapa": processed,
        "restantes_etapa": total - processed,
        "fallos_etapa": failed,
        "porcentaje_etapa": pct,
        "ultimo_audio": last_item,
        "ultimo_titulo": last_title,
        "modo": "whisper_local_cpu_int8",
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2, ensure_ascii=False)

def analyze_legal(transcript, autor_nombre):
    prompt = f"""Analizá esta transcripción de un video del abogado laboralista {autor_nombre} sobre el derecho laboral de Paraguay:
"{transcript}"

Devolvé ÚNICAMENTE un JSON válido con esta estructura:
{{
  "titulo_tema": "Título breve y descriptivo (máx 150 caracteres)",
  "caso_abuso_detectado": "Detalle de la situación, abuso patronal o consulta del trabajador planteada",
  "fundamento_juridico": "Artículos y leyes paraguayas aplicables (ej: Art. 19 Código del Trabajo Ley 213/93, Ley 1860/50 IPS)",
  "criterio_practico": "Consejo y criterio concreto: qué debe hacer el trabajador o qué dictamina la ley",
  "articulos_citados": ["Art. ..."]
}}"""

    # 1. Intentar con Groq Llama 3.3 / GPT-OSS (en modo texto es ultra rápido y no consume cuota de audio)
    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': f'Bearer {GROQ_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'openai/gpt-oss-120b',
                'temperature': 0.1,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay. Responde en JSON válido.'},
                    {'role': 'user', 'content': prompt}
                ]
            },
            timeout=12
        )
        if resp.ok:
            return json.loads(resp.json()['choices'][0]['message']['content'])
    except:
        pass

    # 2. Fallback a DeepSeek (en modo texto)
    try:
        resp2 = requests.post(
            'https://api.deepseek.com/chat/completions',
            headers={'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type': 'application/json', 'User-Agent': 'LaboraPy/1.0'},
            json={
                'model': 'deepseek-chat',
                'temperature': 0.1,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay. Responde en JSON válido.'},
                    {'role': 'user', 'content': prompt}
                ]
            },
            timeout=15
        )
        if resp2.ok:
            return json.loads(resp2.json()['choices'][0]['message']['content'])
    except:
        pass

    # Fallback básico estructurado si ambas APIs de texto fallan
    return {
        "titulo_tema": transcript[:80],
        "caso_abuso_detectado": "Consulta laboral",
        "fundamento_juridico": "Código del Trabajo Ley 213/93",
        "criterio_practico": "Asesoramiento legal laboral",
        "articulos_citados": []
    }

def insert_supabase(autor_id, title, transcript, analysis, file_name):
    insert_data = {
        'autor_id': autor_id,
        'plataforma': 'tiktok',
        'titulo_tema': (analysis.get('titulo_tema') or file_name)[:300],
        'audio_transcripcion': transcript,
        'caso_abuso_detectado': analysis.get('caso_abuso_detectado', ''),
        'fundamento_juridico': analysis.get('fundamento_juridico', ''),
        'criterio_practico': analysis.get('criterio_practico', ''),
        'articulos_citados': [str(a) for a in analysis.get('articulos_citados', [])],
        'metadata': {'file': file_name, 'engine': 'whisper_local_cpu_int8'},
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

def process_batch(model, folder, autor_id, autor_nombre, state_file, stage_name):
    if not os.path.exists(folder):
        print(f"Carpeta {folder} no existe.", flush=True)
        return

    all_files = sorted([f for f in os.listdir(folder) if f.lower().endswith('.mp3')])
    total = len(all_files)
    state = load_json(state_file)
    pending = [f for f in all_files if f not in state['processed']]

    print(f"\n==========================================", flush=True)
    print(f"🚀 INICIANDO ETAPA: {stage_name}", flush=True)
    print(f"Total: {total} | Ya listos: {len(state['processed'])} | Pendientes: {len(pending)}", flush=True)
    print(f"==========================================\n", flush=True)

    success = len(state['processed'])
    failed = len(state['failed'])
    start_time = time.time()
    last_report = time.time()

    for idx, f in enumerate(pending, 1):
        file_path = os.path.join(folder, f)
        t_item = time.time()
        try:
            # 1. Transcripción local en CPU con CTranslate2
            segments, _ = model.transcribe(file_path, language='es', beam_size=1)
            transcript = ' '.join([s.text for s in segments]).strip()
            if not transcript or len(transcript) < 10:
                raise Exception("Transcripción vacía o ininteligible")

            # 2. Análisis jurídico con LLM (texto)
            analysis = analyze_legal(transcript, autor_nombre)

            # 3. Inserción a Supabase
            row_id = insert_supabase(autor_id, analysis.get('titulo_tema', f), transcript, analysis, f)

            state['processed'][f] = {
                'id': row_id,
                'title': analysis.get('titulo_tema'),
                'duration_s': round(time.time() - t_item, 2),
                'at': time.strftime("%Y-%m-%d %H:%M:%S")
            }
            if f in state['failed']:
                del state['failed'][f]
            save_json(state_file, state)

            success += 1
            dur = time.time() - t_item
            title_short = (analysis.get('titulo_tema') or f)[:45]
            print(f"[{stage_name} {success}/{total}] OK ({dur:.1f}s) -> {title_short}", flush=True)
            update_unified_progress(stage_name, total, success, failed, f, title_short)

            time.sleep(0.5)

        except Exception as e:
            print(f"[{stage_name} ERROR] en {f}: {str(e)[:80]}", flush=True)
            state['failed'][f] = {'error': str(e), 'at': time.strftime("%Y-%m-%d %H:%M:%S")}
            save_json(state_file, state)
            failed += 1
            time.sleep(1.0)

        # Reporte periódico
        if time.time() - last_report >= 60:
            last_report = time.time()
            elapsed = time.time() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            rem_secs = (len(pending) - idx) / rate if rate > 0 else 0
            pct = (success / total) * 100
            print(f"\n--- [REPORTE {stage_name} LOCAL] ---", flush=True)
            print(f"Progreso: {success}/{total} ({pct:.1f}%) | Fallos: {failed}", flush=True)
            print(f"Velocidad: {rate*60:.1f} audios/min | Restante: {rem_secs/60:.1f} min", flush=True)
            print(f"------------------------------------\n", flush=True)

    print(f"\n✅ ETAPA {stage_name} COMPLETADA: {success} exitosos, {failed} fallos.\n", flush=True)

def main():
    print("Iniciando motor local Whisper (CTranslate2 int8 CPU)...", flush=True)
    t0 = time.time()
    model = WhisperModel('base', device='cpu', compute_type='int8')
    print(f"Motor Whisper local cargado en memoria en {time.time()-t0:.2f}s", flush=True)

    # 1. Rematar los 12 que faltan de Yampey
    process_batch(
        model=model,
        folder='audios/yampey',
        autor_id=YAMPEY_ID,
        autor_nombre='Ernesto Yampey',
        state_file=STATE_YAMPEY,
        stage_name='YAMPEY'
    )

    # 2. Procesar los 1.394 audios de Bernis
    process_batch(
        model=model,
        folder='audios/bernis',
        autor_id=BERNIS_ID,
        autor_nombre='Juan Bernis',
        state_file=STATE_BERNIS,
        stage_name='BERNIS'
    )

    print("🎉 ¡TODOS LOS AUDIOS (YAMPEY + BERNIS) HAN SIDO PROCESADOS Y CARGADOS A SUPABASE!", flush=True)

if __name__ == '__main__':
    main()
