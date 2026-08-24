/**
 * Search Utilities for 7Locar Platform
 * Provides accent-insensitive, case-insensitive employee searching by name, nickname (apelido), cargo, sector, etc.
 */

export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export interface SearchableEmployee {
  nome?: string | null
  apelido?: string | null
  cargo?: string | null
  setor?: string | null
  matricula?: string | null
  cpf?: string | null
}

/**
 * Checks if an employee matches a given search query by checking:
 * - Full Name (Nome)
 * - Nickname (Apelido)
 * - Job Title (Cargo)
 * - Department/Sector (Setor)
 * - Registration ID (Matrícula)
 * 
 * Supports accent-insensitive search (e.g. "joao" matches "João").
 */
export function matchEmployeeSearch(
  emp: SearchableEmployee,
  searchTerm: string
): boolean {
  if (!searchTerm || !searchTerm.trim()) return true
  const normTerm = normalizeSearchText(searchTerm)
  if (!normTerm) return true

  const normNome = normalizeSearchText(emp.nome)
  const normApelido = normalizeSearchText(emp.apelido)
  const normCargo = normalizeSearchText(emp.cargo)
  const normSetor = normalizeSearchText(emp.setor)
  const normMatricula = normalizeSearchText(emp.matricula)

  return (
    normNome.includes(normTerm) ||
    normApelido.includes(normTerm) ||
    normCargo.includes(normTerm) ||
    normSetor.includes(normTerm) ||
    normMatricula.includes(normTerm)
  )
}
