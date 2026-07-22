import React, { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSunday, subWeeks, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Printer, ArrowLeft, Download, Share2, AlertTriangle, MessageCircle, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useUserTeam } from '../hooks/useUserTeam'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { DEFAULT_TIPOS_ESCALA, type TipoEscala } from './admin/AdminDashboard'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

export function EscalaSemanalPrint() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSharing, setIsSharing] = useState(false)
  
  // Get team from query params
  const queryParams = new URLSearchParams(window.location.search)
  const teamId = queryParams.get('team')

  // Weekly data (from current week)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  
  // Team members filter (if team is specified)
  const { data: teamMembers = [] } = useQuery<string[]>({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      if (!teamId) return []
      const { data: mems } = await supabase.from('equipe_membros').select('funcionario_id').eq('equipe_id', teamId)
      return (mems || []).map((m: any) => m.funcionario_id)
    },
    enabled: !!teamId
  })
  
  const { data: teamInfo, isLoading: loadTeam } = useUserTeam()

  const funcionarios = React.useMemo(() => {
    let list = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
    
    if (teamInfo?.isRestricted) {
      return list.filter(f => teamInfo.teamMemberIds.includes(f.id))
    }
    
    if (teamId) {
      return list.filter(f => teamMembers.includes(f.id))
    }

    return list
  }, [allFuncionarios, teamInfo, teamId, teamMembers])
  
  const { data: escalasSemanal = [], isLoading: loadESemana } = useEscalasPeriodo(
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd')
  )

  const { data: tiposEscala = DEFAULT_TIPOS_ESCALA } = useConfiguracao<TipoEscala[]>('tipos_escala', DEFAULT_TIPOS_ESCALA)
  const { data: feriados = [] } = useConfiguracao<any[]>('feriados', [])
  
  const getCleanTiposEscala = (tipos: TipoEscala[] | undefined) => {
    const list = [...(tipos || DEFAULT_TIPOS_ESCALA)]
    if (!list.some(t => t.id === 'hora_extra')) {
      list.push({ id: 'hora_extra', letra: 'HE', nome: 'Hora Extra', bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' })
    }
    if (!list.some(t => t.id === 'suspensao')) {
      list.push({ id: 'suspensao', letra: 'S', nome: 'Suspensão', bg: 'bg-rose-700', text: 'text-white', ring: 'ring-rose-600' })
    }
    return list
  }

  const STATUS_MAP: Record<string, TipoEscala> = getCleanTiposEscala(tiposEscala).reduce((acc: Record<string, TipoEscala>, t: TipoEscala) => {
    acc[t.id] = t
    return acc
  }, {} as Record<string, TipoEscala>)

  const getFeriado = (day: Date) => {
    const dStr = format(day, 'yyyy-MM-dd')
    return feriados.find((f: any) => f.data === dStr)
  }

  const escalaMapSemanal = (escalasSemanal as any[]).reduce((acc, e) => {
    const dateKey = e.data.substring(0, 10)
    acc[`${e.funcionario_id}_${dateKey}`] = e
    return acc
  }, {} as Record<string, any>)

  const { data: frequenciasSemanal = [] } = useQuery({
    queryKey: ['frequencias-semanal', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frequencia')
        .select('*')
        .gte('data', format(weekStart, 'yyyy-MM-dd'))
        .lte('data', format(weekEnd, 'yyyy-MM-dd'))
      if (error) throw error
      return data || []
    }
  })

  const freqMapSemanal = React.useMemo(() => {
    const map: Record<string, string> = {}
    frequenciasSemanal.forEach((f: any) => {
      if (f.funcionario_id && f.data) {
        const dateKey = typeof f.data === 'string' ? f.data.substring(0, 10) : ''
        if (dateKey) {
          map[`${f.funcionario_id}_${dateKey}`] = f.status
        }
      }
    })
    return map
  }, [frequenciasSemanal])

  const getEscalaLetra = (tipo: string) => {
    const cfg = STATUS_MAP[tipo] || {
      id: tipo,
      letra: tipo.substring(0, 2).toUpperCase(),
      nome: tipo,
      bg: 'bg-slate-500/20 border border-slate-500/30',
      text: 'text-slate-600 font-extrabold',
      ring: 'ring-slate-400'
    }
    return cfg?.letra || '-'
  }

  if (loadF || loadESemana) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Carregando escala..." />
      </div>
    )
  }

  const handlePrint = () => {
    const element = document.getElementById('semanal-print-container')
    if (element) {
      setIsSharing(true)
      setTimeout(async () => {
        try {
          element.classList.add('no-shadows')
          const { toBlob } = await import('html-to-image')
          
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          const renderOptions = {
            backgroundColor: '#ffffff',
            pixelRatio: isMobile ? 1 : 2,
            quality: 0.95,
            skipFonts: true,
            cacheBust: true,
            filter: (node: Node) => {
              const tagName = (node as HTMLElement).tagName?.toLowerCase()
              if (tagName === 'svg' || tagName === 'path') {
                return false
              }
              if (tagName === 'button' || tagName === 'input' || tagName === 'select') {
                return false
              }
              return true
            }
          }

          // Temporarily disable cross-origin stylesheets to prevent tainted canvas / CORS issues
          const disabledSheets: CSSStyleSheet[] = []
          try {
            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i]
              try {
                let isCrossOrigin = false
                try {
                  if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
                    isCrossOrigin = true
                  }
                } catch (_) {
                  isCrossOrigin = true
                }

                if (isCrossOrigin) {
                  try {
                    sheet.disabled = true
                    disabledSheets.push(sheet)
                  } catch (_) {}
                }
              } catch (_) {}
            }
          } catch (err) {
            console.warn('Error disabling cross-origin stylesheets:', err)
          }

          let blob: Blob | null = null
          try {
            if (isMobile) {
              try { await toBlob(element, { ...renderOptions, pixelRatio: 1 }) } catch (_) {}
            }
            blob = await toBlob(element, renderOptions)
          } catch (firstErr) {
            console.warn('First render failed, retrying with pixelRatio 1...', firstErr)
            blob = await toBlob(element, {
              ...renderOptions,
              pixelRatio: 1,
              filter: renderOptions.filter
            })
          } finally {
            // Restore disabled stylesheets
            disabledSheets.forEach(sheet => {
              try {
                sheet.disabled = false
              } catch (_) {}
            })
          }
          
          element.classList.remove('no-shadows')
          
          if (!blob) {
            throw new Error('A renderização do canvas falhou (retornou null).')
          }
          
          const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
          const fileName = `escala-semanal-${format(weekStart, 'yyyy-MM-dd')}.${ext}`
          
          const downloadDirectly = () => {
            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = fileName
            link.click()
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
          }
          
          try {
            const file = new File([blob], fileName, { type: blob.type })
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Escala Semanal - 7Locar`,
                text: `Segue a Escala Semanal de Trabalho.`
              })
            } else {
              downloadDirectly()
            }
          } catch (shareErr: any) {
            console.warn('Share API failed or was cancelled:', shareErr)
            if (shareErr.name !== 'AbortError') {
              downloadDirectly()
            }
          }
        } catch (err: any) {
          if (element) {
            element.classList.remove('no-shadows')
          }
          console.error('Erro ao gerar Imagem:', err)
          alert('Erro ao gerar: ' + (err?.message || JSON.stringify(err)))
        } finally {
          setIsSharing(false)
        }
      }, 50)
    } else {
      window.print()
    }
  }

  const setores = Array.from(new Set(funcionarios.map(f => f.setor))).sort()

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:m-0 print:p-0">
      <div className="print:hidden p-4 bg-gray-100 border-b flex flex-wrap gap-4 items-center justify-between">
        <Button variant="secondary" onClick={() => navigate('/escala')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-4 bg-white rounded-lg p-1 border shadow-sm">
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm min-w-[180px] text-center">
            Semana: {format(weekStart, "dd/MM", { locale: ptBR })} a {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Share2 className="w-4 h-4" />
          Compartilhar Imagem
        </Button>
      </div>

      <div id="semanal-print-container" className="p-6 bg-card text-foreground" style={{ width: '1123px', minHeight: '794px' }}>
        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">Escala Semanal Detalhada</h1>
          <p className="text-muted-foreground font-bold text-sm mt-1 uppercase tracking-wider">
            Semana: {format(weekStart, 'dd/MM')} a {format(weekEnd, 'dd/MM/yyyy')}
          </p>
        </div>

        {/* WEEKLY VIEW WITH BEAUTIFUL GRID */}
        <div className="mb-6 avoid-break bg-card border border-border rounded-3xl shadow-xl overflow-hidden">
          <table className="w-full border-separate border-spacing-0 table-fixed">
            <thead className="bg-muted shadow-sm">
              <tr>
                <th className="p-4 text-left border-r border-b border-border w-[220px]">
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Colaborador</span>
                </th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="p-3 text-center border-r border-b border-border/50 bg-muted">
                    <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-1">
                      {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][day.getDay()]}
                    </div>
                    <div className="w-9 h-9 mx-auto flex items-center justify-center rounded-xl text-sm font-black text-foreground">
                      {format(day, 'dd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {setores.map(setor => {
                const funcsDoSetor = funcionarios.filter(f => f.setor === setor)
                if (funcsDoSetor.length === 0) return null

                return (
                  <React.Fragment key={setor}>
                    <tr className="bg-card/50">
                      <td colSpan={weekDays.length + 1} className="px-6 py-3 border-b border-border bg-card shadow-sm">
                        <div className="flex items-center gap-3 inline-flex">
                          <div className="w-1.5 h-5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                          <span className="text-xs font-black uppercase text-primary tracking-[0.2em]">{setor || 'Equipe Geral'}</span>
                        </div>
                      </td>
                    </tr>
                    {funcsDoSetor.map(func => (
                      <tr key={func.id} className="group transition-colors">
                        <td className="px-6 py-4 border-r border-b border-border bg-card">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                              {func.nome.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{func.nome}</span>
                          </div>
                        </td>
                        {weekDays.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd')
                          const feriado = getFeriado(day)
                          const isSun = isSunday(day)
                          const freqStatus = freqMapSemanal[`${func.id}_${dateStr}`]
                          const escalaDia = escalaMapSemanal[`${func.id}_${dateStr}`]
                          
                          const freqToEscalaMap: Record<string, string> = {
                            'presente': 'presente',
                            'hora_extra': 'hora_extra',
                            'falta': 'falta',
                            'folga': 'compensar',
                            'ferias': 'ferias',
                            'atestado': 'atestado'
                          }
                          const mappedFreqEscala = freqStatus ? freqToEscalaMap[freqStatus] : null
                          const resolvedTipoId = escalaDia?.tipo || mappedFreqEscala || ((isSun || feriado) ? 'repouso' : 'presente')
                          
                          const cfg = STATUS_MAP[resolvedTipoId] || {
                            id: resolvedTipoId,
                            letra: resolvedTipoId.substring(0, 2).toUpperCase(),
                            nome: resolvedTipoId,
                            bg: 'bg-slate-500/20 border border-slate-500/30',
                            text: 'text-slate-600 font-extrabold shadow-none',
                            ring: 'ring-slate-400'
                          }
                          const isInactive = !!(func.data_desligamento && dateStr >= func.data_desligamento)
                          
                          const isConfirmedPresent = freqStatus === 'presente' || freqStatus === 'hora_extra'
                          const hasWarning = escalaDia?.observacoes?.includes('[ADVERTÊNCIA]')
                          const hasObs = escalaDia?.observacoes && 
                                         !escalaDia.observacoes.includes('[ADVERTÊNCIA]') && 
                                         !escalaDia.observacoes.includes('[SUSPENSÃO]') && 
                                         escalaDia.observacoes.trim() !== '' && 
                                         escalaDia.observacoes !== 'Gerado automaticamente'
                          
                          return (
                            <td key={dateStr} className="p-0 text-center border-b border-r border-border/50">
                              <div className="w-full h-full min-h-[50px] flex items-center justify-center relative">
                                {isInactive ? (
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[9px] border border-rose-500/10 bg-rose-500/10 text-rose-600/90">
                                    DESL
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-black relative",
                                    cfg && resolvedTipoId !== 'presente' 
                                      ? `text-xs shadow-md ${cfg.bg} ${cfg.text}` 
                                      : "border-2 border-transparent text-muted-foreground/30"
                                  )}>
                                    {cfg && resolvedTipoId !== 'presente' 
                                      ? ((resolvedTipoId === 'repouso' && (isSunday(day) || getFeriado(day))) ? 'D' : cfg.letra)
                                      : (resolvedTipoId === 'presente' && !isSharing ? '·' : '')
                                    }
                                    {hasWarning && (
                                      <div className="absolute w-3.5 h-3.5 -bottom-1 -left-1 bg-amber-500 text-white flex items-center justify-center rounded-full border border-white p-[0.5px]">
                                        <AlertTriangle className="w-full h-full" strokeWidth={4} />
                                      </div>
                                    )}
                                    {hasObs && (
                                      <div className="absolute w-3.5 h-3.5 -top-1 -right-1 bg-indigo-500 text-white flex items-center justify-center rounded-full border border-white p-[0.5px]">
                                        <MessageCircle className="w-full h-full" strokeWidth={3.5} />
                                      </div>
                                    )}
                                    {isConfirmedPresent && (
                                      <div className="absolute w-3.5 h-3.5 -bottom-1 -right-1 bg-emerald-500 text-white flex items-center justify-center rounded-full border border-white p-[0.5px]">
                                        <Check className="w-full h-full" strokeWidth={6} />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* LEGEND PANEL */}
        <div className="flex flex-wrap gap-2.5 mt-8 px-2 justify-center bg-card/40 border border-border/40 p-4 rounded-3xl">
          {tiposEscala.map((cfg: TipoEscala) => (
            <div key={cfg.id} className="flex items-center gap-2 px-3.5 py-2 bg-card border border-border/60 rounded-2xl shadow-sm">
              <div className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-[10px] shadow-inner ${cfg.bg} ${cfg.text}`}>
                {cfg.letra}
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{cfg.nome}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border text-[10px] font-bold text-muted-foreground flex justify-end uppercase tracking-wider">
          Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 landscape; margin: 0mm !important; }
        @media print {
          html { zoom: 1.0; }
          body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
          body::before, body::after { display: none !important; }
          .avoid-break { page-break-inside: avoid; }
          aside, nav, .bottom-nav, .top-header { display: none !important; }
          .print\\:hidden { display: none !important; }
          #root, #root > *, #root > * > * { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
          table { border-collapse: collapse; width: 100% !important; margin: 10px 0 !important; }
          td, th { background: #fff !important; color: #000 !important; border-color: #999 !important; padding: 6px 8px !important; font-size: 9px !important; }
        }
      `}} />
    </div>
  )
}