import { supabase } from '../lib/supabase.js'
import { getAuthRedirectUrl } from '../utils/appUrl.js'
import { subscribeCacheClear } from '../utils/dataCache.js'

const profileCache = new Map()
const inFlightProfileRequests = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const PENDING_REG_KEY = 'assignora_pending_registration'
const USER_PROFILE_COLUMNS = 'id, name, email, role, avatar, student_id, created_at'

subscribeCacheClear(() => {
  profileCache.clear()
  inFlightProfileRequests.clear()
})

/**
 * Authentication Service for Assignora
 * Interacts with Supabase GoTrue Auth and public.users profile table.
 */
export const authService = {
  /**
   * Clear in-memory profile cache
   */
  clearProfileCache(userId) {
    if (userId) {
      profileCache.delete(userId)
    } else {
      profileCache.clear()
    }
  },

  /**
   * Persist temporary registration metadata so post-verification callback or first sign-in
   * can finish provisioning if email confirmation deferred session creation.
   */
  _savePendingRegistration(email, data) {
    if (typeof window === 'undefined' || !email) return
    try {
      window.sessionStorage.setItem(
        PENDING_REG_KEY,
        JSON.stringify({
          email: email.toLowerCase(),
          ...data,
          savedAt: Date.now(),
        })
      )
    } catch {
      // Ignore storage quota / private mode issues
    }
  },

  _consumePendingRegistration(email) {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(PENDING_REG_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!email || parsed.email === email.toLowerCase()) {
        window.sessionStorage.removeItem(PENDING_REG_KEY)
        return parsed
      }
      return null
    } catch {
      return null
    }
  },

  /**
   * Idempotently ensure a public.users profile exists for the currently authenticated user.
   */
  async ensureUserProfile(sessionUser, overrides = {}) {
    if (!sessionUser?.id) {
      throw new Error('Cannot provision profile without an authenticated user.')
    }

    const pending = this._consumePendingRegistration(sessionUser.email)
    const meta = sessionUser.user_metadata || {}

    const resolvedName = (
      overrides.name ||
      meta.name ||
      pending?.name ||
      sessionUser.email?.split('@')[0] ||
      'User'
    ).trim()

    const requestedRole = (overrides.role || meta.role || pending?.role || 'student').toLowerCase()
    const resolvedRole = requestedRole === 'admin' || requestedRole === 'professor' ? 'admin' : 'student'
    const resolvedToken = (overrides.facultyInviteToken || meta.faculty_invite_token || pending?.facultyInviteToken || '').trim() || null
    const resolvedStudentId = (overrides.studentId || meta.student_id || pending?.studentId || '').trim() || null

    // Attempt RPC provisioning using authenticated session
    const { data: rpcData, error: rpcError } = await supabase.rpc('register_user_profile', {
      p_name: resolvedName,
      p_role: resolvedRole,
      p_faculty_invite_token: resolvedToken,
      p_student_id: resolvedStudentId,
    })

    if (!rpcError && rpcData?.success && rpcData.profile) {
      profileCache.set(sessionUser.id, { profile: rpcData.profile, timestamp: Date.now() })
      return rpcData.profile
    }

    // If Professor token validation failed on RPC, propagate clear error unless profile already exists
    if (rpcData && rpcData.success === false && rpcData.error) {
      // Check if an existing profile row is present before failing
      const { data: existingRow } = await supabase
        .from('users')
        .select(USER_PROFILE_COLUMNS)
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (existingRow) {
        profileCache.set(sessionUser.id, { profile: existingRow, timestamp: Date.now() })
        return existingRow
      }

      throw new Error(rpcData.error)
    }

    if (rpcError) {
      console.warn('[authService] register_user_profile RPC error during ensureUserProfile:', rpcError.message)
    }

    // Re-query public.users (in case a database trigger created the profile concurrently)
    const { data: queriedProfile, error: queryError } = await supabase
      .from('users')
      .select(USER_PROFILE_COLUMNS)
      .eq('id', sessionUser.id)
      .maybeSingle()

    if (queryError) {
      throw new Error(queryError.message || 'Database error retrieving user profile.')
    }

    if (queriedProfile) {
      profileCache.set(sessionUser.id, { profile: queriedProfile, timestamp: Date.now() })
      return queriedProfile
    }

    // Fallback direct insert if users_insert_policy allows self-provisioning for students
    if (resolvedRole === 'student') {
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: sessionUser.id,
          name: resolvedName,
          email: sessionUser.email || '',
          role: 'student',
          student_id: resolvedStudentId || '',
        })
        .select()
        .maybeSingle()

      if (!insertErr && inserted) {
        profileCache.set(sessionUser.id, { profile: inserted, timestamp: Date.now() })
        return inserted
      }
    }

    throw new Error('User profile could not be retrieved or provisioned. Please contact support.')
  },

  /**
   * Register a new user with Supabase Auth and public.users profile
   */
  async signUp({ name, email, password, role = 'student', facultyInviteToken = null, studentId = null }) {
    const cleanEmail = email.trim()
    const cleanName = (name || '').trim()
    const cleanRole = role === 'admin' ? 'admin' : 'student'
    const cleanToken = facultyInviteToken ? facultyInviteToken.trim() : ''
    const cleanStudentId = studentId ? studentId.trim() : ''

    // 0. If registering as Professor/Faculty AND an invitation token is explicitly provided,
    // validate it strictly before creating an Auth user so invalid/expired tokens do not create partial accounts.
    if (cleanRole === 'admin' && cleanToken) {
      const { data: valRes, error: valErr } = await supabase.rpc('validate_faculty_invitation', {
        p_token: cleanToken,
        p_email: cleanEmail,
      })
      if (valErr) {
        throw new Error(valErr.message || 'Unable to validate Faculty Invitation Token right now. Please try again.')
      }
      if (!valRes || valRes.valid === false) {
        throw new Error(valRes?.error || 'Invalid Faculty Invitation Token.')
      }
    }

    // 1. Supabase Auth sign up with centralized production redirect URL & full metadata
    const redirectUrl = getAuthRedirectUrl('/auth/callback')
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: cleanName,
          role: cleanRole,
          student_id: cleanRole === 'student' ? cleanStudentId : '',
          faculty_invite_token: cleanRole === 'admin' ? cleanToken : '',
        },
      },
    })

    if (authError) {
      throw authError
    }

    if (!authData.user) {
      throw new Error('Registration failed. No user was returned.')
    }

    let profile = null

    // 2. If session is immediately established (email auto-confirm or confirmation disabled),
    // verify or provision profile immediately via authenticated RPC.
    if (authData.session) {
      profile = await this.ensureUserProfile(authData.user, {
        name: cleanName,
        role: cleanRole,
        facultyInviteToken: cleanToken,
        studentId: cleanStudentId,
      })
    } else {
      // Email confirmation pending: auth.users trigger handles creation server-side when deployed,
      // and sessionStorage holds fallback metadata for post-verification login / callback.
      this._savePendingRegistration(cleanEmail, {
        name: cleanName,
        role: cleanRole,
        facultyInviteToken: cleanToken,
        studentId: cleanStudentId,
      })
    }

    return {
      user: authData.user,
      session: authData.session,
      profile,
    }
  },

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      throw error
    }

    if (!data.user) {
      throw new Error('Authentication succeeded but user record is missing.')
    }

    // Fetch (or self-heal provision) corresponding profile from public.users table
    const profile = await this.getUserProfile(data.user.id, true)
    if (!profile) {
      throw new Error('Unable to load user profile. Please try signing in again.')
    }

    return {
      user: data.user,
      session: data.session,
      profile,
    }
  },

  /**
   * Send password reset email with production redirect
   */
  async resetPasswordForEmail(email) {
    const cleanEmail = email.trim()
    const redirectUrl = getAuthRedirectUrl('/login')
    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl,
    })
    if (error) {
      throw error
    }
    return data
  },

  /**
   * Sign out current user
   */
  async signOut() {
    this.clearProfileCache()
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(PENDING_REG_KEY)
      } catch {
        // Ignore
      }
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    return true
  },

  /**
   * Get active session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw error
    }
    return data.session
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      throw error
    }
    return user
  },

  /**
   * Fetch profile from public.users table by user id.
   * Uses .maybeSingle() to avoid HTTP 406 errors and auto-provisions missing authenticated profiles.
   */
  async getUserProfile(userId, forceFresh = false) {
    if (!userId) return null

    if (!forceFresh && profileCache.has(userId)) {
      const cached = profileCache.get(userId)
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.profile
      }
    }

    if (!forceFresh && inFlightProfileRequests.has(userId)) {
      return inFlightProfileRequests.get(userId)
    }

    const fetchPromise = (async () => {
      // Query with .maybeSingle() so 0 rows never produces HTTP 406 Not Acceptable
      const { data, error } = await supabase
        .from('users')
        .select(USER_PROFILE_COLUMNS)
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        // Handle rare duplicate profile integrity issue if more than 1 row matched
        if (error.code === 'PGRST116' || error.message?.includes('multiple')) {
          console.error(`[authService] Data integrity warning: duplicate profile rows detected for ${userId}`)
          const { data: rows, error: listErr } = await supabase
            .from('users')
            .select(USER_PROFILE_COLUMNS)
            .eq('id', userId)
            .order('created_at', { ascending: true })
            .limit(1)

          if (!listErr && rows?.length > 0) {
            profileCache.set(userId, { profile: rows[0], timestamp: Date.now() })
            return rows[0]
          }
        }
        console.error(`[authService] Database error fetching profile for ${userId}:`, error.message)
        throw new Error(error.message || 'Failed to retrieve user profile.')
      }

      if (data) {
        profileCache.set(userId, { profile: data, timestamp: Date.now() })
        return data
      }

      // No profile row exists yet: if this userId matches the active authenticated session, self-heal
      const { data: sessionData } = await supabase.auth.getSession()
      const currentUser = sessionData?.session?.user
      if (currentUser && currentUser.id === userId) {
        return await this.ensureUserProfile(currentUser)
      }

      return null
    })()

    if (!forceFresh) {
      inFlightProfileRequests.set(userId, fetchPromise)
    }

    try {
      return await fetchPromise
    } finally {
      if (!forceFresh) {
        inFlightProfileRequests.delete(userId)
      }
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  },
}
