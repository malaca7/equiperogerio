import React, { useState } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { useVeiculos, useRegistrosDiarios, useUpsertRegistroDiario, useActiveTrip } from '../../hooks/useFrota'
import { useAuth } from '../../contexts/AuthContext'
import { Loading } from '../../components/ui/Loading'
import { useToast } from '../../components/ui/Toast'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Camera, 
  CheckCircle2, 
  Navigation, 
  Car,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'

export function FrotaMotoristaPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Fetch vehicles authorized for this employee
  const { data: veiculos = [], isLoading: loadV } = useVeiculos(user?.profile?.id, user?.isAdmin)
  // Fetch all fleet records to pre-fill KM
  const { data: registros = [], isLoading: loadR } = useRegistrosDiarios()
  // Fetch active trip for this current employee directly from DB
  const { data: activeTrip, isLoading: loadActive } = useActiveTrip(user?.profile?.id)
  
  const upsertMutation = useUpsertRegistroDiario()

  const [veiculoId, setVeiculoId] = useState('')
  const [kmVal, setKmVal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoUrlInicial, setFotoUrlInicial] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Handle vehicle change to pre-fill KM
  const handleVeiculoChange = (vid: string) => {
    setVeiculoId(vid)
    const selected = veiculos.find(v => v.id === vid)
    if (selected) {
      // Encontra a última viagem finalizada deste veículo específico para puxar o KM correto de chegada
      const lastTrip = registros
        .filter(r => r.veiculo_id === vid && r.km_final !== null)
        .sort((a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime())[0]

      if (lastTrip) {
        setKmVal(String(lastTrip.km_final))
      } else {
        setKmVal(String(selected.km_atual))
      }
    } else {
      setKmVal('')
    }
  }

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTrip) {
      toast('Você já possui uma rota em andamento! Encerre a viagem atual antes de iniciar outra.', 'warning')
      return
    }
    if (!veiculoId || !kmVal) {
      toast('Por favor, selecione o veículo e insira o KM.', 'warning')
      return
    }
    if (!fotoUrlInicial) {
      toast('Por favor, envie a foto do hodômetro de saída.', 'warning')
      return
    }

    try {
      await upsertMutation.mutateAsync({
        veiculo_id: veiculoId,
        usuario_id: user?.profile?.id,
        data: format(new Date(), 'yyyy-MM-dd'),
        km_inicial: Number(kmVal),
        km_final: null,
        observacoes: observacoes || '',
        foto_hodometro: null,
        foto_hodometro_inicial: fotoUrlInicial
      })
      toast('Boa viagem! Saída registrada com sucesso.', 'success')
      // Reset form
      setVeiculoId('')
      setKmVal('')
      setObservacoes('')
      setFotoUrlInicial(null)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleEndTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTrip) return
    if (!kmVal) {
      toast('Por favor, insira o KM Final.', 'warning')
      return
    }
    if (!fotoUrl) {
      toast('Por favor, envie a foto do hodômetro de chegada.', 'warning')
      return
    }
    if (Number(kmVal) <= activeTrip.km_inicial) {
      toast(`O KM Final deve ser maior que o KM Inicial (${activeTrip.km_inicial}).`, 'warning')
      return
    }

    try {
      await upsertMutation.mutateAsync({
        id: activeTrip.id,
        veiculo_id: activeTrip.veiculo_id,
        usuario_id: activeTrip.usuario_id,
        data: activeTrip.data,
        km_inicial: activeTrip.km_inicial,
        km_final: Number(kmVal),
        observacoes: observacoes || activeTrip.observacoes || '',
        foto_hodometro: fotoUrl
      })
      toast('Viagem encerrada com sucesso! KM Final registrado.', 'success')
      // Reset states
      setKmVal('')
      setObservacoes('')
      setFotoUrl(null)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  if (loadV || loadR || loadActive) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Área do Motorista" />
        <div className="pt-28"><Loading text="Carregando..." /></div>
      </div>
    )
  }

  const activeVehicle = activeTrip ? veiculos.find(v => v.id === activeTrip.veiculo_id) : null

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Área do Motorista" subtitle="Registro rápido de quilometragem para viagem" />

      <div className="max-w-md mx-auto px-4 pt-28 space-y-6">
        
        {/* State Banner */}
        <div className={cn(
          "rounded-[2rem] p-6 border flex items-center gap-4 relative overflow-hidden shadow-sm",
          activeTrip 
            ? "bg-amber-500/[0.03] border-amber-500/20" 
            : "bg-emerald-500/[0.03] border-emerald-500/20"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
            activeTrip ? "bg-amber-500/10 text-amber-600 animate-pulse" : "bg-emerald-500/10 text-emerald-600"
          )}>
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wide text-foreground">
              {activeTrip ? 'Viagem em Andamento' : 'Pronto para Sair'}
            </h4>
            <p className="text-xs text-muted-foreground font-bold mt-0.5">
              {activeTrip 
                ? `Veículo: ${activeVehicle?.placa} (${activeVehicle?.modelo})`
                : 'Selecione um veículo para iniciar seu trajeto.'
              }
            </p>
          </div>
        </div>

        {/* Dynamic Form */}
        {activeTrip ? (
          /* ENTRADA / ARRIVAL FORM */
          <div className="bg-card border border-amber-500/25 rounded-[2.5rem] p-6 shadow-lg shadow-amber-500/[0.02] space-y-5">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 animate-pulse">
                Viagem Ativa
              </span>
              <h2 className="text-xl font-black text-foreground">Encerrar Viagem (Entrada)</h2>
              <p className="text-xs text-muted-foreground font-bold">
                Saída registrada com <span className="text-foreground">{activeTrip.km_inicial.toLocaleString('pt-BR')} km</span>
              </p>
            </div>

            <form onSubmit={handleEndTrip} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Final de Entrada</label>
                <input 
                  required 
                  type="number" 
                  value={kmVal} 
                  onChange={e => setKmVal(e.target.value)} 
                  className="w-full px-5 py-4 bg-muted/50 border border-transparent focus:border-amber-500/30 rounded-2xl text-base font-black text-foreground text-center" 
                  placeholder="Digite o KM no hodômetro" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5 font-bold">Foto do Hodômetro</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIsUploading(true)
                        try {
                          const file = e.target.files[0]
                          const fileExt = file.name.split('.').pop()
                          const fileName = `${Math.random()}.${fileExt}`
                          const filePath = `${user?.profile?.id}/${fileName}`
                          
                          const { error: uploadError } = await supabase.storage.from('frota').upload(filePath, file)
                          if (uploadError) throw uploadError
                          
                          const { data } = supabase.storage.from('frota').getPublicUrl(filePath)
                          setFotoUrl(data.publicUrl)
                          toast('Foto enviada com sucesso!', 'success')
                        } catch (err: any) {
                          toast('Erro ao carregar foto: ' + err.message, 'error')
                        } finally {
                          setIsUploading(false)
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <div className="w-full px-4 py-6 bg-muted/40 border-2 border-dashed border-border/50 hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                    {fotoUrl ? (
                      <div className="relative">
                        <img src={fotoUrl} alt="Hodômetro" className="h-32 object-contain rounded-xl shadow border border-border" />
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-1">
                          <Camera className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Tirar Foto ou Galeria</p>
                        <p className="text-[10px] text-muted-foreground/50 font-bold">Hodômetro com KM visível</p>
                      </>
                    )}
                    {isUploading && <p className="text-xs text-amber-600 font-black animate-pulse mt-1">Carregando imagem...</p>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Alguma Observação? (Opcional)</label>
                <textarea 
                  value={observacoes} 
                  onChange={e => setObservacoes(e.target.value)} 
                  className="w-full px-4 py-3 bg-muted/50 border border-transparent focus:border-amber-500/20 rounded-2xl text-sm font-bold resize-none text-foreground" 
                  rows={2} 
                  placeholder="Avarias, combustível na reserva, etc." 
                />
              </div>

              <div className="pt-4">
                <button 
                  disabled={upsertMutation.isPending || isUploading} 
                  type="submit" 
                  className="w-full flex py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-95"
                >
                  {upsertMutation.isPending ? 'Salvando...' : 'Encerrar Viagem'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* SAIDA / DEPARTURE FORM */
          <div className="bg-card border border-emerald-500/25 rounded-[2.5rem] p-6 shadow-lg shadow-emerald-500/[0.02] space-y-5">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700">
                Lançamento
              </span>
              <h2 className="text-xl font-black text-foreground">Iniciar Viagem (Saída)</h2>
              <p className="text-xs text-muted-foreground font-bold">Selecione seu veículo e confirme o KM inicial.</p>
            </div>

            {veiculos.length === 0 ? (
              <div className="text-center py-6 px-4 bg-muted/50 rounded-2xl border border-dashed space-y-2">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-500">Sem Autorização</h4>
                <p className="text-[11px] text-muted-foreground font-bold leading-relaxed">Você não tem autorização para dirigir nenhum veículo. Por favor, contate o administrador da frota.</p>
              </div>
            ) : (
              <form onSubmit={handleStartTrip} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Escolha o Veículo</label>
                  <select 
                    required 
                    value={veiculoId} 
                    onChange={e => handleVeiculoChange(e.target.value)} 
                    className="w-full px-4 py-3.5 bg-muted/50 border border-transparent focus:border-emerald-500/20 rounded-2xl text-sm font-black uppercase text-foreground"
                  >
                    <option value="">Selecione...</option>
                    {veiculos.map(v => (
                      <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">KM Inicial de Saída</label>
                  <input 
                    required 
                    type="number" 
                    value={kmVal} 
                    onChange={e => setKmVal(e.target.value)}
                    className="w-full px-5 py-4 bg-muted/50 border border-transparent focus:border-emerald-500/30 rounded-2xl text-base font-black text-foreground text-center" 
                    placeholder="Confirme o KM atual do veículo" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5 font-bold">Foto do Hodômetro (Saída)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          setIsUploading(true)
                          try {
                            const file = e.target.files[0]
                            const fileExt = file.name.split('.').pop()
                            const fileName = `${Math.random()}.${fileExt}`
                            const filePath = `${user?.profile?.id}/${fileName}`
                            
                            const { error: uploadError } = await supabase.storage.from('frota').upload(filePath, file)
                            if (uploadError) throw uploadError
                            
                            const { data } = supabase.storage.from('frota').getPublicUrl(filePath)
                            setFotoUrlInicial(data.publicUrl)
                            toast('Foto enviada com sucesso!', 'success')
                          } catch (err: any) {
                            toast('Erro ao carregar foto: ' + err.message, 'error')
                          } finally {
                            setIsUploading(false)
                          }
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                    <div className="w-full px-4 py-6 bg-muted/40 border-2 border-dashed border-border/50 hover:border-emerald-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                      {fotoUrlInicial ? (
                        <div className="relative">
                          <img src={fotoUrlInicial} alt="Hodômetro Saída" className="h-32 object-contain rounded-xl shadow border border-border" />
                          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-1">
                            <Camera className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Tirar Foto ou Galeria</p>
                          <p className="text-[10px] text-muted-foreground/50 font-bold">Hodômetro com KM inicial visível</p>
                        </>
                      )}
                      {isUploading && <p className="text-xs text-emerald-600 font-black animate-pulse mt-1">Carregando imagem...</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1.5">Alguma Observação? (Opcional)</label>
                  <textarea 
                    value={observacoes} 
                    onChange={e => setObservacoes(e.target.value)} 
                    className="w-full px-4 py-3 bg-muted/50 border border-transparent focus:border-emerald-500/20 rounded-2xl text-sm font-bold resize-none text-foreground" 
                    rows={2} 
                    placeholder="Combustível, limpeza, observação inicial..." 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    disabled={upsertMutation.isPending} 
                    type="submit" 
                    className="w-full flex py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95"
                  >
                    {upsertMutation.isPending ? 'Salvando...' : 'Iniciar Viagem'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
