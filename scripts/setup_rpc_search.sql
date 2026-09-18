-- Función para buscar en la base de conocimientos por similitud de coseno
CREATE OR REPLACE FUNCTION match_tobi_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    tobi_knowledge_base.id,
    tobi_knowledge_base.content,
    tobi_knowledge_base.metadata,
    1 - (tobi_knowledge_base.embedding <=> query_embedding) AS similarity
  FROM tobi_knowledge_base
  WHERE 1 - (tobi_knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY tobi_knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Refrescar caché de PostgREST para exponer la función en la API
NOTIFY pgrst, 'reload schema';
