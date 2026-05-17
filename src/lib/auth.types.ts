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

export type PermissionAction = 'visualizar' | 'editar' | 'administrar'

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
  'funcionarios',
  'frequencia',
  'escala',
  'localidades',
  'atestados',
  'observacoes',
  'rendimento',
  'notificacoes',
  'configuracoes',
  'admin',
] as const

export type SystemPage = typeof SYSTEM_PAGES[number]

export const PAGE_LABELS: Record<SystemPage, string> = {
  dashboard: 'Dashboard',
  funcionarios: 'Funcionários',
  frequencia: 'Frequência / Chamada',
  escala: 'Escala',
  localidades: 'Localidades',
  atestados: 'Atestados',
  observacoes: 'Observações',
  rendimento: 'Rendimento',
  notificacoes: 'Notificações',
  configuracoes: 'Configurações',
  admin: 'Administração',
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  visualizar: 'Visualização',
  editar: 'Edição',
  administrar: 'Administração',
}

// Map routes to system pages for permission checking
export const ROUTE_PAGE_MAP: Record<string, SystemPage> = {
  '/': 'dashboard',
  '/funcionarios': 'funcionarios',
  '/frequencia': 'frequencia',
  '/escala': 'escala',
  '/escala/calendario': 'escala',
  '/escala/localidades': 'localidades',
  '/escala/imprimir-semanal': 'escala',
  '/escala/imprimir-mensal': 'escala',
  '/atestados': 'atestados',
  '/observacoes': 'observacoes',
  '/rendimento': 'rendimento',
  '/notificacoes': 'notificacoes',
  '/configuracoes': 'configuracoes',
  '/admin': 'admin',
  '/admin/usuarios': 'admin',
  '/admin/cargos': 'admin',
  '/admin/permissoes': 'admin',
  '/admin/auditoria': 'admin',
  '/admin/seguranca': 'admin',
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
