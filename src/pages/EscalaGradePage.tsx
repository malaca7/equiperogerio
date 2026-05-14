import React, { useState, useMemo, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval as eachDay, addWeeks, subWeeks, isSameMonth, isToday as checkIsToday, isSunday, isSaturday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, Copy, Printer, Search, Filter, X, Check, AlertTriangle, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useBatchUpsertEscalas, useUpdateEscala, useDeleteEscala } from '../hooks/useEscalas'
import { currentMonth } from '../lib/utils'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import type { TipoEscala } from './ConfiguracoesPage'
import { DEFAULT_TIPOS_ESCALA } from './ConfiguracoesPage'

const QUICK_STATUSES = ['presente', 'repouso', 'compensar', 'ferias', 'atestado', 'falta']

interface Localidade {
  id: string
  nome: string
  setor: string
}

export function EscalaGradePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [activeCell, setActiveCell] = useState<{ funcId: string; date: string } | null>(null)
  const [locPickerCell, setLocPickerCell] = useState<{ funcId: string; date: string } | null>(null)
  const [generateModal, setGenerateModal] = useState(false)

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const funcionarios = useMemo(() => allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado'), [allFuncionarios])
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(format(currentDate, 'yyyy-MM'))
  const batchMutation = useBatchUpsertEscalas()
  const updateMutation = useUpdateEscala()
  const deleteMutation = useDeleteEscala()

  const { data: localidadesConfig = [] } = useConfiguracao<Localidade[]>('localidades', [])
  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const STATUS_CONFIG: Record<string, TipoEscala> = useMemo(() => {
    return tiposEscala.reduce((acc, t) => {
      acc[t.id] = t
      return acc
    }, {} as Record<string, TipoEscala>)
  }, [tiposEscala])

  // ─── Computed ───────────────────────────────────────────────
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    }
    return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  }, [currentDate, viewMode])

  const setores = useMemo(() => Array.from(new Set(funcionarios.map(f => f.setor).filter(Boolean))).sort(), [funcionarios])


  const filteredFuncionarios = useMemo(() => {
    let list = funcionarios
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(f => f.nome.toLowerCase().includes(q))
    }
    if (filterSetor) {
      list = list.filter(f => f.setor === filterSetor)
    }
    return list
  }, [funcionarios, searchTerm, filterSetor])

  const escalaMap = useMemo(() => {
    const map: Record<string, { id: string; tipo: string; observacoes: string | null; localidade: string | null }> = {}
    escalas.forEach((e: any) => {
      map[`${e.funcionario_id}_${e.data}`] = { id: e.id, tipo: e.tipo, observacoes: e.observacoes, localidade: e.localidade || null }
    })
    return map
  }, [escalas])

  // ─── Navigation ─────────────────────────────────────────────
  const navigate_prev = () => {
    if (viewMode === 'month') {
      const d = subMonths(currentDate, 1)
      setCurrentDate(d)
    } else {
      setCurrentDate(subWeeks(currentDate, 1))
    }
  }
  const navigate_next = () => {
    if (viewMode === 'month') {
      const d = addMonths(currentDate, 1)
      setCurrentDate(d)
    } else {
      setCurrentDate(addWeeks(currentDate, 1))
    }
  }

  // ─── Quick Set ──────────────────────────────────────────────
  const handleCellClick = useCallback((funcId: string, date: string) => {
    setActiveCell(prev => prev?.funcId === funcId && prev?.date === date ? null : { funcId, date })
  }, [])

  const handleSetStatus = useCallback(async (funcId: string, date: string, tipo: string) => {
    const key = `${funcId}_${date}`
    const existing = escalaMap[key]
    try {
      if (existing && existing.tipo === tipo) {
        await deleteMutation.mutateAsync(existing.id)
      } else {
        await batchMutation.mutateAsync([{ funcionario_id: funcId, data: date, tipo, turno: 'integral' }])
      }
    } catch {
      toast('Erro ao atualizar escala', 'error')
    }
    setActiveCell(null)
  }, [escalaMap, batchMutation, deleteMutation, toast])

  const handleSetLocalidade = useCallback(async (funcId: string, date: string, localidade: string) => {
    const key = `${funcId}_${date}`
    const existing = escalaMap[key]
    if (!existing) return
    try {
      await updateMutation.mutateAsync({ id: existing.id, data: { localidade: localidade || null } })
    } catch {
      toast('Erro ao definir localidade', 'error')
    }
    setLocPickerCell(null)
  }, [escalaMap, updateMutation, toast])

  // ─── Generate Week ──────────────────────────────────────────
  const handleGenerateWeek = async () => {
    if (!filteredFuncionarios.length) return toast('Nenhum funcionário', 'warning')
    try {
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
      if (!inserts.length) { toast('Tudo já está preenchido!', 'warning'); setGenerateModal(false); return }
      await batchMutation.mutateAsync(inserts)
      toast(`${inserts.length} escalas geradas!`, 'success')
      setGenerateModal(false)
    } catch (err: any) {
      toast(`Erro: ${err?.message || 'Desconhecido'}`, 'error')
    }
  }

  // ─── Stats ──────────────────────────────────────────────────
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayStats = useMemo(() => {
    const t = { trabalho: 0, folga: 0, ferias: 0, afastamento: 0 }
    filteredFuncionarios.forEach(f => {
      const e = escalaMap[`${f.id}_${todayStr}`]
      if (!e) return
      if (e.tipo === 'presente') t.trabalho++
      else if (e.tipo === 'compensar' || e.tipo === 'repouso') t.folga++
      else if (e.tipo === 'ferias') t.ferias++
      else if (e.tipo === 'atestado' || e.tipo === 'falta') t.afastamento++
    })
    return t
  }, [filteredFuncionarios, escalaMap, todayStr])

  if (loadF || loadE) {
    return (<div className="main-content"><TopHeader title="Escalas" /><div className="flex items-center justify-center py-20"><Loading text="Carregando..." /></div></div>)
  }

  const title = viewMode === 'month'
    ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(days[0], 'dd/MM')} — ${format(days[days.length - 1], 'dd/MM/yyyy')}`

  return (
    <div className="main-content">
      <TopHeader title="Escalas" />

      <div className="px-4 pt-3 pb-24">
        {/* ─── Dashboard Cards ──────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Trabalho', value: todayStats.trabalho, color: 'from-blue-500 to-blue-600', icon: '👷' },
            { label: 'Folga', value: todayStats.folga, color: 'from-emerald-500 to-emerald-600', icon: '🏖️' },
            { label: 'Férias', value: todayStats.ferias, color: 'from-purple-500 to-purple-600', icon: '✈️' },
            { label: 'Afastados', value: todayStats.afastamento, color: 'from-red-500 to-red-600', icon: '🏥' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-3 text-white shadow-lg`}>
              <div className="text-lg">{c.icon}</div>
              <div className="text-2xl font-black leading-none mt-1">{c.value}</div>
              <div className="text-[10px] font-medium opacity-80 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* ─── Toolbar ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Nav + View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={navigate_prev} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="text-sm font-bold capitalize min-w-[140px] text-center">{title}</h2>
              <button onClick={navigate_next} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                <Calendar className="w-3.5 h-3.5 inline mr-1" />Mês
              </button>
              <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                <CalendarDays className="w-3.5 h-3.5 inline mr-1" />Semana
              </button>
            </div>
          </div>

          {/* Search + Filter + Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
            </div>
            {setores.length > 0 && (
              <select
                value={filterSetor}
                onChange={e => setFilterSetor(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
              >
                <option value="">Todos</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setGenerateModal(true)} className="flex-1 min-w-[80px] gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2">
              <Check className="w-3.5 h-3.5" />Preencher
            </Button>
            <Button onClick={() => navigate('/escala/localidades')} variant="ghost" className="flex-1 min-w-[80px] gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] px-2 text-blue-600">
              <MapPin className="w-3.5 h-3.5" />Localidades
            </Button>
            <Button onClick={() => navigate('/escala/imprimir-semanal')} variant="ghost" className="flex-1 min-w-[80px] gap-1.5 border text-[11px] px-2">
              <Printer className="w-3.5 h-3.5" />Semanal
            </Button>
            <Button onClick={() => navigate('/escala/imprimir-mensal')} variant="ghost" className="flex-1 min-w-[80px] gap-1.5 border text-[11px] px-2">
              <Printer className="w-3.5 h-3.5" />Mensal
            </Button>
          </div>
        </div>

        {/* ─── Legend ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                {cfg.letra} {cfg.nome}
              </span>
            )
          })}
        </div>

        {/* ─── Grid Table ───────────────────────────────── */}
        <div className="relative overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-bold text-slate-600 dark:text-slate-300 min-w-[160px]">
                  Funcionário
                </th>
                {days.map(day => {
                  const isToday = checkIsToday(day)
                  const isSun = isSunday(day)
                  const isSat = isSaturday(day)
                  return (
                    <th
                      key={day.toISOString()}
                      className={`border-b border-slate-200 dark:border-slate-700 px-0.5 py-2 text-center min-w-[36px] ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${isSun ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                    >
                      <div className={`text-[9px] font-bold uppercase ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-400'}`}>
                        {format(day, 'EEE', { locale: ptBR }).substring(0, 3)}
                      </div>
                      <div className={`font-black text-sm leading-none mt-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {format(day, 'dd')}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredFuncionarios.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nenhum funcionário encontrado
                  </td>
                </tr>
              ) : (
                <>
                  {setores.filter(s => !filterSetor || s === filterSetor).map(setor => {
                    const funcsDoSetor = filteredFuncionarios.filter(f => f.setor === setor)
                    if (!funcsDoSetor.length) return null
                    return (
                      <React.Fragment key={setor}>
                        {/* Sector Header Row */}
                        <tr>
                          <td colSpan={days.length + 1} className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-t border-slate-200 dark:border-slate-700 text-left">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{setor || 'Geral'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">({funcsDoSetor.length})</span>
                            </div>
                          </td>
                        </tr>
                        {funcsDoSetor.map((func, idx) => (
                          <tr key={func.id} className={`group ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <td className={`sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 px-2 py-1 font-semibold text-slate-800 dark:text-slate-200 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-[9px] shrink-0">
                                  {func.nome.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-[11px] font-semibold leading-tight max-w-[110px]">{func.nome}</div>
                                </div>
                              </div>
                            </td>
                            {days.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd')
                              const key = `${func.id}_${dateStr}`
                              const escala = escalaMap[key]
                              const cfg = escala ? STATUS_CONFIG[escala.tipo] : null
                              const isActive = activeCell?.funcId === func.id && activeCell?.date === dateStr
                              const isSun = isSunday(day)
                              const isToday = checkIsToday(day)
                              const isLocPicker = locPickerCell?.funcId === func.id && locPickerCell?.date === dateStr
                              const locName = escala?.localidade || ''

                              return (
                                <td
                                  key={dateStr}
                                  className={`relative px-px py-px text-center cursor-pointer ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${isSun ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                  onClick={() => handleCellClick(func.id, dateStr)}
                                >
                                  <div className="flex flex-col items-center gap-px">
                                    {cfg ? (
                                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${cfg.bg} ${cfg.text} font-black text-[9px] shadow-sm ${isActive ? `ring-2 ${cfg.ring} scale-110` : ''}`}>
                                        {cfg.letra}
                                      </div>
                                    ) : (
                                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 text-[8px] ${isActive ? 'border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        ·
                                      </div>
                                    )}
                                    {/* Localidade indicator */}
                                    {escala && locName && (
                                      <button
                                        onClick={e => { e.stopPropagation(); setLocPickerCell({ funcId: func.id, date: dateStr }) }}
                                        className="text-[8px] leading-none text-blue-500 font-bold truncate max-w-[28px] hover:underline bg-blue-50 dark:bg-blue-900/30 px-0.5 rounded"
                                        title={locName}
                                      >
                                        {locName.substring(0, 3)}
                                      </button>
                                    )}
                                    {escala && !locName && (
                                      <button
                                        onClick={e => { e.stopPropagation(); setLocPickerCell({ funcId: func.id, date: dateStr }) }}
                                        className="text-[7px] leading-none text-slate-300 dark:text-slate-600 hover:text-blue-400"
                                        title="Definir local"
                                      >
                                        📍
                                      </button>
                                    )}
                                  </div>

                                  {/* Status popup */}
                                  {isActive && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-1 flex gap-0.5 min-w-max">
                                      {QUICK_STATUSES.filter(s => !!STATUS_CONFIG[s]).map(s => {
                                        const sc = STATUS_CONFIG[s]
                                        const isSelected = escala?.tipo === s
                                        return (
                                          <button
                                            key={s}
                                            onClick={e => { e.stopPropagation(); handleSetStatus(func.id, dateStr, s) }}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black transition-all active:scale-95 ${isSelected ? `${sc.bg} ${sc.text} ring-2 ${sc.ring}` : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                            title={sc.nome}
                                          >
                                            {sc.letra}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {/* Localidade picker popup */}
                                  {isLocPicker && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 min-w-[140px] max-h-[200px] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Local de trabalho</p>
                                      <button onClick={() => handleSetLocalidade(func.id, dateStr, '')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                                        Nenhum
                                      </button>
                                      {localidadesConfig.filter(lc => !func.setor || lc.setor === func.setor).map(lc => (
                                        <button
                                          key={lc.id}
                                          onClick={() => handleSetLocalidade(func.id, dateStr, lc.nome)}
                                          className={`w-full text-left px-2 py-1.5 text-[11px] rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium ${escala?.localidade === lc.nome ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}
                                        >
                                          📍 {lc.nome}
                                        </button>
                                      ))}
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
                  {/* Employees without a sector */}
                  {filteredFuncionarios.filter(f => !f.setor || !setores.includes(f.setor)).length > 0 && (
                    <>
                      <tr>
                        <td colSpan={days.length + 1} className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sem Setor</span>
                        </td>
                      </tr>
                      {filteredFuncionarios.filter(f => !f.setor || !setores.includes(f.setor)).map((func, idx) => (
                        <tr key={func.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                          <td className="sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 px-2 py-1 bg-inherit">
                            <div className="truncate text-[11px] font-semibold max-w-[110px]">{func.nome}</div>
                          </td>
                          {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd')
                            return <td key={dateStr} className="px-px py-px text-center"><div className="w-6 h-6 rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-slate-300 inline-flex items-center justify-center text-[8px]">·</div></td>
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-3">
          {filteredFuncionarios.length} funcionários · {days.length} dias · Clique em uma célula para alterar o status
        </p>
      </div>

      {/* Generate modal */}
      <Modal
        open={generateModal}
        onClose={() => setGenerateModal(false)}
        title="Preencher Escala Automática"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setGenerateModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={batchMutation.isPending} onClick={handleGenerateWeek}>Gerar Escala</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Preencher automaticamente todos os funcionários {filterSetor ? `do setor "${filterSetor}"` : ''} com status
            <strong className="text-blue-600"> Trabalho (T)</strong> nos dias úteis (seg a sáb). Domingos ficam vazios. Dias já preenchidos não serão alterados.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 font-medium">
            Período: <strong className="capitalize">{title}</strong> · {filteredFuncionarios.length} funcionários
          </div>
        </div>
      </Modal>
    </div>
  )
}
