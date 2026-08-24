import React, { useEffect, useState, useRef } from 'react'
import { Moon, Sun, Cloud, LogOut, Menu, Settings, Sparkles, Gem, Ghost, Shield } from 'lucide-react'
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
  const { theme, setTheme, toggleTheme, brightness, setBrightness, isSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useTheme()
  const { signOut, user, selectedTeamId, setSelectedTeamId } = useAuth()
  const { data: teamInfo } = useUserTeam()
  const { data: userPhotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [settingsRef])

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
      "fixed top-0 left-0 right-0 z-40 print:hidden transition-all duration-300",
      isSidebarCollapsed ? "md:left-20" : "md:left-72"
    )}>
      <div className="h-16 flex items-center px-4 sm:px-6 gap-3.5 bg-card/90 backdrop-blur-xl border-b border-border/60 shadow-xs">

        {/* Left: Title & Mobile Hamburger */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 flex items-center justify-center active:scale-90 transition-all shrink-0 shadow-xs cursor-pointer"
            title="Abrir menu principal"
          >
            <Menu className="w-5.5 h-5.5" />
          </button>

          <div className="min-w-0">
            <h1 className={cn(
               'font-black text-foreground truncate tracking-tight',
              subtitle ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            )}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">

          {/* User pill */}
          {user && (
            <Link to="/perfil" className="flex items-center gap-2.5 h-9 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-all shrink-0 active:scale-95 shadow-xs">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-primary/30">
                <Avatar name={user?.profile?.nome || 'Usuário'} src={userPhotos[user.profile.id]} size="sm" className="w-full h-full rounded-full" />
              </div>
              <p className="text-xs font-bold text-foreground truncate max-w-[80px] sm:max-w-[120px]">{userName}</p>
            </Link>
          )}

          {actions}

          {/* Settings Popup Trigger */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-9 h-9 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90 cursor-pointer shadow-xs"
              title="Configurações de Aparência"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* Settings Dropdown */}
            {isSettingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-card/100 backdrop-blur-xl rounded-xl border border-border shadow-2xl p-3 flex flex-col gap-3 z-50 animate-in fade-in duration-150" style={{ backgroundColor: 'hsl(var(--card))' }}>
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Aparência</h4>
                  
                  {/* Theme toggle */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Tema</span>
                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'dark', label: 'Escuro', icon: Moon },
                        { id: 'bdm', label: 'Dark BdM', icon: Sparkles },
                        { id: 'midnight', label: 'OLED', icon: Moon },
                        { id: 'emerald', label: 'Grafite', icon: Moon },
                        { id: 'dracula', label: 'Dracula', icon: Ghost },
                        { id: 'light', label: 'Claro', icon: Sun },
                      ].map(t => {
                        const Icon = t.icon
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTheme(t.id as any)}
                            className={cn(
                              "h-7 px-1.5 rounded-md flex items-center justify-center gap-1 transition-all border text-[10px] font-medium",
                              theme === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{t.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Brightness Controls */}
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Brilho</span>
                      <span className="text-[10px] font-mono text-primary">{brightness}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-3 h-3 text-muted-foreground/50" />
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <Sun className="w-3.5 h-3.5 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
