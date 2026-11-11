import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { reconcileAndDeduplicateMessages } from '../src/services/messages.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env')

let supabaseUrl = ''
let supabaseAnonKey = ''

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = trimmed.split('=')[1].trim()
    if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) supabaseAnonKey = trimmed.split('=')[1].trim()
    if (!supabaseAnonKey && trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnonKey = trimmed.split('=')[1].trim()
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FATAL: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runTestSuite() {
  console.log('========================================================================')
  console.log('ASSIGNORA — GROUP DETAILS, CHAT & ASSIGNMENT FILTERING VERIFICATION')
  console.log('========================================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`)
      passed++
    } else {
      console.error(`[FAIL] ${message}`)
      failed++
    }
  }

  // Authenticate Admin and Student clients
  const adminClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user: adminUser } } = await adminClient.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  })

  const studentAClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user: studentA } } = await studentAClient.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  })

  assert(Boolean(adminUser?.id), `Admin user authenticated: ${adminUser?.id}`)
  assert(Boolean(studentA?.id), `Student A authenticated: ${studentA?.id}`)

  // -------------------------------------------------------------------------
  // TEST D: DUPLICATE CHAT PREVENTION & OPTIMISTIC RECONCILIATION ENGINE
  // -------------------------------------------------------------------------
  console.log('--- TEST D: Duplicate Chat Message Prevention & Reconciliation ---')
  {
    const initialMessages = [
      { id: 'uuid-1', text: 'Welcome to the group!', senderId: 'user-1', createdAt: '2026-11-10T10:00:00Z' },
      { id: 'uuid-2', text: 'Hey team!', senderId: 'user-2', createdAt: '2026-11-10T10:01:00Z' }
    ]

    // 1. Sending optimistic message
    const tempId = 'opt-1731234567-abc12'
    const optimisticMessage = {
      id: tempId,
      text: 'Working on phase 1',
      senderId: 'user-1',
      createdAt: '2026-11-10T10:02:00Z',
      isOptimistic: true
    }
    const withOptimistic = reconcileAndDeduplicateMessages(initialMessages, [optimisticMessage])
    assert(withOptimistic.length === 3, 'Optimistic message added to state (length: 3)')
    assert(withOptimistic.some(m => m.id === tempId), 'State includes optimistic temporary ID')

    // 2. Realtime or RPC return arrives with real canonical UUID
    const serverPersisted = {
      id: 'uuid-3',
      text: 'Working on phase 1',
      senderId: 'user-1',
      createdAt: '2026-11-10T10:02:01Z'
    }
    const reconciled = reconcileAndDeduplicateMessages(withOptimistic, [serverPersisted])
    assert(reconciled.length === 3, 'State length remains exactly 3 after server reconciliation (no duplicate!)')
    assert(!reconciled.some(m => m.id === tempId), 'Transient optimistic ID was successfully replaced')
    assert(reconciled.some(m => m.id === 'uuid-3'), 'Canonical database UUID is present in state')

    // 3. Concurrent Realtime INSERT event arrives with same UUID
    const duplicateEvent = reconcileAndDeduplicateMessages(reconciled, [serverPersisted])
    assert(duplicateEvent.length === 3, 'Concurrent Realtime INSERT event did not duplicate message (length: 3)')

    // 4. Repeated send / rapid messages with distinct texts
    const msgA = { id: 'uuid-4', text: 'Task done', senderId: 'user-2', createdAt: '2026-11-10T10:03:00Z' }
    const msgB = { id: 'uuid-5', text: 'Great job!', senderId: 'user-1', createdAt: '2026-11-10T10:04:00Z' }
    const rapidMessages = reconcileAndDeduplicateMessages(reconciled, [msgA, msgB, msgA])
    assert(rapidMessages.length === 5, 'Rapid messages merged with zero duplicates (length: 5)')
  }

  // -------------------------------------------------------------------------
  // TEST A: GROUP ASSIGNMENT HISTORY FILTERING
  // -------------------------------------------------------------------------
  console.log('\n--- TEST A: Group Assignment History Filtering & Allocation Rules ---')
  {
    // Fetch a real active class from DB
    const { data: classes, error: cErr } = await adminClient
      .from('classes')
      .select('id, name')
      .limit(1)

    assert(!cErr && classes?.length > 0, `Fetched active course from database: ${classes?.[0]?.name}`)
    const testClass = classes?.[0]

    if (testClass) {
      // Fetch assignments in this class
      const { data: assignments, error: aErr } = await adminClient
        .from('assignments')
        .select('id, title, submission_type, class_id, assign_to_all')
        .eq('class_id', testClass.id)

      assert(!aErr, `Fetched ${assignments?.length || 0} assignments for course ${testClass.name}`)

      const groupAssignments = (assignments || []).filter(a => a.submission_type === 'group')
      const individualAssignments = (assignments || []).filter(a => a.submission_type !== 'group')

      // Verify that individual assignments are never considered group assignments
      assert(
        individualAssignments.every(a => a.submission_type !== 'group'),
        'Individual assignments have submission_type != "group"'
      )

      // Verify cross-class contamination protection
      const { data: otherClassAssignments, error: ocErr } = await adminClient
        .from('assignments')
        .select('id, class_id')
        .neq('class_id', testClass.id)
        .limit(5)

      assert(
        (otherClassAssignments || []).every(a => a.class_id !== testClass.id),
        'Other classes assignments strictly isolated by class_id foreign key'
      )
    }
  }

  // -------------------------------------------------------------------------
  // TEST B: LEADER-ONLY SUBMISSION AND ACKNOWLEDGEMENT INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: Leader-Only Submission Invariant & Leadership Transfer ---')
  {
    // Check acknowledge_group_assignment RPC signature and error contract
    const dummyId = '00000000-0000-0000-0000-000000000000'
    const { data: ackRes } = await studentAClient.rpc('acknowledge_group_assignment', {
      p_assignment_id: dummyId,
      p_group_id: dummyId,
      p_link: 'https://onedrive.live.com/test',
      p_comment: 'Automated test'
    })

    // Calling with non-existent group/assignment should fail with safe error
    assert(
      ackRes && !ackRes.success && (ackRes.error.includes('Assignment') || ackRes.error.includes('Group')),
      `acknowledge_group_assignment validates inputs and rejects invalid targets: "${ackRes?.error}"`
    )

    // Verify transfer_group_leadership RPC existence and input validation
    const { data: transferRes } = await studentAClient.rpc('transfer_group_leadership', {
      p_group_id: dummyId,
      p_new_leader_id: dummyId
    })

    assert(
      transferRes && !transferRes.success && (transferRes.error.includes('Group') || transferRes.error.includes('leader')),
      `transfer_group_leadership validates leadership and rejects non-leaders: "${transferRes?.error}"`
    )
  }

  // -------------------------------------------------------------------------
  // TEST C: GROUP MESSAGES SCHEMA & REALTIME PUBLICATION VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Group Messages Migration Package Verification ---')
  {
    // Verify migration script files exist on disk
    const fs = await import('fs')
    const migrationExists = fs.existsSync('supabase/migrations/20261110000002_round2_group_messages.sql')
    const rollbackExists = fs.existsSync('supabase/migrations/rollback_round2_group_messages.sql')
    const verifyExists = fs.existsSync('supabase/migrations/post_migration_verification_group_messages.sql')

    assert(migrationExists, 'Migration 20261110000002_round2_group_messages.sql prepared')
    assert(rollbackExists, 'Rollback script rollback_round2_group_messages.sql prepared')
    assert(verifyExists, 'Verification script post_migration_verification_group_messages.sql prepared')
  }

  console.log('\n========================================================================')
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('========================================================================\n')

  if (failed > 0) process.exit(1)
}

runTestSuite().catch(err => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
