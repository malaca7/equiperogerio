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
  getDay,
  addDays
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
  Search,
  AlertTriangle,
  ArrowRight
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { useDashboardStats, useFrequenciaMensal, useFrequenciaPeriodo } from '../hooks/useFrequencia'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { today, currentMonth } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

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
    <div className="bg-card/40 backdrop-blur-md border border-border/15 rounded-3xl p-6 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-300 group relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-inner", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        {trend && (
          <div className="flex flex-col items-end">
            <div className={cn(
              "flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tight border",
              trend.isUp ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.value}%
            </div>
            <span className="text-[7.5px] font-black uppercase text-muted-foreground/60 mt-1">{trend.period}</span>
          </div>
        )}
      </div>
      
      <div className="mt-5">
        <p className="text-[8.5px] text-muted-foreground/60 font-black uppercase tracking-widest mb-1.5">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-3xl font-black text-foreground tracking-tight leading-none">{value}</p>
          {description && <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">{description}</span>}
        </div>
        {comparison && (
          <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-wide mt-3.5 flex items-center gap-1.5">
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
      <div className="bg-card/95 backdrop-blur-md border border-border/20 p-3.5 rounded-2xl shadow-xl text-[10px] font-bold">
        <p className="font-black uppercase text-muted-foreground/75 mb-2.5 tracking-wider pb-1 border-b border-border/20">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-md" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-muted-foreground">{p.name}:</span>
            </div>
            <span className="font-black text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function DashboardProducaoPage() {
  const navigate = useNavigate()
  const now = new Date()

  const { data: teamInfo } = useUserTeam()
  const { selectedTeamId, setSelectedTeamId } = useAuth()
  const [selectedEncarregadoId, setSelectedEncarregadoId] = useState<string | null>(null)
  const [selectedFuncId, setSelectedFuncId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'team_report' | 'weekly_analysis' | 'daily_chronicle'>('overview')

  const { data: allFuncionarios = [] } = useFuncionarios({ status: 'ativo' })

  const { data: equipes = [] } = useQuery<any[]>({
    queryKey: ['equipes-dashboard'],
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, profiles(id, nome)')
      const { data: mem = [] } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, apelido, cargo)')
      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles || (e as any).profile || (e as any).funcionarios).filter(Boolean),
        membros: (mem || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionarios).filter(Boolean),
      }))
    }
  })

  const userTeamNames = useMemo(() => {
    if (!teamInfo?.teamIds || teamInfo.teamIds.length === 0) return ''
    return equipes
      .filter(eq => teamInfo.teamIds.includes(eq.id))
      .map(eq => eq.nome)
      .join(', ')
  }, [equipes, teamInfo])

  const allowedFuncIds = useMemo(() => {
    if (teamInfo?.isRestricted) {
      if (selectedFuncId) return [selectedFuncId]
      return teamInfo.teamMemberIds || []
    }
    if (selectedFuncId) {
      return [selectedFuncId]
    }
    if (selectedEncarregadoId) {
      const teamsForEnc = equipes.filter(eq =>
        eq.encarregados.some((e: any) => e.id === selectedEncarregadoId)
      )
      const memberIds = teamsForEnc.flatMap(eq => eq.membros.map((m: any) => m.id))
      return Array.from(new Set(memberIds))
    }
    return undefined
  }, [selectedFuncId, selectedEncarregadoId, equipes, teamInfo])

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
    if (teamInfo?.isRestricted) {
      const allowedIds = teamInfo.teamMemberIds || []
      list = list.filter(f => allowedIds.includes(f.id))
    } else {
      if (selectedEncarregadoId) {
        const teamsForEnc = equipes.filter(eq =>
          eq.encarregados.some((e: any) => e.id === selectedEncarregadoId)
        )
        const memberIds = teamsForEnc.flatMap(eq => eq.membros.map((m: any) => m.id))
        list = list.filter(f => memberIds.includes(f.id))
      }
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [allFuncionarios, selectedEncarregadoId, equipes, teamInfo])

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
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])

  // Period Data
  const { data: currentMonthFreq = [], isLoading: loadMensal } = useFrequenciaMensal(currentMonthStr, allowedFuncIds)
  const lastMonthStr = format(subMonths(now, 1), 'yyyy-MM')
  const { data: lastMonthFreq = [] } = useFrequenciaMensal(lastMonthStr, allowedFuncIds)
  const { data: last7DaysFreq = [] } = useFrequenciaPeriodo(format(subDays(now, 6), 'yyyy-MM-dd'), currentDateStr, allowedFuncIds)

  // Load Scales for upcoming 7 days to calculate Staffing Forecast & Bottlenecks
  const next7DaysStr = useMemo(() => {
    return format(addDays(new Date(), 7), 'yyyy-MM-dd')
  }, [])
  const { data: escalasFuturas = [], isLoading: loadFuturas } = useEscalasPeriodo(currentDateStr, next7DaysStr)

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

  // Future Staffing Forecast for next 7 Days
  const futureForecast = useMemo(() => {
    const list: any[] = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(new Date(), i)
      const dayStr = format(day, 'yyyy-MM-dd')
      
      const dayScales = escalasFuturas.filter(e => {
        const isMatchedFunc = allowedFuncIds === undefined || allowedFuncIds.includes(e.funcionario_id)
        return e.data === dayStr && isMatchedFunc && (e.tipo === 'presente' || e.tipo === 'hora_extra')
      })
      
      list.push({
        name: format(day, 'dd/MM') + ' (' + format(day, 'eee', { locale: ptBR }) + ')',
        'Planejados': dayScales.length
      })
    }
    return list
  }, [escalasFuturas, allowedFuncIds])

  // Scale Bottlenecks / Understaffing Alerts
  const scaleBottlenecks = useMemo(() => {
    const sectorMinLimits: Record<string, number> = {
      'Varrição': 3,
      'Coleta': 2,
      'Capina': 2,
      'Roçada': 2,
    }

    const alerts: any[] = []
    // Look at next 3 days
    const next3Days = Array.from({ length: 3 }).map((_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd'))

    next3Days.forEach(dayStr => {
      const dayScales = escalasFuturas.filter(e => {
        const isMatchedFunc = allowedFuncIds === undefined || allowedFuncIds.includes(e.funcionario_id)
        return e.data === dayStr && isMatchedFunc && (e.tipo === 'presente' || e.tipo === 'hora_extra')
      })
      
      // Group by sector
      const sectorCounts: Record<string, number> = {}
      dayScales.forEach(e => {
        const sector = e.funcionarios?.setor || 'Geral'
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
      })

      // Compare counts against sector requirements
      Object.entries(sectorMinLimits).forEach(([sector, minLimit]) => {
        const count = sectorCounts[sector] || 0
        if (count < minLimit) {
          alerts.push({
            id: `${dayStr}-${sector}`,
            date: dayStr,
            formattedDate: format(parseISO(dayStr), 'dd/MM/yyyy'),
            setor: sector,
            count,
            minLimit,
            severity: count === 0 ? 'CRÍTICO' : 'ATENÇÃO'
          })
        }
      })
    })

    return alerts.sort((a, b) => a.date.localeCompare(b.date))
  }, [escalasFuturas, allowedFuncIds])

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
        'Média Presenças': totals[i].presentes / dayCount,
        'Média Ausências': totals[i].faltas / dayCount,
      }
    })
  }, [filteredCurrentMonthFreq])

  // Month days list for GitHub-like contributions grid
  const monthDaysList = useMemo(() => {
    try {
      const year = parseInt(currentMonthStr.split('-')[0])
      const month = parseInt(currentMonthStr.split('-')[1])
      const start = startOfMonth(new Date(year, month - 1, 1))
      const end = new Date() > endOfMonth(new Date(year, month - 1, 1)) 
        ? endOfMonth(new Date(year, month - 1, 1)) 
        : new Date()
      return eachDayOfInterval({ start, end })
    } catch {
      return []
    }
  }, [currentMonthStr])

  // General team averages
  const teamPerformanceAverages = useMemo(() => {
    if (!filteredFuncionarios.length) return { folgas: 0, atestados: 0, faltas: 0, presentes: 0, totalFolgas: 0, totalAtestados: 0, totalFaltas: 0, totalPresentes: 0 }
    
    let totalFolgas = 0
    let totalAtestados = 0
    let totalFaltas = 0
    let totalPresentes = 0

    filteredCurrentMonthFreq.forEach(f => {
      if (f.status === 'folga') totalFolgas++
      else if (f.status === 'atestado') totalAtestados++
      else if (f.status === 'falta') totalFaltas++
      else if (f.status === 'presente' || f.status === 'hora_extra') totalPresentes++
    })

    const count = filteredFuncionarios.length
    return {
      folgas: totalFolgas / count,
      atestados: totalAtestados / count,
      faltas: totalFaltas / count,
      presentes: totalPresentes / count,
      totalFolgas,
      totalAtestados,
      totalFaltas,
      totalPresentes
    }
  }, [filteredCurrentMonthFreq, filteredFuncionarios])

  // Individual employee statistics table
  const employeeStatsTable = useMemo(() => {
    const map = new Map<string, {
      id: string
      nome: string
      cargo: string
      setor: string
      presentes: number
      faltas: number
      atestados: number
      folgas: number
      ferias: number
      total: number
      daysMap: Record<string, string>
    }>()

    filteredFuncionarios.forEach(f => {
      map.set(f.id, {
        id: f.id,
        nome: f.nome,
        cargo: f.cargo || 'Membro',
        setor: f.setor || 'Geral',
        presentes: 0,
        faltas: 0,
        atestados: 0,
        folgas: 0,
        ferias: 0,
        total: 0,
        daysMap: {}
      })
    })

    filteredCurrentMonthFreq.forEach(f => {
      const emp = map.get(f.funcionario_id)
      if (emp) {
        emp.daysMap[f.data] = f.status
        if (f.status === 'presente' || f.status === 'hora_extra') emp.presentes++
        else if (f.status === 'falta') emp.faltas++
        else if (f.status === 'atestado') emp.atestados++
        else if (f.status === 'folga') emp.folgas++
        else if (f.status === 'ferias') emp.ferias++
        emp.total++
      }
    })

    return Array.from(map.values()).map(emp => {
      const scheduled = emp.presentes + emp.faltas + emp.atestados
      const presenceRate = scheduled > 0 ? Math.round((emp.presentes / scheduled) * 100) : 100
      return {
        ...emp,
        presenceRate
      }
    }).sort((a, b) => b.presenceRate - a.presenceRate)
  }, [filteredCurrentMonthFreq, filteredFuncionarios])

  // Workforce capacity by day of the week
  const forcaTrabalhoSemana = useMemo(() => {
    const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const totals: Record<number, { scheduled: number; presentes: number }> = {}
    for (let i = 0; i < 7; i++) {
      totals[i] = { scheduled: 0, presentes: 0 }
    }

    filteredCurrentMonthFreq.forEach(f => {
      const d = parseISO(f.data)
      const dayIdx = getDay(d)
      if (f.status === 'presente' || f.status === 'hora_extra') {
        totals[dayIdx].presentes++
        totals[dayIdx].scheduled++
      } else if (f.status === 'falta' || f.status === 'atestado') {
        totals[dayIdx].scheduled++
      }
    })

    return weekDays.map((name, i) => {
      const pct = totals[i].scheduled > 0 ? Math.round((totals[i].presentes / totals[i].scheduled) * 100) : 100
      return {
        name,
        porcentagem: pct,
        presentes: totals[i].presentes,
        agendados: totals[i].scheduled
      }
    })
  }, [filteredCurrentMonthFreq])

  // Day to day chronicle timeline
  const dayToDayTimeline = useMemo(() => {
    const dayMap = new Map<string, {
      data: string
      presentes: number
      faltas: number
      atestados: number
      folgas: number
      ferias: number
      total: number
    }>()

    filteredCurrentMonthFreq.forEach(f => {
      let dStats = dayMap.get(f.data)
      if (!dStats) {
        dStats = { data: f.data, presentes: 0, faltas: 0, atestados: 0, folgas: 0, ferias: 0, total: 0 }
        dayMap.set(f.data, dStats)
      }
      if (f.status === 'presente' || f.status === 'hora_extra') dStats.presentes++
      else if (f.status === 'falta') dStats.faltas++
      else if (f.status === 'atestado') dStats.atestados++
      else if (f.status === 'folga') dStats.folgas++
      else if (f.status === 'ferias') dStats.ferias++
      dStats.total++
    })

    return Array.from(dayMap.values()).map(day => {
      const active = day.presentes + day.faltas + day.atestados
      const attendanceRate = active > 0 ? Math.round((day.presentes / active) * 100) : 100
      return {
        ...day,
        attendanceRate
      }
    }).sort((a, b) => b.data.localeCompare(a.data))
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
        name: format(d, 'dd/MM'),
        'Presentes': dayFreq.filter(f => f.status === 'presente').length,
        'Ausentes': dayFreq.filter(f => f.status === 'falta' || f.status === 'atestado').length
      }
    })
  }, [filteredLast7DaysFreq])

  const pieData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Presentes', value: stats.presentes, color: '#10b981' }, 
      { name: 'Ausentes', value: stats.faltas + stats.atestados, color: '#f43f5e' },
      { name: 'Folgas', value: stats.folgas, color: '#3b82f6' },
      { name: 'Férias', value: stats.ferias, color: '#8b5cf6' },
      { name: 'Pendentes', value: stats.pendentes, color: '#f59e0b' },
    ].filter(d => d.value > 0)
  }, [stats])

  const isLoading = loadStats || loadMensal || loadFuturas

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Dashboard de Produção" />
        <div className="pt-32 pb-20">
          <Loading text="Compilando painel de inteligência operacional..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Dashboard de Produção" subtitle="Monitoramento Estratégico de Prontidão e Efetivo" />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-32">
        
        {/* ── Compact Filter Bar ── */}
        <div className="bg-card/45 backdrop-blur-md border border-border/20 rounded-2xl px-4 py-2.5 mb-8 shadow-sm flex flex-wrap items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Filter className="w-4 h-4" />
          </div>

          {!teamInfo?.isRestricted ? (
            <>
              {/* Encarregado select */}
              <div className="relative">
                <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 pointer-events-none" />
                <select
                  value={selectedEncarregadoId || ''}
                  onChange={(e) => {
                    const val = e.target.value || null
                    setSelectedEncarregadoId(val)
                    setSelectedTeamId(null)
                    setSelectedFuncId(null)
                  }}
                  className="pl-7.5 pr-6 py-1.5 bg-muted/20 border border-border/20 focus:border-primary/50 rounded-xl text-[10px] font-black uppercase tracking-wider text-foreground outline-none transition-all appearance-none cursor-pointer min-w-[150px]"
                >
                  <option value="">Todos Encarregados</option>
                  {allEncarregados.map((enc) => (
                    <option key={enc.id} value={enc.id}>{enc.nome}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 text-muted-foreground/50 pointer-events-none" />
              </div>

              {/* Equipe select */}
              <div className="relative">
                <Shapes className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
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
                  className="pl-7.5 pr-6 py-1.5 bg-muted/20 border border-border/20 focus:border-primary/50 rounded-xl text-[10px] font-black uppercase tracking-wider text-foreground outline-none transition-all appearance-none cursor-pointer min-w-[150px]"
                >
                  <option value="">Todas as Equipes</option>
                  {filteredEquipesForSelect.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 text-muted-foreground/50 pointer-events-none" />
              </div>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10.5px] font-black text-primary uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              {userTeamNames || 'Sua Equipe'}
            </span>
          )}

          {/* Busca colaborador */}
          <div className="relative flex-1 min-w-[180px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/20 border border-border/20 focus:border-primary/50 rounded-xl text-[10px] font-bold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
            />
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/30 rounded-xl shadow-xl z-50 overflow-hidden backdrop-blur-xl">
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors border-b border-border/25 last:border-0"
                  >
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{f.nome.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate">{f.nome}</p>
                      {f.cargo && <p className="text-[9px] text-muted-foreground uppercase truncate">{f.cargo}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clean filters button */}
          {(selectedEncarregadoId || selectedTeamId || selectedFuncId) && (
            <button
              onClick={() => { setSelectedEncarregadoId(null); setSelectedTeamId(null); setSelectedFuncId(null) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-wider rounded-xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95 cursor-pointer ml-auto"
            >
              <X className="w-3 h-3" /> Limpar Filtros
            </button>
          )}
        </div>

        {/* ── Main Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard 
            label="Presenças Hoje" 
            value={stats?.presentes || 0} 
            icon={UserCheck} 
            color="text-emerald-500" 
            bg="bg-emerald-500/10" 
            description={`/ ${filteredFuncionarios.length}`}
            trend={metrics?.presenceTrend ? { ...metrics.presenceTrend, period: 'vs Ontem' } : undefined}
            comparison="Registros confirmados na chamada"
          />
          <StatCard 
            label="Ausências Hoje" 
            value={(stats?.faltas || 0) + (stats?.atestados || 0)} 
            icon={UserX} 
            color="text-rose-500" 
            bg="bg-rose-500/10" 
            trend={metrics?.absenceTrend ? { ...metrics.absenceTrend, period: 'vs Ontem' } : undefined}
            comparison={`${stats?.faltas || 0} Faltas | ${stats?.atestados || 0} Atestados`}
          />
          <StatCard 
            label="Pendentes Hoje" 
            value={stats?.pendentes || 0} 
            icon={Clock} 
            color="text-amber-500" 
            bg="bg-amber-500/10" 
            comparison="Escalados sem registro de chamada"
          />
          <StatCard 
            label="Eficácia Operacional" 
            value={`${metrics?.currentYield}%`} 
            icon={Award} 
            color="text-primary" 
            bg="bg-primary/10" 
            trend={metrics?.yieldTrend ? { ...metrics.yieldTrend, period: 'vs Mês Ant.' } : undefined}
            comparison={`Mês anterior: ${metrics?.prevYield}%`}
          />
        </div>

        {/* Floating Pill Tabs */}
        <div className="flex bg-card/25 border border-border/20 p-1.5 rounded-2xl mb-8 w-fit max-w-full overflow-x-auto scrollbar-none shadow-sm">
          {[
            { id: 'overview', label: 'Painel Geral', icon: LayoutGrid },
            { id: 'team_report', label: 'Dossiê da Equipe', icon: Users },
            { id: 'weekly_analysis', label: 'Análise de Sazonalidade', icon: BarChartIcon },
            { id: 'daily_chronicle', label: 'Diário de Presença', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95",
                  isActive
                    ? "bg-card text-primary shadow-sm border border-border/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/15"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab contents */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Grid 1: Staffing Forecast & Bottlenecks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Forecast (2/3 width) */}
              <div className="lg:col-span-2 bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <TrendingUp className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-foreground tracking-widest leading-none mb-1">Previsão de Efetivo Planejado</h3>
                    <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">Programação operacional para os próximos 7 dias</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={futureForecast} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPlanejados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                      <XAxis dataKey="name" fontSize={8} fontWeight="bold" stroke="rgba(128,128,128,0.5)" tickLine={false} />
                      <YAxis fontSize={8} fontWeight="bold" stroke="rgba(128,128,128,0.5)" tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Planejados" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPlanejados)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Scale Bottlenecks alerts (1/3 width) */}
              <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                      <AlertTriangle className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-foreground tracking-widest leading-none mb-1">Gargalos de Escala</h3>
                      <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">Sinalizadores de déficit de efetivo</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[170px] overflow-y-auto scrollbar-none pr-1">
                    {scaleBottlenecks.length > 0 ? scaleBottlenecks.map((alert) => (
                      <div key={alert.id} className="p-3 bg-rose-500/[0.02] border border-rose-500/10 rounded-2xl flex items-start gap-2.5">
                        <span className={cn(
                          "text-[7px] font-black uppercase px-2 py-0.5 rounded-md mt-0.5 shrink-0",
                          alert.severity === 'CRÍTICO' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {alert.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-foreground uppercase truncate leading-snug">{alert.setor}</p>
                          <p className="text-[8.5px] font-bold text-muted-foreground mt-0.5 leading-snug">
                            {alert.formattedDate} &bull; Efetivo: <strong className="text-foreground">{alert.count}</strong> (mín. {alert.minLimit})
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className="py-10 text-center flex flex-col items-center justify-center opacity-60">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                        <p className="text-xs font-black text-emerald-600 uppercase">Efetivo Completo</p>
                        <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Nenhum gargalo de escala detectado</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[7.5px] font-black text-muted-foreground/45 border-t border-border/10 pt-4 uppercase tracking-widest leading-none mt-4">
                  * Mínimos: Varrição (3), Coleta (2), Outros (2).
                </div>
              </div>

            </div>

            {/* Grid 2: Distribution and Sector Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Force Distribution Pie (1/3 width) */}
              <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <PieIcon className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-foreground tracking-widest leading-none mb-1">Composição de Força</h3>
                      <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">Distribuição do efetivo hoje</p>
                    </div>
                  </div>

                  <div className="h-44 relative flex items-center justify-center mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={48} outerRadius={68} paddingAngle={8} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[14px] font-black text-foreground">{stats?.presentes || 0}</span>
                      <span className="text-[7px] font-black text-muted-foreground/50 tracking-widest uppercase mt-0.5">Presentes</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border/10 pt-4.5">
                  {pieData.slice(0, 4).map(d => (
                    <div key={d.name} className="flex items-center justify-between p-2 rounded-xl bg-muted/15 border border-border/20 text-[9px] font-bold">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-md" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground uppercase tracking-wider">{d.name}</span>
                      </div>
                      <span className="font-black text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Performance (2/3 width) */}
              <div className="lg:col-span-2 bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                      <BarChartIcon className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-foreground tracking-widest leading-none mb-1">Eficácia por Setor</h3>
                      <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">Média acumulada de presença no mês</p>
                    </div>
                  </div>
                  <Link to="/rendimento" className="px-4 py-2 bg-primary/10 text-primary text-[8.5px] font-black uppercase tracking-widest rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">Ver Detalhes</Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                  {sectorIntelligence.ranking.length > 0 ? sectorIntelligence.ranking.slice(0, 6).map((sector, i) => (
                    <div key={sector.name} className="space-y-2.5">
                      <div className="flex justify-between items-end text-[10px] font-black">
                        <div className="flex items-center gap-2">
                          <span className="text-primary/45">0{i+1}</span>
                          <span className="text-foreground uppercase tracking-wider">{sector.name}</span>
                        </div>
                        <span className={cn(sector.score > 90 ? "text-emerald-500" : "text-primary")}>{sector.score}%</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-3 overflow-hidden p-0.5 border border-border/15">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-700", 
                            sector.score > 90 ? "bg-emerald-500" : "bg-primary"
                          )}
                          style={{ width: `${sector.score}%` }}
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-2 py-10 text-center text-muted-foreground font-black text-[9px] uppercase tracking-widest opacity-40">Aguardando chamada...</div>
                  )}
                </div>
              </div>

            </div>

            {/* Grid 3: Real-Time Flow Chart */}
            <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Activity className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-foreground tracking-widest leading-none mb-1">Histórico de Prontidão (Últimos 7 dias)</h3>
                    <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-0.5">Fluxo diário de presença e faltas no campo</p>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPresentes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAusentes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="name" fontSize={8} fontWeight="bold" stroke="rgba(128,128,128,0.5)" tickLine={false} />
                    <YAxis fontSize={8} fontWeight="bold" stroke="rgba(128,128,128,0.5)" tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 'bold', paddingTop: 10 }} />
                    <Area type="monotone" dataKey="Presentes" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPresentes)" />
                    <Area type="monotone" dataKey="Ausentes" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorAusentes)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: DOSSIÊ DA EQUIPE ===================== */}
        {activeTab === 'team_report' && (
          <div className="space-y-6 animate-fade-in">
            {/* Cyberpunk Averages Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Média de Presenças', value: `${teamPerformanceAverages.presentes.toFixed(1)}d`, desc: 'Dias trabalhados por membro', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Média de Folgas', value: `${teamPerformanceAverages.folgas.toFixed(1)}d`, desc: 'Repousos usufruídos no mês', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Média de Atestados', value: `${teamPerformanceAverages.atestados.toFixed(1)}d`, desc: 'Afastamentos de saúde registrados', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Média de Faltas', value: `${teamPerformanceAverages.faltas.toFixed(1)}d`, desc: 'Faltas não justificadas detectadas', icon: UserX, color: 'text-rose-500', bg: 'bg-rose-500/10' },
              ].map((avg, i) => {
                const Icon = avg.icon
                return (
                  <div key={i} className="bg-card/30 border border-border/20 rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px]">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/20 bg-background/50")}>
                        <Icon className={cn("w-5.5 h-5.5", avg.color)} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1.5">{avg.label}</p>
                        <p className="text-xl font-black text-foreground leading-none">{avg.value}</p>
                      </div>
                    </div>
                    <p className="text-[8px] font-semibold text-muted-foreground/50 mt-3.5 uppercase tracking-wider">{avg.desc}</p>
                  </div>
                )
              })}
            </div>

            {/* Detailed Dossier Table Container */}
            <div className="bg-card/30 border border-border/20 p-4 md:p-6 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    Dossiê de Frequência da Equipe
                  </h3>
                  <p className="text-[8.5px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-1">Grade individual de presença e mapa mensal de calor</p>
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-2.5 p-2 bg-muted/20 border border-border/20 rounded-xl">
                  {[
                    { color: 'bg-emerald-500', label: 'Pres.' },
                    { color: 'bg-blue-500', label: 'Folg.' },
                    { color: 'bg-amber-500', label: 'Atest.' },
                    { color: 'bg-rose-500', label: 'Falta' },
                    { color: 'bg-purple-500', label: 'Férias' },
                  ].map(leg => (
                    <div key={leg.label} className="flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider text-muted-foreground">
                      <span className={cn("w-2 h-2 rounded", leg.color)} />
                      {leg.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/20 text-[8.5px] font-black uppercase tracking-widest text-muted-foreground/60">
                      <th className="pb-3 pl-2">Colaborador</th>
                      <th className="pb-3">Setor / Cargo</th>
                      <th className="pb-3 text-center">Aderência</th>
                      <th className="pb-3 text-center">Presenças</th>
                      <th className="pb-3 text-center">Folgas</th>
                      <th className="pb-3 text-center">Atestados</th>
                      <th className="pb-3 text-center">Faltas</th>
                      <th className="pb-3 pl-6">Mapa Mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 text-xs">
                    {employeeStatsTable.map(emp => (
                      <tr key={emp.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="py-3.5 pl-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center font-black text-xs text-emerald-500 border border-emerald-500/20">
                              {emp.nome.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-foreground uppercase">{emp.nome}</p>
                              <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">ID: {emp.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div>
                            <p className="font-black text-foreground/90 uppercase text-[9.5px]">{emp.setor}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest">{emp.cargo}</p>
                          </div>
                        </td>
                        <td className="py-3.5 text-center">
                          <span className={cn(
                            "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black border",
                            emp.presenceRate >= 90 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : emp.presenceRate >= 75
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          )}>
                            {emp.presenceRate}%
                          </span>
                        </td>
                        <td className="py-3.5 text-center font-bold text-foreground/85">{emp.presentes}d</td>
                        <td className="py-3.5 text-center font-bold text-blue-500/90">{emp.folgas}d</td>
                        <td className="py-3.5 text-center font-bold text-amber-500/90">{emp.atestados}d</td>
                        <td className="py-3.5 text-center font-bold text-rose-500/90">{emp.faltas}d</td>
                        <td className="py-3.5 pl-6">
                          <div className="flex gap-1 items-center">
                            {monthDaysList.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd')
                              const status = emp.daysMap[dateStr]
                              let colorClass = 'bg-muted/30 border border-border/20'
                              if (status === 'presente' || status === 'hora_extra') colorClass = 'bg-emerald-500'
                              else if (status === 'falta') colorClass = 'bg-rose-500'
                              else if (status === 'atestado') colorClass = 'bg-amber-500'
                              else if (status === 'folga') colorClass = 'bg-blue-500'
                              else if (status === 'ferias') colorClass = 'bg-purple-500'

                              return (
                                <div
                                  key={dateStr}
                                  className={cn("w-3 h-3 rounded transition-all hover:scale-125 cursor-help", colorClass)}
                                  title={`${format(day, 'dd/MM')}`}
                                />
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Card List */}
              <div className="block md:hidden space-y-3">
                {employeeStatsTable.map(emp => (
                  <div key={emp.id} className="bg-muted/15 border border-border/20 rounded-2xl p-4 space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center font-black text-xs text-emerald-500 border border-emerald-500/20">
                          {emp.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-foreground uppercase text-xs">{emp.nome}</p>
                          <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest">{emp.setor} • {emp.cargo}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black border",
                        emp.presenceRate >= 90 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        emp.presenceRate >= 75 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      )}>
                        {emp.presenceRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold bg-muted/40 p-2.5 rounded-xl border border-border/25">
                      <div>
                        <p className="text-foreground font-black">{emp.presentes}d</p>
                        <p className="text-[7.5px] text-muted-foreground/50 uppercase mt-0.5">Pres.</p>
                      </div>
                      <div>
                        <p className="text-blue-500 font-black">{emp.folgas}d</p>
                        <p className="text-[7.5px] text-muted-foreground/50 uppercase mt-0.5">Folgas</p>
                      </div>
                      <div>
                        <p className="text-amber-500 font-black">{emp.atestados}d</p>
                        <p className="text-[7.5px] text-muted-foreground/50 uppercase mt-0.5">Atest.</p>
                      </div>
                      <div>
                        <p className="text-rose-500 font-black">{emp.faltas}d</p>
                        <p className="text-[7.5px] text-muted-foreground/50 uppercase mt-0.5">Faltas</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[7.5px] font-black uppercase tracking-wider text-muted-foreground/45">Frequência Mensal</p>
                      <div className="flex gap-1 overflow-x-auto py-1 scrollbar-none">
                        {monthDaysList.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd')
                          const status = emp.daysMap[dateStr]
                          let colorClass = 'bg-muted/30 border border-border/20'
                          if (status === 'presente' || status === 'hora_extra') colorClass = 'bg-emerald-500'
                          else if (status === 'falta') colorClass = 'bg-rose-500'
                          else if (status === 'atestado') colorClass = 'bg-amber-500'
                          else if (status === 'folga') colorClass = 'bg-blue-500'
                          else if (status === 'ferias') colorClass = 'bg-purple-500'

                          return (
                            <div
                              key={dateStr}
                              className={cn("w-3 h-3 rounded-sm shrink-0 border border-border/10", colorClass)}
                              title={`${format(day, 'dd/MM')}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: WEEKLY CAPACITY ANALYSIS ===================== */}
        {activeTab === 'weekly_analysis' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Radar Chart */}
              <div className="bg-card/30 backdrop-blur-md border border-border/20 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <Compass className="w-5 h-5 text-indigo-500" />
                    Radar de Capacidade Semanal
                  </h3>
                  <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Percentual médio de prontidão em cada dia da semana</p>
                </div>
                
                <div className="h-64 my-6 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={forcaTrabalhoSemana}>
                      <PolarGrid stroke="rgba(128, 128, 128, 0.15)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(128, 128, 128, 0.65)', fontSize: 9, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'rgba(128, 128, 128, 0.4)', fontSize: 8 }} />
                      <Radar name="Prontidão" dataKey="porcentagem" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[8px] font-black text-muted-foreground/45 border-t border-border/10 pt-4 uppercase tracking-wider">
                  Útil para identificar dias com picos de ausências e planejar escalas de folga redundantes.
                </div>
              </div>

              {/* Bar Chart comparing Presentes/Ausentes */}
              <div className="lg:col-span-2 bg-card/30 backdrop-blur-md border border-border/20 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <BarChartIcon className="w-5 h-5 text-amber-500" />
                    Volume de Presença por Dia da Semana
                  </h3>
                  <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Registros totais acumulados de chamadas no mês</p>
                </div>

                <div className="h-64 my-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forcaTrabalhoSemana} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(128,128,128,0.5)', fontSize: 9, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(128,128,128,0.5)', fontSize: 9, fontWeight: 'bold' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="presentes" name="Dias Trabalhados" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                      <Bar dataKey="agendados" name="Total Escalado" fill="rgba(16, 185, 129, 0.25)" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[8px] font-black text-muted-foreground/45 border-t border-border/10 pt-4 flex justify-between items-center uppercase tracking-wider">
                  <span>Capacidade total planejada vs presenças efetivas.</span>
                  <span className="text-primary">Meta de Aderência: &gt; 95%</span>
                </div>
              </div>
            </div>

            {/* Diagnostic analysis list cards */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-foreground tracking-widest px-2">Diagnóstico de Aderência Semanal</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {forcaTrabalhoSemana.map((dia) => {
                  let badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  let assessment = 'Fluxo Estável'
                  if (dia.porcentagem < 85) {
                    badgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    assessment = 'Queda Crítica'
                  } else if (dia.porcentagem < 95) {
                    badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    assessment = 'Requer Atenção'
                  }

                  return (
                    <div key={dia.name} className="bg-card/30 border border-border/20 p-4.5 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-black text-foreground uppercase">{dia.name}</p>
                          <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider", badgeColor)}>
                            {dia.porcentagem}%
                          </span>
                        </div>
                        <p className="text-[7.5px] font-black uppercase text-muted-foreground/40 mt-1 tracking-widest leading-none">{assessment}</p>
                      </div>

                      <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/20 text-[9px] font-bold">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Presentes</span>
                          <span className="text-foreground font-black">{dia.presentes}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Agendados</span>
                          <span className="text-foreground font-black">{dia.agendados}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: DAILY CHRONICLE ===================== */}
        {activeTab === 'daily_chronicle' && (
          <div className="space-y-6 animate-fade-in">
            {/* Timeline container */}
            <div className="bg-card/30 border border-border/20 p-4 md:p-6 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="mb-6">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-500" />
                  Diário de Presença & Frequência
                </h3>
                <p className="text-[8.5px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-1">Registros diários cronológicos das chamadas do mês</p>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/20 text-[8.5px] font-black uppercase tracking-widest text-muted-foreground/60">
                      <th className="pb-3 pl-2">Dia da Chamada</th>
                      <th className="pb-3 text-center">Presenças</th>
                      <th className="pb-3 text-center">Faltas</th>
                      <th className="pb-3 text-center">Atestados</th>
                      <th className="pb-3 text-center">Folgas</th>
                      <th className="pb-3 text-center">Férias</th>
                      <th className="pb-3 text-center">Prontidão</th>
                      <th className="pb-3 text-right pr-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 text-xs">
                    {dayToDayTimeline.map(day => (
                      <tr key={day.data} className="hover:bg-muted/10 transition-colors group">
                        <td className="py-3.5 pl-2 font-black text-foreground uppercase">
                          {format(parseISO(day.data), "dd/MM/yyyy - EEEE", { locale: ptBR })}
                        </td>
                        <td className="py-3.5 text-center font-bold text-emerald-500">{day.presentes}</td>
                        <td className="py-3.5 text-center font-bold text-rose-500">{day.faltas}</td>
                        <td className="py-3.5 text-center font-bold text-amber-500">{day.atestados}</td>
                        <td className="py-3.5 text-center font-bold text-blue-500">{day.folgas}</td>
                        <td className="py-3.5 text-center font-bold text-purple-500">{day.ferias}</td>
                        <td className="py-3.5 text-center">
                          <span className={cn(
                            "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black border",
                            day.attendanceRate >= 95 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : day.attendanceRate >= 85
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          )}>
                            {day.attendanceRate}%
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <button
                            onClick={() => navigate(`/frequencia?date=${day.data}`)}
                            className="px-3 py-1.5 bg-primary/10 text-primary text-[8.5px] font-black uppercase tracking-wider rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all cursor-pointer"
                          >
                            Editar Chamada
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3">
                {dayToDayTimeline.map(day => (
                  <div key={day.data} className="bg-muted/15 border border-border/20 rounded-2xl p-4 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="font-black text-foreground uppercase text-xs">
                        {format(parseISO(day.data), "dd/MM/yyyy - EEEE", { locale: ptBR })}
                      </p>
                      <span className={cn(
                        "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black border",
                        day.attendanceRate >= 95 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        day.attendanceRate >= 85 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      )}>
                        {day.attendanceRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[9px] font-black">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl">
                        <p className="text-emerald-500">{day.presentes}</p>
                        <p className="text-[7px] text-muted-foreground/60 uppercase mt-0.5">Pres.</p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
                        <p className="text-rose-500">{day.faltas}</p>
                        <p className="text-[7px] text-muted-foreground/60 uppercase mt-0.5">Faltas</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
                        <p className="text-amber-500">{day.atestados}</p>
                        <p className="text-[7px] text-muted-foreground/60 uppercase mt-0.5">Atest.</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl">
                        <p className="text-blue-500">{day.folgas}</p>
                        <p className="text-[7px] text-muted-foreground/60 uppercase mt-0.5">Folg.</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-xl">
                        <p className="text-purple-500">{day.ferias}</p>
                        <p className="text-[7px] text-muted-foreground/60 uppercase mt-0.5">Férias</p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/frequencia?date=${day.data}`)}
                      className="w-full py-2.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all cursor-pointer active:scale-95 text-center"
                    >
                      Editar Chamada
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
