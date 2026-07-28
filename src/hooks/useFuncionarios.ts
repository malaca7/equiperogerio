import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Funcionario, FuncionarioInsert, FuncionarioUpdate } from '../lib/database.types'
import { useAudit } from './useAudit'

export const FUNCIONARIOS_KEY = ['funcionarios']

export function useFuncionarios(filters?: { setor?: string; status?: string; search?: string }) {
  const qc = useQueryClient()
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
        const s = filters.search.trim()
        query = query.or(`nome.ilike.%${s}%,apelido.ilike.%${s}%,matricula.ilike.%${s}%,cpf.ilike.%${s}%,cargo.ilike.%${s}%,setor.ilike.%${s}%`)
      }

      const { data, error } = await query
      if (error) throw error
      const list = (data ?? []) as Funcionario[]

      return list
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
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (data: FuncionarioInsert) => {
      const { data: result, error } = await supabase
        .from('funcionarios')
        .insert(data)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'criar',
        modulo: 'funcionarios',
        descricao: `Colaborador "${data.nome}" (Matrícula: ${data.matricula || 'N/D'}) cadastrado no setor "${data.setor}"`,
        dados_novos: data as any,
      })

      return result as Funcionario
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNCIONARIOS_KEY }),
  })
}

export function useUpdateFuncionario() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FuncionarioUpdate }) => {
      const { data: oldData } = await supabase.from('funcionarios').select('*').eq('id', id).single()

      const { data: result, error } = await supabase
        .from('funcionarios')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'editar',
        modulo: 'funcionarios',
        descricao: `Colaborador "${result.nome}" atualizado`,
        dados_anteriores: oldData as any,
        dados_novos: data as any,
      })

      return result as Funcionario
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNCIONARIOS_KEY }),
  })
}

export function useDeleteFuncionario() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: oldData } = await supabase.from('funcionarios').select('*').eq('id', id).single()

      const { error } = await supabase
        .from('funcionarios')
        .update({ deleted_at: new Date().toISOString(), status: 'inativo' })
        .eq('id', id)
      if (error) throw error

      await logAction({
        acao: 'excluir',
        modulo: 'funcionarios',
        descricao: `Colaborador "${oldData?.nome || id}" desativado (inativado/demitido)`,
        dados_anteriores: oldData as any,
      })
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
