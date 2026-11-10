import { supabase } from '../lib/supabase.js'

const profileCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

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
   * Register a new user with Supabase Auth and public.users profile
   */
  async signUp({ name, email, password, role = 'student', facultyInviteToken = null, studentId = null }) {
    const cleanEmail = email.trim()
    const cleanName = (name || '').trim()

    // 1. Supabase Auth sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
          role,
        },
      },
    })

    if (authError) {
      throw authError
    }

    if (!authData.user) {
      throw new Error('Registration failed. No user was returned.')
    }

    const userId = authData.user.id
    let profile = null

    // 2. Profile Creation via RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_user_profile', {
        p_name: cleanName,
        p_role: role,
        p_faculty_invite_token: facultyInviteToken ? facultyInviteToken.trim() : null,
        p_student_id: studentId ? studentId.trim() : null,
      })

      if (!rpcError && rpcData?.success) {
        profile = rpcData.profile
      }
    } catch (rpcErr) {
      console.warn('[authService] register_user_profile RPC error:', rpcErr)
    }

    // 3. Fallback direct insert if RPC not present yet
    if (!profile) {
      try {
        const { data: insertedProfile } = await supabase
          .from('users')
          .insert({
            id: userId,
            name: cleanName,
            email: cleanEmail,
            role,
            student_id: role === 'student' ? (studentId?.trim() || '') : '',
          })
          .select()
          .maybeSingle()

        if (insertedProfile) {
          profile = insertedProfile
        }
      } catch (insertErr) {
        console.warn('[authService] Direct profile insert error:', insertErr)
      }
    }

    const finalProfile = profile || {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
    }

    profileCache.set(userId, { profile: finalProfile, timestamp: Date.now() })

    return {
      user: authData.user,
      session: authData.session,
      profile: finalProfile,
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

    // Fetch corresponding profile from public.users table
    const profile = await this.getUserProfile(data.user.id)
    return {
      user: data.user,
      session: data.session,
      profile,
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
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
   * Fetch profile from public.users table by user id (cached in memory for high performance)
   */
  async getUserProfile(userId, forceFresh = false) {
    if (!userId) return null

    if (!forceFresh && profileCache.has(userId)) {
      const cached = profileCache.get(userId)
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.profile
      }
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn(`[authService] Could not fetch public.users profile for ${userId}:`, error.message)
      return null
    }

    profileCache.set(userId, { profile: data, timestamp: Date.now() })
    return data
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
