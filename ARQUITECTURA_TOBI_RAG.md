# ARQUITECTURA Y GUÍA OPERATIVA RAG — TOBI (LABORAPY)

Este documento fija la arquitectura canónica de la base de conocimiento jurídica (pgvector) y el pipeline de recuperación y enriquecimiento de Tobi.

---

## 1. ESQUEMA CANÓNICO EN SUPABASE (POSTGRESQL + PGVECTOR)

* **Archivo de referencia:** `supabase/schema_laborapy_tobi_knowledge_canonica.sql`
* **Tabla:** `public.tobi_knowledge_base`
* **Dimensión vectorial:** `768` dimensiones estrictas.
* **Métrica de distancia:** Coseno (`vector_cosine_ops`), con normalización L2 obligatoria antes del guardado.
* **Índice:** `HNSW` (`tobi_knowledge_base_embedding_idx`), optimizado para escala (>80,000 registros).
* **Índice de Metadatos:** `GIN` (`idx_tobi_kb_metadata`).

### Modelo de Seguridad (Row Level Security - RLS)
* **Lectura (`SELECT`):** Abierta a roles `anon` y `authenticated` (`USING (true)`). Diseñado como gancho freemium para que el asistente web pueda consultar precedentes sin requerir sesión iniciada.
* **Mutación (`INSERT`, `UPDATE`, `DELETE`):** Restringida exclusivamente al rol `service_role`. Ningún usuario web ni cliente anon puede inyectar ni alterar registros.

### Función RPC de Búsqueda
```sql
SELECT * FROM public.match_tobi_knowledge(
    query_embedding := '[...768 floats...]',
    match_threshold := 0.40,
    match_count := 4
);
```
* **Search Path:** `SET search_path = public, pg_temp` (protección contra Search Path Hijacking).

---

## 2. DATASET Y METADATOS (CSJ SALA LABORAL)

* **Ubicación:** `datasets/rag_chunks_csj.json` (807 registros).
* **Encoding:** UTF-8 limpio, sin caracteres corruptos ni mojibake.
* **Estructura de metadatos enriquecida:**
```json
{
  "fuente": "CSJ",
  "sala": "Laboral",
  "instancia": "Corte Suprema de Justicia",
  "jurisdiccion": "Paraguay",
  "tipo": "jurisprudencia_dictamen",
  "index_origen": 0,
  "resolucion": "A. y S. N° 135/1995",
  "anio": 1995,
  "articulos_citados": [
    "Ley N° 126/91"
  ]
}
```

---

## 3. PIPELINE DE INGESTA CANÓNICO

* **Script:** `scripts/ingest_csj_knowledge.mjs`
* **Checkpoint:** `datasets/ingestion_csj_progress.json`

### Características de Producción
1. **Idempotencia:** Verifica contra Supabase (`embedding IS NOT NULL`) antes de generar cada vector. Si el registro ya existe, lo salta en 0 ms sin consumir cuota de API.
2. **Reanudación atómica:** Si el proceso se interrumpe, al volver a correr retoma desde el último índice sin duplicar trabajo.
3. **Multi-proveedor de Embeddings (768d):**
   * **Primario:** Cloudflare Workers AI (`@cf/google/embeddinggemma-300m`), costo $0 (hasta 10,000 req/día). Requiere `CF_ACCOUNT_ID` y `CF_API_TOKEN`.
   * **Secundario:** Google AI Studio (`text-embedding-004`), requiere `GEMINI_API_KEY`.
4. **Normalización L2:** Aplica división euclidiana $\vec{v} / \|\vec{v}\|$ previa al almacenamiento.

### Comandos de Ejecución
```powershell
# Simulación sin escritura (prueba de conexión y dataset)
node scripts/ingest_csj_knowledge.mjs --dry-run --limit 10

# Ingesta completa con reanudación automática
node scripts/ingest_csj_knowledge.mjs

# Reiniciar desde cero (ignorar checkpoint)
node scripts/ingest_csj_knowledge.mjs --reset
```

---

## 4. DIRECTIVAS AGÉNTICAS Y REGLAS DE NEGOCIO (TOBI)

1. **Resolución de Contradicciones Doctrinales:**
   * Si dos fallos de la Sala Laboral discrepan o el caso depende de pruebas de hecho complejas, TOBI no dogmatiza: presenta ambas posturas de forma objetiva, reitera el disclaimer orientativo y canaliza la definición técnica al perito titular:
     > *"Ante interpretaciones divergentes en sede judicial, para peritar tus documentos oficiales y definir la estrategia exacta con base en los precedentes de la Sala Laboral, escribile directamente a Diego Núñez por WhatsApp al +595 984 469 005."*
2. **Umbral Semántico Calibrado:**
   * `SEMANTIC_MATCH_THRESHOLD = 0.40` en `api/assistant.ts` para filtrar similitudes débiles o ambiguas.
