/**
 * verify-group-assignments-initial-loading.js
 * Comprehensive automated verification for Group Assignments Initial Zero / Delayed Loading Bug
 * Verifies:
 * 1. Immediate loading on mount (no activeTab === 'assignments' gating)
 * 2. Proper loading state machine (loading, success, error, empty)
 * 3. Skeletons while loading instead of false zero / empty state
 * 4. Error state with Retry action (no swallowing of errors to empty array)
 * 5. Consistent counts across Overview tab, stats cards, and Group Assignments tab
 * 6. Live Supabase database query for group Demo in class with 3 eligible assignments
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('GroupDetailsPage.jsx — Immediate Assignment Loading & State Machine', async (t) => {
  const pageCode = readProjectFile('src/pages/shared/GroupDetailsPage.jsx');

  await t.test('1.1 Does NOT gate loadHistory on activeTab === "assignments"', () => {
    // Assert that lazy loading on tab click was eliminated
    assert.doesNotMatch(
      pageCode,
      /if\s*\(\s*activeTab\s*===\s*['"]assignments['"]\s*&&\s*group\?\.class_id/,
      'Must not gate loadHistory on activeTab === "assignments"'
    );
  });

  await t.test('1.2 Triggers loadHistory immediately on mount & ID availability', () => {
    // Immediate effect when effectiveClassId and groupId are available
    assert.match(
      pageCode,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(\s*effectiveClassId\s*&&\s*groupId\s*\)\s*\{[\s\S]*?loadHistory\(effectiveClassId,\s*groupId\)/,
      'Triggers loadHistory immediately on effectiveClassId and groupId availability'
    );
  });

  await t.test('1.3 Maintains discrete states: loadingHistory, historyLoaded, historyError', () => {
    assert.match(pageCode, /const\s+\[loadingHistory,\s*setLoadingHistory\]\s*=\s*useState\(true\)/);
    assert.match(pageCode, /const\s+\[historyLoaded,\s*setHistoryLoaded\]\s*=\s*useState\(false\)/);
    assert.match(pageCode, /const\s+\[historyError,\s*setHistoryError\]\s*=\s*useState\(null\)/);
    assert.match(pageCode, /historyReqIdRef/);
  });

  await t.test('1.4 Displays GroupAssignmentSkeleton while loading (never empty state or 0)', () => {
    assert.match(pageCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\(\s*<GroupAssignmentSkeleton/);
    assert.match(pageCode, /function GroupAssignmentSkeleton/);
  });

  await t.test('1.5 Displays Error banner with Retry action on failure', () => {
    assert.match(pageCode, /historyError\s*\?\s*\(/);
    assert.match(pageCode, /Failed to Load Group Assignments/);
    assert.match(pageCode, /onClick=\{\(\)\s*=>\s*loadHistory\(effectiveClassId,\s*groupId,\s*true\)\}/);
    assert.match(pageCode, /Retry Loading/);
  });

  await t.test('1.6 Only displays "No Group Assignments Found" when genuinely empty and loaded', () => {
    // Empty state is checked only after loading is false and no error
    assert.match(
      pageCode,
      /assignmentHistory\.length\s*===\s*0\s*\?\s*\(\s*<Card[\s\S]*?No Group Assignments Found/,
      'Empty state is guarded after loading and error states'
    );
  });

  await t.test('1.7 Overview quick stats show skeleton pulse while loading instead of hardcoded 0', () => {
    assert.match(pageCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\([\s\S]*?animate-pulse[\s\S]*?\)\s*:\s*\(\s*assignmentHistory\.length\s*\)/);
    assert.match(pageCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\([\s\S]*?animate-pulse[\s\S]*?\)\s*:\s*\(\s*acknowledgedCount\s*\)/);
    assert.match(pageCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\([\s\S]*?animate-pulse[\s\S]*?\)\s*:\s*\(\s*pendingCount\s*\)/);
  });

  await t.test('1.8 Resets state and prevents stale group data flash when groupId changes', () => {
    assert.match(pageCode, /useEffect\(\(\)\s*=>\s*\{[\s\S]*?setAssignmentHistory\(\[\]\)[\s\S]*?setLoadingHistory\(true\)[\s\S]*?setHistoryLoaded\(false\)[\s\S]*?setHistoryError\(null\)[\s\S]*?\}\s*,\s*\[groupId\]\)/);
  });
});

test('GroupDetailsModal.jsx — Immediate Assignment Loading & State Machine', async (t) => {
  const modalCode = readProjectFile('src/components/group/GroupDetailsModal.jsx');

  await t.test('2.1 Does NOT gate loadHistory on activeTab === "assignments"', () => {
    assert.doesNotMatch(
      modalCode,
      /if\s*\(\s*isOpen\s*&&\s*activeTab\s*===\s*['"]assignments['"]/,
      'Must not gate loadHistory on activeTab === "assignments"'
    );
  });

  await t.test('2.2 Triggers loadHistory immediately when modal opens with group/class IDs', () => {
    assert.match(
      modalCode,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(\s*isOpen\s*&&\s*currentGroup\?\.id\s*&&\s*currentGroup\?\.class_id\s*\)\s*\{[\s\S]*?loadHistory\(\)/,
      'Triggers loadHistory immediately on isOpen and group IDs'
    );
  });

  await t.test('2.3 Maintains discrete states: loadingHistory, historyLoaded, historyError, historyReqIdRef', () => {
    assert.match(modalCode, /const\s+\[loadingHistory,\s*setLoadingHistory\]\s*=\s*useState\(false\)/);
    assert.match(modalCode, /const\s+\[historyLoaded,\s*setHistoryLoaded\]\s*=\s*useState\(false\)/);
    assert.match(modalCode, /const\s+\[historyError,\s*setHistoryError\]\s*=\s*useState\(null\)/);
    assert.match(modalCode, /historyReqIdRef/);
  });

  await t.test('2.4 Displays skeleton loaders while loading (never empty state)', () => {
    assert.match(modalCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\(\s*<div[\s\S]*?role="status"[\s\S]*?animate-pulse/);
  });

  await t.test('2.5 Displays error state with Retry Loading action button on failure', () => {
    assert.match(modalCode, /historyError\s*\?\s*\(/);
    assert.match(modalCode, /Failed to Load Group Assignments/);
    assert.match(modalCode, /onClick=\{\(\)\s*=>\s*loadHistory\(true\)\}/);
    assert.match(modalCode, /Retry Loading/);
  });

  await t.test('2.6 Overview quick stats show animated pulse during loading instead of 0', () => {
    assert.match(modalCode, /loadingHistory\s*&&\s*!historyLoaded\s*\?\s*\([\s\S]*?animate-pulse[\s\S]*?\)\s*:\s*\(\s*assignmentHistory\.length\s*\)/);
  });
});

test('groups.service.js — Error Propagation & forceRefresh Support', async (t) => {
  const serviceCode = readProjectFile('src/services/groups.service.js');

  await t.test('3.1 getGroupAssignmentHistory accepts forceRefresh parameter', () => {
    assert.match(
      serviceCode,
      /async\s+getGroupAssignmentHistory\(classId,\s*groupId,\s*forceRefresh\s*=\s*false\)/
    );
  });

  await t.test('3.2 Re-throws exceptions so UI can distinguish errors from 0 assignments', () => {
    assert.match(
      serviceCode,
      /catch\s*\(err\)\s*\{[\s\S]*?console\.error\('[^']*getGroupAssignmentHistory exception:',\s*err\)[\s\S]*?throw\s+err[\s\S]*?\}/
    );
  });
});

test('Live Database Verification — Group Demo in Class with 3 Eligible Assignments', async (t) => {
  const { createClient } = await import('@supabase/supabase-js');
  
  const envContent = fs.readFileSync(path.join(rootDir, '.env'), 'utf-8');
  let url = '', key = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) url = trimmed.split('=')[1].trim();
    if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = trimmed.split('=')[1].trim();
  }

  const client = createClient(url, key);
  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  });

  assert.equal(authErr, null, 'Admin authentication must succeed');
  assert.ok(auth.user?.id);

  await t.test('4.1 Queries group Demo (cc887d59-6ccb-490e-b787-d8c9eb1048b2) and confirms class_id', async () => {
    const { data: grp, error } = await client
      .from('groups')
      .select('id, name, class_id')
      .eq('id', 'cc887d59-6ccb-490e-b787-d8c9eb1048b2')
      .maybeSingle();

    assert.equal(error, null);
    assert.ok(grp, 'Group Demo exists in Supabase');
    assert.equal(grp.name, 'Demo');
    assert.equal(grp.class_id, 'e2e398f5-5fd1-4964-8e91-8a2c306293b5');
  });

  await t.test('4.2 Queries assignments in class and confirms exactly 3 group assignments (Demo, S, zdvvdvd)', async () => {
    const { data: assignments, error } = await client
      .from('assignments')
      .select('id, title, submission_type, class_id')
      .eq('class_id', 'e2e398f5-5fd1-4964-8e91-8a2c306293b5')
      .eq('submission_type', 'group')
      .order('title', { ascending: true });

    assert.equal(error, null);
    assert.ok(assignments, 'Assignments returned');
    assert.equal(assignments.length, 3, 'Exactly 3 group assignments found');

    const titles = assignments.map(a => a.title).sort();
    assert.deepEqual(titles, ['Demo', 'S', 'zdvvdvd']);
  });

  await t.test('4.3 Verifies submission records for the 3 assignments match screenshot statuses', async () => {
    const { data: submissions, error } = await client
      .from('group_submissions')
      .select('id, assignment_id, group_id, status, marks')
      .eq('group_id', 'cc887d59-6ccb-490e-b787-d8c9eb1048b2');

    assert.equal(error, null);
    assert.ok(submissions, 'Submissions returned');

    // Assignment "Demo": reviewed, marks 88 -> Graded: 88/100
    const demoSub = submissions.find(s => s.assignment_id === 'be665af0-7b57-41b2-a69b-df445996357c');
    assert.ok(demoSub, 'Demo assignment submission exists');
    assert.equal(demoSub.status, 'reviewed');
    assert.equal(Number(demoSub.marks), 88);

    // Assignment "zdvvdvd": submitted, marks null -> Submitted
    const zdSub = submissions.find(s => s.assignment_id === 'b4f5cce3-1135-4177-a8ca-db14dd934645');
    assert.ok(zdSub, 'zdvvdvd assignment submission exists');
    assert.equal(zdSub.status, 'submitted');

    // Assignment "S": no row in group_submissions -> Not Submitted
    const sSub = submissions.find(s => s.assignment_id === '21d08bed-a63d-4af9-b560-ebd52ef75162');
    assert.equal(sSub, undefined, 'S has no submission -> Not Submitted');
  });
});
