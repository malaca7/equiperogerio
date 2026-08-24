import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, Navigate, NavLink } from 'react-router-dom'
import { 
  Shield, Users, Key, ScrollText, AlertTriangle, ChevronLeft, 
  Settings2, Plus, Edit2, Copy, Trash2, Check, X, ChevronDown, 
  LayoutGrid, Info, Settings, HelpCircle, Lock, ArrowUp, 
  ArrowDown, GripVertical, BarChart3, ShieldAlert, CheckCircle2,
  Search, Eye, EyeOff, UserCog, Ban, MapPin, Palette, CalendarDays,
  Sun, Moon, LogIn, Clock, User, Save, ListFilter, Upload, RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { useTheme } from '../../contexts/ThemeContext'
import { useConfiguracao, useUpdateConfiguracao } from '../../hooks/useConfiguracoes'
import { cn } from '../../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { TopHeader } from '../../components/layout/TopHeader'

import type { Role, Permission, SystemPage, MenuConfig, MenuModuleConfig, MenuPageConfig } from '../../lib/auth.types'
import { 
  SYSTEM_PAGES, PAGE_LABELS, ACTION_LABELS, VISUAL_PANELS, 
  DEFAULT_PAINEIS_PAGINAS, DEFAULT_MENU_CONFIG
} from '../../lib/auth.types'
import { useMenuConfig, useSaveMenuConfig } from '../../hooks/useMenuConfig'

// Types
interface UserWithRoles {
  id: string; cpf: string; nome: string; email: string | null; ativo: boolean
  ultimo_login: string | null; created_at: string
  roles: Pick<Role, 'id' | 'nome' | 'cor'>[]
}
export interface Localidade { id: string; nome: string; setor: string; equipe_id?: string | null }
export interface TipoEscala { id: string; letra: string; nome: string; bg: string; text: string; ring: string }
export interface Feriado { id: string; nome: string; data: string }
export interface Regiao { id: string; nome: string; descricao: string | null; cor: string; ativo: boolean }

// Constants
const USERS_KEY = ['admin-users']
const ROLES_KEY = ['roles']
const PERMS_KEY = ['permissions']
const REGIAO_COLORS = ['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
export const DEFAULT_SETORES = ['Varrição', 'Orla', 'Porta a Porta']
export const DEFAULT_LOCALIDADES: Localidade[] = [
  { id: 'v1', nome: 'Suape', setor: 'Varrição' },
  { id: 'v2', nome: 'Av Laura Cavalcante', setor: 'Varrição' },
  { id: 'v3', nome: 'Enseadas', setor: 'Varrição' },
  { id: 'v4', nome: 'Itapuama', setor: 'Varrição' },
  { id: 'v5', nome: 'Estrada Velha', setor: 'Varrição' },
  { id: 'v6', nome: 'Anel Viário', setor: 'Varrição' },
  { id: 'v7', nome: 'Xaréu', setor: 'Varrição' },
  { id: 'v8', nome: 'PE-28 Gaibu', setor: 'Varrição' },
  { id: 'o1', nome: 'Gaibu', setor: 'Orla' },
  { id: 'o2', nome: 'Itapuama', setor: 'Orla' },
  { id: 'o3', nome: 'Suape', setor: 'Orla' },
  { id: 'p1', nome: 'Geral', setor: 'Porta a Porta' },
]
export const DEFAULT_TIPOS_ESCALA: TipoEscala[] = [
  { id: 'presente', letra: 'T', nome: 'Trabalho', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' },
  { id: 'hora_extra', letra: 'HE', nome: 'Hora Extra', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' },
  { id: 'repouso', letra: 'R', nome: 'Repouso / Descanso', bg: 'bg-amber-400', text: 'text-amber-900', ring: 'ring-amber-300' },
  { id: 'compensar', letra: 'F', nome: 'Folga', bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400' },
  { id: 'ferias', letra: 'FE', nome: 'Férias', bg: 'bg-purple-500', text: 'text-white', ring: 'ring-purple-400' },
  { id: 'atestado', letra: 'A', nome: 'Atestado', bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-400' },
  { id: 'afastamento', letra: 'AF', nome: 'Afastamento', bg: 'bg-orange-950', text: 'text-white', ring: 'ring-orange-800' },
  { id: 'falta', letra: 'X', nome: 'Falta', bg: 'bg-rose-600', text: 'text-white', ring: 'ring-rose-500' },
  { id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' },
]
const COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400' },
  { bg: 'bg-amber-400', text: 'text-amber-900', ring: 'ring-amber-300' },
  { bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-400' },
  { bg: 'bg-rose-600', text: 'text-white', ring: 'ring-rose-500' },
  { bg: 'bg-purple-500', text: 'text-white', ring: 'ring-purple-400' },
  { bg: 'bg-orange-500', text: 'text-white', ring: 'ring-orange-400' },
  { bg: 'bg-sky-500', text: 'text-white', ring: 'ring-sky-400' },
]

export const PALETTE_COLORS = [
  { name: 'Azul', baseColor: 'blue-500', darkColor: 'blue-400', textLight: 'text-white', textDark: 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/5' },
  { name: 'Esmeralda', baseColor: 'emerald-500', darkColor: 'emerald-400', textLight: 'text-white', textDark: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5' },
  { name: 'Âmbar', baseColor: 'amber-400', darkColor: 'amber-300', textLight: 'text-amber-950', textDark: 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/5' },
  { name: 'Laranja', baseColor: 'orange-500', darkColor: 'orange-400', textLight: 'text-white', textDark: 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/5' },
  { name: 'Vermelho', baseColor: 'red-500', darkColor: 'red-400', textLight: 'text-white', textDark: 'text-red-600 dark:text-red-400 hover:bg-red-500/5' },
  { name: 'Rosa', baseColor: 'rose-500', darkColor: 'rose-400', textLight: 'text-white', textDark: 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/5' },
  { name: 'Violeta', baseColor: 'purple-500', darkColor: 'purple-400', textLight: 'text-white', textDark: 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/5' },
  { name: 'Índigo', baseColor: 'indigo-500', darkColor: 'indigo-400', textLight: 'text-white', textDark: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5' },
  { name: 'Ciano', baseColor: 'sky-500', darkColor: 'sky-400', textLight: 'text-white', textDark: 'text-sky-600 dark:text-sky-400 hover:bg-sky-500/5' },
  { name: 'Teal', baseColor: 'teal-500', darkColor: 'teal-400', textLight: 'text-white', textDark: 'text-teal-600 dark:text-teal-400 hover:bg-teal-500/5' },
  { name: 'Cinza', baseColor: 'slate-500', darkColor: 'slate-400', textLight: 'text-white', textDark: 'text-slate-600 dark:text-slate-400 hover:bg-slate-500/5' },
]

export function AdminDashboard() {
  const { isAdmin, user, hasPermission } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'cargos'

  const canAccessAdmin = isAdmin || hasPermission('admin', 'gerenciar')
  if (!canAccessAdmin) return <Navigate to="/" replace />

  // Tab Navigation items
  const tabsList = [
    { id: 'cargos', icon: Shield, label: 'Cargos e Matriz' },
    { id: 'modulos', icon: LayoutGrid, label: 'Telas e Módulos' },
    { id: 'parametros', icon: Settings, label: 'Parâmetros' },
    { id: 'auditoria', icon: ScrollText, label: 'Auditoria' },
  ]

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Painel de Controle" subtitle="Gestão Geral, Segurança e Parâmetros" />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">
        {/* Admin Navigation Pills */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <NavLink to="/" className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </NavLink>
          <div className="w-px h-6 bg-border/50 mx-1 shrink-0" />
          {tabsList.map(t => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ tab: t.id })}
              className={cn(
                "shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === t.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content rendered conditionally for optimal performance & clean mount */}
        <div className="space-y-6">
          {activeTab === 'cargos' && <TabCargos />}
          {activeTab === 'modulos' && <TabModulos />}
          {activeTab === 'parametros' && <TabParametros />}
          {activeTab === 'auditoria' && <TabAuditoria />}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: CARGOS & MATRIZ DE ACESSO
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_ACTION_DESCRIPTIONS: Record<string, { view: string, manage: string }> = {
  dashboard: { view: 'Ver métricas e indicadores globais', manage: 'Configurar indicadores do painel' },
  dashboard_producao: { view: 'Ver métricas da produção', manage: 'Configurar painel de produção' },
  funcionarios: { view: 'Listar colaboradores ativos e inativos', manage: 'Adicionar, editar e demitir funcionários' },
  equipes: { view: 'Ver estrutura das equipes e membros', manage: 'Criar equipes e alocar encarregados' },
  frequencia: { view: 'Acompanhar chamada diária', manage: 'Realizar ou alterar presenças/faltas' },
  escala: { view: 'Ver a escala de trabalho', manage: 'Definir turnos, folgas e realocar na grade' },
  localidades: { view: 'Ver distribuição por localidades', manage: 'Alterar e organizar escala de locais' },
  atestados: { view: 'Ver histórico de atestados', manage: 'Lançar, editar e validar atestados' },
  observacoes: { view: 'Ver histórico de advertências', manage: 'Registrar advertências e condutas' },
  rendimento: { view: 'Ver métricas de produtividade', manage: 'Registrar pontuações e métricas' },
  notificacoes: { view: 'Ler comunicados do sistema', manage: 'Disparar e gerir notificações ativas' },
  admin: { view: 'Acessar painel de controle global', manage: 'Acesso total: configurações, segurança e cargos' },
  usuarios: { view: 'Visualizar lista de usuários e cargos', manage: 'Adicionar, editar, bloquear e excluir usuários' },
  estoque: { view: 'Painel e resumos de estoque', manage: 'Acessar indicadores operacionais' },
  estoque_produtos: { view: 'Listar produtos e insumos', manage: 'Cadastrar, editar e inativar catálogo' },
  estoque_movimentacoes: { view: 'Acompanhar entradas e saídas', manage: 'Realizar ou reverter movimentações' },
  estoque_cautelas: { view: 'Ver EPIs e Ferramentas em uso', manage: 'Emitir, recolher ou baixar cautelas' },
  estoque_solicitacoes: { view: 'Acompanhar transferências e pedidos', manage: 'Aprovar ou recusar solicitações' },
  estoque_regioes: { view: 'Listar polos/regiões operacionais', manage: 'Adicionar e configurar regiões' },
  estoque_locais: { view: 'Listar locais de armazenagem', manage: 'Criar galpões e almoxarifados' },
  estoque_retirada: { view: 'Acessar leitura de código de barras', manage: 'Processar retiradas dinâmicas' },
  estoque_alertas: { view: 'Acompanhar itens com baixo estoque', manage: 'Configurar níveis de estoque mínimo' },
  estoque_auditoria: { view: 'Consultar logs de estoque imutáveis', manage: 'Gerar e assinar auditorias' },
  frota: { view: 'Acessar painel geral da frota', manage: 'Acessar indicadores operacionais e custos' },
  frota_veiculos: { view: 'Listar veículos', manage: 'Cadastrar e editar frota' },
  frota_registros: { view: 'Lançar KM próprio', manage: 'Lançar e editar diário de bordo de todos' },
  frota_abastecimentos: { view: 'Lançar abastecimento próprio', manage: 'Gerenciar abastecimentos e valores' },
  frota_manutencoes: { view: 'Ver alertas e manutenções', manage: 'Registrar trocas de óleo e revisões' },
}

function PermissionToggle({ val, onChange }: { val: 'none' | 'view' | 'manage', onChange: (v: 'none' | 'view' | 'manage') => void }) {
  return (
    <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40 shrink-0 mx-auto w-fit gap-1">
      <button 
        type="button"
        onClick={() => onChange('none')} 
        title="Nenhum Acesso"
        className={cn("w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all rounded-lg", val === 'none' ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10")}
      >
        <Ban className="w-4 h-4" />
      </button>
      <button 
        type="button"
        onClick={() => onChange('view')} 
        title="Apenas Leitura"
        className={cn("w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all rounded-lg", val === 'view' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/10")}
      >
        <Eye className="w-4 h-4" />
      </button>
      <button 
        type="button"
        onClick={() => onChange('manage')} 
        title="Controle Total"
        className={cn("w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all rounded-lg", val === 'manage' ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "text-muted-foreground/40 hover:text-emerald-500 hover:bg-emerald-500/10")}
      >
        <Shield className="w-4 h-4" />
      </button>
    </div>
  )
}

function TabCargos() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [roleTab, setRoleTab] = useState<'lista' | 'matriz'>('lista')
  const [createModal, setCreateModal] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#6366f1', nivel: 50 })
  const { reloadSession } = useAuth()

  const { data: menuConfig } = useMenuConfig(DEFAULT_MENU_CONFIG)

  const { data: roles = [], isLoading: loadRoles } = useQuery<Role[]>({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').order('nivel', { ascending: false })
      return data || []
    },
  })

  const { data: allPerms = [] } = useQuery<Permission[]>({
    queryKey: [...PERMS_KEY, menuConfig],
    queryFn: async () => {
      let { data } = await supabase.from('permissions').select('*').order('pagina')
      if (!data) data = []

      // Load dynamic pages from menu_config (also includes SYSTEM_PAGES for backward compat)
      const dynamicPages = new Set<string>()
      for (const page of SYSTEM_PAGES) dynamicPages.add(page)
      if (menuConfig) {
        for (const mod of menuConfig.modulos) {
          for (const pag of mod.paginas) dynamicPages.add(pag.id)
        }
      }

      // AUTO-SYNC PERMISSIONS
      const missingInserts: any[] = []
      for (const page of dynamicPages) {
        const hasView = data.some(p => p.pagina === page && p.acao === 'visualizar')
        const hasManage = data.some(p => p.pagina === page && p.acao === 'gerenciar')
        
        if (!hasView) missingInserts.push({ pagina: page, acao: 'visualizar' })
        if (!hasManage) missingInserts.push({ pagina: page, acao: 'gerenciar' })
      }

      if (missingInserts.length > 0) {
        await supabase.from('permissions').insert(missingInserts)
        const refetch = await supabase.from('permissions').select('*').order('pagina')
        data = refetch.data || []
      }

      return data
    },
  })

  const { data: rpData = [], isLoading: loadRP } = useQuery<{ role_id: string; permission_id: string }[]>({
    queryKey: ['all-role-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('role_permissions').select('role_id, permission_id')
      return data || []
    }
  })

  const setRolePageLevel = async (roleId: string, page: string, level: 'none' | 'view' | 'manage') => {
    const pagePerms = allPerms.filter(p => p.pagina === page)
    const permView = pagePerms.find(p => p.acao === 'visualizar')
    const permManage = pagePerms.find(p => p.acao === 'gerenciar')

    const idsToDelete = [permView?.id, permManage?.id].filter(Boolean) as string[]
    if (idsToDelete.length > 0) {
      await supabase.from('role_permissions').delete().eq('role_id', roleId).in('permission_id', idsToDelete)
    }

    const inserts = []
    if ((level === 'view' || level === 'manage') && permView) inserts.push({ role_id: roleId, permission_id: permView.id })
    if (level === 'manage' && permManage) inserts.push({ role_id: roleId, permission_id: permManage.id })

    if (inserts.length > 0) {
      await supabase.from('role_permissions').insert(inserts)
    }

    qc.invalidateQueries({ queryKey: ['all-role-permissions'] })
    reloadSession()
    toast('Permissão do cargo atualizada!', 'success')
  }

  const createMut = useMutation({
    mutationFn: async () => {
      await supabase.from('roles').insert(form)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); setCreateModal(false); toast('Cargo criado!', 'success') },
    onError: (e: any) => toast(e.message, 'error')
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editRole) return
      await supabase.from('roles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editRole.id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); setEditRole(null); toast('Cargo atualizado!', 'success') },
    onError: (e: any) => toast(e.message, 'error')
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('roles').delete().eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); toast('Cargo removido!', 'success') },
    onError: (e: any) => toast(e.message, 'error')
  })

  const movePriority = async (role: Role, dir: 'up' | 'down') => {
    const idx = roles.findIndex(r => r.id === role.id)
    if (idx === -1) return
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= roles.length) return

    const targetRole = roles[targetIdx]
    const tempNivel = role.nivel
    await supabase.from('roles').update({ nivel: targetRole.nivel }).eq('id', role.id)
    await supabase.from('roles').update({ nivel: tempNivel }).eq('id', targetRole.id)

    qc.invalidateQueries({ queryKey: ROLES_KEY })
    toast('Hierarquia de cargos reordenada!', 'success')
  }

  const permsByPage = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      if (p.pagina === 'configuracoes') continue;
      if (!map.has(p.pagina)) map.set(p.pagina, [])
      map.get(p.pagina)!.push(p)
    }
    return map
  }, [allPerms])

  const flattenedPages = useMemo(() => {
    const pagesMap = new Map<string, { pageId: string; pageLabel: string }>()
    
    // Base pages that must always be configurable
    for (const pageId of SYSTEM_PAGES) {
      pagesMap.set(pageId, {
        pageId,
        pageLabel: PAGE_LABELS[pageId as keyof typeof PAGE_LABELS] || pageId
      })
    }
    
    // Add any extra dynamic pages from the menu configuration
    if (menuConfig) {
      for (const mod of menuConfig.modulos) {
        for (const pag of mod.paginas) {
          if (!pagesMap.has(pag.id)) {
            pagesMap.set(pag.id, { pageId: pag.id, pageLabel: pag.label })
          }
        }
      }
    }
    
    return Array.from(pagesMap.values())
  }, [menuConfig])

  if (loadRoles || loadRP) return <Loading text="Carregando cargos..." />

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-card/40 dark:bg-card/20 backdrop-blur-xl border border-border/40 rounded-[2rem] p-5 shadow-sm">
        <div className="flex gap-2">
          <button onClick={() => setRoleTab('lista')}
            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              roleTab === 'lista' ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
            )}>
            Lista de Cargos
          </button>
          <button onClick={() => setRoleTab('matriz')}
            className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              roleTab === 'matriz' ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
            )}>
            Matriz de Permissões
          </button>
        </div>
        <Button onClick={() => { setForm({ nome: '', descricao: '', cor: '#6366f1', nivel: 50 }); setCreateModal(true) }}
          className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-wider">
          <Plus className="w-4 h-4 mr-2" /> Novo Cargo
        </Button>
      </div>

      {roleTab === 'lista' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((r, i) => (
            <div key={r.id} className="bg-card/85 dark:bg-card/35 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm" style={{ backgroundColor: r.cor }}>
                  {r.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground truncate">{r.nome}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">Nível: {r.nivel}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-bold">{r.descricao || 'Sem descrição cadastrada'}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button disabled={i === 0} onClick={() => movePriority(r, 'up')} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-20 flex items-center justify-center">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button disabled={i === roles.length - 1} onClick={() => movePriority(r, 'down')} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-20 flex items-center justify-center">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => { setForm({ nome: r.nome, descricao: r.descricao || '', cor: r.cor, nivel: r.nivel }); setEditRole(r) }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 transition-all flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => { if (confirm(`Deseja remover o cargo ${r.nome}?`)) deleteMut.mutate(r.id) }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {roles.map(r => (
              <div key={r.id} className="bg-card/85 dark:bg-card/35 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-5 shadow-sm flex flex-col h-full max-h-[800px]">
                <div className="border-b border-border/30 pb-4 mb-4 flex items-center gap-4 shrink-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-md" style={{ backgroundColor: r.cor }}>
                    {r.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="text-base font-black text-foreground uppercase tracking-tight">{r.nome}</p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Nível: {r.nivel}</p>
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin flex-1">
                  {flattenedPages.map(({ pageId, pageLabel }) => {
                    const perms = permsByPage.get(pageId) || []
                    const label = PAGE_LABELS[pageId as keyof typeof PAGE_LABELS] || pageLabel
                    
                    const pView = perms.find(p => p.acao === 'visualizar')
                    const pManage = perms.find(p => p.acao === 'gerenciar')
                    const hasView = pView ? rpData.some(x => x.role_id === r.id && x.permission_id === pView.id) : false
                    const hasManage = pManage ? rpData.some(x => x.role_id === r.id && x.permission_id === pManage.id) : false

                    let val: 'none' | 'view' | 'manage' = 'none'
                    if (hasManage) val = 'manage'
                    else if (hasView) val = 'view'

                    return (
                      <div key={pageId} className="flex flex-col gap-3 p-4 bg-muted/30 rounded-2xl border border-border/30 transition-all hover:bg-muted/50 hover:border-border/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-black uppercase tracking-wider text-foreground block truncate" title={label}>
                              {label}
                            </span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest truncate mt-1 block">
                              {pageId}
                            </span>
                          </div>
                          <div className="shrink-0 self-start sm:self-center">
                            <PermissionToggle val={val} onChange={(newVal) => setRolePageLevel(r.id, pageId, newVal)} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
      )}

      {/* Cargo Modal */}
      <Modal open={createModal || !!editRole} onClose={() => { setCreateModal(false); setEditRole(null) }} title={editRole ? 'Editar Cargo' : 'Novo Cargo'}>
        <form onSubmit={e => { e.preventDefault(); editRole ? updateMut.mutate() : createMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Nome do Cargo *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
              placeholder="Ex: COORDENADOR" className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold uppercase outline-none focus:border-primary/40 text-foreground" required />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Descrição</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Responsável por gerir equipes..." className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40 text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Cor Visual</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} className="w-12 h-10 rounded-lg cursor-pointer bg-transparent" />
                <span className="text-xs font-bold text-muted-foreground uppercase">{form.cor}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Nível (0-100)</label>
              <input type="number" min={0} max={100} value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: +e.target.value }))}
                className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40 text-foreground" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreateModal(false); setEditRole(null) }} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: DISTRIBUIÇÃO DE PÁGINAS POR PAINÉIS
// ─────────────────────────────────────────────────────────────────────────────
function TabModulos() {
  const { toast } = useToast()
  const { reloadSession } = useAuth()
  const { data: dbMenuConfig, isLoading: menuLoading } = useMenuConfig(DEFAULT_MENU_CONFIG)
  const { mutateAsync: saveMenuConfig, isPending: saving } = useSaveMenuConfig()
  const { mutateAsync: savePaineis } = useUpdateConfiguracao()
  const { data: dbPaineisPaginas } = useConfiguracao<Record<string, string[]>>('paineis_paginas', DEFAULT_PAINEIS_PAGINAS)
  const [menuLocal, setMenuLocal] = useState<MenuConfig>(DEFAULT_MENU_CONFIG)
  const [editingMod, setEditingMod] = useState<MenuModuleConfig | null>(null)
  const [editingPag, setEditingPag] = useState<{ modId: string; page: MenuPageConfig } | null>(null)

  // Drag & Drop States
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null)
  const [draggedPage, setDraggedPage] = useState<{ modId: string; pageId: string } | null>(null)
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null)
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null)

  useEffect(() => {
    if (dbMenuConfig) {
      // 1. Enforce uniqueness: collect page IDs in active modules (scoped by module)
      const activePageKeys = new Set<string>()
      const cleanedModulos = (dbMenuConfig.modulos || []).map(mod => {
        const uniquePages: MenuPageConfig[] = []
        for (const pag of (mod.paginas || [])) {
          const key = `${mod.id}:${pag.id}`
          if (!activePageKeys.has(key)) {
            activePageKeys.add(key)
            uniquePages.push(pag)
          }
        }
        return { ...mod, paginas: uniquePages }
      })

      // 2. Gather inactive pages and avoid duplicates/already active
      const inactivePageKeys = new Set<string>()
      const cleanedInactivePaginas: { originalModId: string; page: MenuPageConfig }[] = []
      
      const inativos = dbMenuConfig.inativos || { modulos: [], paginas: [] }
      
      for (const entry of (inativos.paginas || [])) {
        const key = `${entry.originalModId}:${entry.page.id}`
        if (!activePageKeys.has(key) && !inactivePageKeys.has(key)) {
          inactivePageKeys.add(key)
          cleanedInactivePaginas.push(entry)
        }
      }

      // 3. Re-add all existing system pages that are completely missing
      // (neither present in active modules nor in inactive list)
      const allDefaultPages: { key: string; label: string; rota: string; icone: string; defaultModId: string; pageId: string }[] = []
      for (const m of DEFAULT_MENU_CONFIG.modulos) {
        for (const p of m.paginas) {
          allDefaultPages.push({
            key: `${m.id}:${p.id}`,
            pageId: p.id,
            label: p.label,
            rota: p.rota,
            icone: p.icone,
            defaultModId: m.id
          })
        }
      }

      // Sync and add missing pages directly into Inactives so they can be re-added
      for (const def of allDefaultPages) {
        if (!activePageKeys.has(def.key) && !inactivePageKeys.has(def.key)) {
          inactivePageKeys.add(def.key)
          cleanedInactivePaginas.push({
            originalModId: def.defaultModId,
            page: {
              id: def.pageId,
              label: def.label,
              rota: def.rota,
              icone: def.icone,
              ordem: cleanedInactivePaginas.length + 1
            }
          })
        }
      }

      setMenuLocal({
        modulos: cleanedModulos,
        inativos: {
          modulos: inativos.modulos || [],
          paginas: cleanedInactivePaginas
        }
      })
    }
  }, [dbMenuConfig])

  function restoreDefaultMenuConfig() {
    if (!confirm('Deseja restaurar a estrutura de módulos e menus padrão do sistema? Todas as páginas serão organizadas em seus módulos originais de forma 100% única e limpa.')) {
      return
    }
    setMenuLocal({
      modulos: DEFAULT_MENU_CONFIG.modulos.map(m => ({
        ...m,
        paginas: m.paginas.map(p => ({ ...p }))
      })),
      inativos: { modulos: [], paginas: [] }
    })
    toast('Estrutura de menus restaurada! Clique em "Salvar Tudo" para persistir as alterações.', 'success')
  }

  function toggleModuleActive(modId: string) {
    setMenuLocal(prev => {
      const target = prev.modulos.find(m => m.id === modId)
      if (!target) return prev
      const newStatus = target.ativo === false ? true : false
      
      // If disabling the module, disable all of its pages as well!
      const updatedPaginas = target.paginas.map(p => ({
        ...p,
        ativo: newStatus ? p.ativo : false
      }))

      return {
        ...prev,
        modulos: prev.modulos.map(m => m.id === modId ? { ...m, ativo: newStatus, paginas: updatedPaginas } : m)
      }
    })
    toast('Status do módulo atualizado!', 'success')
  }

  function togglePageActive(modId: string, pagId: string) {
    setMenuLocal(prev => {
      const mod = prev.modulos.find(m => m.id === modId)
      if (!mod) return prev
      const page = mod.paginas.find(p => p.id === pagId)
      if (!page) return prev
      const newStatus = page.ativo === false ? true : false

      return {
        ...prev,
        modulos: prev.modulos.map(m => m.id === modId ? {
          ...m,
          paginas: m.paginas.map(p => p.id === pagId ? { ...p, ativo: newStatus } : p)
        } : m)
      }
    })
    toast('Status da página atualizado!', 'success')
  }

  function addModule() {
    const id = prompt('ID do módulo (ex: novo_modulo):')
    if (!id) return
    const label = prompt('Nome do módulo:')
    if (!label) return
    const novo: MenuModuleConfig = { id, label, icon: 'LayoutDashboard', ordem: menuLocal.modulos.length + 1, paginas: [] }
    setMenuLocal(prev => ({ 
      ...prev,
      modulos: [...prev.modulos, novo] 
    }))
  }

  function removeModule(modId: string) {
    const mod = menuLocal.modulos.find(m => m.id === modId)
    if (!mod) return
    if (!confirm(`Desativar módulo "${mod.label}"? Ele poderá ser reativado na seção de inativos.`)) return
    setMenuLocal(prev => {
      const inativos = prev.inativos || { modulos: [], paginas: [] }
      return {
        ...prev,
        modulos: prev.modulos.filter(m => m.id !== modId),
        inativos: {
          ...inativos,
          modulos: [...(inativos.modulos || []), mod]
        }
      }
    })
    toast('Módulo desativado e enviado para a seção de inativos!', 'success')
  }

  function moveModule(modId: string, dir: -1 | 1) {
    setMenuLocal(prev => {
      const idx = prev.modulos.findIndex(m => m.id === modId)
      if (idx === -1) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.modulos.length) return prev
      const items = [...prev.modulos]
      ;[items[idx], items[newIdx]] = [items[newIdx], items[idx]]
      items.forEach((m, i) => m.ordem = i + 1)
      return { ...prev, modulos: items }
    })
  }

  function updateModule(mod: MenuModuleConfig) {
    setMenuLocal(prev => ({
      ...prev,
      modulos: prev.modulos.map(m => m.id === mod.id ? mod : m),
    }))
    setEditingMod(null)
  }

  function addPage(modId: string) {
    const id = prompt('ID da página (ex: nova_pagina):')
    if (!id) return
    const label = prompt('Nome da página:')
    if (!label) return
    const rota = prompt('Rota (ex: /nova-pagina):')
    if (!rota) return
    const mod = menuLocal.modulos.find(m => m.id === modId)
    if (!mod) return
    const nova: MenuPageConfig = { id, label, rota, icone: 'LayoutDashboard', ordem: mod.paginas.length + 1 }
    setMenuLocal(prev => ({
      ...prev,
      modulos: prev.modulos.map(m => m.id === modId ? { ...m, paginas: [...m.paginas, nova] } : m),
    }))
  }

  function removePage(modId: string, pagId: string) {
    const mod = menuLocal.modulos.find(m => m.id === modId)
    if (!mod) return
    const page = mod.paginas.find(p => p.id === pagId)
    if (!page) return
    if (!confirm(`Desativar página "${page.label}"? Ela poderá ser reativada na seção de inativos.`)) return
    setMenuLocal(prev => {
      const inativos = prev.inativos || { modulos: [], paginas: [] }
      return {
        ...prev,
        modulos: prev.modulos.map(m => m.id === modId ? { ...m, paginas: m.paginas.filter(p => p.id !== pagId) } : m),
        inativos: {
          ...inativos,
          paginas: [...(inativos.paginas || []), { originalModId: modId, page }]
        }
      }
    })
    toast('Página desativada e enviada para a seção de inativos!', 'success')
  }

  function movePage(modId: string, pagId: string, dir: -1 | 1) {
    setMenuLocal(prev => {
      const mod = prev.modulos.find(m => m.id === modId)
      if (!mod) return prev
      const idx = mod.paginas.findIndex(p => p.id === pagId)
      if (idx === -1) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= mod.paginas.length) return prev
      const items = [...mod.paginas]
      ;[items[idx], items[newIdx]] = [items[newIdx], items[idx]]
      items.forEach((p, i) => p.ordem = i + 1)
      return { ...prev, modulos: prev.modulos.map(m => m.id === modId ? { ...m, paginas: items } : m) }
    })
  }

  // Reactive methods
  function reactivateModule(modId: string) {
    setMenuLocal(prev => {
      const inativos = prev.inativos || { modulos: [], paginas: [] }
      const mod = inativos.modulos?.find(m => m.id === modId)
      if (!mod) return prev

      const newInativosModulos = (inativos.modulos || []).filter(m => m.id !== modId)
      mod.ordem = prev.modulos.length + 1

      return {
        ...prev,
        modulos: [...prev.modulos, mod],
        inativos: { ...inativos, modulos: newInativosModulos }
      }
    })
    toast('Módulo reativado!', 'success')
  }

  function reactivatePage(pageId: string, originalModId: string) {
    const inativos = menuLocal.inativos || { modulos: [], paginas: [] }
    const inactiveEntry = inativos.paginas?.find(p => p.page.id === pageId && p.originalModId === originalModId)
    if (!inactiveEntry) return

    const availableMods = menuLocal.modulos
    if (availableMods.length === 0) {
      toast('Ative ou crie pelo menos um módulo primeiro!', 'error')
      return
    }

    const defaultMod = availableMods.some(m => m.id === originalModId) ? originalModId : availableMods[0].id
    const targetModId = prompt(
      `Restaurar no módulo (digite o ID):\nOpções disponíveis: ${availableMods.map(m => `${m.label} (${m.id})`).join(', ')}`,
      defaultMod
    )

    if (!targetModId) return
    const targetMod = availableMods.find(m => m.id === targetModId)
    if (!targetMod) {
      toast('Módulo digitado é inválido!', 'error')
      return
    }

    setMenuLocal(prev => {
      const prevInativos = prev.inativos || { modulos: [], paginas: [] }
      const newInativosPaginas = (prevInativos.paginas || []).filter(p => !(p.page.id === pageId && p.originalModId === originalModId))
      const page = inactiveEntry.page
      page.ordem = targetMod.paginas.length + 1

      return {
        ...prev,
        modulos: prev.modulos.map(m => m.id === targetModId ? { ...m, paginas: [...m.paginas, page] } : m),
        inativos: { ...prevInativos, paginas: newInativosPaginas }
      }
    })
    toast(`Página "${inactiveEntry.page.label}" restaurada no módulo "${targetMod.label}"!`, 'success')
  }

  function deleteModulePermanently(modId: string) {
    if (!confirm(`Excluir definitivamente o módulo "${modId}"? Esta ação é irreversível.`)) return
    setMenuLocal(prev => {
      const inativos = prev.inativos || { modulos: [], paginas: [] }
      return {
        ...prev,
        inativos: {
          ...inativos,
          modulos: (inativos.modulos || []).filter(m => m.id !== modId)
        }
      }
    })
    toast('Módulo excluído permanentemente!', 'success')
  }

  function deletePagePermanently(pageId: string, originalModId: string) {
    if (!confirm(`Excluir definitivamente a página "${pageId}" do módulo original "${originalModId}"? Esta ação é irreversível.`)) return
    setMenuLocal(prev => {
      const inativos = prev.inativos || { modulos: [], paginas: [] }
      return {
        ...prev,
        inativos: {
          ...inativos,
          paginas: (inativos.paginas || []).filter(p => !(p.page.id === pageId && p.originalModId === originalModId))
        }
      }
    })
    toast('Página excluída permanentemente!', 'success')
  }

  // Drag & Drop handlers
  function reorderModules(draggedId: string, targetId: string) {
    setMenuLocal(prev => {
      const items = [...prev.modulos]
      const draggedIdx = items.findIndex(m => m.id === draggedId)
      const targetIdx = items.findIndex(m => m.id === targetId)
      if (draggedIdx === -1 || targetIdx === -1) return prev

      const [draggedItem] = items.splice(draggedIdx, 1)
      items.splice(targetIdx, 0, draggedItem)

      items.forEach((m, i) => m.ordem = i + 1)
      return { ...prev, modulos: items }
    })
  }

  function reorderPages(modId: string, draggedId: string, targetId: string) {
    setMenuLocal(prev => {
      const mod = prev.modulos.find(m => m.id === modId)
      if (!mod) return prev
      const pages = [...mod.paginas]
      const draggedIdx = pages.findIndex(p => p.id === draggedId)
      const targetIdx = pages.findIndex(p => p.id === targetId)
      if (draggedIdx === -1 || targetIdx === -1) return prev

      const [draggedItem] = pages.splice(draggedIdx, 1)
      pages.splice(targetIdx, 0, draggedItem)

      pages.forEach((p, i) => p.ordem = i + 1)
      return {
        ...prev,
        modulos: prev.modulos.map(m => m.id === modId ? { ...m, paginas: pages } : m)
      }
    })
  }

  function movePageToModule(sourceModId: string, pageId: string, targetModId: string, targetPageId?: string) {
    setMenuLocal(prev => {
      const sourceMod = prev.modulos.find(m => m.id === sourceModId)
      const targetMod = prev.modulos.find(m => m.id === targetModId)
      if (!sourceMod || !targetMod) return prev

      const pageToMove = sourceMod.paginas.find(p => p.id === pageId)
      if (!pageToMove) return prev

      const newSourcePages = sourceMod.paginas.filter(p => p.id !== pageId)
      newSourcePages.forEach((p, i) => p.ordem = i + 1)

      const newTargetPages = [...targetMod.paginas]
      if (targetPageId) {
        const targetIdx = newTargetPages.findIndex(p => p.id === targetPageId)
        newTargetPages.splice(targetIdx >= 0 ? targetIdx : newTargetPages.length, 0, pageToMove)
      } else {
        newTargetPages.push(pageToMove)
      }
      newTargetPages.forEach((p, i) => p.ordem = i + 1)

      return {
        ...prev,
        modulos: prev.modulos.map(m => {
          if (m.id === sourceModId) return { ...m, paginas: newSourcePages }
          if (m.id === targetModId) return { ...m, paginas: newTargetPages }
          return m
        })
      }
    })
    toast('Página movida entre módulos!', 'success')
  }

  function handleDragStartModule(e: React.DragEvent, modId: string) {
    setDraggedModuleId(modId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', modId)
  }

  function handleDragOverModule(e: React.DragEvent, modId: string) {
    e.preventDefault()
    if (draggedModuleId && draggedModuleId !== modId) {
      setDragOverModuleId(modId)
    }
  }

  function handleDropModule(e: React.DragEvent, targetModId: string) {
    e.preventDefault()
    if (draggedModuleId && draggedModuleId !== targetModId) {
      reorderModules(draggedModuleId, targetModId)
    }
    setDraggedModuleId(null)
    setDragOverModuleId(null)
  }

  function handleDragStartPage(e: React.DragEvent, modId: string, pageId: string) {
    setDraggedPage({ modId, pageId })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${modId}:${pageId}`)
  }

  function handleDragOverPage(e: React.DragEvent, modId: string, pageId: string) {
    e.preventDefault()
    if (draggedPage && (draggedPage.modId !== modId || draggedPage.pageId !== pageId)) {
      setDragOverPageId(pageId)
    }
  }

  function handleDropPage(e: React.DragEvent, targetModId: string, targetPageId: string) {
    e.preventDefault()
    if (draggedPage) {
      if (draggedPage.modId === targetModId) {
        reorderPages(targetModId, draggedPage.pageId, targetPageId)
      } else {
        movePageToModule(draggedPage.modId, draggedPage.pageId, targetModId, targetPageId)
      }
    }
    setDraggedPage(null)
    setDragOverPageId(null)
  }

  function handleDragEnd() {
    setDraggedModuleId(null)
    setDraggedPage(null)
    setDragOverModuleId(null)
    setDragOverPageId(null)
  }

  async function saveAll() {
    try {
      await saveMenuConfig(menuLocal)
      // Sync paineis_paginas: map all active pages from menu configuration
      const paineisMap: Record<string, string[]> = { ...dbPaineisPaginas }
      for (const mod of menuLocal.modulos) {
        for (const pag of mod.paginas) {
          if (!paineisMap[pag.id]) paineisMap[pag.id] = []
          if (!paineisMap[pag.id].includes(mod.id)) paineisMap[pag.id].push(mod.id)
        }
      }
      await savePaineis({ chave: 'paineis_paginas', valor: paineisMap })
      await reloadSession()
      toast('Menu salvo!', 'success')
    } catch {
      toast('Erro ao salvar!', 'error')
    }
  }

  const AVAILABLE_ICONS = ['LayoutDashboard', 'Users', 'CalendarDays', 'MapPin', 'Clock', 'Activity', 'ShieldCheck', 'Building2', 'Hammer', 'HeartPulse', 'Truck', 'Package', 'Network', 'ScanBarcode', 'Bell', 'FileText', 'Navigation', 'Map', 'Settings', 'BarChart3', 'Eye', 'LogOut', 'ListFilter']

  if (menuLoading) return <Loading text="Carregando configuração de menus..." />

  return (
    <div className="space-y-6">
      {/* Editor de Módulos */}
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-border/50">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" /> Módulos e Menus
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-bold uppercase tracking-wider">
              Arraste os módulos ou páginas para mudar de posição ou mover entre módulos. Use salvar tudo para aplicar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button onClick={restoreDefaultMenuConfig} variant="secondary" className="flex-1 md:flex-none justify-center h-10 text-[11px] font-black uppercase tracking-wider">
              Restaurar Padrão
            </Button>
            <Button onClick={addModule} className="flex-1 md:flex-none justify-center h-10 text-[11px] font-black uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-1" /> Novo Módulo
            </Button>
            <Button onClick={saveAll} loading={saving} className="flex-1 md:flex-none justify-center h-10 text-[11px] font-black uppercase tracking-wider bg-primary text-white">
              <Save className="w-4 h-4 mr-1" /> Salvar Tudo
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {menuLocal.modulos
            .sort((a, b) => a.ordem - b.ordem)
            .map(mod => (
            <div 
              key={mod.id} 
              draggable
              onDragStart={(e) => handleDragStartModule(e, mod.id)}
              onDragOver={(e) => handleDragOverModule(e, mod.id)}
              onDrop={(e) => handleDropModule(e, mod.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "border rounded-2xl bg-muted/10 overflow-hidden transition-all duration-200",
                dragOverModuleId === mod.id ? "border-primary border-2 scale-[1.01] bg-primary/[0.02] shadow-[0_0_15px_rgba(99,102,241,0.1)]" : "border-border/50",
                draggedModuleId === mod.id ? "opacity-40 border-dashed" : "",
                mod.ativo === false ? "opacity-75 bg-muted/5 border-dashed border-rose-500/20" : ""
              )}
            >
              {/* Module header */}
              <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div 
                      className="p-1 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-all cursor-grab active:cursor-grabbing"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveModule(mod.id, -1)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Subir"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveModule(mod.id, 1)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Descer"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center border",
                    mod.ativo !== false 
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  )}>
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-foreground">{mod.label}</span>
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-wider block">{mod.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => toggleModuleActive(mod.id)} 
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border mr-1 active:scale-95 cursor-pointer shadow-sm",
                      mod.ativo !== false 
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                        : "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white"
                    )}
                  >
                    {mod.ativo !== false ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => setEditingMod(mod)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => addPage(mod.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Adicionar página"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeModule(mod.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Pages list */}
              <div 
                onDragOver={(e) => {
                  e.preventDefault()
                  if (draggedPage && draggedPage.modId !== mod.id) {
                    setDragOverModuleId(mod.id)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedPage && draggedPage.modId !== mod.id) {
                    movePageToModule(draggedPage.modId, draggedPage.pageId, mod.id)
                  }
                  setDraggedPage(null)
                  setDragOverModuleId(null)
                }}
                className={cn(
                  "p-3 space-y-1 transition-all duration-200 min-h-[4rem]",
                  draggedPage && draggedPage.modId !== mod.id && dragOverModuleId === mod.id ? "bg-primary/5 rounded-b-2xl border-t border-primary/20" : ""
                )}
              >
                {mod.paginas.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 italic text-center py-3">Nenhuma página (Arraste uma página para cá)</p>
                )}
                {mod.paginas
                  .sort((a, b) => a.ordem - b.ordem)
                  .map(pag => (
                  <div 
                    key={pag.id} 
                    draggable
                    onDragStart={(e) => handleDragStartPage(e, mod.id, pag.id)}
                    onDragOver={(e) => handleDragOverPage(e, mod.id, pag.id)}
                    onDrop={(e) => handleDropPage(e, mod.id, pag.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing",
                      dragOverPageId === pag.id ? "border-primary border-2 bg-primary/[0.02]" : "border-border/30",
                      draggedPage?.pageId === pag.id ? "opacity-40 border-dashed" : "",
                      pag.ativo === false ? "opacity-60 bg-muted/20 border-dashed border-rose-500/20" : ""
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/45 shrink-0" />
                      <div className="flex flex-col gap-0.5 mr-1">
                        <button onClick={() => movePage(mod.id, pag.id, -1)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"><ArrowUp className="w-2.5 h-2.5" /></button>
                        <button onClick={() => movePage(mod.id, pag.id, 1)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"><ArrowDown className="w-2.5 h-2.5" /></button>
                      </div>
                      <span className="text-xs font-bold text-foreground">{pag.label}</span>
                      <span className="text-[8px] text-muted-foreground/50 font-mono">{pag.rota}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => togglePageActive(mod.id, pag.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer shadow-sm",
                          pag.ativo !== false
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500 hover:text-white"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/25 hover:bg-rose-500 hover:text-white"
                        )}
                      >
                        {pag.ativo !== false ? 'On' : 'Off'}
                      </button>
                      <button onClick={() => setEditingPag({ modId: mod.id, page: pag })} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => removePage(mod.id, pag.id)} className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos e Menus Inativos */}
      {((menuLocal.inativos?.modulos && menuLocal.inativos.modulos.length > 0) || 
        (menuLocal.inativos?.paginas && menuLocal.inativos.paginas.length > 0)) && (
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
            <div>
              <h3 className="text-sm font-black text-rose-500 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <Ban className="w-5 h-5" /> Módulos e Menus Inativos
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-bold uppercase tracking-wider">
                Módulos e páginas que foram desativados. Eles não aparecem no menu, mas você pode reativá-los.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Módulos Inativos */}
            {menuLocal.inativos?.modulos && menuLocal.inativos.modulos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-muted-foreground/80 tracking-wider">Módulos Inativos</h4>
                <div className="space-y-2">
                  {menuLocal.inativos.modulos.map(mod => (
                    <div key={mod.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                          <LayoutGrid className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">{mod.label}</p>
                          <p className="text-[8px] font-bold text-muted-foreground/60 uppercase">{mod.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => reactivateModule(mod.id)} 
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
                        >
                          Reativar
                        </button>
                        <button 
                          onClick={() => deleteModulePermanently(mod.id)} 
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all" 
                          title="Excluir Permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Páginas Inativas */}
            {menuLocal.inativos?.paginas && menuLocal.inativos.paginas.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-muted-foreground/80 tracking-wider">Páginas Inativas</h4>
                <div className="space-y-2">
                  {menuLocal.inativos.paginas.map(entry => (
                    <div key={`${entry.originalModId}:${entry.page.id}`} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                          <EyeOff className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">{entry.page.label}</p>
                          <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">{entry.page.id} &bull; {entry.page.rota}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => reactivatePage(entry.page.id, entry.originalModId)} 
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
                        >
                          Reativar
                        </button>
                        <button 
                          onClick={() => deletePagePermanently(entry.page.id, entry.originalModId)} 
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all" 
                          title="Excluir Permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Módulo */}
      {editingMod && (
        <Modal open title="Editar Módulo" onClose={() => setEditingMod(null)}>
          <div className="space-y-3 p-1">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</label>
              <input value={editingMod.id} disabled className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-muted text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome</label>
              <input value={editingMod.label} onChange={e => setEditingMod({ ...editingMod, label: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ícone</label>
              <select value={editingMod.icon} onChange={e => setEditingMod({ ...editingMod, icon: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm">
                {AVAILABLE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button onClick={() => setEditingMod(null)}>Cancelar</Button>
              <Button onClick={() => updateModule(editingMod)} className="bg-primary text-white">Salvar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar Página */}
      {editingPag && (
        <Modal open title="Editar Página" onClose={() => setEditingPag(null)}>
          <div className="space-y-3 p-1">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</label>
              <input value={editingPag.page.id} disabled className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-muted text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome</label>
              <input value={editingPag.page.label} onChange={e => setEditingPag({ ...editingPag, page: { ...editingPag.page, label: e.target.value } })} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rota</label>
              <input value={editingPag.page.rota} onChange={e => setEditingPag({ ...editingPag, page: { ...editingPag.page, rota: e.target.value } })} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ícone</label>
              <select value={editingPag.page.icone} onChange={e => setEditingPag({ ...editingPag, page: { ...editingPag.page, icone: e.target.value } })} className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm">
                {AVAILABLE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button onClick={() => setEditingPag(null)}>Cancelar</Button>
              <Button onClick={() => {
                setMenuLocal(prev => ({
                  modulos: prev.modulos.map(m => m.id === editingPag.modId ? { ...m, paginas: m.paginas.map(p => p.id === editingPag.page.id ? editingPag.page : p) } : m),
                }))
                setEditingPag(null)
              }} className="bg-primary text-white">Salvar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: CONFIGURAÇÕES / PARÂMETROS GERAIS (Centralizado da antiga pagina)
// ─────────────────────────────────────────────────────────────────────────────
function TabParametros() {
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()
  const qc = useQueryClient()
  const updateConfig = useUpdateConfiguracao()

  // Dynamic branding settings
  const { data: platNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: platSlogan = 'GEstao Eficaz' } = useConfiguracao('plataforma_slogan', 'GEstao Eficaz')
  const { data: platLogoUrl = '' } = useConfiguracao('plataforma_logo_url', '')

  const [formPlat, setFormPlat] = useState({
    nome: platNome,
    slogan: platSlogan
  })
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  // sync local state when query finishes loading
  useEffect(() => {
    if (platNome) setFormPlat(p => ({ ...p, nome: platNome }))
  }, [platNome])
  useEffect(() => {
    if (platSlogan) setFormPlat(p => ({ ...p, slogan: platSlogan }))
  }, [platSlogan])

  const [savePlatLoading, setSavePlatLoading] = useState(false)

  const handleSavePlat = async () => {
    setSavePlatLoading(true)
    try {
      await updateConfig.mutateAsync({ chave: 'plataforma_nome', valor: formPlat.nome })
      await updateConfig.mutateAsync({ chave: 'plataforma_slogan', valor: formPlat.slogan })
      toast('Identidade visual da plataforma atualizada!', 'success')
      qc.invalidateQueries({ queryKey: ['configuracoes'] })
    } catch {
      toast('Erro ao salvar identidade!', 'error')
    } finally {
      setSavePlatLoading(false)
    }
  }
  
  // Local state sections
  const [subSection, setSubSection] = useState<'geral' | 'localidades' | 'setores' | 'cargos_func' | 'funcoes_eq' | 'regioes' | 'escalas' | 'feriados'>('geral')

  // Queries
  const { data: dbSetores, isLoading: loadS } = useConfiguracao<string[]>('setores', DEFAULT_SETORES)
  const { data: dbLocs, isLoading: loadL } = useConfiguracao<Localidade[]>('localidades', DEFAULT_LOCALIDADES)
  const { data: dbTipos, isLoading: loadT } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const { data: dbFeriados, isLoading: loadF } = useConfiguracao<Feriado[]>('feriados', [])
  const { data: dbSetoresEquipes } = useConfiguracao<Record<string, string[]>>('setores_equipes', {})
  const setoresEquipes = dbSetoresEquipes || {}

  const { data: equipesList = [] } = useQuery<any[]>({
    queryKey: ['equipes-list-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    }
  })

  const { data: regioes = [], isLoading: loadRegs } = useQuery<Regiao[]>({
    queryKey: ['regioes-config'],
    queryFn: async () => {
      const { data } = await supabase.from('regioes').select('*').order('nome')
      return data || []
    }
  })

  const setores = dbSetores || DEFAULT_SETORES
  const localidades = dbLocs || DEFAULT_LOCALIDADES
  const tipos = dbTipos || DEFAULT_TIPOS_ESCALA
  const feriados = dbFeriados || []

  // Mutations
  const saveSetores = (s: string[]) => updateConfig.mutate({ chave: 'setores', valor: s })
  const saveLocalidades = (l: Localidade[]) => updateConfig.mutate({ chave: 'localidades', valor: l })
  const saveTipos = (t: TipoEscala[]) => updateConfig.mutate({ chave: 'tipos_escala', valor: t })
  const saveFeriados = (f: Feriado[]) => updateConfig.mutate({ chave: 'feriados', valor: f })

  const { data: dbCargosFunc, isLoading: loadCargos } = useConfiguracao<string[]>('cargos_funcionarios', ['Encarregado', 'Gari', 'Motorista', 'Coletor'])
  const cargosFunc = dbCargosFunc || ['Encarregado', 'Gari', 'Motorista', 'Coletor']
  const saveCargosFunc = (c: string[]) => updateConfig.mutate({ chave: 'cargos_funcionarios', valor: c })

  const DEFAULT_FUNCOES = [
    { id: 'motorista', nome: 'Motorista', classes: 'bg-orange-500/15 border-orange-500/30', textClass: 'text-orange-600 dark:text-orange-400' },
    { id: 'rocador', nome: 'Roçador', classes: 'bg-emerald-500/15 border-emerald-500/30', textClass: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'varredor', nome: 'Varredor', classes: 'bg-blue-500/15 border-blue-500/30', textClass: 'text-blue-600 dark:text-blue-400' },
    { id: 'coletor', nome: 'Coletor', classes: 'bg-slate-500/15 border-slate-500/30', textClass: 'text-slate-600 dark:text-slate-400' },
  ]
  const { data: dbFuncoesEq, isLoading: loadFuncoes } = useConfiguracao<any[]>('funcoes_equipe', DEFAULT_FUNCOES)
  const funcoesEq = dbFuncoesEq || DEFAULT_FUNCOES
  const saveFuncoesEq = (f: any[]) => updateConfig.mutate({ chave: 'funcoes_equipe', valor: f })

  // Sector helpers
  const [newSetor, setNewSetor] = useState('')
  const [editingSetorIdx, setEditingSetorIdx] = useState<number | null>(null)
  const [editingSetorVal, setEditingSetorVal] = useState('')
  
  const addSetor = () => {
    if (!newSetor.trim() || setores.includes(newSetor.trim())) return
    saveSetores([...setores, newSetor.trim()])
    setNewSetor('')
    toast('Setor criado!', 'success')
  }
  const removeSetor = (s: string) => {
    saveSetores(setores.filter(x => x !== s))
    saveLocalidades(localidades.filter(l => l.setor !== s))
    toast('Setor removido!', 'success')
  }
  const saveEditSetor = (idx: number) => {
    if (!editingSetorVal.trim()) return
    const updated = [...setores]
    const oldName = updated[idx]
    updated[idx] = editingSetorVal.trim()
    saveSetores(updated)
    saveLocalidades(localidades.map(l => l.setor === oldName ? { ...l, setor: editingSetorVal.trim() } : l))
    setEditingSetorIdx(null)
    setEditingSetorVal('')
    toast('Setor atualizado!', 'success')
  }

  // Cargos helpers
  const [newCargoFunc, setNewCargoFunc] = useState('')
  const [editingCargoFuncIdx, setEditingCargoFuncIdx] = useState<number | null>(null)
  const [editingCargoFuncVal, setEditingCargoFuncVal] = useState('')

  const addCargoFunc = () => {
    if (!newCargoFunc.trim() || cargosFunc.includes(newCargoFunc.trim())) return
    saveCargosFunc([...cargosFunc, newCargoFunc.trim()])
    setNewCargoFunc('')
    toast('Cargo criado!', 'success')
  }
  const removeCargoFunc = (c: string) => {
    saveCargosFunc(cargosFunc.filter(x => x !== c))
    toast('Cargo removido!', 'success')
  }
  const saveEditCargoFunc = (idx: number) => {
    if (!editingCargoFuncVal.trim()) return
    const updated = [...cargosFunc]
    updated[idx] = editingCargoFuncVal.trim()
    saveCargosFunc(updated)
    setEditingCargoFuncIdx(null)
    toast('Cargo atualizado!', 'success')
  }

  // Funções helpers
  const [newFuncaoEq, setNewFuncaoEq] = useState({ nome: '', corIndex: 0 })
  const [editingFuncaoEq, setEditingFuncaoEq] = useState<any | null>(null)

  const addFuncaoEq = () => {
    if (!newFuncaoEq.nome.trim()) return
    const palette = PALETTE_COLORS[newFuncaoEq.corIndex]
    const id = editingFuncaoEq ? editingFuncaoEq.id : newFuncaoEq.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const newF = {
      id,
      nome: newFuncaoEq.nome.trim(),
      classes: `bg-${palette.baseColor}/15 border-${palette.baseColor}/30`,
      textClass: `text-${palette.baseColor.replace('500', '600')} dark:text-${palette.darkColor}`
    }

    if (editingFuncaoEq) {
      saveFuncoesEq(funcoesEq.map((f: any) => f.id === id ? newF : f))
      setEditingFuncaoEq(null)
      toast('Função atualizada!', 'success')
    } else {
      saveFuncoesEq([...funcoesEq, newF])
      toast('Função criada!', 'success')
    }
    setNewFuncaoEq({ nome: '', corIndex: 0 })
  }

  const removeFuncaoEq = (id: string) => {
    saveFuncoesEq(funcoesEq.filter((f: any) => f.id !== id))
    toast('Função removida!', 'success')
  }

  // Locality helpers
  const [newLoc, setNewLoc] = useState({ nome: '', setor: '', equipe_id: '' })
  const [editLoc, setEditLoc] = useState<Localidade | null>(null)

  const addLocality = () => {
    if (!newLoc.nome.trim() || !newLoc.setor) return
    saveLocalidades([...localidades, {
      id: `loc_${Date.now()}`,
      nome: newLoc.nome.trim(),
      setor: newLoc.setor,
      equipe_id: newLoc.equipe_id || null
    }])
    setNewLoc({ nome: '', setor: '', equipe_id: '' })
    toast('Localidade adicionada!', 'success')
  }
  const removeLocality = (id: string) => {
    saveLocalidades(localidades.filter(l => l.id !== id))
    toast('Localidade removida!', 'success')
  }
  const saveEditLoc = () => {
    if (!editLoc || !editLoc.nome.trim()) return
    saveLocalidades(localidades.map(l => l.id === editLoc.id ? editLoc : l))
    setEditLoc(null)
    toast('Localidade atualizada!', 'success')
  }

  // Region mutations
  const [editRegiao, setEditRegiao] = useState<Regiao | null>(null)
  const [regiaoForm, setRegiaoForm] = useState({ nome: '', descricao: '', cor: REGIAO_COLORS[0] })

  const saveRegiaoMut = useMutation({
    mutationFn: async () => {
      if (editRegiao) {
        await supabase.from('regioes').update({
          nome: regiaoForm.nome, descricao: regiaoForm.descricao || null, cor: regiaoForm.cor
        }).eq('id', editRegiao.id)
      } else {
        await supabase.from('regioes').insert({
          nome: regiaoForm.nome, descricao: regiaoForm.descricao || null, cor: regiaoForm.cor
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regioes-config'] })
      setEditRegiao(null)
      setRegiaoForm({ nome: '', descricao: '', cor: REGIAO_COLORS[0] })
      toast(editRegiao ? 'Região atualizada!' : 'Região criada!', 'success')
    }
  })

  // Escalas mutations
  const [newTipo, setNewTipo] = useState({ letra: '', nome: '', corIndex: 0, transparent: false })
  const [editingTipo, setEditingTipo] = useState<TipoEscala | null>(null)

  const addTipo = () => {
    if (!newTipo.letra.trim() || !newTipo.nome.trim()) return
    const palette = PALETTE_COLORS[newTipo.corIndex]
    
    // Assemble modern styling properties dynamically!
    const bgClass = newTipo.transparent
      ? `bg-transparent border border-dashed border-${palette.baseColor}/30 dark:border-${palette.darkColor}/20 hover:bg-${palette.baseColor}/5`
      : `bg-${palette.baseColor}`
      
    const textClass = newTipo.transparent
      ? palette.textDark
      : palette.textLight
      
    const ringClass = `ring-${palette.darkColor}`

    const newModel: TipoEscala = {
      id: editingTipo ? editingTipo.id : newTipo.nome.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      letra: newTipo.letra.toUpperCase(),
      nome: newTipo.nome,
      bg: bgClass,
      text: textClass,
      ring: ringClass
    }

    if (editingTipo) {
      saveTipos(tipos.map(t => t.id === editingTipo.id ? newModel : t))
      setEditingTipo(null)
      toast('Tipo de escala atualizado!', 'success')
    } else {
      saveTipos([...tipos, newModel])
      toast('Tipo de escala adicionado!', 'success')
    }
    setNewTipo({ letra: '', nome: '', corIndex: 0, transparent: false })
  }

  const moveTipo = (id: string, dir: 'up' | 'down') => {
    const idx = tipos.findIndex(t => t.id === id)
    if (idx === -1) return
    const newTipos = [...tipos]
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= tipos.length) return
    const temp = newTipos[idx]
    newTipos[idx] = newTipos[targetIdx]
    newTipos[targetIdx] = temp
    saveTipos(newTipos)
  }

  // Feriados helpers
  const [newFeriado, setNewFeriado] = useState({ nome: '', data: '' })
  const addFeriado = () => {
    if (!newFeriado.nome.trim() || !newFeriado.data) return
    saveFeriados([...feriados, { id: `fer_${Date.now()}`, nome: newFeriado.nome, data: newFeriado.data }])
    setNewFeriado({ nome: '', data: '' })
    toast('Feriado adicionado!', 'success')
  }
  const removeFeriado = (id: string) => {
    saveFeriados(feriados.filter(f => f.id !== id))
    toast('Feriado removido!', 'success')
  }

  const inp = "w-full px-3.5 py-2.5 text-xs bg-muted/30 border border-border/40 rounded-xl focus:outline-none focus:border-primary/40 text-foreground font-semibold placeholder:text-muted-foreground/60 transition-all"
  const sel = "px-3.5 py-2.5 text-xs bg-card border border-border/40 rounded-xl focus:outline-none focus:border-primary/40 text-foreground font-semibold cursor-pointer"

  if (loadS || loadL || loadT || loadF || loadRegs) return <Loading text="Buscando parâmetros do sistema..." />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sub menu navigation */}
      <div className="lg:col-span-1 bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-5 space-y-2 h-fit">
        <h4 className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider mb-4 px-2">Subseções</h4>
        {[
          { id: 'geral' as const, label: 'Preferências e Tema', icon: Settings },
          { id: 'cargos_func' as const, label: 'Cargos de Funcionários', icon: UserCog },
          { id: 'setores' as const, label: 'Setor de Funcionários', icon: Users },
          { id: 'funcoes_eq' as const, label: 'Função da Equipe', icon: UserCog },
          { id: 'localidades' as const, label: 'Localidades de Trabalho', icon: MapPin },
          { id: 'regioes' as const, label: 'Regiões e Divisões', icon: MapPin },
          { id: 'escalas' as const, label: 'Legendas de Escala', icon: Palette },
          { id: 'feriados' as const, label: 'Feriados Oficiais', icon: CalendarDays },
        ].map(item => (
          <button key={item.id} onClick={() => setSubSection(item.id)}
            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-left transition-all",
              subSection === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
            )}>
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main configuration pane */}
      <div className="lg:col-span-3 bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-sm">
        
        {/* SUB SECTION: GERAL & THEME */}
        {subSection === 'geral' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Preferências e Identidade Visual</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Ajustes gerais do aplicativo</p>
            </div>
            
            <div className="p-5 bg-muted/20 border border-border/40 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-foreground uppercase block">Tema da Interface</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Alternar entre modo escuro ou claro global</span>
              </div>
              <button onClick={toggleTheme} className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>

            {/* Branding Settings Card */}
            <div className="p-6 bg-muted/15 border border-border/40 rounded-3xl space-y-4">
              <div>
                <span className="text-xs font-black text-foreground uppercase block">Identidade Visual da Plataforma</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Configure o nome, slogan e logotipo do sistema</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Nome da Plataforma</label>
                  <input
                    type="text"
                    value={formPlat.nome}
                    onChange={e => setFormPlat(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: 7Locar"
                    className="w-full px-4 py-3 bg-card border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40 text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Slogan / Subtítulo</label>
                  <input
                    type="text"
                    value={formPlat.slogan}
                    onChange={e => setFormPlat(prev => ({ ...prev, slogan: e.target.value }))}
                    placeholder="Ex: Gestão Eficaz"
                    className="w-full px-4 py-3 bg-card border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40 text-foreground"
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Logotipo da Plataforma</label>
                <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">A mesma imagem será usada como logotipo no painel e como ícone (favicon) no navegador</p>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIsUploadingLogo(true)
                        try {
                          const file = e.target.files[0]
                          const fileExt = file.name.split('.').pop()
                          const filePath = `branding/logo.${fileExt}`
                          
                          const { error: uploadError } = await supabase.storage.from('branding').upload(filePath, file, { upsert: true })
                          if (uploadError) throw uploadError
                          
                          const { data } = supabase.storage.from('branding').getPublicUrl(filePath)
                          const publicUrl = data.publicUrl
                          
                          await updateConfig.mutateAsync({ chave: 'plataforma_logo_url', valor: publicUrl })
                          await updateConfig.mutateAsync({ chave: 'plataforma_icon_url', valor: publicUrl })
                          toast('Logotipo atualizado com sucesso!', 'success')
                        } catch (err: any) {
                          toast('Erro ao fazer upload: ' + err.message, 'error')
                        } finally {
                          setIsUploadingLogo(false)
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full px-4 py-6 bg-muted/40 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                    {platLogoUrl ? (
                      <div className="relative">
                        <img src={platLogoUrl} alt="Logotipo" className="h-24 object-contain rounded-xl shadow-md border border-border" />
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-1">
                          <Upload className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Selecionar imagem do logotipo</p>
                        <p className="text-[10px] text-muted-foreground/50">PNG, JPG ou SVG recomendados</p>
                      </>
                    )}
                    {isUploadingLogo && <p className="text-xs text-primary font-black animate-pulse mt-1">Carregando imagem...</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSavePlat}
                  loading={savePlatLoading}
                  className="h-11 px-6 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40"
                >
                  Salvar Identidade
                </Button>
              </div>
            </div>

            <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-rose-500 uppercase block">Restaurar Configurações</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Redefinir todas as variáveis do sistema para o padrão inicial</span>
              </div>
              <Button variant="secondary" onClick={() => {
                if (confirm('Restaurar tudo ao padrão de fábrica? Isso limpará setores, feriados e tipos personalizados.')) {
                  saveSetores(DEFAULT_SETORES)
                  saveLocalidades(DEFAULT_LOCALIDADES)
                  saveTipos(DEFAULT_TIPOS_ESCALA)
                  saveFeriados([])
                  toast('Restaurado!', 'success')
                }
              }} className="h-10 text-[9px] font-black uppercase text-rose-500 border border-rose-500/20 hover:bg-rose-500/10">
                Restaurar
              </Button>
            </div>
          </div>
        )}

        {/* SUB SECTION: LOCALIDADES */}
        {subSection === 'localidades' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Localidades de Trabalho</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{localidades.length} locais de trabalho ativos</p>
              </div>
            </div>

            {/* Nova localidade inline */}
            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input type="text" placeholder="Nome do local..." value={newLoc.nome} onChange={e => setNewLoc({ ...newLoc, nome: e.target.value })} className={inp} />
              <select value={newLoc.setor} onChange={e => setNewLoc({ ...newLoc, setor: e.target.value })} className={sel}>
                <option value="">Setor...</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={newLoc.equipe_id || ''} onChange={e => setNewLoc({ ...newLoc, equipe_id: e.target.value })} className={sel}>
                <option value="">Equipe (opcional)...</option>
                {equipesList.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </select>
              <Button onClick={addLocality} className="h-full rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-wider">
                Adicionar
              </Button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {localidades.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3.5 bg-card border border-border/40 rounded-xl">
                  {editLoc?.id === l.id ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input type="text" value={editLoc.nome} onChange={e => setEditLoc({ ...editLoc, nome: e.target.value })} className={inp} />
                      <select value={editLoc.setor} onChange={e => setEditLoc({ ...editLoc, setor: e.target.value })} className={sel}>
                        {setores.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={editLoc.equipe_id || ''} onChange={e => setEditLoc({ ...editLoc, equipe_id: e.target.value || null })} className={sel}>
                        <option value="">Sem Equipe</option>
                        {equipesList.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <button onClick={saveEditLoc} className="flex-1 bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase py-1">OK</button>
                        <button onClick={() => setEditLoc(null)} className="flex-1 bg-muted border rounded-lg text-xs font-bold uppercase py-1 text-foreground">X</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <span className="text-xs font-black text-foreground block">{l.nome}</span>
                          <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">{l.setor}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {l.equipe_id && (
                          <span className="px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: equipesList.find(e => e.id === l.equipe_id)?.cor || '#6366f1' }}>
                            {equipesList.find(e => e.id === l.equipe_id)?.nome}
                          </span>
                        )}
                        <button onClick={() => setEditLoc(l)} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-center transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removeLocality(l.id)} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: SETORES */}
        {subSection === 'setores' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Setores Operacionais</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Configure setores e associe equipes</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 flex gap-3">
              <input type="text" placeholder="Nome do novo setor..." value={newSetor} onChange={e => setNewSetor(e.target.value)} className={`${inp} flex-1`} />
              <Button onClick={addSetor} className="px-6 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-wider">
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {setores.map((setor, idx) => (
                <div key={setor} className="p-4 bg-card border border-border/40 rounded-2xl hover:border-primary/20 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    {editingSetorIdx === idx ? (
                      <div className="flex-1 flex gap-2">
                        <input value={editingSetorVal} onChange={e => setEditingSetorVal(e.target.value)} className={`${inp} flex-1`} />
                        <button onClick={() => saveEditSetor(idx)} className="bg-emerald-500 text-white px-3 rounded-lg text-xs font-bold uppercase">Salvar</button>
                        <button onClick={() => setEditingSetorIdx(null)} className="bg-muted border px-3 rounded-lg text-xs font-bold uppercase text-foreground">X</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-black text-foreground">{setor}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingSetorIdx(idx); setEditingSetorVal(setor) }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeSetor(setor)} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Equipes vinculadas a este setor */}
                  {!editingSetorIdx && (
                    <div className="pt-2 border-t border-border/30">
                      <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider block mb-1">Equipes Associadas:</span>
                      <div className="flex flex-wrap gap-1">
                        {equipesList.map(eq => {
                          const activeSecs = setoresEquipes[eq.id] || []
                          const has = activeSecs.includes(setor)
                          return (
                            <button key={eq.id}
                              onClick={() => {
                                const list = activeSecs.includes(setor) ? activeSecs.filter((s: string) => s !== setor) : [...activeSecs, setor]
                                updateConfig.mutate({ chave: 'setores_equipes', valor: { ...setoresEquipes, [eq.id]: list } })
                                toast(`Associação de equipe atualizada!`, 'success')
                              }}
                              className={cn("text-[7.5px] font-black uppercase px-2.5 py-0.5 rounded-full border transition-all",
                                has ? "bg-primary/10 border-primary text-primary" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                              )}>
                              {eq.nome}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: CARGOS DE FUNCIONÁRIO */}
        {subSection === 'cargos_func' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Cargos de Funcionários</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Cargos e títulos profissionais dos colaboradores</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 flex gap-3">
              <input type="text" placeholder="Nome do cargo..." value={newCargoFunc} onChange={e => setNewCargoFunc(e.target.value)} className={`${inp} flex-1`} />
              <Button onClick={addCargoFunc} className="px-6 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-wider">
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {cargosFunc.map((cargo, idx) => (
                <div key={cargo} className="p-4 bg-card border border-border/40 rounded-2xl hover:border-primary/20 transition-all">
                  <div className="flex items-center justify-between">
                    {editingCargoFuncIdx === idx ? (
                      <div className="flex-1 flex gap-2">
                        <input value={editingCargoFuncVal} onChange={e => setEditingCargoFuncVal(e.target.value)} className={`${inp} flex-1`} />
                        <button onClick={() => saveEditCargoFunc(idx)} className="bg-emerald-500 text-white px-3 rounded-lg text-xs font-bold uppercase">Salvar</button>
                        <button onClick={() => setEditingCargoFuncIdx(null)} className="bg-muted border px-3 rounded-lg text-xs font-bold uppercase text-foreground">X</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-black text-foreground">{cargo}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingCargoFuncIdx(idx); setEditingCargoFuncVal(cargo) }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeCargoFunc(cargo)} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: FUNÇÕES DA EQUIPE */}
        {subSection === 'funcoes_eq' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Funções Diárias da Equipe</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Gerencie as funções (ex: Motorista, Roçador) e suas cores para as escalas de equipe</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 space-y-3">
              <span className="text-[9px] font-black text-primary uppercase block">{editingFuncaoEq ? 'Editar Função' : 'Nova Função'}</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="Nome (Ex: Coletor)..." value={newFuncaoEq.nome} onChange={e => setNewFuncaoEq({ ...newFuncaoEq, nome: e.target.value })} className={`${inp} flex-1`} />
                
                {/* Select Palette Color */}
                <div className="flex items-center gap-1.5 overflow-x-auto p-1 max-w-[200px] sm:max-w-none shrink-0">
                  {PALETTE_COLORS.map((c, i) => (
                    <button key={i} onClick={() => setNewFuncaoEq({ ...newFuncaoEq, corIndex: i })} className={cn("w-6 h-6 rounded-full border-2 transition-all", newFuncaoEq.corIndex === i ? `border-white ring-2 ring-${c.baseColor} scale-110` : "border-transparent opacity-50 hover:opacity-100", `bg-${c.baseColor}`)} />
                  ))}
                </div>

                <Button onClick={addFuncaoEq} className="h-full rounded-xl bg-primary text-white font-black text-xs px-5 uppercase">
                  {editingFuncaoEq ? 'Atualizar' : 'Criar'}
                </Button>
                {editingFuncaoEq && (
                  <Button onClick={() => { setEditingFuncaoEq(null); setNewFuncaoEq({ nome: '', corIndex: 0 }) }} variant="outline" className="h-full rounded-xl font-black text-xs px-5 uppercase text-foreground">Cancelar</Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {funcoesEq.map((f: any) => (
                <div key={f.id} className={cn("p-4 rounded-2xl border flex items-center justify-between transition-all", f.classes || 'bg-muted border-border')}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm bg-white/20", f.textClass || 'text-foreground')}>
                      {(f.nome || '').charAt(0)}
                    </div>
                    <span className={cn("text-xs font-black uppercase tracking-wider", f.textClass || 'text-foreground')}>{f.nome}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => {
                       // Find approximate color index
                       const colorName = f.classes?.match(/bg-([a-z]+)-/)?.[1] || 'slate'
                       const matchIdx = PALETTE_COLORS.findIndex(p => p.baseColor.includes(colorName))
                       setEditingFuncaoEq(f)
                       setNewFuncaoEq({ nome: f.nome, corIndex: matchIdx >= 0 ? matchIdx : 0 })
                    }} className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"><Edit2 className="w-3.5 h-3.5 opacity-60" /></button>
                    <button onClick={() => removeFuncaoEq(f.id)} className="w-7 h-7 rounded-lg bg-black/5 hover:bg-rose-500/20 hover:text-rose-600 flex items-center justify-center transition-all"><Trash2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: REGIOES */}
        {subSection === 'regioes' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Regiões e Divisões</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Divisões geográficas operacionais</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 space-y-3">
              <span className="text-[9px] font-black text-primary uppercase block">{editRegiao ? 'Editar Região' : 'Nova Região'}</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="Nome..." value={regiaoForm.nome} onChange={e => setRegiaoForm({ ...regiaoForm, nome: e.target.value })} className={`${inp} flex-1`} />
                <input placeholder="Descrição (opcional)..." value={regiaoForm.descricao} onChange={e => setRegiaoForm({ ...regiaoForm, descricao: e.target.value })} className={`${inp} flex-1`} />
                <select value={regiaoForm.cor} onChange={e => setRegiaoForm({ ...regiaoForm, cor: e.target.value })} className={sel}>
                  {REGIAO_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button onClick={() => saveRegiaoMut.mutate()} loading={saveRegiaoMut.isPending} className="h-full rounded-xl bg-primary text-white font-black text-xs px-5 uppercase">
                  Salvar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {regioes.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3.5 bg-card border border-border/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                    <div>
                      <span className="text-xs font-black text-foreground block">{r.nome}</span>
                      {r.descricao && <span className="text-[9px] text-muted-foreground/60 font-bold block">{r.descricao}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditRegiao(r); setRegiaoForm({ nome: r.nome, descricao: r.descricao || '', cor: r.cor }) }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={async () => {
                      if (confirm(`Remover região ${r.nome}?`)) {
                        await supabase.from('regioes').delete().eq('id', r.id)
                        qc.invalidateQueries({ queryKey: ['regioes-config'] })
                        toast('Região excluída!', 'success')
                      }
                    }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: ESCALAS */}
        {subSection === 'escalas' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Tipos de Escala (Legenda)</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Customização de códigos de folgas e trabalho</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-primary uppercase block">{editingTipo ? 'Editar Modelo' : 'Novo Modelo'}</span>
                {editingTipo && (
                  <button onClick={() => { setEditingTipo(null); setNewTipo({ letra: '', nome: '', corIndex: 0, transparent: false }) }} className="text-[9px] font-black text-muted-foreground uppercase hover:text-foreground">Cancelar</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Sigla (Ex: T)" maxLength={3} value={newTipo.letra} onChange={e => setNewTipo({ ...newTipo, letra: e.target.value })} className={inp} />
                <input placeholder="Nome (Ex: Trabalho)" value={newTipo.nome} onChange={e => setNewTipo({ ...newTipo, nome: e.target.value })} className={inp} />
              </div>
              
              {/* Personalization Options */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PALETTE_COLORS.map((c, i) => (
                  <button 
                    key={i} 
                    type="button"
                    onClick={() => setNewTipo({ ...newTipo, corIndex: i })}
                    title={c.name}
                    className={cn(
                      "w-7 h-7 rounded-lg transition-all border border-transparent flex items-center justify-center text-[10px] font-black text-white",
                      `bg-${c.baseColor}`,
                      newTipo.corIndex === i ? "ring-2 ring-primary border-white scale-110" : "opacity-60 hover:opacity-100"
                    )} 
                  />
                ))}
              </div>

              {/* Cell transparency toggle */}
              <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border/30 rounded-xl">
                <div>
                  <span className="text-[10px] font-black text-foreground uppercase block">Estilo Vazado / Transparente</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Fundo transparente com contorno pontilhado</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTipo({ ...newTipo, transparent: !newTipo.transparent })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all",
                    newTipo.transparent
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted border-transparent text-muted-foreground hover:bg-muted/85"
                  )}
                >
                  {newTipo.transparent ? "Pontilhado" : "Sólido"}
                </button>
              </div>

              <Button onClick={addTipo} className="w-full h-11 bg-primary text-white font-black text-xs uppercase tracking-wider">
                {editingTipo ? 'Atualizar Modelo' : 'Criar Novo Modelo'}
              </Button>
            </div>

            <div className="space-y-2">
              {tipos.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm shrink-0", t.bg, t.text)}>
                      {t.letra}
                    </span>
                    <span className="text-xs font-black text-foreground">{t.nome}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => {
                      setEditingTipo(t)
                      const isTrans = t.bg.includes('bg-transparent')
                      const cIdx = PALETTE_COLORS.findIndex(c => t.bg.includes(c.baseColor) || t.text.includes(c.baseColor))
                      setNewTipo({ letra: t.letra, nome: t.nome, corIndex: cIdx !== -1 ? cIdx : 0, transparent: isTrans })
                    }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-blue-500/10 hover:text-blue-500 transition-all flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button disabled={i === 0} onClick={() => moveTipo(t.id, 'up')} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-20 flex items-center justify-center"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button disabled={i === tipos.length - 1} onClick={() => moveTipo(t.id, 'down')} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-20 flex items-center justify-center"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => {
                      if (t.id === 'presente') return toast('Impossível remover status base', 'error')
                      saveTipos(tipos.filter(x => x.id !== t.id))
                      toast('Status removido!', 'success')
                    }} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB SECTION: FERIADOS */}
        {subSection === 'feriados' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">Feriados Oficiais</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Feriados que afetam a contabilização do sistema</p>
            </div>

            <div className="bg-muted/15 p-4 rounded-2xl border border-border/30 flex flex-col sm:flex-row gap-3">
              <input placeholder="Nome do Feriado..." value={newFeriado.nome} onChange={e => setNewFeriado({ ...newFeriado, nome: e.target.value })} className={`${inp} flex-1`} />
              <input type="date" value={newFeriado.data} onChange={e => setNewFeriado({ ...newFeriado, data: e.target.value })} className={sel} />
              <Button onClick={addFeriado} className="px-6 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-wider">
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {feriados.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3.5 bg-card border border-border/40 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-rose-500" />
                    <div>
                      <span className="text-xs font-black text-foreground block">{f.nome}</span>
                      <span className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-widest">{format(parseISO(f.data), "dd 'de' MMMM", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFeriado(f.id)} className="w-8 h-8 rounded-lg bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: AUDITORIA E LOGS (Centralizado do antigo painel)
// ─────────────────────────────────────────────────────────────────────────────
function JsonDiffViewer({ antes, depois }: { antes: any; depois: any }) {
  if (!antes && !depois) return null

  const oldVal = typeof antes === 'object' && antes !== null ? (antes as Record<string, any>) : {}
  const newVal = typeof depois === 'object' && depois !== null ? (depois as Record<string, any>) : {}

  // Gather all unique keys that changed
  const keys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]))
    .filter(k => k !== 'created_at' && k !== 'updated_at' && k !== 'deleted_at' && oldVal[k] !== newVal[k])

  if (keys.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black p-3.5 bg-muted/20 rounded-2xl border border-border/30 mt-3 text-center">
        Nenhuma alteração nos campos principais
      </div>
    )
  }

  return (
    <div className="border border-border/40 rounded-2xl overflow-hidden mt-3 max-w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 bg-muted/40 text-[9px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/30">
        <div className="p-3 border-r border-border/30 hidden md:block">Valor Anterior</div>
        <div className="p-3">Valor Novo</div>
      </div>
      <div className="divide-y divide-border/30 bg-muted/10">
        {keys.map(key => {
          const vOld = oldVal[key]
          const vNew = newVal[key]

          return (
            <div key={key} className="grid grid-cols-1 md:grid-cols-2 text-[11px] font-bold text-foreground">
              <div className="p-3.5 border-r border-border/30 bg-rose-500/5 dark:bg-rose-500/10">
                <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 block mb-1">
                  Anterior: <strong className="font-extrabold text-foreground/80">{key}</strong>
                </span>
                <span className="font-mono break-all leading-relaxed text-rose-600 dark:text-rose-400">
                  {vOld !== undefined ? (typeof vOld === 'object' ? JSON.stringify(vOld) : String(vOld)) : '(não definido)'}
                </span>
              </div>
              <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-500/10">
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 block mb-1">
                  Novo: <strong className="font-extrabold text-foreground/80">{key}</strong>
                </span>
                <span className="font-mono break-all leading-relaxed text-emerald-600 dark:text-emerald-400">
                  {vNew !== undefined ? (typeof vNew === 'object' ? JSON.stringify(vNew) : String(vNew)) : '(excluído)'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabAuditoria() {
  const [tab, setTab] = useState<'audit' | 'logins' | 'security'>('audit')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showRawId, setShowRawId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(true)

  // Advanced Filter States
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedSuccess, setSelectedSuccess] = useState<'all' | 'success' | 'failure'>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')

  // Queries
  const { data: auditLogs = [], isLoading: loadAudit, refetch: refetchAudit } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('*, profiles(nome)').order('created_at', { ascending: false }).limit(250)
      return data || []
    },
    enabled: tab === 'audit',
    refetchInterval: isLive ? 6000 : false,
  })

  const { data: loginLogs = [], isLoading: loadLogin, refetch: refetchLogin } = useQuery({
    queryKey: ['login-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('login_logs').select('*').order('tentativa_em', { ascending: false }).limit(250)
      return data || []
    },
    enabled: tab === 'logins',
    refetchInterval: isLive ? 6000 : false,
  })

  const { data: secEvents = [], isLoading: loadSec, refetch: refetchSec } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const { data } = await supabase.from('security_events').select('*, profiles(nome)').order('created_at', { ascending: false }).limit(250)
      return data || []
    },
    enabled: tab === 'security',
    refetchInterval: isLive ? 6000 : false,
  })

  const isLoading = (tab === 'audit' && loadAudit) || (tab === 'logins' && loadLogin) || (tab === 'security' && loadSec)

  const sevColor: Record<string, string> = {
    info: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    low: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    high: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    critical: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  }

  // Helper arrays for filters
  const uniqueModules = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.modulo).filter(Boolean)))
  }, [auditLogs])

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.acao).filter(Boolean)))
  }, [auditLogs])

  // Stats Calculations
  const stats = useMemo(() => {
    const totalAudit = auditLogs.length
    const lastModule = auditLogs[0]?.modulo || 'Nenhum'
    
    const totalLogin = loginLogs.length
    const successfulLogins = loginLogs.filter(l => l.sucesso).length
    const loginSuccessRate = totalLogin > 0 ? Math.round((successfulLogins / totalLogin) * 100) : 100

    const totalSecurity = secEvents.length
    const criticalThreats = secEvents.filter(e => e.severidade === 'critical' || e.severidade === 'high').length

    return { totalAudit, lastModule, totalLogin, loginSuccessRate, totalSecurity, criticalThreats }
  }, [auditLogs, loginLogs, secEvents])

  // Filtered Lists
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = !search || 
        log.descricao?.toLowerCase().includes(search.toLowerCase()) || 
        log.modulo?.toLowerCase().includes(search.toLowerCase()) ||
        (log.profiles as any)?.nome?.toLowerCase().includes(search.toLowerCase())
      const matchesModule = selectedModule === 'all' || log.modulo === selectedModule
      const matchesAction = selectedAction === 'all' || log.acao === selectedAction
      return matchesSearch && matchesModule && matchesAction
    })
  }, [auditLogs, search, selectedModule, selectedAction])

  const filteredLoginLogs = useMemo(() => {
    return loginLogs.filter(log => {
      const matchesSearch = !search || log.cpf.includes(search.replace(/\D/g, ''))
      const matchesSuccess = selectedSuccess === 'all' || 
        (selectedSuccess === 'success' && log.sucesso) || 
        (selectedSuccess === 'failure' && !log.sucesso)
      return matchesSearch && matchesSuccess
    })
  }, [loginLogs, search, selectedSuccess])

  const filteredSecEvents = useMemo(() => {
    return secEvents.filter(ev => {
      const matchesSearch = !search || 
        ev.descricao?.toLowerCase().includes(search.toLowerCase()) ||
        ev.tipo?.toLowerCase().includes(search.toLowerCase())
      const matchesSeverity = selectedSeverity === 'all' || ev.severidade === selectedSeverity
      return matchesSearch && matchesSeverity
    })
  }, [secEvents, search, selectedSeverity])

  // Chart statistics for audit module distribution
  const moduleBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    auditLogs.forEach(log => {
      const m = log.modulo || 'Outros'
      counts[m] = (counts[m] || 0) + 1
    })
    const total = auditLogs.length
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count)
  }, [auditLogs])

  const handleManualRefresh = () => {
    if (tab === 'audit') refetchAudit()
    else if (tab === 'logins') refetchLogin()
    else if (tab === 'security') refetchSec()
  }

  // Export Filtered Logs to Excel/CSV in Portuguese layout (semicolon separators)
  const exportToCSV = () => {
    let headers: string[] = []
    let rows: any[][] = []
    let filename = ''

    if (tab === 'audit') {
      headers = ['ID', 'Data e Hora', 'Módulo', 'Ação', 'Descrição', 'Usuário Operante', 'Navegador/Agente', 'Rota Hash']
      rows = filteredAuditLogs.map(log => [
        log.id,
        format(parseISO(log.created_at), "dd/MM/yyyy HH:mm:ss"),
        log.modulo || '',
        log.acao || '',
        log.descricao || '',
        (log.profiles as any)?.nome || 'Sistema',
        log.user_agent || '',
        log.rota || ''
      ])
      filename = `auditoria_operacoes_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    } else if (tab === 'logins') {
      headers = ['ID', 'Data e Hora', 'Credencial CPF', 'Resultado Acesso', 'Motivo Bloqueio/Falha', 'Navegador', 'Dispositivo', 'Endereço IP']
      rows = filteredLoginLogs.map(log => [
        log.id,
        format(parseISO(log.tentativa_em), "dd/MM/yyyy HH:mm:ss"),
        log.cpf,
        log.sucesso ? 'Autorizado' : 'Bloqueado',
        log.motivo_falha || '',
        log.navegador || '',
        log.dispositivo || '',
        log.ip || ''
      ])
      filename = `auditoria_acessos_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    } else if (tab === 'security') {
      headers = ['ID', 'Data e Hora', 'Tipo Incidente', 'Severidade', 'Mensagem Descritiva', 'Responsável']
      rows = filteredSecEvents.map(ev => [
        ev.id,
        format(parseISO(ev.created_at), "dd/MM/yyyy HH:mm:ss"),
        ev.tipo || '',
        ev.severidade || '',
        ev.descricao || '',
        ev.profiles?.nome || 'Sistema Automatizado'
      ])
      filename = `auditoria_seguranca_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    }

    // Include UTF-8 BOM to satisfy Excel in Microsoft Office (Portuguese Windows system)
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* 📊 Premium KPIs Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Audits */}
        <div className="relative p-6 bg-gradient-to-br from-card/90 via-card/75 to-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-inner">
              <ScrollText className="w-5 h-5" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
              Atividade Global
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ações Auditadas</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tight">{stats.totalAudit}</h3>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Registros</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75">
            <span>Última Ação Em:</span>
            <span className="text-primary font-black">{stats.lastModule}</span>
          </div>
        </div>

        {/* Card 2: Login Success rate */}
        <div className="relative p-6 bg-gradient-to-br from-card/90 via-card/75 to-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 shadow-inner">
              <LogIn className="w-5 h-5" />
            </div>
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.2em] border px-2.5 py-1 rounded-full",
              stats.loginSuccessRate > 80 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              Autenticação
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Taxa de Sucesso</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tight">{stats.loginSuccessRate}%</h3>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Acessos OK</span>
            </div>
          </div>
          {/* Custom progress bar */}
          <div className="mt-4 pt-2">
            <div className="w-full h-1.5 bg-muted/65 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stats.loginSuccessRate}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Security Threats */}
        <div className="relative p-6 bg-gradient-to-br from-card/90 via-card/75 to-card/45 backdrop-blur-xl border border-border/40 rounded-[2rem] shadow-sm overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.2em] border px-2.5 py-1 rounded-full animate-pulse",
              stats.criticalThreats > 0 ? "bg-rose-500/15 text-rose-500 border-rose-500/25 font-black" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}>
              {stats.criticalThreats > 0 ? 'Ação Necessária' : 'Monitoramento Ok'}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Eventos Críticos</p>
            <div className="flex items-baseline gap-2">
              <h3 className={cn("text-3xl font-black tracking-tight", stats.criticalThreats > 0 ? "text-rose-500" : "")}>{stats.criticalThreats}</h3>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Altos / Críticos</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75">
            <span>Total Eventos de Segurança:</span>
            <span className="font-black text-foreground">{stats.totalSecurity}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Logs List & Filters (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-6">
          {/* ⚙️ Sub Tabs, Search and Multi-filters Controller */}
          <div className="bg-card/45 dark:bg-card/20 backdrop-blur-2xl border border-border/40 rounded-[2.5rem] p-6 shadow-sm space-y-4">
            <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
              <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/30 w-fit shrink-0 overflow-x-auto">
                {[
                  { id: 'audit' as const, label: 'Ações de Auditoria', icon: ScrollText },
                  { id: 'logins' as const, label: 'Histórico de Acessos', icon: LogIn },
                  { id: 'security' as const, label: 'Segurança & Escolta', icon: Shield },
                ].map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setExpandedId(null); setSearch(''); }}
                    className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                      tab === t.id ? "bg-card text-foreground shadow-sm font-black border border-border/30" : "text-muted-foreground hover:text-foreground"
                    )}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between sm:justify-start gap-3 w-full xl:w-auto xl:self-center shrink-0">
                <button 
                  onClick={exportToCSV}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all flex items-center justify-center gap-2 shadow-inner"
                  title="Exportar registros filtrados para CSV/Excel"
                >
                  <Upload className="w-3.5 h-3.5 rotate-185" /> Exportar CSV
                </button>
                <button 
                  onClick={handleManualRefresh}
                  className="p-2.5 rounded-xl text-xs font-black bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/30 transition-all flex items-center justify-center shrink-0"
                  title="Forçar recarregamento manual"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/80" />
              <input type="text" placeholder={tab === 'logins' ? "Pesquisar por CPF..." : "Pesquisar nos registros de log..."} value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border/30 rounded-2xl text-xs font-bold focus:ring-0 focus:border-primary/40 outline-none placeholder:text-muted-foreground/50 text-foreground" />
            </div>

            {/* 🛠️ Dynamic Multi-Filters Panel depending on Tab */}
            <div className="pt-4 border-t border-border/20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {tab === 'audit' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Filtrar Módulo</label>
                    <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)}
                      className="w-full px-3.5 py-2 bg-muted/30 border border-border/30 rounded-xl text-xs font-bold outline-none focus:border-primary/45 uppercase text-foreground">
                      <option value="all">TODOS OS MÓDULOS</option>
                      {uniqueModules.map(m => (
                        <option key={m} value={m}>{m.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Filtrar Ação</label>
                    <select value={selectedAction} onChange={e => setSelectedAction(e.target.value)}
                      className="w-full px-3.5 py-2 bg-muted/30 border border-border/30 rounded-xl text-xs font-bold outline-none focus:border-primary/45 uppercase text-foreground">
                      <option value="all">TODAS AS AÇÕES</option>
                      {uniqueActions.map(a => (
                        <option key={a} value={a}>{a.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {tab === 'logins' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status da Conexão</label>
                  <select value={selectedSuccess} onChange={e => setSelectedSuccess(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-muted/30 border border-border/30 rounded-xl text-xs font-bold outline-none focus:border-primary/45 uppercase text-foreground">
                    <option value="all">TODOS OS STATUS</option>
                    <option value="success">✅ APENAS AUTORIZADOS</option>
                    <option value="failure">❌ APENAS RECUSADOS</option>
                  </select>
                </div>
              )}

              {tab === 'security' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Severidade do Incidente</label>
                  <select value={selectedSeverity} onChange={e => setSelectedSeverity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-muted/30 border border-border/30 rounded-xl text-xs font-bold outline-none focus:border-primary/45 uppercase text-foreground">
                    <option value="all">TODAS AS GRAVIDADES</option>
                    <option value="info">INFO</option>
                    <option value="low">LOW (BAIXA)</option>
                    <option value="medium">MEDIUM (MÉDIA)</option>
                    <option value="high">HIGH (ALTA)</option>
                    <option value="critical">CRITICAL (CRÍTICA)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 🧾 Active logs viewer area */}
          {isLoading ? <Loading text="Recuperando registros e indexando base..." /> : (
            <div className="space-y-4">
              
              {/* Tab 1: Audit logs with side-by-side comparative diffs */}
              {tab === 'audit' && (
                filteredAuditLogs.length === 0 ? (
                  <div className="text-center py-16 bg-card/45 dark:bg-card/25 border border-border/40 rounded-3xl text-sm font-bold text-muted-foreground uppercase">
                    Nenhum log de auditoria encontrado para o filtro ativo.
                  </div>
                ) : (
                  filteredAuditLogs.map(log => {
                    const isExpanded = expandedId === log.id
                    const showRaw = showRawId === log.id
                    return (
                      <div 
                        key={log.id} 
                        className={cn(
                          "bg-card/85 dark:bg-card/35 backdrop-blur-md border rounded-[2rem] p-5 transition-all shadow-sm",
                          isExpanded ? "border-primary/45 shadow-md shadow-primary/5 ring-1 ring-primary/20" : "border-border/40 hover:border-border/70"
                        )}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                              <ScrollText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full border border-border/30">
                                  {log.modulo}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-primary/15 text-primary rounded-full border border-primary/25">
                                  {log.acao}
                                </span>
                                {log.rota && (
                                  <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-sky-500/10 text-sky-400 rounded-full border border-sky-400/20">
                                    /{log.rota}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-black text-foreground">{log.descricao}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground/75 font-black uppercase tracking-wider bg-muted/40 px-2.5 py-1 rounded-xl border border-border/25">
                                  <User className="w-3 h-3 text-primary" /> {(log.profiles as any)?.nome || 'Sistema'}
                                </span>
                                <span className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground/75 font-black uppercase tracking-wider bg-muted/40 px-2.5 py-1 rounded-xl border border-border/25">
                                  <Clock className="w-3 h-3 text-primary" /> {format(parseISO(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expand Toggle Button */}
                          <button 
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className={cn(
                              "h-10 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border self-start md:self-center shrink-0",
                              isExpanded 
                                ? "bg-primary/15 border-primary/30 text-primary" 
                                : "bg-muted/40 hover:bg-muted border-border/30 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {isExpanded ? 'Recolher Painel' : 'Inspecionar Dados'}
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                          </button>
                        </div>

                        {/* Detailed Comparative inspector section when expanded */}
                        {isExpanded && (
                          <div className="mt-5 pt-5 border-t border-border/30 space-y-4 animate-fadeIn">
                            {/* Browser & Connection Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/30">
                              <div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70 block mb-1">Assinatura do Agente (User Agent)</span>
                                <p className="text-[10px] font-bold text-foreground break-all">{log.user_agent || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70 block mb-1">Ponto de Entrada</span>
                                <p className="text-[10px] font-bold text-foreground">Rota de Acesso Hash: <span className="text-primary font-black">/{log.rota || 'raiz'}</span></p>
                              </div>
                            </div>

                            {/* Interactive before/after value comparator */}
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80 block mb-1.5">Investigação de Alterações de Estado:</span>
                              <JsonDiffViewer antes={log.dados_anteriores} depois={log.dados_novos} />
                            </div>

                            {/* Raw JSON expander code block */}
                            <div className="pt-2">
                              <button 
                                onClick={() => setShowRawId(showRaw ? null : log.id)}
                                className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                              >
                                {showRaw ? 'Esconder JSON Bruto' : 'Visualizar Payload JSON Bruto'}
                              </button>
                              {showRaw && (
                                <pre className="text-[10.5px] bg-neutral-950 text-emerald-400 p-4 rounded-2xl border border-border/30 mt-2 font-mono overflow-x-auto max-h-[300px] scrollbar-thin select-all">
                                  {JSON.stringify({
                                    id: log.id,
                                    user_id: log.user_id,
                                    modulo: log.modulo,
                                    acao: log.acao,
                                    rota: log.rota,
                                    user_agent: log.user_agent,
                                    dados_anteriores: log.dados_anteriores,
                                    dados_novos: log.dados_novos,
                                    timestamp: log.created_at
                                  }, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )
              )}

              {/* Tab 2: Login Logs */}
              {tab === 'logins' && (
                filteredLoginLogs.length === 0 ? (
                  <div className="text-center py-16 bg-card/45 dark:bg-card/25 border border-border/40 rounded-3xl text-sm font-bold text-muted-foreground uppercase">
                    Nenhuma tentativa de login registrada com o filtro ativo.
                  </div>
                ) : (
                  filteredLoginLogs.map(log => (
                    <div 
                      key={log.id} 
                      className={cn(
                        "bg-card/85 border rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm",
                        log.sucesso ? "border-emerald-500/20" : "border-rose-500/25"
                      )}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner",
                          log.sucesso 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" 
                            : "bg-rose-500/10 text-rose-500 border-rose-500/25 animate-pulse"
                        )}>
                          <LogIn className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-black text-foreground tracking-tight">
                              CPF: {log.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                            </span>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border",
                              log.sucesso 
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            )}>
                              {log.sucesso ? '✅ Autorizado' : '❌ Bloqueado'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {!log.sucesso && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl">
                                Falha: {log.motivo_falha}
                              </span>
                            )}
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-muted/50 text-muted-foreground/80 border border-border/30 rounded-xl">
                              Navegador: <strong className="text-foreground/75 font-extrabold">{log.navegador}</strong>
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-muted/50 text-muted-foreground/80 border border-border/30 rounded-xl">
                              Dispositivo: <strong className="text-foreground/75 font-extrabold">{log.dispositivo}</strong>
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-muted/50 text-muted-foreground/80 border border-border/30 rounded-xl">
                              IP: <strong className="text-foreground/75 font-extrabold">{log.ip || 'N/D'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest shrink-0 self-start md:self-center bg-muted/40 px-3.5 py-2 rounded-xl border border-border/30">
                        {format(parseISO(log.tentativa_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  ))
                )
              )}

              {/* Tab 3: Security events and anomalies */}
              {tab === 'security' && (
                filteredSecEvents.length === 0 ? (
                  <div className="text-center py-16 bg-card/45 dark:bg-card/25 border border-border/40 rounded-3xl text-sm font-bold text-muted-foreground uppercase">
                    Nenhum incidente de segurança catalogado com o filtro ativo.
                  </div>
                ) : (
                  filteredSecEvents.map(ev => {
                    const isCritical = ev.severidade === 'critical' || ev.severidade === 'high'
                    return (
                      <div 
                        key={ev.id} 
                        className={cn(
                          "bg-card/85 border rounded-[2rem] p-5 flex items-start gap-4 border-l-4 transition-all shadow-sm",
                          isCritical ? "border-l-rose-500 border-rose-500/20" : "border-l-amber-500 border-amber-500/20"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner", sevColor[ev.severidade] || sevColor.info)}>
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-muted rounded-full border border-border/30">
                              {ev.tipo.toUpperCase()}
                            </span>
                            <span className={cn("text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border", sevColor[ev.severidade] || sevColor.info)}>
                              {ev.severidade.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm font-black text-foreground leading-snug">{ev.descricao}</p>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground/75 font-black uppercase tracking-wider bg-muted/40 px-2.5 py-1 rounded-xl border border-border/25">
                              <User className="w-3 h-3 text-primary" /> {ev.profiles?.nome || 'Sistema Automatizado'}
                            </span>
                            <span className="flex items-center gap-1.5 text-[8.5px] text-muted-foreground/75 font-black uppercase tracking-wider bg-muted/40 px-2.5 py-1 rounded-xl border border-border/25">
                              <Clock className="w-3 h-3 text-primary" /> {format(parseISO(ev.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          {/* Display metadata if present */}
                          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                            <div className="mt-3 p-3 bg-neutral-900/10 dark:bg-black/20 rounded-xl border border-border/25 max-w-xl">
                              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Assinatura de Rastreamento (Metadata)</span>
                              <pre className="text-[10px] font-mono text-muted-foreground truncate select-all">{JSON.stringify(ev.metadata)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Widgets & Sidebar (lg:col-span-1) */}
        <div className="space-y-6 shrink-0 lg:sticky lg:top-6">
          {/* Widget 1: Real-time Live Feed Sync status */}
          <div className="bg-card/45 dark:bg-card/20 backdrop-blur-xl border border-border/40 p-5 rounded-[2rem] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronização</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isLive ? "bg-rose-500 animate-pulse" : "bg-muted-foreground"
                )} />
                <span className="text-[9px] font-black uppercase tracking-wider text-foreground">
                  {isLive ? '🔴 Em Tempo Real' : '⚪ Pausado'}
                </span>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed">
              O feed de auditoria é atualizado a cada 6 segundos de forma assíncrona.
            </p>

            <button 
              onClick={() => setIsLive(!isLive)}
              className={cn(
                "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border text-center font-bold",
                isLive 
                  ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25 text-rose-500" 
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25 text-emerald-500"
              )}
            >
              {isLive ? 'Pausar Monitoramento' : 'Retomar Monitoramento'}
            </button>
          </div>

          {/* Widget 2: Modular distribution progress charts */}
          {tab === 'audit' && (
            <div className="bg-card/45 dark:bg-card/20 backdrop-blur-xl border border-border/40 p-5 rounded-[2rem] shadow-sm space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground block">Módulos Ativos</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Volume de ações por setor</span>
              </div>
              <div className="space-y-3.5 pt-2">
                {moduleBreakdown.slice(0, 5).map(m => (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="text-foreground font-black truncate max-w-[120px]">{m.name}</span>
                      <span>{m.count} ({m.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted/65 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${m.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


