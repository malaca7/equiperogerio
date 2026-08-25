import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { MapPin, Plus, Search, Edit, Trash2, Users, Package, ChevronRight, X, Building2, Eye, ShieldCheck } from 'lucide-react'
import { useEstoqueLocais, useEstoqueRegioes, useEstoqueSaldos, useCreateEstoqueLocal, useUpdateEstoqueLocal, useDeleteEstoqueLocal } from '../../hooks/useEstoque'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import type { EstoqueLocal } from '../../types/estoque.types'

const LOCAL_TIPO_LABELS: Record<string, string> = {
  matriz: 'Matriz',
  filial: 'Filial',
  obra: 'Obra/Projeto',
  veiculo: 'Veículo/Frota'
}

const LOCAL_TIPO_COLORS: Record<string, string> = {
  matriz: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  filial: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  obra: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  veiculo: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
}

export function EstoqueLocaisPage() {
  const { data: locais = [], isLoading: loadL } = useEstoqueLocais()
  const { data: regioes = [], isLoading: loadR } = useEstoqueRegioes()
  const { data: saldos = [] } = useEstoqueSaldos()
  
  const createMutation = useCreateEstoqueLocal()
  const updateMutation = useUpdateEstoqueLocal()
  const deleteMutation = useDeleteEstoqueLocal()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRegiao, setFilterRegiao] = useState<string>('all')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<EstoqueLocal | null>(null)

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-locais-responsavel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, avatar_url').order('nome')
      if (error) throw error
      return data
    }
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Partial<EstoqueLocal>>()

  const filteredLocais = useMemo(() => {
    return locais.filter(l => {
      const matchSearch = l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.endereco && l.endereco.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchType = filterType === 'all' || l.tipo === filterType
      const matchRegiao = filterRegiao === 'all' || l.regiao_id === filterRegiao
      return matchSearch && matchType && matchRegiao
    })
  }, [locais, searchTerm, filterType, filterRegiao])

  const handleOpen = (l?: EstoqueLocal) => {
    if (l) {
      setEditing(l)
      setValue('nome', l.nome)
      setValue('tipo', l.tipo)
      setValue('regiao_id', l.regiao_id || '')
      setValue('responsavel_id', l.responsavel_id || '')
      setValue('endereco', l.endereco || '')
      setValue('ativo', l.ativo)
    } else {
      setEditing(null)
      reset({
        tipo: 'matriz',
        ativo: true
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desativar ou excluir este local?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Local removido com sucesso!', 'success')
    } catch (e: any) {
      toast(e.message || 'Erro ao remover local', 'error')
    }
  }

  const onSubmit = async (data: Partial<EstoqueLocal>) => {
    try {
      const payload: Partial<EstoqueLocal> = {
        nome: data.nome,
        tipo: data.tipo,
        regiao_id: data.regiao_id || undefined,
        responsavel_id: data.responsavel_id || undefined,
        endereco: data.endereco || undefined,
        ativo: data.ativo
      }
      
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, updates: payload })
        toast('Local atualizado com sucesso!', 'success')
      } else {
        await createMutation.mutateAsync(payload)
        toast('Local criado com sucesso!', 'success')
      }
      setIsModalOpen(false)
      reset()
      setEditing(null)
    } catch (e: any) {
      toast(e.message || 'Erro ao salvar local', 'error')
    }
  }

  if (loadL || loadR) return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Locais de Estoque" />
      <div className="pt-28 sm:pt-32 pb-20"><Loading text="Carregando locais de estoque..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader
        title="Locais de Estoque"
        subtitle="Gerenciamento de depósitos, almoxarifados, frotas e obras"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações de Localidade</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Crie e configure novos armazéns, garagens ou setores físicos</p>
          </div>
          <button 
            onClick={() => handleOpen()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Novo Local
          </button>
        </div>

        {/* ── Filtros ── */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou endereço..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/40 border border-border/40 focus:border-indigo-500/50 rounded-xl text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 bg-muted/40 border border-border/40 rounded-xl text-xs font-bold text-foreground outline-none appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="all">Todos os Tipos</option>
              <option value="matriz">Matriz</option>
              <option value="filial">Filial</option>
              <option value="obra">Obra/Projeto</option>
              <option value="veiculo">Veículo/Frota</option>
            </select>

            <select
              value={filterRegiao}
              onChange={e => setFilterRegiao(e.target.value)}
              className="px-3 py-2 bg-muted/40 border border-border/40 rounded-xl text-xs font-bold text-foreground outline-none appearance-none cursor-pointer min-w-[150px]"
            >
              <option value="all">Todas as Regiões</option>
              {regioes.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          
          <span className="text-[10px] font-bold text-muted-foreground/60 whitespace-nowrap hidden lg:inline">
            {filteredLocais.length} locais encontrados
          </span>
        </div>

        {/* ── Locais Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocais.map(l => {
            const localSaldos = saldos.filter(s => s.local_id === l.id)
            const totalItens = localSaldos.reduce((a, c) => a + c.quantidade, 0)
            const valorTotal = localSaldos.reduce((a, c) => a + (c.quantidade * (c.produto?.valor_unitario_atual || 0)), 0)
            const resp = profiles.find(p => p.id === l.responsavel_id)

            return (
              <div 
                key={l.id} 
                className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-indigo-500/20 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-foreground">{l.nome}</h3>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded border", LOCAL_TIPO_COLORS[l.tipo])}>
                            {LOCAL_TIPO_LABELS[l.tipo]}
                          </span>
                          {l.regiao && (
                            <span className="text-[9px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border/30">
                              {l.regiao.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleOpen(l)} 
                        className="p-2 rounded-lg bg-muted/40 hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors text-muted-foreground active:scale-90"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(l.id)} 
                        className="p-2 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 transition-colors text-muted-foreground active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {l.endereco && (
                    <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-4 truncate">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      {l.endereco}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/30">
                  <div className="text-center">
                    <p className="text-lg font-black text-indigo-500">{totalItens.toFixed(0)}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Itens em Estoque</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-emerald-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valorTotal)}
                    </p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Valor do Estoque</p>
                  </div>
                </div>

                {resp && (
                  <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-[10px] font-bold shrink-0">
                      {resp.nome.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground truncate">
                      Resp: {resp.nome}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredLocais.length === 0 && (
          <div className="text-center py-16 bg-card/80 border border-border/50 rounded-2xl mt-6">
            <Building2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Nenhum local cadastrado ou encontrado</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Adicione seus depósitos, almoxarifados ou veículos de frota</p>
            <button 
              onClick={() => handleOpen()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Criar Primeiro Local
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000000] transition-all duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl z-[1000000] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20 shrink-0">
              <Dialog.Title className="text-lg font-black text-foreground">
                {editing ? 'Editar Local' : 'Novo Local'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome do Local *</label>
                <input 
                  {...register('nome', { required: true })} 
                  placeholder="Ex: Almoxarifado Central, Container Obra X, Veículo Ranger XYZ" 
                  className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none" 
                />
                {errors.nome && <span className="text-rose-500 text-[10px]">Obrigatório</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Local *</label>
                  <select 
                    {...register('tipo', { required: true })} 
                    className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none"
                  >
                    <option value="matriz">Matriz</option>
                    <option value="filial">Filial</option>
                    <option value="obra">Obra/Projeto</option>
                    <option value="veiculo">Veículo/Frota</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Região Organizacional</label>
                  <select 
                    {...register('regiao_id')} 
                    className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none"
                  >
                    <option value="">Nenhuma Região</option>
                    {regioes.map(r => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável pelo Local</label>
                <select 
                  {...register('responsavel_id')} 
                  className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none"
                >
                  <option value="">Sem Responsável</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endereço / Localização Física</label>
                <input 
                  {...register('endereco')} 
                  placeholder="Rua, Bloco, Container ou placa do veículo" 
                  className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50 shrink-0">
                <Dialog.Close asChild>
                  <button type="button" className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                </Dialog.Close>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
