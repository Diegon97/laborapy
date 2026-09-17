-- ==============================================================================
-- LABORAPY - BASE DE CONOCIMIENTO Y JURISPRUDENCIA AUDIOVISUAL (SUPABASE POSTGRES)
-- Extracción y contextualización de videos de abogados laboralistas (@ernestoyampey, @juanbernis)
-- Enfoque: Casos reales de abusos patronales, fraude laboral (Art. 19) y derechos del trabajador
-- ==============================================================================

-- 1. Habilitar extensión vectorial para RAG (búsqueda semántica)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Autores / Especialistas Legales
CREATE TABLE IF NOT EXISTS public.autores_laborales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    handle TEXT NOT NULL UNIQUE, -- ej: '@ernestoyampey', '@juanbernis'
    nombre_completo TEXT NOT NULL,
    especialidad TEXT DEFAULT 'Derecho Laboral y Seguridad Social (Paraguay)',
    perfil_url TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- Insertar los dos abogados de referencia iniciales
INSERT INTO public.autores_laborales (handle, nombre_completo, especialidad)
VALUES 
    ('@ernestoyampey', 'Abg. Ernesto Yampey', 'Derecho Laboral, Fraude Laboral y Litigios MTESS/IPS'),
    ('@juanbernis', 'Abg. Juan Bernis', 'Defensa de Derechos Laborales, Casos Prácticos y Liquidaciones')
ON CONFLICT (handle) DO NOTHING;

-- 3. Tabla de Criterios y Transcripciones de Videos
CREATE TABLE IF NOT EXISTS public.jurisprudencia_multimedia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    autor_id UUID NOT NULL REFERENCES public.autores_laborales(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('tiktok', 'instagram', 'youtube', 'podcast')),
    url_video TEXT,
    titulo_tema TEXT NOT NULL CHECK (char_length(titulo_tema) <= 300),
    
    -- Contenido procesado por la IA
    audio_transcripcion TEXT NOT NULL, -- Lo que el abogado dijo textualmente
    caso_abuso_detectado TEXT NOT NULL, -- ej: "Exigir factura legal a cajera con horario fijo de 8hs"
    fundamento_juridico TEXT NOT NULL, -- ej: "Art. 19 Código Laboral (Primacía de la Realidad), Art. 17 Ley 1860/50"
    criterio_practico TEXT NOT NULL, -- ej: "No firmar renuncia; intimar vía colacionado reconocimiento de antigüedad e IPS"
    articulos_citados TEXT[] DEFAULT '{}', -- ej: ARRAY['Art. 19', 'Art. 84', 'Art. 229']
    
    -- Vector de Embeddings para búsqueda semántica instantánea
    -- 768 dimensiones corresponde a text-embedding-004 de Google (gratuito)
    -- Si se usa OpenAI text-embedding-3-small, cambiar a vector(1536)
    embedding vector(768),
    
    metadata JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- 4. Índices para Búsqueda Vectorial Ultrarrápida (HNSW / Cosine Similarity)
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_embedding 
ON public.jurisprudencia_multimedia 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_autor 
ON public.jurisprudencia_multimedia (autor_id);

-- 5. Habilitación de Row Level Security (RLS)
ALTER TABLE public.autores_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisprudencia_multimedia ENABLE ROW LEVEL SECURITY;

-- Lectura pública para el Auxiliar y usuarios autenticados
DROP POLICY IF EXISTS "Lectura de jurisprudencia abierta" ON public.jurisprudencia_multimedia;
CREATE POLICY "Lectura de jurisprudencia abierta"
ON public.jurisprudencia_multimedia
FOR SELECT
TO anon, authenticated
USING (activo = true);

DROP POLICY IF EXISTS "Lectura de autores abierta" ON public.autores_laborales;
CREATE POLICY "Lectura de autores abierta"
ON public.autores_laborales
FOR SELECT
TO anon, authenticated
USING (activo = true);

-- Inserción / Modificación restringida a Service Role / Admins
DROP POLICY IF EXISTS "Escritura protegida de jurisprudencia" ON public.jurisprudencia_multimedia;
CREATE POLICY "Escritura protegida de jurisprudencia"
ON public.jurisprudencia_multimedia
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Función RPC para Búsqueda Semántica desde la API de LaboraPy
CREATE OR REPLACE FUNCTION public.buscar_criterios_laborales(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.65,
    match_count int DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    autor_handle TEXT,
    autor_nombre TEXT,
    titulo_tema TEXT,
    caso_abuso_detectado TEXT,
    fundamento_juridico TEXT,
    criterio_practico TEXT,
    articulos_citados TEXT[],
    url_video TEXT,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        j.id,
        a.handle AS autor_handle,
        a.nombre_completo AS autor_nombre,
        j.titulo_tema,
        j.caso_abuso_detectado,
        j.fundamento_juridico,
        j.criterio_practico,
        j.articulos_citados,
        j.url_video,
        1 - (j.embedding <=> query_embedding) AS similarity
    FROM public.jurisprudencia_multimedia j
    JOIN public.autores_laborales a ON a.id = j.autor_id
    WHERE j.activo = true 
      AND 1 - (j.embedding <=> query_embedding) > match_threshold
    ORDER BY j.embedding <=> query_embedding
    LIMIT match_count;
$$;
