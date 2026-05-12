import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { FrequenciaStatus, EscalaTipo } from './database.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ptBR })
}

export function formatDateRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd 'de' MMMM", { locale: ptBR })
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return '--:--'
  return time.substring(0, 5)
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export const frequenciaStatusLabel: Record<FrequenciaStatus, string> = {
  presente: 'Presente',
  falta: 'Falta',
  atestado: 'Atestado',
  folga: 'Folga',
  hora_extra: 'Hora Extra',
  ferias: 'Férias',
}

export const frequenciaStatusColor: Record<FrequenciaStatus, string> = {
  presente: 'badge-present',
  falta: 'badge-absent',
  atestado: 'badge-medical',
  folga: 'badge-off',
  hora_extra: 'badge-extra',
  ferias: 'badge-vacation',
}

export const escalaTipoLabel: Record<EscalaTipo, string> = {
  presente: 'Presente (X)',
  falta: 'Falta',
  falta_justificada: 'Falta Justificada',
  suspensao: 'Suspensão',
  atestado: 'Atestado',
  paternidade: 'Paternidade',
  obito_familiar: 'Óbito Familiar',
  beneficio: 'Benefício',
  repouso: 'Repouso',
  compensar: 'Compensar',
  ferias: 'Férias',
  transferencia: 'Transferência',
}

export const escalaTipoColor: Record<EscalaTipo, string> = {
  presente: '#22c55e',
  falta: '#ef4444',
  falta_justificada: '#f59e0b',
  suspensao: '#7f1d1d',
  atestado: '#eab308',
  paternidade: '#3b82f6',
  obito_familiar: '#1e293b',
  beneficio: '#8b5cf6',
  repouso: '#10b981',
  compensar: '#0ea5e9',
  ferias: '#14b8a6',
  transferencia: '#6b7280',
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}
