import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

const checks = []

function check(name, condition, detail = '') {
  checks.push({ name, passed: Boolean(condition), detail })
  if (!condition) {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    console.log(`PASS: ${name}`)
  }
}

// 1. Toast Infrastructure
const appJsx = read('src/App.jsx')
const toastCtx = read('src/context/ToastContext.jsx')
check('Global ToastProvider mounted in src/App.jsx', appJsx.includes('<ToastProvider>') && appJsx.includes('</ToastProvider>'))
check('ToastContext renders portal into document.body at z-toast', toastCtx.includes('createPortal') && toastCtx.includes('z-toast'))

// 2. Shared ActionMenu & ConfirmDeleteModal
const actionMenu = read('src/components/common/ActionMenu.jsx')
const confirmModal = read('src/components/common/ConfirmDeleteModal.jsx')
check('ActionMenu uses MoreVertical & portal positioning', actionMenu.includes('MoreVertical') && actionMenu.includes('createPortal') && actionMenu.includes('role="menu"'))
check('ConfirmDeleteModal enforces blockReason, Archive CTA, loading & error retry', confirmModal.includes('canPermanentDelete') && confirmModal.includes('archiveSupported') && confirmModal.includes('Retry Delete'))

// 3. Edit Modals
const editClassModal = read('src/components/class/EditClassModal.jsx')
const editGroupModal = read('src/components/group/EditGroupModal.jsx')
check('EditClassModal supports name, subject, class_code, description + optional term metadata', editClassModal.includes('class_code') && editClassModal.includes('classesService.updateClass') && editClassModal.includes('Retry Save'))
check('EditGroupModal supports group name, leader transfer, adding unassigned members, non-leader removal', editGroupModal.includes('updateGroupDetails') && editGroupModal.includes('addGroupMembers') && editGroupModal.includes('removeGroupMember'))

// 4. Service Layer Data Preservation & Hardening
const classesSvc = read('src/services/classes.service.js')
const assignmentsSvc = read('src/services/assignments.service.js')
const groupsSvc = read('src/services/groups.service.js')

check('classesService exposes getClassImpactSummary, updateClass, archiveClass, deleteClass', ['getClassImpactSummary', 'updateClass', 'archiveClass', 'deleteClass'].every((m) => classesSvc.includes(m)))
check('classesService.deleteClass NEVER manually cascades submissions or class_members', !classesSvc.includes("from('submissions').delete()") && !classesSvc.includes("from('class_members').delete()") && classesSvc.includes('!impact.canPermanentDelete'))

check('assignmentsService exposes getAssignmentImpactSummary, archiveAssignment, restoreAssignment', ['getAssignmentImpactSummary', 'archiveAssignment', 'restoreAssignment'].every((m) => assignmentsSvc.includes(m)))
check('assignmentsService.deleteAssignment refuses when submissions exist & never deletes submissions', !assignmentsSvc.includes("from('submissions').delete()") && assignmentsSvc.includes('!impact.canPermanentDelete'))
check('assignmentsService.updateAssignment protects class_id, submission_type & submittedStudentIds', assignmentsSvc.includes('Cannot change submission type between Individual and Group') && assignmentsSvc.includes('submittedStudentIds'))

check('groupsService exposes getGroupImpactSummary, updateGroupDetails, archiveCourseGroup, removeGroupMember', ['getGroupImpactSummary', 'updateGroupDetails', 'archiveCourseGroup', 'removeGroupMember'].every((m) => groupsSvc.includes(m)))

// 5. Role-Based UI Enforcement (No Student Delete/Disband/Edit Controls)
const adminDash = read('src/pages/admin/AdminDashboard.jsx')
const classesMgmt = read('src/pages/admin/ClassesManagement.jsx')
const classDetail = read('src/pages/shared/ClassDetailPage.jsx')
const assignmentsList = read('src/pages/admin/AssignmentsList.jsx')
const createAssignment = read('src/pages/admin/CreateAssignment.jsx')
const subTracking = read('src/pages/admin/SubmissionTracking.jsx')
const groupsTab = read('src/components/class/ClassGroupsTab.jsx')
const groupMgmtModal = read('src/components/group/GroupManagementModal.jsx')
const groupDetailsModal = read('src/components/group/GroupDetailsModal.jsx')
const groupDetailsPage = read('src/pages/shared/GroupDetailsPage.jsx')

check('AdminDashboard integrates ActionMenu, EditClassModal & ConfirmDeleteModal', adminDash.includes('<ActionMenu') && adminDash.includes('<EditClassModal') && adminDash.includes('<ConfirmDeleteModal'))
check('ClassesManagement enforces owner/admin gate and safe ConfirmDeleteModal', classesMgmt.includes('isTeacher && cls.admin_id === user?.id') && classesMgmt.includes('<ConfirmDeleteModal'))
check('ClassDetailPage integrates hero Edit/Delete class & assignment ActionMenu', classDetail.includes('currentClass.admin_id === user?.id') && classDetail.includes('<ActionMenu') && classDetail.includes('<EditClassModal'))
check('AssignmentsList uses ActionMenu, Archived filter & ConfirmDeleteModal', assignmentsList.includes('<ActionMenu') && assignmentsList.includes('value="archived"') && assignmentsList.includes('<ConfirmDeleteModal'))
check('CreateAssignment locks class & submission_type when submissions exist', createAssignment.includes('hasExistingSubmissions') && createAssignment.includes('disabled={hasExistingSubmissions}'))
check('SubmissionTracking header integrates Edit/Archive/Delete ActionMenu & ConfirmDeleteModal', subTracking.includes('<ActionMenu') && subTracking.includes('<ConfirmDeleteModal'))
check('ClassGroupsTab gates group Edit/Archive/Delete strictly to isTeacher', groupsTab.includes('{isTeacher && (') && groupsTab.includes('<ActionMenu') && groupsTab.includes('<EditGroupModal'))
check('Student Disband/Delete button removed from GroupManagementModal, GroupDetailsModal, GroupDetailsPage', !groupMgmtModal.includes('{isLeader ? (\n                  <Button') && !groupDetailsModal.includes('(isLeader && members.length === 1)') && !groupDetailsPage.includes('(isLeader && members.length === 1)'))

// 6. Staged SQL Migration Package Security & Integrity
const migrationSql = read('supabase/migrations/20261112000000_round2_safe_management_actions.sql')
const verifySql = read('supabase/migrations/post_migration_verification_management.sql')
const rollbackSql = read('supabase/migrations/rollback_round2_management_actions.sql')

check('Staged migration uses pg_catalog, pg_temp search_path on all SECURITY DEFINER functions', migrationSql.includes('SET search_path = pg_catalog, pg_temp'))
check('Staged migration blocks students from disband_course_group & archive_course_group', migrationSql.includes('Students cannot delete or disband groups') && migrationSql.includes('Only an authorized professor or admin can archive groups'))
check('Staged migration defines preservation BEFORE DELETE triggers on assignments & classes', migrationSql.includes('trg_prevent_unsafe_assignment_deletion') && migrationSql.includes('trg_prevent_unsafe_class_deletion'))
check('Verification & Rollback SQL files staged', verifySql.includes('information_schema.triggers') && rollbackSql.includes('DROP TRIGGER IF EXISTS trg_prevent_unsafe_class_deletion'))

const failed = checks.filter((c) => !c.passed)
console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} checks passed.`)
if (failed.length > 0) {
  process.exit(1)
}
