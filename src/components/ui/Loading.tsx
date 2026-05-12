import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function Loading({ size = 'md', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className={`${sizeClasses[size]} rounded-full border-[hsl(var(--primary))] border-t-transparent animate-spin`}
        role="status"
        aria-label="Carregando"
      />
      {text && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[hsl(var(--muted))] ${className}`}
    />
  )
}
