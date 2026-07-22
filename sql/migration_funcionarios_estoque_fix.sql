-- ====================================================================================
-- CORREÇÃO DE BANCO DE DADOS: PROFILES (ESTOQUE) E COLUNAS DE FUNCIONÁRIOS (CPF/PIS)
-- Execute este script no SQL Editor do Supabase para corrigir os erros reportados.
-- ====================================================================================

-- 1. CORREÇÃO DA CHAVE ESTRANGEIRA DE RESPONSÁVEL EM ESTOQUE_LOCAIS
-- Permite atualizar ou deletar perfis (profiles) definindo o campo como NULL em estoque_locais,
-- evitando a violação de restrição de integridade referencial.
ALTER TABLE public.estoque_locais
  DROP CONSTRAINT IF EXISTS estoque_locais_responsavel_id_fkey;

ALTER TABLE public.estoque_locais
  ADD CONSTRAINT estoque_locais_responsavel_id_fkey
  FOREIGN KEY (responsavel_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- 2. ADIÇÃO DE COLUNAS 'CPF' E 'PIS' NA TABELA DE FUNCIONÁRIOS
-- Adiciona os campos ausentes para evitar erros de cache de schema do PostgREST.
ALTER TABLE public.funcionarios 
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS pis TEXT;

-- 3. RECARREGAR O CACHE DE SCHEMA DO SUPABASE (POSTGREST)
-- Força o Supabase a atualizar instantaneamente as colunas indexadas na API REST.
NOTIFY pgrst, 'reload schema';
