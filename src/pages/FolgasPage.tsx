import React, { useState, useMemo, useCallback } from 'react'
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addDays, 
  subDays, 
  parseISO, 
  isToday, 
  isSunday, 
  startOfDay 
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Clock, 
  Activity, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  X, 
  MessageSquare,
  Building2,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { FuncionarioName } from '../components/ui/FuncionarioName'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import type { Funcionario } from '../lib/database.types'

export function FolgasPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: teamInfo } = useUserTeam()

  // Preset Date Ranges
  const today = useMemo(() => startOfDay(new Date()), [])
  const [startDate, setStartDate] = useState(() => format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [filterSetor, setFilterSetor] = useState('')
  const [filterType, setFilterType] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  
  // Share / Export Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareFormatMode, setShareFormatMode] = useState<'tipo' | 'data' | 'funcionario'>('tipo')
  const [copied, setCopied] = useState(false)

  // System Configurations & Data Fetching
  const { data: plataformaNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: dbSetores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: dbLocalidades = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: allTeams = [] } = useQuery<any[]>({
    queryKey: ['all-teams-folgas'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    }
  })

  const { data: allFuncionarios = [], isLoading: loadFuncs } = useFuncionarios({ status: 'ativo' })

  // Query escalas for the selected period
  const { data: escalas = [], isLoading: loadEscalas } = useEscalasPeriodo(startDate, endDate)

  // Query frequencias for the selected period
  const { data: frequenciasData = [] } = useQuery<any[]>({
    queryKey: ['frequencia-periodo-folgas', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('frequencia')
        .select('funcionario_id, data, status')
        .gte('data', startDate)
        .lte('data', endDate)
      return data || []
    },
    enabled: !!startDate && !!endDate
  })

  // Set preset ranges
  const setQuickRange = (range: 'hoje' | 'semana' | 'mes' | 'prox_semana') => {
    if (range === 'hoje') {
      const todayStr = format(today, 'yyyy-MM-dd')
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (range === 'semana') {
      setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    } else if (range === 'mes') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'))
    } else if (range === 'prox_semana') {
      const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7)
      setStartDate(format(nextWeekStart, 'yyyy-MM-dd'))
      setEndDate(format(endOfWeek(nextWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    }
  }

  // Pre-index scales and frequency by employee and date
  const escalaMap = useMemo(() => {
    const map: Record<string, any> = {}
    if (Array.isArray(escalas)) {
      escalas.forEach((e: any) => {
        if (!e || !e.funcionario_id || !e.data) return
        const fId = String(e.funcionario_id).trim()
        const dateKey = String(e.data).substring(0, 10)
        map[`${fId}_${dateKey}`] = e
      })
    }
    return map
  }, [escalas])

  const freqMap = useMemo(() => {
    const map: Record<string, any> = {}
    if (Array.isArray(frequenciasData)) {
      frequenciasData.forEach((f: any) => {
        if (!f || !f.funcionario_id || !f.data) return
        const fId = String(f.funcionario_id).trim()
        const dateKey = String(f.data).substring(0, 10)
        map[`${fId}_${dateKey}`] = f
      })
    }
    return map
  }, [frequenciasData])

  // Detect if user is an encarregado / supervisor with team restrictions
  const isEncarregadoUser = useMemo(() => {
    if (teamInfo?.isRestricted) return true
    if (!user || !user.roles) return false
    return user.roles.some(r => r.nome.toUpperCase().includes('ENCARREGADO'))
  }, [teamInfo, user])

  // Get active team ID for encarregado
  const activeEncarregadoTeamId = useMemo(() => {
    if (teamInfo?.teamId && teamInfo.teamId !== 'none') return teamInfo.teamId
    if (teamInfo?.teamIds && teamInfo.teamIds.length > 0) return teamInfo.teamIds[0]
    return null
  }, [teamInfo])

  // Query equipe_membros directly to guarantee all team members are fetched for encarregados
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['team-members-folgas', activeEncarregadoTeamId, teamInfo?.teamIds],
    queryFn: async () => {
      const targetIds = teamInfo?.teamIds || (activeEncarregadoTeamId ? [activeEncarregadoTeamId] : [])
      if (targetIds.length === 0) return []

      const { data } = await supabase
        .from('equipe_membros')
        .select('funcionario_id, equipe_id')
        .in('equipe_id', targetIds)

      return data || []
    },
    enabled: isEncarregadoUser && !!(teamInfo?.teamIds?.length || activeEncarregadoTeamId)
  })

  // Filtered employees list based on scope/team restrictions
  const filteredFuncionarios = useMemo(() => {
    let list = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')

    if (isEncarregadoUser) {
      // Build set of allowed employee IDs strictly for this encarregado's team
      const allowedSet = new Set<string>();

      // 1. From teamInfo.teamMemberIds
      (teamInfo?.teamMemberIds || []).forEach((id: any) => allowedSet.add(String(id).trim()))

      // 2. From equipe_membros query
      teamMembers.forEach((m: any) => allowedSet.add(String(m.funcionario_id).trim()))

      // 3. From allFuncionarios where (f as any).equipe_id is in teamInfo.teamIds
      allFuncionarios.forEach(f => {
        const eqId = (f as any).equipe_id
        if (eqId && teamInfo?.teamIds?.includes(eqId)) {
          allowedSet.add(String(f.id).trim())
        }
      })

      list = list.filter(f => allowedSet.has(String(f.id).trim()))
    } else if (selectedTeamId) {
      // For Admin / Manager: filter by selected team
      const team = allTeams.find(t => t.id === selectedTeamId)
      if (team) {
        list = list.filter(f => f.setor === team.setor || (f as any).equipe_id === selectedTeamId)
      }
    }

    if (filterSetor) {
      list = list.filter(f => f.setor === filterSetor)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      list = list.filter(f => 
        f.nome.toLowerCase().includes(term) || 
        (f.apelido && f.apelido.toLowerCase().includes(term))
      )
    }

    return list
  }, [allFuncionarios, isEncarregadoUser, teamInfo, teamMembers, selectedTeamId, allTeams, filterSetor, searchTerm])

  // List of all days in the chosen interval
  const daysInPeriod = useMemo(() => {
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      if (start > end) return []
      return eachDayOfInterval({ start, end })
    } catch {
      return []
    }
  }, [startDate, endDate])

  // Process all off-records in the period
  interface OffRecord {
    id: string
    funcionarioId: string
    funcionarioNome: string
    funcionarioApelido?: string | null
    setor: string
    cargo?: string | null
    dateStr: string
    dateFormatted: string
    tipo: 'folga' | 'ferias' | 'atestado' | 'outros'
    tipoLabel: string
  }

  const offRecords = useMemo(() => {
    const list: OffRecord[] = []

    daysInPeriod.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd')
      const isSun = isSunday(day)

      filteredFuncionarios.forEach(f => {
        const fIdStr = String(f.id).trim()
        const e = escalaMap[`${fIdStr}_${dStr}`]
        const freq = freqMap[`${fIdStr}_${dStr}`]
        const isDesligado = !!(f.data_desligamento && dStr >= f.data_desligamento)

        let isTrabalhando = false
        let tipo = 'presente'

        const isAbsence = (s?: string) => {
          if (!s) return false
          const norm = s.toLowerCase().trim()
          return ['falta', 'atestado', 'ferias', 'feria', 'suspensao', 'suspenso', 'licenca', 'afastamento', 'afastado'].includes(norm)
        }

        const isFolga = (s?: string) => {
          if (!s) return false
          const norm = s.toLowerCase().trim()
          return ['repouso', 'compensar', 'folga', 'folga_domingo', 'folga_feriado', 'descanso', 'r', 'f', 'c'].includes(norm)
        }

        const isWork = (s?: string) => {
          if (!s) return false
          const norm = s.toLowerCase().trim()
          return ['escala', 'presente', 'hora_extra', 'trabalho', 'alocado', 'he', 'trabalhando'].includes(norm)
        }

        if (isDesligado) {
          isTrabalhando = false
          tipo = 'repouso'
        } else if (freq && freq.status) {
          const freqStatus = String(freq.status).toLowerCase().trim()
          if (isAbsence(freqStatus) || isFolga(freqStatus)) {
            isTrabalhando = false
            tipo = freq.status
          } else if (isWork(freqStatus)) {
            isTrabalhando = true
            tipo = freq.status
          } else {
            isTrabalhando = !isSun
            tipo = freq.status || (isSun ? 'repouso' : 'presente')
          }
        } else if (e) {
          const normTipo = e.tipo ? String(e.tipo).toLowerCase().trim() : ''
          if (isAbsence(normTipo) || isFolga(normTipo)) {
            isTrabalhando = false
            tipo = e.tipo
          } else if (isWork(normTipo)) {
            isTrabalhando = true
            tipo = e.tipo || 'presente'
          } else {
            isTrabalhando = !isSun
            tipo = e.tipo || (isSun ? 'repouso' : 'presente')
          }
        } else {
          isTrabalhando = !isSun
          tipo = isSun ? 'repouso' : 'presente'
        }

        if (!isTrabalhando) {
          const normTipo = String(tipo).toLowerCase().trim()
          let category: 'folga' | 'ferias' | 'atestado' | 'outros' = 'folga'
          let tipoLabel = 'Folga / Repouso'

          if (['ferias', 'feria', 'fe'].includes(normTipo)) {
            category = 'ferias'
            tipoLabel = 'Férias'
          } else if (['atestado', 'afastamento', 'afastado', 'licenca', 'a', 'af'].includes(normTipo)) {
            category = 'atestado'
            tipoLabel = 'Atestado / Afastamento'
          } else if (['falta', 'suspensao', 'suspenso'].includes(normTipo)) {
            category = 'outros'
            tipoLabel = normTipo === 'falta' ? 'Falta' : 'Suspensão'
          } else {
            category = 'folga'
            tipoLabel = isSun ? 'Folga Domingo' : 'Folga / Repouso'
          }

          if (filterType === 'todos' || filterType === category) {
            list.push({
              id: `${f.id}_${dStr}`,
              funcionarioId: f.id,
              funcionarioNome: f.nome,
              funcionarioApelido: f.apelido,
              setor: f.setor || 'Geral',
              cargo: f.cargo,
              dateStr: dStr,
              dateFormatted: format(day, "dd/MM/yyyy (EEEE)", { locale: ptBR }),
              tipo: category,
              tipoLabel
            })
          }
        }
      })
    })

    return list
  }, [daysInPeriod, filteredFuncionarios, escalaMap, freqMap, filterType])

  // Categorized Counters
  const counts = useMemo(() => {
    let folga = 0
    let ferias = 0
    let atestado = 0
    let outros = 0

    offRecords.forEach(r => {
      if (r.tipo === 'folga') folga++
      else if (r.tipo === 'ferias') ferias++
      else if (r.tipo === 'atestado') atestado++
      else outros++
    })

    return { folga, ferias, atestado, outros, total: offRecords.length }
  }, [offRecords])

  // Group by Date
  const recordsByDate = useMemo(() => {
    const map: Record<string, OffRecord[]> = {}
    offRecords.forEach(r => {
      if (!map[r.dateStr]) map[r.dateStr] = []
      map[r.dateStr].push(r)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [offRecords])

  // Group by Employee
  const recordsByEmployee = useMemo(() => {
    const map: Record<string, { funcionarioNome: string; funcionarioApelido?: string | null; setor: string; records: OffRecord[] }> = {}
    offRecords.forEach(r => {
      if (!map[r.funcionarioId]) {
        map[r.funcionarioId] = {
          funcionarioNome: r.funcionarioNome,
          funcionarioApelido: r.funcionarioApelido,
          setor: r.setor,
          records: []
        }
      }
      map[r.funcionarioId].records.push(r)
    })
    return Object.values(map).sort((a, b) => (a.funcionarioApelido || a.funcionarioNome).localeCompare(b.funcionarioApelido || b.funcionarioNome))
  }, [offRecords])

  // Generate Formatted Text Report for Sharing / Copying
  const generatedTextReport = useMemo(() => {
    let startFmt = startDate
    let endFmt = endDate
    try {
      startFmt = format(parseISO(startDate), 'dd/MM/yyyy')
      endFmt = format(parseISO(endDate), 'dd/MM/yyyy')
    } catch {}

    let text = `🌴 *RELATÓRIO DE FOLGAS E AUSÊNCIAS* 🌴\n`
    text += `🏢 *PLATAFORMA:* ${plataformaNome.toUpperCase()}\n`
    text += `📅 *PERÍODO:* ${startFmt} a ${endFmt}\n`
    text += `📊 *TOTAL DE REGISTROS:* ${offRecords.length}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    if (offRecords.length === 0) {
      text += `⚠️ NENHUMA FOLGA OU AUSÊNCIA REGISTRADA PARA O PERÍODO SELECIONADO.\n`
      return text.toUpperCase()
    }

    if (shareFormatMode === 'tipo') {
      const folgas = offRecords.filter(r => r.tipo === 'folga')
      const ferias = offRecords.filter(r => r.tipo === 'ferias')
      const atestados = offRecords.filter(r => r.tipo === 'atestado')
      const outros = offRecords.filter(r => r.tipo === 'outros')

      if (folgas.length > 0) {
        text += `🔹 *FOLGAS / REPOUSO (${folgas.length}):*\n`
        folgas.forEach(r => {
          const displayName = (r.funcionarioApelido || r.funcionarioNome).toUpperCase()
          text += `  • ${displayName} (${r.setor}) - ${r.dateFormatted.toUpperCase()}\n`
        })
        text += `\n`
      }

      if (ferias.length > 0) {
        text += `🏖️ *FÉRIAS (${ferias.length}):*\n`
        ferias.forEach(r => {
          const displayName = (r.funcionarioApelido || r.funcionarioNome).toUpperCase()
          text += `  • ${displayName} (${r.setor}) - ${r.dateFormatted.toUpperCase()}\n`
        })
        text += `\n`
      }

      if (atestados.length > 0) {
        text += `🏥 *ATESTADOS / AFASTAMENTOS (${atestados.length}):*\n`
        atestados.forEach(r => {
          const displayName = (r.funcionarioApelido || r.funcionarioNome).toUpperCase()
          text += `  • ${displayName} (${r.setor}) - ${r.dateFormatted.toUpperCase()}\n`
        })
        text += `\n`
      }

      if (outros.length > 0) {
        text += `❌ *FALTAS / SUSPENSÕES (${outros.length}):*\n`
        outros.forEach(r => {
          const displayName = (r.funcionarioApelido || r.funcionarioNome).toUpperCase()
          text += `  • ${displayName} (${r.setor}) - ${r.dateFormatted.toUpperCase()}\n`
        })
        text += `\n`
      }
    } else if (shareFormatMode === 'data') {
      recordsByDate.forEach(([dStr, recs]) => {
        let dFmt = dStr
        try {
          dFmt = format(parseISO(dStr), "dd/MM/yyyy (EEEE)", { locale: ptBR }).toUpperCase()
        } catch {}

        text += `📅 *${dFmt}:*\n`
        recs.forEach(r => {
          const displayName = (r.funcionarioApelido || r.funcionarioNome).toUpperCase()
          text += `  • ${displayName} - ${r.tipoLabel.toUpperCase()} (${r.setor})\n`
        })
        text += `\n`
      })
    } else {
      recordsByEmployee.forEach(emp => {
        const displayName = (emp.funcionarioApelido || emp.funcionarioNome).toUpperCase()
        text += `👤 *${displayName}* (${emp.setor}) - ${emp.records.length} dia(s):\n`
        emp.records.forEach(r => {
          text += `  • ${r.dateFormatted.toUpperCase()} - ${r.tipoLabel.toUpperCase()}\n`
        })
        text += `\n`
      })
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `Gerado automaticamente via ${plataformaNome}`

    return text.toUpperCase()
  }, [startDate, endDate, plataformaNome, offRecords, shareFormatMode, recordsByDate, recordsByEmployee])

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedTextReport)
      setCopied(true)
      toast('Relatório de folgas copiado para a área de transferência!', 'success')
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      toast('Erro ao copiar texto', 'error')
    }
  }

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(generatedTextReport)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-background text-foreground animate-fade-in pb-32">
      <TopHeader 
        title="Gestão de Folgas & Ausências" 
        subtitle="Visualização consolidada, planejamento por período e compartilhamento em texto" 
      />

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-24 sm:pt-28 space-y-8">
        {/* Banner principal e ações rapidas */}
        <div className="bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-purple-600/15 dark:from-blue-600/10 dark:to-purple-600/10 border border-blue-500/30 rounded-[2.5rem] p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/15 px-3 py-0.5 rounded-full border border-blue-500/20">
                  🌴 Painel de Folgas
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground mt-1 uppercase tracking-tight">
                {counts.total} Registros de Ausência no Período
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consolidado de folgas, repousos, férias e atestados da equipe.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Button
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 md:flex-none py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar em Texto / WhatsApp
            </Button>
          </div>
        </div>

        {/* Card de Filtros e Seleção de Período */}
        <div className="bg-card/85 dark:bg-card/45 border border-border/40 rounded-[2.5rem] p-6 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border/30 pb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase text-foreground tracking-widest">Filtros de Período e Equipe</h3>
            </div>

            {/* Quick Range Selector Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickRange('hoje')}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase tracking-wider transition-all border border-border/30"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('semana')}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase tracking-wider transition-all border border-border/30"
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('prox_semana')}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase tracking-wider transition-all border border-border/30"
              >
                Próx. Semana
              </button>
              <button
                type="button"
                onClick={() => setQuickRange('mes')}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase tracking-wider transition-all border border-border/30"
              >
                Este Mês
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Equipe / Encarregado Status */}
            {isEncarregadoUser ? (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                  Equipe Atribuída
                </label>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 text-xs font-black text-primary uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0 text-primary" />
                  <span className="truncate">Sua Equipe ({filteredFuncionarios.length})</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                  Equipe
                </label>
                <select
                  value={selectedTeamId || ''}
                  onChange={e => {
                    setSelectedTeamId(e.target.value || null)
                    setFilterSetor('')
                  }}
                  className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                >
                  <option value="">Todas as Equipes</option>
                  {allTeams.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            )}

            {/* Data Inicial */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Data Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
              />
            </div>

            {/* Data Final */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Data Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
              />
            </div>

            {/* Tipo de Ausência */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Tipo de Registro
              </label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="folga">Folgas / Repouso</option>
                <option value="ferias">Férias</option>
                <option value="atestado">Atestados / Afastamentos</option>
                <option value="outros">Faltas / Suspensões</option>
              </select>
            </div>

            {/* Setor */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Setor
              </label>
              <select
                value={filterSetor}
                onChange={e => setFilterSetor(e.target.value)}
                className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
              >
                <option value="">Todos os Setores</option>
                {dbSetores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Busca por Nome */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Pesquisar Nome
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Nome ou apelido..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border/30 rounded-2xl text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card Folgas */}
          <div className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-500" />
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">Folgas / Repouso</p>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-foreground">{counts.folga}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Dias</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Descansos e folgas de escala</p>
          </div>

          {/* Card Férias */}
          <div className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-500" />
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">Férias</p>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                <CalendarIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-foreground">{counts.ferias}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Dias</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Período de férias regulamentares</p>
          </div>

          {/* Card Atestados */}
          <div className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">Atestados / Afastamentos</p>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-foreground">{counts.atestado}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Dias</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Licenças médicas e atestados</p>
          </div>

          {/* Card Faltas */}
          <div className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">Faltas / Suspensões</p>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-foreground">{counts.outros}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Dias</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Ausências não justificadas</p>
          </div>
        </div>

        {/* Detalhamento por Data */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">
              Detalhamento de Ausências por Data ({recordsByDate.length} Dias com Registros)
            </h3>
          </div>

          {(loadFuncs || loadEscalas) ? (
            <div className="py-20 flex justify-center">
              <Loading size="lg" text="Carregando registros de folgas..." />
            </div>
          ) : recordsByDate.length === 0 ? (
            <div className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-[2.5rem] p-12 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-black text-foreground uppercase tracking-wider">
                Nenhuma folga ou ausência no período
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Não há registros de folgas, repousos ou atestados cadastrados para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recordsByDate.map(([dStr, recs]) => {
                let dFmt = dStr
                let isSun = false
                try {
                  const dObj = parseISO(dStr)
                  dFmt = format(dObj, "EEEE, dd 'de' MMMM", { locale: ptBR })
                  isSun = isSunday(dObj)
                } catch {}

                return (
                  <div 
                    key={dStr}
                    className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] p-6 space-y-4 shadow-sm hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-border/30 pb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                          {dStr}
                        </p>
                        <h4 className="text-sm font-black text-foreground uppercase tracking-tight mt-0.5">
                          {dFmt}
                        </h4>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black px-2.5 py-1 rounded-xl border uppercase tracking-wider",
                        isSun ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {recs.length} Ausente(s)
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                      {recs.map(r => {
                        let badgeClass = 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        if (r.tipo === 'ferias') badgeClass = 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                        else if (r.tipo === 'atestado') badgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        else if (r.tipo === 'outros') badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20'

                        return (
                          <div 
                            key={r.id}
                            className="flex items-center justify-between p-3 bg-muted/20 border border-border/30 rounded-2xl gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <FuncionarioName 
                                nome={r.funcionarioNome} 
                                apelido={r.funcionarioApelido} 
                                uppercase 
                                size="xs" 
                              />
                              <span className="text-[8.5px] font-bold text-muted-foreground block truncate uppercase mt-0.5">
                                Setor: {r.setor} {r.cargo ? `• ${r.cargo}` : ''}
                              </span>
                            </div>

                            <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border tracking-wider shrink-0", badgeClass)}>
                              {r.tipoLabel}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Compartilhamento em Texto / WhatsApp */}
      <Modal
        open={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Compartilhar Folgas em Texto"
        subtitle="Gere um relatório formatado para copiar ou enviar direto no WhatsApp"
        size="lg"
      >
        <div className="space-y-6 py-2">
          {/* Formato de Agrupamento */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
              Modo de Organização do Texto
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareFormatMode('tipo')}
                className={cn(
                  "py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all",
                  shareFormatMode === 'tipo'
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-muted/40 text-muted-foreground border-border/30 hover:bg-muted"
                )}
              >
                Por Tipo (Folgas, Férias)
              </button>

              <button
                type="button"
                onClick={() => setShareFormatMode('data')}
                className={cn(
                  "py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all",
                  shareFormatMode === 'data'
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-muted/40 text-muted-foreground border-border/30 hover:bg-muted"
                )}
              >
                Por Data (Dia a Dia)
              </button>

              <button
                type="button"
                onClick={() => setShareFormatMode('funcionario')}
                className={cn(
                  "py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all",
                  shareFormatMode === 'funcionario'
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-muted/40 text-muted-foreground border-border/30 hover:bg-muted"
                )}
              >
                Por Colaborador
              </button>
            </div>
          </div>

          {/* Área de Visualização do Texto */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Pré-visualização do Relatório
              </label>
              <span className="text-[9px] font-bold text-muted-foreground">
                {generatedTextReport.length} Caracteres
              </span>
            </div>

            <textarea
              readOnly
              rows={12}
              value={generatedTextReport}
              className="w-full bg-card dark:bg-[#0c0e17] border border-border/60 rounded-2xl p-4 text-xs font-mono text-foreground focus:ring-0 outline-none select-all scrollbar-thin leading-relaxed"
            />
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              onClick={handleCopyText}
              variant="outline"
              className="py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </Button>

            <Button
              onClick={handleShareWhatsApp}
              className="py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar pelo WhatsApp
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
