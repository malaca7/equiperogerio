-- =============================================================
-- ATUALIZAÇÃO DA TABELA ESCALAS
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Remover a restrição antiga do tipo de escala
ALTER TABLE public.escalas DROP CONSTRAINT IF EXISTS escalas_tipo_check;

-- Adicionar a nova restrição com as opções solicitadas
ALTER TABLE public.escalas ADD CONSTRAINT escalas_tipo_check 
  CHECK (tipo IN (
    'falta',
    'falta_justificada',
    'suspensao',
    'atestado',
    'paternidade',
    'obito_familiar',
    'beneficio',
    'repouso',
    'compensar',
    'ferias',
    'transferencia'
  ));
