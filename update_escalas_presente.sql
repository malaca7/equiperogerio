-- =============================================================
-- ATUALIZAÇÃO DA TABELA ESCALAS - ADICIONAR PRESENTE (X)
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Remover a restrição antiga do tipo de escala
ALTER TABLE public.escalas DROP CONSTRAINT IF EXISTS escalas_tipo_check;

-- Adicionar a nova restrição com a opção 'presente' (X)
ALTER TABLE public.escalas ADD CONSTRAINT escalas_tipo_check 
  CHECK (tipo IN (
    'presente',
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
