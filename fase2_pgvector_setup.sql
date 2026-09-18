-- ==========================================
-- FASE 2: PROTOCOLO GRANJERO (pgvector)
-- ==========================================

-- 1. Habilitar extensión pgvector
create extension if not exists vector;

-- 2. Tabla de conocimiento para Tobi
create table if not exists public.tobi_knowledge_base (
  id text primary key,
  content text not null,
  metadata jsonb,
  embedding vector(1536)
);

-- 3. Habilitar RLS estricto
alter table public.tobi_knowledge_base enable row level security;
alter table public.tobi_knowledge_base force row level security;

-- 4. Política de lectura (Pública o para Authenticated según requerimiento)
create policy "tobi_knowledge_base_select_public"
  on public.tobi_knowledge_base
  for select
  to public
  using (true);

-- Nota: INSERT/UPDATE quedan denegados para anon/authenticated.
-- Solo service_role podrá insertar los chunks vectorizados.

-- 5. Función de búsqueda vectorial segura (Security Definer y search_path blindado)
create or replace function public.match_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.tobi_knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;
