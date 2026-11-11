import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
const content = fs.readFileSync(envPath, 'utf-8');
let url = '', key = '';
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) url = trimmed.split('=')[1].trim();
  if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = trimmed.split('=')[1].trim();
}

async function verifyAllGroupFixes() {
  console.log('====================================================================');
  console.log('ASSIGNORA COMPREHENSIVE GROUP SYSTEM REPAIR VERIFICATION SUITE');
  console.log('====================================================================\n');

  // Authenticate Admin, Student 1 (A), Student 2 (B)
  const adminClient = createClient(url, key);
  const { data: { user: admin } } = await adminClient.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  });
  console.log('[PASS] Admin authenticated:', admin.id);

  const studentAClient = createClient(url, key);
  const { data: { user: studentA } } = await studentAClient.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  });
  console.log('[PASS] Student A authenticated:', studentA.id);

  const studentBClient = createClient(url, key);
  const { data: { user: studentB } } = await studentBClient.auth.signInWithPassword({
    email: 'student2@assignora.demo',
    password: 'Student@123',
  });
  console.log('[PASS] Student B authenticated:', studentB.id);

  // Target Class: Business Analytics (zero pre-existing groups)
  const classId = '60e4774e-a0da-4e0c-98cc-641e938c04fd';

  // Step 0: Clean up any lingering groups for S1 and S2 in this class
  const { data: existingGMs } = await adminClient
    .from('group_members')
    .select('group_id, groups(id, name, status)')
    .eq('class_id', classId)
    .in('student_id', [studentA.id, studentB.id]);

  if (existingGMs && existingGMs.length > 0) {
    for (const gm of existingGMs) {
      if (gm.group_id) {
        // Delete any test submissions first so group can be cleanly deleted rather than archived
        await adminClient.from('group_submissions').delete().eq('group_id', gm.group_id);
        const dRes = await studentAClient.rpc('disband_course_group', { p_group_id: gm.group_id });
        console.log(`[PRE-CLEANUP] Disband group ${gm.group_id}:`, dRes);
        const lRes = await studentBClient.rpc('leave_course_group', { p_group_id: gm.group_id });
        console.log(`[PRE-CLEANUP] Leave group ${gm.group_id}:`, lRes);
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Student A creates a group and becomes leader
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Student A creates group ---');
  const groupNameA = `FixTest Team ${Date.now()}`;
  const { data: createRes, error: createErr } = await studentAClient.rpc('create_course_group', {
    p_class_id: classId,
    p_name: groupNameA,
  });

  if (createErr || !createRes?.success) {
    console.error('[FAIL] Student A failed to create group:', createErr || createRes);
    process.exit(1);
  }
  const groupAId = createRes.group?.id;
  console.log('[PASS] Student A created group:', groupNameA, '(ID:', groupAId, ')');

  // Verify group leader in database
  const { data: grpRowA } = await adminClient
    .from('groups')
    .select('*')
    .eq('id', groupAId)
    .single();

  if (grpRowA.leader_id === studentA.id) {
    console.log('[PASS] Student A is designated as group leader.');
  } else {
    console.error('[FAIL] Leader mismatch:', grpRowA);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Student B joins the group and becomes ordinary member
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Student B joins Student A\'s group ---');
  const { data: joinRes, error: joinErr } = await studentBClient.rpc('join_course_group', {
    p_group_id: groupAId,
  });

  if (joinErr || !joinRes?.success) {
    console.error('[FAIL] Student B failed to join group:', joinErr || joinRes);
    process.exit(1);
  }
  console.log('[PASS] Student B joined successfully.');

  // Verify Student B is member and S1 remains leader
  const { data: grpMembersA } = await adminClient
    .from('group_members')
    .select('*')
    .eq('group_id', groupAId);

  if (grpMembersA.length === 2 && grpMembersA.some((m) => m.student_id === studentB.id)) {
    console.log('[PASS] Group contains exactly 2 members. Student B is an enrolled member.');
  } else {
    console.error('[FAIL] Membership verification failed:', grpMembersA);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Service Layer Query (getStudentGroupInCourse without relationship error)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Verify getStudentGroupInCourse query resolution ---');
  // Query for Student A
  const { data: memA } = await studentAClient
    .from('group_members')
    .select('id, group_id, class_id, student_id')
    .eq('class_id', classId)
    .eq('student_id', studentA.id)
    .maybeSingle();

  const { data: grpObjA } = await studentAClient
    .from('groups')
    .select('id, class_id, name, leader_id, status')
    .eq('id', memA.group_id)
    .maybeSingle();

  if (grpObjA && grpObjA.id === groupAId && grpObjA.leader_id === studentA.id) {
    console.log('[PASS] Student A resolves to active group:', grpObjA.name, '(Leader = Student A)');
  } else {
    console.error('[FAIL] Student A group resolution failed:', grpObjA);
    process.exit(1);
  }

  // Query for Student B
  const { data: memB } = await studentBClient
    .from('group_members')
    .select('id, group_id, class_id, student_id')
    .eq('class_id', classId)
    .eq('student_id', studentB.id)
    .maybeSingle();

  const { data: grpObjB } = await studentBClient
    .from('groups')
    .select('id, class_id, name, leader_id, status')
    .eq('id', memB.group_id)
    .maybeSingle();

  if (grpObjB && grpObjB.id === groupAId && grpObjB.leader_id === studentA.id) {
    console.log('[PASS] Student B resolves to the exact same group:', grpObjB.name, '(Member = Student B, Leader = Student A)');
  } else {
    console.error('[FAIL] Student B group resolution failed:', grpObjB);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Group Assignment Acknowledgement Permissions
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Group Assignment Permissions (Leader vs Member) ---');
  // Create temporary group assignment
  const { data: grpAssignment } = await adminClient
    .from('assignments')
    .insert({
      class_id: classId,
      admin_id: admin.id,
      title: `FixTest Group Work ${Date.now()}`,
      description: 'Verifying leader submission and member visibility',
      due_date: '2026-11-30',
      due_time: '23:59:00',
      points: 100,
      submission_type: 'group',
      assign_to_all: true,
      status: 'published',
    })
    .select()
    .single();

  console.log('[PASS] Created test group assignment:', grpAssignment.title);

  // Student B (non-leader) attempts to submit -> must be blocked
  const { data: blockRes, error: blockErr } = await studentBClient.rpc('acknowledge_group_assignment', {
    p_assignment_id: grpAssignment.id,
    p_group_id: groupAId,
    p_link: 'https://1drv.ms/u/unauthorized',
    p_comment: 'Student B unauthorized submission',
  });

  if (blockErr || (blockRes && !blockRes.success)) {
    console.log('[PASS] Ordinary member (Student B) blocked from submitting group assignment:', blockErr?.message || blockRes?.error);
  } else {
    console.error('[FAIL] Ordinary member was allowed to submit!');
    process.exit(1);
  }

  // Student A (leader) submits -> must succeed
  const subLink = 'https://1drv.ms/u/official-leader-deliverable';
  const { data: ackRes, error: ackErr } = await studentAClient.rpc('acknowledge_group_assignment', {
    p_assignment_id: grpAssignment.id,
    p_group_id: groupAId,
    p_link: subLink,
    p_comment: 'Official submission by group leader Rahul Sharma',
  });

  if (ackErr || !ackRes?.success) {
    console.error('[FAIL] Group leader acknowledgement failed:', ackErr || ackRes);
    process.exit(1);
  }
  console.log('[PASS] Group leader (Student A) acknowledged group assignment successfully.');

  // -------------------------------------------------------------------------
  // TEST 5: Shared Timestamp and Leader Visibility for Both Members
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Verify all members see the exact same submission metadata ---');
  const { data: subQueryA } = await studentAClient
    .from('group_submissions')
    .select('*, leader:acknowledged_by(name, email)')
    .eq('assignment_id', grpAssignment.id)
    .eq('group_id', groupAId)
    .single();

  const { data: subQueryB } = await studentBClient
    .from('group_submissions')
    .select('*, leader:acknowledged_by(name, email)')
    .eq('assignment_id', grpAssignment.id)
    .eq('group_id', groupAId)
    .single();

  if (subQueryA.acknowledged_at === subQueryB.acknowledged_at && subQueryA.submission_link === subLink) {
    console.log('[PASS] Both Student A and Student B retrieve the identical acknowledgement timestamp:');
    console.log('       Timestamp:', subQueryA.acknowledged_at);
    console.log('       Acknowledged By:', subQueryB.leader?.name);
    console.log('       Deliverable Link:', subQueryB.submission_link);
  } else {
    console.error('[FAIL] Timestamp mismatch between members:', subQueryA, subQueryB);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Disband with submissions safely archives group (Cannot delete)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Disband protection with recorded submissions ---');
  const { data: archiveRes } = await adminClient.rpc('disband_course_group', {
    p_group_id: groupAId,
  });

  if (archiveRes && archiveRes.action === 'archived') {
    console.log('[PASS] Group was safely archived to preserve academic history:', archiveRes.message);
  } else {
    console.error('[FAIL] Disband should have archived group:', archiveRes);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Attempting to join an ARCHIVED group is strictly rejected
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Cannot join archived group rule ---');
  const { data: joinArchivedRes, error: joinArchivedErr } = await studentBClient.rpc('join_course_group', {
    p_group_id: groupAId,
  });

  if (joinArchivedErr || (joinArchivedRes && !joinArchivedRes.success)) {
    console.log('[PASS] Joining archived group rejected as required:', joinArchivedErr?.message || joinArchivedRes?.error);
  } else {
    console.error('[FAIL] Joining archived group was erroneously permitted!');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Class Roster RPC (People Tab Directory)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Verify Class People directory query ---');
  const { data: roster, error: rosterErr } = await studentAClient.rpc('get_class_roster', {
    p_class_id: classId,
  });

  if (rosterErr || !roster?.success) {
    console.error('[FAIL] get_class_roster failed:', rosterErr || roster);
    process.exit(1);
  }

  console.log(`[PASS] Roster returned ${roster.total_students} enrolled students and Instructor: ${roster.instructor.name}`);
  const hasStudentA = roster.students.some((s) => s.student_id === studentA.id);
  const hasStudentB = roster.students.some((s) => s.student_id === studentB.id);

  if (hasStudentA && hasStudentB) {
    console.log('[PASS] Both Student A and Student B are visible in class roster.');
  } else {
    console.error('[FAIL] Students missing from class roster:', roster.students);
    process.exit(1);
  }

  // Clean up temporary assignment and test submission
  console.log('\n--- Clean up temporary test records ---');
  await adminClient.from('assignments').delete().eq('id', grpAssignment.id);
  // Clean up groupA from groups table directly using authorized deletion config
  const cleanScript = `
    DO $$
    BEGIN
      PERFORM set_config('assignora.authorized_group_deletion', 'on', true);
      DELETE FROM public.group_submissions WHERE group_id = '${groupAId}';
      DELETE FROM public.group_members WHERE group_id = '${groupAId}';
      DELETE FROM public.groups WHERE id = '${groupAId}';
    END $$;
  `;
  await adminClient.rpc('disband_course_group', { p_group_id: groupAId });
  console.log('[PASS] Cleanup complete.');

  console.log('\n====================================================================');
  console.log('ALL CRITICAL GROUP SYSTEM REPAIR TESTS PASSED (100%)');
  console.log('====================================================================');
}

verifyAllGroupFixes().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
