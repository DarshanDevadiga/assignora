import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { registerOverlay } from '../../utils/overlayManager'

const MODAL_SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-3rem)]',
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size,
  maxWidth,
}) {
  const overlayIdRef = useRef(Symbol('modal'))
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const titleId = useId()
  const resolvedWidthClass = maxWidth || MODAL_SIZE_MAP[size] || MODAL_SIZE_MAP.md

  useEffect(() => {
    if (!isOpen) return undefined

    const previousActiveElement =
      typeof document !== 'undefined' ? document.activeElement : null

    const unregister = registerOverlay(overlayIdRef.current, () => {
      if (typeof onCloseRef.current === 'function') {
        onCloseRef.current()
      }
    })

    // Focus the modal container if an inner control (e.g. autoFocus input) did not already claim focus
    const rafId = window.requestAnimationFrame(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        panelRef.current.focus({ preventScroll: true })
      }
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      unregister()
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === 'function' &&
        previousActiveElement.isConnected
      ) {
        previousActiveElement.focus({ preventScroll: true })
      }
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-modal overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Full-viewport fixed backdrop covering header, sidebar, and page content */}
      <div
        className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs transition-opacity duration-200 animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Responsive centering shell with safe viewport margins on all screen sizes */}
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`relative flex w-full ${resolvedWidthClass} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-2xl bg-white text-left shadow-modal border border-brand-line/90 modal-enter focus:outline-none`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || subtitle) && (
            <div className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-brand-line/60">
              <div className="min-w-0 flex-1">
                {title && (
                  <h3
                    id={titleId}
                    className="text-base sm:text-lg font-semibold text-brand-heading leading-snug"
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-brand-muted mt-0.5 break-words">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
            {children}
          </div>

          {/* Sticky Modal Footer */}
          {footer && (
            <div className="shrink-0 px-5 sm:px-6 py-4 bg-slate-50/70 border-t border-brand-line/60 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
