import React from 'react'
import { Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'

interface TopHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopHeader({ title, subtitle, actions }: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()

  return (
    <header className="top-header print:hidden">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Título */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-[hsl(var(--foreground))] truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{subtitle}</p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Alternar tema"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
