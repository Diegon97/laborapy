import os, sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
import requests

# Pool de claves — SOLO variables de entorno (sin credenciales hardcodeadas)
keys = [
    ("Key 1", os.environ.get("GROQ_API_KEY_1") or os.environ.get("GROQ_API_KEY")),
    ("Key 2", os.environ.get("GROQ_API_KEY_2")),
    ("Key 3", os.environ.get("GROQ_API_KEY_3")),
    ("Key 4", os.environ.get("GROQ_API_KEY_4")),
]
keys = [(name, k) for name, k in keys if k]

if not keys:
    print('No hay claves Groq configuradas: definí GROQ_API_KEY_1..4 (o GROQ_API_KEY) en el entorno.', file=sys.stderr)
    sys.exit(1)

models = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

print("=== VERIFICACION EN VIVO DE ESTADO GROQ ===")

for name, key in keys:
    print(f"\n[{name}]")
    for m in models:
        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": m, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5},
                timeout=8,
            )
            if r.status_code == 200:
                print(f"  [OK] {m}: ACTIVO (200 OK)")
            elif r.status_code == 429:
                ra = r.headers.get("Retry-After", "desconocido")
                err = r.json().get("error", {}).get("message", "")
                print(f"  [429 RATE LIMIT] {m}: Retry-After: {ra}s | {err[:60]}")
            else:
                err = r.json().get("error", {}).get("message", r.text[:80])
                print(f"  [HTTP {r.status_code}] {m}: {err[:60]}")
        except Exception as e:
            print(f"  [ERR] {m}: Error {e}")
