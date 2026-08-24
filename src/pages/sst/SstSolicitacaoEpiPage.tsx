import React, { useState, useMemo, useRef, useEffect } from 'react'
import { 
  Plus, ShieldAlert, ClipboardList, Search, X, Check, Eye, 
  Calendar, AlertTriangle, Signature, Package, ShieldCheck 
} from 'lucide-react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { useFuncionarios } from '../../hooks/useFuncionarios'
import { useEstoqueProdutos, useEstoqueLocais, useEstoqueSaldos } from '../../hooks/useEstoque'
import { 
  useSstEpiRequests, useCreateSstEpiRequest, useUpdateSstEpiRequestStatus, 
  useDeliverSstEpiRequest, type SstEpiRequest 
} from '../../hooks/useSstEpi'
import { format, parseISO } from 'date-fns'
import { cn } from '../../lib/utils'

export function SstSolicitacaoEpiPage() {
  const { toast } = useToast()
  const { user, isAdmin, isDev, hasPermission } = useAuth()
  const currentUserId = user?.profile?.id || ''

  // Checks if the logged-in user is an administrator or safety/warehouse staff
  const isAlmoxarife = useMemo(() => {
    const hasSstRole = user?.roles?.some(r => 
      r.nome.toLowerCase().includes('segurança') || 
      r.nome.toLowerCase().includes('almoxarife') || 
      r.nome.toLowerCase().includes('gerente')
    )
    return isAdmin || isDev || !!hasSstRole || hasPermission('sst_almoxarifado_epi', 'visualizar')
  }, [user, isAdmin, isDev, hasPermission])

  // UI state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SstEpiRequest | null>(null)
  const [rejectingRequest, setRejectingRequest] = useState<SstEpiRequest | null>(null)
  const [deliveringRequest, setDeliveringRequest] = useState<SstEpiRequest | null>(null)

  // Forms state
  const emptyForm = {
    funcionario_id: '',
    produto_id: '',
    quantidade: 1,
    tamanho: '',
    justificativa: ''
  }
  const [formData, setFormData] = useState(emptyForm)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [localOrigemId, setLocalOrigemId] = useState('')

  // Assinatura Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  // Hooks data loading
  const { data: requestList = [], isLoading: loadRequests, error: requestError } = useSstEpiRequests()
  const { data: activeEmployees = [], isLoading: loadEmployees } = useFuncionarios({ status: 'ativo' })
  const { data: allProducts = [], isLoading: loadProducts } = useEstoqueProdutos()
  const { data: stockLocais = [], isLoading: loadLocais } = useEstoqueLocais()
  const { data: stockSaldos = [], isLoading: loadSaldos } = useEstoqueSaldos()

  // Mutations
  const createRequest = useCreateSstEpiRequest()
  const updateRequestStatus = useUpdateSstEpiRequestStatus()
  const deliverRequest = useDeliverSstEpiRequest()

  // Filter only products that are EPIs (typically they have control_ca or category is 'EPI')
  const epiProducts = useMemo(() => {
    return allProducts.filter(p => p.ativo)
  }, [allProducts])

  // Filter stock for EPIs (EPI category or controle_ca is true)
  const lowStockEpis = useMemo(() => {
    return stockSaldos.filter(saldo => {
      const isEpi = saldo.produto?.controle_ca || saldo.produto?.categoria?.nome?.toLowerCase().includes('epi')
      const isLow = Number(saldo.quantidade) <= Number(saldo.produto?.estoque_minimo || 0)
      return isEpi && isLow
    })
  }, [stockSaldos])

  // Filter requests list
  const filteredRequests = useMemo(() => {
    return requestList.filter(req => {
      const funcName = req.funcionario?.nome || ''
      const prodName = req.produto?.nome || ''
      const matchSearch = funcName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          prodName.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchSearch) return false
      if (filterStatus !== 'todos' && req.status !== filterStatus) return false
      return true
    })
  }, [requestList, searchTerm, filterStatus])

  // Stats for cards
  const stats = useMemo(() => {
    const total = requestList.length
    const pending = requestList.filter(r => r.status === 'pendente').length
    const approved = requestList.filter(r => r.status === 'aprovada').length
    const delivered = requestList.filter(r => r.status === 'entregue').length
    return { total, pending, approved, delivered }
  }, [requestList])

  // Setup Canvas drawing events
  useEffect(() => {
    if (deliveringRequest && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
    }
  }, [deliveringRequest])

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    setHasSigned(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  // Create Request Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.funcionario_id || !formData.produto_id || !formData.justificativa) {
      return toast('Preencha os campos obrigatórios', 'warning')
    }
    if (formData.quantidade <= 0) {
      return toast('A quantidade deve ser maior que zero', 'warning')
    }

    try {
      await createRequest.mutateAsync({
        funcionario_id: formData.funcionario_id,
        produto_id: formData.produto_id,
        quantidade: formData.quantidade,
        tamanho: formData.tamanho || null,
        justificativa: formData.justificativa,
        solicitante_id: currentUserId,
        status: 'pendente'
      })
      toast('Solicitação de EPI registrada com sucesso!', 'success')
      setIsModalOpen(false)
      setFormData(emptyForm)
    } catch (err: any) {
      toast('Erro ao registrar solicitação: ' + err.message, 'error')
    }
  }

  // Approve Request Action
  const handleApprove = async (req: SstEpiRequest) => {
    if (!confirm('Deseja aprovar esta solicitação para retirada?')) return
    try {
      await updateRequestStatus.mutateAsync({
        id: req.id,
        status: 'aprovada',
        aprovadorId: currentUserId
      })
      toast('Solicitação aprovada! Aguardando retirada do colaborador.', 'success')
    } catch (err: any) {
      toast('Erro ao aprovar: ' + err.message, 'error')
    }
  }

  // Reject Submit Action
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivoRejeicao.trim()) {
      return toast('Informe a justificativa/motivo da rejeição', 'warning')
    }

    try {
      await updateRequestStatus.mutateAsync({
        id: rejectingRequest!.id,
        status: 'rejeitada',
        motivoRejeicao,
        aprovadorId: currentUserId
      })
      toast('Solicitação rejeitada com sucesso.', 'info')
      setRejectingRequest(null)
      setMotivoRejeicao('')
    } catch (err: any) {
      toast('Erro ao rejeitar: ' + err.message, 'error')
    }
  }

  // Deliver Submit Action
  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!localOrigemId) {
      return toast('Selecione o local de estoque de origem', 'warning')
    }
    if (!hasSigned) {
      return toast('A assinatura digital do colaborador é obrigatória', 'warning')
    }

    // Get Base64 image from canvas signature
    const signatureBase64 = canvasRef.current?.toDataURL('image/png')

    try {
      await deliverRequest.mutateAsync({
        requestId: deliveringRequest!.id,
        localOrigemId,
        entreguePorId: currentUserId,
        assinaturaDigital: signatureBase64,
        usuarioId: currentUserId
      })
      toast('EPI entregue e cautela gerada com assinatura registrada!', 'success')
      setDeliveringRequest(null)
      setLocalOrigemId('')
      setHasSigned(false)
    } catch (err: any) {
      toast('Erro ao processar entrega: ' + err.message, 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Pendente</span>
      case 'aprovada':
        return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Aprovado p/ Retirada</span>
      case 'entregue':
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Entregue</span>
      case 'rejeitada':
        return <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Rejeitada</span>
      case 'cancelada':
        return <span className="bg-gray-500/10 text-gray-500 border border-gray-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Cancelada</span>
      default:
        return <span className="bg-muted text-muted-foreground border border-border/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">{status}</span>
    }
  }

  if (loadRequests || loadEmployees || loadProducts || loadLocais || loadSaldos) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Solicitação de EPI" />
        <div className="pt-28 sm:pt-32 pb-20">
          <Loading text="Carregando painel de controle e solicitações de EPI..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Solicitar Equipamento (EPI)" subtitle="Módulo Unificado de EPI e Almoxarifado de Segurança" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">
        {/* Warning Alert for Low Stock EPIs (Only for safety/almoxarife technicians) */}
        {isAlmoxarife && lowStockEpis.length > 0 && (
          <div className="mb-6 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 dark:border-rose-500/30 rounded-3xl p-4 sm:p-5 flex items-start gap-4 animate-pulse-slow shadow-lg shadow-rose-500/5 backdrop-blur-2xl">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/25 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" /> Alerta de Estoque Crítico
              </h4>
              <p className="text-xs text-muted-foreground/80 mt-1.5 leading-relaxed font-medium">
                Os seguintes Equipamentos de Proteção Individual (EPIs) estão com níveis de estoque iguais ou abaixo do mínimo de segurança configurado:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lowStockEpis.map(saldo => (
                  <span
                    key={saldo.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-inner"
                  >
                    <Package className="w-3.5 h-3.5" />
                    {saldo.produto?.nome} ({saldo.local?.nome}): <strong className="text-rose-600 dark:text-rose-400">{Number(saldo.quantidade)}</strong> {saldo.produto?.unidade_medida}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KPI / Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8 animate-fade-in">
          {[
            { label: 'Total Solicitado', value: stats.total, icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Aguardando Aprovação', value: stats.pending, icon: ShieldAlert, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Aprovados p/ Retirada', value: stats.approved, icon: Check, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
            { label: 'EPIs Entregues', value: stats.delivered, icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          ].map(s => (
            <div key={s.label} className="bg-card/90 dark:bg-card/35 backdrop-blur-2xl border border-border/40 hover:border-primary/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-lg hover:translate-y-[-3px] transition-all duration-300">
              <div className="flex items-center justify-between mb-3.5">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border", s.bg)}>
                  <s.icon className={cn("w-5 h-5", s.color)} />
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-primary/20 dark:bg-primary/40 animate-pulse" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{s.value}</p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground/50 tracking-wider mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar & Search */}
        <div className="bg-card/90 dark:bg-card/35 backdrop-blur-2xl border border-border/40 rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 shadow-md mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Buscar por colaborador ou EPI..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-muted/40 border border-transparent focus:border-primary/25 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-foreground focus:bg-card shadow-inner"
              />
            </div>
            <div className="flex bg-muted/65 dark:bg-muted/20 border border-border/20 rounded-xl sm:rounded-2xl p-1 flex-wrap justify-center w-full lg:w-auto">
              {['todos', 'pendente', 'aprovada', 'entregue', 'rejeitada'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all duration-200 cursor-pointer",
                    filterStatus === status ? "bg-card text-primary shadow-md border border-border/10" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status === 'todos' ? 'Todos' : status === 'aprovada' ? 'Aprovados' : status}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                setFormData(emptyForm)
                setIsModalOpen(true)
              }}
              className="w-full lg:w-auto rounded-xl sm:rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest px-7 h-12 bg-gradient-to-r from-primary to-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/35 hover:scale-[1.02] transition-all flex-shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" /> Solicitar EPI
            </Button>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {requestError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Erro de Banco de Dados: {(requestError as any).message}. Certifique-se de aplicar a migração SQL no seu painel do Supabase.</span>
            </div>
          )}

          {filteredRequests.length > 0 ? (
            filteredRequests.map(req => (
              <div
                key={req.id}
                className="group bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 hover:border-border/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
              >
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl",
                    req.status === 'pendente' && 'bg-amber-500',
                    req.status === 'aprovada' && 'bg-blue-500',
                    req.status === 'entregue' && 'bg-emerald-500',
                    req.status === 'rejeitada' && 'bg-rose-500',
                    req.status === 'cancelada' && 'bg-gray-400'
                  )}
                />

                <div className="flex flex-col gap-3.5 pl-2 sm:pl-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-border/10 pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/25 text-primary flex items-center justify-center font-black text-sm shadow-inner shrink-0">
                        {req.funcionario?.nome?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0">
                        <h4 
                          className="text-xs sm:text-sm font-black text-foreground break-words line-clamp-2 tracking-tight"
                          title={req.funcionario?.nome}
                        >
                          {req.funcionario?.nome || 'N/D'}
                        </h4>
                        <span className="text-[9px] text-muted-foreground/60 flex items-center gap-1 mt-0.5 font-bold">
                          <Calendar className="w-3 h-3 shrink-0 text-muted-foreground/40" />
                          {format(parseISO(req.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Body info grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-muted/10 p-2.5 rounded-xl border border-border/10">
                      <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider block">Equipamento (EPI)</span>
                      <span className="font-bold text-foreground truncate block mt-0.5">{req.produto?.nome || 'N/D'}</span>
                    </div>
                    <div className="bg-muted/10 p-2.5 rounded-xl border border-border/10 flex justify-between gap-2 items-center">
                      <div>
                        <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider block">Qtd</span>
                        <span className="font-extrabold text-foreground block mt-0.5">{Number(req.quantidade)}</span>
                      </div>
                      {req.tamanho && (
                        <div className="border-l border-border/20 pl-4 text-right">
                          <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider block">Tamanho</span>
                          <span className="font-extrabold text-primary block mt-0.5">{req.tamanho}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {req.justificativa && (
                    <div className="p-3 bg-muted/5 rounded-xl border border-border/5 text-[10px] text-muted-foreground/80 font-medium italic">
                      "Solicitação: {req.justificativa}"
                    </div>
                  )}

                  {/* Actions Column */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/10">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="h-9 px-3 rounded-xl bg-muted/40 text-[9px] font-black uppercase tracking-wider text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1.5 hover:border-primary/20 border border-transparent shrink-0 cursor-pointer active:scale-95"
                      title="Ver Detalhes"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detalhes
                    </button>

                    {/* Operational controls for Admins / Safety Staff */}
                    {isAlmoxarife && (
                      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap w-full sm:w-auto">
                        {req.status === 'pendente' && (
                          <>
                            <button
                              onClick={() => handleApprove(req)}
                              className="flex-1 sm:flex-initial justify-center px-3.5 h-9 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md shadow-blue-600/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprovar
                            </button>
                            <button
                              onClick={() => setRejectingRequest(req)}
                              className="flex-1 sm:flex-initial justify-center px-3.5 h-9 rounded-xl bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" /> Rejeitar
                            </button>
                          </>
                        )}

                        {(req.status === 'aprovada' || req.status === 'pendente') && (
                          <button
                            onClick={() => setDeliveringRequest(req)}
                            className="flex-1 sm:flex-initial justify-center px-4 h-9 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-600/15 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Entregar EPI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center bg-card/50 backdrop-blur-md rounded-3xl border border-border/25">
              <div className="w-20 h-20 bg-muted/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-muted-foreground/20">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight">Nenhuma solicitação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-2">Clique em "Solicitar EPI" para registrar uma nova.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Detalhes da Solicitação de EPI"
      >
        {selectedRequest && (
          <div className="space-y-5">
            <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status da Solicitação</span>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <hr className="border-border/30" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Colaborador</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedRequest.funcionario?.nome || 'N/D'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Solicitado por</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedRequest.solicitante?.nome || 'N/D'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground ml-1">Dados do Equipamento</h4>
              <div className="p-4 bg-card border border-border/30 rounded-2xl space-y-2">
                <p className="text-sm font-black text-foreground">{selectedRequest.produto?.nome}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {selectedRequest.produto?.codigo_interno && (
                    <span>Cód: <strong>{selectedRequest.produto.codigo_interno}</strong></span>
                  )}
                  {selectedRequest.tamanho && (
                    <span>Tamanho: <strong>{selectedRequest.tamanho}</strong></span>
                  )}
                  <span>Quantidade: <strong>{Number(selectedRequest.quantidade)}</strong></span>
                </div>
                {selectedRequest.produto?.controle_ca && (
                  <span className="inline-block bg-blue-500/10 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full mt-2 uppercase tracking-wider">Certificado CA Obrigatório</span>
                )}
              </div>
            </div>

            {selectedRequest.justificativa && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-black uppercase text-muted-foreground ml-1 tracking-wider">Justificativa do Pedido</span>
                <div className="p-3 bg-muted/10 border border-border/20 rounded-xl">
                  <p className="text-xs text-muted-foreground italic font-medium">"{selectedRequest.justificativa}"</p>
                </div>
              </div>
            )}

            {selectedRequest.motivo_rejeicao && (
              <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1">
                <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Motivo da Rejeição</span>
                <p className="text-xs text-rose-600 font-bold">"{selectedRequest.motivo_rejeicao}"</p>
              </div>
            )}

            {selectedRequest.aprovador && (
              <div className="p-3.5 bg-muted/15 border border-border/30 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-muted-foreground">Aprovado por:</span>
                  <span className="font-bold text-foreground">{selectedRequest.aprovador.nome}</span>
                </div>
                {selectedRequest.data_aprovacao && (
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    <span>Data da Aprovação:</span>
                    <span>{format(parseISO(selectedRequest.data_aprovacao), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            )}

            {selectedRequest.entregue_por && (
              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-600">Entregue por (Almoxarifado):</span>
                  <span className="font-black text-foreground">{selectedRequest.entregue_por.nome}</span>
                </div>
                {selectedRequest.data_entrega && (
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    <span>Data da Entrega:</span>
                    <span>{format(parseISO(selectedRequest.data_entrega), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex">
              <Button
                variant="ghost"
                onClick={() => setSelectedRequest(null)}
                className="w-full rounded-2xl font-black text-[10px] uppercase tracking-widest h-12"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Request Form Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Solicitar Equipamento de Proteção (EPI)"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Colaborador Destinatário *</label>
            <select
              value={formData.funcionario_id}
              onChange={e => setFormData({ ...formData, funcionario_id: e.target.value })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
            >
              <option value="">Selecione o colaborador...</option>
              {activeEmployees.map(f => (
                <option key={f.id} value={f.id}>{f.nome} — {f.setor}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Equipamento (EPI) *</label>
            <select
              value={formData.produto_id}
              onChange={e => setFormData({ ...formData, produto_id: e.target.value })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
            >
              <option value="">Selecione o EPI...</option>
              {epiProducts.map(p => (
                <option key={p.id} value={p.id}>{p.nome} {p.marca ? `— ${p.marca}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Quantidade *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.quantidade}
                onChange={e => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Tamanho</label>
              <input
                type="text"
                placeholder="Ex: G, 41, M"
                value={formData.tamanho}
                onChange={e => setFormData({ ...formData, tamanho: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Justificativa do Pedido *</label>
            <textarea
              placeholder="Descreva o motivo (Ex: desgaste natural, novo funcionário, danificado em serviço)..."
              value={formData.justificativa}
              onChange={e => setFormData({ ...formData, justificativa: e.target.value })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground h-24 resize-none"
            />
          </div>

          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest h-12 shadow-lg shadow-primary/20"
            >
              Registrar Pedido
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectingRequest}
        onClose={() => setRejectingRequest(null)}
        title="Rejeitar Solicitação de EPI"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Motivo da Rejeição *</label>
            <textarea
              placeholder="Informe o motivo da rejeição deste equipamento de proteção..."
              value={motivoRejeicao}
              onChange={e => setMotivoRejeicao(e.target.value)}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground h-24 resize-none"
              required
            />
          </div>
          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setRejectingRequest(null)
                setMotivoRejeicao('')
              }}
              className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest h-12 shadow-lg shadow-rose-600/20"
            >
              Rejeitar Solicitação
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deliver Modal */}
      <Modal
        open={!!deliveringRequest}
        onClose={() => setDeliveringRequest(null)}
        title="Registrar Entrega de EPI e Gerar Cautela"
      >
        <form onSubmit={handleDeliverSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Origem do Estoque *</label>
            <select
              value={localOrigemId}
              onChange={e => setLocalOrigemId(e.target.value)}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
              required
            >
              <option value="">Selecione o local de estoque...</option>
              {stockLocais.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                <Signature className="w-3.5 h-3.5 text-primary" /> Assinatura Digital do Recebedor *
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[9px] font-black uppercase tracking-wider text-rose-500 hover:underline cursor-pointer"
              >
                Limpar
              </button>
            </div>

            <div className="relative border-2 border-dashed border-border/60 bg-white rounded-2xl overflow-hidden shadow-inner flex items-center justify-center h-48 cursor-crosshair">
              <canvas
                ref={canvasRef}
                width={450}
                height={190}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full block bg-transparent"
              />
              {!hasSigned && (
                <p className="absolute text-center text-xs text-muted-foreground/30 pointer-events-none font-bold uppercase tracking-wider">
                  Assine aqui usando o mouse ou touch
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setDeliveringRequest(null)
                setLocalOrigemId('')
                setHasSigned(false)
              }}
              className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-12 shadow-lg shadow-emerald-600/20"
            >
              Confirmar e Gerar Cautela
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
