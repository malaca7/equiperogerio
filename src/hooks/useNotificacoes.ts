import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Notificacao } from '../lib/database.types'

export const NOTIFICACOES_KEY = ['notificacoes']

export function useNotificacoes() {
  return useQuery<Notificacao[]>({
    queryKey: NOTIFICACOES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Notificacao[]
    },
    refetchInterval: 60000,
  })
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: [...NOTIFICACOES_KEY, 'unread'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('visualizada', false)
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 30000,
  })
}

export function useMarcarVisualizada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ visualizada: true } as Partial<Notificacao>)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICACOES_KEY }),
  })
}

export function useMarcarTodasVisualizadas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ visualizada: true } as Partial<Notificacao>)
        .eq('visualizada', false)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICACOES_KEY }),
  })
}

export function useDeleteNotificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICACOES_KEY }),
  })
}
