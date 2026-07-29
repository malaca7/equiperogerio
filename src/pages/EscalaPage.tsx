import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { format, parseISO, startOfWeek, addDays, subWeeks, addWeeks, isSunday, isToday, getWeek, endOfMonth, startOfMonth, subMonths, addMonths, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  ChevronLeft, ChevronRight, Printer, Zap, CalendarDays, Layers, 
  Search, Filter, X, Check, Grid, Sparkles, CheckSquare, Square, 
  Trash2, FileSpreadsheet, ArrowLeftRight, HelpCircle, Edit3, ClipboardList, Share2,
  Copy, Download, MessageCircle, ZoomIn, ZoomOut, RotateCw, RotateCcw,
  AlertTriangle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios, useSetores } from '../hooks/useFuncionarios'
import { useEscalasMensal, useBatchUpsertEscalas, useUpdateEscala, useDeleteEscala } from '../hooks/useEscalas'
import { useFrequenciaMensal } from '../hooks/useFrequencia'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { useUserTeam } from '../hooks/useUserTeam'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './admin/AdminDashboard'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

import { useQuery, useQueryClient } from '@tanstack/react-query'

type ViewMode = 'week' | 'month'

interface SelectedCell {
  funcId: string
  dateStr: string
  funcNome: string
  dateLabel: string
  currentTipo: string | null
  rect: DOMRect | null
}

export function EscalaPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const { data: teamInfo } = useUserTeam()
  const { isSidebarCollapsed } = useTheme()
  const canEdit = hasPermission('escala', 'gerenciar')

  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')

  // Excel Bulk Selection Mode
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Record<string, { funcId: string; dateStr: string }>>({})

  // Share Modal States
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareImageUrl, setShareImageUrl] = useState<string>('')
  const [shareImageBlob, setShareImageBlob] = useState<Blob | null>(null)
  const [shareFileName, setShareFileName] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [rotationAngle, setRotationAngle] = useState(0)

  // Share Filter Modal States
  const [shareFilterModalOpen, setShareFilterModalOpen] = useState(false)
  const [selectedShareTeams, setSelectedShareTeams] = useState<string[]>([])
  const [selectedShareFuncs, setSelectedShareFuncs] = useState<string[]>([])
  const [shareFilterSearchTerm, setShareFilterSearchTerm] = useState('')

  const [scaleFactor, setScaleFactor] = useState(1)
  const [isHeaderStuck, setIsHeaderStuck] = useState(false)



  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width >= 1024) {
        // Desktop/web mode: calculate available width for the grid
        const sidebarWidth = isSidebarCollapsed ? 80 : 256
        const availableWidth = width - sidebarWidth - 10
        
        // Base name column width: 200px
        // Base day column width: 42px
        // Total base width needed to fit without scroll = 200 + (31 * 42) = 1502px
        const totalBaseWidthNeeded = 1520
        if (availableWidth < totalBaseWidthNeeded) {
          const factor = Math.min(1.0, Math.max(0.48, availableWidth / totalBaseWidthNeeded))
          setScaleFactor(factor)
        } else {
          setScaleFactor(1.0)
        }
      } else {
        setScaleFactor(1.0)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isSidebarCollapsed, viewMode])

  const scaleStyles = useMemo(() => {
    return {
      '--grid-scale': scaleFactor,
      '--grid-font-title': `${Math.max(7, Math.floor(9 * scaleFactor))}px`,
      '--grid-font-cell': `${Math.max(7, Math.floor(10 * scaleFactor))}px`,
      '--grid-font-day': `${Math.max(8, Math.floor(14 * scaleFactor))}px`,
      '--grid-font-badge': `${Math.max(6, Math.floor(9 * scaleFactor))}px`,
      '--grid-font-sub': `${Math.max(6, Math.floor(9 * scaleFactor))}px`,
      '--grid-padding-x': `${Math.max(1, Math.floor(3 * scaleFactor))}px`,
      '--grid-padding-y': `${Math.max(2, Math.floor(8 * scaleFactor))}px`,
      '--grid-padding-x-large': `${Math.max(2, Math.floor(12 * scaleFactor))}px`,
      '--grid-cell-width': viewMode === 'month' 
        ? `${Math.max(16, Math.floor(42 * scaleFactor))}px` 
        : `${Math.max(40, Math.floor(80 * scaleFactor))}px`,
      '--grid-name-width': `${Math.max(90, Math.floor(200 * scaleFactor))}px`,
      '--grid-badge-padding-x': `${Math.max(1, Math.floor(6 * scaleFactor))}px`,
      '--grid-badge-padding-y': `${Math.max(0.5, 2 * scaleFactor)}px`,
      '--grid-badge-height': `${Math.max(14, Math.floor(24 * scaleFactor))}px`,
      '--grid-avatar-size': `${Math.max(16, Math.floor(32 * scaleFactor))}px`,
      '--grid-sub-display': scaleFactor < 0.75 ? 'none' : 'block',
    } as React.CSSProperties
  }, [scaleFactor, viewMode])

  const floatingHeaderRef = useRef<HTMLDivElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft
    if (floatingHeaderRef.current && floatingHeaderRef.current.scrollLeft !== scrollLeft) {
      floatingHeaderRef.current.scrollLeft = scrollLeft
    }
  }

  const handleFloatingScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft
    if (tableContainerRef.current && tableContainerRef.current.scrollLeft !== scrollLeft) {
      tableContainerRef.current.scrollLeft = scrollLeft
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (tableContainerRef.current) {
        const rect = tableContainerRef.current.getBoundingClientRect()
        // The fixed TopHeader height is 64px (h-16).
        // The table header starts sticking as soon as the table container's top reaches 64px from viewport top.
        setIsHeaderStuck(rect.top <= 64)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    // Check initial state
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Instantly synchronize horizontal scroll position on mounting of Floating Active Dock Bar
  useEffect(() => {
    if (isHeaderStuck) {
      const timeout = setTimeout(() => {
        if (floatingHeaderRef.current && tableContainerRef.current) {
          floatingHeaderRef.current.scrollLeft = tableContainerRef.current.scrollLeft
        }
      }, 30)
      return () => clearTimeout(timeout)
    }
  }, [isHeaderStuck])

  // Interactive Quick Selector Popover
  const [activeCell, setActiveCell] = useState<SelectedCell | null>(null)
  const [cellObservation, setCellObservation] = useState('')
  
  // Modals
  const [bulkStatusModal, setBulkStatusModal] = useState(false)
  interface SpecialDayConfirmState {
    title: string
    description: string
    dateLabel: string
    onConfirmHE: () => void
    onConfirmTrabalho: () => void
    onCancel: () => void
  }
  const [specialDayConfirm, setSpecialDayConfirm] = useState<SpecialDayConfirmState | null>(null)
  const [isSharing, setIsSharing] = useState(false)



  // Fetch Core Data
  const monthStr = format(currentDate, 'yyyy-MM')
  const { data: escalas = [], isLoading: loadE, refetch: refetchEscalas } = useEscalasMensal(monthStr)
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: setoresData = [] } = useSetores()
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
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: frequencias = [] } = useFrequenciaMensal(monthStr)

  const getFeriado = useCallback((day: Date) => {
    const dStr = format(day, 'yyyy-MM-dd')
    return feriados.find((f: any) => f.data === dStr)
  }, [feriados])

  // Listen to realtime database changes for scales and observations sync
  useEffect(() => {
    const channel = supabase.channel('escala_db_changes')
      .on('broadcast', { event: 'sync' }, () => {
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
        queryClient.invalidateQueries({ queryKey: ['frequencia'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        refetchEscalas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, refetchEscalas])

  // Self-Healing: Automatically detect and clean up duplicate scale records in the database
  useEffect(() => {
    if (loadE || escalas.length === 0) return

    const cleanDuplicateScales = async () => {
      try {
        const grouped: Record<string, any[]> = {}
        escalas.forEach((e: any) => {
          if (e.funcionario_id && e.data) {
            const dateStr = typeof e.data === 'string' ? e.data.substring(0, 10) : ''
            if (dateStr) {
              const key = `${e.funcionario_id}_${dateStr}`
              if (!grouped[key]) grouped[key] = []
              grouped[key].push(e)
            }
          }
        })

        const duplicates: any[] = []
        Object.entries(grouped).forEach(([key, list]) => {
          if (list.length > 1) {
            // Prioritize specific non-presente statuses (like ferias, atestado, compensar) over default presente status,
            // and keep the most recently updated record.
            list.sort((a, b) => {
              const aIsSpecific = a.tipo !== 'presente'
              const bIsSpecific = b.tipo !== 'presente'
              if (aIsSpecific && !bIsSpecific) return -1
              if (!aIsSpecific && bIsSpecific) return 1

              const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
              const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
              if (aTime !== bTime) return bTime - aTime

              return String(b.id).localeCompare(String(a.id))
            })

            // Keep list[0] (the best/latest status) and mark the rest as duplicates to be deleted
            duplicates.push(...list.slice(1))
          }
        })

        if (duplicates.length > 0) {
          console.warn(`[Deduplication] Found ${duplicates.length} duplicate scales. Cleaning up...`)
          // Delete duplicates from Supabase in a single batch query
          const dupIds = duplicates.map(dup => dup.id)
          const { error } = await supabase
            .from('escalas')
            .delete()
            .in('id', dupIds)
          
          if (error) throw error
          
          toast(`Deduplicação automática: ${duplicates.length} registros duplicados corrigidos`, 'success')
          refetchEscalas()
        }
      } catch (err) {
        console.error('[Deduplication Error]', err)
      }
    }

    cleanDuplicateScales()
  }, [escalas, loadE, refetchEscalas])

  // Column widths state tracking to match floats with dynamic table layouts exactly!
  const [columnWidths, setColumnWidths] = useState<number[]>([])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const measureWidths = () => {
      const thElements = tableContainerRef.current?.querySelectorAll('thead th')
      if (thElements && thElements.length > 0) {
        const widths = Array.from(thElements).map(el => el.getBoundingClientRect().width)
        setColumnWidths(widths)
      }
    }

    measureWidths()
    window.addEventListener('resize', measureWidths)
    const interval = setInterval(measureWidths, 1000)
    
    return () => {
      window.removeEventListener('resize', measureWidths)
      clearInterval(interval)
    }
  }, [isHeaderStuck, viewMode, currentDate, escalas])

  // Scroll to today's column on mount, month change, or view mode change
  useEffect(() => {
    const performScroll = () => {
      const todayEl = tableContainerRef.current?.querySelector('#today-header') as HTMLElement
      if (todayEl && tableContainerRef.current) {
        const container = tableContainerRef.current
        const todayRect = todayEl.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        
        if (containerRect.width > 100 && todayRect.width > 0) {
          // Measure sticky employee column to offset centering
          const employeeCol = container.querySelector('th.sticky') as HTMLElement
          const stickyWidth = employeeCol ? employeeCol.offsetWidth : 150
          
          const currentScrollLeft = container.scrollLeft
          const relativeLeft = todayRect.left - containerRect.left
          const absoluteLeft = currentScrollLeft + relativeLeft
          
          const visibleWidth = containerRect.width - stickyWidth
          const targetScroll = absoluteLeft - stickyWidth - (visibleWidth / 2) + (todayRect.width / 2)
          
          container.scroll({
            left: Math.max(0, targetScroll),
            behavior: 'auto'
          })
        }
      }
    }

    // Run immediately and at staggered intervals to guarantee centering as layout finishes rendering
    performScroll()
    const t1 = setTimeout(performScroll, 100)
    const t2 = setTimeout(performScroll, 300)
    const t3 = setTimeout(performScroll, 600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  // Mutations
  const batchMutation = useBatchUpsertEscalas()
  const deleteMutation = useDeleteEscala()

  // Status mapping for fast lookups (customized Trabajo color settings)
  const STATUS_MAP = useMemo(() => {
    const list = [...(tiposEscala || DEFAULT_TIPOS_ESCALA)]
    if (!list.some(t => t.id === 'hora_extra')) {
      list.push({ id: 'hora_extra', letra: 'HE', nome: 'Hora Extra', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' })
    }
    if (!list.some(t => t.id === 'suspensao')) {
      list.push({ id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' })
    }
    return list.reduce((acc: Record<string, TipoEscala>, t) => {
      acc[t.id] = t
      return acc
    }, {})
  }, [tiposEscala])

  // Filter employees with active team validation
  const funcionarios = useMemo(() => {
    let list = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
    if (teamInfo?.isRestricted) {
      list = list.filter(f => teamInfo.teamMemberIds.includes(f.id))
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase()
      list = list.filter(f => 
        f.nome.toLowerCase().includes(s) || 
        (f.apelido && f.apelido.toLowerCase().includes(s)) ||
        f.matricula.toLowerCase().includes(s)
      )
    }
    return list
  }, [allFuncionarios, teamInfo, searchTerm])

  // Setores group
  const setores = useMemo(() => {
    const s = new Set(funcionarios.map(f => f.setor))
    return Array.from(s).sort()
  }, [funcionarios])

  // Fetch Teams and Members to populate selection filters in the Share dialog
  const { data: equipesList = [] } = useQuery<any[]>({
    queryKey: ['equipes-list-share'],
    queryFn: async () => {
      const { data: teams } = await supabase.from('equipes').select('*').order('nome')
      if (!teams) return []
      const { data: mems } = await supabase.from('equipe_membros').select('equipe_id, funcionario_id')
      return teams.map((eq: any) => ({
        ...eq,
        membros: (mems || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionario_id),
      }))
    }
  })

  const funcTeamMap = useMemo(() => {
    const map: Record<string, { id: string; nome: string; cor: string }> = {}
    equipesList.forEach((eq: any) => {
      eq.membros.forEach((fId: string) => {
        map[fId] = { id: eq.id, nome: eq.nome, cor: eq.cor }
      })
    })
    return map
  }, [equipesList])

  const noTeamFuncs = useMemo(() => {
    return funcionarios.filter(f => !funcTeamMap[f.id])
  }, [funcionarios, funcTeamMap])

  // Tree selection helpers for the share filter modal
  const isTeamFullySelected = (teamId: string, teamMembers: string[]) => {
    if (teamMembers.length === 0) return false
    return teamMembers.every(mId => selectedShareFuncs.includes(mId))
  }

  const isTeamPartiallySelected = (teamId: string, teamMembers: string[]) => {
    if (teamMembers.length === 0) return false
    const selectedCount = teamMembers.filter(mId => selectedShareFuncs.includes(mId)).length
    return selectedCount > 0 && selectedCount < teamMembers.length
  }

  const handleToggleTeam = (teamId: string, teamMembers: string[]) => {
    const fullySelected = isTeamFullySelected(teamId, teamMembers)
    if (fullySelected) {
      setSelectedShareFuncs(prev => prev.filter(id => !teamMembers.includes(id)))
      setSelectedShareTeams(prev => prev.filter(id => id !== teamId))
    } else {
      setSelectedShareFuncs(prev => {
        const next = [...prev]
        teamMembers.forEach(mId => {
          if (!next.includes(mId)) next.push(mId)
        })
        return next
      })
      setSelectedShareTeams(prev => {
        if (!prev.includes(teamId)) return [...prev, teamId]
        return prev
      })
    }
  }

  const handleToggleFunc = (funcId: string) => {
    setSelectedShareFuncs(prev => {
      if (prev.includes(funcId)) {
        return prev.filter(id => id !== funcId)
      } else {
        return [...prev, funcId]
      }
    })
  }

  const handleSelectAllShare = () => {
    const allIds = funcionarios.map(f => f.id)
    setSelectedShareFuncs(allIds)
  }

  const handleClearAllShare = () => {
    setSelectedShareFuncs([])
  }

  // Lookup scale details
  const escalaMap = useMemo(() => {
    const map: Record<string, any> = {}
    escalas.forEach((e: any) => {
      if (e.funcionario_id && e.data) {
        const dStr = typeof e.data === 'string' ? e.data.substring(0, 10) : ''
        if (dStr) {
          map[`${e.funcionario_id}_${dStr}`] = e
        }
      }
    })
    return map
  }, [escalas])

  // Lookup frequency details
  const freqMap = useMemo(() => {
    const map: Record<string, string> = {}
    frequencias.forEach((f: any) => {
      if (f.funcionario_id && f.data) {
        const dateStr = typeof f.data === 'string' ? f.data.substring(0, 10) : ''
        if (dateStr) {
          map[`${f.funcionario_id}_${dateStr}`] = f.status
        }
      }
    })
    return map
  }, [frequencias])

  // Synchronize observation input when activeCell changes
  useEffect(() => {
    if (activeCell) {
      const esc = escalaMap[`${activeCell.funcId}_${activeCell.dateStr}`]
      setCellObservation(esc?.observacoes || '')
    } else {
      setCellObservation('')
    }
  }, [activeCell, escalaMap])

  // Save Daily Observation
  const saveCellObservation = async (valueToSave?: string) => {
    if (!activeCell) return
    const { funcId, dateStr } = activeCell
    const esc = escalaMap[`${funcId}_${dateStr}`]
    const originalObs = esc?.observacoes || ''
    const currentObs = valueToSave !== undefined ? valueToSave : cellObservation
    
    // Normalize empty strings to null for database
    const finalObs = currentObs.trim() === '' ? null : currentObs.trim()
    const normalizedOriginal = originalObs.trim() === '' ? null : originalObs.trim()

    // If it didn't change, don't perform database write
    if (finalObs === normalizedOriginal) return

    try {
      if (esc) {
        const { error } = await supabase
          .from('escalas')
          .update({
            observacoes: finalObs,
            updated_at: new Date().toISOString()
          })
          .eq('id', esc.id)
        if (error) throw error
      } else {
        // Only insert a record if there is actually an observation to save
        if (finalObs === null) return

        const { error } = await supabase
          .from('escalas')
          .insert({
            funcionario_id: funcId,
            data: dateStr,
            tipo: 'presente',
            turno: 'integral',
            observacoes: finalObs,
            updated_at: new Date().toISOString()
          })
        if (error) throw error
      }
      toast('Observação atualizada', 'success')
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      console.error(e)
      toast('Erro ao salvar observação: ' + (e?.message || ''), 'error')
    }
  }

  // Update Daily Frequency (Presence/Absence)
  const updateCellFrequency = async (status: 'presente' | 'falta' | null) => {
    if (!activeCell) return
    const { funcId, dateStr } = activeCell
    
    // Close popover immediately for instant responsive feedback
    setActiveCell(null)

    try {
      if (status === null) {
        // 1. Delete from frequency
        const { error: freqError } = await supabase
          .from('frequencia')
          .delete()
          .eq('funcionario_id', funcId)
          .eq('data', dateStr)
        if (freqError) throw freqError

        // 2. Reset scale status to default (repouso if Sunday/feriado, otherwise presente)
        const parsedDate = parseISO(dateStr)
        const feriado = getFeriado(parsedDate)
        const isSun = isSunday(parsedDate)
        const defaultTipo = (isSun || feriado) ? 'repouso' : 'presente'
        
        const escala = escalaMap[`${funcId}_${dateStr}`]
        if (escala) {
          const { error: escError } = await supabase
            .from('escalas')
            .update({
              tipo: defaultTipo,
              updated_at: new Date().toISOString()
            })
            .eq('id', escala.id)
          if (escError) throw escError
        }

        toast('Chamada limpa com sucesso', 'success')
      } else {
        // 1. Upsert to frequency
        const { error: freqError } = await supabase
          .from('frequencia')
          .upsert({
            funcionario_id: funcId,
            data: dateStr,
            status,
            updated_at: new Date().toISOString()
          }, { onConflict: 'funcionario_id,data' })
        if (freqError) throw freqError

        // 2. Upsert/Update scales to match frequency status
        const escalaMapItem = escalaMap[`${funcId}_${dateStr}`]
        if (escalaMapItem) {
          const { error: escError } = await supabase
            .from('escalas')
            .update({
              tipo: status,
              updated_at: new Date().toISOString()
            })
            .eq('id', escalaMapItem.id)
          if (escError) throw escError
        } else {
          const { error: escError } = await supabase
            .from('escalas')
            .insert({
              funcionario_id: funcId,
              data: dateStr,
              tipo: status,
              turno: 'integral',
              updated_at: new Date().toISOString()
            })
          if (escError) throw escError
        }

        toast(`Presença registrada como ${status === 'presente' ? 'Presente' : 'Falta'}`, 'success')
      }
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      console.error(e)
      toast('Erro ao atualizar chamada: ' + (e?.message || ''), 'error')
    }
  }

  // Days list to render
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    const d: Date[] = []
    let cur = start
    while (cur <= end) { d.push(cur); cur = addDays(cur, 1) }
    return d
  }, [currentDate, viewMode])

  // Navigations
  const goBack = () => {
    if (viewMode === 'week') setCurrentDate(d => subWeeks(d, 1))
    else setCurrentDate(d => subMonths(d, 1))
    setActiveCell(null)
  }
  const goForward = () => {
    if (viewMode === 'week') setCurrentDate(d => addWeeks(d, 1))
    else setCurrentDate(d => addMonths(d, 1))
    setActiveCell(null)
  }
  const goToday = () => {
    setCurrentDate(new Date())
    setActiveCell(null)
  }

  // Handle cell selection / click
  const handleCellClick = useCallback((
    e: React.MouseEvent,
    funcId: string,
    funcNome: string,
    dateStr: string,
    dateLabel: string,
    currentTipo: string | null
  ) => {
    if (!canEdit) return

    const cellKey = `${funcId}_${dateStr}`

    // If bulk selection mode is active
    if (bulkMode) {
      setSelectedCells(prev => {
        const next = { ...prev }
        if (next[cellKey]) {
          delete next[cellKey]
        } else {
          next[cellKey] = { funcId, dateStr }
        }
        return next
      })
      return
    }

    // Standard Quick Excel Menu
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    setActiveCell({
      funcId,
      dateStr,
      funcNome,
      dateLabel,
      currentTipo,
      rect
    })
  }, [canEdit, bulkMode])

  // Select all cells for a specific date column in bulk mode
  const handleDayHeaderClick = (dateStr: string) => {
    if (!bulkMode) return

    // Find all visible employee IDs
    const visibleFuncIds = funcionarios.map(f => f.id)
    if (visibleFuncIds.length === 0) return

    // Check if all of them are already selected for this date
    const allSelected = visibleFuncIds.every(funcId => !!selectedCells[`${funcId}_${dateStr}`])

    setSelectedCells(prev => {
      const next = { ...prev }
      visibleFuncIds.forEach(funcId => {
        const key = `${funcId}_${dateStr}`
        if (allSelected) {
          delete next[key]
        } else {
          next[key] = { funcId, dateStr }
        }
      })
      return next
    })
  }

  // Apply single scale change
  const applySingleStatus = async (statusId: string | null) => {
    if (!activeCell) return
    const { funcId, dateStr } = activeCell

    // Close popover immediately for instant responsive feedback
    setActiveCell(null)

    try {
      if (statusId === null) {
        // Find and reset the scale record
        const targetEscalas = escalas.filter((e: any) => {
          const eDateStr = typeof e.data === 'string' ? e.data.substring(0, 10) : ''
          return e.funcionario_id === funcId && eDateStr === dateStr
        })

        if (targetEscalas.length > 0) {
          const esc = targetEscalas[0]
          if (esc.localidade || esc.observacoes) {
            // Keep the record, just update its tipo to default
            const parsedDate = parseISO(dateStr)
            const feriado = getFeriado(parsedDate)
            const isSun = isSunday(parsedDate)
            const defaultTipo = (isSun || feriado) ? 'repouso' : 'presente'
            
            const { error: escError } = await supabase
              .from('escalas')
              .update({
                tipo: defaultTipo,
                updated_at: new Date().toISOString()
              })
              .eq('id', esc.id)
            if (escError) throw escError
          } else {
            await Promise.all(targetEscalas.map(esc => deleteMutation.mutateAsync(esc.id)))
          }
        }

        // Remover frequência correspondente
        await supabase.from('frequencia').delete().eq('funcionario_id', funcId).eq('data', dateStr)

        // Sincronizar cache
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
        queryClient.invalidateQueries({ queryKey: ['frequencia'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        toast('Escala limpa com sucesso', 'success')
      } else {
        // Fetch existing scale record to get current localidade and turno
        const { data: existing } = await supabase
          .from('escalas')
          .select('localidade, turno')
          .eq('funcionario_id', funcId)
          .eq('data', dateStr)
          .maybeSingle()

        // Direct atomic upsert preserving localidade and turno
        await batchMutation.mutateAsync([{
          funcionario_id: funcId,
          data: dateStr,
          tipo: statusId,
          turno: existing?.turno || 'integral',
          localidade: existing?.localidade || null
        }])

        // Sincronizar com a frequência
        const freqMap: Record<string, string> = {
          'presente': 'presente',
          'trabalho': 'presente',
          'trabalhando': 'presente',
          'hora_extra': 'hora_extra',
          'he': 'hora_extra',
          'falta': 'falta',
          'faltou': 'falta',
          'repouso': 'folga',
          'descanso': 'folga',
          'folga': 'folga',
          'compensar': 'folga',
          'folgas': 'folga',
          'ferias': 'ferias',
          'feria': 'ferias',
          'atestado': 'atestado',
          'afastamento': 'atestado',
          'afastado': 'atestado',
          'licenca': 'atestado',
          'suspensao': 'falta'
        }
        const freqStatus = freqMap[statusId] || 'presente'
        await supabase.from('frequencia').upsert({
          funcionario_id: funcId,
          data: dateStr,
          status: freqStatus,
          updated_at: new Date().toISOString()
        }, { onConflict: 'funcionario_id,data' })

        // Sincronizar cache
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
        queryClient.invalidateQueries({ queryKey: ['frequencia'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        toast('Escala atualizada com sucesso', 'success')
      }
    } catch (e: any) {
      console.error('Erro ao atualizar escala:', e)
      toast('Erro ao atualizar: ' + (e?.message || ''), 'error')
    } finally {
      setActiveCell(null)
    }
  }

  // Apply bulk scale status change
  const applyBulkStatus = async (statusId: string | null) => {
    const cells = Object.values(selectedCells)
    if (cells.length === 0) return

    try {
      if (statusId === null) {
        // Find and delete the selected cells
        const deletePromises: Promise<any>[] = []
        cells.forEach(c => {
          const targetEscalas = escalas.filter((e: any) => {
            const eDateStr = typeof e.data === 'string' ? e.data.substring(0, 10) : ''
            return e.funcionario_id === c.funcId && eDateStr === c.dateStr
          })
          targetEscalas.forEach(esc => {
            deletePromises.push(deleteMutation.mutateAsync(esc.id))
          })
        })

        if (deletePromises.length > 0) {
          await Promise.all(deletePromises)
        }

        // Remover frequências em lote
        const deleteFreqPromises = cells.map(c => 
          supabase.from('frequencia').delete().eq('funcionario_id', c.funcId).eq('data', c.dateStr)
        )
        await Promise.all(deleteFreqPromises)

        // Sincronizar cache
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
        queryClient.invalidateQueries({ queryKey: ['frequencia'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        toast(`${deletePromises.length} escalas removidas`, 'success')
      } else {
        // Direct atomic bulk upsert (matches ON CONFLICT funcionario_id, data)
        const batchData = cells.map(c => ({
          funcionario_id: c.funcId,
          data: c.dateStr,
          tipo: statusId,
          turno: 'integral' as const
        }))
        await batchMutation.mutateAsync(batchData)

        // Sincronizar com a frequência em lote
        const freqMap: Record<string, string> = {
          'presente': 'presente',
          'trabalho': 'presente',
          'trabalhando': 'presente',
          'hora_extra': 'hora_extra',
          'he': 'hora_extra',
          'falta': 'falta',
          'faltou': 'falta',
          'repouso': 'folga',
          'descanso': 'folga',
          'folga': 'folga',
          'compensar': 'folga',
          'folgas': 'folga',
          'ferias': 'ferias',
          'feria': 'ferias',
          'atestado': 'atestado',
          'afastamento': 'atestado',
          'afastado': 'atestado',
          'licenca': 'atestado',
          'suspensao': 'falta'
        }
        const freqStatus = freqMap[statusId] || 'presente'
        const freqUpserts = cells.map(c => ({
          funcionario_id: c.funcId,
          data: c.dateStr,
          status: freqStatus,
          updated_at: new Date().toISOString()
        }))
        await supabase.from('frequencia').upsert(freqUpserts, { onConflict: 'funcionario_id,data' })

        // Sincronizar cache
        queryClient.invalidateQueries({ queryKey: ['escalas'] })
        queryClient.invalidateQueries({ queryKey: ['frequencia'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        toast(`${cells.length} escalas atualizadas em lote`, 'success')
      }
    } catch (e: any) {
      console.error('Erro no processamento em lote:', e)
      toast('Erro no processamento em lote: ' + (e?.message || ''), 'error')
    } finally {
      setSelectedCells({})
      setBulkStatusModal(false)
      setBulkMode(false)
    }
  }

  // Pure Canvas 2D renderer — zero DOM serialization, zero CORS, zero external resources
  const handleShare = async (overrideFuncs?: any[]) => {
    toast('Gerando imagem em alta resolução da escala...', 'info')
    setIsSharing(true)

    try {
      // ── Layout constants ──
      const SCALE = 2 // retina quality
      const NAME_COL_W = 200
      const CELL_W = viewMode === 'month' ? 44 : 80
      const ROW_H = 38
      const HEADER_H = 50
      const SECTOR_H = 32
      const TITLE_H = 60
      const LEGEND_H = 40
      const PADDING = 16
      const BADGE_SIZE = 28

      // ── Resolve actual rendered colors from Tailwind classes via getComputedStyle ──
      // This guarantees 1:1 match with the page, regardless of custom colors, opacity, or dark mode
      const resolveColor = (cssClasses: string, property: 'backgroundColor' | 'color'): string => {
        const probe = document.createElement('div')
        probe.style.position = 'fixed'
        probe.style.top = '-9999px'
        probe.style.left = '-9999px'
        probe.style.width = '10px'
        probe.style.height = '10px'
        probe.style.pointerEvents = 'none'
        probe.className = cssClasses
        document.body.appendChild(probe)
        const computed = window.getComputedStyle(probe)
        const val = computed[property]
        document.body.removeChild(probe)
        return val || (property === 'backgroundColor' ? '#64748b' : '#ffffff')
      }

      // Convert CSS color string (rgb/rgba/hex) to a hex string for canvas
      const cssColorToHex = (cssColor: string): string => {
        if (!cssColor) return '#ffffff'
        const color = cssColor.trim().toLowerCase()
        if (color === 'transparent') return '#ffffff'
        if (color.startsWith('#')) return color

        // Handle rgb(r, g, b) and rgba(r, g, b, a)
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (match) {
          const r = parseInt(match[1])
          const g = parseInt(match[2])
          const b = parseInt(match[3])
          const a = match[4] !== undefined ? parseFloat(match[4]) : 1

          // Blend with white background: color * alpha + 255 * (1 - alpha)
          const blend = (c: number) => Math.round(c * a + 255 * (1 - a))
          const rHex = blend(r).toString(16).padStart(2, '0')
          const gHex = blend(g).toString(16).padStart(2, '0')
          const bHex = blend(b).toString(16).padStart(2, '0')
          return `#${rHex}${gHex}${bHex}`
        }
        return cssColor // return as-is if not parseable, canvas can usually handle it
      }

      // Build dynamic color map from the live STATUS_MAP (reads actual browser-rendered colors)
      const statusColors: Record<string, { bg: string; text: string }> = {}
      for (const [id, tipo] of Object.entries(STATUS_MAP)) {
        const t = tipo as any
        const bgRaw = resolveColor(t.bg || '', 'backgroundColor')
        const textRaw = resolveColor(t.text || '', 'color')
        statusColors[id] = {
          bg: cssColorToHex(bgRaw),
          text: cssColorToHex(textRaw),
        }
      }

      const defaultColor = { bg: '#64748b', text: '#ffffff' }
      const inactiveColor = { bg: '#fee2e2', text: '#dc2626' }

      // ── Prepare row data ──
      interface RowData { type: 'sector'; label: string; count: number }
      interface RowDataFunc { type: 'func'; func: any }
      type Row = RowData | RowDataFunc

      const targetFuncs = overrideFuncs || funcionarios
      const targetSetores = Array.from(new Set(targetFuncs.map((f: any) => f.setor))).sort()

      const rows: Row[] = []
      for (const setor of targetSetores) {
        const funcsInSetor = targetFuncs.filter((f: any) => f.setor === setor)
        if (!funcsInSetor.length) continue
        rows.push({ type: 'sector', label: setor, count: funcsInSetor.length })
        for (const func of funcsInSetor) {
          rows.push({ type: 'func', func })
        }
      }

      const totalCols = days.length
      const canvasW = NAME_COL_W + totalCols * CELL_W + PADDING * 2
      const bodyH = rows.reduce((h, r) => h + (r.type === 'sector' ? SECTOR_H : ROW_H), 0)
      const canvasH = TITLE_H + LEGEND_H + HEADER_H + bodyH + PADDING * 2

      // ── Create canvas ──
      const canvas = document.createElement('canvas')
      canvas.width = canvasW * SCALE
      canvas.height = canvasH * SCALE
      const ctx = canvas.getContext('2d')!
      ctx.scale(SCALE, SCALE)

      // ── Helper: draw rounded rect ──
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // ── Helper: draw corner badge ──
      const drawCornerBadge = (cx: number, cy: number, bgColor: string, type: 'check' | 'warning' | 'observation') => {
        const rad = 6.5
        ctx.fillStyle = bgColor
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.stroke()
        
        ctx.strokeStyle = '#ffffff'
        ctx.fillStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        if (type === 'check') {
          ctx.beginPath()
          ctx.moveTo(cx - 2.5, cy + 0.2)
          ctx.lineTo(cx - 0.7, cy + 2.2)
          ctx.lineTo(cx + 2.8, cy - 1.8)
          ctx.stroke()
        } else if (type === 'warning') {
          ctx.beginPath()
          ctx.moveTo(cx, cy - 3)
          ctx.lineTo(cx, cy + 0.5)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(cx, cy + 2.2, 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else if (type === 'observation') {
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(cx, cy - 0.5, 2.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(cx - 0.8, cy + 1.2)
          ctx.lineTo(cx - 2.2, cy + 2.2)
          ctx.lineTo(cx - 0.2, cy + 1.6)
          ctx.fill()
        }
      }

      // ── Background ──
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasW, canvasH)

      let curY = PADDING

      // ── Title row ──
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 18px Arial, Helvetica, sans-serif'
      const titleText = viewMode === 'week' ? 'ESCALA GERAL SEMANAL' : 'ESCALA GERAL MENSAL'
      ctx.fillText(titleText, PADDING, curY + 22)

      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 11px Arial, Helvetica, sans-serif'
      const subtitleText = viewMode === 'week'
        ? `Semana: ${format(days[0], 'dd/MM/yyyy')} a ${format(days[days.length - 1], 'dd/MM/yyyy')}`
        : `Mês: ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}`
      ctx.fillText(subtitleText, PADDING, curY + 40)

      // ── Separator line ──
      curY += TITLE_H
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(PADDING, curY - 8)
      ctx.lineTo(canvasW - PADDING, curY - 8)
      ctx.stroke()

      // ── Legend row ──
      const legendItems = Object.values(STATUS_MAP)
      let legendX = PADDING
      ctx.font = 'bold 9px Arial, Helvetica, sans-serif'
      for (const item of legendItems) {
        const itemId = (item as any).id
        const letra = itemId === 'repouso' ? 'R/D' : (item as any).letra
        const nome = itemId === 'repouso' ? 'Repouso (R) / Descanso (D)' : (item as any).nome
        const label = `${letra}: ${nome}`
        const colors = statusColors[itemId] || defaultColor
        const tw = ctx.measureText(label).width + 28 // extra space for color dot
        // pill background
        ctx.fillStyle = '#f8fafc'
        roundRect(legendX, curY, tw, 22, 6)
        ctx.fill()
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        roundRect(legendX, curY, tw, 22, 6)
        ctx.stroke()
        // color dot
        ctx.fillStyle = colors.bg
        roundRect(legendX + 6, curY + 5, 12, 12, 3)
        ctx.fill()
        // text
        ctx.fillStyle = '#334155'
        ctx.fillText(label, legendX + 22, curY + 15)
        legendX += tw + 6
        if (legendX > canvasW - PADDING - 80) { legendX = PADDING; curY += 26 }
      }
      curY += LEGEND_H

      // ── Table Header ──
      const tableX = PADDING
      const tableW = NAME_COL_W + totalCols * CELL_W

      // Header background
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(tableX, curY, tableW, HEADER_H)

      // "Colaboradores" label
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px Arial, Helvetica, sans-serif'
      ctx.fillText('COLABORADORES', tableX + 12, curY + HEADER_H / 2 + 4)

      // Day headers
      for (let i = 0; i < totalCols; i++) {
        const day = days[i]
        const x = tableX + NAME_COL_W + i * CELL_W
        const centerX = x + CELL_W / 2

        ctx.fillStyle = '#94a3b8'
        ctx.font = 'bold 8px Arial, Helvetica, sans-serif'
        const dayName = format(day, 'EEE', { locale: ptBR }).substring(0, 3).toUpperCase()
        const dayNameW = ctx.measureText(dayName).width
        ctx.fillText(dayName, centerX - dayNameW / 2, curY + 20)

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 13px Arial, Helvetica, sans-serif'
        const dayNum = format(day, 'dd')
        const dayNumW = ctx.measureText(dayNum).width
        ctx.fillText(dayNum, centerX - dayNumW / 2, curY + 38)

        // Column separator
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(x, curY)
        ctx.lineTo(x, curY + HEADER_H)
        ctx.stroke()
      }

      curY += HEADER_H

      // ── Table Body ──
      const freqToEscalaMap: Record<string, string> = {
        'presente': 'presente', 'hora_extra': 'hora_extra', 'falta': 'falta',
        'folga': 'compensar', 'ferias': 'ferias', 'atestado': 'atestado'
      }

      for (const row of rows) {
        if (row.type === 'sector') {
          // Sector divider row
          ctx.fillStyle = '#f1f5f9'
          ctx.fillRect(tableX, curY, tableW, SECTOR_H)
          ctx.strokeStyle = '#cbd5e1'
          ctx.lineWidth = 0.5
          ctx.strokeRect(tableX, curY, tableW, SECTOR_H)
          ctx.fillStyle = '#334155'
          ctx.font = 'bold 10px Arial, Helvetica, sans-serif'
          ctx.fillText(`${row.label.toUpperCase()} (${row.count} funcionários)`, tableX + 12, curY + SECTOR_H / 2 + 4)
          curY += SECTOR_H
          continue
        }

        const func = row.func
        const rowY = curY

        // Row background (alternating subtle)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(tableX, rowY, tableW, ROW_H)

        // Row border bottom
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(tableX, rowY + ROW_H)
        ctx.lineTo(tableX + tableW, rowY + ROW_H)
        ctx.stroke()

        // Avatar circle
        const avatarSize = 22
        const avatarX = tableX + 10
        const avatarY = rowY + (ROW_H - avatarSize) / 2
        ctx.fillStyle = '#1e293b'
        roundRect(avatarX, avatarY, avatarSize, avatarSize, 4)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px Arial, Helvetica, sans-serif'
        const initial = func.nome.charAt(0).toUpperCase()
        const initialW = ctx.measureText(initial).width
        ctx.fillText(initial, avatarX + avatarSize / 2 - initialW / 2, avatarY + avatarSize / 2 + 4)

        // Employee name
        ctx.fillStyle = '#1e293b'
        ctx.font = 'bold 10px Arial, Helvetica, sans-serif'
        const displayName = func.nome.split(' ').slice(0, 2).join(' ').toUpperCase()
        ctx.fillText(displayName, avatarX + avatarSize + 8, rowY + ROW_H / 2 + 0)

        // Apelido
        ctx.fillStyle = '#94a3b8'
        ctx.font = 'bold 8px Arial, Helvetica, sans-serif'
        ctx.fillText((func.apelido || '—').toUpperCase(), avatarX + avatarSize + 8, rowY + ROW_H / 2 + 12)

        // Name column right border
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(tableX + NAME_COL_W, rowY)
        ctx.lineTo(tableX + NAME_COL_W, rowY + ROW_H)
        ctx.stroke()

        // Day cells
        for (let i = 0; i < totalCols; i++) {
          const day = days[i]
          const dStr = format(day, 'yyyy-MM-dd')
          const cellKey = `${func.id}_${dStr}`
          const feriado = getFeriado(day)
          const isSun = isSunday(day)
          const freqStatus = freqMap[cellKey]
          const escala = escalaMap[cellKey]

          const resolvedTipoId = escala?.tipo || (freqStatus ? freqToEscalaMap[freqStatus] : null) || ((isSun || feriado) ? 'repouso' : 'presente')

          const tipo = STATUS_MAP[resolvedTipoId] || {
            id: resolvedTipoId,
            letra: resolvedTipoId.substring(0, 2).toUpperCase(),
            nome: resolvedTipoId,
          }

          const isInactive = !!(func.data_desligamento && dStr >= func.data_desligamento)

          let colors = statusColors[tipo.id] || defaultColor
          if (isInactive) colors = inactiveColor

          const cellX = tableX + NAME_COL_W + i * CELL_W
          const badgeX = cellX + (CELL_W - BADGE_SIZE) / 2
          const badgeY = rowY + (ROW_H - BADGE_SIZE) / 2

          // Badge background
          ctx.fillStyle = colors.bg
          roundRect(badgeX, badgeY, BADGE_SIZE, BADGE_SIZE, 5)
          ctx.fill()

          // Badge text
          ctx.fillStyle = colors.text
          ctx.font = 'bold 10px Arial, Helvetica, sans-serif'
          const isSunOrFeriado = isSun || !!feriado
          const badgeText = isInactive ? 'DESL' : (tipo.id === 'repouso' ? (isSunOrFeriado ? 'D' : 'R') : (tipo as any).letra || tipo.id.substring(0, 2).toUpperCase())
          const badgeTextW = ctx.measureText(badgeText).width
          ctx.fillText(badgeText, badgeX + BADGE_SIZE / 2 - badgeTextW / 2, badgeY + BADGE_SIZE / 2 + 4)

          // Draw corner badges for warning, observation, and check status to match UI parity
          if (!isInactive) {
            const isConfirmedPresent = freqStatus === 'presente' || freqStatus === 'hora_extra'
            if (isConfirmedPresent) {
              drawCornerBadge(badgeX + BADGE_SIZE, badgeY + BADGE_SIZE, '#10b981', 'check')
            }

            const hasWarning = escala?.observacoes?.includes('[ADVERTÊNCIA]')
            if (hasWarning) {
              drawCornerBadge(badgeX, badgeY + BADGE_SIZE, '#f59e0b', 'warning')
            }

            const hasObs = escala?.observacoes && 
                           !escala.observacoes.includes('[ADVERTÊNCIA]') && 
                           !escala.observacoes.includes('[SUSPENSÃO]') && 
                           escala.observacoes.trim() !== '' && 
                           escala.observacoes !== 'Gerado anonymously' && // handle typo or safety check if needed
                           escala.observacoes !== 'Gerado automaticamente'
            if (hasObs) {
              drawCornerBadge(badgeX + BADGE_SIZE, badgeY, '#6366f1', 'observation')
            }
          }
        }

        curY += ROW_H
      }

      // ── Outer table border ──
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.strokeRect(tableX, PADDING + TITLE_H + LEGEND_H, tableW, HEADER_H + bodyH)

      // ── Export to JPEG ──
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

      const byteString = atob(dataUrl.split(',')[1])
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })

      const isWeekly = viewMode === 'week'
      const startOfCurrentWeek = isWeekly ? days[0] : currentDate
      const monthStr = format(currentDate, 'yyyy-MM')
      const fileName = isWeekly
        ? `escala-semanal-${format(startOfCurrentWeek, 'yyyy-MM-dd')}.jpg`
        : `escala-${monthStr}.jpg`

      // Open the custom Share Modal
      setShareImageUrl(dataUrl)
      setShareImageBlob(blob)
      setShareFileName(fileName)
      setZoomLevel(1.0)
      setRotationAngle(0)
      setShareModalOpen(true)

      toast('Imagem da escala gerada com sucesso!', 'success')
    } catch (e: any) {
      console.error('Erro na exportação de imagem da escala:', e)
      toast('Erro ao gerar imagem: ' + (e?.message || String(e)), 'error')
    } finally {
      setIsSharing(false)
    }
  }



  // Clean all selections
  const clearSelection = () => {
    setSelectedCells({})
    setBulkMode(false)
  }

  // Select all days in view for all listed employees
  const selectAllVisibleCells = () => {
    const newSelection: Record<string, { funcId: string; dateStr: string }> = {}
    funcionarios.forEach(f => {
      days.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd')
        newSelection[`${f.id}_${dStr}`] = { funcId: f.id, dateStr: dStr }
      })
    })
    setSelectedCells(newSelection)
    setBulkMode(true)
  }

  // Click outside to dismiss selector
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeCell) {
        const popover = document.getElementById('quick-status-popover')
        if (popover && !popover.contains(e.target as Node)) {
          setActiveCell(null)
        }
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [activeCell])

  // Count summaries
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayEscalas = escalas.filter((e: any) => e.data === todayStr)
  const presentCount = todayEscalas.filter((e: any) => e.tipo === 'presente').length
  const offCount = todayEscalas.filter((e: any) => e.tipo && e.tipo !== 'presente').length

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] pb-36 font-sans">
      <TopHeader title="Escala Geral" subtitle="Gestão Avançada Corporativa de Plantões e Folgas" />

      <div 
        className="w-full max-w-full px-0 pt-20 sm:pt-24 pb-32 scale-table-container"
        style={scaleStyles}
      >
        <style>{`
          .scale-table-container th:first-child,
          .scale-table-container td:first-child {
            width: var(--grid-name-width) !important;
            min-width: var(--grid-name-width) !important;
            max-width: var(--grid-name-width) !important;
            padding-left: var(--grid-padding-x-large) !important;
            padding-right: var(--grid-padding-x-large) !important;
          }
          
          .scale-table-container th:not(:first-child),
          .scale-table-container td:not(:first-child) {
            width: var(--grid-cell-width) !important;
            min-width: var(--grid-cell-width) !important;
            max-width: var(--grid-cell-width) !important;
            padding: var(--grid-padding-y) var(--grid-padding-x) !important;
          }

          .scale-table-container th,
          .scale-table-container td,
          .scale-table-container span,
          .scale-table-container button {
            font-size: var(--grid-font-cell) !important;
          }
          
          .scale-table-container .day-number {
            font-size: var(--grid-font-day) !important;
          }

          .scale-table-container .day-name {
            font-size: var(--grid-font-title) !important;
          }

          .scale-table-container .status-badge {
            font-size: var(--grid-font-badge) !important;
            padding: var(--grid-badge-padding-y) var(--grid-badge-padding-x) !important;
            height: var(--grid-badge-height) !important;
            min-height: var(--grid-badge-height) !important;
            line-height: 1 !important;
          }

          .scale-table-container .colab-avatar {
            width: var(--grid-avatar-size) !important;
            height: var(--grid-avatar-size) !important;
          }
          
          .scale-table-container .colab-name {
            font-size: var(--grid-font-cell) !important;
          }
          
          .scale-table-container .colab-matricula {
            font-size: var(--grid-font-sub) !important;
            display: var(--grid-sub-display) !important;
          }

          /* Force light theme styles for high-fidelity JPEG print/export */
          .capture-mode {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .capture-mode th, .capture-mode td {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
          }
          .capture-mode .day-name {
            color: #64748b !important;
          }
          .capture-mode .day-number {
            color: #0f172a !important;
          }
          .capture-mode .colab-name {
            color: #0f172a !important;
          }
          .capture-mode .colab-matricula {
            color: #64748b !important;
          }
          .capture-mode .colab-avatar {
            background-color: #f1f5f9 !important;
            color: #3b82f6 !important;
            border-color: #e2e8f0 !important;
          }
          .capture-mode tr {
            background-color: #ffffff !important;
          }
          .capture-mode .bg-muted\\/30, .capture-mode .bg-muted\\/40 {
            background-color: #f8fafc !important;
          }
          .capture-mode .text-primary {
            color: #2563eb !important;
          }
          .capture-mode .text-muted-foreground {
            color: #64748b !important;
          }
        `}</style>
        
        {/* Advanced Filter Toolbar */}
        <div className="bg-card/75 dark:bg-card/40 backdrop-blur-xl border border-border/40 rounded-[2rem] p-5 shadow-xl shadow-black/5 mb-6 mx-2 sm:mx-4 md:mx-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col gap-5 relative z-10">
            {/* Header & Nav Controls */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              
              {/* Date Nav Switcher */}
              <div className="flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border/30 w-full lg:w-auto justify-between sm:justify-start">
                <button onClick={goBack} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-card hover:text-foreground active:scale-95 transition-all text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
                
                <button onClick={goToday} className="px-6 text-center hover:opacity-85 transition-opacity">
                  <span className="text-[9px] font-black uppercase text-primary tracking-[0.25em] block mb-0.5">
                    {viewMode === 'week' ? `Semana ${getWeek(currentDate)}` : format(currentDate, 'MMMM', { locale: ptBR })}
                  </span>
                  <span className="text-sm font-black text-foreground tracking-tight block">
                    {viewMode === 'week'
                      ? `${format(days[0], 'dd/MM')} — ${format(days[days.length - 1], 'dd/MM')}`
                      : format(currentDate, 'MMMM yyyy', { locale: ptBR })
                    }
                  </span>
                </button>

                <button onClick={goForward} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-card hover:text-foreground active:scale-95 transition-all text-muted-foreground"><ChevronRight className="w-5 h-5" /></button>
              </div>

              {/* Excel Bulk controls & visual toggles */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
                
                {/* View Modes */}
                <div className="bg-muted/60 p-1 rounded-xl border border-border/30 flex shadow-inner">
                  <button onClick={() => { setViewMode('week'); setActiveCell(null); }} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5", viewMode === 'week' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <Layers className="w-3.5 h-3.5" /> Semanal
                  </button>
                  <button onClick={() => { setViewMode('month'); setActiveCell(null); }} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5", viewMode === 'month' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <CalendarDays className="w-3.5 h-3.5" /> Mensal
                  </button>
                </div>

                {/* Bulk Select Mode Toggle */}
                {canEdit && (
                  <button 
                    onClick={() => { setBulkMode(!bulkMode); setSelectedCells({}); }}
                    className={cn(
                      "h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 border shadow-sm",
                      bulkMode 
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" 
                        : "bg-muted/50 border-border/30 hover:bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {bulkMode ? <CheckSquare className="w-4 h-4 text-amber-500 animate-pulse" /> : <Square className="w-4 h-4" />}
                    Lote
                  </button>
                )}

                {/* Action Buttons */}

                <button 
                  onClick={() => {
                    const allIds = funcionarios.map(f => f.id)
                    setSelectedShareFuncs(allIds)
                    setShareFilterSearchTerm('')
                    setShareFilterModalOpen(true)
                  }} 
                  disabled={isSharing}
                  className="h-10 px-4 bg-muted/60 border border-border/30 rounded-xl flex items-center justify-center hover:bg-card text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all gap-2 text-[10px] font-black uppercase tracking-wider shrink-0 disabled:opacity-55 disabled:scale-100"
                >
                  {isSharing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Compartilhar</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Live Filter Inputs */}
            <div className="flex flex-col md:flex-row items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <input
                  type="text" 
                  placeholder="Pesquisar por nome ou matrícula..."
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-muted/40 border border-transparent focus:border-primary/20 rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/30 outline-none transition-all focus:bg-card/50"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lote Selection Floating Notification Bar */}
        {bulkMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card dark:bg-card border border-amber-500/30 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom duration-300 max-w-xl w-11/12 border-t-4 border-t-amber-500">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Seleção em Lote Ativada
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-bold truncate">
                {Object.keys(selectedCells).length} células selecionadas da grade do Excel
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={selectAllVisibleCells}
                className="px-3 py-2 bg-muted/60 hover:bg-card text-muted-foreground hover:text-foreground text-[9px] font-black uppercase tracking-wider rounded-xl transition-all border border-border/40"
              >
                Tudo
              </button>
              <button 
                onClick={clearSelection}
                className="px-3 py-2 hover:bg-muted text-muted-foreground text-[9px] font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Limpar
              </button>
              <button 
                onClick={() => setBulkStatusModal(true)}
                disabled={Object.keys(selectedCells).length === 0}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-40"
              >
                Definir Status
              </button>
            </div>
          </div>
        )}



        {/* FLOATING ACTIVE DOCK BAR - SYNCHRONIZED SCROLL */}
        {isHeaderStuck && columnWidths.length > 0 && (
          <div 
            className={cn(
              "fixed top-16 right-0 z-40 bg-card border-b-2 border-b-primary shadow-2xl flex select-none transition-all duration-300 md:pl-0 h-14",
              isSidebarCollapsed ? "left-0 md:left-20" : "left-0 md:left-64"
            )}
          >
            {/* Left spacer block for name alignment (pixel-perfect matching corner th!) */}
            <div 
              className="bg-card border-b border-r border-border/50 px-4 py-3 flex items-center justify-between shrink-0 shadow-[2px_0_10px_rgba(0,0,0,0.02)]"
              style={{ width: columnWidths[0], minWidth: columnWidths[0] }}
            >
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-primary rotate-90 scale-105 text-primary animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">COLABORADORES</span>
              </div>
            </div>
            {/* Floating scroll days bar */}
            <div 
              ref={floatingHeaderRef}
              onScroll={handleFloatingScroll}
              className="flex-1 overflow-x-auto overflow-y-hidden flex scrollbar-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {days.map((day, index) => {
                const isT = isToday(day)
                const isSun = isSunday(day)
                const feriado = getFeriado(day)
                const w = columnWidths[index + 1] ?? 42
                const dStr = format(day, 'yyyy-MM-dd')
                return (
                  <div 
                    key={day.toISOString()}
                    onClick={() => handleDayHeaderClick(dStr)}
                    className={cn(
                      "px-1 py-2 text-center border-b border-border/50 shrink-0 flex flex-col items-center justify-center transition-all relative",
                      isT && "z-10 bg-primary/[0.12] dark:bg-primary/[0.08] shadow-[5px_0_8px_-1px_rgba(0,0,0,0.12),-5px_0_8px_-1px_rgba(0,0,0,0.12)] dark:shadow-[5px_0_10px_-1px_rgba(0,0,0,0.45),-5px_0_10px_-1px_rgba(0,0,0,0.45)] border-x-transparent",
                      isSun && "bg-rose-500/35 dark:bg-rose-500/25 border-x border-x-rose-500/20",
                      feriado && "bg-purple-500/35 dark:bg-purple-500/25 border-b-purple-400 border-x border-x-purple-500/20",
                      bulkMode && "cursor-pointer hover:bg-primary/10 active:bg-primary/20 select-none"
                    )}
                    style={{ width: w, minWidth: w, maxWidth: w }}
                  >
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider block day-name", 
                      isSun ? "text-rose-500" : feriado ? "text-purple-600 dark:text-purple-400" : isT ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(day, 'EEEE', { locale: ptBR }).substring(0, 3)}
                    </span>
                    <span className={cn(
                      "text-sm font-black tracking-tight mt-0.5 leading-none day-number",
                      isT ? "text-primary" : feriado ? "text-purple-700 dark:text-purple-300" : "text-foreground"
                    )}>
                      {format(day, 'dd')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Interactive Excel-like Grid Layout */}
        <div className="bg-card dark:bg-card border-y md:border border-border/50 rounded-none md:rounded-none shadow-2xl relative mx-0 md:mx-0 border-x-0">
          
          <div 
            ref={tableContainerRef} 
            onScroll={handleTableScroll}
            className="overflow-x-auto overflow-y-visible select-none relative" 
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full border-separate border-spacing-0">
              {/* ORIGINAL HEADER ROW - FLOWS NATURALLY IN THE TABLE */}
              <thead>
                <tr className="transition-all duration-300">
                  <th className="sticky left-0 z-30 px-4 py-4 text-left min-w-[150px] sm:min-w-[200px] shadow-[2px_0_10px_rgba(0,0,0,0.02)] bg-card border-b border-r border-border/50">
                    <div className="flex items-center gap-2">
                      <Grid className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground block">
                        COLABORADORES
                      </span>
                    </div>
                  </th>
                  {days.map(day => {
                    const isT = isToday(day)
                    const isSun = isSunday(day)
                    const feriado = getFeriado(day)
                    const dStr = format(day, 'yyyy-MM-dd')
                    return (
                      <th 
                        key={day.toISOString()} 
                        title={feriado ? `Feriado Oficial: ${feriado.nome}` : undefined}
                        id={isT ? "today-header" : undefined}
                        onClick={() => handleDayHeaderClick(dStr)}
                        className={cn(
                          "bg-card border-b border-border/50 py-3 text-center transition-all relative",
                          viewMode === 'month' ? (isT ? 'min-w-[150px] w-[150px]' : 'min-w-[42px]') : (isT ? 'min-w-[240px] sm:min-w-[300px] w-[240px] sm:w-[300px]' : 'min-w-[64px] sm:min-w-[80px]'),
                          isT && "bg-primary/[0.12] dark:bg-primary/[0.08] border-x-transparent",
                          isSun && "bg-rose-500/35 dark:bg-rose-500/25 border-x border-x-rose-500/20",
                          feriado && "bg-purple-500/35 dark:bg-purple-500/25 border-b-purple-400 border-x border-x-purple-500/20",
                          bulkMode && "cursor-pointer hover:bg-primary/10 active:bg-primary/20 select-none"
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider block transition-all duration-300 day-name", 
                            isSun ? "text-rose-500" : feriado ? "text-purple-600 dark:text-purple-400" : isT ? "text-primary" : "text-muted-foreground"
                          )}>
                            {format(day, 'EEEE', { locale: ptBR }).substring(0, 3)}
                          </span>
                          <span className={cn(
                            "text-sm font-black tracking-tight flex items-center justify-center rounded-lg leading-none transition-all duration-300 day-number",
                            isT ? "bg-primary text-white w-7 h-7 sm:w-8 sm:h-8 shadow-md shadow-primary/20 scale-105" : 
                            feriado ? "text-purple-700 dark:text-purple-300 bg-purple-500/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border border-purple-500/20" : 
                            "text-foreground"
                          )}>
                            {format(day, 'dd')}
                          </span>
                        </div>
                        {feriado && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              {/* TBODY ROW LISTS */}
              <tbody className="divide-y divide-border/30 relative z-[1]">
                {setores.map(setor => {
                  const funcsInSetor = funcionarios.filter(f => f.setor === setor)
                  if (!funcsInSetor.length) return null

                  return (
                    <React.Fragment key={setor}>
                      {/* Sector Divider Bar */}
                      <tr className="bg-muted/30 dark:bg-muted/10">
                        <td colSpan={days.length + 1} className="py-2.5 pl-0 pr-4 border-b border-border/30 bg-muted/40 backdrop-blur-md relative z-30">
                          <div className="sticky left-4 flex items-center gap-2 w-max z-20">
                            <ClipboardList className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">{setor}</span>
                            <span className="text-[9px] font-bold text-muted-foreground">({funcsInSetor.length} funcionários)</span>
                          </div>
                        </td>
                      </tr>

                      {/* Employee Item Rows */}
                      {funcsInSetor.map(func => (
                        <tr key={func.id} className="group hover:bg-primary/[0.01] transition-all">
                             {/* Sticky Employee column */}
                          <td className="sticky left-0 z-20 bg-card group-hover:bg-card border-b border-r border-border/30 px-4 py-2.5 shadow-[3px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[3px_0_12px_rgba(0,0,0,0.15)]">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0 uppercase shadow-inner border border-primary/5 colab-avatar">
                                {func.nome.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs font-black text-foreground truncate max-w-[100px] sm:max-w-[140px] uppercase leading-tight colab-name">
                                  {func.nome.split(' ').slice(0, 2).join(' ')}
                                </p>
                                <p className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest mt-0.5 colab-matricula">
                                  {func.apelido || '—'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Days Scale Grid Cells */}
                          {days.map(day => {
                            const dStr = format(day, 'yyyy-MM-dd')
                            const feriado = getFeriado(day)
                            const cellKey = `${func.id}_${dStr}`
                            const isSelected = !!selectedCells[cellKey]
                            const isSun = isSunday(day)
                            const freqStatus = freqMap[cellKey]
                            const isConfirmedPresent = freqStatus === 'presente' || freqStatus === 'hora_extra'
                            const escala = escalaMap[cellKey]

                            // Default to 'repouso' on Sundays, and 'presente' on weekdays if no escala record is present
                            const freqToEscalaMap: Record<string, string> = {
                              'presente': 'presente',
                              'hora_extra': 'hora_extra',
                              'falta': 'falta',
                              'folga': 'compensar',
                              'ferias': 'ferias',
                              'atestado': 'atestado'
                            }
                            const resolvedTipoId = escala?.tipo || (freqStatus ? freqToEscalaMap[freqStatus] : null) || ((isSun || feriado) ? 'repouso' : 'presente')
                            
                            const tipo = STATUS_MAP[resolvedTipoId] || { 
                              id: resolvedTipoId, 
                              letra: resolvedTipoId.substring(0, 2).toUpperCase(), 
                              nome: resolvedTipoId, 
                              bg: 'bg-slate-500/20 border border-slate-500/30 dark:border-slate-400/20', 
                              text: 'text-slate-600 dark:text-slate-400 font-extrabold shadow-none', 
                              ring: 'ring-slate-400' 
                            }
                            const isT = isToday(day)

                            const isInactive = !!(func.data_desligamento && dStr >= func.data_desligamento)

                            return (
                              <td
                                key={dStr}
                                onClick={(e) => {
                                  if (isInactive) {
                                    toast('Este colaborador está inativo/desligado a partir desta data.', 'info')
                                    return
                                  }
                                  handleCellClick(e, func.id, func.apelido || func.nome, dStr, format(day, "dd 'de' MMMM", { locale: ptBR }), escala?.tipo || null)
                                }}
                                className={cn(
                                   "border-b border-border/20 text-center transition-all p-1 relative",
                                   isT && "bg-primary/[0.08] dark:bg-primary/[0.05] border-x-transparent",
                                   isSun && "bg-rose-500/[0.18] dark:bg-rose-500/[0.12] border-x border-x-rose-500/20",
                                   feriado && "bg-purple-500/[0.18] dark:bg-purple-500/[0.12] border-x border-x-purple-500/20",
                                   canEdit && !isInactive && "cursor-pointer hover:bg-primary/[0.04]",
                                   isSelected && "bg-amber-500/20 shadow-[inset_0_0_0_2px_#f59e0b] ring-4 ring-amber-500/40 scale-90 z-20 animate-pulse relative",
                                   isInactive && "bg-rose-500/[0.03] dark:bg-rose-500/[0.01] opacity-50 cursor-not-allowed select-none"
                                 )}
                              >
                                {isInactive ? (
                                  <div className={cn(
                                    "mx-auto rounded-lg flex items-center justify-center font-black border border-rose-500/10 bg-rose-500/10 text-rose-600/85 text-[8px] tracking-widest",
                                    viewMode === 'month' ? 'w-7 h-7' : 'w-9 h-9 sm:w-11 sm:h-11'
                                  )}>
                                    DESL
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "mx-auto rounded-lg flex items-center justify-center font-black transition-all select-none border shadow-sm status-badge relative",
                                    viewMode === 'month' 
                                      ? 'w-7 h-7 text-[9px]' 
                                      : 'w-9 h-9 sm:w-11 sm:h-11 text-xs',
                                    tipo.bg, tipo.text,
                                    "border-black/5 hover:scale-105 active:scale-95"
                                  )}>
                                    {tipo.id === 'repouso' ? ((isSun || feriado) ? 'D' : 'R') : tipo.letra}
                                     {escala?.observacoes?.includes('[ADVERTÊNCIA]') && !isSharing && (
                                       <div 
                                         className={cn(
                                           "absolute bg-amber-500 text-white flex items-center justify-center rounded-full shadow-md border border-white dark:border-zinc-800 animate-in zoom-in-50 duration-150",
                                           viewMode === 'month' 
                                             ? "w-3.5 h-3.5 -bottom-1 -left-1 p-[1px]" 
                                             : "w-5 h-5 -bottom-1.5 -left-1.5 p-[1.5px]"
                                         )}
                                         title={escala.observacoes}
                                       >
                                         <AlertTriangle className="w-full h-full" strokeWidth={3.5} />
                                       </div>
                                     )}
                                     {escala?.observacoes && 
                                      !escala.observacoes.includes('[ADVERTÊNCIA]') && 
                                      !escala.observacoes.includes('[SUSPENSÃO]') && 
                                      escala.observacoes.trim() !== '' && 
                                      escala.observacoes !== 'Gerado automaticamente' && !isSharing && (
                                       <div 
                                         className={cn(
                                           "absolute bg-indigo-500 text-white flex items-center justify-center rounded-full shadow-md border border-white dark:border-zinc-800 animate-in zoom-in-50 duration-150",
                                           viewMode === 'month' 
                                             ? "w-3.5 h-3.5 -top-1 -right-1 p-[1px]" 
                                             : "w-5 h-5 -top-1.5 -right-1.5 p-[1.5px]"
                                         )}
                                         title={escala.observacoes}
                                       >
                                         <MessageCircle className="w-full h-full" strokeWidth={3} />
                                       </div>
                                     )}
                                    {isConfirmedPresent && !isSharing && (
                                      <div className={cn(
                                        "absolute bg-emerald-500 text-white flex items-center justify-center rounded-full shadow-md border border-white dark:border-zinc-800",
                                        viewMode === 'month' 
                                          ? "w-3.5 h-3.5 -bottom-1 -right-1 p-[1px]" 
                                          : "w-5 h-5 -bottom-1.5 -right-1.5 p-[1.5px]"
                                      )}>
                                        <Check className="w-full h-full" strokeWidth={6} />
                                      </div>
                                    )}
                                  </div>
                                )}
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

            {/* Continuous Side Shadows Overlay for Today Column */}
            {(() => {
              const todayIndex = days.findIndex(day => isToday(day))
              if (todayIndex !== -1 && columnWidths.length > todayIndex + 1) {
                let todayLeft = 0
                for (let i = 0; i < todayIndex + 1; i++) {
                  todayLeft += columnWidths[i] ?? 0
                }
                const todayWidth = columnWidths[todayIndex + 1] ?? 0
                
                return (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none z-10 transition-all duration-300 shadow-[8px_0_16px_-8px_rgba(0,0,0,0.06),-8px_0_16px_-8px_rgba(0,0,0,0.06)] dark:shadow-[8px_0_20px_-8px_rgba(0,0,0,0.22),-8px_0_20px_-8px_rgba(0,0,0,0.22)]"
                    style={{
                      left: `${todayLeft}px`,
                      width: `${todayWidth}px`
                    }}
                  />
                )
              }
              return null
            })()}
          </div>
        </div>

        {/* Dynamic Mobile and Desktop interaction hint */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.18em] text-center">
            {bulkMode 
              ? "Modo de lote: Toque nas células para selecionar e definir em massa"
              : "Toque nas células para abrir o menu rápido do Excel de status"
            }
          </p>
        </div>

        {/* Status Legend at the Bottom */}
        <div className="mt-6 pt-5 border-t border-border/25 flex flex-col items-center gap-3">
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Legenda de Status</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(tiposEscala || DEFAULT_TIPOS_ESCALA).map(t => {
              const mapped = STATUS_MAP[t.id] || t
              return (
                <div key={t.id} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/20 text-xs font-semibold shadow-inner", mapped.bg, mapped.text)}>
                  <span className="text-[10px] font-black tracking-tight">{mapped.letra}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-90">{mapped.nome}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* BACKDROP OVERLAY FOR MOBILE BOTTOM SHEET */}
      {activeCell && activeCell.rect && isMobile && (
        <div 
          className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setActiveCell(null)}
        />
      )}

      {/* QUICK STATUS POPOVER SELECTOR (EXCEL INSPIRED / RESPONSIVE DRAWER) */}
      {activeCell && activeCell.rect && (
        <div 
          id="quick-status-popover"
          className={cn(
            "fixed z-[100] bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-300 ring-1 ring-black/5 flex flex-col",
            isMobile 
              ? "bottom-0 left-0 right-0 w-full rounded-t-3xl border-t border-border/80 p-4 pb-6 animate-in slide-in-from-bottom duration-250"
              : "border border-border/80 rounded-2xl p-4 w-80 animate-in fade-in zoom-in-95 duration-150"
          )}
          style={isMobile ? undefined : {
            top: `${Math.min(window.innerHeight - 450, Math.max(10, activeCell.rect.bottom + window.scrollY - (typeof window !== 'undefined' ? window.pageYOffset : 0)))}px`,
            left: `${Math.min(window.innerWidth - 340, Math.max(10, activeCell.rect.left - 100))}px`
          }}
        >
          {/* Drag Indicator Handle only on Mobile */}
          {isMobile && (
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2 shrink-0" />
          )}

          {/* Popover Header */}
          <div className="pb-2 mb-2 border-b border-border/30 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-black text-foreground uppercase tracking-widest truncate">{activeCell.funcNome}</p>
              <p className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase mt-0.5">{activeCell.dateLabel}</p>
            </div>
            <button 
              onClick={() => setActiveCell(null)}
              className="w-6 h-6 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {/* 1. Scale Status (Tipo de Escala) */}
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1.5 flex items-center gap-1">
                <Grid className="w-3 h-3 text-primary" /> Status da Escala
              </p>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5 scrollbar-none">
                {(tiposEscala || DEFAULT_TIPOS_ESCALA).map(t => {
                  const active = activeCell.currentTipo === t.id
                  const mapped = STATUS_MAP[t.id] || t
                  return (
                    <button
                      key={t.id}
                      onClick={() => applySingleStatus(t.id)}
                      className={cn(
                        "flex flex-col items-center justify-center text-center p-1 rounded-xl h-[38px] transition-all hover:scale-[1.02] active:scale-95 border hover:shadow-sm cursor-pointer",
                        mapped.bg, mapped.text,
                        active ? "border-foreground ring-2 ring-primary" : "border-black/5"
                      )}
                    >
                      <span className="text-[10px] font-black leading-none">{mapped.letra}</span>
                      <span className="text-[6.5px] font-black opacity-75 uppercase tracking-wider mt-0.5 truncate max-w-full">{mapped.nome}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Frequency / Attendance Status */}
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1.5 flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-emerald-500" /> Presença / Chamada
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateCellFrequency('presente')}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer",
                    freqMap[`${activeCell.funcId}_${activeCell.dateStr}`] === 'presente' || freqMap[`${activeCell.funcId}_${activeCell.dateStr}`] === 'hora_extra'
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted/40 border-border/20 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20"
                  )}
                >
                  <Check className="w-3 h-3" /> Presente
                </button>
                <button
                  onClick={() => updateCellFrequency('falta')}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer",
                    freqMap[`${activeCell.funcId}_${activeCell.dateStr}`] === 'falta'
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                      : "bg-muted/40 border-border/20 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                  )}
                >
                  <X className="w-3 h-3" /> Falta
                </button>
                <button
                  onClick={() => updateCellFrequency(null)}
                  className="px-2.5 py-1.5 bg-muted/50 hover:bg-muted/80 border border-border/20 text-muted-foreground rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="Limpar chamada"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 3. Notes / Observations */}
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-indigo-500" /> Observações do Dia
                </span>
                {escalaMap[`${activeCell.funcId}_${activeCell.dateStr}`]?.observacoes && (
                  <span className="text-[7.5px] bg-indigo-500/10 text-indigo-600 px-1 py-0.2 rounded font-black tracking-normal uppercase">Possui nota</span>
                )}
              </p>
              <div className="flex gap-1.5 items-stretch">
                <input
                  type="text"
                  placeholder="Escreva uma observação..."
                  value={cellObservation}
                  onChange={(e) => setCellObservation(e.target.value)}
                  onBlur={() => saveCellObservation()}
                  className="flex-1 px-3 py-1.5 bg-muted/40 border border-border/20 focus:border-indigo-500/40 rounded-xl text-[10px] font-bold text-foreground placeholder:text-muted-foreground/45 outline-none transition-all focus:bg-card/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveCellObservation()
                      setActiveCell(null)
                      e.currentTarget.blur()
                    }
                  }}
                />
                {cellObservation && (
                  <button
                    onClick={() => {
                      setCellObservation('')
                      saveCellObservation('')
                      setActiveCell(null)
                    }}
                    className="px-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    title="Apagar observação"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    saveCellObservation()
                    setActiveCell(null)
                  }}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center shadow-md shadow-indigo-600/10 transition-all active:scale-95 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/30 flex gap-2">
            <button
              onClick={() => applySingleStatus(null)}
              className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Escala
            </button>
          </div>
        </div>
      )}



      {/* BULK SELECTION ACTIONS MODAL */}
      <Modal
        open={bulkStatusModal}
        onClose={() => setBulkStatusModal(false)}
        title="Definir Status em Lote"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground">
            Escolha o status que deseja aplicar a todas as <strong>{Object.keys(selectedCells).length}</strong> células selecionadas da grade:
          </p>

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {(tiposEscala || DEFAULT_TIPOS_ESCALA).map(t => (
              <button
                key={t.id}
                onClick={() => applyBulkStatus(t.id)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-2xl border text-left text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-sm",
                  t.bg, t.text, "border-black/5"
                )}
              >
                <span>{t.nome}</span>
                <span>{t.letra}</span>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-border/30 flex gap-2">
            <button
              onClick={() => applyBulkStatus(null)}
              className="flex-1 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Limpar Escalas Selecionadas
            </button>
            <button
              onClick={() => setBulkStatusModal(false)}
              className="px-5 py-3.5 bg-muted/60 hover:bg-muted text-muted-foreground rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
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
          <Button 
            variant="secondary" 
            className="w-full text-[10px] font-black uppercase tracking-wider rounded-2xl py-3.5" 
            onClick={() => {
              specialDayConfirm?.onCancel()
              setSpecialDayConfirm(null)
            }}
          >
            Cancelar Seleção
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            {specialDayConfirm?.description}
          </p>

          <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Contexto</p>
              <p className="text-xs font-black text-foreground uppercase tracking-tight mt-1">{specialDayConfirm?.dateLabel}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="w-6 h-6 rounded-lg text-[9px] font-black uppercase bg-emerald-500 text-white flex items-center justify-center border border-black/5 shadow-sm">T</span>
              <span className="w-6 h-6 rounded-lg text-[9px] font-black uppercase bg-blue-500 text-white flex items-center justify-center border border-black/5 shadow-sm">HE</span>
            </div>
          </div>

          <div className="flex justify-center gap-8 py-4">
            <button
              onClick={() => {
                specialDayConfirm?.onConfirmTrabalho()
                setSpecialDayConfirm(null)
              }}
              className="flex flex-col items-center gap-2.5 group focus:outline-none"
            >
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center font-black text-lg shadow-md border transition-all hover:scale-110 active:scale-95",
                STATUS_MAP['presente']?.bg || 'bg-emerald-500', 
                STATUS_MAP['presente']?.text || 'text-white',
                "border-black/5"
              )}>
                T
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-all">
                Trabalho (T)
              </span>
            </button>

            <button
              onClick={() => {
                specialDayConfirm?.onConfirmHE()
                setSpecialDayConfirm(null)
              }}
              className="flex flex-col items-center gap-2.5 group focus:outline-none"
            >
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center font-black text-lg shadow-md border transition-all hover:scale-110 active:scale-95",
                STATUS_MAP['hora_extra']?.bg || 'bg-blue-500', 
                STATUS_MAP['hora_extra']?.text || 'text-white',
                "border-black/5"
              )}>
                HE
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-all">
                Hora Extra (HE)
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ELABORATE SCALE SHARING FILTERS CONFIGURATION MODAL */}
      <Modal
        open={shareFilterModalOpen}
        onClose={() => setShareFilterModalOpen(false)}
        title="Configurar Exportação de Imagem"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
            Selecione as equipes ou colaboradores específicos que deseja exibir na imagem da escala de trabalho. A imagem se ajustará automaticamente ao tamanho do grupo selecionado.
          </p>

          {/* Quick Actions & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAllShare}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Selecionar Todos
              </button>
              <button
                type="button"
                onClick={handleClearAllShare}
                className="px-3 py-1.5 bg-muted/60 hover:bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Limpar Seleção
              </button>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
              {selectedShareFuncs.length} de {funcionarios.length} selecionados
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input 
              type="text" 
              placeholder="Pesquisar funcionário no filtro..." 
              value={shareFilterSearchTerm}
              onChange={e => setShareFilterSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border/50 rounded-xl text-xs font-bold focus:ring-0 focus:border-primary outline-none"
            />
          </div>

          {/* Collapsible Teams & Employees Checklist */}
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {equipesList.map(eq => {
              const visibleMembers = eq.membros.map((mId: string) => funcionarios.find(f => f.id === mId)).filter(Boolean)
              const filteredMembers = visibleMembers.filter((f: any) => {
                if (!shareFilterSearchTerm) return true
                const term = shareFilterSearchTerm.toLowerCase()
                return f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
              })
              
              if (filteredMembers.length === 0) return null
              
              const fullySel = isTeamFullySelected(eq.id, eq.membros)
              const partSel = isTeamPartiallySelected(eq.id, eq.membros)
              
              return (
                <div key={eq.id} className="border border-border/40 rounded-2xl overflow-hidden bg-muted/10">
                  {/* Team Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/30">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={fullySel}
                        ref={el => {
                          if (el) el.indeterminate = partSel
                        }}
                        onChange={() => handleToggleTeam(eq.id, eq.membros)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: eq.cor }} />
                        <span className="text-xs font-black uppercase tracking-wider text-foreground">{eq.nome}</span>
                      </div>
                    </label>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      {filteredMembers.length} {filteredMembers.length === 1 ? 'Membro' : 'Membros'}
                    </span>
                  </div>
                  {/* Team Members List */}
                  <div className="p-2 divide-y divide-border/20 max-h-[160px] overflow-y-auto">
                    {filteredMembers.map((func: any) => {
                      const isSel = selectedShareFuncs.includes(func.id)
                      return (
                        <label key={func.id} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-card/50 px-2 rounded-xl transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={isSel}
                            onChange={() => handleToggleFunc(func.id)}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-foreground block truncate">{func.nome}</span>
                            {func.apelido && <span className="text-[9px] font-semibold text-muted-foreground block">{func.apelido}</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            
            {/* Sem Equipe Section */}
            {noTeamFuncs.length > 0 && (() => {
              const filteredNoTeam = noTeamFuncs.filter(f => {
                if (!shareFilterSearchTerm) return true
                const term = shareFilterSearchTerm.toLowerCase()
                return f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
              })
              
              if (filteredNoTeam.length === 0) return null
              
              const noTeamIds = noTeamFuncs.map(f => f.id)
              const fullySel = isTeamFullySelected('no-team', noTeamIds)
              const partSel = isTeamPartiallySelected('no-team', noTeamIds)
              
              return (
                <div className="border border-border/40 rounded-2xl overflow-hidden bg-muted/10">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/30">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={fullySel}
                        ref={el => {
                          if (el) el.indeterminate = partSel
                        }}
                        onChange={() => handleToggleTeam('no-team', noTeamIds)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Sem Equipe</span>
                    </label>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      {filteredNoTeam.length} {filteredNoTeam.length === 1 ? 'Membro' : 'Membros'}
                    </span>
                  </div>
                  <div className="p-2 divide-y divide-border/20 max-h-[160px] overflow-y-auto">
                    {filteredNoTeam.map(func => {
                      const isSel = selectedShareFuncs.includes(func.id)
                      return (
                        <label key={func.id} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-card/50 px-2 rounded-xl transition-all select-none">
                          <input 
                            type="checkbox" 
                            checked={isSel}
                            onChange={() => handleToggleFunc(func.id)}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-foreground block truncate">{func.nome}</span>
                            {func.apelido && <span className="text-[9px] font-semibold text-muted-foreground block">{func.apelido}</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-border/30 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (selectedShareFuncs.length === 0) {
                  toast('Selecione pelo menos um colaborador para gerar a imagem.', 'warning')
                  return
                }
                setShareFilterModalOpen(false)
                const funcsToExport = funcionarios.filter(f => selectedShareFuncs.includes(f.id))
                handleShare(funcsToExport)
              }}
              className="flex-1 py-3.5 bg-primary hover:bg-primary/95 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/10"
            >
              <Share2 className="w-4 h-4" /> Gerar Imagem da Escala
            </button>
            <button
              type="button"
              onClick={() => setShareFilterModalOpen(false)}
              className="px-5 py-3.5 bg-muted/60 hover:bg-muted text-muted-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* ELABORATE & PROFESSIONAL SCALE SHARING SYSTEM MODAL */}
      <Modal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Compartilhar Escala"
      >
        <div className="space-y-6">
          <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
            Imagem gerada com sucesso! Escolha uma das opções abaixo para compartilhar ou salvar a escala de trabalho:
          </p>

          {/* Visual Preview Container */}
          <div className="relative w-full aspect-[16/10] rounded-[2rem] overflow-auto border border-border/80 bg-muted/30 flex items-center justify-center group shadow-md transition-all hover:border-primary/20">
            {shareImageUrl ? (
              <div className="p-4 flex items-center justify-center min-w-full min-h-full">
                <img 
                  src={shareImageUrl} 
                  alt="Prévia da Escala" 
                  style={{ 
                    transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg origin-center"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-wider">Carregando prévia...</span>
              </div>
            )}

            {shareImageUrl && (
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md p-1.5 rounded-xl flex items-center gap-1 z-20 shadow-lg border border-white/5">
                <button
                  onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.25))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                  title="Zoom +"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                  title="Zoom -"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotationAngle(r => (r + 90) % 360)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                  title="Girar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1.0)
                    setRotationAngle(0)
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                  title="Resetar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/90 z-20">
              HD PREVIEW
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* WhatsApp Integration */}
            <button
              onClick={() => {
                const isWeekly = viewMode === 'week'
                const startOfCurrentWeek = isWeekly ? days[0] : currentDate
                const shareText = isWeekly
                  ? `Segue a Escala Geral Semanal (Semana de ${format(startOfCurrentWeek, 'dd/MM')} a ${format(days[6], 'dd/MM/yyyy')}).`
                  : `Confira a escala de plantões e folgas de ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}.`
                
                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
                window.open(url, '_blank')
                toast('Mensagem pronta! Agora cole a imagem copiada no chat.', 'success')
              }}
              className="h-14 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-emerald-500/5 group"
            >
              <MessageCircle className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span>Enviar via WhatsApp</span>
            </button>

            {/* Copy to Clipboard */}
            <button
              onClick={async () => {
                if (!shareImageBlob) return
                try {
                  await navigator.clipboard.write([
                    new ClipboardItem({ [shareImageBlob.type]: shareImageBlob })
                  ])
                  setIsCopied(true)
                  toast('Imagem copiada para a área de transferência!', 'success')
                  setTimeout(() => setIsCopied(false), 2000)
                } catch (err) {
                  console.error('Failed to copy image:', err)
                  toast('Cópia não suportada. Use o download ou o compartilhamento do sistema.', 'warning')
                }
              }}
              className={cn(
                "h-14 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 hover:scale-[1.03] active:scale-[0.97] shadow-sm group",
                isCopied 
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/40 border-border/40 hover:bg-muted/70 text-foreground"
              )}
            >
              {isCopied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-500 animate-bounce" />
                  <span>Copiado para Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                  <span>Copiar Imagem</span>
                </>
              )}
            </button>

            {/* Direct Jpeg Download */}
            <button
              onClick={() => {
                if (!shareImageUrl) return
                const link = document.createElement('a')
                link.download = shareFileName
                link.href = shareImageUrl
                link.click()
                toast('Download concluído!', 'success')
              }}
              className="h-14 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border/40 text-foreground font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 hover:scale-[1.03] active:scale-[0.97] shadow-sm group"
            >
              <Download className="w-5 h-5 text-muted-foreground group-hover:scale-110 transition-transform" />
              <span>Baixar Imagem</span>
            </button>

            {/* Native OS/System Share */}
            <button
              onClick={async () => {
                if (!shareImageBlob) return
                try {
                  const file = new File([shareImageBlob], shareFileName, { type: shareImageBlob.type })
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                      files: [file],
                      title: viewMode === 'week' ? 'Escala Semanal' : 'Escala Mensal',
                      text: 'Segue a Escala de Trabalho.'
                    })
                    toast('Compartilhado com sucesso!', 'success')
                  } else {
                    toast('Navegador sem suporte a compartilhamento direto. Faça o download da imagem.', 'warning')
                  }
                } catch (err: any) {
                  if (err.name !== 'AbortError' && err.message !== 'Share canceled') {
                    console.error('System share error:', err)
                    toast('Erro ao compartilhar: ' + err.message, 'error')
                  }
                }
              }}
              className="h-14 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-primary/5 group"
            >
              <Share2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span>Compartilhar (Sistema)</span>
            </button>
          </div>

          {/* Metadata information block */}
          <div className="pt-4 border-t border-border/30 flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Formato: JPEG</span>
            <span>Resolução: Alta Fidelidade (2x)</span>
          </div>
        </div>
      </Modal>

    </div>
  )
}
