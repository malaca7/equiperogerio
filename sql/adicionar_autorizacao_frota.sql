-- ==========================================
-- ADICIONAR TABELA DE AUTORIZAÇÃO DE VEÍCULOS
-- ==========================================

CREATE TABLE IF NOT EXISTS frota_veiculos_autorizados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    veiculo_id UUID NOT NULL REFERENCES frota_veiculos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(veiculo_id, usuario_id)
);

-- Desativar RLS nesta tabela para evitar colisões de políticas
ALTER TABLE frota_veiculos_autorizados DISABLE ROW LEVEL SECURITY;
