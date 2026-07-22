-- VAMOS REMOVER TODAS AS POLÍTICAS DA TABELA DE FORMA DINÂMICA
-- Isso garante que nenhuma política antiga com nome diferente fique travando a tabela.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'frota_veiculos') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON frota_veiculos';
    END LOOP;
END $$;

-- Agora, vamos criar uma política universal para garantir que funcione
CREATE POLICY "Politica Universal Frota Veiculos" 
ON frota_veiculos 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Ativar RLS (que agora está com acesso total via Política Universal)
ALTER TABLE frota_veiculos ENABLE ROW LEVEL SECURITY;
