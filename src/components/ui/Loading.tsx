import React from 'react'
import { cn } from '../../lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullscreen?: boolean
  /** Use the bouncing dots variant instead of spinner */
  variant?: 'spinner' | 'dots'
}

export function Loading({ size = 'md', text, fullscreen = false, variant = 'dots' }: LoadingProps) {
  const spinnerSize = { sm: 'w-5 h-5', md: 'w-9 h-9', lg: 'w-14 h-14' }
  const trackSize  = { sm: 'border-2', md: 'border-[2.5px]', lg: 'border-[3px]' }
  const dotSize    = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }

  const dotsContent = (
    <div className={cn('flex flex-col items-center justify-center gap-6', !fullscreen && 'py-12')}>
      {/* Bouncing Dots */}
      <div className="flex items-end gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn(
              dotSize[size],
              'rounded-full bg-primary shadow-lg'
            )}
            style={{
              animation: `bounce-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
              boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)',
            }}
          />
        ))}
      </div>

      {text && (
        <p className={cn(
          'font-bold uppercase tracking-widest text-muted-foreground animate-pulse',
          size === 'lg' ? 'text-xs' : 'text-[10px]'
        )}>
          {text}
        </p>
      )}

      {/* Keyframes injected inline - only once */}
      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-18px) scale(1.15);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )

  const spinnerContent = (
    <div className={cn('flex flex-col items-center justify-center gap-4', !fullscreen && 'py-12')}>
      {/* Spinner */}
      <div className="relative">
        {/* Track */}
        <div className={cn(
          spinnerSize[size], trackSize[size],
          'rounded-full border-border/40'
        )} />
        {/* Spinner */}
        <div className={cn(
          'absolute inset-0 rounded-full border-t-primary',
          spinnerSize[size], trackSize[size],
          'animate-spin border-b-transparent border-l-transparent border-r-transparent'
        )} />
        {/* Glow dot */}
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]" />
      </div>

      {text && (
        <p className={cn(
          'font-bold uppercase tracking-widest text-muted-foreground',
          size === 'lg' ? 'text-xs' : 'text-[10px]'
        )}>
          {text}
        </p>
      )}
    </div>
  )

  const content = variant === 'dots' ? dotsContent : spinnerContent

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xl">
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 -m-16 bg-primary/8 rounded-full blur-3xl animate-pulse" />
          {content}
        </div>
      </div>
    )
  }

  return content
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={cn('skeleton', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="glass-card rounded-[2rem] p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-5/6" />
    </div>
  )
}
