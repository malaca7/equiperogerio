import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, UserCheck, X, Shield, Trash2, Edit2, MapPin, LayoutGrid, Share2, FileText, Camera, Download, Award, Wrench, Briefcase, Sparkles, Truck, User, Hammer, Route } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { TopHeader } from '../components/layout/TopHeader'
import { cn } from '../lib/utils'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { Funcionario } from '../lib/database.types'

interface Equipe {
  id: string; nome: string; descricao: string | null; cor: string; ativo: boolean; regiao_id: string | null
  encarregados: { id: string; nome: string }[]
  membros: Pick<Funcionario, 'id' | 'nome' | 'apelido' | 'cargo' | 'status' | 'setor'>[]
}

interface Regiao {
  id: string; nome: string; descricao: string | null; cor: string; ativo: boolean
}

const EQUIPES_KEY = ['equipes']
const REGIOES_KEY = ['regioes']
const COLORS = ['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4']

function useEquipes() {
  return useQuery<Equipe[]>({
    queryKey: EQUIPES_KEY,
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, profiles(id, nome)')
      const { data: mem } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, apelido, cargo, status, setor)')
      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles || (e as any).profile || (e as any).funcionarios).filter(Boolean),
        membros: (mem || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionarios).filter(Boolean),
      }))
    },
  })
}

function useRegioes() {
  return useQuery<Regiao[]>({
    queryKey: REGIOES_KEY,
    queryFn: async () => {
      const { data } = await supabase.from('regioes').select('*').order('nome')
      return data || []
    },
  })
}

function useProfiles() {
  return useQuery<any[]>({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome')
      return data || []
    }
  })
}

function useFuncionariosAtivos() {
  return useQuery<Funcionario[]>({
    queryKey: ['func-ativos'],
    queryFn: async () => {
      const { data } = await supabase.from('funcionarios').select('*').is('deleted_at', null).eq('status', 'ativo').order('nome')
      return data || []
    },
  })
}

export function EquipesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission, user } = useAuth()
  const { data: userTeam, isLoading: isLoadingUserTeam } = useUserTeam()
  
  // Permissão de gerenciamento global (Admin / Gerente Geral)
  const hasGlobalManage = hasPermission('equipes', 'gerenciar') || hasPermission('equipes', 'administrar') || hasPermission('funcionarios', 'gerenciar') || !!user?.isAdmin
  const isEncarregado = (userTeam?.isRestricted ?? false) || (user?.roles?.some(r => r.nome.toUpperCase().includes('ENCARREGADO')) ?? false)
  const isEncarregadoOnly = !hasGlobalManage && isEncarregado
  const userTeamIds = userTeam?.teamIds ?? []

  const canEdit = hasGlobalManage || isEncarregado
  const canAdmin = hasGlobalManage

  // O cargo com permissão de gerenciamento pode gerenciar todas as equipes.
  // O cargo com permissão de visualização só gerencia a equipe da qual ele for encarregado.
  const canManageTeam = (equipeId: string) => {
    if (hasGlobalManage) return true
    return userTeamIds.includes(equipeId)
  }

  const { data: equipes = [], isLoading: isLoadingEquipes } = useEquipes()
  const { data: regioes = [], isLoading: isLoadingRegioes } = useRegioes()
  const { data: funcionarios = [] } = useFuncionariosAtivos()
  const { data: profilesList = [] } = useProfiles()

  // Setores & localidades config
  const { data: allSetores = [] } = useConfiguracao<string[]>('setores', [])
  const { data: allLocalidades = [] } = useConfiguracao<any[]>('localidades', [])
  const { data: setoresEquipes = {} } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const updateConfig = useUpdateConfiguracao()
  const [syncing, setSyncing] = useState(false)
  const [selectedReportEquipe, setSelectedReportEquipe] = useState<Equipe | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const shareSquareRef = useRef<HTMLDivElement>(null)
  const { data: plataformaNome = '7Locar' } = useConfiguracao<string>('plataforma_nome', '7Locar')

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { data: todayFrequencias = [] } = useQuery<any[]>({
    queryKey: ['today-frequencia', todayStr],
    queryFn: async () => {
      const { data } = await supabase.from('frequencia').select('funcionario_id, status').eq('data', todayStr)
      return data || []
    }
  })

  const getMemberStatus = (memberId: string, memberDbStatus: string) => {
    if (memberDbStatus === 'inativo') {
      return { 
        label: 'Inativo/Desligado', 
        className: 'bg-rose-100 text-rose-700 border-rose-200',
        style: { backgroundColor: '#ffe4e6', color: '#9f1239', borderColor: '#fecdd3', borderWidth: '1px', borderStyle: 'solid' }
      }
    }
    const freqToday = todayFrequencias.find((f: any) => f.funcionario_id === memberId)
    if (freqToday) {
      if (freqToday.status === 'ferias') {
        return { 
          label: 'De Férias', 
          className: 'bg-amber-100 text-amber-700 border-amber-200',
          style: { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a', borderWidth: '1px', borderStyle: 'solid' }
        }
      }
      if (freqToday.status === 'atestado') {
        return { 
          label: 'Afastado', 
          className: 'bg-purple-100 text-purple-700 border-purple-200',
          style: { backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#e9d5ff', borderWidth: '1px', borderStyle: 'solid' }
        }
      }
    }
    return null
  }

  const getSectorIcon = (setor?: string) => {
    const s = (setor || '').toLowerCase()
    if (s.includes('op') || s.includes('prod') || s.includes('fabr')) return Hammer
    if (s.includes('adm') || s.includes('escrit') || s.includes('finan') || s.includes('rh') || s.includes('gest')) return Briefcase
    if (s.includes('limp') || s.includes('serv') || s.includes('conserv') || s.includes('geral')) return Sparkles
    if (s.includes('seg') || s.includes('vigil')) return Shield
    if (s.includes('log') || s.includes('transp') || s.includes('motor') || s.includes('entreg')) return Truck
    if (s.includes('manut') || s.includes('ofic') || s.includes('mecan')) return Wrench
    return User
  }

  const getSectorColors = (setor?: string) => {
    const s = (setor || '').toLowerCase()
    if (s.includes('op') || s.includes('prod') || s.includes('fabr')) {
      return { bg: '#e0f2fe', text: '#0369a1', bgDark: 'bg-sky-500/10 border-sky-500/25', textDark: 'text-sky-500' } // blue
    }
    if (s.includes('adm') || s.includes('escrit') || s.includes('finan') || s.includes('rh') || s.includes('gest')) {
      return { bg: '#f0fdf4', text: '#15803d', bgDark: 'bg-emerald-500/10 border-emerald-500/25', textDark: 'text-emerald-500' } // green
    }
    if (s.includes('limp') || s.includes('serv') || s.includes('conserv') || s.includes('geral')) {
      return { bg: '#faf5ff', text: '#7e22ce', bgDark: 'bg-purple-500/10 border-purple-500/25', textDark: 'text-purple-500' } // purple
    }
    if (s.includes('seg') || s.includes('vigil')) {
      return { bg: '#fff1f2', text: '#e11d48', bgDark: 'bg-rose-500/10 border-rose-500/25', textDark: 'text-rose-500' } // red
    }
    if (s.includes('log') || s.includes('transp') || s.includes('motor') || s.includes('entreg')) {
      return { bg: '#fff7ed', text: '#c2410c', bgDark: 'bg-orange-500/10 border-orange-500/25', textDark: 'text-orange-500' } // orange
    }
    if (s.includes('manut') || s.includes('ofic') || s.includes('mecan')) {
      return { bg: '#fef9c3', text: '#a16207', bgDark: 'bg-yellow-500/10 border-yellow-500/25', textDark: 'text-yellow-500' } // yellow
    }
    return { bg: '#f1f5f9', text: '#475569', bgDark: 'bg-slate-500/10 border-slate-500/25', textDark: 'text-slate-500' } // gray
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const { data: encs } = await supabase.from('equipe_encarregados').select('equipe_id, user_id')
      const { data: profiles } = await supabase.from('profiles').select('*')
      const { data: funcs } = await supabase.from('funcionarios').select('*').is('deleted_at', null)
      const { data: currentMems } = await supabase.from('equipe_membros').select('equipe_id, funcionario_id')

      if (!encs || !profiles || !funcs) {
        toast('Erro ao buscar dados para sincronização', 'error')
        return
      }

      const currentMemsSet = new Set(
        (currentMems || []).map(m => `${m.equipe_id}_${m.funcionario_id}`)
      )

      const inserts: { equipe_id: string; funcionario_id: string }[] = []

      for (const enc of encs) {
        const profile = profiles.find(p => p.id === enc.user_id)
        if (!profile) continue

        const profileCpfClean = (profile.cpf || '').replace(/\D/g, '')
        const profileNomeClean = (profile.nome || '').toLowerCase().trim()

        const match = funcs.find(f => {
          const fCpfClean = (f.cpf || '').replace(/\D/g, '')
          const fNomeClean = (f.nome || '').toLowerCase().trim()
          return (profileCpfClean && fCpfClean && profileCpfClean === fCpfClean) || (profileNomeClean === fNomeClean)
        })

        if (match) {
          const key = `${enc.equipe_id}_${match.id}`
          if (!currentMemsSet.has(key)) {
            inserts.push({
              equipe_id: enc.equipe_id,
              funcionario_id: match.id
            })
          }
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('equipe_membros').insert(inserts)
        if (error) throw error
        toast(`${inserts.length} encarregados foram sincronizados como membros de suas equipes!`, 'success')
      } else {
        toast('Tudo em ordem! Todos os encarregados já estão sincronizados.', 'success')
      }
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
    } catch (err: any) {
      toast('Erro na sincronização: ' + err.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleShare = async () => {
    if (!shareSquareRef.current || !selectedReportEquipe) return
    const isDark = document.documentElement.classList.contains('dark')
    toast('Gerando imagem do relatório de equipe...', 'success')
    setIsSharing(true)
    try {
      shareSquareRef.current.classList.add('no-shadows')
      
      const { toPng, toJpeg } = await import('html-to-image')
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const renderOptions = {
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
        pixelRatio: isMobile ? 1 : 2,
        skipFonts: true,
        cacheBust: true,
        filter: (node: Node) => {
          const tagName = (node as HTMLElement).tagName?.toLowerCase()
          if (tagName === 'svg' || tagName === 'path') {
            return false
          }
          if (tagName === 'button' || tagName === 'input' || tagName === 'select') {
            return false
          }
          return true
        }
      }

      // Temporarily disable cross-origin stylesheets to prevent tainted canvas / CORS issues
      const disabledSheets: CSSStyleSheet[] = []
      try {
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i]
          try {
            let isCrossOrigin = false
            try {
              if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
                isCrossOrigin = true
              }
            } catch (_) {
              isCrossOrigin = true
            }

            if (isCrossOrigin) {
              try {
                sheet.disabled = true
                disabledSheets.push(sheet)
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Error disabling cross-origin stylesheets:', err)
      }

      let dataUrl = ''
      try {
        if (isMobile) {
          try { await toJpeg(shareSquareRef.current, { ...renderOptions, pixelRatio: 1, quality: 0.5 }) } catch (_) {}
          dataUrl = await toJpeg(shareSquareRef.current, { ...renderOptions, quality: 0.88 })
        } else {
          dataUrl = await toPng(shareSquareRef.current, renderOptions)
        }
      } catch (firstErr) {
        console.warn('First render failed, retrying with simple Jpeg options...', firstErr)
        dataUrl = await toJpeg(shareSquareRef.current, {
          backgroundColor: isDark ? '#0b0f19' : '#ffffff',
          pixelRatio: 1,
          skipFonts: true,
          cacheBust: true,
          quality: 0.85,
          filter: renderOptions.filter
        })
      } finally {
        // Restore disabled stylesheets
        disabledSheets.forEach(sheet => {
          try {
            sheet.disabled = false
          } catch (_) {}
        })
      }
      
      shareSquareRef.current.classList.remove('no-shadows')
      
      // Convert data URL to Blob synchronously (safari-friendly, avoids fetch limits)
      const byteString = atob(dataUrl.split(',')[1])
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })
      const ext = mimeString === 'image/jpeg' ? 'jpg' : 'png'
      const file = new File([blob], `relatorio-equipe-${selectedReportEquipe.nome}.${ext}`, { type: mimeString })
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Efetivo - ${selectedReportEquipe.nome}`,
            files: [file]
          })
          toast('Relatório compartilhado com sucesso!', 'success')
          setIsSharing(false)
          return
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsSharing(false)
            return
          }
          console.error('Erro no navigator.share:', shareErr)
        }
      }
      
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [mimeString]: blob })
          ])
          toast('Imagem copiada! Cole (Ctrl+V) onde desejar.', 'success')
          setIsSharing(false)
          return
        } catch (clipErr) {
          console.error('Erro ao copiar para clipboard', clipErr)
        }
      }
      
      const link = document.createElement('a')
      link.download = `relatorio-equipe-${selectedReportEquipe.nome}.${ext}`
      link.href = dataUrl
      link.click()
      toast('Download iniciado!', 'success')
    } catch (err: any) {
      if (shareSquareRef.current) {
        shareSquareRef.current.classList.remove('no-shadows')
      }
      console.error('Failed to share image', err)
      toast('Erro ao gerar imagem: ' + err.message, 'error')
    } finally {
      setIsSharing(false)
    }
  }
  
  const [activeTab, setActiveTab] = useState<'equipes' | 'regioes'>('equipes')
  const [search, setSearch] = useState('')
  const [searchRegiao, setSearchRegiao] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState<Equipe | null>(null)
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null)
  const manageModal = selectedEquipeId ? equipes.find(eq => eq.id === selectedEquipeId) || null : null
  
  const [createRegiaoModal, setCreateRegiaoModal] = useState(false)
  const [editRegiao, setEditRegiao] = useState<Regiao | null>(null)
  
  const [form, setForm] = useState({ nome: '', descricao: '', cor: COLORS[0], regiao_id: '' })
  const [regiaoForm, setRegiaoForm] = useState({ nome: '', descricao: '', cor: COLORS[0] })
  
  const [tab, setTab] = useState<'membros' | 'encarregados' | 'setores' | 'localidades'>('membros')
  const [memSearch, setMemSearch] = useState('')
  const [newSectorName, setNewSectorName] = useState('')
  const [newLocName, setNewLocName] = useState('')
  const [newLocSector, setNewLocSector] = useState('')
  const [newLocSchedule, setNewLocSchedule] = useState<'segunda_sabado' | 'domingo_feriado' | 'todos'>('segunda_sabado')

  const filtered = equipes
    .filter(eq => {
      if (hasGlobalManage) return true
      if (isEncarregado && userTeamIds.length > 0) return userTeamIds.includes(eq.id)
      return true
    })
    .filter(eq => eq.nome.toLowerCase().includes(search.toLowerCase()))
  const filteredRegioes = regioes.filter(r => r.nome.toLowerCase().includes(searchRegiao.toLowerCase()))

  // All funcionário IDs already assigned as members in any team
  const assignedMemberIds = new Set(equipes.flatMap(eq => eq.membros.map(m => m.id)))

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('equipes').insert({ 
        nome: form.nome, 
        descricao: form.descricao || null, 
        cor: form.cor,
        regiao_id: form.regiao_id || null
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); setCreateModal(false); toast('Equipe criada!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editModal) return
      const { error } = await supabase.from('equipes').update({ 
        nome: form.nome, 
        descricao: form.descricao || null, 
        cor: form.cor,
        regiao_id: form.regiao_id || null
      }).eq('id', editModal.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); setEditModal(null); toast('Equipe atualizada!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('equipes').delete().eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); toast('Equipe excluída', 'success') },
  })

  const createRegiaoMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('regioes').insert({ 
        nome: regiaoForm.nome, 
        descricao: regiaoForm.descricao || null, 
        cor: regiaoForm.cor 
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: REGIOES_KEY }); setCreateRegiaoModal(false); toast('Região criada!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const updateRegiaoMut = useMutation({
    mutationFn: async () => {
      if (!editRegiao) return
      const { error } = await supabase.from('regioes').update({ 
        nome: regiaoForm.nome, 
        descricao: regiaoForm.descricao || null, 
        cor: regiaoForm.cor 
      }).eq('id', editRegiao.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: REGIOES_KEY }); setEditRegiao(null); toast('Região atualizada!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const deleteRegiaoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('regioes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: REGIOES_KEY })
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
      toast('Região excluída', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const addEncarregado = useMutation({
    mutationFn: async ({ equipeId, userId }: { equipeId: string; userId: string }) => {
      const { error } = await supabase.from('equipe_encarregados').insert({ equipe_id: equipeId, user_id: userId })
      if (error) throw error

      // Automatically sync as member
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profile) {
        const { data: funcs } = await supabase
          .from('funcionarios')
          .select('*')
          .is('deleted_at', null)

        const profileCpfClean = (profile.cpf || '').replace(/\D/g, '')
        const profileNomeClean = (profile.nome || '').toLowerCase().trim()

        const match = (funcs || []).find(f => {
          const fCpfClean = (f.cpf || '').replace(/\D/g, '')
          const fNomeClean = (f.nome || '').toLowerCase().trim()
          return (profileCpfClean && fCpfClean && profileCpfClean === fCpfClean) || (profileNomeClean === fNomeClean)
        })

        if (match) {
          const { data: existing } = await supabase
            .from('equipe_membros')
            .select('*')
            .eq('equipe_id', equipeId)
            .eq('funcionario_id', match.id)
            .maybeSingle()

          if (!existing) {
            await supabase.from('equipe_membros').insert({
              equipe_id: equipeId,
              funcionario_id: match.id
            })
          }
        }
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
      qc.invalidateQueries({ queryKey: ['user-team'] })
      qc.invalidateQueries({ queryKey: ['funcionarios'] })
      qc.invalidateQueries({ queryKey: ['team-members'] })
      toast('Encarregado adicionado e sincronizado com membros!', 'success') 
    },
    onError: (e: any) => toast(e.message || 'Erro ao adicionar encarregado', 'error'),
  })

  const removeEncarregado = useMutation({
    mutationFn: async ({ equipeId, userId }: { equipeId: string; userId: string }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      await supabase.from('equipe_encarregados').delete().eq('equipe_id', equipeId).eq('user_id', userId)

      if (profile) {
        const { data: funcs } = await supabase
          .from('funcionarios')
          .select('*')
          .is('deleted_at', null)

        const profileCpfClean = (profile.cpf || '').replace(/\D/g, '')
        const profileNomeClean = (profile.nome || '').toLowerCase().trim()

        const match = (funcs || []).find(f => {
          const fCpfClean = (f.cpf || '').replace(/\D/g, '')
          const fNomeClean = (f.nome || '').toLowerCase().trim()
          return (profileCpfClean && fCpfClean && profileCpfClean === fCpfClean) || (profileNomeClean === fNomeClean)
        })

        if (match) {
          await supabase.from('equipe_membros').delete().eq('equipe_id', equipeId).eq('funcionario_id', match.id)
        }
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
      qc.invalidateQueries({ queryKey: ['user-team'] })
      qc.invalidateQueries({ queryKey: ['funcionarios'] })
      qc.invalidateQueries({ queryKey: ['team-members'] })
      toast('Encarregado removido', 'success') 
    },
  })

  const addMembro = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      const { error } = await supabase.from('equipe_membros').insert({ equipe_id: equipeId, funcionario_id: funcId })
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
      qc.invalidateQueries({ queryKey: ['user-team'] })
      qc.invalidateQueries({ queryKey: ['funcionarios'] })
      qc.invalidateQueries({ queryKey: ['team-members'] })
      toast('Membro adicionado', 'success') 
    },
    onError: (e: any) => toast(e.message?.includes('unique') ? 'Funcionário já está em outra equipe' : e.message, 'error'),
  })

  const removeMembro = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      await supabase.from('equipe_membros').delete().eq('equipe_id', equipeId).eq('funcionario_id', funcId)
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: EQUIPES_KEY })
      qc.invalidateQueries({ queryKey: ['user-team'] })
      qc.invalidateQueries({ queryKey: ['funcionarios'] })
      qc.invalidateQueries({ queryKey: ['team-members'] })
      toast('Membro removido', 'success') 
    },
  })

  const handleCreateSector = async () => {
    if (!newSectorName.trim() || !manageModal) return
    const sectorName = newSectorName.trim()
    
    let updatedSetores = [...allSetores]
    if (!updatedSetores.includes(sectorName)) {
      updatedSetores.push(sectorName)
    }
    
    const currentTeamSetores = setoresEquipes[manageModal.id] || []
    const updatedTeamSetores = currentTeamSetores.includes(sectorName)
      ? currentTeamSetores
      : [...currentTeamSetores, sectorName]
      
    try {
      await Promise.all([
        updateConfig.mutateAsync({ chave: 'setores', valor: updatedSetores }),
        updateConfig.mutateAsync({ chave: 'setores_equipes', valor: { ...setoresEquipes, [manageModal.id]: updatedTeamSetores } })
      ])
      
      setNewSectorName('')
      toast(`Setor "${sectorName}" criado e vinculado com sucesso!`, 'success')
    } catch (err: any) {
      toast('Erro ao criar setor: ' + err.message, 'error')
    }
  }

  const handleCreateLocality = async () => {
    if (!newLocName.trim() || !newLocSector || !manageModal) {
      toast('Preencha o nome e o setor para criar a localidade', 'warning')
      return
    }
    
    const locName = newLocName.trim()
    
    const newLocObj = {
      id: `loc_${Date.now()}`,
      nome: locName,
      setor: newLocSector,
      equipe_id: manageModal.id,
      dias_operacionais: newLocSchedule
    }
    
    const updatedLocalidades = [...allLocalidades, newLocObj]
    
    try {
      await updateConfig.mutateAsync({ chave: 'localidades', valor: updatedLocalidades })
      
      setNewLocName('')
      setNewLocSector('')
      setNewLocSchedule('segunda_sabado')
      toast(`Localidade "${locName}" criada e vinculada com sucesso!`, 'success')
    } catch (err: any) {
      toast('Erro ao criar localidade: ' + err.message, 'error')
    }
  }

  if (isLoadingEquipes || isLoadingRegioes || isLoadingUserTeam) return <Loading text="Carregando dados..." />

  // Available members for the managed team (not assigned or in THIS team)
  const availableMembers = manageModal
    ? funcionarios.filter(f => f.cargo !== 'Encarregado' && !manageModal.membros.some(m => m.id === f.id) && !assignedMemberIds.has(f.id))
        .filter(f => !memSearch || f.nome.toLowerCase().includes(memSearch.toLowerCase()) || (f.apelido || '').toLowerCase().includes(memSearch.toLowerCase()))
    : []

  const availableEncarregados = manageModal
    ? profilesList.filter(p => !manageModal.encarregados.some(enc => enc.id === p.id))
        .filter(p => !memSearch || p.nome.toLowerCase().includes(memSearch.toLowerCase()))
    : []

  // Setores/localidades for the managed team
  const teamSetores = manageModal ? (setoresEquipes[manageModal.id] || []) : []
  const teamLocalidades = manageModal ? allLocalidades.filter((l: any) => l.equipe_id === manageModal.id) : []
  const sectorsForDropdown = teamSetores.length > 0 ? teamSetores : allSetores

  return (
    <div className="space-y-6 animate-fade-in pb-32">
      <TopHeader title={isEncarregadoOnly ? 'Minha Equipe' : 'Equipes e Regiões'} subtitle={isEncarregadoOnly ? 'Gerencie os membros da sua equipe' : 'Gerenciamento operacional de equipes'} />

      {/* Tab Switcher - only for admins */}
      {!isEncarregadoOnly && (
        <div className="px-4">
          <div className="flex bg-muted/30 p-1.5 rounded-[1.75rem] border border-border/50 w-full max-w-md">
            <button onClick={() => setActiveTab('equipes')}
              className={cn("flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === 'equipes' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              )}>
              Equipes ({equipes.length})
            </button>
            <button onClick={() => setActiveTab('regioes')}
              className={cn("flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === 'regioes' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              )}>
              Regiões ({regioes.length})
            </button>
          </div>
        </div>
      )}

      {activeTab === 'equipes' ? (
        <>
          {/* Toolbar Equipes */}
          <div className="px-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar equipe..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none" />
            </div>
            {canAdmin && (
              <div className="flex gap-2">
                <Button onClick={handleSyncAll} loading={syncing}
                  className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/20">
                  Sincronizar
                </Button>
                <Button onClick={() => { setForm({ nome: '', descricao: '', cor: COLORS[0], regiao_id: '' }); setCreateModal(true) }}
                  className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Nova Equipe
                </Button>
              </div>
            )}
          </div>

          {/* Grid Equipes */}
          <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(eq => {
              const regiao = regioes.find(r => r.id === eq.regiao_id)
              return (
                <div key={eq.id} className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-lg" style={{ backgroundColor: eq.cor }}>
                      {eq.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-foreground truncate">{eq.nome}</h3>
                        {regiao && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: regiao.cor }}>
                            {regiao.nome}
                          </span>
                        )}
                      </div>
                      {eq.descricao && <p className="text-[10px] text-muted-foreground truncate">{eq.descricao}</p>}
                    </div>
                    {canAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => { setForm({ nome: eq.nome || '', descricao: eq.descricao || '', cor: eq.cor || COLORS[0], regiao_id: eq.regiao_id || '' }); setEditModal(eq) }}
                          className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all" title="Editar equipe">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm('Excluir equipe?')) deleteMut.mutate(eq.id) }}
                          className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all" title="Excluir equipe">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Encarregados badges */}
                  <div className="mb-3">
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Encarregados</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {eq.encarregados.length === 0 && <span className="text-[10px] text-muted-foreground/50 italic">Nenhum</span>}
                      {eq.encarregados.map(enc => (
                        <span key={enc.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" style={{ borderColor: eq.cor + '40', color: eq.cor, backgroundColor: eq.cor + '10' }}>
                          <Shield className="w-3 h-3" /> {enc.nome.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">{eq.membros.length} membros</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">{(setoresEquipes[eq.id] || []).length} setores</span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full">
                    {canManageTeam(eq.id) && (
                      <Button onClick={() => { setSelectedEquipeId(eq.id); setTab('membros'); setMemSearch('') }}
                        className="flex-1 h-10 rounded-xl bg-primary/10 text-primary font-black text-[11px] uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center justify-center">
                        <UserCheck className="w-3.5 h-3.5 mr-1.5" /> {isEncarregadoOnly ? "Membros" : "Gerenciar"}
                      </Button>
                    )}
                    <Link
                      to={`/escala/mapeamento?equipeId=${eq.id}`}
                      className="flex-1 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black text-[11px] uppercase tracking-wider hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Route className="w-3.5 h-3.5" /> Varrição
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <Users className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma equipe encontrada</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Toolbar Regiões */}
          <div className="px-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar região..." value={searchRegiao} onChange={e => setSearchRegiao(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none" />
            </div>
            {canEdit && (
              <Button onClick={() => { setRegiaoForm({ nome: '', descricao: '', cor: COLORS[0] }); setCreateRegiaoModal(true) }}
                className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Nova Região
              </Button>
            )}
          </div>

          {/* Grid Regiões */}
          <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRegioes.map(reg => {
              const equipesNaRegiao = equipes.filter(e => e.regiao_id === reg.id)
              return (
                <div key={reg.id} className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-lg" style={{ backgroundColor: reg.cor }}>
                      R
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black text-foreground truncate">{reg.nome}</h3>
                      {reg.descricao && <p className="text-[10px] text-muted-foreground truncate">{reg.descricao}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => { setRegiaoForm({ nome: reg.nome, descricao: reg.descricao || '', cor: reg.cor }); setEditRegiao(reg) }}
                          className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canAdmin && (
                          <button onClick={() => { if (confirm('Excluir esta região? As equipes desta região ficarão sem região.')) deleteRegiaoMut.mutate(reg.id) }}
                            className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Equipes list */}
                  <div className="mb-2">
                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Equipes Alocadas ({equipesNaRegiao.length})</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {equipesNaRegiao.length === 0 && <span className="text-[10px] text-muted-foreground/50 italic">Nenhuma equipe alocada</span>}
                      {equipesNaRegiao.map(eq => (
                        <span key={eq.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border" style={{ borderColor: eq.cor + '40', color: eq.cor, backgroundColor: eq.cor + '10' }}>
                          {eq.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredRegioes.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <MapPin className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma região encontrada</p>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Equipe Modal */}
      <Modal open={createModal || !!editModal} onClose={() => { setCreateModal(false); setEditModal(null) }} title={editModal ? 'Editar Equipe' : 'Nova Equipe'}>
        <form onSubmit={e => { e.preventDefault(); editModal ? updateMut.mutate() : createMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome *</label>
            <input value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Nome da equipe" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Descrição</label>
            <input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Descrição opcional" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Região</label>
            <select value={form.regiao_id || ''} onChange={e => setForm(f => ({ ...f, regiao_id: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30">
              <option value="">Nenhuma região</option>
              {regioes.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, cor: c }))}
                  className={cn("w-8 h-8 rounded-xl transition-all", (form.cor || COLORS[0]) === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setCreateModal(false); setEditModal(null) }} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">
              {editModal ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create/Edit Região Modal */}
      <Modal open={createRegiaoModal || !!editRegiao} onClose={() => { setCreateRegiaoModal(false); setEditRegiao(null) }} title={editRegiao ? 'Editar Região' : 'Nova Região'}>
        <form onSubmit={e => { e.preventDefault(); editRegiao ? updateRegiaoMut.mutate() : createRegiaoMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome da Região *</label>
            <input value={regiaoForm.nome} onChange={e => setRegiaoForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Ex: Região Norte" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Descrição</label>
            <input value={regiaoForm.descricao} onChange={e => setRegiaoForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Ex: Divisão territorial norte" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setRegiaoForm(f => ({ ...f, cor: c }))}
                  className={cn("w-8 h-8 rounded-xl transition-all", regiaoForm.cor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setCreateRegiaoModal(false); setEditRegiao(null) }} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createRegiaoMut.isPending || updateRegiaoMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">
              {editRegiao ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Team Modal */}
      {manageModal && (
        <Modal 
          open={!!manageModal} 
          onClose={() => setSelectedEquipeId(null)} 
          title={isEncarregado ? `Gerenciar Equipe: ${manageModal.nome || ''}` : `Gerenciar Equipe: ${manageModal.nome || ''}`}
          size="lg"
          className="sm:max-w-4xl"
        >
          <div className="space-y-5">
            {/* Tabs */}
            <div className={cn("grid gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/30", isEncarregadoOnly ? "grid-cols-3" : "grid-cols-4")}>
              {(isEncarregadoOnly 
                ? (['membros', 'setores', 'localidades'] as const)
                : (['membros', 'encarregados', 'setores', 'localidades'] as const)
              ).map(t => {
                const labels = { membros: 'Membros', encarregados: 'Encarregados', setores: 'Setores', localidades: 'Localidades' }
                const counts = {
                  membros: manageModal.membros.length || 0,
                  encarregados: manageModal.encarregados.length || 0,
                  setores: teamSetores.length,
                  localidades: teamLocalidades.length,
                }
                return (
                  <button 
                    key={t} 
                    onClick={() => { setTab(t); setMemSearch('') }}
                    className={cn("py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      tab === t ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30')}
                  >
                    {labels[t]} ({counts[t]})
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {tab === 'membros' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[480px]">
                {/* Left: Membros Atuais */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-3">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" /> Membros Atuais ({manageModal.membros.length || 0})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {manageModal.membros.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                            {m.nome.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{m.apelido?.trim() ? m.apelido : m.nome}</p>
                            {m.apelido?.trim() && m.apelido.trim().toLowerCase() !== m.nome.trim().toLowerCase() && (
                              <p className="text-[9.5px] font-medium text-muted-foreground/80 leading-tight uppercase">{m.nome}</p>
                            )}
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">{m.cargo || 'Funcionário'}</p>
                          </div>
                        </div>
                        {canManageTeam(manageModal.id) && (
                          <button 
                            onClick={() => removeMembro.mutate({ equipeId: manageModal.id, funcId: m.id })}
                            disabled={removeMembro.isPending}
                            className="w-7 h-7 rounded-lg text-rose-500 hover:text-white bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Remover da equipe"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(!manageModal.membros || manageModal.membros.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhum membro nesta equipe
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Adicionar Novos Membros */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  <div className="pb-3 border-b border-border/40 mb-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Adicionar Colaboradores
                    </span>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input 
                        type="text" 
                        placeholder="Buscar por nome ou apelido..." 
                        value={memSearch} 
                        onChange={e => setMemSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30" 
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {availableMembers.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-black text-muted-foreground">
                            {f.nome.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{f.nome}</p>
                            {f.apelido && <p className="text-[10px] text-primary font-bold">Apelido: {f.apelido}</p>}
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">{f.cargo || 'Funcionário'}</p>
                          </div>
                        </div>
                        {canManageTeam(manageModal.id) && (
                          <button 
                            onClick={() => addMembro.mutate({ equipeId: manageModal.id, funcId: f.id })}
                            disabled={addMembro.isPending}
                            className="w-7 h-7 rounded-lg text-emerald-600 hover:text-white bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/10 hover:border-emerald-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Adicionar à equipe"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {availableMembers.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhum colaborador disponível
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'encarregados' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[480px]">
                {/* Left: Encarregados Atuais */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-3">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-primary" /> Encarregados Atuais ({manageModal.encarregados.length || 0})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {manageModal.encarregados.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                            {e.nome.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{e.nome}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Encarregado</p>
                          </div>
                        </div>
                        {canAdmin && (
                          <button 
                            onClick={() => removeEncarregado.mutate({ equipeId: manageModal.id, userId: e.id })}
                            disabled={removeEncarregado.isPending}
                            className="w-7 h-7 rounded-lg text-rose-500 hover:text-white bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Remover encarregado"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(!manageModal.encarregados || manageModal.encarregados.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhum encarregado vinculado
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Adicionar Novo Encarregado */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  <div className="pb-3 border-b border-border/40 mb-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-500" /> Vincular Novo Encarregado
                    </span>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input 
                        type="text" 
                        placeholder="Buscar usuário..." 
                        value={memSearch} 
                        onChange={e => setMemSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30" 
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {availableEncarregados.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-black text-muted-foreground">
                            {p.nome.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{p.nome}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Perfil de Usuário</p>
                          </div>
                        </div>
                        {canManageTeam(manageModal.id) && !isEncarregadoOnly && (
                          <button 
                            onClick={() => addEncarregado.mutate({ equipeId: manageModal.id, userId: p.id })}
                            disabled={addEncarregado.isPending}
                            className="w-7 h-7 rounded-lg text-emerald-600 hover:text-white bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/10 hover:border-emerald-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Vincular como encarregado"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {availableEncarregados.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhum encarregado disponível
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'setores' && (
              <div className="border border-border/50 rounded-2xl bg-muted/10 p-5 h-[480px] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-3">
                  <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-primary" /> Setores Operacionais
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{teamSetores.length} vinculados</span>
                </div>

                {canManageTeam(manageModal.id) && (
                  <div className="flex gap-2 mb-4 p-3 bg-card border border-border/30 rounded-xl">
                    <input
                      type="text"
                      placeholder="Nome do novo setor..."
                      value={newSectorName}
                      onChange={e => setNewSectorName(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-lg text-xs font-bold outline-none focus:border-primary/30"
                    />
                    <button
                      onClick={handleCreateSector}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm border border-transparent"
                    >
                      Criar e Vincular
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1 scrollbar-thin">
                  {allSetores.map((s: string) => {
                    const isLinked = teamSetores.includes(s)
                    return (
                      <div key={s} className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 shadow-sm",
                        isLinked 
                          ? "bg-card border-primary/20 hover:border-primary/45" 
                          : "bg-card/60 border-border/40 hover:bg-card hover:border-border"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                            isLinked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            <LayoutGrid className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-foreground">{s}</span>
                        </div>
                        {canManageTeam(manageModal.id) ? (
                          <button 
                            onClick={() => {
                              const current = setoresEquipes[manageModal.id] || []
                              const newList = isLinked ? current.filter((x: string) => x !== s) : [...current, s]
                              updateConfig.mutate({ chave: 'setores_equipes', valor: { ...setoresEquipes, [manageModal.id]: newList } })
                              toast(isLinked ? `Setor "${s}" desvinculado` : `Setor "${s}" vinculado`, 'success')
                            }}
                            className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm border",
                              isLinked 
                                ? "bg-primary/5 hover:bg-primary text-primary hover:text-white border-primary/20 hover:border-primary" 
                                : "bg-muted hover:bg-muted/70 text-muted-foreground border-transparent")}
                          >
                            {isLinked ? 'Vinculado ✓' : 'Vincular'}
                          </button>
                        ) : (
                          <span className={cn("text-[10px] font-black uppercase tracking-wider", isLinked ? "text-primary" : "text-muted-foreground/30")}>
                            {isLinked ? '✓ Ativo' : '—'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {!allSetores.length && (
                    <div className="col-span-full flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                      Nenhum setor cadastrado. Crie um acima!
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'localidades' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[480px]">
                {/* Left: Localidades Vinculadas */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-3">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> Localidades Vinculadas ({teamLocalidades.length || 0})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {teamLocalidades.map((l: any) => (
                      <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground truncate">{l.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">{l.setor}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 border-border/20 pt-2 sm:pt-0 mt-1 sm:mt-0">
                          {/* Schedule Selector */}
                          <select
                            value={l.dias_operacionais || 'segunda_sabado'}
                            onChange={(e) => {
                              const val = e.target.value
                              const newList = allLocalidades.map((x: any) => x.id === l.id ? { ...x, dias_operacionais: val } : x)
                              updateConfig.mutate({ chave: 'localidades', valor: newList })
                              toast(`Dias operacionais de "${l.nome}" alterados!`, 'success')
                            }}
                            disabled={!canManageTeam(manageModal.id) || updateConfig.isPending}
                            className="text-[9px] font-black uppercase tracking-wider bg-muted/40 border border-border/40 rounded-lg px-2 py-1 outline-none text-foreground cursor-pointer focus:border-primary/40"
                          >
                            <option value="segunda_sabado">📅 Seg a Sáb</option>
                            <option value="domingo_feriado">☀️ Dom & Feriado</option>
                            <option value="todos">🌐 Todos os Dias</option>
                          </select>

                          {canManageTeam(manageModal.id) && (
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => {
                                  const newList = allLocalidades.map((x: any) => x.id === l.id ? { ...x, equipe_id: null } : x)
                                  updateConfig.mutate({ chave: 'localidades', valor: newList })
                                  toast(`Localidade "${l.nome}" desvinculada`, 'success')
                                }}
                                disabled={updateConfig.isPending}
                                className="w-7 h-7 rounded-lg text-rose-500 hover:text-white bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Desvincular da equipe"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm(`Deseja realmente excluir permanentemente a localidade "${l.nome}"?`)) {
                                    const newList = allLocalidades.filter((x: any) => x.id !== l.id)
                                    updateConfig.mutate({ chave: 'localidades', valor: newList })
                                    toast(`Localidade "${l.nome}" excluída permanentemente`, 'success')
                                  }
                                }}
                                disabled={updateConfig.isPending}
                                className="w-7 h-7 rounded-lg text-red-600 hover:text-white bg-red-600/5 hover:bg-red-600 border border-red-600/10 hover:border-red-600 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                                title="Excluir permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!teamLocalidades || teamLocalidades.length === 0) && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhuma localidade vinculada
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Vincular/Criar Localidade */}
                <div className="flex flex-col h-full border border-border/50 rounded-2xl bg-muted/10 p-4">
                  {canManageTeam(manageModal.id) && (
                    <div className="pb-4 border-b border-border/40 mb-4 space-y-2">
                      <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-primary" /> Criar Nova Localidade
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Nome..."
                          value={newLocName}
                          onChange={e => setNewLocName(e.target.value)}
                          className="px-3 py-1.5 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30"
                        />
                        <select
                          value={newLocSector}
                          onChange={e => setNewLocSector(e.target.value)}
                          className="px-2 py-1.5 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30"
                        >
                          <option value="">Setor...</option>
                          {sectorsForDropdown.map((s: string) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <select
                          value={newLocSchedule}
                          onChange={e => setNewLocSchedule(e.target.value as any)}
                          className="px-2 py-1.5 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30"
                        >
                          <option value="segunda_sabado">📅 Seg a Sáb</option>
                          <option value="domingo_feriado">☀️ Dom & Feriado</option>
                          <option value="todos">🌐 Todos os Dias</option>
                        </select>
                      </div>
                      <button
                        onClick={handleCreateLocality}
                        className="w-full py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm border border-transparent"
                      >
                        Criar e Vincular Localidade
                      </button>
                    </div>
                  )}

                  <div className="pb-3 border-b border-border/40 mb-3 space-y-2">
                    <span className="text-[10px] font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Vincular Existente
                    </span>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <input 
                        type="text" 
                        placeholder="Buscar localidade..." 
                        value={memSearch} 
                        onChange={e => setMemSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border/50 rounded-xl text-xs font-bold outline-none focus:border-primary/30" 
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {allLocalidades.filter((l: any) => l.equipe_id !== manageModal.id && (!memSearch || l.nome.toLowerCase().includes(memSearch.toLowerCase()))).map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between p-3 bg-card border border-border/40 hover:border-border rounded-xl transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{l.nome}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">{l.setor}</p>
                          </div>
                        </div>
                        {canManageTeam(manageModal.id) && (
                          <button 
                            onClick={() => {
                              const newList = allLocalidades.map((x: any) => x.id === l.id ? { ...x, equipe_id: manageModal.id } : x)
                              updateConfig.mutate({ chave: 'localidades', valor: newList })
                              toast(`Localidade "${l.nome}" vinculada`, 'success')
                            }}
                            disabled={updateConfig.isPending}
                            className="w-7 h-7 rounded-lg text-emerald-600 hover:text-white bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/10 hover:border-emerald-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            title="Vincular à equipe"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!allLocalidades.filter((l: any) => l.equipe_id !== manageModal.id).length && (
                      <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border/40 rounded-xl py-6 text-muted-foreground/40 font-black text-[10px] uppercase tracking-widest bg-muted/5">
                        Nenhuma localidade disponível
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  )
}
