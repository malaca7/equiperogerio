import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Package, MapPin, Globe, Search, ArrowRight, LayoutGrid, Download, TrendingUp, BarChart3, Database } from 'lucide-react'
import { useEstoqueSaldos } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'

type Tab = 'itens' | 'locais' | 'regioes'

export function EstoqueSaldosPage() {
  const { data: saldos = [], isLoading } = useEstoqueSaldos()
  const [activeTab, setActiveTab] = useState<Tab>('itens')
  const [searchTerm, setSearchTerm] = useState('')

  // 1. Saldo por Itens (Global)
  const saldoPorItem = useMemo(() => {
    const map = new Map<string, { nome: string; codigo: string; un: string; qty: number }>()
    saldos.forEach(s => {
      const p = s.produto
      if (!p) return
      const key = p.id
      const existing = map.get(key) || { nome: p.nome, codigo: p.codigo_interno || '-', un: p.unidade_medida, qty: 0 }
      existing.qty += s.quantidade
      map.set(key, existing)
    })
    return Array.from(map.values())
      .filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || i.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.qty - a.qty)
  }, [saldos, searchTerm])

  // 2. Saldo por Locais
  const saldoPorLocal = useMemo(() => {
    const map = new Map<string, { nome: string; regiao: string; items: { nome: string; qty: number; un: string }[], totalQty: number }>()
    saldos.forEach(s => {
      const l = s.local
      const p = s.produto
      if (!l || !p || s.quantidade <= 0) return
      const key = l.id
      const existing: { nome: string; regiao: string; items: { nome: string; qty: number; un: string }[], totalQty: number } = map.get(key) || { nome: l.nome, regiao: (l as any).regiao?.nome || 'Sem Região', items: [], totalQty: 0 }
      existing.items.push({ nome: p.nome, qty: s.quantidade, un: p.unidade_medida })
      existing.totalQty += s.quantidade
      map.set(key, existing)
    })
    return Array.from(map.values())
      .filter(l => l.nome.toLowerCase().includes(searchTerm.toLowerCase()) || l.regiao.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [saldos, searchTerm])

  // 3. Saldo por Regiões
  const saldoPorRegiao = useMemo(() => {
    const map = new Map<string, { nome: string; locaisCount: Set<string>; itemsCount: number; totalQty: number }>()
    saldos.forEach(s => {
      const r = (s.local as any)?.regiao
      const p = s.produto
      if (!p || s.quantidade <= 0) return
      const key = r?.id || 'sem-regiao'
      const nome = r?.nome || 'Sem Região Vinculada'
      const existing = map.get(key) || { nome, locaisCount: new Set<string>(), itemsCount: 0, totalQty: 0 }
      if (s.local) existing.locaisCount.add(s.local.id)
      existing.itemsCount += 1
      existing.totalQty += s.quantidade
      map.set(key, existing)
    })
    return Array.from(map.values())
      .filter(r => r.nome.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.totalQty - a.totalQty)
  }, [saldos, searchTerm])

  // Global KPIs
  const globalTotalItems = saldoPorItem.length
  const globalTotalVolume = saldoPorItem.reduce((acc, curr) => acc + curr.qty, 0)
  const globalActiveLocations = saldoPorLocal.length

  if (isLoading) return <div className="min-h-screen bg-background"><TopHeader title="Saldos" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Posição de Estoque Corporativo" 
        subtitle="Visão Consolidada de Saldos Operacionais"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-8">
        
        {/* KPI Header Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1">Volume Global</p>
              <h3 className="text-3xl font-black text-foreground">{globalTotalVolume.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1">Itens Únicos (SKU)</p>
              <h3 className="text-3xl font-black text-foreground">{globalTotalItems.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 shadow-inner">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1">Locais com Estoque</p>
              <h3 className="text-3xl font-black text-foreground">{globalActiveLocations.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        </div>
        
        {/* Filtro e Navegação - Corporate Style */}
        <div className="bg-card border border-border/50 rounded-[2.5rem] p-3 shadow-md flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center backdrop-blur-md overflow-hidden">
          
          <div className="flex overflow-x-auto space-x-1 bg-muted/30 p-1.5 rounded-2xl shrink-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <button 
              onClick={() => setActiveTab('itens')}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5", 
                activeTab === 'itens' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Resumo por Produto
            </button>
            <button 
              onClick={() => setActiveTab('locais')}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5", 
                activeTab === 'locais' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <MapPin className="w-3.5 h-3.5" /> Posição por Local
            </button>
            <button 
              onClick={() => setActiveTab('regioes')}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5", 
                activeTab === 'regioes' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Globe className="w-3.5 h-3.5" /> Posição por Região
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 xl:w-auto px-1">
            <div className="relative flex-1 sm:min-w-[280px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input 
                type="text" 
                placeholder="Buscar no relatório..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-xs font-bold outline-none transition-all text-foreground"
              />
            </div>
            <button className="h-11 px-5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-primary/95 transition-all shadow-lg shadow-primary/20 shrink-0 cursor-pointer">
              <Download className="w-4 h-4" /> Exportar
            </button>
          </div>
        </div>

        {/* VIEW 1: ITENS */}
        {activeTab === 'itens' && (
          <div className="space-y-4">
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border/30 bg-muted/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h2 className="text-xs font-black text-foreground uppercase tracking-widest">Tabela Consolidada de SKUs</h2>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-6 py-4 font-black">Cód. Interno</th>
                      <th className="px-6 py-4 font-black">Descrição do Produto</th>
                      <th className="px-6 py-4 font-black text-center">Unidade</th>
                      <th className="px-6 py-4 font-black text-right">Saldo Físico (Global)</th>
                      <th className="px-6 py-4 font-black text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {saldoPorItem.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 text-xs font-black text-muted-foreground uppercase">{item.codigo}</td>
                        <td className="px-6 py-4 text-sm font-bold text-foreground">{item.nome}</td>
                        <td className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase">{item.un}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn("text-base font-black", item.qty > 0 ? "text-foreground" : "text-rose-500")}>
                            {item.qty.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.qty > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Disponível
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              Zerado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {saldoPorItem.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground text-sm font-semibold">
                          Nenhum produto com saldo encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
              {saldoPorItem.map((item, idx) => (
                <div key={idx} className="bg-card border border-border/50 rounded-3xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40">
                      CÓD: {item.codigo}
                    </span>
                    {item.qty > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 leading-none">
                        Disponível
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 leading-none">
                        Zerado
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-black text-foreground leading-snug">{item.nome}</h4>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-border/30 pt-3 mt-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Saldo Global</span>
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-lg font-black", item.qty > 0 ? "text-foreground" : "text-rose-500")}>
                        {item.qty.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase">{item.un}</span>
                    </div>
                  </div>
                </div>
              ))}
              {saldoPorItem.length === 0 && (
                <div className="py-16 text-center text-muted-foreground bg-card border border-border/50 rounded-[2rem]">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-25" />
                  <p className="font-black text-xs uppercase tracking-wider">Nenhum produto encontrado.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: LOCAIS */}
        {activeTab === 'locais' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saldoPorLocal.map((local, idx) => (
              <div key={idx} className="bg-card border border-border/50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col backdrop-blur-md">
                <div className="p-5 border-b border-border/30 bg-muted/10 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0 shadow-inner">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-tight">{local.nome}</h3>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mt-0.5">{local.regiao}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-card/60 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/30">
                    <div className="text-center flex-1 border-r border-border/30">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">SKUs no Local</p>
                      <p className="text-lg font-black text-foreground mt-0.5">{local.items.length}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Volume Físico</p>
                      <p className="text-lg font-black text-indigo-600 mt-0.5">{local.totalQty.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider mb-2.5">Detalhamento Físico</p>
                  <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                    {local.items.sort((a, b) => b.qty - a.qty).map((i, iIdx) => (
                      <div key={iIdx} className="flex justify-between items-center py-1.5 px-2.5 hover:bg-muted/40 rounded-xl transition-colors text-xs border border-transparent hover:border-border/40">
                        <span className="font-bold text-foreground truncate mr-2">{i.nome}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-black text-foreground">{i.qty.toLocaleString('pt-BR')}</span>
                          <span className="text-[9px] uppercase font-black text-muted-foreground w-6 text-right">{i.un}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {saldoPorLocal.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card border border-border/50 rounded-[2rem] border-dashed">
                <MapPin className="w-12 h-12 text-muted-foreground/30 mb-4 opacity-25" />
                <p className="text-sm font-black uppercase tracking-wider text-foreground">Sem Resultados Operacionais</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: REGIÕES */}
        {activeTab === 'regioes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saldoPorRegiao.map((reg, idx) => (
              <div key={idx} className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-6 relative overflow-hidden backdrop-blur-md">
                <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                  <Globe className="w-40 h-40 text-muted-foreground" />
                </div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none">Nó Logístico</p>
                    <p className="text-base font-black text-foreground uppercase mt-1">{reg.nome}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto relative z-10">
                  <div className="bg-muted/20 p-4 rounded-2xl border border-border/30">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Almoxarifados</p>
                    <p className="text-xl font-black text-foreground mt-1">{reg.locaisCount.size}</p>
                  </div>
                  <div className="bg-muted/20 p-4 rounded-2xl border border-border/30">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Volume (Qtd)</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">{reg.totalQty.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            ))}
            {saldoPorRegiao.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card border border-border/50 rounded-[2rem] border-dashed">
                <Globe className="w-12 h-12 text-muted-foreground/30 mb-4 opacity-25" />
                <p className="text-sm font-black uppercase tracking-wider text-foreground">Sem Regiões Operacionais</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
