import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/ui/Toast'
import { BottomNav } from './components/layout/BottomNav'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FuncionariosPage } from './pages/FuncionariosPage'
import { FrequenciaPage } from './pages/FrequenciaPage'
import { EscalaPage } from './pages/EscalaPage'
import { EscalaGradePage } from './pages/EscalaGradePage'
import { EscalaLocalidadePage } from './pages/EscalaLocalidadePage'
import { EscalaSemanalPrint } from './pages/EscalaSemanalPrint'
import { EscalaMensalPrint } from './pages/EscalaMensalPrint'
import { NotificacoesPage } from './pages/NotificacoesPage'
import { ConfiguracoesPage } from './pages/ConfiguracoesPage'
import { ObservacoesPage } from './pages/ObservacoesPage'
import { RendimentoPage } from './pages/RendimentoPage'
import { AtestadosPage } from './pages/AtestadosPage'
import { EquipesPage } from './pages/EquipesPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { RouteGuard } from './components/auth/RouteGuard'
import { Loading } from './components/ui/Loading'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 15,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
})

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <Loading size="lg" text="Carregando..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<RouteGuard page="dashboard"><DashboardPage /></RouteGuard>} />
          <Route path="/funcionarios" element={<RouteGuard page="funcionarios"><FuncionariosPage /></RouteGuard>} />
          <Route path="/frequencia" element={<RouteGuard page="frequencia"><FrequenciaPage /></RouteGuard>} />
          <Route path="/escala" element={<RouteGuard page="escala"><EscalaGradePage /></RouteGuard>} />
          <Route path="/escala/calendario" element={<RouteGuard page="escala"><EscalaPage /></RouteGuard>} />
          <Route path="/escala/localidades" element={<RouteGuard page="localidades"><EscalaLocalidadePage /></RouteGuard>} />
          <Route path="/escala/imprimir-semanal" element={<RouteGuard page="escala"><EscalaSemanalPrint /></RouteGuard>} />
          <Route path="/escala/imprimir-mensal" element={<RouteGuard page="escala"><EscalaMensalPrint /></RouteGuard>} />
          <Route path="/notificacoes" element={<RouteGuard page="notificacoes"><NotificacoesPage /></RouteGuard>} />
          <Route path="/observacoes" element={<RouteGuard page="observacoes"><ObservacoesPage /></RouteGuard>} />
          <Route path="/rendimento" element={<RouteGuard page="rendimento"><RendimentoPage /></RouteGuard>} />
          <Route path="/atestados" element={<RouteGuard page="atestados"><AtestadosPage /></RouteGuard>} />
          <Route path="/equipes" element={<RouteGuard page="funcionarios"><EquipesPage /></RouteGuard>} />
          <Route path="/configuracoes" element={<RouteGuard page="configuracoes"><ConfiguracoesPage /></RouteGuard>} />
          <Route path="/admin/*" element={<RouteGuard page="admin"><AdminDashboard /></RouteGuard>} />
        </Routes>
      </main>
      <BottomNav />
    </>
  )
}

function AuthRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/" replace />
  return <LoginPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Router>
              <AppRoutes />
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
