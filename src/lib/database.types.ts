export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      funcionarios: {
        Row: {
          id: string
          nome: string
          apelido: string | null
          matricula: string
          telefone: string | null
          cargo: string
          setor: string
          status: 'ativo' | 'inativo'
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          apelido?: string | null
          matricula: string
          telefone?: string | null
          cargo: string
          setor: string
          status?: 'ativo' | 'inativo'
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          apelido?: string | null
          matricula?: string
          telefone?: string | null
          cargo?: string
          setor?: string
          status?: 'ativo' | 'inativo'
          deleted_at?: string | null
          updated_at?: string
        }
      }
      frequencia: {
        Row: {
          id: string
          funcionario_id: string
          data: string
          entrada: string | null
          saida: string | null
          status: 'presente' | 'falta' | 'atestado' | 'folga' | 'hora_extra' | 'ferias'
          hora_extra: number | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          data: string
          entrada?: string | null
          saida?: string | null
          status: 'presente' | 'falta' | 'atestado' | 'folga' | 'hora_extra' | 'ferias'
          hora_extra?: number | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          data?: string
          entrada?: string | null
          saida?: string | null
          status?: 'presente' | 'falta' | 'atestado' | 'folga' | 'hora_extra' | 'ferias'
          hora_extra?: number | null
          observacoes?: string | null
          updated_at?: string
        }
      }
      escalas: {
        Row: {
          id: string
          funcionario_id: string
          data: string
          tipo: string
          turno: 'manha' | 'tarde' | 'noite' | 'integral' | null
          localidade: string | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          data: string
          tipo: string
          turno?: 'manha' | 'tarde' | 'noite' | 'integral' | null
          localidade?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          data?: string
          tipo?: string
          turno?: 'manha' | 'tarde' | 'noite' | 'integral' | null
          localidade?: string | null
          observacoes?: string | null
          updated_at?: string
        }
      }
      notificacoes: {
        Row: {
          id: string
          titulo: string
          descricao: string
          tipo: 'falta' | 'escala' | 'atestado' | 'info' | 'alerta'
          visualizada: boolean
          created_at: string
        }
        Insert: {
          id?: string
          titulo: string
          descricao: string
          tipo: 'falta' | 'escala' | 'atestado' | 'info' | 'alerta'
          visualizada?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          titulo?: string
          descricao?: string
          tipo?: 'falta' | 'escala' | 'atestado' | 'info' | 'alerta'
          visualizada?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Funcionario = Database['public']['Tables']['funcionarios']['Row']
export type FuncionarioInsert = Database['public']['Tables']['funcionarios']['Insert']
export type FuncionarioUpdate = Database['public']['Tables']['funcionarios']['Update']

export type Frequencia = Database['public']['Tables']['frequencia']['Row']
export type FrequenciaInsert = Database['public']['Tables']['frequencia']['Insert']
export type FrequenciaUpdate = Database['public']['Tables']['frequencia']['Update']

export type Escala = Database['public']['Tables']['escalas']['Row']
export type EscalaInsert = Database['public']['Tables']['escalas']['Insert']
export type EscalaUpdate = Database['public']['Tables']['escalas']['Update']

export type Notificacao = Database['public']['Tables']['notificacoes']['Row']
export type NotificacaoInsert = Database['public']['Tables']['notificacoes']['Insert']

export type FrequenciaStatus = Frequencia['status']
export type EscalaTipo = Escala['tipo']
export type EscalaTurno = Escala['turno']
export type FuncionarioStatus = Funcionario['status']
