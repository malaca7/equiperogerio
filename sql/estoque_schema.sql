-- ====================================================================================
-- GESTÃO DE ESTOQUE CORPORATIVO - ERP MODULE
-- Schema completo para controle de materiais, EPIs, Ferramentas e Almoxarifado
-- ====================================================================================

-- 1. CATEGORIAS DE PRODUTOS
CREATE TABLE IF NOT EXISTS estoque_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  cor VARCHAR(20) DEFAULT '#64748b',
  icone VARCHAR(50) DEFAULT 'package',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. FORNECEDORES
CREATE TABLE IF NOT EXISTS estoque_fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razao_social VARCHAR(200) NOT NULL,
  nome_fantasia VARCHAR(200),
  cnpj VARCHAR(20) UNIQUE,
  email VARCHAR(100),
  telefone VARCHAR(20),
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. LOCALIDADES DE ESTOQUE (Matriz, Filiais, Obras, Veículos)
CREATE TABLE IF NOT EXISTS estoque_locais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'matriz', -- matriz, filial, obra, veiculo
  responsavel_id UUID REFERENCES profiles(id),
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 4. CADASTRO DE PRODUTOS
CREATE TABLE IF NOT EXISTS estoque_produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_interno VARCHAR(50) UNIQUE,
  codigo_barras VARCHAR(100) UNIQUE,
  qrcode VARCHAR(255) UNIQUE,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES estoque_categorias(id),
  unidade_medida VARCHAR(20) NOT NULL DEFAULT 'UN', -- UN, KG, L, CX, M
  marca VARCHAR(100),
  modelo VARCHAR(100),
  estoque_minimo DECIMAL(10,3) DEFAULT 0,
  estoque_maximo DECIMAL(10,3) DEFAULT 0,
  valor_unitario_atual DECIMAL(10,2) DEFAULT 0,
  foto_url TEXT,
  controle_lote BOOLEAN DEFAULT false,
  controle_validade BOOLEAN DEFAULT false,
  controle_ca BOOLEAN DEFAULT false, -- Certificado de Aprovação (para EPIs)
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 5. SALDOS DE ESTOQUE POR LOCAL
CREATE TABLE IF NOT EXISTS estoque_saldos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID REFERENCES estoque_produtos(id) ON DELETE CASCADE,
  local_id UUID REFERENCES estoque_locais(id) ON DELETE CASCADE,
  quantidade DECIMAL(10,3) DEFAULT 0,
  lote VARCHAR(50),
  validade DATE,
  ultima_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  UNIQUE(produto_id, local_id, lote)
);

-- 6. MOVIMENTAÇÕES DE ESTOQUE (Entradas, Saídas, Ajustes, Transferências)
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(20) NOT NULL, -- entrada, saida, ajuste, transferencia
  subtipo VARCHAR(50) NOT NULL, -- compra, consumo, perda, doacao_epi, emprestimo_ferramenta
  produto_id UUID REFERENCES estoque_produtos(id),
  local_origem_id UUID REFERENCES estoque_locais(id),
  local_destino_id UUID REFERENCES estoque_locais(id),
  quantidade DECIMAL(10,3) NOT NULL,
  valor_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  nota_fiscal VARCHAR(50),
  fornecedor_id UUID REFERENCES estoque_fornecedores(id),
  funcionario_id UUID REFERENCES profiles(id), -- Quem recebeu (consumo/epi)
  obra_id UUID, -- Relacionamento com Obras/Projetos se houver
  veiculo_id UUID, -- Relacionamento com Frota se houver
  usuario_id UUID REFERENCES profiles(id) NOT NULL, -- Quem registrou no sistema
  observacao TEXT,
  data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 7. CONTROLE DE EPI E FERRAMENTAS (Empréstimos/Entregas)
CREATE TABLE IF NOT EXISTS estoque_cautelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(20) NOT NULL, -- epi, ferramenta
  movimentacao_id UUID REFERENCES estoque_movimentacoes(id) UNIQUE,
  funcionario_id UUID REFERENCES profiles(id) NOT NULL,
  produto_id UUID REFERENCES estoque_produtos(id) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  data_entrega TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  data_devolucao_prevista DATE,
  data_devolucao_realizada TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'ativo', -- ativo, devolvido, perdido, danificado
  assinatura_digital TEXT, -- Base64 da assinatura
  foto_entrega TEXT,
  foto_devolucao TEXT,
  termo_gerado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 8. SOLICITAÇÕES DE COMPRA/REPOSIÇÃO
CREATE TABLE IF NOT EXISTS estoque_solicitacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID REFERENCES estoque_produtos(id),
  local_id UUID REFERENCES estoque_locais(id),
  quantidade_solicitada DECIMAL(10,3) NOT NULL,
  quantidade_aprovada DECIMAL(10,3),
  solicitante_id UUID REFERENCES profiles(id) NOT NULL,
  aprovador_id UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'pendente', -- pendente, aprovada, comprada, negada, cancelada
  motivo TEXT,
  data_necessidade DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ====================================================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA DE SALDO
-- ====================================================================================

-- Função para atualizar o saldo após movimentação
CREATE OR REPLACE FUNCTION update_estoque_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    -- Inserir ou atualizar o saldo para entrada
    INSERT INTO estoque_saldos (produto_id, local_id, quantidade)
    VALUES (NEW.produto_id, NEW.local_destino_id, NEW.quantidade)
    ON CONFLICT (produto_id, local_id, lote) 
    DO UPDATE SET 
      quantidade = estoque_saldos.quantidade + NEW.quantidade,
      ultima_movimentacao = now();
      
  ELSIF NEW.tipo = 'saida' OR NEW.tipo = 'consumo' THEN
    -- Reduzir o saldo para saída
    UPDATE estoque_saldos 
    SET 
      quantidade = quantidade - NEW.quantidade,
      ultima_movimentacao = now()
    WHERE produto_id = NEW.produto_id AND local_id = NEW.local_origem_id;
    
  ELSIF NEW.tipo = 'transferencia' THEN
    -- Reduzir da origem
    UPDATE estoque_saldos 
    SET quantidade = quantidade - NEW.quantidade, ultima_movimentacao = now()
    WHERE produto_id = NEW.produto_id AND local_id = NEW.local_origem_id;
    
    -- Aumentar no destino
    INSERT INTO estoque_saldos (produto_id, local_id, quantidade)
    VALUES (NEW.produto_id, NEW.local_destino_id, NEW.quantidade)
    ON CONFLICT (produto_id, local_id, lote) 
    DO UPDATE SET 
      quantidade = estoque_saldos.quantidade + NEW.quantidade,
      ultima_movimentacao = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger disparado após inserção de movimentação
DROP TRIGGER IF EXISTS trigger_update_estoque_saldo ON estoque_movimentacoes;
CREATE TRIGGER trigger_update_estoque_saldo
AFTER INSERT ON estoque_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION update_estoque_saldo();


-- ====================================================================================
-- RLS POLICIES (Segurança por Nível de Linha)
-- ====================================================================================

ALTER TABLE estoque_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_cautelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Exemplo de política de leitura geral (Qualquer usuário logado pode ver)
DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_categorias;
CREATE POLICY "View permission for authenticated users" ON estoque_categorias FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_fornecedores;
CREATE POLICY "View permission for authenticated users" ON estoque_fornecedores FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_locais;
CREATE POLICY "View permission for authenticated users" ON estoque_locais FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_produtos;
CREATE POLICY "View permission for authenticated users" ON estoque_produtos FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_saldos;
CREATE POLICY "View permission for authenticated users" ON estoque_saldos FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "View permission for authenticated users" ON estoque_movimentacoes;
CREATE POLICY "View permission for authenticated users" ON estoque_movimentacoes FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir Inserção/Atualização para usuários logados (O ideal é criar function para verificar roles admin)
DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_categorias;
CREATE POLICY "Insert permission for authenticated users" ON estoque_categorias FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_categorias;
CREATE POLICY "Update permission for authenticated users" ON estoque_categorias FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_produtos;
CREATE POLICY "Insert permission for authenticated users" ON estoque_produtos FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update permission for authenticated users" ON estoque_produtos;
CREATE POLICY "Update permission for authenticated users" ON estoque_produtos FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_movimentacoes;
CREATE POLICY "Insert permission for authenticated users" ON estoque_movimentacoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_cautelas;
CREATE POLICY "Insert permission for authenticated users" ON estoque_cautelas FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert permission for authenticated users" ON estoque_solicitacoes;
CREATE POLICY "Insert permission for authenticated users" ON estoque_solicitacoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
