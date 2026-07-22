-- Simplificação e correção DEFINITIVA das políticas de RLS para Frota
-- Garantindo que qualquer usuário autenticado possa inserir veículos

DROP POLICY IF EXISTS "Veículos visíveis para autenticados" ON frota_veiculos;
DROP POLICY IF EXISTS "Apenas admins gerenciam veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários inserem veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários atualizam e deletam próprios veículos" ON frota_veiculos;
DROP POLICY IF EXISTS "Usuários deletam próprios veículos" ON frota_veiculos;

-- 1. Leitura: Qualquer usuário logado pode ver
CREATE POLICY "Leitura de veículos para autenticados" 
ON frota_veiculos FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Inserção: Qualquer usuário logado pode inserir
CREATE POLICY "Inserção de veículos para autenticados" 
ON frota_veiculos FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Atualização: Usuário que criou ou Admin
CREATE POLICY "Atualização de veículos" 
ON frota_veiculos FOR UPDATE USING (
  criado_por = auth.uid() 
  OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);

-- 4. Deleção: Usuário que criou ou Admin
CREATE POLICY "Deleção de veículos" 
ON frota_veiculos FOR DELETE USING (
  criado_por = auth.uid() 
  OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);
