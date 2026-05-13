-- =============================================================
-- MIGRAÇÃO: Configurações + Localidade na Escala
-- Execute no SQL Editor do Supabase
-- =============================================================

-- 1. Tabela de configurações (key-value com JSON)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chave   TEXT NOT NULL UNIQUE,
  valor   JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access_configuracoes" ON public.configuracoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Adicionar coluna localidade na tabela escalas
ALTER TABLE public.escalas ADD COLUMN IF NOT EXISTS localidade TEXT;

-- 3. Inserir dados padrão de setores e localidades
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('setores', '["Varrição", "Orla", "Porta a Porta"]'::jsonb),
  ('localidades', '[
    {"id":"v1","nome":"Suape","setor":"Varrição"},
    {"id":"v2","nome":"Av Laura Cavalcante","setor":"Varrição"},
    {"id":"v3","nome":"Enseadas","setor":"Varrição"},
    {"id":"v4","nome":"Itapuama","setor":"Varrição"},
    {"id":"v5","nome":"Estrada Velha","setor":"Varrição"},
    {"id":"v6","nome":"Anel Viário","setor":"Varrição"},
    {"id":"v7","nome":"Xaréu","setor":"Varrição"},
    {"id":"v8","nome":"PE-28 Gaibu","setor":"Varrição"},
    {"id":"o1","nome":"Gaibu","setor":"Orla"},
    {"id":"o2","nome":"Itapuama","setor":"Orla"},
    {"id":"o3","nome":"Suape","setor":"Orla"},
    {"id":"p1","nome":"A Definir","setor":"Porta a Porta"}
  ]'::jsonb)
ON CONFLICT (chave) DO NOTHING;
