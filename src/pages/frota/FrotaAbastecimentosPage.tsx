import React, { useState } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useAbastecimentos, useAddAbastecimento, useUpdateAbastecimento, useDeleteAbastecimento } from '../../hooks/useFrota'
import { useAuth } from '../../contexts/AuthContext'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { Plus, Search, MapPin, Fuel, Calendar as CalendarIcon, DollarSign, Activity, Edit, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

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

export function FrotaAbastecimentosPage() {
  const { user, hasPermission } = useAuth()
  const canManage = hasPermission('frota_abastecimentos', 'gerenciar') || user?.isAdmin
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(user?.profile?.id, user?.isAdmin)
  const { data: abastecimentos = [], isLoading: loadA } = useAbastecimentos()
  const { toast } = useToast()
  
  const addMutation = useAddAbastecimento()
  const updateMutation = useUpdateAbastecimento()
  const deleteMutation = useDeleteAbastecimento()

  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState<any>(null)
  
  const [formData, setFormData] = useState<any>({
    veiculo_id: '', data: format(new Date(), 'yyyy-MM-dd'), litros: '0,00', valor_total: '0,00', km_no_momento: '', posto: ''
  })

  const filtered = abastecimentos.filter(r => {
    const v = veiculos.find(v => v.id === r.veiculo_id)
    if (!v) return false
    const p = r.posto || ''
    return v.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
           p.toLowerCase().includes(searchTerm.toLowerCase()) || 
           format(parseISO(r.data), 'dd/MM/yyyy').includes(searchTerm)
  }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const openNew = () => {
    setFormData({
      veiculo_id: veiculos[0]?.id || '', data: format(new Date(), 'yyyy-MM-dd'), litros: '0,00', valor_total: '0,00', km_no_momento: '', posto: ''
    })
    setModalOpen(true)
  }

  const openEdit = (a: any) => {
    setFormData({
      id: a.id,
      veiculo_id: a.veiculo_id,
      data: format(parseISO(a.data), 'yyyy-MM-dd'),
      litros: formatDecimal(String(a.litros.toFixed(2))),
      valor_total: formatDecimal(String(a.valor_total.toFixed(2))),
      km_no_momento: String(a.km_no_momento),
      posto: a.posto || ''
    })
    setSelectedDetails(null)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este abastecimento?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('Abastecimento excluído com sucesso!', 'success')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (formData.id) {
        await updateMutation.mutateAsync({
          id: formData.id,
          veiculo_id: formData.veiculo_id,
          data: formData.data,
          litros: parseDecimalToFloat(formData.litros),
          valor_total: parseDecimalToFloat(formData.valor_total),
          km_no_momento: Number(formData.km_no_momento),
          posto: formData.posto
        })
        toast('Abastecimento atualizado com sucesso!', 'success')
      } else {
        await addMutation.mutateAsync({
          ...formData,
          usuario_id: user?.profile?.id,
          litros: parseDecimalToFloat(formData.litros),
          valor_total: parseDecimalToFloat(formData.valor_total),
          km_no_momento: Number(formData.km_no_momento)
        })
        toast('Abastecimento registrado!', 'success')
      }
      setModalOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  if (loadV || loadA) return <div className="min-h-screen bg-background"><TopHeader title="Abastecimentos" /><div className="pt-28 sm:pt-32"><Loading /></div></div>

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Abastecimentos" subtitle="Controle de Combustível da Frota" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 space-y-6">
        <div className="bg-card border border-border/50 rounded-[2.5rem] p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-md relative overflow-hidden backdrop-blur-md">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
            <input 
              type="text" 
              placeholder="Pesquisar placa ou posto..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-muted/40 border border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:ring-0 text-foreground transition-all"
            />
          </div>
          {veiculos.length > 0 && (
            <button onClick={openNew} className="w-full md:w-auto px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Registrar Abastecimento
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map(a => {
            const v = veiculos.find(v => v.id === a.veiculo_id)
            return (
              <div 
                key={a.id} 
                onClick={() => setSelectedDetails(a)}
                className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer shadow-sm transition-all relative overflow-hidden backdrop-blur-md bg-emerald-500/[0.01] border-emerald-500/15 hover:border-emerald-500/30 hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600">
                    <Fuel className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex items-center gap-2">
                      {v?.placa || 'Sem Placa'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-bold">{v?.modelo || 'Desconhecido'} • {format(parseISO(a.data), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  <div className="text-right">
                    <h4 className="text-sm font-black text-foreground">R$ {a.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground">{a.litros} L • R$ {(a.valor_total / a.litros).toFixed(2)}/L</p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0 border-l border-border/30 pl-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(a)
                        }}
                        className="p-2.5 bg-muted/40 hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-xl transition-all border border-border/40 hover:border-primary/20 cursor-pointer"
                        title="Editar Abastecimento"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(a.id)
                        }}
                        className="p-2.5 bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground rounded-xl transition-all border border-border/40 hover:border-rose-500/20 cursor-pointer"
                        title="Excluir Abastecimento"
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
              <Fuel className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-bold text-sm">Nenhum abastecimento encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!selectedDetails} onClose={() => setSelectedDetails(null)} title="Detalhes do Abastecimento">
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
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Valor Total</p>
                <p className="font-black text-emerald-500 text-lg">R$ {selectedDetails.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Litros</p>
                <p className="font-black text-foreground">{selectedDetails.litros} L</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Valor/Litro</p>
                <p className="font-black text-foreground">R$ {(selectedDetails.valor_total / selectedDetails.litros).toFixed(2)}/L</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">KM no Momento</p>
                <p className="font-black text-foreground">{selectedDetails.km_no_momento.toLocaleString('pt-BR')} km</p>
              </div>
              {selectedDetails.posto && (
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Posto</p>
                  <p className="font-black text-foreground">{selectedDetails.posto}</p>
                </div>
              )}
            </div>

            {selectedDetails.comprovante_url && (
              <a 
                href={selectedDetails.comprovante_url}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
              >
                Ver Comprovante
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
        title={formData.id ? "Editar Abastecimento" : "Registrar Abastecimento"}
        footer={
          <button form="abastecimento-form" disabled={addMutation.isPending || updateMutation.isPending} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            {addMutation.isPending || updateMutation.isPending ? 'Salvando...' : formData.id ? 'Salvar Alterações' : 'Salvar Abastecimento'}
          </button>
        }
      >
        <form id="abastecimento-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Data</label>
              <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Veículo</label>
              <select required value={formData.veiculo_id} onChange={e => handleVeiculoChange(e.target.value)} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold uppercase outline-none transition-all text-foreground">
                <option value="">Selecione...</option>
                {veiculos.filter(v => v.status === 'ativo').map(v => (
                  <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">Litros (Qtd)</label>
              <input required type="text" inputMode="numeric" value={formData.litros} onChange={e => setFormData({...formData, litros: formatDecimal(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">Valor Total (R$)</label>
              <input required type="text" inputMode="numeric" value={formData.valor_total} onChange={e => setFormData({...formData, valor_total: formatDecimal(e.target.value)})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1 truncate">KM Atual</label>
              <input required type="number" value={formData.km_no_momento} onChange={e => setFormData({...formData, km_no_momento: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-muted-foreground mb-1">Posto / Local</label>
            <input type="text" value={formData.posto} onChange={e => setFormData({...formData, posto: e.target.value})} className="w-full px-4 py-3 bg-muted/40 border border-border/50 focus:border-primary focus:bg-card rounded-2xl text-sm font-bold outline-none transition-all text-foreground" placeholder="Opcional" />
          </div>

        </form>
      </Modal>
    </div>
  )
}
