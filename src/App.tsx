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
import { EscalaSemanalPrint } from './pages/EscalaSemanalPrint'
import { EscalaMensalPrint } from './pages/EscalaMensalPrint'
import { NotificacoesPage } from './pages/NotificacoesPage'
import { Loading } from './components/ui/Loading'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
      refetchOnWindowFocus: false,
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
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/funcionarios"  element={<FuncionariosPage />} />
          <Route path="/frequencia"    element={<FrequenciaPage />} />
          <Route path="/escala"        element={<EscalaPage />} />
          <Route path="/escala/imprimir-semanal" element={<EscalaSemanalPrint />} />
          <Route path="/escala/imprimir-mensal" element={<EscalaMensalPrint />} />
          <Route path="/notificacoes"  element={<NotificacoesPage />} />
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
      <Route path="/*"     element={<ProtectedLayout />} />
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
