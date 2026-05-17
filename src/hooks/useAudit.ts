import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook for recording audit logs.
 * Usage: const { logAction } = useAudit()
 */
export function useAudit() {
  const { user } = useAuth()

  const logAction = useCallback(
    async (params: {
      acao: string
      modulo: string
      descricao?: string
      dados_anteriores?: Record<string, unknown>
      dados_novos?: Record<string, unknown>
      rota?: string
    }) => {
      try {
        await supabase.from('audit_logs').insert({
          user_id: user?.profile.id || null,
          acao: params.acao,
          modulo: params.modulo,
          descricao: params.descricao || null,
          dados_anteriores: params.dados_anteriores || null,
          dados_novos: params.dados_novos || null,
          user_agent: navigator.userAgent,
          rota: params.rota || window.location.hash.replace('#', '') || null,
        })
      } catch (err) {
        console.error('Audit log error:', err)
      }
    },
    [user]
  )

  const logPageAccess = useCallback(
    async (pagina: string) => {
      if (!user) return null
      try {
        const { data } = await supabase
          .from('access_logs')
          .insert({
            user_id: user.profile.id,
            pagina,
          })
          .select('id')
          .single()
        return data?.id || null
      } catch {
        return null
      }
    },
    [user]
  )

  const logPageLeave = useCallback(
    async (accessLogId: string | null, pagina: string) => {
      if (!accessLogId) return
      try {
        const { data } = await supabase
          .from('access_logs')
          .select('horario_entrada')
          .eq('id', accessLogId)
          .single()

        if (data) {
          const entrada = new Date(data.horario_entrada).getTime()
          const agora = Date.now()
          const tempo = Math.round((agora - entrada) / 1000)

          await supabase
            .from('access_logs')
            .update({
              horario_saida: new Date().toISOString(),
              tempo_permanencia: tempo,
            })
            .eq('id', accessLogId)
        }
      } catch {
        // Silently fail
      }
    },
    []
  )

  return { logAction, logPageAccess, logPageLeave }
}
