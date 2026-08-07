import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, Plus, Trash2, Save, Play, Search, X, Check, Users, ChevronLeft, RotateCcw, Sparkles, Activity, Cpu, Layers, Target, MessageSquare, Copy } from 'lucide-react'
import { useModelosEscala, useSalvarModelosEscala, type ModeloEscala, type ModeloEscalaFuncionario } from '../hooks/useModelosEscala'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { Loading } from '../components/ui/Loading'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useUserTeam } from '../hooks/useUserTeam'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'

const DIAS_COMPENSADO = [
  { value: 'quinta', label: 'Quinta-feira', offset: -3 },
  { value: 'sexta', label: 'Sexta-feira', offset: -2 },
  { value: 'sabado', label: 'Sábado', offset: -1 },
] as const

const DIAS_REPOUSO = [
  { value: 'segunda', label: 'Segunda-feira', offset: 1 },
  { value: 'terca', label: 'Terça-feira', offset: 2 },
  { value: 'quarta', label: 'Quarta-feira', offset: 3 },
] as const

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getDayOffset(dia: string): number {
  const comp = DIAS_COMPENSADO.find(d => d.value === dia)
  if (comp) return comp.offset
  const rep = DIAS_REPOUSO.find(d => d.value === dia)
  if (rep) return rep.offset
  return 0
}

function labelDia(dia: string): string {
  const map: Record<string, string> = {
    segunda: 'Seg',
    terca: 'Ter',
    quarta: 'Qua',
    quinta: 'Qui',
    sexta: 'Sex',
    sabado: 'Sáb',
  }
  return map[dia] || dia
}



function isProtectedScaleType(tipo: string | null | undefined): boolean {
  if (!tipo) return false
  const t = tipo.toLowerCase()
  return t === 'ferias' || t.includes('atestado') || t.includes('afastamento') || t === 'falta' || t.includes('abonad')
}

export function ModelosEscalaPage() {
  const { data: modelosData, isLoading } = useModelosEscala()
  const { mutateAsync: salvarModelos } = useSalvarModelosEscala()
  const { data: funcionariosOrig } = useFuncionarios()
  const { data: teamInfo, isLoading: isLoadingTeam } = useUserTeam()
  const { mutateAsync: batchUpsert } = useBatchUpsertEscalas()

  // Load all teams to map them to scale models
  const { data: equipesList = [] } = useQuery<any[]>({
    queryKey: ['equipes'],
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, profiles(id, nome)')
      const { data: mem } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, apelido, cargo)')
      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.profiles || (e as any).profile || (e as any).funcionarios).filter(Boolean),
        membros: (mem || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionarios).filter(Boolean),
      }))
    }
  })

  const getModelTeam = useCallback((modelo: ModeloEscala, equipes: any[]) => {
    if (modelo.equipe_id) {
      const eq = equipes.find(e => e.id === modelo.equipe_id)
      if (eq) return eq
    }
    if (modelo.funcionarios && modelo.funcionarios.length > 0) {
      const firstFuncId = modelo.funcionarios[0].funcionario_id
      const eq = equipes.find(e => (e.membros || []).some((m: any) => m.id === firstFuncId))
      if (eq) return eq
    }
    return null
  }, [])

  const funcionarios = useMemo(() => {
    let list = funcionariosOrig || []
    if (teamInfo?.isRestricted) {
      list = list.filter(f => teamInfo.teamMemberIds.includes(f.id))
    }
    return list
  }, [funcionariosOrig, teamInfo])

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')

  const filteredModelos = useMemo(() => {
    let list = modelosData ?? []
    if (teamInfo?.isRestricted) {
      const allowedTeamIds = teamInfo.teamIds || []
      if (allowedTeamIds.length === 0) return []
      list = list.filter(m => {
        const inferredId = getModelTeam(m, equipesList)?.id
        return (m.equipe_id && allowedTeamIds.includes(m.equipe_id)) || (inferredId && allowedTeamIds.includes(inferredId))
      })
    } else if (selectedTeamId !== 'all') {
      list = list.filter(m => m.equipe_id === selectedTeamId || getModelTeam(m, equipesList)?.id === selectedTeamId)
    }
    return list
  }, [modelosData, teamInfo, selectedTeamId, equipesList, getModelTeam])

  const modelos = filteredModelos

  const [editando, setEditando] = useState<ModeloEscala | null>(null)
  const [modeloParaAplicar, setModeloParaAplicar] = useState<ModeloEscala | null>(null)
  const [showAddFunc, setShowAddFunc] = useState(false)
  const [showAplicar, setShowAplicar] = useState(false)
  const [aplicarData, setAplicarData] = useState('')
  const [saving, setSaving] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [desaplicando, setDesaplicando] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const [modelosAplicados, setModelosAplicados] = useState<Record<string, { modeloId: string; nome: string }>>({})
  const [historicoMonth, setHistoricoMonth] = useState<Date>(new Date())
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [appliedTypeFilter, setAppliedTypeFilter] = useState<'all' | 'dominical' | 'feriado'>('all')
  const [expandedAppliedDate, setExpandedAppliedDate] = useState<string | null>(null)

  const [previewModelo, setPreviewModelo] = useState<{ modelo: ModeloEscala; dateStr?: string } | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewMode, setPreviewMode] = useState<'completo' | 'enxuto'>('completo')
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Load global fixed days off configuration
  const { data: folgasFuncionarios = {} } = useConfiguracao<Record<string, { diaCompensado: string | null; diaRepouso: string | null; turno: string | null }>>('folgas_funcionarios', {})
  const { mutateAsync: updateConfig } = useUpdateConfiguracao()

  // State for active tab: 'modelos' or 'folgas'
  const [activeTab, setActiveTab] = useState<'modelos' | 'folgas'>('modelos')

  // Search filter for the fixed days off tab
  const [folgasSearchTerm, setFolgasSearchTerm] = useState('')

  // Search filter for available members in model editor sidebar
  const [searchDisponivel, setSearchDisponivel] = useState('')

  // Stats of fixed days off for the "Folgas Fixas" tab dashboard
  const folgaStats = useMemo(() => {
    let semFolga = 0
    const countPorDia: Record<string, number> = {
      segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0, sabado: 0
    }
    const ativos = funcionarios.filter(f => f.status === 'ativo')
    ativos.forEach(f => {
      const config = folgasFuncionarios[f.id]
      if (!config || (!config.diaCompensado && !config.diaRepouso)) {
        semFolga++
      } else {
        if (config.diaCompensado) countPorDia[config.diaCompensado] = (countPorDia[config.diaCompensado] || 0) + 1
        if (config.diaRepouso) countPorDia[config.diaRepouso] = (countPorDia[config.diaRepouso] || 0) + 1
      }
    })
    return {
      totalAtivos: ativos.length,
      semFolga,
      countPorDia
    }
  }, [funcionarios, folgasFuncionarios])

  const updateFixedFolga = async (funcionarioId: string, updates: { diaCompensado?: string | null; diaRepouso?: string | null; turno?: string | null }) => {
    try {
      const current = folgasFuncionarios[funcionarioId] || { diaCompensado: 'quinta', diaRepouso: 'segunda', turno: 'integral' }
      const updated = {
        ...folgasFuncionarios,
        [funcionarioId]: {
          ...current,
          ...updates
        }
      }
      await updateConfig({ chave: 'folgas_funcionarios', valor: updated })
      showMsg('Folga fixa atualizada!')
    } catch (err) {
      showMsg('Erro ao atualizar folga fixa', 'error')
    }
  }

  useEffect(() => {
    async function loadModelosAplicados() {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'modelos_aplicados')
          .single()
        if (data?.valor) {
          setModelosAplicados(data.valor as Record<string, { modeloId: string; nome: string }>)
        }
      } catch (err) {
        console.error('Erro ao carregar modelos aplicados:', err)
      }
    }
    loadModelosAplicados()
  }, [])

  async function removerModeloAplicado(dataDomingo: string, modeloId: string) {
    const modelo = modelos.find(m => m.id === modeloId)
    if (!modelo) {
      showMsg('Modelo não encontrado para remoção', 'error')
      return
    }

    const isFeriado = modelo.tipo === 'feriado'
    const confirmMsg = isFeriado
      ? `Deseja remover a aplicação do modelo "${modelo.nome}" na data ${format(new Date(dataDomingo + 'T12:00:00'), 'dd/MM/yyyy')}? Esta ação removerá a escala de trabalho dos funcionários.`
      : `Deseja remover o modelo "${modelo.nome}" aplicado no domingo ${format(new Date(dataDomingo + 'T12:00:00'), 'dd/MM/yyyy')}? Esta ação reverterá as folgas e o domingo de trabalho dos funcionários deste modelo.`

    if (!confirm(confirmMsg)) {
      return
    }

    setDesaplicando(true)
    try {
      const domingoDate = new Date(dataDomingo + 'T12:00:00')
      const entries: any[] = []

      // Fetch team members if it's a holiday
      let teamEmployeeIds: string[] = []
      const equipeId = modelo.equipe_id || (teamInfo?.isRestricted ? teamInfo.teamIds?.[0] : null)
      if (equipeId) {
        const { data: mems } = await supabase
          .from('equipe_membros')
          .select('funcionario_id')
          .eq('equipe_id', equipeId)
        if (mems) {
          teamEmployeeIds = mems.map((m: any) => m.funcionario_id)
        }
      }

      const allTargetFuncIds = Array.from(new Set([
        ...modelo.funcionarios.map(f => f.funcionario_id),
        ...teamEmployeeIds
      ]))

      // 1. Collect all dates to query existing scales
      const datesToQuerySet = new Set<string>()
      datesToQuerySet.add(dataDomingo)

      if (!isFeriado) {
        for (const f of modelo.funcionarios) {
          const folga = folgasFuncionarios[f.funcionario_id] || {}
          const diaCompensado = modelo.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
          const diaRepouso = modelo.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso

          if (diaCompensado) {
            const offset = getDayOffset(diaCompensado)
            datesToQuerySet.add(format(addDays(domingoDate, offset), 'yyyy-MM-dd'))
          }
          if (diaRepouso) {
            const offset = getDayOffset(diaRepouso)
            datesToQuerySet.add(format(addDays(domingoDate, offset), 'yyyy-MM-dd'))
          }
        }
      }

      // 2. Fetch existing scales for protected items check
      const { data: existingEscalas } = await supabase
        .from('escalas')
        .select('*')
        .in('funcionario_id', allTargetFuncIds)
        .in('data', Array.from(datesToQuerySet))

      const hasProtectedEntry = (funcId: string, dateStr: string): boolean => {
        const existing = (existingEscalas || []).find(e =>
          e.funcionario_id === funcId &&
          e.data.substring(0, 10) === dateStr
        )
        return existing ? isProtectedScaleType(existing.tipo) : false
      }

      if (isFeriado) {
        // Delete holiday entries for all team members (unless protected/confirmed)
        const deleteFuncIds = allTargetFuncIds.filter(id => !hasProtectedEntry(id, dataDomingo))
        if (deleteFuncIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('escalas')
            .delete()
            .in('funcionario_id', deleteFuncIds)
            .eq('data', dataDomingo)
          if (deleteError) throw deleteError
        }
      } else {
        for (const f of modelo.funcionarios) {
          const folga = folgasFuncionarios[f.funcionario_id] || {}
          const diaCompensado = modelo.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
          const diaRepouso = modelo.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso
          const turno = folga.turno !== undefined ? folga.turno : f.turno

          // 1. Sunday/Holiday becomes 'repouso'
          if (!hasProtectedEntry(f.funcionario_id, dataDomingo)) {
            entries.push({
              funcionario_id: f.funcionario_id,
              data: dataDomingo,
              tipo: 'repouso',
              turno: undefined,
            })
          }

          // 2. Compensado becomes 'presente' (Trabalho)
          if (diaCompensado) {
            const offset = getDayOffset(diaCompensado)
            const compDate = addDays(domingoDate, offset)
            const dStr = format(compDate, 'yyyy-MM-dd')
            if (!hasProtectedEntry(f.funcionario_id, dStr)) {
              entries.push({
                funcionario_id: f.funcionario_id,
                data: dStr,
                tipo: 'presente',
                turno: turno || undefined,
              })
            }
          }

          // 3. Repouso becomes 'presente' (Trabalho)
          if (diaRepouso) {
            const offset = getDayOffset(diaRepouso)
            const repDate = addDays(domingoDate, offset)
            const dStr = format(repDate, 'yyyy-MM-dd')
            if (!hasProtectedEntry(f.funcionario_id, dStr)) {
              entries.push({
                funcionario_id: f.funcionario_id,
                data: dStr,
                tipo: 'presente',
                turno: turno || undefined,
              })
            }
          }
        }

        // Upsert the inverted scales!
        await batchUpsert(entries)
      }

      // Remove from modelos_aplicados in configuracoes
      const updated = { ...modelosAplicados }
      delete updated[dataDomingo]

      await supabase
        .from('configuracoes')
        .upsert(
          { chave: 'modelos_aplicados', valor: updated, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )

      setModelosAplicados(updated)
      showMsg(`Modelo "${modelo.nome}" removido com sucesso!`)
    } catch (err) {
      showMsg('Erro ao remover aplicação do modelo', 'error')
    } finally {
      setDesaplicando(false)
    }
  }

  const lastHistory = useMemo(() => {
    try {
      const stored = localStorage.getItem('historico_aplicacao_modelo')
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (teamInfo?.isRestricted && parsed?.modeloId) {
        const hasModel = modelos.some(m => m.id === parsed.modeloId)
        if (!hasModel) return null
      }
      return parsed
    } catch {
      return null
    }
  }, [aplicando, desaplicando, msg, teamInfo, modelos])

  const funcionarioMap = new Map(funcionarios?.map(f => [f.id, f]) ?? [])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }

  async function desaplicarModelo() {
    const history = lastHistory
    if (!history) return

    if (!confirm(`Deseja desfazer a aplicação do modelo "${history.modeloNome}" no domingo ${history.domingoFormatado}? Todas as alterações de escala para este período serão revertidas.`)) {
      return
    }

    setDesaplicando(true)
    try {
      // 1. Delete all current scales for these employees and dates
      const { error: deleteError } = await supabase
        .from('escalas')
        .delete()
        .in('funcionario_id', history.funcionariosIds)
        .in('data', history.dates)

      if (deleteError) throw deleteError

      // 2. Restore the previous scales if there were any
      if (history.existingEscalas && history.existingEscalas.length > 0) {
        const payloads = history.existingEscalas.map((e: any) => ({
          funcionario_id: e.funcionario_id,
          data: e.data.substring(0, 10),
          tipo: e.tipo,
          turno: e.turno,
          localidade: e.localidade,
          observacoes: e.observacoes
        }))

        await batchUpsert(payloads)
      }

      localStorage.removeItem('historico_aplicacao_modelo')
      showMsg('Aplicação de modelo revertida com sucesso!', 'success')
    } catch (err) {
      showMsg('Erro ao desfazer aplicação', 'error')
    } finally {
      setDesaplicando(false)
    }
  }

  function criarNovo() {
    setEditando({
      id: generateId(),
      nome: '',
      descricao: '',
      funcionarios: [],
      created_at: new Date().toISOString(),
      equipe_id: teamInfo?.isRestricted ? teamInfo.teamIds?.[0] : undefined,
      tipo: 'dominical'
    })
  }

  async function salvar() {
    if (!editando || !editando.nome.trim()) return
    setSaving(true)

    const sanitizedFuncionarios = editando.funcionarios.map(f => ({
      funcionario_id: f.funcionario_id,
      nome: f.nome,
      tipo: f.tipo || 'presente',
      turno: null,
      diaCompensado: editando.personalizarFolgas ? (f.diaCompensado || null) : null,
      diaRepouso: editando.personalizarFolgas ? (f.diaRepouso || null) : null,
    }))

    let modelToSave = {
      ...editando,
      tipo: editando.tipo || 'dominical',
      funcionarios: sanitizedFuncionarios
    }
    if (teamInfo?.isRestricted && teamInfo.teamIds && teamInfo.teamIds.length > 0) {
      modelToSave.equipe_id = teamInfo.teamIds[0]
    } else if (!modelToSave.equipe_id && equipesList && equipesList.length > 0) {
      const inferredTeam = getModelTeam(modelToSave, equipesList)
      if (inferredTeam) {
        modelToSave.equipe_id = inferredTeam.id
      }
    }

    const currentDbList = modelosData ?? []
    const idx = currentDbList.findIndex(m => m.id === editando.id)
    const novaLista = [...currentDbList]
    if (idx >= 0) novaLista[idx] = modelToSave
    else novaLista.push(modelToSave)

    try {
      await salvarModelos(novaLista)
      showMsg('Modelo salvo com sucesso!')
      setEditando(null)
    } catch {
      showMsg('Erro ao salvar', 'error')
    }
    setSaving(false)
  }

  async function deletar(id: string) {
    if (!confirm('Deseja excluir este modelo?')) return
    const currentDbList = modelosData ?? []
    const novaLista = currentDbList.filter(m => m.id !== id)
    try {
      await salvarModelos(novaLista)
      if (editando?.id === id) setEditando(null)
      showMsg('Modelo removido')
    } catch {
      showMsg('Erro ao excluir', 'error')
    }
  }

  const fetchLocationsForDate = async (modelo: ModeloEscala, dateStr?: string) => {
    if (!dateStr) return []
    try {
      const funcIds = modelo.funcionarios.map(f => f.funcionario_id)
      if (funcIds.length === 0) return []
      
      const { data, error } = await supabase
        .from('escalas')
        .select('localidade')
        .in('funcionario_id', funcIds)
        .eq('data', dateStr)
      
      if (error) throw error
      const uniqueLocs = Array.from(new Set((data || []).map((d: any) => d.localidade).filter(Boolean))) as string[]
      return uniqueLocs
    } catch (err) {
      console.error('Erro ao buscar localidades:', err)
      return []
    }
  }

  const getMessageText = useCallback((modelo: ModeloEscala, dateStr?: string, mode: 'completo' | 'enxuto' = 'completo', locations: string[] = []) => {
    const modelTeam = getModelTeam(modelo, equipesList)
    const teamName = modelTeam?.nome || 'Geral / Não definida'
    const leaders = modelTeam?.encarregados?.map((e: any) => e.nome).join(', ') || 'Não definido'
    const isFeriado = modelo.tipo === 'feriado'

    let dateText = 'Padrão do Modelo'
    if (dateStr) {
      try {
        const dateObj = new Date(dateStr + 'T12:00:00')
        const formattedDate = format(dateObj, "dd/MM/yyyy")
        const weekDayLabel = format(dateObj, "eeee", { locale: ptBR })
        dateText = `${formattedDate} (${weekDayLabel})`
      } catch {
        dateText = dateStr
      }
    }

    if (mode === 'enxuto') {
      let text = `🚀 *ROTEIRO OPERACIONAL (RESUMIDO)* 🚀\n\n`
      text += `📅 *Data:* ${dateText}\n`
      text += `👥 *Equipe:* ${teamName}\n`
      text += `👑 *Líder/Encarregado:* ${leaders}\n`
      text += `👥 *Qtd. Funcionários:* ${modelo.funcionarios.length} colaboradores\n`
      
      if (locations.length > 0) {
        text += `📍 *Locais de Atuação:* \n`
        locations.forEach((loc, idx) => {
          text += `  ${idx + 1}. ${loc}\n`
        })
      } else {
        text += `📍 *Locais:* Conforme escala diária\n`
      }
      
      text += `\n----------------------------------\n`
      text += `✨ *Gestão de Equipes - Rogério* ✨`
      return text
    }

    // Modo Completo:
    let text = `🚀 *ROTEIRO OPERACIONAL DE TRABALHO* 🚀\n\n`
    text += `📅 *Data:* ${dateText}\n`
    text += `👥 *Equipe:* ${teamName}\n`
    text += `👑 *Líder/Encarregado:* ${leaders}\n`
    text += `📋 *Tipo de Escala:* ${isFeriado ? '🚨 FERIADO (100%)' : '☀️ DOMINICAL (COM FOLGAS)'}\n`
    if (locations.length > 0) {
      text += `📍 *Locais de Atuação:* ${locations.join(', ')}\n`
    }
    if (modelo.descricao) {
      text += `📝 *Descrição:* ${modelo.descricao}\n`
    }
    text += `\n👤 *Integrantes da Equipe:* \n`

    modelo.funcionarios.forEach((f: any, idx: number) => {
      const funcData = funcionarioMap.get(f.funcionario_id)
      const name = funcData?.nome || f.nome
      const apelido = funcData?.apelido ? ` (${funcData.apelido})` : ''
      const cargo = funcData?.cargo || 'Colaborador'
      
      text += `\n${idx + 1}. *${name}*${apelido}\n`
      text += `   💼 *Função:* ${cargo}\n`
      
      if (!isFeriado) {
        const folga = folgasFuncionarios[f.funcionario_id] || {}
        const diaCompensado = modelo.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
        const diaRepouso = modelo.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso
        
        const compLabel = diaCompensado ? labelDia(diaCompensado) : 'Nenhum'
        const repLabel = diaRepouso ? labelDia(diaRepouso) : 'Nenhum'
        text += `   🔄 *Folga Compensada:* ${compLabel} | 💤 *Repouso:* ${repLabel}\n`
      }
    });

    text += `\n----------------------------------\n`
    text += `✨ *Gestão de Equipes - Rogério* ✨`
    return text
  }, [equipesList, getModelTeam, folgasFuncionarios, funcionarioMap])

  useEffect(() => {
    if (!previewModelo) {
      setPreviewText('')
      return
    }
    const currentPreview = previewModelo
    let active = true
    async function loadText() {
      setLoadingPreview(true)
      try {
        const locations = await fetchLocationsForDate(currentPreview.modelo, currentPreview.dateStr)
        if (active) {
          const text = getMessageText(currentPreview.modelo, currentPreview.dateStr, previewMode, locations)
          setPreviewText(text)
        }
      } catch (err) {
        if (active) showMsg('Erro ao gerar texto de visualização', 'error')
      } finally {
        if (active) setLoadingPreview(false)
      }
    }
    loadText()
    return () => {
      active = false
    }
  }, [previewModelo, previewMode, getMessageText])

  const handleShareWhatsApp = useCallback(async (modelo: ModeloEscala, dateStr?: string, mode: 'completo' | 'enxuto' = 'completo') => {
    showMsg('Carregando informações do roteiro...', 'success')
    const locations = await fetchLocationsForDate(modelo, dateStr)
    const text = getMessageText(modelo, dateStr, mode, locations)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }, [getMessageText])

  const handleCopyMessage = useCallback(async (modelo: ModeloEscala, dateStr?: string, mode: 'completo' | 'enxuto' = 'completo') => {
    showMsg('Carregando informações do roteiro...', 'success')
    const locations = await fetchLocationsForDate(modelo, dateStr)
    const text = getMessageText(modelo, dateStr, mode, locations)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        showMsg('Mensagem copiada para a área de transferência!')
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        showMsg('Mensagem copiada!')
      }
    } catch (err) {
      showMsg('Erro ao copiar mensagem', 'error')
    }
  }, [getMessageText])


  function addFuncionario(funcionarioId: string) {
    if (!editando) return
    if (editando.funcionarios.some(f => f.funcionario_id === funcionarioId)) return

    const func = funcionarioMap.get(funcionarioId)
    const folga = folgasFuncionarios[funcionarioId] || {}
    const fixedCompensado = (folga.diaCompensado || null) as any
    const fixedRepouso = (folga.diaRepouso || null) as any

    setEditando({
      ...editando,
      funcionarios: [
        ...editando.funcionarios,
        {
          funcionario_id: funcionarioId,
          nome: func?.nome ?? '',
          tipo: 'presente',
          turno: null,
          diaCompensado: fixedCompensado,
          diaRepouso: fixedRepouso
        },
      ],
    })
  }

  function removeFuncionario(funcionarioId: string) {
    if (!editando) return
    setEditando({ ...editando, funcionarios: editando.funcionarios.filter(f => f.funcionario_id !== funcionarioId) })
  }

  function updateFunc(funcionarioId: string, updates: Partial<ModeloEscalaFuncionario>) {
    if (!editando) return
    setEditando({
      ...editando,
      funcionarios: editando.funcionarios.map(f => f.funcionario_id === funcionarioId ? { ...f, ...updates } : f),
    })
  }

  async function aplicarModelo() {
    const targetModelo = editando || modeloParaAplicar
    if (!targetModelo || !aplicarData) return

    const targetDate = new Date(aplicarData + 'T12:00:00')
    const isFeriado = targetModelo.tipo === 'feriado'

    if (!isFeriado && getDay(targetDate) !== 0) {
      showMsg('A data selecionada não é um domingo!', 'error')
      return
    }

    setAplicando(true)
    try {
      const entries: any[] = []
      const datesToQuerySet = new Set<string>()
      datesToQuerySet.add(aplicarData)

      // Fetch team members if it's a holiday
      let teamEmployeeIds: string[] = []
      const equipeId = targetModelo.equipe_id || (teamInfo?.isRestricted ? teamInfo.teamIds?.[0] : null)
      if (equipeId) {
        const { data: mems } = await supabase
          .from('equipe_membros')
          .select('funcionario_id')
          .eq('equipe_id', equipeId)
        if (mems) {
          teamEmployeeIds = mems.map((m: any) => m.funcionario_id)
        }
      }

      const allTargetFuncIds = Array.from(new Set([
        ...targetModelo.funcionarios.map(f => f.funcionario_id),
        ...teamEmployeeIds
      ]))

      const empConfigs = targetModelo.funcionarios.map(f => {
        const dates: string[] = [aplicarData]

        if (!isFeriado) {
          const folga = folgasFuncionarios[f.funcionario_id] || {}
          const diaCompensado = targetModelo.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
          const diaRepouso = targetModelo.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso

          if (diaCompensado) {
            const offset = getDayOffset(diaCompensado)
            const compDate = addDays(targetDate, offset)
            const dStr = format(compDate, 'yyyy-MM-dd')
            dates.push(dStr)
            datesToQuerySet.add(dStr)
          }

          if (diaRepouso) {
            const offset = getDayOffset(diaRepouso)
            const repDate = addDays(targetDate, offset)
            const dStr = format(repDate, 'yyyy-MM-dd')
            dates.push(dStr)
            datesToQuerySet.add(dStr)
          }
        }

        return { funcionario_id: f.funcionario_id, dates }
      })

      if (isFeriado) {
        teamEmployeeIds.forEach(id => {
          if (!targetModelo.funcionarios.some(f => f.funcionario_id === id)) {
            datesToQuerySet.add(aplicarData)
          }
        })
      }

      const datesToQuery = Array.from(datesToQuerySet)

      // Fetch existing scales for undo purposes
      const { data: existingEscalas } = await supabase
        .from('escalas')
        .select('*')
        .in('funcionario_id', allTargetFuncIds)
        .in('data', datesToQuery)

      const matchingExisting = (existingEscalas || []).filter(e => {
        const dKey = e.data.substring(0, 10)
        if (isFeriado) {
          return allTargetFuncIds.includes(e.funcionario_id) && dKey === aplicarData
        }
        const config = empConfigs.find(c => c.funcionario_id === e.funcionario_id)
        return config && config.dates.includes(dKey)
      })

      const isEmployeeInactive = (funcId: string, dateStr: string): boolean => {
        const func = (funcionariosOrig || []).find(x => x.id === funcId)
        if (!func) return false
        return !!(func.data_desligamento && dateStr >= func.data_desligamento)
      }

      const hasProtectedEntry = (funcId: string, dateStr: string): boolean => {
        const existing = (existingEscalas || []).find(e =>
          e.funcionario_id === funcId &&
          e.data.substring(0, 10) === dateStr
        )
        return existing ? isProtectedScaleType(existing.tipo) : false
      }

      for (const f of targetModelo.funcionarios) {
        if (isEmployeeInactive(f.funcionario_id, aplicarData)) continue

        if (!hasProtectedEntry(f.funcionario_id, aplicarData)) {
          entries.push({
            funcionario_id: f.funcionario_id,
            data: aplicarData,
            tipo: isFeriado ? 'hora_extra' : 'presente',
            turno: null,
          })
        }

        if (!isFeriado) {
          const folga = folgasFuncionarios[f.funcionario_id] || {}
          const diaCompensado = targetModelo.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
          const diaRepouso = targetModelo.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso

          // Compensado - week before Sunday (Thu/Fri/Sat)
          if (diaCompensado) {
            const offset = getDayOffset(diaCompensado)
            const compDate = addDays(targetDate, offset)
            const dStr = format(compDate, 'yyyy-MM-dd')
            if (!hasProtectedEntry(f.funcionario_id, dStr) && !isEmployeeInactive(f.funcionario_id, dStr)) {
              entries.push({
                funcionario_id: f.funcionario_id,
                data: dStr,
                tipo: 'compensar',
                turno: null,
              })
            }
          }

          // Repouso - week after Sunday (Mon/Tue/Wed)
          if (diaRepouso) {
            const offset = getDayOffset(diaRepouso)
            const repDate = addDays(targetDate, offset)
            const dStr = format(repDate, 'yyyy-MM-dd')
            if (!hasProtectedEntry(f.funcionario_id, dStr) && !isEmployeeInactive(f.funcionario_id, dStr)) {
              entries.push({
                funcionario_id: f.funcionario_id,
                data: dStr,
                tipo: 'repouso',
                turno: null,
              })
            }
          }
        }
      }

      // If it's a holiday, set all OTHER active members of the supervisor's team to 'repouso'
      if (isFeriado) {
        const modelFuncIds = new Set(targetModelo.funcionarios.map(f => f.funcionario_id))
        for (const otherId of teamEmployeeIds) {
          if (!modelFuncIds.has(otherId)) {
            if (isEmployeeInactive(otherId, aplicarData)) continue
            if (!hasProtectedEntry(otherId, aplicarData)) {
              entries.push({
                funcionario_id: otherId,
                data: aplicarData,
                tipo: 'repouso',
                turno: null,
              })
            }
          }
        }
      }

      await batchUpsert(entries)

      // Save application history for undoing
      const history = {
        modeloId: targetModelo.id,
        modeloNome: targetModelo.nome,
        domingo: aplicarData,
        domingoFormatado: format(targetDate, 'dd/MM/yyyy'),
        funcionariosIds: allTargetFuncIds,
        dates: datesToQuery,
        existingEscalas: matchingExisting
      }

      localStorage.setItem('historico_aplicacao_modelo', JSON.stringify(history))

      // Persistently register applied model in database configurations
      const updated = {
        ...modelosAplicados,
        [aplicarData]: { modeloId: targetModelo.id, nome: targetModelo.nome }
      }
      await supabase
        .from('configuracoes')
        .upsert(
          { chave: 'modelos_aplicados', valor: updated, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      setModelosAplicados(updated)

      if (isFeriado) {
        showMsg(`Modelo de Feriado aplicado! ${targetModelo.funcionarios.length} colaboradores escalados para trabalhar em ${format(targetDate, 'dd/MM/yyyy')} sem folgas adicionadas.`)
      } else {
        showMsg(`Modelo Dominical aplicado! ${targetModelo.funcionarios.length} funcionários escalados no domingo ${format(targetDate, 'dd/MM/yyyy')} com folgas configuradas.`)
      }
      setShowAplicar(false)
      setAplicarData('')
    } catch {
      showMsg('Erro ao aplicar modelo', 'error')
    }
    setAplicando(false)
  }

  // Coletar funcionários que já estão vinculados ao modelo atualmente em edição
  const funcionariosNoModeloEditando = useMemo(() => {
    const set = new Set<string>()
    if (editando) {
      for (const f of editando.funcionarios) {
        set.add(f.funcionario_id)
      }
    }
    return set
  }, [editando])

  const funcionariosForaModelo = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10)
    return (funcionarios ?? []).filter(f =>
      f.status === 'ativo' &&
      (!f.data_desligamento || f.data_desligamento >= todayStr) &&
      !funcionariosNoModeloEditando.has(f.id)
    )
  }, [funcionarios, funcionariosNoModeloEditando])

  const filteredDisponiveis = useMemo(() => {
    return funcionariosForaModelo.filter(f => {
      const term = searchDisponivel.toLowerCase()
      return f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
    })
  }, [funcionariosForaModelo, searchDisponivel])

  const folgaDistribution = useMemo(() => {
    const distribution = {
      segunda: 0,
      terca: 0,
      quarta: 0,
      quinta: 0,
      sexta: 0,
      sabado: 0
    }
    if (!editando) return distribution
    for (const f of editando.funcionarios) {
      const folga = folgasFuncionarios[f.funcionario_id] || {}
      const diaCompensado = editando.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
      const diaRepouso = editando.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso

      if (diaCompensado && diaCompensado in distribution) {
        distribution[diaCompensado as keyof typeof distribution]++
      }
      if (diaRepouso && diaRepouso in distribution) {
        distribution[diaRepouso as keyof typeof distribution]++
      }
    }
    return distribution
  }, [editando, folgasFuncionarios])

  const appliedList = useMemo(() => {
    return Object.entries(modelosAplicados)
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [modelosAplicados])

  const filteredAppliedList = useMemo(() => {
    const year = historicoMonth.getFullYear()
    const month = historicoMonth.getMonth()

    let list = appliedList.map(item => {
      const modeloOriginal = modelos.find(m => m.id === item.modeloId)
      return {
        ...item,
        tipo: modeloOriginal?.tipo || 'dominical',
        funcionarios: modeloOriginal?.funcionarios || []
      }
    })

    // Filter by month
    list = list.filter(item => {
      const dateObj = new Date(item.date + 'T12:00:00')
      return dateObj.getFullYear() === year && dateObj.getMonth() === month
    })

    // Filter by search term
    if (appliedSearchTerm.trim()) {
      const search = appliedSearchTerm.toLowerCase()
      list = list.filter(item =>
        item.nome.toLowerCase().includes(search) ||
        item.date.includes(search) ||
        item.funcionarios.some(f => f.nome.toLowerCase().includes(search))
      )
    }

    // Filter by type
    if (appliedTypeFilter !== 'all') {
      list = list.filter(item => item.tipo === appliedTypeFilter)
    }

    if (teamInfo?.isRestricted) {
      list = list.filter(item => modelos.some(m => m.id === item.modeloId))
    }

    return list
  }, [appliedList, historicoMonth, teamInfo, modelos, appliedSearchTerm, appliedTypeFilter])

  if (isLoading || isLoadingTeam) return <Loading size="lg" text="Carregando modelos..." />

  return (
    <div className="min-h-screen bg-background pb-32 cyber-grid">
      <TopHeader title="Modelos de Escala" subtitle="Gerencie os modelos de escala dominical" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-24 sm:pt-28">
        {/* Toast */}
        {msg && (
          <div className={cn(
            "flex items-center gap-3 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border mb-6 animate-fade-in shadow-lg backdrop-blur-md",
            msgType === 'success'
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/5"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-rose-500/5"
          )}>
            <Check className="w-4 h-4 shrink-0" />
            {msg}
          </div>
        )}

        {/* Tab switcher */}
        {!editando && (
          <div className="flex justify-center mb-8 relative z-10">
            <div className="bg-card/80 backdrop-blur-md p-1.5 rounded-2xl border border-border/40 flex shadow-lg">
              <button
                onClick={() => setActiveTab('modelos')}
                className={cn(
                  "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
                  activeTab === 'modelos'
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Modelos de Escala
              </button>
              <button
                onClick={() => setActiveTab('folgas')}
                className={cn(
                  "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
                  activeTab === 'folgas'
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Folgas Fixas
              </button>
            </div>
          </div>
        )}

        {/* Mobile: show list or editor */}
        {!editando ? (
          activeTab === 'modelos' ? (
            /* Lista de Modelos & Histórico de Aplicação */
            <div className="space-y-8 animate-fade-in">
              {/* Header Box */}
              <div className="relative overflow-hidden bg-gradient-to-r from-card/85 via-card/70 to-card/50 backdrop-blur-2xl border border-border/40 rounded-[2rem] p-6 sm:p-8 shadow-xl cyber-scanline cyber-glow-primary">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center border border-primary/25 shrink-0 shadow-lg shadow-primary/20">
                      <CalendarDays className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-wider text-foreground leading-none">Painel de Modelos</h2>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-2">Gerencie e automatize escalas dominicais de maneira profissional</p>
                    </div>
                  </div>
                  <div className="flex items-center flex-wrap gap-3 w-full sm:w-auto">
                    {!teamInfo?.isRestricted && (
                      <select
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                        className="px-4 py-3 bg-muted/65 border border-border/40 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none text-foreground cursor-pointer focus:border-primary/50 shadow-inner"
                      >
                        <option value="all">Todas as Equipes</option>
                        {equipesList.map((eq: any) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.nome}
                          </option>
                        ))}
                      </select>
                    )}
                    {lastHistory && (
                      <button
                        onClick={desaplicarModelo}
                        disabled={desaplicando}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-amber-600/10 hover:bg-amber-600 text-amber-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm border border-amber-600/20 cursor-pointer"
                      >
                        <RotateCcw className={cn("w-4 h-4", desaplicando && "animate-spin")} />
                        Desfazer ({lastHistory.domingoFormatado})
                      </button>
                    )}
                    <button
                      onClick={criarNovo}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary/95 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] hover:shadow-primary/30 transition-all duration-300 active:scale-95 shadow-lg cursor-pointer border border-primary/20"
                    >
                      <Plus className="w-4 h-4" /> Novo Modelo
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Coluna 1 & 2: Modelos Cadastrados */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                      Modelos Cadastrados
                    </h3>
                  </div>

                  {modelos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 rounded-[2.5rem] border-2 border-dashed border-border/40 bg-card/40 backdrop-blur-md text-muted-foreground/45 max-w-lg mx-auto shadow-sm">
                      <div className="w-16 h-16 bg-muted/40 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                        <CalendarDays className="w-8 h-8 opacity-50 text-primary" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-wide text-foreground">Nenhum modelo criado</p>
                      <p className="text-xs mt-2.5 text-muted-foreground/80 max-w-xs text-center font-bold leading-relaxed">Crie modelos de escala de domingos para acelerar a escalabilidade das suas equipes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {modelos.map(m => (
                        <div
                          key={m.id}
                          className="text-left p-5.5 rounded-3xl border border-border/40 bg-gradient-to-br from-card/90 to-card/45 dark:from-card/60 dark:to-card/25 backdrop-blur-xl hover:border-primary/30 hover:shadow-[0_20px_50px_rgba(59,130,246,0.06)] hover:scale-[1.01] transition-all duration-500 group flex flex-col justify-between min-h-[200px] relative overflow-hidden shadow-sm"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-all duration-500 pointer-events-none" />

                          <div className="flex items-start justify-between w-full gap-3 relative z-10">
                            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                              <Users className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/20 shadow-sm">
                              {m.funcionarios.length} Colaborador{m.funcionarios.length !== 1 ? 'es' : ''}
                            </span>
                          </div>

                          <div className="mt-6 relative z-10 flex-1 w-full">
                            <h4 className="font-black text-foreground text-sm sm:text-base tracking-tight uppercase truncate">
                              {m.nome || '(sem nome)'}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={cn(
                                "text-[7.5px] font-black uppercase px-2 py-0.5 rounded border tracking-wider",
                                m.tipo === 'feriado'
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              )}>
                                {m.tipo === 'feriado' ? 'Escala Feriado' : 'Escala Dominical'}
                              </span>
                            </div>
                            {(() => {
                              const modelTeam = getModelTeam(m, equipesList)
                              if (!modelTeam) return null
                              return (
                                <div className="mt-2 flex flex-col gap-1">
                                  <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 w-fit">
                                    Equipe: {modelTeam.nome}
                                  </span>
                                  {modelTeam.encarregados && modelTeam.encarregados.length > 0 && (
                                    <span className="text-[7.5px] font-bold text-muted-foreground/60 uppercase tracking-widest block leading-none mt-1">
                                      Encarregado: {modelTeam.encarregados.map((enc: any) => enc.nome).join(', ')}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                            {m.descricao ? (
                              <p className="text-[10px] text-muted-foreground/75 mt-1.5 line-clamp-2 leading-relaxed font-bold">
                                {m.descricao}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/35 mt-1.5 italic font-bold">
                                Sem descrição configurada
                              </p>
                            )}

                            {/* Resumo de Funcionários e Folgas */}
                            {m.funcionarios.length > 0 && (
                              <div className="mt-3.5 space-y-2">
                                <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest block leading-none">Membros Vinculados</span>
                                <div className="flex flex-wrap gap-2">
                                  {m.funcionarios.map(f => {
                                    const funcData = funcionarioMap.get(f.funcionario_id)
                                    const apelido = funcData?.apelido || funcData?.nome?.split(' ')[0] || f.nome?.split(' ')[0] || '—'

                                    const folga = folgasFuncionarios[f.funcionario_id] || {}
                                    const diaCompensado = m.personalizarFolgas ? (f.diaCompensado !== undefined ? f.diaCompensado : folga.diaCompensado) : folga.diaCompensado
                                    const diaRepouso = m.personalizarFolgas ? (f.diaRepouso !== undefined ? f.diaRepouso : folga.diaRepouso) : folga.diaRepouso

                                    return (
                                      <div key={f.funcionario_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/40 dark:bg-muted/10 border border-border/20 text-[9px] font-black uppercase text-foreground/90">
                                        <span>{apelido}</span>
                                        <div className="flex gap-0.5">
                                          {diaCompensado && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" title={`Compensado: ${diaCompensado}`} />}
                                          {diaRepouso && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" title={`Repouso: ${diaRepouso}`} />}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-5 pt-4 border-t border-border/30 space-y-2 relative z-20">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                onClick={() => {
                                  setModeloParaAplicar(m)
                                  setShowAplicar(true)
                                  setAplicarData('')
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm shadow-emerald-600/10 cursor-pointer active:scale-95"
                              >
                                <Play className="w-3.5 h-3.5 shrink-0" /> Aplicar
                              </button>
                              <button
                                onClick={() => setEditando(m)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground border border-border/40 hover:border-primary/30 text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95"
                              >
                                <Layers className="w-3.5 h-3.5 shrink-0 text-primary" /> Editar
                              </button>
                            </div>
                            <div className="pt-2 border-t border-border/10">
                              <button
                                onClick={() => {
                                  setPreviewModelo({ modelo: m })
                                  setPreviewMode('completo')
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 group"
                              >
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                  <span>Enviar / Copiar Roteiro</span>
                                </div>
                                <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider group-hover:bg-white/20 group-hover:text-white transition-all">
                                  Texto
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coluna 3: Modelos Aplicados */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                      Modelos Aplicados
                    </h3>
                  </div>

                  <div className="bg-card/90 dark:bg-card/45 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm space-y-5">
                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 shadow-sm">
                      <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider leading-relaxed">
                        💡 Clique na lixeira para reverter a aplicação. Isso limpa a escala correspondente na escala principal.
                      </span>
                    </div>

                    {/* Selector of Month */}
                    <div className="flex items-center justify-between gap-4 p-2.5 rounded-2xl bg-muted/30 border border-border/30">
                      <button
                        onClick={() => setHistoricoMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; })}
                        className="w-8.5 h-8.5 rounded-xl flex items-center justify-center bg-card border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
                        title="Mês Anterior"
                      >
                        <ChevronLeft className="w-5.5 h-5.5" />
                      </button>
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-foreground">
                        {format(historicoMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                      <button
                        onClick={() => setHistoricoMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; })}
                        className="w-8.5 h-8.5 rounded-xl flex items-center justify-center bg-card border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
                        title="Próximo Mês"
                      >
                        <ChevronLeft className="w-5.5 h-5.5 rotate-180" />
                      </button>
                    </div>

                    {/* Search & Filter Options */}
                    <div className="space-y-3 p-3 rounded-2xl bg-muted/20 border border-border/30">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <input
                          type="text"
                          value={appliedSearchTerm}
                          onChange={e => setAppliedSearchTerm(e.target.value)}
                          placeholder="Buscar aplicado..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/25 bg-background text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-1 bg-muted/30 p-1 rounded-xl">
                        {(['all', 'dominical', 'feriado'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setAppliedTypeFilter(t)}
                            className={cn(
                              "py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                              appliedTypeFilter === t
                                ? "bg-card text-foreground shadow-sm border border-border/10"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {t === 'all' ? 'Todos' : t === 'dominical' ? 'Dom' : 'Fer'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredAppliedList.length === 0 ? (
                      <div className="py-12 text-center border border-dashed border-border/30 rounded-2xl text-[9px] text-muted-foreground/40 font-black bg-muted/5 uppercase tracking-wider">
                        Sem aplicações neste período
                      </div>
                    ) : (
                      <div className="space-y-4 relative before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-[1px] before:bg-border/30">
                        {filteredAppliedList.map(item => {
                          const dateObj = new Date(item.date + 'T12:00:00')
                          const formattedDate = format(dateObj, "dd/MM/yyyy")
                          const weekDayLabel = format(dateObj, "eeee", { locale: ptBR })
                          const isFeriado = item.tipo === 'feriado'
                          const isExpanded = expandedAppliedDate === item.date

                          return (
                            <div key={item.date} className="relative pl-6 group animate-fade-in">
                              {/* Glowing Timeline Dot */}
                              <div className={cn(
                                "absolute left-0 top-[22px] w-2.5 h-2.5 rounded-full border-2 border-background transition-transform duration-300 group-hover:scale-125",
                                isFeriado
                                  ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                                  : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                              )} />

                              <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/15 hover:border-primary/25 hover:bg-card/10 transition-all duration-300 shadow-sm space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={cn(
                                        "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                        isFeriado
                                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/15"
                                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15"
                                      )}>
                                        {formattedDate}
                                      </span>
                                      <span className="text-[7px] font-bold text-muted-foreground/60 uppercase tracking-widest">{weekDayLabel}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-foreground truncate uppercase mt-1 group-hover:text-primary transition-colors">{item.nome}</p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => setExpandedAppliedDate(isExpanded ? null : item.date)}
                                      className="px-2 py-1 rounded-lg bg-card border border-border/40 hover:border-primary/30 text-[8px] font-black uppercase text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                      title={isExpanded ? "Ocultar integrantes" : "Visualizar integrantes"}
                                    >
                                      {isExpanded ? "Recolher" : `Ver (${item.funcionarios.length})`}
                                    </button>
                                    <button
                                      onClick={() => removerModeloAplicado(item.date, item.modeloId)}
                                      className="p-1.5 rounded-lg text-rose-500/50 hover:text-white bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 transition-all duration-300 shrink-0 active:scale-95 cursor-pointer shadow-sm"
                                      title="Remover aplicação e reverter escala"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="pt-2.5 border-t border-border/10 space-y-3 animate-fade-in">
                                    <div className="space-y-1.5">
                                      <span className="text-[7.5px] font-black text-muted-foreground/70 uppercase tracking-wider block">Integrantes Vinculados:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {item.funcionarios.map((f: any) => {
                                          const funcData = funcionarioMap.get(f.funcionario_id)
                                          const nameToShow = funcData?.apelido || funcData?.nome || f.nome
                                          return (
                                            <span key={f.funcionario_id} className="text-[8px] font-black uppercase px-2 py-1 rounded bg-card border border-border/30 text-foreground/80">
                                              {nameToShow}
                                            </span>
                                          )
                                        })}
                                        {item.funcionarios.length === 0 && (
                                          <span className="text-[7.5px] text-muted-foreground/40 italic font-bold">Nenhum funcionário cadastrado no modelo original</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-border/10">
                                      <button
                                        onClick={() => {
                                          const modeloOriginal = modelos.find(m => m.id === item.modeloId)
                                          if (modeloOriginal) {
                                            setPreviewModelo({ modelo: modeloOriginal, dateStr: item.date })
                                            setPreviewMode('completo')
                                          }
                                        }}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 group"
                                      >
                                        <div className="flex items-center gap-2">
                                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                          <span>Enviar / Copiar Roteiro</span>
                                        </div>
                                        <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider group-hover:bg-white/20 group-hover:text-white transition-all">
                                          Texto
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab Folgas Fixas */
            <div className="space-y-6 animate-fade-in">
              {/* Header / Info box for folgas */}
              <div className="relative overflow-hidden bg-gradient-to-r from-card/85 via-card/70 to-card/50 backdrop-blur-2xl border border-border/40 rounded-[2rem] p-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wider text-foreground leading-none">Folgas Fixas por Colaborador</h2>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-2">
                      Defina o padrão de folgas semanais de cada funcionário. Estas folgas serão aplicadas automaticamente ao usar modelos.
                    </p>
                  </div>

                  {/* Search Input inside the box */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/45" />
                    <input
                      type="text"
                      value={folgasSearchTerm}
                      onChange={e => setFolgasSearchTerm(e.target.value)}
                      placeholder="Pesquisar funcionário..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border/30 bg-muted/20 text-xs font-bold focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300 focus:bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Stats Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-card/85 to-card/50 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block leading-none">Colaboradores Ativos</span>
                    <span className="text-xl font-black text-foreground mt-1.5 block">{folgaStats.totalAtivos}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-card/85 to-card/50 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                    <Target className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block leading-none">Sem Folga Definida</span>
                    <span className="text-xl font-black text-foreground mt-1.5 block">{folgaStats.semFolga}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-card/85 to-card/50 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-sm flex flex-col justify-center gap-2 relative overflow-hidden group">
                  <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest block leading-none">Densidade de Folgas</span>
                  <div className="flex gap-1.5 w-full mt-1">
                    {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const).map(day => {
                      const count = folgaStats.countPorDia[day] || 0
                      const isComp = ['quinta', 'sexta', 'sabado'].includes(day)
                      return (
                        <div key={day} className="flex-1 text-center py-1 rounded bg-muted/30 border border-border/10">
                          <p className="text-[7px] font-black text-muted-foreground/50 uppercase leading-none">{labelDia(day).slice(0, 1)}</p>
                          <p className={cn("text-[9px] font-black mt-1 leading-none", count > 0 ? isComp ? "text-amber-500" : "text-blue-500" : "text-muted-foreground/30")}>{count}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* List of employees and their days off */}
              <div className="bg-gradient-to-br from-card/90 to-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] p-6 shadow-md">
                {(() => {
                  const filteredFuncs = funcionarios.filter(f => {
                    if (f.status !== 'ativo') return false
                    const term = folgasSearchTerm.toLowerCase()
                    return f.nome.toLowerCase().includes(term) || (f.apelido && f.apelido.toLowerCase().includes(term))
                  })

                  if (filteredFuncs.length === 0) {
                    return (
                      <div className="py-20 text-center text-muted-foreground opacity-50 uppercase text-xs font-black">
                        Nenhum funcionário encontrado
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {filteredFuncs.map(f => {
                        const initials = f.nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        const folga = folgasFuncionarios[f.id] || { diaCompensado: 'quinta', diaRepouso: 'segunda', turno: 'integral' }

                        return (
                          <div key={f.id} className="p-5 rounded-[1.75rem] bg-muted/20 border border-border/30 hover:border-primary/20 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                            {/* Info */}
                            <div className="flex items-center gap-3.5 min-w-0 md:max-w-[40%]">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20 group-hover:scale-105 transition-all">
                                <span className="text-[11px] font-black text-primary">{initials}</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm font-black text-foreground block truncate uppercase leading-none mb-1 group-hover:text-primary transition-colors">
                                  {f.apelido || f.nome}
                                </span>
                                {f.cargo && (
                                  <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-black">
                                    {f.cargo}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Day Config Selectors */}
                            <div className="flex flex-col sm:flex-row gap-5 flex-1 justify-end">
                              {/* Compensado Select */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" /> Compensado
                                </span>
                                <div className="flex gap-1.5">
                                  {DIAS_COMPENSADO.map(d => {
                                    const active = folga.diaCompensado === d.value
                                    return (
                                      <button
                                        key={d.value}
                                        onClick={() => updateFixedFolga(f.id, { diaCompensado: active ? null : d.value })}
                                        className={cn(
                                          "px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 active:scale-95 cursor-pointer",
                                          active
                                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/20"
                                            : "bg-muted/40 text-muted-foreground/80 border-border/30 hover:border-amber-500/30 hover:bg-muted/70"
                                        )}
                                      >
                                        {d.label.slice(0, 3)}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Repouso Select */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" /> Repouso
                                </span>
                                <div className="flex gap-1.5">
                                  {DIAS_REPOUSO.map(d => {
                                    const active = folga.diaRepouso === d.value
                                    return (
                                      <button
                                        key={d.value}
                                        onClick={() => updateFixedFolga(f.id, { diaRepouso: active ? null : d.value })}
                                        className={cn(
                                          "px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 active:scale-95 cursor-pointer",
                                          active
                                            ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-md shadow-blue-500/20"
                                            : "bg-muted/40 text-muted-foreground/80 border-border/30 hover:border-blue-500/30 hover:bg-muted/70"
                                        )}
                                      >
                                        {d.label.slice(0, 3)}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        ) : (
          /* Editor do Modelo */
          <div className="space-y-8 animate-fade-in">
            {/* Header with back */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-gradient-to-r from-card/80 to-card/50 backdrop-blur-xl border border-border/40 rounded-3xl p-5 shadow-lg">
              <button onClick={() => setEditando(null)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer">
                <ChevronLeft className="w-5 h-5 text-primary" /> Voltar ao Painel
              </button>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowAplicar(true)}
                  disabled={editando.funcionarios.length === 0}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 active:scale-95 shadow-lg border border-emerald-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 animate-pulse" /> Aplicar na Escala
                </button>
                <button
                  onClick={salvar}
                  disabled={saving || !editando.nome.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] hover:shadow-primary/30 transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 active:scale-95 shadow-lg border border-primary/20 cursor-pointer"
                >
                  {saving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar Modelo</>}
                </button>
              </div>
            </div>

            {/* Workspace do Modelo */}
            <div className="space-y-6">
              {/* Futuristic Analytics Panel: Weekly Day-off Distribution */}
              <div className="bg-gradient-to-r from-card/90 via-card/75 to-card/50 backdrop-blur-2xl border border-primary/10 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="space-y-1.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Cpu className="w-5 h-5 text-primary animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 leading-none">
                        <Sparkles className="w-3.5 h-3.5" /> Analítica de Escala
                      </h4>
                      <p className="text-[8px] text-muted-foreground/60 uppercase tracking-widest font-black mt-1">Carga e equilíbrio de folgas em tempo real</p>
                    </div>
                  </div>

                  {/* Distribution timeline */}
                  <div className="flex-1 max-w-2xl grid grid-cols-6 gap-2 sm:gap-4 w-full">
                    {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const).map(day => {
                      const count = folgaDistribution[day]
                      const isComp = ['quinta', 'sexta', 'sabado'].includes(day)
                      const pct = Math.min((count / 6) * 100, 100)
                      return (
                        <div key={day} className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-muted/20 border border-border/10">
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-muted-foreground">{labelDia(day)}</span>
                          {/* Mini Vertical Glow Bar */}
                          <div className="h-10 w-2.5 bg-muted/60 rounded-full relative overflow-hidden border border-border/20">
                            <div
                              style={{ height: `${pct || 4}%` }}
                              className={cn(
                                "absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500",
                                count > 0
                                  ? isComp
                                    ? "bg-gradient-to-t from-orange-500 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                    : "bg-gradient-to-t from-indigo-500 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                  : "bg-transparent"
                              )}
                            />
                          </div>
                          <span className={cn("text-[9px] font-black leading-none mt-0.5", count > 0 ? isComp ? "text-amber-500" : "text-blue-500" : "text-muted-foreground/30")}>
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Workspace Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Coluna Lateral: Definições e Disponíveis */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Definições Gerais */}
                  <div className="bg-gradient-to-br from-card/85 to-card/50 backdrop-blur-xl border border-border/40 rounded-[2rem] p-6 shadow-md space-y-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/50 via-primary/5 to-transparent" />
                    <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                      <div className="w-1.5 h-4 bg-primary rounded-full animate-pulse" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" /> Definições
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nome do Modelo *</label>
                        <input
                          value={editando.nome}
                          onChange={e => setEditando({ ...editando, nome: e.target.value })}
                          placeholder="Ex: Escala Domingo Padrão"
                          className="w-full px-4 py-3.5 rounded-2xl border border-border/30 bg-muted/20 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300 focus:bg-background focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Escala *</label>
                        <select
                          value={editando.tipo || 'dominical'}
                          onChange={e => setEditando({ ...editando, tipo: e.target.value as any })}
                          className="w-full px-4 py-3.5 rounded-2xl border border-border/30 bg-muted/20 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300 focus:bg-background focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="dominical">Escala Dominical (Com Folgas)</option>
                          <option value="feriado">Escala Feriado (Sem Folgas - 100%)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Descrição (opcional)</label>
                        <input
                          value={editando.descricao}
                          onChange={e => setEditando({ ...editando, descricao: e.target.value })}
                          placeholder="Descrição do modelo para guiar a equipe"
                          className="w-full px-4 py-3.5 rounded-2xl border border-border/30 bg-muted/20 text-xs font-bold focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300 focus:bg-background focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      {/* Toggle Personalizar Folgas */}
                      {(editando.tipo || 'dominical') !== 'feriado' && (
                        <div className="pt-3 border-t border-border/25 flex items-center justify-between gap-4">
                          <div>
                            <label className="text-[9.5px] font-black uppercase tracking-widest text-foreground block">
                              Personalizar Folgas
                            </label>
                            <span className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider block mt-1 leading-normal">
                              Editar as folgas especificamente para este modelo, sem alterar a folga fixa global
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={!!editando.personalizarFolgas}
                              onChange={e => setEditando({ ...editando, personalizarFolgas: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Colaboradores Disponíveis */}
                  <div className="bg-gradient-to-br from-card/85 to-card/50 backdrop-blur-xl border border-border/40 rounded-[2rem] p-6 shadow-md flex flex-col h-[480px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/50 via-emerald-500/5 to-transparent" />
                    <div className="flex items-center justify-between pb-3 border-b border-border/30">
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-500 animate-pulse" />
                        Disponíveis ({filteredDisponiveis.length})
                      </h3>
                    </div>

                    {/* Campo de pesquisa lateral */}
                    <div className="my-4 relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={searchDisponivel}
                        onChange={e => setSearchDisponivel(e.target.value)}
                        placeholder="Pesquisar disponível..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/30 bg-muted/20 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-primary/50 text-foreground transition-all duration-300 focus:bg-background"
                      />
                    </div>

                    {/* Lista com scroll */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                      {filteredDisponiveis.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/35 uppercase text-[9px] font-black italic">
                          Nenhum colaborador disponível
                        </div>
                      ) : (
                        filteredDisponiveis.map(f => {
                          const initials = f.nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          return (
                            <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-muted/10 border border-border/10 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] transition-all duration-300 group">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 text-[10px] font-black shrink-0 shadow-sm">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10.5px] font-black text-foreground block truncate uppercase leading-tight group-hover:text-emerald-500 transition-colors">
                                    {f.apelido || f.nome}
                                  </span>
                                  {f.cargo && (
                                    <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest font-black block mt-0.5">
                                      {f.cargo}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => addFuncionario(f.id)}
                                className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/15 hover:border-emerald-500 transition-all duration-300 cursor-pointer active:scale-90 shadow-sm"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Coluna Principal: Membros do Modelo */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-gradient-to-br from-card/75 to-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] p-6 shadow-md space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/50 via-blue-500/5 to-transparent" />
                    <div className="pb-4 border-b border-border/30 flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          Membros Vinculados ({editando.funcionarios.length})
                        </h3>
                        <p className="text-[9px] text-muted-foreground/60 mt-1 font-semibold uppercase tracking-wider">
                          As folgas definidas aqui serão aplicadas como as folgas fixas padrão dos colaboradores ao salvar.
                        </p>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full shadow-inner animate-pulse">
                        Sincronização Ativa
                      </span>
                    </div>

                    {editando.funcionarios.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed border-border/40 text-muted-foreground/35 max-w-md mx-auto animate-fade-in">
                        <Users className="w-10 h-10 mb-3 animate-pulse text-muted-foreground/20" />
                        <p className="text-xs font-black uppercase tracking-wide text-foreground">Nenhum funcionário vinculado</p>
                        <p className="text-[10px] mt-1.5 text-center font-medium leading-relaxed px-6">Adicione colaboradores da lista de disponíveis na lateral esquerda para configurar suas folgas.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                        {editando.funcionarios.map(f => {
                          const funcData = funcionarioMap.get(f.funcionario_id)
                          const nome = funcData?.nome || f.nome
                          const initials = nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

                          const diaCompensado = f.diaCompensado
                          const diaRepouso = f.diaRepouso

                          return (
                            <div key={f.funcionario_id} className="p-2 px-3 rounded-xl bg-muted/15 border border-border/20 hover:border-border/40 transition-all duration-300 flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative group animate-fade-in">
                              {/* Info */}
                              <div className="flex items-center gap-2 min-w-0 lg:w-52 shrink-0">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                  <span className="text-[9px] font-black text-primary">{initials}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-foreground uppercase truncate leading-none">{nome}</p>
                                  {funcData?.cargo && (
                                    <p className="text-[7.5px] font-bold text-muted-foreground/45 uppercase tracking-wider mt-1 leading-none">{funcData.cargo}</p>
                                  )}
                                </div>
                              </div>

                              {/* Selectors / Indicators */}
                              <div className="flex-1 flex flex-wrap gap-3 items-center lg:justify-end">
                                {editando.personalizarFolgas ? (
                                  <>
                                    {/* Compensado */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[7px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Comp:</span>
                                      <div className="flex gap-0.5">
                                        {DIAS_COMPENSADO.map(d => (
                                          <button
                                            key={d.value}
                                            type="button"
                                            onClick={() => updateFunc(f.funcionario_id, { diaCompensado: diaCompensado === d.value ? null : d.value })}
                                            className={cn(
                                              "py-0.5 px-2 rounded text-[7.5px] font-black uppercase border transition-all duration-200 cursor-pointer active:scale-95",
                                              diaCompensado === d.value
                                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent"
                                                : "bg-muted/40 text-muted-foreground/80 border-border/30 hover:bg-muted"
                                            )}
                                          >
                                            {d.label.slice(0, 3)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Repouso */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[7px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Rep:</span>
                                      <div className="flex gap-0.5">
                                        {DIAS_REPOUSO.map(d => (
                                          <button
                                            key={d.value}
                                            type="button"
                                            onClick={() => updateFunc(f.funcionario_id, { diaRepouso: diaRepouso === d.value ? null : d.value })}
                                            className={cn(
                                              "py-0.5 px-2 rounded text-[7.5px] font-black uppercase border transition-all duration-200 cursor-pointer active:scale-95",
                                              diaRepouso === d.value
                                                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent"
                                                : "bg-muted/40 text-muted-foreground/80 border-border/30 hover:bg-muted"
                                            )}
                                          >
                                            {d.label.slice(0, 3)}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* Compensado Fixo */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/40 border border-border/10 text-[8.5px] font-bold text-foreground">
                                      <span className="text-[7px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Comp:</span>
                                      <span className="font-black uppercase">
                                        {(() => {
                                          const folga = folgasFuncionarios[f.funcionario_id] || {}
                                          const dia = DIAS_COMPENSADO.find(d => d.value === folga.diaCompensado)
                                          return dia ? dia.label.slice(0, 3) : 'Sem'
                                        })()}
                                      </span>
                                    </div>

                                    {/* Repouso Fixo */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/40 border border-border/10 text-[8.5px] font-bold text-foreground">
                                      <span className="text-[7px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Rep:</span>
                                      <span className="font-black uppercase">
                                        {(() => {
                                          const folga = folgasFuncionarios[f.funcionario_id] || {}
                                          const dia = DIAS_REPOUSO.find(d => d.value === folga.diaRepouso)
                                          return dia ? dia.label.slice(0, 3) : 'Sem'
                                        })()}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="shrink-0 flex justify-end">
                                <button
                                  onClick={() => removeFuncionario(f.funcionario_id)}
                                  className="p-1 rounded bg-rose-500/5 hover:bg-rose-500 text-rose-500/40 hover:text-white border border-rose-500/10 hover:border-rose-500 transition-all duration-300 active:scale-95 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Deletar Modelo */}
                    <div className="flex justify-end pt-4 border-t border-border/30">
                      <button
                        onClick={() => deletar(editando.id)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl text-rose-500/50 hover:text-white hover:bg-rose-500 text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-rose-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir Modelo Permanentemente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Adicionar Funcionário */}
      {showAddFunc && (
        <Modal open onClose={() => setShowAddFunc(false)} title="Adicionar Funcionário" subtitle="Selecione funcionários para o modelo" size="lg" className="h-[90vh] sm:h-[90vh]">
          <FuncionarioSearchList funcionarios={funcionariosForaModelo} onSelect={addFuncionario} />
        </Modal>
      )}

      {/* Modal Aplicar Domingo / Feriado */}
      {showAplicar && (editando || modeloParaAplicar) && (
        <Modal open onClose={() => { setShowAplicar(false); setAplicarData(''); setModeloParaAplicar(null) }} title={(editando || modeloParaAplicar)?.tipo === 'feriado' ? "Aplicar Modelo em Feriado" : "Aplicar Modelo em Domingo"}>
          {(() => {
            const targetModelo = editando || modeloParaAplicar
            if (!targetModelo) return null
            const isFeriado = targetModelo.tipo === 'feriado'
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 shadow-inner">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Modelo: <span className="font-black text-foreground">{targetModelo.nome}</span> &middot; {targetModelo.funcionarios.length} funcionário{targetModelo.funcionarios.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{isFeriado ? "Data (Feriado)" : "Data (Domingo)"}</label>
                  <input
                    type="date"
                    value={aplicarData}
                    onChange={e => setAplicarData(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-border/40 bg-muted/20 text-sm font-bold focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                {aplicarData && (
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 shadow-sm animate-fade-in">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">O que será aplicado:</p>
                    {isFeriado ? (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Todos os funcionários marcados como <strong>Trabalho</strong> na data {format(new Date(aplicarData + 'T12:00:00'), 'dd/MM')}</li>
                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Nenhuma folga de compensado/repouso será lançada</li>
                      </ul>
                    ) : (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Todos os funcionários marcados como <strong>Trabalho</strong> no domingo {format(new Date(aplicarData + 'T12:00:00'), 'dd/MM')}</li>
                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Folga <strong>Compensado</strong> no dia escolhido (semana anterior)</li>
                        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> Folga <strong>Repouso</strong> no dia escolhido (semana seguinte)</li>
                      </ul>
                    )}
                  </div>
                )}

                <button
                  onClick={aplicarModelo}
                  disabled={!aplicarData || aplicando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-black uppercase tracking-wider hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-40 active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  {aplicando ? 'Aplicando...' : <><Play className="w-4 h-4" /> {isFeriado ? "Aplicar Escala (Feriado 100%)" : "Aplicar Escala e Folgas"}</>}
                </button>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* MODAL DE COMPARTILHAMENTO / COPIAR TEXTO */}
      {previewModelo && (
        <Modal
          open={!!previewModelo}
          onClose={() => setPreviewModelo(null)}
          title="Texto de Compartilhamento"
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Estilo da Mensagem</p>
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/20 gap-2">
                <button
                  onClick={() => setPreviewMode('completo')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none",
                    previewMode === 'completo' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Texto Completo
                </button>
                <button
                  onClick={() => setPreviewMode('enxuto')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border-none",
                    previewMode === 'enxuto' 
                      ? "bg-card text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  Texto Enxuto
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Visualização da Mensagem</p>
              <div className="relative">
                {loadingPreview ? (
                  <div className="w-full h-64 bg-muted/20 rounded-2xl border border-border/20 flex flex-col items-center justify-center gap-3">
                    <Loading />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando roteiro...</span>
                  </div>
                ) : (
                  <>
                    <textarea
                      readOnly
                      value={previewText}
                      className="w-full h-64 bg-muted/20 border border-border/20 rounded-2xl p-4.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/30 resize-none select-all select-text cursor-text"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">
                        {previewMode === 'completo' ? 'Completo' : 'Enxuto'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!previewText) return
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(previewText)
                    } else {
                      const textarea = document.createElement('textarea')
                      textarea.value = previewText
                      textarea.style.position = 'fixed'
                      document.body.appendChild(textarea)
                      textarea.select()
                      document.execCommand('copy')
                      document.body.removeChild(textarea)
                    }
                    showMsg('Mensagem copiada para a área de transferência!')
                  } catch (err) {
                    showMsg('Erro ao copiar mensagem', 'error')
                  }
                }}
                disabled={loadingPreview || !previewText}
                className="flex-1 flex items-center justify-center gap-2.5 h-14 rounded-2xl bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-40 cursor-pointer border border-primary/10"
              >
                <Copy className="w-4 h-4 shrink-0" /> Copiar Mensagem
              </button>

              <button
                onClick={() => {
                  if (!previewText) return
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(previewText)}`
                  window.open(url, '_blank')
                }}
                disabled={loadingPreview || !previewText}
                className="flex-1 flex items-center justify-center gap-2.5 h-14 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-40 cursor-pointer border-none"
              >
                <MessageSquare className="w-4 h-4 shrink-0" /> WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FuncionarioSearchList({ funcionarios, onSelect }: { funcionarios: { id: string; nome: string; apelido?: string | null; cargo?: string }[]; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const filtrados = funcionarios.filter(f =>
    !search || f.nome.toLowerCase().includes(search.toLowerCase()) || f.apelido?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (id: string) => {
    // Blurs the clicked element to prevent DOM unmounting focus-reset glitches in the browser
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    onSelect(id)
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar funcionário..."
          className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-border/40 bg-muted/20 text-sm font-bold focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filtrados.length === 0 && (
          <p className="text-xs text-muted-foreground/60 italic text-center py-6">Nenhum funcionário disponível</p>
        )}
        {filtrados.map(f => {
          const initials = f.nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => handleSelect(f.id)}
              className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-muted/50 border border-transparent hover:border-border transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/15 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                <span className="text-[10px] font-black text-primary">{initials}</span>
              </div>
              <div className="text-left min-w-0">
                <span className="text-sm font-black text-foreground block truncate uppercase leading-none mb-1">{f.nome}</span>
                {f.cargo && <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-bold">{f.cargo}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
