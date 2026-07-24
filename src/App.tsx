import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { useConfiguracao } from './hooks/useConfiguracoes'
import { ToastProvider } from './components/ui/Toast'
import useRealtimeSync from './hooks/useRealtimeSync'
import { Sidebar } from './components/layout/Sidebar'
import { GlobalTopHeader } from './components/layout/TopHeader'
import { HeaderProvider } from './contexts/HeaderContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DashboardProducaoPage } from './pages/DashboardProducaoPage'
import { FuncionariosPage } from './pages/FuncionariosPage'
import { FrequenciaPage } from './pages/FrequenciaPage'
import { EscalaPage } from './pages/EscalaPage'
import { EscalaLocalidadePage } from './pages/EscalaLocalidadePage'
import DemandasPage from './pages/DemandasPage'
import { ModelosEscalaPage } from './pages/ModelosEscalaPage'
import { OrganizacaoVarricaoPage } from './pages/OrganizacaoVarricaoPage'
import { EscalaSemanalPrint } from './pages/EscalaSemanalPrint'
import { EscalaMensalPrint } from './pages/EscalaMensalPrint'
import { NotificacoesPage } from './pages/NotificacoesPage'
import { ObservacoesPage } from './pages/ObservacoesPage'
import { RendimentoPage } from './pages/RendimentoPage'
import { AtestadosPage } from './pages/AtestadosPage'
import { EquipesPage } from './pages/EquipesPage'
import { GerarRelatorioPage } from './pages/GerarRelatorioPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import UsuariosPage from './pages/admin/UsuariosPage'
import { PerfilPage } from './pages/PerfilPage'
import { EstoqueDashboardPage } from './pages/estoque/EstoqueDashboardPage'
import { EstoqueProdutosPage } from './pages/estoque/EstoqueProdutosPage'
import { EstoqueMovimentacoesPage } from './pages/estoque/EstoqueMovimentacoesPage'
import { EstoqueCautelasPage } from './pages/estoque/EstoqueCautelasPage'
import { EstoqueSolicitacoesPage } from './pages/estoque/EstoqueSolicitacoesPage'
import { EstoqueRegioesPage } from './pages/estoque/EstoqueRegioesPage'
import { EstoqueRetiradaRapidaPage } from './pages/estoque/EstoqueRetiradaRapidaPage'
import { EstoqueAlertasPage } from './pages/estoque/EstoqueAlertasPage'
import { EstoqueAuditoriaPage } from './pages/estoque/EstoqueAuditoriaPage'
import { EstoqueLocaisPage } from './pages/estoque/EstoqueLocaisPage'
import { EstoqueSaldosPage } from './pages/estoque/EstoqueSaldosPage'
import { FrotaDashboardPage } from './pages/frota/FrotaDashboard'
import { FrotaVeiculosPage } from './pages/frota/FrotaVeiculosPage'
import { FrotaRegistrosPage } from './pages/frota/FrotaRegistrosPage'
import { FrotaControlePage } from './pages/frota/FrotaControlePage'
import { FrotaAbastecimentosPage } from './pages/frota/FrotaAbastecimentosPage'
import { FrotaManutencoesPage } from './pages/frota/FrotaManutencoesPage'
import { FrotaMotoristaPage } from './pages/frota/FrotaMotoristaPage'
import { FrotaObservacoesPage } from './pages/frota/FrotaObservacoesPage'
import { FrotaRendimentoPage } from './pages/frota/FrotaRendimentoPage'
import { FrotaNotificacoesPage } from './pages/frota/FrotaNotificacoesPage'
import { SstSolicitacaoEpiPage } from './pages/sst/SstSolicitacaoEpiPage'
import { RouteGuard } from './components/auth/RouteGuard'
import { Loading } from './components/ui/Loading'
import { DownloadPage } from './pages/DownloadPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 15,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
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
    { page: 'localidades', to: '/escala/localidades' },
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
      <main className={`transition-all duration-300 min-h-screen cyber-grid ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
        <Routes>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/dashboard-producao" element={<RouteGuard page="dashboard_producao"><DashboardProducaoPage /></RouteGuard>} />
          <Route path="/funcionarios" element={<RouteGuard page="funcionarios"><FuncionariosPage /></RouteGuard>} />
          <Route path="/frequencia" element={<RouteGuard page="frequencia"><FrequenciaPage /></RouteGuard>} />
          <Route path="/escala" element={<RouteGuard page="escala"><EscalaPage /></RouteGuard>} />
          <Route path="/escala/modelos" element={<RouteGuard page="modelos_escala"><ModelosEscalaPage /></RouteGuard>} />
          <Route path="/escala/localidades" element={<RouteGuard page="localidades"><EscalaLocalidadePage /></RouteGuard>} />
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
      </main>
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
    <Routes>
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/*" element={<RootHandler />} />
    </Routes>
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
