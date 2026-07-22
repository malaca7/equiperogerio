import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, Package, Truck, CalendarDays, Menu, X, 
  Users, Network, Navigation2, Clock, Activity, ShieldCheck, 
  Building2, ScanBarcode, Bell, FileText, Settings, LogOut, HeartPulse, Hammer, Navigation,
  Sun, Moon, Cloud
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Modal } from '../ui/Modal'

export function BottomNavBar() {
  const location = useLocation()
  const { hasAnyPermission, user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  // Core mobile tabs
  const tabs = [
    { to: '/', icon: Home, label: 'Painel' },
    { to: '/escala', icon: CalendarDays, label: 'Escalas', permission: 'escala' },
    { to: '/estoque', icon: Package, label: 'Estoque', permission: 'estoque' },
    { to: '/frota', icon: Truck, label: 'Frota', permission: 'frota' },
  ]

  // Filter allowed tabs based on permissions
  const visibleTabs = tabs.filter(tab => !tab.permission || hasAnyPermission(tab.permission))

  // Additional navigation links for the native "More" sheet
  const moreLinks = [
    { to: '/funcionarios', icon: Users, label: 'Funcionários', permission: 'funcionarios' },
    { to: '/equipes', icon: Network, label: 'Equipes', permission: 'equipes' },
    { to: '/escala/localidades', icon: Navigation2, label: 'Meta e Rota', permission: 'localidades' },
    { to: '/escala/demandas', icon: FileText, label: 'Demandas', permission: 'localidades' },
    { to: '/frequencia', icon: Clock, label: 'Chamada de Frequência', permission: 'frequencia' },
    { to: '/atestados', icon: HeartPulse, label: 'Atestados', permission: 'atestados' },
    { to: '/estoque/produtos', icon: Package, label: 'Produtos (Estoque)', permission: 'estoque_produtos' },
    { to: '/estoque/cautelas', icon: ShieldCheck, label: 'Cautelas e EPIs', permission: 'estoque_cautelas' },
    { to: '/estoque/retirada-rapida', icon: ScanBarcode, label: 'Retirada de Estoque', permission: 'estoque_retirada' },
    { to: '/frota/motorista', icon: Truck, label: 'Iniciar/Finalizar Rota', permission: 'frota_rotas' },
    { to: '/frota/registros', icon: Activity, label: 'Diário de KM', permission: 'frota_registros' },
    { to: '/frota/controle', icon: Navigation, label: 'Controle de Rotas', permission: 'frota_registros' },
    { to: '/admin', icon: Settings, label: 'Painel de Controle', permission: 'admin' },
  ].filter(link => hasAnyPermission(link.permission))

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Sticky Bottom Nav Bar for Mobile Devices */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/85 dark:bg-card/75 backdrop-blur-xl border-t border-border/40 px-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)] flex items-center justify-around h-16 safe-bottom">
        {visibleTabs.map(tab => {
          const ActiveIcon = tab.icon
          const active = isActive(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all relative active:scale-90",
                active 
                  ? "text-primary dark:text-primary font-black" 
                  : "text-muted-foreground hover:text-foreground font-semibold"
              )}
            >
              <ActiveIcon className={cn("w-5.5 h-5.5 transition-all duration-300", active ? "scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : "")} />
              <span className="text-[10px] uppercase tracking-wider mt-1">{tab.label}</span>
              {active && (
                <div className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-primary to-primary/60 shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
              )}
            </Link>
          )
        })}

        {/* "More/Menu" button to trigger the sheet */}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all relative active:scale-90",
            menuOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Menu className={cn("w-5.5 h-5.5 transition-all", menuOpen ? "scale-110 rotate-90" : "")} />
          <span className="text-[10px] uppercase tracking-wider mt-1">Mais</span>
        </button>
      </nav>

      {/* Native App-Like More Menu Bottom Sheet */}
      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu de Navegação"
        subtitle="Gerencie equipes, estoque, frota e permissões"
        className="max-h-[85vh]"
      >
        <div className="grid grid-cols-2 gap-3 py-1">
          {moreLinks.map(link => {
            const LinkIcon = link.icon
            const active = isActive(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "p-4 rounded-2xl border flex flex-col items-start justify-between gap-3 transition-all active:scale-95 text-left shadow-sm",
                  active
                    ? "bg-primary/[0.08] border-primary/30 text-primary dark:text-primary-foreground font-black"
                    : "bg-muted/30 border-border/50 hover:bg-muted/60 text-foreground font-semibold"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-inner",
                  active ? "bg-primary/20 text-primary" : "bg-muted/70 text-muted-foreground"
                )}>
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">{link.label}</h4>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Bottom Actions/Quick settings inside sheet */}
        <div className="mt-6 pt-4 border-t border-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/50">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Alternar Tema</span>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-foreground transition-all active:scale-90 shadow-sm"
              title={theme === 'dark' ? 'Modo claro' : theme === 'dim' ? 'Modo escuro' : 'Modo suave'}
            >
              {theme === 'dark'
                ? <Sun className="w-5 h-5 text-amber-500" />
                : theme === 'dim'
                ? <Moon className="w-5 h-5 text-indigo-400" />
                : <Cloud className="w-5 h-5 text-slate-400" />
              }
            </button>
          </div>

          <button
            onClick={() => {
              setMenuOpen(false)
              signOut()
            }}
            className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sair da Plataforma
          </button>
        </div>
      </Modal>
    </>
  )
}
