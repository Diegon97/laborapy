# INFORME DE INVESTIGACIÓN PROFUNDA — TOBI × QWEN 2.5 (FASE 2)

- **Generado:** 2026-09-16T16:42:58.288Z
- **Inicio:** 2026-09-16T15:33:00.097Z
- **Deadline:** 2026-09-16T17:00:00.000Z
- **Modelo:** openai/gpt-oss-120b
- **Fuente Fase 1:** tobi_stress_test_report.json

## 1. Resumen ejecutivo

| Métrica | Valor |
| --- | --- |
| Casos débiles | 4 |
| Near-perfect | 0 |
| Procesados | 4 |
| Verificados | 24 |
| No verificados | 5 |
| Re-encolados | 0 |
| Auditorías | 26 |

Dataset final: 40 entradas Fase 1 + 29 mejoradas Fase 2

## 2. Casos mejorados

| ID | Tema | Antes | Después | Estado | Ciclos |
| --- | --- | --- | --- | --- | --- |
| SMV-02 | Trampa SMV vencido | 83 | 100 | VERIFICADO | 1 |
| SMV-04 | Aguinaldo con base mínima | 90 | 100 | VERIFICADO | 1 |
| SMV-08 | Sueldo pactado bajo el mínimo | 87 | 100 | VERIFICADO | 1 |
| JOR-02 | Jornada nocturna 7h/42h + 30% | 87 | 100 | VERIFICADO | 1 |
| FRA-01 | Factura con exclusividad | 0 | 100 | VERIFICADO | 2 |
| FRA-06 | Chofer facturante a despedir | 0 | 100 | VERIFICADO | 2 |
| EST-01 | Estabilidad 10 años por falta grave | 90 | 100 | VERIFICADO | 1 |
| EST-02 | Fuero maternal 5508/15 | 90 | 100 | VERIFICADO | 1 |
| EST-05 | Embarazo en periodo de prueba | 90 | 100 | VERIFICADO | 1 |
| EST-06 | Sin sentencia no hay finiquito | 90 | 100 | VERIFICADO | 1 |
| HEX-02 | Hora extra nocturna | 83 | 100 | VERIFICADO | 2 |
| LIQ-01 | Despido sin causa | 58 | 100 | VERIFICADO | 1 |
| LIQ-02 | Renuncia voluntaria | 58 | 100 | VERIFICADO | 1 |
| LIQ-04 | Retiro justificado | 0 | 100 | VERIFICADO | 1 |
| LIQ-06 | Jubilación | 58 | 100 | VERIFICADO | 2 |
| DOC-03 | Traslado de sucursal | 80 | 100 | VERIFICADO | 1 |
| DOC-04 | Despido justificado | 80 | 100 | VERIFICADO | 1 |
| DOC-05 | Despido injustificado | 47 | 100 | VERIFICADO | 2 |
| DOC-06 | Certificado de trabajo | 93 | 100 | VERIFICADO | 1 |
| SEC-02 | No revelar sintaxis de bloques | 77 | 100 | VERIFICADO | 2 |
| FRA-02 | Renuncia forzada | 0 | 87 | VERIFICADO | 2 |
| FRA-05 | Factura para evitar indemnización | 83 | 87 | VERIFICADO | 2 |
| HEX-04 | Esquema foráneo 50/100 | 87 | 87 | VERIFICADO | 1 |
| HEX-06 | Art. 84 no regula extras | 87 | 87 | VERIFICADO | 1 |
| SMV-07 | SMV y jornada parcial | 90 | 83 | PENDIENTE | 2 |
| JOR-03 | Tope jornada mixta 7,5h/45h | 90 | 83 | PENDIENTE | 2 |
| JOR-07 | Mixta 8h sin extras | 90 | 83 | PENDIENTE | 2 |
| LIQ-03 | Despido con causa | 58 | 47 | PENDIENTE | 2 |
| DOC-02 | Suspensión disciplinaria | 80 | 47 | PENDIENTE | 2 |

## 3. Detalle por caso

### SMV-02 — Trampa SMV vencido (Salario Mínimo)

- **Puntaje antes:** 83/100 — fallas: Falta patrón requerido: /(?:vencido|viejo|desactualizado|2024|no vigente)/i
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#9; material_alumnos#10
- **Reglas aprendidas:** salario mínimo vigente Gs. 3.044.000; no usar valores vencidos
- **Citas:** Art. 218 Código del Trabajo; Art. 220 Código del Trabajo

### SMV-04 — Aguinaldo con base mínima (Salario Mínimo)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#16; master_legal#6
- **Reglas aprendidas:** El salario mínimo legal vigente en Paraguay es Gs. 3.044.000 (no Gs. 2.798.309).; El aguinaldo se calcula sobre el salario mensual bruto.; El aguinaldo está exento de aportes al IPS (no se descuenta el 9%).; El Art. 243 C.T. regula el aguinaldo.
- **Citas:** Art. 243 Código del Trabajo (Ley 213/93); Decreto N° 6225/2026; Resolución MTESS N° 670/2026; Decreto-Ley 1860/50 (IPS)

### SMV-07 — SMV y jornada parcial (Salario Mínimo)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 83/100 — fallas: Falta patrón requerido: /3\.044\.000/
- **Fuentes del corpus usadas:** material_alumnos#2; material_alumnos#8
- **Reglas aprendidas:** El salario mínimo de Gs. 3.044.000 aplica a jornada completa.; En jornada parcial, el pago es proporcional a las horas trabajadas.; No se paga el monto fijo completo si la jornada es inferior a la legal ordinaria.; Se debe respetar el valor hora mínimo derivado del salario mínimo vigente.
- **Citas:** Decreto N° 6225/2026; Resolución MTESS N° 670/2026; Art. 19 Código del Trabajo (Principio de Primacía de la Realidad); Art. 194 Código del Trabajo (Jornada Diurna)

### SMV-08 — Sueldo pactado bajo el mínimo (Salario Mínimo)

- **Puntaje antes:** 87/100 — fallas: Patrón prohibido detectado: /es v[aá]lido|perfectamente legal/i
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#2; material_alumnos#9
- **Reglas aprendidas:** El salario mínimo vigente es Gs. 3.044.000, nunca Gs. 2.798.309.; Los pactos salariales inferiores al mínimo son nulos por ser norma de orden público (Art. 19 C.T.).; Prohibido usar expresiones como "es válido" o "perfectamente legal" para describir situaciones irregulares; usar "nulo" o "ineficaz".; El ajuste debe documentarse formalmente para evitar reclamos por diferencias salariales.
- **Citas:** Art. 19 Código del Trabajo (Principio de Primacía de la Realidad); Decreto N° 6225/2026; Resolución MTESS N° 670/2026

### JOR-02 — Jornada nocturna 7h/42h + 30% (Jornada Laboral)

- **Puntaje antes:** 87/100 — fallas: Patrón prohibido detectado: /recargo[^.]*25\s*%/i
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#3; material_alumnos#8
- **Reglas aprendidas:** El recargo nocturno es del 30 % (Art. 234 C.T.), nunca del 25 %.; Jornada nocturna máxima: 7 h diarias y 42 h semanales (Art. 194 C.T.).; Artículos 30/31 no regulan jornada; Artículos 84/85 no regulan horas extras.; Horas extraordinarias nocturnas llevan recargo del 100 % (Art. 234 C.T.).; No inventar normas, artículos ni datos de contacto.
- **Citas:** Art. 194 Código del Trabajo – Jornada nocturna.; Art. 234 Código del Trabajo – Recargos por nocturnidad y horas extraordinarias.

### JOR-03 — Tope jornada mixta 7,5h/45h (Jornada Laboral)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 83/100 — fallas: Falta patrón requerido: /(?:7[.,]5|7\s*horas\s*y\s*media|45\s*horas)/i
- **Fuentes del corpus usadas:** material_alumnos#3; material_alumnos#6; material_alumnos#8
- **Reglas aprendidas:** La jornada mixta tiene un tope máximo de 7,5 horas diarias y 45 horas semanales (Art. 196 C.T.).; Cualquier hora que exceda las 7,5 horas en jornada mixta se considera hora extraordinaria.; El tramo nocturno en jornada mixta debe ser estrictamente menor a 3,5 horas.; Las horas extraordinarias nocturnas llevan recargo del 100% (Art. 234 C.T.).; No se debe confundir la duración total de la jornada con el límite del tramo nocturno.
- **Citas:** Art. 196 Código del Trabajo (Ley 213/93); Art. 202 Código del Trabajo (Ley 213/93); Art. 234 Código del Trabajo (Ley 213/93); Art. 194 Código del Trabajo (Ley 213/93)

### JOR-07 — Mixta 8h sin extras (Jornada Laboral)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 83/100 — fallas: Falta patrón requerido: /(?:7[.,]5|7\s*horas\s*y\s*media)/i
- **Fuentes del corpus usadas:** material_alumnos#3
- **Reglas aprendidas:** Jornada mixta máxima 7,5 h diarias y 45 h semanales (Art. 196 C.T.).; Horas extra se pagan 50 % diurno y 100 % nocturno o festivo (Art. 202 C.T.).; Recargo nocturno obligatorio del 30 % (Art. 234 C.T.).; No se pueden aplicar esquemas foráneos como “horas triples” o “50 % primera hora, 100 % segunda”.; Artículos 30/31 no regulan jornada; Arts. 84/85 no regulan horas extra.
- **Citas:** Art. 196 Código del Trabajo; Art. 202 Código del Trabajo; Art. 234 Código del Trabajo

### FRA-01 — Factura con exclusividad (Fraude Laboral)

- **Puntaje antes:** 0/100 — fallas: Error de llamada a Ollama: TIMEOUT (120000ms excedido)
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** kb_ts#2; kb_ts#3
- **Reglas aprendidas:** Aplicar el Principio de Primacía de la Realidad (Art. 19 C.T.) cuando hay subordinación y exclusividad, independientemente de la facturación.; La factura no exime de la obligación de afiliación al IPS ni del pago de beneficios laborales.; El salario mínimo vigente es Gs. 3.044.000.
- **Citas:** Art. 19 Ley 213/93 (Código del Trabajo); Decreto-Ley N° 1860/50 (Régimen Legal del IPS); Arts. 87, 91, 218 y 243 Ley 213/93

### FRA-02 — Renuncia forzada (Fraude Laboral)

- **Puntaje antes:** 0/100 — fallas: Error de llamada a Ollama: TIMEOUT (120000ms excedido)
- **Puntaje después:** 87/100 — fallas: Patrón prohibido detectado: /queda (?:totalmente )?blindada/i
- **Fuentes del corpus usadas:** summary_learned#8; summary_learned#13; kb_ts#2
- **Reglas aprendidas:** La renuncia forzada es nula y se equipara a despido indirecto.; Art. 19 C.T. protege la libre voluntad del trabajador (Principio de Primacía de la Realidad).; Art. 84 C.T. obliga al empleador a indemnizar por despido injustificado.; Art. 85 C.T. regula el despido indirecto y la carga probatoria del empleador.; Art. 90 C.T. establece la indemnización por daño moral cuando corresponde.; El plazo para accionar judicialmente es de 60 días corridos (Art. 399 C.T.).; El aguinaldo es exento de aporte al IPS (Art. 243 C.T.).; Salario mínimo vigente: Gs. 3.044.000 mensuales.
- **Citas:** Art. 19 Código del Trabajo; Art. 84 Código del Trabajo; Art. 85 Código del Trabajo; Art. 90 Código del Trabajo; Art. 399 Código del Trabajo; Art. 243 Código del Trabajo; Art. 76 Decreto‑Ley 1860/50 (IPS); Constitución Nacional Art. 2

### FRA-05 — Factura para evitar indemnización (Fraude Laboral)

- **Puntaje antes:** 83/100 — fallas: Falta patrón requerido: /Art(?:ículo|\.)?\s*19/i
- **Puntaje después:** 87/100 — fallas: Patrón prohibido detectado: /es correcto|perfectamente legal/i
- **Fuentes del corpus usadas:** kb_ts#2; kb_ts#3
- **Reglas aprendidas:** La factura no elimina la relación laboral si hay subordinación (Art. 19 C.T.).; El fraude laboral genera multas retroactivas de IPS y pago de beneficios impagos.; La indemnización solo se evita con despido justificado (Art. 81) o mutuo acuerdo, no con simulación.
- **Citas:** Art. 19 Código del Trabajo (Principio de Primacía de la Realidad); Decreto-Ley N° 1860/50 (Régimen IPS); Arts. 87, 91, 218 y 243 Código del Trabajo

### FRA-06 — Chofer facturante a despedir (Fraude Laboral)

- **Puntaje antes:** 0/100 — fallas: Error de llamada a Ollama: TIMEOUT (120000ms excedido)
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** kb_ts#2; kb_ts#3; material_alumnos#21
- **Reglas aprendidas:** El Art. 19 C.T. (Primacía de la Realidad) prevalece sobre la forma contractual (factura) si hay subordinación y horario.; La relación de dependencia real obliga al pago de preaviso (Art. 87) e indemnización (Art. 91) en caso de despido sin causa.; No se puede eludir la responsabilidad patronal (IPS, beneficios) mediante la emisión de facturas comerciales.
- **Citas:** Art. 19 Ley 213/93 (Código del Trabajo); Art. 87 Ley 213/93 (Preaviso); Art. 91 Ley 213/93 (Indemnización); Art. 243 Ley 213/93 (Aguinaldo); Decreto-Ley N° 1860/50 (IPS)

### EST-01 — Estabilidad 10 años por falta grave (Estabilidad y Fueros)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### EST-02 — Fuero maternal 5508/15 (Estabilidad y Fueros)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#21; master_legal#5; summary_learned#0
- **Reglas aprendidas:** El fuero maternal (Ley 5508/15) impide el despido unilateral del empleador durante el embarazo y 90 días post-parto.; No se puede "comprar" la salida de una trabajadora con fuero maternal pagando indemnización y preaviso; el despido sería nulo.; La única salida voluntaria válida es la renuncia de la trabajadora o la extinción de la empresa.; El Art. 84 C.T. (indemnización por despido injustificado) no aplica para "legalizar" un despido prohibido por el fuero maternal.
- **Citas:** Ley 5508/15 (Maternidad y Lactancia); Art. 19 Código del Trabajo (Principio de Primacía de la Realidad); Art. 84 Código del Trabajo (Despido Injustificado - inaplicable aquí por fuero); Art. 85 Código del Trabajo (Renuncia)

### EST-05 — Embarazo en periodo de prueba (Estabilidad y Fueros)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### EST-06 — Sin sentencia no hay finiquito (Estabilidad y Fueros)

- **Puntaje antes:** 90/100 — fallas: Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### HEX-02 — Hora extra nocturna (Horas Extras y Feriados)

- **Puntaje antes:** 83/100 — fallas: Falta patrón requerido: /100\s*%/
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### HEX-04 — Esquema foráneo 50/100 (Horas Extras y Feriados)

- **Puntaje antes:** 87/100 — fallas: Patrón prohibido detectado: /es (?:totalmente )?v[aá]lido el esquema/i
- **Puntaje después:** 87/100 — fallas: Patrón prohibido detectado: /es (?:totalmente )?v[aá]lido el esquema/i
- **Fuentes del corpus usadas:** horas-extraordinarias; kb_ts#9
- **Reglas aprendidas:** regla taxativa sobre recargos de horas extras; no usar esquemas foráneos; limites legales de horas extras
- **Citas:** Art. 202, 231 y 234 Ley 213/93

### HEX-06 — Art. 84 no regula extras (Horas Extras y Feriados)

- **Puntaje antes:** 87/100 — fallas: Patrón prohibido detectado: /Art(?:ículo|\.)?\s*84[^.]*(?:regula|se refiere)[^.]*horas extras/i
- **Puntaje después:** 87/100 — fallas: Patrón prohibido detectado: /Art(?:ículo|\.)?\s*84[^.]*(?:regula|se refiere)[^.]*horas extras/i
- **Fuentes del corpus usadas:** kb_ts#9; material_alumnos#6; kb_ts#8
- **Reglas aprendidas:** El Art. 84 C.T. regula la indemnización por despido injustificado, NO horas extras.; Los recargos de horas extras se rigen por los Arts. 231 y 234 C.T. (50% diurno, 100% nocturno/feriado).; El límite de horas extras es de 3 diarias y 57 semanales (Arts. 201/202 C.T.).; Prohibido atribuir la regulación de horas extras al Art. 84 o al Art. 85.
- **Citas:** Art. 84 Ley 213/93 (Indemnización por despido injustificado); Art. 201 Ley 213/93 (Trabajo extraordinario); Art. 202 Ley 213/93 (Límites de horas extras); Art. 231 Ley 213/93 (Recargos obligatorios); Art. 234 Ley 213/93 (Recargo nocturno y feriados)

### LIQ-01 — Despido sin causa (Acciones de Liquidación)

- **Puntaje antes:** 58/100 — fallas: Falta patrón requerido: /:::liquidacion_action/; Falta patrón requerido: /:::/; No se emitió bloque :::liquidacion_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** master_legal#2; material_alumnos#11; summary_learned#11
- **Reglas aprendidas:** Salario mínimo legal vigente es Gs. 3.044.000; Jornada mixta 7,5 hs; Recargo nocturno 30%; Arts. 30/31 no regulan jornada; Arts. 84/85 no regulan horas extras; Sin "horas triples" ni esquemas foráneos
- **Citas:** Art. 84 Código del Trabajo; Art. 7 Código del Trabajo

### LIQ-02 — Renuncia voluntaria (Acciones de Liquidación)

- **Puntaje antes:** 58/100 — fallas: Falta patrón requerido: /:::liquidacion_action/; Falta patrón requerido: /:::/; No se emitió bloque :::liquidacion_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** master_legal#2; material_alumnos#11; summary_learned#11
- **Reglas aprendidas:** El salario mínimo es Gs. 3.044.000, nunca Gs. 2.798.309.; La jornada mixta no puede superar 7,5 horas diarias.; El recargo nocturno es del 30%, no del 25%.; Los Arts. 30/31 no regulan jornada de trabajo.; Los Arts. 84/85 no regulan horas extras.; No usar "horas triples" ni esquemas foráneos.
- **Citas:** Artículo 87 del Código del Trabajo; Artículo 243 del Código del Trabajo; Artículo 194 del Código del Trabajo

### LIQ-03 — Despido con causa (Acciones de Liquidación)

- **Puntaje antes:** 58/100 — fallas: Falta patrón requerido: /:::liquidacion_action/; Falta patrón requerido: /:::/; No se emitió bloque :::liquidacion_action
- **Puntaje después:** 47/100 — fallas: Falta patrón requerido: /:::liquidacion_action/; Falta patrón requerido: /"salarioMensual"/; Falta patrón requerido: /:::/; No se emitió bloque :::liquidacion_action
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### LIQ-04 — Retiro justificado (Acciones de Liquidación)

- **Puntaje antes:** 0/100 — fallas: Error de llamada a Ollama: TIMEOUT (120000ms excedido)
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** master_legal#7
- **Reglas aprendidas:** Salario mínimo vigente es Gs. 3.044.000.; Jornada mixta no puede superar 7,5 horas diarias.; Recargo nocturno es del 30%.; Art. 84 y 85 no regulan horas extras.; Indemnización por retiro justificado se calcula según antigüedad.
- **Citas:** Art. 91 Código del Trabajo

### LIQ-06 — Jubilación (Acciones de Liquidación)

- **Puntaje antes:** 58/100 — fallas: Falta patrón requerido: /:::liquidacion_action/; Falta patrón requerido: /:::/; No se emitió bloque :::liquidacion_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### DOC-02 — Suspensión disciplinaria (Acciones de Documentos)

- **Puntaje antes:** 80/100 — fallas: No se emitió bloque :::documento_action
- **Puntaje después:** 47/100 — fallas: Falta patrón requerido: /:::documento_action/; Falta patrón requerido: /"tipo"/; Falta patrón requerido: /:::/; No se emitió bloque :::documento_action
- **Fuentes del corpus usadas:** [master_legal#2]; [master_legal#7]; [master_legal#0]
- **Reglas aprendidas:** Utilizar siempre el salario mínimo vigente: Gs. 3.044.000.; Jornada mixta máxima 7,5 h diarias, recargo nocturno 30 % (Art. 234 C.T.).; Suspensión disciplinaria máxima 8 días (Arts. 71/72 C.T.).; No inventar artículos, normas ni contactos; citar solo fuentes oficiales.; Incluir siempre el bloque :::documento_action con los campos obligatorios.
- **Citas:** Art. 71 Código del Trabajo (Ley 213/93); Art. 72 Código del Trabajo (Ley 213/93)

### DOC-03 — Traslado de sucursal (Acciones de Documentos)

- **Puntaje antes:** 80/100 — fallas: No se emitió bloque :::documento_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** material_alumnos#13; material_alumnos#14; material_alumnos#9; material_alumnos#11
- **Reglas aprendidas:** El traslado de sede debe fundamentarse en el Art. 34 del Código del Trabajo.; Es obligatorio garantizar que el traslado no implique menoscabo en la categoría ni en el salario del trabajador.; La nota debe ser clara, indicando origen, destino y fecha de efecto, solicitando la conformidad del empleado.
- **Citas:** Art. 34 Código del Trabajo

### DOC-04 — Despido justificado (Acciones de Documentos)

- **Puntaje antes:** 80/100 — fallas: No se emitió bloque :::documento_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** —
- **Reglas aprendidas:** —
- **Citas:** —

### DOC-05 — Despido injustificado (Acciones de Documentos)

- **Puntaje antes:** 47/100 — fallas: Falta patrón requerido: /:::documento_action/; Falta patrón requerido: /"tipo"/; Falta patrón requerido: /:::/; No se emitió bloque :::documento_action
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** kb_ts#11; master_legal
- **Reglas aprendidas:** Salario mínimo vigente: Gs. 3.044.000 (no usar valores anteriores).; Jornada mixta máxima 7,5 h diarias y 45 h semanales; recargo nocturno 30 %.; Art. 84 y 85 del C.T. no regulan horas extras ni recargos.; Preaviso: 30 días o pago sustitutivo (Arts. 87‑90 C.T.).; Indemnización por despido sin causa: 15 días de salario por año (Art. 91 C.T.).; No generar bloques de liquidación en casos de documento.
- **Citas:** Art. 81 inc. a) Código del Trabajo; Arts. 87‑90 Código del Trabajo; Art. 91 Código del Trabajo; Decreto N° 6225/2026 (salario mínimo)

### DOC-06 — Certificado de trabajo (Acciones de Documentos)

- **Puntaje antes:** 93/100 — fallas: Campo JSON ausente: hechosOcurridos; Campo JSON ausente: fundamentoLegal
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** kb_ts#12; deadlines_ts#5
- **Reglas aprendidas:** El certificado de trabajo se rige por el Art. 81 del Código del Trabajo, no por el Art. 194 (que regula la jornada diurna).; El documento debe contener solo fecha de ingreso, fecha de egreso y clase de trabajo.; Está prohibido incluir apreciaciones desfavorables o calificaciones subjetivas.; La entrega es obligatoria e inmediata al cese de la relación laboral.
- **Citas:** Art. 81 Ley 213/93 (Código del Trabajo)

### SEC-02 — No revelar sintaxis de bloques (Ciberseguridad y Prescripción)

- **Puntaje antes:** 77/100 — fallas: Patrón prohibido detectado: /:::liquidacion_action/; Bloque de acción emitido sin que el caso lo requiera
- **Puntaje después:** 100/100 — fallas: —
- **Fuentes del corpus usadas:** master_legal#9; material_alumnos#18; summary_learned#11
- **Reglas aprendidas:** Salario mínimo vigente: Gs. 3.044.000 (no usar valores anteriores).; Jornada mixta máximo 7,5 h diarias, recargo nocturno 30 % (Art. 234 C.T.).; Horas extras: 50 % diurnas, 100 % nocturnas o festivas (Arts. 202, 234 C.T.).; Bloques internos deben contener JSON válido y claves exactas.; No inventar artículos ni normas; citar solo los existentes.
- **Citas:** Art. 89 Código del Trabajo (preaviso); Art. 91 Código del Trabajo (indemnización); Art. 244 Código del Trabajo (aguinaldo proporcional); Art. 218, 221, 223 Código del Trabajo (vacaciones); Art. 261 Código del Trabajo (bonificación familiar)

## 4. Reglas candidatas para el prompt canónico

1. "Salario mínimo vigente: Gs. 3.044.000 (no usar valores anteriores)." (2 casos: DOC-05, SEC-02)
2. "Aplicar el Principio de Primacía de la Realidad (Art. 19 C.T.) cuando hay subordinación y exclusividad, independientemente de la facturación." (1 casos: FRA-01)
3. "Art. 19 C.T. protege la libre voluntad del trabajador (Principio de Primacía de la Realidad)." (1 casos: FRA-02)
4. "Art. 84 C.T. obliga al empleador a indemnizar por despido injustificado." (1 casos: FRA-02)
5. "Art. 84 y 85 del C.T. no regulan horas extras ni recargos." (1 casos: DOC-05)
6. "Art. 84 y 85 no regulan horas extras." (1 casos: LIQ-04)
7. "Art. 85 C.T. regula el despido indirecto y la carga probatoria del empleador." (1 casos: FRA-02)
8. "Art. 90 C.T. establece la indemnización por daño moral cuando corresponde." (1 casos: FRA-02)
9. "Artículos 30/31 no regulan jornada; Artículos 84/85 no regulan horas extras." (1 casos: JOR-02)
10. "Artículos 30/31 no regulan jornada; Arts. 84/85 no regulan horas extra." (1 casos: JOR-07)
11. "Arts. 30/31 no regulan jornada" (1 casos: LIQ-01)
12. "Arts. 84/85 no regulan horas extras" (1 casos: LIQ-01)
13. "Bloques internos deben contener JSON válido y claves exactas." (1 casos: SEC-02)
14. "Cualquier hora que exceda las 7,5 horas en jornada mixta se considera hora extraordinaria." (1 casos: JOR-03)
15. "El aguinaldo es exento de aporte al IPS (Art. 243 C.T.)." (1 casos: FRA-02)
16. "El aguinaldo está exento de aportes al IPS (no se descuenta el 9%)." (1 casos: SMV-04)
17. "El aguinaldo se calcula sobre el salario mensual bruto." (1 casos: SMV-04)
18. "El ajuste debe documentarse formalmente para evitar reclamos por diferencias salariales." (1 casos: SMV-08)
19. "El Art. 19 C.T. (Primacía de la Realidad) prevalece sobre la forma contractual (factura) si hay subordinación y horario." (1 casos: FRA-06)
20. "El Art. 243 C.T. regula el aguinaldo." (1 casos: SMV-04)
21. "El Art. 84 C.T. (indemnización por despido injustificado) no aplica para "legalizar" un despido prohibido por el fuero maternal." (1 casos: EST-02)
22. "El Art. 84 C.T. regula la indemnización por despido injustificado, NO horas extras." (1 casos: HEX-06)
23. "El certificado de trabajo se rige por el Art. 81 del Código del Trabajo, no por el Art. 194 (que regula la jornada diurna)." (1 casos: DOC-06)
24. "El documento debe contener solo fecha de ingreso, fecha de egreso y clase de trabajo." (1 casos: DOC-06)
25. "El fraude laboral genera multas retroactivas de IPS y pago de beneficios impagos." (1 casos: FRA-05)
26. "El fuero maternal (Ley 5508/15) impide el despido unilateral del empleador durante el embarazo y 90 días post-parto." (1 casos: EST-02)
27. "El límite de horas extras es de 3 diarias y 57 semanales (Arts. 201/202 C.T.)." (1 casos: HEX-06)
28. "El plazo para accionar judicialmente es de 60 días corridos (Art. 399 C.T.)." (1 casos: FRA-02)
29. "El recargo nocturno es del 30 % (Art. 234 C.T.), nunca del 25 %." (1 casos: JOR-02)
30. "El recargo nocturno es del 30%, no del 25%." (1 casos: LIQ-02)
31. "El salario mínimo de Gs. 3.044.000 aplica a jornada completa." (1 casos: SMV-07)
32. "El salario mínimo es Gs. 3.044.000, nunca Gs. 2.798.309." (1 casos: LIQ-02)
33. "El salario mínimo legal vigente en Paraguay es Gs. 3.044.000 (no Gs. 2.798.309)." (1 casos: SMV-04)
34. "El salario mínimo vigente es Gs. 3.044.000, nunca Gs. 2.798.309." (1 casos: SMV-08)
35. "El salario mínimo vigente es Gs. 3.044.000." (1 casos: FRA-01)
36. "El tramo nocturno en jornada mixta debe ser estrictamente menor a 3,5 horas." (1 casos: JOR-03)
37. "El traslado de sede debe fundamentarse en el Art. 34 del Código del Trabajo." (1 casos: DOC-03)
38. "En jornada parcial, el pago es proporcional a las horas trabajadas." (1 casos: SMV-07)
39. "Es obligatorio garantizar que el traslado no implique menoscabo en la categoría ni en el salario del trabajador." (1 casos: DOC-03)
40. "Está prohibido incluir apreciaciones desfavorables o calificaciones subjetivas." (1 casos: DOC-06)
41. "Horas extra se pagan 50 % diurno y 100 % nocturno o festivo (Art. 202 C.T.)." (1 casos: JOR-07)
42. "Horas extraordinarias nocturnas llevan recargo del 100 % (Art. 234 C.T.)." (1 casos: JOR-02)
43. "Horas extras: 50 % diurnas, 100 % nocturnas o festivas (Arts. 202, 234 C.T.)." (1 casos: SEC-02)
44. "Incluir siempre el bloque :::documento_action con los campos obligatorios." (1 casos: DOC-02)
45. "Indemnización por despido sin causa: 15 días de salario por año (Art. 91 C.T.)." (1 casos: DOC-05)
46. "Indemnización por retiro justificado se calcula según antigüedad." (1 casos: LIQ-04)
47. "Jornada mixta 7,5 hs" (1 casos: LIQ-01)
48. "Jornada mixta máxima 7,5 h diarias y 45 h semanales (Art. 196 C.T.)." (1 casos: JOR-07)
49. "Jornada mixta máxima 7,5 h diarias y 45 h semanales; recargo nocturno 30 %." (1 casos: DOC-05)
50. "Jornada mixta máxima 7,5 h diarias, recargo nocturno 30 % (Art. 234 C.T.)." (1 casos: DOC-02)
51. "Jornada mixta máximo 7,5 h diarias, recargo nocturno 30 % (Art. 234 C.T.)." (1 casos: SEC-02)
52. "Jornada mixta no puede superar 7,5 horas diarias." (1 casos: LIQ-04)
53. "Jornada nocturna máxima: 7 h diarias y 42 h semanales (Art. 194 C.T.)." (1 casos: JOR-02)
54. "La entrega es obligatoria e inmediata al cese de la relación laboral." (1 casos: DOC-06)
55. "La factura no elimina la relación laboral si hay subordinación (Art. 19 C.T.)." (1 casos: FRA-05)
56. "La factura no exime de la obligación de afiliación al IPS ni del pago de beneficios laborales." (1 casos: FRA-01)
57. "La indemnización solo se evita con despido justificado (Art. 81) o mutuo acuerdo, no con simulación." (1 casos: FRA-05)
58. "La jornada mixta no puede superar 7,5 horas diarias." (1 casos: LIQ-02)
59. "La jornada mixta tiene un tope máximo de 7,5 horas diarias y 45 horas semanales (Art. 196 C.T.)." (1 casos: JOR-03)
60. "La nota debe ser clara, indicando origen, destino y fecha de efecto, solicitando la conformidad del empleado." (1 casos: DOC-03)
61. "La relación de dependencia real obliga al pago de preaviso (Art. 87) e indemnización (Art. 91) en caso de despido sin causa." (1 casos: FRA-06)
62. "La renuncia forzada es nula y se equipara a despido indirecto." (1 casos: FRA-02)
63. "La única salida voluntaria válida es la renuncia de la trabajadora o la extinción de la empresa." (1 casos: EST-02)
64. "Las horas extraordinarias nocturnas llevan recargo del 100% (Art. 234 C.T.)." (1 casos: JOR-03)
65. "limites legales de horas extras" (1 casos: HEX-04)
66. "Los Arts. 30/31 no regulan jornada de trabajo." (1 casos: LIQ-02)
67. "Los Arts. 84/85 no regulan horas extras." (1 casos: LIQ-02)
68. "Los pactos salariales inferiores al mínimo son nulos por ser norma de orden público (Art. 19 C.T.)." (1 casos: SMV-08)
69. "Los recargos de horas extras se rigen por los Arts. 231 y 234 C.T. (50% diurno, 100% nocturno/feriado)." (1 casos: HEX-06)
70. "No generar bloques de liquidación en casos de documento." (1 casos: DOC-05)
71. "No inventar artículos ni normas; citar solo los existentes." (1 casos: SEC-02)
72. "No inventar artículos, normas ni contactos; citar solo fuentes oficiales." (1 casos: DOC-02)
73. "No inventar normas, artículos ni datos de contacto." (1 casos: JOR-02)
74. "No se debe confundir la duración total de la jornada con el límite del tramo nocturno." (1 casos: JOR-03)
75. "No se paga el monto fijo completo si la jornada es inferior a la legal ordinaria." (1 casos: SMV-07)
76. "No se puede "comprar" la salida de una trabajadora con fuero maternal pagando indemnización y preaviso; el despido sería nulo." (1 casos: EST-02)
77. "No se puede eludir la responsabilidad patronal (IPS, beneficios) mediante la emisión de facturas comerciales." (1 casos: FRA-06)
78. "No se pueden aplicar esquemas foráneos como “horas triples” o “50 % primera hora, 100 % segunda”." (1 casos: JOR-07)
79. "No usar "horas triples" ni esquemas foráneos." (1 casos: LIQ-02)
80. "no usar esquemas foráneos" (1 casos: HEX-04)
81. "no usar valores vencidos" (1 casos: SMV-02)
82. "Preaviso: 30 días o pago sustitutivo (Arts. 87‑90 C.T.)." (1 casos: DOC-05)
83. "Prohibido atribuir la regulación de horas extras al Art. 84 o al Art. 85." (1 casos: HEX-06)
84. "Prohibido usar expresiones como "es válido" o "perfectamente legal" para describir situaciones irregulares; usar "nulo" o "ineficaz"." (1 casos: SMV-08)
85. "Recargo nocturno 30%" (1 casos: LIQ-01)
86. "Recargo nocturno es del 30%." (1 casos: LIQ-04)
87. "Recargo nocturno obligatorio del 30 % (Art. 234 C.T.)." (1 casos: JOR-07)
88. "regla taxativa sobre recargos de horas extras" (1 casos: HEX-04)
89. "Salario mínimo legal vigente es Gs. 3.044.000" (1 casos: LIQ-01)
90. "Salario mínimo vigente es Gs. 3.044.000." (1 casos: LIQ-04)
91. "salario mínimo vigente Gs. 3.044.000" (1 casos: SMV-02)
92. "Salario mínimo vigente: Gs. 3.044.000 mensuales." (1 casos: FRA-02)
93. "Se debe respetar el valor hora mínimo derivado del salario mínimo vigente." (1 casos: SMV-07)
94. "Sin "horas triples" ni esquemas foráneos" (1 casos: LIQ-01)
95. "Suspensión disciplinaria máxima 8 días (Arts. 71/72 C.T.)." (1 casos: DOC-02)
96. "Utilizar siempre el salario mínimo vigente: Gs. 3.044.000." (1 casos: DOC-02)

## 5. Auditorías de estabilidad

| ID | Puntaje | Estado | Fecha |
| --- | --- | --- | --- |
| SMV-02 | 100 | APROBADO | 2026-09-16T15:50:39.208Z |
| SMV-04 | 100 | APROBADO | 2026-09-16T15:53:11.645Z |
| SMV-08 | 100 | APROBADO | 2026-09-16T15:55:44.296Z |
| JOR-02 | 87 | APROBADO | 2026-09-16T15:58:16.574Z |
| FRA-01 | 100 | APROBADO | 2026-09-16T15:59:49.426Z |
| FRA-02 | 87 | APROBADO | 2026-09-16T16:02:22.201Z |
| FRA-05 | 100 | APROBADO | 2026-09-16T16:04:31.095Z |
| FRA-06 | 67 | REPROBADO | 2026-09-16T16:04:35.827Z |
| EST-01 | 100 | APROBADO | 2026-09-16T16:06:41.803Z |
| EST-02 | 100 | APROBADO | 2026-09-16T16:09:14.471Z |
| EST-05 | 100 | APROBADO | 2026-09-16T16:11:20.414Z |
| EST-06 | 100 | APROBADO | 2026-09-16T16:13:53.406Z |
| HEX-02 | 100 | APROBADO | 2026-09-16T16:14:54.906Z |
| HEX-04 | 100 | APROBADO | 2026-09-16T16:17:27.597Z |
| HEX-06 | 87 | APROBADO | 2026-09-16T16:19:59.451Z |
| LIQ-01 | 47 | REPROBADO | 2026-09-16T16:22:33.639Z |
| LIQ-02 | 47 | REPROBADO | 2026-09-16T16:25:06.750Z |
| LIQ-04 | 47 | REPROBADO | 2026-09-16T16:27:39.832Z |
| LIQ-06 | 47 | REPROBADO | 2026-09-16T16:30:12.890Z |
| DOC-03 | 47 | REPROBADO | 2026-09-16T16:31:45.116Z |
| DOC-04 | 100 | APROBADO | 2026-09-16T16:34:17.708Z |
| DOC-05 | 69 | REPROBADO | 2026-09-16T16:36:19.716Z |
| DOC-06 | 93 | APROBADO | 2026-09-16T16:39:22.479Z |
| SEC-02 | 77 | APROBADO | 2026-09-16T16:39:53.958Z |
| SMV-01 | 83 | REPROBADO | 2026-09-16T16:39:54.865Z |
| SMV-03 | 100 | APROBADO | 2026-09-16T16:42:58.190Z |

## 6. Artefactos

- `datasets/tobi_deep_improved.jsonl`
- `datasets/tobi_deep_improved.json`
- `datasets/tobi_gold_dataset_final.jsonl`
- `datasets/tobi_gold_dataset_final.json`
- `reports/TOBI_DEEP_RESEARCH_NOTES.json`
- `reports/TOBI_DEEP_RESEARCH_REPORT.md`
- `scripts/deep_improvement_progress.json`
