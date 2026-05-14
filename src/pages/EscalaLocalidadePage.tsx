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
  startOfDay
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
  ArrowRightLeft
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './ConfiguracoesPage'
import type { Funcionario } from '../lib/database.types'

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
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(format(currentDate, 'yyyy-MM'))
  const { data: setores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: localidadesConfig = [] } = useConfiguracao<Localidade[]>('localidades', [])
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

  const ausenciasIds = ['repouso', 'compensar', 'ferias', 'atestado', 'falta', 'falta_justificada', 'suspensao']

  // Logic for daily view: locality -> employees
  const dailyDistribution = useMemo(() => {
    const dist: Record<string, { id: string; nome: string; setor: string; escalaId: string }[]> = {}
    
    // Initialize with all localities using ID as key
    localidadesConfig.forEach(l => {
      dist[l.id] = []
    })
    dist['sem_local'] = []

    escalas.forEach((e: any) => {
      if (e.data !== dateStr) return
      const f = funcMap[e.funcionario_id]
      if (!f) return
      if (ausenciasIds.includes(e.tipo)) return

      // mas filtramos para garantir que o setor do funcionário bata com o da localidade
      const loc = localidadesConfig.find(l => l.nome === e.localidade && l.setor === f.setor)
      const locKey = loc ? loc.id : 'sem_local'
      
      if (!dist[locKey]) dist[locKey] = []
      dist[locKey].push({ id: f.id, nome: f.nome, setor: f.setor || '', escalaId: e.id })
    })

    return dist
  }, [escalas, dateStr, funcMap, localidadesConfig])

  // Logic for available employees (not assigned to any locality today)
  const availableFuncs = useMemo(() => {
    return allFuncionarios.filter(f => {
      if (f.cargo?.toLowerCase() === 'encarregado') return false
      
      const e = escalas.find((esc: any) => esc.funcionario_id === f.id && esc.data === dateStr)
      // SÓ pode estar disponível se tiver status 'presente' E não tiver localidade definida
      return e && e.tipo === 'presente' && !e.localidade
    })
  }, [allFuncionarios, escalas, dateStr])

  const handlePrint = () => {
    window.print()
  }

  // Data for Print View
  const printData = useMemo(() => {
    const getSect = (name: string) => {
      const s = setores.find(st => st.toLowerCase().includes(name.toLowerCase()))
      if (!s) return { setor: name, localidades: [] }
      return {
        setor: s,
        localidades: localidadesConfig
          .filter(l => l.setor === s)
          .map(l => ({
            nome: l.nome,
            members: dailyDistribution[l.id] || []
          }))
          .filter(l => l.members.length > 0)
      }
    }

    const varricao = getSect('Varrição')
    const orla = getSect('Orla')
    const porta = getSect('Porta a Porta')

    const off = {
      folga: escalas.filter((e: any) => e.data === dateStr && (e.tipo === 'repouso' || e.tipo === 'compensar')).map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      ferias: escalas.filter((e: any) => e.data === dateStr && e.tipo === 'ferias').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
      atestado: escalas.filter((e: any) => e.data === dateStr && e.tipo === 'atestado').map((e: any) => funcMap[e.funcionario_id]?.nome).filter(Boolean),
    }

    return { varricao, orla, porta, off }
  }, [setores, localidadesConfig, dailyDistribution, escalas, dateStr, funcMap])

  // Actions
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
      toast('Funcionário alocado!', 'success')
    } catch (err: any) {
      toast('Erro: ' + err.message, 'error')
    }
  }

  const handleRemove = async (escalaId: string) => {
    try {
      await updateMutation.mutateAsync({ id: escalaId, data: { localidade: null } })
      toast('Removido da localidade', 'success')
    } catch (err: any) {
      toast('Erro ao remover', 'error')
    }
  }

  const handleCopyYesterday = async () => {
    const yesterday = format(subDays(currentDate, 1), 'yyyy-MM-dd')
    const yesterdayEscalas = escalas.filter((e: any) => e.data === yesterday && e.localidade)
    
    if (yesterdayEscalas.length === 0) return toast('Nenhuma escala encontrada ontem', 'info')

    try {
      const inserts = yesterdayEscalas.map((e: any) => ({
        funcionario_id: e.funcionario_id,
        data: dateStr,
        tipo: 'presente',
        localidade: e.localidade,
        turno: 'integral' as const
      }))
      await batchMutation.mutateAsync(inserts)
      toast('Escala de ontem copiada!', 'success')
    } catch (err: any) {
      toast('Erro ao copiar: ' + err.message, 'error')
    }
  }

  const handleGenerateWeek = async () => {
    const monday = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const mondayEscalas = escalas.filter((e: any) => e.data === monday && e.localidade_id)

    if (mondayEscalas.length === 0) {
      return toast('Preencha a segunda-feira antes de gerar a semana!', 'warning')
    }

    try {
      const inserts: any[] = []
      const targets = weekDays.slice(1, 6) // Terça a Sábado

      targets.forEach(day => {
        const dStr = format(day, 'yyyy-MM-dd')
        mondayEscalas.forEach((e: any) => {
          const hasAbsence = escalas.find((esc: any) => 
            esc.funcionario_id === e.funcionario_id && 
            esc.data === dStr && 
            ausenciasIds.includes(esc.tipo)
          )
          if (!hasAbsence) {
            inserts.push({
              funcionario_id: e.funcionario_id,
              data: dStr,
              tipo: 'presente',
              localidade: e.localidade,
              turno: 'integral' as const
            })
          }
        })
      })

      if (inserts.length > 0) {
        await batchMutation.mutateAsync(inserts)
        toast(`Semana preenchida com sucesso!`, 'success')
      } else {
        toast('Nenhuma alocação nova necessária.', 'info')
      }
    } catch (err: any) {
      toast('Erro ao gerar semana: ' + err.message, 'error')
    }
  }

  if (loadF || loadE) return <div className="main-content"><TopHeader title="Escala por Localidade" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  return (
    <div className="main-content pb-24 bg-[hsl(var(--background))]">
      <TopHeader 
        title="Gestão de Locais" 
        subtitle={viewMode === 'daily' ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : 'Vista Semanal'} 
        actions={
          viewMode === 'daily' && (
            <Button variant="ghost" size="icon" onClick={handlePrint} title="Imprimir Mural">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
            </Button>
          )
        }
      />

      {/* PRINT ONLY VIEW - ABSOLUTE ONE-PAGE LOCK */}
      <div className="hidden print:flex fixed inset-0 z-[9999] bg-white landscape-print text-slate-950 font-sans flex-col overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: landscape; margin: 0 !important; }
            html, body { 
              margin: 0 !important; 
              padding: 0 !important; 
              height: 100vh !important; 
              overflow: hidden !important; 
              -webkit-print-color-adjust: exact; 
            }
            body * { visibility: hidden; }
            .landscape-print, .landscape-print * { visibility: visible; }
            .landscape-print { 
              position: fixed !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 297mm !important; 
              height: 210mm !important; 
              padding: 5mm !important;
              background: white !important; 
              display: flex !important;
              flex-direction: column !important;
              box-sizing: border-box !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
            }
            /* Garantia de que nada quebre para a pág 2 */
            * { break-inside: avoid !important; }
          }
        `}} />
        
        {/* Header: Official Document Look */}
        <div className="flex items-end justify-between border-b-2 border-slate-950 pb-2 mb-3 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-950 flex items-center justify-center rounded-lg text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-8 h-8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase leading-none tracking-tight">Escala Diária de Trabalho</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Gestão de Equipes — Encarregado Rogerio</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-100 px-4 py-1 rounded-full border border-slate-200">
              <span className="text-sm font-black uppercase text-slate-900">{format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 flex-1 min-h-0 w-full h-full">
          {/* Column 1: Varrição */}
          <div className="flex flex-col gap-2 w-full h-full border-r border-slate-100 pr-2">
            <div className="flex items-center gap-2 border-l-4 border-slate-950 pl-2 py-1 bg-slate-50">
              <span className="font-black text-xs uppercase tracking-tighter">01. Varrição</span>
            </div>
            <div className="space-y-3 overflow-hidden">
              {printData.varricao.localidades.map(l => (
                <div key={l.nome} className="group">
                  <p className="font-black text-[10px] uppercase text-blue-800 mb-1 flex items-center justify-between">
                    <span>{l.nome}</span>
                    <span className="text-[8px] text-slate-400">[{l.members.length}]</span>
                  </p>
                  <div className="grid grid-cols-1 gap-0.5 border-l border-slate-200 pl-2">
                    {l.members.map((m: any) => (
                      <p key={m.id} className="text-[9px] font-medium leading-none py-0.5 text-slate-700">{m.nome}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Orla */}
          <div className="flex flex-col gap-2 h-full border-r border-slate-100 pr-2">
            <div className="flex items-center gap-2 border-l-4 border-slate-950 pl-2 py-1 bg-slate-50">
              <span className="font-black text-xs uppercase tracking-tighter">02. Orla</span>
            </div>
            <div className="space-y-3 overflow-hidden">
              {printData.orla.localidades.map(l => (
                <div key={l.nome} className="group">
                  <p className="font-black text-[10px] uppercase text-blue-800 mb-1 flex items-center justify-between">
                    <span>{l.nome}</span>
                    <span className="text-[8px] text-slate-400">[{l.members.length}]</span>
                  </p>
                  <div className="grid grid-cols-1 gap-0.5 border-l border-slate-200 pl-2">
                    {l.members.map((m: any) => (
                      <p key={m.id} className="text-[9px] font-medium leading-none py-0.5 text-slate-700">{m.nome}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Porta a Porta */}
          <div className="flex flex-col gap-2 h-full border-r border-slate-100 pr-2">
            <div className="flex items-center gap-2 border-l-4 border-slate-950 pl-2 py-1 bg-slate-50">
              <span className="font-black text-xs uppercase tracking-tighter">03. Porta a Porta</span>
            </div>
            <div className="space-y-3 overflow-hidden">
              {printData.porta.localidades.map(l => (
                <div key={l.nome} className="group">
                  <p className="font-black text-[10px] uppercase text-blue-800 mb-1 flex items-center justify-between">
                    <span>{l.nome}</span>
                    <span className="text-[8px] text-slate-400">[{l.members.length}]</span>
                  </p>
                  <div className="grid grid-cols-1 gap-0.5 border-l border-slate-200 pl-2">
                    {l.members.map((m: any) => (
                      <p key={m.id} className="text-[9px] font-medium leading-none py-0.5 text-slate-700">{m.nome}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 4: Ausências */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-l-4 border-slate-400 pl-2 py-1 bg-slate-100">
              <span className="font-black text-xs uppercase tracking-tighter text-slate-600">04. Ausências / Folgas</span>
            </div>
            
            <div className="space-y-4">
              {printData.off.folga.length > 0 && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <p className="text-[9px] font-black uppercase text-emerald-700 mb-1 flex items-center gap-1">🏖️ Folga / Repouso</p>
                  <div className="grid grid-cols-1 gap-0.5">
                    {printData.off.folga.map(name => <p key={name} className="text-[9px] font-bold text-slate-700 border-b border-white leading-tight">{name}</p>)}
                  </div>
                </div>
              )}

              {printData.off.ferias.length > 0 && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <p className="text-[9px] font-black uppercase text-purple-700 mb-1 flex items-center gap-1">✈️ Férias</p>
                  <div className="grid grid-cols-1 gap-0.5">
                    {printData.off.ferias.map(name => <p key={name} className="text-[9px] font-bold text-slate-700 border-b border-white leading-tight">{name}</p>)}
                  </div>
                </div>
              )}

              {printData.off.atestado.length > 0 && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <p className="text-[9px] font-black uppercase text-red-700 mb-1 flex items-center gap-1">🏥 Atestado</p>
                  <div className="grid grid-cols-1 gap-0.5">
                    {printData.off.atestado.map(name => <p key={name} className="text-[9px] font-bold text-slate-700 border-b border-white leading-tight">{name}</p>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 italic">
          <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Documento de Controle Interno — Rogerio</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="sticky top-14 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-2xl p-1 shadow-sm border border-slate-100 dark:border-slate-800">
            <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
            <div className="px-4 flex flex-col items-center min-w-[120px]">
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 leading-none mb-1">
                {isToday(currentDate) ? 'Hoje' : format(currentDate, 'EEE', { locale: ptBR })}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{format(currentDate, 'dd/MM/yyyy')}</span>
            </div>
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <div className="flex bg-white dark:bg-slate-800 rounded-2xl p-1 shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Diário
            </button>
            <button 
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'weekly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
            >
              <List className="w-4 h-4" /> Semanal
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <button 
            onClick={handleCopyYesterday}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black hover:bg-slate-200 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Ontem
          </button>
          <button 
            onClick={handleGenerateWeek}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-2xl text-[10px] font-black hover:bg-blue-700 shadow-md transition-all active:scale-95"
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Gerar Semana
          </button>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 gap-3 p-4 print:hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <CheckCircle2 className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-black">{allFuncionarios.length - availableFuncs.length}</span>
          </div>
          <p className="text-[10px] font-bold uppercase opacity-80">Alocados Hoje</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <Clock className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-black">{availableFuncs.length}</span>
          </div>
          <p className="text-[10px] font-bold uppercase opacity-80">A Disponibilizar</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pb-12 print:hidden">
        {viewMode === 'daily' ? (
          <div className="space-y-6">
            {setores.map(setor => {
              const locs = localidadesConfig.filter(l => l.setor === setor)
              if (locs.length === 0) return null
              return (
                <div key={setor} className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{setor}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locs.map(loc => {
                      const members = dailyDistribution[loc.id] || []
                      return (
                        <div key={loc.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{loc.nome}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{members.length} membros</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr, setor: loc.setor })}
                              className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-2 min-h-[60px] flex flex-wrap gap-1.5">
                            {members.length === 0 ? (
                              <div className="w-full py-4 flex flex-col items-center opacity-30">
                                <Users className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-bold">Vazio</span>
                              </div>
                            ) : (
                              members.map((m: any) => (
                                <div key={m.id} className="flex items-center gap-2 pl-2 pr-1 py-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 group animate-scale-in">
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{m.nome}</span>
                                  <button 
                                    onClick={() => handleRemove(m.escalaId)}
                                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
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

            {/* Unassigned List */}
            {availableFuncs.length > 0 && (
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Disponíveis no Setor</h3>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-amber-900/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    {availableFuncs.map(f => (
                      <div key={f.id} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl text-[11px] font-black text-amber-700 dark:text-amber-400">
                        {f.nome}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[160px]">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Localidade</span>
                  </th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={`p-4 border-b border-slate-200 dark:border-slate-700 min-w-[150px] ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase">{format(day, 'EEE', { locale: ptBR })}</span>
                        <span className={`text-sm font-black ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{format(day, 'dd')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setores.map(setor => {
                  const locs = localidadesConfig.filter(l => l.setor === setor)
                  if (locs.length === 0) return null
                  return (
                    <React.Fragment key={setor}>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                        <td colSpan={8} className="sticky left-0 z-20 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{setor}</span>
                        </td>
                      </tr>
                      {locs.map(loc => (
                        <tr key={loc.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 px-4 py-3 font-bold text-xs text-slate-700 dark:text-slate-200">
                            {loc.nome}
                          </td>
                          {weekDays.map(day => {
                            const dStr = format(day, 'yyyy-MM-dd')
                            const assigned = escalas.filter((e: any) => {
                              if (e.data !== dStr || e.localidade !== loc.nome) return false
                              const f = funcMap[e.funcionario_id]
                              return f && f.setor === loc.setor
                            })
                            return (
                              <td 
                                key={dStr} 
                                onClick={() => setAssignModal({ locId: loc.id, locName: loc.nome, dateStr: dStr, setor: loc.setor })}
                                className="p-2 align-top cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="space-y-1">
                                  {assigned.length === 0 ? (
                                    <div className="h-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center opacity-30">
                                      <span className="text-[8px] font-bold">Vazio</span>
                                    </div>
                                  ) : (
                                    assigned.map(e => (
                                      <div key={e.id} className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-bold text-slate-600 dark:text-slate-300 shadow-sm truncate">
                                        {funcMap[e.funcionario_id]?.nome.split(' ')[0]}
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
        )}
      </div>

      {/* Assign Modal */}
      <Modal 
        open={!!assignModal} 
        onClose={() => { setAssignModal(null); setModalSearchTerm(''); }} 
        title="Alocar na Localidade"
      >
        {assignModal && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl text-white shadow-lg">
              <div className="flex items-center gap-2 opacity-80 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">{assignModal.setor}</span>
              </div>
              <h4 className="text-lg font-black">{assignModal.locName}</h4>
              <p className="text-xs opacity-80 mt-1">{format(parseISO(assignModal.dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar funcionário disponível..." 
                className="w-full pl-9 pr-3 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm"
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {(() => {
                const list = availableFuncs
                  .filter(f => f.setor === assignModal.setor)
                  .filter(f => f.nome.toLowerCase().includes(modalSearchTerm.toLowerCase()))
                
                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center opacity-30">
                      <Users className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-sm font-bold">Nenhum funcionário disponível</p>
                      <p className="text-xs">Todos deste setor já estão alocados ou de folga.</p>
                    </div>
                  )
                }

                return list.map(f => {
                  const isAlreadyHere = (dailyDistribution[assignModal.locId] || []).some((x: any) => x.id === f.id)
                  return (
                    <button
                      key={f.id}
                      disabled={isAlreadyHere}
                      onClick={() => { handleAssign(f.id); }}
                      className={`w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.98]
                        ${isAlreadyHere ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-blue-600">
                          {f.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{f.nome}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{f.cargo}</p>
                        </div>
                      </div>
                      {isAlreadyHere ? (
                        <span className="text-[9px] font-black uppercase text-slate-400">Já Alocado</span>
                      ) : (
                        <UserPlus className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                  )
                })
              })()}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Apenas funcionários do setor</span>
              <Button variant="ghost" size="sm" onClick={() => { setAssignModal(null); setModalSearchTerm(''); }}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
