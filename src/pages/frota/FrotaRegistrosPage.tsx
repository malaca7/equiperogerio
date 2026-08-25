import React, { useState } from 'react'
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
  TrendingUp, 
  Sparkles,
  User,
  Trash2,
  MapPin
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

export function FrotaRegistrosPage() {
  const { user, hasPermission } = useAuth()
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(user?.profile?.id, user?.isAdmin)
  const { data: registros = [], isLoading: loadR } = useRegistrosDiarios()
  const { data: users = [], isLoading: loadU } = useAdminUsers()
  const { toast } = useToast()
  
  const upsertMutation = useUpsertRegistroDiario()
  const deleteMutation = useDeleteRegistroDiario()

  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  
  const [formData, setFormData] = useState<any>({
    veiculo_id: '', usuario_id: '', data: format(new Date(), 'yyyy-MM-dd'), km_inicial: '', km_final: '', trajeto: '', observacoes: '', foto_hodometro: null, foto_hodometro_inicial: null
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingInicial, setIsUploadingInicial] = useState(false)
  const [tipoRegistro, setTipoRegistro] = useState<'saida'|'chegada'|'ambos'>('saida')
  const [isEditMode, setIsEditMode] = useState(false)
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState<string | null>(null)
  const [selectedRegistroDetails, setSelectedRegistroDetails] = useState<any>(null)

  const { data: teamInfo } = useUserTeam()
  const { data: physicalFuncs = [] } = useFuncionarios()

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
      return (u.cpf && myTeamCpfs.has(u.cpf)) || 
             myTeamNames.has(u.nome.toLowerCase()) || 
             u.id === user?.profile?.id
    })
  }, [users, teamInfo, myTeamCpfs, myTeamNames, user])

  const allowedDriverIds = React.useMemo(() => new Set(allowedDrivers.map(u => u.id)), [allowedDrivers])

  const isEncarregado = React.useMemo(() => {
    return teamInfo?.isRestricted && (teamInfo?.teamIds?.length > 0 || teamInfo?.teamMemberIds?.length > 0)
  }, [teamInfo])

  const canManage = React.useMemo(() => {
    if (isEncarregado) return false
    return hasPermission('frota_registros', 'gerenciar') || user?.isAdmin
  }, [hasPermission, user, isEncarregado])

  // Filter out any registry that belongs to an unauthorized vehicle
  const authorizedVeiculoIds = new Set(veiculos.map(v => v.id))
  const myRegistros = registros.filter(r => authorizedVeiculoIds.has(r.veiculo_id))

  // Filter myRegistros to only show those of allowed drivers if restricted, and only personal driver logs if Encarregado
  const visibleRegistros = React.useMemo(() => {
    return myRegistros.filter(r => {
      if (isEncarregado) {
        return r.usuario_id === user?.profile?.id
      }
      if (teamInfo?.isRestricted) {
        return allowedDriverIds.has(r.usuario_id)
      }
      return true
    })
  }, [myRegistros, teamInfo, allowedDriverIds, isEncarregado, user])

  // Calculate metrics based ONLY on visible records
  const emTransitoCount = visibleRegistros.filter(r => !r.km_final).length
  const viagensHoje = visibleRegistros.filter(r => r.data === format(new Date(), 'yyyy-MM-dd')).length
  const kmTotalRodado = visibleRegistros.reduce((sum, r) => {
    if (r.km_final && r.km_inicial) {
      return sum + (r.km_final - r.km_inicial)
    }
    return sum
  }, 0)

  const filtered = visibleRegistros.filter(r => {
    const v = veiculos.find(v => v.id === r.veiculo_id)
    if (!v) return false
    return v.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
           v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (r.trajeto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           format(parseISO(r.data), 'dd/MM/yyyy').includes(searchTerm)
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const openSaida = () => {
    setTipoRegistro('saida')
    setIsEditMode(false)
    setFormData({
      veiculo_id: veiculos.filter(v => v.status === 'ativo')[0]?.id || '',
      usuario_id: allowedDrivers.find(d => d.id === user?.profile?.id)?.id || allowedDrivers[0]?.id || '',
      data: format(new Date(), 'yyyy-MM-dd'),
      km_inicial: '',
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
      usuario_id: firstPending?.usuario_id || allowedDrivers.find(d => d.id === user?.profile?.id)?.id || allowedDrivers[0]?.id || '',
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

  const openChegada = (r: any) => {
    setTipoRegistro('chegada')
    setIsEditMode(true)
    setFormData({
      id: r.id,
      veiculo_id: r.veiculo_id,
      usuario_id: r.usuario_id || '',
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
      usuario_id: r.usuario_id || '',
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
          usuario_id: user?.profile?.id || '',
          km_inicial: v ? v.km_atual : '',
          km_final: '',
          trajeto: '',
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
        usuario_id: user?.profile?.id || '',
        km_final: '',
        trajeto: '',
        foto_hodometro: null,
        foto_hodometro_inicial: null
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // VALIDATE PHOTOS AND KM
    if (tipoRegistro === 'saida' || tipoRegistro === 'ambos') {
      // Check if user already has an active trip (only when creating a new registration)
      if (!formData.id && tipoRegistro === 'saida') {
        const hasActive = registros.some(r => r.usuario_id === user?.profile?.id && !r.km_final)
        if (hasActive) {
          toast('Você já possui uma rota em andamento! Encerre a viagem ativa antes de iniciar outra.', 'warning')
          return
        }
      }

      if (!formData.km_inicial) {
        toast('Por favor, insira o KM Inicial.', 'warning')
        return
      }
      if (!formData.foto_hodometro_inicial) {
        toast('Por favor, envie a foto do hodômetro inicial (saída).', 'warning')
        return
      }
    }
    
    if (tipoRegistro === 'chegada') {
      if (!formData.km_final) {
        toast('Por favor, insira o KM Final.', 'warning')
        return
      }
      if (!formData.foto_hodometro) {
        toast('Por favor, envie a foto do hodômetro final (chegada).', 'warning')
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
      const payload: any = {
        ...formData,
        usuario_id: formData.usuario_id || user?.profile?.id,
        km_inicial: Number(formData.km_inicial),
        km_final: formData.km_final ? Number(formData.km_final) : null
      }
      await upsertMutation.mutateAsync(payload)
      toast('Registro salvo com sucesso!', 'success')
      setModalOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Registro excluído com sucesso!', 'success')
    } catch (err: any) {
      toast('Erro ao excluir registro: ' + err.message, 'error')
    }
  }

  if (loadV || loadR || loadU) return <div className="min-h-screen bg-background"><TopHeader title="Área do Motorista" /><div className="pt-36 sm:pt-40"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Área do Motorista" subtitle="Gestão completa de histórico, rotas e quilometragem" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-36 sm:pt-40 space-y-4">

        {/* Elite Glass Control Bar */}
        <div className="bg-card border border-border/50 rounded-[2.5rem] p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-md relative overflow-hidden">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
            <input 
              type="text" 
              placeholder="Pesquisar placa, modelo ou data..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-muted/40 border border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:ring-0 text-foreground transition-all"
            />
          </div>
          {canManage && veiculos.length > 0 && (
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
              <button 
                onClick={openSaida} 
                className="flex-1 sm:flex-none px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
              >
                <ArrowUpRight className="w-4 h-4" /> Registrar Saída
              </button>
              <button 
                onClick={openEntrada} 
                className="flex-1 sm:flex-none px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <ArrowDownLeft className="w-4 h-4" /> Registrar Entrada
              </button>
            </div>
          )}
        </div>

        {/* Compact History List */}
        <div className="flex flex-col gap-3">
          {filtered.map(r => {
            const v = veiculos.find(v => v.id === r.veiculo_id)
            const isConcluido = !!r.km_final
            const driver = users.find(u => u.id === r.usuario_id)
            const driverName = driver?.nome || 'Motorista'

            return (
              <div 
                key={r.id} 
                onClick={() => setSelectedRegistroDetails(r)}
                className={cn(
                  "border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer shadow-sm transition-all relative overflow-hidden backdrop-blur-md hover:scale-[1.01]",
                  isConcluido 
                    ? "bg-emerald-500/[0.01] border-emerald-500/15 hover:border-emerald-500/30" 
                    : "bg-amber-500/[0.02] border-amber-500/25 hover:border-amber-500/40"
                )}
              >
                 <div className="flex items-center gap-3">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                     isConcluido ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                   )}>
                     <Activity className="w-5 h-5" />
                   </div>
                   <div>
                     <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex flex-wrap items-center gap-2">
                       {v?.placa ? (
                         <div className="relative group/plate shrink-0 mr-1">
                           <div className="w-[110px] h-[36px] bg-white border-[1.5px] border-zinc-950 rounded-[4px] overflow-hidden flex flex-col justify-between select-none font-sans relative shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                             {/* Embossed effect border */}
                             <div className="absolute inset-[0.2px] border border-zinc-150 pointer-events-none rounded-[3px]" />

                             {/* Blue header bar */}
                             <div className="w-full h-[10px] bg-[#0033A0] flex items-center justify-between px-1 border-b-[1px] border-zinc-950 z-10 shrink-0">
                               {/* Mercosul logo */}
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

                               {/* BRASIL Text */}
                               <span className="text-[5.5px] text-white font-extrabold tracking-[0.2em] uppercase leading-none font-sans mt-[0.2px]">
                                 BRASIL
                               </span>

                               {/* Brazil Flag */}
                               <svg viewBox="0 0 720 500" className="w-[11px] h-[7.5px] rounded-[0.5px] shadow-[0_0.5px_1px_rgba(0,0,0,0.2)] shrink-0 select-none">
                                 <rect width="720" height="500" fill="#009b3a" />
                                 <polygon points="360,40 640,250 360,460 80,250" fill="#fedf00" />
                                 <circle cx="360" cy="250" r="105" fill="#002776" />
                                 <path d="M255,250 Q360,200 465,250" stroke="white" strokeWidth="15" fill="none" />
                               </svg>
                             </div>

                             {/* Plate Characters Container */}
                             <div className="w-full flex-1 flex items-center justify-center relative px-1 bg-white">
                               <span className="text-[13px] font-black text-zinc-900 tracking-[0.06em] uppercase font-mono select-all leading-none drop-shadow-[0.25px_0.25px_0px_rgba(0,0,0,0.15)] pt-0.5">
                                 {v.placa}
                               </span>

                               {/* BR watermark */}
                               <span className="text-[4px] font-black text-zinc-400 absolute bottom-[1px] right-1 select-none tracking-tighter opacity-80">
                                 BR
                               </span>
                             </div>
                           </div>
                         </div>
                       ) : (
                         <span className="text-muted-foreground mr-1">Sem Placa</span>
                       )}
                       <span className="text-zinc-300 dark:text-zinc-700 font-normal">|</span>
                       <span className="text-zinc-700 dark:text-zinc-300 font-bold">{v?.modelo || 'Desconhecido'}</span>
                       <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] tracking-wider",
                          isConcluido ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600 animate-pulse"
                        )}>
                          {isConcluido ? 'Finalizado' : 'Em Campo'}
                        </span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-bold mt-1">
                        <span className="flex items-center gap-1 text-primary">
                          <User className="w-3.5 h-3.5" /> {driverName}
                        </span>
                        <span>•</span>
                        <span>{format(parseISO(r.data), 'dd/MM/yyyy')}</span>
                      </div>
                      {r.trajeto && (
                        <p className="text-[10px] bg-muted/60 text-foreground px-2 py-1 rounded-lg font-bold flex items-center gap-1 w-fit border border-border/30 mt-1.5">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="text-muted-foreground">Rota:</span>
                          {r.trajeto}
                        </p>
                      )}
                    </div>
                 </div>

                 <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                   <div className="flex gap-2 mr-2">
                     {r.foto_hodometro_inicial && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); setViewerPhotoUrl(r.foto_hodometro_inicial || null); }}
                         className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                         title="Ver foto de Saída"
                       >
                         <Camera className="w-3.5 h-3.5" /> Saída
                       </button>
                     )}
                     {r.foto_hodometro && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); setViewerPhotoUrl(r.foto_hodometro || null); }}
                         className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                         title="Ver foto de Retorno"
                       >
                         <Camera className="w-3.5 h-3.5" /> Retorno
                       </button>
                     )}
                   </div>
                   {!isConcluido && canManage && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); openChegada(r); }} 
                       className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 shadow-sm"
                     >
                       <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Confirmar Retorno
                     </button>
                   )}
                   <div className="flex gap-2">
                     {canManage && (
                       <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     )}
                     {canManage && (
                       <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="w-8 h-8 rounded-xl bg-muted/60 text-muted-foreground hover:text-primary flex items-center justify-center transition-all">
                         <Edit className="w-4 h-4" />
                       </button>
                     )}
                   </div>
                 </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground bg-card border border-border/50 rounded-2xl shadow-sm">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">Nenhum registro de quilometragem encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Split Registration Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={
          formData.id 
            ? (tipoRegistro === 'chegada' ? 'Registrar Retorno (Entrada)' : 'Editar Registro') 
            : (tipoRegistro === 'saida' ? 'Novo Registro de Saída' : 'Novo Registro de Entrada')
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
            {upsertMutation.isPending ? 'Salvando...' : 'Confirmar e Salvar'}
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
                  <ArrowUpRight className="w-4 h-4" /> Registro de Saída
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoRegistroChange('chegada')}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5",
                    tipoRegistro === 'chegada' ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10" : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                >
                  <ArrowDownLeft className="w-4 h-4" /> Registro de Entrada
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
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Veículo</label>
              <select 
                required 
                value={formData.veiculo_id} 
                onChange={e => handleVeiculoChange(e.target.value)} 
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase text-foreground outline-none transition-all" 
                disabled={!!formData.id && tipoRegistro === 'chegada'}
              >
                <option value="">Selecione...</option>
                {veiculos.filter(v => v.status === 'ativo').map(v => (
                  <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Motorista / Colaborador</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <select
                  required
                  value={formData.usuario_id || ''}
                  onChange={e => setFormData({...formData, usuario_id: e.target.value})}
                  className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold text-foreground outline-none transition-all uppercase"
                >
                  <option value="">Selecione o motorista...</option>
                  {allowedDrivers.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Rota / Trajeto Realizado</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                <input 
                  type="text" 
                  value={formData.trajeto || ''} 
                  onChange={e => setFormData({...formData, trajeto: e.target.value})} 
                  placeholder="Ex: Sede -> Obra Centro -> Fornecedor"
                  className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold text-foreground outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {tipoRegistro !== 'chegada' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Inicial (Saída)</label>
                <input required type="number" value={formData.km_inicial} onChange={e => setFormData({...formData, km_inicial: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all" placeholder="KM registrado na saída" />
              </div>
            )}
            
            {tipoRegistro !== 'saida' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Final (Chegada)</label>
                <input required={tipoRegistro === 'chegada'} type="number" value={formData.km_final} onChange={e => setFormData({...formData, km_final: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all" placeholder="KM registrado na chegada" />
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
            <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Observações</label>
            <textarea value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold resize-none text-foreground outline-none transition-all" rows={3} placeholder="Relate avarias, condições do veículo ou avisos..." />
          </div>

        </form>
      </Modal>

      {/* Glassmorphism In-Platform Image Viewer Overlay */}
      {viewerPhotoUrl && (
        <div 
          onClick={() => setViewerPhotoUrl(null)}
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-2xl space-y-4"
          >
            {/* Modal header with title and Back button */}
            <div className="w-full flex justify-between items-center pb-2 border-b border-border/40">
              <h3 className="text-sm font-black uppercase text-foreground tracking-wider">Foto do Hodômetro</h3>
              <button 
                onClick={() => setViewerPhotoUrl(null)}
                className="px-4 py-2 bg-muted hover:bg-muted-foreground/15 text-foreground rounded-xl text-xs font-black uppercase transition-all"
              >
                ← Voltar
              </button>
            </div>
            
            {/* Image viewer container */}
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
      <Modal open={!!selectedRegistroDetails} onClose={() => setSelectedRegistroDetails(null)} title="Detalhes do Registro">
        {selectedRegistroDetails && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Veículo</p>
              <p className="font-black text-foreground text-lg uppercase">{veiculos.find(v => v.id === selectedRegistroDetails.veiculo_id)?.placa} - {veiculos.find(v => v.id === selectedRegistroDetails.veiculo_id)?.modelo}</p>
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
                <p className={cn("font-black", selectedRegistroDetails.km_final ? "text-emerald-500" : "text-amber-500")}>
                  {selectedRegistroDetails.km_final ? 'Finalizado' : 'Em Campo'}
                </p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM Saída</p>
                <p className="font-black text-foreground">{selectedRegistroDetails.km_inicial.toLocaleString('pt-BR')} km</p>
                <p className="text-[10px] text-muted-foreground font-bold mt-1">Hora: {format(parseISO(selectedRegistroDetails.created_at), 'HH:mm')}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM Retorno</p>
                <p className="font-black text-foreground">{selectedRegistroDetails.km_final ? `${selectedRegistroDetails.km_final.toLocaleString('pt-BR')} km` : '---'}</p>
                {selectedRegistroDetails.km_final && (
                  <p className="text-[10px] text-muted-foreground font-bold mt-1">Hora: {format(parseISO(selectedRegistroDetails.updated_at), 'HH:mm')}</p>
                )}
              </div>
            </div>
            
            {(selectedRegistroDetails.km_final && selectedRegistroDetails.km_inicial) && (
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex justify-between items-center">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Distância Rodada</p>
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
