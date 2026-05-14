import { useState, useEffect } from 'react'
import { Settings, MapPin, Users, CalendarDays, Palette, Info, ChevronRight, Sun, Moon, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useTheme } from '../contexts/ThemeContext'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'

export interface Localidade { id: string; nome: string; setor: string }
export interface TipoEscala { id: string; letra: string; nome: string; bg: string; text: string; ring: string }

const DEFAULT_SETORES = ['Varrição', 'Orla', 'Porta a Porta']
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
  { id: 'repouso', letra: 'R', nome: 'Repouso', bg: 'bg-amber-400', text: 'text-amber-900', ring: 'ring-amber-300' },
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
  const updateConfig = useUpdateConfiguracao()

  // Load from Supabase
  const { data: dbSetores, isLoading: loadS } = useConfiguracao<string[]>('setores', DEFAULT_SETORES)
  const { data: dbLocs, isLoading: loadL } = useConfiguracao<Localidade[]>('localidades', DEFAULT_LOCALIDADES)
  const { data: dbTipos, isLoading: loadT } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)

  const [setores, setSetores] = useState<string[]>(DEFAULT_SETORES)
  const [localidades, setLocalidades] = useState<Localidade[]>(DEFAULT_LOCALIDADES)
  const [tipos, setTipos] = useState<TipoEscala[]>(DEFAULT_TIPOS_ESCALA)

  // Sync DB to local state
  useEffect(() => { if (dbSetores) setSetores(dbSetores) }, [dbSetores])
  useEffect(() => { if (dbLocs) setLocalidades(dbLocs) }, [dbLocs])
  useEffect(() => { if (dbTipos) setTipos(dbTipos) }, [dbTipos])

  const saveSetores = (s: string[]) => { setSetores(s); updateConfig.mutate({ chave: 'setores', valor: s }) }
  const saveLocalidades = (l: Localidade[]) => { setLocalidades(l); updateConfig.mutate({ chave: 'localidades', valor: l }) }
  const saveTipos = (t: TipoEscala[]) => { setTipos(t); updateConfig.mutate({ chave: 'tipos_escala', valor: t }) }

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
  const removeTipo = (id: string) => saveTipos(tipos.filter(t => t.id !== id))
  const saveEditTipo = () => {
    if (!editingTipo || !editingTipo.nome.trim() || !editingTipo.letra.trim()) return
    saveTipos(tipos.map(t => t.id === editingTipo.id ? editingTipo : t))
    setEditingTipo(null)
  }

  const resetAll = () => {
    saveSetores(DEFAULT_SETORES)
    saveLocalidades(DEFAULT_LOCALIDADES)
    saveTipos(DEFAULT_TIPOS_ESCALA)
    toast('Restaurado ao padrão', 'success')
  }

  const inp = "w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
  const sel = "px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"

  if (loadS || loadL || loadT) return <div className="main-content"><TopHeader title="Configurações" /><div className="py-20"><Loading text="Carregando..." /></div></div>

  return (
    <div className="main-content">
      <TopHeader title="Configurações" />
      <div className="px-4 pt-3 pb-24 space-y-3">
        {[
          { id: 'localidades', icon: MapPin, title: 'Localidades de Trabalho', desc: `${localidades.length} locais`, color: 'from-blue-500 to-blue-600' },
          { id: 'setores', icon: Users, title: 'Setores da Equipe', desc: `${setores.length} setores`, color: 'from-emerald-500 to-emerald-600' },
          { id: 'escala', icon: CalendarDays, title: 'Tipos de Escala', desc: `${tipos.length} status`, color: 'from-purple-500 to-purple-600' },
          { id: 'aparencia', icon: Palette, title: 'Aparência', desc: `Tema ${theme === 'dark' ? 'Escuro' : 'Claro'}`, color: 'from-amber-500 to-amber-600' },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}><s.icon className="w-5 h-5 text-white" /></div>
            <div className="flex-1 text-left"><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.title}</h3><p className="text-xs text-slate-500">{s.desc}</p></div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        ))}
        <button onClick={resetAll} className="w-full text-center text-xs text-red-500 font-semibold py-3 hover:underline">Restaurar padrão</button>
      </div>

      <Modal open={activeSection === 'localidades'} onClose={() => setActiveSection(null)} title="Localidades">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="flex gap-2">
            <input type="text" placeholder="Localidade..." value={newLoc.nome} onChange={e => setNewLoc({ ...newLoc, nome: e.target.value })} className={`${inp} flex-1`} />
            <select value={newLoc.setor} onChange={e => setNewLoc({ ...newLoc, setor: e.target.value })} className={sel}><option value="">Setor</option>{setores.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <button onClick={addLocalidade} className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0"><Plus className="w-4 h-4" /></button>
          </div>
          {setores.map(setor => {
            const locs = localidades.filter(l => l.setor === setor)
            if (!locs.length) return null
            return (<div key={setor}><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">{setor}</h4><div className="space-y-1">{locs.map(l => (
              <div key={l.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 group shadow-sm">
                {editingLoc?.id === l.id ? (<>
                  <input type="text" value={editingLoc.nome} onChange={e => setEditingLoc({ ...editingLoc, nome: e.target.value })} className={`${inp} flex-1 !py-1.5 text-xs`} />
                  <select value={editingLoc.setor} onChange={e => setEditingLoc({ ...editingLoc, setor: e.target.value })} className={`${sel} !py-1.5 text-xs`}>{setores.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <button onClick={saveEditLoc} className="text-green-600 p-1"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setEditingLoc(null)} className="text-slate-400 p-1"><X className="w-4 h-4" /></button>
                </>) : (<>
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{l.nome}</span>
                  <button onClick={() => setEditingLoc(l)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeLocalidade(l.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </>)}
              </div>
            ))}</div></div>)
          })}
        </div>
      </Modal>

      <Modal open={activeSection === 'setores'} onClose={() => setActiveSection(null)} title="Setores">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="Setor..." value={newSetor} onChange={e => setNewSetor(e.target.value)} className={`${inp} flex-1`} onKeyDown={e => e.key === 'Enter' && addSetor()} />
            <button onClick={addSetor} className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">{setores.map((setor, idx) => (
            <div key={setor} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 group shadow-sm">
              {editingSetor?.idx === idx ? (<>
                <input type="text" value={editingSetor.value} onChange={e => setEditingSetor({ ...editingSetor, value: e.target.value })} className={`${inp} flex-1 !py-1.5`} onKeyDown={e => e.key === 'Enter' && saveEditSetor()} />
                <button onClick={saveEditSetor} className="text-green-600 p-1.5"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditingSetor(null)} className="text-slate-400 p-1.5"><X className="w-4 h-4" /></button>
              </>) : (<>
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{setor}</span>
                <button onClick={() => setEditingSetor({ idx, value: setor })} className="text-slate-400 hover:text-blue-500 p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeSetor(setor)} className="text-slate-400 hover:text-red-500 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
              </>)}
            </div>
          ))}</div>
        </div>
      </Modal>

      <Modal open={activeSection === 'escala'} onClose={() => setActiveSection(null)} title="Tipos de Escala">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Add form */}
          <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
            <input type="text" placeholder="Sigla (T)" value={newTipo.letra} onChange={e => setNewTipo({ ...newTipo, letra: e.target.value.substring(0, 3) })} className={`${inp} w-16 text-center uppercase !py-1.5`} />
            <input type="text" placeholder="Nome" value={newTipo.nome} onChange={e => setNewTipo({ ...newTipo, nome: e.target.value })} className={`${inp} flex-1 !py-1.5`} />
            <select value={newTipo.corIndex} onChange={e => setNewTipo({ ...newTipo, corIndex: parseInt(e.target.value) })} className={`${sel} w-12 !p-0 flex items-center justify-center`}>
              {COLORS.map((c, i) => <option key={i} value={i} className={c.bg}>Cor {i + 1}</option>)}
            </select>
            <div className={`w-8 h-8 rounded-lg ${COLORS[newTipo.corIndex].bg} shrink-0`}></div>
            <button onClick={addTipo} className="w-8 h-8 bg-purple-600 text-white rounded-xl flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>

          <div className="space-y-2">
            {tipos.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 shadow-sm">
                {editingTipo?.id === t.id ? (
                  <>
                    <input type="text" value={editingTipo.letra} onChange={e => setEditingTipo({ ...editingTipo, letra: e.target.value.substring(0, 3).toUpperCase() })} className={`${inp} w-12 text-center uppercase !py-1.5 text-xs`} />
                    <input type="text" value={editingTipo.nome} onChange={e => setEditingTipo({ ...editingTipo, nome: e.target.value })} className={`${inp} flex-1 !py-1.5 text-xs`} />
                    <button onClick={saveEditTipo} className="text-green-600 p-1"><Save className="w-4 h-4" /></button>
                    <button onClick={() => setEditingTipo(null)} className="text-slate-400 p-1"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <div className={`w-8 h-8 rounded-lg ${t.bg} ${t.text} font-black text-xs flex items-center justify-center shadow-sm shrink-0`}>{t.letra}</div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{t.nome}</span>
                    <button onClick={() => setEditingTipo(t)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    {t.id !== 'presente' && <button onClick={() => removeTipo(t.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={activeSection === 'aparencia'} onClose={() => setActiveSection(null)} title="Aparência">
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</p></div>
          </div>
          <button onClick={toggleTheme} className={`w-12 h-7 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'} relative`}>
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </Modal>
    </div>
  )
}
