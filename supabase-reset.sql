-- =====================================================
-- SCRIPT DE RESET E ATUALIZAÇÃO (RODAR NO SUPABASE)
-- Limpa o banco anterior e recria com CPF + Senha
-- =====================================================

-- 1. Remover gatilhos antigos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Limpar tabelas antigas (Isso apagará dados de teste de usuários/cargos)
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS login_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. Recriar PROFILES
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text UNIQUE NOT NULL,
  senha text NOT NULL,
  nome text NOT NULL,
  email text,
  avatar_url text,
  ativo boolean DEFAULT true,
  ultimo_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_profiles_cpf ON profiles(cpf);

-- 4. Recriar ROLES
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  descricao text,
  cor text DEFAULT '#6366f1',
  nivel integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Recriar PERMISSIONS
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina text NOT NULL,
  acao text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pagina, acao)
);

-- 6. Recriar ROLE_PERMISSIONS
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
CREATE INDEX idx_rp_role ON role_permissions(role_id);

-- 7. Recriar USER_ROLES
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);
CREATE INDEX idx_ur_user ON user_roles(user_id);

-- 8. Recriar AUDIT_LOGS
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  acao text NOT NULL,
  modulo text NOT NULL,
  descricao text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  user_agent text,
  rota text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- 9. Recriar LOGIN_LOGS
CREATE TABLE login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  sucesso boolean DEFAULT false,
  dispositivo text,
  navegador text,
  motivo_falha text,
  tentativa_em timestamptz DEFAULT now()
);
CREATE INDEX idx_login_tentativa ON login_logs(tentativa_em DESC);

-- 10. Recriar SECURITY_EVENTS
CREATE TABLE security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'info',
  descricao text,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_security_created ON security_events(created_at DESC);

-- =====================================================
-- DESABILITAR RLS (login sem Supabase Auth = anon key)
-- =====================================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE security_events DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- DADOS INICIAIS — CARGOS
-- =====================================================
INSERT INTO roles (nome, descricao, cor, nivel) VALUES
  ('DESENVOLVEDOR', 'Acesso total ao sistema', '#ef4444', 100),
  ('GERENTE',       'Gerência operacional completa', '#f97316', 90),
  ('SUPERVISOR',    'Supervisão de equipes', '#eab308', 80),
  ('RH',            'Recursos Humanos', '#22c55e', 70),
  ('DP',            'Departamento Pessoal', '#14b8a6', 60),
  ('TS',            'Técnico de Segurança', '#3b82f6', 50),
  ('FROTA',         'Gestão de Frota', '#8b5cf6', 40),
  ('ENCARREGADO',   'Encarregado operacional', '#6366f1', 30)
ON CONFLICT (nome) DO NOTHING;

-- =====================================================
-- DADOS INICIAIS — PERMISSÕES
-- =====================================================
INSERT INTO permissions (pagina, acao, descricao) VALUES
  ('dashboard', 'visualizar', 'Visualizar painel principal'),
  ('dashboard', 'editar', 'Editar dados do painel'),
  ('dashboard', 'administrar', 'Administrar configurações do painel'),
  ('funcionarios', 'visualizar', 'Visualizar lista de funcionários'),
  ('funcionarios', 'editar', 'Criar e editar funcionários'),
  ('funcionarios', 'administrar', 'Excluir funcionários'),
  ('frequencia', 'visualizar', 'Visualizar chamada/frequência'),
  ('frequencia', 'editar', 'Registrar presença/falta'),
  ('frequencia', 'administrar', 'Reset e controle total'),
  ('escala', 'visualizar', 'Visualizar escala'),
  ('escala', 'editar', 'Editar escala'),
  ('escala', 'administrar', 'Gerar escala automática'),
  ('localidades', 'visualizar', 'Visualizar mapa de localidades'),
  ('localidades', 'editar', 'Alocar funcionários em locais'),
  ('localidades', 'administrar', 'Gerenciar localidades'),
  ('atestados', 'visualizar', 'Visualizar atestados'),
  ('atestados', 'editar', 'Registrar atestados'),
  ('atestados', 'administrar', 'Excluir atestados'),
  ('observacoes', 'visualizar', 'Visualizar observações'),
  ('observacoes', 'editar', 'Criar observações'),
  ('observacoes', 'administrar', 'Excluir observações'),
  ('rendimento', 'visualizar', 'Visualizar rendimento'),
  ('rendimento', 'editar', 'Editar rendimento'),
  ('rendimento', 'administrar', 'Administrar rendimento'),
  ('notificacoes', 'visualizar', 'Visualizar notificações'),
  ('notificacoes', 'editar', 'Gerenciar notificações'),
  ('notificacoes', 'administrar', 'Administrar notificações'),
  ('configuracoes', 'visualizar', 'Visualizar configurações'),
  ('configuracoes', 'editar', 'Editar configurações'),
  ('configuracoes', 'administrar', 'Administrar configurações avançadas'),
  ('admin', 'visualizar', 'Acessar painel administrativo'),
  ('admin', 'editar', 'Editar usuários e cargos'),
  ('admin', 'administrar', 'Controle total do sistema')
ON CONFLICT (pagina, acao) DO NOTHING;

-- DESENVOLVEDOR recebe TODAS as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.nome = 'DESENVOLVEDOR'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ENCARREGADO recebe permissões operacionais (sem admin)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.nome = 'ENCARREGADO'
  AND p.pagina IN ('dashboard','funcionarios','frequencia','escala','localidades','atestados','observacoes','rendimento','notificacoes')
  AND p.acao IN ('visualizar','editar')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- USUÁRIO INICIAL DE ADMIN (CPF: 09924553403, Senha: 1234)
-- =====================================================
INSERT INTO profiles (cpf, senha, nome, email, ativo) VALUES
  ('09924553403', '1234', 'Rogerio', 'rogerio@7boss.com', true)
ON CONFLICT (cpf) DO NOTHING;

-- Atribuir cargo DESENVOLVEDOR ao admin
INSERT INTO user_roles (user_id, role_id)
SELECT p.id, r.id FROM profiles p, roles r
WHERE p.cpf = '09924553403' AND r.nome = 'DESENVOLVEDOR'
ON CONFLICT (user_id, role_id) DO NOTHING;
