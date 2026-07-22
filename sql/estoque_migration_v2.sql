-- ====================================================================================
-- MIGRAÇÃO V2 — Sistema Multirregiões + Auditoria + Campos Extras
-- Rodar no Supabase SQL Editor APÓS o schema base (estoque_schema.sql)
-- ====================================================================================

-- 1. REGIÕES
CREATE TABLE IF NOT EXISTS estoque_regioes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(20) UNIQUE,
  endereco TEXT,
  responsavel_id UUID REFERENCES profiles(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE estoque_regioes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View estoque_regioes" ON estoque_regioes;
DROP POLICY IF EXISTS "Insert estoque_regioes" ON estoque_regioes;
DROP POLICY IF EXISTS "Update estoque_regioes" ON estoque_regioes;
DROP POLICY IF EXISTS "Delete estoque_regioes" ON estoque_regioes;
DROP POLICY IF EXISTS "Manage estoque_regioes" ON estoque_regioes;

CREATE POLICY "Manage estoque_regioes" ON estoque_regioes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. VINCULAR LOCAIS A REGIÕES
ALTER TABLE estoque_locais ADD COLUMN IF NOT EXISTS regiao_id UUID REFERENCES estoque_regioes(id);

-- 3. PERMISSÕES POR REGIÃO
CREATE TABLE IF NOT EXISTS estoque_permissoes_regiao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  regiao_id UUID NOT NULL REFERENCES estoque_regioes(id) ON DELETE CASCADE,
  nivel VARCHAR(20) NOT NULL DEFAULT 'operador',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  UNIQUE(usuario_id, regiao_id)
);

ALTER TABLE estoque_permissoes_regiao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View estoque_permissoes_regiao" ON estoque_permissoes_regiao;
CREATE POLICY "View estoque_permissoes_regiao" ON estoque_permissoes_regiao FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage estoque_permissoes_regiao" ON estoque_permissoes_regiao;
CREATE POLICY "Manage estoque_permissoes_regiao" ON estoque_permissoes_regiao FOR ALL USING (auth.role() = 'authenticated');

-- 4. LOG DE AUDITORIA IMUTÁVEL
CREATE TABLE IF NOT EXISTS estoque_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabela VARCHAR(100) NOT NULL,
  registro_id UUID NOT NULL,
  acao VARCHAR(20) NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE estoque_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View estoque_audit_log" ON estoque_audit_log;
DROP POLICY IF EXISTS "Insert estoque_audit_log" ON estoque_audit_log;
DROP POLICY IF EXISTS "Manage estoque_audit_log" ON estoque_audit_log;

CREATE POLICY "Manage estoque_audit_log" ON estoque_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. NOVOS CAMPOS EM PRODUTOS
ALTER TABLE estoque_produtos ADD COLUMN IF NOT EXISTS localizacao_fisica VARCHAR(100);
ALTER TABLE estoque_produtos ADD COLUMN IF NOT EXISTS tipo_material VARCHAR(30) DEFAULT 'geral';

-- 6. NOVOS CAMPOS EM MOVIMENTAÇÕES
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS regiao_id UUID REFERENCES estoque_regioes(id);
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES profiles(id);
ALTER TABLE estoque_movimentacoes ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(20) DEFAULT 'aprovado';

-- 7. ALERTAS DE ESTOQUE
CREATE TABLE IF NOT EXISTS estoque_alertas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(30) NOT NULL, -- estoque_minimo, consumo_elevado, item_parado, cautela_vencida, transferencia_pendente
  produto_id UUID REFERENCES estoque_produtos(id),
  regiao_id UUID REFERENCES estoque_regioes(id),
  local_id UUID REFERENCES estoque_locais(id),
  mensagem TEXT NOT NULL,
  severidade VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  resolvido_por UUID REFERENCES profiles(id),
  resolvido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE estoque_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View estoque_alertas" ON estoque_alertas;
CREATE POLICY "View estoque_alertas" ON estoque_alertas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage estoque_alertas" ON estoque_alertas;
CREATE POLICY "Manage estoque_alertas" ON estoque_alertas FOR ALL USING (auth.role() = 'authenticated');

-- 8. TRIGGER DE AUDITORIA AUTOMÁTICA EM MOVIMENTAÇÕES
CREATE OR REPLACE FUNCTION estoque_audit_movimentacao()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO estoque_audit_log (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES ('estoque_movimentacoes', NEW.id, 'insert', to_jsonb(NEW), NEW.usuario_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_movimentacao ON estoque_movimentacoes;
CREATE TRIGGER trigger_audit_movimentacao
AFTER INSERT ON estoque_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION estoque_audit_movimentacao();

-- 9. TRIGGER DE AUDITORIA EM CAUTELAS
CREATE OR REPLACE FUNCTION estoque_audit_cautela()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO estoque_audit_log (tabela, registro_id, acao, dados_novos)
    VALUES ('estoque_cautelas', NEW.id, 'insert', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO estoque_audit_log (tabela, registro_id, acao, dados_anteriores, dados_novos)
    VALUES ('estoque_cautelas', NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_cautela ON estoque_cautelas;
CREATE TRIGGER trigger_audit_cautela
AFTER INSERT OR UPDATE ON estoque_cautelas
FOR EACH ROW
EXECUTE FUNCTION estoque_audit_cautela();

-- 10. UPDATES EM CAUTELAS
DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_cautelas;
CREATE POLICY "Update permission for authenticated users" ON estoque_cautelas FOR UPDATE USING (auth.role() = 'authenticated');

-- 11. VIEW E INSERT EM CAUTELAS
DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_cautelas;
CREATE POLICY "View permission for authenticated users" ON estoque_cautelas FOR SELECT USING (auth.role() = 'authenticated');

-- 12. SOLICITAÇÕES UPDATE
DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_solicitacoes;
CREATE POLICY "Update permission for authenticated users" ON estoque_solicitacoes FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_solicitacoes;
CREATE POLICY "View permission for authenticated users" ON estoque_solicitacoes FOR SELECT USING (auth.role() = 'authenticated');

-- 13. LOCAIS INSERT/UPDATE
DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_locais;
CREATE POLICY "Insert permission for authenticated users" ON estoque_locais FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_locais;
CREATE POLICY "Update permission for authenticated users" ON estoque_locais FOR UPDATE USING (auth.role() = 'authenticated');

-- 14. FORNECEDORES INSERT/UPDATE
DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_fornecedores;
CREATE POLICY "Insert permission for authenticated users" ON estoque_fornecedores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_fornecedores;
CREATE POLICY "Update permission for authenticated users" ON estoque_fornecedores FOR UPDATE USING (auth.role() = 'authenticated');

-- 15. SALDOS INSERT/UPDATE
DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_saldos;
CREATE POLICY "Insert permission for authenticated users" ON estoque_saldos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_saldos;
CREATE POLICY "Update permission for authenticated users" ON estoque_saldos FOR UPDATE USING (auth.role() = 'authenticated');
