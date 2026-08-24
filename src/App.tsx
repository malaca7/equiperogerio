import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { useConfiguracao } from './hooks/useConfiguracoes'
import { ToastProvider } from './components/ui/Toast'
import useRealtimeSync from './hooks/useRealtimeSync'
import { Sidebar } from './components/layout/Sidebar'
import { GlobalTopHeader } from './components/layout/TopHeader'
import { BottomNavBar } from './components/layout/BottomNavBar'
import { HeaderProvider } from './contexts/HeaderContext'
import { RouteGuard } from './components/auth/RouteGuard'
import { Loading } from './components/ui/Loading'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { lazyWithRetry } from './lib/lazyWithRetry'

// Lazy loaded page components with automatic retry/reload resilience on new deployments
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const DashboardProducaoPage = lazyWithRetry(() => import('./pages/DashboardProducaoPage').then(m => ({ default: m.DashboardProducaoPage })))
const FuncionariosPage = lazyWithRetry(() => import('./pages/FuncionariosPage').then(m => ({ default: m.FuncionariosPage })))
const FrequenciaPage = lazyWithRetry(() => import('./pages/FrequenciaPage').then(m => ({ default: m.FrequenciaPage })))
const EscalaPage = lazyWithRetry(() => import('./pages/EscalaPage').then(m => ({ default: m.EscalaPage })))
const EscalaLocalidadePage = lazyWithRetry(() => import('./pages/EscalaLocalidadePage').then(m => ({ default: m.EscalaLocalidadePage })))
const DemandasPage = lazyWithRetry(() => import('./pages/DemandasPage'))
const ModelosEscalaPage = lazyWithRetry(() => import('./pages/ModelosEscalaPage').then(m => ({ default: m.ModelosEscalaPage })))
const OrganizacaoVarricaoPage = lazyWithRetry(() => import('./pages/OrganizacaoVarricaoPage').then(m => ({ default: m.OrganizacaoVarricaoPage })))
const EscalaSemanalPrint = lazyWithRetry(() => import('./pages/EscalaSemanalPrint').then(m => ({ default: m.EscalaSemanalPrint })))
const EscalaMensalPrint = lazyWithRetry(() => import('./pages/EscalaMensalPrint').then(m => ({ default: m.EscalaMensalPrint })))
const NotificacoesPage = lazyWithRetry(() => import('./pages/NotificacoesPage').then(m => ({ default: m.NotificacoesPage })))
const ObservacoesPage = lazyWithRetry(() => import('./pages/ObservacoesPage').then(m => ({ default: m.ObservacoesPage })))
const RendimentoPage = lazyWithRetry(() => import('./pages/RendimentoPage').then(m => ({ default: m.RendimentoPage })))
const AtestadosPage = lazyWithRetry(() => import('./pages/AtestadosPage').then(m => ({ default: m.AtestadosPage })))
const EquipesPage = lazyWithRetry(() => import('./pages/EquipesPage').then(m => ({ default: m.EquipesPage })))
const GerarRelatorioPage = lazyWithRetry(() => import('./pages/GerarRelatorioPage').then(m => ({ default: m.GerarRelatorioPage })))
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const UsuariosPage = lazyWithRetry(() => import('./pages/admin/UsuariosPage'))
const PerfilPage = lazyWithRetry(() => import('./pages/PerfilPage').then(m => ({ default: m.PerfilPage })))
const EstoqueDashboardPage = lazyWithRetry(() => import('./pages/estoque/EstoqueDashboardPage').then(m => ({ default: m.EstoqueDashboardPage })))
const EstoqueProdutosPage = lazyWithRetry(() => import('./pages/estoque/EstoqueProdutosPage').then(m => ({ default: m.EstoqueProdutosPage })))
const EstoqueMovimentacoesPage = lazyWithRetry(() => import('./pages/estoque/EstoqueMovimentacoesPage').then(m => ({ default: m.EstoqueMovimentacoesPage })))
const EstoqueCautelasPage = lazyWithRetry(() => import('./pages/estoque/EstoqueCautelasPage').then(m => ({ default: m.EstoqueCautelasPage })))
const EstoqueSolicitacoesPage = lazyWithRetry(() => import('./pages/estoque/EstoqueSolicitacoesPage').then(m => ({ default: m.EstoqueSolicitacoesPage })))
const EstoqueRegioesPage = lazyWithRetry(() => import('./pages/estoque/EstoqueRegioesPage').then(m => ({ default: m.EstoqueRegioesPage })))
const EstoqueRetiradaRapidaPage = lazyWithRetry(() => import('./pages/estoque/EstoqueRetiradaRapidaPage').then(m => ({ default: m.EstoqueRetiradaRapidaPage })))
const EstoqueAlertasPage = lazyWithRetry(() => import('./pages/estoque/EstoqueAlertasPage').then(m => ({ default: m.EstoqueAlertasPage })))
const EstoqueAuditoriaPage = lazyWithRetry(() => import('./pages/estoque/EstoqueAuditoriaPage').then(m => ({ default: m.EstoqueAuditoriaPage })))
const EstoqueLocaisPage = lazyWithRetry(() => import('./pages/estoque/EstoqueLocaisPage').then(m => ({ default: m.EstoqueLocaisPage })))
const EstoqueSaldosPage = lazyWithRetry(() => import('./pages/estoque/EstoqueSaldosPage').then(m => ({ default: m.EstoqueSaldosPage })))
const FrotaDashboardPage = lazyWithRetry(() => import('./pages/frota/FrotaDashboard').then(m => ({ default: m.FrotaDashboardPage })))
const FrotaVeiculosPage = lazyWithRetry(() => import('./pages/frota/FrotaVeiculosPage').then(m => ({ default: m.FrotaVeiculosPage })))
const FrotaRegistrosPage = lazyWithRetry(() => import('./pages/frota/FrotaRegistrosPage').then(m => ({ default: m.FrotaRegistrosPage })))
const FrotaControlePage = lazyWithRetry(() => import('./pages/frota/FrotaControlePage').then(m => ({ default: m.FrotaControlePage })))
const FrotaAbastecimentosPage = lazyWithRetry(() => import('./pages/frota/FrotaAbastecimentosPage').then(m => ({ default: m.FrotaAbastecimentosPage })))
const FrotaManutencoesPage = lazyWithRetry(() => import('./pages/frota/FrotaManutencoesPage').then(m => ({ default: m.FrotaManutencoesPage })))
const FrotaMotoristaPage = lazyWithRetry(() => import('./pages/frota/FrotaMotoristaPage').then(m => ({ default: m.FrotaMotoristaPage })))
const FrotaObservacoesPage = lazyWithRetry(() => import('./pages/frota/FrotaObservacoesPage').then(m => ({ default: m.FrotaObservacoesPage })))
const FrotaRendimentoPage = lazyWithRetry(() => import('./pages/frota/FrotaRendimentoPage').then(m => ({ default: m.FrotaRendimentoPage })))
const FrotaNotificacoesPage = lazyWithRetry(() => import('./pages/frota/FrotaNotificacoesPage').then(m => ({ default: m.FrotaNotificacoesPage })))
const SstSolicitacaoEpiPage = lazyWithRetry(() => import('./pages/sst/SstSolicitacaoEpiPage').then(m => ({ default: m.SstSolicitacaoEpiPage })))
const DownloadPage = lazyWithRetry(() => import('./pages/DownloadPage').then(m => ({ default: m.DownloadPage })))
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // 10 seconds for real-time freshness
      gcTime: 1000 * 60 * 15,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
})

import { type SystemPage } from './lib/auth.types'

function DefaultRedirect() {
  const { hasPermission, loading } = useAuth()

  if (loading) {
    return <Loading size="lg" text="Carregando..." fullscreen variant="dots" />
  }

  const routesToCheck: { page: SystemPage; to: string }[] = [
    { page: 'dashboard', to: '/' },
    { page: 'dashboard_producao', to: '/dashboard-producao' },
    { page: 'funcionarios', to: '/funcionarios' },
    { page: 'equipes', to: '/equipes' },
    { page: 'localidades', to: '/metaerota' },
    { page: 'frequencia', to: '/frequencia' },
    { page: 'atestados', to: '/atestados' },
    { page: 'escala', to: '/escala' },
    { page: 'observacoes', to: '/observacoes' },
    { page: 'rendimento', to: '/rendimento' },
    { page: 'notificacoes', to: '/notificacoes' },
    { page: 'usuarios', to: '/usuarios' },
    { page: 'admin', to: '/admin' },
    { page: 'estoque', to: '/estoque' },
    { page: 'estoque_produtos', to: '/estoque/produtos' },
    { page: 'estoque_movimentacoes', to: '/estoque/movimentacoes' },
    { page: 'estoque_cautelas', to: '/estoque/cautelas' },
    { page: 'estoque_solicitacoes', to: '/estoque/solicitacoes' },
    { page: 'estoque_regioes', to: '/estoque/regioes' },
    { page: 'estoque_retirada', to: '/estoque/retirada-rapida' },
    { page: 'estoque_alertas', to: '/estoque/alertas' },
    { page: 'estoque_auditoria', to: '/estoque/auditoria' },
    { page: 'estoque_locais', to: '/estoque/locais' },
    { page: 'frota', to: '/frota' },
    { page: 'frota_veiculos', to: '/frota/veiculos' },
    { page: 'frota_registros', to: '/frota/registros' },
    { page: 'frota_abastecimentos', to: '/frota/abastecimentos' },
    { page: 'frota_manutencoes', to: '/frota/manutencoes' },
    { page: 'frota_observacoes', to: '/frota/observacoes' },
    { page: 'frota_rendimento', to: '/frota/rendimento' },
    { page: 'frota_notificacoes', to: '/frota/notificacoes' },
  ]

  const firstAllowed = routesToCheck.find(r => hasPermission(r.page, 'visualizar'))

  if (firstAllowed) {
    if (firstAllowed.page === 'dashboard') {
      return (
        <RouteGuard page="dashboard">
          <DashboardPage />
        </RouteGuard>
      )
    }
    return <Navigate to={firstAllowed.to} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[hsl(var(--background))] text-center text-rose-500 font-bold">
      Nenhuma permissão de visualização configurada para o seu usuário.
    </div>
  )
}

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth()
  const { isSidebarCollapsed } = useTheme()

  if (loading) {
    return <Loading size="lg" text="Carregando..." fullscreen variant="dots" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <Sidebar />
      <GlobalTopHeader />
      <main className={`transition-all duration-300 min-h-screen ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-72'} pb-24 md:pb-0 pt-16`}>
        <Suspense fallback={<Loading size="lg" text="Carregando..." fullscreen variant="dots" />}>
          <Routes>
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="/dashboard-producao" element={<RouteGuard page="dashboard_producao"><DashboardProducaoPage /></RouteGuard>} />
            <Route path="/funcionarios" element={<RouteGuard page="funcionarios"><FuncionariosPage /></RouteGuard>} />
            <Route path="/frequencia" element={<RouteGuard page="frequencia"><FrequenciaPage /></RouteGuard>} />
            <Route path="/escala" element={<RouteGuard page="escala"><EscalaPage /></RouteGuard>} />
            <Route path="/escala/modelos" element={<RouteGuard page="modelos_escala"><ModelosEscalaPage /></RouteGuard>} />
            <Route path="/metaerota" element={<RouteGuard page="localidades"><EscalaLocalidadePage /></RouteGuard>} />
            <Route path="/escala/localidades" element={<Navigate to="/metaerota" replace />} />
            {/* Mapeamento Operacional */}
            <Route path="/escala/mapeamento" element={<RouteGuard page="organizacao_varricao"><OrganizacaoVarricaoPage /></RouteGuard>} />
            <Route path="/escala/organizacao-varricao" element={<Navigate to="/escala/mapeamento" replace />} />
            <Route path="/escala/demandas" element={<RouteGuard page="demandas"><DemandasPage /></RouteGuard>} />
            <Route path="/escala/imprimir-semanal" element={<RouteGuard page="escala"><EscalaSemanalPrint /></RouteGuard>} />
            <Route path="/escala/imprimir-mensal" element={<RouteGuard page="escala"><EscalaMensalPrint /></RouteGuard>} />
            <Route path="/notificacoes" element={<RouteGuard page="notificacoes"><NotificacoesPage /></RouteGuard>} />
            <Route path="/observacoes" element={<RouteGuard page="observacoes"><ObservacoesPage /></RouteGuard>} />
            <Route path="/rendimento" element={<RouteGuard page="rendimento"><RendimentoPage /></RouteGuard>} />
            <Route path="/atestados" element={<RouteGuard page="atestados"><AtestadosPage /></RouteGuard>} />
            <Route path="/equipes" element={<RouteGuard page="equipes"><EquipesPage /></RouteGuard>} />
            <Route path="/equipes/gerar-relatorio" element={<RouteGuard page="gerar_relatorio"><GerarRelatorioPage /></RouteGuard>} />
            <Route path="/configuracoes" element={<Navigate to="/admin?tab=parametros" replace />} />
            <Route path="/usuarios" element={<RouteGuard page="usuarios"><UsuariosPage /></RouteGuard>} />
            <Route path="/estoque" element={<RouteGuard page="estoque"><EstoqueDashboardPage /></RouteGuard>} />
            <Route path="/estoque/produtos" element={<RouteGuard page="estoque_produtos"><EstoqueProdutosPage /></RouteGuard>} />
            <Route path="/estoque/movimentacoes" element={<RouteGuard page="estoque_movimentacoes"><EstoqueMovimentacoesPage /></RouteGuard>} />
            <Route path="/estoque/cautelas" element={<RouteGuard page="estoque_cautelas"><EstoqueCautelasPage /></RouteGuard>} />
            <Route path="/estoque/solicitacoes" element={<RouteGuard page="estoque_solicitacoes"><EstoqueSolicitacoesPage /></RouteGuard>} />
            <Route path="/estoque/regioes" element={<RouteGuard page="estoque_regioes"><EstoqueRegioesPage /></RouteGuard>} />
            <Route path="/estoque/retirada-rapida" element={<RouteGuard page="estoque_retirada"><EstoqueRetiradaRapidaPage /></RouteGuard>} />
            <Route path="/estoque/alertas" element={<RouteGuard page="estoque_alertas"><EstoqueAlertasPage /></RouteGuard>} />
            <Route path="/estoque/auditoria" element={<RouteGuard page="estoque_auditoria"><EstoqueAuditoriaPage /></RouteGuard>} />
            <Route path="/estoque/locais" element={<RouteGuard page="estoque_locais"><EstoqueLocaisPage /></RouteGuard>} />
            <Route path="/estoque/saldos" element={<RouteGuard page="estoque"><EstoqueSaldosPage /></RouteGuard>} />
            <Route path="/frota" element={<RouteGuard page="frota"><FrotaDashboardPage /></RouteGuard>} />
            <Route path="/frota/veiculos" element={<RouteGuard page="frota_veiculos"><FrotaVeiculosPage /></RouteGuard>} />
            <Route path="/frota/registros" element={<RouteGuard page="frota_registros"><FrotaRegistrosPage /></RouteGuard>} />
            <Route path="/frota/controle" element={<RouteGuard page="frota_registros"><FrotaControlePage /></RouteGuard>} />
            <Route path="/frota/motorista" element={<RouteGuard page="frota_rotas"><FrotaMotoristaPage /></RouteGuard>} />
            <Route path="/frota/abastecimentos" element={<RouteGuard page="frota_abastecimentos"><FrotaAbastecimentosPage /></RouteGuard>} />
            <Route path="/frota/manutencoes" element={<RouteGuard page="frota_manutencoes"><FrotaManutencoesPage /></RouteGuard>} />
            <Route path="/frota/observacoes" element={<RouteGuard page="frota_observacoes"><FrotaObservacoesPage /></RouteGuard>} />
            <Route path="/frota/rendimento" element={<RouteGuard page="frota_rendimento"><FrotaRendimentoPage /></RouteGuard>} />
            <Route path="/frota/notificacoes" element={<RouteGuard page="frota_notificacoes"><FrotaNotificacoesPage /></RouteGuard>} />
            <Route path="/sst/solicitar-epi" element={<RouteGuard page="sst_solicitacao_epi"><SstSolicitacaoEpiPage /></RouteGuard>} />
            <Route path="/sst/almoxarifado-epi" element={<Navigate to="/sst/solicitar-epi" replace />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/admin/*" element={<RouteGuard page="admin"><AdminDashboard /></RouteGuard>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNavBar />
    </>
  )
}

function RootHandler() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <LoginPage />
  return <ProtectedLayout />
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading size="lg" text="Carregando..." fullscreen variant="dots" />}>
      <Routes>
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/*" element={<RootHandler />} />
      </Routes>
    </Suspense>
  )
}

function GlobalBrandingEffect() {
  const { data: platNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: platSlogan = 'GEstao Eficaz' } = useConfiguracao('plataforma_slogan', 'GEstao Eficaz')
  const { data: platIconUrl = '' } = useConfiguracao('plataforma_icon_url', '')

  useEffect(() => {
    document.title = `${platNome} - ${platSlogan}`
  }, [platNome, platSlogan])

  useEffect(() => {
    if (platIconUrl) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']")
      if (link) {
        link.href = platIconUrl
      } else {
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.href = platIconUrl
        document.head.appendChild(newLink)
      }
    }
  }, [platIconUrl])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HeaderProvider>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>
                {/* Start realtime sync (keeps all clients updated) */}
                <RealtimeInit />
                <GlobalBrandingEffect />
                <Router>
                  <AppRoutes />
                </Router>
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </HeaderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function RealtimeInit() {
  useRealtimeSync()
  return null
}
