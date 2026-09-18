-- Habilitar extensión vector si no existe
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear la tabla tobi_knowledge_base para los embeddings de Gemma 300M (768 dimensiones)
CREATE TABLE IF NOT EXISTS public.tobi_knowledge_base (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(768)
);

-- Eliminar el índice si ya existe (para evitar errores en recreación)
DROP INDEX IF EXISTS tobi_knowledge_base_embedding_idx;

-- Crear índice HNSW optimizado para búsqueda por coseno
CREATE INDEX tobi_knowledge_base_embedding_idx 
ON public.tobi_knowledge_base 
USING hnsw (embedding vector_cosine_ops);

-- Refrescar el caché del esquema de PostgREST para solucionar Error PGRST205
NOTIFY pgrst, 'reload schema';
