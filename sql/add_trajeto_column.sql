-- Adiciona coluna de trajeto na tabela de registros diários para controle de rotas
ALTER TABLE frota_registros_diarios ADD COLUMN IF NOT EXISTS trajeto TEXT;
