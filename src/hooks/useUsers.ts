import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole, Role } from '../lib/auth.types'
import { useAudit } from './useAudit'

const USERS_KEY = ['admin-users']

export interface UserWithRoles extends Profile {
  roles: Pick<Role, 'id' | 'nome' | 'cor'>[]
}

export function useAdminUsers() {
  return useQuery<UserWithRoles[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome')
      if (error) throw error

      // Get all user_roles with role info
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, roles(id, nome, cor)')

      // Map roles to users
      const roleMap = new Map<string, Pick<Role, 'id' | 'nome' | 'cor'>[]>()
      if (userRoles) {
        for (const ur of userRoles) {
          const uid = ur.user_id
          if (!roleMap.has(uid)) roleMap.set(uid, [])
          if (ur.roles) roleMap.get(uid)!.push(ur.roles as any)
        }
      }

      return (profiles || []).map(p => ({
        ...p,
        roles: roleMap.get(p.id) || [],
      })) as UserWithRoles[]
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Partial<Profile> }) => {
      const { data: oldData } = await supabase.from('profiles').select('*').eq('id', id).single()

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'editar',
        modulo: 'usuarios',
        descricao: `Perfil de "${data.nome}" atualizado`,
        dados_anteriores: oldData,
        dados_novos: updateData,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useAssignRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: roleId })
      if (error) throw error

      // Get names for audit
      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', userId).single()
      const { data: role } = await supabase.from('roles').select('nome').eq('id', roleId).single()

      await logAction({
        acao: 'atribuir_cargo',
        modulo: 'usuarios',
        descricao: `Cargo "${role?.nome}" atribuído a "${profile?.nome}"`,
        dados_novos: { userId, roleId, role: role?.nome, user: profile?.nome },
      })

      // Security event for role changes
      await supabase.from('security_events').insert({
        tipo: 'role_changed',
        severidade: 'high',
        descricao: `Cargo "${role?.nome}" atribuído a "${profile?.nome}"`,
        user_id: userId,
        metadata: { roleId, roleName: role?.nome },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useRemoveRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId)
      if (error) throw error

      const { data: profile } = await supabase.from('profiles').select('nome').eq('id', userId).single()
      const { data: role } = await supabase.from('roles').select('nome').eq('id', roleId).single()

      await logAction({
        acao: 'remover_cargo',
        modulo: 'usuarios',
        descricao: `Cargo "${role?.nome}" removido de "${profile?.nome}"`,
        dados_anteriores: { userId, roleId, role: role?.nome, user: profile?.nome },
      })

      await supabase.from('security_events').insert({
        tipo: 'role_changed',
        severidade: 'high',
        descricao: `Cargo "${role?.nome}" removido de "${profile?.nome}"`,
        user_id: userId,
        metadata: { roleId, roleName: role?.nome, action: 'remove' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

// Create a new user via Supabase Auth (admin only)
export function useCreateUser() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (params: { email: string; password: string; nome: string; roleId?: string }) => {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { nome: params.nome },
      })
      if (authError) throw authError

      // Wait for trigger to create profile, then update nome
      // The trigger creates the profile automatically
      // We may need to wait briefly for it
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get the profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', authData.user.id)
        .single()

      // Assign role if provided
      if (profile && params.roleId) {
        await supabase.from('user_roles').insert({
          user_id: profile.id,
          role_id: params.roleId,
        })
      }

      await logAction({
        acao: 'criar',
        modulo: 'usuarios',
        descricao: `Usuário "${params.nome}" (${params.email}) criado`,
        dados_novos: { email: params.email, nome: params.nome },
      })

      return authData
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
