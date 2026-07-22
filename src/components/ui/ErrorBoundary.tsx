import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { ShieldAlert, RefreshCw, Copy, Check, Terminal, LifeBuoy, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    })
    window.location.reload()
  }

  private handleCopyLogs = () => {
    const logPayload = {
      errorName: this.state.error?.name || 'Error',
      errorMessage: this.state.error?.message || 'No message',
      errorStack: this.state.error?.stack || '',
      componentStack: this.state.errorInfo?.componentStack || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    }

    navigator.clipboard.writeText(JSON.stringify(logPayload, null, 2))
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 2000)
  }

  public render() {
    if (this.state.hasError) {
      const errorTitle = this.state.error?.name || 'Erro Crítico'
      const errorMessage = this.state.error?.message || 'Ocorreu um erro inesperado na renderização do sistema.'

      return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-neutral-950 to-black text-white relative overflow-hidden flex flex-col justify-between py-12 px-4 select-all">
          {/* Ambient Glow Lights */}
          <div className="absolute top-[10%] left-[20%] w-[50%] h-[40%] bg-rose-500/10 rounded-full blur-[160px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[160px] pointer-events-none" />

          {/* Top Branding */}
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between relative z-10 shrink-0 select-none">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-2xl shadow-inner">
              System Failure
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
              Code: CRITICAL_EXCEPTION_500
            </span>
          </div>

          {/* Main Error Workspace */}
          <div className="max-w-2xl mx-auto w-full text-center relative z-10 py-10 flex-1 flex flex-col justify-center select-none">
            {/* Visual Crash Icon Block */}
            <div className="relative mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-3xl bg-rose-500/5 border border-rose-500/25 flex items-center justify-center backdrop-blur-md shadow-2xl relative">
                <ShieldAlert className="w-12 h-12 text-rose-500 animate-pulse" />
                <div className="absolute inset-0 rounded-3xl border-2 border-rose-500/40 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-4 mb-8">
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-foreground leading-tight">
                Instabilidade Detectada
              </h1>
              <p className="text-xs font-bold text-rose-400 uppercase tracking-widest leading-relaxed max-w-lg mx-auto">
                Ocorreu uma falha inesperada durante a execução desta página. Isso pode ser causado por conexões de rede lentas ou inconsistências de dados.
              </p>
            </div>

            {/* Technical Exception Message Display */}
            <div className="mb-8 max-w-lg mx-auto w-full bg-rose-950/15 border border-rose-500/20 rounded-2xl p-4 text-left backdrop-blur-md">
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 block mb-1">
                {errorTitle}
              </span>
              <p className="text-xs font-bold text-foreground font-mono break-words leading-relaxed select-text">
                {errorMessage}
              </p>
            </div>

            {/* Collapsible/Monospace Stack Trace Details */}
            <div className="mb-8 w-full max-w-xl mx-auto text-left">
              <details className="group border border-border/20 rounded-2xl overflow-hidden bg-card/10 backdrop-blur-sm">
                <summary className="flex items-center justify-between p-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-rose-500" /> Detalhes Técnicos de Depuração
                  </span>
                  <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 border-t border-border/10 bg-black/40 font-mono text-[9px] text-muted-foreground/80 leading-relaxed overflow-x-auto select-text max-h-48 scrollbar-none">
                  <p className="font-bold text-rose-400/90 mb-2">=== EXCEPTION STACK ===</p>
                  <pre className="whitespace-pre-wrap mb-4">{this.state.error?.stack}</pre>
                  {this.state.errorInfo && (
                    <>
                      <p className="font-bold text-rose-400/90 mb-2">=== COMPONENT STACK ===</p>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
              <button 
                onClick={this.handleCopyLogs}
                className="h-13 px-6 bg-card/65 dark:bg-card/20 backdrop-blur-md hover:bg-card/85 text-foreground border border-border/30 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-rose-500" /> Copiar Código de Logs
                  </>
                )}
              </button>

              <button 
                onClick={this.handleReset}
                className="h-13 px-7 bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-950/40 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer animate-glow-pulse"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar Aplicativo
              </button>
            </div>

            {/* Support and assistance link */}
            <div className="mt-8 flex justify-center">
              <a 
                href="https://7locar.7all.com.br" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-muted-foreground/50 hover:text-rose-400 transition-colors bg-muted/20 border border-border/20 px-3.5 py-2 rounded-xl cursor-pointer"
              >
                <LifeBuoy className="w-3.5 h-3.5" /> Entrar em Contato com o Suporte
              </a>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="max-w-5xl mx-auto w-full text-center relative z-10 mt-6 border-t border-border/20 pt-6 shrink-0 select-none">
            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
              © {new Date().getFullYear()} Enterprise Operations. Crash containment active.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
