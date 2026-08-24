import React, { useState, useRef, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Sparkles, Send, Bot, User, MapPin, Users, Activity, CheckCircle2, HelpCircle, ArrowRight, ShieldCheck, Layers } from 'lucide-react'
import { cn } from '../lib/utils'
import { normStr, type AIProcessedEngine } from '../services/aiAllocationService'
import type { Funcionario } from '../lib/database.types'

interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  cards?: {
    title: string
    subtitle?: string
    badge?: string
    reasons?: string[]
  }[]
  timestamp: string
}

interface CopilotoIaDrawerProps {
  open: boolean
  onClose: () => void
  localidades: { id: string; nome: string; setor: string }[]
  funcionarios: Funcionario[]
  engine: AIProcessedEngine
  dateStr: string
  onOpenAutoAllocateAll?: () => void
}

export const CopilotoIaDrawer: React.FC<CopilotoIaDrawerProps> = ({
  open,
  onClose,
  localidades,
  funcionarios,
  engine,
  dateStr,
  onOpenAutoAllocateAll
}) => {
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>('all')
  const [inputQuery, setInputQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Olá! Sou o Copiloto IA de Alocação Inteligente. Utilizo os setores como referência primária, combinados com o histórico de 90 dias de alocações, escalas, presenças e sinergia entre colaboradores.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])

  const funcMap = React.useMemo(() => {
    const map: Record<string, Funcionario> = {}
    funcionarios.forEach(f => { map[f.id] = f })
    return map
  }, [funcionarios])

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Process user questions deterministically based on real database analytics
  const handleAnswerQuestion = (queryText: string) => {
    if (!queryText.trim()) return

    const userMsg: ChatMessage = {
      id: safeId(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const currentLoc = localidades.find(l => l.id === selectedLocalityId)
    let replyText = ''
    let replyCards: ChatMessage['cards'] = undefined

    const lower = queryText.toLowerCase()

    if (
      lower.includes('alocar todos') || 
      lower.includes('todos os setores') || 
      lower.includes('alocar setores de uma vez') ||
      lower.includes('escala completa')
    ) {
      // Multi-sector batch allocation intent
      const sectorNames = Array.from(new Set(localidades.map(l => l.setor).filter(Boolean)))
      replyText = `🚀 **Alocação Inteligente Multi-Setor Ativada!**\n\nO Copiloto IA analisou **${localidades.length} localidades** priorizando rigorosamente os **${sectorNames.length} setores cadastrados** (${sectorNames.slice(0, 4).join(', ')}${sectorNames.length > 4 ? '...' : ''}).\n\nClique abaixo para visualizar o modal de confirmação e aprovar as sugestões setor por setor:`

      replyCards = [
        {
          title: `Painel de Aprovação por Setor`,
          subtitle: `Sugestões alinhadas 100% à prioridade do setor e ao histórico recente`,
          badge: `Prioridade Máxima do Setor`,
          reasons: [
            `⚡ Prioridade 1: Compatibilidade Estrita de Setor`,
            `📊 Prioridade 2: Frequência na Localidade`,
            `🤝 Prioridade 3: Duplas de Co-trabalho`
          ]
        }
      ]

      if (onOpenAutoAllocateAll) {
        onOpenAutoAllocateAll()
      }
    } else if (
      lower.includes('setor') || 
      lower.includes('setores') || 
      lower.includes('prioridade')
    ) {
      // Detailed sector priority analysis
      const sectorNames = Array.from(new Set(localidades.map(l => l.setor).filter(Boolean)))

      replyText = `📊 **Análise Geral de Desempenho e Prioridade dos Setores**:\n\nOs setores cadastrados recebem a maior pontuação no cálculo de afinidade (peso 40%). Confira os principais especialistas identificados por setor:`

      replyCards = sectorNames.slice(0, 4).map(secName => {
        const secNorm = secName.trim().toLowerCase()
        const topSectorWorkers = funcionarios
          .map(f => {
            const secDays = engine.empSectorHist?.[f.id]?.[normStr(secName)] || 0
            const att = engine.attendanceHist[f.id]
            const attRate = att && att.total > 0 ? Math.round((att.presente / att.total) * 100) : 100
            return { f, secDays, attRate }
          })
          .sort((a, b) => b.secDays - a.secDays || b.attRate - a.attRate)
          .slice(0, 2)

        const topWorker = topSectorWorkers[0]
        const countLocs = localidades.filter(l => l.setor === secName).length

        return {
          title: `Setor ${secName}`,
          subtitle: `${countLocs} localidades vinculadas`,
          badge: `Setor Ativo`,
          reasons: [
            `🏆 Líder de Experiência: ${topWorker?.f?.nome || 'N/A'} (${topWorker?.secDays || 0}x no setor)`,
            `🎯 Prioridade Absoluta na Alocação`,
            `⭐ ${topWorker?.attRate || 100}% Assiduidade Média`
          ]
        }
      })
    } else if (lower.includes('melhor funcionário') || lower.includes('melhor funcionario') || lower.includes('quem é o melhor')) {
      if (selectedLocalityId === 'all' || !currentLoc) {
        // Multi-sector overview of top candidates
        replyText = `Principais destaques de compatibilidade considerando a **prioridade do setor e a localidade**:`
        replyCards = localidades.slice(0, 4).map(loc => {
          const topCandidates = funcionarios
            .map(f => {
              const locDays = engine.empLocHist[f.id]?.[normStr(loc.nome)] || 0
              const secDays = engine.empSectorHist?.[f.id]?.[normStr(loc.setor)] || 0
              const isSectorMatch = f.setor?.trim().toLowerCase() === loc.setor?.trim().toLowerCase()
              const score = (isSectorMatch ? 40 : 0) + (locDays * 2) + (secDays * 1)
              return { f, locDays, secDays, isSectorMatch, score }
            })
            .sort((a, b) => b.score - a.score)[0]

          return {
            title: loc.nome,
            subtitle: `Setor: ${loc.setor}`,
            badge: topCandidates?.isSectorMatch ? `🎯 Setor Compatível` : 'Recomendado',
            reasons: [
              `⭐ Destaque: ${topCandidates?.f.nome || 'Colaborador'}`,
              `📌 ${topCandidates?.secDays || 0}x de experiência no Setor ${loc.setor}`,
              `🔥 ${topCandidates?.locDays || 0}x nesta localidade`
            ]
          }
        })
      } else {
        // Find top experienced employee for the selected location with sector priority
        const locName = currentLoc.nome
        const locSetor = currentLoc.setor
        const candidates = funcionarios
          .map(f => {
            const locDays = engine.empLocHist[f.id]?.[normStr(locName)] || 0
            const secDays = engine.empSectorHist?.[f.id]?.[normStr(locSetor)] || 0
            const isSectorMatch = f.setor?.trim().toLowerCase() === locSetor.trim().toLowerCase()
            const att = engine.attendanceHist[f.id]
            const attRate = att && att.total > 0 ? Math.round((att.presente / att.total) * 100) : 100
            const score = (isSectorMatch ? 40 : 5) + (locDays * 2) + (secDays * 1)
            return { f, locDays, secDays, isSectorMatch, attRate, score }
          })
          .sort((a, b) => b.score - a.score || b.locDays - a.locDays)

        const top3 = candidates.slice(0, 3)

        replyText = `Analisando o setor **${locSetor}** e o histórico da localidade **${locName}**, os colaboradores recomendados são:`
        replyCards = top3.map((item, idx) => ({
          title: `${idx + 1}º ${item.f.nome}`,
          subtitle: `${item.f.cargo} • Setor ${item.f.setor || 'Operacional'}`,
          badge: item.isSectorMatch ? `🎯 Setor Prioritário` : `Afinidade Histórica`,
          reasons: [
            item.isSectorMatch ? `🎯 Setor ${item.f.setor} 100% Compatível` : `📌 ${item.secDays}x no Setor ${locSetor}`,
            `🔥 ${item.locDays}x nesta localidade específica`,
            `⭐ ${item.attRate}% Assiduidade`
          ]
        }))
      }
    } else if (lower.includes('com quem') || lower.includes('trabalhou junto') || lower.includes('mais trabalhou')) {
      // Co-working partners analysis
      const topPairs: { f1: string; f2: string; count: number }[] = []
      Object.entries(engine.pairHist).forEach(([f1Id, pairs]) => {
        Object.entries(pairs).forEach(([f2Id, count]) => {
          if (f1Id < f2Id) { // avoid duplicate pairs
            topPairs.push({ f1: f1Id, f2: f2Id, count })
          }
        })
      })

      topPairs.sort((a, b) => b.count - a.count)
      const top3Pairs = topPairs.slice(0, 3)

      replyText = `Baseado na matriz de co-trabalho dos últimos 90 dias, as duplas de maior sinergia em equipe são:`
      replyCards = top3Pairs.map(p => ({
        title: `${funcMap[p.f1]?.nome || 'Colaborador'} & ${funcMap[p.f2]?.nome || 'Colaborador'}`,
        subtitle: `Dupla de alta afinidade operacional`,
        badge: `${p.count}x Juntos`,
        reasons: [
          `🤝 ${p.count} alocações na mesma localidade e data`,
          `🎯 Atuação conjunta validada no setor`
        ]
      }))
    } else {
      // General contextual response
      replyText = `O Copiloto IA monitora **${funcionarios.length} colaboradores** e **${localidades.length} localidades**. A IA utiliza prioridade estrita de **Setor (peso 40%)**, frequência em localidades (peso 30%), histórico de duplas (peso 15%) e assiduidade (peso 15%).`
    }

    const aiMsg: ChatMessage = {
      id: safeId(),
      sender: 'assistant',
      text: replyText,
      cards: replyCards,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg, aiMsg])
    setInputQuery('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copiloto IA - Inteligência de Alocação Multi-Setor"
    >
      <div className="space-y-4 max-w-5xl w-full mx-auto flex flex-col h-[80vh]">
        {/* Header Control Panel */}
        <div className="bg-muted/40 border border-border/30 p-4 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-sm font-black uppercase text-muted-foreground tracking-widest shrink-0">
              Localidade / Setor:
            </span>
            <select
              value={selectedLocalityId}
              onChange={e => setSelectedLocalityId(e.target.value)}
              className="bg-card border border-border/40 rounded-xl px-3 py-3 text-base font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-72 uppercase tracking-wider"
            >
              <option value="all">⚡ TODOS OS SETORES E LOCALIDADES</option>
              {localidades.map(l => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.setor})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-base font-black px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Prioridade do Setor Ativa
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
          {[
            '🚀 Alocar Todos os Setores de Uma Vez',
            '🎯 Prioridade dos Setores',
            'Quem é o melhor funcionário para este posto?',
            'Com quem esse funcionário mais trabalhou?'
          ].map((promptText, i) => (
            <button
              key={i}
              onClick={() => handleAnswerQuestion(promptText)}
              className="px-5 py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full text-sm font-black uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2.5 max-w-[90%]",
                msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-base font-bold",
                  msg.sender === 'user'
                    ? "bg-primary text-primary-foreground border-primary/30"
                    : "bg-gradient-to-br from-primary to-purple-600 text-white border-primary/40 shadow-md shadow-primary/20"
                )}
              >
                {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              <div className="space-y-2">
                <div
                  className={cn(
                    "p-5 rounded-2xl text-base leading-relaxed backdrop-blur-md border",
                    msg.sender === 'user'
                      ? "bg-primary text-primary-foreground border-primary/20 font-bold"
                      : "bg-card/90 text-foreground border-border/40 shadow-sm"
                  )}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>

                {/* Structured Cards (if any) */}
                {msg.cards && (
                  <div className="space-y-2 pt-1">
                    {msg.cards.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-muted/30 border border-border/40 rounded-xl space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-base font-black uppercase tracking-tight text-foreground">
                            {c.title}
                          </h5>
                          {c.badge && (
                            <span className="text-base font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                              {c.badge}
                            </span>
                          )}
                        </div>
                        {c.subtitle && (
                          <p className="text-sm text-muted-foreground font-semibold">
                            {c.subtitle}
                          </p>
                        )}
                        {c.reasons && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {c.reasons.map((r, ri) => (
                              <span
                                key={ri}
                                className="text-base font-black px-2 py-0.5 rounded-md bg-background border border-border/30 text-muted-foreground uppercase tracking-tight"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/30 shrink-0">
          <input
            type="text"
            placeholder="Pergunte ao Copiloto IA (ex: prioridade do setor, melhor para a localidade)..."
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnswerQuestion(inputQuery)}
            className="flex-1 px-6 py-4 bg-muted/40 border border-border/40 rounded-xl text-base font-bold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all uppercase tracking-wider"
          />
          <button
            onClick={() => handleAnswerQuestion(inputQuery)}
            disabled={!inputQuery.trim()}
            className="p-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-md shadow-primary/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

function safeId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}
