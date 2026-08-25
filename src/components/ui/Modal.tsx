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
  size?: 'sm' | 'md' | 'lg' | 'xl'
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

  const sizeMap: Record<string, string> = {
    sm: 'sm:w-[90vw] sm:max-w-[400px]',
    md: 'sm:w-[90vw] sm:max-w-[90vw]',
    lg: 'sm:w-[90vw] sm:max-w-[90vw]',
    xl: 'sm:w-[90vw] sm:max-w-[90vw]',
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md animate-fade-in touch-none"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 w-full',
          sizeMap[size],
          'bg-card dark:bg-[#111420] border border-border/80 shadow-2xl opacity-100',
          'rounded-t-2xl sm:rounded-2xl',
          'animate-slide-up shadow-2xl',
          'max-h-[90vh] flex flex-col overflow-hidden',
          className
        )}
      >
        {/* Drag handle (mobile) */}
        <div 
          className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0 touch-none"
          onTouchMove={(e) => e.preventDefault()}
        >
          <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div 
            className="flex items-start justify-between px-5 py-3.5 border-b border-border flex-shrink-0 touch-none"
            onTouchMove={(e) => e.preventDefault()}
          >
            <div className="pr-4">
              {title && <h2 className="text-sm font-bold text-foreground tracking-tight">{title}</h2>}
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-secondary hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-90 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-none">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="px-5 pb-5 pt-3 border-t border-border safe-bottom flex-shrink-0 touch-none"
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
