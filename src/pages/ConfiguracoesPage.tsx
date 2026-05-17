import { useState, useEffect } from 'react'
import { Settings, MapPin, Users, CalendarDays, Palette, Info, ChevronRight, Sun, Moon, Plus, Trash2, Edit2, Save, X, CheckCircle2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useTheme } from '../contexts/ThemeContext'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { cn } from '../lib/utils'

export interface Localidade { id: string; nome: string; setor: string }
export interface TipoEscala { id: string; letra: string; nome: string; bg: string; text: string; ring: string }
export interface Feriado { id: string; nome: string; data: string }

export const DEFAULT_SETORES = ['Varrição', 'Orla', 'Porta a Porta']
const DEFAULT_LOCALIDADES: Localidade[] = [
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
  { id: 'repouso', letra: 'D', nome: 'Descanso', bg: 'bg-amber-400', text: 'text-amber-900', ring: 'ring-amber-300' },
  { id: 'compensar', letra: 'F', nome: 'Folga', bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-400' },
  { id: 'ferias', letra: 'FE', nome: 'Férias', bg: 'bg-purple-500', text: 'text-white', ring: 'ring-purple-400' },
  { id: 'atestado', letra: 'A', nome: 'Afastamento', bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-400' },
  { id: 'falta', letra: 'X', nome: 'Falta', bg: 'bg-rose-600', text: 'text-white', ring: 'ring-rose-500' },
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
  { bg: 'bg-slate-700', text: 'text-white', ring: 'ring-slate-600' },
  { bg: 'bg-violet-500', text: 'text-white', ring: 'ring-violet-400' },
]

export function ConfiguracoesPage() {
  const { theme, toggleTheme } = useTheme()
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [newFeriado, setNewFeriado] = useState({ nome: '', data: '' })
  const updateConfig = useUpdateConfiguracao()

  // Load from Supabase
  const { data: dbSetores, isLoading: loadS } = useConfiguracao<string[]>('setores', DEFAULT_SETORES)
  const { data: dbLocs, isLoading: loadL } = useConfiguracao<Localidade[]>('localidades', DEFAULT_LOCALIDADES)
  const { data: dbTipos, isLoading: loadT } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const { data: dbFeriados, isLoading: loadF } = useConfiguracao<Feriado[]>('feriados', [])

  const [setores, setSetores] = useState<string[]>(DEFAULT_SETORES)
  const [localidades, setLocalidades] = useState<Localidade[]>(DEFAULT_LOCALIDADES)
  const [tipos, setTipos] = useState<TipoEscala[]>(DEFAULT_TIPOS_ESCALA)
  const [feriados, setFeriados] = useState<Feriado[]>([])

  // Sync DB to local state
  useEffect(() => { if (dbSetores) setSetores(dbSetores) }, [dbSetores])
  useEffect(() => { if (dbLocs) setLocalidades(dbLocs) }, [dbLocs])
  useEffect(() => { if (dbTipos) setTipos(dbTipos) }, [dbTipos])
  useEffect(() => { if (dbFeriados) setFeriados(dbFeriados) }, [dbFeriados])

  const saveSetores = (s: string[]) => { setSetores(s); updateConfig.mutate({ chave: 'setores', valor: s }) }
  const saveLocalidades = (l: Localidade[]) => { setLocalidades(l); updateConfig.mutate({ chave: 'localidades', valor: l }) }
  const saveTipos = (t: TipoEscala[]) => { setTipos(t); updateConfig.mutate({ chave: 'tipos_escala', valor: t }) }
  const saveFeriados = (f: Feriado[]) => { setFeriados(f); updateConfig.mutate({ chave: 'feriados', valor: f }) }

  // ─── Setores ───
  const [newSetor, setNewSetor] = useState('')
  const [editingSetor, setEditingSetor] = useState<{ idx: number; value: string } | null>(null)
  const addSetor = () => {
    if (!newSetor.trim() || setores.includes(newSetor.trim())) return
    saveSetores([...setores, newSetor.trim()]); setNewSetor('')
  }
  const removeSetor = (s: string) => { saveSetores(setores.filter(x => x !== s)); saveLocalidades(localidades.filter(l => l.setor !== s)) }
  const saveEditSetor = () => {
    if (!editingSetor || !editingSetor.value.trim()) return
    const oldName = setores[editingSetor.idx]
    const updated = [...setores]; updated[editingSetor.idx] = editingSetor.value.trim()
    saveSetores(updated)
    saveLocalidades(localidades.map(l => l.setor === oldName ? { ...l, setor: editingSetor.value.trim() } : l))
    setEditingSetor(null)
  }

  // ─── Localidades ───
  const [newLoc, setNewLoc] = useState({ nome: '', setor: '' })
  const [editingLoc, setEditingLoc] = useState<Localidade | null>(null)
  const addLocalidade = () => {
    if (!newLoc.nome.trim() || !newLoc.setor) return
    saveLocalidades([...localidades, { id: `loc_${Date.now()}`, nome: newLoc.nome.trim(), setor: newLoc.setor }])
    setNewLoc({ nome: '', setor: '' })
  }
  const removeLocalidade = (id: string) => saveLocalidades(localidades.filter(l => l.id !== id))
  const saveEditLoc = () => {
    if (!editingLoc || !editingLoc.nome.trim()) return
    saveLocalidades(localidades.map(l => l.id === editingLoc.id ? { ...editingLoc, nome: editingLoc.nome.trim() } : l))
    setEditingLoc(null)
  }

  // ─── Tipos de Escala ───
  const [newTipo, setNewTipo] = useState({ letra: '', nome: '', corIndex: 0 })
  const [editingTipo, setEditingTipo] = useState<TipoEscala | null>(null)
  
  const addTipo = () => {
    if (!newTipo.letra.trim() || !newTipo.nome.trim()) return toast('Letra e nome obrigatórios', 'warning')
    const color = COLORS[newTipo.corIndex]
    const id = newTipo.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')
    saveTipos([...tipos, { id, letra: newTipo.letra.trim().toUpperCase(), nome: newTipo.nome.trim(), ...color }])
    setNewTipo({ letra: '', nome: '', corIndex: 0 })
  }
  
  const removeTipo = (id: string) => {
    if (id === 'presente') return toast('Status principal não pode ser removido', 'error')
    saveTipos(tipos.filter(t => t.id !== id))
  }
  
  const saveEditTipo = () => {
    if (!editingTipo || !editingTipo.nome.trim() || !editingTipo.letra.trim()) return
    saveTipos(tipos.map(t => t.id === editingTipo.id ? editingTipo : t))
    setEditingTipo(null)
    toast('Tipo de escala atualizado!', 'success')
  }
  
  const moveTipo = (id: string, dir: 'up' | 'down') => {
    const idx = tipos.findIndex(t => t.id === id)
    if (idx === -1) return
    const newTipos = [...tipos]
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= tipos.length) return
    
    // Swap items
    const temp = newTipos[idx]
    newTipos[idx] = newTipos[targetIdx]
    newTipos[targetIdx] = temp
    
    saveTipos(newTipos)
    toast('Ordem atualizada', 'info')
  }

  const resetAll = () => {
    if (!confirm('Deseja realmente restaurar todas as configurações para o padrão de fábrica? Isso removerá suas personalizações.')) return
    saveSetores(DEFAULT_SETORES)
    saveLocalidades(DEFAULT_LOCALIDADES)
    saveTipos(DEFAULT_TIPOS_ESCALA)
    saveFeriados([])
    toast('Restaurado ao padrão', 'success')
  }

  const inp = "w-full px-3 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-foreground placeholder:text-muted-foreground transition-all"
  const sel = "px-3 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none text-foreground"

  if (loadS || loadL || loadT || loadF) return <div className="min-h-screen bg-background"><TopHeader title="Configurações" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Configurações" subtitle="Ajustes do Sistema" />
      
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Elite Glass Toolbar */}
        <div className="bg-card/80 dark:bg-card/50 backdrop-blur-xl border border-border/50 rounded-[3rem] p-6 shadow-sm mb-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <Settings className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight leading-none">Preferências</h2>
              <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mt-1.5">Personalize o comportamento do sistema</p>
            </div>
          </div>
          <Button variant="ghost" onClick={resetAll} className="rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 border border-transparent hover:border-rose-500/20 px-6 py-4">
            <X className="w-4 h-4" /> Restaurar Padrão
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { id: 'localidades', icon: MapPin, title: 'Localidades', desc: `${localidades.length} locais de trabalho`, color: 'from-blue-500 to-blue-600' },
            { id: 'setores', icon: Users, title: 'Setores', desc: `${setores.length} divisões de equipe`, color: 'from-emerald-500 to-emerald-600' },
            { id: 'escala', icon: Palette, title: 'Tipos de Escala', desc: `${tipos.length} modelos definidos`, color: 'from-purple-500 to-purple-600' },
            { id: 'feriados', icon: CalendarDays, title: 'Feriados', desc: `${feriados.length} datas especiais`, color: 'from-rose-500 to-rose-600' },
            { id: 'aparencia', icon: theme === 'dark' ? Moon : Sun, title: 'Aparência', desc: `Modo ${theme === 'dark' ? 'Escuro' : 'Claro'} ativo`, color: 'from-amber-500 to-amber-600' },
          ].map(s => (
            <button 
              key={s.id} 
              onClick={() => setActiveSection(s.id)} 
              className="w-full group flex flex-col items-start gap-6 p-10 bg-card/80 dark:bg-card/40 backdrop-blur-xl rounded-[3rem] border border-border/50 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] group-hover:bg-primary/10 transition-colors" />
              
              <div className={`w-16 h-16 rounded-[1.25rem] bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg shadow-black/5 group-hover:rotate-6 transition-transform duration-500`}>
                <s.icon className="w-8 h-8 text-white" />
              </div>
              
              <div>
                <h3 className="text-2xl font-black text-foreground tracking-tight">{s.title}</h3>
                <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-[0.2em] mt-2">{s.desc}</p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Gerenciar <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>


      {/* Modal Localidades */}
      <Modal open={activeSection === 'localidades'} onClose={() => setActiveSection(null)} title="Localidades">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          <div className="bg-muted/30 p-5 rounded-[2rem] border border-border/50 space-y-4">
             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Nova Localidade</h4>
             <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Nome do local..." value={newLoc.nome} onChange={e => setNewLoc({ ...newLoc, nome: e.target.value })} className={`${inp} flex-1`} />
              <select value={newLoc.setor} onChange={e => setNewLoc({ ...newLoc, setor: e.target.value })} className={sel}><option value="">Setor...</option>{setores.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button onClick={addLocalidade} className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 active:scale-90 transition-all"><Plus className="w-6 h-6" /></button>
            </div>
          </div>
          
          {setores.map(setor => {
            const locs = localidades.filter(l => l.setor === setor)
            if (!locs.length) return null
            return (
              <div key={setor} className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{setor}</h4>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {locs.map(l => (
                    <div key={l.id} className="flex items-center gap-4 p-4 bg-card rounded-[1.5rem] border border-border/50 shadow-sm group hover:border-blue-500/30 transition-all">
                      {editingLoc?.id === l.id ? (
                        <div className="flex-1 flex gap-3">
                          <input type="text" value={editingLoc.nome} onChange={e => setEditingLoc({ ...editingLoc, nome: e.target.value })} className={`${inp} !py-1.5`} />
                          <button onClick={saveEditLoc} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0"><Save className="w-4 h-4" /></button>
                          <button onClick={() => setEditingLoc(null)} className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-black text-foreground flex-1 tracking-tight">{l.nome}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingLoc(l)} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => removeLocalidade(l.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Modal Setores */}
      <Modal open={activeSection === 'setores'} onClose={() => setActiveSection(null)} title="Setores">
        <div className="space-y-6">
          <div className="bg-muted/30 p-5 rounded-[2rem] border border-border/50 space-y-4">
             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Novo Setor Operacional</h4>
             <div className="flex gap-3">
              <input type="text" placeholder="Nome do setor..." value={newSetor} onChange={e => setNewSetor(e.target.value)} className={`${inp} flex-1`} onKeyDown={e => e.key === 'Enter' && addSetor()} />
              <button onClick={addSetor} className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"><Plus className="w-6 h-6" /></button>
            </div>
          </div>

          <div className="space-y-3">{setores.map((setor, idx) => (
            <div key={setor} className="flex items-center gap-4 p-4 bg-card rounded-[1.5rem] border border-border/50 shadow-sm group hover:border-emerald-500/30 transition-all">
              {editingSetor?.idx === idx ? (
                <div className="flex-1 flex gap-3">
                  <input type="text" value={editingSetor.value} onChange={e => setEditingSetor({ ...editingSetor, value: e.target.value })} className={`${inp} !py-1.5`} onKeyDown={e => e.key === 'Enter' && saveEditSetor()} />
                  <button onClick={saveEditSetor} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setEditingSetor(null)} className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-black text-foreground flex-1 tracking-tight">{setor}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingSetor({ idx, value: setor })} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => removeSetor(setor)} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>
          ))}</div>
        </div>
      </Modal>

      {/* Modal Tipos de Escala - IMPROVED RE-ORDERING */}
      <Modal open={activeSection === 'escala'} onClose={() => setActiveSection(null)} title="Tipos de Escala">
        <div className="space-y-8 max-h-[75vh] overflow-y-auto px-1">
          {/* Section: Add New */}
          <div className="bg-muted/30 p-6 rounded-[2.5rem] border border-border/50 space-y-6">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.3em] px-1">Criar Novo Modelo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground ml-2">Nome Amigável</label>
                <input 
                  type="text" 
                  placeholder="Ex: Treinamento" 
                  value={newTipo.nome} 
                  onChange={e => setNewTipo({ ...newTipo, nome: e.target.value })} 
                  className={inp} 
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground ml-2">Identificador (Sigla)</label>
                <input 
                  type="text" 
                  placeholder="T" 
                  maxLength={3}
                  value={newTipo.letra} 
                  onChange={e => setNewTipo({ ...newTipo, letra: e.target.value.toUpperCase() })} 
                  className={`${inp} text-center font-black tracking-widest`} 
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black uppercase text-muted-foreground ml-2">Identidade Visual</label>
              <div className="flex flex-wrap gap-3 p-1">
                {COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setNewTipo({ ...newTipo, corIndex: i })}
                    className={cn(
                      "w-12 h-12 rounded-[1.25rem] transition-all relative overflow-hidden shadow-sm",
                      c.bg,
                      newTipo.corIndex === i ? "ring-4 ring-primary/40 scale-110 shadow-lg z-10" : "opacity-60 hover:opacity-100 hover:scale-105"
                    )}
                  >
                    {newTipo.corIndex === i && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 text-white">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between border-t border-border/50 gap-6">
              <div className="flex items-center gap-4 bg-background/50 px-6 py-3 rounded-2xl border border-border/30">
                <span className="text-[9px] font-black uppercase text-muted-foreground/60">Visualização:</span>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl",
                  COLORS[newTipo.corIndex].bg,
                  COLORS[newTipo.corIndex].text
                )}>
                  {newTipo.letra || '?'}
                </div>
              </div>
              <Button onClick={addTipo} className="w-full sm:w-auto rounded-2xl gap-3 font-black text-xs uppercase tracking-widest px-10 h-14 shadow-lg shadow-primary/20">
                <Plus className="w-5 h-5" /> Adicionar Modelo
              </Button>
            </div>
          </div>

          {/* Section: List & Order */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Modelos Ativos & Ordem</h4>
              <span className="text-[9px] font-bold text-primary/60 uppercase italic">Organize por prioridade</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {tipos.map((t, i) => (
                <div key={t.id} className="group relative bg-card dark:bg-card/40 rounded-[2rem] border border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden">
                   {/* Background accent */}
                   <div className={cn("absolute left-0 top-0 bottom-0 w-2 opacity-20", t.bg)} />

                   <div className="p-5 flex items-center gap-5">
                      {/* Drag/Order Handles */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                         <button 
                           disabled={i === 0}
                           onClick={() => moveTipo(t.id, 'up')} 
                           className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-10 transition-all active:scale-75"
                         >
                           <ArrowUp className="w-5 h-5" />
                         </button>
                         <button 
                           disabled={i === tipos.length - 1}
                           onClick={() => moveTipo(t.id, 'down')} 
                           className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-10 transition-all active:scale-75"
                         >
                           <ArrowDown className="w-5 h-5" />
                         </button>
                      </div>

                      {editingTipo?.id === t.id ? (
                        <div className="flex-1 space-y-5 py-2">
                           <div className="flex gap-4">
                              <input 
                                type="text" 
                                value={editingTipo.letra} 
                                maxLength={3}
                                onChange={e => setEditingTipo({ ...editingTipo, letra: e.target.value.toUpperCase() })} 
                                className={`${inp} w-20 text-center font-black tracking-widest !py-3`} 
                              />
                              <input 
                                type="text" 
                                value={editingTipo.nome} 
                                onChange={e => setEditingTipo({ ...editingTipo, nome: e.target.value })} 
                                className={`${inp} flex-1 !py-3 font-bold`} 
                              />
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {COLORS.map((c, ci) => (
                                <button
                                  key={ci}
                                  onClick={() => setEditingTipo({ ...editingTipo, ...c })}
                                  className={cn("w-8 h-8 rounded-lg transition-all", c.bg, editingTipo.bg === c.bg ? "ring-4 ring-primary/40 scale-110" : "opacity-40")}
                                />
                              ))}
                           </div>
                           <div className="flex justify-end gap-3 pt-2">
                              <Button variant="ghost" onClick={() => setEditingTipo(null)} className="h-10 text-[10px] uppercase font-black tracking-widest px-6">Cancelar</Button>
                              <Button onClick={saveEditTipo} className="h-10 text-[10px] uppercase font-black tracking-widest px-8 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20">Salvar</Button>
                           </div>
                        </div>
                      ) : (
                        <>
                           <div className={cn(
                             "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shrink-0 transition-transform group-hover:rotate-6 duration-500",
                             t.bg, t.text
                           )}>
                             {t.letra}
                           </div>
                           <div className="flex-1">
                             <h5 className="text-lg font-black text-foreground tracking-tight leading-none mb-2">{t.nome}</h5>
                             <div className="flex items-center gap-4">
                                <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                                   <GripVertical className="w-3 h-3" /> Posição: {i + 1}
                                </span>
                                {t.id === 'presente' && (
                                   <span className="bg-primary/10 text-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">Padrão</span>
                                )}
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <button onClick={() => setEditingTipo(t)} className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-90"><Edit2 className="w-5 h-5" /></button>
                              {t.id !== 'presente' && (
                                <button onClick={() => removeTipo(t.id)} className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90"><Trash2 className="w-5 h-5" /></button>
                              )}
                           </div>
                        </>
                      )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Outros Modais mantidos conforme padrão anterior para consistência */}
      <Modal open={activeSection === 'feriados'} onClose={() => setActiveSection(null)} title="Feriados">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          <div className="bg-muted/30 p-5 rounded-[2rem] border border-border/50 space-y-4">
             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Novo Feriado</h4>
             <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Nome..." value={newFeriado.nome} onChange={e => setNewFeriado({ ...newFeriado, nome: e.target.value })} className={`${inp} flex-1`} />
              <input type="date" value={newFeriado.data} onChange={e => setNewFeriado({ ...newFeriado, data: e.target.value })} className={`${sel}`} />
              <button onClick={() => { if (!newFeriado.nome.trim() || !newFeriado.data) return; saveFeriados([...feriados, { id: `h_${Date.now()}`, nome: newFeriado.nome.trim(), data: newFeriado.data }]); setNewFeriado({ nome: '', data: '' }) }} className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20 active:scale-90 transition-all"><Plus className="w-6 h-6" /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {feriados.sort((a, b) => a.data.localeCompare(b.data)).map(f => (
              <div key={f.id} className="flex items-center gap-4 p-4 bg-card rounded-[1.5rem] border border-border/50 shadow-sm group hover:border-amber-500/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600"><CalendarDays className="w-5 h-5" /></div>
                <div className="flex-1">
                  <p className="text-sm font-black text-foreground">{f.nome}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">{new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                </div>
                <button onClick={() => saveFeriados(feriados.filter(x => x.id !== f.id))} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={activeSection === 'aparencia'} onClose={() => setActiveSection(null)} title="Aparência">
        <div className="flex items-center justify-between p-6 bg-card rounded-[2rem] border border-border/50 shadow-sm">
          <div className="flex items-center gap-5">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", theme === 'dark' ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500")}>
              {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-lg font-black text-foreground leading-none">Modo {theme === 'dark' ? 'Noturno' : 'Diurno'}</p>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1.5 opacity-60">Alterar visual do sistema</p>
            </div>
          </div>
          <button onClick={toggleTheme} className={`w-14 h-8 rounded-full transition-all p-1 ${theme === 'dark' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-muted-foreground/30'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </Modal>
    </div>
  )
}
