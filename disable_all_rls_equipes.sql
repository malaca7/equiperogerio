-- =================================================================
-- SOLUÇÃO NUCLEAR: DESATIVAR RLS COMPLETAMENTE NAS EQUIPES
-- Execute este script no SQL Editor do Supabase
-- =================================================================

-- 1. Apagar DINAMICAMENTE todas as políticas existentes (para evitar conflitos de nomes)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'equipe_encarregados') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipe_encarregados', r.policyname);
    END LOOP;
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'equipe_membros') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipe_membros', r.policyname);
    END LOOP;
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'equipes') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipes', r.policyname);
    END LOOP;
END $$;

-- 2. DESATIVAR PERMANENTEMENTE O RLS (Garantia de que o erro sumirá)
ALTER TABLE public.equipe_encarregados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes DISABLE ROW LEVEL SECURITY;

-- 3. GARANTIR PRIVILÉGIOS TOTAIS
GRANT ALL PRIVILEGES ON public.equipe_encarregados TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.equipe_membros TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.equipes TO anon, authenticated, service_role;
