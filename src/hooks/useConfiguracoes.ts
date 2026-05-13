import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const CONFIG_KEY = ['configuracoes']

export function useConfiguracao<T = any>(chave: string, fallback: T) {
  return useQuery<T>({
    queryKey: [...CONFIG_KEY, chave],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', chave)
        .single()
      if (error) {
        // Se tabela não existe ou chave não encontrada, retorna fallback
        console.warn(`Config "${chave}" not found, using fallback`)
        return fallback
      }
      return (data?.valor ?? fallback) as T
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateConfiguracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: any }) => {
      const { error } = await supabase
        .from('configuracoes')
        .upsert(
          { chave, valor, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [...CONFIG_KEY, variables.chave] })
    },
  })
}
