import React, { useState } from 'react'
import { Search, Plus, Shield, UserCog, X, Check, Ban, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'
import type { Role } from '../../lib/auth.types'

interface UserWithRoles {
  id: string; cpf: string; nome: string; email: string | null; ativo: boolean
  ultimo_login: string | null; created_at: string
  roles: Pick<Role, 'id' | 'nome' | 'cor'>[]
}

const USERS_KEY = ['admin-users']

function useAdminUsers() {
  return useQuery<UserWithRoles[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*').order('nome')
      const { data: ur } = await supabase.from('user_roles').select('user_id, roles(id, nome, cor)')
      const roleMap = new Map<string, any[]>()
      if (ur) for (const r of ur) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, [])
        if (r.roles) roleMap.get(r.user_id)!.push(r.roles)
      }
      return (profiles || []).map(p => ({ ...p, roles: roleMap.get(p.id) || [] }))
    },
  })
}

function useAllRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').eq('ativo', true).order('nivel', { ascending: false })
      return data || []
    },
  })
}

export function AdminUsersPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useAdminUsers()
  const { data: roles = [] } = useAllRoles()
  const [search, setSearch] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null)
  const [form, setForm] = useState({ cpf: '', senha: '', nome: '', email: '', roleId: '' })
  const [showPass, setShowPass] = useState(false)

  const filtered = users.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.cpf.includes(search.replace(/\D/g, ''))
  )

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
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: USERS_KEY }); setCreateModal(false); toast('Usuário criado!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await supabase.from('profiles').update({ ativo }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: USERS_KEY }); toast('Status atualizado', 'success') },
  })

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: USERS_KEY }); toast('Cargo atribuído', 'success') },
    onError: () => toast('Cargo já atribuído', 'error'),
  })

  const removeRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: USERS_KEY }); toast('Cargo removido', 'success') },
  })

  if (isLoading) return <Loading text="Carregando usuários..." />

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none" />
        </div>
        <Button onClick={() => { setForm({ cpf: '', senha: '', nome: '', email: '', roleId: '' }); setCreateModal(true) }}
          className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      {/* Users grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(u => (
          <div key={u.id} className={cn(
            "bg-card/80 dark:bg-card/40 backdrop-blur-xl border rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all group",
            u.ativo ? "border-border/50" : "border-rose-500/30 opacity-60"
          )}>
            <div className="flex items-center gap-4 mb-5">
              <div className={cn("w-14 h-14 rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-inner", u.ativo ? "bg-primary/10 text-primary" : "bg-rose-500/10 text-rose-500")}>
                {u.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-foreground truncate">{u.nome}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CPF: {u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
              </div>
              <button onClick={() => toggleActive.mutate({ id: u.id, ativo: !u.ativo })}
                className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", u.ativo ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white")}>
                {u.ativo ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
              </button>
            </div>

            {/* Roles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {u.roles.map(r => (
                <span key={r.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border" style={{ borderColor: r.cor + '40', color: r.cor, backgroundColor: r.cor + '10' }}>
                  <Shield className="w-3 h-3" /> {r.nome}
                  <button onClick={() => removeRole.mutate({ userId: u.id, roleId: r.id })} className="ml-1 hover:opacity-60"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>

            {/* Assign role */}
            <div className="flex items-center gap-2">
              <select onChange={e => { if (e.target.value) { assignRole.mutate({ userId: u.id, roleId: e.target.value }); e.target.value = '' } }}
                className="flex-1 text-xs font-bold bg-muted/50 border border-border/50 rounded-xl px-3 py-2 outline-none">
                <option value="">+ Atribuir cargo...</option>
                {roles.filter(r => !u.roles.some(ur => ur.id === r.id)).map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              <button onClick={() => setEditUser(u)} className="w-10 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all">
                <UserCog className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 opacity-30">
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <p className="text-xs font-black uppercase tracking-widest">Nenhum usuário encontrado</p>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Novo Usuário">
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold uppercase outline-none focus:border-primary/30" placeholder="NOME COMPLETO" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">CPF *</label>
            <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} inputMode="numeric"
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="00000000000" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Senha *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30 pr-12" placeholder="Senha" required />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email (opcional)</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="email@empresa.com" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargo inicial</label>
            <select value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30">
              <option value="">Sem cargo</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">Criar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
