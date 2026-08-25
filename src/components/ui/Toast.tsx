import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const configs: Record<ToastType, { icon: any; classes: string; iconClass: string; bar: string }> = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-card border-emerald-500/30 dark:border-emerald-500/20',
    iconClass: 'text-emerald-500',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    classes: 'bg-card border-rose-500/30 dark:border-rose-500/20',
    iconClass: 'text-rose-500',
    bar: 'bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-card border-amber-500/30 dark:border-amber-500/20',
    iconClass: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  info: {
    icon: Info,
    classes: 'bg-card border-blue-500/30 dark:border-blue-500/20',
    iconClass: 'text-blue-500',
    bar: 'bg-blue-500',
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[10000000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const { icon: Icon, classes, iconClass, bar } = configs[t.type]
          return (
            <div
              key={t.id}
              className={cn(
                'relative flex items-center gap-3 pl-4 pr-3 py-3.5',
                'rounded-2xl border shadow-lg shadow-black/10 dark:shadow-black/40',
                'animate-slide-down pointer-events-auto overflow-hidden',
                classes
              )}
            >
              {/* Color bar */}
              <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', bar)} />

              <Icon className={cn('w-5 h-5 flex-shrink-0', iconClass)} />
              <p className="text-sm font-semibold text-foreground flex-1 leading-snug">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
