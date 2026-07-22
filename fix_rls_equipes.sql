-- =================================================================
-- 🚀 7 BOSS — SOLUÇÃO DEFINITIVA DE SEGURANÇA (RLS) PARA EQUIPES
-- Execute este script no SQL Editor do Supabase para destravar tudo!
-- =================================================================

-- 1. DESABILITAR RLS COMPLETAMENTE NAS TABELAS DE VÍNCULOS
ALTER TABLE public.equipe_encarregados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes DISABLE ROW LEVEL SECURITY;

-- 2. LIBERAÇÃO COMPLETA DE PRIVILÉGIOS DE BANCO
GRANT ALL PRIVILEGES ON public.equipe_encarregados TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.equipe_membros TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.equipes TO anon, authenticated, service_role;

-- 3. CRIAÇÃO DE POLÍTICAS DE ACESSO TOTAL (GARANTIA EXTRA CASO O RLS SEJA ATIVADO)
DROP POLICY IF EXISTS "Liberação total para equipe_encarregados" ON public.equipe_encarregados;
CREATE POLICY "Liberação total para equipe_encarregados" ON public.equipe_encarregados
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Liberação total para equipe_membros" ON public.equipe_membros;
CREATE POLICY "Liberação total para equipe_membros" ON public.equipe_membros
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Liberação total para equipes" ON public.equipes;
CREATE POLICY "Liberação total para equipes" ON public.equipes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
