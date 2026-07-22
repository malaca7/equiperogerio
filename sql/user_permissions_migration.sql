-- =============================================================
-- MIGRAÇÃO PARA SISTEMA DE PERMISSÕES ISOLADAS POR USUÁRIO
-- Execute este script NO SQL EDITOR DO SUPABASE (role: postgres)
-- =============================================================

-- ============================================================
-- 1. Criar tabela de permissões diretas por usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS user_direct_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  UNIQUE (user_id, permission_id)
);

-- ============================================================
-- 2. Habilitar RLS e criar políticas
-- ============================================================
ALTER TABLE user_direct_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View user_direct_permissions" ON user_direct_permissions;
CREATE POLICY "View user_direct_permissions" ON user_direct_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert user_direct_permissions" ON user_direct_permissions;
CREATE POLICY "Insert user_direct_permissions" ON user_direct_permissions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Delete user_direct_permissions" ON user_direct_permissions;
CREATE POLICY "Delete user_direct_permissions" ON user_direct_permissions
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. Migrar permissões existentes de role-based para per-user
--    Copia todas as permissões que cada usuário tem via cargo
--    diretamente para a nova tabela user_direct_permissions
-- ============================================================
INSERT INTO user_direct_permissions (user_id, permission_id)
SELECT DISTINCT ur.user_id, rp.permission_id
FROM user_roles ur
JOIN role_permissions rp ON rp.role_id = ur.role_id
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- ============================================================
-- 4. Verificação: contagem de registros migrados
-- ============================================================
SELECT 
  'Migração concluída!' as status,
  (SELECT COUNT(*) FROM user_direct_permissions) as total_permissoes_diretas,
  (SELECT COUNT(DISTINCT user_id) FROM user_direct_permissions) as total_usuarios_afetados;
