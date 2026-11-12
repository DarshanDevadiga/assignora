import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

/**
 * Accessible three-dot Actions menu rendered into document.body so parent cards with
 * overflow-hidden never clip the menu. Stops event propagation automatically.
 */
export default function ActionMenu({
  items = [],
  label = 'Open actions menu',
  align = 'right',
  buttonClassName = '',
  iconSize = 'w-4 h-4',
  disabled = false,
  onOpenChange,
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const visibleItems = items.filter((item) => item && !item.hidden)

  const closeMenu = useCallback(() => {
    setOpen(false)
    if (onOpenChange) onOpenChange(false)
  }, [onOpenChange])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || 196
    const menuHeight = menuRef.current?.offsetHeight || 160
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let left = align === 'left' ? rect.left : rect.right - menuWidth
    left = Math.max(12, Math.min(left, viewportW - menuWidth - 12))

    let top = rect.bottom + 6
    if (top + menuHeight > viewportH - 12 && rect.top - menuHeight - 6 > 12) {
      top = rect.top - menuHeight - 6
    }

    setCoords({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return
      }
      closeMenu()
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeMenu()
        triggerRef.current?.focus()
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const focusable = Array.from(
          menuRef.current?.querySelectorAll('button[role="menuitem"]:not(:disabled)') || []
        )
        if (!focusable.length) return
        e.preventDefault()
        const idx = focusable.indexOf(document.activeElement)
        const nextIdx =
          e.key === 'ArrowDown'
            ? (idx + 1) % focusable.length
            : (idx - 1 + focusable.length) % focusable.length
        focusable[nextIdx]?.focus()
      }
    }

    const handleScrollOrResize = () => updatePosition()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open, closeMenu, updatePosition])

  if (visibleItems.length === 0) return null

  const toggleMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setOpen((prev) => {
      const next = !prev
      if (onOpenChange) onOpenChange(next)
      return next
    })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className={
          buttonClassName ||
          `p-1.5 rounded-lg text-slate-500 hover:text-brand-primary hover:bg-brand-light transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50 ${
            open ? 'bg-brand-light text-brand-primary' : ''
          }`
        }
      >
        <MoreVertical className={iconSize} />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${coords.top}px`, left: `${coords.left}px`, zIndex: 75 }}
            className="fixed w-48 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/10 py-1.5 animate-fade-in"
          >
            {visibleItems.map((item, idx) => {
              const Icon = item.icon
              const isDanger = item.variant === 'danger'
              const isWarning = item.variant === 'warning'
              return (
                <React.Fragment key={item.id || item.label || idx}>
                  {item.dividerBefore && <div className="my-1 border-t border-slate-100" />}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      closeMenu()
                      if (!item.disabled && typeof item.onClick === 'function') {
                        item.onClick(e)
                      }
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                      isDanger
                        ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
                        : isWarning
                        ? 'text-amber-700 hover:bg-amber-50 focus:bg-amber-50'
                        : 'text-slate-700 hover:bg-brand-light hover:text-brand-primary focus:bg-brand-light focus:text-brand-primary'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
