-- SCRIPT DE CORREÇÃO DE RLS PARA TODAS AS TABELAS DO MÓDULO DE FROTA
-- Este script irá limpar as políticas antigas e criar uma regra robusta para:
-- 1. frota_veiculos
-- 2. frota_registros_diarios
-- 3. frota_abastecimentos
-- 4. frota_manutencoes

DO $$
DECLARE
    t_name TEXT;
    r RECORD;
BEGIN
    -- Loop sobre todas as tabelas do módulo de frota
    FOR t_name IN SELECT unnest(ARRAY['frota_veiculos', 'frota_registros_diarios', 'frota_abastecimentos', 'frota_manutencoes']) 
    LOOP
        -- Remover todas as políticas dinamicamente para cada tabela
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = t_name) LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(t_name);
        END LOOP;
        
        -- Habilitar RLS
        EXECUTE 'ALTER TABLE ' || quote_ident(t_name) || ' ENABLE ROW LEVEL SECURITY';
        
        -- Criar política universal baseada em autenticação
        EXECUTE 'CREATE POLICY "Acesso Permitido para Autenticados" ON ' || quote_ident(t_name) || 
                ' FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
    END LOOP;
END $$;
