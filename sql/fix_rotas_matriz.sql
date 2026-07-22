-- Atualiza o painel de permissões no banco de dados para incluir a nova página 'frota_rotas' no grupo 'frota'.
-- Sem isso, a página não aparece no painel de administrador para você conseguir marcar os checkboxes.

UPDATE configuracoes
SET valor = jsonb_set(
  valor::jsonb,
  '{frota}',
  COALESCE(valor->'frota', '[]'::jsonb) || '["frota_rotas"]'::jsonb
)
WHERE chave = 'paineis_paginas' 
  AND NOT (COALESCE(valor->'frota', '[]'::jsonb) @> '["frota_rotas"]'::jsonb);

-- Garante que o PostgREST atualize os caches
NOTIFY pgrst, 'reload schema';
