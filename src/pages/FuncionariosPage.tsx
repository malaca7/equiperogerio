import React, { useState, useEffect } from 'react'
import { matchEmployeeSearch } from '../lib/searchUtils'
import { Plus, Search, Phone, Briefcase, Filter, Edit2, Trash2, ChevronRight, Calendar, Stethoscope, Plane, Users, X, Info, PhoneCall, ShieldCheck, Camera, Upload, RotateCw } from 'lucide-react'
import { format, eachDayOfInterval, parseISO, addDays } from 'date-fns'
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
import { batchUpsert } from '../lib/batchUtils'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, DEFAULT_SETORES, type TipoEscala } from './admin/AdminDashboard'
import type { Funcionario } from '../lib/database.types'
import { formatPhone } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const isFuncionarioAtivo = (func: any) => {
  if (!func) return false
  if (func.status !== 'ativo') return false
  if (func.data_desligamento) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    if (func.data_desligamento <= todayStr) {
      return false
    }
  }
  return true
}

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  apelido: z.string().optional(),
  cpf: z.string().optional(),
  pis: z.string().optional(),
  telefone: z.string().optional(),
  cargo: z.string().min(1, 'Cargo obrigatório'),
  setor: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
  fotoUrl: z.string().optional(),
  data_desligamento: z.string().optional().nullable(),
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

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 150
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
        resolve(compressedBase64)
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}


const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
]

export function FuncionariosPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('funcionarios', 'editar')
  const canAdmin = hasPermission('funcionarios', 'administrar') || hasPermission('admin', 'gerenciar')

  const { data: teamInfo, isLoading: loadTeam } = useUserTeam()

  const [search, setSearch] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false) // Left for backward compatibility if needed, but unused
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModal, setDetailModal] = useState<Funcionario | null>(null)
  const [editing, setEditing] = useState<Funcionario | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Funcionario | null>(null)
  const [absenceModal, setAbsenceModal] = useState<Funcionario | null>(null)
  const [desligamentoModal, setDesligamentoModal] = useState<Funcionario | null>(null)
  const [nicknameModal, setNicknameModal] = useState<{ id: string; nome: string; apelido: string } | null>(null)
  const [retornoModal, setRetornoModal] = useState<{ funcionario: Funcionario; record: any } | null>(null)

  const { data: afastamentosIndeterminados = [] } = useConfiguracao<any[]>('afastamentos_indeterminados', [])
  const { data: tiposEscalaData } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const tiposEscala = React.useMemo(() => {
    const list = [...(tiposEscalaData || DEFAULT_TIPOS_ESCALA)]
    if (!list.some(t => t.id === 'hora_extra')) {
      list.push({ id: 'hora_extra', letra: 'HE', nome: 'Hora Extra', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' })
    }
    if (!list.some(t => t.id === 'suspensao')) {
      list.push({ id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' })
    }
    return list
  }, [tiposEscalaData])
  const { data: setoresData } = useConfiguracao<string[]>('setores', DEFAULT_SETORES)
  const { data: cargosData } = useConfiguracao<string[]>('cargos_funcionarios', ['Encarregado', 'Gari', 'Motorista', 'Coletor'])
  const { data: fotos = {} } = useConfiguracao<Record<string, string>>('fotos_funcionarios', {})
  const updateConfig = useUpdateConfiguracao()

  const setores = setoresData || DEFAULT_SETORES
  const cargos = cargosData || ['Encarregado', 'Gari', 'Motorista', 'Coletor']

  const dynamicSetorOptions = React.useMemo(() => {
    const list = [...(Array.isArray(setores) ? setores : DEFAULT_SETORES)]
    if (editing?.setor && !list.includes(editing.setor)) {
      list.push(editing.setor)
    }
    return list.map(s => ({ value: String(s), label: String(s) }))
  }, [setores, editing?.setor])

  const dynamicCargoOptions = React.useMemo(() => {
    const list = [...(Array.isArray(cargos) ? cargos : ['Encarregado', 'Gari', 'Motorista', 'Coletor'])]
    if (editing?.cargo && !list.includes(editing.cargo)) {
      list.push(editing.cargo)
    }
    return list.map(c => ({ value: String(c), label: String(c) }))
  }, [cargos, editing?.cargo])

  const { data: funcionarios = [], isLoading: isLoadingFuncs } = useFuncionarios({
    search,
    setor: filterSetor || undefined,
    status: filterStatus || undefined,
  })

  const isMemberOfMyTeam = React.useCallback((funcId: string) => {
    if (!teamInfo?.isRestricted) return true
    return teamInfo.teamMemberIds?.includes(funcId) || false
  }, [teamInfo])

  const filteredFuncionarios = React.useMemo(() => {
    if (!search || !search.trim()) return funcionarios
    return funcionarios.filter(f => matchEmployeeSearch(f, search))
  }, [funcionarios, search])

  const stats = React.useMemo(() => {
    const total = filteredFuncionarios.length
    const ativos = filteredFuncionarios.filter(f => isFuncionarioAtivo(f)).length
    const inativos = filteredFuncionarios.filter(f => !isFuncionarioAtivo(f)).length
    return { total, ativos, inativos }
  }, [filteredFuncionarios])

  const isLoading = isLoadingFuncs || loadTeam

  const createMutation = useCreateFuncionario()
  const updateMutation = useUpdateFuncionario()
  const deleteMutation = useDeleteFuncionario()
  const batchEscalaMutation = useBatchUpsertEscalas()

  const handleSaveNickname = async () => {
    if (!nicknameModal) return
    if (!isMemberOfMyTeam(nicknameModal.id)) {
      toast('Você não tem permissão para editar colaboradores fora de sua equipe.', 'error')
      return
    }
    try {
      await updateMutation.mutateAsync({
        id: nicknameModal.id,
        data: { apelido: nicknameModal.apelido.toUpperCase() }
      })
      toast('Nome de conhecimento atualizado com sucesso!', 'success')
      setNicknameModal(null)
    } catch (err: any) {
      toast('Erro ao atualizar nome: ' + err.message, 'error')
    }
  }

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
  const watchFotoUrl = watch('fotoUrl')

  useEffect(() => {
    if (modalOpen && isEncarregado) setValue('setor', '')
  }, [isEncarregado, setValue, modalOpen])

  const openCreate = () => {
    setEditing(null)
    reset({ status: 'ativo', nome: '', apelido: '', cpf: '', pis: '', cargo: '', setor: '', telefone: '', fotoUrl: '', data_desligamento: null })
    setModalOpen(true)
  }

  const openEdit = (func: Funcionario) => {
    setEditing(func)
    setDetailModal(null)
    reset({
      nome: func.nome,
      apelido: func.apelido ?? '',
      cpf: func.cpf ?? '',
      pis: func.pis ?? '',
      telefone: func.telefone ?? '',
      cargo: func.cargo,
      setor: func.setor,
      status: func.status,
      fotoUrl: fotos[func.id] ?? '',
      data_desligamento: func.data_desligamento,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (editing && !isMemberOfMyTeam(editing.id)) {
      toast('Você não tem permissão para editar colaboradores fora de sua equipe.', 'error')
      return
    }
    try {
      const { fotoUrl, ...rest } = data
      let savedId = editing?.id

      // Calculate status based on data_desligamento
      let finalStatus = rest.status
      if (rest.data_desligamento) {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        if (rest.data_desligamento <= todayStr) {
          finalStatus = 'inativo'
        } else {
          finalStatus = 'ativo'
        }
      }

      if (editing) {
        await updateMutation.mutateAsync({ 
          id: editing.id, 
          data: { 
            ...rest, 
            status: finalStatus, 
            matricula: '', 
            setor: rest.setor || '', 
            data_desligamento: rest.data_desligamento || null 
          } 
        })
        toast('Funcionário atualizado com sucesso', 'success')
      } else {
        const saved = await createMutation.mutateAsync({ 
          ...rest, 
          status: finalStatus, 
          matricula: '', 
          setor: rest.setor || '',
          data_desligamento: rest.data_desligamento || null
        })
        savedId = saved.id
        
        if (savedId && teamInfo?.isRestricted && teamInfo.teamId) {
          const { error: assocError } = await supabase
            .from('equipe_membros')
            .insert({
              equipe_id: teamInfo.teamId,
              funcionario_id: savedId
            })
          if (assocError) {
            console.error('Error linking employee to team:', assocError)
          } else {
            qc.invalidateQueries({ queryKey: ['user-team'] })
          }
        }
        
        toast('Funcionário cadastrado com sucesso', 'success')
      }

      if (savedId) {
        await updateConfig.mutateAsync({
          chave: 'fotos_funcionarios',
          valor: { ...fotos, [savedId]: fotoUrl || '' }
        })
      }

      setModalOpen(false)
      reset()
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar funcionário', 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    if (!isMemberOfMyTeam(confirmDelete.id)) {
      toast('Você não tem permissão para remover colaboradores fora de sua equipe.', 'error')
      return
    }
    try {
      await deleteMutation.mutateAsync(confirmDelete.id)
      toast('Funcionário removido', 'success')
      setConfirmDelete(null)
      setDetailModal(null)
    } catch {
      toast('Erro ao remover funcionário', 'error')
    }
  }

  const handleLancarAusencia = async (data: { tipo: string; inicio: string; dias: number; indeterminado?: boolean }) => {
    if (!absenceModal) return
    if (!isMemberOfMyTeam(absenceModal.id)) {
      toast('Você não tem permissão para lançar ausência para colaboradores fora de sua equipe.', 'error')
      return
    }
    try {
      if (data.indeterminado) {
        // Afastamento por tempo indeterminado: gerar escalas por 90 dias a partir do início
        const start = parseISO(data.inicio)
        const end = addDays(start, 89)
        const days = eachDayOfInterval({ start, end })

        const inserts = days.map(day => ({
          funcionario_id: absenceModal.id,
          data: format(day, 'yyyy-MM-dd'),
          tipo: data.tipo,
          turno: 'integral' as const,
          observacoes: 'Afastamento por tempo indeterminado'
        }))

        await batchEscalaMutation.mutateAsync(inserts)

        // Registrar registro em afastamentos_indeterminados
        const newRecord = {
          id: `af_${Date.now()}`,
          funcionario_id: absenceModal.id,
          data_inicio: data.inicio,
          tipo: data.tipo,
          indeterminado: true,
          status: 'ativo',
          created_at: new Date().toISOString()
        }
        const currentRecords = Array.isArray(afastamentosIndeterminados) ? afastamentosIndeterminados : []
        await updateConfig.mutateAsync({
          chave: 'afastamentos_indeterminados',
          valor: [newRecord, ...currentRecords]
        })

        const freqStatus = data.tipo === 'ferias' ? 'ferias' : 'atestado'
        const freqUpserts = days.map(day => ({
          funcionario_id: absenceModal.id,
          data: format(day, 'yyyy-MM-dd'),
          status: freqStatus,
          updated_at: new Date().toISOString()
        }))
        await batchUpsert('frequencia', freqUpserts, { onConflict: 'funcionario_id,data', chunkSize: 35 })

        qc.invalidateQueries({ queryKey: ['escalas'] })
        qc.invalidateQueries({ queryKey: ['frequencia'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['configuracoes', 'afastamentos_indeterminados'] })

        toast(`Afastamento por tempo indeterminado registrado com sucesso!`, 'success')
        setAbsenceModal(null)
      } else {
        const start = parseISO(data.inicio)
        const end = addDays(start, data.dias - 1)
        const days = eachDayOfInterval({ start, end })

        const inserts = days.map(day => ({
          funcionario_id: absenceModal.id,
          data: format(day, 'yyyy-MM-dd'),
          tipo: data.tipo,
          turno: 'integral' as const
        }))

        await batchEscalaMutation.mutateAsync(inserts)

        // Sincronizar com a frequência
        const freqMap: Record<string, string> = {
          'presente': 'presente',
          'hora_extra': 'hora_extra',
          'falta': 'falta',
          'repouso': 'folga',
          'compensar': 'folga',
          'ferias': 'ferias',
          'atestado': 'atestado'
        }
        const freqStatus = freqMap[data.tipo] || 'atestado'
        const freqUpserts = days.map(day => ({
          funcionario_id: absenceModal.id,
          data: format(day, 'yyyy-MM-dd'),
          status: freqStatus,
          updated_at: new Date().toISOString()
        }))
        await batchUpsert('frequencia', freqUpserts, { onConflict: 'funcionario_id,data', chunkSize: 35 })

        qc.invalidateQueries({ queryKey: ['escalas'] })
        qc.invalidateQueries({ queryKey: ['frequencia'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })

        toast(`${inserts.length} dias de ${data.tipo} lançados com sucesso!`, 'success')
        setAbsenceModal(null)
      }
    } catch (err: any) {
      toast('Erro ao lançar ausência: ' + err.message, 'error')
    }
  }

  const handleEncerrarAfastamento = async (dataRetornoStr: string) => {
    if (!retornoModal) return
    const { funcionario, record } = retornoModal
    try {
      const retornoDate = parseISO(dataRetornoStr)
      const dataRetornoFormatted = format(retornoDate, 'yyyy-MM-dd')

      const currentRecords = Array.isArray(afastamentosIndeterminados) ? afastamentosIndeterminados : []
      const updatedList = currentRecords.map(a => {
        if (a.id === record.id) {
          return { ...a, status: 'encerrado', data_retorno: dataRetornoFormatted }
        }
        return a
      })
      await updateConfig.mutateAsync({ chave: 'afastamentos_indeterminados', valor: updatedList })

      // Excluir registros de escalas de afastamento criados a partir da data de retorno
      const { data: escalasAfastado } = await supabase
        .from('escalas')
        .select('id, data')
        .eq('funcionario_id', funcionario.id)
        .gte('data', dataRetornoFormatted)
        .eq('tipo', record.tipo || 'atestado')

      if (escalasAfastado && escalasAfastado.length > 0) {
        const idsToDelete = escalasAfastado.map(e => e.id)
        await supabase.from('escalas').delete().in('id', idsToDelete)
      }

      // Remover registros da tabela de frequência a partir da data de retorno
      await supabase
        .from('frequencia')
        .delete()
        .eq('funcionario_id', funcionario.id)
        .gte('data', dataRetornoFormatted)
        .eq('status', record.tipo === 'ferias' ? 'ferias' : 'atestado')

      qc.invalidateQueries({ queryKey: ['escalas'] })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['configuracoes', 'afastamentos_indeterminados'] })

      toast(`Afastamento encerrado com sucesso! Retorno registrado em ${format(retornoDate, 'dd/MM/yyyy')}.`, 'success')
      setRetornoModal(null)
    } catch (err: any) {
      toast('Erro ao encerrar afastamento: ' + err.message, 'error')
    }
  }

  const handleLancarDesligamento = async (date: string) => {
    if (!desligamentoModal) return
    if (!isMemberOfMyTeam(desligamentoModal.id)) {
      toast('Você não tem permissão para programar desligamento de colaboradores fora de sua equipe.', 'error')
      return
    }
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const status = date <= todayStr ? 'inativo' : 'ativo'
      await updateMutation.mutateAsync({
        id: desligamentoModal.id,
        data: { data_desligamento: date, status }
      })
      toast('Desligamento programado com sucesso para ' + format(parseISO(date), 'dd/MM/yyyy'), 'success')
      setDesligamentoModal(null)
    } catch (err: any) {
      toast('Erro ao programar desligamento: ' + err.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Equipe Operacional" />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-32">
        {/* Compact Filters & Toolbar */}
        <div className="bg-gradient-to-r from-card/85 via-card/70 to-card/50 backdrop-blur-xl border border-border/40 rounded-3xl p-4 sm:p-5 shadow-xl mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative z-10">
            {/* Title / Counter (Left side) */}
            <div className="flex items-center gap-3 px-1.5 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-black text-foreground uppercase tracking-tight leading-none">Equipe</h2>
                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider mt-1">{filteredFuncionarios.length} Cadastrados</p>
              </div>
            </div>

            {/* Controls (Right side) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto xl:flex-1 xl:justify-end">
              {/* Search input */}
              <div className="relative w-full sm:max-w-xs xl:max-w-md xl:flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar colaborador..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-muted/20 border border-border/30 focus:border-primary/45 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-primary/10 text-foreground placeholder:text-muted-foreground/45 transition-all uppercase focus:bg-background outline-none"
                />
              </div>

              {/* Setor Select Filter */}
              <div className="w-full sm:w-44 shrink-0 relative">
                <select
                  value={filterSetor}
                  onChange={e => setFilterSetor(e.target.value)}
                  className="w-full text-[10px] font-black uppercase bg-muted/30 border border-border/30 hover:border-primary/30 rounded-2xl px-3 py-2.5 outline-none text-foreground tracking-wider cursor-pointer transition-all appearance-none text-center sm:text-left pr-8"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.85rem' }}
                >
                  <option value="">Todos os Setores</option>
                  {dynamicSetorOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Status Select Filter */}
              <div className="w-full sm:w-44 shrink-0 relative">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full text-[10px] font-black uppercase bg-muted/30 border border-border/30 hover:border-primary/30 rounded-2xl px-3 py-2.5 outline-none text-foreground tracking-wider cursor-pointer transition-all appearance-none text-center sm:text-left pr-8"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.85rem' }}
                >
                  <option value="">Todos os Status</option>
                  {statusOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {canEdit && (
                <button 
                  onClick={openCreate} 
                  className="h-10.5 px-5 bg-primary text-white rounded-2xl font-black text-[9px] uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 border border-primary/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Novo Membro
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard de Status de Funcionários */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-10 animate-fade-in">
            {/* Card Total */}
            <div className="bg-gradient-to-br from-card/85 via-card/70 to-card/50 backdrop-blur-xl border border-border/30 rounded-[2.25rem] p-6 shadow-md relative overflow-hidden group hover:border-primary/45 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider">Total Geral</p>
                  <h4 className="text-3xl font-black text-foreground mt-2 tracking-tight">{stats.total}</h4>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground mt-3 uppercase tracking-wide">Colaboradores Cadastrados</p>
            </div>

            {/* Card Ativos */}
            <div className="bg-gradient-to-br from-card/85 via-card/70 to-card/50 backdrop-blur-xl border border-border/30 rounded-[2.25rem] p-6 shadow-md relative overflow-hidden group hover:border-emerald-500/35 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 tracking-wider">Ativos</p>
                  <h4 className="text-3xl font-black text-foreground mt-2 tracking-tight">{stats.ativos}</h4>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-inner relative">
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-500/60 flex items-center justify-center text-[10px] font-black text-emerald-500">✓</div>
                </div>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground mt-3 uppercase tracking-wide">Em atividade operacional</p>
            </div>

            {/* Card Inativos */}
            <div className="bg-gradient-to-br from-card/85 via-card/70 to-card/50 backdrop-blur-xl border border-border/30 rounded-[2.25rem] p-6 shadow-md relative overflow-hidden group hover:border-slate-500/35 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-slate-500/10 transition-colors pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider">Inativos</p>
                  <h4 className="text-3xl font-black text-foreground mt-2 tracking-tight">{stats.inativos}</h4>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border/20 flex items-center justify-center shadow-inner">
                  <X className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground mt-3 uppercase tracking-wide">Desligados ou suspensos</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-32"><Loading text="Recuperando registros de equipe..." /></div>
        ) : filteredFuncionarios.length === 0 ? (
          <div className="py-32 text-center bg-card/25 border border-border/20 rounded-[2.5rem] p-8 max-w-lg mx-auto backdrop-blur-sm">
            <div className="w-20 h-20 bg-muted/40 rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Search className="w-8 h-8 text-muted-foreground opacity-30" />
            </div>
            <p className="text-base font-black uppercase tracking-widest text-foreground">Nenhum Colaborador</p>
            <p className="text-xs text-muted-foreground mt-2 font-bold max-w-xs mx-auto leading-relaxed">Tente ajustar seus parâmetros de busca ou limpar os filtros ativos na barra superior.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredFuncionarios.map(func => (
              <div
                key={func.id}
                onClick={() => setDetailModal(func)}
                className={cn(
                  "group relative bg-gradient-to-br from-card/95 via-card/75 to-card/50 backdrop-blur-xl border border-border/30 rounded-3xl p-4.5 shadow-md transition-all duration-500 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[145px]",
                  isFuncionarioAtivo(func) 
                    ? "hover:border-primary/45 hover:shadow-[0_15px_30px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_15px_30px_rgba(244,63,94,0.04)] hover:scale-[1.01]" 
                    : "opacity-45 hover:opacity-80 border-dashed border-border/50 hover:scale-[1.005]"
                )}
              >
                {/* Glowing Background Radial */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
                
                <div className="flex items-start gap-4 relative z-10 flex-1">
                  <div className="relative shrink-0 mt-0.5">
                    {/* Double Ring Avatar Border */}
                    <div className="w-12 h-12 rounded-full ring-2 ring-primary/25 dark:ring-primary/40 group-hover:ring-primary/70 p-0.5 transition-all duration-500 bg-background/40">
                      <Avatar name={func.apelido || func.nome} src={fotos[func.id]} size="md" className="w-full h-full rounded-full shadow-lg group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card transition-all duration-500 group-hover:scale-110",
                      isFuncionarioAtivo(func) ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-400 dark:bg-slate-600"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 
                      className="text-sm sm:text-base font-black text-foreground break-words line-clamp-2 tracking-tight group-hover:text-primary transition-colors uppercase leading-tight mb-1"
                      title={func.nome}
                    >
                      {func.nome}
                    </h3>
                    <p 
                      className="text-[8.5px] font-black text-muted-foreground/60 truncate uppercase tracking-widest leading-none mb-3"
                      title={func.apelido || ''}
                    >
                      {func.apelido ? `Apelido: ${func.apelido}` : "Sem Apelido Registrado"}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-muted/50 to-muted/20 text-muted-foreground border border-border/30 rounded-xl shadow-sm shrink-0">
                        <Briefcase className="w-3 h-3 text-primary/70 group-hover:rotate-12 transition-transform duration-300" />
                        <span className="text-[7.5px] font-black uppercase tracking-wider">{func.cargo}</span>
                      </div>
                      {func.setor && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 rounded-xl shadow-sm shrink-0">
                          <Filter className="w-3 h-3 text-primary/70" />
                          <span className="text-[7.5px] font-black uppercase tracking-wider">{func.setor}</span>
                        </div>
                      )}
                      {teamInfo?.isRestricted && (
                        isMemberOfMyTeam(func.id) ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl shadow-sm shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="text-[7.5px] font-black uppercase tracking-wider">Minha Equipe</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/5 text-amber-600/70 border border-amber-500/10 rounded-xl shadow-sm shrink-0">
                            <span className="text-[7.5px] font-black uppercase tracking-wider">Apenas Leitura</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Animated Mechanical Action Button */}
                <div className="absolute right-4 bottom-4 w-9 h-9 rounded-xl bg-muted/40 group-hover:bg-primary/25 border border-border/20 group-hover:border-primary/30 flex items-center justify-center transition-all duration-500 shadow-sm shrink-0">
                  <ChevronRight className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
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
        title="Ficha Funcional"
      >
        {detailModal && (
          <div className="space-y-6 animate-fade-in relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-gradient-to-br from-card to-card/60 rounded-[2.25rem] border border-border/40 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              <div className="shrink-0 relative">
                <Avatar name={detailModal.apelido || detailModal.nome} src={fotos[detailModal.id]} size="lg" className="w-20 h-20 ring-4 ring-primary/15 shadow-xl border border-border/30" />
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full border-[2.5px] border-card",
                  isFuncionarioAtivo(detailModal) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-400"
                )} />
              </div>
              <div className="flex-1 space-y-2.5 min-w-0 text-center sm:text-left">
                <div className="inline-flex items-center px-3 py-1 rounded-xl text-[8.5px] font-black uppercase tracking-widest bg-primary/15 text-primary border border-primary/20 shadow-sm">
                  {detailModal.setor || 'Sem Setor'}
                </div>
                <h3 className="text-xl font-black text-foreground tracking-tight uppercase truncate">{detailModal.apelido || detailModal.nome}</h3>
                <p className="text-[10px] font-bold text-muted-foreground/75 uppercase leading-none tracking-wide">{detailModal.cargo} &bull; {detailModal.nome}</p>
              </div>
            </div>

            <div className="bg-card p-5 sm:p-6 rounded-[2rem] border border-border/50 shadow-sm space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                <div className="w-1.5 h-5 bg-primary rounded-full animate-pulse" />
                <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Informações Cadastrais</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Cargo / Função</span>
                  <span className="text-xs font-bold text-foreground mt-1.5 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase tracking-wide">
                    {detailModal.cargo}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Setor Designado</span>
                  <span className="text-xs font-bold text-foreground mt-1.5 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase tracking-wide">
                    {detailModal.setor || 'Encarregado Geral'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">CPF do Colaborador</span>
                  <span className="text-xs font-bold text-foreground mt-1.5 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase tracking-wide">
                    {detailModal.cpf || 'Não Cadastrado'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Código PIS</span>
                  <span className="text-xs font-bold text-foreground mt-1.5 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase tracking-wide">
                    {detailModal.pis || 'Não Cadastrado'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Nome Completo</span>
                  <span className="text-xs font-bold text-foreground mt-1.5 block bg-muted/40 px-3.5 py-2.5 rounded-xl border border-border/20 uppercase tracking-wide">
                    {detailModal.nome}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Status do Contrato</span>
                  <div className="flex flex-wrap gap-2 items-center mt-2.5">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider block px-3 py-2 rounded-xl border w-fit leading-none",
                      isFuncionarioAtivo(detailModal) ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-rose-500/10 border-rose-500/20 text-rose-600"
                    )}>
                      {isFuncionarioAtivo(detailModal) ? 'Colaborador Ativo' : 'Inativo / Desligado'}
                    </span>
                    {detailModal.data_desligamento && (
                      <span className="text-[9px] font-black uppercase tracking-wider block px-3 py-2 rounded-xl border w-fit leading-none bg-amber-500/10 border-amber-500/20 text-amber-700">
                        Desligamento: {format(parseISO(detailModal.data_desligamento), 'dd/MM/yyyy')}
                      </span>
                    )}
                    {Array.isArray(afastamentosIndeterminados) && afastamentosIndeterminados.some((a: any) => a.funcionario_id === detailModal.id && a.status === 'ativo') && (
                      <span className="text-[9px] font-black uppercase tracking-wider block px-3 py-2 rounded-xl border w-fit leading-none bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400">
                        ⚠️ Em Afastamento Indeterminado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {detailModal.telefone && (
                <div className="pt-3 border-t border-border/30">
                  <a 
                    href={`tel:${detailModal.telefone}`}
                    className="bg-emerald-500/[0.04] dark:bg-emerald-500/[0.015] p-4.5 rounded-[1.25rem] border border-emerald-500/25 flex items-center gap-4.5 hover:bg-emerald-500/10 transition-all group active:scale-[0.98] shadow-sm"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:rotate-12 transition-transform">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider leading-none mb-1.5">Telefone de Contato</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 leading-none">{formatPhone(detailModal.telefone)}</p>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-3">
              {!isMemberOfMyTeam(detailModal.id) && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-2xl text-[10px] font-black uppercase text-center tracking-wider mb-2">
                  ⚠️ Apenas Leitura: Colaborador não pertence à sua equipe
                </div>
              )}
              {canEdit && isMemberOfMyTeam(detailModal.id) && (
                <div className="flex flex-col gap-2 w-full">
                  {Array.isArray(afastamentosIndeterminados) && afastamentosIndeterminados.some((a: any) => a.funcionario_id === detailModal.id && a.status === 'ativo') && (
                    <Button
                      variant="secondary"
                      className="w-full h-13 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-400 border border-amber-500/30 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                      onClick={() => {
                        const activeRec = afastamentosIndeterminados.find((a: any) => a.funcionario_id === detailModal.id && a.status === 'ativo')
                        setRetornoModal({ funcionario: detailModal, record: activeRec })
                        setDetailModal(null)
                      }}
                    >
                      <RotateCw className="w-4.5 h-4.5 mr-2 text-amber-600" /> Retirar Afastamento (Informar Data de Retorno)
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    className="w-full h-13 rounded-2xl bg-blue-600 border border-blue-500/10 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer"
                    onClick={() => { setAbsenceModal(detailModal); setDetailModal(null) }}
                  >
                    <Calendar className="w-4.5 h-4.5 mr-2" /> Lançar Período de Ausência / Afastamento
                  </Button>
                  {detailModal.data_desligamento ? (
                    <Button
                      variant="secondary"
                      className="w-full h-13 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-500 border border-amber-500/20 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                      onClick={async () => {
                        try {
                          await updateMutation.mutateAsync({
                            id: detailModal.id,
                            data: { data_desligamento: null, status: 'ativo' }
                          })
                          toast('Lançamento de desligamento removido com sucesso!', 'success')
                          setDetailModal(null)
                        } catch (err: any) {
                          toast('Erro ao remover desligamento: ' + err.message, 'error')
                        }
                      }}
                    >
                      <X className="w-4.5 h-4.5 mr-2" /> Retirar Lançamento de Inativação
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full h-13 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-500 border border-rose-500/20 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                      onClick={() => { setDesligamentoModal(detailModal); setDetailModal(null) }}
                    >
                      <X className="w-4.5 h-4.5 mr-2" /> Lançar Desligamento (Inativar)
                    </Button>
                  )}
                </div>
              )}
              {!canEdit && teamInfo?.isRestricted && isMemberOfMyTeam(detailModal.id) && (
                <Button
                  variant="secondary"
                  className="w-full h-13 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-border/80 cursor-pointer"
                  onClick={() => {
                    setNicknameModal({ id: detailModal.id, nome: detailModal.nome, apelido: detailModal.apelido || '' })
                    setDetailModal(null)
                  }}
                >
                  <Edit2 className="w-4 h-4 text-primary mr-2" /> Editar Nome Conhecido
                </Button>
              )}
              <div className="flex gap-2.5">
                {canEdit && isMemberOfMyTeam(detailModal.id) && (
                  <Button
                    variant="secondary"
                    className="flex-1 h-13 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-border/60 cursor-pointer"
                    onClick={() => openEdit(detailModal)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5 text-primary" /> Editar Perfil
                  </Button>
                )}
                {canAdmin && isMemberOfMyTeam(detailModal.id) && (
                  <Button
                    variant="destructive"
                    className="flex-1 h-13 rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-pointer"
                    onClick={() => setConfirmDelete(detailModal)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remover
                  </Button>
                )}
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
            {/* Elegant Avatar Selector Container */}
            <div className="flex flex-col items-center gap-4 py-4 bg-muted/20 rounded-[2rem] border border-border/30 p-5 relative overflow-hidden">
              <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider">Foto de Perfil do Colaborador</span>
              
              <div className="relative group/avatar cursor-pointer" onClick={() => document.getElementById('avatar-file-input')?.click()}>
                <div className="w-24 h-24 rounded-full ring-4 ring-primary/20 group-hover/avatar:ring-primary/45 p-1 transition-all duration-300 bg-background/50 overflow-hidden flex items-center justify-center">
                  {watchFotoUrl ? (
                    <img src={watchFotoUrl} alt="Preview Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-muted flex flex-col items-center justify-center text-muted-foreground/40 group-hover/avatar:text-primary/60 transition-colors">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[8px] font-bold uppercase tracking-wider">Inserir</span>
                    </div>
                  )}
                </div>
                
                {/* Micro Edit Badge Overlay */}
                <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-lg border border-background scale-95 group-hover/avatar:scale-105 transition-all">
                  <Upload className="w-4 h-4" />
                </div>
              </div>

              {/* Hidden file input */}
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    try {
                      const base64 = await compressImage(file)
                      setValue('fotoUrl', base64)
                    } catch (err) {
                      toast('Falha ao processar a imagem do perfil.', 'error')
                    }
                  }
                }}
              />

              <div className="text-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider border border-border/60 hover:bg-muted"
                  onClick={() => document.getElementById('avatar-file-input')?.click()}
                >
                  Selecionar Foto
                </Button>
                {watchFotoUrl && (
                  <button
                    type="button"
                    className="block text-[8.5px] font-bold text-rose-500 uppercase tracking-wider mt-2.5 mx-auto hover:underline"
                    onClick={() => setValue('fotoUrl', '')}
                  >
                    Remover Foto
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="func-cpf"
                label="CPF"
                placeholder="000.000.000-00"
                className="h-14 rounded-2xl"
                {...register('cpf')}
              />
              <Input
                id="func-pis"
                label="PIS"
                placeholder="000.00000.00-0"
                className="h-14 rounded-2xl"
                {...register('pis')}
              />
            </div>
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
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="func-data-desligamento"
                label="Data Programada de Desligamento (Opcional)"
                type="date"
                className="h-14 rounded-2xl"
                error={errors.data_desligamento?.message}
                {...register('data_desligamento')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="func-cargo"
                label="Cargo / Função *"
                placeholder="Selecione..."
                className="h-14 rounded-2xl"
                options={dynamicCargoOptions}
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

      {/* Retorno Afastamento Modal */}
      <RetornoAfastamentoModal
        open={!!retornoModal}
        onClose={() => setRetornoModal(null)}
        funcionarioNome={retornoModal?.funcionario?.nome || ''}
        onSave={handleEncerrarAfastamento}
        loading={updateConfig.isPending}
      />

      {/* Desligamento Modal */}
      <DesligamentoModal
        open={!!desligamentoModal}
        onClose={() => setDesligamentoModal(null)}
        funcionarioNome={desligamentoModal?.nome || ''}
        onSave={handleLancarDesligamento}
        loading={updateMutation.isPending}
      />

      {/* Edit Nickname Modal */}
      <Modal
        open={!!nicknameModal}
        onClose={() => setNicknameModal(null)}
        title="Editar Nome de Conhecimento"
      >
        {nicknameModal && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-5 bg-muted/40 rounded-[1.5rem] border border-border/50">
              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1.5 leading-none">Nome Completo</p>
              <p className="text-base font-black text-foreground uppercase leading-none">{nicknameModal.nome}</p>
            </div>

            <Input
              id="nickname-input"
              label="Nome como é conhecido (Apelido)"
              placeholder="Ex: SILVA"
              className="uppercase text-base font-black h-14 rounded-2xl"
              value={nicknameModal.apelido}
              onChange={e => setNicknameModal({ ...nicknameModal, apelido: e.target.value.toUpperCase() })}
            />

            <div className="flex gap-4 pt-4">
              <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase text-xs" onClick={() => setNicknameModal(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-14 rounded-[1.25rem] bg-primary font-black uppercase text-xs shadow-lg shadow-primary/20"
                onClick={handleSaveNickname}
                loading={updateMutation.isPending}
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AbsenceModal({ open, onClose, funcionarioNome, tiposEscala, onSave, loading }: any) {
  const [tipo, setTipo] = useState('atestado')
  const [inicio, setInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dias, setDias] = useState(30)
  const [indeterminado, setIndeterminado] = useState(false)

  useEffect(() => {
    if (open) {
      setTipo('atestado')
      setInicio(format(new Date(), 'yyyy-MM-dd'))
      setDias(30)
      setIndeterminado(false)
    }
  }, [open])

  const options = React.useMemo(() => {
    const customList = (tiposEscala || []).filter((t: TipoEscala) => ['atestado', 'afastamento', 'ferias', 'compensar', 'repouso', 'falta'].includes(t.id))
    
    // Garantir rótulos limpos e explícitos
    const mapped = customList.map((t: TipoEscala) => {
      if (t.id === 'atestado') return { value: 'atestado', label: 'Atestado Médico (AT)' }
      if (t.id === 'afastamento') return { value: 'afastamento', label: 'Afastamento / Licença (AF)' }
      if (t.id === 'ferias') return { value: 'ferias', label: 'Férias' }
      if (t.id === 'compensar') return { value: 'compensar', label: 'Folga / Compensação' }
      if (t.id === 'repouso') return { value: 'repouso', label: 'Repouso / Descanso' }
      if (t.id === 'falta') return { value: 'falta', label: 'Falta' }
      return { value: t.id, label: t.nome }
    })

    if (!mapped.some((o: any) => o.value === 'atestado')) {
      mapped.unshift({ value: 'atestado', label: 'Atestado Médico (AT)' })
    }
    if (!mapped.some((o: any) => o.value === 'afastamento')) {
      mapped.unshift({ value: 'afastamento', label: 'Afastamento / Licença (AF)' })
    }
    if (!mapped.some((o: any) => o.value === 'ferias')) {
      mapped.push({ value: 'ferias', label: 'Férias' })
    }

    return mapped
  }, [tiposEscala])

  const isAfastamento = tipo === 'atestado' || tipo === 'afastamento' || tipo === 'ferias'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lançar Período de Ausência / Afastamento"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="p-5 bg-muted/40 rounded-[1.5rem] border border-border/50">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Funcionário Selecionado</p>
          <p className="text-lg font-black text-foreground">{funcionarioNome}</p>
        </div>

        <Select
          label="Categoria de Ausência / Afastamento"
          className="h-14 rounded-2xl font-bold uppercase text-xs"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          options={options}
        />

        {isAfastamento && (
          <div className="flex items-center gap-3 p-4 bg-muted/20 border border-border/30 rounded-2xl cursor-pointer" onClick={() => setIndeterminado(!indeterminado)}>
            <input
              type="checkbox"
              id="indeterminado-check"
              checked={indeterminado}
              onChange={e => setIndeterminado(e.target.checked)}
              className="w-5 h-5 accent-primary rounded-lg cursor-pointer"
            />
            <label htmlFor="indeterminado-check" className="text-xs font-black uppercase tracking-wider text-foreground cursor-pointer select-none">
              Afastamento por Tempo Indeterminado
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Início do Período"
            className="h-14 rounded-2xl"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
          {!indeterminado && (
            <Input
              type="number"
              min="1"
              label="Quantidade de Dias"
              className="h-14 rounded-2xl"
              value={dias}
              onChange={e => setDias(Math.max(1, parseInt(e.target.value) || 1))}
            />
          )}
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl flex items-start gap-3 border border-primary/10">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-primary/80 leading-relaxed italic">
            {indeterminado
              ? "O colaborador ficará em afastamento por tempo indeterminado. Para finalizá-lo futuramente, basta acessar a ficha do funcionário e informar a Data de Retorno."
              : "O sistema preencherá automaticamente a escala do colaborador para todos os dias do intervalo selecionado."}
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 h-14 rounded-[1.25rem] bg-primary font-black uppercase shadow-lg shadow-primary/20 text-xs"
            onClick={() => onSave({ tipo, inicio, dias, indeterminado })}
            loading={loading}
          >
            Confirmar Lançamento
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RetornoAfastamentoModal({ open, onClose, funcionarioNome, onSave, loading }: any) {
  const [dataRetorno, setDataRetorno] = useState(format(new Date(), 'yyyy-MM-dd'))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Informar Retorno do Afastamento"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="p-5 bg-muted/40 rounded-[1.5rem] border border-border/50">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1.5 leading-none">Colaborador em Afastamento</p>
          <p className="text-base font-black text-foreground uppercase leading-none">{funcionarioNome}</p>
        </div>

        <Input
          id="retorno-date"
          label="Data de Retorno às Atividades (Dia de Retorno) *"
          type="date"
          className="h-14 rounded-2xl font-bold"
          value={dataRetorno}
          onChange={e => setDataRetorno(e.target.value)}
        />

        <div className="p-4 bg-emerald-500/10 rounded-2xl flex items-start gap-3 border border-emerald-500/20">
          <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed italic">
            O afastamento será finalizado no dia anterior à data de retorno. A partir de {dataRetorno ? format(parseISO(dataRetorno), 'dd/MM/yyyy') : 'data de retorno'}, a escala do colaborador retornará ao padrão normal de trabalho.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase text-xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 h-14 rounded-[1.25rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs shadow-lg shadow-emerald-500/20"
            onClick={() => onSave(dataRetorno)}
            loading={loading}
          >
            Confirmar Data de Retorno
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DesligamentoModal({ open, onClose, funcionarioNome, onSave, loading }: any) {
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Programar Desligamento"
    >
      <div className="space-y-6 animate-fade-in">
        <div className="p-5 bg-muted/40 rounded-[1.5rem] border border-border/50">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1.5 leading-none">Colaborador</p>
          <p className="text-base font-black text-foreground uppercase leading-none">{funcionarioNome}</p>
        </div>

        <Input
          id="desligamento-date"
          label="Data Efetiva de Desligamento"
          type="date"
          className="h-14 rounded-2xl font-bold"
          value={data}
          onChange={e => setData(e.target.value)}
        />

        <div className="p-4 bg-rose-500/5 rounded-2xl flex items-start gap-3 border border-rose-500/10">
          <Info className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-rose-600/80 leading-relaxed italic">
            A partir desta data, o colaborador será marcado como inativo e não aparecerá nas grades de escala e registros de frequência. Você pode remover este lançamento a qualquer momento.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase text-xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 h-14 rounded-[1.25rem] bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs shadow-lg shadow-rose-500/20"
            onClick={() => onSave(data)}
            loading={loading}
          >
            Programar Desligamento
          </Button>
        </div>
      </div>
    </Modal>
  )
}
