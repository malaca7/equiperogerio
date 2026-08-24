import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, Package, Truck, CalendarDays, Menu, X, 
  Users, Network, Navigation2, Clock, Activity, ShieldCheck, 
  Building2, ScanBarcode, Bell, FileText, Settings, LogOut, HeartPulse, Hammer, Navigation,
  Sun, Moon, Search
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Modal } from '../ui/Modal'

function getCategoryColor(category: string) {
  const cat = category.toLowerCase()
  if (cat.includes('prod') || cat.includes('operac')) {
    return {
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      active: 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
    }
  }
  if (cat.includes('escala') || cat.includes('planej')) {
    return {
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
      active: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
    }
  }
  if (cat.includes('equipe') || cat.includes('func') || cat.includes('rh')) {
    return {
      badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
      active: 'bg-gradient-to-tr from-violet-600 to-purple-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
    }
  }
  if (cat.includes('estoque') || cat.includes('epi') || cat.includes('supr')) {
    return {
      badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
      active: 'bg-gradient-to-tr from-cyan-600 to-teal-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
    }
  }
  if (cat.includes('frota') || cat.includes('veic') || cat.includes('km')) {
    return {
      badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
      active: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white border-orange-400 shadow-md shadow-orange-600/30'
    }
  }
  return {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
    active: 'bg-gradient-to-tr from-rose-600 to-pink-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
  }
}

export function BottomNavBar() {
  const location = useLocation()
  const { hasAnyPermission, user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  if (!user) return null

  // Core mobile tabs
  const tabs = [
    { to: '/', icon: Home, label: 'Painel' },
    { to: '/equipes', icon: Users, label: 'Equipe', permission: 'equipes' },
    { to: '/frequencia', icon: Clock, label: 'Frequência', permission: 'frequencia' },
    { to: '/escala', icon: CalendarDays, label: 'Escala', permission: 'escala' },
  ]

  const visibleTabs = tabs.filter(tab => !tab.permission || hasAnyPermission(tab.permission))

  // Additional navigation links for the native "More" sheet
  const moreLinks = [
    { to: '/funcionarios', icon: Users, label: 'Funcionários', category: 'Equipe', permission: 'funcionarios' },
    { to: '/metaerota', icon: Navigation2, label: 'Meta e Rota', category: 'Produção', permission: 'localidades' },
    { to: '/escala/demandas', icon: FileText, label: 'Demandas', category: 'Produção', permission: 'localidades' },
    { to: '/escala/modelos', icon: CalendarDays, label: 'Modelos de Escala', category: 'Escalas', permission: 'modelos_escala' },
    { to: '/atestados', icon: HeartPulse, label: 'Atestados', category: 'Equipe', permission: 'atestados' },
    { to: '/estoque', icon: Package, label: 'Painel de Estoque', category: 'Estoque', permission: 'estoque' },
    { to: '/estoque/produtos', icon: Package, label: 'Produtos (Estoque)', category: 'Estoque', permission: 'estoque_produtos' },
    { to: '/estoque/cautelas', icon: ShieldCheck, label: 'Cautelas e EPIs', category: 'Estoque', permission: 'estoque_cautelas' },
    { to: '/estoque/retirada-rapida', icon: ScanBarcode, label: 'Retirada de Estoque', category: 'Estoque', permission: 'estoque_retirada' },
    { to: '/frota', icon: Truck, label: 'Gestão de Frota', category: 'Frota', permission: 'frota' },
    { to: '/frota/motorista', icon: Truck, label: 'Iniciar/Finalizar Rota', category: 'Frota', permission: 'frota_rotas' },
    { to: '/frota/registros', icon: Activity, label: 'Diário de KM', category: 'Frota', permission: 'frota_registros' },
    { to: '/frota/controle', icon: Navigation, label: 'Controle de Rotas', category: 'Frota', permission: 'frota_registros' },
    { to: '/admin', icon: Settings, label: 'Painel de Controle', category: 'Admin', permission: 'admin' },
  ].filter(link => hasAnyPermission(link.permission))

  const filteredMoreLinks = moreLinks.filter(link => {
    if (!searchTerm.trim()) return true
    const s = searchTerm.toLowerCase().trim()
    return link.label.toLowerCase().includes(s) || link.category.toLowerCase().includes(s)
  })

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Mobile Floating Bottom Dock */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-card/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] p-1.5 flex items-center justify-around h-16">
        {visibleTabs.map(tab => {
          const ActiveIcon = tab.icon
          const active = isActive(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all relative active:scale-90",
                active 
                  ? "bg-primary text-primary-foreground font-black shadow-md shadow-primary/25 border-t-2 border-primary-foreground/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-bold"
              )}
            >
              <ActiveIcon className={cn("w-6 h-6 transition-transform", active ? "scale-110" : "")} />
              <span className="text-[11px] sm:text-xs tracking-tight mt-0.5 uppercase font-black">{tab.label}</span>
            </Link>
          )
        })}

        {/* "Mais" button */}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full rounded-xl transition-all relative active:scale-90 cursor-pointer",
            menuOpen 
              ? "bg-primary text-primary-foreground font-black shadow-md shadow-primary/25" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-bold"
          )}
        >
          <Menu className="w-6 h-6" />
          <span className="text-[11px] sm:text-xs tracking-tight mt-0.5 uppercase font-black">Mais</span>
        </button>
      </nav>

      {/* Corporate Bottom Sheet Modal */}
      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu Completo"
        subtitle="Acesso rápido a todos os módulos e funcionalidades"
        className="max-h-[88vh]"
      >
        {/* Search bar inside bottom sheet */}
        <div className="mb-4">
          <div className="relative flex items-center">
            <Search className="w-4.5 h-4.5 absolute left-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar páginas no menu..."
              className="w-full pl-10 pr-8 py-3 text-xs sm:text-sm font-bold bg-muted/50 border border-border/60 rounded-2xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-1 max-h-[50vh] overflow-y-auto pr-1">
          {filteredMoreLinks.map(link => {
            const LinkIcon = link.icon
            const active = isActive(link.to)
            const themeColors = getCategoryColor(link.category)
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "p-3.5 rounded-2xl border flex flex-col items-start justify-between gap-3 transition-all active:scale-95 text-left shadow-sm cursor-pointer",
                  active
                    ? themeColors.active
                    : "bg-muted/30 border-border/60 hover:bg-muted/70 text-foreground font-bold"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-xs border",
                  active ? "bg-white/20 text-white border-white/30" : themeColors.badge
                )}>
                  <LinkIcon className="w-5.5 h-5.5" />
                </div>
                <div>
                  <span className={cn("text-[9px] font-black uppercase tracking-wider block opacity-80", active ? "text-white/90" : "text-muted-foreground")}>
                    {link.category}
                  </span>
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight mt-0.5 leading-tight">{link.label}</h4>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick Settings Footer */}
        <div className="mt-4 pt-4 border-t border-border/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/50">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-muted-foreground">Alternar Modo Noturno</span>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-foreground transition-all active:scale-90 shadow-sm cursor-pointer"
              title="Alternar Tema"
            >
              {theme === 'light'
                ? <Sun className="w-5.5 h-5.5 text-amber-500" />
                : <Moon className="w-5.5 h-5.5 text-primary" />
              }
            </button>
          </div>

          <button
            onClick={() => {
              setMenuOpen(false)
              signOut()
            }}
            className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <LogOut className="w-5 h-5" /> Sair da Plataforma
          </button>
        </div>
      </Modal>
    </>
  )
}
