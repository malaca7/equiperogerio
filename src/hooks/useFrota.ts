import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Veiculo, RegistroDiario, Abastecimento, Manutencao } from '../types/frota'

// VEÍCULOS
export const useVeiculos = (userId?: string, isAdmin?: boolean) => {
  return useQuery<Veiculo[]>({
    queryKey: ['frota_veiculos', userId, isAdmin],
    queryFn: async () => {
      // If admin/manager or no userId passed, fetch all
      if (isAdmin || !userId) {
        const { data, error } = await supabase.from('frota_veiculos').select('*').order('placa')
        if (error) throw error
        return data || []
      }
      
      // If regular employee, only fetch authorized vehicles
      const { data, error } = await supabase
        .from('frota_veiculos_autorizados')
        .select('frota_veiculos(*)')
        .eq('usuario_id', userId)
      
      if (error) throw error
      
      return (data || [])
        .map((d: any) => d.frota_veiculos)
        .filter(Boolean)
        .sort((a: any, b: any) => a.placa.localeCompare(b.placa))
    }
  })
}

export const useUpsertVeiculo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (veiculo: Partial<Veiculo>) => {
      if (veiculo.id) {
        const { error } = await supabase.from('frota_veiculos').update({ ...veiculo, updated_at: new Date().toISOString() }).eq('id', veiculo.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('frota_veiculos').insert(veiculo)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
  })
}

export const useDeleteVeiculo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('frota_veiculos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
  })
}

// AUTORIZAÇÕES DE VEÍCULOS
export const useVeiculoAutorizacoes = (veiculoId: string) => {
  return useQuery<string[]>({
    queryKey: ['frota_veiculo_autorizacoes', veiculoId],
    queryFn: async () => {
      if (!veiculoId) return []
      const { data, error } = await supabase.from('frota_veiculos_autorizados').select('usuario_id').eq('veiculo_id', veiculoId)
      if (error) throw error
      return (data || []).map(d => d.usuario_id)
    },
    enabled: !!veiculoId
  })
}

export const useToggleVeiculoAutorizacao = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ veiculoId, usuarioId, authorized }: { veiculoId: string; usuarioId: string; authorized: boolean }) => {
      if (authorized) {
        const { error } = await supabase.from('frota_veiculos_autorizados').insert({ veiculo_id: veiculoId, usuario_id: usuarioId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('frota_veiculos_autorizados').delete().eq('veiculo_id', veiculoId).eq('usuario_id', usuarioId)
        if (error) throw error
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['frota_veiculo_autorizacoes', variables.veiculoId] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

// REGISTROS DIÁRIOS
export const useRegistrosDiarios = (veiculoId?: string) => {
  return useQuery<RegistroDiario[]>({
    queryKey: ['frota_registros', veiculoId],
    queryFn: async () => {
      let q = supabase.from('frota_registros_diarios').select('*').order('data', { ascending: false }).limit(100)
      if (veiculoId) q = q.eq('veiculo_id', veiculoId)
      const { data, error } = await q
      if (error) throw error
      return data || []
    }
  })
}

export const useActiveTrip = (userId?: string) => {
  return useQuery<RegistroDiario | null>({
    queryKey: ['frota_active_trip', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('frota_registros_diarios')
        .select('*')
        .eq('usuario_id', userId)
        .is('km_final', null)
        .order('data', { ascending: false })
        .limit(1)
      
      if (error) throw error
      return data && data.length > 0 ? data[0] : null
    },
    enabled: !!userId
  })
}

export const useDeleteRegistroDiario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('frota_registros_diarios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_registros'] })
      qc.invalidateQueries({ queryKey: ['frota_active_trip'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

export const useUpsertRegistroDiario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (registro: Partial<RegistroDiario>) => {
      if (registro.id) {
        const { error } = await supabase.from('frota_registros_diarios').update({ ...registro, updated_at: new Date().toISOString() }).eq('id', registro.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('frota_registros_diarios').insert(registro)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_registros'] })
      qc.invalidateQueries({ queryKey: ['frota_active_trip'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] }) // Update KM
    }
  })
}

// ABASTECIMENTOS
export const useAbastecimentos = (veiculoId?: string) => {
  return useQuery<Abastecimento[]>({
    queryKey: ['frota_abastecimentos', veiculoId],
    queryFn: async () => {
      let q = supabase.from('frota_abastecimentos').select('*').order('data', { ascending: false }).limit(100)
      if (veiculoId) q = q.eq('veiculo_id', veiculoId)
      const { data, error } = await q
      if (error) throw error
      return data || []
    }
  })
}

export const useAddAbastecimento = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (abast: Partial<Abastecimento>) => {
      const { error } = await supabase.from('frota_abastecimentos').insert(abast)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_abastecimentos'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

// MANUTENÇÕES
export const useManutencoes = (veiculoId?: string) => {
  return useQuery<Manutencao[]>({
    queryKey: ['frota_manutencoes', veiculoId],
    queryFn: async () => {
      let q = supabase.from('frota_manutencoes').select('*').order('data', { ascending: false }).limit(100)
      if (veiculoId) q = q.eq('veiculo_id', veiculoId)
      const { data, error } = await q
      if (error) throw error
      return data || []
    }
  })
}

export const useAddManutencao = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (manu: Partial<Manutencao>) => {
      const { error } = await supabase.from('frota_manutencoes').insert(manu)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_manutencoes'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

export const useUpdateAbastecimento = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (abast: Partial<Abastecimento> & { id: string }) => {
      const { id, ...data } = abast
      const { error } = await supabase.from('frota_abastecimentos').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_abastecimentos'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

export const useDeleteAbastecimento = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('frota_abastecimentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_abastecimentos'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

export const useUpdateManutencao = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (manu: Partial<Manutencao> & { id: string }) => {
      const { id, ...data } = manu
      const { error } = await supabase.from('frota_manutencoes').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_manutencoes'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}

export const useDeleteManutencao = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('frota_manutencoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frota_manutencoes'] })
      qc.invalidateQueries({ queryKey: ['frota_veiculos'] })
    }
  })
}
