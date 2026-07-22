import React from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { TrendingUp } from 'lucide-react'

export function FrotaRendimentoPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Rendimento" subtitle="Análise de km/litro e eficiência" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32">
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center shadow-sm">
          <TrendingUp className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Página em Construção</h2>
          <p className="text-muted-foreground font-bold">O módulo de rendimentos estará disponível em breve.</p>
        </div>
      </div>
    </div>
  )
}
