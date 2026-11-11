import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  sanitizeUrl,
  resolveDeliverableUrl,
} from '../src/utils/calculations.js'

test('resolveDeliverableUrl resolves external, OneDrive, and self-referential deliverables', () => {
  // 1. Valid external OneDrive link
  const res1 = resolveDeliverableUrl({
    submissionLink: 'https://1drv.ms/u/official-leader-deliverable',
    onedriveLink: null,
    assignmentId: 'assn-1',
    groupId: 'grp-1',
  })
  assert.equal(res1.type, 'external')
  assert.equal(res1.url, 'https://1drv.ms/u/official-leader-deliverable')
  assert.equal(res1.isDeliverable, true)

  // 2. Missing protocol external domain
  const res2 = resolveDeliverableUrl({
    submissionLink: 'onedrive.live.com/view.aspx?cid=123',
    onedriveLink: null,
    assignmentId: 'assn-1',
  })
  assert.equal(res2.type, 'external')
  assert.equal(res2.url, 'https://onedrive.live.com/view.aspx?cid=123')
  assert.equal(res2.isDeliverable, true)

  // 3. Self-referential assignment link with Course OneDrive link available
  const res3 = resolveDeliverableUrl({
    submissionLink: 'http://localhost:5173/student/assignments/be665af0-7b57-41b2-a69b-df445996357c',
    onedriveLink: 'https://onedrive.live.com/course-folder-mca',
    assignmentId: 'be665af0-7b57-41b2-a69b-df445996357c',
    groupId: 'cc887d59-6ccb-490e-b787-d8c9eb1048b2',
    userRole: 'admin',
  })
  assert.equal(res3.type, 'onedrive')
  assert.equal(res3.url, 'https://onedrive.live.com/course-folder-mca')
  assert.equal(res3.isDeliverable, true)
  assert.ok(res3.note && res3.note.includes('course OneDrive'))

  // 4. Self-referential assignment link without OneDrive link -> resolves to admin internal viewer
  const res4 = resolveDeliverableUrl({
    submissionLink: '/student/assignments/be665af0-7b57-41b2-a69b-df445996357c',
    onedriveLink: null,
    driveLink: null,
    assignmentId: 'be665af0-7b57-41b2-a69b-df445996357c',
    groupId: 'grp-123',
    classId: 'cls-456',
    userRole: 'admin',
  })
  assert.equal(res4.type, 'internal_viewer')
  assert.equal(
    res4.url,
    '/admin/assignments/be665af0-7b57-41b2-a69b-df445996357c?groupId=grp-123&classId=cls-456'
  )

  // 5. No deliverable
  const res5 = resolveDeliverableUrl({
    submissionLink: '',
    onedriveLink: null,
    driveLink: null,
    assignmentId: 'assn-1',
  })
  assert.equal(res5.type, 'none')
  assert.equal(res5.isDeliverable, false)
  assert.equal(res5.url, null)
})

test('RoleRoute cross-role translation prevents dashboard bouncing', () => {
  const filePath = path.resolve(process.cwd(), 'src/routes/RoleRoute.jsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(
    content.includes("user.role === 'admin' && location.pathname.startsWith('/student/assignments/')"),
    'RoleRoute must translate /student/assignments/ to /admin/assignments/ for admin users'
  )
  assert.ok(
    content.includes("user.role === 'student' && location.pathname.startsWith('/admin/assignments/')"),
    'RoleRoute must translate /admin/assignments/ to /student/assignments/ for student users'
  )
  assert.ok(
    content.includes("user.role === 'admin' && location.pathname.startsWith('/student/classes/')"),
    'RoleRoute must translate /student/classes/ to /admin/classes/ for admin users'
  )
  assert.ok(
    content.includes("user.role === 'student' && location.pathname.startsWith('/admin/classes/')"),
    'RoleRoute must translate /admin/classes/ to /student/classes/ for student users'
  )
})

test('AdminDashboard course card click navigates to class detail page', () => {
  const filePath = path.resolve(process.cwd(), 'src/pages/admin/AdminDashboard.jsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(
    content.includes("onClick={() => navigate(`/admin/classes/${cls.id}`)}"),
    'AdminDashboard course cards must navigate to /admin/classes/:id'
  )
  assert.ok(
    !content.includes("onClick={() => navigate(`/admin/assignments?classId=${cls.id}`)}"),
    'AdminDashboard must not navigate to /admin/assignments?classId= on course card click'
  )
  assert.ok(
    content.includes("Open Class Details"),
    'AdminDashboard course card action should read Open Class Details'
  )
})

test('Sidebar navigation structure and active state persistence', () => {
  const filePath = path.resolve(process.cwd(), 'src/components/layout/Sidebar.jsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(
    content.includes("{ name: 'Classes', path: '/admin/classes', icon: BookOpen }"),
    'Sidebar must include Classes route for admin'
  )
  assert.ok(
    content.includes("{ name: 'Assignments', path: '/admin/assignments', icon: ClipboardList }"),
    'Sidebar must include Assignments route for admin'
  )
})

test('CreateAssignment and ClassDetailPage class-specific assignment context', () => {
  const createPath = path.resolve(process.cwd(), 'src/pages/admin/CreateAssignment.jsx')
  const createContent = fs.readFileSync(createPath, 'utf-8')

  assert.ok(
    createContent.includes("searchParams.get('classId') || location.state?.classId"),
    'CreateAssignment must read classId from query params or state'
  )
  assert.ok(
    createContent.includes("navigate(`/admin/classes/${selectedClassId}?tab=assignments`)"),
    'CreateAssignment must navigate back to the class assignments tab after creation'
  )

  const classDetailPath = path.resolve(process.cwd(), 'src/pages/shared/ClassDetailPage.jsx')
  const classDetailContent = fs.readFileSync(classDetailPath, 'utf-8')

  assert.ok(
    classDetailContent.includes("/admin/assignments/create?classId="),
    'ClassDetailPage Create Assignment button must pass classId in URL and state'
  )
})
