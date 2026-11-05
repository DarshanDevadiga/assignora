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

async function verifyFullWorkflow() {
  console.log('====================================================================');
  console.log('ASSIGNORA COMPREHENSIVE SUBMISSION VERIFICATION SUITE');
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

  // 1. Create temporary assignment in Principles of Management
  const classId = '7c3f499e-dae5-47a3-aefb-68abbfd85845';
  const { data: assn, error: assnErr } = await adminClient
    .from('assignments')
    .insert({
      class_id: classId,
      admin_id: admin.id,
      title: `E2E Verify Assignment ${Date.now()}`,
      description: 'End-to-end verification of submission workflow',
      points: 100,
      assign_to_all: true,
      status: 'published',
      due_date: '2026-11-30',
      due_time: '23:59:00',
    })
    .select()
    .single();

  if (assnErr) throw assnErr;
  console.log(`\n[PASS] Created test assignment "${assn.title}" (ID: ${assn.id})`);

  try {
    // 2. Test Student 1 first-time submission
    const now = new Date().toISOString();
    const { data: s1Sub, error: s1Err } = await student1Client
      .from('submissions')
      .insert({
        assignment_id: assn.id,
        student_id: student1.id,
        submission_link: 'https://drive.google.com/file/d/student1-project.pdf',
        comment: 'Comprehensive project deliverable from Student 1',
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (s1Err) throw s1Err;
    console.log(`[PASS] Student 1 submitted successfully: ID ${s1Sub.id}, status="${s1Sub.status}"`);

    // 3. Test duplicate submission by Student 1 (must be blocked by DB unique constraint)
    const { data: dup, error: dupErr } = await student1Client
      .from('submissions')
      .insert({
        assignment_id: assn.id,
        student_id: student1.id,
        submission_link: 'https://drive.google.com/file/d/duplicate-attempt',
        status: 'submitted',
        submitted_at: now,
      })
      .select()
      .single();

    if (dupErr && dupErr.code === '23505') {
      console.log(`[PASS] Duplicate submission correctly blocked by unique constraint: ${dupErr.message}`);
    } else {
      throw new Error('Duplicate submission was not blocked!');
    }

    // 4. Test Student 2 submission
    const { data: s2Sub, error: s2Err } = await student2Client
      .from('submissions')
      .insert({
        assignment_id: assn.id,
        student_id: student2.id,
        submission_link: 'https://github.com/ananya-v/assignora-research',
        comment: 'Research paper repository submission',
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (s2Err) throw s2Err;
    console.log(`[PASS] Student 2 submitted successfully: ID ${s2Sub.id}, status="${s2Sub.status}"`);

    // 5. Verify Admin dashboard visibility
    const { data: adminList, error: adminListErr } = await adminClient
      .from('submissions')
      .select('*, users:student_id(id, name, email)')
      .eq('assignment_id', assn.id);

    if (adminListErr) throw adminListErr;
    console.log(`[PASS] Admin can view ${adminList.length} submissions for assignment:`);
    adminList.forEach(s => {
      console.log(`       - ${s.users?.name}: ${s.submission_link} [${s.status}]`);
    });

    if (adminList.length !== 2) {
      throw new Error(`Expected 2 submissions in Admin view, found ${adminList.length}`);
    }

    // 6. Verify Student RLS isolation (Student 1 only sees Student 1's submission)
    const { data: s1List } = await student1Client
      .from('submissions')
      .select('*')
      .eq('assignment_id', assn.id);

    console.log(`[PASS] Student 1 queried submissions: returned ${s1List.length} row(s) (only their own)`);
    if (s1List.some(s => s.student_id !== student1.id)) {
      throw new Error('Student 1 can see submissions from other students!');
    }

    // 7. Verify resubmission / updating link
    const updatedLink = 'https://drive.google.com/file/d/student1-project-v2.pdf';
    const { data: updatedSub, error: upErr } = await student1Client
      .from('submissions')
      .update({
        submission_link: updatedLink,
        updated_at: new Date().toISOString(),
      })
      .eq('id', s1Sub.id)
      .select()
      .single();

    if (upErr) throw upErr;
    console.log(`[PASS] Resubmission update succeeded: new link="${updatedSub.submission_link}"`);

  } finally {
    // Cleanup
    console.log('\nCleaning up verification records...');
    await adminClient.from('submissions').delete().eq('assignment_id', assn.id);
    await adminClient.from('assignments').delete().eq('id', assn.id);
    console.log('[PASS] Cleanup complete.');
  }

  console.log('\n====================================================================');
  console.log('ALL SUBMISSION TESTS PASSED WITH ZERO ERRORS!');
  console.log('====================================================================');
}

verifyFullWorkflow().catch((err) => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});
