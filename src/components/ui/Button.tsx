import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon'
  size?: 'sm' | 'md' | 'lg' | 'icon'
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
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    destructive:
      'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all duration-200 disabled:opacity-50 shadow-card-md',
    icon: 'btn-icon',
  }

  const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: '',
    lg: 'px-6 py-4 text-base',
    icon: 'w-10 h-10 p-0',
  }

  return (
    <button
      className={cn(
        variantClasses[variant],
        size !== 'md' && sizeClasses[size],
        loading && 'opacity-70 pointer-events-none',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
