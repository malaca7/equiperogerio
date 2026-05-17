import React, { useState, useMemo } from 'react'
import { 
  format, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  parseISO, 
  subDays, 
  isToday, 
  isFuture, 
  startOfDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  getDay
} from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { ptBR } from 'date-fns/locale'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  FileText,
  Umbrella,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  Filter,
  ChevronRight,
  Zap,
  HeartPulse,
  Briefcase,
  Settings,
  MapPin,
  Target,
  Activity,
  Award,
  CalendarDays,
  LayoutGrid,
  Divide,
  Shapes,
  HelpCircle,
  LogOut,
  Compass,
  BarChart as BarChartIcon
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading, Skeleton } from '../components/ui/Loading'
import { useDashboardStats, useFrequenciaMensal, useFrequenciaPeriodo } from '../hooks/useFrequencia'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { today, currentMonth } from '../lib/utils'

const currentDateStr = today()
const currentMonthStr = currentMonth()

interface StatCardProps {
  label: string
  value: number | string
  trend?: { value: string; isUp: boolean; period: string }
  icon: React.ElementType
  color: string
  bg: string
  description?: string
  comparison?: string
}

function StatCard({ label, value, trend, icon: Icon, color, bg, description, comparison }: StatCardProps) {
  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-start justify-between relative z-10">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-inner", bg)}>
          <Icon className={cn("w-7 h-7", color)} />
        </div>
        {trend && (
          <div className="flex flex-col items-end">
            <div className={cn(
              "flex items-center gap-0.5 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter border",
              trend.isUp ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
            )}>
              {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.value}%
            </div>
            <span className="text-[8px] font-black uppercase text-muted-foreground mt-1 opacity-50">{trend.period}</span>
          </div>
        )}
      </div>
      
      <div className="mt-6 relative z-10">
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-black text-foreground tracking-tighter leading-none">{value}</p>
          {description && <span className="text-[10px] font-bold text-muted-foreground uppercase">{description}</span>}
        </div>
        {comparison && (
          <p className="text-[9px] font-bold text-muted-foreground/60 mt-3 flex items-center gap-1.5 italic">
             {comparison}
          </p>
        )}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-2xl">
        <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-widest">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs font-bold text-foreground/80">{p.name}</span>
            </div>
            <span className="text-sm font-black text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const now = new Date()
  
  // Basic Data
  const { data: stats, isLoading: loadStats } = useDashboardStats(currentDateStr)
  const { data: yesterdayStats } = useDashboardStats(format(subDays(now, 1), 'yyyy-MM-dd'))
  const { data: allFuncionarios = [] } = useFuncionarios({ status: 'ativo' })
  const { data: setoresConfig = [] } = useConfiguracao<string[]>('setores', [])
  const { data: localidadesConfig = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: tiposEscala = [] } = useConfiguracao<any[]>('tipos_escala', [])

  // Period Data
  const { data: currentMonthFreq = [], isLoading: loadMensal } = useFrequenciaMensal(currentMonthStr)
  const lastMonthStr = format(subMonths(now, 1), 'yyyy-MM')
  const { data: lastMonthFreq = [] } = useFrequenciaMensal(lastMonthStr)
  const { data: last7DaysFreq = [] } = useFrequenciaPeriodo(format(subDays(now, 6), 'yyyy-MM-dd'), currentDateStr)

  // Planning Intelligence: Averages by Day of Week
  const planningData = useMemo(() => {
    if (!currentMonthFreq.length) return []
    
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const totals: Record<number, { count: number; presentes: number; faltas: number; daysMeasured: Set<string> }> = {}
    
    for (let i = 0; i < 7; i++) {
      totals[i] = { count: 0, presentes: 0, faltas: 0, daysMeasured: new Set() }
    }

    currentMonthFreq.forEach(f => {
      const d = parseISO(f.data)
      const dayIdx = getDay(d)
      totals[dayIdx].count++
      totals[dayIdx].daysMeasured.add(f.data)
      if (f.status === 'presente' || f.status === 'hora_extra') totals[dayIdx].presentes++
      if (f.status === 'falta' || f.status === 'atestado') totals[dayIdx].faltas++
    })

    return weekDays.map((name, i) => {
      const dayCount = totals[i].daysMeasured.size || 1
      return {
        name,
        mediaPresentes: totals[i].presentes / dayCount,
        mediaAusentes: totals[i].faltas / dayCount,
        totalMedia: (totals[i].presentes + totals[i].faltas) / dayCount
      }
    })
  }, [currentMonthFreq])

  const metrics = useMemo(() => {
    if (!stats || !yesterdayStats) return null

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return { value: '0', isUp: true }
      const diff = ((curr - prev) / prev) * 100
      return { value: Math.abs(diff).toFixed(1), isUp: diff >= 0 }
    }

    const presenceTrend = calcTrend(stats.presentes, yesterdayStats.presentes)
    const absenceTrend = calcTrend(stats.faltas + stats.atestados, yesterdayStats.faltas + yesterdayStats.atestados)

    const getYield = (freq: any[]) => {
      const working = freq.filter(f => f.status === 'presente' || f.status === 'hora_extra').length
      return freq.length > 0 ? Math.round((working / freq.length) * 100) : 0
    }
    const currentYield = getYield(currentMonthFreq)
    const prevYield = getYield(lastMonthFreq)
    const yieldTrend = calcTrend(currentYield, prevYield)

    return { presenceTrend, absenceTrend, yieldTrend, currentYield, prevYield }
  }, [stats, yesterdayStats, currentMonthFreq, lastMonthFreq])

  const sectorIntelligence = useMemo(() => {
    const activeSetores = setoresConfig
    const sectors: Record<string, { p: number; f: number; total: number }> = {}
    activeSetores.forEach(s => sectors[s] = { p: 0, f: 0, total: 0 })

    currentMonthFreq.forEach(f => {
      const s = f.funcionarios?.setor
      if (s && sectors[s]) {
        sectors[s].total++
        if (f.status === 'presente') sectors[s].p++
        if (f.status === 'falta') sectors[s].f++
      }
    })

    const ranking = Object.entries(sectors).map(([name, vals]) => {
      return {
        name,
        score: vals.total > 0 ? Math.round((vals.p / vals.total) * 100) : 0,
        total: vals.total
      }
    }).sort((a, b) => b.score - a.score)

    return { ranking, activeCount: activeSetores.length }
  }, [currentMonthFreq, setoresConfig])

  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now })
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const dayFreq = last7DaysFreq.filter(f => f.data === dStr)
      return {
        name: format(d, 'EEE', { locale: ptBR }).toUpperCase(),
        presentes: dayFreq.filter(f => f.status === 'presente').length,
        faltas: dayFreq.filter(f => f.status === 'falta' || f.status === 'atestado').length
      }
    })
  }, [last7DaysFreq])

  // 4. Upcoming Intelligence
  const upcomingFeriados = useMemo(() => {
    return feriados
      .filter(f => isFuture(parseISO(f.data)) || isToday(parseISO(f.data)))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3)
  }, [feriados])

  const pieData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Presentes', value: stats.presentes, color: '#10b981' }, 
      { name: 'Pendentes', value: stats.pendentes, color: '#f59e0b' },
      { name: 'Ausentes', value: stats.faltas + stats.atestados, color: '#f43f5e' },
      { name: 'Folgas', value: stats.folgas, color: '#3b82f6' },
      { name: 'Férias', value: stats.ferias, color: '#8b5cf6' },
      { name: 'Fora Escala', value: stats.foraEscala, color: '#64748b' },
    ].filter(d => d.value > 0)
  }, [stats])

  const isLoading = loadStats || loadMensal

  if (isLoading) return <div className="min-h-screen bg-background"><TopHeader title="Dashboard 7 Boss" /><div className="py-32"><Loading text="Compilando inteligência analítica..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Dashboard 7 Boss" subtitle="Unidade de Inteligência Operacional" />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Command Center Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full w-fit">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
              <span className="text-[10px] font-black uppercase text-primary tracking-[0.3em]">Status: Em Operação</span>
            </div>
            <h2 className="text-5xl font-black text-foreground tracking-tighter leading-none">Visão Estratégica</h2>
            <p className="text-base font-bold text-muted-foreground/60 max-w-xl italic">Consolidado tático de presença, eficácia por setor e movimentação de efetivo.</p>
          </div>
          
          <div className="grid grid-cols-2 md:flex items-center gap-4">
             <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 p-5 rounded-[2rem] shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-all">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-1.5">Total Efetivo</p>
                <p className="text-lg font-black text-foreground">{allFuncionarios.length} <span className="text-[10px] text-muted-foreground/40 font-bold uppercase">Ativos</span></p>
              </div>
            </div>
            <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 p-5 rounded-[2rem] shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-all">
              <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none mb-1.5">Meta de Fluxo</p>
                <p className="text-lg font-black text-foreground">95.0%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard 
            label="Presenças Reais" 
            value={stats?.presentes || 0} 
            icon={UserCheck} 
            color="text-emerald-500" 
            bg="bg-emerald-500/10" 
            description={`/ ${allFuncionarios.length}`}
            trend={metrics?.presenceTrend ? { ...metrics.presenceTrend, period: 'vs Ontem' } : undefined}
            comparison="Apenas registros confirmados hoje"
          />
          <StatCard 
            label="Ausências Confirmadas" 
            value={(stats?.faltas || 0) + (stats?.atestados || 0)} 
            icon={UserX} 
            color="text-rose-500" 
            bg="bg-rose-500/10" 
            trend={metrics?.absenceTrend ? { ...metrics.absenceTrend, period: 'vs Ontem' } : undefined}
            comparison={`${stats?.faltas || 0} Faltas | ${stats?.atestados || 0} Atestados`}
          />
          <StatCard 
            label="Pendências (Escalados)" 
            value={stats?.pendentes || 0} 
            icon={Clock} 
            color="text-amber-500" 
            bg="bg-amber-500/10" 
            comparison="Escalados sem registro de chamada"
          />
          <StatCard 
            label="Eficácia Mês" 
            value={`${metrics?.currentYield}%`} 
            icon={Award} 
            color="text-primary" 
            bg="bg-primary/10" 
            trend={metrics?.yieldTrend ? { ...metrics.yieldTrend, period: 'vs Mês Ant.' } : undefined}
            comparison={`Mês anterior: ${metrics?.prevYield}%`}
          />
        </div>

        {/* Planning & Programming Intelligence Section */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[3rem] p-10 shadow-sm mb-12 relative overflow-hidden transition-all hover:shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
            <div className="max-w-md space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Compass className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Núcleo de Planejamento</h3>
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em] mt-1">Sazonalidade e Médias de Demanda</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed font-bold italic">
                Analise a média histórica de presença para cada dia da semana. Utilize estes dados para programar folgas e reforços táticos de forma inteligente.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-5 bg-muted/30 rounded-3xl border border-border/50">
                   <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mb-2">Dia de Maior Fluxo</p>
                   <p className="text-lg font-black text-foreground uppercase tracking-tight">
                    {planningData.length > 0 ? planningData.reduce((prev, current) => (prev.mediaPresentes > current.mediaPresentes) ? prev : current).name : '...'}
                   </p>
                </div>
                <div className="p-5 bg-muted/30 rounded-3xl border border-border/50">
                   <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mb-2">Méd. Ausências</p>
                   <p className="text-lg font-black text-rose-500 tracking-tight">
                    {planningData.length > 0 ? (planningData.reduce((acc, curr) => acc + curr.mediaAusentes, 0) / 7).toFixed(1) : '0.0'}
                   </p>
                </div>
              </div>
            </div>

            <div className="flex-1 h-80 min-w-0 lg:max-w-3xl">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planningData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} 
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(var(--primary), 0.05)' }} />
                    <Bar dataKey="mediaPresentes" name="Média Presenças" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40} />
                    <Bar dataKey="mediaAusentes" name="Média Ausências" fill="#f43f5e" opacity={0.4} radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Main Analytics Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Trend Dynamics */}
          <div className="lg:col-span-2 bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-10 shadow-sm relative overflow-hidden transition-all hover:shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Dinâmica em Tempo Real</h3>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-[0.2em] mt-1">Fluxo de Presenças Confirmadas</p>
                </div>
              </div>
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/30">
                <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-xl shadow-sm border border-border/50">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-[9px] font-black uppercase text-foreground tracking-widest">Presenças</span>
                </div>
              </div>
            </div>
            
            <div className="h-80 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="presentes" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorP)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational Topology */}
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-10 shadow-sm transition-all hover:shadow-2xl">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
              <h3 className="text-sm font-black uppercase text-foreground tracking-[0.3em]">Composição de Força</h3>
            </div>
            
            <div className="h-64 mb-10 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={65} outerRadius={95} paddingAngle={10} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <PieIcon className="w-12 h-12 text-primary/10 mb-2" />
                 <span className="text-[10px] font-black text-muted-foreground/40 tracking-widest uppercase">Efetivo</span>
              </div>
            </div>

            <div className="space-y-2">
              {pieData.slice(0, 4).map(d => (
                <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/30 hover:bg-muted/40 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{d.name}</span>
                  </div>
                  <span className="text-xs font-black text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Intelligence: Sectors & Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Active Sector Performance */}
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-10 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div>
                   <h3 className="text-sm font-black uppercase text-foreground tracking-[0.3em]">Performance por Unidade</h3>
                   <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Ranking de Eficácia dos Setores</p>
                </div>
              </div>
              <Link to="/rendimento" className="px-5 py-2.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-all">Ver Tudo</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
              {sectorIntelligence.ranking.length > 0 ? sectorIntelligence.ranking.slice(0, 6).map((sector, i) => (
                <div key={sector.name} className="space-y-4 group">
                  <div className="flex justify-between items-end px-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-primary/40">0{i+1}</span>
                      <span className="text-xs font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">{sector.name}</span>
                    </div>
                    <span className={cn("text-sm font-black", sector.score > 90 ? "text-emerald-500" : "text-primary")}>{sector.score}%</span>
                  </div>
                  <div className="w-full bg-muted/40 rounded-full h-4 overflow-hidden p-1 border border-border/30">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000", 
                        sector.score > 90 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-primary"
                      )}
                      style={{ width: `${sector.score}%` }}
                    />
                  </div>
                </div>
              )) : (
                <div className="col-span-2 py-20 text-center text-muted-foreground italic text-xs uppercase tracking-widest opacity-40">Aguardando dados...</div>
              )}
            </div>
          </div>

          {/* Tactical Shortcuts & Upcoming */}
          <div className="space-y-8">
             <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                  <h3 className="text-sm font-black uppercase text-foreground tracking-[0.3em]">Calendário Tático</h3>
                </div>
                
                <div className="space-y-5">
                  {upcomingFeriados.map((f: any) => (
                    <div key={f.id} className="flex items-center gap-5 p-5 rounded-[1.75rem] bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                        <Umbrella className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-tight leading-tight">{f.nome}</p>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                          <CalendarDays className="w-3 h-3" />
                          {format(parseISO(f.data), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => navigate('/configuracoes')}
                  className="w-full mt-8 py-5 rounded-[1.5rem] border border-border/50 bg-muted/20 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-95"
                >
                  Configurar Agenda
                </button>
             </div>
          </div>
        </div>

        {/* Command Shortcuts Native */}
        <div className="space-y-10">
          <div className="flex items-center gap-4 px-4">
            <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            <h3 className="text-sm font-black uppercase text-foreground tracking-[0.3em]">Ações de Comando</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Calendar, title: "Escala Mensal", desc: "Gestão Operacional", color: "text-blue-500", bg: "bg-blue-500/10", path: "/escala" },
              { icon: CheckCircle2, title: "Frequência", desc: "Controle de Campo", color: "text-emerald-500", bg: "bg-emerald-500/10", path: "/frequencia" },
              { icon: Activity, title: "Atestados", desc: "Controle Médico", color: "text-rose-500", bg: "bg-rose-500/10", path: "/atestados" },
              { icon: TrendingUp, title: "Análise", desc: "Métricas de Yield", color: "text-primary", bg: "bg-primary/10", path: "/rendimento" }
            ].map((action) => (
              <button 
                key={action.path}
                onClick={() => navigate(action.path)}
                className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 p-8 rounded-[3rem] flex flex-col items-center text-center gap-6 hover:shadow-2xl hover:scale-[1.05] transition-all duration-500 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors" />
                <div className={cn("w-16 h-16 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-black/5 group-hover:rotate-6 transition-transform duration-500 shadow-inner", action.bg)}>
                  <action.icon className={cn("w-8 h-8", action.color)} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-foreground tracking-tight uppercase">{action.title}</h4>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mt-2">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
