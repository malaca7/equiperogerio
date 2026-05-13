import React, { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval as eachDay, addWeeks, subWeeks, isToday as checkIsToday, isSunday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Search, MapPin, Plus, UserPlus } from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA } from './ConfiguracoesPage'
import type { TipoEscala } from './ConfiguracoesPage'

export function EscalaLocalidadePage() {
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [assignCell, setAssignCell] = useState<{ locName: string; dateStr: string; setor: string } | null>(null)

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(format(currentDate, 'yyyy-MM'))
  const { data: setores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: localidadesConfig = [] } = useConfiguracao<{id:string;nome:string;setor:string}[]>('localidades', [])
  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const batchMutation = useBatchUpsertEscalas()
  const updateMutation = useUpdateEscala()

  const days = useMemo(() => {
    return eachDay({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) })
  }, [currentDate])

  const navigate_prev = () => setCurrentDate(subWeeks(currentDate, 1))
  const navigate_next = () => setCurrentDate(addWeeks(currentDate, 1))

  // Funcionario lookup
  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') {
        map[f.id] = f
      }
    })
    return map
  }, [allFuncionarios])

  // Identificar quais tipos contam como "trabalho" (geralmente T, ou tipos que não sejam repouso/folga/falta)
  // Para simplificar, assumimos que se tem 'localidade' definida ou se não é repouso/folga/falta, está trabalhando.
  // Mas o ideal é filtrar pelo id. Vamos assumir que 'presente' é o principal.
  
  const agrupamentoLocalidade = useMemo(() => {
    // loc -> date -> Funcionario[]
    const agrupado: Record<string, Record<string, any[]>> = {}
    
    // Iniciar com todas as localidades da config
    localidadesConfig.forEach(lc => {
      agrupado[lc.nome] = {}
      days.forEach(d => agrupado[lc.nome][format(d, 'yyyy-MM-dd')] = [])
    })
    agrupado['Sem Local'] = {}
    days.forEach(d => agrupado['Sem Local'][format(d, 'yyyy-MM-dd')] = [])

    escalas.forEach((e: any) => {
      const f = funcMap[e.funcionario_id]
      if (!f) return
      
      // Aplicar filtros de busca
      if (searchTerm && !f.nome.toLowerCase().includes(searchTerm.toLowerCase())) return
      if (filterSetor && f.setor !== filterSetor) return

      // Somente considera quem está "trabalhando" (não é repouso, folga, ferias, falta, etc)
      // Tipos padrão que são "ausências": repouso, compensar, ferias, atestado, falta, falta_justificada, suspensao, etc
      const ausencias = ['repouso', 'compensar', 'ferias', 'atestado', 'falta', 'falta_justificada', 'suspensao', 'obito_familiar', 'paternidade']
      if (ausencias.includes(e.tipo)) return // não está trabalhando

      const locName = e.localidade || 'Sem Local'
      const dateStr = e.data
      
      if (!agrupado[locName]) {
        agrupado[locName] = {}
        days.forEach(d => agrupado[locName][format(d, 'yyyy-MM-dd')] = [])
      }
      
      if (agrupado[locName][dateStr]) {
        agrupado[locName][dateStr].push(f)
      }
    })
    
    return agrupado
  }, [escalas, funcMap, localidadesConfig, days, searchTerm, filterSetor])

  const handleAssignFuncionario = async (funcId: string) => {
    if (!assignCell) return
    try {
      // Find existing escala for this func and date
      const existing = escalas.find((e: any) => e.funcionario_id === funcId && e.data === assignCell.dateStr)
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          data: { localidade: assignCell.locName === 'Sem Local' ? null : assignCell.locName, tipo: 'presente' }
        })
      } else {
        await batchMutation.mutateAsync([{
          funcionario_id: funcId,
          data: assignCell.dateStr,
          tipo: 'presente',
          localidade: assignCell.locName === 'Sem Local' ? null : assignCell.locName,
          turno: 'integral'
        }])
      }
      toast('Funcionário alocado com sucesso!', 'success')
      setAssignCell(null)
    } catch (e: any) {
      toast('Erro ao alocar: ' + e.message, 'error')
    }
  }

  const handleRemoveFromLocal = async (e: React.MouseEvent, escalaId: string) => {
    e.stopPropagation()
    try {
      await updateMutation.mutateAsync({
        id: escalaId,
        data: { localidade: null }
      })
      toast('Funcionário removido do local', 'success')
    } catch (err: any) {
      toast('Erro ao remover', 'error')
    }
  }

  if (loadF || loadE) return <div className="main-content"><TopHeader title="Equipe por Localidade" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  // Ordenar localidades por Setor, depois por nome
  const locList = localidadesConfig.slice().sort((a, b) => {
    if (a.setor !== b.setor) return a.setor.localeCompare(b.setor)
    return a.nome.localeCompare(b.nome)
  })

  // Adicionar "Sem Local" no final
  const rowNames = [...locList.map(l => l.nome), 'Sem Local']

  return (
    <div className="main-content pb-24">
      <TopHeader title="Equipe por Localidade" />
      
      {/* Tools */}
      <div className="sticky top-14 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button onClick={navigate_prev} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition">
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="text-center flex-1">
              <p className="text-sm font-black text-slate-800 dark:text-slate-100 capitalize">
                {format(days[0], "dd 'de' MMM", { locale: ptBR })} — {format(days[6], "dd 'de' MMM", { locale: ptBR })}
              </p>
            </div>
            <button onClick={navigate_next} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition">
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <select value={filterSetor} onChange={e => setFilterSetor(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Todos os Setores</option>
              {setores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-2 text-left min-w-[140px] max-w-[160px]">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Localidade</span>
                </th>
                {days.map(day => (
                  <th key={day.toISOString()} className={`px-2 py-2 border-b border-slate-200 dark:border-slate-700 min-w-[140px] ${checkIsToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{format(day, 'EEE', { locale: ptBR })}</span>
                      <span className={`text-[13px] font-black ${checkIsToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {format(day, 'dd')}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Renderizar agrupado por setor (opcional, mas fica mais bonito) */}
              {setores.filter(s => !filterSetor || s === filterSetor).map(setor => {
                const locsDoSetor = locList.filter(l => l.setor === setor)
                if (locsDoSetor.length === 0) return null

                // Verificar se há alguém escalado neste setor inteiro na semana
                const temAlguem = locsDoSetor.some(loc => {
                  return days.some(d => agrupamentoLocalidade[loc.nome]?.[format(d, 'yyyy-MM-dd')]?.length > 0)
                })

                if (!temAlguem) return null // Esconde setores vazios

                return (
                  <React.Fragment key={setor}>
                    <tr>
                      <td colSpan={8} className="sticky left-0 z-20 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1.5 border-b border-t border-slate-200 dark:border-slate-700 text-left">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">{setor}</span>
                      </td>
                    </tr>
                    {locsDoSetor.map((loc, idx) => {
                      const rowData = agrupamentoLocalidade[loc.nome]
                      if (!rowData) return null
                      // Se a localidade não tem ninguem a semana toda, podemos pular, ou mostrar vazia. Mostrar vazia ajuda a ver onde falta gente.
                      return (
                        <tr key={loc.id} className="group border-b border-slate-100 dark:border-slate-800/50">
                          <td className={`sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="text-xs font-bold leading-tight">{loc.nome}</span>
                            </div>
                          </td>
                          {days.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const funcs = rowData[dateStr] || []
                            const isToday = checkIsToday(day)
                            const isSun = isSunday(day)
                            
                            return (
                              <td 
                                key={dateStr} 
                                onClick={() => setAssignCell({ locName: loc.nome, dateStr, setor: loc.setor })}
                                className={`px-2 py-1.5 align-top border-r border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} ${isSun ? 'bg-red-50/20 dark:bg-red-900/5' : ''}`}
                              >
                                <div className="flex flex-col gap-1 min-h-[32px]">
                                  {funcs.length === 0 ? (
                                    <span className="text-[10px] text-slate-300 dark:text-slate-600 italic block mt-1 text-center">-</span>
                                  ) : (
                                    funcs.map(f => {
                                      const esc = escalas.find((e: any) => e.funcionario_id === f.id && e.data === dateStr)
                                      return (
                                        <div key={f.id} className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-1 rounded shadow-sm flex items-center gap-1 group/item">
                                          <div className="w-1 h-3 bg-blue-500 rounded-full shrink-0"></div>
                                          <span className="truncate flex-1 text-slate-700 dark:text-slate-300 font-medium">{f.nome.split(' ')[0]} {f.nome.split(' ')[1]?.[0] ? f.nome.split(' ')[1][0] + '.' : ''}</span>
                                          {esc && (
                                            <button 
                                              onClick={(e) => handleRemoveFromLocal(e, esc.id)}
                                              className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 p-0.5 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                              title="Remover do Local"
                                            >
                                              <UserPlus className="w-3 h-3 rotate-45" />
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}

              {/* Linha "Sem Local" (opcional: apenas se tiver alguem sem local escalado trabalhando) */}
              {(() => {
                const rowData = agrupamentoLocalidade['Sem Local']
                const temAlguem = days.some(d => rowData?.[format(d, 'yyyy-MM-dd')]?.length > 0)
                if (!temAlguem) return null

                return (
                  <>
                    <tr>
                      <td colSpan={8} className="sticky left-0 z-20 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1.5 border-b border-t border-slate-200 dark:border-slate-700 text-left">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">A Definir / Sem Local</span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50">
                      <td className="sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900">
                        <span className="text-xs font-bold text-slate-500 italic">Sem Local</span>
                      </td>
                      {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const funcs = rowData[dateStr] || []
                        return (
                          <td key={dateStr} className="px-2 py-1.5 align-top border-r border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col gap-1">
                              {funcs.map(f => (
                                <div key={f.id} className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-1 rounded shadow-sm flex items-center gap-1">
                                  <div className="w-1 h-3 bg-slate-400 rounded-full shrink-0"></div>
                                  <span className="truncate flex-1 text-slate-600 dark:text-slate-400">{f.nome.split(' ')[0]} {f.nome.split(' ')[1]?.[0]}.</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!assignCell} onClose={() => setAssignCell(null)} title="Adicionar à Localidade">
        {assignCell && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">{assignCell.setor}</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-1">
                <MapPin className="w-4 h-4 text-blue-500" /> {assignCell.locName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Data: {format(parseISO(assignCell.dateStr), "dd/MM/yyyy")}</p>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Funcionários ({assignCell.setor})</p>
              {allFuncionarios
                .filter(f => f.setor === assignCell.setor && f.cargo?.toLowerCase() !== 'encarregado')
                .map(f => {
                  const isAlreadyHere = agrupamentoLocalidade[assignCell.locName]?.[assignCell.dateStr]?.some(x => x.id === f.id)
                  return (
                    <button
                      key={f.id}
                      disabled={isAlreadyHere}
                      onClick={() => handleAssignFuncionario(f.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all
                        ${isAlreadyHere 
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-sm'
                        }`}
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{f.nome}</span>
                      {isAlreadyHere ? (
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-bold">Já adicionado</span>
                      ) : (
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      )}
                    </button>
                  )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
