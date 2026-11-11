/**
 * Utility functions for calculations, date formatting, and CSV export in Assignora
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

export function isSubmissionLate(dueDate, dueTime, submittedAt) {
  if (!dueDate || !submittedAt) return false
  const time = dueTime || '23:59:59'
  const deadline = new Date(`${dueDate}T${time}`)
  return new Date(submittedAt) > deadline
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

/**
 * Export tabular data to downloadable CSV
 */
export function exportToCSV(filename, rows, headers) {
  if (!rows || !rows.length) return

  const headerLine = headers.map((h) => `"${h.label}"`).join(',')
  const rowLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(',')
  )

  const csvContent = [headerLine, ...rowLines].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Calculate letter grade from score and total points
 */
export function calculateLetterGrade(score, totalPoints) {
  if (score === null || score === undefined || score === '' || !totalPoints) return '—'
  const pct = (Number(score) / Number(totalPoints)) * 100
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}

/**
 * Format timestamp into 12-hour local time (e.g., 10:35 AM)
 */
export function formatMessageTime(dateInput) {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * Format message date for day separators:
 * - 'Today' if sent today
 * - 'Yesterday' if sent yesterday
 * - 'DD Mon YYYY' (e.g., 04 Nov 2026) for older dates
 */
export function formatMessageDateSeparator(dateInput) {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const diffTime = today.getTime() - msgDay.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Check whether two date inputs fall on different calendar days in local time
 */
export function isDifferentDay(dateInputA, dateInputB) {
  if (!dateInputA || !dateInputB) return true
  const a = new Date(dateInputA)
  const b = new Date(dateInputB)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return true
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  )
}

/**
 * Safely sanitize links to ensure valid absolute URLs for external domains
 * or valid root-relative routes for internal application pages,
 * preventing broken hostnames (e.g. https://student/...) or unvalidated schemes.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  // Valid absolute http/https protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // Protocol-relative //cdn.example.com
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  // Root-relative internal application routes like /admin/... or /student/...
  if (trimmed.startsWith('/')) {
    return trimmed
  }

  // Common external domain pattern without protocol: e.g. onedrive.live.com, 1drv.ms, drive.google.com, github.com
  if (/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  // Default to https://
  return `https://${trimmed}`
}

/**
 * Intelligent Deliverable Resolver:
 * Distinguishes true external deliverables (OneDrive, Google Drive, GitHub, etc.)
 * from circular self-referential assignment URLs and course-level OneDrive folders.
 * Guarantees that opening a deliverable never lands on a blank or dashboard route.
 */
export function resolveDeliverableUrl({
  submissionLink,
  onedriveLink,
  driveLink,
  assignmentId,
  groupId,
  classId,
  userRole = 'admin',
}) {
  const trimmedSub = submissionLink ? String(submissionLink).trim() : ''
  const trimmedOneDrive = onedriveLink ? String(onedriveLink).trim() : ''
  const trimmedDrive = driveLink ? String(driveLink).trim() : ''

  // Detect whether the link is self-referential (pointing back to the assignment page itself)
  const isCircularAssignmentLink =
    Boolean(trimmedSub) &&
    (/(\/|^)(student|admin)?\/assignments\/[a-f0-9-]+/i.test(trimmedSub) ||
      trimmedSub.includes('/student/assignments') ||
      trimmedSub.includes('/admin/assignments'))

  // 1. If a valid external deliverable link is provided (and is not a circular loop to the assignment page)
  if (trimmedSub && !isCircularAssignmentLink) {
    const sanitized = sanitizeUrl(trimmedSub)
    return {
      type: 'external',
      url: sanitized,
      label: 'Open Work in New Tab',
      isDeliverable: true,
      source: 'student_submission',
    }
  }

  // 2. If the student submitted a circular assignment link but a course OneDrive folder exists,
  // open the course OneDrive folder where group deliverables are housed
  if (trimmedOneDrive) {
    const sanitized = sanitizeUrl(trimmedOneDrive)
    return {
      type: 'onedrive',
      url: sanitized,
      label: 'Open Course OneDrive Folder',
      isDeliverable: true,
      source: 'course_onedrive',
      note: isCircularAssignmentLink
        ? 'Submitted link referenced the assignment page; opening course OneDrive folder.'
        : undefined,
    }
  }

  // 3. If a course Google Drive link exists
  if (trimmedDrive) {
    const sanitized = sanitizeUrl(trimmedDrive)
    return {
      type: 'drive',
      url: sanitized,
      label: 'Open Course Drive Folder',
      isDeliverable: true,
      source: 'course_drive',
      note: isCircularAssignmentLink
        ? 'Submitted link referenced the assignment page; opening course Google Drive folder.'
        : undefined,
    }
  }

  // 4. If it was a circular assignment URL and no external folder exists,
  // ensure the link opens the proper role-aware internal assignment evaluation route
  if (isCircularAssignmentLink && assignmentId) {
    const rolePrefix = userRole === 'student' ? 'student' : 'admin'
    const query = [groupId ? `groupId=${groupId}` : '', classId ? `classId=${classId}` : '']
      .filter(Boolean)
      .join('&')
    const internalUrl = `/${rolePrefix}/assignments/${assignmentId}${query ? `?${query}` : ''}`
    return {
      type: 'internal_viewer',
      url: internalUrl,
      label: 'Open Assignment Work Details',
      isDeliverable: false,
      source: 'internal_route',
      note: 'Self-referential link resolved to internal assignment view',
    }
  }

  // 5. No deliverable exists
  return {
    type: 'none',
    url: null,
    label: 'No Deliverable Submitted',
    isDeliverable: false,
    source: 'none',
  }
}


