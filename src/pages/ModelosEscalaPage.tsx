import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays, getDay, subDays, parseISO, isSunday, startOfWeek, endOfWeek, nextSunday as dateFnsNextSunday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  Search, 
  X, 
  Check, 
  Users, 
  ChevronLeft, 
  RotateCcw, 
  Sparkles, 
  Activity, 
  Cpu, 
  Layers, 
  Target, 
  MessageSquare, 
  Copy,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  Calendar,
  Filter,
  ArrowLeft,
  ArrowRight,
  Sliders,
  CheckSquare
} from 'lucide-react'
import { useModelosEscala, useSalvarModelosEscala, type ModeloEscala, type ModeloEscalaFuncionario } from '../hooks/useModelosEscala'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { Loading } from '../components/ui/Loading'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { FuncionarioName } from '../components/ui/FuncionarioName'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao } from '../hooks/useConfiguracoes'

// Options for Folga 1 - COMPENSADO (Semana Anterior ao Domingo)
const COMPENSADO_SEMANA_ANTERIOR = [
  { value: 'segunda', label: 'Segunda-feira (Anterior)', offset: -6 },
  { value: 'terca', label: 'Terça-feira (Anterior)', offset: -5 },
  { value: 'quarta', label: 'Quarta-feira (Anterior)', offset: -4 },
  { value: 'quinta', label: 'Quinta-feira (Anterior)', offset: -3 },
  { value: 'sexta', label: 'Sexta-feira (Anterior)', offset: -2 },
  { value: 'sabado', label: 'Sábado (Anterior)', offset: -1 },
] as const

// Options for Folga 2 - REPOUSO (Semana Posterior ao Domingo)
const REPOUSO_SEMANA_POSTERIOR = [
  { value: 'segunda', label: 'Segunda-feira (Posterior)', offset: 1 },
  { value: 'terca', label: 'Terça-feira (Posterior)', offset: 2 },
  { value: 'quarta', label: 'Quarta-feira (Posterior)', offset: 3 },
  { value: 'quinta', label: 'Quinta-feira (Posterior)', offset: 4 },
  { value: 'sexta', label: 'Sexta-feira (Posterior)', offset: 5 },
  { value: 'sabado', label: 'Sábado (Posterior)', offset: 6 },
] as const

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.substring(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getCompensadoOffset(dia: string): number {
  const item = COMPENSADO_SEMANA_ANTERIOR.find(d => d.value === dia)
  return item ? item.offset : -4 // Default Quarta anterior
}

function getRepousoOffset(dia: string): number {
  const item = REPOUSO_SEMANA_POSTERIOR.find(d => d.value === dia)
  return item ? item.offset : 2 // Default Terça posterior
}

function labelDia(dia: string): string {
  const map: Record<string, string> = {
    segunda: 'Segunda',
    terca: 'Terça',
    quarta: 'Quarta',
    quinta: 'Quinta',
    sexta: 'Sexta',
    sabado: 'Sábado',
  }
  return map[dia] || dia
}

// Calculate upcoming Sunday
function getNextSundayDate(): string {
  const now = new Date()
  if (isSunday(now)) return format(now, 'yyyy-MM-dd')
  return format(dateFnsNextSunday(now), 'yyyy-MM-dd')
}

interface AIProposalItem {
  funcionarioId: string
  funcionarioNome: string
  setor: string
  cargo: string
  domingosTrabalhados: number
  modalidade: 'folga' | 'hora_extra'
  
  // Regra das 2 Folgas
  diaCompensadoAnterior: string   // ex: 'quarta' (Semana Anterior)
  dataCompensadoAnteriorStr: string
  
  diaRepousoPosterior: string     // ex: 'terca' (Semana Posterior)
  dataRepousoPosteriorStr: string

  localidade: string
  statusAprovacao: 'aprovado' | 'sugestao_pendente'
}

export function ModelosEscalaPage() {
  const queryClient = useQueryClient()
  const { data: modelosData, isLoading } = useModelosEscala()
  const { mutateAsync: salvarModelos } = useSalvarModelosEscala()
  const { data: funcionariosOrig } = useFuncionarios()
  const { data: teamInfo, isLoading: isLoadingTeam } = useUserTeam()
  const { mutateAsync: batchUpsert } = useBatchUpsertEscalas()
  const { data: dbSetores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: dbLocalidades = [] } = useConfiguracao<Array<{ id: string; nome: string; setor: string }>>('localidades', [])

  // Load teams mapping
  const { data: equipesList = [] } = useQuery<any[]>({
    queryKey: ['equipes'],
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

  // Query past 90 days Sunday scale history to calculate fair rotation
  const { data: pastSundayEscalas = [] } = useQuery<any[]>({
    queryKey: ['past-sunday-escalas'],
    queryFn: async () => {
      const today = new Date()
      const startDateStr = format(subDays(today, 90), 'yyyy-MM-dd')
      const endDateStr = format(today, 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('escalas')
        .select('id, funcionario_id, data, tipo, localidade')
        .gte('data', startDateStr)
        .lte('data', endDateStr)

      if (error) throw error
      return data || []
    }
  })

  const getModelTeam = useCallback((modelo: ModeloEscala, equipes: any[]) => {
    if (modelo.equipe_id) {
      const eq = equipes.find(e => e.id === modelo.equipe_id)
      if (eq) return eq
    }
    if (modelo.funcionarios && modelo.funcionarios.length > 0) {
      const firstFuncId = modelo.funcionarios[0].funcionario_id
      const eq = equipes.find(e => (e.membros || []).some((m: any) => m.id === firstFuncId))
      if (eq) return eq
    }
    return null
  }, [])

  const funcionarios = useMemo(() => {
    let list = funcionariosOrig || []
    if (teamInfo?.isRestricted) {
      list = list.filter(f => teamInfo.teamMemberIds.includes(f.id))
    }
    return list
  }, [funcionariosOrig, teamInfo])

  // Compute Sunday Work Stats per employee for Fair Rotation Ranking
  const sundayStatsMap = useMemo(() => {
    const stats = new Map<string, { count: number; lastSundayStr: string | null }>()

    funcionarios.forEach(f => {
      stats.set(f.id, { count: 0, lastSundayStr: null })
    })

    pastSundayEscalas.forEach(e => {
      const funcId = e.funcionario_id
      const dStr = typeof e.data === 'string' ? e.data.substring(0, 10) : ''
      if (!dStr) return

      try {
        const dObj = parseISO(dStr)
        if (isSunday(dObj)) {
          const isWork = ['presente', 'trabalho', 'trabalhando', 'hora_extra', 'he'].includes((e.tipo || '').toLowerCase())
          if (isWork && stats.has(funcId)) {
            const current = stats.get(funcId)!
            current.count += 1
            if (!current.lastSundayStr || dStr > current.lastSundayStr) {
              current.lastSundayStr = dStr
            }
          }
        }
      } catch {
        // Skip invalid date strings
      }
    })

    return stats
  }, [funcionarios, pastSundayEscalas])

  // Fair Rotation Ranking (fewest worked Sundays at the top)
  const fairRotationRanking = useMemo(() => {
    return [...funcionarios]
      .filter(f => f.cargo?.toLowerCase() !== 'encarregado' && f.status === 'ativo')
      .sort((a, b) => {
        const statA = sundayStatsMap.get(a.id)?.count ?? 0
        const statB = sundayStatsMap.get(b.id)?.count ?? 0
        if (statA !== statB) return statA - statB
        
        const lastA = sundayStatsMap.get(a.id)?.lastSundayStr ?? ''
        const lastB = sundayStatsMap.get(b.id)?.lastSundayStr ?? ''
        return lastA.localeCompare(lastB)
      })
  }, [funcionarios, sundayStatsMap])

  // Navigation Tabs: 'ia' (IA Wizard), 'modelos' (Saved Templates), 'historico' (Rotation Ranking)
  const [activeTab, setActiveTab] = useState<'ia' | 'modelos' | 'historico'>('ia')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')

  // Encarregado Interactive Wizard Options State
  const [aiTargetDate, setAiTargetDate] = useState<string>(getNextSundayDate())
  const [aiWorkersPerSector, setAiWorkersPerSector] = useState<number>(1)
  const [aiCompensationStrategy, setAiCompensationStrategy] = useState<'folga' | 'hora_extra'>('folga')

  // Preferred 2 Folgas Configuration
  const [prefCompensadoAnterior, setPrefCompensadoAnterior] = useState<string>('auto') // 'auto' or 'quarta', 'terca', etc.
  const [prefRepousoPosterior, setPrefRepousoPosterior] = useState<string>('auto')   // 'auto' or 'terca', 'quarta', etc.

  const [aiProposal, setAiProposal] = useState<AIProposalItem[]>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [showAIProposalModal, setShowAIProposalModal] = useState(false)

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareText, setShareText] = useState('')

  // Template Edit State
  const [editando, setEditando] = useState<ModeloEscala | null>(null)
  const [originalEditando, setOriginalEditando] = useState<ModeloEscala | null>(null)

  const openModelEditor = useCallback((model: ModeloEscala | null) => {
    setEditando(model)
    setOriginalEditando(model ? JSON.parse(JSON.stringify(model)) : null)
  }, [])

  const [aplicando, setAplicando] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  // Generate AI Schedule Proposal with 2-Folgas Rule
  const handleGenerateAISchedule = () => {
    if (!aiTargetDate) {
      setMsg('Selecione a data do domingo ou feriado!')
      setMsgType('error')
      return
    }

    setIsGeneratingAI(true)

    setTimeout(() => {
      const targetDateObj = parseISO(aiTargetDate)

      // Group available active employees by setor
      const sectorGroups = new Map<string, typeof fairRotationRanking>()
      fairRotationRanking.forEach(f => {
        const sector = f.setor || 'Geral'
        const existing = sectorGroups.get(sector) || []
        existing.push(f)
        sectorGroups.set(sector, existing)
      })

      const proposal: AIProposalItem[] = []
      
      const compCycle = ['quarta', 'terca', 'quinta', 'segunda', 'sexta']
      const repCycle = ['terca', 'quarta', 'quinta', 'segunda', 'sexta']
      let cycleIdx = 0

      sectorGroups.forEach((sectorFuncs, sectorName) => {
        const selected = sectorFuncs.slice(0, Math.max(1, aiWorkersPerSector))

        selected.forEach(f => {
          const stats = sundayStatsMap.get(f.id)
          const workedCount = stats?.count ?? 0

          // Determine Folga 1 (Compensado - Semana Anterior)
          const chosenCompDay = prefCompensadoAnterior !== 'auto' 
            ? prefCompensadoAnterior 
            : compCycle[cycleIdx % compCycle.length]

          // Determine Folga 2 (Repouso - Semana Posterior)
          const chosenRepDay = prefRepousoPosterior !== 'auto' 
            ? prefRepousoPosterior 
            : repCycle[cycleIdx % repCycle.length]

          cycleIdx++

          const compOffset = getCompensadoOffset(chosenCompDay)
          const repOffset = getRepousoOffset(chosenRepDay)

          const dataCompStr = format(addDays(targetDateObj, compOffset), 'yyyy-MM-dd')
          const dataRepStr = format(addDays(targetDateObj, repOffset), 'yyyy-MM-dd')

          const locObj = dbLocalidades.find(l => l.setor === sectorName)
          const locName = locObj ? locObj.nome : sectorName

          proposal.push({
            funcionarioId: f.id,
            funcionarioNome: f.nome,
            setor: sectorName,
            cargo: f.cargo || 'Operacional',
            domingosTrabalhados: workedCount,
            modalidade: aiCompensationStrategy,
            
            diaCompensadoAnterior: chosenCompDay,
            dataCompensadoAnteriorStr: dataCompStr,
            
            diaRepousoPosterior: chosenRepDay,
            dataRepousoPosteriorStr: dataRepStr,

            localidade: locName,
            statusAprovacao: aiCompensationStrategy === 'hora_extra' ? 'sugestao_pendente' : 'aprovado'
          })
        })
      })

      setAiProposal(proposal)
      setIsGeneratingAI(false)
      setShowAIProposalModal(true)
      setMsg('Sugestão de Escala com 2 Folgas gerada com sucesso!')
      setMsgType('success')
    }, 400)
  }

  // 1-Click Encarregado Approval Actions
  const handleApproveHE = (funcionarioId: string) => {
    setAiProposal(prev => prev.map(item => {
      if (item.funcionarioId === funcionarioId) {
        return { ...item, statusAprovacao: 'aprovado' }
      }
      return item
    }))
  }

  const handleConvertToFolga = (funcionarioId: string) => {
    setAiProposal(prev => prev.map(item => {
      if (item.funcionarioId === funcionarioId) {
        return { ...item, modalidade: 'folga', statusAprovacao: 'aprovado' }
      }
      return item
    }))
  }

  // Update specific day-off choice in modal
  const handleUpdateProposalFolgas = (funcionarioId: string, compDay?: string, repDay?: string) => {
    setAiProposal(prev => prev.map(item => {
      if (item.funcionarioId === funcionarioId) {
        const targetDateObj = parseISO(aiTargetDate)
        const newCompDay = compDay || item.diaCompensadoAnterior
        const newRepDay = repDay || item.diaRepousoPosterior

        const newCompOffset = getCompensadoOffset(newCompDay)
        const newRepOffset = getRepousoOffset(newRepDay)

        return {
          ...item,
          diaCompensadoAnterior: newCompDay,
          dataCompensadoAnteriorStr: format(addDays(targetDateObj, newCompOffset), 'yyyy-MM-dd'),
          diaRepousoPosterior: newRepDay,
          dataRepousoPosteriorStr: format(addDays(targetDateObj, newRepOffset), 'yyyy-MM-dd')
        }
      }
      return item
    }))
  }

  // Confirm and Apply AI Scale (with 3 records per employee: Sunday + Folga 1 + Folga 2)
  const handleApplyAISchedule = async () => {
    if (aiProposal.length === 0 || !aiTargetDate) return
    setAplicando(true)

    try {
      const itemsToUpsert: any[] = []
      const targetDateObj = parseISO(aiTargetDate)

      for (const item of aiProposal) {
        const isHE = item.modalidade === 'hora_extra'
        const escType = isHE ? 'hora_extra' : 'presente'

        // 1. Sunday Work Entry
        itemsToUpsert.push({
          funcionario_id: item.funcionarioId,
          data: aiTargetDate,
          tipo: escType,
          turno: 'integral',
          localidade: item.localidade,
          observacoes: isHE 
            ? (item.statusAprovacao === 'aprovado' ? 'HORA EXTRA APROVADA' : 'SUGESTÃO DE HORA EXTRA (PENDENTE)') 
            : `ESCALA DOMINICAL (FOLGAS: ${labelDia(item.diaCompensadoAnterior)} ANTERIOR & ${labelDia(item.diaRepousoPosterior)} POSTERIOR)`
        })

        // If working for Folga, insert the 2 Folga Records:
        if (!isHE) {
          // 2. Folga 1 - COMPENSADO (Semana Anterior)
          itemsToUpsert.push({
            funcionario_id: item.funcionarioId,
            data: item.dataCompensadoAnteriorStr,
            tipo: 'compensar',
            turno: 'integral',
            observacoes: `FOLGA 1 (COMPENSADO SEMANA ANTERIOR DO DOMINGO ${format(targetDateObj, 'dd/MM')})`
          })

          // 3. Folga 2 - REPOUSO (Semana Posterior)
          itemsToUpsert.push({
            funcionario_id: item.funcionarioId,
            data: item.dataRepousoPosteriorStr,
            tipo: 'repouso',
            turno: 'integral',
            observacoes: `FOLGA 2 (REPOUSO SEMANA POSTERIOR DO DOMINGO ${format(targetDateObj, 'dd/MM')})`
          })
        }
      }

      // Atomic batch upsert to database
      await batchUpsert({ items: itemsToUpsert, skipFreqSync: true })

      // Clear frequency records for Sunday so attendance remains pending in Chamada!
      const deletePromises = aiProposal.map(item =>
        supabase.from('frequencia').delete().eq('funcionario_id', item.funcionarioId).eq('data', aiTargetDate)
      )
      await Promise.all(deletePromises)

      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      setShowAIProposalModal(false)
      setMsg(`Escala do Domingo ${format(targetDateObj, 'dd/MM/yyyy')} com 2 Folgas aplicada com sucesso!`)
      setMsgType('success')
    } catch (err: any) {
      console.error('Erro ao aplicar escala de IA:', err)
      setMsg('Erro ao aplicar escala: ' + (err?.message || ''))
      setMsgType('error')
    } finally {
      setAplicando(false)
    }
  }

  // Generate WhatsApp Share Text Report with 2 Folgas Details
  const handleOpenShareReport = () => {
    if (!aiTargetDate) return
    const targetDateObj = parseISO(aiTargetDate)
    const formattedDate = format(targetDateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase()

    let text = `📅 *ESCALA DE DOMINGO E FERIADO*\n`
    text += `📆 *Data do Domingo:* ${formattedDate}\n`
    text += `🤖 *Gerado por Assistente de IA (Regra de 2 Folgas)*\n`
    text += `─────────────────────────\n\n`

    const folgaList = aiProposal.filter(i => i.modalidade === 'folga')
    const heList = aiProposal.filter(i => i.modalidade === 'hora_extra')

    if (folgaList.length > 0) {
      text += `👷 *TRABALHAM POR 2 FOLGAS COMPENSATÓRIAS (${folgaList.length}):*\n\n`
      folgaList.forEach(i => {
        const compDateFmt = format(parseISO(i.dataCompensadoAnteriorStr), 'dd/MM')
        const repDateFmt = format(parseISO(i.dataRepousoPosteriorStr), 'dd/MM')

        text += `• *${i.funcionarioNome}* (${i.setor})\n`
        text += `  - ⏪ *Folga 1 (Compensado Ant.):* ${labelDia(i.diaCompensadoAnterior)} (${compDateFmt})\n`
        text += `  - ⏩ *Folga 2 (Repouso Post.):* ${labelDia(i.diaRepousoPosterior)} (${repDateFmt})\n\n`
      })
    }

    if (heList.length > 0) {
      text += `⚠️ *SUGESTÕES DE HORA EXTRA (${heList.length}):*\n`
      heList.forEach(i => {
        const statusStr = i.statusAprovacao === 'aprovado' ? '✅ Aprovado' : '⏳ Pendente de Aprovação'
        text += `• *${i.funcionarioNome}* (${i.setor}) [HE] - ${statusStr}\n`
      })
      text += `\n`
    }

    text += `─────────────────────────\n`
    text += `*Gestão de Equipes Operacionais*`

    setShareText(text)
    setShowShareModal(true)
  }

  if (isLoading || isLoadingTeam) return <Loading size="lg" text="Carregando Escala de Domingos..." />

  return (
    <div className="min-h-screen bg-background pb-32 cyber-grid">
      <TopHeader 
        title="Escala de Domingos & Feriados" 
        subtitle="Gerador guiado do encarregado, rodízio justo e regra das 2 folgas" 
      />

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32">
        {/* Floating Toast Alert */}
        {msg && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000000] max-w-md w-[92vw] sm:w-auto min-w-[320px] animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-auto">
            <div className={cn(
              "flex items-center justify-between gap-4 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border shadow-2xl backdrop-blur-2xl transition-all bg-card/95 text-foreground border-border/80 shadow-black/40 ring-1 ring-white/10",
              msgType === 'success' ? "border-emerald-500/40 text-emerald-500" : "border-rose-500/40 text-rose-500"
            )}>
              <div className="flex items-center gap-3 min-w-0">
                {msgType === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
                <span className="truncate font-bold text-[11px] text-foreground">{msg}</span>
              </div>
              <button onClick={() => setMsg('')} className="p-1.5 rounded-xl hover:bg-muted/50 transition-all cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        {!editando && (
          <div className="flex justify-center mb-8 relative z-10">
            <div className="bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border/50 flex shadow-xl gap-1">
              <button
                onClick={() => setActiveTab('ia')}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === 'ia'
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                Assistente de IA & 2 Folgas
              </button>

              <button
                onClick={() => setActiveTab('modelos')}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === 'modelos'
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <CalendarDays className="w-4 h-4" />
                Modelos Recorrentes
              </button>

              <button
                onClick={() => setActiveTab('historico')}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === 'historico'
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Clock className="w-4 h-4" />
                Fila de Rodízio
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: ASSISTENTE DE IA DE ESCALA (PASSO A PASSO DO ENCARREGADO COM REGRA DE 2 FOLGAS) */}
        {!editando && activeTab === 'ia' && (
          <div className="space-y-8 animate-fade-in">
            {/* Banner do Assistente de IA */}
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 dark:from-amber-500/10 dark:to-orange-500/5 border border-amber-500/30 rounded-[2.5rem] p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                    <Sparkles className="w-7 h-7 animate-spin-slow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Assistente de Escala de Domingos & Feriados</h2>
                      <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        Regra das 2 Folgas Ativa
                      </span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                      Gerador guiado para o encarregado. Toda atribuição inclui **2 Folgas**: Folga 1 (Compensado na semana anterior) + Folga 2 (Repouso na semana posterior).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={handleGenerateAISchedule}
                    disabled={isGeneratingAI}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:scale-[1.02] transition-all cursor-pointer border border-amber-400/30 active:scale-95"
                  >
                    <Sparkles className={cn("w-4 h-4", isGeneratingAI && "animate-spin")} />
                    {isGeneratingAI ? 'Analisando Rodízio...' : '⚡ Gerar Sugestão de Escala'}
                  </button>
                </div>
              </div>
            </div>

            {/* FLUXO GUIADO EM ETAPAS PARA O ENCARREGADO */}
            <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 sm:p-8 shadow-md space-y-8">
              <div className="flex items-center justify-between border-b border-border/20 pb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" /> Passo a Passo de Opções do Encarregado
                </h3>
                <span className="text-[9.5px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  Configuração Detalhada
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ETAPA 1: DATA E EFETIVO */}
                <div className="space-y-4 bg-muted/30 border border-border/30 rounded-2xl p-5 relative">
                  <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">1</span>
                    Data & Efetivo
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                        Domingo ou Feriado Alvo
                      </label>
                      <input
                        type="date"
                        value={aiTargetDate}
                        onChange={e => setAiTargetDate(e.target.value)}
                        className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground outline-none uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                        Trabalhadores por Setor
                      </label>
                      <select
                        value={aiWorkersPerSector}
                        onChange={e => setAiWorkersPerSector(Number(e.target.value))}
                        className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground outline-none uppercase"
                      >
                        <option value={1}>1 por Setor</option>
                        <option value={2}>2 por Setor</option>
                        <option value={3}>3 por Setor</option>
                        <option value={4}>4 por Setor</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ETAPA 2: CONFIGURAÇÃO DA FOLGA 1 (SEMANA ANTERIOR) */}
                <div className="space-y-4 bg-muted/30 border border-border/30 rounded-2xl p-5 relative">
                  <div className="flex items-center gap-2 text-amber-500 font-black text-xs uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                    Folga 1: Compensado (Semana Anterior)
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                        Dia da Folga Anterior ao Domingo
                      </label>
                      <select
                        value={prefCompensadoAnterior}
                        onChange={e => setPrefCompensadoAnterior(e.target.value)}
                        className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground outline-none uppercase"
                      >
                        <option value="auto">🤖 Equilibrar Automático pela IA</option>
                        {COMPENSADO_SEMANA_ANTERIOR.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[10px] text-muted-foreground font-bold leading-relaxed pt-1">
                      Concedida na semana QUE ANTECEDE o domingo trabalhado.
                    </p>
                  </div>
                </div>

                {/* ETAPA 3: CONFIGURAÇÃO DA FOLGA 2 (SEMANA POSTERIOR) */}
                <div className="space-y-4 bg-muted/30 border border-border/30 rounded-2xl p-5 relative">
                  <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">3</span>
                    Folga 2: Repouso (Semana Posterior)
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                        Dia do Repouso Após o Domingo
                      </label>
                      <select
                        value={prefRepousoPosterior}
                        onChange={e => setPrefRepousoPosterior(e.target.value)}
                        className="w-full bg-background border border-border/40 rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground outline-none uppercase"
                      >
                        <option value="auto">🤖 Equilibrar Automático pela IA</option>
                        {REPOUSO_SEMANA_POSTERIOR.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[10px] text-muted-foreground font-bold leading-relaxed pt-1">
                      Descanso semanal concedido na semana QUE SUCEDE o domingo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ranking de Justiça: Fila do Rodízio Dominical */}
            <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Fila do Rodízio (Menos Domingos Trabalhados)
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                    Histórico dos últimos 90 dias. Colaboradores no topo são os prioritários para a sugestão da IA.
                  </p>
                </div>

                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  {fairRotationRanking.length} Colaboradores Elegíveis
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fairRotationRanking.slice(0, 12).map((func, idx) => {
                  const stat = sundayStatsMap.get(func.id)
                  const count = stat?.count ?? 0
                  const isTopPriority = idx < 4

                  return (
                    <div
                      key={func.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        isTopPriority
                          ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/10 shadow-sm"
                          : "bg-muted/30 border-border/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                          isTopPriority ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          #{idx + 1}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-black uppercase text-foreground truncate">{func.nome}</h4>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block">{func.setor || 'Geral'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={cn(
                          "text-xs font-black px-2.5 py-1 rounded-full border uppercase text-[9px] block",
                          count === 0 ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                        )}>
                          {count} Domingos
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MODELOS RECORRENTES */}
        {!editando && activeTab === 'modelos' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between gap-4 bg-card/80 backdrop-blur-xl border border-border/50 p-6 rounded-3xl">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Modelos de Escala Salvos</h3>
                <p className="text-xs font-bold text-muted-foreground">Modelos fixos para aplicação recorrente</p>
              </div>

              <button
                onClick={() => {
                  const newModel: ModeloEscala = {
                    id: generateId(),
                    nome: 'Novo Modelo Dominical',
                    descricao: 'Modelo de escala dominical',
                    tipo: 'dominical',
                    equipe_id: teamInfo?.teamId || undefined,
                    created_at: new Date().toISOString(),
                    funcionarios: []
                  }
                  openModelEditor(newModel)
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-wider shadow-md hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Criar Novo Modelo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(modelosData || []).map(m => (
                <div key={m.id} className="bg-card/90 border border-border/50 rounded-3xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-foreground text-sm uppercase">{m.nome}</h4>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {m.funcionarios.length} Colaboradores
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground font-bold leading-relaxed">{m.descricao || 'Sem descrição'}</p>

                  <div className="pt-4 border-t border-border/20 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openModelEditor(m)}
                      className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-black uppercase transition-all cursor-pointer"
                    >
                      Editar Modelo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FILA E HISTÓRICO */}
        {!editando && activeTab === 'historico' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-card/80 border border-border/50 rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-4">Histórico Completo do Rodízio Dominical</h3>
              <p className="text-xs font-bold text-muted-foreground">Consulte todas as escalas dominicais já aplicadas e o histórico de cada colaborador.</p>
            </div>
          </div>
        )}

        {/* MODAL PROPOSTA DA IA COM 2 FOLGAS DETALHADAS */}
        {showAIProposalModal && (
          <Modal
            open={showAIProposalModal}
            onClose={() => setShowAIProposalModal(false)}
            title="Proposta de Escala de Domingo (2 Folgas Atribuídas)"
          >
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">Escala Gerada para o Domingo</h4>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Data Alvo: {aiTargetDate}</p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenShareReport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase shadow-md hover:bg-emerald-600 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> Compartlhar WhatsApp
                </button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
                {aiProposal.map((item) => (
                  <div key={item.funcionarioId} className="bg-muted/40 border border-border/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 border-b border-border/20 pb-3">
                      <div>
                        <h5 className="text-xs font-black uppercase text-foreground">{item.funcionarioNome}</h5>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">{item.setor} • {item.cargo}</span>
                      </div>

                      <span className="text-[8.5px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {item.domingosTrabalhados} Domingos (90d)
                      </span>
                    </div>

                    {/* Exibição detalhada das 2 Folgas */}
                    {item.modalidade === 'folga' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Folga 1 (Compensado - Semana Anterior) */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase">
                            <ArrowLeft className="w-3 h-3" /> Folga 1 (Compensado Ant.)
                          </div>
                          <select
                            value={item.diaCompensadoAnterior}
                            onChange={e => handleUpdateProposalFolgas(item.funcionarioId, e.target.value, undefined)}
                            className="w-full bg-background border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-foreground outline-none uppercase mt-1"
                          >
                            {COMPENSADO_SEMANA_ANTERIOR.map(d => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                          <span className="text-[8.5px] font-bold text-muted-foreground uppercase block pt-0.5">
                            Data: {format(parseISO(item.dataCompensadoAnteriorStr), 'dd/MM/yyyy')}
                          </span>
                        </div>

                        {/* Folga 2 (Repouso - Semana Posterior) */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase">
                            <ArrowRight className="w-3 h-3" /> Folga 2 (Repouso Post.)
                          </div>
                          <select
                            value={item.diaRepousoPosterior}
                            onChange={e => handleUpdateProposalFolgas(item.funcionarioId, undefined, e.target.value)}
                            className="w-full bg-background border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-foreground outline-none uppercase mt-1"
                          >
                            {REPOUSO_SEMANA_POSTERIOR.map(d => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                          <span className="text-[8.5px] font-bold text-muted-foreground uppercase block pt-0.5">
                            Data: {format(parseISO(item.dataRepousoPosteriorStr), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between gap-4">
                        <span className="text-[9px] font-black uppercase text-amber-600">
                          ⚠️ Sugestão HE ({item.statusAprovacao === 'aprovado' ? 'Aprovado' : 'Pendente Encarregado'})
                        </span>

                        {item.statusAprovacao !== 'aprovado' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveHE(item.funcionarioId)}
                              className="text-[8px] font-black uppercase px-2.5 py-1 bg-emerald-500 text-white rounded-lg cursor-pointer"
                            >
                              Aprovar HE
                            </button>

                            <button
                              type="button"
                              onClick={() => handleConvertToFolga(item.funcionarioId)}
                              className="text-[8px] font-black uppercase px-2.5 py-1 bg-blue-500 text-white rounded-lg cursor-pointer"
                            >
                              Aplicar 2 Folgas
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/20">
                <button
                  type="button"
                  onClick={() => setShowAIProposalModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-border/40 text-xs font-black uppercase text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleApplyAISchedule}
                  disabled={aplicando}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {aplicando ? 'Aplicando Escala com 2 Folgas...' : 'Confirmar e Gravar 2 Folgas + Domingo'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL COMPARTILHAR WHATSAPP */}
        {showShareModal && (
          <Modal
            open={showShareModal}
            onClose={() => setShowShareModal(false)}
            title="Compartilhar Escala de Domingo (WhatsApp)"
          >
            <div className="space-y-4">
              <textarea
                value={shareText}
                onChange={e => setShareText(e.target.value)}
                rows={12}
                className="w-full bg-muted/50 border border-border/40 rounded-2xl p-4 text-xs font-mono text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/20">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareText)
                    setMsg('Texto copiado com sucesso!')
                    setMsgType('success')
                  }}
                  className="px-5 py-2.5 rounded-xl bg-muted/60 text-xs font-black uppercase text-foreground hover:bg-muted transition-all cursor-pointer flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copiar Texto
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const encoded = encodeURIComponent(shareText)
                    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
                  }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Abrir no WhatsApp
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
