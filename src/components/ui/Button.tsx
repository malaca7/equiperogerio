import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium font-sans cursor-pointer select-none transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none'

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
    secondary:
      'bg-card text-foreground border border-border shadow-sm hover:bg-secondary',
    ghost:
      'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg',
    destructive:
      'bg-destructive text-destructive-foreground rounded-lg hover:opacity-90',
    icon:
      'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg',
    outline:
      'bg-transparent border border-border text-foreground hover:bg-muted rounded-lg',
  }

  const sizes: Record<string, string> = {
    xs: 'h-7 px-2.5 text-[11px] rounded-md',
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-9 px-4 text-xs rounded-lg',
    lg: 'h-11 px-5 text-sm rounded-lg',
    icon: 'w-8 h-8 p-0 rounded-lg',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], loading && 'opacity-60 pointer-events-none', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span className="flex items-center gap-2">{children}</span>
    </button>
  )
}
