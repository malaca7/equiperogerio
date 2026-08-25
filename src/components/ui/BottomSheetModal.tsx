import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface BottomSheetModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheetModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: BottomSheetModalProps) {
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

  return (
    <div className="fixed inset-0 z-[1000000] flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Sheet Container */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg bg-card border border-border/80 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-full md:slide-in-from-bottom-4 md:zoom-in-95',
          'rounded-t-[2.25rem] md:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden',
          className
        )}
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="flex items-center justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-border/60">
            <div>
              {title && (
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  )
}
