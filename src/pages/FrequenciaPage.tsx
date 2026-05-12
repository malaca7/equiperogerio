import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Check, X, FileText, Umbrella, Star, Edit2 } from 'lucide-react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useFrequenciaData, useUpsertFrequencia, useBatchUpsertFrequencia, useFrequenciaMensal } from '../hooks/useFrequencia'
import type { Funcionario, FrequenciaStatus, Frequencia } from '../lib/database.types'
import { frequenciaStatusLabel, frequenciaStatusColor, formatDate, today } from '../lib/utils'
import { cn } from '../lib/utils'

const statusButtons: { status: FrequenciaStatus; icon: React.ElementType; label: string; color: string }[] = [
  { status: 'presente', icon: Check, label: 'Presente', color: 'bg-green-500 text-white' },
  { status: 'falta', icon: X, label: 'Falta', color: 'bg-red-500 text-white' },
  { status: 'atestado', icon: FileText, label: 'Atestado', color: 'bg-amber-500 text-white' },
  { status: 'folga', icon: Umbrella, label: 'Folga', color: 'bg-blue-500 text-white' },
  { status: 'hora_extra', icon: Star, label: 'H. Extra', color: 'bg-purple-500 text-white' },
  { status: 'ferias', icon: Clock, label: 'Férias', color: 'bg-teal-500 text-white' },
]

interface QuickEditModal {
  funcionario: Funcionario
  frequencia?: Frequencia
}

export function FrequenciaPage() {
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState(today())
  const [editModal, setEditModal] = useState<QuickEditModal | null>(null)
  const [editForm, setEditForm] = useState({
    status: 'presente' as FrequenciaStatus,
    entrada: '',
    saida: '',
    hora_extra: '',
    observacoes: '',
  })

  const [generateWeekModal, setGenerateWeekModal] = useState(false)
  const [weekStartDate, setWeekStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: allFuncionarios = [], isLoading: loadingFunc } = useFuncionarios({ status: 'ativo' })
  const funcionarios = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
  const { data: frequencias = [], isLoading: loadingFreq } = useFrequenciaData(selectedDate)
  const currentMonthStr = format(parseISO(selectedDate), 'yyyy-MM')
  const { data: mesFrequencias = [] } = useFrequenciaMensal(currentMonthStr)
  
  const upsertMutation = useUpsertFrequencia()
  const batchUpsertMutation = useBatchUpsertFrequencia()

  const isLoading = loadingFunc || loadingFreq

  const getFrequencia = (funcId: string) =>
    frequencias.find((f: any) => f.funcionario_id === funcId)

  const handleQuickStatus = async (func: Funcionario, status: FrequenciaStatus) => {
    try {
      await upsertMutation.mutateAsync({
        funcionario_id: func.id,
        data: selectedDate,
        status,
      })
    } catch {
      toast('Erro ao registrar frequência', 'error')
    }
  }

  const openEdit = (func: Funcionario) => {
    const freq = getFrequencia(func.id) as Frequencia | undefined
    setEditForm({
      status: freq?.status ?? 'presente',
      entrada: freq?.entrada ?? '',
      saida: freq?.saida ?? '',
      hora_extra: freq?.hora_extra?.toString() ?? '',
      observacoes: freq?.observacoes ?? '',
    })
    setEditModal({ funcionario: func, frequencia: freq })
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    try {
      await upsertMutation.mutateAsync({
        funcionario_id: editModal.funcionario.id,
        data: selectedDate,
        status: editForm.status,
        entrada: editForm.entrada || null,
        saida: editForm.saida || null,
        hora_extra: editForm.hora_extra ? parseFloat(editForm.hora_extra) : null,
        observacoes: editForm.observacoes || null,
      })
      toast('Frequência salva com sucesso', 'success')
      setEditModal(null)
    } catch {
      toast('Erro ao salvar frequência', 'error')
    }
  }

  const prevDay = () => {
    const d = parseISO(selectedDate)
    setSelectedDate(format(subDays(d, 1), 'yyyy-MM-dd'))
  }
  const nextDay = () => {
    const d = parseISO(selectedDate)
    setSelectedDate(format(addDays(d, 1), 'yyyy-MM-dd'))
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
          // Verifica se já tem frequencia nesse dia usando os dados do mês atual
          const exists = mesFrequencias.some(e => e.funcionario_id === f.id && e.data === currentDate)
          if (!exists) {
            inserts.push({
              funcionario_id: f.id,
              data: currentDate,
              status: 'presente',
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
      toast(`Semana gerada! ${inserts.length} registros criados.`, 'success')
      setGenerateWeekModal(false)
    } catch (err: any) {
      console.error(err)
      toast(`Erro ao gerar: ${err?.message || 'Desconhecido'}`, 'error')
    }
  }

  const isToday = selectedDate === today()

  const countStatus = (status: FrequenciaStatus) =>
    frequencias.filter((f: any) => f.status === status).length

  return (
    <div className="main-content">
      <TopHeader title="Frequência" />

      {/* Date navigator */}
      <div className="sticky top-14 z-30 bg-[hsl(var(--background))]/95 backdrop-blur-sm border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={prevDay}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--muted))] active:scale-90 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-[hsl(var(--foreground))] capitalize">
              {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            {isToday && (
              <span className="text-[10px] font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 rounded-full">
                HOJE
              </span>
            )}
          </div>
          <button
            onClick={nextDay}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--muted))] active:scale-90 transition-all"
            disabled={isToday}
          >
            <ChevronRight className={cn('w-5 h-5', isToday && 'opacity-30')} />
          </button>
        </div>

        {/* Action Button */}
        <div className="mt-3">
          <Button 
            onClick={() => setGenerateWeekModal(true)} 
            className="w-full gap-2 bg-[hsl(var(--primary))] text-white border shadow-sm hover:brightness-110"
          >
            <Check className="w-4 h-4" />
            Preencher Semana Automática
          </Button>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
          {[
            { status: 'presente' as FrequenciaStatus, label: 'Pres.', color: 'text-green-600' },
            { status: 'falta' as FrequenciaStatus, label: 'Falta', color: 'text-red-600' },
            { status: 'atestado' as FrequenciaStatus, label: 'Ates.', color: 'text-amber-600' },
            { status: 'folga' as FrequenciaStatus, label: 'Folga', color: 'text-blue-600' },
          ].map(({ status, label, color }) => (
            <div key={status} className="flex items-center gap-1 flex-shrink-0">
              <span className={cn('text-sm font-bold', color)}>{countStatus(status)}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-2">
        {isLoading ? (
          <Loading text="Carregando frequência..." />
        ) : funcionarios.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Nenhum funcionário ativo. Cadastre funcionários na aba Equipe.
            </p>
          </div>
        ) : (
          funcionarios.map(func => {
            const freq = getFrequencia(func.id) as Frequencia | undefined
            const hasRecord = !!freq
            const statusClass = freq ? frequenciaStatusColor[freq.status] : ''

            return (
              <div key={func.id} className="card p-3">
                {/* Top row: avatar + name + edit */}
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={func.nome} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{func.nome}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{func.cargo} · {func.setor}</p>
                  </div>
                  {hasRecord && (
                    <span className={cn('badge text-[10px]', statusClass)}>
                      {frequenciaStatusLabel[freq!.status]}
                    </span>
                  )}
                  <button
                    onClick={() => openEdit(func)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] active:scale-90 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Status quick buttons */}
                <div className="grid grid-cols-6 gap-1">
                  {statusButtons.map(({ status, icon: Icon, label, color }) => {
                    const isSelected = freq?.status === status
                    const isPending = upsertMutation.isPending
                    return (
                      <button
                        key={status}
                        onClick={() => handleQuickStatus(func, status)}
                        disabled={isPending}
                        className={cn(
                          'flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[9px] font-semibold transition-all active:scale-90',
                          isSelected
                            ? color
                            : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="leading-none">{label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Times if present */}
                {freq && (freq.entrada || freq.saida) && (
                  <div className="flex gap-3 mt-2 pt-2 border-t border-[hsl(var(--border))]">
                    {freq.entrada && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        Entrada: <strong>{freq.entrada.substring(0, 5)}</strong>
                      </span>
                    )}
                    {freq.saida && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        Saída: <strong>{freq.saida.substring(0, 5)}</strong>
                      </span>
                    )}
                    {freq.hora_extra && (
                      <span className="text-[10px] text-purple-600 font-semibold">
                        +{freq.hora_extra}h extra
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={editModal ? `Editar — ${editModal.funcionario.nome}` : ''}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={upsertMutation.isPending}
              onClick={handleSaveEdit}
            >
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            id="edit-status"
            label="Status"
            value={editForm.status}
            onChange={e => setEditForm(f => ({ ...f, status: e.target.value as FrequenciaStatus }))}
            options={statusButtons.map(s => ({ value: s.status, label: s.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="edit-entrada"
              label="Entrada"
              type="time"
              value={editForm.entrada}
              onChange={e => setEditForm(f => ({ ...f, entrada: e.target.value }))}
            />
            <Input
              id="edit-saida"
              label="Saída"
              type="time"
              value={editForm.saida}
              onChange={e => setEditForm(f => ({ ...f, saida: e.target.value }))}
            />
          </div>
          <Input
            id="edit-hora-extra"
            label="Horas extras"
            type="number"
            min="0"
            step="0.5"
            placeholder="Ex: 2"
            value={editForm.hora_extra}
            onChange={e => setEditForm(f => ({ ...f, hora_extra: e.target.value }))}
          />
          <Textarea
            id="edit-obs"
            label="Observações"
            placeholder="Observações opcionais..."
            value={editForm.observacoes}
            onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Generate Week modal */}
      <Modal
        open={generateWeekModal}
        onClose={() => setGenerateWeekModal(false)}
        title="Gerar Frequência Semanal"
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
              Gerar Frequência
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Isto irá marcar automaticamente como <strong>Presente</strong> todos os funcionários (exceto Encarregados) da segunda-feira selecionada até o sábado. Dias já marcados não serão sobrescritos.
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
