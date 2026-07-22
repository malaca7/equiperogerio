-- ====================================================================================
-- ADAPTAÇÃO DE CAUTELAS PARA SUPORTAR USUÁRIOS E COLABORADORES
-- Execute este script no SQL Editor do Supabase para habilitar cautelas para ambos.
-- ====================================================================================

-- 1. Desabilitar RLS temporariamente se necessário para evitar conflitos de bloqueio
ALTER TABLE estoque_cautelas DISABLE ROW LEVEL SECURITY;

-- 2. Modificar a coluna 'funcionario_id' (que aponta para profiles) para ser opcional
ALTER TABLE estoque_cautelas ALTER COLUMN funcionario_id DROP NOT NULL;

-- 3. Adicionar coluna 'colaborador_id' apontando para a tabela 'funcionarios' se ela não existir
ALTER TABLE estoque_cautelas ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL;

-- 4. Re-habilitar RLS
ALTER TABLE estoque_cautelas ENABLE ROW LEVEL SECURITY;
