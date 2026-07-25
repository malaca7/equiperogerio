// Localidades de trabalho organizadas por setor
export interface Localidade {
  id: string
  nome: string
  setor: string
  equipe_id?: string | null
  dias_operacionais?: 'segunda_sabado' | 'domingo_feriado' | 'todos'
}

export const LOCALIDADES: Localidade[] = [
  // Varrição
  { id: 'varr-suape',     nome: 'Suape',              setor: 'Varrição' },
  { id: 'varr-laura',     nome: 'Av Laura Cavalcante', setor: 'Varrição' },
  { id: 'varr-enseadas',  nome: 'Enseadas',           setor: 'Varrição' },
  { id: 'varr-itapuama',  nome: 'Itapuama',           setor: 'Varrição' },
  { id: 'varr-estrada',   nome: 'Estrada Velha',      setor: 'Varrição' },
  { id: 'varr-anel',      nome: 'Anel Viário',        setor: 'Varrição' },
  { id: 'varr-xareu',     nome: 'Xaréu',              setor: 'Varrição' },
  { id: 'varr-pe28',      nome: 'PE-28 Gaibu',        setor: 'Varrição' },
  // Orla
  { id: 'orla-gaibu',     nome: 'Gaibu',              setor: 'Orla' },
  { id: 'orla-itapuama',  nome: 'Itapuama',           setor: 'Orla' },
  { id: 'orla-suape',     nome: 'Suape',              setor: 'Orla' },
  // Porta a Porta
  { id: 'pap-definir',    nome: 'A Definir',           setor: 'Porta a Porta' },
]

export const SETORES = ['Varrição', 'Orla', 'Porta a Porta'] as const

export function getLocalidadesBySetor(setor: string): Localidade[] {
  return LOCALIDADES.filter(l => l.setor === setor)
}

export function getLocalidadeNome(id: string): string {
  return LOCALIDADES.find(l => l.id === id)?.nome || ''
}
