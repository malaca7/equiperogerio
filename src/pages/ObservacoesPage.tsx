import React, { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  FileText, Search, Calendar, User, Plus, Filter, Trash2, 
  MessageSquare, Clock, Send, X, AlertTriangle, AlertCircle, 
  CheckCircle2, FileCheck, FileX, Shield, FileUp, Eye, Edit3, 
  ArrowRight, RotateCw, ZoomIn, ZoomOut, Activity, Ban
} from 'lucide-react'
import { format, parseISO, eachDayOfInterval, differenceInDays, isSunday, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { useEscalasMensal, useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { batchUpsert } from '../lib/batchUtils'

import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './admin/AdminDashboard'

interface AdvertenciaRecord {
  id: string
  funcionario_id: string
  data: string
  motivo: string
  descricao: string
  gravidade: 'leve' | 'media' | 'grave'
  assinada: boolean
  pdf_url?: string
  pdf_name?: string
  created_at: string
  created_by?: string
  escala_status?: string
}

interface SuspensaoRecord {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  motivo: string
  pdf_url?: string
  pdf_name?: string
  created_at: string
  created_by?: string
  escala_status?: string
}

interface ObservacaoRecord {
  id: string
  funcionario_id: string
  data: string
  motivo: string
  created_at: string
  created_by?: string
  escala_status?: string
}

function FuncionarioSelector({
  value,
  onChange,
  funcionarios,
  label
}: {
  value: string
  onChange: (id: string) => void
  funcionarios: any[]
  label: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedFunc = useMemo(() => {
    return funcionarios.find(f => f.id === value)
  }, [funcionarios, value])

  const filtered = useMemo(() => {
    if (!search || (selectedFunc && search === selectedFunc.nome)) return funcionarios
    const q = search.toLowerCase()
    return funcionarios.filter(f =>
      f.nome.toLowerCase().includes(q) ||
      (f.setor || '').toLowerCase().includes(q) ||
      (f.cargo || '').toLowerCase().includes(q)
    )
  }, [funcionarios, search, selectedFunc])

  // Synchronize input text with selected employee
  useEffect(() => {
    if (selectedFunc) {
      setSearch(selectedFunc.nome)
    } else {
      setSearch('')
    }
  }, [selectedFunc])

  return (
    <div className="relative flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-black uppercase text-muted-foreground tracking-widest ml-2">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Digitar nome do colaborador para pesquisar..."
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 h-12 bg-muted/40 border border-transparent focus:border-indigo-500/20 focus:bg-card rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/45 transition-all outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setSearch('')
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-all"
            title="Limpar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Transparent full-screen overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Suggestion list */}
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-[220px] overflow-y-auto bg-card border border-border/60 rounded-2xl shadow-2xl z-50 divide-y divide-border/20 backdrop-blur-md">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs font-bold text-muted-foreground/50">
                Nenhum colaborador encontrado
              </div>
            ) : (
              filtered.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onChange(f.id)
                    setSearch(f.nome)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-xs flex flex-col gap-0.5 hover:bg-muted/65 transition-all outline-none",
                    f.id === value ? "bg-indigo-500/10 text-indigo-500 font-black" : "text-foreground"
                  )}
                >
                  <span className="font-black text-foreground">{f.nome}</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{f.cargo} • {f.setor}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

const safeFormatDate = (dateStr?: string, fmt = 'dd/MM/yyyy') => {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return '-'
  }
}

export function ObservacoesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: teamInfo } = useUserTeam()

  const isManager = !teamInfo?.isRestricted
  const currentUserId = user?.profile?.id || ''

  const canManageRecord = (record: any) => {
    if (!teamInfo) return false
    if (!teamInfo.isRestricted) return true
    const isOwnCreated = record.created_by === currentUserId
    const isOwnTeam = teamInfo.teamMemberIds?.includes(record.funcionario_id)
    return isOwnCreated || isOwnTeam
  }

  // Search, tabs and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'advertencias' | 'suspensoes' | 'observacoes'>('advertencias')
  const [selectedSetor, setSelectedSetor] = useState('Todos')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  // Unified modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [recordType, setRecordType] = useState<'advertencia' | 'suspensao' | 'observacao'>('advertencia')

  // Document preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('Visualizar Documento')
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Unified form state
  const [isUploading, setIsUploading] = useState(false)
  const [recordForm, setRecordForm] = useState({
    funcionario_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    motivo: '',
    descricao: '',
    gravidade: 'leve' as 'leve' | 'media' | 'grave',
    assinada: false,
    pdf_url: '',
    pdf_name: '',
    escala_status: 'manter'
  })

  // Queries
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: advertencias = [], isLoading: loadAdv } = useConfiguracao<AdvertenciaRecord[]>('advertencias_records', [])
  const { data: suspensoes = [], isLoading: loadSusp } = useConfiguracao<SuspensaoRecord[]>('suspensoes_records', [])
  const { data: observacoes = [], isLoading: loadObs } = useConfiguracao<ObservacaoRecord[]>('observacoes_records', [])
  const { data: escalas = [], isLoading: loadEsc } = useEscalasMensal(selectedMonth)
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const { data: dbTiposEscala } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const tiposEscala = useMemo(() => {
    const list = [...(dbTiposEscala || DEFAULT_TIPOS_ESCALA)]
    if (!list.some(t => t.id === 'suspensao')) {
      list.push({ id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' })
    }
    return list
  }, [dbTiposEscala])

  const escalaStatusOptions = useMemo(() => {
    const options = [
      { value: 'manter', label: 'Não alterar escala (Manter atual)' }
    ]
    tiposEscala.forEach(t => {
      options.push({ value: t.id, label: `${t.nome} (${t.letra})` })
    })
    return options
  }, [tiposEscala])

  const updateConfig = useUpdateConfiguracao()

  const isFileImage = (name?: string) => {
    if (!name) return false
    const ext = name.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')
  }

  // Filter employees
  const availableFuncionarios = useMemo(() => {
    let list = allFuncionarios
    if (teamInfo?.isRestricted) {
      list = list.filter(f => {
        const isOwnTeam = teamInfo.teamMemberIds?.includes(f.id)
        const isCurrentlySelected = recordForm.funcionario_id === f.id
        return isOwnTeam || isCurrentlySelected
      })
    }
    if (selectedSetor !== 'Todos') {
      list = list.filter(f => f.setor === selectedSetor)
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [allFuncionarios, teamInfo, selectedSetor, recordForm.funcionario_id])

  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => { map[f.id] = f })
    return map
  }, [allFuncionarios])

  const setores = useMemo(() => {
    const set = new Set<string>()
    allFuncionarios.forEach(f => { if (f.setor) set.add(f.setor) })
    return Array.from(set)
  }, [allFuncionarios])

  // Filtered General Observations
  const filteredObservacoes = useMemo(() => {
    if (!Array.isArray(observacoes)) return []
    return observacoes
      .filter(o => {
        const f = funcMap[o.funcionario_id]
        if (!f) return false
        if (teamInfo?.isRestricted) {
          const isOwnTeam = teamInfo.teamMemberIds?.includes(o.funcionario_id)
          const isOwnCreated = o.created_by === currentUserId
          if (!isOwnTeam && !isOwnCreated) return false
        }
        if (selectedSetor !== 'Todos' && f.setor !== selectedSetor) return false

        const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.motivo.toLowerCase().includes(searchTerm.toLowerCase())
        
        // Filter by month
        const matchMonth = o.data.startsWith(selectedMonth)

        return matchSearch && matchMonth
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [observacoes, searchTerm, funcMap, teamInfo, selectedSetor, selectedMonth, currentUserId])

  // Processed Advertencias List
  const filteredAdvertencias = useMemo(() => {
    if (!Array.isArray(advertencias)) return []
    return advertencias
      .filter(a => {
        const f = funcMap[a.funcionario_id]
        if (!f) return false
        if (teamInfo?.isRestricted) {
          const isOwnTeam = teamInfo.teamMemberIds?.includes(a.funcionario_id)
          const isOwnCreated = a.created_by === currentUserId
          if (!isOwnTeam && !isOwnCreated) return false
        }
        if (selectedSetor !== 'Todos' && f.setor !== selectedSetor) return false

        const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.motivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.descricao.toLowerCase().includes(searchTerm.toLowerCase())
        
        // Filter by month
        const matchMonth = a.data.startsWith(selectedMonth)

        return matchSearch && matchMonth
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [advertencias, searchTerm, funcMap, teamInfo, selectedSetor, selectedMonth, currentUserId])

  // Processed Suspensoes List
  const filteredSuspensoes = useMemo(() => {
    if (!Array.isArray(suspensoes)) return []
    return suspensoes
      .filter(s => {
        const f = funcMap[s.funcionario_id]
        if (!f) return false
        if (teamInfo?.isRestricted) {
          const isOwnTeam = teamInfo.teamMemberIds?.includes(s.funcionario_id)
          const isOwnCreated = s.created_by === currentUserId
          if (!isOwnTeam && !isOwnCreated) return false
        }
        if (selectedSetor !== 'Todos' && f.setor !== selectedSetor) return false

        const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.motivo.toLowerCase().includes(searchTerm.toLowerCase())
        
        // Overlaps with selected month
        const monthStart = `${selectedMonth}-01`
        const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd')
        const matchMonth = s.data_fim >= monthStart && s.data_inicio <= monthEnd

        return matchSearch && matchMonth
      })
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
  }, [suspensoes, searchTerm, funcMap, teamInfo, selectedSetor, selectedMonth, currentUserId])

  // Dashboard Stats (Calculated on dynamic month)
  const stats = useMemo(() => {
    const monthStart = `${selectedMonth}-01`
    const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd')

    const monthAdvertencias = (advertencias || []).filter(a => {
      if (teamInfo?.isRestricted) {
        const isOwnTeam = teamInfo.teamMemberIds?.includes(a.funcionario_id)
        const isOwnCreated = a.created_by === currentUserId
        if (!isOwnTeam && !isOwnCreated) return false
      }
      return a.data.startsWith(selectedMonth)
    })

    const monthSuspensoes = (suspensoes || []).filter(s => {
      if (teamInfo?.isRestricted) {
        const isOwnTeam = teamInfo.teamMemberIds?.includes(s.funcionario_id)
        const isOwnCreated = s.created_by === currentUserId
        if (!isOwnTeam && !isOwnCreated) return false
      }
      return s.data_fim >= monthStart && s.data_inicio <= monthEnd
    })

    const totalDaysSuspended = monthSuspensoes.reduce((sum, s) => {
      try {
        const start = parseISO(s.data_inicio < monthStart ? monthStart : s.data_inicio)
        const end = parseISO(s.data_fim > monthEnd ? monthEnd : s.data_fim)
        return sum + Math.max(1, differenceInDays(end, start) + 1)
      } catch {
        return sum
      }
    }, 0)

    const pendingSignatures = monthAdvertencias.filter(a => !a.assinada).length

    const monthObservacoes = (observacoes || []).filter(o => {
      if (teamInfo?.isRestricted) {
        const isOwnTeam = teamInfo.teamMemberIds?.includes(o.funcionario_id)
        const isOwnCreated = o.created_by === currentUserId
        if (!isOwnTeam && !isOwnCreated) return false
      }
      return o.data.startsWith(selectedMonth)
    })

    return {
      warnings: monthAdvertencias.length,
      suspensions: monthSuspensoes.length,
      daysSuspended: totalDaysSuspended,
      pendingSignatures,
      totalNotes: monthObservacoes.length
    }
  }, [advertencias, suspensoes, observacoes, selectedMonth, teamInfo, currentUserId])

  // Image compressor
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context failure'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
        resolve(dataUrl)
      }
      img.onerror = (err) => reject(err)
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'warning' | 'suspension' | 'observacao') => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return toast('Formatos aceitos: PDF, JPG, PNG, WEBP', 'error')
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast('Arquivo muito grande. Limite: 5MB', 'error')
    }

    setIsUploading(true)
    try {
      if (file.type.startsWith('image/')) {
        const compressedUrl = await compressImage(file)
        setRecordForm(prev => ({
          ...prev,
          pdf_name: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
          pdf_url: compressedUrl
        }))
        toast('Documento compactado e anexado!', 'success')
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          setRecordForm(prev => ({
            ...prev,
            pdf_name: file.name,
            pdf_url: reader.result as string
          }))
          toast('Documento PDF anexado!', 'success')
        }
        reader.readAsDataURL(file)
      }
    } catch (err: any) {
      toast('Erro ao processar arquivo: ' + err.message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // Warning Sync Helpers
  const syncWarningToScale = async (employeeId: string, dateStr: string, motivo: string, escalaStatus: string) => {
    const { data: existing } = await supabase
      .from('escalas')
      .select('*')
      .eq('funcionario_id', employeeId)
      .eq('data', dateStr)
      .maybeSingle()

    const warningText = `[ADVERTÊNCIA] ${motivo}`

    const isDiaDomingo = isSunday(parseISO(dateStr))
    const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dateStr)
    const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

    const targetTipo = escalaStatus === 'manter' 
      ? (existing?.tipo || defaultTipo) 
      : escalaStatus

    // Also update frequency if status is altered
    if (escalaStatus !== 'manter') {
      const freqStatus = (escalaStatus === 'presente' || escalaStatus === 'hora_extra') 
        ? 'presente' 
        : (escalaStatus === 'repouso' || escalaStatus === 'compensar' || escalaStatus === 'ferias') 
          ? 'folga' 
          : escalaStatus === 'atestado' 
            ? 'atestado' 
            : 'falta'

      await supabase.from('frequencia').upsert({
        funcionario_id: employeeId,
        data: dateStr,
        status: freqStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'funcionario_id,data' })
    }

    if (existing) {
      let obs = existing.observacoes || ''
      if (!obs.toLowerCase().includes(warningText.toLowerCase().trim())) {
        obs = obs ? `${obs} | ${warningText}` : warningText
      }
      await supabase.from('escalas').update({
        observacoes: obs,
        tipo: targetTipo,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('escalas').insert({
        funcionario_id: employeeId,
        data: dateStr,
        tipo: targetTipo,
        observacoes: warningText,
        turno: 'integral',
        updated_at: new Date().toISOString()
      })
    }
  }

  const cleanWarningFromScale = async (employeeId: string, dateStr: string, motivo: string, escalaStatus?: string) => {
    const { data: existing } = await supabase
      .from('escalas')
      .select('*')
      .eq('funcionario_id', employeeId)
      .eq('data', dateStr)
      .maybeSingle()

    if (existing) {
      const warningText = `[ADVERTÊNCIA] ${motivo}`
      let cleaned = (existing.observacoes || '')
        .split(' | ')
        .map((p: string) => p.trim())
        .filter((p: string) => p.toLowerCase() !== warningText.toLowerCase().trim())
        .join(' | ')
        .trim()

      const isDiaDomingo = isSunday(parseISO(dateStr))
      const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dateStr)
      const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

      const targetTipo = (escalaStatus && escalaStatus !== 'manter' && existing.tipo === escalaStatus) ? defaultTipo : existing.tipo

      if (escalaStatus && escalaStatus !== 'manter') {
        await supabase.from('frequencia').delete().eq('funcionario_id', employeeId).eq('data', dateStr)
      }

      if (cleaned === '') {
        if ((targetTipo === 'presente' || targetTipo === 'repouso') && !existing.localidade) {
          await supabase.from('escalas').delete().eq('id', existing.id)
        } else {
          await supabase.from('escalas').update({ observacoes: null, tipo: targetTipo }).eq('id', existing.id)
        }
      } else {
        await supabase.from('escalas').update({ observacoes: cleaned, tipo: targetTipo }).eq('id', existing.id)
      }
    }
  }

  // General Observation Sync Helpers
  const syncGeneralObsToScale = async (employeeId: string, dateStr: string, motivo: string, escalaStatus: string) => {
    const { data: existing } = await supabase
      .from('escalas')
      .select('*')
      .eq('funcionario_id', employeeId)
      .eq('data', dateStr)
      .maybeSingle()

    const isDiaDomingo = isSunday(parseISO(dateStr))
    const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dateStr)
    const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

    const targetTipo = escalaStatus === 'manter' 
      ? (existing?.tipo || defaultTipo) 
      : escalaStatus

    if (escalaStatus !== 'manter') {
      const freqStatus = (escalaStatus === 'presente' || escalaStatus === 'hora_extra') 
        ? 'presente' 
        : (escalaStatus === 'repouso' || escalaStatus === 'compensar' || escalaStatus === 'ferias') 
          ? 'folga' 
          : escalaStatus === 'atestado' 
            ? 'atestado' 
            : 'falta'

      await supabase.from('frequencia').upsert({
        funcionario_id: employeeId,
        data: dateStr,
        status: freqStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'funcionario_id,data' })
    }

    if (existing) {
      let obs = existing.observacoes || ''
      if (!obs.toLowerCase().includes(motivo.toLowerCase().trim())) {
        obs = obs ? `${obs} | ${motivo}` : motivo
      }
      await supabase.from('escalas').update({
        observacoes: obs,
        tipo: targetTipo,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('escalas').insert({
        funcionario_id: employeeId,
        data: dateStr,
        tipo: targetTipo,
        observacoes: motivo,
        turno: 'integral',
        updated_at: new Date().toISOString()
      })
    }
  }

  const cleanGeneralObsFromScale = async (employeeId: string, dateStr: string, motivo: string, escalaStatus?: string) => {
    const { data: existing } = await supabase
      .from('escalas')
      .select('*')
      .eq('funcionario_id', employeeId)
      .eq('data', dateStr)
      .maybeSingle()

    if (existing) {
      let cleaned = (existing.observacoes || '')
        .split(' | ')
        .map((p: string) => p.trim())
        .filter((p: string) => p.toLowerCase() !== motivo.toLowerCase().trim())
        .join(' | ')
        .trim()

      const isDiaDomingo = isSunday(parseISO(dateStr))
      const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dateStr)
      const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

      const targetTipo = (escalaStatus && escalaStatus !== 'manter' && existing.tipo === escalaStatus) ? defaultTipo : existing.tipo

      if (escalaStatus && escalaStatus !== 'manter') {
        await supabase.from('frequencia').delete().eq('funcionario_id', employeeId).eq('data', dateStr)
      }

      if (cleaned === '') {
        if ((targetTipo === 'presente' || targetTipo === 'repouso') && !existing.localidade) {
          await supabase.from('escalas').delete().eq('id', existing.id)
        } else {
          await supabase.from('escalas').update({ observacoes: null, tipo: targetTipo }).eq('id', existing.id)
        }
      } else {
        await supabase.from('escalas').update({ observacoes: cleaned, tipo: targetTipo }).eq('id', existing.id)
      }
    }
  }

  // Toggle Signature status
  const handleToggleSignature = async (id: string) => {
    try {
      const updated = advertencias.map(a => {
        if (a.id === id) {
          const newStatus = !a.assinada
          toast(newStatus ? 'Advertência assinada!' : 'Assinatura removida!', 'success')
          return { ...a, assinada: newStatus }
        }
        return a
      })
      await updateConfig.mutateAsync({ chave: 'advertencias_records', valor: updated })
    } catch (err: any) {
      toast('Erro ao atualizar assinatura: ' + err.message, 'error')
    }
  }

  // Delete Handlers
  const handleDeleteWarning = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente este registro de advertência?')) return
    try {
      const record = advertencias.find(a => a.id === id)
      if (record) {
        await cleanWarningFromScale(record.funcionario_id, record.data, record.motivo, record.escala_status)
      }
      const updated = advertencias.filter(a => a.id !== id)
      await updateConfig.mutateAsync({ chave: 'advertencias_records', valor: updated })
      
      // Invalidate queries to prevent synchronization lag
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      toast('Advertência removida!', 'success')
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })
    } catch (err: any) {
      toast('Erro ao remover: ' + err.message, 'error')
    }
  }

  const handleDeleteSuspension = async (id: string) => {
    if (!confirm('Deseja cancelar permanentemente este registro de suspensão e reverter a escala?')) return
    try {
      const record = suspensoes.find(s => s.id === id)
      if (record) {
        const days = getDaysBetween(record.data_inicio, record.data_fim)
        
        // Remove frequencies in a single query
        if (days.length > 0) {
          const { error: deleteFreqError } = await supabase
            .from('frequencia')
            .delete()
            .eq('funcionario_id', record.funcionario_id)
            .in('data', days)
          if (deleteFreqError) throw deleteFreqError
        }

        // Reset scales
        for (const dStr of days) {
          const parsedDay = parseISO(dStr)
          const isDiaDomingo = isSunday(parsedDay)
          const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dStr)
          const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

          const { data: existing } = await supabase
            .from('escalas')
            .select('*')
            .eq('funcionario_id', record.funcionario_id)
            .eq('data', dStr)
            .maybeSingle()

          if (existing) {
            const warningText = `[SUSPENSÃO] ${record.motivo}`
            let cleanedObs = (existing.observacoes || '')
              .split(' | ')
              .map((p: string) => p.trim())
              .filter((p: string) => p.toLowerCase() !== warningText.toLowerCase().trim())
              .join(' | ')
              .trim()

            if (cleanedObs === '') {
              if ((defaultTipo === 'presente' || defaultTipo === 'repouso') && !existing.localidade) {
                await supabase.from('escalas').delete().eq('id', existing.id)
              } else {
                await supabase.from('escalas').update({ tipo: defaultTipo, observacoes: null }).eq('id', existing.id)
              }
            } else {
              await supabase.from('escalas').update({ tipo: defaultTipo, observacoes: cleanedObs }).eq('id', existing.id)
            }
          }
        }
      }

      const updated = suspensoes.filter(s => s.id !== id)
      await updateConfig.mutateAsync({ chave: 'suspensoes_records', valor: updated })

      // Invalidate queries to prevent synchronization lag
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      toast('Suspensão removida e escala restabelecida!', 'success')
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })
    } catch (err: any) {
      toast('Erro ao remover suspensão: ' + err.message, 'error')
    }
  }

  const handleDeleteObservation = async (id: string) => {
    if (!confirm('Deseja cancelar permanentemente este registro de observação e reverter a escala?')) return
    try {
      const record = observacoes.find(o => o.id === id)
      if (record) {
        await cleanGeneralObsFromScale(record.funcionario_id, record.data, record.motivo, record.escala_status)
      }
      const updated = observacoes.filter(o => o.id !== id)
      await updateConfig.mutateAsync({ chave: 'observacoes_records', valor: updated })

      // Invalidate queries to prevent synchronization lag
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      toast('Observação removida!', 'success')
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })
    } catch (err: any) {
      toast('Erro ao remover observação: ' + err.message, 'error')
    }
  }

  // Open Edit unified modal
  const openEditRecord = (record: any, type: 'advertencia' | 'suspensao' | 'observacao') => {
    setRecordType(type)
    setEditingRecordId(record.id)

    setRecordForm({
      funcionario_id: record.funcionario_id,
      data: type === 'suspensao' ? record.data_inicio : record.data,
      data_inicio: type === 'suspensao' ? record.data_inicio : format(new Date(), 'yyyy-MM-dd'),
      data_fim: type === 'suspensao' ? record.data_fim : format(new Date(), 'yyyy-MM-dd'),
      motivo: record.motivo,
      descricao: type === 'advertencia' ? record.descricao : '',
      gravidade: type === 'advertencia' ? record.gravidade : 'leve',
      assinada: type === 'advertencia' ? record.assinada : false,
      pdf_url: record.pdf_url || '',
      pdf_name: record.pdf_name || '',
      escala_status: record.escala_status || (type === 'suspensao' ? 'suspensao' : 'manter')
    })
    setIsRecordModalOpen(true)
  }

  // Unified Form submit
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordForm.funcionario_id || !recordForm.motivo) {
      return toast('Preencha os campos obrigatórios', 'warning')
    }

    if (recordType === 'suspensao') {
      if (!recordForm.data_inicio || !recordForm.data_fim) {
        return toast('Preencha o período da suspensão', 'warning')
      }
      if (recordForm.data_fim < recordForm.data_inicio) {
        return toast('A data final deve ser igual ou posterior à data de início', 'warning')
      }
    } else {
      if (!recordForm.data) {
        return toast('Preencha a data do ocorrido', 'warning')
      }
    }

    try {
      const employeeId = recordForm.funcionario_id
      const defaultStatus = recordForm.escala_status

      if (recordType === 'advertencia') {
        const oldRecord = editingRecordId ? advertencias.find(a => a.id === editingRecordId) : null
        let updated: AdvertenciaRecord[]

        const newRecord: AdvertenciaRecord = {
          id: editingRecordId || `adv_${Date.now()}`,
          funcionario_id: recordForm.funcionario_id,
          data: recordForm.data,
          motivo: recordForm.motivo,
          descricao: recordForm.descricao,
          gravidade: recordForm.gravidade,
          assinada: recordForm.assinada,
          pdf_url: recordForm.pdf_url,
          pdf_name: recordForm.pdf_name,
          created_at: oldRecord ? oldRecord.created_at : new Date().toISOString(),
          created_by: oldRecord ? oldRecord.created_by : currentUserId,
          escala_status: recordForm.escala_status
        }

        if (editingRecordId) {
          updated = advertencias.map(a => a.id === editingRecordId ? newRecord : a)
        } else {
          updated = [newRecord, ...advertencias]
        }

        await updateConfig.mutateAsync({ chave: 'advertencias_records', valor: updated })

        // Clear old scale if edited
        if (oldRecord) {
          await cleanWarningFromScale(oldRecord.funcionario_id, oldRecord.data, oldRecord.motivo, oldRecord.escala_status)
        }

        // Apply new scale modifications
        await syncWarningToScale(recordForm.funcionario_id, recordForm.data, recordForm.motivo, recordForm.escala_status)

        toast(editingRecordId ? 'Advertência atualizada!' : 'Advertência registrada com sucesso!', 'success')
      } else if (recordType === 'suspensao') {
        const oldRecord = editingRecordId ? suspensoes.find(s => s.id === editingRecordId) : null
        const oldDays = oldRecord ? getDaysBetween(oldRecord.data_inicio, oldRecord.data_fim) : []
        const newDays = getDaysBetween(recordForm.data_inicio, recordForm.data_fim)

        const datesToReset = oldDays.filter(d => !newDays.includes(d))

        const newRecord: SuspensaoRecord = {
          id: editingRecordId || `susp_${Date.now()}`,
          funcionario_id: recordForm.funcionario_id,
          data_inicio: recordForm.data_inicio,
          data_fim: recordForm.data_fim,
          motivo: recordForm.motivo,
          pdf_url: recordForm.pdf_url,
          pdf_name: recordForm.pdf_name,
          created_at: oldRecord ? oldRecord.created_at : new Date().toISOString(),
          created_by: oldRecord ? oldRecord.created_by : currentUserId,
          escala_status: recordForm.escala_status
        }

        let updated: SuspensaoRecord[]
        if (editingRecordId) {
          updated = suspensoes.map(s => s.id === editingRecordId ? newRecord : s)
        } else {
          updated = [newRecord, ...suspensoes]
        }

        await updateConfig.mutateAsync({ chave: 'suspensoes_records', valor: updated })

        // Reset dates removed from suspension
        if (datesToReset.length > 0) {
          const { error: deleteFreqError } = await supabase
            .from('frequencia')
            .delete()
            .eq('funcionario_id', employeeId)
            .in('data', datesToReset)
          if (deleteFreqError) throw deleteFreqError

          for (const dStr of datesToReset) {
            const parsedDay = parseISO(dStr)
            const isDiaDomingo = isSunday(parsedDay)
            const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dStr)
            const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

            const { data: existing } = await supabase
              .from('escalas')
              .select('*')
              .eq('funcionario_id', employeeId)
              .eq('data', dStr)
              .maybeSingle()

            if (existing) {
              const oldObsText = `[SUSPENSÃO] ${oldRecord?.motivo || ''}`
              let cleanedObs = (existing.observacoes || '')
                .split(' | ')
                .map((p: string) => p.trim())
                .filter((p: string) => p.toLowerCase() !== oldObsText.toLowerCase().trim())
                .join(' | ')
                .trim()

              if (cleanedObs === '') {
                if ((defaultTipo === 'presente' || defaultTipo === 'repouso') && !existing.localidade) {
                  await supabase.from('escalas').delete().eq('id', existing.id)
                } else {
                  await supabase.from('escalas').update({ tipo: defaultTipo, observacoes: null }).eq('id', existing.id)
                }
              } else {
                await supabase.from('escalas').update({ tipo: defaultTipo, observacoes: cleanedObs }).eq('id', existing.id)
              }
            }
          }
        }

        // Apply new suspension dates
        if (newDays.length > 0) {
          // Sync frequencies as Lack ('falta') or folga/atestado/etc based on the selected scale status
          const freqStatus = (recordForm.escala_status === 'presente' || recordForm.escala_status === 'hora_extra') 
            ? 'presente' 
            : (recordForm.escala_status === 'repouso' || recordForm.escala_status === 'compensar' || recordForm.escala_status === 'ferias') 
              ? 'folga' 
              : recordForm.escala_status === 'atestado' 
                ? 'atestado' 
                : 'falta'

          const freqUpserts = newDays.map(dStr => ({
            funcionario_id: employeeId,
            data: dStr,
            status: freqStatus as any,
            observacoes: `[SUSPENSÃO] ${recordForm.motivo}`,
            updated_at: new Date().toISOString()
          }))
          await batchUpsert('frequencia', freqUpserts, { onConflict: 'funcionario_id,data', chunkSize: 35 })

          for (const dStr of newDays) {
            const { data: existing } = await supabase
              .from('escalas')
              .select('*')
              .eq('funcionario_id', employeeId)
              .eq('data', dStr)
              .maybeSingle()

            const obsText = `[SUSPENSÃO] ${recordForm.motivo}`
            const targetStatus = recordForm.escala_status === 'manter' ? 'suspensao' : recordForm.escala_status

            if (existing) {
              let updatedObs = existing.observacoes || ''
              if (!updatedObs.includes(obsText)) {
                updatedObs = updatedObs ? `${updatedObs} | ${obsText}` : obsText
              }
              const updatePayload: any = {
                observacoes: updatedObs,
                updated_at: new Date().toISOString()
              }
              if (targetStatus !== 'manter') {
                updatePayload.tipo = targetStatus
              }
              await supabase.from('escalas').update(updatePayload).eq('id', existing.id)
            } else {
              await supabase.from('escalas').insert({
                funcionario_id: employeeId,
                data: dStr,
                tipo: targetStatus === 'manter' ? 'suspensao' : targetStatus,
                observacoes: obsText,
                turno: 'integral',
                updated_at: new Date().toISOString()
              })
            }
          }
        }

        toast(editingRecordId ? 'Suspensão editada!' : 'Suspensão registrada e escala atualizada!', 'success')
      } else if (recordType === 'observacao') {
        const oldRecord = editingRecordId ? observacoes.find(o => o.id === editingRecordId) : null
        let updated: ObservacaoRecord[]

        const newRecord: ObservacaoRecord = {
          id: editingRecordId || `obs_${Date.now()}`,
          funcionario_id: recordForm.funcionario_id,
          data: recordForm.data,
          motivo: recordForm.motivo,
          created_at: oldRecord ? oldRecord.created_at : new Date().toISOString(),
          created_by: oldRecord ? oldRecord.created_by : currentUserId,
          escala_status: recordForm.escala_status
        }

        if (editingRecordId) {
          updated = observacoes.map(o => o.id === editingRecordId ? newRecord : o)
        } else {
          updated = [newRecord, ...observacoes]
        }

        await updateConfig.mutateAsync({ chave: 'observacoes_records', valor: updated })

        // Clear old scale if edited
        if (oldRecord) {
          await cleanGeneralObsFromScale(oldRecord.funcionario_id, oldRecord.data, oldRecord.motivo, oldRecord.escala_status)
        }

        // Apply new scale modifications
        await syncGeneralObsToScale(recordForm.funcionario_id, recordForm.data, recordForm.motivo, recordForm.escala_status)

        toast(editingRecordId ? 'Observação atualizada!' : 'Observação registrada com sucesso!', 'success')
      }

      // Invalidate queries to prevent synchronization lag
      queryClient.invalidateQueries({ queryKey: ['escalas'] })
      queryClient.invalidateQueries({ queryKey: ['frequencia'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      setIsRecordModalOpen(false)
      setEditingRecordId(null)
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })
    } catch (err: any) {
      toast('Erro ao registrar lançamento: ' + err.message, 'error')
    }
  }

  const handleNewLaunch = () => {
    let defaultType: 'advertencia' | 'suspensao' | 'observacao' = 'advertencia'
    if (activeTab === 'suspensoes') defaultType = 'suspensao'
    else if (activeTab === 'observacoes') defaultType = 'observacao'

    setRecordType(defaultType)
    setEditingRecordId(null)
    setRecordForm({
      funcionario_id: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      data_inicio: format(new Date(), 'yyyy-MM-dd'),
      data_fim: format(new Date(), 'yyyy-MM-dd'),
      motivo: '',
      descricao: '',
      gravidade: 'leve',
      assinada: false,
      pdf_url: '',
      pdf_name: '',
      escala_status: defaultType === 'suspensao' ? 'suspensao' : 'manter'
    })
    setIsRecordModalOpen(true)
  }

  const openPreview = (url: string, name: string) => {
    setPreviewUrl(url)
    setPreviewTitle(name)
    setZoom(1)
    setRotation(0)
  }

  const getDaysBetween = (startStr: string, endStr: string) => {
    try {
      const start = parseISO(startStr)
      const end = parseISO(endStr)
      return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'))
    } catch {
      return []
    }
  }

  const isLoading = loadF || loadAdv || loadSusp || loadObs || loadEsc

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopHeader 
        title="Controle Disciplinar" 
        subtitle="Gestão de observações, advertências e suspensões integradas à escala"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-32">
        {/* KPI Panel Widgets */}
        <div className="flex lg:grid lg:grid-cols-5 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 gap-4 mb-8 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { label: 'Advertências Registradas', value: stats.warnings, desc: 'Este mês', icon: AlertTriangle, color: 'text-amber-500', bg: 'from-amber-500/10' },
            { label: 'Assinaturas Pendentes', value: stats.pendingSignatures, desc: 'Advertências s/ assinatura', icon: FileX, color: 'text-red-500', bg: 'from-red-500/10' },
            { label: 'Suspensões Ativas', value: stats.suspensions, desc: 'Contratos suspensos', icon: Ban, color: 'text-rose-500', bg: 'from-rose-500/10' },
            { label: 'Dias de Suspensão', value: stats.daysSuspended, desc: 'Perda operacional total', icon: Calendar, color: 'text-slate-500', bg: 'from-slate-500/10' },
            { label: 'Observações de Campo', value: stats.totalNotes, desc: 'Notas gerais da escala', icon: MessageSquare, color: 'text-indigo-500', bg: 'from-indigo-500/10' },
          ].map((w, idx) => (
            <div key={idx} className={cn("relative bg-gradient-to-br to-transparent backdrop-blur-xl border border-border/40 rounded-[2rem] p-5 shadow-sm overflow-hidden flex-shrink-0 w-[240px] sm:w-[260px] lg:w-auto snap-start", w.bg)}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-current/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-card border border-border/40 flex items-center justify-center">
                  <w.icon className={cn("w-4.5 h-4.5", w.color)} />
                </div>
              </div>
              <p className="text-3xl font-black text-foreground tracking-tight leading-none">{w.value}</p>
              <p className="text-[8.5px] font-black uppercase text-muted-foreground tracking-wider mt-2">{w.label}</p>
              <p className="text-[7.5px] font-bold text-muted-foreground/50 uppercase tracking-wider mt-0.5">{w.desc}</p>
            </div>
          ))}
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[1.75rem] sm:rounded-[2.5rem] p-4 sm:p-6 shadow-xl mb-6 sm:mb-8 sticky md:top-24 z-30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left Tabs */}
            <div className="flex bg-muted/40 p-1 rounded-2xl border border-border/30 w-full lg:w-fit shrink-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'advertencias', label: 'Advertências', icon: AlertTriangle },
                { id: 'suspensoes', label: 'Suspensões', icon: Ban },
                { id: 'observacoes', label: 'Notas de Campo', icon: MessageSquare },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex-1 lg:flex-none whitespace-nowrap",
                    activeTab === t.id ? "bg-primary text-white shadow-md shadow-primary/25" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <t.icon className="w-4 h-4 shrink-0" /> {t.label}
                </button>
              ))}
            </div>

            {/* Right Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 w-full lg:min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar registro..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-transparent focus:border-primary/20 rounded-2xl text-xs font-bold text-foreground placeholder:text-muted-foreground/50 transition-all outline-none"
                />
              </div>

              <select
                value={selectedSetor}
                onChange={e => setSelectedSetor(e.target.value)}
                className="h-12 sm:h-[42px] px-4 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold text-foreground outline-none text-muted-foreground focus:text-foreground transition-all w-full sm:w-auto"
              >
                <option value="Todos">Todos Setores</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-12 sm:h-[42px] px-4 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold text-foreground outline-none w-full sm:w-auto"
              />

              {(isManager || teamInfo?.isRestricted) && (
                <button 
                  onClick={handleNewLaunch}
                  className="h-12 sm:h-[42px] px-5 bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" /> Novo Lançamento
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content list */}
        {isLoading ? (
          <div className="py-24"><Loading text="Carregando registros..." /></div>
        ) : activeTab === 'advertencias' ? (
          filteredAdvertencias.length === 0 ? (
            <div className="py-24 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">Nenhuma advertência encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAdvertencias.map(a => {
                const f = funcMap[a.funcionario_id]
                const mappedStatus = a.escala_status === 'manter' 
                  ? 'Manter atual' 
                  : (escalaStatusOptions.find(opt => opt.value === a.escala_status)?.label || 'Manter atual')
                return (
                  <div key={a.id} className="group bg-card border border-border/60 rounded-[2.25rem] p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-base font-black text-foreground truncate max-w-[200px]">{f?.nome || 'Desconhecido'}</h4>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{f?.cargo} • {f?.setor}</p>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
                          a.gravidade === 'leve' ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20' :
                          a.gravidade === 'media' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        )}>
                          {a.gravidade}
                        </span>
                      </div>

                      {/* Motivo / Data */}
                      <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>{safeFormatDate(a.data, "EEEE, dd/MM/yyyy")}</span>
                        </div>
                        <p className="text-xs font-black text-foreground">{a.motivo}</p>
                        <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">{a.descricao}</p>
                        {a.escala_status && a.escala_status !== 'manter' && (
                          <div className="pt-1.5 flex items-center gap-1.5 border-t border-border/20 mt-2">
                            <span className="text-[8px] font-black uppercase text-muted-foreground">Status da escala:</span>
                            <span className="text-[8px] font-extrabold uppercase bg-indigo-500/15 text-indigo-600 px-2 py-0.5 rounded-full">{mappedStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4 mt-auto">
                      {/* Signature Status Toggle */}
                      <button 
                        onClick={() => canManageRecord(a) && handleToggleSignature(a.id)}
                        disabled={!canManageRecord(a)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8.5px] font-black uppercase tracking-wider transition-all",
                          a.assinada 
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                            : "bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse"
                        )}
                      >
                        {a.assinada ? <FileCheck className="w-3.5 h-3.5" /> : <FileX className="w-3.5 h-3.5" />}
                        <span>{a.assinada ? 'Assinada' : 'Pendente Assinatura'}</span>
                      </button>

                      {/* Document or modification */}
                      <div className="flex items-center gap-1.5">
                        {a.pdf_url && (
                          <button 
                            onClick={() => openPreview(a.pdf_url!, a.pdf_name || 'Documento')}
                            className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-muted text-foreground transition-all"
                            title="Ver Anexo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canManageRecord(a) && (
                          <>
                            <button 
                              onClick={() => openEditRecord(a, 'advertencia')}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteWarning(a.id)}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : activeTab === 'suspensoes' ? (
          filteredSuspensoes.length === 0 ? (
            <div className="py-24 text-center">
              <Ban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">Nenhuma suspensão ativa encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuspensoes.map(s => {
                const f = funcMap[s.funcionario_id]
                const duration = Math.max(1, differenceInDays(parseISO(s.data_fim), parseISO(s.data_inicio)) + 1)
                const mappedStatus = s.escala_status === 'manter' 
                  ? 'Suspensão (Padrão)' 
                  : (escalaStatusOptions.find(opt => opt.value === s.escala_status)?.label || 'Suspensão (Padrão)')
                return (
                  <div key={s.id} className="group bg-card border border-border/60 rounded-[2.25rem] p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-base font-black text-foreground truncate max-w-[200px]">{f?.nome || 'Desconhecido'}</h4>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{f?.cargo} • {f?.setor}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Suspensão
                        </span>
                      </div>

                      {/* Motivo e datas */}
                      <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>{safeFormatDate(s.data_inicio)}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>{safeFormatDate(s.data_fim)}</span>
                          <span className="bg-rose-500 text-white font-extrabold px-2 py-0.5 rounded-full ml-auto">{duration} {duration === 1 ? 'dia' : 'dias'}</span>
                        </div>
                        <p className="text-xs font-black text-foreground mt-2">{s.motivo}</p>
                        {s.escala_status && (
                          <div className="pt-1.5 flex items-center gap-1.5 border-t border-border/20 mt-2">
                            <span className="text-[8px] font-black uppercase text-muted-foreground">Status da escala:</span>
                            <span className="text-[8px] font-extrabold uppercase bg-rose-500/15 text-rose-600 px-2 py-0.5 rounded-full">{mappedStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4 mt-auto">
                      <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/15">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sincronizado c/ Escala</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {s.pdf_url && (
                          <button 
                            onClick={() => openPreview(s.pdf_url!, s.pdf_name || 'Documento')}
                            className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-muted text-foreground transition-all"
                            title="Ver Anexo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canManageRecord(s) && (
                          <>
                            <button 
                              onClick={() => openEditRecord(s, 'suspensao')}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSuspension(s.id)}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          filteredObservacoes.length === 0 ? (
            <div className="py-24 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">Nenhuma observação encontrada neste mês</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredObservacoes.map(obs => {
                const f = funcMap[obs.funcionario_id]
                const mappedStatus = obs.escala_status === 'manter' 
                  ? 'Manter atual' 
                  : (escalaStatusOptions.find(opt => opt.value === obs.escala_status)?.label || 'Manter atual')
                return (
                  <div key={obs.id} className="group bg-card border border-border/60 rounded-[2.25rem] p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-base font-black text-foreground truncate max-w-[200px]">{f?.nome || 'Desconhecido'}</h4>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{f?.cargo} • {f?.setor}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Observação
                        </span>
                      </div>

                      <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>{safeFormatDate(obs.data, "EEEE, dd/MM/yyyy")}</span>
                        </div>
                        <p className="text-xs font-bold text-foreground mt-2">"{obs.motivo}"</p>
                        {obs.escala_status && obs.escala_status !== 'manter' && (
                          <div className="pt-1.5 flex items-center gap-1.5 border-t border-border/20 mt-2">
                            <span className="text-[8px] font-black uppercase text-muted-foreground">Status da escala:</span>
                            <span className="text-[8px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mappedStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4 mt-auto">
                      <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/15">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sincronizado c/ Escala</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canManageRecord(obs) && (
                          <>
                            <button 
                              onClick={() => openEditRecord(obs, 'observacao')}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteObservation(obs.id)}
                              className="w-8 h-8 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* MODAL: Lançar / Editar Registro */}
      <Modal 
        open={isRecordModalOpen} 
        onClose={() => { setIsRecordModalOpen(false); setEditingRecordId(null) }} 
        title={
          editingRecordId 
            ? `Editar ${recordType === 'advertencia' ? 'Advertência' : recordType === 'suspensao' ? 'Suspensão' : 'Observação'}` 
            : 'Novo Lançamento / Registro'
        }
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4 animate-fade-in">
          {/* Tipo de Registro Select (only editable when creating new record) */}
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-2">Tipo de Registro *</label>
            <Select
              className="h-12 rounded-xl"
              disabled={!!editingRecordId}
              value={recordType}
              onChange={e => {
                const newType = e.target.value as any
                setRecordType(newType)
                setRecordForm(prev => ({
                  ...prev,
                  escala_status: newType === 'suspensao' ? 'suspensao' : 'manter'
                }))
              }}
              options={[
                { value: 'advertencia', label: 'Advertência Disciplinar' },
                { value: 'suspensao', label: 'Suspensão de Contrato' },
                { value: 'observacao', label: 'Observação Geral (Nota de Campo)' },
              ]}
            />
          </div>

          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-black text-primary uppercase block">Sincronização Integrada</span>
              <span className="text-[9px] font-bold text-muted-foreground block mt-0.5 leading-relaxed">
                Este registro será vinculado à escala do colaborador. Ao definir um "Status na Escala", os dias correspondentes serão atualizados automaticamente no calendário de plantões e folgas.
              </span>
            </div>
          </div>

          <FuncionarioSelector
            label="Funcionário *"
            value={recordForm.funcionario_id}
            onChange={id => setRecordForm({ ...recordForm, funcionario_id: id })}
            funcionarios={availableFuncionarios}
          />

          {/* Date controls based on recordType */}
          {recordType === 'suspensao' ? (
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="date"
                label="Data de Início *"
                className="h-12 rounded-xl"
                value={recordForm.data_inicio}
                onChange={e => setRecordForm({ ...recordForm, data_inicio: e.target.value })}
              />

              <Input
                type="date"
                label="Data de Término *"
                className="h-12 rounded-xl"
                value={recordForm.data_fim}
                onChange={e => setRecordForm({ ...recordForm, data_fim: e.target.value })}
              />
            </div>
          ) : (
            <Input
              type="date"
              label="Data do Ocorrido *"
              className="h-12 rounded-xl"
              value={recordForm.data}
              onChange={e => setRecordForm({ ...recordForm, data: e.target.value })}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="text"
              label={recordType === 'observacao' ? 'Descrição / Nota *' : 'Motivo Rápido *'}
              className="h-12 rounded-xl"
              placeholder={recordType === 'observacao' ? 'Ex: Colaborador trabalhou muito bem' : 'Ex: Falta injustificada'}
              value={recordForm.motivo}
              onChange={e => setRecordForm({ ...recordForm, motivo: e.target.value })}
            />

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-2">Status na Escala *</label>
              <Select
                className="h-12 rounded-xl"
                value={recordForm.escala_status}
                onChange={e => setRecordForm({ ...recordForm, escala_status: e.target.value })}
                options={escalaStatusOptions}
              />
            </div>
          </div>

          {/* Warnings specifics */}
          {recordType === 'advertencia' && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-2">Gravidade *</label>
                <Select
                  className="h-12 rounded-xl"
                  value={recordForm.gravidade}
                  onChange={e => setRecordForm({ ...recordForm, gravidade: e.target.value as any })}
                  options={[
                    { value: 'leve', label: 'Leve (Índigo)' },
                    { value: 'media', label: 'Média (Âmbar)' },
                    { value: 'grave', label: 'Grave (Rose)' },
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-2">Descrição Detalhada *</label>
                <textarea
                  placeholder="Descreva detalhadamente o comportamento ou a violação disciplinar..."
                  value={recordForm.descricao}
                  onChange={e => setRecordForm({ ...recordForm, descricao: e.target.value })}
                  className="w-full p-4 bg-muted/40 border border-transparent focus:border-indigo-500/20 rounded-2xl text-xs font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/45 min-h-[100px] outline-none transition-all"
                />
              </div>

              {/* Signed switch */}
              <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  <div>
                    <span className="text-xs font-black text-foreground uppercase block leading-none">Colaborador Assinou?</span>
                    <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">Assinado de próprio punho ou ciência</span>
                  </div>
                </div>
                <input 
                  type="checkbox"
                  checked={recordForm.assinada}
                  onChange={e => setRecordForm({ ...recordForm, assinada: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded border-border cursor-pointer"
                />
              </div>
            </>
          )}

          {/* Warnings & Suspensions PDF/Image upload */}
          {recordType !== 'observacao' && (
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest ml-2">
                Anexar Termo / Notificação Assinado (PDF/Foto)
              </label>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".pdf,image/*" 
                  onChange={(e) => {
                    const mappedType = recordType === 'advertencia' 
                      ? 'warning' 
                      : recordType === 'suspensao' 
                        ? 'suspension' 
                        : 'observacao'
                    handleFileUpload(e, mappedType)
                  }} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className={cn(
                  "w-full p-5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-300", 
                  recordForm.pdf_name 
                    ? "border-emerald-500/40 bg-emerald-500/5" 
                    : "border-border/60 bg-muted/20 hover:bg-muted/30"
                )}>
                  {isUploading ? (
                    <Loading size="sm" text="Processando e compactando..." />
                  ) : recordForm.pdf_name ? (
                    <div className="flex flex-col items-center gap-1.5 w-full text-center">
                      {isFileImage(recordForm.pdf_name) ? (
                        <div className="relative w-12 h-12 rounded-lg border border-emerald-500/30 overflow-hidden shadow-sm">
                          <img src={recordForm.pdf_url} alt="Minipreview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FileCheck className="w-6 h-6 text-emerald-500" />
                      )}
                      <span className="text-[10px] font-black text-emerald-600 truncate max-w-full px-4">{recordForm.pdf_name}</span>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setRecordForm(prev => ({ ...prev, pdf_name: '', pdf_url: '' })) }} 
                        className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 underline tracking-wider mt-0.5"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileUp className="w-6 h-6 text-muted-foreground" />
                      <span className="text-[10px] font-black text-foreground uppercase">Anexar Documento</span>
                      <span className="text-[8px] font-bold text-muted-foreground/60">PDF, JPG ou PNG (Máx 5MB)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button variant="ghost" type="button" className="flex-1 rounded-xl h-11 text-xs font-bold" onClick={() => setIsRecordModalOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 rounded-xl h-11 text-xs font-black uppercase tracking-wider bg-indigo-600 text-white">Salvar Registro</Button>
          </div>
        </form>
      </Modal>

      {/* DOCUMENT PREVIEW MODAL */}
      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)} title={previewTitle}>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/40 p-2 rounded-xl border border-border/30">
            <div className="flex gap-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted text-foreground transition-all">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-muted-foreground flex items-center px-1">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted text-foreground transition-all">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted text-foreground transition-all">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="border border-border/40 rounded-2xl overflow-hidden bg-slate-900/10 min-h-[350px] flex items-center justify-center p-4">
            {previewUrl && (
              previewUrl.startsWith('data:application/pdf') ? (
                <iframe src={previewUrl} className="w-full h-[550px] rounded-xl border-none" title="PDF Preview" />
              ) : (
                <div className="overflow-auto max-h-[550px] flex items-center justify-center w-full">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full h-auto rounded-lg transition-all duration-300"
                    style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
