import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Clock, 
  Calendar, 
  MapPin, 
  Layers, 
  TrendingUp, 
  UserCheck, 
  FileText, 
  MessageSquare, 
  Bell, 
  Package, 
  Box, 
  ClipboardList, 
  Car, 
  Truck, 
  Navigation, 
  Fuel, 
  Wrench, 
  User, 
  UserPlus, 
  Settings, 
  ShieldAlert, 
  ArrowLeft, 
  Home, 
  Search, 
  Terminal, 
  Copy, 
  Check, 
  LifeBuoy, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  KeyRound
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useConfiguracao } from '../hooks/useConfiguracoes'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, hasPermission } = useAuth()
  const { data: platNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: platSlogan = 'Gestão Eficaz' } = useConfiguracao('plataforma_slogan', 'Gestão Eficaz')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [copied, setCopied] = useState(false)

  // Dictionary of system pages for dynamic permission filtering and searching
  const systemPages = [
    { path: '/', label: 'Painel Principal', pageId: 'dashboard', description: 'Indicadores e resumos gerais', icon: LayoutDashboard },
    { path: '/dashboard-producao', label: 'Produção', pageId: 'dashboard_producao', description: 'Metas e rendimento operacional', icon: Activity },
    { path: '/funcionarios', label: 'Funcionários', pageId: 'funcionarios', description: 'Cadastro e gestão de colaboradores', icon: Users },
    { path: '/frequencia', label: 'Frequência Diária', pageId: 'frequencia', description: 'Registro de ponto e presença', icon: Clock },
    { path: '/escala', label: 'Escala de Trabalho', pageId: 'escala', description: 'Planejamento e distribuição de plantão', icon: Calendar },
    { path: '/escala/localidades', label: 'Meta e Rota', pageId: 'localidades', description: 'Configuração de postos de serviço', icon: MapPin },
    { path: '/escala/demandas', label: 'Demandas', pageId: 'demandas', description: 'Painel e histórico de demandas', icon: ClipboardList },
    { path: '/escala/modelos', label: 'Modelos de Escala', pageId: 'modelos_escala', description: 'Gabaritos pré-definidos de plantão', icon: Layers },
    { path: '/rendimento', label: 'Análise de Rendimento', pageId: 'rendimento', description: 'Produtividade individual e coletiva', icon: TrendingUp },
    { path: '/equipes', label: 'Equipes & Grupos', pageId: 'equipes', description: 'Divisão de times e encarregados', icon: UserCheck },
    { path: '/atestados', label: 'Atestados', pageId: 'atestados', description: 'Histórico de afastamentos e laudos', icon: FileText },
    { path: '/observacoes', label: 'Observações de Campo', pageId: 'observacoes', description: 'Anotações diárias das equipes', icon: MessageSquare },
    { path: '/notificacoes', label: 'Notificações', pageId: 'notificacoes', description: 'Alertas importantes e avisos gerais', icon: Bell },
    { path: '/estoque', label: 'Estoque Central', pageId: 'estoque', description: 'Controle geral de insumos', icon: Package },
    { path: '/estoque/produtos', label: 'Catálogo de Produtos', pageId: 'estoque_produtos', description: 'Materiais e controle de entrada', icon: Box },
    { path: '/estoque/solicitacoes', label: 'Solicitações de Insumos', pageId: 'estoque_solicitacoes', description: 'Pedidos de material das equipes', icon: ClipboardList },
    { path: '/frota', label: 'Dashboard de Frota', pageId: 'frota', description: 'Indicadores e relatórios de veículos', icon: Car },
    { path: '/frota/veiculos', label: 'Veículos da Frota', pageId: 'frota_veiculos', description: 'Controle de carros, motos e utilitários', icon: Truck },
    { path: '/frota/registros', label: 'Diário de Bordo / KM', pageId: 'frota_registros', description: 'Abertura e fechamento de rotas', icon: Navigation },
    { path: '/frota/abastecimentos', label: 'Abastecimentos', pageId: 'frota_abastecimentos', description: 'Consumo de combustível e custos', icon: Fuel },
    { path: '/frota/manutencoes', label: 'Manutenções', pageId: 'frota_manutencoes', description: 'Revisões preventivas e corretivas', icon: Wrench },
    { path: '/perfil', label: 'Meu Perfil', pageId: 'perfil', description: 'Configurações de conta e foto', icon: User },
    { path: '/usuarios', label: 'Controle de Usuários', pageId: 'usuarios', description: 'Níveis de acesso e credenciais', icon: UserPlus },
    { path: '/admin', label: 'Painel de Controle', pageId: 'admin', description: 'Parâmetros corporativos', icon: Settings },
  ]

  // Filter routes: Must be authenticated, must have visualization rights, must match query
  const filteredPages = systemPages.filter(p => {
    if (!isAuthenticated) return false
    
    // Developer bypass or permission check
    if (p.pageId !== 'perfil' && !user?.isDev) {
      if (!hasPermission(p.pageId, 'visualizar')) {
        return false
      }
    }

    const query = searchQuery.toLowerCase()
    return (
      p.label.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.path.toLowerCase().includes(query)
    )
  })

  // Diagnostic Payload
  const diagnosticInfo = {
    url: window.location.href,
    path: window.location.hash || window.location.pathname,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    authStatus: isAuthenticated ? 'Autenticado' : 'Não Autenticado',
    user: user?.profile?.nome || 'Anônimo',
    role: user?.roles?.[0]?.nome || 'Nenhuma',
    brandingName: platNome,
    code: '404_NOT_FOUND'
  }

  const copyDiagnostics = () => {
    navigator.clipboard.writeText(JSON.stringify(diagnosticInfo, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-neutral-900 to-black text-white relative overflow-y-auto flex flex-col justify-between py-10 px-4 scrollbar-none select-none">
      
      {/* Premium Ambient Radial Lights */}
      <div className="absolute top-[10%] left-[15%] w-[45%] h-[40%] bg-primary/10 rounded-full blur-[140px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[20%] right-[15%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl shadow-inner">
            {platNome} System
          </span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl">
          Código: 404_NOT_FOUND
        </span>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full relative z-10 py-10 flex-1 flex flex-col lg:flex-row items-center gap-12 justify-center">
        
        {/* Left Side: Stunning Custom SVG Illustration & Basic Message */}
        <div className="flex-1 text-center lg:text-left space-y-6 max-w-md">
          
          {/* Animated 3D/Neon Cosmic Radar SVG */}
          <div className="relative mb-2 select-none pointer-events-none">
            <svg className="w-56 h-56 sm:w-64 sm:h-64 mx-auto lg:mx-0 animate-float" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Star fields */}
              <circle cx="30" cy="40" r="1.2" fill="white" className="animate-pulse" style={{ animationDelay: '0.2s', opacity: 0.8 }} />
              <circle cx="170" cy="50" r="1" fill="white" className="animate-pulse" style={{ animationDelay: '0.9s', opacity: 0.5 }} />
              <circle cx="45" cy="140" r="1.5" fill="white" className="animate-pulse" style={{ animationDelay: '1.4s', opacity: 0.7 }} />
              <circle cx="145" cy="155" r="1" fill="white" className="animate-pulse" style={{ animationDelay: '0.4s', opacity: 0.9 }} />
              <circle cx="95" cy="25" r="1.3" fill="white" className="animate-pulse" style={{ animationDelay: '0.7s', opacity: 0.6 }} />

              {/* Glowing Orbit Rings */}
              <circle cx="100" cy="100" r="82" stroke="url(#orbitGradient)" strokeWidth="1" strokeDasharray="4 6" className="animate-spin" style={{ animationDuration: '40s' }} />
              <circle cx="100" cy="100" r="64" stroke="url(#orbitGradient2)" strokeWidth="0.8" strokeDasharray="3 3" className="animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
              
              {/* Radial Sweep Planet */}
              <circle cx="100" cy="100" r="38" fill="url(#planetRadial)" className="filter drop-shadow-[0_0_35px_rgba(20,184,166,0.25)]" />
              
              {/* Glowing Neon Cyber Rings */}
              <ellipse cx="100" cy="100" rx="68" ry="14" stroke="url(#ringGradient)" strokeWidth="2.5" transform="rotate(-14 100 100)" />
              
              {/* Pulse scanning beacon */}
              <g transform="translate(100, 100)">
                <line x1="0" y1="0" x2="60" y2="-40" stroke="rgba(20, 184, 166, 0.45)" strokeWidth="1.5" strokeDasharray="2 2" className="origin-center animate-spin" style={{ animationDuration: '8s' }} />
                <circle cx="0" cy="0" r="5" fill="#14b8a6" className="filter drop-shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                <circle cx="0" cy="0" r="12" stroke="#14b8a6" strokeWidth="1" strokeOpacity="0.4" className="animate-ping" style={{ animationDuration: '2s' }} />
              </g>

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="orbitGradient" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
                  <stop stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                  <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                  <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="orbitGradient2" x1="36" y1="36" x2="164" y2="164" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f43f5e" stopOpacity="0.02" />
                  <stop offset="0.5" stopColor="#f43f5e" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#f43f5e" stopOpacity="0.02" />
                </linearGradient>
                <radialGradient id="planetRadial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(88 88) rotate(45) scale(52)">
                  <stop stopColor="#2dd4bf" />
                  <stop offset="0.55" stopColor="hsl(var(--primary))" />
                  <stop offset="1" stopColor="#042f2e" />
                </radialGradient>
                <linearGradient id="ringGradient" x1="30" y1="100" x2="170" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="rgba(255,255,255,0.01)" />
                  <stop offset="0.25" stopColor="#2dd4bf" stopOpacity="0.8" />
                  <stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="0.75" stopColor="#f43f5e" stopOpacity="0.8" />
                  <stop offset="1" stopColor="rgba(255,255,255,0.01)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Glowing artwork text floating */}
            <div className="absolute inset-0 flex items-center justify-center -translate-y-4">
              <span className="text-6xl sm:text-7xl font-black tracking-tighter bg-gradient-to-b from-white via-white/80 to-transparent bg-clip-text text-transparent opacity-90 select-none">
                404
              </span>
            </div>
          </div>

          {/* Core Error Description */}
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-foreground leading-tight">
              Página Não Encontrada
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed max-w-sm mx-auto lg:mx-0">
              A rota solicitada não existe ou foi temporariamente desativada no painel do <span className="text-primary">{platNome}</span>.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            <button 
              onClick={() => navigate(-1)}
              className="h-12 px-5 bg-card/60 dark:bg-card/25 backdrop-blur-md hover:bg-card/85 text-foreground border border-border/40 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-primary" /> Voltar
            </button>
            
            <Link 
              to="/" 
              className="h-12 px-6 bg-primary text-white hover:bg-primary/95 border border-primary/20 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" /> Ir para o Início
            </Link>
          </div>
        </div>

        {/* Right Side: Interactive Intelligent Route Suggestions and Search */}
        <div className="flex-1 w-full max-w-md bg-card/45 dark:bg-card/20 backdrop-blur-xl border border-border/30 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

          {/* Suggestions Header */}
          <div className="space-y-1.5 relative z-10">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Pesquisa de Navegação
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {isAuthenticated 
                ? 'Busque ou selecione um módulo ativo do seu usuário:' 
                : 'Selecione uma das opções públicas disponíveis abaixo:'
              }
            </p>
          </div>

          {/* Search Box (only if logged in) */}
          {isAuthenticated && (
            <div className="relative relative-z-10">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar módulo (ex: escala, frota)..."
                className="w-full h-11 pl-10 pr-4 bg-black/30 border border-border/30 rounded-xl text-xs font-bold focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 text-foreground transition-all placeholder:text-muted-foreground/50 select-text"
              />
              <Search className="w-4 h-4 text-muted-foreground/60 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          )}

          {/* Interactive Suggestions List */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            {isAuthenticated ? (
              filteredPages.length > 0 ? (
                filteredPages.map((item) => (
                  <Link 
                    key={item.path}
                    to={item.path}
                    className="flex items-center justify-between p-3.5 bg-muted/15 hover:bg-primary/10 border border-border/20 hover:border-primary/30 rounded-2xl group transition-all duration-300 hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:border-primary/20 transition-all">
                        <item.icon className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground/80 truncate max-w-[200px]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                    Nenhum módulo encontrado
                  </p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-[8px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors"
                  >
                    Limpar Filtro
                  </button>
                </div>
              )
            ) : (
              // Unauthenticated public options
              <div className="space-y-2">
                <Link 
                  to="/"
                  className="flex items-center justify-between p-3.5 bg-muted/15 hover:bg-primary/10 border border-border/20 hover:border-primary/30 rounded-2xl group transition-all duration-300 hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-all">
                      <KeyRound className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-primary">
                        Entrar no Sistema
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground/80">
                        Tela de Login e Autenticação
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>

                <Link 
                  to="/download"
                  className="flex items-center justify-between p-3.5 bg-muted/15 hover:bg-primary/10 border border-border/20 hover:border-primary/30 rounded-2xl group transition-all duration-300 hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-all">
                      <Download className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover:text-primary">
                        Download do Aplicativo
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground/80">
                        Instale o App oficial no celular
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            )}
          </div>

          {/* Quick Technical Support Link */}
          <div className="border-t border-border/20 pt-4 flex justify-between items-center text-[8.5px] font-bold text-muted-foreground uppercase tracking-widest">
            <span>Algum problema técnico?</span>
            <a 
              href="https://7locar.7all.com.br" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 text-primary hover:text-primary/85 font-black uppercase tracking-wider bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <LifeBuoy className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} /> Suporte
            </a>
          </div>

        </div>

      </div>

      {/* Diagnostics Console Accordion */}
      <div className="max-w-4xl mx-auto w-full relative z-10 mt-4 px-2">
        <div className="border border-border/20 rounded-2xl overflow-hidden bg-card/25 backdrop-blur-md">
          <button 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full flex items-center justify-between p-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" /> Dados de Diagnóstico Técnico
            </span>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          
          {showDiagnostics && (
            <div className="p-4 border-t border-border/10 bg-black/40 text-left relative">
              <button 
                onClick={copyDiagnostics}
                className="absolute top-4 right-4 bg-muted/30 border border-border/25 text-foreground hover:bg-muted/50 rounded-xl px-3 py-1.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-primary" /> Copiar Dados
                  </>
                )}
              </button>

              <div className="font-mono text-[9px] text-muted-foreground/85 leading-relaxed overflow-x-auto select-text max-h-48 pr-16 scrollbar-none">
                <pre>{JSON.stringify(diagnosticInfo, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="max-w-5xl mx-auto w-full text-center relative z-10 mt-8 border-t border-border/20 pt-6 shrink-0">
        <p className="text-[8px] font-bold text-muted-foreground/45 uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} {platNome} Enterprise Operations. All routes structured and secured.
        </p>
      </div>

    </div>
  )
}
