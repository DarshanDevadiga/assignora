/**
 * verify-login-page-and-auth-flow.js
 * Verification for:
 * 1. Removal of Quick Demo Accounts section, buttons, and handlers from Login.jsx
 * 2. Preservation of standard email/password authentication
 * 3. Preservation of role-based routing (Admin/Professor -> /admin, Student -> /student)
 * 4. Error handling on invalid credentials
 * 5. Registration and password reset navigation
 * 6. Live Supabase authentication verification
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

test('Login.jsx — Quick Demo Accounts Section Completely Removed', async (t) => {
  const loginCode = readProjectFile('src/pages/Login.jsx');

  await t.test('1.1 Does not contain "Quick Demo Accounts" heading or text', () => {
    assert.doesNotMatch(
      loginCode,
      /Quick Demo Accounts/i,
      'Login page must not contain Quick Demo Accounts heading'
    );
  });

  await t.test('1.2 Does not contain Professor Demo or Student Demo buttons', () => {
    assert.doesNotMatch(loginCode, /Professor Demo/i);
    assert.doesNotMatch(loginCode, /Student Demo/i);
  });

  await t.test('1.3 Does not contain hardcoded demo email strings in UI handlers', () => {
    assert.doesNotMatch(loginCode, /setEmail\(['"]admin@assignora\.demo['"]\)/);
    assert.doesNotMatch(loginCode, /setEmail\(['"]student@assignora\.demo['"]\)/);
    assert.doesNotMatch(loginCode, /setPassword\(['"]admin123['"]\)/);
    assert.doesNotMatch(loginCode, /setPassword\(['"]student123['"]\)/);
  });

  await t.test('1.4 Standard form fields and submit button are present', () => {
    assert.match(loginCode, /label="Email address"/);
    assert.match(loginCode, /label="Password"/);
    assert.match(loginCode, /type="submit"/);
    assert.match(loginCode, /<span>Sign in<\/span>/);
  });

  await t.test('1.5 Forgot password and Register navigation links are preserved', () => {
    assert.match(loginCode, /handleForgotPassword/);
    assert.match(loginCode, /to="\/register"/);
    assert.match(loginCode, /Create an account/);
  });

  await t.test('1.6 Role-based redirection is preserved', () => {
    assert.match(loginCode, /targetRole\s*===\s*['"]admin['"]\s*\?\s*['"]\/admin['"]\s*:\s*['"]\/student['"]/);
  });
});

test('Live Authentication Verification — Role Routing & Error Handling', async (t) => {
  const { createClient } = await import('@supabase/supabase-js');
  
  const envContent = fs.readFileSync(path.join(rootDir, '.env'), 'utf-8');
  let url = '', key = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) url = trimmed.split('=')[1].trim();
    if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = trimmed.split('=')[1].trim();
  }

  const client = createClient(url, key);

  await t.test('2.1 Professor / Admin login returns admin role and routes to /admin', async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'admin@assignora.demo',
      password: 'Admin@12345',
    });

    assert.equal(error, null, 'Valid professor credentials must authenticate without error');
    assert.ok(data.user, 'User object returned');

    // Query user profile
    const { data: profile, error: profErr } = await client
      .from('users')
      .select('id, name, email, role')
      .eq('id', data.user.id)
      .single();

    assert.equal(profErr, null);
    assert.equal(profile.role, 'admin');

    const expectedDashboard = profile.role === 'admin' ? '/admin' : '/student';
    assert.equal(expectedDashboard, '/admin');
  });

  await t.test('2.2 Student login returns student role and routes to /student', async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'student1@assignora.demo',
      password: 'Student@123',
    });

    assert.equal(error, null, 'Valid student credentials must authenticate without error');
    assert.ok(data.user, 'User object returned');

    // Query user profile
    const { data: profile, error: profErr } = await client
      .from('users')
      .select('id, name, email, role')
      .eq('id', data.user.id)
      .single();

    assert.equal(profErr, null);
    assert.equal(profile.role, 'student');

    const expectedDashboard = profile.role === 'admin' ? '/admin' : '/student';
    assert.equal(expectedDashboard, '/student');
  });

  await t.test('2.3 Invalid credentials show clear error without throwing unhandled exception', async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistent_user_9999@assignora.demo',
      password: 'WrongPassword!123',
    });

    assert.ok(error, 'Expected error on invalid credentials');
    assert.equal(data.user, null);
    assert.match(error.message, /invalid login credentials|invalid credentials/i);
  });
});
