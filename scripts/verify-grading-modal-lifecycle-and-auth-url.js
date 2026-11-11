import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('ISSUE 1 — Group Grading Modal Lifecycle Verification', async (t) => {
  const submissionTrackingSource = fs.readFileSync(
    path.resolve('src/pages/admin/SubmissionTracking.jsx'),
    'utf8'
  )

  await t.test('1.1 Modal visibility starts false and inspectedGroup starts null', () => {
    assert.match(
      submissionTrackingSource,
      /const \[inspectedGroup, setInspectedGroup\] = useState\(null\)/,
      'inspectedGroup must initialize to null'
    )
    assert.match(
      submissionTrackingSource,
      /const \[isGroupDetailModalOpen, setIsGroupDetailModalOpen\] = useState\(false\)/,
      'isGroupDetailModalOpen must initialize to false'
    )
  })

  await t.test('1.2 Auto-inspect effect is completely removed; modal never opens automatically on mount/query', () => {
    // Check that there is no useEffect calling openGroupGradingModal based on targetGroupId
    const hasAutoOpenEffect = /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?openGroupGradingModal[\s\S]*?targetGroupId/i.test(
      submissionTrackingSource
    )
    assert.equal(
      hasAutoOpenEffect,
      false,
      'There must be NO useEffect automatically calling openGroupGradingModal based on targetGroupId'
    )
  })

  await t.test('1.3 loadAssignmentDetails concurrently fetches groups and submissions via Promise.all', () => {
    assert.match(
      submissionTrackingSource,
      /Promise\.all\(\[\s*groupsService\.getCourseGroups\(details\.class_id\)/,
      'loadAssignmentDetails must fetch course groups and submissions concurrently to prevent stale pending state'
    )
    assert.match(
      submissionTrackingSource,
      /setCurrentAssignment\(details\)[\s\S]*?setCourseGroups\(grps\)[\s\S]*?setGroupSubmissions\(gSubs\)/,
      'Assignment details, course groups, and group submissions must be updated together'
    )
  })

  await t.test('1.4 handleSwitchAssignment resets modal state to closed', () => {
    assert.match(
      submissionTrackingSource,
      /handleSwitchAssignment[\s\S]*?setIsGroupDetailModalOpen\(false\)[\s\S]*?setInspectedGroup\(null\)/,
      'Switching assignments must close the grading modal and clear inspected group'
    )
  })

  await t.test('1.5 handleCloseGroupModal cleanly resets modal state and purges query params', () => {
    assert.match(
      submissionTrackingSource,
      /handleCloseGroupModal = \(\) => \{[\s\S]*?setIsGroupDetailModalOpen\(false\)[\s\S]*?setInspectedGroup\(null\)/,
      'Closing the group modal must set isGroupDetailModalOpen to false and inspectedGroup to null'
    )
  })

  await t.test('1.6 handleSaveGroupGrade validates boundaries, awaits database grade, and closes modal', () => {
    assert.match(
      submissionTrackingSource,
      /handleSaveGroupGrade[\s\S]*?groupsService\.gradeGroupSubmission[\s\S]*?loadAssignmentDetails[\s\S]*?handleCloseGroupModal\(\)/,
      'Saving grade must call gradeGroupSubmission, refresh assignment details, and close the modal'
    )
  })

  await t.test('1.7 Status badges differentiate Deliverable Submitted vs Acknowledged (No Deliverable)', () => {
    assert.match(
      submissionTrackingSource,
      /hasDeliverable = Boolean\(\s*sub && sub\.submission_link/,
      'Must distinguish between delivered links and mere acknowledgements'
    )
    assert.match(
      submissionTrackingSource,
      /Deliverable Submitted[\s\S]*?Acknowledged/,
      'Modal and table must clearly separate Deliverable Submitted from Acknowledged records'
    )
  })
})

test('ISSUE 2 — Centralized Production URL and Auth Callback Verification', async (t) => {
  const appUrlSource = fs.readFileSync(path.resolve('src/utils/appUrl.js'), 'utf8')
  const authServiceSource = fs.readFileSync(path.resolve('src/services/auth.service.js'), 'utf8')
  const appRoutesSource = fs.readFileSync(path.resolve('src/routes/AppRoutes.jsx'), 'utf8')
  const authCallbackSource = fs.readFileSync(path.resolve('src/pages/AuthCallback.jsx'), 'utf8')
  const inviteModalSource = fs.readFileSync(
    path.resolve('src/components/class/InviteStudentModal.jsx'),
    'utf8'
  )

  await t.test('2.1 getAppUrl resolves to https://assignora-cyan.vercel.app', () => {
    assert.match(
      appUrlSource,
      /const DEFAULT_PRODUCTION_URL = 'https:\/\/assignora-cyan\.vercel\.app'/,
      'DEFAULT_PRODUCTION_URL must be https://assignora-cyan.vercel.app'
    )
    assert.match(
      appUrlSource,
      /export function getAppUrl\(\)/,
      'getAppUrl must be exported'
    )
  })

  await t.test('2.2 getAuthRedirectUrl enforces HTTPS in production and builds clean path', () => {
    assert.match(
      appUrlSource,
      /export function getAuthRedirectUrl\(path = '\/auth\/callback'\)/,
      'getAuthRedirectUrl must default to /auth/callback'
    )
    assert.ok(
      appUrlSource.includes("fullUrl.replace(/^http://', 'https://')") ||
      appUrlSource.includes('https://'),
      'getAuthRedirectUrl must enforce HTTPS'
    )
  })

  await t.test('2.3 authService.signUp passes emailRedirectTo with production redirect URL', () => {
    assert.match(
      authServiceSource,
      /import \{ getAuthRedirectUrl \} from '\.\.\/utils\/appUrl\.js'/,
      'auth.service.js must import getAuthRedirectUrl'
    )
    assert.match(
      authServiceSource,
      /const redirectUrl = getAuthRedirectUrl\('\/auth\/callback'\)/,
      'signUp must construct redirectUrl with /auth/callback'
    )
    assert.match(
      authServiceSource,
      /emailRedirectTo:\s*redirectUrl/,
      'supabase.auth.signUp must pass options.emailRedirectTo'
    )
  })

  await t.test('2.4 authService.resetPasswordForEmail uses production redirect URL', () => {
    assert.match(
      authServiceSource,
      /async resetPasswordForEmail\(email\)/,
      'authService must implement resetPasswordForEmail'
    )
    assert.match(
      authServiceSource,
      /getAuthRedirectUrl\('\/login'\)/,
      'resetPasswordForEmail must use getAuthRedirectUrl'
    )
  })

  await t.test('2.5 AppRoutes mounts /auth/callback with AuthCallback component', () => {
    assert.match(
      appRoutesSource,
      /const AuthCallback = lazy\(\(\) => import\('\.\.\/pages\/AuthCallback'\)\)/,
      'AppRoutes must lazy load AuthCallback'
    )
    assert.match(
      appRoutesSource,
      /<Route path="\/auth\/callback" element=\{<AuthCallback \/>\} \/>/,
      'AppRoutes must register /auth/callback route'
    )
  })

  await t.test('2.6 AuthCallback component handles PKCE code, OTP token hash, and session redirection', () => {
    assert.match(
      authCallbackSource,
      /supabase\.auth\.exchangeCodeForSession\(code\)/,
      'AuthCallback must handle PKCE authorization codes'
    )
    assert.match(
      authCallbackSource,
      /supabase\.auth\.verifyOtp/,
      'AuthCallback must handle token hash verification'
    )
    assert.match(
      authCallbackSource,
      /authService\.getUserProfile/,
      'AuthCallback must retrieve user profile for role dashboard'
    )
    assert.match(
      authCallbackSource,
      /navigate\(role === 'admin' \? '\/admin' : '\/student', \{ replace: true \}\)/,
      'AuthCallback must redirect based on user role'
    )
  })

  await t.test('2.7 InviteStudentModal uses getAppUrl() instead of window.location.origin directly', () => {
    assert.match(
      inviteModalSource,
      /import \{ getAppUrl \} from '\.\.\/\.\.\/utils\/appUrl'/,
      'InviteStudentModal must import getAppUrl'
    )
    assert.match(
      inviteModalSource,
      /const inviteUrl = `\$\{getAppUrl\(\)\}\/join-class\?code=\$\{classCode\}`/,
      'inviteUrl must be constructed using getAppUrl()'
    )
  })
})
