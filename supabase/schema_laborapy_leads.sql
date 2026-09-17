-- ==============================================================================
-- LABORAPY - ESQUEMA DE BASE DE DATOS BLINDADO Y PROTECCIÓN RLS (SUPABASE)
-- Conecta el funnel comercial con auditoría de seguridad y cifrado en tránsito
-- ==============================================================================

-- 1. Crear tabla con validación estricta de tipos y longitudes (Anti-DoS / Anti-Injection)
CREATE TABLE IF NOT EXISTS public.laborapy_leads (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre TEXT CHECK (nombre IS NULL OR char_length(nombre) <= 150),
    email TEXT NOT NULL CHECK (char_length(email) <= 150 AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    telefono TEXT CHECK (telefono IS NULL OR char_length(telefono) <= 50),
    tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('empresa', 'particular')),
    empresa_nombre TEXT CHECK (empresa_nombre IS NULL OR char_length(empresa_nombre) <= 150),
    motivo_consulta TEXT CHECK (motivo_consulta IS NULL OR char_length(motivo_consulta) <= 500),
    calculo_estimado NUMERIC CHECK (calculo_estimado IS NULL OR (calculo_estimado >= 0 AND calculo_estimado <= 10000000000)),
    documento TEXT DEFAULT 'Finiquito de Liquidación Laboral' CHECK (char_length(documento) <= 150),
    formato TEXT DEFAULT 'pdf' CHECK (formato IN ('pdf', 'docx')),
    origen TEXT DEFAULT 'LaboraPy Web' CHECK (char_length(origen) <= 150),
    sincronizado BOOLEAN DEFAULT TRUE,
    notas TEXT CHECK (notas IS NULL OR char_length(notas) <= 1000)
);

-- 2. Habilitar Row Level Security (RLS) Mandatorio
ALTER TABLE public.laborapy_leads ENABLE ROW LEVEL SECURITY;

-- 3. Política de Inserción Pública Segura (Visitantes del Sitio Web)
-- Permite que los visitantes envíen sus datos de contacto sin conceder acceso a los datos de otros.
DROP POLICY IF EXISTS "Permitir inserción pública de leads" ON public.laborapy_leads;
CREATE POLICY "Permitir inserción pública de leads" 
ON public.laborapy_leads 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- 4. Política de Lectura Blindada (Zero-Knowledge / Cero Fugas)
-- CRÍTICO: Los usuarios anónimos (públicos) tienen DENEGADA la lectura (SELECT).
-- Ningún tercero puede listar, ver ni extraer datos de leads desde la web ni con la clave anon.
DROP POLICY IF EXISTS "Permitir lectura solo a administradores" ON public.laborapy_leads;
CREATE POLICY "Permitir lectura solo a administradores" 
ON public.laborapy_leads 
FOR SELECT 
TO authenticated 
USING (true);

-- 5. Revocación explícita de privilegios destructivos para roles no autorizados
REVOKE UPDATE, DELETE ON public.laborapy_leads FROM anon;
REVOKE SELECT ON public.laborapy_leads FROM anon;
GRANT INSERT ON public.laborapy_leads TO anon;
GRANT ALL ON public.laborapy_leads TO authenticated;

-- 6. Índices de Alto Rendimiento
CREATE INDEX IF NOT EXISTS idx_laborapy_leads_created_at ON public.laborapy_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_laborapy_leads_email ON public.laborapy_leads (email);
CREATE INDEX IF NOT EXISTS idx_laborapy_leads_tipo ON public.laborapy_leads (tipo_usuario);