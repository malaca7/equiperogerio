import React from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'present' | 'absent' | 'medical' | 'off' | 'extra' | 'vacation' | 'success' | 'warning' | 'error'
  className?: string
}

const variantClasses = {
  default: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  present: 'badge-present',
  absent: 'badge-absent',
  medical: 'badge-medical',
  off: 'badge-off',
  extra: 'badge-extra',
  vacation: 'badge-vacation',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', variantClasses[variant], className)}>
      {children}
    </span>
  )
}
