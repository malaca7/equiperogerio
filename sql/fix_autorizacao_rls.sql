-- ==========================================
-- CORRIGIR RLS DA TABELA DE AUTORIZAÇÕES DE VEÍCULOS
-- ==========================================

-- 1. Primeiro, garantimos que a tabela está com RLS ativado para aceitar políticas
ALTER TABLE frota_veiculos_autorizados ENABLE ROW LEVEL SECURITY;

-- 2. Limpamos qualquer política antiga ou defeituosa que possa estar bloqueando
DROP POLICY IF EXISTS "Permitir tudo para frota_veiculos_autorizados" ON frota_veiculos_autorizados;
DROP POLICY IF EXISTS "Todos autenticados leem autorizacoes" ON frota_veiculos_autorizados;
DROP POLICY IF EXISTS "Admins gerenciam autorizacoes" ON frota_veiculos_autorizados;

-- 3. Criamos uma política absoluta de liberação (True/True)
CREATE POLICY "Permitir tudo para frota_veiculos_autorizados" 
ON frota_veiculos_autorizados 
FOR ALL 
USING (true) 
WITH CHECK (true);
