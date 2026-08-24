import React from 'react'
import { cn } from '../../lib/utils'

export interface FuncionarioNameProps {
  nome: string
  apelido?: string | null
  className?: string
  nicknameClassName?: string
  nameClassName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  uppercase?: boolean
  inline?: boolean
}

export function FuncionarioName({
  nome,
  apelido,
  className,
  nicknameClassName,
  nameClassName,
  size = 'sm',
  uppercase = false,
  inline = false,
}: FuncionarioNameProps) {
  const cleanApelido = apelido?.trim() || ''
  const cleanNome = nome?.trim() || ''
  const hasApelido = Boolean(
    cleanApelido && cleanApelido.toLowerCase() !== cleanNome.toLowerCase()
  )

  const displayApelido = uppercase ? cleanApelido.toUpperCase() : cleanApelido
  const displayNome = uppercase ? cleanNome.toUpperCase() : cleanNome

  const mainSizeClass = {
    xs: 'text-xs',
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-lg font-bold',
  }[size]

  const subSizeClass = {
    xs: 'text-[10px]',
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size]

  if (inline) {
    if (hasApelido) {
      return (
        <span className={cn('inline-flex items-baseline gap-1.5 min-w-0', className)}>
          <span className={cn(mainSizeClass, 'text-foreground truncate', nicknameClassName)}>
            {displayApelido}
          </span>
          <span className={cn(subSizeClass, 'text-muted-foreground font-normal truncate', nameClassName)}>
            ({displayNome})
          </span>
        </span>
      )
    }
    return (
      <span className={cn(mainSizeClass, 'text-foreground truncate', className)}>
        {displayNome}
      </span>
    )
  }

  if (hasApelido) {
    return (
      <div className={cn('flex flex-col justify-center leading-tight min-w-0', className)}>
        <span className={cn(mainSizeClass, 'text-foreground truncate', nicknameClassName)}>
          {displayApelido}
        </span>
        <span className={cn(subSizeClass, 'text-muted-foreground font-normal truncate leading-tight', nameClassName)}>
          {displayNome}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col justify-center leading-tight min-w-0', className)}>
      <span className={cn(mainSizeClass, 'text-foreground truncate', nicknameClassName)}>
        {displayNome}
      </span>
    </div>
  )
}
