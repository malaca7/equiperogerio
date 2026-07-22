import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import {
  ScanBarcode, Search, Package, User, Check, ChevronRight, RotateCcw,
  X, AlertTriangle, Clock, Hash, Minus, Plus, ArrowRight, Layers, ArrowRightLeft,
  Barcode
} from 'lucide-react'
import { useEstoqueProdutos, useEstoqueSaldos, useEstoqueLocais, useCreateEstoqueMovimentacao } from '../../hooks/useEstoque'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'
import { format } from 'date-fns'
import type { EstoqueProduto } from '../../types/estoque.types'

type Step = 'scan' | 'qty' | 'employee' | 'confirm'

interface RetiradaItem {
  produto: EstoqueProduto
  quantidade: number
  saldoAtual: number
  funcionarioId?: string
  funcionarioNome?: string
  localOrigemId?: string
  destinatarioTipo?: 'funcionario' | 'usuario'
}

export function EstoqueRetiradaRapidaPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: produtos = [], isLoading: loadP } = useEstoqueProdutos()
  const { data: saldos = [] } = useEstoqueSaldos()
  const { data: locais = [] } = useEstoqueLocais()
  const createMov = useCreateEstoqueMovimentacao()

  const { data: destinatarios = [], isLoading: loadDest } = useQuery({
    queryKey: ['destinatarios-retirada-unificada'],
    queryFn: async () => {
      const { data: profilesData } = await supabase.from('profiles').select('id, nome, avatar_url').order('nome')
      const { data: funcData } = await supabase.from('funcionarios').select('id, nome, matricula, cpf').is('deleted_at', null).eq('status', 'ativo').order('nome')

      const unified: { id: string; nome: string; avatar_url?: string; matricula?: string; cpf?: string; tipo: 'funcionario' | 'usuario' }[] = []
      if (profilesData) profilesData.forEach(p => unified.push({ id: p.id, nome: p.nome, avatar_url: p.avatar_url || undefined, tipo: 'usuario' }))
      if (funcData) funcData.forEach(f => unified.push({ id: f.id, nome: f.nome, matricula: f.matricula || undefined, cpf: f.cpf || undefined, tipo: 'funcionario' }))
      return unified.sort((a, b) => a.nome.localeCompare(b.nome))
    }
  })

  const [step, setStep] = useState<Step>('scan')
  const [searchTerm, setSearchTerm] = useState('')
  const [funcSearch, setFuncSearch] = useState('')
  const [item, setItem] = useState<RetiradaItem | null>(null)
  const [historico, setHistorico] = useState<{ nome: string; qtd: number; func: string; hora: string }[]>([])

  const searchRef = useRef<HTMLInputElement>(null)
  const funcSearchRef = useRef<HTMLInputElement>(null)

  const saldoPorProduto = useMemo(() => {
    return saldos.reduce((acc, s) => {
      acc[s.produto_id] = (acc[s.produto_id] || 0) + s.quantidade
      return acc
    }, {} as Record<string, number>)
  }, [saldos])

  const produtosFiltrados = useMemo(() => {
    // Filtro: Apenas consumíveis (exclui EPIs e Ferramentas)
    const consumiveis = produtos.filter(p => {
      const isEpi = p.tipo_material === 'epi' || p.controle_ca || p.categoria?.nome?.toLowerCase() === 'epis'
      const isFerramenta = p.tipo_material === 'ferramenta' || p.categoria?.nome?.toLowerCase() === 'ferramentas'
      return !isEpi && !isFerramenta
    })

    if (!searchTerm) return consumiveis.slice(0, 20)
    const term = searchTerm.toLowerCase().trim()
    return consumiveis.filter(p =>
      p.nome.toLowerCase().includes(term) ||
      (p.codigo_interno && p.codigo_interno.toLowerCase().includes(term)) ||
      (p.codigo_barras && p.codigo_barras.includes(term)) ||
      (p.qrcode && p.qrcode.includes(term))
    ).slice(0, 20)
  }, [produtos, searchTerm])

  const funcFiltrados = useMemo(() => {
    if (!funcSearch) return destinatarios
    const term = funcSearch.toLowerCase()
    return destinatarios.filter(f => 
      f.nome.toLowerCase().includes(term) || 
      (f.matricula && f.matricula.toLowerCase().includes(term)) ||
      (f.cpf && f.cpf.includes(term))
    )
  }, [destinatarios, funcSearch])

  const handleSelectProduto = useCallback((p: EstoqueProduto) => {
    const saldo = saldoPorProduto[p.id] || 0
    const localComSaldo = saldos.find(s => s.produto_id === p.id && s.quantidade > 0)
    setItem({ produto: p, quantidade: 1, saldoAtual: saldo, localOrigemId: localComSaldo?.local_id || locais[0]?.id })
    setSearchTerm('')
    setStep('qty')
    if (navigator.vibrate) navigator.vibrate(50)
  }, [saldoPorProduto, saldos, locais])

  const handleSelectFunc = useCallback((f: { id: string; nome: string; tipo: 'funcionario' | 'usuario' }) => {
    setItem(prev => prev ? { ...prev, funcionarioId: f.id, funcionarioNome: f.nome, destinatarioTipo: f.tipo } : null)
    setFuncSearch('')
    setStep('confirm')
    if (navigator.vibrate) navigator.vibrate(50)
  }, [])

  const handleConfirmar = async () => {
    if (!item || !user) return
    if (item.quantidade > item.saldoAtual) return toast('Saldo insuficiente no local selecionado!', 'error')
    try {
      await createMov.mutateAsync({
        tipo: 'saida',
        subtipo: 'retirada_rapida',
        produto_id: item.produto.id,
        local_origem_id: item.localOrigemId,
        quantidade: item.quantidade,
        funcionario_id: item.destinatarioTipo === 'funcionario' ? item.funcionarioId : undefined,
        usuario_id: user.profile.id,
        observacao: `Retirada rápida — Destinatário (${item.destinatarioTipo === 'usuario' ? 'Usuário' : 'Colaborador'}): ${item.funcionarioNome || 'sem destinatário'}`,
        data_movimentacao: new Date().toISOString(),
        status_aprovacao: 'aprovado'
      })

      setHistorico(prev => [{ nome: item.produto.nome, qtd: item.quantidade, func: item.funcionarioNome || '—', hora: format(new Date(), 'HH:mm') }, ...prev].slice(0, 10))
      toast('Retirada registrada com sucesso!', 'success')
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
      setItem(null)
      setStep('scan')
      setTimeout(() => searchRef.current?.focus(), 200)
    } catch (e: any) {
      toast(e.message || 'Erro ao registrar retirada', 'error')
    }
  }

  const handleRepetir = () => {
    if (historico.length === 0) return
    const prod = produtos.find(p => p.nome === historico[0].nome)
    if (prod) handleSelectProduto(prod)
  }

  useEffect(() => {
    if (step === 'scan') searchRef.current?.focus()
    if (step === 'employee') funcSearchRef.current?.focus()
  }, [step])

  if (loadP || loadDest) return (
    <div className="min-h-screen bg-background"><TopHeader title="Retirada Rápida" /><div className="pt-28 sm:pt-32"><Loading text="Iniciando módulo corporativo..." /></div></div>
  )

  const stepsList: Step[] = ['scan', 'qty', 'employee', 'confirm']
  const currentStepIndex = stepsList.indexOf(step)

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Retirada Expresso" subtitle="Gestão Dinâmica de Almoxarifado" />

      <div className="max-w-3xl mx-auto px-4 pt-28 sm:pt-32 pb-32">
        
        {/* Modern Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-2">
            {['Localizar', 'Quantidade', 'Destinatário', 'Confirmar'].map((label, idx) => {
              const isActive = idx === currentStepIndex
              const isPast = idx < currentStepIndex
              return (
                <div key={label} className={cn("text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-300", isActive ? "text-primary" : isPast ? "text-emerald-500" : "text-muted-foreground/40")}>
                  {label}
                </div>
              )
            })}
          </div>
          <div className="relative h-2 bg-muted/40 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStepIndex + 1) / stepsList.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Dynamic Card Container */}
        <div className="relative bg-card/60 backdrop-blur-2xl border border-border/60 shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary opacity-50" />

          {/* STEP 1: SCAN */}
          {step === 'scan' && (
            <div className="p-6 sm:p-10 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none mb-2">Qual item será retirado?</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Utilize o leitor de código de barras ou busque pelo nome.</p>
                </div>
                <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                  <ScanBarcode className="w-8 h-8" />
                </div>
              </div>

              <div className="relative mb-8 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Escaneie o código ou digite o nome..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && produtosFiltrados.length > 0) {
                      e.preventDefault();
                      handleSelectProduto(produtosFiltrados[0]);
                    }
                  }}
                  className="w-full pl-14 pr-6 py-5 bg-background/50 border-2 border-border/50 focus:border-primary/50 focus:bg-background rounded-[1.75rem] text-lg font-bold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all shadow-sm"
                  autoComplete="off"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none hidden sm:flex">
                  <span className="text-[10px] font-black uppercase text-muted-foreground/50 bg-muted/50 px-2 py-1 rounded-lg">Auto-Select via Leitor</span>
                </div>
              </div>

              {produtosFiltrados.length > 0 ? (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {produtosFiltrados.map(p => {
                    const saldo = saldoPorProduto[p.id] || 0
                    const isCritico = saldo <= p.estoque_minimo
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduto(p)}
                        className="w-full group flex items-center gap-4 p-4 rounded-[1.5rem] bg-muted/20 border border-border/40 hover:bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 active:scale-[0.98] text-left"
                      >
                        <div className={cn("w-14 h-14 rounded-[1.25rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", isCritico ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary")}>
                          <Package className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-black text-foreground truncate group-hover:text-primary transition-colors">{p.nome}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                              <Barcode className="w-3.5 h-3.5" /> {p.codigo_interno || 'Sem Código'}
                            </span>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{p.categoria?.nome || 'Geral'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-xl font-black", isCritico ? "text-rose-500" : "text-emerald-500")}>{saldo} <span className="text-xs font-bold text-muted-foreground uppercase">{p.unidade_medida}</span></p>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Disponível</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                searchTerm.length >= 2 && (
                  <div className="text-center py-12 px-4 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
                    <AlertTriangle className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
                    <p className="text-lg font-black text-foreground mb-1">Item não localizado</p>
                    <p className="text-sm text-muted-foreground font-semibold">Revise a digitação ou certifique-se de que o código está correto.</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* STEP 2: QUANTITY */}
          {step === 'qty' && item && (
            <div className="p-6 sm:p-10 animate-fade-in">
              <div className="flex items-start gap-4 mb-8 p-4 bg-muted/30 rounded-[1.5rem] border border-border/50">
                <div className="w-12 h-12 rounded-[1rem] bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-foreground leading-tight">{item.produto.nome}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                      Cód: {item.produto.codigo_interno || 'N/A'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Saldo: {item.saldoAtual} {item.produto.unidade_medida}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block">Local de Retirada</label>
                  <div className="relative">
                    <select
                      value={item.localOrigemId || ''}
                      onChange={e => {
                        const newLocalId = e.target.value
                        const newSaldo = saldos.find(s => s.produto_id === item.produto.id && s.local_id === newLocalId)?.quantidade || 0
                        setItem({ ...item, localOrigemId: newLocalId, saldoAtual: newSaldo })
                      }}
                      className="w-full pl-5 pr-12 py-4 bg-background/50 border-2 border-border/50 rounded-[1.25rem] text-sm font-bold text-foreground outline-none focus:border-primary appearance-none transition-colors"
                    >
                      {locais.filter(l => l.ativo).map(l => {
                        const saldoLocal = saldos.find(s => s.produto_id === item.produto.id && s.local_id === l.id)
                        return <option key={l.id} value={l.id}>{l.nome} ({saldoLocal?.quantidade || 0} disp.)</option>
                      })}
                    </select>
                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block text-center sm:text-left">Quantidade a Retirar</label>
                  <div className="flex items-center justify-center sm:justify-start gap-4">
                    <button
                      onClick={() => setItem({ ...item, quantidade: Math.max(1, item.quantidade - 1) })}
                      className="w-14 h-14 rounded-[1.25rem] bg-muted/40 border border-border/50 flex items-center justify-center text-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all active:scale-90 shrink-0"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <div className="w-24 h-14 rounded-[1.25rem] bg-background border-2 border-primary/30 flex items-center justify-center shadow-inner shrink-0">
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={e => setItem({ ...item, quantidade: Math.max(1, Number(e.target.value)) })}
                        className="w-full text-center text-2xl font-black text-foreground bg-transparent outline-none p-0 border-none focus:ring-0"
                      />
                    </div>
                    <button
                      onClick={() => setItem({ ...item, quantidade: item.quantidade + 1 })}
                      className="w-14 h-14 rounded-[1.25rem] bg-muted/40 border border-border/50 flex items-center justify-center text-foreground hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-90 shrink-0"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex gap-2 justify-center sm:justify-start pt-2">
                    {[1, 5, 10, 50].map(n => (
                      <button
                        key={n}
                        onClick={() => setItem({ ...item, quantidade: n })}
                        className={cn(
                          "flex-1 max-w-[4rem] py-2 rounded-xl text-xs font-black transition-all active:scale-95",
                          item.quantidade === n ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/40 text-foreground hover:bg-muted"
                        )}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {item.quantidade > item.saldoAtual && (
                <div className="flex items-center gap-3 p-4 mb-8 rounded-[1.25rem] bg-rose-500/10 border border-rose-500/20 text-rose-600 animate-pulse">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-black">Atenção: Estoque insuficiente.</p>
                    <p className="text-xs font-semibold opacity-80">A quantidade solicitada excede o saldo disponível neste local.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => { setStep('scan'); setItem(null) }} className="px-8 py-4 rounded-[1.25rem] text-sm font-bold text-muted-foreground hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all active:scale-95">
                  Voltar
                </button>
                <button 
                  onClick={() => setStep('employee')} 
                  disabled={item.quantidade > item.saldoAtual}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.25rem] text-sm font-black text-white bg-primary hover:bg-primary/90 transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(var(--primary),0.3)] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed group"
                >
                  Continuar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: EMPLOYEE */}
          {step === 'employee' && item && (
            <div className="p-6 sm:p-10 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none mb-2">Quem vai receber?</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Busque o colaborador pelo nome, matrícula ou CPF.</p>
                </div>
                <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 shadow-inner">
                  <User className="w-8 h-8" />
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground transition-colors" />
                <input
                  ref={funcSearchRef}
                  type="text"
                  placeholder="Nome, Matrícula ou CPF..."
                  value={funcSearch}
                  onChange={e => setFuncSearch(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-background/50 border-2 border-border/50 focus:border-emerald-500/50 focus:bg-background rounded-[1.75rem] text-lg font-bold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all shadow-sm"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar mb-8">
                {funcFiltrados.map(f => (
                  <button
                    key={`${f.tipo}-${f.id}`}
                    onClick={() => handleSelectFunc(f)}
                    className="w-full group flex items-center gap-4 p-4 rounded-[1.5rem] bg-muted/20 border border-border/40 hover:bg-card hover:border-emerald-500/40 hover:shadow-lg transition-all duration-300 active:scale-[0.98] text-left"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 text-base font-black transition-transform group-hover:scale-110",
                      f.tipo === 'usuario' ? "bg-indigo-500/10 text-indigo-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {f.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black text-foreground truncate group-hover:text-emerald-500 transition-colors">{f.nome}</p>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider shrink-0",
                          f.tipo === 'usuario' ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        )}>
                          {f.tipo === 'usuario' ? 'Usuário' : 'Colaborador'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {f.matricula && <span className="text-[10px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/40">MAT: {f.matricula}</span>}
                        {f.cpf && <span className="text-[10px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/40">CPF: {f.cpf}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))}
                {funcFiltrados.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm font-bold text-muted-foreground">Nenhum colaborador encontrado.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setStep('qty')} className="w-full sm:w-auto px-8 py-4 rounded-[1.25rem] text-sm font-bold text-muted-foreground hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all active:scale-95">
                  Voltar
                </button>
                <button
                  onClick={() => { setItem({ ...item, funcionarioNome: 'Uso Geral / Sem Vínculo' }); setStep('confirm') }}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.25rem] text-sm font-bold text-muted-foreground border-2 border-dashed border-border/60 hover:bg-muted/30 hover:text-foreground hover:border-foreground/30 transition-all active:scale-[0.98]"
                >
                  Pular (Não Vincular Ninguém)
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRM */}
          {step === 'confirm' && item && (
            <div className="p-6 sm:p-10 animate-fade-in text-center">
              <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6 shadow-inner">
                <Check className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-foreground tracking-tight mb-2">Resumo da Retirada</h2>
              <p className="text-sm text-muted-foreground font-semibold mb-10">Confirme os dados da operação corporativa abaixo.</p>

              <div className="bg-background rounded-[1.5rem] border border-border/60 p-6 text-left max-w-md mx-auto space-y-4 shadow-sm mb-10">
                <div className="flex justify-between items-end pb-4 border-b border-border/40">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Produto</span>
                    <span className="text-base font-black text-foreground">{item.produto.nome}</span>
                  </div>
                  <span className="text-2xl font-black text-primary">-{item.quantidade} <span className="text-xs text-muted-foreground">{item.produto.unidade_medida}</span></span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Localização</span>
                    <span className="text-xs font-bold text-foreground">{locais.find(l => l.id === item.localOrigemId)?.nome || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Código</span>
                    <span className="text-xs font-bold text-foreground">{item.produto.codigo_interno || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border/40">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Destinatário</span>
                    <span className="text-sm font-black text-emerald-500">{item.funcionarioNome}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 max-w-md mx-auto">
                <button onClick={() => setStep('employee')} className="px-8 py-4 rounded-[1.25rem] text-sm font-bold text-muted-foreground hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all active:scale-95">
                  Revisar
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={createMov.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.25rem] text-base font-black text-white bg-primary hover:bg-primary/90 transition-all active:scale-[0.98] shadow-[0_0_40px_rgba(var(--primary),0.4)] disabled:opacity-50"
                >
                  {createMov.isPending ? 'Processando...' : 'Confirmar Retirada'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Panel / History Feed */}
        {historico.length > 0 && step === 'scan' && (
          <div className="mt-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Últimas Retiradas</h3>
              <button onClick={handleRepetir} className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Repetir Última
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {historico.slice(0, 4).map((h, i) => (
                <div key={i} className="flex items-center p-4 rounded-[1.5rem] bg-card/40 border border-border/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-[1rem] bg-primary/10 flex items-center justify-center text-primary shrink-0 mr-4">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{h.nome}</p>
                    <p className="text-[10px] font-bold text-muted-foreground truncate">{h.func}</p>
                  </div>
                  <div className="text-right pl-3 border-l border-border/40">
                    <p className="text-lg font-black text-foreground">-{h.qtd}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{h.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
