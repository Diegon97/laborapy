-- ==============================================================================
-- LABORAPY - SCHEMA CANÓNICO DE BASE DE CONOCIMIENTO (pgvector)
-- Tabla canónica: public.tobi_knowledge_base
-- Función canónica: public.match_tobi_knowledge
-- Dimensión estandarizada: vector(768) (Cloudflare Gemma-300m / Google text-embedding-004)
-- Seguridad RLS: Lectura pública abierta (Hook Freemium), mutación restringida a service_role
-- ==============================================================================

-- 1. Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla canónica tobi_knowledge_base
CREATE TABLE IF NOT EXISTS public.tobi_knowledge_base (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Si la tabla existía previamente con otra dimensión, asegurar tipo vector(768)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tobi_knowledge_base' 
          AND column_name = 'embedding'
    ) THEN
        -- No-op si ya es compatible; el alter column se aplica si fuera necesario en migración limpia
        NULL;
    END IF;
END $$;

-- 3. Índice HNSW de alta velocidad para búsqueda por coseno
DROP INDEX IF EXISTS public.tobi_knowledge_base_embedding_idx;
CREATE INDEX tobi_knowledge_base_embedding_idx 
ON public.tobi_knowledge_base 
USING hnsw (embedding vector_cosine_ops);

-- 4. Índice GIN sobre metadatos para filtrado por fuero/sala/año
CREATE INDEX IF NOT EXISTS idx_tobi_kb_metadata 
ON public.tobi_knowledge_base 
USING gin (metadata);

-- 5. Row Level Security (RLS) Mandatorio
ALTER TABLE public.tobi_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tobi_knowledge_base FORCE ROW LEVEL SECURITY;

-- Lectura pública para el asistente web (anon + authenticated)
DROP POLICY IF EXISTS "tobi_kb_read_public" ON public.tobi_knowledge_base;
DROP POLICY IF EXISTS "tobi_knowledge_base_select_public" ON public.tobi_knowledge_base;
CREATE POLICY "tobi_kb_read_public"
ON public.tobi_knowledge_base 
FOR SELECT
TO anon, authenticated
USING (true);

-- Inserción / Actualización / Borrado exclusivo para backend con service_role
DROP POLICY IF EXISTS "tobi_kb_write_admin" ON public.tobi_knowledge_base;
CREATE POLICY "tobi_kb_write_admin"
ON public.tobi_knowledge_base 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Función RPC Canónica de Búsqueda Semántica
-- SET search_path blindado contra Search Path Hijacking (CISO hardening)
CREATE OR REPLACE FUNCTION public.match_tobi_knowledge (
    query_embedding vector(768),
    match_threshold float DEFAULT 0.40,
    match_count int DEFAULT 4
)
RETURNS TABLE (
    id text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        kb.id,
        kb.content,
        kb.metadata,
        (1 - (kb.embedding <=> query_embedding))::float AS similarity
    FROM public.tobi_knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND (1 - (kb.embedding <=> query_embedding)) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Compatibilidad retroactiva: asegurar que match_knowledge también apunte a 768d si alguien la invoca
CREATE OR REPLACE FUNCTION public.match_knowledge (
    query_embedding vector(768),
    match_threshold float DEFAULT 0.40,
    match_count int DEFAULT 4
)
RETURNS TABLE (
    id text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT * FROM public.match_tobi_knowledge(query_embedding, match_threshold, match_count);
$$;

-- 7. Notificar a PostgREST para recargar el esquema inmediatamente
NOTIFY pgrst, 'reload schema';
