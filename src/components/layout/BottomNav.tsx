import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Clock, CalendarDays, Settings, MapPin, Activity, ShieldCheck,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import type { SystemPage } from '../../lib/auth.types'

const navItems: { to: string; icon: any; label: string; page: SystemPage; exact?: boolean }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Painel', page: 'dashboard', exact: true },
  { to: '/funcionarios', icon: Users, label: 'Equipe', page: 'funcionarios' },
  { to: '/escala/localidades', icon: MapPin, label: 'Locais', page: 'localidades' },
  { to: '/frequencia', icon: Clock, label: 'Chamada', page: 'frequencia' },
  { to: '/atestados', icon: Activity, label: 'Médico', page: 'atestados' },
  { to: '/escala', icon: CalendarDays, label: 'Escala', page: 'escala' },
  { to: '/configuracoes', icon: Settings, label: 'Config', page: 'configuracoes' },
  { to: '/admin', icon: ShieldCheck, label: 'Admin', page: 'admin' },
]

export function BottomNav() {
  const { hasAnyPermission } = useAuth()

  // Filter items by permission
  const visibleItems = navItems.filter(item => hasAnyPermission(item.page))

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[500px] z-50 print:hidden">
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-2xl border border-border rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-3 py-2">
        <div className="flex items-center justify-between gap-1">
          {visibleItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 min-w-0 flex-1 group',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'p-2 rounded-xl transition-all duration-300 relative z-10',
                    isActive ? 'bg-primary/10 scale-110 shadow-[0_0_15px_rgba(var(--primary),0.1)]' : 'bg-transparent'
                  )}>
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-all duration-300',
                        isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-black uppercase tracking-widest transition-all duration-300 leading-none',
                      isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    )}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),1)] animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
