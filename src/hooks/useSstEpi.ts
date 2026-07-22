import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAudit } from './useAudit'

export interface SstEpiRequest {
  id: string
  funcionario_id: string
  produto_id: string
  quantidade: number
  solicitante_id: string
  justificativa: string
  tamanho: string | null
  status: 'pendente' | 'aprovada' | 'entregue' | 'rejeitada' | 'cancelada'
  motivo_rejeicao: string | null
  aprovador_id: string | null
  data_aprovacao: string | null
  entregue_por_id: string | null
  data_entrega: string | null
  cautela_id: string | null
  created_at: string
  updated_at: string
  // Joins
  funcionario?: { id: string; nome: string } | null
  produto?: { id: string; nome: string; codigo_interno: string | null; controle_ca: boolean } | null
  solicitante?: { id: string; nome: string } | null
  aprovador?: { id: string; nome: string } | null
  entregue_por?: { id: string; nome: string } | null
}

const SST_EPI_KEY = ['sst-epi-requests']

export function useSstEpiRequests(filters?: { status?: string; funcionarioId?: string }) {
  return useQuery<SstEpiRequest[]>({
    queryKey: [...SST_EPI_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from('sst_solicitacoes_epi')
        .select(`
          *,
          funcionario:funcionarios(id, nome),
          produto:estoque_produtos(id, nome, codigo_interno, controle_ca),
          solicitante:profiles!solicitante_id(id, nome),
          aprovador:profiles!aprovador_id(id, nome),
          entregue_por:profiles!entregue_por_id(id, nome)
        `)
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.funcionarioId) {
        query = query.eq('funcionario_id', filters.funcionarioId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as SstEpiRequest[]
    }
  })
}

export function useCreateSstEpiRequest() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async (nova: Partial<SstEpiRequest>) => {
      const { data, error } = await supabase
        .from('sst_solicitacoes_epi')
        .insert(nova)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'criar',
        modulo: 'sst_solicitacoes_epi',
        descricao: `Nova solicitação de EPI registrada para o funcionário selecionado.`,
        dados_novos: data as any,
      })

      return data as SstEpiRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SST_EPI_KEY })
    }
  })
}

export function useUpdateSstEpiRequestStatus() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      motivoRejeicao,
      aprovadorId
    }: {
      id: string
      status: 'aprovada' | 'rejeitada' | 'cancelada'
      motivoRejeicao?: string
      aprovadorId: string
    }) => {
      const updates: Partial<SstEpiRequest> = {
        status,
        aprovador_id: aprovadorId,
        data_aprovacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      if (status === 'rejeitada' && motivoRejeicao) {
        updates.motivo_rejeicao = motivoRejeicao
      }

      const { data, error } = await supabase
        .from('sst_solicitacoes_epi')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await logAction({
        acao: 'editar',
        modulo: 'sst_solicitacoes_epi',
        descricao: `Solicitação de EPI #${id} alterada para status: ${status}.`,
        dados_novos: data as any,
      })

      return data as SstEpiRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SST_EPI_KEY })
    }
  })
}

export function useDeliverSstEpiRequest() {
  const qc = useQueryClient()
  const { logAction } = useAudit()
  return useMutation({
    mutationFn: async ({
      requestId,
      localOrigemId,
      entreguePorId,
      assinaturaDigital,
      fotoEntrega,
      usuarioId
    }: {
      requestId: string
      localOrigemId: string
      entreguePorId: string
      assinaturaDigital?: string
      fotoEntrega?: string
      usuarioId: string
    }) => {
      // 1. Obter os dados da solicitação
      const { data: request, error: reqError } = await supabase
        .from('sst_solicitacoes_epi')
        .select('*, produto:estoque_produtos(valor_unitario_atual)')
        .eq('id', requestId)
        .single()
      if (reqError) throw reqError

      const valorUnitario = request.produto?.valor_unitario_atual || 0
      const valorTotal = valorUnitario * request.quantidade

      // 2. Criar a movimentação de estoque de saída por doação de EPI
      const { data: mov, error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          tipo: 'saida',
          subtipo: 'doacao_epi',
          produto_id: request.produto_id,
          local_origem_id: localOrigemId,
          quantidade: request.quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          funcionario_id: null, // funcionario_id em movimentacoes aponta para profiles
          usuario_id: usuarioId, // Almoxarife/Usuário que lançou no sistema
          observacao: `EPI Entregue via Solicitação #${requestId}. Justificativa: ${request.justificativa}`,
          data_movimentacao: new Date().toISOString()
        })
        .select()
        .single()
      if (movError) throw movError

      // 3. Criar a Cautela vinculada a essa movimentação
      const { data: cautela, error: cautelaError } = await supabase
        .from('estoque_cautelas')
        .insert({
          tipo: 'epi',
          movimentacao_id: mov.id,
          funcionario_id: null, // aponta para profiles
          colaborador_id: request.funcionario_id, // colaborador_id em cautelas aponta para funcionarios
          produto_id: request.produto_id,
          quantidade: request.quantidade,
          data_entrega: new Date().toISOString(),
          status: 'ativo',
          assinatura_digital: assinaturaDigital || null,
          foto_entrega: fotoEntrega || null,
          termo_gerado: true
        })
        .select()
        .single()
      if (cautelaError) throw cautelaError

      // 4. Atualizar a solicitação de EPI para 'entregue'
      const { data: updatedRequest, error: updateError } = await supabase
        .from('sst_solicitacoes_epi')
        .update({
          status: 'entregue',
          entregue_por_id: entreguePorId,
          data_entrega: new Date().toISOString(),
          cautela_id: cautela.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single()
      if (updateError) throw updateError

      await logAction({
        acao: 'editar',
        modulo: 'sst_solicitacoes_epi',
        descricao: `EPI da Solicitação #${requestId} entregue, Cautela #${cautela.id} gerada com sucesso.`,
        dados_novos: updatedRequest as any,
      })

      return updatedRequest as SstEpiRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SST_EPI_KEY })
      qc.invalidateQueries({ queryKey: ['estoque-cautelas'] })
      qc.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
    }
  })
}
