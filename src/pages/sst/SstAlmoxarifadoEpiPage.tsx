import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Check, X, ShieldCheck, Search, Eye, AlertTriangle, Building2, Signature, MapPin, Package, Download, Printer, Calendar } from 'lucide-react'
import { TopHeader } from '../../components/layout/TopHeader'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { useEstoqueLocais, useEstoqueSaldos } from '../../hooks/useEstoque'
import { useSstEpiRequests, useUpdateSstEpiRequestStatus, useDeliverSstEpiRequest, type SstEpiRequest } from '../../hooks/useSstEpi'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'

export function SstAlmoxarifadoEpiPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const currentUserId = user?.profile?.id || ''

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('pendente')
  
  // Modais
  const [selectedRequest, setSelectedRequest] = useState<SstEpiRequest | null>(null)
  const [rejectingRequest, setRejectingRequest] = useState<SstEpiRequest | null>(null)
  const [deliveringRequest, setDeliveringRequest] = useState<SstEpiRequest | null>(null)
  
  // Formulários
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [localOrigemId, setLocalOrigemId] = useState('')
  
  // Assinatura Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  // Hooks
  const { data: requestList = [], isLoading: loadRequests, error: requestError } = useSstEpiRequests()
  const { data: stockLocais = [], isLoading: loadLocais } = useEstoqueLocais()
  const { data: stockSaldos = [], isLoading: loadSaldos } = useEstoqueSaldos()
  const updateRequestStatus = useUpdateSstEpiRequestStatus()
  const deliverRequest = useDeliverSstEpiRequest()

  // Filter requests
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

  // Filter stock for EPIs (EPI category or controle_ca is true)
  const lowStockEpis = useMemo(() => {
    return stockSaldos.filter(saldo => {
      const isEpi = saldo.produto?.controle_ca || saldo.produto?.categoria?.nome?.toLowerCase().includes('epi')
      const isLow = Number(saldo.quantidade) <= Number(saldo.produto?.estoque_minimo || 0)
      return isEpi && isLow
    })
  }, [stockSaldos])

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

  // Actions
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
        return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Aprovada p/ Retirada</span>
      case 'entregue':
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Entregue</span>
      case 'rejeitada':
        return <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">Rejeitada</span>
      default:
        return <span className="bg-muted text-muted-foreground border border-border/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider">{status}</span>
    }
  }

  if (loadRequests || loadLocais || loadSaldos) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Almoxarifado de Segurança" />
        <div className="pt-28 sm:pt-32 pb-20">
          <Loading text="Carregando painel do almoxarifado de EPIs..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Gestão de EPIs" subtitle="Painel de Aprovações e Almoxarifado de Segurança" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">
        {/* Warning Alert for Low Stock EPIs */}
        {lowStockEpis.length > 0 && (
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

        {/* Toolbar & Search */}
        <div className="bg-card/90 dark:bg-card/35 backdrop-blur-2xl border border-border/40 rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 shadow-md mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Buscar solicitações por colaborador ou EPI..."
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
          </div>
        </div>

        {/* Requests Management Cards */}
        <div className="space-y-4">
          {requestError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
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
                    req.status === 'rejeitada' && 'bg-rose-500'
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
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center bg-card/50 backdrop-blur-md rounded-3xl border border-border/25">
              <div className="w-20 h-20 bg-muted/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-muted-foreground/20">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight">Nenhuma solicitação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-2">Não há solicitações pendentes no momento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        open={!!rejectingRequest}
        onClose={() => setRejectingRequest(null)}
        title="Rejeitar Solicitação de EPI"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div className="p-3 bg-muted/20 border border-border/30 rounded-2xl">
            <p className="text-xs text-muted-foreground font-semibold">
              Colaborador: <span className="font-black text-foreground">{rejectingRequest?.funcionario?.nome}</span>
            </p>
            <p className="text-xs text-muted-foreground font-semibold mt-1">
              EPI: <span className="font-black text-foreground">{rejectingRequest?.produto?.nome}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Motivo da Rejeição *</label>
            <textarea
              placeholder="Descreva detalhadamente o motivo pelo qual a solicitação foi rejeitada..."
              value={motivoRejeicao}
              onChange={e => setMotivoRejeicao(e.target.value)}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground h-28 resize-none"
            />
          </div>

          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setRejectingRequest(null)}
              className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest h-12 shadow-lg shadow-rose-600/20"
            >
              Confirmar Rejeição
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delivery Confirmation Modal with Digital Signature */}
      <Modal
        open={!!deliveringRequest}
        onClose={() => {
          setDeliveringRequest(null)
          setLocalOrigemId('')
          setHasSigned(false)
        }}
        title="Confirmar Entrega do EPI"
      >
        <form onSubmit={handleDeliverSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          <div className="p-4 bg-muted/20 border border-border/30 rounded-2xl space-y-2">
            <p className="text-xs text-muted-foreground font-semibold">
              Destinatário: <span className="font-black text-foreground">{deliveringRequest?.funcionario?.nome}</span>
            </p>
            <p className="text-xs text-muted-foreground font-semibold">
              Equipamento: <span className="font-black text-foreground">{deliveringRequest?.produto?.nome}</span>
            </p>
            <p className="text-xs text-muted-foreground font-semibold">
              Quantidade: <span className="font-black text-foreground">{Number(deliveringRequest?.quantidade)}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Almoxarifado / Origem de Estoque *</label>
            <select
              value={localOrigemId}
              onChange={e => setLocalOrigemId(e.target.value)}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
            >
              <option value="">Selecione o local de estoque...</option>
              {stockLocais.map(l => (
                <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>
              ))}
            </select>
          </div>

          {/* Canvas Signature Pad */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-1.5">
                <Signature className="w-3.5 h-3.5 text-primary" /> Assinatura Digital do Colaborador *
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[9px] font-black uppercase text-rose-500 hover:underline"
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

      {/* Details View Modal */}
      <Modal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Detalhes da Solicitação"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status</span>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <hr className="border-border/30" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Destinatário</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedRequest.funcionario?.nome}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">Solicitado por</p>
                  <p className="font-bold text-foreground mt-0.5">{selectedRequest.solicitante?.nome}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-wider">Equipamento</p>
              <div className="p-4 bg-card border border-border/30 rounded-2xl">
                <p className="text-sm font-black text-foreground">{selectedRequest.produto?.nome}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  {selectedRequest.tamanho && <span>Tamanho: <strong>{selectedRequest.tamanho}</strong></span>}
                  <span>Qtd: <strong>{Number(selectedRequest.quantidade)}</strong></span>
                </div>
              </div>
            </div>

            {selectedRequest.justificativa && (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground ml-1 tracking-wider">Justificativa</p>
                <div className="p-3 bg-muted/10 border border-border/20 rounded-xl">
                  <p className="text-xs text-muted-foreground italic">"{selectedRequest.justificativa}"</p>
                </div>
              </div>
            )}

            {selectedRequest.motivo_rejeicao && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                <p className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Justificativa da Rejeição</p>
                <p className="text-xs text-rose-600 font-bold mt-1">"{selectedRequest.motivo_rejeicao}"</p>
              </div>
            )}

            {selectedRequest.aprovador && (
              <div className="p-3 bg-muted/15 border border-border/30 rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">Aprovado por:</span>
                  <span className="text-foreground">{selectedRequest.aprovador.nome}</span>
                </div>
                {selectedRequest.data_aprovacao && (
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    <span>Aprovado em:</span>
                    <span>{format(parseISO(selectedRequest.data_aprovacao), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            )}

            {selectedRequest.entregue_por && (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-emerald-600">Entregue por (Almoxarifado):</span>
                  <span className="text-foreground">{selectedRequest.entregue_por.nome}</span>
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
    </div>
  )
}
