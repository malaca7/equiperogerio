import React, { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  Search, 
  FileText, 
  X, 
  Plus, 
  History, 
  Trash2, 
  Calendar, 
  ClipboardList, 
  Users, 
  CheckCircle2, 
  RotateCw,
  MapPin,
  Sparkles,
  Building2,
  FolderOpen,
  Edit2
} from 'lucide-react'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { useToast } from '../components/ui/Toast'

interface Demanda {
  id: string
  titulo: string
  tipo: 'check' | 'always'
  concluido: boolean
}

interface Localidade {
  id: string
  nome: string
  setor: string
  equipe_id?: string | null
}

interface HistoricoRealizacao {
  id: string
  demandaId: string
  demandaTitulo: string
  data: string            // YYYY-MM-DD
  equipeId?: string | null
  equipeNome?: string | null
  concluidoPor?: string
  tipo: 'realizada' | 'continuo'
}

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

export default function DemandasPage() {
  const { hasAnyPermission } = useAuth()
  const canEdit = hasAnyPermission('localidades') // Permission shared with Meta e Rota
  const { toast } = useToast()

  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const dateKey = `equipes_meta_${dateStr}`

  // Data fetching
  const { data: globalDemandas = [], refetch: refetchDemandas } = useConfiguracao<Demanda[]>('demandas', [])
  const { data: demandasHistorico = [], refetch: refetchHistorico } = useConfiguracao<HistoricoRealizacao[]>('demandas_historico', [])
  const { data: equipesMeta = {}, refetch: refetchMeta } = useConfiguracao<Record<string, any>>(dateKey, {})
  const { data: dbLocalidades = [] } = useConfiguracao<Localidade[]>('localidades', [])
  


  const { mutateAsync: updateConfigMut } = useUpdateConfiguracao()

  const [activeTab, setActiveTab] = useState<'monitor' | 'cadastro' | 'historico'>(() => {
    return (localStorage.getItem('7boss_demandas_active_tab') as any) || 'monitor'
  })

  useEffect(() => {
    localStorage.setItem('7boss_demandas_active_tab', activeTab)
  }, [activeTab])

  const [demSearch, setDemSearch] = useState('')
  const [demStatusFilter, setDemStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [newDemTitle, setNewDemTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  // Completion modal state
  const [completionModalDem, setCompletionModalDem] = useState<Demanda | null>(null)
  const [completionTeamId, setCompletionTeamId] = useState<string>('')
  const [completionDate, setCompletionDate] = useState<string>(dateStr)
  const [completionType, setCompletionType] = useState<'realizada' | 'continuo'>('realizada')

  // History Filter states
  const [histSearch, setHistSearch] = useState('')
  const [histTeamFilter, setHistTeamFilter] = useState<string>('all')
  const [histDateFilter, setHistDateFilter] = useState<string>('')

  // Edit demand state
  const [editingDemandId, setEditingDemandId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingTipo, setEditingTipo] = useState<'check' | 'always'>('check')


  // Filters for active demands (Registry view)
  const filteredDemandasList = useMemo(() => {
    return globalDemandas.filter(d => {
      if (demSearch.trim() && !matchesFuzzy(d.titulo, demSearch)) {
        return false
      }
      
      const isCompletedToday = demandasHistorico.some(h => h.demandaId === d.id && h.data === dateStr)
      if (demStatusFilter === 'pending' && isCompletedToday) return false
      if (demStatusFilter === 'completed' && !isCompletedToday) return false
      
      return true
    })
  }, [globalDemandas, demSearch, demStatusFilter, demandasHistorico, dateStr])

  // Filters for history completions
  const filteredHistoryList = useMemo(() => {
    return demandasHistorico.filter(h => {
      if (histSearch.trim() && !matchesFuzzy(h.demandaTitulo, histSearch)) {
        return false
      }
      if (histTeamFilter !== 'all') {
        if (h.equipeId !== histTeamFilter && !(histTeamFilter === 'general' && !h.equipeId)) {
          return false
        }
      }
      if (histDateFilter && h.data !== histDateFilter) return false
      return true
    })
  }, [demandasHistorico, histSearch, histTeamFilter, histDateFilter])

  // Create new demand action
  const handleCreateDemand = async () => {
    const val = newDemTitle.trim()
    if (!val) return
    
    setIsSubmitting(true)
    try {
      if (globalDemandas.some(d => d.titulo.toLowerCase() === val.toLowerCase())) {
        toast('Uma demanda com esse título já existe!', 'error')
        setIsSubmitting(false)
        return
      }

      const newDem: Demanda = {
        id: safeUUID(),
        titulo: val.toUpperCase(),
        tipo: 'check',
        concluido: false
      }

      const updated = [...globalDemandas, newDem]
      await updateConfigMut({ chave: 'demandas', valor: updated })
      setNewDemTitle('')
      toast('Demanda criada com sucesso!', 'success')
      refetchDemandas()
    } catch (err) {
      console.error('Error creating demand:', err)
      toast('Erro ao criar demanda.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick toggle realization cycle directly from the Daily Monitoring
  const handleToggleDemand = async (demId: string, demTitulo: string, equipeId: string, equipeNome: string) => {
    if (!canEdit) return
    const existing = demandasHistorico.find(
      h => h.demandaId === demId && h.data === dateStr && h.equipeId === equipeId
    )

    let updatedHistory: HistoricoRealizacao[]
    if (!existing) {
      // Cycle 1: Mark as Realizada (Checked)
      const newEntry: HistoricoRealizacao = {
        id: safeUUID(),
        demandaId: demId,
        demandaTitulo: demTitulo,
        data: dateStr,
        equipeId,
        equipeNome,
        tipo: 'realizada'
      }
      updatedHistory = [newEntry, ...demandasHistorico]
      toast(`"${demTitulo}" marcada como Concluída ✅`, 'success')
    } else if (existing.tipo === 'realizada') {
      // Cycle 2: Switch to Em Progresso (Continuous)
      updatedHistory = demandasHistorico.map(h => 
        h.id === existing.id ? { ...h, tipo: 'continuo' as const } : h
      )
      toast(`"${demTitulo}" marcada como Em Progresso 🔁`, 'info')
    } else {
      // Cycle 3: Revert to Pending (delete entry)
      updatedHistory = demandasHistorico.filter(h => h.id !== existing.id)
      toast(`"${demTitulo}" removida do monitoramento diário.`, 'warning')
    }

    try {
      await updateConfigMut({ chave: 'demandas_historico', valor: updatedHistory })
      refetchHistorico()
    } catch (err) {
      console.error('Error cycling realization:', err)
      toast('Erro ao atualizar status da demanda.', 'error')
    }
  }

  // Open modal to register a custom/past completion entry
  const handleOpenCompletionModal = (dem: Demanda) => {
    setCompletionModalDem(dem)
    setCompletionTeamId('')
    setCompletionDate(dateStr)
    setCompletionType('realizada')
  }

  // Save the custom completion entry
  const handleSaveRealization = async () => {
    if (!completionModalDem) return
    try {
      const selectedLoc = dbLocalidades.find(l => l.id === completionTeamId)
      const newEntry: HistoricoRealizacao = {
        id: safeUUID(),
        demandaId: completionModalDem.id,
        demandaTitulo: completionModalDem.titulo,
        data: completionDate,
        equipeId: completionTeamId || null,
        equipeNome: selectedLoc ? selectedLoc.nome : 'GERAL/DIRETO',
        tipo: completionType
      }

      const updated = [newEntry, ...demandasHistorico]
      await updateConfigMut({ chave: 'demandas_historico', valor: updated })
      toast('Realização registrada no histórico!', 'success')
      setCompletionModalDem(null)
      refetchHistorico()
    } catch (err) {
      console.error('Error saving completion entry:', err)
      toast('Erro ao registrar realização.', 'error')
    }
  }

  // Save edited demand properties
  const handleSaveEditDemand = async (demId: string) => {
    if (!editingTitle.trim()) {
      toast('O título da demanda não pode ser vazio.', 'error')
      return
    }

    try {
      const updatedList = globalDemandas.map(d => {
        if (d.id === demId) {
          return {
            ...d,
            titulo: editingTitle.trim().toUpperCase(),
            tipo: editingTipo
          }
        }
        return d
      })

      // Update global config
      await updateConfigMut({ chave: 'demandas', valor: updatedList })
      
      // Update history reference titles so they match the new name
      const updatedHistory = demandasHistorico.map(h => {
        if (h.demandaId === demId) {
          return {
            ...h,
            demandaTitulo: editingTitle.trim().toUpperCase()
          }
        }
        return h
      })
      await updateConfigMut({ chave: 'demandas_historico', valor: updatedHistory })

      toast('Demanda atualizada com sucesso!', 'success')
      setEditingDemandId(null)
      refetchDemandas()
      refetchHistorico()
    } catch (err) {
      console.error('Error updating demand:', err)
      toast('Erro ao atualizar demanda.', 'error')
    }
  }

  // Delete demand and clean up references
  const handleDeleteDemand = async (dem: Demanda) => {
    if (!canEdit) return
    if (!confirm(`Tem certeza que deseja excluir permanentemente a demanda "${dem.titulo}"?`)) return

    try {
      // 1. Remove from global list
      const updatedList = globalDemandas.filter(d => d.id !== dem.id)
      await updateConfigMut({ chave: 'demandas', valor: updatedList })

      // 2. Remove reference from today's team allocations
      let teamMetaChanged = false
      const updatedMeta = { ...equipesMeta }
      Object.keys(updatedMeta).forEach(teamId => {
        const teamMeta = updatedMeta[teamId]
        if (teamMeta?.demandas?.includes(dem.id)) {
          updatedMeta[teamId] = {
            ...teamMeta,
            demandas: teamMeta.demandas.filter((id: string) => id !== dem.id)
          }
          teamMetaChanged = true
        }
      })
      if (teamMetaChanged) {
        await updateConfigMut({ chave: dateKey, valor: updatedMeta })
        refetchMeta()
      }

      // 3. Remove history entries for this demand
      const updatedHistory = demandasHistorico.filter(h => h.demandaId !== dem.id)
      await updateConfigMut({ chave: 'demandas_historico', valor: updatedHistory })

      toast('Demanda excluída com sucesso!', 'success')
      refetchDemandas()
      refetchHistorico()
    } catch (err) {
      console.error('Error deleting demand:', err)
      toast('Erro ao excluir demanda.', 'error')
    }
  }

  // Delete history entry (undo completion)
  const handleDeleteHistoryEntry = async (entryId: string) => {
    if (!canEdit) return
    if (!confirm('Deseja reabrir esta demanda e remover este registro do histórico?')) return
    try {
      const updated = demandasHistorico.filter(h => h.id !== entryId)
      await updateConfigMut({ chave: 'demandas_historico', valor: updated })
      toast('Realização removida do histórico!', 'success')
      refetchHistorico()
    } catch (err) {
      console.error('Error deleting history entry:', err)
      toast('Erro ao remover realização.', 'error')
    }
  }

  // Group active daily allocations by team/locality
  const dailyAllocations = useMemo(() => {
    return dbLocalidades.map(loc => {
      const meta = equipesMeta[loc.id] || {}
      const linkedDemandIds = meta.demandas || []
      
      const demandsList = linkedDemandIds.map((id: string) => {
        const d = globalDemandas.find(g => g.id === id)
        const hist = demandasHistorico.find(
          h => h.demandaId === id && h.data === dateStr && h.equipeId === loc.id
        )
        return {
          id,
          titulo: d ? d.titulo : 'Demanda Removida',
          status: hist ? hist.tipo : 'pendente'
        }
      })

      const completed = demandsList.filter((d: any) => d.status !== 'pendente').length
      const total = demandsList.length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        ...loc,
        demands: demandsList,
        completed,
        total,
        percentage
      }
    }).filter(team => team.total > 0)
  }, [dbLocalidades, equipesMeta, globalDemandas, demandasHistorico, dateStr])

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Painel de Demandas" subtitle="Monitoramento diário, cadastro e histórico operacional" />

      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-24 sm:pt-32 pb-24 space-y-6 sm:space-y-8 animate-fade-in">
        

        {/* Tab switch navigation */}
        <div className="flex gap-1 p-1 bg-card/60 dark:bg-card/20 border border-border/40 rounded-[1.25rem] w-full sm:w-fit shrink-0">
          <button
            onClick={() => setActiveTab('monitor')}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-initial",
              activeTab === 'monitor'
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="inline sm:hidden">Monitor</span>
            <span className="hidden sm:inline">Monitoramento Diário</span>
          </button>
          <button
            onClick={() => setActiveTab('cadastro')}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-initial",
              activeTab === 'cadastro'
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="inline sm:hidden">Cadastro ({globalDemandas.length})</span>
            <span className="hidden sm:inline">Cadastro ({globalDemandas.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-initial",
              activeTab === 'historico'
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="inline sm:hidden">Histórico</span>
            <span className="hidden sm:inline">Histórico Geral</span>
          </button>
        </div>

        {/* Tab 1: Daily Monitor */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="bg-card/75 dark:bg-card/30 backdrop-blur-xl border border-border/40 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Monitor Operacional de Hoje
                </h3>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  Demandas vinculadas e andamento das equipes para o dia {format(new Date(), 'dd/MM/yyyy')}
                </p>
              </div>
              <div className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground/80 bg-muted/40 border border-border/20 px-3.5 py-2 rounded-xl leading-relaxed">
                DICA: Clique nas demandas para ciclar o status: Pendente ➡️ Resolvido (✅) ➡️ Em Progresso (🔁)
              </div>
            </div>

            {dailyAllocations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {dailyAllocations.map(team => (
                  <div 
                    key={team.id}
                    className="bg-card/80 dark:bg-card/25 border border-border/30 rounded-[1.8rem] sm:rounded-[2.2rem] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm hover:shadow-md transition-all hover:border-primary/10"
                  >
                    {/* Team Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <h4 className="text-sm font-black text-foreground uppercase tracking-wider">{team.nome}</h4>
                        </div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-6 mt-0.5">{team.setor}</p>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs font-black text-foreground">{team.completed} / {team.total}</span>
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mt-0.5">Concluídas ({team.percentage}%)</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          team.percentage === 100 ? "bg-emerald-500" : "bg-primary"
                        )}
                        style={{ width: `${team.percentage}%` }}
                      />
                    </div>

                    {/* Interactive Demand Grid */}
                    <div className="flex flex-wrap gap-2 pt-1 sm:pt-2">
                      {team.demands.map((dem: any) => {
                        const isCompleted = dem.status === 'realizada'
                        const isContinuous = dem.status === 'continuo'
                        const isPending = dem.status === 'pendente'

                        return (
                          <button
                            key={dem.id}
                            disabled={!canEdit}
                            onClick={() => handleToggleDemand(dem.id, dem.titulo, team.id, team.nome)}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all duration-300 shadow-sm outline-none text-left shrink-0 max-w-full",
                              canEdit ? "cursor-pointer active:scale-95" : "cursor-default opacity-85",
                              isCompleted && "bg-emerald-500/10 text-emerald-600 border-emerald-500/35 hover:bg-emerald-500/20",
                              isContinuous && "bg-white dark:bg-blue-950/40 text-blue-600 dark:text-blue-455 border-blue-500 hover:bg-blue-500/5",
                              isPending && "bg-muted/40 hover:bg-muted/70 text-foreground border-border/30"
                            )}
                          >
                            {isCompleted && <span className="text-[10px] sm:text-[12px] leading-none">✅</span>}
                            {isContinuous && <span className="text-[10px] sm:text-[12px] leading-none">🔁</span>}
                            {isPending && <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />}
                            <span className="truncate max-w-[170px] sm:max-w-[200px]">{dem.titulo}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card/75 dark:bg-card/30 backdrop-blur-xl border border-border/40 p-10 sm:p-16 rounded-[2rem] text-center max-w-2xl mx-auto opacity-70">
                <FolderOpen className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Nenhuma Alocação Hoje</h4>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2 max-w-md mx-auto leading-relaxed">
                  Para visualizar e monitorar demandas aqui, vincule demandas às equipes/localidades no planejamento de <strong>Meta e Rota</strong> para o dia de hoje.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Demand Registry */}
        {activeTab === 'cadastro' && (
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-card/75 dark:bg-card/30 backdrop-blur-xl border border-border/40 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm relative z-20">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/65" />
                  <input
                    type="text"
                    placeholder="Buscar demanda..."
                    value={demSearch}
                    onChange={e => setDemSearch(e.target.value)}
                    className="w-full pl-11 pr-4 h-12 bg-background border border-border/30 rounded-2xl text-xs font-bold focus:border-primary/50 outline-none transition-all uppercase tracking-wider"
                  />
                </div>
                
                <select
                  value={demStatusFilter}
                  onChange={e => setDemStatusFilter(e.target.value as any)}
                  className="bg-background border border-border/30 rounded-2xl px-4 h-12 text-xs font-bold outline-none text-foreground uppercase tracking-wider cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">Todos os Status Hoje</option>
                  <option value="pending">Pendentes Hoje</option>
                  <option value="completed">Concluídas Hoje</option>
                </select>
              </div>

              {/* Create New Demand */}
              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border-t lg:border-t-0 lg:border-l border-border/25 pt-4 lg:pt-0 lg:pl-6 relative">
                  <div className="relative w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Nova demanda..."
                      value={newDemTitle}
                      onFocus={() => setIsInputFocused(true)}
                      onChange={e => setNewDemTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isSubmitting && handleCreateDemand()}
                      className="bg-background border border-border/30 rounded-2xl px-4 h-12 text-xs font-bold focus:border-primary/50 outline-none transition-all placeholder:text-[10px] w-full sm:w-56 uppercase"
                    />
                    
                    {(() => {
                      if (!isInputFocused || !newDemTitle.trim()) return null;
                      const matches = newDemTitle.trim()
                        ? globalDemandas.filter(d => matchesFuzzy(d.titulo, newDemTitle))
                        : [];
                      
                      if (matches.length === 0) return null;

                      return (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsInputFocused(false)} />
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border/50 rounded-2xl shadow-xl z-[9999] divide-y divide-border/10 py-1">
                            {matches.map(d => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setNewDemTitle(d.titulo)
                                  setIsInputFocused(false)
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-muted/80 text-foreground uppercase truncate cursor-pointer block"
                              >
                                {d.titulo} <span className="text-[8px] font-black text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full ml-1 shrink-0">EXISTENTE</span>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCreateDemand}
                    className="bg-primary hover:bg-primary/90 text-white font-black text-[10px] uppercase tracking-widest px-6 h-12 rounded-2xl active:scale-95 transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar
                  </button>
                </div>
              )}
            </div>

            {/* Registry Grid List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredDemandasList.map(dem => {
                const completionsToday = demandasHistorico.filter(
                  h => h.demandaId === dem.id && h.data === dateStr
                )
                const isCompletedToday = completionsToday.length > 0
                const totalCompletions = demandasHistorico.filter(h => h.demandaId === dem.id).length
                
                return (
                  <div
                    key={dem.id}
                    className={cn(
                      "bg-card/75 dark:bg-card/30 backdrop-blur-xl border rounded-[1.5rem] sm:rounded-[1.8rem] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] min-h-[135px] sm:min-h-[145px]",
                      isCompletedToday 
                        ? "border-emerald-500/30 shadow-emerald-500/[0.01]" 
                        : "border-border/40 hover:border-primary/20"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider border leading-none",
                          isCompletedToday 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border/20"
                        )}>
                          {isCompletedToday ? 'Concluída Hoje' : 'Pendente'}
                        </span>
                        
                        {canEdit && editingDemandId !== dem.id && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setEditingDemandId(dem.id)
                                setEditingTitle(dem.titulo)
                                setEditingTipo(dem.tipo || 'check')
                              }}
                              className="p-1 text-muted-foreground/45 hover:text-primary transition-colors cursor-pointer"
                              title="Editar demanda"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDemand(dem)}
                              className="p-1 text-muted-foreground/45 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Excluir demanda permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingDemandId === dem.id ? (
                        <div className="space-y-2 mt-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            className="w-full bg-background border border-border/40 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:border-primary/50 outline-none uppercase"
                            placeholder="Título da demanda"
                            autoFocus
                          />
                          
                          <div className="flex gap-2 items-center justify-between mt-1.5">
                            <span className="text-[8px] font-black uppercase text-muted-foreground">Tipo:</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingTipo('check')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                                  editingTipo === 'check'
                                    ? "bg-amber-500/10 text-amber-650 border-amber-500/35"
                                    : "text-muted-foreground border-border/20 hover:bg-muted"
                                )}
                              >
                                Check
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTipo('always')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                                  editingTipo === 'always'
                                    ? "bg-indigo-500/10 text-indigo-650 border-indigo-500/35"
                                    : "text-muted-foreground border-border/20 hover:bg-muted"
                                )}
                              >
                                Em Progresso
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-border/10">
                            <button
                              type="button"
                              onClick={() => setEditingDemandId(null)}
                              className="px-2 py-1 bg-muted hover:bg-muted/80 text-[8px] font-black uppercase tracking-wider rounded-lg text-muted-foreground cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditDemand(dem.id)}
                              className="px-2 py-1 bg-primary text-white hover:bg-primary/95 text-[8px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-xs font-black text-foreground uppercase tracking-tight leading-tight line-clamp-2 pr-2">
                            {dem.titulo}
                          </h4>
                          <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-wider flex items-center gap-1">
                            <RotateCw className="w-2.5 h-2.5" />
                            Realizada {totalCompletions} vez{totalCompletions !== 1 ? 'es' : ''} no total
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between gap-2">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Histórico</span>
                      
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOpenCompletionModal(dem)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary/95 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        Lançar Registro
                      </button>
                    </div>
                  </div>
                )
              })}

              {filteredDemandasList.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30">
                  <FileText className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhuma demanda encontrada</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Realizations History */}
        {activeTab === 'historico' && (
          <div className="bg-card/75 dark:bg-card/30 backdrop-blur-xl border border-border/40 rounded-2xl sm:rounded-[2.2rem] p-4 sm:p-6 shadow-sm space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Histórico de Lançamentos
                </h3>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  Registros consolidados de demandas concluídas no sistema
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <div className="relative w-full sm:min-w-[200px] sm:flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                  <input
                    type="text"
                    placeholder="Filtrar demanda..."
                    value={histSearch}
                    onChange={e => setHistSearch(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 bg-background border border-border/30 rounded-2xl text-xs font-bold focus:border-primary/50 outline-none transition-all uppercase tracking-wider"
                  />
                </div>

                <select
                  value={histTeamFilter}
                  onChange={e => setHistTeamFilter(e.target.value)}
                  className="bg-background border border-border/30 rounded-2xl px-4 h-11 text-xs font-bold outline-none text-foreground uppercase tracking-wider cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">Todas as Equipes</option>
                  <option value="general">Geral / Direto</option>
                  {dbLocalidades.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.nome}</option>
                  ))}
                </select>

                <div className="relative w-full sm:w-auto">
                  <input
                    type="date"
                    value={histDateFilter}
                    onChange={e => setHistDateFilter(e.target.value)}
                    className="bg-background border border-border/30 rounded-2xl px-4 h-11 text-xs font-bold focus:border-primary/50 outline-none transition-all text-foreground cursor-pointer w-full"
                  />
                </div>

                {histDateFilter && (
                  <button
                    onClick={() => setHistDateFilter('')}
                    className="px-4 h-11 bg-muted hover:bg-muted/80 rounded-2xl text-xs font-black text-muted-foreground uppercase transition-all cursor-pointer w-full sm:w-auto"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {filteredHistoryList.length > 0 ? (
              <div className="space-y-4">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border/20 text-left">
                        <th className="pb-3 pl-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Demanda</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Equipe / Localidade</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Registro</th>
                        {canEdit && <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-2">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {filteredHistoryList.map((entry) => {
                        let formattedDate = entry.data
                        try {
                          const [yr, mo, dy] = entry.data.split('-')
                          formattedDate = `${dy}/${mo}/${yr}`
                        } catch {}

                        const isCont = entry.tipo === 'continuo'

                        return (
                          <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-4 pl-2 text-xs font-bold text-foreground">
                              <span className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground/50" />
                                {formattedDate}
                              </span>
                            </td>
                            <td className="py-4 text-xs font-black text-foreground uppercase tracking-wider pr-4">
                              {entry.demandaTitulo}
                            </td>
                            <td className="py-4 text-xs font-bold text-muted-foreground uppercase">
                              {entry.equipeNome || 'GERAL/DIRETO'}
                            </td>
                            <td className="py-4 text-xs">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border gap-1.5",
                                isCont 
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-650 border-emerald-500/20"
                              )}>
                                {isCont ? (
                                  <>
                                    <span>🔁</span>
                                    <span>Em Progresso</span>
                                  </>
                                ) : (
                                  <>
                                    <span>✅</span>
                                    <span>Realizada</span>
                                  </>
                                )}
                              </span>
                            </td>
                            {canEdit && (
                              <td className="py-4 text-right pr-2">
                                <button
                                  onClick={() => handleDeleteHistoryEntry(entry.id)}
                                  className="inline-flex items-center justify-center p-2 text-muted-foreground/45 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                                  title="Reabrir Demanda (Remover do Histórico)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="md:hidden grid grid-cols-1 gap-3">
                  {filteredHistoryList.map((entry) => {
                    let formattedDate = entry.data
                    try {
                      const [yr, mo, dy] = entry.data.split('-')
                      formattedDate = `${dy}/${mo}/${yr}`
                    } catch {}

                    const isCont = entry.tipo === 'continuo'

                    return (
                      <div 
                        key={entry.id}
                        className="bg-background border border-border/20 rounded-[1.2rem] p-4 flex flex-col gap-2.5 shadow-sm"
                      >
                        <div className="flex justify-between items-center border-b border-border/10 pb-2.5">
                          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                            {formattedDate}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 leading-none shrink-0",
                            isCont 
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-650 border-emerald-500/20"
                          )}>
                            {isCont ? '🔁 Em Progresso' : '✅ Realizada'}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteHistoryEntry(entry.id)}
                              className="p-1.5 text-muted-foreground/45 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Reabrir Demanda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-0.5">
                          <div className="space-y-0.5">
                            <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground block">Demanda</span>
                            <h4 className="text-[10px] font-black uppercase text-foreground leading-tight tracking-wide line-clamp-2">
                              {entry.demandaTitulo}
                            </h4>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground block">Equipe / Local</span>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground/80 truncate">
                              {entry.equipeNome || 'GERAL/DIRETO'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center opacity-30">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhuma realização encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Completion Modal Attribution Popup */}
      {completionModalDem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border/50 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Registrar Realização
              </h3>
              <button 
                onClick={() => setCompletionModalDem(null)} 
                className="p-1.5 hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Demanda</label>
              <p className="text-xs font-black uppercase text-foreground bg-muted/40 p-4 rounded-2xl border border-border/20">
                {completionModalDem.titulo}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Equipe / Localidade Responsável
                </label>
                <select
                  value={completionTeamId}
                  onChange={e => setCompletionTeamId(e.target.value)}
                  className="w-full bg-background border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold focus:border-primary/50 outline-none transition-all uppercase cursor-pointer"
                >
                  <option value="">Geral / Direto (Sem Equipe Específica)</option>
                  {dbLocalidades.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nome} ({loc.setor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCompletionType('realizada')}
                    className={cn(
                      "py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 cursor-pointer",
                      completionType === 'realizada'
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/35 shadow-sm"
                        : "bg-transparent border-border/30 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span>✅</span>
                    Realizada
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionType('continuo')}
                    className={cn(
                      "py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 cursor-pointer",
                      completionType === 'continuo'
                        ? "bg-white dark:bg-blue-950/40 text-blue-600 dark:text-blue-455 border-blue-500 shadow-sm"
                        : "bg-transparent border-border/30 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span>🔁</span>
                    Em Progresso
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Data de Realização
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={e => setCompletionDate(e.target.value)}
                  className="w-full bg-background border border-border/30 rounded-2xl px-4 py-3 text-xs font-bold focus:border-primary/50 outline-none transition-all text-foreground cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setCompletionModalDem(null)}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRealization}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirmar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
