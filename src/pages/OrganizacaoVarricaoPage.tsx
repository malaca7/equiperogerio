import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { 
  MapPin, 
  Search, 
  Plus, 
  Layers, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Edit3, 
  Trash2, 
  Eye, 
  Filter, 
  Sparkles, 
  Building2, 
  Route, 
  ChevronRight, 
  Maximize2, 
  Compass, 
  ShieldCheck, 
  FileText, 
  Printer, 
  Download,
  Activity,
  UserCheck,
  ExternalLink,
  Target,
  Network
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { TopHeader } from '../components/layout/TopHeader'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

// Interface Definitions
export interface SetorVarricao {
  id: string
  codigo: string
  nome: string
  descricao: string
  cor: string
  equipeId?: string | null
  equipeNome: string
  encarregadoNome: string
  centroLat: number
  centroLng: number
  areaKm2: number
  poligono: [number, number][]
}

export interface RuaVarricao {
  id: string
  setorId: string
  nome: string
  trecho: string
  extensaoKm: number
  frequencia: 'Diária - Diurno' | 'Diária - Noturno' | '3x por Semana' | '2x por Semana'
  turno: 'Diurno' | 'Noturno' | 'Vespertino'
  equipeId?: string | null
  equipeNome: string
  encarregadoNome: string
  garisAlocados: number
  prioridade: 'Alta' | 'Média' | 'Baixa'
  status: 'Concluída' | 'Em Varrição' | 'Pendente'
  pontosRota: [number, number][]
}

// Initial Sample Data for Sweeping Organization (Recife / Metropolitan Example)
const INITIAL_SETORES: SetorVarricao[] = [
  {
    id: 'setor-1',
    codigo: 'SET-01',
    nome: 'Centro Histórico & Comercial',
    descricao: 'Área comercial densa, praças e vias de alto tráfego de pedestres.',
    cor: '#10b981',
    equipeNome: 'Equipe Alfa (Centro)',
    encarregadoNome: 'Carlos Eduardo',
    centroLat: -8.0628,
    centroLng: -34.8785,
    areaKm2: 3.4,
    poligono: [
      [-8.0585, -34.8845],
      [-8.0570, -34.8720],
      [-8.0680, -34.8710],
      [-8.0695, -34.8830],
    ]
  },
  {
    id: 'setor-2',
    codigo: 'SET-02',
    nome: 'Orla & Corredor Turístico',
    descricao: 'Avenida beira-mar, calçadão, quiosques e avenidas de grande fluxo.',
    cor: '#3b82f6',
    equipeNome: 'Equipe Bravo (Orla)',
    encarregadoNome: 'Marcos Rogério',
    centroLat: -8.1180,
    centroLng: -34.8960,
    areaKm2: 4.8,
    poligono: [
      [-8.1050, -34.8990],
      [-8.1030, -34.8910],
      [-8.1320, -34.8950],
      [-8.1340, -34.9030],
    ]
  },
  {
    id: 'setor-3',
    codigo: 'SET-03',
    nome: 'Zona Norte - Residencial & Praças',
    descricao: 'Bairros residenciais, corredores de ônibus e praças públicas.',
    cor: '#8b5cf6',
    equipeNome: 'Equipe Charlie (Norte)',
    encarregadoNome: 'Roberto Silva',
    centroLat: -8.0350,
    centroLng: -34.9000,
    areaKm2: 5.2,
    poligono: [
      [-8.0250, -34.9120],
      [-8.0220, -34.8900],
      [-8.0450, -34.8880],
      [-8.0480, -34.9100],
    ]
  },
  {
    id: 'setor-4',
    codigo: 'SET-04',
    nome: 'Distrito Industrial & Logístico',
    descricao: 'Vias largas, grandes galpões, avenidas de tráfego pesado.',
    cor: '#f59e0b',
    equipeNome: 'Equipe Delta (Industrial)',
    encarregadoNome: 'Antônio Peixoto',
    centroLat: -8.0850,
    centroLng: -34.9350,
    areaKm2: 6.1,
    poligono: [
      [-8.0720, -34.9500],
      [-8.0700, -34.9200],
      [-8.0980, -34.9180],
      [-8.1000, -34.9480],
    ]
  }
]

const INITIAL_RUAS: RuaVarricao[] = [
  {
    id: 'rua-1',
    setorId: 'setor-1',
    nome: 'Av. Conde da Boa Vista',
    trecho: 'Ponte Duarte Coelho até a Praça do Derby',
    extensaoKm: 2.3,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe Alfa (Centro)',
    encarregadoNome: 'Carlos Eduardo',
    garisAlocados: 8,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.0590, -34.8840],
      [-8.0595, -34.8870],
      [-8.0600, -34.8900],
      [-8.0605, -34.8930]
    ]
  },
  {
    id: 'rua-2',
    setorId: 'setor-1',
    nome: 'Rua da Aurora',
    trecho: 'Ponte Limoeiro até a Ponte Princesa Isabel',
    extensaoKm: 1.8,
    frequencia: 'Diária - Noturno',
    turno: 'Noturno',
    equipeNome: 'Equipe Alfa (Centro)',
    encarregadoNome: 'Carlos Eduardo',
    garisAlocados: 6,
    prioridade: 'Alta',
    status: 'Concluída',
    pontosRota: [
      [-8.0575, -34.8780],
      [-8.0610, -34.8790],
      [-8.0640, -34.8805]
    ]
  },
  {
    id: 'rua-3',
    setorId: 'setor-1',
    nome: 'Rua do Hospício & Imperatriz',
    trecho: 'Calçadão do Centro Comercial',
    extensaoKm: 1.4,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe Alfa (Centro)',
    encarregadoNome: 'Carlos Eduardo',
    garisAlocados: 5,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.0615, -34.8820],
      [-8.0630, -34.8810],
      [-8.0650, -34.8800]
    ]
  },
  {
    id: 'rua-4',
    setorId: 'setor-2',
    nome: 'Av. Boa Viagem',
    trecho: 'Segundo Jardim até a Feirinha de Boa Viagem',
    extensaoKm: 4.5,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe Bravo (Orla)',
    encarregadoNome: 'Marcos Rogério',
    garisAlocados: 12,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.1060, -34.8930],
      [-8.1140, -34.8950],
      [-8.1220, -34.8970],
      [-8.1300, -34.8990]
    ]
  },
  {
    id: 'rua-5',
    setorId: 'setor-2',
    nome: 'Av. Conselheiro Aguiar',
    trecho: 'Pina até o Parque Dona Lindu',
    extensaoKm: 4.2,
    frequencia: 'Diária - Noturno',
    turno: 'Noturno',
    equipeNome: 'Equipe Bravo (Orla)',
    encarregadoNome: 'Marcos Rogério',
    garisAlocados: 10,
    prioridade: 'Média',
    status: 'Pendente',
    pontosRota: [
      [-8.1070, -34.8960],
      [-8.1150, -34.8980],
      [-8.1230, -34.9000]
    ]
  },
  {
    id: 'rua-6',
    setorId: 'setor-3',
    nome: 'Av. Rosa e Silva',
    trecho: 'Clube Náutico até o Parque do Tamarineira',
    extensaoKm: 3.1,
    frequencia: '3x por Semana',
    turno: 'Diurno',
    equipeNome: 'Equipe Charlie (Norte)',
    encarregadoNome: 'Roberto Silva',
    garisAlocados: 6,
    prioridade: 'Média',
    status: 'Concluída',
    pontosRota: [
      [-8.0440, -34.8970],
      [-8.0380, -34.9000],
      [-8.0320, -34.9030]
    ]
  },
  {
    id: 'rua-7',
    setorId: 'setor-3',
    nome: 'Estrada do Encanamento',
    trecho: 'Casa Forte até o Arraial',
    extensaoKm: 2.6,
    frequencia: '3x por Semana',
    turno: 'Vespertino',
    equipeNome: 'Equipe Charlie (Norte)',
    encarregadoNome: 'Roberto Silva',
    garisAlocados: 5,
    prioridade: 'Baixa',
    status: 'Pendente',
    pontosRota: [
      [-8.0330, -34.9100],
      [-8.0300, -34.9150],
      [-8.0270, -34.9190]
    ]
  },
  {
    id: 'rua-8',
    setorId: 'setor-4',
    nome: 'Av. Marechal Mascarenhas de Moraes',
    trecho: 'Aeroporto até a Ponte da Imbiribeira',
    extensaoKm: 5.8,
    frequencia: '2x por Semana',
    turno: 'Noturno',
    equipeNome: 'Equipe Delta (Industrial)',
    encarregadoNome: 'Antônio Peixoto',
    garisAlocados: 8,
    prioridade: 'Média',
    status: 'Em Varrição',
    pontosRota: [
      [-8.0750, -34.9250],
      [-8.0850, -34.9300],
      [-8.0950, -34.9350]
    ]
  }
]

export function OrganizacaoVarricaoPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const queryEquipeId = searchParams.get('equipeId')

  // Real Supabase Queries
  const { data: dbEquipes = [] } = useQuery<any[]>({
    queryKey: ['equipes-varricao-integration'],
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, profiles(id, nome)')
      const { data: mem } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, cargo, status, setor)')

      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles?.nome).filter(Boolean),
        membrosCount: (mem || []).filter((m: any) => m.equipe_id === eq.id).length
      }))
    }
  })

  const { data: dbRegioes = [] } = useQuery<any[]>({
    queryKey: ['regioes-varricao-integration'],
    queryFn: async () => {
      const { data } = await supabase.from('regioes').select('*').order('nome')
      return data || []
    }
  })

  // Persistent Configuration from DB / Local
  const { data: dbSetores } = useConfiguracao<SetorVarricao[]>('varricao_setores', INITIAL_SETORES)
  const { data: dbRuas } = useConfiguracao<RuaVarricao[]>('varricao_ruas', INITIAL_RUAS)
  const updateConfig = useUpdateConfiguracao()

  const [setores, setSetores] = useState<SetorVarricao[]>(dbSetores || INITIAL_SETORES)
  const [ruas, setRuas] = useState<RuaVarricao[]>(dbRuas || INITIAL_RUAS)

  // Sync DB config
  useEffect(() => {
    if (dbSetores) setSetores(dbSetores)
  }, [dbSetores])

  useEffect(() => {
    if (dbRuas) setRuas(dbRuas)
  }, [dbRuas])

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSetorId, setSelectedSetorId] = useState<string>('todos')
  const [selectedEquipeIdFilter, setSelectedEquipeIdFilter] = useState<string>(queryEquipeId || 'todos')
  const [selectedTurno, setSelectedTurno] = useState<string>('todos')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [activeTab, setActiveTab] = useState<'mapa' | 'equipes' | 'ruas'>('mapa')
  const [hoveredRuaId, setHoveredRuaId] = useState<string | null>(null)

  // Sync URL search params into filter state
  useEffect(() => {
    if (queryEquipeId) {
      setSelectedEquipeIdFilter(queryEquipeId)
    }
  }, [queryEquipeId])

  // Modal States
  const [isModalRuaOpen, setIsModalRuaOpen] = useState(false)
  const [editingRua, setEditingRua] = useState<Partial<RuaVarricao> | null>(null)

  // Map Container Ref & Leaflet Instance
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  // Filtered List calculation
  const filteredRuas = useMemo(() => {
    return ruas.filter(rua => {
      const matchesSearch = 
        rua.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.trecho.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.equipeNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.encarregadoNome.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSetor = selectedSetorId === 'todos' || rua.setorId === selectedSetorId
      const matchesEquipe = selectedEquipeIdFilter === 'todos' || rua.equipeId === selectedEquipeIdFilter
      const matchesTurno = selectedTurno === 'todos' || rua.turno === selectedTurno
      const matchesStatus = selectedStatus === 'todos' || rua.status === selectedStatus

      return matchesSearch && matchesSetor && matchesEquipe && matchesTurno && matchesStatus
    })
  }, [ruas, searchTerm, selectedSetorId, selectedEquipeIdFilter, selectedTurno, selectedStatus])

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalSetores = setores.length
    const totalRuas = ruas.length
    const totalKm = ruas.reduce((acc, r) => acc + r.extensaoKm, 0)
    const totalGaris = ruas.reduce((acc, r) => acc + r.garisAlocados, 0)
    const emVarricao = ruas.filter(r => r.status === 'Em Varrição').length
    const concluidas = ruas.filter(r => r.status === 'Concluída').length
    const pendentes = ruas.filter(r => r.status === 'Pendente').length
    const pctConcluido = totalRuas > 0 ? Math.round((concluidas / totalRuas) * 100) : 0

    return { totalSetores, totalRuas, totalKm, totalGaris, emVarricao, concluidas, pendentes, pctConcluido }
  }, [setores, ruas])

  // Dynamic Leaflet Script & CSS Injection
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if ((window as any).L) {
      setLeafletLoaded(true)
    } else {
      const script = document.createElement('script')
      script.id = 'leaflet-js'
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => setLeafletLoaded(true)
      document.body.appendChild(script)
    }
  }, [])

  // Initialize and Render Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || activeTab !== 'mapa') return

    const L = (window as any).L
    if (!L) return

    if (leafletMapRef.current) {
      leafletMapRef.current.remove()
      leafletMapRef.current = null
    }

    const defaultCenter: [number, number] = [-8.0600, -34.8850]
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: true
    })

    leafletMapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | Gestão de Varrição',
      maxZoom: 18
    }).addTo(map)

    // Render Sector Polygons
    setores.forEach(setor => {
      if (setor.poligono && setor.poligono.length > 2) {
        const polygon = L.polygon(setor.poligono, {
          color: setor.cor,
          fillColor: setor.cor,
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '4, 6'
        }).addTo(map)

        polygon.bindTooltip(`<b>${setor.codigo} - ${setor.nome}</b><br/>${setor.equipeNome}`, {
          permanent: false,
          direction: 'center'
        })
      }
    })

    // Render Streets (Polylines)
    filteredRuas.forEach(rua => {
      const setor = setores.find(s => s.id === rua.setorId)
      const color = setor ? setor.cor : '#3b82f6'

      if (rua.pontosRota && rua.pontosRota.length > 1) {
        const isHovered = hoveredRuaId === rua.id
        const polyline = L.polyline(rua.pontosRota, {
          color: isHovered ? '#ef4444' : color,
          weight: isHovered ? 6 : 4,
          opacity: 0.85
        }).addTo(map)

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-bottom: 2px;">${rua.nome}</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">${rua.trecho}</div>
            <div style="display: flex; gap: 8px; font-size: 11px; margin-bottom: 4px;">
              <span><b>Extensão:</b> ${rua.extensaoKm} km</span>
              <span><b>Turno:</b> ${rua.turno}</span>
            </div>
            <div style="font-size: 11px; margin-bottom: 4px;"><b>Equipe:</b> ${rua.equipeNome}</div>
            <div style="font-size: 11px; margin-bottom: 6px;"><b>Encarregado:</b> ${rua.encarregadoNome}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; pt-2; margin-top: 4px;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${
                rua.status === 'Concluída' ? '#dcfce7' : rua.status === 'Em Varrição' ? '#dbeafe' : '#fef3c7'
              }; color: ${
                rua.status === 'Concluída' ? '#15803d' : rua.status === 'Em Varrição' ? '#1d4ed8' : '#b45309'
              };">${rua.status}</span>
              <span style="font-size: 11px; font-weight: 700; color: #0f172a;">${rua.garisAlocados} Garis</span>
            </div>
          </div>
        `

        polyline.bindPopup(popupHtml)

        const startPoint = rua.pontosRota[0]
        const customIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })

        L.marker(startPoint, { icon: customIcon }).addTo(map).bindPopup(`<b>Ponto Inicial:</b> ${rua.nome}`)
      }
    })

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [leafletLoaded, activeTab, filteredRuas, setores, hoveredRuaId])

  // Save changes to DB
  const saveRuasToDb = async (newRuas: RuaVarricao[]) => {
    setRuas(newRuas)
    try {
      await updateConfig.mutateAsync({ chave: 'varricao_ruas', valor: newRuas })
      toast('Lista de ruas atualizada com sucesso!', 'success')
    } catch {
      toast('Atualizado localmente.', 'info')
    }
  }

  // Handle Street Modal Save
  const handleSaveRua = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRua?.nome || !editingRua?.setorId) {
      toast('Preencha o nome da rua e selecione o setor.', 'warning')
      return
    }

    const selectedEquipe = dbEquipes.find(eq => eq.id === editingRua.equipeId)

    let updatedList: RuaVarricao[]
    if (editingRua.id) {
      updatedList = ruas.map(r => r.id === editingRua.id ? {
        ...(editingRua as RuaVarricao),
        equipeNome: selectedEquipe ? selectedEquipe.nome : (editingRua.equipeNome || 'Equipe Varrição'),
        encarregadoNome: selectedEquipe?.encarregados?.[0] || editingRua.encarregadoNome || 'Encarregado'
      } : r)
    } else {
      const newRua: RuaVarricao = {
        id: `rua-${Date.now()}`,
        setorId: editingRua.setorId || setores[0]?.id || 'setor-1',
        nome: editingRua.nome,
        trecho: editingRua.trecho || 'Trecho Principal',
        extensaoKm: Number(editingRua.extensaoKm) || 1.5,
        frequencia: editingRua.frequencia || 'Diária - Diurno',
        turno: editingRua.turno || 'Diurno',
        equipeId: editingRua.equipeId || null,
        equipeNome: selectedEquipe ? selectedEquipe.nome : (editingRua.equipeNome || 'Equipe Varrição'),
        encarregadoNome: selectedEquipe?.encarregados?.[0] || editingRua.encarregadoNome || 'Encarregado Responsável',
        garisAlocados: Number(editingRua.garisAlocados) || (selectedEquipe?.membrosCount || 4),
        prioridade: editingRua.prioridade || 'Média',
        status: editingRua.status || 'Pendente',
        pontosRota: editingRua.pontosRota || [[-8.0600, -34.8850], [-8.0620, -34.8880]]
      }
      updatedList = [...ruas, newRua]
    }

    saveRuasToDb(updatedList)
    setIsModalRuaOpen(false)
    setEditingRua(null)
  }

  // Delete Street
  const handleDeleteRua = (id: string) => {
    if (confirm('Deseja realmente remover esta rua da rota de varrição?')) {
      const updated = ruas.filter(r => r.id !== id)
      saveRuasToDb(updated)
    }
  }

  // Handle Status Quick Change
  const toggleRuaStatus = (rua: RuaVarricao) => {
    const nextStatus: Record<string, 'Pendente' | 'Em Varrição' | 'Concluída'> = {
      'Pendente': 'Em Varrição',
      'Em Varrição': 'Concluída',
      'Concluída': 'Pendente'
    }
    const newStatus = nextStatus[rua.status] || 'Pendente'
    const updated = ruas.map(r => r.id === rua.id ? { ...r, status: newStatus } : r)
    saveRuasToDb(updated)
  }

  return (
    <div className="min-h-screen bg-background pb-12 font-sans selection:bg-primary/20">
      <TopHeader title="Organização da Varrição" subtitle="Setores operacionais, equipes alocadas e mapeamento de ruas" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* Top Header & Integrated Quick Nav Links */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                Operação de Limpeza Urbana Integredada
              </span>
              {queryEquipeId && (
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                  Filtro por Equipe Ativo
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Route className="w-7 h-7 text-primary" />
              Mapeamento & Cobertura de Varrição
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Sincronizado com as Equipes do Supabase e com a página de Meta e Rota (Localidades).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Direct Quick Links to Equipes and Meta e Rota */}
            <Link
              to="/equipes"
              className="px-4 py-2.5 rounded-2xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold transition-all border border-border/50 flex items-center gap-1.5 shadow-sm"
            >
              <Network className="w-4 h-4 text-purple-500" />
              <span>Ver Equipes</span>
            </Link>

            <Link
              to="/escala/localidades"
              className="px-4 py-2.5 rounded-2xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold transition-all border border-border/50 flex items-center gap-1.5 shadow-sm"
            >
              <Target className="w-4 h-4 text-blue-500" />
              <span>Meta e Rota</span>
            </Link>

            <Button
              onClick={() => {
                setEditingRua({
                  setorId: setores[0]?.id,
                  frequencia: 'Diária - Diurno',
                  turno: 'Diurno',
                  prioridade: 'Média',
                  status: 'Pendente',
                  garisAlocados: 4,
                  extensaoKm: 1.5
                })
                setIsModalRuaOpen(true)
              }}
              className="rounded-2xl gap-2 text-xs uppercase tracking-wider font-bold shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Nova Rua / Trecho
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-2xl gap-2 text-xs font-bold border-border/60"
            >
              <Printer className="w-4 h-4" />
              Imprimir Rota
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
          
          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Setores</p>
              <h3 className="text-xl font-black text-foreground">{stats.totalSetores} <span className="text-xs font-normal text-muted-foreground">regiões</span></h3>
            </div>
          </div>

          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Total Mapeado</p>
              <h3 className="text-xl font-black text-foreground">{stats.totalKm.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">km</span></h3>
            </div>
          </div>

          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Garis em Campo</p>
              <h3 className="text-xl font-black text-foreground">{stats.totalGaris} <span className="text-xs font-normal text-muted-foreground">agentes</span></h3>
            </div>
          </div>

          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Em Varrição</p>
              <h3 className="text-xl font-black text-foreground">{stats.emVarricao} <span className="text-xs font-normal text-muted-foreground">ruas</span></h3>
            </div>
          </div>

          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Progresso do Dia</p>
                <span className="text-xs font-black text-primary">{stats.pctConcluido}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${stats.pctConcluido}%` }} />
              </div>
            </div>
          </div>

        </div>

        {/* View Switcher & Filters */}
        <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-3xl p-4 shadow-sm space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* View Tabs */}
            <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/40 w-fit">
              <button
                onClick={() => setActiveTab('mapa')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                  activeTab === 'mapa'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>Mapa Interativo</span>
              </button>

              <button
                onClick={() => setActiveTab('equipes')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                  activeTab === 'equipes'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-4 h-4 text-blue-500" />
                <span>Visão por Equipes ({setores.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('ruas')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                  activeTab === 'ruas'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Route className="w-4 h-4 text-purple-500" />
                <span>Tabela de Ruas ({filteredRuas.length})</span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por rua, trecho, equipe ou encarregado..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border/50 rounded-2xl text-xs font-bold text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {/* Filter Selectors Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros:</span>
            </div>

            {/* Equipes Supabase Filter */}
            <select
              value={selectedEquipeIdFilter}
              onChange={e => setSelectedEquipeIdFilter(e.target.value)}
              className="bg-muted/40 border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary/50"
            >
              <option value="todos">Todas as Equipes (Supabase)</option>
              {dbEquipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>

            {/* Setor Filter */}
            <select
              value={selectedSetorId}
              onChange={e => setSelectedSetorId(e.target.value)}
              className="bg-muted/40 border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary/50"
            >
              <option value="todos">Todos os Setores</option>
              {setores.map(s => (
                <option key={s.id} value={s.id}>{s.codigo} - {s.nome}</option>
              ))}
            </select>

            {/* Turno Filter */}
            <select
              value={selectedTurno}
              onChange={e => setSelectedTurno(e.target.value)}
              className="bg-muted/40 border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary/50"
            >
              <option value="todos">Todos os Turnos</option>
              <option value="Diurno">Diurno</option>
              <option value="Noturno">Noturno</option>
              <option value="Vespertino">Vespertino</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-muted/40 border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary/50"
            >
              <option value="todos">Todos os Status</option>
              <option value="Em Varrição">Em Varrição</option>
              <option value="Concluída">Concluída</option>
              <option value="Pendente">Pendente</option>
            </select>

            {(searchTerm || selectedSetorId !== 'todos' || selectedEquipeIdFilter !== 'todos' || selectedTurno !== 'todos' || selectedStatus !== 'todos') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedSetorId('todos')
                  setSelectedEquipeIdFilter('todos')
                  setSelectedTurno('todos')
                  setSelectedStatus('todos')
                  navigate('/escala/organizacao-varricao', { replace: true })
                }}
                className="text-xs font-bold text-rose-500 hover:underline ml-auto"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: INTERACTIVE MAP VIEW */}
        {activeTab === 'mapa' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Map Container */}
            <div className="lg:col-span-2 bg-card/70 border border-border/50 rounded-3xl overflow-hidden shadow-lg relative min-h-[550px] flex flex-col">
              
              {/* Map Title Overlay Header */}
              <div className="bg-card/90 backdrop-blur-md px-5 py-3 border-b border-border/50 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">Mapa Operacional de Varrição</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">Exibindo {filteredRuas.length} ruas</span>
                </div>
              </div>

              {/* Leaflet Render Target */}
              <div ref={mapContainerRef} className="w-full flex-1 min-h-[500px] bg-muted/20 relative z-0" />

              {/* Map Legend Overlay */}
              <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-md border border-border/60 p-3.5 rounded-2xl shadow-xl max-w-xs space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">Legenda de Setores</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {setores.map(setor => (
                    <div key={setor.id} className="flex items-center gap-2 text-xs font-bold">
                      <span className="w-3 h-3 rounded-full shrink-0 border border-white/40" style={{ backgroundColor: setor.cor }} />
                      <span className="text-foreground truncate">{setor.codigo} - {setor.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Side List of Mapped Streets */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  Ruas no Setor Selecionado
                </h3>
                <span className="text-xs font-bold text-muted-foreground">{filteredRuas.length} itinerários</span>
              </div>

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {filteredRuas.length === 0 ? (
                  <div className="text-center py-12 bg-card/40 border border-dashed border-border/60 rounded-3xl p-6">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-bold text-muted-foreground">Nenhuma rua encontrada com os filtros selecionados.</p>
                  </div>
                ) : (
                  filteredRuas.map(rua => {
                    const setor = setores.find(s => s.id === rua.setorId)
                    return (
                      <div
                        key={rua.id}
                        onMouseEnter={() => setHoveredRuaId(rua.id)}
                        onMouseLeave={() => setHoveredRuaId(null)}
                        className={cn(
                          "bg-card/70 hover:bg-card border rounded-2xl p-4 transition-all shadow-sm relative group cursor-pointer",
                          hoveredRuaId === rua.id ? "border-primary ring-2 ring-primary/20" : "border-border/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span 
                              className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md mb-1 text-white shadow-sm"
                              style={{ backgroundColor: setor?.cor || '#3b82f6' }}
                            >
                              {setor?.codigo || 'SETOR'}
                            </span>
                            <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{rua.nome}</h4>
                            <p className="text-xs font-medium text-muted-foreground">{rua.trecho}</p>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRuaStatus(rua) }}
                            title="Clique para alternar o status"
                            className={cn(
                              "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                              rua.status === 'Concluída' 
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20" 
                                : rua.status === 'Em Varrição' 
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20" 
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                            )}
                          >
                            {rua.status}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-muted-foreground pt-2 border-t border-border/30">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            <span>{rua.equipeNome}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>{rua.turno}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Route className="w-3.5 h-3.5 text-blue-500" />
                            <span>{rua.extensaoKm} km de extensão</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{rua.garisAlocados} Garis</span>
                          </div>
                        </div>

                        {/* Quick Edit/Delete Actions */}
                        <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingRua(rua); setIsModalRuaOpen(true) }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Editar Rua"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRua(rua.id) }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Excluir Rua"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: TEAMS & SECTORS CARDS VIEW */}
        {activeTab === 'equipes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {setores.map(setor => {
              const ruasDoSetor = ruas.filter(r => r.setorId === setor.id)
              const totalKmSetor = ruasDoSetor.reduce((a, b) => a + b.extensaoKm, 0)
              const totalGarisSetor = ruasDoSetor.reduce((a, b) => a + b.garisAlocados, 0)
              const concluidas = ruasDoSetor.filter(r => r.status === 'Concluída').length

              return (
                <div key={setor.id} className="bg-card/70 border border-border/50 rounded-3xl p-6 shadow-md hover:border-primary/40 transition-all space-y-5">
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-md shrink-0"
                        style={{ backgroundColor: setor.cor }}
                      >
                        {setor.codigo}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{setor.nome}</h3>
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>{setor.equipeNome} &bull; Encarregado: {setor.encarregadoNome}</span>
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 bg-muted/60 text-foreground text-xs font-bold rounded-xl border border-border/40">
                      {setor.areaKm2} km²
                    </span>
                  </div>

                  {/* Sector Description */}
                  <p className="text-xs font-medium text-muted-foreground/90 bg-muted/30 p-3 rounded-xl border border-border/30">
                    {setor.descricao}
                  </p>

                  {/* Setor Metrics Row */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/40 rounded-2xl p-3 border border-border/30">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Itinerários</span>
                      <div className="text-base font-black text-foreground">{ruasDoSetor.length} ruas</div>
                    </div>
                    <div className="bg-muted/40 rounded-2xl p-3 border border-border/30">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Extensão</span>
                      <div className="text-base font-black text-foreground">{totalKmSetor.toFixed(1)} km</div>
                    </div>
                    <div className="bg-muted/40 rounded-2xl p-3 border border-border/30">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Garis Alocados</span>
                      <div className="text-base font-black text-foreground">{totalGarisSetor} ag.</div>
                    </div>
                  </div>

                  {/* List of Streets inside Team Card */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                      <span>Ruas Designadas</span>
                      <span>{concluidas} de {ruasDoSetor.length} concluídas</span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {ruasDoSetor.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground text-center py-4">Nenhuma rua associada a este setor.</p>
                      ) : (
                        ruasDoSetor.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border/30 rounded-xl text-xs font-bold">
                            <div>
                              <div className="text-foreground">{r.nome}</div>
                              <div className="text-[10px] font-medium text-muted-foreground">{r.trecho} ({r.extensaoKm} km)</div>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md",
                              r.status === 'Concluída' ? "bg-emerald-500/10 text-emerald-600" : r.status === 'Em Varrição' ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                            )}>
                              {r.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}

        {/* TAB 3: FULL STREETS TABULAR VIEW */}
        {activeTab === 'ruas' && (
          <div className="bg-card/70 border border-border/50 rounded-3xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-black tracking-wider border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Setor</th>
                    <th className="px-6 py-4">Rua & Trecho</th>
                    <th className="px-6 py-4">Equipe / Encarregado</th>
                    <th className="px-6 py-4">Extensão</th>
                    <th className="px-6 py-4">Frequência / Turno</th>
                    <th className="px-6 py-4">Garis</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRuas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground font-bold">
                        Nenhuma rua encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredRuas.map(rua => {
                      const setor = setores.find(s => s.id === rua.setorId)
                      return (
                        <tr key={rua.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-bold">
                            <span 
                              className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg text-white shadow-sm"
                              style={{ backgroundColor: setor?.cor || '#3b82f6' }}
                            >
                              {setor?.codigo || 'SETOR'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-black text-foreground">{rua.nome}</div>
                            <div className="text-[11px] font-medium text-muted-foreground">{rua.trecho}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{rua.equipeNome}</div>
                            <div className="text-[11px] text-muted-foreground">{rua.encarregadoNome}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-foreground">
                            {rua.extensaoKm} km
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{rua.turno}</div>
                            <div className="text-[11px] text-muted-foreground">{rua.frequencia}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-foreground">
                            {rua.garisAlocados} garis
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleRuaStatus(rua)}
                              className={cn(
                                "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                rua.status === 'Concluída' 
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                                  : rua.status === 'Em Varrição' 
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/30" 
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              )}
                            >
                              {rua.status}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingRua(rua); setIsModalRuaOpen(true) }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRua(rua.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: NOVA / EDITAR RUA */}
      <Modal
        open={isModalRuaOpen}
        onClose={() => { setIsModalRuaOpen(false); setEditingRua(null) }}
        title={editingRua?.id ? 'Editar Rua / Trecho de Varrição' : 'Cadastrar Nova Rua no Itinerário'}
      >
        <form onSubmit={handleSaveRua} className="space-y-4 pt-2">
          
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Equipe Responsável (Vincular Supabase) *</label>
            <select
              value={editingRua?.equipeId || ''}
              onChange={e => {
                const eqId = e.target.value
                const selectedEq = dbEquipes.find(eq => eq.id === eqId)
                setEditingRua(prev => ({
                  ...prev,
                  equipeId: eqId,
                  equipeNome: selectedEq ? selectedEq.nome : prev?.equipeNome,
                  encarregadoNome: selectedEq?.encarregados?.[0] || prev?.encarregadoNome,
                  garisAlocados: selectedEq?.membrosCount || prev?.garisAlocados || 4
                }))
              }}
              className="w-full bg-muted/40 border border-border/50 rounded-2xl p-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Selecione uma Equipe Cadastrada</option>
              {dbEquipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome} ({eq.membrosCount} membros)</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Setor de Varrição *</label>
            <select
              value={editingRua?.setorId || ''}
              onChange={e => {
                const s = setores.find(st => st.id === e.target.value)
                setEditingRua(prev => ({
                  ...prev,
                  setorId: e.target.value,
                  equipeNome: s?.equipeNome || prev?.equipeNome,
                  encarregadoNome: s?.encarregadoNome || prev?.encarregadoNome
                }))
              }}
              className="w-full bg-muted/40 border border-border/50 rounded-2xl p-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
              required
            >
              <option value="">Selecione um Setor</option>
              {setores.map(s => (
                <option key={s.id} value={s.id}>{s.codigo} - {s.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nome do Logradouro / Rua *</label>
            <Input
              placeholder="Ex: Av. Boa Viagem, Rua da Aurora..."
              value={editingRua?.nome || ''}
              onChange={e => setEditingRua(prev => ({ ...prev, nome: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Trecho / Delimitação</label>
            <Input
              placeholder="Ex: Do trevo A até a praça B"
              value={editingRua?.trecho || ''}
              onChange={e => setEditingRua(prev => ({ ...prev, trecho: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Extensão (km) *</label>
              <Input
                type="number"
                step="0.1"
                placeholder="1.5"
                value={editingRua?.extensaoKm || ''}
                onChange={e => setEditingRua(prev => ({ ...prev, extensaoKm: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Garis Alocados *</label>
              <Input
                type="number"
                placeholder="4"
                value={editingRua?.garisAlocados || ''}
                onChange={e => setEditingRua(prev => ({ ...prev, garisAlocados: parseInt(e.target.value, 10) || 0 }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Turno de Trabalho</label>
              <select
                value={editingRua?.turno || 'Diurno'}
                onChange={e => setEditingRua(prev => ({ ...prev, turno: e.target.value as any }))}
                className="w-full bg-muted/40 border border-border/50 rounded-2xl p-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
              >
                <option value="Diurno">Diurno</option>
                <option value="Noturno">Noturno</option>
                <option value="Vespertino">Vespertino</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Frequência</label>
              <select
                value={editingRua?.frequencia || 'Diária - Diurno'}
                onChange={e => setEditingRua(prev => ({ ...prev, frequencia: e.target.value as any }))}
                className="w-full bg-muted/40 border border-border/50 rounded-2xl p-3 text-xs font-bold text-foreground outline-none focus:border-primary/50"
              >
                <option value="Diária - Diurno">Diária - Diurno</option>
                <option value="Diária - Noturno">Diária - Noturno</option>
                <option value="3x por Semana">3x por Semana</option>
                <option value="2x por Semana">2x por Semana</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsModalRuaOpen(false); setEditingRua(null) }}
            >
              Cancelar
            </Button>
            <Button type="submit" className="font-bold">
              Salvar Rua
            </Button>
          </div>

        </form>
      </Modal>

    </div>
  )
}
