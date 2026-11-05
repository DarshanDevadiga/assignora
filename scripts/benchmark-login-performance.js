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

// Interceptor to track requests
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

async function measureLogin(email, password, role) {
  const { client, getStats, resetStats } = createTrackedClient();

  console.log(`\n======================================================`);
  console.log(`MEASURING BASELINE: ${role.toUpperCase()} (${email})`);
  console.log(`======================================================`);

  // 1. Measure Login Request
  const t0 = performance.now();
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  const loginDurationMs = performance.now() - t0;
  if (authError) throw authError;

  const userId = authData.user.id;

  // 2. Measure Profile Fetch Duration
  const tProfile0 = performance.now();
  const { data: profile, error: profileErr } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  const profileFetchDurationMs = performance.now() - tProfile0;

  // 3. Measure Dashboard Load Duration (simulating exact queries in AdminDashboard or StudentDashboard)
  const tDash0 = performance.now();

  if (role === 'admin') {
    // Current Admin Dashboard logic:
    // a. classesService.getAdminClasses
    const { data: fetchedClasses } = await client
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
      .eq('admin_id', userId)
      .order('created_at', { ascending: false });

    // b. assignmentsService.getAdminAssignments
    const { data: fetchedAssignments } = await client
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
      .order('created_at', { ascending: false });

    // c. Sequential active class announcements
    if (fetchedClasses && fetchedClasses.length > 0) {
      await client
        .from('announcements')
        .select(`
          id,
          title,
          message,
          created_at,
          users:admin_id (id, name, email, avatar)
        `)
        .eq('class_id', fetchedClasses[0].id)
        .order('created_at', { ascending: false });
    }
  } else {
    // Current Student Dashboard logic:
    // a. Fetch memberships
    const { data: memberRows } = await client
      .from('class_members')
      .select(`
        class_id,
        classes (id, name, subject, admin_id)
      `)
      .eq('student_id', userId);

    const studentClasses = memberRows?.map((m) => m.classes).filter(Boolean) || [];
    const classIds = studentClasses.map((c) => c.id);

    // b. Fetch published assignments
    if (classIds.length > 0) {
      await client
        .from('assignments')
        .select(`
          *,
          classes (id, name, subject)
        `)
        .in('class_id', classIds)
        .eq('assign_to_all', true)
        .eq('status', 'published');
    }

    // c. Fetch selective assignments
    await client
      .from('assignment_students')
      .select(`
        assignment_id,
        assignments (
          *,
          classes (id, name, subject)
        )
      `)
      .eq('student_id', userId);

    // d. Fetch submissions
    await client
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
      .eq('student_id', userId)
      .order('submitted_at', { ascending: false });
  }

  const dashboardDataReadyMs = performance.now() - tDash0;
  const totalFlowMs = performance.now() - t0;

  const stats = getStats();

  console.log(`- Login request duration: ${loginDurationMs.toFixed(1)} ms`);
  console.log(`- Profile fetch duration: ${profileFetchDurationMs.toFixed(1)} ms`);
  console.log(`- Dashboard data ready duration: ${dashboardDataReadyMs.toFixed(1)} ms`);
  console.log(`- Total login -> data ready duration: ${totalFlowMs.toFixed(1)} ms`);
  console.log(`- Total Supabase HTTP requests: ${stats.totalRequests}`);
  console.log(`- Duplicate requests detected: ${stats.duplicateCount}`);
  if (stats.duplicateUrls.length > 0) {
    console.log(`  Duplicates:`, stats.duplicateUrls);
  }

  return {
    role,
    loginDurationMs,
    profileFetchDurationMs,
    dashboardDataReadyMs,
    totalFlowMs,
    totalRequests: stats.totalRequests,
    duplicateCount: stats.duplicateCount,
  };
}

async function runBenchmark() {
  const adminRes = await measureLogin('admin@assignora.demo', 'Admin@12345', 'admin');
  const studentRes = await measureLogin('student1@assignora.demo', 'Student@123', 'student');

  console.log('\n======================================================');
  console.log('SUMMARY BASELINE METRICS:');
  console.log(JSON.stringify({ admin: adminRes, student: studentRes }, null, 2));
}

runBenchmark().catch(console.error);
