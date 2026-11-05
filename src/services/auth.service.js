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
