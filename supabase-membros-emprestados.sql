-- =====================================================
-- 7 BOSS — SISTEMA DE MEMBROS EMPRESTADOS (EMPRÉSTIMO DIÁRIO)
-- Execute no SQL Editor do Supabase
-- =====================================================

CREATE TABLE IF NOT EXISTS public.equipe_membros_emprestados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

-- Índices de performance para busca rápida diária
CREATE INDEX IF NOT EXISTS idx_eq_membros_emp_equipe ON public.equipe_membros_emprestados(equipe_id);
CREATE INDEX IF NOT EXISTS idx_eq_membros_emp_func ON public.equipe_membros_emprestados(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_eq_membros_emp_data ON public.equipe_membros_emprestados(data);

-- Desabilita RLS para manter compatibilidade com o padrão do projeto offline-first/bypass
ALTER TABLE public.equipe_membros_emprestados DISABLE ROW LEVEL SECURITY;
