-- Atualizar políticas de RLS para frota_veiculos para permitir que usuários cadastrem seus próprios veículos

DROP POLICY IF EXISTS "Apenas admins gerenciam veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários gerenciam próprios veículos" ON frota_veiculos;

-- Admin tem acesso total (se tiver nível >= 80)
CREATE POLICY "Apenas admins gerenciam veículos" ON frota_veiculos FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);

-- Usuários podem inserir se estiverem definindo eles mesmos como criadores
CREATE POLICY "Usuários inserem veículos" ON frota_veiculos FOR INSERT WITH CHECK (
  criado_por = auth.uid()
);

-- Usuários podem atualizar e deletar os veículos que criaram
CREATE POLICY "Usuários atualizam e deletam próprios veículos" ON frota_veiculos FOR UPDATE USING (
  criado_por = auth.uid()
);
CREATE POLICY "Usuários deletam próprios veículos" ON frota_veiculos FOR DELETE USING (
  criado_por = auth.uid()
);
