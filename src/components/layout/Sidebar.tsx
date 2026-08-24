import React, { useMemo, useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import * as LucideIcons from 'lucide-react'
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, Search, X, Sparkles, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useConfiguracao } from '../../hooks/useConfiguracoes'
import { useMenuConfig } from '../../hooks/useMenuConfig'
import { DEFAULT_MENU_CONFIG, type SystemPage } from '../../lib/auth.types'
import { Avatar } from '../ui/Avatar'

function resolveIcon(name: string): React.ComponentType<any> {
  const icons: Record<string, React.ComponentType<any>> = LucideIcons as any
  return icons[name] || icons['LayoutDashboard']
}

// Distinct, vibrant color themes per module category
function getModuleTheme(panelId: string) {
  const pid = panelId.toLowerCase()
  if (pid.includes('dash') || pid.includes('prod') || pid.includes('operac') || pid.includes('varricao')) {
    return {
      headerActive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      iconBox: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      activeItem: 'bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-600/30 border-l-4 border-emerald-300 font-black',
      activeDot: 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.9)]',
      borderLine: 'border-emerald-500/35',
      textHighlight: 'text-emerald-500',
      collapsedBadge: 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
    }
  }
  if (pid.includes('escala') || pid.includes('planej') || pid.includes('modelo')) {
    return {
      headerActive: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      iconBox: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      activeItem: 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30 border-l-4 border-blue-300 font-black',
      activeDot: 'bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.9)]',
      borderLine: 'border-blue-500/35',
      textHighlight: 'text-blue-500',
      collapsedBadge: 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
    }
  }
  if (pid.includes('equipe') || pid.includes('func') || pid.includes('rh') || pid.includes('atestad') || pid.includes('frequenc')) {
    return {
      headerActive: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
      iconBox: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
      activeItem: 'bg-gradient-to-r from-violet-600 via-violet-600 to-purple-600 text-white shadow-xl shadow-violet-600/30 border-l-4 border-violet-300 font-black',
      activeDot: 'bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.9)]',
      borderLine: 'border-violet-500/35',
      textHighlight: 'text-violet-500',
      collapsedBadge: 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
    }
  }
  if (pid.includes('estoque') || pid.includes('epi') || pid.includes('supr') || pid.includes('cautela')) {
    return {
      headerActive: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      iconBox: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
      activeItem: 'bg-gradient-to-r from-cyan-600 via-cyan-600 to-teal-600 text-white shadow-xl shadow-cyan-600/30 border-l-4 border-cyan-300 font-black',
      activeDot: 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]',
      borderLine: 'border-cyan-500/35',
      textHighlight: 'text-cyan-500',
      collapsedBadge: 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
    }
  }
  if (pid.includes('frota') || pid.includes('veic') || pid.includes('transp') || pid.includes('km')) {
    return {
      headerActive: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
      iconBox: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
      activeItem: 'bg-gradient-to-r from-amber-600 via-orange-600 to-orange-600 text-white shadow-xl shadow-orange-600/30 border-l-4 border-amber-300 font-black',
      activeDot: 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.9)]',
      borderLine: 'border-orange-500/35',
      textHighlight: 'text-orange-500',
      collapsedBadge: 'bg-orange-600 text-white border-orange-400 shadow-md shadow-orange-600/30'
    }
  }
  // Administrative & Default Theme
  return {
    headerActive: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    iconBox: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
    activeItem: 'bg-gradient-to-r from-rose-600 via-rose-600 to-pink-600 text-white shadow-xl shadow-rose-600/30 border-l-4 border-rose-300 font-black',
    activeDot: 'bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.9)]',
    borderLine: 'border-rose-500/35',
    textHighlight: 'text-rose-500',
    collapsedBadge: 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
  }
}

export function Sidebar() {
  const { hasAnyPermission, activePanel, setActivePanel, user, signOut } = useAuth()
  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useTheme()
  const { data: dbMenuConfig } = useMenuConfig(DEFAULT_MENU_CONFIG)
  const menuConfig = dbMenuConfig || DEFAULT_MENU_CONFIG

  const [searchTerm, setSearchTerm] = useState('')

  const PANELS_LIST = useMemo(() => {
    return menuConfig.modulos.map(m => {
      return { id: m.id, label: m.label, icon: resolveIcon(m.icon) }
    })
  }, [menuConfig])

  const { data: plataformaNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: plataformaSlogan = 'Gestão Eficaz' } = useConfiguracao('plataforma_slogan', 'Gestão Eficaz')
  const { data: plataformaLogoUrl = '' } = useConfiguracao('plataforma_logo_url', '')
  const { data: userPhotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})

  const { data: dbCargoPaineis } = useConfiguracao<Record<string, { paineis_permitidos: string[]; painel_padrao: string }>>('cargo_paineis', {})

  const allowedPanelsForRole = useMemo(() => {
    if (user?.isDev) return null
    if (!user || !user.roles || user.roles.length === 0) return null
    const primaryRole = user.roles.reduce((prev, curr) => (curr.nivel > prev.nivel ? curr : prev), user.roles[0])
    const config = dbCargoPaineis?.[primaryRole.id]
    if (!config || !config.paineis_permitidos || config.paineis_permitidos.length === 0) return null
    return config.paineis_permitidos
  }, [user, dbCargoPaineis])

  // State to detect if it's desktop version
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // State to support panel expansions
  const [expandedPanels, setExpandedPanels] = useState<string[]>(() => {
    return [activePanel]
  })

  // Sync expanded panels locally if activePanel changes globally
  useEffect(() => {
    if (activePanel) {
      if (isDesktop) {
        setExpandedPanels([activePanel])
      } else {
        setExpandedPanels(prev => prev.includes(activePanel) ? prev : [...prev, activePanel])
      }
    }
  }, [activePanel, isDesktop])

  // Build deduplicated items per panel
  const panelItemsMap = useMemo(() => {
    const map: Record<string, { to: string; icon: React.ComponentType<any>; label: string; page: SystemPage; exact?: boolean }[]> = {}

    const sortedModules = [...menuConfig.modulos].sort((a, b) => a.ordem - b.ordem)

    const allActiveRoutes = new Set<string>()
    for (const mod of sortedModules) {
      if (mod.ativo === false) continue
      if (allowedPanelsForRole && !allowedPanelsForRole.includes(mod.id)) continue
      
      const modPages = [...mod.paginas]
      if (user?.isDev && mod.id === 'administrativo' && !modPages.some(p => p.id === 'admin')) {
        modPages.push({ id: 'admin', label: 'Painel de Controle', rota: '/admin', icone: 'Settings', ordem: 99 })
      }
      
      for (const pag of modPages) {
        if (pag.ativo === false) continue
        if (!hasAnyPermission(pag.id as SystemPage)) continue
        allActiveRoutes.add(pag.rota)
      }
    }

    for (const mod of sortedModules) {
      if (mod.ativo === false) {
        map[mod.id] = []
        continue
      }

      if (allowedPanelsForRole && !allowedPanelsForRole.includes(mod.id)) {
        map[mod.id] = []
        continue
      }

      const items: { to: string; icon: React.ComponentType<any>; label: string; page: SystemPage; exact?: boolean }[] = []
      
      let modPages = [...mod.paginas]
      if (user?.isDev && mod.id === 'administrativo' && !modPages.some(p => p.id === 'admin')) {
        modPages.push({ id: 'admin', label: 'Painel de Controle', rota: '/admin', icone: 'Settings', ordem: 99 })
      }

      for (const pag of modPages) {
        if (pag.ativo === false) continue
        if (!hasAnyPermission(pag.id as SystemPage)) continue

        const isParentRoute = pag.rota === '/' || Array.from(allActiveRoutes).some(
          r => r !== pag.rota && r.startsWith(pag.rota + '/')
        )

        items.push({
          to: pag.rota,
          icon: resolveIcon(pag.icone),
          label: pag.label,
          page: pag.id as SystemPage,
          exact: isParentRoute
        })
      }
      map[mod.id] = items
    }

    return map
  }, [menuConfig.modulos, allowedPanelsForRole, hasAnyPermission, user])

  // Filter visible panels based on permissions & search
  const visiblePanels = useMemo(() => {
    return PANELS_LIST.filter(panel => {
      if (allowedPanelsForRole && !allowedPanelsForRole.includes(panel.id)) {
        return false
      }
      const items = panelItemsMap[panel.id] || []
      if (items.length === 0) return false

      if (!searchTerm.trim()) return true

      const term = searchTerm.toLowerCase().trim()
      const matchesPanel = panel.label.toLowerCase().includes(term)
      const matchesItems = items.some(item => item.label.toLowerCase().includes(term))
      return matchesPanel || matchesItems
    })
  }, [PANELS_LIST, allowedPanelsForRole, panelItemsMap, searchTerm])

  const getItemsForPanel = (panelId: string) => {
    const items = panelItemsMap[panelId] || []
    if (!searchTerm.trim()) return items
    const term = searchTerm.toLowerCase().trim()
    return items.filter(item => item.label.toLowerCase().includes(term) || panelId.toLowerCase().includes(term))
  }

  useEffect(() => {
    if (visiblePanels.length > 0 && !visiblePanels.some(p => p.id === activePanel)) {
      setActivePanel(visiblePanels[0].id)
    }
  }, [visiblePanels, activePanel, setActivePanel])

  const togglePanelExpansion = (panelId: string) => {
    setExpandedPanels(prev => {
      if (isDesktop) {
        return prev.includes(panelId) ? [] : [panelId]
      } else {
        return prev.includes(panelId)
          ? prev.filter(id => id !== panelId)
          : [...prev, panelId]
      }
    })
    setActivePanel(panelId)
  }

  const userRole = user?.roles?.[0]?.nome ?? ''

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[51] md:hidden transition-all duration-300 animate-fade-in"
        />
      )}

      {/* Sidebar Panel Container */}
      <aside 
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[52] flex flex-col print:hidden transition-all duration-300 ease-out",
          "bg-card/95 backdrop-blur-2xl border-r border-border/60 shadow-2xl",
          (isSidebarCollapsed && isDesktop) ? "w-20" : "w-72 max-w-[88vw]",
          isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "max-md:-translate-x-full"
        )}
      >
        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "hidden md:flex absolute top-6 -right-3.5 z-[55] w-7 h-7 rounded-full bg-card border border-border/80 shadow-md",
            "items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 active:scale-90 transition-all cursor-pointer"
          )}
          title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Brand Header */}
        <div className={cn(
          "p-4 border-b border-border/50 shrink-0 flex items-center justify-between transition-all",
          (isSidebarCollapsed && isDesktop) ? "px-2 justify-center" : "px-4"
        )}>
          {(isSidebarCollapsed && isDesktop) ? (
            <div className="w-11 h-11 bg-gradient-to-tr from-primary to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-primary/25 overflow-hidden">
              {plataformaLogoUrl ? (
                <img src={plataformaLogoUrl} alt={plataformaNome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base font-black text-white tracking-tighter">7L</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-tr from-primary to-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-primary/25 overflow-hidden">
                {plataformaLogoUrl ? (
                  <img src={plataformaLogoUrl} alt={plataformaNome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base font-black text-white tracking-tighter">7L</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-foreground tracking-tight truncate leading-tight">
                  {plataformaNome}
                </h2>
                <p className="text-[11px] font-black uppercase tracking-widest text-primary mt-0.5 truncate">
                  {plataformaSlogan}
                </p>
              </div>
            </div>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden w-10 h-10 rounded-2xl bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-90 transition-all cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Search Bar (When Expanded) */}
        {(!isSidebarCollapsed || !isDesktop) && (
          <div className="p-3.5 pb-1 border-b border-border/30">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Pesquisar no menu..."
                className="w-full pl-11 pr-9 py-3 text-sm font-bold bg-muted/40 hover:bg-muted/70 focus:bg-muted/90 border border-border/50 focus:border-primary rounded-2xl text-foreground placeholder:text-muted-foreground/70 outline-none transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modules & Navigation Accordion */}
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
          {visiblePanels.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
              Nenhum menu encontrado
            </div>
          ) : (
            visiblePanels.map((panel) => {
              const isExpanded = expandedPanels.includes(panel.id) || !!searchTerm.trim()
              const items = getItemsForPanel(panel.id)
              const themeColors = getModuleTheme(panel.id)

              if (isSidebarCollapsed && isDesktop) {
                return (
                  <div key={panel.id} className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => togglePanelExpansion(panel.id)}
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-95 border cursor-pointer",
                        isExpanded
                          ? themeColors.collapsedBadge
                          : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                      )}
                      title={panel.label}
                    >
                      <panel.icon className="w-6 h-6" />
                    </button>

                    {/* Collapsed Sub-items */}
                    {isExpanded && items.length > 0 && (
                      <div className="w-full my-1 flex flex-col items-center gap-2 py-2 bg-muted/40 rounded-2xl border border-border/50">
                        {items.map(({ to, icon: Icon, label, exact }) => (
                          <NavLink
                            key={to}
                            to={to}
                            end={exact}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive: isSubActive }) => cn(
                              'w-11 h-11 flex items-center justify-center rounded-xl transition-all',
                              isSubActive
                                ? themeColors.activeItem
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                            )}
                            title={label}
                          >
                            <Icon className="w-5.5 h-5.5" />
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // Open State Layout
              return (
                <div key={panel.id} className="space-y-2">
                  {/* Module Category Header Button */}
                  <button
                    onClick={() => togglePanelExpansion(panel.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-xs sm:text-sm font-black uppercase tracking-wider text-left border cursor-pointer",
                      isExpanded
                        ? themeColors.headerActive
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-xs",
                        themeColors.iconBox
                      )}>
                        <panel.icon className="w-5 h-5" />
                      </div>
                      <span className="truncate">{panel.label}</span>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform duration-200 shrink-0", isExpanded ? "rotate-180" : "text-muted-foreground/60")} />
                  </button>

                  {/* Expanded Sub-menu Items with Active Page Highlight */}
                  {isExpanded && items.length > 0 && (
                    <div className={cn("ml-4 pl-3.5 my-1.5 space-y-1.5 border-l-2", themeColors.borderLine)}>
                      {items.map(({ to, icon: Icon, label, exact }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={exact}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={({ isActive: isSubActive }) => cn(
                            'flex items-center justify-between px-4 py-3.5 sm:py-4 rounded-2xl transition-all text-base sm:text-[17px] font-bold active:scale-[0.98] cursor-pointer',
                            isSubActive
                              ? themeColors.activeItem
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-semibold'
                          )}
                        >
                          {({ isActive: isSubActive }) => (
                            <>
                              <div className="flex items-center gap-3.5 min-w-0">
                                <Icon className={cn("w-6 h-6 shrink-0 transition-transform", isSubActive ? "scale-110" : "")} />
                                <span className="truncate leading-none">{label}</span>
                              </div>
                              {isSubActive && (
                                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 animate-pulse", themeColors.activeDot)} />
                              )}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* Footer User Block */}
        {user && (
          <div className="p-4 border-t border-border/50 bg-card/80 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Link to="/perfil" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 min-w-0 group flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-all">
                  <Avatar name={user?.profile?.nome || 'Usuário'} src={userPhotos[user.profile.id]} size="md" className="w-full h-full rounded-full" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                    {(user?.profile as any)?.apelido || user?.profile?.nome}
                  </p>
                  <p className="text-[11px] font-bold text-muted-foreground truncate uppercase tracking-wider">
                    {userRole || 'Colaborador'}
                  </p>
                </div>
              </Link>
              <button
                onClick={signOut}
                className="w-10 h-10 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer shadow-xs"
                title="Sair da Plataforma"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
