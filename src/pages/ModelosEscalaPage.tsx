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
  Filter
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

const DIAS_COMPENSADO = [
  { value: 'segunda', label: 'Segunda-feira', offset: 1 },
  { value: 'terca', label: 'Terça-feira', offset: 2 },
  { value: 'quarta', label: 'Quarta-feira', offset: 3 },
  { value: 'quinta', label: 'Quinta-feira', offset: -3 },
  { value: 'sexta', label: 'Sexta-feira', offset: -2 },
  { value: 'sabado', label: 'Sábado', offset: -1 },
] as const

const DIAS_REPOUSO = [
  { value: 'segunda', label: 'Segunda-feira', offset: 1 },
  { value: 'terca', label: 'Terça-feira', offset: 2 },
  { value: 'quarta', label: 'Quarta-feira', offset: 3 },
  { value: 'quinta', label: 'Quinta-feira', offset: 4 },
  { value: 'sexta', label: 'Sexta-feira', offset: 5 },
  { value: 'sabado', label: 'Sábado', offset: 6 },
] as const

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.substring(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getCompensadoOffset(dia: string): number {
  const map: Record<string, number> = {
    segunda: -6,
    terca: -5,
    quarta: -4,
    quinta: -3,
    sexta: -2,
    sabado: -1,
  }
  return map[dia] ?? 0
}

function getRepousoOffset(dia: string): number {
  const map: Record<string, number> = {
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  }
  return map[dia] ?? 0
}

function labelDia(dia: string): string {
  const map: Record<string, string> = {
    segunda: 'Seg',
    terca: 'Ter',
    quarta: 'Qua',
    quinta: 'Qui',
    sexta: 'Sex',
    sabado: 'Sáb',
  }
  return map[dia] || dia
}

function isProtectedScaleType(tipo: string | null | undefined): boolean {
  if (!tipo) return false
  const t = tipo.toLowerCase()
  return t === 'ferias' || t.includes('atestado') || t.includes('afastamento') || t === 'falta' || t.includes('abonad')
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
  diaCompensacao: string
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
  const { data: pastSundayEscalas = [], isLoading: isLoadingHistory } = useQuery<any[]>({
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
        
        // Secondary sort: longest time since last worked Sunday
        const lastA = sundayStatsMap.get(a.id)?.lastSundayStr ?? ''
        const lastB = sundayStatsMap.get(b.id)?.lastSundayStr ?? ''
        return lastA.localeCompare(lastB)
      })
  }, [funcionarios, sundayStatsMap])

  // Active Tab: 'ia' (IA Escala Assistant), 'modelos' (Recurrent Templates), 'historico' (History & Approvals)
  const [activeTab, setActiveTab] = useState<'ia' | 'modelos' | 'historico'>('ia')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')

  // IA Escala Assistant State
  const [aiTargetDate, setAiTargetDate] = useState<string>(getNextSundayDate())
  const [aiWorkersPerSector, setAiWorkersPerSector] = useState<number>(1)
  const [aiCompensationStrategy, setAiCompensationStrategy] = useState<'folga' | 'hora_extra'>('folga')
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

  const hasChanges = useMemo(() => {
    if (!editando || !originalEditando) return false
    return JSON.stringify(editando) !== JSON.stringify(originalEditando)
  }, [editando, originalEditando])

  const [modeloParaAplicar, setModeloParaAplicar] = useState<ModeloEscala | null>(null)
  const [showAddFunc, setShowAddFunc] = useState(false)
  const [showAplicar, setShowAplicar] = useState(false)
  const [aplicarData, setAplicarData] = useState('')
  const [saving, setSaving] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [desaplicando, setDesaplicando] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const [confirmRemover, setConfirmRemover] = useState<{ date: string; modeloId: string; nome: string; formattedDateStr: string } | null>(null)
  const [modelosAplicados, setModelosAplicados] = useState<Record<string, { modeloId: string; nome: string }>>({})

  // Generate AI Schedule Proposal based on Fair Rotation & Constraints
  const handleGenerateAISchedule = () => {
    if (!aiTargetDate) {
      setMsg('Selecione a data do domingo ou feriado!')
      setMsgType('error')
      return
    }

    setIsGeneratingAI(true)

    setTimeout(() => {
      // Group available active employees by setor
      const sectorGroups = new Map<string, typeof fairRotationRanking>()
      fairRotationRanking.forEach(f => {
        const sector = f.setor || 'Geral'
        const existing = sectorGroups.get(sector) || []
        existing.push(f)
        sectorGroups.set(sector, existing)
      })

      const proposal: AIProposalItem[] = []
      const daysCycle = ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
      let cycleIdx = 0

      // Select top candidates per sector from fair rotation ranking
      sectorGroups.forEach((sectorFuncs, sectorName) => {
        // Take up to aiWorkersPerSector from this sector
        const selected = sectorFuncs.slice(0, Math.max(1, aiWorkersPerSector))

        selected.forEach(f => {
          const stats = sundayStatsMap.get(f.id)
          const workedCount = stats?.count ?? 0
          const compDay = daysCycle[cycleIdx % daysCycle.length]
          cycleIdx++

          // Find a matching locality for this sector if configured
          const locObj = dbLocalidades.find(l => l.setor === sectorName)
          const locName = locObj ? locObj.nome : sectorName

          proposal.push({
            funcionarioId: f.id,
            funcionarioNome: f.nome,
            setor: sectorName,
            cargo: f.cargo || 'Operacional',
            domingosTrabalhados: workedCount,
            modalidade: aiCompensationStrategy,
            diaCompensacao: compDay,
            localidade: locName,
            statusAprovacao: aiCompensationStrategy === 'hora_extra' ? 'sugestao_pendente' : 'aprovado'
          })
        })
      })

      setAiProposal(proposal)
      setIsGeneratingAI(false)
      setShowAIProposalModal(true)
      setMsg('Sugestão de Escala com IA gerada com sucesso!')
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

  // Confirm and Apply AI Scale to Database
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
            : `TRABALHAR POR FOLGA (${labelDia(item.diaCompensacao)})`
        })

        // 2. Compensatory Rest Day Entry (if working for Folga)
        if (!isHE && item.diaCompensacao) {
          const offset = getCompensadoOffset(item.diaCompensacao)
          const compDateStr = format(addDays(targetDateObj, offset), 'yyyy-MM-dd')

          itemsToUpsert.push({
            funcionario_id: item.funcionarioId,
            data: compDateStr,
            tipo: 'compensar',
            turno: 'integral',
            observacoes: `FOLGA COMPENSATÓRIA (DOMINGO ${format(targetDateObj, 'dd/MM')})`
          })
        }
      }

      // Upsert to Escalas database
      await batchUpsert({ items: itemsToUpsert, skipFreqSync: true })

      // Clear frequency table entries for the Sunday so attendance remains pending in Chamada!
      const deletePromises = aiProposal.map(item =>
        supabase.from('frequencia').delete().eq('funcionario_id', item.funcionarioId).eq('data', aiTargetDate)
      )
      await Promise.all(deletePromises)

      await queryClient.invalidateQueries({ queryKey: ['escalas'] })
      await queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      setShowAIProposalModal(false)
      setMsg(`Escala do Domingo ${format(targetDateObj, 'dd/MM/yyyy')} aplicada com sucesso!`)
      setMsgType('success')
    } catch (err: any) {
      console.error('Erro ao aplicar escala de IA:', err)
      setMsg('Erro ao aplicar escala: ' + (err?.message || ''))
      setMsgType('error')
    } finally {
      setAplicando(false)
    }
  }

  // Generate WhatsApp Share Text Report
  const handleOpenShareReport = () => {
    if (!aiTargetDate) return
    const targetDateObj = parseISO(aiTargetDate)
    const formattedDate = format(targetDateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase()

    let text = `📅 *ESCALA DE DOMINGO E FERIADO*\n`
    text += `📆 *Data:* ${formattedDate}\n`
    text += `🤖 *Gerado por Assistente de IA de Escala*\n`
    text += `─────────────────────────\n\n`

    const folgaList = aiProposal.filter(i => i.modalidade === 'folga')
    const heList = aiProposal.filter(i => i.modalidade === 'hora_extra')

    if (folgaList.length > 0) {
      text += `👷 *TRABALHAM POR FOLGA COMPENSATÓRIA (${folgaList.length}):*\n`
      folgaList.forEach(i => {
        text += `• *${i.funcionarioNome}* (${i.setor}) - Folga: *${labelDia(i.diaCompensacao)}*\n`
      })
      text += `\n`
    }

    if (heList.length > 0) {
      text += `⚠️ *SUGESTÕES DE HORA EXTRA (${heList.length}):*\n`
      heList.forEach(i => {
        const statusStr = i.statusAprovacao === 'aprovado' ? '✅ Aprovado' : '⏳ Pendente de Aprovação'
        text += `• *${i.funcionarioNome}* (${i.setor}) [HE] - Status: ${statusStr}\n`
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
        subtitle="Rodízio dominical justo, assistente de IA e sugestões de compensação" 
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
                Assistente de IA
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

        {/* TAB 1: ASSISTENTE DE IA DE ESCALA */}
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
                        IA Ativa
                      </span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                      Gerador inteligente de rodízio dominical. Prioriza automaticamente colaboradores com menos domingos trabalhados e favorece a compensação por folga.
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
                    {isGeneratingAI ? 'Analisando Histórico...' : '⚡ Gerar Escala Inteligente'}
                  </button>
                </div>
              </div>
            </div>

            {/* Painel de Configurações do Gerador de IA */}
            <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-md space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" /> Parâmetros de Geração do Rodízio
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Data do Domingo / Feriado */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Data do Domingo ou Feriado
                  </label>
                  <input
                    type="date"
                    value={aiTargetDate}
                    onChange={e => setAiTargetDate(e.target.value)}
                    className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                  />
                </div>

                {/* Quantidade de Colaboradores por Setor */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Colaboradores por Setor
                  </label>
                  <select
                    value={aiWorkersPerSector}
                    onChange={e => setAiWorkersPerSector(Number(e.target.value))}
                    className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                  >
                    <option value={1}>1 por Setor</option>
                    <option value={2}>2 por Setor</option>
                    <option value={3}>3 por Setor</option>
                    <option value={4}>4 por Setor</option>
                  </select>
                </div>

                {/* Estratégia Preferencial */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Modalidade Preferencial
                  </label>
                  <select
                    value={aiCompensationStrategy}
                    onChange={e => setAiCompensationStrategy(e.target.value as any)}
                    className="w-full bg-muted/50 border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                  >
                    <option value="folga">Trabalhar por Folga (Recomendado)</option>
                    <option value="hora_extra">Sugestão de Hora Extra (Sujeito a Aprovação)</option>
                  </select>
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
                    Histórico dos últimos 90 dias. Colaboradores no topo são os prioritários para o próximo domingo.
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
            {/* Modelos cadastrados existentes */}
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

        {/* MODAL PROPOSTA DA IA */}
        {showAIProposalModal && (
          <Modal
            open={showAIProposalModal}
            onClose={() => setShowAIProposalModal(false)}
            title="Sugestão de Escala de Domingo (IA Assistente)"
          >
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">Escala de Domingo Gerada</h4>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Data: {aiTargetDate}</p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenShareReport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase shadow-md hover:bg-emerald-600 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> Compartlhar WhatsApp
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                {aiProposal.map((item, idx) => (
                  <div key={item.funcionarioId} className="bg-muted/40 border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <h5 className="text-xs font-black uppercase text-foreground">{item.funcionarioNome}</h5>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">{item.setor} • {item.cargo}</span>
                      <span className="text-[8.5px] font-black text-emerald-500 uppercase block mt-1">
                        Domingos Trabalhados (90d): {item.domingosTrabalhados}
                      </span>
                    </div>

                    <div className="text-right space-y-2">
                      {item.modalidade === 'folga' ? (
                        <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 block">
                          Trabalho por Folga ({labelDia(item.diaCompensacao)})
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 block">
                            ⚠️ Sugestão HE ({item.statusAprovacao === 'aprovado' ? 'Aprovado' : 'Pendente Encarregado'})
                          </span>

                          {item.statusAprovacao !== 'aprovado' && (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => handleApproveHE(item.funcionarioId)}
                                className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-500 text-white rounded-lg shadow cursor-pointer"
                              >
                                Aprovar HE
                              </button>

                              <button
                                type="button"
                                onClick={() => handleConvertToFolga(item.funcionarioId)}
                                className="text-[8px] font-black uppercase px-2 py-1 bg-blue-500 text-white rounded-lg shadow cursor-pointer"
                              >
                                Virar Folga
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                  {aplicando ? 'Aplicando Escala...' : 'Confirmar e Aplicar no Domingo'}
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
                rows={10}
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
