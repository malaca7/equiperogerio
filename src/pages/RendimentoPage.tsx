import React, { useState, useMemo, useRef } from 'react'
import { 
  TrendingDown, 
  TrendingUp,
  Calendar, 
  Filter,
  ChevronRight,
  Search,
  AlertTriangle,
  UserX,
  Stethoscope,
  Activity,
  Target,
  LayoutGrid,
  ShieldAlert,
  Frown,
  Siren,
  Share2,
  Download,
  CheckCircle2,
  User,
  ClipboardList,
  HeartPulse,
  Pill,
  FileText,
  Clock,
  Users,
  Repeat,
  Ban,
  Flame,
  Award,
  BarChart3,
  ListTodo
} from 'lucide-react'

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isPast, isToday, parseISO, subMonths, differenceInDays, subDays } from 'date-fns'
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
  Legend,
  CartesianGrid
} from 'recharts'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Loading } from '../components/ui/Loading'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { currentMonth } from '../lib/utils'
import { DEFAULT_TIPOS_ESCALA } from './admin/AdminDashboard'

const getDayStyle = (tipoId: string, tiposEscala: any[]) => {
  const scaleType = tiposEscala.find((t: any) => t.id === tipoId)
  if (!scaleType) {
    return {
      className: "bg-muted/15 border-border/40 text-muted-foreground/40",
      style: {},
      statusText: "Sem escala",
      letra: ""
    }
  }
  
  const isTrabalho = tipoId === 'presente' || tipoId === 'hora_extra'
  
  return {
    className: cn(
      "font-black border transition-all duration-300 shadow-sm",
      scaleType.bg || "bg-muted/20",
      scaleType.text || "text-foreground",
      isTrabalho 
        ? "ring-2 ring-blue-400 dark:ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)] scale-105 border-blue-300 dark:border-blue-600 font-extrabold" 
        : "border-transparent"
    ),
    style: {},
    statusText: scaleType.nome,
    letra: scaleType.letra || ""
  }
}

const CustomTooltip = ({ active, payload, label, suffix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-md border border-border/40 p-3.5 rounded-2xl shadow-xl text-[10px] font-bold text-foreground">
        <p className="uppercase tracking-widest text-muted-foreground mb-2 pb-1 border-b border-border/30">{label}</p>
        <div className="space-y-1.5">
          {payload.map((pld: any) => (
            <div key={pld.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: pld.fill || pld.color }} />
              <span className="text-muted-foreground">{pld.name}:</span>
              <span className="font-black text-foreground">{pld.value}{suffix}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function RendimentoPage() {
  const { data: teamInfo } = useUserTeam()
  
  // Custom Date Period Filters
  const [dateRangeType, setDateRangeType] = useState<'month' | 'last7' | 'last30' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSetor, setSelectedSetor] = useState('Todos')
  const [selectedFunc, setSelectedFunc] = useState<any>(null)
  const [modalTab, setModalTab] = useState<'metrics' | 'personal'>('metrics')
  const [activeTab, setActiveTab] = useState<'geral' | 'colaboradores' | 'atestados'>('geral')
  
  const modalRef = useRef<HTMLDivElement>(null)
  const shareSquareRef = useRef<HTMLDivElement>(null)

  // Compute actual start and end dates based on range selection
  const range = useMemo(() => {
    const todayVal = new Date()
    const todayStr = format(todayVal, 'yyyy-MM-dd')
    
    if (dateRangeType === 'last7') {
      const start = format(subDays(todayVal, 7), 'yyyy-MM-dd')
      return { start, end: todayStr }
    }
    if (dateRangeType === 'last30') {
      const start = format(subDays(todayVal, 30), 'yyyy-MM-dd')
      return { start, end: todayStr }
    }
    if (dateRangeType === 'custom') {
      return { start: customStartDate, end: customEndDate }
    }
    // Default: month
    const monthStart = selectedMonth + '-01'
    const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd')
    return { start: monthStart, end: monthEnd }
  }, [dateRangeType, selectedMonth, customStartDate, customEndDate])

  // Load scales using range filter
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(range.start, range.end)

  const handleShare = async () => {
    if (!shareSquareRef.current) return
    const isDark = document.documentElement.classList.contains('dark')
    try {
      shareSquareRef.current.classList.add('no-shadows')
      const { toPng } = await import('html-to-image')
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const renderOptions = {
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
        pixelRatio: isMobile ? 1 : 2,
        width: 800,
        height: 800,
        skipFonts: true,
        cacheBust: true
      }

      let dataUrl = ''
      try {
        if (isMobile) {
          try { await toPng(shareSquareRef.current, { ...renderOptions, pixelRatio: 1 }) } catch (_) {}
        }
        dataUrl = await toPng(shareSquareRef.current, renderOptions)
      } catch (firstErr) {
        console.warn('First render failed, retrying with pixelRatio 1...', firstErr)
        dataUrl = await toPng(shareSquareRef.current, {
          ...renderOptions,
          pixelRatio: 1,
          width: undefined,
          height: undefined
        })
      }
      
      shareSquareRef.current.classList.remove('no-shadows')
      
      const byteString = atob(dataUrl.split(',')[1])
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })
      const file = new File([blob], `rendimento-${selectedFunc?.nome}.png`, { type: 'image/png' })
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Rendimento - ${selectedFunc?.nome}`,
            files: [file]
          })
          return
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return
          console.error('Erro no navigator.share:', shareErr)
        }
      }
      
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          alert('Imagem copiada para a área de transferência! Cole (Ctrl+V) onde desejar enviar (ex: WhatsApp Web).')
          return
        } catch (clipErr) {
          console.error('Erro ao copiar para clipboard', clipErr)
        }
      }
      
      alert('Seu navegador atual não suporta o compartilhamento direto de imagens. Tente baixar ou acessar por outro navegador.')
    } catch (err) {
      if (shareSquareRef.current) {
        shareSquareRef.current.classList.remove('no-shadows')
      }
      console.error('Failed to share image', err)
      alert('Erro ao gerar a imagem para compartilhamento.')
    }
  }

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: setores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: dbTiposEscala } = useConfiguracao<any[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const { data: atestadosRecords = [] } = useConfiguracao<any[]>('atestados_records', [])
  const { data: advertenciasRecords = [] } = useConfiguracao<any[]>('advertencias_records', [])
  const { data: suspensoesRecords = [] } = useConfiguracao<any[]>('suspensoes_records', [])
  
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

  // Indexes for records within selected range
  const atestadosByFunc = useMemo(() => {
    if (!Array.isArray(atestadosRecords)) return {} as Record<string, any[]>
    const map: Record<string, any[]> = {}
    atestadosRecords.forEach((rec: any) => {
      if (!rec.funcionario_id || !rec.data_inicio || !rec.data_fim) return
      if (rec.data_fim < range.start || rec.data_inicio > range.end) return
      if (!map[rec.funcionario_id]) map[rec.funcionario_id] = []
      map[rec.funcionario_id].push(rec)
    })
    return map
  }, [atestadosRecords, range])

  const advertenciasByFunc = useMemo(() => {
    if (!Array.isArray(advertenciasRecords)) return {} as Record<string, any[]>
    const map: Record<string, any[]> = {}
    advertenciasRecords.forEach((rec: any) => {
      if (!rec.funcionario_id || !rec.data) return
      if (rec.data < range.start || rec.data > range.end) return
      if (!map[rec.funcionario_id]) map[rec.funcionario_id] = []
      map[rec.funcionario_id].push(rec)
    })
    return map
  }, [advertenciasRecords, range])

  const suspensoesByFunc = useMemo(() => {
    if (!Array.isArray(suspensoesRecords)) return {} as Record<string, any[]>
    const map: Record<string, any[]> = {}
    suspensoesRecords.forEach((rec: any) => {
      if (!rec.funcionario_id || !rec.data_inicio || !rec.data_fim) return
      if (rec.data_fim < range.start || rec.data_inicio > range.end) return
      if (!map[rec.funcionario_id]) map[rec.funcionario_id] = []
      map[rec.funcionario_id].push(rec)
    })
    return map
  }, [suspensoesRecords, range])

  const stats = useMemo(() => {
    if (!allFuncionarios.length) return []

    let targets = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
    if (teamInfo?.isRestricted) {
      targets = targets.filter(f => teamInfo.teamMemberIds.includes(f.id))
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    return targets.map(func => {
      // Filter scales in selected range up to today
      const funcEscalas = escalas.filter(e => e.funcionario_id === func.id && e.data >= range.start && e.data <= range.end && e.data <= todayStr)
      const total = funcEscalas.length
      const diasTrabalhadosList = funcEscalas.filter(e => e.tipo === 'presente' || e.tipo === 'hora_extra')
      const presentes = diasTrabalhadosList.length
      const domingosTrabalhados = diasTrabalhadosList.filter(e => new Date(e.data + 'T12:00:00').getDay() === 0).length
      const feriadosTrabalhados = diasTrabalhadosList.filter(e => feriados.some((f: any) => f.data === e.data)).length

      const faltas = funcEscalas.filter(e => e.tipo === 'falta').length
      const atestados = funcEscalas.filter(e => e.tipo === 'atestado').length
      const suspensoes = funcEscalas.filter(e => e.tipo === 'suspensao').length
      const ferias = funcEscalas.filter(e => e.tipo === 'ferias').length
      const folgas = funcEscalas.filter(e => e.tipo === 'repouso' || e.tipo === 'compensar').length
      const outros = funcEscalas.filter(e => !['presente', 'hora_extra', 'falta', 'atestado', 'ferias', 'repouso', 'compensar', 'suspensao'].includes(e.tipo)).length
      
      const diasPerdidos = faltas + atestados + suspensoes
      const divisorOperacional = presentes + faltas + atestados + suspensoes
      const yieldScore = divisorOperacional > 0 ? Math.round((presentes / divisorOperacional) * 100) : 100
      const disponibilidade = total > 0 ? Math.round((presentes / total) * 100) : 0
      
      const pesoFaltas = faltas * 1.5
      const pesoAtestados = atestados * 1.0
      const pesoSuspensoes = suspensoes * 1.5
      const impactoOperacional = divisorOperacional > 0 ? Math.round(((pesoFaltas + pesoAtestados + pesoSuspensoes) / divisorOperacional) * 100) : 0
      
      const taxaFaltas = divisorOperacional > 0 ? Math.round((faltas / divisorOperacional) * 100) : 0
      const taxaAtestados = divisorOperacional > 0 ? Math.round((atestados / divisorOperacional) * 100) : 0
      
      const funcAtestados = atestadosByFunc[func.id] || []
      const atestadoRecordsCount = funcAtestados.length
      const atestadoCIDs = [...new Set(funcAtestados.map((r: any) => r.cid).filter(Boolean))] as string[]
      const atestadoAvgDuration = atestadoRecordsCount > 0 
        ? Math.round(funcAtestados.reduce((sum: number, r: any) => {
            try { return sum + Math.max(1, differenceInDays(parseISO(r.data_fim), parseISO(r.data_inicio)) + 1) } catch { return sum + 1 }
          }, 0) / atestadoRecordsCount)
        : 0
      const atestadoRate = total > 0 ? Math.round((atestados / total) * 100) : 0

      const funcAdvertencias = advertenciasByFunc[func.id] || []
      const funcSuspensoes = suspensoesByFunc[func.id] || []

      // Calculate consecutive working days
      const sortedEscalas = [...funcEscalas].sort((a, b) => a.data.localeCompare(b.data))
      let maxConsecutive = 0
      let currentConsecutive = 0
      sortedEscalas.forEach(e => {
        if (e.tipo === 'presente' || e.tipo === 'hora_extra') {
          currentConsecutive++
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive
          }
        } else if (['repouso', 'compensar', 'falta', 'atestado', 'suspensao', 'ferias'].includes(e.tipo)) {
          currentConsecutive = 0
        }
      })
      const totalOvertime = funcEscalas.filter(e => e.tipo === 'hora_extra').length
      const burnoutRisk = maxConsecutive > 6 || totalOvertime > 4 ? 'ALTO' : maxConsecutive > 4 || totalOvertime > 2 ? 'MÉDIO' : 'BAIXO'

      // Predictive Alert Logic:
      // Project absences over the selected period based on progress so far
      let projectionAlert = false
      let projectedAbsences = 0
      const startOfP = parseISO(range.start)
      const endOfP = parseISO(range.end)
      const totalDaysInPeriod = differenceInDays(endOfP, startOfP) + 1
      const daysPassed = Math.max(1, differenceInDays(parseISO(todayStr < range.end ? todayStr : range.end), startOfP) + 1)
      
      if (diasPerdidos > 0 && daysPassed >= 3) {
        projectedAbsences = Math.round(((diasPerdidos / daysPassed) * totalDaysInPeriod) * 10) / 10
        // Alert if projected absences exceed 3.5 days in the selected range
        if (projectedAbsences >= 3.5) {
          projectionAlert = true
        }
      }

      // Risco calculation
      const absenteismo = diasPerdidos
      let risco = 'BAIXO'
      let riskReasons: string[] = []
      
      if (faltas + suspensoes >= 3 || yieldScore <= 70 || funcSuspensoes.length > 0) {
        risco = 'CRÍTICO'
        if (faltas + suspensoes >= 3) riskReasons.push(`${faltas + suspensoes} faltas/suspensões`)
        if (yieldScore <= 70) riskReasons.push(`Rendimento ${yieldScore}%`)
        if (funcSuspensoes.length > 0) riskReasons.push(`${funcSuspensoes.length} suspensão`)
      }
      
      if (atestados >= 5 || atestadoRecordsCount >= 2) {
        risco = 'CRÍTICO'
        if (atestados >= 5) riskReasons.push(`${atestados} dias de atestado`)
        if (atestadoRecordsCount >= 2) riskReasons.push(`${atestadoRecordsCount} atestados`)
      } else if (atestados >= 3 || atestadoRecordsCount >= 1) {
        if (risco === 'BAIXO') risco = 'MÉDIO'
        if (atestados >= 3) riskReasons.push(`${atestados} dias de atestado`)
        if (atestadoRecordsCount >= 1) riskReasons.push(`${atestadoRecordsCount} atestado`)
      }

      if (funcAdvertencias.length >= 2) {
        risco = 'CRÍTICO'
        riskReasons.push(`${funcAdvertencias.length} advertências`)
      } else if (funcAdvertencias.length === 1) {
        if (risco === 'BAIXO') risco = 'MÉDIO'
        riskReasons.push('1 advertência')
      }
      
      if (risco === 'BAIXO' && (absenteismo >= 3 || impactoOperacional >= 30)) {
        risco = 'CRÍTICO'
        riskReasons.push('Impacto operacional elevado')
      } else if (risco === 'BAIXO' && (absenteismo >= 1 || yieldScore < 85)) {
        risco = 'MÉDIO'
        if (absenteismo >= 1) riskReasons.push('Ausências detectadas')
        if (yieldScore < 85) riskReasons.push(`Rendimento ${yieldScore}%`)
      }

      return {
        ...func,
        stats: {
          total,
          presentes,
          faltas,
          atestados,
          suspensoes,
          ferias,
          folgas,
          outros,
          domingos: domingosTrabalhados,
          feriados: feriadosTrabalhados,
          yieldScore,
          absenteismo,
          risco,
          riskReasons,
          diasPerdidos,
          disponibilidade,
          impactoOperacional,
          taxaFaltas,
          taxaAtestados,
          atestadoRecordsCount,
          atestadoCIDs,
          atestadoAvgDuration,
          atestadoRate,
          atestadoRecords: funcAtestados,
          advertenciaRecordsCount: funcAdvertencias.length,
          advertenciaRecords: funcAdvertencias,
          suspensaoRecordsCount: funcSuspensoes.length,
          suspensaoRecords: funcSuspensoes,
          maxConsecutive,
          totalOvertime,
          burnoutRisk,
          projectionAlert,
          projectedAbsences
        }
      }
    }).sort((a, b) => {
      if (a.stats.risco === 'CRÍTICO' && b.stats.risco !== 'CRÍTICO') return -1
      if (b.stats.risco === 'CRÍTICO' && a.stats.risco !== 'CRÍTICO') return 1
      if (a.stats.impactoOperacional !== b.stats.impactoOperacional) return b.stats.impactoOperacional - a.stats.impactoOperacional
      return a.stats.yieldScore - b.stats.yieldScore
    })
  }, [allFuncionarios, escalas, teamInfo, atestadosByFunc, advertenciasByFunc, suspensoesByFunc, range])

  const filteredStats = useMemo(() => {
    return stats.filter(s => {
      const matchSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase())
      const matchSetor = selectedSetor === 'Todos' || s.setor === selectedSetor
      return matchSearch && matchSetor
    })
  }, [stats, searchTerm, selectedSetor])

  const globalSummary = useMemo(() => {
    if (!stats.length) return null
    const totalPresentes = stats.reduce((acc, s) => acc + s.stats.presentes, 0)
    const totalFaltas = stats.reduce((acc, s) => acc + s.stats.faltas, 0)
    const totalAtestados = stats.reduce((acc, s) => acc + s.stats.atestados, 0)
    const totalSuspensoes = stats.reduce((acc, s) => acc + s.stats.suspensoes, 0)
    const totalDiasEscala = stats.reduce((acc, s) => acc + s.stats.total, 0)
    const diasPerdidosTotal = totalFaltas + totalAtestados + totalSuspensoes
    const absenteismoTotal = diasPerdidosTotal
    const expected = totalPresentes + totalFaltas + totalAtestados + totalSuspensoes
    
    const absenteismoRate = expected > 0 ? Math.round((diasPerdidosTotal / expected) * 100) : 0
    const rendimentoGlobalRate = stats.length > 0 ? Math.round(stats.reduce((s, f) => s + f.stats.yieldScore, 0) / stats.length) : 100
    const disponibilidadeGlobal = totalDiasEscala > 0 ? Math.round((totalPresentes / totalDiasEscala) * 100) : 0
    const criticos = stats.filter(s => s.stats.risco === 'CRÍTICO').length
    
    const totalBurnoutAlto = stats.filter(s => s.stats.burnoutRisk === 'ALTO').length
    const totalOvertimeHours = stats.reduce((acc, s) => acc + s.stats.totalOvertime, 0)

    const totalAtestadoRecords = stats.reduce((acc, s) => acc + s.stats.atestadoRecordsCount, 0)
    const funcComAtestado = stats.filter(s => s.stats.atestadoRecordsCount > 0).length
    const atestadoRate = stats.length > 0 ? Math.round((funcComAtestado / stats.length) * 100) : 0
    const recidivistas = stats.filter(s => s.stats.atestadoRecordsCount >= 2).length
    
    // Weekday Absences aggregation inside range
    const weekdaysMap = [
      { name: 'Segunda', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Terça', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Quarta', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Quinta', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Sexta', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Sábado', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
      { name: 'Domingo', Faltas: 0, Atestados: 0, Suspensões: 0, total: 0 },
    ]
    
    escalas.forEach(e => {
      if (e.data >= range.start && e.data <= range.end) {
        const isFalta = e.tipo === 'falta'
        const isAtestado = e.tipo === 'atestado'
        const isSuspensa = e.tipo === 'suspensao'
        
        if (isFalta || isAtestado || isSuspensa) {
          try {
            const dateObj = new Date(e.data + 'T12:00:00')
            const dayIdx = (dateObj.getDay() + 6) % 7 // Mon(0)...Sun(6)
            if (dayIdx >= 0 && dayIdx < 7) {
              if (isFalta) weekdaysMap[dayIdx].Faltas++
              else if (isAtestado) weekdaysMap[dayIdx].Atestados++
              else if (isSuspensa) weekdaysMap[dayIdx].Suspensões++
              weekdaysMap[dayIdx].total++
            }
          } catch (err) {
            console.error(err)
          }
        }
      }
    })

    // Sector comparison
    const sectorMap: Record<string, { sector: string; yieldSum: number; count: number; absences: number; totalDays: number }> = {}
    stats.forEach(s => {
      const sec = s.setor || 'Sem Setor'
      if (!sectorMap[sec]) {
        sectorMap[sec] = { sector: sec, yieldSum: 0, count: 0, absences: 0, totalDays: 0 }
      }
      sectorMap[sec].yieldSum += s.stats.yieldScore
      sectorMap[sec].count++
      sectorMap[sec].absences += s.stats.diasPerdidos
      sectorMap[sec].totalDays += s.stats.total
    })
    
    const sectorComparison = Object.values(sectorMap).map(s => ({
      name: s.sector,
      'Rendimento': Math.round(s.yieldSum / s.count),
      'Ausência %': s.totalDays > 0 ? Math.round((s.absences / s.totalDays) * 100) : 0,
      funcionarios: s.count
    })).sort((a, b) => b['Rendimento'] - a['Rendimento'])

    // Top CIDs within range
    const cidCount: Record<string, number> = {}
    stats.forEach(s => {
      s.stats.atestadoCIDs.forEach((cid: string) => {
        cidCount[cid] = (cidCount[cid] || 0) + 1
      })
    })
    const topCIDs = Object.entries(cidCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cid, count]) => ({ cid, count }))

    const avgDurations = stats.filter(s => s.stats.atestadoAvgDuration > 0)
    const avgDuration = avgDurations.length > 0 
      ? Math.round(avgDurations.reduce((s, f) => s + f.stats.atestadoAvgDuration, 0) / avgDurations.length)
      : 0

    const pieData = [
      { name: 'Presenças', value: totalPresentes, color: '#10b981' },
      { name: 'Faltas', value: totalFaltas, color: '#f43f5e' },
      { name: 'Atestados', value: totalAtestados, color: '#f59e0b' },
      { name: 'Suspensões', value: totalSuspensoes, color: '#e11d48' },
    ].filter(d => d.value > 0)

    return { 
      absenteismoTotal, absenteismoRate, totalFaltas, totalAtestados, totalSuspensoes, pieData, criticos,
      totalPresentes, totalDiasEscala, diasPerdidosTotal, rendimentoGlobalRate, disponibilidadeGlobal,
      totalAtestadoRecords, funcComAtestado, atestadoRate, recidivistas, topCIDs, avgDuration,
      weekdaysMap, sectorComparison, totalBurnoutAlto, totalOvertimeHours
    }
  }, [stats, escalas, range])

  // Recent Occurrences Feed within range
  const recentOcorrencias = useMemo(() => {
    const list: any[] = []
    
    advertenciasRecords.forEach((r: any) => {
      if (r.data >= range.start && r.data <= range.end) {
        const func = allFuncionarios.find(f => f.id === r.funcionario_id)
        list.push({
          id: r.id || Math.random().toString(),
          type: 'advertencia',
          date: r.data,
          funcionario: func ? func.nome : 'Desconhecido',
          gravidade: r.gravidade || 'leve',
          motivo: r.motivo,
          detalhe: r.assinada ? 'Assinada' : 'Pendente'
        })
      }
    })
    
    suspensoesRecords.forEach((r: any) => {
      if (r.data_inicio >= range.start && r.data_inicio <= range.end) {
        const func = allFuncionarios.find(f => f.id === r.funcionario_id)
        list.push({
          id: r.id || Math.random().toString(),
          type: 'suspensao',
          date: r.data_inicio,
          funcionario: func ? func.nome : 'Desconhecido',
          gravidade: 'grave',
          motivo: r.motivo,
          detalhe: `Período: ${r.data_inicio} até ${r.data_fim}`
        })
      }
    })
    
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [advertenciasRecords, suspensoesRecords, allFuncionarios, range])

  // Lists for overview dashboard
  const radarRisco = useMemo(() => {
    return stats.filter(s => s.stats.risco === 'CRÍTICO').slice(0, 4)
  }, [stats])

  const predictiveAlerts = useMemo(() => {
    return stats.filter(s => s.stats.projectionAlert).slice(0, 4)
  }, [stats])

  const burnoutAlerts = useMemo(() => {
    return stats.filter(s => s.stats.burnoutRisk === 'ALTO' || s.stats.maxConsecutive > 5).slice(0, 4)
  }, [stats])

  // CSV Spreadsheet Export Function
  const exportToCSV = () => {
    if (!filteredStats.length) return
    
    const headers = [
      'Nome',
      'Cargo',
      'Setor',
      'Dias Analisados',
      'Presencas',
      'Faltas',
      'Atestados',
      'Suspensoes',
      'Folgas',
      'Rendimento (%)',
      'Disponibilidade (%)',
      'Impacto Operacional (%)',
      'Dias Consecutivos (Max)',
      'Horas Extras',
      'Risco Geral',
      'Risco Sobrecarga',
      'Proj. Ausencias Fim Periodo'
    ]
    
    const rows = filteredStats.map(s => [
      s.nome,
      s.cargo || '',
      s.setor || '',
      s.stats.total,
      s.stats.presentes,
      s.stats.faltas,
      s.stats.atestados,
      s.stats.suspensoes,
      s.stats.folgas,
      `${s.stats.yieldScore}%`,
      `${s.stats.disponibilidade}%`,
      `${s.stats.impactoOperacional}%`,
      s.stats.maxConsecutive,
      s.stats.totalOvertime,
      s.stats.risco,
      s.stats.burnoutRisk,
      s.stats.projectedAbsences
    ])
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.map(val => {
        const text = String(val ?? '')
        if (text.includes(';') || text.includes('\n') || text.includes('"')) {
          return `"${text.replace(/"/g, '""')}"`
        }
        return text
      }).join(';'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `rendimento_equipe_${range.start}_a_${range.end}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isLoading = loadF || loadE

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Monitor de Riscos" subtitle="Carregando métricas..." />
        <div className="pt-32 pb-20">
          <Loading text="Analisando riscos e absenteísmo..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Estatísticas & Rendimento" 
        subtitle="Indicadores de Risco, Frequência, Projeções e Sobrecarga da Equipe"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-32">
        {/* Sleek Refactored Toolbar */}
        <div className="bg-card/45 backdrop-blur-md border border-border/30 rounded-3xl p-5 shadow-sm mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Date Range Type Selector */}
            <div className="flex flex-wrap items-center gap-2 bg-muted/20 p-1.5 rounded-2xl border border-border/20">
              {[
                { id: 'month', label: 'Mensal' },
                { id: 'last7', label: 'Últimos 7 dias' },
                { id: 'last30', label: 'Últimos 30 dias' },
                { id: 'custom', label: 'Período Customizado' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDateRangeType(opt.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                    dateRangeType === opt.id
                      ? "bg-primary text-white shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Actions: CSV Export Button */}
            <button
              onClick={exportToCSV}
              className="h-10 px-4.5 bg-primary text-white rounded-2xl text-[9.5px] font-black uppercase tracking-widest flex items-center gap-2.5 hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-primary/20 shrink-0"
            >
              <Download className="w-4 h-4" /> Exportar Planilha (CSV)
            </button>

          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4.5 border-t border-border/10">
            {/* Range Pickers & Subtitles */}
            <div className="flex flex-wrap items-center gap-3">
              {dateRangeType === 'month' && (
                <div className="flex items-center gap-3 bg-muted/40 p-1 rounded-2xl border border-border/20 w-fit">
                  <button 
                    onClick={() => setSelectedMonth(format(subMonths(parseISO(selectedMonth + '-01'), 1), 'yyyy-MM'))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-card hover:shadow-sm transition-all text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    <ChevronRight className="w-4.5 h-4.5 rotate-180" />
                  </button>
                  <div className="min-w-[125px] text-center px-1">
                    <p className="text-[7.5px] font-black uppercase text-primary tracking-widest leading-none mb-0.5">Mês de Referência</p>
                    <p className="text-[10px] font-black text-foreground uppercase tracking-tight">{format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedMonth(format(startOfMonth(new Date()), 'yyyy-MM'))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-card hover:shadow-sm transition-all text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    <Calendar className="w-4.5 h-4.5" />
                  </button>
                </div>
              )}

              {dateRangeType === 'custom' && (
                <div className="flex items-center gap-2 bg-muted/20 px-3.5 py-2 rounded-2xl border border-border/20 text-xs">
                  <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-widest">De:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-foreground outline-none cursor-pointer"
                  />
                  <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-widest mx-1">Até:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-bold text-foreground outline-none cursor-pointer"
                  />
                </div>
              )}

              {(dateRangeType === 'last7' || dateRangeType === 'last30') && (
                <div className="px-4 py-2.5 bg-muted/40 rounded-2xl border border-border/20 text-[9px] font-bold text-muted-foreground">
                  Período Analisado: <span className="text-foreground font-black">{format(parseISO(range.start), 'dd/MM/yyyy')}</span> até <span className="text-foreground font-black">{format(parseISO(range.end), 'dd/MM/yyyy')}</span>
                </div>
              )}
            </div>

            {/* Searches and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Filtrar por nome..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-2 bg-muted/20 border border-border/20 focus:border-primary/50 focus:bg-background rounded-2xl text-[10px] font-bold text-foreground placeholder:text-muted-foreground/50 transition-all outline-none"
                />
              </div>
              <select
                value={selectedSetor}
                onChange={e => setSelectedSetor(e.target.value)}
                className="w-full sm:w-auto h-9 px-3 bg-muted/20 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-border/20 text-foreground focus:ring-1 focus:ring-primary focus:bg-background outline-none transition-all cursor-pointer"
              >
                <option value="Todos">Todos os Setores</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/30 mb-8 overflow-x-auto scrollbar-none">
          {[
            { id: 'geral', label: 'Visão Geral', icon: BarChart3 },
            { id: 'colaboradores', label: 'Colaboradores', icon: Users },
            { id: 'atestados', label: 'Atestados & Conduta', icon: ClipboardList },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4.5 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer",
                  isActive 
                    ? "border-primary text-primary bg-primary/[0.02]" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
                )}
              >
                <Icon className="w-4.5 h-4.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {globalSummary && (
          <div className="space-y-8 animate-fade-in">
            {/* ===================== TAB 1: VISÃO GERAL ===================== */}
            {activeTab === 'geral' && (
              <>
                {/* Global KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Rendimento Geral */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-2px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Award className="w-5 h-5 text-emerald-500" />
                      </div>
                      <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        Excelente
                      </span>
                    </div>
                    <p className="text-3xl font-black text-foreground tracking-tight">{globalSummary.rendimentoGlobalRate}%</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-2">Rendimento Geral</p>
                    <p className="text-[8px] font-bold text-muted-foreground/50 mt-1">Média operacional da equipe</p>
                  </div>

                  {/* Absenteísmo */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-2px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                      </div>
                      <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-widest">
                        {globalSummary.absenteismoRate > 15 ? 'Alto' : 'Estável'}
                      </span>
                    </div>
                    <p className="text-3xl font-black text-foreground tracking-tight">{globalSummary.absenteismoRate}%</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-2">Absenteísmo Global</p>
                    <p className="text-[8px] font-bold text-muted-foreground/50 mt-1">{globalSummary.diasPerdidosTotal} dias perdidos no período</p>
                  </div>

                  {/* Atenção Crítica */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-2px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      {globalSummary.criticos > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-md" />
                      )}
                    </div>
                    <p className="text-3xl font-black text-foreground tracking-tight">{globalSummary.criticos}</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-2">Radar de Risco</p>
                    <p className="text-[8px] font-bold text-muted-foreground/50 mt-1">Colaboradores em estado crítico</p>
                  </div>

                  {/* Sobrecarga */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-2px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="text-[8px] font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 uppercase tracking-widest">
                        Fadiga
                      </span>
                    </div>
                    <p className="text-3xl font-black text-foreground tracking-tight">{globalSummary.totalBurnoutAlto}</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-2">Alerta de Sobrecarga</p>
                    <p className="text-[8px] font-bold text-muted-foreground/50 mt-1">{globalSummary.totalOvertimeHours} HE registradas</p>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Weekday absences */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-foreground tracking-wider">Ausências por Dia da Semana</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Identifique padrões de faltas e atestados semanais</p>
                      </div>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={globalSummary.weekdaysMap} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                          <XAxis dataKey="name" stroke="rgba(128,128,128,0.5)" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis stroke="rgba(128,128,128,0.5)" fontSize={9} fontWeight="bold" tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 9, fontWeight: 'bold', paddingTop: 10 }} />
                          <Bar dataKey="Faltas" stackId="a" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Atestados" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Suspensões" stackId="a" fill="#e11d48" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Sector Rendimento */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-foreground tracking-wider">Comparativo por Setores</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Desempenho operacional vs taxa de ausência</p>
                      </div>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={globalSummary.sectorComparison} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                          <XAxis dataKey="name" stroke="rgba(128,128,128,0.5)" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis stroke="rgba(128,128,128,0.5)" fontSize={9} fontWeight="bold" tickLine={false} />
                          <RechartsTooltip content={<CustomTooltip suffix="%" />} />
                          <Legend wrapperStyle={{ fontSize: 9, fontWeight: 'bold', paddingTop: 10 }} />
                          <Bar dataKey="Rendimento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Ausência %" fill="#fb7185" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Risk Radar, Predictive Alerts & Overtime Alerts Quick List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                  {/* Critical Employees */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-rose-500 tracking-wider">Radar de Risco Crítico</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Acompanhamento imediato</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {radarRisco.length > 0 ? radarRisco.map((p) => (
                        <div key={p.id} onClick={() => setSelectedFunc(p)} className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/[0.02] border border-rose-500/10 hover:bg-rose-500/[0.05] transition-all cursor-pointer group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{p.nome}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">{p.setor}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8.5px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/15">
                              {p.stats.yieldScore}% Rend.
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="py-10 text-center flex flex-col items-center justify-center opacity-60">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                          <p className="text-xs font-black text-emerald-600 uppercase">Equipe Estável</p>
                          <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Sem risco crítico</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Predictive Alerts */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-purple-500 tracking-wider">Alertas Preditivos</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Tendências e projeções de ausências</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {predictiveAlerts.length > 0 ? predictiveAlerts.map((p) => (
                        <div key={p.id} onClick={() => setSelectedFunc(p)} className="flex items-center justify-between p-3 rounded-2xl bg-purple-500/[0.02] border border-purple-500/10 hover:bg-purple-500/[0.05] transition-all cursor-pointer group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{p.nome}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">{p.setor} &bull; Proj. Período</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[8.5px] font-black text-purple-500 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/15">
                              {p.stats.projectedAbsences} dias
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="py-10 text-center flex flex-col items-center justify-center opacity-60">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                          <p className="text-xs font-black text-emerald-600 uppercase">Frequência Estável</p>
                          <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Nenhuma tendência crítica identificada</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overtime & Burnout list */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-orange-500 tracking-wider">Fadiga & Sobrecarga</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Jornadas consecutivas e excesso de HE</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {burnoutAlerts.length > 0 ? burnoutAlerts.map((p) => (
                        <div key={p.id} onClick={() => setSelectedFunc(p)} className="flex items-center justify-between p-3 rounded-2xl bg-orange-500/[0.02] border border-orange-500/10 hover:bg-orange-500/[0.05] transition-all cursor-pointer group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{p.nome}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">{p.setor} &bull; {p.stats.totalOvertime} HE</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[8.5px] font-black text-orange-500 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/15">
                              {p.stats.maxConsecutive}d seguidos
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="py-10 text-center flex flex-col items-center justify-center opacity-60">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                          <p className="text-xs font-black text-emerald-600 uppercase">Jornadas Equilibradas</p>
                          <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Nenhum alerta de fadiga</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===================== TAB 2: COLABORADORES ===================== */}
            {activeTab === 'colaboradores' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Exibindo {filteredStats.length} colaboradores
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStats.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedFunc(item)}
                      className={cn(
                        "group relative bg-card/30 backdrop-blur-md border rounded-2xl p-4 shadow-sm transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] flex items-center justify-between gap-4 border-border/20 hover:border-primary/40",
                        item.stats.risco === 'CRÍTICO' && "border-rose-500/25 bg-rose-500/[0.02]"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full rounded-l-2xl transition-all",
                        item.stats.risco === 'CRÍTICO' ? "bg-rose-500" :
                        item.stats.risco === 'MÉDIO' ? "bg-amber-500" :
                        "bg-emerald-500"
                      )} />
                      
                      <div className="flex items-center gap-4.5 flex-1 min-w-0 pl-2">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shadow-inner shrink-0 border border-current/25 bg-current/10",
                          item.stats.risco === 'CRÍTICO' ? "text-rose-500" :
                          item.stats.risco === 'MÉDIO' ? "text-amber-500" :
                          "text-emerald-500"
                        )}>
                          {item.stats.yieldScore}%
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="text-xs sm:text-sm font-black text-foreground leading-tight uppercase truncate group-hover:text-primary transition-colors">{item.nome}</h4>
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                            {item.setor} &bull; {item.cargo}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {item.stats.atestadoRecordsCount > 0 && (
                              <span className="text-[7.5px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15 flex items-center gap-0.5">
                                <Stethoscope className="w-2.5 h-2.5" />{item.stats.atestadoRecordsCount} Atestados
                              </span>
                            )}
                            {item.stats.maxConsecutive > 5 && (
                              <span className="text-[7.5px] font-black text-orange-500 uppercase bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/15 flex items-center gap-0.5">
                                <Flame className="w-2.5 h-2.5" />{item.stats.maxConsecutive}d seguidos
                              </span>
                            )}
                            {item.stats.projectionAlert && (
                              <span className="text-[7.5px] font-black text-purple-500 uppercase bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/15 flex items-center gap-0.5">
                                <TrendingUp className="w-2.5 h-2.5" />Proj. +{item.stats.projectedAbsences} ausências
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4.5 shrink-0">
                        <div className="hidden sm:flex items-center gap-3 border-r border-border/20 pr-4">
                          <div className="text-center">
                            <span className="block text-xs font-black text-emerald-500 leading-none mb-1">{item.stats.presentes}</span>
                            <span className="text-[7px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">Pres.</span>
                          </div>
                          <div className="text-center">
                            <span className={cn("block text-xs font-black leading-none mb-1", item.stats.diasPerdidos > 0 ? "text-rose-500" : "text-muted-foreground/30")}>
                              {item.stats.diasPerdidos}
                            </span>
                            <span className="text-[7px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">Aus.</span>
                          </div>
                        </div>
                        
                        <div className="text-right min-w-[70px]">
                          <span className="block text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Risco</span>
                          <span className={cn(
                            "text-[8.5px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border shadow-sm inline-block text-center w-full",
                            item.stats.risco === 'CRÍTICO' ? "bg-rose-500/10 text-rose-500 border-rose-500/25" :
                            item.stats.risco === 'MÉDIO' ? "bg-amber-500/10 text-amber-500 border-amber-500/25" :
                            "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                          )}>
                            {item.stats.risco}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredStats.length === 0 && (
                  <div className="py-20 text-center bg-card/10 border border-border/20 rounded-3xl max-w-md mx-auto">
                    <Target className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
                    <p className="text-sm font-black uppercase text-foreground opacity-60">Nenhum Registro Encontrado</p>
                    <p className="text-xs text-muted-foreground mt-1 px-4">Tente ajustar a busca ou o setor selecionado.</p>
                  </div>
                )}
              </div>
            )}

            {/* ===================== TAB 3: ATESTADOS & CONDUTA ===================== */}
            {activeTab === 'atestados' && (
              <div className="space-y-6">
                {/* Conduct Tab KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Registros de Atestado', value: globalSummary.totalAtestadoRecords, icon: FileText, color: 'text-amber-500', bgColor: 'from-amber-500/10' },
                    { label: 'Dias de Afastamento', value: globalSummary.totalAtestados, icon: Calendar, color: 'text-orange-500', bgColor: 'from-orange-500/10' },
                    { label: 'Média de Dias', value: `${globalSummary.avgDuration}d`, icon: Clock, color: 'text-purple-500', bgColor: 'from-purple-500/10' },
                    { label: 'Casos Recidivistas', value: globalSummary.recidivistas, icon: Repeat, color: 'text-red-500', bgColor: 'from-red-500/10' },
                    { label: 'Advertências & Suspensões', value: recentOcorrencias.length, icon: ShieldAlert, color: 'text-rose-500', bgColor: 'from-rose-500/10' },
                  ].map(s => (
                    <div key={s.label} className={cn("relative bg-gradient-to-br to-transparent backdrop-blur-md border border-border/20 rounded-3xl p-5 shadow-sm overflow-hidden")}>
                      <div className="absolute top-0 right-0 w-20 h-20 bg-current/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl pointer-events-none" />
                      <div className="relative z-10">
                        <div className="w-8 h-8 rounded-xl bg-card border border-border/30 flex items-center justify-center mb-3">
                          <s.icon className={cn("w-4.5 h-4.5", s.color)} />
                        </div>
                        <p className="text-2xl font-black text-foreground tracking-tight leading-none">{s.value}</p>
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-wider mt-2.5 leading-tight">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Atestado Lists Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CID Ranking */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <Pill className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-foreground tracking-wider">Frequência por CIDs</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Classificação médica dos afastamentos</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {globalSummary.topCIDs.length > 0 ? globalSummary.topCIDs.map((c, i) => (
                        <div key={c.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/[0.02] border border-amber-500/10">
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-[10px] font-black text-amber-600 shrink-0">{i + 1}°</span>
                          <span className="flex-1 text-xs font-black text-foreground uppercase tracking-wide">CID {c.cid}</span>
                          <span className="text-[8.5px] font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/15">
                            {c.count} ocorrência{c.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      )) : (
                        <div className="py-8 text-center opacity-65">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nenhum CID registrado</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Employees with Atestados */}
                  <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                        <HeartPulse className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase text-foreground tracking-wider">Afastamentos Recorrentes</h4>
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Colaboradores com mais dias de atestado</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const topAtestados = [...stats]
                          .filter(s => s.stats.atestadoRecordsCount > 0)
                          .sort((a, b) => b.stats.atestados - a.stats.atestados || b.stats.atestadoRecordsCount - a.stats.atestadoRecordsCount)
                          .slice(0, 5)
                        return topAtestados.length > 0 ? topAtestados.map((p) => (
                          <div key={p.id} onClick={() => setSelectedFunc(p)} className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/[0.02] border border-rose-500/10 hover:bg-rose-500/[0.05] transition-all cursor-pointer group">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{p.nome}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                                {p.stats.atestadoRecordsCount} registro(s) &bull; {p.stats.atestadoCIDs.length > 0 ? `CID: ${p.stats.atestadoCIDs.join(', ')}` : 'Sem CID'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/15">
                                {p.stats.atestados} dias
                              </span>
                              {p.stats.atestadoRecordsCount >= 2 && (
                                <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/15 uppercase tracking-wider shrink-0">Recidivista</span>
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="py-8 text-center opacity-65">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nenhum atestado registrado</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Disciplinary Feed */}
                <div className="bg-card/30 backdrop-blur-md border border-border/20 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                      <Ban className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-foreground tracking-wider">Feed de Ocorrências e Medidas Disciplinares</h4>
                      <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Advertências e suspensões aplicadas no período</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {recentOcorrencias.length > 0 ? recentOcorrencias.map((oc: any) => (
                      <div key={oc.id} className="flex items-start gap-4 p-3.5 rounded-2xl bg-muted/20 border border-border/20 hover:bg-muted/30 transition-all">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                          oc.type === 'suspensao' 
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        )}>
                          {oc.type === 'suspensao' ? <Ban className="w-4.5 h-4.5" /> : <AlertTriangle className="w-4.5 h-4.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[10px] font-black text-foreground uppercase">{oc.funcionario}</span>
                            <span className="text-[9px] font-black text-muted-foreground font-mono bg-card/60 px-2 py-0.5 rounded border border-border/20">
                              {format(parseISO(oc.date), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold text-muted-foreground/75 mt-1 italic">"{oc.motivo}"</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md",
                              oc.type === 'suspensao' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                            )}>
                              {oc.type === 'suspensao' ? 'Suspensão' : `Advertência ${oc.gravidade}`}
                            </span>
                            <span className="text-[7.5px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                              {oc.detalhe}
                            </span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-10 text-center flex flex-col items-center justify-center opacity-65">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                        <p className="text-xs font-black text-emerald-600 uppercase">Clima Organizacional Estável</p>
                        <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Nenhuma medida disciplinar registrada</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deep Personal Modal Dashboard */}
      <Modal open={!!selectedFunc} onClose={() => { setSelectedFunc(null); setModalTab('metrics'); }} title={`Dashboard Pessoal`}>
        {selectedFunc && (
          <div className="space-y-6 animate-fade-in relative">
            <div ref={modalRef} className="space-y-6 bg-background p-4 sm:p-2 rounded-[1.5rem] -m-4 sm:-m-2">
              <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-2xl border border-border/20 shadow-inner">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base shadow-md shrink-0 border border-current/25 bg-current/10",
                  selectedFunc.stats.risco === 'CRÍTICO' ? "text-rose-500 shadow-rose-500/20" :
                  selectedFunc.stats.risco === 'MÉDIO' ? "text-amber-500 shadow-amber-500/20" :
                  "text-emerald-500 shadow-emerald-500/20"
                )}>
                  {selectedFunc.stats.yieldScore}%
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black uppercase text-foreground truncate leading-none mb-1.5">{selectedFunc.nome}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">{selectedFunc.cargo} • {selectedFunc.setor}</p>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-[8.5px] font-black uppercase text-primary tracking-widest w-fit mt-3 shadow-sm">
                    <Calendar className="w-3.5 h-3.5" />
                    Período: {selectedFunc.stats.total} dias analisados
                  </div>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="bg-muted/40 p-1 rounded-2xl border border-border/20 flex shadow-inner shrink-0">
                <button
                  onClick={() => setModalTab('metrics')}
                  className={cn(
                    "flex-1 py-3 text-[9.5px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer",
                    modalTab === 'metrics'
                      ? "bg-card text-primary shadow-sm border border-border/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="w-4 h-4" /> Métricas & Desempenho
                </button>
                <button
                  onClick={() => setModalTab('personal')}
                  className={cn(
                    "flex-1 py-3 text-[9.5px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer",
                    modalTab === 'personal'
                      ? "bg-card text-primary shadow-sm border border-border/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="w-4 h-4 text-primary" /> Dados Cadastrais
                </button>
              </div>

              {modalTab === 'metrics' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Card: Dias Trabalhados */}
                    <div className="bg-card/20 backdrop-blur-md p-4 rounded-3xl border border-border/20 shadow-sm flex flex-col justify-between">
                      <div>
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Dias Trabalhados</p>
                        <p className="text-2xl font-black text-emerald-500">{selectedFunc.stats.presentes}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/10 flex flex-col gap-1.5">
                        <span className="text-[8.5px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span>Domingos:</span>
                          <span className="text-foreground font-extrabold">{selectedFunc.stats.domingos}</span>
                        </span>
                        <span className="text-[8.5px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span>Feriados:</span>
                          <span className="text-foreground font-extrabold">{selectedFunc.stats.feriados}</span>
                        </span>
                      </div>
                    </div>

                    {/* Card: Dias Sem Trabalho */}
                    <div className={cn(
                      "p-4 rounded-3xl border shadow-sm flex flex-col justify-between relative overflow-hidden",
                      selectedFunc.stats.diasPerdidos > 0 
                        ? "bg-orange-500/[0.02] border-orange-500/25" 
                        : "bg-emerald-500/[0.02] border-emerald-500/20"
                    )}>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingDown className={cn("w-3.5 h-3.5", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500" : "text-emerald-500")} />
                          <p className={cn("text-[8px] font-black uppercase tracking-widest", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500/80" : "text-muted-foreground")}>Dias Perdidos</p>
                        </div>
                        <p className={cn("text-2xl font-black", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500" : "text-emerald-500")}>{selectedFunc.stats.diasPerdidos}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/10 flex flex-col gap-1.5 relative z-10">
                        <span className="text-[8.5px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Faltas:</span>
                          <span className="text-rose-500 font-extrabold">{selectedFunc.stats.faltas}</span>
                        </span>
                        <span className="text-[8.5px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Atestados:</span>
                          <span className="text-amber-500 font-extrabold">{selectedFunc.stats.atestados}</span>
                        </span>
                      </div>
                    </div>

                    {/* Card: Folgas */}
                    <div className="bg-card/20 backdrop-blur-md p-4 rounded-3xl border border-border/20 shadow-sm">
                      <p className="text-[8px] font-black text-blue-500/80 uppercase tracking-widest mb-1">Folgas & Compensações</p>
                      <p className="text-2xl font-black text-blue-500">{selectedFunc.stats.folgas}</p>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mt-2.5">Repousos e folgas</p>
                    </div>

                    {/* Card: Férias & Outros */}
                    <div className="bg-card/20 backdrop-blur-md p-4 rounded-3xl border border-border/20 shadow-sm flex flex-col justify-between">
                      <div>
                        <p className="text-[8px] font-black text-indigo-500/80 uppercase tracking-widest mb-1">Recessos e Férias</p>
                        <p className="text-2xl font-black text-indigo-500">{selectedFunc.stats.ferias}</p>
                      </div>
                      {selectedFunc.stats.outros > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-border/10 flex items-center justify-between text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                          <span>Outros:</span>
                          <span className="text-foreground font-extrabold">{selectedFunc.stats.outros}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Atestado Individual Details */}
                  {(selectedFunc.stats.atestadoRecordsCount > 0 || selectedFunc.stats.atestados > 0) && (
                    <div className="bg-card/10 border border-amber-500/20 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-border/20">
                        <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Stethoscope className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[9.5px] font-black uppercase tracking-widest text-foreground">Dossiê de Atestados</h4>
                          <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Histórico médico detalhado</p>
                        </div>
                        {selectedFunc.stats.atestadoRecordsCount >= 2 && (
                          <span className="text-[7.5px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wider">Recidivista</span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-card border border-border/20 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-amber-500 leading-none">{selectedFunc.stats.atestadoRecordsCount}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground tracking-wider mt-1">Registros</p>
                        </div>
                        <div className="bg-card border border-border/20 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-orange-500 leading-none">{selectedFunc.stats.atestados}</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground tracking-wider mt-1">Dias</p>
                        </div>
                        <div className="bg-card border border-border/20 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-purple-500 leading-none">{selectedFunc.stats.atestadoAvgDuration}d</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground tracking-wider mt-1">Média</p>
                        </div>
                        <div className="bg-card border border-border/20 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-rose-500 leading-none">{selectedFunc.stats.atestadoRate}%</p>
                          <p className="text-[7px] font-black uppercase text-muted-foreground tracking-wider mt-1">Taxa</p>
                        </div>
                      </div>

                      {selectedFunc.stats.atestadoCIDs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mr-1">CIDs:</span>
                          {selectedFunc.stats.atestadoCIDs.map((cid: string) => (
                            <span key={cid} className="text-[8.5px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wide">
                              {cid}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        {selectedFunc.stats.atestadoRecords.map((rec: any) => {
                          const days = (() => {
                            try { return Math.max(1, differenceInDays(parseISO(rec.data_fim), parseISO(rec.data_inicio)) + 1) } catch { return 1 }
                          })()
                          return (
                            <div key={rec.id} className="flex items-start gap-3 bg-muted/20 border border-border/20 rounded-xl p-2.5">
                              <span className="w-7 h-7 rounded bg-amber-500/15 flex items-center justify-center text-[9px] font-black text-amber-500 shrink-0 border border-amber-500/10">
                                {days}d
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9.5px] font-black text-foreground">
                                  {format(parseISO(rec.data_inicio), 'dd/MM')} &rarr; {format(parseISO(rec.data_fim), 'dd/MM/yy')}
                                  {rec.cid && <span className="ml-2 text-[7.5px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.2 rounded uppercase">CID {rec.cid}</span>}
                                </p>
                                {rec.motivo && <p className="text-[8.5px] font-bold text-muted-foreground mt-0.5 italic">"{rec.motivo}"</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Disciplinary Individual Details */}
                  {(selectedFunc.stats.advertenciaRecordsCount > 0 || selectedFunc.stats.suspensaoRecordsCount > 0) && (
                    <div className="bg-card/10 border border-rose-500/20 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-border/20">
                        <div className="w-8.5 h-8.5 rounded-xl bg-rose-500/10 flex items-center justify-center">
                          <ShieldAlert className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                          <h4 className="text-[9.5px] font-black uppercase tracking-widest text-foreground">Histórico Disciplinar</h4>
                          <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">Registros de comportamento</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {selectedFunc.stats.advertenciaRecords.map((rec: any) => (
                          <div key={rec.id} className="p-2.5 rounded-xl bg-muted/20 border border-border/20 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-foreground">{format(parseISO(rec.data), 'dd/MM/yyyy')}</span>
                              <span className={cn(
                                "text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md",
                                rec.gravidade === 'grave' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                              )}>
                                Advertência {rec.gravidade}
                              </span>
                            </div>
                            <p className="text-[8.5px] font-bold text-muted-foreground mt-1 italic">"{rec.motivo}"</p>
                            <span className="text-[7.5px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-1 block">
                              Status: {rec.assinada ? 'Assinada' : 'Pendente'}
                            </span>
                          </div>
                        ))}

                        {selectedFunc.stats.suspensaoRecords.map((rec: any) => {
                          const days = (() => {
                            try { return Math.max(1, differenceInDays(parseISO(rec.data_fim), parseISO(rec.data_inicio)) + 1) } catch { return 1 }
                          })()
                          return (
                            <div key={rec.id} className="p-2.5 rounded-xl bg-rose-500/[0.02] border border-rose-500/10 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-foreground">
                                  {format(parseISO(rec.data_inicio), 'dd/MM')} &rarr; {format(parseISO(rec.data_fim), 'dd/MM')}
                                </span>
                                <span className="text-[7.5px] font-black uppercase px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md">
                                  Suspensão ({days}d)
                                </span>
                              </div>
                              <p className="text-[8.5px] font-bold text-muted-foreground mt-1 italic">"{rec.motivo}"</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Monthly Calendar Matrix - only visible if range is <= 31 days */}
                  {differenceInDays(parseISO(range.end), parseISO(range.start)) <= 31 && (
                    <div className="bg-card/25 border border-border/20 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-border/20">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3.5 bg-primary rounded-full" />
                          <h4 className="text-[9.5px] font-black uppercase tracking-widest text-foreground">Matriz de Frequência</h4>
                        </div>
                        <span className="text-[7.5px] font-black uppercase text-muted-foreground tracking-widest">Calendário do Período</span>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 max-w-[280px] mx-auto">
                        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((wd, i) => (
                          <div key={i} className="text-center text-[8.5px] font-black uppercase text-muted-foreground/60 py-0.5">
                            {wd}
                          </div>
                        ))}

                        {(() => {
                          const startOfPeriod = parseISO(range.start)
                          const startWeekdayOffset = (startOfPeriod.getDay() + 6) % 7
                          return Array.from({ length: startWeekdayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square bg-transparent border-none pointer-events-none" />
                          ))
                        })()}

                        {eachDayOfInterval({
                          start: parseISO(range.start),
                          end: parseISO(range.end)
                        }).map((day) => {
                          const dayStr = format(day, 'yyyy-MM-dd')
                          const scale = escalas.find(e => e.funcionario_id === selectedFunc.id && e.data === dayStr)
                          
                          let dayStyle = {
                            className: "bg-muted/10 border-border/20 text-muted-foreground/45",
                            style: {},
                            statusText: "Sem escala",
                            letra: ""
                          }

                          if (scale) {
                            dayStyle = getDayStyle(scale.tipo, tiposEscala)
                          }

                          return (
                            <div 
                              key={dayStr}
                              title={`${format(day, "dd/MM")}: ${dayStyle.statusText}`} 
                              className={cn(
                                "aspect-square rounded-lg flex flex-col items-center justify-center text-[9px] transition-all hover:scale-105 relative group cursor-pointer border",
                                dayStyle.className
                              )}
                              style={dayStyle.style}
                            >
                              <span className="font-mono font-black text-[10px] leading-none">{format(day, 'd')}</span>
                              {dayStyle.letra && (
                                <span className="text-[6.5px] font-black uppercase opacity-85 leading-none mt-0.5">{dayStyle.letra}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Diagnostic Yield */}
                  <div className="bg-card/25 border border-border/20 p-5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted/15" />
                          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent"
                            strokeDasharray={201}
                            strokeDashoffset={201 - (selectedFunc.stats.yieldScore / 100) * 201}
                            className={cn("transition-all duration-700", 
                              selectedFunc.stats.yieldScore >= 90 ? "text-emerald-500" : 
                              selectedFunc.stats.yieldScore >= 75 ? "text-amber-500" : "text-rose-500"
                            )}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn("text-sm font-black", 
                            selectedFunc.stats.yieldScore >= 90 ? "text-emerald-500" : 
                            selectedFunc.stats.yieldScore >= 75 ? "text-amber-500" : "text-rose-500"
                          )}>
                            {selectedFunc.stats.yieldScore}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className={cn("text-base font-black uppercase tracking-tight", 
                          selectedFunc.stats.yieldScore >= 90 ? "text-emerald-500" : 
                          selectedFunc.stats.yieldScore >= 75 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {selectedFunc.stats.yieldScore >= 90 ? 'Excelente' : selectedFunc.stats.yieldScore >= 75 ? 'Atenção' : 'Crítico'}
                        </h4>
                        <p className="text-[8.5px] font-bold text-muted-foreground mt-1 leading-relaxed">
                          {selectedFunc.stats.yieldScore >= 90 
                            ? 'Frequência regular e conduta exemplar.' 
                            : selectedFunc.stats.atestados > selectedFunc.stats.faltas
                              ? `Rendimento impactado por ${selectedFunc.stats.atestados} dias de atestado.`
                              : selectedFunc.stats.faltas > selectedFunc.stats.atestados
                                ? `Rendimento comprometido por ${selectedFunc.stats.faltas} faltas.`
                                : `Ausências detectadas: ${selectedFunc.stats.faltas} falta(s) e ${selectedFunc.stats.atestados} atestado(s).`
                          }
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-border/10">
                      {[
                        { label: 'Taxa de Faltas', value: selectedFunc.stats.taxaFaltas, barClass: 'bg-rose-500' },
                        { label: 'Taxa de Atestados', value: selectedFunc.stats.taxaAtestados, barClass: 'bg-amber-500' },
                        { label: 'Disponibilidade', value: selectedFunc.stats.disponibilidade, barClass: 'bg-blue-500', invert: true },
                        { label: 'Impacto Operacional', value: selectedFunc.stats.impactoOperacional, barClass: 'bg-red-500' },
                      ].map(m => (
                        <div key={m.label} className="space-y-1">
                          <div className="flex items-center justify-between text-[8.5px] font-black uppercase">
                            <span className="text-muted-foreground">{m.label}</span>
                            <span className={cn(
                              m.invert 
                                ? (m.value >= 80 ? 'text-emerald-500' : 'text-rose-500')
                                : (m.value <= 15 ? 'text-emerald-500' : 'text-rose-500')
                            )}>{m.value}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", m.barClass)} style={{ width: `${Math.min(m.value, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-card p-5 rounded-3xl border border-border/30 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-border/20">
                    <div className="w-1 h-3.5 bg-primary rounded-full" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">Ficha Cadastral</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Matrícula', val: selectedFunc.matricula || 'Não informada' },
                      { label: 'Contato', val: selectedFunc.telefone || 'Não informado' },
                      { label: 'CPF', val: selectedFunc.cpf || 'Não cadastrado' },
                      { label: 'PIS', val: selectedFunc.pis || 'Não cadastrado' },
                      { label: 'Apelido', val: selectedFunc.apelido || 'Não possui' },
                      { label: 'Status', val: selectedFunc.status === 'ativo' ? 'Ativo' : 'Inativo' }
                    ].map(f => (
                      <div key={f.label}>
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block">{f.label}</span>
                        <span className="text-xs font-bold text-foreground mt-1 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase truncate">
                          {f.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-4 flex items-center gap-3">
              <button onClick={handleShare} className="h-12 px-5 rounded-2xl bg-muted/50 text-foreground hover:bg-muted font-black uppercase text-[10px] tracking-widest flex items-center gap-2 border border-border/30 flex-1 justify-center transition-all hover:scale-[1.02] cursor-pointer">
                <Share2 className="w-4 h-4" /> Compartilhar
              </button>
              <button onClick={() => setSelectedFunc(null)} className="h-12 px-8 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-md hover:scale-[1.02] transition-all cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden container for share rendering to prevent print rendering issues */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -100 }}>
        <div 
          ref={shareSquareRef} 
          className="no-shadows bg-white text-slate-950 p-8 flex flex-col justify-between"
          style={{ 
            width: '800px',
            height: '800px',
            backgroundColor: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {selectedFunc && (
            <>
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">7Locar &bull; Estatísticas</span>
                  <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight mt-1">Desempenho & Rendimento</h1>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700">
                    {format(parseISO(range.start), 'dd/MM')} - {format(parseISO(range.end), 'dd/MM/yy')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg text-white shrink-0",
                  selectedFunc.stats.risco === 'CRÍTICO' ? "bg-rose-500" :
                  selectedFunc.stats.risco === 'MÉDIO' ? "bg-amber-500" :
                  "bg-emerald-500"
                )}>
                  {selectedFunc.stats.yieldScore}%
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black uppercase text-slate-900 truncate leading-none mb-1.5">{selectedFunc.nome}</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase truncate">{selectedFunc.cargo} • {selectedFunc.setor}</p>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                    Período: {selectedFunc.stats.total} dias analisados
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dias Trabalhados</p>
                    <p className="text-2xl font-black text-emerald-600">{selectedFunc.stats.presentes}</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-1 text-[8px] font-bold text-slate-500 uppercase">
                    <div className="flex justify-between"><span>Domingos:</span><span className="font-extrabold text-slate-800">{selectedFunc.stats.domingos}</span></div>
                    <div className="flex justify-between"><span>Feriados:</span><span className="font-extrabold text-slate-800">{selectedFunc.stats.feriados}</span></div>
                  </div>
                </div>

                <div className={cn("border p-4 rounded-2xl flex flex-col justify-between",
                  selectedFunc.stats.diasPerdidos > 0 ? "bg-orange-50/50 border-orange-200" : "bg-slate-50 border-slate-200"
                )}>
                  <div>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500" : "text-slate-400")}>Dias Perdidos</p>
                    <p className={cn("text-2xl font-black", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500" : "text-emerald-600")}>{selectedFunc.stats.diasPerdidos}</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-1 text-[8px] font-bold text-slate-500 uppercase">
                    <div className="flex justify-between"><span>Faltas:</span><span className="font-extrabold text-rose-600">{selectedFunc.stats.faltas}</span></div>
                    <div className="flex justify-between"><span>Atestados:</span><span className="font-extrabold text-amber-600">{selectedFunc.stats.atestados}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Folgas & Repousos</p>
                  <p className="text-2xl font-black text-blue-600 leading-none">{selectedFunc.stats.folgas}</p>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-2">Folgas no período</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Férias & Licenças</p>
                    <p className="text-2xl font-black text-indigo-600 leading-none">{selectedFunc.stats.ferias}</p>
                  </div>
                  {selectedFunc.stats.outros > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                      <span>Outras Escalas:</span>
                      <span className="font-extrabold text-slate-800">{selectedFunc.stats.outros}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-6">
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="27" stroke="#e2e8f0" strokeWidth="5" fill="transparent" />
                      <circle cx="32" cy="32" r="27" stroke={
                        selectedFunc.stats.yieldScore >= 90 ? '#10b981' : 
                        selectedFunc.stats.yieldScore >= 75 ? '#f59e0b' : 
                        '#ef4444'
                      } strokeWidth="5" fill="transparent"
                        strokeDasharray={170}
                        strokeDashoffset={170 - (selectedFunc.stats.yieldScore / 100) * 170}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn("text-xs font-black", 
                        selectedFunc.stats.yieldScore >= 90 ? "text-emerald-600" : 
                        selectedFunc.stats.yieldScore >= 75 ? "text-amber-500" : 
                        "text-rose-600"
                      )}>
                        {selectedFunc.stats.yieldScore}%
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Diagnóstico</span>
                    <h4 className={cn("text-base font-black uppercase tracking-tight", 
                      selectedFunc.stats.yieldScore >= 90 ? "text-emerald-600" : 
                      selectedFunc.stats.yieldScore >= 75 ? "text-amber-500" : 
                      "text-rose-600"
                    )}>
                      {selectedFunc.stats.yieldScore >= 90 ? 'Excelente' : selectedFunc.stats.yieldScore >= 75 ? 'Atenção' : 'Crítico'}
                    </h4>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-x-4 gap-y-2 text-[8px] font-black text-slate-500 uppercase">
                  <div className="flex justify-between">
                    <span>Ausências:</span>
                    <span className={cn("font-extrabold", selectedFunc.stats.diasPerdidos > 0 ? "text-orange-500" : "text-emerald-600")}>{selectedFunc.stats.diasPerdidos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impacto Oper.:</span>
                    <span className="font-extrabold text-slate-800">{selectedFunc.stats.impactoOperacional}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Disponibilidade:</span>
                    <span className="font-extrabold text-slate-800">{selectedFunc.stats.disponibilidade}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trabalho Consecutivo:</span>
                    <span className="font-extrabold text-slate-800">{selectedFunc.stats.maxConsecutive} dias</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[7px] font-black uppercase tracking-wider text-slate-400">
                <span>7Locar Controle de Escala</span>
                <span>Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
