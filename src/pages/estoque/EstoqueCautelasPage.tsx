import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { ShieldCheck, Plus, Search, Filter, Wrench, HardHat, FileSignature, CheckCircle2, AlertTriangle, Printer } from 'lucide-react'
import { useEstoqueCautelas, useEstoqueProdutos, useCreateEstoqueCautela, useUpdateEstoqueCautela } from '../../hooks/useEstoque'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Modal } from '../../components/ui/Modal'
import { useForm } from 'react-hook-form'
import type { EstoqueCautela } from '../../types/estoque.types'

export function EstoqueCautelasPage() {
  const { data: cautelas = [], isLoading: loadC } = useEstoqueCautelas()
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  
  const { data: funcionarios = [], isLoading: loadF } = useQuery({
    queryKey: ['destinatarios-cautelas-unificada'],
    queryFn: async () => {
      const { data: profilesData } = await supabase.from('profiles').select('id, nome, avatar_url, cpf').order('nome')
      const { data: funcData } = await supabase.from('funcionarios').select('id, nome, matricula, cpf').is('deleted_at', null).eq('status', 'ativo').order('nome')

      const unified: { id: string; nome: string; avatar_url?: string; matricula?: string; cpf?: string; tipo: 'usuario' | 'funcionario' }[] = []
      if (profilesData) profilesData.forEach(p => unified.push({ id: p.id, nome: p.nome, avatar_url: p.avatar_url || undefined, cpf: p.cpf || undefined, tipo: 'usuario' }))
      if (funcData) funcData.forEach(f => unified.push({ id: f.id, nome: f.nome, matricula: f.matricula || undefined, cpf: f.cpf || undefined, tipo: 'funcionario' }))
      return unified.sort((a, b) => a.nome.localeCompare(b.nome))
    }
  })

  const createMutation = useCreateEstoqueCautela()
  const updateMutation = useUpdateEstoqueCautela()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('ativo')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Partial<EstoqueCautela>>({
    defaultValues: {
      tipo: 'epi',
      quantidade: 1,
      status: 'ativo'
    }
  })

  const currentTipo = watch('tipo')

  const filteredProdutosParaCautela = useMemo(() => {
    return produtos.filter(p => {
      if (currentTipo === 'epi') {
        return p.tipo_material === 'epi' || p.controle_ca || p.categoria?.nome?.toLowerCase() === 'epis'
      } else if (currentTipo === 'ferramenta') {
        return p.tipo_material === 'ferramenta' || p.categoria?.nome?.toLowerCase() === 'ferramentas'
      }
      return true
    })
  }, [produtos, currentTipo])

  const filteredCautelas = useMemo(() => {
    return cautelas.filter(c => {
      const funcName = (c as any).funcionario?.nome || ''
      const prodName = c.produto?.nome || ''
      
      const matchSearch = funcName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          prodName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchTipo = filterTipo === 'all' || c.tipo === filterTipo
      const matchStatus = filterStatus === 'all' || c.status === filterStatus
      
      return matchSearch && matchTipo && matchStatus
    })
  }, [cautelas, searchTerm, filterTipo, filterStatus])

  const onSubmit = async (data: Partial<EstoqueCautela>) => {
    try {
      const selectedPerson = funcionarios.find(f => f.id === data.funcionario_id)
      if (!selectedPerson) throw new Error('Selecione um funcionário ou usuário válido')

      const payload: any = {
        tipo: data.tipo,
        produto_id: data.produto_id,
        quantidade: Number(data.quantidade),
        status: 'ativo',
        data_entrega: new Date().toISOString(),
        termo_gerado: false
      }

      if (selectedPerson.tipo === 'usuario') {
        payload.funcionario_id = selectedPerson.id
        payload.colaborador_id = null
      } else {
        payload.funcionario_id = null
        payload.colaborador_id = selectedPerson.id
      }

      await createMutation.mutateAsync(payload)
      toast('Cautela registrada com sucesso!', 'success')
      setIsModalOpen(false)
      reset()
    } catch (e: any) {
      toast(e.message || 'Erro ao registrar cautela', 'error')
    }
  }

  const handleDevolucao = async (id: string) => {
    if (window.confirm('Confirmar a devolução deste item ao estoque?')) {
      try {
        await updateMutation.mutateAsync({
          id,
          updates: {
            status: 'devolvido',
            data_devolucao_realizada: new Date().toISOString()
          }
        })
        toast('Item devolvido com sucesso!', 'success')
      } catch (e: any) {
        toast('Erro ao registrar devolução', 'error')
      }
    }
  }

  const handleGerarTermo = (cautela: EstoqueCautela) => {
    const func = cautela.colaborador || cautela.funcionario
    const conteudo = `
TERMO DE RESPONSABILIDADE - RECEBIMENTO DE ${cautela.tipo.toUpperCase()}

Eu, ${func?.nome}, declaro ter recebido da empresa o seguinte equipamento para uso em minhas atividades profissionais:

Equipamento: ${cautela.produto?.nome}
Quantidade: ${cautela.quantidade} ${cautela.produto?.unidade_medida}
Data de Entrega: ${format(new Date(cautela.data_entrega), 'dd/MM/yyyy')}

Declaro que:
1. Recebi o equipamento em perfeito estado de conservação e funcionamento.
2. Fui treinado e orientado quanto ao uso correto, guarda e conservação.
3. Comprometo-me a utilizá-lo apenas para as finalidades a que se destina.
4. Comprometo-me a comunicar imediatamente à empresa qualquer alteração, dano ou perda.
5. Estou ciente de que o dano ou extravio por negligência ou mau uso poderá implicar em desconto em folha, conforme legislação vigente.
6. Comprometo-me a devolver o equipamento ao término do contrato de trabalho ou quando solicitado.

_____________________________________________________
Assinatura do Funcionário

Data: _____/_____/_________
    `
    
    const novaJanela = window.open('', '_blank')
    if (novaJanela) {
      novaJanela.document.write(`
        <html>
          <head>
            <title>Termo de Responsabilidade</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h2 { text-align: center; margin-bottom: 30px; }
              pre { font-family: Arial, sans-serif; white-space: pre-wrap; font-size: 14px; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h2>TERMO DE RESPONSABILIDADE</h2>
            <pre>${conteudo}</pre>
            <div style="text-align: center; margin-top: 40px;">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Imprimir Termo</button>
            </div>
          </body>
        </html>
      `)
      novaJanela.document.close()
    }
  }

  if (loadC || loadP || loadF) return <div className="min-h-screen bg-background"><TopHeader title="Cautelas" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader 
        title="Cautelas e Empréstimos" 
        subtitle="Controle de EPIs e Ferramentas"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-12">
        
        {/* Card de Ação Rápida */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Ações de Entrega</h3>
            <p className="text-[10px] text-muted-foreground font-semibold">Registre a entrega ou cautela de EPIs/Ferramentas para colaboradores</p>
          </div>
          <button 
            onClick={() => { reset({ tipo: 'epi', quantidade: 1, status: 'ativo' }); setIsModalOpen(true) }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-black hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary),0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Entrega
          </button>
        </div>
        
        {/* Filtros */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por funcionário ou produto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          
          <div className="flex gap-4 min-w-[300px]">
            <div className="relative flex-1">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={filterTipo}
                onChange={e => setFilterTipo(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 outline-none appearance-none"
              >
                <option value="all">Tipos (Todos)</option>
                <option value="epi">Apenas EPI</option>
                <option value="ferramenta">Apenas Ferramentas</option>
              </select>
            </div>
            
            <div className="relative flex-1">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary/50 outline-none appearance-none"
              >
                <option value="all">Status (Todos)</option>
                <option value="ativo">Ativos (Com funcionário)</option>
                <option value="devolvido">Devolvidos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Cautelas */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] sm:rounded-3xl overflow-hidden shadow-sm">
          
          {/* Mobile View: Cards */}
          <div className="md:hidden divide-y divide-border/20">
            {filteredCautelas.map(c => {
              const person = (c.colaborador || c.funcionario) as any
              const isEpi = c.tipo === 'epi'
              const isAtivo = c.status === 'ativo'

              return (
                <div key={c.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary overflow-hidden shrink-0">
                        {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : person?.nome?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{person?.nome}</p>
                        <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isEpi ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {isEpi ? <HardHat className="w-2.5 h-2.5" /> : <Wrench className="w-2.5 h-2.5" />}
                          {c.tipo}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        isAtivo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        c.status === 'devolvido' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-rose-500/10 text-rose-500'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-[1.25rem] border border-border/30 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Item Entregue</p>
                        <p className="text-sm font-bold text-foreground">{c.produto?.nome}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{c.quantidade} {c.produto?.unidade_medida} • CA: {c.produto?.controle_ca ? 'Sim' : 'Não'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Data</p>
                        <p className="text-xs font-bold text-foreground">{format(new Date(c.data_entrega), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        {c.data_devolucao_realizada && (
                          <p className="text-[9px] font-bold text-muted-foreground mt-0.5">
                            Dev: {format(new Date(c.data_devolucao_realizada), 'dd/MM/yy')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/40">
                      {isAtivo && (
                        <button onClick={() => handleDevolucao(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Devolver
                        </button>
                      )}
                      <button onClick={() => handleGerarTermo(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors text-[10px] font-bold uppercase tracking-wider">
                        <Printer className="w-3.5 h-3.5" /> Termo
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredCautelas.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm font-semibold">
                Nenhuma cautela registrada.
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4 font-black">Data/Tipo</th>
                  <th className="px-6 py-4 font-black">Funcionário</th>
                  <th className="px-6 py-4 font-black">Item Entregue</th>
                  <th className="px-6 py-4 font-black text-center">Status</th>
                  <th className="px-6 py-4 font-black text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredCautelas.map(c => {
                  const person = (c.colaborador || c.funcionario) as any
                  const isEpi = c.tipo === 'epi'
                  const isAtivo = c.status === 'ativo'
                  
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-xs font-bold text-foreground">{format(new Date(c.data_entrega), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isEpi ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {isEpi ? <HardHat className="w-2.5 h-2.5" /> : <Wrench className="w-2.5 h-2.5" />}
                          {c.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary overflow-hidden shrink-0">
                            {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : person?.nome?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{person?.nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{c.produto?.nome}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{c.quantidade} {c.produto?.unidade_medida} • CA: {c.produto?.controle_ca ? 'Sim' : 'Não'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                          isAtivo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          c.status === 'devolvido' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-rose-500/10 text-rose-500'
                        }`}>
                          {c.status}
                        </span>
                        {c.data_devolucao_realizada && (
                          <p className="text-[9px] font-bold text-muted-foreground mt-1">
                            {format(new Date(c.data_devolucao_realizada), 'dd/MM/yy')}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAtivo && (
                            <button onClick={() => handleDevolucao(c.id)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="Registrar Devolução">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleGerarTermo(c)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Gerar Termo de Responsabilidade (PDF)">
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredCautelas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm font-semibold">
                      Nenhuma cautela registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova Cautela */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Entrega / Empréstimo"
        subtitle="Vincular EPI ou Ferramenta ao funcionário"
        footer={
          <button
            form="cautela-form"
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-4.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center"
          >
            {createMutation.isPending ? 'Salvando...' : 'Confirmar Entrega'}
          </button>
        }
      >
        <form id="cautela-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Entrega *</label>
            <div className="flex gap-4">
              <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-border/50 cursor-pointer bg-card hover:bg-muted/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10 transition-all">
                <input type="radio" value="epi" {...register('tipo')} className="hidden" />
                <HardHat className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold">EPI</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-border/50 cursor-pointer bg-card hover:bg-muted/50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10 transition-all">
                <input type="radio" value="ferramenta" {...register('tipo')} className="hidden" />
                <Wrench className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold">Ferramenta</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Funcionário *</label>
            <select {...register('funcionario_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
              <option value="">Selecione o colaborador...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.tipo === 'usuario' ? 'Usuário' : 'Funcionário'})
                </option>
              ))}
            </select>
            {errors.funcionario_id && <span className="text-rose-500 text-xs">Obrigatório</span>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produto / Item *</label>
              <select {...register('produto_id', { required: true })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none">
                <option value="">Selecione...</option>
                {filteredProdutosParaCautela.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              {errors.produto_id && <span className="text-rose-500 text-xs">Obrigatório</span>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade *</label>
              <input type="number" step="0.001" {...register('quantidade', { required: true, min: 0.001 })} className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-semibold focus:border-primary outline-none text-center" />
            </div>
          </div>

        </form>
      </Modal>
    </div>
  )
}
