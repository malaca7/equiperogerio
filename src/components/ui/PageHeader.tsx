import React from 'react'
import { cn } from '../../lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}

      {children}
    </div>
  )
}
