import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Settings,
  MapPin,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Painel', exact: true },
  { to: '/funcionarios', icon: Users, label: 'Equipe' },
  { to: '/escala/localidades', icon: MapPin, label: 'Locais' },
  { to: '/frequencia', icon: Clock, label: 'Chamada' },
  { to: '/escala', icon: CalendarDays, label: 'Escala' },
  { to: '/configuracoes', icon: Settings, label: 'Config' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav print:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-bottom">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200 min-w-0 flex-1',
                isActive
                  ? 'text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <div
                    className={cn(
                      'p-2 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-[hsl(var(--primary)/0.12)]'
                        : 'bg-transparent'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-transform duration-200',
                        isActive && 'scale-110'
                      )}
                      strokeWidth={isActive ? 2.5 : 1.75}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium truncate',
                    isActive ? 'opacity-100' : 'opacity-60'
                  )}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
