import { endOfMonth, format, parseISO, addDays, subDays } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { batchUpsert } from '../lib/batchUtils'
import type { Escala, EscalaInsert, EscalaUpdate } from '../lib/database.types'

export const ESCALAS_KEY = ['escalas']

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

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
  const dateObj = parseLocalDate(mes + '-01')
  const prevDay = format(subDays(dateObj, 2), 'yyyy-MM-dd')
  const nextDay = format(addDays(endOfMonth(dateObj), 2), 'yyyy-MM-dd')
  
  const d8 = format(addDays(dateObj, 8), 'yyyy-MM-dd')
  const d16 = format(addDays(dateObj, 16), 'yyyy-MM-dd')
  const d24 = format(addDays(dateObj, 24), 'yyyy-MM-dd')

  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, mes],
    queryFn: async () => {
      const [part1, part2, part3, part4] = await Promise.all([
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', prevDay)
          .lt('data', d8)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', d8)
          .lt('data', d16)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', d16)
          .lt('data', d24)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', d24)
          .lt('data', nextDay)
          .order('data')
      ])

      if (part1.error) throw part1.error
      if (part2.error) throw part2.error
      if (part3.error) throw part3.error
      if (part4.error) throw part4.error

      const combined = [
        ...(part1.data ?? []),
        ...(part2.data ?? []),
        ...(part3.data ?? []),
        ...(part4.data ?? [])
      ]

      // Remove duplicates by ID
      const unique = combined.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id)
      )
      return unique as EscalaWithFunc[]
    },
  })
}

export function useEscalasPeriodo(startDate: string, endDate: string) {
  return useQuery<EscalaWithFunc[]>({
    queryKey: [...ESCALAS_KEY, 'periodo', startDate, endDate],
    queryFn: async () => {
      // Dividir a busca em dois blocos para contornar o limite de 1000 registros do PostgREST
      const midDate = format(addDays(parseLocalDate(startDate), 15), 'yyyy-MM-dd')
      const nextDay = format(addDays(parseLocalDate(endDate), 2), 'yyyy-MM-dd')
      const prevDay = format(subDays(parseLocalDate(startDate), 2), 'yyyy-MM-dd')
      
      const [part1, part2] = await Promise.all([
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', prevDay)
          .lt('data', midDate)
          .order('data'),
        supabase
          .from('escalas')
          .select('*, funcionarios(id, nome, apelido, cargo, setor)')
          .gte('data', midDate)
          .lt('data', nextDay)
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
  const dateObj = parseLocalDate(mes + '-01')
  const startDate = format(dateObj, 'yyyy-MM-01')
  const nextDay = format(addDays(endOfMonth(dateObj), 1), 'yyyy-MM-dd')
  return useQuery<Escala[]>({
    queryKey: [...ESCALAS_KEY, 'funcionario', funcionarioId, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalas')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .gte('data', startDate)
        .lt('data', nextDay)
        .order('data')
      if (error) throw error
      return (data ?? []) as Escala[]
    },
    enabled: !!funcionarioId,
  })
}

export function useUpsertEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { item: EscalaInsert; skipFreqSync?: boolean } | EscalaInsert) => {
      const isPayloadObject = payload && 'item' in payload
      const item = isPayloadObject ? (payload as any).item : (payload as EscalaInsert)
      const skipFreqSync = isPayloadObject ? !!(payload as any).skipFreqSync : false

      const upsertPayload: any = {
        funcionario_id: item.funcionario_id,
        data: item.data,
        tipo: item.tipo,
        turno: item.turno,
        updated_at: new Date().toISOString()
      }
      if (item.localidade !== undefined) {
        upsertPayload.localidade = item.localidade
      }
      if (item.observacoes !== undefined) {
        upsertPayload.observacoes = item.observacoes
      }

      const { data, error } = await supabase
        .from('escalas')
        .upsert(upsertPayload, { onConflict: 'funcionario_id,data' })
        .select()
        .single()

      if (error) throw error
      const result = data as Escala

      // Sincronizar com tabela de frequência (apenas ausências/folgas/férias/atestados, NÃO marca presença trabalho automaticamente)
      if (result && !skipFreqSync) {
        if (result.tipo !== 'presente') {
          const freqStatusMap: Record<string, string> = {
            'hora_extra': 'hora_extra',
            'falta': 'falta',
            'compensar': 'folga',
            'repouso': 'folga',
            'ferias': 'ferias',
            'atestado': 'atestado'
          }
          const mappedStatus = freqStatusMap[result.tipo]
          if (mappedStatus) {
            await supabase.from('frequencia').upsert({
              funcionario_id: result.funcionario_id,
              data: result.data,
              status: mappedStatus as any,
              updated_at: new Date().toISOString()
            }, { onConflict: 'funcionario_id,data' })
          }
        }
      }

      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBatchUpsertEscalas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { items: EscalaInsert[]; skipFreqSync?: boolean } | EscalaInsert[]) => {
      const isArray = Array.isArray(payload)
      const items = isArray ? payload : payload.items
      const skipFreqSync = isArray ? false : !!payload.skipFreqSync

      if (items.length === 0) return []

      // Deduplicate items by composite key (funcionario_id + data) to prevent Postgres ON CONFLICT error
      const itemMap = new Map<string, any>()
      items.forEach(item => {
        const key = `${item.funcionario_id}_${item.data}`
        const p: any = {
          funcionario_id: item.funcionario_id,
          data: item.data,
          tipo: item.tipo,
          turno: item.turno,
          updated_at: new Date().toISOString()
        }
        if (item.localidade !== undefined) {
          p.localidade = item.localidade
        }
        if (item.observacoes !== undefined) {
          p.observacoes = item.observacoes
        }
        itemMap.set(key, p)
      })

      const upsertPayloads = Array.from(itemMap.values())

      const results = await batchUpsert('escalas', upsertPayloads, { onConflict: 'funcionario_id,data', chunkSize: 35 })

      // Sincronizar com tabela de frequência se não skipFreqSync (apenas para não-trabalho)
      if (results && results.length > 0 && !skipFreqSync) {
        const freqStatusMap: Record<string, string> = {
          'hora_extra': 'hora_extra',
          'falta': 'falta',
          'compensar': 'folga',
          'repouso': 'folga',
          'ferias': 'ferias',
          'atestado': 'atestado'
        }

        const freqMap = new Map<string, any>()
        results.forEach(result => {
          if (result.tipo !== 'presente') {
            const key = `${result.funcionario_id}_${result.data}`
            const mappedStatus = freqStatusMap[result.tipo]
            if (mappedStatus) {
              freqMap.set(key, {
                funcionario_id: result.funcionario_id,
                data: result.data,
                status: mappedStatus as any,
                updated_at: new Date().toISOString()
              })
            }
          }
        })
        const freqUpserts = Array.from(freqMap.values())

        if (freqUpserts.length > 0) {
          await batchUpsert('frequencia', freqUpserts, { onConflict: 'funcionario_id,data', chunkSize: 35 })
        }
      }

      return results as Escala[]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, skipFreqSync }: { id: string; data: EscalaUpdate; skipFreqSync?: boolean }) => {
      const { data: result, error } = await supabase
        .from('escalas')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!result) {
        throw new Error('Sem permissão ou RLS bloqueando a atualização no banco de dados!')
      }

      // Sincronizar com tabela de frequência APENAS se o tipo foi alterado na mutation e skipFreqSync for falso
      if (!skipFreqSync && data.tipo !== undefined && result.tipo) {
        if (result.tipo !== 'presente' && result.tipo !== 'trabalho') {
          const freqStatusMap: Record<string, string> = {
            'hora_extra': 'hora_extra',
            'falta': 'falta',
            'compensar': 'folga',
            'repouso': 'folga',
            'ferias': 'ferias',
            'atestado': 'atestado'
          }
          const mappedStatus = freqStatusMap[result.tipo]
          if (mappedStatus) {
            await supabase.from('frequencia').upsert({
              funcionario_id: result.funcionario_id,
              data: result.data,
              status: mappedStatus as any,
              updated_at: new Date().toISOString()
            }, { onConflict: 'funcionario_id,data' })
          }
        } else {
          // Quando altera tipo para 'presente' ou 'trabalho', remove a frequência para que a chamada fique PENDENTE (a marcar)
          await supabase.from('frequencia').delete().eq('funcionario_id', result.funcionario_id).eq('data', result.data)
        }
      }

      return result as Escala
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteEscala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: escala } = await supabase.from('escalas').select('*').eq('id', id).maybeSingle()
      
      const { error } = await supabase
        .from('escalas')
        .delete()
        .eq('id', id)
      if (error) throw error

      if (escala) {
        await supabase.from('frequencia').delete().eq('funcionario_id', escala.funcionario_id).eq('data', escala.data)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ESCALAS_KEY })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
