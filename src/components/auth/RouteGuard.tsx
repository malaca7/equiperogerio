import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROUTE_PAGE_MAP, type SystemPage } from '../../lib/auth.types'
import { supabase } from '../../lib/supabase'
import { ShieldX, Lock } from 'lucide-react'

// =====================================================
// RouteGuard — protects entire routes by page permission
// =====================================================
interface RouteGuardProps {
  children: React.ReactNode
  page?: SystemPage
  action?: 'visualizar' | 'editar' | 'administrar'
  fallback?: React.ReactNode
}

export function RouteGuard({ children, page, action = 'visualizar', fallback }: RouteGuardProps) {
  const { isAuthenticated, loading, hasPermission, user } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Determine the page from the route if not explicitly provided
  const targetPage = page || ROUTE_PAGE_MAP[location.pathname]

  if (targetPage && !hasPermission(targetPage, action)) {
    // Log the denied access
    if (user) {
      supabase.from('security_events').insert({
        tipo: 'permission_denied',
        severidade: 'medium',
        descricao: `Acesso negado a ${targetPage}:${action} para ${user.profile.email}`,
        user_id: user.profile.id,
        metadata: { pagina: targetPage, acao: action, rota: location.pathname },
      })
    }

    if (fallback) return <>{fallback}</>

    return <AccessDeniedPage />
  }

  return <>{children}</>
}

// =====================================================
// PermissionGate — conditionally renders children
// =====================================================
interface PermissionGateProps {
  children: React.ReactNode
  page: SystemPage
  action?: 'visualizar' | 'editar' | 'administrar'
  fallback?: React.ReactNode
}

export function PermissionGate({ children, page, action = 'visualizar', fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(page, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// =====================================================
// AdminGate — only admin roles
// =====================================================
export function AdminGate({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <>{fallback}</>
  return <>{children}</>
}

// =====================================================
// Access Denied Page
// =====================================================
function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center space-y-8 animate-fade-in">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-rose-500 rounded-[2rem] blur-2xl opacity-20 animate-pulse" />
          <div className="w-24 h-24 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center relative z-10">
            <ShieldX className="w-12 h-12 text-rose-500" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            Acesso Negado
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Você não possui permissão para acessar esta página. Contate o administrador do sistema para solicitar acesso.
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full w-fit mx-auto">
          <Lock className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">
            Recurso Protegido
          </span>
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-8 py-3 bg-card border border-border rounded-2xl text-sm font-bold text-foreground hover:bg-muted transition-all active:scale-95 shadow-sm"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
