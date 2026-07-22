import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Package, Plus, Search, Filter, Edit, Edit2, Activity, Trash2, ShieldCheck, Box, Hash, Barcode, Printer, ArchiveRestore } from 'lucide-react'
import { useEstoqueProdutos, useEstoqueCategorias, useEstoqueSaldos, useCreateEstoqueProduto, useUpdateEstoqueProduto, useDeleteEstoqueProduto } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import type { EstoqueProduto } from '../../types/estoque.types'

import { Modal } from '../../components/ui/Modal'
import { useForm } from 'react-hook-form'

export function EstoqueProdutosPage() {
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  const { data: categorias = [], isLoading: loadC } = useEstoqueCategorias()
  const { data: saldos = [], isLoading: loadS } = useEstoqueSaldos()
  
  const createMutation = useCreateEstoqueProduto()
  const updateMutation = useUpdateEstoqueProduto()
  const deleteMutation = useDeleteEstoqueProduto()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<EstoqueProduto | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Partial<EstoqueProduto>>()

  const saldosAgrupados = useMemo(() => {
    return saldos.reduce((acc, curr) => {
      acc[curr.produto_id] = (acc[curr.produto_id] || 0) + curr.quantidade
      return acc
    }, {} as Record<string, number>)
  }, [saldos])

  const filteredProdutos = useMemo(() => {
    return produtos.filter(p => {
      const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.codigo_interno && p.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchCat = selectedCategoria === 'all' || p.categoria_id === selectedCategoria
      return matchSearch && matchCat
    })
  }, [produtos, searchTerm, selectedCategoria])

  const handleOpenModal = (produto?: EstoqueProduto) => {
    if (produto) {
      setEditingProduto(produto)
      setValue('nome', produto.nome)
      setValue('codigo_interno', produto.codigo_interno || '')
      setValue('codigo_barras', produto.codigo_barras || '')
      setValue('categoria_id', produto.categoria_id || '')
      setValue('unidade_medida', produto.unidade_medida)
      setValue('marca', produto.marca || '')
      setValue('estoque_minimo', produto.estoque_minimo)
      setValue('estoque_maximo', produto.estoque_maximo)
      setValue('controle_lote', produto.controle_lote)
      setValue('controle_validade', produto.controle_validade)
      setValue('controle_ca', produto.controle_ca)
      setValue('tipo_material', produto.tipo_material || 'insumo')
    } else {
      setEditingProduto(null)
      reset({
        nome: '',
        codigo_interno: '',
        codigo_barras: '',
        categoria_id: '',
        unidade_medida: 'UN',
        marca: '',
        estoque_minimo: 0,
        estoque_maximo: 0,
        controle_lote: false,
        controle_validade: false,
        controle_ca: false,
        tipo_material: 'insumo',
      })
    }
    setIsModalOpen(true)
  }

  const onSubmit = async (data: Partial<EstoqueProduto>) => {
    try {
      const payload = {
        ...data,
        categoria_id: data.categoria_id || undefined, // Handle empty string as undefined
        estoque_minimo: Number(data.estoque_minimo),
        estoque_maximo: Number(data.estoque_maximo),
      }

      if (editingProduto) {
        await updateMutation.mutateAsync({ id: editingProduto.id, updates: payload })
        toast('Produto atualizado com sucesso!', 'success')
      } else {
        await createMutation.mutateAsync(payload)
        toast('Produto cadastrado com sucesso!', 'success')
      }
      setIsModalOpen(false)
    } catch (e: any) {
      toast(e.message || 'Erro ao salvar produto', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto? O histórico de movimentações pode ser afetado se não houver soft-delete implementado na API.')) {
      try {
        await deleteMutation.mutateAsync(id)
        toast('Produto excluído!', 'success')
      } catch (e: any) {
        toast('Erro ao excluir produto (ele pode estar em uso no estoque)', 'error')
      }
    }
  }

  const printBarcode = (produto: EstoqueProduto) => {
    const code = produto.codigo_barras || produto.codigo_interno || produto.id.split('-')[0]
    const novaJanela = window.open('', '_blank')
    if (novaJanela) {
      novaJanela.document.write(`
        <html>
          <head>
            <title>Imprimir Etiqueta</title>
            <style>
              body { font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fff; }
              .label { border: 1px dashed #ccc; padding: 20px; text-align: center; width: 300px; }
              .name { font-size: 14px; font-weight: bold; margin-bottom: 10px; font-family: Arial, sans-serif; text-transform: uppercase; }
              .barcode { font-size: 40px; letter-spacing: 2px; margin: 10px 0; font-family: 'Libre Barcode 39', cursive; }
              .code { font-size: 12px; }
              @media print { button { display: none; } .label { border: none; } }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
          </head>
          <body>
            <div class="label">
              <div class="name">${produto.nome}</div>
              <div class="barcode">*${code}*</div>
              <div class="code">${code}</div>
              <button onclick="window.print()" style="margin-top: 20px; padding: 8px 16px; cursor: pointer; font-family: Arial;">Imprimir Agora</button>
            </div>
          </body>
        </html>
      `)
      novaJanela.document.close()
    }
  }

  if (loadP || loadC || loadS) return <div className="min-h-screen bg-background"><TopHeader title="Catálogo" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Catálogo de Produtos" 
        subtitle={`${produtos.length} itens cadastrados no sistema`}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
        
        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações de Catálogo</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Adicione e cadastre novos itens ou insumos no catálogo</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
        {/* Filtros */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={selectedCategoria}
              onChange={e => setSelectedCategoria(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 outline-none appearance-none"
            >
              <option value="all">Todas as Categorias</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid de Produtos (Mobile: Cards, Desktop: Tabela) */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] sm:rounded-3xl overflow-hidden shadow-sm">
          {/* Mobile View: Cards */}
          <div className="md:hidden divide-y divide-border/20">
            {filteredProdutos.map(produto => {
              const qtdTotal = saldosAgrupados[produto.id] || 0
              const isBaixo = qtdTotal > 0 && qtdTotal <= produto.estoque_minimo
              const isZerad = qtdTotal === 0

              return (
                <div key={produto.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-4 mb-3">
                    <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center border shrink-0 ${
                      isZerad ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                      isBaixo ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className="text-sm font-black text-foreground">{produto.nome}</p>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleOpenModal(produto)} className="p-2 text-muted-foreground hover:text-primary bg-muted/40 rounded-xl"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(produto.id)} className="p-2 text-muted-foreground hover:text-rose-500 bg-muted/40 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground bg-background border border-border/40 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {produto.codigo_interno || 'S/C'}
                        </span>
                        {produto.categoria && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border" style={{ backgroundColor: `${produto.categoria.cor}10`, color: produto.categoria.cor, borderColor: `${produto.categoria.cor}20` }}>
                            {produto.categoria.nome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl border border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-background border border-border/50 flex items-center justify-center"><Activity className="w-4 h-4 text-muted-foreground" /></div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estoque</p>
                        <p className={`text-sm font-black ${isZerad ? 'text-rose-500' : isBaixo ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {qtdTotal} <span className="text-[10px] uppercase text-muted-foreground">{produto.unidade_medida}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mínimo: {produto.estoque_minimo}</p>
                      {isZerad ? <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Esgotado</span> : isBaixo ? <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Crítico</span> : <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Normal</span>}
                    </div>
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
                  <th className="px-6 py-4 font-black">Produto / Código</th>
                  <th className="px-6 py-4 font-black">Categoria</th>
                  <th className="px-6 py-4 font-black">Estoque Total</th>
                  <th className="px-6 py-4 font-black text-center">Mínimo</th>
                  <th className="px-6 py-4 font-black text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredProdutos.map(produto => {
                  const qtdTotal = saldosAgrupados[produto.id] || 0
                  const isBaixo = qtdTotal > 0 && qtdTotal <= produto.estoque_minimo
                  const isZerad = qtdTotal === 0

                  return (
                    <tr key={produto.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isZerad ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : isBaixo ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{produto.nome}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground">{produto.codigo_interno || 'Sem código'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {produto.categoria ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-transparent" style={{ backgroundColor: `${produto.categoria.cor}15`, color: produto.categoria.cor, borderColor: `${produto.categoria.cor}30` }}>
                            {produto.categoria.nome}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-lg border border-border/50">Sem Categoria</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black ${isZerad ? 'text-rose-500' : isBaixo ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {qtdTotal} <span className="text-[10px] text-muted-foreground uppercase">{produto.unidade_medida}</span>
                          </span>
                          {isZerad && <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20 ml-2">Zerad</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-foreground">{produto.estoque_minimo}</span>
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Mínimo</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(produto)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(produto.id)} className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredProdutos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm font-semibold">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Formulário */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduto ? 'Editar Produto' : 'Novo Produto'}
        subtitle="Preencha os dados do item no catálogo"
        footer={
          <button
            form="produto-form"
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="w-full py-4.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar Produto'}
          </button>
        }
      >
        <form id="produto-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome do Produto *</label>
              <input {...register('nome', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" placeholder="Ex: Luva de Vaqueta, Parafuso Sextavado..." />
              {errors.nome && <span className="text-rose-500 text-xs">Campo obrigatório</span>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código Interno</label>
              <input {...register('codigo_interno')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código de Barras (EAN)</label>
              <input {...register('codigo_barras')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoria</label>
              <select {...register('categoria_id')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="">Sem categoria...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Destinação do Material (Fluxo)</label>
              <select {...register('tipo_material')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="insumo">Consumível (Retirada Rápida)</option>
                <option value="epi">EPI (Parte de Cautela)</option>
                <option value="ferramenta">Ferramenta (Parte de Cautela)</option>
                <option value="geral">Outros / Geral</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidade de Medida</label>
              <select {...register('unidade_medida')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="UN">Unidade (UN)</option>
                <option value="KG">Quilo (KG)</option>
                <option value="L">Litro (L)</option>
                <option value="M">Metro (M)</option>
                <option value="CX">Caixa (CX)</option>
                <option value="PCT">Pacote (PCT)</option>
                <option value="PAR">Par (PAR)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estoque Mínimo (Alerta)</label>
              <input type="number" step="0.01" {...register('estoque_minimo')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estoque Máximo (Ideal)</label>
              <input type="number" step="0.01" {...register('estoque_maximo')} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary focus:bg-card outline-none" />
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-muted/30 border border-border/50 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Configurações Especiais do Item</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-card border border-border/40 hover:border-blue-500/50 transition-colors">
                <input type="checkbox" {...register('controle_lote')} className="w-5 h-5 rounded-lg border-border/50 text-blue-500 focus:ring-blue-500/20 bg-muted" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">Controle de Lote</span>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Rastreabilidade obrigatória</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-card border border-border/40 hover:border-amber-500/50 transition-colors">
                <input type="checkbox" {...register('controle_validade')} className="w-5 h-5 rounded-lg border-border/50 text-amber-500 focus:ring-amber-500/20 bg-muted" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">Controle de Validade</span>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Gerencia perecimento</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-card border border-border/40 hover:border-purple-500/50 transition-colors sm:col-span-2">
                <input type="checkbox" {...register('controle_ca')} className="w-5 h-5 rounded-lg border-border/50 text-purple-500 focus:ring-purple-500/20 bg-muted" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">É um EPI (Equipamento de Proteção)</span>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Exige C.A. e termo de cautela no uso</span>
                </div>
              </label>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  )
}

