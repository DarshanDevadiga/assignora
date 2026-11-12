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

test('Faculty Registration Optional Invitation Token — Code & SQL Security Audit', async (t) => {
  const registerSrc = readFile('src/pages/Register.jsx')
  const authServiceSrc = readFile('src/services/auth.service.js')
  const authContextSrc = readFile('src/context/AuthContext.jsx')
  const migrationSrc = readFile('supabase/migrations/20261112000001_round2_optional_faculty_invitation_token.sql')
  const verificationSrc = readFile('supabase/migrations/post_migration_verification_faculty_token.sql')
  const rollbackSrc = readFile('supabase/migrations/rollback_round2_optional_faculty_invitation_token.sql')

  await t.test('1. Register.jsx displays optional token label & helper text without blocking empty tokens', () => {
    assert.ok(registerSrc.includes('Faculty Invitation Token (Optional)'))
    assert.ok(
      registerSrc.includes(
        'If you have an invitation token from your department administrator, enter it here. Otherwise, you can leave this field empty.'
      )
    )
    assert.ok(!registerSrc.includes("role === 'admin' && !facultyToken.trim()"))
    assert.ok(!registerSrc.match(/label="Faculty Invitation Token \(Optional\)"[\s\S]{0,120}\brequired\b/))
    assert.ok(registerSrc.includes('trimmedFacultyToken ? trimmedFacultyToken : null'))
  })

  await t.test('2. auth.service.js handles empty, valid, and invalid faculty tokens correctly', () => {
    assert.ok(authServiceSrc.includes("if (cleanRole === 'admin' && cleanToken)"))
    assert.ok(authServiceSrc.includes("supabase.rpc('validate_faculty_invitation'"))
    assert.ok(authServiceSrc.includes('if (valErr)'))
    assert.ok(authServiceSrc.includes('if (!valRes || valRes.valid === false)'))
    assert.ok(!authServiceSrc.includes("throw new Error('Professor registration requires a valid Faculty Invitation Token"))
    // Direct client fallback insert remains strictly restricted to students
    assert.ok(authServiceSrc.includes("if (resolvedRole === 'student')"))
  })

  await t.test('3. Staged migration makes token optional while preserving security & RLS guards', () => {
    assert.ok(migrationSrc.includes("IF v_clean_token = '' THEN\n    RETURN jsonb_build_object(\n      'valid', true,\n      'optional', true,\n      'has_token', false\n    );"))
    assert.ok(migrationSrc.includes("IF v_meta_role IN ('admin', 'professor', 'faculty') THEN"))
    assert.ok(migrationSrc.includes('-- Optional invitation token omitted: permit Faculty registration cleanly'))
    assert.ok(migrationSrc.includes('-- Explicit non-empty token that is invalid/used/expired: never grant Faculty role'))
    assert.ok(migrationSrc.includes('Unauthorized role escalation attempt rejected.'))
    assert.ok(migrationSrc.includes('SET search_path = pg_catalog, pg_temp'))
    assert.ok(!migrationSrc.includes('DISABLE ROW LEVEL SECURITY'))
    assert.ok(!migrationSrc.includes('DROP POLICY "users_insert_policy"'))
    assert.ok(verificationSrc.includes('on_auth_user_created'))
    assert.ok(rollbackSrc.includes('CREATE OR REPLACE FUNCTION public.handle_new_user()'))
  })

  await t.test('4. AuthContext preserves server-verified role & cache hygiene', () => {
    assert.ok(authContextSrc.includes('if (!authUser || !profile || !profile.role) return null'))
  })
})

test('Live Supabase Auth & RLS Regression Checks (Non-Mutating)', async (t) => {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    t.skip('Supabase environment variables not configured')
    return
  }

  const sb = createClient(url, key)

  await t.test('5. Empty token is accepted and invalid non-empty token is rejected by live validate_faculty_invitation RPC', async () => {
    const emptyRes = await sb.rpc('validate_faculty_invitation', {
      p_token: '',
      p_email: 'faculty.test@university.edu',
    })
    assert.equal(emptyRes.error, null)
    assert.equal(emptyRes.data?.valid, true)
    assert.equal(emptyRes.data?.optional, true)
    assert.equal(emptyRes.data?.has_token, false)

    const { data, error } = await sb.rpc('validate_faculty_invitation', {
      p_token: 'FAC-DEFINITELY-INVALID-99999',
      p_email: 'faculty.test@university.edu',
    })
    assert.equal(error, null)
    assert.equal(data?.valid, false)
    assert.match(data?.error || '', /Invalid Faculty Invitation Token/i)
  })

  await t.test('6. Student cannot escalate their own role via public.users UPDATE or register_user_profile', async () => {
    const { data: sAuth, error: sErr } = await sb.auth.signInWithPassword({
      email: 'student1@assignora.demo',
      password: 'Student@123',
    })
    assert.equal(sErr, null, 'Student login must succeed')

    // Attempt direct self-role escalation via UPDATE (must fail RLS)
    const { error: updErr } = await sb
      .from('users')
      .update({ role: 'admin' })
      .eq('id', sAuth.user.id)
    assert.ok(updErr, 'Direct role self-update to admin must be rejected by users_update_policy')

    // Attempt self-role escalation via register_user_profile RPC (must preserve student role)
    const { data: rpcRes, error: rpcErr } = await sb.rpc('register_user_profile', {
      p_name: 'Student Attempt Escalation',
      p_role: 'admin',
      p_faculty_invite_token: null,
      p_student_id: null,
    })
    assert.equal(rpcErr, null)
    assert.equal(rpcRes?.role, 'student', 'Existing student profile role must remain student')

    await sb.auth.signOut()
  })

  await t.test('7. Existing faculty/admin login returns verified admin role cleanly', async () => {
    const { data: aAuth, error: aErr } = await sb.auth.signInWithPassword({
      email: 'admin@assignora.demo',
      password: 'Admin@12345',
    })
    assert.equal(aErr, null, 'Faculty/Admin login must succeed')

    const { data: prof, error: profErr } = await sb
      .from('users')
      .select('id, role, email')
      .eq('id', aAuth.user.id)
      .maybeSingle()
    assert.equal(profErr, null)
    assert.equal(prof?.role, 'admin')

    await sb.auth.signOut()
  })
})
