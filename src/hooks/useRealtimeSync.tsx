import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Lista de tabelas que queremos sincronizar em tempo real
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
  'estoque_saldos',
  'estoque_movimentacoes',
  'estoque_produtos',
  'estoque_cautelas',
  'estoque_solicitacoes'
]

export default function useRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return

    // Helper: invalidar queries específicas de forma direcionada
    const invalidateByTable = (table: string) => {
      switch (table) {
        case 'frequencia':
          qc.invalidateQueries({ queryKey: ['frequencia'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          break
        case 'escalas':
          qc.invalidateQueries({ queryKey: ['escalas'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          break
        case 'funcionarios':
          qc.invalidateQueries({ queryKey: ['funcionarios'] })
          qc.invalidateQueries({ queryKey: ['admin-users'] })
          qc.invalidateQueries({ queryKey: ['func-ativos'] })
          break
        case 'equipes':
          qc.invalidateQueries({ queryKey: ['equipes'] })
          qc.invalidateQueries({ queryKey: ['equipes-list-settings'] })
          break
        case 'equipe_encarregados':
          qc.invalidateQueries({ queryKey: ['equipes'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          break
        case 'equipe_membros':
          qc.invalidateQueries({ queryKey: ['equipes'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          qc.invalidateQueries({ queryKey: ['func-ativos'] })
          qc.invalidateQueries({ queryKey: ['funcionarios'] })
          break
        case 'profiles':
          qc.invalidateQueries({ queryKey: ['admin-users'] })
          qc.invalidateQueries({ queryKey: ['profiles-list'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          break
        case 'user_roles':
          qc.invalidateQueries({ queryKey: ['admin-users'] })
          qc.invalidateQueries({ queryKey: ['user-team'] })
          break
        case 'configuracoes':
          qc.invalidateQueries({ queryKey: ['configuracoes'] })
          break
        case 'notificacoes':
          qc.invalidateQueries({ queryKey: ['notificacoes'] })
          break
        case 'estoque_saldos':
          qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
          break
        case 'estoque_movimentacoes':
          qc.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
          break
        case 'estoque_produtos':
          qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
          break
        case 'estoque_cautelas':
          qc.invalidateQueries({ queryKey: ['estoque-cautelas'] })
          break
        case 'estoque_solicitacoes':
          qc.invalidateQueries({ queryKey: ['estoque-solicitacoes'] })
          break
        default:
          break
      }
      // Invalidate any query containing the table name in its key as fallback
      qc.invalidateQueries({ predicate: (query) => JSON.stringify(query.queryKey).includes(table) })
    }

    // Try using the newer Realtime API (channel + postgres_changes)
    const channels: any[] = []

    try {
      TABLES.forEach(table => {
        const chan = (supabase as any).channel(`realtime:${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
            invalidateByTable(table)
          })
          .subscribe()
        channels.push(chan)
      })
    } catch (e) {
      // Fallback to legacy `.from(...).on(...)` if channel API is not available
      TABLES.forEach(table => {
        try {
          const sub = (supabase as any).from(`${table}`).on('*', (payload: any) => {
            invalidateByTable(table)
          }).subscribe()
          channels.push(sub)
        } catch (err) {
          // ignore
        }
      })
    }

    return () => {
      // Unsubscribe all
      try {
        channels.forEach(c => {
          if (!c) return
          // channel-style
          if (c.unsubscribe) {
            try { c.unsubscribe() } catch {}
          }
          // from-style
          if (c.remove) {
            try { c.remove() } catch {}
          }
        })
      } catch (_) {}
    }
  }, [qc])
}
