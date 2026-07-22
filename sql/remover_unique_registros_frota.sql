-- Remove a restrição que impede que um motorista faça mais de uma viagem no mesmo dia com o mesmo veículo
ALTER TABLE frota_registros_diarios
DROP CONSTRAINT IF EXISTS frota_registros_diarios_veiculo_id_data_usuario_id_key;

ALTER TABLE frota_registros_diarios
DROP CONSTRAINT IF EXISTS frota_registros_diarios_veiculo_id_data_usuario_key;
