import React, { useState, useMemo } from 'react'
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
  Clock
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useUpdateEscala, useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { cn } from '../lib/utils'

interface Localidade {
  id: string
  nome: string
  setor: string
}

export function FrequenciaPage() {
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()))
  const [searchTerm, setSearchTerm] = useState('')

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(format(currentDate, 'yyyy-MM'))
  const { data: localidadesConfig = [] } = useConfiguracao<Localidade[]>('localidades', [])

  const updateMutation = useUpdateEscala()
  const batchMutation = useBatchUpsertEscalas()

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => {
      if (f.cargo?.toLowerCase() !== 'encarregado') map[f.id] = f
    })
    return map
  }, [allFuncionarios])

  // Grouping by locality for the "Chamada"
  const attendanceGroups = useMemo(() => {
    const groups: Record<string, { id: string; nome: string; setor: string; members: any[] }> = {}
    
    // Initialize groups with localities
    localidadesConfig.forEach(l => {
      groups[l.id] = { ...l, members: [] }
    })
    groups['sem_local'] = { id: 'sem_local', nome: 'Sem Localidade', setor: 'Geral', members: [] }

    escalas.forEach((e: any) => {
      if (e.data !== dateStr) return
      const f = funcMap[e.funcionario_id]
      if (!f) return

      // Find which locality card this employee belongs to
      const loc = localidadesConfig.find(l => l.nome === e.localidade && l.setor === f.setor)
      const locKey = loc ? loc.id : 'sem_local'
      
      groups[locKey].members.push({
        ...f,
        escalaId: e.id,
        tipo: e.tipo,
        localidade: e.localidade
      })
    })

    return groups
  }, [escalas, dateStr, funcMap, localidadesConfig])

  // Actions
  const handleStatus = async (escalaId: string, tipo: string) => {
    try {
      await updateMutation.mutateAsync({ id: escalaId, data: { tipo } })
      // Toast opcional para não poluir muito
    } catch (err: any) {
      toast('Erro ao atualizar: ' + err.message, 'error')
    }
  }

  const prevDay = () => setCurrentDate(subDays(currentDate, 1))
  const nextDay = () => setCurrentDate(addDays(currentDate, 1))

  if (loadF || loadE) return <div className="main-content"><TopHeader title="Chamada Diária" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  const totalMembers = Object.values(attendanceGroups).reduce((acc, g) => acc + g.members.length, 0)
  const presentCount = Object.values(attendanceGroups).flatMap(g => g.members).filter(m => m.tipo === 'presente').length
  const absentCount = Object.values(attendanceGroups).flatMap(g => g.members).filter(m => m.tipo === 'falta').length

  return (
    <div className="main-content pb-24 bg-slate-50 dark:bg-slate-950">
      <TopHeader 
        title="Chamada Diária" 
        subtitle={format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} 
      />

      {/* Date Navigator & Stats */}
      <div className="sticky top-14 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevDay} className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:scale-110 transition-all"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-center">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              {isToday(currentDate) ? 'Hoje' : format(currentDate, 'dd/MM/yyyy')}
            </p>
            <p className="text-[10px] font-bold text-blue-600 uppercase">{format(currentDate, 'EEEE', { locale: ptBR })}</p>
          </div>
          <button onClick={nextDay} className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:scale-110 transition-all"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 border border-slate-100 dark:border-slate-700 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase">Equipe</p>
            <p className="text-lg font-black text-slate-700 dark:text-slate-200">{totalMembers}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-2 border border-emerald-100 dark:border-emerald-900/30 text-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase">Presentes</p>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{presentCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-2 border border-red-100 dark:border-red-900/30 text-center">
            <p className="text-[10px] font-black text-red-600 uppercase">Faltas</p>
            <p className="text-lg font-black text-red-700 dark:text-red-400">{absentCount}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        {Object.values(attendanceGroups)
          .filter(g => g.members.length > 0)
          .map(group => (
          <div key={group.id} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">{group.nome}</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{group.members.length} colaboradores</span>
            </div>

            <div className="space-y-2">
              {group.members
                .filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(member => (
                <div key={member.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all",
                      member.tipo === 'presente' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : 
                      member.tipo === 'falta' ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                      "bg-slate-100 text-slate-400 dark:bg-slate-800"
                    )}>
                      {member.nome.substring(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">{member.nome}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{member.cargo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleStatus(member.escalaId, 'falta')}
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                        member.tipo === 'falta' ? "bg-red-600 text-white shadow-lg shadow-red-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleStatus(member.escalaId, 'presente')}
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                        member.tipo === 'presente' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-500"
                      )}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {totalMembers === 0 && (
          <div className="py-20 text-center opacity-30">
            <Clock className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg font-black uppercase">Ninguém Escalado</p>
            <p className="text-sm">Preencha a escala de localidades para hoje.</p>
          </div>
        )}
      </div>

      {/* Floating Search */}
      <div className="fixed bottom-24 left-4 right-4 z-40">
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-600 rounded-3xl blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-1 shadow-2xl">
            <div className="w-10 h-10 flex items-center justify-center text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar na chamada..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 px-2"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
