# PROTOCOLO GRANJERO (RAG) — ROADMAP Y DECISIÓN ARQUITECTÓNICA

## 1. Decisión Arquitectónica: Descarte Definitivo de QLoRA/LoRA
**Fecha:** 2026-09-18
**Estado:** APROBADO (Regla inmutable)

Se descarta de manera permanente el fine-tuning (QLoRA, LoRA o entrenamiento tradicional de pesos neuronales) para el agente Tobi. Todo esfuerzo de "entrenamiento", "aprendizaje" o "fine-tuning" se entenderá y ejecutará **exclusivamente** como **Ingesta de Datos en el Protocolo Granjero (RAG - Retrieval-Augmented Generation)**.

### Fundamentos (Alineación con Focus Lock y Monetización):
1. **Precisión Jurídica (0% Alucinación):** Los pesos neuronales alucinan números y artículos. El RAG lee la ley exacta en tiempo real.
2. **Mantenimiento Ágil:** Actualizar el salario mínimo o un dictamen es actualizar un registro en la base de datos, no requiere re-entrenar modelos enteros.
3. **Escudo Serverless (Margen >95%):** Evitamos el uso de servidores GPU dedicados 24/7. Operamos 100% sobre Supabase y funciones Edge en Vercel.

---

## 2. Orígenes de Datos (El Sembradío del Granjero)
Actualmente estamos procesando las siguientes fuentes para el "entrenamiento" de Tobi:
- **Leyes y Fórmulas Base:** Código Laboral Paraguayo (Ley 213/93), preaviso, indemnización, aguinaldo.
- **Dictámenes Históricos:** Dataset procesado recientemente sobre jurisprudencia y casos reales.
- **Audios y Transcripciones:** (En progreso) Consultas orales frecuentes y sus resoluciones legales exactas.

---

## 3. Roadmap de Implementación (Fases del Protocolo Granjero)

### FASE 1: Estructuración e Ingesta (El Cosechado)
- [ ] Centralizar los datasets (dictámenes y audios transcritos) en formato Markdown o JSON estructurado.
- [ ] Aplicar limpieza y "chunking" (dividir los textos largos en fragmentos semánticos con sentido propio).
- [ ] Etiquetar los fragmentos con metadatos útiles (ej. `categoria: despido_injustificado`, `fuente: dictamen_mtess`).

### FASE 2: Infraestructura y Vectorización (El Silo)
- [ ] Habilitar y configurar la extensión `pgvector` en Supabase.
- [ ] Crear la tabla `tobi_knowledge_base` con políticas RLS de solo-lectura para los usuarios.
- [ ] Desarrollar un script en Node/Python que agarre la Fase 1, pase los fragmentos por un modelo de Embeddings (ej. `text-embedding-3-small` o `voyage-law`) y los guarde en Supabase.

### FASE 3: Motor de Búsqueda y Recuperación (El Tractor)
- [ ] Crear una función RPC (Stored Procedure) en Postgres/Supabase llamada `match_knowledge` para hacer búsqueda de similitud por coseno (Cosine Similarity).
- [ ] Implementar caché ligera para consultas repetitivas.

### FASE 4: Integración en Vercel Edge (El Granjero en Acción)
- [ ] Modificar el endpoint actual `api/assistant.ts`.
- [ ] **Paso A:** Cuando el usuario envía un audio (procesado por Groq Whisper) o texto, convertir esa query en un embedding.
- [ ] **Paso B:** Ejecutar la consulta en Supabase vía RPC para obtener el contexto legal/dictamen exacto.
- [ ] **Paso C:** Inyectar el contexto recuperado en el System Prompt de Tobi bajo reglas estrictas: *"Usa EXCLUSIVAMENTE este contexto para responder. Si no está en el contexto, pide más detalles."*

---
> **Nota para el equipo:** Desde ahora, la frase "Hay que entrenar a Tobi en X tema", significa "Hay que vectorizar y subir el documento X a Supabase".