-- =================================================================
-- SCRIPT PARA ADICIONAR O DASHBOARD DE PRODUÇÃO
-- Execute este script no SQL Editor do Supabase
-- =================================================================

-- 1. Inserir a permissão do Dashboard de Produção
INSERT INTO permissions (pagina, acao, descricao)
VALUES 
('dashboard_producao', 'visualizar', 'Visualização do Dashboard de Produção'),
('dashboard_producao', 'gerenciar', 'Gerenciamento do Dashboard de Produção')
ON CONFLICT (pagina, acao) DO NOTHING;

-- 2. Conceder permissão de visualizar o Dashboard de Produção para Cargos de Nível >= 30 (Encarregados para cima)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.pagina = 'dashboard_producao' AND p.acao = 'visualizar' AND r.nivel >= 30
ON CONFLICT (role_id, permission_id) DO NOTHING;
