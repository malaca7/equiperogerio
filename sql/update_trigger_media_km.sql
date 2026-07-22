-- =========================================================================
-- MIGRAÇÃO REFINADA: CORREÇÃO E ROBUSTEZ DO CÁLCULO DA MÉDIA DIÁRIA DE KM
-- Suporta: INSERT, UPDATE e DELETE.
-- Garante: Dias em aberto (onde km_final é NULO) são 100% ignorados no cálculo.
--          O cálculo é feito apenas com rotas fechadas (finalizadas).
-- =========================================================================

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

-- Recriar o trigger com suporte a DELETE
DROP TRIGGER IF EXISTS tg_update_veiculo_km ON frota_registros_diarios;
CREATE TRIGGER tg_update_veiculo_km
AFTER INSERT OR UPDATE OR DELETE ON frota_registros_diarios
FOR EACH ROW EXECUTE FUNCTION update_veiculo_km_on_registro();
