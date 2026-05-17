import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/auth.types'
import { useAudit } from './useAudit'

const ROLES_KEY = ['roles']

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('nivel', { ascending: false })
      if (error) throw error
      return data as Role[]
    },
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (role: { nome: string; descricao?: string; cor?: string; nivel?: number }) => {
      const { data, error } = await supabase
        .from('roles')
        .insert(role)
        .select()
        .single()
      if (error) throw error
      await logAction({
        acao: 'criar',
        modulo: 'cargos',
        descricao: `Cargo "${role.nome}" criado`,
        dados_novos: role,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Partial<Role> }) => {
      // Get old data for audit
      const { data: oldData } = await supabase.from('roles').select('*').eq('id', id).single()

      const { data, error } = await supabase
        .from('roles')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'editar',
        modulo: 'cargos',
        descricao: `Cargo "${data.nome}" editado`,
        dados_anteriores: oldData,
        dados_novos: updateData,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: oldData } = await supabase.from('roles').select('*').eq('id', id).single()

      const { error } = await supabase.from('roles').delete().eq('id', id)
      if (error) throw error

      await logAction({
        acao: 'excluir',
        modulo: 'cargos',
        descricao: `Cargo "${oldData?.nome}" excluído`,
        dados_anteriores: oldData,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDuplicateRole() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (sourceId: string) => {
      // Get source role with permissions
      const { data: source } = await supabase.from('roles').select('*').eq('id', sourceId).single()
      if (!source) throw new Error('Cargo não encontrado')

      // Create copy
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          nome: `${source.nome} (Cópia)`,
          descricao: source.descricao,
          cor: source.cor,
          nivel: source.nivel,
          ativo: true,
        })
        .select()
        .single()
      if (createError) throw createError

      // Copy permissions
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', sourceId)

      if (perms && perms.length > 0) {
        const inserts = perms.map(p => ({
          role_id: newRole.id,
          permission_id: p.permission_id,
        }))
        await supabase.from('role_permissions').insert(inserts)
      }

      await logAction({
        acao: 'duplicar',
        modulo: 'cargos',
        descricao: `Cargo "${source.nome}" duplicado como "${newRole.nome}"`,
        dados_novos: newRole,
      })

      return newRole
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}
