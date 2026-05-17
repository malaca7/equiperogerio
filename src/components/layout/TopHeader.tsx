import React from 'react'
import { Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

interface TopHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopHeader({ title, subtitle, actions }: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 print:hidden">
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-2xl border-b border-border h-16 sm:h-20 flex items-center px-4 sm:px-8 transition-all">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
            <div>
              <h1 className="text-sm sm:text-base font-black text-foreground uppercase tracking-widest leading-none truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <div className="flex items-center gap-2 p-1.5 bg-card/30 dark:bg-card/20 backdrop-blur-2xl rounded-[1.75rem] border border-border/40 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-11 h-11 rounded-[1.25rem] bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 shadow-sm transition-all active:scale-90 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400 relative z-10 transition-transform group-hover:rotate-90 duration-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-500 relative z-10 transition-transform group-hover:-rotate-12 duration-500" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="w-11 h-11 rounded-[1.25rem] bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white shadow-sm transition-all active:scale-90 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              <LogOut className="w-5 h-5 relative z-10" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
