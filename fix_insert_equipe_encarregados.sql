-- =================================================================
-- FIX: CORREÇÃO DEFINITIVA DE RLS PARA TABELAS DE EQUIPE
-- Execute este script no SQL Editor do Supabase
-- =================================================================

-- 1. Desabilitar temporariamente o RLS para limpar as políticas antigas
ALTER TABLE public.equipe_encarregados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes DISABLE ROW LEVEL SECURITY;

-- 2. Apagar todas as políticas restritivas que podem estar causando bloqueio
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.equipe_encarregados;
DROP POLICY IF EXISTS "Liberação total para equipe_encarregados" ON public.equipe_encarregados;
DROP POLICY IF EXISTS "Enable ALL for authenticated" ON public.equipe_encarregados;

-- 3. Habilitar o RLS novamente (boas práticas de segurança do Supabase)
ALTER TABLE public.equipe_encarregados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas irrestritas (O controle de acesso é feito no Front-end)
CREATE POLICY "Enable ALL for authenticated" 
ON public.equipe_encarregados 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable ALL for authenticated" 
ON public.equipe_membros 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable ALL for authenticated" 
ON public.equipes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Garantir permissões de banco de dados
GRANT ALL ON public.equipe_encarregados TO authenticated;
GRANT ALL ON public.equipe_membros TO authenticated;
GRANT ALL ON public.equipes TO authenticated;
