// =====================================================
// 7 BOSS — Auth & RBAC Types
// =====================================================

export interface Profile {
  id: string
  cpf: string
  senha: string
  nome: string
  email: string | null
  avatar_url: string | null
  ativo: boolean
  ultimo_login: string | null
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  nome: string
  descricao: string | null
  cor: string
  nivel: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  pagina: string
  acao: PermissionAction
  descricao: string | null
  created_at: string
}

export interface RolePermission {
  id: string
  role_id: string
  permission_id: string
  created_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role_id: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  acao: string
  modulo: string
  descricao: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  rota: string | null
  created_at: string
  // Joined
  profiles?: Pick<Profile, 'nome' | 'email' | 'avatar_url'> | null
}

export interface LoginLog {
  id: string
  email: string
  sucesso: boolean
  ip: string | null
  dispositivo: string | null
  navegador: string | null
  sistema_operacional: string | null
  motivo_falha: string | null
  tentativa_em: string
}

export interface AccessLog {
  id: string
  user_id: string | null
  pagina: string
  horario_entrada: string
  horario_saida: string | null
  tempo_permanencia: number | null
  // Joined
  profiles?: Pick<Profile, 'nome' | 'email'> | null
}

export interface SecurityEvent {
  id: string
  tipo: SecurityEventType
  severidade: SecuritySeverity
  descricao: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  // Joined
  profiles?: Pick<Profile, 'nome' | 'email'> | null
}

// =====================================================
// Enums & Constants
// =====================================================

export type PermissionAction = 'visualizar' | 'gerenciar'

export type SecurityEventType =
  | 'login_failed'
  | 'login_success'
  | 'logout'
  | 'session_expired'
  | 'permission_denied'
  | 'role_changed'
  | 'user_blocked'
  | 'suspicious_activity'
  | 'data_export'
  | 'critical_change'

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

// All system pages that can be controlled
export const SYSTEM_PAGES = [
  'dashboard',
  'dashboard_producao',
  'funcionarios',
  'equipes',
  'gerar_relatorio',
  'frequencia',
  'escala',
  'modelos_escala',
  'localidades',
  'demandas',
  'atestados',
  'observacoes',
  'rendimento',
  'notificacoes',
  'admin',
  'usuarios',
  'estoque',
  'estoque_produtos',
  'estoque_movimentacoes',
  'estoque_cautelas',
  'estoque_solicitacoes',
  'estoque_regioes',
  'estoque_retirada',
  'estoque_alertas',
  'estoque_auditoria',
  'estoque_locais',
  'frota',
  'frota_veiculos',
  'frota_registros',
  'frota_rotas',
  'frota_abastecimentos',
  'frota_manutencoes',
  'frota_observacoes',
  'frota_rendimento',
  'frota_notificacoes',
  'sst_solicitacao_epi',
  'sst_almoxarifado_epi',
  'organizacao_varricao',
  'folgas',
] as const

export type SystemPage = typeof SYSTEM_PAGES[number]

export interface PanelInfo {
  id: string
  label: string
  color: string
}

export interface MenuPageConfig {
  id: string
  label: string
  rota: string
  icone: string
  ordem: number
  ativo?: boolean
}

export interface MenuModuleConfig {
  id: string
  label: string
  icon: string
  ordem: number
  paginas: MenuPageConfig[]
  ativo?: boolean
}

export interface MenuConfig {
  modulos: MenuModuleConfig[]
  inativos?: {
    modulos?: MenuModuleConfig[]
    paginas?: { originalModId: string; page: MenuPageConfig }[]
  }
}

export const DEFAULT_MENU_CONFIG: MenuConfig = {
  modulos: [
    { id: 'administrativo', label: 'Administrativo', icon: 'Building2', ordem: 1, paginas: [
      { id: 'dashboard', label: 'Painel Geral', rota: '/', icone: 'LayoutDashboard', ordem: 1 },
      { id: 'equipes', label: 'Equipes', rota: '/equipes', icone: 'Network', ordem: 2 },
      { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 3 },
      { id: 'rendimento', label: 'Rendimento', rota: '/rendimento', icone: 'BarChart3', ordem: 4 },
      { id: 'notificacoes', label: 'Notificações', rota: '/notificacoes', icone: 'Bell', ordem: 5 },
      { id: 'admin', label: 'Painel de Controle', rota: '/admin', icone: 'Settings', ordem: 6 },
      { id: 'usuarios', label: 'Usuários', rota: '/usuarios', icone: 'Users', ordem: 7 },
    ]},
    { id: 'producao', label: 'Produção', icon: 'Hammer', ordem: 2, paginas: [
      { id: 'dashboard_producao', label: 'Painel Prod', rota: '/dashboard-producao', icone: 'LayoutDashboard', ordem: 1 },
      { id: 'equipes', label: 'Equipes', rota: '/equipes', icone: 'Network', ordem: 2 },
      { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 3 },
      { id: 'escala', label: 'Escala', rota: '/escala', icone: 'CalendarDays', ordem: 4 },
      { id: 'modelos_escala', label: 'Modelos', rota: '/escala/modelos', icone: 'CalendarDays', ordem: 5 },
      { id: 'localidades', label: 'Meta e Rota', rota: '/metaerota', icone: 'Navigation2', ordem: 6 },
      { id: 'organizacao_varricao', label: 'Mapeamento', rota: '/escala/mapeamento', icone: 'Map', ordem: 6.7 },
      { id: 'demandas', label: 'Demandas', rota: '/escala/demandas', icone: 'FileText', ordem: 6.8 },
      { id: 'frequencia', label: 'Chamada', rota: '/frequencia', icone: 'Clock', ordem: 7 },
      { id: 'folgas', label: 'Gestão de Folgas', rota: '/folgas', icone: 'CalendarDays', ordem: 7.5 },
      { id: 'observacoes', label: 'Observações', rota: '/observacoes', icone: 'FileText', ordem: 8 },
    ]},
    { id: 'pessoal', label: 'Pessoal', icon: 'Users', ordem: 3, paginas: [
      { id: 'dashboard', label: 'Painel Geral', rota: '/', icone: 'LayoutDashboard', ordem: 1 },
      { id: 'funcionarios', label: 'Funcionários', rota: '/funcionarios', icone: 'Users', ordem: 2 },
      { id: 'equipes', label: 'Equipes', rota: '/equipes', icone: 'Network', ordem: 3 },
      { id: 'gerar_relatorio', label: 'Gerar Relatório', rota: '/equipes/gerar-relatorio', icone: 'FileText', ordem: 4 },
      { id: 'escala', label: 'Escala', rota: '/escala', icone: 'CalendarDays', ordem: 5 },
      { id: 'folgas', label: 'Gestão de Folgas', rota: '/folgas', icone: 'CalendarDays', ordem: 5.5 },
      { id: 'atestados', label: 'Atestados', rota: '/atestados', icone: 'Activity', ordem: 6 },
    ]},
    { id: 'seguranca', label: 'Saúde e Segurança', icon: 'HeartPulse', ordem: 4, paginas: [
      { id: 'atestados', label: 'Atestados', rota: '/atestados', icone: 'Activity', ordem: 1 },
      { id: 'observacoes', label: 'Observações', rota: '/observacoes', icone: 'FileText', ordem: 2 },
      { id: 'sst_solicitacao_epi', label: 'Solicitar EPI', rota: '/sst/solicitar-epi', icone: 'ShieldAlert', ordem: 3 },
    ]},
    { id: 'frota', label: 'Frota', icon: 'Truck', ordem: 5, paginas: [
      { id: 'frota', label: 'Painel Frota', rota: '/frota', icone: 'LayoutDashboard', ordem: 1 },
      { id: 'frota_veiculos', label: 'Veículos', rota: '/frota/veiculos', icone: 'Truck', ordem: 2 },
      { id: 'frota_registros', label: 'Diário (KM)', rota: '/frota/registros', icone: 'Activity', ordem: 3 },
      { id: 'frota_rotas', label: 'Rotas', rota: '/frota/motorista', icone: 'Map', ordem: 4 },
      { id: 'frota_abastecimentos', label: 'Abastecimentos', rota: '/frota/abastecimentos', icone: 'MapPin', ordem: 5 },
      { id: 'frota_manutencoes', label: 'Manutenções', rota: '/frota/manutencoes', icone: 'Hammer', ordem: 6 },
    ]},
    { id: 'estoque', label: 'Estoque', icon: 'Package', ordem: 6, paginas: [
      { id: 'estoque', label: 'Painel Estoque', rota: '/estoque', icone: 'LayoutDashboard', ordem: 1 },
      { id: 'estoque_produtos', label: 'Produtos', rota: '/estoque/produtos', icone: 'Package', ordem: 2 },
      { id: 'estoque_movimentacoes', label: 'Movimentações', rota: '/estoque/movimentacoes', icone: 'Activity', ordem: 3 },
      { id: 'estoque_cautelas', label: 'Cautelas', rota: '/estoque/cautelas', icone: 'ShieldCheck', ordem: 4 },
      { id: 'estoque_solicitacoes', label: 'Solicitações', rota: '/estoque/solicitacoes', icone: 'Building2', ordem: 5 },
      { id: 'estoque_regioes', label: 'Regiões', rota: '/estoque/regioes', icone: 'MapPin', ordem: 6 },
      { id: 'estoque_retirada', label: 'Retirada Rápida', rota: '/estoque/retirada-rapida', icone: 'ScanBarcode', ordem: 7 },
      { id: 'estoque_alertas', label: 'Alertas', rota: '/estoque/alertas', icone: 'Bell', ordem: 8 },
      { id: 'estoque_auditoria', label: 'Auditoria', rota: '/estoque/auditoria', icone: 'FileText', ordem: 9 },
      { id: 'estoque_locais', label: 'Locais Estoque', rota: '/estoque/locais', icone: 'Building2', ordem: 10 },
    ]},
  ],
}

export const VISUAL_PANELS: PanelInfo[] = [
  { id: 'administrativo', label: 'Administrativo', color: 'from-blue-500 to-blue-600 animate-pulse-slow' },
  { id: 'producao', label: 'Produção', color: 'from-emerald-500 to-emerald-600' },
  { id: 'pessoal', label: 'Pessoal (RH e DP)', color: 'from-purple-500 to-purple-600' },
  { id: 'seguranca', label: 'Segurança e Saúde', color: 'from-rose-500 to-rose-600' },
  { id: 'frota', label: 'Frota', color: 'from-amber-500 to-amber-600' },
  { id: 'estoque', label: 'Estoque', color: 'from-indigo-500 to-indigo-600' },
]

export const DEFAULT_PAINEIS_PAGINAS: Record<SystemPage, string[]> = {
  dashboard: ['administrativo', 'producao'],
  dashboard_producao: ['producao'],
  funcionarios: ['pessoal'],
  equipes: ['administrativo', 'producao', 'pessoal'],
  gerar_relatorio: ['administrativo', 'producao', 'pessoal'],
  frequencia: ['producao'],
  escala: ['producao', 'pessoal'],
  modelos_escala: ['producao'],
  localidades: ['producao'],
  demandas: ['producao'],
  atestados: ['pessoal', 'seguranca'],
  observacoes: ['producao', 'seguranca'],
  rendimento: ['producao', 'administrativo'],
  notificacoes: ['administrativo'],
  admin: ['administrativo'],
  usuarios: ['administrativo'],
  estoque: ['estoque'],
  estoque_produtos: ['estoque'],
  estoque_movimentacoes: ['estoque'],
  estoque_cautelas: ['estoque'],
  estoque_solicitacoes: ['estoque'],
  estoque_regioes: ['estoque'],
  estoque_retirada: ['estoque'],
  estoque_alertas: ['estoque'],
  estoque_auditoria: ['estoque'],
  estoque_locais: ['estoque'],
  frota: ['frota'],
  frota_veiculos: ['frota'],
  frota_registros: ['frota'],
  frota_rotas: ['frota'],
  frota_abastecimentos: ['frota'],
  frota_manutencoes: ['frota'],
  frota_observacoes: ['frota'],
  frota_rendimento: ['frota'],
  frota_notificacoes: ['frota'],
  sst_solicitacao_epi: ['seguranca'],
  sst_almoxarifado_epi: ['seguranca'],
  organizacao_varricao: ['producao', 'administrativo'],
  folgas: ['producao', 'pessoal', 'administrativo'],
}

export const PAGE_LABELS: Record<SystemPage, string> = {
  dashboard: 'Dashboard Admin',
  dashboard_producao: 'Dashboard Produção',
  funcionarios: 'Funcionários',
  equipes: 'Equipes e Regiões',
  gerar_relatorio: 'Gerar Relatório',
  frequencia: 'Frequência / Chamada',
  escala: 'Escala',
  modelos_escala: 'Escala de Domingos & Feriados',
  localidades: 'Meta e Rota',
  demandas: 'Demandas',
  atestados: 'Atestados',
  observacoes: 'Observações',
  folgas: 'Gestão de Folgas',
  rendimento: 'Rendimento',
  notificacoes: 'Notificações',
  admin: 'Painel de Controle',
  usuarios: 'Gerenciamento de Usuários',
  estoque: 'Dashboard Estoque',
  estoque_produtos: 'Produtos e Categorias',
  estoque_movimentacoes: 'Movimentações de Estoque',
  estoque_cautelas: 'Cautelas (EPI/Ferramentas)',
  estoque_solicitacoes: 'Solicitações de Compras',
  estoque_regioes: 'Regiões de Estoque',
  estoque_retirada: 'Retirada Rápida',
  estoque_alertas: 'Alertas de Estoque',
  estoque_auditoria: 'Auditoria de Estoque',
  estoque_locais: 'Locais de Estoque',
  frota: 'Dashboard Frota',
  frota_veiculos: 'Veículos da Frota',
  frota_registros: 'Diário de Bordo (KM)',
  frota_rotas: 'Rotas Rápidas',
  frota_abastecimentos: 'Abastecimentos',
  frota_manutencoes: 'Manutenções',
  frota_observacoes: 'Observações de Frota',
  frota_rendimento: 'Rendimento de Frota',
  frota_notificacoes: 'Notificações de Frota',
  sst_solicitacao_epi: 'Solicitação de EPI (SST)',
  sst_almoxarifado_epi: 'Almoxarifado de EPI (SST)',
  organizacao_varricao: 'Organização de Varrição',
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  visualizar: 'Visualização',
  gerenciar: 'Gerenciamento',
}

// Map routes to system pages for permission checking
export const ROUTE_PAGE_MAP: Record<string, SystemPage> = {
  '/': 'dashboard',
  '/dashboard-producao': 'dashboard_producao',
  '/funcionarios': 'funcionarios',
  '/equipes': 'equipes',
  '/equipes/gerar-relatorio': 'gerar_relatorio',
  '/frequencia': 'frequencia',
  '/escala': 'escala',
  '/escala/modelos': 'modelos_escala',
  '/metaerota': 'localidades',
  '/escala/localidades': 'localidades',
  '/escala/organizacao-varricao': 'organizacao_varricao',
  '/escala/demandas': 'demandas',
  '/escala/imprimir-semanal': 'escala',
  '/escala/imprimir-mensal': 'escala',
  '/atestados': 'atestados',
  '/observacoes': 'observacoes',
  '/rendimento': 'rendimento',
  '/notificacoes': 'notificacoes',
  '/configuracoes': 'admin',
  '/admin': 'admin',
  '/usuarios': 'usuarios',
  '/admin/usuarios': 'admin',
  '/admin/cargos': 'admin',
  '/admin/permissoes': 'admin',
  '/admin/auditoria': 'admin',
  '/admin/seguranca': 'admin',
  '/estoque': 'estoque',
  '/estoque/produtos': 'estoque_produtos',
  '/estoque/movimentacoes': 'estoque_movimentacoes',
  '/estoque/cautelas': 'estoque_cautelas',
  '/estoque/solicitacoes': 'estoque_solicitacoes',
  '/estoque/regioes': 'estoque_regioes',
  '/estoque/retirada-rapida': 'estoque_retirada',
  '/estoque/alertas': 'estoque_alertas',
  '/estoque/auditoria': 'estoque_auditoria',
  '/estoque/locais': 'estoque_locais',
  '/frota': 'frota',
  '/frota/veiculos': 'frota_veiculos',
  '/frota/registros': 'frota_registros',
  '/frota/controle': 'frota_registros',
  '/frota/motorista': 'frota_rotas',
  '/frota/abastecimentos': 'frota_abastecimentos',
  '/frota/manutencoes': 'frota_manutencoes',
  '/sst/solicitar-epi': 'sst_solicitacao_epi',
  '/sst/almoxarifado-epi': 'sst_almoxarifado_epi',
}

// Cached permission set for fast lookups
export type PermissionSet = Set<string>

export function makePermissionKey(pagina: string, acao: string): string {
  return `${pagina}:${acao}`
}

// User with full context
export interface AuthUser {
  profile: Profile
  roles: Pick<Role, 'id' | 'nome' | 'nivel'>[]
  permissions: PermissionSet
  isAdmin: boolean
  isDev: boolean
}
