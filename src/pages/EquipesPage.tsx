import React, { useState } from 'react'
import { Plus, Search, Users, UserCheck, X, Shield, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { TopHeader } from '../components/layout/TopHeader'
import { cn } from '../lib/utils'
import type { Funcionario } from '../lib/database.types'

interface Equipe {
  id: string; nome: string; descricao: string | null; cor: string; ativo: boolean
  encarregados: Pick<Funcionario, 'id' | 'nome' | 'apelido'>[]
  membros: Pick<Funcionario, 'id' | 'nome' | 'apelido' | 'cargo'>[]
}

const EQUIPES_KEY = ['equipes']
const COLORS = ['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4']

function useEquipes() {
  return useQuery<Equipe[]>({
    queryKey: EQUIPES_KEY,
    queryFn: async () => {
      const { data: equipes } = await supabase.from('equipes').select('*').order('nome')
      if (!equipes) return []
      const { data: enc } = await supabase.from('equipe_encarregados').select('equipe_id, funcionarios(id, nome, apelido)')
      const { data: mem } = await supabase.from('equipe_membros').select('equipe_id, funcionarios(id, nome, apelido, cargo)')
      return equipes.map(eq => ({
        ...eq,
        encarregados: (enc || []).filter((e: any) => e.equipe_id === eq.id).map((e: any) => e.funcionarios).filter(Boolean),
        membros: (mem || []).filter((m: any) => m.equipe_id === eq.id).map((m: any) => m.funcionarios).filter(Boolean),
      }))
    },
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
  const { data: equipes = [], isLoading } = useEquipes()
  const { data: funcionarios = [] } = useFuncionariosAtivos()
  const [search, setSearch] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState<Equipe | null>(null)
  const [manageModal, setManageModal] = useState<Equipe | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', cor: COLORS[0] })
  const [tab, setTab] = useState<'encarregados' | 'membros'>('membros')
  const [memSearch, setMemSearch] = useState('')

  const filtered = equipes.filter(eq => eq.nome.toLowerCase().includes(search.toLowerCase()))

  // All funcionário IDs already assigned as members in any team
  const assignedMemberIds = new Set(equipes.flatMap(eq => eq.membros.map(m => m.id)))

  const encarregados = funcionarios.filter(f => f.cargo === 'Encarregado')

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('equipes').insert({ nome: form.nome, descricao: form.descricao || null, cor: form.cor })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); setCreateModal(false); toast('Equipe criada!', 'success') },
    onError: (e: any) => toast(e.message, 'error'),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editModal) return
      const { error } = await supabase.from('equipes').update({ nome: form.nome, descricao: form.descricao || null, cor: form.cor }).eq('id', editModal.id)
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

  const addEncarregado = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      const { error } = await supabase.from('equipe_encarregados').insert({ equipe_id: equipeId, funcionario_id: funcId })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); toast('Encarregado adicionado', 'success') },
    onError: () => toast('Encarregado já está nesta equipe', 'error'),
  })

  const removeEncarregado = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      await supabase.from('equipe_encarregados').delete().eq('equipe_id', equipeId).eq('funcionario_id', funcId)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); toast('Encarregado removido', 'success') },
  })

  const addMembro = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      const { error } = await supabase.from('equipe_membros').insert({ equipe_id: equipeId, funcionario_id: funcId })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); toast('Membro adicionado', 'success') },
    onError: (e: any) => toast(e.message?.includes('unique') ? 'Funcionário já está em outra equipe' : e.message, 'error'),
  })

  const removeMembro = useMutation({
    mutationFn: async ({ equipeId, funcId }: { equipeId: string; funcId: string }) => {
      await supabase.from('equipe_membros').delete().eq('equipe_id', equipeId).eq('funcionario_id', funcId)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: EQUIPES_KEY }); toast('Membro removido', 'success') },
  })

  if (isLoading) return <Loading text="Carregando equipes..." />

  // Available members for the managed team (not assigned or in THIS team)
  const availableMembers = manageModal
    ? funcionarios.filter(f => f.cargo !== 'Encarregado' && !manageModal.membros.some(m => m.id === f.id) && !assignedMemberIds.has(f.id))
        .filter(f => !memSearch || f.nome.toLowerCase().includes(memSearch.toLowerCase()) || (f.apelido || '').toLowerCase().includes(memSearch.toLowerCase()))
    : []

  const availableEncarregados = manageModal
    ? encarregados.filter(e => !manageModal.encarregados.some(enc => enc.id === e.id))
        .filter(f => !memSearch || f.nome.toLowerCase().includes(memSearch.toLowerCase()))
    : []

  return (
    <div className="space-y-6 animate-fade-in pb-32">
      <TopHeader title="Equipes" subtitle={`${equipes.length} equipes cadastradas`} />

      {/* Toolbar */}
      <div className="px-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar equipe..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 focus:border-primary/30 outline-none" />
        </div>
        <Button onClick={() => { setForm({ nome: '', descricao: '', cor: COLORS[0] }); setCreateModal(true) }}
          className="h-12 px-6 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Nova Equipe
        </Button>
      </div>

      {/* Grid */}
      <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(eq => (
          <div key={eq.id} className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-lg" style={{ backgroundColor: eq.cor }}>
                {eq.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-foreground truncate">{eq.nome}</h3>
                {eq.descricao && <p className="text-[10px] text-muted-foreground truncate">{eq.descricao}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ nome: eq.nome, descricao: eq.descricao || '', cor: eq.cor }); setEditModal(eq) }}
                  className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => { if (confirm('Excluir equipe?')) deleteMut.mutate(eq.id) }}
                  className="w-9 h-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Encarregados badges */}
            <div className="mb-3">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Encarregados</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {eq.encarregados.length === 0 && <span className="text-[10px] text-muted-foreground/50 italic">Nenhum</span>}
                {eq.encarregados.map(enc => (
                  <span key={enc.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" style={{ borderColor: eq.cor + '40', color: eq.cor, backgroundColor: eq.cor + '10' }}>
                    <Shield className="w-3 h-3" /> {enc.apelido || enc.nome.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            {/* Members count */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">{eq.membros.length} membros</span>
              </div>
            </div>

            <Button onClick={() => { setManageModal(eq); setTab('membros'); setMemSearch('') }}
              className="w-full h-10 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-all">
              <UserCheck className="w-4 h-4 mr-2" /> Gerenciar Equipe
            </Button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 opacity-30">
          <Users className="w-16 h-16 mx-auto mb-4" />
          <p className="text-xs font-black uppercase tracking-widest">Nenhuma equipe encontrada</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={createModal || !!editModal} onClose={() => { setCreateModal(false); setEditModal(null) }} title={editModal ? 'Editar Equipe' : 'Nova Equipe'}>
        <form onSubmit={e => { e.preventDefault(); editModal ? updateMut.mutate() : createMut.mutate() }} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Nome da equipe" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Descrição</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-2xl text-sm font-bold outline-none focus:border-primary/30" placeholder="Descrição opcional" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, cor: c }))}
                  className={cn("w-8 h-8 rounded-xl transition-all", form.cor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setCreateModal(false); setEditModal(null) }} className="flex-1 h-12 rounded-2xl">Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending} className="flex-1 h-12 rounded-2xl bg-primary text-white font-black">
              {editModal ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Team Modal */}
      <Modal open={!!manageModal} onClose={() => setManageModal(null)} title={`Equipe: ${manageModal?.nome || ''}`}>
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button onClick={() => { setTab('membros'); setMemSearch('') }}
              className={cn("flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all", tab === 'membros' ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground')}>
              Membros ({manageModal?.membros.length || 0})
            </button>
            <button onClick={() => { setTab('encarregados'); setMemSearch('') }}
              className={cn("flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all", tab === 'encarregados' ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground')}>
              Encarregados ({manageModal?.encarregados.length || 0})
            </button>
          </div>

          {/* Current list */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {tab === 'membros' && manageModal?.membros.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-xl">
                <div>
                  <span className="text-sm font-bold">{m.apelido || m.nome}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">{m.cargo}</span>
                </div>
                <button onClick={() => removeMembro.mutate({ equipeId: manageModal.id, funcId: m.id })}
                  className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {tab === 'encarregados' && manageModal?.encarregados.map(e => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-xl">
                <span className="text-sm font-bold"><Shield className="w-3.5 h-3.5 inline mr-1.5 text-primary" />{e.apelido || e.nome}</span>
                <button onClick={() => removeEncarregado.mutate({ equipeId: manageModal!.id, funcId: e.id })}
                  className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {((tab === 'membros' && !manageModal?.membros.length) || (tab === 'encarregados' && !manageModal?.encarregados.length)) && (
              <p className="text-center text-xs text-muted-foreground py-4 italic">Nenhum {tab === 'membros' ? 'membro' : 'encarregado'} ainda</p>
            )}
          </div>

          {/* Add section */}
          <div className="border-t border-border/50 pt-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              Adicionar {tab === 'membros' ? 'Membro' : 'Encarregado'}
            </span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar funcionário..." value={memSearch} onChange={e => setMemSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm font-bold outline-none focus:border-primary/30" />
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto mt-2">
              {tab === 'membros' && availableMembers.slice(0, 20).map(f => (
                <button key={f.id} onClick={() => manageModal && addMembro.mutate({ equipeId: manageModal.id, funcId: f.id })}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-primary/10 transition-all text-left">
                  <div>
                    <span className="text-sm font-bold">{f.apelido || f.nome}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{f.cargo}</span>
                  </div>
                  <Plus className="w-4 h-4 text-primary" />
                </button>
              ))}
              {tab === 'encarregados' && availableEncarregados.slice(0, 20).map(f => (
                <button key={f.id} onClick={() => manageModal && addEncarregado.mutate({ equipeId: manageModal.id, funcId: f.id })}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-primary/10 transition-all text-left">
                  <span className="text-sm font-bold">{f.apelido || f.nome}</span>
                  <Plus className="w-4 h-4 text-primary" />
                </button>
              ))}
              {((tab === 'membros' && !availableMembers.length) || (tab === 'encarregados' && !availableEncarregados.length)) && (
                <p className="text-center text-[10px] text-muted-foreground py-2 italic">
                  {tab === 'membros' ? 'Nenhum funcionário disponível' : 'Nenhum encarregado disponível'}
                </p>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
