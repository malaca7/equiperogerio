import React, { useState, useRef, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { TopHeader } from '../components/layout/TopHeader'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { cn } from '../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { 
  Users, Shield, MapPin, Share2, FileText, Wrench, Briefcase, 
  Sparkles, Truck, User, Hammer, MessageSquare, Plus, Trash2, 
  Save, Download, Copy, Calendar, Eye, EyeOff, LayoutGrid, Check,
  Printer
} from 'lucide-react'

interface ModeloRelatorio {
  id: string
  nome: string
  equipe_id: string
  report_title: string
  show_metrics: boolean
  show_localities: boolean
  show_observations: boolean
  show_inactives: boolean
  show_roles: boolean
  observations: Record<string, string>
  created_at?: string
  updated_at?: string
}

export function GerarRelatorioPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: teamInfo, isLoading: isLoadingTeamInfo } = useUserTeam()
  
  const isRestricted = teamInfo?.isRestricted ?? false
  const allowedTeamIds = teamInfo?.teamIds ?? []

  // Component states
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('')
  
  // Template settings states
  const [reportTitle, setReportTitle] = useState('RELATÓRIO DIÁRIO OPERACIONAL')
  const [showMetrics, setShowMetrics] = useState(true)
  const [showLocalities, setShowLocalities] = useState(true)
  const [showObservations, setShowObservations] = useState(true)
  const [showInactives, setShowInactives] = useState(false)
  const [showRoles, setShowRoles] = useState(true)
  const [observations, setObservations] = useState<Record<string, string>>({})
  
  // UI States
  const [newTemplateName, setNewTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isSavingNew, setIsSavingNew] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const shareSquareRef = useRef<HTMLDivElement>(null)

  // Fetch all teams
  const { data: equipes = [], isLoading: isLoadingEquipes } = useQuery<any[]>({
    queryKey: ['equipes-relatorio'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    }
  })

  // Filter team options based on restriction
  const availableEquipes = useMemo(() => {
    if (isRestricted) {
      return equipes.filter(eq => allowedTeamIds.includes(eq.id))
    }
    return equipes
  }, [equipes, isRestricted, allowedTeamIds])

  // Set default team
  useEffect(() => {
    if (availableEquipes.length > 0 && !selectedTeamId) {
      setSelectedTeamId(availableEquipes[0].id)
    }
  }, [availableEquipes, selectedTeamId])

  // Fetch team members
  const { data: dbSetoresEquipes = {} } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios()

  const { data: selectedTeamMemberIds = [], isLoading: isLoadingMembrosIds } = useQuery<string[]>({
    queryKey: ['equipe-membros-relatorio', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return []
      const { data } = await supabase
        .from('equipe_membros')
        .select('funcionario_id')
        .eq('equipe_id', selectedTeamId)
      return (data || []).map((m: any) => m.funcionario_id)
    },
    enabled: !!selectedTeamId
  })

  const membros = useMemo(() => {
    let list = allFuncionarios
    if (isRestricted) {
      return list.filter(f => teamInfo?.teamMemberIds.includes(f.id))
    }
    if (selectedTeamId) {
      const allowedSectors = dbSetoresEquipes[selectedTeamId] || []
      return list.filter(f => 
        selectedTeamMemberIds.includes(f.id) ||
        (f.setor && allowedSectors.includes(f.setor))
      )
    }
    return list
  }, [allFuncionarios, selectedTeamId, selectedTeamMemberIds, isRestricted, teamInfo, dbSetoresEquipes])

  const isLoadingMembros = loadF || isLoadingMembrosIds

  // Fetch saved models/templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery<ModeloRelatorio[]>({
    queryKey: ['modelos-relatorio', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return []
      const { data } = await supabase
        .from('modelos_relatorio')
        .select('*')
        .eq('equipe_id', selectedTeamId)
        .order('nome')
      return data || []
    },
    enabled: !!selectedTeamId
  })

  // Fetch today's attendance
  const { data: frequencias = [] } = useQuery<any[]>({
    queryKey: ['frequencia-relatorio', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('frequencia')
        .select('funcionario_id, status, justificativa')
        .eq('data', selectedDate)
      return data || []
    }
  })

  // Fetch today's allocations
  const { data: escalas = [] } = useQuery<any[]>({
    queryKey: ['escalas-relatorio', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('escalas')
        .select('id, funcionario_id, localidade, tipo, turno, observacoes')
        .eq('data', selectedDate)
      return data || []
    }
  })

  const isTemplateModified = useMemo(() => {
    if (!currentTemplateId) return false
    const t = templates.find(item => item.id === currentTemplateId)
    if (!t) return false
    return (
      t.report_title !== reportTitle ||
      t.show_metrics !== showMetrics ||
      t.show_localities !== showLocalities ||
      t.show_observations !== showObservations ||
      t.show_inactives !== showInactives ||
      t.show_roles !== showRoles
    )
  }, [currentTemplateId, templates, reportTitle, showMetrics, showLocalities, showObservations, showInactives, showRoles])

  // Sync database observations to local state when escalas changes
  useEffect(() => {
    const dailyObs: Record<string, string> = {}
    escalas.forEach(e => {
      if (e.observacoes) {
        dailyObs[e.funcionario_id] = e.observacoes
      }
    })
    setObservations(dailyObs)
  }, [escalas])

  // Helper to reset observations back to escalas daily defaults
  const resetObservationsFromEscalas = () => {
    const dailyObs: Record<string, string> = {}
    escalas.forEach(e => {
      if (e.observacoes) {
        dailyObs[e.funcionario_id] = e.observacoes
      }
    })
    setObservations(dailyObs)
  }

  // Save employee observation to database on blur
  const handleSaveObs = async (funcId: string, value: string) => {
    try {
      const existing = escalas.find(e => e.funcionario_id === funcId)
      if (existing) {
        const { error } = await supabase
          .from('escalas')
          .update({ observacoes: value || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('escalas')
          .insert({
            funcionario_id: funcId,
            data: selectedDate,
            tipo: 'presente',
            turno: 'integral',
            observacoes: value || null
          })
        if (error) throw error
      }
      queryClient.invalidateQueries({ queryKey: ['escalas-relatorio', selectedDate] })
    } catch (err: any) {
      toast('Erro ao salvar observação: ' + err.message, 'error')
    }
  }

  // Filter members based on 'showInactives' toggle
  const filteredMembros = useMemo(() => {
    return membros.filter(m => showInactives ? true : m.status === 'ativo')
  }, [membros, showInactives])

  // Group members by sector
  const membersBySector = useMemo(() => {
    const groups: Record<string, typeof filteredMembros> = {}
    filteredMembros.forEach(m => {
      const sector = m.setor || 'Geral'
      if (!groups[sector]) {
        groups[sector] = []
      }
      groups[sector].push(m)
    })
    return groups
  }, [filteredMembros])

  // Attendance stats for selected team
  const stats = useMemo(() => {
    if (membros.length === 0) return { total: 0, present: 0, absent: 0, rate: 0 }
    const activeMembers = membros.filter(m => m.status === 'ativo')
    const activeIds = activeMembers.map(m => m.id)
    
    // Count attendances for this team today
    const teamFreqs = frequencias.filter(f => activeIds.includes(f.funcionario_id))
    const presentCount = teamFreqs.filter(f => f.status === 'presente' || f.status === 'trabalhou').length
    const absentCount = activeMembers.length - presentCount

    const rate = activeMembers.length > 0 ? Math.round((presentCount / activeMembers.length) * 100) : 0
    return {
      total: activeMembers.length,
      present: presentCount,
      absent: absentCount,
      rate
    }
  }, [membros, frequencias])

  // Load a selected template config
  const handleApplyTemplate = (templateId: string) => {
    if (!templateId) {
      // Reset to defaults
      setCurrentTemplateId('')
      setReportTitle('RELATÓRIO DIÁRIO OPERACIONAL')
      setShowMetrics(true)
      setShowLocalities(true)
      setShowObservations(true)
      setShowInactives(false)
      setShowRoles(true)
      resetObservationsFromEscalas()
      return
    }

    const t = templates.find(item => item.id === templateId)
    if (t) {
      setCurrentTemplateId(t.id)
      setReportTitle(t.report_title)
      setShowMetrics(t.show_metrics)
      setShowLocalities(t.show_localities)
      setShowObservations(t.show_observations)
      setShowInactives(t.show_inactives)
      setShowRoles(t.show_roles)
      if (t.observations && Object.keys(t.observations).length > 0) {
        setObservations(prev => ({
          ...t.observations,
          ...prev // Daily observations from scales take priority
        }))
      }
      toast(`Configuração "${t.nome}" carregada!`, 'success')
    }
  }

  // Save changes to current template or save as a new one
  const handleSaveTemplate = async (isNew: boolean) => {
    if (!selectedTeamId) return
    
    if (isNew && !newTemplateName.trim()) {
      toast('Insira o nome do modelo para salvar.', 'warning')
      return
    }

    const name = isNew ? newTemplateName.trim() : templates.find(t => t.id === currentTemplateId)?.nome
    if (!name) return

    if (isNew) setIsSavingNew(true);
    else setIsSavingTemplate(true);

    try {
      const payload: Partial<ModeloRelatorio> = {
        nome: name,
        equipe_id: selectedTeamId,
        report_title: reportTitle,
        show_metrics: showMetrics,
        show_localities: showLocalities,
        show_observations: showObservations,
        show_inactives: showInactives,
        show_roles: showRoles,
        observations: observations || {}, // Save current layout state notes in template
        updated_at: new Date().toISOString()
      }

      if (!isNew && currentTemplateId) {
        payload.id = currentTemplateId
      }

      const { data, error } = await supabase
        .from('modelos_relatorio')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      toast(isNew ? `Modelo "${name}" criado com sucesso!` : 'Alterações do modelo salvas!', 'success')
      
      await refetchTemplates()
      
      if (isNew) {
        if (data) setCurrentTemplateId(data.id)
        setNewTemplateName('')
        setSaveModalOpen(false)
      }
    } catch (err: any) {
      toast('Erro ao salvar modelo: ' + err.message, 'error')
    } finally {
      setIsSavingNew(false)
      setIsSavingTemplate(false)
    }
  }

  // Delete a saved template
  const handleDeleteTemplate = async (id: string) => {
    if (!id || !confirm('Deseja realmente excluir este modelo de relatório?')) return
    try {
      const { error } = await supabase
        .from('modelos_relatorio')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast('Modelo excluído com sucesso!', 'success')
      
      if (currentTemplateId === id) {
        handleApplyTemplate('')
      }
      refetchTemplates()
    } catch (err: any) {
      toast('Erro ao excluir modelo: ' + err.message, 'error')
    }
  }

  // Handle single employee observation change
  const handleObsChange = (funcId: string, value: string) => {
    setObservations(prev => ({
      ...prev,
      [funcId]: value
    }))
  }

  // Generate image and trigger sharing/download
  // Generate image and trigger sharing/download
  const handleExport = async (action: 'share' | 'copy' | 'download') => {
    if (!shareSquareRef.current) return
    const isDark = document.documentElement.classList.contains('dark')
    toast('Preparando documento para renderização...', 'info')
    setIsExporting(true)

    // Small delay to ensure inputs are converted to static divs
    await new Promise(r => setTimeout(r, 150))

    try {
      // Temporarily remove shadow classes from rendering
      shareSquareRef.current.classList.add('no-shadows')
      
      const { toBlob } = await import('html-to-image')
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const renderOptions = {
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
        pixelRatio: isMobile ? 1 : 2,
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
          try { await toBlob(shareSquareRef.current, { ...renderOptions, pixelRatio: 1 }) } catch (_) {}
        }
        blob = await toBlob(shareSquareRef.current, renderOptions)
      } catch (firstErr) {
        console.warn('First render failed, retrying with simple options...', firstErr)
        blob = await toBlob(shareSquareRef.current, {
          backgroundColor: isDark ? '#0b0f19' : '#ffffff',
          pixelRatio: 1,
          skipFonts: true,
          cacheBust: true,
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
      
      shareSquareRef.current.classList.remove('no-shadows')
      
      if (!blob) {
        throw new Error('A renderização do canvas falhou (retornou null).')
      }

      const currentTeamName = equipes.find(eq => eq.id === selectedTeamId)?.nome || 'Equipe'
      // Sanitize team name for safe filenames in native share sheet (no spaces, special characters or accents)
      const cleanTeamName = currentTeamName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
      
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
      const fileName = `relatorio-${cleanTeamName}-${selectedDate}.${ext}`
      const file = new File([blob], fileName, { type: blob.type })

      if (action === 'share') {
        const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
        if (canShare) {
          try {
            await navigator.share({
              title: reportTitle,
              text: `Relatório operacional da equipe ${currentTeamName} - Data: ${selectedDate}`,
              files: [file]
            })
            toast('Relatório compartilhado com sucesso!', 'success')
            setIsExporting(false)
            return
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              setIsExporting(false)
              return
            }
            console.error('Navigator share error, falling back to download', shareErr)
          }
        }
      }

      if (action === 'copy' && navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ])
          toast('Imagem copiada! Cole (Ctrl+V) onde desejar.', 'success')
          setIsExporting(false)
          return
        } catch (clipErr) {
          console.error('Clipboard copy error', clipErr)
        }
      }

      // Default to download (uses URL.createObjectURL which is safe on mobile and desktop)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = objectUrl
      link.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      toast('Download concluído!', 'success')
    } catch (err: any) {
      if (shareSquareRef.current) {
        shareSquareRef.current.classList.remove('no-shadows')
      }
      console.error('Failed to export image', err)
      toast('Erro ao gerar relatório: ' + err.message, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const getSectorColors = (setor?: string) => {
    const s = (setor || '').toLowerCase()
    if (s.includes('op') || s.includes('prod') || s.includes('fabr') || s.includes('varr')) {
      return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' } // blue
    }
    if (s.includes('adm') || s.includes('escrit') || s.includes('finan') || s.includes('rh') || s.includes('gest')) {
      return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' } // green
    }
    if (s.includes('limp') || s.includes('serv') || s.includes('conserv') || s.includes('geral')) {
      return { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' } // purple
    }
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' } // gray
  }

  const getSectorIcon = (setor?: string) => {
    const s = (setor || '').toLowerCase()
    if (s.includes('varr') || s.includes('limp') || s.includes('serv')) return Sparkles
    if (s.includes('adm') || s.includes('gest')) return Briefcase
    if (s.includes('op') || s.includes('mecan')) return Hammer
    return User
  }

  const getMemberAttendanceStatus = (memberId: string) => {
    const freq = frequencias.find(f => f.funcionario_id === memberId)
    if (!freq) return { label: 'Sem Registro', color: 'text-gray-400 bg-gray-100 dark:bg-gray-800 print-badge-default' }
    
    switch (freq.status) {
      case 'presente':
      case 'trabalhou':
        return { label: 'Presente', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 print-badge-presente' }
      case 'falta':
        return { label: 'Falta', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 print-badge-falta' }
      case 'folga':
        return { label: 'Folga', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 print-badge-folga' }
      case 'atestado':
        return { label: 'Atestado', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20 print-badge-atestado' }
      case 'ferias':
        return { label: 'Férias', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 print-badge-ferias' }
      default:
        return { label: freq.status, color: 'text-gray-600 bg-gray-50 print-badge-default' }
    }
  }

  // Enhanced UI & Mode States
  const [viewTab, setViewTab] = useState<'texto' | 'a4'>('texto')
  const [textFormatStyle, setTextFormatStyle] = useState<'completo' | 'executivo' | 'ocorrencias'>('completo')
  const [showSignatures, setShowSignatures] = useState(true)
  const [companyHeaderName, setCompanyHeaderName] = useState('7LOCAR GESTÃO DE EQUIPES OPERACIONAIS')

  // Generate formatted WhatsApp report text with emojis & markdown formatting
  const generateWhatsAppText = useMemo(() => {
    const currentTeam = equipes.find(eq => eq.id === selectedTeamId)
    const teamName = currentTeam?.nome || 'Equipe'
    const dateFormatted = format(parseISO(selectedDate), "dd/MM/yyyy", { locale: ptBR })

    let lines: string[] = []

    // 1) FORMATO EXECUTIVO RÁPIDO
    if (textFormatStyle === 'executivo') {
      lines.push(`📊 *RESUMO EXECUTIVO OPERACIONAL*`)
      lines.push(`🏢 *Empresa:* ${companyHeaderName}`)
      lines.push(`👥 *Equipe:* ${teamName}`)
      lines.push(`📅 *Data:* ${dateFormatted}`)
      lines.push(``)
      lines.push(`📈 *INDICADORES DE DESEMPENHO:*`)
      lines.push(`• *Efetivo Total:* ${stats.total} colaboradores`)
      lines.push(`• ✅ *Presentes:* ${stats.present} (${stats.rate}%)`)
      lines.push(`• ❌ *Ausentes/Ocorrências:* ${stats.absent}`)
      lines.push(`• 📌 *Setores Ativos:* ${Object.keys(membersBySector).length}`)
      lines.push(``)
      lines.push(`📌 *DISTRIBUIÇÃO POR SETOR:*`)
      Object.entries(membersBySector).forEach(([sector, funcs]) => {
        const presentInSector = funcs.filter(m => {
          const st = getMemberAttendanceStatus(m.id).label
          return st === 'Presente' || st === 'Sem Registro'
        }).length
        lines.push(`• *${sector.toUpperCase()}:* ${presentInSector}/${funcs.length} presentes`)
      })
      lines.push(``)
      lines.push(`📱 _Gerado via 7Locar - Gestão de Equipes_`)
      return lines.join('\n')
    }

    // 2) FORMATO OCORRÊNCIAS / AUSÊNCIAS
    if (textFormatStyle === 'ocorrencias') {
      lines.push(`⚠️ *RELATÓRIO DE AUSÊNCIAS E OCORRÊNCIAS*`)
      lines.push(`👥 *Equipe:* ${teamName} | 📅 *Data:* ${dateFormatted}`)
      lines.push(``)
      const absentMembers = filteredMembros.filter(m => {
        const st = getMemberAttendanceStatus(m.id).label
        return st !== 'Presente' && st !== 'Sem Registro'
      })
      if (absentMembers.length === 0) {
        lines.push(`✅ *NENHUMA AUSÊNCIA OU DIVERGÊNCIA REGISTRADA.*`)
        lines.push(`Efetivo 100% presente no dia.`)
      } else {
        lines.push(`📍 *LISTA DE OCORRÊNCIAS (${absentMembers.length}):*`)
        absentMembers.forEach((m, idx) => {
          const st = getMemberAttendanceStatus(m.id)
          const obs = observations[m.id]
          let icon = '❌'
          if (st.label === 'Folga') icon = '🏖️'
          else if (st.label === 'Atestado') icon = '🏥'
          else if (st.label === 'Férias') icon = '✈️'

          let line = `${idx + 1}. ${icon} *${m.nome}*`
          if (m.cargo) line += ` _(${m.cargo})_`
          line += ` — *[${st.label.toUpperCase()}]*`
          lines.push(line)
          if (obs) lines.push(`   📝 _Obs: ${obs}_`)
        })
      }
      lines.push(``)
      lines.push(`📱 _Gerado via 7Locar - Gestão de Equipes_`)
      return lines.join('\n')
    }

    // 3) FORMATO COMPLETO OPERACIONAL (DEFAULT)
    lines.push(`📋 *${(reportTitle || 'RELATÓRIO DIÁRIO OPERACIONAL').toUpperCase()}*`)
    lines.push(`🏢 *Empresa:* ${companyHeaderName}`)
    lines.push(`📅 *Data:* ${dateFormatted} | 👥 *Equipe:* ${teamName}`)
    lines.push(``)

    if (showMetrics) {
      lines.push(`📊 *RESUMO DE PRESENÇA*`)
      lines.push(`• *Efetivo Total:* ${stats.total} colaboradores`)
      lines.push(`• ✅ *Presentes:* ${stats.present} (${stats.rate}%)`)
      lines.push(`• ❌ *Ausentes/Divergências:* ${stats.absent}`)
      lines.push(``)
    }

    lines.push(`─────────────────────────────`)

    Object.entries(membersBySector).forEach(([sector, funcs]) => {
      let sectorEmoji = '🧹'
      const sLower = sector.toLowerCase()
      if (sLower.includes('orla') || sLower.includes('praia')) sectorEmoji = '🌊'
      else if (sLower.includes('porta') || sLower.includes('coleta')) sectorEmoji = '🚛'
      else if (sLower.includes('adm') || sLower.includes('gest')) sectorEmoji = '💼'
      else if (sLower.includes('capin') || sLower.includes('roçad')) sectorEmoji = '🌾'

      lines.push(``)
      lines.push(`${sectorEmoji} *${sector.toUpperCase()}* (${funcs.length})`)

      funcs.forEach(m => {
        const statusInfo = getMemberAttendanceStatus(m.id)
        const escala = escalas.find(e => e.funcionario_id === m.id)
        const obs = observations[m.id]

        let statusIcon = '✅'
        if (statusInfo.label === 'Falta') statusIcon = '❌'
        else if (statusInfo.label === 'Folga') statusIcon = '🏖️'
        else if (statusInfo.label === 'Atestado') statusIcon = '🏥'
        else if (statusInfo.label === 'Férias') statusIcon = '✈️'
        else if (statusInfo.label === 'Sem Registro') statusIcon = '⚪'

        let memberLine = `${statusIcon} *${m.nome}*`

        if (showRoles && m.cargo) {
          memberLine += ` _(${m.cargo})_`
        }

        if (showLocalities && escala?.localidade) {
          memberLine += ` 📍 *${escala.localidade}*`
        }

        if (statusInfo.label !== 'Presente' && statusInfo.label !== 'Sem Registro') {
          memberLine += ` ~[${statusInfo.label}]~`
        }

        lines.push(memberLine)

        if (showObservations && obs) {
          lines.push(`   📝 _Obs: ${obs}_`)
        }
      })
    })

    const absentMembers = filteredMembros.filter(m => {
      const st = getMemberAttendanceStatus(m.id).label
      return st !== 'Presente' && st !== 'Sem Registro'
    })

    if (absentMembers.length > 0) {
      lines.push(``)
      lines.push(`─────────────────────────────`)
      lines.push(`⚠️ *OCORRÊNCIAS / AUSÊNCIAS DIÁRIAS*`)
      absentMembers.forEach(m => {
        const st = getMemberAttendanceStatus(m.id)
        let icon = '❌'
        if (st.label === 'Folga') icon = '🏖️'
        else if (st.label === 'Atestado') icon = '🏥'
        else if (st.label === 'Férias') icon = '✈️'
        lines.push(`${icon} *${m.nome}* — *${st.label.toUpperCase()}*`)
      })
    }

    lines.push(``)
    lines.push(`📱 _Gerado via 7Locar - Gestão de Equipes_`)

    return lines.join('\n')
  }, [selectedTeamId, selectedDate, reportTitle, showMetrics, showLocalities, showObservations, showRoles, stats, membersBySector, filteredMembros, equipes, escalas, observations, frequencias, textFormatStyle, companyHeaderName])

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(generateWhatsAppText)
    setCopiedText(true)
    toast('Relatório em formato de texto com emojis copiado para a área de transferência!', 'success')
    setTimeout(() => setCopiedText(false), 3000)
  }

  const handleSendWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(generateWhatsAppText)}`
    window.open(url, '_blank')
  }

  if (isLoadingTeamInfo || isLoadingEquipes || isLoadingMembros) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Gerar Relatório" />
        <div className="pt-32 pb-20 flex justify-center">
          <Loading text="Carregando dados operacionais..." />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pt-28 sm:pt-32 pb-32">
      <TopHeader 
        title="Gerar Relatório de Equipe" 
        subtitle="Dossiê Operacional, Formato Texto WhatsApp e Impressão Folha A4" 
      />

      {/* DUAL MODE SELECTOR TAB BAR */}
      <div className="px-4">
        <div className="bg-card/90 backdrop-blur-2xl border border-border/60 rounded-3xl p-3 shadow-md flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 p-1.5 bg-muted/60 rounded-2xl">
            <button
              type="button"
              onClick={() => setViewTab('texto')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer",
                viewTab === 'texto'
                  ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-4 h-4" /> 📱 Formato Texto (WhatsApp / Copiar)
            </button>
            <button
              type="button"
              onClick={() => setViewTab('a4')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer",
                viewTab === 'a4'
                  ? "bg-gradient-to-r from-primary via-indigo-600 to-primary text-white shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Printer className="w-4 h-4" /> 📄 Formato Folha A4 (Imprimir / PDF)
            </button>
          </div>

          <div className="flex items-center gap-3 px-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" /> Total Efetivo:
              <strong className="text-foreground font-black">{stats.total}</strong>
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              • {stats.present} Presentes ({stats.rate}%)
            </span>
          </div>

        </div>
      </div>

      <div className="px-4 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* SIDEBAR CONFIGURATIONS - xl:col-span-4 */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* TEAM & DATE SELECTOR CARD */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Users className="w-4 h-4" /> Escopo e Organização
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block mb-1">
                  Equipe Operacional
                </label>
                <select
                  value={selectedTeamId}
                  onChange={e => {
                    setSelectedTeamId(e.target.value)
                    setCurrentTemplateId('') // reset template
                  }}
                  className="w-full h-12 px-4 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none"
                >
                  {availableEquipes.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block mb-1">
                  Data do Relatório
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full h-12 px-4 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block mb-1">
                  Nome / Cabeçalho da Empresa
                </label>
                <input
                  type="text"
                  value={companyHeaderName}
                  onChange={e => setCompanyHeaderName(e.target.value)}
                  placeholder="EX: 7LOCAR GESTÃO OPERACIONAL"
                  className="w-full h-12 px-4 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none uppercase"
                />
              </div>
            </div>
          </div>

          {/* TEMPLATES CARD */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
                <FileText className="w-4 h-4" /> Modelos Salvos
              </h3>
              {currentTemplateId && (
                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Modelo Ativo
                </span>
              )}
            </div>

            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum modelo personalizado salvo para esta equipe.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {templates.map(t => {
                    const isActive = currentTemplateId === t.id
                    const isModified = isActive && isTemplateModified

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleApplyTemplate(t.id)}
                        className={cn(
                          "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                          isActive
                            ? "bg-primary/10 border-primary/40 text-primary shadow-xs"
                            : "bg-muted/30 border-border/40 hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase truncate">{t.nome}</span>
                            {isModified && (
                              <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Editado
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                            {t.report_title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }}
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LAYOUT OPTIONS CARD */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Toggles de Exibição
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block mb-1">
                  Título do Relatório
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  placeholder="EX: RELATÓRIO DIÁRIO OPERACIONAL"
                  className="w-full px-4 h-12 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none uppercase"
                />
              </div>

              <hr className="border-border/30 my-2" />

              <div className="space-y-2">
                <button
                  onClick={() => setShowMetrics(!showMetrics)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Métricas da Equipe</span>
                  {showMetrics ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>

                <button
                  onClick={() => setShowLocalities(!showLocalities)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Localidades (Alocações)</span>
                  {showLocalities ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>

                <button
                  onClick={() => setShowObservations(!showObservations)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Observações</span>
                  {showObservations ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>

                <button
                  onClick={() => setShowRoles(!showRoles)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Cargos</span>
                  {showRoles ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>

                <button
                  onClick={() => setShowInactives(!showInactives)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Funcionários Inativos</span>
                  {showInactives ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>

                <button
                  onClick={() => setShowSignatures(!showSignatures)}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted/30 rounded-xl transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-foreground">Exibir Assinaturas (Folha A4)</span>
                  {showSignatures ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* MAIN PANEL CONTENT - xl:col-span-8 */}
        <div className="xl:col-span-8 space-y-6">

          {/* TAB 1: 📱 FORMATO TEXTO (WHATSAPP / COPIAR) */}
          {viewTab === 'texto' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* ACTION BAR FOR TEXT REPORT */}
              <div className="bg-card/85 backdrop-blur-xl border border-border/50 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                
                {/* Sub-Format Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setTextFormatStyle('completo')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                      textFormatStyle === 'completo'
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    📋 Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextFormatStyle('executivo')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                      textFormatStyle === 'executivo'
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    📊 Executivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextFormatStyle('ocorrencias')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer",
                      textFormatStyle === 'ocorrencias'
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ⚠️ Ocorrências
                  </button>
                </div>

                {/* Primary Copy & Share Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedText ? 'Texto Copiado!' : 'Copiar Texto'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="h-11 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" /> Enviar no WhatsApp
                  </button>
                </div>

              </div>

              {/* TEXT DISPLAY PREVIEW CONTAINER */}
              <div className="bg-card/90 backdrop-blur-2xl border border-border/60 rounded-[2.5rem] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Pré-visualização do Texto Formatado
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    Formatado com nomes completos, markdown (*bold*) e emojis
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={generateWhatsAppText}
                    className="w-full h-[520px] p-6 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs leading-relaxed border border-zinc-800 focus:outline-none scrollbar-thin resize-none selection:bg-emerald-500/30 selection:text-white shadow-inner"
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 📄 FORMATO FOLHA A4 (IMPRIMIR / PDF) */}
          {viewTab === 'a4' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* EXPORT & PRINT ACTIONS HEADER */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-card/85 backdrop-blur-xl border border-border/50 rounded-3xl p-4 shadow-sm">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" /> Visualização de Documento A4
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-primary text-white text-xs font-black uppercase tracking-wider shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir / PDF (A4)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('download')}
                    disabled={isExporting}
                    className="h-10 px-4 rounded-xl border border-border/60 text-xs font-black uppercase tracking-wider text-foreground hover:bg-muted transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Imagem PNG
                  </button>

                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button
                      type="button"
                      onClick={() => handleExport('share')}
                      disabled={isExporting}
                      className="h-10 px-4 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Compartilhar
                    </button>
                  )}
                </div>
              </div>

              {/* THE CORE REPORT DOCUMENT PREVIEW CONTAINER (FORMATTED AS OFFICIAL A4 SHEET) */}
              <div 
                ref={shareSquareRef} 
                id="report-print-area"
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-[2.5rem] p-10 space-y-8 max-w-full overflow-hidden"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {/* Official Corporate Header section */}
                <div className="flex justify-between items-start border-b-2 border-slate-900/10 dark:border-zinc-800 pb-6 gap-6">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
                      {companyHeaderName || '7LOCAR GESTÃO OPERACIONAL'}
                    </span>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-zinc-100">
                      {reportTitle || 'RELATÓRIO DIÁRIO OPERACIONAL'}
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> 
                      Emissão: {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-xs">
                      {equipes.find(eq => eq.id === selectedTeamId)?.nome || 'Sem Equipe'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase block tracking-wider">
                      Protocolo: #{selectedDate.replace(/-/g, '')}-{selectedTeamId.substring(0, 4).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Attendance metrics panel */}
                {showMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 rounded-[1.75rem] p-5 print-metrics-grid">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Efetivo Ativo</span>
                      <div className="text-xl font-black text-slate-800 dark:text-zinc-100">{stats.total}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Presenças</span>
                      <div className="text-xl font-black text-emerald-600">{stats.present}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Ausências</span>
                      <div className="text-xl font-black text-rose-600">{stats.absent}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Taxa de Presença</span>
                      <div className="text-xl font-black text-primary">{stats.rate}%</div>
                    </div>
                  </div>
                )}

                {/* Staff breakdown grouped by sectors */}
                {Object.keys(membersBySector).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-zinc-500 italic text-sm">
                    Nenhum colaborador carregado para esta equipe.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(membersBySector).map(([sector, funcs]) => {
                      const Icon = getSectorIcon(sector)
                      const colors = getSectorColors(sector)
                      
                      return (
                        <div key={sector} className="space-y-3 print-sector-group">
                          
                          {/* Sector title bar */}
                          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-zinc-800 print-sector-header">
                            <div 
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                              Setor: {sector} ({funcs.length} Colaboradores)
                            </h4>
                          </div>

                          {/* Employees List under this sector styled like Excel spreadsheet */}
                          <div className="overflow-x-auto border border-slate-300 dark:border-zinc-800 rounded-2xl shadow-xs">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-zinc-900/60">
                                  <th className="p-3 border border-slate-300 dark:border-zinc-800 font-black uppercase text-slate-700 dark:text-zinc-300 w-[35%]">Colaborador (Nome Completo)</th>
                                  {showRoles && (
                                    <th className="p-3 border border-slate-300 dark:border-zinc-800 font-black uppercase text-slate-700 dark:text-zinc-300 w-[15%]">Cargo</th>
                                  )}
                                  {showLocalities && (
                                    <th className="p-3 border border-slate-300 dark:border-zinc-800 font-black uppercase text-slate-700 dark:text-zinc-300 w-[20%]">Localidade</th>
                                  )}
                                  <th className="p-3 border border-slate-300 dark:border-zinc-800 font-black uppercase text-slate-700 dark:text-zinc-300 w-[15%]">Status</th>
                                  {showObservations && (
                                    <th className="p-3 border border-slate-300 dark:border-zinc-800 font-black uppercase text-slate-700 dark:text-zinc-300 w-[15%]">Observações</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {funcs.map((f: any) => {
                                  const att = getMemberAttendanceStatus(f.id)
                                  const todayScale = escalas.find(e => e.funcionario_id === f.id)
                                  const obsValue = observations[f.id] || ''

                                  return (
                                    <tr 
                                      key={f.id} 
                                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/20 transition-colors print-employee-row"
                                    >
                                      {/* Colaborador */}
                                      <td className="p-3 border border-slate-200 dark:border-zinc-800 font-bold text-slate-900 dark:text-zinc-100">
                                        <span className="uppercase text-[13px] tracking-tight">{f.nome}</span>
                                      </td>
                                      
                                      {/* Cargo */}
                                      {showRoles && (
                                        <td className="p-3 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">
                                          {f.cargo || '-'}
                                        </td>
                                      )}

                                      {/* Localidade */}
                                      {showLocalities && (
                                        <td className="p-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                                          {todayScale?.localidade ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-zinc-300">
                                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" /> {todayScale.localidade}
                                            </span>
                                          ) : '-'}
                                        </td>
                                      )}

                                      {/* Status */}
                                      <td className="p-3 border border-slate-200 dark:border-zinc-800">
                                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border inline-block text-center min-w-[75px] shadow-2xs", att.color)}>
                                          {att.label}
                                        </span>
                                      </td>

                                      {/* Observações */}
                                      {showObservations && (
                                        <td className="p-1.5 border border-slate-200 dark:border-zinc-800">
                                          {isExporting ? (
                                            <div className="px-2 py-1 text-slate-600 dark:text-zinc-400 italic">
                                              {obsValue || '-'}
                                            </div>
                                          ) : (
                                            <>
                                              <div className="relative print:hidden">
                                                <input
                                                  type="text"
                                                  value={obsValue}
                                                  onChange={e => handleObsChange(f.id, e.target.value)}
                                                  onBlur={() => handleSaveObs(f.id, obsValue)}
                                                  placeholder="Add obs..."
                                                  className="w-full px-2 h-7 bg-transparent border-0 rounded text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-primary/20 outline-none"
                                                />
                                              </div>
                                              {obsValue && (
                                                <div className="hidden print:block px-2 py-1 text-slate-700 italic print-obs-static">
                                                  {obsValue}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                )}

                {/* FORMAL SIGNATURES SECTION (FOR PRINTING / A4 PDF) */}
                {showSignatures && (
                  <div className="pt-8 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-12 print-signatures">
                    <div className="text-center space-y-2">
                      <div className="border-b-2 border-slate-400 dark:border-zinc-600 w-3/4 mx-auto pt-6" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                        Encarregado / Liderança Operacional
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase">Visto & Assinatura</p>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="border-b-2 border-slate-400 dark:border-zinc-600 w-3/4 mx-auto pt-6" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                        Supervisão / Gerência de Operações
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase">Aprovação Final</p>
                    </div>
                  </div>
                )}

                {/* Footer metadata */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-zinc-800 text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  <span>Documento Operacional Oficial • 7Locar Gestão</span>
                  <span>Gerado em {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* SAVE NEW MODEL MODAL */}
      <Modal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Salvar Novo Modelo de Relatório"
        size="sm"
      >
        <div className="space-y-4 py-3">
          <p className="text-xs text-muted-foreground">
            Insira o nome para salvar as configurações atuais (toggles, título e observações) como um novo modelo reutilizável.
          </p>

          <div>
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block mb-1">
              Nome do Modelo
            </label>
            <input
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Ex: Varrição de Domingo"
              className="w-full px-4 h-12 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setSaveModalOpen(false)}
              className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-wider"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleSaveTemplate(true)}
              loading={isSavingNew}
              className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-wider bg-primary text-white shadow-lg shadow-primary/20"
            >
              Salvar Modelo
            </Button>
          </div>
        </div>
      </Modal>

      {/* PRINT MEDIA STYLING */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 12mm !important;
        }
        @media print {
          html, body {
            background: white !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            visibility: hidden !important;
          }
          #root, #root > *, #root > * > * {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          #report-print-area {
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #report-print-area * {
            visibility: visible !important;
          }
          
          #report-print-area h1,
          #report-print-area h2,
          #report-print-area h3,
          #report-print-area h4,
          #report-print-area span,
          #report-print-area p,
          #report-print-area div {
            color: #0f172a !important;
          }

          #report-print-area table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-bottom: 16px !important;
          }
          #report-print-area th, 
          #report-print-area td {
            border: 1px solid #64748b !important;
            padding: 6px 10px !important;
            color: #0f172a !important;
          }
          #report-print-area th {
            background-color: #e2e8f0 !important;
            font-weight: bold !important;
          }
          #report-print-area tbody tr:nth-child(even) {
            background-color: #f8fafc !important;
          }
          
          .print-metrics-grid {
            background-color: #f8fafc !important;
            border: 1px solid #94a3b8 !important;
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 16px !important;
            padding: 16px !important;
            border-radius: 12px !important;
          }

          .print-signatures {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 30px !important;
          }
          
          .print-sector-group {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
          }
          .print-employee-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-sector-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />
    </div>
  )
}
