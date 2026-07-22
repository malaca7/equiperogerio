import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, subtitle, children, className, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const sizeMap = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade-in touch-none"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 w-full',
          sizeMap[size],
          'bg-card border border-border/60',
          'rounded-t-[2rem] sm:rounded-[1.75rem]',
          'animate-slide-up',
          'shadow-[0_-8px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_60px_rgba(0,0,0,0.5)]',
          'max-h-[92vh] flex flex-col overflow-hidden',
          className
        )}
      >
        {/* Drag handle (mobile) */}
        <div 
          className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 touch-none"
          onTouchMove={(e) => e.preventDefault()}
        >
          <div className="w-9 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div 
            className="flex items-start justify-between px-6 py-4 border-b border-border/50 flex-shrink-0 touch-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            <div className="pr-4">
              {title && <h2 className="text-sm font-black text-foreground uppercase tracking-wider">{title}</h2>}
              {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 scrollbar-none">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="px-6 pb-6 pt-4 border-t border-border/50 safe-bottom flex-shrink-0 touch-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
