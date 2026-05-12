-- =============================================================
-- GESTÃO DE EQUIPE ROGERIO — Supabase Schema
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------
-- Tabela: funcionarios
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome        TEXT NOT NULL,
  matricula   TEXT NOT NULL,
  telefone    TEXT,
  cargo       TEXT NOT NULL,
  setor       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- -------------------------------------------------------
-- Tabela: frequencia
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.frequencia (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  funcionario_id  UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  entrada         TIME,
  saida           TIME,
  status          TEXT NOT NULL CHECK (status IN ('presente','falta','atestado','folga','hora_extra','ferias')),
  hora_extra      NUMERIC(4,1),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (funcionario_id, data)
);

-- -------------------------------------------------------
-- Tabela: escalas
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escalas (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  funcionario_id  UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('presente','falta','falta_justificada','suspensao','atestado','paternidade','obito_familiar','beneficio','repouso','compensar','ferias','transferencia')),
  turno           TEXT CHECK (turno IN ('manha','tarde','noite','integral')),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (funcionario_id, data)
);

-- -------------------------------------------------------
-- Tabela: notificacoes
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('falta','escala','atestado','info','alerta')),
  visualizada BOOLEAN DEFAULT false NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- -------------------------------------------------------
-- Índices para performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_funcionarios_status ON public.funcionarios(status);
CREATE INDEX IF NOT EXISTS idx_funcionarios_setor  ON public.funcionarios(setor);
CREATE INDEX IF NOT EXISTS idx_frequencia_data     ON public.frequencia(data);
CREATE INDEX IF NOT EXISTS idx_frequencia_func     ON public.frequencia(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_escalas_data        ON public.escalas(data);
CREATE INDEX IF NOT EXISTS idx_escalas_func        ON public.escalas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_vis    ON public.notificacoes(visualizada);

-- -------------------------------------------------------
-- Row Level Security (RLS)
-- -------------------------------------------------------
ALTER TABLE public.funcionarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes   ENABLE ROW LEVEL SECURITY;

-- Política: acesso total via anon key (login local) + authenticated
CREATE POLICY "anon_full_access_funcionarios" ON public.funcionarios
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_frequencia" ON public.frequencia
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_escalas" ON public.escalas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_full_access_notificacoes" ON public.notificacoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- Dados de exemplo (opcional — remova se não quiser)
-- -------------------------------------------------------
INSERT INTO public.funcionarios (nome, matricula, telefone, cargo, setor, status) VALUES
  ('Carlos Alberto Silva',   '001', '11987654321', 'Operador',   'Produção',    'ativo'),
  ('Maria Fernanda Costa',   '002', '11976543210', 'Técnico',    'Manutenção',  'ativo'),
  ('João Paulo Souza',       '003', '11965432109', 'Auxiliar',   'Produção',    'ativo'),
  ('Ana Luiza Pereira',      '004', '11954321098', 'Técnico',    'Qualidade',   'ativo'),
  ('Roberto Carlos Lima',    '005', '11943210987', 'Operador',   'Produção',    'ativo'),
  ('Fernanda Oliveira',      '006', '11932109876', 'Líder',      'Manutenção',  'ativo'),
  ('Marcos Antonio Gomes',   '007', '11921098765', 'Auxiliar',   'Limpeza',     'ativo'),
  ('Patrícia Santos Reis',   '008', '11910987654', 'Operador',   'Produção',    'ativo'),
  ('Leandro Ferreira',       '009', '11909876543', 'Técnico',    'Elétrica',    'ativo'),
  ('Simone Mendes',          '010', '11998765432', 'Auxiliar',   'Produção',    'ativo')
ON CONFLICT DO NOTHING;

INSERT INTO public.notificacoes (titulo, descricao, tipo, visualizada) VALUES
  ('Funcionário faltando',       'Carlos Alberto não registrou presença hoje.', 'falta',   false),
  ('Escala pendente',            'Escala de Junho não foi configurada ainda.',  'escala',  false),
  ('Atestado lançado',           'Maria Fernanda enviou atestado médico.',      'atestado',false),
  ('Sistema configurado',        'Bem-vindo ao sistema de gestão de equipe!',   'info',    true)
ON CONFLICT DO NOTHING;
