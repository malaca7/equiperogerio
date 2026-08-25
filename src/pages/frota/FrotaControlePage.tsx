import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useRegistrosDiarios, useUpsertRegistroDiario, useDeleteRegistroDiario } from '../../hooks/useFrota'
import { useAdminUsers } from '../../hooks/useUsers'
import { useAuth } from '../../contexts/AuthContext'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useUserTeam } from '../../hooks/useUserTeam'
import { useFuncionarios } from '../../hooks/useFuncionarios'
import { 
  Search, 
  Activity, 
  Calendar as CalendarIcon, 
  Edit, 
  Camera, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Navigation, 
  User,
  Trash2,
  MapPin,
  Clock,
  Car
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'

export function FrotaControlePage() {
  const { user, hasPermission } = useAuth()
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(undefined, true) // Fetch all vehicles
  const { data: registros = [], isLoading: loadR } = useRegistrosDiarios()
  const { data: users = [], isLoading: loadU } = useAdminUsers()
  const { toast } = useToast()
  
  const upsertMutation = useUpsertRegistroDiario()
  const deleteMutation = useDeleteRegistroDiario()

  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  
  const [formData, setFormData] = useState<any>({
    veiculo_id: '',
    usuario_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    km_inicial: '',
    km_final: '',
    trajeto: '',
    observacoes: '',
    foto_hodometro: null,
    foto_hodometro_inicial: null
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingInicial, setIsUploadingInicial] = useState(false)
  const [tipoRegistro, setTipoRegistro] = useState<'saida'|'chegada'|'ambos'>('saida')
  const [isEditMode, setIsEditMode] = useState(false)
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState<string | null>(null)
  const [selectedRegistroDetails, setSelectedRegistroDetails] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'painel'|'historico'>('painel')

  const { data: teamInfo } = useUserTeam()
  const { data: physicalFuncs = [] } = useFuncionarios()

  const { data: allAutorizacoes = [] } = useQuery<any[]>({
    queryKey: ['frota_all_veiculo_autorizacoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('frota_veiculos_autorizados').select('*')
      if (error) throw error
      return data || []
    }
  })

  const isEncarregado = React.useMemo(() => {
    return teamInfo?.isRestricted && (teamInfo?.teamIds?.length > 0 || teamInfo?.teamMemberIds?.length > 0)
  }, [teamInfo])

  const canManage = React.useMemo(() => {
    return hasPermission('frota_registros', 'gerenciar') || user?.isAdmin || !!isEncarregado
  }, [hasPermission, user, isEncarregado])

  // Match physical team members to system user profiles
  const myTeamFuncs = React.useMemo(() => {
    if (!teamInfo?.isRestricted) return []
    return physicalFuncs.filter(f => teamInfo.teamMemberIds.includes(f.id))
  }, [physicalFuncs, teamInfo])

  const myTeamCpfs = React.useMemo(() => new Set(myTeamFuncs.map(f => f.cpf).filter(Boolean)), [myTeamFuncs])
  const myTeamNames = React.useMemo(() => new Set(myTeamFuncs.map(f => f.nome.toLowerCase())), [myTeamFuncs])

  const allowedDrivers = React.useMemo(() => {
    return users.filter(u => {
      if (!teamInfo?.isRestricted) return true
      return (u.cpf && myTeamCpfs.has(u.cpf)) || myTeamNames.has(u.nome.toLowerCase())
    })
  }, [users, teamInfo, myTeamCpfs, myTeamNames])

  const allowedDriverIds = React.useMemo(() => new Set(allowedDrivers.map(u => u.id)), [allowedDrivers])

  // Filter registros to only show those of allowed drivers
  const visibleRegistros = React.useMemo(() => {
    return registros.filter(r => {
      if (teamInfo?.isRestricted) {
        return allowedDriverIds.has(r.usuario_id)
      }
      return true
    })
  }, [registros, teamInfo, allowedDriverIds])

  // Calculate metrics based on visible records
  const emTransitoCount = visibleRegistros.filter(r => !r.km_final).length
  const viagensHoje = visibleRegistros.filter(r => r.data === format(new Date(), 'yyyy-MM-dd')).length
  const kmTotalRodado = visibleRegistros.reduce((sum, r) => {
    if (r.km_final && r.km_inicial) {
      return sum + (r.km_final - r.km_inicial)
    }
    return sum
  }, 0)

  // Filter records based on visibleRecords and search term
  const filtered = visibleRegistros.filter(r => {
    const v = veiculos.find(v => v.id === r.veiculo_id)
    const u = users.find(u => u.id === r.usuario_id)
    if (!v) return false
    
    const searchLower = searchTerm.toLowerCase()
    return v.placa.toLowerCase().includes(searchLower) || 
           v.modelo.toLowerCase().includes(searchLower) ||
           (u?.nome || '').toLowerCase().includes(searchLower) ||
           (r.trajeto || '').toLowerCase().includes(searchLower) ||
           format(parseISO(r.data), 'dd/MM/yyyy').includes(searchTerm)
  }).sort((a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime())

  const openSaida = () => {
    setTipoRegistro('saida')
    setIsEditMode(false)
    const initialDriver = allowedDrivers[0]?.id || ''
    const driverAuthVehicles = veiculos.filter(v => 
      allAutorizacoes.some(a => a.usuario_id === initialDriver && a.veiculo_id === v.id)
    )
    const myVehicle = driverAuthVehicles.find(v => v.usuario_responsavel_id === initialDriver) || driverAuthVehicles[0]

    setFormData({
      veiculo_id: myVehicle?.id || '',
      usuario_id: initialDriver,
      data: format(new Date(), 'yyyy-MM-dd'),
      km_inicial: myVehicle?.km_atual || '',
      km_final: '',
      trajeto: '',
      observacoes: '',
      foto_hodometro: null,
      foto_hodometro_inicial: null
    })
    setModalOpen(true)
  }

  const openEntrada = () => {
    setTipoRegistro('chegada')
    setIsEditMode(false)
    const firstPending = visibleRegistros.find(r => !r.km_final)
    const matchingVeiculo = veiculos.find(v => v.id === firstPending?.veiculo_id)
    
    setFormData({
      id: firstPending?.id || '',
      veiculo_id: firstPending?.veiculo_id || veiculos.filter(v => v.status === 'ativo')[0]?.id || '',
      usuario_id: firstPending?.usuario_id || allowedDrivers[0]?.id || '',
      data: format(new Date(), 'yyyy-MM-dd'),
      km_inicial: firstPending?.km_inicial || matchingVeiculo?.km_atual || '',
      km_final: '',
      trajeto: firstPending?.trajeto || '',
      observacoes: '',
      foto_hodometro: null,
      foto_hodometro_inicial: firstPending?.foto_hodometro_inicial || null
    })
    setModalOpen(true)
  }

  const openSaidaForDriver = (driverId: string) => {
    const driverAuthVehicles = veiculos.filter(v => 
      allAutorizacoes.some(a => a.usuario_id === driverId && a.veiculo_id === v.id)
    )
    const myVehicle = driverAuthVehicles.find(v => v.usuario_responsavel_id === driverId) || driverAuthVehicles[0]

    setTipoRegistro('saida')
    setIsEditMode(false)
    setFormData({
      veiculo_id: myVehicle?.id || '',
      usuario_id: driverId,
      data: format(new Date(), 'yyyy-MM-dd'),
      km_inicial: myVehicle?.km_atual || '',
      km_final: '',
      trajeto: '',
      observacoes: '',
      foto_hodometro: null,
      foto_hodometro_inicial: null
    })
    setModalOpen(true)
  }

  const openChegadaForDriver = (driverId: string) => {
    const pending = visibleRegistros.find(r => r.usuario_id === driverId && !r.km_final)
    if (!pending) return
    const matchingVeiculo = veiculos.find(v => v.id === pending.veiculo_id)
    setTipoRegistro('chegada')
    setIsEditMode(true)
    setFormData({
      id: pending.id,
      veiculo_id: pending.veiculo_id,
      usuario_id: pending.usuario_id,
      data: format(new Date(), 'yyyy-MM-dd'),
      km_inicial: pending.km_inicial,
      km_final: '',
      trajeto: pending.trajeto || '',
      observacoes: pending.observacoes || '',
      foto_hodometro: null,
      foto_hodometro_inicial: pending.foto_hodometro_inicial || null
    })
    setModalOpen(true)
  }

  const openChegada = (r: any) => {
    setTipoRegistro('chegada')
    setIsEditMode(true)
    setFormData({
      id: r.id,
      veiculo_id: r.veiculo_id,
      usuario_id: r.usuario_id,
      data: r.data,
      km_inicial: r.km_inicial,
      km_final: '',
      trajeto: r.trajeto || '',
      observacoes: r.observacoes || '',
      foto_hodometro: null,
      foto_hodometro_inicial: r.foto_hodometro_inicial || null
    })
    setModalOpen(true)
  }

  const openEdit = (r: any) => {
    setTipoRegistro('ambos')
    setIsEditMode(true)
    setFormData({
      id: r.id,
      veiculo_id: r.veiculo_id,
      usuario_id: r.usuario_id,
      data: r.data,
      km_inicial: r.km_inicial,
      km_final: r.km_final || '',
      trajeto: r.trajeto || '',
      observacoes: r.observacoes || '',
      foto_hodometro: r.foto_hodometro || null,
      foto_hodometro_inicial: r.foto_hodometro_inicial || null
    })
    setModalOpen(true)
  }

  const handleVeiculoChange = (vid: string) => {
    const v = veiculos.find(x => x.id === vid)
    const pending = registros.find(r => r.veiculo_id === vid && !r.km_final)

    if (tipoRegistro === 'chegada') {
      if (pending) {
        setFormData((prev: any) => ({
          ...prev,
          id: pending.id,
          veiculo_id: vid,
          usuario_id: pending.usuario_id,
          km_inicial: pending.km_inicial,
          km_final: prev.km_final || '',
          trajeto: pending.trajeto || '',
          observacoes: pending.observacoes || '',
          foto_hodometro: pending.foto_hodometro || null,
          foto_hodometro_inicial: pending.foto_hodometro_inicial || null
        }))
      } else {
        toast('Nenhuma saída em aberto para este veículo. Mudando para Saída.', 'info')
        setTipoRegistro('saida')
        setFormData((prev: any) => ({
          ...prev,
          id: undefined,
          veiculo_id: vid,
          km_inicial: v ? v.km_atual : '',
          km_final: '',
          foto_hodometro: null,
          foto_hodometro_inicial: null
        }))
      }
    } else {
      setFormData((prev: any) => ({
        ...prev,
        veiculo_id: vid,
        km_inicial: prev.km_inicial || (v ? v.km_atual : '')
      }))
    }
  }

  const handleDriverChange = (driverId: string) => {
    const driverAuthVehicles = veiculos.filter(v => 
      v.status === 'ativo' && 
      allAutorizacoes.some(a => a.usuario_id === driverId && a.veiculo_id === v.id)
    )
    const myVehicle = driverAuthVehicles.find(v => v.usuario_responsavel_id === driverId) || driverAuthVehicles[0]

    setFormData((prev: any) => ({
      ...prev,
      usuario_id: driverId,
      veiculo_id: myVehicle?.id || '',
      km_inicial: myVehicle?.km_atual || ''
    }))
  }

  const handleTipoRegistroChange = (tipo: 'saida' | 'chegada') => {
    setTipoRegistro(tipo)
    if (tipo === 'chegada') {
      const pending = registros.find(r => r.veiculo_id === formData.veiculo_id && !r.km_final)
      if (pending) {
        setFormData((prev: any) => ({
          ...prev,
          id: pending.id,
          usuario_id: pending.usuario_id,
          km_inicial: pending.km_inicial,
          km_final: prev.km_final || '',
          trajeto: pending.trajeto || '',
          observacoes: pending.observacoes || '',
          foto_hodometro: pending.foto_hodometro || null,
          foto_hodometro_inicial: pending.foto_hodometro_inicial || null
        }))
      } else {
        toast('Nenhuma saída em aberto para este veículo. Registre como Saída primeiro.', 'info')
        setTipoRegistro('saida')
      }
    } else {
      setFormData((prev: any) => ({
        ...prev,
        id: undefined,
        km_final: '',
        foto_hodometro: null,
        foto_hodometro_inicial: null
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.usuario_id) {
      toast('Por favor, selecione o motorista/colaborador.', 'warning')
      return
    }

    if (!formData.trajeto) {
      toast('Por favor, insira a rota/trajeto feito.', 'warning')
      return
    }

    // CHECK FOR DOUBLE ROTAS - driver can only have 1 active route at a time
    if (!formData.km_final) {
      const activeRoute = registros.find(r => r.usuario_id === formData.usuario_id && !r.km_final && r.id !== formData.id)
      if (activeRoute) {
        const u = users.find(x => x.id === formData.usuario_id)
        toast(`O funcionário ${u?.nome || ''} já possui uma rota ativa em andamento! Finalize-a antes de iniciar outra.`, 'warning')
        return
      }
    }

    // VALIDATE PHOTOS AND KM
    if (tipoRegistro === 'saida' || tipoRegistro === 'ambos') {
      if (!formData.km_inicial) {
        toast('Por favor, insira o KM Inicial.', 'warning')
        return
      }
    }
    
    if (tipoRegistro === 'chegada') {
      if (!formData.km_final) {
        toast('Por favor, insira o KM Final.', 'warning')
        return
      }
    }

    const selectedVehicle = veiculos.find(v => v.id === formData.veiculo_id)
    if (selectedVehicle) {
      if ((tipoRegistro === 'saida' || tipoRegistro === 'ambos') && Number(formData.km_inicial) < selectedVehicle.km_atual) {
        toast(`O KM Inicial (${Number(formData.km_inicial).toLocaleString('pt-BR')}) não pode ser menor que o KM atual do veículo (${selectedVehicle.km_atual.toLocaleString('pt-BR')} km).`, 'warning')
        return
      }
      if (tipoRegistro === 'chegada' && Number(formData.km_final) < selectedVehicle.km_atual) {
        toast(`O KM Final (${Number(formData.km_final).toLocaleString('pt-BR')}) não pode ser menor que o KM atual do veículo (${selectedVehicle.km_atual.toLocaleString('pt-BR')} km).`, 'warning')
        return
      }
    }

    if (formData.km_final && Number(formData.km_final) <= Number(formData.km_inicial)) {
      toast('O KM Final deve ser maior que o KM Inicial.', 'warning')
      return
    }

    try {
      await upsertMutation.mutateAsync({
        ...formData,
        km_inicial: Number(formData.km_inicial),
        km_final: formData.km_final ? Number(formData.km_final) : null
      })
      toast('Registro de rota salvo com sucesso!', 'success')
      setModalOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este controle de rota?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Registro excluído com sucesso!', 'success')
    } catch (err: any) {
      toast('Erro ao excluir: ' + err.message, 'error')
    }
  }

  const eligibleVehicles = React.useMemo(() => {
    if (!formData.usuario_id) return []
    return veiculos.filter(v => 
      v.status === 'ativo' && 
      allAutorizacoes.some(a => a.usuario_id === formData.usuario_id && a.veiculo_id === v.id)
    )
  }, [veiculos, allAutorizacoes, formData.usuario_id])

  if (loadV || loadR || loadU) return <div className="min-h-screen bg-background"><TopHeader title="Controle de Veículos e Rotas" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Controle de Rotas da Equipe" subtitle="Acompanhamento e lançamento de rotas dos veículos de colaboradores" />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-6">

        {/* Tab Toggle Navigation */}
        <div className="flex gap-2 p-1.5 bg-muted rounded-[2rem] w-fit border border-border/50 shadow-inner">
          <button 
            onClick={() => setActiveTab('painel')}
            className={cn(
              "px-6 py-3 text-xs font-black uppercase rounded-2xl transition-all flex items-center gap-2",
              activeTab === 'painel' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            )}
          >
            <Activity className="w-4 h-4" /> Quadro da Equipe
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            className={cn(
              "px-6 py-3 text-xs font-black uppercase rounded-2xl transition-all flex items-center gap-2",
              activeTab === 'historico' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            )}
          >
            <Clock className="w-4 h-4" /> Histórico de Viagens
          </button>
        </div>

        {activeTab === 'painel' ? (
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card/40 border border-border/50 rounded-3xl p-5 flex items-center gap-4 shadow-sm backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Em Campo (Hoje)</p>
                  <p className="text-xl font-black text-foreground">{emTransitoCount} de {allowedDrivers.length}</p>
                </div>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-3xl p-5 flex items-center gap-4 shadow-sm backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                  <Navigation className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total de Saídas</p>
                  <p className="text-xl font-black text-foreground">{viagensHoje}</p>
                </div>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-3xl p-5 flex items-center gap-4 shadow-sm backdrop-blur-md">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">KM Rodado Hoje</p>
                  <p className="text-xl font-black text-foreground">{kmTotalRodado} km</p>
                </div>
              </div>
            </div>

            {/* Team Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allowedDrivers.map(u => {
                const activeRoute = visibleRegistros.find(r => r.usuario_id === u.id && !r.km_final)
                const driverAuthVehicles = veiculos.filter(v => 
                  allAutorizacoes.some(a => a.usuario_id === u.id && a.veiculo_id === v.id)
                )
                const myVehicle = driverAuthVehicles.find(v => v.usuario_responsavel_id === u.id) || driverAuthVehicles[0]
                const hasActiveRoute = !!activeRoute
                
                // If there's an active route, get the vehicle currently being driven
                const currentVehicle = hasActiveRoute 
                  ? veiculos.find(v => v.id === activeRoute.veiculo_id)
                  : myVehicle

                return (
                  <div 
                    key={u.id}
                    className={cn(
                      "bg-card/90 dark:bg-card/45 border rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between min-h-[340px] transition-all relative overflow-hidden backdrop-blur-lg hover:scale-[1.015]",
                      hasActiveRoute 
                        ? "border-amber-500/35 shadow-amber-500/[0.03]" 
                        : "border-border/60 hover:border-primary/30"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-36 h-36 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    
                    <div>
                      {/* Driver Avatar & Name */}
                      <div className="flex items-center gap-4 relative z-10 mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-base select-none">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-foreground uppercase tracking-tight leading-none">{u.nome}</h3>
                          {driverAuthVehicles.length === 0 ? (
                            <span className="inline-block px-2.5 py-0.5 mt-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                              Sem Veículo Autorizado
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 mt-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border/30">
                              {u.roles.map(r => r.nome).join(', ') || 'Funcionário'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Designated / Owned Vehicle */}
                      <div className="bg-muted/40 border border-border/30 rounded-2xl p-4 mb-5">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Veículo do Funcionário</p>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] tracking-wider font-black uppercase",
                            hasActiveRoute ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {hasActiveRoute ? 'Em Campo' : 'Livre'}
                          </span>
                        </div>
                        {currentVehicle ? (
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="text-sm font-black text-foreground uppercase truncate max-w-[120px]">{currentVehicle.modelo}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentVehicle.marca} ({currentVehicle.km_atual} KM)</p>
                            </div>
                            {/* Mercosul Plate */}
                            <div className="w-[100px] h-[34px] bg-white border border-zinc-950 rounded-[4px] overflow-hidden flex flex-col justify-between font-sans relative shadow-sm shrink-0">
                              <div className="w-full h-[9px] bg-[#0033A0] flex items-center justify-between px-1 border-b-[0.5px] border-zinc-950">
                                <span className="text-[5px] text-white font-extrabold tracking-wider leading-none">BRASIL</span>
                                <div className="w-[10px] h-[6px] bg-yellow-400 rounded-[0.2px] shrink-0" />
                              </div>
                              <div className="w-full flex-1 flex items-center justify-center bg-white">
                                <span className="text-[11px] font-black text-zinc-900 tracking-wider uppercase font-mono leading-none pt-0.5">{currentVehicle.placa}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-muted-foreground/60 italic">Nenhum veículo designado</p>
                        )}
                      </div>

                      {/* Active Journey Info */}
                      {hasActiveRoute && (
                        <div className="space-y-2 mb-6 animate-slide-up">
                          <div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-2xl p-4 space-y-2">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Rota em Andamento</p>
                                <p className="text-xs font-bold text-foreground leading-relaxed">{activeRoute.trajeto || 'Trajeto não especificado'}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-amber-500/10">
                              <div>
                                <p className="text-[8px] font-black uppercase text-muted-foreground">KM de Partida</p>
                                <p className="text-xs font-black text-foreground">{activeRoute.km_inicial} km</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black uppercase text-muted-foreground">Início em</p>
                                <p className="text-xs font-black text-foreground">{format(parseISO(activeRoute.data), 'dd/MM/yyyy')}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Launch Buttons */}
                    <div className="mt-auto pt-4 border-t border-border/40">
                      {hasActiveRoute ? (
                        <button 
                          onClick={() => openChegadaForDriver(u.id)}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-98"
                        >
                          <CheckCircle2 className="w-4.5 h-4.5" /> Registrar Chegada / Retorno
                        </button>
                      ) : (
                        <button 
                          onClick={() => openSaidaForDriver(u.id)}
                          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 active:scale-98"
                        >
                          <ArrowUpRight className="w-4.5 h-4.5" /> Iniciar Rota / Saída
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {allowedDrivers.length === 0 && (
                <div className="col-span-full py-20 text-center text-muted-foreground bg-card/40 border border-border/50 rounded-[2.5rem] shadow-sm">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-sm">Nenhum funcionário na sua equipe no momento.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Elite Glass Control Bar */}
            <div className="bg-card border border-border/50 rounded-[2.5rem] p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-md relative overflow-hidden">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar placa, modelo, motorista ou trajeto..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-muted/40 border border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:ring-0 text-foreground transition-all"
                />
              </div>
              <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                {canManage && (
                  <>
                    <button 
                      onClick={openSaida} 
                      className="flex-1 sm:flex-none px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                    >
                      <ArrowUpRight className="w-4 h-4" /> Lançar Saída / Rota
                    </button>
                    <button 
                      onClick={openEntrada} 
                      className="flex-1 sm:flex-none px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                    >
                      <ArrowDownLeft className="w-4 h-4" /> Lançar Chegada / Retorno
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Compact History List */}
            <div className="flex flex-col gap-3">
              {filtered.map(r => {
                const v = veiculos.find(v => v.id === r.veiculo_id)
                const isConcluido = !!r.km_final
                const driver = users.find(u => u.id === r.usuario_id)
                const driverName = driver?.nome || 'Motorista Não Identificado'

                return (
                  <div 
                    key={r.id} 
                    onClick={() => setSelectedRegistroDetails(r)}
                    className={cn(
                      "border rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer shadow-sm transition-all relative overflow-hidden backdrop-blur-md hover:scale-[1.005]",
                      isConcluido 
                        ? "bg-emerald-500/[0.01] border-emerald-500/15 hover:border-emerald-500/30" 
                        : "bg-amber-500/[0.02] border-amber-500/25 hover:border-amber-500/40"
                    )}
                  >
                     <div className="flex flex-wrap items-center gap-4">
                       {/* Mercosul Plate */}
                       {v?.placa ? (
                         <div className="relative shrink-0">
                           <div className="w-[120px] h-[40px] bg-white border-[1.5px] border-zinc-950 rounded-[4px] overflow-hidden flex flex-col justify-between select-none font-sans relative shadow-md">
                             <div className="absolute inset-[0.2px] border border-zinc-150 pointer-events-none rounded-[3px]" />
                             <div className="w-full h-[11px] bg-[#0033A0] flex items-center justify-between px-1.5 border-b-[1px] border-zinc-950 z-10 shrink-0">
                               <div className="relative w-1.5 h-1.5 flex items-center justify-center shrink-0">
                                 <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
                                   <circle cx="50" cy="50" r="42" stroke="white" strokeWidth="6" fill="none" opacity="0.8" />
                                   <polygon points="50,16 53,24 61,24 55,29 57,37 50,32 43,37 45,29 39,24 47,24" />
                                   <polygon points="50,84 52,78 58,78 53,74 55,67 50,71 45,67 47,74 42,78 48,78" />
                                   <polygon points="16,50 22,52 22,58 25,54 31,55 28,50 31,45 25,46 22,42 22,48" />
                                   <polygon points="84,50 78,52 78,58 75,54 69,55 72,50 69,45 75,46 78,42 78,48" />
                                   <circle cx="62" cy="60" r="3.5" fill="white" />
                                 </svg>
                               </div>
                               <span className="text-[6px] text-white font-extrabold tracking-[0.2em] uppercase leading-none font-sans mt-[0.2px]">BRASIL</span>
                               <svg viewBox="0 0 720 500" className="w-[12px] h-[8px] rounded-[0.5px] shadow shrink-0 select-none">
                                 <rect width="720" height="500" fill="#009b3a" />
                                 <polygon points="360,40 640,250 360,460 80,250" fill="#fedf00" />
                                 <circle cx="360" cy="250" r="105" fill="#002776" />
                                 <path d="M255,250 Q360,200 465,250" stroke="white" strokeWidth="15" fill="none" />
                               </svg>
                             </div>
                             <div className="w-full flex-1 flex items-center justify-center relative px-1 bg-white">
                               <span className="text-[14px] font-black text-zinc-900 tracking-[0.06em] uppercase font-mono select-all leading-none drop-shadow-[0.25px_0.25px_0px_rgba(0,0,0,0.15)] pt-0.5">{v.placa}</span>
                               <span className="text-[4px] font-black text-zinc-400 absolute bottom-[1px] right-1 select-none tracking-tighter opacity-80">BR</span>
                             </div>
                           </div>
                         </div>
                       ) : (
                         <div className="w-[120px] h-[40px] bg-muted/30 border border-dashed rounded-lg flex items-center justify-center text-[10px] uppercase font-black tracking-wider text-muted-foreground">Sem Placa</div>
                       )}

                       <div className="space-y-1">
                         <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex flex-wrap items-center gap-2">
                           {v?.modelo || 'Modelo Desconhecido'}
                           <span className={cn(
                              "px-2 py-0.5 rounded-lg text-[9px] tracking-wider font-black uppercase",
                              isConcluido ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600 animate-pulse"
                           )}>
                             {isConcluido ? 'Finalizado' : 'Em Campo'}
                           </span>
                         </h3>
                         
                         <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-bold">
                           <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                             <User className="w-3.5 h-3.5 text-primary" /> {driverName}
                           </span>
                           <span>•</span>
                           <span className="flex items-center gap-1">
                             <CalendarIcon className="w-3.5 h-3.5" /> {format(parseISO(r.data), 'dd/MM/yyyy')}
                           </span>
                         </div>

                         {r.trajeto && (
                           <p className="text-xs bg-muted/60 text-foreground px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 w-fit border border-border/30 mt-1">
                             <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                             <span className="text-muted-foreground mr-1">Trajeto:</span>
                             {r.trajeto}
                           </p>
                         )}
                       </div>
                     </div>

                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                       <div className="flex items-center gap-2">
                         {r.foto_hodometro_inicial && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); setViewerPhotoUrl(r.foto_hodometro_inicial || null); }}
                             className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                             title="Ver foto de Saída"
                           >
                             <Camera className="w-3.5 h-3.5" /> Saída
                           </button>
                         )}
                         {r.foto_hodometro && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); setViewerPhotoUrl(r.foto_hodometro || null); }}
                             className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                             title="Ver foto de Retorno"
                           >
                             <Camera className="w-3.5 h-3.5" /> Retorno
                           </button>
                         )}
                       </div>
                       
                       <div className="flex items-center gap-2 justify-end">
                         {!isConcluido && canManage && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); openChegada(r); }} 
                             className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 shadow-sm"
                           >
                             <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Confirmar Retorno
                           </button>
                         )}
                         {canManage && (
                           <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm">
                             <Trash2 className="w-4.5 h-4.5" />
                           </button>
                         )}
                         {canManage && (
                           <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="w-9 h-9 rounded-xl bg-muted/60 text-muted-foreground hover:text-primary flex items-center justify-center transition-all">
                             <Edit className="w-4.5 h-4.5" />
                           </button>
                         )}
                       </div>
                     </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="py-16 text-center text-muted-foreground bg-card border border-border/50 rounded-[2.5rem] shadow-sm">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-sm">Nenhum controle de rota de veículos cadastrado.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modern Route Registration Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={
          formData.id 
            ? (tipoRegistro === 'chegada' ? 'Registrar Chegada / Retorno' : 'Editar Controle de Rota') 
            : (tipoRegistro === 'saida' ? 'Lançar Saída de Veículo' : 'Lançar Retorno de Veículo')
        }
        footer={
          <button 
            form="registro-form"
            disabled={upsertMutation.isPending || isUploading} 
            type="submit" 
            className={cn(
              "w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg",
              tipoRegistro === 'saida' 
                ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10" 
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10"
            )}
          >
            {upsertMutation.isPending ? 'Salvando...' : 'Confirmar e Salvar Rota'}
          </button>
        }
      >
        <form id="registro-form" onSubmit={handleSubmit} className="space-y-5">
          {!isEditMode && (
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2">Tipo de Lançamento</label>
              <div className="flex gap-2 p-1.5 bg-muted rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTipoRegistroChange('saida')}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5",
                    tipoRegistro === 'saida' ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                >
                  <ArrowUpRight className="w-4 h-4" /> Lançar Saída
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoRegistroChange('chegada')}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5",
                    tipoRegistro === 'chegada' ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10" : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                >
                  <ArrowDownLeft className="w-4 h-4" /> Registrar Retorno
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Data</label>
              <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold text-foreground outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Motorista / Funcionário</label>
              <select
                required
                value={formData.usuario_id}
                onChange={e => handleDriverChange(e.target.value)}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold text-foreground outline-none transition-all uppercase"
              >
                <option value="">Selecione o motorista...</option>
                {allowedDrivers.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.roles.map(r => r.nome).join(', ') || 'Funcionário'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Veículo Utilizado</label>
              <select 
                required 
                value={formData.veiculo_id} 
                onChange={e => handleVeiculoChange(e.target.value)} 
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase text-foreground outline-none transition-all" 
                disabled={!!formData.id && tipoRegistro === 'chegada'}
              >
                {!formData.usuario_id ? (
                  <option value="">Selecione o motorista primeiro...</option>
                ) : eligibleVehicles.length === 0 ? (
                  <option value="">Nenhum veículo autorizado para este motorista</option>
                ) : (
                  <>
                    <option value="">Selecione o veículo...</option>
                    {eligibleVehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Rota / Trajeto Feito</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                <input 
                  required
                  type="text" 
                  value={formData.trajeto} 
                  onChange={e => setFormData({...formData, trajeto: e.target.value})} 
                  placeholder="Ex: Obra Alpha -> Sede -> Fornecedor Beta"
                  className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold text-foreground outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tipoRegistro !== 'chegada' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Inicial (Saída)</label>
                <input required type="number" value={formData.km_inicial} onChange={e => setFormData({...formData, km_inicial: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all" placeholder="KM de saída" />
              </div>
            )}
            
            {tipoRegistro !== 'saida' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Final (Retorno)</label>
                <input required={tipoRegistro === 'chegada'} type="number" value={formData.km_final} onChange={e => setFormData({...formData, km_final: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all" placeholder="KM de chegada" />
              </div>
            )}
          </div>

          {/* UPLOAD HODOMETRO INICIAL */}
          {(tipoRegistro === 'saida' || tipoRegistro === 'ambos') && (
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Foto do Hodômetro (Saída)</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      setIsUploadingInicial(true)
                      try {
                        const file = e.target.files[0]
                        const fileExt = file.name.split('.').pop()
                        const fileName = `${Math.random()}.${fileExt}`
                        const filePath = `${user?.profile?.id}/${fileName}`
                        
                        const { error: uploadError } = await supabase.storage.from('frota').upload(filePath, file)
                        if (uploadError) throw uploadError
                        
                        const { data } = supabase.storage.from('frota').getPublicUrl(filePath)
                        setFormData({...formData, foto_hodometro_inicial: data.publicUrl})
                        toast('Foto de saída carregada com sucesso!', 'success')
                      } catch (err: any) {
                        toast('Erro ao carregar foto: ' + err.message, 'error')
                      } finally {
                        setIsUploadingInicial(false)
                      }
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className="w-full px-4 py-6 bg-muted/40 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                  {formData.foto_hodometro_inicial ? (
                    <div className="relative">
                      <img src={formData.foto_hodometro_inicial} alt="Hodômetro Saída" className="h-32 object-contain rounded-xl shadow-md border border-border" />
                      <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-1">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Selecionar foto do hodômetro de saída</p>
                      <p className="text-[10px] text-muted-foreground/50">Câmera ou Galeria de Imagens</p>
                    </>
                  )}
                  {isUploadingInicial && <p className="text-xs text-primary font-black animate-pulse mt-1">Carregando imagem...</p>}
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD HODOMETRO FINAL */}
          {(tipoRegistro === 'chegada' || tipoRegistro === 'ambos') && (
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Foto do Hodômetro (Chegada)</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      setIsUploading(true)
                      try {
                        const file = e.target.files[0]
                        const fileExt = file.name.split('.').pop()
                        const fileName = `${Math.random()}.${fileExt}`
                        const filePath = `${user?.profile?.id}/${fileName}`
                        
                        const { error: uploadError } = await supabase.storage.from('frota').upload(filePath, file)
                        if (uploadError) throw uploadError
                        
                        const { data } = supabase.storage.from('frota').getPublicUrl(filePath)
                        setFormData({...formData, foto_hodometro: data.publicUrl})
                        toast('Foto de chegada carregada com sucesso!', 'success')
                      } catch (err: any) {
                        toast('Erro ao carregar foto: ' + err.message, 'error')
                      } finally {
                        setIsUploading(false)
                      }
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className="w-full px-4 py-6 bg-muted/40 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                  {formData.foto_hodometro ? (
                    <div className="relative">
                      <img src={formData.foto_hodometro} alt="Hodômetro Chegada" className="h-32 object-contain rounded-xl shadow-md border border-border" />
                      <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-1">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Selecionar foto do hodômetro de chegada</p>
                      <p className="text-[10px] text-muted-foreground/50">Câmera ou Galeria de Imagens</p>
                    </>
                  )}
                  {isUploading && <p className="text-xs text-primary font-black animate-pulse mt-1">Carregando imagem...</p>}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Observações da Rota</label>
            <textarea value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold resize-none text-foreground outline-none transition-all" rows={3} placeholder="Condições da rota, avarias ou notas..." />
          </div>

        </form>
      </Modal>

      {/* Glassmorphism Image Viewer */}
      {viewerPhotoUrl && (
        <div 
          onClick={() => setViewerPhotoUrl(null)}
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-2xl space-y-4"
          >
            <div className="w-full flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="text-sm font-black uppercase text-foreground tracking-wider">Visualizar Hodômetro</h3>
              <button 
                onClick={() => setViewerPhotoUrl(null)}
                className="px-4 py-2 bg-muted hover:bg-muted-foreground/15 text-foreground rounded-xl text-xs font-black uppercase transition-all"
              >
                ← Voltar
              </button>
            </div>
            
            <div className="w-full flex-1 overflow-hidden flex items-center justify-center bg-muted/20 rounded-2xl border border-border/20 p-2">
              <img 
                src={viewerPhotoUrl} 
                alt="Foto do Hodômetro" 
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-inner" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Modal open={!!selectedRegistroDetails} onClose={() => setSelectedRegistroDetails(null)} title="Detalhes do Lançamento de Rota">
        {selectedRegistroDetails && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Veículo</p>
              <p className="font-black text-foreground text-lg uppercase">
                {veiculos.find(v => v.id === selectedRegistroDetails.veiculo_id)?.placa} - {veiculos.find(v => v.id === selectedRegistroDetails.veiculo_id)?.modelo}
              </p>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Motorista / Responsável</p>
                <p className="font-black text-foreground text-sm">
                  {users.find(u => u.id === selectedRegistroDetails.usuario_id)?.nome || 'Não Identificado'}
                </p>
              </div>
            </div>

            {selectedRegistroDetails.trajeto && (
              <div className="p-4 bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl">
                <p className="text-xs text-rose-500 font-bold uppercase tracking-wider mb-1">Trajeto / Rota Realizada</p>
                <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  {selectedRegistroDetails.trajeto}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Data</p>
                <p className="font-black text-foreground">{format(parseISO(selectedRegistroDetails.data), 'dd/MM/yyyy')}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Status</p>
                <p className={cn("font-black uppercase text-xs tracking-wider", selectedRegistroDetails.km_final ? "text-emerald-500" : "text-amber-500")}>
                  {selectedRegistroDetails.km_final ? 'Finalizado' : 'Em Trânsito'}
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM Saída</p>
                <p className="font-black text-foreground">{selectedRegistroDetails.km_inicial.toLocaleString('pt-BR')} km</p>
                <p className="text-[10px] text-muted-foreground font-bold mt-1">Hora: {format(parseISO(selectedRegistroDetails.created_at || new Date().toISOString()), 'HH:mm')}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM Retorno</p>
                <p className="font-black text-foreground">{selectedRegistroDetails.km_final ? `${selectedRegistroDetails.km_final.toLocaleString('pt-BR')} km` : '---'}</p>
                {selectedRegistroDetails.km_final && (
                  <p className="text-[10px] text-muted-foreground font-bold mt-1">Hora: {format(parseISO(selectedRegistroDetails.updated_at || new Date().toISOString()), 'HH:mm')}</p>
                )}
              </div>
            </div>
            
            {(selectedRegistroDetails.km_final && selectedRegistroDetails.km_inicial) && (
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex justify-between items-center">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Distância Percorrida</p>
                <p className="font-black text-blue-600 text-lg">+{(selectedRegistroDetails.km_final - selectedRegistroDetails.km_inicial).toLocaleString('pt-BR')} km</p>
              </div>
            )}

            {selectedRegistroDetails.observacoes && (
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Observações</p>
                <p className="text-sm font-bold text-foreground">{selectedRegistroDetails.observacoes}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              {selectedRegistroDetails.foto_hodometro_inicial && (
                 <button 
                   onClick={() => {
                     setSelectedRegistroDetails(null)
                     setViewerPhotoUrl(selectedRegistroDetails.foto_hodometro_inicial)
                   }} 
                   className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-card border border-blue-500/20 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-blue-500/5 transition-all"
                 >
                   <Camera className="w-4 h-4" /> Foto de Saída
                 </button>
              )}
              {selectedRegistroDetails.foto_hodometro && (
                 <button 
                   onClick={() => {
                     setSelectedRegistroDetails(null)
                     setViewerPhotoUrl(selectedRegistroDetails.foto_hodometro)
                   }} 
                   className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-card border border-emerald-500/20 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-emerald-500/5 transition-all"
                 >
                   <Camera className="w-4 h-4" /> Foto de Retorno
                 </button>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
