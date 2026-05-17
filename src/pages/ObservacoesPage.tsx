import React, { useState, useMemo } from 'react'
import { 
  FileText, 
  Search, 
  Calendar, 
  User, 
  Plus, 
  Filter, 
  Trash2,
  ChevronRight,
  MessageSquare,
  Clock,
  Send,
  X
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../lib/utils'
import { TopHeader } from '../components/layout/TopHeader'
import { Loading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select, Textarea } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { useEscalasMensal, useBatchUpsertEscalas, useDeleteEscala } from '../hooks/useEscalas'
import { useFuncionarios } from '../hooks/useFuncionarios'

export function ObservacoesPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  
  const [newObs, setNewObs] = useState({
    funcionario_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    texto: ''
  })

  const { data: allFuncionarios = [] } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading } = useEscalasMensal(format(new Date(), 'yyyy-MM'))
  const batchMutation = useBatchUpsertEscalas()
  const deleteMutation = useDeleteEscala()

  const observations = useMemo(() => {
    return escalas
      .filter(e => e.observacoes && e.observacoes.trim() !== '' && e.observacoes !== 'Gerado automaticamente')
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [escalas])

  const filteredObs = useMemo(() => {
    if (!searchTerm) return observations
    const q = searchTerm.toLowerCase()
    return observations.filter(obs => 
      obs.funcionarios?.nome.toLowerCase().includes(q) ||
      obs.observacoes?.toLowerCase().includes(q)
    )
  }, [observations, searchTerm])

  const handleAddObs = async () => {
    if (!newObs.funcionario_id || !newObs.texto) {
      toast('Por favor, selecione um funcionário e escreva a nota.', 'warning')
      return
    }

    try {
      await batchMutation.mutateAsync([{
        funcionario_id: newObs.funcionario_id,
        data: newObs.data,
        tipo: 'obs',
        observacoes: newObs.texto,
        turno: 'integral'
      }])
      toast('Registro arquivado com sucesso!', 'success')
      setIsAddModalOpen(false)
      setNewObs({ funcionario_id: '', data: format(new Date(), 'yyyy-MM-dd'), texto: '' })
    } catch (err: any) {
      toast('Falha ao registrar: ' + err.message, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast('Observação removida da ficha', 'success')
    } catch {
      toast('Erro ao tentar remover', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopHeader 
        title="Ocorrências" 
        subtitle={`${filteredObs.length} notas operacionais`}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Native-Style Toolbar */}
        <div className="bg-card/80 dark:bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-4 sm:p-6 shadow-xl mb-10 sticky top-24 z-30 transform-gpu transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 px-2">
              <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-500/10 flex items-center justify-center shadow-inner">
                <MessageSquare className="w-7 h-7 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground leading-none tracking-tight">Relatórios</h2>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1.5">Anotações de Campo</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:min-w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60" />
                <input 
                  type="text" 
                  placeholder="Pesquisar por colaborador ou conteúdo..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-transparent focus:border-primary/20 rounded-[1.75rem] text-sm font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)} 
                className="h-14 px-8 bg-indigo-600 text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shrink-0"
              >
                <Plus className="w-5 h-5" /> Nova Nota
              </button>
            </div>
          </div>
        </div>

        {/* Tactical Feed Grid */}
        {isLoading ? (
          <div className="py-32"><Loading text="Compilando ocorrências..." /></div>
        ) : filteredObs.length === 0 ? (
          <div className="py-32 text-center animate-fade-in">
            <div className="w-24 h-24 bg-muted/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-muted-foreground opacity-20" />
            </div>
            <p className="text-xl font-black uppercase tracking-widest text-foreground opacity-50">Sem ocorrências</p>
            <p className="text-sm text-muted-foreground mt-2">Clique no botão acima para adicionar uma nova nota.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredObs.map(obs => (
              <div key={obs.id} className="group relative bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:scale-[1.01] transition-all duration-500 overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
                
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-500/10 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-foreground tracking-tight leading-none mb-2">
                        {obs.funcionarios?.nome}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                          {format(parseISO(obs.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(obs.id)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 relative pl-6 border-l-3 border-indigo-500/30 py-2 relative z-10">
                   <div className="absolute top-0 left-[-4px] w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  <p className="text-base text-foreground/90 leading-relaxed font-bold italic">
                    "{obs.observacoes}"
                  </p>
                </div>
                
                {obs.tipo !== 'obs' && (
                  <div className="mt-8 flex justify-end relative z-10">
                    <div className="px-4 py-1.5 bg-muted/60 rounded-full border border-border/50 shadow-sm">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">
                        Auto-registro: {obs.tipo}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal (Message Style) */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Registro"
      >
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 text-center">
            <MessageSquare className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
            <p className="text-xs font-black uppercase text-indigo-600 tracking-widest">Anotação Operacional</p>
          </div>

          <Select
            label="Selecione o Colaborador"
            className="h-14 rounded-2xl"
            value={newObs.funcionario_id}
            onChange={e => setNewObs({ ...newObs, funcionario_id: e.target.value })}
            options={allFuncionarios.map(f => ({ value: f.id, label: f.nome }))}
            placeholder="Quem é o foco desta nota?"
          />
          
          <Input
            type="date"
            label="Data da Ocorrência"
            className="h-14 rounded-2xl"
            value={newObs.data}
            onChange={e => setNewObs({ ...newObs, data: e.target.value })}
          />

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground ml-4 tracking-widest">Conteúdo da Nota</label>
            <textarea
              placeholder="Descreva aqui o que aconteceu ou observações relevantes..."
              value={newObs.texto}
              onChange={e => setNewObs({ ...newObs, texto: e.target.value })}
              className="w-full p-6 bg-muted/40 border border-transparent focus:border-indigo-500/30 rounded-[1.75rem] text-base font-bold focus:ring-0 text-foreground placeholder:text-muted-foreground/30 min-h-[150px] transition-all"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" className="flex-1 h-14 rounded-[1.25rem] font-black uppercase" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-14 rounded-[1.25rem] bg-indigo-600 font-black uppercase shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3" loading={batchMutation.isPending} onClick={handleAddObs}>
               <Send className="w-5 h-5" /> Arquivar Nota
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
