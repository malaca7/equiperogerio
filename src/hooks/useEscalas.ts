import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Escala, EscalaInsert, EscalaUpdate } from '../lib/database.types'

export const ESCALAS_KEY = ['escalas']

type EscalaWithFunc = Escala & {
  funcionarios: {
    id: string
    nome: string
    cargo: string
    setor: string
  } | null
}

export function useEscalasMensal(mes: string) {
  const startDate = `${mes}-01`
  const endDate = `${mes}-31`
  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalas')
        .select('*, funcionarios(id, nome, cargo, setor)')
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data')
      if (error) throw error
      return (data ?? []) as EscalaWithFunc[]
    },
  })
}

export function useEscalasPeriodo(startDate: string, endDate: string) {
  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, 'periodo', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalas')
        .select('*, funcionarios(id, nome, cargo, setor)')
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data')
      if (error) throw error
      return (data ?? []) as EscalaWithFunc[]
    },
    enabled: !!startDate && !!endDate,
  })
}

export function useEscalaFuncionario(funcionarioId: string, mes: string) {
  const startDate = `${mes}-01`
  const endDate = `${mes}-31`
  return useQuery<Escala[]>({
    queryKey: [...ESCALAS_KEY, 'funcionario', funcionarioId, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalas')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data')
      if (error) throw error
      return (data ?? []) as Escala[]
    },
    enabled: !!funcionarioId,
  })
}

export function useCreateEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: EscalaInsert) => {
      const { data: result, error } = await supabase
        .from('escalas')
        .upsert(
          { ...data, updated_at: new Date().toISOString() },
          { onConflict: 'funcionario_id,data' }
        )
        .select()
        .single()
      if (error) throw error
      return result as Escala
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALAS_KEY }),
  })
}

export function useBatchUpsertEscalas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: EscalaInsert[]) => {
      const { data: result, error } = await supabase
        .from('escalas')
        .upsert(
          data.map(d => ({ ...d, updated_at: new Date().toISOString() })),
          { onConflict: 'funcionario_id,data' }
        )
        .select()
      if (error) throw error
      return result as Escala[]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALAS_KEY }),
  })
}

export function useUpdateEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EscalaUpdate }) => {
      const { data: result, error } = await supabase
        .from('escalas')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as Escala
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALAS_KEY }),
  })
}

export function useDeleteEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('escalas')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALAS_KEY }),
  })
}
