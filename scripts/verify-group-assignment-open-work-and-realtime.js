import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('PHASE 2: Group Assignment Open Work Flow', () => {
  const gdpPath = path.resolve('src/pages/shared/GroupDetailsPage.jsx')
  const gdpContent = fs.readFileSync(gdpPath, 'utf8')

  const gdmPath = path.resolve('src/components/group/GroupDetailsModal.jsx')
  const gdmContent = fs.readFileSync(gdmPath, 'utf8')

  const adPath = path.resolve('src/pages/student/AssignmentDetails.jsx')
  const adContent = fs.readFileSync(adPath, 'utf8')

  test('2.1 Student clicking Open Work in GroupDetailsPage routes to /student/assignments/:id', () => {
    // Must NOT gate student routing behind canManage (which caused group leaders to route to /admin)
    assert.match(
      gdpContent,
      /navigate\(\s*`\/student\/assignments\/\$\{item\.id\}`/g,
      'GroupDetailsPage must navigate students to /student/assignments/:id'
    )

    // Professor must navigate to /admin/assignments/:id
    assert.match(
      gdpContent,
      /isTeacher\s*\?\s*\(\s*<Button[\s\S]*?navigate\(\s*`\/admin\/assignments\/\$\{item\.id\}\?groupId=\$\{group\.id\}&classId=\$\{group\.class_id\}`/g,
      'GroupDetailsPage must route teachers to /admin/assignments/:id'
    )
  })

  test('2.2 Student clicking Open Work in GroupDetailsModal routes to /student/assignments/:id', () => {
    assert.match(
      gdmContent,
      /navigate\(`\/student\/assignments\/\$\{item\.id\}`/g,
      'GroupDetailsModal must navigate students to /student/assignments/:id'
    )

    assert.match(
      gdmContent,
      /isTeacher\s*\?\s*\(\s*<Button[\s\S]*?navigate\(\s*`\/admin\/assignments\/\$\{item\.id\}\?groupId=\$\{currentGroup\.id\}&classId=\$\{currentGroup\.class_id\}`/g,
      'GroupDetailsModal must route teachers to /admin/assignments/:id'
    )
  })

  test('2.3 AssignmentDetails contains fallback resolution for groupId from location state or query', () => {
    assert.match(
      adContent,
      /location\.state\?\.groupId/g,
      'AssignmentDetails must inspect location.state.groupId'
    )
    assert.match(
      adContent,
      /getGroupById\(routeGroupId\)/g,
      'AssignmentDetails must fall back to getGroupById if course lookup is pending/cold'
    )
  })

  test('2.4 AssignmentDetails displays complete assignment, OneDrive, and group submission details', () => {
    assert.match(adContent, /assignment\.submission_type === 'group'/, 'Checks submission_type group')
    assert.match(adContent, /assignment\.onedrive_link/, 'Displays OneDrive link')
    assert.match(adContent, /<GroupSubmissionCard/, 'Renders GroupSubmissionCard for verified group submission details')
    assert.match(adContent, /You are not part of any group\. Create or join one to submit this assignment\./, 'Exact required empty group state')

    const gscPath = path.resolve('src/components/submission/GroupSubmissionCard.jsx')
    const gscContent = fs.readFileSync(gscPath, 'utf8')
    assert.match(gscContent, /Acknowledged By:/i, 'Card displays acknowledgement status')
    assert.match(gscContent, /formatDisplayDate\(acknowledgedAt\)/, 'Card displays formatted timestamp')
  })

  test('2.5 Context-aware back navigation returns to referring group with label "Back to Group"', () => {
    assert.match(
      adContent,
      /path:\s*`\/student\/classes\/\$\{effectiveClassId\}\/groups\/\$\{gid\}\?tab=assignments`/,
      'Navigates back to the exact course group'
    )
    assert.match(
      adContent,
      /label:\s*'Back to Group'/,
      'Displays exact label "Back to Group"'
    )
  })
})

describe('PHASE 3: Supabase Realtime Lifecycle & Account Isolation', () => {
  const notifPath = path.resolve('src/context/NotificationContext.jsx')
  const notifContent = fs.readFileSync(notifPath, 'utf8')

  const msgPath = path.resolve('src/services/messages.service.js')
  const msgContent = fs.readFileSync(msgPath, 'utf8')

  const authPath = path.resolve('src/context/AuthContext.jsx')
  const authContent = fs.readFileSync(authPath, 'utf8')

  test('3.1 NotificationContext reuses single global channel without tearing down existing sockets', () => {
    assert.match(
      notifContent,
      /messagesService\.getChannel\(\)/,
      'NotificationContext reuses channel from messagesService'
    )
    assert.match(
      notifContent,
      /channel\.state !== 'joined' && channel\.state !== 'joining'/,
      'Guards against redundant subscribe calls'
    )
  })

  test('3.2 NotificationContext hooks in-memory bus for instant intra-tab delivery', () => {
    assert.match(
      notifContent,
      /messagesService\.subscribe\(handleBroadcast\)/,
      'NotificationContext subscribes to in-memory bus for 0ms delivery'
    )
  })

  test('3.3 messagesService exposes cleanupRealtime to reset channel on logout', () => {
    assert.match(
      msgContent,
      /cleanupRealtime\(\)/,
      'messagesService has cleanupRealtime method'
    )
  })

  test('3.4 AuthContext.signOut invokes messagesService.cleanupRealtime and resets session', () => {
    assert.match(
      authContent,
      /messagesService\.cleanupRealtime\(\)/,
      'AuthContext calls messagesService.cleanupRealtime on logout'
    )
    assert.match(
      authContent,
      /supabase\.removeAllChannels\(\)/,
      'AuthContext calls supabase.removeAllChannels'
    )
    assert.match(
      authContent,
      /sessionStorage\.clear\(\)/,
      'AuthContext purges sessionStorage'
    )
  })
})
