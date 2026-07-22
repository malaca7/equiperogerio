import React, { useState, useMemo } from 'react'
import { 
  Plus, Search, Trash2, Shield, X, AlertTriangle, Ban, CheckCircle2, Key, UserCog, ChevronDown, Eye, EyeOff, Camera, Upload
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { TopHeader } from '../../components/layout/TopHeader'
import type { Role, Permission, MenuConfig } from '../../lib/auth.types'
import { PAGE_LABELS, SYSTEM_PAGES, DEFAULT_MENU_CONFIG } from '../../lib/auth.types'
import { Avatar } from '../../components/ui/Avatar'
import { useConfiguracao, useUpdateConfiguracao } from '../../hooks/useConfiguracoes'

interface UserWithRoles {
  id: string;
  cpf: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  ultimo_login: string | null;
  created_at: string;
  roles: Pick<Role, 'id' | 'nome' | 'cor'>[]
}

const USERS_KEY = ['admin-users']
const ROLES_KEY = ['roles']
const PERMS_KEY = ['permissions']

export default function UsuariosPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { hasPermission, isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null)
  const [permUser, setPermUser] = useState<UserWithRoles | null>(null)
  const [form, setForm] = useState({ cpf: '', senha: '', nome: '', email: '', roleId: '' })
  const [editForm, setEditForm] = useState({ id: '', cpf: '', senha: '', nome: '', email: '' })
  const [showPass, setShowPass] = useState(false)
  const [tempFotoUrl, setTempFotoUrl] = useState('')

  const { data: fotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})
  const updateConfig = useUpdateConfiguracao()

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 150
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
          ctx?.drawImage(img, 0, 0, width, height)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
          resolve(compressedBase64)
        }
        img.onerror = (err) => reject(err)
      }
      reader.onerror = (err) => reject(err)
    })
  }

  // Queries
  const { data: users = [], isLoading } = useQuery<UserWithRoles[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*').order('nome')
      const { data: ur } = await supabase.from('user_roles').select('user_id, roles(id, nome, cor)')
      const roleMap = new Map<string, any[]>()
      if (ur) {
        for (const r of ur) {
          if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, [])
          if (r.roles) roleMap.get(r.user_id)!.push(r.roles)
        }
      }
      return (profiles || []).map(p => ({ ...p, roles: roleMap.get(p.id) || [] }))
    },
  })

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').eq('ativo', true).order('nivel', { ascending: false })
      return data || []
    },
  })

  const { data: menuConfig } = useConfiguracao<MenuConfig>('menu_config', DEFAULT_MENU_CONFIG)

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

  const { data: userPermIds = [], isLoading: loadingPerms } = useQuery<string[]>({
    queryKey: ['user-direct-perms', permUser?.id],
    enabled: !!permUser,
    queryFn: async () => {
      const { data } = await supabase.from('user_direct_permissions').select('permission_id').eq('user_id', permUser!.id)
      return (data || []).map(d => d.permission_id)
    },
  })

  // Mutations
  const createMut = useMutation({
    mutationFn: async () => {
      const clean = form.cpf.replace(/\D/g, '')
      const { data, error } = await supabase.from('profiles').insert({
        cpf: clean, senha: form.senha, nome: form.nome, email: form.email || null,
      }).select().single()
      if (error) throw error
      if (form.roleId) {
        await supabase.from('user_roles').insert({ user_id: data.id, role_id: form.roleId })
      }
      return data.id as string
    },
    onSuccess: async (newUserId) => { 
      if (newUserId) {
        await updateConfig.mutateAsync({
          chave: 'fotos_usuarios',
          valor: { ...fotos, [newUserId]: tempFotoUrl }
        })
      }
      qc.invalidateQueries({ queryKey: USERS_KEY })
      setCreateModal(false)
      toast('Usuário criado com sucesso!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      const clean = editForm.cpf.replace(/\D/g, '')
      const updates: any = { cpf: clean, nome: editForm.nome, email: editForm.email || null, updated_at: new Date().toISOString() }
      if (editForm.senha) updates.senha = editForm.senha
      const { error } = await supabase.from('profiles').update(updates).eq('id', editForm.id)
      if (error) throw error
    },
    onSuccess: async () => { 
      await updateConfig.mutateAsync({
        chave: 'fotos_usuarios',
        valor: { ...fotos, [editForm.id]: tempFotoUrl }
      })
      qc.invalidateQueries({ queryKey: USERS_KEY })
      setEditUser(null)
      toast('Usuário atualizado com sucesso!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('profiles').update({ ativo }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: USERS_KEY })
      toast('Status do usuário atualizado!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: USERS_KEY })
      toast('Usuário excluído permanentemente!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId })
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: USERS_KEY })
      toast('Cargo atribuído com sucesso!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const removeRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
      if (error) throw error
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: USERS_KEY })
      toast('Cargo removido com sucesso!', 'success') 
    },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const setPageLevel = async (userId: string, page: string, level: 'none' | 'view' | 'manage') => {
    const pagePerms = allPerms.filter(p => p.pagina === page)
    const permView = pagePerms.find(p => p.acao === 'visualizar')
    const permManage = pagePerms.find(p => p.acao === 'gerenciar')

    // Clean first
    const idsToRemove = [permView?.id, permManage?.id].filter(Boolean) as string[]
    for (const pid of idsToRemove) {
      await supabase.from('user_direct_permissions').delete().eq('user_id', userId).eq('permission_id', pid)
    }

    const inserts = []
    if ((level === 'view' || level === 'manage') && permView) inserts.push({ user_id: userId, permission_id: permView.id })
    if (level === 'manage' && permManage) inserts.push({ user_id: userId, permission_id: permManage.id })

    if (inserts.length > 0) {
      await supabase.from('user_direct_permissions').insert(inserts)
    }
    qc.invalidateQueries({ queryKey: ['user-direct-perms', userId] })
    toast('Permissão direta atualizada!', 'success')
  }

  const permsByPage = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of allPerms) {
      if (p.pagina === 'configuracoes') continue
      if (!map.has(p.pagina)) map.set(p.pagina, [])
      map.get(p.pagina)!.push(p)
    }
    return map
  }, [allPerms])

  const filtered = users.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.cpf.includes(search.replace(/\D/g, ''))
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Gerenciamento de Usuários" subtitle="Cadastros, atribuição de cargos e acessos" />
        <div className="pt-32"><Loading text="Carregando usuários..." /></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Gerenciamento de Usuários" subtitle="Cadastros, atribuição de cargos e acessos" />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32">
        <div className="space-y-8">
          {/* Search and New User Toolbar */}
          <div className="flex flex-col md:flex-row gap-5 items-stretch md:items-center justify-between bg-card/65 dark:bg-card/30 backdrop-blur-2xl border border-border/40 rounded-[2rem] p-5 sm:p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-40 pointer-events-none" />
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60 transition-transform group-hover:scale-110" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou CPF..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-muted/30 border border-border/30 rounded-[1.25rem] text-xs font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none text-foreground placeholder:text-muted-foreground/50 transition-all uppercase" 
              />
            </div>
            {(isAdmin || hasPermission('usuarios', 'gerenciar')) && (
              <Button 
                onClick={() => { setForm({ cpf: '', senha: '', nome: '', email: '', roleId: '' }); setTempFotoUrl(''); setCreateModal(true) }}
                className="h-13 px-8 rounded-[1.25rem] bg-primary text-white font-black uppercase text-[10px] tracking-wider shadow-lg shadow-primary/25 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center shrink-0 gap-2 border border-primary/10"
              >
                <Plus className="w-4.5 h-4.5" /> Novo Usuário
              </Button>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filtered.map(u => (
              <div key={u.id} className={cn(
                "group relative backdrop-blur-xl border rounded-[2rem] p-6 shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 overflow-hidden",
                u.ativo 
                  ? "bg-card/75 dark:bg-card/30 border-border/50 hover:border-primary/40" 
                  : "bg-rose-500/[0.04] dark:bg-rose-500/[0.015] border-rose-500/25 hover:border-rose-500/40"
              )}>
                {/* Background glow effects */}
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-20 transition-opacity group-hover:opacity-40",
                  u.ativo ? "bg-primary" : "bg-rose-500"
                )} />

                <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-full ring-2 ring-primary/25 dark:ring-primary/40 group-hover:ring-primary/70 p-0.5 transition-all duration-500 bg-background/40 shrink-0">
                      <Avatar name={u.nome} src={fotos[u.id]} size="md" className="w-full h-full rounded-full shadow-lg group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-black text-foreground truncate tracking-tight uppercase group-hover:text-primary transition-colors">{u.nome}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-2 py-0.5 rounded-lg border border-border/20 truncate">
                          {u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </span>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm border",
                          u.ativo 
                            ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5" 
                            : "text-rose-600 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5"
                        )}>
                          {u.ativo ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {(isAdmin || hasPermission('usuarios', 'gerenciar')) && (
                    <div className="flex flex-col gap-1 shrink-0 relative z-20">
                      <button 
                        onClick={() => { if (confirm(`ATENÇÃO: Deseja excluir permanentemente o usuário ${u.nome}? Esta ação não pode ser desfeita.`)) deleteUser.mutate(u.id) }}
                        className="w-8.5 h-8.5 rounded-xl bg-rose-500/5 text-rose-500/40 hover:text-white hover:bg-rose-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-rose-500/20"
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Roles chips */}
                <div className="flex flex-wrap gap-1.5 mb-5 min-h-[26px] relative z-10">
                  {u.roles.map(r => (
                    <span 
                      key={r.id} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border shadow-sm transition-transform hover:scale-105" 
                      style={{ borderColor: r.cor + '35', color: r.cor, backgroundColor: r.cor + '08' }}
                    >
                      <Shield className="w-3 h-3" /> {r.nome}
                      {(isAdmin || hasPermission('usuarios', 'gerenciar')) && (
                        <button 
                          onClick={() => removeRole.mutate({ userId: u.id, roleId: r.id })} 
                          className="ml-1 hover:text-rose-500 hover:scale-125 transition-all"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {u.roles.length === 0 && (
                    <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 italic font-bold uppercase flex items-center gap-1 px-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sem cargo associado
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                {(isAdmin || hasPermission('usuarios', 'gerenciar')) && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 sm:pt-5 border-t border-border/30 relative z-10">
                    <div className="relative w-full sm:flex-1">
                      <select 
                        onChange={e => { if (e.target.value) { assignRole.mutate({ userId: u.id, roleId: e.target.value }); e.target.value = '' } }}
                        className="w-full text-[9px] sm:text-[10px] font-black uppercase bg-muted/40 border border-border/40 hover:border-primary/30 rounded-xl px-3 py-2.5 outline-none text-foreground tracking-wider cursor-pointer transition-all appearance-none text-center sm:text-left pr-8"
                      >
                        <option value="">+ Cargo</option>
                        {roles.filter(r => !u.roles.some(ur => ur.id === r.id)).map(r => (
                          <option key={r.id} value={r.id}>{r.nome}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto grid grid-cols-3 sm:flex">
                      <button 
                        onClick={() => toggleActive.mutate({ id: u.id, ativo: !u.ativo })}
                        className={cn("h-10 rounded-xl flex items-center justify-center transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-wider gap-1.5 border active:scale-95 shadow-sm", 
                        u.ativo 
                          ? "bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-500/20" 
                          : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-500/20")}
                        title={u.ativo ? "Bloquear Acesso" : "Desbloquear Acesso"}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">{u.ativo ? 'Bloquear' : 'Liberar'}</span>
                      </button>
                      <button 
                        onClick={() => setPermUser(u)}
                        className="h-10 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-500/20 flex items-center justify-center transition-all active:scale-95 shadow-sm"
                        title="Permissões Isoladas"
                      >
                        <Key className="w-3.5 h-3.5 sm:w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { 
                          setEditForm({ id: u.id, cpf: u.cpf, senha: '', nome: u.nome, email: u.email || '' })
                          setTempFotoUrl(fotos[u.id] ?? '')
                          setEditUser(u) 
                        }} 
                        className="h-10 rounded-xl bg-blue-500/10 text-blue-600 hover:text-white hover:bg-blue-500 border border-blue-500/20 flex items-center justify-center transition-all active:scale-95 shadow-sm"
                        title="Editar Cadastro"
                      >
                        <UserCog className="w-3.5 h-3.5 sm:w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Direct Perms Modal */}
          <Modal open={!!permUser} onClose={() => setPermUser(null)} title={`Permissões Isoladas — ${permUser?.nome || ''}`}>
            {loadingPerms ? <Loading text="Buscando permissões directas..." /> : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-4 px-1">
                  Configure permissões isoladas para este usuário (independente de seus cargos)
                </p>
                {Array.from(permsByPage.entries()).map(([page, perms]) => {
                  const permView = perms.find(p => p.acao === 'visualizar')
                  const permManage = perms.find(p => p.acao === 'gerenciar')
                  const hasView = permView ? userPermIds.includes(permView.id) : false
                  const hasManage = permManage ? userPermIds.includes(permManage.id) : false

                  let val: 'none' | 'view' | 'manage' = 'none'
                  if (hasManage) val = 'manage'
                  else if (hasView) val = 'view'

                  const label = PAGE_LABELS[page as keyof typeof PAGE_LABELS] || page
                  return (
                    <div key={page} className="flex items-center justify-between p-3.5 bg-muted/15 border border-border/30 rounded-2xl">
                      <span className="text-xs font-black uppercase tracking-wider text-foreground truncate">{label}</span>
                      <div className="relative">
                        <select 
                          value={val} 
                          onChange={e => permUser && setPageLevel(permUser.id, page, e.target.value as any)}
                          className={cn(
                            "appearance-none pl-3 pr-7 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider outline-none cursor-pointer border",
                            val === 'none' && "bg-rose-500/10 text-rose-500 border-rose-500/30",
                            val === 'view' && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                            val === 'manage' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          )}
                        >
                          <option value="none">Bloqueado</option>
                          <option value="view">Visualizar</option>
                          <option value="manage">Gerenciar</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Modal>

          {/* Add User Modal */}
          <Modal open={createModal} onClose={() => setCreateModal(false)} title="Novo Usuário">
            <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="space-y-4">
              {/* Elegant Avatar Selector Container */}
              <div className="flex flex-col items-center gap-4 py-4 bg-muted/20 rounded-[2rem] border border-border/30 p-5 relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider">Foto do Usuário</span>
                
                <div className="relative group/avatar cursor-pointer" onClick={() => document.getElementById('user-avatar-file-input-create')?.click()}>
                  <div className="w-24 h-24 rounded-full ring-4 ring-primary/20 group-hover/avatar:ring-primary/45 p-1 transition-all duration-300 bg-background/50 overflow-hidden flex items-center justify-center">
                    {tempFotoUrl ? (
                      <img src={tempFotoUrl} alt="Preview Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-muted flex flex-col items-center justify-center text-muted-foreground/40 group-hover/avatar:text-primary/60 transition-colors">
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-[8px] font-bold uppercase tracking-wider">Inserir</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Micro Edit Badge Overlay */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-lg border border-background scale-95 group-hover/avatar:scale-105 transition-all">
                    <Upload className="w-4 h-4" />
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  id="user-avatar-file-input-create"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      try {
                        const base64 = await compressImage(file)
                        setTempFotoUrl(base64)
                      } catch (err) {
                        toast('Falha ao processar a imagem do perfil.', 'error')
                      }
                    }
                  }}
                />

                <div className="text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider border border-border/60 hover:bg-muted"
                    onClick={() => document.getElementById('user-avatar-file-input-create')?.click()}
                  >
                    Selecionar Foto
                  </Button>
                  {tempFotoUrl && (
                    <button
                      type="button"
                      className="block text-[8.5px] font-bold text-rose-500 uppercase tracking-wider mt-2.5 mx-auto hover:underline"
                      onClick={() => setTempFotoUrl('')}
                    >
                      Remover Foto
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Nome Completo *</label>
                <input 
                  value={form.nome} 
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold uppercase outline-none focus:border-primary/40" 
                  placeholder="NOME DO USUARIO" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">CPF (Apenas números) *</label>
                <input 
                  value={form.cpf} 
                  onChange={e => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} 
                  inputMode="numeric"
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40" 
                  placeholder="00000000000" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Senha *</label>
                <div className="relative">
                  <input 
                    type={showPass ? 'text' : 'password'} 
                    value={form.senha} 
                    onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                    className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none pr-12 focus:border-primary/40" 
                    placeholder="Insira a senha" 
                    required 
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Cargo Inicial</label>
                <select 
                  value={form.roleId} 
                  onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40 text-foreground"
                >
                  <option value="">Sem cargo associado</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCreateModal(false)} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
                <Button type="submit" loading={createMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">Criar Usuário</Button>
              </div>
            </form>
          </Modal>

          {/* Edit User Modal */}
          <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar Cadastro">
            <form onSubmit={e => { e.preventDefault(); updateMut.mutate() }} className="space-y-4">
              {/* Elegant Avatar Selector Container */}
              <div className="flex flex-col items-center gap-4 py-4 bg-muted/20 rounded-[2rem] border border-border/30 p-5 relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-wider">Foto do Usuário</span>
                
                <div className="relative group/avatar cursor-pointer" onClick={() => document.getElementById('user-avatar-file-input-edit')?.click()}>
                  <div className="w-24 h-24 rounded-full ring-4 ring-primary/20 group-hover/avatar:ring-primary/45 p-1 transition-all duration-300 bg-background/50 overflow-hidden flex items-center justify-center">
                    {tempFotoUrl ? (
                      <img src={tempFotoUrl} alt="Preview Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-muted flex flex-col items-center justify-center text-muted-foreground/40 group-hover/avatar:text-primary/60 transition-colors">
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-[8px] font-bold uppercase tracking-wider">Inserir</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Micro Edit Badge Overlay */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-lg border border-background scale-95 group-hover/avatar:scale-105 transition-all">
                    <Upload className="w-4 h-4" />
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  id="user-avatar-file-input-edit"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      try {
                        const base64 = await compressImage(file)
                        setTempFotoUrl(base64)
                      } catch (err) {
                        toast('Falha ao processar a imagem do perfil.', 'error')
                      }
                    }
                  }}
                />

                <div className="text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider border border-border/60 hover:bg-muted"
                    onClick={() => document.getElementById('user-avatar-file-input-edit')?.click()}
                  >
                    Selecionar Foto
                  </Button>
                  {tempFotoUrl && (
                    <button
                      type="button"
                      className="block text-[8.5px] font-bold text-rose-500 uppercase tracking-wider mt-2.5 mx-auto hover:underline"
                      onClick={() => setTempFotoUrl('')}
                    >
                      Remover Foto
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Nome Completo *</label>
                <input 
                  value={editForm.nome} 
                  onChange={e => setEditForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold uppercase outline-none focus:border-primary/40" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">CPF *</label>
                <input 
                  value={editForm.cpf} 
                  onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} 
                  inputMode="numeric"
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Alterar Senha</label>
                <input 
                  type="password" 
                  value={editForm.senha} 
                  onChange={e => setEditForm(f => ({ ...f, senha: e.target.value }))}
                  className="w-full px-4 py-3 bg-muted/30 border border-border/30 rounded-2xl text-xs font-bold outline-none focus:border-primary/40" 
                  placeholder="Deixe em branco para não alterar" 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditUser(null)} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
                <Button type="submit" loading={updateMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">Salvar</Button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  )
}
