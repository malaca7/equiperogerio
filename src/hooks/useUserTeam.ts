import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface UserTeamInfo {
  teamId: string | null
  isRestricted: boolean
  teamIds: string[]
  teamMemberIds: string[] // List of physical employee IDs in user's team(s)
  funcionarioId?: string
}

export function useUserTeam() {
  const { user } = useAuth()
  
  return useQuery<UserTeamInfo>({
    queryKey: ['user-team', user?.profile?.id],
    queryFn: async () => {
      if (!user) return { teamId: null, isRestricted: false, teamIds: [], teamMemberIds: [] }

      // Get highest hierarchy level
      const maxNivel = Math.max(...user.roles.map(r => r.nivel), 0)

      // Get teams for this exact user profile ID
      const { data: encResult } = await supabase
        .from('equipe_encarregados')
        .select('equipe_id')
        .eq('user_id', user.profile.id)

      const teamIds = (encResult || []).map((t: any) => t.equipe_id)
      
      // Get the ENCARREGADO role level from database (fallback to 50 if not present)
      const { data: encRole } = await supabase
        .from('roles')
        .select('nivel')
        .eq('nome', 'ENCARREGADO')
        .maybeSingle()
      
      const encarregadoLevel = encRole ? encRole.nivel : 50
      
      // Check if user has an unrestricted administrative/supervisor role (level >= 80)
      const hasUnrestrictedRole = user.roles.some(r => 
        r.nivel >= 80 || r.nivel > encarregadoLevel
      )

      // The user is restricted IF they are designated to at least one team,
      // AND they do NOT have an unrestricted role,
      // OR if they have a low-level role (level <= encarregadoLevel)
      const isRestricted = !hasUnrestrictedRole && (teamIds.length > 0 || maxNivel <= encarregadoLevel)

      if (!isRestricted) {
        return { teamId: null, isRestricted: false, teamIds: [], teamMemberIds: [] }
      }

      if (teamIds.length === 0) {
        return { teamId: 'none', isRestricted: true, teamIds: [], teamMemberIds: [] }
      }

      // Fetch all member IDs for these teams
      const { data: membersResult } = await supabase
        .from('equipe_membros')
        .select('funcionario_id')
        .in('equipe_id', teamIds)

      const memberIds = (membersResult || []).map((m: any) => m.funcionario_id)
      const uniqueMemberIds = Array.from(new Set(memberIds))

      return {
        teamId: teamIds[0],
        isRestricted: true,
        teamIds,
        teamMemberIds: uniqueMemberIds
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
