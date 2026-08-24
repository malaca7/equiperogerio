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
import { LOCALIDADES, type Localidade } from '../lib/localidades'

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

// Initial Data for Sweeping Organization (Cabo de Santo Agostinho & Suape)
const INITIAL_SETORES: SetorVarricao[] = [
  {
    id: 'setor-varricao',
    codigo: 'SET-VARR',
    nome: 'Varrição - Centro & Vias Principais',
    descricao: 'Área urbana do Cabo de Santo Agostinho, corredores viários e vias públicas centrais.',
    cor: '#10b981',
    equipeNome: 'Equipes de Varrição',
    encarregadoNome: 'Encarregado Geral',
    centroLat: -8.2863,
    centroLng: -35.0354,
    areaKm2: 12.5,
    poligono: [
      [-8.2600, -35.0500],
      [-8.2550, -35.0000],
      [-8.3100, -35.0000],
      [-8.3150, -35.0550],
    ]
  },
  {
    id: 'setor-orla',
    codigo: 'SET-ORLA',
    nome: 'Orla & Praias (Itapuama, Gaibu, Suape)',
    descricao: 'Orla marítima, calçadões praianos, acessos às praias de Gaibu, Itapuama, Enseadas e Suape.',
    cor: '#3b82f6',
    equipeNome: 'Equipe de Orla',
    encarregadoNome: 'Encarregado da Orla',
    centroLat: -8.3200,
    centroLng: -34.9450,
    areaKm2: 18.2,
    poligono: [
      [-8.2800, -34.9500],
      [-8.2750, -34.9300],
      [-8.3700, -34.9500],
      [-8.3750, -34.9700],
    ]
  },
  {
    id: 'setor-porta',
    codigo: 'SET-PAP',
    nome: 'Porta a Porta - Coleta & Residencial',
    descricao: 'Setores residenciais, bairros periféricos e vias secundárias de coleta.',
    cor: '#8b5cf6',
    equipeNome: 'Equipe Coleta',
    encarregadoNome: 'Encarregado Coleta',
    centroLat: -8.2750,
    centroLng: -35.0400,
    areaKm2: 15.0,
    poligono: [
      [-8.2500, -35.0700],
      [-8.2450, -35.0200],
      [-8.2950, -35.0200],
      [-8.3000, -35.0700],
    ]
  }
]

const INITIAL_RUAS: RuaVarricao[] = [
  {
    id: 'rua-1',
    setorId: 'setor-varricao',
    nome: 'Av. Laura Cavalcante',
    trecho: 'Orla de Gaibu até o trevo de acesso à PE-28',
    extensaoKm: 2.8,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe de Varrição',
    encarregadoNome: 'Rogerio',
    garisAlocados: 12,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.3245, -34.9450],
      [-8.3220, -34.9480],
      [-8.3200, -34.9520],
      [-8.3180, -34.9550]
    ]
  },
  {
    id: 'rua-2',
    setorId: 'setor-varricao',
    nome: 'PE-28 Acesso a Gaibu',
    trecho: 'Trevo da PE-60 até o portal de entrada de Gaibu',
    extensaoKm: 4.2,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe de Varrição',
    encarregadoNome: 'Rogerio',
    garisAlocados: 10,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.3150, -34.9700],
      [-8.3180, -34.9650],
      [-8.3200, -34.9580]
    ]
  },
  {
    id: 'rua-3',
    setorId: 'setor-orla',
    nome: 'Orla de Gaibu & Calçadão',
    trecho: 'Faixa praiana da Laura Cavalcante ao Morro das Gaetanas',
    extensaoKm: 2.5,
    frequencia: 'Diária - Diurno',
    turno: 'Diurno',
    equipeNome: 'Equipe de Orla',
    encarregadoNome: 'Rogerio',
    garisAlocados: 15,
    prioridade: 'Alta',
    status: 'Em Varrição',
    pontosRota: [
      [-8.3280, -34.9430],
      [-8.3250, -34.9440],
      [-8.3210, -34.9445]
    ]
  },
  {
    id: 'rua-4',
    setorId: 'setor-orla',
    nome: 'Orla de Itapuama',
    trecho: 'Praia de Itapuama até Enseadas dos Corais',
    extensaoKm: 3.1,
    frequencia: 'Diária - Noturno',
    turno: 'Noturno',
    equipeNome: 'Equipe de Orla',
    encarregadoNome: 'Rogerio',
    garisAlocados: 8,
    prioridade: 'Média',
    status: 'Pendente',
    pontosRota: [
      [-8.2900, -34.9400],
      [-8.2980, -34.9410],
      [-8.3050, -34.9420]
    ]
  },
  {
    id: 'rua-5',
    setorId: 'setor-varricao',
    nome: 'Anel Viário do Cabo',
    trecho: 'Entroncamento BR-101 ao Centro Comercial',
    extensaoKm: 5.4,
    frequencia: '3x por Semana',
    turno: 'Diurno',
    equipeNome: 'Equipe de Varrição',
    encarregadoNome: 'Rogerio',
    garisAlocados: 9,
    prioridade: 'Alta',
    status: 'Concluída',
    pontosRota: [
      [-8.2950, -35.0300],
      [-8.2900, -35.0320],
      [-8.2850, -35.0350]
    ]
  },
  {
    id: 'rua-6',
    setorId: 'setor-varricao',
    nome: 'Estrada Velha do Suape',
    trecho: 'Margens da PE-60 ao Complexo Industrial de Suape',
    extensaoKm: 6.2,
    frequencia: '2x por Semana',
    turno: 'Vespertino',
    equipeNome: 'Equipe de Varrição',
    encarregadoNome: 'Rogerio',
    garisAlocados: 8,
    prioridade: 'Média',
    status: 'Pendente',
    pontosRota: [
      [-8.2800, -35.0200],
      [-8.3000, -35.0000],
      [-8.3300, -34.9800]
    ]
  }
]

const LOCALIDADE_MAP_COORDS: Record<string, [number, number][]> = {
  'Suape': [[-8.3400, -34.9600], [-8.3450, -34.9650], [-8.3500, -34.9700]],
  'Av Laura Cavalcante': [[-8.3245, -34.9450], [-8.3220, -34.9480], [-8.3200, -34.9520]],
  'Enseadas': [[-8.3050, -34.9420], [-8.3080, -34.9430], [-8.3120, -34.9440]],
  'Itapuama': [[-8.2900, -34.9400], [-8.2950, -34.9410], [-8.3000, -34.9420]],
  'Estrada Velha': [[-8.2800, -35.0200], [-8.2900, -35.0100], [-8.3000, -35.0000]],
  'Anel Viário': [[-8.2950, -35.0300], [-8.2900, -35.0320], [-8.2850, -35.0350]],
  'Xaréu': [[-8.3100, -34.9450], [-8.3130, -34.9460], [-8.3160, -34.9470]],
  'PE-28 Gaibu': [[-8.3150, -34.9700], [-8.3180, -34.9650], [-8.3200, -34.9580]],
  'Gaibu': [[-8.3280, -34.9430], [-8.3250, -34.9440], [-8.3210, -34.9445]],
}

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

      return equipes.map(eq => {
        const teamMembros = (mem || []).filter((m: any) => m.equipe_id === eq.id)
        const garis = teamMembros.filter((m: any) => {
          const cargo = (m.funcionarios?.cargo || '').toLowerCase()
          const setor = (m.funcionarios?.setor || '').toLowerCase()
          return cargo.includes('agente') || cargo.includes('gari') || setor.includes('varri')
        })
        return {
          ...eq,
          encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles?.nome).filter(Boolean),
          membrosCount: teamMembros.length,
          garisCount: garis.length > 0 ? garis.length : teamMembros.length
        }
      })
    }
  })

  const { data: dbRegioes = [] } = useQuery<any[]>({
    queryKey: ['regioes-varricao-integration'],
    queryFn: async () => {
      const { data } = await supabase.from('regioes').select('*').order('nome')
      return data || []
    }
  })

  // Platform Sectors <-> Teams Config & Meta/Rota Localidades
  const { data: dbSetoresEquipes = {} } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const { data: platformLocalidades = LOCALIDADES } = useConfiguracao<Localidade[]>('localidades', LOCALIDADES)
  const { data: platformSetores = ['Varrição', 'Orla', 'Porta a Porta'] } = useConfiguracao<string[]>('setores', ['Varrição', 'Orla', 'Porta a Porta'])

  // Persistent Configuration from DB / Local
  const { data: dbSetores } = useConfiguracao<SetorVarricao[]>('varricao_setores', INITIAL_SETORES)
  const { data: dbRuas } = useConfiguracao<RuaVarricao[]>('varricao_ruas', INITIAL_RUAS)
  const updateConfig = useUpdateConfiguracao()

  // Compute merged Setores based on platform Setores + dbSetores
  const sectoresMerged = useMemo(() => {
    const baseSetores = dbSetores || INITIAL_SETORES
    const setList: SetorVarricao[] = [...baseSetores]

    const allMetaSetores = Array.from(new Set([
      ...platformSetores,
      ...(platformLocalidades || []).map(l => l.setor).filter(Boolean)
    ]))

    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4']

    allMetaSetores.forEach((sName, idx) => {
      const exists = setList.some(s => s.nome.toLowerCase() === sName.toLowerCase())
      if (!exists) {
        const setorId = `setor-${sName.toLowerCase().replace(/\s+/g, '-')}`
        setList.push({
          id: setorId,
          codigo: `SET-${sName.substring(0, 4).toUpperCase()}`,
          nome: sName,
          descricao: `Setor de ${sName} (Integrado de Meta e Rota)`,
          cor: colors[idx % colors.length],
          equipeNome: 'Equipes do Setor',
          encarregadoNome: 'Encarregado do Setor',
          centroLat: -8.2863 + (idx * 0.01),
          centroLng: -35.0354 + (idx * 0.01),
          areaKm2: 10.0,
          poligono: [
            [-8.2600 + (idx * 0.01), -35.0500],
            [-8.2550 + (idx * 0.01), -35.0000],
            [-8.3100 + (idx * 0.01), -35.0000],
            [-8.3150 + (idx * 0.01), -35.0550],
          ]
        })
      }
    })

    return setList
  }, [dbSetores, platformSetores, platformLocalidades])

  // Compute merged Ruas based on platform Localidades + dbRuas
  const ruasMerged = useMemo(() => {
    const baseRuas = dbRuas || INITIAL_RUAS
    const ruaList: RuaVarricao[] = [...baseRuas]

    ;(platformLocalidades || []).forEach((loc, idx) => {
      const existingRuaIndex = ruaList.findIndex(r => 
        r.id === loc.id || 
        r.nome.toLowerCase() === loc.nome.toLowerCase()
      )

      const targetTeam = loc.equipe_id ? dbEquipes.find(eq => eq.id === loc.equipe_id) : null
      const matchedSetor = sectoresMerged.find(s => s.nome.toLowerCase() === (loc.setor || '').toLowerCase()) || sectoresMerged[0]

      const coordList = LOCALIDADE_MAP_COORDS[loc.nome] || [
        [-8.2863 + (idx * 0.005), -35.0354 + (idx * 0.005)],
        [-8.2880 + (idx * 0.005), -35.0380 + (idx * 0.005)],
        [-8.2900 + (idx * 0.005), -35.0400 + (idx * 0.005)]
      ]

      if (existingRuaIndex >= 0) {
        const existing = ruaList[existingRuaIndex]
        ruaList[existingRuaIndex] = {
          ...existing,
          setorId: matchedSetor ? matchedSetor.id : existing.setorId,
          equipeId: loc.equipe_id || existing.equipeId,
          equipeNome: targetTeam ? targetTeam.nome : existing.equipeNome,
          encarregadoNome: targetTeam?.encarregados?.[0] || existing.encarregadoNome
        }
      } else {
        ruaList.push({
          id: loc.id || `rua-${Date.now()}-${idx}`,
          setorId: matchedSetor ? matchedSetor.id : sectoresMerged[0]?.id || 'setor-varricao',
          nome: loc.nome,
          trecho: `Área de Atuação - ${loc.nome}`,
          extensaoKm: 2.5,
          frequencia: 'Diária - Diurno',
          turno: 'Diurno',
          equipeId: loc.equipe_id || null,
          equipeNome: targetTeam ? targetTeam.nome : 'Equipe de Varrição',
          encarregadoNome: targetTeam?.encarregados?.[0] || 'Rogerio',
          garisAlocados: targetTeam?.membrosCount || 6,
          prioridade: 'Alta',
          status: 'Em Varrição',
          pontosRota: coordList
        })
      }
    })

    return ruaList
  }, [dbRuas, platformLocalidades, dbEquipes, sectoresMerged])

  const [setores, setSetores] = useState<SetorVarricao[]>(sectoresMerged)
  const [ruas, setRuas] = useState<RuaVarricao[]>(ruasMerged)

  // Sync DB config
  useEffect(() => {
    setSetores(sectoresMerged)
  }, [sectoresMerged])

  useEffect(() => {
    setRuas(ruasMerged)
  }, [ruasMerged])

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

  // Map Layer & Autocomplete States
  const [mapTileLayer, setMapTileLayer] = useState<'google_streets' | 'google_satellite' | 'osm'>('google_streets')
  const tileLayerRef = useRef<any>(null)

  // Address Autocomplete States
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([])
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Map Container Ref & Leaflet Instance
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  // Debounced Address Search for Google Maps / Nominatim Geocoding
  useEffect(() => {
    if (!autocompleteQuery || autocompleteQuery.length < 2) {
      setAutocompleteSuggestions([])
      setIsSearchingAddress(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingAddress(true)
      try {
        const queryTerm = autocompleteQuery.toLowerCase().includes('cabo') 
          ? autocompleteQuery 
          : `${autocompleteQuery}, Cabo de Santo Agostinho, PE`
        
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryTerm)}&limit=6&addressdetails=1`
        )
        if (res.ok) {
          const data = await res.json()
          setAutocompleteSuggestions(data || [])
          setShowSuggestions(true)
        }
      } catch (err) {
        console.warn('Geocoding autocomplete search error:', err)
      } finally {
        setIsSearchingAddress(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [autocompleteQuery])

  // Filtered List calculation
  const filteredRuas = useMemo(() => {
    return ruas.filter(rua => {
      const matchesSearch = 
        rua.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.trecho.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.equipeNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rua.encarregadoNome.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSetor = selectedSetorId === 'todos' || rua.setorId === selectedSetorId

      let matchesEquipe = selectedEquipeIdFilter === 'todos'
      if (!matchesEquipe) {
        const targetTeam = dbEquipes.find(eq => eq.id === selectedEquipeIdFilter)
        const teamSetores = dbSetoresEquipes[selectedEquipeIdFilter] || []
        const currentSetorObj = setores.find(s => s.id === rua.setorId)

        matchesEquipe = 
          rua.equipeId === selectedEquipeIdFilter ||
          (!!targetTeam && rua.equipeNome.toLowerCase().includes(targetTeam.nome.toLowerCase())) ||
          (teamSetores.length > 0 && !!currentSetorObj && teamSetores.some((ts: string) => 
            currentSetorObj.nome.toLowerCase().includes(ts.toLowerCase())
          ))
      }

      const matchesTurno = selectedTurno === 'todos' || rua.turno === selectedTurno
      const matchesStatus = selectedStatus === 'todos' || rua.status === selectedStatus

      return matchesSearch && matchesSetor && matchesEquipe && matchesTurno && matchesStatus
    })
  }, [ruas, searchTerm, selectedSetorId, selectedEquipeIdFilter, selectedTurno, selectedStatus, dbEquipes, dbSetoresEquipes, setores])

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

    const defaultCenter: [number, number] = [-8.2863, -35.0354]
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: true
    })

    leafletMapRef.current = map

    let initialTileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    let initialAttr = '&copy; Google Maps'
    let initialMaxZoom = 20

    if (mapTileLayer === 'google_satellite') {
      initialTileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      initialAttr = '&copy; Google Maps Satélite'
    } else if (mapTileLayer === 'osm') {
      initialTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      initialAttr = '&copy; OpenStreetMap'
      initialMaxZoom = 19
    }

    tileLayerRef.current = L.tileLayer(initialTileUrl, {
      attribution: initialAttr,
      maxZoom: initialMaxZoom
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

  // Dynamic Map Tile Switcher Effect
  useEffect(() => {
    if (!leafletMapRef.current || !(window as any).L) return
    const L = (window as any).L

    if (tileLayerRef.current) {
      try {
        leafletMapRef.current.removeLayer(tileLayerRef.current)
      } catch (_) {}
    }

    let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    let maxZoom = 20
    let attribution = '&copy; Google Maps'

    if (mapTileLayer === 'google_satellite') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      attribution = '&copy; Google Maps Satélite'
    } else if (mapTileLayer === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      maxZoom = 19
      attribution = '&copy; OpenStreetMap'
    }

    const newLayer = L.tileLayer(tileUrl, { maxZoom, attribution })
    newLayer.addTo(leafletMapRef.current)
    tileLayerRef.current = newLayer
  }, [mapTileLayer])

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
      <TopHeader title="Mapeamento Operacional" subtitle="Visualização em tempo real das rotas, ruas e localidades sincronizadas com Meta e Rota" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* Top Header & Integrated Quick Nav Links */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Compass className="w-3 h-3" /> Mapeamento em Tempo Real (Google Maps)
              </span>
              {queryEquipeId && (
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                  Filtro por Equipe Ativo
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Route className="w-7 h-7 text-primary" />
              Mapeamento Operacional & Rotas
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Visualização em tempo real sincronizada com as Equipes e com os setores de Meta e Rota.
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
              to="/metaerota"
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
              <div className="bg-card/90 backdrop-blur-md px-5 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">Mapa Operacional de Rotas</span>
                </div>

                {/* Google Maps Layer Switcher */}
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/40">
                  <button
                    type="button"
                    onClick={() => setMapTileLayer('google_streets')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                      mapTileLayer === 'google_streets' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Compass className="w-3 h-3" /> Google Streets
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTileLayer('google_satellite')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                      mapTileLayer === 'google_satellite' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Layers className="w-3 h-3" /> Satélite
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTileLayer('osm')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                      mapTileLayer === 'osm' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MapPin className="w-3 h-3" /> OpenStreetMap
                  </button>
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

          {/* Google Maps Street Autocomplete Search */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Buscar Logradouro no Google Maps (Autocomplete)</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Geocodificação
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={autocompleteQuery}
                onChange={e => {
                  setAutocompleteQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Digite o nome da rua ou local (ex: Av. Laura Cavalcante, Gaibu...)"
                className="w-full pl-10 pr-10 py-3 bg-muted/40 border border-border/50 rounded-2xl text-xs font-bold text-foreground outline-none focus:border-emerald-500/50"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isSearchingAddress && (
                <RotateCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
              )}
            </div>

            {/* Dropdown Suggestions */}
            {showSuggestions && autocompleteSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto scrollbar-thin divide-y divide-border/30 animate-scale-in">
                {autocompleteSuggestions.map((item, i) => {
                  const title = item.name || item.address?.road || item.display_name.split(',')[0]
                  const subtitle = item.display_name
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const lat = parseFloat(item.lat)
                        const lon = parseFloat(item.lon)
                        setEditingRua(prev => ({
                          ...prev,
                          nome: title,
                          trecho: subtitle,
                          pontosRota: [[lat, lon], [lat + 0.0015, lon + 0.0015]]
                        }))
                        setAutocompleteQuery(title)
                        setShowSuggestions(false)
                        toast(`Localização "${title}" selecionada no mapa!`, 'success')
                        if (leafletMapRef.current) {
                          leafletMapRef.current.flyTo([lat, lon], 16)
                        }
                      }}
                      className="w-full text-left p-3 hover:bg-muted/60 transition-colors flex items-start gap-2.5"
                    >
                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-foreground truncate">{title}</p>
                        <p className="text-[10px] font-medium text-muted-foreground truncate">{subtitle}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          
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
