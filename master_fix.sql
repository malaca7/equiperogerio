-- =================================================================
-- 🚀 7 BOSS — SCRIPT UNIFICADO: MIGRAR ENCARREGADOS & CORRIGIR RLS
-- Execute este script no SQL Editor do Supabase para resolver tudo!
-- =================================================================

-- -----------------------------------------------------------------
-- PARTE 1: MIGRAR ENCARREGADOS PARA USAR PROFILES (USUÁRIOS)
-- -----------------------------------------------------------------
DROP TABLE IF EXISTS public.equipe_encarregados CASCADE;

CREATE TABLE public.equipe_encarregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eq_enc_equipe ON public.equipe_encarregados(equipe_id);
CREATE INDEX IF NOT EXISTS idx_eq_enc_user ON public.equipe_encarregados(user_id);

-- -----------------------------------------------------------------
-- PARTE 2: DESABILITAR RLS EM TODAS AS TABELAS OPERACIONAIS
-- -----------------------------------------------------------------
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

-- -----------------------------------------------------------------
-- PARTE 3: GARANTIR PRIVILÉGIOS DE ACESSO
-- -----------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- -----------------------------------------------------------------
-- PARTE 4: INSERIR PERMISSÕES DA PÁGINA DE EQUIPES
-- -----------------------------------------------------------------
INSERT INTO public.permissions (pagina, acao, descricao) VALUES
  ('equipes', 'visualizar', 'Permite visualizar a página de Equipes e Regiões'),
  ('equipes', 'editar', 'Permite gerenciar/editar Equipes e Regiões'),
  ('equipes', 'administrar', 'Controle total sobre Equipes e Regiões')
ON CONFLICT (pagina, acao) DO NOTHING;
