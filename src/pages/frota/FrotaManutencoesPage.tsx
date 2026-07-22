import React, { useState } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useManutencoes, useAddManutencao, useUpdateManutencao, useDeleteManutencao } from '../../hooks/useFrota'
import { useAuth } from '../../contexts/AuthContext'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { Plus, Search, MapPin, Hammer, Calendar as CalendarIcon, DollarSign, Droplet, AlertTriangle, Edit, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '../../lib/utils'

const formatDecimal = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return '0,00'
  const numberValue = parseInt(digits, 10) / 100
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const parseDecimalToFloat = (value: string): number => {
  if (!value) return 0
  const clean = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

export function FrotaManutencoesPage() {
  const { user, hasPermission } = useAuth()
  const canManage = hasPermission('frota_manutencoes', 'gerenciar') || user?.isAdmin
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(user?.profile?.id, user?.isAdmin)
  const { data: manutencoes = [], isLoading: loadM } = useManutencoes()
  const { toast } = useToast()
  
  const addMutation = useAddManutencao()
  const updateMutation = useUpdateManutencao()
  const deleteMutation = useDeleteManutencao()

  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState<any>(null)
  
  const [formData, setFormData] = useState<any>({
    veiculo_id: '', data: format(new Date(), 'yyyy-MM-dd'), tipo: 'preventiva', descricao: '', valor: '0,00', km_no_momento: '', oficina: '', proxima_troca_km: ''
  })

  const filtered = manutencoes.filter(m => {
    const v = veiculos.find(v => v.id === m.veiculo_id)
    if (!v) return false
    const desc = m.descricao || ''
    const ofi = m.oficina || ''
    return v.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
           desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
           ofi.toLowerCase().includes(searchTerm.toLowerCase()) ||
           format(parseISO(m.data), 'dd/MM/yyyy').includes(searchTerm)
  }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const openNew = () => {
    setFormData({
      veiculo_id: veiculos[0]?.id || '', data: format(new Date(), 'yyyy-MM-dd'), tipo: 'preventiva', descricao: '', valor: '0,00', km_no_momento: '', oficina: '', proxima_troca_km: ''
    })
    setModalOpen(true)
  }

  const openEdit = (m: any) => {
    setFormData({
      id: m.id,
      veiculo_id: m.veiculo_id,
      data: format(parseISO(m.data), 'yyyy-MM-dd'),
      tipo: m.tipo,
      descricao: m.descricao || '',
      valor: m.valor ? formatDecimal(String(m.valor.toFixed(2))) : '0,00',
      km_no_momento: String(m.km_no_momento),
      oficina: m.oficina || '',
      proxima_troca_km: m.proxima_troca_km ? String(m.proxima_troca_km) : ''
    })
    setSelectedDetails(null)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta manutenção?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Manutenção excluída com sucesso!', 'success')
      setSelectedDetails(null)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleVeiculoChange = (vid: string) => {
    const v = veiculos.find(x => x.id === vid)
    setFormData((prev: any) => ({
      ...prev,
      veiculo_id: vid,
      km_no_momento: prev.km_no_momento || (v ? v.km_atual : '')
    }))
  }

  const handleTipoChange = (tipo: string) => {
    const v = veiculos.find(x => x.id === formData.veiculo_id)
    setFormData((prev: any) => ({
      ...prev,
      tipo,
      descricao: tipo === 'troca_oleo' ? 'Troca de óleo e filtros' : prev.descricao,
      proxima_troca_km: tipo === 'troca_oleo' ? ((v ? v.km_atual : Number(prev.km_no_momento)) + 10000) : ''
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (formData.id) {
        await updateMutation.mutateAsync({
          id: formData.id,
          veiculo_id: formData.veiculo_id,
          data: formData.data,
          tipo: formData.tipo,
          descricao: formData.descricao,
          valor: formData.valor ? parseDecimalToFloat(formData.valor) : null,
          km_no_momento: Number(formData.km_no_momento),
          oficina: formData.oficina || null,
          proxima_troca_km: formData.tipo === 'troca_oleo' && formData.proxima_troca_km ? Number(formData.proxima_troca_km) : null
        })
        toast('Manutenção atualizada com sucesso!', 'success')
      } else {
        await addMutation.mutateAsync({
          ...formData,
          usuario_id: user?.profile?.id,
          valor: formData.valor ? parseDecimalToFloat(formData.valor) : null,
          km_no_momento: Number(formData.km_no_momento),
          proxima_troca_km: formData.tipo === 'troca_oleo' && formData.proxima_troca_km ? Number(formData.proxima_troca_km) : null
        })
        toast('Manutenção registrada com sucesso!', 'success')
      }
      setModalOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  if (loadV || loadM) return <div className="min-h-screen bg-background"><TopHeader title="Manutenções" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Manutenções" subtitle="Histórico e Controle de Oficina" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-6">
        <div className="bg-card border border-border/50 rounded-[2.5rem] p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-md relative overflow-hidden backdrop-blur-md">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
            <input 
              type="text" 
              placeholder="Pesquisar por placa ou descrição..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-muted/40 border border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:ring-0 text-foreground transition-all"
            />
          </div>
          {veiculos.length > 0 && (
            <button onClick={openNew} className="w-full md:w-auto px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Registrar Manutenção
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map(m => {
            const v = veiculos.find(v => v.id === m.veiculo_id)
            const isOleo = m.tipo === 'troca_oleo'
            const isPreventiva = m.tipo === 'preventiva'
            
            return (
              <div 
                key={m.id} 
                onClick={() => setSelectedDetails(m)}
                className={cn(
                  "border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer shadow-sm transition-all relative overflow-hidden backdrop-blur-md hover:scale-[1.01]",
                  isOleo ? "bg-amber-500/[0.01] border-amber-500/15 hover:border-amber-500/30" :
                  isPreventiva ? "bg-blue-500/[0.01] border-blue-500/15 hover:border-blue-500/30" : "bg-rose-500/[0.01] border-rose-500/15 hover:border-rose-500/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    isOleo ? "bg-amber-500/10 text-amber-500" :
                    isPreventiva ? "bg-blue-500/10 text-blue-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                    {isOleo ? <Droplet className="w-5 h-5" /> : isPreventiva ? <Hammer className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex items-center gap-2">
                      {v?.placa || 'Sem Placa'}
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[9px] tracking-wider uppercase border",
                        isOleo ? "bg-amber-500/15 text-amber-600 border-amber-500/20" :
                        isPreventiva ? "bg-blue-500/15 text-blue-600 border-blue-500/20" : "bg-rose-500/15 text-rose-600 border-rose-500/20"
                      )}>
                        {m.tipo.replace('_', ' ')}
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground font-bold">{v?.modelo || 'Desconhecido'} • {format(parseISO(m.data), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <div className="flex flex-col sm:items-end text-left sm:text-right min-w-[120px]">
                    {m.valor && <h4 className="text-sm font-black text-foreground">R$ {m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>}
                    <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px]">{m.descricao}</p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0 border-l border-border/30 pl-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(m)
                        }}
                        className="p-2.5 bg-muted/40 hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-xl transition-all border border-border/40 hover:border-primary/20 cursor-pointer"
                        title="Editar Manutenção"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(m.id)
                        }}
                        className="p-2.5 bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground rounded-xl transition-all border border-border/40 hover:border-rose-500/20 cursor-pointer"
                        title="Excluir Manutenção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground bg-card border border-border/50 rounded-2xl shadow-sm">
              <Hammer className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">Nenhuma manutenção encontrada.</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!selectedDetails} onClose={() => setSelectedDetails(null)} title="Detalhes da Manutenção">
        {selectedDetails && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Veículo</p>
              <p className="font-black text-foreground text-lg uppercase">{veiculos.find(v => v.id === selectedDetails.veiculo_id)?.placa} - {veiculos.find(v => v.id === selectedDetails.veiculo_id)?.modelo}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Data</p>
                <p className="font-black text-foreground">{format(parseISO(selectedDetails.data), 'dd/MM/yyyy')}</p>
                <p className="text-[10px] text-muted-foreground font-bold mt-1">Hora: {format(parseISO(selectedDetails.created_at), 'HH:mm')}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Tipo</p>
                <p className={cn(
                  "font-black uppercase",
                  selectedDetails.tipo === 'troca_oleo' ? 'text-amber-500' :
                  selectedDetails.tipo === 'preventiva' ? 'text-blue-500' : 'text-rose-500'
                )}>{selectedDetails.tipo.replace('_', ' ')}</p>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM no Momento</p>
                <p className="font-black text-foreground">{selectedDetails.km_no_momento.toLocaleString('pt-BR')} km</p>
              </div>

              {selectedDetails.valor && (
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Valor</p>
                  <p className="font-black text-primary">R$ {selectedDetails.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>

            {selectedDetails.tipo === 'troca_oleo' && selectedDetails.proxima_troca_km && (
              <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex justify-between items-center">
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Próxima Troca de Óleo</p>
                <p className="font-black text-amber-600 text-lg">{selectedDetails.proxima_troca_km.toLocaleString('pt-BR')} km</p>
              </div>
            )}

            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Descrição</p>
              <p className="text-sm font-bold text-foreground">{selectedDetails.descricao}</p>
            </div>

            {selectedDetails.oficina && (
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Oficina</p>
                <p className="text-sm font-bold text-foreground">{selectedDetails.oficina}</p>
              </div>
            )}

            {selectedDetails.comprovante_url && (
              <a 
                href={selectedDetails.comprovante_url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20"
              >
                Ver Comprovante / OS
              </a>
            )}

            {canManage && (
              <div className="flex gap-3 pt-4 border-t border-border/30">
                <button
                  onClick={() => openEdit(selectedDetails)}
                  className="flex-1 py-3 bg-muted/40 hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all border border-border/40 hover:border-primary/20 cursor-pointer"
                >
                  <Edit className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => handleDelete(selectedDetails.id)}
                  className="w-12 h-12 bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground rounded-2xl flex items-center justify-center transition-all border border-border/40 hover:border-rose-500/20 cursor-pointer"
                  title="Excluir Registro"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={formData.id ? "Editar Manutenção" : "Registrar Manutenção"} 
        size="lg"
        footer={
          <button form="manutencao-form" disabled={addMutation.isPending || updateMutation.isPending} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            {addMutation.isPending || updateMutation.isPending ? 'Salvando...' : formData.id ? 'Salvar Alterações' : 'Salvar Manutenção'}
          </button>
        }
      >
        <form id="manutencao-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Data</label>
              <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Veículo</label>
              <select required value={formData.veiculo_id} onChange={e => handleVeiculoChange(e.target.value)} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground">
                <option value="">Selecione...</option>
                {veiculos.filter(v => v.status !== 'inativo').map(v => (
                  <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Tipo</label>
              <select required value={formData.tipo} onChange={e => handleTipoChange(e.target.value)} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground">
                <option value="preventiva">Preventiva (Revisão)</option>
                <option value="corretiva">Corretiva (Conserto)</option>
                <option value="troca_oleo">Troca de Óleo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">KM do Veículo</label>
              <input required type="number" value={formData.km_no_momento} onChange={e => setFormData({...formData, km_no_momento: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Descrição</label>
            <input required type="text" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="O que foi feito?" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">Valor (R$) <span className="lowercase font-normal opacity-50">(Opcional)</span></label>
              <input type="text" inputMode="numeric" value={formData.valor} onChange={e => setFormData({...formData, valor: formatDecimal(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">Oficina / Local <span className="lowercase font-normal opacity-50">(Opcional)</span></label>
              <input type="text" value={formData.oficina} onChange={e => setFormData({...formData, oficina: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="Nome da oficina" />
            </div>
          </div>

          {formData.tipo === 'troca_oleo' && (
            <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
              <label className="block text-[10px] font-black uppercase text-amber-600 mb-1 truncate">Próxima Troca (KM)</label>
              <input required type="number" value={formData.proxima_troca_km} onChange={e => setFormData({...formData, proxima_troca_km: e.target.value})} className="w-full px-4 py-3 bg-amber-500/5 border border-amber-500/30 focus:border-amber-500/50 rounded-xl text-sm font-bold text-amber-700" placeholder="Ex: KM atual + 10.000" />
              <p className="text-[10px] text-amber-600 mt-1 font-bold">* O veículo será notificado quando atingir esta quilometragem.</p>
            </div>
          )}

        </form>
      </Modal>
    </div>
  )
}
