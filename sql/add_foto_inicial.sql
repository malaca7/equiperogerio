-- Adiciona a nova coluna para guardar a foto da saída
ALTER TABLE frota_registros_diarios 
ADD COLUMN IF NOT EXISTS foto_hodometro_inicial text;

-- Recarrega o schema do Supabase para que a API reconheça a nova coluna imediatamente
NOTIFY pgrst, 'reload schema';
