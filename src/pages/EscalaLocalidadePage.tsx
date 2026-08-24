import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { matchEmployeeSearch, normalizeSearchText } from '../lib/searchUtils'
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks, 
  isToday, 
  isSunday, 
  parseISO, 
  addDays, 
  subDays,
  startOfDay,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getWeek
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Navigation2, 
  Plus, 
  UserPlus, 
  UserMinus,
  Calendar as CalendarIcon,
  Copy,
  Trash2,
  Users,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  ClipboardCopy,
  Printer,
  MoreVertical,
  X,
  Check,
  MapPin,
  Layers,
  ArrowDownCircle,
  Download,
  Share2,
  Activity,
  GripVertical,
  MessageSquare,
  Settings,
  Pencil,
  FileText,
  XCircle,
  AlertCircle,
  Route,
  Sparkles,
  RotateCcw,
  Bot
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { FuncionarioName } from '../components/ui/FuncionarioName'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './admin/AdminDashboard'
import type { Funcionario } from '../lib/database.types'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AiAllocationModal } from '../components/AiAllocationModal'
import { CopilotoIaDrawer } from '../components/CopilotoIaDrawer'
import { 
  fetchHistoricalAIContext, 
  buildAIEngine, 
  generateSmartAutoAllocations, 
  normStr,
  type AIProcessedEngine, 
  type SuggestedAllocation 
} from '../services/aiAllocationService'


interface Localidade {
  id: string
  nome: string
  setor: string
  equipe_id?: string | null
  dias_operacionais?: 'segunda_sabado' | 'domingo_feriado' | 'todos'
}

export interface Demanda {
  id: string
  titulo: string
  tipo: 'check' | 'always'
  concluido: boolean
}

type ViewMode = 'daily' | 'weekly'

function safeUUID(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

function normalizeStr(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesFuzzy(target: string, query: string): boolean {
  const normQuery = normalizeStr(query)
  if (!normQuery) return false

  const normTarget = normalizeStr(target)

  // 1. Direct substring match (ignoring case, accents, and special chars)
  if (normTarget.includes(normQuery)) {
    return true
  }

  // 2. Word-by-word match: all query words must appear in target
  const queryWords = normQuery.split(/\s+/).filter(Boolean)
  if (queryWords.length > 1) {
    const allWordsMatch = queryWords.every(word => normTarget.includes(word))
    if (allWordsMatch) return true
  }

  return false
}

const DEFAULT_FUNCOES = [
  { id: 'motorista', nome: 'Motorista', classes: 'bg-orange-500/15 border-orange-500/30', textClass: 'text-orange-600 dark:text-orange-400' },
  { id: 'rocador', nome: 'Roçador', classes: 'bg-emerald-500/15 border-emerald-500/30', textClass: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'varredor', nome: 'Varredor', classes: 'bg-blue-500/15 border-blue-500/30', textClass: 'text-blue-600 dark:text-blue-400' },
  { id: 'coletor', nome: 'Coletor', classes: 'bg-slate-500/15 border-slate-500/30', textClass: 'text-slate-600 dark:text-slate-400' },
]

export function EscalaLocalidadePage() {
  const { toast } = useToast()
  const { hasPermission, user } = useAuth()
  const { data: teamInfo, isLoading: loadTeam } = useUserTeam()

  const isEncarregadoUser = (teamInfo?.isRestricted ?? false) || (user?.roles?.some(r => r.nome.toUpperCase().includes('ENCARREGADO')) ?? false)
  const canEdit = hasPermission('localidades', 'editar') || hasPermission('localidades', 'gerenciar') || hasPermission('escala', 'gerenciar') || isEncarregadoUser || !!user?.isAdmin
  const canAdmin = hasPermission('localidades', 'administrar') || hasPermission('localidades', 'gerenciar') || isEncarregadoUser || !!user?.isAdmin
  const queryClient = useQueryClient()
  const [demandSearchQuery, setDemandSearchQuery] = useState<Record<string, string>>({})
  const [focusedLocId, setFocusedLocId] = useState<string | null>(null)

  const { activePanel, selectedTeamId, setSelectedTeamId } = useAuth()

  const { data: allTeams = [] } = useQuery<any[]>({
    queryKey: ['all-teams-locais-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    }
  })

  const { data: dbFuncoesEquipe } = useConfiguracao<any[]>('funcoes_equipe', DEFAULT_FUNCOES)
  const dynamicFuncoes = (dbFuncoesEquipe && dbFuncoesEquipe.length > 0) ? dbFuncoesEquipe : DEFAULT_FUNCOES

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

  const { data: allTeamMembers = [] } = useQuery<any[]>({
    queryKey: ['all-team-members-mapping'],
    queryFn: async () => {
      const { data } = await supabase.from('equipe_membros').select('equipe_id, funcionario_id')
      return data || []
    }
  })

  const employeeTeamMap = useMemo(() => {
    const map: Record<string, { id: string; nome: string; cor: string }[]> = {}
    allTeamMembers.forEach((m: any) => {
      const team = allTeams.find(t => t.id === m.equipe_id)
      if (team) {
        if (!map[m.funcionario_id]) {
          map[m.funcionario_id] = []
        }
        map[m.funcionario_id].push({ id: team.id, nome: team.nome, cor: team.cor })
      }
    })
    return map
  }, [allTeamMembers, allTeams])

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day || 1)
  }

  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem('7boss_selected_work_date')
    if (saved) {
      try {
        const parsed = parseLocalDate(saved)
        if (parsed && !isNaN(parsed.getTime())) return parsed
      } catch (e) {}
    }
    return startOfDay(new Date())
  })

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const { data: borrowedMembers = [] } = useQuery<any[]>({
    queryKey: ['membros-emprestados', dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipe_membros_emprestados')
        .select('equipe_id, funcionario_id')
        .eq('data', dateStr)
      return data || []
    }
  })

  const supervisorBorrowedMemberIds = useMemo(() => {
    if (!teamInfo?.isRestricted) return []
    const supervisorTeamIds = teamInfo.teamIds || []
    return borrowedMembers
      .filter((bm: any) => supervisorTeamIds.includes(bm.equipe_id))
      .map((bm: any) => bm.funcionario_id)
  }, [borrowedMembers, teamInfo])

  const selectedTeamBorrowedMemberIds = useMemo(() => {
    if (!selectedTeamId) return []
    return borrowedMembers
      .filter((bm: any) => bm.equipe_id === selectedTeamId)
      .map((bm: any) => bm.funcionario_id)
  }, [borrowedMembers, selectedTeamId])

  useEffect(() => {
    localStorage.setItem('7boss_selected_work_date', dateStr)
  }, [dateStr])

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('7boss_escala_view_mode') as ViewMode) || 'daily'
  })

  useEffect(() => {
    localStorage.setItem('7boss_escala_view_mode', viewMode)
  }, [viewMode])

  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem('7boss_escala_search_term') || ''
  })

  useEffect(() => {
    localStorage.setItem('7boss_escala_search_term', searchTerm)
  }, [searchTerm])

  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(null)
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 120)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  const clearSearch = useCallback(() => {
    setSearchTerm('')
    localStorage.setItem('7boss_escala_search_term', '')
    setModalSearchTerm('')
  }, [])

  const isBorrowed = useCallback((id: string) => {
    const activeTeamId = teamInfo?.isRestricted ? (teamInfo.teamIds?.[0] || null) : selectedTeamId
    return borrowedMembers.some((bm: any) => bm.funcionario_id === id && bm.equipe_id === activeTeamId)
  }, [borrowedMembers, teamInfo, selectedTeamId])

  const [borrowModal, setBorrowModal] = useState<{ funcionario: any } | null>(null)
  const [borrowStartDate, setBorrowStartDate] = useState(dateStr)
  const [borrowEndDate, setBorrowEndDate] = useState(dateStr)
  const [isBorrowingRange, setIsBorrowingRange] = useState(false)
  const [borrowLoading, setBorrowLoading] = useState(false)

  useEffect(() => {
    if (borrowModal) {
      setBorrowStartDate(dateStr)
      setBorrowEndDate(dateStr)
      setIsBorrowingRange(false)
    }
  }, [borrowModal, dateStr])

  const handleBorrowEmployee = (funcionarioId: string) => {
    const funcObj = allFuncionarios.find(f => f.id === funcionarioId)
    if (!funcObj) return
    setBorrowModal({ funcionario: funcObj })
  }

  const submitBorrow = async (startDate: string, endDate: string) => {
    if (!borrowModal) return
    const employeeId = borrowModal.funcionario.id
    const activeTeamId = teamInfo?.isRestricted ? (teamInfo.teamIds?.[0] || null) : selectedTeamId
    if (!activeTeamId) {
      toast('Selecione uma equipe antes de pegar um funcionário emprestado.', 'warning')
      return
    }

    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      if (start > end) {
        toast('A data de início não pode ser posterior à data de fim.', 'warning')
        return
      }

      const days = eachDayOfInterval({ start, end })
      const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'))

      const { data: existingLoans, error: fetchErr } = await supabase
        .from('equipe_membros_emprestados')
        .select('data, equipe_id')
        .eq('funcionario_id', employeeId)
        .in('data', dateStrings)

      if (fetchErr) throw fetchErr

      const borrowedByOther = (existingLoans || []).filter(
        (loan: any) => loan.equipe_id !== activeTeamId
      )

      if (borrowedByOther.length > 0) {
        const formattedDates = borrowedByOther.map(l => format(parseISO(l.data), 'dd/MM')).join(', ')
        toast(`Este colaborador já está emprestado para outra equipe no(s) dia(s): ${formattedDates}`, 'error')
        return
      }

      const newDatesToInsert = dateStrings.filter(d => {
        const isAlreadyBorrowed = (existingLoans || []).some(
          (loan: any) => loan.data === d && loan.equipe_id === activeTeamId
        )
        return !isAlreadyBorrowed
      })

      if (newDatesToInsert.length > 0) {
        const rows = newDatesToInsert.map(d => ({
          equipe_id: activeTeamId,
          funcionario_id: employeeId,
          data: d
        }))

        const { error: insertErr } = await supabase
          .from('equipe_membros_emprestados')
          .insert(rows)

        if (insertErr) throw insertErr
      }

      toast(`${borrowModal.funcionario.apelido || borrowModal.funcionario.nome} foi emprestado com sucesso!`, 'success')
      setBorrowModal(null)
      clearSearch()
      queryClient.invalidateQueries({ queryKey: ['membros-emprestados', dateStr] })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      toast('Erro ao pegar emprestado: ' + err.message, 'error')
    }
  }

  const handleReturnBorrowed = async (funcId: string) => {
    try {
      await supabase
        .from('equipe_membros_emprestados')
        .delete()
        .eq('funcionario_id', funcId)
        .eq('data', dateStr)
      
      const currentEscala = escalas.find((esc: any) => esc.funcionario_id === funcId && esc.data.substring(0, 10) === dateStr)
      if (currentEscala) {
        await supabase.from('escalas').delete().eq('id', currentEscala.id)
      }
      
      await supabase.from('frequencia').delete().eq('funcionario_id', funcId).eq('data', dateStr)

      queryClient.invalidateQueries({ queryKey: ['membros-emprestados', dateStr] })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Colaborador devolvido com sucesso', 'success')
    } catch (err: any) {
      toast('Erro ao devolver colaborador: ' + err.message, 'error')
    }
  }
  const [filterSetor, setFilterSetor] = useState(() => {
    return localStorage.getItem('7boss_escala_filter_setor') || ''
  })

  useEffect(() => {
    localStorage.setItem('7boss_escala_filter_setor', filterSetor)
  }, [filterSetor])
  const [assignModal, setAssignModal] = useState<{ locId: string; locName: string; dateStr: string; setor: string } | null>(null)
  interface SpecialDayConfirmState {
    title: string
    description: string
    dateLabel: string
    onConfirmHE: () => void
    onConfirmTrabalho: () => void
    onCancel: () => void
  }
  const [specialDayConfirm, setSpecialDayConfirm] = useState<SpecialDayConfirmState | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [registerDemandModal, setRegisterDemandModal] = useState<{ dem: any; loc: any } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ escalaId: string; funcionarioId?: string; employeeName: string } | null>(null)
  const [successAllocatedIds, setSuccessAllocatedIds] = useState<Record<string, boolean>>({})
  const [autoAllocateRules, setAutoAllocateRules] = useState({
    useHistory: true,
    useSector: true,
    useFallback: true
  })
  const [sectorLimits, setSectorLimits] = useState<Record<string, number>>({})
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false)

  const [autoAllocatePreview, setAutoAllocatePreview] = useState<{
    funcionarioId: string
    funcionarioNome: string
    localidadeNome: string
    setor: string
    motivo: string
  }[] | null>(null)

  const [localInputs, setLocalInputs] = useState<Record<string, string>>({})

  // Drag and drop states
  const [isDraggingId, setIsDraggingId] = useState<string | null>(null)
  const [dragOverLocId, setDragOverLocId] = useState<string | null>(null)
  const [dragOverSector, setDragOverSector] = useState<string | null>(null)

  // Copy from day modal
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyType, setCopyType] = useState<'identico' | 'media_10_dias'>('identico')
  const [copySourceDate, setCopySourceDate] = useState('')
  const [copyIncludeLocalities, setCopyIncludeLocalities] = useState<boolean>(true)
  const [copyPreview, setCopyPreview] = useState<{ funcionarioId: string; funcionarioNome: string; localidadeNome: string }[] | null>(null)
  const [isCopyLoading, setIsCopyLoading] = useState(false)
  const [hasAutoRouted, setHasAutoRouted] = useState(false)

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  // Smart Allocation Assistant State
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantData, setAssistantData] = useState<{
    recommendations: Record<string, {
      locId: string
      topLocalityName: string
      score: number
      matchPercent: number
      localityDays: number
      coWorkerPartnerName: string | null
      coWorkerDays: number
      reason: string
    }[]>
    empLocHist?: Record<string, Record<string, number>>
    pairHist?: Record<string, Record<string, number>>
    latestAllocationMap?: Record<string, { localityName: string; date: string }>
    localityPatternMap?: Record<string, Record<string, number>>
    empBehavior?: Record<string, {
      totalDays: number
      presentDays: number
      faltaDays: number
      atestadoDays: number
      suspensaoDays: number
      horaExtraDays: number
      lastAbsenceDate: string | null
      daysAwayBeforeReturn: number
    }>
  }>({ recommendations: {}, empLocHist: {}, pairHist: {}, latestAllocationMap: {}, localityPatternMap: {}, empBehavior: {} })
  const [previewMode, setPreviewMode] = useState<'completo' | 'enxuto' | 'apenas_localidades' | 'tipo_equipe' | 'demandas_realizadas'>('completo')

  // Copiloto IA State
  const [aiEngine, setAiEngine] = useState<AIProcessedEngine>({
    empLocHist: {},
    empSectorHist: {},
    pairHist: {},
    attendanceHist: {},
    recentLocality: {},
    recentSector: {},
    latestAllocation: {},
    localityLastDateMap: {},
    localityPatternMap: {}
  })
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedAllocation[]>([])

  // Google Maps Geocoding Autocomplete State
  const [googleAddressSuggestions, setGoogleAddressSuggestions] = useState<Record<string, any[]>>({})
  const [isSearchingGoogleMap, setIsSearchingGoogleMap] = useState<Record<string, boolean>>({})

  const handleSearchGoogleMap = useCallback(async (locId: string, query: string) => {
    if (!query || query.trim().length < 2) {
      setGoogleAddressSuggestions(prev => ({ ...prev, [locId]: [] }))
      return
    }

    setIsSearchingGoogleMap(prev => ({ ...prev, [locId]: true }))
    try {
      const queryTerm = query.toLowerCase().includes('cabo')
        ? query
        : `${query}, Cabo de Santo Agostinho, PE`

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryTerm)}&limit=4&addressdetails=1`
      )
      if (res.ok) {
        const data = await res.json()
        setGoogleAddressSuggestions(prev => ({ ...prev, [locId]: data || [] }))
      }
    } catch (err) {
      console.warn('Geocoding autocomplete search error:', err)
    } finally {
      setIsSearchingGoogleMap(prev => ({ ...prev, [locId]: false }))
    }
  }, [])

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const fetchStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const fetchEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(fetchStart, fetchEnd)
  const { data: frequenciasData = [] } = useQuery<any[]>({
    queryKey: ['frequencia-periodo', fetchStart, fetchEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('frequencia')
        .select('funcionario_id, data, status')
        .gte('data', fetchStart)
        .lte('data', fetchEnd)
      return data || []
    }
  })
  const { data: dbSetores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: dbLocalidades = [] } = useConfiguracao<Localidade[]>('localidades', [])
  const { data: dbSetoresEquipes = {} } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const { data: plataformaNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')

  useEffect(() => {
    let isMounted = true
    const dStr = format(currentDate, 'yyyy-MM-dd')
    const timer = setTimeout(() => {
      fetchHistoricalAIContext(dStr).then(({ escalas, frequencias }) => {
        if (!isMounted) return
        const locMap: Record<string, string> = {}
        dbLocalidades.forEach((l: any) => { if (l.nome && l.setor) locMap[normStr(l.nome)] = l.setor })
        const engine = buildAIEngine(escalas, frequencias, allFuncionarios, locMap)
        setAiEngine(engine)
      })
    }, 250)
    return () => { 
      isMounted = false
      clearTimeout(timer)
    }
  }, [currentDate, allFuncionarios.length, dbLocalidades.length])
  const setores = useMemo(() => {
    let list: string[] = []
    if (teamInfo?.isRestricted) {
      const allowedIds = teamInfo.teamIds || []
      // Mostra todos os setores de todas as equipes do encarregado
      const teamSectors = allowedIds.flatMap(id => dbSetoresEquipes[id] || [])
      list = Array.from(new Set(teamSectors))
    } else if (selectedTeamId) {
      const teamSectors = dbSetoresEquipes[selectedTeamId] || []
      if (teamSectors.length > 0) list = teamSectors
      else list = dbSetores
    } else {
      list = dbSetores
    }
    // Garante que qualquer setor presente nas localidades cadastradas também seja incluído
    const locSectors = dbLocalidades.map(l => l.setor).filter(Boolean)
    const allSetoresSet = new Set([...list, ...locSectors])

    // Ordem dos setores: padrão principal primeiro ('Varrição', 'Orla', 'Porta a Porta'), depois alfabética/numérica
    const defaultOrder = ['Varrição', 'Orla', 'Porta a Porta']
    return Array.from(allSetoresSet).sort((a, b) => {
      const idxA = defaultOrder.indexOf(a)
      const idxB = defaultOrder.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
    })
  }, [dbSetores, selectedTeamId, dbSetoresEquipes, teamInfo, dbLocalidades])

  const visibleSetores = useMemo(() => {
    if (!filterSetor) return setores
    return setores.filter(s => s === filterSetor)
  }, [setores, filterSetor])

  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])

  const localidadesConfig = useMemo(() => {
    let result = []
    if (teamInfo?.isRestricted) {
      const allowedIds = teamInfo.teamIds || []
      // Mostra apenas as localidades de todas as equipes do encarregado
      result = dbLocalidades.filter(l => l.equipe_id && allowedIds.includes(l.equipe_id))
    } else if (selectedTeamId) {
      const allowedSectors = dbSetoresEquipes[selectedTeamId] || []
      result = dbLocalidades.filter(l => 
        l.equipe_id === selectedTeamId ||
        (l.setor && allowedSectors.includes(l.setor))
      )
    } else {
      result = dbLocalidades
    }

    // Filter by operational schedule (Segunda a Sábado vs Domingos e Feriados)
    const targetDateStr = format(currentDate, 'yyyy-MM-dd')
    const isSun = isSunday(currentDate)
    const isFer = feriados.some((f: any) => f.data === targetDateStr)
    const isSpecialDay = isSun || isFer

    const dayFiltered = result.filter(l => {
      const schedule = l.dias_operacionais || 'segunda_sabado'
      if (schedule === 'todos') return true
      if (isSpecialDay) {
        return schedule === 'domingo_feriado'
      } else {
        return schedule === 'segunda_sabado'
      }
    })

    // Use dayFiltered if it has matches, otherwise fallback to result so empty teams are avoided
    const finalResult = dayFiltered.length > 0 ? dayFiltered : result

    return [...finalResult].sort((a, b) => {
      const teamA = allTeams.find(t => t.id === a.equipe_id)
      const teamB = allTeams.find(t => t.id === b.equipe_id)
      
      // Se apenas a tiver equipe vinculada, vem antes
      if (teamA && !teamB) return -1
      if (!teamA && teamB) return 1
      
      // Se ambas tiverem equipe vinculada, compara os nomes das equipes numericamente
      if (teamA && teamB) {
        const teamComp = teamA.nome.localeCompare(teamB.nome, 'pt-BR', { numeric: true, sensitivity: 'base' })
        if (teamComp !== 0) return teamComp
      }
      
      // Se estiverem na mesma equipe (ou ambas sem equipe), compara o nome da localidade numericamente
      return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' })
    })
  }, [dbLocalidades, selectedTeamId, teamInfo, dbSetoresEquipes, allTeams, currentDate, feriados])
  const { data: dbTiposEscala } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
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

  const batchMutation = useBatchUpsertEscalas()
  const updateMutation = useUpdateEscala()

  const filteredFuncionarios = useMemo(() => {
    const targetDStr = format(currentDate, 'yyyy-MM-dd')
    let list = allFuncionarios.filter(f => !f.data_desligamento || f.data_desligamento > targetDStr)
    
    const activeTeamId = teamInfo?.isRestricted ? (teamInfo.teamIds?.[0] || null) : selectedTeamId
    const borrowedByOthers = borrowedMembers.filter((bm: any) => bm.equipe_id !== activeTeamId)
    const borrowedByOthersIds = new Set(borrowedByOthers.map((bm: any) => String(bm.funcionario_id).trim()))
    
    list = list.filter(f => !borrowedByOthersIds.has(String(f.id).trim()))

    if (teamInfo?.isRestricted) {
      // Mostra apenas os funcionários de todas as equipes do encarregado + os emprestados
      const supervisorTeamIds = teamInfo.teamIds || []
      const borrowedForDay = borrowedMembers
        .filter((bm: any) => supervisorTeamIds.includes(bm.equipe_id))
        .map((bm: any) => String(bm.funcionario_id).trim())
      const allowedIds = [...(teamInfo.teamMemberIds || []).map((id: any) => String(id).trim()), ...borrowedForDay]
      return list.filter(f => allowedIds.includes(String(f.id).trim()))
    }
    if (selectedTeamId) {
      const allowedSectors = dbSetoresEquipes[selectedTeamId] || []
      const borrowedForDay = borrowedMembers
        .filter((bm: any) => bm.equipe_id === selectedTeamId)
        .map((bm: any) => String(bm.funcionario_id).trim())
      const allowedIds = [...(selectedTeamMembers || []).map((id: any) => String(id).trim()), ...borrowedForDay]
      return list.filter(f => 
        allowedIds.includes(String(f.id).trim()) ||
        (f.setor && allowedSectors.includes(f.setor))
      )
    }
    return list
  }, [allFuncionarios, currentDate, selectedTeamId, teamInfo, dbSetoresEquipes, borrowedMembers, selectedTeamMembers])

  // Helpers
  const dateKey = `equipes_meta_${dateStr}`
  const { data: equipesMeta = {} } = useConfiguracao<Record<string, { ruas?: string; lider_id?: string; locais?: string[]; demandas?: string[]; funcoes?: Record<string, string> }>>(dateKey, {})
  const { data: dbSugestoes = [] } = useConfiguracao<string[]>('sugestoes_locais', [])
  const { data: globalDemandas = [] } = useConfiguracao<Demanda[]>('demandas', [])
  const { data: demandasHistorico = [] } = useConfiguracao<any[]>('demandas_historico', [])
  const { mutateAsync: updateConfigMut } = useUpdateConfiguracao()
  const updateConfig = updateConfigMut  // Single Unified Migration & Synchronization Effect to prevent race conditions on page load
  useEffect(() => {
    const runMigrationAndSync = async () => {
      try {
        // 1. Fetch current global demands
        const { data: currentDemResponse } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'demandas')
          .maybeSingle()
        
        let globalDemList = Array.isArray(currentDemResponse?.valor) ? (currentDemResponse.valor as Demanda[]) : []
        const globalDemMap = new Map<string, Demanda>()
        globalDemList.forEach(d => {
          if (d && d.titulo) {
            globalDemMap.set(d.titulo.trim().toLowerCase(), d)
          }
        })
        
        // 2. Fetch current sugestoes_locais
        const { data: currentSugResponse } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'sugestoes_locais')
          .maybeSingle()
        
        let sugestoesList = Array.isArray(currentSugResponse?.valor) ? (currentSugResponse.valor as string[]) : []
        const sugestoesSet = new Set<string>(sugestoesList.map(s => s.trim().toLowerCase()))
        
        // 3. Fetch all team metas (equipes_meta_%)
        const { data: allMetas, error: metasError } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .like('chave', 'equipes_meta_%')
        
        if (metasError) {
          console.error('Error fetching equipes_meta for migration:', metasError)
          return
        }

        let globalDemandsChanged = false
        let sugestoesChanged = false
        
        const getOrCreateDemId = (title: string) => {
          const trimmed = title.trim()
          if (!trimmed) return null
          const key = trimmed.toLowerCase()
          if (globalDemMap.has(key)) {
            return globalDemMap.get(key)!.id
          }
          
          // Generate new demand
          const newDem: Demanda = {
            id: safeUUID(),
            titulo: trimmed.toUpperCase(),
            tipo: 'check',
            concluido: false
          }
          globalDemList.push(newDem)
          globalDemMap.set(key, newDem)
          globalDemandsChanged = true
          return newDem.id
        }

        // A. Add existing team locais and ruas to sugestoes_locais if missing
        allMetas?.forEach(row => {
          const meta = row.valor || {}
          Object.values(meta).forEach((teamMeta: any) => {
            if (teamMeta && Array.isArray(teamMeta.locais)) {
              teamMeta.locais.forEach((local: string) => {
                if (local && typeof local === 'string') {
                  const trimmed = local.trim()
                  if (trimmed && !sugestoesSet.has(trimmed.toLowerCase())) {
                    sugestoesList.push(trimmed)
                    sugestoesSet.add(trimmed.toLowerCase())
                    sugestoesChanged = true
                  }
                }
              })
            }
          })
        })

        // B. Ensure all suggestions are synchronized to the global demands list
        sugestoesList.forEach(sug => {
          if (sug && typeof sug === 'string') {
            getOrCreateDemId(sug)
          }
        })

        // C. Migrate team metas: if a team has no "demandas" array but has "locais" or "ruas", map them
        const recordsToMigrate: { chave: string; valor: any }[] = []
        allMetas?.forEach(row => {
          const meta = row.valor || {}
          let rowChanged = false
          const updatedMeta = { ...meta }
          
          Object.keys(meta).forEach(teamId => {
            const teamMeta = meta[teamId] || {}
            if (!teamMeta.demandas) {
              const oldLocais = Array.isArray(teamMeta.locais) ? teamMeta.locais : []
              const oldRuas = teamMeta.ruas ? [teamMeta.ruas] : []
              const allStrings = Array.from(new Set([...oldLocais, ...oldRuas].map(s => s.trim()).filter(Boolean)))
              
              if (allStrings.length > 0) {
                const demandIds = allStrings.map(str => getOrCreateDemId(str)).filter(Boolean) as string[]
                updatedMeta[teamId] = {
                  ...teamMeta,
                  demandas: demandIds
                }
                rowChanged = true
              }
            }
          })
          
          if (rowChanged) {
            recordsToMigrate.push({ chave: row.chave, valor: updatedMeta })
          }
        })

        // D. Save updates to database sequentially/atomically to avoid conflict
        if (globalDemandsChanged) {
          await supabase
            .from('configuracoes')
            .upsert({
              chave: 'demandas',
              valor: globalDemList,
              updated_at: new Date().toISOString()
            }, { onConflict: 'chave' })
          queryClient.invalidateQueries({ queryKey: ['configuracoes', 'demandas'] })
        }

        if (sugestoesChanged) {
          await supabase
            .from('configuracoes')
            .upsert({
              chave: 'sugestoes_locais',
              valor: sugestoesList,
              updated_at: new Date().toISOString()
            }, { onConflict: 'chave' })
          queryClient.invalidateQueries({ queryKey: ['configuracoes', 'sugestoes_locais'] })
        }

        if (recordsToMigrate.length > 0) {
          for (const rec of recordsToMigrate) {
            await supabase
              .from('configuracoes')
              .upsert({
                chave: rec.chave,
                valor: rec.valor,
                updated_at: new Date().toISOString()
              }, { onConflict: 'chave' })
          }
          queryClient.invalidateQueries({ queryKey: ['configuracoes', dateKey] })
        }
      } catch (err) {
        console.error('Error in unified migration and sync process:', err)
      }
    }

    runMigrationAndSync()
  }, [queryClient, dateKey])

  const getTeamDemandaTitles = useCallback((locId: string): string[] => {
    const meta = equipesMeta[locId]
    if (!meta) return []
    if (meta.demandas) {
      return meta.demandas
        .map(id => globalDemandas.find(d => d.id === id)?.titulo)
        .filter(Boolean) as string[]
    }
    return meta.locais || []
  }, [equipesMeta, globalDemandas])

  const [focusedInputLocId, setFocusedInputLocId] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)

  const handleUpdateMeta = async (locId: string, updates: { ruas?: string; lider_id?: string; locais?: string[]; funcoes?: Record<string, string>; demandas?: string[] }) => {
    const currentMeta = equipesMeta[locId] || { ruas: '', lider_id: '', locais: [], funcoes: {} }
    await updateConfig({ chave: dateKey, valor: { ...equipesMeta, [locId]: { ...currentMeta, ...updates } } })
    clearSearch()
  }

  const handleConfirmRegisterDemand = async (tipo: 'realizada' | 'continuo') => {
    if (!registerDemandModal) return
    const { dem, loc } = registerDemandModal
    
    try {
      const newEntry = {
        id: safeUUID(),
        demandaId: dem.id,
        demandaTitulo: dem.titulo,
        data: dateStr,
        equipeId: loc.id,
        equipeNome: loc.nome,
        tipo: tipo
      }
      const updatedHistory = [newEntry, ...demandasHistorico]
      await updateConfig({ chave: 'demandas_historico', valor: updatedHistory })
      toast(tipo === 'realizada' ? 'Demanda realizada registrada!' : 'Serviço em progresso registrado!', 'success')
      setRegisterDemandModal(null)
    } catch (err) {
      console.error(err)
      toast('Erro ao registrar demanda.', 'error')
    }
  }

  const handleAddLocal = async (locId: string, val: string) => {
    const trimmedVal = val.trim()
    if (!trimmedVal) return

    const currentLocais = equipesMeta[locId]?.locais || []
    const existsInTeam = currentLocais.some(l => l.toLowerCase() === trimmedVal.toLowerCase())
    
    if (!existsInTeam) {
      const updatedLocais = [...currentLocais, trimmedVal]
      await handleUpdateMeta(locId, { locais: updatedLocais })
      
      const existsInSug = dbSugestoes.some(s => s.toLowerCase() === trimmedVal.toLowerCase())
      if (!existsInSug) {
        const updatedSug = [...dbSugestoes, trimmedVal]
        await updateConfig({ chave: 'sugestoes_locais', valor: updatedSug })
      }
    }
  }

  const weekDays = useMemo(() => {
    return eachDayOfInterval({ 
      start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
      end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
    })
  }, [currentDate])

  const funcMap = useMemo(() => {
    const map: Record<string, Funcionario> = {}
    filteredFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') map[f.id] = f
    })
    return map
  }, [filteredFuncionarios])

  const workingStatus = ['presente', 'hora_extra', 'falta']

  const escalaMap = useMemo(() => {
    const map: Record<string, any> = {}
    if (Array.isArray(escalas)) {
      escalas.forEach((e: any) => {
        if (!e || e.funcionario_id === undefined || e.funcionario_id === null || !e.data) return
        const fIdRaw = String(e.funcionario_id)
        const fIdTrim = fIdRaw.trim()
        const eDate = String(e.data).substring(0, 10)
        
        map[`${fIdTrim}_${eDate}`] = e
        map[`${fIdRaw}_${eDate}`] = e
        map[`${e.funcionario_id}_${eDate}`] = e
      })
    }
    return map
  }, [escalas])

  const freqMap = useMemo(() => {
    const map: Record<string, any> = {}
    if (Array.isArray(frequenciasData)) {
      frequenciasData.forEach((f: any) => {
        if (!f || f.funcionario_id === undefined || f.funcionario_id === null || !f.data) return
        const fIdRaw = String(f.funcionario_id)
        const fIdTrim = fIdRaw.trim()
        const fDate = String(f.data).substring(0, 10)
        
        map[`${fIdTrim}_${fDate}`] = f
        map[`${fIdRaw}_${fDate}`] = f
        map[`${f.funcionario_id}_${fDate}`] = f
      })
    }
    return map
  }, [frequenciasData])

  // ── CENTRALIZED STATUS HELPER ──
  // Single source of truth: determines if a given employee is working on a given date.
  // Returns: { isTrabalhando, tipo, escala, isAlocado }
  const getEmployeeStatus = useCallback((funcId: string, targetDateStr: string) => {
    const normLoc = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
    const targetDate = parseLocalDate(targetDateStr)
    const isDomingo = isSunday(targetDate)
    const fIdStr = String(funcId).trim()
    const e = escalaMap[`${fIdStr}_${targetDateStr}`] || escalaMap[`${funcId}_${targetDateStr}`]
    const freq = freqMap[`${fIdStr}_${targetDateStr}`] || freqMap[`${funcId}_${targetDateStr}`]
    const funcObj = allFuncionarios.find(f => String(f.id).trim() === fIdStr)
    const isDesligado = !!(funcObj?.data_desligamento && targetDateStr >= funcObj.data_desligamento)

    let isTrabalhando = false
    let tipo = 'presente'

    const normEscLoc = e && e.localidade ? normLoc(e.localidade) : ""
    const isSemLocalStr = !normEscLoc || normEscLoc === "sem local" || normEscLoc === "sem_local" || normEscLoc === "nenhum" || normEscLoc === "nao definido"
    const hasAssignedLocality = !isSemLocalStr

    const isAbsence = (s?: string) => {
      if (!s) return false
      const norm = s.toLowerCase().trim()
      return ['falta', 'atestado', 'ferias', 'feria', 'suspensao', 'suspenso', 'licenca', 'afastamento', 'afastado'].includes(norm)
    }

    const isFolga = (s?: string) => {
      if (!s) return false
      const norm = s.toLowerCase().trim()
      return ['repouso', 'compensar', 'folga', 'folga_domingo', 'folga_feriado', 'descanso'].includes(norm)
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
      // Frequency record (actual presence/absence) takes highest precedence
      const freqStatus = String(freq.status).toLowerCase().trim()
      if (isAbsence(freqStatus) || isFolga(freqStatus)) {
        isTrabalhando = false
        tipo = freq.status
      } else if (isWork(freqStatus)) {
        isTrabalhando = true
        tipo = freq.status
      } else {
        isTrabalhando = !isDomingo
        tipo = freq.status || (isDomingo ? 'repouso' : 'presente')
      }
    } else if (e) {
      // Scale record (planned work/absence/folga)
      const normTipo = e.tipo ? String(e.tipo).toLowerCase().trim() : ''
      if (isAbsence(normTipo) || isFolga(normTipo)) {
        isTrabalhando = false
        tipo = e.tipo
      } else if (isWork(normTipo)) {
        isTrabalhando = true
        tipo = e.tipo || 'presente'
      } else {
        isTrabalhando = !isDomingo
        tipo = e.tipo || (isDomingo ? 'repouso' : 'presente')
      }
    } else {
      // No record in DB for this date:
      // Weekdays default to working ('presente').
      // Sundays default to off ('repouso').
      isTrabalhando = !isDomingo
      tipo = isDomingo ? 'repouso' : 'presente'
    }

    const isValidLocality = hasAssignedLocality && (
      dbLocalidades.some(l => normLoc(l.nome) === normEscLoc) ||
      localidadesConfig.some(l => normLoc(l.nome) === normEscLoc)
    )
    const isAlocado = !isDesligado && isTrabalhando && (isValidLocality || hasAssignedLocality)

    return { isTrabalhando, tipo, escala: e, isAlocado, hasOrphanedLocality: !!(hasAssignedLocality && !isValidLocality) }
  }, [escalaMap, freqMap, allFuncionarios, dbLocalidades, localidadesConfig])

  // Logic for daily view: locality -> employees
  const dailyDistribution = useMemo(() => {
    const normLoc = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
    const dist: Record<string, { id: string; nome: string; apelido?: string | null; setor: string; escalaId: string; tipo: string }[]> = {}
    localidadesConfig.forEach(l => { dist[l.id] = [] })
    dist['sem_local'] = []

    filteredFuncionarios.forEach((f) => {
      if (f.cargo?.toLowerCase() === 'encarregado') return

      const { isTrabalhando, tipo, escala, isAlocado } = getEmployeeStatus(f.id, dateStr)

      if (!isTrabalhando) return
      if (!isAlocado || !escala || !escala.localidade) return // Not allocated to any location — skip (will appear in avulsos)

      const normEscLoc = normLoc(escala.localidade)
      const loc = localidadesConfig.find(l => normLoc(l.nome) === normEscLoc)
      const locKey = loc ? loc.id : 'sem_local'
      if (!dist[locKey]) dist[locKey] = []
      dist[locKey].push({ 
        id: f.id, 
        nome: f.nome, 
        apelido: f.apelido, 
        setor: f.setor || '', 
        escalaId: escala.id, 
        tipo: tipo 
      })
    })

    // Sort each locality's team list to place the leader first and group by function
    Object.keys(dist).forEach((locId) => {
      const leaderId = equipesMeta[locId]?.lider_id
      dist[locId].sort((a, b) => {
        // 1. Leader first
        const aIsLider = a.id === leaderId
        const bIsLider = b.id === leaderId
        if (aIsLider && !bIsLider) return -1
        if (!aIsLider && bIsLider) return 1

        // 2. Group same functions together
        const aFuncao = equipesMeta[locId]?.funcoes?.[a.id]
        const bFuncao = equipesMeta[locId]?.funcoes?.[b.id]

        if (aFuncao && !bFuncao) return -1
        if (!aFuncao && bFuncao) return 1

        if (aFuncao && bFuncao && aFuncao !== bFuncao) {
          const aIndex = dynamicFuncoes.findIndex(f => f.id === aFuncao)
          const bIndex = dynamicFuncoes.findIndex(f => f.id === bFuncao)
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
        }

        // 3. Fallback: alphabetical name order
        const aName = a.apelido || a.nome
        const bName = b.apelido || b.nome
        return aName.localeCompare(bName)
      })
    })

    return dist
  }, [escalaMap, dateStr, filteredFuncionarios, localidadesConfig, getEmployeeStatus, equipesMeta, dynamicFuncoes])

  const getEmployeeDisplayName = useCallback((f: { id: string; nome: string; apelido?: string | null }) => {
    if (f.apelido?.trim()) {
      return f.apelido.trim()
    }

    const prepositions = ['de', 'da', 'do', 'dos', 'das', 'e']
    const parts = f.nome.trim().split(/\s+/).filter(word => !prepositions.includes(word.toLowerCase()))
    
    const firstName = parts[0] || ''
    const secondName = parts.length > 1 ? parts[1] : ''
    const baseShortName = secondName ? `${firstName} ${secondName}` : firstName

    const hasCollision = allFuncionarios.some(other => {
      if (other.id === f.id) return false
      
      const op = other.nome.trim().split(/\s+/).filter(word => !prepositions.includes(word.toLowerCase()))
      const ofirst = op[0] || ''
      const osecond = op.length > 1 ? op[1] : ''
      const otherShortName = osecond ? `${ofirst} ${osecond}` : ofirst

      if (otherShortName.toLowerCase() !== baseShortName.toLowerCase()) {
        return false
      }

      // Check if they are in the same team today
      let fLocId = ''
      for (const [locId, members] of Object.entries(dailyDistribution)) {
        if (members.some(m => m.id === f.id)) {
          fLocId = locId
          break
        }
      }

      let otherLocId = ''
      for (const [locId, members] of Object.entries(dailyDistribution)) {
        if (members.some(m => m.id === other.id)) {
          otherLocId = locId
          break
        }
      }

      return !!(fLocId && fLocId === otherLocId)
    })

    if (hasCollision && parts.length > 2) {
      const thirdName = parts[2]
      return `${firstName} ${thirdName}`
    }

    return baseShortName
  }, [allFuncionarios, dailyDistribution])

  const getDailyMessageText = useCallback((mode: 'completo' | 'enxuto' | 'apenas_localidades' | 'tipo_equipe' | 'demandas_realizadas' = 'completo') => {
    let dateText = ''
    try {
      const parsedDate = parseLocalDate(dateStr)
      dateText = `${format(parsedDate, "dd/MM/yyyy")} (${format(parsedDate, "eeee", { locale: ptBR })})`
    } catch {
      dateText = dateStr
    }

    if (mode === 'apenas_localidades') {
      let text = `📍 ESCALA 📅 ${dateText.toUpperCase()}\n\n`

      let totalSectionsCount = 0

      localidadesConfig.forEach(loc => {
        const members = dailyDistribution[loc.id] || []
        const activeMembers = members.filter((m: any) => m.tipo !== 'falta')
        if (activeMembers.length === 0) return

        totalSectionsCount++

        const names = activeMembers.map((m: any) => getEmployeeDisplayName(m).toUpperCase())
        let formattedNames = ''
        if (names.length === 1) {
          formattedNames = names[0]
        } else if (names.length === 2) {
          formattedNames = `${names[0]} e ${names[1]}`
        } else if (names.length > 2) {
          formattedNames = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
        }

        text += `📍 ${loc.nome}: ${formattedNames}\n`
      })

      if (totalSectionsCount === 0) {
        text += `⚠️ NENHUMA ALOCAÇÃO ATIVA HOJE.\n`
      }

      return text
    }

    if (mode === 'tipo_equipe') {
      let text = `🚀 *ROTEIRO OPERACIONAL POR SETOR* 🚀\n`
      text += `📅 *DATA:* ${dateText}\n`
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`

      interface AdminTeamTypeGroup {
        teamName: string;
        equipeId: string;
        typeLabel: string;
        locais: string[];
        totalFuncs: number;
        rocadeiras: number;
      }

      const groups: Record<string, AdminTeamTypeGroup> = {}

      localidadesConfig.forEach(loc => {
        const members = dailyDistribution[loc.id] || []
        const activeMembers = members.filter((m: any) => m.tipo !== 'falta')
        if (activeMembers.length === 0) return

        const equipeId = loc.equipe_id || 'Geral'
        const adminTeam = allTeams.find(t => t.id === equipeId)
        const teamName = adminTeam ? adminTeam.nome : 'GERAL'

        // Determine team type (varrição, capinação, roçadeira) for this local card
        const sectorLower = (loc.setor || '').toLowerCase()
        const nameLower = (loc.nome || '').toLowerCase()
        const adminNameLower = teamName.toLowerCase()

        let typeLabel = 'OUTROS'
        if (sectorLower.includes('varri') || nameLower.includes('varri') || adminNameLower.includes('varri')) {
          typeLabel = 'VARRIÇÃO'
        } else if (sectorLower.includes('capin') || nameLower.includes('capin') || adminNameLower.includes('capin')) {
          typeLabel = 'CAPINAÇÃO'
        } else if (sectorLower.includes('roçad') || sectorLower.includes('rocad') || sectorLower.includes('roçadeira') ||
                   nameLower.includes('roçad') || nameLower.includes('rocad') || nameLower.includes('roçadeira') ||
                   adminNameLower.includes('roçad') || adminNameLower.includes('rocad') || adminNameLower.includes('roçadeira')) {
          typeLabel = 'ROÇADEIRA'
        } else if (sectorLower.includes('catac') || sectorLower.includes('catação') || sectorLower.includes('catador') ||
                   nameLower.includes('catac') || nameLower.includes('catação') || nameLower.includes('catador') ||
                   adminNameLower.includes('catac') || adminNameLower.includes('catação') || adminNameLower.includes('catador')) {
          typeLabel = 'CATAÇÃO'
        }

        const teamLocais = getTeamDemandaTitles(loc.id)
        const locs = teamLocais.length > 0 
          ? teamLocais.map(l => l.trim().toUpperCase()).sort() 
          : ['CONFORME ESCALA']
        const locationText = locs.join(' / ')

        const groupKey = typeLabel === 'ROÇADEIRA' ? `${equipeId} @@@ ${typeLabel} @@@ ${locationText}` : `${equipeId} @@@ ${typeLabel}`

        if (!groups[groupKey]) {
          groups[groupKey] = {
            teamName,
            equipeId,
            typeLabel,
            locais: [],
            totalFuncs: 0,
            rocadeiras: 0
          }
        }

        teamLocais.forEach(l => {
          const trimmed = l.trim().toUpperCase()
          if (trimmed && !groups[groupKey].locais.includes(trimmed)) {
            groups[groupKey].locais.push(trimmed)
          }
        })

        activeMembers.forEach((m: any) => {
          const funcRoleKey = equipesMeta[loc.id]?.funcoes?.[m.id]
          const roleObj = dynamicFuncoes.find(rf => rf.id === funcRoleKey)
          const isRocador = funcRoleKey === 'rocador' || 
                            (roleObj && roleObj.nome.toLowerCase().includes('roçador')) || 
                            (m.cargo && m.cargo.toLowerCase().includes('roçador'))

          groups[groupKey].totalFuncs++
          if (isRocador) {
            groups[groupKey].rocadeiras++
          }
        })
      })

      const groupKeys = Object.keys(groups).sort((a, b) => {
        const comp = groups[a].teamName.localeCompare(groups[b].teamName, 'pt-BR')
        if (comp !== 0) return comp
        const compType = groups[a].typeLabel.localeCompare(groups[b].typeLabel, 'pt-BR')
        if (compType !== 0) return compType
        return groups[a].locais.join(' ').localeCompare(groups[b].locais.join(' '), 'pt-BR')
      })

      if (groupKeys.length === 0) {
        text += `\n❌ NENHUMA ALOCAÇÃO ATIVA REGISTRADA.\n`
      } else {
        groupKeys.forEach(key => {
          const g = groups[key]
          const locaisListText = g.locais.length > 0 
            ? g.locais.join(' / ') 
            : 'CONFORME ESCALA'

          text += `\n👥 *EQUIPE:* ${g.teamName.toUpperCase()} - ${g.typeLabel}\n`
          
          if (g.typeLabel === 'ROÇADEIRA') {
            text += `⚡ *QUANTIDADE:* ${g.rocadeiras} ${g.rocadeiras === 1 ? 'ROÇADEIRA' : 'ROÇADEIRAS'} E ${g.totalFuncs} ${g.totalFuncs === 1 ? 'COLABORADOR' : 'COLABORADORES'}\n`
          } else {
            text += `👷 *QUANTIDADE:* ${g.totalFuncs} ${g.totalFuncs === 1 ? 'COLABORADOR' : 'COLABORADORES'}\n`
          }
          
          text += `📍 *LOCAIS/RUAS:* ${locaisListText}\n`
          text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        })
      }

      return text.toUpperCase()
    }

    if (mode === 'demandas_realizadas') {
      let text = `📋 *RELATÓRIO DE DEMANDAS DO DIA* 📋\n`
      text += `📅 *DATA:* ${dateText}\n`
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

      let totalSectionsCount = 0

      localidadesConfig.forEach(loc => {
        const meta = equipesMeta[loc.id]
        const linkedDemIds = (meta && Array.isArray(meta.demandas)) ? meta.demandas : []

        // Find all completions recorded for this team today
        const teamCompletions = demandasHistorico.filter(
          h => h.data === dateStr && h.equipeId === loc.id
        )

        const items: string[] = []

        // 1. Process linked demands
        linkedDemIds.forEach((demId: string) => {
          const dem = globalDemandas.find(d => d.id === demId)
          if (!dem) return

          const comps = teamCompletions.filter(c => c.demandaId === demId)
          if (comps.length > 0) {
            comps.forEach(comp => {
              const label = comp.tipo === 'continuo'
                ? `🔁 *${dem.titulo.toUpperCase()}*`
                : `✅ *${dem.titulo.toUpperCase()}*`
              if (!items.includes(label)) {
                items.push(label)
              }
            })
          } else {
            const label = `❌ *${dem.titulo.toUpperCase()}*`
            if (!items.includes(label)) {
              items.push(label)
            }
          }
        })

        // 2. Process non-linked completions for this team
        teamCompletions.forEach(comp => {
          if (linkedDemIds.includes(comp.demandaId)) return

          const label = comp.tipo === 'continuo'
            ? `🔁 *${comp.demandaTitulo.toUpperCase()}*`
            : `✅ *${comp.demandaTitulo.toUpperCase()}*`
          if (!items.includes(label)) {
            items.push(label)
          }
        })

        // Group print
        if (items.length > 0) {
          totalSectionsCount++
          text += `👥 *EQUIPE: ${loc.nome.toUpperCase()}*\n`
          text += items.join('\n') + '\n'
          text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
        }
      })

      // General/direct completions (not linked to any active team config)
      const generalCompletions = demandasHistorico.filter(
        h => h.data === dateStr && (!h.equipeId || !localidadesConfig.some(loc => loc.id === h.equipeId))
      )

      if (generalCompletions.length > 0) {
        totalSectionsCount++
        const items: string[] = []

        generalCompletions.forEach(comp => {
          const teamName = comp.equipeNome || 'GERAL/DIRETO'
          const label = comp.tipo === 'continuo'
            ? `🔁 *${comp.demandaTitulo.toUpperCase()}* (${teamName.toUpperCase()})`
            : `✅ *${comp.demandaTitulo.toUpperCase()}* (${teamName.toUpperCase()})`
          if (!items.includes(label)) {
            items.push(label)
          }
        })

        text += `👥 *AVULSOS / OUTROS*\n`
        text += items.join('\n') + '\n'
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      }

      if (totalSectionsCount === 0) {
        text += `⚠️ NENHUMA DEMANDA VINCULADA OU REALIZADA HOJE.\n\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }

      return text.toUpperCase()
    }

    if (mode === 'enxuto') {
      let text = `🚀 *ROTEIRO OPERACIONAL RESUMIDO* 🚀\n`
      text += `📅 *DATA:* ${dateText}\n`
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`

      localidadesConfig.forEach(loc => {
        const members = dailyDistribution[loc.id] || []
        const activeMembers = members.filter((m: any) => m.tipo !== 'falta')
        if (activeMembers.length === 0) return

        const leaderId = equipesMeta[loc.id]?.lider_id
        const leaderObj = allFuncionarios.find(f => f.id === leaderId)
        
        let leaderName = 'NÃO DEFINIDO'
        if (leaderObj) {
          const { tipo } = getEmployeeStatus(leaderObj.id, dateStr)
          const isFalta = tipo === 'falta'
          leaderName = `${getEmployeeDisplayName(leaderObj)}${isFalta ? ' (AUSENTE/FALTA)' : ''}`
        }

        const locais = getTeamDemandaTitles(loc.id)
        const locaisText = locais.length > 0 
          ? locais.map(l => `  🔹 ${l.trim()}`).join('\n') 
          : '  🔹 CONFORME ESCALA'

        text += `\n👥 *EQUIPE:* ${loc.nome}\n`
        text += `👑 *LÍDER:* ${leaderName}\n`
        text += `👷 *EFETIVO:* ${activeMembers.length} COLABORADORES\n`
        text += `🗺️ *LOCAIS/RUAS:*\n${locaisText}\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      })

      return text.toUpperCase()
    }

    // Modo Completo
    let text = `🚀 *ROTEIRO OPERACIONAL DE TRABALHO* 🚀\n`
    text += `📅 *DATA:* ${dateText}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`

    localidadesConfig.forEach(loc => {
      const members = dailyDistribution[loc.id] || []
      const activeMembers = members.filter((m: any) => m.tipo !== 'falta')
      if (activeMembers.length === 0) return

      const leaderId = equipesMeta[loc.id]?.lider_id
      const leaderObj = allFuncionarios.find(f => f.id === leaderId)
      
      let leaderName = 'NÃO DEFINIDO'
      if (leaderObj) {
        const { tipo } = getEmployeeStatus(leaderObj.id, dateStr)
        const isFalta = tipo === 'falta'
        leaderName = `${getEmployeeDisplayName(leaderObj)}${isFalta ? ' (AUSENTE/FALTA)' : ''}`
      }

      const locais = getTeamDemandaTitles(loc.id)
      const locaisText = locais.length > 0 
        ? locais.map(l => `  🔹 ${l.trim()}`).join('\n') 
        : '  🔹 CONFORME ESCALA'

      text += `\n👥 *EQUIPE:* ${loc.nome}\n`
      text += `👑 *LÍDER:* ${leaderName}\n`
      text += `🗺️ *LOCAIS/RUAS:*\n${locaisText}\n`
      text += `👷 *INTEGRANTES:* \n`

      activeMembers.forEach((m: any, idx: number) => {
        const funcRoleKey = equipesMeta[loc.id]?.funcoes?.[m.id]
        const roleObj = dynamicFuncoes.find(rf => rf.id === funcRoleKey)
        const roleLabel = roleObj ? roleObj.nome : (m.cargo || 'AUXILIAR')
        
        const isLider = m.id === leaderId
        const leaderTag = isLider ? ' 👑 (LÍDER)' : ''

        const numLabel = idx < 10 
          ? ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][idx] 
          : `${idx + 1}.`

        const isRocador = funcRoleKey === 'rocador' || 
                          (roleObj && roleObj.nome.toLowerCase().includes('roçador')) || 
                          (m.cargo && m.cargo.toLowerCase().includes('roçador'))
        const rocadorTag = isRocador ? ' ⚡' : ''

        text += `  ${numLabel} *${getEmployeeDisplayName(m)}* - ${roleLabel}${leaderTag}${rocadorTag}\n`
      })
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    })

    return text.toUpperCase()
  }, [currentDate, dateStr, getEmployeeStatus, localidadesConfig, dailyDistribution, equipesMeta, allFuncionarios, dynamicFuncoes, getEmployeeDisplayName, allTeams, demandasHistorico, globalDemandas])

  // Employees who are working today but NOT allocated to any localidade
  const availableFuncs = useMemo(() => {
    return filteredFuncionarios.filter(f => {
      if (f.cargo?.toLowerCase() === 'encarregado') return false
      
      const { isTrabalhando, isAlocado } = getEmployeeStatus(f.id, dateStr)
      return isTrabalhando && !isAlocado
    })
  }, [filteredFuncionarios, dateStr, getEmployeeStatus])

  const sectorAvailableCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    availableFuncs.forEach(f => {
      const s = f.setor || 'Geral'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [availableFuncs])

  const sectorsToRenderForRules = useMemo(() => {
    const list = [...setores]
    if (!list.includes('Geral')) {
      list.push('Geral')
    }
    return list
  }, [setores])

  const filteredAvailableFuncs = useMemo(() => {
    let list = availableFuncs
    if (filterSetor) {
      list = list.filter(f => f.setor === filterSetor)
    }
    if (searchTerm) {
      list = list.filter(f => 
        matchesFuzzy(f.nome, searchTerm) || 
        (f.apelido && matchesFuzzy(f.apelido, searchTerm))
      )
    }
    return list
  }, [availableFuncs, searchTerm, filterSetor])

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return []
    return allFuncionarios.filter(f => {
      const matches = matchesFuzzy(f.nome, searchTerm) || 
                      (f.apelido && matchesFuzzy(f.apelido, searchTerm))
      return !!matches
    }).slice(0, 5)
  }, [allFuncionarios, searchTerm])

  // ── Smart Allocation Assistant Engine ──
  const calculateAssistantRecommendations = useCallback(async () => {
    setAssistantLoading(true)
    try {
      const targetDate = parseLocalDate(dateStr)
      const ninetyDaysAgo = subDays(targetDate, 90)

      const startStr = format(ninetyDaysAgo, 'yyyy-MM-dd')
      const tomorrow = addDays(targetDate, 1)
      const endStr = format(tomorrow, 'yyyy-MM-dd')

      // Helper to normalize locality strings (accent-insensitive & case-insensitive)
      const normLoc = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""

      // Map locality normalized names to their sector for fast lookup
      const locToSectorMap: Record<string, string> = {}
      localidadesConfig.forEach(l => {
        if (l.nome && l.setor) locToSectorMap[normLoc(l.nome)] = l.setor
      })
      dbLocalidades.forEach(l => {
        if (l.nome && l.setor) locToSectorMap[normLoc(l.nome)] = l.setor
      })

      // Fetch ALL records (including faltas, atestados, suspensões) - up to 5000 rows
      const { data: allHistoryData, error } = await supabase
        .from('escalas')
        .select('funcionario_id, localidade, data, tipo')
        .gte('data', startStr)
        .lte('data', endStr)
        .order('data', { ascending: false })
        .limit(5000)

      if (error) throw error

      const empLocHist: Record<string, Record<string, number>> = {}
      const empSetorHist: Record<string, Record<string, number>> = {}
      const dailyLocMembers: Record<string, Set<string>> = {}
      const empBehavior: Record<string, { totalDays: number; presentDays: number; faltaDays: number; atestadoDays: number; suspensaoDays: number; horaExtraDays: number; lastAbsenceDate: string | null; daysAwayBeforeReturn: number; totalEscalatedDays: number }> = {}
      const latestAllocationMap: Record<string, { localityName: string; date: string }> = {}
      const localityPatternMap: Record<string, Record<string, number>> = {}
      const recentActiveShifts: Record<string, string[]> = {}

      if (allHistoryData) {
        allHistoryData.forEach((row: any) => {
          if (!row.funcionario_id) return
          const fId = String(row.funcionario_id).trim()
          const tipo = row.tipo ? String(row.tipo).toLowerCase().trim() : 'presente'
          const dStrRow = row.data ? row.data.substring(0, 10) : ''

          if (!empBehavior[fId]) {
            empBehavior[fId] = { totalDays: 0, presentDays: 0, faltaDays: 0, atestadoDays: 0, suspensaoDays: 0, horaExtraDays: 0, lastAbsenceDate: null, daysAwayBeforeReturn: 0, totalEscalatedDays: 0 }
          }
          empBehavior[fId].totalDays++
          
          if (tipo === 'presente' || tipo === 'escala' || !tipo) empBehavior[fId].presentDays++
          else if (tipo === 'hora_extra') { empBehavior[fId].horaExtraDays++; empBehavior[fId].presentDays++ }
          if (tipo === 'falta') {
            empBehavior[fId].faltaDays++
            if (!empBehavior[fId].lastAbsenceDate || dStrRow > empBehavior[fId].lastAbsenceDate!) empBehavior[fId].lastAbsenceDate = dStrRow
          } else if (tipo === 'atestado') {
            empBehavior[fId].atestadoDays++
            if (!empBehavior[fId].lastAbsenceDate || dStrRow > empBehavior[fId].lastAbsenceDate!) empBehavior[fId].lastAbsenceDate = dStrRow
          } else if (tipo === 'suspensao') {
            empBehavior[fId].suspensaoDays++
            if (!empBehavior[fId].lastAbsenceDate || dStrRow > empBehavior[fId].lastAbsenceDate!) empBehavior[fId].lastAbsenceDate = dStrRow
          }

          const isAbsence = ['falta', 'atestado', 'suspensao', 'ferias', 'repouso', 'compensar'].includes(tipo)
          if (row.localidade && String(row.localidade).trim().length > 0 && !isAbsence) {
            const rawLoc = String(row.localidade).trim()
            const keyLoc = normLoc(rawLoc)
            
            if (!latestAllocationMap[fId]) {
              latestAllocationMap[fId] = { localityName: rawLoc, date: dStrRow }
            }

            if (!recentActiveShifts[fId]) recentActiveShifts[fId] = []
            if (recentActiveShifts[fId].length < 5) {
              recentActiveShifts[fId].push(dStrRow)
              if (!localityPatternMap[fId]) localityPatternMap[fId] = {}
              localityPatternMap[fId][keyLoc] = (localityPatternMap[fId][keyLoc] || 0) + 1
            }

            if (!empLocHist[fId]) empLocHist[fId] = {}
            empLocHist[fId][keyLoc] = (empLocHist[fId][keyLoc] || 0) + 1
            empBehavior[fId].totalEscalatedDays++

            let locSetor = locToSectorMap[keyLoc]
            if (!locSetor) {
              if (keyLoc.includes('varri') || keyLoc.includes('varr')) locSetor = 'Varrição'
              else if (keyLoc.includes('banheiro')) locSetor = 'Banheiro'
              else if (keyLoc.includes('feira')) locSetor = 'Feiras'
              else if (keyLoc.includes('praca') || keyLoc.includes('praca')) locSetor = 'Praças'
            }

            if (locSetor) {
              const keySetor = normLoc(locSetor)
              if (!empSetorHist[fId]) empSetorHist[fId] = {}
              empSetorHist[fId][keySetor] = (empSetorHist[fId][keySetor] || 0) + 1
            }

            if (dStrRow) {
              const key = `${dStrRow}_${keyLoc}`
              if (!dailyLocMembers[key]) dailyLocMembers[key] = new Set()
              dailyLocMembers[key].add(fId)
            }
          }
        })
      }

      Object.keys(empBehavior).forEach(fId => {
        if (empBehavior[fId].lastAbsenceDate) {
          const lastAbs = parseLocalDate(empBehavior[fId].lastAbsenceDate!)
          empBehavior[fId].daysAwayBeforeReturn = Math.max(0, Math.floor((targetDate.getTime() - lastAbs.getTime()) / (1000 * 60 * 60 * 24)))
        }
      })

      const pairHist: Record<string, Record<string, number>> = {}
      Object.values(dailyLocMembers).forEach(memberSet => {
        const membersArr = Array.from(memberSet)
        for (let i = 0; i < membersArr.length; i++) {
          for (let j = i + 1; j < membersArr.length; j++) {
            const m1 = membersArr[i]; const m2 = membersArr[j]
            if (!pairHist[m1]) pairHist[m1] = {}; if (!pairHist[m2]) pairHist[m2] = {}
            pairHist[m1][m2] = (pairHist[m1][m2] || 0) + 1; pairHist[m2][m1] = (pairHist[m2][m1] || 0) + 1
          }
        }
      })

      const recs: Record<string, any[]> = {}
      const buildBehaviorTag = (fId: string): string => {
        const b = empBehavior[fId]; if (!b) return ''
        const tags = []
        if (b.faltaDays > 0) tags.push(`${b.faltaDays} falta${b.faltaDays > 1 ? 's' : ''}`)
        if (b.atestadoDays > 0) tags.push(`${b.atestadoDays} atestado${b.atestadoDays > 1 ? 's' : ''}`)
        if (b.suspensaoDays > 0) tags.push(`${b.suspensaoDays}d suspenso`)
        return tags.length > 0 ? ` • ⚠️ ${tags.join(', ')}` : ''
      }

      localidadesConfig.forEach(loc => {
        const locName = loc.nome.trim(); const locKey = normLoc(locName)
        const locSetor = loc.setor || locToSectorMap[locKey] || ''
        const normLocSetorKey = normLoc(locSetor)
        const allocatedIdsToday = (dailyDistribution[loc.id] || []).map(m => String(m.id).trim())

        filteredFuncionarios.forEach(f => {
          if (f.cargo?.toLowerCase() === 'encarregado') return
          const fIdStr = String(f.id).trim()
          const empSetMap = empSetorHist[fIdStr] || {}
          const locDays = empLocHist[fIdStr]?.[locKey] || 0
          
          const latestAlloc = latestAllocationMap[fIdStr]
          const isLatestLoc = latestAlloc && normLoc(latestAlloc.localityName) === locKey
          const patternCount = localityPatternMap[fIdStr]?.[locKey] || 0

          const topHistSetor = Object.entries(empSetMap).sort((a,b) => b[1] - a[1])[0]?.[0] || null
          const empPrimarySetor = f.setor && f.setor !== 'Geral' ? f.setor : (topHistSetor || f.setor || '')
          const profileSetorKey = normLoc(empPrimarySetor)
          const totalEscDays = empBehavior[fIdStr]?.totalEscalatedDays || 0

          const isExactLocality = locDays > 0
          const isSameSector = normLocSetorKey && profileSetorKey && normLocSetorKey === profileSetorKey
          const isHistSector = normLocSetorKey && empSetMap[normLocSetorKey] && empSetMap[normLocSetorKey] > 0

          if (totalEscDays > 0 && !isExactLocality && !isSameSector && !isHistSector) return

          let totalCoWorkerDays = 0; let topPartnerName = null; let topPartnerDays = 0
          allocatedIdsToday.forEach(cId => {
            const d = pairHist[fIdStr]?.[cId] || 0
            if (d > 0) {
              totalCoWorkerDays += d
              if (d > topPartnerDays) { topPartnerDays = d; const col = allFuncionarios.find(x => String(x.id).trim() === cId); topPartnerName = col?.apelido || col?.nome }
            }
          })

          const recencyBonus = isLatestLoc ? 80 : (patternCount >= 2 ? 50 : (patternCount === 1 ? 25 : 0))
          const setorBonus = isSameSector ? 30 : (isHistSector ? 15 : 0)
          const reliabilityBonus = empBehavior[fIdStr]?.daysAwayBeforeReturn <= 3 ? 4 : 0
          const score = Math.max(0, recencyBonus + (locDays * 15) + (topPartnerDays * 8) + setorBonus + reliabilityBonus)

          if (!recs[f.id]) recs[f.id] = []
          const behaviorTag = buildBehaviorTag(fIdStr)
          let reason = ''
          if (isLatestLoc) {
            reason = `📍 Última alocação neste posto`
          } else if (patternCount >= 2) {
            reason = `🔁 Padrão mantido (${patternCount}/5 recentes)`
          } else if (isExactLocality) {
            reason = `Escalado ${locDays}x nesta localidade`
          } else if (isSameSector) {
            reason = `Setor ${locSetor}`
          } else {
            reason = 'Disponível'
          }
          reason += behaviorTag

          recs[f.id].push({ locId: loc.id, topLocalityName: locName, score, matchPercent: Math.min(99, Math.round(50 + (score * 0.8))), reason })
        })
      })
      Object.values(recs).forEach(list => list.sort((a, b) => b.score - a.score))
      setAssistantData({ recommendations: recs, empLocHist, pairHist, latestAllocationMap, localityPatternMap, empBehavior })
    } catch (err) { console.error(err) } finally { setAssistantLoading(false) }
  }, [dateStr, localidadesConfig, dailyDistribution, filteredFuncionarios, allFuncionarios, dbLocalidades])

  useEffect(() => { calculateAssistantRecommendations() }, [calculateAssistantRecommendations])

  const getBestCandidateForLocality = useCallback((locName: string, allocatedMembers: any[]): { id: any; name: string; score: number; reason: string } | null => {
    if (!filteredAvailableFuncs || filteredAvailableFuncs.length === 0) return null
    const normLoc = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
    const normLocName = normLoc(locName)
    const allocatedIds = new Set(allocatedMembers.map(m => String(m.id).trim()))
    let bestFunc: { id: any; name: string; score: number; reason: string } | null = null
    let maxScore = -1

    filteredAvailableFuncs.forEach(f => {
      const fIdStr = String(f.id).trim()
      if (allocatedIds.has(fIdStr)) return

      const locDays = assistantData.empLocHist?.[fIdStr]?.[normLocName] || 0

      // ABSOLUTE STRICT RULE: Dica IA ONLY suggests candidates who have ACTUALLY worked in this locality before (locDays > 0)!
      if (locDays <= 0) return

      const latestAlloc = assistantData.latestAllocationMap?.[fIdStr]
      const isLatestLoc = latestAlloc && normLoc(latestAlloc.localityName) === normLocName
      const patternCount = assistantData.localityPatternMap?.[fIdStr]?.[normLocName] || 0

      let topPartnerName: string | null = null
      let topPartnerDays = 0

      allocatedMembers.forEach(m => {
        const days = assistantData.pairHist?.[fIdStr]?.[String(m.id).trim()] || 0
        if (days > topPartnerDays) {
          topPartnerDays = days
          topPartnerName = m.apelido || m.nome
        }
      })

      const recencyBonus = isLatestLoc ? 80 : (patternCount >= 2 ? 40 : 0)
      const score = recencyBonus + (locDays * 15) + (topPartnerDays * 8)

      if (score > maxScore) {
        maxScore = score
        const funcName = f.apelido || f.nome
        let reason = ''
        if (isLatestLoc) {
          reason = `📍 Última alocação neste posto`
        } else if (patternCount >= 2) {
          reason = `🔁 Padrão mantido (${patternCount}/5 recentes)`
        } else if (topPartnerName && topPartnerDays > 0) {
          reason = `Trabalhou ${locDays}x aqui e ${topPartnerDays}x c/ ${topPartnerName}`
        } else {
          reason = `Trabalhou ${locDays}x nesta localidade`
        }

        bestFunc = {
          id: f.id,
          name: funcName,
          score,
          reason
        }
      }
    })

    return bestFunc
  }, [filteredAvailableFuncs, assistantData])



  const handleAutoAllocateAllWithAssistant = async () => {
    if (!filteredAvailableFuncs || filteredAvailableFuncs.length === 0) {
      return toast('Nenhum colaborador avulso para alocar.', 'info')
    }

    setAssistantLoading(true)
    try {
      const funcMap: Record<string, Funcionario> = {}
      allFuncionarios.forEach(f => { funcMap[f.id] = f })

      const locs = localidadesConfig.map(l => ({ id: l.id, nome: l.nome, setor: l.setor }))

      const allocatedMap: Record<string, string[]> = {}
      localidadesConfig.forEach(l => {
        allocatedMap[l.id] = (dailyDistribution[l.id] || []).map(m => String(m.id))
      })

      const suggestions = generateSmartAutoAllocations(
        filteredAvailableFuncs,
        locs,
        allocatedMap,
        aiEngine,
        funcMap
      )

      if (suggestions.length > 0) {
        setAiSuggestions(suggestions)
        setIsAiModalOpen(true)
      } else {
        toast('Não foi possível gerar sugestões para os colaboradores avulsos.', 'info')
      }
    } catch (err: any) {
      console.error('Erro ao gerar alocações IA:', err)
      toast('Erro ao gerar alocações da IA: ' + (err?.message || 'Falha'), 'error')
    } finally {
      setAssistantLoading(false)
    }
  }

  const handleApproveAiAllocations = async (approved: SuggestedAllocation[]) => {
    try {
      const itemsToBatch = approved.map(item => ({
        funcionario_id: item.funcionarioId,
        data: dateStr,
        tipo: 'presente' as const,
        localidade: item.localidadeNome,
        turno: 'integral' as const
      }))

      await batchMutation.mutateAsync({ items: itemsToBatch, skipFreqSync: true })
      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      toast(`${approved.length} alocações confirmadas com sucesso pelo gestor!`, 'success')
      setIsAiModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao confirmar alocações:', err)
      toast('Erro ao salvar alocações: ' + (err?.message || 'Falha'), 'error')
    }
  }

  const scrollToEmployee = useCallback((funcId: string) => {
    setHighlightedEmployeeId(funcId)
    clearSearch()
    
    // Wait for layout recalculation to complete after search clears
    setTimeout(() => {
      let el = document.getElementById(`func-card-${funcId}`)
      if (!el) {
        el = document.getElementById(`func-avulso-${funcId}`)
      }
      if (!el) {
        el = document.getElementById(`func-ausente-${funcId}`)
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        toast('Colaborador não encontrado na visualização atual.', 'info')
      }
      
      // Remove highlight state after animation finishes
      setTimeout(() => {
        setHighlightedEmployeeId(null)
      }, 3000)
    }, 150)
  }, [clearSearch, toast])

  const totalAlocados = useMemo(() => {
    return Object.entries(dailyDistribution).reduce((acc, [key, members]) => {
      if (key === 'sem_local') return acc
      return acc + members.length
    }, 0)
  }, [dailyDistribution])

  const notWorkingGroups = useMemo(() => {
    const groups: Record<string, { label: string; icon: any; members: any[]; color: string }> = {
      'folga': { label: 'Folgas', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-blue-500' },
      'ferias': { label: 'Férias', icon: <CalendarIcon className="w-4 h-4" />, members: [], color: 'text-purple-500' },
      'atestado': { label: 'Afastamentos', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-amber-500' },
      'outros': { label: 'Outros / Faltas', icon: <Clock className="w-4 h-4" />, members: [], color: 'text-rose-500' },
    }

    filteredFuncionarios.forEach((f) => {
      if (f.cargo?.toLowerCase() === 'encarregado') return
      if (filterSetor && f.setor !== filterSetor) return

      const { isTrabalhando, tipo, escala } = getEmployeeStatus(f.id, dateStr)

      if (!isTrabalhando) {
        const member = { ...f, tipoPlanejado: tipo, escalaId: escala?.id }
        const normTipo = tipo ? String(tipo).toLowerCase().trim() : ''
        if (normTipo === 'repouso' || normTipo === 'compensar' || normTipo === 'folga') groups['folga'].members.push(member)
        else if (normTipo === 'ferias') groups['ferias'].members.push(member)
        else if (normTipo === 'atestado') groups['atestado'].members.push(member)
        else groups['outros'].members.push(member)
      }
    })

    return groups
  }, [filteredFuncionarios, dateStr, getEmployeeStatus, filterSetor])

  const totalTrabalhando = totalAlocados + availableFuncs.length
  const percentAlocado = totalTrabalhando > 0 ? Math.round((totalAlocados / totalTrabalhando) * 100) : 0
  const totalAusentes = useMemo(() => {
    return Object.values(notWorkingGroups).reduce((acc, g) => acc + g.members.length, 0)
  }, [notWorkingGroups])

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(async () => {
      try {
        const element = document.querySelector('.print-cards-container') as HTMLElement
        if (element) {
          element.classList.add('no-shadows')
          const { toBlob } = await import('html-to-image')
          
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          const renderOptions = {
            backgroundColor: '#ffffff',
            pixelRatio: isMobile ? 1 : 2,
            quality: 0.95,
            skipFonts: true,
            cacheBust: true,
            filter: (node: Node) => {
              const tagName = (node as HTMLElement).tagName?.toLowerCase()
              if (tagName === 'svg' || tagName === 'path') {
                return false
              }
              if (tagName === 'button' || tagName === 'input' || tagName === 'select') {
                return false
              }
              return true
            }
          }

          // Temporarily disable cross-origin stylesheets to prevent tainted canvas / CORS issues
          const disabledSheets: CSSStyleSheet[] = []
          try {
            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i]
              try {
                let isCrossOrigin = false
                try {
                  if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
                    isCrossOrigin = true
                  }
                } catch (_) {
                  isCrossOrigin = true
                }

                if (isCrossOrigin) {
                  try {
                    sheet.disabled = true
                    disabledSheets.push(sheet)
                  } catch (_) {}
                }
              } catch (_) {}
            }
          } catch (err) {
            console.warn('Error disabling cross-origin stylesheets:', err)
          }

          let blob: Blob | null = null
          try {
            if (isMobile) {
              try { await toBlob(element, { ...renderOptions, pixelRatio: 1 }) } catch (_) {}
            }
            blob = await toBlob(element, renderOptions)
          } catch (firstErr) {
            console.warn('First render failed, retrying with pixelRatio 1...', firstErr)
            blob = await toBlob(element, {
              ...renderOptions,
              pixelRatio: 1,
              filter: renderOptions.filter
            })
          } finally {
            // Restore disabled stylesheets
            disabledSheets.forEach(sheet => {
              try {
                sheet.disabled = false
              } catch (_) {}
            })
          }
          
          element.classList.remove('no-shadows')
          
          if (!blob) {
            throw new Error('A renderização do canvas falhou (retornou null).')
          }
          
          const isWeekly = viewMode === 'weekly'
          const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 })
          const endOfCurrentWeek = endOfWeek(currentDate, { weekStartsOn: 1 })
          
          const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
          const fileName = isWeekly
            ? `escala-semanal-${format(startOfCurrentWeek, 'yyyy-MM-dd')}.${ext}`
            : `escala-localidades-${dateStr}.${ext}`
          
          const downloadDirectly = () => {
            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = fileName
            link.click()
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
          }
          
          try {
            const file = new File([blob], fileName, { type: blob.type })
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: isWeekly
                  ? `Escala Semanal - Semana ${format(startOfCurrentWeek, 'dd/MM')}`
                  : `Escala Localidades - ${dateStr}`,
                text: isWeekly
                  ? `Segue a Escala de Localidades Semanal (Semana de ${format(startOfCurrentWeek, 'dd/MM')} a ${format(endOfCurrentWeek, 'dd/MM/yyyy')}).`
                  : `Segue a Escala de Localidades do dia ${format(currentDate, 'dd/MM/yyyy')}.`
              })
            } else {
              downloadDirectly()
            }
          } catch (shareErr: any) {
            console.warn('Share API failed or was cancelled, falling back to direct download:', shareErr)
            if (shareErr.name !== 'AbortError') {
              downloadDirectly()
            }
          }
        } else {
          window.print()
        }
      } catch (err: any) {
        const element = document.querySelector('.print-cards-container') as HTMLElement
        if (element) {
          element.classList.remove('no-shadows')
        }
        console.error('Erro ao compartilhar Imagem:', err)
        alert('Erro ao gerar: ' + (err?.message || JSON.stringify(err)))
      } finally {
        setIsPrinting(false)
      }
    }, 800)
  }
  const printData = useMemo(() => {
    const activeSectors = setores.map(s => {
      const locs = localidadesConfig
        .filter(l => l.setor === s)
        .map(l => ({ id: l.id, nome: l.nome, members: dailyDistribution[l.id] || [] }))
        .filter(l => l.members.length > 0)
      return { setor: s, localidades: locs }
    }).filter(s => s.localidades.length > 0)

    const off = {
      folga: escalas.filter((e: any) => e.data.substring(0, 10) === dateStr && (e.tipo === 'repouso' || e.tipo === 'compensar')).map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      ferias: escalas.filter((e: any) => e.data.substring(0, 10) === dateStr && e.tipo === 'ferias').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      atestado: escalas.filter((e: any) => e.data.substring(0, 10) === dateStr && e.tipo === 'atestado').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
    }
    return { activeSectors, off }
  }, [setores, localidadesConfig, dailyDistribution, escalas, dateStr, funcMap])

  const allActiveLocalidades = useMemo(() => {
    return printData.activeSectors.flatMap(s => 
      s.localidades.map(l => ({ ...l, setor: s.setor }))
    )
  }, [printData.activeSectors])

  const handleAssign = async (funcId: string) => {
    if (!assignModal) return
    
    // Trigger optimistic morphing animation instantly on touch
    setSuccessAllocatedIds(prev => ({ ...prev, [funcId]: true }))
    setTimeout(() => {
      setSuccessAllocatedIds(prev => {
        const next = { ...prev }
        delete next[funcId]
        return next
      })
    }, 780)

    try {
      const existing = escalaMap[`${funcId}_${assignModal.dateStr}`]
      
      const getFeriado = (day: Date) => {
        const dStr = format(day, 'yyyy-MM-dd')
        return feriados.find((f: any) => f.data === dStr)
      }

      const targetDate = parseISO(assignModal.dateStr + 'T12:00:00')
      const feriado = getFeriado(targetDate)
      const isSun = targetDate.getDay() === 0

      const saveAssignment = async (finalTipo: string) => {
        const periodKey = ['escalas', 'periodo', fetchStart, fetchEnd]
        const previousEscalas = queryClient.getQueryData<any[]>(periodKey)
        const targetLocName = assignModal.locName === 'Sem Local' ? null : assignModal.locName

        // Optimistic Update: Add or update escala in cache
        if (previousEscalas) {
          const updatedEscalas = [...previousEscalas]
          const existingIdx = updatedEscalas.findIndex(e => String(e.funcionario_id).trim() === String(funcId).trim() && e.data.substring(0, 10) === assignModal.dateStr)
          
          if (existingIdx > -1) {
            updatedEscalas[existingIdx] = {
              ...updatedEscalas[existingIdx],
              localidade: targetLocName,
              tipo: finalTipo
            }
          } else {
            const funcObj = allFuncionarios.find(f => f.id === funcId)
            if (funcObj) {
              const tempEscala = {
                id: `temp-${funcId}-${Date.now()}`,
                funcionario_id: funcId,
                data: assignModal.dateStr,
                tipo: finalTipo,
                localidade: targetLocName,
                turno: 'integral',
                funcionarios: {
                  id: funcObj.id,
                  nome: funcObj.nome,
                  apelido: funcObj.apelido,
                  cargo: funcObj.cargo || '',
                  setor: funcObj.setor || ''
                }
              }
              updatedEscalas.push(tempEscala)
            }
          }
          queryClient.setQueryData(periodKey, updatedEscalas)
        }

        try {
          const payload = {
            funcionario_id: funcId,
            data: assignModal.dateStr,
            tipo: finalTipo,
            localidade: targetLocName,
            turno: 'integral' as const
          }
          if (existing) {
            await updateMutation.mutateAsync({ id: existing.id, data: { localidade: payload.localidade, tipo: finalTipo }, skipFreqSync: true })
          } else {
            await batchMutation.mutateAsync({ items: [payload], skipFreqSync: true })
          }

          // Como estamos alocando o funcionário para trabalhar, ele deve vir sem check (pendente).
          // Portanto, deletamos a frequência deste dia para que ele fique pendente (sem check).
          await supabase
            .from('frequencia')
            .delete()
            .eq('funcionario_id', funcId)
            .eq('data', assignModal.dateStr)

          await queryClient.invalidateQueries({ queryKey: ['escalas'] })
          await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
          await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          toast('Alocação confirmada!', 'success')
          clearSearch()
        } catch (err: any) {
          // Revert Optimistic Update on error
          if (previousEscalas) {
            queryClient.setQueryData(periodKey, previousEscalas)
          }
          toast('Falha ao alocar: ' + err.message, 'error')
          setSuccessAllocatedIds(prev => {
            const next = { ...prev }
            delete next[funcId]
            return next
          })
        }
      }

      // Always save directly as 'presente' without prompting for special day/type
      await saveAssignment('presente')
    } catch (err: any) {
      // Revert optimistic success state on error
      setSuccessAllocatedIds(prev => {
        const next = { ...prev }
        delete next[funcId]
        return next
      })
      toast('Falha ao alocar: ' + err.message, 'error')
    }
  }

  const handleClearDay = async () => {
    const todayEscalas = escalas.filter((e: any) => e.data.substring(0, 10) === dateStr && e.localidade)
    if (todayEscalas.length === 0) return toast('Nenhuma alocação para limpar', 'info')
    if (!confirm(`Limpar alocação de ${todayEscalas.length} funcionários hoje?`)) return
    try {
      const updates = todayEscalas.map((e: any) => {
        const { funcionarios, ...cleanData } = e
        return { ...cleanData, localidade: null }
      })
      await batchMutation.mutateAsync({ items: updates, skipFreqSync: true })
      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Escala resetada para hoje.', 'success')
      clearSearch()
    } catch (err: any) {
      toast('Erro ao limpar: ' + err.message, 'error')
    }
  }

  const handleRemove = async (escalaId: string, funcId?: string) => {
    const periodKey = ['escalas', 'periodo', fetchStart, fetchEnd]
    const previousEscalas = queryClient.getQueryData<any[]>(periodKey)

    // Optimistic Update: Set localidade to null
    if (previousEscalas && funcId) {
      const updatedEscalas = [...previousEscalas]
      const existingIdx = updatedEscalas.findIndex(e => e.funcionario_id === funcId && e.data.substring(0, 10) === dateStr)
      if (existingIdx > -1) {
        updatedEscalas[existingIdx] = {
          ...updatedEscalas[existingIdx],
          localidade: null
        }
        queryClient.setQueryData(periodKey, updatedEscalas)
      }
    }

    try {
      let idToUpdate = escalaId
      if (!idToUpdate && funcId) {
        const e = escalaMap[`${funcId}_${dateStr}`]
        if (e) idToUpdate = e.id
      }
      if (!idToUpdate) {
        throw new Error('Identificador da escala não encontrado.')
      }
      await updateMutation.mutateAsync({ id: idToUpdate, data: { localidade: null }, skipFreqSync: true })
      
      // Ao remover a localidade/alocação, limpamos o check da chamada
      if (funcId) {
        await supabase
          .from('frequencia')
          .delete()
          .eq('funcionario_id', funcId)
          .eq('data', dateStr)
      } else {
        const escala = (escalas as any[]).find((e: any) => e.id === idToUpdate)
        if (escala) {
          await supabase
            .from('frequencia')
            .delete()
            .eq('funcionario_id', escala.funcionario_id)
            .eq('data', dateStr)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast('Localidade removida.', 'success')
      clearSearch()
    } catch (err: any) {
      // Revert Optimistic Update on error
      if (previousEscalas) {
        queryClient.setQueryData(periodKey, previousEscalas)
      }
      console.error('Erro ao desalocar colaborador:', err)
      toast('Erro ao remover: ' + (err?.message || JSON.stringify(err)), 'error')
    }
  }

  const handleMove = async (funcId: any, targetLocName: string | null, escalaId?: string) => {
    const fIdStr = String(funcId).trim()

    const periodKey = ['escalas', 'periodo', fetchStart, fetchEnd]
    const previousEscalas = queryClient.getQueryData<any[]>(periodKey)

    // Optimistic Update: move member card instantly
    if (previousEscalas) {
      const updatedEscalas = [...previousEscalas]
      const existingIdx = updatedEscalas.findIndex(e => String(e.funcionario_id).trim() === fIdStr && e.data.substring(0, 10) === dateStr)
      
      if (existingIdx > -1) {
        updatedEscalas[existingIdx] = {
          ...updatedEscalas[existingIdx],
          localidade: targetLocName
        }
      } else {
        const funcObj = allFuncionarios.find(f => String(f.id).trim() === fIdStr)
        if (funcObj) {
          const tempEscala = {
            id: `temp-${fIdStr}-${Date.now()}`,
            funcionario_id: funcObj.id,
            data: dateStr,
            tipo: 'presente',
            localidade: targetLocName,
            turno: 'integral',
            funcionarios: {
              id: funcObj.id,
              nome: funcObj.nome,
              apelido: funcObj.apelido,
              cargo: funcObj.cargo || '',
              setor: funcObj.setor || ''
            }
          }
          updatedEscalas.push(tempEscala)
        }
      }
      queryClient.setQueryData(periodKey, updatedEscalas)
    }

    try {
      if (escalaId) {
        await updateMutation.mutateAsync({ id: escalaId, data: { localidade: targetLocName }, skipFreqSync: true })
      } else {
        const e = escalaMap[`${fIdStr}_${dateStr}`] || escalaMap[`${funcId}_${dateStr}`]
        if (e) {
          await updateMutation.mutateAsync({ id: e.id, data: { localidade: targetLocName }, skipFreqSync: true })
        } else {
          await batchMutation.mutateAsync({
            items: [{
              funcionario_id: fIdStr,
              data: dateStr,
              tipo: 'presente',
              localidade: targetLocName,
              turno: 'integral'
            }],
            skipFreqSync: true
          })
        }
      }

      await supabase
        .from('frequencia')
        .delete()
        .eq('funcionario_id', fIdStr)
        .eq('data', dateStr)

      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      toast(targetLocName ? 'Movimentado com sucesso!' : 'Funcionário agora está disponível', 'success')
      clearSearch()
    } catch (err: any) {
      if (previousEscalas) {
        queryClient.setQueryData(periodKey, previousEscalas)
      }
      console.error('Erro ao mover funcionário:', err)
      toast('Falha na movimentação: ' + err.message, 'error')
    }
  }

  const handleDragStart = (e: React.DragEvent, funcId: string, sourceLocId: string, escalaId?: string) => {
    // Prevent dragging when clicking interactive elements (select, button, input)
    const target = e.target as HTMLElement;
    if (target.closest('select') || target.closest('button') || target.closest('input')) {
      e.preventDefault();
      return;
    }

    // Prevent native drag on touch devices to avoid conflicts with our custom touch emulator
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      e.preventDefault();
      return;
    }

    setIsDraggingId(funcId)
    e.dataTransfer.setData('funcId', funcId)
    e.dataTransfer.setData('sourceLocId', sourceLocId)
    if (escalaId) e.dataTransfer.setData('escalaId', escalaId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setIsDraggingId(null)
    setDragOverLocId(null)
    setDragOverSector(null)
  }

  const handleDrop = (e: React.DragEvent, targetLocId: string, targetLocName: string | null) => {
    e.preventDefault()
    const funcId = e.dataTransfer.getData('funcId')
    const sourceLocId = e.dataTransfer.getData('sourceLocId')
    const escalaId = e.dataTransfer.getData('escalaId')
    
    setIsDraggingId(null)
    setDragOverLocId(null)
    setDragOverSector(null)

    if (sourceLocId === targetLocId) return
    handleMove(funcId, targetLocName, escalaId)
  }


  // Reset auto-route on team change so it evaluates for the newly selected team
  useEffect(() => {
    setHasAutoRouted(false)
  }, [selectedTeamId]);

  // ── AUTO-ADVANCE DATE ON LOAD ──
  // When page loads (or team changes), if today has no one working or allocated,
  // skip forward day-by-day until we find a day with activity (up to 30 days ahead).
  useEffect(() => {
    if (loadF || loadE || loadTeam || hasAutoRouted) return

    // Helper to check if a date has any activity for the current team/filters
    const checkDateHasActivity = (dateToCheck: Date) => {
      const dStr = format(dateToCheck, 'yyyy-MM-dd')
      const isDom = isSunday(dateToCheck)

      // 1. Check if anyone is allocated to a location on this day
      const hasAllocations = (escalas as any[]).some(e => {
        const eDate = e.data.substring(0, 10)
        if (eDate !== dStr) return false
        if (!e.localidade) return false
        
        if (teamInfo?.isRestricted) {
          return teamInfo.teamMemberIds.some((id: any) => String(id).trim() === String(e.funcionario_id).trim())
        }
        if (selectedTeamId) {
          return selectedTeamMembers.some((id: any) => String(id).trim() === String(e.funcionario_id).trim())
        }
        return true
      })

      if (hasAllocations) return true

      // 2. Check if anyone is scheduled/available to work on this day
      const hasWorking = filteredFuncionarios.some(f => {
        if (f.cargo?.toLowerCase() === 'encarregado') return false
        const fIdStr = String(f.id).trim()
        const e = escalaMap[`${fIdStr}_${dStr}`] || escalaMap[`${f.id}_${dStr}`]
        if (e) {
          const normTipo = e.tipo ? String(e.tipo).toLowerCase().trim() : ''
          return ['presente', 'escala', 'hora_extra', 'trabalho', 'falta', 'alocado'].includes(normTipo)
        }
        return !isDom
      })

      return hasWorking
    }

    if (!checkDateHasActivity(currentDate)) {
      let foundDate = currentDate
      for (let i = 1; i <= 30; i++) {
        const nextDate = addDays(currentDate, i)
        if (checkDateHasActivity(nextDate)) {
          foundDate = nextDate
          break
        }
      }
      if (foundDate !== currentDate) {
        setCurrentDate(startOfDay(foundDate))
      }
    }
    setHasAutoRouted(true)
  }, [loadF, loadE, loadTeam, hasAutoRouted, currentDate, escalas, filteredFuncionarios, escalaMap, selectedTeamId, selectedTeamMembers, teamInfo])

  // ── AUTO-CLEAN ORPHANED LOCALITIES (only when a locality was permanently deleted from dbLocalidades) ──
  useEffect(() => {
    if (!escalas || escalas.length === 0 || !dbLocalidades || dbLocalidades.length === 0) return

    const orphanedEscalas = (escalas as any[]).filter(e => {
      if (!e.localidade) return false
      const locName = e.localidade.trim().toLowerCase()
      // Only clean up if locality was permanently deleted from dbLocalidades!
      return !dbLocalidades.some(l => l.nome.trim().toLowerCase() === locName)
    })

    if (orphanedEscalas.length > 0) {
      console.log(`Auto-cleaning ${orphanedEscalas.length} orphaned escala allocations for deleted localities...`, orphanedEscalas)
      const updates = orphanedEscalas.map(e => {
        const { funcionarios, ...cleanData } = e
        return { ...cleanData, localidade: null }
      })

      batchMutation.mutateAsync({ items: updates, skipFreqSync: true }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
      }).catch(err => {
        console.warn('Error auto-cleaning orphaned escalas:', err)
      })
    }
  }, [escalas, dbLocalidades])

  // ── COPY FROM DAY HANDLER ──
  const handlePreviewCopyFromDay = async () => {
    if (!copySourceDate) return toast('Selecione um dia de origem.', 'warning')
    setIsCopyLoading(true)
    try {
      const { data, error } = await supabase
        .from('escalas')
        .select('funcionario_id, localidade, tipo')
        .eq('data', copySourceDate)
        .not('localidade', 'is', null)

      if (error) throw error

      const preview = (data || [])
        .filter((row: any) => {
          const f = filteredFuncionarios.find(fn => fn.id === row.funcionario_id)
          return f && f.cargo?.toLowerCase() !== 'encarregado' && row.localidade
        })
        .map((row: any) => {
          const f = filteredFuncionarios.find(fn => fn.id === row.funcionario_id)
          return {
            funcionarioId: row.funcionario_id,
            funcionarioNome: f?.apelido || f?.nome || row.funcionario_id,
            localidadeNome: row.localidade
          }
        })

      if (preview.length === 0) {
        return toast('Nenhuma alocação encontrada para esse dia.', 'info')
      }
      setCopyPreview(preview)
    } catch (err: any) {
      toast('Erro ao buscar alocações: ' + err.message, 'error')
    } finally {
      setIsCopyLoading(false)
    }
  }

  const handlePreview10DayAverage = async () => {
    setIsCopyLoading(true)
    try {
      const targetDate = parseLocalDate(dateStr)
      const tenDaysAgo = subDays(targetDate, 10)
      const yesterday = subDays(targetDate, 1)

      const tenDaysAgoStr = format(tenDaysAgo, 'yyyy-MM-dd')
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

      const { data: historyData, error } = await supabase
        .from('escalas')
        .select('funcionario_id, localidade, data')
        .gte('data', tenDaysAgoStr)
        .lte('data', yesterdayStr)
        .not('localidade', 'is', null)

      if (error) throw error

      // Count occurrences of localidade for each employee over last 10 days
      const employeeHistory: Record<string, Record<string, number>> = {}
      // Group daily allocations per locality to calculate historical average capacity per locality
      const locDailyCounts: Record<string, Record<string, number>> = {}

      if (historyData) {
        historyData.forEach((row: any) => {
          if (!row.funcionario_id || !row.localidade) return
          const loc = row.localidade.trim()
          const dStrRow = row.data ? row.data.substring(0, 10) : ''

          // Employee locality history
          if (!employeeHistory[row.funcionario_id]) {
            employeeHistory[row.funcionario_id] = {}
          }
          employeeHistory[row.funcionario_id][loc] = (employeeHistory[row.funcionario_id][loc] || 0) + 1

          // Daily locality headcount history
          if (dStrRow) {
            if (!locDailyCounts[loc]) locDailyCounts[loc] = {}
            locDailyCounts[loc][dStrRow] = (locDailyCounts[loc][dStrRow] || 0) + 1
          }
        })
      }

      // Calculate median target capacity (number of employees) for each locality over active days
      const locTargetCapacity: Record<string, number> = {}
      localidadesConfig.forEach(l => {
        const locName = l.nome.trim()
        const dailyMap = locDailyCounts[locName]
        if (dailyMap && Object.keys(dailyMap).length > 0) {
          const counts = Object.values(dailyMap).sort((a, b) => a - b)
          const n = counts.length
          let median = 1
          if (n % 2 === 1) {
            median = counts[Math.floor(n / 2)]
          } else {
            const mid1 = counts[(n / 2) - 1]
            const mid2 = counts[n / 2]
            median = Math.round((mid1 + mid2) / 2)
          }
          // Median headcount per active day for this locality (minimum 1)
          locTargetCapacity[locName] = Math.max(1, median)
        } else {
          locTargetCapacity[locName] = 1
        }
      })

      const activeFuncs = filteredFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
      
      // Structure for allocations per locality (dynamic capacity per locality based on 10-day average)
      const locAllocations: Record<string, { funcionarioId: string; funcionarioNome: string; count: number }[]> = {}
      localidadesConfig.forEach(l => {
        locAllocations[l.nome] = []
      })

      // Helper function to try allocating an employee based on history
      const tryAllocateEmployee = (funcId: string, funcName: string, excludeLocs: Set<string> = new Set()): boolean => {
        const hist = employeeHistory[funcId]
        if (!hist) return false // Nunca aloca colaboradores sem registro nos ultimos 10 dias

        // Candidate localities sorted by historical frequency count descending
        const candidates = Object.entries(hist)
          .filter(([locName, count]) => count > 0 && !excludeLocs.has(locName) && localidadesConfig.some(l => l.nome === locName))
          .sort((a, b) => b[1] - a[1])

        for (const [locName, count] of candidates) {
          const current = locAllocations[locName] || []
          const cap = locTargetCapacity[locName] || 1

          // Se a localidade possui menos que sua capacidade média, aloca diretamente
          if (current.length < cap) {
            locAllocations[locName] = [...current, { funcionarioId: funcId, funcionarioNome: funcName, count }]
            return true
          }

          // Se a localidade já atingiu sua capacidade média, verifica se este colaborador tem frequência maior que o menor frequente
          if (current.length >= cap && cap > 0) {
            const minPerson = current.reduce((min, p) => p.count < min.count ? p : min, current[0])
            if (count > minPerson.count) {
              // Substitui o menos frequente nesta localidade
              locAllocations[locName] = current.filter(p => p.funcionarioId !== minPerson.funcionarioId).concat({ funcionarioId: funcId, funcionarioNome: funcName, count })
              
              // Realoca o colaborador menos frequente em outra localidade/setor disponivel
              const nextExclude = new Set(excludeLocs)
              nextExclude.add(locName)
              tryAllocateEmployee(minPerson.funcionarioId, minPerson.funcionarioNome, nextExclude)
              return true
            }
          }
        }

        // Se nao couber em nenhuma localidade primaria com historico, tenta outra localidade de setor diferente que tenha vaga (< cap)
        const histSectors = new Set(Object.keys(hist).map(locName => {
          const lObj = localidadesConfig.find(l => l.nome === locName)
          return lObj?.setor
        }).filter(Boolean))

        const alternativeLoc = localidadesConfig.find(l => 
          !excludeLocs.has(l.nome) && 
          !histSectors.has(l.setor) && 
          (locAllocations[l.nome]?.length || 0) < (locTargetCapacity[l.nome] || 1)
        )

        if (alternativeLoc) {
          if (!locAllocations[alternativeLoc.nome]) locAllocations[alternativeLoc.nome] = []
          locAllocations[alternativeLoc.nome].push({ funcionarioId: funcId, funcionarioNome: funcName, count: 0 })
          return true
        }

        return false
      }

      // Process all active employees with history
      activeFuncs.forEach(f => {
        const funcName = f.apelido || f.nome
        tryAllocateEmployee(f.id, funcName)
      })

      // Convert allocations map to flat preview list
      const preview: { funcionarioId: string; funcionarioNome: string; localidadeNome: string }[] = []
      Object.entries(locAllocations).forEach(([locName, list]) => {
        list.forEach(item => {
          preview.push({
            funcionarioId: item.funcionarioId,
            funcionarioNome: item.funcionarioNome,
            localidadeNome: locName
          })
        })
      })

      if (preview.length === 0) {
        return toast('Nenhum histórico de alocações encontrado nos últimos 10 dias.', 'info')
      }
      setCopyPreview(preview)
    } catch (err: any) {
      toast('Erro ao calcular média das 10 últimas escalas: ' + err.message, 'error')
    } finally {
      setIsCopyLoading(false)
    }
  }

  const handleRestoreWipedAllocations = async () => {
    setIsCopyLoading(true)
    try {
      // 1. Fetch most recent non-null locality for all active employees over past 60 days
      const { data: historicData, error: histErr } = await supabase
        .from('escalas')
        .select('funcionario_id, localidade, data')
        .not('localidade', 'is', null)
        .order('data', { ascending: false })

      if (histErr) throw histErr

      const lastKnownLocalityMap: Record<string, string> = {}
      if (historicData) {
        historicData.forEach((row: any) => {
          if (row.funcionario_id && row.localidade && !lastKnownLocalityMap[row.funcionario_id]) {
            const locExists = dbLocalidades.some(l => l.nome.trim().toLowerCase() === row.localidade.trim().toLowerCase())
            if (locExists) {
              lastKnownLocalityMap[row.funcionario_id] = row.localidade
            }
          }
        })
      }

      // Map team -> localities
      const teamLocsMap: Record<string, string[]> = {}
      dbLocalidades.forEach((l: any) => {
        if (l.equipe_id) {
          if (!teamLocsMap[l.equipe_id]) teamLocsMap[l.equipe_id] = []
          teamLocsMap[l.equipe_id].push(l.nome)
        }
      })

      // Fetch current week/period's escalas
      const { data: currentEscalas, error: currErr } = await supabase
        .from('escalas')
        .select('*')
        .gte('data', fetchStart)
        .lte('data', fetchEnd)

      if (currErr) throw currErr

      const updates: any[] = []
      let restoredCount = 0

      const currentMap: Record<string, any> = {}
      if (currentEscalas) {
        currentEscalas.forEach((e: any) => {
          currentMap[`${e.funcionario_id}_${e.data}`] = e
        })
      }

      const weekDates = eachDayOfInterval({
        start: parseISO(fetchStart),
        end: parseISO(fetchEnd)
      }).map(d => format(d, 'yyyy-MM-dd'))

      filteredFuncionarios.forEach((f: any) => {
        if (f.cargo?.toLowerCase() === 'encarregado') return

        const empTeam = allTeams.find((t: any) => t.membros?.some((m: any) => m.id === f.id))
        const empTeamLocs = empTeam?.id ? (teamLocsMap[empTeam.id] || []) : []
        const targetLocality = lastKnownLocalityMap[f.id] || empTeamLocs[0] || null

        if (!targetLocality) return

        weekDates.forEach(dStr => {
          const dObj = parseLocalDate(dStr)
          if (isSunday(dObj)) return // Skip Sundays for auto-restore unless configured

          const existingEscala = currentMap[`${f.id}_${dStr}`]
          if (existingEscala) {
            if (!existingEscala.localidade) {
              const { funcionarios, ...cleanData } = existingEscala
              updates.push({
                ...cleanData,
                localidade: targetLocality
              })
              restoredCount++
            }
          } else {
            updates.push({
              funcionario_id: f.id,
              data: dStr,
              tipo: 'presente',
              localidade: targetLocality
            })
            restoredCount++
          }
        })
      })

      if (updates.length === 0) {
        toast('Nenhuma alocação pendente de restauração para este período.', 'info')
        return
      }

      await batchMutation.mutateAsync({ items: updates, skipFreqSync: true })
      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      toast(`Alocações restauradas com sucesso! (${restoredCount} registros recuperados)`, 'success')
    } catch (err: any) {
      toast('Erro ao restaurar alocações: ' + err.message, 'error')
    } finally {
      setIsCopyLoading(false)
    }
  }

  const handleConfirmCopyFromDay = async () => {
    if (!copyPreview) return
    try {
      // 1. Copy the allocations (scales table records)
      const inserts = copyPreview.map(item => {
        const existingEscala = escalaMap[`${item.funcionarioId}_${dateStr}`]
        return {
          ...(existingEscala ? { id: existingEscala.id } : {}),
          funcionario_id: item.funcionarioId,
          data: dateStr,
          tipo: existingEscala?.tipo || 'presente',
          localidade: copyIncludeLocalities ? item.localidadeNome : null,
          turno: existingEscala?.turno || 'integral'
        }
      })
      await batchMutation.mutateAsync({ items: inserts, skipFreqSync: true })

      // 2. Fetch the source day metadata configuration (only if copying localities & identical mode)
      if (copyIncludeLocalities && copyType === 'identico' && copySourceDate) {
        const { data: sourceConfigData, error: sourceConfigError } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', `equipes_meta_${copySourceDate}`)
          .maybeSingle()

        if (sourceConfigError) throw sourceConfigError

        if (sourceConfigData?.valor) {
          const sourceMeta = sourceConfigData.valor as Record<string, { ruas?: string; lider_id?: string; locais?: string[]; funcoes?: Record<string, string> }>
          
          // Clean source metadata: copy leaders & functions, omit locales/ruas
          const cleanedMeta: Record<string, { lider_id?: string; funcoes?: Record<string, string> }> = {}
          Object.entries(sourceMeta).forEach(([locId, value]) => {
            cleanedMeta[locId] = {
              lider_id: value.lider_id,
              funcoes: value.funcoes
            }
          })

          // Merge into target day metadata config
          const mergedMeta = { ...equipesMeta }
          Object.entries(cleanedMeta).forEach(([locId, value]) => {
            mergedMeta[locId] = {
              ...mergedMeta[locId],
              lider_id: value.lider_id,
              funcoes: value.funcoes
            }
          })

          // Update database configuration for the target date
          await updateConfig({ chave: dateKey, valor: mergedMeta })
        }
      }

      // Deletar os registros de frequencia correspondentes aos funcionarios copiados
      const funcIds = copyPreview.map(item => item.funcionarioId)
      await supabase
        .from('frequencia')
        .delete()
        .in('funcionario_id', funcIds)
        .eq('data', dateStr)

      await queryClient.refetchQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      
      const tipoNome = copyType === 'identico' ? 'Modelo idêntico' : 'Média das 10 últimas escalas'
      const modoTexto = copyIncludeLocalities ? 'com localidades' : 'sem localidades'
      toast(`${tipoNome} (${modoTexto}) aplicado com sucesso! ${inserts.length} colaboradores alocados.`, 'success')
      setCopyPreview(null)
      setIsCopyModalOpen(false)
      setCopySourceDate('')
      clearSearch()
    } catch (err: any) {
      toast('Erro ao aplicar modelo: ' + err.message, 'error')
    }
  }

  const handleAutoAllocate = async () => {

    try {
      if (availableFuncs.length === 0) {
        return toast('Nenhum funcionário disponível para alocar.', 'info')
      }

      // 1. Fetch history of last 10 days relative to dateStr
      const targetDate = parseLocalDate(dateStr)
      const tenDaysAgo = subDays(targetDate, 10)
      const yesterday = subDays(targetDate, 1)

      const tenDaysAgoStr = format(tenDaysAgo, 'yyyy-MM-dd')
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

      const { data: historyData, error } = await supabase
        .from('escalas')
        .select('funcionario_id, localidade, data')
        .gte('data', tenDaysAgoStr)
        .lte('data', yesterdayStr)
        .not('localidade', 'is', null)

      if (error) throw error

      // 2. Count occurrences of localidade for each employee
      const employeeHistory: Record<string, Record<string, number>> = {}
      if (historyData) {
        historyData.forEach((row: any) => {
          if (!row.funcionario_id || !row.localidade) return
          if (!employeeHistory[row.funcionario_id]) {
            employeeHistory[row.funcionario_id] = {}
          }
          const loc = row.localidade
          employeeHistory[row.funcionario_id][loc] = (employeeHistory[row.funcionario_id][loc] || 0) + 1
        })
      }

      // 3. Count current allocations for today to determine capacity
      const currentAllocCounts: Record<string, number> = {}
      localidadesConfig.forEach(l => {
        currentAllocCounts[l.nome] = 0
      })

      filteredFuncionarios.forEach(f => {
        const e = escalaMap[`${f.id}_${dateStr}`]
        if (e && e.localidade) {
          currentAllocCounts[e.localidade] = (currentAllocCounts[e.localidade] || 0) + 1
        }
      })

      // 4. Set capacity limits based on sectors
      const capacities: Record<string, number> = {}
      localidadesConfig.forEach(l => {
        const sectorName = l.setor || 'Geral'
        const limit = sectorLimits[sectorName] !== undefined
          ? sectorLimits[sectorName]
          : (sectorName.toLowerCase().includes('varr') ? 2 : 1)
        const allocated = currentAllocCounts[l.nome] || 0
        capacities[l.nome] = Math.max(0, limit - allocated)
      })

      const previewList: {
        funcionarioId: string
        funcionarioNome: string
        localidadeNome: string
        setor: string
        motivo: string
      }[] = []

      // 5. Sort available employees by historical preference if rule is active
      const sortedAvailable = [...availableFuncs].sort((a, b) => {
        const aHasHist = (autoAllocateRules.useHistory && employeeHistory[a.id]) ? 1 : 0
        const bHasHist = (autoAllocateRules.useHistory && employeeHistory[b.id]) ? 1 : 0
        return bHasHist - aHasHist
      })

      // 6. Match each employee to a locality
      sortedAvailable.forEach(f => {
        let assignedLocName: string | null = null
        let motivo = ''

        // Try historical matches first
        if (autoAllocateRules.useHistory && employeeHistory[f.id]) {
          const sortedPrefs = Object.entries(employeeHistory[f.id])
            .sort((a, b) => b[1] - a[1])
            .map(entry => ({ locName: entry[0], count: entry[1] }))

          for (const pref of sortedPrefs) {
            const exists = localidadesConfig.some(l => l.nome === pref.locName)
            if (exists && capacities[pref.locName] > 0) {
              assignedLocName = pref.locName
              motivo = `Histórico (${pref.count}x nos últimos 10 dias)`
              break
            }
          }
        }

        // Try matching by employee's sector
        if (autoAllocateRules.useSector && !assignedLocName && f.setor) {
          const sectorLocs = localidadesConfig.filter(l => 
            l.setor && l.setor.toLowerCase() === f.setor.toLowerCase() && capacities[l.nome] > 0
          )
          if (sectorLocs.length > 0) {
            assignedLocName = sectorLocs[0].nome
            motivo = `Alocação por Setor (${f.setor})`
          }
        }

        // Fallback to any locality with capacity
        if (autoAllocateRules.useFallback && !assignedLocName) {
          const anyLoc = localidadesConfig.find(l => capacities[l.nome] > 0)
          if (anyLoc) {
            assignedLocName = anyLoc.nome
            motivo = `Preenchimento de Vaga (${anyLoc.setor || 'Geral'})`
          }
        }

        // If a locality was assigned, record it and update capacity
        if (assignedLocName) {
          capacities[assignedLocName]--
          const locObj = localidadesConfig.find(l => l.nome === assignedLocName)
          previewList.push({
            funcionarioId: f.id,
            funcionarioNome: f.apelido || f.nome,
            localidadeNome: assignedLocName,
            setor: locObj?.setor || '',
            motivo: motivo
          })
        }
      })

      if (previewList.length === 0) {
        return toast('Não há vagas disponíveis ou histórico suficiente para auto-alocação com as regras ativas.', 'warning')
      }

      // Open the preview modal instead of committing directly
      setAutoAllocatePreview(previewList)
    } catch (err: any) {
      toast('Erro na auto-alocação: ' + err.message, 'error')
    }
  }

  const handleConfirmAutoAllocate = async () => {
    if (!autoAllocatePreview) return
    try {
      const inserts: any[] = []
      autoAllocatePreview.forEach(item => {
        const todayEscala = escalaMap[`${item.funcionarioId}_${dateStr}`]
        inserts.push({
          ...(todayEscala ? { id: todayEscala.id } : {}),
          funcionario_id: item.funcionarioId,
          data: dateStr,
          tipo: todayEscala?.tipo || 'presente',
          localidade: item.localidadeNome,
          turno: todayEscala?.turno || 'integral'
        })
      })

      await batchMutation.mutateAsync({ items: inserts, skipFreqSync: true })

      // Deletar as frequências dos funcionários auto-alocados para virem sem check
      const funcIds = autoAllocatePreview.map(item => item.funcionarioId)
      await supabase
        .from('frequencia')
        .delete()
        .in('funcionario_id', funcIds)
        .eq('data', dateStr)

      await queryClient.refetchQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast(`Alocação automática aplicada com sucesso para ${inserts.length} colaboradores!`, 'success')
      setAutoAllocatePreview(null)
      clearSearch()
    } catch (err: any) {
      toast('Erro ao aplicar alocação: ' + err.message, 'error')
    }
  }

  if (loadF || loadE || loadTeam) return <div className="min-h-screen bg-background"><TopHeader title="Meta e Rota" /><div className="pt-28 sm:pt-32 pb-20"><Loading text="Organizando matriz de metas e rotas..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopHeader 
        title="Meta e Rota" 
        subtitle={viewMode === 'daily' ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : 'Matriz Semanal'} 
      />

      {/* PRINT VIEW (CARDS LAYOUT - COMPACT SINGLE-PAGE LANDSCAPE FOR DAILY / TABLE MATRIX FOR WEEKLY) */}
      <div 
        className="fixed z-[9999] bg-white print-cards-container text-slate-950 font-sans flex-col p-4 overflow-hidden"
        style={{ 
          isolation: 'isolate', 
          display: isPrinting ? 'flex' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1123px',
          height: viewMode === 'weekly' ? 'auto' : '794px',
          minHeight: viewMode === 'weekly' ? 'auto' : '794px',
          zIndex: 999999999,
          backgroundColor: '#ffffff',
          transformOrigin: 'top left'
        }}
      >
<style dangerouslySetInnerHTML={{ __html: `
          @page { size: A4 landscape; margin: 0mm !important; }
          
          /* ── Reset root layout when PDF capture is active on screen ── */
          .printing-active #root, 
          .printing-active #root > *, 
          .printing-active #root > * > * {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          @media print {
            * {
              box-shadow: none !important;
              text-shadow: none !important;
              -webkit-box-shadow: none !important;
              -webkit-text-shadow: none !important;
            }
            html, body { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: #ffffff !important; 
              color: #000000 !important;
            }
            body::before, body::after { display: none !important; }
            .print-cards-container ~ *, 
            [class*="sidebar"], [class*="Sidebar"], [class*="Header"], 
            nav, footer, aside, .bottom-nav, .z-50, .z-52, [class*="top-0"], [class*="left-0"], 
            [class*="right-0"], [class*="bottom-0"] {
              display: none !important;
              visibility: hidden !important;
            }
            .min-h-screen { display: block !important; min-height: auto !important; height: auto !important; background: transparent !important; }
            #root, #root > *, #root > * > * { 
              max-width: 100% !important; 
              width: 100% !important; 
              margin: 0 !important; 
              padding: 0 !important; 
              border-radius: 0 !important; 
            }
            .print-cards-container { 
              display: flex !important; 
              position: relative !important;
              width: 297mm !important;
              height: auto !important;
              min-height: 210mm !important;
              padding: 5mm !important; 
              margin: 0 !important;
              background: #ffffff !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
              border: none !important;
              visibility: visible !important;
              z-index: 2147483647 !important;
            }
            .print-cards-container > * {
              visibility: visible !important;
            }
          }
        `}} />
        
        {viewMode === 'daily' ? (
          <>
            {/* Print Header */}
            <div className="flex items-center justify-between border-b-[2px] border-slate-900 pb-1.5 mb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{plataformaNome}</span>
                <div className="w-1 h-3.5 bg-primary rounded-full" />
                <h1 className="text-xs font-black uppercase text-slate-950 tracking-tight">Escala Diária de Locais</h1>
              </div>
              <div className="text-[9px] font-black uppercase text-slate-900">
                {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>

            {/* Unified Cards Grid */}
            <div className="grid grid-cols-4 gap-1.5 flex-1 overflow-hidden min-h-0">
              {allActiveLocalidades.map(l => (
                <div key={l.nome} className="bg-white border border-slate-300 rounded-xl p-1.5 flex flex-col justify-between shadow-sm h-full min-h-0 overflow-hidden">
                  <div>
                    <div className="flex items-start justify-between border-b border-slate-200 pb-0.5 mb-1 shrink-0">
                      <div className="max-w-[75%]">
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block leading-none">{l.setor}</span>
                        <h4 className="text-sm font-black text-slate-900 leading-tight uppercase mt-0.5 truncate">{l.nome}</h4>
                        {(() => {
                          const meta = equipesMeta[l.id] || {}
                          const linkedDemandIds = meta.demandas || []
                          const oldLocais = meta.locais || []
                          const titles = linkedDemandIds.length > 0 
                            ? linkedDemandIds.map(id => globalDemandas.find(d => d.id === id)?.titulo).filter(Boolean)
                            : oldLocais
                          if (titles.length === 0) return null
                          return (
                            <p className="text-[8px] text-slate-500 font-bold leading-tight mt-0.5 truncate">
                              {titles.join(' / ')}
                            </p>
                          )
                        })()}
                      </div>
                      <span className="text-[11px] font-black bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md shrink-0 leading-none">
                        {l.members.length} P
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-0.5 overflow-hidden max-h-[30mm]">
                      {l.members.length === 0 ? (
                        <div className="w-full py-1 flex flex-col items-center justify-center opacity-30 border border-dashed border-slate-200 rounded-lg">
                          <Users className="w-3.5 h-3.5 mb-0.5 text-slate-400" />
                          <span className="text-[7px] font-black uppercase tracking-wider text-slate-400">Vazio</span>
                        </div>
                      ) : (
                        l.members.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md shrink-0">
                            <div className="w-4.5 h-4.5 rounded bg-primary text-white flex items-center justify-center text-[9px] font-black shrink-0">
                              {(m.apelido || m.nome).charAt(0).toUpperCase()}
                            </div>
                            <FuncionarioName nome={m.nome} apelido={m.apelido} uppercase size="xs" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Expanded Absences Banner */}
            {(printData.off.folga.length > 0 || printData.off.ferias.length > 0 || printData.off.atestado.length > 0) && (
              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-start gap-4 shrink-0 min-h-[15mm] pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 shrink-0 mt-0.5">AUSÊNCIAS:</span>
                
                <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-slate-700">
                  {printData.off.folga.length > 0 && (
                    <div className="flex items-start gap-1.5 shrink-0">
                      <span className="text-slate-500 font-black shrink-0">FOLGA ({printData.off.folga.length}):</span>
                      <span className="uppercase text-slate-600 leading-tight">{printData.off.folga.join(', ')}</span>
                    </div>
                  )}
                  {printData.off.ferias.length > 0 && (
                    <div className="flex items-start gap-1.5 shrink-0">
                      <span className="text-amber-600 font-black shrink-0">FÉRIAS ({printData.off.ferias.length}):</span>
                      <span className="uppercase text-slate-600 leading-tight">{printData.off.ferias.join(', ')}</span>
                    </div>
                  )}
                  {printData.off.atestado.length > 0 && (
                    <div className="flex items-start gap-1.5 shrink-0">
                      <span className="text-rose-600 font-black shrink-0">ATESTADO ({printData.off.atestado.length}):</span>
                      <span className="uppercase text-rose-800 leading-tight">{printData.off.atestado.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Weekly Print Header */}
            <div className="flex items-center justify-between border-b-[2px] border-slate-900 pb-1.5 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{plataformaNome}</span>
                <div className="w-1 h-3.5 bg-primary rounded-full" />
                <h1 className="text-xs font-black uppercase text-slate-950 tracking-tight">Escala Semanal de Locais</h1>
              </div>
              <div className="text-[9px] font-black uppercase text-slate-900">
                Semana: {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} a {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
              </div>
            </div>

            {/* Weekly Grid/Table Layout for Image */}
            <div className="bg-white border border-slate-300 rounded-xl flex flex-col w-full">
              <div className="w-full">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-[10px] font-black uppercase tracking-wider text-slate-700 border-r border-slate-300 w-[18%]">
                        Local
                      </th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="p-2 text-center border-r border-slate-300 last:border-r-0 w-[11.7%]">
                          <span className="block text-[8px] font-black uppercase text-slate-500 leading-none">
                            {format(day, 'EEE', { locale: ptBR })}
                          </span>
                          <span className="block text-[11px] font-black text-slate-900 mt-0.5 leading-none">
                            {format(day, 'dd/MM')}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSetores.map(setor => {
                      const locs = localidadesConfig.filter(l => l.setor === setor)
                      if (locs.length === 0) return null
                      return (
                        <React.Fragment key={setor}>
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="px-2 py-1 font-black text-[9px] text-primary uppercase tracking-wider border-b border-slate-200">
                              {setor}
                            </td>
                          </tr>
                          {locs.map(loc => (
                            <tr key={loc.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50">
                              <td className="p-2 font-black text-[10px] text-slate-900 border-r border-slate-300 uppercase tracking-tight truncate max-w-[150px]">
                                {loc.nome}
                              </td>
                              {weekDays.map(day => {
                                const dStr = format(day, 'yyyy-MM-dd')
                                const assigned = escalas.filter((e: any) => {
                                  const f = funcMap[e.funcionario_id]
                                  if (!f) return false
                                  const matchesDate = e.data.substring(0, 10) === dStr
                                  if (!matchesDate) return false
                                  const matchesLoc = e.localidade === loc.nome
                                  if (!matchesLoc) return false
                                  const isWorking = ['presente', 'hora_extra', 'falta'].includes(e.tipo)
                                  if (!isWorking) return false
                                  
                                  if (searchTerm) {
                                    const matchesSearch = matchesFuzzy(f.nome, searchTerm) || 
                                                         (f.apelido && matchesFuzzy(f.apelido, searchTerm))
                                    if (!matchesSearch) return false
                                  }
                                  return true
                                })
                                return (
                                  <td key={dStr} className="p-1.5 align-top border-r border-slate-300 last:border-r-0 text-center">
                                    <div className="flex flex-col gap-0.5 justify-center">
                                      {assigned.length === 0 ? (
                                        <span className="text-[7px] text-slate-300 uppercase font-black italic">-</span>
                                      ) : (
                                        assigned.map(e => (
                                          <div key={e.id} className={cn(
                                            "inline-flex flex-col items-center justify-center px-1 py-0.5 border rounded-md text-[9px] font-black uppercase tracking-tighter leading-none w-full",
                                            e.tipo === 'falta' ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-slate-50 border-slate-200 text-slate-800"
                                          )}>
                                            <span className="truncate max-w-full">
                                              {funcMap[e.funcionario_id]?.apelido || funcMap[e.funcionario_id]?.nome}
                                            </span>
                                            {e.tipo === 'falta' && (
                                              <span className="text-[6px] text-rose-500 font-bold leading-none mt-0.5">Falta</span>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32 relative print:hidden cyber-grid">

        {/* Headers Wrapper (Scrolls with content) */}
        <div className="space-y-4 mb-10">
          {/* AI Copilot Intelligence Banner */}
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 dark:from-amber-500/10 dark:to-orange-500/5 border border-amber-500/30 rounded-[2rem] p-4 sm:p-5 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    🤖 Copiloto IA de Alocação
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase hidden sm:inline">
                    • Histórico de 30 dias & Duplas Frequentes
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-black text-foreground mt-1 uppercase tracking-tight">
                  {filteredAvailableFuncs.length} Efetivos Avulsos • {localidadesConfig.filter(l => (dailyDistribution[l.id] || []).length === 0).length} Localidades Sem Alocação
                </p>
              </div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                {filteredAvailableFuncs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoAllocateAllWithAssistant}
                    disabled={assistantLoading}
                    className="flex-1 lg:flex-none px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 animate-spin" /> Alocar todos os avulsos com IA
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCopilotDrawerOpen(true)}
                  className="px-5 py-3.5 rounded-2xl bg-card border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0 cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Bot className="w-4 h-4 text-amber-500" /> Copiloto IA (Perguntar)
                </button>
              </div>
            )}
          </div>

          {/* Card de Filtros e Configurações */}
          <div className="bg-card/85 dark:bg-card/45 border border-border/40 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 shadow-xl cyber-scanline cyber-glow-primary relative z-20">
            <div className="flex flex-col gap-4 sm:gap-6">
              
              {/* Top row: Date Nav & View Toggle */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full md:w-auto flex justify-center">
                  <div className="flex items-center gap-1 sm:gap-2 bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30 w-full md:w-auto justify-between md:justify-start">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground shrink-0"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="px-2 sm:px-4 text-center">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase text-primary tracking-[0.2em]">{format(currentDate, 'EEEE', { locale: ptBR })}</p>
                      <p className="text-sm sm:text-base font-black text-foreground tracking-tight">{format(currentDate, 'dd/MM/yyyy')}</p>
                    </div>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground shrink-0"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="w-full md:w-auto bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30 flex items-center shrink-0 overflow-x-auto scrollbar-none">
                  <button onClick={() => setViewMode('daily')} className={cn("flex-1 md:flex-none px-6 py-3 sm:py-3.5 text-[10px] font-black uppercase tracking-widest rounded-[1.25rem] transition-all flex items-center justify-center gap-2 min-w-[120px]", viewMode === 'daily' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <LayoutGrid className="w-4 h-4" /> Diário
                  </button>
                  <button onClick={() => setViewMode('weekly')} className={cn("flex-1 md:flex-none px-6 py-3 sm:py-3.5 text-[10px] font-black uppercase tracking-widest rounded-[1.25rem] transition-all flex items-center justify-center gap-2 min-w-[120px]", viewMode === 'weekly' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <Layers className="w-4 h-4" /> Semanal
                  </button>
                </div>
              </div>

              {/* Bottom row: Actions */}
              <div className="flex flex-col xl:flex-row items-center justify-between gap-3 w-full">
                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1">
                  {!teamInfo?.isRestricted && (
                    <select
                      value={selectedTeamId || ''} 
                      onChange={e => {
                        setSelectedTeamId(e.target.value || null)
                        setFilterSetor('')
                      }}
                      className="w-full xl:w-56 bg-muted/50 border border-border/30 rounded-[1.25rem] px-4 h-12 sm:h-14 text-xs outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-foreground uppercase tracking-wider"
                    >
                      <option value="">Todas as Equipes</option>
                      {allTeams.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  )}

                  <select
                    value={filterSetor} 
                    onChange={e => setFilterSetor(e.target.value)}
                    className="w-full xl:w-56 bg-muted/50 border border-border/30 rounded-[1.25rem] px-4 h-12 sm:h-14 text-xs outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-foreground uppercase tracking-wider"
                  >
                    <option value="">Todos os Setores</option>
                    {setores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* Campo de Busca Principal, Sempre Aberto */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="text"
                      placeholder="Pesquisar colaborador..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-10 h-12 sm:h-14 bg-muted/50 border border-border/30 rounded-[1.25rem] text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all text-foreground uppercase tracking-wider placeholder:normal-case placeholder:text-muted-foreground/50"
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {/* Suggestions Panel for Inline Search (only when not scrolled) */}
                    {!isScrolled && searchTerm && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 dark:bg-card/90 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden animate-slide-down flex flex-col divide-y divide-border/20 z-[9999] cyber-scanline cyber-glow-primary">
                        <div className="p-3 bg-muted/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                          <span>Sugestões</span>
                          <span className="text-primary">{suggestions.length} encontrados</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto scrollbar-thin">
                          {suggestions.map(f => {
                            const { isTrabalhando, tipo, escala, isAlocado } = getEmployeeStatus(f.id, dateStr)
                            let statusLabel = 'Disponível'
                            let statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                            
                            if (!isTrabalhando) {
                              statusLabel = tipo === 'repouso' || tipo === 'compensar' ? 'Folga' : tipo.toUpperCase()
                              statusColor = 'text-slate-400 bg-muted/50 border-border/40'
                            } else if (isAlocado) {
                              statusLabel = `Alocado: ${escala.localidade}`
                              statusColor = 'text-primary bg-primary/10 border-primary/20'
                            } else if (tipo === 'falta') {
                              statusLabel = 'Falta'
                              statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                            }

                            const isAlreadyInTeam = filteredFuncionarios.some(ff => ff.id === f.id)
                            const originalTeams = employeeTeamMap[f.id] || []
                            const originalTeamText = originalTeams.length > 0 ? originalTeams.map(t => t.nome).join(', ') : 'Sem Equipe'

                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={async () => {
                                    if (isAlreadyInTeam) {
                                      scrollToEmployee(f.id)
                                    } else {
                                      await handleBorrowEmployee(f.id)
                                    }
                                  }}
                                  className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 active:bg-muted/80 transition-all text-left border-none bg-transparent cursor-pointer"
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <FuncionarioName nome={f.nome} apelido={f.apelido} uppercase size="xs" />
                                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mt-0.5">
                                      {f.cargo || 'Funcionário'} • Equipe: {originalTeamText}
                                    </span>
                                  </div>
                                  {isAlreadyInTeam ? (
                                    <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-wide shrink-0", statusColor)}>
                                      {statusLabel}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider shrink-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white transition-colors flex items-center gap-1">
                                      <UserPlus className="w-3.5 h-3.5" /> Pegar Emprestado
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto scrollbar-none pb-2 xl:pb-0 hide-scrollbar">
                  {canEdit && (
                    <button 
                      onClick={() => { setIsCopyModalOpen(true); setCopyPreview(null); setCopySourceDate('') }} 
                      className="flex-1 xl:flex-none min-w-[150px] h-12 sm:h-14 px-4 sm:px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.15em] shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      <ClipboardCopy className="w-4 h-4" /> Copiar Modelo
                    </button>
                  )}
                  <button onClick={handlePrint} className="h-12 w-12 sm:h-14 sm:w-14 bg-muted/50 rounded-[1.25rem] flex items-center justify-center hover:bg-card border border-border/30 active:scale-90 transition-all shrink-0" title="Compartilhar Imagem"><Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" /></button>
                  <button 
                    onClick={() => setIsPreviewModalOpen(true)} 
                    className="h-12 w-12 sm:h-14 sm:w-14 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-[1.25rem] flex items-center justify-center border border-primary/20 hover:border-transparent active:scale-90 transition-all shrink-0 group" 
                    title="Texto do Roteiro (Copy & WhatsApp)"
                  >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary group-hover:text-white transition-colors" />
                  </button>
                  {canAdmin && (
                    <button onClick={handleClearDay} className="h-12 w-12 sm:h-14 sm:w-14 bg-rose-500/10 rounded-[1.25rem] flex items-center justify-center hover:bg-rose-500 hover:text-white border border-rose-500/20 active:scale-90 transition-all shrink-0" title="Limpar Escala de Hoje"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 group-hover:text-white" /></button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Estatísticas Operacionais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Efetivo Ativo */}
            <div className="bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500" />
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Efetivo Ativo</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-foreground">{totalTrabalhando}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Colaboradores</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">Escalados para trabalhar hoje</p>
            </div>

            {/* Card 2: Alocados */}
            <div className="bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Alocados nas Rotas</p>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{percentAlocado}%</span>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-foreground">{totalAlocados}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">de {totalTrabalhando}</span>
              </div>
              <div className="w-full bg-muted/60 dark:bg-muted/20 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${percentAlocado}%` }} />
              </div>
            </div>

            {/* Card 3: Avulsos */}
            <div className="bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Efetivo Avulso</p>
                {availableFuncs.length > 0 ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-foreground">{availableFuncs.length}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Pendentes</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                {availableFuncs.length > 0 ? "Aguardando alocação em equipe" : "Todo o efetivo alocado!"}
              </p>
            </div>

            {/* Card 4: Ausências */}
            <div className="bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 to-purple-500" />
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Ausências & Folgas</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-foreground">{totalAusentes}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Ausentes</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">Férias, folgas ou atestados hoje</p>
            </div>
          </div>
        </div>
        {/* View Content */}
        <div className="pb-12 print:hidden">
          {viewMode === 'daily' && (
            <div className="space-y-16">
              {visibleSetores.map(setor => {
                const locs = localidadesConfig.filter(l => l.setor === setor)
                if (locs.length === 0) return null
                return (
                  <div key={setor} className="space-y-8">
                    <div className="flex items-center gap-3 px-4">
                      <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
                      <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">{setor}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                      {locs.map(loc => {
                        const members = dailyDistribution[loc.id] || []
                        const isEditing = editingTeamId === loc.id
                        return (
                          <div 
                            key={loc.id} 
                            onDragOver={(e) => {
                              if (canEdit) {
                                e.preventDefault()
                              }
                            }}
                            onDragEnter={() => canEdit && setDragOverLocId(loc.id)}
                            onDragLeave={() => canEdit && setDragOverLocId(null)}
                            onDrop={(e) => canEdit && handleDrop(e, loc.id, loc.nome)}
                            data-drop-target-loc-id={loc.id}
                            data-drop-target-loc-name={loc.nome}
                            className={cn(
                              "bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-[2.5rem] shadow-sm hover:shadow-[0_20px_40px_rgba(59,130,246,0.06)] hover:border-primary/25 hover:scale-[1.01] transition-all duration-500 group",
                              isEditing ? "overflow-visible z-30" : "overflow-hidden",
                              dragOverLocId === loc.id && "border-primary/50 dark:border-primary/45 shadow-lg shadow-primary/10 scale-[1.02] bg-primary/[0.02]"
                            )}
                          >
                            {(() => {
                              const adminTeam = allTeams.find(t => t.id === loc.equipe_id)
                              const leaderId = equipesMeta[loc.id]?.lider_id
                              const leaderObj = allFuncionarios.find(f => f.id === leaderId)
                              const leaderName = leaderObj ? (leaderObj.apelido || leaderObj.nome) : null

                              return (
                                <div className="p-5 sm:p-6 border-b border-border/30 flex items-center justify-between bg-muted/10 backdrop-blur-md relative">
                                  {adminTeam && adminTeam.cor && (
                                    <div 
                                      className="absolute top-0 left-0 w-full h-[3px] opacity-80" 
                                      style={{ backgroundColor: adminTeam.cor }} 
                                    />
                                  )}
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div 
                                      className="w-11 h-11 rounded-[1.25rem] bg-background/50 dark:bg-background/20 border border-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner shrink-0"
                                      style={adminTeam && adminTeam.cor ? { backgroundColor: `${adminTeam.cor}15`, borderColor: `${adminTeam.cor}30`, color: adminTeam.cor } : {}}
                                    >
                                      <Navigation2 className="w-5 h-5 transition-transform group-hover:rotate-45" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate uppercase">{loc.nome}</h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-70">{members.length} Posições</span>
                                        {leaderName && (
                                          <>
                                            <span className="text-muted-foreground/30 text-xs">•</span>
                                            <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-0.5">
                                              👑 {leaderName}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button 
                                        onClick={() => setEditingTeamId(isEditing ? null : loc.id)} 
                                        className={cn(
                                          "p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center shadow-sm",
                                          isEditing 
                                            ? "bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-500/25" 
                                            : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/30 hover:border-primary/30"
                                        )}
                                        title={isEditing ? "Concluir Edição" : "Editar Equipe"}
                                      >
                                        {isEditing ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <Pencil className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* AI Recommendation Box for this locality */}
                            {canEdit && (() => {
                              const bestCandidate = getBestCandidateForLocality(loc.nome, members)
                              if (!bestCandidate) return null
                              return (
                                <div className="mx-4 my-2.5 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/25 flex items-center justify-between gap-2 text-xs shadow-xs">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider truncate">
                                        💡 Dica IA: <strong>{bestCandidate.name}</strong>
                                      </p>
                                      <p className="text-[8.5px] font-semibold text-muted-foreground truncate">
                                        {bestCandidate.reason}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await handleMove(bestCandidate.id, loc.nome)
                                      toast(`${bestCandidate.name} alocado em "${loc.nome}"!`, 'success')
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-xs cursor-pointer"
                                  >
                                    + Adicionar
                                  </button>
                                </div>
                              )
                            })()}
                            
                            {(((equipesMeta[loc.id]?.demandas || []).length > 0) || ((equipesMeta[loc.id]?.locais || []).length > 0) || isEditing) && (
                              <div className="px-5 sm:px-6 py-4 bg-background/50 border-b border-border/30 flex flex-col gap-3 animate-fade-in">
                                <div className="flex flex-col gap-2">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Demandas de Trabalho</label>
                                  <div className="flex flex-wrap gap-2">
                                    {(() => {
                                      const meta = equipesMeta[loc.id] || {}
                                      const linkedDemandIds = meta.demandas || []
                                      const oldLocais = meta.locais || []
                                      
                                      if (linkedDemandIds.length > 0) {
                                        return linkedDemandIds.map((id) => {
                                          const dem = globalDemandas.find(d => d.id === id)
                                          if (!dem) return null
                                          const historyEntry = demandasHistorico.find(
                                            h => h.demandaId === dem.id && h.data === dateStr && h.equipeId === loc.id
                                          )
                                          const isCompletedToday = !!historyEntry
                                          const completionType = historyEntry?.tipo || 'realizada'
                                          
                                          return (
                                            <div 
                                              key={id} 
                                              className={cn(
                                                "border px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm animate-fade-in transition-all",
                                                isCompletedToday
                                                  ? completionType === 'continuo'
                                                    ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                                    : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                                  : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                                              )}
                                            >
                                              <button
                                                type="button"
                                                disabled={!canEdit}
                                                onClick={async () => {
                                                  if (isCompletedToday) {
                                                    const updatedHistory = demandasHistorico.filter(
                                                      h => !(h.demandaId === dem.id && h.data === dateStr && h.equipeId === loc.id)
                                                    )
                                                    await updateConfigMut({ chave: 'demandas_historico', valor: updatedHistory })
                                                    toast('Demanda reaberta!', 'success')
                                                  } else {
                                                    setRegisterDemandModal({ dem, loc })
                                                  }
                                                }}
                                                className="hover:scale-110 active:scale-95 transition-all text-current flex items-center font-black"
                                                title={isCompletedToday ? "Marcar como pendente" : "Marcar como concluída"}
                                              >
                                                {isCompletedToday ? (
                                                  completionType === 'continuo' ? (
                                                    <Check className="w-3.5 h-3.5 text-blue-500" />
                                                  ) : (
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                  )
                                                ) : (
                                                  <span className="w-3 h-3 rounded-full border border-rose-500/40 block" />
                                                )}
                                              </button>
                                              <span>{dem.titulo}</span>
                                              {isCompletedToday ? (
                                                completionType === 'continuo' ? (
                                                  <span className="text-[7px] bg-blue-500 text-white px-1.5 py-0.5 rounded-[4px] font-black leading-none shrink-0 select-none">EM PROGRESSO</span>
                                                ) : (
                                                  <span className="text-[7px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-[4px] font-black leading-none shrink-0 select-none">REALIZADA</span>
                                                )
                                              ) : (
                                                <span className="text-[7px] bg-rose-500 text-white px-1.5 py-0.5 rounded-[4px] font-black leading-none shrink-0 select-none">PENDENTE</span>
                                              )}
                                              {isEditing && (
                                                <button 
                                                  onClick={async () => {
                                                    const updatedDemandIds = linkedDemandIds.filter(dId => dId !== id)
                                                    await handleUpdateMeta(loc.id, { demandas: updatedDemandIds })
                                                    toast('Demanda desvinculada!', 'success')
                                                  }}
                                                  className="text-current hover:text-rose-500 ml-1 transition-colors flex items-center"
                                                  title="Desvincular demanda"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          )
                                        })
                                      }
                                      
                                      // Render old locais as fallback (for historical data)
                                      return oldLocais.map((local, idx) => (
                                        <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm animate-fade-in">
                                          {local}
                                          {isEditing && (
                                            <button 
                                              onClick={() => {
                                                const currentLocais = equipesMeta[loc.id]?.locais || []
                                                handleUpdateMeta(loc.id, { locais: currentLocais.filter((_, i) => i !== idx) })
                                              }}
                                              className="text-primary hover:text-rose-500 ml-1 transition-colors"
                                              title="Remover local"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </span>
                                      ))
                                    })()}
                                  </div>
                                  
                                  {isEditing && (
                                    <div className="flex flex-col gap-2 mt-2">
                                      <div className="flex gap-2">
                                        {(() => {
                                          const teamLinkedDemandIds = equipesMeta[loc.id]?.demandas || []
                                          const linkableDemandas = globalDemandas.filter(d => !teamLinkedDemandIds.includes(d.id))
                                          const query = demandSearchQuery[loc.id] || ''
                                          const filteredSuggestions = query.trim()
                                            ? linkableDemandas.filter(d => 
                                                matchesFuzzy(d.titulo, query)
                                              )
                                            : []

                                          const isFocused = focusedLocId === loc.id

                                          return (
                                            <div className="relative flex-1">
                                              <input
                                                type="text"
                                                placeholder="📍 Vincular demanda / Rua no Google Maps..."
                                                value={demandSearchQuery[loc.id] || ''}
                                                onFocus={() => {
                                                  setFocusedLocId(loc.id)
                                                  if (demandSearchQuery[loc.id]) {
                                                    handleSearchGoogleMap(loc.id, demandSearchQuery[loc.id])
                                                  }
                                                }}
                                                onChange={(e) => {
                                                  const val = e.target.value
                                                  setDemandSearchQuery(prev => ({
                                                    ...prev,
                                                    [loc.id]: val
                                                  }))
                                                  handleSearchGoogleMap(loc.id, val)
                                                }}
                                                className="w-full bg-background border border-border/40 rounded-xl px-3 py-2 text-xs font-bold focus:border-primary/50 outline-none transition-all uppercase placeholder:text-[10px]"
                                              />

                                              {/* Autocomplete Dropdown overlay */}
                                              {isFocused && (filteredSuggestions.length > 0 || (googleAddressSuggestions[loc.id] && googleAddressSuggestions[loc.id].length > 0) || query.trim()) && (
                                                <>
                                                  {/* Backdrop to close list when clicking outside */}
                                                  <div 
                                                    className="fixed inset-0 z-10" 
                                                    onClick={() => setFocusedLocId(null)}
                                                  />
                                                  
                                                  <div className="absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-card border border-border/50 rounded-xl shadow-xl z-[9999] divide-y divide-border/10 py-1">
                                                    {/* Existing System Demands */}
                                                    {filteredSuggestions.map(d => (
                                                      <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={async () => {
                                                          const currentDemandIds = equipesMeta[loc.id]?.demandas || []
                                                          if (!currentDemandIds.includes(d.id)) {
                                                            await handleUpdateMeta(loc.id, { demandas: [...currentDemandIds, d.id] })
                                                            toast('Demanda vinculada com sucesso!', 'success')
                                                          }
                                                          setDemandSearchQuery(prev => ({ ...prev, [loc.id]: '' }))
                                                          setFocusedLocId(null)
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted/85 text-foreground uppercase flex items-center justify-between cursor-pointer"
                                                      >
                                                        <span className="truncate pr-2">{d.titulo}</span>
                                                        <span className={cn(
                                                          "text-[8px] px-1.5 py-0.5 rounded-full border leading-none font-black shrink-0",
                                                          d.tipo === 'always' 
                                                            ? "bg-indigo-500/10 text-indigo-650 border-indigo-500/20" 
                                                            : "bg-amber-500/10 text-amber-650 border-amber-500/20"
                                                        )}>
                                                          {d.tipo === 'always' ? 'Em Progresso' : 'Check'}
                                                        </span>
                                                      </button>
                                                    ))}

                                                    {/* Google Maps Geocoded Street Suggestions */}
                                                    {googleAddressSuggestions[loc.id] && googleAddressSuggestions[loc.id].length > 0 && (
                                                      <div className="bg-emerald-500/5 py-1">
                                                        <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                          <MapPin className="w-3 h-3" /> Sugestões do Google Maps
                                                        </div>
                                                        {googleAddressSuggestions[loc.id].map((item: any, idx: number) => {
                                                          const gTitle = (item.name || item.address?.road || item.display_name.split(',')[0]).toUpperCase()
                                                          const gSubtitle = item.display_name
                                                          return (
                                                            <button
                                                              key={`g-${idx}`}
                                                              type="button"
                                                              onClick={async () => {
                                                                // Check if demand title already exists globally
                                                                const existingDem = globalDemandas.find(gd => gd.titulo.toLowerCase() === gTitle.toLowerCase())
                                                                let demId = existingDem?.id

                                                                if (!demId) {
                                                                  demId = safeUUID()
                                                                  const newDem = {
                                                                    id: demId,
                                                                    titulo: gTitle,
                                                                    tipo: 'check' as const,
                                                                    concluido: false
                                                                  }
                                                                  const updatedDemandas = [...globalDemandas, newDem]
                                                                  await updateConfigMut({ chave: 'demandas', valor: updatedDemandas })
                                                                }

                                                                const currentDemandIds = equipesMeta[loc.id]?.demandas || []
                                                                if (!currentDemandIds.includes(demId)) {
                                                                  await handleUpdateMeta(loc.id, { demandas: [...currentDemandIds, demId] })
                                                                }

                                                                toast(`Localização "${gTitle}" geocodificada do Google Maps vinculada!`, 'success')
                                                                setDemandSearchQuery(prev => ({ ...prev, [loc.id]: '' }))
                                                                setFocusedLocId(null)
                                                              }}
                                                              className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-emerald-500/10 text-foreground flex items-start gap-2 cursor-pointer"
                                                            >
                                                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                              <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xs text-foreground truncate">{gTitle}</p>
                                                                <p className="text-[9px] font-medium text-muted-foreground truncate">{gSubtitle}</p>
                                                              </div>
                                                            </button>
                                                          )
                                                        })}
                                                      </div>
                                                    )}

                                                    {query.trim() && (
                                                      <button
                                                        type="button"
                                                        onClick={async () => {
                                                          const newDemandId = safeUUID()
                                                          const newDemand = {
                                                            id: newDemandId,
                                                            titulo: query.trim().toUpperCase(),
                                                            tipo: 'check' as const,
                                                            concluido: false
                                                          }
                                                          const updatedDemandas = [...globalDemandas, newDemand]
                                                          await updateConfigMut({ chave: 'demandas', valor: updatedDemandas })
                                                          
                                                          const currentDemandIds = equipesMeta[loc.id]?.demandas || []
                                                          if (!currentDemandIds.includes(newDemandId)) {
                                                            await handleUpdateMeta(loc.id, { demandas: [...currentDemandIds, newDemandId] })
                                                          }
                                                          
                                                          toast(`Demanda "${newDemand.titulo}" criada e vinculada!`, 'success')
                                                          setDemandSearchQuery(prev => ({ ...prev, [loc.id]: '' }))
                                                          setFocusedLocId(null)
                                                        }}
                                                        className="w-full text-left px-3 py-2.5 text-xs font-black text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-t border-border/20 flex items-center gap-1.5 cursor-pointer bg-primary/[0.02]"
                                                      >
                                                        <Plus className="w-3.5 h-3.5 shrink-0" />
                                                        <span>Criar e Vincular: "{query.trim().toUpperCase()}"</span>
                                                      </button>
                                                    )}
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {isEditing && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Líder da Equipe</label>
                                      <select 
                                        value={equipesMeta[loc.id]?.lider_id || ''} 
                                        onChange={(e) => handleUpdateMeta(loc.id, { lider_id: e.target.value })}
                                        className="w-full bg-background border border-border/40 rounded-xl px-3 py-2 text-xs font-bold focus:border-primary/50 outline-none transition-all"
                                      >
                                        <option value="">Nenhum líder selecionado</option>
                                        {members.map(m => (
                                          <option key={m.id} value={m.id}>{m.apelido || m.nome}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5 justify-end">
                                      <button 
                                        onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr, setor: loc.setor })} 
                                        className="w-full relative overflow-hidden group/btn px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/25 hover:border-transparent transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-primary/20 flex items-center justify-center gap-1.5 h-[38px] font-black text-[10px] uppercase tracking-wider"
                                      >
                                        <Plus className="w-3.5 h-3.5 shrink-0 transition-transform duration-300 group-hover/btn:rotate-90" />
                                        <span>Alocar</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="p-5 min-h-[80px] flex flex-col gap-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => canEdit && handleDrop(e, loc.id, loc.nome)}>
                              {(() => {
                                const filteredMembers = members.filter(m => 
                                  m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (m.apelido && m.apelido.toLowerCase().includes(searchTerm.toLowerCase()))
                                )
                                
                                const showDragPlaceholder = isDraggingId && !members.some(m => m.id === isDraggingId)
                                
                                if (members.length === 0 && !showDragPlaceholder) {
                                  return (
                                    <div className="w-full py-8 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-border rounded-[2rem] group-hover:border-primary/40 transition-colors">
                                      <Users className="w-7 h-7 mb-2" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Aguardando Alocação</span>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div className="flex flex-col gap-2 w-full">
                                    {filteredMembers.map((m: any) => {
                                      const funcaoId = equipesMeta[loc.id]?.funcoes?.[m.id]
                                      const funcaoConfig = dynamicFuncoes.find(f => f.id === funcaoId)
                                      const cardClasses = funcaoConfig ? funcaoConfig.classes : "bg-muted/60 border-border/50 hover:border-primary/50"
                                      const textClass = funcaoConfig ? funcaoConfig.textClass : "text-foreground"
                                      const isLider = equipesMeta[loc.id]?.lider_id === m.id

                                      return (
                                        <div 
                                          key={m.id} 
                                          id={`func-card-${m.id}`}
                                          draggable={canEdit} 
                                          onDragStart={(e) => canEdit && handleDragStart(e, m.id, loc.id, m.escalaId)} 
                                          onDragEnd={handleDragEnd}
                                          data-func-id={m.id}
                                          data-source-loc-id={loc.id}
                                          data-escala-id={m.escalaId || ''}
                                          className={cn(
                                            "w-full flex flex-col items-stretch p-2.5 sm:p-3 rounded-xl border border-border/20 dark:border-border/10 hover:border-primary/30 bg-muted/20 dark:bg-muted/5 hover:bg-background/80 dark:hover:bg-background/50 group/item transition-all duration-300 gap-2", 
                                            highlightedEmployeeId === m.id && "highlight-glow",
                                            canEdit ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:shadow-primary/5" : "cursor-default",
                                            m.tipo === 'falta' ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40" : cardClasses,
                                            isDraggingId === m.id && "opacity-40 border-dashed border-primary"
                                          )}>
                                          {/* Top Row: Employee details + delete button */}
                                          <div className="flex items-center justify-between w-full min-w-0">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                              {/* Avatar */}
                                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shadow-sm flex-shrink-0 transition-transform duration-300 group-hover/item:scale-105", 
                                                m.tipo === 'falta' ? "bg-rose-500 text-white" : isLider ? "bg-amber-500 text-white" : "bg-primary/20 text-primary dark:bg-primary/10"
                                              )}>
                                                {(m.apelido || m.nome).charAt(0)}
                                              </div>

                                              {/* Name + tags */}
                                              <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <FuncionarioName 
                                                    nome={m.nome} 
                                                    apelido={m.apelido} 
                                                    uppercase 
                                                    size="xs"
                                                    nicknameClassName={m.tipo === 'falta' ? "text-rose-600" : isLider ? "text-amber-500" : textClass}
                                                  />
                                                  {isLider && m.tipo !== 'falta' && (
                                                    <span className="text-[7px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest leading-none">
                                                      Líder
                                                    </span>
                                                  )}
                                                  {m.tipo === 'falta' && (
                                                    <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none">
                                                      Faltou
                                                    </span>
                                                  )}
                                                </div>
                                                {funcaoConfig && (
                                                  <div className="mt-0.5 flex flex-wrap gap-1 items-center">
                                                    <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-block leading-none", 
                                                      funcaoConfig.classes, 
                                                      funcaoConfig.textClass
                                                    )}>
                                                      {funcaoConfig.nome}
                                                    </span>
                                                    {employeeTeamMap[m.id]?.map(t => (
                                                      <span key={t.id} className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest leading-none">
                                                        {t.nome}
                                                      </span>
                                                    ))}
                                                    {borrowedMembers.some((bm: any) => bm.funcionario_id === m.id) && (
                                                      <span className="text-[7px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest leading-none">
                                                        ⇄ Emprestado
                                                      </span>
                                                    )}
                                                    {(!employeeTeamMap[m.id] || employeeTeamMap[m.id].length === 0) && (
                                                      <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none">
                                                        Sem Equipe
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                {!funcaoConfig && (
                                                  <div className="mt-0.5 flex flex-wrap gap-1 items-center">
                                                    {employeeTeamMap[m.id]?.map(t => (
                                                      <span key={t.id} className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest leading-none">
                                                        {t.nome}
                                                      </span>
                                                    ))}
                                                    {borrowedMembers.some((bm: any) => bm.funcionario_id === m.id) && (
                                                      <span className="text-[7px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest leading-none">
                                                        ⇄ Emprestado
                                                      </span>
                                                    )}
                                                    {(!employeeTeamMap[m.id] || employeeTeamMap[m.id].length === 0) && (
                                                      <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none">
                                                        Sem Equipe
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {/* Remove button */}
                                            {canEdit && isEditing && (
                                              <button 
                                                onClick={() => setDeleteConfirm({ 
                                                  escalaId: m.escalaId, 
                                                  funcionarioId: m.id, 
                                                  employeeName: m.apelido || m.nome 
                                                })} 
                                                className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-40 group-hover/item:opacity-100 shrink-0"
                                                title="Remover alocação"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>

                                          {/* Bottom Row: Selector for role (Função) */}
                                          {isEditing && (
                                            <div className="w-full pt-1.5 border-t border-border/10 dark:border-border/5">
                                              <select
                                                value={funcaoId || ''}
                                                onChange={(e) => {
                                                  const funcoes = { ...(equipesMeta[loc.id]?.funcoes || {}) }
                                                  if (e.target.value) funcoes[m.id] = e.target.value
                                                  else delete funcoes[m.id]
                                                  handleUpdateMeta(loc.id, { funcoes })
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-background/50 border border-border/30 rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none text-muted-foreground focus:text-foreground focus:border-primary/50 transition-colors uppercase tracking-wider"
                                              >
                                                <option value="">Função...</option>
                                                {dynamicFuncoes.map(f => (
                                                  <option key={f.id} value={f.id}>{f.nome}</option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                    
                                    {showDragPlaceholder && (
                                      <div className="w-full py-4 flex items-center justify-center border-2 border-dashed border-primary/30 rounded-xl bg-primary/[0.01] text-primary/50 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                        Soltar Aqui
                                      </div>
                                    )}
                                    
                                    {filteredMembers.length === 0 && !showDragPlaceholder && (
                                      <div className="w-full py-6 flex flex-col items-center justify-center opacity-30 border border-dashed border-border/30 rounded-xl">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Nenhum resultado</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Available Section Matrix */}
              {filteredAvailableFuncs.length > 0 && (
                <div className="mt-24 space-y-10">
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-black uppercase text-amber-500 tracking-[0.2em]">Efetivo Avulso (Disponível)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from(new Set(filteredAvailableFuncs.map(f => f.setor || 'Sem Setor'))).map(setor => {
                      const funcs = filteredAvailableFuncs.filter(f => (f.setor || 'Sem Setor') === setor)
                      if (funcs.length === 0) return null
                      return (
                        <div 
                          key={setor} 
                          onDragOver={(e) => {
                            if (canEdit) {
                              e.preventDefault()
                            }
                          }}
                          onDragEnter={() => canEdit && setDragOverSector(setor)}
                          onDragLeave={() => canEdit && setDragOverSector(null)}
                          onDrop={(e) => canEdit && handleDrop(e, 'available', null)}
                          data-drop-target-sector={setor}
                          className={cn(
                            "bg-card/40 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-8 shadow-sm transition-all duration-300",
                            dragOverSector === setor && "border-amber-500/50 dark:border-amber-500/40 shadow-lg shadow-amber-500/10 scale-[1.02] bg-amber-500/[0.02]"
                          )}
                        >
                          <div className="flex items-center justify-between mb-6"><h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{setor}</h4><span className="bg-amber-500/10 text-amber-600 text-[11px] font-black px-4 py-1.5 rounded-full border border-amber-500/20">{funcs.length} MEMBROS</span></div>
                          <div className="flex flex-wrap gap-3">
                            {funcs.map(f => (
                              <div 
                                key={f.id} 
                                id={`func-avulso-${f.id}`}
                                draggable={canEdit} 
                                onDragStart={(e) => canEdit && handleDragStart(e, f.id, 'available')} 
                                onDragEnd={handleDragEnd}
                                data-func-id={f.id}
                                data-source-loc-id="available"
                                className={cn(
                                  "flex flex-col gap-1 items-start px-4 py-2.5 bg-muted/30 dark:bg-muted/5 hover:bg-background border border-border/40 hover:border-amber-500/50 hover:text-amber-500 rounded-xl shadow-sm transition-all active:scale-95 cursor-grab active:cursor-grabbing uppercase tracking-tight",
                                  highlightedEmployeeId === f.id && "highlight-glow",
                                  isDraggingId === f.id && "opacity-40 border-dashed border-amber-500"
                                )}
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="flex items-center gap-2 text-[10px] font-black min-w-0 flex-1">
                                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                                    <div className="flex flex-col min-w-0 flex-1">
                                       <FuncionarioName nome={f.nome} apelido={f.apelido} uppercase size="xs" />
                                       {(() => {
                                         const fIdStr = String(f.id).trim();
                                         const rec = assistantData.recommendations[f.id]?.[0] || assistantData.recommendations[fIdStr]?.[0];
                                         if (!rec) return null;
                                         return (
                                           <button
                                             type="button"
                                             onClick={(evt) => {
                                               evt.stopPropagation();
                                               handleMove(f.id, rec.topLocalityName);
                                               toast(`Alocado em "${rec.topLocalityName}" por sugestão do assistente!`, 'success');
                                             }}
                                             className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white border border-amber-500/20 text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer group/pill shadow-xs"
                                             title={rec.reason}
                                           >
                                             <Sparkles className="w-3 h-3 text-amber-500 group-hover/pill:text-white shrink-0" />
                                             <span className="truncate">💡 Sugestão: {rec.topLocalityName}</span>
                                             <span className="text-[7px] font-bold opacity-80 shrink-0">({rec.matchPercent}%)</span>
                                           </button>
                                         );
                                       })()}
                                     </div>
                                  </div>
                                  {borrowedMembers.some((bm: any) => bm.funcionario_id === f.id) && canEdit && (
                                    <button
                                      type="button"
                                      onClick={async (evt) => {
                                        evt.stopPropagation()
                                        if (confirm(`Devolver o colaborador ${f.apelido || f.nome} para a equipe de origem? Ele sairá da sua lista de hoje.`)) {
                                          await handleReturnBorrowed(f.id)
                                        }
                                      }}
                                      className="text-rose-500 hover:text-rose-600 p-0.5 hover:bg-rose-500/10 rounded transition-colors shrink-0 cursor-pointer"
                                      title="Devolver colaborador emprestado"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {employeeTeamMap[f.id]?.map(t => (
                                    <span key={t.id} className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest leading-none">
                                      {t.nome}
                                    </span>
                                  ))}
                                  {borrowedMembers.some((bm: any) => bm.funcionario_id === f.id) && (
                                    <span className="text-[7px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest leading-none">
                                      ⇄ Emprestado
                                    </span>
                                  )}
                                  {(!employeeTeamMap[f.id] || employeeTeamMap[f.id].length === 0) && (
                                    <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none">
                                      Sem Equipe
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {isDraggingId && !funcs.some(f => f.id === isDraggingId) && (
                              <div className="w-full py-4 flex items-center justify-center border-2 border-dashed border-amber-500/30 rounded-xl bg-amber-500/[0.01] text-amber-500/50 text-[9px] font-black uppercase tracking-widest animate-pulse mt-2">
                                Retornar para Avulsos
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === 'weekly' && (
            /* Weekly Layout Matrix - Dual Responsive */
            <>
              {/* Weekly Mobile Layout (md:hidden) */}
              <div className="md:hidden space-y-8 animate-fade-in">
                {visibleSetores.map(setor => {
                  const locs = localidadesConfig.filter(l => l.setor === setor)
                  if (locs.length === 0) return null
                  return (
                    <div key={`${setor}-mobile`} className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-foreground">{setor}</span>
                      </div>
                      
                      {locs.map(loc => (
                        <div key={`${loc.id}-mobile`} className="bg-card/85 dark:bg-card/45 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 space-y-5 shadow-sm hover:border-primary/20 transition-all duration-300">
                          <div className="flex items-center justify-between border-b border-border/30 pb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Navigation2 className="w-5 h-5" /></div>
                              <div>
                                <h4 className="text-base font-black text-foreground uppercase tracking-tight leading-tight">{loc.nome}</h4>
                                <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.15em] mt-0.5">Cronograma Semanal</p>
                              </div>
                            </div>
                          </div>

                          {/* Week days timeline */}
                          <div className="space-y-3">
                            {weekDays.map(day => {
                              const dStr = format(day, 'yyyy-MM-dd')
                              const assigned = escalas.filter((e: any) => {
                                const f = funcMap[e.funcionario_id]
                                if (!f) return false
                                const matchesDate = e.data.substring(0, 10) === dStr
                                if (!matchesDate) return false
                                const matchesLoc = e.localidade === loc.nome
                                if (!matchesLoc) return false
                                const isWorking = ['presente', 'hora_extra', 'falta'].includes(e.tipo)
                                if (!isWorking) return false
                                
                                if (searchTerm) {
                                  const term = searchTerm.toLowerCase()
                                  const matchesSearch = f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
                                  if (!matchesSearch) return false
                                }
                                return true
                              })
                              const isDayToday = isToday(day)
                              
                              return (
                                <div key={dStr} className={cn("p-4 rounded-[1.75rem] border transition-all flex flex-col gap-3", isDayToday ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/30")}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("text-[9px] font-black uppercase px-2.5 py-1 rounded-xl tracking-wider", isDayToday ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                        {format(day, 'EEE', { locale: ptBR })}
                                      </span>
                                      <span className="text-[11px] font-black text-foreground">{format(day, 'dd/MM')}</span>
                                    </div>
                                    
                                    {canEdit && (
                                      <button 
                                        onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr: dStr, setor: loc.setor })}
                                        className="relative overflow-hidden group/btn w-8 h-8 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/15 hover:border-transparent transition-all duration-300 shadow-sm flex items-center justify-center"
                                      >
                                        <Plus className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/btn:rotate-90" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {assigned.length === 0 ? (
                                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 italic py-1 pl-1">Sem alocação</span>
                                    ) : (
                                      assigned.map(e => (
                                        <div key={e.id} className={cn(
                                          "inline-flex items-center gap-2 pl-3.5 pr-2 py-2 border rounded-2xl text-[10px] font-black shadow-sm uppercase tracking-tight",
                                          e.tipo === 'falta' ? "bg-rose-500/10 border-rose-500/30 text-rose-600" : "bg-card border-border/40 text-foreground"
                                        )}>
                                          {funcMap[e.funcionario_id]?.apelido || funcMap[e.funcionario_id]?.nome || 'Externo'}
                                          {e.tipo === 'falta' && <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[7px]">Falta</span>}
                                          {canEdit && (
                                            <button 
                                              onClick={(evt) => { evt.stopPropagation(); handleRemove(e.id); }}
                                              className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Weekly Desktop Layout (hidden md:block) */}
              <div className="hidden md:block bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[3rem] shadow-2xl overflow-hidden transition-all">
                <div className="overflow-x-auto scrollbar-none pb-6">
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="sticky left-0 top-[64px] z-40 bg-card border-b-2 border-r border-border/50 p-8 text-left min-w-[240px] shadow-md">
                          <div className="flex items-center gap-3"><Navigation2 className="w-5 h-5 text-primary" /><span className="text-xs font-black text-foreground uppercase tracking-widest">Matriz de Locais</span></div>
                        </th>
                        {weekDays.map(day => (
                          <th key={day.toISOString()} className={cn("sticky top-[64px] z-30 p-8 border-b-2 border-border/50 text-center transition-all", isToday(day) ? "bg-primary/5 shadow-inner" : "bg-muted/10")}>
                            <div className="flex flex-col items-center">
                              <span className={cn("text-[10px] font-black uppercase mb-2 tracking-widest", isSunday(day) ? "text-rose-500" : "text-muted-foreground")}>{format(day, 'EEEE', { locale: ptBR })}</span>
                              <span className={cn("text-2xl font-black tracking-tight", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, 'dd/MM')}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {visibleSetores.map(setor => {
                        const locs = localidadesConfig.filter(l => l.setor === setor)
                        if (locs.length === 0) return null
                        return (
                          <React.Fragment key={setor}>
                            <tr className="bg-muted/5">
                              <td colSpan={8} className="sticky left-0 z-20 px-8 py-4 border-b border-border/30 bg-card/90 backdrop-blur-md font-black text-xs text-primary uppercase tracking-[0.3em]">
                                {setor}
                              </td>
                            </tr>
                            {locs.map(loc => (
                              <tr key={loc.id} className="group hover:bg-primary/5 transition-colors">
                                <td className="sticky left-0 z-10 bg-card border-b border-r border-border/50 px-8 py-6 font-black text-sm text-foreground shadow-xl">
                                  {loc.nome}
                                </td>
                                {weekDays.map(day => {
                                  const dStr = format(day, 'yyyy-MM-dd')
                                  const assigned = escalas.filter((e: any) => {
                                    const f = funcMap[e.funcionario_id]
                                    if (!f) return false
                                    const matchesDate = e.data.substring(0, 10) === dStr
                                    if (!matchesDate) return false
                                    const matchesLoc = e.localidade === loc.nome
                                    if (!matchesLoc) return false
                                    const isWorking = ['presente', 'hora_extra', 'falta'].includes(e.tipo)
                                    if (!isWorking) return false
                                    
                                    if (searchTerm) {
                                      const term = searchTerm.toLowerCase()
                                      const matchesSearch = f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
                                      if (!matchesSearch) return false
                                    }
                                    return true
                                  })
                                  return (
                                    <td key={dStr} onClick={() => canEdit && setAssignModal({ locId: loc.id, locName: loc.nome, dateStr: dStr, setor: loc.setor })} className={cn("p-4 align-top border-b border-r border-border/30 bg-card/20 transition-all min-w-[170px]", canEdit ? "cursor-pointer hover:bg-background/80" : "cursor-default")}>
                                      <div className="space-y-2">
                                        {assigned.length === 0 ? (
                                          <div className="h-14 border-2 border-dashed border-border/20 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300">{canEdit && <Plus className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-105" />}</div>
                                        ) : (
                                          assigned.map(e => (
                                            <div key={e.id} className={cn(
                                              "flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-[10px] font-black shadow-sm transition-all uppercase tracking-tighter gap-2 group/item hover:scale-[1.03]",
                                              e.tipo === 'falta' ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500 text-rose-600" : "bg-muted/60 border-border/50 hover:border-primary/45 text-foreground hover:bg-card"
                                            )}>
                                              <span className="truncate">{funcMap[e.funcionario_id]?.apelido || funcMap[e.funcionario_id]?.nome || 'Externo'}</span>
                                              {e.tipo === 'falta' && <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[7px] ml-1">Falta</span>}
                                              {canEdit && (
                                                <button 
                                                  onClick={(evt) => { 
                                                    evt.stopPropagation(); 
                                                    const f = funcMap[e.funcionario_id];
                                                    setDeleteConfirm({ 
                                                      escalaId: e.id, 
                                                      funcionarioId: e.funcionario_id, 
                                                      employeeName: f?.apelido || f?.nome || 'Colaborador' 
                                                    }); 
                                                  }}
                                                  className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 opacity-40 group-hover/item:opacity-100 ml-auto"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Exception Section */}
          {Object.values(notWorkingGroups).some(g => g.members.length > 0) && viewMode === 'daily' && (
            <div className="pt-20 border-t border-border/30">
              <div className="flex items-center gap-3 mb-10 px-4">
                 <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
                 <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Planejamento e Ausências</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {Object.entries(notWorkingGroups).map(([id, group]) => (
                  group.members.length > 0 ? (
                    <div key={id} className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <div className={cn("p-2 rounded-xl bg-background border border-border/50 shadow-sm", group.color)}>
                          {group.icon}
                        </div>
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.label}</h4>
                        <span className="text-xs font-black text-foreground ml-auto">{group.members.length}</span>
                      </div>
                      
                      <div className="space-y-3">
                        {group.members
                          .filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (m.apelido && m.apelido.toLowerCase().includes(searchTerm.toLowerCase())))
                          .map(member => (
                          <div 
                            key={member.id} 
                            id={`func-ausente-${member.id}`}
                            className={cn(
                              "bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-4 flex items-center gap-4 group hover:border-primary/30 transition-all shadow-sm",
                              highlightedEmployeeId === member.id && "highlight-glow"
                            )}
                          >
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border/50 shadow-inner">
                              {(member.apelido || member.nome).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <FuncionarioName nome={member.nome} apelido={member.apelido} uppercase size="xs" />
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <p className={cn("text-[9px] font-black uppercase tracking-tighter mr-2", group.color)}>{member.tipoPlanejado}</p>
                                {employeeTeamMap[member.id]?.map(t => (
                                  <span key={t.id} className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest leading-none">
                                    {t.nome}
                                  </span>
                                ))}
                                {(!employeeTeamMap[member.id] || employeeTeamMap[member.id].length === 0) && (
                                  <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none">
                                    Sem Equipe
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

        </div>

      {/* Register Demand Type Modal */}
      {registerDemandModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border/50 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Registrar Demanda</h3>
              <button 
                onClick={() => setRegisterDemandModal(null)} 
                className="p-1.5 hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Demanda</p>
              <p className="text-xs font-black uppercase text-foreground bg-muted/30 p-4 rounded-2xl border border-border/20">
                {registerDemandModal.dem.titulo}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Equipe / Localidade</p>
              <p className="text-xs font-black uppercase text-foreground">
                {registerDemandModal.loc.nome}
              </p>
            </div>

            <p className="text-[10px] text-muted-foreground font-bold leading-relaxed uppercase">
              Selecione o tipo de registro para esta demanda hoje:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={async () => {
                  await handleConfirmRegisterDemand('realizada')
                }}
                className="py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
              >
                <Check className="w-4 h-4" />
                Realizada
              </button>
              <button
                onClick={async () => {
                  await handleConfirmRegisterDemand('continuo')
                }}
                className="py-3 px-4 rounded-2xl bg-white border border-blue-200 text-blue-600 hover:bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40 dark:text-blue-400 dark:hover:bg-blue-950/30 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4 text-blue-500" />
                Em Progresso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal Matrix */}
      <Modal open={!!assignModal} onClose={() => { setAssignModal(null); setModalSearchTerm(''); }} title="Alocação Direta" size="xl" className="max-w-4xl h-[90vh] sm:h-[90vh]">
        {assignModal && (() => {
          const currentAssign = assignModal;
          if (!currentAssign) return null;
          
          return (
            <div className="flex flex-col h-full space-y-6 py-4 animate-fade-in overflow-hidden">
              <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/20 flex items-center gap-5 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20"><Navigation2 className="w-7 h-7" /></div>
                <div><h4 className="text-xl font-black text-foreground leading-tight tracking-tight">{currentAssign.locName}</h4><p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mt-1">{format(parseLocalDate(currentAssign.dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p></div>
              </div>
              <div className="relative flex-shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                <input type="text" placeholder="Pesquisar por nome..." className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-transparent focus:border-primary/20 rounded-2xl text-base font-bold focus:ring-0 text-foreground" value={modalSearchTerm} onChange={e => setModalSearchTerm(e.target.value)} />
              </div>
              <div className="flex-1 overflow-y-auto pr-2 pb-4 scrollbar-thin">
                {(() => {
                  const list = filteredFuncionarios.filter(f => {
                    if (f.cargo?.toLowerCase() === 'encarregado') return false
                    
                    // Override to keep employee in the view during checkout animation
                    if (successAllocatedIds[f.id]) return true
                    
                    const { isAlocado, isTrabalhando } = getEmployeeStatus(f.id, currentAssign.dateStr)

                    if (!isTrabalhando || isAlocado) return false

                    if (modalSearchTerm.trim()) {
                      return matchEmployeeSearch(f, modalSearchTerm)
                    }
                    
                    return true
                  })
 
                  if (list.length === 0) {
                    return (
                      <div className="py-20 text-center opacity-30">
                        <Users className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum funcionário disponível</p>
                      </div>
                    )
                  }
 
                  // AI Sorting: Sort candidates by score for currentAssign.locName
                  const normTargetLoc = currentAssign.locName ? currentAssign.locName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
                  const currentLocMembers = dailyDistribution[currentAssign.locId] || []
                  const sortedList = [...list].sort((a, b) => {
                    const aId = String(a.id).trim()
                    const bId = String(b.id).trim()
                    const locDaysA = assistantData.empLocHist?.[aId]?.[normTargetLoc] || 0
                    const locDaysB = assistantData.empLocHist?.[bId]?.[normTargetLoc] || 0

                    const latestA = assistantData.latestAllocationMap?.[aId]
                    const latestB = assistantData.latestAllocationMap?.[bId]
                    const isLatestA = latestA && latestA.localityName ? normStr(latestA.localityName) === normTargetLoc : false
                    const isLatestB = latestB && latestB.localityName ? normStr(latestB.localityName) === normTargetLoc : false

                    const patternCountA = assistantData.localityPatternMap?.[aId]?.[normTargetLoc] || 0
                    const patternCountB = assistantData.localityPatternMap?.[bId]?.[normTargetLoc] || 0
                    
                    let pairDaysA = 0
                    let pairDaysB = 0
                    currentLocMembers.forEach(m => {
                      const mId = String(m.id).trim()
                      pairDaysA += assistantData.pairHist?.[aId]?.[mId] || 0
                      pairDaysB += assistantData.pairHist?.[bId]?.[mId] || 0
                    })

                    const scoreA = (isLatestA ? 80 : 0) + (patternCountA >= 2 ? 40 : 0) + (locDaysA * 15) + (pairDaysA * 8)
                    const scoreB = (isLatestB ? 80 : 0) + (patternCountB >= 2 ? 40 : 0) + (locDaysB * 15) + (pairDaysB * 8)

                    return scoreB - scoreA
                  })

                  return (
                    <div className="grid grid-cols-1 gap-2.5">
                      {sortedList.map((f, idx) => {
                        const fIdStr = String(f.id).trim()
                        const isSuccess = successAllocatedIds[f.id] || successAllocatedIds[fIdStr]
                        const locDays = assistantData.empLocHist?.[fIdStr]?.[normTargetLoc] || 0
                        
                        const latestAlloc = assistantData.latestAllocationMap?.[fIdStr]
                        const isLatestLoc = latestAlloc && latestAlloc.localityName ? normStr(latestAlloc.localityName) === normTargetLoc : false
                        const patternCount = assistantData.localityPatternMap?.[fIdStr]?.[normTargetLoc] || 0

                        let topPartnerName: string | null = null
                        let topPartnerDays = 0
                        currentLocMembers.forEach(m => {
                          const mId = String(m.id).trim()
                          const dTogether = assistantData.pairHist?.[fIdStr]?.[mId] || 0
                          if (dTogether > topPartnerDays) {
                            topPartnerDays = dTogether
                            topPartnerName = m.apelido || m.nome
                          }
                        })

                        const score = (isLatestLoc ? 80 : 0) + (patternCount >= 2 ? 40 : 0) + (locDays * 15) + (topPartnerDays * 8)
                        const isTopAi = idx === 0 && score > 0

                        return (
                          <button 
                            key={f.id} 
                            type="button"
                            disabled={isSuccess}
                            onClick={() => {
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur()
                              }
                              handleAssign(f.id)
                            }} 
                            className={cn(
                              "w-full flex items-center justify-between p-3.5 rounded-[1.25rem] transition-all group disabled:cursor-not-allowed shadow-sm text-left overflow-hidden border relative min-h-[64px]",
                              isSuccess 
                                ? "animate-cyber-assign" 
                                : isTopAi
                                  ? "bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/40 hover:border-amber-500/70 shadow-md shadow-amber-500/10"
                                  : "bg-card dark:bg-slate-800/80 hover:bg-primary/10 border-border/50 hover:border-primary/40 active:scale-[0.98] disabled:opacity-50"
                            )}
                          >
                            {/* Normal Content: Cross-fades out smoothly on success */}
                            <div className={cn(
                              "flex items-center justify-between w-full gap-3 transition-opacity duration-300",
                              isSuccess ? "opacity-0" : "opacity-100"
                            )}>
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all uppercase shrink-0",
                                  isTopAi ? "bg-amber-500 text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                                )}>
                                  {assigningId === f.id ? (
                                    <Clock className="w-4 h-4 animate-spin text-primary group-hover:text-white" />
                                  ) : (
                                    (f.apelido || f.nome).charAt(0)
                                  )}
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <FuncionarioName nome={f.nome} apelido={f.apelido} uppercase size="xs" />
                                    {isTopAi && (
                                      <span className="text-[7.5px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 animate-pulse">
                                        ✨ IA #1
                                      </span>
                                    )}
                                    {isLatestLoc && (
                                      <span className="text-[7.5px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                        📍 Última Alocação
                                      </span>
                                    )}
                                    {!isLatestLoc && patternCount >= 2 && (
                                      <span className="text-[7.5px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                        🔁 Padrão Mantido
                                      </span>
                                    )}
                                  </div>
                                  {f.apelido?.trim() && f.apelido.trim().toLowerCase() !== f.nome.trim().toLowerCase() && (
                                    <span className="text-[9.5px] font-medium text-muted-foreground/80 leading-tight uppercase block truncate" title={f.nome}>
                                      {f.nome}
                                    </span>
                                  )}
                                  {(isLatestLoc || patternCount > 0 || locDays > 0 || topPartnerDays > 0) && (
                                    <span className="text-[8.5px] font-bold text-amber-600 dark:text-amber-400 block truncate mt-0.5">
                                      {isLatestLoc
                                        ? `📍 Última alocação neste posto ${topPartnerName && topPartnerDays > 0 ? `• c/ ${String(topPartnerName).split(' ')[0]}` : ''}`
                                        : patternCount >= 2
                                          ? `🔁 Padrão: ${patternCount}/5 escalas recentes aqui`
                                          : topPartnerName && topPartnerDays > 0 ? `${locDays}x aqui • ${topPartnerDays}x c/ ${String(topPartnerName).split(' ')[0]}` : `${locDays}x nesta localidade`}
                                    </span>
                                  )}

                                  {f.setor && f.setor !== currentAssign.setor && (
                                    <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground bg-muted/60 dark:bg-muted/30 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                                      {f.setor}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="w-9 h-9 rounded-xl bg-muted/60 dark:bg-muted/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                {assigningId === f.id ? (
                                  <Clock className="w-4 h-4 animate-spin text-muted-foreground group-hover:text-white" />
                                ) : (
                                  <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                )}
                              </div>
                            </div>

                            {/* Success Overlay: Smooth holographic merge layer */}
                            {isSuccess && (
                              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500 text-white animate-check-layer z-10">
                                <Check className="w-6 h-6 text-white stroke-[3.5px] animate-scale-up-check" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
              <div className="flex-shrink-0 pt-2">
                <Button variant="secondary" onClick={() => setAssignModal(null)} className="w-full h-14 rounded-2xl font-black uppercase text-xs">Fechar Painel</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Auto-Allocation Rules Selection Modal */}
      <Modal
        open={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        title="Configurar Regras de Auto-Alocação"
        size="md"
      >
        <div className="flex flex-col space-y-6 py-4 animate-scale-in">
          <div className="bg-primary/5 p-5 rounded-[2rem] border border-primary/20 flex flex-col gap-1.5 flex-shrink-0">
            <h4 className="text-sm font-black text-foreground tracking-tight uppercase">
              Diretrizes de Alocação
            </h4>
            <p className="text-xs text-muted-foreground">
              Selecione quais regras de negócio o algoritmo inteligente deve usar para distribuir o efetivo avulso nas vagas disponíveis.
            </p>
          </div>

          <div className="space-y-5 flex-1 overflow-y-auto pr-2 scrollbar-thin max-h-[50vh]">
            <div className="space-y-3">
              <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Regras de Compatibilidade</h5>
              
              <label className="flex items-start gap-3.5 p-4 bg-muted/30 dark:bg-muted/15 border border-border/30 rounded-2xl cursor-pointer hover:border-primary/30 transition-all select-none">
                <input 
                  type="checkbox"
                  checked={autoAllocateRules.useHistory}
                  onChange={e => setAutoAllocateRules(prev => ({ ...prev, useHistory: e.target.checked }))}
                  className="mt-1 rounded border-border text-primary focus:ring-primary w-4.5 h-4.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-foreground uppercase tracking-tight">Priorizar Histórico Recente</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Distribui com base nos locais em que o funcionário trabalhou nos últimos 10 dias.</span>
                </div>
              </label>

              <label className="flex items-start gap-3.5 p-4 bg-muted/30 dark:bg-muted/15 border border-border/30 rounded-2xl cursor-pointer hover:border-primary/30 transition-all select-none">
                <input 
                  type="checkbox"
                  checked={autoAllocateRules.useSector}
                  onChange={e => setAutoAllocateRules(prev => ({ ...prev, useSector: e.target.checked }))}
                  className="mt-1 rounded border-border text-primary focus:ring-primary w-4.5 h-4.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-foreground uppercase tracking-tight">Compatibilidade de Setor</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Aloca os funcionários de acordo com o setor de atuação do seu cadastro.</span>
                </div>
              </label>

              <label className="flex items-start gap-3.5 p-4 bg-muted/30 dark:bg-muted/15 border border-border/30 rounded-2xl cursor-pointer hover:border-primary/30 transition-all select-none">
                <input 
                  type="checkbox"
                  checked={autoAllocateRules.useFallback}
                  onChange={e => setAutoAllocateRules(prev => ({ ...prev, useFallback: e.target.checked }))}
                  className="mt-1 rounded border-border text-primary focus:ring-primary w-4.5 h-4.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-foreground uppercase tracking-tight">Vagas Gerais (Preenchimento Fallback)</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Permite alocação em outros setores caso o funcionário não possua correspondência de setor ou histórico.</span>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Quantidade de Funcionários por Setor</h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sectorsToRenderForRules.map(setor => {
                  const availableCount = sectorAvailableCounts[setor] || 0
                  const currentLimit = sectorLimits[setor] !== undefined
                    ? sectorLimits[setor]
                    : (setor.toLowerCase().includes('varr') ? 2 : 1)
                  
                  return (
                    <div key={setor} className="flex flex-col gap-1.5 p-3.5 bg-muted/30 dark:bg-muted/15 border border-border/30 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-foreground uppercase tracking-tight truncate max-w-[70%]">
                          {setor}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase bg-card border border-border/20 px-2 py-0.5 rounded-lg shrink-0">
                          {availableCount} disp.
                        </span>
                      </div>
                      <select
                        value={currentLimit}
                        onChange={e => setSectorLimits(prev => ({ ...prev, [setor]: parseInt(e.target.value) }))}
                        className="w-full bg-card border border-border/30 rounded-xl px-2.5 h-10 text-xs outline-none focus:ring-2 focus:ring-primary/10 transition-all font-bold text-foreground"
                      >
                        {[1, 2, 3, 4, 5].map(v => (
                          <option key={v} value={v}>
                            {v} {v === 1 ? 'colaborador' : 'colaboradores'} por local
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              onClick={() => setIsRulesModalOpen(false)} 
              className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider"
            >
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                setIsRulesModalOpen(false)
                await handleAutoAllocate()
              }} 
              disabled={!autoAllocateRules.useHistory && !autoAllocateRules.useSector && !autoAllocateRules.useFallback}
              className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20"
            >
              Gerar Prévia
            </Button>
          </div>
        </div>
      </Modal>

      {/* Auto-Allocation Confirmation Modal */}
      <Modal
        open={!!autoAllocatePreview}
        onClose={() => setAutoAllocatePreview(null)}
        title="Visualizar Auto-Alocação Inteligente"
        size="lg"
      >
        {autoAllocatePreview && (
          <div className="flex flex-col h-[75vh] space-y-6 py-4 animate-scale-in overflow-hidden">
            <div className="bg-primary/5 p-5 rounded-[2rem] border border-primary/20 flex flex-col gap-1.5 flex-shrink-0">
              <h4 className="text-base font-black text-foreground tracking-tight">
                Sugestão de Alocação de Efetivo
              </h4>
              <p className="text-xs text-muted-foreground">
                Com base nos últimos 10 dias de histórico de trabalho e nos limites de capacidade dos setores (máx. 2 para Varrição em dupla, máx. 1 para Banheiro, Limpeza e outros).
              </p>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 scrollbar-thin space-y-4">
              {(() => {
                const grouped = autoAllocatePreview.reduce((acc: Record<string, typeof autoAllocatePreview>, item) => {
                  if (!acc[item.localidadeNome]) {
                    acc[item.localidadeNome] = []
                  }
                  acc[item.localidadeNome].push(item)
                  return acc
                }, {})

                const orderedGroupedEntries = Object.entries(grouped).sort(([locNameA], [locNameB]) => {
                  const locA = localidadesConfig.find(l => l.nome === locNameA)
                  const locB = localidadesConfig.find(l => l.nome === locNameB)
                  
                  const sectorA = locA?.setor || ''
                  const sectorB = locB?.setor || ''
                  
                  const sectorIndexA = visibleSetores.indexOf(sectorA)
                  const sectorIndexB = visibleSetores.indexOf(sectorB)
                  
                  if (sectorIndexA !== sectorIndexB) {
                    return (sectorIndexA === -1 ? 9999 : sectorIndexA) - (sectorIndexB === -1 ? 9999 : sectorIndexB)
                  }
                  
                  const indexA = localidadesConfig.findIndex(l => l.nome === locNameA)
                  const indexB = localidadesConfig.findIndex(l => l.nome === locNameB)
                  return (indexA === -1 ? 9999 : indexA) - (indexB === -1 ? 9999 : indexB)
                })

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {orderedGroupedEntries.map(([locName, items]) => {
                      const firstItem = items[0]
                      return (
                        <div 
                          key={locName} 
                          className="bg-card/50 border border-border/30 rounded-[2rem] p-5 shadow-sm hover:border-primary/30 transition-all flex flex-col justify-between"
                        >
                          <div className="border-b border-border/20 pb-2 mb-3">
                            <span className="text-[9px] font-black uppercase tracking-wider text-primary">
                              {firstItem.setor || 'Geral'}
                            </span>
                            <h5 className="text-sm font-black text-foreground uppercase tracking-tight leading-tight mt-0.5">
                              {locName}
                            </h5>
                          </div>
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/40 dark:bg-muted/20 border border-border/30 rounded-xl">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                                    {item.funcionarioNome.charAt(0)}
                                  </div>
                                  <span className="text-xs font-black text-foreground uppercase truncate">
                                    {item.funcionarioNome}
                                  </span>
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground bg-card px-2 py-0.5 rounded border border-border/20 shrink-0 max-w-[150px] truncate" title={item.motivo}>
                                  {item.motivo}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <div className="flex gap-3 pt-2 flex-shrink-0">
              <Button 
                variant="secondary" 
                onClick={() => setAutoAllocatePreview(null)} 
                className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmAutoAllocate} 
                className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20"
              >
                Confirmar Alocação ({autoAllocatePreview.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Premium Deletion Confirmation Modal */}
      <Modal 
        open={!!deleteConfirm} 
        onClose={() => setDeleteConfirm(null)} 
        title="Confirmar Remoção" 
        size="sm"
      >
        {deleteConfirm && (() => {
          const isFuncBorrowed = deleteConfirm.funcionarioId ? isBorrowed(deleteConfirm.funcionarioId) : false
          return (
            <div className="py-4 text-center space-y-6 animate-scale-in">
              <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20 shadow-xl shadow-rose-500/5">
                <UserMinus className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-black text-foreground uppercase tracking-tight">Remover Colaborador?</h4>
                <p className="text-xs text-muted-foreground animate-in fade-in duration-200">
                  {isFuncBorrowed 
                    ? `O colaborador ${deleteConfirm.employeeName} está emprestado de outra equipe hoje. Como deseja proceder?`
                    : `Tem certeza que deseja remover ${deleteConfirm.employeeName} deste local de trabalho?`
                  }
                </p>
              </div>
              
              {isFuncBorrowed ? (
                <div className="flex flex-col gap-2.5 pt-2">
                  <Button 
                    variant="secondary" 
                    onClick={async () => {
                      const id = deleteConfirm.escalaId
                      const funcId = deleteConfirm.funcionarioId
                      setDeleteConfirm(null)
                      await handleRemove(id, funcId)
                    }} 
                    className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border border-border/40 hover:bg-muted"
                  >
                    Remover apenas Alocação (Manter Emprestado)
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      const funcId = deleteConfirm.funcionarioId
                      setDeleteConfirm(null)
                      if (funcId) {
                        await handleReturnBorrowed(funcId)
                      }
                    }} 
                    className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest bg-rose-500 hover:bg-rose-600 text-white border-none shadow-lg shadow-rose-500/10"
                  >
                    Devolver Colaborador (Retornar para Origem)
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setDeleteConfirm(null)} 
                    className="w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => setDeleteConfirm(null)} 
                    className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      const id = deleteConfirm.escalaId
                      const funcId = deleteConfirm.funcionarioId
                      setDeleteConfirm(null)
                      await handleRemove(id, funcId)
                    }} 
                    className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 border-none"
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* CUSTOM CONFIRMATION MODAL FOR HOLIDAY/SUNDAY WORK */}
      <Modal
        open={!!specialDayConfirm}
        onClose={() => {
          specialDayConfirm?.onCancel()
          setSpecialDayConfirm(null)
        }}
        title={specialDayConfirm?.title || "Dia Especial Detectado"}
        footer={
          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
            <Button 
              variant="secondary" 
              className="flex-1 text-[10px] font-black uppercase tracking-wider" 
              onClick={() => {
                specialDayConfirm?.onCancel()
                setSpecialDayConfirm(null)
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="outline"
              className="flex-1 text-[10px] font-black uppercase tracking-wider border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20" 
              onClick={() => {
                specialDayConfirm?.onConfirmTrabalho()
                setSpecialDayConfirm(null)
              }}
            >
              Trabalho Normal (T)
            </Button>
            <Button 
              className="flex-1 text-[10px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={() => {
                specialDayConfirm?.onConfirmHE()
                setSpecialDayConfirm(null)
              }}
            >
              Hora Extra (HE)
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
            {specialDayConfirm?.description}
          </p>
          <div className="bg-blue-500/5 dark:bg-blue-500/[0.01] border border-blue-500/25 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Data Selecionada</p>
              <p className="text-xs font-black text-foreground uppercase tracking-tight mt-1">{specialDayConfirm?.dateLabel}</p>
            </div>
            <div className="flex gap-1.5">
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-500 text-white">T</span>
              <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-500 text-white">HE</span>
            </div>
          </div>
        </div>
      </Modal>
      {/* Copiar Modelo de Dia Anterior Modal */}
      <Modal
        open={isCopyModalOpen}
        onClose={() => { setIsCopyModalOpen(false); setCopyPreview(null); setCopySourceDate('') }}
        title="Copiar Modelo de Dia"
        size="md"
      >
        <div className="flex flex-col space-y-6 py-4 animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 p-5 rounded-[2rem] border border-violet-500/20 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 shrink-0">
              <ClipboardCopy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground tracking-tight uppercase">Copiar Alocações de Outro Dia</h4>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                Selecione um dia anterior para copiar o modelo de alocações para <strong className="text-violet-500">{format(currentDate, "dd/MM/yyyy")}</strong>.
              </p>
            </div>
          </div>

          {/* Mode Tabs: Identico vs 10-day Average */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Modelo</label>
            <div className="grid grid-cols-2 p-1.5 bg-muted/50 rounded-2xl border border-border/40 gap-1.5">
              <button
                type="button"
                onClick={() => { setCopyType('identico'); setCopyPreview(null) }}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  copyType === 'identico' 
                    ? "bg-card text-violet-600 dark:text-violet-400 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ClipboardCopy className="w-3.5 h-3.5" /> Modelo Idêntico
              </button>
              <button
                type="button"
                onClick={() => { setCopyType('media_10_dias'); setCopyPreview(null) }}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  copyType === 'media_10_dias' 
                    ? "bg-card text-violet-600 dark:text-violet-400 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" /> Média dos 10 Dias
              </button>
            </div>
          </div>

          {copyType === 'identico' ? (
            /* Date Picker for Identical Day Copy */
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Dia de Origem</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={copySourceDate}
                  max={format(subDays(currentDate, 1), 'yyyy-MM-dd')}
                  onChange={e => { setCopySourceDate(e.target.value); setCopyPreview(null) }}
                  className="flex-1 bg-muted/40 border border-border/40 rounded-2xl px-4 h-14 text-sm font-bold focus:border-violet-500/50 outline-none transition-all text-foreground"
                />
                <button
                  onClick={handlePreviewCopyFromDay}
                  disabled={!copySourceDate || isCopyLoading}
                  className="h-14 px-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 shrink-0"
                >
                  {isCopyLoading ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Ver
                </button>
              </div>
            </div>
          ) : (
            /* 10-day Average Action Card */
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wider">Histórico Frequencial dos Últimos 10 Dias</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Calcula a localidade mais frequente de cada colaborador nos últimos 10 dias de trabalho e sugere a alocação ideal de forma inteligente.
              </p>
              <button
                type="button"
                onClick={handlePreview10DayAverage}
                disabled={isCopyLoading}
                className="h-12 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isCopyLoading ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Calcular Média dos 10 Dias
              </button>
            </div>
          )}

          {/* Mode Option: With or Without Localities */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Formato da Cópia</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCopyIncludeLocalities(true)}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all duration-300 relative",
                  copyIncludeLocalities 
                    ? "bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/20" 
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider">Com Localidades</span>
                  <CheckCircle2 className={cn("w-4 h-4", copyIncludeLocalities ? "text-violet-500" : "opacity-0")} />
                </div>
                <span className="text-[9px] font-medium opacity-80 leading-tight">
                  Aloca os colaboradores mantendo exatamente seus locais e ruas de origem
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCopyIncludeLocalities(false)}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all duration-300 relative",
                  !copyIncludeLocalities 
                    ? "bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/20" 
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider">Sem Localidades</span>
                  <CheckCircle2 className={cn("w-4 h-4", !copyIncludeLocalities ? "text-violet-500" : "opacity-0")} />
                </div>
                <span className="text-[9px] font-medium opacity-80 leading-tight">
                  Copia a presença dos colaboradores, mas deixa os locais em branco para alocar
                </span>
              </button>
            </div>
          </div>

          {/* Preview */}
          {copyPreview && copyPreview.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Prévia — {copyPreview.length} alocações encontradas
                </span>
                <span className="text-[9px] font-black text-violet-500 uppercase tracking-wider">
                  {copyType === 'identico' && copySourceDate 
                    ? format(parseLocalDate(copySourceDate), "dd/MM/yyyy", { locale: ptBR })
                    : 'Média dos 10 Dias'
                  }
                </span>
              </div>
              <div className="max-h-[35vh] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {/* Group by locality */}
                {Object.entries(
                  copyPreview.reduce((acc: Record<string, typeof copyPreview>, item) => {
                    if (!acc[item.localidadeNome]) acc[item.localidadeNome] = []
                    acc[item.localidadeNome].push(item)
                    return acc
                  }, {})
                ).map(([loc, items]) => (
                  <div key={loc} className="bg-muted/30 border border-border/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Navigation2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{loc}</span>
                      <span className="ml-auto text-[9px] font-black text-muted-foreground bg-card border border-border/20 px-2 py-0.5 rounded-lg">{items.length}p</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item, idx) => (
                        <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-[10px] font-black uppercase text-violet-700 dark:text-violet-300">
                          <span className="w-4 h-4 rounded bg-violet-500 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                            {item.funcionarioNome.charAt(0)}
                          </span>
                          {item.funcionarioNome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => { setIsCopyModalOpen(false); setCopyPreview(null); setCopySourceDate('') }}
              className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCopyFromDay}
              disabled={!copyPreview || copyPreview.length === 0}
              className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 border-none disabled:opacity-40"
            >
              Aplicar Modelo ({copyPreview?.length ?? 0})
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL DE COMPARTILHAMENTO / COPIAR TEXTO DO ROTEIRO DO DIA */}
      {isPreviewModalOpen && (
        <Modal
          open={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Compartilhar Roteiro do Dia"
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Estilo da Mensagem</p>
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/20 gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setPreviewMode('completo')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none min-w-[80px]",
                    previewMode === 'completo' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Texto Completo
                </button>
                <button
                  onClick={() => setPreviewMode('enxuto')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none min-w-[80px]",
                    previewMode === 'enxuto' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Texto Enxuto
                </button>
                <button
                  onClick={() => setPreviewMode('apenas_localidades')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none min-w-[80px]",
                    previewMode === 'apenas_localidades' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Localidade & Efetivo
                </button>
                <button
                  onClick={() => setPreviewMode('tipo_equipe')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none min-w-[80px]",
                    previewMode === 'tipo_equipe' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Texto por Setor
                </button>
                <button
                  onClick={() => setPreviewMode('demandas_realizadas')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none min-w-[80px]",
                    previewMode === 'demandas_realizadas' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Realizações
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Visualização da Mensagem</p>
              <div className="relative">
                <textarea
                  readOnly
                  value={getDailyMessageText(previewMode)}
                  className="w-full h-72 bg-muted/20 border border-border/20 rounded-2xl p-4.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/30 resize-none select-all select-text cursor-text"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">
                    {previewMode === 'completo' ? 'Completo' : previewMode === 'enxuto' ? 'Enxuto' : previewMode === 'apenas_localidades' ? 'Localidade & Efetivo' : previewMode === 'tipo_equipe' ? 'Setor' : 'Realizações'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const text = getDailyMessageText(previewMode)
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(text)
                    } else {
                      const textarea = document.createElement('textarea')
                      textarea.value = text
                      textarea.style.position = 'fixed'
                      document.body.appendChild(textarea)
                      textarea.select()
                      document.execCommand('copy')
                      document.body.removeChild(textarea)
                    }
                    toast('Mensagem copiada para a área de transferência!', 'success')
                  } catch (err) {
                    toast('Erro ao copiar mensagem', 'error')
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2.5 h-14 rounded-2xl bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer border border-primary/10"
              >
                <Copy className="w-4 h-4 shrink-0" /> Copiar Mensagem
              </button>

              <button
                onClick={() => {
                  const text = getDailyMessageText(previewMode)
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
                  window.open(url, '_blank')
                }}
                className="flex-1 flex items-center justify-center gap-2.5 h-14 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer border-none"
              >
                <MessageSquare className="w-4 h-4 shrink-0" /> WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* FLOATING BALLOON SEARCH BAR */}
      {isScrolled && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center print:hidden animate-fade-in gap-3.5 w-[90vw] max-w-xl">
          {/* Input container balloon */}
          <div className="flex items-center gap-3.5 p-3.5 px-6 bg-card/95 dark:bg-card/85 backdrop-blur-3xl border border-primary/40 rounded-full shadow-[0_25px_50px_-12px_rgba(var(--primary),0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-300 ease-out cyber-glow-primary w-full">
            <Search className="w-5 h-5 text-primary shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar colaborador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm md:text-base font-black text-foreground placeholder:text-muted-foreground/45 focus:ring-0 p-0 uppercase tracking-wider"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-colors shrink-0"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            )}
          </div>

          {/* Suggestions Panel */}
          {searchTerm && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-3 w-full bg-card/95 dark:bg-card/90 backdrop-blur-3xl border border-border/40 rounded-[2.25rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-down flex flex-col divide-y divide-border/20 z-[9999] cyber-scanline cyber-glow-primary">
              <div className="p-4.5 px-6 bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>Sugestões</span>
                <span className="text-primary">{suggestions.length} encontrados</span>
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {suggestions.map(f => {
                  const { isTrabalhando, tipo, escala, isAlocado } = getEmployeeStatus(f.id, dateStr)
                  let statusLabel = 'Disponível'
                  let statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                  
                  if (!isTrabalhando) {
                    statusLabel = tipo === 'repouso' || tipo === 'compensar' ? 'Folga' : tipo.toUpperCase()
                    statusColor = 'text-slate-400 bg-muted/50 border-border/40'
                  } else if (isAlocado) {
                    statusLabel = `Alocado: ${escala.localidade}`
                    statusColor = 'text-primary bg-primary/10 border-primary/20'
                  } else if (tipo === 'falta') {
                    statusLabel = 'Falta'
                    statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                  }

                  const isAlreadyInTeam = filteredFuncionarios.some(ff => ff.id === f.id)
                  const originalTeams = employeeTeamMap[f.id] || []
                  const originalTeamText = originalTeams.length > 0 ? originalTeams.map(t => t.nome).join(', ') : 'Sem Equipe'

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={async () => {
                        if (isAlreadyInTeam) {
                          scrollToEmployee(f.id)
                        } else {
                          await handleBorrowEmployee(f.id)
                        }
                      }}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 active:bg-muted/80 transition-all text-left border-none bg-transparent cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <span className="text-xs sm:text-sm font-black text-foreground uppercase truncate block tracking-wide">
                          {f.apelido || f.nome}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest block mt-1">
                          {f.cargo || 'Funcionário'} • Equipe: {originalTeamText}
                        </span>
                      </div>
                      {isAlreadyInTeam ? (
                        <span className={cn("text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-wider shrink-0", statusColor)}>
                          {statusLabel}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-wider shrink-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white transition-colors flex items-center gap-1">
                          <UserPlus className="w-4 h-4" /> Pegar Emprestado
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Smart Allocation Assistant Modal */}
      <Modal
        open={isAssistantModalOpen}
        onClose={() => setIsAssistantModalOpen(false)}
        title="✨ Assistente de Alocação de Membros"
        size="lg"
      >
        <div className="space-y-6 py-2">
          {/* Subtitle / Explanation Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-5 rounded-3xl border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-foreground tracking-wider">Recomendações Baseadas no Histórico</h4>
                <p className="text-[10px] text-muted-foreground font-bold leading-relaxed mt-0.5">
                  Analisa os últimos 30 dias: localidades mais frequentadas e históricos de duplas/equipes que já trabalharam juntas.
                </p>
              </div>
            </div>

            {filteredAvailableFuncs && filteredAvailableFuncs.length > 0 && (
              <button
                type="button"
                onClick={handleAutoAllocateAllWithAssistant}
                disabled={assistantLoading}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Alocar Todos Avulsos com IA
              </button>
            )}
          </div>

          {/* Assistant List of Unallocated Employees */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
            {!filteredAvailableFuncs || filteredAvailableFuncs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/40 rounded-3xl text-center space-y-3 bg-muted/5">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-80" />
                <p className="text-xs font-black uppercase text-foreground tracking-wide">Todos os colaboradores já estão alocados!</p>
                <p className="text-[10px] text-muted-foreground">Nenhum efetivo avulso restante para hoje.</p>
              </div>
            ) : (
              filteredAvailableFuncs.map(f => {
                const userRecs = assistantData.recommendations[f.id] || []
                const topRec = userRecs[0]
                const behavior = assistantData.empBehavior?.[f.id]

                return (
                  <div key={f.id} className="p-4 bg-card border border-border/40 hover:border-amber-500/40 rounded-3xl transition-all shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                          {(f.apelido || f.nome).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <FuncionarioName nome={f.nome} apelido={f.apelido} uppercase size="xs" />
                          <p className="text-[9px] font-medium text-muted-foreground uppercase">{f.cargo || 'Funcionário'}</p>
                          {/* Behavior badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {behavior && behavior.faltaDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[7px] font-black uppercase">
                                {behavior.faltaDays} falta{behavior.faltaDays > 1 ? 's' : ''}
                              </span>
                            )}
                            {behavior && behavior.atestadoDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[7px] font-black uppercase">
                                {behavior.atestadoDays} atestado{behavior.atestadoDays > 1 ? 's' : ''}
                              </span>
                            )}
                            {behavior && behavior.suspensaoDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-700/10 text-red-700 dark:text-red-400 border border-red-700/20 text-[7px] font-black uppercase">
                                {behavior.suspensaoDays}d suspenso
                              </span>
                            )}
                            {behavior && behavior.horaExtraDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[7px] font-black uppercase">
                                {behavior.horaExtraDays} HE
                              </span>
                            )}
                            {behavior && behavior.faltaDays === 0 && behavior.suspensaoDays === 0 && behavior.atestadoDays === 0 && behavior.presentDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[7px] font-black uppercase">
                                ✅ Sem faltas
                              </span>
                            )}
                            {behavior && behavior.daysAwayBeforeReturn <= 3 && behavior.daysAwayBeforeReturn > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 text-[7px] font-black uppercase">
                                🔄 Retornando
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {topRec && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider">
                          ✨ {topRec.matchPercent}% Afinação
                        </span>
                      )}
                    </div>

                    {/* Recommendations per employee */}
                    <div className="space-y-2 pt-2 border-t border-border/10">
                      {userRecs.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">🆕 Colaborador novo — pode ser alocado em qualquer localidade disponível.</p>
                      ) : (
                        userRecs.slice(0, 3).map((rec: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/20 text-xs">
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-foreground uppercase truncate">📍 {rec.topLocalityName}</p>
                                <p className="text-[9.5px] font-medium text-muted-foreground mt-0.5 leading-tight truncate">
                                  {rec.reason}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                await handleMove(f.id, rec.topLocalityName)
                                toast(`${f.apelido || f.nome} alocado em "${rec.topLocalityName}"!`, 'success')
                              }}
                              className="px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-[9.5px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-xs"
                            >
                              Alocar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-border/10">
            <Button variant="secondary" onClick={() => setIsAssistantModalOpen(false)} className="h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest">
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Borrow Employee Modal */}
      <Modal
        open={!!borrowModal}
        onClose={() => setBorrowModal(null)}
        title="Pegar Colaborador Emprestado"
        size="sm"
      >
        {borrowModal && (
          <div className="space-y-6 py-2 text-left">
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg">
                {(borrowModal.funcionario.apelido || borrowModal.funcionario.nome).substring(0, 1).toUpperCase()}
              </div>
              <div>
                <FuncionarioName nome={borrowModal.funcionario.nome} apelido={borrowModal.funcionario.apelido} uppercase size="sm" />
                <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                  {borrowModal.funcionario.cargo || 'Funcionário'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Tipo de Empréstimo
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsBorrowingRange(false)}
                  className={cn(
                    "p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all duration-300",
                    !isBorrowingRange
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border/40 text-muted-foreground hover:border-border"
                  )}
                >
                  <span className="text-xs font-black uppercase">Apenas Hoje</span>
                  <span className="text-[10px] font-medium opacity-80">
                    {format(parseISO(dateStr), "dd/MM/yyyy")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBorrowingRange(true)}
                  className={cn(
                    "p-4 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all duration-300",
                    isBorrowingRange
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border/40 text-muted-foreground hover:border-border"
                  )}
                >
                  <span className="text-xs font-black uppercase">Vários Dias</span>
                  <span className="text-[10px] font-medium opacity-80">Período de datas</span>
                </button>
              </div>
            </div>

            {isBorrowingRange && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={borrowStartDate}
                    onChange={(e) => setBorrowStartDate(e.target.value)}
                    className="w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    value={borrowEndDate}
                    onChange={(e) => setBorrowEndDate(e.target.value)}
                    className="w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-border/10">
              <Button
                variant="secondary"
                onClick={() => setBorrowModal(null)}
                className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest"
                disabled={borrowLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setBorrowLoading(true)
                  await submitBorrow(
                    isBorrowingRange ? borrowStartDate : dateStr,
                    isBorrowingRange ? borrowEndDate : dateStr
                  )
                  setBorrowLoading(false)
                }}
                className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest bg-primary text-white hover:bg-primary/90"
                disabled={borrowLoading}
              >
                {borrowLoading ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <AiAllocationModal
        open={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        suggestions={aiSuggestions}
        onApproveAll={handleApproveAiAllocations}
      />

      <CopilotoIaDrawer
        open={isCopilotDrawerOpen}
        onClose={() => setIsCopilotDrawerOpen(false)}
        localidades={localidadesConfig.map(l => ({ id: l.id, nome: l.nome, setor: l.setor }))}
        funcionarios={allFuncionarios}
        engine={aiEngine}
        dateStr={dateStr}
        onOpenAutoAllocateAll={handleAutoAllocateAllWithAssistant}
      />
    </div>
  )
}
