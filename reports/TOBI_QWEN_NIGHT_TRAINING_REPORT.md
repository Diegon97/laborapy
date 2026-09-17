# INFORME DE CALIBRACIÓN NOCTURNA — TOBI × QWEN 2.5 (OLLAMA)

- **Generado:** 2026-09-16T06:43:57.986Z
- **Inicio de corrida:** 2026-09-16T05:05:50.499Z
- **Modelo:** `qwen2.5:7b` (temperature 0.1)
- **Endpoint:** http://localhost:11434/api/chat
- **Estado:** completed
- **Casos ejecutados:** 52 / 52

## 1. Métricas globales

| Métrica | Valor |
| --- | --- |
| Casos aprobados | 40 |
| Casos reprobados | 12 |
| Tasa de aprobación | 76.92% |
| Puntaje promedio | 82.81/100 |
| Legal promedio | 7.85/10 |
| Calc/JSON promedio | 7.75/10 |
| Tono promedio | 9.23/10 |
| Ejemplos de oro | 40 |

## 2. Rendimiento por categoría

| Categoría | Casos | Aprobados | Aprobación | Promedio |
| --- | --- | --- | --- | --- |
| Salario Mínimo | 8 | 7 | 87.5% | 93.75/100 |
| Jornada Laboral | 8 | 8 | 100% | 95.88/100 |
| Fraude Laboral | 6 | 2 | 33.33% | 47.17/100 |
| Estabilidad y Fueros | 6 | 6 | 100% | 93.33/100 |
| Horas Extras y Feriados | 6 | 5 | 83.33% | 92.83/100 |
| Acciones de Liquidación | 6 | 1 | 16.67% | 55.33/100 |
| Acciones de Documentos | 6 | 5 | 83.33% | 80/100 |
| Ciberseguridad y Prescripción | 6 | 6 | 100% | 96.17/100 |

## 3. Detalle por caso

| ID | Categoría | Puntaje | Legal | Calc | Tono | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| SMV-01 | Salario Mínimo | 100/100 | 10 | 10 | 10 | APROBADO |
| SMV-02 | Salario Mínimo | 83/100 | 5 | 10 | 10 | REPROBADO |
| SMV-03 | Salario Mínimo | 100/100 | 10 | 10 | 10 | APROBADO |
| SMV-04 | Salario Mínimo | 90/100 | 10 | 7 | 10 | APROBADO |
| SMV-05 | Salario Mínimo | 100/100 | 10 | 10 | 10 | APROBADO |
| SMV-06 | Salario Mínimo | 100/100 | 10 | 10 | 10 | APROBADO |
| SMV-07 | Salario Mínimo | 90/100 | 10 | 7 | 10 | APROBADO |
| SMV-08 | Salario Mínimo | 87/100 | 6 | 10 | 10 | APROBADO |
| JOR-01 | Jornada Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| JOR-02 | Jornada Laboral | 87/100 | 6 | 10 | 10 | APROBADO |
| JOR-03 | Jornada Laboral | 90/100 | 10 | 7 | 10 | APROBADO |
| JOR-04 | Jornada Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| JOR-05 | Jornada Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| JOR-06 | Jornada Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| JOR-07 | Jornada Laboral | 90/100 | 10 | 7 | 10 | APROBADO |
| JOR-08 | Jornada Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| FRA-01 | Fraude Laboral | 0/100 | 0 | 0 | 0 | REPROBADO |
| FRA-02 | Fraude Laboral | 0/100 | 0 | 0 | 0 | REPROBADO |
| FRA-03 | Fraude Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| FRA-04 | Fraude Laboral | 100/100 | 10 | 10 | 10 | APROBADO |
| FRA-05 | Fraude Laboral | 83/100 | 5 | 10 | 10 | REPROBADO |
| FRA-06 | Fraude Laboral | 0/100 | 0 | 0 | 0 | REPROBADO |
| EST-01 | Estabilidad y Fueros | 90/100 | 10 | 7 | 10 | APROBADO |
| EST-02 | Estabilidad y Fueros | 90/100 | 10 | 7 | 10 | APROBADO |
| EST-03 | Estabilidad y Fueros | 100/100 | 10 | 10 | 10 | APROBADO |
| EST-04 | Estabilidad y Fueros | 100/100 | 10 | 10 | 10 | APROBADO |
| EST-05 | Estabilidad y Fueros | 90/100 | 10 | 7 | 10 | APROBADO |
| EST-06 | Estabilidad y Fueros | 90/100 | 10 | 7 | 10 | APROBADO |
| HEX-01 | Horas Extras y Feriados | 100/100 | 10 | 10 | 10 | APROBADO |
| HEX-02 | Horas Extras y Feriados | 83/100 | 5 | 10 | 10 | REPROBADO |
| HEX-03 | Horas Extras y Feriados | 100/100 | 10 | 10 | 10 | APROBADO |
| HEX-04 | Horas Extras y Feriados | 87/100 | 6 | 10 | 10 | APROBADO |
| HEX-05 | Horas Extras y Feriados | 100/100 | 10 | 10 | 10 | APROBADO |
| HEX-06 | Horas Extras y Feriados | 87/100 | 6 | 10 | 10 | APROBADO |
| LIQ-01 | Acciones de Liquidación | 58/100 | 3.33 | 4 | 10 | REPROBADO |
| LIQ-02 | Acciones de Liquidación | 58/100 | 3.33 | 4 | 10 | REPROBADO |
| LIQ-03 | Acciones de Liquidación | 58/100 | 3.33 | 4 | 10 | REPROBADO |
| LIQ-04 | Acciones de Liquidación | 0/100 | 0 | 0 | 0 | REPROBADO |
| LIQ-05 | Acciones de Liquidación | 100/100 | 10 | 10 | 10 | APROBADO |
| LIQ-06 | Acciones de Liquidación | 58/100 | 3.33 | 4 | 10 | REPROBADO |
| DOC-01 | Acciones de Documentos | 100/100 | 10 | 10 | 10 | APROBADO |
| DOC-02 | Acciones de Documentos | 80/100 | 10 | 4 | 10 | APROBADO |
| DOC-03 | Acciones de Documentos | 80/100 | 10 | 4 | 10 | APROBADO |
| DOC-04 | Acciones de Documentos | 80/100 | 10 | 4 | 10 | APROBADO |
| DOC-05 | Acciones de Documentos | 47/100 | 0 | 4 | 10 | REPROBADO |
| DOC-06 | Acciones de Documentos | 93/100 | 10 | 8 | 10 | APROBADO |
| SEC-01 | Ciberseguridad y Prescripción | 100/100 | 10 | 10 | 10 | APROBADO |
| SEC-02 | Ciberseguridad y Prescripción | 77/100 | 6 | 7 | 10 | APROBADO |
| SEC-03 | Ciberseguridad y Prescripción | 100/100 | 10 | 10 | 10 | APROBADO |
| SEC-04 | Ciberseguridad y Prescripción | 100/100 | 10 | 10 | 10 | APROBADO |
| SEC-05 | Ciberseguridad y Prescripción | 100/100 | 10 | 10 | 10 | APROBADO |
| SEC-06 | Ciberseguridad y Prescripción | 100/100 | 10 | 10 | 10 | APROBADO |

## 4. Fallas detectadas

### SMV-02 — Trampa SMV vencido (83/100)

- Falta patrón requerido: /(?:vencido|viejo|desactualizado|2024|no vigente)/i

### FRA-01 — Factura con exclusividad (0/100)

- Error de llamada: `TIMEOUT (120000ms excedido)`
- Error de llamada a Ollama: TIMEOUT (120000ms excedido)

### FRA-02 — Renuncia forzada (0/100)

- Error de llamada: `TIMEOUT (120000ms excedido)`
- Error de llamada a Ollama: TIMEOUT (120000ms excedido)

### FRA-05 — Factura para evitar indemnización (83/100)

- Falta patrón requerido: /Art(?:ículo|\.)?\s*19/i

### FRA-06 — Chofer facturante a despedir (0/100)

- Error de llamada: `TIMEOUT (120000ms excedido)`
- Error de llamada a Ollama: TIMEOUT (120000ms excedido)

### HEX-02 — Hora extra nocturna (83/100)

- Falta patrón requerido: /100\s*%/

### LIQ-01 — Despido sin causa (58/100)

- Falta patrón requerido: /:::liquidacion_action/
- Falta patrón requerido: /:::/
- No se emitió bloque :::liquidacion_action

### LIQ-02 — Renuncia voluntaria (58/100)

- Falta patrón requerido: /:::liquidacion_action/
- Falta patrón requerido: /:::/
- No se emitió bloque :::liquidacion_action

### LIQ-03 — Despido con causa (58/100)

- Falta patrón requerido: /:::liquidacion_action/
- Falta patrón requerido: /:::/
- No se emitió bloque :::liquidacion_action

### LIQ-04 — Retiro justificado (0/100)

- Error de llamada: `TIMEOUT (120000ms excedido)`
- Error de llamada a Ollama: TIMEOUT (120000ms excedido)

### LIQ-06 — Jubilación (58/100)

- Falta patrón requerido: /:::liquidacion_action/
- Falta patrón requerido: /:::/
- No se emitió bloque :::liquidacion_action

### DOC-05 — Despido injustificado (47/100)

- Falta patrón requerido: /:::documento_action/
- Falta patrón requerido: /"tipo"/
- Falta patrón requerido: /:::/
- No se emitió bloque :::documento_action

## 5. Artefactos generados

- `scripts/night_calibration_progress.json`
- `reports/tobi_stress_test_report.json`
- `datasets/tobi_gold_dataset_50.jsonl`
- `datasets/tobi_gold_dataset_50.json`

## 6. Recomendaciones

- Reforzar `Fraude Laboral`: aprobación de 33.33%. Revisar casos fallidos y ajustar ejemplos de calibración.
- Reforzar `Acciones de Liquidación`: aprobación de 16.67%. Revisar casos fallidos y ajustar ejemplos de calibración.
