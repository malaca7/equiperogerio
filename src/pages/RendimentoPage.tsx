import React, { useState, useMemo } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  Filter,
  ChevronRight,
  Search,
  UserCheck,
  UserX,
  Stethoscope,
  Plane,
  Award,
  BarChart3,
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Activity,
  Target,
  Zap,
  LayoutGrid
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isPast, isToday, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip,
  AreaChart,
  Area
} from 'recharts'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Card, CardContent } from '../components/ui/Card'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { currentMonth } from '../lib/utils'

export function RendimentoPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSetor, setSelectedSetor] = useState('Todos')

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(selectedMonth)
  const { data: setores = [] } = useConfiguracao<string[]>('setores', [])

  const stats = useMemo(() => {
    if (!allFuncionarios.length) return []

    const targets = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')

    return targets.map(func => {
      const funcEscalas = escalas.filter(e => e.funcionario_id === func.id)
      
      const total = funcEscalas.length
      const presentes = funcEscalas.filter(e => e.tipo === 'presente' || e.tipo === 'hora_extra').length
      const faltas = funcEscalas.filter(e => e.tipo === 'falta').length
      const atestados = funcEscalas.filter(e => e.tipo === 'atestado').length
      const ferias = funcEscalas.filter(e => e.tipo === 'ferias').length
      const outros = funcEscalas.filter(e => !['presente', 'hora_extra', 'falta', 'atestado', 'ferias', 'repouso', 'compensar'].includes(e.tipo)).length
      
      const divisor = presentes + faltas
      const yieldScore = divisor > 0 ? Math.round((presentes / divisor) * 100) : 100

      return {
        ...func,
        stats: {
          total,
          presentes,
          faltas,
          atestados,
          ferias,
          outros,
          yieldScore
        }
      }
    }).sort((a, b) => b.stats.yieldScore - a.stats.yieldScore)
  }, [allFuncionarios, escalas])

  const filteredStats = useMemo(() => {
    return stats.filter(s => {
      const matchSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase())
      const matchSetor = selectedSetor === 'Todos' || s.setor === selectedSetor
      return matchSearch && matchSetor
    })
  }, [stats, searchTerm, selectedSetor])

  const globalSummary = useMemo(() => {
    if (!stats.length) return null
    const avg = Math.round(stats.reduce((acc, s) => acc + s.stats.yieldScore, 0) / stats.length)
    const totalPresentes = stats.reduce((acc, s) => acc + s.stats.presentes, 0)
    const totalFaltas = stats.reduce((acc, s) => acc + s.stats.faltas, 0)
    const totalAtestados = stats.reduce((acc, s) => acc + s.stats.atestados, 0)

    const pieData = [
      { name: 'Presenças', value: totalPresentes, color: '#10b981' },
      { name: 'Faltas', value: totalFaltas, color: '#f43f5e' },
      { name: 'Atestados', value: totalAtestados, color: '#f59e0b' },
    ].filter(d => d.value > 0)

    return { avg, totalPresentes, totalFaltas, totalAtestados, pieData }
  }, [stats])

  const podium = useMemo(() => {
    return stats.slice(0, 3)
  }, [stats])

  const isLoading = loadF || loadE

  if (isLoading) return <div className="min-h-screen bg-background"><TopHeader title="Rendimento" /><div className="py-32"><Loading text="Compilando inteligência competitiva..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Rendimento" 
        subtitle="Métricas de Eficácia"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Native-Style Toolbar */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-4 sm:p-6 shadow-xl mb-10 sticky top-24 z-30 transform-gpu transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Period Selector Native */}
            <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30 w-full lg:w-auto">
              <button 
                onClick={() => setSelectedMonth(format(subMonths(parseISO(selectedMonth + '-01'), 1), 'yyyy-MM'))}
                className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center hover:bg-card hover:shadow-md transition-all active:scale-90 text-muted-foreground"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div className="flex-1 lg:min-w-[180px] text-center">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-2">Análise Mensal</p>
                <p className="text-sm font-black text-foreground uppercase tracking-tight">{format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}</p>
              </div>
              <button 
                onClick={() => setSelectedMonth(format(startOfMonth(new Date()), 'yyyy-MM'))}
                className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center hover:bg-card hover:shadow-md transition-all active:scale-90 text-muted-foreground"
              >
                <Calendar className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:min-w-[350px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Filtrar por nome ou setor..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-transparent focus:border-primary/20 rounded-[1.75rem] text-sm font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
              <select
                value={selectedSetor}
                onChange={e => setSelectedSetor(e.target.value)}
                className="h-14 bg-muted/40 px-6 rounded-[1.5rem] text-xs font-black uppercase tracking-widest border border-transparent focus:border-primary/20 text-foreground focus:ring-0 transition-all"
              >
                <option value="Todos">Todos os Setores</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Global Overview Cards */}
        {globalSummary && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-16">
            <div className="xl:col-span-2 group relative bg-card/80 dark:bg-card/40 backdrop-blur-2xl p-10 rounded-[3rem] border border-border/50 shadow-2xl overflow-hidden animate-fade-in transition-all">
              <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] group-hover:bg-primary/20 transition-colors duration-1000" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="space-y-8 flex-1">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                      <p className="text-[11px] font-black uppercase text-primary tracking-[0.4em]">Desempenho Geral</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-8xl font-black tracking-tighter text-foreground drop-shadow-sm">{globalSummary.avg}%</span>
                      <div className="space-y-2">
                        <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/20 flex items-center justify-center gap-2">
                          <Zap className="w-3.5 h-3.5 fill-current" /> EFICÁCIA ALTA
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Estatística Consolidada</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-10 pt-8 border-t border-border/50">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-2 tracking-widest">Trabalho</p>
                      <p className="text-3xl font-black text-foreground">{globalSummary.totalPresentes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-500/60 uppercase mb-2 tracking-widest">Faltas</p>
                      <p className="text-3xl font-black text-rose-600">{globalSummary.totalFaltas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-500/60 uppercase mb-2 tracking-widest">Saúde</p>
                      <p className="text-3xl font-black text-amber-600">{globalSummary.totalAtestados}</p>
                    </div>
                  </div>
                </div>
                <div className="w-56 h-56 shrink-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={globalSummary.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={10}
                        dataKey="value"
                        stroke="none"
                      >
                        {globalSummary.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <PieChartIcon className="w-10 h-10 text-primary/10 mb-2" />
                    <span className="text-[9px] font-black text-muted-foreground/40 tracking-widest uppercase">Distribuição</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hall of Fame Native */}
            <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-10 shadow-xl flex flex-col animate-fade-in transition-all">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">Top Performers</h3>
              </div>
              <div className="space-y-8 flex-1">
                {podium.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-6 group">
                    <div className={cn(
                      "w-14 h-14 rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-lg shrink-0 transition-transform group-hover:scale-110",
                      i === 0 ? "bg-amber-500 text-white shadow-amber-500/30" : 
                      i === 1 ? "bg-slate-300 text-slate-700 shadow-slate-300/30 dark:bg-slate-600 dark:text-white" : 
                      "bg-orange-400 text-white shadow-orange-400/30"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-foreground truncate uppercase tracking-tight">{p.nome}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] font-black text-primary uppercase tracking-widest">{p.stats.yieldScore}% Eficácia</span>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{p.setor}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tactical Performance List */}
        <div className="space-y-10">
          <div className="flex items-center gap-4 px-4">
            <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
            <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">Listagem Detalhada</h3>
            <span className="ml-auto text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-4 py-1.5 rounded-full border border-border/30">{filteredStats.length} Analisados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStats.map((item) => (
              <div key={item.id} className="group relative bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
                
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-16 h-16 rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-xl transition-all duration-500 group-hover:rotate-3 group-hover:scale-110",
                        item.stats.yieldScore >= 95 ? "bg-emerald-500 text-white shadow-emerald-500/20" : 
                        item.stats.yieldScore >= 80 ? "bg-primary text-white shadow-primary/20" :
                        item.stats.yieldScore >= 70 ? "bg-amber-500 text-white shadow-amber-500/20" : 
                        "bg-rose-500 text-white shadow-rose-500/20"
                      )}>
                        {item.stats.yieldScore}%
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-foreground leading-none tracking-tight uppercase">{item.nome}</h4>
                        <p className="text-[10px] font-black text-muted-foreground uppercase mt-2.5 tracking-[0.2em] opacity-60 flex items-center gap-2">
                           <LayoutGrid className="w-3 h-3" /> {item.setor}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { val: item.stats.presentes, lab: 'PRES', color: 'text-foreground' },
                      { val: item.stats.faltas, lab: 'FALTA', color: 'text-rose-500' },
                      { val: item.stats.atestados, lab: 'SAÚDE', color: 'text-amber-500' },
                      { val: item.stats.ferias, lab: 'FÉRIAS', color: 'text-purple-500' },
                    ].map((s, i) => (
                      <div key={i} className="bg-muted/40 p-3.5 rounded-2xl text-center border border-border/30 transition-colors group-hover:bg-background/50">
                        <span className={cn("block text-base font-black leading-none mb-1.5", s.color)}>{s.val}</span>
                        <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">{s.lab}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aproveitamento</span>
                      <span className="text-[10px] font-black text-foreground">{item.stats.yieldScore}%</span>
                    </div>
                    <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden p-0.5 border border-border/30">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(var(--color),0.4)]",
                          item.stats.yieldScore >= 90 ? "bg-emerald-500" : item.stats.yieldScore >= 70 ? "bg-primary" : "bg-rose-500"
                        )}
                        style={{ width: `${item.stats.yieldScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredStats.length === 0 && (
            <div className="py-40 text-center animate-fade-in">
              <div className="w-24 h-24 bg-muted/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                <Target className="w-12 h-12 text-muted-foreground opacity-20" />
              </div>
              <p className="text-xl font-black uppercase tracking-widest text-foreground opacity-50">Nenhum Registro Ativo</p>
              <p className="text-sm text-muted-foreground mt-2">Os dados de performance serão exibidos após as primeiras chamadas do mês.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
