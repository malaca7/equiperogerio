import React from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Bell } from 'lucide-react'

export function FrotaNotificacoesPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Notificações" subtitle="Alertas de manutenções e vencimentos" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32">
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center shadow-sm">
          <Bell className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Página em Construção</h2>
          <p className="text-muted-foreground font-bold">O módulo de notificações estará disponível em breve.</p>
        </div>
      </div>
    </div>
  )
}
