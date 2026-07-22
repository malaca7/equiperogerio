-- SCRIPT DE CORREÇÃO DEFINITIVA (SEM BLOCOS DINÂMICOS PARA EVITAR ERROS)
-- Execute este script no SQL Editor do Supabase

-- ==========================================
-- 1. DESATIVAR RLS TEMPORARIAMENTE PARA GARANTIR LIMPEZA
-- ==========================================
ALTER TABLE frota_veiculos DISABLE ROW LEVEL SECURITY;
ALTER TABLE frota_registros_diarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE frota_abastecimentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE frota_manutencoes DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. REMOVER TODAS AS POLÍTICAS ANTIGAS MANUALMENTE
-- ==========================================
-- frota_veiculos
DROP POLICY IF EXISTS "Veículos visíveis para autenticados" ON frota_veiculos;
DROP POLICY IF EXISTS "Apenas admins gerenciam veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários inserem veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários atualizam e deletam próprios veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários deletam próprios veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Leitura de veículos para autenticados" ON frota_veiculos;
DROP POLICY IF EXISTS "Inserção de veículos para autenticados" ON frota_veiculos;
DROP POLICY IF EXISTS "Atualização de veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Deleção de veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Politica Universal Frota Veiculos" ON frota_veiculos;
DROP POLICY IF EXISTS "Acesso Permitido para Autenticados" ON frota_veiculos;
DROP POLICY IF EXISTS "Acesso total para testes" ON frota_veiculos;

-- frota_registros_diarios
DROP POLICY IF EXISTS "Ver registros diários" ON frota_registros_diarios;
DROP POLICY IF EXISTS "Inserir registros diários" ON frota_registros_diarios;
DROP POLICY IF EXISTS "Atualizar próprios registros" ON frota_registros_diarios;
DROP POLICY IF EXISTS "Deletar próprios registros" ON frota_registros_diarios;
DROP POLICY IF EXISTS "Acesso Permitido para Autenticados" ON frota_registros_diarios;

-- frota_abastecimentos
DROP POLICY IF EXISTS "Ver abastecimentos" ON frota_abastecimentos;
DROP POLICY IF EXISTS "Inserir abastecimentos" ON frota_abastecimentos;
DROP POLICY IF EXISTS "Atualizar próprios abastecimentos" ON frota_abastecimentos;
DROP POLICY IF EXISTS "Deletar próprios abastecimentos" ON frota_abastecimentos;
DROP POLICY IF EXISTS "Acesso Permitido para Autenticados" ON frota_abastecimentos;

-- frota_manutencoes
DROP POLICY IF EXISTS "Ver manutencoes" ON frota_manutencoes;
DROP POLICY IF EXISTS "Inserir manutencoes" ON frota_manutencoes;
DROP POLICY IF EXISTS "Atualizar próprias manutencoes" ON frota_manutencoes;
DROP POLICY IF EXISTS "Deletar próprias manutencoes" ON frota_manutencoes;
DROP POLICY IF EXISTS "Acesso Permitido para Autenticados" ON frota_manutencoes;

-- ==========================================
-- 3. REATIVAR RLS
-- ==========================================
ALTER TABLE frota_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_registros_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_manutencoes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. CRIAR UMA ÚNICA POLÍTICA GERAL E SIMPLES PARA CADA TABELA
-- ==========================================

CREATE POLICY "Permitir_Tudo_Frota_Veiculos" ON frota_veiculos
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir_Tudo_Frota_Registros" ON frota_registros_diarios
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir_Tudo_Frota_Abastecimentos" ON frota_abastecimentos
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir_Tudo_Frota_Manutencoes" ON frota_manutencoes
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
