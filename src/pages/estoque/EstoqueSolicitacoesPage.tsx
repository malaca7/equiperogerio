import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { FileText, Plus, Search, Filter, CheckCircle2, XCircle, Clock, ShoppingCart, Info } from 'lucide-react'
import { useEstoqueSolicitacoes, useEstoqueProdutos, useEstoqueLocais, useCreateEstoqueSolicitacao, useUpdateEstoqueSolicitacao } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { EstoqueSolicitacao } from '../../types/estoque.types'

export function EstoqueSolicitacoesPage() {
  const { user } = useAuth()
  const { data: solicitacoes = [], isLoading: loadS } = useEstoqueSolicitacoes()
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  const { data: locais = [], isLoading: loadL } = useEstoqueLocais()
  
  const createMutation = useCreateEstoqueSolicitacao()
  const updateMutation = useUpdateEstoqueSolicitacao()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Partial<EstoqueSolicitacao>>()

  const filteredSol = useMemo(() => {
    return solicitacoes.filter(s => {
      const prodName = s.produto?.nome || ''
      const matchSearch = prodName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = filterStatus === 'all' || s.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [solicitacoes, searchTerm, filterStatus])

  const onSubmit = async (data: Partial<EstoqueSolicitacao>) => {
    try {
      if (!user) throw new Error('Usuário não autenticado')
      
      await createMutation.mutateAsync({
        produto_id: data.produto_id,
        local_id: data.local_id || undefined, // Se vazio, não envia local_id
        quantidade_solicitada: Number(data.quantidade_solicitada),
        solicitante_id: user.profile.id,
        status: 'pendente',
        motivo: data.motivo,
        data_necessidade: data.data_necessidade || undefined,
      })
      
      toast('Solicitação de compra enviada!', 'success')
      setIsModalOpen(false)
      reset()
    } catch (e: any) {
      toast(e.message || 'Erro ao criar solicitação', 'error')
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: EstoqueSolicitacao['status']) => {
    if (!user) return
    
    const confirmMessage = 
      newStatus === 'aprovada' ? 'Deseja aprovar esta solicitação para compra?' :
      newStatus === 'comprada' ? 'Confirmar que este item já foi comprado/recebido?' :
      'Tem certeza que deseja negar/cancelar esta solicitação?'

    if (window.confirm(confirmMessage)) {
      try {
        await updateMutation.mutateAsync({
          id,
          updates: {
            status: newStatus,
            aprovador_id: (newStatus === 'aprovada' || newStatus === 'negada') ? user.profile.id : undefined
          }
        })
        toast(`Status atualizado para: ${newStatus}`, 'success')
      } catch (e: any) {
        toast('Erro ao atualizar status', 'error')
      }
    }
  }

  if (loadS || loadP || loadL) return <div className="min-h-screen bg-background"><TopHeader title="Solicitações" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Solicitações de Compras" 
        subtitle="Reposição de Estoque"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
        
        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações de Compra</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Crie requisições para compra ou reposição de insumos no estoque</p>
          </div>
          <button 
            onClick={() => { reset(); setIsModalOpen(true) }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Solicitação
          </button>
        </div>
        
        {/* Filtros */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por produto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          
          <div className="relative min-w-[250px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 outline-none appearance-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">Apenas Pendentes (Novos)</option>
              <option value="aprovada">Aprovadas (Aguardando Compra)</option>
              <option value="comprada">Finalizadas (Compradas)</option>
              <option value="negada">Negadas / Canceladas</option>
            </select>
          </div>
        </div>

        {/* Lista de Solicitações */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSol.map(s => {
            const sol = (s as any).solicitante
            const apr = (s as any).aprovador
            const isPendente = s.status === 'pendente'
            const isAprovada = s.status === 'aprovada'
            
            return (
              <div key={s.id} className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm hover:border-border transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary overflow-hidden shrink-0 border border-primary/20">
                      {sol?.avatar_url ? <img src={sol.avatar_url} alt="" className="w-full h-full object-cover" /> : sol?.nome?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{sol?.nome}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">{format(new Date(s.created_at), 'dd/MM/yy HH:mm')}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                    s.status === 'pendente' ? 'bg-amber-500/10 text-amber-500' :
                    s.status === 'aprovada' ? 'bg-blue-500/10 text-blue-500' :
                    s.status === 'comprada' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-rose-500/10 text-rose-500'
                  }`}>
                    {s.status === 'pendente' && <Clock className="w-3 h-3" />}
                    {(s.status === 'aprovada' || s.status === 'comprada') && <CheckCircle2 className="w-3 h-3" />}
                    {(s.status === 'negada' || s.status === 'cancelada') && <XCircle className="w-3 h-3" />}
                    {s.status}
                  </span>
                </div>

                <div className="flex-1 bg-muted/30 rounded-2xl p-4 border border-border/40 mb-4">
                  <p className="text-sm font-black text-foreground mb-1">{s.produto?.nome}</p>
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                    QTD: {s.quantidade_solicitada} {s.produto?.unidade_medida}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.motivo || 'Sem justificativa.'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                      <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">Para: {s.local?.nome || 'Almoxarifado Matriz'}</p>
                    </div>
                    {s.data_necessidade && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500/40" />
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Prazo: {format(new Date(s.data_necessidade), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {apr && (s.status !== 'pendente') && (
                  <p className="text-[10px] font-semibold text-muted-foreground text-center mb-4">
                    Avaliador: <span className="text-foreground">{apr.nome}</span>
                  </p>
                )}

                {/* Ações de Gestão */}
                <div className="flex gap-2 mt-auto">
                  {isPendente && (
                    <>
                      <button onClick={() => handleUpdateStatus(s.id, 'aprovada')} className="flex-1 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Aprovar
                      </button>
                      <button onClick={() => handleUpdateStatus(s.id, 'negada')} className="flex-1 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs font-bold">
                        <XCircle className="w-4 h-4" /> Negar
                      </button>
                    </>
                  )}
                  {isAprovada && (
                    <button onClick={() => handleUpdateStatus(s.id, 'comprada')} className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs font-bold">
                      <ShoppingCart className="w-4 h-4" /> Marcar como Comprada
                    </button>
                  )}
                  {(s.status === 'comprada' || s.status === 'negada' || s.status === 'cancelada') && (
                    <div className="w-full py-2.5 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest border border-border/50 rounded-xl bg-muted/10">
                      Processo Finalizado
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {filteredSol.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card/30 border border-border/50 rounded-3xl border-dashed">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-black text-foreground">Nada por aqui</p>
              <p className="text-sm font-semibold text-muted-foreground mt-1">Nenhuma solicitação encontrada com esses filtros.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Solicitação */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-card border border-border/50 rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col">
            
            <div className="p-6 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/20">
              <div>
                <Dialog.Title className="text-xl font-black text-foreground">
                  Nova Solicitação de Compra
                </Dialog.Title>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  Requisite produtos que faltam no estoque
                </p>
              </div>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produto Desejado *</label>
                  <select {...register('produto_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                    <option value="">Selecione o que precisa ser comprado...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  {errors.produto_id && <span className="text-rose-500 text-xs">Selecione um produto</span>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade Necessária *</label>
                  <input type="number" step="0.001" {...register('quantidade_solicitada', { required: true, min: 0.001 })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Limite Desejada</label>
                  <input type="date" {...register('data_necessidade')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none" />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Localidade Destino (Opcional)</label>
                  <select {...register('local_id')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                    <option value="">Matriz / Almoxarifado Central (Padrão)</option>
                    {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo / Justificativa *</label>
                  <textarea {...register('motivo', { required: true })} placeholder="Explique por que esta compra é necessária..." rows={3} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none resize-none" />
                  {errors.motivo && <span className="text-rose-500 text-xs">A justificativa é obrigatória</span>}
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 flex justify-end gap-3 mt-8">
                <Dialog.Close asChild>
                  <button type="button" className="px-6 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                </Dialog.Close>
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {createMutation.isPending ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>

            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
