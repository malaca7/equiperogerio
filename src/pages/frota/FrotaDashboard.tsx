import React, { useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useAbastecimentos } from '../../hooks/useFrota'
import { Loading } from '../../components/ui/Loading'
import { Truck, AlertTriangle, CheckCircle, Activity, Droplet, ArrowRight, MapPin, Navigation, Hammer, MessageSquare, TrendingUp, Bell } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Link } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'

export function FrotaDashboardPage() {
  const { user } = useAuth()
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(user?.profile?.id, user?.isAdmin)
  const { data: abastecimentos = [], isLoading: loadA } = useAbastecimentos()

  const { alertasOleo, mediaFrota } = useMemo(() => {
    let alertas = []
    let somaMedia = 0
    let countMedia = 0

    for (const v of veiculos) {
      if (v.status !== 'ativo') continue

      if (v.media_km_diaria > 0) {
        somaMedia += Number(v.media_km_diaria)
        countMedia++
      }

      // Alerta de Óleo: 100km ou menos para carro/moto, 500km ou menos para outros
      const kmFaltante = v.km_proxima_troca_oleo - v.km_atual
      const limiteAlerta = (v.tipo_veiculo === 'carro' || v.tipo_veiculo === 'moto') ? 100 : 500
      
      if (kmFaltante <= limiteAlerta) {
        // Estima dias restantes
        let diasRestantes = -1
        if (v.media_km_diaria > 0 && kmFaltante > 0) {
          diasRestantes = Math.floor(kmFaltante / v.media_km_diaria)
        }

        alertas.push({
          veiculo: v,
          kmFaltante,
          diasRestantes,
          isAtrasado: kmFaltante < 0
        })
      }
    }

    return { 
      alertasOleo: alertas.sort((a, b) => a.kmFaltante - b.kmFaltante),
      mediaFrota: countMedia > 0 ? (somaMedia / countMedia).toFixed(1) : '0'
    }
  }, [veiculos])

  const mediaKmL = useMemo(() => {
    let totalKm = 0;
    let totalLitros = 0;

    const abastecimentosByVeiculo: Record<string, any[]> = {};
    abastecimentos.forEach(a => {
      if (!abastecimentosByVeiculo[a.veiculo_id]) abastecimentosByVeiculo[a.veiculo_id] = [];
      abastecimentosByVeiculo[a.veiculo_id].push(a);
    });

    Object.values(abastecimentosByVeiculo).forEach(records => {
      if (records.length < 2) return;
      records.sort((a, b) => a.km_no_momento - b.km_no_momento);
      
      const dist = records[records.length - 1].km_no_momento - records[0].km_no_momento;
      // Sum liters excluding the first one, because the first fill up corresponds to previous distance
      const litros = records.slice(1).reduce((acc, r) => acc + Number(r.litros), 0);
      
      if (dist > 0 && litros > 0) {
        totalKm += dist;
        totalLitros += litros;
      }
    });

    return totalLitros > 0 ? (totalKm / totalLitros).toFixed(2) : '0.00';
  }, [abastecimentos]);

  if (loadV || loadA) return <div className="min-h-screen bg-background"><TopHeader title="Frota" /><div className="pt-28 sm:pt-32"><Loading text="Carregando frota..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Dashboard da Frota" subtitle="Controle Operacional de Veículos" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-8">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Truck className="w-6 h-6" /></div>
              <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Frota Ativa</p>
            </div>
            <h3 className="text-3xl font-black text-foreground">{veiculos.filter(v => v.status === 'ativo').length}</h3>
          </div>
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><Activity className="w-6 h-6" /></div>
              <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Média Diária</p>
            </div>
            <h3 className="text-3xl font-black text-foreground">{mediaFrota} <span className="text-sm">km/dia</span></h3>
          </div>
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
              <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Troca de Óleo</p>
            </div>
            <h3 className="text-3xl font-black text-rose-500">{alertasOleo.length} <span className="text-sm">alertas</span></h3>
          </div>
        </div>

        {/* Alertas de Óleo */}
        <div className="bg-card border border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplet className="w-6 h-6 text-amber-500 fill-amber-500/20" />
              <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Alertas de Troca de Óleo</h2>
            </div>
            <Link to="/frota/manutencoes" className="text-xs font-black uppercase text-primary hover:underline flex items-center gap-1">Ver Manutenções <ArrowRight className="w-3 h-3" /></Link>
          </div>
          
          <div className="divide-y divide-border/50">
            {alertasOleo.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-2 opacity-50" />
                <p className="font-bold text-sm">Tudo em dia! Nenhum veículo precisando de troca de óleo no momento.</p>
              </div>
            ) : (
              alertasOleo.map(alerta => {
                const v = alerta.veiculo
                const kmParaTroca = alerta.kmFaltante
                const intervaloOleo = (v.tipo_veiculo === 'carro' || v.tipo_veiculo === 'moto') ? 1000 : 10000
                const oilLifePercent = kmParaTroca > 0 ? Math.max(0, Math.min(100, (kmParaTroca / intervaloOleo) * 100)) : 0
                const isOilOverdue = alerta.isAtrasado
                
                return (
                  <div key={v.id} className={cn("p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors", isOilOverdue ? "bg-rose-500/[0.02] hover:bg-rose-500/[0.04]" : "hover:bg-muted/30")}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0", isOilOverdue ? "bg-rose-500 text-white" : "bg-amber-500 text-white")}>
                        <Droplet className="w-7 h-7" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-black text-foreground uppercase tracking-tight">{v.placa}</h4>
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider bg-muted/40 px-2.5 py-0.5 rounded-lg border border-border/30">
                            {v.marca} {v.modelo}
                          </span>
                        </div>
                        
                        {/* Progress Bar Container */}
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                            <span>Vida útil do óleo</span>
                            <span className={cn(isOilOverdue ? "text-rose-500" : "text-amber-500")}>
                              {isOilOverdue ? "VENCIDO!" : `${Math.round(oilLifePercent)}% restante`}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden border border-border/10">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isOilOverdue ? "bg-rose-500 w-full animate-pulse" : "bg-amber-500"
                              )} 
                              style={{ width: isOilOverdue ? '100%' : `${oilLifePercent}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            KM Atual: <span className="text-foreground font-black">{v.km_atual.toLocaleString('pt-BR')}</span> / Próxima Troca: <span className="text-foreground font-black">{v.km_proxima_troca_oleo.toLocaleString('pt-BR')}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-left md:text-right shrink-0">
                      {isOilOverdue ? (
                        <div>
                          <p className="text-sm font-black uppercase text-rose-500 tracking-wider">Atrasado em {Math.abs(kmParaTroca).toLocaleString('pt-BR')} km</p>
                          <p className="text-[10px] text-rose-500/80 font-black uppercase tracking-widest mt-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">Realizar troca imediata</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-black uppercase text-amber-500 tracking-wider">Faltam {kmParaTroca.toLocaleString('pt-BR')} km</p>
                          {alerta.diasRestantes !== -1 ? (
                            <p className="text-[10px] text-amber-600/80 font-black uppercase tracking-widest mt-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">Est. Troca: ~{alerta.diasRestantes} dias</p>
                          ) : (
                            <p className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-widest mt-1">Sem média diária registrada</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Dashboard de Abastecimento / Rendimento */}
        <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-150 transition-all" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner shrink-0">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Rendimento da Frota</h2>
              <p className="text-sm font-bold text-muted-foreground mt-0.5">Média global de consumo de combustível</p>
            </div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-4 rounded-[1.5rem] flex items-baseline gap-2 relative z-10 shrink-0 shadow-sm">
            <span className="text-4xl font-black text-indigo-600">{mediaKmL}</span>
            <span className="text-sm font-black uppercase tracking-wider text-indigo-600/70">km/l</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <Link to="/frota/controle" className="bg-primary hover:bg-primary/90 text-white p-6 rounded-[2rem] flex flex-col items-center justify-center text-center transition-all active:scale-95 shadow-xl shadow-primary/20">
            <Navigation className="w-8 h-8 mb-3" />
            <h3 className="font-black uppercase tracking-wider text-sm">Controle de Rotas</h3>
            <p className="text-[10px] opacity-90 mt-1 font-bold">Lançar Viagens da Equipe</p>
          </Link>
          <Link to="/frota/registros" className="bg-card hover:bg-muted p-6 rounded-[2rem] border border-border/50 flex flex-col items-center justify-center text-center transition-all active:scale-95 shadow-sm">
            <Activity className="w-8 h-8 mb-3 text-blue-500" />
            <h3 className="font-black uppercase tracking-wider text-sm text-foreground">Diário (KM)</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Histórico Geral</p>
          </Link>
          <Link to="/frota/abastecimentos" className="bg-card hover:bg-muted p-6 rounded-[2rem] border border-border/50 flex flex-col items-center justify-center text-center transition-all active:scale-95 shadow-sm">
            <MapPin className="w-8 h-8 mb-3 text-emerald-500" />
            <h3 className="font-black uppercase tracking-wider text-sm text-foreground">Abastecimento</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Combustível</p>
          </Link>
          <Link to="/frota/manutencoes" className="bg-card hover:bg-muted p-6 rounded-[2rem] border border-border/50 flex flex-col items-center justify-center text-center transition-all active:scale-95 shadow-sm">
            <Hammer className="w-8 h-8 mb-3 text-amber-500" />
            <h3 className="font-black uppercase tracking-wider text-sm text-foreground">Manutenções</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Oficina / Preventiva</p>
          </Link>
          <Link to="/frota/veiculos" className="bg-card hover:bg-muted p-6 rounded-[2rem] border border-border/50 flex flex-col items-center justify-center text-center transition-all active:scale-95 shadow-sm">
            <Truck className="w-8 h-8 mb-3 text-indigo-500" />
            <h3 className="font-black uppercase tracking-wider text-sm text-foreground">Veículos</h3>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Sua Frota</p>
          </Link>
        </div>

      </div>
    </div>
  )
}
