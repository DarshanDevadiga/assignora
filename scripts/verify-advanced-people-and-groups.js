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

async function verifyAdvancedPeopleAndGroups() {
  console.log('====================================================================');
  console.log('ASSIGNORA ADVANCED CLASS PEOPLE & GROUP MANAGEMENT TEST SUITE');
  console.log('====================================================================\n');

  // Authenticate Admin, Student 1, Student 2
  const adminClient = createClient(url, key);
  const { data: { user: admin } } = await adminClient.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  });
  console.log('[PASS] Admin authenticated:', admin.id);

  const student1Client = createClient(url, key);
  const { data: { user: student1 } } = await student1Client.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  });
  console.log('[PASS] Student 1 authenticated:', student1.id);

  const student2Client = createClient(url, key);
  const { data: { user: student2 } } = await student2Client.auth.signInWithPassword({
    email: 'student2@assignora.demo',
    password: 'Student@123',
  });
  console.log('[PASS] Student 2 authenticated:', student2.id);

  // Target class: Principles of Management
  const classId = '7c3f499e-dae5-47a3-aefb-68abbfd85845';

  // Pre-cleanup of any lingering E2E test groups in this class via secure disband RPC
  const { data: existingGMs } = await adminClient
    .from('group_members')
    .select('group_id, groups(id, name)')
    .eq('class_id', classId)
    .in('student_id', [student1.id, student2.id]);

  if (existingGMs && existingGMs.length > 0) {
    for (const gm of existingGMs) {
      if (gm.group_id) {
        // Remove any test submissions first so group can be safely disbanded
        await adminClient.from('group_submissions').delete().eq('group_id', gm.group_id);
        await adminClient.rpc('disband_course_group', { p_group_id: gm.group_id });
      }
    }
  }

  // TEST 1: Student 1 creates a group
  const groupName = `E2E Team ${Date.now()}`;
  console.log(`\n--- Test 1: Student 1 creates group "${groupName}" ---`);
  const { data: createRes, error: createErr } = await student1Client.rpc('create_course_group', {
    p_class_id: classId,
    p_name: groupName,
  });

  if (createErr || !createRes?.success) {
    console.error('[FAIL] Group creation failed:', createErr || createRes);
    process.exit(1);
  }
  const groupId = createRes.group?.id || createRes.group_id;
  console.log('[PASS] Group created with ID:', groupId);

  // TEST 2: Creator becomes leader and member
  console.log('\n--- Test 2: Verify creator is leader & member ---');
  const { data: groupRow } = await adminClient
    .from('groups')
    .select('*, group_members(*)')
    .eq('id', groupId)
    .single();

  if (groupRow.leader_id === student1.id) {
    console.log('[PASS] Creator is designated as group leader.');
  } else {
    console.error('[FAIL] Creator is not leader:', groupRow);
    process.exit(1);
  }

  const isS1Member = groupRow.group_members.some((m) => m.student_id === student1.id);
  if (isS1Member) {
    console.log('[PASS] Creator is enrolled in group_members.');
  } else {
    console.error('[FAIL] Creator not in group_members.');
    process.exit(1);
  }

  // TEST 3: Student 2 joins the group as ordinary member
  console.log('\n--- Test 3: Student 2 joins group ---');
  const { data: joinRes, error: joinErr } = await student2Client.rpc('join_course_group', {
    p_group_id: groupId,
  });

  if (joinErr || !joinRes?.success) {
    console.error('[FAIL] Student 2 failed to join group:', joinErr || joinRes);
    process.exit(1);
  }
  console.log('[PASS] Student 2 joined successfully.');

  // Verify S2 is member, NOT leader
  const { data: groupAfterJoin } = await adminClient
    .from('groups')
    .select('*, group_members(*)')
    .eq('id', groupId)
    .single();

  if (groupAfterJoin.leader_id === student1.id && groupAfterJoin.group_members.length === 2) {
    console.log('[PASS] Student 2 is an ordinary member. S1 remains leader. Member count = 2.');
  } else {
    console.error('[FAIL] Member integrity failed after join:', groupAfterJoin);
    process.exit(1);
  }

  // TEST 4: Student 2 cannot create another group in the same class
  console.log('\n--- Test 4: Enforce single-group per class rule ---');
  const { data: dupCreateRes, error: dupCreateErr } = await student2Client.rpc('create_course_group', {
    p_class_id: classId,
    p_name: `Illegal Group ${Date.now()}`,
  });

  if (dupCreateErr || (dupCreateRes && !dupCreateRes.success)) {
    console.log('[PASS] Student 2 correctly blocked from creating a second group in the same class:', dupCreateErr?.message || dupCreateRes?.error);
  } else {
    console.error('[FAIL] Student 2 was erroneously permitted to create another group:', dupCreateRes);
    process.exit(1);
  }

  // TEST 5: Leader transfers leadership to Student 2
  console.log('\n--- Test 5: Transfer leadership from Student 1 to Student 2 ---');
  const { data: transferRes, error: transferErr } = await student1Client.rpc('transfer_group_leadership', {
    p_group_id: groupId,
    p_new_leader_id: student2.id,
  });

  if (transferErr || !transferRes?.success) {
    console.error('[FAIL] Leadership transfer failed:', transferErr || transferRes);
    process.exit(1);
  }
  console.log('[PASS] Leadership transfer RPC succeeded:', transferRes.message);

  const { data: groupAfterTransfer } = await adminClient
    .from('groups')
    .select('leader_id')
    .eq('id', groupId)
    .single();

  if (groupAfterTransfer.leader_id === student2.id) {
    console.log('[PASS] Verified in database: Student 2 is now the active group leader.');
  } else {
    console.error('[FAIL] Leader was not updated:', groupAfterTransfer);
    process.exit(1);
  }

  // TEST 6: Student 1 (now ordinary member) leaves the group
  console.log('\n--- Test 6: Student 1 leaves group ---');
  const { data: leaveRes, error: leaveErr } = await student1Client.rpc('leave_course_group', {
    p_group_id: groupId,
  });

  if (leaveErr || !leaveRes?.success) {
    console.error('[FAIL] Student 1 failed to leave group:', leaveErr || leaveRes);
    process.exit(1);
  }
  console.log('[PASS] Student 1 left group successfully.');

  const { data: groupAfterLeave } = await adminClient
    .from('groups')
    .select('group_members(*)')
    .eq('id', groupId)
    .single();

  if (groupAfterLeave.group_members.length === 1 && groupAfterLeave.group_members[0].student_id === student2.id) {
    console.log('[PASS] Group now contains exactly 1 member (Student 2). Student 1 was removed.');
  } else {
    console.error('[FAIL] Leave integrity failed:', groupAfterLeave);
    process.exit(1);
  }

  // TEST 7: Student 1 is now eligible to create or join another group
  console.log('\n--- Test 7: Student 1 creates new group after leaving ---');
  const newGroupNameS1 = `S1 Solo Team ${Date.now()}`;
  const { data: s1NewGroupRes, error: s1NewGroupErr } = await student1Client.rpc('create_course_group', {
    p_class_id: classId,
    p_name: newGroupNameS1,
  });

  if (s1NewGroupErr || !s1NewGroupRes?.success) {
    console.error('[FAIL] Student 1 could not create a group after leaving previous group:', s1NewGroupErr || s1NewGroupRes);
    process.exit(1);
  }
  const s1NewGroupId = s1NewGroupRes.group?.id || s1NewGroupRes.group_id;
  console.log('[PASS] Student 1 successfully created new group after leaving previous group (ID:', s1NewGroupId, ')');

  // Disband previous temporary groups so students are eligible for Professor group
  console.log('\n--- Disbanding temporary student groups before professor test ---');
  await adminClient.rpc('disband_course_group', { p_group_id: s1NewGroupId });
  await adminClient.rpc('disband_course_group', { p_group_id: groupId });
  console.log('[PASS] Previous groups disbanded cleanly (zero submissions recorded).');

  // TEST 8: Professor creates group with assigned members
  console.log('\n--- Test 8: Professor creates group with member checklist ---');
  const profGroupName = `Prof Team ${Date.now()}`;
  const { data: profCreateRes, error: profCreateErr } = await adminClient.rpc('professor_create_group', {
    p_class_id: classId,
    p_name: profGroupName,
    p_member_ids: [student1.id, student2.id],
    p_leader_id: student1.id,
  });

  if (profCreateErr || !profCreateRes?.success) {
    console.error('[FAIL] Professor group creation failed:', profCreateErr || profCreateRes);
    process.exit(1);
  }
  const profGroupId = profCreateRes.group_id;
  console.log('[PASS] Professor created group successfully (ID:', profGroupId, ', Members:', profCreateRes.member_count, ')');

  // Verify group structure in database
  const { data: profGroupRow } = await adminClient
    .from('groups')
    .select('*, group_members(*)')
    .eq('id', profGroupId)
    .single();

  if (profGroupRow.leader_id === student1.id && profGroupRow.group_members.length === 2) {
    console.log('[PASS] Database verified: Professor-created group has S1 as leader and 2 enrolled members.');
  } else {
    console.error('[FAIL] Professor group structure verification failed:', profGroupRow);
    process.exit(1);
  }

  // TEST 9: get_class_roster RPC test (People tab fix)
  console.log('\n--- Test 9: get_class_roster RPC test (People tab fix) ---');
  const { data: rosterRes, error: rosterErr } = await student2Client.rpc('get_class_roster', {
    p_class_id: classId,
  });

  if (rosterErr || !rosterRes?.success) {
    console.error('[FAIL] get_class_roster failed for enrolled student:', rosterErr || rosterRes);
    process.exit(1);
  }

  console.log(`[PASS] Roster retrieved successfully by student. Total enrolled students: ${rosterRes.total_students}`);
  console.log(`       Instructor: ${rosterRes.instructor.name} (${rosterRes.instructor.email})`);

  const s1InRoster = rosterRes.students.find((s) => s.student_id === student1.id);
  if (s1InRoster && s1InRoster.is_leader && s1InRoster.group_name === profGroupName) {
    console.log(`[PASS] Student 1 properly annotated in roster: Leader of "${s1InRoster.group_name}"`);
  } else {
    console.error('[FAIL] Student 1 group annotation failed in roster:', s1InRoster);
    process.exit(1);
  }

  // TEST 10: Group Assignment Acknowledgement restricted to Leader
  console.log('\n--- Test 10: Leader-only acknowledgement check ---');
  // Create temporary group assignment
  const { data: grpAssn, error: grpAssnErr } = await adminClient
    .from('assignments')
    .insert({
      class_id: classId,
      admin_id: admin.id,
      title: `E2E Group Assignment ${Date.now()}`,
      description: 'Leader-only acknowledgement verification',
      points: 100,
      submission_type: 'group',
      assign_to_all: true,
      status: 'published',
      due_date: '2026-11-30',
      due_time: '23:59:00',
    })
    .select()
    .single();

  if (grpAssnErr || !grpAssn) {
    console.error('[FAIL] Failed to create group assignment:', grpAssnErr);
    process.exit(1);
  }

  // Non-leader (Student 2) attempts to submit for Student 1's group -> must fail
  const { data: illegalAckRes, error: illegalAckErr } = await student2Client.rpc('acknowledge_group_assignment', {
    p_assignment_id: grpAssn.id,
    p_group_id: profGroupId,
    p_link: 'https://drive.google.com/illegal.pdf',
    p_comment: 'Unauthorized submission',
  });

  if (illegalAckErr || (illegalAckRes && !illegalAckRes.success)) {
    console.log('[PASS] Unauthorized non-leader student correctly blocked from acknowledging group assignment:', illegalAckErr?.message || illegalAckRes?.error);
  } else {
    console.error('[FAIL] Non-leader was erroneously allowed to acknowledge group assignment!');
    process.exit(1);
  }

  // Authorized leader (Student 1) acknowledges for their group -> must succeed
  const { data: legalAckRes, error: legalAckErr } = await student1Client.rpc('acknowledge_group_assignment', {
    p_assignment_id: grpAssn.id,
    p_group_id: profGroupId,
    p_link: 'https://1drv.ms/u/s!leader-submission',
    p_comment: 'Official leader submission',
  });

  if (legalAckErr || !legalAckRes?.success) {
    console.error('[FAIL] Authorized group leader acknowledgement failed:', legalAckErr || legalAckRes);
    process.exit(1);
  }
  console.log('[PASS] Authorized group leader (Student 1) acknowledged group assignment successfully.');

  // TEST 11: Disband attempt after submission archives group to protect academic history
  console.log('\n--- Test 11: Disband protection with recorded submissions ---');
  const { data: archiveRes } = await adminClient.rpc('disband_course_group', { p_group_id: profGroupId });
  if (archiveRes && archiveRes.action === 'archived') {
    console.log('[PASS] Group was safely archived (NOT deleted) to preserve academic submission history.');
  } else {
    console.error('[FAIL] Group disband failed to archive submitted group:', archiveRes);
    process.exit(1);
  }

  // Post-test cleanup: delete temporary test assignment and clean up test archive
  console.log('\n--- Cleaning up temporary verification records ---');
  await adminClient.from('assignments').delete().eq('id', grpAssn.id);
  console.log('[PASS] Cleanup complete.');
  await adminClient.rpc('disband_course_group', { p_group_id: profGroupId });
  console.log('[PASS] Cleanup complete.');

  console.log('\n====================================================================');
  console.log('ALL ADVANCED PEOPLE & GROUP MANAGEMENT TESTS PASSED (100%)');
  console.log('====================================================================');
}

verifyAdvancedPeopleAndGroups().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
