# 📱 Tobi en Termux — Guía rápida

Consulta directa a Tobi (Gemini 3.7 / 3.8) desde el teléfono, pasando por el
Granjero y el Capataz de la PC. **Sin dependencias npm.**

## Instalación (una sola vez)

```bash
pkg update && pkg install nodejs curl -y
chmod +x tobi.sh tobi-consult.mjs
```

## Configuración

Agregá esto a `~/.bashrc` (reemplazá la IP por la de tu PC):

```bash
export GRANJERO_URL="http://192.168.0.10:8319/v1/chat/completions"
# export GRANJERO_TOKEN="tu-token"     # si en la PC definiste GRANJERO_TOKEN
# export TOBI_STREAM=1                 # ver la respuesta en vivo
alias tobi="$HOME/laborapy/scripts/termux/tobi.sh"
```

Recargá: `source ~/.bashrc`

## Uso

```bash
tobi flash "¿Cuál es el salario mínimo vigente?"
tobi deepthink "Analizá la liquidación de un empleado con 7 años."
tobi max "Dictamen pericial sobre el Art. 94 C.T."

tobi            # modo interactivo
```

Dentro del modo interactivo:
- `:flash` · `:deepthink` · `:max` · `:pro` → cambian el nivel
- `:salir` → sale

## Niveles

| Nivel | Modelo | Para qué |
|---|---|---|
| `flash` | Gemini 3.7 Flash (`low`) | Consultas rápidas |
| `deepthink` | Gemini 3.7 Flash (`medium`) | Peritajes y liquidaciones |
| `max` | Gemini 3.8 Flash (`high`) | Dictámenes extensos |
| `pro` | Gemini 3.1 Pro | Arquitectura |

## Verificar conexión

```bash
curl -s http://192.168.0.10:8319/health
```

## Problemas comunes

- **No conecta** → ¿Está el granjero corriendo en la PC? ¿Misma Wi-Fi? ¿Regla de firewall creada?
- **503** → Todas las cuentas Gemini en cooldown; esperar el reset.
- **401** → El granjero exige token; exportá `GRANJERO_TOKEN`.

> Guía completa: `docs/ROADMAP_TERMUX_GRANJERO.md`
