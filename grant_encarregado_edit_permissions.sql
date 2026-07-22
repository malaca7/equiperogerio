-- =================================================================
-- SCRIPT DE CONCESSÃO DE PERMISSÃO DE GERENCIAMENTO PARA ENCARREGADOS
-- Execute este script no SQL Editor do Supabase
-- =================================================================

-- 1. Garante que as permissões 'gerenciar' para escala, frequencia e localidades existam no banco
INSERT INTO permissions (pagina, acao, descricao)
VALUES 
('escala', 'gerenciar', 'Gerenciar Escala'),
('frequencia', 'gerenciar', 'Gerenciar Frequência / Chamada'),
('localidades', 'gerenciar', 'Gerenciar Localidades')
ON CONFLICT (pagina, acao) DO NOTHING;

-- 2. Concede permissão de GERENCIAR para as páginas de produção para todos os cargos de Encarregado
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome ILIKE '%encarregado%'
  AND p.pagina IN ('escala', 'frequencia', 'localidades')
  AND p.acao = 'gerenciar'
ON CONFLICT (role_id, permission_id) DO NOTHING;