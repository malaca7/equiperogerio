import { endOfMonth, format, parseISO, addDays } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Escala, EscalaInsert, EscalaUpdate } from '../lib/database.types'

export const ESCALAS_KEY = ['escalas']

type EscalaWithFunc = Escala & {
  funcionarios: {
    id: string
    nome: string
    apelido?: string | null
    cargo: string
    setor: string
  } | null
}

export function useEscalasMensal(mes: string) {
  const dateObj = parseISO(mes + '-01')
  const startDate = format(dateObj, 'yyyy-MM-01')
  const endDate = format(endOfMonth(dateObj), 'yyyy-MM-dd')
  const midDate = format(addDays(dateObj, 15), 'yyyy-MM-dd')

  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, mes],
    queryFn: async () => {
      const [part1, part2] = await Promise.all([
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', startDate)
          .lt('data', midDate)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', midDate)
          .lte('data', endDate)
          .order('data')
      ])

      if (part1.error) throw part1.error
      if (part2.error) throw part2.error

      const combined = [...(part1.data ?? []), ...(part2.data ?? [])]
      return combined as EscalaWithFunc[]
    },
  })
}

export function useEscalasPeriodo(startDate: string, endDate: string) {
  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, 'periodo', startDate, endDate],
    queryFn: async () => {
      // Dividir a busca em dois blocos para contornar o limite de 1000 registros do PostgREST
      const midDate = format(addDays(parseISO(startDate), 15), 'yyyy-MM-dd')
      
      const [part1, part2] = await Promise.all([
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', startDate)
          .lt('data', midDate)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', midDate)
          .lte('data', endDate)
          .order('data')
      ])

      if (part1.error) throw part1.error
      if (part2.error) throw part2.error

      const combined = [...(part1.data ?? []), ...(part2.data ?? [])]
      return combined as EscalaWithFunc[]
    },
    enabled: !!startDate && !!endDate,
  })
}

export function useEscalaFuncionario(funcionarioId: string, mes: string) {
  const dateObj = parseISO(mes + '-01')
  const startDate = format(dateObj, 'yyyy-MM-01')
  const endDate = format(endOfMonth(dateObj), 'yyyy-MM-dd')
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
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
