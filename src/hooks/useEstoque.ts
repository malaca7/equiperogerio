import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  EstoqueRegiao,
  EstoquePermissaoRegiao,
  EstoqueCategoria,
  EstoqueFornecedor,
  EstoqueLocal,
  EstoqueProduto,
  EstoqueSaldo,
  EstoqueMovimentacao,
  EstoqueCautela,
  EstoqueSolicitacao,
  EstoqueAlerta,
  EstoqueAuditLog
} from '../types/estoque.types'

const KEYS = {
  regioes: ['estoque-regioes'],
  permissoes: ['estoque-permissoes'],
  categorias: ['estoque-categorias'],
  fornecedores: ['estoque-fornecedores'],
  locais: ['estoque-locais'],
  produtos: ['estoque-produtos'],
  saldos: ['estoque-saldos'],
  movimentacoes: ['estoque-movimentacoes'],
  cautelas: ['estoque-cautelas'],
  solicitacoes: ['estoque-solicitacoes'],
  alertas: ['estoque-alertas'],
  auditLog: ['estoque-audit-log'],
}

// ============================================================================
// REGIÕES
// ============================================================================

export function useEstoqueRegioes() {
  return useQuery({
    queryKey: KEYS.regioes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_regioes')
        .select('*, responsavel:profiles!responsavel_id(id, nome, avatar_url)')
        .order('nome')
      if (error) throw error
      return data as EstoqueRegiao[]
    }
  })
}

export function useCreateEstoqueRegiao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nova: Partial<EstoqueRegiao>) => {
      const { data, error } = await supabase.from('estoque_regioes').insert(nova).select().single()
      if (error) throw error
      return data as EstoqueRegiao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.regioes })
  })
}

export function useUpdateEstoqueRegiao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EstoqueRegiao> }) => {
      const { data, error } = await supabase.from('estoque_regioes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as EstoqueRegiao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.regioes })
  })
}

// ============================================================================
// CATEGORIAS
// ============================================================================

export function useEstoqueCategorias() {
  return useQuery({
    queryKey: KEYS.categorias,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_categorias').select('*').order('nome')
      if (error) throw error
      return data as EstoqueCategoria[]
    }
  })
}

export function useCreateEstoqueCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nova: Partial<EstoqueCategoria>) => {
      const { data, error } = await supabase.from('estoque_categorias').insert(nova).select().single()
      if (error) throw error
      return data as EstoqueCategoria
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.categorias })
  })
}

// ============================================================================
// FORNECEDORES
// ============================================================================

export function useEstoqueFornecedores() {
  return useQuery({
    queryKey: KEYS.fornecedores,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_fornecedores').select('*').eq('ativo', true).order('razao_social')
      if (error) throw error
      return data as EstoqueFornecedor[]
    }
  })
}

// ============================================================================
// LOCAIS
// ============================================================================

export function useEstoqueLocais() {
  return useQuery({
    queryKey: KEYS.locais,
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_locais').select('*, regiao:estoque_regioes(id, nome, codigo)').order('nome')
      if (error) throw error
      return data as EstoqueLocal[]
    }
  })
}

export function useCreateEstoqueLocal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (novo: Partial<EstoqueLocal>) => {
      const { data, error } = await supabase.from('estoque_locais').insert(novo).select().single()
      if (error) throw error
      return data as EstoqueLocal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.locais })
  })
}

export function useUpdateEstoqueLocal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EstoqueLocal> }) => {
      const { data, error } = await supabase.from('estoque_locais').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as EstoqueLocal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.locais })
  })
}

export function useDeleteEstoqueLocal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('estoque_locais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.locais })
  })
}


// ============================================================================
// PRODUTOS
// ============================================================================

export function useEstoqueProdutos() {
  return useQuery({
    queryKey: KEYS.produtos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_produtos')
        .select('*, categoria:estoque_categorias(*)')
        .order('nome')
      if (error) throw error
      return data as EstoqueProduto[]
    }
  })
}

export function useCreateEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (novo: Partial<EstoqueProduto>) => {
      const { data, error } = await supabase.from('estoque_produtos').insert(novo).select().single()
      if (error) throw error
      return data as EstoqueProduto
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.produtos })
  })
}

export function useUpdateEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EstoqueProduto> }) => {
      const { data, error } = await supabase.from('estoque_produtos').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as EstoqueProduto
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.produtos })
  })
}

export function useDeleteEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('estoque_produtos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.produtos })
  })
}

// ============================================================================
// SALDOS
// ============================================================================

export function useEstoqueSaldos() {
  return useQuery({
    queryKey: KEYS.saldos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_saldos')
        .select('*, produto:estoque_produtos(*, categoria:estoque_categorias(*)), local:estoque_locais(*, regiao:estoque_regioes(id, nome))')
      if (error) throw error
      return data as EstoqueSaldo[]
    }
  })
}

// ============================================================================
// MOVIMENTAÇÕES
// ============================================================================

export function useEstoqueMovimentacoes(limit = 200) {
  return useQuery({
    queryKey: [...KEYS.movimentacoes, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          *,
          produto:estoque_produtos(*, categoria:estoque_categorias(*)),
          local_origem:estoque_locais!local_origem_id(*),
          local_destino:estoque_locais!local_destino_id(*),
          usuario:profiles!usuario_id(id, nome)
        `)
        .order('data_movimentacao', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as EstoqueMovimentacao[]
    }
  })
}

export function useCreateEstoqueMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nova: Partial<EstoqueMovimentacao>) => {
      const { data, error } = await supabase.from('estoque_movimentacoes').insert(nova).select().single()
      if (error) throw error
      return data as EstoqueMovimentacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.movimentacoes })
      qc.invalidateQueries({ queryKey: KEYS.saldos })
      qc.invalidateQueries({ queryKey: KEYS.produtos })
      qc.invalidateQueries({ queryKey: KEYS.alertas })
    }
  })
}

// ============================================================================
// CAUTELAS
// ============================================================================

export function useEstoqueCautelas() {
  return useQuery({
    queryKey: KEYS.cautelas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_cautelas')
        .select(`*, produto:estoque_produtos(*, categoria:estoque_categorias(*)), funcionario:profiles!funcionario_id(id, nome, avatar_url, cpf), colaborador:funcionarios!colaborador_id(id, nome, matricula, cpf)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EstoqueCautela[]
    }
  })
}

export function useCreateEstoqueCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nova: Partial<EstoqueCautela>) => {
      const { data, error } = await supabase.from('estoque_cautelas').insert(nova).select().single()
      if (error) throw error
      return data as EstoqueCautela
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.cautelas })
  })
}

export function useUpdateEstoqueCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EstoqueCautela> }) => {
      const { data, error } = await supabase.from('estoque_cautelas').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as EstoqueCautela
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.cautelas })
  })
}

// ============================================================================
// SOLICITAÇÕES
// ============================================================================

export function useEstoqueSolicitacoes() {
  return useQuery({
    queryKey: KEYS.solicitacoes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_solicitacoes')
        .select(`*, produto:estoque_produtos(*, categoria:estoque_categorias(*)), local:estoque_locais(*), solicitante:profiles!solicitante_id(id, nome, avatar_url), aprovador:profiles!aprovador_id(id, nome, avatar_url)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EstoqueSolicitacao[]
    }
  })
}

export function useCreateEstoqueSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nova: Partial<EstoqueSolicitacao>) => {
      const { data, error } = await supabase.from('estoque_solicitacoes').insert(nova).select().single()
      if (error) throw error
      return data as EstoqueSolicitacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.solicitacoes })
  })
}

export function useUpdateEstoqueSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EstoqueSolicitacao> }) => {
      const { data, error } = await supabase.from('estoque_solicitacoes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as EstoqueSolicitacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.solicitacoes })
  })
}

// ============================================================================
// ALERTAS
// ============================================================================

export function useEstoqueAlertas() {
  return useQuery({
    queryKey: KEYS.alertas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_alertas')
        .select('*, produto:estoque_produtos(id, nome, codigo_interno), regiao:estoque_regioes(id, nome), local:estoque_locais(id, nome)')
        .eq('resolvido', false)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as EstoqueAlerta[]
    }
  })
}

export function useResolveEstoqueAlerta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase.from('estoque_alertas').update({ resolvido: true, resolvido_por: userId, resolvido_em: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.alertas })
  })
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export function useEstoqueAuditLog(limit = 100) {
  return useQuery({
    queryKey: [...KEYS.auditLog, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_audit_log')
        .select('*, usuario:profiles!usuario_id(id, nome)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as EstoqueAuditLog[]
    }
  })
}
