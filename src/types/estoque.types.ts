// ============================================================================
// ESTOQUE TYPES — Sistema Corporativo Multirregiões v2
// ============================================================================

export interface EstoqueRegiao {
  id: string
  nome: string
  codigo?: string
  endereco?: string
  responsavel_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações
  responsavel?: { id: string; nome: string; avatar_url?: string }
}

export interface EstoquePermissaoRegiao {
  id: string
  usuario_id: string
  regiao_id: string
  nivel: 'admin' | 'gestor' | 'operador' | 'visualizador'
  created_at: string
  // Relações
  usuario?: { id: string; nome: string }
  regiao?: EstoqueRegiao
}

export interface EstoqueCategoria {
  id: string
  nome: string
  descricao?: string
  cor: string
  icone: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EstoqueFornecedor {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  email?: string
  telefone?: string
  endereco?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EstoqueLocal {
  id: string
  nome: string
  tipo: 'matriz' | 'filial' | 'obra' | 'veiculo'
  responsavel_id?: string
  regiao_id?: string
  endereco?: string
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações
  regiao?: EstoqueRegiao
}

export type TipoMaterial = 'epi' | 'ferramenta' | 'peca' | 'escritorio' | 'equipamento' | 'insumo' | 'geral'

export interface EstoqueProduto {
  id: string
  codigo_interno?: string
  codigo_barras?: string
  qrcode?: string
  nome: string
  descricao?: string
  categoria_id?: string
  unidade_medida: string
  marca?: string
  modelo?: string
  estoque_minimo: number
  estoque_maximo: number
  valor_unitario_atual: number
  foto_url?: string
  localizacao_fisica?: string
  tipo_material: TipoMaterial
  controle_lote: boolean
  controle_validade: boolean
  controle_ca: boolean
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações
  categoria?: EstoqueCategoria
}

export interface EstoqueSaldo {
  id: string
  produto_id: string
  local_id: string
  quantidade: number
  lote?: string
  validade?: string
  ultima_movimentacao: string
  // Relações
  produto?: EstoqueProduto
  local?: EstoqueLocal
}

export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste' | 'transferencia'
export type StatusAprovacao = 'pendente' | 'aprovado' | 'negado'

export interface EstoqueMovimentacao {
  id: string
  tipo: TipoMovimentacao
  subtipo: string
  produto_id: string
  local_origem_id?: string
  local_destino_id?: string
  quantidade: number
  valor_unitario?: number
  valor_total?: number
  nota_fiscal?: string
  fornecedor_id?: string
  funcionario_id?: string
  obra_id?: string
  veiculo_id?: string
  usuario_id: string
  regiao_id?: string
  foto_url?: string
  aprovado_por?: string
  status_aprovacao: StatusAprovacao
  observacao?: string
  data_movimentacao: string
  created_at: string
  // Relações
  produto?: EstoqueProduto
  local_origem?: EstoqueLocal
  local_destino?: EstoqueLocal
  fornecedor?: EstoqueFornecedor
  funcionario?: { id: string; nome: string; avatar_url?: string }
  usuario?: { id: string; nome: string; avatar_url?: string }
}

export type StatusCautela = 'ativo' | 'devolvido' | 'perdido' | 'danificado'

export interface EstoqueCautela {
  id: string
  tipo: 'epi' | 'ferramenta'
  movimentacao_id?: string
  funcionario_id?: string
  colaborador_id?: string
  produto_id: string
  quantidade: number
  data_entrega: string
  data_devolucao_prevista?: string
  data_devolucao_realizada?: string
  status: StatusCautela
  assinatura_digital?: string
  foto_entrega?: string
  foto_devolucao?: string
  termo_gerado: boolean
  created_at: string
  updated_at: string
  // Relações
  produto?: EstoqueProduto
  funcionario?: { id: string; nome: string; avatar_url?: string; cpf?: string }
  colaborador?: { id: string; nome: string; matricula?: string; cpf?: string }
}

export type StatusSolicitacao = 'pendente' | 'aprovada' | 'comprada' | 'negada' | 'cancelada'

export interface EstoqueSolicitacao {
  id: string
  produto_id: string
  local_id?: string
  quantidade_solicitada: number
  quantidade_aprovada?: number
  solicitante_id: string
  aprovador_id?: string
  status: StatusSolicitacao
  motivo?: string
  data_necessidade?: string
  created_at: string
  updated_at: string
  // Relações
  produto?: EstoqueProduto
  local?: EstoqueLocal
  solicitante?: { id: string; nome: string; avatar_url?: string }
  aprovador?: { id: string; nome: string; avatar_url?: string }
}

export type SeveridadeAlerta = 'info' | 'warning' | 'critical'

export interface EstoqueAlerta {
  id: string
  tipo: string
  produto_id?: string
  regiao_id?: string
  local_id?: string
  mensagem: string
  severidade: SeveridadeAlerta
  lido: boolean
  resolvido: boolean
  resolvido_por?: string
  resolvido_em?: string
  created_at: string
  // Relações
  produto?: EstoqueProduto
  regiao?: EstoqueRegiao
  local?: EstoqueLocal
}

export interface EstoqueAuditLog {
  id: string
  tabela: string
  registro_id: string
  acao: 'insert' | 'update' | 'delete'
  dados_anteriores?: Record<string, any>
  dados_novos?: Record<string, any>
  usuario_id?: string
  created_at: string
  // Relações
  usuario?: { id: string; nome: string }
}
