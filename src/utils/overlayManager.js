/**
 * Coordinates body scroll locking, Escape key stacking, and focus restoration
 * across stacked portals (modals and drawers).
 */
const activeOverlayIds = []
const closeHandlers = new Map()
let previousBodyOverflow = ''
let keyListenerAttached = false

function handleGlobalKeyDown(event) {
  if (event.key !== 'Escape' || activeOverlayIds.length === 0) return
  const topOverlayId = activeOverlayIds[activeOverlayIds.length - 1]
  const onClose = closeHandlers.get(topOverlayId)
  if (typeof onClose === 'function') {
    event.stopPropagation()
    onClose()
  }
}

export function registerOverlay(id, onClose) {
  if (typeof document === 'undefined') return () => {}

  if (activeOverlayIds.length === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  if (!activeOverlayIds.includes(id)) {
    activeOverlayIds.push(id)
  }
  closeHandlers.set(id, onClose)

  if (!keyListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeyDown)
    keyListenerAttached = true
  }

  return () => {
    const idx = activeOverlayIds.indexOf(id)
    if (idx !== -1) {
      activeOverlayIds.splice(idx, 1)
    }
    closeHandlers.delete(id)

    if (activeOverlayIds.length === 0) {
      document.body.style.overflow = previousBodyOverflow || ''
      if (keyListenerAttached && typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleGlobalKeyDown)
        keyListenerAttached = false
      }
    }
  }
}

export function isTopOverlay(id) {
  if (activeOverlayIds.length === 0) return false
  return activeOverlayIds[activeOverlayIds.length - 1] === id
}
