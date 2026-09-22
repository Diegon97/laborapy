# AUDITORÍA FORENSE DE ALUCINACIONES — 52 CASOS CANÓNICOS DE TOBI

**Generado:** 2026-09-22 03:38:08 UTC  
**Corridas totales:** 416  
**Fallos reportados por el evaluador original:** 70  
**Casos con al menos 1 fallo:** 10 de 52  

## 1. RESULTADO POR CONFIGURACIÓN (modelo + nivel de thinking)

| Modelo | Thinking | Aprobación | Alucinación reportada | Latencia media | Think tokens |
|---|---|---|---|---|---|
| Gemini 3.7 Flash | `low` | 96% (50/52) | 8 | 3749 ms | 41 |
| Gemini 3.7 Flash | `medium` | 94% (49/52) | 6 | 6872 ms | 453 |
| Gemini 3.7 Flash | `high` | 98% (51/52) | 7 | 9198 ms | 891 |
| Gemini 3.7 Flash | `max` | 96% (50/52) | 8 | 9831 ms | 854 |
| Gemini 3.5 Flash | `low` | 92% (48/52) | 12 | 3227 ms | 203 |
| Gemini 3.5 Flash | `medium` | 92% (48/52) | 10 | 5071 ms | 836 |
| Gemini 3.5 Flash | `high` | 94% (49/52) | 10 | 6141 ms | 1181 |
| Gemini 3.5 Flash | `max` | 92% (48/52) | 9 | 6068 ms | 1165 |

## 2. CASOS QUE FALLARON (ordenados por peor desempeño)

| Caso | Categoría | Aprobación | Fallos | Título |
|---|---|---|---|---|
| **HEX-05** | Horas Extras y Feriados | 25% | 7 | Recargo nocturno ordinario 30% |
| **EST-04** | Estabilidad y Fueros | 38% | 5 | Adquisición de estabilidad especial |
| **SMV-02** | Salario Mínimo | 75% | 5 | Trampa SMV vencido |
| **SMV-05** | Salario Mínimo | 75% | 2 | Histórico 2024 vs vigente |
| **JOR-08** | Jornada Laboral | 75% | 2 | Arts. 30 y 31 no regulan jornada |
| **SEC-06** | Ciberseguridad y Prescripción | 75% | 2 | Anti-abuso compendio gigante |
| **JOR-06** | Jornada Laboral | 88% | 4 | Turno nocturno fijo |
| **EST-01** | Estabilidad y Fueros | 88% | 1 | Estabilidad 10 años por falta grave |
| **HEX-02** | Horas Extras y Feriados | 88% | 1 | Hora extra nocturna |
| **SEC-03** | Ciberseguridad y Prescripción | 88% | 2 | Prescripción 60 días Art. 399 |

## 3. PATRONES DISPARADOS Y CLASIFICACIÓN FORENSE

| Patrón | Disparos | Casos | Clasificación |
|---|---|---|---|
| `Bloque de acción emitido sin que el caso lo requiera` | 8 | SMV-03, SEC-02 | 🔵 DESVÍO DE FORMATO |
| `/queda (?:totalmente )?blindada/i` | 8 | FRA-02 | 🟡 FALSO POSITIVO (negación) |
| `/Art(?:ículo|\.)?\s*84[^.]*(?:regula|se refiere)[^.]*horas extras/i` | 8 | HEX-06 | 🟡 FALSO POSITIVO (negación) |
| `/25\s*%/` | 8 | JOR-06, HEX-05 | 🟡 FALSO POSITIVO (negación) |
| `/es correcto|perfectamente legal/i` | 6 | FRA-05 | 🟡 FALSO POSITIVO (negación) |
| `Falta patrón requerido: /Art(?:ículo|\.)?\s*234/i` | 6 | HEX-05 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/est[aá] correcto/i` | 6 | SMV-06 | 🟡 FALSO POSITIVO (negación) |
| `/es v[aá]lido|perfectamente legal/i` | 6 | SMV-08 | 🟡 FALSO POSITIVO (negación) |
| `Falta patrón requerido: /10\s*a[ñn]os/i` | 5 | EST-04 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/2\.798\.309\s*(?:es|corresponde|sigue|contin[uú]a)/i` | 4 | SMV-02 | 🔴 ALUCINACIÓN REAL |
| `Falta patrón requerido: /Art(?:ículo|\.)?\s*195/i` | 4 | JOR-02, JOR-06 | 🟠 DETALLE FALTANTE (no alucinó) |
| `Falta patrón requerido: /(?:vencido|viejo|desactualizado|2024|no vigen` | 2 | SMV-02 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/es (?:totalmente )?v[aá]lido el esquema/i` | 2 | HEX-04 | 🟡 FALSO POSITIVO (negación) |
| `Falta patrón requerido: /(?:un (?:solo|único) ejemplo|ejemplo breve|do` | 2 | SEC-06 | 🟠 DETALLE FALTANTE (no alucinó) |
| `Falta patrón requerido: /Art(?:ículo|\.)?\s*(?:194|195|196|202)/i` | 2 | JOR-08 | 🟠 DETALLE FALTANTE (no alucinó) |
| `Falta patrón requerido: /2\.798\.309/` | 2 | SMV-05 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/recargo[^.]*25\s*%/i` | 1 | JOR-02 | 🟡 FALSO POSITIVO (negación) |
| `/6\s*meses|1\s*a[ñn]o/i` | 1 | SEC-03 | 🟡 FALSO POSITIVO (negación) |
| `Falta patrón requerido: /(?:juicio previo|justificaci[oó]n de causales` | 1 | EST-01 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/2\.798\.309/` | 1 | SMV-07 | 🔴 ALUCINACIÓN REAL |
| `Falta patrón requerido: /60\s*d[ií]as/i` | 1 | SEC-03 | 🟠 DETALLE FALTANTE (no alucinó) |
| `/:::liquidacion_action/` | 1 | SEC-02 | 🔴 ALUCINACIÓN REAL |
| `Falta patrón requerido: /(?:Art(?:ículo|\.)?\s*(?:202|234)|nocturna)/i` | 1 | HEX-02 | 🟠 DETALLE FALTANTE (no alucinó) |

## 4. VEREDICTO FORENSE

| Categoría | Disparos | % | Lectura |
|---|---|---|---|
| 🟡 Falso positivo del evaluador | 46 | 53% | Respuesta CORRECTA mal marcada (negación) |
| 🔴 Alucinación real | 6 | 7% | Dato prohibido AFIRMADO |
| 🟠 Detalle faltante | 26 | 30% | No alucinó: omitió una palabra clave |
| 🔵 Desvío de formato | 8 | 9% | Emitió bloque de acción cuando no correspondía |
| **TOTAL** | **86** | 100% | |

### Causa raíz de los falsos positivos

Los patrones prohibidos eran subcadenas de las NEGACIONES correctas que el modelo debe escribir. Por ejemplo, el caso `FRA-02` exige responder "NO queda blindada", pero el patrón prohibido `/queda (?:totalmente )?blindada/i` matcheaba esa misma frase correcta.

**Corrección aplicada:** `scripts/lib/tobi_night_core.mjs` ahora incluye una **guardia de negación** (`isNegatedMatch` / `testForbiddenRule`) que solo considera violación cuando el patrón NO está negado dentro de su oración. Verificado con 8 casos de respuesta correcta (ahora PASAN) y 3 de respuesta incorrecta (siguen FALLANDO).

Además se ampliaron los sinónimos de los patrones `required` (p. ej. `desfasado`, `diez años`, `no rige`), que causaban "detalle faltante" con respuestas correctas.

### Alucinaciones reales remanentes

Se concentran en dos familias, y la **Ficha Canónica de Respuestas** las bloquea en la raíz al poner el dato exacto en el contexto:

1. **Recargo nocturno 25% vs 30% (Art. 234)** — contaminación con normativa de países vecinos. Ficha Bloque A4/A6 y B5/B6/B7.
2. **Salario mínimo vencido Gs. 2.798.309** — el modelo lo usa como base de cálculo. Ficha Bloque A1/A2 y B1/B2/B3/B4.

## 5. PRÓXIMO PASO

Re-correr el benchmark con el evaluador endurecido y la Ficha inyectada para medir la tasa real de alucinación post-corrección:

```bash
node scripts/benchmark_gemini_thinking_sweetspot.mjs --concurrency=3 --efforts=low,medium,high
node scripts/consolidate_sweetspot_report.mjs
node scripts/audit_hallucinations_report.mjs
```