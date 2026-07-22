-- ====================================================================================
-- SEED DE CATEGORIAS PADRÃO DE ESTOQUE
-- Execute este script no SQL Editor do Supabase para criar as categorias padrão.
-- ====================================================================================

-- 1. Inserir as categorias padrão caso não existam
INSERT INTO estoque_categorias (id, nome, descricao, cor, icone, ativo)
VALUES 
  ('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e1', 'Consumíveis', 'Materiais de consumo rápido e insumos de escritório/obra', '#3b82f6', 'package', true),
  ('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e2', 'EPIs', 'Equipamentos de Proteção Individual (exige C.A.)', '#10b981', 'shield', true),
  ('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e3', 'Ferramentas', 'Equipamentos, ferramentas manuais e elétricas', '#f59e0b', 'wrench', true)
ON CONFLICT (id) DO UPDATE 
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, cor = EXCLUDED.cor, icone = EXCLUDED.icone;

-- 2. Atualizar produtos existentes com base na marcação 'controle_ca'
-- Se o produto exige controle de C.A., associá-lo à categoria EPIs e marcar como tipo_material = 'epi'
UPDATE estoque_produtos 
SET categoria_id = 'a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e2', tipo_material = 'epi'
WHERE controle_ca = true;

-- 3. Garantir que os demais produtos tenham tipo_material adequado (padrão 'insumo' se não for ferramenta ou epi)
UPDATE estoque_produtos
SET tipo_material = 'insumo'
WHERE tipo_material = 'geral' AND controle_ca = false;
