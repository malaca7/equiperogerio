import React from 'react'
import { cn } from '../../lib/utils'

export type StatusVariant = 'present' | 'absent' | 'warning' | 'info' | 'neutral' | 'purple'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant
  pulse?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<StatusVariant, string> = {
  present: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  absent: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  purple: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
}

const dotStyles: Record<StatusVariant, string> = {
  present: 'bg-emerald-500',
  absent: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  neutral: 'bg-muted-foreground',
  purple: 'bg-violet-500',
}

export function StatusBadge({
  variant = 'neutral',
  pulse = false,
  icon,
  children,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                dotStyles[variant]
              )}
            />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotStyles[variant])} />
        </span>
      )}
      <span>{children}</span>
    </span>
  )
}
