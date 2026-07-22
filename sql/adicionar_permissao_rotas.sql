-- Insere a nova permissão para a página de Rotas Rápidas
INSERT INTO permissions (id, pagina, acao, descricao)
VALUES 
    (gen_random_uuid(), 'frota_rotas', 'visualizar', 'Permite acessar a página de Rotas Rápidas (lançamento de viagens)'),
    (gen_random_uuid(), 'frota_rotas', 'gerenciar', 'Permite gerenciar a página de Rotas Rápidas')
ON CONFLICT DO NOTHING;

-- Vincula a nova permissão aos papéis de Administrador existentes para garantir que eles tenham acesso
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nivel = 0 
  AND p.pagina = 'frota_rotas'
ON CONFLICT DO NOTHING;
