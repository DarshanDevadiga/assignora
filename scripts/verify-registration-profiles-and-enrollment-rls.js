import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8')
}

test('Static & Security Audits — Auth, Profiles & Class Enrollment', async (t) => {
  const authServiceSrc = readFile('src/services/auth.service.js')
  const authContextSrc = readFile('src/context/AuthContext.jsx')
  const authCallbackSrc = readFile('src/pages/AuthCallback.jsx')
  const registerSrc = readFile('src/pages/Register.jsx')
  const classesServiceSrc = readFile('src/services/classes.service.js')
  const joinModalSrc = readFile('src/components/class/JoinClassModal.jsx')
  const joinPageSrc = readFile('src/pages/shared/JoinClassPage.jsx')
  const migrationSrc = readFile('supabase/migrations/20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql')
  const rollbackSrc = readFile('supabase/migrations/rollback_round2_registration_and_enrollment.sql')

  await t.test('1.1 authService.getUserProfile uses .maybeSingle() and self-heals missing profiles (no 406)', () => {
    assert.ok(!authServiceSrc.includes('.single()'), 'auth.service.js must not use .single() for user profiles')
    assert.ok(authServiceSrc.includes('.maybeSingle()'), 'auth.service.js must use .maybeSingle()')
    assert.ok(authServiceSrc.includes('ensureUserProfile'), 'auth.service.js must provide ensureUserProfile self-healing')
  })

  await t.test('1.2 authService.signUp passes full metadata and does not attempt unauthenticated table inserts', () => {
    assert.ok(authServiceSrc.includes('student_id:'), 'signUp options.data must preserve student_id')
    assert.ok(authServiceSrc.includes('faculty_invite_token:'), 'signUp options.data must preserve faculty_invite_token')
    assert.ok(authServiceSrc.includes('validate_faculty_invitation'), 'signUp must validate faculty invite token before auth creation')
  })

  await t.test('1.3 AuthContext & AuthCallback do not grant fallback roles when profile is missing', () => {
    assert.ok(authContextSrc.includes('if (!authUser || !profile || !profile.role) return null'), 'AuthContext must require verified profile role')
    assert.ok(!authCallbackSrc.includes('user_metadata?.role'), 'AuthCallback must not trust client metadata for role redirection')
  })

  await t.test('1.4 Register.jsx enforces Faculty Invitation Token for Professor accounts', () => {
    assert.ok(!registerSrc.includes('(Optional in Demo)'), 'Register.jsx must not claim faculty token is optional in demo')
    assert.ok(registerSrc.includes("role === 'admin' && !facultyToken.trim()"), 'Register.jsx must validate non-empty faculty token')
  })

  await t.test('1.5 classesService.findClassByCode & enrollStudent avoid 403 and enforce student verification', () => {
    assert.ok(classesServiceSrc.includes('get_class_preview_by_code'), 'findClassByCode must prioritize secure preview RPC')
    assert.ok(classesServiceSrc.includes("profile.role !== 'student'"), 'enrollStudent must enforce student role')
    assert.ok(classesServiceSrc.includes('currentUserId !== studentId'), 'enrollStudent must block mismatched user IDs')
    assert.ok(classesServiceSrc.includes('authService.getUserProfile'), 'enrollStudent must verify/provision user profile first')
  })

  await t.test('1.6 JoinClassModal & JoinClassPage validate session & returned membership', () => {
    assert.ok(joinModalSrc.includes('classPreview.student_count'), 'JoinClassModal must support RPC student_count')
    assert.ok(joinModalSrc.includes('!membership || (!membership.id && !membership.class_id)'), 'JoinClassModal must verify membership record')
    assert.ok(joinPageSrc.includes('!membership || (!membership.id && !membership.class_id)'), 'JoinClassPage must verify membership record')
  })

  await t.test('1.7 Migration & Rollback scripts define complete trigger, policies, and security invariants', () => {
    assert.ok(migrationSrc.includes('CREATE OR REPLACE FUNCTION public.handle_new_user()'), 'Migration must define handle_new_user trigger function')
    assert.ok(migrationSrc.includes('CREATE TRIGGER on_auth_user_created'), 'Migration must attach trigger to auth.users')
    assert.ok(migrationSrc.includes('CREATE POLICY "users_insert_policy"'), 'Migration must define users INSERT policy')
    assert.ok(migrationSrc.includes('CREATE POLICY "class_members_insert_policy"'), 'Migration must define secure class_members INSERT policy')
    assert.ok(migrationSrc.includes('CREATE POLICY "class_members_select_policy"'), 'Migration must define class_members SELECT policy')
    assert.ok(migrationSrc.includes('is_instructor_of_caller'), 'Migration must allow students to see their instructors')
    assert.ok(migrationSrc.includes("SET search_path TO 'pg_catalog', 'pg_temp'"), 'All SECURITY DEFINER functions must lock search_path')
    assert.ok(rollbackSrc.includes('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users'), 'Rollback script must cleanly drop trigger')
  })
})

test('Live Supabase Verification — Profile 406 Prevention, Class Preview & Enrollment Rules', async (t) => {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  assert.ok(url && key, 'Supabase env vars must be configured')

  const sb = createClient(url, key)

  await t.test('2.1 Profile retrieval with .maybeSingle() returns 200 (not 406) for missing and existing profiles', async () => {
    const { data: sAuth, error: sErr } = await sb.auth.signInWithPassword({
      email: 'student1@assignora.demo',
      password: 'Student@123',
    })
    assert.equal(sErr, null, 'Student login must succeed')

    // Existing profile
    const existingRes = await sb.from('users').select('*').eq('id', sAuth.user.id).maybeSingle()
    assert.equal(existingRes.status, 200)
    assert.equal(existingRes.error, null)
    assert.equal(existingRes.data.role, 'student')

    // Non-existent UUID with .maybeSingle() must NOT return 406
    const missingRes = await sb.from('users').select('*').eq('id', '00000000-0000-0000-0000-000000000099').maybeSingle()
    assert.equal(missingRes.status, 200)
    assert.equal(missingRes.error, null)
    assert.equal(missingRes.data, null)
  })

  await t.test('2.2 Student reads class preview, class_members, and handles duplicate/invalid codes cleanly', async () => {
    // Class preview via secure RPC (no 403)
    const preview = await sb.rpc('get_class_preview_by_code', { p_code: 'E2E398' })
    assert.equal(preview.error, null)
    assert.equal(preview.data?.success, true)
    assert.equal(preview.data?.class?.class_code, 'E2E398')

    // Query permitted class_members (no 403)
    const cmRes = await sb.from('class_members').select('id, class_id, student_id').eq('class_id', preview.data.class.id)
    assert.equal(cmRes.status, 200)
    assert.equal(cmRes.error, null)
    assert.ok(Array.isArray(cmRes.data) && cmRes.data.length > 0)

    // Duplicate join handled cleanly
    const dupJoin = await sb.rpc('join_class_by_code', { p_code: 'E2E398' })
    assert.equal(dupJoin.error, null)
    assert.equal(dupJoin.data?.success, false)
    assert.equal(dupJoin.data?.already_member, true)

    // Invalid code handled cleanly
    const badJoin = await sb.rpc('join_class_by_code', { p_code: 'BAD999' })
    assert.equal(badJoin.error, null)
    assert.equal(badJoin.data?.success, false)
    assert.ok(badJoin.data?.error.includes('Invalid class code'))
  })

  await t.test('2.3 Professor/Admin reads class members and cannot enroll as student via join_class_by_code', async () => {
    await sb.auth.signOut()
    const { data: aAuth, error: aErr } = await sb.auth.signInWithPassword({
      email: 'admin@assignora.demo',
      password: 'Admin@12345',
    })
    assert.equal(aErr, null, 'Admin login must succeed')

    const aProfile = await sb.from('users').select('*').eq('id', aAuth.user.id).maybeSingle()
    assert.equal(aProfile.data?.role, 'admin')

    // Admin reads class_members cleanly
    const cmRes = await sb.from('class_members').select('id, class_id, student_id')
    assert.equal(cmRes.status, 200)
    assert.equal(cmRes.error, null)
    assert.ok(cmRes.data.length > 0)

    // Admin blocked from enrolling as student via join_class_by_code
    const adminJoin = await sb.rpc('join_class_by_code', { p_code: 'E2E398' })
    assert.equal(adminJoin.error, null)
    assert.equal(adminJoin.data?.success, false)
    assert.ok(adminJoin.data?.error.includes('Only student accounts'))

    await sb.auth.signOut()
  })
})
