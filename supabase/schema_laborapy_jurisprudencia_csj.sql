-- ==============================================================================
-- LABORAPY - BASE DE CONOCIMIENTO Y JURISPRUDENCIA CSJ (SUPABASE POSTGRES)
-- Fuente: Resoluciones laborales de la Corte Suprema de Justicia de Paraguay (1995-2026)
-- Enfoque: Acuerdos y Sentencias / Autos Interlocutorios laborales con texto completo OCR
-- Ingesta: scripts/ingest_jurisprudencia_csj.mjs
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de Jurisprudencia de la CSJ
CREATE TABLE IF NOT EXISTS public.jurisprudencia_csj (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    codigo_csj BIGINT NOT NULL UNIQUE,
    tipo_resolucion TEXT,
    numero_resolucion INTEGER,
    anio INTEGER,
    fecha_resolucion DATE,
    caratula TEXT,
    sala TEXT,
    preopinante TEXT,
    materia TEXT DEFAULT 'Laboral',
    accion_resuelta TEXT,
    resultado_accion TEXT,
    tribunal_origen TEXT,
    url_documento TEXT,
    texto_completo TEXT,
    texto_estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (texto_estado IN ('pendiente', 'ok', 'sin_texto', 'error')),
    texto_chars INTEGER DEFAULT 0,
    embedding vector(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    busqueda tsvector GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(caratula, '') || ' ' || coalesce(texto_completo, ''))
    ) STORED
);

-- 3. Índices de optimización (GIN, B-Tree y Vectorial HNSW)
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_csj_busqueda 
ON public.jurisprudencia_csj 
USING gin (busqueda);

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_csj_anio 
ON public.jurisprudencia_csj (anio);

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_csj_embedding 
ON public.jurisprudencia_csj 
USING hnsw (embedding vector_cosine_ops);

-- 4. Seguridad de Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public.jurisprudencia_csj ENABLE ROW LEVEL SECURITY;

-- Lectura pública para usuarios anónimos y autenticados (solo documentos procesados exitosamente)
DROP POLICY IF EXISTS "Lectura de jurisprudencia CSJ" ON public.jurisprudencia_csj;
CREATE POLICY "Lectura de jurisprudencia CSJ"
ON public.jurisprudencia_csj
FOR SELECT
TO anon, authenticated
USING (texto_estado = 'ok');

-- Inserción / Modificación restringida al rol de servicio / ingesta
DROP POLICY IF EXISTS "Escritura protegida de jurisprudencia CSJ" ON public.jurisprudencia_csj;
CREATE POLICY "Escritura protegida de jurisprudencia CSJ"
ON public.jurisprudencia_csj
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Función RPC para Búsqueda por Texto Completo en Español
CREATE OR REPLACE FUNCTION public.buscar_jurisprudencia_csj(
    p_query text,
    p_match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    codigo_csj bigint,
    tipo_resolucion text,
    numero_resolucion int,
    anio int,
    fecha_resolucion date,
    caratula text,
    sala text,
    resultado_accion text,
    url_documento text,
    fragmento text,
    rank real
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    tsq tsquery;
BEGIN
    IF p_query IS NULL OR btrim(p_query) = '' THEN
        RETURN;
    END IF;

    tsq := websearch_to_tsquery('spanish', p_query);

    RETURN QUERY
    SELECT
        j.id,
        j.codigo_csj,
        j.tipo_resolucion,
        j.numero_resolucion,
        j.anio,
        j.fecha_resolucion,
        j.caratula,
        j.sala,
        j.resultado_accion,
        j.url_documento,
        ts_headline(
            'spanish',
            left(coalesce(j.texto_completo, ''), 60000),
            tsq,
            'StartSel=«,StopSel=»,MaxFragments=2,MaxWords=45,MinWords=15'
        ) AS fragmento,
        ts_rank(j.busqueda, tsq) AS rank
    FROM public.jurisprudencia_csj j
    WHERE j.texto_estado = 'ok'
      AND j.busqueda @@ tsq
    ORDER BY rank DESC
    LIMIT greatest(1, least(coalesce(p_match_count, 5), 20));
END;
$$;

-- 6. Permisos de ejecución de la función RPC
GRANT EXECUTE ON FUNCTION public.buscar_jurisprudencia_csj(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.buscar_jurisprudencia_csj(text, int) TO anon, authenticated;
