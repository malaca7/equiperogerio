import React, { useState, useMemo, useEffect } from 'react'
import { format, parseISO, eachDayOfInterval, differenceInDays, isSunday, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Plus, FileText, Calendar, Trash2, Search, FileUp, Eye, Activity, 
  Edit3, Clock, Users, TrendingUp, Image as ImageIcon, X, Info, 
  RotateCw, ZoomIn, ZoomOut, RefreshCw, ChevronDown, CheckCircle, 
  AlertCircle, Shield, FileCheck
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { useAuth } from '../contexts/AuthContext'
import { useUserTeam } from '../hooks/useUserTeam'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { batchUpsert } from '../lib/batchUtils'

interface AtestadoRecord {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid: string
  motivo: string
  pdf_url?: string
  pdf_name?: string
  pdf_sst_url?: string
  pdf_sst_name?: string
  created_at: string
  created_by?: string
}

const safeFormatDate = (dateStr?: string, fmt = 'dd/MM/yyyy') => {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return '-'
  }
}

export function AtestadosPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: teamInfo } = useUserTeam()

  const isManager = !teamInfo?.isRestricted
  const currentUserId = user?.profile?.id || ''

  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('Visualizar Anexo')
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null)
  const [baseZoom, setBaseZoom] = useState(1)
  
  // Mobile UI card expansion state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setTouchStartDist(getDistance(e.touches))
      setBaseZoom(zoom)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist) {
      const currentDist = getDistance(e.touches)
      const ratio = currentDist / touchStartDist
      const newZoom = Math.min(4, Math.max(0.5, baseZoom * ratio))
      setZoom(newZoom)
    }
  }

  const handleTouchEnd = () => {
    setTouchStartDist(null)
  }

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all')

  const emptyForm = {
    funcionario_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    dias: 1,
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    cid: '',
    motivo: '',
    pdf_url: '',
    pdf_name: '',
    pdf_sst_url: '',
    pdf_sst_name: ''
  }
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    if (formData.data_inicio && formData.dias > 0) {
      try {
        const start = parseISO(formData.data_inicio)
        const computedFim = format(addDays(start, formData.dias - 1), 'yyyy-MM-dd')
        if (computedFim !== formData.data_fim) {
          setFormData(prev => ({ ...prev, data_fim: computedFim }))
        }
      } catch {
        // ignore
      }
    }
  }, [formData.data_inicio, formData.dias])

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: atestados = [], isLoading: loadA } = useConfiguracao<AtestadoRecord[]>('atestados_records', [])
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  const updateConfig = useUpdateConfiguracao()
  const batchEscala = useBatchUpsertEscalas()
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('escala_db_changes')
      .on('broadcast', { event: 'sync' }, () => {
        qc.invalidateQueries({ queryKey: ['escalas'] })
        qc.invalidateQueries({ queryKey: ['frequencia'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['configuracoes', 'atestados_records'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  // Live calculation of leave days for form preview
  const formCalculatedDays = useMemo(() => {
    if (!formData.data_inicio || !formData.data_fim) return 0
    try {
      const start = parseISO(formData.data_inicio)
      const end = parseISO(formData.data_fim)
      if (end < start) return -1
      return differenceInDays(end, start) + 1
    } catch {
      return 0
    }
  }, [formData.data_inicio, formData.data_fim])

  // Filter employees based on role
  const availableFuncionarios = useMemo(() => {
    if (isManager) return allFuncionarios
    if (teamInfo?.isRestricted) {
      return allFuncionarios.filter(f => teamInfo.teamMemberIds?.includes(f.id))
    }
    return []
  }, [allFuncionarios, isManager, teamInfo])

  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => { map[f.id] = f })
    return map
  }, [allFuncionarios])

  const today = format(new Date(), 'yyyy-MM-dd')

  const filteredAtestados = useMemo(() => {
    if (!Array.isArray(atestados)) return []
    return atestados
      .filter(a => {
        const f = funcMap[a.funcionario_id]
        if (!f) return false
        // Encarregado: only see atestados for their team members or ones they created
        if (!isManager) {
          const isTeamMember = teamInfo?.teamMemberIds?.includes(a.funcionario_id)
          const isCreator = a.created_by === currentUserId
          if (!isTeamMember && !isCreator) return false
        }
        const matchSearch = (f.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.cid || '').toLowerCase().includes(searchTerm.toLowerCase())
        if (!matchSearch) return false
        const dataFim = typeof a.data_fim === 'string' ? a.data_fim : ''
        if (filterStatus === 'active') return dataFim >= today
        if (filterStatus === 'expired') return dataFim < today
        return true
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }, [atestados, searchTerm, funcMap, filterStatus, today, isManager, teamInfo, currentUserId])

  // Stats
  const stats = useMemo(() => {
    if (!Array.isArray(atestados)) return { total: 0, active: 0, totalDays: 0, uniqueEmployees: 0 }
    const visible = atestados.filter(a => {
      if (!isManager) {
        return teamInfo?.teamMemberIds?.includes(a.funcionario_id) || a.created_by === currentUserId
      }
      return true
    })
    const active = visible.filter(a => {
      const dataFim = typeof a.data_fim === 'string' ? a.data_fim : ''
      return dataFim >= today
    })
    const totalDays = visible.reduce((sum, a) => {
      try {
        if (!a.data_inicio || !a.data_fim) return sum + 1
        return sum + Math.max(1, differenceInDays(parseISO(a.data_fim), parseISO(a.data_inicio)) + 1)
      } catch {
        return sum + 1
      }
    }, 0)
    const uniqueEmployees = new Set(visible.map(a => a.funcionario_id).filter(Boolean)).size
    return { total: visible.length, active: active.length, totalDays, uniqueEmployees }
  }, [atestados, today, isManager, teamInfo, currentUserId])

  const canEdit = (atestado: AtestadoRecord) => {
    if (isManager) return true
    return atestado.created_by === currentUserId
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1200 // increased dim for higher quality previews
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
          reject(new Error('Canvas context failed'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7) // slightly better quality
        resolve(dataUrl)
      }
      img.onerror = (err) => reject(err)
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'medical' | 'sst') => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
        if (field === 'medical') {
          setFormData(prev => ({
            ...prev,
            pdf_name: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            pdf_url: compressedUrl
          }))
        } else {
          setFormData(prev => ({
            ...prev,
            pdf_sst_name: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            pdf_sst_url: compressedUrl
          }))
        }
        toast('Imagem processada e anexada!', 'success')
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          if (field === 'medical') {
            setFormData(prev => ({
              ...prev,
              pdf_name: file.name,
              pdf_url: reader.result as string
            }))
          } else {
            setFormData(prev => ({
              ...prev,
              pdf_sst_name: file.name,
              pdf_sst_url: reader.result as string
            }))
          }
          toast('Documento anexado!', 'success')
        }
        reader.readAsDataURL(file)
      }
    } catch (err: any) {
      toast('Erro ao processar imagem: ' + err.message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDirectSSTUpload = async (e: React.ChangeEvent<HTMLInputElement>, atestadoId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return toast('Formatos aceitos: PDF, JPG, PNG, WEBP', 'error')
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast('Arquivo muito grande. Limite: 5MB', 'error')
    }

    try {
      let finalUrl = ''
      let finalName = file.name
      if (file.type.startsWith('image/')) {
        finalUrl = await compressImage(file)
        finalName = file.name.replace(/\.[^/.]+$/, "") + ".jpg"
      } else {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      const updated = atestados.map(a => {
        if (a.id === atestadoId) {
          return {
            ...a,
            pdf_sst_name: finalName,
            pdf_sst_url: finalUrl
          }
        }
        return a
      })
      await updateConfig.mutateAsync({ chave: 'atestados_records', valor: updated })
      toast('Anexo assinado pelo SST adicionado!', 'success')
    } catch (err: any) {
      toast('Erro ao salvar anexo SST: ' + err.message, 'error')
    }
  }

  const openEdit = (a: AtestadoRecord) => {
    let computedDays = 1
    try {
      if (a.data_inicio && a.data_fim) {
        computedDays = Math.max(1, differenceInDays(parseISO(a.data_fim), parseISO(a.data_inicio)) + 1)
      }
    } catch {
      computedDays = 1
    }
    setFormData({
      funcionario_id: a.funcionario_id,
      data_inicio: a.data_inicio,
      dias: computedDays,
      data_fim: a.data_fim,
      cid: a.cid || '',
      motivo: a.motivo || '',
      pdf_url: a.pdf_url || '',
      pdf_name: a.pdf_name || '',
      pdf_sst_url: a.pdf_sst_url || '',
      pdf_sst_name: a.pdf_sst_name || ''
    })
    setEditingId(a.id)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.funcionario_id || !formData.data_inicio || !formData.dias) {
      return toast('Preencha os campos obrigatórios', 'warning')
    }

    if (formCalculatedDays < 0) {
      return toast('A data final deve ser maior ou igual à data inicial', 'warning')
    }

    try {
      const oldAtestado = editingId ? atestados.find(a => a.id === editingId) : null
      const employeeId = formData.funcionario_id

      const getAtestadoDays = (startStr: string, endStr: string) => {
        try {
          const start = parseISO(startStr)
          const end = parseISO(endStr)
          return eachDayOfInterval({ start, end })
        } catch {
          return []
        }
      }

      const oldDays = oldAtestado ? getAtestadoDays(oldAtestado.data_inicio, oldAtestado.data_fim) : []
      const newDays = getAtestadoDays(formData.data_inicio, formData.data_fim)

      const oldDateStrs = oldDays.map(d => format(d, 'yyyy-MM-dd'))
      const newDateStrs = newDays.map(d => format(d, 'yyyy-MM-dd'))
      const datesToReset = oldDateStrs.filter(d => !newDateStrs.includes(d))

      let updated: AtestadoRecord[]
      if (editingId) {
        updated = atestados.map(a => a.id === editingId ? { ...a, ...formData } : a)
      } else {
        const newRecord: AtestadoRecord = {
          id: `at_${Date.now()}`,
          ...formData,
          created_at: new Date().toISOString(),
          created_by: currentUserId
        }
        updated = [newRecord, ...atestados]
      }

      // 1. Salvar registros
      await updateConfig.mutateAsync({ chave: 'atestados_records', valor: updated })

      // 2. Tratar datas removidas (caso data de início/fim tenha mudado na edição)
      if (datesToReset.length > 0) {
        // Remover frequências
        const { error: deleteFreqError } = await supabase
          .from('frequencia')
          .delete()
          .eq('funcionario_id', employeeId)
          .in('data', datesToReset)
        if (deleteFreqError) throw deleteFreqError

        // Buscar escalas existentes para limpar as observações de atestado e preservar localidade/turno
        const { data: existingEscalasToReset, error: resetFindError } = await supabase
          .from('escalas')
          .select('data, observacoes, localidade, turno')
          .eq('funcionario_id', employeeId)
          .in('data', datesToReset)
        if (resetFindError) throw resetFindError

        // Resetar escalas
        const escalaResets = datesToReset.map(dStr => {
          const parsedDay = parseISO(dStr)
          const isDiaDomingo = isSunday(parsedDay)
          const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dStr)
          const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

          const existing = existingEscalasToReset?.find(e => e.data === dStr)
          const oldObs = existing?.observacoes || ''
          const cleanedObs = oldObs
            .split(' | ')
            .filter((p: string) => !p.trim().startsWith('Atestado:'))
            .join(' | ')
            .trim()

          return {
            funcionario_id: employeeId,
            data: dStr,
            tipo: defaultTipo,
            turno: existing?.turno || ('integral' as const),
            observacoes: cleanedObs || null,
            localidade: existing?.localidade || null
          }
        })
        await batchEscala.mutateAsync(escalaResets)
      }

      // 3. Tratar novas datas de afastamento
      if (newDateStrs.length > 0) {
        // Upsert na frequencia
        const freqUpserts = newDateStrs.map(dStr => ({
          funcionario_id: employeeId,
          data: dStr,
          status: 'atestado',
          updated_at: new Date().toISOString()
        }))
        await batchUpsert('frequencia', freqUpserts, { onConflict: 'funcionario_id,data', chunkSize: 35 })

        // Buscar escalas existentes para mesclar observações e preservar localidade/turno
        const { data: existingEscalasToUpdate, error: updateFindError } = await supabase
          .from('escalas')
          .select('data, observacoes, localidade, turno')
          .eq('funcionario_id', employeeId)
          .in('data', newDateStrs)
        if (updateFindError) throw updateFindError

        // Upsert na escala
        const escalaUpdates = newDateStrs.map(dStr => {
          const existing = existingEscalasToUpdate?.find(e => e.data === dStr)
          const oldObs = existing?.observacoes || ''
          const atestadoObsText = `Atestado: ${formData.cid || ''} - ${formData.motivo || ''}`

          let cleanedObs = oldObs
            .split(' | ')
            .filter((p: string) => !p.trim().startsWith('Atestado:'))
            .join(' | ')
            .trim()

          const finalObs = cleanedObs
            ? `${cleanedObs} | ${atestadoObsText}`
            : atestadoObsText

          return {
            funcionario_id: employeeId,
            data: dStr,
            tipo: 'atestado',
            observacoes: finalObs,
            turno: existing?.turno || ('integral' as const),
            localidade: existing?.localidade || null
          }
        })
        await batchEscala.mutateAsync(escalaUpdates)
      }

      // 4. Invalidar todos os caches
      qc.invalidateQueries({ queryKey: ['escalas'] })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })

      // Sincronizar em tempo real com a escala
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })

      toast(editingId ? 'Atestado atualizado!' : 'Atestado registrado e escala atualizada!', 'success')
      setIsModalOpen(false)
      setEditingId(null)
      setFormData(emptyForm)
    } catch (err: any) {
      console.error('Error saving medical certificate:', err)
      toast('Erro ao salvar: ' + (err.message || err.details || JSON.stringify(err)), 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const atestadoRecord = atestados.find(a => a.id === id)
    if (!atestadoRecord) return
    if (!confirm('Deseja remover este atestado definitivamente?')) return

    try {
      // 1. Salvar alteração na configuração de registros
      await updateConfig.mutateAsync({ chave: 'atestados_records', valor: atestados.filter(a => a.id !== id) })

      // 2. Obter todas as datas cobertas pelo atestado removido
      const start = parseISO(atestadoRecord.data_inicio)
      const end = parseISO(atestadoRecord.data_fim)
      const days = eachDayOfInterval({ start, end })
      const dateStrs = days.map(d => format(d, 'yyyy-MM-dd'))

      if (dateStrs.length > 0) {
        // 3. Remover frequências
        const { error: deleteFreqError } = await supabase
          .from('frequencia')
          .delete()
          .eq('funcionario_id', atestadoRecord.funcionario_id)
          .in('data', dateStrs)
        if (deleteFreqError) throw deleteFreqError

        // Buscar escalas existentes para limpar as observações de atestado e preservar localidade/turno
        const { data: existingEscalasToReset, error: resetFindError } = await supabase
          .from('escalas')
          .select('data, observacoes, localidade, turno')
          .eq('funcionario_id', atestadoRecord.funcionario_id)
          .in('data', dateStrs)
        if (resetFindError) throw resetFindError

        // 4. Resetar escalas
        const escalaResets = dateStrs.map(dStr => {
          const parsedDay = parseISO(dStr)
          const isDiaDomingo = isSunday(parsedDay)
          const isFeriado = Array.isArray(feriados) && feriados.some((f: any) => f.data === dStr)
          const defaultTipo = (isDiaDomingo || isFeriado) ? 'repouso' : 'presente'

          const existing = existingEscalasToReset?.find(e => e.data === dStr)
          const oldObs = existing?.observacoes || ''
          const cleanedObs = oldObs
            .split(' | ')
            .filter((p: string) => !p.trim().startsWith('Atestado:'))
            .join(' | ')
            .trim()

          return {
            funcionario_id: atestadoRecord.funcionario_id,
            data: dStr,
            tipo: defaultTipo,
            turno: existing?.turno || ('integral' as const),
            observacoes: cleanedObs || null,
            localidade: existing?.localidade || null
          }
        })
        await batchEscala.mutateAsync(escalaResets)
      }

      // 5. Invalidar caches
      qc.invalidateQueries({ queryKey: ['escalas'] })
      qc.invalidateQueries({ queryKey: ['frequencia'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })

      // Sincronizar em tempo real com a escala
      supabase.channel('escala_db_changes').send({ type: 'broadcast', event: 'sync', payload: {} })

      toast('Registro de atestado removido e escalas sincronizadas!', 'success')
    } catch (err: any) {
      console.error('Error deleting medical certificate:', err)
      toast('Erro ao remover: ' + (err.message || err.details || JSON.stringify(err)), 'error')
    }
  }

  const isFileImage = (name?: string) => {
    if (!name) return false
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
  }

  // Calculate percentage progress of leave
  const getLeaveProgress = (startStr: string, endStr: string) => {
    try {
      const start = parseISO(startStr)
      const end = parseISO(endStr)
      const parsedToday = parseISO(today)
      
      const total = differenceInDays(end, start) + 1
      const elapsed = differenceInDays(parsedToday, start) + 1
      
      if (elapsed < 0) return { percent: 0, text: 'A iniciar' }
      if (elapsed > total) return { percent: 100, text: 'Concluído' }
      return { 
        percent: Math.round((elapsed / total) * 100), 
        text: `${elapsed}/${total} dia${total > 1 ? 's' : ''}` 
      }
    } catch {
      return { percent: 0, text: '-' }
    }
  }

  // Toggle card details on mobile
  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loadF || loadA) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Atestados" />
        <div className="pt-28 sm:pt-32 pb-20">
          <Loading text="Carregando registros..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Gestão de Atestados" subtitle="Registro e controle de atestados e afastamentos" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* Stats Cards Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total de Registros', value: stats.total, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Atestados Ativos', value: stats.active, icon: Activity, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.08)]' },
            { label: 'Total Dias Afastados', value: stats.totalDays, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Colaboradores Afastados', value: stats.uniqueEmployees, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          ].map(s => (
            <div key={s.label} className={cn("bg-card/75 dark:bg-card/45 backdrop-blur-xl border rounded-3xl p-5 shadow-sm transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between", s.bg)}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-card border border-border/40 flex items-center justify-center shadow-inner">
                  <s.icon className={cn("w-5.5 h-5.5", s.color)} />
                </div>
                <span className="text-[10px] font-black uppercase text-muted-foreground/30 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Estatísticas
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground tracking-tight">{s.value}</p>
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider mt-1.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search and Filters Toolbar */}
        <div className="bg-card/85 dark:bg-card/45 backdrop-blur-2xl border border-border/40 rounded-[2rem] p-4 sm:p-5 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* Search input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Buscar por colaborador ou código CID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-muted/30 dark:bg-muted/15 border border-border/40 focus:border-primary/40 rounded-2xl text-sm font-bold text-foreground placeholder-muted-foreground/50 focus:ring-0 transition-all outline-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick status selector */}
            <div className="flex bg-muted/40 dark:bg-muted/15 border border-border/40 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto gap-1">
              {(['all', 'active', 'expired'] as const).map(s => (
                <button 
                  key={s} 
                  onClick={() => setFilterStatus(s)} 
                  className={cn(
                    "flex-1 lg:flex-none px-5 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 whitespace-nowrap", 
                    filterStatus === s 
                      ? "bg-card text-primary shadow-sm border border-border/30 font-black" 
                      : "text-muted-foreground hover:text-foreground font-bold"
                  )}
                >
                  {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Expirados'}
                </button>
              ))}
            </div>

            {/* Add button */}
            <Button 
              onClick={() => { setEditingId(null); setFormData(emptyForm); setIsModalOpen(true) }} 
              className="w-full lg:w-auto rounded-2xl gap-2 font-black text-xs uppercase tracking-widest px-8 h-12.5 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex-shrink-0"
            >
              <Plus className="w-4.5 h-4.5 stroke-[3px]" /> Novo Atestado
            </Button>
          </div>
        </div>

        {/* Desktop View (Table Layout) */}
        <div className="hidden lg:block bg-card/75 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Colaborador</th>
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período / Duração</th>
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Status</th>
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">CID / Observações</th>
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Documentos</th>
                  <th className="py-4.5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredAtestados.length > 0 ? (
                  filteredAtestados.map(a => {
                    const func = funcMap[a.funcionario_id]
                    const isActive = typeof a.data_fim === 'string' ? a.data_fim >= today : false
                    const days = (() => {
                      try {
                        if (!a.data_inicio || !a.data_fim) return 1
                        return Math.max(1, differenceInDays(parseISO(a.data_fim), parseISO(a.data_inicio)) + 1)
                      } catch {
                        return 1
                      }
                    })()
                    const editable = canEdit(a)
                    const progress = getLeaveProgress(a.data_inicio, a.data_fim)

                    return (
                      <tr key={a.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner flex-shrink-0 border",
                              isActive 
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                : "bg-muted text-muted-foreground border-border/40"
                            )}>
                              {func?.nome?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-foreground truncate tracking-tight">{func?.nome || 'Funcionario Removido'}</p>
                              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">{func?.setor || 'Sem Setor'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black text-foreground">
                                {safeFormatDate(a.data_inicio)}
                              </span>
                              <span className="text-muted-foreground/40 text-[9px] font-black">➡</span>
                              <span className="text-[11px] font-black text-foreground">
                                {safeFormatDate(a.data_fim)}
                              </span>
                            </div>
                            
                            {/* Mini progress bar for elapsed leave */}
                            <div className="mt-2 w-36">
                              <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
                                <span>Progresso</span>
                                <span>{progress.text}</span>
                              </div>
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", isActive ? "bg-rose-500" : "bg-muted-foreground/45")} 
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            isActive 
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                              : "bg-muted text-muted-foreground border-border/50"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-rose-500 animate-pulse" : "bg-muted-foreground")} />
                            {isActive ? 'Ativo' : 'Encerrado'}
                          </span>
                        </td>

                        <td className="py-4 px-6 max-w-xs">
                          <div className="space-y-1">
                            {a.cid ? (
                              <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 tracking-wider">
                                CID {a.cid}
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">Sem CID</span>
                            )}
                            {a.motivo ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 italic">"{a.motivo}"</p>
                            ) : (
                              <p className="text-xs text-muted-foreground/40 italic">Sem observações</p>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center gap-1.5">
                            {/* Medical attachment */}
                            {a.pdf_url ? (
                              <button 
                                onClick={() => { setZoom(1); setRotation(0); setPreviewUrl(a.pdf_url!); setPreviewTitle('Anexo do Atestado Médico') }} 
                                className="flex items-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 text-[9px] font-black uppercase text-rose-600 hover:text-white rounded-xl transition-all shadow-sm"
                                title={a.pdf_name}
                              >
                                {isFileImage(a.pdf_name) ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                Médico
                              </button>
                            ) : (
                              <span className="text-[9px] text-muted-foreground/40 font-black uppercase tracking-wider">S/ Anexo</span>
                            )}

                            {/* SST attachment */}
                            {a.pdf_sst_url ? (
                              <button 
                                onClick={() => { setZoom(1); setRotation(0); setPreviewUrl(a.pdf_sst_url!); setPreviewTitle('Anexo de Retorno SST') }} 
                                className="flex items-center gap-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-600 border border-blue-500/20 text-[9px] font-black uppercase text-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                                title={a.pdf_sst_name}
                              >
                                {isFileImage(a.pdf_sst_name) ? <ImageIcon className="w-3.5 h-3.5" /> : <FileCheck className="w-3.5 h-3.5" />}
                                SST
                              </button>
                            ) : (
                              editable && (
                                <div className="relative">
                                  <input 
                                    type="file" 
                                    accept=".pdf,image/*" 
                                    onChange={(e) => handleDirectSSTUpload(e, a.id)} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                  />
                                  <button 
                                    type="button" 
                                    className="flex items-center gap-1 px-3 py-2 bg-muted hover:bg-muted-foreground/15 border border-dashed border-border/70 text-[9px] font-black uppercase text-muted-foreground rounded-xl transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    SST
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            {editable ? (
                              <>
                                <button 
                                  onClick={() => openEdit(a)} 
                                  className="w-9.5 h-9.5 rounded-xl bg-muted/40 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all flex items-center justify-center border border-border/20 active:scale-90"
                                  title="Editar registro"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(a.id)} 
                                  className="w-9.5 h-9.5 rounded-xl bg-muted/40 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-500 transition-all flex items-center justify-center border border-border/20 active:scale-90"
                                  title="Excluir atestado"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[9px] text-muted-foreground/30 font-bold uppercase tracking-wider mr-2 select-none" title="Sem permissão para editar">Apenas Visualizar</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="w-20 h-20 bg-muted/30 rounded-[2rem] flex items-center justify-center mx-auto mb-5 text-muted-foreground/35 border border-border/20">
                        <FileText className="w-9 h-9" />
                      </div>
                      <h3 className="text-lg font-black text-foreground tracking-tight">Nenhum atestado encontrado</h3>
                      <p className="text-sm text-muted-foreground mt-2">Tente ajustar a busca ou clique em "Novo Atestado" para cadastrar.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View (Card List Layout) */}
        <div className="lg:hidden space-y-4">
          {filteredAtestados.length > 0 ? (
            filteredAtestados.map(a => {
              const func = funcMap[a.funcionario_id]
              const isActive = typeof a.data_fim === 'string' ? a.data_fim >= today : false
              const days = (() => {
                try {
                  if (!a.data_inicio || !a.data_fim) return 1
                  return Math.max(1, differenceInDays(parseISO(a.data_fim), parseISO(a.data_inicio)) + 1)
                } catch {
                  return 1
                }
              })()
              const editable = canEdit(a)
              const progress = getLeaveProgress(a.data_inicio, a.data_fim)
              const isExpanded = expandedCards[a.id] || false

              return (
                <div 
                  key={a.id} 
                  className={cn(
                    "bg-card/85 dark:bg-card/45 border rounded-3xl p-5 shadow-sm transition-all duration-300 relative overflow-hidden",
                    isActive ? "border-rose-500/20" : "border-border/30"
                  )}
                >
                  {/* Highlight bar at top */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl", isActive ? "bg-rose-500" : "bg-muted-foreground/30")} />

                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner flex-shrink-0 border",
                        isActive ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-muted text-muted-foreground"
                      )}>
                        {func?.nome?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate tracking-tight uppercase">
                          {func?.apelido?.trim() ? func.apelido : (func?.nome || 'Colaborador')}
                        </h4>
                        {func?.apelido?.trim() && func.apelido.trim().toLowerCase() !== func.nome?.trim().toLowerCase() && (
                          <p className="text-[9.5px] font-medium text-muted-foreground/80 truncate leading-tight uppercase">
                            {func.nome}
                          </p>
                        )}
                        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">{func?.setor || 'Sem Setor'}</p>
                      </div>
                    </div>

                    <span className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border flex-shrink-0",
                      isActive ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-muted text-muted-foreground border-border/40"
                    )}>
                      {isActive ? 'Ativo' : 'Encerrado'}
                    </span>
                  </div>

                  {/* Period and progress section */}
                  <div className="mt-4 pl-2 space-y-3.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="text-foreground">{safeFormatDate(a.data_inicio, 'dd/MM/yy')}</span>
                        <span className="text-muted-foreground/40 font-black">➡</span>
                        <span className="text-foreground">{safeFormatDate(a.data_fim, 'dd/MM/yy')}</span>
                      </div>
                      <span className="text-[10px] font-black text-muted-foreground/70">{days} dia{days > 1 ? 's' : ''}</span>
                    </div>

                    {/* Mobile Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[8px] font-black uppercase tracking-wider text-muted-foreground/60 mb-1">
                        <span>Tempo Decorrido</span>
                        <span>{progress.text}</span>
                      </div>
                      <div className="w-full h-2 bg-muted dark:bg-muted/10 rounded-full overflow-hidden border border-border/20">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-500", isActive ? "bg-rose-500" : "bg-muted-foreground/40")} 
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CID and Observations */}
                  <div className="mt-4 pl-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.cid && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-600 tracking-wider">
                          CID: {a.cid}
                        </span>
                      )}
                      
                      {a.motivo && (
                        <button 
                          onClick={() => toggleCard(a.id)}
                          className="text-[9px] font-black uppercase tracking-wider text-primary flex items-center gap-1 py-0.5 px-2 hover:bg-muted/30 rounded-lg"
                        >
                          Detalhes <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded ? "rotate-180" : "")} />
                        </button>
                      )}
                    </div>

                    {isExpanded && a.motivo && (
                      <div className="p-3 bg-muted/20 border border-border/30 rounded-2xl mt-2 animate-fadeIn">
                        <p className="text-xs text-muted-foreground italic leading-relaxed">"{a.motivo}"</p>
                      </div>
                    )}
                  </div>

                  {/* Footer links and actions */}
                  <div className="mt-5 pt-4 border-t border-border/20 pl-2 flex flex-col gap-3">
                    {/* Documents */}
                    <div className="flex flex-wrap gap-2">
                      {a.pdf_url ? (
                        <button 
                          onClick={() => { setZoom(1); setRotation(0); setPreviewUrl(a.pdf_url!); setPreviewTitle('Anexo Médico') }} 
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-500/10 active:bg-rose-500 hover:text-white text-[9.5px] font-black uppercase text-rose-600 rounded-xl transition-all border border-rose-500/20"
                        >
                          {isFileImage(a.pdf_name) ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          Atestado
                        </button>
                      ) : (
                        <span className="flex-1 text-center py-2.5 text-[9px] bg-muted/30 border border-border/20 text-muted-foreground/40 font-black uppercase tracking-wider rounded-xl select-none">Sem Atestado</span>
                      )}

                      {a.pdf_sst_url ? (
                        <button 
                          onClick={() => { setZoom(1); setRotation(0); setPreviewUrl(a.pdf_sst_url!); setPreviewTitle('Anexo SST') }} 
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-500/10 active:bg-blue-500 hover:text-white text-[9.5px] font-black uppercase text-blue-600 rounded-xl transition-all border border-blue-500/20"
                        >
                          {isFileImage(a.pdf_sst_name) ? <ImageIcon className="w-3.5 h-3.5" /> : <FileCheck className="w-3.5 h-3.5" />}
                          Retorno SST
                        </button>
                      ) : (
                        editable && (
                          <div className="flex-1 relative">
                            <input 
                              type="file" 
                              accept=".pdf,image/*" 
                              onChange={(e) => handleDirectSSTUpload(e, a.id)} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                            />
                            <button 
                              type="button" 
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-muted active:bg-muted-foreground/15 border border-dashed border-border/70 text-[9.5px] font-black uppercase text-muted-foreground rounded-xl transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Anexar SST
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {/* Manage buttons */}
                    {editable && (
                      <div className="flex items-center justify-end gap-2 border-t border-border/10 pt-3">
                        <button 
                          onClick={() => openEdit(a)} 
                          className="flex items-center justify-center gap-1.5 px-4 h-9.5 rounded-xl bg-muted/40 text-muted-foreground hover:text-primary transition-all text-[10px] font-black uppercase tracking-widest border border-border/20 active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button 
                          onClick={() => handleDelete(a.id)} 
                          className="flex items-center justify-center gap-1.5 px-4 h-9.5 rounded-xl bg-muted/40 text-muted-foreground hover:text-rose-500 transition-all text-[10px] font-black uppercase tracking-widest border border-border/20 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-card/75 border border-border/30 rounded-3xl py-16 px-4 text-center">
              <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-muted-foreground/35">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-foreground">Nenhum atestado cadastrado</h3>
              <p className="text-xs text-muted-foreground mt-1.5">Clique no botão abaixo para registrar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Preview Modal */}
      <Modal open={!!previewUrl} onClose={() => { setPreviewUrl(null); setZoom(1); setRotation(0) }} title={previewTitle} className="max-w-4xl">
        {previewUrl && (
          <div className="flex flex-col items-center w-full">
            {/* Elegant controls toolbar */}
            <div className="flex flex-wrap justify-center gap-2 mb-4 bg-muted/50 dark:bg-muted/15 p-2 rounded-2xl shadow-inner border border-border/40 w-full max-w-md">
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-9 h-9 rounded-xl p-0 font-black text-base transition-all active:scale-90 border border-border/20 shadow-sm bg-card hover:bg-muted/65" title="Diminuir Zoom">
                <ZoomOut className="w-4 h-4 text-muted-foreground" />
              </Button>
              <span className="text-[10px] font-black uppercase tracking-widest self-center px-3 text-muted-foreground select-none min-w-[70px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="w-9 h-9 rounded-xl p-0 font-black text-base transition-all active:scale-90 border border-border/20 shadow-sm bg-card hover:bg-muted/65" title="Aumentar Zoom">
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
              </Button>
              <div className="w-[1px] bg-border/40 mx-1 self-stretch" />
              <Button size="sm" variant="ghost" onClick={() => setRotation(r => (r + 90) % 360)} className="w-9 h-9 rounded-xl p-0 font-black text-base transition-all active:scale-90 border border-border/20 shadow-sm bg-card hover:bg-muted/65" title="Rotacionar 90°">
                <RotateCw className="w-4 h-4 text-primary" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setRotation(0) }} className="px-4.5 h-9 rounded-xl text-[9px] uppercase font-black tracking-widest text-muted-foreground border border-border/20 shadow-sm bg-card hover:bg-muted/65" title="Redefinir visualização">
                <RefreshCw className="w-3.5 h-3.5 mr-1 inline-block" /> Reset
              </Button>
            </div>
            
            {/* Viewer Panel */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full flex items-center justify-center min-h-[350px] max-h-[65vh] overflow-auto rounded-[2rem] border border-border/40 bg-muted/20 dark:bg-muted/5 p-4 relative touch-none select-none"
            >
              {previewUrl.startsWith('data:image') ? (
                <div className="transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'center center' }}>
                  <img src={previewUrl} alt="Anexo de Atestado" className="max-w-full max-h-[58vh] object-contain rounded-xl shadow-lg pointer-events-none" />
                </div>
              ) : previewUrl.startsWith('data:application/pdf') ? (
                <iframe src={previewUrl} className="w-full h-[60vh] rounded-2xl border-0" />
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 text-rose-500/80 mx-auto mb-3" />
                  <p className="text-sm font-bold">Pré-visualização indisponível</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Este formato de arquivo não pode ser visualizado no navegador.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modern Form Modal */}
      <Modal open={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingId(null) }} title={editingId ? 'Editar Atestado' : 'Registrar Atestado'} className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto px-1 scrollbar-thin">
          
          {/* Employee Select */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Colaborador *
            </label>
            <select
              value={formData.funcionario_id}
              onChange={e => setFormData({ ...formData, funcionario_id: e.target.value })}
              disabled={!!editingId}
              className="w-full px-4 py-3.5 bg-muted/40 dark:bg-muted/15 border border-border/50 focus:border-primary/40 rounded-2xl text-sm font-bold focus:ring-0 text-foreground disabled:opacity-50 outline-none transition-colors"
            >
              <option value="">Selecione um funcionário...</option>
              {availableFuncionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome} — {f.setor}</option>
              ))}
            </select>
          </div>

          {/* Date range grid with live days calculation */}
          <div className="bg-muted/20 dark:bg-muted/5 border border-border/30 rounded-3xl p-4.5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Início *
                </label>
                <input 
                  type="date" 
                  value={formData.data_inicio} 
                  onChange={e => setFormData({ ...formData, data_inicio: e.target.value })} 
                  className="w-full px-4 py-3 bg-card border border-border/50 focus:border-primary/45 rounded-2xl text-sm font-bold text-foreground outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Quantidade de Dias *
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={formData.dias} 
                  onChange={e => setFormData({ ...formData, dias: Math.max(1, parseInt(e.target.value) || 1) })} 
                  className="w-full px-4 py-3 bg-card border border-border/50 focus:border-primary/45 rounded-2xl text-sm font-bold text-foreground outline-none transition-all" 
                />
              </div>
            </div>
            
            {/* Live days display badge */}
            <div className="flex items-center justify-between border-t border-border/20 pt-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Período Calculado
              </span>
              {formData.dias > 0 ? (
                <span className="text-[10.5px] font-black uppercase px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 tracking-wider">
                  {formData.dias} Dia{formData.dias > 1 ? 's' : ''} (Até {safeFormatDate(formData.data_fim)})
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-500 tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Quantidade inválida
                </span>
              )}
            </div>
          </div>

          {/* CID input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> CID (Opcional - Classificação Internacional de Doenças)
            </label>
            <input 
              type="text" 
              placeholder="Ex: M54.5 (Opcional)" 
              value={formData.cid} 
              onChange={e => setFormData({ ...formData, cid: e.target.value.toUpperCase() })} 
              className="w-full px-4 py-3.5 bg-muted/40 dark:bg-muted/15 border border-border/50 focus:border-primary/40 rounded-2xl text-sm font-bold text-foreground outline-none transition-colors" 
            />
          </div>

          {/* Observations/Motivo */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Observações / Detalhes
            </label>
            <textarea 
              placeholder="Descreva detalhes ou observações pertinentes ao atestado..." 
              value={formData.motivo} 
              onChange={e => setFormData({ ...formData, motivo: e.target.value })} 
              className="w-full px-4 py-3.5 bg-muted/40 dark:bg-muted/15 border border-border/50 focus:border-primary/40 rounded-2xl text-sm font-bold text-foreground h-24 resize-none outline-none transition-colors" 
            />
          </div>

          {/* File attachment medical */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-500" /> Atestado Médico Anexo
            </label>
            <div className="relative">
              <input 
                type="file" 
                accept=".pdf,image/*" 
                onChange={(e) => handleFileUpload(e, 'medical')} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className={cn(
                "w-full p-6 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 transition-all duration-300", 
                formData.pdf_name 
                  ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10" 
                  : "border-border/60 bg-muted/20 dark:bg-muted/5 hover:bg-muted/30"
              )}>
                {isUploading ? (
                  <Loading size="sm" text="Fazendo upload e compactando..." />
                ) : formData.pdf_name ? (
                  <div className="flex flex-col items-center gap-2 w-full text-center">
                    {isFileImage(formData.pdf_name) ? (
                      <div className="relative w-16 h-16 rounded-xl border border-emerald-500/30 overflow-hidden shadow-md">
                        <img src={formData.pdf_url} alt="Minipreview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <FileCheck className="w-8 h-8 text-emerald-500" />
                    )}
                    <div className="max-w-full px-4">
                      <p className="text-xs font-black text-emerald-600 truncate">{formData.pdf_name}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, pdf_name: '', pdf_url: '' })) }} 
                      className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 underline tracking-wider mt-1"
                    >
                      Remover Documento
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-card border border-border/30 flex items-center justify-center shadow-sm">
                      <FileUp className="w-5.5 h-5.5 text-rose-500" />
                    </div>
                    <p className="text-xs font-black text-foreground uppercase tracking-wider mt-1">Anexar Atestado</p>
                    <p className="text-[8.5px] font-bold text-muted-foreground/60 tracking-wider">Formatos suportados: PDF, JPG, PNG (Max 5MB)</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* File attachment SST */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground/70 ml-2 tracking-widest flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-500" /> Guia de Retorno SST Anexa (Segurança do Trabalho)
            </label>
            <div className="relative">
              <input 
                type="file" 
                accept=".pdf,image/*" 
                onChange={(e) => handleFileUpload(e, 'sst')} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className={cn(
                "w-full p-6 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 transition-all duration-300", 
                formData.pdf_sst_name 
                  ? "border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10" 
                  : "border-border/60 bg-muted/20 dark:bg-muted/5 hover:bg-muted/30"
              )}>
                {isUploading ? (
                  <Loading size="sm" text="Fazendo upload e compactando..." />
                ) : formData.pdf_sst_name ? (
                  <div className="flex flex-col items-center gap-2 w-full text-center">
                    {isFileImage(formData.pdf_sst_name) ? (
                      <div className="relative w-16 h-16 rounded-xl border border-blue-500/30 overflow-hidden shadow-md">
                        <img src={formData.pdf_sst_url} alt="Minipreview SST" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <FileCheck className="w-8 h-8 text-blue-500" />
                    )}
                    <div className="max-w-full px-4">
                      <p className="text-xs font-black text-blue-600 truncate">{formData.pdf_sst_name}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, pdf_sst_name: '', pdf_sst_url: '' })) }} 
                      className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 underline tracking-wider mt-1"
                    >
                      Remover Documento
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-card border border-border/30 flex items-center justify-center shadow-sm">
                      <FileUp className="w-5.5 h-5.5 text-blue-500" />
                    </div>
                    <p className="text-xs font-black text-foreground uppercase tracking-wider mt-1">Anexar Guia SST</p>
                    <p className="text-[8.5px] font-bold text-muted-foreground/60 tracking-wider">Formatos suportados: PDF, JPG, PNG (Max 5MB)</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-border/30 flex gap-3">
            <Button 
              variant="ghost" 
              type="button" 
              onClick={() => { setIsModalOpen(false); setEditingId(null) }} 
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest h-12"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest h-12 shadow-lg shadow-primary/20 hover:scale-[1.01] transition-transform"
            >
              {editingId ? 'Salvar Alterações' : 'Confirmar Registro'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
