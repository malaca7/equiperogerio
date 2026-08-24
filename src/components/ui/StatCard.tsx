import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  loading?: boolean
  onClick?: () => void
}

const variantStyles: Record<NonNullable<StatCardProps['variant']>, {
  card: string
  iconBg: string
  iconColor: string
}> = {
  default: {
    card: 'border-border/60 bg-card hover:border-border',
    iconBg: 'bg-muted text-muted-foreground',
    iconColor: 'text-muted-foreground',
  },
  primary: {
    card: 'border-primary/20 bg-primary/5 hover:border-primary/40',
    iconBg: 'bg-primary/10 text-primary',
    iconColor: 'text-primary',
  },
  success: {
    card: 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-500',
    iconColor: 'text-emerald-500',
  },
  warning: {
    card: 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-500',
    iconColor: 'text-amber-500',
  },
  danger: {
    card: 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40',
    iconBg: 'bg-rose-500/10 text-rose-500',
    iconColor: 'text-rose-500',
  },
  info: {
    card: 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10 text-blue-500',
    iconColor: 'text-blue-500',
  },
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  loading = false,
  onClick,
}: StatCardProps) {
  const styles = variantStyles[variant]

  if (loading) {
    return (
      <div className={cn('relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all animate-pulse bg-card/60', className)}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted"></div>
          <div className="h-10 w-10 rounded-lg bg-muted"></div>
        </div>
        <div className="mt-4 h-8 w-20 rounded bg-muted"></div>
        <div className="mt-2 h-3 w-32 rounded bg-muted"></div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        styles.card,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105', styles.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {value}
        </span>
        {trend && (
          <div
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5',
              trend.isPositive === true
                ? 'bg-emerald-500/10 text-emerald-500'
                : trend.isPositive === false
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {trend.isPositive === true ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend.isPositive === false ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      {(description || trend?.label) && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {description || trend?.label}
        </p>
      )}
    </div>
  )
}
