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
  BarChart as BarChartIcon,
  Shield,
  X,
  Search
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
import { useDashboardStats, useFrequenciaMensal, useFrequenciaPeriodo, useFrequenciaData } from '../hooks/useFrequencia'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { today, currentMonth } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './admin/AdminDashboard'

const tailwindToHex = (bgClass: string): string => {
  if (!bgClass) return '#64748b'
  const clean = bgClass.split(' ').find(c => c.startsWith('bg-'))?.replace('bg-', '') || bgClass.replace('bg-', '')
  const map: Record<string, string> = {
    'blue-500': '#3b82f6',
    'blue-600': '#2563eb',
    'emerald-500': '#10b981',
    'emerald-600': '#059669',
    'amber-400': '#fbbf24',
    'amber-500': '#f59e0b',
    'orange-500': '#f97316',
    'red-500': '#ef4444',
    'rose-500': '#f43f5e',
    'rose-600': '#e11d48',
    'purple-500': '#a855f7',
    'indigo-500': '#6366f1',
    'sky-500': '#0ea5e9',
    'teal-500': '#14b8a6',
    'slate-500': '#64748b',
    'slate-400': '#94a3b8',
    'gray-500': '#6b7280',
    'neutral-500': '#737373',
  }
  return map[clean] || '#64748b'
}

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
    <div className="bg-card border border-border rounded-xl p-5 transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {description && <span className="text-xs text-muted-foreground font-medium">{description}</span>}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-xs font-semibold flex items-center gap-0.5",
              trend.isUp ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend.isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {trend.value}%
            </span>
            <span className="text-[10px] text-muted-foreground">{trend.period}</span>
          </div>
        )}
        {comparison && !trend && (
          <p className="text-[11px] text-muted-foreground mt-1">{comparison}</p>
        )}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-neutral-950/95 dark:bg-black/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl animate-fadeIn">
        <p className="text-[9px] font-black uppercase text-muted-foreground/80 mb-3 tracking-widest border-b border-white/5 pb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shadow-[0_0_6px_rgba(var(--primary),0.5)]" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-[11px] font-black text-neutral-300 uppercase tracking-wider">{p.name}</span>
              </div>
              <span className="text-xs font-black text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10 font-mono">
                {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const now = new Date()

  const { selectedTeamId, setSelectedTeamId } = useAuth()
  const [selectedEncarregadoId, setSelectedEncarregadoId] = useState<string | null>(null)
  const [selectedFuncId, setSelectedFuncId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dashboardTab, setDashboardTab] = useState<'control' | 'forecast'>('control')
  const [targetYieldPercent, setTargetYieldPercent] = useState(95)

  const { data: selectedTeamMembers = [] } = useQuery<string[]>({
    queryKey: ['team-members', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return []
      const { data: mems } = await supabase.from('equipe_membros').select('funcionario_id').eq('equipe_id', selectedTeamId)
      const ids = (mems || []).map((m: any) => m.funcionario_id)
      return Array.from(new Set(ids))
    },
    enabled: !!selectedTeamId
  })

  const { data: allFuncionarios = [] } = useFuncionarios({ status: 'ativo' })

  // Load Teams and Encarregados for the team panel
  const { data: equipes = [], isLoading: loadEquipes } = useQuery<any[]>({
    queryKey: ['equipes-dashboard'],
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, profiles(id, nome)')
      const { data: mem } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, apelido, cargo)')
      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles || (e as any).profile || (e as any).funcionarios).filter(Boolean),
        membros: (mem || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionarios).filter(Boolean),
      }))
    }
  })

  // Load today's frequency data to compute real-time team stats
  const { data: todayFrequencia = [], isLoading: loadTodayFreq } = useFrequenciaData(currentDateStr)
  
  // Load today's scales to accurately know who is scheduled to work
  const { data: todayEscala = [] } = useEscalasPeriodo(currentDateStr, currentDateStr)

  const teamStats = useMemo(() => {
    return equipes.map(eq => {
      const memberIds = eq.membros.map((m: any) => m.id)
      const teamFreqs = todayFrequencia.filter(f => memberIds.includes(f.funcionario_id))
      
      const total = memberIds.length
      const presentes = teamFreqs.filter(f => f.status === 'presente' || f.status === 'hora_extra').length
      const faltas = teamFreqs.filter(f => f.status === 'falta' || f.status === 'atestado').length
      const folgas = teamFreqs.filter(f => f.status === 'folga').length
      const ferias = teamFreqs.filter(f => f.status === 'ferias').length
      
      const hasRecordIds = teamFreqs.map(f => f.funcionario_id)
      
      // A team member is pending ONLY if they have NO frequency record AND they are scheduled to work today (presente/hora_extra)
      const pendentes = memberIds.filter((id: string) => {
        if (hasRecordIds.includes(id)) return false
        const esc = todayEscala.find(e => e.funcionario_id === id)
        return esc && (esc.tipo === 'presente' || esc.tipo === 'hora_extra')
      }).length
      
      const totalComChamada = presentes + faltas
      const yieldRate = totalComChamada > 0 ? Math.round((presentes / totalComChamada) * 100) : 100
      
      return {
        id: eq.id,
        nome: eq.nome,
        descricao: eq.descricao,
        cor: eq.cor,
        encarregados: eq.encarregados,
        total,
        presentes,
        faltas,
        pendentes,
        folgas,
        ferias,
        yieldRate
      }
    })
  }, [equipes, todayFrequencia, todayEscala])

  const allowedFuncIds = useMemo(() => {
    if (selectedFuncId) {
      return [selectedFuncId]
    }
    // Ignore selectedTeamId filter for supervisors - show general data
    if (selectedEncarregadoId) {
      const teamsForEnc = equipes.filter(eq =>
        eq.encarregados.some((e: any) => e.id === selectedEncarregadoId)
      )
      const memberIds = teamsForEnc.flatMap(eq => eq.membros.map((m: any) => m.id))
      return Array.from(new Set(memberIds))
    }
    return undefined
  }, [selectedFuncId, selectedEncarregadoId, equipes])

  const allEncarregados = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>()
    equipes.forEach(eq => {
      eq.encarregados.forEach((e: any) => {
        if (e && e.id && e.nome) {
          map.set(e.id, { id: e.id, nome: e.nome })
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [equipes])

  const filteredEquipesForSelect = useMemo(() => {
    if (!selectedEncarregadoId) return equipes
    return equipes.filter(eq =>
      eq.encarregados.some((e: any) => e.id === selectedEncarregadoId)
    )
  }, [equipes, selectedEncarregadoId])

  const filteredFuncionariosForSelect = useMemo(() => {
    let list = allFuncionarios
    // Ignore selectedTeamId filter for supervisors - show all employees
    if (selectedEncarregadoId) {
      const teamsForEnc = equipes.filter(eq =>
        eq.encarregados.some((e: any) => e.id === selectedEncarregadoId)
      )
      const memberIds = teamsForEnc.flatMap(eq => eq.membros.map((m: any) => m.id))
      list = list.filter(f => memberIds.includes(f.id))
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [allFuncionarios, selectedEncarregadoId, equipes])

  const searchSuggestions = useMemo(() => {
    if (!searchTerm) return []
    const term = searchTerm.toLowerCase()
    return filteredFuncionariosForSelect.filter(f => 
      f.nome.toLowerCase().includes(term) || 
      (f.apelido && f.apelido.toLowerCase().includes(term))
    ).slice(0, 5)
  }, [searchTerm, filteredFuncionariosForSelect])
  
  // Basic Data
  const { data: stats, isLoading: loadStats } = useDashboardStats(currentDateStr, allowedFuncIds)
  const { data: yesterdayStats } = useDashboardStats(format(subDays(now, 1), 'yyyy-MM-dd'), allowedFuncIds)
  const { data: setoresConfig = [] } = useConfiguracao<string[]>('setores', [])
  const { data: localidadesConfig = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: dbTiposEscala } = useConfiguracao<any[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const tiposEscala = useMemo(() => {
    const list = [...(dbTiposEscala || DEFAULT_TIPOS_ESCALA)]
    if (!list.some(t => t.id === 'hora_extra')) {
      list.push({ id: 'hora_extra', letra: 'HE', nome: 'Hora Extra', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' })
    }
    if (!list.some(t => t.id === 'suspensao')) {
      list.push({ id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' })
    }
    return list
  }, [dbTiposEscala])

  // Period Data
  const { data: currentMonthFreq = [], isLoading: loadMensal } = useFrequenciaMensal(currentMonthStr, allowedFuncIds)
  const lastMonthStr = format(subMonths(now, 1), 'yyyy-MM')
  const { data: lastMonthFreq = [] } = useFrequenciaMensal(lastMonthStr, allowedFuncIds)
  const { data: last7DaysFreq = [] } = useFrequenciaPeriodo(format(subDays(now, 6), 'yyyy-MM-dd'), currentDateStr, allowedFuncIds)

  const filteredFuncionarios = useMemo(() => {
    if (allowedFuncIds !== undefined) {
      return allFuncionarios.filter(f => allowedFuncIds.includes(f.id))
    }
    return allFuncionarios
  }, [allFuncionarios, allowedFuncIds])

  const filteredCurrentMonthFreq = useMemo(() => {
    if (allowedFuncIds !== undefined) {
      return currentMonthFreq.filter(f => allowedFuncIds.includes(f.funcionario_id))
    }
    return currentMonthFreq
  }, [currentMonthFreq, allowedFuncIds])

  const filteredLastMonthFreq = useMemo(() => {
    if (allowedFuncIds !== undefined) {
      return lastMonthFreq.filter(f => allowedFuncIds.includes(f.funcionario_id))
    }
    return lastMonthFreq
  }, [lastMonthFreq, allowedFuncIds])

  const filteredLast7DaysFreq = useMemo(() => {
    if (allowedFuncIds !== undefined) {
      return last7DaysFreq.filter(f => allowedFuncIds.includes(f.funcionario_id))
    }
    return last7DaysFreq
  }, [last7DaysFreq, allowedFuncIds])

  // Planning Intelligence: Averages by Day of Week
  const planningData = useMemo(() => {
    if (!filteredCurrentMonthFreq.length) return []
    
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const totals: Record<number, { count: number; presentes: number; faltas: number; daysMeasured: Set<string> }> = {}
    
    for (let i = 0; i < 7; i++) {
      totals[i] = { count: 0, presentes: 0, faltas: 0, daysMeasured: new Set() }
    }

    filteredCurrentMonthFreq.forEach(f => {
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
  }, [filteredCurrentMonthFreq])

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
    const currentYield = getYield(filteredCurrentMonthFreq)
    const prevYield = getYield(filteredLastMonthFreq)
    const yieldTrend = calcTrend(currentYield, prevYield)

    return { presenceTrend, absenceTrend, yieldTrend, currentYield, prevYield }
  }, [stats, yesterdayStats, filteredCurrentMonthFreq, filteredLastMonthFreq])

  const sectorIntelligence = useMemo(() => {
    const activeSetores = setoresConfig
    const sectors: Record<string, { p: number; f: number; total: number }> = {}
    activeSetores.forEach(s => sectors[s] = { p: 0, f: 0, total: 0 })

    filteredCurrentMonthFreq.forEach(f => {
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
  }, [filteredCurrentMonthFreq, setoresConfig])

  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now })
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const dayFreq = filteredLast7DaysFreq.filter(f => f.data === dStr)
      return {
        name: format(d, 'EEE', { locale: ptBR }).toUpperCase(),
        presentes: dayFreq.filter(f => f.status === 'presente').length,
        faltas: dayFreq.filter(f => f.status === 'falta' || f.status === 'atestado').length
      }
    })
  }, [filteredLast7DaysFreq])

  // 4. Upcoming Intelligence
  const upcomingFeriados = useMemo(() => {
    return feriados
      .filter(f => isFuture(parseISO(f.data)) || isToday(parseISO(f.data)))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3)
  }, [feriados])

  const { presenteColor, faltaColor, pieData } = useMemo(() => {
    const getColor = (id: string, fallback: string) => {
      const match = tiposEscala.find((t: any) => t.id === id)
      return match ? tailwindToHex(match.bg) : fallback
    }

    const pColor = getColor('presente', '#3b82f6')
    const fColor = getColor('falta', '#f43f5e')

    const pData = !stats ? [] : [
      { name: 'Presentes', value: stats.presentes, color: pColor }, 
      { name: 'Pendentes', value: stats.pendentes, color: '#f59e0b' },
      { name: 'Ausentes', value: stats.faltas + stats.atestados, color: fColor },
      { name: 'Folgas', value: stats.folgas, color: getColor('compensar', '#10b981') },
      { name: 'Férias', value: stats.ferias, color: getColor('ferias', '#a855f7') },
      { name: 'Fora Escala', value: stats.foraEscala, color: '#64748b' },
    ].filter(d => d.value > 0)

    return { presenteColor: pColor, faltaColor: fColor, pieData: pData }
  }, [stats, tiposEscala])

  const yieldTimelineData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now })
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd')
      const dayFreq = filteredLast7DaysFreq.filter(f => f.data === dStr)
      const total = dayFreq.filter(f => f.status === 'presente' || f.status === 'hora_extra' || f.status === 'falta' || f.status === 'atestado').length
      const presentes = dayFreq.filter(f => f.status === 'presente' || f.status === 'hora_extra').length
      return {
        name: format(d, 'EEE', { locale: ptBR }).toUpperCase(),
        yield: total > 0 ? Math.round((presentes / total) * 100) : 100
      }
    })
  }, [filteredLast7DaysFreq])

  const pieDataWithPercentages = useMemo(() => {
    const total = pieData.reduce((acc, curr) => acc + curr.value, 0) || 1
    return pieData.map(d => ({
      ...d,
      percentage: Math.round((d.value / total) * 100)
    }))
  }, [pieData])

  const isLoading = loadStats || loadMensal

  if (isLoading) return <div className="min-h-screen bg-background"><TopHeader title="Dashboard Administrativo" /><div className="pt-28 sm:pt-32 pb-20"><Loading text="Compilando inteligência analítica..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopHeader title="Painel Operacional" subtitle="Central de Monitoramento e Gestão" />
      
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-12 space-y-6">
        
        {/* Page Title & Main CTA Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Visão Geral da Operação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>
          <Link
            to="/frequencia"
            className="btn-primary shrink-0 self-start sm:self-auto"
          >
            <Clock className="w-4 h-4" /> Registrar Frequência
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-2 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filtros:
          </div>

          {/* Encarregado */}
          <div className="relative">
            <select
              value={selectedEncarregadoId || ''}
              onChange={(e) => {
                const val = e.target.value || null
                setSelectedEncarregadoId(val)
                setSelectedTeamId(null)
                setSelectedFuncId(null)
              }}
              className="pl-3 pr-7 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium text-foreground outline-none appearance-none cursor-pointer"
            >
              <option value="">Todos Encarregados</option>
              {allEncarregados.map((enc) => (
                <option key={enc.id} value={enc.id}>{enc.nome}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rotate-90 text-muted-foreground pointer-events-none" />
          </div>

          {/* Equipe */}
          <div className="relative">
            <select
              value={selectedTeamId || ''}
              onChange={(e) => {
                const teamId = e.target.value || null
                setSelectedTeamId(teamId)
                setSelectedFuncId(null)
                if (teamId) {
                  const team = equipes.find(eq => eq.id === teamId)
                  if (team?.encarregados?.length > 0) {
                    const isCurrentLead = team.encarregados.some((e: any) => e.id === selectedEncarregadoId)
                    if (!isCurrentLead) setSelectedEncarregadoId(team.encarregados[0].id)
                  }
                }
              }}
              className="pl-3 pr-7 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium text-foreground outline-none appearance-none cursor-pointer"
            >
              <option value="">Todas as Equipes</option>
              {filteredEquipesForSelect.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rotate-90 text-muted-foreground pointer-events-none" />
          </div>

          {/* Busca funcionário */}
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="w-full pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium text-foreground placeholder:text-muted-foreground outline-none"
            />
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {searchSuggestions.map(f => (
                  <button
                    key={f.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSelectedFuncId(f.id)
                      setSearchTerm('')
                      setSearchFocused(false)
                      const team = equipes.find(eq => eq.membros.some((m: any) => m.id === f.id))
                      if (team) {
                        setSelectedTeamId(team.id)
                        if (team.encarregados?.length > 0) setSelectedEncarregadoId(team.encarregados[0].id)
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                  >
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">{f.nome.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{f.nome}</p>
                      {f.cargo && <p className="text-[10px] text-muted-foreground truncate">{f.cargo}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedEncarregadoId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-xs font-medium text-primary">
                {allEncarregados.find(e => e.id === selectedEncarregadoId)?.nome}
                <button onClick={() => setSelectedEncarregadoId(null)} className="hover:text-rose-500 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedTeamId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-xs font-medium text-primary">
                {equipes.find(eq => eq.id === selectedTeamId)?.nome}
                <button onClick={() => { setSelectedTeamId(null); setSelectedFuncId(null) }} className="hover:text-rose-500 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedFuncId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs font-medium text-emerald-500">
                {allFuncionarios.find(f => f.id === selectedFuncId)?.nome}
                <button onClick={() => setSelectedFuncId(null)} className="hover:text-rose-500 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>

          {(selectedEncarregadoId || selectedTeamId || selectedFuncId) && (
            <button
              onClick={() => { setSelectedEncarregadoId(null); setSelectedTeamId(null); setSelectedFuncId(null) }}
              className="ml-auto flex items-center gap-1 text-xs text-rose-500 hover:underline font-medium"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Bento Hub Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Operational Hero Bento Card */}
          <div className="lg:col-span-7 bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Efetivo Operacional</span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">Status de Presença do Dia</h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-foreground tracking-tight">{metrics?.currentYield || 0}%</span>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Taxa de Presença</p>
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="my-6 space-y-2">
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${stats?.presentes && stats?.totalRegistros ? Math.round((stats.presentes / stats.totalRegistros) * 100) : 0}%` }}
                  title="Presentes"
                />
                <div
                  className="bg-amber-500 transition-all duration-500"
                  style={{ width: `${stats?.pendentes && stats?.totalRegistros ? Math.round((stats.pendentes / stats.totalRegistros) * 100) : 0}%` }}
                  title="Pendentes"
                />
                <div
                  className="bg-rose-500 transition-all duration-500"
                  style={{ width: `${stats?.faltas && stats?.totalRegistros ? Math.round(((stats.faltas + stats.atestados) / stats.totalRegistros) * 100) : 0}%` }}
                  title="Ausentes"
                />
              </div>
            </div>

            {/* Status Counters Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-secondary/60 p-3 rounded-lg border border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Presentes</span>
                <p className="text-xl font-bold text-emerald-500 mt-0.5">{stats?.presentes || 0}</p>
              </div>
              <div className="bg-secondary/60 p-3 rounded-lg border border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Ausências</span>
                <p className="text-xl font-bold text-rose-500 mt-0.5">{(stats?.faltas || 0) + (stats?.atestados || 0)}</p>
              </div>
              <div className="bg-secondary/60 p-3 rounded-lg border border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Pendentes</span>
                <p className="text-xl font-bold text-amber-500 mt-0.5">{stats?.pendentes || 0}</p>
              </div>
              <div className="bg-secondary/60 p-3 rounded-lg border border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Ativos</span>
                <p className="text-xl font-bold text-foreground mt-0.5">{filteredFuncionarios.length}</p>
              </div>
            </div>
          </div>

          {/* Quick Action Matrix Bento Card */}
          <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <Link
                to="/frequencia"
                className="p-4 bg-secondary/70 hover:bg-secondary border border-border rounded-lg flex flex-col justify-between transition-all group"
              >
                <Clock className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase">Frequência</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Chamada em 1-toque</p>
                </div>
              </Link>

              <Link
                to="/escala"
                className="p-4 bg-secondary/70 hover:bg-secondary border border-border rounded-lg flex flex-col justify-between transition-all group"
              >
                <CalendarDays className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase">Escalas</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Localidades e turnos</p>
                </div>
              </Link>

              <Link
                to="/atestados"
                className="p-4 bg-secondary/70 hover:bg-secondary border border-border rounded-lg flex flex-col justify-between transition-all group"
              >
                <HeartPulse className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase">Atestados</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Licenças e médica</p>
                </div>
              </Link>

              <Link
                to="/frota"
                className="p-4 bg-secondary/70 hover:bg-secondary border border-border rounded-lg flex flex-col justify-between transition-all group"
              >
                <Activity className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase">Frota</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Veículos e rotas</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {dashboardTab === 'control' ? (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard 
            label="Presenças Reais" 
            value={stats?.presentes || 0} 
            icon={UserCheck} 
            color="text-emerald-500" 
            bg="bg-emerald-500/10" 
            description={`/ ${filteredFuncionarios.length}`}
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

        {/* Painel Geral de Monitoramento por Equipes */}
        <div className="mb-12 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight uppercase">Monitoramento Geral de Equipes</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Estatísticas e presença em tempo real por equipe cadastrada</p>
              </div>
            </div>
            {selectedTeamId && (
              <button 
                onClick={() => setSelectedTeamId(null)}
                className="px-4 py-2 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center gap-2 animate-pulse"
              >
                <X className="w-3.5 h-3.5" />
                Limpar Filtro de Equipe
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamStats.map((team) => {
              const isSelected = selectedTeamId === team.id
              return (
                <div 
                  key={team.id}
                  onClick={() => setSelectedTeamId(isSelected ? null : team.id)}
                  className={cn(
                    "bg-card/80 dark:bg-card/40 backdrop-blur-xl border rounded-[2.5rem] p-6 shadow-sm transition-all duration-500 group relative overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-[1.02]",
                    isSelected 
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                      : "border-border/50 hover:border-primary/40"
                  )}
                >
                  {/* Team Color Top Indicator */}
                  <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: team.cor }} />
                  
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5 mt-2">
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 animate-pulse" style={{ backgroundColor: team.cor }} />
                        {team.nome}
                      </h4>
                      {team.descricao && (
                        <p className="text-[9px] font-bold text-muted-foreground/50 line-clamp-1 italic">{team.descricao}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter border",
                        team.yieldRate >= 90 
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                          : team.yieldRate >= 75
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      )}>
                        {team.yieldRate}% Yield
                      </span>
                    </div>
                  </div>

                  {/* Encarregado info */}
                  <div className="bg-muted/20 border border-border/40 rounded-2xl p-3 mb-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest leading-none mb-1">Encarregado(s)</p>
                      <p className="text-[10px] font-black text-foreground truncate uppercase">
                        {team.encarregados.length > 0 
                          ? team.encarregados.map((e: any) => e.nome).join(', ') 
                          : 'Sem encarregado designado'}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar Distribution */}
                  <div className="space-y-2 mb-5">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-muted-foreground/50">
                      <span>Distribuição hoje</span>
                      <span>{team.total} Integrantes</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden flex p-0.5 border border-border/20">
                      {team.presentes > 0 && (
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ width: `${(team.presentes / team.total) * 100}%`, backgroundColor: presenteColor }}
                        />
                      )}
                      {team.faltas > 0 && (
                        <div 
                          className="h-full rounded-full transition-all duration-500 ml-0.5" 
                          style={{ width: `${(team.faltas / team.total) * 100}%`, backgroundColor: faltaColor }}
                        />
                      )}
                      {team.pendentes > 0 && (
                        <div 
                          className="h-full bg-slate-400 rounded-full transition-all duration-500 ml-0.5" 
                          style={{ width: `${(team.pendentes / team.total) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Exact Numbers */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/10 border border-border/20 rounded-2xl p-2 text-center">
                      <p className="text-[8px] font-black uppercase tracking-wider mb-0.5" style={{ color: presenteColor }}>Presentes</p>
                      <p className="text-xs font-black text-foreground">{team.presentes}</p>
                    </div>
                    <div className="bg-muted/10 border border-border/20 rounded-2xl p-2 text-center">
                      <p className="text-[8px] font-black uppercase tracking-wider mb-0.5" style={{ color: faltaColor }}>Ausentes</p>
                      <p className="text-xs font-black text-foreground">{team.faltas}</p>
                    </div>
                    <div className="bg-muted/10 border border-border/20 rounded-2xl p-2 text-center">
                      <p className="text-[8px] font-black uppercase text-amber-500 tracking-wider mb-0.5">Pendentes</p>
                      <p className="text-xs font-black text-foreground">{team.pendentes}</p>
                    </div>
                  </div>

                  {/* Action Link Footer */}
                  <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
                      {isSelected ? "Filtro Ativado" : "Clique para Filtrar"}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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
                  <BarChart data={planningData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }} barGap={6}>
                    <defs>
                      <linearGradient id="colorBarP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      </linearGradient>
                      <linearGradient id="colorBarA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.03)" />
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
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                    <Bar dataKey="mediaPresentes" name="Média Presenças" fill="url(#colorBarP)" radius={[10, 10, 0, 0]} barSize={24} />
                    <Bar dataKey="mediaAusentes" name="Média Ausências" fill="url(#colorBarA)" radius={[10, 10, 0, 0]} barSize={24} />
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
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/30 gap-2 shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-xl shadow-sm border border-border/50">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: presenteColor }} />
                  <span className="text-[9px] font-black uppercase text-foreground tracking-widest">Presenças</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-xl shadow-sm border border-border/50">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: faltaColor }} />
                  <span className="text-[9px] font-black uppercase text-foreground tracking-widest">Ausências</span>
                </div>
              </div>
            </div>
            
            <div className="h-80 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={presenteColor} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={presenteColor} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={faltaColor} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={faltaColor} stopOpacity={0}/>
                    </linearGradient>
                    <filter id="glowP" height="200%">
                      <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor={presenteColor} floodOpacity="0.25" />
                    </filter>
                    <filter id="glowF" height="200%">
                      <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor={faltaColor} floodOpacity="0.25" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.02)" />
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
                  <Area type="monotone" dataKey="presentes" name="Confirmados" stroke={presenteColor} strokeWidth={4} filter="url(#glowP)" fillOpacity={1} fill="url(#colorP)" />
                  <Area type="monotone" dataKey="faltas" name="Faltas/Atestados" stroke={faltaColor} strokeWidth={4} filter="url(#glowF)" fillOpacity={1} fill="url(#colorF)" />
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
                  <Pie data={pieData} innerRadius={68} outerRadius={95} paddingAngle={8} cornerRadius={6} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-3xl font-black text-foreground tracking-tighter leading-none">
                   {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                 </span>
                 <span className="text-[8px] font-black text-muted-foreground/40 tracking-widest uppercase mt-1">Colaboradores</span>
              </div>
            </div>

            <div className="space-y-2">
              {pieDataWithPercentages.slice(0, 4).map(d => (
                <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/30 hover:bg-muted/40 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-muted-foreground">{d.percentage}%</span>
                    <span className="text-xs font-black text-foreground">{d.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Intelligence: Sectors, Yield Timeline & Holidays */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-16">
          {/* Column 1: Active Sector Performance */}
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-8 shadow-sm transition-all hover:shadow-2xl flex flex-col justify-between">
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <h3 className="text-xs font-black uppercase text-foreground tracking-[0.22em]">Desempenho Setorial</h3>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Eficácia Média por Unidade de Negócio</p>
            </div>
            
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {sectorIntelligence.ranking.length > 0 ? sectorIntelligence.ranking.slice(0, 4).map((sector, i) => (
                <div key={sector.name} className="space-y-2 group">
                  <div className="flex justify-between items-end px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-primary/40">0{i+1}</span>
                      <span className="text-[11px] font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors truncate max-w-[120px]">{sector.name}</span>
                    </div>
                    <span className={cn("text-[11px] font-black", sector.score > 90 ? "text-emerald-500" : "text-primary")}>{sector.score}%</span>
                  </div>
                  <div className="w-full bg-muted/40 rounded-full h-3 overflow-hidden p-0.5 border border-border/30">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000", 
                        sector.score > 90 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary"
                      )}
                      style={{ width: `${sector.score}%` }}
                    />
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-muted-foreground italic text-xs uppercase tracking-widest opacity-40">Aguardando dados...</div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-border/30">
              <Link to="/rendimento" className="w-full py-2.5 flex items-center justify-center bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all text-center font-bold">
                Ver Painel Completo
              </Link>
            </div>
          </div>

          {/* Column 2: New High-Tech Yield Timeline LineChart */}
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-8 shadow-sm flex flex-col justify-between transition-all hover:shadow-2xl">
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                <h3 className="text-xs font-black uppercase text-foreground tracking-[0.22em]">Histórico de Rendimento</h3>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Evolução do Yield Operacional (7 Dias)</p>
            </div>
            
            <div className="h-44 w-full flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yieldTimelineData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <filter id="glowLine" height="200%">
                      <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="hsl(var(--primary))" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: 900 }} 
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-neutral-950/95 dark:bg-black/95 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-2xl animate-fadeIn">
                            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest border-b border-white/5 pb-2 mb-2">{label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Yield:</span>
                              <span className="text-xs font-black text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10 font-mono">
                                {payload[0].value}%
                              </span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="yield" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={4.5} 
                    filter="url(#glowLine)"
                    dot={{ r: 4, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                    activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 pt-3 border-t border-border/30 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground/75">
              <span>Média da Semana:</span>
              <span className="text-emerald-500 font-black">
                {yieldTimelineData.length > 0 
                  ? Math.round(yieldTimelineData.reduce((acc, curr) => acc + curr.yield, 0) / yieldTimelineData.length) 
                  : 0}%
              </span>
            </div>
          </div>

          {/* Column 3: Tactical Shortcuts & Upcoming Calendar */}
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[3rem] p-8 shadow-sm flex flex-col justify-between transition-all hover:shadow-2xl">
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <h3 className="text-xs font-black uppercase text-foreground tracking-[0.22em]">Calendário Tático</h3>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Próximos Feriados e Eventos de Escala</p>
            </div>
            
            <div className="space-y-3.5 flex-1 flex flex-col justify-center">
              {upcomingFeriados.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all group shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
                    <Umbrella className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground uppercase tracking-tight leading-tight truncate">{f.nome}</p>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                      <CalendarDays className="w-3 h-3" />
                      {format(parseISO(f.data), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-3 border-t border-border/30">
              <button 
                onClick={() => navigate('/configuracoes')}
                className="w-full py-2.5 bg-muted/20 hover:bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border/30 rounded-xl transition-all"
              >
                Configurar Feriados
              </button>
            </div>
          </div>
        </div>
      </>
    ) : (
      <div className="space-y-10 animate-fadeIn mb-12">
        {/* AI Simulation HUD Panel */}
        <div className="bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent dark:from-indigo-950/20 dark:via-indigo-950/5 dark:to-transparent backdrop-blur-2xl p-8 sm:p-10 rounded-[3rem] border border-indigo-500/25 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
            <div className="space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">Mecanismo de Previsão Operacional AI</p>
                </div>
                <h3 className="text-3xl font-black text-foreground tracking-tight uppercase leading-none">Simulador de Reforço Tático</h3>
                <p className="text-xs font-bold text-muted-foreground/80 mt-2 leading-relaxed">
                  Ajuste a meta de frequência operacional desejada para simular o contingente de colaboradores de reforço necessários para cobrir as ausências previstas com base nas médias históricas dos dias da semana.
                </p>
              </div>

              <div className="space-y-4 pt-6 border-t border-indigo-500/10">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <span>Meta de Frequência Desejada:</span>
                  <span className="text-indigo-500 text-lg font-mono font-black">{targetYieldPercent}%</span>
                </div>
                <input 
                  type="range" 
                  min="80" 
                  max="100" 
                  value={targetYieldPercent} 
                  onChange={(e) => setTargetYieldPercent(Number(e.target.value))}
                  className="w-full h-2 bg-indigo-500/20 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  <span>80% (Mínimo)</span>
                  <span>90% (Atenção)</span>
                  <span>95% (Ideal)</span>
                  <span>100% (Perfeito)</span>
                </div>
              </div>
            </div>

            <div className="bg-card/90 dark:bg-card/30 backdrop-blur-xl border border-border/50 p-8 rounded-[2.5rem] w-full lg:max-w-xs shrink-0 flex flex-col justify-between shadow-inner">
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-2 leading-none">Saturação de Escala</p>
                <h4 className={cn("text-2xl font-black uppercase tracking-tight", targetYieldPercent >= 95 ? "text-indigo-500 animate-pulse" : "text-emerald-500")}>
                  {targetYieldPercent >= 95 ? "Máxima Eficiência" : "Operação Segura"}
                </h4>
              </div>
              <div className="mt-6 pt-4 border-t border-border/30">
                <span className="block text-4xl font-black text-indigo-500 font-mono leading-none tracking-tighter mb-1.5">
                  {planningData.reduce((acc, d) => {
                    const expectedTotal = d.mediaPresentes + d.mediaAusentes
                    const reinforcement = Math.max(0, Math.round((targetYieldPercent / 100) * expectedTotal - d.mediaPresentes))
                    return acc + reinforcement
                  }, 0)}
                </span>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Reforços na Semana</span>
              </div>
            </div>
          </div>
        </div>

        {/* Demand heat table matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {planningData.map((d) => {
            const expectedTotal = d.mediaPresentes + d.mediaAusentes
            const currentRate = expectedTotal > 0 ? Math.round((d.mediaPresentes / expectedTotal) * 100) : 100
            const reinforcement = Math.max(0, Math.round((targetYieldPercent / 100) * expectedTotal - d.mediaPresentes))
            
            return (
              <div key={d.name} className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-border/30 pb-4 mb-4">
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1">Dia da Semana</p>
                    <h4 className="text-xl font-black text-foreground uppercase tracking-tight">{d.name}</h4>
                  </div>
                  <span className={cn(
                    "text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full border shadow-inner flex items-center justify-center gap-1.5",
                    reinforcement > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/25" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                  )}>
                    {reinforcement > 0 ? (
                      <>
                        <Zap className="w-3.5 h-3.5 animate-pulse text-amber-500" /> +{reinforcement} Reforços
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Estável
                      </>
                    )}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="block text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1.5">Frequência Histórica</span>
                    <div className="flex items-baseline gap-1.5 leading-none mb-2">
                      <span className="text-3xl font-black text-foreground font-mono">{currentRate}%</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Presentes</span>
                    </div>
                    <div className="w-full h-2.5 bg-muted/40 rounded-full overflow-hidden border border-border/10">
                      <div 
                        className={cn("h-full transition-all duration-500", currentRate >= 90 ? "bg-emerald-500" : currentRate >= 75 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${currentRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20 text-center">
                    <div>
                      <span className="block text-lg font-black text-foreground font-mono">{d.mediaPresentes}</span>
                      <span className="text-[7.5px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none">Presenças</span>
                    </div>
                    <div>
                      <span className="block text-lg font-black text-rose-500 font-mono">{d.mediaAusentes}</span>
                      <span className="text-[7.5px] font-black uppercase text-muted-foreground/50 tracking-widest leading-none">Ausências</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}

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
              { icon: Activity, title: "Atestados", desc: "Afastamentos e CID", color: "text-rose-500", bg: "bg-rose-500/10", path: "/atestados" },
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
