import React, { useMemo, useState } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import {
  Package, TrendingUp, AlertTriangle, ArrowRight, ArrowDownRight, ArrowUpRight,
  ArrowLeftRight, BarChart3, PieChart as PieIcon, MapPin, Clock, ShieldCheck,
  Boxes, AlertCircle, Filter, ChevronRight, Activity, Zap, Eye
} from 'lucide-react'
import { useEstoqueSaldos, useEstoqueProdutos, useEstoqueMovimentacoes, useEstoqueRegioes, useEstoqueCategorias, useEstoqueAlertas } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { Link } from 'react-router-dom'
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

const TIPO_MATERIAL_LABELS: Record<string, string> = {
  epi: 'EPI', ferramenta: 'Ferramenta', peca: 'Peça', escritorio: 'Escritório',
  equipamento: 'Equipamento', insumo: 'Insumo', geral: 'Geral'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border/50 p-3 rounded-xl shadow-2xl">
      <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] font-bold text-foreground/80">{p.name}</span>
          </div>
          <span className="text-xs font-black text-foreground">{typeof p.value === 'number' ? p.value.toFixed(0) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function EstoqueDashboardPage() {
  const { data: saldos = [], isLoading: loadS } = useEstoqueSaldos()
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  const { data: movimentacoes = [], isLoading: loadM } = useEstoqueMovimentacoes(500)
  const { data: regioes = [] } = useEstoqueRegioes()
  const { data: categorias = [] } = useEstoqueCategorias()
  const { data: alertas = [] } = useEstoqueAlertas()

  const [selectedRegiao, setSelectedRegiao] = useState<string>('all')

  const isLoading = loadS || loadP || loadM

  // ── Métricas calculadas ──
  const metrics = useMemo(() => {
    const filteredSaldos = selectedRegiao === 'all' ? saldos : saldos.filter(s => s.local?.regiao?.id === selectedRegiao)
    const totalItens = filteredSaldos.reduce((a, c) => a + c.quantidade, 0)
    const valorTotal = filteredSaldos.reduce((a, c) => a + (c.quantidade * (c.produto?.valor_unitario_atual || 0)), 0)

    // Saldo agrupado por produto
    const saldoPorProduto: Record<string, number> = {}
    filteredSaldos.forEach(s => { saldoPorProduto[s.produto_id] = (saldoPorProduto[s.produto_id] || 0) + s.quantidade })

    const abaixoMinimo = produtos.filter(p => (saldoPorProduto[p.id] || 0) <= p.estoque_minimo && p.ativo)

    // Movimentações filtradas
    const filteredMovs = selectedRegiao === 'all' ? movimentacoes : movimentacoes.filter(m => {
      const origemRegiao = m.local_origem?.regiao?.id
      const destinoRegiao = m.local_destino?.regiao?.id
      return origemRegiao === selectedRegiao || destinoRegiao === selectedRegiao
    })

    // Últimas 24h
    const now = new Date()
    const ontem = subDays(now, 1)
    const movsHoje = filteredMovs.filter(m => new Date(m.data_movimentacao) >= ontem)

    return { totalItens, valorTotal, abaixoMinimo, filteredMovs, movsHoje, saldoPorProduto, filteredSaldos }
  }, [saldos, produtos, movimentacoes, selectedRegiao])

  // ── Dados dos gráficos ──
  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const dayMovs = metrics.filteredMovs.filter(m => m.data_movimentacao.startsWith(dStr))
      return {
        name: format(d, 'EEE', { locale: ptBR }).toUpperCase(),
        entradas: dayMovs.filter(m => m.tipo === 'entrada').reduce((a, c) => a + c.quantidade, 0),
        saidas: dayMovs.filter(m => m.tipo === 'saida' || m.tipo === 'ajuste').reduce((a, c) => a + c.quantidade, 0),
      }
    })
  }, [metrics.filteredMovs])

  const categoriaPieData = useMemo(() => {
    const map: Record<string, number> = {}
    metrics.filteredSaldos.forEach(s => {
      const catNome = s.produto?.categoria?.nome || 'Sem Categoria'
      map[catNome] = (map[catNome] || 0) + s.quantidade
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [metrics.filteredSaldos])

  const localData = useMemo(() => {
    const map: Record<string, number> = {}
    metrics.filteredSaldos.forEach(s => {
      const nome = s.local?.nome || 'Indefinido'
      map[nome] = (map[nome] || 0) + s.quantidade
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [metrics.filteredSaldos])

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Dashboard de Estoque" />
      <div className="pt-28 sm:pt-32 pb-20"><Loading text="Carregando inteligência do estoque..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Dashboard de Estoque" subtitle="Centro de Comando Corporativo" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* ── Barra de Filtro por Região ── */}
        <div className="bg-card/80 dark:bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl px-4 py-2.5 mb-8 shadow-sm flex flex-wrap items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-500 pointer-events-none" />
            <select
              value={selectedRegiao}
              onChange={e => setSelectedRegiao(e.target.value)}
              className="pl-7 pr-6 py-1.5 bg-muted/40 border border-border/40 focus:border-indigo-500/50 rounded-xl text-[11px] font-black text-foreground outline-none transition-all appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="all">Todas as Regiões</option>
              {regioes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rotate-90 text-muted-foreground/50 pointer-events-none" />
          </div>
          {selectedRegiao !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-500">
              {regioes.find(r => r.id === selectedRegiao)?.nome}
              <button onClick={() => setSelectedRegiao('all')} className="hover:text-rose-500 ml-0.5">×</button>
            </span>
          )}
          <span className="ml-auto text-[10px] font-bold text-muted-foreground/50 hidden md:block">
            {regioes.length} regiões · {produtos.length} itens cadastrados
          </span>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {[
            { label: 'Itens em Estoque', value: metrics.totalItens.toFixed(0), icon: Boxes, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Valor Estimado', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.valorTotal), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Abaixo do Mínimo', value: metrics.abaixoMinimo.length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
            { label: 'Movimentações 24h', value: metrics.movsHoje.length, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map((kpi, i) => (
            <div key={i} className={cn("bg-card/80 backdrop-blur-xl border rounded-2xl p-5 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group", kpi.border)}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform", kpi.bg)}>
                  <kpi.icon className={cn("w-5 h-5", kpi.color)} />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-tight">{kpi.label}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Alertas Críticos Banner ── */}
        {(alertas.length > 0 || metrics.abaixoMinimo.length > 0) && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">Atenção — {metrics.abaixoMinimo.length + alertas.length} Alertas Ativos</p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.abaixoMinimo.slice(0, 5).map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 rounded-lg text-[10px] font-bold text-rose-600">
                    <AlertTriangle className="w-2.5 h-2.5" /> {p.nome}
                  </span>
                ))}
                {metrics.abaixoMinimo.length > 5 && (
                  <Link to="/estoque/produtos" className="text-[10px] font-black text-rose-500 underline">
                    +{metrics.abaixoMinimo.length - 5} mais
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Tendência 7 dias */}
          <div className="lg:col-span-2 bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500"><BarChart3 className="w-4.5 h-4.5" /></div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Fluxo dos Últimos 7 Dias</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">Entradas vs Saídas por dia</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.1)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="saidas" name="Saídas" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição por Categoria */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500"><PieIcon className="w-4.5 h-4.5" /></div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Por Categoria</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">Distribuição de volume</p>
              </div>
            </div>
            {categoriaPieData.length > 0 ? (
              <>
                <div className="h-40 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoriaPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={2} stroke="hsl(var(--background))">
                        {categoriaPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {categoriaPieData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-bold text-foreground truncate max-w-[100px]">{d.name}</span>
                      </div>
                      <span className="font-black text-foreground">{d.value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </div>
        </div>

        {/* ── Segunda Linha: Regiões + Volume por Local + Movimentações Recentes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Regiões */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500"><MapPin className="w-4.5 h-4.5" /></div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Regiões</h3>
              </div>
              <span className="text-[10px] font-black text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">{regioes.length}</span>
            </div>
            {regioes.length > 0 ? (
              <div className="space-y-2">
                {regioes.map(r => {
                  const regionSaldos = saldos.filter(s => s.local?.regiao?.id === r.id)
                  const qtd = regionSaldos.reduce((a, c) => a + c.quantidade, 0)
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRegiao(selectedRegiao === r.id ? 'all' : r.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                        selectedRegiao === r.id ? "bg-indigo-500/10 border-indigo-500/30" : "bg-muted/20 border-border/30 hover:bg-muted/40"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground truncate">{r.nome}</p>
                        <p className="text-[9px] text-muted-foreground font-semibold">{r.codigo || '—'}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-black text-indigo-500">{qtd.toFixed(0)}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">itens</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground font-semibold mb-2">Nenhuma região cadastrada</p>
                <p className="text-[10px] text-muted-foreground/60">Configure regiões para controle multi-local</p>
              </div>
            )}
          </div>

          {/* Volume por Local */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Boxes className="w-4.5 h-4.5" /></div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Volume por Local</h3>
            </div>
            <div className="space-y-2">
              {localData.slice(0, 8).map((d, i) => {
                const maxVal = localData[0]?.value || 1
                const pct = Math.round((d.value / maxVal) * 100)
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-foreground truncate max-w-[140px]">{d.name}</span>
                      <span className="font-black text-foreground">{d.value.toFixed(0)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {localData.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
            </div>
          </div>

          {/* Últimas Movimentações */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><Clock className="w-4.5 h-4.5" /></div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Recentes</h3>
              </div>
              <Link to="/estoque/movimentacoes" className="p-1.5 bg-muted/50 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {metrics.filteredMovs.slice(0, 8).map(m => {
                const isE = m.tipo === 'entrada'
                const isS = m.tipo === 'saida' || m.tipo === 'ajuste'
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      isE ? "bg-emerald-500/10 text-emerald-500" : isS ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {isE ? <ArrowDownRight className="w-3.5 h-3.5" /> : isS ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground truncate">{m.produto?.nome}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold">{format(new Date(m.data_movimentacao), 'dd/MM HH:mm')}</p>
                    </div>
                    <span className={cn("text-xs font-black shrink-0",
                      isE ? "text-emerald-500" : isS ? "text-rose-500" : "text-blue-500"
                    )}>
                      {isE ? '+' : isS ? '-' : ''}{m.quantidade}
                    </span>
                  </div>
                )
              })}
              {metrics.filteredMovs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem movimentações</p>}
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/estoque/produtos', label: 'Produtos', icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { to: '/estoque/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { to: '/estoque/cautelas', label: 'Cautelas EPI', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { to: '/estoque/solicitacoes', label: 'Solicitações', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map(action => (
            <Link
              key={action.to}
              to={action.to}
              className="bg-card/80 border border-border/50 rounded-2xl p-4 flex items-center gap-3 hover:shadow-lg hover:scale-[1.02] transition-all group"
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform", action.bg)}>
                <action.icon className={cn("w-4.5 h-4.5", action.color)} />
              </div>
              <span className="text-xs font-black text-foreground uppercase tracking-wider">{action.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto" />
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
