-- =============================================================
-- 7 BOSS — SOLUÇÃO DEFINITIVA DE SEGURANÇA (RLS)
-- Permite operações de escrita (INSERT/UPDATE/DELETE) via anon
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Desabilita RLS de todas as tabelas operacionais e cadastrais
ALTER TABLE IF EXISTS public.regioes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipe_membros DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipe_encarregados DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.funcionarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.frequencia DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.escalas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.login_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_events DISABLE ROW LEVEL SECURITY;

-- Garante privilégios totais para perfis anon e authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
