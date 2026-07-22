-- =====================================================
-- 7 BOSS — MIGRAÇÃO DE ENCARREGADOS PARA PERFIL DE USUÁRIOS
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Remove a tabela de encarregados antiga
DROP TABLE IF EXISTS public.equipe_encarregados CASCADE;

-- 2. Cria a nova tabela equipe_encarregados referenciando PROFILES (usuários)
CREATE TABLE public.equipe_encarregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipe_id, user_id)
);

-- 3. Cria os índices de performance
CREATE INDEX IF NOT EXISTS idx_eq_enc_equipe ON public.equipe_encarregados(equipe_id);
CREATE INDEX IF NOT EXISTS idx_eq_enc_user ON public.equipe_encarregados(user_id);

-- 4. Desabilita RLS por padrão do repositório
ALTER TABLE public.equipe_encarregados DISABLE ROW LEVEL SECURITY;
