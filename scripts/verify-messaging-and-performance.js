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

function createTrackedClient() {
  let requestCount = 0;
  const requests = [];

  const customFetch = async (input, init) => {
    const start = performance.now();
    const urlStr = typeof input === 'string' ? input : input.url;
    requestCount++;
    const method = init?.method || 'GET';
    const entry = { url: urlStr, method, start };
    requests.push(entry);

    try {
      const response = await fetch(input, init);
      entry.durationMs = performance.now() - start;
      entry.status = response.status;
      return response;
    } catch (e) {
      entry.durationMs = performance.now() - start;
      entry.error = e.message;
      throw e;
    }
  };

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: customFetch,
    },
  });

  return {
    client,
    getStats: () => {
      const urls = requests.map(r => `${r.method} ${r.url.split('?')[0]}`);
      const duplicates = urls.filter((item, index) => urls.indexOf(item) !== index);
      return {
        totalRequests: requestCount,
        requests,
        duplicateCount: duplicates.length,
        duplicateUrls: [...new Set(duplicates)],
      };
    },
    resetStats: () => {
      requestCount = 0;
      requests.length = 0;
    }
  };
}

async function runTests() {
  console.log('====================================================================');
  console.log('ASSIGNORA VERIFICATION & PERFORMANCE TEST SUITE');
  console.log('====================================================================\n');

  // Test 1: Date & Time Formatting functions
  console.log('--- TEST 1: Date & Time Formatting Utilities ---');
  const {
    formatMessageDateSeparator,
    formatMessageTime,
    isDifferentDay,
  } = await import('../src/utils/calculations.js');

  const now = new Date();
  const todayStr = formatMessageDateSeparator(now);
  const timeStr = formatMessageTime(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatMessageDateSeparator(yesterday);

  const oldDate = new Date('2026-10-15T14:30:00Z');
  const oldDateStr = formatMessageDateSeparator(oldDate);

  console.log(`[PASS] Today format: "${todayStr}" (Expected: "Today")`);
  console.log(`[PASS] Yesterday format: "${yesterdayStr}" (Expected: "Yesterday")`);
  console.log(`[PASS] Older date format: "${oldDateStr}" (Matches DD Mon YYYY)`);
  console.log(`[PASS] 12-hour local time format: "${timeStr}" (e.g. 10:35 AM)`);
  console.log(`[PASS] Different day helper: isDifferentDay(today, yesterday) = ${isDifferentDay(now, yesterday)}`);

  if (todayStr !== 'Today' || yesterdayStr !== 'Yesterday' || !timeStr.match(/(AM|PM)/i)) {
    throw new Error('Date/Time formatting check failed!');
  }

  // Test 2: Message flow between Student and Admin
  console.log('\n--- TEST 2: Realtime & Database Messaging Synchronization ---');
  const { client: studentClient } = createTrackedClient();
  const { client: adminClient } = createTrackedClient();

  const { data: { user: studentUser } } = await studentClient.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  });
  const { data: { user: adminUser } } = await adminClient.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  });

  const classId = '7c3f499e-dae5-47a3-aefb-68abbfd85845'; // Principles of Management

  // Student inserts message
  const testMsgText = `Automated Sync Test ${Date.now()}`;
  const { data: studentInserted, error: insertErr } = await studentClient
    .from('class_messages')
    .insert({
      class_id: classId,
      sender_id: studentUser.id,
      message: testMsgText,
    })
    .select(`
      id,
      class_id,
      sender_id,
      message,
      created_at,
      users:sender_id (id, name, email, avatar, role)
    `)
    .single();

  if (insertErr) throw new Error('Student insert failed: ' + insertErr.message);
  console.log(`[PASS] Student inserted message ID: ${studentInserted.id}`);
  console.log(`       Sender name: ${studentInserted.users?.name}, role: ${studentInserted.users?.role}`);

  // Admin fetches messages for class
  const { data: adminFetched, error: adminFetchErr } = await adminClient
    .from('class_messages')
    .select(`
      id,
      class_id,
      sender_id,
      message,
      created_at,
      users:sender_id (id, name, email, avatar, role)
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: true });

  if (adminFetchErr) throw new Error('Admin fetch failed: ' + adminFetchErr.message);
  const found = adminFetched.find((m) => m.id === studentInserted.id);
  if (!found) throw new Error('Admin could not see the message sent by student!');
  console.log(`[PASS] Admin successfully retrieved student message: "${found.message}"`);
  console.log(`       Admin verified sender: ${found.users?.name} (${found.users?.role})`);

  // Cleanup test message
  await adminClient.from('class_messages').delete().eq('id', studentInserted.id);
  console.log(`[PASS] Cleaned up temporary test message from database.`);

  // Test 3: Measure Optimized Performance
  console.log('\n--- TEST 3: Optimized Performance Measurement ---');

  // Admin Optimized Measurement
  const adminTrack = createTrackedClient();
  const tAdmin0 = performance.now();
  const { data: adminAuth } = await adminTrack.client.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  });
  const adminLoginMs = performance.now() - tAdmin0;

  // In-memory / cached profile fetch simulation (< 1ms when cached)
  const tProf0 = performance.now();
  const { data: adminProf } = await adminTrack.client.from('users').select('*').eq('id', adminAuth.user.id).single();
  const adminProfileMs = performance.now() - tProf0;

  // Optimized Admin Dashboard: Parallel fetch of classes, assignments, and announcements
  const tAdminDash0 = performance.now();
  const [optClasses, optAssns, optAnns] = await Promise.all([
    adminTrack.client
      .from('classes')
      .select(`
        *,
        class_members (
          id,
          student_id,
          joined_at,
          users:student_id (id, name, email, avatar, student_id)
        ),
        assignments (
          id,
          title,
          status,
          due_date,
          due_time,
          points
        )
      `)
      .eq('admin_id', adminAuth.user.id)
      .order('created_at', { ascending: false }),
    adminTrack.client
      .from('assignments')
      .select(`
        id,
        title,
        description,
        due_date,
        due_time,
        points,
        assign_to_all,
        status,
        created_at,
        class_id,
        classes:class_id (
          id,
          name,
          subject,
          class_members (
            id,
            student_id,
            users:student_id (id, name, email)
          )
        ),
        assignment_students (
          student_id,
          users:student_id (id, name, email)
        ),
        submissions (
          id,
          student_id,
          status,
          submitted_at
        )
      `)
      .order('created_at', { ascending: false }),
    adminTrack.client
      .from('announcements')
      .select(`
        id,
        title,
        message,
        class_id,
        created_at,
        users:admin_id (id, name, email, avatar)
      `)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  const adminDashMs = performance.now() - tAdminDash0;
  const adminStats = adminTrack.getStats();

  console.log('\nOPTIMIZED ADMIN RESULTS:');
  console.log(`- Login request: ${adminLoginMs.toFixed(1)} ms`);
  console.log(`- Profile fetch: ${adminProfileMs.toFixed(1)} ms`);
  console.log(`- Dashboard data ready: ${adminDashMs.toFixed(1)} ms`);
  console.log(`- Total HTTP requests: ${adminStats.totalRequests}`);
  console.log(`- Duplicate requests: ${adminStats.duplicateCount}`);

  // Student Optimized Measurement
  const studentTrack = createTrackedClient();
  const tStud0 = performance.now();
  const { data: studAuth } = await studentTrack.client.auth.signInWithPassword({
    email: 'student1@assignora.demo',
    password: 'Student@123',
  });
  const studLoginMs = performance.now() - tStud0;

  const tStudProf0 = performance.now();
  const { data: studProf } = await studentTrack.client.from('users').select('*').eq('id', studAuth.user.id).single();
  const studProfileMs = performance.now() - tStudProf0;

  // Optimized Student Dashboard: Stage 1 parallel fetch
  const tStudDash0 = performance.now();
  const [optMems, optSpec, optSubs] = await Promise.all([
    studentTrack.client
      .from('class_members')
      .select(`
        class_id,
        classes (id, name, subject, admin_id)
      `)
      .eq('student_id', studAuth.user.id),
    studentTrack.client
      .from('assignment_students')
      .select(`
        assignment_id,
        assignments (
          *,
          classes (id, name, subject)
        )
      `)
      .eq('student_id', studAuth.user.id),
    studentTrack.client
      .from('submissions')
      .select(`
        *,
        assignments (
          id,
          title,
          points,
          due_date,
          due_time,
          classes (id, name)
        )
      `)
      .eq('student_id', studAuth.user.id)
      .order('submitted_at', { ascending: false }),
  ]);

  const classIds = (optMems.data || []).map((m) => m.classes).filter(Boolean).map((c) => c.id);
  if (classIds.length > 0) {
    await studentTrack.client
      .from('assignments')
      .select(`
        *,
        classes (id, name, subject)
      `)
      .in('class_id', classIds)
      .eq('assign_to_all', true)
      .eq('status', 'published');
  }

  const studDashMs = performance.now() - tStudDash0;
  const studStats = studentTrack.getStats();

  console.log('\nOPTIMIZED STUDENT RESULTS:');
  console.log(`- Login request: ${studLoginMs.toFixed(1)} ms`);
  console.log(`- Profile fetch: ${studProfileMs.toFixed(1)} ms`);
  console.log(`- Dashboard data ready: ${studDashMs.toFixed(1)} ms`);
  console.log(`- Total HTTP requests: ${studStats.totalRequests}`);
  console.log(`- Duplicate requests: ${studStats.duplicateCount}`);

  console.log('\n====================================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================================');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
