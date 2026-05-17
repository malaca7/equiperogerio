import React, { useState } from 'react'
import { ScrollText, Search, Filter, Clock, User, Shield, LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Tab = 'audit' | 'logins' | 'security'

export function AdminAuditPage() {
  const [tab, setTab] = useState<Tab>('audit')
  const [search, setSearch] = useState('')

  const { data: auditLogs = [], isLoading: loadAudit } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('*, profiles(nome)').order('created_at', { ascending: false }).limit(200)
      return data || []
    },
    enabled: tab === 'audit',
  })

  const { data: loginLogs = [], isLoading: loadLogin } = useQuery({
    queryKey: ['login-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('login_logs').select('*').order('tentativa_em', { ascending: false }).limit(200)
      return data || []
    },
    enabled: tab === 'logins',
  })

  const { data: secEvents = [], isLoading: loadSec } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const { data } = await supabase.from('security_events').select('*, profiles(nome)').order('created_at', { ascending: false }).limit(200)
      return data || []
    },
    enabled: tab === 'security',
  })

  const tabs = [
    { id: 'audit' as Tab, icon: ScrollText, label: 'Ações', count: auditLogs.length },
    { id: 'logins' as Tab, icon: LogIn, label: 'Logins', count: loginLogs.length },
    { id: 'security' as Tab, icon: Shield, label: 'Segurança', count: secEvents.length },
  ]

  const isLoading = (tab === 'audit' && loadAudit) || (tab === 'logins' && loadLogin) || (tab === 'security' && loadSec)

  const sevColor: Record<string, string> = {
    info: 'text-blue-500 bg-blue-500/10', low: 'text-emerald-500 bg-emerald-500/10',
    medium: 'text-amber-500 bg-amber-500/10', high: 'text-orange-500 bg-orange-500/10',
    critical: 'text-rose-500 bg-rose-500/10',
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Tab bar */}
      <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/30 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Buscar nos logs..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none" />
      </div>

      {isLoading && <Loading text="Carregando logs..." />}

      {/* Audit Logs */}
      {tab === 'audit' && !loadAudit && (
        <div className="space-y-3">
          {auditLogs.filter(l => !search || l.descricao?.toLowerCase().includes(search.toLowerCase()) || l.modulo.includes(search.toLowerCase())).map(log => (
            <div key={log.id} className="bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-4 flex items-start gap-4 hover:bg-card/80 transition-all">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ScrollText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-muted/50 rounded-full text-muted-foreground">{log.modulo}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary rounded-full">{log.acao}</span>
                </div>
                <p className="text-sm font-bold text-foreground truncate">{log.descricao || 'Sem descrição'}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-bold">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {(log.profiles as any)?.nome || 'Sistema'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(parseISO(log.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && <EmptyState text="Nenhum log de ação registrado" />}
        </div>
      )}

      {/* Login Logs */}
      {tab === 'logins' && !loadLogin && (
        <div className="space-y-3">
          {loginLogs.filter(l => !search || l.cpf.includes(search.replace(/\D/g, ''))).map(log => (
            <div key={log.id} className={cn("bg-card/60 backdrop-blur-xl border rounded-2xl p-4 flex items-center gap-4 transition-all",
              log.sucesso ? "border-emerald-500/20" : "border-rose-500/20"
            )}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                log.sucesso ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                <LogIn className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">CPF: {log.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-bold">
                  <span>{log.sucesso ? '✅ Sucesso' : `❌ ${log.motivo_falha}`}</span>
                  <span>{log.navegador} • {log.dispositivo}</span>
                  <span>{format(parseISO(log.tentativa_em), "dd/MM HH:mm")}</span>
                </div>
              </div>
            </div>
          ))}
          {loginLogs.length === 0 && <EmptyState text="Nenhum log de login" />}
        </div>
      )}

      {/* Security Events */}
      {tab === 'security' && !loadSec && (
        <div className="space-y-3">
          {secEvents.filter(e => !search || e.descricao?.toLowerCase().includes(search.toLowerCase())).map(ev => (
            <div key={ev.id} className="bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-4 flex items-start gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", sevColor[ev.severidade] || sevColor.info)}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-muted/50 rounded-full">{ev.tipo}</span>
                  <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full", sevColor[ev.severidade] || sevColor.info)}>{ev.severidade}</span>
                </div>
                <p className="text-sm font-bold text-foreground">{ev.descricao || 'Evento de segurança'}</p>
                <span className="text-[10px] text-muted-foreground font-bold">{format(parseISO(ev.created_at), "dd/MM HH:mm")}</span>
              </div>
            </div>
          ))}
          {secEvents.length === 0 && <EmptyState text="Nenhum evento de segurança" />}
        </div>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-20 opacity-30">
      <ScrollText className="w-16 h-16 mx-auto mb-4" />
      <p className="text-xs font-black uppercase tracking-widest">{text}</p>
    </div>
  )
}
