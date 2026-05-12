import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBRLocale from '@fullcalendar/core/locales/pt-br'
import { format, subDays, parseISO } from 'date-fns'
import { Plus, Trash2, Copy, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Select, Textarea } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal, useCreateEscala, useDeleteEscala, useBatchUpsertEscalas, useUpdateEscala } from '../hooks/useEscalas'
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
  { value: 'repouso', label: 'Repouso' },
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

  const { data: funcionarios = [] } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [] } = useEscalasMensal(currentMonthStr)
  const createMutation = useCreateEscala()
  const updateMutation = useUpdateEscala()
  const deleteMutation = useDeleteEscala()
  const batchUpsertMutation = useBatchUpsertEscalas()

  // Map escalas to FullCalendar events
  const events = escalas.map((e: any) => ({
    id: e.id,
    title: e.funcionarios?.nome
      ? `${e.funcionarios.nome.split(' ')[0]} — ${escalaTipoLabel[e.tipo as EscalaTipo]}`
      : escalaTipoLabel[e.tipo as EscalaTipo],
    date: e.data,
    backgroundColor: escalaTipoColor[e.tipo as EscalaTipo],
    borderColor: 'transparent',
    textColor: '#fff',
    extendedProps: { escala: e },
  }))

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
      const inserts: any[] = []
      
      // Gera de segunda a sabado (6 dias)
      for (let i = 0; i < 6; i++) {
        const currentDate = format(new Date(baseDate.getTime() + i * 86400000), 'yyyy-MM-dd')
        
        funcionarios.forEach(f => {
          // Verifica se já tem escala nesse dia
          const exists = escalas.some(e => e.funcionario_id === f.id && e.data === currentDate)
          if (!exists) {
            inserts.push({
              funcionario_id: f.id,
              data: currentDate,
              tipo: 'presente',
              turno: 'integral',
              observacoes: 'Gerado automaticamente',
            })
          }
        })
      }

      if (inserts.length === 0) {
        toast('Todos os dias dessa semana já estão preenchidos!', 'warning')
        setGenerateWeekModal(false)
        return
      }

      await batchUpsertMutation.mutateAsync(inserts)
      toast(`Semana gerada! ${inserts.length} escalas criadas.`, 'success')
      setGenerateWeekModal(false)
    } catch (err: any) {
      console.error(err)
      toast(`Erro ao gerar: ${err?.message || 'Desconhecido'}`, 'error')
    }
  }

  const funcOptions = funcionarios.map(f => ({ value: f.id, label: f.nome }))

  return (
    <div className="main-content">
      <TopHeader title="Escala" subtitle="Calendário mensal" />

      <div className="px-4 pt-3 pb-4">
        {/* Actions & Legend */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={() => setGenerateWeekModal(true)} 
              className="w-full gap-2 bg-[hsl(var(--primary))] text-white border shadow-sm hover:brightness-110"
            >
              <Plus className="w-4 h-4" />
              Preencher Semana
            </Button>
            <Button 
              onClick={() => navigate('/escala/imprimir')} 
              className="w-full gap-2 bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border shadow-sm hover:bg-[hsl(var(--muted))]"
              variant="ghost"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Mural Semanal
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {tipoOptions.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: escalaTipoColor[value] }}
              />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</span>
            </div>
          ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="card p-3 overflow-hidden">
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
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-3">
          Toque em um dia para adicionar escala • Toque no evento para excluir
        </p>
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

          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 pb-4">
            {funcionarios.map(func => {
              const escala = escalas.find(e => e.funcionario_id === func.id && e.data === selectedDate)
              
              return (
                <div key={func.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-sm shrink-0">
                    {func.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{func.nome}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{func.setor || '-'}</p>
                  </div>
                  <Select 
                    className="w-full sm:w-44 text-sm font-medium border-0 bg-slate-50 dark:bg-slate-900/50"
                    value={escala?.tipo || ''}
                    onChange={(e) => {
                      const novoTipo = e.target.value
                      if (!novoTipo) {
                        if (escala) deleteMutation.mutate(escala.id)
                      } else {
                        batchUpsertMutation.mutate([{
                          funcionario_id: func.id,
                          data: selectedDate!,
                          tipo: novoTipo as EscalaTipo,
                          turno: 'integral',
                        }])
                      }
                    }}
                    options={[
                      { value: '', label: 'Sem escala (Vazio)' },
                      ...tipoOptions
                    ]}
                  />
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
