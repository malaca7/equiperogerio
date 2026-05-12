import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Frequencia, FrequenciaInsert, FrequenciaUpdate } from '../lib/database.types'
import { today } from '../lib/utils'

export const FREQUENCIA_KEY = ['frequencia']

type FrequenciaWithFunc = Frequencia & {
  funcionarios: {
    id: string
    nome: string
    cargo: string
    setor: string
    matricula: string
  } | null
}

export function useFrequenciaData(data?: string) {
  const date = data || today()
  return useQuery<FrequenciaWithFunc[]>({
    queryKey: [...FREQUENCIA_KEY, date],
    queryFn: async () => {
      const { data: result, error } = await supabase
        .from('frequencia')
        .select('*, funcionarios(id, nome, cargo, setor, matricula)')
        .eq('data', date)
      if (error) throw error
      return (result ?? []) as FrequenciaWithFunc[]
    },
  })
}

export function useFrequenciaFuncionario(funcionarioId: string, limit = 30) {
  return useQuery<Frequencia[]>({
    queryKey: [...FREQUENCIA_KEY, 'funcionario', funcionarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frequencia')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .order('data', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Frequencia[]
    },
    enabled: !!funcionarioId,
  })
}

export function useFrequenciaMensal(mes: string) {
  const startDate = `${mes}-01`
  const endDate = `${mes}-31`
  return useQuery<FrequenciaWithFunc[]>({
    queryKey: [...FREQUENCIA_KEY, 'mensal', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frequencia')
        .select('*, funcionarios(id, nome, cargo, setor)')
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data')
      if (error) throw error
      return (data ?? []) as FrequenciaWithFunc[]
    },
  })
}

export function useUpsertFrequencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: FrequenciaInsert) => {
      const { data: result, error } = await supabase
        .from('frequencia')
        .upsert(
          { ...data, updated_at: new Date().toISOString() },
          { onConflict: 'funcionario_id,data' }
        )
        .select()
        .single()
      if (error) throw error
      return result as Frequencia
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [...FREQUENCIA_KEY, variables.data] })
      qc.invalidateQueries({ queryKey: [...FREQUENCIA_KEY, 'funcionario', variables.funcionario_id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateFrequencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FrequenciaUpdate }) => {
      const { data: result, error } = await supabase
        .from('frequencia')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return result as Frequencia
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FREQUENCIA_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

interface DashboardStats {
  presentes: number
  faltas: number
  atestados: number
  folgas: number
  ferias: number
  horasExtras: number
  totalAtivos: number
  totalInativos: number
  totalRegistros: number
}

export function useDashboardStats(date?: string) {
  const d = date || today()
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', d],
    queryFn: async () => {
      const [freqResult, funcResult] = await Promise.all([
        supabase
          .from('frequencia')
          .select('status, hora_extra')
          .eq('data', d),
        supabase
          .from('funcionarios')
          .select('status')
          .is('deleted_at', null),
      ])

      if (freqResult.error) throw freqResult.error
      if (funcResult.error) throw funcResult.error

      const freq = (freqResult.data ?? []) as { status: string; hora_extra: number | null }[]
      const func = (funcResult.data ?? []) as { status: string }[]

      return {
        presentes: freq.filter(f => f.status === 'presente' || f.status === 'hora_extra').length,
        faltas: freq.filter(f => f.status === 'falta').length,
        atestados: freq.filter(f => f.status === 'atestado').length,
        folgas: freq.filter(f => f.status === 'folga').length,
        ferias: freq.filter(f => f.status === 'ferias').length,
        horasExtras: freq.reduce((acc, f) => acc + (f.hora_extra ?? 0), 0),
        totalAtivos: func.filter(f => f.status === 'ativo').length,
        totalInativos: func.filter(f => f.status === 'inativo').length,
        totalRegistros: freq.length,
      }
    },
    refetchInterval: 30000,
  })
}
