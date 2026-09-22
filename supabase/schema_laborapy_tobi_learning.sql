-- ==============================================================================
-- LABORAPY — CENTRO DE APRENDIZAJE PERICIAL DE TOBI (SUPABASE POSTGRES)
-- Almacena consultas reales peritadas de los usuarios, dictámenes de Tobi
-- y la autorización / corrección oficial de Diego Núñez (Ley 213/93).
-- ==============================================================================

-- 1. Tabla de candidatos de aprendizaje
CREATE TABLE IF NOT EXISTS public.tobi_learning_candidates (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consulta TEXT NOT NULL,
    respuesta_tobi TEXT,
    proveedor TEXT DEFAULT 'tobi-web',
    modelo TEXT DEFAULT 'desconocido',
    articulos TEXT[] DEFAULT '{}',
    autorizado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (autorizado IN ('PENDIENTE', 'AUTORIZADO', 'DESCARTADO')),
    correccion_diego TEXT DEFAULT '',
    auditado_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Índices de alta velocidad
CREATE INDEX IF NOT EXISTS idx_tobi_learning_autorizado ON public.tobi_learning_candidates (autorizado);
CREATE INDEX IF NOT EXISTS idx_tobi_learning_created_at ON public.tobi_learning_candidates (created_at DESC);

-- 3. Habilitar RLS
ALTER TABLE public.tobi_learning_candidates ENABLE ROW LEVEL SECURITY;

-- 4. Política: Lectura de casos autorizados abierta a todos (permite a Tobi consultar la memoria pericial)
DROP POLICY IF EXISTS "Lectura de casos autorizados para memoria de Tobi" ON public.tobi_learning_candidates;
CREATE POLICY "Lectura de casos autorizados para memoria de Tobi"
ON public.tobi_learning_candidates
FOR SELECT
TO anon, authenticated, service_role
USING (autorizado = 'AUTORIZADO');

-- 5. Política: Service role tiene acceso completo
DROP POLICY IF EXISTS "Acceso total para service role" ON public.tobi_learning_candidates;
CREATE POLICY "Acceso total para service role"
ON public.tobi_learning_candidates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
