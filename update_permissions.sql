-- =================================================================
-- SCRIPT PARA SIMPLIFICAR PERMISSÕES: VISUALIZAR E GERENCIAR
-- Execute este script no SQL Editor do Supabase
-- =================================================================

-- 1. Create 'gerenciar' permissions if they don't exist
INSERT INTO permissions (pagina, acao, descricao)
SELECT DISTINCT pagina, 'gerenciar', 'Gerenciar ' || pagina
FROM permissions
WHERE acao IN ('editar', 'administrar')
ON CONFLICT (pagina, acao) DO NOTHING;

-- 2. Migrate role_permissions from editar/administrar to gerenciar
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permissions rp
JOIN permissions p_old ON p_old.id = rp.permission_id
JOIN permissions p_new ON p_new.pagina = p_old.pagina AND p_new.acao = 'gerenciar'
WHERE p_old.acao IN ('editar', 'administrar')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Delete old role_permissions for editar/administrar
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE acao IN ('editar', 'administrar')
);

-- 4. Delete old permissions
DELETE FROM permissions WHERE acao IN ('editar', 'administrar');
