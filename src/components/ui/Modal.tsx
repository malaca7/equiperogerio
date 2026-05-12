import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 w-full sm:max-w-md bg-[hsl(var(--card))] rounded-t-3xl sm:rounded-2xl',
          'animate-slide-up shadow-2xl border border-[hsl(var(--border))]',
          'max-h-[90vh] flex flex-col',
          className
        )}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[hsl(var(--muted-foreground))/0.3]" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 pb-6 pt-3 border-t border-[hsl(var(--border))] safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
