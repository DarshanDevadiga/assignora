import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const VARIANT_STYLES = {
  success: {
    container: 'bg-white border-emerald-200 text-slate-900 shadow-lg shadow-emerald-950/5',
    badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    title: 'text-emerald-900',
    icon: CheckCircle2,
  },
  error: {
    container: 'bg-white border-red-200 text-slate-900 shadow-lg shadow-red-950/5',
    badge: 'bg-red-50 text-red-600 border-red-200',
    title: 'text-red-900',
    icon: AlertCircle,
  },
  warning: {
    container: 'bg-white border-amber-200 text-slate-900 shadow-lg shadow-amber-950/5',
    badge: 'bg-amber-50 text-amber-600 border-amber-200',
    title: 'text-amber-900',
    icon: AlertTriangle,
  },
  info: {
    container: 'bg-white border-brand-line text-slate-900 shadow-lg shadow-brand-primary/10',
    badge: 'bg-brand-light text-brand-primary border-brand-line',
    title: 'text-brand-heading',
    icon: Info,
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ title, message, variant = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev.slice(-4), { id, title, message, variant }])

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, timer)
      }

      return id
    },
    [dismiss]
  )

  const api = useMemo(
    () => ({
      show: showToast,
      dismiss,
      success: (message, title = 'Success') =>
        showToast({ title, message, variant: 'success', duration: 4000 }),
      error: (message, title = 'Action Failed') =>
        showToast({ title, message, variant: 'error', duration: 6000 }),
      warning: (message, title = 'Notice') =>
        showToast({ title, message, variant: 'warning', duration: 5000 }),
      info: (message, title = 'Info') =>
        showToast({ title, message, variant: 'info', duration: 4000 }),
    }),
    [showToast, dismiss]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed top-4 right-4 left-4 sm:left-auto sm:w-full sm:max-w-sm pointer-events-none flex flex-col gap-2.5 z-toast"
            style={{ zIndex: 70 }}
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((item) => {
              const style = VARIANT_STYLES[item.variant] || VARIANT_STYLES.info
              const Icon = style.icon
              return (
                <div
                  key={item.id}
                  role="status"
                  className={`pointer-events-auto rounded-2xl border p-3.5 flex items-start gap-3 animate-fade-in ${style.container}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${style.badge}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {item.title && (
                      <p className={`text-xs font-bold leading-tight ${style.title}`}>
                        {item.title}
                      </p>
                    )}
                    {item.message && (
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                        {item.message}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Graceful fallback so isolated renders/tests never crash
    return {
      show: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    }
  }
  return ctx
}
