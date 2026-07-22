-- =============================================================
-- GESTÃO DE EQUIPE ROGERIO — Report Templates / Modelos de Relatório
-- Execute este script no SQL Editor do Supabase para criar a tabela
-- =============================================================

CREATE TABLE IF NOT EXISTS public.modelos_relatorio (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  equipe_id     UUID REFERENCES public.equipes(id) ON DELETE CASCADE,
  report_title  TEXT NOT NULL,
  show_metrics  BOOLEAN NOT NULL DEFAULT true,
  show_localities BOOLEAN NOT NULL DEFAULT true,
  show_observations BOOLEAN NOT NULL DEFAULT true,
  show_inactives  BOOLEAN NOT NULL DEFAULT true,
  show_roles    BOOLEAN NOT NULL DEFAULT true,
  observations  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS e criar política de acesso total (igual às outras tabelas da plataforma)
ALTER TABLE public.modelos_relatorio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_modelos_relatorio" ON public.modelos_relatorio;
CREATE POLICY "anon_full_access_modelos_relatorio" ON public.modelos_relatorio
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Índice para acelerar a busca de modelos por equipe
CREATE INDEX IF NOT EXISTS idx_modelos_relatorio_equipe ON public.modelos_relatorio(equipe_id);
