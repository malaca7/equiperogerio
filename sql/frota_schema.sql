-- ==========================================
-- SCHEMA PARA GESTÃO DE FROTA
-- ==========================================

-- 1. Tabela de Veículos
CREATE TABLE IF NOT EXISTS frota_veiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    placa VARCHAR(10) NOT NULL UNIQUE,
    modelo VARCHAR(100) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    ano INTEGER,
    km_atual INTEGER NOT NULL DEFAULT 0,
    km_proxima_troca_oleo INTEGER NOT NULL DEFAULT 0,
    media_km_diaria NUMERIC(10, 2) DEFAULT 0,
    usuario_responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'manutencao', 'inativo')),
    criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Registros Diários (KM)
CREATE TABLE IF NOT EXISTS frota_registros_diarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veiculo_id UUID NOT NULL REFERENCES frota_veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    km_inicial INTEGER NOT NULL,
    km_final INTEGER,
    trajeto TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Abastecimentos
CREATE TABLE IF NOT EXISTS frota_abastecimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veiculo_id UUID NOT NULL REFERENCES frota_veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    litros NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    km_no_momento INTEGER NOT NULL,
    posto VARCHAR(255),
    comprovante_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Manutenções
CREATE TABLE IF NOT EXISTS frota_manutencoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veiculo_id UUID NOT NULL REFERENCES frota_veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('troca_oleo', 'preventiva', 'corretiva')),
    descricao TEXT NOT NULL,
    valor NUMERIC(10, 2),
    km_no_momento INTEGER NOT NULL,
    oficina VARCHAR(255),
    comprovante_url TEXT,
    proxima_troca_km INTEGER, -- Usado caso o tipo seja 'troca_oleo'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE frota_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_registros_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frota_manutencoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Acesso total para administradores/gestores de frota e leitura/escrita condicional para usuários

-- Veículos: Todos autenticados podem ver os ativos ou os seus. Apenas gerentes podem editar.
CREATE POLICY "Veículos visíveis para autenticados" ON frota_veiculos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Apenas admins gerenciam veículos" ON frota_veiculos FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);

-- Registros Diários: Usuários veem e gerenciam os próprios, gerentes veem todos
CREATE POLICY "Ver registros diários" ON frota_registros_diarios FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);
CREATE POLICY "Inserir registros diários" ON frota_registros_diarios FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Atualizar próprios registros" ON frota_registros_diarios FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "Deletar próprios registros" ON frota_registros_diarios FOR DELETE USING (usuario_id = auth.uid());

-- Abastecimentos: Usuários veem e gerenciam os próprios, gerentes veem todos
CREATE POLICY "Ver abastecimentos" ON frota_abastecimentos FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);
CREATE POLICY "Inserir abastecimentos" ON frota_abastecimentos FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Atualizar próprios abastecimentos" ON frota_abastecimentos FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "Deletar próprios abastecimentos" ON frota_abastecimentos FOR DELETE USING (usuario_id = auth.uid());

-- Manutenções: Usuários veem e gerenciam as próprias, gerentes veem todas
CREATE POLICY "Ver manutencoes" ON frota_manutencoes FOR SELECT USING (
  usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.nivel >= 80)
);
CREATE POLICY "Inserir manutencoes" ON frota_manutencoes FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Atualizar próprias manutencoes" ON frota_manutencoes FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "Deletar próprias manutencoes" ON frota_manutencoes FOR DELETE USING (usuario_id = auth.uid());


-- ==========================================
-- TRIGGERS E FUNÇÕES AUTOMÁTICAS
-- ==========================================

-- 1. Função para atualizar km_atual e media_km_diaria do veículo após registro de km final ou exclusão
CREATE OR REPLACE FUNCTION update_veiculo_km_on_registro()
RETURNS TRIGGER AS $$
DECLARE
    v_km_atual INTEGER;
    v_dias_uso INTEGER;
    v_km_rodado INTEGER;
    v_veiculo_id UUID;
BEGIN
    -- Determinar o veiculo_id de acordo com a operação
    IF TG_OP = 'DELETE' THEN
        v_veiculo_id := OLD.veiculo_id;
    ELSE
        v_veiculo_id := NEW.veiculo_id;
    END IF;

    -- Se for INSERT ou UPDATE, e possuir KM final, podemos atualizar o km_atual do veículo
    IF TG_OP <> 'DELETE' AND NEW.km_final IS NOT NULL THEN
        UPDATE frota_veiculos 
        SET km_atual = GREATEST(km_atual, NEW.km_final)
        WHERE id = v_veiculo_id;
    END IF;

    -- Recalcular média de KM diário
    -- Soma a diferença (km_final - km_inicial) apenas dos registros finalizados, ignorando dias em aberto (km_final IS NULL)
    SELECT COALESCE(SUM(km_final - km_inicial), 0), COUNT(DISTINCT data)
    INTO v_km_rodado, v_dias_uso
    FROM frota_registros_diarios
    WHERE veiculo_id = v_veiculo_id AND km_final IS NOT NULL;

    IF v_dias_uso > 0 THEN
        UPDATE frota_veiculos
        SET media_km_diaria = (v_km_rodado::NUMERIC / v_dias_uso::NUMERIC)
        WHERE id = v_veiculo_id;
    ELSE
        UPDATE frota_veiculos
        SET media_km_diaria = 0
        WHERE id = v_veiculo_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_update_veiculo_km ON frota_registros_diarios;
CREATE TRIGGER tg_update_veiculo_km
AFTER INSERT OR UPDATE OR DELETE ON frota_registros_diarios
FOR EACH ROW EXECUTE FUNCTION update_veiculo_km_on_registro();


-- 2. Função para atualizar km_proxima_troca e km_atual após manutenção (troca de óleo)
CREATE OR REPLACE FUNCTION update_veiculo_on_manutencao()
RETURNS TRIGGER AS $$
BEGIN
    -- Sempre atualiza o km_atual do veículo pelo km registrado na manutenção
    UPDATE frota_veiculos 
    SET km_atual = GREATEST(km_atual, NEW.km_no_momento)
    WHERE id = NEW.veiculo_id;

    -- Se for troca de óleo, atualiza a próxima troca
    IF NEW.tipo = 'troca_oleo' AND NEW.proxima_troca_km IS NOT NULL THEN
        UPDATE frota_veiculos
        SET km_proxima_troca_oleo = GREATEST(km_proxima_troca_oleo, NEW.proxima_troca_km)
        WHERE id = NEW.veiculo_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_update_veiculo_manutencao
AFTER INSERT OR UPDATE ON frota_manutencoes
FOR EACH ROW EXECUTE FUNCTION update_veiculo_on_manutencao();

-- 3. Função para atualizar km_atual com o abastecimento
CREATE OR REPLACE FUNCTION update_veiculo_on_abastecimento()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE frota_veiculos 
    SET km_atual = GREATEST(km_atual, NEW.km_no_momento)
    WHERE id = NEW.veiculo_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_update_veiculo_abastecimento
AFTER INSERT OR UPDATE ON frota_abastecimentos
FOR EACH ROW EXECUTE FUNCTION update_veiculo_on_abastecimento();
