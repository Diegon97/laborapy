-- ==============================================================================
-- LABORAPY — TELEMETRÍA DEL ASISTENTE TOBI (SUPABASE POSTGRES)
-- Registra metadatos de cada request a /api/assistant: proveedor que respondió,
-- proveedores fallidos con motivo, tipo/cantidad de adjuntos y duración.
-- NO almacena contenido de usuario (cero PII).
-- ==============================================================================

-- 1. Tabla de eventos de telemetría (best-effort, sin contenido de usuario)
CREATE TABLE IF NOT EXISTS public.tobi_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind TEXT NOT NULL,                    -- request_ok | request_partial | request_fallback
    answered_provider TEXT,                -- gemini | groq | cloudflare | openrouter | openai | deepseek | null
    answered_model TEXT,
    providers_failed TEXT,                 -- ej: 'groq: HTTP 429; openai: network' (máx 300 chars)
    attachment_kind TEXT,                  -- none | text | image | images | pdf | mixed
    attachment_pages INTEGER DEFAULT 0,
    duration_ms INTEGER,
    detail TEXT
);

-- 2. Índice para leer los eventos más recientes sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS idx_tobi_events_created_at ON public.tobi_events (created_at DESC);

-- 3. RLS: solo service_role (la telemetría no es pública)
ALTER TABLE public.tobi_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Escritura y lectura de telemetría (service role)" ON public.tobi_events;
CREATE POLICY "Escritura y lectura de telemetría (service role)"
ON public.tobi_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
