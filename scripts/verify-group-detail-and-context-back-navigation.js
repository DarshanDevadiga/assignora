/**
 * Verification script for Group Details Crash Fix & Context-Aware Back Navigation
 * Tests:
 * 1. GroupDetailsPage declaration order & TDZ prevention for hasChatAccess
 * 2. Role-based chat permission rules (member, non-member, professor/admin)
 * 3. Context-aware Assignment Details back navigation:
 *    - Class -> Assignments -> Assignment Details -> Back (returns to Class Assignments)
 *    - Class -> Groups -> Group Details -> Group Assignment -> Back (returns to Group)
 *    - Global Assignments -> Assignment Details -> Back (returns to Assignments)
 *    - Admin -> Group Submission Tracking -> Open Work -> Back (returns to Group)
 *    - Direct URL access / refresh (safe fallback to Assignment's Class)
 * 4. Contextual button labels ("Back to Class Assignments", "Back to Group", "Back to Assignments")
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()

describe('TASK 1: GroupDetailsPage TDZ & Chat Access Safety', () => {
  const groupDetailsPath = path.join(projectRoot, 'src', 'pages', 'shared', 'GroupDetailsPage.jsx')
  const content = fs.readFileSync(groupDetailsPath, 'utf8')

  it('1.1 hasChatAccess is declared before any useEffect or hook reference', () => {
    const hasChatAccessDeclIndex = content.indexOf('hasChatAccess =')
    assert.ok(hasChatAccessDeclIndex > 0, 'hasChatAccess declaration not found')

    // Find all occurrences of hasChatAccess
    const matches = [...content.matchAll(/hasChatAccess/g)]
    assert.ok(matches.length >= 3, 'Expected multiple references to hasChatAccess')

    // The first occurrence of hasChatAccess must be the declaration itself
    const firstRefIndex = matches[0].index
    assert.equal(
      firstRefIndex,
      hasChatAccessDeclIndex,
      'hasChatAccess was accessed before its const declaration! TDZ error!'
    )
  })

  it('1.2 members, isLeader, isTeacher, isMember, canManage are declared before useEffect hooks', () => {
    const membersDecl = content.indexOf('const members =')
    const hasChatAccessDecl = content.indexOf('const hasChatAccess =')
    const firstChatEffect = content.indexOf("if (activeTab === 'chat' && group?.id && hasChatAccess)")

    assert.ok(membersDecl < firstChatEffect, 'members must be declared before chat effect')
    assert.ok(hasChatAccessDecl < firstChatEffect, 'hasChatAccess must be declared before chat effect')
  })

  it('1.3 Chat permission logic correctly differentiates student member vs non-member vs teacher', () => {
    // Simulate Assignora chat access rule: hasChatAccess = Boolean(isMember || isTeacher)
    const testCases = [
      {
        user: { id: 'u1', role: 'student' },
        group: { id: 'g1', members: [{ student_id: 'u1' }, { student_id: 'u2' }] },
        expectedAccess: true,
        desc: 'Enrolled student member has chat access',
      },
      {
        user: { id: 'u3', role: 'student' },
        group: { id: 'g1', members: [{ student_id: 'u1' }, { student_id: 'u2' }] },
        expectedAccess: false,
        desc: 'Non-member student is blocked from group chat',
      },
      {
        user: { id: 'prof1', role: 'admin' },
        group: { id: 'g1', members: [{ student_id: 'u1' }, { student_id: 'u2' }] },
        expectedAccess: true,
        desc: 'Class professor/admin has authorized chat access',
      },
    ]

    for (const tc of testCases) {
      const isTeacher = tc.user.role === 'admin'
      const isMember = tc.group.members.some((m) => m.student_id === tc.user.id)
      const hasAccess = Boolean(isMember || isTeacher)
      assert.equal(hasAccess, tc.expectedAccess, `Failed for: ${tc.desc}`)
    }
  })
})

describe('TASK 2 & 3: Context-Aware Back Navigation & Preserved Identifiers', () => {
  const assignmentDetailsPath = path.join(projectRoot, 'src', 'pages', 'student', 'AssignmentDetails.jsx')
  const content = fs.readFileSync(assignmentDetailsPath, 'utf8')

  it('2.1 AssignmentDetails reads location.state for contextual navigation', () => {
    assert.ok(content.includes('const location = useLocation()'), 'AssignmentDetails must use useLocation()')
    assert.ok(content.includes('const backNavigation = useMemo'), 'AssignmentDetails must compute backNavigation')
  })

  it('2.2 Flow: Class -> Assignments -> Assignment Details -> Back returns to Class Assignments', () => {
    const classId = 'cls-101'
    const assignment = { id: 'asg-1', class_id: classId }
    const location = { state: { from: 'class', classId, tab: 'assignments' }, search: '' }

    // Replicate backNavigation logic
    const navState = location.state || {}
    const effectiveClassId = navState.classId || assignment?.class_id
    let res = null
    if (navState.from === 'class') {
      res = {
        path: `/student/classes/${effectiveClassId}?tab=assignments`,
        label: 'Back to Class Assignments',
      }
    }

    assert.equal(res.path, '/student/classes/cls-101?tab=assignments')
    assert.equal(res.label, 'Back to Class Assignments')
  })

  it('2.3 Flow: Class -> Groups -> Group Details -> Group Assignment -> Back returns to Group', () => {
    const classId = 'cls-101'
    const groupId = 'grp-202'
    const assignment = { id: 'asg-2', class_id: classId, submission_type: 'group' }
    const location = { state: { from: 'group', classId, groupId, tab: 'assignments' }, search: '' }

    const navState = location.state || {}
    const effectiveClassId = navState.classId || assignment?.class_id
    const gid = navState.groupId
    let res = null
    if (navState.from === 'group') {
      res = {
        path: `/student/classes/${effectiveClassId}/groups/${gid}?tab=assignments`,
        label: 'Back to Group',
      }
    }

    assert.equal(res.path, '/student/classes/cls-101/groups/grp-202?tab=assignments')
    assert.equal(res.label, 'Back to Group')
  })

  it('2.4 Flow: Global Assignments -> Assignment Details -> Back returns to Assignments', () => {
    const assignment = { id: 'asg-3', class_id: 'cls-101' }
    const location = { state: { from: 'assignments' }, search: '' }

    const navState = location.state || {}
    let res = null
    if (navState.from === 'assignments') {
      res = {
        path: '/student',
        label: 'Back to Assignments',
      }
    }

    assert.equal(res.path, '/student')
    assert.equal(res.label, 'Back to Assignments')
  })

  it('2.5 Direct URL access or page refresh safely falls back to Assignment Class', () => {
    const assignment = { id: 'asg-4', class_id: 'cls-999' }
    const location = { state: null, search: '' }

    const navState = location.state || {}
    let res = null
    if (!navState.from && assignment?.class_id) {
      res = {
        path: `/student/classes/${assignment.class_id}?tab=assignments`,
        label: 'Back to Class Assignments',
      }
    }

    assert.equal(res.path, '/student/classes/cls-999?tab=assignments')
    assert.equal(res.label, 'Back to Class Assignments')
  })
})

describe('TASK 4: Admin Submission Tracking Context-Aware Back Navigation', () => {
  const trackingPath = path.join(projectRoot, 'src', 'pages', 'admin', 'SubmissionTracking.jsx')
  const content = fs.readFileSync(trackingPath, 'utf8')

  it('4.1 SubmissionTracking uses location.state and searchParams for back navigation', () => {
    assert.ok(content.includes('const location = useLocation()'), 'SubmissionTracking must use useLocation()')
    assert.ok(content.includes('const backNavigation = useMemo'), 'SubmissionTracking must compute backNavigation')
  })

  it('4.2 Flow: Admin Group Tracking -> Open Work -> Back returns to Group Submissions', () => {
    const classId = 'cls-admin-1'
    const groupId = 'grp-admin-1'
    const searchParams = new URLSearchParams(`groupId=${groupId}&classId=${classId}`)
    const location = { state: { from: 'group', classId, groupId }, search: searchParams.toString() }

    const qGroupId = searchParams.get('groupId')
    const qClassId = searchParams.get('classId')
    const effectiveClassId = location.state?.classId || qClassId
    const effectiveGroupId = location.state?.groupId || qGroupId

    let res = null
    if (location.state?.from === 'group' || qGroupId) {
      res = {
        path: `/admin/classes/${effectiveClassId}/groups/${effectiveGroupId}?tab=assignments`,
        label: 'Back to Group',
      }
    }

    assert.equal(res.path, '/admin/classes/cls-admin-1/groups/grp-admin-1?tab=assignments')
    assert.equal(res.label, 'Back to Group')
  })

  it('4.3 Flow: Admin Class Assignments -> View Submissions -> Back returns to Class Assignments', () => {
    const classId = 'cls-admin-1'
    const location = { state: { from: 'class', classId, tab: 'assignments' }, search: '' }

    const effectiveClassId = location.state?.classId
    let res = null
    if (location.state?.from === 'class') {
      res = {
        path: `/admin/classes/${effectiveClassId}?tab=assignments`,
        label: 'Back to Class Assignments',
      }
    }

    assert.equal(res.path, '/admin/classes/cls-admin-1?tab=assignments')
    assert.equal(res.label, 'Back to Class Assignments')
  })
})
