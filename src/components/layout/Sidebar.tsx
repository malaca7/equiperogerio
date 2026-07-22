import React, { useMemo, useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import * as LucideIcons from 'lucide-react'
import { ChevronLeft, ChevronRight, ChevronDown, LogOut } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useConfiguracao } from '../../hooks/useConfiguracoes'
import { useMenuConfig } from '../../hooks/useMenuConfig'
import { DEFAULT_PAINEIS_PAGINAS, DEFAULT_MENU_CONFIG, type SystemPage, type MenuModuleConfig, type MenuPageConfig } from '../../lib/auth.types'
import { Avatar } from '../ui/Avatar'

const PANEL_COLORS: Record<string, { accent: string; ring: string; expanded: string }> = {
  administrativo: { accent: 'bg-blue-600 dark:bg-blue-500', ring: 'ring-blue-500/30', expanded: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 dark:bg-blue-500/15' },
  producao:       { accent: 'bg-emerald-600 dark:bg-emerald-500', ring: 'ring-emerald-500/30', expanded: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15' },
  pessoal:        { accent: 'bg-violet-600 dark:bg-violet-500', ring: 'ring-violet-500/30', expanded: 'text-violet-600 dark:text-violet-400 border-violet-500/30 bg-violet-500/10 dark:bg-violet-500/15' },
  seguranca:      { accent: 'bg-rose-600 dark:bg-rose-500', ring: 'ring-rose-500/30', expanded: 'text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/15' },
  frota:          { accent: 'bg-amber-600 dark:bg-amber-500', ring: 'ring-amber-500/30', expanded: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15' },
  estoque:        { accent: 'bg-indigo-600 dark:bg-indigo-500', ring: 'ring-indigo-500/30', expanded: 'text-indigo-600 dark:text-indigo-400 border-indigo-600/30 bg-indigo-500/10 dark:bg-indigo-500/15' },
}

function getPanelColor(id: string) {
  const colors = Object.values(PANEL_COLORS)
  return PANEL_COLORS[id] ?? colors[id.length % colors.length]
}

function resolveIcon(name: string): React.ComponentType<any> {
  const icons: Record<string, React.ComponentType<any>> = LucideIcons as any
  return icons[name] || icons['LayoutDashboard']
}

export function Sidebar() {
  const { hasAnyPermission, activePanel, setActivePanel, user, signOut } = useAuth()
  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useTheme()
  const { data: dbMenuConfig } = useMenuConfig(DEFAULT_MENU_CONFIG)
  const menuConfig = dbMenuConfig || DEFAULT_MENU_CONFIG

  const PANELS_LIST = useMemo(() => {
    return menuConfig.modulos.map(m => {
      const colors = getPanelColor(m.id)
      return { id: m.id, label: m.label, icon: resolveIcon(m.icon), ...colors }
    })
  }, [menuConfig])

  const { data: plataformaNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: plataformaSlogan = 'GEstao Eficaz' } = useConfiguracao('plataforma_slogan', 'GEstao Eficaz')
  const { data: plataformaLogoUrl = '' } = useConfiguracao('plataforma_logo_url', '')
  const { data: userPhotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})

  const { data: dbCargoPaineis } = useConfiguracao<Record<string, { paineis_permitidos: string[]; painel_padrao: string }>>('cargo_paineis', {})

  const allowedPanelsForRole = useMemo(() => {
    if (user?.isDev) return null
    if (!user || !user.roles || user.roles.length === 0) return null
    const primaryRole = user.roles.reduce((prev, curr) => (curr.nivel > prev.nivel ? curr : prev), user.roles[0])
    const config = dbCargoPaineis?.[primaryRole.id]
    // Empty array or no config = unrestricted (all panels allowed)
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

  // Build deduplicated items per panel — each route only appears once across all modules
  const panelItemsMap = useMemo(() => {
    const map: Record<string, { to: string; icon: React.ComponentType<any>; label: string; page: SystemPage; exact?: boolean }[]> = {}

    // Process modules in order
    const sortedModules = [...menuConfig.modulos].sort((a, b) => a.ordem - b.ordem)

    // Gather all active routes across all modules to calculate prefixes dynamically
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
      
      // Developer bypass: ensure 'Painel de Controle' is always present in 'administrativo' module
      let modPages = [...mod.paginas]
      if (user?.isDev && mod.id === 'administrativo' && !modPages.some(p => p.id === 'admin')) {
        modPages.push({ id: 'admin', label: 'Painel de Controle', rota: '/admin', icone: 'Settings', ordem: 99 })
      }

      for (const pag of modPages) {
        if (pag.ativo === false) continue
        if (!hasAnyPermission(pag.id as SystemPage)) continue

        // Dynamically match exact/end routing if this route acts as a parent of any other claimed route in the sidebar
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

  // Filter visible panels based on user permissions and role restriction
  const visiblePanels = useMemo(() => {
    return PANELS_LIST.filter(panel => {
      // Check role panel access
      if (allowedPanelsForRole && !allowedPanelsForRole.includes(panel.id)) {
        return false
      }
      // Only show panels that have at least one deduplicated item
      const items = panelItemsMap[panel.id]
      return items && items.length > 0
    })
  }, [PANELS_LIST, allowedPanelsForRole, panelItemsMap])

  // Get visible items for a specific panel
  const getItemsForPanel = (panelId: string) => {
    return panelItemsMap[panelId] || []
  }

  useEffect(() => {
    if (visiblePanels.length > 0 && !visiblePanels.some(p => p.id === activePanel)) {
      setActivePanel(visiblePanels[0].id)
    }
  }, [visiblePanels, activePanel, setActivePanel])

  const togglePanelExpansion = (panelId: string) => {
    setExpandedPanels(prev => {
      if (isDesktop) {
        // Desktop accordion: only one module open at a time
        return prev.includes(panelId) ? [] : [panelId]
      } else {
        // Mobile multi-accordion: keep previous behavior
        return prev.includes(panelId)
          ? prev.filter(id => id !== panelId)
          : [...prev, panelId]
      }
    })
    setActivePanel(panelId)
  }

  const userInitial = user?.profile?.nome?.charAt(0) ?? '?'
  const userRole = user?.roles?.[0]?.nome ?? ''

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[51] md:hidden transition-all duration-300"
        />
      )}

      {/* Sidebar Panel Container */}
      <aside 
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[52] flex flex-col print:hidden transition-all duration-300 ease-out",
          "bg-card/95 dark:bg-card/85 backdrop-blur-2xl border-r border-border/50",
          (isSidebarCollapsed && isDesktop) ? "w-20" : "w-64",
          isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "max-md:-translate-x-full"
        )}
      >
        {/* Collapse Toggle Button (Desktop only) */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "hidden md:flex absolute top-6 -right-3 z-[55] w-6 h-6 rounded-full bg-card border border-border shadow-md",
            "items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
          )}
          title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand Header */}
        <div className={cn(
          "p-5 border-b border-border/40 relative overflow-hidden shrink-0 transition-all",
          (isSidebarCollapsed && isDesktop) ? "text-center" : ""
        )}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          {(isSidebarCollapsed && isDesktop) ? (
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto shadow-inner border border-primary/20 backdrop-blur-md overflow-hidden">
              {plataformaLogoUrl ? (
                <img src={plataformaLogoUrl} alt={plataformaNome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-black text-primary tracking-tighter">
                  7L
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-primary/20 backdrop-blur-md overflow-hidden">
                {plataformaLogoUrl ? (
                  <img src={plataformaLogoUrl} alt={plataformaNome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-black text-primary tracking-tighter">
                    7L
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-foreground tracking-tighter truncate leading-tight">
                  {plataformaNome}
                </h2>
                <p className="text-[7.5px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 mt-0.5 truncate">
                  {plataformaSlogan}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modules & Navigation Accordion Container */}
        <nav 
          className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {visiblePanels.length === 0 ? (
            <div className="py-8 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground/35">
              Nenhum módulo ativo
            </div>
          ) : (
            visiblePanels.map((panel) => {
              const isExpanded = expandedPanels.includes(panel.id)
              const isActive = activePanel === panel.id
              const items = getItemsForPanel(panel.id)

              if (isSidebarCollapsed && isDesktop) {
                return (
                  <div key={panel.id} className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => togglePanelExpansion(panel.id)}
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-95 border",
                        isExpanded
                          ? `${panel.accent} text-white shadow-md shadow-primary/10 border-transparent ring-2 ${panel.ring}`
                          : 'bg-muted/20 border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                      title={panel.label}
                    >
                      <panel.icon className="w-5 h-5" />
                    </button>

                    {/* Collapsed Nested sub-items under active module */}
                    {isExpanded && items.length > 0 && (
                      <div className="w-full mt-1 mb-2 flex flex-col items-center gap-1.5 py-2 bg-muted/15 rounded-2xl border border-border/20">
                        {items.map(({ to, icon: Icon, label, exact }) => (
                          <NavLink
                            key={to}
                            to={to}
                            end={exact}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive: isSubActive }) => cn(
                              'w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 border-l-4',
                              isSubActive
                                ? 'bg-primary/20 text-primary border-primary font-black shadow-sm'
                               : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                            )}
                            title={label}
                          >
                            <Icon className="w-4.5 h-4.5" />
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // Open State Layout
              return (
                <div key={panel.id} className="space-y-1.5">
                  {/* Module Toggle Banner */}
                  <button
                    onClick={() => togglePanelExpansion(panel.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-wider text-left border",
                      isExpanded
                        ? `${panel.accent} text-white border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.1)] ring-2 ${panel.ring}`
                        : "bg-muted/25 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <panel.icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{panel.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-white scale-125 animate-pulse" />
                      ) : null}
                      {isExpanded ? (
                        <ChevronDown className={cn("w-3.5 h-3.5", isExpanded ? "text-white" : "text-current")} />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Nested Navigation List directly under active module */}
                  {isExpanded && items.length > 0 && (
                    <div className="pl-4 pr-1 mt-1 mb-3 space-y-1 border-l-2 border-primary/20">
                      {items.map(({ to, icon: Icon, label, exact }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={exact}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={({ isActive: isSubActive }) => cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group border-l-4',
                            isSubActive
                              ? 'bg-primary/10 text-primary border-primary font-black shadow-sm'
                              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-[9.5px] font-black uppercase tracking-widest truncate">{label}</span>
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
          <div className="p-4 border-t border-border/40 bg-muted/20 backdrop-blur-md shrink-0">
            {(isSidebarCollapsed && isDesktop) ? (
              <div className="flex flex-col items-center gap-3">
                <Link to="/perfil" className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-all" title={`${user?.profile?.nome} - ${userRole}`}>
                  <Avatar name={user?.profile?.nome || 'Usuário'} src={userPhotos[user.profile.id]} size="md" className="w-full h-full rounded-full shadow-md" />
                </Link>
                <button
                  onClick={signOut}
                  className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90 flex items-center justify-center border border-rose-500/20"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Link to="/perfil" className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-all">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Avatar name={user?.profile?.nome || 'Usuário'} src={userPhotos[user.profile.id]} size="md" className="w-full h-full rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground leading-none truncate max-w-[110px] uppercase">
                      {user?.profile?.nome?.split(' ')[0]}
                    </p>
                    {userRole && (
                      <p className="text-[8px] font-bold text-primary/85 uppercase tracking-wider leading-none mt-1 truncate max-w-[110px]">
                        {userRole}
                      </p>
                    )}
                  </div>
                </Link>
                <button
                  onClick={signOut}
                  className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90 flex items-center justify-center border border-rose-500/20"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
