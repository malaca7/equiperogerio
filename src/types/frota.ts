export interface Veiculo {
  id: string
  placa: string
  tipo_veiculo: 'carro' | 'moto' | 'caminhao' | 'cacamba' | 'compactador' | 'trator' | 'escavadeira' | 'outro'
  modelo: string
  marca: string
  ano: number | null
  km_atual: number
  km_proxima_troca_oleo: number
  media_km_diaria: number
  usuario_responsavel_id: string | null
  status: 'ativo' | 'manutencao' | 'inativo'
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface RegistroDiario {
  id: string
  veiculo_id: string
  usuario_id: string
  data: string
  km_inicial: number
  km_final: number | null
  trajeto?: string | null
  foto_hodometro?: string | null
  foto_hodometro_inicial?: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Abastecimento {
  id: string
  veiculo_id: string
  usuario_id: string
  data: string
  litros: number
  valor_total: number
  km_no_momento: number
  posto: string | null
  comprovante_url: string | null
  created_at: string
}

export interface Manutencao {
  id: string
  veiculo_id: string
  usuario_id: string
  data: string
  tipo: 'troca_oleo' | 'preventiva' | 'corretiva'
  descricao: string
  valor: number | null
  km_no_momento: number
  oficina: string | null
  comprovante_url: string | null
  proxima_troca_km: number | null
  created_at: string
}
