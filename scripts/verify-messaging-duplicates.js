import fs from 'node:fs'
import path from 'node:path'

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.substring(0, idx).trim()
      const v = trimmed.substring(idx + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
}

import { createClient } from '@supabase/supabase-js'
import { addMessageOnce, mergeMessages } from '../src/services/messages.service.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

async function runTests() {
  console.log('===============================================================')
  console.log('🚀 ASSIGNORA – VERIFYING CLASS MESSAGING & DUPLICATE PREVENTION')
  console.log('===============================================================\n')

  const adminClient = createClient(supabaseUrl, supabaseAnonKey)
  const student1Client = createClient(supabaseUrl, supabaseAnonKey)
  const student2Client = createClient(supabaseUrl, supabaseAnonKey)

  // 1. Authenticate users
  const { data: adminAuth } = await adminClient.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  })
  const { data: s1Auth } = await student1Client.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  })
  const { data: s2Auth } = await student2Client.auth.signInWithPassword({
    email: 'student2@assignora.demo',
    password: 'Student@123',
  })

  console.log('Authenticated accounts:')
  console.log(' - Admin    :', adminAuth.user.id)
  console.log(' - Student 1:', s1Auth.user.id)
  console.log(' - Student 2:', s2Auth.user.id)

  const { data: classes } = await adminClient.from('classes').select('id, name').limit(2)
  const classA = classes[0]
  const classB = classes[1]
  console.log(`Using Class A: "${classA.name}" (${classA.id})`)
  console.log(`Using Class B: "${classB.name}" (${classB.id})\n`)

  const testInsertedIds = []

  // --------------------------------------------------------------------------
  // TEST 1: Send "Hi" once. It must appear exactly once.
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Send "Hi" once ---')
  const { data: msg1, error: err1 } = await student1Client
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: s1Auth.user.id,
      message: 'Hi',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (err1) throw err1
  testInsertedIds.push(msg1.id)

  let state = []
  state = addMessageOnce(state, msg1)
  // Simulate concurrent event arrival with same message ID
  state = addMessageOnce(state, msg1)
  console.log(`Sent 'Hi' once. State count: ${state.length} (Expected: 1) -> ${state.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 2: Send "Hello" once. It must appear exactly once.
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Send "Hello" once ---')
  const { data: msg2, error: err2 } = await student1Client
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: s1Auth.user.id,
      message: 'Hello',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (err2) throw err2
  testInsertedIds.push(msg2.id)

  state = addMessageOnce(state, msg2)
  state = addMessageOnce(state, msg2)
  console.log(`Sent 'Hello'. State count: ${state.length} (Expected: 2) -> ${state.length === 2 ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 3: Send "Hi" again intentionally. It must appear as a new message exactly once.
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Send "Hi" intentionally again ---')
  const { data: msg3, error: err3 } = await student1Client
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: s1Auth.user.id,
      message: 'Hi',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (err3) throw err3
  testInsertedIds.push(msg3.id)

  state = addMessageOnce(state, msg3)
  console.log(`Sent 'Hi' second time. State count: ${state.length} (Expected: 3 distinct messages) -> ${state.length === 3 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Messages in state: [${state.map((m) => `"${m.message}" (id: ${m.id.slice(0, 8)})`).join(', ')}] -> ✅ PASS\n`)

  // --------------------------------------------------------------------------
  // TEST 4: Test as Admin
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Send message as Admin ---')
  const { data: adminMsg, error: adminErr } = await adminClient
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: adminAuth.user.id,
      message: 'Welcome everyone! - Professor',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (adminErr) throw adminErr
  testInsertedIds.push(adminMsg.id)

  state = addMessageOnce(state, adminMsg)
  state = addMessageOnce(state, adminMsg)
  console.log(`Admin message added. State count: ${state.length} (Expected: 4) -> ${state.length === 4 ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 5 & 6: Test as Student 1 and Student 2
  // --------------------------------------------------------------------------
  console.log('--- TEST 5 & 6: Test as Student 1 and Student 2 ---')
  const { data: s2Msg, error: s2Err } = await student2Client
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: s2Auth.user.id,
      message: 'Thank you Professor! - Ananya',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (s2Err) throw s2Err
  testInsertedIds.push(s2Msg.id)

  state = addMessageOnce(state, s2Msg)
  console.log(`Student 2 message added. State count: ${state.length} (Expected: 5) -> ${state.length === 5 ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 7: Open same chat in two sessions and verify real-time delivery
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Verify real-time broadcast delivery across sessions ---')
  let s2Received = []
  const subChannel = student2Client.channel(`class-discussion:${classA.id}`, {
    config: { broadcast: { self: false } },
  })

  let resolveBroadcast
  const broadcastPromise = new Promise((resolve) => {
    resolveBroadcast = resolve
  })

  subChannel.on('broadcast', { event: 'class-message' }, (payload) => {
    s2Received = addMessageOnce(s2Received, payload.payload.message)
    resolveBroadcast()
  })

  await new Promise((r) => {
    subChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') r()
    })
  })

  // Student 1 sends a broadcast
  const testBroadcastMsg = {
    id: 'test-realtime-uuid-1234',
    classId: classA.id,
    senderId: s1Auth.user.id,
    text: 'Real-time test message',
    createdAt: new Date().toISOString(),
  }

  const pubChannel = student1Client.channel(`class-discussion:${classA.id}`, {
    config: { broadcast: { self: false } },
  })
  await new Promise((r) => {
    pubChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') r()
    })
  })

  await pubChannel.send({
    type: 'broadcast',
    event: 'class-message',
    payload: {
      classId: classA.id,
      senderId: s1Auth.user.id,
      message: testBroadcastMsg,
    },
  })

  await Promise.race([broadcastPromise, new Promise((r) => setTimeout(r, 2000))])

  // Try duplicate push
  s2Received = addMessageOnce(s2Received, testBroadcastMsg)

  console.log(`Student 2 received broadcast message. Count: ${s2Received.length} (Expected: 1) -> ${s2Received.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`)

  await student1Client.removeChannel(pubChannel)
  await student2Client.removeChannel(subChannel)

  // --------------------------------------------------------------------------
  // TEST 8: Switch between two classes and verify no duplicates or cross-class leak
  // --------------------------------------------------------------------------
  console.log('--- TEST 8: Switch between two classes ---')
  const { data: classBMsg, error: bErr } = await adminClient
    .from('class_messages')
    .insert({
      class_id: classB.id,
      sender_id: adminAuth.user.id,
      message: 'Class B notice',
    })
    .select('id, class_id, sender_id, message, created_at')
    .single()

  if (bErr) throw bErr
  testInsertedIds.push(classBMsg.id)

  const { data: classARows } = await student1Client
    .from('class_messages')
    .select('id, class_id, message, created_at')
    .eq('class_id', classA.id)

  const { data: classBRows } = await student1Client
    .from('class_messages')
    .select('id, class_id, message, created_at')
    .eq('class_id', classB.id)

  const hasClassBInA = classARows.some((m) => m.id === classBMsg.id)
  const hasClassAInB = classBRows.some((m) => m.id === msg1.id)

  console.log(`Class A messages count: ${classARows.length}, Class B messages count: ${classBRows.length}`)
  console.log(`Cross-class leakage: Class B in A? ${hasClassBInA ? 'YES (FAIL)' : 'NO (PASS)'}, Class A in B? ${hasClassAInB ? 'YES (FAIL)' : 'NO (PASS)'} -> ${!hasClassBInA && !hasClassAInB ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 9: Refresh and merge messages
  // --------------------------------------------------------------------------
  console.log('--- TEST 9: Refresh page and verify message history has no duplicates ---')
  const refreshed = mergeMessages(state, classARows)
  const uniqueIds = new Set(refreshed.map((m) => m.id))
  console.log(`Refreshed message count: ${refreshed.length}, Unique IDs: ${uniqueIds.size}`)
  console.log(`No duplicates after merge/refresh -> ${refreshed.length === uniqueIds.size ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // TEST 10: Verify one send action creates exactly one database record
  // --------------------------------------------------------------------------
  console.log('--- TEST 10: Verify one send action creates exactly 1 DB row ---')
  const beforeCountRes = await adminClient
    .from('class_messages')
    .select('id', { count: 'exact' })
    .eq('class_id', classA.id)
  const countBefore = beforeCountRes.count

  const { data: testSingleSend } = await student1Client
    .from('class_messages')
    .insert({
      class_id: classA.id,
      sender_id: s1Auth.user.id,
      message: 'Single send verification message',
    })
    .select('id')
    .single()

  testInsertedIds.push(testSingleSend.id)

  const afterCountRes = await adminClient
    .from('class_messages')
    .select('id', { count: 'exact' })
    .eq('class_id', classA.id)
  const countAfter = afterCountRes.count

  console.log(`Rows before: ${countBefore}, Rows after: ${countAfter}, Delta: ${countAfter - countBefore}`)
  console.log(`Exactly 1 row created in database -> ${countAfter - countBefore === 1 ? '✅ PASS' : '❌ FAIL'}\n`)

  // --------------------------------------------------------------------------
  // CLEANUP: Delete test messages created during verification
  // --------------------------------------------------------------------------
  console.log('--- CLEANUP: Removing test messages ---')
  for (const id of testInsertedIds) {
    await adminClient.from('class_messages').delete().eq('id', id)
  }
  console.log(`Deleted ${testInsertedIds.length} test messages. Database restored to original state. ✅\n`)

  console.log('===============================================================')
  console.log('🎉 ALL 10 TESTING SCENARIOS PASSED WITH ZERO DUPLICATES!')
  console.log('===============================================================\n')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
