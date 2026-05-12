import React from 'react'
import { Bell, BellOff, AlertTriangle, FileText, Calendar, Info, Trash2, CheckCheck } from 'lucide-react'
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
  falta: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  escala: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  atestado: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  info: { icon: Info, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  alerta: { icon: Bell, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
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
        'card p-4 flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-all duration-150',
        !notif.visualizada && 'ring-1 ring-[hsl(var(--primary)/0.3)]'
      )}
    >
      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.bg)}>
        <Icon className={cn('w-5 h-5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm font-semibold leading-tight',
            notif.visualizada
              ? 'text-[hsl(var(--muted-foreground))]'
              : 'text-[hsl(var(--foreground))]'
          )}>
            {notif.titulo}
          </p>
          {!notif.visualizada && (
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] flex-shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
          {notif.descricao}
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
          {formatDistanceToNow(parseISO(notif.created_at), { locale: ptBR, addSuffix: true })}
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] active:scale-90 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
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
      toast('Todas marcadas como lidas', 'success')
    } catch {
      toast('Erro ao marcar notificações', 'error')
    }
  }

  return (
    <div className="main-content">
      <TopHeader
        title="Notificações"
        subtitle={unread.length > 0 ? `${unread.length} não lidas` : 'Tudo em dia'}
        actions={
          unread.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              loading={markAll.isPending}
              className="text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Ler todas
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 pt-3 pb-4 space-y-2">
        {isLoading ? (
          <Loading text="Carregando notificações..." />
        ) : notificacoes.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 bg-[hsl(var(--muted))] rounded-2xl flex items-center justify-center">
              <BellOff className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[hsl(var(--foreground))]">Sem notificações</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Você está em dia com tudo!
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Unread */}
            {unread.length > 0 && (
              <>
                <p className="section-title">Não lidas ({unread.length})</p>
                {unread.map(n => <NotifItem key={n.id} notif={n} />)}
              </>
            )}

            {/* Read */}
            {notificacoes.filter(n => n.visualizada).length > 0 && (
              <>
                <p className="section-title mt-4">Anteriores</p>
                {notificacoes
                  .filter(n => n.visualizada)
                  .map(n => <NotifItem key={n.id} notif={n} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
