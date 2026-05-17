import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  format, 
  isToday, 
  parseISO, 
  addDays, 
  subDays,
  startOfDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
  RotateCcw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal } from '../hooks/useEscalas'
import { useFrequenciaData, useUpsertFrequencia, useBatchUpsertFrequencia, FREQUENCIA_KEY } from '../hooks/useFrequencia'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

interface Localidade {
  id: string
  nome: string
  setor: string
}

export function FrequenciaPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()))
  const [searchTerm, setSearchTerm] = useState('')

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(format(currentDate, 'yyyy-MM'))
  const { data: frequencias = [], isLoading: loadFreq } = useFrequenciaData(format(currentDate, 'yyyy-MM-dd'))
  const { data: localidadesConfig = [] } = useConfiguracao<Localidade[]>('localidades', [])

  const upsertFreqMutation = useUpsertFrequencia()
  const batchFreqMutation = useBatchUpsertFrequencia()

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const freqMap = useMemo(() => {
    const map: Record<string, string> = {}
    frequencias.forEach(f => {
      map[f.funcionario_id] = f.status
    })
    return map
  }, [frequencias])

  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') map[f.id] = f
    })
    return map
  }, [allFuncionarios])

  // Grouping for the "Chamada" - SYNCED WITH ESCALA
  const processedData = useMemo(() => {
    const workingGroups: Record<string, { id: string; nome: string; setor: string; members: any[] }> = {}
    const notWorkingGroups: Record<string, { label: string; icon: any; members: any[]; color: string }> = {
      'folga': { label: 'Folgas', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-blue-500' },
      'ferias': { label: 'Férias', icon: <Calendar className="w-4 h-4" />, members: [], color: 'text-purple-500' },
      'atestado': { label: 'Afastamentos', icon: <Activity className="w-4 h-4" />, members: [], color: 'text-amber-500' },
      'outros': { label: 'Outros', icon: <Clock className="w-4 h-4" />, members: [], color: 'text-slate-500' },
    }
    
    localidadesConfig.forEach(l => {
      workingGroups[l.id] = { ...l, members: [] }
    })
    workingGroups['sem_local'] = { id: 'sem_local', nome: 'Sem Localidade', setor: 'Geral', members: [] }

    const workStatuses = ['presente', 'hora_extra']

    escalas.forEach((e: any) => {
      if (e.data !== dateStr) return
      const f = funcMap[e.funcionario_id]
      if (!f) return

      const member = {
        ...f,
        escalaId: e.id,
        tipoPlanejado: e.tipo, 
        tipoReal: freqMap[f.id] || null, 
        localidade: e.localidade
      }

      if (workStatuses.includes(e.tipo)) {
        const loc = localidadesConfig.find(l => l.nome === e.localidade && l.setor === f.setor)
        const locKey = loc ? loc.id : 'sem_local'
        workingGroups[locKey].members.push(member)
      } else {
        if (e.tipo === 'repouso' || e.tipo === 'compensar') notWorkingGroups['folga'].members.push(member)
        else if (e.tipo === 'ferias') notWorkingGroups['ferias'].members.push(member)
        else if (e.tipo === 'atestado') notWorkingGroups['atestado'].members.push(member)
        else notWorkingGroups['outros'].members.push(member)
      }
    })

    return { workingGroups, notWorkingGroups }
  }, [escalas, dateStr, funcMap, localidadesConfig, freqMap])

  const handleStatus = async (funcionarioId: string, status: any) => {
    try {
      await upsertFreqMutation.mutateAsync({ 
        funcionario_id: funcionarioId, 
        data: dateStr, 
        status 
      })
      toast('Registro atualizado', 'success')
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
      toast(`${pendentes.length} presenças confirmadas!`, 'success')
    } catch (err: any) {
      toast('Erro ao confirmar em lote: ' + err.message, 'error')
    }
  }

  const prevDay = () => setCurrentDate(subDays(currentDate, 1))
  const nextDay = () => setCurrentDate(addDays(currentDate, 1))

  if (loadF || loadE || loadFreq) return <div className="min-h-screen bg-background"><TopHeader title="Chamada" /><div className="py-32"><Loading text="Sincronizando com a escala..." /></div></div>

  const { workingGroups, notWorkingGroups } = processedData
  const allWorkingMembers = Object.values(workingGroups).flatMap(g => g.members)
  const pendingCount = allWorkingMembers.filter(m => !m.tipoReal).length
  const presentCount = allWorkingMembers.filter(m => m.tipoReal === 'presente' || m.tipoReal === 'hora_extra').length
  const absentCount = allWorkingMembers.filter(m => m.tipoReal === 'falta').length
  
  const filteredSearch = (m: any) => m.nome.toLowerCase().includes(searchTerm.toLowerCase())

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopHeader 
        title="Controle de Efetivo" 
        subtitle={format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} 
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Native-Style Control Bar */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-4 shadow-xl mb-10 sticky top-24 z-30 transform-gpu transition-all">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30 w-full md:w-auto">
              <button onClick={prevDay} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex-1 md:min-w-[160px] text-center">
                <p className="text-[9px] font-black uppercase text-primary tracking-widest">{isToday(currentDate) ? 'Hoje' : format(currentDate, 'EEE', { locale: ptBR })}</p>
                <p className="text-sm font-black text-foreground">{format(currentDate, 'dd/MM/yyyy')}</p>
              </div>
              <button onClick={nextDay} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronRight className="w-5 h-5" /></button>
            </div>

            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60" />
              <input 
                type="text" 
                placeholder="Buscar pelo nome..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-transparent focus:border-primary/20 rounded-[1.75rem] text-sm font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
               <div className="hidden lg:flex items-center gap-1.5 bg-background/50 p-1.5 rounded-full border border-border/30">
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full", pendingCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", pendingCount > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {pendingCount > 0 ? `${pendingCount} PENDENTES` : 'CONCLUÍDO'}
                  </span>
                </div>
              </div>
              <Button 
                onClick={async () => {
                  if (!confirm('Deseja limpar todos os registros de presença de hoje e voltar ao estado inicial pendente?')) return
                  try {
                    await supabase.from('frequencia').delete().eq('data', dateStr)
                    toast('Chamada resetada com sucesso', 'success')
                    queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
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
              <Button 
                onClick={() => handleConfirmAll(allWorkingMembers)}
                disabled={pendingCount === 0}
                className="flex-1 md:flex-none rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest h-12 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
              >
                <Zap className="w-4 h-4" /> Confirmar Todos
              </Button>
            </div>
          </div>
        </div>

        {/* Tactical Grid */}
        <div className="space-y-16">
          {Object.values(workingGroups)
            .filter(g => g.members.some(filteredSearch))
            .map(group => {
              const groupPendentes = group.members.filter(m => !m.tipoReal).length
              return (
                <div key={group.id} className="animate-fade-in">
                  <div className="flex items-end justify-between mb-8 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.6)]",
                          groupPendentes > 0 ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">{group.nome}</h3>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-4">{group.setor}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black text-foreground leading-none">
                        {group.members.filter(m => m.tipoReal && filteredSearch(m)).length}
                      </span>
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Confirmados de {group.members.filter(filteredSearch).length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.members
                      .filter(filteredSearch)
                      .map(member => (
                        <div key={member.id} className={cn(
                          "relative bg-card/80 dark:bg-card/40 backdrop-blur-xl border rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 group overflow-hidden",
                          !member.tipoReal ? "border-amber-500/30 ring-1 ring-amber-500/10" : "border-border/50"
                        )}>
                          {/* Status Accent Bar */}
                          <div className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-r-full transition-all duration-500",
                            member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? "bg-emerald-500" : 
                            member.tipoReal === 'falta' ? "bg-rose-500" : "bg-amber-500 animate-pulse"
                          )} />

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={cn(
                                "w-14 h-14 rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-inner shrink-0 transition-transform group-hover:scale-110 duration-500",
                                member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? "bg-emerald-500/10 text-emerald-600" : 
                                member.tipoReal === 'falta' ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"
                              )}>
                                {(member.apelido || member.nome).substring(0, 1)}
                              </div>
                              <div className="truncate">
                                <p className="text-base font-black text-foreground truncate leading-tight tracking-tight">{member.apelido || member.nome}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="default" className="text-[8px] font-black uppercase px-1.5 py-0 bg-muted/30 text-muted-foreground/60 border-transparent">
                                    {member.cargo}
                                  </Badge>
                                  {!member.tipoReal && (
                                    <Badge variant="default" className="text-[7px] font-black uppercase px-1.5 py-0 bg-amber-500 text-white border-transparent animate-bounce">
                                      Confirmar?
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {member.tipoReal && (
                                <button 
                                  onClick={async () => {
                                    try {
                                      await supabase.from('frequencia').delete().eq('funcionario_id', member.id).eq('data', dateStr)
                                      toast('Registro removido', 'success')
                                      queryClient.invalidateQueries({ queryKey: FREQUENCIA_KEY })
                                      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                                    } catch (err: any) {
                                      toast('Erro ao remover: ' + err.message, 'error')
                                    }
                                  }}
                                  className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-muted/30 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all border border-transparent"
                                  title="Remover Confirmação"
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleStatus(member.id, 'falta')}
                                className={cn(
                                  "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all active:scale-90 shadow-md border-2",
                                  member.tipoReal === 'falta' ? "bg-rose-600 border-rose-600 text-white shadow-rose-500/30" : "bg-muted/50 border-transparent text-muted-foreground hover:border-rose-500/50 hover:text-rose-500"
                                )}
                              >
                                <X className="w-6 h-6" />
                              </button>
                              <button 
                                onClick={() => handleStatus(member.id, 'presente')}
                                className={cn(
                                  "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all active:scale-90 shadow-md border-2",
                                  member.tipoReal === 'presente' || member.tipoReal === 'hora_extra' ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/30" : "bg-muted/50 border-transparent text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-500"
                                )}
                              >
                                <Check className="w-6 h-6" />
                              </button>
                            </div>
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
                          <div key={member.id} className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-4 flex items-center gap-4 group hover:border-primary/30 transition-all shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border/50 shadow-inner">
                              {(member.apelido || member.nome).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-foreground truncate uppercase">{member.apelido || member.nome}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className={cn("text-[9px] font-black uppercase tracking-tighter", group.color)}>{member.tipoPlanejado}</p>
                                {member.tipoReal && (
                                   <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                      <span className="text-[7px] font-black text-emerald-600 uppercase">Validado</span>
                                   </div>
                                )}
                              </div>
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

      {/* Floating Summary Bar (Native App Style) */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-[400px] animate-slide-up">
        <div className="bg-foreground text-background dark:bg-card/90 dark:text-foreground backdrop-blur-2xl rounded-full p-2 pl-6 flex items-center justify-between shadow-2xl border border-white/10">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Operação em Campo</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black tracking-tight">{presentCount} Ok</span>
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <span className="text-sm font-black tracking-tight">{absentCount} Faltas</span>
                {pendingCount > 0 && (
                   <>
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-sm font-black tracking-tight text-amber-400">{pendingCount} ?</span>
                   </>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <ChevronRight className="w-6 h-6 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  )
}
