import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, Search, Clock, Package, MapPin } from 'lucide-react'
import { useEstoqueAlertas, useResolveEstoqueAlerta } from '../../hooks/useEstoque'
import { useAuth } from '../../contexts/AuthContext'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { format } from 'date-fns'
import { cn } from '../../lib/utils'

const SEV_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  critical: { label: 'CRÍTICO', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  warning: { label: 'ATENÇÃO', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  info: { label: 'INFO', icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
}

export function EstoqueAlertasPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: alertas = [], isLoading } = useEstoqueAlertas()
  const resolveMut = useResolveEstoqueAlerta()

  const [filterSev, setFilterSev] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    return alertas.filter(a => {
      const matchSev = filterSev === 'all' || a.severidade === filterSev
      const matchSearch = !searchTerm ||
        a.mensagem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.produto?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchSev && matchSearch
    })
  }, [alertas, filterSev, searchTerm])

  const handleResolve = async (id: string) => {
    if (!user) return
    try {
      await resolveMut.mutateAsync({ id, userId: user.profile.id })
      toast('Alerta resolvido!', 'success')
    } catch (e: any) {
      toast(e.message || 'Erro', 'error')
    }
  }

  const criticalCount = alertas.filter(a => a.severidade === 'critical').length
  const warningCount = alertas.filter(a => a.severidade === 'warning').length
  const infoCount = alertas.filter(a => a.severidade === 'info').length

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Alertas" />
      <div className="pt-28 sm:pt-32 pb-20"><Loading text="Carregando alertas..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Central de Alertas" subtitle="Monitoramento Inteligente de Estoque" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {[
            { key: 'critical', count: criticalCount, ...SEV_CONFIG.critical },
            { key: 'warning', count: warningCount, ...SEV_CONFIG.warning },
            { key: 'info', count: infoCount, ...SEV_CONFIG.info },
          ].map(s => {
            const Icon = s.icon
            return (
              <button key={s.key} onClick={() => setFilterSev(filterSev === s.key ? 'all' : s.key)}
                className={cn("bg-card/80 border rounded-2xl p-3 sm:p-4 flex items-center gap-3 transition-all hover:shadow-md active:scale-95", filterSev === s.key ? `${s.border} ${s.bg}` : s.border)}>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.bg)}>
                  <Icon className={cn("w-4 h-4", s.color)} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground hidden sm:block">{s.label}</p>
                  <p className={cn("text-xl font-black", s.color)}>{s.count}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Filtro */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl px-4 py-2.5 mb-6 shadow-sm flex flex-wrap items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <div className="relative flex-1 min-w-[140px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input type="text" placeholder="Buscar alertas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-[11px] font-black text-foreground placeholder:text-muted-foreground/50 outline-none" style={{ fontSize: '16px' }} />
          </div>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground/50">{filtered.length} alertas</span>
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {filtered.map(a => {
            const sev = SEV_CONFIG[a.severidade] || SEV_CONFIG.info
            const Icon = sev.icon
            return (
              <div key={a.id} className={cn("bg-card/80 border rounded-2xl p-4 flex items-start gap-3 transition-all hover:shadow-md", sev.border)}>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", sev.bg)}>
                  <Icon className={cn("w-4 h-4", sev.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", sev.bg, sev.color)}>{sev.label}</span>
                    <span className="text-[9px] font-bold text-muted-foreground/50">{a.tipo.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground mb-1">{a.mensagem}</p>
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-semibold flex-wrap">
                    {a.produto && <span className="flex items-center gap-1"><Package className="w-2.5 h-2.5" /> {a.produto.nome}</span>}
                    {a.regiao && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {a.regiao.nome}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {format(new Date(a.created_at), 'dd/MM HH:mm')}</span>
                  </div>
                </div>
                <button onClick={() => handleResolve(a.id)} disabled={resolveMut.isPending}
                  className="shrink-0 p-2.5 sm:px-3 sm:py-1.5 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all active:scale-95">
                  <CheckCircle2 className="w-4 h-4 sm:w-3 sm:h-3 sm:inline sm:mr-1" />
                  <span className="hidden sm:inline">Resolver</span>
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-card/80 border border-border/50 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground">Sem alertas ativos</p>
              <p className="text-xs text-muted-foreground/60">Todos os indicadores estão dentro da normalidade</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
