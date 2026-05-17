-- =====================================================
-- 7 BOSS — SISTEMA DE EQUIPES
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Tabela principal de equipes
CREATE TABLE IF NOT EXISTS equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#6366f1',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Encarregados da equipe (N:N — encarregado pode estar em várias equipes)
CREATE TABLE IF NOT EXISTS equipe_encarregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(equipe_id, funcionario_id)
);

-- 3. Membros da equipe (1:N — funcionário só pode estar em UMA equipe)
CREATE TABLE IF NOT EXISTS equipe_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(funcionario_id)  -- Garante que o funcionário só está em uma equipe
);

CREATE INDEX IF NOT EXISTS idx_eq_enc_equipe ON equipe_encarregados(equipe_id);
CREATE INDEX IF NOT EXISTS idx_eq_enc_func ON equipe_encarregados(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_eq_mem_equipe ON equipe_membros(equipe_id);
CREATE INDEX IF NOT EXISTS idx_eq_mem_func ON equipe_membros(funcionario_id);

-- Desabilitar RLS
ALTER TABLE equipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_encarregados DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_membros DISABLE ROW LEVEL SECURITY;
