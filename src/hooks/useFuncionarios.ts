import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Funcionario, FuncionarioInsert, FuncionarioUpdate } from '../lib/database.types'

export const FUNCIONARIOS_KEY = ['funcionarios']

export function useFuncionarios(filters?: { setor?: string; status?: string; search?: string }) {
  return useQuery<Funcionario[]>({
    queryKey: [...FUNCIONARIOS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from('funcionarios')
        .select('*')
        .is('deleted_at', null)
        .order('nome')

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.setor) {
        query = query.eq('setor', filters.setor)
      }
      if (filters?.search) {
        query = query.or(`nome.ilike.%${filters.search}%,matricula.ilike.%${filters.search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Funcionario[]
    },
  })
}

export function useFuncionario(id: string) {
  return useQuery<Funcionario>({
    queryKey: [...FUNCIONARIOS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Funcionario
    },
    enabled: !!id,
  })
}

export function useCreateFuncionario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: FuncionarioInsert) => {
      const { data: result, error } = await supabase
        .from('funcionarios')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result as Funcionario
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNCIONARIOS_KEY }),
  })
}

export function useUpdateFuncionario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FuncionarioUpdate }) => {
      const { data: result, error } = await supabase
        .from('funcionarios')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as Funcionario
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNCIONARIOS_KEY }),
  })
}

export function useDeleteFuncionario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funcionarios')
        .update({ deleted_at: new Date().toISOString(), status: 'inativo' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNCIONARIOS_KEY }),
  })
}

export function useSetores() {
  return useQuery<string[]>({
    queryKey: ['setores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('setor')
        .is('deleted_at', null)
        .order('setor')
      if (error) throw error
      const rows = (data ?? []) as { setor: string }[]
      return [...new Set(rows.map(d => d.setor))]
    },
  })
}
