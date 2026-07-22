import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { MapPin, Plus, Search, Edit, Users, Package, ChevronRight, X, Building2 } from 'lucide-react'
import { useEstoqueRegioes, useEstoqueSaldos, useCreateEstoqueRegiao, useUpdateEstoqueRegiao, useEstoqueLocais } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import type { EstoqueRegiao } from '../../types/estoque.types'

export function EstoqueRegioesPage() {
  const { data: regioes = [], isLoading: loadR } = useEstoqueRegioes()
  const { data: saldos = [] } = useEstoqueSaldos()
  const { data: locais = [] } = useEstoqueLocais()
  const createMutation = useCreateEstoqueRegiao()
  const updateMutation = useUpdateEstoqueRegiao()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<EstoqueRegiao | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Partial<EstoqueRegiao>>()

  const filteredRegioes = useMemo(() => {
    return regioes.filter(r =>
      r.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.codigo && r.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [regioes, searchTerm])

  const handleOpen = (r?: EstoqueRegiao) => {
    if (r) {
      setEditing(r)
      setValue('nome', r.nome)
      setValue('codigo', r.codigo || '')
      setValue('endereco', r.endereco || '')
    } else {
      setEditing(null)
      reset()
    }
    setIsModalOpen(true)
  }

  const onSubmit = async (data: Partial<EstoqueRegiao>) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, updates: data })
        toast('Região atualizada!', 'success')
      } else {
        await createMutation.mutateAsync(data)
        toast('Região criada!', 'success')
      }
      setIsModalOpen(false)
      reset()
      setEditing(null)
    } catch (e: any) {
      toast(e.message || 'Erro ao salvar região', 'error')
    }
  }

  if (loadR) return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Regiões" />
      <div className="pt-28 sm:pt-32 pb-20"><Loading text="Carregando regiões..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader
        title="Regiões"
        subtitle="Gestão de Estrutura Organizacional"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações Organizacionais</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Crie e configure novas divisões territoriais ou regionais</p>
          </div>
          <button 
            onClick={() => handleOpen()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Região
          </button>
        </div>

        {/* Busca */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl px-4 py-2.5 mb-6 shadow-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar região..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-[11px] font-black text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground/50">{regioes.length} regiões</span>
        </div>

        {/* Grid de Regiões */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRegioes.map(r => {
            const regionLocais = locais.filter(l => l.regiao_id === r.id)
            const regionSaldos = saldos.filter(s => s.local?.regiao?.id === r.id)
            const totalItens = regionSaldos.reduce((a, c) => a + c.quantidade, 0)
            const valorTotal = regionSaldos.reduce((a, c) => a + (c.quantidade * (c.produto?.valor_unitario_atual || 0)), 0)

            return (
              <div key={r.id} className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-cyan-500/20 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">{r.nome}</h3>
                      <p className="text-[10px] text-muted-foreground font-semibold">{r.codigo || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => handleOpen(r)} className="p-1.5 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground opacity-0 group-hover:opacity-100">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>

                {r.endereco && <p className="text-[10px] text-muted-foreground mb-3 truncate">{r.endereco}</p>}

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
                  <div className="text-center">
                    <p className="text-lg font-black text-indigo-500">{regionLocais.length}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Locais</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-500">{totalItens.toFixed(0)}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Itens</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-amber-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valorTotal)}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Valor</p>
                  </div>
                </div>

                {r.responsavel && (
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground">{r.responsavel.nome}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredRegioes.length === 0 && (
          <div className="text-center py-16 bg-card/80 border border-border/50 rounded-2xl">
            <MapPin className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Nenhuma região cadastrada</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Crie regiões para organizar seu estoque</p>
            <button onClick={() => handleOpen()} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all">
              <Plus className="w-4 h-4 inline mr-1" /> Criar Primeira Região
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <Dialog.Title className="text-lg font-black text-foreground">{editing ? 'Editar Região' : 'Nova Região'}</Dialog.Title>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da Região *</label>
                <input {...register('nome', { required: true })} placeholder="Ex: Região Norte" className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none" />
                {errors.nome && <span className="text-rose-500 text-[10px]">Obrigatório</span>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</label>
                <input {...register('codigo')} placeholder="Ex: RN-001" className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endereço</label>
                <input {...register('endereco')} placeholder="Endereço ou referência" className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold focus:border-primary outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
                <Dialog.Close asChild>
                  <button type="button" className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted">Cancelar</button>
                </Dialog.Close>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
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
