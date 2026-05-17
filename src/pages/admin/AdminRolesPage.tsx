import React, { useState } from 'react'
import { Plus, Edit2, Copy, Trash2, Shield, Check, X, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Loading'
import { cn } from '../../lib/utils'
import type { Role, Permission } from '../../lib/auth.types'
import { SYSTEM_PAGES, PAGE_LABELS, ACTION_LABELS, type SystemPage, type PermissionAction } from '../../lib/auth.types'

const ROLES_KEY = ['roles']
const PERMS_KEY = ['permissions']
const RP_KEY = ['role-permissions']

function useRoles() {
  return useQuery<Role[]>({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').order('nivel', { ascending: false })
      return data || []
    },
  })
}

function usePermissions() {
  return useQuery<Permission[]>({
    queryKey: PERMS_KEY,
    queryFn: async () => {
      const { data } = await supabase.from('permissions').select('*').order('pagina')
      return data || []
    },
  })
}

function useRolePermissions(roleId: string | null) {
  return useQuery<string[]>({
    queryKey: [...RP_KEY, roleId],
    queryFn: async () => {
      if (!roleId) return []
      const { data } = await supabase.from('role_permissions').select('permission_id').eq('role_id', roleId)
      return (data || []).map(r => r.permission_id)
    },
    enabled: !!roleId,
  })
}

export function AdminRolesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: roles = [], isLoading } = useRoles()
  const { data: permissions = [] } = usePermissions()
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [permModal, setPermModal] = useState<Role | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#6366f1', nivel: 0 })

  const { data: selectedPerms = [] } = useRolePermissions(permModal?.id || null)

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('roles').insert(form)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); setCreateModal(false); toast('Cargo criado!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editRole) return
      const { error } = await supabase.from('roles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editRole.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); setEditRole(null); toast('Cargo atualizado!', 'success') },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); toast('Cargo removido', 'success') },
  })

  const duplicateMut = useMutation({
    mutationFn: async (src: Role) => {
      const { data: newRole, error } = await supabase.from('roles').insert({
        nome: `${src.nome} (Cópia)`, descricao: src.descricao, cor: src.cor, nivel: src.nivel,
      }).select().single()
      if (error) throw error
      const { data: perms } = await supabase.from('role_permissions').select('permission_id').eq('role_id', src.id)
      if (perms?.length) await supabase.from('role_permissions').insert(perms.map(p => ({ role_id: newRole.id, permission_id: p.permission_id })))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); toast('Cargo duplicado!', 'success') },
  })

  const togglePerm = useMutation({
    mutationFn: async ({ roleId, permId, has }: { roleId: string; permId: string; has: boolean }) => {
      if (has) {
        await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permId)
      } else {
        await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permId })
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: RP_KEY }) },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await supabase.from('roles').update({ ativo }).eq('id', id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ROLES_KEY }); toast('Status atualizado', 'success') },
  })

  if (isLoading) return <Loading text="Carregando cargos..." />

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-foreground">Cargos do Sistema</h2>
        <Button onClick={() => { setForm({ nome: '', descricao: '', cor: '#6366f1', nivel: 0 }); setCreateModal(true) }}
          className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Novo Cargo
        </Button>
      </div>

      {/* Roles list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {roles.map(role => (
          <div key={role.id} className={cn("bg-card/80 dark:bg-card/40 backdrop-blur-xl border rounded-[2.5rem] p-6 shadow-sm transition-all", role.ativo ? "border-border/50" : "border-rose-500/30 opacity-50")}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-inner" style={{ backgroundColor: role.cor + '15', color: role.cor }}>
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-foreground truncate">{role.nome}</h3>
                <p className="text-[10px] text-muted-foreground truncate">{role.descricao || 'Sem descrição'}</p>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">Nível {role.nivel}</span>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border/30">
              <button onClick={() => { setForm({ nome: role.nome, descricao: role.descricao || '', cor: role.cor, nivel: role.nivel }); setEditRole(role) }}
                className="flex-1 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center gap-1 text-xs font-bold transition-all">
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>
              <button onClick={() => setPermModal(role)}
                className="flex-1 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 flex items-center justify-center gap-1 text-xs font-bold transition-all">
                <Shield className="w-3.5 h-3.5" /> Permissões
              </button>
              <button onClick={() => duplicateMut.mutate(role)}
                className="w-10 h-10 rounded-xl bg-muted/50 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-all">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => toggleActive.mutate({ id: role.id, ativo: !role.ativo })}
                className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", role.ativo ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                {role.ativo ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
              <button onClick={() => { if (confirm(`Excluir cargo "${role.nome}"?`)) deleteMut.mutate(role.id) }}
                className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={createModal || !!editRole} onClose={() => { setCreateModal(false); setEditRole(null) }} title={editRole ? 'Editar Cargo' : 'Novo Cargo'}>
        <form onSubmit={e => { e.preventDefault(); editRole ? updateMut.mutate() : createMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold uppercase outline-none focus:border-primary/30" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Descrição</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cor</label>
              <input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                className="w-full h-12 rounded-2xl border border-border/50 cursor-pointer" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nível (0-100)</label>
              <input type="number" min={0} max={100} value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: +e.target.value }))}
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setCreateModal(false); setEditRole(null) }} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Permissions Matrix Modal */}
      <Modal open={!!permModal} onClose={() => setPermModal(null)} title={`Permissões — ${permModal?.nome}`}>
        {permModal && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {SYSTEM_PAGES.map(page => {
              const pagePerms = permissions.filter(p => p.pagina === page)
              if (pagePerms.length === 0) return null
              return (
                <div key={page} className="bg-muted/30 rounded-2xl p-4 border border-border/30">
                  <h4 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">{PAGE_LABELS[page]}</h4>
                  <div className="flex flex-wrap gap-2">
                    {(['visualizar', 'editar', 'administrar'] as PermissionAction[]).map(acao => {
                      const perm = pagePerms.find(p => p.acao === acao)
                      if (!perm) return null
                      const has = selectedPerms.includes(perm.id)
                      return (
                        <button key={acao} onClick={() => togglePerm.mutate({ roleId: permModal.id, permId: perm.id, has })}
                          className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all",
                            has ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-muted/50 text-muted-foreground hover:border-primary/30"
                          )}>
                          {has && <Check className="w-3 h-3 inline mr-1" />}
                          {ACTION_LABELS[acao]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
