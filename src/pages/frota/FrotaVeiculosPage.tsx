import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useUpsertVeiculo, useDeleteVeiculo, useVeiculoAutorizacoes, useToggleVeiculoAutorizacao, useAbastecimentos } from '../../hooks/useFrota'
import { useAdminUsers } from '../../hooks/useUsers'
import { useAuth } from '../../contexts/AuthContext'
import { useFuncionarios } from '../../hooks/useFuncionarios'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { 
  Plus, Search, Truck, Edit, Trash2, Users, CheckCircle2, 
  ShieldAlert, Car, Bike, Wrench, BarChart3, AlertCircle,
  Droplet, Gauge, TrendingUp, UserCheck, Calendar
} from 'lucide-react'
import { cn } from '../../lib/utils'

const VEICULO_TIPO_MARCAS_MODELOS: Record<string, Record<string, string[]>> = {
  carro: {
    'Volkswagen': ['Gol', 'Saveiro', 'Voyage', 'Polo', 'Virtus', 'Amarok', 'Nivus', 'T-Cross', 'Taos', 'Jetta', 'Fox', 'Up!', 'Tiguan', 'Parati', 'Kombi'],
    'Fiat': ['Uno', 'Mobi', 'Argo', 'Strada', 'Toro', 'Fiorino', 'Ducato', 'Cronos', 'Pulse', 'Fastback', 'Siena', 'Palio', 'Punto', 'Doblo'],
    'Chevrolet': ['Onix', 'Onix Plus', 'Prisma', 'Montana', 'S10', 'Spin', 'Tracker', 'Cruze', 'Equinox', 'Trailblazer', 'Cobalt', 'Celta', 'Classic'],
    'Ford': ['Ka', 'Ranger', 'F-150', 'Transit', 'Maverick', 'Bronco', 'Mustang', 'EcoSport', 'Fiesta', 'Focus', 'Courier'],
    'Toyota': ['Etios', 'Yaris', 'Corolla', 'Corolla Cross', 'Hilux', 'SW4', 'RAV4', 'Bandeirante'],
    'Hyundai': ['HB20', 'HB20S', 'Creta', 'Tucson', 'Santa Fe', 'HR', 'IX35'],
    'Jeep': ['Renegade', 'Compass', 'Commander', 'Wrangler', 'Gladiator'],
    'Renault': ['Kwid', 'Stepway', 'Logan', 'Duster', 'Oroch', 'Captur', 'Master', 'Sandero', 'Kangoo'],
    'Nissan': ['Kicks', 'Versa', 'Sentra', 'Frontier', 'March', 'Livina'],
    'Honda': ['Civic', 'HR-V', 'City', 'CR-V', 'Fit', 'WR-V'],
    'Peugeot': ['208', '2008', '3008', 'Expert', 'Boxer', 'Partner', '207', '206'],
    'Citroën': ['C3', 'C4 Cactus', 'Jumpy', 'Jumper', 'Berlingo', 'Aircross'],
    'Mitsubishi': ['L200 Triton', 'Eclipse Cross', 'Pajero', 'Outlander', 'ASX', 'Lancer'],
    'Kia': ['Sportage', 'Sorento', 'Cerato', 'Bongo', 'Soul'],
    'Chery': ['Tiggo 2', 'Tiggo 5X', 'Tiggo 7', 'Tiggo 8', 'Arrizo 6', 'QQ'],
    'Jac': ['T40', 'T50', 'T60', 'V260'],
    'Outra': ['Outro', 'Modelo Desconhecido']
  },
  moto: {
    'Yamaha': ['Factor 150', 'Fazer 150', 'Fazer 250', 'Crosser 150', 'Lander 250', 'NMAX', 'XMAX', 'MT-03', 'MT-07', 'MT-09', 'XT 660', 'Ténéré', 'YBR 125', 'Neo'],
    'Honda': ['CG 160 Start', 'CG 160 Fan', 'CG 160 Titan', 'Biz 110i', 'Biz 125', 'Bros 160', 'XRE 190', 'XRE 300', 'CB 300F', 'CB 500X', 'PCX', 'Elite 125', 'NXR 150', 'CG 150', 'Pop 110i', 'Tornado'],
    'Suzuki': ['V-Strom', 'Burgman', 'Yes 125', 'Intruder', 'GSX'],
    'Kawasaki': ['Ninja', 'Z400', 'Z900', 'Versys'],
    'BMW': ['G 310 GS', 'F 850 GS', 'R 1250 GS'],
    'Triumph': ['Tiger 900', 'Tiger 1200', 'Bonneville'],
    'Dafra': ['Citycom', 'Apache', 'NH 190', 'Horizon'],
    'Shineray': ['XY 50', 'Jet 50', 'Worker 125', 'Jef 150'],
    'Haojue': ['DK 150', 'Chopper Road', 'DR 160', 'Master Ride'],
    'Can-Am': ['Outlander', 'Maverick', 'Renegade', 'Defender'],
    'Polaris': ['Sportsman', 'RZR', 'Ranger', 'General'],
    'Outra': ['Outra Moto', 'Modelo Desconhecido']
  },
  caminhao: {
    'Scania': ['Série G', 'Série P', 'Série R', 'Série S', 'Série T', '113', '124'],
    'Volvo': ['FH', 'FM', 'FMX', 'VM', 'NH', 'NL'],
    'Mercedes-Benz': ['Accelo', 'Atego', 'Axor', 'Actros', 'Sprinter', 'Arocs', '1113', '1620', '1938', '710'],
    'Volkswagen': ['Delivery', 'Constellation', 'Meteor', 'Worker', 'Titan'],
    'Iveco': ['Daily', 'Tector', 'Hi-Way', 'Stralis', 'S-Way', 'Cursor', 'Trakker'],
    'DAF': ['XF', 'CF'],
    'Ford': ['Cargo', 'F-4000', 'F-350', 'F-14000', 'F-12000'],
    'Agrale': ['Série A', 'Série S', 'Linha TX'],
    'Outra': ['Outro Caminhão']
  },
  cacamba: {
    'Mercedes-Benz': ['Atego Caçamba', 'Axor Caçamba', 'Arocs Caçamba', '1620 Caçamba'],
    'Volkswagen': ['Constellation Caçamba', 'Worker Caçamba'],
    'Volvo': ['VM Caçamba', 'FMX Caçamba'],
    'Scania': ['Série G Caçamba', 'Série P Caçamba'],
    'Ford': ['Cargo Caçamba'],
    'Iveco': ['Tector Caçamba'],
    'Outra': ['Outra Caçamba']
  },
  compactador: {
    'Volkswagen': ['Constellation Lixo', 'Delivery Lixo'],
    'Mercedes-Benz': ['Atego Lixo', 'Accelo Lixo'],
    'Ford': ['Cargo Lixo'],
    'Iveco': ['Tector Lixo'],
    'Outra': ['Outro Compactador']
  },
  trator: {
    'John Deere': ['Trator Agrícola', 'Trator de Esteira 700J', 'Retroescavadeira 310L'],
    'New Holland': ['Trator TL', 'Trator TT', 'Retroescavadeira B90B'],
    'Massey Ferguson': ['Trator Série 4700', 'Trator Série 5700', 'Trator Série 6700'],
    'Valtra': ['Trator Linha A', 'Trator Linha BM', 'Trator Linha BH'],
    'Case': ['Trator Magnum', 'Retroescavadeira 580N'],
    'Caterpillar': ['Trator de Esteira', 'Retroescavadeira'],
    'JCB': ['Retroescavadeira 3CX', 'Retroescavadeira 4CX'],
    'Yanmar': ['Trator Agrícola Solis'],
    'Outra': ['Outro Trator']
  },
  escavadeira: {
    'Caterpillar': ['Escavadeira Hidráulica', 'Miniescavadeira'],
    'Komatsu': ['Escavadeira PC200'],
    'John Deere': ['Escavadeira 210G'],
    'New Holland': ['Escavadeira E215C'],
    'Case': ['Escavadeira CX220C'],
    'JCB': ['Escavadeira JS200', 'Miniescavadeira'],
    'SANY': ['Escavadeira'],
    'XCMG': ['Escavadeira'],
    'Yanmar': ['Miniescavadeira ViO'],
    'Outra': ['Outra Escavadeira']
  },
  outro: {
    'Bobcat': ['Minicarregadeira S150', 'Minicarregadeira S530', 'Miniescavadeira E35'],
    'Caterpillar': ['Motoniveladora', 'Pá Carregadeira', 'Rolo Compactador', 'Minicarregadeira (Bobcat)'],
    'JCB': ['Pá Carregadeira', 'Loadall'],
    'Komatsu': ['Pá Carregadeira WA320', 'Motoniveladora GD655'],
    'John Deere': ['Pá Carregadeira 524K'],
    'New Holland': ['Pá Carregadeira W130', 'Motoniveladora RG140'],
    'Case': ['Pá Carregadeira W20', 'Motoniveladora 865B'],
    'XCMG': ['Pá Carregadeira', 'Motoniveladora', 'Guindaste'],
    'SANY': ['Guindaste', 'Rolo Compactador'],
    'Liebherr': ['Escavadeira', 'Pá Carregadeira', 'Guindaste'],
    'Outra': ['Outro Equipamento']
  }
}


export function FrotaVeiculosPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: veiculos = [], isLoading } = useVeiculos(user?.profile?.id, user?.isAdmin)
  const { data: abastecimentos = [], isLoading: loadAbastecimentos } = useAbastecimentos()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('frota_veiculos', 'gerenciar')
  const { toast } = useToast()
  
  const upsertMutation = useUpsertVeiculo()
  const deleteMutation = useDeleteVeiculo()

  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState<any>({
    placa: '', tipo_veiculo: 'carro', modelo: '', marca: '', ano: new Date().getFullYear(), km_atual: 0, km_proxima_troca_oleo: 0, status: 'ativo'
  })

  // Authorizations state
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [selectedVeiculo, setSelectedVeiculo] = useState<any>(null)
  const [authSearch, setAuthSearch] = useState('')

  const { data: users = [], isLoading: loadingUsers } = useAdminUsers()
  const { data: physicalFuncs = [], isLoading: loadingFuncs } = useFuncionarios()
  const { data: authorizedUserIds = [], isLoading: loadingAuths } = useVeiculoAutorizacoes(selectedVeiculo?.id)
  const toggleAuthMutation = useToggleVeiculoAutorizacao()

  const { data: allTeamsData = [] } = useQuery<any[]>({
    queryKey: ['all-teams-with-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipe_membros').select('equipe_id, funcionario_id, equipes(id, nome)')
      if (error) throw error
      return data || []
    }
  })

  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'manutencao' | 'inativo'>('todos')

  const stats = React.useMemo(() => {
    return {
      total: veiculos.length,
      ativos: veiculos.filter(v => v.status === 'ativo').length,
      manutencao: veiculos.filter(v => v.status === 'manutencao').length,
      inativos: veiculos.filter(v => v.status === 'inativo').length,
    }
  }, [veiculos])

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'moto':
        return <Bike className="w-5 h-5" />
      case 'trator':
      case 'escavadeira':
        return <Wrench className="w-5 h-5" />
      case 'carro':
        return <Car className="w-5 h-5" />
      default:
        return <Truck className="w-5 h-5" />
    }
  }

  const filtered = veiculos.filter(v => {
    const matchesSearch = 
      v.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.marca.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'todos' || v.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const combinedDrivers = React.useMemo(() => {
    // 1. Start with all physical employees
    const list = physicalFuncs.map(f => {
      const match = users.find(u => {
        const uCpf = u.cpf ? u.cpf.replace(/\D/g, '') : ''
        const fCpf = f.cpf ? f.cpf.replace(/\D/g, '') : ''
        return (uCpf && fCpf && uCpf === fCpf) || (u.nome.toLowerCase().trim() === f.nome.toLowerCase().trim())
      })

      const teamMatch = allTeamsData.find(t => t.funcionario_id === f.id)
      const teamName = teamMatch?.equipes?.nome || null

      return {
        id: match ? match.id : `func_${f.id}`,
        profileId: match?.id || null,
        funcionarioId: f.id as string | null,
        nome: f.nome,
        cpf: f.cpf || '',
        cargo: f.cargo,
        equipe: teamName,
        isEmployee: true,
        cpf_formatado: f.cpf || 'Não informado'
      }
    })

    // 2. Add system users who are not physical employees
    users.forEach(u => {
      const alreadyIncluded = list.some(item => {
        if (item.profileId === u.id) return true
        const uCpf = u.cpf ? u.cpf.replace(/\D/g, '') : ''
        const itemCpf = item.cpf ? item.cpf.replace(/\D/g, '') : ''
        return (uCpf && itemCpf && uCpf === itemCpf) || (u.nome.toLowerCase().trim() === item.nome.toLowerCase().trim())
      })

      if (!alreadyIncluded) {
        list.push({
          id: u.id,
          profileId: u.id,
          funcionarioId: null,
          nome: u.nome,
          cpf: u.cpf || '',
          cargo: 'Apenas Usuário',
          equipe: null,
          isEmployee: false,
          cpf_formatado: u.cpf || 'Não informado'
        })
      }
    })

    return list
  }, [users, physicalFuncs, allTeamsData])

  const filteredUsers = React.useMemo(() => {
    const searchLower = authSearch.toLowerCase()
    return combinedDrivers.filter(u => 
      u.nome.toLowerCase().includes(searchLower) ||
      (u.cpf && u.cpf.includes(searchLower)) ||
      (u.cargo && u.cargo.toLowerCase().includes(searchLower))
    )
  }, [combinedDrivers, authSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        ...formData,
        placa: formData.placa.toUpperCase(),
        usuario_responsavel_id: formData.usuario_responsavel_id || user?.profile?.id
      }
      if (!formData.id) {
        payload.criado_por = user?.profile?.id
      } else {
        delete payload.criado_por
      }
      await upsertMutation.mutateAsync(payload)
      toast('Veículo salvo com sucesso!', 'success')
      setModalOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.')) {
      try {
        await deleteMutation.mutateAsync(id)
        toast('Veículo excluído.', 'success')
      } catch (err: any) {
        toast(err.message, 'error')
      }
    }
  }

  const openEdit = (v: any) => {
    setFormData(v)
    setModalOpen(true)
  }

  const openNew = () => {
    setFormData({
      placa: '', tipo_veiculo: 'carro', modelo: '', marca: 'Volkswagen', ano: new Date().getFullYear(), km_atual: 0, km_proxima_troca_oleo: 0, status: 'ativo'
    })
    setModalOpen(true)
  }

  const handleToggleAuth = async (driver: any, isAuthorized: boolean) => {
    if (!selectedVeiculo) return
    try {
      let targetProfileId = driver.profileId

      // Se o funcionário ainda não tiver um perfil no sistema, crie um na hora!
      if (!targetProfileId) {
        const cleanCpf = driver.cpf ? driver.cpf.replace(/\D/g, '') : ''
        const fallbackCpf = cleanCpf || `temp_${Math.random().toString(36).substr(2, 9)}`
        
        const { data: newProfile, error: profileErr } = await supabase
          .from('profiles')
          .insert({
            cpf: fallbackCpf,
            senha: '1234',
            nome: driver.nome,
            ativo: true
          })
          .select()
          .single()

        if (profileErr) throw profileErr
        targetProfileId = newProfile.id
        
        // Invalida a query para que o novo perfil apareça na lista de imediato
        await qc.invalidateQueries({ queryKey: ['admin-users'] })
      }

      await toggleAuthMutation.mutateAsync({
        veiculoId: selectedVeiculo.id,
        usuarioId: targetProfileId,
        authorized: !isAuthorized
      })
      toast(isAuthorized ? 'Autorização removida.' : 'Funcionário autorizado com sucesso!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const openAuthManager = (v: any) => {
    setSelectedVeiculo(v)
    setAuthSearch('')
    setAuthModalOpen(true)
  }

  if (isLoading) return <div className="min-h-screen bg-background"><TopHeader title="Veículos" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Veículos da Frota" subtitle="Gestão de cadastro, status e autorizações de motoristas" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-6">
        
        {/* Telemetry Stats Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border/50 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider leading-none">Frota Total</p>
              <h3 className="text-2xl font-black text-foreground mt-1.5">{stats.total}</h3>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider leading-none">Ativos</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1.5">{stats.ativos}</h3>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider leading-none">Em Manutenção</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1.5">{stats.manutencao}</h3>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-lg group-hover:scale-125 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider leading-none">Inativos</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1.5">{stats.inativos}</h3>
            </div>
          </div>
        </div>

        {/* Filter & Action Bar */}
        <div className="bg-card border border-border/50 rounded-[2.5rem] p-4 flex flex-col lg:flex-row gap-4 justify-between items-center shadow-md relative overflow-hidden backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative min-w-full sm:min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input 
                type="text" 
                placeholder="Pesquisar placa ou modelo..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/40 focus:border-primary focus:bg-card rounded-2xl text-xs font-bold focus:ring-0 text-foreground transition-all"
              />
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/30 p-1.5 rounded-2xl overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              {(['todos', 'ativo', 'manutencao', 'inativo'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                    statusFilter === tab 
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {tab === 'todos' ? 'Todos' : tab === 'ativo' ? 'Ativos' : tab === 'manutencao' ? 'Manutenção' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>

          {canManage && (
            <button onClick={openNew} className="w-full lg:w-auto px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 cursor-pointer shrink-0">
              <Plus className="w-4 h-4" /> Novo Veículo
            </button>
          )}
        </div>

        {/* Vehicles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(v => {
            const vAbastecimentos = abastecimentos.filter(a => a.veiculo_id === v.id).sort((a, b) => a.km_no_momento - b.km_no_momento);
            let mediaKmL = '---';
            if (vAbastecimentos.length >= 2) {
              const dist = vAbastecimentos[vAbastecimentos.length - 1].km_no_momento - vAbastecimentos[0].km_no_momento;
              const litros = vAbastecimentos.slice(1).reduce((acc, r) => acc + Number(r.litros), 0);
              if (dist > 0 && litros > 0) mediaKmL = (dist / litros).toFixed(2);
            }

            const kmParaTroca = v.km_proxima_troca_oleo - v.km_atual
            // Intervalo de óleo: 1000 km para carro/moto, 10000 km para outros
            const intervaloOleo = (v.tipo_veiculo === 'carro' || v.tipo_veiculo === 'moto') ? 1000 : 10000
            const oilLifePercent = kmParaTroca > 0 ? Math.max(0, Math.min(100, (kmParaTroca / intervaloOleo) * 100)) : 0
            const isOilCritical = (v.tipo_veiculo === 'carro' || v.tipo_veiculo === 'moto') ? kmParaTroca <= 100 : kmParaTroca <= 500
            const isOilCaution = (v.tipo_veiculo === 'carro' || v.tipo_veiculo === 'moto') ? kmParaTroca <= 200 : kmParaTroca <= 1500
            const isOilOverdue = kmParaTroca < 0

            // Previsão de óleo com base na média de KM diária
            const mediaDiaria = Number(v.media_km_diaria) || 0
            let dataPrevisaoOleo = ''
            let diasRestantes = 0
            if (kmParaTroca > 0 && mediaDiaria > 0) {
              diasRestantes = Math.round(kmParaTroca / mediaDiaria)
              const dataPrevista = new Date()
              dataPrevista.setDate(dataPrevista.getDate() + diasRestantes)
              const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
              const diaSemana = diasSemana[dataPrevista.getDay()]
              const dia = String(dataPrevista.getDate()).padStart(2, '0')
              const mes = String(dataPrevista.getMonth() + 1).padStart(2, '0')
              const ano = dataPrevista.getFullYear()
              dataPrevisaoOleo = `${dia}/${mes}/${ano} (${diaSemana})`
            }

                        return (
              <div
                key={v.id}
                className={cn(
                  "border rounded-[2.5rem] p-6 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all relative overflow-hidden backdrop-blur-md group",
                  isOilOverdue 
                    ? "bg-rose-500/[0.02] border-rose-500/30 hover:border-rose-500/50 shadow-md shadow-rose-500/5"
                    : isOilCritical 
                    ? "bg-amber-500/[0.02] border-amber-500/30 hover:border-amber-500/50 shadow-md shadow-amber-500/5"
                    : v.status === 'ativo' 
                    ? "bg-emerald-500/[0.01] border-emerald-500/15 hover:border-emerald-500/35" 
                    : v.status === 'manutencao' 
                    ? "bg-amber-500/[0.02] border-amber-500/20 hover:border-amber-500/40" 
                    : "bg-rose-500/[0.01] border-rose-500/20 hover:border-rose-500/35"
                )}
              >
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1.5",
                  isOilOverdue ? "bg-rose-500 animate-pulse shadow-md shadow-rose-500/50" :
                  isOilCritical ? "bg-amber-500 animate-pulse shadow-md shadow-amber-500/50" :
                  v.status === 'ativo' ? "bg-emerald-500/30" : 
                  v.status === 'manutencao' ? "bg-amber-500/30" : "bg-rose-500/30"
                )} />

                {/* Brazilian Mercosul Plate & Status (Original Proportion, next to status tags, No QR Code) */}
                <div className="flex items-start justify-between mb-4 mt-2 shrink-0">
                  {/* High-Fidelity Compact Mercosul Plate */}
                  <div className="relative group/plate shrink-0">
                    <div className="w-[170px] h-[56px] bg-white border-[2px] border-zinc-950 rounded-[6px] overflow-hidden flex flex-col justify-between select-none font-sans relative shadow-[0_1.5px_3px_rgba(0,0,0,0.15)] shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.06)] transform group-hover/plate:scale-[1.02] transition-transform duration-200">
                      {/* Embossed effect border */}
                      <div className="absolute inset-[0.25px] border border-zinc-150 pointer-events-none rounded-[5px]" />

                      {/* Blue header bar */}
                      <div className="w-full h-[15px] bg-[#0033A0] flex items-center justify-between px-2 border-b-[1.5px] border-zinc-950 z-10 shrink-0">
                        {/* Mercosul logo */}
                        <div className="relative w-2.5 h-2.5 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current animate-pulse">
                            <circle cx="50" cy="50" r="42" stroke="white" strokeWidth="6" fill="none" opacity="0.8" />
                            <polygon points="50,16 53,24 61,24 55,29 57,37 50,32 43,37 45,29 39,24 47,24" />
                            <polygon points="50,84 52,78 58,78 53,74 55,67 50,71 45,67 47,74 42,78 48,78" />
                            <polygon points="16,50 22,52 22,58 25,54 31,55 28,50 31,45 25,46 22,42 22,48" />
                            <polygon points="84,50 78,52 78,58 75,54 69,55 72,50 69,45 75,46 78,42 78,48" />
                            <circle cx="62" cy="60" r="3.5" fill="white" />
                          </svg>
                        </div>

                        {/* BRASIL Text */}
                        <span className="text-[8px] text-white font-extrabold tracking-[0.25em] uppercase leading-none font-sans drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.3)]">
                          BRASIL
                        </span>

                        {/* Brazil Flag (Sharp Vector SVG) */}
                        <svg viewBox="0 0 720 500" className="w-[16px] h-[11px] rounded-[1px] shadow-[0_0.5px_1px_rgba(0,0,0,0.25)] shrink-0 select-none">
                          <rect width="720" height="500" fill="#009b3a" />
                          <polygon points="360,40 640,250 360,460 80,250" fill="#fedf00" />
                          <circle cx="360" cy="250" r="105" fill="#002776" />
                          <path d="M255,250 Q360,200 465,250" stroke="white" strokeWidth="15" fill="none" />
                        </svg>
                      </div>

                      {/* Plate Characters Container (flex-centered) */}
                      <div className="w-full flex-1 flex items-center justify-center relative px-2 bg-white">
                        <span className="text-[22px] sm:text-[24px] font-black text-zinc-900 tracking-[0.08em] uppercase font-mono select-all leading-none drop-shadow-[0.5px_0.5px_0px_rgba(0,0,0,0.18)] pt-0.5">
                          {v.placa}
                        </span>

                        {/* Small BR country seal watermark */}
                        <span className="text-[5.5px] font-black text-zinc-400 absolute bottom-[2px] right-2 select-none tracking-tighter opacity-80">
                          BR
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Pills and Warnings */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none",
                      v.status === 'ativo' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                      v.status === 'manutencao' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    )}>
                      {v.status === 'ativo' ? '● Ativo' : v.status === 'manutencao' ? '🔧 Manutenção' : '✕ Inativo'}
                    </span>

                    {isOilOverdue && (
                      <span className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-md shadow-rose-500/25 border border-rose-600 leading-none">
                        ⚠️ Óleo Vencido
                      </span>
                    )}
                    {!isOilOverdue && isOilCritical && (
                      <span className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-md shadow-amber-500/25 border border-amber-600 leading-none">
                        ⚠️ Óleo Crítico
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shadow-inner shrink-0",
                    v.status === 'ativo' ? "bg-emerald-500/10 text-emerald-600" :
                    v.status === 'manutencao' ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"
                  )}>
                    {getVehicleIcon(v.tipo_veiculo)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-foreground truncate uppercase">{v.marca} {v.modelo}</h4>
                    <p className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-wider">Ano {v.ano} • {v.tipo_veiculo}</p>
                  </div>
                </div>

                {/* Telemetry Grid Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* KM Atual */}
                  <div className="bg-muted/30 border border-border/30 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Gauge className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span className="text-[9px] font-black uppercase tracking-wider">KM Atual</span>
                    </div>
                    <p className="text-xs font-black text-foreground">{v.km_atual.toLocaleString('pt-BR')} km</p>
                  </div>

                  {/* Média Diária */}
                  <div className="bg-muted/30 border border-border/30 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Média Diária</span>
                    </div>
                    <p className="text-xs font-black text-foreground">
                      {v.media_km_diaria ? `${v.media_km_diaria.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km` : '---'}
                    </p>
                  </div>

                  {/* Média Combustível */}
                  <div className="col-span-2 bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3 flex items-center justify-between hover:bg-indigo-500/10 transition-colors">
                    <div className="flex items-center gap-1.5 text-indigo-600/80">
                      <Droplet className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Rendimento KM/L</span>
                    </div>
                    <p className="text-xs font-black text-indigo-600">{mediaKmL !== '---' ? `${mediaKmL} km/l` : 'Sem dados'}</p>
                  </div>
                </div>

                {/* Mini Odometer Gauge / Oil Change Life Tracker */}
                <div className="bg-muted/35 border border-border/25 rounded-2xl p-3.5 mb-4">
                  {/* Warning alert banner when oil is critical or overdue */}
                  {(isOilOverdue || isOilCritical) && (
                    <div className={cn(
                      "mb-3 px-3 py-2.5 rounded-2xl border flex items-center gap-2.5 shadow-sm transition-all",
                      isOilOverdue 
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-500 dark:bg-rose-500/5" 
                        : "bg-amber-500/10 border-amber-500/20 text-amber-500 dark:bg-amber-500/5"
                    )}>
                      <Droplet className={cn("w-4 h-4 shrink-0", isOilOverdue ? "animate-bounce" : "animate-pulse")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider leading-none">
                          {isOilOverdue ? "Troca de Óleo Vencida!" : "Atenção: Troca de Óleo Próxima"}
                        </p>
                        <p className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-90">
                          {isOilOverdue 
                            ? `Vencido há ${Math.abs(kmParaTroca).toLocaleString('pt-BR')} km` 
                            : `Faltam apenas ${kmParaTroca.toLocaleString('pt-BR')} km`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                    <div className="flex items-center gap-1">
                      <Droplet className={cn("w-3.5 h-3.5", isOilCritical || isOilOverdue ? "text-rose-500" : "text-primary")} />
                      <span>Vida do Óleo</span>
                    </div>
                    <span className={cn(
                      "font-black text-[9px]",
                      isOilOverdue ? "text-rose-500" :
                      isOilCritical ? "text-rose-500 animate-pulse" : "text-foreground"
                    )}>
                      {isOilOverdue ? 'Vencida!' : `${Math.round(oilLifePercent)}%`}
                    </span>
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-2 bg-muted/65 rounded-full overflow-hidden border border-border/10">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isOilOverdue ? "bg-rose-500 w-full animate-pulse shadow-lg shadow-rose-500/25" :
                        isOilCritical ? "bg-rose-500 w-full animate-pulse shadow-lg shadow-rose-500/25" :
                        isOilCaution ? "bg-amber-500" : "bg-emerald-500"
                      )} 
                      style={{ width: isOilOverdue ? '100%' : `${oilLifePercent}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-[8px] font-bold text-muted-foreground/75 mt-1.5 uppercase tracking-wider">
                    <span>Revisão: {v.km_proxima_troca_oleo.toLocaleString('pt-BR')} km</span>
                    <span className={cn(isOilCritical || isOilOverdue ? "text-rose-500" : "")}>
                      {isOilOverdue 
                        ? `Vencido há ${Math.abs(kmParaTroca).toLocaleString('pt-BR')} km` 
                        : `Faltam ${kmParaTroca.toLocaleString('pt-BR')} km`
                      }
                    </span>
                  </div>

                  {/* Oil Change Forecast Badge */}
                  <div className="mt-3 px-3 py-2 bg-muted/30 border border-border/20 rounded-xl flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[7.5px] font-black uppercase text-muted-foreground/60 tracking-wider leading-none">Previsão da Troca</p>
                        <p className="text-[10px] font-black text-foreground truncate mt-0.5 leading-none">
                          {isOilOverdue ? (
                            <span className="text-rose-500 uppercase">⚠️ Vencida! Realizar Troca</span>
                          ) : dataPrevisaoOleo ? (
                            dataPrevisaoOleo
                          ) : (
                            <span className="text-muted-foreground/85 italic font-bold">Sem dados de média</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {kmParaTroca > 0 && mediaDiaria > 0 && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[8px] font-black uppercase tracking-wider leading-none shrink-0">
                        {diasRestantes === 1 ? 'Amanhã' : `~${diasRestantes} dias`}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(v)} className="flex-1 py-2.5 bg-muted/40 hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all border border-border/40 hover:border-primary/20 cursor-pointer">
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="w-10 h-10 bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground rounded-xl flex items-center justify-center transition-all border border-border/40 hover:border-rose-500/20 cursor-pointer" title="Excluir Veículo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => openAuthManager(v)} 
                      className="w-full py-2.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all border border-primary/20 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Liberar Motoristas
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground bg-card border border-border/50 rounded-3xl shadow-sm">
              <Truck className="w-12 h-12 mx-auto mb-4 opacity-25" />
              <p className="font-black text-sm uppercase tracking-wider">Nenhum veículo encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Vehicle Edit/Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={formData.id ? 'Editar Veículo' : 'Novo Veículo'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Placa</label>
              <input required type="text" value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground" placeholder="ABC1234" maxLength={7} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Status</label>
              <select required value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground">
                <option value="ativo">Ativo</option>
                <option value="manutencao">Em Manutenção</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Tipo de Veículo</label>
              <select 
                required 
                value={formData.tipo_veiculo} 
                onChange={e => {
                  const newType = e.target.value
                  const availableBrands = Object.keys(VEICULO_TIPO_MARCAS_MODELOS[newType] || {})
                  const defaultBrand = availableBrands[0] || ''
                  const defaultModel = VEICULO_TIPO_MARCAS_MODELOS[newType]?.[defaultBrand]?.[0] || ''
                  setFormData({
                    ...formData,
                    tipo_veiculo: newType,
                    marca: defaultBrand,
                    modelo: defaultModel
                  })
                }} 
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground"
              >
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
                <option value="caminhao">Caminhão</option>
                <option value="cacamba">Caçamba</option>
                <option value="compactador">Compactador</option>
                <option value="trator">Trator</option>
                <option value="escavadeira">Escavadeira</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Marca</label>
              <select 
                required 
                value={formData.marca} 
                onChange={e => {
                  const selectedBrand = e.target.value
                  const models = VEICULO_TIPO_MARCAS_MODELOS[formData.tipo_veiculo]?.[selectedBrand] || []
                  setFormData({
                    ...formData,
                    marca: selectedBrand,
                    modelo: models[0] || ''
                  })
                }} 
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground"
              >
                <option value="">Selecione...</option>
                {Object.keys(VEICULO_TIPO_MARCAS_MODELOS[formData.tipo_veiculo] || {}).map(marca => (
                  <option key={marca} value={marca}>{marca}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Modelo</label>
              <select 
                required 
                value={formData.modelo} 
                onChange={e => setFormData({...formData, modelo: e.target.value})} 
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground" 
                disabled={!formData.marca}
              >
                <option value="">Selecione...</option>
                {(VEICULO_TIPO_MARCAS_MODELOS[formData.tipo_veiculo]?.[formData.marca] || []).map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Ano</label>
              <input required type="number" value={formData.ano} onChange={e => setFormData({...formData, ano: Number(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">KM Atual</label>
              <input required type="number" value={formData.km_atual} onChange={e => setFormData({...formData, km_atual: Number(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">KM Próx. Troca Óleo</label>
              <input required type="number" value={formData.km_proxima_troca_oleo} onChange={e => setFormData({...formData, km_proxima_troca_oleo: Number(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground text-primary" />
            </div>
          </div>

          <button disabled={upsertMutation.isPending} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mt-4 cursor-pointer">
            {upsertMutation.isPending ? 'Salvando...' : 'Salvar Veículo'}
          </button>
        </form>
      </Modal>

      {/* Modern Driver Vehicle Authorization Modal */}
      <Modal open={authModalOpen} onClose={() => setAuthModalOpen(false)} title={`Liberar Motoristas • ${selectedVeiculo?.placa}`}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground font-bold">Selecione quais funcionários têm autorização para dirigir e registrar dados deste veículo.</p>
          
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou CPF..." 
              value={authSearch} 
              onChange={e => setAuthSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-xs font-bold focus:ring-0 text-foreground outline-none transition-all"
            />
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-border/40 pr-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {loadingUsers || loadingFuncs || loadingAuths ? (
              <div className="py-8"><Loading text="Carregando motoristas..." /></div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground font-bold">Nenhum motorista encontrado.</div>
            ) : (
              filteredUsers.map(u => {
                const isAuthorized = u.profileId ? authorizedUserIds.includes(u.profileId) : false
                return (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-black text-foreground">{u.nome}</p>
                        {u.isEmployee ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                            {u.cargo || 'Funcionário'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Apenas Usuário
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">
                        CPF: {u.cpf_formatado} {u.equipe && `• Equipe: ${u.equipe}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleAuth(u, isAuthorized)}
                      disabled={toggleAuthMutation.isPending}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-sm cursor-pointer border",
                        isAuthorized 
                          ? "bg-emerald-500/10 hover:bg-rose-500/10 text-emerald-600 hover:text-rose-600 border-emerald-500/20 hover:border-rose-500/20" 
                          : "bg-muted/40 border-border/40 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                      )}
                    >
                      {isAuthorized ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Liberado
                        </>
                      ) : 'Bloqueado'}
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <button 
            onClick={() => setAuthModalOpen(false)} 
            className="w-full py-3.5 bg-muted text-muted-foreground hover:bg-muted-foreground/10 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </Modal>
    </div>
  )
}
