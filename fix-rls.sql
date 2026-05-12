-- =============================================================
-- CORREÇÃO DE RLS — permite acesso via chave anônima (anon)
-- Execute no SQL Editor do Supabase
-- =============================================================

-- Remove as policies antigas (authenticated)
DROP POLICY IF EXISTS "auth_full_access_funcionarios"  ON public.funcionarios;
DROP POLICY IF EXISTS "auth_full_access_frequencia"    ON public.frequencia;
DROP POLICY IF EXISTS "auth_full_access_escalas"       ON public.escalas;
DROP POLICY IF EXISTS "auth_full_access_notificacoes"  ON public.notificacoes;

-- Cria novas policies permitindo anon (chave pública) + authenticated
CREATE POLICY "anon_full_access_funcionarios" ON public.funcionarios
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_frequencia" ON public.frequencia
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_escalas" ON public.escalas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_notificacoes" ON public.notificacoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
