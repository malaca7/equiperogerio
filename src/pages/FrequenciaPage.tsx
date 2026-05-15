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
  Clock,
  Filter
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useUpdateEscala, useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { cn } from '../lib/utils'
import { Badge } from '../components/ui/Badge'

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

  // Grouping for the "Chamada"
  const processedData = useMemo(() => {
    const workingGroups: Record<string, { id: string; nome: string; setor: string; members: any[] }> = {}
    const notWorkingGroups: Record<string, { label: string; icon: string; members: any[] }> = {
      'folga': { label: 'Folgas / Repouso', icon: '🏖️', members: [] },
      'ferias': { label: 'Férias', icon: '✈️', members: [] },
      'atestado': { label: 'Afastamentos / Atestados', icon: '🏥', members: [] },
      'outros': { label: 'Outros', icon: '📄', members: [] },
    }
    
    // Initialize working groups with localities
    localidadesConfig.forEach(l => {
      workingGroups[l.id] = { ...l, members: [] }
    })
    workingGroups['sem_local'] = { id: 'sem_local', nome: 'Sem Localidade', setor: 'Geral', members: [] }

    const workStatuses = ['presente', 'falta', 'hora_extra']

    escalas.forEach((e: any) => {
      if (e.data !== dateStr) return
      const f = funcMap[e.funcionario_id]
      if (!f) return

      const member = {
        ...f,
        escalaId: e.id,
        tipo: e.tipo,
        localidade: e.localidade
      }

      if (workStatuses.includes(e.tipo)) {
        // Find which locality card this employee belongs to
        const loc = localidadesConfig.find(l => l.nome === e.localidade && l.setor === f.setor)
        const locKey = loc ? loc.id : 'sem_local'
        workingGroups[locKey].members.push(member)
      } else {
        // Categorize non-working statuses
        if (e.tipo === 'repouso' || e.tipo === 'compensar') notWorkingGroups['folga'].members.push(member)
        else if (e.tipo === 'ferias') notWorkingGroups['ferias'].members.push(member)
        else if (e.tipo === 'atestado') notWorkingGroups['atestado'].members.push(member)
        else notWorkingGroups['outros'].members.push(member)
      }
    })

    return { workingGroups, notWorkingGroups }
  }, [escalas, dateStr, funcMap, localidadesConfig])

  // Actions
  const handleStatus = async (escalaId: string, tipo: string) => {
    try {
      await updateMutation.mutateAsync({ id: escalaId, data: { tipo } })
    } catch (err: any) {
      toast('Erro ao atualizar: ' + err.message, 'error')
    }
  }

  const prevDay = () => setCurrentDate(subDays(currentDate, 1))
  const nextDay = () => setCurrentDate(addDays(currentDate, 1))

  if (loadF || loadE) return <div className="main-content"><TopHeader title="Chamada Diária" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  const { workingGroups, notWorkingGroups } = processedData
  const totalInWork = Object.values(workingGroups).reduce((acc, g) => acc + g.members.length, 0)
  const totalOut = Object.values(notWorkingGroups).reduce((acc, g) => acc + g.members.length, 0)
  const presentCount = Object.values(workingGroups).flatMap(g => g.members).filter(m => m.tipo === 'presente' || m.tipo === 'hora_extra').length
  const absentCount = Object.values(workingGroups).flatMap(g => g.members).filter(m => m.tipo === 'falta').length

  const filteredSearch = (m: any) => m.nome.toLowerCase().includes(searchTerm.toLowerCase())

  return (
    <div className="main-content pb-24 bg-background">
      <TopHeader 
        title="Chamada Diária" 
        subtitle={format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} 
      />

      <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-md border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevDay} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center hover:scale-110 transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-center">
            <p className="text-sm font-black text-foreground uppercase tracking-tight">
              {isToday(currentDate) ? 'Hoje' : format(currentDate, 'dd/MM/yyyy')}
            </p>
            <p className="text-[10px] font-bold text-primary uppercase">{format(currentDate, 'EEEE', { locale: ptBR })}</p>
          </div>
          <button onClick={nextDay} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center hover:scale-110 transition-all shadow-sm"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-2 border border-emerald-100 dark:border-emerald-900/30 text-center shadow-sm">
            <span className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Presentes</span>
            <span className="block text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none">{presentCount}</span>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-2 border border-red-100 dark:border-red-900/30 text-center shadow-sm">
            <span className="block text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-0.5">Faltas</span>
            <p className="text-lg font-black text-red-700 dark:text-red-400">{absentCount}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        <div className="flex gap-2">
          <div className="flex-1 bg-card rounded-2xl border border-border p-2 flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black uppercase text-foreground tracking-tighter">Em Serviço (Fazer Chamada)</h2>
          </div>
        </div>

        {Object.values(workingGroups)
          .filter(g => g.members.some(filteredSearch))
          .map(group => (
          <div key={group.id} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.nome}</h3>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground">{group.members.filter(filteredSearch).length} colaboradores</span>
            </div>

            <div className="space-y-2">
              {group.members
                .filter(filteredSearch)
                .map(member => (
                <div key={member.id} className="bg-card rounded-3xl border border-border p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all border border-border",
                      "bg-card text-muted-foreground"
                    )}>
                      {member.nome.substring(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground leading-tight">{member.nome}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{member.cargo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleStatus(member.escalaId, 'falta')}
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm border border-border",
                        member.tipo === 'falta' ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/30" : "bg-card text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleStatus(member.escalaId, 'presente')}
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm border border-border",
                        member.tipo === 'presente' || member.tipo === 'hora_extra' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/30" : "bg-card text-muted-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-500"
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

        {totalOut > 0 && (
          <div className="space-y-6 pt-4 border-t border-border">
            <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between mb-4 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground border border-border shadow-sm">
                <Filter className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-black uppercase text-muted-foreground tracking-tighter">Ausentes / Fora de Escala</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {Object.entries(notWorkingGroups)
                .filter(([_, g]) => g.members.some(filteredSearch))
                .map(([id, group]) => (
                <div key={id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-base">{group.icon}</span>
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.label}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.members.filter(filteredSearch).map(member => (
                      <div key={member.id} className="bg-card rounded-2xl border border-border p-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-xs font-bold border border-blue-100 dark:border-blue-800">
                            {member.nome.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{member.nome}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-black">{member.tipo}</p>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            member.tipo === 'ferias' ? 'vacation' : 
                            member.tipo === 'atestado' ? 'medical' : 
                            (member.tipo === 'repouso' || member.tipo === 'compensar') ? 'off' : 
                            'default'
                          } 
                          className="text-[9px] uppercase"
                        >
                          {member.tipo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalInWork === 0 && totalOut === 0 && (
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
          <div className="relative flex items-center bg-card border border-border rounded-3xl p-1 shadow-2xl">
            <div className="w-10 h-10 flex items-center justify-center text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar na chamada..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-foreground px-2 placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
