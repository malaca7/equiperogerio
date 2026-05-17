import React, { useState, useMemo, useEffect, useCallback } from 'react'
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
  MapPin, 
  Plus, 
  UserPlus, 
  Calendar as CalendarIcon,
  Copy,
  Trash2,
  Users,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Zap,
  Printer,
  CalendarDays,
  Layers,
  ArrowDownCircle,
  MoreVertical,
  X
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './ConfiguracoesPage'
import type { Funcionario } from '../lib/database.types'
import { cn } from '../lib/utils'

interface Localidade {
  id: string
  nome: string
  setor: string
}

type ViewMode = 'daily' | 'weekly'

export function EscalaLocalidadePage() {
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [assignModal, setAssignModal] = useState<{ locId: string; locName: string; dateStr: string; setor: string } | null>(null)

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(
    format(startOfMonth(currentDate), 'yyyy-MM-dd'),
    format(endOfMonth(currentDate), 'yyyy-MM-dd')
  )
  const { data: setores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: localidadesConfig = [] } = useConfiguracao<Localidade[]>('localidades', [])
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const batchMutation = useBatchUpsertEscalas()
  const updateMutation = useUpdateEscala()

  // Helpers
  const dateStr = format(currentDate, 'yyyy-MM-dd')
  const weekDays = useMemo(() => {
    return eachDayOfInterval({ 
      start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
      end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
    })
  }, [currentDate])

  const funcMap = useMemo(() => {
    const map: Record<string, Funcionario> = {}
    allFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') map[f.id] = f
    })
    return map
  }, [allFuncionarios])

  const workingStatus = ['presente', 'hora_extra']

  // Logic for daily view: locality -> employees
  const dailyDistribution = useMemo(() => {
    const dist: Record<string, { id: string; nome: string; apelido?: string | null; setor: string; escalaId: string }[]> = {}
    localidadesConfig.forEach(l => { dist[l.id] = [] })
    dist['sem_local'] = []

    escalas.forEach((e: any) => {
      const eDate = e.data.split('T')[0]
      if (eDate !== dateStr) return
      const f = funcMap[e.funcionario_id]
      if (!f || !workingStatus.includes(e.tipo)) return
      const loc = localidadesConfig.find(l => l.nome === e.localidade && l.setor === f.setor)
      const locKey = loc ? loc.id : 'sem_local'
      if (!dist[locKey]) dist[locKey] = []
      dist[locKey].push({ id: f.id, nome: f.nome, apelido: f.apelido, setor: f.setor || '', escalaId: e.id })
    })
    return dist
  }, [escalas, dateStr, funcMap, localidadesConfig])

  const availableFuncs = useMemo(() => {
    return allFuncionarios.filter(f => {
      if (f.cargo?.toLowerCase() === 'encarregado') return false
      const e = escalas.find((esc: any) => esc.funcionario_id === f.id && esc.data.split('T')[0] === dateStr)
      return e && (e.tipo === 'presente' || e.tipo === 'hora_extra') && !e.localidade
    })
  }, [allFuncionarios, escalas, dateStr])

  const totalAlocados = useMemo(() => {
    return Object.entries(dailyDistribution).reduce((acc, [key, members]) => {
      if (key === 'sem_local') return acc
      return acc + members.length
    }, 0)
  }, [dailyDistribution])

  const handlePrint = () => window.print()

  const printData = useMemo(() => {
    const activeSectors = setores.map(s => {
      const locs = localidadesConfig
        .filter(l => l.setor === s)
        .map(l => ({ nome: l.nome, members: dailyDistribution[l.id] || [] }))
        .filter(l => l.members.length > 0)
      return { setor: s, localidades: locs }
    }).filter(s => s.localidades.length > 0)

    const off = {
      folga: escalas.filter((e: any) => e.data === dateStr && (e.tipo === 'repouso' || e.tipo === 'compensar')).map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      ferias: escalas.filter((e: any) => e.data === dateStr && e.tipo === 'ferias').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      atestado: escalas.filter((e: any) => e.data === dateStr && e.tipo === 'atestado').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
    }
    return { activeSectors, off }
  }, [setores, localidadesConfig, dailyDistribution, escalas, dateStr, funcMap])

  const handleAssign = async (funcId: string) => {
    if (!assignModal) return
    try {
      const existing = escalas.find((e: any) => e.funcionario_id === funcId && e.data === assignModal.dateStr)
      const payload = {
        funcionario_id: funcId,
        data: assignModal.dateStr,
        tipo: 'presente',
        localidade: assignModal.locName === 'Sem Local' ? null : assignModal.locName,
        turno: 'integral' as const
      }
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, data: { localidade: payload.localidade, tipo: 'presente' } })
      } else {
        await batchMutation.mutateAsync([payload])
      }
      toast('Alocação confirmada!', 'success')
    } catch (err: any) {
      toast('Falha ao alocar: ' + err.message, 'error')
    }
  }

  const handleClearDay = async () => {
    const todayEscalas = escalas.filter((e: any) => e.data === dateStr && e.localidade)
    if (todayEscalas.length === 0) return toast('Nenhuma alocação para limpar', 'info')
    if (!confirm(`Limpar alocação de ${todayEscalas.length} funcionários hoje?`)) return
    try {
      const updates = todayEscalas.map((e: any) => {
        const { funcionarios, ...cleanData } = e
        return { ...cleanData, localidade: null }
      })
      await batchMutation.mutateAsync(updates)
      toast('Escala resetada para hoje.', 'success')
    } catch (err: any) {
      toast('Erro ao limpar: ' + err.message, 'error')
    }
  }

  const handleRemove = async (escalaId: string) => {
    try {
      await updateMutation.mutateAsync({ id: escalaId, data: { localidade: null } })
      toast('Localidade removida.', 'success')
    } catch (err: any) {
      toast('Erro ao remover', 'error')
    }
  }

  const handleMove = async (funcId: string, targetLocName: string | null, escalaId?: string) => {
    try {
      if (escalaId) {
        await updateMutation.mutateAsync({ id: escalaId, data: { localidade: targetLocName } })
      } else {
        const e = escalas.find((esc: any) => esc.funcionario_id === funcId && esc.data === dateStr)
        if (e) await updateMutation.mutateAsync({ id: e.id, data: { localidade: targetLocName } })
      }
      toast(targetLocName ? 'Movimentado com sucesso!' : 'Funcionário agora está disponível', 'success')
    } catch (err: any) {
      toast('Falha na movimentação: ' + err.message, 'error')
    }
  }

  const handleDragStart = (e: React.DragEvent, funcId: string, sourceLocId: string, escalaId?: string) => {
    e.dataTransfer.setData('funcId', funcId)
    e.dataTransfer.setData('sourceLocId', sourceLocId)
    if (escalaId) e.dataTransfer.setData('escalaId', escalaId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetLocId: string, targetLocName: string | null) => {
    e.preventDefault()
    const funcId = e.dataTransfer.getData('funcId')
    const sourceLocId = e.dataTransfer.getData('sourceLocId')
    const escalaId = e.dataTransfer.getData('escalaId')
    if (sourceLocId === targetLocId) return
    handleMove(funcId, targetLocName, escalaId)
  }

  const handleCopyYesterday = async () => {
    const yesterday = format(subDays(currentDate, 1), 'yyyy-MM-dd')
    const yesterdayEscalas = escalas.filter((e: any) => e.data === yesterday && e.localidade)
    if (yesterdayEscalas.length === 0) return toast('Nada para copiar de ontem', 'info')
    try {
      const inserts: any[] = []
      yesterdayEscalas.forEach((y: any) => {
        const todayEscala = escalas.find((e: any) => e.funcionario_id === y.funcionario_id && e.data === dateStr)
        if (!todayEscala || todayEscala.tipo === 'presente' || todayEscala.tipo === 'hora_extra') {
          inserts.push({
            funcionario_id: y.funcionario_id,
            data: dateStr,
            tipo: todayEscala?.tipo || 'presente',
            localidade: y.localidade,
            turno: todayEscala?.turno || 'integral'
          })
        }
      })
      if (inserts.length > 0) {
        await batchMutation.mutateAsync(inserts)
        toast(`${inserts.length} Alocações replicadas com sucesso.`, 'success')
      } else {
        toast('Nenhum funcionário disponível para cópia hoje.', 'warning')
      }
    } catch (err: any) {
      toast('Erro ao copiar: ' + err.message, 'error')
    }
  }

  const handleAutoAllocate = async () => {
    try {
      if (availableFuncs.length === 0) return toast('Nenhum funcionário disponível para alocar.', 'info')
      const inserts: any[] = []
      availableFuncs.forEach(f => {
        const history = escalas
          .filter((e: any) => e.funcionario_id === f.id && e.data < dateStr && e.localidade)
          .sort((a, b) => b.data.localeCompare(a.data))
        if (history.length > 0) {
          const todayEscala = escalas.find((e: any) => e.funcionario_id === f.id && e.data === dateStr)
          inserts.push({
            funcionario_id: f.id,
            data: dateStr,
            tipo: todayEscala?.tipo || 'presente',
            localidade: history[0].localidade,
            turno: todayEscala?.turno || 'integral'
          })
        }
      })
      if (inserts.length === 0) return toast('Histórico insuficiente para auto-alocação.', 'warning')
      await batchMutation.mutateAsync(inserts)
      toast(`Inteligência aplicada: ${inserts.length} alocações sugeridas.`, 'success')
    } catch (err: any) {
      toast('Erro na auto-alocação: ' + err.message, 'error')
    }
  }

  if (loadF || loadE) return <div className="min-h-screen bg-background"><TopHeader title="Escala" /><div className="py-32"><Loading text="Organizando matriz de localidades..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopHeader 
        title="Gestão de Locais" 
        subtitle={viewMode === 'daily' ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : 'Matriz Semanal'} 
      />

      {/* PRINT VIEW (SAME AS BEFORE) */}
      <div className="hidden print:flex fixed inset-0 z-[9999] bg-white landscape-print text-slate-950 font-sans flex-col overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; width: 297mm !important; height: 210mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body * { visibility: hidden; } .landscape-print, .landscape-print * { visibility: visible; } .landscape-print { position: fixed !important; left: 0 !important; top: 0 !important; width: 297mm !important; height: 210mm !important; padding: 3mm !important; background: white !important; display: flex !important; flex-direction: column !important; box-sizing: border-box !important; page-break-after: avoid !important; page-break-before: avoid !important; } * { break-inside: avoid !important; } }`}} />
        <div className="flex items-end justify-between border-b-[3px] border-black pb-1 mb-2 shrink-0">
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-black uppercase leading-none tracking-tight text-black">Escala Diária — Matriz de Locais</h1>
          </div>
          <div className="px-2 py-px border-[1px] border-black inline-block">
            <span className="text-[10px] font-black uppercase text-black">{format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>
        </div>
        <div className="flex-1 columns-4 gap-2 space-y-2 overflow-hidden w-full h-full pb-2">
          {printData.activeSectors.map((s, idx) => (
            <div key={s.setor} className="break-inside-avoid flex flex-col mb-3">
              <div className="flex items-center gap-1 border-b-[2px] border-black pb-0.5 mb-1 shrink-0">
                <span className="font-black text-[10px] uppercase tracking-widest text-black">{s.setor}</span>
              </div>
              <div className="space-y-1">
                {s.localidades.map(l => (
                  <div key={l.nome} className="border border-black rounded-md overflow-hidden flex flex-col">
                    <div className="bg-gray-200 border-b border-black px-1 py-px flex items-center justify-between"><span className="font-black text-[7.5px] uppercase text-black">{l.nome}</span><span className="text-[6px] font-bold text-black">{l.members.length}</span></div>
                    <div className="flex flex-wrap gap-px p-px bg-white">{l.members.map((m: any) => (<div key={m.id} className="bg-gray-50 border border-gray-400 rounded-sm px-1 py-px text-[7px] font-bold text-black">{m.nome.split(' ').slice(0, 2).join(' ')}</div>))}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Native-Style Toolbar Matrix */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-4 sm:p-6 shadow-xl mb-10 sticky top-24 z-30 transform-gpu transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Nav */}
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30">
                <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
                <div className="min-w-[120px] text-center">
                  <p className="text-[9px] font-black uppercase text-primary tracking-widest">{format(currentDate, 'EEE', { locale: ptBR })}</p>
                  <p className="text-sm font-black text-foreground">{format(currentDate, 'dd/MM/yyyy')}</p>
                </div>
                <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-card hover:shadow-sm active:scale-90 transition-all text-muted-foreground"><ChevronRight className="w-5 h-5" /></button>
              </div>

              {/* View Toggle */}
              <div className="flex bg-muted/50 p-1.5 rounded-[1.75rem] border border-border/30">
                <button onClick={() => setViewMode('daily')} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[1.25rem] transition-all flex items-center gap-2", viewMode === 'daily' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                  <LayoutGrid className="w-4 h-4" /> Diário
                </button>
                <button onClick={() => setViewMode('weekly')} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[1.25rem] transition-all flex items-center gap-2", viewMode === 'weekly' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                  <Layers className="w-4 h-4" /> Semanal
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:min-w-[300px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-transparent focus:border-primary/20 rounded-[1.75rem] text-sm font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopyYesterday} className="h-14 w-14 bg-muted/50 rounded-[1.25rem] flex items-center justify-center hover:bg-card border border-border/30 active:scale-90 transition-all" title="Copiar Ontem"><Copy className="w-5 h-5 text-muted-foreground" /></button>
                <button onClick={handleAutoAllocate} className="h-14 px-6 bg-primary text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                   <Zap className="w-4 h-4 fill-current" /> Auto
                </button>
                <button onClick={handlePrint} className="h-14 w-14 bg-muted/50 rounded-[1.25rem] flex items-center justify-center hover:bg-card border border-border/30 active:scale-90 transition-all"><Printer className="w-5 h-5 text-muted-foreground" /></button>
                <button onClick={handleClearDay} className="h-14 w-14 bg-rose-500/10 rounded-[1.25rem] flex items-center justify-center hover:bg-rose-500 hover:text-white border border-rose-500/20 active:scale-90 transition-all"><Trash2 className="w-5 h-5 text-rose-500 group-hover:text-white" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="bg-primary/10 border border-primary/20 rounded-[2rem] p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20"><CheckCircle2 className="w-6 h-6" /></div>
            <div><p className="text-2xl font-black text-primary">{totalAlocados}</p><p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Alocados Hoje</p></div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><Users className="w-6 h-6" /></div>
            <div><p className="text-2xl font-black text-amber-600">{availableFuncs.length}</p><p className="text-[10px] font-black uppercase text-amber-600/60 tracking-widest">Efetivo Avulso</p></div>
          </div>
        </div>

        {/* View Content */}
        <div className="pb-12 print:hidden">
          {viewMode === 'daily' ? (
            <div className="space-y-16">
              {setores.map(setor => {
                const locs = localidadesConfig.filter(l => l.setor === setor)
                if (locs.length === 0) return null
                return (
                  <div key={setor} className="space-y-8">
                    <div className="flex items-center gap-3 px-4">
                      <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
                      <h3 className="text-sm font-black uppercase text-foreground tracking-[0.2em]">{setor}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {locs.map(loc => {
                        const members = dailyDistribution[loc.id] || []
                        return (
                          <div key={loc.id} className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:scale-[1.01] transition-all duration-500 overflow-hidden group">
                            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-[1.25rem] bg-background/50 border border-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500"><MapPin className="w-6 h-6" /></div>
                                <div><h4 className="text-base font-black text-foreground tracking-tight">{loc.nome}</h4><p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter opacity-60">{members.length} Posições</p></div>
                              </div>
                              <button onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr, setor: loc.setor })} className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90"><Plus className="w-6 h-6" /></button>
                            </div>
                            <div className="p-5 min-h-[120px] flex flex-wrap gap-2.5" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, loc.id, loc.nome)}>
                              {members.length === 0 ? (
                                <div className="w-full py-10 flex flex-col items-center justify-center opacity-20 border-3 border-dashed border-border rounded-[2rem] group-hover:border-primary/40 transition-colors"><Users className="w-8 h-8 mb-2" /><span className="text-[10px] font-black uppercase tracking-widest">Aguardando Alocação</span></div>
                              ) : (
                                members.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase())).map((m: any) => (
                                  <div key={m.id} draggable onDragStart={(e) => handleDragStart(e, m.id, loc.id, m.escalaId)} className="flex items-center gap-3 pl-4 pr-2 py-2.5 bg-muted/60 hover:bg-background border border-border/50 rounded-2xl group/item animate-scale-in cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">{(m.apelido || m.nome).charAt(0)}</div>
                                    <span className="text-xs font-black text-foreground truncate max-w-[140px] uppercase tracking-tight">{m.apelido || m.nome.split(' ')[0]}</span>
                                    <button onClick={() => handleRemove(m.escalaId)} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><X className="w-4 h-4" /></button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Available Section Matrix */}
              {availableFuncs.length > 0 && (
                <div className="mt-24 space-y-10">
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-black uppercase text-amber-500 tracking-[0.2em]">Efetivo Avulso (Disponível)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {setores.map(setor => {
                      const funcs = availableFuncs.filter(f => f.setor === setor)
                      if (funcs.length === 0) return null
                      return (
                        <div key={setor} className="bg-card/40 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-8 shadow-sm transition-all" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'available', null)}>
                          <div className="flex items-center justify-between mb-6"><h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{setor}</h4><span className="bg-amber-500/10 text-amber-600 text-[11px] font-black px-4 py-1.5 rounded-full border border-amber-500/20">{funcs.length} MEMBROS</span></div>
                          <div className="flex flex-wrap gap-3">
                            {funcs.map(f => (
                              <div key={f.id} draggable onDragStart={(e) => handleDragStart(e, f.id, 'available')} className="px-5 py-3 bg-muted/60 hover:bg-background border border-border/50 rounded-2xl text-[11px] font-black shadow-sm transition-all active:scale-95 cursor-grab active:cursor-grabbing hover:border-amber-500 hover:text-amber-600 uppercase">
                                {f.apelido || f.nome.split(' ').slice(0, 2).join(' ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Weekly Matrix Matrix */
            <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[3rem] shadow-2xl overflow-hidden transition-all">
              <div className="overflow-x-auto scrollbar-none pb-6">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="sticky left-0 top-0 z-40 bg-card border-b-2 border-r border-border/50 p-8 text-left min-w-[240px] shadow-md">
                        <div className="flex items-center gap-3"><MapPin className="w-5 h-5 text-primary" /><span className="text-xs font-black text-foreground uppercase tracking-widest">Matriz de Locais</span></div>
                      </th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className={cn("sticky top-0 z-30 p-8 border-b-2 border-border/50 text-center transition-all", isToday(day) ? "bg-primary/5 shadow-inner" : "bg-muted/10")}>
                          <div className="flex flex-col items-center">
                            <span className={cn("text-[10px] font-black uppercase mb-2 tracking-widest", isSunday(day) ? "text-rose-500" : "text-muted-foreground")}>{format(day, 'EEEE', { locale: ptBR })}</span>
                            <span className={cn("text-2xl font-black tracking-tight", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, 'dd/MM')}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {setores.map(setor => {
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
                                const assigned = escalas.filter((e: any) => e.data === dStr && e.localidade === loc.nome)
                                return (
                                  <td key={dStr} onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr: dStr, setor: loc.setor })} className="p-4 align-top cursor-pointer border-b border-r border-border/30 bg-card/20 transition-all hover:bg-background/80 min-w-[150px]">
                                    <div className="space-y-2">
                                      {assigned.length === 0 ? (
                                        <div className="h-14 border-2 border-dashed border-border/30 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-20 transition-all"><Plus className="w-6 h-6" /></div>
                                      ) : (
                                        assigned.map(e => (
                                          <div key={e.id} className="px-4 py-2.5 bg-muted/60 border border-border/50 rounded-xl text-[10px] font-black text-foreground shadow-sm truncate hover:scale-105 hover:bg-card transition-all uppercase tracking-tighter">
                                            {funcMap[e.funcionario_id]?.apelido || funcMap[e.funcionario_id]?.nome.split(' ').slice(0, 2).join(' ')}
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
          )}
        </div>
      </div>

      {/* Assign Modal Matrix */}
      <Modal open={!!assignModal} onClose={() => { setAssignModal(null); setModalSearchTerm(''); }} title="Alocação Direta">
        {assignModal && (
          <div className="space-y-8 py-4 animate-fade-in">
            <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/20 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20"><MapPin className="w-7 h-7" /></div>
              <div><h4 className="text-xl font-black text-foreground leading-tight tracking-tight">{assignModal.locName}</h4><p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mt-1">{format(parseISO(assignModal.dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p></div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
              <input type="text" placeholder="Pesquisar por nome..." className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-transparent focus:border-primary/20 rounded-2xl text-base font-bold focus:ring-0 text-foreground" value={modalSearchTerm} onChange={e => setModalSearchTerm(e.target.value)} autoFocus />
            </div>
            <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 scrollbar-none">
              {(() => {
                const list = allFuncionarios.filter(f => f.setor === assignModal.setor).filter(f => { const e = escalas.find((esc: any) => esc.funcionario_id === f.id && esc.data === assignModal.dateStr); return e && (e.tipo === 'presente' || e.tipo === 'hora_extra') && !e.localidade }).filter(f => f.nome.toLowerCase().includes(modalSearchTerm.toLowerCase()))
                if (list.length === 0) return (<div className="py-20 text-center opacity-30"><Users className="w-12 h-12 mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum disponível para este setor</p></div>)
                return list.map(f => (
                  <button key={f.id} onClick={() => { handleAssign(f.id); setAssignModal(null); }} className="w-full flex items-center justify-between p-5 bg-card hover:bg-primary/10 border border-border/50 hover:border-primary/50 rounded-2xl transition-all group active:scale-[0.98]">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-white transition-all uppercase">{(f.apelido || f.nome).charAt(0)}</div><span className="text-base font-black text-foreground uppercase tracking-tight">{f.apelido || f.nome}</span></div>
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"><UserPlus className="w-5 h-5" /></div>
                  </button>
                ))
              })()}
            </div>
            <Button variant="secondary" onClick={() => setAssignModal(null)} className="w-full h-14 rounded-2xl font-black uppercase text-xs">Fechar Painel</Button>
          </div>
        )}
      </Modal>
      
      {/* FAB Summary Native */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-[400px] animate-slide-up">
        <div className="bg-slate-900 text-white dark:bg-card/90 dark:text-foreground backdrop-blur-2xl rounded-full p-2 pl-8 flex items-center justify-between shadow-2xl border border-white/10">
          <div className="flex flex-col"><p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40">Status Operacional</p><div className="flex items-center gap-4"><span className="text-sm font-black">{totalAlocados} Alocados</span><div className="w-1 h-1 rounded-full bg-white/20" /><span className="text-sm font-black">{availableFuncs.length} Avulsos</span></div></div>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"><ChevronRight className="w-6 h-6 -rotate-90" /></button>
        </div>
      </div>
    </div>
  )
}
