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
    xs: 'text-xs font-black tracking-tight',
    sm: 'text-sm font-black tracking-tight',
    md: 'text-base font-black tracking-tight',
    lg: 'text-lg font-black tracking-tight',
  }[size]

  const subSizeClass = {
    xs: 'text-[9.5px] font-medium opacity-75',
    sm: 'text-[10.5px] font-medium opacity-75',
    md: 'text-xs font-medium opacity-75',
    lg: 'text-sm font-medium opacity-75',
  }[size]

  if (inline) {
    if (hasApelido) {
      return (
        <span className={cn('inline-flex items-baseline gap-1.5 min-w-0', className)}>
          <span className={cn(mainSizeClass, 'text-foreground truncate drop-shadow-xs', nicknameClassName)}>
            {displayApelido}
          </span>
          <span className={cn(subSizeClass, 'text-muted-foreground truncate', nameClassName)}>
            ({displayNome})
          </span>
        </span>
      )
    }
    return (
      <span className={cn(mainSizeClass, 'text-foreground truncate font-black', className)}>
        {displayNome}
      </span>
    )
  }

  if (hasApelido) {
    return (
      <div className={cn('flex flex-col justify-center leading-tight min-w-0', className)}>
        <span className={cn(mainSizeClass, 'text-foreground truncate leading-snug drop-shadow-xs', nicknameClassName)}>
          {displayApelido}
        </span>
        <span className={cn(subSizeClass, 'text-muted-foreground truncate leading-none mt-0.5', nameClassName)}>
          {displayNome}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col justify-center leading-tight min-w-0', className)}>
      <span className={cn(mainSizeClass, 'text-foreground truncate font-black', nicknameClassName)}>
        {displayNome}
      </span>
    </div>
  )
}
