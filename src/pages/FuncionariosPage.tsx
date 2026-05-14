import React, { useState, useEffect } from 'react'
import { Plus, Search, Phone, Briefcase, Filter, Edit2, Trash2, ChevronRight, Calendar, Stethoscope, Plane } from 'lucide-react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import {
  useFuncionarios,
  useCreateFuncionario,
  useUpdateFuncionario,
  useDeleteFuncionario,
} from '../hooks/useFuncionarios'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './ConfiguracoesPage'
import type { Funcionario } from '../lib/database.types'
import { formatPhone } from '../lib/utils'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  telefone: z.string().optional(),
  cargo: z.string().min(1, 'Cargo obrigatório'),
  setor: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
}).superRefine((data, ctx) => {
  // Setor é obrigatório apenas quando o cargo não é Encarregado
  if (data.cargo !== 'Encarregado' && !data.setor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Setor obrigatório',
      path: ['setor'],
    })
  }
})

type FormData = z.infer<typeof schema>

const cargoOptions = [
  { value: 'Encarregado', label: 'Encarregado' },
  { value: 'Agente de limpeza', label: 'Agente de limpeza' },
  { value: 'Motorista', label: 'Motorista' },
]

const setorOptions = [
  { value: 'Varrição', label: 'Varrição' },
  { value: 'Motorista', label: 'Motorista' },
  { value: 'Orla', label: 'Orla' },
  { value: 'Porta a Porta', label: 'Porta a Porta' },
]

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
]

export function FuncionariosPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [filterStatus, setFilterStatus] = useState('ativo')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModal, setDetailModal] = useState<Funcionario | null>(null)
  const [editing, setEditing] = useState<Funcionario | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Funcionario | null>(null)
  const [absenceModal, setAbsenceModal] = useState<Funcionario | null>(null)

  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const { data: funcionarios = [], isLoading } = useFuncionarios({
    search,
    setor: filterSetor || undefined,
    status: filterStatus || undefined,
  })

  const createMutation = useCreateFuncionario()
  const updateMutation = useUpdateFuncionario()
  const deleteMutation = useDeleteFuncionario()
  const batchEscalaMutation = useBatchUpsertEscalas()

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo' },
  })

  // Observa o cargo selecionado no formulário
  const cargoAtual = useWatch({ control, name: 'cargo' })
  const isEncarregado = cargoAtual === 'Encarregado'

  // Limpa o setor automaticamente ao trocar para Encarregado
  useEffect(() => {
    if (isEncarregado) setValue('setor', '')
  }, [isEncarregado, setValue])

  const openCreate = () => {
    setEditing(null)
    reset({ status: 'ativo', nome: '', cargo: '', setor: '', telefone: '' })
    setModalOpen(true)
  }

  const openEdit = (func: Funcionario) => {
    setEditing(func)
    setDetailModal(null)
    reset({
      nome: func.nome,
      telefone: func.telefone ?? '',
      cargo: func.cargo,
      setor: func.setor,
      status: func.status,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ 
          id: editing.id, 
          data: { ...data, matricula: '', setor: data.setor || '' } 
        })
        toast('Funcionário atualizado com sucesso', 'success')
      } else {
        await createMutation.mutateAsync({ 
          ...data, 
          matricula: '', 
          setor: data.setor || '' 
        })
        toast('Funcionário cadastrado com sucesso', 'success')
      }
      setModalOpen(false)
      reset()
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar funcionário', 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteMutation.mutateAsync(confirmDelete.id)
      toast('Funcionário removido', 'success')
      setConfirmDelete(null)
      setDetailModal(null)
    } catch {
      toast('Erro ao remover funcionário', 'error')
    }
  }

  const handleLancarAusencia = async (data: { tipo: string; inicio: string; fim: string }) => {
    if (!absenceModal) return
    try {
      const days = eachDayOfInterval({
        start: parseISO(data.inicio),
        end: parseISO(data.fim)
      })

      const inserts = days.map(day => ({
        funcionario_id: absenceModal.id,
        data: format(day, 'yyyy-MM-dd'),
        tipo: data.tipo,
        turno: 'integral' as const
      }))

      await batchEscalaMutation.mutateAsync(inserts)
      toast(`${inserts.length} dias de ${data.tipo} lançados com sucesso!`, 'success')
      setAbsenceModal(null)
    } catch (err: any) {
      toast('Erro ao lançar ausência: ' + err.message, 'error')
    }
  }

  // setorOptions is defined at module level

  return (
    <div className="main-content">
      <TopHeader title="Equipe" subtitle={`${funcionarios.length} funcionários`} />

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              placeholder="Buscar nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base pl-9 h-11"
            />
          </div>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setShowFilters((v: boolean) => !v)}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card p-3 space-y-2 animate-fade-in">
            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="input-base py-2 text-sm"
                >
                  <option value="">Todos status</option>
                  <option value="ativo">Ativos</option>
                  <option value="inativo">Inativos</option>
                </select>
              </div>
              <div className="flex-1">
                <select
                  value={filterSetor}
                  onChange={e => setFilterSetor(e.target.value)}
                  className="input-base py-2 text-sm"
                >
                  <option value="">Todos setores</option>
                  {setorOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <Loading text="Carregando equipe..." />
        ) : funcionarios.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 bg-[hsl(var(--muted))] rounded-2xl flex items-center justify-center">
              <Search className="w-7 h-7 text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
              Nenhum funcionário encontrado
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {funcionarios.map(func => (
              <div
                key={func.id}
                className="list-item"
                onClick={() => setDetailModal(func)}
              >
                <Avatar name={func.nome} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{func.nome}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{func.cargo} · {func.setor}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={func.status === 'ativo' ? 'success' : 'error'}>
                    {func.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openCreate}
        id="fab-add-funcionario"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-glow flex items-center justify-center active:scale-95 transition-all duration-200"
        aria-label="Adicionar funcionário"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Detail Modal */}
      <Modal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title="Funcionário"
      >
        {detailModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={detailModal.nome} size="lg" />
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))]">{detailModal.nome}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{detailModal.cargo}</p>
                <Badge variant={detailModal.status === 'ativo' ? 'success' : 'error'} className="mt-1">
                  {detailModal.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>

            <div className="divider" />

            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[hsl(var(--muted-foreground))]">Setor:</span>
                  <span className="font-medium">{detailModal.setor}</span>
                </div>
              {detailModal.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[hsl(var(--muted-foreground))]">Telefone:</span>
                  <a
                    href={`tel:${detailModal.telefone}`}
                    className="font-medium text-[hsl(var(--primary))]"
                  >
                    {formatPhone(detailModal.telefone)}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => { setAbsenceModal(detailModal); setDetailModal(null) }}
              >
                <Calendar className="w-4 h-4" />
                Lançar Férias / Atestado
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => openEdit(detailModal)}
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setConfirmDelete(detailModal)}
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Funcionário' : 'Novo Funcionário'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit(onSubmit)}
            >
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            id="func-nome"
            label="Nome completo *"
            placeholder="Ex: JOÃO DA SILVA"
            className="uppercase"
            error={errors.nome?.message}
            {...register('nome', {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase()
              }
            })}
          />
          <div className="grid grid-cols-1 gap-3">
            <Input
              id="func-telefone"
              label="Telefone"
              placeholder="(11) 99999-0000"
              type="tel"
              inputMode="tel"
              {...register('telefone')}
            />
          </div>
          <Select
            id="func-cargo"
            label="Cargo *"
            placeholder="Selecione..."
            options={cargoOptions}
            error={errors.cargo?.message}
            {...register('cargo')}
          />
          {!isEncarregado && (
            <Select
              id="func-setor"
              label="Setor *"
              placeholder="Selecione..."
              options={setorOptions}
              error={errors.setor?.message}
              {...register('setor')}
            />
          )}
          <Select
            id="func-status"
            label="Status"
            options={statusOptions}
            {...register('status')}
          />
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar Remoção"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              Remover
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Tem certeza que deseja remover{' '}
          <strong className="text-[hsl(var(--foreground))]">{confirmDelete?.nome}</strong>?
          Essa ação pode ser desfeita reativando o funcionário.
        </p>
      </Modal>

      {/* Absence Modal */}
      <AbsenceModal
        open={!!absenceModal}
        onClose={() => setAbsenceModal(null)}
        funcionarioNome={absenceModal?.nome || ''}
        tiposEscala={tiposEscala}
        onSave={handleLancarAusencia}
        loading={batchEscalaMutation.isPending}
      />
    </div>
  )
}

function AbsenceModal({ open, onClose, funcionarioNome, tiposEscala, onSave, loading }: { 
  open: boolean, 
  onClose: () => void, 
  funcionarioNome: string,
  tiposEscala: TipoEscala[],
  onSave: (data: { tipo: string; inicio: string; fim: string }) => void,
  loading: boolean
}) {
  const [tipo, setTipo] = useState('ferias')
  const [inicio, setInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fim, setFim] = useState(format(new Date(), 'yyyy-MM-dd'))

  const options = tiposEscala
    .filter(t => ['ferias', 'atestado', 'compensar', 'repouso', 'falta'].includes(t.id))
    .map(t => ({ value: t.id, label: t.nome }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançar Período de Ausência"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={() => onSave({ tipo, inicio, fim })} loading={loading}>Salvar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Funcionário</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{funcionarioNome}</p>
        </div>

        <Select
          label="Tipo de Ausência"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          options={options.length > 0 ? options : [
            { value: 'ferias', label: 'Férias' },
            { value: 'atestado', label: 'Atestado' },
            { value: 'compensar', label: 'Folga/Compensação' }
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label="Início"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
          <Input
            type="date"
            label="Término"
            value={fim}
            onChange={e => setFim(e.target.value)}
          />
        </div>

        <p className="text-[10px] text-slate-400 italic">
          * Isso irá preencher automaticamente a escala do funcionário no período selecionado.
        </p>
      </div>
    </Modal>
  )
}
