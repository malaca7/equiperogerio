import React, { useEffect } from 'react'
import { Moon, Sun, Cloud, LogOut, Menu } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useUserTeam } from '../../hooks/useUserTeam'
import { Link, useLocation } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { useConfiguracao } from '../../hooks/useConfiguracoes'
import { useHeader } from '../../contexts/HeaderContext'

interface TopHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopHeader({ title, subtitle, actions }: TopHeaderProps) {
  const { setHeaderState } = useHeader()
  const location = useLocation()

  useEffect(() => {
    setHeaderState({
      title,
      subtitle,
      actions,
      isVisible: true,
      pathname: location.pathname
    })
  }, [title, subtitle, actions, location.pathname, setHeaderState])

  return null
}

export function GlobalTopHeader() {
  const { headerState } = useHeader()
  const location = useLocation()
  const { theme, toggleTheme, isSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useTheme()
  const { signOut, user, selectedTeamId, setSelectedTeamId } = useAuth()
  const { data: teamInfo } = useUserTeam()
  const { data: userPhotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})

  const { data: allTeams = [] } = useQuery<any[]>({
    queryKey: ['all-teams-header'],
    queryFn: async () => {
      const { data } = await supabase.from('equipes').select('*').order('nome')
      return data || []
    },
    enabled: !!user
  })

  const userTeams = React.useMemo(() => {
    if (teamInfo?.isRestricted) return allTeams.filter(t => teamInfo.teamIds.includes(t.id))
    return allTeams
  }, [allTeams, teamInfo])

  useEffect(() => {
    if (teamInfo?.isRestricted && userTeams.length > 0 && (!selectedTeamId || !userTeams.some(t => t.id === selectedTeamId))) {
      setSelectedTeamId(userTeams[0].id)
    }
  }, [userTeams, selectedTeamId, setSelectedTeamId, teamInfo])

  // Only render if header is active and paths match
  if (!headerState.isVisible || headerState.pathname !== location.pathname) {
    return null
  }

  const { title, subtitle, actions } = headerState

  const userName = user?.profile?.nome?.split(' ')[0] ?? ''
  const userRole = user?.roles?.[0]?.nome ?? ''

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 print:hidden transition-all duration-300",
      isSidebarCollapsed ? "md:left-20" : "md:left-64"
    )}>
      <div className={cn(
        'h-16 flex items-center px-4 sm:px-6 gap-3',
        'bg-card/80 dark:bg-card/60 backdrop-blur-2xl',
        'border-b border-border/50',
        'shadow-[0_1px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_20px_rgba(0,0,0,0.3)]'
      )}>

        {/* Left: Title */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary active:scale-95 transition-all flex-shrink-0"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Accent bar */}
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/40 shadow-[0_0_10px_hsl(var(--primary)/0.6)] flex-shrink-0" />
          <div className="min-w-0">
            <h1 className={cn(
               'font-black text-foreground uppercase tracking-widest truncate leading-none',
              subtitle ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            )}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* User pill */}
          {user && (
            <Link to="/perfil" className="flex items-center gap-1.5 sm:gap-2 h-9 px-1.5 sm:px-2 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-all flex-shrink-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-primary/20 bg-background/50">
                <Avatar name={user?.profile?.nome || 'Usuário'} src={userPhotos[user.profile.id]} size="sm" className="w-full h-full rounded-lg" />
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-[10px] sm:text-[11px] font-black text-foreground leading-none truncate max-w-[55px] sm:max-w-[85px] uppercase">{userName}</p>
                {userRole && <p className="text-[7px] sm:text-[8px] font-bold text-primary/80 uppercase tracking-wider leading-none mt-0.5 truncate max-w-[55px] sm:max-w-[85px]">{userRole}</p>}
              </div>
            </Link>
          )}

          {actions}

          {/* Action buttons */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/30 border border-border/40">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-all active:scale-90"
              title={theme === 'dark' ? 'Modo claro' : theme === 'dim' ? 'Modo escuro' : 'Modo suave'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-amber-400" />
                : theme === 'dim'
                ? <Moon className="w-4 h-4 text-indigo-400" />
                : <Cloud className="w-4 h-4 text-slate-400" />
              }
            </button>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
