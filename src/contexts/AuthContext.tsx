import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { AuthUser, Profile, PermissionSet } from '../lib/auth.types'
import { makePermissionKey } from '../lib/auth.types'

const SESSION_KEY = '7boss_session'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 min inatividade
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  loading: boolean
  signIn: (cpf: string, senha: string) => Promise<{ error: string | null }>
  signOut: () => void
  reloadSession: () => Promise<void>
  hasPermission: (pagina: string, acao: string) => boolean
  hasAnyPermission: (pagina: string) => boolean
  isAdmin: boolean
  isDev: boolean
  activePanel: string
  setActivePanel: (panel: string) => void
  selectedTeamId: string | null
  setSelectedTeamId: (teamId: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getBrowserInfo() {
  const ua = navigator.userAgent
  let navegador = 'Desconhecido'
  let dispositivo = 'Desktop'
  if (ua.includes('Firefox/')) navegador = 'Firefox'
  else if (ua.includes('Edg/')) navegador = 'Edge'
  else if (ua.includes('Chrome/')) navegador = 'Chrome'
  else if (ua.includes('Safari/')) navegador = 'Safari'
  if (ua.includes('Mobile') || ua.includes('Android')) dispositivo = 'Mobile'
  else if (ua.includes('iPad')) dispositivo = 'Tablet'
  return { navegador, dispositivo }
}

async function loadUserData(profileId: string): Promise<AuthUser | null> {
  const CACHE_KEY = `7boss_user_cache_${profileId}`
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.timestamp < 300000) { // 5 min TTL
        return {
          ...parsed.user,
          permissions: new Set(parsed.user.permissions)
        }
      }
    }
  } catch {
    // Ignore cache parse error
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    if (error || !profile) return null

    // Get roles (still used for display, panel config, isAdmin/isDev checks)
    const { data: urData } = await supabase
      .from('user_roles')
      .select('role_id, roles(id, nome, nivel)')
      .eq('user_id', profileId)

    const roles = (urData || [])
      .map((ur: any) => ur.roles)
      .filter(Boolean)
      .map((r: any) => ({ id: r.id, nome: r.nome, nivel: r.nivel }))

    // Get permissions DIRECTLY from user_direct_permissions (per-user isolated)
    let permissions: PermissionSet = new Set()
    
    // 1. Load isolated permissions
    const { data: udpData } = await supabase
      .from('user_direct_permissions')
      .select('permissions(pagina, acao)')
      .eq('user_id', profileId)
    if (udpData) {
      for (const udp of udpData) {
        const p = (udp as any).permissions
        if (p) permissions.add(makePermissionKey(p.pagina, p.acao))
      }
    }

    // 2. Load role-based permissions (from the Matriz)
    const roleIds = roles.map((r: any) => r.id)
    if (roleIds.length > 0) {
      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('permissions(pagina, acao)')
        .in('role_id', roleIds)
      if (rpData) {
        for (const rp of rpData) {
          const p = (rp as any).permissions
          if (p) permissions.add(makePermissionKey(p.pagina, p.acao))
        }
      }
    }

    const userData: AuthUser = {
      profile: profile as Profile,
      roles,
      permissions,
      isAdmin: roles.some((r: any) => r.nivel >= 80 || r.nome.toLowerCase().includes('admin') || r.nome.toLowerCase().includes('desenvolvedor')),
      isDev: roles.some((r: any) => r.nivel >= 100 || r.nome.toLowerCase().includes('desenvolvedor') || r.nome.toLowerCase().includes('dev')),
    }

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        user: {
          ...userData,
          permissions: Array.from(userData.permissions)
        }
      }))
    } catch {
      // Ignore quota errors
    }

    return userData
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activePanel, setActivePanelState] = useState<string>(() => {
    return localStorage.getItem('7boss_active_panel') || 'producao'
  })
  const [selectedTeamId, setSelectedTeamIdState] = useState<string | null>(() => {
    return localStorage.getItem('7boss_selected_team_id')
  })

  const setActivePanel = useCallback((panel: string) => {
    setActivePanelState(panel)
    localStorage.setItem('7boss_active_panel', panel)
  }, [])

  const setSelectedTeamId = useCallback((teamId: string | null) => {
    setSelectedTeamIdState(teamId)
    if (teamId) {
      localStorage.setItem('7boss_selected_team_id', teamId)
    } else {
      localStorage.removeItem('7boss_selected_team_id')
    }
  }, [])

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      loadUserData(stored).then(u => {
        setUser(u)
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  // Auto-redirect to cargo preferred default panel & Clear team filters
  useEffect(() => {
    if (user && user.roles && user.roles.length > 0) {
      const alreadySet = localStorage.getItem('7boss_panel_initialized')
      
      if (!alreadySet) {
        // 1. Clear team filter on startup for unrestricted users (above encarregado, level > 50)
        const isUnrestricted = user.roles.some(r => r.nivel > 50)
        if (isUnrestricted) {
          setSelectedTeamIdState(null)
          localStorage.removeItem('7boss_selected_team_id')
        }
        
        localStorage.setItem('7boss_panel_initialized', 'true')

        // 2. Set default panel
        const primaryRole = user.roles.reduce((prev, curr) => (curr.nivel > prev.nivel ? curr : prev), user.roles[0])
        supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'cargo_paineis')
          .maybeSingle()
          .then(({ data }) => {
            const configs = data?.valor || {}
            const cargoConfig = configs[primaryRole.id]
            if (cargoConfig?.painel_padrao) {
              setActivePanelState(cargoConfig.painel_padrao)
              localStorage.setItem('7boss_active_panel', cargoConfig.painel_padrao)
            }
          })
      }
    }
  }, [user])

  // Auto-sync menu_config and permissions in database for 'gerar_relatorio'
  useEffect(() => {
    if (user?.isDev || user?.isAdmin) {
      const runSync = async () => {
        try {
          // 1. Fetch current menu_config
          const { data: configData } = await supabase
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'menu_config')
            .maybeSingle()
          
          if (configData?.valor) {
            const menuConfig = configData.valor as any
            let changed = false
            
            // Helper to sync page inside a module
            const syncPage = (modId: string, pageObj: any) => {
              if (!menuConfig.modulos) menuConfig.modulos = []
              const mod = menuConfig.modulos.find((m: any) => m.id === modId)
              if (mod) {
                if (!mod.paginas) mod.paginas = []
                const hasRoute = mod.paginas.some((p: any) => p.rota === pageObj.rota)
                if (!hasRoute) {
                  console.log(`Auto-sync: Adding page ${pageObj.id} to module ${modId}`)
                  mod.paginas.push(pageObj)
                  mod.paginas.sort((a: any, b: any) => a.ordem - b.ordem)
                  changed = true
                } else {
                  const page = mod.paginas.find((p: any) => p.rota === pageObj.rota)
                  if (page && page.id !== pageObj.id) {
                    console.log(`Auto-sync: Updating page ID to ${pageObj.id} at route ${pageObj.rota}`)
                    page.id = pageObj.id
                    changed = true
                  }
                }
              }
            }

            syncPage('administrativo', { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 3, ativo: true })
            syncPage('producao', { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 3, ativo: true })
            syncPage('pessoal', { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 4, ativo: true })
            syncPage('producao', { id: 'localidades', label: 'Demandas', rota: '/escala/demandas', icone: 'FileText', ordem: 6.5, ativo: true })

            // Clean up from inactive pages list if present
            if (menuConfig.inativos?.paginas) {
              const originalLength = menuConfig.inativos.paginas.length
              menuConfig.inativos.paginas = menuConfig.inativos.paginas.filter(
                (p: any) => p.page?.rota !== '/equipes/gerar-relatorio' && p.page?.id !== 'gerar_relatorio'
              )
              if (menuConfig.inativos.paginas.length !== originalLength) {
                changed = true
              }
            }

            if (changed) {
              await supabase.from('configuracoes').upsert({
                chave: 'menu_config',
                valor: menuConfig,
                updated_at: new Date().toISOString()
              }, { onConflict: 'chave' })
              console.log('Auto-sync: Successfully updated menu_config in DB.')
            }
          }

          // 2. Sync permissions in database
          const { data: perms } = await supabase.from('permissions').select('*')
          if (perms) {
            const requiredPerms = [
              { pagina: 'gerar_relatorio', acao: 'visualizar', descricao: 'Visualizar relatório completo da equipe' },
              { pagina: 'gerar_relatorio', acao: 'gerenciar', descricao: 'Gerenciar e exportar relatório completo da equipe' }
            ]
            const missing = []
            for (const req of requiredPerms) {
              if (!perms.some(p => p.pagina === req.pagina && p.acao === req.acao)) {
                missing.push(req)
              }
            }
            if (missing.length > 0) {
              await supabase.from('permissions').insert(missing)
              console.log('Auto-sync: Successfully inserted missing permissions.')
            }

            // 3. Propagate role permissions from 'equipes' to 'gerar_relatorio'
            const { data: updatedPerms } = await supabase.from('permissions').select('*')
            const { data: rolePerms } = await supabase.from('role_permissions').select('*')
            
            if (updatedPerms && rolePerms) {
              const permEquipesView = updatedPerms.find(p => p.pagina === 'equipes' && p.acao === 'visualizar')
              const permEquipesManage = updatedPerms.find(p => p.pagina === 'equipes' && p.acao === 'gerenciar')
              const permRelatorioView = updatedPerms.find(p => p.pagina === 'gerar_relatorio' && p.acao === 'visualizar')
              const permRelatorioManage = updatedPerms.find(p => p.pagina === 'gerar_relatorio' && p.acao === 'gerenciar')

              if (permEquipesView && permRelatorioView) {
                const inserts = []
                for (const rp of rolePerms) {
                  if (rp.permission_id === permEquipesView.id) {
                    const hasRelatorioView = rolePerms.some(x => x.role_id === rp.role_id && x.permission_id === permRelatorioView.id)
                    if (!hasRelatorioView) {
                      inserts.push({ role_id: rp.role_id, permission_id: permRelatorioView.id })
                    }
                  }
                  if (permEquipesManage && permRelatorioManage && rp.permission_id === permEquipesManage.id) {
                    const hasRelatorioManage = rolePerms.some(x => x.role_id === rp.role_id && x.permission_id === permRelatorioManage.id)
                    if (!hasRelatorioManage) {
                      inserts.push({ role_id: rp.role_id, permission_id: permRelatorioManage.id })
                    }
                  }
                }
                if (inserts.length > 0) {
                  await supabase.from('role_permissions').insert(inserts)
                  console.log(`Auto-sync: Propagated ${inserts.length} role permissions to gerar_relatorio.`)
                }
              }
            }
          }
        } catch (e) {
          console.error('Error during auto-sync of menu and permissions:', e)
        }
      }
      runSync()
    }
  }, [user])

  // Inactivity timeout
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
    }, SESSION_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user) return
    const handler = () => resetTimer()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetTimer()
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [user, resetTimer])

  const signIn = async (cpf: string, senha: string): Promise<{ error: string | null }> => {
    const cleanCpf = cpf.replace(/\D/g, '')
    const cleanSenha = senha.trim()
    const info = getBrowserInfo()

    // Check in DB
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('cpf', cleanCpf)
      .eq('senha', cleanSenha)
      .limit(1)

    const profile = profiles && profiles.length > 0 ? profiles[0] : null

    if (error || !profile) {
      console.error('Login error:', error, 'Profiles array:', profiles, 'cleanCpf:', cleanCpf)
      await supabase.from('login_logs').insert({
        cpf: cleanCpf,
        sucesso: false,
        navegador: info.navegador,
        dispositivo: info.dispositivo,
        motivo_falha: 'CPF ou senha incorretos - Erro DB: ' + (error?.message || 'Nenhum perfil'),
      })
      return { error: 'CPF ou senha incorretos' }
    }

    if (!profile.ativo) {
      await supabase.from('login_logs').insert({
        cpf: cleanCpf, sucesso: false, navegador: info.navegador,
        dispositivo: info.dispositivo, motivo_falha: 'Conta desativada',
      })
      return { error: 'Conta desativada. Contate o administrador.' }
    }

    // Success
    await supabase.from('login_logs').insert({
      cpf: cleanCpf, sucesso: true, navegador: info.navegador, dispositivo: info.dispositivo,
    })
    await supabase.from('profiles').update({ ultimo_login: new Date().toISOString() }).eq('id', profile.id)

    localStorage.setItem(SESSION_KEY, profile.id)
    const userData = await loadUserData(profile.id)
    setUser(userData)
    return { error: null }
  }

  const signOut = () => {
    if (user) {
      supabase.from('audit_logs').insert({
        user_id: user.profile.id, acao: 'logout', modulo: 'auth',
        descricao: `${user.profile.nome} realizou logout`,
      })
    }
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('7boss_panel_initialized')
    setUser(null)
  }

  const reloadSession = useCallback(async () => {
    if (user) {
      const userData = await loadUserData(user.profile.id)
      setUser(userData)
    }
  }, [user])

  const hasPermission = useCallback((pagina: string, acao: string) => {
    if (!user) return false
    if (user.isDev) return true
    
    // Virtual permissions for ENCARREGADO (supervisors) to manage their team settings
    const isEncarregado = user.roles.some(r => r.nome === 'ENCARREGADO' || r.nivel <= 50)
    if (isEncarregado) {
      if (pagina === 'equipes' && acao === 'visualizar') return true
      if (pagina === 'gerar_relatorio' && acao === 'visualizar') return true
      if (pagina === 'modelos_escala' || pagina === 'organizacao_varricao') return true
    }
    
    // Compatibilidade: mapeia as permissões antigas 'editar' e 'administrar' para a nova 'gerenciar'
    const acaoEfetiva = (acao === 'editar' || acao === 'administrar') ? 'gerenciar' : acao
    
    return user.permissions.has(makePermissionKey(pagina, acaoEfetiva))
  }, [user])

  const hasAnyPermission = useCallback((pagina: string) => {
    if (!user) return false
    if (user.isDev) return true

    const isEncarregado = user.roles.some(r => r.nome === 'ENCARREGADO' || r.nivel <= 50)
    if (isEncarregado) {
      if (pagina === 'equipes' || pagina === 'modelos_escala' || pagina === 'gerar_relatorio' || pagina === 'organizacao_varricao') return true
    }

    return user.permissions.has(makePermissionKey(pagina, 'visualizar'))
      || user.permissions.has(makePermissionKey(pagina, 'gerenciar'))
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      signIn,
      signOut,
      reloadSession,
      hasPermission,
      hasAnyPermission,
      isAdmin: user?.isAdmin ?? false,
      isDev: user?.isDev ?? false,
      activePanel,
      setActivePanel,
      selectedTeamId,
      setSelectedTeamId,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
