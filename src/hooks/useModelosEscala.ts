import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ModeloEscalaFuncionario {
  funcionario_id: string
  nome: string
  tipo: 'presente' | 'repouso' | 'compensar'
  turno: 'manha' | 'tarde' | 'noite' | 'integral' | null
  diaCompensado?: 'quinta' | 'sexta' | 'sabado' | null
  diaRepouso?: 'segunda' | 'terca' | 'quarta' | null
}

export interface ModeloEscala {
  id: string
  nome: string
  descricao: string
  funcionarios: ModeloEscalaFuncionario[]
  created_at: string
  equipe_id?: string
  personalizarFolgas?: boolean
  tipo?: 'dominical' | 'feriado'
}

const MODELOS_KEY = ['modelos_escala']

export function useModelosEscala() {
  return useQuery<ModeloEscala[]>({
    queryKey: MODELOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'modelos_escala')
        .single()
      if (error) throw error
      return (data?.valor ?? []) as ModeloEscala[]
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSalvarModelosEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (modelos: ModeloEscala[]) => {
      const { error } = await supabase
        .from('configuracoes')
        .upsert(
          { chave: 'modelos_escala', valor: modelos, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MODELOS_KEY })
    },
  })
}
