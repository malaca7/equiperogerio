import React from 'react'
import { Bell, BellOff, AlertTriangle, FileText, Calendar, Info, Trash2, CheckCheck, ChevronRight, Clock } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TopHeader } from '../components/layout/TopHeader'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import {
  useNotificacoes,
  useMarcarVisualizada,
  useMarcarTodasVisualizadas,
  useDeleteNotificacao,
} from '../hooks/useNotificacoes'
import type { Notificacao } from '../lib/database.types'
import { cn } from '../lib/utils'

const tipoConfig = {
  falta: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  escala: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  atestado: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  info: { icon: Info, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  alerta: { icon: Bell, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

function NotifItem({ notif }: { notif: Notificacao }) {
  const { toast } = useToast()
  const markRead = useMarcarVisualizada()
  const deleteNotif = useDeleteNotificacao()
  const config = tipoConfig[notif.tipo]
  const Icon = config.icon

  const handleRead = async () => {
    if (!notif.visualizada) {
      await markRead.mutateAsync(notif.id)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteNotif.mutateAsync(notif.id)
    } catch {
      toast('Erro ao remover notificação', 'error')
    }
  }

  return (
    <div
      onClick={handleRead}
      className={cn(
        'group relative bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 p-6 rounded-[2.5rem] flex items-start gap-5 cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all duration-500',
        !notif.visualizada && 'border-primary/30 bg-primary/5 dark:bg-primary/5'
      )}
    >
      {!notif.visualizada && (
        <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)] animate-pulse" />
      )}

      {/* Icon Pill */}
      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border transition-transform duration-500 group-hover:scale-110', config.bg, config.border)}>
        <Icon className={cn('w-7 h-7', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-1">
          <h4 className={cn(
            'text-lg font-black tracking-tight leading-tight transition-colors',
            notif.visualizada ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {notif.titulo}
          </h4>
          <p className="text-sm text-muted-foreground/80 leading-relaxed font-bold mt-1">
            {notif.descricao}
          </p>
        </div>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-border/50">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
              {formatDistanceToNow(parseISO(notif.created_at), { locale: ptBR, addSuffix: true })}
            </span>
          </div>
          {notif.visualizada && (
             <span className="text-[10px] font-black text-primary/50 uppercase tracking-[0.2em]">Lida</span>
          )}
        </div>
      </div>

      {/* Action Area */}
      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <button
          onClick={handleDelete}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export function NotificacoesPage() {
  const { toast } = useToast()
  const { data: notificacoes = [], isLoading } = useNotificacoes()
  const markAll = useMarcarTodasVisualizadas()

  const unread = notificacoes.filter(n => !n.visualizada)

  const handleMarkAll = async () => {
    try {
      await markAll.mutateAsync()
      toast('Todas as notificações foram lidas!', 'success')
    } catch {
      toast('Erro ao processar solicitações', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader
        title="Centro de Alertas"
        subtitle={unread.length > 0 ? `${unread.length} novas atualizações` : 'Sistema em dia'}
        actions={
          unread.length > 0 ? (
            <button
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              className="px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar como lidas
            </button>
          ) : undefined
        }
      />

      <div className="max-w-[900px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">
        {isLoading ? (
          <div className="py-32"><Loading text="Sincronizando notificações..." /></div>
        ) : notificacoes.length === 0 ? (
          <div className="flex flex-col items-center py-32 gap-8 animate-fade-in">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-[3rem] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="w-28 h-28 bg-card border border-border/50 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 transition-transform group-hover:rotate-12">
                <BellOff className="w-12 h-12 text-muted-foreground/30" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-foreground tracking-tight">Caixa de Entrada Vazia</h3>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mt-4 opacity-50">
                Você não possui novas notificações operacionais.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {unread.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-4">
                  <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.6)]" />
                  <h3 className="text-[10px] font-black uppercase text-foreground tracking-[0.3em]">Recentes</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {unread.map(n => <NotifItem key={n.id} notif={n} />)}
                </div>
              </div>
            )}

            {notificacoes.filter(n => n.visualizada).length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-4">
                  <div className="w-1.5 h-6 bg-muted-foreground/30 rounded-full" />
                  <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Anteriores</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {notificacoes
                    .filter(n => n.visualizada)
                    .map(n => <NotifItem key={n.id} notif={n} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
