#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cloud_pool_bernis.py
====================
Script de ingesta concurrente multi-API (Pool de 4 Groq Keys) para audios de Juan Bernis.
Ejecuta 4 workers paralelos independientes para transcripción (Whisper Turbo) y
análisis pericial jurídico (GPT-OSS-120B / LLaMA 3.3 70B) con 0% de uso de CPU local
e inserción directa REST a Supabase.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import random
import re
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# ---------------------------------------------------------------------------
# 1. CONFIGURACIÓN Y POOL DE CLAVES GROQ
# ---------------------------------------------------------------------------

# Pool de claves Groq — SOLO variables de entorno (prohibido hardcodear credenciales)
DEFAULT_GROQ_KEYS = [
    k for k in (
        os.environ.get("GROQ_API_KEY_1"),
        os.environ.get("GROQ_API_KEY_2"),
        os.environ.get("GROQ_API_KEY_3"),
        os.environ.get("GROQ_API_KEY_4"),
    ) if k
]

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://wbbcqololvxlnmxajurd.supabase.co").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BERNIS_ID = "4119f45e-dd71-4de6-84e2-d61565fdda6c"
SUPABASE_TABLE = "jurisprudencia_multimedia"

GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
WHISPER_MODEL = "whisper-large-v3-turbo"
LEGAL_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "qwen/qwen3.6-27b",
]

# ---------------------------------------------------------------------------
# 2. RESOLUCIÓN DE RUTAS
# ---------------------------------------------------------------------------

def resolve_paths() -> Tuple[Path, Path, Path]:
    script_dir = Path(__file__).resolve().parent
    project_dir = script_dir.parent
    workspace_root = project_dir.parent

    candidate_dirs = [
        Path.cwd() / "audios" / "bernis",
        workspace_root / "audios" / "bernis",
        project_dir / "audios" / "bernis",
        Path("audios/bernis").resolve(),
    ]
    audio_dir = candidate_dirs[0]
    for c in candidate_dirs:
        if c.exists() and c.is_dir():
            audio_dir = c
            break

    state_candidates = [
        Path.cwd() / "ingestion_state_bernis.json",
        workspace_root / "ingestion_state_bernis.json",
        project_dir / "ingestion_state_bernis.json",
    ]
    state_file = state_candidates[0]
    for s in state_candidates:
        if s.exists():
            state_file = s
            break

    progress_candidates = [
        Path.cwd() / "ingestion_unified_progress.json",
        workspace_root / "ingestion_unified_progress.json",
        project_dir / "ingestion_unified_progress.json",
    ]
    progress_file = progress_candidates[0]
    for p in progress_candidates:
        if p.exists():
            progress_file = p
            break

    return audio_dir, state_file, progress_file

# ---------------------------------------------------------------------------
# 3. GESTIÓN DE ESTADO Y PROGRESO (THREAD-SAFE)
# ---------------------------------------------------------------------------

class StateManager:
    def __init__(self, state_path: Path, progress_path: Path):
        self.state_path = state_path
        self.progress_path = progress_path
        self.lock = threading.Lock()
        self.state = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if self.state_path.exists():
            try:
                with self.state_path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        data.setdefault("processed", {})
                        data.setdefault("failed", {})
                        return data
            except Exception:
                pass
        return {"processed": {}, "failed": {}}

    def _atomic_save(self, path: Path, data: Any):
        tmp = path.with_suffix(path.suffix + f".tmp.{os.getpid()}")
        try:
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except Exception:
            if tmp.exists():
                try:
                    tmp.unlink()
                except Exception:
                    pass
            with path.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    def mark_processed(self, filename: str, row_id: str, title: str, duration_s: float):
        with self.lock:
            self.state.setdefault("processed", {})
            self.state["processed"][filename] = {
                "id": row_id,
                "title": title,
                "duration_s": round(duration_s, 2),
                "at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            if "failed" in self.state and filename in self.state["failed"]:
                del self.state["failed"][filename]
            self._atomic_save(self.state_path, self.state)

    def mark_failed(self, filename: str, error_msg: str):
        with self.lock:
            self.state.setdefault("failed", {})
            self.state["failed"][filename] = {
                "error": str(error_msg)[:300],
                "at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            self._atomic_save(self.state_path, self.state)

    def update_progress(self, total_audios: int, processed_total: int, failed_total: int,
                        last_audio: str, last_title: str):
        with self.lock:
            unified_data: Dict[str, Any] = {}
            if self.progress_path.exists():
                try:
                    with self.progress_path.open("r", encoding="utf-8") as f:
                        unified_data = json.load(f)
                except Exception:
                    unified_data = {}

            pct = round((processed_total / total_audios) * 100, 1) if total_audios > 0 else 0.0
            info = {
                "autor": "@juanbernis",
                "etapa_activa": "bernis_cloud_pool",
                "total": total_audios,
                "processed": processed_total,
                "remaining": max(total_audios - processed_total, 0),
                "failed": failed_total,
                "percent": pct,
                "last_audio": last_audio,
                "last_title": last_title,
                "modo": "groq_pool_4workers_0cpu",
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            unified_data["bernis"] = info
            unified_data["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._atomic_save(self.progress_path, unified_data)

# ---------------------------------------------------------------------------
# 4. TRANSCRIPCIÓN Y ANÁLISIS JURÍDICO CON GROQ
# ---------------------------------------------------------------------------

def transcribe_whisper(file_path: Path, groq_key: str, max_retries: int = 5) -> str:
    delay = 2.0
    for attempt in range(1, max_retries + 1):
        try:
            with file_path.open("rb") as f:
                resp = requests.post(
                    GROQ_TRANSCRIBE_URL,
                    headers={"Authorization": f"Bearer {groq_key}"},
                    files={"file": (file_path.name, f, "audio/mpeg")},
                    data={"model": WHISPER_MODEL, "language": "es", "temperature": "0"},
                    timeout=30,
                )
            if resp.status_code == 200:
                text = resp.json().get("text", "").strip()
                if not text or len(text) < 10:
                    raise ValueError("Transcripción vacía o ininteligible")
                return text
            if resp.status_code == 429:
                ra = resp.headers.get("Retry-After")
                wait = min(float(ra), 8.0) if ra else min(delay + random.uniform(0.5, 1.5), 8.0)
                time.sleep(wait)
                delay = min(delay * 1.5, 8.0)
                continue
            if resp.status_code >= 500:
                time.sleep(delay)
                delay = min(delay * 1.5, 20.0)
                continue
            resp.raise_for_status()
        except (requests.RequestException, ValueError) as e:
            if attempt == max_retries:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 30.0)
    raise RuntimeError("Whisper: intentos agotados sin éxito")

def _clean_json_response(raw: str) -> Dict[str, Any]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"```\s*$", "", raw).strip()
    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end > start:
            snippet = raw[start : end + 1]
            snippet_fixed = re.sub(r",\s*([}\]])", r"\1", snippet)
            return json.loads(snippet_fixed)
        raise ValueError(f"No se pudo extraer JSON de: {raw[:200]}")

def analyze_legal(transcript: str, groq_key: str, max_retries: int = 4) -> Dict[str, Any]:
    prompt = f"""Analizá esta transcripción de un video del abogado laboralista Juan Bernis sobre el derecho laboral de Paraguay:
"{transcript[:15000]}"

Devolvé ÚNICAMENTE un JSON válido con esta estructura exacta:
{{
  "titulo_tema": "Título breve y descriptivo (máx 150 caracteres)",
  "caso_abuso_detectado": "Detalle de la situación, abuso patronal o consulta del trabajador planteada",
  "fundamento_juridico": "Artículos y leyes paraguayas aplicables (ej: Art. 19 Código del Trabajo Ley 213/93, Ley 1860/50 IPS)",
  "criterio_practico": "Consejo y criterio concreto: qué debe hacer el trabajador o qué dictamina la ley",
  "articulos_citados": ["Art. ..."]
}}"""

    models_to_try = LEGAL_MODELS
    for model in models_to_try:
        delay = 2.0
        for attempt in range(1, max_retries + 1):
            try:
                resp = requests.post(
                    GROQ_CHAT_URL,
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": "Sos el Auditor Jurídico y Perito Laboralista de LaboraPy para Paraguay. Respondé estrictamente en JSON válido.",
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                    timeout=25,
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    return _clean_json_response(content)
                if resp.status_code == 429:
                    ra = resp.headers.get("Retry-After")
                    wait = min(float(ra), 8.0) if ra else min(delay + random.uniform(0.5, 1.5), 8.0)
                    time.sleep(wait)
                    delay = min(delay * 1.5, 8.0)
                    continue
                if resp.status_code >= 500:
                    time.sleep(delay)
                    delay = min(delay * 1.5, 20.0)
                    continue
                if resp.status_code in (400, 404):
                    break
                resp.raise_for_status()
            except Exception:
                if attempt == max_retries:
                    break
                time.sleep(delay)
                delay = min(delay * 2, 30.0)
    raise RuntimeError("Análisis legal agotó modelos y reintentos")

# ---------------------------------------------------------------------------
# 5. INSERCIÓN REST EN SUPABASE
# ---------------------------------------------------------------------------

def insert_supabase(title: str, transcript: str, analysis: Dict[str, Any], file_name: str) -> str:
    insert_data = {
        "autor_id": BERNIS_ID,
        "plataforma": "tiktok",
        "titulo_tema": (analysis.get("titulo_tema") or title)[:300],
        "audio_transcripcion": transcript,
        "caso_abuso_detectado": str(analysis.get("caso_abuso_detectado", "")),
        "fundamento_juridico": str(analysis.get("fundamento_juridico", "")),
        "criterio_practico": str(analysis.get("criterio_practico", "")),
        "articulos_citados": [str(a) for a in analysis.get("articulos_citados", [])],
        "metadata": {"file": file_name, "ingested_via": "groq_pool_4workers"},
        "activo": True,
    }
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=insert_data,
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if data and isinstance(data, list) and "id" in data[0]:
        return str(data[0]["id"])
    return "ok"

# ---------------------------------------------------------------------------
# 6. WORKER THREAD Y CICLO DE INGESTA
# ---------------------------------------------------------------------------

def worker_loop(worker_id: int, groq_key: str, task_queue: queue.Queue,
                state_mgr: StateManager, total_in_dir: int,
                stats: Dict[str, Any], stats_lock: threading.Lock):
    while True:
        try:
            item = task_queue.get_nowait()
        except queue.Empty:
            break

        file_path = Path(item)
        filename = file_path.name
        t_start = time.time()

        try:
            transcript = transcribe_whisper(file_path, groq_key)
            analysis = analyze_legal(transcript, groq_key)
            title = analysis.get("titulo_tema") or filename
            row_id = insert_supabase(title, transcript, analysis, filename)

            duration = time.time() - t_start
            state_mgr.mark_processed(filename, row_id, title, duration)

            with stats_lock:
                stats["ok"] += 1
                stats["durations"].append(duration)
                processed_count = len(state_mgr.state.get("processed", {}))
                failed_count = len(state_mgr.state.get("failed", {}))

            title_disp = (title[:48] + "..") if len(title) > 50 else title
            print(f"[W{worker_id}] OK ({duration:4.1f}s) -> {title_disp}", flush=True)

            state_mgr.update_progress(
                total_audios=total_in_dir,
                processed_total=processed_count,
                failed_total=failed_count,
                last_audio=filename,
                last_title=title,
            )

            time.sleep(0.5)

        except Exception as e:
            with stats_lock:
                stats["failed"] += 1
                failed_count = len(state_mgr.state.get("failed", {})) + 1
                processed_count = len(state_mgr.state.get("processed", {}))

            state_mgr.mark_failed(filename, str(e))
            print(f"[W{worker_id} ERROR] en {filename}: {str(e)[:75]}", flush=True)

            state_mgr.update_progress(
                total_audios=total_in_dir,
                processed_total=processed_count,
                failed_total=failed_count,
                last_audio=filename,
                last_title="ERROR: " + str(e)[:30],
            )

        finally:
            task_queue.task_done()

# ---------------------------------------------------------------------------
# 7. MAIN ORCHESTRATOR Y MÉTRICAS
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Ingesta Concurrente Multi-API Groq para Bernis (0% CPU)")
    parser.add_argument("--limit", type=int, default=None, help="Límite opcional de audios a procesar")
    parser.add_argument("--workers", type=int, default=4, help="Cantidad de workers paralelos (default: 4)")
    args = parser.parse_args()

    audio_dir, state_path, progress_path = resolve_paths()

    if not audio_dir.exists():
        print(f"Error: Carpeta de audios no encontrada en {audio_dir}", flush=True)
        sys.exit(1)

    state_mgr = StateManager(state_path, progress_path)

    exts = {".mp3", ".m4a", ".wav", ".ogg", ".opus", ".aac", ".flac", ".webm", ".mp4"}
    all_files = sorted([p for p in audio_dir.iterdir() if p.is_file() and p.suffix.lower() in exts], key=lambda x: x.name)
    total_files = len(all_files)

    pending = [p for p in all_files if p.name not in state_mgr.state.get("processed", {})]
    total_pending = len(pending)

    if args.limit and args.limit > 0:
        run_pending = pending[: args.limit]
    else:
        run_pending = pending

    print("\n" + "=" * 65, flush=True)
    print("🚀 === INGESTA CONCURRENTE MULTI-API (POOL 4 GROQ) BERNIS ===", flush=True)
    print(f"Directorio audios   : {audio_dir}", flush=True)
    print(f"Total en disco      : {total_files} audios", flush=True)
    print(f"Ya procesados       : {len(state_mgr.state.get('processed', {}))}", flush=True)
    print(f"Pendientes totales  : {total_pending}", flush=True)
    print(f"Lote a procesar     : {len(run_pending)} audios" + (f" (límite: {args.limit})" if args.limit else ""), flush=True)
    print(f"Workers Groq activos: {args.workers} en paralelo (0% CPU local)", flush=True)
    print("=" * 65 + "\n", flush=True)

    if not run_pending:
        print("✅ No hay audios pendientes de Bernis. Todo completado al 100%.", flush=True)
        return

    keys_pool = []
    for env_key in [os.getenv(f"GROQ_API_KEY_{i}") for i in range(args.workers)]:
        if env_key:
            keys_pool.append(env_key)
    if not keys_pool:
        keys_pool = list(DEFAULT_GROQ_KEYS)
    if not keys_pool:
        print("❌ No hay API keys de Groq configuradas en el entorno (GROQ_API_KEY_1..4 o GROQ_API_KEY).", file=sys.stderr)
        sys.exit(1)

    task_queue: queue.Queue = queue.Queue()
    for f in run_pending:
        task_queue.put(f)

    stats = {"ok": 0, "failed": 0, "durations": []}
    stats_lock = threading.Lock()

    start_time = time.time()
    threads: List[threading.Thread] = []

    for i in range(args.workers):
        worker_key = keys_pool[i % len(keys_pool)]
        t = threading.Thread(
            target=worker_loop,
            args=(i, worker_key, task_queue, state_mgr, total_files, stats, stats_lock),
            name=f"GroqPool-Worker-{i}",
            daemon=True,
        )
        t.start()
        threads.append(t)

    try:
        while any(t.is_alive() for t in threads):
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[!] Detención manual recibida. Esperando finalización de audios en curso...", flush=True)

    for t in threads:
        t.join(timeout=2.0)

    elapsed = time.time() - start_time
    ok_count = stats["ok"]
    failed_count = stats["failed"]
    total_run = ok_count + failed_count

    velocity_apm = (ok_count / (elapsed / 60.0)) if elapsed > 0 else 0.0
    sec_per_audio = (elapsed / ok_count) if ok_count > 0 else 0.0

    new_pending = total_pending - ok_count
    eta_seconds = new_pending * sec_per_audio if sec_per_audio > 0 else 0.0

    print("\n" + "=" * 65, flush=True)
    print("🏁 === RESUMEN DE RENDIMIENTO DE LA CORRIDA ===", flush=True)
    print(f"Audios procesados OK : {ok_count}", flush=True)
    print(f"Audios fallidos      : {failed_count}", flush=True)
    print(f"Total procesados     : {total_run} audios", flush=True)
    print(f"Tiempo transcurrido  : {elapsed:.1f} segundos ({elapsed / 60.0:.2f} minutos)", flush=True)
    print(f"Velocidad promedio   : {velocity_apm:.2f} audios/minuto ({sec_per_audio:.2f} seg/audio)", flush=True)
    print("-" * 65, flush=True)
    print(f"Total Bernis en disco: {total_files}", flush=True)
    print(f"Procesados global    : {len(state_mgr.state.get('processed', {}))} ({len(state_mgr.state.get('processed', {})) / total_files * 100:.1f}%)", flush=True)
    print(f"Pendientes restantes : {new_pending}", flush=True)
    if new_pending > 0 and eta_seconds > 0:
        print(f"Proyección restante  : {eta_seconds / 60.0:.1f} minutos ({eta_seconds / 3600.0:.2f} horas)", flush=True)
    else:
        print(f"Proyección restante  : ¡0 minutos! (100% completado)", flush=True)
    print("=" * 65 + "\n", flush=True)

if __name__ == "__main__":
    main()
