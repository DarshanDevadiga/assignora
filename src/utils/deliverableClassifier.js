import { sanitizeUrl } from './calculations.js'

/**
 * Helper to determine deliverable category and properties
 */
export function classifyDeliverable({
  submissionLink,
  comment: _comment,
  onedriveLink,
  driveLink,
  assignmentId: _assignmentId,
  groupId: _groupId,
  classId: _classId,
  userRole: _userRole = 'admin',
}) {
  const trimmed = submissionLink ? String(submissionLink).trim() : ''

  // 1. If link is missing/empty, return honest acknowledgement-only state
  if (!trimmed) {
    return {
      category: 'acknowledgement_only',
      isDeliverable: false,
      url: null,
      label: 'Acknowledgement Only',
      message: 'Assignment acknowledged, but no deliverable has been submitted.',
      circularLink: null,
      courseOneDrive: onedriveLink ? sanitizeUrl(onedriveLink) : null,
      courseDrive: driveLink ? sanitizeUrl(driveLink) : null,
    }
  }

  const sanitized = sanitizeUrl(trimmed)
  const lower = sanitized.toLowerCase()

  // 2. Data URL / Embedded File Upload
  if (trimmed.startsWith('data:')) {
    const isPdf = trimmed.startsWith('data:application/pdf')
    const isImage = trimmed.startsWith('data:image/')
    const isText = trimmed.startsWith('data:text/')
    let fileName = 'submitted-document'

    // Extract original filename if embedded in comment metadata
    const nameMatch = typeof _comment === 'string' && _comment.match(/\[File:\s*([^\]]+)\]/)
    if (nameMatch && nameMatch[1]) {
      fileName = nameMatch[1].trim()
    } else if (isPdf) {
      fileName += '.pdf'
    } else if (isText) {
      fileName += '.txt'
    }

    return {
      category: isPdf ? 'pdf' : isImage ? 'image' : 'file',
      isDeliverable: true,
      url: trimmed,
      downloadUrl: trimmed,
      fileName,
      mimeType: trimmed.split(';')[0].replace('data:', ''),
      canPreview: isPdf || isImage || isText,
      label: isPdf ? 'PDF Document' : 'Submitted File',
    }
  }

  // 3. PDF Document
  if (lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf/')) {
    return {
      category: 'pdf',
      isDeliverable: true,
      url: sanitized,
      downloadUrl: sanitized,
      previewUrl: sanitized,
      fileName: sanitized.split('/').pop().split('?')[0] || 'document.pdf',
      canPreview: true,
      label: 'PDF Document',
    }
  }

  // 4. Microsoft Office Documents (DOC, DOCX, PPT, PPTX, XLS, XLSX)
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return {
      category: 'word',
      isDeliverable: true,
      url: sanitized,
      downloadUrl: sanitized,
      fileName: sanitized.split('/').pop().split('?')[0] || 'document.docx',
      canPreview: false,
      label: 'Microsoft Word Document (.docx)',
      badgeColor: 'blue',
    }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return {
      category: 'excel',
      isDeliverable: true,
      url: sanitized,
      downloadUrl: sanitized,
      fileName: sanitized.split('/').pop().split('?')[0] || 'spreadsheet.xlsx',
      canPreview: false,
      label: 'Excel Spreadsheet (.xlsx)',
      badgeColor: 'emerald',
    }
  }

  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    return {
      category: 'powerpoint',
      isDeliverable: true,
      url: sanitized,
      downloadUrl: sanitized,
      fileName: sanitized.split('/').pop().split('?')[0] || 'presentation.pptx',
      canPreview: false,
      label: 'PowerPoint Presentation (.pptx)',
      badgeColor: 'amber',
    }
  }

  // 5. OneDrive / SharePoint Link
  if (lower.includes('1drv.ms') || lower.includes('onedrive.live.com') || lower.includes('sharepoint.com')) {
    return {
      category: 'onedrive',
      isDeliverable: true,
      url: sanitized,
      previewUrl: sanitized,
      canPreview: false,
      label: 'Microsoft OneDrive Deliverable',
      badgeColor: 'blue',
    }
  }

  // 6. Google Drive / Docs / Sheets
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    let previewUrl = sanitized
    const driveMatch = sanitized.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (driveMatch && driveMatch[1]) {
      previewUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    }

    return {
      category: 'google_drive',
      isDeliverable: true,
      url: sanitized,
      previewUrl,
      canPreview: Boolean(driveMatch),
      label: 'Google Drive Document',
      badgeColor: 'amber',
    }
  }

  // 7. GitHub / GitLab Repository
  if (lower.includes('github.com') || lower.includes('gitlab.com')) {
    return {
      category: 'code_repo',
      isDeliverable: true,
      url: sanitized,
      canPreview: false,
      label: 'GitHub Repository',
      badgeColor: 'slate',
    }
  }

  // 8. Live Web Application or Submitted Project URL
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('vercel.app') ||
    lower.includes('netlify.app') ||
    lower.includes('.edu') ||
    lower.includes('.org') ||
    lower.includes('.com') ||
    lower.includes('.io') ||
    lower.includes('.dev')
  ) {
    const isLocal = lower.includes('localhost') || lower.includes('127.0.0.1')
    return {
      category: 'web_app',
      isDeliverable: true,
      url: sanitized,
      downloadUrl: sanitized,
      canPreview: false,
      label: isLocal ? 'Local Web Project / URL' : 'Live Web Project / URL',
      badgeColor: 'purple',
      isLocal,
    }
  }

  // 9. Generic Verified External Link
  return {
    category: 'external_link',
    isDeliverable: true,
    url: sanitized,
    downloadUrl: sanitized,
    canPreview: false,
    label: 'External Deliverable Link',
    badgeColor: 'purple',
  }
}
