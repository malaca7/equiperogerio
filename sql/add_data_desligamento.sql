-- Migration: Adicionar data de desligamento aos funcionários
ALTER TABLE public.funcionarios ADD COLUMN data_desligamento DATE;
