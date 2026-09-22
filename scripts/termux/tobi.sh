#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# TOBI EN TERMUX — consulta directa por el protocolo Granjero -> Capataz -> Gemini
# =============================================================================
# USO:
#   ./tobi.sh flash "¿Cuál es el salario mínimo vigente?"
#   ./tobi.sh deepthink "Analizá la liquidación de un empleado con 7 años"
#   ./tobi.sh max "Dictamen pericial completo sobre el Art. 94"
#   ./tobi.sh                      # modo interactivo
#
# INSTALACIÓN EN TERMUX (una sola vez):
#   pkg update && pkg install nodejs curl -y
#   chmod +x tobi.sh
#
# CONFIGURACIÓN: exportá estas variables (o editá los valores por defecto):
#   export GRANJERO_URL="http://192.168.0.10:8319/v1/chat/completions"
#   export GRANJERO_TOKEN="tu-token-opcional"
#   export TOBI_STREAM=1     # para ver la respuesta en vivo
#
# TIP: agregá un alias en ~/.bashrc para invocar a Tobi desde cualquier lado:
#   echo "alias tobi='$HOME/tobi/tobi.sh'" >> ~/.bashrc && source ~/.bashrc
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Si no se exportó GRANJERO_URL, usar el valor por defecto (PC en la misma red).
if [ -z "${GRANJERO_URL:-}" ]; then
  export GRANJERO_URL="http://127.0.0.1:8319/v1/chat/completions"
fi

# --- Ruta A: Node disponible (recomendada, sin dependencias extra) -----------
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/tobi-consult.mjs" "$@"
fi

# --- Ruta B: python3 disponible ---------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  LEVEL="${1:-flash}"
  shift || true
  QUERY="$*"
  if [ -z "$QUERY" ]; then
    echo "Uso: ./tobi.sh [flash|deepthink|max|pro] \"consulta\"" >&2
    exit 1
  fi
  python3 - "$LEVEL" "$QUERY" <<'PY'
import json, os, sys, urllib.request
level, query = sys.argv[1], sys.argv[2]
url = os.environ.get("GRANJERO_URL", "http://127.0.0.1:8319/v1/chat/completions")
headers = {"Content-Type": "application/json"}
token = os.environ.get("GRANJERO_TOKEN", "").strip()
if token:
    headers["Authorization"] = f"Bearer {token}"
payload = json.dumps({"model": level, "messages": [{"role": "user", "content": query}], "stream": False}).encode()
req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.load(resp)
    print(data["choices"][0]["message"]["content"])
except Exception as exc:
    sys.stderr.write(f"ERROR: {exc}\n")
    sys.exit(1)
PY
  exit 0
fi

# --- Ruta C: curl + jq ------------------------------------------------------
if command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  LEVEL="${1:-flash}"
  shift || true
  QUERY="$*"
  if [ -z "$QUERY" ]; then
    echo "Uso: ./tobi.sh [flash|deepthink|max|pro] \"consulta\"" >&2
    exit 1
  fi
  AUTH_HEADER=()
  if [ -n "${GRANJERO_TOKEN:-}" ]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${GRANJERO_TOKEN}")
  fi
  BODY=$(jq -n --arg m "$LEVEL" --arg q "$QUERY" \
    '{model:$m, messages:[{role:"user", content:$q}], stream:false}')
  curl -sS -X POST "$GRANJERO_URL" \
    -H 'Content-Type: application/json' "${AUTH_HEADER[@]}" \
    -d "$BODY" --max-time 180 \
    | jq -r '.choices[0].message.content // .error'
  exit 0
fi

echo "❌ No hay node, python3 ni (curl + jq) disponibles." >&2
echo "   Instalá uno con:  pkg install nodejs        (recomendado)" >&2
echo "   o bien:           pkg install python3" >&2
echo "   o bien:           pkg install curl jq" >&2
exit 1
