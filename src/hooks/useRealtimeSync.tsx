import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Comprehensive list of all database tables for real-time synchronization
const TABLES = [
  'frequencia',
  'escalas',
  'funcionarios',
  'equipes',
  'equipe_encarregados',
  'equipe_membros',
  'profiles',
  'user_roles',
  'configuracoes',
  'notificacoes',
  'localidades',
  'demandas',
  'atestados',
  'observacoes',
  'modelos_escala',
  'modelos_escala_funcionarios',
  'estoque_saldos',
  'estoque_movimentacoes',
  'estoque_produtos',
  'estoque_cautelas',
  'estoque_solicitacoes',
  'frota_veiculos',
  'frota_registros',
  'frota_rotas',
  'frota_abastecimentos',
  'frota_manutencoes',
  'rendimentos'
]

export default function useRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return

    // Centralized invalidation mapper to trigger instant UI re-renders for affected queries
    const invalidateByTable = (table: string) => {
      switch (table) {
        case 'frequencia':
          qc.invalidateQueries({ queryKey: ['frequencia'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['dashboard-producao'] })
          break
        case 'escalas':
          qc.invalidateQueries({ queryKey: ['escalas'] })
          qc.invalidateQueries({ queryKey: ['escala-mensal'] })
          qc.invalidateQueries({ queryKey: ['escalas-periodo'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['dashboard-producao'] })
          break
        case 'funcionarios':
          qc.invalidateQueries({ queryKey: ['funcionarios'] })
          qc.invalidateQueries({ queryKey: ['admin-users'] })
          qc.invalidateQueries({ queryKey: ['func-ativos'] })
          break
        case 'equipes':
        case 'equipe_encarregados':
        case 'equipe_membros':
          qc.invalidateQueries({ queryKey: ['equipes'] })
          qc.invalidateQueries({ queryKey: ['all-teams-header'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          qc.invalidateQueries({ queryKey: ['func-ativos'] })
          qc.invalidateQueries({ queryKey: ['funcionarios'] })
          break
        case 'profiles':
        case 'user_roles':
          qc.invalidateQueries({ queryKey: ['admin-users'] })
          qc.invalidateQueries({ queryKey: ['profiles-list'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          qc.invalidateQueries({ queryKey: ['roles'] })
          break
        case 'configuracoes':
          qc.invalidateQueries({ queryKey: ['configuracoes'] })
          qc.invalidateQueries({ queryKey: ['menu_config'] })
          break
        case 'notificacoes':
          qc.invalidateQueries({ queryKey: ['notificacoes'] })
          break
        case 'localidades':
        case 'demandas':
          qc.invalidateQueries({ queryKey: ['localidades'] })
          qc.invalidateQueries({ queryKey: ['demandas'] })
          qc.invalidateQueries({ queryKey: ['escalas'] })
          break
        case 'atestados':
          qc.invalidateQueries({ queryKey: ['atestados'] })
          qc.invalidateQueries({ queryKey: ['frequencia'] })
          break
        case 'observacoes':
          qc.invalidateQueries({ queryKey: ['observacoes'] })
          break
        case 'modelos_escala':
        case 'modelos_escala_funcionarios':
          qc.invalidateQueries({ queryKey: ['modelos_escala'] })
          qc.invalidateQueries({ queryKey: ['modelos-escala'] })
          break
        case 'estoque_saldos':
        case 'estoque_movimentacoes':
        case 'estoque_produtos':
        case 'estoque_cautelas':
        case 'estoque_solicitacoes':
          qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
          qc.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
          qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
          qc.invalidateQueries({ queryKey: ['estoque-cautelas'] })
          qc.invalidateQueries({ queryKey: ['estoque-solicitacoes'] })
          break
        case 'frota_veiculos':
        case 'frota_registros':
        case 'frota_rotas':
        case 'frota_abastecimentos':
        case 'frota_manutencoes':
          qc.invalidateQueries({ queryKey: ['frota-veiculos'] })
          qc.invalidateQueries({ queryKey: ['frota-registros'] })
          qc.invalidateQueries({ queryKey: ['frota-rotas'] })
          qc.invalidateQueries({ queryKey: ['frota-abastecimentos'] })
          qc.invalidateQueries({ queryKey: ['frota-manutencoes'] })
          break
        case 'rendimentos':
          qc.invalidateQueries({ queryKey: ['rendimentos'] })
          break
        default:
          break
      }

      // Invalidate predicate fallback for any component referencing table name in query key
      qc.invalidateQueries({ 
        predicate: (query) => JSON.stringify(query.queryKey).toLowerCase().includes(table.toLowerCase()) 
      })
    }

    const channels: any[] = []

    try {
      // Listen to universal database changes across schema 'public'
      const globalChan = (supabase as any).channel('realtime_global_sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
          if (payload && payload.table) {
            invalidateByTable(payload.table)
          } else {
            qc.invalidateQueries()
          }
        })
        .on('broadcast', { event: 'sync' }, () => {
          qc.invalidateQueries()
        })
        .subscribe((status: string) => {
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            // Auto re-subscribe on connection drops
            setTimeout(() => {
              try { globalChan.subscribe() } catch {}
            }, 3000)
          }
        })

      channels.push(globalChan)

      // Listen to individual table channels as fallback
      TABLES.forEach(table => {
        const chan = (supabase as any).channel(`realtime_table_${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
            invalidateByTable(table)
          })
          .subscribe()
        channels.push(chan)
      })
    } catch (e) {
      console.warn('Realtime subscription fallback activated:', e)
    }

    // Auto-refresh queries when tab gains focus or device reconnects to network
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries()
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)
    window.addEventListener('online', handleVisibilityOrFocus)

    // Safety polling interval every 12s to guarantee zero missed updates on laggy networks
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({
          predicate: (query) => {
            const keyStr = JSON.stringify(query.queryKey)
            return keyStr.includes('escalas') || keyStr.includes('frequencia') || keyStr.includes('user-team')
          }
        })
      }
    }, 12000)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      window.removeEventListener('online', handleVisibilityOrFocus)

      channels.forEach(c => {
        if (!c) return
        try {
          if (c.unsubscribe) c.unsubscribe()
          if (c.remove) c.remove()
        } catch {}
      })
    }
  }, [qc])
}
