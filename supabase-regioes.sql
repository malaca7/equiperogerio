-- =====================================================
-- 7 BOSS — SISTEMA DE REGIÕES
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Tabela de regiões
CREATE TABLE IF NOT EXISTS regioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#6366f1',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Adicionar coluna regiao_id na tabela equipes
ALTER TABLE equipes ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES regioes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipes_regiao ON equipes(regiao_id);

-- 3. Adicionar permissões para equipes e regiões
INSERT INTO permissions (pagina, acao, descricao) VALUES
  ('equipes', 'visualizar', 'Visualizar equipes'),
  ('equipes', 'editar', 'Criar e editar equipes'),
  ('equipes', 'administrar', 'Gerenciar equipes e regiões')
ON CONFLICT (pagina, acao) DO NOTHING;

-- Desabilitar RLS
ALTER TABLE regioes DISABLE ROW LEVEL SECURITY;

-- DESENVOLVEDOR recebe TODAS as novas permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.nome = 'DESENVOLVEDOR'
  AND p.pagina = 'equipes'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- GERENTE recebe permissões de equipes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.nome = 'GERENTE'
  AND p.pagina = 'equipes'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ENCARREGADO recebe visualizar equipes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.nome = 'ENCARREGADO'
  AND p.pagina = 'equipes'
  AND p.acao = 'visualizar'
ON CONFLICT (role_id, permission_id) DO NOTHING;
