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
  hasPermission: (pagina: string, acao: string) => boolean
  hasAnyPermission: (pagina: string) => boolean
  isAdmin: boolean
  isDev: boolean
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
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    if (error || !profile) return null

    // Get roles
    const { data: urData } = await supabase
      .from('user_roles')
      .select('role_id, roles(id, nome, nivel)')
      .eq('user_id', profileId)

    const roles = (urData || [])
      .map((ur: any) => ur.roles)
      .filter(Boolean)
      .map((r: any) => ({ id: r.id, nome: r.nome, nivel: r.nivel }))

    // Get permissions
    const roleIds = roles.map((r: any) => r.id)
    let permissions: PermissionSet = new Set()
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

    const roleNames = roles.map((r: any) => r.nome)
    return {
      profile: profile as Profile,
      roles,
      permissions,
      isAdmin: roleNames.includes('DESENVOLVEDOR') || roleNames.includes('GERENTE'),
      isDev: roleNames.includes('DESENVOLVEDOR'),
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const info = getBrowserInfo()

    // Check in DB
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('cpf', cleanCpf)
      .eq('senha', senha)
      .single()

    if (error || !profile) {
      await supabase.from('login_logs').insert({
        cpf: cleanCpf,
        sucesso: false,
        navegador: info.navegador,
        dispositivo: info.dispositivo,
        motivo_falha: 'CPF ou senha incorretos',
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
    setUser(null)
  }

  const hasPermission = useCallback((pagina: string, acao: string) => {
    if (!user) return false
    if (user.isDev) return true
    return user.permissions.has(makePermissionKey(pagina, acao))
  }, [user])

  const hasAnyPermission = useCallback((pagina: string) => {
    if (!user) return false
    if (user.isDev) return true
    return user.permissions.has(makePermissionKey(pagina, 'visualizar'))
      || user.permissions.has(makePermissionKey(pagina, 'editar'))
      || user.permissions.has(makePermissionKey(pagina, 'administrar'))
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      signIn,
      signOut,
      hasPermission,
      hasAnyPermission,
      isAdmin: user?.isAdmin ?? false,
      isDev: user?.isDev ?? false,
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
