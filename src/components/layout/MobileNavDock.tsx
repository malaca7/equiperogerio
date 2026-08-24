import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Calendar, Users, CheckCircle2, User, Menu } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTheme } from '../../contexts/ThemeContext'

export function MobileNavDock() {
  const location = useLocation()
  const { setIsMobileMenuOpen, isMobileMenuOpen } = useTheme()

  const tabs = [
    { to: '/', label: 'Início', icon: LayoutDashboard, exact: true },
    { to: '/frequencia', label: 'Chamada', icon: CheckCircle2 },
    { to: '/escala', label: 'Escalas', icon: Calendar },
    { to: '/equipes', label: 'Equipes', icon: Users },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/90 backdrop-blur-xl border-t border-border/80 pb-[env(safe-area-inset-bottom,12px)] shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.exact 
            ? location.pathname === tab.to 
            : location.pathname.startsWith(tab.to)

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive: linkActive }) => {
                const active = tab.exact ? location.pathname === tab.to : linkActive
                return cn(
                  'relative flex flex-col items-center justify-center flex-1 h-full py-1 min-w-[56px] min-h-[48px] rounded-xl transition-all duration-200 active:scale-90',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }}
            >
              {({ isActive: linkActive }) => {
                const active = tab.exact ? location.pathname === tab.to : linkActive
                return (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Icon className={cn('w-5 h-5 transition-transform duration-200', active && 'scale-110')} />
                      {active && (
                        <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      )}
                    </div>
                    <span className={cn('text-[10px] font-semibold tracking-tight mt-0.5', active ? 'font-bold text-primary' : 'text-muted-foreground')}>
                      {tab.label}
                    </span>
                  </>
                )
              }}
            </NavLink>
          )
        })}

        {/* Menu / Profile Drawer Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full py-1 min-w-[56px] min-h-[48px] rounded-xl transition-all duration-200 active:scale-90',
            isMobileMenuOpen ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight mt-0.5">Menu</span>
        </button>
      </div>
    </nav>
  )
}
