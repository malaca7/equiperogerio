import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Plus, Search, Filter } from 'lucide-react'
import { useEstoqueMovimentacoes, useEstoqueProdutos, useEstoqueLocais, useCreateEstoqueMovimentacao } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

import { Modal } from '../../components/ui/Modal'
import { useForm } from 'react-hook-form'
import type { EstoqueMovimentacao } from '../../types/estoque.types'

export function EstoqueMovimentacoesPage() {
  const { user } = useAuth()
  const { data: movimentacoes = [], isLoading: loadM } = useEstoqueMovimentacoes()
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  const { data: locais = [], isLoading: loadL } = useEstoqueLocais()
  
  const createMutation = useCreateEstoqueMovimentacao()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterTipo, itemsPerPage])

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Partial<EstoqueMovimentacao>>({
    defaultValues: {
      tipo: 'entrada',
      subtipo: 'compra'
    }
  })
  
  const tipoSelecionado = watch('tipo')

  const filteredMovs = useMemo(() => {
    return movimentacoes.filter(m => {
      const pName = m.produto?.nome || ''
      const matchSearch = pName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.nota_fiscal && m.nota_fiscal.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchTipo = filterTipo === 'all' || m.tipo === filterTipo
      return matchSearch && matchTipo
    })
  }, [movimentacoes, searchTerm, filterTipo])

  const totalItems = filteredMovs.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  
  const paginatedMovs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMovs.slice(startIndex, endIndex)
  }, [filteredMovs, currentPage, itemsPerPage])

  const onSubmit = async (data: Partial<EstoqueMovimentacao>) => {
    try {
      if (!user) throw new Error('Usuário não autenticado')
      
      const payload: Partial<EstoqueMovimentacao> = {
        tipo: data.tipo,
        subtipo: data.subtipo || data.tipo,
        produto_id: data.produto_id,
        quantidade: Number(data.quantidade),
        usuario_id: user.profile.id,
        observacao: data.observacao || undefined,
        nota_fiscal: data.nota_fiscal || undefined,
        valor_unitario: data.valor_unitario ? Number(data.valor_unitario) : undefined,
      }

      if (data.tipo === 'entrada') {
        payload.local_destino_id = data.local_destino_id
      } else if (data.tipo === 'saida' || data.tipo === 'ajuste') {
        payload.local_origem_id = data.local_origem_id
        if (!data.subtipo) payload.subtipo = 'consumo'
      } else if (data.tipo === 'transferencia') {
        payload.local_origem_id = data.local_origem_id
        payload.local_destino_id = data.local_destino_id
      }

      await createMutation.mutateAsync(payload)
      toast('Movimentação registrada com sucesso!', 'success')
      setIsModalOpen(false)
      reset()
    } catch (e: any) {
      toast(e.message || 'Erro ao registrar movimentação', 'error')
    }
  }

  if (loadM || loadP || loadL) return <div className="min-h-screen bg-background"><TopHeader title="Movimentações" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Movimentações do Estoque" 
        subtitle="Entradas, Saídas e Transferências"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
        
        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações de Fluxo</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Registre entradas, saídas e transferências de estoque</p>
          </div>
          <button 
            onClick={() => { reset({ tipo: 'entrada', subtipo: 'compra' }); setIsModalOpen(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </button>
        </div>
        
        {/* Filtros */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por produto ou NF..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 outline-none appearance-none"
            >
              <option value="all">Todos os Tipos</option>
              <option value="entrada">Apenas Entradas</option>
              <option value="saida">Apenas Saídas</option>
              <option value="transferencia">Apenas Transferências</option>
              <option value="ajuste">Apenas Ajustes</option>
            </select>
          </div>
        </div>

        {/* KPIs de Resumo (Baseado nos filtros) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-0.5">Entradas</p>
              <p className="text-2xl font-black text-foreground">
                {filteredMovs.filter(m => m.tipo === 'entrada').length}
              </p>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-0.5">Saídas</p>
              <p className="text-2xl font-black text-foreground">
                {filteredMovs.filter(m => m.tipo === 'saida' || m.tipo === 'ajuste').length}
              </p>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-0.5">Transferências</p>
              <p className="text-2xl font-black text-foreground">
                {filteredMovs.filter(m => m.tipo === 'transferencia').length}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline / Lista de Movimentações */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] sm:rounded-3xl overflow-hidden shadow-sm">
          
          {/* Mobile View: Cards */}
          <div className="md:hidden divide-y divide-border/20">
            {paginatedMovs.map(mov => {
              const isEntrada = mov.tipo === 'entrada'
              const isSaida = mov.tipo === 'saida' || mov.tipo === 'ajuste'
              const isTransferencia = mov.tipo === 'transferencia'

              return (
                <div key={mov.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-[1rem] flex items-center justify-center shrink-0 ${
                        isEntrada ? 'bg-emerald-500/10 text-emerald-500' :
                        isSaida ? 'bg-rose-500/10 text-rose-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {isEntrada && <ArrowDownRight className="w-5 h-5" />}
                        {isSaida && <ArrowUpRight className="w-5 h-5" />}
                        {isTransferencia && <ArrowLeftRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">{mov.produto?.nome || 'Desconhecido'}</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          isEntrada ? 'bg-emerald-500/10 text-emerald-500' :
                          isSaida ? 'bg-rose-500/10 text-rose-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {mov.subtipo || mov.tipo}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-black ${isEntrada ? 'text-emerald-500' : isSaida ? 'text-rose-500' : 'text-blue-500'}`}>
                        {isEntrada ? '+' : isSaida ? '-' : ''}{mov.quantidade} <span className="text-[10px] text-muted-foreground uppercase">{mov.produto?.unidade_medida}</span>
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground">{format(new Date(mov.data_movimentacao), 'dd/MM HH:mm')}</p>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-[1.25rem] border border-border/30 text-xs">
                    {isTransferencia ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 font-bold text-rose-500">
                          <ArrowUpRight className="w-3.5 h-3.5" /> De: {mov.local_origem?.nome}
                        </div>
                        <div className="flex items-center gap-2 font-bold text-emerald-500">
                          <ArrowDownRight className="w-3.5 h-3.5" /> Para: {mov.local_destino?.nome}
                        </div>
                      </div>
                    ) : isEntrada ? (
                      <div className="font-semibold text-foreground">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-widest mr-1">Para:</span> {mov.local_destino?.nome}
                      </div>
                    ) : (
                      <div className="font-semibold text-foreground">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-widest mr-1">De:</span> {mov.local_origem?.nome}
                      </div>
                    )}
                    
                    {(mov.nota_fiscal || mov.observacao || mov.usuario) && (
                      <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
                        {mov.usuario?.nome && (
                          <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">
                            Por: {mov.usuario.nome}
                          </p>
                        )}
                        {mov.nota_fiscal && <p className="font-bold text-muted-foreground text-[10px]">NF: {mov.nota_fiscal}</p>}
                        {mov.observacao && <p className="font-medium text-muted-foreground/80 text-[10px] mt-0.5 line-clamp-2">{mov.observacao}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4 font-black">Data/Hora</th>
                  <th className="px-6 py-4 font-black">Movimentação</th>
                  <th className="px-6 py-4 font-black">Produto</th>
                  <th className="px-6 py-4 font-black text-center">Quantidade</th>
                  <th className="px-6 py-4 font-black">Local(is)</th>
                  <th className="px-6 py-4 font-black">Responsável / Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedMovs.map(mov => {
                  const isEntrada = mov.tipo === 'entrada'
                  const isSaida = mov.tipo === 'saida' || mov.tipo === 'ajuste'
                  const isTransferencia = mov.tipo === 'transferencia'

                  return (
                    <tr key={mov.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-xs font-bold text-foreground">{format(new Date(mov.data_movimentacao), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground">{format(new Date(mov.data_movimentacao), 'HH:mm', { locale: ptBR })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isEntrada ? 'bg-emerald-500/10 text-emerald-500' :
                          isSaida ? 'bg-rose-500/10 text-rose-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {isEntrada && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {isSaida && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {isTransferencia && <ArrowLeftRight className="w-3.5 h-3.5" />}
                          {mov.subtipo || mov.tipo}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{mov.produto?.nome || 'Produto Indefinido'}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{mov.produto?.codigo_interno || 'S/ COD'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className={`text-lg font-black ${isEntrada ? 'text-emerald-500' : isSaida ? 'text-rose-500' : 'text-blue-500'}`}>
                          {isEntrada ? '+' : isSaida ? '-' : ''}{mov.quantidade}
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{mov.produto?.unidade_medida}</p>
                      </td>
                      <td className="px-6 py-4">
                        {isTransferencia ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                              <ArrowUpRight className="w-3 h-3" /> De: {mov.local_origem?.nome}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                              <ArrowDownRight className="w-3 h-3" /> Para: {mov.local_destino?.nome}
                            </div>
                          </div>
                        ) : isEntrada ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            Para: <span className="text-muted-foreground">{mov.local_destino?.nome}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            De: <span className="text-muted-foreground">{mov.local_origem?.nome}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-[200px]">
                        <p className="text-xs font-bold text-foreground truncate">{mov.nota_fiscal ? `NF: ${mov.nota_fiscal}` : 'S/ NF'}</p>
                        <p className="text-[10px] font-black text-primary uppercase tracking-wide truncate mt-0.5">Por: {mov.usuario?.nome || 'Sistema'}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground truncate mt-0.5">{mov.observacao || '-'}</p>
                      </td>
                    </tr>
                  )
                })}
                {filteredMovs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm font-semibold">
                      Nenhuma movimentação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINAÇÃO */}
        {totalItems > 0 && (
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-4 mt-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Exibir</span>
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                className="bg-muted/40 border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary/50 transition-all cursor-pointer"
              >
                <option value={10}>10 registros</option>
                <option value={25}>25 registros</option>
                <option value={50}>50 registros</option>
                <option value={100}>100 registros</option>
              </select>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                de {totalItems} registros
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="h-9 px-3.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                Anterior
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (currentPage > 3 && totalPages > 5) {
                    if (currentPage + 2 > totalPages) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-9 w-9 rounded-xl text-xs font-black transition-all active:scale-90 flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <span className="sm:hidden text-xs font-bold text-foreground px-2">
                Pág. {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="h-9 px-3.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                Próximo
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal Nova Movimentação */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Movimentação"
        subtitle="Dê entrada ou saída de itens no estoque"
        footer={
          <button
            form="movimentacao-form"
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-4.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center"
          >
            {createMutation.isPending ? 'Registrando...' : 'Registrar Movimento'}
          </button>
        }
      >
        <form id="movimentacao-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Movimento *</label>
              <select {...register('tipo', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="entrada">Entrada (Ex: Compra)</option>
                <option value="saida">Saída (Ex: Consumo)</option>
                <option value="transferencia">Transferência (Entre locais)</option>
                <option value="ajuste">Ajuste de Estoque</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sub-tipo / Motivo *</label>
              <input {...register('subtipo', { required: true })} placeholder="Ex: Compra, Perda, Doação..." className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produto *</label>
              <select {...register('produto_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="">Selecione o produto...</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - {p.codigo_interno || 'S/ COD'}</option>)}
              </select>
              {errors.produto_id && <span className="text-rose-500 text-xs">Produto é obrigatório</span>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade *</label>
              <input type="number" step="0.001" {...register('quantidade', { required: true, min: 0.001 })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
              {errors.quantidade && <span className="text-rose-500 text-xs">Quantidade inválida</span>}
            </div>

            {tipoSelecionado === 'entrada' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Local de Destino *</label>
                <select {...register('local_destino_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-emerald-500 outline-none">
                  <option value="">Para qual local?</option>
                  {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            )}

            {(tipoSelecionado === 'saida' || tipoSelecionado === 'ajuste') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-rose-500">Local de Origem *</label>
                <select {...register('local_origem_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-rose-500 outline-none">
                  <option value="">De onde está saindo?</option>
                  {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            )}

            {tipoSelecionado === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-rose-500">Origem *</label>
                  <select {...register('local_origem_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-rose-500 outline-none">
                    <option value="">De onde está saindo?</option>
                    {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Destino *</label>
                  <select {...register('local_destino_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-emerald-500 outline-none">
                    <option value="">Para onde vai?</option>
                    {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nota Fiscal</label>
              <input {...register('nota_fiscal')} placeholder="Nº da Nota Fiscal (se houver)" className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</label>
              <textarea {...register('observacao')} placeholder="Observações adicionais..." rows={2} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none resize-none" />
            </div>

          </div>

        </form>
      </Modal>

    </div>
  )
}
