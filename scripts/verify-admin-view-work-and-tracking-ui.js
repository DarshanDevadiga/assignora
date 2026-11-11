import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { sanitizeUrl, calculateCompletionRate, calculateLetterGrade } from '../src/utils/calculations.js'

test('sanitizeUrl handles empty, valid absolute, and missing-protocol URLs', () => {
  assert.equal(sanitizeUrl(''), '', 'Empty string should return empty string')
  assert.equal(sanitizeUrl(null), '', 'Null should return empty string')
  assert.equal(sanitizeUrl(undefined), '', 'Undefined should return empty string')

  assert.equal(
    sanitizeUrl('https://onedrive.live.com/view?id=123'),
    'https://onedrive.live.com/view?id=123',
    'https:// URL should be preserved'
  )
  assert.equal(
    sanitizeUrl('http://example.com/work.pdf'),
    'http://example.com/work.pdf',
    'http:// URL should be preserved'
  )
  assert.equal(
    sanitizeUrl('onedrive.live.com/view?id=123'),
    'https://onedrive.live.com/view?id=123',
    'Domain without protocol must prepend https://'
  )
  assert.equal(
    sanitizeUrl('drive.google.com/drive/folders/abc'),
    'https://drive.google.com/drive/folders/abc',
    'Google Drive without protocol must prepend https://'
  )
  assert.equal(
    sanitizeUrl('//cdn.example.com/file.zip'),
    'https://cdn.example.com/file.zip',
    'Protocol-relative // must resolve to https://'
  )
  // Ensure internal relative paths pasted as links are cleanly preserved as root-relative routes:
  const relativeResult = sanitizeUrl('/student/assignments/abc-123')
  assert.equal(
    relativeResult,
    '/student/assignments/abc-123',
    'Relative path without domain must be preserved as root-relative route'
  )
})

test('SubmissionTracking component verification: View Work buttons, sanitizeUrl, and responsive design', () => {
  const filePath = path.resolve(process.cwd(), 'src/pages/admin/SubmissionTracking.jsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  // 1. sanitizeUrl & resolveDeliverableUrl import
  assert.ok(
    content.includes("sanitizeUrl") && content.includes("resolveDeliverableUrl") && content.includes("../../utils/calculations"),
    'SubmissionTracking must import sanitizeUrl and resolveDeliverableUrl from calculations utility'
  )

  // 2. View Work button in group table opens openGroupGradingModal
  assert.ok(
    content.includes("openGroupGradingModal(row)") && content.includes("View Work"),
    'Group table must have View Work button calling openGroupGradingModal(row)'
  )

  // 3. View Work button in student table opens openGradingModal
  assert.ok(
    content.includes("openGradingModal(row)") && content.includes("View Work"),
    'Student table must have View Work button calling openGradingModal(row)'
  )

  // 4. Modal deliverable links use resolveDeliverableUrl
  assert.ok(
    content.includes("resolveDeliverableUrl") && content.includes("submissionLink: inspectedGroup.submission_link"),
    'Group modal must resolve submission_link using resolveDeliverableUrl'
  )
  assert.ok(
    content.includes("resolveDeliverableUrl") && content.includes("submissionLink: inspectedStudent.submission_link"),
    'Student modal must resolve submission_link using resolveDeliverableUrl'
  )

  // 5. Course OneDrive link uses sanitizeUrl
  assert.ok(
    content.includes("sanitizeUrl(currentAssignment.onedrive_link)"),
    'OneDrive link must be sanitized with sanitizeUrl'
  )

  // 6. Responsive header layout prevents dropdown overlap
  assert.ok(
    content.includes("flex-col lg:flex-row lg:items-center lg:justify-between gap-4"),
    'Header must have responsive lg:flex-row layout'
  )
  assert.ok(
    content.includes("w-full sm:w-auto min-w-[220px] max-w-full sm:max-w-xs"),
    'Switch assignment dropdown must have responsive sizing preventing overlap'
  )

  // 7. Group summary cards grid and height
  assert.ok(
    content.includes("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"),
    'Group summary cards must use 5-column responsive grid'
  )
  assert.ok(
    content.includes("h-full shadow-2xs"),
    'Summary cards must use equal heights (h-full)'
  )

  // 8. Group submission cards layout & individual table headers
  assert.ok(
    content.includes('<GroupSubmissionCard') && content.includes('grid grid-cols-1 lg:grid-cols-2 gap-5'),
    'Submitted groups must use responsive 2-column card grid with GroupSubmissionCard'
  )
  assert.ok(
    content.includes('th className="py-3 px-4 text-center min-w-[90px]">Marks Obtained</th>'),
    'Marks header must be center aligned'
  )
  assert.ok(
    content.includes('th className="py-3 px-4 text-right min-w-[130px]">Action</th>'),
    'Action header must be right aligned'
  )
})

test('Group submission metrics calculation derived from Supabase data', () => {
  // Simulate 3 groups: Group 1 submitted & graded, Group 2 submitted pending grading, Group 3 unacknowledged
  const courseGroups = [
    { id: 'g1', name: 'Alpha', leader: { name: 'Alice' }, members: [{ student_id: 's1' }] },
    { id: 'g2', name: 'Beta', leader: { name: 'Bob' }, members: [{ student_id: 's2' }] },
    { id: 'g3', name: 'Gamma', leader: { name: 'Charlie' }, members: [{ student_id: 's3' }] },
  ]
  const groupSubmissions = [
    { id: 'sub1', group_id: 'g1', acknowledged_at: '2026-11-10T10:00:00Z', status: 'reviewed', marks: 95 },
    { id: 'sub2', group_id: 'g2', acknowledged_at: '2026-11-10T11:00:00Z', status: 'submitted', marks: null },
  ]

  const submitted = []
  const notSubmitted = []
  courseGroups.forEach((g) => {
    const sub = groupSubmissions.find((s) => s.group_id === g.id)
    const isSub = Boolean(sub && (sub.acknowledged_at || sub.status === 'submitted' || sub.status === 'reviewed'))
    const isGraded = Boolean(sub && (sub.status === 'reviewed' || (sub.marks !== null && sub.marks !== undefined)))
    if (isSub) {
      submitted.push({ ...g, isGraded })
    } else {
      notSubmitted.push(g)
    }
  })

  const totalGroups = submitted.length + notSubmitted.length
  const acknowledgedCount = submitted.length
  const unacknowledgedCount = notSubmitted.length
  const gradedCount = submitted.filter((r) => r.isGraded).length
  const awaitingCount = submitted.filter((r) => !r.isGraded).length
  const progressRate = calculateCompletionRate(acknowledgedCount, totalGroups)

  assert.equal(totalGroups, 3, 'Total groups should be 3')
  assert.equal(acknowledgedCount, 2, 'Acknowledged groups should be 2')
  assert.equal(unacknowledgedCount, 1, 'Unacknowledged groups should be 1')
  assert.equal(gradedCount, 1, 'Graded groups should be 1')
  assert.equal(awaitingCount, 1, 'Awaiting grading groups should be 1')
  assert.equal(progressRate, 67, 'Progress completion rate should be 67%')
  assert.equal(calculateLetterGrade(95, 100), 'A+', '95/100 should calculate as A+')
})

test('Sanitization verified across other components with deliverable links', () => {
  const filesToCheck = [
    'src/pages/shared/ClassDetailPage.jsx',
    'src/pages/shared/GroupDetailsPage.jsx',
    'src/components/group/GroupDetailsModal.jsx',
    'src/pages/student/AssignmentDetails.jsx',
    'src/pages/student/StudentSubmissions.jsx'
  ]

  for (const file of filesToCheck) {
    const filePath = path.resolve(process.cwd(), file)
    const content = fs.readFileSync(filePath, 'utf-8')
    assert.ok(
      content.includes('sanitizeUrl'),
      `${file} must import and use sanitizeUrl`
    )
  }
})
