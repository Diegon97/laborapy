# SESSION CHECKPOINT — Tobi RRHH (entrenamiento nocturno Qwen) — 16/9/2026, 8:10:00 a. m.
<!-- generado automáticamente por scripts/checkpoint_0810.mjs -->

## 0. TL;DR de la noche
- Fase 1 (batería 52 casos): completed — 40/52 aprobados (76.92%) — promedio 82.81/100
- Fase 2 (mejora profunda): interrupted — 2 verificados · 2 sin verificar · 0 auditorías
- Datasets: final 43 | mejorados Fase 2 4 | batería Fase 1 40
- Smoke Fase 2 (SMV-02): 100/100 aprobado=true

## 1. Stack y versiones
- Node.js v24 (ESM) · Ollama 0.34 local · qwen2.5:7b (CPU, ~7 tok/s)
- App: React 19 · Vite 8 · TypeScript 6 · Vitest 4 · Supabase
- Scripts nuevos de la sesión: scripts/night_calibration_qwen.mjs, scripts/deep_improvement_qwen.mjs, scripts/lib/tobi_night_core.mjs, scripts/lib/deep_improvement_engine.mjs, scripts/lib/deep_research_reports.mjs, scripts/checkpoint_0810.mjs

## 2. Artefactos
- `scripts/night_calibration_progress.json` — [OK]
- `reports/tobi_stress_test_report.json` — [OK]
- `scripts/deep_improvement_progress.json` — [OK]
- `reports/TOBI_DEEP_RESEARCH_NOTES.json` — [OK]
- `reports/smoke_retest.json` — [OK]
- `datasets/tobi_gold_dataset_50.jsonl` — [OK] 40 líneas
- `datasets/tobi_deep_improved.jsonl` — [OK] 4 líneas
- `datasets/tobi_gold_dataset_final.jsonl` — [OK] 43 líneas
- `reports/TOBI_QWEN_NIGHT_TRAINING_REPORT.md` — [OK]
- `reports/TOBI_DEEP_RESEARCH_REPORT.md` — [OK]

## 3. Resultados Fase 1 por categoría

| Categoría | Casos | Aprobados | Tasa | Promedio |
| --- | --- | --- | --- | --- |
| Salario Mínimo | 8 | 7 | 87.5% | 93.75/100 |
| Jornada Laboral | 8 | 8 | 100% | 95.88/100 |
| Fraude Laboral | 6 | 2 | 33.33% | 47.17/100 |
| Estabilidad y Fueros | 6 | 6 | 100% | 93.33/100 |
| Horas Extras y Feriados | 6 | 5 | 83.33% | 92.83/100 |
| Acciones de Liquidación | 6 | 1 | 16.67% | 55.33/100 |
| Acciones de Documentos | 6 | 5 | 83.33% | 80/100 |
| Ciberseguridad y Prescripción | 6 | 6 | 100% | 96.17/100 |

## 4. Resultados Fase 2 (mejora profunda)
- Procesados: 20 · Re-encolados: 18 · Auditorías: 0 ([OK] 0 / [NO] 0)
### Reglas candidatas para el prompt canónico (top 5)
- jornada mixta 7,5 hs (1 casos)
- limites legales de horas extras (1 casos)
- no usar esquemas foráneos (1 casos)
- no usar valores vencidos (1 casos)
- recargo nocturno 30% (1 casos)

## 5. Decisiones tomadas (no re-litigar)
- Qwen 2.5 7B local (Ollama) como motor de entrenamiento nocturno; cero dependencia de cuota cloud (todo local).
- Fase 1: batería determinística de 52 casos en 8 categorías; evaluador de 3 dimensiones (fidelidad legal / cálculo-JSON / tono).
- Fase 2: re-investigación con corpus local (master legal, materiales, resúmenes de audios, resoluciones MTESS, knowledge base) + re-test con few-shot; máximo 2 ciclos por caso.
- El Golden Set final vive en datasets/tobi_gold_dataset_final.jsonl (Fase 1 + Fase 2 verificada).
- NO se tocó el producto (tobiSystemPrompt.ts / api/assistant.ts): solo datasets, reportes y scripts de entrenamiento.

## 6. Pendiente próxima sesión
1. Revisar `reports/TOBI_DEEP_RESEARCH_REPORT.md` — evaluar inyección de las reglas candidatas en `src/modules/assistant/tobiSystemPrompt.ts`.
2. Analizar los 2 casos no verificados y decidir refuerzos.
3. (Opcional) Integrar Qwen local como proveedor de desarrollo en `api/assistant.ts`.
4. (Opcional) Agregar tests Vitest con casos del golden set.
5. Validar con `npm test` + `npm run build` si se toca código de producto.

## 7. Bloqueadores / pendientes abiertos
Ninguno.

## 8. Cómo continuar
- Abrí una NUEVA sesión y pegá este archivo como primer mensaje (bootstrap).
- Prompt sugerido: "Revisá los resultados del entrenamiento nocturno de Tobi: leé reports/TOBI_DEEP_RESEARCH_REPORT.md, reports/TOBI_QWEN_NIGHT_TRAINING_REPORT.md y las reglas candidatas; propongamos qué reglas inyectar en tobiSystemPrompt.ts y qué hacer con los casos no verificados."
