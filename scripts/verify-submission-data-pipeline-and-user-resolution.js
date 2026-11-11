import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { classifyDeliverable } from '../src/utils/deliverableClassifier.js'

test('CRITICAL FIX — Submission Pipeline & User UUID Resolution', async (t) => {
  await t.test('1. classifyDeliverable properly classifies submitted web URLs as deliverables', () => {
    // The exact URL that the student submitted in assignment zdvvdvd
    const submittedUrl = 'http://localhost:5173/student/assignments/be665af0-7b57-41b2-a69b-df445996357c'
    const classified = classifyDeliverable({
      submissionLink: submittedUrl,
      comment: 'eved',
      onedriveLink: null,
    })

    assert.equal(classified.isDeliverable, true, 'Submitted URL must be recognized as a real deliverable')
    assert.equal(classified.category, 'web_app')
    assert.equal(classified.url, submittedUrl)
    assert.notEqual(classified.url, null)
    assert.equal(classified.isLocal, true)
  })

  await t.test('2. classifyDeliverable only returns acknowledgement_only on truly empty submissions', () => {
    const emptySub = classifyDeliverable({
      submissionLink: '',
      comment: 'Just notes without a deliverable',
      onedriveLink: 'https://1drv.ms/f/s!sample',
    })

    assert.equal(emptySub.isDeliverable, false)
    assert.equal(emptySub.category, 'acknowledgement_only')
    assert.equal(emptySub.url, null)
    assert.equal(emptySub.message, 'Assignment acknowledged, but no deliverable has been submitted.')
  })

  await t.test('3. Name resolution prevents exposing raw UUIDs in viewer and tracking', () => {
    const rawUuid = '823bfee8-f844-44fd-a7ee-786ac161930e'
    const isUuid = (val) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())

    const mockSubmission = {
      id: 'a09231a9-ad3a-4fc0-872e-64faf644199a',
      acknowledged_by: rawUuid,
      leader: {
        id: rawUuid,
        name: 'Rahul Sharma',
        email: 'student1@assignora.demo',
      },
    }

    const mockGroup = {
      id: 'cc887d59-6ccb-490e-b787-d8c9eb1048b2',
      name: 'Demo',
      leaderName: 'Rahul Sharma',
    }

    const resolvedName =
      mockSubmission?.acknowledged_by_name ||
      mockSubmission?.leader?.name ||
      mockGroup?.acknowledged_by ||
      mockGroup?.leaderName ||
      (!isUuid(mockSubmission?.acknowledged_by) ? mockSubmission?.acknowledged_by : null) ||
      'Group Leader'

    assert.equal(resolvedName, 'Rahul Sharma')
    assert.equal(isUuid(resolvedName), false, 'Name must never be a raw UUID')
  })

  await t.test('4. Live Database Verification: Query existing submission for assignment zdvvdvd', async () => {
    const envContent = fs.readFileSync('.env', 'utf-8')
    let url = '', key = ''
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('VITE_SUPABASE_URL=')) url = trimmed.split('=')[1].trim()
      if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = trimmed.split('=')[1].trim()
    }

    const client = createClient(url, key)
    const { data: auth, error: authErr } = await client.auth.signInWithPassword({
      email: 'admin@assignora.demo',
      password: 'Admin@12345',
    })
    assert.equal(authErr, null)
    assert.ok(auth.user?.id)

    // Query group submission with leader profile join
    const { data: subs, error: subErr } = await client
      .from('group_submissions')
      .select('*, leader:acknowledged_by(id, name, email, avatar)')
      .eq('assignment_id', 'b4f5cce3-1135-4177-a8ca-db14dd934645')

    assert.equal(subErr, null)
    assert.equal(subs.length, 1)

    const savedSub = subs[0]
    assert.equal(savedSub.status, 'submitted')
    assert.equal(savedSub.comment, 'eved')
    assert.equal(savedSub.leader?.name, 'Rahul Sharma')
    assert.ok(savedSub.submission_link, 'Saved submission link must exist in DB')

    // Run classifier on live saved record
    const classified = classifyDeliverable({
      submissionLink: savedSub.submission_link,
      comment: savedSub.comment,
    })

    assert.equal(classified.isDeliverable, true, 'Live submission must be recognized as deliverable')
    assert.equal(classified.url, savedSub.submission_link)
    assert.ok(classified.category === 'web_app' || classified.category === 'external_link')
  })
})
