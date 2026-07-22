import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  format, 
  isToday, 
  isSunday,
  parseISO, 
  addDays, 
  subDays,
  startOfDay,
  eachDayOfInterval
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Modal } from '../components/ui/Modal'
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  MapPin, 
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Calendar,
  MoreVertical,
  Activity,
  Award,
  AlertCircle,
  CheckCircle,
  Zap,
  Trash2,
  RotateCcw,
  UserPlus,
  UserMinus
} from 'lucide-react'
import { cn, escalaTipoLabel } from '../lib/utils'
import type { EscalaTipo } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo, useUpsertEscala, useUpdateEscala, useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useFrequenciaData, useUpsertFrequencia, useBatchUpsertFrequencia, FREQUENCIA_KEY } from '../hooks/useFrequencia'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'

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
    .trim()
}

function matchesFuzzy(target: string, query: string): boolean {
  const normQuery = normalizeStr(query)
  if (!normQuery) return false

  const normTarget = normalizeStr(target)

  // 1. Direct substring match
  if (normTarget.includes(normQuery)) {
    return true
  }

  // 2. Word-by-word match
  const queryWords = normQuery.split(/\s+/).filter(Boolean)
  if (queryWords.length > 1) {
    const allWordsMatch = queryWords.every(word => normTarget.includes(word))
    if (allWordsMatch) return true
  }

  // 3. Relaxed/similar matching: Any word of length >= 3
  if (queryWords.length > 0) {
    const anyWordMatches = queryWords.some(word => 
      word.length >= 3 && normTarget.includes(word)
    )
    if (anyWordMatches) return true
  }

  return false
}

interface Localidade {
  id: string
  nome: string
  setor: string
  equipe_id?: string | null
}



export function FrequenciaPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('frequencia', 'editar')
  const canAdmin = hasPermission('frequencia', 'administrar')

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

  const { data: teamInfo, isLoading: loadTeam } = useUserTeam()
  const { activePanel, selectedTeamId, setSelectedTeamId } = useAuth()

  const { data: allTeams = [] } = useQuery<any[]>({
    queryKey: ['all-teams-freq-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    }
  })

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

  const queryClient = useQueryClient()

  useEffect(() => {
    localStorage.setItem('7boss_selected_work_date', dateStr)
  }, [dateStr])

  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem('7boss_frequencia_search_term') || ''
  })

  useEffect(() => {
    localStorage.setItem('7boss_frequencia_search_term', searchTerm)
  }, [searchTerm])

  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({})
  const [isScrolled, setIsScrolled] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendentes' | 'presentes' | 'faltas'>(() => {
    return (localStorage.getItem('7boss_frequencia_status_filter') as any) || 'todos'
  })

  useEffect(() => {
    localStorage.setItem('7boss_frequencia_status_filter', statusFilter)
  }, [statusFilter])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchTerm('')
  }, [])

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

  const isBorrowed = useCallback((id: string) => {
    const activeTeamId = teamInfo?.isRestricted ? (teamInfo.teamIds?.[0] || null) : selectedTeamId
    return borrowedMembers.some((bm: any) => bm.funcionario_id === id && bm.equipe_id === activeTeamId)
  }, [borrowedMembers, teamInfo, selectedTeamId])

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
      queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: any) {
      toast('Erro ao pegar emprestado: ' + err.message, 'error')
    }
  }

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(dateStr, dateStr)
  const { data: frequencias = [], isLoading: loadFreq } = useFrequenciaData(dateStr)
  const { data: dbLocalidades = [] } = useConfiguracao<Localidade[]>('localidades', [])
  const { data: dbSetoresEquipes = {} } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  
  const dateKey = `equipes_meta_${dateStr}`
  const { data: equipesMeta = {} } = useConfiguracao<Record<string, any>>(dateKey, {})

  // Removed unneeded team membership queries to prevent discrepancy with EscalaLocalidadePage

  const getFeriado = useCallback((day: Date) => {
    const dStr = format(day, 'yyyy-MM-dd')
    return feriados.find((f: any) => f.data === dStr)
  }, [feriados])
  const localidadesConfig = useMemo(() => {
    let result = []
    if (teamInfo?.isRestricted) {
      const allowedIds = teamInfo.teamIds || []
      // Mostra todas as localidades de todas as equipes do encarregado
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
    return [...result].sort((a, b) => {
      const teamA = allTeams.find(t => t.id === a.equipe_id)
      const teamB = allTeams.find(t => t.id === b.equipe_id)
      const nameA = teamA ? teamA.nome : 'ZZZZZ'
      const nameB = teamB ? teamB.nome : 'ZZZZZ'
      const comp = nameA.localeCompare(nameB)
      if (comp !== 0) return comp
      return a.nome.localeCompare(b.nome)
    })
  }, [dbLocalidades, selectedTeamId, teamInfo, dbSetoresEquipes, allTeams])

  const upsertFreqMutation = useUpsertFrequencia()
  const batchFreqMutation = useBatchUpsertFrequencia()
  const upsertEscalaMutation = useUpsertEscala()
  const updateEscalaMutation = useUpdateEscala()
  const batchEscalaMutation = useBatchUpsertEscalas()



  const filteredFuncionarios = useMemo(() => {
    let list = allFuncionarios.filter(f => !f.data_desligamento || f.data_desligamento > dateStr)
    
    // Filter out employees borrowed by OTHER teams today
    const activeTeamId = teamInfo?.isRestricted ? (teamInfo.teamIds?.[0] || null) : selectedTeamId
    const borrowedByOthers = borrowedMembers.filter((bm: any) => bm.equipe_id !== activeTeamId)
    const borrowedByOthersIds = new Set(borrowedByOthers.map((bm: any) => bm.funcionario_id))
    
    list = list.filter(f => !borrowedByOthersIds.has(f.id))

    if (teamInfo?.isRestricted) {
      // Mostra todos os funcionários de todas as equipes do encarregado + os emprestados
      const allowedIds = [...(teamInfo.teamMemberIds || []), ...supervisorBorrowedMemberIds]
      return list.filter(f => allowedIds.includes(f.id))
    }
    if (selectedTeamId) {
      const allowedSectors = dbSetoresEquipes[selectedTeamId] || []
      const allowedIds = [...(selectedTeamMembers || []), ...selectedTeamBorrowedMemberIds]
      return list.filter(f => 
        allowedIds.includes(f.id) ||
        (f.setor && allowedSectors.includes(f.setor))
      )
    }
    return list
  }, [allFuncionarios, selectedTeamId, selectedTeamMembers, teamInfo, dbSetoresEquipes, dateStr, supervisorBorrowedMemberIds, selectedTeamBorrowedMemberIds, borrowedMembers])

  const freqMap = useMemo(() => {
    const map: Record<string, string> = {}
    frequencias.forEach(f => {
      map[f.funcionario_id] = f.status
    })
    return map
  }, [frequencias])
  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    filteredFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') map[f.id] = f
    })
    return map
  }, [filteredFuncionarios])

  const getEmployeeStatus = useCallback((funcId: string) => {
    const e = escalas.find((esc: any) => esc.funcionario_id === funcId && esc.data.substring(0, 10) === dateStr)
    const isDiaDomingo = isSunday(currentDate)
    
    let isTrabalhando = false
    let tipo = 'presente'

    if (e) {
      isTrabalhando = e.tipo === 'presente' || e.tipo === 'hora_extra' || e.tipo === 'falta'
      tipo = e.tipo
    } else {
      isTrabalhando = !isDiaDomingo
      tipo = isDiaDomingo ? 'repouso' : 'presente'
    }

    const tipoReal = freqMap[funcId] || null
    const localidade = e?.localidade || null

    return {
      isTrabalhando,
      tipo,
      tipoReal,
      localidade
    }
  }, [escalas, dateStr, currentDate, freqMap])

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return []
    return allFuncionarios.filter(f => {
      const matchesSearch = matchesFuzzy(f.nome, searchTerm) || 
        (f.apelido && matchesFuzzy(f.apelido, searchTerm))
      return !!matchesSearch
    }).slice(0, 5)
  }, [allFuncionarios, searchTerm])

  const scrollToEmployee = useCallback((funcId: string) => {
    setHighlightedEmployeeId(funcId)
    clearSearch()
    
    // Wait for the search clearing render to settle so layout doesn't shift during scroll
    setTimeout(() => {
      let el = document.getElementById(`func-card-${funcId}`)
      if (!el) {
        el = document.getElementById(`func-ausente-${funcId}`)
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        toast('Colaborador não encontrado na visualização atual.', 'info')
      }
      
      // Keep highlighted state for 3 seconds
      setTimeout(() => {
        setHighlightedEmployeeId(null)
      }, 3000)
    }, 150)
  }, [clearSearch, toast])

  // Grouping for the "Chamada" - SYNCED WITH ESCALA
  const processedData = useMemo(() => {
    const workingGroups: Record<string, { id: string; nome: string; setor: string; members: any[] }> = {}
    const notWorkingGroups: Record<string, { label: string; icon: any; members: any[]; color: string }> = {
      'folga': { label: 'Folgas', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-blue-500' },
      'ferias': { label: 'Férias', icon: <Calendar className="w-4 h-4" />, members: [], color: 'text-purple-500' },
      'atestado': { label: 'Afastamentos', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-amber-500' },
      'outros': { label: 'Outros', icon: <Clock className="w-4 h-4" />, members: [], color: 'text-slate-500' },
    }
    
    workingGroups['sem_local'] = { id: 'sem_local', nome: 'Sem Equipe/Localidade', setor: 'Geral', members: [] }

    // Map of scales for fast lookup on the selected date Str
    const dayEscalaMap: Record<string, any> = {}
    escalas.forEach((e: any) => {
      const eDate = e.data.substring(0, 10)
      if (eDate === dateStr) {
        dayEscalaMap[e.funcionario_id] = e
      }
    })

    const isDiaDomingo = isSunday(currentDate)

    filteredFuncionarios.forEach((f) => {
      if (f.cargo?.toLowerCase() === 'encarregado') return

      const e = dayEscalaMap[f.id]
      const tipoReal = freqMap[f.id] || null
      let isTrabalhando = false
      let tipo = 'presente'

      if (e) {
        tipo = e.tipo
      } else {
        tipo = isDiaDomingo ? 'repouso' : 'presente'
      }

      if (tipoReal) {
        isTrabalhando = tipoReal === 'presente' || tipoReal === 'hora_extra' || tipoReal === 'falta'
      } else {
        if (e) {
          isTrabalhando = e.tipo === 'presente' || e.tipo === 'hora_extra' || e.tipo === 'falta'
        } else {
          isTrabalhando = !isDiaDomingo
        }
      }

      const freqToEscalaMap: Record<string, string> = {
        'presente': 'presente',
        'hora_extra': 'hora_extra',
        'falta': 'falta',
        'folga': 'compensar',
        'ferias': 'ferias',
        'atestado': 'atestado'
      }
      const mappedFreqEscala = tipoReal ? freqToEscalaMap[tipoReal] : null
      const resolvedStatus = mappedFreqEscala || tipo

      const resolvedLocalidade = e?.localidade || null

      const member = {
        ...f,
        escalaId: e?.id || null,
        tipoPlanejado: tipo, 
        tipoReal: freqMap[f.id] || null, 
        resolvedStatus,
        localidade: resolvedLocalidade
      }

      if (isTrabalhando) {
        if (resolvedLocalidade) {
          const groupKey = resolvedLocalidade
          if (!workingGroups[groupKey]) {
            workingGroups[groupKey] = { id: groupKey, nome: resolvedLocalidade, setor: f.setor || 'Operacional', members: [] }
          }
          workingGroups[groupKey].members.push(member)
        } else {
          workingGroups['sem_local'].members.push(member)
        }
      } else {
        if (resolvedStatus === 'repouso' || resolvedStatus === 'compensar') notWorkingGroups['folga'].members.push(member)
        else if (resolvedStatus === 'ferias') notWorkingGroups['ferias'].members.push(member)
        else if (resolvedStatus === 'atestado') notWorkingGroups['atestado'].members.push(member)
        else notWorkingGroups['outros'].members.push(member)
      }
    })

    return { workingGroups, notWorkingGroups }
  }, [escalas, dateStr, currentDate, filteredFuncionarios, freqMap, localidadesConfig])

  const handleStatus = async (funcionarioId: string, status: any) => {
    try {
      // Atualizar frequência
      await upsertFreqMutation.mutateAsync({ 
        funcionario_id: funcionarioId, 
        data: dateStr, 
        status 
      })
      
      // Sincronizar com a escala
      const escalaMap: Record<string, string> = {
        'presente': 'presente',
        'hora_extra': 'hora_extra',
        'falta': 'falta',
        'folga': 'compensar',
        'ferias': 'ferias',
        'atestado': 'atestado'
      }
      
      const escalaType = escalaMap[status] || 'presente'
      const currentEscala = escalas.find(e => e.funcionario_id === funcionarioId && e.data.substring(0, 10) === dateStr)
      
      if (currentEscala) {
        // Atualizar escala existente mantendo a localidade
        await updateEscalaMutation.mutateAsync({
          id: currentEscala.id,
          data: {
            tipo: escalaType,
            localidade: currentEscala.localidade
          }
        })
      } else {
        // Criar nova escala
        await upsertEscalaMutation.mutateAsync({
          funcionario_id: funcionarioId,
          data: dateStr,
          tipo: escalaType,
          turno: 'integral'
        })
      }
      
      // Sincronizar sistema de escala e frequências
      queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      
      toast('Frequência e escala atualizadas', 'success')
      clearSearch()
    } catch (err: any) {
      toast('Erro ao registrar: ' + err.message, 'error')
    }
  }

  const handleConfirmAll = async (members: any[]) => {
    const pendentes = members.filter(m => !m.tipoReal)
    if (pendentes.length === 0) return toast('Todos já foram confirmados', 'info')
    
    if (!confirm(`Confirmar presença de ${pendentes.length} funcionários pendentes?`)) return

    try {
      const updates = pendentes.map(m => ({
        funcionario_id: m.id,
        data: dateStr,
        status: 'presente' as const
      }))
      await batchFreqMutation.mutateAsync(updates)
      
      // Sincronizar escalas em lote - preservar tipos não-trabalho existentes (férias, atestado, folga, etc)
      const nonWorkTypes = ['ferias', 'atestado', 'repouso', 'compensar']
      const escalaInserts = pendentes
        .filter(member => {
          const currentEscala = escalas.find(e => e.funcionario_id === member.id && e.data.substring(0, 10) === dateStr)
          // Não sobrescrever se já tem tipo não-trabalho definido
          return !currentEscala || !nonWorkTypes.includes(currentEscala.tipo)
        })
        .map(member => {
          const currentEscala = escalas.find(e => e.funcionario_id === member.id && e.data.substring(0, 10) === dateStr)
          return {
            funcionario_id: member.id,
            data: dateStr,
            tipo: 'presente',
            localidade: currentEscala?.localidade || null,
            turno: 'integral' as const
          }
        })
      if (escalaInserts.length > 0) {
        await batchEscalaMutation.mutateAsync(escalaInserts)
      }
      
      // Sincronizar sistema de escala e frequências
      queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      toast(`${pendentes.length} presenças confirmadas e escalas sincronizadas!`, 'success')
      clearSearch()
    } catch (err: any) {
      toast('Erro ao confirmar em lote: ' + err.message, 'error')
    }
  }

  const handleBulkStatus = async (status: 'presente' | 'hora_extra' | 'falta' | 'folga' | 'ferias' | 'atestado' | 'remover') => {
    const selectedIds = Object.entries(selectedMembers)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id)
      
    if (selectedIds.length === 0) return
    
    try {
      if (status === 'remover') {
        // Remover frequência em lote
        const deleteFreqPromises = selectedIds.map(id =>
          supabase.from('frequencia').delete().eq('funcionario_id', id).eq('data', dateStr)
        )
        await Promise.all(deleteFreqPromises)
        
        // Sincronizar escalas: resetar para o padrão do dia mantendo localidade
        const isDiaDomingo = isSunday(currentDate)
        const feriado = getFeriado(currentDate)
        const defaultTipo = (isDiaDomingo || feriado) ? 'repouso' : 'presente'
        
        const escalaInserts = selectedIds.map(id => {
          const currentEscala = escalas.find(e => e.funcionario_id === id && e.data.substring(0, 10) === dateStr)
          return {
            funcionario_id: id,
            data: dateStr,
            tipo: defaultTipo,
            localidade: currentEscala?.localidade || null,
            turno: 'integral' as const
          }
        })
        await batchEscalaMutation.mutateAsync(escalaInserts)
        
        toast(`${selectedIds.length} frequências resetadas e escalas sincronizadas!`, 'success')
      } else {
        // Upsert frequências em lote
        const freqUpserts = selectedIds.map(id => ({
          funcionario_id: id,
          data: dateStr,
          status: status,
          updated_at: new Date().toISOString()
        }))
        await supabase.from('frequencia').upsert(freqUpserts, { onConflict: 'funcionario_id,data' })
        
        // Sincronizar escalas em lote
        const escalaMap: Record<string, string> = {
          'presente': 'presente',
          'hora_extra': 'hora_extra',
          'falta': 'falta',
          'folga': 'compensar',
          'ferias': 'ferias',
          'atestado': 'atestado'
        }
        const escalaType = escalaMap[status] || 'presente'
        
        const escalaInserts = selectedIds.map(id => {
          const currentEscala = escalas.find(e => e.funcionario_id === id && e.data.substring(0, 10) === dateStr)
          return {
            funcionario_id: id,
            data: dateStr,
            tipo: escalaType,
            localidade: currentEscala?.localidade || null,
            turno: 'integral' as const
          }
        })
        await batchEscalaMutation.mutateAsync(escalaInserts)
        
        toast(`${selectedIds.length} frequências e escalas atualizadas em lote!`, 'success')
      }
      
      // Limpar seleção e invalidar cache
      setSelectedMembers({})
      queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      clearSearch()
    } catch (err: any) {
      toast('Erro ao atualizar em lote: ' + err.message, 'error')
    }
  }

  const prevDay = () => setCurrentDate(subDays(currentDate, 1))
  const nextDay = () => setCurrentDate(addDays(currentDate, 1))

  if (loadF || loadE || loadFreq || loadTeam) return <div className="min-h-screen bg-background"><TopHeader title="Chamada" /><div className="pt-28 sm:pt-32 pb-20"><Loading text="Sincronizando com a escala..." /></div></div>

  const { workingGroups, notWorkingGroups } = processedData
  const allWorkingMembers = Object.values(workingGroups).flatMap(g => g.members)
  
  const pendingCount = allWorkingMembers.filter(m => !m.tipoReal && !isBorrowed(m.id)).length
  const presentCount = allWorkingMembers.filter(m => (m.tipoReal === 'presente' || m.tipoReal === 'hora_extra') && !isBorrowed(m.id)).length
  const absentCount = allWorkingMembers.filter(m => m.tipoReal === 'falta' && !isBorrowed(m.id)).length
  const totalPlanejadoCount = allWorkingMembers.filter(m => !isBorrowed(m.id)).length
  
  const filteredSearch = (m: any) => {
    const matchesSearch = !searchTerm.trim() || 
      matchesFuzzy(m.nome, searchTerm) || 
      (m.apelido && matchesFuzzy(m.apelido, searchTerm))
    
    if (!matchesSearch) return false
    
    if (statusFilter === 'pendentes') return !m.tipoReal && !isBorrowed(m.id)
    if (statusFilter === 'presentes') return (m.tipoReal === 'presente' || m.tipoReal === 'hora_extra') && !isBorrowed(m.id)
    if (statusFilter === 'faltas') return m.tipoReal === 'falta' && !isBorrowed(m.id)
    
    return true
  }

  return (
    <div className="min-h-screen bg-background pb-40 cyber-grid">
      <TopHeader 
        title="Controle de Efetivo" 
        subtitle={format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} 
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32 relative">
        {/* Headers Wrapper (Scrolls with content) */}
        <div className="space-y-4 mb-10">
          {/* Card de Filtros e Configurações */}
          <div className="relative bg-card/85 dark:bg-card/45 border border-border/40 rounded-[2.5rem] p-4 shadow-xl cyber-glow-primary">
            {/* Scanline background effect */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none cyber-scanline" style={{ position: 'absolute' }} />

            <div className="relative z-10 flex flex-col xl:flex-row gap-6 items-center justify-between">
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30 w-full md:w-auto">
                <button onClick={prevDay} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
                <div className="flex-1 md:min-w-[160px] text-center">
                  <p className="text-[9px] font-black uppercase text-primary tracking-widest">{isToday(currentDate) ? 'Hoje' : format(currentDate, 'EEE', { locale: ptBR })}</p>
                  <p className="text-sm font-black text-foreground">{format(currentDate, 'dd/MM/yyyy')}</p>
                </div>
                <button onClick={nextDay} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronRight className="w-5 h-5" /></button>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:w-auto">
                {/* Search Input wrapper to keep height and handle float on scroll */}
                <div className="relative w-full md:w-80 h-12 sm:h-14 z-[99]">
                  <div className={cn(
                    "transition-all duration-300",
                    isScrolled 
                      ? "fixed top-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md md:w-80 z-[9999] scale-105"
                      : "relative w-full"
                  )}>
                    <div className={cn(
                       "flex items-center gap-2 px-4 h-12 sm:h-14 transition-all duration-300",
                       isScrolled
                         ? "bg-card/95 dark:bg-card/90 border border-primary/45 rounded-[1.5rem] backdrop-blur-xl ring-4 ring-primary/5 shadow-2xl"
                         : "bg-muted/50 border border-border/30 rounded-[1.25rem] focus-within:ring-4 focus-within:ring-primary/10"
                    )}>
                      <Search className="w-4 h-4 text-primary shrink-0" />
                      <input
                        type="text"
                        placeholder="Pesquisar funcionário..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:ring-0 p-0"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Suggestions Panel */}
                    {searchTerm && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-card dark:bg-card/95 border border-border rounded-2xl shadow-xl overflow-hidden z-[9999] flex flex-col divide-y divide-border/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 bg-muted/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                          <span>Sugestões</span>
                          <span className="text-primary">{suggestions.length} encontrados</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto scrollbar-thin">
                          {suggestions.map(f => {
                            const { isTrabalhando, tipo, tipoReal, localidade } = getEmployeeStatus(f.id)
                            let statusLabel = 'Pendente'
                            let statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                            
                            if (!isTrabalhando) {
                              statusLabel = tipo === 'repouso' || tipo === 'compensar' ? 'Folga' : tipo.toUpperCase()
                              statusColor = 'text-slate-400 bg-muted/50 border-border/40'
                            } else if (tipoReal === 'presente' || tipoReal === 'hora_extra') {
                              statusLabel = localidade ? `Presença (${localidade})` : 'Presença'
                              statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                            } else if (tipoReal === 'falta') {
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
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 active:bg-muted/80 transition-all text-left border-none bg-transparent cursor-pointer"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <span className="text-xs font-black text-foreground uppercase truncate block">
                                    {f.apelido || f.nome}
                                  </span>
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

                {!teamInfo?.isRestricted && (
                  <select
                    value={selectedTeamId || ''} 
                    onChange={e => setSelectedTeamId(e.target.value || null)}
                    className="w-full md:w-60 bg-muted/50 border border-border/30 rounded-[1.25rem] px-4 h-12 sm:h-14 text-xs outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-foreground uppercase tracking-wider shrink-0"
                  >
                    <option value="">Todas as Equipes</option>
                    {allTeams.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                )}

              <div className="flex items-center gap-2 w-full md:w-auto">
                 <div className="hidden lg:flex items-center gap-1.5 bg-background/50 p-1.5 rounded-full border border-border/30">
                  <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full", pendingCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", pendingCount > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {pendingCount > 0 ? `${pendingCount} PENDENTES` : 'CONCLUÍDO'}
                    </span>
                  </div>
                </div>
                {canAdmin && (
                  <Button 
                    onClick={async () => {
                      if (!confirm('Deseja limpar todos os registros de presença de hoje e voltar ao estado inicial pendente?')) return
                      try {
                        // Remover apenas frequências de trabalho do dia ('presente', 'hora_extra', 'falta')
                        await supabase
                          .from('frequencia')
                          .delete()
                          .eq('data', dateStr)
                          .in('status', ['presente', 'hora_extra', 'falta'])
                        
                        // Sincronizar escalas: resetar apenas as que não são férias/folga/atestado
                        const nonResetTypes = ['ferias', 'atestado', 'repouso', 'compensar']
                        const escalasDodia = escalas.filter(e => 
                          e.data.substring(0, 10) === dateStr &&
                          !nonResetTypes.includes(e.tipo)
                        )
                        for (const escala of escalasDodia) {
                          await updateEscalaMutation.mutateAsync({
                            id: escala.id,
                            data: {
                              tipo: 'presente',
                              localidade: escala.localidade
                            },
                            skipFreqSync: true
                          })
                        }
                        
                        toast('Chamada e escalas resetadas com sucesso', 'success')
                        clearSearch()
                        queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
                        queryClient.invalidateQueries({ queryKey: ['escalas'] })
                        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                      } catch (err: any) {
                        toast('Erro ao resetar: ' + err.message, 'error')
                      }
                    }}
                    className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center p-0"
                    title="Resetar Chamada"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
                {canEdit && (
                  <Button 
                    onClick={() => handleConfirmAll(allWorkingMembers)}
                    disabled={pendingCount === 0}
                    className="flex-1 md:flex-none rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest h-12 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
                  >
                    <Zap className="w-4 h-4" /> Confirmar Todos
                  </Button>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* Custom style injection for micro-interactions and animations */}
          <style>{`
            @keyframes highlightPulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.7); border-color: rgba(20, 184, 166, 0.7); }
              50% { transform: scale(1.02); box-shadow: 0 0 20px 10px rgba(20, 184, 166, 0.3); border-color: rgba(20, 184, 166, 1); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(20, 184, 166, 0); border-color: rgba(20, 184, 166, 0.2); }
            }
            .highlight-glow {
              animation: highlightPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              z-index: 10;
            }
          `}</style>

          {/* Premium Dashboard Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card/90 dark:bg-card/50 border border-border/40 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-primary group-hover:scale-110 transition-transform duration-500">
                <Users className="w-24 h-24" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Planejado</p>
              <p className="text-3xl font-black text-foreground mt-2">{totalPlanejadoCount}</p>
              <p className="text-[9px] text-muted-foreground mt-1">Colaboradores ativos na escala</p>
            </div>

            <div className="bg-card/90 dark:bg-card/50 border border-border/40 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Presenças Confirmadas</p>
              <p className="text-3xl font-black text-emerald-600 mt-2">{presentCount}</p>
              <div className="w-full h-1 bg-border/20 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${totalPlanejadoCount > 0 ? (presentCount / totalPlanejadoCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-card/90 dark:bg-card/50 border border-border/40 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-500 group-hover:scale-110 transition-transform duration-500">
                <XCircle className="w-24 h-24" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Faltas Registradas</p>
              <p className="text-3xl font-black text-rose-600 mt-2">{absentCount}</p>
              <div className="w-full h-1 bg-border/20 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full bg-rose-500 transition-all duration-500" 
                  style={{ width: `${totalPlanejadoCount > 0 ? (absentCount / totalPlanejadoCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-card/90 dark:bg-card/50 border border-border/40 rounded-3xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-amber-500 group-hover:scale-110 transition-transform duration-500">
                <Clock className="w-24 h-24 animate-pulse" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Chamadas Pendentes</p>
              <p className="text-3xl font-black text-amber-600 mt-2">{pendingCount}</p>
              <div className="w-full h-1 bg-border/20 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${totalPlanejadoCount > 0 ? (pendingCount / totalPlanejadoCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status Filter Tab Pills */}
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2 mb-8">
            <button
              onClick={() => setStatusFilter('todos')}
              className={cn(
                "px-2 sm:px-4 py-2 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer select-none text-center flex items-center justify-center gap-1 w-full sm:w-auto",
                statusFilter === 'todos'
                  ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                  : "bg-card/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-card"
              )}
            >
              Todos ({allWorkingMembers.length})
            </button>
            <button
              onClick={() => setStatusFilter('pendentes')}
              className={cn(
                "px-1 sm:px-4 py-2 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer select-none flex items-center justify-center gap-1 w-full sm:w-auto",
                statusFilter === 'pendentes'
                  ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "bg-card/60 border-border/40 text-amber-500 hover:bg-amber-500/10"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0", statusFilter === 'pendentes' ? "bg-white" : "animate-pulse")} />
              <span className="hidden sm:inline">Pendentes</span>
              <span className="sm:hidden">Pend.</span> ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('presentes')}
              className={cn(
                "px-1 sm:px-4 py-2 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer select-none flex items-center justify-center gap-1 w-full sm:w-auto",
                statusFilter === 'presentes'
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "bg-card/60 border-border/40 text-emerald-500 hover:bg-emerald-500/10"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0", statusFilter === 'presentes' ? "bg-white" : "")} />
              <span className="hidden sm:inline">Confirmados</span>
              <span className="sm:hidden">Conf.</span> ({presentCount})
            </button>
            <button
              onClick={() => setStatusFilter('faltas')}
              className={cn(
                "px-2 sm:px-4 py-2 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 border cursor-pointer select-none flex items-center justify-center gap-1 w-full sm:w-auto",
                statusFilter === 'faltas'
                  ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "bg-card/60 border-border/40 text-rose-500 hover:bg-rose-500/10"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0", statusFilter === 'faltas' ? "bg-white" : "")} />
              <span className="hidden sm:inline">Faltas</span>
              <span className="sm:hidden">Faltas</span> ({absentCount})
            </button>
          </div>
        </div>

        {/* Tactical Grid */}
        <div className="space-y-12">
          {Object.values(workingGroups)
            .filter(g => g.members.some(filteredSearch))
            .sort((a, b) => {
              if (a.id === 'sem_local') return 1
              if (b.id === 'sem_local') return -1
              
              const locA = dbLocalidades.find(l => l.nome === a.nome)
              const locB = dbLocalidades.find(l => l.nome === b.nome)
              
              const teamA = locA ? allTeams.find(t => t.id === locA.equipe_id) : null
              const teamB = locB ? allTeams.find(t => t.id === locB.equipe_id) : null
              
              const nameA = teamA ? teamA.nome : 'ZZZZZ'
              const nameB = teamB ? teamB.nome : 'ZZZZZ'
              
              const teamCompare = nameA.localeCompare(nameB)
              if (teamCompare !== 0) return teamCompare
              
              return a.nome.localeCompare(b.nome)
            })
            .map(group => {
              const totalGroupM = group.members.filter(filteredSearch).length
              const confirmedGroupM = group.members.filter(m => m.tipoReal && filteredSearch(m)).length
              const pctChecked = totalGroupM > 0 ? Math.round((confirmedGroupM / totalGroupM) * 100) : 0
              const groupPendentes = group.members.filter(m => !m.tipoReal).length

              return (
                <div key={group.id} className="animate-fade-in bg-card/30 dark:bg-card/10 border border-border/20 rounded-[2.5rem] p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 px-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]",
                          groupPendentes > 0 ? "bg-amber-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                        )} />
                        <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">{group.nome}</h3>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-4">{group.setor}</p>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4">
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-xl font-black text-foreground leading-none">
                          {confirmedGroupM} / {totalGroupM}
                        </span>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Confirmados ({pctChecked}%)</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            const groupMemberIds = group.members.filter(filteredSearch).map(m => m.id)
                            const allSelected = groupMemberIds.every(id => !!selectedMembers[id])
                            setSelectedMembers(prev => {
                              const next = { ...prev }
                              groupMemberIds.forEach(id => {
                                if (allSelected) {
                                  delete next[id]
                                } else {
                                  next[id] = true
                                }
                              })
                              return next
                            })
                          }}
                          className="text-[8px] font-black text-primary hover:text-white transition-colors cursor-pointer uppercase tracking-wider bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/15 hover:bg-primary"
                        >
                          {group.members.filter(filteredSearch).every(m => !!selectedMembers[m.id])
                            ? 'Deselecionar'
                            : 'Selecionar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group progress bar */}
                  <div className="w-full h-1 bg-border/20 rounded-full overflow-hidden mb-6">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        pctChecked === 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary"
                      )}
                      style={{ width: `${pctChecked}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.members
                      .filter(filteredSearch)
                      .map(member => (
                        <div 
                          key={member.id} 
                          id={`func-card-${member.id}`}
                          className={cn(
                            "relative bg-card/90 dark:bg-card/45 backdrop-blur-xl border rounded-[2rem] p-4 transition-all duration-300 group overflow-hidden shadow-sm hover:-translate-y-0.5",
                            highlightedEmployeeId === member.id && "highlight-glow",
                            member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' 
                              ? "border-emerald-500/30 dark:border-emerald-500/15 bg-emerald-500/[0.01] hover:border-emerald-500/40 shadow-emerald-500/[0.02]" 
                              : member.tipoReal === 'falta' 
                                ? "border-rose-500/30 dark:border-rose-500/15 bg-rose-500/[0.01] hover:border-rose-500/40 shadow-rose-500/[0.02]" 
                                : "border-amber-500/30 dark:border-amber-500/15 bg-amber-500/[0.01] hover:border-amber-500/45 shadow-amber-500/[0.02]"
                          )}>
                          {/* Status Accent Bar */}
                          <div className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-r-full transition-all duration-500",
                            member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                            member.tipoReal === 'falta' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"
                          )} />
 
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                onClick={() => {
                                  if (canEdit && !isBorrowed(member.id)) {
                                    setSelectedMembers(prev => ({
                                      ...prev,
                                      [member.id]: !prev[member.id]
                                    }))
                                  }
                                }}
                                className="flex items-center gap-2 select-none cursor-pointer group/select shrink-0"
                              >
                                {canEdit && !isBorrowed(member.id) && (
                                  <button
                                    type="button"
                                    className={cn(
                                      "w-6 h-6 sm:w-5 sm:h-5 rounded-lg border flex items-center justify-center transition-all shrink-0 mr-1",
                                      selectedMembers[member.id]
                                        ? "bg-primary border-primary text-white shadow-sm shadow-primary/25"
                                        : "border-border hover:border-primary/50 bg-background/50 group-hover/select:border-primary/50"
                                    )}
                                    title="Selecionar funcionário"
                                  >
                                    {selectedMembers[member.id] && <Check className="w-4 h-4 sm:w-3 sm:h-3 stroke-[3]" />}
                                  </button>
                                )}
                                <div className={cn(
                                  "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shadow-inner shrink-0 transition-transform group-hover/select:scale-105 duration-500",
                                  member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 border border-emerald-500/20" : 
                                  member.tipoReal === 'falta' ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 border border-rose-500/20" : 
                                  member.tipoReal === 'folga' ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 border border-blue-500/20" :
                                  member.tipoReal === 'ferias' ? "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 border border-purple-500/20" :
                                  member.tipoReal === 'atestado' ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 border border-red-500/20" :
                                  "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 border border-amber-500/20"
                                )}>
                                  {(member.apelido || member.nome).substring(0, 1).toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-black text-foreground truncate leading-tight tracking-tight uppercase">{member.apelido || member.nome}</p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  <Badge variant="default" className="text-[7px] sm:text-[8px] font-black uppercase px-1.5 py-0.5 bg-muted/40 text-muted-foreground/60 border-transparent shrink-0">
                                    {member.cargo}
                                  </Badge>
                                  {employeeTeamMap[member.id]?.map(t => (
                                    <span key={t.id} className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest leading-none shrink-0">
                                      {t.nome}
                                    </span>
                                  ))}
                                  {borrowedMembers.some((bm: any) => bm.funcionario_id === member.id) && (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                      ⇄ Emprestado
                                    </Badge>
                                  )}
                                  {(!employeeTeamMap[member.id] || employeeTeamMap[member.id].length === 0) && (
                                    <span className="text-[7px] font-black bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest leading-none shrink-0">
                                      Sem Equipe
                                    </span>
                                  )}
                                  {member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent shrink-0">
                                      Presente
                                    </Badge>
                                  ) : member.tipoReal === 'falta' ? (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-transparent shrink-0">
                                      Falta
                                    </Badge>
                                  ) : member.tipoReal === 'folga' ? (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent shrink-0">
                                      Folga
                                    </Badge>
                                  ) : member.tipoReal === 'ferias' ? (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent shrink-0">
                                      Férias
                                    </Badge>
                                  ) : member.tipoReal === 'atestado' ? (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-red-500/15 text-red-600 dark:text-red-400 border-transparent shrink-0">
                                      Atestado
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent shrink-0 animate-pulse">
                                      Pendente
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
  
                            {canEdit ? (
                              <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/10 shrink-0">
                                {isBorrowed(member.id) ? (
                                  <>
                                    <span className="text-[8px] font-black uppercase text-muted-foreground mr-1.5 tracking-wider bg-muted/40 px-2.5 py-1.5 rounded-xl border border-border/30">
                                      Controle na Origem
                                    </span>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        if (confirm(`Devolver o colaborador ${member.apelido || member.nome} para a equipe de origem? Ele sairá da sua lista de hoje.`)) {
                                          try {
                                            await supabase
                                              .from('equipe_membros_emprestados')
                                              .delete()
                                              .eq('funcionario_id', member.id)
                                              .eq('data', dateStr)
                                            
                                            // Also delete their escala entry for today if they were allocated to a localidade of this supervisor
                                            const currentEscala = escalas.find(esc => esc.funcionario_id === member.id && esc.data.substring(0, 10) === dateStr)
                                            if (currentEscala) {
                                              await supabase.from('escalas').delete().eq('id', currentEscala.id)
                                            }
                                            
                                            // And delete frequency record
                                            await supabase.from('frequencia').delete().eq('funcionario_id', member.id).eq('data', dateStr)

                                            queryClient.invalidateQueries({ queryKey: ['membros-emprestados', dateStr] })
                                            queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
                                            queryClient.invalidateQueries({ queryKey: ['escalas'] })
                                            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                                            toast('Colaborador devolvido com sucesso', 'success')
                                          } catch (err: any) {
                                            toast('Erro ao devolver colaborador: ' + err.message, 'error')
                                          }
                                        }
                                      }}
                                      className="h-10 w-10 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shrink-0"
                                      title="Devolver colaborador emprestado"
                                    >
                                      <UserMinus className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {member.tipoReal && (
                                      <button 
                                        onClick={async () => {
                                          try {
                                            // Remover frequência
                                            await supabase.from('frequencia').delete().eq('funcionario_id', member.id).eq('data', dateStr)
                                            
                                            // Sincronizar com a escala - resetar para padrão (repouso se domingo/feriado, presente se dia de semana) mantendo localidade
                                            const isDiaDomingo = isSunday(currentDate)
                                            const feriado = getFeriado(currentDate)
                                            const defaultTipo = (isDiaDomingo || feriado) ? 'repouso' : 'presente'
                                            
                                            const currentEscala = escalas.find(e => e.funcionario_id === member.id && e.data.substring(0, 10) === dateStr)
                                            if (currentEscala) {
                                              await updateEscalaMutation.mutateAsync({
                                                id: currentEscala.id, skipFreqSync: true,
                                                data: {
                                                  tipo: defaultTipo,
                                                  localidade: currentEscala.localidade
                                                }
                                              })
                                            } else {
                                              // Se não houver escala, criar uma padrão
                                              await upsertEscalaMutation.mutateAsync({ item: {
                                                funcionario_id: member.id,
                                                data: dateStr,
                                                tipo: defaultTipo,
                                                turno: 'integral'
                                              }, skipFreqSync: true })
                                            }
                                            
                                            toast('Frequência resetada e escala sincronizada', 'success')
                                            clearSearch()
                                            queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
                                            queryClient.invalidateQueries({ queryKey: ['escalas'] })
                                            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                                          } catch (err: any) {
                                            toast('Erro ao remover: ' + err.message, 'error')
                                          }
                                        }}
                                        className="h-10 px-3 sm:px-0 sm:w-10 rounded-xl flex items-center justify-center bg-muted/40 border border-border/30 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20 transition-all cursor-pointer flex-1 sm:flex-initial gap-1.5 sm:gap-0"
                                        title="Remover Confirmação"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        <span className="sm:hidden text-[9px] font-black uppercase tracking-wider">Reset</span>
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => handleStatus(member.id, 'falta')}
                                      className={cn(
                                        "h-10 px-3 sm:w-20 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border cursor-pointer font-black text-[9px] sm:text-[10px] uppercase tracking-widest flex-1 sm:flex-initial",
                                        member.tipoReal === 'falta' 
                                          ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20" 
                                          : "bg-muted/40 border-transparent text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
                                      )}
                                    >
                                      <X className="w-4 h-4" />
                                      <span>Falta</span>
                                    </button>
                                    <button 
                                      onClick={() => handleStatus(member.id, 'presente')}
                                      className={cn(
                                        "h-10 px-3 sm:w-24 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border cursor-pointer font-black text-[9px] sm:text-[10px] uppercase tracking-widest flex-1 sm:flex-initial",
                                        member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' 
                                          ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                          : "bg-muted/40 border-transparent text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20"
                                      )}
                                    >
                                      <Check className="w-4 h-4 stroke-[3]" />
                                      <span>Presença</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="shrink-0 flex sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/10">
                                {isBorrowed(member.id) ? (
                                  <span className="inline-block px-3 py-1.5 rounded-full text-[8px] font-black bg-muted/40 text-muted-foreground border border-border/30 uppercase tracking-wider">
                                    Controle na Origem
                                  </span>
                                ) : member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? (
                                  <span className="inline-block px-3 py-1.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">Presente</span>
                                ) : member.tipoReal === 'falta' ? (
                                  <span className="inline-block px-3 py-1.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">Falta</span>
                                ) : (
                                  <span className="inline-block px-3 py-1.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">Pendente</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}

          {/* Exception Section */}
          {Object.values(notWorkingGroups).some(g => g.members.length > 0) && (
            <div className="pt-20 border-t border-border/30">
              <div className="flex items-center gap-3 mb-10 px-4">
                <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">Planejamento e Ausências</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {Object.entries(notWorkingGroups).map(([id, group]) => (
                  group.members.length > 0 && (
                    <div key={id} className="space-y-6">
                      <div className="flex items-center gap-3 px-2">
                        <div className={cn("p-2 rounded-xl bg-background border border-border/50 shadow-sm", group.color)}>
                          {group.icon}
                        </div>
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.label}</h4>
                        <span className="text-xs font-black text-foreground ml-auto">{group.members.length}</span>
                      </div>
                      
                      <div className="space-y-3">
                        {group.members.filter(filteredSearch).map(member => (
                          <div 
                            key={member.id} 
                            id={`func-ausente-${member.id}`}
                            className={cn(
                              "bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-4 flex items-center gap-4 group hover:border-border/60 transition-all shadow-sm opacity-75",
                              highlightedEmployeeId === member.id && "highlight-glow"
                            )}
                          >
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border/50 shadow-inner">
                              {(member.apelido || member.nome).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-foreground truncate uppercase">{member.apelido || member.nome}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className={cn("text-[9px] font-black uppercase tracking-tighter", group.color)}>
                                  {escalaTipoLabel[member.resolvedStatus as EscalaTipo] || member.resolvedStatus}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <span className={cn(
                                "inline-block px-3 py-1.5 rounded-full text-[9px] font-black border uppercase tracking-wider",
                                id === 'folga' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                id === 'ferias' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                                id === 'atestado' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                "bg-slate-500/10 text-slate-500 border-slate-500/20"
                              )}>
                                {group.label}
                              </span>
                            </div>
                          </div>

                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Floating Action Bar for Bulk Attendance Selection */}
      {Object.values(selectedMembers).filter(Boolean).length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-background/95 dark:bg-card/95 backdrop-blur-xl border border-border/40 rounded-[2rem] p-3 sm:p-5 flex flex-col md:flex-row items-center gap-3 sm:gap-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-350 max-w-[95%] w-[800px] cyber-glow-primary">
          {/* Header Row (Mobile: horizontal flex with cancel button, Desktop: normal block) */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs sm:text-sm">
                {Object.values(selectedMembers).filter(Boolean).length}
              </div>
              <div>
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-none">Selecionados</p>
                <p className="text-xs font-black text-foreground mt-0.5 md:block hidden">Chamada em Lote</p>
                <p className="text-xs font-black text-foreground mt-0.5 md:hidden">Em Lote</p>
              </div>
            </div>

            {/* Mobile Cancel Button */}
            <button
              type="button"
              onClick={() => setSelectedMembers({})}
              className="md:hidden flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-muted/40 hover:bg-muted/60 px-3 py-1.5 rounded-full"
            >
              Cancelar
            </button>
          </div>

          <div className="h-px w-full md:h-8 md:w-px bg-border/20 md:block hidden" />

          {/* Action Buttons: Responsive grid layout on mobile to prevent scrolling, flex on desktop */}
          <div className="grid grid-cols-3 md:flex md:flex-row md:flex-wrap md:justify-center gap-1.5 sm:gap-2 flex-1 w-full mt-2 md:mt-0">
            <button
              type="button"
              onClick={() => handleBulkStatus('presente')}
              className="w-full md:w-auto px-2 py-2.5 md:px-3.5 md:py-2 rounded-xl bg-emerald-500 text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" /> Presença
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('falta')}
              className="w-full md:w-auto px-2 py-2.5 md:px-3.5 md:py-2 rounded-xl bg-rose-500 text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-rose-600 active:scale-95 transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shadow-sm"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" /> Falta
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('remover')}
              className="w-full md:w-auto px-2 py-2.5 md:px-3.5 md:py-2 rounded-xl bg-muted border border-border/30 text-muted-foreground font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-muted/80 hover:text-foreground active:scale-95 transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
              title="Limpar Frequência dos Selecionados"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Resetar
            </button>
          </div>

          <div className="h-px w-full md:h-8 md:w-px bg-border/20 md:block hidden" />

          {/* Desktop Cancel Button */}
          <button
            type="button"
            onClick={() => setSelectedMembers({})}
            className="md:block hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

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
                <h4 className="text-sm font-black text-foreground uppercase tracking-wide">
                  {borrowModal.funcionario.apelido || borrowModal.funcionario.nome}
                </h4>
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
                    {format(parseLocalDate(dateStr), "dd/MM/yyyy")}
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
    </div>
  )
}
