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

export function useFrequenciaPeriodo(startDate: string, endDate: string) {
  return useQuery<FrequenciaWithFunc[]>({
    queryKey: [...FREQUENCIA_KEY, 'periodo', startDate, endDate],
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
    enabled: !!startDate && !!endDate,
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

export function useBatchUpsertFrequencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: FrequenciaInsert[]) => {
      const { data: result, error } = await supabase
        .from('frequencia')
        .upsert(
          data.map(d => ({ ...d, updated_at: new Date().toISOString() })),
          { onConflict: 'funcionario_id,data' }
        )
        .select()
      if (error) throw error
      return result as Frequencia[]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FREQUENCIA_KEY })
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
  pendentes: number
  foraEscala: number
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
      // 1. Fetch Config Sectors
      const configResult = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'setores')
        .single()
      
      const activeSectors = (configResult.data?.valor || []) as string[]

      const [escalaResult, freqResult, funcResult] = await Promise.all([
        supabase
          .from('escalas')
          .select('tipo, funcionario_id')
          .eq('data', d),
        supabase
          .from('frequencia')
          .select('status, funcionario_id')
          .eq('data', d),
        supabase
          .from('funcionarios')
          .select('id, status, setor')
          .is('deleted_at', null),
      ])

      if (escalaResult.error) throw escalaResult.error
      if (freqResult.error) throw freqResult.error
      if (funcResult.error) throw funcResult.error

      const escalas = (escalaResult.data ?? [])
      const frequencias = (freqResult.data ?? [])
      
      // Filter ONLY employees in active sectors
      const ativos = (funcResult.data ?? [])
        .filter(f => f.status === 'ativo' && (activeSectors.length === 0 || activeSectors.includes(f.setor)))
      
      // Map frequency and scales for quick access
      const freqMap = new Map(frequencias.map(f => [f.funcionario_id, f.status]))
      const escalaMap = new Map(escalas.map(e => [e.funcionario_id, e.tipo]))

      let presentes = 0
      let faltas = 0
      let atestados = 0
      let folgas = 0
      let ferias = 0
      let pendentes = 0
      let foraEscala = 0
      let horasExtrasCount = 0

      ativos.forEach(func => {
        const freqStatus = freqMap.get(func.id)
        const escalaTipo = escalaMap.get(func.id)

        // Reality takes priority (Frequency record)
        if (freqStatus) {
          if (freqStatus === 'presente' || freqStatus === 'hora_extra') {
            presentes++
            if (freqStatus === 'hora_extra') horasExtrasCount++
          }
          else if (freqStatus === 'falta') faltas++
          else if (freqStatus === 'atestado') atestados++
          else if (freqStatus === 'folga') folgas++
          else if (freqStatus === 'ferias') ferias++
        } 
        // Fallback to Plan (Escala record)
        else if (escalaTipo) {
          if (escalaTipo === 'presente' || escalaTipo === 'hora_extra') {
            pendentes++ 
            if (escalaTipo === 'hora_extra') horasExtrasCount++
          } else if (escalaTipo === 'atestado') {
            atestados++
          } else if (escalaTipo === 'ferias') {
            ferias++
          } else if (escalaTipo === 'repouso' || escalaTipo === 'compensar') {
            folgas++
          } else if (escalaTipo === 'falta') {
            faltas++
          }
        }
        // Active but not in today's plan
        else {
          foraEscala++
        }
      })

      return {
        presentes,
        faltas,
        atestados,
        folgas,
        ferias,
        pendentes,
        foraEscala,
        horasExtras: horasExtrasCount,
        totalAtivos: ativos.length,
        totalInativos: (funcResult.data ?? []).filter(f => f.status === 'inativo').length,
        totalRegistros: ativos.length,
      }
    },
    refetchInterval: 30000,
  })
}
