import React, { useState, useMemo } from 'react'
import { 
  format, 
  parseISO, 
  addDays, 
  eachDayOfInterval, 
  isWithinInterval,
  startOfDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Plus, 
  FileText, 
  User, 
  Calendar, 
  Trash2, 
  Search, 
  AlertCircle,
  FileUp,
  Download,
  Eye,
  Activity,
  UserCheck
} from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { useToast } from '../components/ui/Toast'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'
import { useBatchUpsertEscalas } from '../hooks/useEscalas'
import { cn } from '../lib/utils'

interface AtestadoRecord {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid: string
  motivo: string
  pdf_url?: string
  pdf_name?: string
  created_at: string
}

export function AtestadosPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    funcionario_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    cid: '',
    motivo: '',
    pdf_url: '',
    pdf_name: ''
  })

  // Data fetching
  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: atestados = [], isLoading: loadA } = useConfiguracao<AtestadoRecord[]>('atestados_records', [])
  const updateConfig = useUpdateConfiguracao()
  const batchEscala = useBatchUpsertEscalas()

  const funcMap = useMemo(() => {
    const map: Record<string, any> = {}
    allFuncionarios.forEach(f => { map[f.id] = f })
    return map
  }, [allFuncionarios])

  const filteredAtestados = useMemo(() => {
    return atestados
      .filter(a => {
        const f = funcMap[a.funcionario_id]
        if (!f) return false
        return f.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
               a.cid.toLowerCase().includes(searchTerm.toLowerCase())
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [atestados, searchTerm, funcMap])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      return toast('Por favor, selecione apenas arquivos PDF', 'error')
    }

    setIsUploading(true)
    // Simulate upload - In a real scenario we would use Supabase Storage
    setTimeout(() => {
      setFormData(prev => ({ 
        ...prev, 
        pdf_name: file.name,
        pdf_url: 'blob:https://elite-storage.mock/' + Math.random().toString(36).substring(7) 
      }))
      setIsUploading(false)
      toast('PDF anexado com sucesso!', 'success')
    }, 1500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.funcionario_id || !formData.data_inicio || !formData.data_fim) {
      return toast('Preencha os campos obrigatórios', 'warning')
    }

    try {
      const newRecord: AtestadoRecord = {
        id: `at_${Date.now()}`,
        ...formData,
        created_at: new Date().toISOString()
      }

      // 1. Save to Registry
      await updateConfig.mutateAsync({
        chave: 'atestados_records',
        valor: [newRecord, ...atestados]
      })

      // 2. Update Escala for the period
      const start = parseISO(formData.data_inicio)
      const end = parseISO(formData.data_fim)
      const days = eachDayOfInterval({ start, end })

      const escalaUpdates = days.map(day => ({
        funcionario_id: formData.funcionario_id,
        data: format(day, 'yyyy-MM-dd'),
        tipo: 'atestado',
        observacoes: `Atestado: ${formData.cid} - ${formData.motivo}`,
        turno: 'integral' as const
      }))

      await batchEscala.mutateAsync(escalaUpdates)

      toast('Atestado registrado e escala atualizada!', 'success')
      setIsModalOpen(false)
      setFormData({
        funcionario_id: '',
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        data_fim: format(new Date(), 'yyyy-MM-dd'),
        cid: '',
        motivo: '',
        pdf_url: '',
        pdf_name: ''
      })
    } catch (err: any) {
      toast('Erro ao salvar: ' + err.message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este registro de atestado? (Nota: Isso não removerá automaticamente os dias já marcados na escala)')) return
    
    try {
      await updateConfig.mutateAsync({
        chave: 'atestados_records',
        valor: atestados.filter(a => a.id !== id)
      })
      toast('Registro removido', 'success')
    } catch (err: any) {
      toast('Erro ao remover: ' + err.message, 'error')
    }
  }

  if (loadF || loadA) return <div className="min-h-screen bg-background"><TopHeader title="Atestados" /><div className="py-32"><Loading text="Carregando registros..." /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Gestão de Atestados" subtitle="Controle Médico e Afastamentos" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Elite Glass Header Toolbar */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center shadow-inner">
              <Activity className="w-7 h-7 text-rose-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight leading-none">Afastamentos</h2>
              <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-[0.2em] mt-1.5">{atestados.length} registros ativos no sistema</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input 
                type="text" 
                placeholder="Buscar funcionário..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:ring-0 transition-all"
              />
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest px-8 h-12 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Novo Atestado
            </Button>
          </div>
        </div>

        {/* Tactical List */}
        <div className="space-y-4">
          {filteredAtestados.length > 0 ? filteredAtestados.map(a => (
            <div key={a.id} className="group bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-500 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-rose-500/10 transition-colors" />
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner group-hover:rotate-3 transition-transform">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="truncate">
                      <p className="text-lg font-black text-foreground truncate tracking-tight">{funcMap[a.funcionario_id]?.nome || 'Funcionário Removido'}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> 
                          {format(parseISO(a.data_inicio), 'dd/MM')} — {format(parseISO(a.data_fim), 'dd/MM/yyyy')}
                        </span>
                        <span className="bg-rose-500/10 text-rose-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
                          CID: {a.cid || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {a.pdf_url && (
                      <button className="flex items-center gap-2 px-4 py-2 bg-muted/50 text-[10px] font-black uppercase text-muted-foreground hover:bg-primary hover:text-white rounded-xl transition-all">
                        <Eye className="w-4 h-4" /> Ver PDF
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(a.id)}
                      className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
               </div>
               
               {a.motivo && (
                 <div className="mt-5 p-4 bg-muted/20 rounded-2xl border border-border/30">
                    <p className="text-xs text-muted-foreground font-medium italic">"{a.motivo}"</p>
                 </div>
               )}
            </div>
          )) : (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-muted/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-muted-foreground/20">
                <FileText className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight">Nenhum atestado encontrado</h3>
              <p className="text-sm text-muted-foreground mt-2">Clique em "Novo Atestado" para registrar o primeiro.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Atestado */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Atestado Médico">
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto px-1">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Funcionário</label>
            <select 
              value={formData.funcionario_id}
              onChange={e => setFormData({ ...formData, funcionario_id: e.target.value })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
            >
              <option value="">Selecione um funcionário...</option>
              {allFuncionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome} ({f.setor})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Data Inicial</label>
              <input 
                type="date" 
                value={formData.data_inicio}
                onChange={e => setFormData({ ...formData, data_inicio: e.target.value })}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
              />
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Data Final</label>
              <input 
                type="date" 
                value={formData.data_fim}
                onChange={e => setFormData({ ...formData, data_fim: e.target.value })}
                className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">CID (Código Internacional de Doenças)</label>
            <input 
              type="text" 
              placeholder="Ex: M54.5"
              value={formData.cid}
              onChange={e => setFormData({ ...formData, cid: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Observações / Motivo</label>
            <textarea 
              placeholder="Detalhes adicionais..."
              value={formData.motivo}
              onChange={e => setFormData({ ...formData, motivo: e.target.value })}
              className="w-full px-4 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-0 text-foreground h-32 resize-none"
            />
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Anexo PDF</label>
             <div className="relative">
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={cn(
                  "w-full p-6 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all",
                  formData.pdf_name ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/50 bg-muted/20 hover:bg-muted/30"
                )}>
                  {isUploading ? (
                    <Loading size="sm" text="Fazendo upload..." />
                  ) : formData.pdf_name ? (
                    <>
                      <FileText className="w-10 h-10 text-emerald-500" />
                      <p className="text-sm font-black text-emerald-600 truncate max-w-full px-4">{formData.pdf_name}</p>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, pdf_name: '', pdf_url: '' }))} className="text-[9px] font-black uppercase text-rose-500 hover:underline">Remover</button>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-xs font-bold text-muted-foreground">Arraste ou clique para anexar o PDF</p>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Limite 5MB</p>
                    </>
                  )}
                </div>
             </div>
          </div>

          <div className="pt-6 border-t border-border/30 flex gap-4">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</Button>
            <Button type="submit" className="flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest h-14 shadow-lg shadow-primary/20">Salvar Registro</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
