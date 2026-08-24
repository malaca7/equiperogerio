import React, { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Sparkles, Check, X, ArrowRight, ShieldCheck, MapPin, User, CheckCircle2, RefreshCw } from 'lucide-react'
import { cn } from '../lib/utils'
import type { SuggestedAllocation } from '../services/aiAllocationService'

interface AiAllocationModalProps {
  open: boolean
  onClose: () => void
  suggestions: SuggestedAllocation[]
  onApproveAll: (approvedSuggestions: SuggestedAllocation[]) => Promise<void>
}

export const AiAllocationModal: React.FC<AiAllocationModalProps> = ({
  open,
  onClose,
  suggestions: initialSuggestions,
  onApproveAll
}) => {
  const [items, setItems] = useState<SuggestedAllocation[]>(initialSuggestions)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSector, setSelectedSector] = useState<string>('all')

  // Sync state when new suggestions arrive
  React.useEffect(() => {
    setItems(initialSuggestions)
    setSelectedSector('all')
  }, [initialSuggestions])

  const approvedCount = items.filter(i => i.status === 'approved').length
  const pendingCount = items.filter(i => i.status === 'pending').length

  // Calculate unique sectors and count per sector
  const sectorsList = React.useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => {
      const sec = i.localidadeSetor || i.funcionarioSetor || 'Geral'
      if (sec) set.add(sec)
    })
    return Array.from(set).sort()
  }, [items])

  const sectorCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(i => {
      const sec = i.localidadeSetor || i.funcionarioSetor || 'Geral'
      counts[sec] = (counts[sec] || 0) + 1
    })
    return counts
  }, [items])

  const filteredItems = React.useMemo(() => {
    if (selectedSector === 'all') return items
    return items.filter(i => (i.localidadeSetor || i.funcionarioSetor || 'Geral') === selectedSector)
  }, [items, selectedSector])

  // Group items by Sector -> then by Locality
  const groupedBySectorAndLocality = React.useMemo(() => {
    const result: Record<string, Record<string, SuggestedAllocation[]>> = {}
    
    filteredItems.forEach(item => {
      const sector = item.localidadeSetor || item.funcionarioSetor || 'Geral'
      const locality = item.localidadeNome || 'Não definida'

      if (!result[sector]) result[sector] = {}
      if (!result[sector][locality]) result[sector][locality] = []

      result[sector][locality].push(item)
    })

    return result
  }, [filteredItems])

  const handleSetStatus = (id: string, status: 'approved' | 'rejected') => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item))
  }

  const handleApproveAllPending = () => {
    setItems(prev => prev.map(item => ({ ...item, status: 'approved' })))
  }

  const handleApproveSectorPending = (sector: string) => {
    setItems(prev => prev.map(item => {
      const itemSector = item.localidadeSetor || item.funcionarioSetor || 'Geral'
      if (itemSector === sector) {
        return { ...item, status: 'approved' }
      }
      return item
    }))
  }

  const handleConfirm = async () => {
    const approved = items.filter(i => i.status === 'approved')
    if (approved.length === 0) return
    setIsSubmitting(true)
    try {
      await onApproveAll(approved)
      onClose()
    } catch (err) {
      console.error('Erro ao salvar alocações IA:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alocação Inteligente por Setor com Copiloto IA"
    >
      <div className="space-y-4 max-w-4xl w-full mx-auto">
        {/* Header Alert / Summary Banner */}
        <div className="bg-gradient-to-r from-primary/20 via-indigo-500/10 to-purple-500/20 border border-primary/30 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="p-3 bg-primary/20 rounded-2xl text-primary border border-primary/30 shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2 flex-wrap">
                Sugestões Automáticas do Copiloto IA
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 uppercase tracking-wider">
                  {sectorsList.length} Setores Cobertos
                </span>
              </h4>
              <p className="text-xs text-muted-foreground font-semibold">
                Alocação otimizada para {items.length} colaboradores avulsos distribuídos em {sectorsList.length} setores ativos.
              </p>
            </div>
          </div>

          <button
            onClick={handleApproveAllPending}
            disabled={pendingCount === 0}
            className="w-full md:w-auto px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-md shadow-primary/20 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar Todos os Setores ({items.length})
          </button>
        </div>

        {/* Sector Quick Filter Chips */}
        {sectorsList.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-border/20">
            <button
              onClick={() => setSelectedSector('all')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border",
                selectedSector === 'all'
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span>Todos os Setores</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px]",
                selectedSector === 'all' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {items.length}
              </span>
            </button>

            {sectorsList.map(sec => {
              const count = sectorCounts[sec] || 0
              const isSelected = selectedSector === sec
              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSector(sec)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span>{sec}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px]",
                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-muted/20 border border-border/30 rounded-2xl">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Nenhuma sugestão encontrada para este setor
            </p>
          </div>
        )}

        {/* Suggestions Grouped by Sector & Locality */}
        <div className="space-y-6 max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin">
          {Object.entries(groupedBySectorAndLocality).map(([sectorName, localitiesMap]) => {
            const sectorItems = Object.values(localitiesMap).flat()
            const sectorApproved = sectorItems.filter(i => i.status === 'approved').length

            return (
              <div key={sectorName} className="space-y-3 bg-muted/20 border border-border/30 p-4 rounded-2xl">
                {/* Sector Header Card */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <User className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Setor: {sectorName}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {sectorItems.length} alocações sugeridas nesta área
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApproveSectorPending(sectorName)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar Todo o Setor {sectorName} ({sectorItems.length})
                  </button>
                </div>

                {/* Localities in Sector */}
                <div className="space-y-4 pt-1">
                  {Object.entries(localitiesMap).map(([locName, locItems]) => (
                    <div key={locName} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-foreground uppercase tracking-wider px-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{locName}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/30">
                          {locItems.length} colaboradores
                        </span>
                      </div>

                      {/* Employees List Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {locItems.map(item => {
                          const isApproved = item.status === 'approved'
                          const isRejected = item.status === 'rejected'

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all flex items-center justify-between gap-3 backdrop-blur-md",
                                isApproved 
                                  ? "bg-emerald-500/10 border-emerald-500/30 shadow-md shadow-emerald-500/5" 
                                  : isRejected
                                  ? "bg-rose-500/5 border-rose-500/20 opacity-60"
                                  : "bg-card/90 border-border/40 hover:border-primary/30"
                              )}
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black uppercase tracking-tight text-foreground truncate">
                                    {item.funcionarioNome}
                                  </span>
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider shrink-0">
                                    {item.matchPercent}%
                                  </span>
                                </div>

                                <p className="text-[10px] text-muted-foreground font-semibold truncate">
                                  {item.funcionarioCargo}
                                </p>

                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {item.reasons.slice(0, 2).map((r, i) => (
                                    <span key={i} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-muted/60 border border-border/30 text-muted-foreground uppercase tracking-tight">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleSetStatus(item.id, 'approved')}
                                  className={cn(
                                    "p-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer",
                                    isApproved 
                                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                      : "bg-muted/40 border border-border/30 text-emerald-600 hover:bg-emerald-500/10"
                                  )}
                                  title="Aprovar"
                                >
                                  <Check className="w-4 h-4 stroke-[3]" />
                                </button>

                                <button
                                  onClick={() => handleSetStatus(item.id, 'rejected')}
                                  className={cn(
                                    "p-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer",
                                    isRejected 
                                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" 
                                      : "bg-muted/40 border border-border/30 text-rose-500 hover:bg-rose-500/10"
                                  )}
                                  title="Rejeitar"
                                >
                                  <X className="w-4 h-4 stroke-[3]" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
            Aprovados: <span className="text-emerald-500 font-bold">{approvedCount}</span> / {items.length}
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={approvedCount === 0 || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 px-6 py-2.5 text-xs"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                `Confirmar ${approvedCount} Alocações`
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}


