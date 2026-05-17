import React, { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameMonth, isToday as checkIsToday, isSunday, parseISO, subDays, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Printer, Search, Check, MapPin, Calendar, LayoutGrid, LayoutList, Target, User, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useEscalasPeriodo, useBatchUpsertEscalas, useUpdateEscala, useDeleteEscala } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { cn } from '../lib/utils'
import type { TipoEscala } from './ConfiguracoesPage'
import { DEFAULT_TIPOS_ESCALA } from './ConfiguracoesPage'

// Os status agora são carregados dinamicamente das configurações

export function EscalaGradePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [activeCell, setActiveCell] = useState<{ funcId: string; date: string } | null>(null)
  const [generateModal, setGenerateModal] = useState(false)

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const funcionarios = useMemo(() => allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado'), [allFuncionarios])
  
  const days = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      return eachDayOfInterval({ start, end })
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate, viewMode])

  // Buscar escalas baseadas no período visível (resolve problema de virada de mês na visão semanal)
  // Buscar escalas com margem de segurança para evitar problemas de limite (dia 31)
  const startDateStr = format(subDays(days[0], 1), 'yyyy-MM-dd')
  const endDateStr = format(addDays(days[days.length - 1], 1), 'yyyy-MM-dd')
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(startDateStr, endDateStr)

  const batchMutation = useBatchUpsertEscalas()
  const updateMutation = useUpdateEscala()
  const deleteMutation = useDeleteEscala()

  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: localidadesList = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const STATUS_CONFIG: Record<string, TipoEscala> = useMemo(() => {
    return (tiposEscala || DEFAULT_TIPOS_ESCALA).reduce((acc, t) => {
      acc[t.id] = t
      return acc
    }, {} as Record<string, TipoEscala>)
  }, [tiposEscala])

  const escalaMap = useMemo(() => {
    return (escalas as any[]).reduce((acc, e) => {
      // Extração robusta da parte da data (YYYY-MM-DD) ignorando fuso horário
      const dateKey = e.data.split('T')[0]
      acc[`${e.funcionario_id}_${dateKey}`] = e
      return acc
    }, {} as Record<string, any>)
  }, [escalas])
  
  const [draggedCell, setDraggedCell] = useState<{ funcId: string, date: string } | null>(null)

  const navigate_prev = () => setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
  const navigate_next = () => setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))

  const handleCellClick = (funcId: string, date: string) => setActiveCell({ funcId, date })

  const handleSetStatus = async (funcId: string, date: string, tipo: string) => {
    const key = `${funcId}_${date}`
    const existing = escalaMap[key]
    try {
      if (existing && existing.tipo === tipo) {
        await deleteMutation.mutateAsync(existing.id)
      } else {
        const payload = { 
          funcionario_id: funcId, 
          data: date, 
          tipo, 
          turno: 'integral' as const,
          localidade: existing?.localidade || null,
          observacoes: existing?.observacoes || null
        }
        if (!['presente', 'hora_extra'].includes(tipo)) {
          payload.localidade = null
        }
        await batchMutation.mutateAsync([payload])
      }
    } catch {
      toast('Erro ao salvar status', 'error')
    }
  }

  const handleSetLocalidade = async (funcId: string, date: string, locNome: string | null) => {
    const key = `${funcId}_${date}`
    const existing = escalaMap[key]
    if (!existing) return
    try {
      await updateMutation.mutateAsync({ id: existing.id, data: { localidade: locNome } })
    } catch {
      toast('Erro ao definir localidade', 'error')
    } finally {
      setActiveCell(null)
    }
  }

  const handleDragStart = (funcId: string, date: string) => {
    setDraggedCell({ funcId, date })
  }

  const handleDrop = async (targetFuncId: string, targetDate: string) => {
    if (!draggedCell) return
    if (draggedCell.funcId === targetFuncId && draggedCell.date === targetDate) return

    const sourceKey = `${draggedCell.funcId}_${draggedCell.date}`
    const targetKey = `${targetFuncId}_${targetDate}`
    
    const sourceEscala = escalaMap[sourceKey]
    const targetEscala = escalaMap[targetKey]

    if (!sourceEscala && !targetEscala) return

    try {
      const payloads: any[] = []
      
      // Swap logic
      if (sourceEscala) {
        payloads.push({
          funcionario_id: targetFuncId,
          data: targetDate,
          tipo: sourceEscala.tipo,
          localidade: sourceEscala.localidade,
          turno: sourceEscala.turno,
          observacoes: sourceEscala.observacoes
        })
      } else if (targetEscala) {
        await deleteMutation.mutateAsync(targetEscala.id)
      }

      if (targetEscala) {
        payloads.push({
          funcionario_id: draggedCell.funcId,
          data: draggedCell.date,
          tipo: targetEscala.tipo,
          localidade: targetEscala.localidade,
          turno: targetEscala.turno,
          observacoes: targetEscala.observacoes
        })
      } else if (sourceEscala) {
        await deleteMutation.mutateAsync(sourceEscala.id)
      }

      if (payloads.length > 0) {
        await batchMutation.mutateAsync(payloads)
        toast('Escala remanejada', 'success')
      }
    } catch {
      toast('Erro ao remanejar escala', 'error')
    } finally {
      setDraggedCell(null)
    }
  }

  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter(f => {
      const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase())
      const matchSetor = !filterSetor || f.setor === filterSetor
      return matchSearch && matchSetor
    })
  }, [funcionarios, searchTerm, filterSetor])

  const setores = useMemo(() => Array.from(new Set(funcionarios.map(f => f.setor).filter(Boolean))), [funcionarios])

  if (loadF || loadE) return <Loading />

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Escala Profissional" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Elite Glass Toolbar */}
        <div className="bg-card/80 dark:bg-card/50 backdrop-blur-xl border border-border rounded-[2.5rem] p-4 sm:p-6 shadow-sm mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">

            {/* Date & Navigation */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="flex bg-muted rounded-xl sm:rounded-2xl p-1 shadow-inner flex-1 sm:flex-none">
                <button onClick={navigate_prev} className="p-2 hover:bg-card rounded-lg sm:rounded-xl transition-all active:scale-95 text-muted-foreground">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="px-2 sm:px-4 flex items-center justify-center min-w-[120px] sm:min-w-[160px]">
                  <span className="text-xs sm:text-sm font-bold text-foreground capitalize truncate">
                    {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : "dd 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
                <button onClick={navigate_next} className="p-2 hover:bg-card rounded-lg sm:rounded-xl transition-all active:scale-95 text-muted-foreground">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="flex bg-muted rounded-xl sm:rounded-2xl p-1 shadow-inner">
                <button
                  onClick={() => setViewMode('month')}
                  className={cn("px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5", viewMode === 'month' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <LayoutGrid className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">Mês</span>
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={cn("px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5", viewMode === 'week' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <LayoutList className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">Semana</span>
                </button>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 lg:max-w-xl">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text" placeholder="Pesquisar funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm bg-muted border border-input rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground font-medium"
                />
              </div>
              <select
                value={filterSetor} onChange={e => setFilterSetor(e.target.value)}
                className="w-full sm:w-48 bg-muted border border-input rounded-2xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium text-foreground"
              >
                <option value="">Todos Setores</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/escala/imprimir-semanal')}
                className="p-3 bg-card border border-border rounded-2xl text-primary shadow-sm hover:shadow-md transition-all active:scale-95"
                title="Mural Semanal"
              >
                <Printer className="w-5 h-5" />
              </button>
              <Button
                onClick={() => setGenerateModal(true)}
                className="rounded-2xl px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 h-[48px]"
              >
                <Target className="w-4 h-4" /> Preencher
              </Button>
            </div>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="flex flex-wrap gap-2 mb-6 px-2">
          {tiposEscala.map(cfg => (
            <div key={cfg.id} className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-xl shadow-sm">
              <div className={cn("w-5 h-5 rounded-md flex items-center justify-center font-black text-[9px]", cfg.bg, cfg.text)}>{cfg.letra}</div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{cfg.nome}</span>
            </div>
          ))}
        </div>

        {/* Professional Grid - Elite Scroll Experience */}
        <div className="bg-card border border-border rounded-3xl sm:rounded-[2.5rem] shadow-xl overflow-hidden">
          <div className="overflow-auto scrollbar-auto max-h-[70vh] relative">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-50">
                <tr className="bg-muted/90 backdrop-blur-md">
                  <th className="sticky left-0 top-0 z-[60] px-3 sm:px-6 py-4 sm:py-6 text-left border-r border-b border-border min-w-[140px] sm:min-w-[220px] bg-muted/95 backdrop-blur-md shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[9px] sm:text-xs font-black text-muted-foreground uppercase tracking-widest">Colaborador</span>
                    </div>
                  </th>
                  {days.map(day => {
                    const isSun = isSunday(day)
                    const isToday = checkIsToday(day)
                    return (
                      <th 
                        key={day.toISOString()} 
                        className={cn(
                          "px-0.5 py-3 sm:py-4 text-center border-b border-r border-border/50 transition-all bg-muted/95 backdrop-blur-md", 
                          viewMode === 'week' ? "min-w-[80px] sm:min-w-[120px]" : "min-w-[65px] sm:min-w-[72px]",
                          isToday && "bg-primary/5"
                        )}
                      >
                        <div className={cn("text-[8px] sm:text-[10px] font-black uppercase tracking-tighter mb-0.5 sm:mb-1", isSun ? "text-red-500" : "text-muted-foreground")}>
                          {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 mx-auto flex items-center justify-center rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all",
                          isToday ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : isSun ? "text-red-600 bg-red-500/10" : "text-foreground"
                        )}>
                          {format(day, 'dd')}
                        </div>
                      </th>
                    )
                  })}
                  <th className="min-w-[60px] border-b border-border/20 bg-muted/5" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {setores.filter(s => !filterSetor || s === filterSetor).map(setor => {
                  const funcs = filteredFuncionarios.filter(f => f.setor === setor)
                  if (funcs.length === 0) return null
                  return (
                    <React.Fragment key={setor}>
                      <tr className="bg-card/50">
                        <td colSpan={days.length + 2} className="sticky top-[68px] sm:top-[84px] left-0 z-40 px-4 sm:px-6 py-2.5 sm:py-4 border-b border-border bg-card/90 backdrop-blur-md shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                            <span className="text-[10px] sm:text-xs font-black uppercase text-primary tracking-[0.2em]">{setor}</span>
                          </div>
                        </td>
                      </tr>
                      {funcs.map((func, fIdx) => (
                        <tr key={func.id} className="group hover:bg-muted/50 transition-colors">
                          <td className="sticky left-0 z-30 px-3 sm:px-6 py-3 sm:py-4 border-r border-b border-border bg-card transition-colors group-hover:bg-muted/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                {func.nome.charAt(0)}
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-foreground truncate max-w-[100px] sm:max-w-[160px]">{func.nome}</span>
                            </div>
                          </td>
                          {days.map(day => {
                            const dStr = format(day, 'yyyy-MM-dd')
                            const escala = escalaMap[`${func.id}_${dStr}`]
                            const cfg = escala ? STATUS_CONFIG[escala.tipo] : null
                            const isActive = activeCell?.funcId === func.id && activeCell?.date === dStr
                            const isSun = isSunday(day)
                            const isSaving = (batchMutation.isPending || deleteMutation.isPending || updateMutation.isPending) && isActive

                            return (
                            <td
                              key={dStr}
                              className={cn("p-0 text-center border-b border-r border-border/50", isSun && "bg-red-500/5")}
                            >
                              <button
                                draggable={!!escala}
                                onDragStart={() => handleDragStart(func.id, dStr)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(func.id, dStr)}
                                onClick={() => handleCellClick(func.id, dStr)}
                                className={cn(
                                  "w-full h-full min-h-[50px] flex flex-col items-center justify-center transition-all hover:bg-primary/5 relative z-0 outline-none focus:bg-primary/10",
                                  isActive && "bg-primary/5 shadow-inner",
                                  draggedCell?.funcId === func.id && draggedCell?.date === dStr && "opacity-40 grayscale"
                                )}
                              >
                                {isSaving ? (
                                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                ) : cfg && escala?.tipo !== 'presente' ? (
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-md transform transition-all group-hover:scale-110",
                                    cfg.bg, cfg.text,
                                    isActive ? "ring-4 ring-primary/30 scale-110" : ""
                                  )}>
                                    {cfg.letra}
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2",
                                    isActive ? "bg-primary/20 border-primary shadow-lg shadow-primary/20" : "border-transparent text-muted-foreground/30"
                                  )}>
                                    {isActive ? <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /> : "·"}
                                  </div>
                                )}
                                {escala?.localidade && escala.tipo === 'presente' && (
                                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full opacity-60" />
                                )}
                                </button>
                              </td>
                              )
                            })}
                            <td className="bg-muted/5 border-b border-border/10" aria-hidden="true" />
                          </tr>
                      ))}
                    </React.Fragment>
                  )
                })}

                {/* Equipe sem setor - Sync with Elite Scroll */}
                {filteredFuncionarios.filter(f => !f.setor || !setores.includes(f.setor)).length > 0 && (
                  <React.Fragment>
                    <tr className="bg-card/50">
                      <td colSpan={days.length + 2} className="sticky top-[68px] sm:top-[84px] left-0 z-40 px-4 sm:px-6 py-2.5 sm:py-4 border-b border-border bg-card/90 backdrop-blur-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-4 bg-slate-300 dark:bg-slate-600 rounded-full" />
                          <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Equipe Sem Setor</span>
                        </div>
                      </td>
                    </tr>
                    {filteredFuncionarios.filter(f => !f.setor || !setores.includes(f.setor)).map((func, fIdx) => (
                      <tr key={func.id} className="group hover:bg-muted/50 transition-colors">
                        <td className="sticky left-0 z-30 px-3 sm:px-6 py-3 sm:py-4 border-r border-b border-border bg-card transition-colors group-hover:bg-muted/50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-xs font-black text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                              {func.nome.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{func.nome}</span>
                          </div>
                        </td>
                        {days.map(day => {
                          const dStr = day.toISOString().split('T')[0]
                          const escala = escalaMap[`${func.id}_${dStr}`]
                          const cfg = escala ? STATUS_CONFIG[escala.tipo] : null
                          const isActive = activeCell?.funcId === func.id && activeCell?.date === dStr
                          const isSun = isSunday(day)
                          const isSaving = (batchMutation.isPending || deleteMutation.isPending || updateMutation.isPending) && isActive

                          return (
                            <td
                              key={dStr}
                              className={cn("p-0 text-center border-b border-r border-border/50", isSun && "bg-red-500/5")}
                            >
                              <button
                                draggable={!!escala}
                                onDragStart={() => handleDragStart(func.id, dStr)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(func.id, dStr)}
                                onClick={() => handleCellClick(func.id, dStr)}
                                className={cn(
                                  "w-full h-full min-h-[50px] flex flex-col items-center justify-center transition-all hover:bg-primary/5 relative z-0 outline-none focus:bg-primary/10",
                                  isActive && "bg-primary/5 shadow-inner",
                                  draggedCell?.funcId === func.id && draggedCell?.date === dStr && "opacity-40 grayscale"
                                )}
                              >
                                {isSaving ? (
                                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                ) : cfg && escala?.tipo !== 'presente' ? (
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-md transform transition-all group-hover:scale-110",
                                    cfg.bg, cfg.text,
                                    isActive ? "ring-4 ring-primary/30 scale-110" : ""
                                  )}>
                                    {cfg.letra}
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2",
                                    isActive ? "bg-primary/20 border-primary shadow-lg shadow-primary/20" : "border-transparent text-muted-foreground/30"
                                  )}>
                                    {isActive ? <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /> : "·"}
                                  </div>
                                )}
                                {escala?.localidade && escala.tipo === 'presente' && (
                                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full opacity-60" />
                                )}
                              </button>
                            </td>
                          )
                        })}
                        <td className="bg-muted/5 border-b border-border/10" aria-hidden="true" />
                      </tr>
                    ))}
                  </React.Fragment>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{filteredFuncionarios.length} Colaboradores</span>
          </div>
          <div className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full" />
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Clique em qualquer célula para editar</div>
        </div>
      </div>

<Modal open={!!activeCell} onClose={() => setActiveCell(null)} title="Painel de Escala">
        {activeCell && (() => {
          const func = allFuncionarios.find(f => f.id === activeCell.funcId)
          const escala = escalaMap[`${activeCell.funcId}_${activeCell.date}`]
          const isSaving = batchMutation.isPending || updateMutation.isPending || deleteMutation.isPending
          const dayObj = parseISO(activeCell.date)

          return (
            <div className="space-y-6 py-2">
              {/* Header do Funcionário */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl border border-border">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-lg shadow-primary/20">
                  {func?.nome.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{func?.nome}</h3>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    {format(dayObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Seletor de Status */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Definir Status</p>
                <div className="grid grid-cols-4 gap-2">
                  {tiposEscala.map(sc => {
                    const isSelected = escala?.tipo === sc.id
                    
                    return (
                      <button
                        key={sc.id}
                        disabled={isSaving}
                        onClick={async () => {
                          try {
                            await handleSetStatus(activeCell.funcId, activeCell.date, sc.id)
                            toast('Status atualizado', 'success')
                          } catch (err) {
                            toast('Erro ao atualizar', 'error')
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all relative overflow-hidden active:scale-95",
                          isSelected
                            ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
                            : "bg-card border-border hover:border-primary/50"
                        )}
                      >
                        {isSaving && (
                          <div className="absolute inset-0 bg-white/40 dark:bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm", sc.bg, sc.text)}>
                          {sc.letra}
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">{sc.nome}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Extras: Localidade e Obs */}
              {escala && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Localidade</label>
                    <select
                      className="w-full p-3 bg-muted border border-input rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={escala.localidade || ''}
                      onChange={(e) => updateMutation.mutate({ id: escala.id, data: { localidade: e.target.value || null } })}
                    >
                      <option value="">Geral</option>
                      {localidadesList.filter((l: any) => !func?.setor || l.setor === func.setor).map((l: any) => (
                        <option key={l.id} value={l.nome}>{l.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Observações</label>
                    <input
                      type="text"
                      placeholder="Nota rápida..."
                      className="w-full p-3 bg-muted border border-input rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      defaultValue={escala.observacoes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (escala.observacoes || '')) {
                          updateMutation.mutate({ id: escala.id, data: { observacoes: e.target.value } })
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 mt-4"
                onClick={() => setActiveCell(null)}
              >
                Concluir Edição
              </Button>
            </div>
          )
        })()}
      </Modal>

{/* Auto-Fill Modal */}
      <Modal open={generateModal} onClose={() => setGenerateModal(false)} title="Gerador Inteligente">
        <div className="space-y-6">
          <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center mx-auto">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Deseja preencher automaticamente o mês de <strong className="text-foreground capitalize">{format(currentDate, 'MMMM', { locale: ptBR })}</strong>?
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed">
              Todos os dias úteis (Seg-Sáb) vazios serão marcados como <span className="text-primary">Trabalho (T)</span>.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1 rounded-2xl border-2 border-border font-black text-[10px] uppercase tracking-widest" onClick={() => setGenerateModal(false)}>Cancelar</Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
              loading={batchMutation.isPending}
              onClick={async () => {
                const inserts: any[] = []
                days.forEach(day => {
                  if (isSunday(day)) return
                  const dateStr = format(day, 'yyyy-MM-dd')
                  filteredFuncionarios.forEach(f => {
                    if (!escalaMap[`${f.id}_${dateStr}`]) {
                      inserts.push({ funcionario_id: f.id, data: dateStr, tipo: 'presente', turno: 'integral' })
                    }
                  })
                })
                if (inserts.length > 0) {
                  try {
                    await batchMutation.mutateAsync(inserts)
                    toast(`${inserts.length} marcações geradas`, 'success')
                  } catch (err) {
                    toast('Erro ao gerar escala', 'error')
                  }
                } else {
                  toast('Nada para preencher', 'info')
                }
                setGenerateModal(false)
              }}
            >
              Iniciar Preenchimento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
