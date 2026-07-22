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
  const base = 'inline-flex items-center justify-center gap-2 font-bold font-sans cursor-pointer select-none transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden'

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground rounded-xl shadow-[0_4px_14px_hsl(var(--primary)/0.35)] hover:shadow-[0_6px_20px_hsl(var(--primary)/0.45)] hover:-translate-y-px',
    secondary:
      'bg-secondary text-secondary-foreground border border-border rounded-xl hover:bg-muted',
    ghost:
      'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl',
    destructive:
      'bg-destructive text-destructive-foreground rounded-xl shadow-[0_4px_14px_hsl(0_84%_58%/0.3)] hover:shadow-[0_6px_20px_hsl(0_84%_58%/0.4)] hover:-translate-y-px',
    icon:
      'bg-transparent text-foreground rounded-xl hover:bg-muted',
    outline:
      'bg-transparent border border-border text-foreground hover:bg-muted rounded-xl',
  }

  const sizes: Record<string, string> = {
    xs: 'h-7 px-2.5 text-[10px] tracking-wide uppercase rounded-lg',
    sm: 'h-8 px-3.5 text-xs tracking-wide',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-sm tracking-wide',
    icon: 'w-10 h-10 p-0 rounded-xl',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], loading && 'opacity-70 pointer-events-none', className)}
      disabled={disabled || loading}
      {...props}
    >
      {/* Shine overlay on primary/destructive */}
      {(variant === 'primary' || variant === 'destructive') && (
        <span className="absolute inset-0 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
      )}
      {loading && (
        <svg className="animate-spin w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}
