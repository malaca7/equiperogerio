import React, { useState, useEffect } from 'react'
import { Plus, Search, Phone, Briefcase, Filter, Edit2, Trash2, ChevronRight, Calendar, Stethoscope, Plane, Users, X, Info, PhoneCall, ShieldCheck } from 'lucide-react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { cn } from '../lib/utils'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, DEFAULT_SETORES, type TipoEscala } from './ConfiguracoesPage'
import type { Funcionario } from '../lib/database.types'
import { formatPhone } from '../lib/utils'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  apelido: z.string().optional(),
  telefone: z.string().optional(),
  cargo: z.string().min(1, 'Cargo obrigatório'),
  setor: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
}).superRefine((data, ctx) => {
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

  const { data: tiposEscalaData } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const { data: setoresData } = useConfiguracao<string[]>('setores', DEFAULT_SETORES)

  const tiposEscala = tiposEscalaData || DEFAULT_TIPOS_ESCALA
  const setores = setoresData || DEFAULT_SETORES

  const dynamicSetorOptions = React.useMemo(() => {
    const list = [...(Array.isArray(setores) ? setores : DEFAULT_SETORES)]
    if (editing?.setor && !list.includes(editing.setor)) {
      list.push(editing.setor)
    }
    return list.map(s => ({ value: String(s), label: String(s) }))
  }, [setores, editing?.setor])

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
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo' },
  })

  const cargoAtual = watch('cargo')
  const isEncarregado = cargoAtual === 'Encarregado'

  useEffect(() => {
    if (modalOpen && isEncarregado) setValue('setor', '')
  }, [isEncarregado, setValue, modalOpen])

  const openCreate = () => {
    setEditing(null)
    reset({ status: 'ativo', nome: '', apelido: '', cargo: '', setor: '', telefone: '' })
    setModalOpen(true)
  }

  const openEdit = (func: Funcionario) => {
    setEditing(func)
    setDetailModal(null)
    reset({
      nome: func.nome,
      apelido: func.apelido ?? '',
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

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Equipe Operacional" />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Native-Style Toolbar */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-4 sm:p-6 shadow-xl mb-10 sticky top-24 z-30 transform-gpu transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 px-2">
              <div className="w-14 h-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center shadow-inner">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground leading-none tracking-tight">Membros Ativos</h2>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1.5">{funcionarios.length} Colaboradores</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:min-w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome ou cargo..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-transparent focus:border-primary/20 rounded-[1.75rem] text-sm font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
              <Button 
                variant={showFilters ? 'primary' : 'ghost'} 
                size="icon" 
                onClick={() => setShowFilters(!showFilters)}
                className="w-12 h-12 rounded-[1.25rem] bg-background/50 border border-border/50 active:scale-90"
              >
                <Filter className="w-5 h-5" />
              </Button>
              <button 
                onClick={openCreate} 
                className="h-14 px-8 bg-primary text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shrink-0"
              >
                <Plus className="w-5 h-5" /> Novo Membro
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
              <Select
                label="Filtrar por Setor"
                value={filterSetor}
                onChange={e => setFilterSetor(e.target.value)}
                options={[{ value: '', label: 'Todos os Setores' }, ...dynamicSetorOptions]}
              />
              <Select
                label="Status"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                options={[{ value: '', label: 'Todos os Status' }, ...statusOptions]}
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-32"><Loading text="Recuperando registros de equipe..." /></div>
        ) : funcionarios.length === 0 ? (
          <div className="py-32 text-center">
            <div className="w-24 h-24 bg-muted/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-muted-foreground opacity-20" />
            </div>
            <p className="text-xl font-black uppercase tracking-widest text-foreground opacity-50">Nenhum resultado</p>
            <p className="text-sm text-muted-foreground mt-2">Tente ajustar sua busca ou filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {funcionarios.map(func => (
              <div
                key={func.id}
                onClick={() => setDetailModal(func)}
                className="group relative bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex items-center gap-6 relative z-10">
                  <div className="relative shrink-0">
                    <Avatar name={func.apelido || func.nome} size="lg" className="ring-4 ring-background shadow-xl" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-background transition-transform duration-500 group-hover:scale-125",
                      func.status === 'ativo' ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-slate-400"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-foreground truncate tracking-tight group-hover:text-primary transition-colors">{func.apelido || func.nome}</h3>
                    <p className="text-xs font-bold text-muted-foreground truncate uppercase">{func.nome}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/60 rounded-xl border border-border/50">
                        <Briefcase className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{func.cargo}</span>
                      </div>
                      {func.setor && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-xl border border-primary/10">
                          <Filter className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-black uppercase text-primary tracking-tighter">{func.setor}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                    <ChevronRight className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal (Profile Sheet Style) */}
      <Modal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title="Ficha do Colaborador"
      >
        {detailModal && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col items-center text-center p-6 bg-muted/30 rounded-[2rem] border border-border/50">
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <Avatar name={detailModal.apelido || detailModal.nome} size="lg" className="w-24 h-24 ring-4 ring-primary/20 shadow-2xl" />
              </div>
              <div className="flex-1 space-y-1 mt-4 sm:mt-0 text-center sm:text-left">
                <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5">
                  {detailModal.setor || 'Geral'}
                </Badge>
                <h3 className="text-2xl font-black text-foreground tracking-tight">{detailModal.apelido || detailModal.nome}</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase">{detailModal.cargo} • {detailModal.nome}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-card/50 p-5 rounded-[1.5rem] border border-border/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1.5">Setor de Atuação</p>
                  <p className="text-base font-black text-foreground">{detailModal.setor || 'NÃO DEFINIDO'}</p>
                </div>
              </div>

              {detailModal.telefone && (
                <a 
                  href={`tel:${detailModal.telefone}`}
                  className="bg-emerald-500/10 p-5 rounded-[1.5rem] border border-emerald-500/20 flex items-center gap-4 hover:bg-emerald-500/20 transition-all group active:scale-95"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1.5">Telefone / WhatsApp</p>
                    <p className="text-base font-black text-emerald-600">{formatPhone(detailModal.telefone)}</p>
                  </div>
                </a>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button
                variant="primary"
                className="w-full h-14 rounded-[1.25rem] bg-blue-600 font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20"
                onClick={() => { setAbsenceModal(detailModal); setDetailModal(null) }}
              >
                <Calendar className="w-5 h-5" /> Lançar Férias ou Atestado
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 h-14 rounded-[1.25rem] font-black text-xs uppercase tracking-widest"
                  onClick={() => openEdit(detailModal)}
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-14 rounded-[1.25rem] font-black text-xs uppercase tracking-widest"
                  onClick={() => setConfirmDelete(detailModal)}
                >
                  <Trash2 className="w-4 h-4" /> Remover
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
        title={editing ? 'Ajustar Perfil' : 'Novo Colaborador'}
      >
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <Input
              id="func-nome"
              label="Nome Completo *"
              placeholder="Ex: JOÃO DA SILVA"
              className="uppercase text-base font-black h-14 rounded-2xl"
              error={errors.nome?.message}
              {...register('nome', {
                onChange: (e) => { e.target.value = e.target.value.toUpperCase() }
              })}
            />
            <Input
              id="func-apelido"
              label="Como é conhecido (Nome Resumido)"
              placeholder="Ex: JOÃO"
              className="uppercase text-base font-black h-14 rounded-2xl"
              error={errors.apelido?.message}
              {...register('apelido', {
                onChange: (e) => { e.target.value = e.target.value.toUpperCase() }
              })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="func-telefone"
                label="Telefone / Contato"
                placeholder="(11) 99999-0000"
                type="tel"
                className="h-14 rounded-2xl"
                {...register('telefone')}
              />
              <Select
                id="func-status"
                label="Status Operacional"
                className="h-14 rounded-2xl"
                options={statusOptions}
                {...register('status')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="func-cargo"
                label="Cargo / Função *"
                placeholder="Selecione..."
                className="h-14 rounded-2xl"
                options={cargoOptions}
                error={errors.cargo?.message}
                {...register('cargo')}
              />
              {!isEncarregado && (
                <Select
                  id="func-setor"
                  label="Setor Designado *"
                  placeholder="Selecione..."
                  className="h-14 rounded-2xl"
                  options={dynamicSetorOptions}
                  error={errors.setor?.message}
                  {...register('setor')}
                />
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase text-xs" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 h-14 rounded-[1.25rem] bg-primary font-black uppercase text-xs shadow-lg shadow-primary/20"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit(onSubmit)}
            >
              {editing ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar Remoção"
      >
        <div className="space-y-6 text-center p-4">
          <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-10 h-10 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-foreground">
            Remover {confirmDelete?.nome}?
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta ação marcará o colaborador como inativo. Você poderá reativá-lo futuramente se necessário.
          </p>
          <div className="flex gap-4 pt-4">
            <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-14 rounded-[1.25rem] font-black uppercase shadow-lg shadow-rose-500/20"
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              Confirmar Remoção
            </Button>
          </div>
        </div>
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

function AbsenceModal({ open, onClose, funcionarioNome, tiposEscala, onSave, loading }: any) {
  const [tipo, setTipo] = useState('ferias')
  const [inicio, setInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fim, setFim] = useState(format(new Date(), 'yyyy-MM-dd'))

  const options = tiposEscala
    .filter((t: TipoEscala) => ['ferias', 'atestado', 'compensar', 'repouso', 'falta'].includes(t.id))
    .map((t: TipoEscala) => ({ value: t.id, label: t.nome }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançar Período de Ausência"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="p-5 bg-muted/40 rounded-[1.5rem] border border-border/50">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Funcionário Selecionado</p>
          <p className="text-lg font-black text-foreground">{funcionarioNome}</p>
        </div>

        <Select
          label="Categoria de Ausência"
          className="h-14 rounded-2xl"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          options={options.length > 0 ? options : [
            { value: 'ferias', label: 'Férias' },
            { value: 'atestado', label: 'Atestado' },
            { value: 'compensar', label: 'Folga/Compensação' }
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Início do Período"
            className="h-14 rounded-2xl"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
          <Input
            type="date"
            label="Término do Período"
            className="h-14 rounded-2xl"
            value={fim}
            onChange={e => setFim(e.target.value)}
          />
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-primary/80 leading-relaxed italic">
            O sistema preencherá automaticamente a escala do colaborador para todos os dias do intervalo selecionado.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 h-14 rounded-[1.25rem] bg-primary font-black uppercase shadow-lg shadow-primary/20" onClick={() => onSave({ tipo, inicio, fim })} loading={loading}>Confirmar Lançamento</Button>
        </div>
      </div>
    </Modal>
  )
}
