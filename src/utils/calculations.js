/**
 * Utility functions for calculations and date formatting in Assignora
 */

export function calculateCompletionRate(submittedCount, totalAssigned) {
  if (!totalAssigned || totalAssigned === 0) return 0
  const rate = Math.round((submittedCount / totalAssigned) * 100)
  return Math.min(100, Math.max(0, rate))
}

export function isOverdue(dueDate, dueTime) {
  if (!dueDate) return false
  const time = dueTime || '23:59:59'
  const deadline = new Date(`${dueDate}T${time}`)
  return deadline < new Date()
}

export function getDaysRemaining(dueDate, dueTime) {
  if (!dueDate) return null
  const time = dueTime || '23:59:59'
  const deadline = new Date(`${dueDate}T${time}`)
  const now = new Date()
  const diffTime = deadline - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function formatDeadlineBadge(dueDate, dueTime) {
  const days = getDaysRemaining(dueDate, dueTime)
  if (days === null) return null
  if (days < 0) {
    return { text: 'Overdue', variant: 'danger' }
  }
  if (days === 0) {
    return { text: 'Due today', variant: 'danger' }
  }
  if (days === 1) {
    return { text: 'Due tomorrow', variant: 'warning' }
  }
  if (days <= 5) {
    return { text: `Due in ${days} days`, variant: 'warning' }
  }
  return { text: `Due in ${days} days`, variant: 'neutral' }
}

export function formatDisplayDate(dateInput) {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTimeAgo(dateInput) {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  const now = new Date()
  const diffSeconds = Math.floor((now - date) / 1000)

  if (diffSeconds < 60) return 'Just now'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
