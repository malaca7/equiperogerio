import React, { useState, useMemo } from 'react'
import { TopHeader } from '../../components/layout/TopHeader'
import { FileText, Search, Filter, Clock, User, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Edit, Plus, Trash2, Package, ShieldCheck } from 'lucide-react'
import { useEstoqueAuditLog } from '../../hooks/useEstoque'
import { Loading } from '../../components/ui/Loading'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'

const ACAO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  insert: { label: 'CRIAÇÃO', icon: Plus, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  update: { label: 'ALTERAÇÃO', icon: Edit, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  delete: { label: 'EXCLUSÃO', icon: Trash2, color: 'text-rose-500', bg: 'bg-rose-500/10' },
}

const TABELA_LABELS: Record<string, string> = {
  estoque_movimentacoes: 'Movimentação',
  estoque_cautelas: 'Cautela',
  estoque_produtos: 'Produto',
  estoque_saldos: 'Saldo',
  estoque_solicitacoes: 'Solicitação',
}

export function EstoqueAuditoriaPage() {
  const { data: logs = [], isLoading } = useEstoqueAuditLog(200)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAcao, setFilterAcao] = useState<string>('all')
  const [filterTabela, setFilterTabela] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !searchTerm ||
        l.tabela.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.usuario?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(l.dados_novos || {}).toLowerCase().includes(searchTerm.toLowerCase())
      const matchAcao = filterAcao === 'all' || l.acao === filterAcao
      const matchTabela = filterTabela === 'all' || l.tabela === filterTabela
      return matchSearch && matchAcao && matchTabela
    })
  }, [logs, searchTerm, filterAcao, filterTabela])

  // Tabelas únicas para filtro
  const tabelasUnicas = useMemo(() => [...new Set(logs.map(l => l.tabela))], [logs])

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Auditoria" />
      <div className="pt-28 sm:pt-32 pb-20"><Loading text="Carregando logs de auditoria..." /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Auditoria de Estoque" subtitle="Registro Imutável de Operações" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-32">

        {/* Filtros */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl px-4 py-2.5 mb-6 shadow-sm flex flex-wrap items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-muted/40 border border-border/40 focus:border-violet-500/50 rounded-xl text-[11px] font-black text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
            />
          </div>
          <select
            value={filterAcao}
            onChange={e => setFilterAcao(e.target.value)}
            className="px-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-[11px] font-black text-foreground outline-none appearance-none cursor-pointer"
          >
            <option value="all">Todas Ações</option>
            <option value="insert">Criações</option>
            <option value="update">Alterações</option>
            <option value="delete">Exclusões</option>
          </select>
          <select
            value={filterTabela}
            onChange={e => setFilterTabela(e.target.value)}
            className="px-3 py-1.5 bg-muted/40 border border-border/40 rounded-xl text-[11px] font-black text-foreground outline-none appearance-none cursor-pointer"
          >
            <option value="all">Todas Tabelas</option>
            {tabelasUnicas.map(t => (
              <option key={t} value={t}>{TABELA_LABELS[t] || t}</option>
            ))}
          </select>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground/50">{filtered.length} registros</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card/80 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Plus className="w-4 h-4" /></div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground">Criações</p>
              <p className="text-xl font-black text-foreground">{logs.filter(l => l.acao === 'insert').length}</p>
            </div>
          </div>
          <div className="bg-card/80 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Edit className="w-4 h-4" /></div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground">Alterações</p>
              <p className="text-xl font-black text-foreground">{logs.filter(l => l.acao === 'update').length}</p>
            </div>
          </div>
          <div className="bg-card/80 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500"><Trash2 className="w-4 h-4" /></div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground">Exclusões</p>
              <p className="text-xl font-black text-foreground">{logs.filter(l => l.acao === 'delete').length}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {filtered.map(log => {
            const cfg = ACAO_CONFIG[log.acao] || ACAO_CONFIG.insert
            const Icon = cfg.icon
            const isExpanded = expandedId === log.id

            return (
              <button
                key={log.id}
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                className="w-full text-left bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-border transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", cfg.bg, cfg.color)}>{cfg.label}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{TABELA_LABELS[log.tabela] || log.tabela}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                      <User className="w-2.5 h-2.5" /> {log.usuario?.nome || 'Sistema'}
                      <span className="text-muted-foreground/40">•</span>
                      <Clock className="w-2.5 h-2.5" /> {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {isExpanded && log.dados_novos && (
                  <div className="mt-3 p-3 bg-muted/20 rounded-xl border border-border/30 overflow-auto max-h-48">
                    <p className="text-[9px] font-black uppercase text-muted-foreground mb-1.5">Dados</p>
                    <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                      {JSON.stringify(log.dados_novos, null, 2)}
                    </pre>
                  </div>
                )}

                {isExpanded && log.dados_anteriores && (
                  <div className="mt-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 overflow-auto max-h-48">
                    <p className="text-[9px] font-black uppercase text-rose-500 mb-1.5">Dados Anteriores</p>
                    <pre className="text-[10px] font-mono text-foreground/60 whitespace-pre-wrap break-all">
                      {JSON.stringify(log.dados_anteriores, null, 2)}
                    </pre>
                  </div>
                )}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-card/80 border border-border/50 rounded-2xl">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">Nenhum registro de auditoria</p>
              <p className="text-xs text-muted-foreground/60">Os logs são criados automaticamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
