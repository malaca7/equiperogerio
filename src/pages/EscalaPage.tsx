import { useState, useRef, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBRLocale from '@fullcalendar/core/locales/pt-br'
import { format, subDays, parseISO, isSunday, startOfWeek, addDays, subWeeks, addWeeks, getWeek } from 'date-fns'
import { Plus, Trash2, Copy, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Select, Textarea } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useCreateEscala, useDeleteEscala, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA } from './ConfiguracoesPage'
import { escalaTipoLabel, escalaTipoColor, currentMonth } from '../lib/utils'
import type { EscalaTipo } from '../lib/database.types'

const tipoOptions: { value: EscalaTipo; label: string }[] = [
  { value: 'presente', label: 'Presente (X)' },
  { value: 'falta', label: 'Falta' },
  { value: 'falta_justificada', label: 'Falta Justificada' },
  { value: 'suspensao', label: 'Suspensão' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'paternidade', label: 'Paternidade' },
  { value: 'obito_familiar', label: 'Óbito Familiar' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'repouso', label: 'Descanso' },
  { value: 'compensar', label: 'Compensar' },
  { value: 'ferias', label: 'Férias' },
  { value: 'transferencia', label: 'Transferência' },
]

const turnoOptions: { value: string; label: string }[] = [
  { value: '', label: 'Sem turno' },
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'integral', label: 'Integral' },
]

// Removed AddModalState

interface EventClickState {
  escalaId: string
  title: string
}

export function EscalaPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const [currentMonthStr, setCurrentMonthStr] = useState(currentMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [clickedEvent, setClickedEvent] = useState<EventClickState | null>(null)

  const [generateWeekModal, setGenerateWeekModal] = useState(false)
  const [weekStartDate, setWeekStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: allFuncionarios = [] } = useFuncionarios({ status: 'ativo' })
  const funcionarios = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
  const { data: escalas = [] } = useEscalasMensal(currentMonthStr)
  const { data: localidadesList = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<any[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const STATUS_CONFIG = useMemo(() => {
    return (tiposEscala || DEFAULT_TIPOS_ESCALA).reduce((acc: any, t: any) => {
      acc[t.id] = t
      return acc
    }, {})
  }, [tiposEscala])

  const createMutation = useCreateEscala()
  const updateMutation = useUpdateEscala()
  const deleteMutation = useDeleteEscala()
  const batchUpsertMutation = useBatchUpsertEscalas()

  // Map escalas to FullCalendar events
  const events = escalas.map((e: any) => {
    const cfg = STATUS_CONFIG[e.tipo]
    return {
      id: e.id,
      title: e.funcionarios?.nome
        ? `${e.funcionarios.apelido || e.funcionarios.nome.split(' ')[0]} — ${cfg?.nome || e.tipo}`
        : cfg?.nome || e.tipo,
      date: e.data,
      backgroundColor: cfg?.hex || 'hsl(var(--primary))',
      borderColor: 'transparent',
      textColor: 'hsl(var(--primary-foreground))',
      extendedProps: { escala: e },
    }
  })

  const handleDateClick = (info: any) => {
    setSelectedDate(info.dateStr)
  }

  const handleEventClick = (info: any) => {
    setClickedEvent({
      escalaId: info.event.id,
      title: info.event.title,
    })
  }

  const handleDatesSet = (info: any) => {
    const d = info.view.currentStart
    setCurrentMonthStr(format(d, 'yyyy-MM'))
  }

  // Save logic is now handled inline in the dropdowns

  const handleDelete = async () => {
    if (!clickedEvent) return
    try {
      await deleteMutation.mutateAsync(clickedEvent.escalaId)
      toast('Escala removida', 'success')
      setClickedEvent(null)
    } catch {
      toast('Erro ao remover escala', 'error')
    }
  }

  const handleCopyFromYesterday = async () => {
    if (!selectedDate) return
    const currentDate = selectedDate
    const yesterdayDate = format(subDays(parseISO(currentDate), 1), 'yyyy-MM-dd')
    
    // Pegar as escalas de ontem usando as escalas já carregadas na tela (se for do mesmo mês)
    // Para simplificar, assumimos que estão no mesmo mês ou usamos cache (mas pode cruzar o mês).
    // O ideal seria ter os dados do mês anterior se ontem for dia 31, mas como é pra simplificar:
    let yesterdayScales = escalas.filter(e => e.data === yesterdayDate)
    
    // Ignorar quem estava de Repouso (repouso) ou Compensar (compensar) ou Folga
    const toIgnore = ['repouso', 'compensar', 'folga']
    yesterdayScales = yesterdayScales.filter(e => !toIgnore.includes(e.tipo))

    if (yesterdayScales.length === 0) {
      toast('Não há escala válida ontem para copiar (ou o mês anterior não está carregado)', 'warning')
      return
    }

    try {
      const inserts = yesterdayScales.map(e => ({
        funcionario_id: e.funcionario_id,
        data: currentDate,
        tipo: e.tipo,
        turno: e.turno,
        observacoes: e.observacoes,
      }))
      await batchUpsertMutation.mutateAsync(inserts)
      toast(`Copiados ${inserts.length} registros de ontem com sucesso!`, 'success')
      setSelectedDate(null)
    } catch (err) {
      toast('Erro ao copiar escala de ontem', 'error')
    }
  }

  const handleEventDrop = async (info: any) => {
    const { event } = info
    const escalaId = event.id
    const novaData = format(event.start, 'yyyy-MM-dd')

    try {
      await updateMutation.mutateAsync({
        id: escalaId,
        data: { data: novaData }
      })
      toast('Escala movida com sucesso', 'success')
    } catch {
      info.revert()
      toast('Erro ao mover escala', 'error')
    }
  }

  const handleGenerateWeek = async () => {
    if (!funcionarios.length) return toast('Nenhum funcionário ativo', 'warning')
    
    try {
      const baseDate = parseISO(weekStartDate)
      const weekNum = getWeek(baseDate)
      const inserts: any[] = []
      
      // Gera de Segunda a Domingo (7 dias)
      for (let i = 0; i < 7; i++) {
        const currentDateObj = new Date(baseDate.getTime() + i * 86400000)
        const currentDateStr = format(currentDateObj, 'yyyy-MM-dd')
        const isSun = i === 6 // Domingo

        funcionarios.forEach((f, fIdx) => {
          // Verifica se já tem escala nesse dia
          const exists = escalas.some(e => e.funcionario_id === f.id && e.data === currentDateStr)
          if (exists) return

          if (isSun) {
            // Regra de 50% para o Domingo: alterna baseado no índice do funcionário e número da semana
            const worksThisSunday = (fIdx + weekNum) % 2 === 0
            
            if (worksThisSunday) {
              // 1. Trabalha no Domingo
              inserts.push({
                funcionario_id: f.id,
                data: currentDateStr,
                tipo: 'presente',
                turno: 'integral'
              })

              // 2. Compensado na MESMA semana (Distribuído entre Quinta, Sexta e Sábado)
              const thu = format(addDays(baseDate, 3), 'yyyy-MM-dd')
              const fri = format(addDays(baseDate, 4), 'yyyy-MM-dd')
              const sat = format(addDays(baseDate, 5), 'yyyy-MM-dd')
              
              const compOptions = [sat, fri, thu]
              const compDate = compOptions[fIdx % compOptions.length]
              
              // Remove se já adicionamos 'presente' para esse dia no loop anterior deste mesmo handleGenerateWeek
              const existingInInsertsComp = inserts.findIndex(ins => ins.funcionario_id === f.id && ins.data === compDate)
              if (existingInInsertsComp !== -1) {
                inserts[existingInInsertsComp].tipo = 'compensar'
              } else {
                inserts.push({ funcionario_id: f.id, data: compDate, tipo: 'compensar', turno: 'integral' })
              }

              // 3. Repouso na PRÓXIMA semana (Distribuído entre Segunda, Terça e Quinta)
              const nextMon = format(addDays(baseDate, 7), 'yyyy-MM-dd')
              const nextTue = format(addDays(baseDate, 8), 'yyyy-MM-dd')
              const nextThu = format(addDays(baseDate, 10), 'yyyy-MM-dd')
              
              const repOptions = [nextMon, nextTue, nextThu]
              const repDate = repOptions[fIdx % repOptions.length]

              inserts.push({ funcionario_id: f.id, data: repDate, tipo: 'repouso', turno: 'integral' })
              
            } else {
              // Não trabalha no Domingo (Repouso)
              inserts.push({
                funcionario_id: f.id,
                data: currentDateStr,
                tipo: 'repouso',
                turno: 'integral'
              })
            }
          } else {
            // Dias normais (Seg-Sab) - apenas se ainda não foi definido como 'compensar' pela lógica do Domingo acima
            const alreadyAssigned = inserts.some(ins => ins.funcionario_id === f.id && ins.data === currentDateStr)
            if (!alreadyAssigned) {
              inserts.push({
                funcionario_id: f.id,
                data: currentDateStr,
                tipo: 'presente',
                turno: 'integral'
              })
            }
          }
        })
      }

      if (inserts.length === 0) {
        toast('Todos os dias dessa semana já estão preenchidos!', 'warning')
        setGenerateWeekModal(false)
        return
      }

      await batchUpsertMutation.mutateAsync(inserts)
      toast(`Escala Semanal Gerada! Equipe dividida 50/50 no domingo com folgas ajustadas.`, 'success')
      setGenerateWeekModal(false)
    } catch (err: any) {
      console.error(err)
      toast(`Erro ao gerar: ${err?.message || 'Desconhecido'}`, 'error')
    }
  }

  const funcOptions = funcionarios.map(f => ({ value: f.id, label: f.nome }))

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Escala" subtitle="Calendário mensal" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Elite Glass Toolbar */}
        <div className="bg-card/80 dark:bg-card/50 backdrop-blur-xl border border-border rounded-[2.5rem] p-4 sm:p-6 shadow-sm mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                onClick={() => setGenerateWeekModal(true)} 
                className="rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" /> Preencher Semana
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate('/escala/imprimir-semanal')} 
                className="rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest border border-border"
              >
                <Printer className="w-4 h-4 text-blue-500" /> Mural Semanal
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate('/escala/imprimir-mensal')} 
                className="rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest border border-border"
              >
                <Printer className="w-4 h-4 text-purple-500" /> Mural Mensal
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {tipoOptions.slice(0, 6).map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: escalaTipoColor[value] }}
                  />
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Container */}
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-[2.5rem] p-6 shadow-xl overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="tresDias"
            initialDate={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
            locale={ptBRLocale}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            editable={true}
            droppable={true}
            eventDrop={handleEventDrop}
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: 'tresDias,dayGridWeek,dayGridMonth',
            }}
            views={{
              tresDias: {
                type: 'dayGrid',
                duration: { days: 3 },
                buttonText: '3 Dias'
              },
              dayGridMonth: { buttonText: 'Mês' },
              dayGridWeek: { buttonText: 'Semana' }
            }}
            height="auto"
            dayMaxEvents={false}
            eventDisplay="block"
            fixedWeekCount={false}
          />
        </div>

        {/* Tap hint */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
            Toque em um dia para adicionar escala • Arraste para mover
          </p>
        </div>
      </div>


      {/* Day Manager modal */}
      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={`Escala — ${selectedDate ? format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy') : ''}`}
        footer={
          <Button variant="secondary" className="w-full" onClick={() => setSelectedDate(null)}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-4">
          <Button
            variant="secondary"
            className="w-full flex justify-center gap-2"
            loading={batchUpsertMutation.isPending}
            onClick={handleCopyFromYesterday}
            type="button"
          >
            <Copy className="w-4 h-4" />
            Copiar de ontem (Ignora repouso/compensar)
          </Button>

          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-200">
            {funcionarios.map(func => {
              const escala = escalas.find(e => e.funcionario_id === func.id && e.data === selectedDate)
              const isSaving = batchUpsertMutation.isPending || updateMutation.isPending || deleteMutation.isPending
              
              return (
                <div key={func.id} className="flex flex-col gap-4 p-4 bg-card dark:bg-[hsl(var(--card))] rounded-2xl border border-border shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-foreground font-bold text-sm shrink-0">
                      {(func.apelido || func.nome).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{func.apelido || func.nome}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{func.setor || '-'}</p>
                    </div>
                    
                    <Select
                      className="w-32 sm:w-40 text-xs font-bold border-input rounded-xl"
                      value={escala?.tipo || ''}
                      disabled={isSaving}
                      onChange={(e) => {
                        const novoTipo = e.target.value
                        if (!novoTipo) {
                          if (escala) deleteMutation.mutate(escala.id)
                        } else {
                          const isWorkingSunday = isSunday(parseISO(selectedDate!)) && (novoTipo === 'presente' || novoTipo === 'hora_extra')
                          const updates: any[] = [{
                            funcionario_id: func.id,
                            data: selectedDate!,
                            tipo: novoTipo as EscalaTipo,
                            turno: 'integral',
                          }]
                          if (isWorkingSunday) {
                            const date = parseISO(selectedDate!)
                            const prevWeek = startOfWeek(subWeeks(date, 1), { weekStartsOn: 1 })
                            const thu = format(addDays(prevWeek, 3), 'yyyy-MM-dd')
                            const fri = format(addDays(prevWeek, 4), 'yyyy-MM-dd')
                            const sat = format(addDays(prevWeek, 5), 'yyyy-MM-dd')
                            const compTarget = [thu, fri, sat].find(d => !escalas.some(e => e.funcionario_id === func.id && e.data === d)) || sat
                            updates.push({ funcionario_id: func.id, data: compTarget, tipo: 'compensar', turno: 'integral' })
                            const nextWeek = startOfWeek(addWeeks(date, 1), { weekStartsOn: 1 })
                            const mon = format(nextWeek, 'yyyy-MM-dd')
                            const tue = format(addDays(nextWeek, 1), 'yyyy-MM-dd')
                            const nthu = format(addDays(nextWeek, 3), 'yyyy-MM-dd')
                            const repTarget = [mon, tue, nthu].find(d => !escalas.some(e => e.funcionario_id === func.id && e.data === d)) || mon
                            updates.push({ funcionario_id: func.id, data: repTarget, tipo: 'repouso', turno: 'integral' })
                          }
                          batchUpsertMutation.mutate(updates)
                        }
                      }}
                      options={[
                        { value: '', label: 'Vazio' },
                        ...tipoOptions
                      ]}
                    />
                  </div>

{escala && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-13 pt-2 border-t border-border/50">
                      {/* Localidade */}
                      {escala.tipo === 'presente' && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Localidade</label>
                          <select
                            className="w-full text-[11px] font-bold bg-muted border border-input rounded-lg p-1.5 outline-none"
                            value={escala.localidade || ''}
                            onChange={(e) => updateMutation.mutate({ id: escala.id, data: { localidade: e.target.value || null } })}
                          >
                            <option value="">Geral / Sem Localidade</option>
                            {(localidadesList as any[]).filter(l => !func.setor || l.setor === func.setor).map(l => (
                              <option key={l.id} value={l.nome}>{l.nome}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Ocorrência */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Ocorrência</label>
                        <input
                          type="text"
                          placeholder="Obs..."
                          className="w-full text-[11px] bg-transparent border-b border-input focus:border-primary outline-none pb-1"
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
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* Event click modal */}
      <Modal
        open={!!clickedEvent}
        onClose={() => setClickedEvent(null)}
        title="Escala"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setClickedEvent(null)}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </div>
        }
      >
        {clickedEvent && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {clickedEvent.title}
          </p>
        )}
      </Modal>

      {/* Generate Week modal */}
      <Modal
        open={generateWeekModal}
        onClose={() => setGenerateWeekModal(false)}
        title="Gerar Escala Semanal"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setGenerateWeekModal(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={batchUpsertMutation.isPending}
              onClick={handleGenerateWeek}
            >
              Gerar Escala
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Isto irá criar escalas automáticas com o tipo <strong>Presente (X)</strong> para todos os funcionários ativos da segunda-feira selecionada até o sábado. Dias já preenchidos não serão sobrescritos.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Data Inicial (Segunda-feira)
            </label>
            <input
              type="date"
              value={weekStartDate}
              onChange={e => setWeekStartDate(e.target.value)}
              className="input-base"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
