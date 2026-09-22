# 🌾 ROADMAP — TOBI CONSULTANDO DIRECTO DESDE TERMUX VÍA GRANJERO / CAPATAZ

> **Estado:** INFRAESTRUCTURA LISTA Y VERIFICADA (faltan solo los pasos de red en el teléfono).
> **Fecha:** 2026-09-22 · **Ficha canónica:** v`PY-ANSWERSHEET-2026.09.22`

---

## 1. ARQUITECTURA DEL PROTOCOLO

```
┌──────────────┐   HTTP    ┌──────────────────┐   HTTP    ┌──────────────────┐   OAuth   ┌─────────────┐
│  TERMUX      │ ────────► │  GRANJERO :8319  │ ────────► │  CAPATAZ :8317   │ ────────► │  GEMINI     │
│  (tobi.sh)   │  JSON     │  (PC, repo)      │  Bearer   │  CLIProxyAPI     │ round-    │  3.7 / 3.8  │
└──────────────┘           └──────────────────┘           └──────────────────┘  robin    └─────────────┘
      ▲                          ▲                                ▲
      │                          │                                │
  3 niveles                Inyecta la FICHA              Reparte entre las
  flash/deepthink/max      CANÓNICA (system prompt)       cuentas Google AI Pro
```

**Qué aporta cada pieza:**

| Componente | Rol | Puerto |
|---|---|---|
| `scripts/termux/tobi.sh` | Cliente del teléfono. Detecta node/python/curl. | — |
| `scripts/granjero/granjero_server.mjs` | Resuelve el nivel, inyecta la Ficha Canónica, aplica fallback en cadena. | 8319 |
| Capataz (CLIProxyAPI) | Round-robin OAuth entre las cuentas Google AI Pro. | 8317 |
| Gobernador (Tanques) | Monitorea cuota y regímenes (turbo/crucero/eco). | 8318 |

---

## 2. LOS 3 NIVELES (CALIBRADOS EMPÍRICAMENTE)

| Nivel | Modelo | Reasoning | Latencia esperada | Uso recomendado |
|---|---|---|---|---|
| **`flash`** | Gemini 3.7 Flash | `low` | ~3,7 s | Consultas rápidas, salario mínimo, jornada, dudas puntuales. |
| **`deepthink`** | Gemini 3.7 Flash | `medium` | ~6,9 s | Peritajes, liquidaciones complejas, análisis de fraude (Art. 19). |
| **`max`** | Gemini 3.8 Flash | `high` | ~9,2 s | Dictámenes extensos, auditoría de despidos, Art. 94. |
| `pro` (extra) | Gemini 3.1 Pro | — | variable | Arquitectura / razonamiento profundo (opcional). |

**Fallback automático** (si un modelo está en cooldown por cuota):
- `flash` → 3.7-low → **3.5-lite-low**
- `deepthink` → 3.7-medium → **3.5-lite-medium** → 3.8-medium
- `max` → 3.8-high → **3.7-high** → **3.5-lite-high**

> La consulta **nunca se cae**: si el primer carril devuelve 429/5xx, el granjero prueba el siguiente y reporta en la respuesta desde qué carril vino (`data.granjero.fallbackFrom`).

---

## 3. PUESTA EN MARCHA — LADO PC (una sola vez)

### 3.1 Verificar que el Capataz está arriba
```powershell
# Debe responder JSON con las cuentas cargadas:
Invoke-RestMethod http://127.0.0.1:8318/api/estado | ConvertTo-Json -Depth 3
```
Si no está, arrancarlo con el script del proyecto (o `reiniciar-capataz.cmd`).

### 3.2 Levantar el Granjero (dejar esta ventana abierta)
```powershell
cd "C:\Users\dnunez.SWOOSH\Documents\Calculadora RRHH\calculadora-rrhh-py"
node scripts/granjero/granjero_server.mjs
```
Salida esperada:
```
🌾 Granjero Middleware v2 iniciado.
🔌 Capataz destino: http://127.0.0.1:8317/v1/chat/completions
📖 Ficha canónica: vPY-ANSWERSHEET-2026.09.22 (8765 chars)
🎚️  Niveles: flash (3.7 low) · deepthink (3.7 medium) · max (3.8 high) · pro
🌐 Escuchando en http://0.0.0.0:8319/v1/chat/completions
```

### 3.3 Averiguar la IP LAN de la PC
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' }).IPAddress
```
Anotá la IP (ej. `192.168.0.10`).

### 3.4 Abrir el puerto 8319 en el firewall (solo red local)
```powershell
New-NetFirewallRule -DisplayName "Granjero Tobi 8319 LAN" -Direction Inbound -LocalPort 8319 -Protocol TCP -Action Allow -Profile Private
```

### 3.5 Verificar desde la PC
```powershell
Invoke-RestMethod http://<IP-LAN>:8319/health | ConvertTo-Json -Depth 4
```

---

## 4. PUESTA EN MARCHA — LADO TERMUX

### 4.1 Instalar dependencias
```bash
pkg update && pkg install nodejs curl -y
```

### 4.2 Copiar los scripts al teléfono
Opción A — clonar el repo (si tiene git en Termux):
```bash
pkg install git -y
git clone <repo> ~/laborapy
```
Opción B — copiar solo la carpeta `scripts/termux/` por USB / `termux-setup-storage` / compartir por WhatsApp Web.

### 4.3 Configurar el entorno (agregar a `~/.bashrc`)
```bash
export GRANJERO_URL="http://192.168.0.10:8319/v1/chat/completions"   # ← tu IP LAN
# export GRANJERO_TOKEN="..."   # solo si definiste GRANJERO_TOKEN en la PC
# export TOBI_STREAM=1          # respuesta en vivo
alias tobi="$HOME/laborapy/scripts/termux/tobi.sh"
```

### 4.4 Recargar el shell y probar
```bash
source ~/.bashrc
tobi flash "¿Cuál es el salario mínimo vigente en Paraguay?"
tobi deepthink "Analizá la liquidación de un empleado con 7 años y falta grave."
tobi max "Dictamen pericial sobre el Art. 94 C.T."
```

### 4.5 Modo interactivo
```bash
tobi
# [flash] › :deepthink
# [deepthink] › analizá este despido...
# [deepthink] › :max
# [max] › dame el dictamen completo
# [max] › :salir
```

---

## 5. CHECKLIST DE VERIFICACIÓN (ejecutado y aprobado el 2026-09-22)

- [x] Granjero arranca y `/health` reporta la ficha v2026.09.22 (8.765 chars).
- [x] Nivel `flash` resuelve a `gemini-3.7-flash-high` + `reasoning=low`.
- [x] Nivel `deepthink` resolvió correctamente el recargo nocturno (**30%**, Art. 234).
- [x] Fallback probado en vivo: `max` cayó a `3.7-high` por cooldown de 3.8 y respondió correcto.
- [x] Trampa de salario mínimo vencido neutralizada por la Ficha ("No. 2.798.309 está VENCIDO...").
- [x] Cliente Termux (`tobi-consult.mjs`) responde end-to-end.
- [ ] **Pendiente sesión próxima:** copiar `scripts/termux/` al teléfono y validar la LAN real.

---

## 6. TROUBLESHOOTING

| Síntoma | Causa probable | Solución |
|---|---|---|
| `No es posible conectar` desde Termux | IP equivocada, PC en otra red, o firewall | Verificar `GRANJERO_URL`, que ambos estén en la misma Wi-Fi, y la regla de firewall del 3.4. |
| `503 Ningún carril disponible` | Todas las cuentas en cooldown | Esperar el reset del gobernador o sumar otra cuenta con `agregar-cuenta.cmd`. |
| `401 Token de granjero inválido` | `GRANJERO_TOKEN` definido en la PC y ausente en Termux | Exportar el mismo token en `~/.bashrc`. |
| Respuestas sin la Ficha | Error al extraer el `.ts` | Revisar `systemPromptError` en `GET /health`. |
| Latencia > 15 s | Nivel `max` con cuota ajustada | Usar `flash` o `deepthink`. |

---

## 7. PRÓXIMA SESIÓN — TAREAS SUGERIDAS

1. **Validar la LAN real:** copiar `scripts/termux/` al teléfono y correr los 3 niveles.
2. **Re-correr el benchmark completo** con el evaluador endurecido + la Ficha inyectada:
   ```bash
   node scripts/benchmark_gemini_thinking_sweetspot.mjs --concurrency=3 --efforts=low,medium,high
   node scripts/consolidate_sweetspot_report.mjs
   node scripts/audit_hallucinations_report.mjs
   ```
   Objetivo: medir la caída real de la tasa de alucinación (hoy: 46 falsos positivos ya eliminados + 6 alucinaciones reales).
3. **Servicio persistente:** convertir el granjero en tarea programada de Windows (junto al watchdog del capataz) para que arranque con la PC.
4. **Canal seguro fuera de LAN (opcional):** evaluar Cloudflare Tunnel (`cloudflared`) o Tailscale si Tobi necesita consultar desde datos móviles, protegiendo con `GRANJERO_TOKEN`.
5. **Ampliar la Ficha** con los 6 casos restantes si el benchmark detecta nuevos patrones de alucinación.

---

## 8. ARCHIVOS DEL PROTOCOLO

| Archivo | Función |
|---|---|
| `scripts/granjero/granjero_server.mjs` | Middleware (niveles + ficha + fallback). |
| `scripts/lib/tobi_context_builder.mjs` | Extrae la Ficha del `.ts` (fuente única). |
| `scripts/termux/tobi.sh` | Cliente wrapper para Termux. |
| `scripts/termux/tobi-consult.mjs` | Cliente Node (single-shot + REPL). |
| `scripts/termux/README.md` | Guía de instalación en el teléfono. |
| `src/modules/assistant/tobiCanonicalAnswerSheet.ts` | **FUENTE ÚNICA** de la Ficha Canónica. |
